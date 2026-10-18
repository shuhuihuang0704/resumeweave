import assert from "node:assert/strict";
import test from "node:test";
import { paginateBusinessResume } from "../app/lib/business-pagination.ts";

test("business pagination retains every section and adds pages for long experience", () => {
  const experience = Array.from({ length: 14 }, (_, index) => ({
    title: `Project ${index + 1}`,
    meta: "2022—2026",
    bullets: ["用户调研和跨团队方案推进。".repeat(28), "完成上线复盘并记录结果。".repeat(24)],
  }));
  const data = {
    education: ["某某大学｜产品设计｜本科"],
    experience,
    skills: [{ name: "用户研究", detail: "访谈、问卷和需求分析" }],
    honors: ["校级一等奖"],
    selfEvaluation: "善于倾听并推进跨团队合作。",
    hasQr: true,
  };

  const pages = paginateBusinessResume(data);
  assert.ok(pages.length > 2);
  assert.deepEqual(pages.flatMap((page) => page.experience), experience);
  assert.deepEqual(pages.flatMap((page) => page.education), data.education);
  assert.deepEqual(pages.flatMap((page) => page.skills), data.skills);
  assert.deepEqual(pages.flatMap((page) => page.honors), data.honors);
  assert.equal(pages.map((page) => page.selfEvaluation).filter(Boolean).join(""), data.selfEvaluation);
  assert.equal(pages.filter((page) => page.hasQr).length, 1);
});

test("business pagination keeps a clean two-page minimum for short resumes", () => {
  const pages = paginateBusinessResume({
    education: ["大学｜专业｜本科"], experience: [], skills: [], honors: [], selfEvaluation: "", hasQr: false,
  });
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.flatMap((page) => page.education), ["大学｜专业｜本科"]);
});
