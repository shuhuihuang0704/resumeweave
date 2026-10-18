import JSZip from "jszip";
import { MAX_RESUME_EDIT_LENGTH, validateResumeFile, validateResumePageCount } from "./resume-source.ts";
import type { DocxBlockLocation, ResumeEdit, ResumeSource, ResumeTextBlock } from "./resume-source.ts";

export type DocxLayoutMetrics = { pageCount: number; blockHeights: Record<string, number> };

export function mapDocxParagraphHeights(
  blocks: readonly Pick<ResumeTextBlock, "id" | "text">[],
  renderedParagraphs: readonly { text: string; height: number }[],
): Record<string, number> {
  const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
  const sourceCounts = new Map<string, number>();
  const renderedByText = new Map<string, number[]>();
  for (const block of blocks) {
    const text = normalize(block.text);
    sourceCounts.set(text, (sourceCounts.get(text) ?? 0) + 1);
  }
  renderedParagraphs.forEach(({ text, height }) => {
    const normalized = normalize(text);
    if (!normalized) return;
    renderedByText.set(normalized, [...(renderedByText.get(normalized) ?? []), height]);
  });
  const heights: Record<string, number> = {};
  for (const block of blocks) {
    const normalized = normalize(block.text);
    const matches = renderedByText.get(normalized);
    if (sourceCounts.get(normalized) === 1 && matches?.length === 1) heights[block.id] = matches[0];
  }
  return heights;
}

type XmlPart = { document: Document; serializer: XMLSerializer };
type DocxArchive = { zip: JSZip; documentXml: string; pageMetadataXml: string | null };
type ParagraphRecord = {
  paragraph: Element;
  paragraphIndex: number;
  tablePath: number[];
  runs: Element[];
  text: string;
  runRanges: DocxBlockLocation["runRanges"];
  editable: boolean;
};

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const APP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_000;
const PREVIEW_CLASS = "resume-docx-page";

function parseXml(xml: string, label: string): XmlPart {
  if (/<!\s*(?:DOCTYPE|ENTITY)/iu.test(xml)) throw new Error(`${label}包含不受支持的 XML 声明。`);
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") throw new Error("当前环境缺少本地 XML 解析能力。");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error(`${label} XML 格式无效。`);
  return { document, serializer: new XMLSerializer() };
}

function elements(parent: Node): Element[] {
  return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1);
}

function isWordElement(element: Element, name: string) {
  return element.namespaceURI === WORD_NS && (element.localName ?? element.nodeName.split(":").at(-1)) === name;
}

function wordDescendants(element: Element, name: string): Element[] {
  return Array.from(element.getElementsByTagNameNS(WORD_NS, name));
}

function directWordChild(element: Element, name: string) {
  return elements(element).find((child) => isWordElement(child, name));
}

export function parseDocxPageCountMetadata(xml: string | null | undefined): number | null {
  if (!xml) return null;
  try {
    const document = parseXml(xml, "页数元数据").document;
    const pages = Array.from(document.getElementsByTagNameNS(APP_NS, "Pages"))[0];
    const value = pages?.textContent?.trim() ?? "";
    if (!/^\d+$/u.test(value)) return null;
    const count = Number(value);
    return Number.isSafeInteger(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}

async function loadDocxArchive(file: Blob & { name?: string }): Promise<DocxArchive> {
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  validateResumeFile({ name: file.name ?? "resume.docx", type: file.type, size: file.size }, signature);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: false, createFolders: false });
  } catch {
    throw new Error("无法读取 DOCX ZIP 容器；文件可能损坏或受密码保护。");
  }

  const entries = Object.values(zip.files);
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error("DOCX 条目超过 2,000 个，已停止处理。");
  const expandedBytes = entries.reduce((sum, entry) => {
    if (entry.dir) return sum;
    const uncompressedSize = (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    return sum + uncompressedSize;
  }, 0);
  if (expandedBytes > MAX_EXPANDED_BYTES) throw new Error("DOCX 解压后超过 50 MiB，已停止处理。");
  if (zip.file("EncryptedPackage") || zip.file("EncryptionInfo")) throw new Error("此 Word 文件已加密；请先在本地解除保护后重新上传。");
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry || !zip.file("[Content_Types].xml")) throw new Error("文件不是有效的 DOCX 文档包。");
  const [documentXml, pageMetadataXml] = await Promise.all([
    documentEntry.async("string"),
    zip.file("docProps/app.xml")?.async("string") ?? Promise.resolve(null),
  ]);
  return { zip, documentXml, pageMetadataXml };
}

