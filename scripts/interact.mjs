// Drives real keyboard input at the running game via CDP and reports any
// exception thrown while exercising movement / jump / attack / combo / dodge.
import { spawn } from 'node:child_process';
const URL = process.argv[2] || 'http://localhost:3000/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG = 9336;
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--use-gl=swiftshader',`--remote-debugging-port=${DBG}`,'--no-first-run','--no-default-browser-check','--window-size=1280,720','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target(){ for(let i=0;i<30;i++){ try{ const l=await (await fetch(`http://localhost:${DBG}/json`)).json(); const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl); if(p)return p;}catch{} await sleep(200);} throw new Error('no target'); }
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pending=new Map(); const errors=[];
const cmd=(m,p={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
await new Promise(r=>{ws.onopen=r;});
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}
  if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;errors.push(d.exception?.description||d.text);}
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'){errors.push('console.error '+(m.params.args||[]).map(a=>a.value??'').join(' '));}
};
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Page.navigate',{url:URL});
await sleep(3500);   // let Stage 1 boot

const key = async (code, vk, keyName, location=0) => {
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',code,windowsVirtualKeyCode:vk,key:keyName,location});
  await sleep(60);
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',code,windowsVirtualKeyCode:vk,key:keyName,location});
  await sleep(120);
};

// Move right toward the first wolf, jump, attack, combo, dodge.
await cmd('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyD',windowsVirtualKeyCode:68,key:'d'});
await sleep(1200);                                   // hold run right
await key('Space',32,' ');                           // jump
await key('Space',32,' ');                           // double jump
await sleep(400);
await key('Enter',13,'Enter');                       // standard attack
await sleep(500);
await key('ShiftRight',16,'Shift',2);                // combo attack
await sleep(700);
await key('KeyQ',81,'q');                            // dodge
await cmd('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyD',windowsVirtualKeyCode:68,key:'d'});
await sleep(800);

// Confirm the player is alive and has moved.
const playerX = (await cmd('Runtime.evaluate',{expression:`window.__EVERRISE__?.scene?.getScene('Stage1Scene')?._player?.x ?? -1`,returnByValue:true})).result?.value;
console.log('player.x after input:', playerX, '(spawn was 150 — should be larger if movement works)');
console.log('errors during interaction:', errors.length);
errors.forEach(e=>console.log('  '+e));
ws.close(); chrome.kill();
process.exit(errors.length ? 1 : 0);
