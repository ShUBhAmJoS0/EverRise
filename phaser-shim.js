// Static-server shim (used ONLY when running without a bundler, e.g. VS Code
// Live Server). Phaser's ESM build exposes named exports but no `default`, so a
// bare `import Phaser from 'phaser'` would fail. This re-exports the whole
// namespace as the default so all `import Phaser from 'phaser'` lines work.
//
// Under `npm run dev` / `npm run build`, Vite resolves `phaser` itself and never
// loads this file (the import map in index.html is browser-only).
import * as Phaser from './node_modules/phaser/dist/phaser.esm.js';
export default Phaser;
