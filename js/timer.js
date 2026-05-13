import { $, esc, toast } from './utils.js';

let interval=null;
let total=60;
let left=60;
let currentName='Repos';
let minimized=false;
let endsAt=0;
let running=false;
let hooksBound=false;
let audioCtx=null;
let finishTimeout=null;

const CIRC = 2 * Math.PI * 52;
const MINI_CIRC = 2 * Math.PI * 18;

function ensureMini(){
  if($('#timer-mini')) return;
  const div=document.createElement('button');
  div.id='timer-mini';
  div.className='timer-mini';
  div.innerHTML=`<span class="mini-ring"><svg viewBox="0 0 44 44"><circle class="mini-bg" cx="22" cy="22" r="18"/><circle class="mini-fg" id="timer-mini-ring" cx="22" cy="22" r="18"/></svg><b id="timer-mini-left">60</b></span><span id="timer-mini-name">Repos</span>`;
  document.body.appendChild(div);
  div.addEventListener('click',()=>{
    minimized=false;
    $('#timer')?.classList.add('is-open');
    div.classList.remove('is-open');
  });
}

function unlockAudio(){
  try{
    const AudioClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioClass) return null;
    audioCtx ||= new AudioClass();
    if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }catch{
    return null;
  }
}

function tone(freq,start,duration,gainNode){
  if(!audioCtx) return;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.type='triangle';
  osc.frequency.setValueAtTime(freq,start);
  gain.gain.setValueAtTime(0.0001,start);
  gain.gain.exponentialRampToValueAtTime(0.22,start+0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
  osc.connect(gain);
  gain.connect(gainNode);
  osc.start(start);
  osc.stop(start+duration+0.03);
}

function playFinishSound(){
  const ctx=unlockAudio();
  if(!ctx||ctx.state!=='running') return;
  audioCtx=ctx;
  const now=audioCtx.currentTime;
  const master=audioCtx.createGain();
  master.gain.setValueAtTime(0.0001,now);
  master.gain.exponentialRampToValueAtTime(0.18,now+0.02);
  master.gain.exponentialRampToValueAtTime(0.0001,now+0.9);
  master.connect(audioCtx.destination);
  tone(523.25,now,0.18,master);
  tone(659.25,now+0.16,0.18,master);
  tone(783.99,now+0.32,0.34,master);
}

function syncLeft(){
  if(!running || !endsAt) return;
  left=Math.max(0,Math.ceil((endsAt-Date.now())/1000));
}

function updateVisualState(){
  const ending=running && left>0 && left<=Math.min(10,Math.ceil(total*.25));
  const critical=running && left>0 && left<=3;
  [$('#timer'),$('#timer-mini')].forEach(el=>{
    if(!el) return;
    el.classList.toggle('is-ending',ending);
    el.classList.toggle('is-critical',critical);
  });
}

function clearTimerFx(){
  [$('#timer'),$('#timer-mini')].forEach(el=>{
    if(!el) return;
    el.classList.remove('is-ending','is-critical','is-finished');
  });
}

function render(){
  const safeTotal=Math.max(1,total);
  const safeLeft=Math.max(0,left);
  const ratio=Math.max(0,Math.min(1,safeLeft/safeTotal));
  const leftTxt=String(safeLeft);
  const main=$('#timer-left'); if(main) main.textContent=leftTxt;
  const mini=$('#timer-mini-left'); if(mini) mini.textContent=leftTxt;
  const ring=$('#timer-ring');
  if(ring){
    ring.style.strokeDasharray=CIRC;
    ring.style.strokeDashoffset=String(CIRC*(1-ratio));
  }
  const miniRing=$('#timer-mini-ring');
  if(miniRing){
    miniRing.style.strokeDasharray=MINI_CIRC;
    miniRing.style.strokeDashoffset=String(MINI_CIRC*(1-ratio));
  }
  updateVisualState();
}

function hideTimer(){
  clearTimerFx();
  $('#timer')?.classList.remove('is-open');
  $('#timer-mini')?.classList.remove('is-open');
}

function finishTimer(){
  if(!running) return;
  running=false;
  if(interval) clearInterval(interval);
  interval=null;
  left=0;
  render();
  [$('#timer'),$('#timer-mini')].forEach(el=>el?.classList.add('is-finished'));
  const main=$('#timer-left'); if(main) main.textContent='GO';
  const mini=$('#timer-mini-left'); if(mini) mini.textContent='GO';
  const title=$('#timer-exo'); if(title) title.textContent='Repos terminé';
  playFinishSound();
  if(navigator.vibrate) navigator.vibrate([90,45,90,45,130]);
  toast('Repos terminé','ok');
  if(finishTimeout) clearTimeout(finishTimeout);
  finishTimeout=setTimeout(hideTimer,1600);
}

function tick(){
  if(!running) return;
  syncLeft();
  render();
  if(left<=0) finishTimer();
}

function bindResumeHooks(){
  if(hooksBound) return;
  hooksBound=true;
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) tick(); });
  window.addEventListener('focus',tick);
  window.addEventListener('pageshow',tick);
  window.addEventListener('pointerdown',unlockAudio,{passive:true});
  window.addEventListener('touchstart',unlockAudio,{passive:true});
}

export function stopTimer(){
  running=false;
  endsAt=0;
  if(interval) clearInterval(interval);
  if(finishTimeout) clearTimeout(finishTimeout);
  interval=null;
  finishTimeout=null;
  hideTimer();
}

export function minimizeTimer(){
  minimized=true;
  $('#timer')?.classList.remove('is-open');
  ensureMini();
  $('#timer-mini')?.classList.add('is-open');
  updateVisualState();
}

export function startTimer(seconds=60, name='Repos'){
  stopTimer();
  ensureMini();
  bindResumeHooks();
  unlockAudio();
  total=Math.max(1,Number(seconds)||60);
  left=total;
  currentName=name;
  minimized=false;
  running=true;
  endsAt=Date.now()+total*1000;
  const title=$('#timer-exo'); if(title) title.textContent=esc(name);
  const miniName=$('#timer-mini-name'); if(miniName) miniName.textContent=name;
  $('#timer')?.classList.add('is-open');
  $('#timer-mini')?.classList.remove('is-open');
  render();
  interval=setInterval(tick,500);
}

export function initTimer(getDefault){
  ensureMini();
  bindResumeHooks();
  $('#timer-skip')?.addEventListener('click',stopTimer);
  $('#timer-minimize')?.addEventListener('click',minimizeTimer);
  $('#timer-restart')?.addEventListener('click',()=>startTimer(total,currentName));
  document.addEventListener('click',e=>{
    unlockAudio();
    const b=e.target.closest('[data-timer-set]');
    if(!b) return;
    startTimer(Number(b.dataset.timerSet),currentName);
  });
}
