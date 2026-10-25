// Start, Anmeldung, Navigation, Rendering und Ereignisse.
import { createStore } from './store.js';
import { S, setStore, setRender, setData, applyRemote } from './state.js';
import { $, icon, toast } from './util.js';
import { wakeState, wakeOn, wakeOff, wakeWanted, onWakeChange, renderTimers } from './wake.js';
import * as recipes from './views/recipes.js';
import * as menus from './views/menus.js';
import * as shopping from './views/shopping.js';
import * as cook from './views/cook.js';
import * as account from './views/account.js';
import { viewHome } from './views/home.js';

const MODULES = [recipes, menus, shopping, cook, account];
const merge = (k) => Object.assign({}, ...MODULES.map((m) => m[k] || {}));
const ACTIONS = merge('actions');
const ARMED = merge('armedActions');
const CHANGES = merge('changes');
const INPUTS = merge('inputs');
const SUBMITS = merge('submits');

const VIEWS = { home: viewHome, recipes: recipes.viewRecipes, menus: menus.viewMenus, shopping: shopping.viewShopping, cook: cook.viewCook, account: account.viewAccount };
const NAV = [['home', 'Home', 'home'], ['recipes', 'Rezepte', 'book'], ['menus', 'Menüs', 'plate'], ['shopping', 'Einkauf', 'cart'], ['cook', 'Kochen', 'flame']];
if (VIEWS[location.hash.slice(1)]) S.view = location.hash.slice(1);

let store;
let needAuth = false;

// ---------- Navigation ----------

const WAKE_LABEL = { on: 'Display bleibt an', off: 'Display wach halten', paused: 'Display wach halten', denied: 'Nicht verfügbar', unsupported: 'Nicht verfügbar' };

function renderNav() {
  const nav = $('#nav'), bar = $('#tabbar');
  if (needAuth) { nav.innerHTML = ''; bar.innerHTML = ''; return; }
  const count = shopping.openShopCount();
  const wakeOnNow = wakeState === 'on';
  const syncWarn = S.mode === 'supabase' && (S.pending || S.offline);
  nav.innerHTML = `<div class="gnav-inner">
    <button class="gnav-brand" data-action="nav" data-view="home" aria-label="Kochbuch, Startseite">${icon('logo')}<span>Kochbuch</span></button>
    <div class="gnav-links">${NAV.map(([v, l]) => `<button data-action="nav" data-view="${v}" ${S.view === v ? 'aria-current="page"' : ''}>${l}${v === 'shopping' && count ? ` <span class="badge num">${count}</span>` : ''}</button>`).join('')}</div>
    <div class="gnav-tools">
      <button class="wake${wakeOnNow ? ' on' : ''}" data-action="wake" aria-pressed="${wakeOnNow}" title="${WAKE_LABEL[wakeState]}">${icon('sun')}<span>${WAKE_LABEL[wakeState]}</span></button>
      <button class="icon-btn${S.view === 'account' ? ' current' : ''}${syncWarn ? ' warn' : ''}" data-action="nav" data-view="account" aria-label="Konto">${icon('person')}</button>
    </div>
  </div>`;
  bar.innerHTML = [...NAV, ['account', 'Konto', 'person']].map(([v, l, ic]) => `<button data-action="nav" data-view="${v}" ${S.view === v ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span>${v === 'shopping' && count ? `<i class="dot-badge num">${count}</i>` : ''}</button>`).join('');
}

// ---------- Rendering ----------

