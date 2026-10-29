// Bildschirme und Ablauf der Übungsapp.
import * as L from './logic.js';
import * as G from './gen.js';
import * as U from './sync.js';
import * as FU from './formeluebersicht.js';
import { esc, mathe, bruchHtml, bildSvg, linienSvg, hinweisIcon, hinweisBlatt, formatWert, sechseck, stellentafelHtml } from './render.js';
import * as GF from './gefaerbt.js';
import { THEMA_NAMEN, GEN_NAMEN, FEHLER_NAMEN } from './namen.js';
import * as P from './paket.js';
import * as B from './bloecke.js';
import { einrichtungLesen } from './einrichtung.js';
import { kristallmineStarten } from './kristallmine-ui.js';
import { steinschieberStarten } from './steinschieber-ui.js';
import { runenfallStarten } from './runenfall-ui.js';
import { runenreihenStarten } from './runenreihen-ui.js';
import { hoehlenkarteStarten } from './hoehlenkarte-ui.js';
import { runenbrecherStarten } from './runenbrecher-ui.js';
import { jadeschlangeStarten } from './jadeschlange-ui.js';
import * as SP from './splitter.js';
import * as BS from './bildschirm.js';
import * as LP from './lernplan.js';
import * as W from './wochenplan.js';
import { bildschirmBild } from './bildschirm-bild.js';
import { uebungszeitBild } from './uebungszeit-bild.js';
import * as PH from './physik.js';
import * as SZ from './sternzeit.js';
import * as UF from './umformen.js';
import * as FB from './feedback.js';
import { ANLEITUNGEN } from './anleitungen.js';
import { spielVorschau } from './spielbilder.js';
import { spielstandAus, spielstandKern, spielstandAnwenden, istFrisch } from './store.js';
import { laden, speichern, protokoll, protokollBeobachten, tagAktualisieren, dauerhaftSpeichernAnfragen, hatSpeicherFehler } from './store.js';

export const APP_VERSION = '2.35.1';

const S = laden();
// Wurde die App mitten in einer Aufgabe beendet? Dann wartet diese Aufgabe.
if (S.laufend) { if (!S.wartet) S.wartet = S.laufend; S.laufend = null; }
let HINWEISE = [], HMAP = {}, BASIS_AUFGABEN = [], BASIS_IDS = new Set(), FORMELN = null, LOGBUCH = [], ARCHIV = [];
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');

let ansicht = 'start';
let km = null;               // laufende Kristallmine (wird bei jedem Bildschirmwechsel beendet und gespeichert)
let ss = null;               // laufender Steinschieber (ebenso)
let rn = null;               // laufender Runenfall (ebenso)
let ms = null;               // laufendes Modul-Spiel { id, spiel } (Runenreihen, Höhlenkarte, Runenbrecher, Jadeschlange)
function setzeAnsicht(name) {
  feedbackKnopfZeigen();
  if (km) { const k = km; km = null; k.beenden(); }
  if (ss) { const k = ss; ss = null; k.beenden(); }
  if (rn) { const k = rn; rn = null; k.beenden(); }
  if (ms) { const k = ms.spiel; ms = null; k.beenden(); }
  ansicht = name; document.body.dataset.ansicht = name;
  // Gestaltung „Logbuch Sternzeit“: nur der Rahmen der App (Start, Aufgaben, Logbuch); Spiele und Elternbereich bleiben
  document.body.classList.toggle('sz', sternzeit() && SZ_ANSICHTEN.includes(name));
  document.title = sternzeit() ? appName() : 'Schrein der Zahlen';
}
const sternzeit = () => S.gestaltung === 'sternzeit';
const SZ_ANSICHTEN = ['start', 'aufgabe', 'wahl', 'logbuch', 'archiv', 'uebungszeit', 'bildschirm', 'logbuchNeu'];
const appName = () => S.ansichtName || 'Logbuch Sternzeit';
const sternzeitJetzt = () => PH.sternzeitText(PH.sternzeit(new Date()));
function szKopf() {
  const n = appName();
  const i = n.indexOf(' ');
  const titel = i > 0 ? `${esc(n.slice(0, i))}<br> ${esc(n.slice(i + 1))}` : esc(n);
  return `<div class="sz-kopf"><div class="sz-ellbogen"></div><div class="sz-titelzeile"><div class="sz-titel">${titel}</div><div class="sz-zeit">Sternzeit<b>${sternzeitJetzt()}</b></div></div><div class="sz-leiste"><i></i><i></i><i></i></div></div>`;
}
let A = null;                // aktive Aufgabe
let modalSchliessen = null;  // Callback beim Schließen
let spielSitzung = null;     // { start, sekunden }
let versteckt = null;        // Zeitpunkt, an dem die App verlassen wurde


// Bedienung pro Kind (Eltern-App „Gestaltung, Bedienung und Übungszeit“)
const bed = (k) => L.bedienung(S.einstellungen, k);
// Taschenrechner ohne Abzug: wie Rechner-Anteil 1
const R = () => { const r = L.spielzeitRegeln(S.spielzeit); return bed('rechner_frei') ? { ...r, rechner: 1 } : r; };
const minText = m => `${String(m).replace('.', ',')} ${m === 1 ? 'Minute' : 'Minuten'}`;
const alleAufgaben = () => [...BASIS_AUFGABEN, ...S.extraAufgaben];
const sichern = () => speichern(S);
// Runensplitter: kleiner leuchtender Jade-Splitter
const splitterSymbol = (size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" class="splitter-symbol"><polygon points="12,2 18,9 14,22 7,13" fill="#7ff2c6" stroke="#1E7A5F" stroke-width="1.4" stroke-linejoin="round"/><polygon points="12,2 14,22 7,13" fill="#3fbf92" opacity=".75"/><path d="M12 2 L13 12" stroke="#E9FFF6" stroke-width="1" opacity=".8"/></svg>`;
const zeitSymbol = (size = 22) => sechseck(size, '#F5E6C6', '#9A5B06', '<path d="M12 7v5l3 2" stroke="#633806" stroke-width="1.8" fill="none" stroke-linecap="round"/>');

// ---------- Bildschirmzeit (Konsole, Computer, Videos außerhalb der App) ----------
const BZ = () => BS.bzRegeln(S.bzRegeln);
const bzKonto = () => (S.bildschirm = BS.kontoVon(S.bildschirm, L.tagKey()));
let zweck = null;            // wofür in dieser Runde geübt wird: 'spiel' | 'bild' (Frage vor der ersten Aufgabe)
const istBild = () => zweck === 'bild' && BZ().an;
// Zeit (Spielzeit oder Bildschirmzeit) in der Aufgabe zeigen? Ohne Spielzeit nur, wenn für Bildschirmzeit geübt wird.
const zeitZeigen = () => bed('spielzeit_zeigen') || istBild();
// „Ab 15 Min. kannst du abschicken. Noch 3 Min.“
const abText = (k) => `Ab ${BS.minText(BS.abSek(BZ()))} kannst du abschicken. Noch ${BS.minText(BS.abSek(BZ()) - k.stand)}`;
// Eigene, neutrale Zeichnungen (keine Marken-Logos)
const konsoleSymbol = (h) => `<svg width="${Math.round(h * 1.6)}" height="${h}" viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="4" width="14" height="32" rx="7" fill="#5B6B8C"/><rect x="48" y="4" width="14" height="32" rx="7" fill="#5B6B8C"/><rect x="15" y="5" width="34" height="30" rx="3" fill="#1E2A3E"/><rect x="18" y="8" width="28" height="24" rx="1.5" fill="#6C8CCB"/><circle cx="9" cy="14" r="3" fill="#1E2A3E"/><circle cx="55" cy="24" r="3" fill="#1E2A3E"/><circle cx="55" cy="12" r="1.6" fill="#E3EAF7"/><circle cx="58" cy="15" r="1.6" fill="#E3EAF7"/><circle cx="52" cy="15" r="1.6" fill="#E3EAF7"/><path d="M7 26h4M9 24v4" stroke="#E3EAF7" stroke-width="1.6"/></svg>`;
const computerSymbol = (h) => `<svg width="${Math.round(h * 1.2)}" height="${h}" viewBox="0 0 48 40" aria-hidden="true"><rect x="3" y="3" width="42" height="27" rx="3" fill="#1E2A3E"/><rect x="6" y="6" width="36" height="21" rx="1" fill="#8FB0E6"/><path d="M9 22l7-7 5 5 6-8 9 10" stroke="#2F4F8F" stroke-width="2" fill="none"/><rect x="20" y="30" width="8" height="5" fill="#5B6B8C"/><rect x="13" y="35" width="22" height="3" rx="1.5" fill="#5B6B8C"/></svg>`;
const videoSymbol = (h) => `<svg width="${h}" height="${h}" viewBox="0 0 40 40" aria-hidden="true" class="video-symbol"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#2F4F8F" stroke-width="2.5"/><path d="M16 12l12 8-12 8z" fill="#2F4F8F"/></svg>`;
const kopfSymbol = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#F5E6C6" stroke-width="1.8" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/><path d="M3 3l18 18" stroke="#E9B65A" stroke-width="2.2"/></svg>`;
const vorschauKlein = (id, px) => `<span class="wk-spiel">${spielVorschau(id, Math.round(px))}</span>`;
const schreinIcons = () => `${vorschauKlein('2048', 60)}${vorschauKlein('kristallmine', 60)}${zeitSymbol(56)}${vorschauKlein('runenfall', 60)}`;
const schreinMini = () => `${vorschauKlein('2048', 40)}${zeitSymbol(34)}${vorschauKlein('kristallmine', 40)}`;
const bildIcons = (g = 1) => `${konsoleSymbol(Math.round(44 * g))}${computerSymbol(Math.round(48 * g))}${videoSymbol(Math.round(46 * g))}`;

// ============ Start ============

export async function starten() {
  try {
    const [h, a] = await Promise.all([
      fetch('data/hinweise.json').then(r => r.json()),
      fetch('data/aufgaben.json').then(r => r.json())
    ]);
    HINWEISE = h.hinweise;
    HINWEISE.forEach(x => { HMAP[x.id] = x; });
    BASIS_AUFGABEN = a.aufgaben;
    BASIS_IDS = new Set(a.aufgaben.map(x => x.id));
    // Formelübersicht für die Kurz-Hinweise; fehlt sie, gibt es wie früher gleich den langen Hinweis
    FORMELN = await fetch('data/formeluebersicht.json').then(r => r.json()).catch(() => null);
    // Logbuch und Wissensarchiv (Gestaltung Sternzeit); fehlen sie, bleiben die Bereiche leer
    const [lb, wa] = await Promise.all([
      fetch('data/logbuch.json').then(r => r.json()).catch(() => null),
      fetch('data/wissensarchiv.json').then(r => r.json()).catch(() => null)
    ]);
    LOGBUCH = (lb && lb.eintraege) || [];
    ARCHIV = (wa && wa.eintraege) || [];
  } catch (e) {
    $app.innerHTML = `<div class="screen"><div class="karte"><p>Die Aufgaben konnten nicht geladen werden. Schau, ob das Internet an ist, und öffne die App noch einmal.</p></div></div>`;
    return;
  }
  dauerhaftSpeichernAnfragen();
  updateEinrichten();
  document.addEventListener('click', klick);
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'fb-foto') feedbackFoto(e.target); });
  feedbackKnopfZeigen();
  // Testgerät: Bereich für „Gezielt testen“ gewählt → Übersicht der Stufen aktualisieren
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 't-thema') {
      S.testFokusEntwurf = e.target.value;
      // Gezielt testen ist an: neuer Bereich gilt sofort (Stufe bleibt)
      if (testFokus()) { S.testFokus = { thema: e.target.value, stufe: testFokus().stufe }; protokoll(S, 'test_fokus', S.testFokus); sichern(); }
      zeigeEltern();
    }
  });
  document.addEventListener('visibilitychange', sichtbarkeit);
  document.addEventListener('keydown', taste);
  setInterval(spielTick, 1000);
  setInterval(uebungTick, 5000);
  setInterval(() => { if (ansicht === 'start') zeigeStart(); }, 30000);
  // Einrichtungs-Link aus dem QR-Code (Kamera-App) geöffnet?
  const ausLinkRoh = einrichtungLesen(location.hash);
  const ausLink = ausLinkRoh && ausLinkRoh.art === 'kind' ? ausLinkRoh : null;
  if (location.hash.includes('einrichten=')) history.replaceState(null, '', location.pathname + location.search);
  zeigeStart();
  if (ausLink) einrichten(ausLink, 'link');
}

// ============ Einrichtung per QR-Code ============

let scanner = null; // { stream, laeuft }

// Repo, Schlüssel und (bei frischem Handy) Name übernehmen. Danach kommt der Spielstand vom Server.
async function einrichten(d, quelle) {
  const nameNeu = d.name && d.name !== S.einstellungen.name ? d.name : '';
  if (nameNeu && S.einstellungen.name && quelle !== 'bestaetigt') {
    oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Anderer Name</h2>
      <p>Dieses Handy ist für <b>${esc(S.einstellungen.name)}</b> eingerichtet. Der Code ist für <b>${esc(d.name)}</b>.</p>
      <p>Umstellen auf ${esc(d.name)}?</p>
      <div class="knopf-reihe"><button class="btn btn-haupt" data-act="einrichtenNameJa">Umstellen</button><button class="btn" data-act="modalZu">Abbrechen</button></div></div>`);
    einrichtenWartet = d;
    return;
  }
  oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Einrichten …</h2><p>Die Verbindung wird geprüft.</p></div>`);
  try {
    const info = await U.verbindungTesten({ repo: d.repo, token: d.token });
    if (!info.privat) throw new Error('Das Daten-Repo ist öffentlich. Bitte nur ein privates Repo verwenden.');
  } catch (e) {
    oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Das hat nicht geklappt</h2><p>${esc(e.message || 'Verbindung nicht möglich.')}</p><button class="btn btn-haupt" data-act="modalZu">OK</button></div>`);
    return;
  }
  if (nameNeu) {
    if (S.einstellungen.name) protokoll(S, 'name_geaendert', { von: S.einstellungen.name, nach: nameNeu });
    S.einstellungen.name = nameNeu;
  }
  S.upload = { ...S.upload, repo: d.repo, token: d.token, fehler: null, tage: {}, standGeprueft: false, standKern: null, standRev: 0, standWartet: false };
  protokoll(S, 'einrichtung_qr', { repo: d.repo, quelle });
  sichern();
  schliesseModal();
  zeigeStart();
  oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Eingerichtet</h2><p>Hallo${S.einstellungen.name ? ', ' + esc(S.einstellungen.name) : ''}! Deine Daten werden jetzt gesichert.</p><button class="btn btn-haupt" data-act="modalZu">Weiter</button></div>`);
  if (S.upload.testgeraet) return;
  await syncen(true); // holt einen vorhandenen Spielstand vom Server („Willkommen zurück“)
}
let einrichtenWartet = null;

function scannerStoppen() {
  if (scanner && scanner.stream) scanner.stream.getTracks().forEach(t => t.stop());
  scanner = null;
}

function jsqrLaden() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return new Promise((ok, fehler) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/jsQR.js';
    sc.onload = () => ok(window.jsQR);
    sc.onerror = () => fehler(new Error('Der QR-Leser konnte nicht geladen werden. Ist das Internet an?'));
    document.head.appendChild(sc);
  });
}

async function qrScannen() {
  oeffneModal(`<div class="scan-box">
      <h2 class="modal-titel">QR-Code scannen</h2>
      <p class="gedaempft klein">Halte die Kamera auf den Code in der Eltern-App.</p>
      <div class="scan-bild"><video id="scan-video" playsinline muted autoplay></video><span class="scan-rahmen"></span></div>
      <p class="gedaempft klein" id="scan-info">Kamera wird gestartet …</p>
      <details class="klein"><summary>Kamera geht nicht? Link einfügen</summary>
        <textarea id="scan-text" rows="3" placeholder="Link aus der Eltern-App einfügen"></textarea>
        <button class="btn" data-act="scanText">Übernehmen</button>
      </details>
    </div>`, scannerStoppen);
  const info = () => document.getElementById('scan-info');
  try {
    const [jsQR, stream] = await Promise.all([
      jsqrLaden(),
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    ]);
    scanner = { stream };
    const video = document.getElementById('scan-video');
    if (!video) { scannerStoppen(); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (info()) info().textContent = 'Suche nach dem Code …';
    const runde = () => {
      if (!scanner || !document.getElementById('scan-video')) return scannerStoppen();
      if (video.readyState >= 2 && video.videoWidth) {
        const f = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * f); canvas.height = Math.round(video.videoHeight * f);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          const d = einrichtungLesen(code.data);
          if (d && d.art !== 'kind') { if (info()) info().textContent = 'Das ist ein Code für die Eltern-App, nicht für dieses Handy.'; }
          else if (d) { scannerStoppen(); schliesseModal(); einrichten(d, 'kamera'); return; }
          else if (info()) info().textContent = 'Das ist kein Einrichtungs-Code aus der Eltern-App.';
        }
      }
      requestAnimationFrame(runde);
    };
    requestAnimationFrame(runde);
  } catch (e) {
    scannerStoppen();
    if (info()) info().textContent = e && e.name === 'NotAllowedError'
      ? 'Die Kamera ist nicht erlaubt. Du kannst den Link unten einfügen.'
      : (e.message || 'Die Kamera konnte nicht gestartet werden. Du kannst den Link unten einfügen.');
  }
}

// ============ Aktualisierung ============

let swReg = null;
let neueVersion = null;
let neuLadenGeplant = false;

async function updateEinrichten() {
  if ('serviceWorker' in navigator) {
    try {
      swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      let warSchonGesteuert = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Neuer Offline-Speicher ist aktiv: neu laden, sobald es passt
        if (!warSchonGesteuert) { warSchonGesteuert = true; return; }
        neuLadenGeplant = true;
        neuLadenWennRuhig();
      });
    } catch (e) { /* ohne Offline-Speicher weiter */ }
  }
  updatePruefen();
  setInterval(() => { updatePruefen(); syncen(); }, 15 * 60 * 1000);
}

async function updatePruefen() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const v = (await r.json()).version;
    if (!v || v === APP_VERSION) return;
    neueVersion = v;
    if (swReg) { try { await swReg.update(); } catch (e) { /* egal */ } }
    neuLadenGeplant = true;
    // Ohne aktiven Offline-Speicher-Wechsel trotzdem nach kurzer Zeit neu laden
    setTimeout(neuLadenWennRuhig, 4000);
  } catch (e) { /* offline: später nochmal */ }
}

// Nur neu laden, wenn niemand mitten in einer Aufgabe oder im Spiel ist
function neuLadenWennRuhig() {
  if (!neuLadenGeplant) return;
  if (ansicht === 'start' || ansicht === 'eltern') {
    // Schutz gegen Neuladen in Dauerschleife, falls der Server noch alte Dateien liefert
    let versuch = null;
    try { versuch = JSON.parse(sessionStorage.getItem('update-versuch') || 'null'); } catch (e) { /* egal */ }
    if (versuch && versuch.v === neueVersion && Date.now() - versuch.t < 10 * 60 * 1000) { neuLadenGeplant = false; return; }
    try { sessionStorage.setItem('update-versuch', JSON.stringify({ v: neueVersion, t: Date.now() })); } catch (e) { /* egal */ }
    protokoll(S, 'update', { von: APP_VERSION, nach: neueVersion });
    sichern();
    location.reload();
  } else {
    const b = document.getElementById('update-hinweis');
    if (!b) {
      const d = document.createElement('div');
      d.id = 'update-hinweis';
      d.className = 'update-hinweis';
      d.innerHTML = 'Neue Version ist da. Sie wird geladen, wenn du zurück zum Start gehst.';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 6000);
    }
  }
}

// ============ Automatische Übertragung ============

let syncLaeuft = false;

function splitterKurz() {
  const sp = SP.splitterVon(S.splitter);
  return { stand: sp.stand, gesamt: sp.gesamt, frei: sp.frei, preise: SP.preise(sp), tage: sp.tage, zielTag: sp.zielTag, boni: sp.boni, verlauf: sp.verlauf.slice(0, 60),
    steinschieber: S.steinschieber ? { level: (S.steinschieber.level || 0) + 1, geschafft: (S.steinschieber.geschafft || []).length } : null,
    runenfall: S.runenfall ? { rekord: Math.max(S.runenfall.rekord || 0, S.runenfall.punkte || 0) } : null };
}

function standDaten() {
  const { pin, ...einstellungen } = S.einstellungen;
  return {
    app: 'lernapp-2048', version: APP_VERSION, nutzer: S.einstellungen.name, geraetId: S.geraetId, stand: new Date().toISOString(),
    einstellungen, guthaben: S.guthaben, spiel: { punkte: S.spiel.punkte, rekord: S.spiel.rekord, maxKachel: S.spiel.maxKachel },
    genStufen: S.genStufen, spielzeit: R(), splitter: splitterKurz(), paket: S.paket, gewichte: gewichte(), fern: S.fern,
    pakete: pakete() ? S.pakete.map(p => ({ id: p.id, name: p.paket.name, rolle: p.rolle, anteil: p.anteil, ...(p.paket.etappen ? { etappe: p.etappe, etappen: p.paket.etappen.length, ...(p.naechste ? { naechste: p.naechste } : {}) } : {}) })) : null,
    etappeAnzeigen: !!S.etappeAnzeigen, gestaltung: S.gestaltung || 'schrein',
    ...(S.wissen ? { wissen: { stand: SZ.wissenVon(S.wissen).stand, archiv: SZ.archivVon(S.archiv).gekauft } } : {}),
    ...(UZ().an ? { uebung: uzKonto() } : {}),
    ...(BZ().an ? { bildschirm: (k => ({ stand: k.stand, tag: k.tag, heute: k.heute }))(bzKonto()) } : {}), statistik: S.statistik, zusammenfassung7Tage: zusammenfassung(7), letzterExport: S.letzterExport
  };
}

// Ordnername aus dem Namen: Kleinbuchstaben, Umlaute ausgeschrieben, nur a–z, 0–9 und Bindestrich
export function nutzerOrdner(name = S.einstellungen.name) {
  const o = (name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return o || 'ohne-namen';
}

// Testgerät: Einstellungen eines anderen Schülers ausprobieren (nur lesen, es wird nie etwas in seinen Ordner geschrieben)
const testAls = () => (S.upload.testgeraet && S.upload.testAls) || null;
const fernOrdner = () => testAls() || nutzerOrdner();
let testSchueler = null; // [{ ordner }] aus daten/, nur Ordner mit einstellungen.json
async function testSchuelerLaden() {
  const liste = await U.ordnerLesen(S.upload, 'daten');
  const ordner = liste.filter(f => f.type === 'dir').map(f => f.name);
  const mit = await Promise.all(ordner.map(async o => (await U.ordnerLesen(S.upload, `daten/${o}`)).some(f => f.name === 'einstellungen.json') ? o : null));
  testSchueler = mit.filter(Boolean);
  return testSchueler;
}
// Kurzbeschreibung der Pakete für die Test-Leiste: „BOA Grundlagen 50 % · Zylinder 40 % (Etappe 2) · …“
function paketKurz() {
  if (pakete()) return S.pakete.map(p => `${p.paket.name} ${p.anteil} %${p.paket.etappen ? ` (Etappe ${p.etappe})` : ''}`).join(' · ');
  return S.paket ? `Paket ${S.paket.name}` : '';
}

// Testgerät: Persona direkt auf dem Startbildschirm wählen (es wird nichts gesendet)
function personaWahl(fehler = '') {
  const liste = testSchueler ? [null, ...testSchueler] : null;
  oeffneModal(`<div class="hinweis-text persona-wahl"><h2 class="modal-titel">Testen als …</h2>
    <p class="gedaempft klein">Übernimmt Pakete und Einstellungen aus der Eltern-App. Es wird nichts gesendet, beim Schüler ändert sich nichts.</p>
    ${fehler ? `<p class="meldung">${fehler}</p>` : ''}
    ${!S.upload.token ? '<p>Erst im Elternbereich mit dem Daten-Repo verbinden.</p>'
      : liste ? `<div class="persona-liste">${liste.map(o => `<button class="btn${(testAls() || null) === o ? ' btn-haupt' : ''}" data-act="personaSetzen" data-o="${esc(o || '')}">${o ? esc(ordnerName(o)) : 'Eigene Einstellungen'}</button>`).join('')}</div>`
      : '<p class="gedaempft">Schüler werden geladen …</p>'}
    <button class="btn" data-act="modalZu">Schließen</button></div>`);
  if (!liste && S.upload.token) testSchuelerLaden().then(() => personaWahl()).catch(e => personaWahl(esc(e.message || 'Laden hat nicht geklappt.')));
}

async function testAlsSetzen(ordner) {
  S.upload.testAls = ordner || null;
  S.fern = {}; // neu anfangen, damit alle Werte (auch ältere Versionen) übernommen werden
  S.paket = null; S.pakete = null; S.abweichungen = {}; // Schüler ohne Paket nutzt wie in seiner App das Übungsthema
  // Werte, die nur manche Kinder haben, auf den Standard setzen. Sonst bliebe z. B. „Logbuch Sternzeit“ bei Tobias stehen.
  personaZuruecksetzen(S);
  protokoll(S, 'test_als', { ordner: ordner || null });
  sichern();
  await fernHolen(true);
}
function personaZuruecksetzen(z) {
  for (const f of ['gestaltung', 'ansichtName', 'uzRegeln', 'bzRegeln', 'szRegeln', 'etappeAnzeigen', 'fernEtappen', 'feedbackAn', 'liveAn', 'freigaben', 'wochenplan', 'eingriffe', 'wp', 'zuletzt']) delete z[f];
  delete z.einstellungen.umformStufe;
  for (const b of L.BEDIENUNG) delete z.einstellungen[b.f];
}
const ordnerName = (o) => o.charAt(0).toUpperCase() + o.slice(1);

// Einstellungen aus der Eltern-App holen (daten/<name>/einstellungen.json)
let fernLaeuft = false, fernZuletzt = 0;
async function fernHolen(erzwingen = false) {
  const u = S.upload;
  if (!S.einstellungen.name || !u.repo || !u.token || fernLaeuft) return null;
  if (!erzwingen && Date.now() - fernZuletzt < 2 * 60 * 1000) return null;
  fernLaeuft = true; fernZuletzt = Date.now();
  let geaendert = null;
  try {
    const datei = await U.dateiLesen(u, `daten/${fernOrdner()}/einstellungen.json`);
    S.fern = { ...S.fern, geholt: new Date().toISOString(), fehler: null };
    geaendert = L.fernAnwenden(S, datei);
    if (geaendert) protokoll(S, 'fern_einstellungen', { version: S.fern.version, geaendert });
  } catch (e) {
    S.fern = { ...S.fern, fehler: e.message || 'Unbekannter Fehler' };
  } finally {
    fernLaeuft = false;
    sichern();
  }
  feedbackKnopfZeigen();
  if ((S.startOffen || []).length) startSenden();
  if (geaendert) {
    if (ansicht === 'start') zeigeStart();
    else if (ansicht === 'eltern') zeigeEltern('Neue Einstellungen aus der Eltern-App übernommen.');
  }
  return geaendert;
}

// ---------- Spielstand online ----------
// Der Stand auf dem Server gewinnt immer (Wunsch Vater). Jede gesicherte Fassung hat eine Nummer (rev).
// Ist auf dem Server eine neuere Fassung als die, die dieses Handy zuletzt kannte, wird sie übernommen –
// auch wenn auf dem Handy inzwischen etwas anderes passiert ist. Erst danach wird hochgeladen.
const standPfad = () => `daten/${nutzerOrdner()}/spielstand.json`;
let standLaeuft = false, standZuletztGeprueft = 0;
const ruhigeAnsicht = () => ['start', 'eltern', 'anmeldung'].includes(ansicht);
const revVon = (d) => (d && Number(d.rev)) || 0;

function standUebernehmen(datei, grund) {
  const warFrisch = istFrisch(S);
  if (!spielstandAnwenden(S, datei)) return false;
  const u = S.upload;
  u.standRev = revVon(datei);
  u.standKern = spielstandKern(S);
  u.standOnline = { gespeichert: datei.gespeichert, geraetId: datei.geraetId };
  u.standWartet = false;
  protokoll(S, 'spielstand_geladen', { von: datei.geraetId, gespeichert: datei.gespeichert, rev: u.standRev, grund });
  sichern();
  if (ansicht === 'start' || ansicht === 'anmeldung') zeigeStart();
  else if (ansicht === 'eltern') zeigeEltern('Spielstand vom Server übernommen.');
  if (warFrisch) {
    oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Willkommen zurück${S.einstellungen.name ? ', ' + esc(S.einstellungen.name) : ''}!</h2>
      <p>Deine Spielzeit und deine Spielstände sind wieder da.</p>
      <button class="btn btn-haupt" data-act="modalZu">Weiter</button></div>`);
  }
  return true;
}

// Server prüfen: neuere Fassung übernehmen. Gibt true zurück, wenn übernommen wurde.
// Während einer Aufgabe oder eines Spiels wird nur vorgemerkt und beim nächsten Startbildschirm übernommen.
async function standAbgleich(erzwingen = false) {
  const u = S.upload;
  if (!S.einstellungen.name || u.testgeraet || u.testAls || !u.repo || !u.token) return false;
  if (!erzwingen && Date.now() - standZuletztGeprueft < 20 * 1000) return false;
  standZuletztGeprueft = Date.now();
  const datei = await U.dateiLesen(u, standPfad());
  u.standGeprueft = true;
  if (!datei) { sichern(); return false; }
  u.standOnline = { gespeichert: datei.gespeichert, geraetId: datei.geraetId };
  if (revVon(datei) > (u.standRev || 0) || (!u.standRev && istFrisch(S))) {
    if (!ruhigeAnsicht()) { u.standWartet = true; sichern(); return false; }
    return standUebernehmen(datei, 'server-neuer');
  }
  sichern();
  return false;
}

// Spielstand hochladen, wenn sich etwas geändert hat. Vorher prüfen, ob der Server eine neuere Fassung hat –
// dann gewinnt der Server und es wird nichts hochgeladen.
async function standHochladen(erzwingen = false) {
  const u = S.upload;
  if (!S.einstellungen.name || u.testgeraet || u.testAls || !u.repo || !u.token || standLaeuft || u.standWartet) return false;
  const kern = spielstandKern(S);
  if (!erzwingen && kern === u.standKern) return false;
  standLaeuft = true;
  try {
    const server = await U.dateiLesen(u, standPfad());
    u.standGeprueft = true;
    if (server && revVon(server) > (u.standRev || 0)) {
      if (ruhigeAnsicht()) standUebernehmen(server, 'server-neuer');
      else u.standWartet = true;
      return false;
    }
    const datei = { ...spielstandAus(S), rev: revVon(server) + 1 };
    await U.dateiSchreiben(u, standPfad(), JSON.stringify(datei), `Spielstand ${datei.rev}`);
    u.standRev = datei.rev;
    u.standKern = kern;
    u.standOnline = { gespeichert: datei.gespeichert, geraetId: S.geraetId };
    u.standFehler = null;
    return true;
  } catch (e) {
    u.standFehler = e.message || 'Unbekannter Fehler';
    return false;
  } finally {
    standLaeuft = false;
    sichern();
  }
}

// ---------- Live-Anzeige für die Eltern-App ----------
// Nur Ereignisse: „startet Übung“, „startet Spiel“, „verlässt die App“. Ein Commit nur, wenn sich der Zustand ändert.
// Das Lebenszeichen dazwischen sind die normalen Lerndaten (höchstens alle 10 Minuten).
let liveZustand = null;
async function liveMelden(zustand, extra = {}) {
  const u = S.upload;
  if (!S.liveAn || !S.einstellungen.name || u.testgeraet || u.testAls || !u.repo || !u.token) return;
  const key = zustand + '|' + (extra.spiel || '');
  if (key === liveZustand) return;
  liveZustand = key;
  const inhalt = { format: 'live-1', zustand, seit: new Date().toISOString(), geraetId: S.geraetId, version: APP_VERSION, ...extra };
  try { await U.dateiSchreiben(u, `daten/${nutzerOrdner()}/live.json`, JSON.stringify(inhalt, null, 1), `Live: ${zustand}`); }
  catch (e) { liveZustand = null; }
}
protokollBeobachten((typ, d) => {
  if (typ === 'aufgabe_start') liveMelden('uebung', { thema: d.thema || null, zweck: zweck || null });
  else if (typ === 'spiel_start' && !d.test) liveMelden('spiel', { spiel: d.spiel || null });
});

async function syncen(erzwingen = false) {
  const u = S.upload;
  // Neue Einstellungen übernommen? Dann gleich den Stand melden, damit die Eltern-App es sieht.
  if (await fernHolen(erzwingen)) erzwingen = true;
  if (!S.einstellungen.name || u.testgeraet || u.testAls || !u.repo || !u.token) return null;
  try { wpEingriffeMelden(); wpPlanIst('sync'); } catch (e) { /* egal */ }
  try { await standAbgleich(erzwingen); } catch (e) { /* später nochmal */ }
  standHochladen(erzwingen);
  if (syncLaeuft) return null;
  if (!erzwingen && Date.now() - (u.versuch || 0) < 10 * 60 * 1000) return null;
  syncLaeuft = true;
  u.versuch = Date.now();
  let anzahl = 0;
  try {
    const tage = U.nachTagen(U.ohneTestphasen(S.log), d => L.tagKey(d));
    const offen = Object.keys(tage).sort().filter(k => tage[k].length > (u.tage[k] || 0)).slice(-14);
    for (const tag of offen) {
      const inhalt = JSON.stringify({ app: 'lernapp-2048', version: APP_VERSION, nutzer: S.einstellungen.name, geraetId: S.geraetId, tag, hochgeladen: new Date().toISOString(), eintraege: tage[tag] });
      await U.dateiSchreiben(u, `daten/${nutzerOrdner()}/${S.geraetId}/${tag}.json`, inhalt, `Lerndaten ${tag}`);
      u.tage[tag] = tage[tag].length;
      anzahl++;
    }
    if (anzahl || erzwingen) await U.dateiSchreiben(u, `daten/${nutzerOrdner()}/${S.geraetId}/stand.json`, JSON.stringify(standDaten(), null, 1), 'Stand');
    u.letzter = new Date().toISOString();
    u.fehler = null;
  } catch (e) {
    u.fehler = e.message || 'Unbekannter Fehler';
  } finally {
    syncLaeuft = false;
    sichern();
  }
  return anzahl;
}

// ============ Startbildschirm ============

function zeigeAnmeldung(fehler = '') {
  setzeAnsicht('anmeldung');
  $app.innerHTML = `
  <div class="screen anmeldung">
    <div class="anmeldung-logo">${sechseck(88, '#DCEDED', '#1F6F75', '<text x="12" y="12.6" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, serif" font-weight="700" font-size="6" fill="#0E4A4F">2048</text>')}</div>
    <h1 class="mitte">Schrein der Zahlen</h1>
    <section class="karte anmeldung-karte">
      <label class="feld-label gross" for="a-name">Wie heißt du?</label>
      <input id="a-name" class="name-feld" type="text" maxlength="20" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Dein Vorname">
      <p class="gedaempft" id="a-fehler">${esc(fehler)}</p>
      <button class="btn btn-haupt btn-gross" data-act="anmelden">Los geht's</button>
      <button class="btn-text klein" data-act="qrScannen">Mit QR-Code aus der Eltern-App einrichten</button>
    </section>
  </div>`;
  const f = document.getElementById('a-name');
  f.addEventListener('keydown', e => { if (e.key === 'Enter') anmelden(); });
  setTimeout(() => f.focus(), 50);
}

function anmelden() {
  const name = (document.getElementById('a-name').value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (name.length < 2) return zeigeAnmeldung('Bitte gib deinen Namen ein.');
  S.einstellungen.name = name;
  S.upload.tage = {};
  S.upload.standGeprueft = false; S.upload.standKern = null; S.upload.standRev = 0; S.upload.standWartet = false;
  protokoll(S, 'anmeldung', { name });
  sichern();
  zeigeStart();
}

// ---------- Neue Spiele freischalten (Runensplitter) ----------

// Alle Spiele: die ersten drei sind immer offen, die übrigen werden mit Runensplittern freigeschaltet
const SPIEL_INFO = {
  '2048': { text: 'Steine verschmelzen', start: () => zeigeSpiel() },
  runenfeld: { text: 'Formen legen', start: () => zeigeRunenfeld() },
  kristallmine: { text: 'Kristalle sammeln', start: () => zeigeKristallmine() },
  steinschieber: { text: 'Steine schieben', start: () => zeigeSteinschieber() },
  runenfall: { text: 'Reihen füllen', start: () => zeigeRunenfallSpiel() },
  runenreihen: { text: 'Drei gleiche', start: () => zeigeModulSpiel('runenreihen') },
  hoehlenkarte: { text: 'Fallen finden', start: () => zeigeModulSpiel('hoehlenkarte') },
  runenbrecher: { text: 'Mauern brechen', start: () => zeigeModulSpiel('runenbrecher') },
  jadeschlange: { text: 'Schlange lenken', start: () => zeigeModulSpiel('jadeschlange') }
};
const IMMER_OFFEN = [{ id: '2048', name: '2048' }, { id: 'runenfeld', name: 'Runenfeld' }, { id: 'kristallmine', name: 'Kristallmine' }];
const SPIEL_START = Object.fromEntries(Object.entries(SPIEL_INFO).filter(([, v]) => v.start).map(([k, v]) => [k, v.start]));

// Darf dieses Spiel gerade gespielt werden? (Test-Handys: alle fertigen Spiele)
function spielOffen(id, sp = SP.splitterVon(S.splitter)) {
  if (IMMER_OFFEN.some(g => g.id === id)) return true;
  const g = SP.NEUE_SPIELE.find(x => x.id === id);
  return !!g && g.fertig && !!SPIEL_START[id] && (SP.istFrei(sp, id) || !!S.upload.testgeraet);
}
const spielName = (id) => (IMMER_OFFEN.find(g => g.id === id) || SP.NEUE_SPIELE.find(g => g.id === id) || { name: id }).name;
const letztesOffenes = () => (S.letztesSpiel && spielOffen(S.letztesSpiel) ? S.letztesSpiel : '2048');
function spielStarten(id) { if (spielOffen(id) && SPIEL_START[id]) SPIEL_START[id](); }

// Kleine Bilder der Spiele (eigene Zeichnungen)
function spielBild(id, size = 44) {
  const j = '#5FE8B4', jh = '#B9FFE2', jt = '#1E7A5F', go = '#D8B05A', gh = '#F6DFA2', st = '#3a4644', st2 = '#56645f';
  const k = (x, y, w, h, f, r = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"/>`;
  const raute = (cx, cy, r, f) => `<polygon points="${cx},${cy - r} ${cx + r * 0.8},${cy} ${cx},${cy + r} ${cx - r * 0.8},${cy}" fill="${f}"/>`;
  const bilder = {
    '2048': k(4, 4, 18, 18, st2) + k(26, 4, 18, 18, jt) + k(4, 26, 18, 18, go) + k(26, 26, 18, 18, j) + `<text x="35" y="39" font-size="9" font-weight="700" text-anchor="middle" fill="#0c1011">2048</text>`,
    runenfeld: k(6, 6, 11, 11, j) + k(18, 6, 11, 11, j) + k(18, 18, 11, 11, j) + k(6, 30, 11, 11, go) + k(30, 30, 11, 11, go) + k(18, 30, 11, 11, go),
    kristallmine: k(4, 30, 40, 14, '#3b2f21', 3) + `<circle cx="14" cy="22" r="8" fill="${st2}"/>` + raute(32, 18, 12, j) + raute(32, 18, 5, jh),
    steinschieber: k(6, 10, 22, 22, '#8c7b5e', 5) + `<path d="M17 15v12M17 21l-5-4M17 21l5-4" stroke="#2a2219" stroke-width="2.5" fill="none"/>` + `<circle cx="38" cy="34" r="7" fill="none" stroke="${j}" stroke-width="2.5"/>` + `<path d="M30 21h10l-3-3m3 3l-3 3" stroke="${gh}" stroke-width="2" fill="none"/>`,
    runenfall: k(16, 4, 10, 10, '#8569c9') + k(6, 14, 10, 10, '#8569c9') + k(16, 14, 10, 10, '#8569c9') + k(26, 14, 10, 10, '#8569c9') + k(4, 34, 10, 10, j) + k(14, 34, 10, 10, go) + k(24, 34, 10, 10, '#4a8fc0') + k(34, 34, 10, 10, j),
    runenreihen: raute(12, 24, 9, j) + raute(24, 24, 9, j) + raute(36, 24, 9, j) + raute(24, 8, 6, go) + raute(24, 40, 6, '#c96a45'),
    hoehlenkarte: [0, 1, 2].map(r => [0, 1, 2].map(c => k(5 + c * 13, 5 + r * 13, 11, 11, (r + c) % 2 ? st : st2))).flat().join('') + `<text x="23.5" y="27" font-size="10" font-weight="700" text-anchor="middle" fill="${jh}">2</text>` + raute(36, 36, 5, go),
    runenbrecher: [0, 1, 2, 3].map(c => k(3 + c * 11, 6, 9, 6, c % 2 ? go : j)).join('') + [0, 1, 2].map(c => k(8 + c * 11, 14, 9, 6, jt)).join('') + `<circle cx="28" cy="30" r="4" fill="${jh}"/>` + k(12, 40, 22, 4, gh),
    jadeschlange: `<path d="M8 38 C8 24, 22 30, 24 20 S38 8, 40 10" stroke="${j}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="40" cy="10" r="5" fill="${jh}"/>` + raute(12, 12, 5, go)
  };
  return `<svg class="spiel-bild" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${bilder[id] || ''}</svg>`;
}

// Startbildschirm: zuletzt gespieltes Spiel direkt, alle Spiele auf einer eigenen Seite
function spieleStartHtml() {
  const sp = SP.splitterVon(S.splitter);
  const id = letztesOffenes();
  const n = SP.naechstes(sp);
  const bereit = n && n.fehlt === 0 && n.spiel.fertig;
  const anteil = n ? Math.min(100, Math.round(sp.stand / Math.max(1, n.preis) * 100)) : 100;
  return `<div class="spiel-start">
      <button class="btn btn-amber-rand weiter-spiel" data-act="zumSpiel">${spielVorschau(id, 40)}<span><span class="klein">Weiter mit</span><b>${esc(spielName(id)).replace(/^(Kristall|Stein|Runen|Höhlen|Jade)(.{4,})$/, '$1&shy;$2')}</b></span></button>
      <button class="spiele-knopf${bereit ? ' bereit' : ''}" data-act="spielauswahl">
        <span class="spiele-knopf-kopf"><b>Alle Spiele</b><span class="splitter-mini">${splitterSymbol(16)}${sp.stand}</span></span>
        ${n ? `<span class="balken"><i style="width:${anteil}%"></i></span>
        <span class="klein">${bereit ? `Neues Spiel bereit: ${esc(n.spiel.name)}!` : `Nächstes: ${esc(n.spiel.name)} · noch ${n.fehlt}`}</span>` : '<span class="klein">Alle Spiele frei!</span>'}
      </button>
    </div>`;
}

function spielKarte(g, sp, n) {
  const offen = spielOffen(g.id, sp);
  const frei = IMMER_OFFEN.some(x => x.id === g.id) || SP.istFrei(sp, g.id);
  const info = SPIEL_INFO[g.id] || {};
  const zuletzt = g.id === letztesOffenes();
  if (frei) {
    return `<button class="spiel-karte offen${zuletzt ? ' zuletzt' : ''}" data-act="neuspiel" data-id="${g.id}">
      ${spielVorschau(g.id, 64)}<b>${esc(g.name)}</b><span class="klein">${zuletzt ? 'Zuletzt gespielt' : esc(info.text || '')}</span></button>`;
  // (Anleitung offener Spiele über das Fragezeichen im Spiel)
  }
  const istNaechstes = n && n.spiel.id === g.id;
  const preis = SP.preise(sp)[SP.NEUE_SPIELE.findIndex(x => x.id === g.id)];
  const test = (ANLEITUNGEN[g.id] ? `<button class="spiel-test anl" data-act="anleitung" data-id="${g.id}">So geht's</button>` : '') + (offen ? `<button class="spiel-test" data-act="neuspiel" data-id="${g.id}">Test: jetzt spielen</button>` : '');
  if (istNaechstes) {
    const anteil = Math.min(100, Math.round(sp.stand / Math.max(1, preis) * 100));
    const bereit = n.fehlt === 0 && g.fertig;
    return `<div class="spiel-karte naechstes${bereit ? ' bereit' : ''}">
      <div class="naechstes-kopf">${spielVorschau(g.id, 56)}<div><span class="klein">Nächstes Spiel</span><b>${esc(g.name)}</b><span class="klein">${esc(info.text || '')}</span></div></div>
      <span class="balken" role="progressbar" aria-valuemin="0" aria-valuemax="${preis}" aria-valuenow="${Math.min(sp.stand, preis)}"><i style="width:${anteil}%"></i></span>
      <span class="klein">${bereit ? `Kostet ${preis} Runensplitter. Du hast genug!` : !g.fertig && n.fehlt === 0 ? 'Genug Splitter! Das Spiel ist noch in Arbeit.' : `Noch ${n.fehlt} Runensplitter · ${sp.stand} von ${preis}`}</span>
      ${bereit ? `<button class="btn btn-jade-hell" data-act="freischalten" data-id="${g.id}">Freischalten</button>` : ''}${test}
    </div>`;
  }
  return `<div class="spiel-karte zu">
    <span class="schloss-bild">${spielVorschau(g.id, 64)}</span><b>${esc(g.name)}</b>
    <span class="klein">${g.fertig ? `${splitterSymbol(13)} ${preis}` : 'kommt bald'}</span>${test}
  </div>`;
}

function zeigeSpieleSeite() {
  if (ansicht === 'spiel') spielBeenden();
  setzeAnsicht('spiele');
  const sp = SP.splitterVon(S.splitter);
  const n = SP.naechstes(sp);
  const offen = [...IMMER_OFFEN, ...SP.NEUE_SPIELE.filter(g => SP.istFrei(sp, g.id))];
  const gesperrt = SP.NEUE_SPIELE.filter(g => !SP.istFrei(sp, g.id));
  $app.innerHTML = `
  <div class="spiele-zauber" aria-hidden="true"><div class="sz-lichter"><i></i><i></i><i></i><i></i></div>
    <div class="sz-staub">${Array.from({ length: 30 }, (_, k) => `<span class="${k % 3 === 0 ? 'gold' : 'jade'}" style="left:${(k * 37 + 5) % 100}%;--dauer:${10 + (k * 13) % 10}s;--verz:-${(k * 1.9) % 18}s;--drift:${((k * 29) % 50) - 25}px;--gr:${2 + (k % 3)}px"></span>`).join('')}</div></div>
  <div class="screen spiele-seite">
    <header class="topbar"><button class="btn-text" data-act="start">← Zurück</button><b class="spiele-titel"><span class="sz-rune">✦</span>Spiele<span class="sz-rune">✦</span></b>
      <button class="splitter-chip dunkel" data-act="erfolge" aria-label="Runensplitter und Erfolge">${splitterSymbol(22)}<b>${sp.stand}</b></button></header>
    <div class="spiele-uhr">${zeitSymbol(22)} <b>${L.formatZeit(S.guthaben)}</b> Spielzeit</div>
    <h2 class="spiele-abschnitt"><span>Deine Spiele</span></h2>
    <div class="spiele-gitter">${offen.map(g => spielKarte(g, sp, n)).join('')}</div>
    ${gesperrt.length ? `<h2 class="spiele-abschnitt"><span>Noch zu entdecken</span></h2>
    <p class="spiele-hinweis">Mit Runensplittern aus deinen Aufgaben schaltest du sie nacheinander frei.</p>
    <div class="spiele-gitter">${gesperrt.map(g => spielKarte(g, sp, n)).join('')}</div>` : ''}
    ${S.guthaben <= 0 ? '<p class="spiele-hinweis">Keine Spielzeit mehr. Mach ein paar Aufgaben!</p>' : ''}
    <button class="btn btn-haupt btn-gross" data-act="aufgaben">Aufgaben machen</button>
  </div>`;
}

function freischaltenJetzt(id) {
  S.splitter = SP.splitterVon(S.splitter);
  const n = SP.naechstes(S.splitter);
  const e = SP.freischalten(S.splitter, id);
  if (!e) return ansicht === 'spiele' ? zeigeSpieleSeite() : zeigeStart();
  protokoll(S, 'freigeschaltet', { spiel: id, preis: n.preis, stand: S.splitter.stand });
  sichern();
  standHochladen(true);
  oeffneModal(`<div class="freischalt-feier"><div class="strahlen" aria-hidden="true"></div>${splitterSymbol(64)}
    <h2 class="modal-titel">${esc(n.spiel.name)} ist frei!</h2>
    <p>Das hast du dir mit deinen Aufgaben verdient.</p>
    <div class="knopf-reihe"><button class="btn btn-haupt" data-act="neuspiel" data-id="${id}">Jetzt spielen</button><button class="btn" data-act="modalZu">Später</button></div></div>`, () => (ansicht === 'spiele' ? zeigeSpieleSeite() : zeigeStart()));
}

let erfolgeZurueck = 'start';
function zeigeErfolge() {
  setzeAnsicht('erfolge');
  const sp = SP.splitterVon(S.splitter);
  const n = SP.naechstes(sp);
  const gestern = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return L.tagKey(d); })();
  const tage = sp.tage && (sp.tage.letzter === S.tag.key || sp.tage.letzter === gestern) ? sp.tage.zahl : 0;
  const zeit = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }) + ' ' + new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  // Einzelne Aufgaben-Punkte zusammenfassen, besondere Erfolge einzeln zeigen
  const liste = sp.verlauf.filter(e => !['aufgabe', 'erst'].includes(e.grund)).slice(0, 40);
  const regeln = [['Aufgabe gelöst', 1], ['Im 1. Versuch richtig', '+1'], ['5 am Stück richtig', 3], ['10 am Stück richtig', 6], ['Tagesziel: 10 Aufgaben', 5],
    ['3 Tage am Stück', 10], ['7 Tage am Stück', 25], ['Aufgabe von früher jetzt gelöst', 2], ['Wartende Aufgabe gelöst', 2], ['Eine Stufe aufgestiegen', 5], ['Thema auf höchster Stufe', 15]];
  $app.innerHTML = `
  <div class="screen erfolge">
    <header class="topbar"><button class="btn-text" data-act="${erfolgeZurueck}">← Zurück</button><b>Erfolge</b><span></span></header>
    <section class="splitter-gross">${splitterSymbol(52)}<div><div class="guthaben-zahl">${sp.stand}</div><div class="gedaempft">Runensplitter · insgesamt ${sp.gesamt} verdient</div></div></section>
    <section class="info-karte">
      <div class="info-zeile"><span>Tage am Stück mit Tagesziel</span><b>${tage}</b></div>
      <div class="info-zeile"><span>Heute</span><b>${Math.min(S.tag.aufgaben, SP.TAGESZIEL)} von ${SP.TAGESZIEL} Aufgaben</b></div>
      ${n ? `<div class="info-zeile"><span>Nächstes Spiel</span><b>${esc(n.spiel.name)} · ${n.fehlt ? `noch ${n.fehlt}` : 'bereit'}</b></div>` : '<div class="info-zeile"><span>Alle Spiele</span><b>freigeschaltet</b></div>'}
    </section>
    <h2 class="abschnitt-titel">Deine Erfolge</h2>
    <section class="karte erfolg-liste">${liste.length ? liste.map(e => `<div class="erfolg-zeile"><span class="erfolg-n${e.n < 0 ? ' minus' : ''}">${e.n > 0 ? '+' : ''}${e.n || ''}</span><span>${esc(e.text)}</span><span class="gedaempft klein">${zeit(e.t)}</span></div>`).join('') : '<p class="gedaempft">Noch keine besonderen Erfolge. Löse ein paar Aufgaben!</p>'}</section>
    <h2 class="abschnitt-titel">So bekommst du Runensplitter</h2>
    <section class="karte erfolg-liste">${regeln.map(([t, n]) => `<div class="erfolg-zeile"><span class="erfolg-n">${typeof n === 'number' ? '+' + n : n}</span><span>${t}</span><span></span></div>`).join('')}</section>
  </div>`;
}

function testLeisteHtml() {
  return `<button class="test-leiste" data-act="personaWahl">
      <span class="test-leiste-marke">Testgerät</span>
      <span class="test-leiste-text">Testen als <b>${testAls() ? esc(ordnerName(testAls())) : 'eigene Einstellungen'}</b>${testFokus() ? `<span class="fokus-an">Gezielt testen AN: ${esc(THEMA_NAMEN[testFokus().thema])} · Stufe ${testFokus().stufe}</span>` : paketKurz() ? `<span class="klein">${esc(paketKurz())}</span>` : ''}</span>
      <span class="test-leiste-pfeil">Ändern ›</span>
    </button>`;
}

function zeigeStart() {
  if (!S.einstellungen.name) return zeigeAnmeldung();
  setzeAnsicht('start');
  if (neuLadenGeplant) { neuLadenWennRuhig(); return; }
  if (S.upload.standWartet) standAbgleich(true).catch(() => {});
  syncen();
  feedbackRueckmeldungHolen();
  setTimeout(feedbackRueckmeldungZeigen, 300);
  tagAktualisieren(S);
  const slot = R().basisMin > 0 ? L.basisSlotJetzt(new Date(), S.einstellungen, S.basisSlot) : null;
  const name = S.einstellungen.name ? `, ${esc(S.einstellungen.name)}` : '';
  const serieAktiv = S.serie.pos > 0 && Date.now() - S.serie.letzteAktivitaet < 20 * 60 * 1000;
  zweck = null;
  etappenAktualisieren();
  const bz = BZ().an ? bzKonto() : null;
  // „Du übst gerade: Zylinder · Etappe 2 von 4“ (nur wenn in der Eltern-App eingeschaltet)
  const einheit = S.etappeAnzeigen && pakete() ? S.pakete.find(p => p.rolle === 'einheit' && p.paket.etappen && p.etappe > 0) : null;
  logbuchAktualisieren();
  if (sternzeit()) return zeigeStartSternzeit({ bz, slot, serieAktiv });
  $app.innerHTML = `
  <div class="screen start">
    <header class="start-kopf">
      <div class="logo" id="logo" title="">${sechseck(56, '#DCEDED', '#1F6F75', '<text x="12" y="12.6" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, serif" font-weight="700" font-size="6" fill="#0E4A4F">2048</text>')}</div>
      <div><h1>Schrein der Zahlen</h1><p class="gedaempft">Hallo${name}!</p></div>
    </header>

    ${S.upload.testgeraet ? testLeisteHtml() : ''}
    ${bed('spielzeit_zeigen') ? `<section class="guthaben-karte">
      ${zeitSymbol(44)}
      <div><div class="guthaben-zahl">${L.formatZeit(S.guthaben)}</div><div class="gedaempft">Spielzeit</div></div>
      <button class="splitter-chip" data-act="erfolge" aria-label="Runensplitter und Erfolge">${splitterSymbol(26)}<b>${SP.splitterVon(S.splitter).stand}</b></button>
    </section>` : ''}

    ${bz && bz.stand > 0 ? `
    <section class="bz-karte">
      <span class="bz-icons">${videoSymbol(40)}</span>
      <div class="bz-text"><div class="bz-zahl">${BS.minText(bz.stand)}</div><div class="gedaempft">Bildschirmzeit gesammelt</div></div>
      ${BS.kannAbschicken(bz, BZ()) ? '<button class="btn btn-bz" data-act="bzSeite">Abschicken</button>' : ''}
      ${BS.kannAbschicken(bz, BZ()) ? '' : `<div class="bz-ab gedaempft">${abText(bz)}</div>`}
    </section>` : ''}

    ${slot && bed('spielzeit_zeigen') ? `
    <section class="basis-karte">
      <div><b>${minText(R().basisMin)} Spielzeit sind da!</b><div class="gedaempft">Jede Stunde gibt es ${minText(R().basisMin)} geschenkt.</div></div>
      <button class="btn btn-amber" data-act="basis">Abholen</button>
    </section>` : ''}

    ${einheit ? `<p class="etappe-zeile">Du übst gerade: <b>${esc(einheit.paket.name)}</b> · Etappe ${einheit.etappe} von ${einheit.paket.etappen.length}</p>` : ''}
    ${uzGesperrt() ? `<section class="info-karte"><b>Für heute hast du dein Pensum erreicht.</b><div class="gedaempft">Die Spiele sind weiter offen.</div></section>
    <button class="btn btn-haupt btn-gross" data-act="uebungszeit">Eltern fragen</button>`
      : `<button class="btn btn-haupt btn-gross" data-act="aufgaben">${S.wartet ? 'Weiter mit deiner Aufgabe' : 'Aufgaben machen'}</button>`}
    ${bed('spielzeit_zeigen') ? spieleStartHtml() : ''}

    <section class="info-karte">
      <div class="info-zeile"><span>Heute geschafft</span><b>${S.tag.aufgaben} ${S.tag.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}</b></div>
      ${bed('spielzeit_zeigen') ? '' : '<!--'}<div class="info-zeile"><span>Heute verdient</span><b>${L.formatMinuten(S.tag.verdient)} von ${BS.minText(BS.szGrenzeSek(S.szRegeln, S.tag.key))}</b></div>${bed('spielzeit_zeigen') ? '' : '-->'}
      ${serieAktiv ? `<div class="info-zeile"><span>Deine Serie</span><b>${S.serie.pos} am Stück</b></div>` : ''}
    </section>

    ${bed('spielzeit_zeigen') ? '' : '<!--'}<section class="regel-karte">
      <div class="regel-titel">So bekommst du Spielzeit</div>
      <div class="stufen">
        ${R().staffel.map((m, k) => `<div><b>${String(m).replace('.', ',')}</b> Min.<span>${['Aufg. 1–3', 'Aufg. 4–6', 'Aufg. 7–9', 'ab Aufg. 10'][k]}</span></div>`).join('')}
      </div>
      <p class="gedaempft klein">Pro richtige Aufgabe. Je mehr am Stück, desto mehr Zeit. Die Serie endet, wenn du spielst oder 20 Minuten Pause machst.</p>
    </section>${bed('spielzeit_zeigen') ? '' : '-->'}
    <p class="version-zeile">Version ${APP_VERSION}</p>
    ${hatSpeicherFehler() ? '<p class="warnung">Der Speicher ist voll oder gesperrt. Bitte einem Erwachsenen Bescheid geben.</p>' : ''}
  </div>`;
  langDruecken(document.getElementById('logo'), elternZugang);
}


// ============ Logbuch Sternzeit: Logbuch, Wissensarchiv, Wissenspunkte (Auftrag 13) ============
const lbStand = () => (S.logbuch = SZ.logbuchVon(S.logbuch));
function logbuchAktualisieren() {
  if (!sternzeit() || !pakete()) return [];
  const st = lbStand();
  const neu = SZ.freischalten(st, S.pakete, LOGBUCH, L.tagKey(), PH.sternzeit(new Date()));
  for (const id of neu) protokoll(S, 'logbuch_frei', { id, ...st.frei[id] });
  if (neu.length) sichern();
  return neu;
}
const ungelesen = () => (sternzeit() && pakete() ? SZ.ungelesen(lbStand()) : []);
const lbSternzeit = (id) => { const f = lbStand().frei[id]; return f && typeof f.sternzeit === 'number' ? PH.sternzeitText(f.sternzeit) : sternzeitJetzt(); };
const paketName = (id) => { const p = (pakete() || []).find(x => x.id === id); return p ? p.paket.name : id; };

function eintragHtml(lb) {
  const f = lbStand().frei[lb.id] || {};
  const szt = lbSternzeit(lb.id);
  return `<div class="sz-panel sz-eintrag">
    <div class="sz-label">${esc(paketName(f.paket))} · Etappe ${f.etappe || lb.etappe} · Sternzeit ${szt}</div>
    <h3>${esc(lb.titel)}</h3>
    ${lb.absaetze.map(t => `<p>${mathe(SZ.mitSternzeit(t, szt))}</p>`).join('')}
    ${(lb.merke || []).length ? `<div class="sz-merke"><div class="sz-label">Merke</div>${lb.merke.map(m => `<div>${mathe(m)}</div>`).join('')}</div>` : ''}
  </div>`;
}

// Neu freigeschalteter Eintrag vor der ersten Aufgabe einer neuen Etappe
function zeigeLogbuchNeu() {
  const offen = ungelesen();
  const id = offen[0];
  const lb = LOGBUCH.find(x => x.id === id);
  if (!lb) return false;
  setzeAnsicht('logbuchNeu');
  $app.innerHTML = `
  <div class="screen sz-screen">
    ${szKopf()}
    <p class="sz-liste-kopf">✦ Neuer Logbuch-Eintrag</p>
    ${eintragHtml(lb)}
    <button class="sz-knopf" data-act="logbuchGelesen" data-id="${esc(id)}">${offen.length > 1 ? 'Weiter: nächster Eintrag' : 'Los geht’s: Aufgaben'} <small>▶</small></button>
    <button class="sz-knopf matt klein" data-act="start">Zum Start</button>
  </div>`;
  return true;
}

function zeigeLogbuch(oeffnen = null) {
  setzeAnsicht('logbuch');
  logbuchAktualisieren();
  const liste = SZ.logbuchListe(S.pakete, LOGBUCH, lbStand());
  const frei = Object.keys(lbStand().frei);
  const offen = oeffnen || frei[frei.length - 1] || null;
  // Aufgeklappter Eintrag gilt als gelesen
  if (offen && !lbStand().gelesen.includes(offen)) { S.logbuch.gelesen.push(offen); protokoll(S, 'logbuch_gelesen', { id: offen, im: 'logbuch' }); sichern(); }
  const bloecke = liste.map(p => `
    <div class="sz-liste-kopf">${esc(p.name)}</div>
    ${p.etappen.map(e => {
      if (e.eintrag && e.eintrag.id === offen) return eintragHtml(e.eintrag);
      if (e.eintrag) return `<button class="sz-zeile-knopf" data-act="logbuchEintrag" data-id="${esc(e.eintrag.id)}"><span>${esc(e.eintrag.titel)}</span><span class="sz-matt">Etappe ${e.nr}</span></button>`;
      return `<div class="sz-zeile-knopf zu"><span>${mathe(e.name)}</span><span class="sz-matt">${e.bald ? 'kommt bald' : `Etappe ${e.nr}`}</span></div>`;
    }).join('')}`).join('');
  $app.innerHTML = `
  <div class="screen sz-screen">
    ${szKopf()}
    <button class="sz-zurueck" data-act="start">‹ Zum Start</button>
    <div class="sz-reiter"><button class="an" data-act="logbuch">Logbuch</button><button data-act="archiv">Archiv</button></div>
    ${liste.length ? bloecke : '<p class="sz-matt">Noch keine Einträge.</p>'}
    <button class="sz-knopf" data-act="aufgaben">Aufgaben machen <small>▶</small></button>
    <button class="sz-knopf matt klein" data-act="start">Zum Start</button>
  </div>`;
}

const sprache = (s) => (s === 'en' ? 'Englisch' : 'Deutsch');
function zeigeArchiv(meldung = '') {
  setzeAnsicht('archiv');
  const w = SZ.wissenVon(S.wissen);
  const ar = SZ.archivVon(S.archiv);
  const sichtbar = ARCHIV.filter(e => SZ.archivSichtbar(e, S.pakete));
  const verborgen = ARCHIV.length - sichtbar.length;
  const karte = (e) => {
    const meta = `<div class="meta">${esc(e.art)} · ${sprache(e.sprache)} · ${esc(e.quelle)}</div>`;
    if (ar.gekauft.includes(e.id)) {
      return `<div class="sz-archiv">${meta}<b>${esc(e.titel)}</b><div class="sz-archiv-text">${mathe(e.text)}</div>
        <a class="sz-knopf blau klein" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" data-act="archivOeffnen" data-id="${esc(e.id)}">Öffnen ↗</a></div>`;
    }
    const genug = w.stand >= e.kosten;
    return `<div class="sz-archiv zu">${meta}<b>${esc(e.titel)}</b>
      <button class="sz-knopf klein${genug ? '' : ' matt'}" data-act="archivKaufen" data-id="${esc(e.id)}" ${genug ? '' : 'disabled'}>Freischalten · ${e.kosten} WP</button></div>`;
  };
  $app.innerHTML = `
  <div class="screen sz-screen">
    ${szKopf()}
    <button class="sz-zurueck" data-act="start">‹ Zum Start</button>
    <div class="sz-reiter"><button data-act="logbuch">Logbuch</button><button class="an" data-act="archiv">Archiv</button></div>
    <div class="sz-zeile-wp"><span class="sz-label">Deine Wissenspunkte</span><span class="sz-punkte">◆ ${w.stand} WP</span></div>
    ${meldung ? `<div class="sz-hinweisbox">${meldung}</div>` : ''}
    ${sichtbar.map(karte).join('') || '<p class="sz-matt">Noch keine Einträge.</p>'}
    ${verborgen > 0 ? `<div class="sz-archiv zu verborgen"><div class="meta">Noch verborgen</div><b>${verborgen} weitere ${verborgen === 1 ? 'Eintrag' : 'Einträge'}</b><span class="sz-matt">erscheinen mit den nächsten Etappen</span></div>` : ''}
    <p class="sz-matt klein">Wissenspunkte gibt es für gelöste Aufgaben. Beim Knobeln ohne Schritte gibt es mehr.</p>
    <button class="sz-knopf matt klein" data-act="start">Zum Start</button>
  </div>`;
}

function archivKaufen(id) {
  const e = ARCHIV.find(x => x.id === id);
  if (!e) return;
  oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Freischalten?</h2>
    <p><b>${esc(e.titel)}</b></p><p>Das kostet ${e.kosten} Wissenspunkte.</p>
    <div class="knopf-reihe"><button class="btn btn-haupt" data-act="archivKaufenJa" data-id="${esc(id)}">Freischalten</button><button class="btn" data-act="modalZu">Später</button></div></div>`);
}
function archivKaufenJa(id) {
  const e = ARCHIV.find(x => x.id === id);
  schliesseModal();
  const w = SZ.wissenVon(S.wissen), ar = SZ.archivVon(S.archiv);
  if (!e || !SZ.kaufen(w, ar, e)) return zeigeArchiv();
  S.wissen = w; S.archiv = ar;
  protokoll(S, 'archiv_frei', { id, kosten: e.kosten, stand: w.stand });
  sichern(); standHochladen(true);
  zeigeArchiv(`<b>Freigeschaltet:</b> ${esc(e.titel)}`);
}

// ============ Übungszeit pro Tag ============
const UZ = () => BS.uzRegeln(S.uzRegeln);
const uzKonto = () => (S.uebung = BS.uzKontoVon(S.uebung, L.tagKey()));
const uzGesperrt = () => UZ().an && BS.uzStatus(uzKonto(), S.uzRegeln) !== 'frei';
let uzZuletzt = Date.now();
function uebungTick() {
  const jetzt = Date.now();
  const d = Math.max(0, Math.min(10, Math.round((jetzt - uzZuletzt) / 1000)));
  uzZuletzt = jetzt;
  if (!UZ().an || ansicht !== 'aufgabe' || document.hidden || !A || A.test) return;
  const k = uzKonto();
  const vorher = BS.uzStatus(k, S.uzRegeln);
  k.sek += d;
  const g = BS.uzGrenzen(S.uzRegeln, k.tag);
  const nachher = BS.uzStatus(k, S.uzRegeln);
  if (nachher !== 'frei' && !(k.hinweis >= g.hinweis)) {
    k.hinweis = g.hinweis;
    protokoll(S, 'uebungszeit_hinweis', { sek: k.sek, max: g.hinweis });
    sichern();
    if (!A.fertig) { A.uzHinweis = true; zeigeAufgabe(); }
    else zeigeAufgabe();
  }
  if (nachher === 'schluss' && vorher !== 'schluss') {
    protokoll(S, 'uebungszeit_schluss', { sek: k.sek });
    // Laufende Aufgabe wartet bis morgen (zählt nicht als Abbruch für die Serie)
    if (!A.fertig) {
      protokoll(S, 'aufgabe_abgebrochen', { id: A.aufgabe.id, teil: A.idx, ms: Date.now() - A.start, ohneEingabe: A.teile.every(t => !t.versuche.length), thema: A.aufgabe.thema, wartet: !A.aufgabe.bonus, grund: 'uebungszeit' });
      if (!A.test) { paketZeitBuchen(A.paket, Date.now() - A.start); wpBuchen(A.aufgabe, Date.now() - A.start); }
      if (!A.aufgabe.bonus) S.wartet = aufgabeSchnappschuss();
      S.laufend = null; A = null;
    }
    sichern();
    zeigeUebungszeit();
    return;
  }
  if (k.sek % 30 < d) sichern();
}

let uzBildDatei = null, uzGeschickt = false;
function zeigeUebungszeit() {
  setzeAnsicht('uebungszeit');
  const k = uzKonto();
  if (!k.code) { k.code = BS.neuerCode(); sichern(); }
  uzBildDatei = null;
  if (sternzeit()) uebungszeitBild({ sekunden: k.sek, code: k.code, name: S.einstellungen.name || '', sternzeit: sternzeitJetzt(), titel: appName() }).then(f => { uzBildDatei = f; });
  const schluss = BS.uzStatus(k, S.uzRegeln) === 'schluss';
  const kopf = sternzeit() ? szKopf() : '<header class="topbar"><button class="btn-text" data-act="start">‹ Zum Start</button></header>';
  $app.innerHTML = `
  <div class="screen sz-screen uz-screen">
    ${kopf}
    <div class="uz-panel">
      <div class="uz-stern" aria-hidden="true">✦</div>
      <div class="uz-titel">${schluss ? 'Für heute ist Schluss mit Üben.' : 'Für heute hast du dein Pensum erreicht.'}</div>
      <p class="uz-text">Du hast heute ${Math.floor(k.sek / 60)} Min. geübt. Das ist stark.<br>${sternzeit() ? 'Logbuch, Archiv und Spiele sind weiter offen.' : 'Die Spiele sind weiter offen.'}</p>
      ${uzGeschickt || k.gefragt ? '<p class="uz-text"><b>Deine Eltern sind gefragt.</b><br>Wenn sie mehr Übungszeit geben, geht es hier weiter.</p>' : '<p class="uz-text">Möchtest du noch weiter? Frag deine Eltern.</p>'}
    </div>
    <button class="sz-knopf uz-knopf" data-act="uzTeilen">${k.gefragt ? 'Noch einmal fragen' : 'Eltern fragen'}</button>
    <p class="uz-code">Dein Code: <b>${esc(k.code.split('').join(' '))}</b></p>
    <p class="meldung-bz" id="uz-meldung" hidden></p>
    ${sternzeit() ? '<div class="sz-zeile"><button class="sz-knopf flieder klein" data-act="logbuch">Logbuch</button><button class="sz-knopf blau klein" data-act="archiv">Archiv</button></div>' : ''}
    <button class="sz-knopf matt klein" data-act="start">Zum Start</button>
  </div>`;
}

async function uzTeilen() {
  const k = uzKonto();
  const text = BS.uzNachricht(S.einstellungen.name, k, k.code);
  let geteilt = false, mitBild = false;
  if (navigator.share) {
    mitBild = !!(uzBildDatei && navigator.canShare && navigator.canShare({ files: [uzBildDatei], text }));
    try { await navigator.share(mitBild ? { files: [uzBildDatei], text } : { text }); geteilt = true; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (!geteilt) {
    try { await navigator.clipboard.writeText(text); } catch (e) { /* egal */ }
    const m = document.getElementById('uz-meldung');
    if (m && m.hidden) { m.hidden = false; m.textContent = 'Der Text ist kopiert. Füge ihn in deine Nachricht ein. Dann tippe noch einmal auf „Eltern fragen“.'; return; }
  }
  k.gefragt = new Date().toISOString();
  protokoll(S, 'uebungszeit_anfrage', { code: k.code, sek: k.sek, bild: !!mitBild });
  sichern();
  syncen(true);
  uzGeschickt = true;
  zeigeUebungszeit();
}

// Startbildschirm in der Gestaltung Sternzeit
function zeigeStartSternzeit({ bz, slot, serieAktiv }) {
  const nm = S.einstellungen.name ? esc(S.einstellungen.name) : '';
  const etappen = S.etappeAnzeigen && pakete() ? S.pakete.filter(p => p.paket.etappen && p.etappe > 0) : [];
  const w = SZ.wissenVon(S.wissen);
  const sp = SP.splitterVon(S.splitter);
  const gesperrt = uzGesperrt();
  const neu = ungelesen().length;
  const spz = bed('spielzeit_zeigen');
  $app.innerHTML = `
  <div class="screen sz-screen start">
    <div class="logo sz-logo-flaeche" id="logo">${szKopf()}</div>
    <p class="sz-gruss">Willkommen an Bord${nm ? `, <b>${nm}</b>` : ''}.</p>
    ${S.upload.testgeraet ? testLeisteHtml() : ''}
    ${gesperrt ? `<div class="sz-panel orange"><b class="sz-pfirsich">Für heute hast du dein Pensum erreicht.</b><div class="sz-matt">Logbuch, Archiv${spz ? ' und Spiele sind' : ' sind'} weiter offen.</div></div>
    <button class="sz-knopf" data-act="uebungszeit">Eltern fragen <small>▶</small></button>`
      : `<button class="sz-knopf sz-start-knopf" data-act="aufgaben">${S.wartet ? 'Weiter mit deiner Aufgabe' : 'Aufgaben machen'} <small>▶</small></button>`}
    <div class="sz-zeile"><button class="sz-knopf flieder klein" data-act="logbuch">Logbuch${neu ? ` · ${neu} neu` : ''}</button><button class="sz-knopf blau klein" data-act="archiv">Archiv</button></div>
    ${etappen.map(p => `<div class="sz-etappe">◆ ${esc(p.paket.name)} · <b>Etappe ${p.etappe} von ${p.paket.etappen.length}</b></div>`).join('')}
    <div class="sz-zeile">
      ${spz ? `<div class="sz-panel blau"><div class="sz-label">Spielzeit</div><div class="sz-wert">${L.formatZeit(S.guthaben)}</div></div>` : ''}
      <div class="sz-panel gelb"><div class="sz-label">Wissenspunkte</div><div class="sz-wert gelb">${w.stand}</div></div>
    </div>
    ${bz && bz.stand > 0 ? `<div class="sz-panel blau sz-bz"><div><div class="sz-label">Bildschirmzeit gesammelt</div><div class="sz-wert">${BS.minText(bz.stand)}</div></div>${BS.kannAbschicken(bz, BZ()) ? '<button class="sz-knopf blau klein" data-act="bzSeite">Abschicken</button>' : `<span class="sz-matt klein">${abText(bz)}</span>`}</div>` : ''}
    ${slot && spz ? `<div class="sz-panel orange sz-bz"><div><b>${minText(R().basisMin)} Spielzeit sind da!</b></div><button class="sz-knopf klein" data-act="basis">Abholen</button></div>` : ''}
    ${spz ? `<button class="sz-knopf matt klein" data-act="spielauswahl">Spiele <small>${sp.stand} Runensplitter</small></button>` : ''}
    <div class="sz-panel"><div class="sz-label">Heute</div>
      <div>${S.tag.aufgaben} ${S.tag.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'} · ${S.tag.ersterVersuch} im 1. Versuch${S.tag.teil ? ` · ${S.tag.teil} mit Tipp geschafft` : ''}${serieAktiv ? ` · Serie ${S.serie.pos}` : ''}</div>
      ${spz || UZ().an ? `<div class="sz-matt klein">${[spz ? `Spielzeit verdient: ${L.formatMinuten(S.tag.verdient)} von ${BS.minText(BS.szGrenzeSek(S.szRegeln, S.tag.key))}` : '', UZ().an ? `Übungszeit: ${Math.floor(uzKonto().sek / 60)} Min.` : ''].filter(Boolean).join(' · ')}</div>` : ''}</div>
    <p class="version-zeile">Version ${APP_VERSION}</p>
    ${hatSpeicherFehler() ? '<p class="warnung">Der Speicher ist voll oder gesperrt. Bitte einem Erwachsenen Bescheid geben.</p>' : ''}
  </div>`;
  langDruecken(document.getElementById('logo'), elternZugang);
}

// ---------- Wofür übst du jetzt? (vor der ersten Aufgabe einer Runde) ----------
function zeigeWahl() {
  setzeAnsicht('wahl');
  const k = bzKonto();
  const rest = BS.restSek(k, BZ());
  const grenze = BS.grenzeSek(BZ(), k.tag);
  tagAktualisieren(S);
  const szRest = BS.szRestSek(S.szRegeln, S.tag.key, S.tag.verdient);
  const szGrenze = BS.szGrenzeSek(S.szRegeln, S.tag.key);
  $app.innerHTML = `
  <div class="screen wahl-screen">
    <header class="topbar"><button class="btn-text" data-act="start">‹ Zurück</button></header>
    <h2 class="wahl-frage">Wofür übst du jetzt?</h2>
    <p class="gedaempft wahl-info">Du kannst es beim nächsten Mal wieder wählen.</p>
    <button class="wahl-karte wk-schrein${szRest <= 0 ? ' voll' : ''}" data-act="zweck" data-w="spiel"${szRest <= 0 ? ' disabled' : ''}>
      <span class="wk-titel">Spielzeit im Schrein</span>
      <span class="wk-icons">${schreinIcons()}</span>
      <span class="wk-text">Für 2048, Kristallmine, Runenfall und die anderen Spiele hier.</span>
      <span class="wk-staffel">${szRest > 0 ? `Heute noch ${BS.minText(szRest)} von ${BS.minText(szGrenze)} möglich` : `Für heute ist die Spielzeit voll: ${BS.minText(szGrenze)}`}</span>
    </button>
    <div class="oder">oder</div>
    <button class="wahl-karte wk-bild${rest <= 0 ? ' voll' : ''}" data-act="zweck" data-w="bild"${rest <= 0 ? ' disabled' : ''}>
      <span class="wk-titel">Bildschirmzeit</span>
      <span class="wk-icons">${bildIcons()}</span>
      <span class="wk-text">Für Konsole, Computer und Videos. Du schickst sie danach an deine Eltern.</span>
      <span class="wk-staffel">${rest > 0 ? `Heute noch ${BS.minText(rest)} von ${BS.minText(grenze)} möglich` : `Für heute ist die Bildschirmzeit voll: ${BS.minText(grenze)}`}</span>
    </button>
    ${szRest <= 0 && rest <= 0 ? `<p class="voll-hinweis"><b>Für heute ist alle Zeit voll.</b><br>Runensplitter gibt es weiter.</p>
    <button class="btn btn-haupt" data-act="zweck" data-w="spiel">Für Runensplitter üben</button>` : ''}
    <p class="gedaempft wahl-fuss">${splitterSymbol(18)} Runensplitter gibt es bei beiden.</p>
  </div>`;
}

// ---------- Bildschirmzeit abschicken ----------
let bzGeschickt = null; // gerade abgeschickt: { sekunden } (für die Bestätigung)
let bzBildDatei = null;  // Bild zur Nachricht (PNG), vorbereitet beim Öffnen der Seite
function zeigeBildschirmzeit() {
  setzeAnsicht('bildschirm');
  const k = bzKonto();
  if (bzGeschickt) {
    $app.innerHTML = `
    <div class="screen bz-screen">
      <header class="topbar"><button class="btn-text" data-act="start">‹ Zum Start</button></header>
      <div class="bz-gross-icon">${videoSymbol(64)}</div>
      <div class="erfolg-titel bz-titel">Abgeschickt!</div>
      <p class="bz-mitte">${BS.minText(bzGeschickt.sekunden)} Bildschirmzeit sind unterwegs zu deinen Eltern.</p>
      <button class="btn btn-haupt btn-gross" data-act="start">Zum Start</button>
    </div>`;
    return;
  }
  if (!k.code && k.stand > 0) { k.code = BS.neuerCode(); sichern(); }
  const jetzt = new Date();
  // Bild für die Nachricht schon jetzt zeichnen: Beim Tippen auf „Teilen“ muss das Teilen-Fenster sofort aufgehen (iPhone)
  bzBildDatei = null;
  if (BS.kannAbschicken(k, BZ())) bildschirmBild({ sekunden: k.stand, aufgaben: k.aufgaben, code: k.code, name: S.einstellungen.name || '' }, jetzt).then(f => { bzBildDatei = f; });
  $app.innerHTML = `
  <div class="screen bz-screen">
    <header class="topbar"><button class="btn-text" data-act="start">‹ Zurück</button></header>
    <div class="bz-gross-icon">${videoSymbol(64)}</div>
    <div class="bz-gross">${BS.minText(k.stand)}</div>
    <p class="bz-mitte bz-label">Bildschirmzeit</p>
    ${BS.kannAbschicken(k, BZ()) ? `
    <p class="gedaempft bz-mitte">${esc(BS.zeitpunktText(jetzt))} Uhr<br>${k.aufgaben} ${k.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'} geschafft</p>
    <div><p class="gedaempft bz-mitte bz-code-label">Dein Code</p><div class="bz-code">${esc(k.code.split('').join(' '))}</div></div>
    <button class="btn btn-bz btn-gross" data-act="bzTeilen">Teilen</button>
    <p class="gedaempft bz-mitte">Schick die Nachricht an deine Eltern.<br>Danach steht hier wieder 0.</p>
    <p class="meldung-bz" id="bz-meldung" hidden></p>` : `<p class="bz-mitte">${k.stand > 0 ? abText(k) : 'Gerade ist nichts zum Abschicken da.'}</p>`}
  </div>`;
}

async function bzTeilen() {
  const k = bzKonto();
  if (!BS.kannAbschicken(k, BZ()) || !k.code) return;
  const text = BS.nachrichtText(k, new Date());
  let geteilt = false, mitBild = false;
  if (navigator.share) {
    mitBild = bzBildDatei && navigator.canShare && navigator.canShare({ files: [bzBildDatei], text });
    try { await navigator.share(mitBild ? { files: [bzBildDatei], text } : { text }); geteilt = true; }
    catch (e) { if (e && e.name === 'AbortError') return; } // abgebrochen: alles bleibt stehen
  }
  if (!geteilt) {
    // Kein Teilen-Fenster (z. B. Computer): Text kopieren
    try { await navigator.clipboard.writeText(text); } catch (e) { /* egal */ }
    const m = document.getElementById('bz-meldung');
    if (m && m.hidden) { m.hidden = false; m.textContent = 'Der Text ist kopiert. Füge ihn in deine Nachricht ein. Dann tippe noch einmal auf „Teilen“.'; return; }
  }
  const eintrag = BS.abschicken(k);
  protokoll(S, 'bildschirmzeit', { ...eintrag, faktor: BZ().faktor, bild: !!mitBild });
  sichern();
  syncen();
  bzGeschickt = { sekunden: eintrag.sekunden };
  zeigeBildschirmzeit();
  bzGeschickt = null;
}

function langDruecken(el, fn) {
  let t = null;
  const start = e => { e.preventDefault(); t = setTimeout(() => { t = null; fn(); }, 1500); };
  const stop = () => { if (t) clearTimeout(t); t = null; };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, stop));
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// ============ Aufgaben ============

function merkTeile(a) {
  return (a.gegeben || []).map(g => ({ art: 'zahl', merk: true, label: `${g.name} =`, ziel: { wert: g.wert }, einheit: g.einheit || '' }));
}
function teileVon(a) {
  // Knobeln: zuerst nur ein Ergebnisfeld, „In Schritten rechnen“ blendet die Schritte ein
  if (a.modus === 'knobeln') return [ergebnisTeil(a, true)];
  return [...merkTeile(a), ...hauptTeile(a)];
}
const physik = (a) => L.fachVon(a) === 'physik';
// Ergebnisfeld einer Aufgabe (Knobeln und letztes Feld nach den Schritten)
function ergebnisTeil(a, knobel = false) {
  const w = a.antwort || {};
  const letzte = (a.schritte || [])[a.schritte ? a.schritte.length - 1 : 0];
  if (a.typ === 'zehnerpotenz' || typeof w.mantisse === 'number') return { art: 'zp', antwort: w, einheit: w.einheit || '', knobel };
  const label = letzte && typeof letzte.wert === 'number' && L.gleich(letzte.wert, w.wert) ? letzte.text : null;
  return { art: 'zahl', label, ziel: { wert: w.wert, gueltige: w.gueltige_ziffern || undefined }, einheit: w.einheit || '', knobel, quelle: knobel ? null : letzte };
}
// Teile mit Schritten (nach „In Schritten rechnen“): Merkzettel, Schritte und, wenn nötig, das Ergebnisfeld
function schritteTeile(a) {
  const st = schritteVon(a.schritte || [], a.thema);
  const w = a.antwort || {};
  const ziel = typeof w.mantisse === 'number' ? w.mantisse * 10 ** w.exponent : w.wert;
  const letzte = (a.schritte || [])[(a.schritte || []).length - 1];
  const fertig = a.typ !== 'zehnerpotenz' && !!(letzte && typeof letzte.wert === 'number' && typeof ziel === 'number' && Math.abs(letzte.wert - ziel) <= 1e-9 * Math.max(1, Math.abs(ziel)));
  return [...merkTeile(a), ...st, ...(fertig ? [] : [ergebnisTeil(a)])];
}
function schritteVon(liste, thema) {
  return liste.map(s => s.linien_waehlen
    ? { art: 'linien', label: s.text, richtig: s.linien_waehlen.richtig.slice(), linien: [], quelle: s }
    : s.bruch
    ? { art: 'bruch', label: s.text, antwort: { zaehler: s.bruch.zaehler, nenner: s.bruch.nenner }, nennerFest: !!s.bruch.nenner_fest, quelle: s }
    : s.karten
    ? { art: 'legen', label: s.text, karten: s.karten, wahl: s.karten.map(() => null), quelle: s }
    : s.optionen
    ? { art: 'wahl', label: s.text, optionen: L.KOERPER_THEMEN.includes(thema) ? s.optionen.map(L.mitKuerzel) : s.optionen, richtig: s.richtig, quelle: s, formel: s.optionen.every(o => /=/.test(o)) }
    : { art: 'zahl', label: s.text, ziel: { wert: s.wert, toleranz: s.toleranz, runden: s.runden, gueltige: s.gueltige_ziffern || undefined, genau: s.genau, varianten: s.varianten, abgeschnitten: s.abgeschnitten, auch: s.auch }, einheit: s.einheit || '', quelle: s });
}

function hauptTeile(a) {
  switch (a.typ) {
    case 'zahl': return [{ art: 'zahl', ziel: { wert: a.antwort.wert, gueltige: a.antwort.gueltige_ziffern || undefined }, einheit: a.antwort.einheit || '' }];
    case 'bruch': return [{ art: 'bruch', antwort: a.antwort }];
    case 'auswahl': {
      const werte = a.optionen.map(L.potenzWert);
      const teile = [];
      // Gegen Raten: erst die Werte ausrechnen, dann wählen
      if (werte.every(Boolean)) a.optionen.forEach((o, i) => teile.push({ art: 'zahl', label: `${o} =`, ziel: { wert: werte[i].wert }, einheit: '', rechnung: o }));
      teile.push({ art: 'wahl', label: a.frage, optionen: a.optionen, richtig: a.antwort.richtig });
      return teile;
    }
    case 'schritte': return schritteVon(a.schritte, a.thema);
    case 'detektiv': {
      // Fehler-Detektiv (Auftrag 17): Stimmt / Stimmt nicht → Was ist falsch? → richtig rechnen
      const teile = [{ art: 'wahl', detektiv: true, label: a.frage, optionen: ['Stimmt', 'Stimmt nicht'], richtig: a.stimmt ? 0 : 1 }];
      if (!a.stimmt) {
        const reihe = a.fehler_optionen.map((o, k) => [Math.random(), o, k]).sort((x, y) => x[0] - y[0]);
        teile.push({ art: 'wahl', spalte: true, label: 'Was ist falsch?', optionen: reihe.map(x => x[1]), richtig: reihe.findIndex(x => x[2] === a.fehler_richtig) });
        const rr = a.richtig_rechnen;
        teile.push({ art: 'zahl', label: rr.text, ziel: { wert: rr.wert, runden: rr.runden }, einheit: rr.einheit || '', quelle: { text: rr.text, wert: rr.wert, runden: rr.runden, einheit: rr.einheit } });
      }
      return teile;
    }
    case 'zehnerpotenz': return [{ art: 'zp', antwort: a.antwort, einheit: a.antwort.einheit || '' }];
    case 'formel': {
      const w = a.antwort;
      if (a.eingabe === 'auswahl') return [{ art: 'wahl', label: a.frage, optionen: a.optionen, richtig: w.richtig, formel: true }];
      return [{ art: 'formel', fmodus: a.eingabe, antwort: w, karten: a.karten || null }];
    }
    case 'mehrfrage': return a.fragen.map(q => ({ art: 'zahl', label: q.frage, ziel: { wert: q.wert }, einheit: q.einheit || '', bonus: !!q.bonus, quelle: q, rechnung: /\s=$/.test(q.frage) ? q.frage.replace(/\s=$/, '') : undefined }));
    case 'zuordnung': return [{ art: 'zuordnung' }];
  }
  return [];
}

const MUSTER = ['leicht', 'thema', 'thema', 'text', 'mix', 'thema', 'struktur', 'mix', 'thema', 'abschluss'];
const wahl = arr => arr[Math.floor(Math.random() * arr.length)];
// Stufe eines Baukastens, höchstens bis zur Grenze der aktuellen Etappe
const stufeGrenze = g => LP.baukastenGrenze(g, grenzen()).stufeMax;
// Befristete Grenzen (Auftrag 36): einstellungen.json → werte.befristet, gilt bis einschließlich „bis“
const BEF = () => L.befristetAktiv(S, S.tag.key);
const befStufe = (g, st) => { const b = BEF(), m = b && b.stufe_max && b.stufe_max[g]; return m ? Math.min(st, m) : st; };
const befOpts = (g) => { const b = BEF(); return b && b.prozent && ['prozent', 'rabatt-geschichte'].includes(g) ? { saetze: b.prozent } : {}; };
const befGeteilt = () => { const b = BEF(); return b && b.einmaleins_geteilt != null ? { geteilt: b.einmaleins_geteilt } : {}; };
const genStufe = g => befStufe(g, Math.min((S.genStufen[g] || { stufe: 1 }).stufe, stufeGrenze(g)));

function fokusOptionen() {
  const n = S.log.slice(-300).filter(e => e.typ === 'versuch' && e.fehler === 'vorzeichen').length;
  return n >= 2 ? { fokus: 'vorzeichen' } : {};
}

// Doppeltes Minus und Minus vor Klammer (Auftrag 21): nur mit Freigabe ab ihrem Datum; die ersten 5 je Form mit Zwischenschritt
const formOpts = (g) => ((g === 'minus-plus' || g === 'reihenfolge') && L.freigegeben(S, 'minusminus', S.tag.key) ? { minusminus: true, formZaehler: S.verlauf.formZaehler || {} } : {});
function erzeuge(g, stufe, opts = {}) {
  const letzte = S.verlauf.letzteIds.slice(-15);
  // Etappe ohne „Was ist gesucht?“ (Zylinder, Etappe 3)
  const bgOhne = LP.baukastenGrenze(g, grenzen()).ohne;
  if (bgOhne.includes('auswahl')) opts = { ...opts, ohneAuswahl: true };
  // Varianten, die die Etappe nicht erlaubt (Dichte: vergleich, verhaeltnis, gewichtskraft)
  if (bgOhne.length) opts = { ...opts, ohne: bgOhne };
  opts = { ...opts, ...formOpts(g), ...befOpts(g) };
  stufe = befStufe(g, stufe);
  let a;
  for (let i = 0; i < 8; i++) {
    a = G.GENERATOREN[g](stufe, Math.random, opts);
    if (a && !letzte.includes(a.id) && heuteOk(a)) break;
  }
  if (a && BEF() && (befOpts(g).saetze || (BEF().stufe_max || {})[g])) a = { ...a, grenze_bis: BEF().bis };
  // Kreisdiagramm (Auftrag 33): ab der Freigabe von Prozent mit Formel auch Hinweis 23
  if (a && g === 'kreisdiagramm' && L.themaFreigegeben(S, 'prozent-formel', L.tagKey()) && !a.hinweise.includes('formel')) a = { ...a, hinweise: [...a.hinweise, 'formel'] };
  return a;
}

// Gewichte der Themen: aus dem Paket der Eltern-App, sonst Übungsthema auf „viel“
const gewichte = () => pakete() ? LP.gewichteAlle(S.pakete, S.abweichungen) : (S.paket && S.paket.gewichte) ? P.gewichteNorm(S.paket.gewichte) : P.gewichteOhnePaket(S.einstellungen.thema);

// ---------- Mehrere Pakete und Etappen (js/lernplan.js) ----------
const pakete = () => (Array.isArray(S.pakete) && S.pakete.length ? S.pakete : null);
let grenzenCache = null;
function grenzen() {
  const pk = pakete();
  if (!pk) return { stufeMax: {}, ohne: {}, pool: {}, gesperrt: new Set(), genGesperrt: new Set() };
  const schluessel = JSON.stringify(pk.map(p => [p.id, p.etappe])) + alleAufgaben().length;
  if (grenzenCache && grenzenCache.k === schluessel) return grenzenCache.g;
  const themen = new Map(alleAufgaben().map(a => [a.id, a.thema]));
  const g = LP.grenzenVon(pk, id => themen.get(id), [...themen.keys()]);
  grenzenCache = { k: schluessel, g };
  return g;
}
const erlaubt = (a) => L.befristetErlaubt(a, BEF()) && LP.aufgabeErlaubt(a, grenzen()) && !(a && wpGesperrt().includes(a.thema)) && !(a && !L.themaFreigegeben(S, a.thema, L.tagKey()));
// Nächste Etappe wird ab ihrem Datum wirksam (Gerätezeit)
function etappenAktualisieren() {
  if (!pakete()) return;
  for (const w of LP.naechsteAnwenden(S.pakete, L.tagKey())) protokoll(S, 'etappe_neu', w);
  paketStarts();
}
// Paket mit „start“ (Auftrag 15): startet, sobald das auslösende Paket seine Etappe erreicht.
// Etappe 1, Rollen und Anteile aus start; danach steht der Wechsel auch in einstellungen.json (Version + 1).
// Gibt die neu begonnenen Pakete für die Feier „Neue Etappe freigeschaltet“ zurück.
function paketStarts() {
  const pk = pakete();
  if (!pk) return [];
  const neu = [];
  for (const p of LP.startFaellig(pk)) {
    const info = LP.startAusfuehren(pk, p.id);
    if (!info) continue;
    grenzenCache = null;
    protokoll(S, 'paket_start', { paket: info.paket, ausgeloest_durch: info.ausgeloest_durch, etappe: info.etappe });
    if (!S.upload.testgeraet) S.startOffen = [...new Set([...(S.startOffen || []), info.paket])];
    if (info.neu && p.paket.etappen) neu.push({ paket: p.id, name: p.paket.name, nr: p.etappe, von: 0, anzahl: p.paket.etappen.length, etappeName: p.paket.etappen[p.etappe - 1].name });
  }
  if (neu.length || (S.startOffen || []).length) { logbuchAktualisieren(); sichern(); startSenden(); }
  return neu;
}
// Gestartete Pakete in daten/<name>/einstellungen.json eintragen (nie auf Testgeräten)
let startLaeuft = false;
async function startSenden() {
  const u = S.upload;
  if (startLaeuft || u.testgeraet || !u.token || !u.repo || !S.einstellungen.name || !(S.startOffen || []).length) return;
  startLaeuft = true;
  const pfad = `daten/${fernOrdner()}/einstellungen.json`;
  try {
    for (const id of S.startOffen.slice()) {
      const alt = await U.dateiLesen(u, pfad);
      const neu = LP.startInDatei(alt, id);
      if (neu) {
        await U.dateiSchreiben(u, pfad, JSON.stringify(neu, null, 1), `Einstellungen für ${fernOrdner()} (Version ${neu.version}): Paket ${id} gestartet`);
        L.fernAnwenden(S, neu);
      }
      S.startOffen = S.startOffen.filter(x => x !== id);
      sichern();
    }
  } catch (e) {
    protokoll(S, 'paket_start_offen', { fehler: e.message || 'Senden hat nicht geklappt.' });
  } finally {
    startLaeuft = false;
  }
}
// Lerneinheit mit „weiter: automatisch“: Sitzt die Etappe (8 von 10 im 1. Versuch, ohne „Hilf mir“ und „Mehr Hilfe“),
// öffnet sich die nächste sofort (wenn sie schon offen ist, also nicht „kommt bald“). Gibt die neue Etappe zurück.
function etappeAutomatisch() {
  const p = (pakete() || []).find(x => x.id === A.paket);
  if (!p || !p.paket.etappen || p.paket.weiter !== 'automatisch' || A.test || A.etappe !== p.etappe || p.etappe >= p.paket.etappen.length) return null;
  const letzte = S.log.filter(e => e.typ === 'aufgabe_ende' && e.paket === p.id && e.etappe === p.etappe).slice(-10).map(e => ({ ende: e }));
  if (!LP.etappeSitzt(letzte).sitzt) return null;
  if (!LP.etappeOffen(p.paket, p.etappe + 1, LOGBUCH)) return null;
  const von = p.etappe;
  p.etappe = von + 1;
  delete p.naechste;
  grenzenCache = null;
  protokoll(S, 'etappe_neu', { paket: p.id, von, nach: p.etappe, grund: 'automatisch' });
  logbuchAktualisieren();
  return { paket: p.id, name: p.paket.name, nr: p.etappe, von, anzahl: p.paket.etappen.length, etappeName: p.paket.etappen[p.etappe - 1].name };
}
const paketInfo = (id) => { const p = (pakete() || []).find(x => x.id === id); return p ? { paket: p.id, ...(p.paket.etappen ? { etappe: p.etappe } : {}) } : {}; };
// Aus welchem Paket stammt eine Aufgabe (für Wiederholungen und wartende Aufgaben): erstes aktives Paket mit diesem Thema
function paketFuerThema(t) {
  const pk = pakete();
  if (!pk) return null;
  const p = LP.aktive(pk).find(p => (LP.gewichteVon(p, S.abweichungen)[t] || 0) > 0);
  return p ? p.id : null;
}

// ---------- Testgerät: gezielt testen (Bereich und Stufe wählbar) ----------
// Welche Baukästen zu einem Thema gehören; Themen ohne Baukasten kommen nur aus dem Pool.
const TEST_GEN = {
  'minus-zahlen': ['minus-plus', 'geld-geschichte'], 'reihenfolge': ['reihenfolge'], 'potenzen': ['potenz'], 'bruch-bild': ['bruch-bild'],
  'prozent': ['prozent'], 'prozent-baukasten': ['baukasten'], 'prozent-formel': ['prozent-formel'], 'kreisdiagramm': ['kreisdiagramm'], 'rabatt': ['rabatt-geschichte'], 'neuer-preis': ['rabatt-geschichte'],
  'runden': ['runden'], 'kugel': ['kugel'], 'einmaleins': ['einmaleins'], 'mal-10': ['mal10'], 'zylinder': ['zylinder'], 'kegel': ['kegel'], 'pyramide': ['pyramide'],
  'zehnerpotenzen': ['zehnerpotenz'], 'einheiten': ['einheiten'], 'gewichtskraft': ['gewichtskraft'], 'umstellen': ['gleichung', 'formel-umstellen'], 'dichte': ['dichte']
};
const testFokus = () => (S.upload.testgeraet && S.testFokus && L.THEMEN.includes(S.testFokus.thema) ? S.testFokus : null);

function testAufgabe(thema, stufe) {
  const letzte = S.verlauf.letzteIds.slice(-10);
  const pool = alleAufgaben().filter(a => a.thema === thema && a.stufe === stufe && !letzte.includes(a.id));
  const gens = TEST_GEN[thema] || [];
  const ausPool = () => pool.length ? wahl(pool) : null;
  const ausBaukasten = () => {
    if (!gens.length) return null;
    const g = wahl(gens);
    let a;
    for (let i = 0; i < 8; i++) {
      a = g === 'einmaleins' ? G.block('einmaleins', Math.random, stufe, befGeteilt()) : G.GENERATOREN[g](stufe, Math.random, { ...formOpts(g), ...befOpts(g) });
      if (a && !letzte.includes(a.id)) break;
    }
    return a;
  };
  // Halb Pool, halb Baukasten, wenn es beides gibt
  return (Math.random() < 0.5 ? ausPool() || ausBaukasten() : ausBaukasten() || ausPool()) || null;
}

function testAuswahl(thema) {
  const gens = TEST_GEN[thema] || [];
  return [1, 2, 3].map(st => ({ st, pool: alleAufgaben().filter(a => a.thema === thema && a.stufe === st).length, gen: gens.length > 0 }));
}

function einmaleinsBlock(stufe, leicht = false) {
  const letzte = S.verlauf.letzteIds.slice(-15);
  const o = leicht ? {} : befGeteilt();
  let b;
  for (let i = 0; i < 8; i++) { b = G.block('einmaleins', Math.random, stufe, o); if (!letzte.includes(b.id)) break; }
  if (b && o.geteilt != null) b.grenze_bis = BEF().bis;
  return b;
}

// Physik und Umstellen: Thema nur, wenn die Etappe dafür gerade Pool-Aufgaben oder einen Baukasten hat
function themaVerfuegbar(t) {
  if (P.KOPF_GEN[t].some(g => !LP.baukastenGrenze(g, grenzen()).gesperrt)) return true;
  return alleAufgaben().some(a => a.thema === t && !a.bonus && erlaubt(a));
}
function kurzeAufgabe(g, fokus, { leicht = false } = {}) {
  if (P.HALB_POOL.some(t => g[t] > 0 && !themaVerfuegbar(t))) g = Object.fromEntries(Object.entries(g).map(([t, w]) => [t, P.HALB_POOL.includes(t) && w > 0 && !themaVerfuegbar(t) ? 0 : w]));
  const thema = P.kopfThema(g, Math.random, S.verlauf.kopfZuletzt);
  if (!thema) return null;
  S.verlauf.kopfZuletzt = thema;
  // Einmaleins immer als Dreierblock (Wunsch Vater), mit der Stufe des Baukastens
  if (thema === 'einmaleins') {
    const b = einmaleinsBlock(leicht ? 1 : genStufe('einmaleins'), leicht);
    if (!leicht) b.stufeZaehlt = true; // zählt für die Stufe des Baukastens (Einstieg nicht)
    return b;
  }
  // Physik und Umstellen: etwa halb Pool (mit Geschichten), halb Baukasten; nur, was die Etappe erlaubt
  if (P.HALB_POOL.includes(thema)) return halbPoolAufgabe(thema, fokus);
  if (leicht && P.BLOCK_GEN[thema] && Math.random() < 0.4) return G.block(P.BLOCK_GEN[thema], Math.random);
  if (!leicht && Math.random() < 0.15) {
    const p = L.waehleAufgabe(alleAufgaben().filter(erlaubt), { kategorie: 'thema', thema, statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key, gesperrt: loesungGesperrt() });
    if (p && p.thema === thema && !p.geschichte && !p.bonus) return p;
  }
  // Minus-Zahlen: manchmal eine ganz kurze Geldgeschichte (1–2 Sätze), damit Text normal wird
  if (thema === 'minus-zahlen' && !leicht && Math.random() < 0.25) {
    const letzte = S.verlauf.letzteIds.slice(-15);
    for (let i = 0; i < 8; i++) { const m = G.geldGeschichte(1, Math.random, { mini: true }); if (!letzte.includes(m.id)) return m; }
  }
  const gen = wahl(P.KOPF_GEN[thema]);
  return erzeuge(gen, leicht ? 1 : genStufe(gen), fokus);
}

function halbPoolAufgabe(thema, fokus) {
  const ausPool = () => {
    const p = L.waehleAufgabe(alleAufgaben().filter(a => a.thema === thema && !a.bonus && erlaubt(a)), { kategorie: 'thema', thema, statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key, gesperrt: loesungGesperrt() });
    return p && p.thema === thema ? p : null;
  };
  const ausBaukasten = () => {
    const gens = P.KOPF_GEN[thema].filter(g => !LP.baukastenGrenze(g, grenzen()).gesperrt);
    if (!gens.length) return null;
    const g = wahl(gens);
    return erzeuge(g, genStufe(g), fokus);
  };
  return Math.random() < 0.5 ? ausPool() || ausBaukasten() : ausBaukasten() || ausPool();
}

function waehleAufgabe(kategorie) {
  const gAlle = gewichte();
  const faellig = S.wiederholen.find(w => w.ab <= S.verlauf.zaehler && (gAlle[w.aufgabe.thema] || 0) > 0 && erlaubt(w.aufgabe) && (w.nachLoesung || heuteOk(w.aufgabe))
    && !(w.feste && w.aufgabe.typ === 'detektiv' && kategorie !== 'struktur'));
  if (faellig && kategorie !== 'abschluss') {
    S.wiederholen = S.wiederholen.filter(w => w !== faellig);
    // Nach „Zeig mir die Lösung“ (Auftrag 32)
    if (faellig.nachLoesung) {
      const auf = faellig.feste ? andereFeste(faellig.aufgabe, faellig.nachLoesungSchritt) : neueZahlen(faellig.aufgabe, faellig.nachLoesungSchritt);
      if (auf) {
        if (faellig.feste) { const st = S.statistik[faellig.aufgabe.id]; if (st) st.ersetzt = true; }
        return { aufgabe: auf, wdh: faellig.wdh, paket: paketFuerThema(auf.thema), nachLoesung: faellig.nachLoesung, ...(faellig.nachLoesungSchritt ? { nachLoesungSchritt: faellig.nachLoesungSchritt } : {}) };
      }
      // keine andere feste Aufgabe: dieselbe kommt frühestens nach 20 Minuten Übungszeit über die normale Auswahl
      return waehleAufgabe(kategorie);
    }
    // Nach dem Hinweis gegen Durchklicken: dieselbe oder eine ähnliche Aufgabe, mit Bonuszeit (Auftrag 18)
    const auf = faellig.bonus ? aehnlicheAufgabe(faellig.aufgabe) : faellig.aufgabe;
    return { aufgabe: auf, wdh: faellig.wdh, paket: paketFuerThema(auf.thema), bonus: !!faellig.bonus };
  }
  // Wochenplan (Auftrag 24): Art nach Übungszeit, Takt und Erinnerungen; ohne laufenden Plan wie bisher.
  // Einstieg und Takt (motivierende Aufgabe) gehen dem Mindestanteil der Etappe vor.
  const wpl = wpJetzt();
  if (wpl && wpMotivationDran(wpl)) { const r = wpAufgabe(wpl, kategorie); if (r) return r; }
  if (kategorie !== 'leicht') { const m = etappeMindestAufgabe(); if (m) return m; }
  if (wpl) { const r = wpAufgabe(wpl, kategorie); if (r) return r; }
  const pk = pakete();
  // Anteile nach Übungszeit (Auftrag 23): Paket mit deutlichem Rückstand bekommt den Platz, auch wenn es sonst nicht hineinpasst
  if (pk && kategorie !== 'leicht') {
    const au = LP.paketAusgleich(LP.aktive(pk), heuteTag().paketMs, heuteTag().gestartet);
    const r = au && paketAufgabe(au.paket, kategorie);
    if (r) { protokoll(S, 'paket_ausgleich', { paket: au.paket.id, plan: au.plan, ist: au.ist, platz: kategorie, id: r.aufgabe.id }); return { ...r, paket: au.paket.id, ausgleich: true }; }
  }
  if (!pk) return { ...waehleIn(kategorie, gAlle, true), paket: null };
  // Mehrere Pakete: pro Platz erst das Paket nach Anteil, dann das Thema nach Gewicht.
  // Pakete ohne passendes Thema für diesen Platz fallen heraus, ihre Anteile werden neu verteilt.
  // Der Einstieg kommt immer aus dem Grundpaket.
  const grund = LP.grundpaket(pk);
  let offen = kategorie === 'leicht' ? [grund] : LP.aktive(pk);
  if (!offen.length) offen = [grund];
  while (offen.length) {
    const p = LP.zieheNachAnteil(offen);
    const r = waehleIn(kategorie, LP.gewichteVon(p, S.abweichungen), false);
    if (r.aufgabe) return { ...r, paket: p.id };
    offen = offen.filter(x => x !== p);
  }
  return { ...waehleIn(kategorie, LP.gewichteVon(grund, S.abweichungen), true), paket: grund.id };
}

// Eine Aufgabe aus genau diesem Paket, zuerst für den Platz, sonst auf einem Platz, den das Paket füllen kann
function paketAufgabe(p, kategorie) {
  const g = LP.gewichteVon(p, S.abweichungen);
  for (const k of [kategorie, 'koerper', 'struktur', 'thema', 'text']) {
    const r = waehleIn(k, g, false);
    if (r.aufgabe && heuteOk(r.aufgabe)) return r;
  }
  return null;
}

// Heute (Auftrag 23): gestartete Aufgaben je id und Arbeitszeit je Paket. S.tag beginnt jeden Tag neu.
function heuteTag() {
  if (!S.tag.ids) S.tag.ids = {};
  if (!S.tag.paketMs) S.tag.paketMs = {};
  if (S.tag.gestartet == null) S.tag.gestartet = 0;
  return S.tag;
}
// Dieselbe Aufgabe (gleiche id, bei Baukästen also gleiche Zahlen) höchstens 2-mal am Tag
// Arten nur mit wenigen festen Aufgaben und ohne Baukasten (z. B. Neuer Preis, Kreisdiagramm, Zuordnung):
// jede Aufgabe höchstens 1-mal am Tag, lieber seltener als Wiederholungen (Auftrag 30, Ferien)
let knappCache = null;
function knappeThemen() {
  if (knappCache && knappCache.n === alleAufgaben().length) return knappCache.s;
  const n = {}; for (const a of alleAufgaben()) if (!a.bonus) n[a.thema] = (n[a.thema] || 0) + 1;
  const mitBaukasten = new Set(Object.values(LP.GEN_THEMA));
  const s = new Set(Object.keys(n).filter(t => n[t] <= 3 && !mitBaukasten.has(t)));
  knappCache = { n: alleAufgaben().length, s };
  return s;
}
const heuteOk = (a) => !a || (((S.tag.ids || {})[a.id] || 0) < (!a.generator && knappeThemen().has(a.thema) ? 1 : 2) && !loesungGesperrt().has(a.id));
// ---------- Nach „Zeig mir die Lösung“ (Auftrag 32) ----------
// Baukasten: dieselbe Art mit neuen Zahlen. Feste Aufgaben: lieber eine andere derselben Art und Stufe,
// dieselbe erst nach 20 Minuten Übungszeit (S.verlauf.loesung: id → Übungszeit beim Zeigen der Lösung).
const uebMs = () => S.verlauf.uebMs || 0;
function loesungGesperrt() { const m = S.verlauf.loesung || {}; return new Set(Object.keys(m).filter(id => uebMs() - m[id] < L.LOESUNG_SPERRE_MS)); }
// Auftrag 37: Zylinder, gescheitert bei „Was ist gesucht?“ → am liebsten die Form gesucht4 (der Schritt kommt dort zuerst)
function gesucht4Aufgabe() {
  const bg = LP.baukastenGrenze('zylinder', grenzen());
  if (bg.gesperrt || bg.stufeMax < 3 || bg.ohne.includes('auswahl')) return null;
  return erzeuge('zylinder', 3, { gesucht4: true });
}
function neueZahlen(a, schritt) {
  if (!a.generator || !G.GENERATOREN[a.generator]) return null;
  if (a.generator === 'zylinder' && L.schrittSchluessel(schritt) === 'gesucht' && bed('teil_loesung')) { const g4 = gesucht4Aufgabe(); if (g4) return g4; }
  const k = L.artSchluessel(a);
  let ersatz = null;
  for (let i = 0; i < 40; i++) {
    const b = erzeuge(a.generator, a.stufe || 1, a.variante ? { variante: a.variante } : {});
    if (!b || b.id === a.id) continue;
    if (L.artSchluessel(b) === k) return b;
    ersatz = ersatz || b;
  }
  return ersatz;
}
function andereFeste(a, schritt) {
  const heute = S.tag.ids || {}, gesp = loesungGesperrt();
  const andere = alleAufgaben().filter(x => x.id !== a.id && !x.generator && x.thema === a.thema && (x.stufe || 1) === (a.stufe || 1) && (x.typ === 'detektiv') === (a.typ === 'detektiv')
    && !x.bonus && !heute[x.id] && !gesp.has(x.id) && erlaubt(x) && heuteOk(x) && (x.typ !== 'detektiv' || detektivHeute(x.id) < 2));
  // Auftrag 37: am liebsten eine Aufgabe, in der der gescheiterte Schritt früh vorkommt
  if (schritt && bed('teil_loesung')) {
    const k = L.schrittSchluessel(schritt);
    const pos = (x) => (x.schritte || []).findIndex(st => L.schrittSchluessel(st.text) === k);
    const mit = andere.filter(x => pos(x) >= 0);
    if (mit.length) { const min = Math.min(...mit.map(pos)); return wahl(mit.filter(x => pos(x) === min)); }
    if (a.thema === 'zylinder' && k === 'gesucht') { const g4 = gesucht4Aufgabe(); if (g4) return g4; }
  }
  return andere.length ? wahl(andere) : null;
}
function heuteZaehlen(a) { const t = heuteTag(); t.ids[a.id] = (t.ids[a.id] || 0) + 1; t.gestartet++; }
function paketZeitBuchen(paket, ms) { if (!paket || !(ms > 0)) return; const t = heuteTag(); t.paketMs[paket] = (t.paketMs[paket] || 0) + Math.min(ms, 10 * 60000); }
function simBuchen(a, paket, ms) { heuteZaehlen(a); paketZeitBuchen(paket, ms); }
// Auswahl mit Grenze „höchstens 2-mal am Tag“ (falls eine Auswahl doch eine schon zweimal gezeigte Aufgabe liefert)
function waehleBegrenzt(kategorie) {
  let r;
  for (let i = 0; i < 8; i++) { r = waehleAufgabe(kategorie); if (heuteOk(r.aufgabe)) return r; }
  return r;
}

// ---------- Wochenplan (Auftrag 24) ----------
// Nur mit gültigem, laufendem Plan in einstellungen.json. Sonst: alles wie bisher (Pakete, Gewichte, Muster).
let wpCache = null;
function wpJetzt() {
  if (!S.wochenplan) return null;
  const tag = L.tagKey();
  if (!wpCache || wpCache.roh !== S.wochenplan || wpCache.tag !== tag) { const wp = W.wpNorm(S.wochenplan); wpCache = { roh: S.wochenplan, tag, wp: W.wpLaeuft(wp, tag) ? wp : null }; }
  return wpCache.wp;
}
let wpGespCache = null;
function wpGesperrt() {
  const wp = wpJetzt(); if (!wp) return [];
  const k = JSON.stringify([S.wochenplan, S.eingriffe, L.tagKey(), (S.pakete || []).map(p => p.id), S.freigaben]);
  if (!wpGespCache || wpGespCache.k !== k) wpGespCache = { k, t: W.gesperrteThemen(wp, S.pakete || [], S.eingriffe, L.tagKey(), S.freigaben) };
  return wpGespCache.t;
}
// Wann wurde ein Thema zuletzt geübt? Beim Start eines Plans aus dem Protokoll, danach laufend gepflegt.
function zuletztAusLog(z = {}) {
  for (const e of S.log) if (e.typ === 'aufgabe_ende' && e.thema && e.t) { const d = L.tagKey(new Date(e.t)); if (!z[e.thema] || z[e.thema] < d) z[e.thema] = d; }
  return z;
}
// Stand zum laufenden Plan: Übungszeit je Thema seit ab (beim ersten Mal aus dem Protokoll), Takt, Erinnerungen
function wpZustand(wp) {
  if (!S.wp || S.wp.ab !== wp.ab) {
    const ms = {}, n = {};
    for (const e of S.log) if (e.typ === 'aufgabe_ende' && e.thema && e.t && L.tagKey(new Date(e.t)) >= wp.ab && e.ms > 0) { ms[e.thema] = (ms[e.thema] || 0) + Math.min(e.ms, 10 * 60000); n[e.thema] = (n[e.thema] || 0) + 1; }
    S.wp = { ab: wp.ab, ms, n, seitMotivation: 0, letzteErinnerung: -9, erinnert: [], planIstTag: null, planIstHash: null };
    S.zuletzt = zuletztAusLog(S.zuletzt || {});
  }
  if (!S.zuletzt) S.zuletzt = zuletztAusLog({});
  return S.wp;
}
const wpArtenJetzt = (wp) => W.wpArten(wp, S.pakete || [], S.eingriffe, L.tagKey(), S.freigaben);
// Mittlere Dauer einer Aufgabe je Thema: seit Beginn des Plans, sonst aus dem Protokoll, sonst 30 s
let dauerCache = null;
function dauerJe(st) {
  if (!dauerCache || dauerCache.n !== S.log.length) {
    const ms = {}, n = {};
    for (const e of S.log) if (e.typ === 'aufgabe_ende' && e.thema && e.ms > 0) { ms[e.thema] = (ms[e.thema] || 0) + Math.min(e.ms, 10 * 60000); n[e.thema] = (n[e.thema] || 0) + 1; }
    dauerCache = { n: S.log.length, d: Object.fromEntries(Object.keys(ms).map(t => [t, ms[t] / n[t]])) };
  }
  const d = { ...dauerCache.d };
  for (const t of Object.keys(st.ms)) if ((st.n[t] || 0) >= 2) d[t] = st.ms[t] / st.n[t];
  for (const t of L.THEMEN) if (!d[t]) d[t] = 30000;
  return d;
}
// Gewicht eines Themas aus den Paketen (für die Wahl innerhalb einer Art mit mehreren Themen), sonst normal
function themaGewicht(t) { let g = 0; for (const p of (S.pakete || [])) g = Math.max(g, LP.gewichteVon(p, S.abweichungen)[t] || 0); return g || 2; }
// Eine Aufgabe aus diesen Themen. Der Einstieg kommt als leichte Aufgabe, sonst Plätze in zufälliger Folge.
function aufgabeAusThemen(themen, kategorie, motiv = false) {
  const g = Object.fromEntries(themen.map(t => [t, themaGewicht(t)]));
  // Motivation: kurze Aufgaben (keine Detektive, keine Geschichten); sonst alle Plätze in zufälliger Folge
  const plaetze = motiv ? ['thema'] : L.mischen(['thema', 'text', 'struktur', 'koerper', 'abschluss']);
  for (const k of (kategorie === 'leicht' ? ['leicht', ...plaetze] : plaetze)) {
    for (let i = 0; i < (motiv ? 4 : 1); i++) {
      const r = waehleIn(k, g, false, motiv);
      if (r.aufgabe && themen.includes(r.aufgabe.thema) && heuteOk(r.aufgabe) && erlaubt(r.aufgabe) && !(motiv && (r.aufgabe.typ === 'detektiv' || r.aufgabe.geschichte))) return r;
    }
  }
  return null;
}
// Themen, die die App gerade anbieten kann (für Erinnerungen): mit Gewicht in einem Paket oder im Plan
function wpKandidaten(arten) {
  const s = new Set(arten.flatMap(a => a.themen));
  for (const [t, w] of Object.entries(gewichte())) if (w > 0) s.add(t);
  return [...s].filter(t => !wpGesperrt().includes(t));
}
function wpAufgabe(wp, kategorie) {
  const arten = wpArtenJetzt(wp);
  if (!arten.length) return null;
  const st = wpZustand(wp), heute = L.tagKey();
  const ist = W.wpIst(arten, st.ms, dauerJe(st));
  const motivThemen = (arten.find(a => a.motiv) || { themen: [] }).themen;
  const faellig = W.faellige(wp, S.zuletzt, heute, wpKandidaten(arten).filter(t => !motivThemen.includes(t)), S.pakete || [], wpGesperrt())
    .filter(f => !st.erinnert.some(e => e.thema === f.thema && e.tag === heute));
  const sitzungsStart = wpSitzungsStart();
  let ent = W.naechsteArt(arten, ist, { sitzungsStart, takt: wp.motivation.takt, seitMotivation: st.seitMotivation, faellig, letzteErinnerung: st.letzteErinnerung === S.verlauf.zaehler - 1 });
  let r = null;
  // Art mit laufender Etappe (z. B. Zylinder): etwa jede zweite Aufgabe aus der Etappe, damit der Mindestanteil im Plan steckt
  if (ent && ent.art && !ent.art.motiv && Math.random() < 0.5) r = etappeMindestAufgabe({ themen: ent.art.themen });
  if (!r) r = ent && aufgabeAusThemen(ent.grund === 'erinnerung' ? [ent.thema] : ent.art.themen, ent.grund === 'einstieg' ? 'leicht' : kategorie, !!(ent.art && ent.art.motiv));
  if (!r && ent && ent.grund === 'erinnerung') { st.erinnert.push({ thema: ent.thema, tag: heute, ohne: true }); } // keine Aufgabe möglich: heute nicht mehr versuchen
  if (!r) { ent = W.naechsteArt(arten, ist, {}); r = ent && aufgabeAusThemen(ent.art.themen, kategorie, ent.art.motiv); }
  if (!r) return null;
  return { ...r, paket: paketFuerThema(r.aufgabe.thema), wp: { grund: ent.grund, art: ent.art ? ent.art.art : null, ...(ent.info ? { erinnerung: ent.info } : {}) } };
}
const wpSitzungsStart = () => !S.serie.pos || Date.now() - (S.serie.letzteAktivitaet || 0) > 20 * 60 * 1000;
function wpMotivationDran(wp) { const st = wpZustand(wp); return wpSitzungsStart() || (wp.motivation.takt > 0 && st.seitMotivation >= wp.motivation.takt); }
// Aufgabe aus dem Plan wurde gestartet: Takt und Erinnerung festhalten
function wpGestartet(info, a) {
  const wp = wpJetzt(); if (!wp) return;
  const st = wpZustand(wp), arten = wpArtenJetzt(wp);
  const motiv = !!(arten.find(x => x.motiv) || { themen: [] }).themen.includes(a.thema) && a.typ !== 'detektiv' && !a.geschichte;
  st.seitMotivation = motiv ? 0 : st.seitMotivation + 1;
  if (info && info.grund === 'erinnerung') {
    st.letzteErinnerung = S.verlauf.zaehler;
    st.erinnert = [...st.erinnert.filter(e => e.tag >= L.tagKey(new Date(Date.now() - 14 * 864e5))), { thema: a.thema, tag: L.tagKey(), tage: info.erinnerung.tage, frist: info.erinnerung.frist }];
    protokoll(S, 'erinnerung', { thema: a.thema, id: a.id, tage: info.erinnerung.tage, frist: info.erinnerung.frist });
  }
}
// Übungszeit buchen (fertig oder verlassen)
function wpBuchen(a, ms) {
  const wp = wpJetzt(); if (!wp || !a || !a.thema || !(ms > 0)) return;
  const st = wpZustand(wp);
  st.ms[a.thema] = (st.ms[a.thema] || 0) + Math.min(ms, 10 * 60000);
  S.zuletzt[a.thema] = L.tagKey();
}
function wpZaehlen(a) { const wp = wpJetzt(); if (!wp || !a) return; const st = wpZustand(wp); st.n[a.thema] = (st.n[a.thema] || 0) + 1; }
// Protokoll plan_ist: einmal am Tag (erste Aufgabe) und beim Hochladen, wenn sich etwas geändert hat
function wpPlanIst(grund) {
  const wp = wpJetzt(); if (!wp) return;
  const st = wpZustand(wp), heute = L.tagKey(), arten = wpArtenJetzt(wp);
  const e = W.planIstEintrag(wp, W.wpIst(arten, st.ms), st.ms, st.erinnert.filter(x => x.tag === heute && !x.ohne).map(x => ({ thema: x.thema, tage: x.tage, frist: x.frist })));
  const hash = JSON.stringify(e);
  if (grund === 'tag' && st.planIstTag === heute) return;
  if (grund === 'sync' && st.planIstHash === hash) return;
  protokoll(S, 'plan_ist', { ...e, tag: heute, grund });
  st.planIstTag = heute; st.planIstHash = hash;
}
// Eingriffe der Eltern einmal melden (Protokoll eingriff)
function wpEingriffeMelden() {
  const ein = W.eingriffeNorm(S.eingriffe); if (!ein.length) return;
  const st = S.wpGemeldet || (S.wpGemeldet = []);
  for (const e of ein) { const k = JSON.stringify(e); if (!st.includes(k)) { st.push(k); protokoll(S, 'eingriff', e); } }
  S.wpGemeldet = st.slice(-30);
}

// „Ähnliche Aufgabe“ (Auftrag 18): gleicher Baukasten mit neuen Zahlen, im Pool dasselbe Thema und dieselbe Stufe
function aehnlicheAufgabe(a) {
  if (a.generator && G.GENERATOREN[a.generator]) return erzeuge(a.generator, a.stufe || 1, a.variante ? { variante: a.variante } : {}) || a;
  if (a.generator) return a;
  const letzte = S.verlauf.letzteIds.slice(-10);
  const andere = alleAufgaben().filter(x => x.id !== a.id && x.thema === a.thema && (x.stufe || 1) === (a.stufe || 1) && (x.typ === 'detektiv') === (a.typ === 'detektiv')
    && !x.bonus && erlaubt(x) && !letzte.includes(x.id) && (x.typ !== 'detektiv' || detektivHeute(x.id) < 2));
  return andere.length ? wahl(andere) : a;
}

// Fehler-Detektiv: dieselbe Aufgabe höchstens 2 Mal am Tag (Auftrag 18)
const detektivHeute = (id) => (S.detektivTag && S.detektivTag.tag === S.tag.key ? S.detektivTag.n[id] || 0 : 0);
function detektivZaehlen(id) {
  if (!S.detektivTag || S.detektivTag.tag !== S.tag.key) S.detektivTag = { tag: S.tag.key, n: {} };
  S.detektivTag.n[id] = (S.detektivTag.n[id] || 0) + 1;
}

// Mindestanteil der aktuellen Etappe jeder Lerneinheit (Auftrag 18): kam zu lange keine Aufgabe daraus, kommt jetzt eine.
// Zählt: Baukasten in der Stufe der Etappe und Pool-Aufgaben der Etappe, ohne Detektiv. Darf jeden Platz außer dem Einstieg nehmen.
const etappeSchluessel = (ne) => ne.paket + ':' + ne.etappe;
function etappeMindestAufgabe(nur = null) {
  const pk = pakete();
  if (!pk) return null;
  const z = S.verlauf.zaehler;
  const zul = S.verlauf.etappeZuletzt || (S.verlauf.etappeZuletzt = {});
  const wp = !nur && wpJetzt();
  for (const p of pk) {
    const ne = LP.neueEtappe(p);
    if (!ne) continue;
    const k = etappeSchluessel(ne);
    if (zul[k] == null) zul[k] = z;
    const g = LP.gewichteVon(p, S.abweichungen);
    if (nur) { if (!Object.keys(g).some(t => g[t] > 0 && nur.themen.includes(t))) continue; }
    else if (z - zul[k] < ne.abstand) continue;
    // Mit Wochenplan: Mindestanteil nur, solange die Art des Pakets nicht schon über ihrem Plan liegt
    if (wp) { const arten = wpArtenJetzt(wp), ist = W.wpIst(arten, wpZustand(wp).ms); const a = ist.find(x => x.themen.some(t => g[t] > 0)); if (a && a.ms > 0 && a.ist > a.soll) continue; }
    const pool = alleAufgaben().filter(a => ne.ids.includes(a.id) && a.typ !== 'detektiv' && !a.bonus && (g[a.thema] || 0) > 0 && erlaubt(a));
    const gens = ne.gens.filter(x => G.GENERATOREN[x.generator] && !LP.baukastenGrenze(x.generator, grenzen()).gesperrt);
    const ausPool = () => (pool.length ? L.waehleAufgabe(pool, { kategorie: 'alle', statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key, gesperrt: loesungGesperrt() }) : null);
    const ausGen = () => { if (!gens.length) return null; const x = wahl(gens); const b = erzeuge(x.generator, x.stufe); if (b) b.etappeMindest = true; return b; };
    const a = Math.random() < 0.5 ? ausPool() || ausGen() : ausGen() || ausPool();
    if (a && erlaubt(a) && heuteOk(a) && (!nur || nur.themen.includes(a.thema))) { if (!nur) protokoll(S, 'etappe_mindest', { paket: p.id, etappe: ne.etappe, id: a.id, seit: z - zul[k] }); return { aufgabe: a, wdh: 0, paket: p.id }; }
  }
  return null;
}
function etappeMerken(a) {
  const pk = pakete();
  if (!pk) return;
  const zul = S.verlauf.etappeZuletzt || (S.verlauf.etappeZuletzt = {});
  for (const p of pk) { const ne = LP.neueEtappe(p); if (ne && LP.zaehltFuerEtappe(a, ne)) zul[etappeSchluessel(ne)] = S.verlauf.zaehler; }
}

// Aufgabe für einen Platz aus Themen mit diesen Gewichten. ersatz = am Ende irgendeine Aufgabe nehmen.
function waehleIn(kategorie, g, ersatz, ohneDetektiv = false) {
  // Nur Aufgaben aus Themen, die im Paket an sind und deren Etappe erlaubt ist
  const pool = alleAufgaben().filter(a => (g[a.thema] || 0) > 0 && erlaubt(a) && heuteOk(a));
  const ausPool = (k, thema) => {
    const a = L.waehleAufgabe(pool, { kategorie: k, thema, statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key, gesperrt: loesungGesperrt() });
    return a && L.passtKategorie(a, k, thema) && (g[a.thema] || 0) > 0 ? a : null;
  };
  const poolGewicht = (k) => {
    const passend = pool.filter(a => L.passtKategorie(a, k));
    return passend.length ? Math.max(...passend.map(a => g[a.thema])) : 0;
  };
  const fokus = fokusOptionen();
  // Zylinder, Kegel, Pyramide: auf den Plätzen Schritte und Abschluss, je nach Gewicht im Paket.
  // Zylinder halb aus dem Pool, halb aus dem Baukasten; Kegel und Pyramide nur aus dem Pool.
  const koerperOptionen = (gw) => ['zylinder', 'kegel', 'pyramide'].map(t => ({ w: gw[t] || 0, koerper: t }));
  // Seit Auftrag 30 auch Kegel und Pyramide halb aus dem Baukasten (mehr Abwechslung bei viel Übungszeit)
  const koerperAufgabe = (t) => {
    if (Math.random() < 0.5) return erzeuge(t, genStufe(t));
    return ausPool('thema', t) || erzeuge(t, genStufe(t));
  };
  let a = null;
  // Fehler-Detektiv (Auftrag 17): höchstens 1 pro 10 Aufgaben, auf dem Platz „Schritte“ oder „Abschluss“
  if (!ohneDetektiv && ['struktur', 'abschluss'].includes(kategorie) && S.verlauf.zaehler - (S.verlauf.detektivZuletzt ?? -100) >= 10 && Math.random() < 0.5) {
    const d = pool.filter(x => x.typ === 'detektiv' && detektivHeute(x.id) < 2);
    if (d.length) a = L.waehleAufgabe(d, { kategorie: 'detektiv', statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key, gesperrt: loesungGesperrt() });
    if (a) return { aufgabe: a, wdh: 0 };
  }
  switch (kategorie) {
    // Nur Körper (Auftrag 23: Ausgleich der Paketanteile auf jedem Platz)
    case 'koerper': { const o = P.ziehe(koerperOptionen(g)); if (o) a = koerperAufgabe(o.koerper); break; }
    case 'leicht': a = kurzeAufgabe(g, fokus, { leicht: true }); break;
    case 'thema':
    case 'mix': a = kurzeAufgabe(g, fokus); break;
    case 'text': {
      const o = P.ziehe([
        { w: poolGewicht('text'), art: 'pool' },
        { w: g['minus-zahlen'], art: 'geld-geschichte' },
        { w: Math.max(g.rabatt, g['neuer-preis']), art: 'rabatt-geschichte' },
        { w: g['prozent-formel'] || 0, art: 'prozent-formel' }
      ]);
      if (o && o.art === 'pool') a = ausPool('text');
      else if (o) a = erzeuge(o.art, o.art === 'prozent-formel' ? Math.max(2, genStufe(o.art)) : genStufe(o.art), fokus);
      break;
    }
    case 'struktur': {
      const o = P.ziehe([
        { w: poolGewicht('struktur'), art: 'pool' },
        { w: g['prozent-baukasten'], art: 'baukasten' },
        { w: g['bruch-bild'], art: 'bruch-bild' },
        ...koerperOptionen(g)
      ]);
      if (o && o.koerper) { a = koerperAufgabe(o.koerper); break; }
      if (o && o.art === 'pool') a = ausPool('struktur');
      if (a && a.thema === 'kugel') a = null;
      if (!a && o && o.art !== 'pool') a = erzeuge(o.art, o.art === 'baukasten' ? 1 : genStufe(o.art));
      break;
    }
    case 'abschluss': {
      const runde = Math.floor(S.verlauf.musterIndex / MUSTER.length);
      if (runde % 2 === 1) {
        const o = P.ziehe([
          { w: poolGewicht('bonus'), art: 'pool' },
          { w: g.potenzen, art: 'potenz' },
          { w: g['prozent-baukasten'], art: 'baukasten' }
        ]);
        if (o && o.art === 'pool') a = ausPool('bonus');
        else if (o) a = G[o.art](3, Math.random, { bonus: true });
      } else {
        const o = P.ziehe([
          { w: poolGewicht('abschluss') / 2, art: 'pool' },
          { w: g.kugel, art: 'kugel' },
          { w: g.runden, art: 'runden' },
          ...koerperOptionen(g)
        ]);
        if (o && o.koerper) a = koerperAufgabe(o.koerper);
        else if (o && o.art === 'pool') a = ausPool('abschluss');
        else if (o) a = erzeuge(o.art, genStufe(o.art));
      }
      break;
    }
  }
  if (a && !erlaubt(a)) a = null;
  if (!a && !ersatz) return { aufgabe: null, wdh: 0 };
  if (!a) a = kurzeAufgabe(g, fokus);
  if (!a) { const rest = pool.filter(x => !x.bonus); a = rest.length ? L.waehleAufgabe(rest, { kategorie: 'alle', statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key, gesperrt: loesungGesperrt() }) : null; }
  if (!a) a = einmaleinsBlock(1);
  return { aufgabe: a, wdh: 0 };
}

function serieWeiter() {
  if (Date.now() - S.serie.letzteAktivitaet > 20 * 60 * 1000) S.serie.pos = 0;
  S.serie.pos++;
  S.serie.letzteAktivitaet = Date.now();
  return S.serie.pos;
}

function startInfoVon(A, extra = {}) {
  const aufgabe = A.aufgabe;
  const startInfo = { id: aufgabe.id, thema: aufgabe.thema, stufe: aufgabe.stufe, aufgabenTyp: aufgabe.typ, kategorie: A.kategorie, serienPos: A.serienPos, bonus: !!aufgabe.bonus, wiederholung: A.wdh || 0, ...(A.nachLoesung ? { nach_loesung: A.nachLoesung } : {}), ...(A.nachLoesungSchritt ? { nach_loesung_schritt: A.nachLoesungSchritt } : {}),
    ...(A.paket ? { paket: A.paket } : {}), ...(A.etappe != null ? { etappe: A.etappe } : {}), ...(A.ausgleich ? { ausgleich: true } : {}), ...(A.wp ? { wochenplan: A.wp.grund, ...(A.wp.art ? { wp_art: A.wp.art } : {}) } : {}), ...(aufgabe.grenze_bis ? { grenze_bis: aufgabe.grenze_bis } : {}), ...extra };
  if (aufgabe.generator) Object.assign(startInfo, {
    generator: aufgabe.generator, parameter: aufgabe.parameter, rechnung: aufgabe.rechnung, geschichte: aufgabe.geschichte,
    teile: A.teile.map(t => t.art === 'zahl' ? [t.label || null, t.ziel.wert] : t.art === 'bruch' ? [t.antwort.zaehler, t.antwort.nenner] : t.art === 'wahl' ? [t.label, t.richtig] : null)
  });
  // Erzeugte oder hinzugefügte Aufgaben vollständig mitschreiben, damit die Eltern-App sie zeigen kann
  if (!BASIS_IDS.has(aufgabe.id)) startInfo.aufgabe = aufgabe;
  return startInfo;
}

// Zustand einer angefangenen Aufgabe zum Speichern (ohne Taschenrechner-Anzeige)
function aufgabeSchnappschuss() {
  if (!A || A.fertig) return null;
  const k = JSON.parse(JSON.stringify({ ...A, rechnerOffen: false, zuo: A.zuo ? { ...A.zuo, falsch: [...A.zuo.falsch] } : undefined }));
  return k;
}

// Mit „Fertig“ verlassene Aufgabe wieder aufnehmen (wenn ihr Thema noch an ist)
function wartendeAufgabe() {
  const w = S.wartet;
  if (!w || !w.aufgabe || !Array.isArray(w.teile)) { S.wartet = null; return null; }
  S.wartet = null;
  if (!((gewichte()[w.aufgabe.thema] || 0) > 0) || !erlaubt(w.aufgabe)) return null;
  const neu = { ...w, start: Date.now(), phase: w.phase === 'tipp' ? 'tipp' : w.phase, meldung: null, fertig: false, rechnerOffen: false };
  if (neu.zuo) neu.zuo = { ...neu.zuo, falsch: new Set(neu.zuo.falsch || []) };
  neu.teile.forEach(t => { t.seit = Date.now(); t.hilfeStart = Date.now(); });
  return neu;
}

function neueAufgabe() {
  tagAktualisieren(S);
  // Übungszeit für heute erreicht: keine neue Aufgabe
  if (uzGesperrt()) return zeigeUebungszeit();
  // Neue Etappe: zuerst der Logbuch-Eintrag
  logbuchAktualisieren();
  if (ungelesen().length && zeigeLogbuchNeu()) return;
  const alt = wartendeAufgabe();
  if (alt) {
    A = alt;
    A.serienPos = serieWeiter();
    A.wartete = true;
    A.satz = undefined; A.textHilfe = false; A.hilfeAngeboten = false;
    protokoll(S, 'aufgabe_start', startInfoVon(A, { fortsetzung: true, teil: A.idx }));
    sichern();
    setzeAnsicht('aufgabe');
    zeigeAufgabe();
    return;
  }
  const fokus = testFokus();
  let kategorie, aufgabe, wdh = 0, bonusWdh = false, ausgleich = false, wpInfo = null, nachLoesung = null, nachLoesungSchritt = null;
  if (!fokus) { wpEingriffeMelden(); wpPlanIst('tag'); }
  if (fokus) {
    kategorie = 'test';
    aufgabe = testAufgabe(fokus.thema, fokus.stufe);
  }
  let paketId = null;
  if (!aufgabe) {
    etappenAktualisieren();
    kategorie = MUSTER[S.verlauf.musterIndex % MUSTER.length];
    ({ aufgabe, wdh, paket: paketId, bonus: bonusWdh = false, ausgleich = false, wp: wpInfo = null, nachLoesung = null, nachLoesungSchritt = null } = waehleBegrenzt(kategorie));
    S.verlauf.musterIndex++;
  }
  aufgabe = L.kuerzelAufgabe(aufgabe);
  A = {
    aufgabe, kategorie, serienPos: serieWeiter(), start: Date.now(),
    teile: teileVon(aufgabe), idx: 0, phase: 'eingabe', hinweise: [], verlassen: 0, strafe: 'keine',
    fertig: false, meldung: null, feld: 'z', wdh, test: !!fokus, ...paketInfo(paketId), ...(bonusWdh ? { bonusWdh: true } : {}), ...(ausgleich ? { ausgleich: true } : {}), ...(wpInfo ? { wp: wpInfo } : {})
  };
  // Nach „Zeig mir die Lösung“: neue Aufgabe derselben Art (nachLoesung) oder dieselbe Aufgabe wieder (gleich)
  if (!A.test && (S.verlauf.loesung || {})[aufgabe.id] != null) { A.gleich = true; A.nachLoesung = aufgabe.id; }
  else if (nachLoesung) A.nachLoesung = nachLoesung;
  if (A.nachLoesung && nachLoesungSchritt) A.nachLoesungSchritt = nachLoesungSchritt;
  // Geschichten Satz für Satz zeigen (weniger Text auf einmal)
  if (aufgabe.geschichte && L.saetzeVon(aufgabe.geschichte).length > 1 && bed('satzweise')) A.satz = 1;
  teileStarten(A.teile);
  if (aufgabe.modus === 'knobeln') A.knobeln = true;
  if (aufgabe.typ === 'zuordnung') zuordnungVorbereiten();
  protokoll(S, 'aufgabe_start', startInfoVon(A, bonusWdh ? { bonusWiederholung: true } : {}));
  S.verlauf.letzteIds = [...S.verlauf.letzteIds, aufgabe.id].slice(-20);
  if (!A.test) { etappeMerken(aufgabe); heuteZaehlen(aufgabe); wpZaehlen(aufgabe); if (wpJetzt()) wpGestartet(wpInfo, aufgabe); }
  if (aufgabe.typ === 'detektiv') detektivZaehlen(aufgabe.id);
  sichern();
  setzeAnsicht('aufgabe');
  if (aufgabe.typ === 'detektiv') S.verlauf.detektivZuletzt = S.verlauf.zaehler;
  if (ufSofort()) return ufAn(true);
  zeigeAufgabe();
  // Fehler-Detektiv: beim ersten Mal die Einführungskarte, danach nur über „?“
  if (aufgabe.typ === 'detektiv' && !S.detektivGesehen) { S.detektivGesehen = true; protokoll(S, 'detektiv_einfuehrung', { id: aufgabe.id }); sichern(); detektivEinfuehrung(); }
}

// Nur lokal (Entwicklung): Mischung simulieren, ohne Aufgaben zu lösen. msVon: Thema → Arbeitszeit in ms.
// Setzt den Zustand danach zurück. Auf der veröffentlichten Seite nicht aktiv.
if (typeof location !== 'undefined' && location.hostname === 'localhost') window.__sim = (n, msVon = {}, behalten = false) => {
  const sicher = JSON.stringify({ ...S, log: [] }), logLaenge = S.log.length;
  const out = [], ev2 = [];
  for (let i = 0; i < n; i++) {
    tagAktualisieren(S); etappenAktualisieren();
    const kategorie = MUSTER[S.verlauf.musterIndex % MUSTER.length];
    const r = waehleBegrenzt(kategorie);
    S.verlauf.musterIndex++;
    const a = r.aufgabe;
    const ms = msVon[a.thema] || 30000;
    S.verlauf.letzteIds = [...S.verlauf.letzteIds, a.id].slice(-20);
    etappeMerken(a);
    if (a.typ === 'detektiv') { detektivZaehlen(a.id); S.verlauf.detektivZuletzt = S.verlauf.zaehler; }
    if (typeof simBuchen === 'function') simBuchen(a, r.paket, ms);
    if (wpJetzt()) { wpZaehlen(a); wpGestartet(r.wp, a); wpBuchen(a, ms); S.serie.pos++; S.serie.letzteAktivitaet = Date.now(); }
    S.verlauf.zaehler++;
    if (r.wp && r.wp.grund === 'erinnerung') ev2.push({ i, thema: a.thema });
    out.push({ wp: r.wp ? r.wp.grund : null, id: a.id, thema: a.thema, stufe: a.stufe, typ: a.typ, generator: a.generator || null, paket: r.paket, kategorie, ms, mindest: !!a.etappeMindest || S.log.slice(-1)[0]?.typ === 'etappe_mindest' && S.log.slice(-1)[0]?.id === a.id, ausgleich: !!r.ausgleich });
  }
  const ev = S.log.slice(logLaenge).map(e => e.typ);
  if (behalten) return { aufgaben: out, ereignisse: ev, wp: S.wp };
  const logRef = S.log;
  Object.assign(S, JSON.parse(sicher)); S.log = logRef; S.log.length = logLaenge;
  return { aufgaben: out, ereignisse: ev };
};

function aktuellerTeil() { return A && A.teile[A.idx]; }
function teileStarten(teile) {
  teile.forEach(t => { t.versuche = []; t.status = 'offen'; t.eingabe = ''; t.z = ''; t.n = t.nennerFest ? String(t.antwort.nenner) : ''; t.e = ''; t.tokens = []; t.gelegt = []; t.seit = Date.now(); t.hilfeStart = Date.now(); if (t.art === 'linien') { t.linien = []; t.fest = null; } });
}

// ---------- „In Schritten umformen“ (Auftrag 14, Teil 4) ----------
// Ablauf je Schritt: Umformung wählen → die App zeigt sie auf beiden Seiten → das Kind trägt die vereinfachte Gleichung ein.
// Stufe 3: beide Seiten selbst, Stufe 2: die App schreibt eine Seite, Stufe 1: die App vereinfacht. Start-Stufe aus der Eltern-App.
const ufStartStufe = () => ([1, 2, 3].includes(S.einstellungen.umformStufe) ? S.einstellungen.umformStufe : 3);
const ufAngebot = () => !!(A && !A.uf && !A.fertig && A.phase === 'eingabe' && !liestNoch() && UF.umformbar(A.aufgabe));
// Gleichungen gleich in Schritten umformen (Schalter pro Kind), ohne Abzug bei den Wissenspunkten
const ufSofort = () => bed('umformen_sofort') && ufAngebot() && !A.teile.some(t => t.versuche.length);
const OPZ = { '+': '+', '-': '−', '*': '·', '/': ':' };
function ufAn(sofort = false) {
  if (!ufAngebot()) return;
  if (sofort) A.ufSofort = true;
  const a = A.aufgabe;
  const vars = UF.groessenVon(a);
  if (A.teile.some(t => t.versuche.some(v => !v.richtig))) A.knobelFalsch = true;
  const auf = UF.mussAufstellen(a);
  A.uf = {
    gl: auf ? null : UF.seiten(a.rechnung), zielGl: auf ? UF.seiten(UF.gleichungVon(a)) : null, ziel: UF.zielVon(a), vars,
    pi: /π/.test(UF.gleichungVon(a) || '') || ((a.antwort && a.antwort.konstanten) || []).includes('π'),
    schritte: [], phase: auf ? 'aufstellen' : 'waehlen', op: null, term: UF.leer(), roh: null, ed: { l: UF.leer(), r: UF.leer() }, seite: 'l',
    stufe: ufStartStufe(), app: {}, status: {}, versuche: { l: 0, r: 0 }, noetig: UF.noetigeSchritte(a), vorschlag: null, falsch: false, hilfe: false
  };
  A.knobeln = false; A.schritteAn = true;
  A.teile = [{ art: 'umformen' }];
  teileStarten(A.teile);
  A.idx = 0; A.phase = 'eingabe'; A.meldung = null;
  protokoll(S, 'umformen_an', { id: a.id, stufe: A.uf.stufe, aufstellen: auf, ms: Date.now() - A.start, ...(sofort ? { sofort: true } : {}) });
  sichern();
  zeigeAufgabe();
}
const ufSeiteHtml = (text) => PH.gleichungHtml(text, A.uf.vars, esc, groesseHtml) || mathe(text);
function ufZeile(gl, op, kl) {
  return `<div class="uf-zeile ${kl}"><span class="l">${ufSeiteHtml(gl.l)}</span><span class="gl">=</span><span class="r">${ufSeiteHtml(gl.r)}</span><span class="op">${op ? esc(op) : ''}</span></div>`;
}
// Eingabe mit echten Brüchen anzeigen
function ufEdHtml(ed, mitCursor) {
  const z = (x) => (x === '·' ? ' · ' : x === '−' || x === '+' ? ` ${x} ` : x === ':' ? ' : ' : x === '²' ? '<sup>2</sup>' : x === '³' ? '<sup>3</sup>' : groesseHtml(x));
  // Antippen: ein Zeichen setzt den Cursor davor oder dahinter, ein Teil (Zähler, Nenner, Wurzel) an sein Ende
  const tipp = (p) => (mitCursor !== null ? ` data-act="ufCur" data-p="${p}"` : '');
  const seq = (liste) => liste.map(e => e.cursor ? '<span class="cur"></span>'
    : e.bruch ? `<span class="fr2"><span class="ed-teil"${tipp(e.bruch[0].ende)}>${teil(e.bruch[0])}</span><span class="ed-teil"${tipp(e.bruch[1].ende)}>${teil(e.bruch[1])}</span></span>`
    : e.wurzel ? `<span class="wurzel">√<span class="ed-teil"${tipp(e.wurzel.ende)}>${teil(e.wurzel)}</span></span>` : `<span class="ed-z"${tipp(e.p)} data-n="1">${z(e.z)}</span>`).join('');
  const teil = (liste) => (liste.some(e => !e.cursor) ? seq(liste) : `<span class="box${liste.some(e => e.cursor) ? ' aktiv' : ''}"${tipp(liste.start)}>${seq(liste)}</span>`);
  return seq(UF.struktur(ed, mitCursor));
}
function umformHtml(t, aktiv) {
  const u = A.uf;
  if (!u) return '';
  const stufeText = u.phase === 'aufstellen' ? 'Zuerst: Gleichung aufstellen' : { 3: 'Stufe 3: beide Seiten selbst', 2: 'Hilfe: Stufe 2', 1: 'Hilfe: Stufe 1' }[u.stufe];
  const weg = u.schritte.map(s => ufZeile(s.vorher, UF.umformungText(s.u), 'alt')).join('');
  const kopf = `<div class="uf-kopf"><span class="uf-titel">In Schritten umformen</span>${aktiv ? `<span class="uf-stufe">${stufeText}</span>` : ''}</div>`;
  if (!aktiv) {
    if (!u.gl) return kopf;
    const f = UF.fertig(u.gl, u.ziel, u.vars);
    return `${kopf}<div class="uf-weg">${weg}${ufZeile(u.gl, '✓', 'neu')}</div>
      ${f ? `<div class="uf-fertig"><div class="gedaempft">${groesseHtml(u.ziel)} steht allein. Fertig!</div><div class="gross">${groesseHtml(u.ziel)} = ${ufSeiteHtml(f.loesung)}</div></div>` : ''}`;
  }
  let inhalt;
  const seite = (k) => {
    if (u.app[k] != null) return `<div class="uf-seite app"><span class="mark">von der App</span><span>${ufSeiteHtml(u.app[k])}</span></div>`;
    const st = u.status[k];
    const kl = `uf-seite${st === 'ok' ? ' ok' : st === 'fehler' ? ' fehler' : ''}${u.seite === k && st !== 'ok' ? ' aktiv' : ''}`;
    const mark = st === 'ok' ? '<span class="mark">passt</span>' : st === 'fehler' ? '<span class="mark">noch nicht</span>' : '';
    return `<button class="${kl}" data-act="ufSeite" data-s="${k}" aria-label="${k === 'l' ? 'linke' : 'rechte'} Seite">${mark}<span>${ufEdHtml(u.ed[k], u.seite === k && st !== 'ok') || '&nbsp;'}</span></button>`;
  };
  const zurueck = u.phase === 'eintragen' || u.schritte.length || (u.phase === 'waehlen' && u.zielGl) ? `<button class="btn-text klein uf-zurueck" data-act="ufZurueck">↶ Schritt zurück</button>` : '';
  if (u.phase === 'aufstellen') {
    inhalt = `<p class="uf-frage">Stelle die Gleichung mit ${groesseHtml(u.ziel)} auf. Trag links und rechts vom „=“ ein.</p>
      <div class="uf-zwei">${seite('l')}<span class="uf-gleich">=</span>${seite('r')}</div>
      ${A.meldung && A.phase === 'eingabe' ? `<div class="meldung uf-meldung">${esc(A.meldung)}</div>` : ''}
      ${u.tipp ? `<div class="uf-tipp">${u.tipp}</div>` : ''}
      ${u.app.l != null ? '<div class="uf-knoepfe"><button class="btn btn-haupt" data-act="ufWeiter">Weiter</button></div>' : ''}`;
  } else if (u.phase === 'waehlen') {
    const ops = ['+', '-', '*', '/'].map(o => `<button class="uf-b op${u.op === o ? ' an' : ''}" data-act="ufOp" data-o="${o}" aria-label="Rechenzeichen ${OPZ[o]}">${OPZ[o]}</button>`).join('');
    const terme = UF.bausteine(u.gl, u.ziel, u.vars).map(x => `<button class="uf-b" data-act="ufTerm" data-t="${esc(x)}"><span>${ufSeiteHtml(x)}</span></button>`).join('');
    const fest = `<button class="uf-b lang" data-act="ufFest" data-f="tauschen">Seiten tauschen</button><button class="uf-b lang" data-act="ufFest" data-f="klammer">Klammer auflösen</button><button class="uf-b lang" data-act="ufFest" data-f="wurzel" aria-label="Wurzel ziehen">√</button>`;
    const auswahl = u.op ? `| ${OPZ[u.op]} ${UF.istLeer(u.term) ? '<span class="leer">Term wählen oder tippen</span>' : ufEdHtml(u.term, true)}` : '<span class="leer">Rechenzeichen und Term wählen</span>';
    inhalt = `<div class="uf-weg">${weg}${ufZeile(u.gl, '', 'neu')}</div>${zurueck}
      <p class="uf-frage">Was machst du auf beiden Seiten?</p>
      <div class="uf-bausteine">${ops}<span class="uf-trenner"></span>${terme}<span class="uf-trenner"></span>${fest}</div>
      <div class="uf-auswahl"><span>${auswahl}</span>${u.op || !UF.istLeer(u.term) ? '<button class="uf-leeren" data-act="ufLeeren" aria-label="Auswahl löschen">⌫</button>' : ''}<button class="btn btn-haupt btn-klein" data-act="ufAnwenden" ${u.op && !UF.istLeer(u.term) ? '' : 'disabled'}>Anwenden</button></div>
      ${A.meldung && A.phase === 'eingabe' ? `<div class="meldung uf-meldung">${esc(A.meldung)}</div>` : ''}
      ${u.tippen ? '' : `<button class="btn-text klein uf-tippen" data-act="ufTippen">⌨ Eigene Zahl oder Term tippen</button>`}
      ${u.vorschlag ? `<div class="uf-hilfe-box"><b>Vorschlag für den nächsten Schritt:</b> ${esc(u.vorschlag)}</div>` : ''}`;
  } else {
    const frage = u.stufe === 1 ? 'Die App hat vereinfacht. Lies den Schritt durch.' : u.stufe === 2 ? 'Vereinfache die Seite, die noch offen ist. Tippe sie an, schreib sie neu und tippe auf „Seite prüfen“.' : 'Vereinfache beide Seiten. Tippe eine Seite an, schreib sie neu und tippe auf „Seite prüfen“.';
    inhalt = `<div class="uf-weg">${weg}${ufZeile(u.gl, UF.umformungText(u.u), 'alt')}${ufZeile(u.roh, '', 'neu')}</div>${zurueck}
      <p class="uf-frage">${frage}</p>
      <div class="uf-zwei">${seite('l')}<span class="uf-gleich">=</span>${seite('r')}</div>
      ${A.meldung && A.phase === 'eingabe' ? `<div class="meldung uf-meldung">${esc(A.meldung)}</div>` : ''}
      ${u.tipp ? `<div class="uf-tipp">${u.tipp}</div>` : ''}
      ${u.stufe === 1 || (u.app.l != null || u.status.l === 'ok') && (u.app.r != null || u.status.r === 'ok') ? '<div class="uf-knoepfe"><button class="btn btn-haupt" data-act="ufWeiter">Weiter</button></div>' : ''}`;
  }
  const umweg = u.umweg ? `<div class="uf-tipp">Du bist auf einem Umweg. Das ist erlaubt. Schau dir den Hinweis „Gleichungen umstellen“ an.</div>` : '';
  return kopf + inhalt + umweg;
}
// Formel-Tastatur (kompakt, 6 Spalten): oben die Größen und der Knopf zum Weitergehen, darunter Ziffern und Zeichen.
// Beim Wählen der Umformung erscheint sie nur, wenn das Kind eine eigene Zahl oder einen Term tippen will.
function ufFuss() {
  const u = A.uf;
  if (!u) return '';
  if (u.phase === 'waehlen' && !u.tippen) return '';
  const offen = u.phase === 'waehlen' || (u.phase === 'aufstellen' ? u.app.l == null : u.app[u.seite] == null && u.status[u.seite] !== 'ok' && u.stufe > 1);
  if (!offen) return '';
  const k = (x, kl = '', label = x) => `<button class="${kl}" data-act="ufTaste" data-k="${esc(x)}" aria-label="${esc(label)}">${x === 'bruch' ? '<span class="bruch"><span>□</span><i></i><span>□</span></span>' : x === '²' ? 'x²' : groesseHtml(x)}</button>`;
  const vars = [...u.vars, ...(u.pi ? ['π'] : [])].slice(0, 6);
  const ok = u.phase === 'waehlen' ? `<button class="ok" data-act="ufAnwenden" ${u.op && !UF.istLeer(u.term) ? '' : 'disabled'}>Anwenden</button>`
    : u.phase === 'aufstellen' && !UF.istLeer(u.ed.l) && !UF.istLeer(u.ed.r) ? '<button class="ok" data-act="ufPruefen">Gleichung prüfen</button>'
    : `<button class="ok" data-act="ufPruefen">${u.seite === 'r' ? 'Rechte' : 'Linke'} Seite prüfen</button>`;
  return `<div class="ft2">
    <div class="ft-oben">${vars.map(v => k(v, 'var')).join('')}${ok}</div>
    <div class="ft-gitter">
      ${k('7')}${k('8')}${k('9')}${k('+', 'sp', 'plus')}${k('−', 'sp', 'minus')}${k('⌫', 'sp', 'Löschen')}
      ${k('4')}${k('5')}${k('6')}${k('·', 'sp', 'mal')}${k(':', 'sp', 'geteilt')}${k('←', 'sp nav', 'nach links')}
      ${k('1')}${k('2')}${k('3')}${k('(', 'sp')}${k(')', 'sp')}${k('→', 'sp nav', 'nach rechts')}
      ${k('0')}${k(',', 'sp', 'Komma')}${k('²', 'sp', 'hoch 2')}${k('√', 'sp', 'Wurzel')}${k('bruch', 'sp bruch', 'Bruch')}${u.phase === 'waehlen' ? '<button class="sp" data-act="ufTippenZu" aria-label="Tastatur schließen">▾</button>' : '<span></span>'}
    </div></div>`;
}
// Das gerade bearbeitete Feld über die Tastatur scrollen
function ufSichtbar() {
  if (!A || !A.uf || A.fertig) return;
  const el = document.querySelector('.uf-meldung') || document.querySelector(A.uf.phase === 'waehlen' ? '.uf-auswahl' : '.uf-zwei');
  const box = document.querySelector('.aufgabe-screen.mit-uf > .aufgabe-inhalt');
  if (!el || !box) return;
  if (getComputedStyle(box).overflowY !== 'auto') { el.scrollIntoView({ block: 'nearest' }); return; }
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (r.bottom > b.bottom - 8) box.scrollTop += r.bottom - b.bottom + 16;
  else if (r.top < b.top) box.scrollTop += r.top - b.top - 12;
}
// Antippen in einer Eingabe: Seite wählen und Cursor setzen
function ufCur(el, e) {
  const u = A && A.uf;
  if (!u || A.fertig) return;
  let p = Number(el.dataset.p);
  if (el.dataset.n) { const r = el.getBoundingClientRect(); if (e.clientX > r.left + r.width / 2) p += 1; }
  const seiteEl = el.closest('[data-s]');
  let ed;
  if (u.phase === 'waehlen') ed = u.term;
  else if (seiteEl) {
    const k = seiteEl.dataset.s;
    if (u.app[k] != null || u.status[k] === 'ok') return;
    u.seite = k; ed = u.ed[k];
  }
  if (!ed) return;
  UF.cursorAuf(ed, p);
  zeigeAufgabe();
}
function ufTaste(k) {
  const u = A && A.uf;
  if (!u || A.fertig) return;
  const ed = u.phase === 'waehlen' ? u.term : (u.app[u.seite] == null && u.status[u.seite] !== 'ok' ? u.ed[u.seite] : null);
  if (!ed) return;
  UF.tippen(ed, k);
  if (u.phase === 'eintragen') u.status[u.seite] = null;
  if (u.phase === 'aufstellen' && u.status.l === 'fehler') u.status = {};
  A.meldung = null;
  zeigeAufgabe();
}
function ufAnwenden(art) {
  const u = A && A.uf;
  if (!u || u.phase !== 'waehlen') return;
  let um;
  if (art === 'op') {
    if (!u.op || UF.istLeer(u.term)) return;
    const term = UF.alsText(u.term);
    if (!UF.baum(term, u.vars)) { A.meldung = 'Der Term ist noch nicht fertig. Schau auf Klammern und Brüche.'; return zeigeAufgabe(); }
    if (u.op === '/' && UF.gleichwertig(term, '0', u.vars)) { A.meldung = 'Durch 0 kann man nicht teilen.'; return zeigeAufgabe(); }
    um = { art: 'op', op: u.op, term };
  } else um = { art };
  u.u = um; u.vorschlag = null; u.tipp = null; u.tippen = false; A.meldung = null;
  if (u.schritte.length + 1 > 2 * u.noetig && !u.umwegGezeigt) { u.umweg = true; u.umwegGezeigt = true; protokoll(S, 'umform_umweg', { id: A.aufgabe.id, schritte: u.schritte.length + 1, noetig: u.noetig }); }
  if (um.art === 'tauschen') {
    u.roh = { l: u.gl.r, r: u.gl.l };
    u.app = { l: u.roh.l, r: u.roh.r }; u.status = {};
    return ufSchrittFertig();
  }
  u.roh = { l: UF.anwenden(u.gl.l, um, u.vars), r: UF.anwenden(u.gl.r, um, u.vars) };
  u.phase = 'eintragen'; u.ed = { l: UF.leer(), r: UF.leer() }; u.app = {}; u.status = {}; u.versuche = { l: 0, r: 0 }; u.schrittHilfe = false;
  u.stufe = ufStartStufe();
  ufStufeAnwenden();
  sichern();
  zeigeAufgabe();
}
// Hilfe-Stufen: 2 = die App schreibt eine Seite, 1 = die App vereinfacht beide
function ufStufeAnwenden() {
  const u = A.uf;
  const fertigText = UF.ergebnisMitWeg(A.aufgabe, u.gl, u.u, u.roh, u.vars);
  if (u.stufe <= 2) { const s = UF.appSeite(u.roh, u.ziel, u.vars); if (u.status[s] !== 'ok') u.app[s] = u.stufe === 2 ? UF.vereinfachen(u.roh[s], u.vars) : fertigText[s]; }
  if (u.stufe <= 1) for (const s of ['l', 'r']) if (u.status[s] !== 'ok' && u.app[s] == null) u.app[s] = fertigText[s];
  u.seite = u.app.l == null && u.status.l !== 'ok' ? 'l' : 'r';
}
// Gleichung aus der Geschichte aufstellen (Textaufgaben ohne Gleichung)
function ufAufstellenPruefen() {
  const u = A.uf;
  const k = u.seite, andere = k === 'l' ? 'r' : 'l';
  if (UF.istLeer(u.ed[k])) { A.meldung = 'Trag zuerst die Seite ein.'; return zeigeAufgabe(); }
  if (UF.istLeer(u.ed[andere])) { u.seite = andere; A.meldung = null; return zeigeAufgabe(); }
  const gl = { l: UF.alsText(u.ed.l), r: UF.alsText(u.ed.r) };
  const ok = UF.gleichungPasst(gl, u.zielGl, u.vars);
  if (ok === null) { A.meldung = 'Die Gleichung ist noch nicht fertig. Schau auf Klammern und Brüche.'; return zeigeAufgabe(); }
  if (ok && UF.fertig(gl, u.ziel, u.vars)) { A.meldung = `Das ist schon die Lösung. Schreib zuerst die Gleichung aus der Geschichte auf, mit ${u.ziel} in einer Rechnung.`; return zeigeAufgabe(); }
  u.versuche.l++;
  protokoll(S, 'umform_aufstellen', { id: A.aufgabe.id, eingabe: `${UF.lesbar(gl.l, u.vars)} = ${UF.lesbar(gl.r, u.vars)}`, richtig: ok, versuch: u.versuche.l });
  A.meldung = null;
  if (ok) { u.status = { l: 'ok', r: 'ok' }; return ufAufgestellt(gl); }
  u.falsch = true; u.status = { l: 'fehler', r: 'fehler' };
  if (u.versuche.l >= 2) {
    u.app = { ...u.zielGl }; u.hilfe = true;
    u.tipp = 'Diese Gleichung schreibt jetzt die App. Vergleiche sie mit der Geschichte.';
  } else {
    u.tipp = `Die Gleichung passt noch nicht. Lies die Geschichte noch einmal. Was rechnest du mit ${esc(u.ziel)}? Was soll herauskommen?`;
  }
  sichern();
  zeigeAufgabe();
}
// Gleichung steht: weiter mit dem Umformen
function ufAufgestellt(gl) {
  const u = A.uf;
  u.aufEd = { l: { t: [...u.ed.l.t], c: u.ed.l.c }, r: { t: [...u.ed.r.t], c: u.ed.r.c } };
  u.gl = gl || { ...u.zielGl };
  u.phase = 'waehlen'; u.op = null; u.term = UF.leer(); u.app = {}; u.status = {}; u.ed = { l: UF.leer(), r: UF.leer() };
  u.versuche = { l: 0, r: 0 }; u.tipp = null; u.seite = 'l'; u.stufe = ufStartStufe();
  sichern();
  zeigeAufgabe();
}
function ufPruefen() {
  const u = A && A.uf;
  if (u && u.phase === 'aufstellen') return ufAufstellenPruefen();
  if (!u || u.phase !== 'eintragen') return;
  const k = u.seite;
  if (u.app[k] != null || u.status[k] === 'ok') return;
  const ed = u.ed[k];
  if (UF.istLeer(ed)) { A.meldung = 'Trag zuerst die Seite ein.'; return zeigeAufgabe(); }
  const text = UF.alsText(ed);
  const ok = UF.gleichwertig(text, u.roh[k], u.vars);
  if (ok === null) { A.meldung = 'Diese Seite ist noch nicht fertig. Schau auf Klammern und Brüche.'; return zeigeAufgabe(); }
  u.versuche[k]++;
  protokoll(S, 'umform_versuch', { id: A.aufgabe.id, schritt: u.schritte.length + 1, seite: k, umformung: UF.umformungText(u.u), eingabe: UF.lesbar(text, u.vars), richtig: ok, stufe: u.stufe, versuch: u.versuche[k] });
  const name = (s) => (s === 'l' ? 'Links' : 'Rechts');
  const andere = k === 'l' ? 'r' : 'l';
  if (ok) {
    u.status[k] = 'ok'; u.tipp = null;
    if (u.app[andere] == null && u.status[andere] !== 'ok') u.seite = andere;
  } else {
    u.status[k] = 'fehler'; u.falsch = true;
    if (u.versuche[k] >= 2) {
      // Nach zwei Versuchen schreibt die App diese Seite (keine Strafe, aber nicht mehr im 1. Versuch)
      u.app[k] = UF.ergebnisMitWeg(A.aufgabe, u.gl, u.u, u.roh, u.vars)[k]; u.status[k] = null; u.schrittHilfe = true;
      u.tipp = `${name(k)} schreibt jetzt die App. Schau dir genau an, wie sie vereinfacht.`;
      if (u.app[andere] == null && u.status[andere] !== 'ok') u.seite = andere;
    } else {
      u.tipp = `${u.status[andere] === 'ok' || u.app[andere] != null ? `${name(andere)} passt. ` : ''}${name(k)} noch nicht: Wende „${esc(UF.umformungText(u.u))}“ auf die ganze Seite an und fasse dann zusammen.`;
    }
  }
  sichern();
  if ((u.app.l != null || u.status.l === 'ok') && (u.app.r != null || u.status.r === 'ok')) return ufSchrittFertig();
  zeigeAufgabe();
}
function ufSchrittFertig() {
  const u = A && A.uf;
  if (!u || !u.roh) return;
  const seiteText = (s) => (u.app[s] != null ? u.app[s] : UF.alsText(u.ed[s]));
  const nachher = { l: seiteText('l'), r: seiteText('r') };
  u.schritte.push({ vorher: u.gl, u: u.u, roh: u.roh, nachher, stufe: u.stufe, hilfe: !!u.schrittHilfe });
  if (u.schrittHilfe || u.stufe < 3) u.hilfe = true;
  protokoll(S, 'umform_schritt', { id: A.aufgabe.id, nr: u.schritte.length, umformung: UF.umformungText(u.u), eingabe: { l: UF.lesbar(nachher.l, u.vars), r: UF.lesbar(nachher.r, u.vars) }, stufe: u.stufe, hilfe: !!u.schrittHilfe, versuche: u.versuche });
  u.gl = nachher; u.phase = 'waehlen'; u.op = null; u.term = UF.leer(); u.roh = null; u.app = {}; u.status = {}; u.tipp = null; u.stufe = ufStartStufe();
  const f = UF.fertig(u.gl, u.ziel, u.vars);
  if (f) {
    const t = aktuellerTeil();
    const stimmt = UF.endePruefen(A.aufgabe, f.loesung, u.vars);
    protokoll(S, 'umform_fertig', { id: A.aufgabe.id, schritte: u.schritte.length, noetig: u.noetig, loesung: UF.lesbar(f.loesung, u.vars), stimmt, hilfe: u.hilfe, falsch: u.falsch, zurueck: u.zurueck || 0 });
    t.versuche.push({ eingabe: `${u.ziel} = ${UF.lesbar(f.loesung, u.vars)}`, richtig: stimmt });
    t.status = !stimmt ? 'loesung' : u.falsch || u.hilfe || A.knobelFalsch ? 'zweit' : 'erst';
    return naechsterTeil();
  }
  sichern();
  zeigeAufgabe();
}
// Schritt zurück: beim Eintragen zurück zur Wahl der Umformung, beim Wählen den letzten Schritt aufheben
function ufZurueck() {
  const u = A && A.uf;
  if (!u || A.fertig) return;
  let umformung;
  if (u.phase === 'eintragen') {
    umformung = UF.umformungText(u.u);
  } else if (!u.schritte.length && u.zielGl) {
    // zurück zum Aufstellen der Gleichung
    protokoll(S, 'umform_zurueck', { id: A.aufgabe.id, schritt: 0, von: 'waehlen', umformung: 'Gleichung aufstellen' });
    u.zurueck = (u.zurueck || 0) + 1;
    u.phase = 'aufstellen'; u.gl = null; u.op = null; u.term = UF.leer(); u.app = {}; u.status = {}; u.tipp = null; u.vorschlag = null; u.tippen = false;
    u.ed = u.aufEd || { l: UF.leer(), r: UF.leer() }; u.versuche = { l: 0, r: 0 }; u.seite = 'l';
    A.meldung = null; sichern(); return zeigeAufgabe();
  } else {
    const s = u.schritte.pop();
    if (!s) return;
    u.gl = s.vorher; umformung = UF.umformungText(s.u);
  }
  u.zurueck = (u.zurueck || 0) + 1;
  protokoll(S, 'umform_zurueck', { id: A.aufgabe.id, schritt: u.schritte.length + 1, von: u.phase, umformung });
  u.phase = 'waehlen'; u.op = null; u.term = UF.leer(); u.u = null; u.roh = null; u.app = {}; u.status = {}; u.ed = { l: UF.leer(), r: UF.leer() };
  u.versuche = { l: 0, r: 0 }; u.tipp = null; u.vorschlag = null; u.tippen = false; u.schrittHilfe = false; u.stufe = ufStartStufe();
  A.meldung = null;
  sichern();
  zeigeAufgabe();
}
function ufHilfeKnopf() {
  const u = A.uf;
  if (!u) return '';
  const kosten = A.hilfeGenutzt || hilfeAnteil() >= 1 || !zeitZeigen() ? '' : hilfeAnteil() > 0 ? ' · ½ Zeit' : ' · keine Zeit';
  if (u.phase === 'aufstellen') return u.app.l != null ? '' : `<button class="btn btn-klein btn-hilfe" data-act="ufHilfe">${u.aufTipp ? 'Mehr Hilfe' : 'Hilf mir'}${kosten}</button>`;
  if (u.phase === 'waehlen') return `<button class="btn btn-klein btn-hilfe" data-act="ufHilfe">${u.vorschlag ? 'Vorschlag übernehmen' : 'Hilf mir'}${kosten}</button>`;
  if (u.stufe === 1) return '';
  return `<button class="btn btn-klein btn-hilfe" data-act="ufHilfe">${u.stufe === 3 ? 'Hilf mir' : 'Mehr Hilfe'}${kosten}</button>`;
}
function ufHilfe() {
  const u = A && A.uf;
  if (!u) return;
  A.hilfeGenutzt = true;
  if (u.phase === 'aufstellen') {
    u.hilfe = true;
    if (!u.aufTipp) {
      // Denkhilfe: die erste Frage aus den Schritten der Aufgabe
      const s1 = (A.aufgabe.schritte || []).find(x => x.text && !/^\s*x\s*=/.test(x.text));
      u.aufTipp = true;
      u.tipp = `${s1 ? `Denk zuerst an diese Frage: ${esc(s1.text)} ` : ''}Schreib das mit ${esc(u.ziel)}. Setz es gleich dem, was herauskommen soll.`;
      protokoll(S, 'umform_hilfe', { id: A.aufgabe.id, schritt: 0, art: 'aufstellen-tipp' });
    } else {
      u.app = { ...u.zielGl }; u.status = {};
      u.tipp = 'So heißt die Gleichung. Vergleiche sie mit der Geschichte.';
      protokoll(S, 'umform_hilfe', { id: A.aufgabe.id, schritt: 0, art: 'aufstellen-gleichung' });
    }
    sichern();
    return zeigeAufgabe();
  }
  if (u.phase === 'waehlen') {
    const v = UF.vorschlag(A.aufgabe, u.gl, u.schritte.length, u.vars);
    if (!u.vorschlag) {
      u.vorschlag = v || `Was passiert mit ${u.ziel}? Mach es auf beiden Seiten rückgängig, in umgekehrter Reihenfolge.`;
      protokoll(S, 'umform_hilfe', { id: A.aufgabe.id, schritt: u.schritte.length + 1, art: 'vorschlag', vorschlag: v || null });
    } else {
      const um = UF.umformungAus(u.vorschlag);
      if (um && um.art === 'op') { u.op = um.op; u.term = UF.setzen(um.term); }
      else if (um) { protokoll(S, 'umform_hilfe', { id: A.aufgabe.id, schritt: u.schritte.length + 1, art: 'uebernommen' }); return ufAnwenden(um.art); }
      protokoll(S, 'umform_hilfe', { id: A.aufgabe.id, schritt: u.schritte.length + 1, art: 'uebernommen' });
    }
    u.hilfe = true;
  } else if (u.stufe > 1) {
    u.stufe -= 1; u.schrittHilfe = true; u.hilfe = true;
    ufStufeAnwenden();
    protokoll(S, 'umform_hilfe', { id: A.aufgabe.id, schritt: u.schritte.length + 1, art: 'stufe' + u.stufe });
  }
  sichern();
  zeigeAufgabe();
}

// ---------- Knobeln: „In Schritten rechnen“ ----------
function schritteAn(auto = false) {
  if (!A || A.fertig || !A.knobeln) return;
  const alt = A.teile[0];
  A.knobeln = false;
  A.schritteAn = true;
  if (alt && alt.versuche.some(v => !v.richtig)) A.knobelFalsch = true;
  A.teile = schritteTeile(A.aufgabe);
  teileStarten(A.teile);
  A.idx = 0; A.phase = 'eingabe'; A.feld = 'z';
  A.meldung = auto ? 'Jetzt rechnest du in Schritten.' : null;
  protokoll(S, 'schritte_an', { id: A.aufgabe.id, auto, versuche: alt ? alt.versuche.length : 0, ms: Date.now() - A.start });
  sichern();
  zeigeAufgabe();
}

// Formeln und Gleichungen mit echten Brüchen anzeigen (F_G mit tiefgestelltem G)
const groesseHtml = (n) => (n === 'F_G' ? 'F<sub>G</sub>' : /^A_[GMO]$/.test(n) ? `A<sub>${n[2]}</sub>` : n === 'v₀' ? 'v<sub>0</sub>' : esc(n));
function formelText(text) {
  const h = PH.gleichungHtml(text, PH.variablenIn(text), esc, groesseHtml);
  return h == null ? mathe(text) : h;
}
const rechnungHtml = (a) => (a.thema === 'umstellen' || a.typ === 'formel' ? formelText(a.rechnung) : mathe(a.rechnung));

function zeigeAufgabe() {
  const a = A.aufgabe;
  const altBox = document.querySelector('.aufgabe-screen.mit-uf > .aufgabe-inhalt');
  const altScroll = altBox ? altBox.scrollTop : null;
  const min = Math.round(L.minutenFuerPosition(A.serienPos, R()) * L.muehFaktor(a, R(), { umformen: !!A.uf }) * 100) / 100;
  const tz = String(min).replace('.', ',');
  const icons = (a.hinweise || []).filter(id => HMAP[id]).map(id =>
    `<button class="hw-btn${A.meldung && A.phase === 'tipp' ? ' pulsieren' : ''}" data-act="hinweis" data-id="${id}" aria-label="Hinweis ${esc(HMAP[id].titel)}">${hinweisIcon(HMAP[id], 42)}</button>`).join('');

  const wpMoeglich = sternzeit() && A.knobeln && !A.fertig && a.wissenspunkte ? a.wissenspunkte : null;
  // Ohne „Verstanden“: Tipp direkt unter der Eingabe, damit ihn die Tastatur nicht verdeckt
  const tippInKarte = !bed('verstanden') && !!A.meldung && A.phase === 'eingabe' && !(A.uf && !A.fertig);
  $app.innerHTML = `
  <div class="screen aufgabe-screen${A.uf && !A.fertig ? ' mit-uf' : ''}">
    ${sternzeit() ? szKopf() : ''}
    <header class="topbar">
      <button class="btn-text" data-act="beenden">✕ Fertig</button>
      ${zeitZeigen() ? `<div class="serie-chip">Aufgabe ${A.serienPos} · <b>${istBild() ? String(Math.round(min * BZ().faktor * 100) / 100).replace('.', ',') : tz} Min.</b></div>
      ${istBild() ? `<div class="zeit-chip bz-chip">${videoSymbol(18)}${BS.minText(bzKonto().stand)}</div>` : `<div class="zeit-chip">${zeitSymbol(18)}${L.formatZeit(S.guthaben)}</div>`}` : `<div class="serie-chip">Aufgabe ${A.serienPos}</div>`}
    </header>
    <main class="aufgabe-inhalt">
      ${A.wartete && !A.fertig && A.teile.every(t => !t.versuche.length) ? '<p class="wartet-hinweis">Diese Aufgabe wartet noch auf dich.</p>' : ''}
      ${A.uzHinweis && !A.fertig ? '<div class="uz-hinweis"><b>Für heute hast du dein Pensum erreicht.</b><br>Die laufende Aufgabe kannst du noch fertig machen.</div>' : ''}
      <article class="karte aufgabe${a.bonus ? ' bonus' : ''}">
        ${a.bonus ? `<div class="bonus-kopf"><span class="bonus-label">Bonus · freiwillig</span>${!A.fertig && A.teile.every(t => !t.versuche.length) ? '<button class="btn-text klein" data-act="ueberspringen">Überspringen</button>' : ''}</div>` : ''}
        ${sternzeit() ? `<div class="sz-label">${physik(a) ? 'Physik' : 'Mathe'} · ${esc(THEMA_NAMEN[a.thema] || a.thema)}</div>` : ''}
        ${a.typ === 'detektiv' ? '<div class="detektiv-kopf"><span class="detektiv-marke">🔍 Fehler-Detektiv</span><button class="detektiv-hilfe" data-act="detektivHilfe" aria-label="Was ist der Fehler-Detektiv?">?</button></div>' : ''}
        ${a.geschichte ? geschichteHtml(a) : ''}
        ${a.rechnung ? `<div class="rechnung${a.rechnung.length > 22 ? ' lang' : ''}">${rechnungHtml(a)}</div>` : ''}
        ${a.bild ? `<div class="bild">${a.bild.linien ? linienBild(a) : bildSvg(a.bild)}</div>` : ''}
        ${a.typ === 'detektiv' && !liestNoch() ? fremdeRechnungHtml(a) : ''}
        ${liestNoch() ? '' : `${!(a.typ === 'auswahl' || (a.typ === 'formel' && a.eingabe === 'auswahl')) ? `<p class="frage">${a.typ === 'detektiv' ? `<b>${mathe(a.frage)}</b>` : A.signal ? L.signalMarkieren(mathe(a.frage)) : mathe(a.frage)}</p>` : ''}
        ${A.knobeln && !A.fertig ? '<div class="knobel-zeile">✦ Knobel erst selbst.</div>' : ''}
        <div class="teile">${teileHtml()}</div>
        ${ufAngebot() ? `<button class="btn knobel-schritte" data-act="ufAn">In Schritten umformen${sternzeit() && !A.test ? ` <small>· dann ${wpMoeglich ? wpMoeglich.schritte : 1} WP</small>` : ''}</button>`
          : A.knobeln && !A.fertig && A.phase === 'eingabe' ? `<button class="btn knobel-schritte" data-act="schritteAn">In Schritten rechnen${wpMoeglich ? ` <small>· dann ${wpMoeglich.schritte} WP</small>` : ''}</button>` : ''}`}
        ${tippInKarte ? `<div class="meldung meldung-in-karte${A.meldung === SCHNELL_TIPP ? ' schnell' : ''}">${meldungHtml()}</div>` : ''}
        <div class="hw-leiste"><span class="gedaempft">Hinweis:</span>${icons}
          ${wpMoeglich ? `<span class="sz-punkte wp-chip">◆ ${wpMoeglich.knobeln} WP</span>` : ''}
          ${L.rechnerFrei(a) && !A.fertig ? '<button class="btn btn-klein btn-rechner" data-act="rechner">Taschenrechner</button>' : ''}
          ${hilfeKnopf()}
          ${rechnerAngeboten(a) && !A.fertig ? `<button class="btn btn-klein btn-rechner optional" data-act="rechnerOptional">${A.rechnerHalb || R().rechner >= 1 || !zeitZeigen() ? 'Taschenrechner' : R().rechner > 0 ? 'Taschenrechner · ½ Zeit' : 'Taschenrechner · keine Zeit'}</button>` : ''}
        </div>
      </article>
      ${A.meldung && A.phase === 'eingabe' && !(A.uf && !A.fertig) && !tippInKarte ? `<div class="meldung${A.meldung === SCHNELL_TIPP ? ' schnell' : ''}">${meldungHtml()}</div>` : ''}
      ${A.fertig ? ergebnisHtml() : ''}
    </main>
    <footer class="eingabe-bereich">${fussHtml()}</footer>
  </div>`;
  const aktiv = document.querySelector('.teil.aktiv');
  // Umformen: Tastatur fest am unteren Rand, darüber so viel Platz, dass sich jedes Feld über sie scrollen lässt
  if (A.uf && !A.fertig) {
    const box = document.querySelector('.aufgabe-screen.mit-uf > .aufgabe-inhalt');
    if (box && getComputedStyle(box).overflowY === 'auto') { window.scrollTo(0, 0); if (altScroll != null) box.scrollTop = altScroll; }
    ufSichtbar();
  }
  else if (aktiv && !A.fertig) aktiv.scrollIntoView({ block: 'nearest' });
  hilfeTicken();
}

const meldungHtml = () => { if (A.meldung === SCHNELL_TIPP) return `<b>Zu schnell.</b> ${esc(SCHNELL_TIPP)} <span class="gedaempft">Das zählt nicht als Versuch.</span>`; const t = A.teile && A.teile[A.idx]; return esc(A.meldung) + (t && t.tafel && A.meldung === t.tipp ? stellentafelHtml(t.tafel) : ''); };

// ---------- Textaufgaben: Satz für Satz, Vorlesen, Zahlen markieren ----------
const liestNoch = () => !!(A && !A.fertig && A.aufgabe.geschichte && A.satz != null && A.satz < L.saetzeVon(A.aufgabe.geschichte).length);

function zahlenMarkieren(html) {
  // nur Text zwischen Tags, nicht in Attributen
  return html.replace(/>([^<]*)</g, (_, txt) => '>' + txt.replace(/(−?\d+(?:,\d+)?(?:\u00A0?(?:€|%|cm|m))?)/g, '<mark class="zahl-mark">$1</mark>') + '<');
}

// ---------- Gleich viel gefärbt und Fehler-Detektiv (Auftrag 17) ----------
// „4/8 = ?/2“: links der Bruch aus der Aufgabe, rechts Zähler eintippen, Nenner fest
function bruchGleichHtml(t, aktiv) {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(t.label || '');
  const links = m ? `${bruchHtml(m[1], m[2], true)}<span class="gl">=</span>` : '';
  if (!aktiv && t.status !== 'offen') return `<div class="bruch-gleich">${links}${erledigtWert(t, bruchHtml(t.antwort.zaehler, t.antwort.nenner, true), true)}</div>`;
  return `<div class="bruch-gleich">${links}<div class="bruch-eingabe">
    ${aktiv ? `<button class="feld bruch-feld aktiv-feld" data-act="feld" data-feld="z">${esc(t.z) || '?'}</button>` : '<div class="feld bruch-feld leer">?</div>'}
    <div class="bruch-strich"></div><div class="feld bruch-feld fest">${t.antwort.nenner}</div></div></div>`;
}
function linienBild(a) {
  const t = aktuellerTeil();
  const dran = !A.fertig && t && t.art === 'linien' && !t.fest;
  const fest = A.teile.filter(x => x.art === 'linien' && x.fest).flatMap(x => x.fest);
  return linienSvg(a.bild, { gewaehlt: dran ? t.linien : [], fest, tippbar: dran && A.phase === 'eingabe', alle: dran });
}
function linieTippen(i) {
  const t = aktuellerTeil();
  if (!t || t.art !== 'linien' || A.phase !== 'eingabe') return;
  t.linien = t.linien.includes(i) ? t.linien.filter(x => x !== i) : [...t.linien, i].sort((x, y) => x - y);
  A.meldung = null;
  zeigeAufgabe();
}
function linienPruefen() {
  const t = aktuellerTeil();
  if (!t || t.art !== 'linien' || A.phase !== 'eingabe') return;
  if (!t.linien.length) { A.meldung = 'Tippe zuerst eine Linie an.'; return zeigeAufgabe(); }
  const eingabe = t.linien.join(',');
  if (t.versuche.some(v => v.eingabe === eingabe)) { A.meldung = 'Das hattest du schon. Schau noch einmal auf die Teile.'; return zeigeAufgabe(); }
  const r = GF.pruefeLinien(A.aufgabe.bild, t.linien, t.richtig);
  const schnell = !r.richtig && L.zuSchnell(A.aufgabe, t, Date.now() - t.seit);
  if (schnell) { t.linien = []; return zuSchnellMelden(t, eingabe, schnell); }
  if (r.richtig) t.fest = t.linien.slice();
  else if (t.versuche.length + 1 >= 2) t.fest = t.richtig.slice(); // nach dem 2. Versuch zeigt das Bild die richtigen Linien
  versuchMerken(t, eingabe, r.richtig, r.fehler);
}
// Wort für die Teile in einer Gefärbt-Aufgabe (Hälften oder Viertel)
function gefaerbtWort(a) {
  const lt = A.teile.find(x => x.art === 'linien');
  return lt ? GF.teileWort(GF.zielTeile(a.bild, lt.richtig)) : 'Teile';
}
function fremdeRechnungHtml(a) {
  const g = L.fremderGenitiv(a);
  const wer = g ? `${esc(g)} Rechnung` : 'Die Rechnung';
  return `<div class="fremde-rechnung"><div class="fr-wer">${wer}</div><div class="fr-text">${mathe(a.fremde_rechnung)}</div></div>`;
}
function detektivEinfuehrung(beimSchliessen = null) {
  oeffneModal(`<div class="hinweis-text detektiv-einfuehrung"><div class="de-lupe" aria-hidden="true">🔍</div><h2 class="modal-titel">Fehler-Detektiv</h2>
    <p>Hier hat jemand gerechnet.</p><p><b>Prüfe: Stimmt das?</b></p><p>Wenn nicht: Finde den Fehler und rechne richtig.</p>
    <div class="de-schritte"><div><span>1</span>Stimmt oder stimmt nicht?</div><div><span>2</span>Was ist falsch?</div><div><span>3</span>Richtig rechnen</div></div>
    <p class="gedaempft klein">Nicht jede Rechnung ist falsch. Rechne selbst nach.</p>
    <button class="btn btn-haupt" data-act="modalZu">Los geht’s</button></div>`, beimSchliessen);
}

function geschichteHtml(a) {
  const saetze = L.saetzeVon(a.geschichte);
  const n = A.fertig || A.satz == null ? saetze.length : Math.min(A.satz, saetze.length);
  let html = `<span>${saetze.slice(0, n).map(s => mathe(s)).join(' ')}</span>`;
  if (A.textHilfe) html = zahlenMarkieren(html);
  if (A.signal) html = L.signalMarkieren(html);
  const vorlesen = 'speechSynthesis' in window ? `<button class="btn btn-klein btn-vorlesen" data-act="vorlesen" aria-label="Vorlesen">${lautsprecher()} Vorlesen</button>` : '';
  const weiter = liestNoch() ? `<p class="satz-info gedaempft klein">Satz ${n} von ${saetze.length}</p>` : '';
  return `<div class="geschichte-box"><p class="geschichte">${html}</p><div class="geschichte-leiste">${vorlesen}${weiter}</div></div>`;
}

function lautsprecher() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

function vorlesen() {
  if (!A || !('speechSynthesis' in window)) return;
  const a = A.aufgabe;
  const saetze = L.saetzeVon(a.geschichte);
  const n = A.fertig || A.satz == null ? saetze.length : Math.min(A.satz, saetze.length);
  let text = saetze.slice(0, n).join(' ');
  if (!liestNoch() && a.frage) text += ' ' + a.frage;
  text = text.replace(/−/g, 'minus ').replace(/€/g, ' Euro').replace(/%/g, ' Prozent');
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE'; u.rate = 0.9;
    const stimme = speechSynthesis.getVoices().find(v => /^de/i.test(v.lang));
    if (stimme) u.voice = stimme;
    speechSynthesis.speak(u);
  } catch (e) { /* ohne Sprachausgabe */ }
  protokoll(S, 'vorlesen', { id: a.id, saetze: n });
  sichern();
}

function naechsterSatz() {
  if (!liestNoch()) return;
  A.satz++;
  if (!liestNoch()) {
    protokoll(S, 'gelesen', { id: A.aufgabe.id, ms: Date.now() - A.start });
    const t = aktuellerTeil(); if (t) t.seit = Date.now();
    if (ufSofort()) { sichern(); return ufAn(true); }
  }
  sichern();
  zeigeAufgabe();
}

// „Fertig“ bei einer Textaufgabe: erst Hilfe anbieten (einmal pro Aufgabe)
function textHilfeAnbieten() {
  A.hilfeAngeboten = true;
  oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Soll ich dir helfen?</h2>
    <p>Ich lese dir die Geschichte vor. Und ich markiere die Zahlen.</p>
    <div class="knopf-reihe"><button class="btn btn-haupt" data-act="textHilfeJa">Ja, hilf mir</button><button class="btn" data-act="textHilfeNein">Nein, später</button></div></div>`);
}

function textHilfeJa() {
  schliesseModal();
  A.textHilfe = true;
  if (A.satz != null) A.satz = L.saetzeVon(A.aufgabe.geschichte).length;
  protokoll(S, 'text_hilfe', { id: A.aufgabe.id, angenommen: true });
  sichern();
  zeigeAufgabe();
  vorlesen();
}

function beendenJetzt() {
  if (A && !A.fertig) {
    const ohneEingabe = A.teile.every(t => !t.versuche.length);
    protokoll(S, 'aufgabe_abgebrochen', { id: A.aufgabe.id, teil: A.idx, ms: Date.now() - A.start, ohneEingabe, thema: A.aufgabe.thema, wartet: !A.aufgabe.bonus });
    if (!A.test) { paketZeitBuchen(A.paket, Date.now() - A.start); wpBuchen(A.aufgabe, Date.now() - A.start); }
    // Freiwillige Bonus-Aufgaben dürfen weg. Alle anderen warten, bis sie gelöst sind.
    if (!A.aufgabe.bonus && !A.test) S.wartet = aufgabeSchnappschuss();
    // Die verlassene Aufgabe zählt nicht für die Serie
    S.serie.pos = Math.max(0, S.serie.pos - 1);
  }
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* egal */ }
  S.laufend = null;
  A = null; sichern(); zeigeStart();
}

// Rechnung legen: Kärtchen wählen und prüfen
function karteWaehlen(p, k) {
  const t = aktuellerTeil();
  if (!t || t.art !== 'legen' || A.phase !== 'eingabe') return;
  t.wahl[p] = k; A.meldung = null;
  zeigeAufgabe();
}

function kartenPruefen() {
  const t = aktuellerTeil();
  if (!t || t.art !== 'legen' || A.phase !== 'eingabe' || t.wahl.some(w => w == null)) return;
  const a = A.aufgabe;
  const eingabe = t.karten.map((k, i) => k.optionen[t.wahl[i]]).join(' ');
  const { richtig, falsch } = L.pruefeKarten(t.karten, t.wahl);
  const schnell = !richtig && L.zuSchnell(a, t, Date.now() - t.seit);
  if (schnell) return zuSchnellMelden(t, eingabe, schnell);
  if (!richtig && t.versuche.some(v => v.eingabe === eingabe)) {
    A.meldung = 'Das hattest du schon. Schau noch einmal auf jeden Teil.';
    protokoll(S, 'versuch_wiederholt', { id: a.id, teil: A.idx, eingabe });
    sichern(); return zeigeAufgabe();
  }
  const fehler = richtig ? null : {
    typ: 'karten',
    text: a.thema === 'rabatt' ? 'Vom Preis geht der Rabatt weg. Schau noch einmal.' : 'Schau auf jeden Teil: Geld oder Schulden? Kommt Geld dazu oder geht es weg?'
  };
  if (!richtig) t.wahl = t.wahl.map((w, i) => (falsch.includes(i) ? null : w));
  versuchMerken(t, eingabe, richtig, fehler);
}

// Zu schnelle Eingabe: zählt nicht als Versuch. art 'text' (1. Versuch einer Textaufgabe) oder 'tipp' (nach einem Fehler, Auftrag 18)
const SCHNELL_TIPP = 'Lies den Tipp und rechne in Ruhe.';
const LESE_TIPP = 'Lies den Satz noch einmal. Was passiert mit dem Ding?';
function eingabeLeeren(t) { t.eingabe = ''; t.z = ''; t.n = t.nennerFest ? String(t.antwort.nenner) : ''; t.e = ''; t.tokens = []; t.gelegt = []; }
function zuSchnellMelden(t, eingabe, art = 'text') {
  const ms = Date.now() - t.seit;
  A.meldung = art === 'tipp' ? SCHNELL_TIPP : art === 'auswahl' ? LESE_TIPP : 'Lies noch einmal. Welche Zahlen brauchst du?';
  // Auswahl zu schnell (Auftrag 37): Signalwörter markieren, keine Strafe, zählt nicht für den Hinweis gegen Durchklicken
  if (art === 'auswahl') {
    A.meldung = null; t.leseSchnell = (t.leseSchnell || 0) + 1; A.signal = true; t.gewaehlt = null; t.seit = Date.now();
    protokoll(S, 'zu_schnell', { id: A.aufgabe.id, teil: A.idx, eingabe, ms, art }); sichern(); zeigeAufgabe();
    const g = document.querySelector('.geschichte-box, .frage'); if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  t.schnell = (t.schnell || 0) + 1;
  A.schnellFolge = (A.schnellFolge || 0) + 1;
  protokoll(S, 'zu_schnell', { id: A.aufgabe.id, teil: A.idx, eingabe, ms, art, folge: A.schnellFolge });
  if (t.art !== 'legen') eingabeLeeren(t);
  if (art === 'tipp') t.seit = Date.now();
  // Hinweis gegen Durchklicken: nach zwei zu schnellen Eingaben hintereinander, einmal pro Aufgabe (je Kind schaltbar)
  const hinweis = A.schnellFolge >= 2 && R().durchklick && !A.durchklick;
  if (hinweis) { A.durchklick = true; protokoll(S, 'durchklick_hinweis', { id: A.aufgabe.id, teil: A.idx }); }
  sichern();
  zeigeAufgabe();
  if (hinweis) durchklickHinweis();
}
function durchklickHinweis() {
  oeffneModal(`<div class="hinweis-text durchklick"><div class="dk-symbol" aria-hidden="true">⏸</div><h2 class="modal-titel">Kurz anhalten</h2>
    <p><b>Durchklicken bringt dir keine Zeit.</b></p><p>Diese oder eine ähnliche Aufgabe kommt wieder.</p>
    <p>Wenn du sie dann richtig machst, bekommst du <b>Bonuszeit</b>.</p>
    <button class="btn btn-haupt" data-act="modalZu">Verstanden, ich rechne</button></div>`);
}
// Fehler-Detektiv: die Zahl aus der fremden Rechnung abgetippt. Zählt nicht als Versuch.
function fremdeZahlMelden(t, eingabe) {
  const wer = L.fremderGenitiv(A.aufgabe);
  A.meldung = `${wer ? `Das ist ${wer} Ergebnis.` : 'Das ist das Ergebnis aus der Rechnung.'} Rechne selbst neu.`;
  protokoll(S, 'fremde_zahl', { id: A.aufgabe.id, teil: A.idx, eingabe, fehler: 'fremde_zahl', ms: Date.now() - t.seit });
  eingabeLeeren(t);
  t.seit = Date.now();
  sichern();
  zeigeAufgabe();
}

function legenHtml(t, aktiv, nr) {
  const plaetze = t.karten.map((k, p) => {
    const gew = aktiv ? t.wahl[p] : k.richtig;
    const knoepfe = k.optionen.map((o, j) => `<button class="karte-btn${gew === j ? ' gewaehlt' : ''}" data-act="karte" data-p="${p}" data-k="${j}" ${aktiv && A.phase === 'eingabe' ? '' : 'disabled'}>${mathe(o)}</button>`).join('');
    return `<div class="legen-platz"><span class="legen-label">${esc(k.label)}</span><div class="legen-karten">${knoepfe}</div></div>`;
  }).join('');
  const reihe = t.karten.map((k, p) => { const w = aktiv ? t.wahl[p] : k.richtig; return `<span class="legen-feld${w == null ? ' leer' : ''}">${w == null ? '?' : mathe(k.optionen[w])}</span>`; }).join('');
  const fertig = !aktiv ? erledigtWert(t, t.karten.map(k => k.optionen[k.richtig]).join(' ')) : '';
  return `<div class="teil-label">${nr}<span><b>${mathe(t.label)}</b></span></div>${aktiv ? `<div class="legen-rechnung">${reihe}</div><div class="legen-plaetze">${plaetze}</div>` : `<div class="feld-zeile">${fertig}</div>`}`;
}

function teileHtml() {
  const a = A.aufgabe;
  const haupt = A.teile.filter(t => !t.merk);
  const mehrteilig = haupt.length > 1;
  const block = (a.generator || '').startsWith('block');
  const versatz = A.teile.length - haupt.length;
  const html = A.teile.map((t, i) => {
    if (i > A.idx && !A.fertig) {
      if (a.bild && a.bild.linien && !t.merk) return `<div class="teil zukunft">${t.art === 'bruch' && t.nennerFest ? bruchGleichHtml(t, false) : `<div class="teil-label"><span class="teil-nr">${i + 1 - versatz}</span><span>${mathe(t.label)}</span></div>${t.art === 'zahl' ? '<div class="feld-zeile"><div class="feld leer">?</div></div>' : ''}`}</div>`;
      if (block && !t.merk) return `<div class="teil block-teil zukunft"><div class="teil-label"><span>${mathe(t.label)}</span></div><button class="feld leer tippbar" data-act="springe" data-i="${i}" aria-label="Zu diesem Feld springen">?</button></div>`;
      if (!t.merk) return '';
    }
    const aktiv = i === A.idx && !A.fertig;
    const nr = mehrteilig && !t.merk && a.typ !== 'auswahl' && !block ? `<span class="teil-nr">${i + 1 - versatz}</span>` : '';
    const bonus = t.bonus ? '<span class="bonus-label klein">Bonus</span>' : '';
    let inhalt = '';
    if (t.art === 'zahl') {
      const label = t.label ? `<div class="teil-label">${nr}${bonus}<span>${mathe(t.label)}</span></div>` : '';
      if (aktiv && t.zp) {
        inhalt = `${label}${zpEingabeHtml(t)}`;
      } else if (aktiv) {
        inhalt = `${label}<div class="feld-zeile"><div class="feld aktiv-feld${t.eingabe ? '' : ' leer'}" aria-live="polite">${esc(t.eingabe.replace('-', '−')) || '?'}</div>${t.einheit ? `<span class="einheit">${esc(t.einheit)}</span>` : ''}</div>`;
      } else {
        const ok = t.versuche.find(v => v.richtig);
        const zeigen = ok ? `${eingabeText(ok.eingabe)}${t.einheit ? ' ' + t.einheit : ''}` : formatWert(t.ziel.wert, t.einheit);
        inhalt = `${label}<div class="feld-zeile">${erledigtWert(t, zeigen)}</div>`;
      }
    } else if (t.art === 'zp') {
      if (aktiv) inhalt = zpEingabeHtml(t);
      else {
        const ok = t.versuche.find(v => v.richtig);
        const zeigen = ok ? eingabeText(ok.eingabe) : PH.potenzText(t.antwort.mantisse, t.antwort.exponent, t.antwort.gueltige_ziffern || null);
        inhalt = `<div class="feld-zeile">${erledigtWert(t, zeigen + (t.einheit ? ' ' + t.einheit : ''))}</div>`;
      }
    } else if (t.art === 'formel') {
      inhalt = formelTeilHtml(t, aktiv);
    } else if (t.art === 'umformen') {
      inhalt = umformHtml(t, aktiv);
    } else if (t.art === 'linien') {
      inhalt = `<div class="teil-label">${nr}<span>${aktiv ? `<b>${mathe(t.label)}</b>` : mathe(t.label.split('.')[0] + '.')}</span></div>${aktiv
        ? '<p class="gedaempft klein">Tippe eine Linie an. Noch mal tippen nimmt sie zurück.</p>'
        : `<div class="feld-zeile">${erledigtWert(t, 'Linien eingezeichnet')}</div>`}`;
    } else if (t.art === 'bruch' && t.nennerFest) {
      inhalt = `<div class="teil-label">${nr}<span>Gleich viel gefärbt:</span></div>${bruchGleichHtml(t, aktiv)}${aktiv ? `<p class="gedaempft klein mitte">Wie viele ${esc(gefaerbtWort(a))} sind gefärbt? Tippe die Zahl oben ein.</p>` : ''}`;
    } else if (t.art === 'bruch') {
      if (aktiv) {
        inhalt = `<div class="bruch-eingabe">
          <button class="feld bruch-feld${A.feld === 'z' ? ' aktiv-feld' : ''}" data-act="feld" data-feld="z">${esc(t.z) || '?'}</button>
          <div class="bruch-strich"></div>
          <button class="feld bruch-feld${A.feld === 'n' ? ' aktiv-feld' : ''}" data-act="feld" data-feld="n">${esc(t.n) || '?'}</button>
        </div><p class="gedaempft klein mitte">Oben: gefärbte Teile. Unten: alle Teile. Tippe ein Feld an.</p>`;
      } else {
        inhalt = `<div class="feld-zeile">${erledigtWert(t, bruchHtml(t.antwort.zaehler, t.antwort.nenner), true)}</div>`;
      }
    } else if (t.art === 'wahl' && t.detektiv) {
      const dAus = (k) => (A.phase === 'eingabe' && !t.versuche.some(v => v.eingabe === k) ? '' : 'disabled');
      if (aktiv) inhalt = `<div class="detektiv-knoepfe"><button class="detektiv-btn ja" data-act="wahl" data-k="0" ${dAus('0')}><span class="dk-zeichen" aria-hidden="true">✓</span>Stimmt</button><button class="detektiv-btn nein" data-act="wahl" data-k="1" ${dAus('1')}><span class="dk-zeichen" aria-hidden="true">✗</span>Stimmt nicht</button></div>`;
      else inhalt = `<div class="feld-zeile">${erledigtWert(t, t.optionen[t.richtig])}</div>`;
    } else if (t.art === 'wahl') {
      const knoepfe = t.optionen.map((o, k) => {
        let kl = 'wahl-btn';
        // Wörter als Antwort: kleiner und mit Silbentrennung, damit lange Wörter („Federkraftmesser“) in den Knopf passen
        if (!t.formel && /[A-Za-zÄÖÜäöüß]{4}/.test(o)) kl += Math.max(...String(o).split(/\s+/).map(w => w.length)) >= 11 ? ' wahl-text lang' : ' wahl-text';
        if (!aktiv) { if (k === t.richtig) kl += ' wahl-richtig'; else if (t.gewaehlt === k) kl += ' wahl-falsch'; }
        return `<button class="${kl}${t.formel ? ' formel-wahl' : ''}" data-act="wahl" data-k="${k}" ${aktiv && A.phase === 'eingabe' ? '' : 'disabled'}>${t.formel ? formelText(o) : mathe(o)}</button>`;
      }).join('');
      inhalt = `<div class="teil-label">${nr}<span><b>${mathe(t.label)}</b></span></div>${aktiv && t.leseSchnell && A.phase === 'eingabe' ? `<div class="lese-tipp">${esc(LESE_TIPP)} Die wichtigen Wörter sind oben markiert.</div>` : ''}<div class="wahl-reihe${t.spalte || /wahl-text lang/.test(knoepfe) ? ' wahl-spalte' : ''}">${knoepfe}</div>`;
    } else if (t.art === 'zuordnung') {
      inhalt = zuordnungHtml(aktiv);
    } else if (t.art === 'legen') {
      inhalt = legenHtml(t, aktiv, nr);
    }
    let zusatz = '';
    if (aktiv && A.phase === 'tipp') zusatz = `<div class="tipp"><b>Noch nicht.</b> ${esc(t.tipp)}${t.tafel ? stellentafelHtml(t.tafel) : ''}</div>`;
    if (aktiv && t.hilfe && A.phase !== 'tipp') zusatz += hilfeBox(t);
    if (i === A.idx && A.phase === 'aufgeloest') zusatz = `<div class="aufloesung">So ist es richtig: <b>${loesungText(t)}</b>${t.loesungTipp ? `<br>${mathe(t.loesungTipp)}` : ''}${t.tafel ? stellentafelHtml(t.tafel, true) : ''}</div>`;
    if (t.merk && i > A.idx && !A.fertig) {
      inhalt = `<div class="teil-label"><span>${mathe(t.label)}</span></div><div class="feld-zeile"><button class="feld leer tippbar" data-act="springe" data-i="${i}" aria-label="Zu diesem Feld springen">?</button>${t.einheit ? `<span class="einheit">${esc(t.einheit)}</span>` : ''}</div>`;
    }
    const kl = `teil${aktiv ? ' aktiv' : ''}${t.merk ? ' merk' : ''}${block && !t.merk ? ' block-teil' : ''}`;
    return { merk: !!t.merk, html: `<div class="${kl}">${inhalt}${zusatz}</div>` };
  });
  const merk = html.filter(h => h && h.merk).map(h => h.html).join('');
  const rest = html.filter(h => h && (typeof h === 'string' || !h.merk)).map(h => typeof h === 'string' ? h : h.html).join('');
  return (merk ? `<div class="merkzettel"><div class="merk-titel">Merkzettel</div><p class="merk-text">Schreib dir die Zahlen auf, die du brauchst.</p>${merk}</div>` : '') + rest;
}

// Eingabe „3.8e3“ (Zahl · 10ⁿ) als Text „3,8 · 10³“
function eingabeText(e) {
  const m = /^(-?[\d.]+)e(-?\d+)$/.exec(String(e));
  if (m) return `${m[1].replace('-', '−').replace('.', ',')} · 10${PH.hoch(Number(m[2]))}`;
  return String(e).replace('-', '−').replace('.', ',');
}
function zpEingabeHtml(t) {
  const f = A.feld === 'e' ? 'e' : 'z';
  return `<div class="zp-eingabe">
    <button class="feld zp-zahl${f === 'z' ? ' aktiv-feld' : ''}${t.eingabe ? '' : ' leer'}" data-act="feld" data-feld="z">${esc(t.eingabe.replace('-', '−')) || '?'}</button>
    <span class="zp-mal">· 10</span>
    <button class="feld zp-hoch${f === 'e' ? ' aktiv-feld' : ''}${t.e ? '' : ' leer'}" data-act="feld" data-feld="e">${esc(t.e.replace('-', '−')) || '?'}</button>
    ${t.einheit ? `<span class="einheit">${esc(t.einheit)}</span>` : ''}
  </div><p class="gedaempft klein">Tippe auf ein Feld: links die Zahl, oben die Hochzahl.</p>`;
}
// Formel legen (Kärtchen) oder frei tippen
function formelTeilHtml(t, aktiv) {
  const w = t.antwort;
  if (!aktiv) {
    const ok = t.versuche.find(v => v.richtig);
    return `<div class="feld-zeile">${erledigtWert(t, formelText(ok ? ok.eingabe : `${w.ziel} = ${w.formel}`), true)}</div>`;
  }
  const text = formelEingabe(t);
  const anzeige = text.trim() ? (PH.gleichungHtml(text, [...w.variablen, w.ziel], esc, groesseHtml) || esc(text)) : '';
  if (t.fmodus === 'karten') {
    const karten = t.karten.map((k, i) => `<button class="formel-karte${t.gelegt.includes(i) ? ' weg' : ''}" data-act="fKarte" data-i="${i}" ${t.gelegt.includes(i) || A.phase !== 'eingabe' ? 'disabled' : ''}>${groesseHtml(k)}</button>`).join('');
    return `<div class="formel-feld${anzeige ? '' : ' leer'}">${anzeige || 'Lege die Kärtchen der Reihe nach.'}</div>
      <div class="formel-karten">${karten}</div>`;
  }
  return `<div class="formel-feld">${groesseHtml(w.ziel)} = ${anzeige}<span class="formel-cursor">|</span></div>`;
}
// Text der Formel-Eingabe: Kärtchen „V = m : ρ“, frei nur die rechte Seite
function formelEingabe(t) {
  if (t.fmodus === 'karten') return t.gelegt.map(i => t.karten[i]).join(' ');
  return t.tokens.join(' ');
}

function loesungText(t) {
  if (t.art === 'zp') return esc(PH.potenzText(t.antwort.mantisse, t.antwort.exponent, t.antwort.gueltige_ziffern || null) + (t.einheit ? ' ' + t.einheit : ''));
  if (t.art === 'formel') return formelText(`${t.antwort.ziel} = ${t.antwort.formel}`);
  if (t.art === 'zahl' && t.ziel.gueltige) return esc(PH.potenzText(PH.zerlege(t.ziel.wert).m, PH.zerlege(t.ziel.wert).e, t.ziel.gueltige) + (t.einheit ? ' ' + t.einheit : '')) + ` <span class="klein">(≈ ${esc(formatWert(PH.aufZiffern(t.ziel.wert, t.ziel.gueltige), t.einheit))})</span>`;
  if (t.art === 'zahl') return esc(formatWert(t.ziel.wert, t.einheit));
  if (t.art === 'bruch') return bruchHtml(t.antwort.zaehler, t.antwort.nenner);
  if (t.art === 'linien') return 'Die Linien siehst du jetzt im Bild.';
  if (t.art === 'wahl') return t.formel ? formelText(t.optionen[t.richtig]) : mathe(t.optionen[t.richtig]);
  if (t.art === 'legen') return mathe(t.karten.map(k => k.optionen[k.richtig]).join(' '));
  return 'siehe unten';
}

function erledigtWert(t, wertHtml, roh = false) {
  const w = roh ? wertHtml : esc(wertHtml);
  if (t.status === 'erst' || t.status === 'zweit') return `<span class="erledigt richtig">${w} <span class="haken">✓</span></span>`;
  if (t.status === 'uebersprungen') return `<span class="erledigt gedaempft">übersprungen</span>`;
  return `<span class="erledigt loesung">${w}</span>`;
}

function fussHtml() {
  if (A.fertig) {
    if (uzGesperrt()) {
      return `<div class="fuss-knoepfe"><p class="uz-fuss">Für heute hast du dein Pensum erreicht.</p><button class="btn btn-haupt btn-gross" data-act="uebungszeit">Für heute fertig</button></div>`;
    }
    return `<div class="fuss-knoepfe">
      ${A.sz && A.sz.voll && BZ().an && BS.restSek(bzKonto(), BZ()) > 0 ? '<button class="btn btn-bz btn-gross" data-act="zweckBild">Weiter für Bildschirmzeit üben</button>' : '<button class="btn btn-haupt btn-gross" data-act="naechste">Nächste Aufgabe</button>'}
      ${A.bild ? (BS.kannAbschicken(bzKonto(), BZ()) ? `<button class="btn btn-bz-rand" data-act="bzSeite">${BS.minText(bzKonto().stand)} abschicken</button>` : '')
        : bed('spielzeit_zeigen') ? `<button class="btn btn-amber-rand" data-act="zumSpiel">Zum Spiel · ${L.formatZeit(S.guthaben)}</button>` : ''}

    </div>`;
  }
  const t = aktuellerTeil();
  if (liestNoch()) return `<button class="btn btn-haupt btn-gross" data-act="naechsterSatz">Nächster Satz</button>`;
  if (A.phase === 'tipp') return `<button class="btn btn-haupt btn-gross" data-act="verstanden">Verstanden</button>`;
  if (A.phase === 'aufgeloest') return `<button class="btn btn-haupt btn-gross" data-act="weiter">Weiter</button>`;
  if (t.art === 'linien') return `<button class="btn btn-haupt btn-gross" data-act="linienPruefen" ${t.linien.length ? '' : 'disabled'}>Linien prüfen</button>`;
  if (t.art === 'wahl' && t.detektiv) return '';
  if (A.rechnerOffen && A.rechner && t.art !== 'zuordnung') return rechnerPanelHtml(t);
  const aufklappen = A.rechner && !A.rechnerOffen ? '<button class="r-aufklappen" data-act="rAufklappen">Taschenrechner ▲</button>' : '';
  if (t.art === 'zahl' || t.art === 'bruch' || t.art === 'zp') {
    // Physik: Ergebnis auch als Zahl · 10ⁿ (Umschalter); Typ zehnerpotenz: Umschalter Zahl / Hochzahl
    const zpSchalter = t.art === 'zp' || t.zp;
    const zpKnopf = t.art === 'zahl' && !t.merk && physik(A.aufgabe);
    const komma = (k) => k === ',' && zpSchalter && A.feld === 'e';
    return `${aufklappen}${t.bonus ? '<button class="btn-text klein ueberspringen" data-act="teilUeberspringen">Bonus überspringen</button>' : ''}
    ${zpSchalter ? `<div class="zp-schalter"><button class="${A.feld !== 'e' ? 'an' : ''}" data-act="feld" data-feld="z">Zahl</button><button class="${A.feld === 'e' ? 'an' : ''}" data-act="feld" data-feld="e">Hochzahl</button></div>` : ''}
    <div class="tastatur">
      ${['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', ','].map(k => `<button class="taste${k === '⌫' || k === '−' || k === ',' ? ' taste-sonder' : ''}${k === '−' ? ' taste-vz' : ''}" data-act="taste" data-k="${k}" ${(t.art === 'bruch' && (k === '−' || k === ',')) || komma(k) ? 'disabled' : ''} aria-label="${k === '⌫' ? 'Löschen' : k === '−' ? 'Vorzeichen umschalten' : k}">${k === '−' ? '+/−' : k}</button>`).join('')}
      ${zpKnopf ? `<button class="taste" data-act="taste" data-k="0">0</button><button class="taste taste-sonder taste-zp${t.zp ? ' an' : ''}" data-act="zpUmschalten" aria-label="Zahl mal Zehnerpotenz">· 10ⁿ</button>` : '<button class="taste taste-null" data-act="taste" data-k="0">0</button>'}
      <button class="taste taste-ok" data-act="antwort">Antwort geben</button>
    </div>`;
  }
  if (t.art === 'umformen') return ufFuss();
  if (t.art === 'formel' && t.fmodus === 'karten') {
    return `<div class="knopf-reihe"><button class="btn" data-act="fZurueck" ${t.gelegt.length ? '' : 'disabled'}>↶ Zurück</button><button class="btn btn-haupt" data-act="antwort" ${t.gelegt.length ? '' : 'disabled'}>Prüfen</button></div>`;
  }
  if (t.art === 'formel') {
    // Buchstaben-Tastatur: Größen der Aufgabe, Ziffern, Rechenzeichen, Klammern, Hoch 2
    const w = t.antwort;
    const mitPi = /π/.test(A.aufgabe.rechnung || '') || (w.konstanten || []).includes('π');
    const groessen = w.variablen.map(v => `<button class="taste taste-var" data-act="fTaste" data-k="${esc(v)}">${groesseHtml(v)}</button>`).join('');
    const z = (k, kl = '') => `<button class="taste${kl}" data-act="fTaste" data-k="${k}">${k}</button>`;
    return `<div class="tastatur formel-tastatur">
      ${groessen}${mitPi ? z('π', ' taste-var') : ''}${z('(', ' taste-sonder')}${z(')', ' taste-sonder')}
      ${z('7')}${z('8')}${z('9')}<button class="taste taste-sonder" data-act="fTaste" data-k="⌫" aria-label="Löschen">⌫</button>
      ${z('4')}${z('5')}${z('6')}${z('·', ' taste-sonder')}
      ${z('1')}${z('2')}${z('3')}${z(':', ' taste-sonder')}
      ${z('0')}${z('+', ' taste-sonder')}${z('−', ' taste-sonder')}<button class="taste taste-sonder" data-act="fTaste" data-k="²">x²</button>
      <button class="taste taste-ok voll" data-act="antwort">Antwort geben</button>
    </div>`;
  }
  if (t.art === 'zuordnung') return `<button class="btn btn-haupt btn-gross" data-act="antwort">Antwort geben</button>`;
  if (t.art === 'legen') return `<button class="btn btn-haupt btn-gross" data-act="kartenPruefen" ${t.wahl.some(w => w == null) ? 'disabled' : ''}>Rechnung prüfen</button>`;
  return aufklappen;
}

const MUEHE_NAMEN = { kurz: 'Kurze Aufgabe', normal: 'Aufgabe', lang: 'Lange Aufgabe', schwer: 'Schwere Aufgabe' };
const EXTRA_TEXT = { 0.5: '½', 0.75: '¾', 1: 'voll' };
const faktorText = (x) => ({ 0.5: '½', 0.75: '¾', 1.25: '1¼', 1.5: '1½' })[x] || String(x).replace('.', ',');
function ergebnisHtml() {
  const a = A.aufgabe;
  const sek = A.sekunden;
  let kopf;
  const nm = S.einstellungen.name ? `, ${esc(S.einstellungen.name)}` : '';
  if (A.ergebnis === 'erst') kopf = `<div class="erfolg-titel">${A.serienPos % 3 === 0 ? `Stark${nm}!` : `Richtig${nm}!`}</div>`;
  else if (A.ergebnis === 'zweit') kopf = `<div class="erfolg-titel">Geschafft – im 2. Versuch!</div>`;
  else if (A.ergebnis === 'teil') kopf = `<div class="erfolg-titel teil">Mit Tipp geschafft!</div><p>Ein Schritt kam mit Lösung. Den Rest hast du selbst gerechnet. Dafür gibt es ${Math.round((A.anteil || 0) * 100)} % der Zeit.</p>`;
  else kopf = `<div class="erfolg-titel neutral">Jetzt weißt du, wie es geht.</div><p>Die Aufgabe kommt später noch einmal.</p>`;
  if (A.bonusZeit && zeitZeigen()) kopf += `<div class="bonus-zeit">✦ <b>Bonuszeit:</b> Diesmal hast du es geschafft! <span>×${faktorText(A.bonusZeit)}</span></div>`;
  // Chips unter der verdienten Zeit: Mühe-Faktor (wenn nicht ×1) und Extra-Zeit
  const chips = `${A.muehe && A.muehe !== 1 && A.ergebnis !== 'loesung' ? ` · <span class="muehe-chip">${MUEHE_NAMEN[A.muehGruppe] || 'Aufgabe'} ×${faktorText(A.muehe)}</span>` : ''}${A.extra != null ? ` · <span class="extra-chip">Extra-Zeit (zählt ${EXTRA_TEXT[A.extra] || faktorText(A.extra)})</span>` : ''}`;
  // Verdiente Zeit im Stil des Auswahl-Bildschirms
  let zeit = '';
  const b = A.bild;
  if (b) {
    if (b.plus > 0) zeit = `<div class="mini-gewinn wk-bild"><span class="mini-icons">${bildIcons(0.62)}</span><div><b>+${BS.minText(b.plus)}</b><small>Bildschirmzeit${chips}</small></div></div>`;
    zeit += `<div class="konto-zeile"><span>Gesammelt</span><b>${BS.minText(b.stand)}</b></div>`;
    if (b.stand > 0 && b.stand < BS.abSek(BZ())) zeit += `<p class="bz-ab gedaempft">${abText({ stand: b.stand })}</p>`;
    zeit += b.voll ? `<p class="wechsel-hinweis">Die Bildschirmzeit ist für heute voll. Ab jetzt kommt alle Zeit zur Spielzeit im Schrein.</p>`
      : `<div class="konto-zeile"><span>Heute noch möglich</span><b>${BS.minText(b.rest)}</b></div>`;
  }
  if (A.sz && sek > 0 && bed('spielzeit_zeigen')) {
    zeit += `<div class="mini-gewinn wk-schrein"><span class="mini-icons">${schreinMini()}</span><div><b>+${L.formatMinuten(sek)}</b><small>Spielzeit im Schrein${A.kopf ? ` · mit Kopf-Bonus ×${String(R().kopf).replace('.', ',')}` : ''}${A.bild ? '' : chips}</small></div></div>
      <div class="konto-zeile"><span>Jetzt hast du</span><b>${L.formatZeit(S.guthaben)} Min.</b></div>`;
  }
  if (A.sz && A.sz.voll && A.ergebnis !== 'loesung' && bed('spielzeit_zeigen')) {
    const bzRest = BZ().an ? BS.restSek(bzKonto(), BZ()) : 0;
    zeit += `<p class="voll-hinweis"><b>Die Spielzeit im Schrein ist für heute voll.</b><br>${bzRest > 0 ? `Du kannst noch ${BS.minText(bzRest)} Bildschirmzeit verdienen.` : 'Runensplitter gibt es weiter.'}</p>`;
  }
  if (A.wp > 0) zeit = `<div class="wp-gewinn"><span class="sz-punkte">◆ +${A.wp} WP</span><small>Wissenspunkte · jetzt ${SZ.wissenVon(S.wissen).stand}</small></div>` + zeit;
  if ((A.neueEtappe || []).length) zeit = A.neueEtappe.map(n => `<div class="etappe-feier"><div class="ef-stern" aria-hidden="true">✦</div><div><b>Neue Etappe freigeschaltet!</b><small>${esc(n.name)} · Etappe ${n.nr} von ${n.anzahl}: ${mathe(n.etappeName)}</small></div></div>`).join('') + zeit;
  if (A.kopf) zeit = `<div class="kopf-bonus">${kopfSymbol(44)}<div><b>Im Kopf gerechnet!</b><small>Ohne Taschenrechner. Das ist stark.</small></div></div>` + zeit;
  let strafe = '';

  if (A.rechnerHalb && A.ergebnis !== 'loesung' && R().rechner < 1) strafe += `<p class="gedaempft">Mit Taschenrechner gibt es ${L.anteilText(R().rechner)}.</p>`;
  if (A.hilfeGenutzt && A.ergebnis !== 'loesung' && hilfeAnteil() < 1) strafe += `<p class="gedaempft">Mit „Hilf mir“ gibt es ${L.anteilText(hilfeAnteil())}.</p>`;
  if (A.langHalb && A.ergebnis !== 'loesung') strafe += `<p class="gedaempft">Mit „Mehr Hilfe“ gibt es die Hälfte.</p>`;
  if (A.strafe === 'halb' && A.ergebnis !== 'loesung') strafe = '<p class="gedaempft">Du warst kurz außerhalb der App. Darum gibt es diesmal nur die Hälfte.</p>';
  if (A.strafe === 'null' && A.ergebnis !== 'loesung') strafe = '<p class="gedaempft">Du warst außerhalb der App. Bei Aufgaben ohne Taschenrechner gibt es dafür heute keine Spielzeit.</p>';
  if (A.splitter && A.splitter.length) {
    const n = A.splitter.reduce((x, e) => x + e.n, 0);
    const besondere = A.splitter.filter(e => !['aufgabe', 'erst'].includes(e.grund));
    strafe += `<div class="splitter-gewinn">${splitterSymbol(22)} +${n} Runensplitter${besondere.length ? `<span>${besondere.map(e => esc(e.text)).join(' · ')}</span>` : ''}</div>`;
  }
  const weg = `<div class="loesungsweg"><div class="lw-titel">So geht's</div>${(a.loesungsweg || []).map(z => `<div class="lw-zeile">${mathe(z)}</div>`).join('')}<p class="lw-erkl">${mathe(a.erklaerung || '')}</p></div>`;
  const offen = A.ergebnis === 'loesung';
  if (b) strafe = strafe.replace(/Spielzeit/g, 'Bildschirmzeit');
  // Fehler-Detektiv: Rechnung stimmt → kurzer Satz dazu
  if (a.typ === 'detektiv' && a.stimmt && a.bestaetigung && !offen) kopf += `<p class="detektiv-ok">${mathe(a.bestaetigung)}</p>`;
  return `<section class="ergebnis-karte${b ? ' bz-ergebnis' : ''}">${kopf}${zeit}${strafe}
    ${offen ? weg : `<details class="weg-details"><summary>Lösungsweg ansehen</summary>${weg}</details>`}
  </section>`;
}

// ---------- „Hilf mir“ ----------
// Zeigt den nächsten Schritt aus dem Lösungsweg, das Ergebnis bleibt verdeckt („?“).
// Bringt dann einen Teil der Spielzeit (wie der freiwillige Taschenrechner, in der Eltern-App einstellbar).

const hilfeAnteil = () => R().hilfe ?? 0.5;
const normal = (x) => String(x || '').replace(/\s+/g, '').replace(/[=≈→?]+$/, '');

function hilfeDaten(t) {
  const a = A.aufgabe;
  if (!t || t.merk || t.art === 'wahl' || t.art === 'legen' || t.art === 'zuordnung') return null;
  if (umformWeg(a)) return { zeilen: [], tipp: true, mehr: false };
  const haupt = A.teile.filter(x => !x.merk);
  const nr = haupt.indexOf(t);
  const anz = L.hilfeAnzeige(a.loesungsweg || [], haupt.length, nr, Math.max(1, (t.hilfe || 0) + 1));
  if (!anz.zeilen.length) return null;
  // Zeigt die Hilfe nur die Rechnung, die schon dasteht? Dann hilft sie nicht.
  const rechnung = t.rechnung || (haupt.length === 1 ? a.rechnung : null);
  if (anz.zeilen.length === 1 && rechnung && normal(anz.zeilen[0]) === normal(rechnung)) return null;
  return anz;
}

// Lösungsweg mit Umform-Zeilen („Gleichung   | Umformung“): „Hilf mir“ zeigt die Zeilen nicht, sondern nur einen Tipp
const umformWeg = (a) => (a.loesungsweg || []).some(z => String(z).includes('|'));
const UMFORM_TIPP = 'Schreib eine Gleichung mit x auf. Dann mach rückgängig, was mit x passiert. Geh dabei in umgekehrter Reihenfolge vor.';
function hilfeKnopf() {
  if (!A || A.fertig || A.phase !== 'eingabe') return '';
  const t = aktuellerTeil();
  if (!t) return '';
  if (t.art === 'umformen') return ufHilfeKnopf();
  if (t.hilfe && umformWeg(A.aufgabe)) return '';
  if (t.hilfe) {
    // weiterer Schritt nur, wenn es noch einen gibt
    const haupt = A.teile.filter(x => !x.merk);
    if (!L.hilfeAnzeige(A.aufgabe.loesungsweg || [], haupt.length, haupt.indexOf(t), t.hilfe).mehr) return '';
  } else if (!hilfeDaten(t)) return '';
  const rest = hilfeRest(t);
  if (rest > 0) return `<button class="btn btn-klein btn-hilfe gesperrt" data-act="hilfeGesperrt" aria-disabled="true">${hilfeGesperrtInhalt(rest)}</button>`;
  const kosten = A.hilfeGenutzt || hilfeAnteil() >= 1 || !zeitZeigen() ? '' : hilfeAnteil() > 0 ? ' · ½ Zeit' : ' · keine Zeit';
  return `<button class="btn btn-klein btn-hilfe" data-act="hilfe">${t.hilfe ? 'Noch ein Schritt' : 'Hilf mir'}${kosten}</button>`;
}

// „Hilf mir“ mit Timer (Auftrag 18): am Anfang jedes Schritts gesperrt, nach einem falschen Versuch sofort frei
function hilfeRest(t) {
  const ab = R().hilfeAb || 0;
  if (!ab || !t || !t.hilfeStart || t.hilfe || t.versuche.some(v => !v.richtig)) return 0;
  return Math.max(0, Math.ceil((ab * 1000 - (Date.now() - t.hilfeStart)) / 1000));
}
const hilfeGesperrtInhalt = (rest) => `<span class="hm-ring" style="--p:${(rest / (R().hilfeAb || 1)).toFixed(2)}" aria-hidden="true"></span>Hilf mir in ${rest} s`;
let hilfeTimer = null;
function hilfeTicken() {
  if (hilfeTimer) { clearInterval(hilfeTimer); hilfeTimer = null; }
  if (!document.querySelector('.btn-hilfe.gesperrt')) return;
  hilfeTimer = setInterval(() => {
    const b = document.querySelector('.btn-hilfe.gesperrt');
    const rest = A && ansicht === 'aufgabe' ? hilfeRest(aktuellerTeil()) : 0;
    if (!b || rest <= 0) {
      clearInterval(hilfeTimer); hilfeTimer = null;
      if (b) { const neu = hilfeKnopf(); if (neu) b.outerHTML = neu; else b.remove(); }
      return;
    }
    b.innerHTML = hilfeGesperrtInhalt(rest);
  }, 1000);
}
function hilfeGesperrtGetippt() {
  const t = aktuellerTeil();
  if (!t) return;
  protokoll(S, 'hilf_mir_gesperrt', { id: A.aufgabe.id, teil: A.idx, rest: hilfeRest(t) });
  sichern();
  aufblinken();
}

function hilfeBox(t) {
  if (umformWeg(A.aufgabe)) return `<div class="hilfe-box"><div class="hilfe-titel">So fängst du an</div><p class="hilfe-text">${UMFORM_TIPP}</p></div>`;
  const haupt = A.teile.filter(x => !x.merk);
  const anz = L.hilfeAnzeige(A.aufgabe.loesungsweg || [], haupt.length, haupt.indexOf(t), t.hilfe);
  if (!anz.zeilen.length) return '';
  return `<div class="hilfe-box"><div class="hilfe-titel">So fängst du an</div>${anz.zeilen.map(z => `<div class="hilfe-zeile">${mathe(z)}</div>`).join('')}<p class="hilfe-text">Rechne das <b>?</b> aus.</p></div>`;
}

function hilfeZeigen() {
  const t = aktuellerTeil();
  if (!t || A.phase !== 'eingabe' || !hilfeKnopf() || hilfeRest(t) > 0) return;
  t.hilfe = (t.hilfe || 0) + 1;
  A.hilfeGenutzt = true;
  const haupt = A.teile.filter(x => !x.merk);
  const anz = L.hilfeAnzeige(A.aufgabe.loesungsweg || [], haupt.length, haupt.indexOf(t), t.hilfe);
  protokoll(S, 'hilfe', { id: A.aufgabe.id, teil: A.idx, stufe: t.hilfe, zeilen: anz.zeilen });
  sichern();
  zeigeAufgabe();
  const b = document.querySelector('.hilfe-box');
  if (b) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---------- Eingabe ----------

function tastatur(k) {
  const t = aktuellerTeil();
  if (!t || A.phase !== 'eingabe') return;
  A.meldung = null;
  if (t.art === 'bruch') {
    const f = A.feld;
    if (k === '⌫') t[f] = t[f].slice(0, -1);
    else if (/\d/.test(k) && t[f].length < 3) t[f] += k;
    zeigeAufgabe();
    return;
  }
  // Zahl · 10ⁿ: Hochzahl-Feld (ganze Zahl, auch negativ)
  if ((t.art === 'zp' || t.zp) && A.feld === 'e') {
    let h = t.e;
    if (k === '⌫') h = h.slice(0, -1);
    else if (k === '−') h = h.startsWith('-') ? h.slice(1) : '-' + h;
    else if (/\d/.test(k) && h.replace('-', '').length < 3) h += k;
    t.e = h;
    zeigeAufgabe();
    return;
  }
  let e = t.eingabe;
  if (k === '⌫') e = e.slice(0, -1);
  else if (k === '−') e = e.startsWith('-') ? e.slice(1) : '-' + e;
  else if (k === ',') { if (!e.includes(',')) e = (e === '' || e === '-' ? e + '0' : e) + ','; }
  else if (e.replace(/[-,]/g, '').length < 15) e += k;
  t.eingabe = e;
  zeigeAufgabe();
}

function antwortGeben() {
  const t = aktuellerTeil();
  if (!t || A.phase !== 'eingabe') return;
  const a = A.aufgabe;
  if (t.art === 'zuordnung') return zuordnungAntwort();
  let eingabe, richtig, fehler = null;
  if (t.art === 'zp' || (t.art === 'zahl' && t.zp)) {
    if (!L.parseZahl(t.eingabe).ok || !/^-?\d+$/.test(t.e)) { A.meldung = t.e ? 'Tippe zuerst die Zahl ein.' : 'Tippe noch die Hochzahl ein.'; A.feld = t.eingabe ? 'e' : 'z'; return zeigeAufgabe(); }
    eingabe = `${t.eingabe.replace(',', '.')}e${Number(t.e)}`;
    if (t.art === 'zp') {
      const r = PH.pruefeZehnerpotenz(t.eingabe, t.e, t.antwort);
      richtig = r.richtig; fehler = r.fehler;
    } else {
      richtig = L.pruefeWert(PH.wertAusPotenz(t.eingabe, t.e), t.ziel);
    }
  } else if (t.art === 'formel') {
    const text = t.fmodus === 'karten' ? formelEingabe(t) : `${t.antwort.ziel} = ${formelEingabe(t)}`;
    if (!formelEingabe(t).trim()) { A.meldung = t.fmodus === 'karten' ? 'Lege zuerst die Kärtchen.' : 'Tippe zuerst die Formel ein.'; return zeigeAufgabe(); }
    const r = PH.pruefeFormel(text, t.antwort);
    if (!r.gueltig) { A.meldung = 'Die Formel ist noch nicht fertig. Schau auf Klammern und Rechenzeichen.'; return zeigeAufgabe(); }
    eingabe = text; richtig = r.richtig; fehler = r.fehler;
  } else if (t.art === 'zahl') {
    const p = L.parseZahl(t.eingabe);
    if (!p.ok) { A.meldung = 'Tippe zuerst eine Zahl ein.'; return zeigeAufgabe(); }
    eingabe = t.eingabe.replace(',', '.');
    richtig = L.pruefeZahl(t.eingabe, t.ziel);
    if (!richtig && t.ziel.gueltige > 1 && PH.pruefeGueltig(p.wert, t.ziel.wert, t.ziel.gueltige - 1)) {
      fehler = { typ: 'gueltige', text: `Fast. Gib das Ergebnis mit ${t.ziel.gueltige} gültigen Ziffern an.` };
    }
    if (!richtig && L.fremdeZahl(a, p.wert)) return fremdeZahlMelden(t, eingabe);
    if (!richtig && !fehler) {
      if (t.merk) fehler = L.erkenneMerkFehler(a, t.label, t.eingabe) || { typ: 'merk', text: 'Lies noch einmal im Text nach. Welche Zahl gehört dazu?' };
      else if (a.bild && a.bild.linien && /Hälfte|Viertel/.test(t.label || '')) fehler = { typ: 'gefaerbt-zaehler', text: `Zähl die gefärbten ${gefaerbtWort(a)} im Bild.` };
      else if (t.knobel) fehler = { typ: 'knobel', text: 'Probier es noch einmal. Oder tippe auf „In Schritten rechnen“.' };
      else {
        const pseudo = t.rechnung ? { ...a, rechnung: t.rechnung } : a;
        fehler = L.erkenneFehler(pseudo, t.quelle || (t.rechnung ? { wert: t.ziel.wert } : null), t.eingabe);
      }
    }
  } else if (t.art === 'bruch') {
    if (!t.z || !t.n) { A.meldung = 'Tippe Zähler und Nenner ein.'; return zeigeAufgabe(); }
    eingabe = `${t.z}/${t.n}`;
    richtig = L.pruefeBruch(t.z, t.n, t.antwort);
    if (!richtig && t.z === String(t.antwort.nenner) && t.n === String(t.antwort.zaehler)) {
      fehler = { typ: 'bruch-vertauscht', text: 'Oben stehen die gefärbten Teile, unten alle Teile.' };
    }
    if (!richtig && t.nennerFest) fehler = { typ: 'gefaerbt-zaehler', text: `Zähl die gefärbten ${gefaerbtWort(a)} im Bild.` };
  }
  if (!richtig && !fehler && t.knobel) fehler = { typ: 'knobel', text: 'Probier es noch einmal. Oder tippe auf „In Schritten rechnen“.' };
  // Zu schnell (Textaufgabe im 1. Versuch oder nach einem Fehler): zählt nicht als Versuch
  const schnell = !richtig && L.zuSchnell(a, t, Date.now() - t.seit);
  if (schnell) return zuSchnellMelden(t, eingabe, schnell);
  // Fehler-Detektiv: Fehlertypen getrennt auswertbar
  if (fehler && a.typ === 'detektiv') fehler = { ...fehler, typ: 'detektiv_' + fehler.typ };
  if (!richtig && t.versuche.some(v => v.eingabe === eingabe)) {
    A.meldung = 'Das hattest du schon. Rechne noch einmal nach.';
    protokoll(S, 'versuch_wiederholt', { id: a.id, teil: A.idx, eingabe });
    sichern();
    return zeigeAufgabe();
  }
  versuchMerken(t, eingabe, richtig, fehler);
}

// Tippen auf ein späteres Feld: aktuelles Feld abgeben, wenn etwas drinsteht. Sonst das aktuelle Feld aufblinken lassen.
function springeZu(ziel) {
  if (!A || A.fertig || !(ziel > A.idx)) return;
  const t = aktuellerTeil();
  const hatDaten = t && A.phase === 'eingabe' && (t.art === 'zahl' ? !!t.eingabe : t.art === 'bruch' ? !!(t.z && t.n) : false);
  protokoll(S, 'sprung', { id: A.aufgabe.id, von: A.idx, nach: ziel, abgegeben: hatDaten });
  if (hatDaten) return antwortGeben();
  aufblinken();
}

function aufblinken() {
  let el;
  if (A.phase === 'eingabe') {
    const t = aktuellerTeil();
    el = t && t.art === 'bruch'
      ? [...document.querySelectorAll('.teil.aktiv .bruch-feld')].find(b => b.textContent.trim() === '?')
      : document.querySelector('.teil.aktiv .aktiv-feld');
    el = el || document.querySelector('.teil.aktiv');
  } else {
    el = document.querySelector('[data-act="verstanden"], [data-act="weiter"]');
  }
  if (!el) return;
  el.classList.remove('aufblinken');
  void el.offsetWidth; // Animation neu starten
  el.classList.add('aufblinken');
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  setTimeout(() => el.classList.remove('aufblinken'), 1300);
}

function versuchMerken(t, eingabe, richtig, fehler) {
  const a = A.aufgabe;
  const ms = Date.now() - t.seit;
  t.versuche.push({ eingabe, richtig });
  protokoll(S, 'versuch', {
    id: a.id, thema: a.thema, teil: A.idx, label: t.label || null, merk: !!t.merk, versuch: t.versuche.length, eingabe, richtig,
    fehler: fehler ? fehler.typ : null, ms, schnell: !!a.geschichte && ms < 4000,
    hinweiseOffen: A.hinweise.slice(), ...(a.typ === 'detektiv' ? { detektiv_schritt: A.idx + 1 } : {})
  });
  t.seit = Date.now();
  A.schnellFolge = 0;
  if (richtig) {
    t.status = t.versuche.length === 1 ? 'erst' : 'zweit';
    return naechsterTeil();
  }
  // Knobeln: nach dem zweiten Fehlversuch geht es in Schritten weiter (keine Lösung, kein Abbruch)
  if (t.knobel && t.versuche.length >= 2) return schritteAn(true);
  const maxVersuche = t.art === 'wahl' && !t.detektiv ? 1 : 2; // Detektiv Schritt 1: 2 Versuche (Auftrag 18)
  if (t.versuche.length < maxVersuche) {
    t.tipp = fehler ? fehler.text : 'Schau dir den Hinweis an und rechne noch einmal.';
    t.tafel = fehler && fehler.tafel ? fehler.tafel : null; // Stellentafel bei Mal 10 (Auftrag 36)
    // Ohne „Verstanden“ (Schalter pro Kind): der Tipp bleibt stehen, bis weitergetippt wird
    A.phase = bed('verstanden') ? 'tipp' : 'eingabe';
    A.meldung = t.tipp;
    t.eingabe = ''; t.z = ''; t.n = t.nennerFest ? String(t.antwort.nenner) : ''; t.e = ''; t.tokens = []; t.gelegt = [];
  } else {
    t.status = 'loesung';
    t.loesungTipp = fehler ? fehler.loesung || fehler.text : null;
    t.tafel = fehler && fehler.tafel ? fehler.tafel : t.tafel || null;
    A.phase = 'aufgeloest';
    protokoll(S, 'loesung_gezeigt', { id: a.id, teil: A.idx, loesung_schritt: A.idx, loesung_label: t.label || null });
  }
  sichern();
  zeigeAufgabe();
}

function naechsterTeil() {
  A.phase = 'eingabe';
  A.meldung = null;
  A.feld = 'z';
  A.idx++;
  if (A.idx >= A.teile.length) return abschliessen();
  A.teile[A.idx].seit = Date.now();
  A.teile[A.idx].hilfeStart = Date.now();
  sichern();
  zeigeAufgabe();
}

function abschliessen() {
  const a = A.aufgabe;
  const pflicht = A.teile.filter(t => !t.bonus && !t.merk);
  let ergebnis = 'erst';
  if (pflicht.some(t => t.status === 'loesung')) ergebnis = 'loesung';
  else if (pflicht.some(t => t.status === 'zweit')) ergebnis = 'zweit';
  // Knobeln: Fehlversuch im Ergebnisfeld, danach in Schritten gelöst → wie 2. Versuch
  if (ergebnis === 'erst' && A.knobelFalsch) ergebnis = 'zweit';
  // Teil-Lösung (Auftrag 37): Lösung bei einem Zwischenschritt, der Rest selbst richtig
  const tl = ergebnis === 'loesung' && bed('teil_loesung') && ['schritte', 'detektiv'].includes(a.typ) && !A.uf && a.modus !== 'knobeln' ? L.teilLoesung(pflicht) : null;
  if (tl) ergebnis = 'teil';
  const lsgTeile = A.teile.map((t, i) => [t, i]).filter(([t]) => t.status === 'loesung');
  // Kopf-Bonus: Rechner wäre erlaubt, wurde aber nicht geöffnet, App nicht verlassen
  A.kopf = R().kopf > 1 && L.kopfBonus({ aufgabe: a, rechnerGenutzt: !!A.rechner || !!A.rechnerHalb, verlassen: (A.weg || 0) + (A.verlassen || 0), ergebnis });
  // Lohn nach Mühe (Auftrag 18): Faktor je Aufgabenart; überlegter 2. Versuch (ohne zu schnelle Eingaben) gibt die volle Zeit;
  // Wiederholung nach dem Durchklick-Hinweis im 1. Versuch ohne zu schnelle Eingaben: Bonuszeit
  const schnell = pflicht.some(t => t.schnell);
  A.muehe = L.muehFaktor(a, R(), { umformen: !!A.uf });
  A.muehGruppe = L.muehGruppe(a, { umformen: !!A.uf });
  A.bonusZeit = !!A.bonusWdh && ergebnis === 'erst' && !schnell && R().bonus > 1 ? R().bonus : 0;
  const lohnErg = tl ? (tl.zweit ? 'zweit' : 'erst') : ergebnis;
  let sek = L.sekundenFuerAufgabe({ ergebnis: lohnErg, serienPos: A.serienPos, strafe: A.strafe, rechnerHalb: !!A.rechnerHalb, hilfe: !!A.hilfeGenutzt, langHalb: !!A.langHalb, kopf: A.kopf, regeln: R(),
    muehe: A.muehe, zweitVoll: lohnErg === 'zweit' && !schnell, bonus: A.bonusZeit || 1 });
  // Teil-Lösung: Lohn anteilig nach den selbst geschafften Schritten
  if (tl) { sek = Math.round(sek * tl.anteil); A.anteil = tl.anteil; }
  S.laufend = null;
  let stufeHoch = null;
  A.ergebnis = ergebnis; A.fertig = true; A.idx = A.teile.length - 1; A.phase = 'eingabe';
  tagAktualisieren(S);
  // Bildschirmzeit: gleiche Regeln, mal Faktor, eigenes Konto (höchstens bis zur Tagesgrenze)
  A.bild = null; A.sz = null; A.wechsel = false; A.extra = null;
  let spielSek = sek;
  if (istBild()) {
    const k = bzKonto();
    const g = BS.gutschreiben(k, sek, BZ());
    A.bild = { plus: g.plus, voll: g.voll, stand: k.stand, rest: BS.restSek(k, BZ()) };
    if (g.extra != null && g.plus > 0) A.extra = g.extra;
    // Bildschirmzeit voll: Rest dieser Aufgabe und alle weiteren Aufgaben gehen zur Spielzeit im Schrein
    spielSek = g.voll ? Math.max(0, sek - Math.round(g.verbraucht / BZ().faktor)) : 0;
    if (g.voll) { zweck = 'spiel'; A.wechsel = true; protokoll(S, 'zweck', { zweck, grund: 'voll' }); }
  }
  A.sekunden = 0;
  if (!A.bild || A.wechsel) {
    // Spielzeit im Schrein: höchstens bis zur Tagesgrenze (nur verdiente Zeit zählt)
    // „Nur heute mehr“: über der normalen Grenze zählt der Lohn mal Extra-Faktor (Auftrag 18)
    const gs = BS.szGutschrift(S.szRegeln, S.tag.key, S.tag.verdient, spielSek);
    const plus = Math.min(gs.plus, BS.szRestSek(S.szRegeln, S.tag.key, S.tag.verdient));
    if (gs.extra != null && plus > 0 && !A.bild) A.extra = gs.extra;
    A.sekunden = plus;
    S.guthaben += plus;
    S.tag.verdient += plus;
    A.sz = { voll: BS.szRestSek(S.szRegeln, S.tag.key, S.tag.verdient) <= 0, gekappt: plus < spielSek };
  }
  S.tag.aufgaben++;
  if (ergebnis === 'erst' && !A.gleich) S.tag.ersterVersuch++;
  if (ergebnis === 'teil') S.tag.teil = (S.tag.teil || 0) + 1;
  const lsg = ergebnis === 'loesung' || ergebnis === 'teil';
  const lsgSchritt = lsgTeile.length && lsgTeile[0][0].label ? { nachLoesungSchritt: lsgTeile[0][0].label } : {};
  if (!a.generator) {
    const st = S.statistik[a.id] || (S.statistik[a.id] = { gesehen: 0 });
    st.gesehen++; st.zuletzt = S.verlauf.zaehler; st.letztesErgebnis = ergebnis; st.letzterTag = S.tag.key; delete st.ersetzt;
    if (lsg && !A.test && !A.durchklick && (A.wdh || 0) < 2) {
      S.verlauf.loesung = { ...(S.verlauf.loesung || {}), [a.id]: uebMs() };
      S.wiederholen = [...S.wiederholen, { ab: S.verlauf.zaehler + 3, aufgabe: a, wdh: (A.wdh || 0) + 1, nachLoesung: a.id, feste: true, ...lsgSchritt }].slice(-10);
    }
  } else {
    // Einmaleins-Dreierblöcke (außer auf dem Einstiegsplatz) zählen für die Stufe des Einmaleins
    const g = a.generator === 'block-einmaleins' && a.stufeZaehlt ? 'einmaleins' : a.generator;
    if (!a.bonus && !A.test && !a.etappeMindest && !g.startsWith('block') && G.GENERATOREN[g]) {
      const st = S.genStufen[g] || (S.genStufen[g] = { stufe: 1, folge: 0 });
      if (ergebnis === 'erst' && A.hilfeGenutzt) st.folge = 0; // mit „Hilf mir“: Stufe bleibt
      else if (ergebnis === 'erst') { st.folge++; if (st.folge >= 3 && st.stufe < stufeGrenze(g)) { st.stufe++; st.folge = 0; stufeHoch = { generator: g, stufe: st.stufe }; protokoll(S, 'stufe', { generator: g, stufe: st.stufe }); } }
      else if (ergebnis === 'zweit' || ergebnis === 'teil') st.folge = 0;
      else { if (st.stufe > 1) { st.stufe--; protokoll(S, 'stufe', { generator: g, stufe: st.stufe }); } st.folge = 0; }
    }
    if (lsg && !A.test && !A.durchklick && (A.wdh || 0) < 2) S.wiederholen = [...S.wiederholen, { ab: S.verlauf.zaehler + 3, aufgabe: a, wdh: (A.wdh || 0) + 1, nachLoesung: a.id, ...lsgSchritt }].slice(-10);
  }
  // Nach dem Hinweis gegen Durchklicken kommt diese oder eine ähnliche Aufgabe wieder, mit Bonuszeit
  if (A.durchklick && !A.test) S.wiederholen = [...S.wiederholen, { ab: S.verlauf.zaehler + 3, aufgabe: a, wdh: (A.wdh || 0) + 1, bonus: true }].slice(-10);
  if (!A.test) { paketZeitBuchen(A.paket, Date.now() - A.start); wpBuchen(a, Date.now() - A.start); S.verlauf.uebMs = uebMs() + Math.min(Date.now() - A.start, 10 * 60 * 1000); }
  if (A.gleich && !lsg && S.verlauf.loesung) { const m = { ...S.verlauf.loesung }; delete m[a.id]; S.verlauf.loesung = m; }
  S.verlauf.zaehler++;
  if (a.form && !A.test) { const fz = S.verlauf.formZaehler || (S.verlauf.formZaehler = {}); fz[a.form] = (fz[a.form] || 0) + 1; }
  S.verlauf.themaZuletzt[a.thema] = { ergebnis, stufe: a.stufe };
  // Wissenspunkte (nur Gestaltung Sternzeit)
  A.wp = sternzeit() && !A.test ? L.wissenspunkteFuer(a, { ergebnis, schritte: !!A.schritteAn && !A.ufSofort }) : 0;
  S.serie.letzteAktivitaet = Date.now();
  protokoll(S, 'aufgabe_ende', {
    id: a.id, thema: a.thema, stufe: a.stufe, ergebnis, sekunden: A.sekunden, serienPos: A.serienPos,
    ...(A.bild ? { bildschirm: A.bild.plus, voll: A.bild.voll || undefined } : {}),
    ...(A.kopf ? { kopf: true } : {}), ...(A.sz && A.sz.voll ? { spielzeitVoll: true } : {}),
    ...(A.paket ? { paket: A.paket } : {}), ...(A.etappe != null ? { etappe: A.etappe } : {}),
    strafe: A.strafe, rechnerOptional: !!A.rechnerHalb, hilfe: !!A.hilfeGenutzt, verlassen: A.verlassen, ms: Date.now() - A.start, hinweise: A.hinweise.slice(), hinweiseLang: (A.hinweiseLang || []).slice(), langHalb: !!A.langHalb,
    bonusTeile: A.teile.filter(t => t.bonus).map(t => t.status), merkTeile: A.teile.filter(t => t.merk).map(t => t.status),
    generator: a.generator || null, ...(A.gleich ? { gleiche_aufgabe: true } : {}),
    ...(lsgTeile.length ? { loesung_schritt: lsgTeile.length === 1 ? lsgTeile[0][1] : lsgTeile.map(x => x[1]), loesung_label: lsgTeile.length === 1 ? lsgTeile[0][0].label || null : lsgTeile.map(x => x[0].label || null) } : {}),
    ...(tl ? { anteil: tl.anteil } : {}),
    muehe: A.muehe, muehGruppe: A.muehGruppe, bonus_wiederholung: !!A.bonusZeit, ...(A.extra != null ? { extra: A.extra } : {}),
    ...(schnell ? { zuSchnell: pflicht.reduce((n, t) => n + (t.schnell || 0), 0) } : {}), ...(A.durchklick ? { durchklick: true } : {}),
    ...(a.modus === 'knobeln' ? { knobeln: true, schritte: !!A.schritteAn } : {}), ...(a.fach ? { fach: a.fach } : {}), ...(A.wp ? { wp: A.wp } : {})
  });
  if (A.wp > 0) {
    const grund = a.modus === 'knobeln' ? (A.schritteAn ? 'schritte' : 'knobeln') : 'aufgabe';
    S.wissen = SZ.wissenPlus(SZ.wissenVon(S.wissen), A.wp, grund, a.id);
    protokoll(S, 'wissenspunkte', { id: a.id, n: A.wp, stand: S.wissen.stand, grund });
  }
  A.neueEtappe = [etappeAutomatisch(), ...paketStarts()].filter(Boolean);
  // Runensplitter für diese Aufgabe
  S.splitter = SP.splitterVon(S.splitter);
  A.splitter = SP.nachAufgabe(S.splitter, {
    ergebnis, wiederholung: (A.wdh || 0) > 0, wartete: !!A.wartete, tagAufgaben: S.tag.aufgaben, heute: S.tag.key,
    stufeHoch: !!stufeHoch, stufeNeu: stufeHoch ? stufeHoch.stufe : 0, generator: stufeHoch ? stufeHoch.generator : null,
    text: !!a.geschichte, kopf: !!A.kopf
  });
  if (A.splitter.length) protokoll(S, 'splitter', { id: a.id, n: A.splitter.reduce((x, e) => x + e.n, 0), gruende: A.splitter.map(e => e.grund), stand: S.splitter.stand });
  sichern();
  zeigeAufgabe();
  const k = document.querySelector('.ergebnis-karte');
  if (k) k.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---------- Zuordnung ----------

function zuordnungVorbereiten() {
  const g = A.aufgabe.gruppen;
  const idx = g.map((_, i) => i);
  A.zuo = {
    spalten: A.aufgabe.spalten.filter(s => s !== 'worte'),
    reihenfolge: {},
    wahl: g.map(() => ({})),
    falsch: new Set(),
    versuch: 0
  };
  for (const s of A.zuo.spalten) A.zuo.reihenfolge[s] = L.mischen(idx);
}

function zuoInhalt(spalte, gi, klein = true) {
  const g = A.aufgabe.gruppen[gi];
  if (spalte === 'bild') return `<div class="zuo-bild">${bildSvg(g.bild, klein)}</div>`;
  if (spalte === 'bruch') { const [z, n] = String(g.bruch).split('/'); return bruchHtml(z, n); }
  if (spalte === 'prozent') return `<span class="zuo-prozent">${g.prozent} %</span>`;
  return esc(g[spalte]);
}

const SPALTEN_NAMEN = { bild: 'Bild', bruch: 'Bruch', prozent: 'Prozent' };

function zuordnungHtml(aktiv) {
  const z = A.zuo;
  const kopf = `<div class="zuo-reihe zuo-kopf"><div>Worte</div>${z.spalten.map(s => `<div>${SPALTEN_NAMEN[s]}</div>`).join('')}</div>`;
  const reihen = A.aufgabe.gruppen.map((g, gi) => {
    const slots = z.spalten.map(s => {
      const w = z.wahl[gi][s];
      const key = `${gi}-${s}`;
      let kl = 'zuo-slot';
      if (w == null) kl += ' leer';
      if (z.falsch.has(key)) kl += ' markiert';
      if (!aktiv && A.fertig && w === gi) kl += ' ok';
      return `<button class="${kl}" data-act="zuoSlot" data-g="${gi}" data-s="${s}" ${aktiv && A.phase === 'eingabe' ? '' : 'disabled'}>${w == null ? '?' : zuoInhalt(s, w)}</button>`;
    }).join('');
    return `<div class="zuo-reihe"><div class="zuo-worte">${esc(g.worte)}</div>${slots}</div>`;
  }).join('');
  return `${kopf}${reihen}${aktiv ? '<p class="gedaempft klein">Tippe auf ein Fragezeichen und wähle aus.</p>' : ''}`;
}

function zuoAuswahl(gi, spalte) {
  const g = A.aufgabe.gruppen[gi];
  const opts = A.zuo.reihenfolge[spalte].map(oi => {
    const benutzt = A.zuo.wahl.some((w, i) => i !== gi && w[spalte] === oi);
    return `<button class="zuo-option${benutzt ? ' benutzt' : ''}" data-act="zuoWahl" data-g="${gi}" data-s="${spalte}" data-o="${oi}">${zuoInhalt(spalte, oi, spalte !== 'bild')}${benutzt ? '<span class="benutzt-label">schon benutzt</span>' : ''}</button>`;
  }).join('');
  oeffneModal(`<h2 class="modal-titel">${SPALTEN_NAMEN[spalte]} für „${esc(g.worte)}“</h2><div class="zuo-optionen ${spalte}">${opts}</div>`);
}

function zuoWaehlen(gi, spalte, oi) {
  A.zuo.wahl.forEach((w, i) => { if (i !== gi && w[spalte] === oi) delete w[spalte]; });
  A.zuo.wahl[gi][spalte] = oi;
  A.zuo.falsch.delete(`${gi}-${spalte}`);
  schliesseModal();
  zeigeAufgabe();
}

function zuordnungAntwort() {
  const z = A.zuo, t = aktuellerTeil();
  const leer = A.aufgabe.gruppen.some((_, gi) => z.spalten.some(s => z.wahl[gi][s] == null));
  if (leer) { A.meldung = 'Fülle zuerst alle Kästchen aus.'; return zeigeAufgabe(); }
  const falsch = [];
  A.aufgabe.gruppen.forEach((_, gi) => z.spalten.forEach(s => { if (z.wahl[gi][s] !== gi) falsch.push(`${gi}-${s}`); }));
  z.versuch++;
  const ms = Date.now() - t.seit;
  t.versuche.push({ eingabe: JSON.stringify(z.wahl), richtig: !falsch.length });
  protokoll(S, 'versuch', { id: A.aufgabe.id, thema: A.aufgabe.thema, teil: 0, versuch: z.versuch, eingabe: z.wahl, falsch: falsch.length, richtig: !falsch.length, ms, hinweiseOffen: A.hinweise.slice() });
  t.seit = Date.now();
  if (!falsch.length) { t.status = z.versuch === 1 ? 'erst' : 'zweit'; return naechsterTeil(); }
  if (z.versuch === 1) {
    z.falsch = new Set(falsch);
    const n = falsch.length;
    t.tipp = `${n} ${n === 1 ? 'Kästchen stimmt' : 'Kästchen stimmen'} noch nicht. Sie sind markiert.`;
    A.phase = bed('verstanden') ? 'tipp' : 'eingabe'; A.meldung = t.tipp;
    sichern();
    return zeigeAufgabe();
  }
  // Lösung zeigen
  z.falsch = new Set(falsch);
  A.aufgabe.gruppen.forEach((_, gi) => z.spalten.forEach(s => { z.wahl[gi][s] = gi; }));
  t.status = 'loesung';
  protokoll(S, 'loesung_gezeigt', { id: A.aufgabe.id, teil: 0 });
  A.phase = 'aufgeloest';
  sichern();
  zeigeAufgabe();
}

// ---------- Hinweise, Taschenrechner ----------

// ---------- Hinweise: zuerst die Kurzversion (Formelübersicht), „Mehr Hilfe“ öffnet den langen Hinweis ----------
const langStufe = () => FU.langStufe(S.einstellungen.langeHinweise);
const aufgabeId = () => (A && ansicht === 'aufgabe' ? A.aufgabe.id : null);

function hinweisOeffnen(id) {
  const h = HMAP[id];
  if (!h) return;
  if (A && ansicht === 'aufgabe' && !A.hinweise.includes(id)) A.hinweise.push(id);
  if (!FORMELN) {
    protokoll(S, 'hinweis', { hinweis: id, id: aufgabeId() });
    sichern();
    return oeffneModal(`<div class="hinweis-blatt">${hinweisBlatt(h)}</div>`);
  }
  // Stufe „Gleich lang“: sofort der lange Hinweis, ohne Kosten
  if (langStufe() === 0) {
    protokoll(S, 'hinweis_lang', { hinweis: id, stufe: 0, kosten: 'keine', id: aufgabeId() });
    sichern();
    return oeffneModal(`<div class="hinweis-blatt">${hinweisBlatt(h)}</div>`);
  }
  const abschnitte = FU.abschnitteFuer(FORMELN, id).map(a => a.id);
  protokoll(S, 'hinweis_kurz', { hinweis: id, abschnitte, id: aufgabeId() });
  sichern();
  kurzZeigen(id);
}

function kurzZeigen(id) {
  const h = HMAP[id];
  const stufe = langStufe();
  const halb = stufe === 2 && !(A && A.langHalb);
  const mehr = stufe < 3 ? `<button class="btn btn-haupt" data-act="mehrHilfe" data-id="${id}">Mehr Hilfe${halb ? ' · ½ Zeit' : ''}</button>` : '';
  oeffneModal(`<div class="kurz-kopf">${hinweisIcon(h, 40)}<div><p class="kurz-titel">${esc(h.titel)}</p><p class="kurz-unter">So steht es in der Formelübersicht</p></div></div>
    ${FU.kurzHtml(FORMELN, id)}
    <div class="kurz-knoepfe">${mehr}<button class="btn" data-act="formelSeite" data-s="${(FU.abschnitteFuer(FORMELN, id)[0] || { seite: 1 }).seite}">Ganze Formelübersicht</button></div>`);
}

function mehrHilfe(id) {
  const h = HMAP[id];
  const stufe = langStufe();
  if (!h || stufe >= 3) return;
  const kostet = stufe === 2 && A && ansicht === 'aufgabe' && !A.fertig;
  if (kostet) A.langHalb = true;
  if (A && ansicht === 'aufgabe') { A.hinweiseLang = A.hinweiseLang || []; if (!A.hinweiseLang.includes(id)) A.hinweiseLang.push(id); }
  protokoll(S, 'hinweis_lang', { hinweis: id, stufe, kosten: kostet ? 'halb' : 'keine', id: aufgabeId() });
  sichern();
  oeffneModal(`<div class="hinweis-blatt">${hinweisBlatt(h)}</div>`);
  if (ansicht === 'aufgabe' && A) zeigeAufgabe();
}

function formelSeite(nr) {
  if (!FORMELN) return;
  const s = nr === 2 ? 2 : 1;
  protokoll(S, 'formeluebersicht', { seite: s, id: aufgabeId() });
  sichern();
  oeffneModal(`${FU.seiteHtml(FORMELN, s)}<div class="fue-blaettern"><button class="btn${s === 2 ? ' btn-haupt' : ''}" data-act="formelSeite" data-s="1" ${s === 1 ? 'disabled' : ''}>‹ Seite 1</button><button class="btn${s === 1 ? ' btn-haupt' : ''}" data-act="formelSeite" data-s="2" ${s === 2 ? 'disabled' : ''}>Seite 2 ›</button></div>`);
  const box = document.querySelector('.modal-box'); if (box) box.scrollTop = 0;
}

function rechnerAngeboten(a) { return L.rechnerAnbieten(a) && S.einstellungen.rechnerAngebot !== false; }

function rechnerOeffnen() {
  if (!A.rechner) A.rechner = { ausdruck: '', ergebnis: null };
  A.rechnerOffen = true;
  protokoll(S, 'rechner_offen', { id: A.aufgabe.id, teil: A.idx });
  zeigeAufgabe();
}

const R_TASTEN = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', ',', 'π', '=', 'x²', 'x³', '⌫'];

function rechnerPanelHtml(t) {
  const r = A.rechner;
  const anzeige = r.ergebnis != null ? L.formatRechnerZahl(r.ergebnis) : '';
  const schritt = t && t.art === 'zahl'
    ? `<div class="r-schritt"><span class="r-schritt-label">${mathe(t.label || A.aufgabe.rechnung || 'Antwort')}</span><span class="r-schritt-feld${t.eingabe ? '' : ' leer'}">${esc((t.eingabe || '?').replace('-', '−'))}</span>${t.einheit ? `<span class="r-schritt-einheit">${esc(t.einheit)}</span>` : ''}</div>`
    : `<div class="r-schritt"><span class="r-schritt-label">${mathe((t && t.label) || '')}</span></div>`;
  return `
  <div class="rechner-panel">
    <div class="r-kopf">${schritt}<button class="r-einklappen" data-act="rEinklappen" aria-label="Taschenrechner einklappen">▼</button></div>
    <div class="rechner-anzeige"><div class="rechner-ausdruck">${esc(r.ausdruck) || '&nbsp;'}</div><div class="rechner-ergebnis">${esc(anzeige) || '&nbsp;'}</div></div>
    <div class="rechner-tasten">${R_TASTEN.map(k => `<button class="r-taste${'÷×−+'.includes(k) && k.length === 1 ? ' r-op' : ''}${k === '=' ? ' r-gleich' : ''}" data-act="rTaste" data-k="${k}">${k}</button>`).join('')}
      <button class="r-taste r-uebernehmen" data-act="rUebernehmen" ${rechnerWert() == null || !t || t.art !== 'zahl' ? 'disabled' : ''}>Eintragen</button>
    </div>
    ${t && t.art === 'zahl' ? '<button class="btn btn-haupt r-antwort" data-act="antwort">Antwort geben</button>' : ''}
  </div>`;
}

function rechnerAnzeigeAktualisieren() {
  const p = document.querySelector('.rechner-panel');
  if (!p) return zeigeAufgabe();
  const r = A.rechner;
  p.querySelector('.rechner-ausdruck').innerHTML = esc(r.ausdruck) || '&nbsp;';
  p.querySelector('.rechner-ergebnis').innerHTML = r.ergebnis != null ? esc(L.formatRechnerZahl(r.ergebnis)) : '&nbsp;';
  const t = aktuellerTeil();
  const u = p.querySelector('.r-uebernehmen');
  if (u) u.disabled = rechnerWert() == null || !t || t.art !== 'zahl';
}

// Ergebnis oder – ohne „=“ – der eingetippte Ausdruck
function rechnerWert() {
  const r = A && A.rechner;
  if (!r) return null;
  return r.ergebnis != null ? r.ergebnis : (r.ausdruck ? L.rechne(r.ausdruck) : null);
}

function rechnerTaste(k) {
  const r = A && A.rechner;
  if (!r) return;
  if (k === 'C') { r.ausdruck = ''; r.ergebnis = null; }
  else if (k === '⌫') { r.ausdruck = r.ausdruck.slice(0, -1); }
  else if (k === '=') {
    r.ergebnis = L.rechne(r.ausdruck);
    protokoll(S, 'rechner', { id: A.aufgabe.id, teil: A.idx, ausdruck: r.ausdruck, ergebnis: r.ergebnis });
    sichern();
  } else {
    if (r.ergebnis != null && /^[0-9,π(]$/.test(k)) r.ausdruck = '';
    else if (r.ergebnis != null && /^[÷×−+]$/.test(k)) r.ausdruck = L.formatRechnerZahl(r.ergebnis);
    r.ergebnis = null;
    r.ausdruck += k === 'x²' ? '²' : k === 'x³' ? '³' : k;
  }
  rechnerAnzeigeAktualisieren();
}

function rechnerUebernehmen() {
  const t = aktuellerTeil();
  const r = A && A.rechner;
  const w = rechnerWert();
  if (r && w != null && t && t.art === 'zahl' && A.phase === 'eingabe') {
    t.eingabe = L.formatRechnerZahl(w).replace('−', '-');
    if (r.ergebnis == null) protokoll(S, 'rechner', { id: A.aufgabe.id, teil: A.idx, ausdruck: r.ausdruck, ergebnis: w, ohneGleich: true });
    r.ausdruck = ''; r.ergebnis = null;
  }
  zeigeAufgabe();
}

// ---------- App verlassen ----------

function sichtbarkeit() {
  if (document.hidden) {
    versteckt = Date.now();
    S.laufend = ansicht === 'aufgabe' && A && !A.fertig && !A.aufgabe.bonus ? aufgabeSchnappschuss() : null;
    sichern();
    standHochladen(); // falls die App jetzt geschlossen wird
    liveMelden('weg');
    return;
  }
  const dauer = versteckt ? Date.now() - versteckt : 0;
  versteckt = null;
  updatePruefen();
  syncen();
  tagAktualisieren(S);
  if (ansicht === 'aufgabe' && A && !A.fertig && dauer >= 3000) A.weg = (A.weg || 0) + 1; // auch bei Rechner-Aufgaben (Kopf-Bonus)
  if (ansicht === 'aufgabe' && A && !A.fertig && !L.rechnerFrei(A.aufgabe) && dauer >= 3000) {
    S.tag.verlassen++;
    A.verlassen++;
    const n = S.tag.verlassen;
    const neu = L.strafeFuerVerlassen(n);
    const rang = { keine: 0, halb: 1, null: 2 };
    if (rang[neu] > rang[A.strafe]) A.strafe = neu;
    protokoll(S, 'verlassen', { id: A.aufgabe.id, ms: dauer, n, strafe: A.strafe });
    sichern();
    if (n >= 2) {
      oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Ohne Taschenrechner</h2>
        <p>Diese Aufgabe rechnest du ohne Taschenrechner.</p>
        <p>Wenn du die App während einer Aufgabe verlässt, gibt es weniger Spielzeit${n >= 3 ? ' – heute für diese Aufgabe gar keine' : ''}.</p>
        <button class="btn btn-haupt" data-act="modalZu">Verstanden</button></div>`);
    }
  }
  if (ansicht === 'start') zeigeStart();
}

// ============ 2048 ============

let KACHELN = [];
const KZ = { n: 1 };
const EL = new Map();
let kette = 0;
let syncTimer = null;
const ruhig = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const dauer = () => (ruhig() ? 0 : 100);
const $id = id => document.getElementById(id);

function zeigeSpiel() {
  setzeAnsicht('spiel');
  S.letztesSpiel = '2048'; // „Zum Spiel“ führt zurück ins zuletzt gespielte Spiel
  // Spielen beendet die Serie
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (!S.spiel.feld) neuesSpielFeld();
  if (spielSitzung && spielSitzung.art !== '2048') spielBeenden();
  if (!spielSitzung) {
    spielSitzung = { start: Date.now(), sekunden: 0, art: '2048' };
    protokoll(S, 'spiel_start', { guthaben: S.guthaben, spiel: '2048' });
  }
  sichern();
  const zellen = Array.from({ length: 16 }, () => '<div class="zelle"></div>').join('');
  $app.innerHTML = `
  <div class="screen spiel-screen">
    <header class="topbar spiel-kopf">
      <button class="btn-text" data-act="spielZurueck">← Zurück</button>
      <div class="rune-uhr${S.guthaben < 60 ? ' knapp' : ''}" id="uhr"><span class="uhr-ring"></span><span id="spielzeit">${L.formatZeit(S.guthaben)}</span></div>
      <div class="punkte-box"><span>Punkte</span><b id="punkte">${S.spiel.punkte}</b><i id="punkte-plus"></i></div>
    </header>
    <div class="spiel-zeile">
      <span>Rekord <b id="rekord">${S.spiel.rekord}</b></span>
      <span>Höchster Stein <b id="maxk">${S.spiel.maxKachel || 0}</b></span>
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="neuesSpiel">Neu</button><button class="btn-text klein" data-act="spielauswahl">Spiele</button><button class="anl-knopf" data-act="anleitung" aria-label="So geht's">?</button></span>
    </div>
    <div class="brett-rahmen" id="rahmen">
      <span class="orn o1"></span><span class="orn o2"></span><span class="orn o3"></span><span class="orn o4"></span>
      <div class="brett" id="brett">${zellen}<div class="kachel-ebene" id="kacheln"></div><div class="effekt-ebene" id="effekte"></div></div>
      <div id="spiel-overlay"></div>
    </div>
    <button class="btn spiel-btn" data-act="aufgaben">Mehr Spielzeit: Aufgaben machen</button>
    <p class="spiel-tipp">Wische, um die Steine zu schieben. Verschmelze mehrere auf einmal für eine Kombo.</p>
  </div>`;
  kette = 0;
  brettZeichnen();
  wischen($id('rahmen'));
  overlayPruefen();
  anleitungErstmals('2048');
}

function neuesSpielFeld() {
  const f = L.leeresFeld();
  L.neueKachel(f); L.neueKachel(f);
  S.spiel.feld = f; S.spiel.punkte = 0; S.spiel.maxKachel = L.hoechsteKachel(f); S.spiel.gewonnenGezeigt = false;
}

function steinHtml(k, extra = '') {
  const kl = k.wert > 4096 ? 'kx' : `k${k.wert}`;
  return `<div class="stein ${kl}${k.wert >= 1000 ? ' vierstellig' : ''}${extra}"><span>${k.wert}</span></div>`;
}

function setzePos(d, k) { d.style.setProperty('--r', k.r); d.style.setProperty('--c', k.c); }

function kachelEl(k, extra = '') {
  const d = document.createElement('div');
  d.className = 'kachel';
  setzePos(d, k);
  d.innerHTML = steinHtml(k, extra);
  return d;
}

function brettZeichnen() {
  const ebene = $id('kacheln');
  if (!ebene) return;
  KACHELN = L.kachelnAusFeld(S.spiel.feld, KZ);
  ebene.innerHTML = '';
  EL.clear();
  for (const k of KACHELN) { const d = kachelEl(k); ebene.appendChild(d); EL.set(k.id, d); }
  glutSetzen();
  anzeigenAktualisieren();
}

function anzeigenAktualisieren() {
  const p = $id('punkte'); if (p) p.textContent = S.spiel.punkte;
  const re = $id('rekord'); if (re) re.textContent = S.spiel.rekord;
  const m = $id('maxk'); if (m) m.textContent = S.spiel.maxKachel || 0;
}

function abgleichen() {
  const ebene = $id('kacheln');
  if (!ebene) return;
  const ids = new Set(KACHELN.map(k => k.id));
  for (const [id, d] of EL) if (!ids.has(id)) { d.remove(); EL.delete(id); }
  for (const k of KACHELN) {
    const d = EL.get(k.id);
    if (!d) { const nd = kachelEl(k); ebene.appendChild(nd); EL.set(k.id, nd); }
    else setzePos(d, k);
  }
}

function zug(richtung) {
  if (ansicht !== 'spiel' || S.guthaben <= 0 || document.querySelector('#spiel-overlay .overlay')) return;
  const ebene = $id('kacheln');
  const r = L.bewegeKacheln(KACHELN, richtung, KZ);
  if (!r.bewegt) {
    const b = $id('brett');
    if (b && !ruhig()) { b.classList.remove(`stoss-${richtung}`); void b.offsetWidth; b.classList.add(`stoss-${richtung}`); }
    return;
  }
  const t = dauer();
  for (const w of r.wandernd) {
    const d = EL.get(w.id);
    if (d) { setzePos(d, w); d.classList.add('weg'); EL.delete(w.id); setTimeout(() => d.remove(), t); }
  }
  for (const k of r.kacheln) { if (k.neuVerschmolzen) continue; const d = EL.get(k.id); if (d) setzePos(d, k); }
  KACHELN = r.kacheln.map(k => ({ id: k.id, wert: k.wert, r: k.r, c: k.c }));
  const gesetzt = L.neueKachelObjekt(KACHELN, KZ);
  const vorherMax = S.spiel.maxKachel || 0;
  S.spiel.feld = L.feldAusKacheln(KACHELN);
  S.spiel.punkte += r.punkte;
  if (S.spiel.punkte > S.spiel.rekord) S.spiel.rekord = S.spiel.punkte;
  S.spiel.maxKachel = Math.max(vorherMax, L.hoechsteKachel(S.spiel.feld));
  const merges = r.merges;
  setTimeout(() => {
    for (const m of merges) {
      const cur = KACHELN.find(k => k.id === m.id);
      if (!cur || EL.has(m.id) || !ebene.isConnected) continue;
      const d = kachelEl(cur, ' verschmolzen' + (cur.wert >= 128 ? ' gold' : ''));
      ebene.appendChild(d); EL.set(m.id, d);
    }
    if (gesetzt && !EL.has(gesetzt.id) && ebene.isConnected) {
      const cur = KACHELN.find(k => k.id === gesetzt.id);
      if (cur) { const d = kachelEl(cur, ' neu'); ebene.appendChild(d); EL.set(cur.id, d); }
    }
    effekte(merges, r.punkte, vorherMax);
  }, t);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(abgleichen, t + 40);
  anzeigenAktualisieren();
  sichern();
  if (!L.kannBewegen(S.spiel.feld)) {
    protokoll(S, 'spiel_vorbei', { punkte: S.spiel.punkte, maxKachel: S.spiel.maxKachel });
    sichern();
    setTimeout(() => overlay(`<div class="overlay-titel">Keine Züge mehr</div><p>${S.spiel.punkte} Punkte. Ein neues Spiel kostet nichts.</p><button class="btn btn-jade" data-act="neuesSpielJetzt">Neues Spiel</button>`), 500);
  } else if (S.spiel.maxKachel >= 2048 && !S.spiel.gewonnenGezeigt) {
    S.spiel.gewonnenGezeigt = true;
    protokoll(S, 'spiel_2048', { punkte: S.spiel.punkte });
    setTimeout(() => overlay(`<div class="overlay-titel">2048 geschafft!</div><p>Stark! Du kannst weiterspielen.</p><button class="btn btn-jade" data-act="overlayZu">Weiterspielen</button>`), 1300);
  }
}

// ---------- Effekte ----------

function effektZelle(k) {
  const d = document.createElement('div');
  d.className = 'effekt-zelle';
  setzePos(d, k);
  return d;
}

function funken(m) {
  const e = $id('effekte');
  if (!e) return;
  const gold = m.wert >= 128;
  const d = effektZelle(m);
  let html = `<span class="welle${gold ? ' gold' : ''}"></span>`;
  if (!ruhig()) {
    const n = m.wert >= 512 ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const a = Math.round(i * 360 / n + Math.random() * 20 - 10);
      const weit = 34 + Math.round(Math.random() * 22) + (gold ? 12 : 0);
      html += `<span class="funke${gold ? ' gold' : ''}" style="--a:${a}deg;--w:${weit}px"></span>`;
    }
  }
  d.innerHTML = html;
  e.appendChild(d);
  setTimeout(() => d.remove(), 700);
}

function schwebeText(text, klasse, dauerMs = 1100) {
  const r = $id('rahmen');
  if (!r) return;
  const d = document.createElement('div');
  d.className = `schwebe ${klasse}`;
  d.textContent = text;
  r.appendChild(d);
  setTimeout(() => d.remove(), dauerMs);
}

function punktePop(p) {
  const el = $id('punkte-plus');
  if (!el) return;
  el.textContent = `+${p}`;
  el.classList.remove('an'); void el.offsetWidth; el.classList.add('an');
}

function glutSetzen() {
  const r = $id('rahmen');
  if (r) r.style.setProperty('--glut', Math.min(1, kette / 8).toFixed(2));
}

function effekte(merges, punkte, vorherMax) {
  if (!merges.length) { kette = Math.max(0, kette - 2); glutSetzen(); return; }
  kette++;
  merges.slice(0, 4).forEach(funken);
  punktePop(punkte);
  const n = merges.length;
  const rahmen = $id('rahmen');
  if (n >= 2) schwebeText(`Kombo ×${n}`, n >= 3 ? 'kombo gold' : 'kombo');
  if (n >= 3 && rahmen && !ruhig()) { rahmen.classList.remove('beben'); void rahmen.offsetWidth; rahmen.classList.add('beben'); }
  if ([4, 6, 10, 15, 20, 30].includes(kette)) schwebeText(`Kette ×${kette}`, 'kette');
  glutSetzen();
  const max = Math.max(...merges.map(m => m.wert));
  if (max >= 128 && max > vorherMax) {
    protokoll(S, 'spiel_meilenstein', { stein: max, punkte: S.spiel.punkte });
    const m = merges.find(x => x.wert === max);
    const e = $id('effekte');
    if (e && m) { const d = effektZelle(m); d.innerHTML = '<span class="strahlen"></span>'; e.appendChild(d); setTimeout(() => d.remove(), 1400); }
    schwebeText(`Neuer Stein: ${max}`, 'meilenstein', 1600);
    if (rahmen) { rahmen.classList.remove('entfacht'); void rahmen.offsetWidth; rahmen.classList.add('entfacht'); }
  }
}

function overlay(html) {
  const o = $id('spiel-overlay');
  if (o) o.innerHTML = `<div class="overlay">${html}</div>`;
}

function overlayPruefen() {
  if (S.guthaben <= 0) {
    overlay(`<div class="overlay-titel">Spielzeit ist um</div><p>Dein Spiel bleibt gespeichert.</p><button class="btn btn-jade" data-act="aufgaben">Aufgaben machen</button>`);
  } else if (spielSitzung && (['kristallmine', 'steinschieber', 'runenfall'].includes(spielSitzung.art) || MODUL_SPIELE[spielSitzung.art])) {
    // eigene Tafeln im Spiel
  } else if (spielSitzung && spielSitzung.art === 'runenfeld') {
    if (S.bloecke && B.spielVorbei(S.bloecke.feld, S.bloecke.teile)) overlay(`<div class="overlay-titel">Kein Platz mehr</div><p>${S.bloecke.punkte} Punkte. Ein neues Spiel kostet nichts.</p><button class="btn btn-jade" data-act="runenfeldNeuJetzt">Neues Spiel</button>`);
  } else if (!L.kannBewegen(S.spiel.feld)) {
    overlay(`<div class="overlay-titel">Keine Züge mehr</div><p>Ein neues Spiel kostet nichts.</p><button class="btn btn-jade" data-act="neuesSpielJetzt">Neues Spiel</button>`);
  }
}

function spielTick() {
  if (ansicht !== 'spiel' || document.hidden || S.guthaben <= 0) return;
  if (anleitungOffen()) return;
  if (document.querySelector('#spiel-overlay .overlay')) return;
  if (km && km.ruht()) return;
  if (ss && ss.ruht()) return;
  if (rn && rn.ruht()) return;
  if (ms && ms.spiel.ruht()) return;
  S.guthaben = Math.max(0, S.guthaben - 1);
  if (spielSitzung) spielSitzung.sekunden++;
  const el = $id('spielzeit');
  if (el) el.textContent = L.formatZeit(S.guthaben);
  const uhr = $id('uhr');
  if (uhr) uhr.classList.toggle('knapp', S.guthaben < 60);
  if (S.guthaben % 10 === 0) sichern();
  if (S.guthaben <= 0) { if (km) km.anhalten(); if (rn) rn.anhalten(); if (ms) ms.spiel.anhalten(); spielBeenden(); overlayPruefen(); }
}

function spielBeenden() {
  if (!spielSitzung) return;
  if (spielSitzung.art === 'runenfeld') protokoll(S, 'spiel_ende', { spiel: 'runenfeld', sekunden: spielSitzung.sekunden, punkte: S.bloecke ? S.bloecke.punkte : 0, rest: S.guthaben });
  else if (spielSitzung.art === 'kristallmine') {
    const k = (km && km.stand()) || S.kristallmine || {};
    protokoll(S, 'spiel_ende', { spiel: 'kristallmine', sekunden: spielSitzung.sekunden, punkte: k.punkte || 0, hoehle: (k.hoehle || 0) + 1, rest: S.guthaben });
  } else if (MODUL_SPIELE[spielSitzung.art]) {
    const m = MODUL_SPIELE[spielSitzung.art];
    const k = (ms && ms.id === spielSitzung.art && ms.spiel.stand()) || S[m.feld] || {};
    protokoll(S, 'spiel_ende', { spiel: spielSitzung.art, sekunden: spielSitzung.sekunden, ...m.ende(k || {}), rest: S.guthaben });
  } else if (spielSitzung.art === 'runenfall') {
    const k = (rn && rn.stand()) || S.runenfall || {};
    protokoll(S, 'spiel_ende', { spiel: 'runenfall', sekunden: spielSitzung.sekunden, punkte: k.punkte || 0, reihen: k.reihen || 0, rekord: k.rekord || 0, rest: S.guthaben });
  } else if (spielSitzung.art === 'steinschieber') {
    const k = (ss && ss.stand()) || S.steinschieber || {};
    protokoll(S, 'spiel_ende', { spiel: 'steinschieber', sekunden: spielSitzung.sekunden, level: (k.level || 0) + 1, geschafft: (k.geschafft || []).length, rest: S.guthaben });
  } else protokoll(S, 'spiel_ende', { spiel: '2048', sekunden: spielSitzung.sekunden, punkte: S.spiel.punkte, maxKachel: S.spiel.maxKachel, rest: S.guthaben });
  spielSitzung = null;
  sichern();
  standHochladen(true);
}

function wischen(el) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  el.addEventListener('touchmove', e => { if (x0 != null) e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    zug(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch'));
  });
}

function taste(e) {
  if (ansicht === 'spiel' && spielSitzung && spielSitzung.art === '2048') {
    const m = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'hoch', ArrowDown: 'runter' }[e.key];
    if (m) { e.preventDefault(); zug(m); }
  } else if (ansicht === 'aufgabe' && A && !A.fertig && !$modal.classList.contains('offen')) {
    if (/^[0-9]$/.test(e.key)) tastatur(e.key);
    else if (e.key === 'Backspace') tastatur('⌫');
    else if (e.key === '-') tastatur('−');
    else if (e.key === ',' || e.key === '.') tastatur(',');
    else if (e.key === 'Enter') {
      if (A.phase === 'tipp') { A.phase = 'eingabe'; zeigeAufgabe(); }
      else if (A.phase === 'aufgeloest') naechsterTeil();
      else antwortGeben();
    }
  }
}

// ============ Runenfeld (Formen legen, Reihen und Spalten abräumen) ============

let RF = null; // gerade gezogene Form

function zeigeRunenfeld() {
  setzeAnsicht('spiel');
  S.letztesSpiel = 'runenfeld';
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (!S.bloecke || !S.bloecke.feld) S.bloecke = { ...B.neuesSpiel(), rekord: (S.bloecke && S.bloecke.rekord) || 0 };
  if (spielSitzung && spielSitzung.art !== 'runenfeld') spielBeenden();
  if (!spielSitzung) {
    spielSitzung = { start: Date.now(), sekunden: 0, art: 'runenfeld' };
    protokoll(S, 'spiel_start', { guthaben: S.guthaben, spiel: 'runenfeld' });
  }
  sichern();
  const zellen = Array.from({ length: B.N * B.N }, (_, i) => `<div class="rf-zelle" data-i="${i}"></div>`).join('');
  $app.innerHTML = `
  <div class="screen spiel-screen runenfeld">
    <header class="topbar spiel-kopf">
      <button class="btn-text" data-act="spielZurueck">← Zurück</button>
      <div class="rune-uhr${S.guthaben < 60 ? ' knapp' : ''}" id="uhr"><span class="uhr-ring"></span><span id="spielzeit">${L.formatZeit(S.guthaben)}</span></div>
      <div class="punkte-box"><span>Punkte</span><b id="punkte">${S.bloecke.punkte}</b><i id="punkte-plus"></i></div>
    </header>
    <div class="spiel-zeile">
      <span>Rekord <b id="rekord">${S.bloecke.rekord || 0}</b></span>
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="runenfeldNeu">Neu</button><button class="btn-text klein" data-act="spielauswahl">Spiele</button><button class="anl-knopf" data-act="anleitung" aria-label="So geht's">?</button></span>
    </div>
    <div class="brett-rahmen" id="rahmen">
      <span class="orn o1"></span><span class="orn o2"></span><span class="orn o3"></span><span class="orn o4"></span>
      <div class="rf-brett" id="rf-brett">${zellen}</div>
      <div id="spiel-overlay"></div>
    </div>
    <div class="rf-ablage" id="rf-ablage"></div>
    <button class="btn spiel-btn" data-act="aufgaben">Mehr Spielzeit: Aufgaben machen</button>
    <p class="spiel-tipp">Ziehe die Steine aufs Feld. Volle Reihen und Spalten verschwinden.</p>
  </div>`;
  rfFeldZeichnen();
  rfAblageZeichnen();
  rfZiehenEinrichten();
  rfGlut();
  overlayPruefen();
  anleitungErstmals('runenfeld');
}

// ---------- Kristallmine (drittes Spiel, Logik und Anzeige in kristallmine.js / kristallmine-ui.js) ----------

function zeigeKristallmine() {
  setzeAnsicht('spiel');
  S.letztesSpiel = 'kristallmine';
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (spielSitzung && spielSitzung.art !== 'kristallmine') spielBeenden();
  if (!spielSitzung) {
    spielSitzung = { start: Date.now(), sekunden: 0, art: 'kristallmine' };
    protokoll(S, 'spiel_start', { guthaben: S.guthaben, spiel: 'kristallmine' });
  }
  sichern();
  $app.innerHTML = `
  <div class="screen spiel-screen kristallmine-screen">
    <header class="topbar spiel-kopf">
      <button class="btn-text" data-act="spielZurueck">← Zurück</button>
      <div class="rune-uhr${S.guthaben < 60 ? ' knapp' : ''}" id="uhr"><span class="uhr-ring"></span><span id="spielzeit">${L.formatZeit(S.guthaben)}</span></div>
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button><button class="anl-knopf" data-act="anleitung" aria-label="So geht's">?</button></span>
    </header>
    <div class="km-huelle" id="km-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  km = kristallmineStarten($id('km-huelle'), {
    stand: S.kristallmine,
    sichern: (st) => { S.kristallmine = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: spielDarfLaufen
  });
  overlayPruefen();
  anleitungErstmals('kristallmine');
}

// ---------- Steinschieber (erstes freischaltbares Spiel, Logik in steinschieber.js / steinschieber-ui.js) ----------

function zeigeSteinschieber() {
  setzeAnsicht('spiel');
  S.letztesSpiel = 'steinschieber';
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (spielSitzung && spielSitzung.art !== 'steinschieber') spielBeenden();
  if (!spielSitzung) {
    spielSitzung = { start: Date.now(), sekunden: 0, art: 'steinschieber' };
    protokoll(S, 'spiel_start', { guthaben: S.guthaben, spiel: 'steinschieber', test: !SP.istFrei(SP.splitterVon(S.splitter), 'steinschieber') || undefined });
  }
  sichern();
  $app.innerHTML = `
  <div class="screen spiel-screen kristallmine-screen">
    <header class="topbar spiel-kopf">
      <button class="btn-text" data-act="spielZurueck">← Zurück</button>
      <div class="rune-uhr${S.guthaben < 60 ? ' knapp' : ''}" id="uhr"><span class="uhr-ring"></span><span id="spielzeit">${L.formatZeit(S.guthaben)}</span></div>
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button><button class="anl-knopf" data-act="anleitung" aria-label="So geht's">?</button></span>
    </header>
    <div class="km-huelle" id="ss-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  ss = steinschieberStarten($id('ss-huelle'), {
    stand: S.steinschieber,
    sichern: (st) => { S.steinschieber = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: spielDarfLaufen
  });
  overlayPruefen();
  anleitungErstmals('steinschieber');
}

// ---------- Runenfall (zweites freischaltbares Spiel, Logik in runenfall.js / runenfall-ui.js) ----------

// ---------- Weitere freischaltbare Spiele als Bausteine (gleiche Schnittstelle: starten, beenden, anhalten, stand, ruht) ----------

const MODUL_SPIELE = {
  runenreihen: { starten: runenreihenStarten, feld: 'runenreihen', ende: (k) => ({ punkte: k.punkte || 0, stufe: k.stufe || 1, zuege: k.zuege || 0, rekord: k.rekord || 0 }) },
  hoehlenkarte: { starten: hoehlenkarteStarten, feld: 'hoehlenkarte', ende: (k) => ({ groesse: k.groesse || null, offen: Array.isArray(k.offen) ? k.offen.filter(Boolean).length : (k.offen || 0), zurueck: k.zurueck || 0, tipps: k.tipps || 0 }) },
  runenbrecher: { starten: runenbrecherStarten, feld: 'runenbrecher', ende: (k) => ({ punkte: k.punkte || 0, level: (k.level || 0) + 1, hoechstes: (k.hoechstes || 0) + 1 }) },
  jadeschlange: { starten: jadeschlangeStarten, feld: 'jadeschlange', ende: (k) => ({ punkte: k.punkte || 0, laenge: Array.isArray(k.schlange) ? k.schlange.length : (k.laenge || 0), stufe: k.stufe || 1, kristalle: k.kristalle || 0, rekord: k.rekord || 0 }) }
};

// ---------- Anleitungen („So geht's“) ----------

const anleitungOffen = () => !!document.getElementById('anleitung');
const spielDarfLaufen = () => S.guthaben > 0 && ansicht === 'spiel' && !document.querySelector('#spiel-overlay .overlay') && !anleitungOffen();

function anleitungZeigen(id, seite = 0) {
  const a = ANLEITUNGEN[id];
  if (!a) return;
  let el = document.getElementById('anleitung');
  if (!el) { el = document.createElement('div'); el.id = 'anleitung'; el.className = 'anleitung'; document.body.appendChild(el); }
  const n = a.seiten.length, p = a.seiten[seite];
  el.dataset.id = id; el.dataset.seite = seite;
  el.innerHTML = `<div class="anl-box" role="dialog" aria-modal="true" aria-label="So geht ${esc(a.titel)}">
    <div class="anl-kopf"><span class="anl-titel">So geht ${esc(a.titel)}</span><button class="anl-zu" data-act="anleitungZu" aria-label="Schließen">✕</button></div>
    <div class="anl-seite">${p.bild}<div class="anl-text">${p.text.map(x => `<p>${esc(x)}</p>`).join('')}</div></div>
    <div class="anl-punkte">${a.seiten.map((_, i) => `<i class="${i === seite ? 'an' : ''}"></i>`).join('')}</div>
    <div class="anl-knoepfe">
      ${seite > 0 ? '<button class="anl-neben" data-act="anleitungZurueck">Zurück</button>' : '<span></span>'}
      ${seite < n - 1 ? '<button class="anl-haupt" data-act="anleitungWeiter">Weiter</button>' : '<button class="anl-haupt" data-act="anleitungZu">Los geht\'s!</button>'}
    </div></div>`;
  // Wischen blättert
  if (!el._wisch) {
    el._wisch = true;
    let x0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      const s0 = Number(el.dataset.seite), m = ANLEITUNGEN[el.dataset.id].seiten.length;
      if (dx < -50 && s0 < m - 1) anleitungZeigen(el.dataset.id, s0 + 1);
      if (dx > 50 && s0 > 0) anleitungZeigen(el.dataset.id, s0 - 1);
    });
  }
}

function anleitungSchliessen() {
  const el = document.getElementById('anleitung');
  if (!el) return;
  const id = el.dataset.id;
  el.remove();
  S.anleitungen = { ...(S.anleitungen || {}), [id]: true };
  sichern();
}

// Beim ersten Öffnen eines Spiels die Anleitung zeigen
function anleitungErstmals(id) {
  if (!(S.anleitungen && S.anleitungen[id])) anleitungZeigen(id);
}

function zeigeModulSpiel(id) {
  const m = MODUL_SPIELE[id];
  setzeAnsicht('spiel');
  S.letztesSpiel = id;
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (spielSitzung && spielSitzung.art !== id) spielBeenden();
  if (!spielSitzung) {
    spielSitzung = { start: Date.now(), sekunden: 0, art: id };
    protokoll(S, 'spiel_start', { guthaben: S.guthaben, spiel: id, test: !SP.istFrei(SP.splitterVon(S.splitter), id) || undefined });
  }
  sichern();
  $app.innerHTML = `
  <div class="screen spiel-screen kristallmine-screen">
    <header class="topbar spiel-kopf">
      <button class="btn-text" data-act="spielZurueck">← Zurück</button>
      <div class="rune-uhr${S.guthaben < 60 ? ' knapp' : ''}" id="uhr"><span class="uhr-ring"></span><span id="spielzeit">${L.formatZeit(S.guthaben)}</span></div>
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button><button class="anl-knopf" data-act="anleitung" aria-label="So geht's">?</button></span>
    </header>
    <div class="km-huelle" id="modul-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  ms = { id, spiel: m.starten($id('modul-huelle'), {
    stand: S[m.feld],
    sichern: (st) => { S[m.feld] = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: spielDarfLaufen
  }) };
  overlayPruefen();
  anleitungErstmals(id);
}

function zeigeRunenfallSpiel() {
  setzeAnsicht('spiel');
  S.letztesSpiel = 'runenfall';
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (spielSitzung && spielSitzung.art !== 'runenfall') spielBeenden();
  if (!spielSitzung) {
    spielSitzung = { start: Date.now(), sekunden: 0, art: 'runenfall' };
    protokoll(S, 'spiel_start', { guthaben: S.guthaben, spiel: 'runenfall', test: !SP.istFrei(SP.splitterVon(S.splitter), 'runenfall') || undefined });
  }
  sichern();
  $app.innerHTML = `
  <div class="screen spiel-screen kristallmine-screen">
    <header class="topbar spiel-kopf">
      <button class="btn-text" data-act="spielZurueck">← Zurück</button>
      <div class="rune-uhr${S.guthaben < 60 ? ' knapp' : ''}" id="uhr"><span class="uhr-ring"></span><span id="spielzeit">${L.formatZeit(S.guthaben)}</span></div>
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button><button class="anl-knopf" data-act="anleitung" aria-label="So geht's">?</button></span>
    </header>
    <div class="km-huelle" id="rn-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  rn = runenfallStarten($id('rn-huelle'), {
    stand: S.runenfall,
    sichern: (st) => { S.runenfall = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: spielDarfLaufen
  });
  overlayPruefen();
  anleitungErstmals('runenfall');
}

function runenfeldNeu() {
  if (S.bloecke) protokoll(S, 'spiel_neu', { spiel: 'runenfeld', altePunkte: S.bloecke.punkte });
  S.bloecke = { ...B.neuesSpiel(), rekord: (S.bloecke && S.bloecke.rekord) || 0 };
  sichern();
  const o = $id('spiel-overlay'); if (o) o.innerHTML = '';
  rfFeldZeichnen(); rfAblageZeichnen(); anzeigeRunenfeld(); overlayPruefen();
}

function anzeigeRunenfeld() {
  const p = $id('punkte'); if (p) p.textContent = S.bloecke.punkte;
  const r = $id('rekord'); if (r) r.textContent = S.bloecke.rekord || 0;
}

// farbenAlt: Farben gerade abgeräumter Felder, damit sie noch kurz aufleuchten
function rfFeldZeichnen(markieren = {}, farbenAlt = {}) {
  const brett = $id('rf-brett');
  if (!brett) return;
  const f = S.bloecke.feld;
  brett.querySelectorAll('.rf-zelle').forEach((z, i) => {
    const farbe = f[i] || farbenAlt[i] || 0;
    z.className = 'rf-zelle' + (farbe ? ` voll rf${farbe}` : '') + (markieren[i] ? ' ' + markieren[i] : '');
  });
}

function formHtml(t, gross = 0) {
  const f = B.FORMEN.find(x => x.name === t.form);
  const zellen = f.zellen.map(([r, c]) => `<span class="rf-stein rf${t.farbe}" style="grid-row:${r + 1};grid-column:${c + 1}"></span>`).join('');
  const groesse = gross ? `width:${f.breite * gross}px;height:${f.hoehe * gross}px;` : '';
  return `<span class="rf-form" style="grid-template-columns:repeat(${f.breite},1fr);grid-template-rows:repeat(${f.hoehe},1fr);--b:${f.breite};--h:${f.hoehe};${groesse}">${zellen}</span>`;
}

function rfAblageZeichnen() {
  const ab = $id('rf-ablage');
  if (!ab) return;
  ab.innerHTML = S.bloecke.teile.map((t, nr) => {
    if (!t) return '<div class="rf-platz leer"></div>';
    const passt = B.irgendwoPassend(S.bloecke.feld, t);
    return `<div class="rf-platz"><div class="rf-teil${passt ? '' : ' passt-nicht'}" data-nr="${nr}" role="button" aria-label="Form ${nr + 1}">${formHtml(t)}</div></div>`;
  }).join('');
}

function rfZiehenEinrichten() {
  const ab = $id('rf-ablage');
  if (!ab) return;
  ab.addEventListener('pointerdown', (e) => {
    // Ganzer Platz mit Umrandung zählt, nicht nur die Form selbst (kleine Formen sind schwer zu treffen)
    const platz = e.target.closest('.rf-platz');
    const el = platz && platz.querySelector('.rf-teil');
    if (!el || RF || document.querySelector('#spiel-overlay .overlay') || S.guthaben <= 0) return;
    const nr = Number(el.dataset.nr), t = S.bloecke.teile[nr];
    if (!t) return;
    e.preventDefault();
    const rect = $id('rf-brett').getBoundingClientRect();
    const zelle = rect.width / B.N;
    const f = B.FORMEN.find(x => x.name === t.form);
    const geist = document.createElement('div');
    geist.className = 'rf-geist';
    document.querySelector('.spiel-screen').appendChild(geist);
    // Maßstab messen: Bei vergrößerter Darstellung (Desktop-Modus, zoom) sind Bildschirm- und Seitenpixel verschieden
    geist.style.transform = 'translate(0px, 0px)';
    geist.innerHTML = '<span style="display:block;width:100px;height:100px"></span>';
    const r0 = geist.getBoundingClientRect();
    geist.style.transform = 'translate(100px, 100px)';
    const r1 = geist.getBoundingClientRect();
    const q = (r1.left - r0.left) / 100 || 1;   // Bildschirmpixel pro Seitenpixel bei Verschiebung
    const g = r0.width / 100 || 1;              // Bildschirmpixel pro Seitenpixel bei Größe
    geist.innerHTML = formHtml(t, zelle / g);
    // Die Form schwebt über dem Finger, damit man sie sieht
    RF = { nr, t, f, el, geist, zelle, q, x0: r0.left, y0: r0.top, abstand: Math.min(90 * g, zelle * 1.6), ziel: null, id: e.pointerId };
    el.classList.add('gezogen');
    try { platz.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    rfBewegen(e);
  });
  ab.addEventListener('pointermove', (e) => { if (RF && e.pointerId === RF.id) { e.preventDefault(); rfBewegen(e); } });
  const ende = (e) => { if (RF && e.pointerId === RF.id) rfLoslassen(); };
  ab.addEventListener('pointerup', ende);
  ab.addEventListener('pointercancel', ende);
}

function rfBewegen(e) {
  const { f, geist, zelle } = RF;
  const x = e.clientX - f.breite * zelle / 2;
  const y = e.clientY - f.hoehe * zelle - RF.abstand;
  geist.style.transform = `translate(${(x - RF.x0) / RF.q}px, ${(y - RF.y0) / RF.q}px)`;
  const rect = $id('rf-brett').getBoundingClientRect();
  const c = Math.round((x - rect.left) / zelle), r = Math.round((y - rect.top) / zelle);
  const markieren = {};
  RF.ziel = null;
  if (B.passt(S.bloecke.feld, RF.t, r, c)) {
    RF.ziel = [r, c];
    const erg = B.legen(S.bloecke.feld, RF.t, r, c);
    for (const i of erg.gelegt) markieren[i] = `vorschau rf${RF.t.farbe}`;
    for (const i of erg.geloescht) markieren[i] = (markieren[i] ? markieren[i] + ' ' : '') + 'wird-frei';
  } else {
    // Passt hier nicht: Umriss trotzdem zeigen, nur anders (gestrichelt, belegte Felder glühen)
    for (const [dr, dc] of f.zellen) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= B.N || cc >= B.N) continue;
      const i = rr * B.N + cc;
      markieren[i] = S.bloecke.feld[i] ? 'stoesst' : 'geht-nicht';
    }
  }
  geist.classList.toggle('ungueltig', !RF.ziel && Object.keys(markieren).length > 0);
  rfFeldZeichnen(markieren);
}

// ---------- Runenfeld: Effekte ----------

function rfEffekte(z) {
  const brett = $id('rf-brett');
  if (!brett || ruhig()) return;
  const zelleEl = (i) => brett.querySelector(`.rf-zelle[data-i="${i}"]`);
  const weg = (el, ms) => setTimeout(() => el.remove(), ms);
  // Lichtstrahl über jede abgeräumte Reihe und Spalte
  z.reihen.forEach((r, k) => {
    const a = zelleEl(r * B.N);
    const d = document.createElement('div');
    d.className = 'rf-strahl waag' + (z.kombo >= 2 ? ' gold' : '');
    d.style.top = a.offsetTop + 'px'; d.style.height = a.offsetHeight + 'px';
    d.style.animationDelay = k * 60 + 'ms';
    brett.appendChild(d); weg(d, 900);
  });
  z.spalten.forEach((c, k) => {
    const a = zelleEl(c);
    const d = document.createElement('div');
    d.className = 'rf-strahl senk' + (z.kombo >= 2 ? ' gold' : '');
    d.style.left = a.offsetLeft + 'px'; d.style.width = a.offsetWidth + 'px';
    d.style.animationDelay = (z.reihen.length + k) * 60 + 'ms';
    brett.appendChild(d); weg(d, 900);
  });
  // Funken aus den abgeräumten Steinen
  const felder = z.geloescht.slice().sort(() => Math.random() - 0.5).slice(0, 28);
  for (const i of felder) {
    const a = zelleEl(i);
    for (let n = 0; n < 2; n++) {
      const d = document.createElement('div');
      d.className = `rf-funke rf${z.farben[i] || 1}`;
      d.style.left = a.offsetLeft + a.offsetWidth / 2 + 'px';
      d.style.top = a.offsetTop + a.offsetHeight / 2 + 'px';
      const winkel = Math.random() * Math.PI * 2, weite = 30 + Math.random() * 60;
      d.style.setProperty('--dx', Math.cos(winkel) * weite + 'px');
      d.style.setProperty('--dy', Math.sin(winkel) * weite - 20 + 'px');
      d.style.animationDelay = Math.random() * 120 + 'ms';
      brett.appendChild(d); weg(d, 900);
    }
  }
  // Viele Linien auf einmal: das Feld bebt
  const rahmen = $id('rahmen');
  if (rahmen && z.linien >= 2) { rahmen.classList.remove('beben'); void rahmen.offsetWidth; rahmen.classList.add('beben'); }
  // Leeres Feld: alles leuchtet golden auf
  if (z.feldLeer) {
    const d = document.createElement('div');
    d.className = 'rf-leer-blitz';
    brett.appendChild(d); weg(d, 1400);
  }
}

// Rahmen glüht stärker, je länger die Kombo läuft
function rfGlut() {
  const rahmen = $id('rahmen');
  if (rahmen) rahmen.style.setProperty('--glut', Math.min(1, (S.bloecke.kombo || 0) * 0.25));
}

// Landeplatz: kurzer Lichtring um die gelegte Form
function rfLandung(gelegt) {
  const brett = $id('rf-brett');
  if (!brett || ruhig()) return;
  for (const i of gelegt) {
    const a = brett.querySelector(`.rf-zelle[data-i="${i}"]`);
    const d = document.createElement('div');
    d.className = 'rf-ring';
    d.style.left = a.offsetLeft + 'px'; d.style.top = a.offsetTop + 'px';
    d.style.width = a.offsetWidth + 'px'; d.style.height = a.offsetHeight + 'px';
    brett.appendChild(d); setTimeout(() => d.remove(), 500);
  }
}

function rfLoslassen() {
  const { nr, el, geist, ziel } = RF;
  geist.remove();
  el.classList.remove('gezogen');
  RF = null;
  if (ziel) rfLegen(nr, ziel[0], ziel[1]);
  else rfFeldZeichnen();
}

function rfLegen(nr, r, c) {
  const z = B.zug(S.bloecke, nr, r, c);
  if (!z) return rfFeldZeichnen();
  const rekordVorher = S.bloecke.rekord || 0;
  S.bloecke = { ...z.stand, rekord: Math.max(rekordVorher, z.stand.punkte) };
  // Erst kurz die abgeräumten Felder aufleuchten lassen, dann leeren
  const markieren = {};
  for (const i of z.gelegt) markieren[i] = 'neu';
  if (z.geloescht.length && !ruhig()) {
    for (const i of z.geloescht) markieren[i] = 'blitz';
    rfFeldZeichnen(markieren, z.farben);
    setTimeout(() => rfFeldZeichnen(), 340);
  } else rfFeldZeichnen(markieren);
  rfAblageZeichnen();
  anzeigeRunenfeld();
  punktePop(z.plus);
  rfLandung(z.gelegt);
  if (z.linien) rfEffekte(z);
  rfGlut();
  if (z.linien) {
    const rahmen = $id('rahmen');
    if (rahmen && !ruhig()) { rahmen.classList.remove('entfacht'); void rahmen.offsetWidth; rahmen.classList.add('entfacht'); }
    if (z.feldLeer) schwebeText('Feld leer!', 'meilenstein', 1600);
    else if (z.kombo >= 2) schwebeText(`Kombo ×${z.kombo}`, 'gold');
    else if (z.linien >= 2) schwebeText(`${z.linien} Linien`, '');
  }
  if (S.bloecke.punkte > rekordVorher && rekordVorher > 0 && S.bloecke.punkte - z.plus <= rekordVorher) schwebeText('Neuer Rekord', 'kette', 1400);
  if (z.vorbei) protokoll(S, 'spiel_vorbei', { spiel: 'runenfeld', punkte: S.bloecke.punkte });
  sichern();
  overlayPruefen();
}

// ============ Elternbereich ============

function elternZugang() {
  if (!S.einstellungen.pin) {
    oeffneModal(`<div class="pin-form"><h2 class="modal-titel">Elternbereich einrichten</h2>
      <p>Lege einen PIN fest (4 bis 8 Ziffern). Damit kommst du später in den Elternbereich: Logo 2 Sekunden gedrückt halten.</p>
      <input id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="PIN">
      <input id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="PIN wiederholen">
      <p class="fehler-text" id="pin-fehler"></p>
      <button class="btn btn-haupt" data-act="pinSetzen">Speichern</button></div>`);
  } else {
    oeffneModal(`<div class="pin-form"><h2 class="modal-titel">Elternbereich</h2>
      <input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="PIN">
      <p class="fehler-text" id="pin-fehler"></p>
      <button class="btn btn-haupt" data-act="pinPruefen">Öffnen</button></div>`);
  }
  setTimeout(() => { const i = document.querySelector('#modal input'); if (i) i.focus(); }, 50);
}

function zusammenfassung(tage = 7) {
  const grenze = Date.now() - tage * 86400000;
  const proThema = {};
  let aufgaben = 0, erst = 0, loesung = 0, teil = 0, verlassen = 0, hinweise = 0, spielSek = 0, rechnerNutzung = 0, schnell = 0;
  const fehler = {};
  for (const e of S.log) {
    if (new Date(e.t).getTime() < grenze) continue;
    const th = e.thema && (proThema[e.thema] || (proThema[e.thema] = { aufgaben: 0, erst: 0, zweit: 0, teil: 0, loesung: 0, hinweise: 0 }));
    if (e.typ === 'aufgabe_ende') {
      aufgaben++; th.aufgaben++; th[e.ergebnis]++;
      if (L.erstZaehlt(e)) erst++;
      if (e.ergebnis === 'loesung') loesung++;
      if (e.ergebnis === 'teil') teil++;
      if (e.hinweise && e.hinweise.length) th.hinweise++;
    }
    if (e.typ === 'versuch' && e.fehler) fehler[e.fehler] = (fehler[e.fehler] || 0) + 1;
    if (e.typ === 'versuch' && e.schnell && !e.richtig) schnell++;
    if (e.typ === 'verlassen') verlassen++;
    if (e.typ === 'hinweis' || e.typ === 'hinweis_kurz') hinweise++;
    if (e.typ === 'spiel_ende') spielSek += e.sekunden || 0;
    if (e.typ === 'rechner') rechnerNutzung++;
  }
  return { tage, aufgaben, erst, loesung, teil, verlassen, hinweise, spielSek, rechnerNutzung, schnellFalsch: schnell, fehler, proThema };
}



function testFokusHtml() {
  const f = testFokus();
  // Aus: nur der Schalter. Die Aufgaben kommen wie beim Schüler (normale Mischung).
  if (!f) return `<div class="fokus-box">
    <label class="schalter-zeile"><input type="checkbox" data-act="testFokusAn"><span><b>Gezielt testen</b><br><span class="gedaempft klein">Aus: Du bekommst die Aufgaben so, wie ${testAls() ? esc(ordnerName(testAls())) : 'mit deinen eigenen Einstellungen'} sie bekommt.</span></span></label>
  </div>`;
  const thema = f.thema;
  const opt = L.THEMEN.map(t => `<option value="${t}"${t === thema ? ' selected' : ''}>${esc(THEMA_NAMEN[t] || t)}</option>`).join('');
  const quellen = testAuswahl(thema).map(q => `Stufe ${q.st}: ${q.gen ? 'Baukasten' : ''}${q.gen && q.pool ? ' + ' : ''}${q.pool ? `${q.pool} aus dem Pool` : ''}${!q.gen && !q.pool ? 'keine Aufgaben' : ''}`).join(' · ');
  return `<div class="fokus-box an">
    <label class="schalter-zeile"><input type="checkbox" checked data-act="testFokusAus"><span><b>Gezielt testen ist AN</b><br><span class="klein">Es kommen nur Aufgaben aus diesem Bereich und dieser Stufe. Ausschalten = wieder wie beim Schüler.</span></span></label>
    <label class="feld-label">Bereich<select id="t-thema">${opt}</select></label>
    <div class="test-als">${[1, 2, 3].map(st => `<button class="btn btn-klein${f.stufe === st ? ' btn-haupt' : ''}" data-act="testFokus" data-st="${st}">Stufe ${st}</button>`).join('')}</div>
    <p class="klein gedaempft">${esc(quellen)}</p>
    <p class="klein">Jetzt: <b>${esc(THEMA_NAMEN[f.thema])} · Stufe ${f.stufe}</b>. Stufen der Baukästen ändern sich dabei nicht.</p>
  </div>`;
}

function zeigeEltern(meldung = '') {
  setzeAnsicht('eltern');
  const fern = (S.fern && S.fern.version) > 0;
  const z = zusammenfassung(7);
  const quote = z.aufgaben ? Math.round(z.erst / z.aufgaben * 100) : 0;
  const themenZeilen = Object.entries(z.proThema).filter(([, v]) => v.aufgaben).map(([k, v]) =>
    `<tr><td>${esc(THEMA_NAMEN[k] || k)}</td><td>${v.aufgaben}</td><td>${Math.round(v.erst / v.aufgaben * 100)} %</td><td>${v.loesung}</td><td>${v.hinweise}</td></tr>`).join('');
  const fehlerZeilen = Object.entries(z.fehler).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li>${esc(FEHLER_NAMEN[k] || k)}: <b>${v}</b></li>`).join('');
  const letzte = S.log.filter(e => e.typ === 'aufgabe_ende').slice(-8).reverse().map(e =>
    `<li><span class="erg erg-${e.ergebnis}">${e.ergebnis === 'erst' ? '1. Versuch' : e.ergebnis === 'zweit' ? '2. Versuch' : e.ergebnis === 'teil' ? 'Teil-Lösung' : 'Lösungsweg'}</span> ${esc(THEMA_NAMEN[e.thema] || e.thema)} · ${esc(e.id)}${e.verlassen ? ' · App verlassen' : ''}</li>`).join('');
  const optThema = L.THEMEN.map(t => `<option value="${t}"${t === S.einstellungen.thema ? ' selected' : ''}>${esc(THEMA_NAMEN[t])}</option>`).join('');
  const stunden = (sel) => Array.from({ length: 25 }, (_, h) => `<option value="${h}"${h === sel ? ' selected' : ''}>${h}:00</option>`).join('');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  $app.innerHTML = `
  <div class="screen eltern">
    <header class="topbar"><button class="btn-text" data-act="start">← Zurück</button><h2 class="eltern-titel">Elternbereich</h2><span></span></header>
    ${meldung ? `<div class="meldung ok">${meldung}</div>` : ''}
    <section class="karte">
      <h3>Letzte 7 Tage</h3>
      <div class="kennzahlen">
        <div><b>${z.aufgaben}</b><span>Aufgaben</span></div>
        <div><b>${quote} %</b><span>im 1. Versuch</span></div>
        ${z.teil ? `<div><b>${z.teil}</b><span>Teil-Lösung</span></div>` : ''}
        <div><b>${z.loesung}</b><span>Lösungsweg nötig</span></div>
        <div><b>${L.formatMinuten(z.spielSek).replace(' Min.', '')}</b><span>Min. gespielt</span></div>
        <div><b>${z.hinweise}</b><span>Hinweise geöffnet</span></div>
        <div><b>${z.verlassen}</b><span>App verlassen</span></div>
      </div>
      ${themenZeilen ? `<table class="tabelle"><thead><tr><th>Thema</th><th>Aufg.</th><th>1. Vers.</th><th>Lösung</th><th>mit Hinweis</th></tr></thead><tbody>${themenZeilen}</tbody></table>` : '<p class="gedaempft">Noch keine Aufgaben gemacht.</p>'}
      ${fehlerZeilen ? `<h4>Häufige Fehler</h4><ul class="liste">${fehlerZeilen}</ul>` : ''}
      ${z.schnellFalsch ? `<p class="gedaempft">Auffällig schnelle falsche Antworten bei Textaufgaben: <b>${z.schnellFalsch}</b></p>` : ''}
      ${letzte ? `<h4>Zuletzt</h4><ul class="liste klein">${letzte}</ul>` : ''}
    </section>

    <section class="karte">
      <h3>Schwierigkeit der Baukästen</h3>
      <p class="gedaempft klein">Steigt nach 3 richtigen Aufgaben im 1. Versuch, sinkt nach einem Lösungsweg. ${fern ? 'Ändern geht in der Eltern-App.' : 'Du kannst sie auch selbst ändern.'}</p>
      <div class="stufen-liste">${Object.keys(GEN_NAMEN).map(g => fern
        ? `<div class="stufen-zeile"><span>${esc(GEN_NAMEN[g])}</span><b>Stufe ${genStufe(g)}</b></div>`
        : `<div class="stufen-zeile"><span>${esc(GEN_NAMEN[g])}</span><span class="stufen-knoepfe"><button class="btn btn-klein" data-act="genStufe" data-g="${g}" data-d="-1" aria-label="leichter">−</button><b>Stufe ${genStufe(g)}</b><button class="btn btn-klein" data-act="genStufe" data-g="${g}" data-d="1" aria-label="schwerer">+</button></span></div>`).join('')}</div>
    </section>

    <section class="karte">
      <h3>Testgerät</h3>
      <label class="schalter-zeile"><input type="checkbox" id="u-test" data-act="testgeraet" ${S.upload.testgeraet ? 'checked' : ''}><span><b>Dieses Handy ist ein Testgerät</b><br><span class="gedaempft klein">Es werden keine Lerndaten übertragen. Exporte werden als Test markiert.</span></span></label>
      ${S.upload.testgeraet && S.upload.token ? `
      <h4>Testen als</h4>
      <p class="gedaempft klein">Übernimmt Aufgabenpaket und Einstellungen eines Schülers aus der Eltern-App. Bei ihm wird nichts verändert.</p>
      ${testSchueler ? `<div class="test-als">${[null, ...testSchueler].map(o => `<button class="btn btn-klein${(testAls() || null) === o ? ' btn-haupt' : ''}" data-act="testAls" data-o="${esc(o || '')}">${o ? esc(ordnerName(o)) : 'Eigene Einstellungen'}</button>`).join('')}</div>`
        : '<button class="btn btn-klein" data-act="testSchueler">Schüler laden</button>'}
      <p class="klein">Jetzt: <b>${testAls() ? esc(ordnerName(testAls())) : 'eigene Einstellungen'}</b>${paketKurz() ? ` · ${esc(paketKurz())}` : ''}</p>` : ''}
      ${S.upload.testgeraet ? testFokusHtml() : ''}
    </section>

    <section class="karte">
      <h3>Automatische Übertragung</h3>
      ${S.upload.testgeraet ? '<p class="meldung">Testgerät: Übertragung ist ausgeschaltet.</p>' : ''}
      ${S.upload.token ? `
        <p>Repo: <b>${esc(S.upload.repo)}</b> · Ordner: <b>daten/${esc(nutzerOrdner())}</b> · Schlüssel endet auf …${esc(S.upload.token.slice(-4))}</p>
        <p class="gedaempft klein">Letzte Übertragung: ${S.upload.letzter ? new Date(S.upload.letzter).toLocaleString('de-DE') : 'noch keine'}</p>
        ${S.upload.fehler ? `<p class="fehler-text">${esc(S.upload.fehler)}</p>` : ''}
        <div class="knopf-reihe"><button class="btn btn-haupt" data-act="syncJetzt">Jetzt übertragen</button><button class="btn" data-act="syncAus">Ausschalten</button></div>
        <button class="btn-text klein" data-act="qrScannen">Neu einrichten mit QR-Code</button>
      ` : `
        <p>Die Lerndaten werden automatisch in ein privates GitHub-Repo übertragen. Dafür einmal Repo und Zugangsschlüssel eintragen.</p>
        <label class="feld-label">Repo (Besitzer/Name)<input id="u-repo" type="text" value="${esc(S.upload.repo || '')}" placeholder="name/LearningToolsTracking" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <label class="feld-label">Zugangsschlüssel<input id="u-token" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <p class="fehler-text" id="u-fehler"></p>
        <button class="btn btn-haupt" data-act="syncSpeichern">Speichern und testen</button>
        <p class="gedaempft klein">Einfacher: In der Eltern-App unter Einstellungen einen QR-Code zeigen lassen und hier scannen.</p>
        <button class="btn" data-act="qrScannen">QR-Code scannen</button>
      `}
    </section>

    ${S.upload.token && !S.upload.testgeraet ? `<section class="karte">
      <h3>Spielstand online</h3>
      <p>Spielzeit, Spielstände und Fortschritt werden unter dem Namen <b>${esc(S.einstellungen.name)}</b> gesichert. Der Stand auf dem Server gilt immer: Ist dort ein neuerer Stand (z. B. von einem anderen Gerät), wird er übernommen. Nach dem Neu-Einrichten kommt alles mit dem gleichen Namen zurück.</p>
      <p class="gedaempft klein">Zuletzt gesichert: ${S.upload.standOnline && S.upload.standOnline.gespeichert ? new Date(S.upload.standOnline.gespeichert).toLocaleString('de-DE') + (S.upload.standOnline.geraetId && S.upload.standOnline.geraetId !== S.geraetId ? ' (von einem anderen Gerät)' : '') : 'noch nicht'}</p>
      ${S.upload.standFehler ? `<p class="fehler-text">${esc(S.upload.standFehler)}</p>` : ''}
      <div class="knopf-reihe"><button class="btn" data-act="standSichernJetzt">Jetzt sichern</button><button class="btn" data-act="standLaden">Online-Stand laden</button></div>
    </section>` : ''}

    <section class="karte">
      <h3>Daten senden</h3>
      <p>Die Datei enthält jeden Versuch. Lade sie im Claude-Projekt hoch, dann werden die Aufgaben angepasst.</p>
      <button class="btn btn-haupt" data-act="export">Daten exportieren</button>
      <p class="gedaempft klein">Letzter Export: ${S.letzterExport ? new Date(S.letzterExport).toLocaleString('de-DE') : 'noch nie'} · ${S.log.length} Einträge</p>
    </section>

    <section class="karte">
      <h3>Einstellungen</h3>
      ${fern ? `
      <p class="meldung">Diese Einstellungen kommen aus der Eltern-App (Stand ${new Date(S.fern.angewendet).toLocaleString('de-DE')}).</p>
      ${pakete() ? `<div class="info-zeile"><span>Pakete</span><b>${esc(S.pakete.map(p => `${p.paket.name} ${p.anteil} %${p.paket.etappen ? ` (Etappe ${p.etappe})` : ''}`).join(', '))}</b></div>` : ''}
      ${S.paket ? `<div class="info-zeile"><span>Aufgabenpaket</span><b>${esc(S.paket.name)}</b></div>
      <div class="info-zeile"><span>Mehr üben</span><b>${esc(Object.entries(gewichte()).filter(([, v]) => v === 4).map(([t]) => THEMA_NAMEN[t]).join(', ') || '–')}</b></div>
      <div class="info-zeile"><span>Aus</span><b>${esc(Object.entries(gewichte()).filter(([, v]) => v === 0).map(([t]) => THEMA_NAMEN[t]).join(', ') || '–')}</b></div>`
      : `<div class="info-zeile"><span>Übungsthema</span><b>${esc(THEMA_NAMEN[S.einstellungen.thema] || S.einstellungen.thema)}</b></div>`}
      <div class="info-zeile"><span>Geschenkte Spielzeit</span><b>${S.einstellungen.basisVon} bis ${S.einstellungen.basisBis} Uhr · ${minText(R().basisMin)}</b></div>
      <div class="info-zeile"><span>Spielzeit pro Aufgabe</span><b>${R().staffel.map(m => String(m).replace('.', ',')).join(' / ')} Min.</b></div>
      <div class="info-zeile"><span>2. Versuch / mit Rechner</span><b>${L.anteilText(R().zweit).replace('die ', '')} / ${L.anteilText(R().rechner).replace('die ', '')}</b></div>
      <div class="info-zeile"><span>Mit „Hilf mir“</span><b>${L.anteilText(R().hilfe ?? 0.5).replace('die ', '')}</b></div>
      <div class="info-zeile"><span>Freiwilliger Taschenrechner</span><b>${S.einstellungen.rechnerAngebot !== false ? 'an' : 'aus'}</b></div>
      <div class="info-zeile"><span>Lange Hinweise</span><b>${FU.langStufeInfo(S.einstellungen.langeHinweise).name}</b></div>
      ` : `
      <label class="feld-label">Übungsthema<select id="e-thema">${optThema}</select></label>
      <div class="zwei-spalten">
        <label class="feld-label">Basiszeit ab<select id="e-von">${stunden(S.einstellungen.basisVon)}</select></label>
        <label class="feld-label">bis<select id="e-bis">${stunden(S.einstellungen.basisBis)}</select></label>
      </div>`}
      <label class="feld-label">Name (Begrüßung und Ordner in den Lerndaten)<input id="e-name" type="text" value="${esc(S.einstellungen.name)}" maxlength="20" autocomplete="off"></label>
      <button class="btn btn-haupt" data-act="einstellungenSpeichern">Speichern</button>
    </section>

    <section class="karte">
      <h3>Spielzeit</h3>
      <p>Aktuell: <b>${L.formatZeit(S.guthaben)}</b></p>
      <div class="knopf-reihe">
        <button class="btn" data-act="zeitPlus" data-min="5">+5 Min.</button>
        <button class="btn" data-act="zeitPlus" data-min="15">+15 Min.</button>
        <button class="btn" data-act="zeitPlus" data-min="30">+30 Min.</button>
      </div>
    </section>

    <section class="karte">
      <h3>Aufgaben hinzufügen</h3>
      <p>JSON im Format aus <i>03-aufgabenformat-und-erstellung.md</i> einfügen (Liste oder <code>{"aufgaben": [...]}</code>).</p>
      <textarea id="e-json" rows="6" placeholder='[{"id":"app-minus-zahlen-1", …}]'></textarea>
      <div id="import-fehler"></div>
      <button class="btn btn-haupt" data-act="import">Kontrollieren und hinzufügen</button>
      <p class="gedaempft klein">Eingebaute Aufgaben: ${BASIS_AUFGABEN.length} · Hinzugefügt: ${S.extraAufgaben.length} · dazu unbegrenzt viele aus den Baukästen</p>
      ${S.extraAufgaben.length ? '<button class="btn-text klein" data-act="extraLoeschen">Hinzugefügte Aufgaben entfernen</button>' : ''}
    </section>

    <section class="karte">
      <h3>Einrichtung</h3>
      ${standalone ? '<p>Die App ist auf dem Home-Bildschirm installiert.</p>' : '<p><b>Tipp:</b> In Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen. Dann startet die App wie ein eigenes Programm und funktioniert auch ohne Internet.</p>'}
      <p class="gedaempft klein">${S.upload.token ? 'Die Lerndaten werden automatisch übertragen.' : 'Alle Daten liegen nur auf diesem Handy. Bitte regelmäßig exportieren.'} Version ${APP_VERSION}</p>
      <button class="btn-text klein" data-act="pinAendern">PIN ändern</button>
    </section>
  </div>`;
}

async function exportieren() {
  const { pin, ...einstellungen } = S.einstellungen;
  const daten = {
    app: 'lernapp-2048', version: APP_VERSION, exportiertAm: new Date().toISOString(), nutzer: S.einstellungen.name, geraetId: S.geraetId, testgeraet: !!S.upload.testgeraet,
    seitLetztemExport: S.letzterExport, einstellungen, guthaben: S.guthaben, spiel: { rekord: S.spiel.rekord, maxKachel: S.spiel.maxKachel },
    zusammenfassung7Tage: zusammenfassung(7), genStufen: S.genStufen, statistik: S.statistik, log: S.log
  };
  const json = JSON.stringify(daten, null, 1);
  const name = `lernapp-daten-${nutzerOrdner()}-${L.tagKey()}.json`;
  let geteilt = false;
  try {
    for (const type of ['application/json', 'text/plain']) {
      const file = new File([json], name, { type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Lernapp-Daten' });
        geteilt = true;
        break;
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // abgebrochen
  }
  if (!geteilt) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  S.letzterExport = new Date().toISOString();
  protokoll(S, 'export', { eintraege: S.log.length });
  sichern();
  zeigeEltern('Daten exportiert.');
}

function importieren() {
  const roh = document.getElementById('e-json').value.trim();
  const box = document.getElementById('import-fehler');
  let liste;
  try {
    const d = JSON.parse(roh);
    liste = Array.isArray(d) ? d : Array.isArray(d.aufgaben) ? d.aufgaben : [d];
  } catch (e) {
    box.innerHTML = `<p class="fehler-text">Das ist kein gültiges JSON: ${esc(e.message)}</p>`;
    return;
  }
  const ids = new Set(alleAufgaben().map(a => a.id));
  const hinweisIds = HINWEISE.map(h => h.id);
  const fehler = [];
  for (const a of liste) {
    fehler.push(...L.kontrolliereAufgabe(a, hinweisIds, ids));
    if (a && a.id) ids.add(a.id);
  }
  if (fehler.length) {
    box.innerHTML = `<p class="fehler-text">Nichts hinzugefügt. Bitte korrigieren:</p><ul class="liste fehler-text">${fehler.slice(0, 30).map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
    return;
  }
  S.extraAufgaben.push(...liste);
  protokoll(S, 'import', { anzahl: liste.length, ids: liste.map(a => a.id) });
  sichern();
  zeigeEltern(`${liste.length} ${liste.length === 1 ? 'Aufgabe' : 'Aufgaben'} hinzugefügt.`);
}

// ============ Modal ============

// ---------- Feedback ----------
// Knopf am rechten Rand: auf Testgeräten immer, sonst wenn in der Eltern-App für das Kind eingeschaltet.
// Senden geht auch vom Testgerät (einzige Ausnahme, nur nach „Senden“). Ablage: feedback/ im Daten-Repo.
const feedbackMoeglich = () => !!(S.upload && S.upload.repo && S.upload.token && (S.upload.testgeraet || S.feedbackAn));
let FBE = null; // Entwurf { bild, foto, kontext, sendet }
function feedbackKnopfZeigen() {
  let k = document.querySelector('.fb-knopf');
  if (!feedbackMoeglich()) { if (k) k.remove(); return; }
  if (!k) {
    k = document.createElement('button');
    k.className = 'fb-knopf'; k.dataset.act = 'feedback'; k.setAttribute('aria-label', 'Feedback geben');
    k.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    document.body.appendChild(k);
  }
}
function feedbackKontext() {
  const kopie = (x) => { try { return x == null ? null : JSON.parse(JSON.stringify(x)); } catch (e) { return null; } };
  const a = A && A.aufgabe;
  return {
    app: APP_VERSION, zeit: new Date().toISOString(), ansicht, gestaltung: S.gestaltung || 'schrein',
    nutzer: S.einstellungen.name || null, ordner: S.einstellungen.name ? nutzerOrdner() : null,
    testgeraet: !!S.upload.testgeraet, testAls: S.upload.testAls || null, testFokus: kopie(S.testFokus) || null,
    fernVersion: (S.fern && S.fern.version) || null,
    pakete: (pakete() || []).map(p => ({ id: p.id, rolle: p.rolle, anteil: p.anteil, etappe: p.etappe ?? null })),
    geraet: {
      ua: navigator.userAgent, breite: window.innerWidth, hoehe: window.innerHeight, dpr: window.devicePixelRatio || 1,
      zoom: getComputedStyle(document.documentElement).getPropertyValue('--zoom').trim() || '1',
      homeBildschirm: !!(window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches))
    },
    aufgabe: a ? {
      id: a.id, thema: a.thema, typ: a.typ, aufgabe: kopie(a), phase: A.phase, idx: A.idx, fertig: !!A.fertig, meldung: A.meldung || null,
      knobeln: !!A.knobeln, schritteAn: !!A.schritteAn, serienPos: A.serienPos, paket: A.paket || null, etappe: A.etappe ?? null,
      teile: kopie(A.teile), uf: kopie(A.uf)
    } : null,
    log: kopie(S.log.slice(-40))
  };
}
async function feedbackStart() {
  if (!feedbackMoeglich() || (FBE && FBE.sendet)) return;
  const k = document.querySelector('.fb-knopf');
  if (k) k.classList.add('laedt');
  const kontext = feedbackKontext();
  const bild = await FB.appBild();
  if (k) k.classList.remove('laedt');
  FBE = { bild, foto: null, kontext, sendet: false, text: '' };
  feedbackZeigen();
}
function feedbackZeigen(fehler = '') {
  const e = FBE;
  oeffneModal(`<div class="hinweis-text fb-box"><h2 class="modal-titel">Feedback</h2>
    ${e.bild ? `<img class="fb-bild" src="data:image/jpeg;base64,${e.bild}" alt="Bild der App">` : '<p class="gedaempft klein">Das Bild der App hat nicht geklappt. Du kannst ein eigenes Foto anhängen.</p>'}
    <label class="fb-label" for="fb-text">Was ist dir aufgefallen?</label>
    <textarea id="fb-text" class="fb-text" rows="4" maxlength="4000" placeholder="Zum Beispiel: Die Taste ist verdeckt.">${esc(e.text || '')}</textarea>
    <label class="btn btn-klein fb-foto-knopf">${e.foto ? '✓ Foto angehängt · ändern' : '+ Eigenes Foto anhängen'}<input type="file" id="fb-foto" accept="image/*" hidden></label>
    ${fehler ? `<p class="meldung">${esc(fehler)}</p>` : ''}
    <p class="gedaempft klein">Mit dem Text gehen das Bild und der Stand der App mit (Aufgabe, Version, Gerät).</p>
    <div class="fb-knoepfe"><button class="btn" data-act="modalZu">Abbrechen</button><button class="btn btn-haupt" data-act="feedbackSenden"${e.sendet ? ' disabled' : ''}>${e.sendet ? 'Wird gesendet …' : 'Senden'}</button></div>
  </div>`, () => { if (FBE && !FBE.sendet) FBE = null; });
}
async function feedbackFoto(input) {
  if (!FBE || !input.files || !input.files[0]) return;
  FBE.text = (document.getElementById('fb-text') || {}).value || FBE.text;
  FBE.foto = await FB.fotoVerkleinern(input.files[0]);
  feedbackZeigen(FBE.foto ? '' : 'Das Foto konnte nicht gelesen werden.');
}
async function feedbackSenden() {
  if (!FBE || FBE.sendet) return;
  FBE.text = ((document.getElementById('fb-text') || {}).value || '').trim();
  if (!FBE.text) return feedbackZeigen('Schreib kurz, was dir aufgefallen ist.');
  FBE.sendet = true; feedbackZeigen();
  try {
    const von = S.einstellungen.name ? nutzerOrdner() : 'unbekannt';
    const id = await FB.senden({ repo: S.upload.repo, token: S.upload.token }, { text: FBE.text, bild: FBE.bild, foto: FBE.foto, kontext: FBE.kontext, von });
    protokoll(S, 'feedback', { id });
    S.feedbackOffen = [...(S.feedbackOffen || []), id];
    sichern();
    FBE = null;
    oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Danke!</h2><p>Dein Feedback ist angekommen.</p><button class="btn btn-haupt" data-act="modalZu">Schließen</button></div>`);
  } catch (err) {
    FBE.sendet = false;
    feedbackZeigen(`Senden hat nicht geklappt: ${err.message || 'Fehler'}. Versuch es gleich noch einmal.`);
  }
}

// ---------- Rückmeldung zu eigenen Tickets: Was wurde geändert? ----------
// Ist ein eigenes Ticket erledigt, zeigt der Startbildschirm einmal, was sich geändert hat (Feld fuer_kind, sonst ein allgemeiner Satz).
let rueckZuletzt = 0, rueckLaeuft = false;
async function feedbackRueckmeldungHolen() {
  const u = S.upload;
  if (rueckLaeuft || !u.token || !u.repo || !S.einstellungen.name || Date.now() - rueckZuletzt < 10 * 60 * 1000) return;
  rueckLaeuft = true; rueckZuletzt = Date.now();
  const ich = nutzerOrdner();
  try {
    // Beim ersten Mal: eigene Tickets im Daten-Repo suchen (auch solche von vor dieser Version)
    if (!Array.isArray(S.feedbackOffen)) {
      const liste = (await U.ordnerLesen(u, 'feedback')).filter(f => f.type === 'file' && /\.json$/.test(f.name));
      const eigene = [];
      for (const f of liste) {
        const t = await U.dateiLesen(u, `feedback/${f.name}`).catch(() => null);
        if (t && t.von === ich && (t.status !== 'erledigt' || t.fuer_kind)) eigene.push(t.id);
      }
      S.feedbackOffen = eigene;
    }
    for (const id of S.feedbackOffen.slice()) {
      const t = await U.dateiLesen(u, `feedback/${id}.json`).catch(() => null);
      if (!t) continue;
      if (t.status === 'erledigt') {
        S.feedbackNeu = [...(S.feedbackNeu || []), { id, text: String(t.text || '').slice(0, 300), fuerKind: String(t.fuer_kind || '').slice(0, 500) }];
        S.feedbackOffen = S.feedbackOffen.filter(x => x !== id);
        protokoll(S, 'feedback_erledigt_gemeldet', { id });
      }
    }
    sichern();
  } catch (e) { /* später noch einmal */ } finally { rueckLaeuft = false; }
  if (ansicht === 'start') feedbackRueckmeldungZeigen();
}
function feedbackRueckmeldungZeigen() {
  const neu = S.feedbackNeu || [];
  if (!neu.length || $modal.classList.contains('offen')) return;
  oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">${neu.length > 1 ? 'Deine Meldungen sind erledigt' : 'Deine Meldung ist erledigt'}</h2>
    ${neu.map(m => `<p class="gedaempft">Du hattest geschrieben: „${esc(m.text)}“</p><p>${esc(m.fuerKind || 'Wir haben uns das angesehen und es in der App geändert.')}</p>`).join('')}
    <p>Danke fürs Melden!</p><button class="btn btn-haupt" data-act="modalZu">Super</button></div>`, () => { S.feedbackNeu = []; sichern(); });
}

function oeffneModal(html, beimSchliessen = null) {
  modalSchliessen = beimSchliessen;
  // Sternzeit: normale Fenster (Fragen, Meldungen, Feedback) im Konsolen-Stil, Hinweiskarten bleiben wie sie sind
  const sz = document.body.classList.contains('sz') && /^\s*<div class="hinweis-text/.test(html);
  $modal.innerHTML = `<div class="modal-hinter" data-act="modalZu"></div><div class="modal-box${sz ? ' sz-modal' : ''}" role="dialog" aria-modal="true"><button class="modal-x" data-act="modalZu" aria-label="Schließen">✕</button>${html}</div>`;
  $modal.classList.add('offen');
}

function schliesseModal() {
  $modal.classList.remove('offen');
  $modal.innerHTML = '';
  const cb = modalSchliessen; modalSchliessen = null;
  if (cb) cb();
}

// ============ Klicks ============

function klick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  switch (act) {
    case 'aufgaben':
      if (ansicht === 'spiel') spielBeenden();
      // Vor der ersten Aufgabe einer Runde fragen: Spielzeit oder Bildschirmzeit?
      // Ohne Spielzeit (Schalter pro Kind): keine Frage, es zählt Bildschirmzeit, wenn sie an ist und noch etwas geht
      if (ansicht === 'start' && !zweck && !bed('spielzeit_zeigen')) { zweck = BZ().an && BS.restSek(bzKonto(), BZ()) > 0 ? 'bild' : 'spiel'; protokoll(S, 'zweck', { zweck, grund: 'ohne_spielzeit' }); }
      if (ansicht === 'start' && BZ().an && !zweck) { zeigeWahl(); break; }
      if (!zweck) zweck = 'spiel';
      neueAufgabe(); break;
    case 'zweck':
      zweck = el.dataset.w === 'bild' && BZ().an && BS.restSek(bzKonto(), BZ()) > 0 ? 'bild' : 'spiel';
      protokoll(S, 'zweck', { zweck });
      neueAufgabe(); break;
    case 'zweckBild': zweck = 'bild'; protokoll(S, 'zweck', { zweck, grund: 'spielzeit_voll' }); neueAufgabe(); break;
    case 'bzSeite': zeigeBildschirmzeit(); break;
    case 'bzTeilen': bzTeilen(); break;
    case 'spielen':
      zeigeSpiel(); break;
    case 'zumSpiel':
      spielStarten(letztesOffenes());
      break;
    case 'kristallmine':
      zeigeKristallmine(); break;
    case 'erfolge': erfolgeZurueck = ansicht === 'spiele' ? 'spielauswahl' : 'start'; if (ansicht === 'spiel') spielBeenden(); zeigeErfolge(); break;
    case 'spielauswahl': zeigeSpieleSeite(); break;
    case 'anleitung': anleitungZeigen(el.dataset.id || S.letztesSpiel || '2048'); break;
    case 'anleitungWeiter': { const a = document.getElementById('anleitung'); anleitungZeigen(a.dataset.id, Number(a.dataset.seite) + 1); break; }
    case 'anleitungZurueck': { const a = document.getElementById('anleitung'); anleitungZeigen(a.dataset.id, Number(a.dataset.seite) - 1); break; }
    case 'anleitungZu': anleitungSchliessen(); break;
    case 'freischalten': freischaltenJetzt(el.dataset.id); break;
    case 'neuspiel': {
      const id = el.dataset.id, sp = SP.splitterVon(S.splitter);
      if ($modal.classList.contains('offen')) { modalSchliessen = null; schliesseModal(); }
      if (sp) spielStarten(id);
      break;
    }
    case 'runenfeld':
      zeigeRunenfeld(); break;
    case 'runenfeldNeu':
      if (S.bloecke && S.bloecke.punkte > 0 && !B.spielVorbei(S.bloecke.feld, S.bloecke.teile)) {
        oeffneModal(`<h2 class="modal-titel">Neues Spiel?</h2><p>Das aktuelle Spiel ist dann weg. Deine Spielzeit bleibt.</p><div class="knopf-reihe"><button class="btn btn-haupt" data-act="runenfeldNeuJetzt">Neues Spiel</button><button class="btn" data-act="modalZu">Abbrechen</button></div>`);
      } else runenfeldNeu();
      break;
    case 'runenfeldNeuJetzt': schliesseModal(); runenfeldNeu(); break;
    case 'basis': {
      const slot = L.basisSlotJetzt(new Date(), S.einstellungen, S.basisSlot);
      if (slot && R().basisMin > 0) { S.basisSlot = slot; S.guthaben += Math.round(R().basisMin * 60); protokoll(S, 'basis', { slot }); sichern(); }
      zeigeStart(); break;
    }
    case 'start': zeigeStart(); break;
    case 'beenden':
      if (A && !A.fertig && !A.test && A.aufgabe.geschichte && !A.hilfeAngeboten && !A.textHilfe) { textHilfeAnbieten(); break; }
      beendenJetzt(); break;
    case 'textHilfeJa': textHilfeJa(); break;
    case 'textHilfeNein':
      schliesseModal();
      if (A) protokoll(S, 'text_hilfe', { id: A.aufgabe.id, angenommen: false });
      beendenJetzt(); break;
    case 'vorlesen': vorlesen(); break;
    case 'naechsterSatz': naechsterSatz(); break;
    case 'karte': karteWaehlen(Number(el.dataset.p), Number(el.dataset.k)); break;
    case 'kartenPruefen': kartenPruefen(); break;
    case 'naechste': neueAufgabe(); break;
    case 'ueberspringen':
      protokoll(S, 'uebersprungen', { id: A.aufgabe.id });
      S.serie.pos = Math.max(0, S.serie.pos - 1);
      neueAufgabe(); break;
    case 'teilUeberspringen': {
      const t = aktuellerTeil();
      if (t && t.bonus) { t.status = 'uebersprungen'; protokoll(S, 'bonus_teil_uebersprungen', { id: A.aufgabe.id, teil: A.idx }); naechsterTeil(); }
      break;
    }
    case 'taste': tastatur(el.dataset.k); break;
    case 'schritteAn': schritteAn(false); break;
    case 'logbuch': if (ansicht === 'spiel') spielBeenden(); zeigeLogbuch(); break;
    case 'logbuchEintrag': zeigeLogbuch(el.dataset.id); break;
    case 'logbuchGelesen': {
      const st = lbStand();
      if (!st.gelesen.includes(el.dataset.id)) { st.gelesen.push(el.dataset.id); protokoll(S, 'logbuch_gelesen', { id: el.dataset.id }); sichern(); }
      if (!zweck) zweck = 'spiel';
      neueAufgabe(); break;
    }
    case 'archiv': if (ansicht === 'spiel') spielBeenden(); zeigeArchiv(); break;
    case 'archivKaufen': archivKaufen(el.dataset.id); break;
    case 'archivKaufenJa': archivKaufenJa(el.dataset.id); break;
    case 'archivOeffnen': protokoll(S, 'archiv_geoeffnet', { id: el.dataset.id }); sichern(); return; // Link öffnet selbst
    case 'uebungszeit': A = null; S.laufend = null; zeigeUebungszeit(); break;
    case 'uzTeilen': uzTeilen(); break;
    case 'zpUmschalten': {
      const t = aktuellerTeil();
      if (!t || t.art !== 'zahl' || A.phase !== 'eingabe') break;
      t.zp = !t.zp; if (!t.zp) t.e = ''; A.feld = 'z'; A.meldung = null;
      zeigeAufgabe(); break;
    }
    case 'fTaste': {
      const t = aktuellerTeil();
      if (!t || t.art !== 'formel' || A.phase !== 'eingabe') break;
      const k = el.dataset.k;
      A.meldung = null;
      if (k === '⌫') t.tokens.pop();
      else if (t.tokens.length < 30) {
        // Ziffern und Komma hängen an der Zahl davor
        const letzte = t.tokens[t.tokens.length - 1];
        if (/^[\d]$/.test(k) && letzte && /^[\d,]+$/.test(letzte)) t.tokens[t.tokens.length - 1] = letzte + k;
        else t.tokens.push(k);
      }
      zeigeAufgabe(); break;
    }
    case 'fKarte': {
      const t = aktuellerTeil();
      const i = Number(el.dataset.i);
      if (!t || t.art !== 'formel' || A.phase !== 'eingabe' || t.gelegt.includes(i)) break;
      t.gelegt.push(i); A.meldung = null; zeigeAufgabe(); break;
    }
    case 'fZurueck': { const t = aktuellerTeil(); if (t && t.art === 'formel') { t.gelegt.pop(); zeigeAufgabe(); } break; }
    case 'feld': A.feld = el.dataset.feld; zeigeAufgabe(); break;
    case 'antwort': antwortGeben(); break;
    case 'springe': springeZu(Number(el.dataset.i)); break;
    case 'wahl': {
      const t = aktuellerTeil();
      if (!t || A.phase !== 'eingabe') break;
      const k = Number(el.dataset.k);
      // 3-Sekunden-Regel bei „Was ist gesucht?“ und ähnlichen Auswahl-Schritten (Auftrag 37)
      if (bed('teil_loesung') && L.leseAuswahl(A.aufgabe, t.label) && Date.now() - t.seit < L.LESEZEIT_MS) { zuSchnellMelden(t, String(k), 'auswahl'); break; }
      t.gewaehlt = k;
      const dFehler = t.detektiv ? { typ: 'detektiv_urteil', text: A.aufgabe.stimmt ? 'Rechne selbst nach. Kommt dasselbe heraus?' : 'Schau genau hin. Rechne selbst nach.' } : null;
      let wf = k === t.richtig ? null : dFehler || L.erkenneWahlFehler(A.aufgabe, t.quelle, k);
      if (wf && !t.detektiv && A.aufgabe.typ === 'detektiv') wf = { ...wf, typ: 'detektiv_fehlerwahl' };
      versuchMerken(t, t.spalte ? t.optionen[k] : String(k), k === t.richtig, wf);
      break;
    }
    case 'linie': linieTippen(Number(el.dataset.i)); break;
    case 'linienPruefen': linienPruefen(); break;
    case 'detektivHilfe': protokoll(S, 'detektiv_hilfe', { id: A && A.aufgabe.id }); detektivEinfuehrung(); break;
    case 'verstanden':
      protokoll(S, 'tipp_bestaetigt', { id: A.aufgabe.id, teil: A.idx });
      A.phase = 'eingabe'; A.meldung = null; zeigeAufgabe(); break;
    case 'weiter': naechsterTeil(); break;
    case 'hinweis': hinweisOeffnen(el.dataset.id); break;
    case 'mehrHilfe': mehrHilfe(el.dataset.id); break;
    case 'formelSeite': formelSeite(Number(el.dataset.s)); break;
    case 'rechner': rechnerOeffnen(); break;
    case 'rechnerOptional':
      if (A.rechnerHalb) { rechnerOeffnen(); break; }
      oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Taschenrechner nutzen?</h2>
        <p>${L.rechnerOptional(A.aufgabe) ? 'Hier sind die Zahlen groß. Du darfst den Taschenrechner nehmen.' : 'Das schaffst du auch im Kopf. Du darfst den Taschenrechner trotzdem nehmen.'}</p>
        ${R().rechner >= 1 ? '<p>Die Spielzeit bleibt gleich.</p>' : `<p><b>Dann gibt es für diese Aufgabe ${L.anteilText(R().rechner)}.</b></p>
        <p>Selbst rechnen bringt die volle Zeit.</p>`}
        <div class="knopf-reihe"><button class="btn btn-haupt" data-act="rechnerJa">Ja, mit Rechner</button><button class="btn" data-act="modalZu">Ich rechne selbst</button></div></div>`);
      protokoll(S, 'rechner_angeboten', { id: A.aufgabe.id });
      break;
    case 'hilfe': hilfeZeigen(); break;
    case 'hilfeGesperrt': hilfeGesperrtGetippt(); break;
    case 'ufAn': ufAn(); break;
    case 'ufOp': if (A && A.uf) { A.uf.op = el.dataset.o; A.meldung = null; zeigeAufgabe(); } break;
    case 'ufTerm': if (A && A.uf) { if (!A.uf.tippen) A.uf.term = UF.leer(); const ed = A.uf.term; for (const z of UF.setzen(el.dataset.t).t) UF.tippen(ed, z); A.meldung = null; zeigeAufgabe(); } break;
    case 'ufFest': ufAnwenden(el.dataset.f); break;
    case 'ufAnwenden': ufAnwenden('op'); break;
    // Auswahl korrigieren: erst den Term löschen, dann das Rechenzeichen
    case 'ufLeeren': if (A && A.uf) { if (!UF.istLeer(A.uf.term)) A.uf.term = UF.leer(); else A.uf.op = null; A.meldung = null; zeigeAufgabe(); } break;
    case 'ufTaste': ufTaste(el.dataset.k); break;
    case 'ufTippen': if (A && A.uf) { A.uf.tippen = true; zeigeAufgabe(); } break;
    case 'ufTippenZu': if (A && A.uf) { A.uf.tippen = false; zeigeAufgabe(); } break;
    case 'ufCur': ufCur(el, e); break;
    case 'ufSeite': if (A && A.uf && (A.uf.phase === 'eintragen' || A.uf.phase === 'aufstellen') && !A.uf.app[el.dataset.s] && A.uf.status[el.dataset.s] !== 'ok') { A.uf.seite = el.dataset.s; zeigeAufgabe(); } break;
    case 'ufPruefen': ufPruefen(); break;
    case 'ufWeiter': if (A && A.uf && A.uf.phase === 'aufstellen') ufAufgestellt(null); else ufSchrittFertig(); break;
    case 'ufZurueck': ufZurueck(); break;
    case 'ufHilfe': ufHilfe(); break;
    case 'rechnerJa':
      A.rechnerHalb = true;
      protokoll(S, 'rechner_optional', { id: A.aufgabe.id, teil: A.idx });
      schliesseModal();
      rechnerOeffnen();
      break;
    case 'rTaste': rechnerTaste(el.dataset.k); break;
    case 'rUebernehmen': rechnerUebernehmen(); break;
    case 'rEinklappen': A.rechnerOffen = false; zeigeAufgabe(); break;
    case 'rAufklappen': A.rechnerOffen = true; zeigeAufgabe(); break;
    case 'zuoSlot': zuoAuswahl(Number(el.dataset.g), el.dataset.s); break;
    case 'zuoWahl': zuoWaehlen(Number(el.dataset.g), el.dataset.s, Number(el.dataset.o)); break;
    case 'modalZu': schliesseModal(); break;
    case 'feedback': feedbackStart(); break;
    case 'feedbackSenden': feedbackSenden(); break;
    case 'spielZurueck': spielBeenden(); zeigeStart(); break;
    case 'neuesSpiel':
      if (S.spiel.punkte > 0) {
        oeffneModal(`<h2 class="modal-titel">Neues Spiel?</h2><p>Das aktuelle Spiel ist dann weg. Deine Spielzeit bleibt.</p><div class="knopf-reihe"><button class="btn btn-haupt" data-act="neuesSpielJetzt">Neues Spiel</button><button class="btn" data-act="modalZu">Abbrechen</button></div>`);
      } else { neuesSpielFeld(); sichern(); brettZeichnen(); }
      break;
    case 'neuesSpielJetzt':
      schliesseModal();
      protokoll(S, 'spiel_neu', { altePunkte: S.spiel.punkte });
      neuesSpielFeld(); sichern();
      document.getElementById('spiel-overlay').innerHTML = '';
      brettZeichnen(); overlayPruefen(); break;
    case 'overlayZu': document.getElementById('spiel-overlay').innerHTML = ''; sichern(); break;
    case 'pinSetzen': {
      const p1 = document.getElementById('pin1').value, p2 = document.getElementById('pin2').value;
      const f = document.getElementById('pin-fehler');
      if (!/^\d{4,8}$/.test(p1)) { f.textContent = 'Bitte 4 bis 8 Ziffern.'; break; }
      if (p1 !== p2) { f.textContent = 'Die beiden PINs sind verschieden.'; break; }
      S.einstellungen.pin = p1; sichern(); schliesseModal(); zeigeEltern('PIN gespeichert.'); break;
    }
    case 'pinPruefen': {
      const p = document.getElementById('pin').value;
      if (p === S.einstellungen.pin) { schliesseModal(); protokoll(S, 'eltern_offen'); sichern(); zeigeEltern(); }
      else { document.getElementById('pin-fehler').textContent = 'Falscher PIN.'; protokoll(S, 'eltern_pin_falsch'); sichern(); }
      break;
    }
    case 'pinAendern': S.einstellungen.pin = null; sichern(); elternZugang(); break;
    case 'einstellungenSpeichern': {
      if (document.getElementById('e-thema')) {
        const von = Number(document.getElementById('e-von').value), bis = Number(document.getElementById('e-bis').value);
        S.einstellungen.thema = document.getElementById('e-thema').value;
        S.einstellungen.basisVon = Math.min(von, bis);
        S.einstellungen.basisBis = Math.max(von, bis);
      }
      const neuerName = document.getElementById('e-name').value.trim().replace(/\s+/g, ' ').slice(0, 20);
      if (neuerName.length >= 2 && neuerName !== S.einstellungen.name) {
        protokoll(S, 'name_geaendert', { von: S.einstellungen.name, nach: neuerName });
        S.einstellungen.name = neuerName;
        S.upload.tage = {};
        S.upload.standGeprueft = false; S.upload.standKern = null; S.upload.standRev = 0; S.upload.standWartet = false;
      }
      protokoll(S, 'einstellungen', { thema: S.einstellungen.thema, basisVon: S.einstellungen.basisVon, basisBis: S.einstellungen.basisBis });
      sichern(); zeigeEltern('Einstellungen gespeichert.'); break;
    }
    case 'zeitPlus': {
      const sek = Number(el.dataset.min) * 60;
      S.guthaben += sek; protokoll(S, 'zeit_eltern', { sekunden: sek }); sichern();
      zeigeEltern(`${el.dataset.min} Min. Spielzeit gutgeschrieben.`); break;
    }
    case 'export': exportieren(); break;
    case 'qrScannen': qrScannen(); break;
    case 'scanText': {
      const d = einrichtungLesen(document.getElementById('scan-text').value);
      if (!d || d.art !== 'kind') { const i = document.getElementById('scan-info'); if (i) i.textContent = 'Der Link ist nicht richtig. Bitte den ganzen Link aus der Eltern-App einfügen.'; break; }
      scannerStoppen(); schliesseModal(); einrichten(d, 'text'); break;
    }
    case 'einrichtenNameJa': { const d = einrichtenWartet; einrichtenWartet = null; schliesseModal(); if (d) einrichten(d, 'bestaetigt'); break; }
    case 'standSichernJetzt':
      el.textContent = 'Wird gesichert …';
      standHochladen(true).then(() => zeigeEltern(S.upload.standFehler ? S.upload.standFehler : 'Spielstand gesichert.'));
      break;
    case 'standLaden':
      oeffneModal(`<h2 class="modal-titel">Online-Stand laden?</h2><p>Spielzeit und Spielstände auf diesem Handy werden durch den gesicherten Stand ersetzt.</p><div class="knopf-reihe"><button class="btn btn-haupt" data-act="standLadenJa">Laden</button><button class="btn" data-act="modalZu">Abbrechen</button></div>`);
      break;
    case 'standLadenJa':
      schliesseModal();
      U.dateiLesen(S.upload, standPfad()).then(datei => {
        if (!datei || !standUebernehmen(datei, 'eltern')) return zeigeEltern('Online gibt es noch keinen Spielstand.');
        zeigeEltern(`Spielstand vom ${new Date(datei.gespeichert).toLocaleString('de-DE')} geladen.`);
      }).catch(e => zeigeEltern(e.message));
      break;
    case 'anmelden': anmelden(); break;
    case 'syncSpeichern': {
      const repo = document.getElementById('u-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
      const token = document.getElementById('u-token').value.trim();
      const f = document.getElementById('u-fehler');
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { f.textContent = 'Bitte das Repo als Besitzer/Name angeben.'; break; }
      if (token.length < 20) { f.textContent = 'Bitte den ganzen Schlüssel einfügen.'; break; }
      f.textContent = 'Wird getestet …';
      U.verbindungTesten({ repo, token }).then(info => {
        if (!info.privat) { f.textContent = 'Das Repo ist öffentlich. Bitte nur ein privates Repo verwenden.'; return; }
        S.upload = { ...S.upload, repo, token, fehler: null, tage: {}, standGeprueft: false, standKern: null, standRev: 0, standWartet: false };
        protokoll(S, 'upload_eingerichtet', { repo });
        sichern();
        if (S.upload.testgeraet) { zeigeEltern('Verbindung klappt und ist gespeichert. Testgerät: Es wird nichts übertragen.'); return; }
        return syncen(true).then(() => zeigeEltern(S.upload.fehler ? `Gespeichert, aber: ${S.upload.fehler}` : 'Übertragung eingerichtet und Daten übertragen.'));
      }).catch(e => { f.textContent = e.message; });
      break;
    }
    case 'testFokus': {
      const thema = document.getElementById('t-thema').value, st = Number(el.dataset.st);
      const leer = testAuswahl(thema).find(q => q.st === st);
      S.testFokus = { thema, stufe: st };
      protokoll(S, 'test_fokus', { thema, stufe: st }); sichern();
      zeigeEltern(!leer.gen && !leer.pool ? `${esc(THEMA_NAMEN[thema])}, Stufe ${st}: Dafür gibt es keine Aufgaben. Es kommt die normale Mischung.` : `Gezielt: ${esc(THEMA_NAMEN[thema])}, Stufe ${st}.`);
      break;
    }
    case 'testFokusAn': {
      const thema = L.THEMEN.includes(S.testFokusEntwurf) ? S.testFokusEntwurf : L.THEMEN[0];
      S.testFokus = { thema, stufe: 1 };
      protokoll(S, 'test_fokus', S.testFokus); sichern();
      zeigeEltern(`Gezielt testen ist an: ${esc(THEMA_NAMEN[thema])}, Stufe 1. Wähle Bereich und Stufe.`);
      break;
    }
    case 'testFokusAus': S.testFokus = null; protokoll(S, 'test_fokus', { thema: null }); sichern(); zeigeEltern(`Gezielt testen ist aus. Die Aufgaben kommen wieder wie ${testAls() ? `bei ${esc(ordnerName(testAls()))}` : 'mit deinen eigenen Einstellungen'}.`); break;
    case 'testSchueler':
      el.textContent = 'Wird geladen …';
      testSchuelerLaden().then(() => zeigeEltern()).catch(e => zeigeEltern(esc(e.message || 'Laden hat nicht geklappt.')));
      break;
    case 'personaWahl': personaWahl(); break;
    case 'personaSetzen': {
      const o = el.dataset.o || null;
      el.textContent = 'Wird übernommen …';
      testAlsSetzen(o).then(() => { schliesseModal(); zeigeStart(); if (S.fern && S.fern.fehler) personaWahl(esc(S.fern.fehler)); });
      break;
    }
    case 'testAls': {
      const o = el.dataset.o || null;
      el.textContent = 'Wird übernommen …';
      testAlsSetzen(o).then(() => zeigeEltern(S.fern && S.fern.fehler ? esc(S.fern.fehler)
        : o ? `Testen als ${esc(ordnerName(o))}${S.paket ? `: Paket „${esc(S.paket.name)}“` : ''}.` : 'Wieder die eigenen Einstellungen.'));
      break;
    }
    case 'testgeraet':
      if (!el.checked && S.upload.testAls) { S.upload.testAls = null; S.fern = {}; S.paket = null; S.pakete = null; S.abweichungen = {}; personaZuruecksetzen(S); }
      if (!el.checked) S.testFokus = null;
      S.upload.testgeraet = el.checked;
      feedbackKnopfZeigen();
      protokoll(S, 'testgeraet', { an: el.checked });
      sichern();
      zeigeEltern(el.checked ? 'Testgerät: Es werden keine Daten übertragen.' : 'Testgerät aus: Daten werden wieder übertragen (wenn eingerichtet).');
      break;
    case 'syncJetzt':
      if (S.upload.testgeraet) { zeigeEltern('Testgerät: Übertragung ist ausgeschaltet.'); break; }
      el.textContent = 'Wird übertragen …';
      syncen(true).then(n => zeigeEltern(S.upload.fehler ? S.upload.fehler : `Übertragen${n ? ` (${n} ${n === 1 ? 'Tag' : 'Tage'})` : ''}.`));
      break;
    case 'syncAus':
      S.upload = { ...S.upload, token: '', fehler: null };
      protokoll(S, 'upload_aus');
      sichern(); zeigeEltern('Übertragung ausgeschaltet. Der Schlüssel ist vom Handy gelöscht.'); break;
    case 'genStufe': {
      if (S.fern && S.fern.version > 0) break;
      const g = el.dataset.g;
      const st = S.genStufen[g] || (S.genStufen[g] = { stufe: 1, folge: 0 });
      st.stufe = Math.max(1, Math.min(3, st.stufe + Number(el.dataset.d))); st.folge = 0;
      protokoll(S, 'stufe_eltern', { generator: g, stufe: st.stufe }); sichern();
      zeigeEltern(`${GEN_NAMEN[g]}: Stufe ${st.stufe}`); break;
    }
    case 'import': importieren(); break;
    case 'extraLoeschen':
      oeffneModal(`<h2 class="modal-titel">Hinzugefügte Aufgaben entfernen?</h2><p>Die ${S.extraAufgaben.length} hinzugefügten Aufgaben werden gelöscht. Die eingebauten bleiben.</p><div class="knopf-reihe"><button class="btn btn-haupt" data-act="extraLoeschenJa">Entfernen</button><button class="btn" data-act="modalZu">Abbrechen</button></div>`);
      break;
    case 'extraLoeschenJa':
      protokoll(S, 'extra_geloescht', { anzahl: S.extraAufgaben.length });
      S.extraAufgaben = []; sichern(); schliesseModal(); zeigeEltern('Hinzugefügte Aufgaben entfernt.'); break;
  }
}
