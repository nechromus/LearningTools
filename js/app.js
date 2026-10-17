// Bildschirme und Ablauf der Übungsapp.
import * as L from './logic.js';
import * as G from './gen.js';
import * as U from './sync.js';
import { esc, mathe, bruchHtml, bildSvg, hinweisIcon, hinweisBlatt, formatWert, sechseck } from './render.js';
import { THEMA_NAMEN, GEN_NAMEN, FEHLER_NAMEN } from './namen.js';
import { laden, speichern, protokoll, tagAktualisieren, dauerhaftSpeichernAnfragen, hatSpeicherFehler } from './store.js';

export const APP_VERSION = '1.4.0';

const S = laden();
let HINWEISE = [], HMAP = {}, BASIS_AUFGABEN = [], BASIS_IDS = new Set();
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');

let ansicht = 'start';
function setzeAnsicht(name) { ansicht = name; document.body.dataset.ansicht = name; }
let A = null;                // aktive Aufgabe
let modalSchliessen = null;  // Callback beim Schließen
let spielSitzung = null;     // { start, sekunden }
let versteckt = null;        // Zeitpunkt, an dem die App verlassen wurde


const R = () => L.spielzeitRegeln(S.spielzeit);
const minText = m => `${String(m).replace('.', ',')} ${m === 1 ? 'Minute' : 'Minuten'}`;
const alleAufgaben = () => [...BASIS_AUFGABEN, ...S.extraAufgaben];
const sichern = () => speichern(S);
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
  zeigeStart();
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

