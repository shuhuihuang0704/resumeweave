import type { PdfBlockLocation, ResumeEdit, ResumeSource } from "./resume-source.ts";

export type PdfHighlightMarker = {
  blockId: string;
  number: number;
  page: number;
  section: string;
  text: string;
  box: PdfBlockLocation["box"];
};

export function getPdfHighlightMarkers(source: ResumeSource, edits: ResumeEdit[]): PdfHighlightMarker[] {
  if (source.format !== "pdf") return [];
  const blocks = new Map(source.blocks.map((block) => [block.id, block]));

  return edits.flatMap((edit, index) => {
    const block = blocks.get(edit.blockId);
    if (!block?.editable || !("box" in block.location)) return [];
    const location = block.location as PdfBlockLocation;
    return [{
      blockId: block.id,
      number: index + 1,
      page: location.page,
      section: block.section,
      text: block.text,
      box: location.box,
    }];
  });
}

export function getPdfHighlightPosition(
  box: PdfBlockLocation["box"],
  page: { width: number; height: number },
) {
  if (page.width <= 0 || page.height <= 0) throw new Error("PDF 页面尺寸必须大于零。");
  const percent = (value: number, dimension: number) => `${Number((value / dimension * 100).toFixed(4))}%`;
  return {
    left: percent(box.x, page.width),
    top: percent(box.y, page.height),
    width: percent(box.width, page.width),
    height: percent(box.height, page.height),
  };
}
