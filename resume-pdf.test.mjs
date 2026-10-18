import assert from "node:assert/strict";
import test from "node:test";
import {
  estimatePdfBackgroundColor,
  groupPdfTextItems,
  mapPdfTextItem,
  parsePdfResume,
  planPdfEdits,
} from "../app/lib/resume-pdf.ts";
import { createResumePdf } from "./fixtures/resume-pdf-fixture.mjs";

const viewport = {
  height: 200,
  convertToViewportPoint: (x, y) => [x, 200 - y],
};

function item(str, x, y, width, { angle = 0, fontName = "sans" } = {}) {
  const radians = angle * Math.PI / 180;
  const size = 10;
  return {
    str,
    width,
    height: size,
    fontName,
    hasEOL: false,
    transform: [size * Math.cos(radians), size * Math.sin(radians), -size * Math.sin(radians), size * Math.cos(radians), x, y],
  };
}

test("maps transformed PDF text into one-based page viewport coordinates", () => {
  const mapped = mapPdfTextItem(item("Name", 20, 120, 40), 2, viewport, 0);
  assert.equal(mapped.location.page, 2);
  assert.deepEqual(mapped.location.box, { x: 20, y: 70, width: 40, height: 10 });
  assert.equal(mapped.location.direction, 0);
  assert.equal(mapped.location.fontSize, 10);
});

test("groups adjacent same-line text but keeps columns and rotated text separate", () => {
  const blocks = groupPdfTextItems([
    item("左栏", 20, 120, 24),
    item("项目", 46, 120, 24),
    item("右栏", 150, 120, 24),
    item("竖排", 20, 120, 20, { angle: 90 }),
  ], 1, viewport);

  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks.map((block) => block.text), ["左栏项目", "右栏", "竖排"]);
  assert.deepEqual(blocks[0].location.itemIndexes, [0, 1]);
  assert.equal(blocks[2].location.direction, 270);
  assert.equal(blocks[0].editable, true);
  assert.equal(blocks[2].editable, false);
});

test("estimates the local background color from nearby rendered pixels", () => {
  assert.equal(estimatePdfBackgroundColor([[248, 246, 239], [248, 246, 239], [247, 245, 238], [20, 20, 20]]), "#f8f6ef");
});

test("parses text locally and rejects blank or visual-only pages, encrypted files, and excess pages", async () => {
  const parsed = await parsePdfResume(createResumePdf());
  assert.equal(parsed.format, "pdf");
  assert.equal(parsed.pageCount, 1);
  assert.ok(parsed.blocks.some((block) => block.text.includes("project work")));
  assert.ok(parsed.blocks.every((block) => block.location.page === 1));

  await assert.rejects(() => parsePdfResume(createResumePdf({ text: false })), /可提取文字|扫描/);
  await assert.rejects(() => parsePdfResume(createResumePdf({ encrypted: true })), /密码|加密/);
  await assert.rejects(() => parsePdfResume(createResumePdf({ pageCount: 11 })), /10 页/);
});

test("maps only unique editable block IDs and reports width overflow without shrinking text", () => {
  const source = {
    format: "pdf",
    fileName: "synthetic.pdf",
    file: new File(["%PDF-1.7"], "synthetic.pdf", { type: "application/pdf" }),
    pageCount: 1,
    pageCountEstimated: false,
    warnings: [],
    blocks: [
      { id: "p1-i0", section: "经历", text: "原文", editable: true, location: { page: 1, itemIndexes: [0], box: { x: 10, y: 10, width: 30, height: 10 }, direction: 0, fontSize: 10, color: "#232a30" } },
      { id: "p1-i1", section: "经历", text: "不可改", editable: false, location: { page: 1, itemIndexes: [1], box: { x: 10, y: 30, width: 30, height: 10 }, direction: 0, fontSize: 10, color: "#232a30" } },
    ],
  };

  const plan = planPdfEdits(source, [{ blockId: "p1-i0", replacement: "这是非常长的改写", reason: "更清晰" }], (text) => text.length * 5);
  assert.deepEqual(plan.overflows.map(({ blockId }) => blockId), ["p1-i0"]);
  assert.equal(plan.edits.length, 0);
  assert.throws(() => planPdfEdits(source, [{ blockId: "missing", replacement: "x", reason: "" }], () => 1), /未知/);
  assert.throws(() => planPdfEdits(source, [
    { blockId: "p1-i0", replacement: "a", reason: "" },
    { blockId: "p1-i0", replacement: "b", reason: "" },
  ], () => 1), /重复/);
  assert.throws(() => planPdfEdits(source, [{ blockId: "p1-i1", replacement: "x", reason: "" }], () => 1), /不可编辑/);
  assert.throws(() => planPdfEdits(source, [{ blockId: "p1-i0", replacement: "x".repeat(4_001), reason: "" }], () => 1), /4,000/);
});
