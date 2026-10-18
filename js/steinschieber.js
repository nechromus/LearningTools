// Steinschieber: Runensteine auf Runenfelder schieben (wie Sokoban). Zugbasiert, ohne Zeitdruck.
// Reine Logik ohne DOM (testbar mit node). Die Level stehen in steinschieber-level.js.
import { LEVEL } from './steinschieber-level.js';
export { LEVEL };

// Zeichen: # Wand, - außen, ' ' Boden, . Ziel, $ Stein, * Stein auf Ziel, @ Figur, + Figur auf Ziel
export const RICHTUNGEN = { hoch: [-1, 0], runter: [1, 0], links: [0, -1], rechts: [0, 1] };
const KURZ = { hoch: 'h', runter: 'r', links: 'l', rechts: 'e' };
const LANG = { h: 'hoch', r: 'runter', l: 'links', e: 'rechts' };

// Text-Level in einen Spielstand umwandeln
export function aufbauen(zeilen, nr = 0) {
  const h = zeilen.length, w = Math.max(...zeilen.map(z => z.length));
  const wand = [], ziel = [], aussen = [], kisten = [];
  let figur = -1;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = zeilen[r][c] || '-', i = r * w + c;
    wand.push(ch === '#'); aussen.push(ch === '-');
    ziel.push(ch === '.' || ch === '*' || ch === '+');
    if (ch === '$' || ch === '*') kisten.push(i);
    if (ch === '@' || ch === '+') figur = i;
  }
  // Boden außerhalb der Wände (von außen erreichbar) als außen markieren
  const offen = new Set();
  const rand = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (r === 0 || c === 0 || r === h - 1 || c === w - 1) rand.push(r * w + c);
  for (const i of rand) if (!wand[i] && !offen.has(i)) {
    const stapel = [i]; offen.add(i);
    while (stapel.length) {
      const j = stapel.pop(), r = Math.floor(j / w), c = j % w;
      for (const [dr, dc] of Object.values(RICHTUNGEN)) {
        const nr2 = r + dr, nc = c + dc, k = nr2 * w + nc;
        if (nr2 < 0 || nc < 0 || nr2 >= h || nc >= w || wand[k] || offen.has(k)) continue;
        offen.add(k); stapel.push(k);
      }
    }
  }
  for (const i of offen) aussen[i] = true;
  return {
    nr, w, h, wand, ziel, aussen, start: { kisten: kisten.slice(), figur },
    kisten, figur, zuege: '', schuebe: 0, rueck: 0, tipps: 0, fertig: false
  };
}

export const levelLaden = (n) => aufbauen(LEVEL[n].karte, n);
export const levelName = (n) => LEVEL[n].name;

const nachbar = (s, i, [dr, dc]) => {
  const r = Math.floor(i / s.w) + dr, c = (i % s.w) + dc;
  if (r < 0 || c < 0 || r >= s.h || c >= s.w) return -1;
  return r * s.w + c;
};
const frei = (s, i, kisten = s.kisten) => i >= 0 && !s.wand[i] && !s.aussen[i] && !kisten.includes(i);
export const geloest = (s) => s.kisten.every(k => s.ziel[k]);

// Ein Schritt. Gibt { geschoben: Index der Kiste in s.kisten oder -1 } zurück, oder null, wenn es nicht geht.
export function zug(s, richtung) {
  if (s.fertig) return null;
  const d = RICHTUNGEN[richtung];
  const n = nachbar(s, s.figur, d);
  if (n < 0 || s.wand[n] || s.aussen[n]) return null;
  const k = s.kisten.indexOf(n);
  if (k >= 0) {
    const dahinter = nachbar(s, n, d);
    if (!frei(s, dahinter)) return null;
    s.kisten[k] = dahinter;
    s.schuebe++;
  }
  s.figur = n;
  s.zuege += k >= 0 ? KURZ[richtung].toUpperCase() : KURZ[richtung];
  if (geloest(s)) s.fertig = true;
  return { geschoben: k };
}

