// Rezepte: Liste mit Suche, Sortierung und Kategorien, Detailansicht, Editor, Bewertung, Kommentare.
import { S, Data, rerender, saveUi, addToShopping } from '../state.js';
import { $, esc, uid, clone, byId, icon, starsHtml, qtyText, ingLine, parseIng, scaleFactor, fmtDate, fmtDateTime, toast, CATS } from '../util.js';
import { newMenu, guessCourse } from './menus.js';
import { startCook } from './cook.js';

export function filteredRecipes() {
  const q = S.q.trim().toLowerCase();
  const list = S.recipes.filter((r) => (!S.cat || r.category === S.cat) && (!q
    || [r.title, r.category, (r.tags || []).join(' '), (r.ingredients || []).map((i) => i.name).join(' ')].join(' ').toLowerCase().includes(q)));
  const by = {
    name: (a, b) => (a.title || '').localeCompare(b.title || '', 'de'),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || by.name(a, b),
    newest: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
    time: (a, b) => (a.totalMin || 1e9) - (b.totalMin || 1e9) || by.name(a, b),
  };
  return list.sort(by[S.sort] || by.name);
}
export const recipeMeta = (r) => [r.category, r.totalMin ? r.totalMin + ' Min.' : ''].filter(Boolean).join(' · ');

export function viewRecipes() {
  const list = filteredRecipes();
  const sel = S.selRecipe && byId(S.recipes, S.selRecipe);
  const usedCats = CATS.filter((c) => S.recipes.some((r) => r.category === c));
  return `<div class="view">
    <header class="hero">
      <div><h1>Rezepte.</h1><p class="lede">Alles, was du gerne kochst. An einem Ort.</p></div>
      <button class="pill primary" data-action="new-recipe">${icon('plus')}Neues Rezept</button>
    </header>
    <div class="split${sel ? ' has-detail' : ''}">
      <div class="list-col">
        <div class="toolbar">
          <label class="search">${icon('search')}<input id="q" type="search" placeholder="Suchen" value="${esc(S.q)}" data-input="q" aria-label="Rezepte durchsuchen"></label>
          <select class="select" id="sort" data-change="sort" aria-label="Sortierung">
            ${[['name', 'Name A–Z'], ['rating', 'Beste Bewertung'], ['newest', 'Neueste'], ['time', 'Schnellste']].map(([v, l]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        ${usedCats.length > 1 ? `<div class="chips"><button class="chip" data-action="cat" data-cat="" aria-pressed="${!S.cat}">Alle</button>${usedCats.map((c) => `<button class="chip" data-action="cat" data-cat="${esc(c)}" aria-pressed="${S.cat === c}">${esc(c)}</button>`).join('')}</div>` : ''}
        ${list.length ? `<ul class="group">${list.map((r) => `<li><button class="row" data-action="open-recipe" data-id="${r.id}" aria-current="${!!sel && sel.id === r.id}">
            <span class="row-main"><span class="row-title">${esc(r.title || 'Ohne Titel')}</span>
            <span class="row-sub">${esc(recipeMeta(r))}${(r.tags || []).length ? ' · ' + esc(r.tags.slice(0, 2).join(', ')) : ''}</span></span>
            ${r.rating ? starsHtml(r.rating, false, true) : ''}<span class="chev">${icon('chevron')}</span>
          </button></li>`).join('')}</ul>`
        : S.recipes.length ? '<p class="muted pad">Kein Rezept passt zur Suche.</p>'
        : `<div class="card empty"><h2>Noch keine Rezepte.</h2><p>Leg dein erstes Rezept an. Zutaten und Schritte tippst du einfach Zeile für Zeile ein.</p><button class="pill primary" data-action="new-recipe">Rezept anlegen</button></div>`}
      </div>
      <div class="detail-col">${sel ? recipeDetail(sel) : `<div class="card empty"><h2>Wähle ein Rezept.</h2><p>Zutaten, Schritte und Kommentare erscheinen hier.</p></div>`}</div>
    </div>
  </div>`;
}

