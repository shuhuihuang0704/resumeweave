import assert from "node:assert/strict";
import test from "node:test";
import { getPdfHighlightMarkers, getPdfHighlightPosition } from "../app/lib/resume-pdf-highlights.ts";

test("maps only editable PDF suggestion blocks to numbered original-page markers", () => {
  const source = {
    format: "pdf",
    blocks: [
      {
        id: "pdf-p2-b4",
        section: "项目经历",
        text: "访谈 12 位用户。",
        editable: true,
        location: { page: 2, itemIndexes: [4], box: { x: 20, y: 70, width: 90, height: 12 }, direction: 0, fontSize: 10, color: "#232a30" },
      },
      {
        id: "pdf-p1-b1",
        section: "联系方式",
        text: "email@example.test",
        editable: false,
        location: { page: 1, itemIndexes: [1], box: { x: 12, y: 30, width: 80, height: 10 }, direction: 0, fontSize: 10, color: "#232a30" },
      },
      {
        id: "pdf-p1-b8",
        section: "工作经历",
        text: "整理客户数据。",
        editable: true,
        location: { page: 1, itemIndexes: [8], box: { x: 14, y: 110, width: 72, height: 11 }, direction: 0, fontSize: 10, color: "#232a30" },
      },
    ],
  };
  const edits = [
    { blockId: "pdf-p1-b8", replacement: "按客户需求整理数据。", reason: "补充岗位相关性。" },
    { blockId: "pdf-p2-b4", replacement: "访谈 12 位用户并归纳需求。", reason: "突出研究结果。" },
    { blockId: "missing", replacement: "不应显示", reason: "未知块。" },
    { blockId: "pdf-p1-b1", replacement: "不应标记", reason: "不可编辑块。" },
  ];

  assert.deepEqual(getPdfHighlightMarkers(source, edits), [
    {
      blockId: "pdf-p1-b8",
      number: 1,
      page: 1,
      section: "工作经历",
      text: "整理客户数据。",
      box: { x: 14, y: 110, width: 72, height: 11 },
    },
    {
      blockId: "pdf-p2-b4",
      number: 2,
      page: 2,
      section: "项目经历",
      text: "访谈 12 位用户。",
      box: { x: 20, y: 70, width: 90, height: 12 },
    },
  ]);
});

test("returns no PDF markers for a DOCX source", () => {
  assert.deepEqual(getPdfHighlightMarkers({ format: "docx", blocks: [] }, [
    { blockId: "docx-p0", replacement: "新内容", reason: "建议" },
  ]), []);
});

test("keeps highlight boxes aligned when a PDF page is resized", () => {
  assert.deepEqual(getPdfHighlightPosition(
    { x: 20, y: 30, width: 40, height: 10 },
    { width: 200, height: 100 },
  ), { left: "10%", top: "30%", width: "20%", height: "10%" });
});
