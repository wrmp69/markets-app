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
let lastBeepLeft=null;

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

function tone(freq,start,duration,gainNode,type='square',peak=.72){
  if(!audioCtx) return;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(freq,start);
  gain.gain.setValueAtTime(0.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.001,peak),start+0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
  osc.connect(gain);
  gain.connect(gainNode);
  osc.start(start);
  osc.stop(start+duration+0.04);
}

function audioBus(now,until){
  const master=audioCtx.createGain();
  const compressor=audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18,now);
  compressor.knee.setValueAtTime(20,now);
  compressor.ratio.setValueAtTime(8,now);
  compressor.attack.setValueAtTime(.003,now);
  compressor.release.setValueAtTime(.18,now);
  master.gain.setValueAtTime(0.0001,now);
  master.gain.exponentialRampToValueAtTime(.72,now+.018);
  master.gain.exponentialRampToValueAtTime(0.0001,until);
  master.connect(compressor);
  compressor.connect(audioCtx.destination);
  return master;
}

function playCountdownBeep(n){
  const ctx=unlockAudio();
  if(!ctx||ctx.state!=='running') return;
  audioCtx=ctx;
  const now=audioCtx.currentTime;
  const master=audioBus(now,now+.18);
  tone(n===1?1046:880,now,.10,master,'square',.38);
}

function playFinishSound(){
  const ctx=unlockAudio();
  if(!ctx||ctx.state!=='running') return;
  audioCtx=ctx;
  const now=audioCtx.currentTime;
  const master=audioBus(now,now+1.55);
  tone(659.25,now,.16,master,'square',.82);
  tone(880,now+.17,.16,master,'square',.82);
  tone(1046.5,now+.34,.18,master,'square',.86);
  tone(1318.5,now+.54,.34,master,'sawtooth',.78);
  tone(392,now+.54,.40,master,'triangle',.50);
  tone(988,now+.92,.28,master,'square',.70);
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
  lastBeepLeft=null;
  if(interval) clearInterval(interval);
  interval=null;
  left=0;
  render();
  [$('#timer'),$('#timer-mini')].forEach(el=>el?.classList.add('is-finished'));
  const main=$('#timer-left'); if(main) main.textContent='GO';
  const mini=$('#timer-mini-left'); if(mini) mini.textContent='GO';
  const title=$('#timer-exo'); if(title) title.textContent='Repos terminé';
  playFinishSound();
  if(navigator.vibrate) navigator.vibrate([130,55,130,55,190,55,260]);
  toast('Repos terminé','ok');
  if(finishTimeout) clearTimeout(finishTimeout);
  finishTimeout=setTimeout(hideTimer,2300);
}

function tick(){
  if(!running) return;
  syncLeft();
  if(left>0 && left<=3 && left!==lastBeepLeft){
    lastBeepLeft=left;
    playCountdownBeep(left);
    if(navigator.vibrate) navigator.vibrate(left===1?[70,30,70]:55);
  }
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
  lastBeepLeft=null;
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
  lastBeepLeft=null;
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
