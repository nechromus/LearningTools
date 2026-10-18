// Runenbrecher: mit einer Jade-Kugel Runenmauern brechen (wie das klassische Mauer-Spiel).
// Reine Logik ohne DOM (testbar mit node). Feste Zeitschritte, Spielfeld in eigenen Einheiten.
// Anzeige in runenbrecher-ui.js.

export const BREITE = 100, HOEHE = 150;
export const SPALTEN = 10;
export const STEIN = { breite: 9, hoehe: 4, abstand: 1, oben: 16 };
export const SCHILD = { y: 138, hoehe: 3.2, breite: 22, breit: 32 };
export const RADIUS = 1.8;
export const SCHRITT = 1 / 120;
export const LEBEN_START = 3;
export const LEBEN_MAX = 6;
const EXTRA_FALL = 26;          // Einheiten pro Sekunde
const BREIT_SEK = 15, LANGSAM_SEK = 12;
const MIN_STEIL = 0.38;         // Anteil der Geschwindigkeit, der mindestens senkrecht sein muss
const MAX_WINKEL = 62 * Math.PI / 180;

// Zeichen: . leer, n normal (1 Treffer), s stark (2 Treffer), g Gold (Bonus), x Fels (bleibt stehen)
export const LEVEL = [
  { name: 'Erste Mauer', reihen: ['nnnnnnnnnn', 'nnnnnnnnnn', 'nnnnnnnnnn', 'nnnnnnnnnn'] },
  { name: 'Der Bogen', reihen: ['...nnnn...', '..nnnnnn..', '.nnn..nnn.', 'nnn....nnn', 'nn......nn', 'nn......nn'] },
  { name: 'Pyramide', reihen: ['....gg....', '...nnnn...', '..nnnnnn..', '.nnnnnnnn.', 'ssssssssss'] },
  { name: 'Schachbrett', reihen: ['n.n.n.n.n.', '.n.n.n.n.n', 'n.n.g.n.n.', '.n.n.n.n.n', 'n.n.n.n.n.', '.s.s.s.s.s'] },
  { name: 'Die Rune', reihen: ['....ss....', '....nn....', '.n..nn..n.', '..n.nn.n..', '...nnnn...', '....nn....', '....nn....', '...gggg...'] },
  { name: 'Zwei Türme', reihen: ['ss......ss', 'nn......nn', 'nn..gg..nn', 'nn.nnnn.nn', 'nnnnnnnnnn', 'ssssssssss'] },
  { name: 'Wellen', reihen: ['nn....nn..', '..nn....nn', 'ss..ss..ss', '..nn....nn', 'nn....nn..', '...gg..gg.'] },
  { name: 'Das Tor', reihen: ['ssssssssss', 's..nnnn..s', 's.n....n.s', 's.n.gg.n.s', 's.n....n.s', 'x........x'] },
  { name: 'Rauten', reihen: ['....n.....', '...nsn....', '..nsgsn...', '...nsn..n.', '....n..nsn', '......nsgs', '.......nsn', '........n.'] },
  { name: 'Felsenhalle', reihen: ['nnnnnnnnnn', 'snsnsnsnsn', 'nnnggggnnn', 'x..x..x..x', 'nnnnnnnnnn'] },
  { name: 'Der Kelch', reihen: ['s........s', 'ss......ss', '.sssggsss.', '..ssnnss..', '...nnnn...', '....nn....', '...xnnx...'] },
  { name: 'Gitter', reihen: ['snsnsnsnsn', 'n.n.n.n.n.', 'snsnsgsnsn', '.n.n.n.n.n', 'snsnsnsnsn', 'x.x.x.x.x.'] },
  { name: 'Drachenauge', reihen: ['..ssssss..', '.snnnnnns.', 'snn.gg.nns', 'snn.gg.nns', '.snnnnnns.', '..ssssss..', 'x........x'] },
  { name: 'Festung', reihen: ['s.s.ss.s.s', 'ssssssssss', 'snnnnnnnns', 'sngnnnngns', 'snnnxxnnns', 'ssssssssss'] },
  { name: 'Runenschrein', reihen: ['gssssssssg', 'snnnnnnnns', 'sn.sggs.ns', 'sn.s..s.ns', 'sn.ssss.ns', 'snnnnnnnns', 'xs.x..x.sx'] }
];