function standDaten() {
  const { pin, ...einstellungen } = S.einstellungen;
  return {
    app: 'lernapp-2048', version: APP_VERSION, nutzer: S.einstellungen.name, geraetId: S.geraetId, stand: new Date().toISOString(),
    einstellungen, guthaben: S.guthaben, spiel: { punkte: S.spiel.punkte, rekord: S.spiel.rekord, maxKachel: S.spiel.maxKachel },
    genStufen: S.genStufen, spielzeit: R(), fern: S.fern, statistik: S.statistik, zusammenfassung7Tage: zusammenfassung(7), letzterExport: S.letzterExport
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

async function syncen(erzwingen = false) {
  const u = S.upload;
  // Neue Einstellungen übernommen? Dann gleich den Stand melden, damit die Eltern-App es sieht.
  if (await fernHolen(erzwingen)) erzwingen = true;
  if (!S.einstellungen.name || u.testgeraet || !u.repo || !u.token || syncLaeuft) return null;
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
  protokoll(S, 'anmeldung', { name });
  sichern();
  zeigeStart();
}

function zeigeStart() {
  if (!S.einstellungen.name) return zeigeAnmeldung();
  setzeAnsicht('start');
  if (neuLadenGeplant) { neuLadenWennRuhig(); return; }
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
    </section>

    ${slot ? `
    <section class="basis-karte">
      <div><b>${minText(R().basisMin)} Spielzeit sind da!</b><div class="gedaempft">Jede Stunde gibt es ${minText(R().basisMin)} geschenkt.</div></div>
      <button class="btn btn-amber" data-act="basis">Abholen</button>
    </section>` : ''}

    <button class="btn btn-haupt btn-gross" data-act="aufgaben">Aufgaben machen</button>
    <button class="btn btn-amber-rand btn-gross" data-act="spielen">2048 spielen</button>

    <section class="info-karte">
      <div class="info-zeile"><span>Heute geschafft</span><b>${S.tag.aufgaben} ${S.tag.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}</b></div>
      <div class="info-zeile"><span>Heute verdient</span><b>${L.formatMinuten(S.tag.verdient)}</b></div>
      ${serieAktiv ? `<div class="info-zeile"><span>Deine Serie</span><b>${S.serie.pos} am Stück</b></div>` : ''}
    </section>

    <section class="regel-karte">
      <div class="regel-titel">So bekommst du Spielzeit</div>
      <div class="stufen">
        <div><b>1</b> Min.<span>Aufg. 1–3</span></div>
        <div><b>1,5</b> Min.<span>Aufg. 4–6</span></div>
        <div><b>2</b> Min.<span>Aufg. 7–9</span></div>
        <div><b>2,5</b> Min.<span>ab Aufg. 10</span></div>
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

function waehleAufgabe(kategorie) {
  const thema = S.einstellungen.thema;
  const faellig = S.wiederholen.find(w => w.ab <= S.verlauf.zaehler);
  if (faellig && kategorie !== 'abschluss') {
    S.wiederholen = S.wiederholen.filter(w => w !== faellig);
    return { aufgabe: faellig.aufgabe, wdh: faellig.wdh };
  }
  const pool = alleAufgaben();
  const ausPool = k => L.waehleAufgabe(pool, { kategorie: k, thema, statistik: S.statistik, verlauf: S.verlauf, heute: S.tag.key });
  const fokus = fokusOptionen();
  const themaGens = G.THEMA_GENERATOREN[thema] || [];
  let a = null;
  switch (kategorie) {
    case 'leicht':
      if (Math.random() < 0.4) a = G.block(wahl(G.BLOCK_GENERATOREN), Math.random);
      else a = erzeuge(wahl(['einmaleins', 'potenz', 'mal10', 'minus-plus', 'prozent', 'bruch-bild']), 1, fokus);
      break;
    case 'thema':
      if (!themaGens.length || Math.random() < 0.15) { const p = ausPool('thema'); if (p && p.thema === thema && !p.geschichte) a = p; }
      if (!a) { const g = wahl(themaGens.length ? themaGens : G.MIX_GENERATOREN); a = erzeuge(g, genStufe(g), fokus); }
      break;
    case 'mix': {
      if (Math.random() < 0.15) { a = G.block(wahl(G.BLOCK_GENERATOREN), Math.random); break; }
      const g = wahl(G.MIX_GENERATOREN.filter(x => !themaGens.includes(x)));
      a = erzeuge(g, genStufe(g), fokus);
      break;
    }
    case 'text': {
      const r = Math.random();
      const rabattThema = ['prozent', 'prozent-baukasten', 'rabatt', 'neuer-preis'].includes(thema);
      if (r < 0.4) a = ausPool('text');
      else { const g = (rabattThema ? r < 0.55 : r < 0.75) ? 'geld-geschichte' : 'rabatt-geschichte'; a = erzeuge(g, genStufe(g), fokus); }
      break;
    }
    case 'struktur':
      if (Math.random() < 0.5) a = ausPool('struktur');
      if (!a || a.thema === 'kugel') a = Math.random() < 0.5 ? erzeuge('baukasten', 1) : erzeuge('bruch-bild', genStufe('bruch-bild'));
      break;
    case 'abschluss': {
      const runde = Math.floor(S.verlauf.musterIndex / MUSTER.length);
      const r = Math.random();
      if (runde % 2 === 1) {
        if (r < 0.4) a = ausPool('bonus');
        if (!a || !a.bonus) a = r < 0.7 ? G.potenz(3, Math.random, { bonus: true }) : G.baukasten(3, Math.random, { bonus: true });
      } else {
        if (r < 0.25) a = ausPool('abschluss');
        if (!a || a.bonus) a = r < 0.65 ? erzeuge('kugel', genStufe('kugel')) : erzeuge('runden', genStufe('runden'));
      }
      break;
    }
  }
  if (!a) a = erzeuge('einmaleins', 1);
  return { aufgabe: a, wdh: 0 };
}

function neueAufgabe() {
  tagAktualisieren(S);
  const kategorie = MUSTER[S.verlauf.musterIndex % MUSTER.length];
  const { aufgabe, wdh } = waehleAufgabe(kategorie);
  S.verlauf.musterIndex++;
  if (Date.now() - S.serie.letzteAktivitaet > 20 * 60 * 1000) S.serie.pos = 0;
  S.serie.pos++;
  S.serie.letzteAktivitaet = Date.now();
  A = {
    aufgabe, kategorie, serienPos: S.serie.pos, start: Date.now(),
    teile: teileVon(aufgabe), idx: 0, phase: 'eingabe', hinweise: [], verlassen: 0, strafe: 'keine',
    fertig: false, meldung: null, feld: 'z', wdh
  };
  A.teile.forEach(t => { t.versuche = []; t.status = 'offen'; t.eingabe = ''; t.z = ''; t.n = ''; t.seit = Date.now(); });
  if (aufgabe.typ === 'zuordnung') zuordnungVorbereiten();
  const startInfo = { id: aufgabe.id, thema: aufgabe.thema, stufe: aufgabe.stufe, aufgabenTyp: aufgabe.typ, kategorie, serienPos: A.serienPos, bonus: !!aufgabe.bonus, wiederholung: wdh };
  if (aufgabe.generator) Object.assign(startInfo, {
    generator: aufgabe.generator, parameter: aufgabe.parameter, rechnung: aufgabe.rechnung, geschichte: aufgabe.geschichte,
    teile: A.teile.map(t => t.art === 'zahl' ? [t.label || null, t.ziel.wert] : t.art === 'bruch' ? [t.antwort.zaehler, t.antwort.nenner] : t.art === 'wahl' ? [t.label, t.richtig] : null)
  });
  // Erzeugte oder hinzugefügte Aufgaben vollständig mitschreiben, damit die Eltern-App sie zeigen kann
  if (!BASIS_IDS.has(aufgabe.id)) startInfo.aufgabe = aufgabe;
  protokoll(S, 'aufgabe_start', startInfo);
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
      <article class="karte aufgabe${a.bonus ? ' bonus' : ''}">
        ${a.bonus ? `<div class="bonus-kopf"><span class="bonus-label">Bonus · freiwillig</span>${!A.fertig && A.teile.every(t => !t.versuche.length) ? '<button class="btn-text klein" data-act="ueberspringen">Überspringen</button>' : ''}</div>` : ''}
        ${a.geschichte ? `<p class="geschichte">${mathe(a.geschichte)}</p>` : ''}
        ${a.rechnung ? `<div class="rechnung">${mathe(a.rechnung)}</div>` : ''}
        ${a.bild ? `<div class="bild">${bildSvg(a.bild)}</div>` : ''}
        ${a.typ !== 'auswahl' ? `<p class="frage">${mathe(a.frage)}</p>` : ''}
        <div class="teile">${teileHtml()}</div>
        <div class="hw-leiste"><span class="gedaempft">Hinweis:</span>${icons}
          ${a.taschenrechner && !A.fertig ? '<button class="btn btn-klein btn-rechner" data-act="rechner">Taschenrechner</button>' : ''}
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
      <button class="btn btn-amber-rand" data-act="spielen">Zum Spiel · ${L.formatZeit(S.guthaben)}</button>
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
  if (A.strafe === 'halb' && A.ergebnis !== 'loesung') strafe = '<p class="gedaempft">Du warst kurz außerhalb der App. Darum gibt es diesmal nur die Hälfte.</p>';
  if (A.strafe === 'null' && A.ergebnis !== 'loesung') strafe = '<p class="gedaempft">Du warst außerhalb der App. Bei Aufgaben ohne Taschenrechner gibt es dafür heute keine Spielzeit.</p>';
  const weg = `<div class="loesungsweg"><div class="lw-titel">So geht's</div>${(a.loesungsweg || []).map(z => `<div class="lw-zeile">${mathe(z)}</div>`).join('')}<p class="lw-erkl">${mathe(a.erklaerung || '')}</p></div>`;
  const offen = A.ergebnis === 'loesung';
  return `<section class="ergebnis-karte">${kopf}${zeit}${strafe}
    ${offen ? weg : `<details class="weg-details"><summary>Lösungsweg ansehen</summary>${weg}</details>`}
  </section>`;
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
  const sek = L.sekundenFuerAufgabe({ ergebnis, serienPos: A.serienPos, strafe: A.strafe, rechnerHalb: !!A.rechnerHalb, regeln: R() });
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
      if (ergebnis === 'erst') { st.folge++; if (st.folge >= 3 && st.stufe < 3) { st.stufe++; st.folge = 0; protokoll(S, 'stufe', { generator: g, stufe: st.stufe }); } }
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
    strafe: A.strafe, rechnerOptional: !!A.rechnerHalb, verlassen: A.verlassen, ms: Date.now() - A.start, hinweise: A.hinweise.slice(),
    bonusTeile: A.teile.filter(t => t.bonus).map(t => t.status), merkTeile: A.teile.filter(t => t.merk).map(t => t.status),
    generator: a.generator || null
  });
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
    sichern();
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
  // Spielen beendet die Serie
  if (S.serie.pos) { protokoll(S, 'serie_ende', { laenge: S.serie.pos }); S.serie.pos = 0; }
  if (!S.spiel.feld) neuesSpielFeld();
  spielSitzung = { start: Date.now(), sekunden: 0 };
  protokoll(S, 'spiel_start', { guthaben: S.guthaben });
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
      <button class="btn-text klein" data-act="neuesSpiel">Neu</button>
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
  } else if (!L.kannBewegen(S.spiel.feld)) {
    overlay(`<div class="overlay-titel">Keine Züge mehr</div><p>Ein neues Spiel kostet nichts.</p><button class="btn btn-jade" data-act="neuesSpielJetzt">Neues Spiel</button>`);
  }
}

