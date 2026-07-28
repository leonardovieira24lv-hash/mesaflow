import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        surface: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--surface-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        "foreground-subtle": "hsl(var(--foreground-subtle))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        chrome: {
          DEFAULT: "hsl(var(--chrome))",
          foreground: "hsl(var(--chrome-foreground))",
          "muted-foreground": "hsl(var(--chrome-muted-foreground))",
          border: "hsl(var(--chrome-border))",
          active: "hsl(var(--chrome-active))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        numeric: ["var(--font-numeric)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        shimmer: {
          from: { backgroundPosition: "150% 0" },
          to: { backgroundPosition: "-50% 0" },
        },
        "toast-in": {
          from: { transform: "translateY(0.5rem)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.97)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "status-flash": {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.4), 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 0 0 0 hsl(var(--primary) / 0)",
          },
          "40%": {
            transform: "scale(1.035)",
            boxShadow: "0 10px 28px -4px rgb(0 0 0 / 0.65), 0 0 0 4px hsl(var(--primary) / 0.55)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.4), 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 0 0 0 hsl(var(--primary) / 0)",
          },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "toast-in": "toast-in 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "sheet-up": "sheet-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        "status-flash": "status-flash 700ms ease-out",
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        bar: "var(--shadow-bar)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.15), 0 8px 24px -8px hsl(var(--primary) / 0.35)",
        "glow-success": "0 0 0 1px hsl(var(--success) / 0.15), 0 8px 24px -8px hsl(var(--success) / 0.4)",
        sheet: "var(--shadow-sheet)",
        hero: "0 12px 32px -12px hsl(var(--primary) / 0.45)",
        elevation: "var(--elevation-highlight)",
      },
    },
  },
  plugins: [],
};

export default config;
