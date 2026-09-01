type CandidateType = "student" | "experienced";

type BaiduJob = {
  postId?: unknown;
  name?: unknown;
  serviceCondition?: unknown;
  updateDate?: unknown;
  publishDate?: unknown;
};

type MarketSource = {
  company: string;
  role: string;
  code: string;
  url: string;
};

type LiveJob = {
  id: string;
  company: string;
  role: string;
  code: string;
  url: string;
  requirementText: string;
  updatedAt: string;
};

const BAIDU_ENDPOINT = "https://talent.baidu.com/httservice/getPostListNew";
const TENCENT_SEARCH_ENDPOINT = "https://careers.tencent.com/tencentcareer/api/post/Query";
const TENCENT_DETAIL_ENDPOINT = "https://careers.tencent.com/tencentcareer/api/post/ByPostId";

function cleanText(value: unknown, limit = 500) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\r/g, "").trim().slice(0, limit) : "";
}

function requirementLines(value: unknown) {
  const text = cleanText(value, 4_000);
  if (!text) return [];
  return text
    .split(/\n+|(?=\d+[.、）)]\s*)/)
    .map((line) => line.replace(/^[-—•·\s]+/, "").replace(/^\d+[.、）)]\s*/, "").trim())
    .filter((line) => line.length >= 8 && line.length <= 220);
}

function asJobList(payload: unknown): BaiduJob[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const list = data.list ?? data.postList ?? data.rows;
  return Array.isArray(list) ? list as BaiduJob[] : [];
}

function roleMatches(target: string, role: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[\s·—_（）()\-/&]/g, "").replace(/j\d+/g, "");
  const targetName = normalize(target);
  const roleName = normalize(role);
  if (roleName.includes(targetName) || targetName.includes(roleName)) return true;
  const family = ["产品经理", "工程师", "设计师", "分析师", "经理", "专员", "助理", "顾问", "主管", "总监", "策划", "运营", "销售", "客服", "法务"]
    .find((item) => targetName.endsWith(item));
  if (family && !roleName.includes(family)) return false;
  const core = targetName
    .replace(/(高级|资深|专家|初级|中级|实习|校招|社招)/g, "")
    .replace(/(工程师|产品经理|经理|专员|助理|设计师|分析师|顾问|主管|总监|策划|运营|销售|客服|法务|岗位)$/g, "");
  return core.length >= 2 && roleName.includes(core);
}

async function searchBaidu(target: string, recruitType: "SOCIAL" | "GRADUATE" | "INTERN") {
  const body = new URLSearchParams({
    recruitType,
    pageSize: "5",
    keyWord: target,
    curPage: "1",
    projectType: "",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(BAIDU_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        referer: "https://talent.baidu.com/jobs/social-list",
        "x-requested-with": "XMLHttpRequest",
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    return asJobList(await response.json()).flatMap((job): LiveJob[] => {
      const roleWithCode = cleanText(job.name, 160);
      const postId = cleanText(job.postId, 80);
      if (!postId || !roleMatches(target, roleWithCode)) return [];
      const role = roleWithCode.replace(/[（(]J\d+[）)]/i, "").trim();
      return [{
        id: `baidu-${postId}`,
        company: "百度",
        role,
        code: roleWithCode.match(/J\d+/i)?.[0]?.toUpperCase() ?? postId.slice(0, 8),
        url: `https://talent.baidu.com/jobs/detail/${recruitType}/${encodeURIComponent(postId)}`,
        requirementText: cleanText(job.serviceCondition, 4_000),
        updatedAt: cleanText(job.updateDate || job.publishDate, 20),
      }];
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTencentDetail(postId: string): Promise<LiveJob | null> {
  const url = new URL(TENCENT_DETAIL_ENDPOINT);
  url.searchParams.set("postId", postId);
  url.searchParams.set("language", "zh-cn");
  const response = await fetch(url, { headers: { referer: `https://careers.tencent.com/jobdesc.html?postId=${postId}` } });
  if (!response.ok) return null;
  const payload = await response.json() as { Data?: Record<string, unknown> };
  const detail = payload.Data;
  if (!detail) return null;
  const role = cleanText(detail.RecruitPostName, 160);
  const requirementText = cleanText(detail.Requirement, 4_000);
  if (!role || !requirementText) return null;
  return {
    id: `tencent-${postId}`,
    company: "腾讯",
    role,
    code: `T${cleanText(detail.RecruitPostId, 20) || postId.slice(-6)}`,
    url: `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(postId)}`,
    requirementText,
    updatedAt: cleanText(detail.LastUpdateTime, 20),
  };
}

async function searchTencent(target: string) {
  const url = new URL(TENCENT_SEARCH_ENDPOINT);
  Object.entries({
    timestamp: String(Date.now()), countryId: "", cityId: "", bgIds: "", productId: "", categoryId: "",
    parentCategoryId: "", attrId: "", keyword: target, pageIndex: "1", pageSize: "5", language: "zh-cn", area: "cn",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { referer: "https://careers.tencent.com/search.html" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = await response.json() as { Data?: { Posts?: Array<Record<string, unknown>> | null } };
    const posts = Array.isArray(payload.Data?.Posts) ? payload.Data.Posts : [];
    const matchingIds = posts.flatMap((post) => {
      const role = cleanText(post.RecruitPostName, 160);
      const id = cleanText(post.PostId, 80);
      return id && roleMatches(target, role) ? [id] : [];
    }).slice(0, 3);
    const details = await Promise.all(matchingIds.map(fetchTencentDetail));
    return details.filter((job): job is LiveJob => Boolean(job));
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let input: { target?: unknown; candidateType?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const target = cleanText(input.target, 40);
  const candidateType: CandidateType = input.candidateType === "experienced" ? "experienced" : "student";
  if (target.length < 2) return Response.json({ error: "请填写至少 2 个字的岗位名称。" }, { status: 400 });

  const recruitTypes: Array<"SOCIAL" | "GRADUATE" | "INTERN"> = candidateType === "student"
    ? ["GRADUATE", "INTERN", "SOCIAL"]
    : ["SOCIAL"];

  try {
    const batches = await Promise.allSettled([...recruitTypes.map((type) => searchBaidu(target, type)), searchTencent(target)]);
    const jobs = batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []);
    const seen = new Set<string>();
    const selected = jobs.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    }).slice(0, 3);

    const sources: MarketSource[] = selected.map(({ company, role, code, url }) => ({ company, role, code, url }));

    const requirementSet = new Set<string>();
    selected.forEach((job) => requirementLines(job.requirementText).forEach((line) => requirementSet.add(line)));
    const requirements = [...requirementSet].slice(0, 6);

    if (!sources.length || !requirements.length) {
      return Response.json({ status: "not_found", target, searchedSources: ["百度招聘", "腾讯招聘"] });
    }

    const dates = selected.map((job) => job.updatedAt).filter(Boolean).sort().reverse();
    return Response.json({
      status: "success",
      target,
      researchedAt: dates[0] || new Date().toISOString().slice(0, 10),
      requirements,
      sources,
    }, { headers: { "cache-control": "public, max-age=900" } });
  } catch {
    return Response.json({ status: "error", error: "公开岗位查询暂时不可用。" }, { status: 502 });
  }
}
