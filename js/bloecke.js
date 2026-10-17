// Runenfeld: Formen auf ein 8×8-Feld legen, volle Reihen und Spalten verschwinden.
// Reine Logik ohne DOM (testbar mit node).

export const N = 8;

// Formen als Liste von [Reihe, Spalte]; g = wie oft sie vorkommt
const roh = [
  ['punkt', [[0, 0]], 2],
  ['zwei-h', [[0, 0], [0, 1]], 3], ['zwei-v', [[0, 0], [1, 0]], 3],
  ['drei-h', [[0, 0], [0, 1], [0, 2]], 3], ['drei-v', [[0, 0], [1, 0], [2, 0]], 3],
  ['vier-h', [[0, 0], [0, 1], [0, 2], [0, 3]], 2], ['vier-v', [[0, 0], [1, 0], [2, 0], [3, 0]], 2],
  ['fuenf-h', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], 1], ['fuenf-v', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], 1],
  ['quadrat', [[0, 0], [0, 1], [1, 0], [1, 1]], 3],
  ['gross', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], 1],
  ['rechteck-h', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], 1], ['rechteck-v', [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], 1],
  ['ecke-1', [[0, 0], [1, 0], [1, 1]], 2], ['ecke-2', [[0, 1], [1, 0], [1, 1]], 2],
  ['ecke-3', [[0, 0], [0, 1], [1, 0]], 2], ['ecke-4', [[0, 0], [0, 1], [1, 1]], 2],
  ['l-1', [[0, 0], [1, 0], [2, 0], [2, 1]], 1], ['l-2', [[0, 1], [1, 1], [2, 1], [2, 0]], 1],
  ['l-3', [[0, 0], [0, 1], [1, 0], [2, 0]], 1], ['l-4', [[0, 0], [0, 1], [1, 1], [2, 1]], 1],
  ['l-5', [[0, 0], [0, 1], [0, 2], [1, 0]], 1], ['l-6', [[0, 0], [0, 1], [0, 2], [1, 2]], 1],
  ['l-7', [[0, 0], [1, 0], [1, 1], [1, 2]], 1], ['l-8', [[0, 2], [1, 0], [1, 1], [1, 2]], 1],
  ['t-1', [[0, 0], [0, 1], [0, 2], [1, 1]], 1], ['t-2', [[0, 1], [1, 0], [1, 1], [1, 2]], 1],
  ['t-3', [[0, 0], [1, 0], [1, 1], [2, 0]], 1], ['t-4', [[0, 1], [1, 0], [1, 1], [2, 1]], 1],
  ['s-1', [[0, 1], [0, 2], [1, 0], [1, 1]], 1], ['s-2', [[0, 0], [0, 1], [1, 1], [1, 2]], 1],
  ['s-3', [[0, 0], [1, 0], [1, 1], [2, 1]], 1], ['s-4', [[0, 1], [1, 0], [1, 1], [2, 0]], 1]
];
export const FORMEN = roh.map(([name, zellen, g]) => ({
  name, zellen, g,
  hoehe: Math.max(...zellen.map(z => z[0])) + 1,
  breite: Math.max(...zellen.map(z => z[1])) + 1
}));
export const FARBEN = 6; // Farbnummern 1–6

export const leeresFeld = () => Array(N * N).fill(0);
const form = (t) => FORMEN.find(f => f.name === (t.form || t));

export function passt(feld, t, r, c) {
  const f = form(t);
  if (!f) return false;
  for (const [dr, dc] of f.zellen) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= N || cc >= N || feld[rr * N + cc]) return false;
  }
  return true;
}

export function irgendwoPassend(feld, t) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (passt(feld, t, r, c)) return true;
  return false;
}

