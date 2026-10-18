// Kleine Szenen der Spiele für Anleitungen und Spieleseite.
// Gebaut aus den echten Klassen und Zeichenfunktionen der Spiele: ändert sich ein Spiel, ändern sich die Bilder mit.
// Liefert HTML-Text, fasst beim Laden das DOM nicht an (testbar mit node).
import { edelstein } from './runenreihen-steine.js';
import { runenbrecherBild } from './runenbrecher-ui.js';
import * as RB from './runenbrecher.js';

const imBrowser = () => typeof document !== 'undefined';

// ---------- Grundgerüst ----------

// Szene aus Zellen und Figuren. opt: { kl, w, h, max: [breite, höhe], g (fest), zelle(r, c) → HTML|null, figuren: [{ r, c, html }], notiz(P) → SVG, vor (HTML davor) }
export function szene(opt) {
  const { kl, w, h } = opt;
  const [mw, mh] = opt.max || [286, 158];
  const gap = opt.gap ?? 1;
  const g = opt.g || Math.max(10, Math.min(opt.gmax || 46, Math.floor(Math.min((mw - (w - 1) * gap) / w, (mh - (h - 1) * gap) / h))));
  const B = w * g + (w - 1) * gap, H = h * g + (h - 1) * gap;
  const x = (c) => c * (g + gap), y = (r) => r * (g + gap);
  const P = { g, B, H, x: (c) => x(c) + g / 2, y: (r) => y(r) + g / 2, l: x, o: y };
  const teile = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const inhalt = opt.zelle ? opt.zelle(r, c) : null;
    if (inhalt) teile.push(`<div class="anl-c" style="left:${x(c)}px;top:${y(r)}px">${inhalt}</div>`);
  }
  for (const f of opt.figuren || []) teile.push(`<div class="anl-c anl-fig" style="left:${x(f.c)}px;top:${y(f.r)}px">${f.html}</div>`);
  const notiz = opt.notiz ? `<svg class="anl-notiz" width="${B}" height="${H}" viewBox="0 0 ${B} ${H}" aria-hidden="true">${opt.notiz(P)}</svg>` : '';
  return `<div class="anl-bild anl-szene km ${kl}" style="--g:${g}px;--p:${g}px"><div class="anl-flaeche" style="width:${B}px;height:${H}px">${opt.vor || ''}${teile.join('')}${notiz}</div></div>`;
}

// ---------- Hinweise über der Szene (Pfeile, Finger, Ringe, Text) ----------

const GOLD = '#F6DFA2', JADE = '#B9FFE2';
export const N = {
  pfeil(x1, y1, x2, y2, f = GOLD) {
    const a = Math.atan2(y2 - y1, x2 - x1), l = 9;
    const p1 = [x2 - l * Math.cos(a - 0.5), y2 - l * Math.sin(a - 0.5)], p2 = [x2 - l * Math.cos(a + 0.5), y2 - l * Math.sin(a + 0.5)];
    return `<g class="anl-pfeil"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${f}" stroke-width="3" stroke-linecap="round"/><polygon points="${x2},${y2} ${p1.join(',')} ${p2.join(',')}" fill="${f}"/></g>`;
  },
  finger: (x, y) => `<g class="anl-finger"><circle cx="${x}" cy="${y}" r="11" fill="rgba(246,223,162,.22)" stroke="${GOLD}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3.5" fill="${GOLD}"/></g>`,
  ring: (x, y, r, f = GOLD) => `<circle class="anl-ring" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${f}" stroke-width="2.5"/>`,
  kasten: (x, y, w, h, f = JADE) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${f}" stroke-width="2" stroke-dasharray="6 4"/>`,
  text: (x, y, s, f = GOLD, gr = 14) => `<text x="${x}" y="${y}" fill="${f}" font-size="${gr}" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="#0b0f10" stroke-width="3" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${s}</text>`,
  kreuz: (x, y, r = 10, f = GOLD) => `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" stroke="${f}" stroke-width="3.5" stroke-linecap="round"/>`
};