function textElements(run: Element) {
  return wordDescendants(run, "t");
}

function collectParagraphRecords(document: Document): ParagraphRecord[] {
  const body = Array.from(document.getElementsByTagNameNS(WORD_NS, "body"))[0];
  if (!body) throw new Error("DOCX 缺少文档正文。");
  const records: ParagraphRecord[] = [];

  function addParagraph(paragraph: Element, tablePath: number[]) {
    const paragraphIndex = records.length;
    const runs = wordDescendants(paragraph, "r");
    const runRanges: DocxBlockLocation["runRanges"] = [];
    const styles = new Set<string>();
    let text = "";
    runs.forEach((run, runIndex) => {
      const nodes = textElements(run);
      if (!nodes.length) return;
      const style = directWordChild(run, "rPr");
      styles.add(style ? new XMLSerializer().serializeToString(style) : "");
      const runText = nodes.map((node) => node.textContent ?? "").join("");
      runRanges.push({ runIndex, start: text.length, length: runText.length });
      text += runText;
    });
    const complexInline = ["hyperlink", "fldSimple", "fldChar", "instrText", "del", "ins", "tab", "br"].some((name) => wordDescendants(paragraph, name).length > 0);
    records.push({
      paragraph,
      paragraphIndex,
      tablePath,
      runs,
      text,
      runRanges,
      editable: !complexInline && styles.size <= 1 && runRanges.length > 0,
    });
  }

  function walkContainer(container: Element, tablePath: number[]) {
    let tableIndex = 0;
    for (const child of elements(container)) {
      if (isWordElement(child, "p")) addParagraph(child, tablePath);
      else if (isWordElement(child, "tbl")) {
        walkTable(child, [...tablePath, tableIndex]);
        tableIndex += 1;
      }
    }
  }

  function walkTable(table: Element, tablePath: number[]) {
    const rows = elements(table).filter((element) => isWordElement(element, "tr"));
    rows.forEach((row, rowIndex) => {
      const cells = elements(row).filter((element) => isWordElement(element, "tc"));
      cells.forEach((cell, cellIndex) => walkContainer(cell, [...tablePath, rowIndex, cellIndex]));
    });
  }

  walkContainer(body, []);
  return records;
}

function paragraphSection(paragraph: Element) {
  const properties = directWordChild(paragraph, "pPr");
  const style = properties && directWordChild(properties, "pStyle");
  const value = style?.getAttributeNS(WORD_NS, "val") ?? "";
  return value && /heading|title/iu.test(value) ? value : "简历内容";
}

function sourceBlocks(documentXml: string) {
  const document = parseXml(documentXml, "DOCX 正文").document;
  const records = collectParagraphRecords(document);
  return records.filter((record) => record.text.trim()).map((record): ResumeTextBlock => ({
    id: `docx-p${record.paragraphIndex}`,
    section: paragraphSection(record.paragraph),
    text: record.text,
    editable: record.editable,
    location: {
      part: "word/document.xml",
      paragraphIndex: record.paragraphIndex,
      tablePath: [...record.tablePath],
      runRanges: record.runRanges.map((range) => ({ ...range })),
    },
  }));
}

async function renderDocx(file: Blob, container: HTMLElement, styles: HTMLElement) {
  const { renderAsync } = await import("docx-preview");
  await renderAsync(file, container, styles, {
    className: PREVIEW_CLASS,
    breakPages: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    renderAltChunks: false,
  });
}

