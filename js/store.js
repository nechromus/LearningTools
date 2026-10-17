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
    einstellungen: { thema: 'minus-zahlen', basisVon: 14, basisBis: 21, pin: null, name: '', rechnerAngebot: true },
    spielzeit: null,        // Spielzeit-Regeln aus der Eltern-App (null = Standard)
    paket: null,            // Aufgabenpaket aus der Eltern-App: { id, name, gewichte } (null = Übungsthema)
    fern: { version: 0, geaendert: null, angewendet: null, geholt: null, fehler: null }, // Einstellungen aus der Eltern-App
    statistik: {},          // je Aufgabe: gesehen, zuletzt, letztesErgebnis, letzterTag
    verlauf: { zaehler: 0, letzteIds: [], themaZuletzt: {}, musterIndex: 0 },
    serie: { pos: 0, letzteAktivitaet: 0 },
    tag: { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 },
    extraAufgaben: [],
    genStufen: {},          // Baukasten → { stufe, folge }
    wiederholen: [],        // erzeugte Aufgaben, die nochmal kommen
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

export function protokoll(s, typ, daten = {}) {
  s.log.push({ ...daten, t: new Date().toISOString(), typ });
  logGeaendert = true;
  if (s.log.length > 12000) s.log.splice(0, s.log.length - 12000);
}

export function tagAktualisieren(s) {
  if (s.tag.key !== tagKey()) s.tag = { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 };
}

export async function dauerhaftSpeichernAnfragen() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* egal */ }
}
