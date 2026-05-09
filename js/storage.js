const KEY = 'gl_app_v3';
const OLD_KEYS = ['gl_history','gl_session','gl_cardio','gl_templates','gl_timer_dur','gl_exo_timers','gl_max_weights'];

export const defaultState = () => ({
  version: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: { theme: localStorage.getItem('gl_theme') || 'dark', timerDefault: Number(localStorage.getItem('gl_timer_dur') || 60), userName: 'Kevin' },
  session: { entries: [], cardio: [] },
  history: {},
  templates: [],
  records: {},
  timers: {},
  customMachines: [],
  ui: { entryOpen: {}, followMode: null },
});

function safeJSON(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function normalizeDay(day){ if(Array.isArray(day)) return { entries: day, cardio: [] }; return { entries: Array.isArray(day?.entries)?day.entries:[], cardio: Array.isArray(day?.cardio)?day.cardio:[] }; }
export function todayKey(){ return new Date().toISOString().slice(0,10); }

function migrateOld(){
  const s = defaultState();
  const oldHistory = safeJSON('gl_history', null);
  if(oldHistory && typeof oldHistory === 'object') Object.entries(oldHistory).forEach(([k,v]) => s.history[k] = normalizeDay(v));
  const oldCardio = safeJSON('gl_cardio', {});
  if(oldCardio && typeof oldCardio === 'object') Object.entries(oldCardio).forEach(([k,v]) => { s.history[k] = normalizeDay(s.history[k]); s.history[k].cardio = Array.isArray(v) ? v : []; });
  const oldSession = safeJSON('gl_session', []);
  s.session.entries = Array.isArray(oldSession) ? oldSession : [];
  s.templates = safeJSON('gl_templates', []);
  s.timers = safeJSON('gl_exo_timers', {});
  s.records = safeJSON('gl_max_weights', {});
  s.customMachines = [];
  s.ui = { entryOpen: {}, followMode: null };
  return s;
}

export function loadState(){
  const existing = safeJSON(KEY, null);
  if(existing?.version === 3) return existing;
  const migrated = migrateOld();
  saveState(migrated);
  return migrated;
}
export function saveState(state){ state.updatedAt = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(state)); }
export function exportState(state){ return JSON.stringify({...state, exportedAt:new Date().toISOString()}, null, 2); }
export function importState(raw){ const data = JSON.parse(raw); if(!data || typeof data !== 'object') throw new Error('Fichier invalide'); const next = defaultState(); Object.assign(next, data, {version:3}); next.session = { entries: Array.isArray(data.session?.entries)?data.session.entries:[], cardio: Array.isArray(data.session?.cardio)?data.session.cardio:[] }; next.history = {}; Object.entries(data.history || {}).forEach(([k,v]) => next.history[k] = normalizeDay(v)); next.templates = Array.isArray(data.templates)?data.templates:[]; next.settings = {...next.settings, ...(data.settings||{})}; next.records = data.records || {}; next.timers = data.timers || {}; next.customMachines = Array.isArray(data.customMachines)?data.customMachines:[]; next.ui = { entryOpen: {}, followMode: null }; saveState(next); return next; }
export function resetAll(){ localStorage.removeItem(KEY); OLD_KEYS.forEach(k=>localStorage.removeItem(k)); }
