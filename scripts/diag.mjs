import { spawn } from 'node:child_process';
const URL = process.argv[2] || 'http://localhost:3000/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG = 9335;
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu',`--remote-debugging-port=${DBG}`,'--no-first-run','--no-default-browser-check','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target(){ for(let i=0;i<30;i++){ try{ const l=await (await fetch(`http://localhost:${DBG}/json`)).json(); const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl); if(p)return p; }catch{} await sleep(200);} throw new Error('no target'); }
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pending=new Map();
const cmd=(m,p={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
await new Promise(r=>{ws.onopen=r;});
const events=[];
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}
  if(m.method==='Runtime.exceptionThrown'){events.push('EXC: '+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));}
  if(m.method==='Runtime.consoleAPICalled'){events.push('['+m.params.type+'] '+(m.params.args||[]).map(a=>a.value??a.description??'').join(' '));}
  if(m.method==='Log.entryAdded'){events.push('LOG['+m.params.entry.level+']: '+m.params.entry.text);}
};
await cmd('Runtime.enable'); await cmd('Log.enable'); await cmd('Network.enable'); await cmd('Page.enable');
await cmd('Page.navigate',{url:URL});
await sleep(5000);
const ev = async (expr) => (await cmd('Runtime.evaluate',{expression:expr,returnByValue:true})).result?.value;
console.log('typeof Phaser     :', await ev('typeof window.Phaser'));
console.log('canvas count      :', await ev('document.querySelectorAll("canvas").length'));
console.log('body bg           :', await ev('getComputedStyle(document.body).backgroundColor'));
console.log('game scenes active:', await ev('window.Phaser && window.Phaser.GAMES ? window.Phaser.GAMES.length : "n/a"'));
console.log('--- events ---'); events.slice(-25).forEach(e=>console.log(e));
ws.close(); chrome.kill(); process.exit(0);
