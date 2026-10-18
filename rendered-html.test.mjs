import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function callRoute(body, headers = {}, route = "/api/role-research") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("route-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the upload-and-tailor resume product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /ResumeWeave/);
  assert.match(html, /上传简历，按岗位要求定制/);
  assert.match(html, /上传 PDF 或 DOCX 简历/);
  assert.match(html, /仅支持可提取文字的 PDF 与 \.docx/);
  assert.match(html, /企业名称/);
  assert.match(html, /招聘要求 \/ JD/);
  assert.match(html, /我已阅读并同意/);
  assert.match(html, /提取文字可能包含姓名、联系方式等个人信息/);
  assert.match(html, /不会上传原始 PDF \/ Word 文件/);
  assert.match(html, /Word 页数为浏览器本地估算/);
  assert.match(html, /AI 仍可能出错，请核对后再接受/);
  assert.doesNotMatch(html, /不会凭空编造经历|只改写已有文字/);
  assert.match(html, /把岗位要求，织进你的下一份简历/);
  assert.doesNotMatch(html, /直接帮我写简历|写下你的在校实践|个人主页或作品集链接/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("server-renders the split ResumeWeave hero and its builder entry", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /把岗位要求，织进你的下一份简历/);
  assert.match(html, /href="#builder"[^>]*>.*?开始制作/);
  assert.match(html, /id="features"/);
  assert.match(html, /aria-label="简历预览样例"/);
  assert.doesNotMatch(html, /OceanPulse|Saving Oceans|Coral Bed|Pure Waters/);
});

test("server-renders accessible homepage navigation targets", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /aria-label="打开导航菜单"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="mobile-navigation"/);
  assert.match(html, /id="mobile-navigation"/);
  assert.match(html, /href="#features"/);
  assert.match(html, /href="#builder"/);
});

test("live role research route validates unknown-role requests", async () => {
  const response = await callRoute({ target: "", candidateType: "student" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /至少 2 个字/);
});

test("upload-based resume tailoring route validates blocks and fails closed when bindings are missing", async () => {
  const input = {
    target: "产品经理",
    company: "示例科技",
    jobDescription: "负责产品规划、需求分析和跨团队协作。",
    blocks: [{ id: "pdf-p1-b0", section: "项目经历", text: "访谈用户并完成原型。" }],
  };
  const invalid = await callRoute({ ...input, jobDescription: "" }, {}, "/api/resume-tailor");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
  const privateValue = "private-source-binary-must-not-echo";
  const rejectedFile = await callRoute({ ...input, file: privateValue }, {}, "/api/resume-tailor");
  assert.equal(rejectedFile.status, 400);
  assert.doesNotMatch(await rejectedFile.text(), new RegExp(privateValue));
  const valid = await callRoute(input, {}, "/api/resume-tailor");
  assert.equal(valid.status, 503);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.match((await valid.json()).error, /尚未配置/);
});
