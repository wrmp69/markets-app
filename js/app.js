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
state.settings.timerDefault ||= 60;
state.bodyWeight ||= [];
state.rpeLog ||= {};
state.ui ||= { entryOpen: {}, followMode: null, followScroll: 0 };

let route = 'home';
let groupFilter = '';
let sessionTab = 'muscu';
let cardioType = 'marche';
let chart = null;
let detailChart = null;
let statsMode = 'trend';
let statsRange = 'month';
let statsMetric = 'weight';
let selectedMachineName = null;
let exerciseDetailName = null;
let exerciseRange = 'all';
let exerciseMetric = 'weight';
let formDraft = { poids: null, series: 1, reps: 10, rm: '', rpe: '' };

const titles = {home:'Accueil', session:'Séance', history:'Historique', stats:'Stats', settings:'Réglages', exercise:'Fiche exercice'};
const view = $('#view');

function persist(){ saveState(state); }
function allMachines(){ return [...MACHINES, ...(state.customMachines||[])]; }
function groups(){ return [...new Set([...GROUPS, ...allMachines().map(m=>m.groupe).filter(Boolean)])]; }
function filteredMachines(){ return groupFilter ? allMachines().filter(m=>m.groupe===groupFilter) : allMachines(); }
function machineByName(name){ return allMachines().find(m=>m.nom===name); }
function lastEntryFor(name){ const all=[]; Object.values(state.history||{}).forEach(day=>all.push(...(day.entries||[]))); all.push(...(state.session.entries||[])); return all.reverse().find(e=>e.nom===name); }
function entriesForExercise(name){ const all=[]; Object.values(state.history||{}).forEach(day=>all.push(...(day.entries||[]))); all.push(...(state.session.entries||[])); return all.filter(e=>e.nom===name); }
function maxWeightFor(name){ const rows=entriesForExercise(name); return rows.length ? Math.max(...rows.map(e=>Number(e.poids)||0)) : null; }
function maxRepsForWeight(name, poids){ const p=Number(poids); const rows=entriesForExercise(name).filter(e=>Number(e.poids)===p); return rows.length ? Math.max(...rows.map(e=>Number(e.reps)||0)) : null; }

