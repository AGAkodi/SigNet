/** @type {import('tailwindcss').Config} */
const mist = {
  50: '#F3F0E7', 100: '#E9E4D5', 200: '#D6D0BC', 300: '#BBB49E', 400: '#9A9583',
  500: '#78735F', 600: '#565243', 700: '#3B382D', 750: '#302E24', 800: '#24221B',
  850: '#1C1A14', 900: '#16150F', 950: '#0F0E09',
};

const halo = {
  DEFAULT: '#EDEBE6', soft: '#F7F6F2', dim: '#B6B3AC', glow: '#F2F0EB', deep: '#6E6B64',
};

const patina = { 300: '#D6C57C', 400: '#BFA24C', 500: '#9C7F30' };

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mist,
        halo,
        patina,
        cream: {
          DEFAULT: '#F4EFE4',
          text: '#1B1610',
          muted: '#6E675F',
          border: '#DCD4C4',
          card: '#EFE9DA',
          diagram: '#E5DFC0',
        },
        danger: {
          DEFAULT: '#E55B4C',
          soft: 'rgba(229, 91, 76, 0.15)',
          border: 'rgba(229, 91, 76, 0.4)',
        },
        ink: mist[950],
        paper: halo.soft,
        "vault-brass": halo.DEFAULT,
        "seal-teal": patina[400],
        "signal-red": "#E55B4C",
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 1px 2px 0 rgba(0,0,0,0.35)',
        panel: '0 1px 2px 0 rgba(0,0,0,0.35)',
        hair: '0 0 0 1px rgba(59,56,45,0.9)',
      },
    },
  },
  plugins: [],
};

