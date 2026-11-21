// Messpunkte Ladezeit (Konzept 21.11.2026, Entscheidung Eltern: alle drei Apps, Daten ins Repo, keine Anzeige).
// Ein Ladevorgang („Lauf“) beginnt mit einem Anlass (start, neu_laden, reiter, hochladen, abschicken, formelsammlung, inhalt)
// und endet, wenn die App „sichtbar“ gemeldet hat und 1,5 s lang keine Anfrage mehr lief.
// Jede Anfrage an GitHub (sync.js) wird automatisch erfasst. Nichts davon sieht das Kind.
// Kein Schlüssel, keine Kopfzeilen: nur Pfad (Kind-Ordner als ~), Zeiten, Größe, Antwort-Code.

const KEY = 'messung-v1';
const MAX_LAEUFE = 30;      // auf dem Gerät
const MAX_DETAIL = 5;       // davon mit allen Anfragen
const MAX_ANFR = 300;       // je Lauf
const LANGSAM = 20;         // langsamste Anfragen in der Datei im Repo
const RUHE_MS = 1500;       // so lange keine Anfrage → fertig
const MAX_LAUF_MS = 90000;  // spätestens dann abschließen
const HOCH_ABSTAND = 10 * 60e3;
const HOCH_WARTEN = 30e3;

const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const ursprung = () => (typeof performance !== 'undefined' && performance.timeOrigin) || (Date.now() - jetzt());
const r1 = (x) => Math.round(x);
const kb = (b) => Math.round((b || 0) / 102.4) / 10;

let APP = null;          // { app, version }
let aktivLauf = null;
let still = 0;           // > 0: Anfragen nicht messen (Hochladen der Messung selbst)
let ruheUhr = null, maxUhr = null, hochUhr = null;
let hochFn = null;       // () => { U, cfg, ordner, geraet } | null
let hochZuletzt = 0, hochLaeuft = false;
let seq = 0;

function lesen() {
  try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x && Array.isArray(x.laeufe)) return { laeufe: x.laeufe, aus: Array.isArray(x.aus) ? x.aus : [] }; } catch (e) { /* leer */ }
  return { laeufe: [], aus: [] };
}
function schreiben(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* voll: nur im Speicher */ } }

export function tagLokal(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoLokal(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), p = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return new Date(ms + off * 60000).toISOString().slice(0, 19) + (off >= 0 ? '+' : '-') + p(off / 60) + ':' + p(off % 60);
}

// Pfad aus der API-Adresse, Kind-Ordner gekürzt: daten/tobias/boegen/x → ~/boegen/x
export function pfadKurz(url) {
  let p = String(url || '');
  const i = p.indexOf('/contents/');
  if (i >= 0) p = p.slice(i + 10); else if (/\/repos\/[^/]+\/[^/?]+\/?$/.test(p)) p = 'repo'; else p = p.replace(/^https?:\/\/[^/]+\//, '');
  p = p.split('?')[0];
  try { p = decodeURIComponent(p); } catch (e) { /* so lassen */ }
  return p.replace(/^daten\/[^/]+(\/|$)/, '~$1') || 'daten';
}

export function init({ app, version }) {
  APP = { app, version };
  // Der Start-Lauf beginnt beim Öffnen der Seite (Zeitpunkt 0 des Browsers)
  if (!aktivLauf) laufAnlegen('start', 0);
  aktivLauf.etappen.push({ n: 'skript', ab: r1(jetzt()), bis: r1(jetzt()) });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden && aktivLauf) aktivLauf.gestoert = true; });
}

function laufAnlegen(anlass, t0, extra) {
  const L = { anlass, t0, sichtbar: null, gestoert: typeof document !== 'undefined' && document.hidden, etappen: [], anfragen: [], offen: 0, maxGleich: 0, letzteEnde: 0, extra: extra || null, nr: ++seq };
  aktivLauf = L;
  clearTimeout(maxUhr);
  maxUhr = setTimeout(() => abschliessen(true), MAX_LAUF_MS);
  return L;
}

export const aktiv = () => !!aktivLauf;

// Neuer Lauf, wenn gerade keiner offen ist. Gibt true zurück, wenn er angelegt wurde.
export function lauf(anlass, extra) {
  if (!APP || aktivLauf) return false;
  laufAnlegen(anlass, jetzt(), extra);
  return true;
}

// Etappe: ende = etappe('name'); … ende();
export function etappe(n) {
  const L = aktivLauf;
  if (!L) return () => {};
  const e = { n, ab: r1(jetzt() - L.t0), bis: null };
  L.etappen.push(e);
  return () => { e.bis = r1(jetzt() - L.t0); };
}

