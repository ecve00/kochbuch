// Kochmodus: Zutaten und Schritte je Gang abhaken, Timer aus den Schritten, Display bleibt an.
import { S, Data, rerender, saveUi } from '../state.js';
import { $, esc, byId, icon, fmtDate, qtyText, scaleFactor, timersIn, toast } from '../util.js';
import { wakeOn, wakeWanted, startTimer, stopTimer } from '../wake.js';
import { filteredRecipes, recipeMeta } from './recipes.js';

export function startCook(kind, id, servings) {
  S.cook = { kind, id, tab: 0, servings: servings || null };
  saveUi();
  S.view = 'cook';
  if (!wakeWanted()) wakeOn();
  rerender();
  $('#main').scrollTo(0, 0);
}

function cookTarget() {
  if (!S.cook) return null;
  if (S.cook.kind === 'menu') {
    const m = byId(S.menus, S.cook.id);
    if (!m) return null;
    const parts = (m.courses || []).map((c, i) => ({ key: 'c' + i, recipe: byId(S.recipes, c.recipeId), servings: +m.guests || null, course: c.course })).filter((p) => p.recipe);
    return { title: m.name || 'Menü', sub: [m.date ? fmtDate(m.date) : '', m.guests ? m.guests + ' Personen' : ''].filter(Boolean).join(' · '), pkey: 'm-' + m.id, parts };
  }
  const r = byId(S.recipes, S.cook.id);
  if (!r) return null;
  const sv = S.cook.servings || r.servings;
  return { title: r.title, sub: sv ? sv + ' Portionen' : '', pkey: 'r-' + r.id, parts: [{ key: 'c0', recipe: r, servings: sv, course: r.category }] };
}
const progressOf = (pkey) => (S.progress[pkey] && S.progress[pkey].data) || { s: {}, i: {} };
const doneCount = (p, part) => ((p.s || {})[part.key] || []).filter((x) => x < (part.recipe.steps || []).length).length;

export function viewCook() {
  const t = cookTarget();
  if (!t) return pickView();
  const p = progressOf(t.pkey);
  const total = t.parts.reduce((n, pt) => n + (pt.recipe.steps || []).length, 0);
  const doneN = t.parts.reduce((n, pt) => n + doneCount(p, pt), 0);
  const tab = Math.min(S.cook.tab || 0, t.parts.length - 1);
  const part = t.parts[tab];
  const r = part.recipe;
  const f = scaleFactor(r, part.servings);
  const sDone = new Set((p.s || {})[part.key] || []);
  const iDone = new Set((p.i || {})[part.key] || []);
  const next = (r.steps || []).findIndex((_, i) => !sDone.has(i));
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  const armed = S.armed === 'cook-reset';
  return `<div class="view cook">
    <div class="cook-head">
      <div class="cook-top">
        <div class="grow"><p class="eyebrow">Kochmodus${t.sub ? ' · ' + esc(t.sub) : ''}</p><h1 class="cook-title">${esc(t.title)}</h1></div>
        <span class="muted num small">${doneN} von ${total} Schritten</span>
        <button class="pill small" data-action="cook-exit">Fertig</button>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      ${t.parts.length > 1 ? `<div class="segmented" role="tablist">${t.parts.map((pt, i) => {
        const n = (pt.recipe.steps || []).length, d = doneCount(p, pt);
        return `<button role="tab" aria-selected="${i === tab}" class="${n && d >= n ? 'complete' : ''}" data-action="cook-tab" data-i="${i}"><small>${esc(pt.course || '')}</small>${esc(pt.recipe.title)}</button>`;
      }).join('')}</div>` : ''}
    </div>
    <div class="cook-cols">
      <section>
        <h3>Zutaten${part.servings ? ` <span class="muted num">für ${part.servings}</span>` : ''}</h3>
        <ul class="group checks">${(r.ingredients || []).map((i, idx) => (i.section
          ? `<li class="group-label">${esc(i.name)}</li>`
          : `<li><button class="check-row${iDone.has(idx) ? ' done' : ''}" data-action="cook-ing" data-idx="${idx}" aria-pressed="${iDone.has(idx)}"><span class="tick">${icon('check')}</span><span class="row-main"><b class="num">${esc(qtyText(i, f))}</b> ${esc(i.name)}</span></button></li>`)).join('')}</ul>
      </section>
      <section>
        <h3>Schritte</h3>
        <ol class="cook-steps">${(r.steps || []).map((s, idx) => {
          const tm = sDone.has(idx) ? [] : timersIn(s);
          return `<li class="step${sDone.has(idx) ? ' done' : ''}${idx === next ? ' next' : ''}" data-action="cook-step" data-idx="${idx}">
            <button class="tick big" aria-pressed="${sDone.has(idx)}" aria-label="Schritt ${idx + 1} erledigt">${icon('check')}</button>
            <div class="step-body"><span class="step-no">Schritt ${idx + 1}</span><p>${esc(s)}</p>
            ${tm.map((x) => `<button class="timer-btn" data-action="timer-start" data-sec="${x.sec}" data-label="${esc(x.label)}">${icon('clock')}Timer ${esc(x.label)}</button>`).join(' ')}</div>
          </li>`;
        }).join('') || '<li class="muted">Keine Schritte eingetragen.</li>'}</ol>
        ${total && doneN >= total ? '<div class="card done-card"><h2>Guten Appetit.</h2><p>Alles erledigt. Wie war es? Hinterlass einen Kommentar am Rezept.</p></div>' : ''}
        <p class="center"><button class="link danger${armed ? ' armed' : ''}" data-action="cook-reset">${armed ? 'Wirklich alle Haken entfernen?' : 'Alle Haken zurücksetzen'}</button></p>
      </section>
    </div>
  </div>`;
}

