// Kristallmine: Gräber-Spiel in Echtzeit (Regeln wie beim klassischen Vorbild, eigene Höhlen und Gestaltung).
// Reine Logik ohne DOM (testbar mit node). Ein „Takt“ ist ein Spielschritt (ca. 140 ms).
//
// Zeichen:  # Stahlwand (unzerstörbar)   w Mauer (rund, Steine rollen ab)   . Erde   (Leerzeichen) leer
//           o Stein   * Kristall   E Ausgang   X Explosion
//           f Glühwurm (explodiert)   b Schmetterling (wird zu Kristallen)

export const TAKT_MS = 140;
export const RICHTUNGEN = { hoch: [-1, 0], runter: [1, 0], links: [0, -1], rechts: [0, 1] };

// Höhlen: zufällig gefüllt (fester Startwert), dazu Mauern nach Mustern. So entstanden auch die klassischen Höhlen.
// Jede Höhle wird beim Laden geprüft (genug erreichbare Kristalle, Ausgang erreichbar, sicherer Start);
// passt ein Startwert nicht, wird der nächste genommen. Dadurch sind die Höhlen immer gleich.
const NAMEN = [
  'Erste Ader', 'Steinschlag', 'Jadetiefe', 'Kieselhang', 'Runenkammern', 'Enger Stollen', 'Rollende Steine', 'Schatzkästen',
  'Tiefe Halle', 'Glimmergang', 'Doppelschacht', 'Steinregen', 'Serpentine', 'Jadekammern', 'Großer Abbau', 'Spaltenfeld',
  'Kristallnest', 'Mauerwerk', 'Lawinenhang', 'Tausend Steine', 'Verborgene Ader', 'Kammerflucht', 'Stufenschacht', 'Steinbruch',
  'Runengrund', 'Engpass', 'Dunkle Weite', 'Schatzlabyrinth', 'Tiefster Stollen', 'Herz der Mine'
];
const MUSTER = [
  'offen', 'zeilen', 'spalten', 'offen', 'kaesten', 'zeilen', 'offen', 'kaesten',
  'gitter', 'spalten', 'zeilen', 'offen', 'serpentine', 'kaesten', 'gitter', 'spalten',
  'kaesten', 'gitter', 'stufen', 'offen', 'kaesten', 'spalten', 'stufen', 'gitter',
  'kaesten', 'serpentine', 'offen', 'kaesten', 'gitter', 'serpentine'
];

function mauernFuer(muster, w, h, n) {
  const m = [];
  const q = (x) => Math.max(2, Math.round(x));
  if (muster === 'zeilen') {
    [q(h / 3), q(2 * h / 3)].forEach((r, k) => m.push(['h', r, 1, w - 2, [q(w * (0.2 + 0.5 * k)), q(w * (0.55 + 0.3 * ((k + n) % 2)))]]));
  }
  if (muster === 'spalten') {
    [q(w / 4), q(w / 2), q(3 * w / 4)].forEach((c, k) => m.push(['v', c, 1, h - 2, [q(h * (0.25 + 0.45 * ((k + n) % 2))), q(h * 0.8)]]));
  }
  if (muster === 'gitter') {
    // Jede Kammer hat Durchgänge: Lücken in jeder Zeile pro Spaltenabschnitt und umgekehrt
    const zs = [q(h / 3), q(2 * h / 3)], ss = [q(w / 3), q(2 * w / 3)];
    zs.forEach(r => m.push(['h', r, 1, w - 2, [q(w / 6), q(w / 2), q(5 * w / 6)]]));
    ss.forEach(c => m.push(['v', c, 1, h - 2, [q(h / 6), q(h / 2), q(5 * h / 6)]]));
  }
  if (muster === 'serpentine') {
    for (let r = 4, k = 0; r < h - 3; r += 4, k++) m.push(['h', r, 1, w - 2, k % 2 ? [2, 3] : [w - 4, w - 3]]);
  }
  if (muster === 'stufen') {
    const n2 = 5;
    for (let k = 0; k < n2; k++) {
      const r = q(3 + k * (h - 6) / (n2 - 1)), c0 = q(3 + k * (w - 12) / n2);
      m.push(['h', r, c0, Math.min(w - 3, c0 + 7), []]);
    }
  }
  if (muster === 'kaesten') {
    const zahl = 3 + (n % 3);
    for (let k = 0; k < zahl; k++) {
      const c = q(5 + k * (w - 10) / zahl), r = q(h * (k % 2 ? 0.6 : 0.25));
      m.push(['k', r, c, 4, 5, k % 4]); // Kasten 4×5, Öffnung an einer Seite (0 oben, 1 rechts, 2 unten, 3 links)
    }
  }
  return m;
}

