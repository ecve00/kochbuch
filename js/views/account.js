// Anmeldung, Konto, Sync-Status, Installation auf Mac und iPad, Sicherung und Import.
import { S, rerender, exportData, importData } from '../state.js';
import { $, esc, icon, toast } from '../util.js';

let store = null;
export function setAccountStore(s) { store = s; }

// ---------- Anmeldung ----------

let authMode = 'signin'; // signin | signup | reset | recovery
let authMsg = '';
export function setRecoveryMode() { authMode = 'recovery'; authMsg = ''; }
export const inRecovery = () => authMode === 'recovery';

export function viewAuth() {
  const titles = { signin: 'Anmelden.', signup: 'Konto erstellen.', reset: 'Passwort vergessen.', recovery: 'Neues Passwort.' };
  const ledes = {
    signin: 'Deine Rezepte auf iPhone, iPad und Mac. Immer auf dem gleichen Stand.',
    signup: 'Ein Konto für alle deine Geräte.',
    reset: 'Wir schicken dir einen Link, mit dem du ein neues Passwort setzt.',
    recovery: 'Wähle ein neues Passwort für dein Konto.',
  };
  return `<div class="auth">
    <div class="auth-mark">${icon('logo')}</div>
    <h1>${titles[authMode]}</h1>
    <p class="lede">${ledes[authMode]}</p>
    <form class="auth-form" data-form="auth">
      ${authMode !== 'recovery' ? '<input class="field" id="auth-email" type="email" autocomplete="username" placeholder="E-Mail-Adresse" required>' : ''}
      ${authMode !== 'reset' ? `<input class="field" id="auth-pw" type="password" autocomplete="${authMode === 'signin' ? 'current-password' : 'new-password'}" placeholder="Passwort" minlength="${authMode === 'signin' ? 1 : 8}" required>` : ''}
      <button class="pill primary wide" type="submit">${{ signin: 'Anmelden', signup: 'Konto erstellen', reset: 'Link senden', recovery: 'Passwort sichern' }[authMode]}</button>
    </form>
    ${authMsg ? `<p class="auth-msg">${esc(authMsg)}</p>` : ''}
    <p class="auth-links">
      ${authMode === 'signin' ? '<button class="link" data-action="auth-mode" data-mode="signup">Konto erstellen ›</button><button class="link" data-action="auth-mode" data-mode="reset">Passwort vergessen?</button>' : ''}
      ${authMode === 'signup' || authMode === 'reset' ? '<button class="link" data-action="auth-mode" data-mode="signin">Zur Anmeldung ›</button>' : ''}
    </p>
  </div>`;
}

async function submitAuth() {
  const email = $('#auth-email')?.value.trim();
  const pw = $('#auth-pw')?.value;
  const btn = $('.auth-form button[type=submit]');
  btn.disabled = true;
  try {
    if (authMode === 'signin') {
      await store.signIn(email, pw);
    } else if (authMode === 'signup') {
      const res = await store.signUp(email, pw);
      if (res.needsConfirmation) { authMode = 'signin'; authMsg = 'Fast geschafft. Bestätige deine E-Mail-Adresse über den Link in der Mail und melde dich dann hier an.'; }
    } else if (authMode === 'reset') {
      await store.resetPassword(email);
      authMode = 'signin';
      authMsg = 'Wenn ein Konto zu dieser Adresse existiert, ist der Link unterwegs.';
    } else if (authMode === 'recovery') {
      await store.updatePassword(pw);
      authMode = 'signin';
      authMsg = '';
      toast('Neues Passwort gesichert');
      location.hash = '';
      location.reload();
      return;
    }
  } catch (e) {
    const m = e.message || '';
    authMsg = /invalid login/i.test(m) ? 'E-Mail-Adresse oder Passwort stimmen nicht.'
      : /not confirmed/i.test(m) ? 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Mail.'
      : /already registered/i.test(m) ? 'Zu dieser Adresse gibt es schon ein Konto. Melde dich an.'
      : /password/i.test(m) ? 'Das Passwort muss mindestens 8 Zeichen lang sein.'
      : 'Das hat nicht geklappt: ' + m;
  }
  rerender();
}

// ---------- Konto ----------

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

