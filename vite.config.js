import { defineConfig } from 'vite';

// The game's art lives in `assets/` at the project root (not in `public/`), and
// it's referenced by plain string URLs like 'assets/backgrounds/…png' in
// BootScene. Vite serves the project root in dev, so those URLs resolve there —
// but `vite build` only copies `public/` into `dist/`, so without help the built
// game would ship with zero sprites. This plugin copies `assets/` into
// `dist/assets/` after the bundle is written (merging alongside the JS chunk
// that Vite already emits there). Build-only, so dev is untouched.
//
// The fs/path helpers are imported LAZILY inside closeBundle (not at the top of
// this config) so that loading the config for `npm run dev` never touches them —
// a stray top-level import that an older Node can't resolve would take the whole
// dev server down with it.
function copyGameAssets() {
  return {
    name: 'copy-game-assets',
    apply: 'build',
    async closeBundle() {
      const { cp } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
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
