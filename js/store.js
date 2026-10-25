// Datenschicht. Gleiche Schnittstelle für Supabase (Mac + iPad synchron) und den Demo-Modus (nur dieser Browser).
// Tabellen in der App: recipes, comments, menus, shopping, progress.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { demoData } from './demo.js';

export async function createStore() {
  // Mit ?demo in der Adresse läuft die App zum Ausprobieren im Demo-Modus, auch wenn Supabase eingetragen ist.
  const demo = new URLSearchParams(location.search).has('demo');
  if (SUPABASE_URL && SUPABASE_ANON_KEY && !demo) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
    return supabaseStore(createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  }
  return demoStore();
}

const TABLES = { recipes: 'recipes', comments: 'recipe_comments', menus: 'menus', shopping: 'shopping_items', progress: 'cook_progress', log: 'cook_log' };

// App-Objekte (camelCase) ↔ Tabellenzeilen (snake_case).
const toRow = {
  recipes: (r) => ({
    id: r.id, title: r.title, category: r.category, servings: r.servings, total_min: r.totalMin ?? null, tags: r.tags || [],
    ingredients: r.ingredients || [], steps: r.steps || [], notes: r.notes || '', source: r.source || '', rating: r.rating || 0,
    created_at: r.createdAt, updated_at: r.updatedAt,
  }),
  comments: (c) => ({ id: c.id, recipe_id: c.recipeId, text: c.text, created_at: c.at }),
  menus: (m) => ({ id: m.id, name: m.name, date: m.date || null, guests: m.guests || null, courses: m.courses || [], created_at: m.createdAt, updated_at: m.updatedAt }),
  shopping: (i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit || '', done: !!i.done, sources: i.from || [], created_at: i.createdAt, updated_at: i.updatedAt }),
  progress: (p) => ({ key: p.key, data: p.data, updated_at: p.updatedAt }),
  log: (l) => ({ id: l.id, recipe_id: l.recipeId || null, recipe_title: l.title, category: l.category || null, menu_id: l.menuId || null, cooked_at: l.at }),
};
const fromRow = {
  recipes: (r) => ({
    id: r.id, title: r.title, category: r.category, servings: r.servings, totalMin: r.total_min, tags: r.tags || [],
    ingredients: r.ingredients || [], steps: r.steps || [], notes: r.notes || '', source: r.source || '', rating: r.rating || 0,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }),
  comments: (c) => ({ id: c.id, recipeId: c.recipe_id, text: c.text, at: c.created_at }),
  menus: (m) => ({ id: m.id, name: m.name, date: m.date || '', guests: m.guests, courses: m.courses || [], createdAt: m.created_at, updatedAt: m.updated_at }),
  shopping: (i) => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit, done: i.done, from: i.sources || [], createdAt: i.created_at, updatedAt: i.updated_at }),
  progress: (p) => ({ key: p.key, data: p.data || {}, updatedAt: p.updated_at }),
  log: (l) => ({ id: l.id, recipeId: l.recipe_id, title: l.recipe_title, category: l.category, menuId: l.menu_id, at: l.cooked_at }),
};
const keyOf = (t, obj) => (t === 'progress' ? { key: obj.key } : { id: obj.id });

// ---------- Supabase ----------