function latestWorkoutEntriesFor(name){
  const buckets = [];

  const currentRows = (state.session.entries || [])
    .filter(e => e.nom === name && Number(e.poids) > 0 && Number(e.reps) > 0);

  if(currentRows.length){
    buckets.push({ date:'session', rows: currentRows });
  }

  Object.entries(state.history || {}).forEach(([date, day]) => {
    const rows = (day.entries || [])
      .filter(e => e.nom === name && Number(e.poids) > 0 && Number(e.reps) > 0);
    if(rows.length) buckets.push({ date, rows });
  });

  if(!buckets.length) return [];

  buckets.sort((a,b) => {
    if(a.date === 'session') return 1;
    if(b.date === 'session') return -1;
    return a.date.localeCompare(b.date);
  });

  return buckets.at(-1).rows
    .slice()
    .sort((a,b) => (Number(a.series)||0) - (Number(b.series)||0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function preferredWeightForExercise(name){
  const latest = latestWorkoutEntriesFor(name);
  if(latest.length){
    return Math.max(...latest.map(e => Number(e.poids) || 0));
  }
  const max = maxWeightFor(name);
  return max || null;
}

function getExerciseGoal(name){
  const latest = latestWorkoutEntriesFor(name);
  if(!latest.length) return null;

  const machine = machineByName(name);
  const step = Number(machine?.step || 2.5);
  const targetWeight = Math.max(...latest.map(e => Number(e.poids) || 0));
  const rowsAtTarget = latest.filter(e => Number(e.poids) === targetWeight);
  const baseRows = rowsAtTarget.length ? rowsAtTarget : latest;

  const repsBySet = baseRows.map(e => Number(e.reps) || 0).filter(Boolean);
  const sets = repsBySet.length || latest.length;
  const maxReps = Math.max(...repsBySet);
  const targetReps = repsBySet.map((r, i) => i === repsBySet.length - 1 ? r + 1 : r);
  const heavierTarget = Math.round((targetWeight + step) * 10) / 10;

  return {
    main: `${targetWeight} kg · ${targetReps.join(' / ')} reps`,
    alt: maxReps >= 10 ? `${heavierTarget} kg · ${Math.max(5, Math.round(maxReps * 0.75))} reps` : null,
    reason: `Dernière séance : ${sets} série${sets > 1 ? 's' : ''} à ${targetWeight} kg (${repsBySet.join(' / ')} reps)`
  };
}

function warmupSuggestionFor(name){
  const goal = getExerciseGoal(name);
  if(!goal) return null;
  const target = Number(String(goal.main).match(/([\d.]+)\s*kg/)?.[1] || 0);
  if(!target || target < 10) return null;
  const round = v => Math.round(v * 2) / 2;
  const sets = [
    { poids: Math.max(2.5, round(target * 0.4)), reps: 12 },
    { poids: Math.max(2.5, round(target * 0.6)), reps: 8 },
    { poids: Math.max(2.5, round(target * 0.8)), reps: 4 }
  ].filter((s, i, arr) => i === 0 || s.poids > arr[i - 1].poids);
  return sets.map(s => `${s.poids}×${s.reps}`).join(' · ');
}

function workoutBucketsForExercise(name){
  const buckets=[];
  Object.entries(state.history||{}).forEach(([date,day])=>{
    const rows=(day.entries||[]).filter(e=>e.nom===name&&Number(e.poids)>0&&Number(e.reps)>0);
    if(rows.length) buckets.push({date,rows:rows.slice().sort((a,b)=>(Number(a.series)||0)-(Number(b.series)||0)||new Date(a.createdAt||0)-new Date(b.createdAt||0))});
  });
  const current=(state.session.entries||[]).filter(e=>e.nom===name&&Number(e.poids)>0&&Number(e.reps)>0);
  if(current.length) buckets.push({date:'session',rows:current.slice().sort((a,b)=>(Number(a.series)||0)-(Number(b.series)||0)||new Date(a.createdAt||0)-new Date(b.createdAt||0))});
  return buckets.sort((a,b)=>a.date==='session'?1:b.date==='session'?-1:a.date.localeCompare(b.date));
}

function progressionAIFor(name){
  const buckets=workoutBucketsForExercise(name), rows=entriesForExercise(name).filter(e=>Number(e.poids)>0&&Number(e.reps)>0);
  const machine=machineByName(name), step=Number(machine?.step||2.5);
  if(rows.length<3||buckets.length<2) return {level:'learn',score:35,label:'🧠 IA en apprentissage',headline:'Encore un peu de données',advice:'Fais 2-3 séances sur cet exercice pour que la recommandation devienne fiable.',action:'Garde une exécution propre.',target:null,detail:'Historique encore court.'};

  const latest=buckets.at(-1), prev=buckets.at(-2), recent=buckets.slice(-4);
  const latestRows=latest.rows, prevRows=prev.rows;
  const targetWeight=Math.max(...latestRows.map(e=>Number(e.poids)||0));
  const targetRows=latestRows.filter(e=>Number(e.poids)===targetWeight);
  const reps=targetRows.map(e=>Number(e.reps)||0).filter(Boolean);
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  const avgRpe=avg(latestRows.map(e=>Number(e.rpe)).filter(Boolean));
  const prevBestRM=Math.max(0,...prevRows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  const lastBestRM=Math.max(0,...latestRows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  const rmDelta=lastBestRM-prevBestRM;
  const prevSame=prevRows.filter(e=>Number(e.poids)===targetWeight);
  const prevReps=prevSame.length?prevSame.map(e=>Number(e.reps)||0):prevRows.map(e=>Number(e.reps)||0);
  const repDelta=avg(reps)-avg(prevReps);
  const hard=avgRpe>=9, veryHard=avgRpe>=9.5;
  const goodVolume=reps.length>=3&&Math.min(...reps)>=8;
  const easyEnough=!avgRpe||avgRpe<=8;
  const recentTargetSets=rows.filter(e=>Number(e.poids)===targetWeight).slice(-9);
  const validated=recentTargetSets.filter(e=>(Number(e.reps)||0)>=8&&(!e.rpe||Number(e.rpe)<=8)).length>=3;
  const noProgress=recent.length>=3&&recent.map(b=>Math.max(...b.rows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)))).slice(-3).every((v,i,a)=>i===0||v<=a[0]+1);
  const downTrend=rmDelta<-2||repDelta<-1.5;
  const nextWeight=Math.round((targetWeight+step)*10)/10;
  const deloadWeight=Math.max(0,Math.round((targetWeight*0.9)*10)/10);
  const lastReps=reps.length?reps:latestRows.map(e=>Number(e.reps)||0).filter(Boolean);
  const targetReps=lastReps.map((r,i)=>i===lastReps.length-1?r+1:r).join(' / ');

  if(veryHard&&downTrend) return {level:'deload',score:25,label:'🔴 Deload conseillé',headline:'Fatigue détectée',advice:`Baisse à ${deloadWeight} kg aujourd’hui et garde 2-3 reps en réserve.`,action:`${deloadWeight} kg · 8 / 8 / 8 reps`,target:{poids:deloadWeight,reps:'8 / 8 / 8'},detail:`RPE haut + performance en baisse (${rmDelta>0?'+':''}${Math.round(rmDelta)} 1RM).`};
  if(hard) return {level:'hold',score:45,label:'🟠 Maintien intelligent',headline:'Charge exigeante',advice:`Garde ${targetWeight} kg et cherche une série plus propre avant de monter.`,action:`${targetWeight} kg · ${targetReps} reps`,target:{poids:targetWeight,reps:targetReps},detail:`RPE moyen ${Math.round(avgRpe*10)/10}.`};
  if(validated&&goodVolume&&easyEnough) return {level:'up',score:88,label:'🟢 Monte la charge',headline:'Progression validée',advice:`Tu peux tenter ${nextWeight} kg sur la prochaine série/séance.`,action:`${nextWeight} kg · ${Math.max(5,Math.round(Math.max(...reps)*0.75))} reps`,target:{poids:nextWeight,reps:Math.max(5,Math.round(Math.max(...reps)*0.75))},detail:`Plusieurs séries validées à ${targetWeight} kg sans RPE haut.`};
  if(noProgress&&avgRpe>=8) return {level:'stagnation',score:40,label:'🟡 Stagnation',headline:'Ne force pas la montée',advice:`Reste à ${targetWeight} kg et vise +1 rep ou un meilleur contrôle.`,action:`${targetWeight} kg · ${targetReps} reps`,target:{poids:targetWeight,reps:targetReps},detail:'Pas de progression nette sur les dernières séances.'};
  if(rmDelta>1||repDelta>0) return {level:'progress',score:72,label:'📈 Bonne tendance',headline:'Continue comme ça',advice:`Reste sur ${targetWeight} kg et ajoute 1 rep sur la dernière série.`,action:`${targetWeight} kg · ${targetReps} reps`,target:{poids:targetWeight,reps:targetReps},detail:`Tendance positive (${rmDelta>0?'+':''}${Math.round(rmDelta)} 1RM).`};
  return {level:'steady',score:58,label:'⚖️ Progression contrôlée',headline:'Séance normale',advice:`Garde ${targetWeight} kg et valide toutes les séries proprement.`,action:`${targetWeight} kg · ${targetReps} reps`,target:{poids:targetWeight,reps:targetReps},detail:'Aucun signal fort de fatigue ou de montée.'};
}

function progressionAdviceFor(name){
  return progressionAIFor(name)?.advice || null;
}

function muscleBalance(daysBack=30){
  const start = new Date(); start.setDate(start.getDate()-daysBack);
  const counts = {};
  Object.entries(state.history||{}).forEach(([date, day]) => {
    if(new Date(date+'T00:00:00') < start) return;
    (day.entries||[]).forEach(e => counts[e.groupe || 'Autres'] = (counts[e.groupe || 'Autres'] || 0) + 1);
  });
  (state.session.entries||[]).forEach(e => counts[e.groupe || 'Autres'] = (counts[e.groupe || 'Autres'] || 0) + 1);
  return counts;
}

function renderMuscleBalance(){
  const data = muscleBalance(30);
  const total = Object.values(data).reduce((a,b)=>a+b,0);
  if(!total) return `<section class="card"><div class="section-title no-margin"><h2>Équilibre musculaire</h2></div><div class="empty small-empty">Pas encore assez de données sur 30 jours.</div></section>`;
  const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]).map(([g,n]) => {
    const pct = Math.round(n/total*100);
    return `<div class="balance-row"><span>${GROUP_ICONS[g]||'📌'} ${esc(g)}</span><b>${n} série(s)</b><div class="balance-bar"><i style="width:${pct}%"></i></div><small>${pct}%</small></div>`;
  }).join('');
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  const msg = sorted.length > 1 && sorted[0][1] >= sorted.at(-1)[1]*2 ? `Attention : beaucoup plus de ${sorted[0][0]} que de ${sorted.at(-1)[0]}.` : `Répartition correcte sur les groupes travaillés.`;
  return `<section class="card"><div class="section-title no-margin"><h2>Équilibre musculaire · 30 jours</h2></div><div class="balance-list">${rows}</div><p class="coach-note">${esc(msg)}</p></section>`;
}

function renderHeatmap(){
  const set = new Set(Object.entries(state.history||{}).filter(([,d]) => (d.entries||[]).length || (d.cardio||[]).length).map(([date]) => date));
  if((state.session.entries||[]).length || (state.session.cardio||[]).length) set.add(todayKey());
  const today = new Date(todayKey()+'T00:00:00');
  const cells = [];
  let activeDays = 0;
  for(let i=55;i>=0;i--){
    const d = new Date(today); d.setDate(today.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const on = set.has(key);
    if(on) activeDays += 1;
    cells.push(`<span class="heat-cell ${on?'on':''}" title="${key}"></span>`);
  }
  const rate = Math.round(activeDays / 56 * 100);
  return `<section class="card"><div class="section-title no-margin"><h2>Régularité</h2><span class="badge ac">${rate}%</span></div><div class="heatmap">${cells.join('')}</div><p class="muted small-text">Chaque carré représente un jour d’entraînement sur les 8 dernières semaines.</p></section>`;
}

function prTimeline(){
  const best = {};
  const events = [];
  Object.entries(state.history||{}).sort(([a],[b])=>a.localeCompare(b)).forEach(([date, day]) => {
    (day.entries||[]).forEach(e => {
      const w = Number(e.poids)||0;
      if(w > (best[e.nom]||0)){
        best[e.nom] = w;
        events.push({date, nom:e.nom, poids:w, reps:e.reps, icon:e.icon});
      }
    });
  });
  return events.slice(-8).reverse();
}

function renderPRTimeline(){
  const events = prTimeline();
  if(!events.length) return `<section class="card"><div class="section-title no-margin"><h2>PR timeline</h2></div><div class="empty small-empty">Aucun record détecté pour l’instant.</div></section>`;
  return `<section class="card"><div class="section-title no-margin"><h2>PR timeline</h2></div><div class="pr-list">${events.map(e=>`<div class="pr-item"><span>${e.icon||'🏆'}</span><div><b>${esc(e.nom)}</b><small>${esc(e.date)} · ${e.poids} kg × ${e.reps}</small></div></div>`).join('')}</div></section>`;
}

function detailRowsForExercise(name){
  const rows=[];
  Object.entries(state.history||{}).forEach(([date,day])=>(day.entries||[]).filter(e=>e.nom===name).forEach(e=>rows.push({...e,date})));
  (state.session.entries||[]).filter(e=>e.nom===name).forEach(e=>rows.push({...e,date:'session'}));
  return rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||new Date(a.createdAt||0)-new Date(b.createdAt||0));
}
function exerciseRangeStart(){
  const d=new Date();
  if(exerciseRange==='week') d.setDate(d.getDate()-7);
  else if(exerciseRange==='month') d.setMonth(d.getMonth()-1);
  else if(exerciseRange==='year') d.setFullYear(d.getFullYear()-1);
  else return '';
  return d.toISOString().slice(0,10);
}
function detailRowsFiltered(name){
  const start=exerciseRangeStart();
  return detailRowsForExercise(name).filter(r=>!start||r.date==='session'||r.date>=start);
}
function bestSetForRows(rows){
  if(!rows.length) return null;
  return rows.slice().sort((a,b)=>(Number(b.poids)||0)-(Number(a.poids)||0)||(Number(b.reps)||0)-(Number(a.reps)||0))[0];
}
function rpeAverage(rows){
  const r=rows.map(e=>Number(e.rpe)).filter(Boolean);
  return r.length?Math.round((r.reduce((a,b)=>a+b,0)/r.length)*10)/10:null;
}
function detailPRTimeline(name){
  let best=0;
  return detailRowsForExercise(name).filter(e=>{
    const w=Number(e.poids)||0;
    if(w>best){ best=w; return true; }
    return false;
  }).slice(-8).reverse();
}
function exerciseDetailView(){
  const name=exerciseDetailName||selectedMachineName;
  const m=machineByName(name);
  const rows=detailRowsFiltered(name);
  const allRows=detailRowsForExercise(name);
  const bestWeight=allRows.length?Math.max(...allRows.map(e=>Number(e.poids)||0)):0;
  const bestRM=allRows.length?Math.max(...allRows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps))):0;
  const bestSet=bestSetForRows(allRows);
  const avgRpe=rpeAverage(allRows);
  const goal=getExerciseGoal(name);
  const warm=warmupSuggestionFor(name);
  const advice=progressionAdviceFor(name);
  const ai=progressionAIFor(name);
  setTimeout(renderExerciseChart,0);
  return `<div class="grid">
    <section class="card exercise-hero">
      <div class="between"><div><div class="eyebrow">Fiche exercice</div><h2>${m?.icon||'🏋️'} ${esc(name||'Exercice')}</h2><p>${esc(m?.groupe||'')}</p></div><button class="btn small secondary" data-action="exercise-back">Retour</button></div>
    </section>
    <section class="exercise-kpis">
      <div class="kpi"><strong>${bestWeight||'—'}</strong><span>Record kg</span></div>
      <div class="kpi"><strong>${bestRM||'—'}</strong><span>Meilleur 1RM</span></div>
      <div class="kpi"><strong>${bestSet?`${bestSet.poids}×${bestSet.reps}`:'—'}</strong><span>Meilleure série</span></div>
      <div class="kpi"><strong>${avgRpe||'—'}</strong><span>RPE moyen</span></div>
    </section>
    <section class="card">${ai?`<div class="detail-ai ${ai.level}"><span>${ai.label}</span><h3>${esc(ai.headline)}</h3><b>${esc(ai.action||ai.advice)}</b><em>${esc(ai.detail||'')}</em><div class="ai-meter"><i style="width:${Math.max(5,Math.min(100,ai.score||50))}%"></i></div></div>`:''}${goal?`<div class="detail-goal"><span>🎯 Objectif</span><b>${goal.main}</b>${goal.alt?`<small>Option lourde : ${goal.alt}</small>`:''}<em>${goal.reason}</em></div>`:''}${warm?`<div class="detail-line"><span>🔥 Échauffement</span><b>${warm}</b></div>`:''}${advice?`<div class="detail-line"><span>🧠 Conseil</span><b>${esc(advice)}</b></div>`:''}</section>
    <section class="card"><div class="section-title no-margin"><h2>Progression</h2></div>
      <div class="chips"><button class="chip ${exerciseMetric==='weight'?'is-active':''}" data-action="exercise-metric" data-metric="weight">Poids</button><button class="chip ${exerciseMetric==='reps'?'is-active':''}" data-action="exercise-metric" data-metric="reps">Reps</button><button class="chip ${exerciseMetric==='rm'?'is-active':''}" data-action="exercise-metric" data-metric="rm">1RM</button></div>
      <div class="chips detail-ranges"><button class="chip ${exerciseRange==='week'?'is-active':''}" data-action="exercise-range" data-range="week">7j</button><button class="chip ${exerciseRange==='month'?'is-active':''}" data-action="exercise-range" data-range="month">30j</button><button class="chip ${exerciseRange==='year'?'is-active':''}" data-action="exercise-range" data-range="year">1 an</button><button class="chip ${exerciseRange==='all'?'is-active':''}" data-action="exercise-range" data-range="all">Tout</button></div>
      <div class="chart-box"><canvas id="exercise-chart"></canvas></div>
    </section>
    <section class="card"><div class="section-title no-margin"><h2>Timeline records</h2></div>${detailPRTimeline(name).length?`<div class="pr-list">${detailPRTimeline(name).map(e=>`<div class="pr-item"><span>🏆</span><div><b>${e.poids} kg</b><small>${e.date==='session'?'Séance en cours':esc(e.date)} · ${e.reps} reps${e.rpe?` · RPE ${e.rpe}`:''}</small></div></div>`).join('')}</div>`:`<div class="empty small-empty">Aucun record détecté.</div>`}</section>
    <section class="card"><div class="section-title no-margin"><h2>Historique récent</h2></div>${rows.length?`<div class="list">${rows.slice(-12).reverse().map(e=>`<div class="item between"><div><div class="item-title">${e.poids} kg × ${e.reps}</div><div class="meta">${e.date==='session'?'Séance en cours':esc(e.date)} · série ${e.series}${e.rpe?` · RPE ${e.rpe}`:''}</div></div><span class="badge blue">1RM ${Number(e.rm1reel)||oneRM(e.poids,e.reps)}</span></div>`).join('')}</div>`:`<div class="empty small-empty">Pas encore de données.</div>`}</section>
  </div>`;
}
function renderExerciseChart(){
  const canvas=$('#exercise-chart'); if(!canvas||!window.Chart) return;
  if(detailChart) detailChart.destroy();
  const rows=detailRowsFiltered(exerciseDetailName||selectedMachineName);
  const muted=getComputedStyle(document.documentElement).getPropertyValue('--muted');
  const values=rows.map(e=>exerciseMetric==='reps'?Number(e.reps):exerciseMetric==='rm'?(Number(e.rm1reel)||oneRM(e.poids,e.reps)):Number(e.poids));
  const labels=rows.map(e=>e.date==='session'?'Now':String(e.date).slice(5));
  detailChart=new Chart(canvas,{type:'line',data:{labels,datasets:[{label:exerciseMetric,data:values,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:muted,maxRotation:0}},y:{ticks:{color:muted}}}}});
}
function getFollowDraft(name){ return state.ui?.followDrafts?.[name] || null; }
function rememberFollowDraft(name=selectedMachineName){ if(!state.ui?.followMode || !name) return; state.ui.followDrafts ||= {}; state.ui.followDrafts[name] = {...formDraft}; }
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
function liveDashboard(){
  const entries=state.session.entries||[], m=defaultMachine();
  const name=m?.nom||selectedMachineName, goal=name?getExerciseGoal(name):null, ai=name?progressionAIFor(name):null;
  const currentRows=entries.filter(e=>e.nom===name), startedAt=entries.at(-1)?.createdAt;
  const mins=startedAt?Math.max(1,Math.round((Date.now()-new Date(startedAt).getTime())/60000)):0;
  const last=currentRows[0], best=maxRepsForWeight(name,Number($('#poids')?.value||formDraft.poids||last?.poids||0));
  const recordPossible=best&&Number(formDraft.reps)>=best, rest=getTimerFor(name);
  const fm=state.ui.followMode, remaining=fm?(fm.exercises||[]).map(x=>x.nom).filter(n=>entries.filter(e=>e.nom===n).length<3):[];
  const signal=recordPossible?'🔥 Record possible':(ai?.level==='deload'?'⚠️ Allège':ai?.level==='up'?'📈 Monte bientôt':ai?.level==='hold'?'✅ Stable':'—');

  if(!entries.length&&!fm){
    return `<div class="coach-dashboard compact"><div class="coach-main"><b>🚀 Prêt</b><span>${goal?`Objectif : ${goal.main}`:'Choisis un exercice et lance ta première série.'}</span></div></div>`;
  }

  return `<div class="coach-dashboard compact">
    <div class="coach-main"><b>🏋️ ${esc(name||'Exercice')}</b><span>${goal?`🎯 ${goal.main}`:'Objectif : démarre proprement'}</span></div>
    <div class="coach-quick"><span>⏱ ${mins||'—'} min</span><span>Repos ${rest}s</span><span>${signal}</span></div>
    ${fm?`<div class="coach-note">📋 Restant : ${remaining.length?remaining.slice(0,3).map(esc).join(', '):'template terminé ✅'}</div>`:''}
  </div>`;
}
function muscuView(){
  const m=defaultMachine();
  selectedMachineName = m?.nom || selectedMachineName;
  const last=m?lastEntryFor(m.nom):null;
  const followDraft = m ? getFollowDraft(m.nom) : null;
 const activeFollowDraft = state.ui.followMode ? followDraft : null;
 const preferredWeight = m ? preferredWeightForExercise(m.nom) : null;
 const poids = formDraft.poids ?? activeFollowDraft?.poids ?? preferredWeight ?? last?.poids ?? m?.poids?.[0] ?? 20;
 const series = formDraft.series ?? activeFollowDraft?.series ?? 1;
 const reps = formDraft.reps ?? activeFollowDraft?.reps ?? last?.reps ?? 10;
 const rm = formDraft.rm ?? activeFollowDraft?.rm ?? '';
 const rpe = formDraft.rpe ?? activeFollowDraft?.rpe ?? '';
  return `${liveDashboard()}<div class="desktop-2"><section class="card"><div class="field"><label>Groupe musculaire</label><div class="chips"><button class="chip ${groupFilter===''?'is-active':''}" data-group="">Tout</button>${groups().map(g=>`<button class="chip ${groupFilter===g?'is-active':''}" data-group="${esc(g)}">${GROUP_ICONS[g]||'📌'} ${esc(g)}</button>`).join('')}</div></div>
  <div class="field"><label>Exercice</label><div class="select-row"><select id="machine-select">${filteredMachines().map(x=>`<option value="${esc(x.nom)}" ${x.nom===m?.nom?'selected':''}>${x.icon||'🏋️'} ${esc(x.nom)}</option>`).join('')}</select><button class="btn small" data-action="exercise-open" title="Fiche exercice">📊</button><button class="btn small" data-action="video-open" title="Vidéo">📹</button><button class="btn small" data-action="machine-edit">✎</button><button class="btn small" data-action="machine-new">+</button></div></div>
  <div id="machine-hint" class="exercise-insights"></div>
  <div class="grid-2"><div class="field"><label>Poids</label>${stepper('poids', poids, Number(m?.step||0.5))}</div><div class="field"><label>Série actuelle</label>${stepper('series', series, 1)}</div></div>
  <div class="grid-2"><div class="field"><label>Reps</label>${stepper('reps', reps, 1)}</div><div class="field"><label>1RM réel optionnel</label><input id="real-rm" type="number" min="0" value="${esc(rm||'')}" placeholder="ex: 120"></div></div>
  <div class="field"><label>Ressenti / RPE</label><div class="rpe-chips">${[6,7,8,9,10].map(n=>`<button type="button" class="rpe-chip ${Number(rpe)===n?'is-active':''}" data-rpe="${n}">${n}</button>`).join('')}<button type="button" class="rpe-chip ${!rpe?'is-active':''}" data-rpe="">—</button></div></div>
  <button class="btn primary full" data-action="entry-add">+ Ajouter la série / exercice</button></section>
  <section><div class="section-title"><h2>${state.ui.followMode ? `Suivi : ${esc(state.ui.followMode.name)}` : 'Séance en cours'}</h2><button class="btn small danger" data-action="session-clear">Effacer</button></div>${followPanel()}${currentSessionList()}<button class="btn primary full save-session" data-action="session-save">💾 Sauvegarder la séance</button></section></div>`;
}
function stepper(id, value, step){ return `<div class="stepper"><button data-step-target="${id}" data-step="-${step}">−</button><input id="${id}" type="number" value="${esc(value)}" step="${step}" min="0"><button data-step-target="${id}" data-step="${step}">+</button></div>`; }
function followPanel(){
  const fm=state.ui.followMode;
  if(!fm) return '';
  const exercises=fm.exercises||[];
  const doneCount = name => (state.session.entries||[]).filter(x=>x.nom===name).length;
  const current = machineByName(selectedMachineName) || machineByName(exercises[0]?.nom);
  const list=exercises.map((e,i)=>{
    const done=doneCount(e.nom);
    const active=selectedMachineName===e.nom;
    return `<button class="follow-card ${active?'is-active':''}" data-action="follow-pick" data-name="${esc(e.nom)}"><span class="follow-index">${done?'✓':i+1}</span><span><b>${esc(e.nom)}</b><small>${done} série(s) faite(s)</small></span></button>`;
  }).join('');
  return `<div class="follow-page"><div class="between"><div><div class="eyebrow">Mode suivi</div><h2>${esc(fm.name)}</h2></div><button class="btn small" data-action="follow-stop">Quitter</button></div><div class="follow-current"><span>${current?.icon||'🏋️'}</span><div><b>Exercice actif</b><strong>${esc(current?.nom||'Choisis un exercice')}</strong><small>${doneCount(current?.nom)} série(s) déjà ajoutée(s)</small></div></div><div class="follow-grid">${list}</div></div>`;
}
function currentSessionList(){
  const e=state.session.entries||[], c=state.session.cardio||[];
  if(!e.length && !c.length) return `<div class="empty">Aucun exercice. Lance-toi.</div>`;
  return `<div class="list">${e.map(entryCard).join('')}${c.map(cardioItem).join('')}</div><div class="card session-total"><div class="between"><span class="muted">Volume séance</span><strong>${Math.round(e.reduce((s,x)=>s+volume(x),0))} kg</strong></div></div>`;
}
function entryCard(e){
  const rm=Number(e.rm1reel)||oneRM(e.poids,e.reps);
  const open = !!state.ui.entryOpen?.[e.id];
  return `<div class="entry-swipe" data-entry-id="${e.id}"><div class="swipe-delete-bg">Supprimer</div><div class="item entry-item"><button class="entry-head" data-action="entry-toggle" data-id="${e.id}"><div><div class="item-title">${e.icon||''} ${esc(e.nom)}</div><div class="meta">${esc(e.groupe||'')} · série ${e.series} · ${e.reps} reps · ${e.poids} kg${e.rpe ? ` · RPE ${e.rpe}` : ''}</div></div><span class="badge blue">1RM ${rm}</span><span class="chev">${open?'⌄':'›'}</span></button><div class="entry-body ${open?'':'hidden'}"><div class="entry-actions"><button class="btn small" data-action="exercise-open" data-name="${esc(e.nom)}">Fiche</button><button class="btn small" data-action="entry-edit" data-id="${e.id}">Modifier</button><button class="btn small ok" data-action="rest-edit" data-name="${esc(e.nom)}">Repos</button><button class="btn small danger" data-action="entry-delete" data-id="${e.id}">Suppr.</button></div></div></div></div>`;
}

