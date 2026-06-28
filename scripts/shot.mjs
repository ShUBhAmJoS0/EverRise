// Capture a PNG screenshot of the running game via headless Chrome + CDP.
// Usage: node scripts/shot.mjs <url> <outfile> [waitMs]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const URL  = process.argv[2] || 'http://localhost:3000/';
const OUT  = process.argv[3] || 'shot.png';
const WAIT = Number(process.argv[4] || 3500);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG = 9334;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader', `--remote-debugging-port=${DBG}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1280,720', '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch(`http://localhost:${DBG}/json`)).json();
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch {}
    await sleep(200);
  }
  throw new Error('no devtools target');
}

const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const cmd = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
await new Promise((r) => { ws.onopen = r; });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };

await cmd('Page.enable');
await cmd('Page.navigate', { url: URL });
await sleep(WAIT);
const { data } = await cmd('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT, Buffer.from(data, 'base64'));
ws.close();
chrome.kill();
console.log('wrote', OUT);
process.exit(0);
