// Menüs: Gänge aus Rezepten zusammenstellen, mit Datum und Personenzahl.
import { S, Data, rerender, addToShopping } from '../state.js';
import { $, esc, uid, clone, byId, icon, fmtDate, scaleFactor, toast, COURSES } from '../util.js';
import { startCook } from './cook.js';

export function guessCourse(r) {
  return { Vorspeise: 'Vorspeise', Suppe: 'Suppe', Salat: 'Vorspeise', Dessert: 'Dessert', Backen: 'Dessert', Beilage: 'Beilage', Getränk: 'Aperitif' }[r.category] || 'Hauptgang';
}
export function newMenu(withRecipe) {
  const m = { id: uid(), name: 'Neues Menü', date: '', guests: 4, courses: [] };
  if (withRecipe) m.courses.push({ recipeId: withRecipe.id, course: guessCourse(withRecipe) });
  Data.putMenu(m);
  return m;
}
export function menuToShopping(m) {
  let n = 0;
  for (const c of m.courses || []) {
    const r = byId(S.recipes, c.recipeId);
    if (r) n += addToShopping(r.ingredients || [], scaleFactor(r, +m.guests), r.title);
  }
  return n;
}

export function viewMenus() {
  const sel = S.selMenu && byId(S.menus, S.selMenu);
  const menus = S.menus.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `<div class="view">
    <header class="hero">
      <div><h1>Menüs.</h1><p class="lede">Vorspeise, Hauptgang, Dessert. Für genau so viele Gäste, wie kommen.</p></div>
      <button class="pill primary" data-action="new-menu">${icon('plus')}Neues Menü</button>
    </header>
    ${menus.length ? `<div class="tiles">${menus.map((m) => `<button class="tile" data-action="open-menu" data-id="${m.id}" aria-current="${!!sel && sel.id === m.id}">
        <span class="eyebrow">${m.date ? esc(fmtDate(m.date)) : 'Ohne Datum'}</span>
        <span class="tile-title">${esc(m.name || 'Menü')}</span>
        <span class="tile-sub">${(m.courses || []).length} Gänge · ${m.guests || '–'} Personen</span>
        <ol class="tile-list">${(m.courses || []).map((c) => { const r = byId(S.recipes, c.recipeId); return `<li><span>${esc(c.course)}</span>${esc(r ? r.title : 'Rezept fehlt')}</li>`; }).join('')}</ol>
      </button>`).join('')}</div>`
    : `<div class="card empty"><h2>Noch keine Menüs.</h2><p>Stell aus deinen Rezepten ein Menü zusammen. Die Mengen rechnen sich für deine Gäste um.</p><button class="pill primary" data-action="new-menu">Menü anlegen</button></div>`}
    ${sel ? menuEditor(sel) : ''}
  </div>`;
}