export const HOEHLEN = NAMEN.map((name, n) => {
  const w = Math.min(36, 26 + Math.floor(n * 0.4)), h = Math.min(22, 16 + Math.floor(n / 5));
  // In engen Mustern etwas weniger Steine, sonst versperren sie die Gänge
  const stein = Math.min(0.2, 0.09 + n * 0.004) * (MUSTER[n] === 'serpentine' ? 0.75 : 1);
  const brauche = 10 + Math.floor(n * 0.5);
  const ausgaenge = [[h - 3, w - 3], [2, w - 3], [h - 3, Math.floor(w / 2)], [h - 3, 3]];
  const ausgang = ausgaenge[n % 4];
  const zeit = Math.round((w * h) / 3.4 + brauche * 2.5 - n * 1.2);
  return { name, w, h, saat: 11 + n * 97, stein, kristall: 0.065, leer: 0.03, brauche, zeit, start: [2, 2], ausgang, mauern: mauernFuer(MUSTER[n], w, h, n), gegner: gegnerZahl(n) };
});

const FAELLT = new Set(['o', '*']);
const RUND = new Set(['o', '*', 'w']);
const SPRENGBAR = new Set(['.', ' ', 'o', '*', 'w', 'E', 'f', 'b']);
const GEGNER = new Set(['f', 'b']);
// Richtungen der Gegner: 0 hoch, 1 rechts, 2 runter, 3 links
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];

