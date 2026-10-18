import type { TailorInput, TailorResult } from "./resume-tailor.ts";
import { MAX_RESUME_EDIT_LENGTH } from "./resume-source.ts";
import type { ResumeEdit, ResumeSource } from "./resume-source.ts";

export type ResumeWorkflowStatus = "idle" | "parsing" | "ready" | "requesting" | "reviewing" | "exporting" | "exported";
export type ResumeEditDecision = "pending" | "accepted" | "rejected" | "manual";

export type ResumeWorkflowState = {
  source: ResumeSource | null;
  target: string;
  company: string;
  jobDescription: string;
  consent: boolean;
  status: ResumeWorkflowStatus;
  error: string | null;
  result: TailorResult | null;
  reviews: Record<string, { decision: ResumeEditDecision; manualDraft: string; replacement?: string }>;
  output: { blob: Blob; warnings: string[] } | null;
};

export type ResumeWorkflowAction =
  | { type: "source-parsing" }
  | { type: "source-ready"; source: ResumeSource }
  | { type: "source-failed"; error: string }
  | { type: "set-target"; value: string }
  | { type: "set-company"; value: string }
  | { type: "set-job-description"; value: string }
  | { type: "set-consent"; value: boolean }
  | { type: "request-started" }
  | { type: "candidate-received"; result: TailorResult }
  | { type: "request-failed"; error: string }
  | { type: "request-cancelled" }
  | { type: "edit-draft"; blockId: string; value: string }
  | { type: "edit-decision"; blockId: string; decision: "accept" | "reject" | "manual"; replacement?: string }
  | { type: "export-started" }
  | { type: "export-ready"; blob: Blob; warnings: string[] }
  | { type: "export-failed"; error: string }
  | { type: "reset" };

export function createInitialResumeWorkflowState(): ResumeWorkflowState {
  return {
    source: null,
    target: "",
    company: "",
    jobDescription: "",
    consent: false,
    status: "idle",
    error: null,
    result: null,
    reviews: {},
    output: null,
  };
}

function candidateReviews(result: TailorResult, source: ResumeSource) {
  const editableIds = new Set(source.blocks.filter((block) => block.editable).map((block) => block.id));
  const seen = new Set<string>();
  const reviews: ResumeWorkflowState["reviews"] = {};
  for (const edit of result.edits) {
    if (!editableIds.has(edit.blockId) || seen.has(edit.blockId)) return null;
    seen.add(edit.blockId);
    reviews[edit.blockId] = { decision: "pending", manualDraft: edit.replacement };
  }
  return reviews;
}

function updateJobContext(state: ResumeWorkflowState, update: Partial<Pick<ResumeWorkflowState, "target" | "company" | "jobDescription">>): ResumeWorkflowState {
  return {
    ...state,
    ...update,
    status: state.status === "parsing" ? "parsing" : state.source ? "ready" : "idle",
    error: null,
    result: null,
    reviews: {},
    output: null,
  };
}

