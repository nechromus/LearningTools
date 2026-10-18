// Kristallmine: Gräber-Spiel in Echtzeit (Regeln wie beim klassischen Vorbild, eigene Höhlen und Gestaltung).
// Reine Logik ohne DOM (testbar mit node). Ein „Takt“ ist ein Spielschritt (ca. 140 ms).
//
// Zeichen:  # Stahlwand (unzerstörbar)   w Mauer (rund, Steine rollen ab)   . Erde   (Leerzeichen) leer
//           o Stein   * Kristall   E Ausgang   X Explosion

export const TAKT_MS = 140;
export const RICHTUNGEN = { hoch: [-1, 0], runter: [1, 0], links: [0, -1], rechts: [0, 1] };

// Höhlen: zufällig gefüllt (fester Startwert), dazu von Hand gesetzte Mauern. So entstanden auch die klassischen Höhlen.
export const HOEHLEN = [
  { name: 'Erste Ader', w: 26, h: 16, saat: 11, stein: 0.10, kristall: 0.06, leer: 0.04, brauche: 10, zeit: 150, start: [2, 2], ausgang: [13, 23],
    mauern: [] },
  { name: 'Steinschlag', w: 26, h: 16, saat: 23, stein: 0.20, kristall: 0.06, leer: 0.03, brauche: 12, zeit: 150, start: [2, 2], ausgang: [13, 23],
    mauern: [['h', 5, 1, 24, [6, 18]], ['h', 10, 1, 24, [12]]] },
  { name: 'Jadetiefe', w: 28, h: 18, saat: 37, stein: 0.14, kristall: 0.07, leer: 0.03, brauche: 15, zeit: 180, start: [2, 2], ausgang: [16, 26],
    mauern: [['v', 7, 1, 16, [4, 12]], ['v', 14, 1, 16, [8, 15]], ['v', 21, 1, 16, [3, 11]]] }
];

const FAELLT = new Set(['o', '*']);
const RUND = new Set(['o', '*', 'w']);
const SPRENGBAR = new Set(['.', ' ', 'o', '*', 'w', 'E']);

function zufall(saat) {
  let a = saat >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function karteBauen(def) {
  const { w, h } = def;
  const rnd = zufall(def.saat);
  const feld = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (r === 0 || c === 0 || r === h - 1 || c === w - 1) { feld.push('#'); continue; }
    const x = rnd();
    feld.push(x < def.stein ? 'o' : x < def.stein + def.kristall ? '*' : x < def.stein + def.kristall + def.leer ? ' ' : '.');
  }
  const setze = (r, c, ch) => { if (r > 0 && c > 0 && r < h - 1 && c < w - 1) feld[r * w + c] = ch; };
  for (const [art, a, von, bis, luecken] of def.mauern || []) {
    for (let k = von; k <= bis; k++) {
      if ((luecken || []).includes(k)) { if (art === 'h') setze(a, k, '.'); else setze(k, a, '.'); continue; }
      if (art === 'h') setze(a, k, 'w'); else setze(k, a, 'w');
    }
  }
  // Start: ringsum Erde, damit zu Beginn nichts herunterfällt
  const [sr, sc] = def.start;
  for (let r = sr - 1; r <= sr + 1; r++) for (let c = sc - 1; c <= sc + 1; c++) setze(r, c, '.');
  for (let r = 1; r < sr - 1; r++) if (feld[r * w + sc] === 'o' || feld[r * w + sc] === '*') setze(r, sc, '.');
  setze(sr, sc, ' ');
  const [ar, ac] = def.ausgang;
  setze(ar, ac, 'E');
  return feld;
}

export function hoehleLaden(nr) {
  const def = HOEHLEN[nr];
  const feld = karteBauen(def);
  const gesamt = feld.filter(x => x === '*').length;
  return {
    nr, name: def.name, w: def.w, h: def.h, feld,
    faellt: new Array(feld.length).fill(false),
    pr: def.start[0], pc: def.start[1],
    kristalle: 0, brauche: Math.min(def.brauche, gesamt), gesamt,
    punkte: 0, zeit: def.zeit, zeitMs: 0, takte: 0,
    schieben: 0, explosion: [], lebt: true, ende: null // null | 'treffer' | 'zeit' | 'geschafft'
  };
}

export const offen = (s) => s.kristalle >= s.brauche;
const an = (s, r, c) => (r < 0 || c < 0 || r >= s.h || c >= s.w) ? '#' : s.feld[r * s.w + c];

