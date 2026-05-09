import { $, esc } from './utils.js';
let interval=null, total=60, left=60, currentName='Repos';
let minimized=false;
const CIRC = 2 * Math.PI * 52;
const MINI_CIRC = 2 * Math.PI * 18;
function ensureMini(){
  if($('#timer-mini')) return;
  const div=document.createElement('button');
  div.id='timer-mini';
  div.className='timer-mini';
  div.innerHTML=`<span class="mini-ring"><svg viewBox="0 0 44 44"><circle class="mini-bg" cx="22" cy="22" r="18"/><circle class="mini-fg" id="timer-mini-ring" cx="22" cy="22" r="18"/></svg><b id="timer-mini-left">60</b></span><span id="timer-mini-name">Repos</span>`;
  document.body.appendChild(div);
  div.addEventListener('click',()=>{ minimized=false; $('#timer')?.classList.add('is-open'); div.classList.remove('is-open'); });
}
function render(){
  const leftTxt=String(Math.max(0,left));
  const main=$('#timer-left'); if(main) main.textContent = leftTxt;
  const mini=$('#timer-mini-left'); if(mini) mini.textContent = leftTxt;
  const ring=$('#timer-ring'); if(ring){ ring.style.strokeDasharray=CIRC; ring.style.strokeDashoffset = String(CIRC * (1 - left/total)); }
  const miniRing=$('#timer-mini-ring'); if(miniRing){ miniRing.style.strokeDasharray=MINI_CIRC; miniRing.style.strokeDashoffset = String(MINI_CIRC * (1 - left/total)); }
}
export function stopTimer(){ if(interval) clearInterval(interval); interval=null; $('#timer')?.classList.remove('is-open'); $('#timer-mini')?.classList.remove('is-open'); }
export function minimizeTimer(){ minimized=true; $('#timer')?.classList.remove('is-open'); ensureMini(); $('#timer-mini')?.classList.add('is-open'); }
export function startTimer(seconds=60, name='Repos'){
  stopTimer(); ensureMini();
  total=Math.max(1,Number(seconds)||60); left=total; currentName=name; minimized=false;
  const title=$('#timer-exo'); if(title) title.textContent = esc(name);
  const miniName=$('#timer-mini-name'); if(miniName) miniName.textContent = name;
  $('#timer')?.classList.add('is-open'); render();
  interval=setInterval(()=>{ left-=1; render(); if(left<=0) stopTimer(); },1000);
}
export function initTimer(getDefault){
  ensureMini();
  $('#timer-skip')?.addEventListener('click', stopTimer);
  $('#timer-minimize')?.addEventListener('click', minimizeTimer);
  $('#timer-restart')?.addEventListener('click',()=>startTimer(total,currentName));
  document.addEventListener('click', e=>{ const b=e.target.closest('[data-timer-set]'); if(!b) return; startTimer(Number(b.dataset.timerSet), currentName); });
}
