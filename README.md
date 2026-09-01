# ResumeWeave

ResumeWeave is an AI-assisted resume builder for students and experienced job seekers. Enter a target role, projects, campus activities, work history, education, skills, and certificates; the app turns them into an editable, job-focused resume.

**Live demo:** [resumeweave.jjhuang.chatgpt.site](https://resumeweave.jjhuang.chatgpt.site/)

## Features

- Generates complete resume content from unstructured experience notes
- Expands projects into action- and outcome-oriented bullet points
- Normalizes and explains skills and certificates
- Supports students without formal work experience
- Provides three switchable resume templates
- Allows direct editing after generation
- Copies resume text and exports a PDF
- Researches public job requirements for role-specific guidance

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Build and test:

```bash
npm test
```

## Stack

- React
- TypeScript
- vinext / Vite
- Cloudflare Workers-compatible deployment