// Ein Takt. richtung: 'hoch' | 'runter' | 'links' | 'rechts' | null. Ändert den Stand und gibt Ereignisse zurück.
// Ereignisse: { art: 'kristall'|'offen'|'schieben'|'landen'|'explosion'|'geschafft'|'zeit'|'ticken', r, c }
export function takt(s, richtung) {
  const ev = [];
  if (s.ende) return ev;
  s.takte++;
  // Explosionen klingen ab
  if (s.explosion.length) {
    s.explosion = s.explosion.filter(x => { x.t--; if (x.t <= 0) { if (s.feld[x.i] === 'X') s.feld[x.i] = x.danach || ' '; return false; } return true; });
    if (!s.lebt && !s.explosion.length) { s.ende = 'treffer'; return ev; }
  }
  if (s.lebt) figurBewegen(s, richtung, ev);
  if (s.ende) return ev;
  schwerkraft(s, ev);
  // Zeit
  if (s.lebt) {
    s.zeitMs += TAKT_MS;
    while (s.zeitMs >= 1000) {
      s.zeitMs -= 1000; s.zeit--;
      if (s.zeit <= 10 && s.zeit > 0) ev.push({ art: 'ticken' });
      if (s.zeit <= 0) { s.zeit = 0; s.lebt = false; s.ende = 'zeit'; ev.push({ art: 'zeit' }); break; }
    }
  }
  return ev;
}

function figurBewegen(s, richtung, ev) {
  if (!richtung || !RICHTUNGEN[richtung]) { s.schieben = 0; return; }
  const [dr, dc] = RICHTUNGEN[richtung];
  const r = s.pr + dr, c = s.pc + dc, i = r * s.w + c;
  const ziel = an(s, r, c);
  if (ziel === '.' || ziel === ' ') {
    s.feld[i] = ' '; s.pr = r; s.pc = c; s.schieben = 0;
  } else if (ziel === '*') {
    s.feld[i] = ' '; s.pr = r; s.pc = c; s.schieben = 0;
    s.kristalle++;
    s.punkte += s.kristalle > s.brauche ? 15 : 10;
    ev.push({ art: 'kristall', r, c });
    if (s.kristalle === s.brauche) ev.push({ art: 'offen' });
  } else if (ziel === 'E' && offen(s)) {
    s.pr = r; s.pc = c;
    s.ende = 'geschafft';
    ev.push({ art: 'geschafft', r, c });
  } else if (ziel === 'o' && dr === 0 && !s.faellt[i] && an(s, r, c + dc) === ' ') {
    // Steine schieben: man muss kurz dagegen drücken (2 Takte), wie beim Vorbild
    s.schieben++;
    if (s.schieben >= 2) {
      s.feld[r * s.w + c + dc] = 'o'; s.feld[i] = ' ';
      s.pr = r; s.pc = c; s.schieben = 0;
      ev.push({ art: 'schieben', r, c: c + dc });
    }
  } else {
    s.schieben = 0;
  }
}

// Schwerkraft von unten nach oben: Stapel fallen gemeinsam.
// Ruhende Steine über der Figur bleiben liegen. Fallende treffen sie.
function schwerkraft(s, ev) {
  const neuFaellt = new Array(s.feld.length).fill(false);
  const figur = (r, c) => s.lebt && r === s.pr && c === s.pc;
  for (let r = s.h - 2; r >= 1; r--) {
    for (let c = 1; c < s.w - 1; c++) {
      const i = r * s.w + c;
      const ch = s.feld[i];
      if (!FAELLT.has(ch) || neuFaellt[i]) continue;
      const fiel = s.faellt[i];
      const unten = an(s, r + 1, c);
      if (unten === ' ' && figur(r + 1, c)) {
        if (fiel) explodieren(s, r + 1, c, ev);
        continue;
      }
      let ziel = null;
      if (unten === ' ') ziel = i + s.w;
      else if (RUND.has(unten)) {
        for (const dc of [-1, 1]) {
          if (an(s, r, c + dc) === ' ' && !figur(r, c + dc) && an(s, r + 1, c + dc) === ' ' && !figur(r + 1, c + dc)) { ziel = i + dc; break; }
        }
      }
      if (ziel == null) {
        if (fiel) ev.push({ art: 'landen', r, c, was: ch });
        continue;
      }
      s.feld[ziel] = ch; s.feld[i] = ' ';
      neuFaellt[ziel] = true;
    }
  }
  s.faellt = neuFaellt;
}

function explodieren(s, r, c, ev) {
  s.lebt = false;
  ev.push({ art: 'explosion', r, c });
  for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
    const i = rr * s.w + cc;
    if (!SPRENGBAR.has(an(s, rr, cc))) continue;
    s.explosion.push({ i, t: 5, danach: s.feld[i] === 'E' ? 'E' : ' ' });
    s.feld[i] = 'X';
  }
}

// Punkte für die übrige Zeit beim Verlassen der Höhle
export const zeitBonus = (s) => s.zeit;

// Für Tests: Sind genug Kristalle und der Ausgang erreichbar? Nur Wände sperren (Steine lassen sich umgehen oder schieben).
export function erreichbar(s) {
  const seen = new Set([s.pr * s.w + s.pc]);
  const q = [[s.pr, s.pc]];
  let kristalle = 0, ausgang = false;
  while (q.length) {
    const [r, c] = q.shift();
    for (const [dr, dc] of Object.values(RICHTUNGEN)) {
      const rr = r + dr, cc = c + dc, i = rr * s.w + cc;
      const ch = an(s, rr, cc);
      if (seen.has(i) || ch === '#' || ch === 'w') continue;
      seen.add(i);
      if (ch === '*') kristalle++;
      if (ch === 'E') { ausgang = true; continue; }
      q.push([rr, cc]);
    }
  }
  return { kristalle, ausgang };
}