function cardioForm(){ return `<section class="card"><div class="field"><label>Type cardio</label><div class="chips">${['marche','course','velo','escalier'].map(t=>`<button class="chip ${cardioType===t?'is-active':''}" data-cardio-type="${t}">${cardioIcon(t)} ${t}</button>`).join('')}</div></div><div class="grid-3"><div class="field"><label>Durée</label>${stepper('c-duration',20,5)}</div><div class="field"><label>${cardioType==='velo'?'Résistance':cardioType==='escalier'?'Étages':'Vitesse'}</label>${stepper('c-main', cardioType==='velo'?5:cardioType==='escalier'?20:6, cardioType==='velo'||cardioType==='escalier'?1:0.5)}</div><div class="field"><label>${cardioType==='velo'?'RPM':cardioType==='escalier'?'Intensité':'Pente %'}</label>${stepper('c-extra', cardioType==='velo'?80:0, cardioType==='velo'?5:1)}</div></div><button class="btn primary full" data-action="cardio-add">✓ Ajouter cardio</button></section><section><div class="section-title"><h2>Séance en cours</h2></div>${currentSessionList()}</section>`; }
function cardioIcon(t){ return {marche:'🚶',course:'🏃',velo:'🚴',escalier:'🧗'}[t]||'❤️'; }
function cardioItem(c){ return `<div class="item between"><div><div class="item-title">${cardioIcon(c.type)} ${esc(c.type)}</div><div class="meta">${c.duration} min · ${esc(c.label||'')}</div></div><button class="btn small danger" data-action="cardio-delete" data-id="${c.id}">✕</button></div>`; }
function historyView(){ const days=Object.entries(state.history||{}).sort(([a],[b])=>b.localeCompare(a)); return days.length ? `<div class="list">${days.map(([d,v])=>dayCard(d,v,true)).join('')}</div>` : `<div class="empty">Pas encore d’historique.</div>`; }
function dayCard(date, day, deletable){ const entries=day.entries||[], cardio=day.cardio||[]; const vol=entries.reduce((s,e)=>s+volume(e),0); return `<article class="item"><div class="between"><div><div class="item-title">${fmtDateLong(date)}</div><div class="meta">${entries.length} exercice(s) · ${cardio.length} cardio · ${Math.round(vol)} kg</div></div>${deletable?`<button class="btn small danger" data-action="day-delete" data-date="${date}">Suppr.</button>`:''}</div><div class="list day-mini">${entries.slice(0,8).map(e=>`<div class="between"><span class="small-text">${e.icon||''} ${esc(e.nom)}</span><span class="badge ac">${e.series}×${e.reps} · ${e.poids}kg</span></div>`).join('')}${cardio.map(c=>`<div class="between"><span class="small-text">${cardioIcon(c.type)} ${esc(c.type)}</span><span class="badge purple">${c.duration}min</span></div>`).join('')}</div></article>`; }

