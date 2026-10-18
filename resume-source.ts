export type ResumeSourceFormat = "pdf" | "docx";

export type PdfBlockLocation = {
  page: number;
  itemIndexes: number[];
  box: { x: number; y: number; width: number; height: number };
  direction: number;
  fontSize: number;
  color: string;
};

export type DocxBlockLocation = {
  part: "word/document.xml";
  paragraphIndex: number;
  tablePath: number[];
  runRanges: Array<{ runIndex: number; start: number; length: number }>;
};

export type ResumeTextBlock = {
  id: string;
  section: string;
  text: string;
  editable: boolean;
  location: PdfBlockLocation | DocxBlockLocation;
};

export type ResumeSource = {
  format: ResumeSourceFormat;
  fileName: string;
  file: File;
  pageCount: number;
  pageCountEstimated: boolean;
  blocks: ResumeTextBlock[];
  warnings: string[];
};

export type ResumeEdit = {
  blockId: string;
  replacement: string;
  reason: string;
};

export const MAX_RESUME_EDIT_LENGTH = 4_000;

export type ValidatedResumeFile = { format: ResumeSourceFormat };
export type ValidatedResumePageCount = { pageCount: number; pageCountEstimated: boolean };

type ResumeFileMeta = { name: string; type: string; size: number };

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function signatureMatches(signature: Uint8Array, expected: readonly number[]) {
  return expected.every((byte, index) => signature[index] === byte);
}

export function validateResumeFile(meta: ResumeFileMeta, signature: Uint8Array): ValidatedResumeFile {
  if (!Number.isFinite(meta.size) || meta.size <= 0) throw new Error("文件大小无效。");
  if (meta.size > MAX_RESUME_BYTES) throw new Error("简历文件不能超过 10 MB。");

  const extension = meta.name.toLowerCase().split(".").at(-1);
  const format: ResumeSourceFormat | null = extension === "pdf" ? "pdf" : extension === "docx" ? "docx" : null;
  if (!format) throw new Error("仅支持 PDF 和 .docx；旧版 .doc 暂不支持。");

  const expectedMime = format === "pdf" ? PDF_MIME : DOCX_MIME;
  const expectedSignature = format === "pdf" ? [0x25, 0x50, 0x44, 0x46, 0x2d] : [0x50, 0x4b, 0x03, 0x04];
  if (!signatureMatches(signature, expectedSignature)) throw new Error("文件内容与扩展名不匹配，请选择原始 PDF 或 DOCX 文件。");
  if (meta.type.trim() && meta.type.trim().toLowerCase() !== expectedMime) throw new Error("文件类型与扩展名不匹配。");

  return { format };
}

export function validateResumePageCount(
  format: ResumeSourceFormat,
  pageCount: number,
  estimated: boolean,
): ValidatedResumePageCount {
  if ((format !== "pdf" && format !== "docx") || !Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("无法确认简历页数，请检查文件是否完整。");
  }
  if (pageCount > 10) {
    const basis = format === "docx" || estimated ? "估算页数" : "页数";
    throw new Error(`简历${basis}超过 10 页，暂不支持处理。`);
  }
  return { pageCount, pageCountEstimated: estimated };
}