// Karte aus Zeichen bauen: zeilen = ['ab', 'cd'], legende = { a: (r, c) => HTML }
const ausKarte = (zeilen, legende) => (r, c) => { const ch = (zeilen[r] || '')[c]; return ch && legende[ch] ? legende[ch](r, c) : null; };

// ---------- Bausteine der einzelnen Spiele ----------

// 2048
const kachel = (n) => `<div class="stein k${n}${n >= 1000 ? ' vierstellig' : ''}"><span>${n}</span></div>`;
const zelle2048 = () => '<div class="zelle"></div>';
// Runenfeld
const rfLeer = () => '<div class="rf-zelle"></div>';
const rfVoll = (f) => `<div class="rf-zelle voll rf${f}"></div>`;
const rfStein = (f) => `<div class="rf-stein rf${f}"></div>`;
// Kristallmine und Steinschieber (gleiche Grundklassen)
const z = (kl) => `<div class="z ${kl}"><div class="in"></div></div>`;
const figur = (extra = '') => `<div class="sprite figur ${extra}"><div class="koerper"><div class="in"></div></div></div>`;
const runenstein = (aufZiel = false) => `<div class="sprite runenstein${aufZiel ? ' auf-ziel' : ''}"><div class="in"><i></i></div></div>`;
// Runenfall
const rz = (f, extra = '') => `<div class="rz${f ? ' f' + f : ''}${extra}"></div>`;
// Runenreihen
const gem = (a, extra = '') => `<div class="rr-stein a${a}${extra}"><i>${edelstein(a)}</i></div>`;
const sternrune = () => '<div class="rr-stein as stern"><i></i></div>';
// Höhlenkarte
const hz = (ch) => {
  if (ch === '#') return '<div class="hz zu v0"></div>';
  if (ch === '+') return '<div class="hz zu v1"></div>';
  if (ch === 'F') return '<div class="hz zu v0 mark"></div>';
  if (ch === 'B') return '<div class="hz zu v0 bekannt"></div>';
  if (ch === 'X') return '<div class="hz offen getroffen"></div>';
  if (ch === '.') return '<div class="hz offen"></div>';
  return `<div class="hz offen n${ch}">${ch}</div>`;
};
// Jadeschlange: Glieder von Kopf bis Schwanz
const glieder = (pos, winkel = 0) => pos.map(([r, c], k) => ({ r, c, html: k === 0
  ? `<div class="jsg-glied kopf" style="transform:rotate(${winkel}deg)"><i class="auge l"></i><i class="auge r"></i></div>`
  : `<div class="jsg-glied" style="--d:${(0.95 - 0.35 * (k / Math.max(1, pos.length - 1))).toFixed(2)}"><i></i></div>` }));
const kristall = (gold = false) => `<div class="jsg-kristall${gold ? ' gold' : ''}"><i></i></div>`;
const jsgStein = () => '<div class="jsg-stein v0"><i></i></div>';

// Runenbrecher: Bild aus der echten Zeichenfunktion (nur im Browser; in node ein Platzhalter)
function rbBild(breite, hoehe, szeneRb, ausschnitt, notiz = null, kl = '') {
  const src = imBrowser() ? runenbrecherBild(breite, hoehe, szeneRb, ausschnitt) : '';
  const aus = ausschnitt || { x: 0, y: 0, w: RB.BREITE, h: RB.HOEHE };
  const m = Math.min(breite / aus.w, hoehe / aus.h);
  const B = Math.round(aus.w * m), H = Math.round(aus.h * m);
  const P = { B, H, x: (fx) => (fx - aus.x) * m, y: (fy) => (fy - aus.y) * m, m };
  return `<div class="anl-bild anl-szene anl-rb ${kl}"><div class="anl-flaeche" style="width:${B}px;height:${H}px"><img src="${src}" width="${B}" height="${H}" alt="">${notiz ? `<svg class="anl-notiz" width="${B}" height="${H}" viewBox="0 0 ${B} ${H}" aria-hidden="true">${notiz(P)}</svg>` : ''}</div></div>`;
}
const rbSteine = (zeilen) => zeilen.flatMap((z, r) => [...z].map((ch, c) => (ch === '.' ? null : { r, c, art: ch.toLowerCase(), hp: ch === 'S' ? 1 : 2 })).filter(Boolean));