function recipeDetail(r) {
  const serv = S.serv[r.id] || r.servings || 1;
  const f = scaleFactor(r, serv);
  const armed = S.armed === 'del-recipe-' + r.id;
  const comments = S.comments.filter((c) => c.recipeId === r.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const cooked = S.log.filter((l) => l.recipeId === r.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return `<article class="card detail">
    <button class="link back" data-action="close-recipe">${icon('back')}Rezepte</button>
    <p class="eyebrow">${esc(r.category || 'Rezept')}</p>
    <h2 class="detail-title">${esc(r.title || 'Ohne Titel')}</h2>
    <div class="meta">
      ${starsHtml(r.rating || 0, true)}
      ${r.totalMin ? `<span>${icon('clock')}${r.totalMin} Min.</span>` : ''}
      ${cooked.length ? `<span>${icon('flame')}${cooked.length}× gekocht, zuletzt ${esc(fmtDate(cooked[0].at))}</span>` : ''}
      ${r.source ? `<span>${/^https?:\/\//.test(r.source) ? `<a class="link" href="${esc(r.source)}" target="_blank" rel="noopener">${esc(r.source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])} ›</a>` : esc(r.source)}</span>` : ''}
    </div>
    ${(r.tags || []).length ? `<div class="tags">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <button class="pill primary" data-action="cook-recipe" data-id="${r.id}">${icon('flame')}Jetzt kochen</button>
      <button class="pill" data-action="recipe-to-shop" data-id="${r.id}">${icon('cart')}Auf die Einkaufsliste</button>
      <select class="select" data-change="add-to-menu" data-id="${r.id}" id="add-to-menu" aria-label="Zu Menü hinzufügen">
        <option value="">Zu Menü hinzufügen …</option>
        ${S.menus.map((m) => `<option value="${m.id}">${esc(m.name || 'Menü')}</option>`).join('')}
        <option value="__new">Neues Menü</option>
      </select>
    </div>
    <div class="cols">
      <section>
        <div class="sec-head"><h3>Zutaten</h3>
          ${r.servings ? `<span class="stepper"><button data-action="serv" data-d="-1" data-id="${r.id}" aria-label="Weniger Portionen">−</button><span class="num">${serv} Portionen</span><button data-action="serv" data-d="1" data-id="${r.id}" aria-label="Mehr Portionen">+</button></span>` : ''}
        </div>
        <ul class="ing">${(r.ingredients || []).map((i) => (i.section ? `<li class="sec">${esc(i.name)}</li>` : `<li><span class="q">${esc(qtyText(i, f))}</span><span>${esc(i.name)}</span></li>`)).join('') || '<li class="muted">Keine Zutaten eingetragen.</li>'}</ul>
      </section>
      <section>
        <h3>Zubereitung</h3>
        <ol class="steps">${(r.steps || []).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">Keine Schritte eingetragen.</li>'}</ol>
      </section>
    </div>
    ${r.notes ? `<aside class="note"><b>Notizen</b><p>${esc(r.notes)}</p></aside>` : ''}
    <section class="comments">
      <h3>Kommentare${comments.length ? ` <span class="muted num">${comments.length}</span>` : ''}</h3>
      <form class="comment-form" data-form="comment" data-id="${r.id}">
        <textarea class="field" id="comment-input" rows="2" placeholder="Wie war es? Was machst du nächstes Mal anders?"></textarea>
        <button class="pill" type="submit">Speichern</button>
      </form>
      ${comments.map((c) => `<div class="comment"><p>${esc(c.text)}</p><div class="when">${esc(fmtDateTime(c.at))} · <button class="link" data-action="del-comment" data-cid="${c.id}">Entfernen</button></div></div>`).join('')}
    </section>
    <footer class="detail-foot">
      <span class="actions tight"><button class="link" data-action="edit-recipe" data-id="${r.id}">Bearbeiten</button>
      <button class="link" data-action="log-cooked" data-id="${r.id}">Als gekocht zählen</button>${cooked.length ? `<button class="link" data-action="unlog-cooked" data-id="${cooked[0].id}">Letztes Mal entfernen</button>` : ''}</span>
      <button class="link danger${armed ? ' armed' : ''}" data-action="del-recipe" data-id="${r.id}">${armed ? 'Wirklich löschen?' : 'Rezept löschen'}</button>
    </footer>
  </article>`;
}

let editing = null;
function openEditor(r) {
  const isNew = !r;
  editing = r ? clone(r) : { id: uid(), title: '', category: 'Hauptgericht', servings: 4, totalMin: null, tags: [], ingredients: [], steps: [], notes: '', source: '', rating: 0 };
  const e = editing;
  const ov = $('#overlay');
  ov.innerHTML = `<form class="sheet" data-form="recipe" role="dialog" aria-modal="true" aria-labelledby="ed-h">
    <div class="sheet-head"><button type="button" class="link" data-action="close-overlay">Abbrechen</button><h2 id="ed-h">${isNew ? 'Neues Rezept' : 'Rezept bearbeiten'}</h2><button type="submit" class="link strong">Sichern</button></div>
    <div class="sheet-body">
      <label class="lbl">Titel<input class="field" id="ed-title" required value="${esc(e.title)}" placeholder="z. B. Ofengemüse mit Feta"></label>
      <div class="grid3">
        <label class="lbl">Kategorie<select class="field" id="ed-cat">${CATS.map((c) => `<option ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="lbl">Portionen<input class="field" id="ed-serv" type="number" inputmode="numeric" min="1" max="99" value="${esc(e.servings)}"></label>
        <label class="lbl">Zeit (Min.)<input class="field" id="ed-time" type="number" inputmode="numeric" min="0" max="2880" value="${esc(e.totalMin ?? '')}"></label>
      </div>
      <label class="lbl">Tags <span class="hint">mit Komma trennen</span><input class="field" id="ed-tags" value="${esc((e.tags || []).join(', '))}" placeholder="vegetarisch, schnell, Sommer"></label>
      <label class="lbl">Zutaten <span class="hint">eine pro Zeile, z. B. „200 g Mehl“. Eine Zeile mit Doppelpunkt am Ende wird zur Überschrift.</span>
        <textarea class="field" id="ed-ing" rows="8" placeholder="Für den Teig:&#10;250 g Mehl&#10;2 Eier&#10;1 Prise Salz">${esc((e.ingredients || []).map(ingLine).join('\n'))}</textarea></label>
      <label class="lbl">Zubereitung <span class="hint">ein Schritt pro Zeile. Zeiten wie „10 Min.“ werden im Kochmodus zu Timern.</span>
        <textarea class="field" id="ed-steps" rows="8">${esc((e.steps || []).join('\n'))}</textarea></label>
      <label class="lbl">Notizen<textarea class="field" id="ed-notes" rows="3">${esc(e.notes)}</textarea></label>
      <label class="lbl">Quelle <span class="hint">Buch, Person oder Link</span><input class="field" id="ed-src" value="${esc(e.source)}"></label>
    </div>
  </form>`;
  ov.hidden = false;
  setTimeout(() => $('#ed-title')?.focus(), 30);
}
function saveEditor() {
  const r = editing;
  r.title = $('#ed-title').value.trim();
  r.category = $('#ed-cat').value;
  r.servings = Math.max(1, Math.min(99, parseInt($('#ed-serv').value, 10) || 1));
  r.totalMin = parseInt($('#ed-time').value, 10) || null;
  r.tags = $('#ed-tags').value.split(',').map((s) => s.trim()).filter(Boolean);
  r.ingredients = $('#ed-ing').value.split('\n').map(parseIng).filter(Boolean);
  r.steps = $('#ed-steps').value.split('\n').map((s) => s.trim()).filter(Boolean);
  r.notes = $('#ed-notes').value.trim();
  r.source = $('#ed-src').value.trim();
  Data.putRecipe(r);
  delete S.serv[r.id];
  closeOverlay();
  S.view = 'recipes';
  S.selRecipe = r.id;
  rerender();
  toast('Rezept gesichert');
}
export function closeOverlay() {
  const ov = $('#overlay');
  ov.hidden = true;
  ov.innerHTML = '';
  editing = null;
}

export const actions = {
  'new-recipe': () => openEditor(null),
  'edit-recipe': (el) => openEditor(byId(S.recipes, el.dataset.id)),
  'open-recipe': (el) => { S.selRecipe = el.dataset.id; rerender(); if (innerWidth <= 1068) $('#main').scrollTo(0, 0); },
  'close-recipe': () => { S.selRecipe = null; rerender(); },
  cat: (el) => { S.cat = el.dataset.cat; rerender(); },
  rate: (el) => {
    const r = clone(byId(S.recipes, S.selRecipe));
    const v = +el.dataset.v;
    r.rating = r.rating === v ? 0 : v;
    Data.putRecipe(r);
    rerender();
  },
  serv: (el) => {
    const r = byId(S.recipes, el.dataset.id);
    S.serv[r.id] = Math.max(1, Math.min(99, (S.serv[r.id] || r.servings || 1) + +el.dataset.d));
    rerender();
  },
  'del-comment': (el) => { Data.delComment(el.dataset.cid); rerender(); },
  'recipe-to-shop': (el) => {
    const r = byId(S.recipes, el.dataset.id);
    const n = addToShopping(r.ingredients || [], scaleFactor(r, S.serv[r.id] || r.servings), r.title);
    rerender();
    toast(`${n} Zutaten auf der Einkaufsliste`);
  },
  'cook-recipe': (el) => startCook('recipe', el.dataset.id, S.serv[el.dataset.id]),
  'close-overlay': () => closeOverlay(),
  'log-cooked': (el) => { const r = byId(S.recipes, el.dataset.id); Data.logCooked(r, null); rerender(); toast(`${r.title}: als gekocht gezählt`); },
  'unlog-cooked': (el) => { Data.delLog(el.dataset.id); rerender(); toast('Eintrag entfernt'); },
};
export const armedActions = {
  'del-recipe': (el) => ['del-recipe-' + el.dataset.id, () => { Data.delRecipe(el.dataset.id); S.selRecipe = null; toast('Rezept gelöscht'); }],
};
export const changes = {
  sort: (el) => { S.sort = el.value; saveUi(); rerender(); },
  'add-to-menu': (el) => {
    const r = byId(S.recipes, el.dataset.id);
    if (!el.value || !r) return;
    if (el.value === '__new') {
      const m = newMenu(r);
      S.view = 'menus';
      S.selMenu = m.id;
      rerender();
      toast(`Neues Menü mit „${r.title}“`);
    } else {
      const m = clone(byId(S.menus, el.value));
      m.courses = [...(m.courses || []), { recipeId: r.id, course: guessCourse(r) }];
      Data.putMenu(m);
      rerender();
      toast(`Zu „${m.name || 'Menü'}“ hinzugefügt`);
    }
  },
};
export const inputs = {
  q: (el) => { S.q = el.value; rerender(); },
};
export const submits = {
  recipe: () => saveEditor(),
  comment: (form) => {
    const ta = $('#comment-input');
    const txt = ta.value.trim();
    if (!txt) return;
    ta.value = '';
    Data.addComment(form.dataset.id, txt);
    rerender();
    toast('Kommentar gesichert');
  },
};
