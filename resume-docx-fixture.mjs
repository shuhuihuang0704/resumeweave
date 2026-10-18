import JSZip from "jszip";

const documentXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="ResumeHeading"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Product</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> lead</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bright</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve"> designer</w:t></w:r></w:p>
<w:p><w:hyperlink r:id="rIdExternal"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>
<w:p><w:r><w:t>Image reference</w:t><w:drawing><wp:inline><a:graphic><a:graphicData><a:blip r:embed="rIdImage"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell experience</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:sectPr/></w:body></w:document>`;

const relationshipsXml = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/pixel.png"/><Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://outside.invalid/private" TargetMode="External"/></Relationships>`;

export async function createDocxFile({ pages = 2, includePageMetadata = true, pageMetadata = pages, expandedBytes = 0, entryCount = 0 } = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relationshipsXml);
  zip.file("word/media/pixel.png", new Uint8Array([1, 2, 3, 4]));
  if (includePageMetadata) zip.file("docProps/app.xml", `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Pages>${pageMetadata}</Pages></Properties>`);
  if (expandedBytes > 0) zip.file("custom/expanded.xml", "x".repeat(expandedBytes));
  for (let index = 0; index < entryCount; index += 1) zip.file(`custom/entry-${index}.xml`, "x");
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 1 } });
  return new File([bytes], "synthetic-resume.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export { documentXml, relationshipsXml };
