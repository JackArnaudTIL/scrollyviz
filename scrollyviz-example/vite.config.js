import { defineConfig } from 'vite';

// IMPORTANT for GitHub Pages:
// This repo deploys as ONE Pages site at https://<user>.github.io/scrollyviz/,
// with each app in its own sub-folder. So:
//   - `base` must be '/scrollyviz/<app-name>/' so assets resolve under that path.
//   - `outDir` writes into the shared repo-root dist/<app-name>/, which the
//     root deploy workflow (.github/workflows/deploy.yml) publishes.
// If the repo is renamed or moved to a custom domain, update `base` in every app.
export default defineConfig({
  base: '/scrollyviz/scrollyviz-example/',
  build: {
    outDir: '../dist/scrollyviz-example',
    emptyOutDir: true, // needed because outDir sits outside this app's folder
  },
});
