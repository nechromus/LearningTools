// Bildschirme und Ablauf der Übungsapp.
import * as L from './logic.js';
import * as G from './gen.js';
import * as U from './sync.js';
import { esc, mathe, bruchHtml, bildSvg, hinweisIcon, hinweisBlatt, formatWert, sechseck } from './render.js';
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
import { spielstandAus, spielstandKern, spielstandAnwenden, istFrisch } from './store.js';
import { laden, speichern, protokoll, tagAktualisieren, dauerhaftSpeichernAnfragen, hatSpeicherFehler } from './store.js';

export const APP_VERSION = '2.4.0';

const S = laden();
// Wurde die App mitten in einer Aufgabe beendet? Dann wartet diese Aufgabe.
if (S.laufend) { if (!S.wartet) S.wartet = S.laufend; S.laufend = null; }
let HINWEISE = [], HMAP = {}, BASIS_AUFGABEN = [], BASIS_IDS = new Set();
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');

let ansicht = 'start';
let km = null;               // laufende Kristallmine (wird bei jedem Bildschirmwechsel beendet und gespeichert)
let ss = null;               // laufender Steinschieber (ebenso)
let rn = null;               // laufender Runenfall (ebenso)
let ms = null;               // laufendes Modul-Spiel { id, spiel } (Runenreihen, Höhlenkarte, Runenbrecher, Jadeschlange)
function setzeAnsicht(name) {
  if (km) { const k = km; km = null; k.beenden(); }
  if (ss) { const k = ss; ss = null; k.beenden(); }
  if (rn) { const k = rn; rn = null; k.beenden(); }
  if (ms) { const k = ms.spiel; ms = null; k.beenden(); }
  ansicht = name; document.body.dataset.ansicht = name;
}
let A = null;                // aktive Aufgabe
let modalSchliessen = null;  // Callback beim Schließen
let spielSitzung = null;     // { start, sekunden }
let versteckt = null;        // Zeitpunkt, an dem die App verlassen wurde


const R = () => L.spielzeitRegeln(S.spielzeit);
const minText = m => `${String(m).replace('.', ',')} ${m === 1 ? 'Minute' : 'Minuten'}`;
const alleAufgaben = () => [...BASIS_AUFGABEN, ...S.extraAufgaben];
const sichern = () => speichern(S);
// Runensplitter: kleiner leuchtender Jade-Splitter
const splitterSymbol = (size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" class="splitter-symbol"><polygon points="12,2 18,9 14,22 7,13" fill="#7ff2c6" stroke="#1E7A5F" stroke-width="1.4" stroke-linejoin="round"/><polygon points="12,2 14,22 7,13" fill="#3fbf92" opacity=".75"/><path d="M12 2 L13 12" stroke="#E9FFF6" stroke-width="1" opacity=".8"/></svg>`;
const zeitSymbol = (size = 22) => sechseck(size, '#F5E6C6', '#9A5B06', '<path d="M12 7v5l3 2" stroke="#633806" stroke-width="1.8" fill="none" stroke-linecap="round"/>');

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
  } catch (e) {
    $app.innerHTML = `<div class="screen"><div class="karte"><p>Die Aufgaben konnten nicht geladen werden. Schau, ob das Internet an ist, und öffne die App noch einmal.</p></div></div>`;
    return;
  }
  dauerhaftSpeichernAnfragen();
  updateEinrichten();
  document.addEventListener('click', klick);
  document.addEventListener('visibilitychange', sichtbarkeit);
  document.addEventListener('keydown', taste);
  setInterval(spielTick, 1000);
  setInterval(() => { if (ansicht === 'start') zeigeStart(); }, 30000);
  // Einrichtungs-Link aus dem QR-Code (Kamera-App) geöffnet?
  const ausLinkRoh = einrichtungLesen(location.hash);
  const ausLink = ausLinkRoh && ausLinkRoh.art !== 'eltern' ? ausLinkRoh : null;
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
          if (d && d.art === 'eltern') { if (info()) info().textContent = 'Das ist ein Code für die Eltern-App, nicht für dieses Handy.'; }
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
    genStufen: S.genStufen, spielzeit: R(), splitter: splitterKurz(), paket: S.paket, gewichte: gewichte(), fern: S.fern, statistik: S.statistik, zusammenfassung7Tage: zusammenfassung(7), letzterExport: S.letzterExport
  };
}

