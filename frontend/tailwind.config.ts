import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:          "#EEEBE3",
        surface:     "#FBFAF7",
        "surface-alt": "#E6E2D8",
        ink:         "#14130F",
        "ink-2":     "#1A1814",
        muted:       "#57534B",
        faint:       "#8A857B",
        accent:      "#E5402C",
        success:     "#1FB46A",
      },
      fontFamily: {
        onest:   ["Onest", "ui-sans-serif", "system-ui", "sans-serif"],
        cormorant: ["Cormorant", "ui-serif", "Georgia", "serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        pill:  "100px",
        card:  "16px",
        card2: "22px",
      },
    },
  },
  plugins: [],
};

export default config;