export const PUNKTE = { n: 10, s: 20, g: 50, ersterTreffer: 5, levelBonus: 200 };
export const geschwindigkeit = (level) => Math.min(74, 56 + 1.8 * level); // level ab 0

// Zufall mit Startwert (damit Extras gleich fallen, wenn man denselben Stand lädt)
function zufall(s) {
  s.zufall = (s.zufall + 0x6D2B79F5) >>> 0;
  let t = s.zufall;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function steineVon(level) {
  const def = LEVEL[level];
  const steine = [];
  def.reihen.forEach((z, r) => [...z].forEach((ch, c) => {
    if (ch === '.') return;
    steine.push({ r, c, art: ch, hp: ch === 's' ? 2 : ch === 'x' ? Infinity : 1 });
  }));
  return steine;
}

export const steinRechteck = (st) => ({
  x: st.c * (STEIN.breite + STEIN.abstand) + STEIN.abstand / 2,
  y: STEIN.oben + st.r * (STEIN.hoehe + STEIN.abstand),
  w: STEIN.breite, h: STEIN.hoehe
});

export function neuerFortschritt(startwert = Date.now()) {
  return { level: 0, punkte: 0, levelStartPunkte: 0, leben: LEBEN_START, hoechstes: 0, rekord: 0, steine: null, zufall: startwert >>> 0 };
}

// Spielstand für ein Level aufbauen (aus Fortschritt). Kugel liegt auf dem Schild.
export function levelStarten(f) {
  const s = {
    level: f.level, punkte: f.punkte, levelStartPunkte: f.levelStartPunkte ?? f.punkte, leben: f.leben, hoechstes: Math.max(f.hoechstes || 0, f.level), rekord: f.rekord || 0,
    steine: Array.isArray(f.steine) && f.steine.length ? f.steine.map(x => ({ ...x, hp: x.art === 'x' ? Infinity : x.hp })) : steineVon(f.level),
    zufall: f.zufall >>> 0,
    schild: { x: BREITE / 2, breite: SCHILD.breite },
    kugeln: [], liegt: true, extras: [], zeit: 0, breitBis: 0, langsamBis: 0, ende: null
  };
  kugelAufSchild(s);
  return s;
}

// Für das Speichern: nur, was man zum Weitermachen braucht
export function fortschrittVon(s) {
  return { level: s.level, punkte: s.punkte, levelStartPunkte: s.levelStartPunkte, leben: s.leben, hoechstes: s.hoechstes, rekord: Math.max(s.rekord, s.punkte),
    steine: s.ende === 'geschafft' ? null : s.steine.map(x => ({ r: x.r, c: x.c, art: x.art, hp: x.art === 'x' ? 0 : x.hp })), zufall: s.zufall };
}

function kugelAufSchild(s) {
  s.liegt = true;
  s.kugeln = [{ x: s.schild.x, y: SCHILD.y - RADIUS, vx: 0, vy: 0 }];
}

export const zielTempo = (s) => geschwindigkeit(s.level) * (s.zeit < s.langsamBis ? 0.7 : 1);

export function abschiessen(s) {
  if (!s.liegt || s.ende) return false;
  const v = zielTempo(s), w = (zufall(s) - 0.5) * 0.5; // leicht schräg
  s.kugeln[0].vx = v * Math.sin(w);
  s.kugeln[0].vy = -v * Math.cos(w);
  s.liegt = false;
  return true;
}

// Geschwindigkeit auf Zieltempo bringen und mindestens so steil halten
export function richten(k, v) {
  let len = Math.hypot(k.vx, k.vy) || 1;
  k.vx = k.vx / len * v; k.vy = k.vy / len * v;
  const min = v * MIN_STEIL;
  if (Math.abs(k.vy) < min) {
    k.vy = (k.vy < 0 ? -1 : 1) * min;
    k.vx = Math.sign(k.vx || 1) * Math.sqrt(v * v - min * min);
  }
}

const zerstoerbar = (st) => st.art !== 'x';
export const uebrig = (s) => s.steine.filter(zerstoerbar).length;

// Einen festen Zeitschritt rechnen. ziel: gewünschte Mitte des Schilds (oder null). Gibt Ereignisse zurück.
export function schritt(s, ziel = null) {
  const ev = [];
  if (s.ende) return ev;
  s.zeit += SCHRITT;
  // Schild
  const b = s.zeit < s.breitBis ? SCHILD.breit : SCHILD.breite;
  s.schild.breite = b;
  if (ziel != null) s.schild.x = ziel;
  s.schild.x = Math.max(b / 2, Math.min(BREITE - b / 2, s.schild.x));
  if (s.liegt) { s.kugeln[0].x = s.schild.x; s.kugeln[0].y = SCHILD.y - RADIUS; }
  // Extras fallen
  for (const e of s.extras) {
    e.y += EXTRA_FALL * SCHRITT;
    if (!e.weg && e.y + 2 >= SCHILD.y && e.y - 2 <= SCHILD.y + SCHILD.hoehe && Math.abs(e.x - s.schild.x) <= b / 2 + 2) {
      e.weg = true;
      extraNehmen(s, e.art);
      ev.push({ art: 'extra', extra: e.art, x: e.x, y: e.y });
    }
  }
  s.extras = s.extras.filter(e => !e.weg && e.y < HOEHE + 4);
  if (s.liegt) return ev;
  const v = zielTempo(s);
  for (const k of s.kugeln) {
    richten(k, v);
    k.x += k.vx * SCHRITT; k.y += k.vy * SCHRITT;
    // Wände
    if (k.x < RADIUS) { k.x = RADIUS; k.vx = Math.abs(k.vx); ev.push({ art: 'wand' }); }
    if (k.x > BREITE - RADIUS) { k.x = BREITE - RADIUS; k.vx = -Math.abs(k.vx); ev.push({ art: 'wand' }); }
    if (k.y < RADIUS) { k.y = RADIUS; k.vy = Math.abs(k.vy); ev.push({ art: 'wand' }); }
    // Schild
    if (k.vy > 0 && k.y + RADIUS >= SCHILD.y && k.y - RADIUS <= SCHILD.y + SCHILD.hoehe && Math.abs(k.x - s.schild.x) <= b / 2 + RADIUS) {
      const rel = Math.max(-1, Math.min(1, (k.x - s.schild.x) / (b / 2)));
      const w = rel * MAX_WINKEL;
      k.vx = v * Math.sin(w); k.vy = -v * Math.cos(w);
      k.y = SCHILD.y - RADIUS;
      ev.push({ art: 'schild', x: k.x });
    }
    // Steine: nur der am tiefsten überlappende Stein wird getroffen
    let best = null, bestTiefe = 0, bestSeite = null;
    for (const st of s.steine) {
      const q = steinRechteck(st);
      const nx = Math.max(q.x, Math.min(k.x, q.x + q.w)), ny = Math.max(q.y, Math.min(k.y, q.y + q.h));
      const dx = k.x - nx, dy = k.y - ny;
      if (dx * dx + dy * dy > RADIUS * RADIUS) continue;
      const ueberX = Math.min(k.x + RADIUS - q.x, q.x + q.w - (k.x - RADIUS));
      const ueberY = Math.min(k.y + RADIUS - q.y, q.y + q.h - (k.y - RADIUS));
      const tiefe = Math.min(ueberX, ueberY);
      if (!best || tiefe > bestTiefe) { best = st; bestTiefe = tiefe; bestSeite = ueberX < ueberY ? 'x' : 'y'; }
    }
    if (best) {
      const q = steinRechteck(best);
      // abprallen und aus dem Stein schieben, damit er nicht gleich noch einmal trifft
      if (bestSeite === 'x') {
        const links = k.x < q.x + q.w / 2;
        k.vx = links ? -Math.abs(k.vx) : Math.abs(k.vx);
        k.x = links ? q.x - RADIUS : q.x + q.w + RADIUS;
      } else {
        const oben = k.y < q.y + q.h / 2;
        k.vy = oben ? -Math.abs(k.vy) : Math.abs(k.vy);
        k.y = oben ? q.y - RADIUS : q.y + q.h + RADIUS;
      }
      treffen(s, best, ev);
    }
  }
  // Verlorene Kugeln
  const vorher = s.kugeln.length;
  s.kugeln = s.kugeln.filter(k => k.y - RADIUS <= HOEHE);
  if (s.kugeln.length < vorher && !s.kugeln.length) {
    s.leben--;
    s.extras = []; s.breitBis = 0; s.langsamBis = 0;
    if (s.leben <= 0) {
      s.leben = 0; s.ende = 'verloren';
      s.rekord = Math.max(s.rekord, s.punkte);
      ev.push({ art: 'verloren' });
    } else {
      kugelAufSchild(s);
      ev.push({ art: 'kugelWeg' });
    }
  }
  if (!s.ende && uebrig(s) === 0) {
    s.ende = 'geschafft';
    s.punkte += PUNKTE.levelBonus;
    s.rekord = Math.max(s.rekord, s.punkte);
    ev.push({ art: 'geschafft' });
  }
  return ev;
}

function treffen(s, st, ev) {
  const q = steinRechteck(st);
  const mitte = { x: q.x + q.w / 2, y: q.y + q.h / 2 };
  if (st.art === 'x') { ev.push({ art: 'fels', ...mitte }); return; }
  st.hp--;
  if (st.hp > 0) { s.punkte += PUNKTE.ersterTreffer; ev.push({ art: 'riss', ...mitte, stein: st }); return; }
  s.steine = s.steine.filter(x => x !== st);
  const plus = PUNKTE[st.art] || 10;
  s.punkte += plus;
  ev.push({ art: 'bruch', ...mitte, steinArt: st.art, punkte: plus });
  // Extra: bei Gold immer, sonst selten
  if (st.art === 'g' || zufall(s) < 0.1) {
    const arten = s.kugeln.length > 1 ? ['breit', 'langsam'] : ['breit', 'zwei', 'langsam'];
    s.extras.push({ x: mitte.x, y: mitte.y, art: arten[Math.floor(zufall(s) * arten.length)] });
  }
}

export function extraNehmen(s, art) {
  if (art === 'breit') s.breitBis = s.zeit + BREIT_SEK;
  else if (art === 'langsam') s.langsamBis = s.zeit + LANGSAM_SEK;
  else if (art === 'zwei' && s.kugeln.length && !s.liegt) {
    const k = s.kugeln[0];
    s.kugeln.push({ x: k.x, y: k.y, vx: -k.vx || 20, vy: k.vy });
  }
}

// Nach geschafftem Level: nächstes Level mit einem Leben dazu
export function naechstesLevel(s) {
  const f = fortschrittVon(s);
  const level = Math.min(LEVEL.length - 1, s.level + 1);
  const zuEnde = s.level + 1 >= LEVEL.length;
  return { ...f, level: zuEnde ? 0 : level, levelStartPunkte: s.punkte, leben: Math.min(LEBEN_MAX, s.leben + 1), hoechstes: Math.max(f.hoechstes, zuEnde ? s.level : level), steine: null };
}

// Nach „Keine Kugeln mehr“: dasselbe Level von vorn, Punkte wie am Levelanfang
export function levelNochmal(s) {
  const f = fortschrittVon(s);
  return { ...f, punkte: s.levelStartPunkte, leben: LEBEN_START, steine: null };
}

// Gespeicherten Fortschritt prüfen
export function fortschrittPruefen(f) {
  if (!f || typeof f !== 'object' || !(f.level >= 0 && f.level < LEVEL.length) || !(f.leben > 0)) return null;
  return { ...neuerFortschritt(f.zufall || 1), ...f, steine: Array.isArray(f.steine) ? f.steine.filter(x => x && x.art && x.r >= 0 && x.c >= 0 && x.c < SPALTEN) : null };
}
