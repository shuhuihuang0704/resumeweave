"use client";

import { useMemo, useState } from "react";

type TemplateName = "classic" | "modern" | "editorial";
type CandidateType = "student" | "experienced";
type FormData = {
  name: string;
  target: string;
  contact: string;
  city: string;
  material: string;
  education: string;
  skills: string;
};
type ResumeBlock = { title: string; meta: string; bullets: string[] };
type ResumeSkill = { name: string; detail: string };
type ResumeDraft = { summary: string; blocks: ResumeBlock[]; education: string[]; skills: ResumeSkill[] };
type ResumeIdentity = { name: string; target: string; contact: string };
type MarketRequirement = { label: string; detail: string; signals: string[]; evidence: string };
type MarketSource = { company: string; role: string; code: string; url: string };
type MarketProfile = { role: string; matches: string[]; researchedAt: string; requirements: MarketRequirement[]; sources: MarketSource[] };
type JobRequirement = MarketRequirement & { covered: boolean };
type LiveResearchPayload = { status: "success"; target: string; researchedAt: string; requirements: string[]; sources: MarketSource[] };
type LiveResearchState =
  | { status: "idle" | "loading"; target: string }
  | { status: "success"; target: string; data: LiveResearchPayload }
  | { status: "not_found" | "error"; target: string; message: string };

const EMPTY_FORM: FormData = { name: "", target: "", contact: "", city: "", material: "", education: "", skills: "" };

const SAMPLE_FORM: FormData = {
  name: "陈晨",
  target: "用户增长产品经理",
  contact: "chenchen@email.com · 138 0000 0000",
  city: "上海",
  material: `星云科技｜产品经理｜2023.04—至今
负责会员增长，主导会员任务中心改版
和设计、研发、运营一起推进签到、积分任务上线
梳理了 200 多条用户反馈，上线后月活提升 18%

校园二手交易小程序｜项目负责人｜2022.09—2023.01
从 0 到 1 做了需求调研、原型和产品方案
访谈 30 位学生，发现发布流程太复杂并进行改版
上线一个月获得 1200 名注册用户`,
  education: "华东理工大学｜信息管理与信息系统｜本科｜2019—2023",
  skills: "需求分析、用户研究、数据分析、Axure、Figma、SQL",
};

const STUDENT_SAMPLE_FORM: FormData = {
  name: "林晓",
  target: "产品经理",
  contact: "linxiao@email.com · 138 0000 0000",
  city: "杭州",
  material: `校园二手交易小程序｜课程项目负责人｜2025.03—2025.06
访谈 30 位同学，整理发布流程复杂、沟通成本高等问题
完成需求分析、原型设计和可用性测试，协同 3 位同学开发上线
项目获得 1200 名注册用户，二次发布率提升至 36%

大学生创新创业比赛｜团队负责人｜2024.09—2024.12
围绕校园闲置物品交易设计商业方案和路演材料
组织 5 人团队完成用户调研、竞品分析和产品 Demo
获得校级一等奖，并进入省赛答辩`,
  education: "浙江工商大学｜信息管理与信息系统｜本科｜2023—2027",
  skills: "用户研究、需求分析、Figma、Axure、Excel、SQL",
};

const ACTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^(我)?主要负责/, "主导"], [/^(我)?负责/, "负责"], [/^(我)?参与了?/, "参与"],
  [/^(我)?做了?/, "完成"], [/^(我)?和/, "协同"], [/^(我)?通过/, "通过"],
];

const ROLE_EXAMPLES = ["产品经理", "数据分析师", "前端工程师", "后端开发工程师", "AI算法工程师", "测试开发工程师", "UI设计师", "内容运营", "市场营销", "销售经理", "战略分析", "客服", "人力资源", "财务分析", "供应链管理", "法务"];