async function estimateRenderedPages(file: Blob) {
  if (typeof document === "undefined" || !document.body) throw new Error("此 DOCX 缺少页数元数据，需在浏览器本地估算页数。");
  const container = document.createElement("div");
  const styles = document.createElement("div");
  Object.assign(container.style, { position: "fixed", left: "-100000px", top: "0", width: "794px", visibility: "hidden" });
  container.setAttribute("aria-hidden", "true");
  document.body.append(container, styles);
  try {
    await renderDocx(file, container, styles);
    const pages = container.querySelectorAll(`.${PREVIEW_CLASS}-wrapper > section.${PREVIEW_CLASS}`).length
      || container.querySelectorAll(`section.${PREVIEW_CLASS}`).length;
    if (!pages) throw new Error("本地 DOCX 页数估算失败，请另存为 Word 文档后重试。");
    return pages;
  } finally {
    container.remove();
    styles.remove();
  }
}

async function estimateArchivePages(archive: DocxArchive, file: Blob): Promise<{ pages: number; estimated: true }> {
  const metadataPages = parseDocxPageCountMetadata(archive.pageMetadataXml);
  const pages = metadataPages ?? await estimateRenderedPages(file);
  validateResumePageCount("docx", pages, true);
  return { pages, estimated: true };
}

export async function estimateDocxPages(file: Blob & { name?: string }): Promise<{ pages: number; estimated: true }> {
  const archive = await loadDocxArchive(file);
  return estimateArchivePages(archive, file);
}

export async function parseDocxResume(file: File): Promise<ResumeSource> {
  const archive = await loadDocxArchive(file);
  const estimate = await estimateArchivePages(archive, file);
  const blocks = sourceBlocks(archive.documentXml);
  if (!blocks.length) throw new Error("DOCX 中没有可提取的简历文字。");
  return {
    format: "docx",
    fileName: file.name,
    file,
    pageCount: estimate.pages,
    pageCountEstimated: true,
    blocks,
    warnings: ["Word 页数为浏览器本地估算，实际 Word 分页可能不同。"],
  };
}

function updateTextNode(node: Element, text: string) {
  while (node.firstChild) node.removeChild(node.firstChild);
  node.appendChild(node.ownerDocument!.createTextNode(text));
  const space = text.startsWith(" ") || text.endsWith(" ");
  if (space) node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
}

