/** @type {import('postcss-load-config').Config} */
/**
 * PostCSS Configuration
 * Enables Tailwind CSS and Autoprefixer for cross-browser compatibility
 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;