const MARKET_PROFILES: MarketProfile[] = [
  {
    role: "用户增长产品经理",
    matches: ["用户增长产品", "增长产品", "增长经理"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "增长闭环", detail: "能搭建获客、激活、留存、付费转化的完整增长体系，并对核心指标负责。", signals: ["获客", "激活", "留存", "付费", "用户增长", "增长策略"], evidence: "补一个完整增长案例：你负责哪段漏斗、基线是多少、用了什么策略、指标最终变化多少。" },
      { label: "数据与实验", detail: "能够独立完成漏斗分析、SQL 取数、归因分析与 A/B 实验设计。", signals: ["sql", "漏斗", "a/b", "ab测试", "归因", "数据分析"], evidence: "写清一次真实实验的假设、样本、指标、结果和后续决策；会 SQL 时说明分析的数据与结论。" },
      { label: "增长方法论", detail: "理解 PLG、用户生命周期、裂变邀请、SEO 或订阅转化等增长方法。", signals: ["plg", "生命周期", "裂变", "邀请", "seo", "订阅", "转化"], evidence: "不要只写“了解增长”。选择你真正做过的一种方法，补充使用场景、具体动作及结果。" },
      { label: "跨团队落地", detail: "能协同研发、设计、运营和数据团队，独立推动复杂增长项目落地。", signals: ["研发", "设计", "运营", "跨团队", "协同", "项目落地"], evidence: "说明协作角色、关键分歧、你的推进动作、交付周期与上线结果。" },
      { label: "AI 产品理解", detail: "部分岗位要求理解 LLM、Agent 的能力边界，并能转化为增长策略。", signals: ["ai", "llm", "agent", "大模型", "智能助手"], evidence: "若真实做过，补充 AI 场景、模型或工作流、评测方式和业务效果；否则可制作一个可演示的小项目。" },
    ],
    sources: [
      { company: "百度", role: "秒哒-AI产品经理（用户增长）", code: "J98908", url: "https://talent.baidu.com/jobs/detail/SOCIAL/522f0ec0-7ca1-4f87-b01e-53e1441fb4b9" },
      { company: "百度", role: "用户增长产品经理", code: "J99913", url: "https://talent.baidu.com/jobs/detail/SOCIAL/791c588e-7d23-4fe3-b37e-9c9a805d977d" },
      { company: "百度", role: "用户增长产品经理", code: "J97221", url: "https://talent.baidu.com/jobs/detail/SOCIAL/602f9a0f-c479-4183-ad68-c92e3e453073" },
    ],
  },
  {
    role: "产品经理",
    matches: ["产品经理", "产品专员", "ai产品", "策略产品", "用户产品"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "用户洞察", detail: "从用户行为、调研和反馈中识别真实需求，并转化为产品方案。", signals: ["用户研究", "用户调研", "用户访谈", "用户反馈", "用户需求"], evidence: "补充调研方法、样本量、关键洞察，以及洞察最终改变了哪项产品决策。" },
      { label: "产品落地", detail: "能完成产品定义、方案设计，并协同多团队推动功能上线。", signals: ["需求分析", "prd", "原型", "上线", "产品方案", "项目落地"], evidence: "用一个项目写清问题、方案取舍、你的职责、协作角色和上线结果。" },
      { label: "数据评估", detail: "通过数据分析验证产品健康度、定位问题并持续迭代。", signals: ["数据分析", "指标", "转化", "留存", "a/b", "ab测试"], evidence: "说明你负责的核心指标、分析方法、发现的问题与迭代后的变化。" },
      { label: "跨团队协作", detail: "能够与设计、研发、算法或运营团队共同推进复杂项目。", signals: ["设计", "研发", "算法", "运营", "协同", "跨团队"], evidence: "写明协作对象、你解决的关键分歧，以及最终如何保证按期交付。" },
      { label: "AI 能力边界", detail: "AI 产品岗位通常要求理解大模型、多模态或 Agent 的能力边界。", signals: ["ai", "大模型", "多模态", "agent", "prompt", "rag"], evidence: "若投 AI 产品岗，补充一个真实落地案例：场景、模型能力、评测方法、风险控制和结果。" },
    ],
    sources: [
      { company: "百度", role: "产品经理", code: "J100962", url: "https://talent.baidu.com/jobs/detail/SOCIAL/7cc6a8b2-24af-4f83-8b58-72eca83dcfb9" },
      { company: "百度", role: "产品经理（AI写作）", code: "J99408", url: "https://talent.baidu.com/jobs/detail/SOCIAL/18e2b719-bf4a-4841-85e3-5ad79596b8d7" },
      { company: "百度", role: "推荐策略产品经理", code: "J101167", url: "https://talent.baidu.com/jobs/detail/SOCIAL/d9b55b5d-a9a2-46b7-915e-942d4a0669fe" },
    ],
  },
  {
    role: "数据分析师",
    matches: ["数据分析", "商业分析", "业务分析", "bi分析"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "SQL / Python", detail: "熟练使用 SQL，并能用 Python、R 或 Excel 完成数据处理和分析。", signals: ["sql", "python", "excel", "r语言"], evidence: "列出工具还不够：补充数据量级、查询或建模任务、输出结论及业务动作。" },
      { label: "指标与归因", detail: "能搭建指标体系，完成业务监控、异动归因、漏斗和收益分析。", signals: ["指标体系", "异动", "归因", "漏斗", "roi", "ltv"], evidence: "写一个指标异常案例：如何发现、怎样拆解、定位到什么原因、最终推动了什么调整。" },
      { label: "实验评估", detail: "掌握 A/B 实验、显著性检验、样本量计算等评估方法。", signals: ["a/b", "ab测试", "显著性", "样本量", "实验设计"], evidence: "补充一次真实实验的实验单元、主指标、样本量、显著性与业务决策。" },
      { label: "建模能力", detail: "部分岗位要求回归、预测、用户分层或流失预警等基础建模。", signals: ["回归", "预测", "建模", "用户分层", "机器学习"], evidence: "若真实使用过模型，说明特征、评估指标、结果，以及模型如何被业务采用。" },
      { label: "推动业务落地", detail: "不仅输出报告，还要把数据结论转化为产品、运营或商业动作。", signals: ["推动", "落地", "业务决策", "优化策略", "协同"], evidence: "补充结论影响了谁、推动了哪项动作，以及动作实施后的量化结果。" },
    ],
    sources: [
      { company: "百度", role: "数据分析师", code: "J100228", url: "https://talent.baidu.com/jobs/detail/SOCIAL/5eaa73d0-ac01-4db7-ae51-fde8ee5f6daa" },
      { company: "百度", role: "数据分析师（用增方向）", code: "J96714", url: "https://talent.baidu.com/jobs/detail/SOCIAL/75c66713-6e14-41a5-9c43-c59a7a6e1200" },
      { company: "百度", role: "数据分析师", code: "J103508", url: "https://talent.baidu.com/jobs/detail/SOCIAL/31526850-e200-4427-80be-e0971b4ebad7" },
    ],
  },
  {
    role: "前端工程师",
    matches: ["前端", "web开发", "react开发", "vue开发"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "Web 基础", detail: "扎实掌握 HTML、CSS、JavaScript，并理解浏览器与 HTTP。", signals: ["html", "css", "javascript", "http", "浏览器"], evidence: "用真实项目证明，不要只列技能；说明复杂交互、兼容性或网络问题及解决方案。" },
      { label: "主流框架", detail: "熟练使用 React、Vue 或 Angular，并理解框架原理与生态。", signals: ["react", "vue", "angular"], evidence: "补充项目规模、负责模块、状态管理方案、关键技术取舍与交付结果。" },
      { label: "工程化", detail: "具备组件化、模块化、构建工具和团队规范实践。", signals: ["组件", "工程化", "webpack", "vite", "组件库", "模块化"], evidence: "写清你建设或改造了什么，研发效率、构建时间或缺陷率改善了多少。" },
      { label: "性能与稳定性", detail: "能够做性能优化、线上问题定位并保障应用稳定运行。", signals: ["性能优化", "稳定性", "首屏", "监控", "线上问题", "可访问性"], evidence: "补充优化前后指标，例如 LCP、包体积、错误率或故障恢复时间。" },
      { label: "AI / 桌面端加分", detail: "部分岗位优先考虑 AI 应用、Electron 或企业级 SaaS 项目经验。", signals: ["ai", "electron", "tauri", "saas", "桌面端"], evidence: "若真实做过，补充具体产品场景、你的技术职责和可访问的 Demo 或代码。" },
    ],
    sources: [
      { company: "百度", role: "前端工程师", code: "J96724", url: "https://talent.baidu.com/jobs/detail/SOCIAL/25abb16f-6295-46f7-a25c-7e343145f671" },
      { company: "百度", role: "前端工程师", code: "J91634", url: "https://talent.baidu.com/jobs/detail/SOCIAL/c25b8824-c854-492d-9d01-45f1a49c9241" },
    ],
  },
  {
    role: "后端开发工程师",
    matches: ["后端", "服务端", "java开发", "go开发", "php开发", "c++开发", "软件工程师", "开发工程师"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "编程基础", detail: "熟练掌握 Java、Go、C++ 或 PHP 等至少一门语言，并具备扎实的数据结构与算法基础。", signals: ["java", "go", "c++", "php", "数据结构", "算法"], evidence: "补充一个真实项目：核心模块、数据规模、你写的关键代码以及解决的技术难题。" },
      { label: "系统与网络", detail: "理解 Linux、操作系统、网络与服务端应用开发基础。", signals: ["linux", "操作系统", "网络", "http", "服务端"], evidence: "用部署、并发、网络排障或系统调优案例证明，不要只罗列课程名称。" },
      { label: "架构与性能", detail: "能参与核心功能和架构开发，并处理稳定性、故障排查与性能调优。", signals: ["架构", "性能", "稳定性", "故障", "并发", "分布式"], evidence: "写清问题指标、定位过程、方案取舍，以及优化前后的响应时间、吞吐或错误率。" },
      { label: "工程实践", detail: "具备项目经验，理解软件开发流程、测试、代码评审和团队协作。", signals: ["git", "测试", "代码评审", "项目经验", "协作", "上线"], evidence: "可用课程或开源项目证明：说明版本协作、测试方式、交付过程和最终成果。" },
      { label: "AI 与新技术", detail: "近期岗位强调将大模型能力集成到业务，并使用 AI 辅助开发提升效率。", signals: ["ai", "大模型", "llm", "copilot", "codex"], evidence: "若真实使用过，说明 AI 用在编码、测试或业务功能的哪个环节，以及如何验证正确性。" },
    ],
    sources: [
      { company: "百度", role: "北京-后端开发工程师", code: "J100737", url: "https://talent.baidu.com/jobs/detail/GRADUATE/72145a13-5eb1-41ce-8853-d00aa7369281" },
    ],
  },
  {
    role: "AI / 算法工程师",
    matches: ["算法", "机器学习", "深度学习", "大模型工程", "ai工程", "智能体工程", "nlp", "计算机视觉", "cv工程"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "算法基础", detail: "掌握机器学习、深度学习及相关数学基础，能够完成模型训练与优化。", signals: ["机器学习", "深度学习", "pytorch", "tensorflow", "训练", "算法"], evidence: "补充任务、数据集、模型、指标和实验结果，最好提供代码仓库或论文复现记录。" },
      { label: "大模型技术", detail: "大模型岗位关注预训练、SFT、RLHF、RAG、Agent 或多模态等方向。", signals: ["sft", "rlhf", "rag", "agent", "多模态", "llm"], evidence: "选择真正实践过的方向，写清数据、流程、评测方法、成本与效果，不要只写“了解”。" },
      { label: "评测体系", detail: "能够设计效果、稳定性、延迟和成本等量化评测指标。", signals: ["评测", "准确率", "召回率", "f1", "延迟", "成本"], evidence: "补充评测集构建方式、基线、核心指标和迭代后的变化。" },
      { label: "工程落地", detail: "能把算法用于真实场景，完成训练、优化、部署与服务集成。", signals: ["部署", "推理", "服务", "工程", "落地", "优化"], evidence: "写清模型如何接入产品、线上规模、性能约束以及你负责的模块。" },
      { label: "研究与复现", detail: "校招岗位重视论文阅读、前沿跟踪、竞赛或高质量项目经验。", signals: ["论文", "竞赛", "复现", "kaggle", "专利", "研究"], evidence: "附论文、比赛名次、复现报告或技术博客，并说明你的独立贡献。" },
    ],
    sources: [
      { company: "百度", role: "AIDU-智能体算法工程师", code: "J99969", url: "https://talent.baidu.com/jobs/list?projectType=3&recruitType=GRADUATE" },
      { company: "百度", role: "AIDU-大模型算法工程师", code: "J99938", url: "https://talent.baidu.com/jobs/list?projectType=3&recruitType=GRADUATE" },
    ],
  },
  {
    role: "测试开发工程师",
    matches: ["测试开发工程师", "测试开发", "软件测试", "qa", "质量工程", "自动化测试", "测试工程"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "测试设计", detail: "能完成需求分析、测试计划、用例设计、缺陷跟踪和测试报告。", signals: ["测试用例", "测试计划", "缺陷", "bug", "测试报告"], evidence: "用一个项目说明测试范围、用例数量、发现的关键缺陷及上线质量结果。" },
      { label: "自动化能力", detail: "能够开发自动化脚本、测试工具或持续集成测试框架。", signals: ["自动化", "pytest", "selenium", "ci", "测试框架", "脚本"], evidence: "补充框架技术栈、覆盖场景、执行频率，以及节省的时间或覆盖率提升。" },
      { label: "编程与系统", detail: "具备 Python、Java、C++ 或 Shell 编程能力，并了解 Linux。", signals: ["python", "java", "c++", "shell", "linux"], evidence: "不要只列语言，写清用它开发了什么测试工具、如何定位问题。" },
      { label: "质量分析", detail: "能定位故障根因、分析测试结果并推动研发修复。", signals: ["根因", "定位", "质量", "稳定性", "修复"], evidence: "补充一次复杂问题的复现、定位、协作修复与回归验证过程。" },
      { label: "AI 测试", detail: "AI 产品测试开始关注模型准确性、鲁棒性、安全和多轮一致性。", signals: ["ai测试", "鲁棒性", "内容安全", "模型评测", "大模型"], evidence: "若投 AI 测试岗，可做一个模型评测项目，展示数据集、维度、结果和改进建议。" },
    ],
    sources: [
      { company: "百度", role: "测试开发工程师（实习）", code: "J90597", url: "https://talent.baidu.com/jobs/detail/INTERN/1b0ef493-3090-43a9-977e-978cfd616bc1" },
      { company: "百度", role: "测试开发工程师", code: "J85096", url: "https://talent.baidu.com/jobs/detail/SOCIAL/43a53b43-6c1e-4fae-b2ea-01ff5138fd11" },
    ],
  },
  {
    role: "UI / 视觉设计师",
    matches: ["ui设计", "视觉设计", "平面设计", "交互设计", "ux设计", "产品设计师", "设计师"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "作品集", detail: "设计岗位要求用完整案例展示问题理解、设计过程和最终视觉方案。", signals: ["作品集", "作品", "案例", "portfolio"], evidence: "准备 2—3 个完整案例，写清背景、目标、过程、取舍、反馈和最终结果，并附访问链接。" },
      { label: "设计工具", detail: "熟练使用 Figma、Sketch、Photoshop、Illustrator 等设计工具。", signals: ["figma", "sketch", "photoshop", "ps", "illustrator", "ai"], evidence: "在项目里说明具体产物，例如界面、组件库、动效、插画或品牌资产。" },
      { label: "规范与落地", detail: "理解移动端与 Web 设计规范，能完成设计走查并推动方案上线。", signals: ["设计规范", "组件库", "设计走查", "上线", "ios", "android"], evidence: "补充和产品、研发协作的过程，以及如何解决还原度或一致性问题。" },
      { label: "用户体验", detail: "能够结合产品目标、用户反馈与数据发现体验问题并迭代。", signals: ["用户体验", "用户反馈", "可用性", "数据", "体验优化"], evidence: "展示问题发现依据、改版方案、测试方法和改版后的反馈或指标。" },
      { label: "AIGC 设计", detail: "部分岗位要求有 AI 辅助视觉创作或相关实操案例。", signals: ["aigc", "midjourney", "stable diffusion", "ai设计", "生成式"], evidence: "若真实使用过，说明工作流、人工判断环节、效率变化和版权或一致性控制。" },
    ],
    sources: [
      { company: "小度科技", role: "视觉设计师", code: "J11393", url: "https://talent.baidu.com/jobs/detail/SOCIAL/7b49bc9c-6516-4ee6-95d1-d7680852a6fa" },
      { company: "百度", role: "视觉设计实习生", code: "J82714", url: "https://talent.baidu.com/jobs/detail/INTERN/56d1f5e8-54de-461a-86e6-10580d7383ca" },
    ],
  },
  {
    role: "内容运营",
    matches: ["内容运营", "新媒体", "用户运营", "社区运营", "产品运营"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "内容全链路", detail: "具备内容生产、审核、分发、激励或作者运营的完整经验。", signals: ["内容生产", "内容分发", "作者运营", "审核", "选题", "内容策划"], evidence: "补充平台、内容类型、产出数量、负责环节，以及阅读、互动或作者增长结果。" },
      { label: "平台实战", detail: "部分岗位要求小红书、抖音、微信、微博或直播等平台经验。", signals: ["小红书", "抖音", "微信", "微博", "直播"], evidence: "附作品或账号案例，并写清运营周期、发布量、涨粉、播放和转化数据。" },
      { label: "增长与留存", detail: "能通过活动、用户分层或 A/B 测试提升活跃、留存和内容消费。", signals: ["增长", "留存", "活跃", "用户分层", "a/b", "活动策划"], evidence: "补充活动目标、人群、机制、投入和结果，避免只写“策划并执行活动”。" },
      { label: "数据复盘", detail: "能使用 SQL、Excel 或数据看板监控内容与用户指标。", signals: ["sql", "excel", "数据分析", "数据复盘", "看板"], evidence: "写清监控了哪些指标、发现了什么问题，以及复盘后调整了什么。" },
      { label: "商业意识", detail: "部分内容岗位要求理解商业产品、作者收益或内容商业化。", signals: ["商业化", "收益", "投放", "转化", "营收"], evidence: "补充内容如何带来线索、成交、广告收益或成本效率，并标明你的贡献。" },
    ],
    sources: [
      { company: "百度", role: "百度地图内容消费增长运营", code: "J85212", url: "https://talent.baidu.com/jobs/detail/SOCIAL/4733a527-5196-460f-9cb2-b7a5a8ceebba" },
      { company: "百度", role: "内容商业化运营", code: "J82109", url: "https://talent.baidu.com/jobs/detail/SOCIAL/f9467835-fc85-44a3-9157-fd2ce1a42d88" },
    ],
  },
  {
    role: "市场营销",
    matches: ["市场营销", "品牌营销", "数字营销", "市场专员", "品牌专员", "活动策划", "广告投放", "媒介"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "用户与市场洞察", detail: "能够分析目标用户、市场趋势和竞争格局，为营销策略提供依据。", signals: ["用户洞察", "市场调研", "竞品", "行业分析", "目标用户"], evidence: "补充调研对象、数据来源、关键发现，以及发现如何影响营销方案。" },
      { label: "整合营销", detail: "能策划线上线下活动、内容传播和渠道投放并推进执行。", signals: ["活动策划", "整合营销", "渠道", "投放", "传播", "执行"], evidence: "写清目标、人群、创意、渠道、预算或资源，以及活动最终结果。" },
      { label: "效果分析", detail: "具备数据分析意识，能持续优化获客、转化与营销 ROI。", signals: ["roi", "转化", "获客", "数据分析", "复盘"], evidence: "补充曝光、点击、线索、转化、成本或 ROI 中至少两项前后数据。" },
      { label: "内容与媒介", detail: "能产出传播素材，并理解主流媒体、平台或 KOL 的运作逻辑。", signals: ["文案", "媒体", "kol", "公众号", "短视频", "内容"], evidence: "附作品或活动链接，说明传播对象、你的产出和阅读、互动或转化结果。" },
      { label: "AI 营销", detail: "近期校招岗位关注用 AI 内容工具提升生产效率并探索营销新玩法。", signals: ["ai", "aigc", "生成式", "智能营销"], evidence: "说明 AI 用于哪个流程、如何人工审核，以及时间或成本效率变化。" },
    ],
    sources: [
      { company: "百度", role: "北京-市场营销", code: "J100739", url: "https://talent.baidu.com/jobs/detail/GRADUATE/961fd57f-db07-43ac-97af-ee6cad6d0bb5" },
      { company: "百度", role: "北京-产品运营", code: "J100766", url: "https://talent.baidu.com/jobs/detail/GRADUATE/0aa80bfa-a052-4052-afc1-28c38407c13c" },
    ],
  },
  {
    role: "战略 / 行业研究",
    matches: ["战略分析", "行业研究", "咨询", "投资分析", "商业研究", "战略规划"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "研究能力", detail: "能够开展行业研究、市场分析和竞争格局判断，形成高质量报告。", signals: ["行业研究", "市场分析", "竞品", "研究报告", "竞争格局"], evidence: "附一份脱敏研究报告或课程项目，说明研究问题、信息来源、框架与结论。" },
      { label: "结构化分析", detail: "具备严谨的逻辑、数据建模和结构化拆解能力。", signals: ["结构化", "建模", "逻辑", "数据分析", "excel"], evidence: "展示如何把复杂问题拆成假设、指标和验证步骤，并给出最终建议。" },
      { label: "商业判断", detail: "能参与新业务评估、战略规划或投资研究并提供决策支持。", signals: ["商业分析", "新业务", "投资", "战略规划", "决策"], evidence: "可用案例比赛、商业计划或课程研究证明，写清假设、测算和推荐结论。" },
      { label: "报告表达", detail: "能将复杂信息转化为清晰的报告、演示和管理层结论。", signals: ["报告", "ppt", "演示", "汇报", "表达"], evidence: "补充汇报对象、核心结论、采用的框架，以及结论是否被采纳。" },
      { label: "AI 信息效率", detail: "近期岗位要求善用 AI 工具提高信息检索和分析效率。", signals: ["ai", "大模型", "信息检索", "自动化"], evidence: "说明 AI 参与检索、分类或写作的环节，以及你如何核验事实与控制错误。" },
    ],
    sources: [
      { company: "百度", role: "北京-战略分析", code: "J100688", url: "https://talent.baidu.com/jobs/detail/GRADUATE/ab2c6525-f336-4128-8136-91bd7e06b024" },
    ],
  },
  {
    role: "客服 / 用户服务",
    matches: ["客服", "用户服务", "客户服务", "售后", "客户体验"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "问题解决", detail: "能快速理解客户诉求，准确解答、记录、升级并跟踪闭环。", signals: ["客户问题", "工单", "投诉", "跟踪", "闭环", "售后"], evidence: "补充平均响应、首解率、满意度或日均处理量，并写清一个复杂问题案例。" },
      { label: "沟通与共情", detail: "具备清晰表达、情绪识别、投诉处理和客户关系维护能力。", signals: ["沟通", "共情", "投诉", "客户关系", "满意度"], evidence: "可用社团、志愿服务或兼职案例说明你如何处理冲突并获得正向反馈。" },
      { label: "流程与工具", detail: "熟悉客服系统、CRM、知识库或标准工单流程。", signals: ["crm", "知识库", "客服系统", "工单", "流程"], evidence: "写清使用过的工具、处理流程，以及你改进知识库或话术的具体动作。" },
      { label: "反馈分析", detail: "能整理高频问题和用户之声，为产品或服务改进提供输入。", signals: ["用户反馈", "高频问题", "用户之声", "数据整理", "excel"], evidence: "补充反馈样本量、分类方法、发现的问题和被采纳的改进建议。" },
      { label: "服务指标", detail: "岗位会关注响应时长、首解率、满意度和服务质量稳定性。", signals: ["响应时长", "首解率", "满意度", "服务质量", "咨询量"], evidence: "若有相关实践，请量化处理规模和质量指标；没有正式经验可用校园服务案例替代。" },
    ],
    sources: [
      { company: "百度", role: "客服", code: "J93013", url: "https://talent.baidu.com/jobs/detail/SOCIAL/27f6383b-7d0e-4cfa-a1ff-2e56b77b7b6e" },
      { company: "百度", role: "热线客服", code: "J101338", url: "https://talent.baidu.com/jobs/detail/SOCIAL/9ceeabd3-c130-4e2e-8254-d2b083044281" },
    ],
  },
  {
    role: "人力资源 / 行政",
    matches: ["人力资源", "招聘专员", "hr", "hrbp", "人才发展", "员工关系", "薪酬绩效", "行政专员", "行政助理", "行政管理"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "招聘与人才", detail: "能够参与岗位发布、简历筛选、面试协调和招聘渠道运营。", signals: ["招聘", "面试", "简历筛选", "人才", "招聘渠道"], evidence: "可用校园招聘、社团招新或活动招募证明，写清人数、流程、转化和你的职责。" },
      { label: "沟通与协调", detail: "需要与候选人、业务部门和内部团队保持清晰、高效的沟通。", signals: ["沟通", "协调", "候选人", "业务部门", "跨部门"], evidence: "补充一次多方协调案例：目标、冲突、你的推进方式和最终结果。" },
      { label: "数据意识", detail: "能整理招聘或人力数据，分析漏斗并输出支持决策的报告。", signals: ["人力数据", "招聘漏斗", "excel", "数据分析", "报告"], evidence: "补充 Excel 或数据看板案例，说明指标、发现和改进动作。" },
      { label: "制度与保密", detail: "理解人力资源基础流程，具备细致、合规和保密意识。", signals: ["人力资源", "劳动法", "保密", "制度", "档案"], evidence: "可用课程、证书或组织管理案例证明对流程和敏感信息的严谨处理。" },
    ],
    sources: [
      { company: "可达鸭教育集团", role: "2026校招-人力资源方向", code: "2026校招", url: "https://jobcareer.sdu.edu.cn/eweb/servlet/resdownload?id=GuuDGw884riUVCatrRYqZK&type=getfile" },
    ],
  },
  {
    role: "财务 / 财务分析",
    matches: ["财务", "会计", "审计", "税务", "资金", "成本分析", "财务分析"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "财务基础", detail: "掌握会计、财务管理、报表和成本利润等基础知识。", signals: ["会计", "财务管理", "报表", "成本", "利润"], evidence: "补充相关课程、证书或实训项目，并写清你完成的报表、核算或分析任务。" },
      { label: "分析与建模", detail: "能够分析收入、利润率、成本效益并建立定价或财务模型。", signals: ["财务分析", "建模", "利润率", "成本效益", "定价"], evidence: "用课程或比赛案例说明数据来源、模型逻辑、关键假设和结论。" },
      { label: "Excel 与系统", detail: "熟练使用 Excel，部分岗位还要求 ERP、财务系统或数据工具。", signals: ["excel", "erp", "sap", "用友", "金蝶", "power bi"], evidence: "说明使用了哪些函数、透视表、模型或系统流程，最终提升了什么效率。" },
      { label: "严谨与风险", detail: "具备细致、合规、风险意识和清晰的报告表达能力。", signals: ["风险", "合规", "审计", "复核", "报告"], evidence: "补充一次发现数据差异、识别风险或完成复核的案例。" },
    ],
    sources: [
      { company: "虹科", role: "财务专员-定价与财务分析", code: "2026校招", url: "https://career.muc.edu.cn/front/zwxx.jspa?xqzwId=34576&zpxxId=30212" },
    ],
  },
  {
    role: "供应链 / 采购",
    matches: ["供应链", "采购", "物流", "计划专员", "库存管理", "供应商管理"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "计划与库存", detail: "能够结合需求预测制定采购、补货或供应计划，并关注库存周转。", signals: ["需求预测", "采购计划", "补货", "库存", "周转"], evidence: "可用模拟项目或实习说明预测方法、计划逻辑、库存指标和最终结果。" },
      { label: "供应商协同", detail: "能参与供应商开发、询价议价、订单、交付和对账管理。", signals: ["供应商", "询价", "议价", "订单", "交付", "对账"], evidence: "写清采购对象、协作过程、成本或交期问题，以及你推动的解决方案。" },
      { label: "数据与成本", detail: "具备 Excel 数据分析、成本意识和供应链绩效指标理解。", signals: ["excel", "成本", "数据分析", "交付周期", "周转率"], evidence: "补充成本、交期、缺货率或周转率等指标，以及你的分析和改进动作。" },
      { label: "流程优化", detail: "能梳理采购、仓储、配送流程并推动跨部门协作。", signals: ["流程优化", "仓储", "配送", "跨部门", "erp"], evidence: "用流程图或项目案例说明原问题、改进步骤和效率变化。" },
    ],
    sources: [
      { company: "卡特彼勒", role: "供应链规划工程师", code: "R0000370160", url: "https://careers.caterpillar.com/kr/%EC%A7%81%EC%97%85/r0000370160/%E4%BE%9B%E5%BA%94%E9%93%BE%E8%A7%84%E5%88%92%E5%B7%A5%E7%A8%8B%E5%B8%88/" },
      { company: "捷普", role: "EIT Buyer 校园招聘", code: "J2447326", url: "https://careers.jabil.com/jobs.html?jobitem=J2447326" },
    ],
  },
  {
    role: "法务 / 合规",
    matches: ["法务", "法律", "合规", "律师助理", "知识产权", "合同管理"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "法律检索", detail: "能够完成法规、监管政策、案例和行业合规要求的检索与整理。", signals: ["法律检索", "法规", "案例", "监管", "合规"], evidence: "补充一次研究课题或实习任务，说明检索范围、分析框架和输出结论。" },
      { label: "合同与文书", detail: "能协助起草、审查和修改合同、函件或其他法律文件。", signals: ["合同", "法律文书", "审查", "起草", "诉讼"], evidence: "在不泄露敏感信息的前提下，说明文书类型、你发现的风险点和修改建议。" },
      { label: "专业资格", detail: "法律相关专业背景和法律职业资格考试通常是重要门槛或加分项。", signals: ["法考", "法律职业资格", "法学", "律师"], evidence: "明确写出专业、资格考试状态、相关课程和实践方向。" },
      { label: "沟通与严谨", detail: "岗位要求良好的归纳表达、跨团队沟通、保密和细节意识。", signals: ["沟通", "归纳", "保密", "严谨", "团队协作"], evidence: "补充一次协调材料、核查事实或在期限内完成复杂任务的案例。" },
    ],
    sources: [
      { company: "百度", role: "法务实习生", code: "J82283", url: "https://talent.baidu.com/jobs/detail/INTERN/b8692b8c-8fa8-4583-af48-e78e0a3caad3" },
    ],
  },
  {
    role: "销售经理",
    matches: ["销售", "客户经理", "商务拓展", "bd", "大客户"],
    researchedAt: "2026-09-01",
    requirements: [
      { label: "业绩结果", detail: "承担明确销售目标，能够独立完成客户开发和业绩交付。", signals: ["销售额", "业绩", "回款", "成交", "客户开发"], evidence: "补充目标完成率、合同额、回款额、新增客户数或客单价，并说明个人贡献。" },
      { label: "行业与客户洞察", detail: "理解行业现状和客户业务场景，能识别真实需求。", signals: ["行业", "客户需求", "市场分析", "客户洞察"], evidence: "选择一个客户案例，说明业务痛点、决策链、竞争情况及你如何判断机会。" },
      { label: "解决方案销售", detail: "能结合产品能力形成针对性方案并完成汇报、演示或商务谈判。", signals: ["解决方案", "方案汇报", "演示", "商务谈判", "投标"], evidence: "写清方案对象、你的设计和谈判职责、关键异议处理及最终结果。" },
      { label: "全流程推进", detail: "能协调售前、产品和交付团队，推进签约、实施与回款。", signals: ["售前", "产品", "交付", "签约", "回款", "跨部门"], evidence: "补充销售周期、协作团队、卡点、你的推进动作和交付结果。" },
      { label: "SaaS / AI 加分", detail: "云与科技销售岗位偏好 SaaS、订阅制、AI 或云计算经验。", signals: ["saas", "订阅", "ai", "大模型", "云计算"], evidence: "若真实做过，补充产品类型、客户行业、销售模式和可量化业绩。" },
    ],
    sources: [
      { company: "百度", role: "公有云&流量销售经理", code: "J101160", url: "https://talent.baidu.com/jobs/detail/SOCIAL/eb00d739-f0ed-4f25-ba57-6006b1927b25" },
      { company: "百度", role: "直客销售", code: "J65729", url: "https://talent.baidu.com/jobs/detail/SOCIAL/d9be0bf1-a4c4-4009-b8eb-7b2c398dba1d" },
    ],
  },
];

