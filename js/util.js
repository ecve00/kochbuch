// Gemeinsame Helfer: Konstanten, Formatierung, Zutaten-Parser, Icons, Toast.

export const CATS = ['Vorspeise', 'Suppe', 'Salat', 'Hauptgericht', 'Beilage', 'Dessert', 'Backen', 'Frühstück', 'Getränk', 'Sonstiges'];
export const COURSES = ['Aperitif', 'Vorspeise', 'Suppe', 'Zwischengang', 'Hauptgang', 'Beilage', 'Dessert', 'Käse'];
const UNITS = ['g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l', 'EL', 'TL', 'Msp', 'Prise', 'Prisen', 'Stk', 'Stück', 'Bund', 'Dose', 'Dosen', 'Pck', 'Päckchen', 'Becher', 'Zehe', 'Zehen', 'Scheibe', 'Scheiben', 'Tasse', 'Tassen', 'Glas', 'Handvoll', 'Zweig', 'Zweige', 'Blatt', 'Kopf', 'Stange', 'Stangen'];
const UNIT_NORM = { stück: 'Stk', stk: 'Stk', zehen: 'Zehe', scheiben: 'Scheibe', dosen: 'Dose', päckchen: 'Pck', prisen: 'Prise', tassen: 'Tasse', zweige: 'Zweig', stangen: 'Stange' };
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const now = () => new Date().toISOString();
export const byId = (arr, id) => arr.find((x) => x.id === id);

export function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
}
export function fmtDateTime(d) {
  try { return new Date(d).toLocaleString('de-DE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Zutaten ----------

function parseQty(tok) {
  if (!tok) return null;
  if (FRAC[tok] != null) return FRAC[tok];
  let m = tok.match(/^(\d+)([½¼¾⅓⅔])$/);
  if (m) return +m[1] + FRAC[m[2]];
  m = tok.match(/^(\d+)\/(\d+)$/);
  if (m) return +m[2] ? +m[1] / +m[2] : null;
  if (/^\d+(?:[.,]\d+)?$/.test(tok)) return parseFloat(tok.replace(',', '.'));
  return null;
}

// "200 g Mehl" → {qty: 200, unit: "g", name: "Mehl"}; "Für die Sauce:" → Überschrift.
export function parseIng(line) {
  const s = line.trim();
  if (!s) return null;
  if (/:$/.test(s)) return { section: true, name: s.slice(0, -1).trim() };
  const parts = s.split(/\s+/);
  let qty = parseQty(parts[0]);
  let i = qty != null ? 1 : 0;
  if (qty != null && parts[1] && FRAC[parts[1]] != null) { qty += FRAC[parts[1]]; i++; }
  let unit = '';
  if (parts[i]) {
    const cand = parts[i].replace(/\.$/, '');
    const hit = UNITS.find((u) => u.toLowerCase() === cand.toLowerCase());
    if (hit && parts.length > i + 1) { unit = hit; i++; }
  }
  return { qty, unit, name: parts.slice(i).join(' ') };
}

export function fmtQty(n) {
  if (n == null || isNaN(n)) return '';
  const r = n >= 100 ? Math.round(n / 5) * 5 : n >= 10 ? Math.round(n) : Math.round(n * 100) / 100;
  const whole = Math.floor(r);
  const sym = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' }[Math.round((r - whole) * 100) / 100];
  if (sym && r < 10) return (whole || '') + sym;
  return r.toLocaleString('de-DE', { maximumFractionDigits: r < 1 ? 2 : 1 });
}

export const ingLine = (i) => (i.section ? i.name + ':' : [fmtQty(i.qty), i.unit, i.name].filter(Boolean).join(' '));
export const qtyText = (i, f = 1) => [fmtQty(i.qty != null ? i.qty * f : null), i.unit].filter(Boolean).join(' ');
export const scaleFactor = (r, servings) => (r.servings && servings ? servings / r.servings : 1);
export const normUnit = (u) => UNIT_NORM[(u || '').toLowerCase()] || u || '';
export const shopKey = (name, unit) => name.trim().toLowerCase() + '|' + normUnit(unit).toLowerCase();

// Zeitangaben in einem Schritt ("18–20 Minuten", "1 Std.") → Timer-Vorschläge.
export function timersIn(text) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(Minuten|Minute|Min\.?|Std\.?|Stunden|Stunde|Sek\.?|Sekunden)(?![a-zäöü])/gi;
  let m;
  while ((m = re.exec(text))) {
    const v = parseFloat((m[2] || m[1]).replace(',', '.'));
    const u = m[3].toLowerCase();
    const sec = u.startsWith('st') ? v * 3600 : u.startsWith('sek') ? v : v * 60;
    if (sec > 0 && sec <= 86400) out.push({ label: m[0].trim(), sec });
  }
  return out;
}

// ---------- Icons ----------

const I = {
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5"/><path d="M5 4.5v15A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
  home: '<path d="M4 10.5L12 4l8 6.5"/><path d="M6 9v10.5h4.5V15h3v4.5H18V9"/>',
  plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2.3 2.5C10.5 8.5 11 5.5 12 3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9z"/>',
};
// Logo: Kochmesser schneidet durch eine Zwiebel. Gefüllte Form; die Maske spart Messer und Zwiebelschichten aus.
const LOGO = `<defs><g id="kb-knife"><path d="M0 0L21-2.2V6.2C12.5 6.2 5.5 4.2 0 0Z"/><rect x="22.2" y="-1.6" width="10" height="5.2" rx="2.6"/></g>
<mask id="kb-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/>
<path d="M17 20C13 23 11.5 27.5 11.5 32S13 40.5 17 43.2M17 20c4 3 5.5 7.5 5.5 12s-1.5 8.5-5.5 11.2" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"/>
<use href="#kb-knife" transform="translate(13 31) rotate(-30)" fill="#000" stroke="#000" stroke-width="5" stroke-linejoin="round"/></mask></defs>
<path mask="url(#kb-cut)" d="M17 13.5C18 18 29 21 29 32A12 12 0 0 1 5 32C5 21 16 18 17 13.5Z"/>
<path d="M17 14V9.5c0-2 1.5-3.4 3.6-3.6M33 33.5c2 1.8 3 4.3 2.6 7.2M38.4 32c2 2 3 4.6 2.6 7.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
<use href="#kb-knife" transform="translate(13 31) rotate(-30)"/>`;
const logo = () => `<svg class="logo" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">${LOGO}</svg>`;

export const icon = (n, fill) => n === 'logo' ? logo() :
  `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${fill ? 0 : 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

export function starsHtml(v, interactive, small) {
  let h = `<span class="stars${small ? ' small' : ''}" ${interactive ? 'role="group" aria-label="Bewertung"' : `aria-label="${v || 0} von 5 Sternen"`}>`;
  for (let n = 1; n <= 5; n++) {
    h += interactive
      ? `<button class="star${n <= v ? ' on' : ''}" data-action="rate" data-v="${n}" aria-label="${n} Stern${n > 1 ? 'e' : ''}">${icon('star', true)}</button>`
      : `<span class="star${n <= v ? ' on' : ''}">${icon('star', true)}</span>`;
  }
  return h + '</span>';
}
