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
    <section><div class="section-title"><h2>Templates</h2><button class="btn small" data-action="template-new">+ Créer</button></div>${templateList()}</section>
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
  const recordPossible=best&&Number(formDraft.reps)>=best, rest=getTimerFor(name);
  if(!entries.length&&!state.ui.followMode) return `<section class="premium-focus empty"><div class="focus-head"><span class="focus-icon">${icon('strength')}</span><div><b>Prêt</b><span>${goal?`Objectif : ${goal.main}`:'Choisis un exercice et lance ta première série.'}</span></div></div></section>`;
  return `<section class="premium-focus"><button class="focus-arrow icon-only" data-action="exercise-open" data-name="${esc(name||'')}" title="Ouvrir la fiche">${icon('chevron')}</button><div class="focus-head"><span class="focus-icon">${icon('strength')}</span><div><h2>${esc(name||'Exercice')}</h2><p>${goal?esc(goal.main):'Objectif : démarre proprement'}</p></div></div><div class="focus-pills"><span>${icon('clock')}${mins||'—'} min</span><span>${icon('clock')}Repos ${rest}s</span><span>${recordPossible?'Record possible':ai?.signal||'Stable'}</span></div></section>`;
}
function muscuView(){
  const m=defaultMachine(); selectedMachineName=m?.nom||selectedMachineName;
  const last=m?lastEntryFor(m.nom):null, followDraft=m?getFollowDraft(m.nom):null;
  const activeFollowDraft=state.ui.followMode?followDraft:null, preferredWeight=m?preferredWeightForExercise(m.nom):null;
  const poids=formDraft.poids??activeFollowDraft?.poids??preferredWeight??last?.poids??m?.poids?.[0]??20;
  const series=formDraft.series??activeFollowDraft?.series??1, reps=formDraft.reps??activeFollowDraft?.reps??last?.reps??10;
  const rm=formDraft.rm??activeFollowDraft?.rm??'';
  return `<div class="premium-session">${liveDashboard()}<section class="card premium-form"><div class="field"><label>Groupe musculaire</label><div class="chips">${[''].concat(groups()).map(g=>`<button class="chip ${groupFilter===g?'is-active':''}" data-group="${esc(g)}">${g?esc(g):'Tout'}</button>`).join('')}</div></div>
  <div class="field"><label>Exercice</label><div class="select-row premium-select"><select id="machine-select">${filteredMachines().map(x=>`<option value="${esc(x.nom)}" ${x.nom===m?.nom?'selected':''}>${esc(x.nom)}</option>`).join('')}</select><button class="btn small icon-only" data-action="exercise-open" title="Fiche exercice">${icon('book')}</button><button class="btn small icon-only" data-action="video-open" title="Vidéo">${icon('video')}</button><button class="btn small icon-only" data-action="machine-edit" title="Modifier">${icon('edit')}</button><button class="btn small icon-only" data-action="machine-new" title="Ajouter">${icon('plus')}</button></div></div>
  <div id="machine-hint" class="exercise-insights premium-insights"></div>
  <div class="quick-title">Saisie rapide</div><div class="grid-2"><div class="field"><label>Poids</label>${stepper('poids', poids, Number(m?.step||0.5))}</div><div class="field"><label>Série actuelle</label>${stepper('series', series, 1)}</div></div>
  <div class="grid-2"><div class="field"><label>Reps</label>${stepper('reps', reps, 1)}</div><div class="field"><label>1RM réel optionnel</label><input id="real-rm" type="number" min="0" value="${esc(rm||'')}" placeholder="ex: 120"></div></div>
  <button class="btn primary full premium-add" data-action="entry-add">+ Ajouter la série / exercice</button></section>
  <section class="premium-current"><div class="section-title"><h2>Séance en cours</h2><button class="btn small danger" data-action="session-clear">Effacer</button></div>${followPanel()}${currentSessionList()}<button class="btn primary full save-session" data-action="session-save">Sauvegarder la séance</button></section></div>`;
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
    return `<div class="follow-card ${active?'is-active':''}" draggable="true" data-follow-index="${i}" data-follow-name="${esc(e.nom)}"><button class="follow-main" data-action="follow-pick" data-name="${esc(e.nom)}"><span class="follow-index">${done?'✓':i+1}</span><span><b>${esc(e.nom)}</b><small>${done} série(s) faite(s)</small></span></button><div class="follow-move"><button type="button" data-action="follow-up" data-name="${esc(e.nom)}" title="Monter">↑</button><button type="button" data-action="follow-down" data-name="${esc(e.nom)}" title="Descendre">↓</button></div></div>`;
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
  return `<div class="entry-swipe ${isPR?'has-pr':''}" data-entry-id="${e.id}"><div class="swipe-delete-bg">Supprimer</div><div class="item entry-item"><button class="entry-head" data-action="entry-toggle" data-id="${e.id}"><div><div class="item-title">${esc(e.nom)}</div><div class="meta">${esc(e.groupe||'')} · série ${e.series} · ${e.reps} reps · ${e.poids} kg</div>${prLine}</div><span class="entry-badges">${prBadge}<span class="badge blue">1RM ${rm}</span></span><span class="chev">${open?'⌄':'›'}</span></button><div class="entry-body ${open?'':'hidden'}"><div class="entry-actions"><button class="btn small icon-text" data-action="exercise-open" data-name="${esc(e.nom)}">${icon('book')} Fiche</button><button class="btn small icon-text" data-action="entry-edit" data-id="${e.id}">${icon('edit')} Modifier</button><button class="btn small ok" data-action="rest-edit" data-name="${esc(e.nom)}">Repos</button><button class="btn small danger icon-text" data-action="entry-delete" data-id="${e.id}">${icon('delete')} Suppr.</button></div></div></div></div>`;
}

