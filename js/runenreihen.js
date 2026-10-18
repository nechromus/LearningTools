// Runenreihen: drei gleiche Runensteine in eine Reihe tauschen (wie die klassischen Edelstein-Spiele).
// Reine Logik ohne DOM (testbar mit node). Anzeige in runenreihen-ui.js.
//
// Stein: { id, a, s }  a = Art 0–5 (Sternrune: -1), s = 0 normal, 1 Funke waagerecht (räumt Zeile), 2 Funke senkrecht (räumt Spalte), 3 Sternrune

export const N = 8;
export const ARTEN = 6;
export const STERN = 3;
const PUNKTE_STEIN = 10;

// Punkte, die eine Stufe braucht (sanft steigend)
export const zielPunkte = (stufe) => 500 + 250 * (stufe - 1);

function zufall(s) {
  s.zufall = (s.zufall + 0x6D2B79F5) >>> 0;
  let t = s.zufall;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const zufallArt = (s) => Math.floor(zufall(s) * ARTEN);
const neuerStein = (s, a, sp = 0) => ({ id: s.naechsteId++, a, s: sp });

export const zeile = (i) => Math.floor(i / N);
export const spalte = (i) => i % N;
export const nachbarn = (a, b) => Math.abs(zeile(a) - zeile(b)) + Math.abs(spalte(a) - spalte(b)) === 1;
const gleich = (x, y) => !!x && !!y && x.s !== STERN && y.s !== STERN && x.a === y.a;

// Alle Reihen aus 3 oder mehr gleichen Steinen
export function reihenFinden(feld) {
  const reihen = [];
  for (const richtung of ['h', 'v']) {
    for (let k = 0; k < N; k++) {
      let start = 0;
      for (let j = 1; j <= N; j++) {
        const idx = (m) => (richtung === 'h' ? k * N + m : m * N + k);
        if (j < N && gleich(feld[idx(j)], feld[idx(start)])) continue;
        if (j - start >= 3) reihen.push({ richtung, a: feld[idx(start)].a, zellen: Array.from({ length: j - start }, (_, m) => idx(start + m)) });
        start = j;
      }
    }
  }
  return reihen;
}

// Reihen, die sich Zellen teilen, gehören zu einer Gruppe (L- und T-Formen)
function gruppen(reihen) {
  const gr = [];
  for (const r of reihen) {
    const passend = gr.filter(g => r.zellen.some(z => g.zellen.has(z)));
    const neu = { reihen: [r], zellen: new Set(r.zellen), a: r.a };
    for (const g of passend) { neu.reihen.push(...g.reihen); g.zellen.forEach(z => neu.zellen.add(z)); gr.splice(gr.indexOf(g), 1); }
    gr.push(neu);
  }
  return gr;
}

function hatTreffer(feld, i) {
  const x = feld[i];
  if (!x || x.s === STERN) return false;
  const r = zeile(i), c = spalte(i);
  let h = 1, v = 1;
  for (let k = c - 1; k >= 0 && gleich(feld[r * N + k], x); k--) h++;
  for (let k = c + 1; k < N && gleich(feld[r * N + k], x); k++) h++;
  for (let k = r - 1; k >= 0 && gleich(feld[k * N + c], x); k--) v++;
  for (let k = r + 1; k < N && gleich(feld[k * N + c], x); k++) v++;
  return Math.max(h, v) >= 3 ? Math.max(h, v) : 0;
}

// Ist dieser Tausch erlaubt? (macht eine Reihe oder benutzt eine Sternrune)
export function tauschGueltig(s, a, b) {
  if (a < 0 || b < 0 || a >= N * N || b >= N * N || !nachbarn(a, b)) return false;
  const f = s.feld;
  if (f[a].s === STERN || f[b].s === STERN) return true;
  if (f[a].a === f[b].a) return false;
  [f[a], f[b]] = [f[b], f[a]];
  const ok = hatTreffer(f, a) || hatTreffer(f, b);
  [f[a], f[b]] = [f[b], f[a]];
  return !!ok;
}

// Ein möglicher Zug (für den Tipp): der mit der längsten Reihe
export function zugFinden(s) {
  let best = null, bestWert = 0;
  for (let i = 0; i < N * N; i++) {
    for (const j of [spalte(i) < N - 1 ? i + 1 : -1, zeile(i) < N - 1 ? i + N : -1]) {
      if (j < 0 || !tauschGueltig(s, i, j)) continue;
      const f = s.feld;
      let wert;
      if (f[i].s === STERN || f[j].s === STERN) wert = 6;
      else { [f[i], f[j]] = [f[j], f[i]]; wert = Math.max(hatTreffer(f, i), hatTreffer(f, j)); [f[i], f[j]] = [f[j], f[i]]; }
      if (wert > bestWert) { best = [i, j]; bestWert = wert; }
    }
  }
  return best;
}

function fuellen(s) {
  for (let i = 0; i < N * N; i++) {
    let a;
    do { a = zufallArt(s); }
    while ((spalte(i) >= 2 && s.feld[i - 1].a === a && s.feld[i - 2].a === a) || (zeile(i) >= 2 && s.feld[i - N].a === a && s.feld[i - 2 * N].a === a));
    s.feld[i] = neuerStein(s, a);
  }
}

export function neuesSpiel(startwert = Date.now(), rekord = 0) {
  const s = { feld: new Array(N * N).fill(null), naechsteId: 1, zufall: startwert >>> 0, punkte: 0, rekord, stufe: 1, stufePunkte: 0, zuege: 0, besteKette: 0 };
  do fuellen(s); while (!zugFinden(s));
  return s;
}

// Steine neu mischen, bis keine Reihe fertig liegt und ein Zug möglich ist
export function mischen(s) {
  const steine = s.feld.slice();
  for (let versuch = 0; versuch < 200; versuch++) {
    for (let i = steine.length - 1; i > 0; i--) { const j = Math.floor(zufall(s) * (i + 1)); [steine[i], steine[j]] = [steine[j], steine[i]]; }
    s.feld = steine.slice();
    if (!reihenFinden(s.feld).length && zugFinden(s)) return true;
  }
  // Notfall: neu füllen (Sondersteine gehen dabei verloren)
  do fuellen(s); while (!zugFinden(s));
  return true;
}

// Häufigste Art auf dem Feld (für Sternrunen, die von einer Funke getroffen werden)
function haeufigsteArt(feld) {
  const z = new Array(ARTEN).fill(0);
  for (const x of feld) if (x && x.s !== STERN) z[x.a]++;
  return z.indexOf(Math.max(...z));
}

// Weg-Menge ausweiten: getroffene Sondersteine lösen aus
function ausloesen(s, weg, geschuetzt, linien) {
  const f = s.feld, offen = [...weg], erledigt = new Set();
  while (offen.length) {
    const i = offen.pop();
    if (erledigt.has(i)) continue;
    erledigt.add(i);
    const x = f[i];
    if (!x || !x.s) continue;
    let neu = [];
    if (x.s === 1) { linien.push({ typ: 'zeile', n: zeile(i), zelle: i }); neu = Array.from({ length: N }, (_, k) => zeile(i) * N + k); }
    else if (x.s === 2) { linien.push({ typ: 'spalte', n: spalte(i), zelle: i }); neu = Array.from({ length: N }, (_, k) => k * N + spalte(i)); }
    else if (x.s === STERN) { const art = haeufigsteArt(f); linien.push({ typ: 'stern', art, zelle: i }); neu = f.map((y, k) => (y && y.s !== STERN && y.a === art ? k : -1)).filter(k => k >= 0); }
    for (const k of neu) if (!weg.has(k) && !geschuetzt.has(k)) { weg.add(k); offen.push(k); }
  }
}

// Steine fallen lassen und oben auffüllen
function fallen(s) {
  const bewegt = [], neu = [];
  for (let c = 0; c < N; c++) {
    let ziel = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      const x = s.feld[r * N + c];
      if (!x) continue;
      if (r !== ziel) { s.feld[ziel * N + c] = x; s.feld[r * N + c] = null; bewegt.push({ id: x.id, nach: ziel * N + c }); }
      ziel--;
    }
    const anzahl = ziel + 1;
    for (let r = ziel; r >= 0; r--) {
      const x = neuerStein(s, zufallArt(s));
      s.feld[r * N + c] = x;
      neu.push({ id: x.id, a: x.a, s: 0, nach: r * N + c, von: r - anzahl });
    }
  }
  return { typ: 'fall', bewegt, neu };
}