function researchTarget(target: string, form: FormData) {
  const normalized = target.toLowerCase().replace(/\s+/g, "");
  const profile = MARKET_PROFILES.map((item) => ({
    item,
    score: Math.max(0, ...item.matches.filter((match) => normalized.includes(match.toLowerCase().replace(/\s+/g, ""))).map((match) => match.length)),
  })).sort((a, b) => b.score - a.score)[0];
  if (!profile?.score) return { profile: null, requirements: [] as JobRequirement[] };
  const source = `${form.material} ${form.skills} ${form.education}`.toLowerCase().replace(/\s+/g, "");
  const requirements = profile.item.requirements.map((item) => ({ ...item, covered: item.signals.some((signal) => source.includes(signal.toLowerCase().replace(/\s+/g, ""))) }));
  return { profile: profile.item, requirements };
}

const LIVE_REQUIREMENT_GUIDANCE = [
  { label: "技术与工具", terms: ["sql", "python", "java", "c++", "excel", "figma", "cad", "软件", "工具", "系统"], evidence: "用课程、项目或工作中的真实任务证明：写清使用的工具、解决的问题、你的操作和最终结果。" },
  { label: "专业能力", terms: ["专业", "知识", "理论", "能力", "技能", "经验"], evidence: "选择最相关的一段真实经历，说明任务背景、你采用的方法，以及可验证的作品或结果。" },
  { label: "数据分析", terms: ["数据", "分析", "指标", "统计", "报表"], evidence: "补充一次真实分析：数据来源、分析方法、关键发现，以及结论推动的具体动作。" },
  { label: "项目落地", terms: ["项目", "推动", "落地", "执行", "交付", "协同"], evidence: "写清项目目标、你的职责、协作对象、关键动作、交付周期和量化成果。" },
  { label: "沟通协作", terms: ["沟通", "协调", "团队", "合作", "表达"], evidence: "补一段协作案例：涉及哪些角色、出现过什么分歧、你如何推进并达成结果。" },
  { label: "用户与业务", terms: ["用户", "客户", "业务", "市场", "销售"], evidence: "补充你接触的用户或客户、发现的问题、采取的行动及业务结果；应届生可使用调研、比赛或社团项目。" },
  { label: "学习与责任", terms: ["学习", "责任", "主动", "抗压", "自驱"], evidence: "不要只写性格词。用一次主动学习或承担困难任务的经历，说明行动、周期和最终产出。" },
];

