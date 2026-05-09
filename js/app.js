import { MACHINES, GROUPS, GROUP_ICONS } from './machines.js';
import { loadState, saveState, exportState, importState, resetAll, todayKey } from './storage.js';
import { $, $$, esc, fmtDateLong, uid, volume, oneRM, toast, downloadText, confirmModal } from './utils.js';
import { startTimer, initTimer } from './timer.js';

let state = loadState();
state.session ||= { entries: [], cardio: [] };
state.customMachines ||= [];
state.templates ||= [];
state.records ||= {};
state.timers ||= {};
state.settings ||= {};
state.ui ||= { entryOpen: {}, followMode: null };

let route = 'home';
let groupFilter = '';
let sessionTab = 'muscu';
let cardioType = 'marche';
let chart = null;
let statsMode = 'exercise';
let selectedMachineName = null;
let formDraft = { poids: null, series: 1, reps: 10, rm: '' };

const titles = {home:'Accueil', session:'Séance', history:'Historique', stats:'Stats', settings:'Réglages'};
const view = $('#view');

function persist(){ saveState(state); }
function allMachines(){ return [...MACHINES, ...(state.customMachines||[])]; }
function groups(){ return [...new Set([...GROUPS, ...allMachines().map(m=>m.groupe).filter(Boolean)])]; }
function filteredMachines(){ return groupFilter ? allMachines().filter(m=>m.groupe===groupFilter) : allMachines(); }
function machineByName(name){ return allMachines().find(m=>m.nom===name); }
function lastEntryFor(name){ const all=[]; Object.values(state.history||{}).forEach(day=>all.push(...(day.entries||[]))); all.push(...(state.session.entries||[])); return all.reverse().find(e=>e.nom===name); }
function getTimerFor(name){ return Number(state.timers?.[name] || state.settings.timerDefault || 60); }
function updateRecords(entry){ const prev=Number(state.records[entry.nom]||0); if(Number(entry.poids)>prev) state.records[entry.nom]=Number(entry.poids); }
function defaultMachine(){ return machineByName(selectedMachineName) || filteredMachines()[0] || allMachines()[0]; }
function currentMachine(){ return machineByName($('#machine-select')?.value) || defaultMachine(); }
function setTheme(theme){ state.settings.theme = theme; document.documentElement.classList.toggle('light', theme === 'light'); $('#theme-toggle').textContent = theme === 'light' ? '☀️' : '🌙'; persist(); }
function setRoute(next){ route=next; if(next==='session') sessionTab='muscu'; $$('.nav-btn').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route)); $('#page-title').textContent=titles[route]||'GymLog'; render(); }

