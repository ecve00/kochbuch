// Display wach halten (Screen Wake Lock) und Küchen-Timer.
import { $, esc, uid, toast } from './util.js';

// ---------- Display ----------

let lock = null;
let want = false;
export let wakeState = 'off'; // on | off | paused | denied | unsupported
let onChange = () => {};
export function onWakeChange(fn) { onChange = fn; }

// In der iPhone-/iPad-App übernimmt iOS das Wachhalten (isIdleTimerDisabled).
const native = window.KochbuchNative;

export async function wakeOn() {
  want = true;
  if (native) {
    native.wake(true);
    wakeState = 'on';
    onChange();
    return;
  }
  if (!('wakeLock' in navigator)) {
    wakeState = 'unsupported';
    onChange();
    toast('Dieser Browser kann das Display nicht wach halten.');
    return;
  }
  try {
    lock = await navigator.wakeLock.request('screen');
    wakeState = 'on';
    lock.addEventListener('release', () => {
      lock = null;
      if (want) wakeState = 'paused';
      onChange();
    });
  } catch {
    wakeState = 'denied';
    toast('Display-Sperre konnte nicht verhindert werden.');
  }
  onChange();
}
export function wakeOff() {
  want = false;
  wakeState = 'off';
  native?.wake(false);
  if (lock) lock.release().catch(() => {});
  lock = null;
  onChange();
}
export const wakeWanted = () => want;

// Beim Zurückkehren in die App (Tab-Wechsel, Bildschirm wieder an) erneut anfordern.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && want && !lock && !native) wakeOn();
});

// ---------- Timer ----------

let timers = [];
let audio = null;

export function startTimer(label, sec) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch {}
  timers.push({ id: uid(), label, end: Date.now() + sec * 1000, rung: false });
  renderTimers();
}
export function stopTimer(id) {
  timers = timers.filter((t) => t.id !== id);
  renderTimers();
}

function beep() {
  if (!audio) return;
  try {
    for (let k = 0; k < 3; k++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(audio.destination);
      const t = audio.currentTime + k * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t);
      o.stop(t + 0.3);
    }
  } catch {}
}

function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
}

export function timersHtml() {
  return timers.map((t) => {
    const left = t.end - Date.now();
    return `<span class="timer${left <= 0 ? ' ring' : ''}" data-timer="${t.id}">${esc(t.label)} <b class="left">${left <= 0 ? 'Fertig' : fmtLeft(left)}</b><button data-action="timer-stop" data-id="${t.id}" aria-label="Timer beenden">×</button></span>`;
  }).join('');
}
export function renderTimers() {
  document.querySelectorAll('[data-timers]').forEach((el) => { el.innerHTML = timersHtml(); el.hidden = !timers.length; });
}

setInterval(() => {
  if (!timers.length) return;
  let rang = false;
  for (const t of timers) {
    if (!t.rung && t.end <= Date.now()) {
      t.rung = rang = true;
      beep();
      toast('Timer fertig: ' + t.label);
      navigator.vibrate?.([200, 100, 200]);
    }
  }
  if (rang) { renderTimers(); return; }
  for (const t of timers) {
    document.querySelectorAll(`[data-timer="${t.id}"] .left`).forEach((b) => { if (!t.rung) b.textContent = fmtLeft(t.end - Date.now()); });
  }
}, 1000);
