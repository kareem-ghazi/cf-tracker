import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.12)",
        ring: "#247ece",
        background: "#000000",
        foreground: "#eaeaea",
        brand: {
          blue: "#247ece",
          gold: "#feba12",
          red: "#b12a1c",
          cyan: "#3b9ede",
        },
        primary: {
          DEFAULT: "#247ece",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#141414",
          foreground: "#eaeaea",
          hover: "#1e1e1e",
        },
        destructive: {
          DEFAULT: "#b12a1c",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#0a0a0a",
          foreground: "#9ca3af",
        },
        accent: {
          DEFAULT: "#1e1e1e",
          foreground: "#eaeaea",
          success: "#22c55e",
          warning: "#feba12",
          danger: "#b12a1c",
          info: "#3b9ede",
        },
        popover: {
          DEFAULT: "#141414",
          foreground: "#eaeaea",
        },
        card: {
          DEFAULT: "#141414",
          foreground: "#eaeaea",
          hover: "#1e1e1e",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