const HARD_SKILL_TERMS = ["SQL", "Python", "Java", "C++", "Excel", "Figma", "CAD", "SolidWorks", "PyTorch", "PaddlePaddle", "UGC", "PVE", "PVP", "Linux", "React", "Vue", "Axure", "Photoshop"];

function specificLiveEvidence(detail: string, fallback: string, candidateType: CandidateType) {
  const studentProof = "用课程项目、比赛、实习或个人作品证明";
  const workProof = "在最近一段相关工作经历中证明";
  const proof = candidateType === "student" ? studentProof : workProof;
  const skills = HARD_SKILL_TERMS.filter((term) => detail.toLowerCase().includes(term.toLowerCase())).slice(0, 3);
  if (/学历|本科|硕士|专业/.test(detail)) return "在教育背景中明确写学校、专业、学历和时间；若专业不完全匹配，用最相关的课程、证书或项目补证，不要改写学历。";
  if (/\d+年以上|工作经验|行业经验/.test(detail)) return candidateType === "student"
    ? "不要虚构工作年限。选择 1—2 个同类项目，写清你的独立职责、成品链接和测试结果，用作品降低经验门槛。"
    : "在最近一段相关经历的标题或首条要点中写明负责年限、业务场景、职责范围和最终结果。";
  if (skills.length) return `在“专业技能”中写明 ${skills.join("、")}；再用一条经历说明你用这些工具完成了什么、处理了多大规模、结果如何。`;
  if (/作品|案例|上线|项目/.test(detail)) return `${proof}：给出项目名称、你的独立贡献、可查看的成品或链接，以及上线、验收或评测结果。`;
  if (/数据|分析|指标|统计/.test(detail)) return `${proof}：写明数据来源、样本量、分析方法、发现的问题，以及建议实施后的指标变化。`;
  if (/沟通|协同|团队|合作/.test(detail)) return `${proof}：点名协作角色、关键分歧、你的推进动作、交付时间和最终结论。`;
  return `${proof}。直接对应这条要求写一个事实：你在什么场景做了什么、交付了什么、结果是多少。${fallback}`;
}

