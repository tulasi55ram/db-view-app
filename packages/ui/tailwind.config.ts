import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#00bcd4",
          dark: "#0097a7"
        }
      }
    }
  },
  plugins: []
};

export default config;
