/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 38px rgba(20, 184, 166, 0.16)",
      },
    },
  },
  plugins: [],
};