function buildLiveRequirements(lines: string[], form: FormData, candidateType: CandidateType): JobRequirement[] {
  const material = `${form.material} ${form.skills} ${form.education}`.toLowerCase().replace(/\s+/g, "");
  return lines.map((detail, index) => {
    const normalized = detail.toLowerCase().replace(/\s+/g, "");
    const guidance = LIVE_REQUIREMENT_GUIDANCE.find((item) => item.terms.some((term) => normalized.includes(term))) ?? {
      label: `岗位要求 ${index + 1}`,
      terms: [] as string[],
      evidence: "用一段真实项目、课程或工作实践说明你如何满足这项要求，并补充作品、数据或结果作为证据。",
    };
    const signals = guidance.terms.filter((term) => normalized.includes(term));
    const sourceLabel = detail.match(/^([^：:；;，,]{2,10})[：:]/)?.[1]?.trim();
    return {
      label: sourceLabel || guidance.label,
      detail,
      signals,
      evidence: specificLiveEvidence(detail, guidance.evidence, candidateType),
      covered: signals.length > 0 && signals.some((signal) => material.includes(signal)),
    };
  });
}

const FALLBACK_ROLE_FAMILIES = [
  { matches: ["机械", "制造", "结构", "工艺", "设备"], label: "工程设计与工具", detail: "围绕岗位名称补充设计、制图、工艺或设备相关能力，并说明使用过的软件与标准。", signals: ["cad", "solidworks", "制图", "工艺", "设备", "设计"], evidence: "选择一项真实设计或制造任务，写清技术要求、使用工具、关键取舍、交付物和质量结果。" },
  { matches: ["教师", "教育", "培训", "教研"], label: "教学设计与效果", detail: "证明你能设定学习目标、设计教学过程，并根据反馈改进效果。", signals: ["教学", "课程", "培训", "教案", "学生", "学习"], evidence: "补充一次课程、辅导或培训经历：对象、目标、你的教学方法以及成绩或反馈变化。" },
  { matches: ["医生", "护士", "医疗", "药剂", "康复"], label: "专业规范与实践", detail: "突出专业训练、资质、规范操作和对质量安全的重视。", signals: ["资格", "执业", "临床", "护理", "患者", "规范"], evidence: "只写真实资质与实践，说明服务对象、遵循的规范、你的操作以及质量或效率结果。" },
  { matches: ["建筑", "土木", "施工", "造价", "工程管理"], label: "工程交付能力", detail: "体现图纸、进度、成本、质量或现场协同中的具体职责。", signals: ["图纸", "施工", "造价", "进度", "成本", "质量"], evidence: "选择一个真实工程或课程项目，补充项目规模、你的职责、使用工具、关键问题和交付结果。" },
  { matches: ["采购", "物流", "仓储", "供应链"], label: "供应与履约", detail: "体现供应商、库存、采购成本、交付时效或异常处理能力。", signals: ["采购", "库存", "供应商", "物流", "交付", "成本"], evidence: "补充一次采购或履约案例：规模、异常、你的协调动作，以及成本、时效或库存指标变化。" },
  { matches: ["编辑", "记者", "文案", "出版", "编导"], label: "内容生产与质量", detail: "证明选题、采编、写作、审核或内容传播中的完整产出能力。", signals: ["选题", "写作", "编辑", "内容", "采访", "阅读"], evidence: "选择一件代表作品，写清受众、你的独立贡献、修改过程和阅读量、采用情况或作品链接。" },
  { matches: ["游戏", "策划"], label: "玩法与体验设计", detail: "体现系统、玩法、关卡、数值或用户体验方面的设计与验证能力。", signals: ["玩法", "关卡", "数值", "游戏", "原型", "测试"], evidence: "补充一个可展示的策划案例：目标玩家、核心机制、你的设计文档、测试反馈和迭代结果。" },
  { matches: ["行政", "秘书", "助理", "文员"], label: "组织与执行", detail: "突出日程、文档、会议、流程与多任务协调中的准确性和效率。", signals: ["日程", "文档", "会议", "流程", "协调", "行政"], evidence: "写一项你独立负责的组织任务，补充服务对象、工作量、处理方法和效率或准确率结果。" },
];

const FALLBACK_PROOF_DETAILS = [
  { matches: ["机械", "制造", "结构", "工艺", "设备"], artifact: "图纸、BOM、工艺方案或设备改进记录", metrics: "加工精度、良率、故障率、成本、交期" },
  { matches: ["教师", "教育", "培训", "教研"], artifact: "教案、课程大纲、课件或学习任务设计", metrics: "覆盖人数、完课率、成绩变化、满意度、续班率" },
  { matches: ["医生", "护士", "医疗", "药剂", "康复"], artifact: "真实资质、规范操作记录或实践案例", metrics: "服务人数、处理时长、准确率、差错率、满意度" },
  { matches: ["建筑", "土木", "施工", "造价", "工程管理"], artifact: "图纸、算量文件、施工方案或进度计划", metrics: "项目规模、造价偏差、工期、返工率、签证金额" },
  { matches: ["采购", "物流", "仓储", "供应链"], artifact: "询报价表、供应商评估、库存方案或异常处理记录", metrics: "采购成本、准时交付率、库存周转、缺货率、异常关闭时长" },
  { matches: ["编辑", "记者", "文案", "出版", "编导"], artifact: "文章、采访稿、脚本、选题方案或作品链接", metrics: "阅读量、完播率、采用率、发布频次、互动率" },
  { matches: ["游戏", "策划"], artifact: "策划案、关卡文档、数值表、原型或试玩链接", metrics: "测试人数、关卡通过率、留存、付费、问题关闭率" },
  { matches: ["行政", "秘书", "助理", "文员"], artifact: "会议纪要、流程表、日程方案或标准化模板", metrics: "处理量、准时率、错误率、响应时长、节省工时" },
];

function buildFallbackRequirements(target: string, form: FormData, candidateType: CandidateType): JobRequirement[] {
  const source = `${form.material} ${form.skills} ${form.education}`.toLowerCase().replace(/\s+/g, "");
  const family = FALLBACK_ROLE_FAMILIES.find((item) => item.matches.some((match) => target.includes(match)));
  const proofDetail = FALLBACK_PROOF_DETAILS.find((item) => item.matches.some((match) => target.includes(match))) ?? {
    artifact: `与${target}直接相关的方案、作品、报告或交付物`,
    metrics: "任务量、完成时效、质量、采用情况、用户或客户反馈",
  };
  const proofPrefix = candidateType === "student" ? "可使用课程项目、比赛、校园实践或个人作品。" : "选择最相关的一段真实工作或项目经历。";
  const resumeSection = candidateType === "student" ? "项目与校园实践" : "核心经历";
  const requirements: MarketRequirement[] = [
    family ?? {
      label: `${target}核心能力`,
      detail: `围绕“${target}”最常见的核心任务，证明你具备相关知识、工具或实践能力。`,
      signals: target.split(/[\s/·—_-]+/).filter((item) => item.length >= 2),
      evidence: `${proofPrefix}写清任务背景、使用的方法或工具、你的独立贡献和可验证结果。`,
    },
    { label: `${target}代表案例`, detail: `用一项完整案例证明你做过${target}的核心任务。`, signals: ["负责", "主导", "完成", "交付", "上线", "项目"], evidence: `在“${resumeSection}”新增一个案例，附上${proofDetail.artifact}；按“任务—你的动作—交付物—结果”写 3 条。` },
    { label: `${target}成果指标`, detail: `用该岗位真正关注的指标证明结果，而不是只写“参与”或“负责”。`, signals: ["提升", "降低", "增长", "%", "获得", "完成", "优化"], evidence: `从“${proofDetail.metrics}”中选择 1—2 个你确实有的数据，写出改善前后或最终值；没有数据时可写验收、采用或反馈结果。` },
  ];
  return requirements.map((item) => ({ ...item, covered: item.signals.some((signal) => source.includes(signal.toLowerCase().replace(/\s+/g, ""))) }));
}

const PLAIN_LANGUAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bUGC\b/gi, "用户自己创作的内容"], [/\bPVE\b/gi, "玩家对电脑的玩法"], [/\bPVP\b/gi, "玩家对战玩法"],
  [/\bBOM\b/gi, "零部件清单"], [/\bROI\b/gi, "投入产出比"], [/\bSQL\b/gi, "数据库查询工具 SQL"],
  [/\bPLG\b/gi, "靠产品本身吸引和留住用户"], [/\bSEO\b/gi, "让内容更容易被搜索到"],
  [/\bLLM\b/gi, "大语言模型"], [/\bAgent\b/gi, "能自己分步骤办事的智能助手"],
  [/\bRAG\b/gi, "先查资料再回答的技术"], [/\bSFT\b/gi, "用示例教模型回答"], [/\bRLHF\b/gi, "根据人工反馈改进模型"],
  [/\bSaaS\b/gi, "企业按月或按年订阅的软件"], [/A\s*\/\s*B\s*(?:实验|测试)?/gi, "两个方案对比测试"],
  [/漏斗分析/g, "逐步分析用户从进入到完成目标的过程"], [/归因分析/g, "找出结果变化的原因"],
  [/显著性/g, "确认差异不是偶然"], [/评测集/g, "用来测试效果的一组题目或数据"], [/基线/g, "改进前的数据"],
  [/量化/g, "用数字说明"], [/交付物/g, "最后做出来的东西"], [/职责边界/g, "你具体负责到哪一步"],
  [/复盘/g, "事后总结"], [/落地/g, "真正做出来"], [/协同/g, "一起配合"],
];

