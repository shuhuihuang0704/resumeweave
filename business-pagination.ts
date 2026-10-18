export type BusinessBlock = { title: string; meta: string; bullets: string[] };
export type BusinessSkill = { name: string; detail: string };
export type BusinessResumeData = {
  education: string[];
  experience: BusinessBlock[];
  skills: BusinessSkill[];
  honors: string[];
  selfEvaluation: string;
  hasQr: boolean;
};
export type BusinessResumePage = {
  education: string[];
  experience: BusinessBlock[];
  skills: BusinessSkill[];
  honors: string[];
  selfEvaluation: string;
  hasQr: boolean;
};

const FIRST_PAGE_CONTENT_HEIGHT = 820;
const CONTINUATION_CONTENT_HEIGHT = 920;

function textHeight(value: string, charsPerLine: number, lineHeight: number, base: number) {
  return base + Math.max(1, Math.ceil(value.length / charsPerLine)) * lineHeight;
}

function blockHeight(block: BusinessBlock) {
  return 38 + textHeight(`${block.title} ${block.meta}`, 65, 15, 0) + block.bullets.reduce((height, bullet) => height + textHeight(bullet, 78, 15, 0), 0);
}

function emptyPage(): BusinessResumePage {
  return { education: [], experience: [], skills: [], honors: [], selfEvaluation: "", hasQr: false };
}

export function paginateBusinessResume(data: BusinessResumeData): BusinessResumePage[] {
  const pages = [emptyPage()];
  let remaining = FIRST_PAGE_CONTENT_HEIGHT - 155;
  const nextPage = () => {
    pages.push(emptyPage());
    remaining = CONTINUATION_CONTENT_HEIGHT - 55;
  };

  if (data.education.length) {
    const educationHeight = 42 + data.education.reduce((sum, item) => sum + textHeight(item, 68, 16, 0), 0);
    if (educationHeight > remaining) nextPage();
    pages.at(-1)!.education.push(...data.education);
    remaining -= educationHeight;
  }

  for (const block of data.experience) {
    const height = blockHeight(block) + (pages.at(-1)!.experience.length ? 0 : 42);
    if (height > remaining && (pages.at(-1)!.education.length || pages.at(-1)!.experience.length)) nextPage();
    pages.at(-1)!.experience.push(block);
    remaining -= height;
  }

  // The business template is intentionally at least two A4 pages.
  if (pages.length === 1) nextPage();
  for (const skill of data.skills) {
    const height = textHeight(skill.detail || skill.name, 40, 15, 40) + (pages.at(-1)!.skills.length ? 0 : 42);
    if (height > remaining && (pages.at(-1)!.skills.length || pages.at(-1)!.honors.length || pages.at(-1)!.selfEvaluation || pages.at(-1)!.hasQr)) nextPage();
    pages.at(-1)!.skills.push(skill);
    remaining -= height;
  }
  for (const honor of data.honors) {
    const height = textHeight(honor, 68, 16, 22) + (pages.at(-1)!.honors.length ? 0 : 42);
    if (height > remaining && (pages.at(-1)!.skills.length || pages.at(-1)!.honors.length || pages.at(-1)!.selfEvaluation || pages.at(-1)!.hasQr)) nextPage();
    pages.at(-1)!.honors.push(honor);
    remaining -= height;
  }
  if (data.selfEvaluation) {
    const height = textHeight(data.selfEvaluation, 68, 16, 42) + (pages.at(-1)!.selfEvaluation ? 0 : 42);
    if (height > remaining && (pages.at(-1)!.skills.length || pages.at(-1)!.honors.length || pages.at(-1)!.selfEvaluation || pages.at(-1)!.hasQr)) nextPage();
    pages.at(-1)!.selfEvaluation = data.selfEvaluation;
    remaining -= height;
  }
  if (data.hasQr) {
    if (132 > remaining && (pages.at(-1)!.skills.length || pages.at(-1)!.honors.length || pages.at(-1)!.selfEvaluation || pages.at(-1)!.hasQr)) nextPage();
    pages.at(-1)!.hasQr = true;
  }
  return pages;
}