export async function exportDocxResume(source: ResumeSource, edits: ResumeEdit[]): Promise<Blob> {
  if (source.format !== "docx") throw new Error("只能导出 DOCX 原稿。");
  if (!Array.isArray(edits)) throw new Error("改写列表无效。");
  const sourceById = new Map(source.blocks.map((block) => [block.id, block]));
  const seen = new Set<string>();
  for (const edit of edits) {
    if (!edit || typeof edit.blockId !== "string" || typeof edit.replacement !== "string") throw new Error("改写内容无效。");
    if (seen.has(edit.blockId)) throw new Error("改写列表包含重复块 ID。");
    seen.add(edit.blockId);
    const block = sourceById.get(edit.blockId);
    if (!block) throw new Error("改写列表包含未知块 ID。");
    if (!block.editable || !("part" in block.location) || block.location.part !== "word/document.xml") throw new Error("目标文字块不可编辑。");
    if (edit.replacement.length > MAX_RESUME_EDIT_LENGTH) throw new Error("改写内容不能超过 4,000 个字符。");
  }

  const archive = await loadDocxArchive(source.file);
  const parsed = parseXml(archive.documentXml, "DOCX 正文");
  const records = collectParagraphRecords(parsed.document);
  for (const edit of edits) {
    const block = sourceById.get(edit.blockId)!;
    const location = block.location as DocxBlockLocation;
    const record = records[location.paragraphIndex];
    if (!record || record.tablePath.join("/") !== location.tablePath.join("/")) throw new Error("DOCX 原稿结构已变化，无法安全定位改写文字。");
    if (!record.editable || record.runRanges.length !== location.runRanges.length) throw new Error("DOCX 文字样式或 runs 已变化，无法安全写回。");
    const mappedRuns = location.runRanges.map(({ runIndex }) => record.runs[runIndex]);
    if (mappedRuns.some((run) => !run)) throw new Error("DOCX 文字位置无法安全定位。");
    let isFirstText = true;
    for (const run of mappedRuns) {
      for (const textNode of textElements(run)) {
        updateTextNode(textNode, isFirstText ? edit.replacement : "");
        isFirstText = false;
      }
    }
    if (isFirstText) throw new Error("DOCX 目标段落没有可写回的文字 runs。");
  }

  const documentEntry = archive.zip.file("word/document.xml");
  if (!documentEntry) throw new Error("DOCX 正文文件缺失。");
  archive.zip.file("word/document.xml", parsed.serializer.serializeToString(parsed.document));
  return archive.zip.generateAsync({ type: "blob", mimeType: DOCX_MIME, compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function compareDocxLayout(before: DocxLayoutMetrics, after: DocxLayoutMetrics, editedBlockIds: string[]) {
  const warnings = new Map<string, string[]>();
  const addWarning = (blockId: string, reason: string) => warnings.set(blockId, [...(warnings.get(blockId) ?? []), reason]);
  if (after.pageCount > before.pageCount) {
    const targets = editedBlockIds.length ? editedBlockIds : ["document"];
    for (const blockId of targets) addWarning(blockId, `改写后文档从 ${before.pageCount} 页增加到 ${after.pageCount} 页。`);
  }
  for (const blockId of editedBlockIds) {
    const previousHeight = before.blockHeights[blockId];
    const nextHeight = after.blockHeights[blockId];
    if (previousHeight !== undefined && nextHeight !== undefined && nextHeight > previousHeight + 2) {
      addWarning(blockId, "该段落在本地预览中变高，可能发生换行或内容重排。");
    }
  }
  return [...warnings].map(([blockId, reasons]) => ({ blockId, reason: reasons.join(" ") }));
}

function layoutMetrics(container: HTMLElement, source: ResumeSource): DocxLayoutMetrics {
  const pages = container.querySelectorAll(`.${PREVIEW_CLASS}-wrapper > section.${PREVIEW_CLASS}`).length
    || container.querySelectorAll(`section.${PREVIEW_CLASS}`).length;
  const blocks = source.blocks.filter((block) => "part" in block.location && block.location.part === "word/document.xml");
  const paragraphs = Array.from(container.querySelectorAll("p"), (paragraph) => ({
    text: paragraph.textContent ?? "",
    height: paragraph.getBoundingClientRect().height,
  }));
  const blockHeights = mapDocxParagraphHeights(blocks, paragraphs);
  return { pageCount: pages, blockHeights };
}

export async function previewDocxResume(source: ResumeSource, edits: ResumeEdit[]): Promise<{ blob: Blob; pageCount: number; warnings: string[] }> {
  const blob = await exportDocxResume(source, edits);
  const outputSource = await parseDocxResume(new File([blob], source.fileName, { type: DOCX_MIME }));
  const beforeContainer = document.createElement("div");
  const beforeStyles = document.createElement("div");
  const afterContainer = document.createElement("div");
  const afterStyles = document.createElement("div");
  const hidden = { position: "fixed", left: "-100000px", top: "0", width: "794px", visibility: "hidden" };
  Object.assign(beforeContainer.style, hidden);
  Object.assign(afterContainer.style, hidden);
  document.body.append(beforeContainer, beforeStyles, afterContainer, afterStyles);
  try {
    await Promise.all([
      renderDocx(source.file, beforeContainer, beforeStyles),
      renderDocx(blob, afterContainer, afterStyles),
    ]);
    const before = layoutMetrics(beforeContainer, source);
    const after = layoutMetrics(afterContainer, outputSource);
    const editedBlockIds = edits.map((edit) => edit.blockId);
    const warnings = compareDocxLayout(before, after, editedBlockIds).map(({ blockId, reason }) => `${blockId}: ${reason}`);
    return { blob, pageCount: after.pageCount, warnings };
  } finally {
    beforeContainer.remove();
    beforeStyles.remove();
    afterContainer.remove();
    afterStyles.remove();
  }
}