function plainAnalysisText(value: string) {
  return PLAIN_LANGUAGE_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function polishBullet(value: string) {
  let line = value.trim().replace(/^[·•\-—\d.、)）\s]+/, "").replace(/[。；;]+$/, "");
  ACTION_REPLACEMENTS.forEach(([pattern, replacement]) => { line = line.replace(pattern, replacement); });
  line = line
    .replace(/^参加/, "参与")
    .replace(/^访谈了?/, "访谈")
    .replace(/^整理了?/, "梳理")
    .replace(/^写了?/, "撰写")
    .replace(/^用了?/, "使用")
    .replace(/发现了?/g, "识别出")
    .replace(/做出(?:了)?/g, "完成")
    .replace(/弄清(?:了)?/g, "明确");
  if (!line) return "";
  const expanded = expandExperienceBullet(line);
  return expanded + "。";
}

function expandExperienceBullet(value: string) {
  let line = value;
  const originalLength = line.length;

  if (/使用\s*Excel\s*整理[^，,。]+[，,]\s*访谈/.test(line)) {
    line = line
      .replace(/使用\s*Excel\s*整理([^，,。]+)/, "使用 Excel 对$1进行整理与汇总")
      .replace(/访谈\s*(\d+\s*名?[^，,。]*)/, "访谈 $1并归纳反馈");
    return `${line}，为提炼主要问题和形成后续报告提供依据`;
  }
  if (/可视化|报告/.test(line) && /汇报|展示|答辩/.test(line)) {
    return line
      .replace(/^完成/, "基于前期信息整理，完成")
      .replace(/并向([^，,。]+)汇报/, "，提炼重点信息并向$1汇报")
      .replace(/并进行([^，,。]+汇报)/, "，提炼重点信息并完成$1") + "，让项目过程与结论得到清晰呈现";
  }
  if (/访谈|问卷|调研/.test(line) && !/归纳|梳理|总结|分析/.test(line)) {
    return `${line}，记录并归纳共性反馈，为后续问题判断和方案调整提供依据`;
  }
  if (/原型|页面设计|交互设计/.test(line) && !/需求转化|评审|验证/.test(line)) {
    return `${line}，将已梳理的需求转化为可讨论的页面与交互方案，便于团队评审和后续实现`;
  }
  if (/(?:使用|运用).*?(?:Excel|SQL|Python|SPSS|Tableau|Power BI)/i.test(line) && /数据|整理|分析|统计|查询/.test(line) && !/汇总|结论|支持/.test(line)) {
    return `${line}，对关键信息进行分类汇总，为后续分析和结论呈现提供支持`;
  }
  if (/组织|协调|协同|推进/.test(line) && !/节点|分工|进度|落地/.test(line)) {
    return `${line}，明确任务分工并跟进关键节点，保证各项工作有序衔接`;
  }
  if (/文案|选题|内容/.test(line) && !/用户|数据|反馈|发布/.test(line)) {
    return `${line}，结合目标受众调整表达重点，并完成内容整理与发布准备`;
  }
  if (/开发|实现|编程|代码/.test(line) && !/测试|功能|交付|上线/.test(line)) {
    return `${line}，将方案转化为可运行的功能，并配合完成基础检查与问题调整`;
  }
  if (originalLength < 24 && /^(负责|参与|协助|完成|主导)/.test(line)) {
    return `${line}，梳理具体任务并形成可检查的阶段性成果`;
  }
  return line;
}

function isGenericExperienceTitle(value: string) {
  return /^(?:项目与校园实践|项目实践|校园实践|相关经历|工作实践)(?:\s*\d+)?$/i.test(value.trim());
}

function inferExperienceTitle(block: string, candidateType: CandidateType) {
  const match = block.match(/[^，。；;\n]{2,28}(?:小程序|系统|平台|项目|比赛|竞赛|活动|社团|课程设计|毕业设计|作品)/)?.[0]
    ?.replace(/^(参与|参加|负责|完成)/, "").trim();
  if (match && !isGenericExperienceTitle(match)) return match;
  const topicRules: Array<[RegExp, string]> = [
    [/校园.*问卷|问卷.*校园/, "校园问卷调研与数据分析"],
    [/问卷|访谈|调研/, "调研与需求分析"],
    [/Excel|SQL|数据|统计|可视化/, "数据整理与分析"],
    [/原型|需求分析|产品方案/, "产品设计实践"],
    [/开发|编程|代码|功能实现/, "功能开发实践"],
    [/文案|公众号|小红书|内容运营|选题/, "内容运营实践"],
    [/活动|社团|志愿/, "校园活动实践"],
  ];
  const topic = topicRules.find(([pattern]) => pattern.test(block));
  if (topic) return topic[1];
  const firstAction = block.split(/[，。；;\n]/).map((item) => item.trim()).find((item) => item && !isGenericExperienceTitle(item));
  const conciseAction = firstAction?.replace(/^(参与|参加|负责|完成|主导|协助)/, "").trim();
  if (conciseAction && conciseAction.length >= 2 && conciseAction.length <= 24) return conciseAction;
  return candidateType === "student" ? "校园实践" : "相关实践";
}

function expandSkill(value: string): ResumeSkill {
  const raw = value.trim();
  const rules: Array<[RegExp, string, string]> = [
    [/^(?:(?:大学)?英语)?四六级$|CET[-\s]?4\s*[和及、/]\s*CET[-\s]?6/i, "大学英语四、六级（CET-4 / CET-6）", "通过大学英语四、六级考试，具备英文资料阅读、信息检索与基础书面沟通能力，可用于阅读岗位资料、产品文档及日常学习材料。"],
    [/(?:大学英语)?六级|CET[-\s]?6/i, "大学英语六级（CET-6）", "通过大学英语六级考试，具备英文资料阅读、信息检索与基础书面沟通能力，可用于阅读岗位资料、产品文档及日常学习材料。"],
    [/(?:大学英语)?四级|CET[-\s]?4/i, "大学英语四级（CET-4）", "通过大学英语四级考试，具备英文资料阅读和基础书面沟通能力，可用于日常资料检索与学习。"],
    [/计算机.*二级|NCRE.*2/i, "全国计算机等级考试二级", "已通过全国计算机等级考试二级，对计算机基础知识和相应考试科目具备系统认识；具体科目以证书信息为准。"],
    [/普通话/i, raw, "已通过普通话水平测试，具备规范、清晰的普通话表达基础；具体等级以证书信息为准。"],
    [/教师资格/i, raw, "已取得相应教师资格，具备教学基础知识与规范意识；适用学段和学科以证书信息为准。"],
    [/初级会计|会计.*证/i, "初级会计专业技术资格", "具备会计核算、财务报表和基础财务规范知识，可支持日常账务处理与财务资料整理。"],
    [/基金.*从业/i, "基金从业资格", "具备基金行业基础知识、业务规范与合规意识，可支持相关资料整理和基础业务工作。"],
    [/证券.*从业/i, "证券从业资格", "具备证券市场基础知识、业务规范与合规意识，可支持相关资料整理和基础业务工作。"],
    [/^Excel$/i, "Excel", "能够使用 Excel 完成数据录入、整理、常用计算与图表呈现，可用于问卷或基础业务数据的汇总分析。"],
    [/^SQL$/i, "SQL", "能够使用 SQL 完成基础数据查询、条件筛选与汇总统计，可支持业务取数和初步分析。"],
    [/^(Figma|Axure)$/i, raw, "能够使用该工具完成页面原型、流程与交互方案表达，可用于需求沟通、方案评审和开发协作。"],
    [/^(Word|WPS|Office)$/i, raw, "能够使用办公软件完成文档排版、信息整理和基础表格处理，支持日常资料制作与协作。"],
    [/^(PowerPoint|PPT)$/i, "PowerPoint", "能够完成演示文稿的结构梳理、页面排版与重点信息呈现，可支持项目汇报和方案展示。"],
    [/^(SPSS|Tableau|Power BI)$/i, raw, "能够使用该工具完成基础数据整理、分析或可视化呈现，支持从数据中提炼重点信息。"],
    [/^(Photoshop|PS)$/i, "Photoshop", "能够完成基础图片处理、尺寸调整与视觉素材制作，可支持内容发布和页面设计。"],
    [/^(Premiere|PR|剪映)$/i, raw, "能够完成基础视频剪辑、素材整理与字幕处理，可支持短视频或宣传内容制作。"],
    [/^Python$/i, "Python", "能够使用 Python 进行基础数据处理、自动化脚本编写与功能开发，提升重复任务的处理效率。"],
    [/^(Java|C\+\+|JavaScript|TypeScript)$/i, raw, "具备相应编程语言基础，能够用于程序逻辑编写、功能实现与问题排查。"],
    [/^(React|Vue)$/i, raw, "能够使用该框架完成前端页面与基础交互功能开发，并配合接口完成数据展示。"],
    [/^(Git|GitHub)$/i, raw, "能够进行代码版本管理、变更记录与基础协作，支持个人或团队开发过程。"],
    [/数据分析/i, raw, "能够围绕问题整理数据、比较变化并提炼结论，为汇报或业务判断提供依据。"],
    [/用户研究|用户调研/i, raw, "能够通过访谈、问卷等方式收集信息，整理共性反馈并形成用户需求判断。"],
    [/需求分析/i, raw, "能够梳理业务目标、用户问题和功能需求，并将零散信息整理为清晰的需求说明。"],
    [/活动策划/i, raw, "能够围绕活动目标梳理流程、人员分工与执行事项，并跟进现场或线上活动推进。"],
    [/内容运营|文案/i, raw, "能够结合目标受众完成选题、内容整理和文案表达，并根据反馈持续调整。"],
    [/驾驶证/i, raw, "持有相应机动车驾驶证，具备合法驾驶资质；具体准驾车型以证件信息为准。"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(raw));
  if (matched) return { name: matched[1], detail: matched[2] };
  if (/证|资格|等级|认证/.test(raw)) return { name: raw, detail: `已将${raw}作为专业证明列入简历，可体现相关知识或能力基础；具体等级、成绩与取得时间以证书信息为准。` };
  return { name: raw, detail: "" };
}

function parseSkills(value: string) {
  const normalized = value
    .replace(/(?:(?:大学)?英语)?四级\s*(?:和|及|与|\/|&|＋|\+)\s*(?:(?:大学)?英语)?六级/gi, "英语四六级")
    .replace(/CET[-\s]?4\s*(?:和|及|与|\/|&|＋|\+)\s*CET[-\s]?6/gi, "英语四六级");
  const parts = normalized.split(/[、,，|｜\n]/).map((item) => item.trim()).filter(Boolean);
  const isExactCET4 = (item: string) => /^(?:(?:(?:大学)?英语)?四级(?:\s*[（(]?CET[-\s]?4[）)]?)?|CET[-\s]?4)$/i.test(item);
  const isExactCET6 = (item: string) => /^(?:(?:(?:大学)?英语)?六级(?:\s*[（(]?CET[-\s]?6[）)]?)?|CET[-\s]?6)$/i.test(item);
  if (parts.some(isExactCET4) && parts.some(isExactCET6)) {
    return ["英语四六级", ...parts.filter((item) => !isExactCET4(item) && !isExactCET6(item))];
  }
  return parts;
}

function inferDemonstratedAbilities(material: string) {
  const rules: Array<[RegExp, string]> = [
    [/调研|访谈|问卷|需求/, "调研与需求梳理"],
    [/原型|设计|方案/, "方案与原型设计"],
    [/数据|分析|SQL|Excel|统计/, "数据整理与分析"],
    [/组织|协调|协同|团队|推进/, "团队协作与项目推进"],
    [/内容|文案|编辑|选题/, "内容策划与表达"],
    [/开发|编程|代码|上线|实现/, "开发与功能实现"],
    [/用户|客户|服务|沟通/, "用户沟通与服务"],
  ];
  return rules.filter(([pattern]) => pattern.test(material)).map(([, label]) => label).slice(0, 3);
}

function generateDraft(form: FormData, candidateType: CandidateType): ResumeDraft {
  const sourceBlocks = form.material.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const blocks = sourceBlocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    const hasHeading = /[｜|]/.test(firstLine) || (lines.length > 1 && firstLine.length <= 36 && !/[。；;]/.test(firstLine));
    const enteredHeading = hasHeading ? (lines.shift() ?? "") : "";
    const heading = !enteredHeading || isGenericExperienceTitle(enteredHeading)
      ? inferExperienceTitle(lines.join("\n") || block, candidateType)
      : enteredHeading;
    const headingParts = heading.split(/[｜|]/).map((x) => x.trim()).filter(Boolean);
    const title = headingParts.slice(0, 2).join("｜") || heading;
    const meta = headingParts.slice(2).join("｜");
    const bullets = lines.flatMap((line) => line.split(/(?<=[。；;])/)).map(polishBullet).filter(Boolean).slice(0, 5);
    return { title, meta, bullets };
  });

  const rawSkills = parseSkills(form.skills);
  const skills = rawSkills.map(expandSkill);
  const education = form.education.split("\n").map((x) => x.trim()).filter(Boolean);
  const capabilityText = skills.slice(0, 4).map((skill) => skill.name).join("、");
  const experienceNames = blocks.map((block) => block.title.split("｜")[0]).filter((name) => name && !isGenericExperienceTitle(name) && !/^(校园实践|相关实践)$/.test(name)).slice(0, 2);
  const demonstratedAbilities = inferDemonstratedAbilities(form.material);
  const summarySentences = [candidateType === "student" ? `应届生，求职方向为${form.target || "相关岗位"}。` : `求职方向为${form.target || "相关岗位"}。`];
  if (capabilityText) summarySentences.push(`具备${capabilityText}等工具与证书基础，能够将所学知识用于实际任务。`);
  const firstExperience = blocks[0];
  const firstExperienceName = experienceNames[0];
  const firstEvidence = firstExperience?.bullets[0]?.replace(/[。；;]+$/, "");
  if (firstEvidence) {
    summarySentences.push(`${firstExperienceName ? `在${firstExperienceName}中，` : "在实践中，"}${firstEvidence}${demonstratedAbilities.length ? `，体现了${demonstratedAbilities.join("、")}能力` : ""}。`);
  } else if (experienceNames.length) {
    summarySentences.push(`实践内容包括${experienceNames.join("、")}，并形成了可用于求职展示的具体经历。`);
  }
  const summary = summarySentences.join("");
  return { summary, blocks, education, skills };
}