function cardioForm(){ return `<section class="card"><div class="field"><label>Type cardio</label><div class="chips">${['marche','course','velo','escalier'].map(t=>`<button class="chip ${cardioType===t?'is-active':''}" data-cardio-type="${t}">${t}</button>`).join('')}</div></div><div class="grid-3"><div class="field"><label>Durée</label>${stepper('c-duration',20,5)}</div><div class="field"><label>${cardioType==='velo'?'Résistance':cardioType==='escalier'?'Étages':'Vitesse'}</label>${stepper('c-main', cardioType==='velo'?5:cardioType==='escalier'?20:6, cardioType==='velo'||cardioType==='escalier'?1:0.5)}</div><div class="field"><label>${cardioType==='velo'?'RPM':cardioType==='escalier'?'Intensité':'Pente %'}</label>${stepper('c-extra', cardioType==='velo'?80:0, cardioType==='velo'?5:1)}</div></div><button class="btn primary full" data-action="cardio-add">✓ Ajouter cardio</button></section><section><div class="section-title"><h2>Séance en cours</h2></div>${currentSessionList()}</section>`; }
function cardioIcon(t){ return ''; }
function cardioItem(c){ return `<div class="item between"><div><div class="item-title">${esc(c.type)}</div><div class="meta">${c.duration} min · ${esc(c.label||'')}</div></div><button class="btn small danger" data-action="cardio-delete" data-id="${c.id}">✕</button></div>`; }
function historyView(){ const days=Object.entries(state.history||{}).sort(([a],[b])=>b.localeCompare(a)); return days.length ? `<div class="list">${days.map(([d,v])=>dayCard(d,v,true)).join('')}</div>` : `<div class="empty">Pas encore d’historique.</div>`; }
function dayCard(date, day, deletable){ const entries=day.entries||[], cardio=day.cardio||[]; const vol=entries.reduce((s,e)=>s+volume(e),0); return `<article class="item"><div class="between"><div><div class="item-title">${fmtDateLong(date)}</div><div class="meta">${entries.length} exercice(s) · ${cardio.length} cardio · ${Math.round(vol)} kg</div></div>${deletable?`<button class="btn small danger" data-action="day-delete" data-date="${date}">Suppr.</button>`:''}</div><div class="list day-mini">${entries.slice(0,8).map(e=>`<div class="between"><span class="small-text">${esc(e.nom)}</span><span class="badge ac">${e.series}×${e.reps} · ${e.poids}kg</span></div>`).join('')}${cardio.map(c=>`<div class="between"><span class="small-text">${esc(c.type)}</span><span class="badge purple">${c.duration}min</span></div>`).join('')}</div></article>`; }


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
function bodyZoneStats(){
  const zones=[
    {id:'chest',label:'Pectoraux',groups:['Pectoraux']},
    {id:'back',label:'Dos',groups:['Dos']},
    {id:'shoulders',label:'Épaules',groups:['Épaules']},
    {id:'arms',label:'Bras',groups:['Biceps','Triceps','Avant-bras'].filter(g=>groups().includes(g))},
    {id:'core',label:'Core',groups:['Abdos','Gainage'].filter(g=>groups().includes(g))},
    {id:'legs',label:'Jambes',groups:['Jambes']}
  ].filter(z=>z.groups.length);
  const toneRank={danger:5,late:4,ready:3,loaded:2,hot:1,empty:0};
  return zones.map(z=>{
    const stats=z.groups.map(g=>muscleStats(g,30));
    const worst=stats.slice().sort((a,b)=>toneRank[b.tone]-toneRank[a.tone])[0]||stats[0];
    const sets=stats.reduce((s,x)=>s+x.sets,0), vol=stats.reduce((s,x)=>s+x.vol,0);
    const ago=Math.min(...stats.map(x=>x.ago??999));
    return {...z,stats,worst,sets,vol,ago:ago===999?null:ago};
  });
}
function humanZoneClass(z){ return `human-zone tone-${z?.worst?.tone||'empty'}`; }
function bodyHumanSvg(zones){
  const byId=Object.fromEntries(zones.map(z=>[z.id,z]));
  const attrs=id=>`class="${humanZoneClass(byId[id])}" data-action="body-focus" data-groups="${esc((byId[id]?.groups||[]).join('|'))}" role="button" tabindex="0"`;
  const label=id=>esc(byId[id]?.label||'');
  return `<svg class="body-human-svg" viewBox="0 0 320 430" aria-label="Carte musculaire interactive">
    <defs>
      <filter id="humanGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="bodyBase" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.16)"/><stop offset="1" stop-color="rgba(255,255,255,.035)"/></linearGradient>
    </defs>
    <text class="human-caption" x="88" y="24" text-anchor="middle">Face</text>
    <text class="human-caption" x="232" y="24" text-anchor="middle">Dos</text>

    <g class="human-base front" aria-hidden="true">
      <circle cx="88" cy="52" r="22"/>
      <path d="M72 80 Q88 90 104 80 L116 112 Q124 158 117 202 Q111 238 104 286 L100 382 Q98 404 84 404 Q76 404 76 381 L74 295 Q72 274 68 274 Q64 274 62 295 L60 381 Q60 404 48 404 Q35 404 36 382 L42 286 Q36 238 29 202 Q22 158 30 112 Z"/>
      <path d="M30 113 Q11 148 14 201 Q16 244 28 244 Q39 244 35 202 Q33 161 51 126 Z"/>
      <path d="M116 113 Q135 148 132 201 Q130 244 118 244 Q107 244 111 202 Q113 161 95 126 Z"/>
    </g>

    <g class="human-base back" aria-hidden="true">
      <circle cx="232" cy="52" r="22"/>
      <path d="M216 80 Q232 90 248 80 L262 112 Q270 158 263 202 Q255 238 248 286 L244 382 Q242 404 228 404 Q220 404 220 381 L218 295 Q216 274 212 274 Q208 274 206 295 L204 381 Q204 404 192 404 Q179 404 180 382 L186 286 Q178 238 171 202 Q164 158 172 112 Z"/>
      <path d="M172 113 Q153 148 156 201 Q158 244 170 244 Q181 244 177 202 Q175 161 193 126 Z"/>
      <path d="M262 113 Q281 148 278 201 Q276 244 264 244 Q253 244 257 202 Q259 161 241 126 Z"/>
    </g>

    <g ${attrs('shoulders')} aria-label="${label('shoulders')}"><path d="M30 112 Q50 86 72 91 L67 122 Q47 119 30 136 Z"/><path d="M104 91 Q126 86 146 112 L146 136 Q129 119 109 122 Z"/><path d="M174 112 Q194 86 216 91 L211 122 Q191 119 174 136 Z"/><path d="M248 91 Q270 86 290 112 L290 136 Q273 119 253 122 Z"/><title>${label('shoulders')}</title></g>
    <g ${attrs('chest')} aria-label="${label('chest')}"><path d="M52 118 Q70 105 86 122 L86 166 Q61 162 45 145 Z"/><path d="M90 122 Q106 105 124 118 L131 145 Q115 162 90 166 Z"/><title>${label('chest')}</title></g>
    <g ${attrs('back')} aria-label="${label('back')}"><path d="M194 112 Q232 92 270 112 Q261 174 246 218 Q232 230 218 218 Q203 174 194 112 Z"/><path d="M207 122 Q232 139 257 122" class="human-line"/><path d="M216 206 Q232 184 248 206" class="human-line"/><title>${label('back')}</title></g>
    <g ${attrs('arms')} aria-label="${label('arms')}"><path d="M25 139 Q11 170 17 231 Q21 253 31 246 Q37 240 34 213 Q30 175 45 145 Z"/><path d="M131 139 Q145 170 139 231 Q135 253 125 246 Q119 240 122 213 Q126 175 111 145 Z"/><path d="M169 139 Q155 170 161 231 Q165 253 175 246 Q181 240 178 213 Q174 175 189 145 Z"/><path d="M275 139 Q289 170 283 231 Q279 253 269 246 Q263 240 266 213 Q270 175 255 145 Z"/><title>${label('arms')}</title></g>
    <g ${attrs('core')} aria-label="${label('core')}"><path d="M61 172 Q88 184 115 172 L109 245 Q88 258 67 245 Z"/><path d="M74 188 H102 M72 211 H104 M70 234 H106" class="human-line"/><title>${label('core')}</title></g>
    <g ${attrs('legs')} aria-label="${label('legs')}"><path d="M48 265 Q68 252 78 274 L76 383 Q69 401 58 388 L56 303 Q55 285 48 265 Z"/><path d="M98 265 Q78 252 68 274 L70 383 Q77 401 88 388 L90 303 Q91 285 98 265 Z"/><path d="M192 265 Q212 252 222 274 L220 383 Q213 401 202 388 L200 303 Q199 285 192 265 Z"/><path d="M242 265 Q222 252 212 274 L214 383 Q221 401 232 388 L234 303 Q235 285 242 265 Z"/><title>${label('legs')}</title></g>
  </svg>`;
}
function renderBodyMap(){
  const zones=bodyZoneStats();
  const late=zones.filter(z=>['danger','late'].includes(z.worst?.tone));
  const hot=zones.filter(z=>['hot','loaded'].includes(z.worst?.tone));
  const headline=late[0]?`${late[0].label} à relancer`:hot[0]?`${hot[0].label} déjà chargé`:'Répartition correcte';
  const rows=zones.map(z=>`<button class="body-row ${z.worst?.tone||'empty'}" data-action="body-focus" data-groups="${esc(z.groups.join('|'))}"><span>${esc(z.label)}</span><b>${esc(z.worst?.status||'—')}</b><small>${z.sets} série(s) · ${z.ago===null?'jamais':`J-${z.ago}`}</small></button>`).join('');
  return `<section class="bodymap-card human-card card"><div class="section-title no-margin"><div><div class="eyebrow">Vue corps humain</div><h2>Récupération musculaire</h2></div><span class="body-score">${esc(headline)}</span></div><div class="bodymap-layout human-layout"><div class="body-figure human-figure">${bodyHumanSvg(zones)}</div><div class="body-list">${rows}</div></div><p class="muted small-text body-help">Clique directement une zone du corps. Néon = prêt, orange = chargé, rouge = en retard.</p></section>`;
}
function openBodyFocus(groupsStr=''){
  const selected=String(groupsStr).split('|').filter(Boolean);
  const stats=selected.map(g=>muscleStats(g,30));
  const title=selected.join(' / ')||'Groupe musculaire';
  const totalSets=stats.reduce((s,x)=>s+x.sets,0), totalVol=Math.round(stats.reduce((s,x)=>s+x.vol,0));
  const main=stats.slice().sort((a,b)=>(b.ago??999)-(a.ago??999))[0]||stats[0];
  const exercises=[...new Set(datedWorkoutRows().filter(e=>selected.includes(e.groupe)).map(e=>e.nom))].slice(0,7);
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal body-modal"><div class="between"><div><div class="eyebrow">Focus musculaire</div><h2>${esc(title)}</h2></div><button class="btn small secondary" data-action="modal-close">Fermer</button></div><div class="body-focus-grid"><div><span>Statut</span><b>${esc(main?.status||'À construire')}</b></div><div><span>Séries 30j</span><b>${totalSets}</b></div><div><span>Volume 30j</span><b>${totalVol} kg</b></div><div><span>Dernier travail</span><b>${main?.ago===null?'—':`J-${main.ago}`}</b></div></div><section class="book-section"><h3>Conseil coach</h3><p>${esc(main?.advice||'Construis un peu plus d’historique pour lire ce groupe.')}</p></section><section class="book-section"><h3>Exercices liés</h3>${exercises.length?`<div class="body-exos">${exercises.map(n=>`<button data-action="exercise-open" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>`:'<p class="muted">Aucun exercice enregistré récemment.</p>'}</section></div></div>`;
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
function settingsView(){ return `<div class="grid"><section class="card"><div class="field"><label>Prénom</label><input id="setting-name" value="${esc(state.settings.userName||'Kevin')}"></div><div class="field"><label>Timer repos par défaut</label><input id="setting-timer" type="number" min="15" step="5" value="${Number(state.settings.timerDefault||60)}"></div><button class="btn primary full" data-action="settings-save">Sauvegarder</button></section><section class="card"><div class="section-title no-margin"><h2>Données</h2></div><button class="btn full" data-action="export-json">Exporter JSON</button><label class="btn full import-label">Importer JSON<input id="import-json" type="file" accept="application/json"></label></section><section class="card danger-zone"><div class="section-title no-margin"><h2>Danger</h2></div><button class="btn danger full" data-action="reset-all">Tout réinitialiser</button></section></div>`; }

function render(){ $('#today-label').textContent=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); $('#page-title').textContent=titles[route]||'GymLog'; view.innerHTML = ({home,session:sessionView,history:historyView,stats:statsView,settings:settingsView,exercise:exerciseDetailView}[route]||home)(); afterRender(); }
function afterRender(){ const select=$('#machine-select'); if(select){ select.addEventListener('change', () => { captureForm(); rememberFollowDraft(selectedMachineName); selectedMachineName=select.value; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(select.value); const m=machineByName(select.value); formDraft=saved ? {...saved} : {poids:last?.poids ?? m?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; render(); }); updateMachineHint(); } const se=$('#stats-exercise'); if(se) se.addEventListener('change',()=>{selectedMachineName=se.value; render();}); const sm=$('#stats-metric'); if(sm) sm.addEventListener('change',()=>{statsMetric=sm.value; render();}); initSwipeDelete(); initFollowDrag(); }
function videoUrl(m){ if(!m?.video) return ''; return m.video.startsWith('http') ? m.video : 'https://youtube.com/watch?v='+m.video; }
function updateMachineHint(){
  const m=currentMachine(), el=$('#machine-hint'); if(!el) return; if(!m){el.innerHTML=''; return;}
  const currentWeight=Number($('#poids')?.value??formDraft.poids??0), rows=entriesForExercise(m.nom), last=lastEntryFor(m.nom), maxReps=maxRepsForWeight(m.nom,currentWeight), ai=progressionAIFor(m.nom);
  if(!rows.length){ el.innerHTML=`<div class="premium-goal"><span> Objectif conseillé</span><b>Démarre proprement</b><em>Aucun historique pour cet exercice.</em></div>`; return; }
  el.innerHTML=`<div class="premium-goal ${ai.level}"><span>${icon('target')} ${ai.level==='up'?'Montée possible':'Objectif conseillé'}</span><b>${esc(ai.optionA||'Objectif propre')}</b><em>${esc(ai.text||'')}</em></div><div class="insight-card"><span>Dernière fois</span><b>${last?`${last.poids} kg × ${last.reps}`:'—'}</b></div><div class="insight-card"><span>Max à ${currentWeight||'—'} kg</span><b>${maxReps?`${maxReps} reps`:'—'}</b></div><button class="analysis-link" data-action="exercise-open" data-name="${esc(m.nom)}">${icon('book')} Voir analyse complète</button>`;
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
  state.session.entries.unshift(entry); updateRecords(entry);
  formDraft.series = Math.min((formDraft.series||1)+1, 99); formDraft.rm='';
  rememberFollowDraft(m.nom);
  persist();
  if(entry.prType) toast(`NEW PR — ${prLabelFor(entry)}`, 'ok');
  else toast('Série ajoutée','ok');
  render();
  startTimer(getTimerFor(m.nom), m.nom);
  if(entry.prType) celebratePR(entry);
}
function addCardio(){ const duration=Number($('#c-duration')?.value)||0; const main=Number($('#c-main')?.value)||0; const extra=Number($('#c-extra')?.value)||0; const label = cardioType==='velo' ? `rés. ${main} · ${extra} rpm` : cardioType==='escalier' ? `${main} étages` : `${main} km/h · pente ${extra}%`; state.session.cardio.unshift({id:uid(),type:cardioType,duration,main,extra,label,createdAt:new Date().toISOString()}); persist(); toast('Cardio ajouté','ok'); render(); }
async function saveSession(){ if(!state.session.entries.length && !state.session.cardio.length) return toast('Séance vide','warn'); const day=todayKey(); const prev=state.history[day] || {entries:[],cardio:[]}; state.history[day]={entries:[...state.session.entries,...(prev.entries||[])], cardio:[...state.session.cardio,...(prev.cardio||[])]}; state.session={entries:[],cardio:[]}; state.ui.followMode=null; formDraft.series=1; persist(); toast('Séance sauvegardée','ok'); setRoute('history'); }

function normalizeTpl(t){ return { id:t.id||uid(), name:t.name||t.nom||'Template', exercises:(t.exercises||t.exercices||[]).map(e=> typeof e==='string'?{nom:e}: {nom:e.nom, series:e.series||3, reps:e.reps||10, poids:e.poids}) }; }
function createTemplateModal(existingId=null){
  const existing=existingId ? normalizeTpl(state.templates.find(t=>t.id===existingId)||{}) : null;
  const selected=new Set((existing?.exercises||[]).map(e=>e.nom));
  const options=allMachines().map(m=>`<option value="${esc(m.nom)}" ${selected.has(m.nom)?'selected':''}>${m.icon||''} ${esc(m.nom)}</option>`).join('');
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><div class="modal"><h2>${existing?'Modifier':'Nouveau'} template</h2><div class="field"><label>Nom</label><input id="tpl-name" value="${esc(existing?.name||'')}" placeholder="Push day"></div><div class="field"><label>Exercices</label><select id="tpl-exos" multiple size="10">${options}</select></div><p class="muted small-text">Ctrl/clic sur PC pour plusieurs choix. Sur mobile, sélectionne puis sauvegarde.</p><div class="modal-actions"><button class="btn secondary" data-action="modal-close">Annuler</button><button class="btn primary" data-action="template-save" data-id="${existingId||''}">${existing?'Enregistrer':'Créer'}</button></div></div></div>`;
}
function saveTemplate(id=null){ const name=$('#tpl-name')?.value.trim(); const selected=$$('#tpl-exos option:checked').map(o=>o.value); if(!name || !selected.length) return toast('Nom + exercices obligatoires','warn'); const tpl={id:id||uid(),name,exercises:selected.map(n=>({nom:n,series:3,reps:10,poids:lastEntryFor(n)?.poids || machineByName(n)?.poids?.[0] || 20}))}; if(id){ state.templates=state.templates.map(t=>t.id===id?tpl:t); } else state.templates.push(tpl); persist(); $('#modal-root').innerHTML=''; toast('Template sauvegardé','ok'); render(); }
async function startFollowTemplate(id){ const t=normalizeTpl(state.templates.find(x=>x.id===id)||{}); if(!t.exercises?.length) return; if(state.session.entries.length && !await confirmModal('Charger ce template en mode suivi ? La séance en cours sera conservée.')) return; state.ui.followMode={id:t.id,name:t.name,exercises:t.exercises}; state.ui.followDrafts ||= {}; selectedMachineName=t.exercises[0].nom; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(selectedMachineName); formDraft=saved ? {...saved} : {poids:last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; persist(); setRoute('session'); }

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
  if(action==='follow-pick'){ captureForm(); rememberFollowDraft(selectedMachineName); selectedMachineName=el.dataset.name; const saved=getFollowDraft(selectedMachineName); const last=lastEntryFor(selectedMachineName); formDraft=saved ? {...saved} : {poids:last?.poids ?? machineByName(selectedMachineName)?.poids?.[0] ?? 20, series:1, reps:last?.reps ?? 10, rm:''}; persist(); render(); }
  if(action==='follow-up') moveFollowExerciseByName(el.dataset.name,-1);
  if(action==='follow-down') moveFollowExerciseByName(el.dataset.name,1);
  if(action==='follow-stop'){ state.ui.followMode=null; persist(); render(); }
  if(action==='exercise-open'){ exerciseBookTab='analyse'; openExerciseBook(el.dataset.name || $('#machine-select')?.value || selectedMachineName); }
  if(action==='exercise-back'){ setRoute('session'); }
  if(action==='book-close'){ $('#modal-root').innerHTML=''; }
  if(action==='exercise-book-tab'){ exerciseBookTab=el.dataset.tab||'analyse'; openExerciseBook(exerciseDetailName); }
  if(action==='body-focus') openBodyFocus(el.dataset.groups||'');
  if(action==='machine-new') machineModal(null);
  if(action==='video-open'){ const url=videoUrl(currentMachine()); url ? window.open(url,'_blank') : toast('Aucune vidéo pour cet exercice','warn'); }
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
}

setTheme(state.settings.theme || 'dark');
initTimer(()=>state.settings.timerDefault||60);
bindEvents();
render();
