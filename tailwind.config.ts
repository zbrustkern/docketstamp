import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        docket: {
          midnight: "#0F172A",
          slateDeep: "#1E293B",
          slateFormal: "#334155",
          slateBorder: "#CBD5E1",
          sealBlue: "#0284C7",
          sealBlueHover: "#0369A1",
          verifiedGreen: "#15803D",
          amberFill: "#FEF3C7",
          amberBorder: "#D97706",
          amberText: "#B45309",
        },
      },
      fontFamily: {
        serif: ["var(--font-merriweather)", "Georgia", "'Times New Roman'", "serif"],
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        docket: "0 20px 50px rgba(0, 0, 0, 0.35)",
        sheet: "0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)",
        tag: "0 0 0 2px rgba(2, 132, 199, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
