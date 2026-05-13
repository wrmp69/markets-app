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
state.ui ||= { entryOpen: {}, followMode: null, followScroll: 0 };
state.ui.prEvents ||= [];

let route = 'home';
let groupFilter = '';
let sessionTab = 'muscu';
let cardioType = 'marche';
let chart = null;
let detailChart = null;
let exerciseDetailName = null;
let exerciseMetric = 'weight';
let exerciseRange = 'all';
let exerciseBookTab = 'analyse';
let statsMode = 'trend';
let statsRange = 'month';
let statsMetric = 'weight';
let smartTemplatePlan = 'balanced';
let bodyMapSide = 'front';
let selectedMachineName = null;
let formDraft = { poids: null, series: 1, reps: 10, rm: '' };

const titles = {home:'Accueil', session:'Séance', history:'Historique', stats:'Stats', settings:'Réglages', exercise:'Fiche exercice'};
const view = $('#view');

const SVG = {
  book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.8A2.8 2.8 0 0 1 7.8 2H20v17H7.8A2.8 2.8 0 0 0 5 21.8V4.8Z"/><path d="M5 4.8A2.8 2.8 0 0 1 7.8 2H20v17H7.8A2.8 2.8 0 0 0 5 21.8V4.8Z"/><path d="M5 5H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14"/></svg>',
  chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-7"/><path d="M17 6h3v3"/></svg>',
  video:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
  edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>',
  target:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  warmup:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 3 5 5.4 5 9a5 5 0 0 1-10 0c0-2 1-3.7 2.4-5.4"/><path d="M12 11c1.5 1.4 2.2 2.4 2.2 3.7a2.2 2.2 0 1 1-4.4 0c0-1 .5-1.8 1.4-2.7"/></svg>',
  recovery:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a8.5 8.5 0 1 0-8.5-8.5"/><path d="M3 20v-6h6"/><path d="M12 7v5l3 2"/></svg>',
  technique:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16 16 4"/><path d="M14 4h6v6"/><path d="M4 20h16"/><path d="M6 14l4 4"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
  strength:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7v10"/><path d="M18 7v10"/><path d="M2 10v4"/><path d="M22 10v4"/><path d="M6 12h12"/></svg>',
  history:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  delete:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>'
};
function icon(name){ return `<span class="svg-wrap">${SVG[name]||''}</span>`; }


function persist(){ saveState(state); }
function allMachines(){ return [...MACHINES, ...(state.customMachines||[])]; }
function groups(){ return [...new Set([...GROUPS, ...allMachines().map(m=>m.groupe).filter(Boolean)])]; }
function filteredMachines(){ return groupFilter ? allMachines().filter(m=>m.groupe===groupFilter) : allMachines(); }
function machineByName(name){ return allMachines().find(m=>m.nom===name); }
function lastEntryFor(name){ const all=[]; Object.values(state.history||{}).forEach(day=>all.push(...(day.entries||[]))); all.push(...(state.session.entries||[])); return all.reverse().find(e=>e.nom===name); }
function entriesForExercise(name){ const all=[]; Object.values(state.history||{}).forEach(day=>all.push(...(day.entries||[]))); all.push(...(state.session.entries||[])); return all.filter(e=>e.nom===name); }
function maxWeightFor(name){ const rows=entriesForExercise(name); return rows.length ? Math.max(...rows.map(e=>Number(e.poids)||0)) : null; }
function maxRepsForWeight(name, poids){ const p=Number(poids); const rows=entriesForExercise(name).filter(e=>Number(e.poids)===p); return rows.length ? Math.max(...rows.map(e=>Number(e.reps)||0)) : null; }

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
function latestWorkoutEntriesFor(name){ const b=workoutBucketsForExercise(name); return b.length?b.at(-1).rows:[]; }
function preferredWeightForExercise(name){ const latest=latestWorkoutEntriesFor(name); if(latest.length) return Math.max(...latest.map(e=>Number(e.poids)||0)); const max=maxWeightFor(name); return max||null; }
function repsText(rows){ return rows.map(e=>Number(e.reps)||0).filter(Boolean).join(' / '); }
function progressionAIFor(name){
  const buckets=workoutBucketsForExercise(name), rows=entriesForExercise(name).filter(e=>Number(e.poids)>0&&Number(e.reps)>0);
  const machine=machineByName(name), step=Number(machine?.step||2.5);
  if(rows.length<3||buckets.length<2) return {level:'learn',label:'IA en apprentissage',title:'Construire une base fiable',text:'Fais encore 2-3 séances sur cet exercice. Je garde un objectif simple pour éviter une recommandation au hasard.',optionA:'Garde la charge actuelle',optionB:'Travaille propre',signal:'Données courtes'};
  const latest=buckets.at(-1), prev=buckets.at(-2), latestRows=latest.rows, prevRows=prev.rows;
  const targetWeight=Math.max(...latestRows.map(e=>Number(e.poids)||0));
  const targetRows=latestRows.filter(e=>Number(e.poids)===targetWeight);
  const baseRows=targetRows.length?targetRows:latestRows;
  const reps=baseRows.map(e=>Number(e.reps)||0).filter(Boolean);
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  const avgRpe=avg(latestRows.map(e=>Number(e.rpe)).filter(Boolean));
  const prevRM=Math.max(0,...prevRows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  const lastRM=Math.max(0,...latestRows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  const rmDelta=lastRM-prevRM;
  const maxReps=Math.max(...reps);
  const nextWeight=Math.round((targetWeight+step)*10)/10;
  const deloadWeight=Math.max(0,Math.round(targetWeight*.9*10)/10);
  const repTarget=reps.map((r,i)=>i===reps.length-1?r+1:r).join(' / ');
  const validated=rows.filter(e=>Number(e.poids)===targetWeight&&(Number(e.reps)||0)>=8&&(!e.rpe||Number(e.rpe)<=8)).slice(-6).length>=3;
  if(avgRpe>=9&&rmDelta<0) return {level:'deload',label:'Fatigue détectée',title:'Récupération prioritaire',text:`Ta performance descend avec un ressenti haut. Allège aujourd’hui pour repartir propre.`,optionA:`${deloadWeight} kg · 8 / 8 / 8 reps`,optionB:`${targetWeight} kg très propre`,signal:'Allège'};
  if(avgRpe>=9) return {level:'hold',label:'Charge exigeante',title:'Ne monte pas tout de suite',text:`RPE haut : sécurise la technique avant de monter la charge.`,optionA:`Reste à ${targetWeight} kg`,optionB:`Vise ${repTarget} reps`,signal:'Stable'};
  if(validated&&maxReps>=10) return {level:'up',label:'Montée possible',title:'Force & Hypertrophie',text:`Tu es proche de ton max efficace à ${targetWeight} kg. Deux options pertinentes :`,optionA:`Reste à ${targetWeight} kg · vise ${maxReps+1}-${maxReps+3} reps`,optionB:`Passe à ${nextWeight} kg · vise 8-12 reps`,signal:'Monte bientôt'};
  if(rmDelta>1) return {level:'progress',label:'Bonne tendance',title:'Progression régulière',text:`Tu progresses. Garde la charge et ajoute une rep propre sur la dernière série.`,optionA:`${targetWeight} kg · ${repTarget} reps`,optionB:`Repos ${getTimerFor(name)}s`,signal:'En hausse'};
  return {level:'steady',label:'Progression contrôlée',title:'Séance propre',text:`Aucun signal fort. Garde la charge et valide tes séries proprement.`,optionA:`${targetWeight} kg · ${repTarget} reps`,optionB:`Technique propre`,signal:'Stable'};
}
function getExerciseGoal(name){
  const ai=progressionAIFor(name), latest=latestWorkoutEntriesFor(name);
  if(!latest.length) return null;
  const targetWeight=Math.max(...latest.map(e=>Number(e.poids)||0));
  const rows=latest.filter(e=>Number(e.poids)===targetWeight);
  const base=rows.length?rows:latest;
  const reps=base.map(e=>Number(e.reps)||0).filter(Boolean);
  const target=reps.map((r,i)=>i===reps.length-1?r+1:r).join(' / ');
  return {main:ai?.optionA||`${targetWeight} kg · ${target} reps`,alt:ai?.optionB||null,reason:ai?.text||`Dernière séance : ${base.length} série(s) à ${targetWeight} kg (${reps.join(' / ')} reps)`};
}
function warmupSuggestionFor(name){
  const latest=latestWorkoutEntriesFor(name); if(!latest.length) return null;
  const target=Math.max(...latest.map(e=>Number(e.poids)||0)); if(!target||target<10) return null;
  const round=v=>Math.round(v*2)/2;
  return [{p:round(target*.5),r:12},{p:round(target*.7),r:8},{p:round(target*.85),r:4}].filter((s,i,a)=>i===0||s.p>a[i-1].p).map(s=>`${s.p}×${s.r}`).join(' · ');
}
function detailRowsForExercise(name){
  const rows=[]; Object.entries(state.history||{}).forEach(([date,day])=>(day.entries||[]).filter(e=>e.nom===name).forEach(e=>rows.push({...e,date})));
  (state.session.entries||[]).filter(e=>e.nom===name).forEach(e=>rows.push({...e,date:'session'}));
  return rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||new Date(a.createdAt||0)-new Date(b.createdAt||0));
}
function exerciseRangeStart(){ const d=new Date(); if(exerciseRange==='week') d.setDate(d.getDate()-7); else if(exerciseRange==='month') d.setMonth(d.getMonth()-1); else if(exerciseRange==='year') d.setFullYear(d.getFullYear()-1); else return ''; return d.toISOString().slice(0,10); }
function detailRowsFiltered(name){ const start=exerciseRangeStart(); return detailRowsForExercise(name).filter(r=>!start||r.date==='session'||r.date>=start); }
function bestSetForRows(rows){ return rows.length?rows.slice().sort((a,b)=>(Number(b.poids)||0)-(Number(a.poids)||0)||(Number(b.reps)||0)-(Number(a.reps)||0))[0]:null; }
function rpeAverage(rows){ const r=rows.map(e=>Number(e.rpe)).filter(Boolean); return r.length?Math.round((r.reduce((a,b)=>a+b,0)/r.length)*10)/10:null; }
function detailPRTimeline(name){ let best=0; return detailRowsForExercise(name).filter(e=>{const w=Number(e.poids)||0; if(w>best){best=w; return true;} return false;}).slice(-8).reverse(); }
function exerciseDetailView(){
  const name=exerciseDetailName||selectedMachineName, m=machineByName(name), rows=detailRowsFiltered(name), allRows=detailRowsForExercise(name), ai=progressionAIFor(name);
  const bestWeight=allRows.length?Math.max(...allRows.map(e=>Number(e.poids)||0)):0, bestRM=allRows.length?Math.max(...allRows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps))):0;
  const bestSet=bestSetForRows(allRows), avgRpe=rpeAverage(allRows), warm=warmupSuggestionFor(name);
  setTimeout(renderExerciseChart,0);
  return `<div class="premium-detail"><section class="detail-hero glass-card"><div class="between"><div><div class="eyebrow">Fiche exercice</div><h2>${m?.icon||''} ${esc(name||'Exercice')}</h2><p>Groupe : ${esc(m?.groupe||'—')} · Matériel : Machine</p></div><button class="btn small secondary" data-action="exercise-back">Retour</button></div></section>
  <div class="detail-tabs"><button class="is-active">Analyse</button><button>Progression</button><button>Historique</button></div>
  <section class="premium-ai glass-card"><div class="ai-title"><span> Objectif conseillé</span><h3>${esc(ai.title)}</h3></div><p>${esc(ai.text)}</p><div class="ai-options"><div><b>Option 1</b><strong>${esc(ai.optionA)}</strong></div><div><b>Option 2</b><strong>${esc(ai.optionB)}</strong></div></div></section>
  <section class="detail-grid"><div class="kpi glass-card"><strong>${bestWeight||'—'}</strong><span>Record kg</span></div><div class="kpi glass-card"><strong>${bestRM||'—'}</strong><span>Meilleur 1RM</span></div><div class="kpi glass-card"><strong>${bestSet?`${bestSet.poids}×${bestSet.reps}`:'—'}</strong><span>Meilleure série</span></div><div class="kpi glass-card"><strong>${avgRpe||'—'}</strong><span>RPE moyen</span></div></section>
  ${warm?`<section class="analysis-card glass-card"><h3>${icon('warmup')} Échauffement conseillé</h3><p>${warm}</p></section>`:''}
  <section class="analysis-card glass-card"><h3> Tendance</h3><p>${esc(ai.signal)} · ${esc(ai.label)}</p><div class="chart-box"><canvas id="exercise-chart"></canvas></div></section>
  <section class="analysis-card glass-card"><h3> Timeline records</h3>${detailPRTimeline(name).length?`<div class="pr-list">${detailPRTimeline(name).map(e=>`<div class="pr-item"><span>${icon('strength')}</span><div><b>${e.poids} kg</b><small>${e.date==='session'?'Séance en cours':esc(e.date)} · ${e.reps} reps</small></div></div>`).join('')}</div>`:`<p class="muted">Aucun record détecté.</p>`}</section>
  <section class="analysis-card glass-card"><h3>Historique récent</h3>${rows.length?`<div class="list">${rows.slice(-10).reverse().map(e=>`<div class="item between"><div><div class="item-title">${e.poids} kg × ${e.reps}</div><div class="meta">${e.date==='session'?'Séance en cours':esc(e.date)} · série ${e.series}</div></div><span class="badge blue">1RM ${Number(e.rm1reel)||oneRM(e.poids,e.reps)}</span></div>`).join('')}</div>`:`<p class="muted">Pas encore de données.</p>`}</section></div>`;
}
function renderExerciseChart(){
  const canvas=$('#exercise-chart'); if(!canvas||!window.Chart) return; if(detailChart) detailChart.destroy();
  const rows=detailRowsFiltered(exerciseDetailName||selectedMachineName), muted=getComputedStyle(document.documentElement).getPropertyValue('--muted');
  const values=rows.map(e=>exerciseMetric==='reps'?Number(e.reps):exerciseMetric==='rm'?(Number(e.rm1reel)||oneRM(e.poids,e.reps)):Number(e.poids));
  const labels=rows.map(e=>e.date==='session'?'Now':String(e.date).slice(5));
  detailChart=new Chart(canvas,{type:'line',data:{labels,datasets:[{label:exerciseMetric,data:values,tension:.35,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:muted,maxRotation:0}},y:{ticks:{color:muted}}}}});
}

