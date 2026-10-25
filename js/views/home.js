// Startseite: großes Foto aus der Profiküche links, Kurzprofil der gekochten Gerichte rechts.
import { S } from '../state.js';
import { esc, icon, fmtDate, CATS } from '../util.js';

// Foto: Hemant Latawa auf Unsplash (Unsplash-Lizenz), direkt von Unsplash geladen.
const PHOTO = 'https://images.unsplash.com/flagged/photo-1561350117-501b4661f8d4';
const PHOTO_PAGE = 'https://unsplash.com/photos/chef-holding-fry-pan-RKdkETvcYn4';
const AUTHOR_PAGE = 'https://unsplash.com/@hemantlatawa';
const src = (w) => `${PHOTO}?auto=format&fit=crop&q=75&w=${w}`;

function profile() {
  const log = S.log;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const byRecipe = new Map();
  for (const l of log) {
    const k = l.recipeId || l.title;
    const e = byRecipe.get(k) || { title: l.title, n: 0, last: '' };
    e.n++;
    if ((l.at || '') > e.last) e.last = l.at;
    byRecipe.set(k, e);
  }
  const byCat = new Map();
  for (const l of log) { const c = l.category || 'Sonstiges'; byCat.set(c, (byCat.get(c) || 0) + 1); }
  const cats = [...byCat].sort((a, b) => b[1] - a[1] || CATS.indexOf(a[0]) - CATS.indexOf(b[0]));
  const last = log.reduce((m, l) => ((l.at || '') > (m?.at || '') ? l : m), null);
  return {
    total: log.length,
    month: log.filter((l) => (l.at || '') >= monthStart).length,
    year: log.filter((l) => (l.at || '') >= yearStart).length,
    distinct: byRecipe.size,
    top: [...byRecipe.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 3),
    cats,
    last,
  };
}

export function viewHome() {
  const p = profile();
  const max = Math.max(1, ...p.cats.map((c) => c[1]));
  const monthName = new Date().toLocaleDateString('de-DE', { month: 'long' });
  return `<div class="view home">
    <section class="home-grid">
      <figure class="home-photo">
        <img src="${src(1600)}" srcset="${src(800)} 800w, ${src(1200)} 1200w, ${src(1600)} 1600w, ${src(2400)} 2400w"
          sizes="(max-width: 1068px) 100vw, 64vw" alt="Ein Koch mit Kochmütze flambiert in einer Profiküche, aus der Pfanne schlägt eine hohe Flamme." fetchpriority="high">
        <figcaption class="home-copy">
          <p class="eyebrow">Dein Kochbuch</p>
          <h1>Kochen wie in der Sterneküche.</h1>
          <p class="lede">Rezepte sammeln, Menüs planen und Schritt für Schritt kochen. Auf iPhone, iPad und Mac.</p>
          <div class="actions">
            <button class="pill primary" data-action="nav" data-view="cook">${icon('flame')}Jetzt kochen</button>
            <button class="link light" data-action="nav" data-view="recipes">Rezepte ansehen ›</button>
          </div>
        </figcaption>
        <span class="credit">Foto: <a href="${AUTHOR_PAGE}" target="_blank" rel="noopener">Hemant Latawa</a> / <a href="${PHOTO_PAGE}" target="_blank" rel="noopener">Unsplash</a></span>
      </figure>

      <aside class="card profile" aria-labelledby="profile-h">
        <h2 id="profile-h">Dein Kurzprofil.</h2>
        ${p.total ? `
        <div class="hero-stat">
          <span class="hero-num num">${p.total}</span>
          <span class="hero-label">${p.total === 1 ? 'Gericht' : 'Gerichte'} gekocht</span>
        </div>
        <dl class="stat-row">
          <div><dt>Im ${esc(monthName)}</dt><dd class="num">${p.month}</dd></div>
          <div><dt>Dieses Jahr</dt><dd class="num">${p.year}</dd></div>
          <div><dt>Verschiedene Rezepte</dt><dd class="num">${p.distinct}</dd></div>
        </dl>

        <h3 class="profile-h">Nach Kategorie</h3>
        <ul class="bars" aria-label="Gekochte Gerichte nach Kategorie">
          ${p.cats.map(([c, n]) => `<li title="${esc(c)}: ${n}× gekocht">
            <span class="bar-label">${esc(c)}</span>
            <span class="bar-track"><i style="width:${Math.max(4, (n / max) * 100)}%"></i></span>
            <span class="bar-val num">${n}</span>
          </li>`).join('')}
        </ul>

        <h3 class="profile-h">Am häufigsten gekocht</h3>
        <ol class="top">
          ${p.top.map((t, i) => `<li><span class="rank num">${i + 1}</span><span class="row-main"><span class="row-title">${esc(t.title)}</span><span class="row-sub">zuletzt ${esc(fmtDate(t.last))}</span></span><span class="count num">${t.n}×</span></li>`).join('')}
        </ol>
        ${p.last ? `<p class="muted small profile-foot">Zuletzt gekocht: ${esc(p.last.title)} am ${esc(fmtDate(p.last.at))}</p>` : ''}`
        : `
        <div class="hero-stat">
          <span class="hero-num num muted">0</span>
          <span class="hero-label">Gerichte gekocht</span>
        </div>
        <p class="muted">Sobald du im Kochmodus alle Schritte eines Rezepts abhakst, zählt es hier als gekocht. Du kannst ein Gericht auch im Rezept mit „Als gekocht zählen“ eintragen.</p>
        <dl class="stat-row">
          <div><dt>Rezepte</dt><dd class="num">${S.recipes.length}</dd></div>
          <div><dt>Menüs</dt><dd class="num">${S.menus.length}</dd></div>
          <div><dt>Kommentare</dt><dd class="num">${S.comments.length}</dd></div>
        </dl>
        <button class="pill primary" data-action="nav" data-view="cook">Erstes Gericht kochen</button>`}
      </aside>
    </section>
  </div>`;
}