export function viewAccount() {
  const demo = S.mode === 'demo';
  const here = window.KochbuchNative ? 'diesem Gerät' : 'diesem Browser';
  const sync = demo ? `Nur auf ${here} gespeichert`
    : S.pending ? `${S.pending} Änderung${S.pending > 1 ? 'en' : ''} warten auf Verbindung`
    : S.offline ? 'Offline. Du siehst den zuletzt geladenen Stand.' : 'Alles synchronisiert';
  return `<div class="view narrow">
    <header class="hero"><div><h1>Konto.</h1><p class="lede">${demo ? 'Demo-Modus.' : esc(S.session?.user?.email || '')}</p></div></header>
    <ul class="group">
      <li class="row static"><span class="row-main"><span class="row-title">Speicherort</span><span class="row-sub">${demo ? (window.KochbuchNative ? 'Dieses Gerät' : 'Dieser Browser (localStorage)') : 'Supabase-Datenbank'}</span></span></li>
      <li class="row static"><span class="row-main"><span class="row-title">Status</span><span class="row-sub">${esc(sync)}</span></span><span class="status-dot ${demo ? '' : S.pending || S.offline ? 'warn' : 'ok'}"></span></li>
      <li class="row static"><span class="row-main"><span class="row-title">Inhalt</span><span class="row-sub num">${S.recipes.length} Rezepte · ${S.menus.length} Menüs · ${S.comments.length} Kommentare</span></span></li>
    </ul>
    ${demo ? `<div class="card note-card"><h3>Mit Supabase verbinden</h3><p>Trage die Projekt-URL und den anon-Schlüssel in <code>js/config.js</code> ein. Dann teilen sich iPhone, iPad und Mac dieselben Daten. Die Anleitung steht in der README.</p></div>` : ''}

    ${window.KochbuchNative ? '' : `<h3 class="spaced">Als App installieren</h3>
    ${isStandalone() ? '<p class="muted">Läuft bereits als installierte App.</p>' : ''}
    <div class="tiles two">
      <div class="tile static"><span class="eyebrow">iPad</span><span class="tile-title">Zum Home-Bildschirm</span><span class="tile-sub">In Safari auf Teilen tippen, dann „Zum Home-Bildschirm“.</span></div>
      <div class="tile static"><span class="eyebrow">Mac</span><span class="tile-title">Zum Dock hinzufügen</span><span class="tile-sub">In Safari im Menü Ablage „Zum Dock hinzufügen …“ wählen.</span></div>
    </div>`}

    <h3 class="spaced">Sicherung</h3>
    <ul class="group">
      <li><button class="row" data-action="export">${icon('copy')}<span class="row-main"><span class="row-title">Sicherung herunterladen</span><span class="row-sub">Alle Rezepte, Kommentare, Menüs und die Einkaufsliste als JSON-Datei</span></span><span class="chev">${icon('chevron')}</span></button></li>
      <li><label class="row" for="import-file">${icon('plus')}<span class="row-main"><span class="row-title">Sicherung importieren</span><span class="row-sub">Fügt Rezepte und Menüs aus einer JSON-Datei hinzu, bestehende bleiben erhalten</span></span><span class="chev">${icon('chevron')}</span></label>
        <input type="file" id="import-file" accept="application/json,.json" data-change="import" hidden></li>
    </ul>
    ${demo ? '' : `<p class="center"><button class="pill" data-action="sign-out">Abmelden</button></p>`}
  </div>`;
}

export const actions = {
  'auth-mode': (el) => { authMode = el.dataset.mode; authMsg = ''; rerender(); },
  export: () => {
    const json = JSON.stringify(exportData(), null, 2);
    const name = `kochbuch-${new Date().toISOString().slice(0, 10)}.json`;
    // In der iPhone-/iPad-App: iOS-Teilen-Menü (sichern in Dateien, AirDrop, Mail …).
    if (window.KochbuchNative?.share) { window.KochbuchNative.share(name, json); return; }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  'sign-out': async () => { await store.signOut(); location.reload(); },
};
export const changes = {
  import: async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const n = importData(json);
      toast(`${n.recipes} Rezepte und ${n.menus} Menüs importiert`);
      rerender();
    } catch {
      toast('Die Datei ist keine gültige Kochbuch-Sicherung.');
    }
    el.value = '';
  },
};
export const submits = { auth: () => submitAuth() };
