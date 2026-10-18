import { jsPDF } from "jspdf";
import { MAX_RESUME_EDIT_LENGTH, validateResumeFile, validateResumePageCount } from "./resume-source.ts";
import type { PdfBlockLocation, ResumeEdit, ResumeSource, ResumeTextBlock } from "./resume-source.ts";

type PdfTextItemLike = {
  str: string;
  width: number;
  height: number;
  transform: number[];
  fontName?: string;
  hasEOL?: boolean;
};

type PdfViewportLike = {
  convertToViewportPoint(x: number, y: number): number[];
};

type MappedPdfItem = {
  text: string;
  index: number;
  origin: [number, number];
  end: [number, number];
  axis: [number, number];
  hasEOL: boolean;
  fontName?: string;
  location: PdfBlockLocation;
};

type PdfEditPlan = {
  edits: Array<{ block: ResumeTextBlock; edit: ResumeEdit }>;
  overflows: Array<{ blockId: string; reason: string }>;
};

type CanvasMeasure = (text: string, block: ResumeTextBlock) => number;

const DEFAULT_TEXT_COLOR = "#232a30";
const MAX_PAGE_PIXELS = 20_000_000;

function viewportPoint(viewport: PdfViewportLike, x: number, y: number): [number, number] {
  const point = viewport.convertToViewportPoint(x, y);
  return [point[0] ?? 0, point[1] ?? 0];
}

export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window === "undefined") {
    // PDF.js resolves this relative to its own module in Node's fake-worker path.
    pdfjs.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";
  } else if (import.meta.env.DEV) {
    // The local Vite preview's module worker can stall before PDF.js completes
    // its handshake. Its built-in loopback worker keeps parsing in-browser.
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
    (globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker = worker;
  } else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

function normalizeDirection(degrees: number) {
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized * 10) / 10;
}

export function mapPdfTextItem(
  item: PdfTextItemLike,
  pageNumber: number,
  viewport: PdfViewportLike,
  itemIndex = 0,
): MappedPdfItem {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = item.transform;
  const horizontalLength = Math.hypot(a, b) || 1;
  const verticalLength = Math.hypot(c, d) || Math.max(item.height, 1);
  const axis: [number, number] = [a / horizontalLength, b / horizontalLength];
  const vertical: [number, number] = [c / verticalLength, d / verticalLength];
  const origin = viewportPoint(viewport, e, f);
  const baselineEnd = viewportPoint(viewport, e + axis[0] * item.width, f + axis[1] * item.width);
  const topEnd = viewportPoint(viewport,
    e + axis[0] * item.width + vertical[0] * item.height,
    f + axis[1] * item.width + vertical[1] * item.height,
  );
  const topStart = viewportPoint(viewport, e + vertical[0] * item.height, f + vertical[1] * item.height);
  const points = [origin, baselineEnd, topEnd, topStart];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const viewportAxisEnd = viewportPoint(viewport, e + axis[0], f + axis[1]);
  const direction = normalizeDirection(Math.atan2(viewportAxisEnd[1] - origin[1], viewportAxisEnd[0] - origin[0]) * 180 / Math.PI);

  return {
    text: item.str,
    index: itemIndex,
    origin,
    end: baselineEnd,
    axis: [Math.cos(direction * Math.PI / 180), Math.sin(direction * Math.PI / 180)],
    hasEOL: item.hasEOL ?? false,
    fontName: item.fontName,
    location: {
      page: pageNumber,
      itemIndexes: [itemIndex],
      box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      direction,
      fontSize: Math.max(1, verticalLength),
      color: DEFAULT_TEXT_COLOR,
    },
  };
}