// ---------- Szenen für die Anleitungen ----------

export const BILDER = {
  '2048': [
    () => szene({ kl: 'b2048', w: 3, h: 3, max: [200, 150], gap: 4, zelle: (r, c) => (r === 1 && c === 1 ? kachel(2) : zelle2048()),
      notiz: (P) => N.pfeil(P.x(1), P.y(1) - P.g * 0.6, P.x(1), P.y(0) - P.g * 0.2) + N.pfeil(P.x(1), P.y(1) + P.g * 0.6, P.x(1), P.y(2) + P.g * 0.2)
        + N.pfeil(P.x(1) - P.g * 0.6, P.y(1), P.x(0) - P.g * 0.2, P.y(1)) + N.pfeil(P.x(1) + P.g * 0.6, P.y(1), P.x(2) + P.g * 0.2, P.y(1)) }),
    () => szene({ kl: 'b2048', w: 5, h: 1, max: [260, 60], zelle: (r, c) => (c < 2 ? kachel(2) : c === 4 ? kachel(4) : null),
      notiz: (P) => N.pfeil(P.x(2) - P.g * 0.3, P.y(0), P.x(2) + P.g * 0.4, P.y(0)) }),
    () => szene({ kl: 'b2048', w: 3, h: 1, max: [270, 92], gmax: 84, gap: 6, zelle: (r, c) => kachel([512, 2048, 1024][c]) })
  ],
  runenfeld: [
    () => szene({ kl: 'brf', w: 8, h: 4, max: [270, 140], gap: 3,
      zelle: (r, c) => (r < 2 && c < 5 ? (r === 1 && c < 2 ? rfVoll(1) : rfLeer()) : r >= 2 && ((r === 2 && c === 6) || (r === 3 && c >= 6)) ? rfStein(2) : null),
      notiz: (P) => N.pfeil(P.x(6), P.y(2) - 4, P.x(3.4), P.y(0.7)) + N.finger(P.x(6.5), P.y(3)) }),
    () => szene({ kl: 'brf', w: 6, h: 1, max: [260, 60], gap: 3, zelle: (r, c) => rfVoll(c === 5 ? 1 : 2),
      notiz: (P) => N.kasten(-4, -4, P.B + 8, P.g + 8) }),
    () => szene({ kl: 'brf', w: 8, h: 3, max: [270, 120], gap: 3,
      zelle: (r, c) => (c < 4 ? ((r + c) % 3 === 0 ? rfLeer() : rfVoll(1 + ((r + c) % 5))) : c >= 5 && c <= 7 && (r === 0 || c === 5) ? rfStein(5) : null),
      notiz: (P) => N.text(P.x(7), P.y(2) + 6, '?', JADE, 22) })
  ],
  kristallmine: [
    () => szene({ kl: 'bkm', w: 7, h: 3, max: [280, 120],
      zelle: ausKarte(['ee.eeee', 'e....ee', 'eeeeeee'], { e: (r, c) => z('erde v' + ((r + c) % 3)), '.': () => z('leer') }),
      figuren: [{ r: 1, c: 4, html: figur() }],
      notiz: (P) => N.finger(P.x(2), P.y(2)) + N.pfeil(P.x(2), P.y(2), P.x(4.6), P.y(2)) }),
    () => szene({ kl: 'bkm', w: 6, h: 1, max: [270, 56],
      zelle: (r, c) => (c < 2 ? z('leer kristall v' + c) : c === 5 ? z('ausgang offen') : c === 4 ? z('leer') : null),
      notiz: (P) => N.pfeil(P.x(2) - 6, P.y(0), P.x(3.6), P.y(0)) }),
    () => szene({ kl: 'bkm', w: 3, h: 3, max: [150, 130],
      zelle: ausKarte(['e*e', 'e.e', 'e.e'], { e: (r, c) => z('erde v' + ((r + c) % 3)), '.': () => z('leer'), '*': () => z('leer stein faellt v1') }),
      figuren: [{ r: 2, c: 1, html: figur() }],
      notiz: (P) => N.text(P.x(1), P.y(1) + 5, '!', GOLD, 20) }),
    () => szene({ kl: 'bkm', w: 5, h: 2, max: [250, 110],
      zelle: (r, c) => (r === 1 ? null : c === 1 ? z('leer gluehwurm') : c === 3 ? z('leer falter') : z('leer')),
      notiz: (P) => N.text(P.x(1), P.y(1), 'Glühwurm', GOLD, 13) + N.text(P.x(3), P.y(1), 'Schmetterling', JADE, 13) })
  ],
  steinschieber: [
    () => szene({ kl: 'ss bss', w: 6, h: 3, max: [270, 130],
      zelle: ausKarte(['##F###', '#....o', '######'], { '#': (r, c) => z('wand mauer v' + ((r + c) % 3)), F: () => z('wand mauer fackel v1'), '.': () => z('leer boden'), o: () => z('leer boden ziel') }),
      figuren: [{ r: 1, c: 1, html: figur() }, { r: 1, c: 2, html: runenstein() }],
      notiz: (P) => N.pfeil(P.x(3) - 6, P.y(1), P.x(4.4), P.y(1)) }),
    () => szene({ kl: 'ss bss', w: 6, h: 3, max: [270, 130],
      zelle: ausKarte(['######', '#....#', '######'], { '#': (r, c) => z('wand mauer v' + ((r + c) % 3)), '.': () => z('leer boden') }),
      figuren: [{ r: 1, c: 1, html: figur() }, { r: 1, c: 2, html: runenstein() }, { r: 1, c: 3, html: runenstein() }],
      notiz: (P) => N.kreuz(P.x(4), P.y(1), 9) }),
    () => szene({ kl: 'ss bss', w: 5, h: 3, max: [220, 130],
      zelle: ausKarte(['#F###', '#...o', '#....'], { '#': (r, c) => z('wand mauer v' + ((r + c) % 3)), F: () => z('wand mauer fackel v2'), '.': () => z('leer boden'), o: () => z('leer boden ziel') }),
      figuren: [{ r: 1, c: 1, html: runenstein() }, { r: 2, c: 3, html: figur() }],
      notiz: (P) => N.ring(P.x(1), P.y(1), P.g * 0.62) })
  ],
  runenfall: [
    () => szene({ kl: 'rnf', w: 8, h: 5, max: [240, 150],
      zelle: (r, c) => (r === 0 && c === 3) || (r === 1 && c >= 2 && c <= 4) ? rz(3, ' aktiv') : r === 4 ? (c === 3 ? rz(0) : rz(1 + (c % 6))) : (r === 3 && c >= 2 && c <= 4) || (r === 2 && c === 3) ? rz(0, ' geist g3') : rz(0),
      notiz: (P) => N.pfeil(P.x(6.5), P.y(0.5), P.x(6.5), P.y(3)) }),
    () => szene({ kl: 'rnf', w: 8, h: 1, max: [260, 50], zelle: (r, c) => rz(c === 4 ? 3 : 1 + ((c * 5) % 6)),
      notiz: (P) => N.kasten(-4, -4, P.B + 8, P.g + 8) }),
    () => szene({ kl: 'rnf', w: 6, h: 5, max: [200, 150],
      zelle: (r, c) => (r < 2 && (c === 2 || c === 3) ? rz(2, ' aktiv') : r >= 3 && (c === 2 || c === 3) ? rz(0, ' geist g2') : r === 4 ? rz(1 + c) : rz(0)),
      notiz: (P) => N.pfeil(P.x(5), P.y(0.5), P.x(5), P.y(3.6)) })
  ],
  runenreihen: [
    () => szene({ kl: 'rr', w: 3, h: 1, max: [220, 80], gmax: 62, zelle: (r, c) => (c === 0 ? gem(0) : c === 1 ? gem(1) : gem(0)),
      notiz: (P) => N.pfeil(P.x(0) + 8, P.y(0) - P.g * 0.55, P.x(1) - 8, P.y(0) - P.g * 0.55) + N.pfeil(P.x(1) - 8, P.y(0) + P.g * 0.55, P.x(0) + 8, P.y(0) + P.g * 0.55) + N.finger(P.x(0), P.y(0)) }),
    () => szene({ kl: 'rr', w: 4, h: 1, max: [240, 66], gmax: 56, zelle: (r, c) => (c < 3 ? gem(5) : gem(3)),
      notiz: (P) => N.kasten(-3, -3, 3 * P.g + 5, P.g + 6) }),
    () => szene({ kl: 'rr', w: 3, h: 2, max: [240, 130], gmax: 60, zelle: (r, c) => (r === 1 ? null : c === 0 ? gem(0, ' funke-h') : c === 2 ? sternrune() : null),
      notiz: (P) => N.text(P.x(0), P.o(1) + 18, '4 gleiche', JADE, 13) + N.text(P.x(2), P.o(1) + 18, '5 gleiche', GOLD, 13) }),
    () => szene({ kl: 'rr', w: 5, h: 2, max: [260, 120], gmax: 50, zelle: (r, c) => (r === 0 ? null : gem(c === 2 ? 2 : 5)),
      vor: `<div class="rr-aufgabe anl-aufgabe"><span class="rr-mini a5">${edelstein(5)}</span><span>Räume 14 Rubine ab</span><b>4 / 14</b></div>` }),
    () => szene({ kl: 'rr', w: 3, h: 3, max: [170, 150], gmax: 48,
      zelle: ausKarte(['abc', 'dBd', 'ddd'], { a: () => gem(1), b: () => gem(3), c: () => gem(0), d: () => gem(4), B: () => gem(5, ' gebannt') }),
      notiz: (P) => N.kasten(-3, P.o(2) - 3, P.B + 6, P.g + 6, GOLD) }),
    () => szene({ kl: 'rr', w: 1, h: 1, max: [80, 80], gmax: 70, zelle: () => gem(6) })
  ],
  hoehlenkarte: [
    () => szene({ kl: 'hk', w: 4, h: 3, max: [200, 130], zelle: ausKarte(['####', '####', '####'], { '#': () => hz('#') }) }),
    () => szene({ kl: 'hk', w: 3, h: 3, max: [150, 130], zelle: ausKarte(['###', '#1#', '###'], { '#': () => hz('#'), 1: () => hz('1') }),
      notiz: (P) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => (r === 1 && c === 1 ? '' : `<rect x="${P.l(c) + 2}" y="${P.o(r) + 2}" width="${P.g - 4}" height="${P.g - 4}" rx="4" fill="none" stroke="${GOLD}" stroke-width="2"/>`))).join('') }),
    () => szene({ kl: 'hk', w: 3, h: 3, max: [150, 130], zelle: ausKarte(['...', '.11', '.1#'], { '.': () => hz('.'), 1: () => hz('1'), '#': () => hz('#') }),
      notiz: (P) => N.ring(P.x(2), P.y(2), P.g * 0.58) }),
    () => szene({ kl: 'hk', w: 3, h: 3, max: [150, 130], zelle: ausKarte(['...', '.11', '.1F'], { '.': () => hz('.'), 1: () => hz('1'), F: () => hz('F') }) }),
    () => szene({ kl: 'hk', w: 3, h: 3, max: [150, 130], zelle: ausKarte(['1##', '1F#', '1##'], { 1: () => hz('1'), '#': () => hz('#'), F: () => hz('F') }),
      notiz: (P) => N.ring(P.x(1), P.y(0), P.g * 0.55, JADE) + N.ring(P.x(1), P.y(2), P.g * 0.55, JADE) }),
    () => szene({ kl: 'hk', w: 3, h: 3, max: [150, 130], zelle: ausKarte(['1##', 'F1#', '1##'], { 1: () => hz('1'), '#': () => hz('#'), F: () => hz('F') }),
      notiz: (P) => N.finger(P.x(1), P.y(1)) }),
    () => szene({ kl: 'hk', w: 3, h: 1, max: [160, 56], zelle: (r, c) => (c === 0 ? hz('X') : c === 2 ? hz('B') : null),
      notiz: (P) => N.pfeil(P.x(0) + P.g * 0.6, P.y(0), P.x(2) - P.g * 0.6, P.y(0)) })
  ],
  runenbrecher: [
    () => rbBild(280, 120, { schild: { x: 50, breite: RB.SCHILD.breite }, kugeln: [] }, { x: 0, y: 118, w: 100, h: 28 },
      (P) => N.finger(P.x(50), P.y(140)) + N.pfeil(P.x(38), P.y(129), P.x(18), P.y(129)) + N.pfeil(P.x(62), P.y(129), P.x(82), P.y(129))),
    () => rbBild(280, 150, { schild: { x: 50, breite: RB.SCHILD.breite }, kugeln: [{ x: 50, y: RB.SCHILD.y - RB.RADIUS }] }, { x: 10, y: 100, w: 80, h: 42 },
      (P) => N.pfeil(P.x(52), P.y(130), P.x(66), P.y(108), JADE)),
    () => rbBild(280, 130, { steine: rbSteine(['..nnSsggxx']).map((s) => ({ ...s, r: 0 })), kugeln: [{ x: 33, y: 34 }], spuren: { 0: [{ x: 45, y: 46 }, { x: 41, y: 42 }, { x: 37, y: 38 }] } }, { x: 18, y: 12, w: 82, h: 34 },
      (P) => N.text(P.x(29), P.y(27), '1×', JADE, 12) + N.text(P.x(54), P.y(27), '2×', '#d9c2ff', 12) + N.text(P.x(74), P.y(27), 'Gold', GOLD, 12) + N.text(P.x(94), P.y(27), 'fest', '#c4d0cb', 12)),
    () => rbBild(280, 150, { schild: { x: 50, breite: RB.SCHILD.breite }, extras: [{ x: 50, y: 118, art: 'breit' }], kugeln: [] }, { x: 20, y: 105, w: 60, h: 38 },
      (P) => N.pfeil(P.x(50), P.y(123), P.x(50), P.y(133))),
  ],
  jadeschlange: [
    () => szene({ kl: 'js-spiel', w: 7, h: 4, max: [250, 140], vor: '<div class="jsg-brett anl-voll"></div>',
      figuren: glieder([[2, 4], [2, 3], [2, 2], [2, 1]], 0), notiz: (P) => N.finger(P.x(5.5), P.y(3)) + N.pfeil(P.x(5.5), P.y(3), P.x(5.5), P.y(0.5)) }),
    () => szene({ kl: 'js-spiel', w: 8, h: 2, max: [270, 90], vor: '<div class="jsg-brett anl-voll"></div>',
      figuren: [...glieder([[1, 3], [1, 2], [1, 1], [1, 0]], 0), { r: 1, c: 5, html: kristall() }, { r: 0, c: 7, html: kristall(true) }] }),
    () => szene({ kl: 'js-spiel', w: 8, h: 3, max: [270, 110], vor: '<div class="jsg-brett anl-voll"><div class="jsg-tor links"></div><div class="jsg-tor rechts"></div></div>',
      figuren: glieder([[1, 0], [1, 7], [1, 6], [1, 5]], 0), notiz: (P) => N.pfeil(P.x(7) + 4, P.y(1) - P.g * 0.75, P.B - 2, P.y(1) - P.g * 0.75) + N.pfeil(2, P.y(1) - P.g * 0.75, P.x(0) - 2, P.y(1) - P.g * 0.75) }),
    () => szene({ kl: 'js-spiel', w: 6, h: 4, max: [220, 140], vor: '<div class="jsg-brett anl-voll"></div>',
      figuren: [...glieder([[2, 2], [2, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1]], 180), { r: 0, c: 5, html: jsgStein() }],
      notiz: (P) => N.ring(P.x(1.5), P.y(2), P.g * 0.75) })
  ]
};