// Wie viele Gegner in Höhle n (0-basiert): ab Höhle 6 Glühwürmer, ab Höhle 11 auch Schmetterlinge
export function gegnerZahl(n) {
  if (n < 5) return { f: 0, b: 0 };
  if (n < 10) return { f: n < 7 ? 1 : 2, b: 0 };
  if (n < 20) return { f: 2, b: n < 14 ? 1 : 2 };
  return { f: 3, b: 2 };
}

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
  for (const mauer of def.mauern || []) {
    const [art, a, von, bis, luecken] = mauer;
    if (art === 'k') {
      // Kasten: Mauer-Rahmen mit einer Öffnung, innen Kristalle und Erde
      const [, r0, c0, hh, ww, seite] = mauer;
      for (let r = r0; r < r0 + hh; r++) for (let c = c0; c < c0 + ww; c++) {
        const rand = r === r0 || c === c0 || r === r0 + hh - 1 || c === c0 + ww - 1;
        setze(r, c, rand ? 'w' : (rnd() < 0.5 ? '*' : '.'));
      }
      const mr = r0 + Math.floor(hh / 2), mc = c0 + Math.floor(ww / 2);
      const [or, oc] = [[r0, mc], [mr, c0 + ww - 1], [r0 + hh - 1, mc], [mr, c0]][seite % 4];
      setze(or, oc, '.');
      continue;
    }
    for (let k = von; k <= bis; k++) {
      if ((luecken || []).includes(k)) {
        // Lücke frei halten: darüber und darunter (bzw. links und rechts) Erde statt Steinen
        if (art === 'h') { for (const d of [-1, 0, 1]) if (d === 0 || feld[(a + d) * w + k] === 'o') setze(a + d, k, '.'); }
        else { for (const d of [-1, 0, 1]) if (d === 0 || feld[k * w + a + d] === 'o') setze(k, a + d, '.'); }
        continue;
      }
      if (art === 'h') setze(a, k, 'w'); else setze(k, a, 'w');
    }
  }
  // Gegner in kleinen Hohlräumen („Nestern“), umgeben von Erde. Sie kommen erst heraus, wenn man zu ihnen gräbt.
  const [sr, sc] = def.start, [ar0, ac0] = def.ausgang;
  const nester = [];
  const gegner = def.gegner || { f: 0, b: 0 };
  const arten = [...Array(gegner.f).fill('f'), ...Array(gegner.b).fill('b')];
  for (const art of arten) {
    for (let versuch = 0; versuch < 60; versuch++) {
      const lang = 3 + Math.floor(rnd() * 3), hoch = rnd() < 0.35 ? 2 : 1;
      const r0 = 3 + Math.floor(rnd() * (h - 6 - hoch)), c0 = 3 + Math.floor(rnd() * (w - 6 - lang));
      const weitStart = Math.abs(r0 - sr) + Math.abs(c0 - sc) >= 12;
      const weitAusgang = Math.abs(r0 - ar0) + Math.abs(c0 - ac0) >= 5;
      let frei = weitStart && weitAusgang;
      // Rand aus Erde (oder Wand), keine anderen Nester in der Nähe
      for (let r = r0 - 1; frei && r <= r0 + hoch; r++) for (let c = c0 - 1; frei && c <= c0 + lang; c++) {
        const ch = feld[r * w + c];
        if (ch === 'w' || ch === '#' || nester.some(n => r >= n.r0 - 2 && r <= n.r0 + n.hoch + 1 && c >= n.c0 - 2 && c <= n.c0 + n.lang + 1)) frei = false;
      }
      if (!frei) continue;
      for (let r = r0 - 1; r <= r0 + hoch; r++) for (let c = c0 - 1; c <= c0 + lang; c++) {
        const innen = r >= r0 && r < r0 + hoch && c >= c0 && c < c0 + lang;
        setze(r, c, innen ? ' ' : '.');
      }
      setze(r0, c0, art);
      nester.push({ r0, c0, lang, hoch });
      break;
    }
  }
  // Start: ringsum Erde, damit zu Beginn nichts herunterfällt
  for (let r = sr - 1; r <= sr + 1; r++) for (let c = sc - 1; c <= sc + 1; c++) setze(r, c, '.');
  for (let r = 1; r < sr - 1; r++) if (feld[r * w + sc] === 'o' || feld[r * w + sc] === '*') setze(r, sc, '.');
  setze(sr, sc, ' ');
  setze(ar0, ac0, 'E');
  return feld;
}

// Startwert suchen, mit dem die Höhle die Prüfungen besteht (immer derselbe für dieselbe Höhle)
const saatGeprueft = new Map();
function geprueftesFeld(nr) {
  const def = HOEHLEN[nr];
  if (saatGeprueft.has(nr)) return karteBauen({ ...def, saat: saatGeprueft.get(nr) });
  for (let k = 0; k < 400; k++) {
    const saat = def.saat + k * 7919;
    const feld = karteBauen({ ...def, saat });
    if (hoehlePasst(def, feld)) { saatGeprueft.set(nr, saat); return feld; }
  }
  saatGeprueft.set(nr, def.saat);
  return karteBauen(def);
}

function hoehlePasst(def, feld) {
  const t = rohStand(def, feld, 0);
  const e = erreichbar(t, true);
  if (!e.ausgang || e.kristalle < t.brauche + 2) return false;
  for (let k = 0; k < 60; k++) takt(t, null);
  return t.lebt;
}

