// App-Zustand und alle Änderungen daran. Jede Änderung wird sofort angezeigt und dann gespeichert.
import { now, uid, normUnit, shopKey } from './util.js';

export const S = {
  recipes: [], comments: [], menus: [], shopping: [], progress: {}, log: [],
  loaded: false, offline: false, pending: 0, session: null, mode: 'demo',
  view: 'home', selRecipe: null, selMenu: null,
  q: '', cat: '', sort: 'name',
  serv: {},      // gewählte Portionen je Rezept in der Detailansicht
  cook: null,    // { kind: 'menu'|'recipe', id, tab, servings }
  armed: null,   // zweistufige Lösch-Buttons
};

const UI_KEY = 'kochbuch.ui';
try {
  const pref = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
  if (pref.sort) S.sort = pref.sort;
  if (pref.cook) S.cook = pref.cook;
} catch {}
export function saveUi() {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ sort: S.sort, cook: S.cook })); } catch {}
}

let store = null;
let renderFn = () => {};
export function setStore(s) { store = s; S.mode = s.mode; }
export function setRender(fn) { renderFn = fn; }
export function rerender() { renderFn(); }

export function setData(all) {
  S.recipes = all.recipes || [];
  S.comments = all.comments || [];
  S.menus = all.menus || [];
  S.shopping = all.shopping || [];
  S.log = all.log || [];
  S.progress = Object.fromEntries((all.progress || []).map((p) => [p.key, p]));
  S.offline = !!all.offline;
  S.loaded = true;
}
function snapshot() {
  return { recipes: S.recipes, comments: S.comments, menus: S.menus, shopping: S.shopping, progress: Object.values(S.progress), log: S.log };
}
let cacheTimer;
function cacheSoon() { clearTimeout(cacheTimer); cacheTimer = setTimeout(() => store.cache(snapshot()), 500); }

function upsertLocal(arr, obj) {
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
}

// Debounce je Datensatz für schnelle Klickfolgen (Abhaken im Kochmodus, Einkaufsliste).
const timers = new Map();
function later(key, ms, fn) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
}
const isPending = (key) => timers.has(key);

export const Data = {
  putRecipe(r) {
    r.updatedAt = now();
    r.createdAt = r.createdAt || r.updatedAt;
    upsertLocal(S.recipes, r);
    store.upsert('recipes', r); cacheSoon();
  },
  delRecipe(id) {
    S.recipes = S.recipes.filter((x) => x.id !== id);
    S.comments = S.comments.filter((c) => c.recipeId !== id);
    S.menus.forEach((m) => {
      if ((m.courses || []).some((c) => c.recipeId === id)) Data.putMenu({ ...m, courses: m.courses.filter((c) => c.recipeId !== id) });
    });
    store.remove('recipes', { id }); cacheSoon();
  },
  addComment(recipeId, text) {
    const c = { id: uid(), recipeId, text, at: now() };
    S.comments.push(c);
    store.upsert('comments', c); cacheSoon();
  },
  delComment(id) {
    S.comments = S.comments.filter((c) => c.id !== id);
    store.remove('comments', { id }); cacheSoon();
  },
  putMenu(m) {
    m.updatedAt = now();
    m.createdAt = m.createdAt || m.updatedAt;
    upsertLocal(S.menus, m);
    store.upsert('menus', m); cacheSoon();
  },
  delMenu(id) {
    S.menus = S.menus.filter((x) => x.id !== id);
    store.remove('menus', { id }); cacheSoon();
  },
  putShopItem(item) {
    item.updatedAt = now();
    item.createdAt = item.createdAt || item.updatedAt;
    upsertLocal(S.shopping, item);
    later('shop-' + item.id, 300, () => store.upsert('shopping', S.shopping.find((x) => x.id === item.id) || item));
    cacheSoon();
  },
  delShopItems(ids) {
    S.shopping = S.shopping.filter((x) => !ids.includes(x.id));
    store.removeMany('shopping', ids); cacheSoon();
  },
  logCooked(recipe, menuId) {
    const l = { id: uid(), recipeId: recipe.id, title: recipe.title, category: recipe.category || null, menuId: menuId || null, at: now() };
    S.log.push(l);
    store.upsert('log', l); cacheSoon();
    return l;
  },
  delLog(id) {
    S.log = S.log.filter((l) => l.id !== id);
    store.remove('log', { id }); cacheSoon();
  },
  putProgress(key, data) {
    S.progress[key] = { key, data, updatedAt: now() };
    later('prog-' + key, 400, () => store.upsert('progress', S.progress[key]));
    cacheSoon();
  },
};

