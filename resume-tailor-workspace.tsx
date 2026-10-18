"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { exportFlatPdfResume, parsePdfResume } from "../lib/resume-pdf";
import { parseDocxResume, previewDocxResume } from "../lib/resume-docx";
import { getPdfHighlightMarkers } from "../lib/resume-pdf-highlights";
import { ResumePdfHighlightPreview } from "./resume-pdf-highlight-preview";
import {
  buildTailorRequest,
  createInitialResumeWorkflowState,
  getAcceptedResumeEdits,
  resumeWorkflowReducer,
} from "../lib/resume-workflow";
import type { TailorResult } from "../lib/resume-tailor";
import type { ResumeSource } from "../lib/resume-source";

type ResumeTailorWorkspaceProps = { apiAvailable: boolean };

const DOCX_PREVIEW_CLASS = "resume-docx-visible-preview";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "处理失败，请检查文件后重试。";
}

function makeOutputName(source: ResumeSource) {
  return `${source.fileName.replace(/\.(pdf|docx)$/iu, "")}-按JD定制.${source.format}`;
}

function sourceParser(file: File) {
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (extension === "pdf") return parsePdfResume(file);
  if (extension === "docx") return parseDocxResume(file);
  throw new Error("仅支持可提取文字的 PDF 与 .docx；不支持扫描件 OCR、加密文件或旧版 .doc。");
}

function getWarningBlockId(message: string) {
  const colon = message.indexOf(":");
  return colon > 0 ? message.slice(0, colon) : "";
}

