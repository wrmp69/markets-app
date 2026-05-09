export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
export const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const fmtDate = key => new Date(key+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short', day:'numeric', month:'short'});
export const fmtDateLong = key => new Date(key+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long', year:'numeric'});
export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
export const volume = e => Number(e.poids||0)*Number(e.reps||0)*Number(e.series||0);
export const oneRM = (poids,reps) => { poids=Number(poids)||0; reps=Number(reps)||0; return reps<=1 ? Math.round(poids) : Math.round(poids*(1+reps/30)); };
export function toast(message, type='info'){ const root=$('#toast-root'); if(!root) return; const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; root.appendChild(el); setTimeout(()=>el.remove(),2600); }
export function downloadText(filename, text){ const blob=new Blob([text],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
export function confirmModal(message, title='Confirmation'){ return new Promise(resolve=>{ const root=$('#modal-root'); root.innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${esc(title)}</h2><p class="muted">${esc(message)}</p><div class="modal-actions"><button class="btn secondary" data-no>Annuler</button><button class="btn danger" data-yes>Confirmer</button></div></div></div>`; root.querySelector('[data-no]').onclick=()=>{root.innerHTML='';resolve(false)}; root.querySelector('[data-yes]').onclick=()=>{root.innerHTML='';resolve(true)}; }); }