// Zutaten auf die Einkaufsliste; gleiche Zutat + Einheit wird zusammengezählt.
export function addToShopping(ings, factor, from) {
  let n = 0;
  for (const i of ings) {
    if (i.section || !i.name) continue;
    const qty = i.qty != null ? i.qty * factor : null;
    const ex = S.shopping.find((x) => !x.done && shopKey(x.name, x.unit) === shopKey(i.name, i.unit));
    if (ex) {
      const next = { ...ex, from: [...(ex.from || [])] };
      if (next.qty != null && qty != null) next.qty += qty; else if (next.qty == null) next.qty = qty;
      if (from && !next.from.includes(from)) next.from.push(from);
      Data.putShopItem(next);
    } else {
      Data.putShopItem({ id: uid(), name: i.name, unit: normUnit(i.unit), qty, done: false, from: from ? [from] : [] });
    }
    n++;
  }
  return n;
}

// Änderung von einem anderen Gerät übernehmen. Ältere Stände überschreiben keine neueren.
export function applyRemote(t, type, obj, old) {
  if (t === 'progress') {
    const key = (obj || old || {}).key;
    if (!key || isPending('prog-' + key)) return;
    if (type === 'DELETE') delete S.progress[key];
    else if (!S.progress[key] || (S.progress[key].updatedAt || '') <= (obj.updatedAt || '')) S.progress[key] = obj;
  } else {
    const id = (obj || old || {}).id;
    if (!id || isPending('shop-' + id)) return;
    if (type === 'DELETE') S[t] = S[t].filter((x) => x.id !== id);
    else {
      const cur = S[t].find((x) => x.id === id);
      if (cur && cur.updatedAt && obj.updatedAt && cur.updatedAt > obj.updatedAt) return;
      upsertLocal(S[t], obj);
    }
  }
  cacheSoon();
  rerender();
}

// Sicherung als JSON und Import (auch aus der früheren Artifact-Version).
export function exportData() {
  return {
    app: 'kochbuch', version: 1, exportedAt: now(),
    recipes: S.recipes.map((r) => ({ ...r, comments: S.comments.filter((c) => c.recipeId === r.id).map(({ text, at }) => ({ text, at })) })),
    menus: S.menus,
    shopping: S.shopping,
  };
}
export function importData(json) {
  const idMap = new Map();
  let nr = 0, nm = 0;
  for (const src of json.recipes || []) {
    const id = uid();
    idMap.set(src.id, id);
    const { comments = [], example, ...rest } = src;
    Data.putRecipe({ ...rest, id, tags: rest.tags || [], ingredients: rest.ingredients || [], steps: rest.steps || [], rating: rest.rating || 0 });
    for (const c of comments) {
      const cm = { id: uid(), recipeId: id, text: c.text, at: c.at || now() };
      S.comments.push(cm);
      store.upsert('comments', cm);
    }
    nr++;
  }
  for (const src of json.menus || []) {
    Data.putMenu({
      ...src, id: uid(), createdAt: src.createdAt,
      courses: (src.courses || []).filter((c) => idMap.has(c.recipeId)).map((c) => ({ ...c, recipeId: idMap.get(c.recipeId) })),
    });
    nm++;
  }
  for (const src of json.shopping || json.shoppingItems || []) {
    Data.putShopItem({ ...src, id: uid() });
  }
  return { recipes: nr, menus: nm };
}
