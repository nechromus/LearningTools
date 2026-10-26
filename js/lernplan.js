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
export const VARIANTEN = { zylinder: ['auswahl'], dichte: ['rho', 'quader', 'umrechnen', 'masse-volumen', 'vergleich', 'verhaeltnis', 'gewichtskraft'] };
export const STUFE_MAX = 3;
export const ETAPPE_MINDEST = [0, 1, 2, 3];
// Baukasten → Thema (für die Stufen-Grenzen)
export const GEN_THEMA = {
  'minus-plus': 'minus-zahlen', 'geld-geschichte': 'minus-zahlen', 'reihenfolge': 'reihenfolge', 'potenz': 'potenzen', 'bruch-bild': 'bruch-bild',
  'prozent': 'prozent', 'baukasten': 'prozent-baukasten', 'prozent-formel': 'prozent-formel', 'rabatt-geschichte': 'rabatt', 'runden': 'runden', 'kugel': 'kugel',
  'einmaleins': 'einmaleins', 'mal10': 'mal-10', 'zylinder': 'zylinder', 'kegel': 'kegel', 'pyramide': 'pyramide',
  'zehnerpotenz': 'zehnerpotenzen', 'einheiten': 'einheiten', 'gewichtskraft': 'gewichtskraft', 'gleichung': 'umstellen', 'formel-umstellen': 'umstellen',
  'dichte': 'dichte'
};
// Schlüssel in „grenzen“: Name eines Baukastens (seit Auftrag 13) oder eines Themas (gilt dann für alle Baukästen des Themas)
export const grenzenSchluesselOk = (k) => !!GEN_THEMA[k] || THEMEN.includes(k);
export function baukaestenVon(k) {
  if (GEN_THEMA[k]) return [k];
  return Object.keys(GEN_THEMA).filter(g => GEN_THEMA[g] === k);
}
const themaVonSchluessel = (k) => GEN_THEMA[k] || (THEMEN.includes(k) ? k : null);
export const VORSCHLAG = { grund: 50, einheit: 40, wiederholung: 10 };

