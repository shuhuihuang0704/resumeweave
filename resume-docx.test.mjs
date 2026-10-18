import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
  compareDocxLayout,
  estimateDocxPages,
  exportDocxResume,
  mapDocxParagraphHeights,
  parseDocxPageCountMetadata,
  parseDocxResume,
} from "../app/lib/resume-docx.ts";
import { createDocxFile } from "./fixtures/resume-docx-fixture.mjs";

globalThis.DOMParser ??= DOMParser;
globalThis.XMLSerializer ??= XMLSerializer;

test("extracts body paragraphs, same-style split runs, table cells, and stable local locations", async () => {
  const source = await parseDocxResume(await createDocxFile());
  const product = source.blocks.find((block) => block.text === "Product lead");
  const cell = source.blocks.find((block) => block.text === "Cell experience");

  assert.equal(source.format, "docx");
  assert.equal(source.pageCount, 2);
  assert.equal(source.pageCountEstimated, true);
  assert.equal(product.editable, true);
  assert.deepEqual(product.location.runRanges, [
    { runIndex: 0, start: 0, length: 7 },
    { runIndex: 1, start: 7, length: 5 },
  ]);
  assert.deepEqual(cell.location.tablePath, [0, 0, 0]);
  assert.ok(source.blocks.find((block) => block.text === "Bright designer").editable === false);
  assert.ok(source.blocks.find((block) => block.text === "Portfolio").editable === false);
});

test("uses valid page metadata as an estimate and rejects invalid metadata values", async () => {
  assert.equal(parseDocxPageCountMetadata(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Pages>4</Pages></Properties>`), 4);
  for (const value of ["0", "-1", "2.5", "many", ""]) {
    assert.equal(parseDocxPageCountMetadata(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Pages>${value}</Pages></Properties>`), null);
  }
  assert.deepEqual(await estimateDocxPages(await createDocxFile({ pages: 3 })), { pages: 3, estimated: true });
  await assert.rejects(async () => parseDocxResume(await createDocxFile({ pageMetadata: 11 })), /10 页/);
});

test("rejects legacy/encrypted containers, non-ZIP data, oversized archives, and excessive entries", async () => {
  const encryptedOffice = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], "locked.docx", { type: "" });
  const corruptZip = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01])], "corrupt.docx", { type: "" });
  await assert.rejects(() => parseDocxResume(encryptedOffice), /文件内容|DOCX|格式/);
  await assert.rejects(() => parseDocxResume(corruptZip), /DOCX|ZIP|文件|解析/);
  await assert.rejects(async () => parseDocxResume(await createDocxFile({ expandedBytes: 50 * 1024 * 1024 + 1 })), /50 MiB|展开|解压/);
  await assert.rejects(async () => parseDocxResume(await createDocxFile({ entryCount: 2_001 })), /2,000|2000|条目/);
});

test("ignores external relationships and never fetches external resources while parsing", async () => {
  let requests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { requests += 1; throw new Error("external fetch must not occur"); };
  try {
    const source = await parseDocxResume(await createDocxFile());
    assert.equal(requests, 0);
    assert.ok(!source.blocks.some((block) => block.text.includes("outside.invalid")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("replaces only accepted text nodes while preserving styles, image relationships, and other package parts", async () => {
  const file = await createDocxFile();
  const source = await parseDocxResume(file);
  const target = source.blocks.find((block) => block.text === "Product lead");
  const originalZip = await JSZip.loadAsync(await file.arrayBuffer());
  const output = await exportDocxResume(source, [{ blockId: target.id, replacement: "Product owner", reason: "Aligns with the JD" }]);
  const outputZip = await JSZip.loadAsync(await output.arrayBuffer());
  const originalDocument = new DOMParser().parseFromString(await originalZip.file("word/document.xml").async("string"), "application/xml");
  const xml = await outputZip.file("word/document.xml").async("string");
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const texts = Array.from(parsed.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t"));
  const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const originalParagraph = originalDocument.getElementsByTagNameNS(wordNamespace, "p")[0];
  const updatedParagraph = parsed.getElementsByTagNameNS(wordNamespace, "p")[0];

  assert.equal(texts[0].textContent, "Product owner");
  assert.equal(texts[1].textContent, "");
  assert.equal(updatedParagraph.getElementsByTagNameNS(wordNamespace, "rPr").length, originalParagraph.getElementsByTagNameNS(wordNamespace, "rPr").length);
  assert.equal(await outputZip.file("word/_rels/document.xml.rels").async("string"), await originalZip.file("word/_rels/document.xml.rels").async("string"));
  assert.deepEqual(
    [...await outputZip.file("word/media/pixel.png").async("uint8array")],
    [...await originalZip.file("word/media/pixel.png").async("uint8array")],
  );
  assert.equal(await outputZip.file("[Content_Types].xml").async("string"), await originalZip.file("[Content_Types].xml").async("string"));
  assert.equal(source.blocks.find((block) => block.id === target.id).text, "Product lead");
  await assert.rejects(() => exportDocxResume(source, [{ blockId: "unknown", replacement: "x", reason: "" }]), /未知/);
  await assert.rejects(() => exportDocxResume(source, [
    { blockId: target.id, replacement: "x", reason: "" },
    { blockId: target.id, replacement: "y", reason: "" },
  ]), /重复/);
});

test("reports added pages and growth in edited paragraphs", () => {
  const warnings = compareDocxLayout(
    { pageCount: 2, blockHeights: { p0: 20, p1: 24 } },
    { pageCount: 3, blockHeights: { p0: 20, p1: 34 } },
    ["p0", "p1"],
  );
  assert.deepEqual(warnings.map(({ blockId }) => blockId), ["p0", "p1"]);
  assert.deepEqual(compareDocxLayout(
    { pageCount: 2, blockHeights: { p0: 20 } },
    { pageCount: 2, blockHeights: { p0: 20 } },
    ["p0"],
  ), []);
});

test("maps DOCX preview paragraph heights by unique text, not global paragraph position", () => {
  const blocks = [
    { id: "p0", text: "Body paragraph" },
    { id: "p1", text: "Repeated text" },
    { id: "p2", text: "Repeated text" },
  ];
  const heights = mapDocxParagraphHeights(blocks, [
    { text: "Header paragraph", height: 9 },
    { text: "Body paragraph", height: 21 },
    { text: "Repeated text", height: 30 },
    { text: "Repeated text", height: 31 },
  ]);

  assert.deepEqual(heights, { p0: 21 });
});

test("rejects a manual DOCX replacement above the bounded edit length", async () => {
  const source = await parseDocxResume(await createDocxFile());
  const target = source.blocks.find((block) => block.text === "Product lead");
  await assert.rejects(
    () => exportDocxResume(source, [{ blockId: target.id, replacement: "x".repeat(4_001), reason: "manual" }]),
    /4,000/,
  );
});