function exerciseProfile(name){
  const rows=detailRowsForExercise(name).filter(e=>Number(e.poids)>0&&Number(e.reps)>0);
  const buckets=workoutBucketsForExercise(name);
  const bestSet=bestSetForRows(rows);
  const bestWeight=rows.length?Math.max(...rows.map(e=>Number(e.poids)||0)):0;
  const bestRM=rows.length?Math.max(...rows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps))):0;
  const avgReps=rows.length?Math.round(rows.reduce((s,e)=>s+(Number(e.reps)||0),0)/rows.length):0;
  const sessions=buckets.length;
  const level=sessions>=12?'Avancé':sessions>=4?'Intermédiaire':'En construction';
  const strengthSignal=bestRM>=bestWeight*1.25;
  const strongVolume=avgReps>=10;
  const pointsFort=strongVolume?'Endurance musculaire':strengthSignal?'Force relative':'Régularité technique';
  const axe=strongVolume?'Force brute':avgReps<8?'Volume / reps propres':'Stabilité sur toutes les séries';
  const response=strongVolume?'Bonne tolérance au volume':avgReps<8?'Meilleure réponse aux charges lourdes':'Profil équilibré';
  return {rows,buckets,bestSet,bestWeight,bestRM,avgReps,sessions,level,pointsFort,axe,response,last:lastEntryFor(name)};
}
function trendForExercise(name){
  const buckets=workoutBucketsForExercise(name);
  if(buckets.length<2) return {title:'Tendance en construction',text:'Il manque encore quelques séances pour lire une vraie tendance.',tone:'neutral',delta:'—'};
  const score=b=>Math.max(...b.rows.map(e=>Number(e.rm1reel)||oneRM(e.poids,e.reps)));
  const last=buckets.at(-1), prev=buckets.at(-2);
  const delta=Math.round((score(last)-score(prev))*10)/10;
  if(delta>1) return {title:'Tendance positive',text:`Ton niveau estimé monte par rapport à la séance précédente. Continue sans brûler les étapes.`,tone:'up',delta:`+${delta} 1RM`};
  if(delta<-1) return {title:'Tendance en baisse',text:`Performance estimée en recul. Priorité à la récupération et à la technique aujourd’hui.`,tone:'down',delta:`${delta} 1RM`};
  return {title:'Tendance stable',text:'Tes performances sont stables. Le meilleur levier est une rep propre de plus ou une meilleure exécution.',tone:'steady',delta:'stable'};
}
function recoveryAdviceFor(name){
  const rows=entriesForExercise(name).filter(e=>Number(e.poids)>0&&Number(e.reps)>0);
  const todayRows=(state.session.entries||[]).filter(e=>e.nom===name);
  const rpes=rows.map(e=>Number(e.rpe)).filter(Boolean);
  const avgRpe=rpes.length?Math.round((rpes.reduce((a,b)=>a+b,0)/rpes.length)*10)/10:null;
  const load=todayRows.reduce((s,e)=>s+volume(e),0);
  let level='Frais', text='Aucun signal fort de fatigue. Tu peux travailler normalement.';
  if(todayRows.length>=4||load>6000){ level='Chargé'; text='Tu as déjà accumulé du travail sur cet exercice. Garde une marge et évite de forcer sale.'; }
  if(avgRpe&&avgRpe>=9){ level='Très exigeant'; text='Le ressenti moyen est haut : mieux vaut valider proprement que chercher un record.'; }
  return {level,text,avgRpe,load};
}
function technicalAdviceFor(name){
  const n=(name||'').toLowerCase();
  if(n.includes('chest')||n.includes('pec')||n.includes('développé')) return ['Omoplates serrées et basses.','Descente contrôlée, pas de rebond.','Pousse fort sans perdre les épaules.'];
  if(n.includes('curl')) return ['Coudes fixes, pas d’élan avec le buste.','Descente lente et contrôlée.','Monte la charge seulement si la trajectoire reste propre.'];
  if(n.includes('tirage')||n.includes('traction')) return ['Tire avec les coudes.','Garde la cage sortie.','Contrôle le retour au lieu de lâcher la charge.'];
  if(n.includes('leg')||n.includes('squat')||n.includes('presse')) return ['Amplitude propre avant charge lourde.','Genoux stables dans l’axe.','Évite le verrouillage violent en haut.'];
  return ['Amplitude propre en priorité.','Garde 1 à 2 reps en réserve.','La charge monte seulement si la technique reste identique.'];
}
function profileCard(profile){
  return `<div class="profile-grid">
    <div><span>Niveau</span><b>${esc(profile.level)}</b></div>
    <div><span>Point fort</span><b>${esc(profile.pointsFort)}</b></div>
    <div><span>Axe d’amélioration</span><b>${esc(profile.axe)}</b></div>
    <div><span>Réponse habituelle</span><b>${esc(profile.response)}</b></div>
  </div>`;
}
function exerciseBookContent(name){
  const ai=progressionAIFor(name), profile=exerciseProfile(name), warm=warmupSuggestionFor(name), rec=recoveryAdviceFor(name), trend=trendForExercise(name);
  const recent=profile.rows.slice(-18).reverse();
  const prs=detailPRTimeline(name);
  if(exerciseBookTab==='progression'){
    return `<div class="book-section hero ${trend.tone}"><span>${icon('chart')} Tendance</span><h3>${esc(trend.title)}</h3><p>${esc(trend.text)}</p><b>${esc(trend.delta)}</b></div>
    <div class="book-section"><h3>Graphique</h3><div class="chart-box book-chart"><canvas id="exercise-chart"></canvas></div></div>
    <div class="book-section"><h3>Records récents</h3>${prs.length?`<div class="book-list">${prs.map(e=>`<div><b>${e.poids} kg</b><span>${e.date==='session'?'Séance en cours':esc(e.date)} · ${e.reps} reps</span></div>`).join('')}</div>`:`<p class="muted">Aucun record détecté.</p>`}</div>`;
  }
  if(exerciseBookTab==='historique'){
    return `<div class="book-section"><div class="between"><h3>Historique détaillé</h3><span class="badge ac">${recent.length} lignes</span></div>${recent.length?`<div class="book-list detail">${recent.map(e=>`<div><b>${e.poids} kg × ${e.reps}</b><span>${e.date==='session'?'Séance en cours':esc(e.date)} · série ${e.series} · 1RM ${Number(e.rm1reel)||oneRM(e.poids,e.reps)}</span></div>`).join('')}</div>`:`<p class="muted">Pas encore de données.</p>`}</div>`;
  }
  return `<div class="book-section hero"><span>${icon('profile')} Ton profil sur cet exercice</span><h3>Profil de performance</h3>${profileCard(profile)}</div>
  <div class="book-section"><h3>${icon('target')} Objectif conseillé</h3><div class="book-ai ${ai.level}"><span>${esc(ai.label)}</span><b>${esc(ai.optionA||'Objectif propre')}</b>${ai.optionB?`<small>${esc(ai.optionB)}</small>`:''}<em>${esc(ai.text||'')}</em></div></div>
  <div class="book-section split"><div><h3>${icon('warmup')} Échauffement conseillé</h3><p>${warm?esc(warm):'Pas nécessaire pour une charge légère ou pas assez de données.'}</p></div><div><h3>${icon('recovery')} Fatigue & récupération</h3><p><b>${esc(rec.level)}</b> — ${esc(rec.text)}</p></div></div>
  <div class="book-section"><h3>${icon('technique')} Conseils techniques</h3><ul>${technicalAdviceFor(name).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
  <button class="book-more" data-action="exercise-book-tab" data-tab="historique">${icon('history')} Voir l’historique détaillé</button>`;
}
function openExerciseBook(name){
  exerciseDetailName=name||selectedMachineName||$('#machine-select')?.value;
  const m=machineByName(exerciseDetailName), profile=exerciseProfile(exerciseDetailName), ai=progressionAIFor(exerciseDetailName);
  $('#modal-root').innerHTML=`<div class="book-backdrop"><article class="exercise-book refined">
    <button class="book-close icon-only" data-action="book-close" title="Fermer">${icon('close')}</button>
    <section class="book-cover"><div><div class="eyebrow">Exercice PRO</div><h2>${esc(exerciseDetailName||'Exercice')}</h2><p>${esc(m?.groupe||'')} · ${profile.sessions} séance(s) analysée(s)</p></div><span class="book-signal ${ai.level}">${esc(ai.signal||ai.label)}</span></section>
    <nav class="book-tabs"><button class="${exerciseBookTab==='analyse'?'is-active':''}" data-action="exercise-book-tab" data-tab="analyse">Analyse</button><button class="${exerciseBookTab==='progression'?'is-active':''}" data-action="exercise-book-tab" data-tab="progression">Progression</button><button class="${exerciseBookTab==='historique'?'is-active':''}" data-action="exercise-book-tab" data-tab="historique">Historique</button></nav>
    <section class="book-pages"><aside class="book-page left"><h3>Résumé</h3><div class="mini-stats"><div><b>${profile.bestWeight||'—'}</b><span>Record kg</span></div><div><b>${profile.bestRM||'—'}</b><span>Meilleur 1RM</span></div><div><b>${profile.avgReps||'—'}</b><span>Reps moy.</span></div></div><p>${esc(ai.title||'Analyse')}</p><p class="muted">Repos conseillé : ${getTimerFor(exerciseDetailName)}s</p></aside><main class="book-page right">${exerciseBookContent(exerciseDetailName)}</main></section>
  </article></div>`;
  if(exerciseBookTab==='progression') setTimeout(renderExerciseChart,0);
}