// Letzten Schritt zurücknehmen
export function zurueck(s) {
  if (!s.zuege.length) return null;
  const z = s.zuege[s.zuege.length - 1];
  const richtung = LANG[z.toLowerCase()];
  const [dr, dc] = RICHTUNGEN[richtung];
  const vorher = nachbar(s, s.figur, [-dr, -dc]);
  let k = -1;
  if (z !== z.toLowerCase()) {
    k = s.kisten.indexOf(nachbar(s, s.figur, [dr, dc]));
    s.kisten[k] = s.figur;
    s.schuebe--;
  }
  s.figur = vorher;
  s.zuege = s.zuege.slice(0, -1);
  s.fertig = geloest(s);
  s.rueck++;
  return { geschoben: k, richtung };
}

export function neustart(s) {
  s.kisten = s.start.kisten.slice();
  s.figur = s.start.figur;
  s.zuege = ''; s.schuebe = 0; s.fertig = false;
}

// Gespeicherten Stand wiederherstellen (Schritte nachspielen)
export function wiederherstellen(n, gespeichert) {
  const s = levelLaden(n);
  if (gespeichert && typeof gespeichert.zuege === 'string') {
    for (const z of gespeichert.zuege) if (!LANG[z.toLowerCase()] || !zug(s, LANG[z.toLowerCase()])) break;
    s.rueck = gespeichert.rueck || 0; s.tipps = gespeichert.tipps || 0;
  }
  return s;
}

// Weg zu einem Feld laufen, ohne etwas zu schieben (Antippen). Liste der Richtungen oder null.
export function weg(s, ziel) {
  if (!frei(s, ziel)) return null;
  const vor = new Map([[s.figur, null]]);
  const q = [s.figur];
  while (q.length) {
    const i = q.shift();
    if (i === ziel) break;
    for (const [name, d] of Object.entries(RICHTUNGEN)) {
      const n = nachbar(s, i, d);
      if (!frei(s, n) || vor.has(n)) continue;
      vor.set(n, [i, name]); q.push(n);
    }
  }
  if (!vor.has(ziel)) return null;
  const out = [];
  for (let i = ziel; vor.get(i); i = vor.get(i)[0]) out.unshift(vor.get(i)[1]);
  return out;
}

// Felder, von denen eine Kiste nie mehr auf ein Ziel kommt (Ecken, tote Wände)
export function toteFelder(s) {
  const lebt = new Array(s.w * s.h).fill(false);
  const q = [];
  s.ziel.forEach((z, i) => { if (z) { lebt[i] = true; q.push(i); } });
  while (q.length) {
    const i = q.shift();
    for (const d of Object.values(RICHTUNGEN)) {
      // Kiste von i rückwärts nach n ziehen: n und das Feld dahinter müssen Boden sein
      const n = nachbar(s, i, d), m = n >= 0 ? nachbar(s, n, d) : -1;
      if (n < 0 || m < 0 || lebt[n] || s.wand[n] || s.aussen[n] || s.wand[m] || s.aussen[m]) continue;
      lebt[n] = true; q.push(n);
    }
  }
  return lebt.map((l, i) => !l && !s.wand[i] && !s.aussen[i]);
}

// Steine, die sicher feststecken (auf totem Feld, nicht auf Ziel)
export function festeSteine(s) {
  const tot = s._tot || (s._tot = toteFelder(s));
  return s.kisten.map((k, i) => (tot[k] ? i : -1)).filter(i => i >= 0);
}

// Erreichbare Felder der Figur (belegt: Uint8Array mit 1 für Steine). Mit wege = true auch den Weg dorthin.
function erreichbarVon(s, belegt, start, wege = false) {
  const gesehen = new Uint8Array(s.w * s.h);
  const q = [start]; gesehen[start] = 1;
  let min = start;
  const vor = wege ? new Map([[start, null]]) : null;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    if (i < min) min = i;
    for (const name of NAMEN) {
      const n = nachbar(s, i, RICHTUNGEN[name]);
      if (n < 0 || gesehen[n] || s.wand[n] || s.aussen[n] || belegt[n]) continue;
      gesehen[n] = 1; q.push(n);
      if (vor) vor.set(n, [i, name]);
    }
  }
  return { gesehen, min, vor };
}
const NAMEN = Object.keys(RICHTUNGEN);

