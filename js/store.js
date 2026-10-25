// Speicher auf dem Gerät (localStorage). Alles bleibt auf dem Handy.
import { tagKey } from './logic.js';

const KEY = 'lernapp-v1';
const LOG_KEY = 'lernapp-v1-log';

function standard() {
  return {
    version: 1,
    geraetId: Math.random().toString(36).slice(2, 10),
    erstelltAm: new Date().toISOString(),
    guthaben: 0,            // Spielzeit in Sekunden
    basisSlot: null,        // zuletzt abgeholte Basiszeit (Tag-Stunde)
    spiel: { feld: null, punkte: 0, rekord: 0, maxKachel: 0, gewonnenGezeigt: false },
    bloecke: null,          // Runenfeld: { feld, teile, punkte, kombo, ohneLinie, rekord }
    kristallmine: null,     // Kristallmine: { hoehle, leben, punkte, rekord, hoechste, kreuz, hoehleStand }
    splitter: null,         // Runensplitter: Stand, Verlauf, freigeschaltete Spiele (js/splitter.js)
    steinschieber: null,
    runenfall: null,
    anleitungen: {},        // Anleitungen schon gesehen: { spiel: true }
    runenreihen: null, hoehlenkarte: null, runenbrecher: null, jadeschlange: null, // weitere Spiele: gespeicherter Stand        // Runenfall: laufendes Spiel mit Feld, Teil, Punkten und Rekord    // Steinschieber: { level, geschafft: [...], zuege: {...}, levelStand }
    einstellungen: { thema: 'minus-zahlen', basisVon: 14, basisBis: 21, pin: null, name: '', rechnerAngebot: true, langeHinweise: 1 },
    spielzeit: null,        // Spielzeit-Regeln aus der Eltern-App (null = Standard)
    bzRegeln: null,         // Bildschirmzeit-Regeln aus der Eltern-App (js/bildschirm.js, null = Standard)
    szRegeln: null,         // Spielzeit im Schrein: Höchstwert pro Tag (js/bildschirm.js, null = Standard 45 Min.)
    bildschirm: null,       // Bildschirmzeit-Konto: { stand, tag, heute, aufgaben, code }
    paket: null,            // Aufgabenpaket aus der Eltern-App: { id, name, gewichte } (null = Übungsthema)
    pakete: null,           // mehrere Pakete mit Rolle, Anteil und Etappe (js/lernplan.js); null = nur „paket“
    abweichungen: {},       // Anpassungen pro Thema aus der Eltern-App (gelten in jedem Paket)
    etappeAnzeigen: false,  // „Du übst gerade: … · Etappe n von m“ auf dem Startbildschirm
    fernEtappen: null,      // Etappen aus der letzten Einstellungsdatei (zum Erkennen von Änderungen der Eltern)
    startOffen: [],
    feedbackOffen: null,    // eigene Tickets, die noch nicht erledigt sind (null = noch nie nachgesehen)
    feedbackNeu: [],        // erledigte Tickets, die das Kind noch nicht gesehen hat: [{ id, text, fuerKind }]         // Pakete, die hier gestartet sind (Feld start), aber noch nicht in einstellungen.json stehen
    ansichtName: '',        // Name der App bei Gestaltung Sternzeit (Standard „Logbuch Sternzeit“)
    gestaltung: 'schrein',  // schrein (Standard) oder sternzeit („Logbuch Sternzeit“), aus der Eltern-App
    uzRegeln: null,         // Übungszeit pro Tag (js/bildschirm.js uzRegeln, null = aus)
    wochenplan: null,       // Wochenplan aus einstellungen.json (Auftrag 24, Format wochenplan-1), null = keiner
    eingriffe: [],          // Eingriffe der Eltern mit Ablaufdatum (Auftrag 24)
    wp: null,               // Stand zum Wochenplan: Übungszeit je Thema seit ab, Takt, Erinnerungen
    zuletzt: null,          // je Thema der Tag, an dem es zuletzt geübt wurde (nur mit Wochenplan gepflegt)
    freigaben: {},          // Freigaben mit Datum aus der Eltern-App, z. B. { minusminus: '2026-10-26' } (Auftrag 21)
    uebung: null,           // Übungszeit heute: { tag, sek, hinweis, code, gefragt }
    wissen: null,           // Wissenspunkte: { stand, verlauf: [{ t, n, grund, id }] } (nur Sternzeit)
    logbuch: null,          // Logbuch: { frei: { eintragId: { tag, sternzeit } }, gelesen: [ids] }
    archiv: null,           // Wissensarchiv: { gekauft: [ids] }
    fern: { version: 0, geaendert: null, angewendet: null, geholt: null, fehler: null }, // Einstellungen aus der Eltern-App
    statistik: {},          // je Aufgabe: gesehen, zuletzt, letztesErgebnis, letzterTag
    verlauf: { zaehler: 0, letzteIds: [], themaZuletzt: {}, musterIndex: 0 },
    serie: { pos: 0, letzteAktivitaet: 0 },
    tag: { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 },
    extraAufgaben: [],
    genStufen: {},          // Baukasten → { stufe, folge }
    wiederholen: [],        // erzeugte Aufgaben, die nochmal kommen
    wartet: null,           // mit „Fertig“ verlassene Aufgabe: kommt beim nächsten Mal wieder (Zustand der Aufgabe)
    upload: { repo: '', token: '', letzter: null, versuch: 0, fehler: null, tage: {}, testgeraet: false },
    log: [],
    letzterExport: null
  };
}