function rohStand(def, feld, nr) {
  const gesamt = feld.filter(x => x === '*').length;
  return {
    nr, name: def.name, w: def.w, h: def.h, feld,
    faellt: new Array(feld.length).fill(false),
    pr: def.start[0], pc: def.start[1],
    kristalle: 0, brauche: Math.min(def.brauche, gesamt), gesamt,
    punkte: 0, zeit: def.zeit, zeitMs: 0, takte: 0,
    schieben: 0, explosion: [], bewegt: [], lebt: true, ende: null, grund: null,
    // Blickrichtung der Gegner je Feld (wandert mit dem Gegner)
    richtung: feld.map(ch => GEGNER.has(ch) ? 3 : -1)
  };
}

export function hoehleLaden(nr) {
  const def = HOEHLEN[nr];
  return rohStand(def, geprueftesFeld(nr), nr);
}

export const offen = (s) => s.kristalle >= s.brauche;
const an = (s, r, c) => (r < 0 || c < 0 || r >= s.h || c >= s.w) ? '#' : s.feld[r * s.w + c];

// Ein Takt. richtung: 'hoch' | 'runter' | 'links' | 'rechts' | null. Ändert den Stand und gibt Ereignisse zurück.
// Ereignisse: { art: 'kristall'|'offen'|'schieben'|'landen'|'explosion'|'geschafft'|'zeit'|'ticken', r, c }
export function takt(s, richtung) {
  const ev = [];
  if (s.ende) return ev;
  s.takte++;
  s.bewegt = []; // [{ von, nach }] für weiche Bewegungen in der Anzeige
  // Explosionen klingen ab
  if (s.explosion.length) {
    s.explosion = s.explosion.filter(x => { x.t--; if (x.t <= 0) { if (s.feld[x.i] === 'X') s.feld[x.i] = x.danach || ' '; return false; } return true; });
    if (!s.lebt && !s.explosion.length) { s.ende = 'treffer'; return ev; }
    if (!s.lebt) return ev; // während der Explosion steht alles
  }
  if (s.lebt) figurBewegen(s, richtung, ev);
  if (s.ende) return ev;
  if (s.lebt) beruehrung(s, ev);
  gegnerBewegen(s, ev);
  if (s.lebt) beruehrung(s, ev);
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
      s.bewegt.push({ von: i, nach: i + dc });
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
        if (fiel) { s.grund = ch === 'o' ? 'stein' : 'kristall'; explodieren(s, r + 1, c, ev, ' '); }
        continue;
      }
      if (fiel && GEGNER.has(unten)) {
        // Fallender Stein trifft einen Gegner: Glühwurm explodiert, Schmetterling wird zu Kristallen
        explodieren(s, r + 1, c, ev, unten === 'b' ? '*' : ' ');
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
      if (s.bewegt) s.bewegt.push({ von: i, nach: ziel });
    }
  }
  s.faellt = neuFaellt;
}

// Explosion 3 × 3 (Stahlwände bleiben). danach: ' ' (leer) oder '*' (Schmetterling: Kristalle).
// Liegt ein anderer Gegner im Bereich, explodiert er mit. Steht die Figur im Bereich, ist sie getroffen.
function explodieren(s, r, c, ev, danach = ' ') {
  const ketten = [];
  ev.push({ art: 'explosion', r, c, kristalle: danach === '*' });
  for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
    const i = rr * s.w + cc;
    const ch = an(s, rr, cc);
    if (s.lebt && rr === s.pr && cc === s.pc) { s.lebt = false; if (!s.grund) s.grund = 'explosion'; }
    if (!SPRENGBAR.has(ch)) continue;
    if (GEGNER.has(ch) && !(rr === r && cc === c)) ketten.push([rr, cc, ch === 'b' ? '*' : ' ']);
    s.explosion.push({ i, t: 5, danach: ch === 'E' ? 'E' : danach });
    s.feld[i] = 'X';
    s.richtung[i] = -1;
    s.faellt[i] = false;
  }
  for (const [rr, cc, d] of ketten) explodierenNachbar(s, rr, cc, ev, d);
}
function explodierenNachbar(s, r, c, ev, danach) {
  // Gegner im Explosionsbereich: eigene Explosion (Felder, die schon explodieren, bleiben)
  ev.push({ art: 'explosion', r, c, kristalle: danach === '*' });
  for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
    const i = rr * s.w + cc, ch = an(s, rr, cc);
    if (s.lebt && rr === s.pr && cc === s.pc) { s.lebt = false; if (!s.grund) s.grund = 'explosion'; }
    if (!SPRENGBAR.has(ch)) continue;
    if (GEGNER.has(ch)) { s.feld[i] = 'X'; explodierenNachbar(s, rr, cc, ev, ch === 'b' ? '*' : ' '); }
    s.explosion.push({ i, t: 5, danach: ch === 'E' ? 'E' : danach });
    s.feld[i] = 'X'; s.richtung[i] = -1; s.faellt[i] = false;
  }
}