function pickView() {
  const recipes = filteredRecipes();
  return `<div class="view">
    <header class="hero"><div><h1>Kochen.</h1><p class="lede">Schritt für Schritt. Mit Timern, Haken und einem Display, das anbleibt.</p></div></header>
    ${S.menus.length ? `<h3 class="spaced">Menüs</h3><div class="tiles">${S.menus.map((m) => `<button class="tile" data-action="cook-menu" data-id="${m.id}"><span class="tile-title">${esc(m.name || 'Menü')}</span><span class="tile-sub">${(m.courses || []).length} Gänge${m.guests ? ' · ' + m.guests + ' Personen' : ''}</span><span class="link">Kochen ›</span></button>`).join('')}</div>` : ''}
    ${recipes.length ? `<h3 class="spaced">Einzelne Rezepte</h3><ul class="group">${recipes.map((r) => `<li><button class="row" data-action="cook-recipe" data-id="${r.id}"><span class="row-main"><span class="row-title">${esc(r.title)}</span><span class="row-sub">${esc(recipeMeta(r))}</span></span><span class="chev">${icon('chevron')}</span></button></li>`).join('')}</ul>`
    : `<div class="card empty"><h2>Noch nichts zu kochen.</h2><p>Lege zuerst ein Rezept an.</p><button class="pill primary" data-action="nav" data-view="recipes">Zu den Rezepten</button></div>`}
  </div>`;
}

function toggle(kind, idx) {
  const t = cookTarget();
  if (!t) return;
  const part = t.parts[Math.min(S.cook.tab || 0, t.parts.length - 1)];
  const p = JSON.parse(JSON.stringify(progressOf(t.pkey)));
  p[kind] = p[kind] || {};
  const set = new Set(p[kind][part.key] || []);
  const on = !set.has(idx);
  if (on) set.add(idx); else set.delete(idx);
  p[kind][part.key] = [...set].sort((a, b) => a - b);
  // Alle Schritte eines Gangs erledigt: einmal als gekocht zählen (für das Kurzprofil).
  const steps = (part.recipe.steps || []).length;
  p.logged = p.logged || {};
  if (kind === 's' && on && steps && set.size >= steps && !p.logged[part.key]) {
    p.logged[part.key] = Data.logCooked(part.recipe, S.cook.kind === 'menu' ? S.cook.id : null).id;
    toast(`${part.recipe.title}: als gekocht gezählt`);
  }
  Data.putProgress(t.pkey, p);
  rerender();
  if (kind === 's' && on) {
    const nx = $('.step.next');
    nx?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }
}

export const actions = {
  'cook-tab': (el) => { S.cook.tab = +el.dataset.i; saveUi(); rerender(); $('#main').scrollTo(0, 0); },
  'cook-ing': (el) => toggle('i', +el.dataset.idx),
  'cook-step': (el, e) => { if (!e.target.closest('.timer-btn')) toggle('s', +el.dataset.idx); },
  'cook-exit': () => { S.cook = null; saveUi(); rerender(); },
  'timer-start': (el, e) => {
    e.stopPropagation();
    const t = cookTarget();
    const part = t && t.parts.length > 1 ? t.parts[S.cook.tab || 0] : null;
    startTimer((part ? part.recipe.title + ': ' : '') + el.dataset.label, +el.dataset.sec);
    toast('Timer läuft: ' + el.dataset.label);
  },
  'timer-stop': (el) => stopTimer(el.dataset.id),
};
export const armedActions = {
  'cook-reset': () => ['cook-reset', () => { const t = cookTarget(); if (t) Data.putProgress(t.pkey, { s: {}, i: {} }); }],
};