// ---------- Kleine Vorschau für die Spieleseite ----------

export function spielVorschau(id, px = 68) {
  const m = [px - 10, px - 10];
  switch (id) {
    case '2048': return szene({ kl: 'b2048 anl-vorschau', w: 2, h: 2, max: m, gap: 3, zelle: (r, c) => kachel([2, 8, 64, 2048][r * 2 + c]) });
    case 'runenfeld': return szene({ kl: 'brf anl-vorschau', w: 4, h: 4, max: m, gap: 2, zelle: (r, c) => ((r * 4 + c) % 3 === 0 ? rfLeer() : rfVoll(1 + ((r + c) % 6))) });
    case 'kristallmine': return szene({ kl: 'bkm anl-vorschau', w: 3, h: 3, max: m,
      zelle: ausKarte(['e*e', '.d.', 'eee'], { e: (r, c) => z('erde v' + ((r + c) % 3)), '.': () => z('leer'), '*': () => z('leer stein v1'), d: () => z('leer kristall') }),
      figuren: [{ r: 1, c: 0, html: figur() }] });
    case 'steinschieber': return szene({ kl: 'ss bss anl-vorschau', w: 3, h: 3, max: m,
      zelle: ausKarte(['#F#', '..o', '###'], { '#': (r, c) => z('wand mauer v' + ((r + c) % 3)), F: () => z('wand mauer fackel v1'), '.': () => z('leer boden'), o: () => z('leer boden ziel') }),
      figuren: [{ r: 1, c: 0, html: figur() }, { r: 1, c: 1, html: runenstein() }] });
    case 'runenfall': return szene({ kl: 'rnf anl-vorschau', w: 4, h: 4, max: m,
      zelle: (r, c) => ((r === 0 && c === 1) || (r === 1 && c <= 2) ? rz(3, ' aktiv') : r === 3 ? rz(1 + c) : r === 2 && c === 3 ? rz(2) : rz(0)) });
    case 'runenreihen': return szene({ kl: 'rr anl-vorschau', w: 3, h: 3, max: m, zelle: (r, c) => gem([0, 5, 1, 3, 0, 4, 2, 0, 5][r * 3 + c]) });
    case 'hoehlenkarte': return szene({ kl: 'hk anl-vorschau', w: 3, h: 3, max: m, zelle: ausKarte(['12#', '1F#', '.1+'], { 1: () => hz('1'), 2: () => hz('2'), '#': () => hz('#'), '+': () => hz('+'), F: () => hz('F'), '.': () => hz('.') }) });
    case 'runenbrecher': return rbBild(px - 10, px - 10, { steine: RB.steineVon(0), schild: { x: 50, breite: RB.SCHILD.breite }, kugeln: [{ x: 58, y: 80 }], spuren: { 0: [{ x: 68, y: 98 }, { x: 64, y: 91 }, { x: 61, y: 85 }] } }, { x: 0, y: 12, w: 100, h: 100 }, null, 'anl-vorschau');
    case 'jadeschlange': return szene({ kl: 'js-spiel anl-vorschau', w: 4, h: 4, max: m, vor: '<div class="jsg-brett anl-voll"></div>',
      figuren: [...glieder([[1, 2], [1, 1], [2, 1], [2, 0]], 0), { r: 1, c: 3, html: kristall() }] });
    default: return '';
  }
}
