import assert from "node:assert/strict";
import test from "node:test";
import { tailorResume, validateTailorInput } from "../app/lib/resume-tailor.ts";

const input = {
  target: "产品经理",
  company: "示例科技",
  jobDescription: "负责产品规划、需求分析和跨团队协作。",
  blocks: [
    { id: "pdf-p1-b0", section: "项目经历", text: "访谈 12 位用户并完成可用性原型。" },
    { id: "pdf-p1-b1", section: "教育背景", text: "某某大学｜产品设计｜本科" },
  ],
};

const result = {
  edits: [{ blockId: "pdf-p1-b0", replacement: "访谈 12 位用户并完成可用性原型。", reason: "突出用户研究与产品验证。", requirement: "需求分析" }],
  matchedRequirements: ["需求分析"],
  missingRequirements: ["待补充：跨团队协作的具体案例"],
};

const env = {
  RESUME_AI_API_KEY: "test-key",
  RESUME_AI_BASE_URL: "https://api.deepseek.com",
  RESUME_AI_MODEL: "deepseek-flash",
};

test("validates the upload-based block request and rejects unknown fields", () => {
  assert.deepEqual(validateTailorInput(input), input);
  assert.deepEqual(validateTailorInput({ target: input.target, jobDescription: input.jobDescription, blocks: input.blocks }), {
    target: input.target,
    jobDescription: input.jobDescription,
    blocks: input.blocks,
  });
  for (const key of ["name", "photo", "file", "location", "geometry", "draft", "unexpected"]) {
    assert.throws(() => validateTailorInput({ ...input, [key]: "must not be accepted" }), /不支持的请求字段/);
  }
  assert.throws(() => validateTailorInput({ ...input, target: " " }), /目标岗位/);
  assert.throws(() => validateTailorInput({ ...input, jobDescription: " " }), /招聘要求/);
});

test("enforces block count, block/section lengths, and aggregate source-text boundaries", () => {
  const exactLimit = Array.from({ length: 5 }, (_, index) => ({ id: `b${index}`, section: "经历", text: "x".repeat(4_000) }));
  assert.equal(validateTailorInput({ ...input, blocks: exactLimit }).blocks.length, 5);
  assert.throws(() => validateTailorInput({ ...input, blocks: [...exactLimit, { id: "b5", section: "经历", text: "x" }] }), /总长度|20,000/);
  assert.throws(() => validateTailorInput({ ...input, blocks: [{ id: "b", section: "经历", text: "x".repeat(4_001) }] }), /文字块|4,000/);
  assert.throws(() => validateTailorInput({ ...input, blocks: [{ id: "b", section: "x".repeat(101), text: "x" }] }), /类别|100/);
  assert.throws(() => validateTailorInput({ ...input, blocks: [input.blocks[0], input.blocks[0]] }), /重复/);
  assert.throws(() => validateTailorInput({ ...input, blocks: Array.from({ length: 301 }, (_, index) => ({ id: `b${index}`, section: "经历", text: "x" })) }), /300/);
  assert.throws(() => validateTailorInput({ ...input, company: "x".repeat(161) }), /企业/);
  assert.throws(() => validateTailorInput({ ...input, target: "x".repeat(161) }), /目标岗位/);
  assert.throws(() => validateTailorInput({ ...input, jobDescription: "x".repeat(20_001) }), /招聘要求/);
});

test("sends only job context and editable block text, then validates block-level suggestions", async () => {
  let outbound;
  const response = await tailorResume(input, env, async (url, init) => {
    outbound = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
  });

  assert.deepEqual(response, result);
  assert.equal(outbound.url, "https://api.deepseek.com/chat/completions");
  assert.equal(outbound.headers.authorization, "Bearer test-key");
  assert.equal(outbound.body.model, "deepseek-flash");
  assert.deepEqual(outbound.body.response_format, { type: "json_object" });
  assert.ok(Number.isInteger(outbound.body.max_tokens) && outbound.body.max_tokens > 0);
  assert.match(outbound.body.messages[0].content, /不得编造/);
  assert.match(outbound.body.messages[0].content, /不可信/);
  assert.match(outbound.body.messages[0].content, /JSON/);
  assert.match(outbound.body.messages[0].content, /matchedRequirements/);
  assert.match(outbound.body.messages[0].content, /逐字摘自 jobDescription/);
  assert.match(outbound.body.messages[0].content, /专业、正式、精炼、具体/);
  assert.match(outbound.body.messages[0].content, /行动\+方法\/职责\+已有可核实结果/);
  assert.match(outbound.body.messages[0].content, /不得强行加结果或量化数字/);
  assert.match(outbound.body.messages[0].content, /只在确实提升岗位相关性、清晰度或专业度时改写/);
  assert.match(outbound.body.messages[0].content, /职务职级、学历专业、证书、奖项、荣誉称号/);
  assert.match(outbound.body.messages[0].content, /看似被截断、缺字、语义不完整/);
  assert.deepEqual(JSON.parse(outbound.body.messages[1].content), input);
  assert.doesNotMatch(outbound.body.messages[1].content, /location|geometry|file|image|pageCount/);
  assert.equal("json_schema" in outbound.body.response_format, false);
});

