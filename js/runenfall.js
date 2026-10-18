// Runenfall: fallende Runensteine zu vollen Reihen legen (wie das klassische Klötzchen-Spiel).
// Reine Logik ohne DOM (testbar mit node). Anzeige in runenfall-ui.js.

export const BREITE = 10, HOEHE = 20;

// Formen als Zellen im 4×4-Raster (Zeile, Spalte), Drehung im Uhrzeigersinn um die Mitte des Rasters
export const FORMEN = {
  I: { farbe: 1, zellen: [[1, 0], [1, 1], [1, 2], [1, 3]], groesse: 4 },
  O: { farbe: 2, zellen: [[0, 1], [0, 2], [1, 1], [1, 2]], groesse: 4 },
  T: { farbe: 3, zellen: [[0, 1], [1, 0], [1, 1], [1, 2]], groesse: 3 },
  S: { farbe: 4, zellen: [[0, 1], [0, 2], [1, 0], [1, 1]], groesse: 3 },
  Z: { farbe: 5, zellen: [[0, 0], [0, 1], [1, 1], [1, 2]], groesse: 3 },
  J: { farbe: 6, zellen: [[0, 0], [1, 0], [1, 1], [1, 2]], groesse: 3 },
  L: { farbe: 7, zellen: [[0, 2], [1, 0], [1, 1], [1, 2]], groesse: 3 }
};
const NAMEN = Object.keys(FORMEN);
export const PUNKTE_REIHEN = [0, 100, 300, 500, 800];
const VERSUCHE = [[0, 0], [0, -1], [0, 1], [-1, 0], [0, -2], [0, 2], [1, 0]];