function supabaseStore(sb) {
  const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
  };
  const isNetwork = (e) => !navigator.onLine || e instanceof TypeError || /fetch|network|load failed|timeout/i.test(e?.message || '');
  let meId = null;
  let outbox = [];
  let flushing = false;
  let onSync = () => {};
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const outboxKey = () => 'kochbuch.outbox.' + meId;
  const cacheKey = () => 'kochbuch.cache.' + meId;

  async function run(op) {
    const table = TABLES[op.t];
    if (op.kind === 'upsert') {
      const row = toRow[op.t](op.obj);
      if (op.t === 'progress') row.owner = meId;
      unwrap(await sb.from(table).upsert(row, op.t === 'progress' ? { onConflict: 'owner,key' } : undefined));
    } else {
      let q = sb.from(table).delete();
      for (const [k, v] of Object.entries(op.match)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
      unwrap(await q);
    }
  }
  async function exec(op) {
    if (outbox.length) { queue(op); flush(); return; }
    try { await run(op); } catch (e) {
      if (isNetwork(e)) { queue(op); return; }
      console.error(e);
      onSync({ error: e.message || 'Speichern fehlgeschlagen' });
    }
  }
  function queue(op) {
    outbox.push(op);
    ls.set(outboxKey(), outbox);
    onSync({ pending: outbox.length });
  }
  async function flush() {
    if (flushing || !outbox.length || !meId) return;
    flushing = true;
    while (outbox.length) {
      try { await run(outbox[0]); } catch (e) {
        if (isNetwork(e)) break;
        console.error('Verworfen:', outbox[0], e);
      }
      outbox.shift();
      ls.set(outboxKey(), outbox);
    }
    flushing = false;
    onSync({ pending: outbox.length });
  }

  return {
    mode: 'supabase',
    pending: () => outbox.length,
    onSync(cb) { onSync = cb; },

    async session() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    onAuthChange(cb) {
      sb.auth.onAuthStateChange((event, session) => cb(session, event));
    },
    async signIn(email, password) {
      unwrap(await sb.auth.signInWithPassword({ email, password }));
    },
    async signUp(email, password) {
      const data = unwrap(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
      return { needsConfirmation: !data.session };
    },
    async resetPassword(email) {
      unwrap(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async updatePassword(password) {
      unwrap(await sb.auth.updateUser({ password }));
    },
    async signOut() {
      await sb.auth.signOut();
    },

    // Lädt alles; ohne Netz kommt der letzte Stand aus dem Zwischenspeicher dieses Geräts.
    async loadAll() {
      const { data } = await sb.auth.getSession();
      meId = data.session.user.id;
      outbox = ls.get(outboxKey(), []);
      try {
        await flush();
        const lists = await Promise.all(
          Object.entries(TABLES).map(([t, table]) => sb.from(table).select('*').then(unwrap).then((rows) => [t, rows.map(fromRow[t])])
            // Fehlt die Tabelle cook_log noch (schema.sql nicht erneut ausgeführt), läuft die App ohne Kurzprofil weiter.
            .catch((e) => { if (t === 'log' && !isNetwork(e)) { console.warn('cook_log fehlt:', e.message); return [t, []]; } throw e; })),
        );
        const all = Object.fromEntries(lists);
        ls.set(cacheKey(), all);
        return { ...all, offline: false };
      } catch (e) {
        if (!isNetwork(e)) throw e;
        const cached = ls.get(cacheKey(), null);
        if (!cached) throw e;
        return { ...cached, offline: true };
      }
    },
    cache(all) {
      if (meId) ls.set(cacheKey(), all);
    },

    upsert(t, obj) { return exec({ kind: 'upsert', t, obj }); },
    remove(t, obj) { return exec({ kind: 'delete', t, match: keyOf(t, obj) }); },
    removeMany(t, ids) { return ids.length ? exec({ kind: 'delete', t, match: { id: ids } }) : null; },
    flush,

    // Live-Änderungen von anderen Geräten.
    subscribe(handler) {
      const ch = sb.channel('kochbuch-' + meId);
      for (const [t, table] of Object.entries(TABLES)) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => {
          const hasNew = p.new && Object.keys(p.new).length;
          handler(t, p.eventType, hasNew ? fromRow[t](p.new) : null, p.old ? (t === 'progress' ? { key: p.old.key } : { id: p.old.id }) : null);
        });
      }
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

// ---------- Demo (localStorage) ----------

function demoStore() {
  const KEY = 'kochbuch.demo';
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!db) db = demoData();
  for (const k of ['recipes', 'comments', 'menus', 'shopping', 'progress', 'log']) db[k] = db[k] || [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  save();
  const match = (t, obj) => (x) => (t === 'progress' ? x.key === obj.key : x.id === obj.id);

  return {
    mode: 'demo',
    pending: () => 0,
    onSync() {},
    async session() { return { user: { email: 'Demo-Modus' } }; },
    onAuthChange() {},
    async signIn() {}, async signUp() { return {}; }, async resetPassword() {}, async updatePassword() {},
    async signOut() {},
    async loadAll() { return { ...JSON.parse(JSON.stringify(db)), offline: false }; },
    cache() {},
    upsert(t, obj) {
      const arr = db[t];
      const i = arr.findIndex(match(t, obj));
      if (i >= 0) arr[i] = JSON.parse(JSON.stringify(obj)); else arr.push(JSON.parse(JSON.stringify(obj)));
      if (t === 'recipes') db.comments = db.comments.filter((c) => db.recipes.some((r) => r.id === c.recipeId));
      save();
    },
    remove(t, obj) {
      db[t] = db[t].filter((x) => !match(t, obj)(x));
      if (t === 'recipes') db.comments = db.comments.filter((c) => c.recipeId !== obj.id);
      save();
    },
    removeMany(t, ids) { db[t] = db[t].filter((x) => !ids.includes(x.id)); save(); },
    async flush() {},
    subscribe() { return () => {}; },
  };
}