function statsView(){
  setTimeout(renderChart,0);
  const entries=Object.entries(state.history||{}).flatMap(([d,v])=>(v.entries||[]).map(e=>({...e,date:d})));
  const names=[...new Set(entries.map(e=>e.nom))].sort();
  if(!selectedMachineName && names.length) selectedMachineName=names[0];
  const bodyLast=(state.bodyWeight||[]).at(-1)?.weight || '';
  return `<div class="grid">
  <div class="tabs stats-tabs"><button class="tab ${statsMode==='trend'?'is-active':''}" data-action="stats-mode" data-mode="trend">Tendance</button><button class="tab ${statsMode==='rm'?'is-active':''}" data-action="stats-mode" data-mode="rm">1RM</button><button class="tab ${statsMode==='body'?'is-active':''}" data-action="stats-mode" data-mode="body">Poids</button></div>
  ${statsMode==='body' ? `<section class="card"><div class="field"><label>Ajouter ton poids corporel</label><div class="row"><input id="body-weight" type="number" step="0.1" min="0" value="${esc(bodyLast)}" placeholder="ex: 82.4"><button class="btn primary" data-action="bodyweight-add">Ajouter</button></div></div></section>` : `<section class="card"><div class="grid-2"><div class="field"><label>Exercice</label><select id="stats-exercise">${names.map(n=>`<option value="${esc(n)}" ${n===selectedMachineName?'selected':''}>${esc(n)}</option>`).join('')}</select></div><div class="field"><label>Mesure</label><select id="stats-metric"><option value="weight" ${statsMetric==='weight'?'selected':''}>Poids max</option><option value="reps" ${statsMetric==='reps'?'selected':''}>Reps max</option><option value="rm" ${statsMetric==='rm'?'selected':''}>1RM estimé/réel</option></select></div></div><div class="chips"><button class="chip ${statsRange==='week'?'is-active':''}" data-action="stats-range" data-range="week">Semaine</button><button class="chip ${statsRange==='month'?'is-active':''}" data-action="stats-range" data-range="month">Mois</button><button class="chip ${statsRange==='year'?'is-active':''}" data-action="stats-range" data-range="year">Année</button><button class="chip ${statsRange==='all'?'is-active':''}" data-action="stats-range" data-range="all">Tout</button></div></section>`}
  <section class="card"><div class="section-title no-margin"><h2>${statsTitle()}</h2></div><div class="chart-box"><canvas id="main-chart"></canvas></div>${statsSummary()}</section>
  ${renderHeatmap()}
  ${renderMuscleBalance()}
  ${renderPRTimeline()}
  </div>`;
}
function statsTitle(){ if(statsMode==='body') return 'Évolution du poids corporel'; if(statsMode==='rm') return 'Meilleur 1RM par exercice'; return `Progression ${statsMetric==='reps'?'reps':statsMetric==='rm'?'1RM':'poids'} · ${selectedMachineName||''}`; }
function rangeStart(){ const d=new Date(); if(statsRange==='week') d.setDate(d.getDate()-7); else if(statsRange==='month') d.setMonth(d.getMonth()-1); else if(statsRange==='year') d.setFullYear(d.getFullYear()-1); else return ''; return d.toISOString().slice(0,10); }
function getProgressRows(){ const start=rangeStart(); const rows=[]; Object.entries(state.history||{}).sort(([a],[b])=>a.localeCompare(b)).forEach(([date,day])=>{ if(start && date<start) return; (day.entries||[]).filter(e=>e.nom===selectedMachineName).forEach(e=>rows.push({...e,date,value:statsMetric==='reps'?Number(e.reps):statsMetric==='rm'?(Number(e.rm1reel)||oneRM(e.poids,e.reps)):Number(e.poids)})); }); return rows; }
function statsSummary(){ const rows=statsMode==='body' ? (state.bodyWeight||[]).map(x=>({date:x.date,value:x.weight})) : getProgressRows(); if(!rows.length) return `<div class="empty small-empty">Pas encore assez de données.</div>`; const first=rows[0].value, last=rows.at(-1).value, diff=Math.round((last-first)*10)/10; const cls=diff>=0?'ok':'danger'; return `<div class="trend-line"><span>Début : <b>${first}</b></span><span>Dernier : <b>${last}</b></span><span class="${cls}">Évolution : <b>${diff>0?'+':''}${diff}</b></span></div>`; }
function renderChart(){
  const canvas=$('#main-chart'); if(!canvas || !window.Chart) return;
  if(chart) chart.destroy();
  const muted=getComputedStyle(document.documentElement).getPropertyValue('--muted');
  let labels=[], values=[];
  if(statsMode==='rm'){
    const data={}; Object.values(state.history||{}).forEach(day=>(day.entries||[]).forEach(e=>{ data[e.nom]=Math.max(data[e.nom]||0, Number(e.rm1reel)||oneRM(e.poids,e.reps)); }));
    const top=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8); labels=top.map(x=>x[0]); values=top.map(x=>Math.round(x[1]));
    chart=new Chart(canvas,{type:'bar',data:{labels,datasets:[{label:statsTitle(),data:values}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{display:false}},y:{ticks:{color:muted}}}}}); return;
  }
  const rows=statsMode==='body' ? (state.bodyWeight||[]).map(x=>({date:x.date,value:Number(x.weight)})) : getProgressRows();
  labels=rows.map(r=>r.date?.slice(5)||''); values=rows.map(r=>r.value);
  chart=new Chart(canvas,{type:'line',data:{labels,datasets:[{label:statsTitle(),data:values,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:muted,maxRotation:0}},y:{ticks:{color:muted}}}}});
}
function settingsView(){ return `<div class="grid"><section class="card"><div class="field"><label>Prénom</label><input id="setting-name" value="${esc(state.settings.userName||'Kevin')}"></div><div class="field"><label>Timer repos par défaut</label><input id="setting-timer" type="number" min="15" step="5" value="${Number(state.settings.timerDefault||60)}"></div><button class="btn primary full" data-action="settings-save">Sauvegarder</button></section><section class="card"><div class="section-title no-margin"><h2>Données</h2></div><button class="btn full" data-action="export-json">Exporter JSON</button><label class="btn full import-label">Importer JSON<input id="import-json" type="file" accept="application/json"></label></section><section class="card danger-zone"><div class="section-title no-margin"><h2>Danger</h2></div><button class="btn danger full" data-action="reset-all">Tout réinitialiser</button></section></div>`; }