const ganz = (x, min, max, std) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
const datumOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// Etappen eines Pakets prüfen und vereinheitlichen
export function etappenNorm(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.map((e, i) => {
    const grenzen = {};
    for (const [t, g] of Object.entries((e && e.grenzen) || {})) {
      if (!grenzenSchluesselOk(t) || !g || typeof g !== 'object') continue;
      const out = {};
      if (g.stufe_max != null) out.stufe_max = ganz(g.stufe_max, 1, STUFE_MAX, STUFE_MAX);
      const ohne = (Array.isArray(g.ohne) ? g.ohne : []).filter(v => baukaestenVon(t).some(b => (VARIANTEN[b] || []).includes(v)));
      if (ohne.length) out.ohne = ohne;
      grenzen[t] = out;
    }
    return {
      nr: i + 1,
      name: String((e && e.name) || `Etappe ${i + 1}`).slice(0, 60),
      ...(e && e.bogen ? { bogen: String(e.bogen).slice(0, 80) } : {}),
      ...(e && typeof e.logbuch === 'string' && /^[A-Za-z0-9_.-]{1,60}$/.test(e.logbuch) ? { logbuch: e.logbuch } : {}),
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
    // Mindestanteil der aktuellen Etappe: so viele von 10 Aufgaben (Auftrag 18; 0 = aus)
    out.etappe_mindest = ETAPPE_MINDEST.includes(e.etappe_mindest) ? e.etappe_mindest : 2;
  }
  const st = startNorm(e && e.start);
  if (st) out.start = st;
  return out;
}

// ---------- Automatischer Start eines Pakets (Feld start, Auftrag 15, vom Vater freigegeben 2026-10-21) ----------
// start: { wenn: { paket, etappe }, rollen: { id: rolle }, anteile: { id: prozent } }
const idOk = (x) => typeof x === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(x);
export function startNorm(s) {
  if (!s || typeof s !== 'object' || !s.wenn || !idOk(s.wenn.paket)) return null;
  const rollen = {}, anteile = {};
  for (const [id, r] of Object.entries(s.rollen || {})) if (idOk(id) && ROLLEN.includes(r)) rollen[id] = r;
  for (const [id, a] of Object.entries(s.anteile || {})) if (idOk(id) && Number.isFinite(Number(a))) anteile[id] = ganz(a, 0, 100, 0);
  return { wenn: { paket: s.wenn.paket, etappe: ganz(s.wenn.etappe, 1, 99, 1) }, rollen, anteile };
}
// Wartet das Paket auf seinen Start? (start gesetzt, noch nicht begonnen)
export const wartetAufStart = (p) => !!(p && p.start && !(p.etappe > 0));
// Pakete, deren Auslöser erreicht ist
export function startFaellig(liste) {
  return (liste || []).filter(p => p.start && (liste.find(x => x.id === p.start.wenn.paket) || {}).etappe >= p.start.wenn.etappe);
}
// Start ausführen: Etappe 1, Rollen und Anteile aus start, start entfernen. Gibt { paket, ausgeloest_durch, etappe, neu } zurück.
// Pakete, die in anteile fehlen, bekommen 0 %, wenn die genannten Anteile zusammen 100 ergeben.
export function startAusfuehren(liste, id) {
  const p = (liste || []).find(x => x.id === id);
  if (!p || !p.start) return null;
  const st = p.start;
  const neu = !(p.etappe > 0);
  if ((p.paket.etappen || []).length) p.etappe = Math.max(1, p.etappe || 0);
  delete p.naechste;
  for (const [pid, r] of Object.entries(st.rollen)) { const x = liste.find(y => y.id === pid); if (x) x.rolle = r; }
  const genannt = Object.entries(st.anteile).filter(([pid]) => liste.some(y => y.id === pid));
  if (genannt.reduce((s, [, a]) => s + a, 0) === 100) for (const x of liste) x.anteil = st.anteile[x.id] || 0;
  else for (const [pid, a] of genannt) liste.find(y => y.id === pid).anteil = a;
  // genau ein Grundpaket
  let grund = false;
  for (const x of liste) { if (x.rolle === 'grund') { if (grund) x.rolle = 'einheit'; grund = true; } }
  if (!grund && liste.length) liste[0].rolle = 'grund';
  delete p.start;
  return { paket: p.id, ausgeloest_durch: st.wenn.paket, etappe: p.etappe, neu };
}
// Text für die Eltern-App: „startet, wenn Masse und Gewichtskraft Etappe 4 erreicht“
export function startText(p, liste) {
  if (!p || !p.start) return '';
  const w = (liste || []).find(x => x.id === p.start.wenn.paket);
  return `startet, wenn ${w ? w.paket.name : p.start.wenn.paket} Etappe ${p.start.wenn.etappe} erreicht`;
}
// Start in der Einstellungsdatei ausführen (für die Übungs-App). Gibt die neue Datei zurück oder null.
export function startInDatei(datei, id, jetzt = new Date()) {
  const w = datei && datei.werte;
  if (!w || !Array.isArray(w.pakete)) return null;
  const roh = w.pakete.find(x => x && x.id === id);
  if (!roh || !roh.start) return null;
  const liste = w.pakete.map(x => ({ ...x }));
  // gleiche Regeln wie startAusfuehren, aber auf den Rohdaten (Inhalt der Pakete bleibt unverändert)
  const norm = liste.map(x => eintragNorm(x));
  const info = startAusfuehren(norm, id);
  if (!info) return null;
  const pakete = liste.map((x, i) => {
    const n = norm[i];
    const out = { ...x, rolle: n.rolle, anteil: n.anteil };
    if (n.etappe != null) out.etappe = n.etappe;
    if (x.id === id) { delete out.start; delete out.naechste; }
    return out;
  });
  return { ...datei, version: (Number(datei.version) || 0) + 1, geaendert: jetzt.toISOString(), werte: { ...w, pakete } };
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
// Regeln (bestätigt vom Aufgaben-Chat, 2026-10-21, 12-lerneinheiten-und-pakete.md):
// 1. Ein Baukasten, der in einer Etappe des Pakets in grenzen steht, kommt erst ab der Etappe, in der er zum ersten Mal genannt ist.
// 2. Die zuletzt genannte Grenze gilt weiter, bis er neu genannt wird.
// 3. Eine neue Nennung ersetzt die alte vollständig (ein früheres „ohne“ fällt weg).
// 4. Ein Baukasten, der nirgends genannt ist, ist frei (wenn sein Thema gewichtet ist).
// Mehrere Pakete: Das Großzügigste gilt. Pool-Aufgaben: wie bisher über die Aufgabenlisten der Etappen.
// Ergebnis: { stufeMax: {baukasten: n}, ohne: {baukasten: [..]}, genGesperrt: Set(baukasten), pool: {thema: Set(ids)}, gesperrt: Set(thema) }
export function grenzenVon(liste, themaVon, poolIds = []) {
  const stufeMax = {}, ohne = {}, pool = {}, gesperrt = new Set(), genGesperrt = new Set();
  const themaJe = {}; // thema → je Paket { ids } oder null (noch nicht begonnen)
  const genJe = {};   // baukasten → je Paket { stufe, ohne } oder null (noch nicht dran)
  for (const p of liste || []) {
    if (!hatEtappen(p)) continue;
    const et = p.paket.etappen;
    const gelistet = new Set(et.flatMap(e => e.aufgaben || []));
    const schluessel = [...new Set(et.flatMap(e => Object.keys(e.grenzen || {})))];
    const themen = new Set([...schluessel.map(themaVonSchluessel), ...[...gelistet].map(themaVon)].filter(Boolean));
    for (const t of themen) {
      const s = themaJe[t] || (themaJe[t] = []);
      if (!(p.etappe > 0)) { s.push(null); continue; }
      const ids = new Set(et.slice(0, p.etappe).flatMap(e => e.aufgaben || []).filter(id => themaVon(id) === t));
      if (p.etappe === et.length) for (const id of poolIds) if (themaVon(id) === t && !gelistet.has(id)) ids.add(id);
      s.push({ ids });
    }
    const gens = new Set(schluessel.flatMap(baukaestenVon));
    for (const b of gens) {
      const s = genJe[b] || (genJe[b] = []);
      let eintrag = null;
      for (let i = 0; i < Math.min(p.etappe || 0, et.length); i++) {
        for (const [k, g] of Object.entries(et[i].grenzen || {})) if (baukaestenVon(k).includes(b)) eintrag = g || {};
      }
      s.push(eintrag ? { stufe: eintrag.stufe_max || null, ohne: eintrag.ohne || [] } : null);
    }
  }
  for (const [t, l] of Object.entries(themaJe)) {
    const offen = l.filter(Boolean);
    if (!offen.length) { gesperrt.add(t); continue; }
    pool[t] = new Set(offen.flatMap(x => [...x.ids]));
  }
  for (const [b, l] of Object.entries(genJe)) {
    const offen = l.filter(Boolean);
    if (!offen.length) { genGesperrt.add(b); continue; }
    if (offen.every(x => x.stufe)) stufeMax[b] = Math.max(...offen.map(x => x.stufe));
    const gem = offen.map(x => x.ohne).reduce((a, c) => a.filter(v => c.includes(v)));
    if (gem.length) ohne[b] = gem;
  }
  return { stufeMax, ohne, pool, gesperrt, genGesperrt };
}

// Darf dieser Baukasten gerade kommen, und bis zu welcher Stufe?
export function baukastenGrenze(b, gr) {
  if (!gr) return { gesperrt: false, stufeMax: STUFE_MAX, ohne: [] };
  return { gesperrt: gr.genGesperrt.has(b) || gr.gesperrt.has(GEN_THEMA[b]), stufeMax: gr.stufeMax[b] || STUFE_MAX, ohne: gr.ohne[b] || [] };
}

// Darf diese Aufgabe gerade kommen (Etappen-Grenzen)?
export function aufgabeErlaubt(a, gr) {
  if (!a || !gr) return true;
  const t = a.thema;
  if (gr.gesperrt.has(t)) return false;
  if (!a.generator) return !gr.pool[t] || gr.pool[t].has(a.id);
  const bg = baukastenGrenze(a.generator, gr);
  if (bg.gesperrt) return false;
  if ((a.stufe || 1) > bg.stufeMax) return false;
  if (bg.ohne.includes('auswahl') && (a.schritte || []).some(s => s.optionen)) return false;
  if (a.variante && bg.ohne.includes(a.variante)) return false;
  return true;
}

// Mindestanteil der aktuellen Etappe einer Lerneinheit (Auftrag 18). Zählt: Baukasten ab der Stufe stufe_max
// dieser Etappe und Pool-Aufgaben dieser Etappe. Detektiv-Aufgaben zählen nicht. abstand: spätestens so viele Aufgaben bis zur nächsten
// (Auftrag 23: so gewählt, dass in je 10 Aufgaben hintereinander mindestens etappe_mindest davon kommen).
export function neueEtappe(p) {
  if (!p || p.rolle !== 'einheit' || !hatEtappen(p) || !(p.etappe > 0) || !(p.anteil > 0) || !(p.etappe_mindest > 0)) return null;
  const e = p.paket.etappen[p.etappe - 1];
  if (!e) return null;
  const gens = [];
  for (const [k, g] of Object.entries(e.grenzen || {})) if (g && g.stufe_max) for (const b of baukaestenVon(k)) gens.push({ generator: b, stufe: g.stufe_max });
  return { paket: p.id, etappe: p.etappe, mindest: p.etappe_mindest, abstand: Math.max(1, Math.floor(9 / p.etappe_mindest)), gens, ids: e.aufgaben || [] };
}
export function zaehltFuerEtappe(a, ne) {
  if (!a || !ne || a.typ === 'detektiv') return false;
  if (a.generator) return ne.gens.some(x => x.generator === a.generator && (a.stufe || 1) >= x.stufe);
  return ne.ids.includes(a.id);
}

// Anteile nach Übungszeit (Auftrag 23): Liegt der Zeitanteil eines Pakets heute deutlich unter seinem Anteil,
// kommt die nächste Aufgabe aus diesem Paket. msJe: { paketId: Arbeitszeit heute in ms }, n: Aufgaben heute.
// Gibt das Paket mit dem größten Rückstand zurück (mindestens schwelle Prozentpunkte), sonst null.
export function paketAusgleich(liste, msJe, n, { abAufgaben = 5, schwelle = 10 } = {}) {
  const ps = (liste || []).filter(p => p.anteil > 0);
  if (ps.length < 2 || n < abAufgaben) return null;
  const plan = ps.reduce((s, p) => s + p.anteil, 0);
  const ist = ps.reduce((s, p) => s + ((msJe || {})[p.id] || 0), 0);
  if (!plan || !ist) return null;
  let best = null;
  for (const p of ps) {
    const rueck = p.anteil / plan * 100 - ((msJe || {})[p.id] || 0) / ist * 100;
    if (rueck >= schwelle && (!best || rueck > best.rueck)) best = { paket: p, rueck, plan: Math.round(p.anteil / plan * 100), ist: Math.round(((msJe || {})[p.id] || 0) / ist * 100) };
  }
  return best;
}

// Etappe offen? Hat sie einen Logbuch-Eintrag, muss er geschrieben sein (sonst „kommt bald“).
// logbuch: Liste der Einträge aus data/logbuch.json
export function etappeOffen(paket, nr, logbuch) {
  const e = ((paket && paket.etappen) || [])[nr - 1];
  if (!e) return false;
  if (!e.logbuch) return true;
  const lb = (logbuch || []).find(x => x.id === e.logbuch);
  return !!(lb && Array.isArray(lb.absaetze) && lb.absaetze.length);
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
  const gut = letzte.filter(r => r.ende && r.ende.ergebnis === 'erst' && !r.ende.gleiche_aufgabe && !r.ende.hilfe && !((r.ende.hinweiseLang || []).length) && !r.ende.langHalb).length;
  return { anzahl: letzte.length, gut, sitzt: letzte.length >= 10 && gut >= 8 };
}
