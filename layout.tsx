import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "resumeweave.jjhuang.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const imageUrl = `${protocol}://${host}/og-resumeweave.png`;
  const title = "ResumeWeave｜按岗位要求定制你的简历";
  const description = "上传已有 PDF 或 DOCX 简历，按企业招聘要求生成可逐条审核的改写建议，并尽量保留原有版式。";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: imageUrl, width: 1200, height: 630, alt: "ResumeWeave——按岗位要求定制简历" }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
