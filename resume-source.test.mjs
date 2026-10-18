import assert from "node:assert/strict";
import test from "node:test";
import { validateResumeFile, validateResumePageCount } from "../app/lib/resume-source.ts";

const pdfSignature = new TextEncoder().encode("%PDF-1.7");
const docxSignature = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

test("accepts PDF and DOCX only when extension, MIME, and file signature agree", () => {
  assert.deepEqual(validateResumeFile({ name: "resume.PDF", type: "application/pdf", size: 1 }, pdfSignature), { format: "pdf" });
  assert.deepEqual(validateResumeFile({ name: "resume.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1 }, docxSignature), { format: "docx" });
});

test("rejects unsupported formats, legacy DOC, spoofed extensions, and mismatched MIME", () => {
  for (const [meta, signature] of [
    [{ name: "resume.doc", type: "application/msword", size: 1 }, docxSignature],
    [{ name: "resume.pdf", type: "application/pdf", size: 1 }, docxSignature],
    [{ name: "resume.docx", type: "application/pdf", size: 1 }, docxSignature],
    [{ name: "resume.pdf", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1 }, pdfSignature],
    [{ name: "resume.txt", type: "text/plain", size: 1 }, pdfSignature],
  ]) assert.throws(() => validateResumeFile(meta, signature));
});

test("accepts an empty browser MIME type only when extension and signature match", () => {
  assert.deepEqual(validateResumeFile({ name: "resume.pdf", type: "", size: 1 }, pdfSignature), { format: "pdf" });
  assert.deepEqual(validateResumeFile({ name: "resume.docx", type: "", size: 1 }, docxSignature), { format: "docx" });
  assert.throws(() => validateResumeFile({ name: "resume.pdf", type: "", size: 1 }, docxSignature));
});

test("allows exactly 10 MiB and rejects larger source files", () => {
  const max = 10 * 1024 * 1024;
  assert.deepEqual(validateResumeFile({ name: "resume.pdf", type: "application/pdf", size: max }, pdfSignature), { format: "pdf" });
  assert.throws(() => validateResumeFile({ name: "resume.pdf", type: "application/pdf", size: max + 1 }, pdfSignature));
});

test("enforces ten-page limits and preserves whether DOCX pagination is estimated", () => {
  assert.deepEqual(validateResumePageCount("pdf", 10, false), { pageCount: 10, pageCountEstimated: false });
  assert.deepEqual(validateResumePageCount("docx", 10, true), { pageCount: 10, pageCountEstimated: true });
  assert.throws(() => validateResumePageCount("pdf", 11, false));
  assert.throws(() => validateResumePageCount("docx", 11, true));
});
