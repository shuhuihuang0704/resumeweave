<div align="center">

<img src="public/favicon.svg" width="72" height="72" alt="ResumeWeave logo" />

# ResumeWeave

### 把零散经历，织成一份好简历。

一款面向应届生与职场人的 AI 简历定制工具。上传已有简历并提供企业 JD，逐条获得专业改写建议；由你决定是否采纳，并尽量保留原稿版式。

[![Live Demo](https://img.shields.io/badge/Live_Demo-在线体验-5B4BFF?style=for-the-badge&logo=vercel&logoColor=white)](https://resumeweave.jjhuang.chatgpt.site/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)](https://react.dev/)

</div>

![ResumeWeave product preview](public/og-resumeweave.png)

## 为什么做 ResumeWeave

针对目标岗位修改简历，不该从头重做，也不该把原稿交给 AI 后失去控制。ResumeWeave 读取你已有简历中的文字，对照企业招聘要求指出值得调整的内容，并提供可逐条审核的专业改写建议。只有你接受的建议才会进入导出文件。

## 核心能力

| 能力 | ResumeWeave 会做什么 |
| --- | --- |
| **上传已有简历** | 在浏览器本地解析可提取文字的 PDF 与 `.docx`，保留原稿作为修改底稿 |
| **按企业 JD 匹配** | 提供目标岗位、企业名称和招聘要求，识别岗位重点与简历中值得调整的内容 |
| **专业改写建议** | 优化真实经历的表达，说明改写思路；不编造数字、职责、公司或成果 |
| **逐条审核与修改** | 接受、跳过或手动编辑每条建议；未经确认的内容保留原文 |
| **PDF 位置标注** | 在原 PDF 预览中用红色编号标出建议对应的位置，可跳转到相关审核卡片 |
| **保留格式导出** | PDF 输出为扁平化页面，DOCX 保持可编辑；生成前检查版式溢出 |

## 使用流程

```text
上传已有 PDF / DOCX 简历
        ↓
填写目标岗位并粘贴企业 JD
        ↓
阅读说明并授权发送提取文字
        ↓
查看岗位匹配与逐条改写建议
        ↓
接受、手动编辑或保留原文
        ↓
生成预览并下载同格式简历
```

## 文件支持与隐私

- 支持可提取文字的 PDF 和可编辑 `.docx`，文件最多 **10 MB / 10 页**。
- 暂不支持扫描件 / OCR、加密文件和旧版 `.doc`。DOCX 页数为浏览器本地估算。
- 原始文件只在当前浏览器内存中解析，不会上传原始 PDF / Word 文件。只有勾选授权后，提取的简历文字、目标岗位信息和 JD 才会发送到当前应用配置的 AI 服务；文字可能包含姓名和联系方式等个人信息。
- PDF 预览中的红色标记仅用于定位建议，不会改动原文件。导出的 PDF 是扁平化页面；DOCX 仍可编辑。系统会尽量保留原稿视觉版式，发现溢出或重排时会提示检查。

## 适合谁使用

- **应届毕业生**：把课程项目、校园实践和证书转化成简历亮点
- **实习求职者**：针对目标岗位快速整理可投递版本
- **职场人士**：提炼工作成果，减少流水账式描述
- **转行求职者**：识别可迁移能力，重新组织过往经历

## 本地运行

需要 [Node.js](https://nodejs.org/) 22.13 或更高版本。

```bash
git clone https://github.com/shuhuihuang0704/resumeweave.git
cd resumeweave
npm install
npm run dev
```

打开终端显示的本地地址即可使用。

### Ollama 本地试用

GitHub Pages / `4173` 静态预览不提供 AI 改写。若要在本机使用 Ollama 分析 JD 并生成改写建议：

1. 从 [Ollama 官网](https://ollama.com/download) 下载并安装 Ollama，然后打开 Ollama 应用，让本地服务保持运行。
2. 打开终端，下载适合本地试用的 Qwen3 4B 模型：

   ```bash
   ollama pull qwen3:4b
   ```

3. 若项目根目录还没有 `.dev.vars`，复制 `.dev.vars.example` 为 `.dev.vars`。若它已经存在，**不要覆盖**（里面可能有 API Key），只需在文件中更新下面两项；本地 Ollama 请求不会转发已有的云端 Key。若改用其他已下载模型，再更新 `RESUME_AI_MODEL`。

   ```dotenv
   RESUME_AI_BASE_URL="http://127.0.0.1:11434/v1"
   RESUME_AI_MODEL="qwen3:4b"
   ```

   `.dev.vars` 已被 Git 忽略。
4. 在项目根目录运行 `npm run dev`，打开终端打印的开发地址（不要继续用 `4173` 静态预览地址）。
5. 上传简历、填写岗位/JD 并明确勾选授权后，点击“分析 JD 并生成改写建议”。

本地开发服务器通过 Cloudflare Vite 插件运行 Worker API，并使用本地限流 binding。应用后端只允许通过 HTTP 连接 `127.0.0.1:11434` 的本地 Ollama；简历文字不会被发送给 DeepSeek 或其他云端模型。GitHub Pages 静态版仍保持 AI 禁用；在线使用 AI 需另行部署后端。

### 常用命令

```bash
npm run dev      # 启动开发环境
npm run build    # 构建生产版本
npm run lint     # 检查代码规范
npm test         # 构建并运行测试
```

## 技术栈

- **前端**：React 19、TypeScript、CSS
- **构建**：vinext、Vite
- **简历导出**：html2canvas、jsPDF
- **数据层**：Drizzle ORM
- **部署**：Cloudflare Workers-compatible runtime

## 项目结构

```text
resumeweave/
├── app/                 # 页面、样式与岗位研究 API
├── db/                  # 数据库结构与连接
├── public/              # 图标和产品图片
├── tests/               # 页面生成测试
├── worker/              # Worker 入口
└── .openai/             # 托管配置
```

## 设计原则

1. **围绕已有简历定制**，把岗位要求与用户的真实经历逐条对照。
2. **只优化真实经历**，不会编造公司、项目、成绩或量化结果。
3. **建议由用户把关**，只有用户接受的改写才会写入输出文件。
4. **尽量沿用原稿版式**，并在下载前提示可能的溢出或重排问题。

## Windows 下载

[**下载 Windows 安装版或免安装版 →**](https://github.com/shuhuihuang0704/resumeweave/releases/tag/windows-v1.0.0)

支持 Windows 10/11 x64，详细说明见 [WINDOWS.md](./WINDOWS.md)。

## macOS 下载

[**下载 Apple Silicon 或 Intel Mac 版本 →**](https://github.com/shuhuihuang0704/resumeweave/releases/tag/macos-v1.0.0)

提供 `.dmg` 与 `.zip`，详细说明见 [MACOS.md](./MACOS.md)。

---

<div align="center">

如果 ResumeWeave 对你有帮助，欢迎点一个 ⭐

[立即体验](https://resumeweave.jjhuang.chatgpt.site/) · [查看源码](https://github.com/shuhuihuang0704/resumeweave)

</div>