// Lösung suchen (wenigste Schübe). Gibt { schuebe, erster: { weg, richtung, kiste } }, { gross: true } (Suche zu groß) oder null (keine Lösung).
export function loesen(s, maxZustaende = 150000) {
  const tot = s._tot || (s._tot = toteFelder(s));
  const startKisten = s.kisten.slice();
  if (startKisten.some(k => tot[k] && !s.ziel[k])) return null;
  if (startKisten.every(k => s.ziel[k])) return { schuebe: 0, erster: null };
  const belegt = new Uint8Array(s.w * s.h);
  const setzen = (kisten, v) => { for (const k of kisten) belegt[k] = v; };
  const schluessel = (kisten, min) => kisten.slice().sort((a, b) => a - b).join(',') + '|' + min;
  setzen(startKisten, 1);
  const e0 = erreichbarVon(s, belegt, s.figur, true);
  setzen(startKisten, 0);
  const gesehen = new Set([schluessel(startKisten, e0.min)]);
  // Jeder Eintrag merkt sich den ersten Schub, damit nur der Tipp zurückgegeben werden muss
  let ebene = [{ kisten: startKisten, figur: s.figur, erster: null }];
  for (let tiefe = 1; ebene.length; tiefe++) {
    const naechste = [];
    for (const z of ebene) {
      setzen(z.kisten, 1);
      const e = z.erster ? erreichbarVon(s, belegt, z.figur) : e0;
      for (let ki = 0; ki < z.kisten.length; ki++) {
        const k = z.kisten[ki];
        for (const name of NAMEN) {
          const d = RICHTUNGEN[name];
          const steh = nachbar(s, k, [-d[0], -d[1]]), hin = nachbar(s, k, d);
          if (steh < 0 || !e.gesehen[steh] || hin < 0 || s.wand[hin] || s.aussen[hin] || belegt[hin] || (tot[hin] && !s.ziel[hin])) continue;
          const kisten = z.kisten.slice(); kisten[ki] = hin;
          belegt[k] = 0; belegt[hin] = 1;
          const block = einfrieren(s, belegt, hin);
          const min = block ? 0 : erreichbarVon(s, belegt, k).min;
          belegt[hin] = 0; belegt[k] = 1;
          if (block) continue;
          let erster = z.erster;
          if (!erster) {
            const w = [];
            for (let i = steh; e.vor.get(i); i = e.vor.get(i)[0]) w.unshift(e.vor.get(i)[1]);
            erster = { weg: w, richtung: name, kiste: ki };
          }
          if (kisten.every(x => s.ziel[x])) { setzen(z.kisten, 0); return { schuebe: tiefe, erster }; }
          const key = schluessel(kisten, min);
          if (gesehen.has(key)) continue;
          gesehen.add(key);
          if (gesehen.size > maxZustaende) { setzen(z.kisten, 0); return { gross: true }; }
          naechste.push({ kisten, figur: k, erster });
        }
      }
      setzen(z.kisten, 0);
    }
    ebene = naechste;
  }
  return null;
}

// Einfache Blockade: zwei Steine nebeneinander an einer Wand oder 2×2-Block, nicht alle auf Zielen
function einfrieren(s, belegt, k) {
  const blockiert = (i) => i < 0 || s.wand[i] || s.aussen[i];
  const istKiste = (i) => i >= 0 && belegt[i] === 1;
  const r = Math.floor(k / s.w), c = k % s.w;
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    // Quadrat aus k, k+(dr,dc) und den beiden Feldern senkrecht dazu
    for (const [pr, pc] of dr === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]]) {
      const felder = [[r, c], [r + dr, c + dc], [r + pr, c + pc], [r + dr + pr, c + dc + pc]].map(([a, b]) => (a < 0 || b < 0 || a >= s.h || b >= s.w ? -1 : a * s.w + b));
      if (felder.every(i => blockiert(i) || istKiste(i)) && felder.some(i => istKiste(i) && !s.ziel[i])) return true;
    }
  }
  return false;
}
