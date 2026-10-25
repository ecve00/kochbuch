// Einkaufsliste: aus Menüs und Rezepten befüllen, abhaken, als Text kopieren.
import { S, Data, rerender, addToShopping } from '../state.js';
import { $, esc, icon, qtyText, parseIng, toast } from '../util.js';

export const openShopCount = () => S.shopping.filter((i) => !i.done).length;

export function viewShopping() {
  const byName = (a, b) => a.name.localeCompare(b.name, 'de');
  const open = S.shopping.filter((i) => !i.done).sort(byName);
  const done = S.shopping.filter((i) => i.done).sort(byName);
  const armed = S.armed === 'shop-clear';
  const row = (i) => `<li><button class="shop-row${i.done ? ' done' : ''}" data-action="shop-toggle" data-id="${i.id}" aria-pressed="${!!i.done}">
      <span class="tick">${icon('check')}</span>
      <span class="row-main"><span class="row-title">${esc(i.name)}</span>${(i.from || []).length ? `<span class="row-sub">${esc(i.from.join(', '))}</span>` : ''}</span>
      <span class="q num">${esc(qtyText(i))}</span></button></li>`;
  return `<div class="view narrow">
    <header class="hero">
      <div><h1>Einkaufsliste.</h1><p class="lede">${open.length ? `${open.length} Artikel offen${done.length ? `, ${done.length} erledigt` : ''}.` : 'Alles da, was du brauchst.'}</p></div>
      ${open.length ? `<button class="pill" data-action="shop-copy">${icon('copy')}Als Text kopieren</button>` : ''}
    </header>
    <form class="add-row" data-form="shop-add">
      <input class="field" id="shop-new" placeholder="Hinzufügen, z. B. „1 l Milch“" autocomplete="off" enterkeyhint="done">
      <button class="pill primary" type="submit">Hinzufügen</button>
    </form>
    ${S.menus.length ? `<div class="chips"><span class="muted small">Aus Menü übernehmen:</span>${S.menus.map((m) => `<button class="chip" data-action="menu-to-shop" data-id="${m.id}">${esc(m.name || 'Menü')}</button>`).join('')}</div>` : ''}
    ${open.length ? `<ul class="group">${open.map(row).join('')}</ul>` : `<div class="card empty"><h2>${S.shopping.length ? 'Alles eingekauft.' : 'Die Liste ist leer.'}</h2><p>Füge oben Artikel hinzu oder übernimm die Zutaten aus einem Menü oder Rezept.</p></div>`}
    ${done.length ? `<div class="sec-head spaced"><h3>Erledigt</h3><button class="link" data-action="shop-clear-done">Erledigte entfernen</button></div><ul class="group">${done.map(row).join('')}</ul>` : ''}
    ${S.shopping.length ? `<p class="center"><button class="link danger${armed ? ' armed' : ''}" data-action="shop-clear">${armed ? 'Wirklich die ganze Liste löschen?' : 'Ganze Liste löschen'}</button></p>` : ''}
  </div>`;
}

function fallbackCopy(txt) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="sheet small"><div class="sheet-head"><span></span><h2>Liste kopieren</h2><button class="link strong" data-action="close-overlay">Fertig</button></div><div class="sheet-body"><textarea class="field" id="copy-area" rows="12" readonly>${esc(txt)}</textarea></div></div>`;
  ov.hidden = false;
  const ta = $('#copy-area');
  ta.focus();
  ta.select();
}

export const actions = {
  'shop-toggle': (el) => {
    const it = S.shopping.find((x) => x.id === el.dataset.id);
    if (it) { Data.putShopItem({ ...it, done: !it.done }); rerender(); }
  },
  'shop-clear-done': () => { Data.delShopItems(S.shopping.filter((x) => x.done).map((x) => x.id)); rerender(); },
  'shop-copy': () => {
    const txt = S.shopping.filter((i) => !i.done).map((i) => '• ' + [qtyText(i), i.name].filter(Boolean).join(' ')).join('\n');
    const ok = () => toast('Kopiert. Zum Beispiel in Erinnerungen einfügen.');
    try { navigator.clipboard.writeText(txt).then(ok, () => fallbackCopy(txt)); } catch { fallbackCopy(txt); }
  },
};
export const armedActions = {
  'shop-clear': () => ['shop-clear', () => Data.delShopItems(S.shopping.map((x) => x.id))],
};
export const submits = {
  'shop-add': () => {
    const inp = $('#shop-new');
    const parsed = inp.value.split(/[,;\n]/).map(parseIng).filter((x) => x && !x.section);
    if (!parsed.length) return;
    addToShopping(parsed, 1, '');
    inp.value = '';
    rerender();
    $('#shop-new')?.focus();
  },
};
