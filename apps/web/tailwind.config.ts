import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        mikke: {
          red: "#EE2A2E",
          black: "#1A1A1A",
          yellow: "#FFD200",
          cream: "#FFF8E7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
