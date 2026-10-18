// Jadeschlange: eine Schlange aus Jade sammelt Kristalle (wie das klassische Schlangen-Spiel).
// Reine Logik ohne DOM (testbar mit node). Anzeige in jadeschlange-ui.js.
// Sanft: Am Rand geht es durch Tore auf die andere Seite. Nur ein Biss in den eigenen Körper beendet die Runde.

export const BREITE = 15, HOEHE = 21;
export const RICHTUNGEN = { hoch: [-1, 0], runter: [1, 0], links: [0, -1], rechts: [0, 1] };
const GEGEN = { hoch: 'runter', runter: 'hoch', links: 'rechts', rechts: 'links' };
export const START_LAENGE = 4;
export const KRISTALLE_PRO_STUFE = 10;
export const PUNKTE_KRISTALL = 10, PUNKTE_GOLD = 50;
export const GOLD_TAKTE = 45;          // so lange bleibt ein goldener Kristall liegen
export const MAX_STEINE = 12;

// Zeit pro Schritt: Start etwa 4 Felder pro Sekunde, langsam schneller, höchstens 8 Felder pro Sekunde
export const schrittMs = (kristalle) => Math.max(125, 250 - kristalle * 3);

function zufall(s) {
  s.zufall = (s.zufall + 0x6D2B79F5) >>> 0;
  let t = s.zufall;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Nachbarfeld mit Toren am Rand (oben ↔ unten, links ↔ rechts)
export function weiter(s, i, richtung) {
  const [dr, dc] = RICHTUNGEN[richtung];
  const r = (Math.floor(i / s.w) + dr + s.h) % s.h, c = ((i % s.w) + dc + s.w) % s.w;
  return r * s.w + c;
}

export function neuesSpiel(startwert = Date.now(), rekord = 0) {
  const s = { w: BREITE, h: HOEHE, schlange: [], richtung: 'rechts', puffer: [], kristall: -1, gold: null, steine: [],
    punkte: 0, kristalle: 0, stufe: 1, wachsen: 0, takte: 0, vorbei: false, rekord, zufall: startwert >>> 0, kreuz: false };
  const r = Math.floor(HOEHE / 2), c = Math.floor(BREITE / 2) - 1;
  for (let k = 0; k < START_LAENGE; k++) s.schlange.push(r * BREITE + c - k);
  s.kristall = freiesFeld(s);
  return s;
}

// Felder, die belegt sind (Schlange, Kristalle, Steine)
function belegt(s) {
  const b = new Set(s.schlange);
  if (s.kristall >= 0) b.add(s.kristall);
  if (s.gold) b.add(s.gold.i);
  for (const x of s.steine) b.add(x);
  return b;
}

// Felder direkt vor dem Kopf (bis zu 3 in Laufrichtung) und neben dem Kopf bleiben frei
function vorDemKopf(s) {
  const nah = new Set();
  let i = s.schlange[0];
  for (let k = 0; k < 3; k++) { i = weiter(s, i, s.richtung); nah.add(i); }
  for (const r of Object.keys(RICHTUNGEN)) nah.add(weiter(s, s.schlange[0], r));
  return nah;
}

function freiesFeld(s, auchNichtVorne = true) {
  const b = belegt(s), nah = auchNichtVorne ? vorDemKopf(s) : new Set();
  const frei = [];
  for (let i = 0; i < s.w * s.h; i++) if (!b.has(i) && !nah.has(i)) frei.push(i);
  if (!frei.length) return -1;
  return frei[Math.floor(zufall(s) * frei.length)];
}

// Sind alle freien Felder vom Kopf aus erreichbar? (Steine dürfen nichts abschneiden)
export function allesErreichbar(s) {
  const sperre = new Set([...s.steine, ...s.schlange.slice(1)]);
  const start = s.schlange[0];
  const gesehen = new Set([start]), q = [start];
  while (q.length) {
    const i = q.pop();
    for (const r of Object.keys(RICHTUNGEN)) {
      const n = weiter(s, i, r);
      if (!gesehen.has(n) && !sperre.has(n)) { gesehen.add(n); q.push(n); }
    }
  }
  for (let i = 0; i < s.w * s.h; i++) if (!sperre.has(i) && !gesehen.has(i)) return false;
  return true;
}

// Neue Steine für eine Stufe: nie auf Schlange oder Kristall, nie direkt vor dem Kopf, nichts abschneiden
export function steineSetzen(s, anzahl) {
  const neu = [];
  for (let n = 0; n < anzahl && s.steine.length < MAX_STEINE; n++) {
    for (let versuch = 0; versuch < 40; versuch++) {
      const i = freiesFeld(s);
      if (i < 0) break;
      // nicht direkt neben einem anderen Stein (keine Mauern)
      const nachbarStein = Object.keys(RICHTUNGEN).some(r => s.steine.includes(weiter(s, i, r)));
      if (nachbarStein) continue;
      s.steine.push(i);
      if (allesErreichbar(s)) { neu.push(i); break; }
      s.steine.pop();
    }
  }
  return neu;
}

// Richtung wünschen (Wischen, Taste). Bis zu 2 Wünsche werden gemerkt, Umdrehen in sich selbst wird ignoriert.
export function lenken(s, richtung) {
  if (s.vorbei || !RICHTUNGEN[richtung]) return false;
  const letzte = s.puffer.length ? s.puffer[s.puffer.length - 1] : s.richtung;
  if (richtung === letzte || richtung === GEGEN[letzte]) return false;
  if (s.puffer.length >= 2) return false;
  s.puffer.push(richtung);
  return true;
}

// Ein Schritt. Gibt Ereignisse zurück: kristall, gold, gold_weg, gold_neu, stufe, stein, biss
export function takt(s) {
  if (s.vorbei) return [];
  const ev = [];
  s.takte++;
  if (s.puffer.length) {
    const r = s.puffer.shift();
    if (r !== GEGEN[s.richtung]) s.richtung = r;
  }
  const kopf = weiter(s, s.schlange[0], s.richtung);
  // Schwanzende zieht weiter, außer die Schlange wächst gerade
  const waechst = s.wachsen > 0;
  const koerper = waechst ? s.schlange : s.schlange.slice(0, -1);
  if (koerper.includes(kopf)) {
    s.vorbei = true;
    if (s.punkte > s.rekord) s.rekord = s.punkte;
    ev.push({ art: 'biss', i: kopf });
    return ev;
  }
  s.schlange.unshift(kopf);
  if (waechst) s.wachsen--; else s.schlange.pop();

  // Stein: zerbricht, die Schlange wird etwas kürzer (nie kürzer als am Anfang)
  const st = s.steine.indexOf(kopf);
  if (st >= 0) {
    s.steine.splice(st, 1);
    const weg = Math.min(2, s.schlange.length - START_LAENGE);
    for (let k = 0; k < weg; k++) s.schlange.pop();
    ev.push({ art: 'stein', i: kopf, kuerzer: weg });
  }

  if (kopf === s.kristall) {
    s.kristalle++;
    s.punkte += PUNKTE_KRISTALL * s.stufe;
    s.wachsen++;
    ev.push({ art: 'kristall', i: kopf });
    if (s.kristalle % KRISTALLE_PRO_STUFE === 0) {
      s.stufe++;
      const neu = steineSetzen(s, 2);
      ev.push({ art: 'stufe', stufe: s.stufe, steine: neu });
    }
    s.kristall = freiesFeld(s);
    // ab und zu ein goldener Kristall
    if (!s.gold && s.kristalle >= 3 && zufall(s) < 0.25) {
      const i = freiesFeld(s);
      if (i >= 0) { s.gold = { i, bis: s.takte + GOLD_TAKTE }; ev.push({ art: 'gold_neu', i }); }
    }
  } else if (s.gold && kopf === s.gold.i) {
    s.punkte += PUNKTE_GOLD * s.stufe;
    s.wachsen++;
    ev.push({ art: 'gold', i: kopf });
    s.gold = null;
  }
  if (s.gold && s.takte >= s.gold.bis) { ev.push({ art: 'gold_weg', i: s.gold.i }); s.gold = null; }
  return ev;
}

export function neuStarten(s, startwert = Date.now()) {
  const n = neuesSpiel(startwert, Math.max(s ? s.rekord || 0 : 0, s ? s.punkte || 0 : 0));
  if (s) n.kreuz = !!s.kreuz;
  return n;
}

// Gespeicherten Stand prüfen (ältere oder kaputte Stände ersetzen)
export function standPruefen(st) {
  if (!st || typeof st !== 'object' || st.w !== BREITE || st.h !== HOEHE) return null;
  if (!Array.isArray(st.schlange) || st.schlange.length < 2 || !st.schlange.every(i => Number.isInteger(i) && i >= 0 && i < BREITE * HOEHE)) return null;
  if (new Set(st.schlange).size !== st.schlange.length) return null;
  if (!RICHTUNGEN[st.richtung] || !Number.isInteger(st.kristall)) return null;
  return {
    ...st, puffer: [], steine: Array.isArray(st.steine) ? st.steine.filter(i => Number.isInteger(i)) : [],
    gold: st.gold && Number.isInteger(st.gold.i) ? st.gold : null, punkte: st.punkte || 0, rekord: st.rekord || 0,
    kristalle: st.kristalle || 0, stufe: st.stufe || 1, wachsen: st.wachsen || 0, takte: st.takte || 0, zufall: (st.zufall || 1) >>> 0
  };
}
