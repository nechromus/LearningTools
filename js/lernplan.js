// Mehrere Pakete pro Kind und Lerneinheiten mit Etappen (Auftrag 12-auftraege-fuer-app-mehrere-pakete.md).
// Rollen: grund (genau 1, Einstieg kommt immer von hier), einheit (mit Etappe), wiederholung.
// Reine Logik ohne DOM (testbar mit node).
import { THEMEN } from './logic.js';
// (eigene Kopie von paket.js/gewichteNorm, weil logic.js diese Datei lädt und paket.js beim Laden THEMEN braucht)
function gewichteNorm(g) {
  const out = {};
  for (const t of THEMEN) { const v = g && Number(g[t]); out[t] = [0, 1, 2, 4].includes(v) ? v : 0; }
  return out;
}

export const FORMAT2 = 'lernapp-paket-2';
export const ROLLEN = ['grund', 'einheit', 'wiederholung'];
export const ROLLEN_NAMEN = { grund: 'Grundpaket', einheit: 'Lerneinheit', wiederholung: 'Wiederholung' };
export const WEITER = ['hand', 'vorschlag', 'automatisch'];
export const FAECHER = ['mathe', 'physik'];
// Varianten der Baukästen, die eine Etappe abschalten kann
export const VARIANTEN = { zylinder: ['auswahl'] };
export const STUFE_MAX = 3;
// Baukasten → Thema (für die Stufen-Grenzen)
export const GEN_THEMA = {
  'minus-plus': 'minus-zahlen', 'geld-geschichte': 'minus-zahlen', 'reihenfolge': 'reihenfolge', 'potenz': 'potenzen', 'bruch-bild': 'bruch-bild',
  'prozent': 'prozent', 'baukasten': 'prozent-baukasten', 'rabatt-geschichte': 'rabatt', 'runden': 'runden', 'kugel': 'kugel',
  'einmaleins': 'einmaleins', 'mal10': 'mal-10', 'zylinder': 'zylinder'
};
export const VORSCHLAG = { grund: 50, einheit: 40, wiederholung: 10 };

const ganz = (x, min, max, std) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
const datumOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// Etappen eines Pakets prüfen und vereinheitlichen
export function etappenNorm(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.map((e, i) => {
    const grenzen = {};
    for (const [t, g] of Object.entries((e && e.grenzen) || {})) {
      if (!THEMEN.includes(t) || !g || typeof g !== 'object') continue;
      const out = {};
      if (g.stufe_max != null) out.stufe_max = ganz(g.stufe_max, 1, STUFE_MAX, STUFE_MAX);
      const ohne = (Array.isArray(g.ohne) ? g.ohne : []).filter(v => (VARIANTEN[t] || []).includes(v));
      if (ohne.length) out.ohne = ohne;
      grenzen[t] = out;
    }
    return {
      nr: i + 1,
      name: String((e && e.name) || `Etappe ${i + 1}`).slice(0, 60),
      ...(e && e.bogen ? { bogen: String(e.bogen).slice(0, 80) } : {}),
      grenzen,
      aufgaben: (Array.isArray(e && e.aufgaben) ? e.aufgaben : []).map(String).filter(x => /^[A-Za-z0-9_.-]{1,60}$/.test(x))
    };
  });
}

// Inhalt eines Pakets (ohne Kind-Angaben)
export function paketInhalt(p) {
  const etappen = etappenNorm(p && p.etappen);
  return {
    format: etappen.length || (p && p.format === FORMAT2) ? FORMAT2 : 'lernapp-paket-1',
    id: String((p && p.id) || ''), name: String((p && p.name) || '').slice(0, 40),
    fach: FAECHER.includes(p && p.fach) ? p.fach : 'mathe',
    beschreibung: String((p && p.beschreibung) || '').slice(0, 300),
    gewichte: gewichteNorm(p && p.gewichte),
    ...(etappen.length ? { weiter: WEITER.includes(p.weiter) ? p.weiter : 'hand', etappen } : {})
  };
}

