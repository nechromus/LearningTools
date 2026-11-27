// Archiv der Welten (Lese-App): Regeln ohne DOM (testbar mit node).
// Lese-Kontingent aus einstellungen.json → werte.lesen { an, faktor, max, extra { tag, min } } (Auftrag 59).
import * as K from '../js/kasse.js';
import { grenzeSek as matheGrenzeSek } from '../js/bildschirm.js';

export const LESEN_STD = Object.freeze({ an: false, faktor: 1, max: 30, extra: null });
export const LESE_MAX = Object.freeze({ min: 5, max: 120 });
export const LESE_EXTRAS = [10, 20, 30];
const datumOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

export function leseRegeln(r) {
  if (!r || typeof r !== 'object') return { ...LESEN_STD };
  const faktor = Number.isFinite(r.faktor) && r.faktor >= 0.25 && r.faktor <= 2 ? Math.round(r.faktor * 100) / 100 : LESEN_STD.faktor;
  const max = Number.isInteger(r.max) && r.max >= LESE_MAX.min && r.max <= LESE_MAX.max ? r.max : LESEN_STD.max;
  const extra = r.extra && datumOk(r.extra.tag) && Number.isInteger(r.extra.min) && r.extra.min > 0 && r.extra.min <= 120 ? { tag: r.extra.tag, min: r.extra.min } : null;
  return { an: r.an === true, faktor, max, extra };
}
// Lese-Zeit, die heute höchstens verdient werden kann (Sekunden)
export const grenzeSek = (r, tag) => (r.max + (r.extra && r.extra.tag === tag ? r.extra.min : 0)) * 60;

// Stand des Tages: { tag, sek (heute verdient), karten }
export function tagVon(t, tag) {
  return t && t.tag === tag ? { tag, sek: Math.max(0, Math.round(t.sek) || 0), karten: Math.max(0, Math.round(t.karten) || 0) } : { tag, sek: 0, karten: 0 };
}

// Lohn einer Lesekarte buchen (Sekunden vor dem Faktor). Höchstens bis zur Lese-Grenze. Gibt { plus, voll } zurück.
// Auch eine Karte ohne Lohn zählt als Lesekarte (für „Heute gelesen“ und die Nachricht).
// neueFolge: die erste fertige Karte zu einem Text zählt als gelesene Folge (Bildschirmzeit-Nachricht: „Folgen · Fragen“)
export function verdienen(kasse, tag, sek, regeln, { ms = 0, t, neueFolge = false } = {}) {
  const rest = Math.max(0, grenzeSek(regeln, tag.tag) - tag.sek);
  const plus = Math.min(rest, Math.round(Math.max(0, sek) * regeln.faktor));
  K.buchen(kasse, { sek: plus, a: 1, ms, ...(neueFolge ? { f: 1 } : {}), ...(t ? { t } : {}) });
  tag.sek += plus; tag.karten += 1;
  return { plus, voll: tag.sek >= grenzeSek(regeln, tag.tag) };
}

// Mathe heute (aus der Quell-Datei der Mathe-App) und ob dort noch Zeit frei ist
export function matheHeute(fremd, bzRegeln, tag) {
  let sek = 0, stand = null;
  for (const f of Object.values(fremd || {})) {
    if (f && f.app === 'mathe' && f.heute && f.heute.tag === tag) { sek += f.heute.sek || 0; stand = f.geaendert || stand; }
  }
  const grenze = bzRegeln ? matheGrenzeSek(bzRegeln, tag) : 0;
  return { sek, stand, frei: grenze > 0 ? Math.max(0, grenze - sek) : 0 };
}
