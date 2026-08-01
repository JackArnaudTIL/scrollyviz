import { defineConfig } from 'vite';

// IMPORTANT for GitHub Pages:
// A project site is served from https://<user>.github.io/<repo-name>/
// so assets must be requested under that sub-path. Set `base` to '/<repo-name>/'.
// If you deploy to a user/org site (<user>.github.io) or a custom domain,
// change this back to '/'.
export default defineConfig({
  base: '/scrollyviz-example/',
});
