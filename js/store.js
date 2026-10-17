// Speicher auf dem Gerät (localStorage). Alles bleibt auf dem Handy.
import { tagKey } from './logic.js';

const KEY = 'lernapp-v1';

function standard() {
  return {
    version: 1,
    geraetId: Math.random().toString(36).slice(2, 10),
    erstelltAm: new Date().toISOString(),
    guthaben: 0,            // Spielzeit in Sekunden
    basisSlot: null,        // zuletzt abgeholte Basiszeit (Tag-Stunde)
    spiel: { feld: null, punkte: 0, rekord: 0, maxKachel: 0, gewonnenGezeigt: false },
    einstellungen: { thema: 'minus-zahlen', basisVon: 14, basisBis: 21, pin: null, name: '' },
    statistik: {},          // je Aufgabe: gesehen, zuletzt, letztesErgebnis, letzterTag
    verlauf: { zaehler: 0, letzteIds: [], themaZuletzt: {}, musterIndex: 0 },
    serie: { pos: 0, letzteAktivitaet: 0 },
    tag: { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 },
    extraAufgaben: [],
    log: [],
    letzterExport: null
  };
}

function zusammenfuehren(basis, gespeichert) {
  const out = { ...basis, ...gespeichert };
  for (const k of ['spiel', 'einstellungen', 'verlauf', 'serie', 'tag']) out[k] = { ...basis[k], ...(gespeichert[k] || {}) };
  return out;
}

export function laden() {
  let s = standard();
  try {
    const roh = localStorage.getItem(KEY);
    if (roh) s = zusammenfuehren(standard(), JSON.parse(roh));
  } catch (e) { /* privater Modus o. Ä.: mit Standard weiter */ }
  if (s.tag.key !== tagKey()) s.tag = { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 };
  return s;
}

let speicherFehler = false;
export function speichern(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    speicherFehler = false;
  } catch (e) {
    speicherFehler = true;
  }
  return !speicherFehler;
}
export const hatSpeicherFehler = () => speicherFehler;

export function protokoll(s, typ, daten = {}) {
  s.log.push({ ...daten, t: new Date().toISOString(), typ });
  if (s.log.length > 30000) s.log.splice(0, s.log.length - 30000);
}

export function tagAktualisieren(s) {
  if (s.tag.key !== tagKey()) s.tag = { key: tagKey(), verlassen: 0, aufgaben: 0, ersterVersuch: 0, verdient: 0 };
}

export async function dauerhaftSpeichernAnfragen() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* egal */ }
}