export function ResumeTailorWorkspace({ apiAvailable }: ResumeTailorWorkspaceProps) {
  const [state, dispatch] = useReducer(resumeWorkflowReducer, undefined, createInitialResumeWorkflowState);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pdfPreviewUrlRef = useRef<string | null>(null);
  const parseGenerationRef = useRef(0);
  const docxPreviewRef = useRef<HTMLDivElement>(null);
  const docxStylesRef = useRef<HTMLDivElement>(null);

  const acceptedEdits = useMemo(() => getAcceptedResumeEdits(state), [state]);
  const pdfHighlightMarkers = state.source && state.result
    ? getPdfHighlightMarkers(state.source, state.result.edits)
    : [];
  const pdfMarkerByBlockId = new Map(pdfHighlightMarkers.map((marker) => [marker.blockId, marker]));

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    if (state.output?.blob && state.source?.format === "pdf") return;
    const staleUrl = pdfPreviewUrlRef.current;
    if (staleUrl) {
      URL.revokeObjectURL(staleUrl);
      pdfPreviewUrlRef.current = null;
    }
  }, [state.output?.blob, state.source?.format]);

  useEffect(() => {
    const blob = state.output?.blob;
    if (!blob || state.source?.format !== "docx" || !docxPreviewRef.current || !docxStylesRef.current) return;
    let active = true;
    const container = docxPreviewRef.current;
    const styles = docxStylesRef.current;
    container.replaceChildren();
    styles.replaceChildren();
    import("docx-preview").then(({ renderAsync }) => renderAsync(blob, container, styles, {
      className: DOCX_PREVIEW_CLASS,
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      renderHeaders: true,
      renderFooters: true,
    })).catch((error: unknown) => {
      if (active) dispatch({ type: "export-failed", error: `DOCX 本地预览失败：${errorText(error)}` });
    });
    return () => {
      active = false;
      container.replaceChildren();
      styles.replaceChildren();
    };
  }, [state.output?.blob, state.source?.format]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function loadFile(file: File) {
    const generation = ++parseGenerationRef.current;
    abortRef.current?.abort();
    dispatch({ type: "source-parsing" });
    try {
      const source = await sourceParser(file);
      if (generation === parseGenerationRef.current) dispatch({ type: "source-ready", source });
    } catch (error) {
      if (generation === parseGenerationRef.current) dispatch({ type: "source-failed", error: errorText(error) });
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void loadFile(file);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void loadFile(file);
  }

  async function requestSuggestions() {
    if (!apiAvailable) {
      dispatch({ type: "request-failed", error: "静态体验版不提供 AI 改写；请使用已配置 AI 服务的应用版本。" });
      return;
    }
    let body: ReturnType<typeof buildTailorRequest>;
    try {
      body = buildTailorRequest(state);
    } catch (error) {
      dispatch({ type: "request-failed", error: errorText(error) });
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    dispatch({ type: "request-started" });
    try {
      const response = await fetch("/api/resume-tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json() as TailorResult | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error || "AI 服务暂时不可用。" : "AI 服务暂时不可用。");
      if (controller.signal.aborted) throw new DOMException("Request aborted", "AbortError");
      dispatch({ type: "candidate-received", result: payload as TailorResult });
    } catch (error) {
      if (controller.signal.aborted) dispatch({ type: "request-cancelled" });
      else dispatch({ type: "request-failed", error: errorText(error) });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function cancelRequest() {
    abortRef.current?.abort();
  }

  function updateJobContext(action: Parameters<typeof dispatch>[0]) {
    abortRef.current?.abort();
    dispatch(action);
  }

  async function buildOutput() {
    if (!state.source || !state.result) return;
    dispatch({ type: "export-started" });
    try {
      let blob: Blob;
      let warnings: string[];
      if (state.source.format === "pdf") {
        const output = await exportFlatPdfResume(state.source, acceptedEdits);
        blob = output.blob;
        warnings = output.overflows.map(({ blockId, reason }) => `${blockId}: ${reason}`);
        const previewUrl = URL.createObjectURL(blob);
        pdfPreviewUrlRef.current = previewUrl;
        setPdfPreviewUrl(previewUrl);
      } else {
        const output = await previewDocxResume(state.source, acceptedEdits);
        blob = output.blob;
        warnings = output.warnings;
        pdfPreviewUrlRef.current = null;
        setPdfPreviewUrl(null);
      }
      dispatch({ type: "export-ready", blob, warnings });
    } catch (error) {
      dispatch({ type: "export-failed", error: errorText(error) });
    }
  }

  function downloadOutput() {
    if (!state.output || state.output.warnings.length || !state.source) return;
    const url = URL.createObjectURL(state.output.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = makeOutputName(state.source);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function warningActions(blockId: string) {
    if (!blockId || !state.reviews[blockId]) return null;
    return <div className="resume-warning-actions">
      <button type="button" onClick={() => {
        dispatch({ type: "edit-decision", blockId, decision: "reject" });
      }}>保留原文 / 跳过此建议</button>
      <button type="button" onClick={() => document.getElementById(`resume-edit-${blockId}`)?.focus()}>缩短改写</button>
    </div>;
  }

  function renderReviewResults() {
    if (!state.result || !state.source) return null;
    const requirementResults = <div className="resume-requirement-results">
      <section><h4>已有素材可匹配</h4>{state.result.matchedRequirements.length ? <ul>{state.result.matchedRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>暂无明确匹配项。</p>}</section>
      <section><h4>仍需你补充</h4>{state.result.missingRequirements.length ? <ul>{state.result.missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>暂无待补充要求。</p>}</section>
    </div>;
    const editCards = state.result.edits.length === 0 ? <p className="resume-inline-warning">AI 没有建议修改现有文字块；你仍可导出原稿副本。</p> : <div className="resume-edit-list">
      {state.result.edits.map((edit) => {
        const original = state.source?.blocks.find((block) => block.id === edit.blockId);
        const review = state.reviews[edit.blockId];
        const marker = pdfMarkerByBlockId.get(edit.blockId);
        if (!original || !review) return null;
        return <article className={`resume-edit-card is-${review.decision}`} id={`resume-suggestion-${edit.blockId}`} key={edit.blockId} tabIndex={-1}>
          <header><span>{marker ? `建议 ${marker.number} · ` : ""}{original.section}</span><div className="resume-edit-card-heading-actions">
            {marker && <button type="button" onClick={() => document.getElementById(`resume-pdf-marker-${edit.blockId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>定位 PDF</button>}
            <span>{review.decision === "pending" ? "待审核" : review.decision === "accepted" ? "已接受" : review.decision === "manual" ? "已使用手动版本" : "保留原文"}</span>
          </div></header>
          <div className="resume-edit-requirement"><small>对应岗位要求</small><p>{edit.requirement || "AI 未提供可与 JD 原文核对的要求，请人工判断关联性。"}</p></div>
          <div className="resume-edit-comparison"><div><small>原文</small><p>{original.text}</p></div><div><small>AI 建议</small><p>{edit.replacement}</p></div></div>
          <p className="resume-edit-reason">改写思路：{edit.reason}</p>
          <label className="resume-field resume-manual-edit">
            <span>手动调整建议 <small>不会自动应用</small></span>
            <textarea id={`resume-edit-${edit.blockId}`} rows={3} maxLength={4_000} value={review.manualDraft} onChange={(event) => dispatch({ type: "edit-draft", blockId: edit.blockId, value: event.currentTarget.value })} />
          </label>
          <div className="resume-edit-actions">
            <button type="button" onClick={() => dispatch({ type: "edit-decision", blockId: edit.blockId, decision: "accept" })}>接受 AI 建议</button>
            <button type="button" onClick={() => dispatch({ type: "edit-decision", blockId: edit.blockId, decision: "manual", replacement: review.manualDraft })}>使用手动版本</button>
            <button type="button" onClick={() => dispatch({ type: "edit-decision", blockId: edit.blockId, decision: "reject" })}>保留原文 / 跳过</button>
          </div>
        </article>;
      })}
    </div>;

    if (state.source.format === "pdf") return <div className="resume-pdf-review-layout">
      <ResumePdfHighlightPreview source={state.source} markers={pdfHighlightMarkers} />
      <aside className="resume-pdf-review-sidebar" aria-label="岗位要求及改写建议">
        {requirementResults}
        {editCards}
      </aside>
    </div>;
    return <>{requirementResults}{editCards}</>;
  }

  return <section className="resume-tailor-workspace" aria-labelledby="resume-tailor-title">
    <div className="resume-workspace-heading">
      <p className="resume-workspace-kicker">TAILOR YOUR RESUME</p>
      <h2 id="resume-tailor-title">上传简历，按岗位要求定制</h2>
      <p>保留原稿结构与视觉，逐条检查 AI 建议；原始文件不会被覆盖。</p>
    </div>

    <div
      className={`resume-upload-zone${dragging ? " is-dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div aria-hidden="true" className="resume-upload-icon">↑</div>
      <div>
        <h3>选择你的原始简历</h3>
        <p>仅支持可提取文字的 PDF 与 .docx（可编辑 DOCX），最多 10 MB / 10 页。Word 页数为浏览器本地估算。</p>
      </div>
      <button type="button" className="resume-secondary-button" onClick={() => fileInputRef.current?.click()}>
        {state.source ? "更换简历" : "选择文件"}
      </button>
      <input
        ref={fileInputRef}
        className="resume-file-input"
        type="file"
        accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label="上传 PDF 或 DOCX 简历"
        aria-describedby="resume-upload-help"
        onChange={onFileChange}
      />
      <p id="resume-upload-help" className="resume-upload-help">暂不支持扫描件 / OCR、加密文件或旧版 .doc。文件只在当前浏览器内存中处理。</p>
      {state.status === "parsing" && <p className="resume-status" role="status">正在本地解析简历…</p>}
    </div>

    {state.source && <div className="resume-source-summary" role="status">
      <div><strong>{state.source.fileName}</strong><span>{state.source.format.toUpperCase()} · {state.source.pageCount}{state.source.pageCountEstimated ? "（估算）" : ""} 页 · {state.source.blocks.length} 个文字块</span></div>
      <button type="button" onClick={() => { parseGenerationRef.current += 1; abortRef.current?.abort(); dispatch({ type: "reset" }); }}>移除并清空</button>
      {state.source.warnings.map((warning) => <p key={warning} className="resume-inline-warning">{warning}</p>)}
      <details className="resume-extracted-text">
        <summary>查看本地提取文字（仅本页内存）</summary>
        <ol>{state.source.blocks.map((block) => <li key={block.id}><small>{block.section}{block.editable ? "" : " · 仅预览，不发送改写"}</small><p>{block.text}</p></li>)}</ol>
      </details>
    </div>}

    <div className="resume-job-fields">
      <label className="resume-field">
        <span>目标岗位 <b aria-hidden="true">*</b></span>
        <input value={state.target} maxLength={160} required placeholder="例如：产品经理" onChange={(event) => updateJobContext({ type: "set-target", value: event.currentTarget.value })} />
      </label>
      <label className="resume-field">
        <span>企业名称 <small>选填</small></span>
        <input value={state.company} maxLength={160} placeholder="例如：示例科技" onChange={(event) => updateJobContext({ type: "set-company", value: event.currentTarget.value })} />
      </label>
      <label className="resume-field resume-jd-field">
        <span>企业招聘要求 / JD <b aria-hidden="true">*</b></span>
        <textarea value={state.jobDescription} maxLength={20_000} required rows={6} placeholder="粘贴岗位职责与任职要求。简历和 JD 中的文字只会作为改写材料，不会被当作系统指令。" onChange={(event) => updateJobContext({ type: "set-job-description", value: event.currentTarget.value })} />
      </label>
    </div>

    <div className="resume-privacy-box">
      <label className="resume-consent-label">
        <input type="checkbox" checked={state.consent} onChange={(event) => dispatch({ type: "set-consent", value: event.currentTarget.checked })} />
        <span>我已阅读并同意：仅将从简历提取的文字、目标岗位信息和 JD 发送到本应用配置的 AI 服务；不会上传原始 PDF / Word 文件。提取文字可能包含姓名、联系方式等个人信息。已发送内容按所配置模型供应商的数据政策处理，请先查看供应商隐私政策。</span>
      </label>
      {!apiAvailable && <p className="resume-static-notice" role="note">GitHub Pages 静态体验版不提供 AI 改写；可本地查看/解析文件，但不会向缺失的 API 发送简历文字。</p>}
    </div>

    {state.error && <p className="resume-error" role="alert">{state.error}</p>}
    <div className="resume-workspace-actions">
      {state.status === "requesting" ? <button type="button" className="resume-secondary-button" onClick={cancelRequest}>取消请求</button> : <button type="button" className="resume-primary-button" disabled={!apiAvailable || !state.source || !state.consent || state.status === "parsing"} onClick={() => void requestSuggestions()}>
        分析 JD 并生成改写建议
      </button>}
      {state.status === "requesting" && <span role="status">只发送你已授权的文字材料，正在等待 AI 建议…</span>}
    </div>

    {state.result && state.source && <section className="resume-review" aria-labelledby="resume-review-title">
      <div className="resume-review-heading"><div><p className="resume-workspace-kicker">REVIEW BEFORE APPLYING</p><h3 id="resume-review-title">逐条审核改写建议</h3></div><p>建议不会自动写入；未接受的内容保留原文。</p></div>
      <p className="resume-fact-check-warning" role="note">AI 可能误读或生成不准确内容。接受前请逐项核对事实、数字、日期、职责、公司与结果；不要接受任何无法由原稿或你本人确认的内容。</p>
      {renderReviewResults()}

      <div className="resume-export-controls">
        <p>只写入你接受的建议；原文件不会被覆盖。PDF 将输出扁平化页面图像，DOCX 保持可编辑。</p>
        <button type="button" className="resume-primary-button" disabled={state.status === "exporting"} onClick={() => void buildOutput()}>
          {state.status === "exporting" ? "正在本地生成预览…" : state.output ? "根据当前审核重新生成" : "生成同格式预览"}
        </button>
      </div>

      {state.output && <section className="resume-output" aria-labelledby="resume-output-title">
        <div className="resume-output-heading"><div><p className="resume-workspace-kicker">LOCAL OUTPUT</p><h4 id="resume-output-title">输出预览</h4></div><button type="button" className="resume-primary-button" disabled={state.output.warnings.length > 0} onClick={downloadOutput}>下载 {state.source.format.toUpperCase()}</button></div>
        {state.output.warnings.length > 0 && <div className="resume-overflow-panel" role="alert"><strong>发现版式溢出或重排，下载已暂时关闭。</strong><p>请修改建议、保留原文或跳过对应改写，然后重新生成预览。</p><ul>{state.output.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}{warningActions(getWarningBlockId(warning))}</li>)}</ul></div>}
        {state.source.format === "pdf" && pdfPreviewUrl && <iframe className="resume-pdf-output-preview" title="扁平化 PDF 输出预览" src={pdfPreviewUrl} />}
        {state.source.format === "docx" && <div className="resume-docx-output-preview"><div ref={docxStylesRef} /><div ref={docxPreviewRef} aria-label="可编辑 DOCX 输出的本地分页预览" /></div>}
      </section>}
    </section>}

    {state.source && <button type="button" className="resume-reset-button" onClick={() => {
      parseGenerationRef.current += 1;
      abortRef.current?.abort();
      dispatch({ type: "reset" });
    }}>清空本页简历与岗位内容</button>}
    <span className="sr-only" aria-live="polite">{state.status === "parsing" ? "正在解析简历" : ""}</span>
  </section>;
}
