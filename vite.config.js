import { defineConfig } from 'vite';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

// The game's art lives in `assets/` at the project root (not in `public/`), and
// it's referenced by plain string URLs like 'assets/backgrounds/…png' in
// BootScene. Vite serves the project root in dev, so those URLs resolve there —
// but `vite build` only copies `public/` into `dist/`, so without help the built
// game would ship with zero sprites. This plugin copies `assets/` into
// `dist/assets/` after the bundle is written (merging alongside the JS chunk
// that Vite already emits there). Build-only, so dev is untouched.
function copyGameAssets() {
  return {
    name: 'copy-game-assets',
    apply: 'build',
    async closeBundle() {
      await cp(resolve('assets'), resolve('dist/assets'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
  plugins: [copyGameAssets()],
});
