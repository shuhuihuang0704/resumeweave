import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTailorRequest,
  createInitialResumeWorkflowState,
  getAcceptedResumeEdits,
  resumeWorkflowReducer,
} from "../app/lib/resume-workflow.ts";

const source = {
  format: "pdf",
  fileName: "secret-resume.pdf",
  file: new File(["%PDF-private-binary"], "secret-resume.pdf", { type: "application/pdf" }),
  pageCount: 1,
  pageCountEstimated: false,
  warnings: [],
  blocks: [
    { id: "pdf-p1-b0", section: "项目经历", text: "访谈 12 位用户。", editable: true, location: { page: 1, itemIndexes: [0], box: { x: 11, y: 12, width: 40, height: 10 }, direction: 0, fontSize: 10, color: "#232a30" } },
    { id: "pdf-p1-b1", section: "联系方式", text: "email@example.test", editable: false, location: { page: 1, itemIndexes: [1], box: { x: 11, y: 30, width: 40, height: 10 }, direction: 0, fontSize: 10, color: "#232a30" } },
  ],
};

const candidate = {
  edits: [
    { blockId: "pdf-p1-b0", replacement: "访谈 12 位用户并完成需求归纳。", reason: "强调用户研究。" },
  ],
  matchedRequirements: ["用户研究"],
  missingRequirements: ["待补充具体项目结果"],
};

function readyState() {
  let state = createInitialResumeWorkflowState();
  state = resumeWorkflowReducer(state, { type: "source-ready", source });
  return resumeWorkflowReducer(state, { type: "set-job-description", value: "负责产品规划和用户研究工作。" });
}

test("starts with consent unchecked and prevents building a request without consent", () => {
  const initial = createInitialResumeWorkflowState();
  assert.equal(initial.consent, false);
  assert.throws(() => buildTailorRequest(initial), /简历|同意|授权/);
  const state = readyState();
  assert.throws(() => buildTailorRequest(state), /同意|授权/);
});

test("builds a text-only request from editable blocks and excludes file and geometry", () => {
  let state = readyState();
  state = resumeWorkflowReducer(state, { type: "set-target", value: "产品经理" });
  state = resumeWorkflowReducer(state, { type: "set-company", value: "示例科技" });
  state = resumeWorkflowReducer(state, { type: "set-consent", value: true });
  const request = buildTailorRequest(state);

  assert.deepEqual(request, {
    target: "产品经理",
    company: "示例科技",
    jobDescription: "负责产品规划和用户研究工作。",
    blocks: [{ id: "pdf-p1-b0", section: "项目经历", text: "访谈 12 位用户。" }],
  });
  assert.doesNotMatch(JSON.stringify(request), /secret-resume|private-binary|location|geometry|itemIndexes|fontSize/);
  assert.throws(() => buildTailorRequest({ ...state, consent: false }), /同意|授权/);
});

test("stores returned suggestions as pending without changing the source text", () => {
  const state = resumeWorkflowReducer(readyState(), { type: "candidate-received", result: candidate });
  assert.equal(state.source.blocks[0].text, "访谈 12 位用户。");
  assert.equal(state.reviews["pdf-p1-b0"].decision, "pending");
  assert.deepEqual(getAcceptedResumeEdits(state), []);
  assert.deepEqual(state.result.matchedRequirements, ["用户研究"]);
});

test("accepts, rejects, or manually edits each candidate without changing other source blocks", () => {
  let state = resumeWorkflowReducer(readyState(), { type: "candidate-received", result: candidate });
  state = resumeWorkflowReducer(state, { type: "edit-decision", blockId: "pdf-p1-b0", decision: "reject" });
  assert.deepEqual(getAcceptedResumeEdits(state), []);
  state = resumeWorkflowReducer(state, { type: "edit-decision", blockId: "pdf-p1-b0", decision: "accept" });
  assert.deepEqual(getAcceptedResumeEdits(state), [candidate.edits[0]]);

  state = resumeWorkflowReducer(state, { type: "edit-decision", blockId: "pdf-p1-b0", decision: "manual", replacement: "手动确认的真实改写" });
  assert.equal(getAcceptedResumeEdits(state)[0].replacement, "手动确认的真实改写");
  assert.equal(state.source.blocks[1].text, "email@example.test");
});

test("changing any job context invalidates old suggestions and accepted edits", () => {
  const contextChanges = [
    { type: "set-target", value: "用户研究员" },
    { type: "set-company", value: "另一家公司" },
    { type: "set-job-description", value: "负责全新的岗位职责和任职要求。" },
  ];

  for (const action of contextChanges) {
    let state = resumeWorkflowReducer(readyState(), { type: "candidate-received", result: candidate });
    state = resumeWorkflowReducer(state, { type: "edit-decision", blockId: "pdf-p1-b0", decision: "accept" });
    state = resumeWorkflowReducer(state, { type: "export-ready", blob: new Blob(["old output"]), warnings: [] });
    state = resumeWorkflowReducer(state, action);

    assert.equal(state.result, null);
    assert.deepEqual(state.reviews, {});
    assert.equal(state.output, null);
    assert.deepEqual(getAcceptedResumeEdits(state), []);
    assert.equal(state.status, "ready");
    state = resumeWorkflowReducer(state, { type: "export-ready", blob: new Blob(["stale output"]), warnings: [] });
    assert.equal(state.output, null);
  }
});

test("rejects manual drafts and replacements longer than 4,000 characters", () => {
  let state = resumeWorkflowReducer(readyState(), { type: "candidate-received", result: candidate });
  const originalDraft = state.reviews["pdf-p1-b0"].manualDraft;
  state = resumeWorkflowReducer(state, { type: "edit-draft", blockId: "pdf-p1-b0", value: "x".repeat(4_001) });
  assert.equal(state.reviews["pdf-p1-b0"].manualDraft, originalDraft);
  assert.match(state.error ?? "", /4,000/);

  state = resumeWorkflowReducer(state, { type: "edit-decision", blockId: "pdf-p1-b0", decision: "manual", replacement: "x".repeat(4_001) });
  assert.notEqual(state.reviews["pdf-p1-b0"].decision, "manual");
  assert.match(state.error ?? "", /4,000/);
});

test("reset clears source, candidate, review, and consent from memory", () => {
  let state = resumeWorkflowReducer(readyState(), { type: "set-consent", value: true });
  state = resumeWorkflowReducer(state, { type: "candidate-received", result: candidate });
  state = resumeWorkflowReducer(state, { type: "reset" });
  assert.equal(state.source, null);
  assert.equal(state.result, null);
  assert.deepEqual(state.reviews, {});
  assert.equal(state.consent, false);
});

test("request failure preserves the original source and does not apply candidates", () => {
  let state = resumeWorkflowReducer(readyState(), { type: "candidate-received", result: candidate });
  state = resumeWorkflowReducer(state, { type: "request-failed", error: "服务暂时不可用" });
  assert.equal(state.source, source);
  assert.equal(state.source.blocks[0].text, "访谈 12 位用户。");
  assert.deepEqual(getAcceptedResumeEdits(state), []);
  assert.equal(state.error, "服务暂时不可用");
});
