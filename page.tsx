"use client";

import { useEffect, useRef, useState } from "react";
import { ResumeTailorWorkspace } from "./components/resume-tailor-workspace";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const apiAvailable = import.meta.env.VITE_RESUME_TAILOR_API_AVAILABLE;

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main>
      <nav className="nav shell" aria-label="主导航">
        <a className="brand" href="#top"><span className="brand-mark">W</span><span>ResumeWeave</span></a>
        <div className="nav-links"><a href="#resume-preview">简历预览</a><a href="#features">产品功能</a><a className="nav-cta" href="#builder">开始制作 <span aria-hidden="true">→</span></a></div>
        <button ref={menuToggleRef} className="menu-toggle" type="button" aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
        <div className={`mobile-menu${menuOpen ? " is-open" : ""}`}>
          <button className="menu-scrim" type="button" aria-label="关闭导航菜单" tabIndex={menuOpen ? 0 : -1} hidden={!menuOpen} onClick={closeMenu} />
          <div className="mobile-menu-panel" id="mobile-navigation" hidden={!menuOpen}>
            <a href="#resume-preview" onClick={closeMenu}>简历预览</a>
            <a href="#features" onClick={closeMenu}>产品功能</a>
            <a href="#builder" onClick={closeMenu}>开始制作 <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy-column">
          <span className="hero-kicker">简历创作，从真实经历开始</span>
          <h1>把岗位要求，织进你的下一份简历</h1>
          <p className="hero-copy">上传已有简历和目标岗位要求，让 AI 基于你的真实经历提出改写建议，由你逐条审核后再导出。</p>
          <a className="hero-cta" href="#builder">开始定制 <span aria-hidden="true">→</span></a>
          <p className="hero-assurance">原稿由你掌控；建议不会自动应用，接受前请核实事实</p>
        </div>
        <aside className="sample-resume-panel hero-resume-preview" id="resume-preview" aria-label="简历预览样例">
          <div className="sample-resume-heading"><div><span>RESUME PREVIEW</span><h2>简历预览</h2></div><span className="sample-ready">版式示例</span></div>
          <div className="sample-resume-page">
            <header className="sample-resume-top"><div><h3>林知夏</h3><p>产品经理 · 用户增长方向</p><small>杭州 · linxia@example.com · 138 0000 0000</small></div><div className="sample-photo-placeholder" aria-label="照片位置"><span>照片</span></div></header>
            <section><h4>个人简介</h4><p>具备用户研究、需求分析与数据复盘经验，能够协同团队推动产品从方案设计到上线迭代。</p></section>
            <section><h4>项目与实践</h4><article><b>校园二手交易平台</b><small>项目负责人 · 2024.03—2024.08</small><p>访谈 30 位用户并梳理关键流程，推动发布体验优化；项目上线后累计获得 1,200 名注册用户。</p></article><article><b>会员增长任务中心</b><small>产品实习生 · 2023.06—2023.12</small><p>协同设计与研发完成任务体系改版，跟踪转化漏斗并持续迭代。</p></article></section>
            <section><h4>教育背景</h4><p>浙江工商大学 · 信息管理 · 本科</p></section>
            <section><h4>技能与证书</h4><p>用户研究 · 产品设计 · 数据分析 · SQL · Figma</p></section>
          </div>
          <p className="sample-resume-note">这里只展示版式；改写会围绕你上传的原稿进行。</p>
        </aside>
      </section>

      <section className="feature-strip shell" id="features" aria-label="产品功能">
        <article><span>01</span><b>以原稿为依据</b><p>围绕已有文字提出改写建议；AI 仍可能出错，请核对后再接受。</p></article>
        <article><span>02</span><b>逐条审核建议</b><p>接受、手动修改或保留原文，决定权始终在你。</p></article>
        <article><span>03</span><b>尽量保留原版式</b><p>PDF 输出扁平化页面；DOCX 保持可编辑。</p></article>
      </section>

      <div className="builder-layout" id="builder">
        <ResumeTailorWorkspace apiAvailable={apiAvailable} />
      </div>
    </main>
  );
}