function home(){
  const days=Object.entries(state.history||{}).sort(([a],[b])=>b.localeCompare(a));
  const entries=days.flatMap(([d,v])=>(v.entries||[]).map(e=>({...e,date:d})));
  const totalVol=entries.reduce((s,e)=>s+volume(e),0);
  const month=new Date().toISOString().slice(0,7);
  const monthCount=days.filter(([d])=>d.startsWith(month)).length;
  const bestRM=Math.max(0,...entries.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  const last=days[0];
  return `<div class="grid">
    <div class="card"><div class="eyebrow">Bonjour ${esc(state.settings.userName||'')}</div><h2 class="home-title">Prêt pour la prochaine séance ?</h2></div>
    <div class="grid-2"><div class="kpi"><strong>${days.length}</strong><span>Séances</span></div><div class="kpi"><strong>${Math.round(totalVol)}</strong><span>Volume total</span></div><div class="kpi"><strong>${monthCount}</strong><span>Ce mois-ci</span></div><div class="kpi"><strong>${bestRM||'—'}</strong><span>Meilleur 1RM</span></div></div>
    <button class="btn primary full" data-route="session">🏋️ Commencer / continuer</button>
    <section><div class="section-title"><h2>Dernière séance</h2></div>${last ? dayCard(last[0], last[1], false) : `<div class="empty">Aucune séance enregistrée.</div>`}</section>
    <section><div class="section-title"><h2>Templates</h2><button class="btn small" data-action="template-new">+ Créer</button></div>${templateList()}</section>
  </div>`;
}

function templateList(){
  if(!state.templates.length) return `<div class="empty">Aucun template. Crée un Push / Pull / Legs par exemple.</div>`;
  return `<div class="list">${state.templates.map(t=>`<div class="item between"><div><div class="item-title">${esc(t.name||t.nom||'Template')}</div><div class="meta">${(t.exercises||t.exercices||[]).length} exercice(s) · mode suivi disponible</div></div><div class="row"><button class="btn small primary" data-action="template-follow" data-id="${t.id}">▶ Suivi</button><button class="btn small" data-action="template-edit" data-id="${t.id}">✏️</button><button class="btn small danger" data-action="template-delete" data-id="${t.id}">✕</button></div></div>`).join('')}</div>`;
}

function sessionView(){ return `<div class="tabs"><button class="tab ${sessionTab==='muscu'?'is-active':''}" data-action="session-tab" data-tab="muscu">Muscu</button><button class="tab ${sessionTab==='cardio'?'is-active':''}" data-action="session-tab" data-tab="cardio">Cardio</button></div>${sessionTab==='cardio' ? cardioForm() : muscuView()}`; }
function muscuView(){
  const m=defaultMachine();
  selectedMachineName = m?.nom || selectedMachineName;
  const last=m?lastEntryFor(m.nom):null;
  const poids = formDraft.poids ?? last?.poids ?? m?.poids?.[0] ?? 20;
  return `<div class="desktop-2"><section class="card"><div class="field"><label>Groupe musculaire</label><div class="chips"><button class="chip ${groupFilter===''?'is-active':''}" data-group="">Tout</button>${groups().map(g=>`<button class="chip ${groupFilter===g?'is-active':''}" data-group="${esc(g)}">${GROUP_ICONS[g]||'📌'} ${esc(g)}</button>`).join('')}</div></div>
  <div class="field"><label>Exercice</label><div class="select-row"><select id="machine-select">${filteredMachines().map(x=>`<option value="${esc(x.nom)}" ${x.nom===m?.nom?'selected':''}>${x.icon||'🏋️'} ${esc(x.nom)}</option>`).join('')}</select><button class="btn small" data-action="machine-edit">✎</button><button class="btn small" data-action="machine-new">+</button></div></div>
  <div id="machine-hint" class="meta"></div>
  <div class="grid-2"><div class="field"><label>Poids</label>${stepper('poids', poids, 0.5)}</div><div class="field"><label>Série actuelle</label>${stepper('series', formDraft.series || 1, 1)}</div></div>
  <div class="grid-2"><div class="field"><label>Reps</label>${stepper('reps', formDraft.reps || last?.reps || 10, 1)}</div><div class="field"><label>1RM réel optionnel</label><input id="real-rm" type="number" min="0" value="${esc(formDraft.rm||'')}" placeholder="ex: 120"></div></div>
  <button class="btn primary full" data-action="entry-add">+ Ajouter la série / exercice</button></section>
  <section><div class="section-title"><h2>${state.ui.followMode ? `Suivi : ${esc(state.ui.followMode.name)}` : 'Séance en cours'}</h2><button class="btn small danger" data-action="session-clear">Effacer</button></div>${followPanel()}${currentSessionList()}<button class="btn primary full save-session" data-action="session-save">💾 Sauvegarder la séance</button></section></div>`;
}
function stepper(id, value, step){ return `<div class="stepper"><button data-step-target="${id}" data-step="-${step}">−</button><input id="${id}" type="number" value="${esc(value)}" step="${step}" min="0"><button data-step-target="${id}" data-step="${step}">+</button></div>`; }
function followPanel(){
  const fm=state.ui.followMode;
  if(!fm) return '';
  const list=(fm.exercises||[]).map((e,i)=>{ const done=(state.session.entries||[]).filter(x=>x.nom===e.nom).length; return `<button class="follow-chip ${selectedMachineName===e.nom?'is-active':''}" data-action="follow-pick" data-name="${esc(e.nom)}"><span>${done?'✅':'○'}</span>${esc(e.nom)} <b>${done}</b></button>`; }).join('');
  return `<div class="follow-box"><div class="between"><span class="muted small-text">Mode suivi : choisis l’exercice, ajoute tes séries, le timer démarre seul.</span><button class="btn small" data-action="follow-stop">Quitter</button></div><div class="follow-list">${list}</div></div>`;
}
function currentSessionList(){
  const e=state.session.entries||[], c=state.session.cardio||[];
  if(!e.length && !c.length) return `<div class="empty">Aucun exercice. Lance-toi.</div>`;
  return `<div class="list">${e.map(entryCard).join('')}${c.map(cardioItem).join('')}</div><div class="card session-total"><div class="between"><span class="muted">Volume séance</span><strong>${Math.round(e.reduce((s,x)=>s+volume(x),0))} kg</strong></div></div>`;
}
function entryCard(e){
  const rm=Number(e.rm1reel)||oneRM(e.poids,e.reps);
  const open = !!state.ui.entryOpen?.[e.id];
  return `<div class="item entry-item"><button class="entry-head" data-action="entry-toggle" data-id="${e.id}"><div><div class="item-title">${e.icon||''} ${esc(e.nom)}</div><div class="meta">${esc(e.groupe||'')} · série ${e.series} · ${e.reps} reps · ${e.poids} kg</div></div><span class="badge blue">1RM ${rm}</span><span class="chev">${open?'⌄':'›'}</span></button><div class="entry-body ${open?'':'hidden'}"><div class="entry-actions"><button class="btn small" data-action="entry-edit" data-id="${e.id}">Modifier</button><button class="btn small ok" data-action="rest-edit" data-name="${esc(e.nom)}">Repos</button><button class="btn small danger" data-action="entry-delete" data-id="${e.id}">Suppr.</button></div></div></div>`;
}

function cardioForm(){ return `<section class="card"><div class="field"><label>Type cardio</label><div class="chips">${['marche','course','velo','escalier'].map(t=>`<button class="chip ${cardioType===t?'is-active':''}" data-cardio-type="${t}">${cardioIcon(t)} ${t}</button>`).join('')}</div></div><div class="grid-3"><div class="field"><label>Durée</label>${stepper('c-duration',20,5)}</div><div class="field"><label>${cardioType==='velo'?'Résistance':cardioType==='escalier'?'Étages':'Vitesse'}</label>${stepper('c-main', cardioType==='velo'?5:cardioType==='escalier'?20:6, cardioType==='velo'||cardioType==='escalier'?1:0.5)}</div><div class="field"><label>${cardioType==='velo'?'RPM':cardioType==='escalier'?'Intensité':'Pente %'}</label>${stepper('c-extra', cardioType==='velo'?80:0, cardioType==='velo'?5:1)}</div></div><button class="btn primary full" data-action="cardio-add">✓ Ajouter cardio</button></section><section><div class="section-title"><h2>Séance en cours</h2></div>${currentSessionList()}</section>`; }
function cardioIcon(t){ return {marche:'🚶',course:'🏃',velo:'🚴',escalier:'🧗'}[t]||'❤️'; }
function cardioItem(c){ return `<div class="item between"><div><div class="item-title">${cardioIcon(c.type)} ${esc(c.type)}</div><div class="meta">${c.duration} min · ${esc(c.label||'')}</div></div><button class="btn small danger" data-action="cardio-delete" data-id="${c.id}">✕</button></div>`; }
function historyView(){ const days=Object.entries(state.history||{}).sort(([a],[b])=>b.localeCompare(a)); return days.length ? `<div class="list">${days.map(([d,v])=>dayCard(d,v,true)).join('')}</div>` : `<div class="empty">Pas encore d’historique.</div>`; }
function dayCard(date, day, deletable){ const entries=day.entries||[], cardio=day.cardio||[]; const vol=entries.reduce((s,e)=>s+volume(e),0); return `<article class="item"><div class="between"><div><div class="item-title">${fmtDateLong(date)}</div><div class="meta">${entries.length} exercice(s) · ${cardio.length} cardio · ${Math.round(vol)} kg</div></div>${deletable?`<button class="btn small danger" data-action="day-delete" data-date="${date}">Suppr.</button>`:''}</div><div class="list day-mini">${entries.slice(0,8).map(e=>`<div class="between"><span class="small-text">${e.icon||''} ${esc(e.nom)}</span><span class="badge ac">${e.series}×${e.reps} · ${e.poids}kg</span></div>`).join('')}${cardio.map(c=>`<div class="between"><span class="small-text">${cardioIcon(c.type)} ${esc(c.type)}</span><span class="badge purple">${c.duration}min</span></div>`).join('')}</div></article>`; }

function statsView(){
  setTimeout(renderChart,0);
  const days=Object.entries(state.history||{}).sort(([a],[b])=>a.localeCompare(b));
  const entries=days.flatMap(([d,v])=>(v.entries||[]).map(e=>({...e,date:d})));
  const best=[...entries].sort((a,b)=>(Number(b.rm1reel)||oneRM(b.poids,b.reps))-(Number(a.rm1reel)||oneRM(a.poids,a.reps))).slice(0,5);
  const frequency = days.slice(-8).map(([d,v])=>`${d.slice(5)} : ${(v.entries||[]).length} exos`).join('<br>') || '—';
  return `<div class="grid"><div class="grid-3"><div class="kpi"><strong>${days.length}</strong><span>Séances</span></div><div class="kpi"><strong>${entries.length}</strong><span>Exercices</span></div><div class="kpi"><strong>${Math.round(entries.reduce((s,e)=>s+volume(e),0))}</strong><span>Volume</span></div></div>
  <div class="tabs stats-tabs"><button class="tab ${statsMode==='exercise'?'is-active':''}" data-action="stats-mode" data-mode="exercise">Par exercice</button><button class="tab ${statsMode==='rm'?'is-active':''}" data-action="stats-mode" data-mode="rm">1RM</button><button class="tab ${statsMode==='group'?'is-active':''}" data-action="stats-mode" data-mode="group">Groupes</button></div>
  <section class="card"><div class="section-title no-margin"><h2>${statsTitle()}</h2></div><div class="chart-box"><canvas id="main-chart"></canvas></div></section>
  <section><div class="section-title"><h2>Records 1RM</h2></div><div class="list">${best.length?best.map(e=>`<div class="item between"><span>${esc(e.nom)}</span><span class="badge blue">${Number(e.rm1reel)||oneRM(e.poids,e.reps)} kg</span></div>`).join(''):`<div class="empty">Aucune donnée.</div>`}</div></section>
  <section><div class="section-title"><h2>Fréquence récente</h2></div><div class="item small-text">${frequency}</div></section></div>`;
}
function statsTitle(){ return statsMode==='rm' ? 'Meilleurs 1RM par exercice' : statsMode==='group' ? 'Volume par groupe' : 'Volume par exercice'; }
function renderChart(){
  const canvas=$('#main-chart'); if(!canvas || !window.Chart) return;
  if(chart) chart.destroy();
  const days=Object.entries(state.history||{});
  const entries=days.flatMap(([d,v])=>(v.entries||[]).map(e=>({...e,date:d})));
  const data={};
  if(statsMode==='group') entries.forEach(e=>data[e.groupe]=(data[e.groupe]||0)+volume(e));
  else if(statsMode==='rm') entries.forEach(e=>data[e.nom]=Math.max(data[e.nom]||0, Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  else entries.forEach(e=>data[e.nom]=(data[e.nom]||0)+volume(e));
  const top=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
  chart=new Chart(canvas,{type:'bar',data:{labels:top.map(x=>x[0]),datasets:[{label:statsTitle(),data:top.map(x=>Math.round(x[1]))}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{display:false}},y:{ticks:{color:getComputedStyle(document.documentElement).getPropertyValue('--muted')}}}}});
}

function settingsView(){ return `<div class="grid"><section class="card"><div class="field"><label>Prénom</label><input id="setting-name" value="${esc(state.settings.userName||'Kevin')}"></div><div class="field"><label>Timer repos par défaut</label><input id="setting-timer" type="number" min="15" step="5" value="${Number(state.settings.timerDefault||60)}"></div><button class="btn primary full" data-action="settings-save">Sauvegarder</button></section><section class="card"><div class="section-title no-margin"><h2>Données</h2></div><button class="btn full" data-action="export-json">Exporter JSON</button><label class="btn full import-label">Importer JSON<input id="import-json" type="file" accept="application/json"></label></section><section class="card danger-zone"><div class="section-title no-margin"><h2>Danger</h2></div><button class="btn danger full" data-action="reset-all">Tout réinitialiser</button></section></div>`; }

function render(){ $('#today-label').textContent=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); $('#page-title').textContent=titles[route]||'GymLog'; view.innerHTML = ({home,session:sessionView,history:historyView,stats:statsView,settings:settingsView}[route]||home)(); afterRender(); }
function afterRender(){ const select=$('#machine-select'); if(select){ select.addEventListener('change', () => { selectedMachineName=select.value; formDraft.series=1; formDraft.rm=''; const last=lastEntryFor(select.value); const m=machineByName(select.value); formDraft.poids=last?.poids ?? m?.poids?.[0] ?? 20; formDraft.reps=last?.reps ?? 10; render(); }); updateMachineHint(); } }
function updateMachineHint(){ const m=currentMachine(); const last=m?lastEntryFor(m.nom):null; const video=m?.video ? ` · <a class="video-link" target="_blank" href="${m.video.startsWith('http')?m.video:'https://youtube.com/watch?v='+m.video}">vidéo</a>` : ''; const el=$('#machine-hint'); if(el) el.innerHTML = m ? `Poids disponibles : ${m.poids?.length||0}${last?` · dernier : ${last.poids}kg × ${last.reps} · repos ${getTimerFor(m.nom)}s`:''}${video}` : ''; }
function captureForm(){ if($('#poids')) formDraft={poids:Number($('#poids').value)||0, series:Number($('#series').value)||1, reps:Number($('#reps').value)||10, rm:$('#real-rm')?.value||''}; }

function addEntry(){
  const m=currentMachine(); if(!m) return toast('Choisis un exercice','warn'); captureForm();
  const entry={id:uid(),nom:m.nom,groupe:m.groupe,icon:m.icon,poids:formDraft.poids,series:formDraft.series||1,reps:formDraft.reps||1,rm1reel:formDraft.rm?Number(formDraft.rm):null,createdAt:new Date().toISOString()};
  entry.rm1est=oneRM(entry.poids,entry.reps); state.session.entries.unshift(entry); updateRecords(entry);
  formDraft.series = Math.min((formDraft.series||1)+1, 99); formDraft.rm='';
  persist(); toast('Série ajoutée','ok'); startTimer(getTimerFor(m.nom), m.nom); render();
}
function addCardio(){ const duration=Number($('#c-duration')?.value)||0; const main=Number($('#c-main')?.value)||0; const extra=Number($('#c-extra')?.value)||0; const label = cardioType==='velo' ? `rés. ${main} · ${extra} rpm` : cardioType==='escalier' ? `${main} étages` : `${main} km/h · pente ${extra}%`; state.session.cardio.unshift({id:uid(),type:cardioType,duration,main,extra,label,createdAt:new Date().toISOString()}); persist(); toast('Cardio ajouté','ok'); render(); }
async function saveSession(){ if(!state.session.entries.length && !state.session.cardio.length) return toast('Séance vide','warn'); const day=todayKey(); const prev=state.history[day] || {entries:[],cardio:[]}; state.history[day]={entries:[...state.session.entries,...(prev.entries||[])], cardio:[...state.session.cardio,...(prev.cardio||[])]}; state.session={entries:[],cardio:[]}; state.ui.followMode=null; formDraft.series=1; persist(); toast('Séance sauvegardée','ok'); setRoute('history'); }

function normalizeTpl(t){ return { id:t.id||uid(), name:t.name||t.nom||'Template', exercises:(t.exercises||t.exercices||[]).map(e=> typeof e==='string'?{nom:e}: {nom:e.nom, series:e.series||3, reps:e.reps||10, poids:e.poids}) }; }
function createTemplateModal(existingId=null){
  const existing=existingId ? normalizeTpl(state.templates.find(t=>t.id===existingId)||{}) : null;
  const selected=new Set((existing?.exercises||[]).map(e=>e.nom));
  const options=allMachines().map(m=>`<option value="${esc(m.nom)}" ${selected.has(m.nom)?'selected':''}>${m.icon||'🏋️'} ${esc(m.nom)}</option>`).join('');
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${existing?'Modifier':'Nouveau'} template</h2><div class="field"><label>Nom</label><input id="tpl-name" value="${esc(existing?.name||'')}" placeholder="Push day"></div><div class="field"><label>Exercices</label><select id="tpl-exos" multiple size="10">${options}</select></div><p class="muted small-text">Ctrl/clic sur PC pour plusieurs choix. Sur mobile, sélectionne puis sauvegarde.</p><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="template-save" data-id="${existingId||''}">${existing?'Enregistrer':'Créer'}</button></div></div></div>`;
}
function saveTemplate(id=null){ const name=$('#tpl-name')?.value.trim(); const selected=$$('#tpl-exos option:checked').map(o=>o.value); if(!name || !selected.length) return toast('Nom + exercices obligatoires','warn'); const tpl={id:id||uid(),name,exercises:selected.map(n=>({nom:n,series:3,reps:10,poids:lastEntryFor(n)?.poids || machineByName(n)?.poids?.[0] || 20}))}; if(id){ state.templates=state.templates.map(t=>t.id===id?tpl:t); } else state.templates.push(tpl); persist(); $('#modal-root').innerHTML=''; toast('Template sauvegardé','ok'); render(); }
async function startFollowTemplate(id){ const t=normalizeTpl(state.templates.find(x=>x.id===id)||{}); if(!t.exercises?.length) return; if(state.session.entries.length && !await confirmModal('Charger ce template en mode suivi ? La séance en cours sera conservée.')) return; state.ui.followMode={id:t.id,name:t.name,exercises:t.exercises}; selectedMachineName=t.exercises[0].nom; const last=lastEntryFor(selectedMachineName); formDraft={poids:last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; persist(); setRoute('session'); }

function machineModal(existingName=null){
  const m=existingName?machineByName(existingName):currentMachine(); const isCustom=!!state.customMachines.find(x=>x.nom===m?.nom);
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${existingName?'Modifier':'Ajouter'} un exercice</h2><div class="field"><label>Nom</label><input id="mach-name" value="${esc(existingName?m?.nom:'')}"></div><div class="field"><label>Groupe</label><select id="mach-group">${groups().map(g=>`<option value="${esc(g)}" ${m?.groupe===g?'selected':''}>${GROUP_ICONS[g]||'📌'} ${esc(g)}</option>`).join('')}</select></div><div class="field"><label>Icône</label><input id="mach-icon" value="${esc(m?.icon||'🏋️')}"></div><div class="field"><label>Poids disponibles, séparés par virgule</label><textarea id="mach-weights" rows="4">${esc((m?.poids||[20]).join(','))}</textarea></div><div class="field"><label>Vidéo URL ou ID YouTube</label><input id="mach-video" value="${esc(m?.video||'')}"></div><p class="muted small-text">Les exercices de base ne sont pas écrasés : si tu modifies un exercice de base, une version personnalisée sera créée avec le même nom.</p><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="machine-save" data-original="${esc(existingName||'')}">Sauvegarder</button></div></div></div>`;
}
function saveMachine(original=''){
  const nom=$('#mach-name').value.trim(); if(!nom) return toast('Nom obligatoire','warn');
  const poids=$('#mach-weights').value.split(',').map(x=>Number(x.trim())).filter(x=>!Number.isNaN(x)&&x>0).sort((a,b)=>a-b);
  const item={nom,groupe:$('#mach-group').value,icon:$('#mach-icon').value.trim()||'🏋️',poids:poids.length?poids:[20],video:$('#mach-video').value.trim()};
  const idx=state.customMachines.findIndex(x=>x.nom===(original||nom));
  if(idx>=0) state.customMachines[idx]=item; else state.customMachines.push(item);
  selectedMachineName=nom; formDraft={poids:lastEntryFor(nom)?.poids ?? item.poids[0], series:1, reps:lastEntryFor(nom)?.reps ?? 10, rm:''};
  persist(); $('#modal-root').innerHTML=''; toast('Exercice sauvegardé','ok'); render();
}
function editEntry(id){ const e=state.session.entries.find(x=>x.id===id); if(!e) return; selectedMachineName=e.nom; formDraft={poids:e.poids,series:e.series,reps:e.reps,rm:e.rm1reel||''}; state.session.entries=state.session.entries.filter(x=>x.id!==id); persist(); render(); toast('Tu peux modifier puis ré-ajouter','ok'); }
async function editRest(name){ const val=prompt(`Temps de repos pour ${name} (secondes)`, getTimerFor(name)); if(val===null) return; const n=Number(val); if(!n || n<5) return toast('Temps invalide','warn'); state.timers[name]=n; persist(); toast('Repos mémorisé','ok'); render(); }

function bindEvents(){ document.addEventListener('click', async e=>{
  const routeBtn=e.target.closest('[data-route]'); if(routeBtn) return setRoute(routeBtn.dataset.route);
  const group=e.target.closest('[data-group]'); if(group){ captureForm(); groupFilter=group.dataset.group; const m=filteredMachines()[0]; selectedMachineName=m?.nom || null; formDraft.series=1; formDraft.poids=null; return render(); }
  const ctype=e.target.closest('[data-cardio-type]'); if(ctype){ cardioType=ctype.dataset.cardioType; return render(); }
  const step=e.target.closest('[data-step-target]'); if(step){ const input=$('#'+step.dataset.stepTarget); input.value=String(Math.max(Number(input.min||0), (Number(input.value)||0)+Number(step.dataset.step))); captureForm(); return; }
  const el=e.target.closest('[data-action]'); const action=el?.dataset.action; if(!action) return;
  if(action==='session-tab'){ sessionTab=el.dataset.tab; render(); }
  if(action==='entry-add') addEntry();
  if(action==='cardio-add') addCardio();
  if(action==='entry-toggle'){ state.ui.entryOpen ||= {}; state.ui.entryOpen[el.dataset.id]=!state.ui.entryOpen[el.dataset.id]; persist(); render(); }
  if(action==='entry-edit') editEntry(el.dataset.id);
  if(action==='rest-edit') editRest(el.dataset.name);
  if(action==='entry-delete'){ state.session.entries=state.session.entries.filter(x=>x.id!==el.dataset.id); persist(); render(); }
  if(action==='cardio-delete'){ state.session.cardio=state.session.cardio.filter(x=>x.id!==el.dataset.id); persist(); render(); }
  if(action==='session-save') saveSession();
  if(action==='session-clear' && await confirmModal('Effacer la séance en cours ?')){ state.session={entries:[],cardio:[]}; state.ui.followMode=null; formDraft.series=1; persist(); render(); }
  if(action==='day-delete' && await confirmModal('Supprimer cette journée ?')){ delete state.history[el.dataset.date]; persist(); render(); }
  if(action==='template-new') createTemplateModal();
  if(action==='template-edit') createTemplateModal(el.dataset.id);
  if(action==='template-save') saveTemplate(el.dataset.id || null);
  if(action==='template-follow') startFollowTemplate(el.dataset.id);
  if(action==='template-delete' && await confirmModal('Supprimer ce template ?')){ state.templates=state.templates.filter(t=>t.id!==el.dataset.id); persist(); render(); }
  if(action==='follow-pick'){ selectedMachineName=el.dataset.name; const last=lastEntryFor(selectedMachineName); formDraft={poids:last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; render(); }
  if(action==='follow-stop'){ state.ui.followMode=null; persist(); render(); }
  if(action==='machine-new') machineModal(null);
  if(action==='machine-edit') machineModal($('#machine-select')?.value);
  if(action==='machine-save') saveMachine(el.dataset.original||'');
  if(action==='modal-close') $('#modal-root').innerHTML='';
  if(action==='stats-mode'){ statsMode=el.dataset.mode; render(); }
  if(action==='settings-save'){ state.settings.userName=$('#setting-name').value.trim()||'Kevin'; state.settings.timerDefault=Number($('#setting-timer').value)||60; persist(); toast('Réglages sauvegardés','ok'); render(); }
  if(action==='export-json') downloadText(`gymlog-backup-${todayKey()}.json`, exportState(state));
  if(action==='reset-all' && await confirmModal('Tout supprimer définitivement ?')){ resetAll(); state=loadState(); setTheme('dark'); setRoute('home'); toast('Application réinitialisée','ok'); }
 });
 $('#theme-toggle').addEventListener('click',()=>setTheme(state.settings.theme==='light'?'dark':'light'));
 document.addEventListener('input', e=>{ if(['poids','series','reps','real-rm'].includes(e.target.id)) captureForm(); });
 document.addEventListener('change', async e=>{ if(e.target.id==='import-json'){ const file=e.target.files[0]; if(!file) return; try{ state=importState(await file.text()); state.customMachines ||= []; state.ui ||= {entryOpen:{},followMode:null}; setTheme(state.settings.theme); toast('Import réussi','ok'); setRoute('home'); }catch(err){ toast('Import impossible : '+err.message,'warn'); } } });
}

setTheme(state.settings.theme || 'dark');
initTimer(()=>state.settings.timerDefault||60);
bindEvents();
render();
