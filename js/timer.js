import { $, esc } from './utils.js';
let interval=null, total=60, left=60, currentName='Repos';
const CIRC = 2 * Math.PI * 52;
function render(){ $('#timer-left').textContent = String(Math.max(0,left)); const ring=$('#timer-ring'); ring.style.strokeDasharray=CIRC; ring.style.strokeDashoffset = String(CIRC * (1 - left/total)); }
export function stopTimer(){ if(interval) clearInterval(interval); interval=null; $('#timer')?.classList.remove('is-open'); }
export function startTimer(seconds=60, name='Repos'){ stopTimer(); total=Math.max(1,Number(seconds)||60); left=total; currentName=name; $('#timer-exo').textContent = esc(name); $('#timer').classList.add('is-open'); render(); interval=setInterval(()=>{ left-=1; render(); if(left<=0) stopTimer(); },1000); }
export function initTimer(getDefault){ $('#timer-skip')?.addEventListener('click', stopTimer); $('#timer-restart')?.addEventListener('click',()=>startTimer(total,currentName)); document.addEventListener('click', e=>{ const b=e.target.closest('[data-timer-set]'); if(!b) return; startTimer(Number(b.dataset.timerSet), currentName); }); }
