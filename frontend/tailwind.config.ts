import type { Config } from "tailwindcss";

/**
 * Tailwind theme. The `zoom` palette pins the brand blue (#2D8CFF) and the dark
 * meeting-room greys so every component pulls from one source of truth rather
 * than scattering hex codes.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zoom: {
          blue: "#2D8CFF",
          bluehover: "#2681F2",
          dark: "#1A1A1A",
          panel: "#242424",
          slate: "#747487",
        },
      },
    },
  },
  plugins: [],
};
export default config;
