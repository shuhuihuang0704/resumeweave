import { jsPDF } from "jspdf";

export function createResumePdf({ pageCount = 1, text = true, encrypted = false } = {}) {
  const doc = new jsPDF({
    unit: "pt",
    format: [612, 792],
    ...(encrypted ? { encryption: { userPassword: "resume-secret", ownerPassword: "owner-secret" } } : {}),
  });

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) doc.addPage([612, 792], "portrait");
    doc.setFillColor(248, 246, 239);
    doc.rect(0, 0, 612, 792, "F");
    if (text) {
      doc.setTextColor(35, 42, 48);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text("Left column - project work", 54, 90);
      doc.text("Right column - education", 360, 90);
      doc.text("SIDE LABEL", 22, 180, { angle: 90 });
    } else {
      doc.setFillColor(80, 110, 150);
      doc.rect(54, 60, 180, 90, "F");
    }
  }

  return new File([doc.output("arraybuffer")], "synthetic-resume.pdf", { type: "application/pdf" });
}
