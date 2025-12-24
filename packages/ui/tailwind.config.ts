import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // VS Code inspired colors
        brand: {
          DEFAULT: "#007acc",
          dark: "#005a9e",
          light: "#1e90ff"
        },
        vscode: {
          bg: "#1e1e1e",
          "bg-light": "#252526",
          "bg-lighter": "#2d2d2d",
          "bg-hover": "#37373d",
          "bg-active": "#094771",
          border: "#3c3c3c",
          "border-light": "#454545",
          text: "#cccccc",
          "text-muted": "#858585",
          "text-bright": "#ffffff",
          accent: "#007acc",
          success: "#4ec9b0",
          warning: "#dcdcaa",
          error: "#f14c4c",
          info: "#75beff"
        }
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"]
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["13px", { lineHeight: "20px" }],
        lg: ["14px", { lineHeight: "22px" }]
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
