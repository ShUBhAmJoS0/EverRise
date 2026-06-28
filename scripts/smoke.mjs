// Zero-dependency runtime smoke test: drives headless Chrome via the DevTools
// Protocol (Node 24 has a built-in WebSocket + fetch) and reports any console
// errors / thrown exceptions while the game boots. Exits non-zero on failure.
import { spawn } from 'node:child_process';

const URL = process.argv[2] || 'http://localhost:3000/';
const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG_PORT = 9333;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${DBG_PORT}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1280,720',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://localhost:${DBG_PORT}/json`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

const errors = [];
const logs = [];

async function run() {
  const target = await cdpTargets();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));

  await new Promise((res) => { ws.onopen = res; });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push('EXCEPTION: ' + (d.exception?.description || d.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      logs.push(`[${msg.params.type}] ${text}`);
      if (msg.params.type === 'error') errors.push('CONSOLE.ERROR: ' + text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push('LOG.ERROR: ' + msg.params.entry.text);
    }
  };

  send('Runtime.enable');
  send('Log.enable');
  send('Page.enable');
  send('Page.navigate', { url: URL });

  await sleep(6000);   // let Boot → Stage1 create() run and animate a bit
  ws.close();
}

run()
  .then(() => {
    chrome.kill();
    console.log(`--- console output (${logs.length} lines) ---`);
    logs.slice(-20).forEach((l) => console.log(l));
    if (errors.length) {
      console.log(`\n❌ ${errors.length} runtime error(s):`);
      errors.forEach((e) => console.log('  ' + e));
      process.exit(1);
    }
    console.log('\n✅ No runtime errors during boot + Stage 1.');
    process.exit(0);
  })
  .catch((e) => { chrome.kill(); console.error('smoke harness failed:', e); process.exit(2); });
