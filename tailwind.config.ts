import type { Config } from "tailwindcss";

// Cyberpunk / Glitch design system. Tokens are the single source of truth —
// keep hex values in sync with the CSS variables in src/index.css.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        foreground: "#e0e0e0",
        card: "#12121a",
        muted: "#1c1c2e",
        "muted-foreground": "#6b7280",
        accent: "#00ff88",
        "accent-secondary": "#ff00ff",
        "accent-tertiary": "#00d4ff",
        border: "#2a2a3a",
        input: "#12121a",
        ring: "#00ff88",
        destructive: "#ff3366",
      },
      fontFamily: {
        // Geometric/robotic display for headings.
        display: ['"Orbitron"', '"Share Tech Mono"', "monospace"],
        // Terminal-feel body.
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Consolas"', "monospace"],
        // UI labels, timestamps, badges.
        tech: ['"Share Tech Mono"', '"JetBrains Mono"', "monospace"],
        sans: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      boxShadow: {
        neon: "0 0 5px #00ff88, 0 0 10px #00ff8840",
        "neon-sm": "0 0 3px #00ff88, 0 0 6px #00ff8830",
        "neon-lg": "0 0 10px #00ff88, 0 0 20px #00ff8860, 0 0 40px #00ff8830",
        "neon-secondary": "0 0 5px #ff00ff, 0 0 20px #ff00ff60",
        "neon-tertiary": "0 0 5px #00d4ff, 0 0 20px #00d4ff60",
      },
      maxWidth: {
        main: "1120px",
      },
      keyframes: {
        blink: {
          "50%": { opacity: "0" },
        },
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(2px, -2px)" },
          "60%": { transform: "translate(-1px, -1px)" },
          "80%": { transform: "translate(1px, 1px)" },
        },
        rgbShift: {
          "0%, 100%": { textShadow: "-2px 0 #ff00ff, 2px 0 #00d4ff" },
          "50%": { textShadow: "2px 0 #ff00ff, -2px 0 #00d4ff" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        fade: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        // Rare, brief flicker so it reads as signal interference, not decoration.
        glitch: "glitch 0.3s steps(2) infinite",
        "rgb-shift": "rgbShift 3s ease-in-out infinite",
        scanline: "scanline 8s linear infinite",
        fade: "fade 0.22s ease",
      },
    },
  },
  plugins: [],
} satisfies Config;