// Die App zeigt, worauf man gewartet hat (Übersicht, Code, Bilder …)
export function sichtbar() {
  const L = aktivLauf;
  if (!L) return;
  if (L.sichtbar === null) L.sichtbar = r1(jetzt() - L.t0);
  ruhePruefen();
}

function ruhePruefen() {
  clearTimeout(ruheUhr);
  const L = aktivLauf;
  if (!L || L.sichtbar === null || L.offen > 0) return;
  ruheUhr = setTimeout(() => { if (aktivLauf === L && L.offen === 0) abschliessen(false); }, RUHE_MS);
}

// ---- Anfragen (aus sync.js) ----
export function anfrageStart(url, art) {
  const L = aktivLauf;
  if (!L || still > 0) return null;
  clearTimeout(ruheUhr);
  L.offen++;
  L.maxGleich = Math.max(L.maxGleich, L.offen);
  const a = { p: pfadKurz(url), art, ab: r1(jetzt() - L.t0), warten: null, ms: null, kb: 0, quelle: 'netz', s: null, gleichzeitig: L.offen };
  if (L.anfragen.length < MAX_ANFR) L.anfragen.push(a); else L.ueberzaehlig = (L.ueberzaehlig || 0) + 1;
  const offeneEtappe = [...L.etappen].reverse().find(e => e.bis === null);
  if (offeneEtappe) a.etappe = offeneEtappe.n;
  return { L, a, t: jetzt() };
}
export function anfrageKopf(tok, status) { if (tok) { tok.a.warten = r1(jetzt() - tok.t); tok.a.s = status; } }
export function anfrageEnde(tok, bytes, fehler) {
  if (!tok) return;
  const { L, a } = tok;
  a.ms = r1(jetzt() - tok.t);
  a.kb = kb(bytes);
  if (fehler) a.s = fehler;
  if (a.warten === null) a.warten = a.ms;
  L.offen = Math.max(0, L.offen - 1);
  L.letzteEnde = Math.max(L.letzteEnde, a.ab + a.ms);
  if (L === aktivLauf) ruhePruefen();
}
// Datei kam aus dem eigenen Zwischenspeicher (z. B. alte Tagesdateien der Eltern-App)
export function speicher(pfad, bytes, ms) {
  const L = aktivLauf;
  if (!L || still > 0) return;
  const ab = r1(jetzt() - L.t0 - (ms || 0));
  const a = { p: pfadKurz(pfad), art: 'lesen', ab, warten: 0, ms: r1(ms || 0), kb: kb(bytes), quelle: 'speicher', s: 200, gleichzeitig: L.offen };
  const offeneEtappe = [...L.etappen].reverse().find(e => e.bis === null);
  if (offeneEtappe) a.etappe = offeneEtappe.n;
  if (L.anfragen.length < MAX_ANFR) L.anfragen.push(a);
}

// Seite selbst: HTML, Skripte, Stile (Angaben des Browsers, nur beim Start)
function seiteMessen() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin) && !/version\.json/.test(r.name));
    const bis = Math.max(nav ? nav.responseEnd : 0, ...res.filter(r => /\.(m?js|css|html)(\?|$)/.test(r.name)).map(r => r.responseEnd));
    return {
      html: nav ? r1(nav.responseEnd) : null,
      dom: nav ? r1(nav.domContentLoadedEventEnd) : null,
      dateien: res.length,
      netz: res.filter(r => r.transferSize > 0).length,
      kb: kb(res.reduce((s, r) => s + (r.transferSize || 0), 0)),
      bis: r1(bis),
      langsam: res.sort((a, b) => b.duration - a.duration).slice(0, 5).map(r => ({ p: r.name.slice(location.origin.length), ms: r1(r.duration), kb: kb(r.transferSize) }))
    };
  } catch (e) { return null; }
}

function netz() {
  const c = typeof navigator !== 'undefined' && navigator.connection;
  return { online: typeof navigator === 'undefined' ? null : navigator.onLine, typ: c && c.effectiveType ? c.effectiveType : null };
}