function menuEditor(m) {
  const armed = S.armed === 'del-menu-' + m.id;
  const has = (m.courses || []).length > 0;
  const recipes = S.recipes.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
  return `<section class="card" id="menu-editor">
    <div class="sec-head"><h2>${esc(m.name || 'Menü')}</h2>
      <div class="actions tight">
        <button class="pill primary" data-action="cook-menu" data-id="${m.id}" ${has ? '' : 'disabled'}>${icon('flame')}Kochen</button>
        <button class="pill" data-action="menu-to-shop" data-id="${m.id}" ${has ? '' : 'disabled'}>${icon('cart')}Einkaufsliste</button>
      </div>
    </div>
    <div class="grid3 form-gap">
      <label class="lbl">Name<input class="field" id="menu-name" value="${esc(m.name)}" data-change="menu-field" data-field="name"></label>
      <label class="lbl">Datum<input class="field" id="menu-date" type="date" value="${esc(m.date || '')}" data-change="menu-field" data-field="date"></label>
      <label class="lbl">Personen<input class="field" id="menu-guests" type="number" inputmode="numeric" min="1" max="99" value="${esc(m.guests || 4)}" data-change="menu-field" data-field="guests"></label>
    </div>
    <h3>Gänge</h3>
    <ul class="group courses">
      ${(m.courses || []).map((c, idx) => `<li class="course">
        <select class="select" id="c-course-${idx}" data-change="course" data-idx="${idx}" data-field="course" aria-label="Gang">${COURSES.map((x) => `<option ${c.course === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <select class="select grow" id="c-recipe-${idx}" data-change="course" data-idx="${idx}" data-field="recipeId" aria-label="Rezept">
          ${byId(S.recipes, c.recipeId) ? '' : '<option value="">Rezept wählen …</option>'}
          ${recipes.map((r) => `<option value="${r.id}" ${c.recipeId === r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}
        </select>
        <span class="ord"><button data-action="course-move" data-idx="${idx}" data-d="-1" aria-label="Nach oben">↑</button><button data-action="course-move" data-idx="${idx}" data-d="1" aria-label="Nach unten">↓</button></span>
        <button class="link danger" data-action="course-del" data-idx="${idx}">Entfernen</button>
      </li>`).join('') || '<li class="muted pad">Noch keine Gänge.</li>'}
    </ul>
    ${recipes.length ? `<select class="select" id="course-add" data-change="course-add" aria-label="Gang hinzufügen"><option value="">Gang hinzufügen …</option>${recipes.map((r) => `<option value="${r.id}">${esc(r.title)}</option>`).join('')}</select>` : '<p class="muted">Lege zuerst Rezepte an.</p>'}
    <footer class="detail-foot">
      <span class="muted small">Mengen werden für ${esc(m.guests || 4)} Personen umgerechnet.</span>
      <button class="link danger${armed ? ' armed' : ''}" data-action="del-menu" data-id="${m.id}">${armed ? 'Wirklich löschen?' : 'Menü löschen'}</button>
    </footer>
  </section>`;
}

const edit = (fn) => { const m = clone(byId(S.menus, S.selMenu)); m.courses = m.courses || []; fn(m); Data.putMenu(m); rerender(); };

export const actions = {
  'new-menu': () => {
    const m = newMenu();
    S.selMenu = m.id;
    rerender();
    setTimeout(() => { const n = $('#menu-name'); if (n) { n.scrollIntoView({ block: 'center' }); n.focus(); n.select(); } }, 30);
  },
  'open-menu': (el) => {
    S.selMenu = el.dataset.id;
    rerender();
    setTimeout(() => $('#menu-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  },
  'course-move': (el) => edit((m) => {
    const i = +el.dataset.idx, j = i + +el.dataset.d;
    if (j >= 0 && j < m.courses.length) [m.courses[i], m.courses[j]] = [m.courses[j], m.courses[i]];
  }),
  'course-del': (el) => edit((m) => m.courses.splice(+el.dataset.idx, 1)),
  'menu-to-shop': (el) => {
    const m = byId(S.menus, el.dataset.id);
    const n = menuToShopping(m);
    rerender();
    toast(`${n} Zutaten aus „${m.name || 'Menü'}“ übernommen`);
  },
  'cook-menu': (el) => startCook('menu', el.dataset.id),
};
export const armedActions = {
  'del-menu': (el) => ['del-menu-' + el.dataset.id, () => { Data.delMenu(el.dataset.id); S.selMenu = null; toast('Menü gelöscht'); }],
};
export const changes = {
  'menu-field': (el) => edit((m) => {
    const f = el.dataset.field;
    m[f] = f === 'guests' ? Math.max(1, Math.min(99, parseInt(el.value, 10) || 1)) : el.value.trim();
  }),
  course: (el) => edit((m) => { m.courses[+el.dataset.idx][el.dataset.field] = el.value; }),
  'course-add': (el) => {
    const r = byId(S.recipes, el.value);
    if (r) edit((m) => m.courses.push({ recipeId: r.id, course: guessCourse(r) }));
  },
};