function getFollowDraft(name){ return state.ui?.followDrafts?.[name] || null; }
function rememberFollowDraft(name=selectedMachineName){ if(!state.ui?.followMode || !name) return; state.ui.followDrafts ||= {}; state.ui.followDrafts[name] = {...formDraft}; }
function getTimerFor(name){ return Number(state.timers?.[name] || state.settings.timerDefault || 60); }
function exerciseFamilyFor(name=''){
  const m=machineByName(name), g=(m?.groupe||'').toLowerCase(), n=String(name).toLowerCase();
  if(/curl|triceps|extension|élévation|elevation|fly|pec fly|abduct|adduct|mollet/.test(n)) return 'isolation';
  if(/squat|presse|hack|leg|développé|developpe|press|tirage|rowing|traction|smith/.test(n)) return 'compound';
  if(g.includes('jambes')||g.includes('dos')||g.includes('pectoraux')) return 'compound';
  return 'standard';
}
function clampRest(v){ return Math.max(30, Math.min(180, Math.round(v/5)*5)); }
function smartRestFor(name, entry=null, flags={}){
  const manual=state.timers && Object.prototype.hasOwnProperty.call(state.timers,name);
  const manualValue=Number(state.timers?.[name]);
  if(manual && manualValue>0) return {seconds:manualValue,label:'Repos mémorisé',reason:'Réglage perso',tone:'manual',manual:true,details:['Réglage personnalisé']};
  const m=machineByName(name), family=exerciseFamilyFor(name), groupe=(m?.groupe||entry?.groupe||'').toLowerCase();
  const rows=entriesForExercise(name).filter(e=>Number(e.poids)>0&&Number(e.reps)>0);
  const baseDefault=Number(state.settings.timerDefault||60);
  let seconds=baseDefault;
  const details=[];
  if(family==='compound'){ seconds=Math.max(seconds,90); details.push('exercice lourd'); }
  if(family==='isolation'){ seconds=Math.min(seconds,60); details.push('isolation'); }
  if(groupe.includes('jambes')||groupe.includes('dos')){ seconds=Math.max(seconds,100); if(!details.includes('exercice lourd')) details.push('gros groupe'); }
  const poids=Number(entry?.poids ?? formDraft.poids ?? $('#poids')?.value ?? 0);
  const reps=Number(entry?.reps ?? formDraft.reps ?? $('#reps')?.value ?? 0);
  const rpe=Number(entry?.rpe ?? 0);
  const maxW=maxWeightFor(name)||poids;
  const heavy=maxW&&poids>=maxW*.9;
  if(heavy&&poids>0){ seconds+=20; details.push('charge haute'); }
  if(reps>0&&reps<=6){ seconds+=25; details.push('force'); }
  if(reps>=15){ seconds-=10; details.push('série longue'); }
  if(rpe>=9){ seconds+=30; details.push('RPE haut'); }
  else if(rpe>=8){ seconds+=15; details.push('RPE modéré'); }
  if(flags.weightRecord||flags.repsRecord||entry?.prType){ seconds+=25; details.push('record'); }
  const todayRows=(state.session.entries||[]).filter(e=>e.nom===name);
  if(todayRows.length>=4){ seconds+=15; details.push('fatigue locale'); }
  const final=clampRest(seconds);
  let tone='smart', label='Repos intelligent', reason=details.slice(0,2).join(' + ')||'standard';
  if(final>=120){ tone='long'; label='Repos long'; }
  else if(final<=45){ tone='short'; label='Repos court'; }
  return {seconds:final,label,reason,details,tone,manual:false};
}
function smartRestCard(name, entry=null){
  const rest=smartRestFor(name, entry);
  return `<div class="smart-rest-card ${rest.tone}"><span>${icon('clock')} ${esc(rest.label)}</span><b>${rest.seconds}s</b><em>${esc(rest.reason)}</em></div>`;
}
function updateRecords(entry){ const prev=Number(state.records[entry.nom]||0); if(Number(entry.poids)>prev) state.records[entry.nom]=Number(entry.poids); }
function defaultMachine(){ return machineByName(selectedMachineName) || filteredMachines()[0] || allMachines()[0]; }
function currentMachine(){ return machineByName($('#machine-select')?.value) || defaultMachine(); }
function setTheme(theme){ state.settings.theme = theme; document.documentElement.classList.toggle('light', theme === 'light'); $('#theme-toggle').textContent = theme === 'light' ? 'Clair' : 'Sombre'; persist(); }
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
    <button class="btn primary full" data-route="session">Commencer / continuer</button>
    <section><div class="section-title"><h2>Dernière séance</h2></div>${last ? dayCard(last[0], last[1], false) : `<div class="empty">Aucune séance enregistrée.</div>`}</section>
    <section><div class="section-title"><h2>Templates</h2><div class="row"><button class="btn small primary icon-text" data-action="template-smart-open">${icon('target')} Smart</button><button class="btn small" data-action="template-new">+ Créer</button></div></div>${templateList()}</section>
  </div>`;
}

function templateList(){
  if(!state.templates.length) return `<div class="empty">Aucun template. Crée un Push / Pull / Legs par exemple.</div>`;
  return `<div class="list">${state.templates.map(t=>`<div class="item between"><div><div class="item-title">${esc(t.name||t.nom||'Template')}</div><div class="meta">${(t.exercises||t.exercices||[]).length} exercice(s) · mode suivi disponible</div></div><div class="row"><button class="btn small primary icon-text" data-action="template-follow" data-id="${t.id}">${icon('chevron')} Suivi</button><button class="btn small icon-only" data-action="template-edit" data-id="${t.id}" title="Modifier">${icon('edit')}</button><button class="btn small danger icon-only" data-action="template-delete" data-id="${t.id}" title="Supprimer">${icon('delete')}</button></div></div>`).join('')}</div>`;
}

function sessionView(){ return `<div class="tabs"><button class="tab ${sessionTab==='muscu'?'is-active':''}" data-action="session-tab" data-tab="muscu">Muscu</button><button class="tab ${sessionTab==='cardio'?'is-active':''}" data-action="session-tab" data-tab="cardio">Cardio</button></div>${sessionTab==='cardio' ? cardioForm() : muscuView()}`; }
function liveDashboard(){
  const entries=state.session.entries||[], m=defaultMachine(), name=m?.nom||selectedMachineName;
  const goal=name?getExerciseGoal(name):null, ai=name?progressionAIFor(name):null;
  const currentRows=entries.filter(e=>e.nom===name), startedAt=entries.at(-1)?.createdAt;
  const mins=startedAt?Math.max(1,Math.round((Date.now()-new Date(startedAt).getTime())/60000)):0;
  const last=currentRows[0], best=maxRepsForWeight(name,Number($('#poids')?.value||formDraft.poids||last?.poids||0));
  const recordPossible=best&&Number(formDraft.reps)>=best, rest=smartRestFor(name);
  if(!entries.length&&!state.ui.followMode) return `<section class="premium-focus empty"><div class="focus-head"><span class="focus-icon">${icon('strength')}</span><div><b>Prêt</b><span>${goal?`Objectif : ${goal.main}`:'Choisis un exercice et lance ta première série.'}</span></div></div></section>`;
  return `<section class="premium-focus"><button class="focus-arrow icon-only" data-action="exercise-open" data-name="${esc(name||'')}" title="Ouvrir la fiche">${icon('chevron')}</button><div class="focus-head"><span class="focus-icon">${icon('strength')}</span><div><h2>${esc(name||'Exercice')}</h2><p>${goal?esc(goal.main):'Objectif : démarre proprement'}</p></div></div><div class="focus-pills"><span>${icon('clock')}${mins||'—'} min</span><span>${icon('clock')}${rest.seconds}s · ${esc(rest.label)}</span><span>${recordPossible?'Record possible':ai?.signal||'Stable'}</span></div></section>`;
}

function compactSessionHero(m, poids, reps){
  const entries=state.session.entries||[];
  const name=m?.nom||selectedMachineName||'';
  const goal=name?getExerciseGoal(name):null;
  const rest=name?smartRestFor(name):{seconds:Number(state.settings.timerDefault||60),label:'Repos',reason:'standard'};
  const currentRows=name?entries.filter(e=>e.nom===name):[];
  const st=sessionTimelineStats(entries,state.session.cardio||[]);
  const started=entries.length||state.ui.followMode;
  const title=name||'Choisis un exercice';
  const subtitle=goal?.main || (started?'Continue proprement':'Sélectionne ton exercice puis ajoute ta première série.');
  return `<section class="compact-hero ${started?'is-live':'is-ready'}">
    <div class="compact-hero-main"><span class="compact-hero-icon">${icon('strength')}</span><div><div class="eyebrow">Mode salle</div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></div>
    <div class="compact-hero-pills"><span>${currentRows.length} série(s)</span><span>${poids||'—'} kg × ${reps||'—'}</span><span>${rest.seconds}s repos</span>${st.prCount?`<span>${st.prCount} PR</span>`:''}</div>
  </section>`;
}
function currentExerciseQuickList(name){
  const rows=(state.session.entries||[]).filter(e=>e.nom===name);
  if(!rows.length) return `<div class="compact-empty">Aucune série sur cet exercice aujourd’hui.</div>`;
  return `<div class="compact-sets">${rows.slice(0,5).map((e,i)=>{
    const rm=Number(e.rm1reel)||oneRM(e.poids,e.reps);
    return `<div class="compact-set-row ${i===0?'is-last':''}"><span>${i===0?'Dernière':'Série'}</span><b>${esc(e.poids)} kg × ${esc(e.reps)}</b><em>1RM ${rm}</em></div>`;
  }).join('')}</div>`;
}
function compactSessionSnapshot(){
  const entries=state.session.entries||[], cardio=state.session.cardio||[];
  if(!entries.length && !cardio.length) return `<section class="compact-card compact-empty-card"><b>Séance vide</b><span>Ajoute ta première série, le reste reste rangé.</span></section>`;
  const st=sessionTimelineStats(entries,cardio);
  const unique=new Set(entries.map(e=>e.nom)).size;
  const last=entries[0];
  const lastLine=last?`${last.nom} · ${last.poids} kg × ${last.reps}`:(cardio[0]?`${cardio[0].type} · ${cardio[0].duration} min`:'—');
  return `<section class="compact-card compact-snapshot"><div class="compact-snapshot-grid"><div><strong>${st.sets}</strong><span>séries</span></div><div><strong>${unique}</strong><span>exos</span></div><div><strong>${Math.round(st.totalVolume)}</strong><span>kg</span></div><div><strong>${st.duration}</strong><span>min</span></div></div><p><b>Dernier ajout :</b> ${esc(lastLine)}</p></section>`;
}
function compactSessionLastRows(){
  const rows=[...(state.session.entries||[]).slice(0,4), ...(state.session.cardio||[]).slice(0,1)];
  if(!rows.length) return '';
  return `<div class="compact-log-mini">${rows.map(x=>x.nom?`<div><b>${esc(x.nom)}</b><span>${esc(x.poids)} kg × ${esc(x.reps)} · série ${esc(x.series)}</span></div>`:`<div><b>${esc(x.type)}</b><span>${esc(x.duration)} min · ${esc(x.label)}</span></div>`).join('')}</div>`;
}

function muscuView(){
  const m=defaultMachine(); selectedMachineName=m?.nom||selectedMachineName;
  const last=m?lastEntryFor(m.nom):null, followDraft=m?getFollowDraft(m.nom):null;
  const activeFollowDraft=state.ui.followMode?followDraft:null, preferredWeight=m?preferredWeightForExercise(m.nom):null;
  const poids=formDraft.poids??activeFollowDraft?.poids??preferredWeight??last?.poids??m?.poids?.[0]??20;
  const series=formDraft.series??activeFollowDraft?.series??1, reps=formDraft.reps??activeFollowDraft?.reps??last?.reps??10;
  const rm=formDraft.rm??activeFollowDraft?.rm??'';
  const hasSession=(state.session.entries||[]).length || (state.session.cardio||[]).length;
  return `<div class="compact-session">
    ${compactSessionHero(m, poids, reps)}
    ${state.ui.followMode?`<details class="compact-details compact-follow" open><summary>Template suivi</summary>${followPanel()}</details>`:''}
    <section class="card compact-main-card">
      <div class="compact-main-head"><div><div class="eyebrow">Saisie rapide</div><h2>Ajouter une série</h2></div><div class="compact-head-actions"><button class="btn small icon-only" data-action="exercise-open" title="Fiche exercice">${icon('book')}</button><button class="btn small icon-only" data-action="video-open" title="Vidéo">${icon('video')}</button></div></div>
      <div class="field compact-exercise-field"><label>Exercice</label><div class="select-row premium-select"><select id="machine-select">${filteredMachines().map(x=>`<option value="${esc(x.nom)}" ${x.nom===m?.nom?'selected':''}>${esc(x.nom)}</option>`).join('')}</select><button class="btn small icon-only" data-action="machine-edit" title="Modifier">${icon('edit')}</button><button class="btn small icon-only" data-action="machine-new" title="Ajouter">${icon('plus')}</button></div></div>
      <details class="compact-details compact-filter"><summary>Filtrer par groupe</summary><div class="chips">${[''].concat(groups()).map(g=>`<button class="chip ${groupFilter===g?'is-active':''}" data-group="${esc(g)}">${g?esc(g):'Tout'}</button>`).join('')}</div></details>
      <div class="compact-entry-grid"><div class="field"><label>Poids</label>${stepper('poids', poids, Number(m?.step||0.5))}</div><div class="field"><label>Reps</label>${stepper('reps', reps, 1)}</div><div class="field"><label>Série</label>${stepper('series', series, 1)}</div></div>
      <details class="compact-details compact-rm"><summary>1RM réel optionnel</summary><input id="real-rm" type="number" min="0" value="${esc(rm||'')}" placeholder="ex: 120"></details>
      <button class="btn primary full compact-add" data-action="entry-add">+ Ajouter la série</button>
      <div class="compact-current-exercise"><div class="between"><b>Dernières séries de cet exercice</b><button class="btn small secondary" data-action="rest-edit" data-name="${esc(m?.nom||'')}">Repos</button></div>${currentExerciseQuickList(m?.nom)}</div>
    </section>
    <details class="compact-details compact-ai"><summary>Conseil IA / analyse exercice</summary><div id="machine-hint" class="exercise-insights premium-insights"></div></details>
    ${compactSessionSnapshot()}
    ${compactSessionLastRows()}
    <section class="compact-save-row"><button class="btn primary full" data-action="session-save" ${hasSession?'':'disabled'}>Sauvegarder la séance</button><button class="btn danger" data-action="session-clear" ${hasSession?'':'disabled'}>Effacer</button></section>
    <details class="compact-details compact-full-session"><summary>Voir séance complète, coach IA et timeline</summary><div class="compact-full-inner">${currentSessionList()}</div></details>
  </div>`;
}
function stepper(id, value, step){ return `<div class="stepper"><button data-step-target="${id}" data-step="-${step}">−</button><input id="${id}" type="number" value="${esc(value)}" step="${step}" min="0"><button data-step-target="${id}" data-step="${step}">+</button></div>`; }
function followPanel(){
  const fm=state.ui.followMode;
  if(!fm) return '';
  const exercises=fm.exercises||[];
  const doneCount = name => (state.session.entries||[]).filter(x=>x.nom===name).length;
  const current = machineByName(selectedMachineName) || machineByName(exercises[0]?.nom);
  const list=exercises.map((e,i)=>{
    const done=doneCount(e.nom), target=Number(e.series||3);
    const active=selectedMachineName===e.nom, complete=done>=target;
    return `<div class="follow-card ${active?'is-active':''} ${complete?'is-complete':''}" draggable="true" data-follow-index="${i}" data-follow-name="${esc(e.nom)}"><button class="follow-main" data-action="follow-pick" data-name="${esc(e.nom)}"><span class="follow-index">${complete?'✓':i+1}</span><span><b>${esc(e.nom)}</b><small>${done}/${target} séries · objectif ${esc(e.poids||'—')} kg × ${esc(e.reps||10)}</small></span></button><div class="follow-move"><button type="button" data-action="follow-up" data-name="${esc(e.nom)}" title="Monter">↑</button><button type="button" data-action="follow-down" data-name="${esc(e.nom)}" title="Descendre">↓</button></div></div>`;
  }).join('');
  return `<div class="follow-page"><div class="between"><div><div class="eyebrow">Mode suivi</div><h2>${esc(fm.name)}</h2></div><button class="btn small" data-action="follow-stop">Quitter</button></div><div class="follow-current"><span>${icon('strength')}</span><div><b>Exercice actif</b><strong>${esc(current?.nom||'Choisis un exercice')}</strong><small>${doneCount(current?.nom)} série(s) déjà ajoutée(s)</small></div></div><div class="follow-grid">${list}</div></div>`;
}

function sessionPREvents(){
  return (state.session.entries||[]).filter(e=>e.prType).slice(0,4);
}
function prLabelFor(entry){
  if(!entry?.prType) return '';
  if(entry.prType==='weight') return `Record poids · ${entry.poids} kg`;
  if(entry.prType==='reps') return `Record reps · ${entry.reps} reps à ${entry.poids} kg`;
  return entry.prLabel || 'Nouveau record';
}
function celebratePR(entry){
  if(!entry?.prType || typeof document==='undefined') return;
  try{ navigator.vibrate?.([45,35,90]); }catch{}
  const burst=document.createElement('div');
  burst.className='pr-burst';
  burst.innerHTML=`<div class="pr-burst-card"><div class="pr-burst-kicker">NEW PERSONAL RECORD</div><h2>${esc(entry.nom)}</h2><p>${esc(prLabelFor(entry))}</p><div class="pr-burst-stats"><span><small>Poids</small><b>${entry.poids} kg</b></span><span><small>Reps</small><b>${entry.reps}</b></span><span><small>1RM</small><b>${Number(entry.rm1reel)||oneRM(entry.poids,entry.reps)}</b></span></div></div>`;
  document.body.appendChild(burst);
  window.setTimeout(()=>burst.classList.add('is-out'),1500);
  window.setTimeout(()=>burst.remove(),2100);
}

function sessionCoachAnalysis(){
  const entries=state.session.entries||[], cardio=state.session.cardio||[];
  if(!entries.length && !cardio.length) return null;
  const totalVolume=entries.reduce((s,e)=>s+volume(e),0);
  const seriesCount=entries.length;
  const prs=sessionPREvents();
  const cardioMinutes=cardio.reduce((s,c)=>s+(Number(c.duration)||0),0);
  const groupsMap={};
  entries.forEach(e=>{
    const g=e.groupe||'Autres';
    groupsMap[g] ||= {series:0,volume:0,exos:new Set()};
    groupsMap[g].series += 1;
    groupsMap[g].volume += volume(e);
    groupsMap[g].exos.add(e.nom);
  });
  const groups=Object.entries(groupsMap).map(([name,v])=>({name,series:v.series,volume:v.volume,exos:v.exos.size})).sort((a,b)=>b.series-a.series||b.volume-a.volume);
  const dominant=groups[0]||null;
  const uniqueExercises=[...new Set(entries.map(e=>e.nom))].length;
  const balanceRatio=dominant&&seriesCount?dominant.series/seriesCount:0;
  const density=Math.round(totalVolume/Math.max(1,seriesCount));
  let score=Math.round(seriesCount*7 + Math.min(34,totalVolume/450) + prs.length*10 + cardioMinutes/2 + uniqueExercises*3);
  score=Math.max(8,Math.min(100,score));
  const level=score>=74?'red':score>=48?'orange':'green';
  const stateLabel=score>=74?'Très intense':score>=48?'Chargé':'Contrôlé';
  let headline='Séance propre en construction';
  let advice='Continue à valider tes séries sans forcer sale.';
  let balance='Répartition encore courte, ajoute quelques séries pour une analyse fiable.';
  if(prs.length){ headline='Séance productive'; advice='Tu as déclenché un PR : garde une bonne exécution et évite d’empiler trop de séries lourdes derrière.'; }
  if(seriesCount>=5 && balanceRatio>.72 && dominant){ balance=`Séance très orientée ${dominant.name}. C’est cohérent si c’est voulu, sinon ajoute un rappel antagoniste ou stabilisateur.`; }
  else if(groups.length>=3){ balance='Répartition complète : plusieurs groupes travaillent, surveille surtout la fatigue globale.'; }
  else if(dominant){ balance=`Focus principal : ${dominant.name}, ${dominant.series} série(s).`; }
  if(score>=74){ headline='Attention à la fatigue'; advice='La séance commence à être lourde. Termine avec des séries propres, évite le record forcé.'; }
  else if(score>=48 && !prs.length){ headline='Bonne intensité'; advice='Tu es dans une zone productive. Le meilleur move : une rep propre de plus, pas forcément plus lourd.'; }
  const fm=state.ui.followMode;
  if(fm?.exercises?.length){
    const remaining=fm.exercises.map(x=>x.nom).filter(n=>entries.filter(e=>e.nom===n).length<3);
    if(remaining.length) advice=`Template en cours : encore ${remaining.slice(0,2).join(', ')}${remaining.length>2?'…':''}. Garde assez d’énergie pour finir propre.`;
    else advice='Template terminé : sauvegarde la séance ou ajoute seulement un finisher léger.';
  }
  return {score,level,stateLabel,headline,advice,balance,totalVolume,seriesCount,uniqueExercises,prs,cardioMinutes,groups,dominant,density};
}
function sessionCoachPanel(){
  const a=sessionCoachAnalysis();
  if(!a) return '';
  const groupChips=a.groups.slice(0,4).map(g=>`<span><b>${esc(g.name)}</b><em>${g.series} séries</em></span>`).join('');
  return `<section class="session-ai ${a.level}">
    <div class="session-ai-head"><div><span class="ai-kicker">Coach IA séance</span><h3>${esc(a.headline)}</h3></div><strong>${a.score}</strong></div>
    <div class="session-ai-grid"><div><span>État</span><b>${esc(a.stateLabel)}</b></div><div><span>Volume</span><b>${Math.round(a.totalVolume)} kg</b></div><div><span>Exercices</span><b>${a.uniqueExercises}</b></div><div><span>PR</span><b>${a.prs.length}</b></div></div>
    <p>${esc(a.advice)}</p>
    <div class="session-ai-balance"><span>${icon('target')} ${esc(a.balance)}</span></div>
    ${groupChips?`<div class="session-ai-groups">${groupChips}</div>`:''}
  </section>`;
}
function timeShort(iso){
  if(!iso) return '--:--';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
function sessionTimelineStats(entries,cardio){
  const all=[...entries,...cardio].filter(x=>x.createdAt).map(x=>new Date(x.createdAt).getTime()).filter(Boolean).sort((a,b)=>a-b);
  const duration=all.length?Math.max(1,Math.round((Date.now()-all[0])/60000)):0;
  const totalVolume=entries.reduce((s,e)=>s+volume(e),0);
  const topSet=entries.slice().sort((a,b)=>(Number(b.rm1reel)||oneRM(b.poids,b.reps))-(Number(a.rm1reel)||oneRM(a.poids,a.reps)))[0];
  const prCount=entries.filter(e=>e.prType).length;
  return {duration,totalVolume,topSet,prCount,sets:entries.length,cardio:cardio.length};
}
function sessionTimelineItem(entry,index){
  const latest=index===0;
  const pr=!!entry.prType;
  const nodeLabel=pr?'PR':String(index+1).padStart(2,'0');
  return `<div class="timeline-row ${latest?'is-latest':''} ${pr?'is-pr':''}">
    <div class="timeline-rail"><span class="timeline-time">${timeShort(entry.createdAt)}</span><span class="timeline-dot">${nodeLabel}</span></div>
    <div class="timeline-content">${entryCard(entry)}</div>
  </div>`;
}
function cardioTimelineItem(c,index){
  return `<div class="timeline-row is-cardio">
    <div class="timeline-rail"><span class="timeline-time">${timeShort(c.createdAt)}</span><span class="timeline-dot">C${index+1}</span></div>
    <div class="timeline-content">${cardioItem(c)}</div>
  </div>`;
}
function currentSessionList(){
  const e=state.session.entries||[], c=state.session.cardio||[];
  if(!e.length && !c.length) return `<div class="empty">Aucun exercice. Lance-toi.</div>`;
  const prs=sessionPREvents();
  const prPanel=prs.length?`<div class="pr-strip"><div><span>Live records</span><strong>${prs.length} PR session</strong></div>${prs.map(x=>`<button class="pr-mini" data-action="exercise-open" data-name="${esc(x.nom)}"><b>NEW PR</b><small>${esc(x.nom)}</small><em>${esc(prLabelFor(x))}</em></button>`).join('')}</div>`:'';
  const coach=sessionCoachPanel();
  const st=sessionTimelineStats(e,c);
  const top=st.topSet?`${esc(st.topSet.nom)} · ${st.topSet.poids} kg × ${st.topSet.reps}`:'—';
  const rows=[...e.map(sessionTimelineItem),...c.map(cardioTimelineItem)].join('');
  return `${prPanel}${coach}<section class="session-timeline-pro">
    <div class="timeline-head"><div><span class="ai-kicker">Timeline séance</span><h3>Déroulé live</h3></div><strong>${st.duration || '--'} min</strong></div>
    <div class="timeline-stats"><span><b>${st.sets}</b><em>séries</em></span><span><b>${Math.round(st.totalVolume)}</b><em>kg</em></span><span><b>${st.prCount}</b><em>PR</em></span></div>
    <div class="timeline-best"><span>Top série</span><b>${top}</b></div>
    <div class="timeline-track">${rows}</div>
  </section><div class="card session-total"><div class="between"><span class="muted">Volume séance</span><strong>${Math.round(st.totalVolume)} kg</strong></div></div>`;
}
function entryCard(e){
  const rm=Number(e.rm1reel)||oneRM(e.poids,e.reps);
  const open = !!state.ui.entryOpen?.[e.id];
  const isPR=!!e.prType;
  const prBadge=isPR?`<span class="badge pr-badge">NEW PR</span>`:'';
  const prLine=isPR?`<div class="pr-entry-line"><span>Performance débloquée</span><b>${esc(prLabelFor(e))}</b></div>`:'';
  const restInfo=e.restSuggested?{seconds:e.restSuggested,reason:e.restReason||'repos'}:smartRestFor(e.nom,e);
  const restLine=restInfo?.seconds?`<div class="rest-line">${icon('clock')} Repos conseillé · ${restInfo.seconds}s${restInfo.reason?` · ${esc(restInfo.reason)}`:''}</div>`:'';
  return `<div class="entry-swipe ${isPR?'has-pr':''}" data-entry-id="${e.id}"><div class="swipe-delete-bg">Supprimer</div><div class="item entry-item"><button class="entry-head" data-action="entry-toggle" data-id="${e.id}"><div><div class="item-title">${esc(e.nom)}</div><div class="meta">${esc(e.groupe||'')} · série ${e.series} · ${e.reps} reps · ${e.poids} kg</div>${prLine}${restLine}</div><span class="entry-badges">${prBadge}<span class="badge blue">1RM ${rm}</span></span><span class="chev">${open?'⌄':'›'}</span></button><div class="entry-body ${open?'':'hidden'}"><div class="entry-actions"><button class="btn small icon-text" data-action="exercise-open" data-name="${esc(e.nom)}">${icon('book')} Fiche</button><button class="btn small icon-text" data-action="entry-edit" data-id="${e.id}">${icon('edit')} Modifier</button><button class="btn small ok" data-action="rest-edit" data-name="${esc(e.nom)}">Repos</button><button class="btn small danger icon-text" data-action="entry-delete" data-id="${e.id}">${icon('delete')} Suppr.</button></div></div></div></div>`;
}

function cardioForm(){ return `<section class="card"><div class="field"><label>Type cardio</label><div class="chips">${['marche','course','velo','escalier'].map(t=>`<button class="chip ${cardioType===t?'is-active':''}" data-cardio-type="${t}">${t}</button>`).join('')}</div></div><div class="grid-3"><div class="field"><label>Durée</label>${stepper('c-duration',20,5)}</div><div class="field"><label>${cardioType==='velo'?'Résistance':cardioType==='escalier'?'Étages':'Vitesse'}</label>${stepper('c-main', cardioType==='velo'?5:cardioType==='escalier'?20:6, cardioType==='velo'||cardioType==='escalier'?1:0.5)}</div><div class="field"><label>${cardioType==='velo'?'RPM':cardioType==='escalier'?'Intensité':'Pente %'}</label>${stepper('c-extra', cardioType==='velo'?80:0, cardioType==='velo'?5:1)}</div></div><button class="btn primary full" data-action="cardio-add">✓ Ajouter cardio</button></section><section><div class="section-title"><h2>Séance en cours</h2></div>${currentSessionList()}</section>`; }
function cardioIcon(t){ return ''; }
function cardioItem(c){ return `<div class="item between"><div><div class="item-title">${esc(c.type)}</div><div class="meta">${c.duration} min · ${esc(c.label||'')}</div></div><button class="btn small danger" data-action="cardio-delete" data-id="${c.id}">✕</button></div>`; }
function historyView(){ const days=Object.entries(state.history||{}).sort(([a],[b])=>b.localeCompare(a)); return days.length ? `<div class="list">${days.map(([d,v])=>dayCard(d,v,true)).join('')}</div>` : `<div class="empty">Pas encore d’historique.</div>`; }
function dayCard(date, day, deletable){ const entries=day.entries||[], cardio=day.cardio||[]; const vol=entries.reduce((s,e)=>s+volume(e),0); return `<article class="item"><div class="between"><div><div class="item-title">${fmtDateLong(date)}</div><div class="meta">${entries.length} exercice(s) · ${cardio.length} cardio · ${Math.round(vol)} kg</div></div>${deletable?`<button class="btn small danger" data-action="day-delete" data-date="${date}">Suppr.</button>`:''}</div><div class="list day-mini">${entries.slice(0,8).map(e=>`<div class="between"><span class="small-text">${esc(e.nom)}</span><span class="badge ac">${e.series}×${e.reps} · ${e.poids}kg</span></div>`).join('')}${cardio.map(c=>`<div class="between"><span class="small-text">${esc(c.type)}</span><span class="badge purple">${c.duration}min</span></div>`).join('')}</div></article>`; }



const BODY_PART_GROUPS = Object.freeze({"cou_trapezes":["Épaules","Dos"],"epaules":["Épaules"],"pectoraux":["Pectoraux"],"biceps":["Biceps"],"avant_bras":["Biceps","Triceps"],"mains":["Biceps","Triceps"],"obliques":["Abdos"],"abdominaux":["Abdos"],"adducteurs":["Jambes"],"quadriceps":["Jambes"],"genoux":["Jambes"],"tibias_mollets":["Mollets","Jambes"],"pieds":["Mollets","Jambes"],"haut_du_dos":["Dos"],"grand_dorsal":["Dos"],"triceps":["Triceps"],"lombaires":["Dos"],"fessiers":["Jambes"],"ischio_jambiers":["Jambes"],"mollets":["Mollets"]});
const BODY_PARTS = Object.freeze([{"id":"front-cou-trapezes","part":"cou_trapezes","view":"front","lateral":"centre","label":"Cou / trapèzes avant","d":"M248 183 C267 169 288 160 298 153 L300 116 C315 133 334 139 336 139 C351 139 365 132 375 116 L376 154 C392 161 412 172 425 183 C402 185 383 188 367 199 C357 189 346 186 336 187 C323 185 312 189 302 199 C286 188 269 185 248 183 Z"},{"id":"front-epaule-gauche","part":"epaules","view":"front","lateral":"gauche","label":"Épaule avant gauche","d":"M171 269 C176 226 199 194 248 183 C273 178 292 183 302 198 C282 204 266 224 249 244 C227 270 204 262 171 269 Z"},{"id":"front-epaule-droite","part":"epaules","view":"front","lateral":"droite","label":"Épaule avant droite","d":"M399 198 C410 183 429 178 455 183 C504 194 527 226 532 269 C499 262 476 270 454 244 C437 224 421 204 399 198 Z"},{"id":"front-pectoraux-gauche","part":"pectoraux","view":"front","lateral":"gauche","label":"Pectoraux gauche","d":"M248 184 C283 181 324 181 333 200 L334 260 C322 288 300 300 264 294 C239 289 224 274 219 250 C213 219 226 195 248 184 Z"},{"id":"front-pectoraux-droite","part":"pectoraux","view":"front","lateral":"droite","label":"Pectoraux droite","d":"M338 200 C347 181 388 181 423 184 C445 195 458 219 452 250 C447 274 432 289 407 294 C371 300 349 288 337 260 Z"},{"id":"front-biceps-gauche","part":"biceps","view":"front","lateral":"gauche","label":"Biceps gauche","d":"M169 263 C198 254 224 258 226 285 C228 309 211 330 194 349 C180 365 159 374 148 363 C136 351 143 315 151 293 C156 278 160 267 169 263 Z"},{"id":"front-biceps-droite","part":"biceps","view":"front","lateral":"droite","label":"Biceps droite","d":"M503 263 C474 254 448 258 446 285 C444 309 461 330 478 349 C492 365 513 374 524 363 C536 351 529 315 521 293 C516 278 512 267 503 263 Z"},{"id":"front-avant-bras-gauche","part":"avant_bras","view":"front","lateral":"gauche","label":"Avant-bras gauche","d":"M142 336 C135 363 119 389 101 412 C86 432 76 456 66 474 C62 481 70 485 84 476 C109 459 128 438 144 414 C158 393 177 376 184 351 C170 357 151 353 142 336 Z"},{"id":"front-avant-bras-droite","part":"avant_bras","view":"front","lateral":"droite","label":"Avant-bras droite","d":"M530 336 C537 363 553 389 571 412 C586 432 596 456 606 474 C610 481 602 485 588 476 C563 459 544 438 528 414 C514 393 495 376 488 351 C502 357 521 353 530 336 Z"},{"id":"front-main-gauche","part":"mains","view":"front","lateral":"gauche","label":"Main gauche","d":"M67 475 C70 493 61 506 56 520 C50 535 49 558 45 570 C38 569 42 543 42 528 C44 513 49 502 53 490 C56 482 60 477 67 475 Z"},{"id":"front-main-droite","part":"mains","view":"front","lateral":"droite","label":"Main droite","d":"M605 475 C602 493 611 506 616 520 C622 535 623 558 627 570 C634 569 630 543 630 528 C628 513 623 502 619 490 C616 482 612 477 605 475 Z"},{"id":"front-obliques-gauche","part":"obliques","view":"front","lateral":"gauche","label":"Obliques gauche","d":"M262 294 C276 299 286 304 291 314 C283 360 281 412 286 454 C267 457 252 443 252 411 C253 382 240 352 230 326 C241 323 254 311 262 294 Z"},{"id":"front-obliques-droite","part":"obliques","view":"front","lateral":"droite","label":"Obliques droite","d":"M410 294 C396 299 386 304 381 314 C389 360 391 412 386 454 C405 457 420 443 420 411 C419 382 432 352 442 326 C431 323 418 311 410 294 Z"},{"id":"front-abdominaux","part":"abdominaux","view":"front","lateral":"centre","label":"Abdominaux","d":"M293 293 C317 286 355 286 379 293 C387 326 388 453 354 501 C346 512 337 519 335 519 C333 519 324 512 316 501 C282 453 285 326 293 293 Z"},{"id":"front-bassin-adducteurs","part":"adducteurs","view":"front","lateral":"centre","label":"Bassin / adducteurs","d":"M286 458 C306 478 317 518 335 519 C353 518 366 478 386 458 C371 494 360 568 336 570 C310 568 301 493 286 458 Z"},{"id":"front-quadriceps-gauche","part":"quadriceps","view":"front","lateral":"gauche","label":"Quadriceps gauche","d":"M229 521 C250 551 302 570 334 570 C330 628 312 698 290 734 C276 760 262 751 256 732 C249 739 235 736 230 720 C215 648 218 574 229 521 Z"},{"id":"front-quadriceps-droite","part":"quadriceps","view":"front","lateral":"droite","label":"Quadriceps droite","d":"M443 521 C422 551 370 570 338 570 C342 628 360 698 382 734 C396 760 410 751 416 732 C423 739 437 736 442 720 C457 648 454 574 443 521 Z"},{"id":"front-genou-gauche","part":"genoux","view":"front","lateral":"gauche","label":"Genou gauche","d":"M228 777 C247 803 275 806 293 779 C286 799 285 821 282 835 C268 852 241 849 224 831 C221 813 222 793 228 777 Z"},{"id":"front-genou-droite","part":"genoux","view":"front","lateral":"droite","label":"Genou droite","d":"M444 777 C425 803 397 806 379 779 C386 799 387 821 390 835 C404 852 431 849 448 831 C451 813 450 793 444 777 Z"},{"id":"front-tibias-mollets-gauche","part":"tibias_mollets","view":"front","lateral":"gauche","label":"Tibias / mollets gauche","d":"M225 829 C240 848 266 853 282 836 C279 861 269 881 264 910 C259 937 258 970 260 990 C254 1006 232 1009 214 1019 C224 977 224 933 216 891 C211 861 215 842 225 829 Z"},{"id":"front-tibias-mollets-droite","part":"tibias_mollets","view":"front","lateral":"droite","label":"Tibias / mollets droite","d":"M447 829 C432 848 406 853 390 836 C393 861 403 881 408 910 C413 937 414 970 412 990 C418 1006 440 1009 458 1019 C448 977 448 933 456 891 C461 861 457 842 447 829 Z"},{"id":"front-pied-gauche","part":"pieds","view":"front","lateral":"gauche","label":"Pied gauche","d":"M214 1017 C234 1009 252 1000 259 989 C259 1009 260 1027 240 1035 C238 1049 216 1057 191 1064 C178 1064 174 1057 183 1044 C194 1032 204 1026 214 1017 Z"},{"id":"front-pied-droite","part":"pieds","view":"front","lateral":"droite","label":"Pied droite","d":"M458 1017 C438 1009 420 1000 413 989 C413 1009 412 1027 432 1035 C434 1049 456 1057 481 1064 C494 1064 498 1057 489 1044 C478 1032 468 1026 458 1017 Z"},{"id":"back-cou-trapezes","part":"cou_trapezes","view":"back","lateral":"centre","label":"Cou / trapèzes arrière","d":"M888 182 C910 168 930 160 943 154 L943 113 C960 124 980 127 982 127 C1004 126 1023 113 1024 113 L1024 154 C1036 160 1059 168 1076 182 C1052 184 1034 190 1016 202 C994 198 970 198 948 202 C929 190 911 184 888 182 Z"},{"id":"back-deltoide-gauche","part":"epaules","view":"back","lateral":"gauche","label":"Épaule arrière gauche","d":"M816 251 C820 216 846 190 888 182 C908 180 928 189 949 202 C932 219 918 239 902 246 C876 251 849 249 816 251 Z"},{"id":"back-deltoide-droite","part":"epaules","view":"back","lateral":"droite","label":"Épaule arrière droite","d":"M1148 251 C1144 216 1118 190 1076 182 C1056 180 1036 189 1015 202 C1032 219 1046 239 1062 246 C1088 251 1115 249 1148 251 Z"},{"id":"back-haut-du-dos","part":"haut_du_dos","view":"back","lateral":"centre","label":"Haut du dos","d":"M949 203 C971 199 995 199 1016 203 C1002 229 991 263 982 323 C973 263 963 229 949 203 Z"},{"id":"back-grand-dorsal-gauche","part":"grand_dorsal","view":"back","lateral":"gauche","label":"Grand dorsal gauche","d":"M887 183 C914 191 931 209 949 203 C962 235 976 279 982 322 C966 359 935 392 935 441 C906 451 877 430 872 389 C866 345 840 321 835 292 C830 260 848 219 887 183 Z"},{"id":"back-grand-dorsal-droite","part":"grand_dorsal","view":"back","lateral":"droite","label":"Grand dorsal droite","d":"M1077 183 C1050 191 1033 209 1015 203 C1002 235 988 279 982 322 C998 359 1029 392 1029 441 C1058 451 1087 430 1092 389 C1098 345 1124 321 1129 292 C1134 260 1116 219 1077 183 Z"},{"id":"back-triceps-gauche","part":"triceps","view":"back","lateral":"gauche","label":"Triceps gauche","d":"M812 252 C842 247 865 247 867 295 C865 315 849 337 823 361 C812 350 799 344 784 341 C790 313 794 274 812 252 Z"},{"id":"back-triceps-droite","part":"triceps","view":"back","lateral":"droite","label":"Triceps droite","d":"M1152 252 C1122 247 1099 247 1097 295 C1099 315 1115 337 1141 361 C1152 350 1165 344 1180 341 C1174 313 1170 274 1152 252 Z"},{"id":"back-avant-bras-gauche","part":"avant_bras","view":"back","lateral":"gauche","label":"Avant-bras gauche arrière","d":"M784 340 C775 376 753 405 733 430 C716 451 704 477 698 486 C691 486 689 475 696 453 C705 420 715 389 735 360 C748 341 765 331 784 340 Z"},{"id":"back-avant-bras-droite","part":"avant_bras","view":"back","lateral":"droite","label":"Avant-bras droite arrière","d":"M1180 340 C1189 376 1211 405 1231 430 C1248 451 1260 477 1266 486 C1273 486 1275 475 1268 453 C1259 420 1249 389 1229 360 C1216 341 1199 331 1180 340 Z"},{"id":"back-main-gauche","part":"mains","view":"back","lateral":"gauche","label":"Main gauche arrière","d":"M699 485 C704 499 699 513 694 526 C689 540 699 563 711 577 C719 573 711 558 713 544 C715 530 723 521 720 511 C713 504 710 492 699 485 Z"},{"id":"back-main-droite","part":"mains","view":"back","lateral":"droite","label":"Main droite arrière","d":"M1265 485 C1260 499 1265 513 1270 526 C1275 540 1265 563 1253 577 C1245 573 1253 558 1251 544 C1249 530 1241 521 1244 511 C1251 504 1254 492 1265 485 Z"},{"id":"back-lombaires","part":"lombaires","view":"back","lateral":"centre","label":"Lombaires","d":"M937 389 C950 352 967 333 982 323 C997 333 1014 352 1027 389 C1028 408 1028 430 1028 446 C1008 449 996 445 982 448 C968 445 956 449 936 446 C936 430 936 408 937 389 Z"},{"id":"back-fessier-gauche","part":"fessiers","view":"back","lateral":"gauche","label":"Fessier gauche","d":"M936 448 C956 444 974 447 982 466 L982 568 C945 574 909 568 895 548 C884 531 891 486 907 466 C916 456 926 451 936 448 Z"},{"id":"back-fessier-droite","part":"fessiers","view":"back","lateral":"droite","label":"Fessier droite","d":"M1028 448 C1008 444 990 447 982 466 L982 568 C1019 574 1055 568 1069 548 C1080 531 1073 486 1057 466 C1048 456 1038 451 1028 448 Z"},{"id":"back-ischios-gauche","part":"ischio_jambiers","view":"back","lateral":"gauche","label":"Ischio-jambiers gauche","d":"M896 548 C915 570 948 574 982 568 C980 627 960 700 934 747 C921 769 909 753 905 722 C898 739 886 758 876 750 C862 694 862 617 896 548 Z"},{"id":"back-ischios-droite","part":"ischio_jambiers","view":"back","lateral":"droite","label":"Ischio-jambiers droite","d":"M1068 548 C1049 570 1016 574 982 568 C984 627 1004 700 1030 747 C1043 769 1055 753 1059 722 C1066 739 1078 758 1088 750 C1102 694 1102 617 1068 548 Z"},{"id":"back-genou-gauche","part":"genoux","view":"back","lateral":"gauche","label":"Genou arrière gauche","d":"M874 797 C891 814 908 810 921 797 C927 797 931 812 929 835 C914 844 890 842 864 819 C866 808 869 801 874 797 Z"},{"id":"back-genou-droite","part":"genoux","view":"back","lateral":"droite","label":"Genou arrière droite","d":"M1090 797 C1073 814 1056 810 1043 797 C1037 797 1033 812 1035 835 C1050 844 1074 842 1100 819 C1098 808 1095 801 1090 797 Z"},{"id":"back-mollet-gauche","part":"mollets","view":"back","lateral":"gauche","label":"Mollet gauche","d":"M864 819 C886 840 912 843 928 835 C929 880 921 915 909 951 C897 987 895 1019 896 1048 C875 1055 855 1043 859 1013 C861 978 852 920 850 882 C847 852 854 832 864 819 Z"},{"id":"back-mollet-droite","part":"mollets","view":"back","lateral":"droite","label":"Mollet droite","d":"M1100 819 C1078 840 1052 843 1036 835 C1035 880 1043 915 1055 951 C1067 987 1069 1019 1068 1048 C1089 1055 1109 1043 1105 1013 C1103 978 1112 920 1114 882 C1117 852 1110 832 1100 819 Z"},{"id":"back-pied-gauche","part":"pieds","view":"back","lateral":"gauche","label":"Pied gauche arrière","d":"M857 1013 C871 1041 894 1045 896 1048 C894 1062 875 1067 852 1058 C835 1061 814 1055 818 1044 C827 1033 843 1031 857 1013 Z"},{"id":"back-pied-droite","part":"pieds","view":"back","lateral":"droite","label":"Pied droite arrière","d":"M1107 1013 C1093 1041 1070 1045 1068 1048 C1070 1062 1089 1067 1112 1058 C1129 1061 1150 1055 1146 1044 C1137 1033 1121 1031 1107 1013 Z"}]);

function datedWorkoutRows(){
  const rows=[];
  Object.entries(state.history||{}).forEach(([date,day])=>(day.entries||[]).forEach(e=>rows.push({...e,date})));
  (state.session.entries||[]).forEach(e=>rows.push({...e,date:todayKey(),live:true}));
  return rows.filter(e=>e.groupe&&Number(e.poids)>0&&Number(e.reps)>0);
}
function daysSince(date){ if(!date) return null; return Math.max(0,Math.floor((new Date(todayKey()+'T00:00:00')-new Date(date+'T00:00:00'))/86400000)); }
function muscleStats(group,days=30){
  const start=new Date(todayKey()+'T00:00:00'); start.setDate(start.getDate()-days); const startKey=start.toISOString().slice(0,10);
  const rows=datedWorkoutRows().filter(e=>e.groupe===group), recent=rows.filter(e=>e.date>=startKey);
  const last=rows.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1);
  const ago=last?daysSince(last.date):null, sets=recent.length, vol=recent.reduce((s,e)=>s+volume(e),0);
  let tone='empty', status='À construire', advice='Ajoute quelques séries pour créer une base fiable.';
  if(ago!==null){
    if(ago<=1){ tone='hot'; status='Très sollicité'; advice='Garde une marge, ou travaille un autre groupe.'; }
    else if(ago<=3){ tone='loaded'; status='En récupération'; advice='Possible, mais évite de forcer un record.'; }
    else if(ago<=6){ tone='ready'; status='Prêt'; advice='Bon moment pour le retravailler.'; }
    else if(ago<=10){ tone='late'; status='À relancer'; advice='Une séance modérée serait utile.'; }
    else { tone='danger'; status='En retard'; advice='Priorité haute si c’est un groupe important pour toi.'; }
  }
  const score=ago===null?0:Math.max(0,Math.min(100,Math.round(100-(Math.max(0,ago-4)*9)+(sets>16?-14:sets>10?-6:4))));
  return {group,rows,recent,last,ago,sets,vol,tone,status,advice,score};
}
function bodyZoneDefinitions(){
  const available=groups();
  const keep=list=>list.filter(g=>available.includes(g));
  return BODY_PARTS.map(p=>({
    id:p.id,
    part:p.part,
    label:p.label,
    side:p.view,
    lateral:p.lateral,
    groups:keep(BODY_PART_GROUPS[p.part]||[]),
    hint:p.view==='back'?'Vue dos':'Vue face'
  })).filter(z=>z.groups.length);
}
function bodyZoneStats(){
  const toneRank={danger:5,late:4,ready:3,loaded:2,hot:1,empty:0};
  return bodyZoneDefinitions().map(z=>{
    const stats=z.groups.map(g=>muscleStats(g,30));
    const worst=stats.slice().sort((a,b)=>toneRank[b.tone]-toneRank[a.tone])[0]||stats[0];
    const sets=stats.reduce((s,x)=>s+x.sets,0), vol=stats.reduce((s,x)=>s+x.vol,0);
    const ago=Math.min(...stats.map(x=>x.ago??999));
    return {...z,stats,worst,sets,vol,ago:ago===999?null:ago};
  });
}
function bodyExercisesForGroups(groupList){
  const selected=Array.isArray(groupList)?groupList:String(groupList||'').split('|').filter(Boolean);
  return allMachines().filter(m=>selected.includes(m.groupe)).map(m=>{
    const rows=entriesForExercise(m.nom);
    const last=lastEntryFor(m.nom);
    const goal=getExerciseGoal(m.nom);
    const best=rows.length?Math.max(...rows.map(e=>Number(e.poids)||0)):0;
    const score=(last?30:0)+(rows.length*2)+(m.video?4:0)+best/10;
    return {machine:m,last,goal,best,score};
  }).sort((a,b)=>b.score-a.score||a.machine.nom.localeCompare(b.machine.nom)).slice(0,7);
}
function bodyPrimaryExercise(groupList){ return bodyExercisesForGroups(groupList)[0]||null; }
function bodyStartExercise(name){
  const m=machineByName(name); if(!m) return toast('Exercice introuvable','warn');
  $('#modal-root').innerHTML='';
  selectedMachineName=m.nom;
  groupFilter=m.groupe||'';
  const last=lastEntryFor(m.nom);
  formDraft={poids:preferredWeightForExercise(m.nom)||last?.poids||m.poids?.[0]||20,series:1,reps:last?.reps||10,rm:''};
  setRoute('session');
}
function humanAtlasClass(z){ return `anatomy-zone muscle-${z?.worst?.tone||'empty'}`; }
function bodyPremiumClass(z){ return `premium-hit hit-${z?.worst?.tone||'empty'} ${z?.side?`hit-side-${z.side}`:''}`; }
function bodyHumanSvg(zones){
  const byId=Object.fromEntries(zones.map(z=>[z.id,z]));
  const hit=(id)=>{
    const z=byId[id];
    const groups=(z?.groups||[]).join('|');
    const muted=(bodyMapSide==='front'&&z?.side==='back')||(bodyMapSide==='back'&&z?.side==='front');
    const action=groups?`data-action="body-focus" data-groups="${esc(groups)}" data-part="${esc(z?.part||'')}" data-label="${esc(z?.label||'')}" role="button" tabindex="0"`:'aria-disabled="true"';
    return `class="${bodyPremiumClass(z)} ${muted?'is-muted':''}" ${action} aria-label="${esc(z?.label||id)}"`;
  };
  const paths=BODY_PARTS.map(p=>`<path id="${esc(p.id)}" ${hit(p.id)} d="${esc(p.d)}"><title>${esc(p.label)}</title></path>`).join('');
  return `<div class="body-premium-map musclewiki-inspired side-${bodyMapSide}" aria-label="Carte musculaire interactive">
    <img class="body-premium-img" src="assets/body-map-base.png" alt="Illustration anatomique musculaire face et dos" loading="lazy">
    <svg class="body-premium-overlay" viewBox="0 0 1318 1066" aria-hidden="false">
      <g id="body-click-zones">${paths}</g>
    </svg>
    <div class="body-premium-legend"><span class="ready">Prêt</span><span class="loaded">Récupération</span><span class="danger">À relancer</span></div>
  </div>`;
}
function renderBodyMap(){
  const zones=bodyZoneStats();
  const late=zones.filter(z=>['danger','late'].includes(z.worst?.tone));
  const ready=zones.filter(z=>z.worst?.tone==='ready');
  const hot=zones.filter(z=>['hot','loaded'].includes(z.worst?.tone));
  const target=late[0]||ready[0]||zones[0];
  const rec=target?bodyPrimaryExercise(target.groups):null;
  const headline=late[0]?`${late[0].label} à relancer`:hot[0]?`${hot[0].label} déjà chargé`:'Répartition correcte';
  const visible=zones.filter(z=>z.side===bodyMapSide);
  const rows=visible.map(z=>`<button class="body-row ${z.worst?.tone||'empty'}" data-action="body-focus" data-groups="${esc(z.groups.join('|'))}"><span>${esc(z.label)}</span><b>${esc(z.worst?.status||'—')}</b><small>${z.sets} série(s) · ${z.ago===null?'jamais':`J-${z.ago}`} · ${esc(z.hint||'')}</small></button>`).join('');
  const recBlock=target?`<div class="body-reco-card"><div><span>Recommandé aujourd’hui</span><b>${esc(target.label)}</b><small>${rec?`${esc(rec.machine.nom)} · ${rec.goal?.main||'objectif à construire'}`:'Ajoute un exercice à ce groupe'}</small></div>${rec?`<button class="btn primary small" data-action="body-start-exercise" data-name="${esc(rec.machine.nom)}">Lancer</button>`:''}</div>`:'';
  return `<section class="bodymap-card human-card muscle-hub card"><div class="section-title no-margin"><div><div class="eyebrow">Muscle map</div><h2>Choisis un muscle</h2></div><span class="body-score">${esc(headline)}</span></div>${recBlock}<div class="body-map-controls"><button class="tab ${bodyMapSide==='front'?'is-active':''}" data-action="body-side" data-side="front">Face</button><button class="tab ${bodyMapSide==='back'?'is-active':''}" data-action="body-side" data-side="back">Dos</button></div><div class="bodymap-layout human-layout muscle-hub-layout"><div class="body-figure human-figure">${bodyHumanSvg(zones)}</div><div class="body-list muscle-panel"><div class="eyebrow">Zones ${bodyMapSide==='back'?'dos':'face'}</div>${rows}</div></div><p class="muted small-text body-help">Clique un muscle pour ouvrir une fiche avec recommandation, alternatives, fiche exercice et vidéo.</p></section>`;
}
function openBodyFocus(groupsStr='', label=''){
  const selected=String(groupsStr).split('|').filter(Boolean);
  const stats=selected.map(g=>muscleStats(g,30));
  const title=label || selected.join(' / ') || 'Groupe musculaire';
  const totalSets=stats.reduce((s,x)=>s+x.sets,0), totalVol=Math.round(stats.reduce((s,x)=>s+x.vol,0));
  const main=stats.slice().sort((a,b)=>(b.ago??999)-(a.ago??999))[0]||stats[0];
  const exercises=bodyExercisesForGroups(selected);
  const best=exercises[0];
  const exCards=exercises.length?exercises.map((x,i)=>`<article class="body-exercise-card ${i===0?'is-recommended':''}"><div><span>${i===0?'Recommandé':'Alternative'}</span><b>${esc(x.machine.nom)}</b><small>${x.goal?.main?esc(x.goal.main):(x.last?`${x.last.poids} kg × ${x.last.reps}`:'Pas encore travaillé')}</small></div><div class="body-exercise-actions"><button class="btn primary small" data-action="body-start-exercise" data-name="${esc(x.machine.nom)}">Lancer</button><button class="btn small" data-action="exercise-open" data-name="${esc(x.machine.nom)}">Fiche</button>${x.machine.video?`<button class="btn small" data-action="video-open" data-name="${esc(x.machine.nom)}">Vidéo</button>`:''}</div></article>`).join(''):'<p class="muted">Aucun exercice disponible pour ce groupe.</p>';
  $('#modal-root').innerHTML=`<div class="modal-backdrop body-sheet-backdrop"><div class="modal body-modal body-sheet"><div class="body-sheet-handle"></div><div class="between"><div><div class="eyebrow">Focus musculaire</div><h2>${esc(title)}</h2><p class="muted small-text">${selected.map(esc).join(' / ')}</p></div><button class="btn small secondary" data-action="modal-close">Fermer</button></div><div class="body-focus-grid"><div><span>Statut</span><b>${esc(main?.status||'À construire')}</b></div><div><span>Séries 30j</span><b>${totalSets}</b></div><div><span>Volume 30j</span><b>${totalVol} kg</b></div><div><span>Dernier travail</span><b>${main?.ago===null||main?.ago===undefined?'—':`J-${main.ago}`}</b></div></div>${best?`<section class="body-coach-pick"><span>Prochaine meilleure action</span><h3>${esc(best.machine.nom)}</h3><p>${esc(best.goal?.reason||main?.advice||'Travaille propre, sans forcer inutilement.')}</p><button class="btn primary full" data-action="body-start-exercise" data-name="${esc(best.machine.nom)}">Démarrer cet exercice</button></section>`:''}<section class="book-section"><h3>Conseil coach</h3><p>${esc(main?.advice||'Construis un peu plus d’historique pour lire ce groupe.')}</p></section><section class="book-section"><h3>Exercices ciblés</h3><div class="body-exercise-list">${exCards}</div></section></div></div>`;
}

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
  ${renderBodyMap()}
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
function settingsView(){ return `<div class="grid"><section class="card"><div class="field"><label>Prénom</label><input id="setting-name" value="${esc(state.settings.userName||'Kevin')}"></div><div class="field"><label>Base repos intelligent</label><input id="setting-timer" type="number" min="15" step="5" value="${Number(state.settings.timerDefault||60)}"><p class="muted small-text">L'app adapte ensuite selon charge, reps, PR et fatigue locale.</p></div><button class="btn primary full" data-action="settings-save">Sauvegarder</button></section><section class="card"><div class="section-title no-margin"><h2>Données</h2></div><button class="btn full" data-action="export-json">Exporter JSON</button><label class="btn full import-label">Importer JSON<input id="import-json" type="file" accept="application/json"></label></section><section class="card danger-zone"><div class="section-title no-margin"><h2>Danger</h2></div><button class="btn danger full" data-action="reset-all">Tout réinitialiser</button></section></div>`; }

