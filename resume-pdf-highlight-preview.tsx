"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfHighlightMarker } from "../lib/resume-pdf-highlights";
import { getPdfHighlightPosition } from "../lib/resume-pdf-highlights";
import { loadPdfJs } from "../lib/resume-pdf";
import type { ResumeSource } from "../lib/resume-source";

type PageSize = { width: number; height: number };

export function ResumePdfHighlightPreview({
  source,
  markers,
}: {
  source: ResumeSource;
  markers: PdfHighlightMarker[];
}) {
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState("");
  const firstPageRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());

  useEffect(() => {
    const node = firstPageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry?.contentRect.width ?? 0);
      if (width > 0) setContainerWidth((previous) => previous === width ? previous : width);
    });
    observer.observe(node);
    setContainerWidth(Math.floor(node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, [source.file]);

  useEffect(() => {
    if (!containerWidth) return;
    let active = true;
    let destroyPdf: (() => Promise<void>) | undefined;
    const renderTasks: Array<{ cancel(): void }> = [];

    async function renderPages() {
      try {
        const pdfjs = await loadPdfJs();
        if (!active) return;
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(await source.file.arrayBuffer()),
          isEvalSupported: false,
          useSystemFonts: true,
        });
        destroyPdf = () => loadingTask.destroy();
        const documentProxy = await loadingTask.promise;
        for (let pageNumber = 1; pageNumber <= Math.min(documentProxy.numPages, source.pageCount); pageNumber += 1) {
          if (!active) return;
          const canvas = canvasRefs.current.get(pageNumber);
          if (!canvas) continue;
          const page = await documentProxy.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const resolution = Math.min(2, containerWidth / baseViewport.width * (window.devicePixelRatio || 1));
          const viewport = page.getViewport({ scale: resolution });
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("无法创建 PDF 页面画布。");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const renderTask = page.render({ canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
          if (active) setPageSizes((previous) => ({
            ...previous,
            [pageNumber]: { width: baseViewport.width, height: baseViewport.height },
          }));
        }
      } catch {
        if (active) setError("无法显示原 PDF 预览；你的原文件未被更改。请继续用下方文字建议审核。");
      }
    }

    void renderPages();
    return () => {
      active = false;
      renderTasks.forEach((task) => task.cancel());
      void destroyPdf?.();
    };
  }, [source.file, source.pageCount, containerWidth]);

  const markersByPage = new Map<number, PdfHighlightMarker[]>();
  for (const marker of markers) markersByPage.set(marker.page, [...(markersByPage.get(marker.page) ?? []), marker]);

  return <section className="resume-pdf-highlight-preview" aria-label="原 PDF 修改位置标注">
    <div className="resume-pdf-highlight-heading">
      <div><h4>原 PDF 修改位置</h4><p>红色标记对应下方编号建议；仅用于预览，不会改动原文件。</p></div>
      {markers.length > 0 && <span>{markers.length} 处建议</span>}
    </div>
    {error && <p className="resume-pdf-highlight-error" role="status">{error}</p>}
    <div className="resume-pdf-highlight-pages">
      {Array.from({ length: source.pageCount }, (_, pageIndex) => {
        const pageNumber = pageIndex + 1;
        const size = pageSizes[pageNumber];
        const pageMarkers = markersByPage.get(pageNumber) ?? [];
        return <article className="resume-pdf-highlight-page" key={pageNumber}>
          <p className="resume-pdf-highlight-page-label">第 {pageNumber} 页</p>
          <div className="resume-pdf-highlight-canvas" ref={pageNumber === 1 ? firstPageRef : undefined}>
            <canvas
              ref={(node) => {
                if (node) canvasRefs.current.set(pageNumber, node);
                else canvasRefs.current.delete(pageNumber);
              }}
              aria-hidden="true"
            />
            {size && pageMarkers.map((marker) => <button
              key={marker.blockId}
              id={`resume-pdf-marker-${marker.blockId}`}
              type="button"
              className="resume-pdf-highlight-marker"
              style={getPdfHighlightPosition(marker.box, size)}
              aria-label={`第 ${pageNumber} 页第 ${marker.number} 处建议，跳到对应审核卡片`}
              title={`建议 ${marker.number}：${marker.text}`}
              onClick={() => document.getElementById(`resume-suggestion-${marker.blockId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            ><span>{marker.number}</span></button>)}
          </div>
          {pageMarkers.length === 0 && <p className="resume-pdf-no-marker">本页暂无 AI 改写位置标记。</p>}
        </article>;
      })}
    </div>
  </section>;
}