// Ordnername aus dem Namen: Kleinbuchstaben, Umlaute ausgeschrieben, nur a–z, 0–9 und Bindestrich
export function nutzerOrdner(name = S.einstellungen.name) {
  const o = (name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return o || 'ohne-namen';
}

// Einstellungen aus der Eltern-App holen (daten/<name>/einstellungen.json)
let fernLaeuft = false, fernZuletzt = 0;
async function fernHolen(erzwingen = false) {
  const u = S.upload;
  if (!S.einstellungen.name || !u.repo || !u.token || fernLaeuft) return null;
  if (!erzwingen && Date.now() - fernZuletzt < 2 * 60 * 1000) return null;
  fernLaeuft = true; fernZuletzt = Date.now();
  let geaendert = null;
  try {
    const datei = await U.dateiLesen(u, `daten/${nutzerOrdner()}/einstellungen.json`);
    S.fern = { ...S.fern, geholt: new Date().toISOString(), fehler: null };
    geaendert = L.fernAnwenden(S, datei);
    if (geaendert) protokoll(S, 'fern_einstellungen', { version: S.fern.version, geaendert });
  } catch (e) {
    S.fern = { ...S.fern, fehler: e.message || 'Unbekannter Fehler' };
  } finally {
    fernLaeuft = false;
    sichern();
  }
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
  if (!S.einstellungen.name || u.testgeraet || !u.repo || !u.token) return false;
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
  if (!S.einstellungen.name || u.testgeraet || !u.repo || !u.token || standLaeuft || u.standWartet) return false;
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

async function syncen(erzwingen = false) {
  const u = S.upload;
  // Neue Einstellungen übernommen? Dann gleich den Stand melden, damit die Eltern-App es sieht.
  if (await fernHolen(erzwingen)) erzwingen = true;
  if (!S.einstellungen.name || u.testgeraet || !u.repo || !u.token) return null;
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
      <button class="btn btn-amber-rand weiter-spiel" data-act="zumSpiel">${spielBild(id, 40)}<span><span class="klein">Weiter mit</span><b>${esc(spielName(id)).replace('Kristallmine', 'Kristall&shy;mine').replace('Steinschieber', 'Stein&shy;schieber')}</b></span></button>
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
      ${spielBild(g.id)}<b>${esc(g.name)}</b><span class="klein">${zuletzt ? 'Zuletzt gespielt' : esc(info.text || '')}</span></button>`;
  }
  const istNaechstes = n && n.spiel.id === g.id;
  const preis = SP.preise(sp)[SP.NEUE_SPIELE.findIndex(x => x.id === g.id)];
  const test = offen ? `<button class="spiel-test" data-act="neuspiel" data-id="${g.id}">Test: jetzt spielen</button>` : '';
  if (istNaechstes) {
    const anteil = Math.min(100, Math.round(sp.stand / Math.max(1, preis) * 100));
    const bereit = n.fehlt === 0 && g.fertig;
    return `<div class="spiel-karte naechstes${bereit ? ' bereit' : ''}">
      <div class="naechstes-kopf">${spielBild(g.id, 52)}<div><span class="klein">Nächstes Spiel</span><b>${esc(g.name)}</b><span class="klein">${esc(info.text || '')}</span></div></div>
      <span class="balken" role="progressbar" aria-valuemin="0" aria-valuemax="${preis}" aria-valuenow="${Math.min(sp.stand, preis)}"><i style="width:${anteil}%"></i></span>
      <span class="klein">${bereit ? `Kostet ${preis} Runensplitter. Du hast genug!` : !g.fertig && n.fehlt === 0 ? 'Genug Splitter! Das Spiel ist noch in Arbeit.' : `Noch ${n.fehlt} Runensplitter · ${sp.stand} von ${preis}`}</span>
      ${bereit ? `<button class="btn btn-jade-hell" data-act="freischalten" data-id="${g.id}">Freischalten</button>` : ''}${test}
    </div>`;
  }
  return `<div class="spiel-karte zu">
    <span class="schloss-bild">${spielBild(g.id)}</span><b>${esc(g.name)}</b>
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
  <div class="screen spiele-seite">
    <header class="topbar"><button class="btn-text" data-act="start">← Zurück</button><b class="spiele-titel">Spiele</b>
      <button class="splitter-chip dunkel" data-act="erfolge" aria-label="Runensplitter und Erfolge">${splitterSymbol(22)}<b>${sp.stand}</b></button></header>
    <div class="spiele-uhr">${zeitSymbol(22)} <b>${L.formatZeit(S.guthaben)}</b> Spielzeit</div>
    <h2 class="spiele-abschnitt">Deine Spiele</h2>
    <div class="spiele-gitter">${offen.map(g => spielKarte(g, sp, n)).join('')}</div>
    ${gesperrt.length ? `<h2 class="spiele-abschnitt">Noch zu entdecken</h2>
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

function zeigeStart() {
  if (!S.einstellungen.name) return zeigeAnmeldung();
  setzeAnsicht('start');
  if (neuLadenGeplant) { neuLadenWennRuhig(); return; }
  if (S.upload.standWartet) standAbgleich(true).catch(() => {});
  syncen();
  tagAktualisieren(S);
  const slot = R().basisMin > 0 ? L.basisSlotJetzt(new Date(), S.einstellungen, S.basisSlot) : null;
  const name = S.einstellungen.name ? `, ${esc(S.einstellungen.name)}` : '';
  const serieAktiv = S.serie.pos > 0 && Date.now() - S.serie.letzteAktivitaet < 20 * 60 * 1000;
  $app.innerHTML = `
  <div class="screen start">
    <header class="start-kopf">
      <div class="logo" id="logo" title="">${sechseck(56, '#DCEDED', '#1F6F75', '<text x="12" y="12.6" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, serif" font-weight="700" font-size="6" fill="#0E4A4F">2048</text>')}</div>
      <div><h1>Schrein der Zahlen</h1><p class="gedaempft">Hallo${name}!</p></div>
    </header>

    <section class="guthaben-karte">
      ${zeitSymbol(44)}
      <div><div class="guthaben-zahl">${L.formatZeit(S.guthaben)}</div><div class="gedaempft">Spielzeit</div></div>
      <button class="splitter-chip" data-act="erfolge" aria-label="Runensplitter und Erfolge">${splitterSymbol(26)}<b>${SP.splitterVon(S.splitter).stand}</b></button>
    </section>

    ${slot ? `
    <section class="basis-karte">
      <div><b>${minText(R().basisMin)} Spielzeit sind da!</b><div class="gedaempft">Jede Stunde gibt es ${minText(R().basisMin)} geschenkt.</div></div>
      <button class="btn btn-amber" data-act="basis">Abholen</button>
    </section>` : ''}

    <button class="btn btn-haupt btn-gross" data-act="aufgaben">${S.wartet ? 'Weiter mit deiner Aufgabe' : 'Aufgaben machen'}</button>
    ${spieleStartHtml()}

    <section class="info-karte">
      <div class="info-zeile"><span>Heute geschafft</span><b>${S.tag.aufgaben} ${S.tag.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}</b></div>
      <div class="info-zeile"><span>Heute verdient</span><b>${L.formatMinuten(S.tag.verdient)}</b></div>
      ${serieAktiv ? `<div class="info-zeile"><span>Deine Serie</span><b>${S.serie.pos} am Stück</b></div>` : ''}
    </section>

    <section class="regel-karte">
      <div class="regel-titel">So bekommst du Spielzeit</div>
      <div class="stufen">
        ${R().staffel.map((m, k) => `<div><b>${String(m).replace('.', ',')}</b> Min.<span>${['Aufg. 1–3', 'Aufg. 4–6', 'Aufg. 7–9', 'ab Aufg. 10'][k]}</span></div>`).join('')}
      </div>
      <p class="gedaempft klein">Pro richtige Aufgabe. Je mehr am Stück, desto mehr Zeit. Die Serie endet, wenn du spielst oder 20 Minuten Pause machst.</p>
    </section>
    <p class="version-zeile">Version ${APP_VERSION}</p>
    ${hatSpeicherFehler() ? '<p class="warnung">Der Speicher ist voll oder gesperrt. Bitte einem Erwachsenen Bescheid geben.</p>' : ''}
  </div>`;
  langDruecken(document.getElementById('logo'), elternZugang);
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

function teileVon(a) {
  const merk = (a.gegeben || []).map(g => ({ art: 'zahl', merk: true, label: `${g.name} =`, ziel: { wert: g.wert }, einheit: g.einheit || '' }));
  return [...merk, ...hauptTeile(a)];
}

function hauptTeile(a) {
  switch (a.typ) {
    case 'zahl': return [{ art: 'zahl', ziel: { wert: a.antwort.wert }, einheit: a.antwort.einheit || '' }];
    case 'bruch': return [{ art: 'bruch', antwort: a.antwort }];
    case 'auswahl': {
      const werte = a.optionen.map(L.potenzWert);
      const teile = [];
      // Gegen Raten: erst die Werte ausrechnen, dann wählen
      if (werte.every(Boolean)) a.optionen.forEach((o, i) => teile.push({ art: 'zahl', label: `${o} =`, ziel: { wert: werte[i].wert }, einheit: '', rechnung: o }));
      teile.push({ art: 'wahl', label: a.frage, optionen: a.optionen, richtig: a.antwort.richtig });
      return teile;
    }
    case 'schritte': return a.schritte.map(s => s.optionen
      ? { art: 'wahl', label: s.text, optionen: s.optionen, richtig: s.richtig, quelle: s }
      : { art: 'zahl', label: s.text, ziel: { wert: s.wert, toleranz: s.toleranz, runden: s.runden }, einheit: s.einheit || '', quelle: s });
    case 'mehrfrage': return a.fragen.map(q => ({ art: 'zahl', label: q.frage, ziel: { wert: q.wert }, einheit: q.einheit || '', bonus: !!q.bonus, quelle: q, rechnung: /\s=$/.test(q.frage) ? q.frage.replace(/\s=$/, '') : undefined }));
    case 'zuordnung': return [{ art: 'zuordnung' }];
  }
  return [];
}

const MUSTER = ['leicht', 'thema', 'thema', 'text', 'mix', 'thema', 'struktur', 'mix', 'thema', 'abschluss'];
const wahl = arr => arr[Math.floor(Math.random() * arr.length)];
const genStufe = g => (S.genStufen[g] || { stufe: 1 }).stufe;

function fokusOptionen() {
  const n = S.log.slice(-300).filter(e => e.typ === 'versuch' && e.fehler === 'vorzeichen').length;
  return n >= 2 ? { fokus: 'vorzeichen' } : {};
}

function erzeuge(g, stufe, opts = {}) {
  const letzte = S.verlauf.letzteIds.slice(-15);
  let a;
  for (let i = 0; i < 8; i++) {
    a = G.GENERATOREN[g](stufe, Math.random, opts);
    if (a && !letzte.includes(a.id)) break;
  }
  return a;
}

// Gewichte der Themen: aus dem Paket der Eltern-App, sonst Übungsthema auf „viel“
const gewichte = () => (S.paket && S.paket.gewichte) ? P.gewichteNorm(S.paket.gewichte) : P.gewichteOhnePaket(S.einstellungen.thema);

function kurzeAufgabe(g, fokus, { leicht = false } = {}) {
  const thema = P.kopfThema(g, Math.random, S.verlauf.kopfZuletzt);
  if (!thema) return null;
  S.verlauf.kopfZuletzt = thema;
  if (leicht && P.BLOCK_GEN[thema] && Math.random() < 0.4) return G.block(P.BLOCK_GEN[thema], Math.random);
  if (!leicht && Math.random() < 0.15) {
    const p = L.waehleAufgabe(alleAufgaben(), { kategorie: 'thema', thema, statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key });
    if (p && p.thema === thema && !p.geschichte && !p.bonus) return p;
  }
  const gen = wahl(P.KOPF_GEN[thema]);
  return erzeuge(gen, leicht ? 1 : genStufe(gen), fokus);
}

function waehleAufgabe(kategorie) {
  const g = gewichte();
  const faellig = S.wiederholen.find(w => w.ab <= S.verlauf.zaehler && (g[w.aufgabe.thema] || 0) > 0);
  if (faellig && kategorie !== 'abschluss') {
    S.wiederholen = S.wiederholen.filter(w => w !== faellig);
    return { aufgabe: faellig.aufgabe, wdh: faellig.wdh };
  }
  // Nur Aufgaben aus Themen, die im Paket an sind
  const pool = alleAufgaben().filter(a => (g[a.thema] || 0) > 0);
  const ausPool = (k, thema) => {
    const a = L.waehleAufgabe(pool, { kategorie: k, thema, statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key });
    return a && L.passtKategorie(a, k, thema) && (g[a.thema] || 0) > 0 ? a : null;
  };
  const poolGewicht = (k) => {
    const passend = pool.filter(a => L.passtKategorie(a, k));
    return passend.length ? Math.max(...passend.map(a => g[a.thema])) : 0;
  };
  const fokus = fokusOptionen();
  let a = null;
  switch (kategorie) {
    case 'leicht': a = kurzeAufgabe(g, fokus, { leicht: true }); break;
    case 'thema':
    case 'mix': a = kurzeAufgabe(g, fokus); break;
    case 'text': {
      const o = P.ziehe([
        { w: poolGewicht('text'), art: 'pool' },
        { w: g['minus-zahlen'], art: 'geld-geschichte' },
        { w: Math.max(g.rabatt, g['neuer-preis']), art: 'rabatt-geschichte' }
      ]);
      if (o && o.art === 'pool') a = ausPool('text');
      else if (o) a = erzeuge(o.art, genStufe(o.art), fokus);
      break;
    }
    case 'struktur': {
      const o = P.ziehe([
        { w: poolGewicht('struktur'), art: 'pool' },
        { w: g['prozent-baukasten'], art: 'baukasten' },
        { w: g['bruch-bild'], art: 'bruch-bild' }
      ]);
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
          { w: g.runden, art: 'runden' }
        ]);
        if (o && o.art === 'pool') a = ausPool('abschluss');
        else if (o) a = erzeuge(o.art, genStufe(o.art));
      }
      break;
    }
  }
  if (!a) a = kurzeAufgabe(g, fokus);
  if (!a) { const rest = pool.filter(x => !x.bonus); a = rest.length ? L.waehleAufgabe(rest, { kategorie: 'alle', statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key }) : null; }
  if (!a) a = erzeuge('einmaleins', 1);
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
  const startInfo = { id: aufgabe.id, thema: aufgabe.thema, stufe: aufgabe.stufe, aufgabenTyp: aufgabe.typ, kategorie: A.kategorie, serienPos: A.serienPos, bonus: !!aufgabe.bonus, wiederholung: A.wdh || 0, ...extra };
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
  if (!((gewichte()[w.aufgabe.thema] || 0) > 0)) return null;
  const neu = { ...w, start: Date.now(), phase: w.phase === 'tipp' ? 'tipp' : w.phase, meldung: null, fertig: false, rechnerOffen: false };
  if (neu.zuo) neu.zuo = { ...neu.zuo, falsch: new Set(neu.zuo.falsch || []) };
  neu.teile.forEach(t => { t.seit = Date.now(); });
  return neu;
}

function neueAufgabe() {
  tagAktualisieren(S);
  const alt = wartendeAufgabe();
  if (alt) {
    A = alt;
    A.serienPos = serieWeiter();
    A.wartete = true;
    protokoll(S, 'aufgabe_start', startInfoVon(A, { fortsetzung: true, teil: A.idx }));
    sichern();
    setzeAnsicht('aufgabe');
    zeigeAufgabe();
    return;
  }
  const kategorie = MUSTER[S.verlauf.musterIndex % MUSTER.length];
  const { aufgabe, wdh } = waehleAufgabe(kategorie);
  S.verlauf.musterIndex++;
  A = {
    aufgabe, kategorie, serienPos: serieWeiter(), start: Date.now(),
    teile: teileVon(aufgabe), idx: 0, phase: 'eingabe', hinweise: [], verlassen: 0, strafe: 'keine',
    fertig: false, meldung: null, feld: 'z', wdh
  };
  A.teile.forEach(t => { t.versuche = []; t.status = 'offen'; t.eingabe = ''; t.z = ''; t.n = ''; t.seit = Date.now(); });
  if (aufgabe.typ === 'zuordnung') zuordnungVorbereiten();
  protokoll(S, 'aufgabe_start', startInfoVon(A));
  S.verlauf.letzteIds = [...S.verlauf.letzteIds, aufgabe.id].slice(-20);
  sichern();
  setzeAnsicht('aufgabe');
  zeigeAufgabe();
}

function aktuellerTeil() { return A && A.teile[A.idx]; }

function zeigeAufgabe() {
  const a = A.aufgabe;
  const min = L.minutenFuerPosition(A.serienPos, R());
  const tz = String(min).replace('.', ',');
  const icons = (a.hinweise || []).filter(id => HMAP[id]).map(id =>
    `<button class="hw-btn${A.meldung && A.phase === 'tipp' ? ' pulsieren' : ''}" data-act="hinweis" data-id="${id}" aria-label="Hinweis ${esc(HMAP[id].titel)}">${hinweisIcon(HMAP[id], 42)}</button>`).join('');

  $app.innerHTML = `
  <div class="screen aufgabe-screen">
    <header class="topbar">
      <button class="btn-text" data-act="beenden">✕ Fertig</button>
      <div class="serie-chip">Aufgabe ${A.serienPos} · <b>${tz} Min.</b></div>
      <div class="zeit-chip">${zeitSymbol(18)}${L.formatZeit(S.guthaben)}</div>
    </header>
    <main class="aufgabe-inhalt">
      ${A.wartete && !A.fertig && A.teile.every(t => !t.versuche.length) ? '<p class="wartet-hinweis">Diese Aufgabe wartet noch auf dich.</p>' : ''}
      <article class="karte aufgabe${a.bonus ? ' bonus' : ''}">
        ${a.bonus ? `<div class="bonus-kopf"><span class="bonus-label">Bonus · freiwillig</span>${!A.fertig && A.teile.every(t => !t.versuche.length) ? '<button class="btn-text klein" data-act="ueberspringen">Überspringen</button>' : ''}</div>` : ''}
        ${a.geschichte ? `<p class="geschichte">${mathe(a.geschichte)}</p>` : ''}
        ${a.rechnung ? `<div class="rechnung">${mathe(a.rechnung)}</div>` : ''}
        ${a.bild ? `<div class="bild">${bildSvg(a.bild)}</div>` : ''}
        ${a.typ !== 'auswahl' ? `<p class="frage">${mathe(a.frage)}</p>` : ''}
        <div class="teile">${teileHtml()}</div>
        <div class="hw-leiste"><span class="gedaempft">Hinweis:</span>${icons}
          ${a.taschenrechner && !A.fertig ? '<button class="btn btn-klein btn-rechner" data-act="rechner">Taschenrechner</button>' : ''}
          ${hilfeKnopf()}
          ${rechnerAngeboten(a) && !A.fertig ? `<button class="btn btn-klein btn-rechner optional" data-act="rechnerOptional">${A.rechnerHalb || R().rechner >= 1 ? 'Taschenrechner' : R().rechner > 0 ? 'Taschenrechner · ½ Zeit' : 'Taschenrechner · keine Zeit'}</button>` : ''}
        </div>
      </article>
      ${A.meldung && A.phase === 'eingabe' ? `<div class="meldung">${esc(A.meldung)}</div>` : ''}
      ${A.fertig ? ergebnisHtml() : ''}
    </main>
    <footer class="eingabe-bereich">${fussHtml()}</footer>
  </div>`;
  const aktiv = document.querySelector('.teil.aktiv');
  if (aktiv && !A.fertig) aktiv.scrollIntoView({ block: 'nearest' });
}

function teileHtml() {
  const a = A.aufgabe;
  const haupt = A.teile.filter(t => !t.merk);
  const mehrteilig = haupt.length > 1;
  const block = (a.generator || '').startsWith('block');
  const versatz = A.teile.length - haupt.length;
  const html = A.teile.map((t, i) => {
    if (i > A.idx && !A.fertig) {
      if (block && !t.merk) return `<div class="teil block-teil zukunft"><div class="teil-label"><span>${mathe(t.label)}</span></div><button class="feld leer tippbar" data-act="springe" data-i="${i}" aria-label="Zu diesem Feld springen">?</button></div>`;
      if (!t.merk) return '';
    }
    const aktiv = i === A.idx && !A.fertig;
    const nr = mehrteilig && !t.merk && a.typ !== 'auswahl' && !block ? `<span class="teil-nr">${i + 1 - versatz}</span>` : '';
    const bonus = t.bonus ? '<span class="bonus-label klein">Bonus</span>' : '';
    let inhalt = '';
    if (t.art === 'zahl') {
      const label = t.label ? `<div class="teil-label">${nr}${bonus}<span>${mathe(t.label)}</span></div>` : '';
      if (aktiv) {
        inhalt = `${label}<div class="feld-zeile"><div class="feld aktiv-feld${t.eingabe ? '' : ' leer'}" aria-live="polite">${esc(t.eingabe.replace('-', '−')) || '?'}</div>${t.einheit ? `<span class="einheit">${esc(t.einheit)}</span>` : ''}</div>`;
      } else {
        const ok = t.versuche.find(v => v.richtig);
        const zeigen = ok ? `${ok.eingabe.replace('-', '−').replace('.', ',')}${t.einheit ? ' ' + t.einheit : ''}` : formatWert(t.ziel.wert, t.einheit);
        inhalt = `${label}<div class="feld-zeile">${erledigtWert(t, zeigen)}</div>`;
      }
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
    } else if (t.art === 'wahl') {
      const knoepfe = t.optionen.map((o, k) => {
        let kl = 'wahl-btn';
        if (!aktiv) { if (k === t.richtig) kl += ' wahl-richtig'; else if (t.gewaehlt === k) kl += ' wahl-falsch'; }
        return `<button class="${kl}" data-act="wahl" data-k="${k}" ${aktiv && A.phase === 'eingabe' ? '' : 'disabled'}>${mathe(o)}</button>`;
      }).join('');
      inhalt = `<div class="teil-label">${nr}<span><b>${mathe(t.label)}</b></span></div><div class="wahl-reihe">${knoepfe}</div>`;
    } else if (t.art === 'zuordnung') {
      inhalt = zuordnungHtml(aktiv);
    }
    let zusatz = '';
    if (aktiv && A.phase === 'tipp') zusatz = `<div class="tipp"><b>Noch nicht.</b> ${esc(t.tipp)}</div>`;
    if (aktiv && t.hilfe && A.phase !== 'tipp') zusatz += hilfeBox(t);
    if (i === A.idx && A.phase === 'aufgeloest') zusatz = `<div class="aufloesung">So ist es richtig: <b>${loesungText(t)}</b></div>`;
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

function loesungText(t) {
  if (t.art === 'zahl') return esc(formatWert(t.ziel.wert, t.einheit));
  if (t.art === 'bruch') return bruchHtml(t.antwort.zaehler, t.antwort.nenner);
  if (t.art === 'wahl') return mathe(t.optionen[t.richtig]);
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
    return `<div class="fuss-knoepfe">
      <button class="btn btn-haupt btn-gross" data-act="naechste">Nächste Aufgabe</button>
      <button class="btn btn-amber-rand" data-act="zumSpiel">Zum Spiel · ${L.formatZeit(S.guthaben)}</button>
    </div>`;
  }
  const t = aktuellerTeil();
  if (A.phase === 'tipp') return `<button class="btn btn-haupt btn-gross" data-act="verstanden">Verstanden</button>`;
  if (A.phase === 'aufgeloest') return `<button class="btn btn-haupt btn-gross" data-act="weiter">Weiter</button>`;
  if (A.rechnerOffen && A.rechner && t.art !== 'zuordnung') return rechnerPanelHtml(t);
  const aufklappen = A.rechner && !A.rechnerOffen ? '<button class="r-aufklappen" data-act="rAufklappen">Taschenrechner ▲</button>' : '';
  if (t.art === 'zahl' || t.art === 'bruch') {
    return `${aufklappen}${t.bonus ? '<button class="btn-text klein ueberspringen" data-act="teilUeberspringen">Bonus überspringen</button>' : ''}
    <div class="tastatur">
      ${['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', ','].map(k => `<button class="taste${k === '⌫' || k === '−' || k === ',' ? ' taste-sonder' : ''}" data-act="taste" data-k="${k}" ${t.art === 'bruch' && (k === '−' || k === ',') ? 'disabled' : ''} aria-label="${k === '⌫' ? 'Löschen' : k === '−' ? 'Minus' : k}">${k}</button>`).join('')}
      <button class="taste taste-null" data-act="taste" data-k="0">0</button>
      <button class="taste taste-ok" data-act="antwort">Antwort geben</button>
    </div>`;
  }
  if (t.art === 'zuordnung') return `<button class="btn btn-haupt btn-gross" data-act="antwort">Antwort geben</button>`;
  return aufklappen;
}

function ergebnisHtml() {
  const a = A.aufgabe;
  const sek = A.sekunden;
  let kopf;
  const nm = S.einstellungen.name ? `, ${esc(S.einstellungen.name)}` : '';
  if (A.ergebnis === 'erst') kopf = `<div class="erfolg-titel">${A.serienPos % 3 === 0 ? `Stark${nm}!` : `Richtig${nm}!`}</div>`;
  else if (A.ergebnis === 'zweit') kopf = `<div class="erfolg-titel">Geschafft – im 2. Versuch!</div>`;
  else kopf = `<div class="erfolg-titel neutral">Jetzt weißt du, wie es geht.</div><p>Die Aufgabe kommt später noch einmal.</p>`;
  const zeit = sek > 0 ? `<div class="zeit-gewinn">${zeitSymbol(28)} +${L.formatMinuten(sek)} Spielzeit</div>` : '';
  let strafe = '';

  if (A.rechnerHalb && A.ergebnis !== 'loesung' && R().rechner < 1) strafe += `<p class="gedaempft">Mit Taschenrechner gibt es ${L.anteilText(R().rechner)}.</p>`;
  if (A.hilfeGenutzt && A.ergebnis !== 'loesung' && hilfeAnteil() < 1) strafe += `<p class="gedaempft">Mit „Hilf mir“ gibt es ${L.anteilText(hilfeAnteil())}.</p>`;
  if (A.strafe === 'halb' && A.ergebnis !== 'loesung') strafe = '<p class="gedaempft">Du warst kurz außerhalb der App. Darum gibt es diesmal nur die Hälfte.</p>';
  if (A.strafe === 'null' && A.ergebnis !== 'loesung') strafe = '<p class="gedaempft">Du warst außerhalb der App. Bei Aufgaben ohne Taschenrechner gibt es dafür heute keine Spielzeit.</p>';
  if (A.splitter && A.splitter.length) {
    const n = A.splitter.reduce((x, e) => x + e.n, 0);
    const besondere = A.splitter.filter(e => !['aufgabe', 'erst'].includes(e.grund));
    strafe += `<div class="splitter-gewinn">${splitterSymbol(22)} +${n} Runensplitter${besondere.length ? `<span>${besondere.map(e => esc(e.text)).join(' · ')}</span>` : ''}</div>`;
  }
  const weg = `<div class="loesungsweg"><div class="lw-titel">So geht's</div>${(a.loesungsweg || []).map(z => `<div class="lw-zeile">${mathe(z)}</div>`).join('')}<p class="lw-erkl">${mathe(a.erklaerung || '')}</p></div>`;
  const offen = A.ergebnis === 'loesung';
  return `<section class="ergebnis-karte">${kopf}${zeit}${strafe}
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
  if (!t || t.merk || t.art === 'wahl' || t.art === 'zuordnung') return null;
  const haupt = A.teile.filter(x => !x.merk);
  const nr = haupt.indexOf(t);
  const anz = L.hilfeAnzeige(a.loesungsweg || [], haupt.length, nr, Math.max(1, (t.hilfe || 0) + 1));
  if (!anz.zeilen.length) return null;
  // Zeigt die Hilfe nur die Rechnung, die schon dasteht? Dann hilft sie nicht.
  const rechnung = t.rechnung || (haupt.length === 1 ? a.rechnung : null);
  if (anz.zeilen.length === 1 && rechnung && normal(anz.zeilen[0]) === normal(rechnung)) return null;
  return anz;
}

function hilfeKnopf() {
  if (!A || A.fertig || A.phase !== 'eingabe') return '';
  const t = aktuellerTeil();
  if (!t) return '';
  if (t.hilfe) {
    // weiterer Schritt nur, wenn es noch einen gibt
    const haupt = A.teile.filter(x => !x.merk);
    if (!L.hilfeAnzeige(A.aufgabe.loesungsweg || [], haupt.length, haupt.indexOf(t), t.hilfe).mehr) return '';
  } else if (!hilfeDaten(t)) return '';
  const kosten = A.hilfeGenutzt || hilfeAnteil() >= 1 ? '' : hilfeAnteil() > 0 ? ' · ½ Zeit' : ' · keine Zeit';
  return `<button class="btn btn-klein btn-hilfe" data-act="hilfe">${t.hilfe ? 'Noch ein Schritt' : 'Hilf mir'}${kosten}</button>`;
}

function hilfeBox(t) {
  const haupt = A.teile.filter(x => !x.merk);
  const anz = L.hilfeAnzeige(A.aufgabe.loesungsweg || [], haupt.length, haupt.indexOf(t), t.hilfe);
  if (!anz.zeilen.length) return '';
  return `<div class="hilfe-box"><div class="hilfe-titel">So fängst du an</div>${anz.zeilen.map(z => `<div class="hilfe-zeile">${mathe(z)}</div>`).join('')}<p class="hilfe-text">Rechne das <b>?</b> aus.</p></div>`;
}

function hilfeZeigen() {
  const t = aktuellerTeil();
  if (!t || A.phase !== 'eingabe' || !hilfeKnopf()) return;
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
  let e = t.eingabe;
  if (k === '⌫') e = e.slice(0, -1);
  else if (k === '−') e = e.startsWith('-') ? e.slice(1) : '-' + e;
  else if (k === ',') { if (!e.includes(',')) e = (e === '' || e === '-' ? e + '0' : e) + ','; }
  else if (e.replace(/[-,]/g, '').length < 9) e += k;
  t.eingabe = e;
  zeigeAufgabe();
}

function antwortGeben() {
  const t = aktuellerTeil();
  if (!t || A.phase !== 'eingabe') return;
  const a = A.aufgabe;
  if (t.art === 'zuordnung') return zuordnungAntwort();
  let eingabe, richtig, fehler = null;
  if (t.art === 'zahl') {
    const p = L.parseZahl(t.eingabe);
    if (!p.ok) { A.meldung = 'Tippe zuerst eine Zahl ein.'; return zeigeAufgabe(); }
    eingabe = t.eingabe.replace(',', '.');
    richtig = L.pruefeZahl(t.eingabe, t.ziel);
    if (!richtig) {
      if (t.merk) fehler = { typ: 'merk', text: 'Lies noch einmal im Text nach. Welche Zahl gehört dazu?' };
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
  }
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
    hinweiseOffen: A.hinweise.slice()
  });
  t.seit = Date.now();
  if (richtig) {
    t.status = t.versuche.length === 1 ? 'erst' : 'zweit';
    return naechsterTeil();
  }
  const maxVersuche = t.art === 'wahl' ? 1 : 2;
  if (t.versuche.length < maxVersuche) {
    t.tipp = fehler ? fehler.text : 'Schau dir den Hinweis an und rechne noch einmal.';
    A.phase = 'tipp';
    A.meldung = t.tipp;
    t.eingabe = ''; t.z = ''; t.n = '';
  } else {
    t.status = 'loesung';
    A.phase = 'aufgeloest';
    protokoll(S, 'loesung_gezeigt', { id: a.id, teil: A.idx });
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
  sichern();
  zeigeAufgabe();
}

function abschliessen() {
  const a = A.aufgabe;
  const pflicht = A.teile.filter(t => !t.bonus && !t.merk);
  let ergebnis = 'erst';
  if (pflicht.some(t => t.status === 'loesung')) ergebnis = 'loesung';
  else if (pflicht.some(t => t.status === 'zweit')) ergebnis = 'zweit';
  const sek = L.sekundenFuerAufgabe({ ergebnis, serienPos: A.serienPos, strafe: A.strafe, rechnerHalb: !!A.rechnerHalb, hilfe: !!A.hilfeGenutzt, regeln: R() });
  S.laufend = null;
  let stufeHoch = null;
  A.ergebnis = ergebnis; A.sekunden = sek; A.fertig = true; A.idx = A.teile.length - 1; A.phase = 'eingabe';
  S.guthaben += sek;
  tagAktualisieren(S);
  S.tag.aufgaben++;
  if (ergebnis === 'erst') S.tag.ersterVersuch++;
  S.tag.verdient += sek;
  if (!a.generator) {
    const st = S.statistik[a.id] || (S.statistik[a.id] = { gesehen: 0 });
    st.gesehen++; st.zuletzt = S.verlauf.zaehler; st.letztesErgebnis = ergebnis; st.letzterTag = S.tag.key;
  } else {
    const g = a.generator;
    if (!a.bonus && !g.startsWith('block') && G.GENERATOREN[g]) {
      const st = S.genStufen[g] || (S.genStufen[g] = { stufe: 1, folge: 0 });
      if (ergebnis === 'erst' && A.hilfeGenutzt) st.folge = 0; // mit „Hilf mir“: Stufe bleibt
      else if (ergebnis === 'erst') { st.folge++; if (st.folge >= 3 && st.stufe < 3) { st.stufe++; st.folge = 0; stufeHoch = { generator: g, stufe: st.stufe }; protokoll(S, 'stufe', { generator: g, stufe: st.stufe }); } }
      else if (ergebnis === 'zweit') st.folge = 0;
      else { if (st.stufe > 1) { st.stufe--; protokoll(S, 'stufe', { generator: g, stufe: st.stufe }); } st.folge = 0; }
    }
    if (ergebnis === 'loesung' && (A.wdh || 0) < 2) S.wiederholen = [...S.wiederholen, { ab: S.verlauf.zaehler + 3, aufgabe: a, wdh: (A.wdh || 0) + 1 }].slice(-10);
  }
  S.verlauf.zaehler++;
  S.verlauf.themaZuletzt[a.thema] = { ergebnis, stufe: a.stufe };
  S.serie.letzteAktivitaet = Date.now();
  protokoll(S, 'aufgabe_ende', {
    id: a.id, thema: a.thema, stufe: a.stufe, ergebnis, sekunden: sek, serienPos: A.serienPos,
    strafe: A.strafe, rechnerOptional: !!A.rechnerHalb, hilfe: !!A.hilfeGenutzt, verlassen: A.verlassen, ms: Date.now() - A.start, hinweise: A.hinweise.slice(),
    bonusTeile: A.teile.filter(t => t.bonus).map(t => t.status), merkTeile: A.teile.filter(t => t.merk).map(t => t.status),
    generator: a.generator || null
  });
  // Runensplitter für diese Aufgabe
  S.splitter = SP.splitterVon(S.splitter);
  A.splitter = SP.nachAufgabe(S.splitter, {
    ergebnis, wiederholung: (A.wdh || 0) > 0, wartete: !!A.wartete, tagAufgaben: S.tag.aufgaben, heute: S.tag.key,
    stufeHoch: !!stufeHoch, stufeNeu: stufeHoch ? stufeHoch.stufe : 0, generator: stufeHoch ? stufeHoch.generator : null
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
    A.phase = 'tipp'; A.meldung = t.tipp;
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

function hinweisOeffnen(id) {
  const h = HMAP[id];
  if (!h) return;
  if (A && ansicht === 'aufgabe' && !A.hinweise.includes(id)) A.hinweise.push(id);
  protokoll(S, 'hinweis', { hinweis: id, id: A && ansicht === 'aufgabe' ? A.aufgabe.id : null });
  sichern();
  oeffneModal(`<div class="hinweis-blatt">${hinweisBlatt(h)}</div>`);
}

function rechnerAngeboten(a) { return L.rechnerOptional(a) && S.einstellungen.rechnerAngebot !== false; }

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
    return;
  }
  const dauer = versteckt ? Date.now() - versteckt : 0;
  versteckt = null;
  updatePruefen();
  syncen();
  tagAktualisieren(S);
  if (ansicht === 'aufgabe' && A && !A.fertig && !A.aufgabe.taschenrechner && dauer >= 3000) {
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
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="neuesSpiel">Neu</button><button class="btn-text klein" data-act="spielauswahl">Spiele</button></span>
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
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="runenfeldNeu">Neu</button><button class="btn-text klein" data-act="spielauswahl">Spiele</button></span>
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
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button></span>
    </header>
    <div class="km-huelle" id="km-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  km = kristallmineStarten($id('km-huelle'), {
    stand: S.kristallmine,
    sichern: (st) => { S.kristallmine = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: () => S.guthaben > 0 && ansicht === 'spiel' && !document.querySelector('#spiel-overlay .overlay')
  });
  overlayPruefen();
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
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button></span>
    </header>
    <div class="km-huelle" id="ss-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  ss = steinschieberStarten($id('ss-huelle'), {
    stand: S.steinschieber,
    sichern: (st) => { S.steinschieber = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: () => S.guthaben > 0 && ansicht === 'spiel' && !document.querySelector('#spiel-overlay .overlay')
  });
  overlayPruefen();
}

// ---------- Runenfall (zweites freischaltbares Spiel, Logik in runenfall.js / runenfall-ui.js) ----------

// ---------- Weitere freischaltbare Spiele als Bausteine (gleiche Schnittstelle: starten, beenden, anhalten, stand, ruht) ----------

const MODUL_SPIELE = {
  runenreihen: { starten: runenreihenStarten, feld: 'runenreihen', ende: (k) => ({ punkte: k.punkte || 0, stufe: k.stufe || 1, zuege: k.zuege || 0, rekord: k.rekord || 0 }) },
  hoehlenkarte: { starten: hoehlenkarteStarten, feld: 'hoehlenkarte', ende: (k) => ({ groesse: k.groesse || null, offen: Array.isArray(k.offen) ? k.offen.filter(Boolean).length : (k.offen || 0), zurueck: k.zurueck || 0, tipps: k.tipps || 0 }) },
  runenbrecher: { starten: runenbrecherStarten, feld: 'runenbrecher', ende: (k) => ({ punkte: k.punkte || 0, level: (k.level || 0) + 1, hoechstes: (k.hoechstes || 0) + 1 }) },
  jadeschlange: { starten: jadeschlangeStarten, feld: 'jadeschlange', ende: (k) => ({ punkte: k.punkte || 0, laenge: Array.isArray(k.schlange) ? k.schlange.length : (k.laenge || 0), stufe: k.stufe || 1, kristalle: k.kristalle || 0, rekord: k.rekord || 0 }) }
};

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
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button></span>
    </header>
    <div class="km-huelle" id="modul-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  ms = { id, spiel: m.starten($id('modul-huelle'), {
    stand: S[m.feld],
    sichern: (st) => { S[m.feld] = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: () => S.guthaben > 0 && ansicht === 'spiel' && !document.querySelector('#spiel-overlay .overlay')
  }) };
  overlayPruefen();
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
      <span class="spiel-knoepfe"><button class="btn-text klein" data-act="spielauswahl">Spiele</button></span>
    </header>
    <div class="km-huelle" id="rn-huelle"></div>
    <div class="km-overlay" id="spiel-overlay"></div>
  </div>`;
  rn = runenfallStarten($id('rn-huelle'), {
    stand: S.runenfall,
    sichern: (st) => { S.runenfall = st; sichern(); },
    melden: (typ, daten) => { protokoll(S, typ, daten); sichern(); },
    darfLaufen: () => S.guthaben > 0 && ansicht === 'spiel' && !document.querySelector('#spiel-overlay .overlay')
  });
  overlayPruefen();
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
  let aufgaben = 0, erst = 0, loesung = 0, verlassen = 0, hinweise = 0, spielSek = 0, rechnerNutzung = 0, schnell = 0;
  const fehler = {};
  for (const e of S.log) {
    if (new Date(e.t).getTime() < grenze) continue;
    const th = e.thema && (proThema[e.thema] || (proThema[e.thema] = { aufgaben: 0, erst: 0, zweit: 0, loesung: 0, hinweise: 0 }));
    if (e.typ === 'aufgabe_ende') {
      aufgaben++; th.aufgaben++; th[e.ergebnis]++;
      if (e.ergebnis === 'erst') erst++;
      if (e.ergebnis === 'loesung') loesung++;
      if (e.hinweise && e.hinweise.length) th.hinweise++;
    }
    if (e.typ === 'versuch' && e.fehler) fehler[e.fehler] = (fehler[e.fehler] || 0) + 1;
    if (e.typ === 'versuch' && e.schnell && !e.richtig) schnell++;
    if (e.typ === 'verlassen') verlassen++;
    if (e.typ === 'hinweis') hinweise++;
    if (e.typ === 'spiel_ende') spielSek += e.sekunden || 0;
    if (e.typ === 'rechner') rechnerNutzung++;
  }
  return { tage, aufgaben, erst, loesung, verlassen, hinweise, spielSek, rechnerNutzung, schnellFalsch: schnell, fehler, proThema };
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
    `<li><span class="erg erg-${e.ergebnis}">${e.ergebnis === 'erst' ? '1. Versuch' : e.ergebnis === 'zweit' ? '2. Versuch' : 'Lösungsweg'}</span> ${esc(THEMA_NAMEN[e.thema] || e.thema)} · ${esc(e.id)}${e.verlassen ? ' · App verlassen' : ''}</li>`).join('');
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
      ${S.paket ? `<div class="info-zeile"><span>Aufgabenpaket</span><b>${esc(S.paket.name)}</b></div>
      <div class="info-zeile"><span>Mehr üben</span><b>${esc(Object.entries(gewichte()).filter(([, v]) => v === 4).map(([t]) => THEMA_NAMEN[t]).join(', ') || '–')}</b></div>
      <div class="info-zeile"><span>Aus</span><b>${esc(Object.entries(gewichte()).filter(([, v]) => v === 0).map(([t]) => THEMA_NAMEN[t]).join(', ') || '–')}</b></div>`
      : `<div class="info-zeile"><span>Übungsthema</span><b>${esc(THEMA_NAMEN[S.einstellungen.thema] || S.einstellungen.thema)}</b></div>`}
      <div class="info-zeile"><span>Geschenkte Spielzeit</span><b>${S.einstellungen.basisVon} bis ${S.einstellungen.basisBis} Uhr · ${minText(R().basisMin)}</b></div>
      <div class="info-zeile"><span>Spielzeit pro Aufgabe</span><b>${R().staffel.map(m => String(m).replace('.', ',')).join(' / ')} Min.</b></div>
      <div class="info-zeile"><span>2. Versuch / mit Rechner</span><b>${L.anteilText(R().zweit).replace('die ', '')} / ${L.anteilText(R().rechner).replace('die ', '')}</b></div>
      <div class="info-zeile"><span>Mit „Hilf mir“</span><b>${L.anteilText(R().hilfe ?? 0.5).replace('die ', '')}</b></div>
      <div class="info-zeile"><span>Freiwilliger Taschenrechner</span><b>${S.einstellungen.rechnerAngebot !== false ? 'an' : 'aus'}</b></div>
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

function oeffneModal(html, beimSchliessen = null) {
  modalSchliessen = beimSchliessen;
  $modal.innerHTML = `<div class="modal-hinter" data-act="modalZu"></div><div class="modal-box" role="dialog" aria-modal="true"><button class="modal-x" data-act="modalZu" aria-label="Schließen">✕</button>${html}</div>`;
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
      neueAufgabe(); break;
    case 'spielen':
      zeigeSpiel(); break;
    case 'zumSpiel':
      spielStarten(letztesOffenes());
      break;
    case 'kristallmine':
      zeigeKristallmine(); break;
    case 'erfolge': erfolgeZurueck = ansicht === 'spiele' ? 'spielauswahl' : 'start'; if (ansicht === 'spiel') spielBeenden(); zeigeErfolge(); break;
    case 'spielauswahl': zeigeSpieleSeite(); break;
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
      if (A && !A.fertig) {
        const ohneEingabe = A.teile.every(t => !t.versuche.length);
        protokoll(S, 'aufgabe_abgebrochen', { id: A.aufgabe.id, teil: A.idx, ms: Date.now() - A.start, ohneEingabe, thema: A.aufgabe.thema, wartet: !A.aufgabe.bonus });
        // Freiwillige Bonus-Aufgaben dürfen weg. Alle anderen warten, bis sie gelöst sind.
        if (!A.aufgabe.bonus) S.wartet = aufgabeSchnappschuss();
        // Die verlassene Aufgabe zählt nicht für die Serie
        S.serie.pos = Math.max(0, S.serie.pos - 1);
      }
      S.laufend = null;
      A = null; sichern(); zeigeStart(); break;
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
    case 'feld': A.feld = el.dataset.feld; zeigeAufgabe(); break;
    case 'antwort': antwortGeben(); break;
    case 'springe': springeZu(Number(el.dataset.i)); break;
    case 'wahl': {
      const t = aktuellerTeil();
      if (!t || A.phase !== 'eingabe') break;
      const k = Number(el.dataset.k);
      t.gewaehlt = k;
      versuchMerken(t, String(k), k === t.richtig, null);
      break;
    }
    case 'verstanden':
      protokoll(S, 'tipp_bestaetigt', { id: A.aufgabe.id, teil: A.idx });
      A.phase = 'eingabe'; A.meldung = null; zeigeAufgabe(); break;
    case 'weiter': naechsterTeil(); break;
    case 'hinweis': hinweisOeffnen(el.dataset.id); break;
    case 'rechner': rechnerOeffnen(); break;
    case 'rechnerOptional':
      if (A.rechnerHalb) { rechnerOeffnen(); break; }
      oeffneModal(`<div class="hinweis-text"><h2 class="modal-titel">Taschenrechner nutzen?</h2>
        <p>Hier sind die Zahlen groß. Du darfst den Taschenrechner nehmen.</p>
        ${R().rechner >= 1 ? '<p>Die Spielzeit bleibt gleich.</p>' : `<p><b>Dann gibt es für diese Aufgabe ${L.anteilText(R().rechner)}.</b></p>
        <p>Selbst rechnen bringt die volle Zeit.</p>`}
        <div class="knopf-reihe"><button class="btn btn-haupt" data-act="rechnerJa">Ja, mit Rechner</button><button class="btn" data-act="modalZu">Ich rechne selbst</button></div></div>`);
      protokoll(S, 'rechner_angeboten', { id: A.aufgabe.id });
      break;
    case 'hilfe': hilfeZeigen(); break;
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
      if (!d || d.art === 'eltern') { const i = document.getElementById('scan-info'); if (i) i.textContent = 'Der Link ist nicht richtig. Bitte den ganzen Link aus der Eltern-App einfügen.'; break; }
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
    case 'testgeraet':
      S.upload.testgeraet = el.checked;
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