function directionDistance(a: number, b: number) {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

function projectedGap(previous: MappedPdfItem, next: MappedPdfItem) {
  const dx = next.origin[0] - previous.end[0];
  const dy = next.origin[1] - previous.end[1];
  return dx * previous.axis[0] + dy * previous.axis[1];
}

function shouldJoin(previous: MappedPdfItem, next: MappedPdfItem) {
  if (previous.hasEOL || directionDistance(previous.location.direction, next.location.direction) > 3) return false;
  if (previous.fontName && next.fontName && previous.fontName !== next.fontName) return false;
  const size = Math.max(previous.location.fontSize, next.location.fontSize);
  if (Math.abs(previous.location.fontSize - next.location.fontSize) > Math.max(1.5, size * 0.2)) return false;
  const normal: [number, number] = [-previous.axis[1], previous.axis[0]];
  const baselineDelta = (next.origin[0] - previous.origin[0]) * normal[0] + (next.origin[1] - previous.origin[1]) * normal[1];
  if (Math.abs(baselineDelta) > Math.max(2, size * 0.35)) return false;
  const gap = projectedGap(previous, next);
  return gap >= -size * 0.5 && gap <= Math.max(18, size * 2.25);
}

function needsWordSpace(previous: string, next: string, gap: number, fontSize: number) {
  const last = Array.from(previous).at(-1) ?? "";
  const first = Array.from(next).at(0) ?? "";
  const latinOrNumber = /^[\p{Script=Latin}\p{N}]$/u;
  return gap > fontSize * 0.18 && latinOrNumber.test(last) && latinOrNumber.test(first);
}

export function groupPdfTextItems(
  items: readonly PdfTextItemLike[],
  pageNumber: number,
  viewport: PdfViewportLike,
): ResumeTextBlock[] {
  const mapped = items
    .map((item, index) => mapPdfTextItem(item, pageNumber, viewport, index))
    .filter((item) => item.text.trim());
  const groups: MappedPdfItem[][] = [];
  for (const current of mapped) {
    const previousGroup = groups.at(-1);
    const previous = previousGroup?.at(-1);
    if (previous && shouldJoin(previous, current)) previousGroup?.push(current);
    else groups.push([current]);
  }

  return groups.map((group, index) => {
    const first = group[0];
    let text = first.text;
    for (let position = 1; position < group.length; position += 1) {
      const previous = group[position - 1];
      const current = group[position];
      const gap = projectedGap(previous, current);
      if (needsWordSpace(previous.text, current.text, gap, first.location.fontSize)
        && !/\s$/u.test(text) && !/^\s/u.test(current.text)) text += " ";
      text += current.text;
    }
    const boxes = group.map(({ location }) => location.box);
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return {
      id: `pdf-p${pageNumber}-b${index}`,
      section: "简历内容",
      text,
      editable: directionDistance(first.location.direction, 0) <= 0.5,
      location: {
        page: pageNumber,
        itemIndexes: group.map(({ index: itemIndex }) => itemIndex),
        box: { x: left, y: top, width: right - left, height: bottom - top },
        direction: first.location.direction,
        fontSize: first.location.fontSize,
        color: first.location.color,
      },
    };
  });
}

export function estimatePdfBackgroundColor(samples: readonly (readonly [number, number, number])[]) {
  if (!samples.length) return "#ffffff";
  const channels = [0, 1, 2].map((channel) => {
    const sorted = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return Math.round(value).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function directionExtent(location: PdfBlockLocation) {
  const radians = location.direction * Math.PI / 180;
  return Math.abs(Math.cos(radians)) * location.box.width + Math.abs(Math.sin(radians)) * location.box.height;
}

export function planPdfEdits(source: ResumeSource, edits: ResumeEdit[], measureText: CanvasMeasure): PdfEditPlan {
  if (source.format !== "pdf") throw new Error("PDF 导出仅支持 PDF 原稿。");
  if (!Array.isArray(edits)) throw new Error("改写列表无效。");
  const blocks = new Map(source.blocks.map((block) => [block.id, block]));
  const seen = new Set<string>();
  const plan: PdfEditPlan = { edits: [], overflows: [] };

  for (const edit of edits) {
    if (!edit || typeof edit.blockId !== "string" || typeof edit.replacement !== "string") throw new Error("改写内容无效。");
    if (seen.has(edit.blockId)) throw new Error("改写列表包含重复块 ID。");
    seen.add(edit.blockId);
    const block = blocks.get(edit.blockId);
    if (!block) throw new Error("改写列表包含未知块 ID。");
    if (!block.editable || !("page" in block.location)) throw new Error("目标文字块不可编辑。");
    if (edit.replacement.length > MAX_RESUME_EDIT_LENGTH) throw new Error("改写内容不能超过 4,000 个字符。");
    const available = directionExtent(block.location);
    const measured = measureText(edit.replacement, block);
    if (edit.replacement.includes("\n") || !Number.isFinite(measured) || measured > available + 0.5) {
      plan.overflows.push({ blockId: edit.blockId, reason: "改写内容超出原文字范围；请缩短、保留原文或跳过。" });
      continue;
    }
    plan.edits.push({ block, edit });
  }
  return plan;
}

function colorSamplesAround(context: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }) {
  const samples: [number, number, number][] = [];
  const step = Math.max(2, Math.floor(Math.min(box.width, box.height) / 4));
  const left = Math.max(0, Math.floor(box.x - 3));
  const right = Math.min(context.canvas.width - 1, Math.ceil(box.x + box.width + 3));
  const top = Math.max(0, Math.floor(box.y - 3));
  const bottom = Math.min(context.canvas.height - 1, Math.ceil(box.y + box.height + 3));
  const points: Array<[number, number]> = [];
  for (let x = left; x <= right; x += step) points.push([x, top], [x, bottom]);
  for (let y = top; y <= bottom; y += step) points.push([left, y], [right, y]);
  for (const [x, y] of points) {
    const { data } = context.getImageData(x, y, 1, 1);
    samples.push([data[0], data[1], data[2]]);
  }
  return samples;
}

function estimateTextColor(context: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }, background: string) {
  const backdrop = background.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16)) ?? [255, 255, 255];
  const left = Math.max(0, Math.floor(box.x));
  const top = Math.max(0, Math.floor(box.y));
  const width = Math.max(1, Math.min(context.canvas.width - left, Math.ceil(box.width)));
  const height = Math.max(1, Math.min(context.canvas.height - top, Math.ceil(box.height)));
  const { data } = context.getImageData(left, top, width, height);
  const counts = new Map<string, number>();
  for (let index = 0; index < data.length; index += 4) {
    const color: [number, number, number] = [data[index], data[index + 1], data[index + 2]];
    const contrast = Math.hypot(color[0] - backdrop[0], color[1] - backdrop[1], color[2] - backdrop[2]);
    if (contrast < 48) continue;
    const key = color.map((value) => Math.round(value / 8) * 8).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const mostCommon = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return mostCommon ? `#${mostCommon.split(",").map((value) => Number(value).toString(16).padStart(2, "0")).join("")}` : DEFAULT_TEXT_COLOR;
}

function drawReplacement(context: CanvasRenderingContext2D, block: ResumeTextBlock, replacement: string, scale: number) {
  const location = block.location as PdfBlockLocation;
  const box = { x: location.box.x * scale, y: location.box.y * scale, width: location.box.width * scale, height: location.box.height * scale };
  const background = estimatePdfBackgroundColor(colorSamplesAround(context, box));
  const textColor = estimateTextColor(context, box, background);
  context.fillStyle = background;
  context.fillRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
  context.save();
  context.translate(box.x, box.y + Math.min(box.height * 0.86, location.fontSize * scale));
  context.rotate(location.direction * Math.PI / 180);
  context.fillStyle = textColor;
  context.font = `${location.fontSize * scale}px Arial, sans-serif`;
  context.textBaseline = "alphabetic";
  context.fillText(replacement, 0, 0);
  context.restore();
}

function createCanvas() {
  if (typeof document === "undefined") throw new Error("PDF 导出需要浏览器画布环境。");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("无法创建 PDF 页面预览画布。");
  return { canvas, context };
}

export async function parsePdfResume(file: File): Promise<ResumeSource> {
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  validateResumeFile({ name: file.name, type: file.type, size: file.size }, signature);
  const data = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true });
  let documentProxy;
  try {
    documentProxy = await loadingTask.promise;
    const pageCount = validateResumePageCount("pdf", documentProxy.numPages, false).pageCount;
    const blocks: ResumeTextBlock[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems = content.items
        .filter((item): item is typeof item & { str: string } => "str" in item && typeof item.str === "string" && Boolean(item.str.trim()))
        .map((item) => item as unknown as PdfTextItemLike);
      if (!textItems.length) throw new Error(`第 ${pageNumber} 页没有可提取文字；扫描件或空白页暂不支持，不能通过 OCR 处理。`);
      blocks.push(...groupPdfTextItems(textItems, pageNumber, viewport));
    }
    if (!blocks.length) throw new Error("PDF 中没有可提取的简历文字。");
    return { format: "pdf", fileName: file.name, file, pageCount, pageCountEstimated: false, blocks, warnings: [] };
  } catch (error) {
    if (error instanceof Error && /密码|加密|PasswordException/i.test(`${error.name} ${error.message}`)) {
      throw new Error("此 PDF 已加密或受密码保护；请先在本地解除保护后重新上传。");
    }
    if (error instanceof Error && (/第 \d+ 页没有可提取文字/.test(error.message) || /超过 10 页/.test(error.message))) throw error;
    throw new Error("无法解析此 PDF；请确认文件未损坏、未加密且包含可提取文字。");
  } finally {
    await loadingTask.destroy();
  }
}

