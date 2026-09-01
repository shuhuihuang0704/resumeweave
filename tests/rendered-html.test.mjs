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

async function callRoute(body) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("route-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/api/role-research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the resume analysis product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /ResumeWeave/);
  assert.match(html, /写下你的在校实践/);
  assert.match(html, /目标岗位/);
  assert.match(html, /直接写成完整简历/);
  assert.match(html, /应届生 \/ 暂无工作经历/);
  assert.match(html, /课程项目/);
  assert.match(html, /后端开发工程师/);
  assert.match(html, /人力资源/);
  assert.match(html, /供应链管理/);
  assert.doesNotMatch(html, /粘贴真实岗位 JD/);
  assert.match(html, /直接帮我写简历/);
  assert.doesNotMatch(html, /完成相关核心工作|具体行动与结果|拥有 \d+ 段项目与校园实践经历/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("live role research route validates unknown-role requests", async () => {
  const response = await callRoute({ target: "", candidateType: "student" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /至少 2 个字/);
});