// Lauf → Eintrag für Gerät und Repo
export function zusammenfassen(L, { abgebrochen = false, seite = null, start = ursprung() } = {}) {
  const an = L.anfragen;
  const fertig = Math.max(L.letzteEnde, L.sichtbar || 0, ...L.etappen.map(e => e.bis || 0));
  const um = start + L.t0;
  const e = {
    id: `${APP ? APP.app : 'x'}-${r1(um)}`,
    anlass: L.anlass, ...(L.extra ? { zu: L.extra } : {}),
    um: isoLokal(um), tag: tagLokal(um), version: APP ? APP.version : null,
    sichtbar: L.sichtbar, fertig: r1(fertig),
    gestoert: !!L.gestoert, ...(abgebrochen ? { abgebrochen: true } : {}),
    netz: netz(),
    home: typeof window !== 'undefined' && !!(window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)),
    breite: typeof window !== 'undefined' ? window.innerWidth : null,
    summe: {
      anfragen: an.filter(a => a.quelle === 'netz').length + (L.ueberzaehlig || 0),
      speicher: an.filter(a => a.quelle === 'speicher').length,
      kb: Math.round(an.filter(a => a.quelle === 'netz').reduce((s, a) => s + a.kb, 0)),
      fehler: an.filter(a => a.quelle === 'netz' && !(a.s >= 200 && a.s < 300) && a.s !== 404).length,
      gleichzeitig: L.maxGleich
    },
    etappen: L.etappen.map(x => ({ n: x.n, ab: x.ab, bis: x.bis === null ? null : x.bis })),
    ...(seite ? { seite } : {}),
    langsam: an.filter(a => a.quelle === 'netz').slice().sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, LANGSAM)
  };
  return e;
}

function abschliessen(abgebrochen) {
  const L = aktivLauf;
  if (!L) return;
  aktivLauf = null;
  clearTimeout(ruheUhr); clearTimeout(maxUhr);
  // Leere Läufe (nichts geladen) nicht speichern
  if (!L.anfragen.length && L.anlass !== 'start') return;
  const e = zusammenfassen(L, { abgebrochen, seite: L.anlass === 'start' ? seiteMessen() : null });
  const d = lesen();
  d.laeufe.push({ ...e, alle: L.anfragen });
  d.laeufe = d.laeufe.slice(-MAX_LAEUFE).map((x, i, arr) => i < arr.length - MAX_DETAIL ? (({ alle, ...rest }) => rest)(x) : x);
  d.aus.push(e);
  d.aus = d.aus.slice(-100);
  schreiben(d);
  clearTimeout(hochUhr);
  hochUhr = setTimeout(() => hochladen(false), HOCH_WARTEN);
}

// Läufe eines Tages zusammenführen (gleiche id nur einmal, nach Zeit sortiert)
export function zusammen(alt, neu) {
  const m = new Map();
  for (const x of [...(alt || []), ...(neu || [])]) if (x && x.id) m.set(x.id, x);
  return [...m.values()].sort((a, b) => (a.um < b.um ? -1 : 1));
}

// Wer darf hochladen? Die App meldet Zugang, Kind-Ordner und Geräte-Id (oder null = nicht hochladen, z. B. Testgerät).
export function hochladenMit(fn) { hochFn = fn; }

export async function hochladen(erzwingen = false) {
  if (hochLaeuft || !hochFn) return false;
  if (!erzwingen && Date.now() - hochZuletzt < HOCH_ABSTAND && hochZuletzt) return false;
  const z = hochFn();
  if (!z || !z.U || !z.cfg || !z.cfg.token || !z.ordner || !z.geraet) return false;
  const d = lesen();
  if (!d.aus.length) return false;
  hochLaeuft = true; still++;
  try {
    const tage = {};
    for (const e of d.aus) (tage[e.tag] = tage[e.tag] || []).push(e);
    const fertig = new Set();
    for (const [tag, liste] of Object.entries(tage)) {
      const pfad = `daten/${z.ordner}/messung/${APP.app}-${z.geraet}/${tag}.json`;
      for (let v = 0; v < 2; v++) {
        const { inhalt, sha } = await z.U.dateiMitSha(z.cfg, pfad);
        const datei = { format: 'messung-1', app: APP.app, version: APP.version, geraet: z.geraet, tag, ...(z.test ? { test: true } : {}), laeufe: zusammen(inhalt && inhalt.laeufe, liste) };
        if (await z.U.dateiSchreibenWenn(z.cfg, pfad, JSON.stringify(datei, null, 1), sha, `Messung ${APP.app} ${tag}`)) { liste.forEach(e => fertig.add(e.id)); break; }
      }
    }
    const d2 = lesen();
    d2.aus = d2.aus.filter(e => !fertig.has(e.id));
    schreiben(d2);
    hochZuletzt = Date.now();
    return fertig.size > 0;
  } catch (e) { return false; }
  finally { still--; hochLaeuft = false; }
}

// Für Tests und die Auswertung auf dem Gerät
export function gespeichert() { return lesen(); }
export function _zuruecksetzen() { aktivLauf = null; APP = null; still = 0; hochZuletzt = 0; hochFn = null; clearTimeout(ruheUhr); clearTimeout(maxUhr); clearTimeout(hochUhr); }