function stufeZaehlen(s, punkte, erg) {
  s.punkte += punkte;
  s.stufePunkte += punkte;
  while (s.stufePunkte >= zielPunkte(s.stufe)) {
    s.stufePunkte -= zielPunkte(s.stufe);
    erg.stufen.push(s.stufe);
    s.stufe++;
  }
  if (s.punkte > s.rekord) s.rekord = s.punkte;
}

// Tauschen und alles auflösen. Gibt null zurück, wenn der Tausch nicht geht.
// Sonst { schritte: [...], punkte, kette, stufen: [geschaffte Stufen], gemischt }
export function tauschen(s, a, b) {
  if (!tauschGueltig(s, a, b)) return null;
  const f = s.feld;
  const erg = { schritte: [{ typ: 'tausch', a, b, ids: [f[a].id, f[b].id] }], punkte: 0, kette: 0, stufen: [], gemischt: false };
  [f[a], f[b]] = [f[b], f[a]];
  s.zuege++;
  let kette = 0;

  // Sternrune getauscht: räumt alle Steine einer Art
  if (f[a].s === STERN || f[b].s === STERN) {
    kette = 1;
    const weg = new Set(), linien = [];
    const sterne = [a, b].filter(i => f[i].s === STERN);
    if (sterne.length === 2) { for (let i = 0; i < N * N; i++) weg.add(i); linien.push({ typ: 'alles', zelle: b }); }
    else {
      const andere = sterne[0] === a ? b : a, art = f[andere].a;
      f.forEach((x, i) => { if (x.s !== STERN && x.a === art) weg.add(i); });
      linien.push({ typ: 'stern', art, zelle: sterne[0] });
      // Getroffene Funken lösen ihre Linie aus; die getauschte Sternrune selbst nicht noch einmal
      ausloesen(s, weg, new Set([sterne[0]]), linien);
      weg.add(sterne[0]);
    }
    const punkte = weg.size * PUNKTE_STEIN + 50;
    erg.schritte.push({ typ: 'weg', zellen: [...weg], ids: [...weg].map(i => f[i].id), kette, punkte, linien, neuSpezial: [] });
    stufeZaehlen(s, punkte, erg); erg.punkte += punkte;
    for (const i of weg) f[i] = null;
    erg.schritte.push(fallen(s));
  }

  // Reihen auflösen, solange neue entstehen
  let bevorzugt = [a, b];
  for (;;) {
    const reihen = reihenFinden(f);
    if (!reihen.length) break;
    kette++;
    const weg = new Set(), geschuetzt = new Set(), neuSpezial = [], linien = [];
    let bonus = 0;
    for (const g of gruppen(reihen)) {
      const laengste = Math.max(...g.reihen.map(r => r.zellen.length));
      const kreuz = g.reihen.some(r => r.richtung === 'h') && g.reihen.some(r => r.richtung === 'v');
      let art = 0;
      if (laengste >= 5 || kreuz) art = STERN;
      else if (laengste === 4) art = g.reihen[0].richtung === 'h' ? 1 : 2;
      let ort = -1;
      if (art) {
        ort = bevorzugt.find(i => g.zellen.has(i) && !f[i].s) ?? -1;
        if (ort < 0) {
          const r = g.reihen.reduce((x, y) => (y.zellen.length > x.zellen.length ? y : x));
          ort = r.zellen.find((z, k) => k >= Math.floor(r.zellen.length / 2) - 1 && !f[z].s) ?? -1;
        }
      }
      g.zellen.forEach(z => { if (z !== ort) weg.add(z); });
      if (ort >= 0) {
        geschuetzt.add(ort);
        neuSpezial.push({ zelle: ort, art });
        bonus += art === STERN ? 50 : 20;
      }
    }
    ausloesen(s, weg, geschuetzt, linien);
    const punkte = weg.size * PUNKTE_STEIN * kette + bonus;
    const schritt = { typ: 'weg', zellen: [...weg], ids: [...weg].map(i => f[i].id), kette, punkte, linien, neuSpezial: [] };
    for (const { zelle, art } of neuSpezial) {
      const x = f[zelle];
      x.s = art;
      if (art === STERN) x.a = -1;
      schritt.neuSpezial.push({ id: x.id, zelle, a: x.a, s: x.s });
    }
    erg.schritte.push(schritt);
    stufeZaehlen(s, punkte, erg); erg.punkte += punkte;
    for (const i of weg) f[i] = null;
    erg.schritte.push(fallen(s));
    bevorzugt = [];
  }
  erg.kette = kette;
  s.besteKette = Math.max(s.besteKette || 0, kette);

  if (!zugFinden(s)) {
    mischen(s);
    erg.gemischt = true;
    erg.schritte.push({ typ: 'gemischt', orte: s.feld.map((x, i) => ({ id: x.id, nach: i })) });
  }
  return erg;
}

export function neuStarten(s, startwert = Date.now()) {
  return neuesSpiel(startwert, Math.max(s ? s.rekord || 0 : 0, s ? s.punkte || 0 : 0));
}

// Gespeicherten Stand prüfen (kaputte Stände ersetzen)
export function standPruefen(st) {
  if (!st || !Array.isArray(st.feld) || st.feld.length !== N * N) return null;
  for (const x of st.feld) {
    if (!x || typeof x.id !== 'number' || ![0, 1, 2, 3].includes(x.s)) return null;
    if (x.s === STERN ? x.a !== -1 : !(Number.isInteger(x.a) && x.a >= 0 && x.a < ARTEN)) return null;
  }
  if (!(st.stufe >= 1) || typeof st.punkte !== 'number') return null;
  const s = { naechsteId: 1, zufall: 1, rekord: 0, stufePunkte: 0, zuege: 0, besteKette: 0, ...st, feld: st.feld.map(x => ({ ...x })) };
  s.naechsteId = Math.max(s.naechsteId, ...s.feld.map(x => x.id + 1));
  if (reihenFinden(s.feld).length || !zugFinden(s)) mischen(s);
  return s;
}