function zusammenfuehren(basis, gespeichert) {
  const out = { ...basis, ...gespeichert };
  for (const k of ['spiel', 'einstellungen', 'verlauf', 'serie', 'tag', 'upload', 'fern']) out[k] = { ...basis[k], ...(gespeichert[k] || {}) };
  return out;
}

export function laden() {
  let s = standard();
  try {
    const roh = localStorage.getItem(KEY);
    if (roh) s = zusammenfuehren(standard(), JSON.parse(roh));
    const log = localStorage.getItem(LOG_KEY);
    if (log) s.log = JSON.parse(log);
  } catch (e) { /* privater Modus o. Ä.: mit Standard weiter */ }
  if (!Array.isArray(s.log)) s.log = [];
  if (s.tag.key !== tagKey()) s.tag = { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 };
  return s;
}

// Zustand und Protokoll getrennt speichern, damit Spielzüge schnell bleiben.
let speicherFehler = false;
let logGeaendert = true;
export function speichern(s) {
  try {
    const { log, ...rest } = s;
    localStorage.setItem(KEY, JSON.stringify(rest));
    if (logGeaendert) { localStorage.setItem(LOG_KEY, JSON.stringify(log)); logGeaendert = false; }
    speicherFehler = false;
  } catch (e) {
    speicherFehler = true;
  }
  return !speicherFehler;
}
export const hatSpeicherFehler = () => speicherFehler;

// Live-Anzeige (Eltern-App): die App meldet ausgewählte Ereignisse zusätzlich an einen Beobachter
let protokollBeobachter = null;
export function protokollBeobachten(fn) { protokollBeobachter = fn; }
export function protokoll(s, typ, daten = {}) {
  s.log.push({ ...daten, t: new Date().toISOString(), typ });
  if (protokollBeobachter) { try { protokollBeobachter(typ, daten); } catch (e) { /* egal */ } }
  logGeaendert = true;
  if (s.log.length > 12000) s.log.splice(0, s.log.length - 12000);
}

export function tagAktualisieren(s) {
  if (s.tag.key !== tagKey()) s.tag = { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 };
}

export async function dauerhaftSpeichernAnfragen() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* egal */ }
}

// ---------- Spielstand online (daten/<name>/spielstand.json) ----------
// Gesichert wird, was Kind und Spiele erreicht haben. Nicht dabei: PIN, Zugangsschlüssel, Geräte-ID, Protokoll.
export const STAND_FORMAT = 'lernapp-spielstand-1';
const STAND_FELDER = ['guthaben', 'basisSlot', 'spiel', 'bloecke', 'statistik', 'verlauf', 'serie', 'tag', 'extraAufgaben',
  'genStufen', 'wiederholen', 'spielzeit', 'paket', 'fern', 'wartet', 'kristallmine', 'splitter', 'anleitungen', 'steinschieber', 'runenfall', 'runenreihen', 'hoehlenkarte', 'runenbrecher', 'jadeschlange', 'bzRegeln', 'bildschirm', 'szRegeln', 'pakete', 'abweichungen', 'etappeAnzeigen',
  'gestaltung', 'ansichtName', 'fernEtappen', 'uzRegeln', 'uebung', 'wissen', 'logbuch', 'archiv'];

export function spielstandAus(s, jetzt = new Date()) {
  const zustand = {};
  for (const k of STAND_FELDER) zustand[k] = s[k] === undefined ? null : JSON.parse(JSON.stringify(s[k]));
  const { thema, basisVon, basisBis, rechnerAngebot, langeHinweise } = s.einstellungen;
  return { format: STAND_FORMAT, nutzer: s.einstellungen.name, geraetId: s.geraetId, gespeichert: jetzt.toISOString(), zustand, einstellungen: { thema, basisVon, basisBis, rechnerAngebot, langeHinweise: langeHinweise ?? 1 } };
}

// Inhalt ohne Zeitstempel (zum Erkennen, ob sich etwas geändert hat)
export function spielstandKern(s) {
  const d = spielstandAus(s, new Date(0));
  return JSON.stringify({ zustand: d.zustand, einstellungen: d.einstellungen });
}

// Noch nichts erreicht auf diesem Gerät (frisch eingerichtet)
export function istFrisch(s) {
  return !(s.verlauf && s.verlauf.zaehler) && !s.guthaben && !(s.spiel && (s.spiel.punkte || s.spiel.rekord))
    && !(s.bloecke && (s.bloecke.punkte || s.bloecke.rekord)) && !Object.keys(s.statistik || {}).length;
}

export function spielstandAnwenden(s, datei) {
  if (!datei || datei.format !== STAND_FORMAT || !datei.zustand) return false;
  const basis = standard();
  for (const k of STAND_FELDER) {
    const v = datei.zustand[k];
    if (v === undefined) continue;
    if (['spiel', 'verlauf', 'serie', 'tag', 'fern'].includes(k)) s[k] = { ...basis[k], ...(v || {}) };
    else s[k] = v;
  }
  if (typeof s.guthaben !== 'number' || !(s.guthaben >= 0)) s.guthaben = 0;
  if (datei.einstellungen) {
    for (const k of ['thema', 'basisVon', 'basisBis', 'rechnerAngebot', 'langeHinweise']) if (datei.einstellungen[k] !== undefined) s.einstellungen[k] = datei.einstellungen[k];
  }
  if (s.tag.key !== tagKey()) s.tag = { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 };
  return true;
}