export function resumeWorkflowReducer(state: ResumeWorkflowState, action: ResumeWorkflowAction): ResumeWorkflowState {
  switch (action.type) {
    case "source-parsing":
      return { ...state, consent: false, status: "parsing", error: null, result: null, reviews: {}, output: null };
    case "source-ready":
      return { ...state, source: action.source, consent: false, status: "ready", error: null, result: null, reviews: {}, output: null };
    case "source-failed":
      return { ...state, status: state.source ? "ready" : "idle", error: action.error, result: null, reviews: {}, output: null };
    case "set-target":
      return updateJobContext(state, { target: action.value });
    case "set-company":
      return updateJobContext(state, { company: action.value });
    case "set-job-description":
      return updateJobContext(state, { jobDescription: action.value });
    case "set-consent":
      return { ...state, consent: action.value };
    case "request-started":
      if (!state.source || !state.consent) return state;
      return { ...state, status: "requesting", error: null, output: null };
    case "candidate-received": {
      if (!state.source) return { ...state, error: "请先上传并解析简历。" };
      const reviews = candidateReviews(action.result, state.source);
      if (!reviews) return { ...state, status: "ready", error: "AI 返回了无法识别的文字块，请重新尝试。", result: null, reviews: {} };
      return { ...state, status: "reviewing", error: null, result: action.result, reviews, output: null };
    }
    case "request-failed":
      return { ...state, status: state.source ? (state.result ? "reviewing" : "ready") : "idle", error: action.error, output: null };
    case "request-cancelled":
      return { ...state, status: state.source ? (state.result ? "reviewing" : "ready") : "idle", error: null };
    case "edit-draft": {
      const review = state.reviews[action.blockId];
      if (!review) return state;
      if (action.value.length > MAX_RESUME_EDIT_LENGTH) return { ...state, error: "手动改写不能超过 4,000 个字符。" };
      return { ...state, reviews: { ...state.reviews, [action.blockId]: { ...review, manualDraft: action.value } }, output: null };
    }
    case "edit-decision": {
      const review = state.reviews[action.blockId];
      if (!review) return state;
      if (action.decision === "manual" && !action.replacement?.trim()) {
        return { ...state, error: "手动改写不能为空。" };
      }
      if (action.decision === "manual" && action.replacement!.length > MAX_RESUME_EDIT_LENGTH) {
        return { ...state, error: "手动改写不能超过 4,000 个字符。" };
      }
      const decision: ResumeEditDecision = action.decision === "accept" ? "accepted" : action.decision === "reject" ? "rejected" : "manual";
      return {
        ...state,
        status: "reviewing",
        error: null,
        reviews: {
          ...state.reviews,
          [action.blockId]: {
            ...review,
            decision,
            ...(decision === "manual" ? { replacement: action.replacement } : {}),
          },
        },
        output: null,
      };
    }
    case "export-started":
      if (!state.source) return state;
      return { ...state, status: "exporting", error: null, output: null };
    case "export-ready":
      if (!state.source || !state.result || state.status !== "exporting") return state;
      return { ...state, status: action.warnings.length ? "reviewing" : "exported", error: null, output: { blob: action.blob, warnings: action.warnings } };
    case "export-failed":
      return { ...state, status: state.source ? (state.result ? "reviewing" : "ready") : "idle", error: action.error, output: null };
    case "reset":
      return createInitialResumeWorkflowState();
  }
}

export function buildTailorRequest(state: ResumeWorkflowState): TailorInput {
  if (!state.source) throw new Error("请先上传并解析简历。");
  if (!state.consent) throw new Error("请先阅读并勾选授权，再发送简历文字。");
  const target = state.target.trim();
  const jobDescription = state.jobDescription.trim();
  const company = state.company.trim();
  if (target.length < 2 || target.length > 160) throw new Error("目标岗位需填写 2–160 个字符。");
  if (jobDescription.length < 10 || jobDescription.length > 20_000) throw new Error("招聘要求需填写 10–20,000 个字符。");
  if (company.length > 160) throw new Error("企业信息不能超过 160 个字符。");

  const blocks = state.source.blocks.filter((block) => block.editable).map(({ id, section, text }) => ({ id, section, text }));
  if (blocks.length < 1 || blocks.length > 300) throw new Error("当前可改写文字块数量需为 1–300 块。");
  let totalTextLength = 0;
  for (const block of blocks) {
    if (!block.id.trim() || block.id.length > 160 || !block.section.trim() || block.section.length > 100) throw new Error("简历文字块位置或类别无效。");
    if (!block.text.trim() || block.text.length > MAX_RESUME_EDIT_LENGTH) throw new Error("简历文字块不能为空且不能超过 4,000 个字符。");
    totalTextLength += block.text.length;
    if (totalTextLength > 20_000) throw new Error("简历文字总长度超过 20,000 字。");
  }
  return { target, ...(company ? { company } : {}), jobDescription, blocks };
}

export function getAcceptedResumeEdits(state: ResumeWorkflowState): ResumeEdit[] {
  if (!state.source || !state.result) return [];
  const editableIds = new Set(state.source.blocks.filter((block) => block.editable).map((block) => block.id));
  return state.result.edits.flatMap((edit) => {
    if (!editableIds.has(edit.blockId)) return [];
    const review = state.reviews[edit.blockId];
    if (review?.decision === "accepted") return [edit];
    if (review?.decision === "manual" && review.replacement?.trim()) return [{ ...edit, replacement: review.replacement }];
    return [];
  });
}