export async function exportFlatPdfResume(source: ResumeSource, edits: ResumeEdit[]): Promise<{ blob: Blob; overflows: Array<{ blockId: string; reason: string }> }> {
  if (source.format !== "pdf") throw new Error("只能导出 PDF 原稿。");
  const { canvas, context } = createCanvas();
  context.font = "12px Arial, sans-serif";
  const plan = planPdfEdits(source, edits, (text, block) => {
    const location = block.location as PdfBlockLocation;
    context.font = `${location.fontSize}px Arial, sans-serif`;
    return context.measureText(text).width;
  });
  const editsByPage = new Map<number, Array<{ block: ResumeTextBlock; replacement: string }>>();
  for (const { block, edit } of plan.edits) {
    const page = (block.location as PdfBlockLocation).page;
    editsByPage.set(page, [...(editsByPage.get(page) ?? []), { block, replacement: edit.replacement }]);
  }

  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await source.file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true });
  let documentProxy;
  let output: jsPDF | undefined;
  try {
    documentProxy = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = 2;
      const viewport = page.getViewport({ scale });
      if (viewport.width * viewport.height > MAX_PAGE_PIXELS) throw new Error("页面尺寸过大，无法安全生成扁平 PDF。");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      for (const edit of editsByPage.get(pageNumber) ?? []) drawReplacement(context, edit.block, edit.replacement, scale);

      const pageWidth = baseViewport.width * 0.75;
      const pageHeight = baseViewport.height * 0.75;
      if (!output) output = new jsPDF({ unit: "pt", format: [pageWidth, pageHeight], compress: true });
      else output.addPage([pageWidth, pageHeight]);
      output.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
    }
    if (!output) throw new Error("PDF 没有可导出的页面。");
    return { blob: output.output("blob"), overflows: plan.overflows };
  } catch (error) {
    if (error instanceof Error && /PasswordException|密码|加密/i.test(`${error.name} ${error.message}`)) throw new Error("此 PDF 已加密或受密码保护，无法导出。");
    throw error;
  } finally {
    await loadingTask.destroy();
    canvas.width = 0;
    canvas.height = 0;
  }
}