// Ein Paket beim Kind: { id, rolle, anteil, etappe, naechste, paket: Inhalt }
export function eintragNorm(e) {
  const inhalt = paketInhalt({ id: e && e.id, ...((e && e.paket) || {}) });
  const n = (inhalt.etappen || []).length;
  const out = {
    id: inhalt.id, rolle: ROLLEN.includes(e && e.rolle) ? e.rolle : 'einheit',
    anteil: ganz(e && e.anteil, 0, 100, 0), paket: inhalt
  };
  if (n) {
    out.etappe = ganz(e.etappe, 0, n, 0);
    if (e.naechste && datumOk(e.naechste.ab)) out.naechste = { etappe: ganz(e.naechste.etappe, 0, n, out.etappe), ab: e.naechste.ab };
  }
  return out;
}

// Pakete aus der Einstellungsdatei. Altes werte.paket gilt als einziges Grundpaket mit 100 %.
export function paketeAusWerte(w) {
  if (!w || typeof w !== 'object') return null;
  if (Array.isArray(w.pakete) && w.pakete.length) {
    const liste = w.pakete.map(eintragNorm).filter(p => p.id);
    if (!liste.some(p => p.rolle === 'grund') && liste.length) liste[0].rolle = 'grund';
    // genau ein Grundpaket
    let grund = false;
    for (const p of liste) { if (p.rolle === 'grund') { if (grund) p.rolle = 'einheit'; grund = true; } }
    return liste;
  }
  if (w.paket && typeof w.paket === 'object' && w.gewichte) {
    return [eintragNorm({ id: w.paket.id, rolle: 'grund', anteil: 100, paket: { name: w.paket.name, gewichte: w.gewichte } })];
  }
  return null;
}

// „naechste“ wird ab seinem Datum (Gerätezeit, ab 0 Uhr) zur aktuellen Etappe. Gibt die Wechsel zurück.
export function naechsteAnwenden(liste, heute) {
  const wechsel = [];
  for (const p of liste || []) {
    if (p.naechste && p.naechste.ab <= heute) {
      wechsel.push({ paket: p.id, von: p.etappe, nach: p.naechste.etappe });
      p.etappe = p.naechste.etappe;
      delete p.naechste;
    }
  }
  return wechsel;
}

const hatEtappen = (p) => !!(p.paket.etappen && p.paket.etappen.length);
// Pakete, die gerade beitragen: Anteil > 0 und (ohne Etappen oder Etappe ≥ 1)
export function aktive(liste) {
  return (liste || []).filter(p => p.anteil > 0 && (!hatEtappen(p) || p.etappe > 0));
}
export const grundpaket = (liste) => (liste || []).find(p => p.rolle === 'grund') || (liste || [])[0] || null;

// Gewichte eines Pakets mit den Anpassungen des Kindes (gelten pro Thema in jedem Paket, das das Thema hat;
// im Grundpaket auch für Themen, die dort aus sind)
export function gewichteVon(p, abweichungen = {}) {
  const g = { ...p.paket.gewichte };
  for (const [t, v] of Object.entries(abweichungen || {})) {
    if (!THEMEN.includes(t) || ![0, 1, 2, 4].includes(v)) continue;
    if (p.rolle === 'grund' || (g[t] || 0) > 0) g[t] = v;
  }
  return g;
}

// Höchstes Gewicht je Thema über alle aktiven Pakete (für „Thema ist an“)
export function gewichteAlle(liste, abweichungen = {}) {
  const out = Object.fromEntries(THEMEN.map(t => [t, 0]));
  for (const p of aktive(liste)) {
    const g = gewichteVon(p, abweichungen);
    for (const t of THEMEN) out[t] = Math.max(out[t], g[t] || 0);
  }
  return out;
}