// Zufall mit Startwert (damit ein gespeichertes Spiel gleich weiterläuft)
function zufall(s) {
  s.zufall = (s.zufall + 0x6D2B79F5) >>> 0;
  let t = s.zufall;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Beutel mit allen 7 Formen, gemischt: keine langen Durststrecken ohne den langen Stein
function nachziehen(s) {
  while (s.naechste.length < 4) {
    if (!s.beutel.length) {
      const b = NAMEN.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(zufall(s) * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      s.beutel = b;
    }
    s.naechste.push(s.beutel.shift());
  }
}

export function zellenVon(form, dreh) {
  const f = FORMEN[form], n = f.groesse;
  return f.zellen.map(([r, c]) => {
    let rr = r, cc = c;
    for (let k = 0; k < ((dreh % 4) + 4) % 4; k++) [rr, cc] = [cc, n - 1 - rr];
    return [rr, cc];
  });
}

export function neuesSpiel(startwert = Date.now(), rekord = 0) {
  const s = { feld: new Array(BREITE * HOEHE).fill(0), teil: null, naechste: [], beutel: [], zufall: startwert >>> 0,
    punkte: 0, reihen: 0, stufe: 1, teile: 0, vorbei: false, rekord };
  nachziehen(s);
  neuesTeil(s);
  return s;
}

// Fallzeit in ms je Stufe: sanft schneller, nie hektisch
export const fallMs = (stufe) => Math.max(220, Math.round(900 * Math.pow(0.86, stufe - 1)));

export function passt(s, form, dreh, r, c) {
  for (const [dr, dc] of zellenVon(form, dreh)) {
    const rr = r + dr, cc = c + dc;
    if (cc < 0 || cc >= BREITE || rr >= HOEHE) return false;
    if (rr >= 0 && s.feld[rr * BREITE + cc]) return false;
  }
  return true;
}

function neuesTeil(s) {
  const form = s.naechste.shift();
  nachziehen(s);
  const c = form === 'O' ? 3 : 3, r = form === 'I' ? -1 : 0;
  s.teil = { form, dreh: 0, r, c };
  if (!passt(s, form, 0, r, c)) {
    // Eine Zeile höher versuchen, sonst ist das Feld voll
    if (passt(s, form, 0, r - 1, c)) s.teil.r = r - 1;
    else { s.vorbei = true; if (s.punkte > s.rekord) s.rekord = s.punkte; }
  }
}

export function bewegen(s, dc) {
  const t = s.teil;
  if (s.vorbei || !t || !passt(s, t.form, t.dreh, t.r, t.c + dc)) return false;
  t.c += dc;
  return true;
}

// Drehen mit kleinem Ausweichen an Wänden und Steinen
export function drehen(s, richtung = 1) {
  const t = s.teil;
  if (s.vorbei || !t || t.form === 'O') return false;
  const d = (t.dreh + richtung + 4) % 4;
  for (const [dr, dc] of VERSUCHE) {
    if (passt(s, t.form, d, t.r + dr, t.c + dc)) { t.dreh = d; t.r += dr; t.c += dc; return true; }
  }
  return false;
}

// Wie tief würde das Teil fallen (Schatten)
export function geistZeile(s) {
  const t = s.teil;
  let r = t.r;
  while (passt(s, t.form, t.dreh, r + 1, t.c)) r++;
  return r;
}

export const liegtAuf = (s) => !!s.teil && !passt(s, s.teil.form, s.teil.dreh, s.teil.r + 1, s.teil.c);

// Eine Zeile tiefer. weich = vom Spieler gedrückt (1 Punkt pro Zeile). Gibt true zurück, wenn es ging.
export function runter(s, weich = false) {
  const t = s.teil;
  if (s.vorbei || !t || liegtAuf(s)) return false;
  t.r++;
  if (weich) s.punkte++;
  return true;
}

// Teil festlegen, volle Reihen abräumen. Gibt { reihen: [Zeilennummern], punkte, stufeHoch, zellen } zurück.
export function festlegen(s) {
  const t = s.teil;
  if (s.vorbei || !t) return null;
  const farbe = FORMEN[t.form].farbe;
  const zellen = [];
  let ueberRand = false;
  for (const [dr, dc] of zellenVon(t.form, t.dreh)) {
    const r = t.r + dr, c = t.c + dc;
    if (r < 0) { ueberRand = true; continue; }
    s.feld[r * BREITE + c] = farbe;
    zellen.push(r * BREITE + c);
  }
  s.teile++;
  const reihen = [];
  for (let r = 0; r < HOEHE; r++) {
    let voll = true;
    for (let c = 0; c < BREITE; c++) if (!s.feld[r * BREITE + c]) { voll = false; break; }
    if (voll) reihen.push(r);
  }
  for (const r of reihen) {
    s.feld.splice(r * BREITE, BREITE);
    s.feld.unshift(...new Array(BREITE).fill(0));
  }
  const vorherStufe = s.stufe;
  const plus = PUNKTE_REIHEN[reihen.length] * s.stufe;
  s.punkte += plus;
  s.reihen += reihen.length;
  s.stufe = 1 + Math.floor(s.reihen / 10);
  s.teil = null;
  if (ueberRand) { s.vorbei = true; if (s.punkte > s.rekord) s.rekord = s.punkte; }
  else neuesTeil(s);
  return { reihen, punkte: plus, stufeHoch: s.stufe > vorherStufe, zellen, farbe, leer: reihen.length > 0 && s.feld.every(x => !x) };
}

// Ganz nach unten fallen lassen (2 Punkte pro Zeile) und festlegen
export function ganzRunter(s) {
  if (s.vorbei || !s.teil) return null;
  const ziel = geistZeile(s);
  const weg = ziel - s.teil.r;
  s.punkte += 2 * weg;
  s.teil.r = ziel;
  return { weg, ...festlegen(s) };
}

export function neuStarten(s, startwert = Date.now()) {
  return neuesSpiel(startwert, Math.max(s ? s.rekord || 0 : 0, s ? s.punkte || 0 : 0));
}

// Gespeicherten Stand prüfen (ältere oder kaputte Stände ersetzen)
export function standPruefen(st) {
  if (!st || !Array.isArray(st.feld) || st.feld.length !== BREITE * HOEHE || !Array.isArray(st.naechste)) return null;
  if (st.teil && !FORMEN[st.teil.form]) return null;
  return { ...st, beutel: Array.isArray(st.beutel) ? st.beutel : [] };
}