// Gegner bewegen sich jeden Takt: Glühwürmer halten sich links (drehen zuerst nach links),
// Schmetterlinge halten sich rechts. So laufen sie an Wänden und Gängen entlang, wie beim Vorbild.
function gegnerBewegen(s, ev) {
  const bewegt = new Set();
  for (let i = 0; i < s.feld.length; i++) {
    const ch = s.feld[i];
    if (!GEGNER.has(ch) || bewegt.has(i)) continue;
    const r = Math.floor(i / s.w), c = i % s.w;
    let d = s.richtung[i] < 0 ? 3 : s.richtung[i];
    const dreh = ch === 'f' ? 3 : 1; // f: links (+3 = -1), b: rechts
    const frei = (dd) => {
      const rr = r + DR[dd], cc = c + DC[dd];
      return an(s, rr, cc) === ' ' && !(s.lebt && rr === s.pr && cc === s.pc);
    };
    const seite = (d + dreh) % 4;
    let ziel = -1;
    if (frei(seite)) { d = seite; ziel = i + DR[d] * s.w + DC[d]; }
    else if (frei(d)) ziel = i + DR[d] * s.w + DC[d];
    else d = (d + 4 - dreh) % 4; // andersherum drehen, stehen bleiben
    if (ziel >= 0) {
      s.feld[ziel] = ch; s.feld[i] = ' ';
      s.richtung[ziel] = d; s.richtung[i] = -1;
      bewegt.add(ziel);
      s.bewegt.push({ von: i, nach: ziel });
    } else {
      s.richtung[i] = d;
    }
  }
}

// Berührt die Figur einen Gegner (oben, unten, links, rechts), explodiert er
function beruehrung(s, ev) {
  for (let d = 0; d < 4; d++) {
    const rr = s.pr + DR[d], cc = s.pc + DC[d];
    const ch = an(s, rr, cc);
    if (GEGNER.has(ch)) { s.grund = ch === 'f' ? 'gluehwurm' : 'schmetterling'; explodieren(s, rr, cc, ev, ch === 'b' ? '*' : ' '); return; }
  }
}

// Punkte für die übrige Zeit beim Verlassen der Höhle
export const zeitBonus = (s) => s.zeit;

// Für Tests: Sind genug Kristalle und der Ausgang erreichbar? Nur Wände sperren (Steine lassen sich umgehen oder schieben).
export function erreichbar(s, streng = false) {
  const seen = new Set([s.pr * s.w + s.pc]);
  const q = [[s.pr, s.pc]];
  let kristalle = 0, ausgang = false;
  while (q.length) {
    const [r, c] = q.shift();
    for (const [dr, dc] of Object.values(RICHTUNGEN)) {
      const rr = r + dr, cc = c + dc, i = rr * s.w + cc;
      const ch = an(s, rr, cc);
      if (seen.has(i) || ch === '#' || ch === 'w' || (streng && (ch === 'o' || ch === 'f' || ch === 'b'))) continue;
      seen.add(i);
      if (ch === '*') kristalle++;
      if (ch === 'E') { ausgang = true; continue; }
      q.push([rr, cc]);
    }
  }
  return { kristalle, ausgang };
}