// Grenzen aus den Etappen aller Pakete. themaVon(id) liefert das Thema einer Pool-Aufgabe, poolIds alle ids.
// Ergebnis: { stufeMax: {thema: n}, ohne: {thema: [..]}, pool: {thema: Set(ids)}, gesperrt: Set(thema) }
export function grenzenVon(liste, themaVon, poolIds = []) {
  const stufeMax = {}, ohne = {}, pool = {}, gesperrt = new Set();
  const erlaubtJe = {}; // thema → { stufe, ohne:Set|null, ids:Set } je Paket gesammelt, am Ende zusammengelegt (das Großzügigste gilt)
  for (const p of liste || []) {
    if (!hatEtappen(p)) continue;
    const et = p.paket.etappen;
    const gelistet = new Set(et.flatMap(e => e.aufgaben || []));
    const themen = new Set([...et.flatMap(e => Object.keys(e.grenzen || {})), ...[...gelistet].map(themaVon).filter(Boolean)]);
    for (const t of themen) {
      const s = erlaubtJe[t] || (erlaubtJe[t] = []);
      if (!(p.etappe > 0)) { s.push(null); continue; } // noch nicht begonnen
      const akt = et[p.etappe - 1];
      const ids = new Set(et.slice(0, p.etappe).flatMap(e => e.aufgaben || []).filter(id => themaVon(id) === t));
      if (p.etappe === et.length) for (const id of poolIds) if (themaVon(id) === t && !gelistet.has(id)) ids.add(id);
      const g = (akt.grenzen || {})[t] || {};
      s.push({ stufe: g.stufe_max || null, ohne: g.ohne || [], ids });
    }
  }
  for (const [t, liste2] of Object.entries(erlaubtJe)) {
    const offen = liste2.filter(Boolean);
    if (!offen.length) { gesperrt.add(t); continue; }
    pool[t] = new Set(offen.flatMap(x => [...x.ids]));
    if (offen.every(x => x.stufe)) stufeMax[t] = Math.max(...offen.map(x => x.stufe));
    const gem = offen.map(x => x.ohne).reduce((a, b) => a.filter(v => b.includes(v)));
    if (gem.length) ohne[t] = gem;
  }
  return { stufeMax, ohne, pool, gesperrt };
}

// Darf diese Aufgabe gerade kommen (Etappen-Grenzen)?
export function aufgabeErlaubt(a, gr) {
  if (!a || !gr) return true;
  const t = a.thema;
  if (gr.gesperrt.has(t)) return false;
  if (!a.generator) return !gr.pool[t] || gr.pool[t].has(a.id);
  const cap = gr.stufeMax[t];
  if (cap && (a.stufe || 1) > cap) return false;
  if ((gr.ohne[t] || []).includes('auswahl') && (a.schritte || []).some(s => s.optionen)) return false;
  return true;
}

// Paket nach Anteil ziehen (nur aus der übergebenen Liste)
export function zieheNachAnteil(liste, rng = Math.random) {
  const summe = liste.reduce((s, p) => s + (p.anteil > 0 ? p.anteil : 0), 0);
  if (summe <= 0) return liste[0] || null;
  let r = rng() * summe;
  for (const p of liste) { if (p.anteil > 0) { r -= p.anteil; if (r < 0) return p; } }
  return liste[liste.length - 1];
}

// Anteile auf 100 bringen (10er-Schritte), das Grundpaket fängt den Rest auf
export function anteileAusgleichen(liste) {
  const grund = grundpaket(liste);
  const rest = liste.filter(p => p !== grund).reduce((s, p) => s + p.anteil, 0);
  if (grund) grund.anteil = Math.max(0, 100 - rest);
  return liste;
}

// Vorschlag 50 / 40 / 10 (mehrere Einheiten oder Wiederholungen teilen sich ihren Anteil)
export function vorschlag(liste) {
  const zahl = (r) => liste.filter(p => p.rolle === r).length;
  const roh = { grund: VORSCHLAG.grund, einheit: zahl('einheit') ? VORSCHLAG.einheit : 0, wiederholung: zahl('wiederholung') ? VORSCHLAG.wiederholung : 0 };
  roh.grund = 100 - roh.einheit - roh.wiederholung;
  for (const r of ['einheit', 'wiederholung']) {
    const ps = liste.filter(p => p.rolle === r);
    if (!ps.length) continue;
    const basis = Math.floor(roh[r] / ps.length / 10) * 10;
    ps.forEach((p, i) => { p.anteil = basis + (i === 0 ? roh[r] - basis * ps.length : 0); });
  }
  const g = liste.find(p => p.rolle === 'grund');
  if (g) g.anteil = roh.grund;
  return liste;
}

// „Etappe sitzt“: von den letzten 10 fertigen Aufgaben der Etappe mindestens 8 im 1. Versuch, ohne „Hilf mir“ und „Mehr Hilfe“
export function etappeSitzt(aufgaben) {
  const letzte = aufgaben.slice(-10);
  const gut = letzte.filter(r => r.ende && r.ende.ergebnis === 'erst' && !r.ende.hilfe && !((r.ende.hinweiseLang || []).length) && !r.ende.langHalb).length;
  return { anzahl: letzte.length, gut, sitzt: letzte.length >= 10 && gut >= 8 };
}