function plainResume(identity: ResumeIdentity, draft: ResumeDraft, candidateType: CandidateType) {
  const experience = draft.blocks.map((block) => `${block.title}${block.meta ? `｜${block.meta}` : ""}\n${block.bullets.map((x) => `· ${x}`).join("\n")}`).join("\n\n");
  const skills = draft.skills.map((skill) => `${skill.name}${skill.detail ? `，${skill.detail}` : ""}`).join("\n");
  return `${identity.name || "姓名"}\n${identity.target || "目标岗位"}\n${identity.contact}\n\n个人简介\n${draft.summary}${experience ? `\n\n${candidateType === "student" ? "项目与校园实践" : "核心经历"}\n${experience}` : ""}${draft.education.length ? `\n\n教育背景\n${draft.education.join("\n")}` : ""}${skills ? `\n\n专业技能\n${skills}` : ""}`;
}

export default function Home() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [candidateType, setCandidateType] = useState<CandidateType>("student");
  const [stage, setStage] = useState<"edit" | "working" | "preview">("edit");
  const [template, setTemplate] = useState<TemplateName>("classic");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [liveResearch, setLiveResearch] = useState<LiveResearchState>({ status: "idle", target: "" });
  const [editedDraft, setEditedDraft] = useState<ResumeDraft | null>(null);
  const [editedIdentity, setEditedIdentity] = useState<ResumeIdentity | null>(null);
  const draft = useMemo(() => generateDraft(form, candidateType), [form, candidateType]);
  const resumeDraft = editedDraft ?? draft;
  const resumeIdentity = editedIdentity ?? { name: form.name || "你的姓名", target: form.target || "目标岗位", contact: [form.contact, form.city].filter(Boolean).join(" · ") || "邮箱 · 手机号 · 城市" };
  const marketResearch = useMemo(() => researchTarget(form.target, form), [form]);
  const matchingLiveResearch = liveResearch.status === "success" && liveResearch.target === form.target.trim() ? liveResearch.data : null;
  const verifiedProfile: MarketProfile | null = marketResearch.profile ?? (matchingLiveResearch ? {
    role: matchingLiveResearch.target,
    matches: [matchingLiveResearch.target],
    researchedAt: matchingLiveResearch.researchedAt,
    requirements: [],
    sources: matchingLiveResearch.sources,
  } : null);
  const verifiedRequirements = marketResearch.profile
    ? marketResearch.requirements
    : matchingLiveResearch ? buildLiveRequirements(matchingLiveResearch.requirements, form, candidateType) : [];
  const usingFallback = !verifiedProfile && (liveResearch.status === "not_found" || liveResearch.status === "error") && liveResearch.target === form.target.trim();
  const fallbackRequirements = usingFallback ? buildFallbackRequirements(form.target.trim(), form, candidateType) : [];
  const activeProfile: MarketProfile | null = verifiedProfile ?? (usingFallback ? {
    role: form.target.trim(), matches: [form.target.trim()], researchedAt: "", requirements: fallbackRequirements, sources: [],
  } : null);
  const jobRequirements = usingFallback ? fallbackRequirements : verifiedRequirements;
  const priorityRequirements = [...jobRequirements].sort((a, b) => Number(a.covered) - Number(b.covered)).slice(0, 3);
  const coveredCount = jobRequirements.filter((item) => item.covered).length;
  const jobMatch = jobRequirements.length ? Math.round(coveredCount / jobRequirements.length * 100) : 0;

  const update = (key: keyof FormData, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const loadSample = () => { setForm(candidateType === "student" ? STUDENT_SAMPLE_FORM : SAMPLE_FORM); setEditedDraft(null); setEditedIdentity(null); setStage("edit"); };
  const hasStudentMaterial = Boolean(form.material.trim() || form.education.trim() || form.skills.trim());
  const canGenerate = Boolean(form.target.trim() && (candidateType === "student" ? hasStudentMaterial : form.material.trim()));
  const researchLiveRole = async (target: string) => {
    setLiveResearch({ status: "loading", target });
    try {
      const response = await fetch("/api/role-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, candidateType }),
      });
      const payload = await response.json() as LiveResearchPayload | { status?: string; error?: string };
      if (response.ok && payload.status === "success") {
        setLiveResearch({ status: "success", target, data: payload as LiveResearchPayload });
      } else if (response.ok && payload.status === "not_found") {
        setLiveResearch({ status: "not_found", target, message: "已实时搜索公开招聘，但没有找到与这个名称直接匹配且包含完整任职要求的在招岗位。" });
      } else {
        setLiveResearch({ status: "error", target, message: "实时岗位查询暂时不可用，请稍后重试。" });
      }
    } catch {
      setLiveResearch({ status: "error", target, message: "实时岗位查询暂时不可用，请稍后重试。" });
    }
  };
  const generate = () => {
    if (!canGenerate) return;
    setEditedDraft({ ...draft, blocks: draft.blocks.map((block) => ({ ...block, bullets: [...block.bullets] })), education: [...draft.education], skills: draft.skills.map((skill) => ({ ...skill })) });
    setEditedIdentity({ name: form.name || "你的姓名", target: form.target || "目标岗位", contact: [form.contact, form.city].filter(Boolean).join(" · ") || "邮箱 · 手机号 · 城市" });
    setStage("working");
    window.setTimeout(() => {
      setStage("preview");
      window.setTimeout(() => document.querySelector("#preview")?.scrollIntoView({ behavior: "smooth" }), 80);
    }, 450);
  };
  const copyAll = async () => {
    await navigator.clipboard.writeText(plainResume(resumeIdentity, resumeDraft, candidateType));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const downloadPdf = async () => {
    const sheet = document.querySelector<HTMLElement>(".resume-sheet");
    if (!sheet || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(sheet, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = canvas.height * pageWidth / canvas.width;
      const image = canvas.toDataURL("image/jpeg", 0.96);
      let remaining = imageHeight;
      let offset = 0;
      pdf.addImage(image, "JPEG", 0, offset, pageWidth, imageHeight, undefined, "FAST");
      remaining -= pageHeight;
      while (remaining > 0) {
        offset = remaining - imageHeight;
        pdf.addPage();
        pdf.addImage(image, "JPEG", 0, offset, pageWidth, imageHeight, undefined, "FAST");
        remaining -= pageHeight;
      }
      pdf.save(`${resumeIdentity.name.trim() || "我的"}-${resumeIdentity.target.trim() || "求职"}简历.pdf`);
    } catch {
      setExportError("PDF 生成失败，请稍后重试或先使用“复制文字”。");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main>
      <nav className="nav shell" aria-label="主导航">
        <a className="brand" href="#top"><span className="brand-mark">W</span><span>ResumeWeave</span></a>
        <div className="nav-steps" aria-label="制作步骤"><span className={stage === "edit" ? "active" : "done"}>1 填写素材</span><i /><span className={stage === "preview" ? "active" : ""}>2 生成简历</span></div>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span /> Experience in. Resume ready.</div>
        <h1>把零散经历，织成一份<em>好简历</em>。</h1>
        <p className="hero-copy">无论你是应届生还是已有工作经验，只需写下目标岗位和做过的事情。我们会直接整理措辞、突出成果，生成一份结构完整的简历。</p>
        <div className="trust-row"><span>直接写成完整简历</span><i /><span>自动整理表达</span><i /><span>真实不杜撰</span><i /><span>可下载 PDF</span></div>
      </section>

      <section className="builder shell" aria-label="简历生成表单">
        <header className="builder-heading">
          <div><span className="section-number">01</span><h2>选择你的求职阶段</h2></div>
          <button className="sample-button" type="button" onClick={loadSample}>不知道怎么写？填入{candidateType === "student" ? "应届生" : "职场"}示例</button>
        </header>

        <div className="candidate-switch" aria-label="求职身份">
          <button className={candidateType === "student" ? "active" : ""} type="button" onClick={() => setCandidateType("student")}><b>应届生 / 暂无工作经历</b><span>用项目、课程和校园实践证明能力</span></button>
          <button className={candidateType === "experienced" ? "active" : ""} type="button" onClick={() => setCandidateType("experienced")}><b>有工作或实习经历</b><span>用职责、行动和业务结果证明能力</span></button>
        </div>

        <div className="identity-grid">
          <div className="field"><label htmlFor="name">姓名</label><input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="你的姓名" /></div>
          <div className="field"><label htmlFor="target">目标岗位 <small>可自由填写</small></label><input id="target" value={form.target} onChange={(e) => update("target", e.target.value)} placeholder="例如：Java 后端开发工程师" /></div>
          <div className="field"><label htmlFor="contact">联系方式</label><input id="contact" value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder="邮箱 · 手机号" /></div>
          <div className="field"><label htmlFor="city">所在城市</label><input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="例如：上海" /></div>
        </div>

        <div className="role-example-row"><b>岗位示例，也可直接输入其他岗位</b>{ROLE_EXAMPLES.map((role) => <button type="button" onClick={() => update("target", role)} key={role}>{role}</button>)}</div>

        <div className="material-grid">
          <div className="material-main">
            <div className="material-title"><div><span className="section-number">02</span><h2>{candidateType === "student" ? "写下你的在校实践" : "告诉我你做过什么"}</h2></div><span>{form.material.length} 字</span></div>
            <p className="field-help">{candidateType === "student" ? "没有工作经历也没关系。课程作业、毕业设计、比赛、社团、志愿活动和个人作品都可以写。" : "每段经历之间空一行。第一行可以写公司/项目、职位和时间，后面随意描述你做过的事。"}</p>
            {candidateType === "student" && <div className="student-guide"><b>不知道写什么？从下面任选一项</b><span>课程项目</span><span>毕业设计</span><span>比赛 / 社团</span><span>个人作品</span><span>志愿活动</span></div>}
            <textarea id="material" value={form.material} onChange={(e) => update("material", e.target.value)} placeholder={candidateType === "student" ? "例如：\n校园二手交易小程序｜课程项目负责人｜2025.03—2025.06\n访谈了 30 位同学，发现发布流程太复杂\n完成需求分析和原型设计，协同 3 位同学开发\n上线后获得 1200 名注册用户" : "例如：\n某电商公司｜运营实习生｜2024.03—2024.08\n负责小红书账号，做选题、写文案和复盘数据\n3 个月涨粉 8000，单篇最高阅读 12 万"} />
            <div className="prompt-chips" aria-label="写作提示"><span>{candidateType === "student" ? "写清项目目标" : "写清你的角色"}</span><span>做了什么动作</span><span>有数字就写数字</span></div>
          </div>
          <aside className="support-fields">
            <div className="field"><label htmlFor="education">教育背景 <small>选填</small></label><textarea id="education" value={form.education} onChange={(e) => update("education", e.target.value)} placeholder="学校｜专业｜学历｜时间" /></div>
            <div className="field"><label htmlFor="skills">技能与证书 <small>选填</small></label><textarea id="skills" value={form.skills} onChange={(e) => update("skills", e.target.value)} placeholder="例如：Excel、SQL、Figma、英语四六级\n输入名称即可，生成时会自动规范并补充用途说明" /></div>
          </aside>
        </div>

        <div className="builder-action">
          <p><span>✦</span> 我们不会凭空捏造经历；缺少的结果会用【待补充】标记</p>
          <button className="primary-button" type="button" onClick={generate} disabled={!canGenerate || stage === "working"}>
            {stage === "working" ? <><span className="spinner" />正在帮你写简历</> : <>直接帮我写简历 <span>→</span></>}
          </button>
        </div>
      </section>

      {stage === "preview" && (
        <section className="preview-section shell" id="preview" aria-live="polite">
          <header className="preview-heading">
            <div><span className="result-kicker">{candidateType === "student" ? "应届生简历已写好" : "职场简历已写好"}</span><h2>这是为你写好的简历</h2><p>{candidateType === "student" ? "已把课程、项目和校园实践写成正式经历。" : "已把职责、行动和业务结果整理成正式经历。"}你可以直接修改、复制、下载或切换模板。</p></div>
            <div className="preview-actions"><button type="button" onClick={copyAll}>{copied ? "已复制 ✓" : "复制文字"}</button><button className="download-button" type="button" onClick={downloadPdf} disabled={exporting}>{exporting ? "正在生成 PDF…" : "下载 PDF"}</button></div>
          </header>
          {exportError && <p className="export-error" role="alert">{exportError}</p>}

          <div className="edit-hint"><b>生成后仍可修改</b><span>点击下方简历中的姓名、简介、经历、教育或技能即可直接编辑；下载 PDF 会使用修改后的内容。</span></div>

          <div className="template-picker" role="radiogroup" aria-label="简历模板">
            <button className={template === "classic" ? "selected" : ""} onClick={() => setTemplate("classic")} role="radio" aria-checked={template === "classic"}><span className="template-thumb classic-thumb"><i /><i /><i /></span><b>专业简约</b><small>职场 / 校招通用</small></button>
            <button className={template === "modern" ? "selected" : ""} onClick={() => setTemplate("modern")} role="radio" aria-checked={template === "modern"}><span className="template-thumb modern-thumb"><i /><i /><i /></span><b>现代清新</b><small>互联网 / 技术岗</small></button>
            <button className={template === "editorial" ? "selected" : ""} onClick={() => setTemplate("editorial")} role="radio" aria-checked={template === "editorial"}><span className="template-thumb editorial-thumb"><i /><i /><i /></span><b>杂志风格</b><small>品牌 / 内容岗</small></button>
          </div>

          <div className={`resume-sheet template-${template}`}>
            <header className="resume-name"><div><h2 contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedIdentity((current) => ({ ...(current ?? resumeIdentity), name: event.currentTarget.innerText.trim() }))}>{resumeIdentity.name}</h2><p contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedIdentity((current) => ({ ...(current ?? resumeIdentity), target: event.currentTarget.innerText.trim() }))}>{resumeIdentity.target}</p></div><span contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedIdentity((current) => ({ ...(current ?? resumeIdentity), contact: event.currentTarget.innerText.trim() }))}>{resumeIdentity.contact}</span></header>
            <section className="resume-summary"><h3>个人简介</h3><p contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, summary: event.currentTarget.innerText.trim() }) : current)}>{resumeDraft.summary}</p></section>
            {resumeDraft.blocks.length > 0 && <section className="resume-experience"><h3>{candidateType === "student" ? "项目与校园实践" : "核心经历"}</h3>{resumeDraft.blocks.map((block, index) => <article className="resume-entry" key={`experience-${index}`}><div className="entry-head"><h4 contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.currentTarget.innerText.trim() } : item) }) : current)}>{block.title}</h4>{block.meta && <span contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? { ...item, meta: event.currentTarget.innerText.trim() } : item) }) : current)}>{block.meta}</span>}</div>{block.bullets.length > 0 && <ul>{block.bullets.map((bullet, bulletIndex) => <li key={`bullet-${index}-${bulletIndex}`} contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? { ...item, bullets: item.bullets.map((text, textIndex) => textIndex === bulletIndex ? event.currentTarget.innerText.trim() : text) } : item) }) : current)}>{bullet}</li>)}</ul>}</article>)}</section>}
            {resumeDraft.education.length > 0 && <section className="resume-education"><h3>教育背景</h3>{resumeDraft.education.map((item, index) => <p key={`education-${index}`} contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, education: current.education.map((text, itemIndex) => itemIndex === index ? event.currentTarget.innerText.trim() : text) }) : current)}>{item}</p>)}</section>}
            {resumeDraft.skills.length > 0 && <section className="resume-skill-section"><h3>专业技能与证书</h3><div className="resume-skills">{resumeDraft.skills.map((skill, index) => <p className="resume-skill" key={`skill-${index}`}><b contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.currentTarget.innerText.trim() } : item) }) : current)}>{skill.name}</b>{skill.detail && <><span aria-hidden="true">，</span><small contentEditable suppressContentEditableWarning spellCheck onBlur={(event) => setEditedDraft((current) => current ? ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, detail: event.currentTarget.innerText.trim() } : item) }) : current)}>{skill.detail.replace(/[。；;]+$/, "")}</small><span aria-hidden="true">。</span></>}</p>)}</div></section>}
          </div>

          <div className="preview-foot"><button type="button" onClick={() => { setStage("edit"); document.querySelector(".builder")?.scrollIntoView({ behavior: "smooth" }); }}>← 返回修改素材</button><p>内容仅使用你提供的真实经历；投递前请核对名称、时间和数据。</p></div>
        </section>
      )}

    </main>
  );
}
