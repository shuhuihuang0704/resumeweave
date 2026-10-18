import { ResumeTailorError, tailorResume, validateTailorInput, type ResumeAiEnv } from "../../lib/resume-tailor";

const REQUEST_LIMIT_BYTES = 256 * 1024;

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function workerBindings(): Promise<ResumeAiEnv> {
  try {
    const runtime = await import("cloudflare:workers");
    return runtime.env as unknown as ResumeAiEnv;
  } catch {
    return {};
  }
}

async function readRequestText(request: Request): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > REQUEST_LIMIT_BYTES) {
      await reader.cancel();
      throw new ResumeTailorError("请求内容过长。", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = JSON.parse(await readRequestText(request));
  } catch (error) {
    if (error instanceof ResumeTailorError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "请求格式不正确。" }, 400);
  }

  let validated;
  try {
    validated = validateTailorInput(input);
  } catch (error) {
    if (error instanceof ResumeTailorError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "请求格式不正确。" }, 400);
  }

  const bindings = await workerBindings();
  if (!bindings.RESUME_TAILOR_LIMITER) {
    return jsonResponse({ error: "AI 改写服务尚未配置。" }, 503);
  }
  const clientAddress = request.headers.get("cf-connecting-ip")?.slice(0, 80) || "unknown";
  try {
    const limit = await bindings.RESUME_TAILOR_LIMITER.limit({ key: `${clientAddress}:resume-tailor` });
    if (!limit.success) return jsonResponse({ error: "请求太频繁，请稍后再试。" }, 429);
  } catch {
    return jsonResponse({ error: "AI 改写服务暂时不可用。" }, 503);
  }

  try {
    const result = await tailorResume(validated, bindings);
    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof ResumeTailorError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "AI 改写服务暂时不可用。" }, 502);
  }
}