function spielTick() {
  if (ansicht !== 'spiel' || document.hidden || S.guthaben <= 0) return;
  if (document.querySelector('#spiel-overlay .overlay')) return;
  S.guthaben = Math.max(0, S.guthaben - 1);
  if (spielSitzung) spielSitzung.sekunden++;
  const el = $id('spielzeit');
  if (el) el.textContent = L.formatZeit(S.guthaben);
  const uhr = $id('uhr');
  if (uhr) uhr.classList.toggle('knapp', S.guthaben < 60);
  if (S.guthaben % 10 === 0) sichern();
  if (S.guthaben <= 0) { spielBeenden(); overlayPruefen(); }
}

function spielBeenden() {
  if (!spielSitzung) return;
  protokoll(S, 'spiel_ende', { sekunden: spielSitzung.sekunden, punkte: S.spiel.punkte, maxKachel: S.spiel.maxKachel, rest: S.guthaben });
  spielSitzung = null;
  sichern();
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
  if (ansicht === 'spiel') {
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
      ` : `
        <p>Die Lerndaten werden automatisch in ein privates GitHub-Repo übertragen. Dafür einmal Repo und Zugangsschlüssel eintragen.</p>
        <label class="feld-label">Repo (Besitzer/Name)<input id="u-repo" type="text" value="${esc(S.upload.repo || '')}" placeholder="name/LearningToolsTracking" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <label class="feld-label">Zugangsschlüssel<input id="u-token" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <p class="fehler-text" id="u-fehler"></p>
        <button class="btn btn-haupt" data-act="syncSpeichern">Speichern und testen</button>
      `}
    </section>

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
      <div class="info-zeile"><span>Übungsthema</span><b>${esc(THEMA_NAMEN[S.einstellungen.thema] || S.einstellungen.thema)}</b></div>
      <div class="info-zeile"><span>Geschenkte Spielzeit</span><b>${S.einstellungen.basisVon} bis ${S.einstellungen.basisBis} Uhr · ${minText(R().basisMin)}</b></div>
      <div class="info-zeile"><span>Spielzeit pro Aufgabe</span><b>${R().staffel.map(m => String(m).replace('.', ',')).join(' / ')} Min.</b></div>
      <div class="info-zeile"><span>2. Versuch / mit Rechner</span><b>${L.anteilText(R().zweit).replace('die ', '')} / ${L.anteilText(R().rechner).replace('die ', '')}</b></div>
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
    case 'basis': {
      const slot = L.basisSlotJetzt(new Date(), S.einstellungen, S.basisSlot);
      if (slot && R().basisMin > 0) { S.basisSlot = slot; S.guthaben += Math.round(R().basisMin * 60); protokoll(S, 'basis', { slot }); sichern(); }
      zeigeStart(); break;
    }
    case 'start': zeigeStart(); break;
    case 'beenden':
      if (A && !A.fertig) protokoll(S, 'aufgabe_abgebrochen', { id: A.aufgabe.id, teil: A.idx, ms: Date.now() - A.start });
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
        S.upload = { ...S.upload, repo, token, fehler: null, tage: {} };
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
