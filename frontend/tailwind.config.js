/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12141A",
        paper: "#F7F5F0",
        "vault-brass": "#B8933E",
        "seal-teal": "#2E5C57",
        "signal-red": "#B84A3E",
      },
    },
  },
  plugins: [],
};
