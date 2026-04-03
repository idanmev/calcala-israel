/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
    "./js/**/*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#0F172A",
        "primary-light": "#1E293B",
        "background-light": "#F8FAFC",
        "background-dark": "#020617",
        "accent": "#F97316",
        "accent-secondary": "#EC4899",
        "success": "#10B981",
        "error": "#EF4444",
        "conversion-bg": "#FEFCE8",
        "text-main": "#334155",
        "text-muted": "#64748B",
        "border-color": "#E2E8F0",
      },
      fontFamily: {
        "heading": ["Heebo", "sans-serif"],
        "body": ["Assistant", "sans-serif"],
        "mono": ["Rubik", "sans-serif"],
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sticky': '0 -2px 10px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        DEFAULT: "2px",
        "sm": "2px",
        "md": "4px",
        "lg": "4px",
        "full": "9999px",
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
