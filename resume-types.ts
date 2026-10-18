export type ResumeBlock = { title: string; meta: string; bullets: string[] };
export type ResumeSkill = { name: string; detail: string };
export type ResumeDraft = {
  summary: string;
  blocks: ResumeBlock[];
  education: string[];
  skills: ResumeSkill[];
  honors: string[];
  selfEvaluation: string;
};