function render(){ $('#today-label').textContent=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); $('#page-title').textContent=titles[route]||'GymLog'; view.innerHTML = ({home,session:sessionView,history:historyView,stats:statsView,settings:settingsView,exercise:exerciseDetailView}[route]||home)(); afterRender(); }
function afterRender(){ const select=$('#machine-select'); if(select){ select.addEventListener('change', () => { captureForm(); rememberFollowDraft(selectedMachineName); selectedMachineName=select.value; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(select.value); const m=machineByName(select.value); formDraft=(state.ui.followMode && saved) ? {...saved} : {poids:preferredWeightForExercise(select.value) ?? last?.poids ?? m?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; render(); }); updateMachineHint(); } const se=$('#stats-exercise'); if(se) se.addEventListener('change',()=>{selectedMachineName=se.value; render();}); const sm=$('#stats-metric'); if(sm) sm.addEventListener('change',()=>{statsMetric=sm.value; render();}); initSwipeDelete(); }
function videoTimeToSeconds(value=''){
  const raw=String(value||'').trim();
  if(!raw) return 0;
  if(/^\d+$/.test(raw)) return Number(raw);
  const h=raw.match(/(\d+)h/), m=raw.match(/(\d+)m/), sec=raw.match(/(\d+)s/);
  return (h?Number(h[1])*3600:0)+(m?Number(m[1])*60:0)+(sec?Number(sec[1]):0);
}
function youtubeEmbedFrom(raw=''){
  const value=String(raw||'').trim();
  if(!value) return null;
  let id='', start=0;
  try{
    const u=value.startsWith('http') ? new URL(value) : new URL('https://youtube.com/watch?v='+value);
    const host=u.hostname.replace(/^www\./,'');
    start=videoTimeToSeconds(u.searchParams.get('start')||u.searchParams.get('t')||'');
    if(host==='youtu.be') id=u.pathname.split('/').filter(Boolean)[0]||'';
    else if(host.includes('youtube.com')){
      if(u.pathname.startsWith('/embed/')) id=u.pathname.split('/').filter(Boolean)[1]||'';
      else if(u.pathname.startsWith('/shorts/')) id=u.pathname.split('/').filter(Boolean)[1]||'';
      else id=u.searchParams.get('v')||'';
    }
  }catch{
    const [base,query='']=value.split('?');
    id=base.trim();
    start=videoTimeToSeconds(new URLSearchParams(query).get('t')||new URLSearchParams(query).get('start')||'');
  }
  id=(id||'').replace(/[^a-zA-Z0-9_-]/g,'');
  if(!id) return null;
  return {
    type:'youtube',
    src:`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${start?`&start=${start}`:''}`,
    external:`https://youtube.com/watch?v=${id}${start?`&t=${start}s`:''}`
  };
}
function videoUrl(m){ if(!m?.video) return ''; return m.video.startsWith('http') ? m.video : 'https://youtube.com/watch?v='+m.video; }
function videoEmbedData(m){
  const raw=String(m?.video||'').trim();
  if(!raw) return null;
  const yt=youtubeEmbedFrom(raw);
  if(yt) return {...yt,title:m?.nom||'Vidéo exercice'};
  const src=videoUrl(m);
  if(/\.(mp4|webm|ogg)(\?|#|$)/i.test(src)) return {type:'video',src,external:src,title:m?.nom||'Vidéo exercice'};
  return {type:'iframe',src,external:src,title:m?.nom||'Vidéo exercice'};
}
function openVideoModal(m){
  const data=videoEmbedData(m);
  if(!data) return toast('Aucune vidéo pour cet exercice','warn');
  const player=data.type==='video'
    ? `<video class="video-player" controls playsinline preload="metadata" src="${esc(data.src)}"></video>`
    : `<iframe class="video-player" src="${esc(data.src)}" title="${esc(data.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  $('#modal-root').innerHTML=`<div class="video-backdrop"><section class="video-modal"><div class="video-modal-head"><div><div class="eyebrow">Vidéo exercice</div><h2>${esc(data.title)}</h2></div><button class="video-close icon-only" data-action="video-close" title="Fermer">${icon('close')}</button></div><div class="video-frame">${player}</div><div class="video-actions"><button class="btn secondary" data-action="video-close">Fermer</button><button class="btn primary" data-action="video-external" data-url="${esc(data.external)}">Ouvrir externe</button></div></section></div>`;
}
function updateMachineHint(){
  const m=currentMachine(), el=$('#machine-hint');
  if(!el) return;
  if(!m){ el.innerHTML=''; return; }
  const currentWeight=Number($('#poids')?.value??formDraft.poids??0);
  const rows=entriesForExercise(m.nom), last=lastEntryFor(m.nom), maxReps=maxRepsForWeight(m.nom,currentWeight), goal=getExerciseGoal(m.nom);

  if(!rows.length){
    el.innerHTML=`<div class="insight-empty">Aucun historique pour cet exercice. <button class="btn small" data-action="exercise-open">Fiche</button></div>`;
    return;
  }

  el.innerHTML=`
    ${goal?`<div class="insight-goal compact"><span>🎯 Objectif conseillé</span><b>${goal.main}</b></div>`:''}
    <div class="insight-card"><span>🕒 Dernière fois</span><b>${last?`${last.poids} kg × ${last.reps}`:'—'}</b></div>
    <div class="insight-card"><span>🔥 Max à ${currentWeight||'—'} kg</span><b>${maxReps?`${maxReps} reps`:'—'}</b></div>
    <button class="btn small full insight-more" data-action="exercise-open">📊 Voir analyse complète</button>
  `;
}
function captureForm(){
  if($('#poids')){
    formDraft={poids:Number($('#poids').value)||0, series:Number($('#series').value)||1, reps:Number($('#reps').value)||10, rm:$('#real-rm')?.value||'', rpe:formDraft.rpe||''};
    rememberFollowDraft();
    updateMachineHint();
  }
}

function addEntry(){
  const m=currentMachine(); if(!m) return toast('Choisis un exercice','warn'); captureForm();
  const previousMaxWeight = maxWeightFor(m.nom);
  const previousMaxRepsAtWeight = maxRepsForWeight(m.nom, formDraft.poids);
  const entry={id:uid(),nom:m.nom,groupe:m.groupe,icon:m.icon,poids:formDraft.poids,series:formDraft.series||1,reps:formDraft.reps||1,rm1reel:formDraft.rm?Number(formDraft.rm):null,rpe:formDraft.rpe||null,createdAt:new Date().toISOString()};
  entry.rm1est=oneRM(entry.poids,entry.reps); state.session.entries.unshift(entry); updateRecords(entry);
  const weightRecord = previousMaxWeight !== null && Number(entry.poids) > Number(previousMaxWeight);
  const repsRecord = previousMaxRepsAtWeight !== null && Number(entry.reps) > Number(previousMaxRepsAtWeight);
  formDraft.series = Math.min((formDraft.series||1)+1, 99); formDraft.rm='';
  rememberFollowDraft(m.nom);
  persist();
  if(weightRecord) toast(`🏆 Nouveau record poids : ${entry.poids} kg`, 'ok');
  else if(repsRecord) toast(`🔥 Nouveau record reps à ${entry.poids} kg : ${entry.reps}`, 'ok');
  else toast('Série ajoutée','ok');
  startTimer(getTimerFor(m.nom), m.nom); render();
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
async function startFollowTemplate(id){ const t=normalizeTpl(state.templates.find(x=>x.id===id)||{}); if(!t.exercises?.length) return; if(state.session.entries.length && !await confirmModal('Charger ce template en mode suivi ? La séance en cours sera conservée.')) return; state.ui.followMode={id:t.id,name:t.name,exercises:t.exercises}; state.ui.followDrafts = {}; selectedMachineName=t.exercises[0].nom; const last=lastEntryFor(selectedMachineName); formDraft={poids:preferredWeightForExercise(selectedMachineName) ?? last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; persist(); setRoute('session'); }

function machineModal(existingName=null){
  const m=existingName?machineByName(existingName):currentMachine(); const isCustom=!!state.customMachines.find(x=>x.nom===m?.nom);
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${existingName?'Modifier':'Ajouter'} un exercice</h2><div class="field"><label>Nom</label><input id="mach-name" value="${esc(existingName?m?.nom:'')}"></div><div class="field"><label>Groupe</label><select id="mach-group">${groups().map(g=>`<option value="${esc(g)}" ${m?.groupe===g?'selected':''}>${GROUP_ICONS[g]||'📌'} ${esc(g)}</option>`).join('')}</select></div><div class="field"><label>Icône</label><input id="mach-icon" value="${esc(m?.icon||'🏋️')}"></div><div class="grid-2"><div class="field"><label>Poids par défaut</label><input id="mach-weight-default" type="number" step="0.5" value="${esc(m?.poids?.[0]||20)}"></div><div class="field"><label>Pas + / -</label><input id="mach-step" type="number" step="0.5" value="${esc(m?.step||0.5)}"></div></div><div class="field"><label>Vidéo URL ou ID YouTube</label><input id="mach-video" value="${esc(m?.video||'')}"></div><p class="muted small-text">Les exercices de base ne sont pas écrasés : si tu modifies un exercice de base, une version personnalisée sera créée avec le même nom.</p><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="machine-save" data-original="${esc(existingName||'')}">Sauvegarder</button></div></div></div>`;
}
function saveMachine(original=''){
  const nom=$('#mach-name').value.trim(); if(!nom) return toast('Nom obligatoire','warn');
  const defaultWeight=Number($('#mach-weight-default').value)||20;
  const step=Number($('#mach-step').value)||0.5;
  const item={nom,groupe:$('#mach-group').value,icon:$('#mach-icon').value.trim()||'🏋️',poids:[defaultWeight],step,video:$('#mach-video').value.trim()};
  const idx=state.customMachines.findIndex(x=>x.nom===(original||nom));
  if(idx>=0) state.customMachines[idx]=item; else state.customMachines.push(item);
  selectedMachineName=nom; formDraft={poids:lastEntryFor(nom)?.poids ?? item.poids[0], series:1, reps:lastEntryFor(nom)?.reps ?? 10, rm:''};
  persist(); $('#modal-root').innerHTML=''; toast('Exercice sauvegardé','ok'); render();
}
function editEntry(id){
  const e=state.session.entries.find(x=>x.id===id); if(!e) return;
  const m=machineByName(e.nom);
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>Modifier la série</h2><div class="item no-margin"><div class="item-title">${e.icon||''} ${esc(e.nom)}</div><div class="meta">${esc(e.groupe||'')}</div></div><div class="grid-2"><div class="field"><label>Poids</label>${stepper('edit-poids', e.poids, Number(m?.step||0.5))}</div><div class="field"><label>Série</label>${stepper('edit-series', e.series, 1)}</div></div><div class="grid-2"><div class="field"><label>Reps</label>${stepper('edit-reps', e.reps, 1)}</div><div class="field"><label>1RM réel</label><input id="edit-rm" type="number" value="${esc(e.rm1reel||'')}" placeholder="optionnel"></div></div><div class="field"><label>RPE</label><select id="edit-rpe"><option value="">—</option>${[6,7,8,9,10].map(n=>`<option value="${n}" ${Number(e.rpe)===n?'selected':''}>${n}</option>`).join('')}</select></div><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="entry-save-edit" data-id="${id}">Enregistrer</button></div></div></div>`;
}
function saveEntryEdit(id){
  const e=state.session.entries.find(x=>x.id===id); if(!e) return;
  e.poids=Number($('#edit-poids')?.value)||e.poids; e.series=Number($('#edit-series')?.value)||e.series; e.reps=Number($('#edit-reps')?.value)||e.reps; e.rm1reel=$('#edit-rm')?.value?Number($('#edit-rm').value):null; e.rpe=$('#edit-rpe')?.value || null; e.rm1est=oneRM(e.poids,e.reps);
  updateRecords(e); persist(); $('#modal-root').innerHTML=''; toast('Série modifiée','ok'); render();
}
function initSwipeDelete(){
  $$('.entry-swipe').forEach(wrap=>{
    let startX=0, dx=0, dragging=false; const card=wrap.querySelector('.entry-item');
    wrap.onpointerdown=e=>{ if(e.target.closest('button')) return; startX=e.clientX; dx=0; dragging=true; card.style.transition='none'; };
    wrap.onpointermove=e=>{ if(!dragging) return; dx=e.clientX-startX; if(dx<0){ card.style.transform=`translateX(${Math.max(dx,-115)}px)`; } };
    wrap.onpointerup=()=>{ if(!dragging) return; dragging=false; card.style.transition='transform .18s ease'; if(dx<-90){ const id=wrap.dataset.entryId; state.session.entries=state.session.entries.filter(x=>x.id!==id); persist(); render(); toast('Série supprimée','ok'); } else card.style.transform=''; };
    wrap.onpointercancel=()=>{ dragging=false; card.style.transform=''; };
  });
}
async function editRest(name){ const val=prompt(`Temps de repos pour ${name} (secondes)`, getTimerFor(name)); if(val===null) return; const n=Number(val); if(!n || n<5) return toast('Temps invalide','warn'); state.timers[name]=n; persist(); toast('Repos mémorisé','ok'); render(); }

function bindEvents(){ document.addEventListener('click', async e=>{
  const routeBtn=e.target.closest('[data-route]'); if(routeBtn) return setRoute(routeBtn.dataset.route);
  const group=e.target.closest('[data-group]'); if(group){ captureForm(); groupFilter=group.dataset.group; const m=filteredMachines()[0]; selectedMachineName=m?.nom || null; formDraft.series=1; formDraft.poids=null; return render(); }
  const ctype=e.target.closest('[data-cardio-type]'); if(ctype){ cardioType=ctype.dataset.cardioType; return render(); }
  const step=e.target.closest('[data-step-target]'); if(step){ const input=$('#'+step.dataset.stepTarget); input.value=String(Math.max(Number(input.min||0), (Number(input.value)||0)+Number(step.dataset.step))); captureForm(); return; }
  const rpeBtn=e.target.closest('[data-rpe]'); if(rpeBtn){ formDraft.rpe=rpeBtn.dataset.rpe; render(); return; }
  if(e.target.classList?.contains('video-backdrop')){ $('#modal-root').innerHTML=''; return; }
  const el=e.target.closest('[data-action]'); const action=el?.dataset.action; if(!action) return;
  if(action==='session-tab'){ sessionTab=el.dataset.tab; render(); }
  if(action==='entry-add') addEntry();
  if(action==='cardio-add') addCardio();
  if(action==='entry-toggle'){ state.ui.entryOpen ||= {}; state.ui.entryOpen[el.dataset.id]=!state.ui.entryOpen[el.dataset.id]; persist(); render(); }
  if(action==='entry-edit') editEntry(el.dataset.id);
  if(action==='entry-save-edit') saveEntryEdit(el.dataset.id);
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
  if(action==='follow-pick'){ captureForm(); rememberFollowDraft(selectedMachineName); selectedMachineName=el.dataset.name; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(selectedMachineName); formDraft=saved ? {...saved} : {poids:preferredWeightForExercise(selectedMachineName) ?? last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; persist(); render(); }
  if(action==='follow-stop'){ state.ui.followMode=null; persist(); render(); }
  if(action==='machine-new') machineModal(null);
  if(action==='video-open') openVideoModal(currentMachine());
  if(action==='video-close') $('#modal-root').innerHTML='';
  if(action==='video-external'){ const url=el.dataset.url; if(url) window.open(url,'_blank','noopener'); }
  if(action==='machine-edit') machineModal($('#machine-select')?.value);
  if(action==='machine-save') saveMachine(el.dataset.original||'');
  if(action==='exercise-open'){ exerciseDetailName=el.dataset.name||$('#machine-select')?.value||selectedMachineName; selectedMachineName=exerciseDetailName; setRoute('exercise'); }
  if(action==='exercise-back'){ setRoute('session'); }
  if(action==='exercise-range'){ exerciseRange=el.dataset.range; render(); }
  if(action==='exercise-metric'){ exerciseMetric=el.dataset.metric; render(); }
  if(action==='modal-close') $('#modal-root').innerHTML='';
  if(action==='stats-mode'){ statsMode=el.dataset.mode; render(); }
  if(action==='stats-range'){ statsRange=el.dataset.range; render(); }
  if(action==='bodyweight-add'){ const v=Number($('#body-weight')?.value); if(!v) return toast('Poids invalide','warn'); state.bodyWeight.push({date:todayKey(),weight:v,createdAt:new Date().toISOString()}); persist(); toast('Poids ajouté','ok'); render(); }
  if(action==='settings-save'){ state.settings.userName=$('#setting-name').value.trim()||'Kevin'; state.settings.timerDefault=Number($('#setting-timer').value)||60; persist(); toast('Réglages sauvegardés','ok'); render(); }
  if(action==='export-json') downloadText(`gymlog-backup-${todayKey()}.json`, exportState(state));
  if(action==='reset-all' && await confirmModal('Tout supprimer définitivement ?')){ resetAll(); state=loadState(); setTheme('dark'); setRoute('home'); toast('Application réinitialisée','ok'); }
 });
 $('#theme-toggle').addEventListener('click',()=>setTheme(state.settings.theme==='light'?'dark':'light'));
 document.addEventListener('input', e=>{ if(['poids','series','reps','real-rm'].includes(e.target.id)) captureForm(); });
 document.addEventListener('change', async e=>{ if(e.target.id==='import-json'){ const file=e.target.files[0]; if(!file) return; try{ state=importState(await file.text()); state.customMachines ||= []; state.ui ||= {entryOpen:{},followMode:null}; setTheme(state.settings.theme); toast('Import réussi','ok'); setRoute('home'); }catch(err){ toast('Import impossible : '+err.message,'warn'); } } });
 document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('#modal-root .video-backdrop')) $('#modal-root').innerHTML=''; });
}

setTheme(state.settings.theme || 'dark');
initTimer(()=>state.settings.timerDefault||60);
bindEvents();
render();