function render(){ $('#today-label').textContent=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); $('#page-title').textContent=titles[route]||'GymLog'; view.innerHTML = ({home,session:sessionView,history:historyView,stats:statsView,settings:settingsView,exercise:exerciseDetailView}[route]||home)(); afterRender(); }
function afterRender(){ const select=$('#machine-select'); if(select){ select.addEventListener('change', () => { captureForm(); rememberFollowDraft(selectedMachineName); selectedMachineName=select.value; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(select.value); const m=machineByName(select.value); formDraft=saved ? {...saved} : {poids:last?.poids ?? m?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; render(); }); updateMachineHint(); } const se=$('#stats-exercise'); if(se) se.addEventListener('change',()=>{selectedMachineName=se.value; render();}); const sm=$('#stats-metric'); if(sm) sm.addEventListener('change',()=>{statsMetric=sm.value; render();}); initSwipeDelete(); initFollowDrag(); }
function videoUrl(m){
  if(!m?.video) return '';
  const raw=String(m.video).trim();
  if(!raw) return '';
  if(raw.startsWith('http')) return raw;
  return 'https://youtube.com/watch?v='+raw;
}
function youtubeData(raw=''){
  const value=String(raw||'').trim();
  if(!value) return null;
  let id='', start='';
  try{
    if(value.startsWith('http')){
      const u=new URL(value);
      if(u.hostname.includes('youtu.be')) id=u.pathname.replace('/','');
      else if(u.hostname.includes('youtube.com')) id=u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || '';
      start=u.searchParams.get('t') || u.searchParams.get('start') || '';
    }else{
      const [base,q='']=value.split('?');
      id=base;
      const params=new URLSearchParams(q);
      start=params.get('t') || params.get('start') || '';
    }
  }catch{
    const [base,q='']=value.split('?');
    id=base;
    const params=new URLSearchParams(q);
    start=params.get('t') || params.get('start') || '';
  }
  id=String(id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32);
  if(!id) return null;
  const seconds=String(start||'').match(/^\d+/)?.[0] || '';
  return {id,seconds};
}
function videoEmbedFor(m){
  const raw=String(m?.video||'').trim();
  if(!raw) return null;
  const external=videoUrl(m);
  const isMp4=/\.mp4(\?|$)/i.test(raw) || /cloudinary\.com\/.*\/video\/upload/i.test(raw);
  if(isMp4 && raw.startsWith('http')) return {type:'mp4',src:raw,external};
  const yt=youtubeData(raw);
  if(yt){
    const start=yt.seconds?`&start=${yt.seconds}`:'';
    return {type:'youtube',src:`https://www.youtube.com/embed/${yt.id}?rel=0&modestbranding=1${start}`,external};
  }
  return raw.startsWith('http') ? {type:'external',src:raw,external} : null;
}
function openVideoModal(m=currentMachine()){
  const data=videoEmbedFor(m);
  if(!data) return toast('Aucune vidéo pour cet exercice','warn');
  const title=esc(m?.nom||'Vidéo exercice');
  const player=data.type==='youtube'
    ? `<iframe class="video-player" src="${esc(data.src)}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
    : data.type==='mp4'
      ? `<video class="video-player" src="${esc(data.src)}" controls playsinline></video>`
      : `<div class="video-fallback"><p>Cette vidéo ne peut pas être intégrée directement.</p><button class="btn primary" data-action="video-external" data-url="${esc(data.external)}">Ouvrir la vidéo</button></div>`;
  $('#modal-root').innerHTML=`<div class="video-modal-backdrop"><section class="video-modal"><div class="video-modal-head"><div><div class="eyebrow">Vidéo technique</div><h2>${title}</h2></div><button class="btn small icon-only" data-action="modal-close" title="Fermer">${icon('close')}</button></div><div class="video-frame">${player}</div><div class="video-modal-actions"><button class="btn secondary" data-action="modal-close">Fermer</button><button class="btn primary" data-action="video-external" data-url="${esc(data.external)}">Ouvrir externe</button></div></section></div>`;
}
function updateMachineHint(){
  const m=currentMachine(), el=$('#machine-hint'); if(!el) return; if(!m){el.innerHTML=''; return;}
  const currentWeight=Number($('#poids')?.value??formDraft.poids??0), rows=entriesForExercise(m.nom), last=lastEntryFor(m.nom), maxReps=maxRepsForWeight(m.nom,currentWeight), ai=progressionAIFor(m.nom);
  const rest=smartRestFor(m.nom);
  if(!rows.length){ el.innerHTML=`<div class="premium-goal"><span>${icon('target')} Objectif conseillé</span><b>Démarre proprement</b><em>Aucun historique pour cet exercice.</em></div>${smartRestCard(m.nom)}`; return; }
  el.innerHTML=`<div class="premium-goal ${ai.level}"><span>${icon('target')} ${ai.level==='up'?'Montée possible':'Objectif conseillé'}</span><b>${esc(ai.optionA||'Objectif propre')}</b><em>${esc(ai.text||'')}</em></div><div class="insight-card"><span>Dernière fois</span><b>${last?`${last.poids} kg × ${last.reps}`:'—'}</b></div><div class="insight-card"><span>Max à ${currentWeight||'—'} kg</span><b>${maxReps?`${maxReps} reps`:'—'}</b></div>${smartRestCard(m.nom)}<button class="analysis-link" data-action="exercise-open" data-name="${esc(m.nom)}">${icon('book')} Voir analyse complète</button>`;
}
function captureForm(){
  if($('#poids')){
    formDraft={poids:Number($('#poids').value)||0, series:Number($('#series').value)||1, reps:Number($('#reps').value)||10, rm:$('#real-rm')?.value||''};
    rememberFollowDraft();
    updateMachineHint();
  }
}

function addEntry(){
  const m=currentMachine(); if(!m) return toast('Choisis un exercice','warn'); captureForm();
  const previousMaxWeight = maxWeightFor(m.nom);
  const previousMaxRepsAtWeight = maxRepsForWeight(m.nom, formDraft.poids);
  const entry={id:uid(),nom:m.nom,groupe:m.groupe,icon:m.icon,poids:formDraft.poids,series:formDraft.series||1,reps:formDraft.reps||1,rm1reel:formDraft.rm?Number(formDraft.rm):null,createdAt:new Date().toISOString()};
  entry.rm1est=oneRM(entry.poids,entry.reps);
  const weightRecord = previousMaxWeight !== null && Number(entry.poids) > Number(previousMaxWeight);
  const repsRecord = previousMaxRepsAtWeight !== null && Number(entry.reps) > Number(previousMaxRepsAtWeight);
  if(weightRecord){ entry.prType='weight'; entry.prLabel=`Record poids · ${entry.poids} kg`; }
  else if(repsRecord){ entry.prType='reps'; entry.prLabel=`Record reps · ${entry.reps} reps à ${entry.poids} kg`; }
  if(entry.prType) entry.prCreatedAt=new Date().toISOString();
  const restPlan=smartRestFor(m.nom, entry, {weightRecord,repsRecord});
  entry.restSuggested=restPlan.seconds;
  entry.restReason=restPlan.reason;
  state.session.entries.unshift(entry); updateRecords(entry);
  formDraft.series = Math.min((formDraft.series||1)+1, 99); formDraft.rm='';
  rememberFollowDraft(m.nom);
  persist();
  if(entry.prType) toast(`NEW PR — ${prLabelFor(entry)}`, 'ok');
  else toast('Série ajoutée','ok');
  render();
  startTimer(restPlan.seconds, `${m.nom} · ${restPlan.reason}`);
  if(entry.prType) celebratePR(entry);
}
function addCardio(){ const duration=Number($('#c-duration')?.value)||0; const main=Number($('#c-main')?.value)||0; const extra=Number($('#c-extra')?.value)||0; const label = cardioType==='velo' ? `rés. ${main} · ${extra} rpm` : cardioType==='escalier' ? `${main} étages` : `${main} km/h · pente ${extra}%`; state.session.cardio.unshift({id:uid(),type:cardioType,duration,main,extra,label,createdAt:new Date().toISOString()}); persist(); toast('Cardio ajouté','ok'); render(); }
async function saveSession(){ if(!state.session.entries.length && !state.session.cardio.length) return toast('Séance vide','warn'); const day=todayKey(); const prev=state.history[day] || {entries:[],cardio:[]}; state.history[day]={entries:[...state.session.entries,...(prev.entries||[])], cardio:[...state.session.cardio,...(prev.cardio||[])]}; state.session={entries:[],cardio:[]}; state.ui.followMode=null; formDraft.series=1; persist(); toast('Séance sauvegardée','ok'); setRoute('history'); }


function cleanText(v=''){ return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function allHistoryEntries(){ return Object.entries(state.history||{}).flatMap(([date,day])=>(day.entries||[]).map(e=>({...e,date}))); }
function entriesSince(days){ const start=new Date(); start.setDate(start.getDate()-days); const key=start.toISOString().slice(0,10); return allHistoryEntries().filter(e=>e.date>=key); }
function groupSetsSince(group, days=14){ return entriesSince(days).filter(e=>e.groupe===group).length; }
function groupLastAgo(group){
  const dates=allHistoryEntries().filter(e=>e.groupe===group).map(e=>e.date).sort();
  if(!dates.length) return 999;
  return Math.max(0,Math.round((new Date(todayKey()+'T00:00:00')-new Date(dates.at(-1)+'T00:00:00'))/86400000));
}
function machineHistoryScore(name){
  const rows=entriesForExercise(name);
  const last=lastEntryFor(name);
  const recent=rows.filter(e=>e.createdAt && (Date.now()-new Date(e.createdAt).getTime())<1000*60*60*24*45).length;
  return rows.length*3 + recent*2 + (last?5:0);
}
function templateWeightFor(name){
  const m=machineByName(name);
  const last=latestWorkoutEntriesFor(name);
  if(last.length) return Math.max(...last.map(e=>Number(e.poids)||0));
  return m?.poids?.[0] ?? 20;
}
function makeTplExercise(name, series=3, reps=10){ return {nom:name, series, reps, poids:templateWeightFor(name)}; }
function pickExercise({group=null, keywords=[], avoid=new Set(), preferHistory=true}={}){
  const ks=keywords.map(cleanText);
  let list=allMachines().filter(m=>(!group||m.groupe===group)&&!avoid.has(m.nom));
  if(ks.length) list=list.filter(m=>ks.some(k=>cleanText(m.nom).includes(k)));
  if(!list.length && group) list=allMachines().filter(m=>m.groupe===group&&!avoid.has(m.nom));
  if(!list.length) list=allMachines().filter(m=>!avoid.has(m.nom));
  list=list.slice().sort((a,b)=> preferHistory ? machineHistoryScore(b.nom)-machineHistoryScore(a.nom) : a.nom.localeCompare(b.nom));
  const chosen=list[0]; if(chosen) avoid.add(chosen.nom); return chosen?.nom || null;
}
function smartTemplateCatalog(){
  return [
    {kind:'balanced',title:'Équilibre 60 min',tag:'Complet',desc:'Séance équilibrée selon les groupes les moins travaillés récemment.',series:3,reps:10},
    {kind:'short',title:'Express 35 min',tag:'Rapide',desc:'Peu d’exercices, gros rendement, parfait quand tu as peu de temps.',series:3,reps:10},
    {kind:'force',title:'Force contrôlée',tag:'Lourd',desc:'Mouvements prioritaires, reps plus basses, repos intelligent plus long.',series:4,reps:6},
    {kind:'pump',title:'Congestion',tag:'Volume',desc:'Isolation, reps plus hautes, grosse sensation sans chercher le PR.',series:3,reps:12},
    {kind:'recovery',title:'Reprise propre',tag:'Fatigue',desc:'Groupes à relancer, volume modéré, idéal après pause ou fatigue.',series:2,reps:12},
    {kind:'pr',title:'PR Day intelligent',tag:'Performance',desc:'Exercices où ton historique indique une opportunité de progression.',series:3,reps:8}
  ];
}
function buildSmartTemplate(kind){
  const avoid=new Set(), groupsSorted=groups().filter(Boolean).sort((a,b)=>groupSetsSince(a,14)-groupSetsSince(b,14)||groupLastAgo(b)-groupLastAgo(a));
  let plan=smartTemplateCatalog().find(x=>x.kind===kind)||smartTemplateCatalog()[0], names=[];
  if(kind==='short'){
    ['Pectoraux','Dos','Jambes','Épaules'].forEach(g=>{ const n=pickExercise({group:g,avoid}); if(n) names.push(n); });
  } else if(kind==='force'){
    [
      ['Pectoraux',['press','developpe','couche']],['Dos',['tirage horizontal','rowing','tirage']],['Jambes',['presse','hack','squat']],['Épaules',['developpe','militaire']],['Biceps',['curl']],['Triceps',['extension','dips']]
    ].forEach(([g,k])=>{ const n=pickExercise({group:g,keywords:k,avoid}); if(n) names.push(n); });
  } else if(kind==='pump'){
    [
      ['Pectoraux',['fly','ecarte','pec']],['Épaules',['elevation','laterale','arriere']],['Biceps',['curl']],['Triceps',['extension','poulie']],['Jambes',['extension','curl','abduct','adduct']],['Dos',['pull','tirage']]
    ].forEach(([g,k])=>{ const n=pickExercise({group:g,keywords:k,avoid}); if(n) names.push(n); });
  } else if(kind==='recovery'){
    groupsSorted.slice(0,5).forEach(g=>{ const n=pickExercise({group:g,avoid}); if(n) names.push(n); });
  } else if(kind==='pr'){
    names=allMachines().map(m=>({name:m.nom,ai:progressionAIFor(m.nom),score:machineHistoryScore(m.nom)}))
      .filter(x=>['up','progress'].includes(x.ai.level)||x.score>10)
      .sort((a,b)=>(a.ai.level==='up'?-1:0)-(b.ai.level==='up'?-1:0)||b.score-a.score)
      .map(x=>x.name).filter(n=>!avoid.has(n)).slice(0,5);
    names.forEach(n=>avoid.add(n));
  } else {
    groupsSorted.slice(0,6).forEach(g=>{ const n=pickExercise({group:g,avoid}); if(n) names.push(n); });
  }
  while(names.length<4){ const n=pickExercise({avoid}); if(!n) break; names.push(n); }
  const exercises=names.slice(0,6).map(n=>makeTplExercise(n, plan.series, plan.reps));
  if(kind==='force') exercises.forEach(e=>{e.series=4;e.reps=6;});
  if(kind==='pump') exercises.forEach(e=>{e.series=3;e.reps=12;});
  if(kind==='recovery') exercises.forEach(e=>{e.series=2;e.reps=12;});
  if(kind==='pr') exercises.forEach(e=>{e.series=3;e.reps=8;});
  return {id:uid(), name:`${plan.title} · ${todayKey().slice(5)}`, smartKind:kind, createdAt:new Date().toISOString(), exercises};
}
function smartTemplatePreview(kind){
  const tpl=buildSmartTemplate(kind);
  return tpl.exercises.map(e=>`<div><b>${esc(e.nom)}</b><span>${e.series}×${e.reps} · ${esc(e.poids)} kg</span></div>`).join('');
}
function openSmartTemplateModal(){
  const cards=smartTemplateCatalog().map(p=>`<button class="smart-template-card ${smartTemplatePlan===p.kind?'is-active':''}" data-action="template-smart-pick" data-kind="${p.kind}"><span>${esc(p.tag)}</span><b>${esc(p.title)}</b><small>${esc(p.desc)}</small></button>`).join('');
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal smart-template-modal"><div class="between"><div><div class="eyebrow">Templates intelligents</div><h2>Choisis le plan</h2></div><button class="btn small secondary" data-action="modal-close">Fermer</button></div><div class="smart-template-grid">${cards}</div><section class="smart-template-preview"><h3>Aperçu généré</h3><div class="book-list">${smartTemplatePreview(smartTemplatePlan)}</div></section><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="template-smart-create" data-kind="${smartTemplatePlan}">Créer le template</button></div></div></div>`;
}
function createSmartTemplate(kind){
  const tpl=buildSmartTemplate(kind);
  if(!tpl.exercises.length) return toast('Impossible de générer un template','warn');
  state.templates.unshift(tpl);
  persist(); $('#modal-root').innerHTML=''; toast('Template intelligent créé','ok'); render();
}

function normalizeTpl(t){ return { id:t.id||uid(), name:t.name||t.nom||'Template', exercises:(t.exercises||t.exercices||[]).map(e=> typeof e==='string'?{nom:e}: {nom:e.nom, series:e.series||3, reps:e.reps||10, poids:e.poids}) }; }
function createTemplateModal(existingId=null){
  const existing=existingId ? normalizeTpl(state.templates.find(t=>t.id===existingId)||{}) : null;
  const selected=new Set((existing?.exercises||[]).map(e=>e.nom));
  const options=allMachines().map(m=>`<option value="${esc(m.nom)}" ${selected.has(m.nom)?'selected':''}>${m.icon||''} ${esc(m.nom)}</option>`).join('');
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${existing?'Modifier':'Nouveau'} template</h2><div class="field"><label>Nom</label><input id="tpl-name" value="${esc(existing?.name||'')}" placeholder="Push day"></div><div class="field"><label>Exercices</label><select id="tpl-exos" multiple size="10">${options}</select></div><p class="muted small-text">Ctrl/clic sur PC pour plusieurs choix. Sur mobile, sélectionne puis sauvegarde.</p><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="template-save" data-id="${existingId||''}">${existing?'Enregistrer':'Créer'}</button></div></div></div>`;
}
function saveTemplate(id=null){ const name=$('#tpl-name')?.value.trim(); const selected=$$('#tpl-exos option:checked').map(o=>o.value); if(!name || !selected.length) return toast('Nom + exercices obligatoires','warn'); const tpl={id:id||uid(),name,exercises:selected.map(n=>({nom:n,series:3,reps:10,poids:lastEntryFor(n)?.poids || machineByName(n)?.poids?.[0] || 20}))}; if(id){ state.templates=state.templates.map(t=>t.id===id?tpl:t); } else state.templates.push(tpl); persist(); $('#modal-root').innerHTML=''; toast('Template sauvegardé','ok'); render(); }
async function startFollowTemplate(id){ const t=normalizeTpl(state.templates.find(x=>x.id===id)||{}); if(!t.exercises?.length) return; if(state.session.entries.length && !await confirmModal('Charger ce template en mode suivi ? La séance en cours sera conservée.')) return; state.ui.followMode={id:t.id,name:t.name,exercises:t.exercises}; state.ui.followDrafts ||= {}; const first=t.exercises[0]; selectedMachineName=first.nom; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(selectedMachineName); formDraft=saved ? {...saved} : {poids:first.poids ?? last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:first.reps ?? last?.reps ?? 10, rm:''}; persist(); setRoute('session'); }

function machineModal(existingName=null){
  const m=existingName?machineByName(existingName):currentMachine(); const isCustom=!!state.customMachines.find(x=>x.nom===m?.nom);
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${existingName?'Modifier':'Ajouter'} un exercice</h2><div class="field"><label>Nom</label><input id="mach-name" value="${esc(existingName?m?.nom:'')}"></div><div class="field"><label>Groupe</label><select id="mach-group">${groups().map(g=>`<option value="${esc(g)}" ${m?.groupe===g?'selected':''}>${GROUP_ICONS[g]||''} ${esc(g)}</option>`).join('')}</select></div><div class="field"><label>Icône</label><input id="mach-icon" value="${esc(m?.icon||'')}"></div><div class="grid-2"><div class="field"><label>Poids par défaut</label><input id="mach-weight-default" type="number" step="0.5" value="${esc(m?.poids?.[0]||20)}"></div><div class="field"><label>Pas + / -</label><input id="mach-step" type="number" step="0.5" value="${esc(m?.step||0.5)}"></div></div><div class="field"><label>Vidéo URL ou ID YouTube</label><input id="mach-video" value="${esc(m?.video||'')}"></div><p class="muted small-text">Les exercices de base ne sont pas écrasés : si tu modifies un exercice de base, une version personnalisée sera créée avec le même nom.</p><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="machine-save" data-original="${esc(existingName||'')}">Sauvegarder</button></div></div></div>`;
}
function saveMachine(original=''){
  const nom=$('#mach-name').value.trim(); if(!nom) return toast('Nom obligatoire','warn');
  const defaultWeight=Number($('#mach-weight-default').value)||20;
  const step=Number($('#mach-step').value)||0.5;
  const item={nom,groupe:$('#mach-group').value,icon:$('#mach-icon').value.trim()||'',poids:[defaultWeight],step,video:$('#mach-video').value.trim()};
  const idx=state.customMachines.findIndex(x=>x.nom===(original||nom));
  if(idx>=0) state.customMachines[idx]=item; else state.customMachines.push(item);
  selectedMachineName=nom; formDraft={poids:lastEntryFor(nom)?.poids ?? item.poids[0], series:1, reps:lastEntryFor(nom)?.reps ?? 10, rm:''};
  persist(); $('#modal-root').innerHTML=''; toast('Exercice sauvegardé','ok'); render();
}
function editEntry(id){
  const e=state.session.entries.find(x=>x.id===id); if(!e) return;
  const m=machineByName(e.nom);
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>Modifier la série</h2><div class="item no-margin"><div class="item-title">${esc(e.nom)}</div><div class="meta">${esc(e.groupe||'')}</div></div><div class="grid-2"><div class="field"><label>Poids</label>${stepper('edit-poids', e.poids, Number(m?.step||0.5))}</div><div class="field"><label>Série</label>${stepper('edit-series', e.series, 1)}</div></div><div class="grid-2"><div class="field"><label>Reps</label>${stepper('edit-reps', e.reps, 1)}</div><div class="field"><label>1RM réel</label><input id="edit-rm" type="number" value="${esc(e.rm1reel||'')}" placeholder="optionnel"></div></div><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="entry-save-edit" data-id="${id}">Enregistrer</button></div></div></div>`;
}
function saveEntryEdit(id){
  const e=state.session.entries.find(x=>x.id===id); if(!e) return;
  e.poids=Number($('#edit-poids')?.value)||e.poids; e.series=Number($('#edit-series')?.value)||e.series; e.reps=Number($('#edit-reps')?.value)||e.reps; e.rm1reel=$('#edit-rm')?.value?Number($('#edit-rm').value):null; e.rm1est=oneRM(e.poids,e.reps);
  updateRecords(e); persist(); $('#modal-root').innerHTML=''; toast('Série modifiée','ok'); render();
}

function moveFollowExercise(from,to){
  const fm=state.ui.followMode;
  const list=fm?.exercises;
  if(!Array.isArray(list)) return;
  if(from<0||to<0||from>=list.length||to>=list.length||from===to) return;
  const [item]=list.splice(from,1);
  list.splice(to,0,item);
  persist(); render();
}
function moveFollowExerciseByName(name,dir){
  const list=state.ui.followMode?.exercises;
  if(!Array.isArray(list)) return;
  const i=list.findIndex(e=>e.nom===name);
  moveFollowExercise(i,i+dir);
}
function initFollowDrag(){
  const cards=$$('.follow-card[draggable="true"]');
  if(!cards.length) return;
  let from=-1;
  cards.forEach(card=>{
    card.addEventListener('dragstart',e=>{
      from=Number(card.dataset.followIndex);
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',String(from));
    });
    card.addEventListener('dragend',()=>card.classList.remove('is-dragging'));
    card.addEventListener('dragover',e=>{ e.preventDefault(); card.classList.add('is-drop-target'); });
    card.addEventListener('dragleave',()=>card.classList.remove('is-drop-target'));
    card.addEventListener('drop',e=>{
      e.preventDefault();
      card.classList.remove('is-drop-target');
      const to=Number(card.dataset.followIndex);
      if(Number.isFinite(from)&&Number.isFinite(to)) moveFollowExercise(from,to);
    });
  });
}
function initSwipeDelete(){
  $$('.entry-swipe').forEach(wrap=>{
    const card=wrap.querySelector('.entry-item');
    if(!card) return;
    let startX=0,startY=0,dx=0,dragging=false,locked=false;
    const reset=()=>{ dragging=false; locked=false; dx=0; wrap.classList.remove('is-swiping'); card.style.transition='transform .18s ease'; card.style.transform='translateX(0)'; };
    wrap.style.touchAction='pan-y';
    wrap.onpointerdown=e=>{
      if(e.target.closest('.entry-actions,a,input,select,textarea')) return;
      startX=e.clientX; startY=e.clientY; dx=0; dragging=true; locked=false;
      card.style.transition='none';
      try{ wrap.setPointerCapture(e.pointerId); }catch{}
    };
    wrap.onpointermove=e=>{
      if(!dragging) return;
      dx=e.clientX-startX;
      const dy=e.clientY-startY;
      if(!locked && Math.abs(dx)<8 && Math.abs(dy)<8) return;
      if(!locked){ locked=true; if(Math.abs(dy)>Math.abs(dx)){ reset(); return; } }
      if(dx<0){ e.preventDefault(); wrap.classList.add('is-swiping'); card.style.transform=`translateX(${Math.max(dx,-112)}px)`; }
      else{ wrap.classList.remove('is-swiping'); card.style.transform='translateX(0)'; }
    };
    wrap.onpointerup=e=>{
      if(!dragging) return;
      card.style.transition='transform .18s ease';
      try{ wrap.releasePointerCapture(e.pointerId); }catch{}
      if(dx<-86){
        const id=wrap.dataset.entryId;
        state.session.entries=state.session.entries.filter(x=>x.id!==id);
        persist(); render(); toast('Série supprimée','ok');
      } else reset();
    };
    wrap.onpointercancel=reset;
    wrap.onlostpointercapture=()=>{ if(dragging) reset(); };
  });
}

async function editRest(name){
  const current=state.timers?.[name] ?? '';
  const val=prompt(`Temps de repos manuel pour ${name} (secondes)
Laisse vide pour revenir au repos intelligent.`, current);
  if(val===null) return;
  if(String(val).trim()===''){ delete state.timers[name]; persist(); toast('Repos intelligent réactivé','ok'); render(); return; }
  const n=Number(val);
  if(!n || n<5) return toast('Temps invalide','warn');
  state.timers[name]=n;
  persist(); toast('Repos mémorisé','ok'); render();
}

function bindEvents(){ document.addEventListener('click', async e=>{
  if(e.target.classList?.contains('video-modal-backdrop')){ $('#modal-root').innerHTML=''; return; }
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
  if(action==='entry-save-edit') saveEntryEdit(el.dataset.id);
  if(action==='rest-edit') editRest(el.dataset.name);
  if(action==='entry-delete'){ state.session.entries=state.session.entries.filter(x=>x.id!==el.dataset.id); persist(); render(); }
  if(action==='cardio-delete'){ state.session.cardio=state.session.cardio.filter(x=>x.id!==el.dataset.id); persist(); render(); }
  if(action==='session-save') saveSession();
  if(action==='session-clear' && await confirmModal('Effacer la séance en cours ?')){ state.session={entries:[],cardio:[]}; state.ui.followMode=null; formDraft.series=1; persist(); render(); }
  if(action==='day-delete' && await confirmModal('Supprimer cette journée ?')){ delete state.history[el.dataset.date]; persist(); render(); }
  if(action==='template-new') createTemplateModal();
  if(action==='template-smart-open') openSmartTemplateModal();
  if(action==='template-smart-pick'){ smartTemplatePlan=el.dataset.kind||'balanced'; openSmartTemplateModal(); }
  if(action==='template-smart-create') createSmartTemplate(el.dataset.kind||smartTemplatePlan);
  if(action==='template-edit') createTemplateModal(el.dataset.id);
  if(action==='template-save') saveTemplate(el.dataset.id || null);
  if(action==='template-follow') startFollowTemplate(el.dataset.id);
  if(action==='template-delete' && await confirmModal('Supprimer ce template ?')){ state.templates=state.templates.filter(t=>t.id!==el.dataset.id); persist(); render(); }
  if(action==='follow-pick'){ captureForm(); rememberFollowDraft(selectedMachineName); selectedMachineName=el.dataset.name; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(selectedMachineName); const target=state.ui.followMode?.exercises?.find(x=>x.nom===selectedMachineName); const done=(state.session.entries||[]).filter(x=>x.nom===selectedMachineName).length; formDraft=saved ? {...saved} : {poids:target?.poids ?? last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:Math.min(done+1,99), reps:target?.reps ?? last?.reps ?? 10, rm:''}; persist(); render(); }
  if(action==='follow-up') moveFollowExerciseByName(el.dataset.name,-1);
  if(action==='follow-down') moveFollowExerciseByName(el.dataset.name,1);
  if(action==='follow-stop'){ state.ui.followMode=null; persist(); render(); }
  if(action==='exercise-open'){ exerciseBookTab='analyse'; openExerciseBook(el.dataset.name || $('#machine-select')?.value || selectedMachineName); }
  if(action==='exercise-back'){ setRoute('session'); }
  if(action==='book-close'){ $('#modal-root').innerHTML=''; }
  if(action==='exercise-book-tab'){ exerciseBookTab=el.dataset.tab||'analyse'; openExerciseBook(exerciseDetailName); }
  if(action==='body-focus') openBodyFocus(el.dataset.groups||'', el.dataset.label||'');
  if(action==='body-side'){ bodyMapSide=el.dataset.side||'front'; render(); }
  if(action==='body-start-exercise') bodyStartExercise(el.dataset.name||'');
  if(action==='machine-new') machineModal(null);
  if(action==='video-open') openVideoModal(el.dataset.name ? machineByName(el.dataset.name) : currentMachine());
  if(action==='video-external'){ const url=el.dataset.url; if(url) window.open(url,'_blank','noopener'); }
  if(action==='machine-edit') machineModal($('#machine-select')?.value);
  if(action==='machine-save') saveMachine(el.dataset.original||'');
  if(action==='modal-close') $('#modal-root').innerHTML='';
  if(action==='stats-mode'){ statsMode=el.dataset.mode; render(); }
  if(action==='stats-range'){ statsRange=el.dataset.range; render(); }
  if(action==='exercise-metric'){ exerciseMetric=el.dataset.metric; render(); }
  if(action==='exercise-range'){ exerciseRange=el.dataset.range; render(); }
  if(action==='bodyweight-add'){ const v=Number($('#body-weight')?.value); if(!v) return toast('Poids invalide','warn'); state.bodyWeight.push({date:todayKey(),weight:v,createdAt:new Date().toISOString()}); persist(); toast('Poids ajouté','ok'); render(); }
  if(action==='settings-save'){ state.settings.userName=$('#setting-name').value.trim()||'Kevin'; state.settings.timerDefault=Number($('#setting-timer').value)||60; persist(); toast('Réglages sauvegardés','ok'); render(); }
  if(action==='export-json') downloadText(`gymlog-backup-${todayKey()}.json`, exportState(state));
  if(action==='reset-all' && await confirmModal('Tout supprimer définitivement ?')){ resetAll(); state=loadState(); setTheme('dark'); setRoute('home'); toast('Application réinitialisée','ok'); }
 });
 $('#theme-toggle').addEventListener('click',()=>setTheme(state.settings.theme==='light'?'dark':'light'));
 document.addEventListener('input', e=>{ if(['poids','series','reps','real-rm'].includes(e.target.id)) captureForm(); });
 document.addEventListener('change', async e=>{ if(e.target.id==='import-json'){ const file=e.target.files[0]; if(!file) return; try{ state=importState(await file.text()); state.customMachines ||= []; state.ui ||= {entryOpen:{},followMode:null}; setTheme(state.settings.theme); toast('Import réussi','ok'); setRoute('home'); }catch(err){ toast('Import impossible : '+err.message,'warn'); } } });
 document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('#modal-root .video-modal-backdrop')) $('#modal-root').innerHTML=''; });
}

setTheme(state.settings.theme || 'dark');
initTimer(()=>state.settings.timerDefault||60);
bindEvents();
render();