test("uses local Ollama native chat with thinking disabled and validates its JSON result", async () => {
  let outbound;
  const response = await tailorResume(input, {
    RESUME_AI_BASE_URL: "http://127.0.0.1:11434/v1",
    RESUME_AI_MODEL: "qwen3:4b",
  }, async (url, init) => {
    outbound = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(result) }, done: true }));
  });

  assert.deepEqual(response, result);
  assert.equal(outbound.url, "http://127.0.0.1:11434/api/chat");
  assert.equal("authorization" in outbound.headers, false);
  assert.equal(outbound.body.model, "qwen3:4b");
  assert.equal(outbound.body.think, false);
  assert.equal(outbound.body.format.type, "object");
  assert.equal(outbound.body.format.properties.edits.maxItems, 3);
  assert.equal(outbound.body.format.properties.edits.items.properties.replacement.maxLength, 300);
  assert.equal(outbound.body.format.properties.edits.items.properties.requirement.maxLength, 100);
  assert.ok(outbound.body.format.properties.edits.items.required.includes("requirement"));
  assert.equal(outbound.body.stream, false);
  assert.ok(Number.isInteger(outbound.body.options.num_predict) && outbound.body.options.num_predict > 1_024 && outbound.body.options.num_predict <= 1_536);
  assert.match(outbound.body.messages[0].content, /最多给出 3 条/);
});

test("only keeps an exact job-description quote as the suggestion's linked requirement", async () => {
  const providerResponse = (value) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
  const fabricatedRequirement = { ...result, edits: [{ ...result.edits[0], requirement: "精通 SQL 与数据分析" }] };
  const response = await tailorResume(input, env, async () => providerResponse(fabricatedRequirement));

  assert.equal(response.edits[0].requirement, "");

  const omittedRequirement = { ...result, edits: [{ blockId: result.edits[0].blockId, replacement: result.edits[0].replacement, reason: result.edits[0].reason }] };
  const compatibleResponse = await tailorResume(input, env, async () => providerResponse(omittedRequirement));
  assert.equal(compatibleResponse.edits[0].requirement, "");
});

test("never forwards a configured cloud API key to local Ollama", async () => {
  let outboundHeaders;
  await tailorResume(input, {
    RESUME_AI_API_KEY: "must-not-be-forwarded",
    RESUME_AI_BASE_URL: "http://127.0.0.1:11434/v1",
    RESUME_AI_MODEL: "qwen3:4b",
  }, async (_url, init) => {
    outboundHeaders = init.headers;
    return new Response(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(result) }, done: true }));
  });

  assert.equal("authorization" in outboundHeaders, false);
});

test("allows unencrypted AI endpoints only for the local Ollama address", async () => {
  for (const baseUrl of ["http://example.com/v1", "http://127.0.0.2:11434/v1", "http://127.0.0.1:11435/v1"]) {
    await assert.rejects(() => tailorResume(input, {
      RESUME_AI_BASE_URL: baseUrl,
      RESUME_AI_MODEL: "qwen3:4b",
    }, async () => { throw new Error("must not call an unapproved endpoint"); }), /服务尚未配置/);
  }
  await assert.rejects(() => tailorResume(input, {
    RESUME_AI_BASE_URL: "https://api.deepseek.com",
    RESUME_AI_MODEL: "deepseek-flash",
  }, async () => { throw new Error("must not call a remote provider without its key"); }), /服务尚未配置/);
});

test("rejects unknown/duplicate returned IDs, overlong edits, and malformed model responses", async () => {
  const providerResponse = (value) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
  await assert.rejects(() => tailorResume(input, env, async () => providerResponse({ ...result, edits: [{ ...result.edits[0], blockId: "unknown" }] })), /AI 返回结构无效/);
  await assert.rejects(() => tailorResume(input, env, async () => providerResponse({ ...result, edits: [result.edits[0], result.edits[0]] })), /AI 返回结构无效/);
  await assert.rejects(() => tailorResume(input, env, async () => providerResponse({ ...result, edits: [{ ...result.edits[0], replacement: "x".repeat(4_001) }] })), /AI 返回结构无效/);
  await assert.rejects(() => tailorResume(input, env, async () => providerResponse({ ...result, unexpected: true })), /AI 返回结构无效/);
  await assert.rejects(() => tailorResume(input, env, async () => new Response("not json")), /AI 返回格式无效/);
  await assert.rejects(() => tailorResume(input, {}, async () => { throw new Error("must not call"); }), /服务尚未配置/);
});

test("maps an aborted upstream call to a bounded timeout error", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => { callback(); return 0; };
  try {
    await assert.rejects(() => tailorResume(input, env, async (_url, init) => {
      assert.equal(init.signal?.aborted, true);
      throw new DOMException("aborted", "AbortError");
    }), /AI 请求超时/);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
