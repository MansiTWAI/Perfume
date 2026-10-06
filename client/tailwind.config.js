/** @type {import('tailwindcss').Config} */
// Tailwind sits beside the site's own CSS. Preflight (Tailwind's reset) is
// off, so every page that does not use Tailwind classes looks as it did.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // container: off too, or Tailwind's own .container (breakpoint widths) would
  // override the site's .container on every page.
  corePlugins: { preflight: false, container: false },
  theme: {
    extend: {
      colors: {
        onyx: '#0d0a09',
        umber: '#17110f',
        burg: '#4b0e14',
        oxblood: '#2b080c',
        ivory: '#f3ede3',
        parch: '#e9e0d1',
        champagne: '#d7c3a0',
        gold: { DEFAULT: '#b8955a', soft: '#d2b684', ink: '#7a5a20' },
        ink: '#1f1714',
        mute: '#a99b90',
      },
      fontFamily: {
        // Quoted: "Bodoni 72" unquoted is invalid CSS and would void the whole list.
        display: ['"Bodoni Moda"', 'Amiri', 'Didot', '"Bodoni 72"', '"Times New Roman"', 'serif'],
        body: ['Jost', '"IBM Plex Sans Arabic"', 'Futura', '"Century Gothic"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { arch: '999px 999px 0 0' },
      letterSpacing: { label: '0.32em' },
      backgroundImage: {
        thread: 'linear-gradient(transparent, #d2b684 40%, #d2b684 60%, transparent)',
      },
    },
  },
  plugins: [],
};
