import type { Config } from "tailwindcss";

// Warm, human palette per DESIGN.md §11 — cream/parchment background,
// espresso text, one terracotta accent. Deliberately not blue/grey SaaS.
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#FAF3E8",
        espresso: "#3B2A22",
        terracotta: "#C1652F",
        clay: "#E7D8C3",
        sage: "#7A8B6F",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica Neue", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
