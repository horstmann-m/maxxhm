import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Pure-function unit tests only (lib/health.js, lib/alerts.js,
    // lib/demoData.js, lib/api.js casing boundary) — no component
    // rendering, so no jsdom/happy-dom environment needed.
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