function render() {
  renderNav();
  const main = $('#main');
  document.body.classList.toggle('authing', needAuth);
  if (needAuth) { main.innerHTML = account.viewAuth(); return; }
  if (!S.loaded) return;
  const active = document.activeElement;
  const keep = active && active.id && main.contains(active) ? { id: active.id, s: active.selectionStart, e: active.selectionEnd } : null;
  const drafts = {};
  for (const id of ['comment-input', 'shop-new']) { const el = document.getElementById(id); if (el && el.value) drafts[id] = el.value; }
  const scroll = main.scrollTop;
  main.innerHTML = VIEWS[S.view]();
  for (const id in drafts) { const el = document.getElementById(id); if (el) el.value = drafts[id]; }
  main.scrollTop = scroll;
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus({ preventScroll: true }); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch {} }
  }
  renderTimers();
}
setRender(render);
onWakeChange(renderNav);

// ---------- Ereignisse ----------

let disarmTimer;
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'nav') {
    S.view = el.dataset.view;
    S.armed = null;
    // Zurück in einen laufenden Kochmodus: Display wieder wach halten.
    if (S.view === 'cook' && S.cook && !wakeWanted()) wakeOn();
    render();
    $('#main').scrollTo(0, 0);
    return;
  }
  if (a === 'wake') { wakeWanted() ? wakeOff() : wakeOn(); return; }
  if (ARMED[a]) {
    const [key, fn] = ARMED[a](el, e);
    if (S.armed === key) { S.armed = null; fn(); } else {
      S.armed = key;
      clearTimeout(disarmTimer);
      disarmTimer = setTimeout(() => { if (S.armed) { S.armed = null; render(); } }, 4000);
    }
    render();
    return;
  }
  ACTIONS[a]?.(el, e);
});
document.addEventListener('input', (e) => { const k = e.target.dataset?.input; if (k) INPUTS[k]?.(e.target, e); });
document.addEventListener('change', (e) => { const k = e.target.dataset?.change; if (k) CHANGES[k]?.(e.target, e); });
document.addEventListener('submit', (e) => {
  const k = e.target.dataset?.form;
  if (!k) return;
  e.preventDefault();
  SUBMITS[k]?.(e.target, e);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#overlay').hidden) recipes.closeOverlay(); });
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') recipes.closeOverlay(); });

// ---------- Start ----------

let unsubscribe = null;
async function loadData() {
  try {
    setData(await store.loadAll());
    S.pending = store.pending();
  } catch (e) {
    console.error(e);
    S.loaded = true;
    toast('Daten konnten nicht geladen werden. Prüfe die Verbindung.');
  }
  render();
  if (!unsubscribe) unsubscribe = store.subscribe(applyRemote);
}

async function boot() {
  try {
    store = await createStore();
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="auth"><h1>Keine Verbindung.</h1><p class="lede">Die App konnte nicht starten. Prüfe die Internetverbindung und lade neu.</p><button class="pill primary" onclick="location.reload()">Neu laden</button></div>`;
    return;
  }
  setStore(store);
  account.setAccountStore(store);
  store.onSync(({ pending, error }) => {
    if (pending != null) S.pending = pending;
    if (error) toast('Speichern fehlgeschlagen: ' + error);
    renderNav();
    if (S.view === 'account') render();
  });
  store.onAuthChange((session, event) => {
    if (event === 'PASSWORD_RECOVERY') { account.setRecoveryMode(); needAuth = true; render(); return; }
    const had = !!S.session;
    S.session = session;
    if (session && !had && needAuth && !account.inRecovery()) { needAuth = false; loadData(); }
  });
  S.session = await store.session();
  if (!S.session || /type=recovery/.test(location.hash)) { needAuth = true; render(); return; }
  await loadData();
}

// Nach Rückkehr in die App oder bei wieder verfügbarem Netz: ausstehende Änderungen senden, neu laden.
let lastSync = Date.now();
async function resync() {
  if (!store || needAuth || !S.loaded || S.mode !== 'supabase') return;
  await store.flush();
  if (Date.now() - lastSync > 30000) { lastSync = Date.now(); await loadData(); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resync(); });
addEventListener('online', () => { S.offline = false; lastSync = 0; resync(); });
addEventListener('offline', () => { S.offline = true; renderNav(); });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker nicht registriert', e));
}

render();
boot();
