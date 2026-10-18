import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "import.meta.env.VITE_RESUME_TAILOR_API_AVAILABLE": JSON.stringify(false),
  },
  root: "backup",
  base: "/resumeweave/",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
