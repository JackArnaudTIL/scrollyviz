import { defineConfig } from 'vite';

// See scrollyviz-example/vite.config.js for the GitHub Pages base-path and
// shared-dist notes — same logic applies here.
export default defineConfig({
  base: '/scrollyviz/ai-explained/',
  build: {
    outDir: '../dist/ai-explained',
    emptyOutDir: true,
  },
});