// Legt eine Form ab und räumt volle Reihen und Spalten ab.
// Gibt { feld, gelegt: [i], reihen, spalten, geloescht: [i] } zurück.
export function legen(feld, t, r, c) {
  const f = form(t);
  const neu = feld.slice();
  const gelegt = f.zellen.map(([dr, dc]) => (r + dr) * N + (c + dc));
  for (const i of gelegt) neu[i] = t.farbe || 1;
  const reihen = [], spalten = [];
  for (let i = 0; i < N; i++) {
    if (neu.slice(i * N, i * N + N).every(Boolean)) reihen.push(i);
    let voll = true;
    for (let k = 0; k < N; k++) if (!neu[k * N + i]) { voll = false; break; }
    if (voll) spalten.push(i);
  }
  const geloescht = new Set();
  for (const rr of reihen) for (let k = 0; k < N; k++) geloescht.add(rr * N + k);
  for (const cc of spalten) for (let k = 0; k < N; k++) geloescht.add(k * N + cc);
  const farben = {}; // Farben der abgeräumten Felder (für den Effekt)
  for (const i of geloescht) { farben[i] = neu[i]; neu[i] = 0; }
  return { feld: neu, gelegt, reihen, spalten, geloescht: [...geloescht], farben };
}

// Punkte: 1 pro gelegtem Feld, für Linien 10 / 30 / 60 / 100 …, Kombo erhöht den Linienbonus, leeres Feld +300
export function punkte(anzahlGelegt, linien, kombo, feldLeer) {
  const linienBonus = linien ? 10 * linien * (linien + 1) / 2 : 0;
  return anzahlGelegt + linienBonus * (1 + Math.max(0, kombo - 1) * 0.5) + (feldLeer && linien ? 300 : 0);
}

function zufallsForm(rng) {
  const summe = FORMEN.reduce((s, f) => s + f.g, 0);
  let x = rng() * summe;
  for (const f of FORMEN) { x -= f.g; if (x < 0) return f; }
  return FORMEN[0];
}

// Drei neue Formen. Wenn möglich passt mindestens eine davon (weniger Frust).
export function neueTeile(feld, rng = Math.random) {
  let teile;
  for (let versuch = 0; versuch < 30; versuch++) {
    teile = [0, 1, 2].map(() => ({ form: zufallsForm(rng).name, farbe: 1 + Math.floor(rng() * FARBEN) }));
    if (teile.some(t => irgendwoPassend(feld, t))) return teile;
  }
  // Notfalls kleine Formen anbieten
  return teile.map((t, i) => i === 0 ? { form: 'punkt', farbe: t.farbe } : t);
}

export function spielVorbei(feld, teile) {
  const offen = teile.filter(Boolean);
  return offen.length > 0 && !offen.some(t => irgendwoPassend(feld, t));
}

export function neuesSpiel(rng = Math.random) {
  const feld = leeresFeld();
  return { feld, teile: neueTeile(feld, rng), punkte: 0, kombo: 0, ohneLinie: 0 };
}

// Ein Zug im Spielstand (verändert nichts, gibt neuen Stand und Infos zurück)
export function zug(stand, teilNr, r, c, rng = Math.random) {
  const t = stand.teile[teilNr];
  if (!t || !passt(stand.feld, t, r, c)) return null;
  const erg = legen(stand.feld, t, r, c);
  const linien = erg.reihen.length + erg.spalten.length;
  let kombo = stand.kombo || 0, ohneLinie = stand.ohneLinie || 0;
  if (linien) { kombo++; ohneLinie = 0; } else { ohneLinie++; if (ohneLinie >= 3) kombo = 0; }
  const feldLeer = erg.feld.every(x => !x);
  const plus = Math.round(punkte(erg.gelegt.length, linien, kombo, feldLeer));
  let teile = stand.teile.slice();
  teile[teilNr] = null;
  if (teile.every(x => !x)) teile = neueTeile(erg.feld, rng);
  const neu = { ...stand, feld: erg.feld, teile, punkte: (stand.punkte || 0) + plus, kombo, ohneLinie };
  return { stand: neu, ...erg, linien, plus, feldLeer, kombo: linien ? kombo : 0, vorbei: spielVorbei(erg.feld, teile) };
}
