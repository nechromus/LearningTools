// Runengruft: Anzeige und Bedienung. Regeln in ./runengruft.js.
//
// runengruftStarten(wurzel, { stand, sichern(stand), melden(typ, daten), hinweisZusatz })
//   → { beenden(), stand() }
import * as R from './runengruft.js';
import * as W from './runengruft-wesen.js';

const BREITE = 640, HOEHE = 480, CX = 320, CY = 236, F = 275;
const TEX = 256;
const NAH = 0.26;

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Zufall mit Startwert (Texturen sehen immer gleich aus) ----------
function zufall(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function leinwand(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// Leuchtschicht: was selbst leuchtet, wird zusätzlich auf c.glut gemalt und im Dunkeln ungedämpft gezeigt
function glutVon(c) { if (!c.glut) c.glut = leinwand(c.width, c.height); return c.glut.getContext('2d'); }
function zweimal(t, gl, fn, aGlut = 1) { fn(t); if (gl) { gl.save(); gl.globalAlpha = aGlut; fn(gl); gl.restore(); } }

// ---------- Texturen ----------
// Ein langes Wandband, das sich nahtlos wiederholt. Jede Wandseite bekommt ihr Stück
// nach der Lage in der Welt: So laufen Fugen und Steine über benachbarte Felder weiter.
const ATLAS_FELDER = 8;
function steinAtlas(seed) {
  const W = TEX * ATLAS_FELDER;
  const c = leinwand(W, TEX), g = c.getContext('2d'), rnd = zufall(seed);
  g.fillStyle = '#0b0e0d'; g.fillRect(0, 0, W, TEX);
  const reihen = 6, rh = TEX / reihen;
  const bloecke = [];
  for (let r = 0; r < reihen; r++) {
    const start = rnd() * 60;
    let x = start;
    const ende = start + W;
    while (x < ende - 1) {
      let w = 44 + rnd() * 70;
      if (ende - (x + w) < 40) w = ende - x;       // letzter Stein schließt genau an den ersten an
      // ab und zu zwei halbhohe Steine übereinander
      if (rnd() < 0.08 && w > 50) { bloecke.push([x, r * rh, w, rh / 2]); bloecke.push([x, r * rh + rh / 2, w, rh / 2]); }
      else bloecke.push([x, r * rh, w, rh]);
      x += w;
    }
  }
  for (const [bx, by, bw, bh] of bloecke) {
    // zweimal zeichnen, wenn der Stein über das Ende hinausragt (nahtlos)
    const art = rnd(), ton = rnd(), hell = rnd();
    const seedStein = Math.floor(rnd() * 1e9);
    for (const off of [0, -W]) {
      if (bx + off > W || bx + bw + off < 0) continue;
      steinMalen(g, bx + off, by, bw, bh, art, ton, hell, zufall(seedStein));
    }
  }
  return c;
}
function steinMalen(g, x0, y0, w0, h0, art, ton, hell, rnd) {
  const fu = 1.2 + rnd() * 0.8;                       // dünne Fuge
  const x = x0 + fu, y = y0 + fu, w = w0 - fu * 2, h = h0 - fu * 2;
  // Farbe: graugrün bis warmgrau, manche Steine deutlich heller oder dunkler
  let t = 78 + hell * 46;
  if (hell < 0.08) t -= 22; else if (hell > 0.94) t += 18;
  const warm = (ton - 0.5) * 12;
  const r0 = t + warm - 2, g0 = t + 3, b0 = t - warm * 0.5 + 8;
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 2, y + 2, w, h);
  const gr = g.createRadialGradient(x + w * (0.3 + rnd() * 0.2), y + h * 0.3, 3, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.8);
  gr.addColorStop(0, `rgb(${r0 + 18},${g0 + 18},${b0 + 18})`);
  gr.addColorStop(1, `rgb(${r0 - 22},${g0 - 20},${b0 - 18})`);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  // Fase: Licht von links oben; unterschiedlich stark gewölbt
  const fa = 2.5 + rnd() * 4;
  g.fillStyle = `rgba(255,250,230,${0.1 + rnd() * 0.1})`;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - fa, y + fa); g.lineTo(x + fa, y + fa); g.lineTo(x + fa, y + h - fa); g.lineTo(x, y + h); g.closePath(); g.fill();
  g.fillStyle = `rgba(0,0,0,${0.28 + rnd() * 0.15})`;
  g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.lineTo(x + fa, y + h - fa); g.lineTo(x + w - fa, y + h - fa); g.lineTo(x + w - fa, y + fa); g.closePath(); g.fill();
  // Oberfläche: fleckig, glatt oder grob
  if (art < 0.35) {        // fleckig
    for (let i = 0; i < 14; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,240,0.06)';
      g.beginPath(); g.ellipse(x + fa + rnd() * (w - fa * 2), y + fa + rnd() * (h - fa * 2), 2 + rnd() * 7, 1.5 + rnd() * 4, rnd() * 3, 0, 7); g.fill();
    }
  } else if (art < 0.75) { // grob gekörnt
    for (let i = 0; i < w * h / 40; i++) {
      g.fillStyle = rnd() < 0.55 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,240,0.07)';
      g.fillRect(x + fa + rnd() * (w - fa * 2), y + fa + rnd() * (h - fa * 2), 1 + rnd() * 2, 1 + rnd() * 2);
    }
  } else {                 // glatt mit feinen Linien (Schichtung)
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const yy = y + fa + rnd() * (h - fa * 2); g.beginPath(); g.moveTo(x + fa, yy); g.lineTo(x + w - fa, yy + (rnd() - 0.5) * 4); g.stroke(); }
  }
  if (rnd() < 0.25) {      // abgeplatzte Ecke
    const ex = rnd() < 0.5 ? x : x + w - 10, ey = rnd() < 0.5 ? y : y + h - 8;
    g.fillStyle = 'rgba(10,14,12,0.75)'; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + 10, ey + 2); g.lineTo(ex + 3, ey + 8); g.closePath(); g.fill();
  }
  // Feuchtigkeit unten im Band (Moosansatz)
  if (y0 > TEX * 0.6) {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(${50 + rnd() * 30},${110 + rnd() * 50},${80 + rnd() * 30},${0.08 + rnd() * 0.15})`;
      g.beginPath(); g.arc(x + rnd() * w, y + h - rnd() * 8, 1 + rnd() * 3, 0, 7); g.fill();
    }
  }
}

// Kleine Helfer für Metall und Stein in den Türbildern
function metall(t, pts, hell = '#5c6668', dunkel = '#14191b') {
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const gr = t.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  gr.addColorStop(0, hell); gr.addColorStop(1, dunkel);
  t.beginPath(); pts.forEach(([x, y], i) => i ? t.lineTo(x, y) : t.moveTo(x, y)); t.closePath();
  t.fillStyle = gr; t.fill();
  t.strokeStyle = 'rgba(0,0,0,0.7)'; t.lineWidth = 1.5; t.stroke();
  t.save(); t.clip(); t.strokeStyle = 'rgba(255,245,225,0.18)'; t.lineWidth = 2; t.beginPath(); pts.forEach(([x, y], i) => i ? t.lineTo(x + 1.5, y + 1.5) : t.moveTo(x + 1.5, y + 1.5)); t.closePath(); t.stroke(); t.restore();
}
function niete(t, x, y, r = 3) {
  t.fillStyle = '#2a2014'; t.beginPath(); t.arc(x + 0.8, y + 0.8, r, 0, 7); t.fill();
  const g = t.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r); g.addColorStop(0, '#f0d28c'); g.addColorStop(1, '#6b4f22');
  t.fillStyle = g; t.beginPath(); t.arc(x, y, r, 0, 7); t.fill();
}
function steinrahmen(t, rnd) {
  // Portal: Pfeiler und Sturz aus großen Blöcken, Bronzeband innen
  t.fillStyle = '#0b0e0d'; t.fillRect(0, 0, TEX, TEX);
  const block = (x, y, w, h) => { const v = 70 + rnd() * 26; const g = t.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, `rgb(${v + 8},${v + 12},${v + 16})`); g.addColorStop(1, `rgb(${v - 26},${v - 22},${v - 18})`); t.fillStyle = g; t.fillRect(x + 1.5, y + 1.5, w - 3, h - 3); t.fillStyle = 'rgba(255,250,235,0.12)'; t.fillRect(x + 1.5, y + 1.5, w - 3, 3); t.fillStyle = 'rgba(0,0,0,0.35)'; t.fillRect(x + 1.5, y + h - 5, w - 3, 3); };
  for (let y = 0; y < TEX; y += 42) { block(0, y, 30, 42); block(TEX - 30, y, 30, 42); }
  block(0, 0, 90, 30); block(90, 0, 76, 30); block(166, 0, 90, 30);
  // Schlussstein mit Rune
  metall(t, [[104, 0], [152, 0], [144, 36], [112, 36]], '#7a8486', '#232a2c');
  t.strokeStyle = '#a07a3a'; t.lineWidth = 3; t.strokeRect(30, 30, TEX - 60, TEX - 30);
  t.strokeStyle = 'rgba(255,230,170,0.35)'; t.lineWidth = 1; t.strokeRect(32, 32, TEX - 64, TEX - 32);
}

function tuerTextur() {
  const c = leinwand(TEX, TEX), t = c.getContext('2d'), rnd = zufall(77);
  const gl = glutVon(c);
  steinrahmen(t, rnd);
  zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#5FE8B4'; ctx.shadowBlur = 10; runeZeichnen(ctx, 'stern', 128, 20, 9, '#7dffcb', 2.5); ctx.restore(); }, 0.8);
  // Zwei Flügel aus geschichteten Platten
  const L = 33, R = TEX - 33, O = 33, U = TEX, M = 128;
  for (const [x0, x1] of [[L, M - 1], [M + 1, R]]) {
    metall(t, [[x0, O], [x1, O], [x1, U], [x0, U]], '#3d4648', '#0d1112');
    // Plattenreihen mit Fase
    for (let y = O + 10; y < U - 6; y += 46) {
      const pts = [[x0 + 8, y], [x1 - 8, y], [x1 - 8, y + 38], [x0 + 8, y + 38]];
      metall(t, pts, '#566062', '#171c1e');
      niete(t, x0 + 13, y + 5, 2.4); niete(t, x1 - 13, y + 5, 2.4); niete(t, x0 + 13, y + 33, 2.4); niete(t, x1 - 13, y + 33, 2.4);
    }
    // Bronzebänder quer
    for (const y of [O + 54, U - 46]) { metall(t, [[x0, y], [x1, y], [x1, y + 12], [x0, y + 12]], '#d2a95c', '#5a4018'); for (let x = x0 + 10; x < x1 - 4; x += 18) niete(t, x, y + 6, 2.2); }
  }
  // Mittelfuge
  t.fillStyle = '#020303'; t.fillRect(M - 1.5, O, 3, U - O);
  // Leuchtbahnen vom Schloss zu den Rändern (eingraviert, leuchten schwach)
  const bahnen = [[[M - 34, 138], [M - 60, 138], [M - 60, 96], [L + 14, 96]], [[M + 34, 138], [M + 60, 138], [M + 60, 182], [R - 14, 182]], [[M - 20, 168], [M - 20, 210], [L + 30, 210]], [[M + 20, 108], [M + 20, 66], [R - 30, 66]]];
  const linien = (ctx, b, f) => { ctx.strokeStyle = f; ctx.lineWidth = b; ctx.lineJoin = 'round'; for (const pts of bahnen) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); } };
  linien(t, 4, 'rgba(0,0,0,0.7)');
  zweimal(t, gl, (ctx) => { linien(ctx, 1.5, 'rgba(95,232,180,0.6)'); for (const pts of bahnen) { const [x, y] = pts[pts.length - 1]; ctx.fillStyle = '#b8ffe2'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); } }, 0.7);
  // Ringschloss: drei Ringe mit Kerben, Bronze, in der Mitte der Schlitz
  const cy = 138;
  t.fillStyle = 'rgba(0,0,0,0.6)'; t.beginPath(); t.arc(M + 3, cy + 4, 40, 0, 7); t.fill();
  for (const [r, hell, dunkel] of [[38, '#e2bd73', '#5a3e1a'], [28, '#5c6668', '#14191b'], [18, '#c49a4f', '#4a3418']]) {
    const g = t.createLinearGradient(M - r, cy - r, M + r, cy + r); g.addColorStop(0, hell); g.addColorStop(1, dunkel);
    t.fillStyle = g; t.beginPath(); t.arc(M, cy, r, 0, 7); t.fill();
    t.strokeStyle = 'rgba(0,0,0,0.6)'; t.lineWidth = 1.2; t.stroke();
    t.strokeStyle = 'rgba(255,240,200,0.3)'; t.beginPath(); t.arc(M, cy, r - 2, 3.4, 5.4); t.stroke();
  }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; t.strokeStyle = 'rgba(40,25,8,0.8)'; t.lineWidth = 2; t.beginPath(); t.moveTo(M + Math.cos(a) * 30, cy + Math.sin(a) * 30); t.lineTo(M + Math.cos(a) * 37, cy + Math.sin(a) * 37); t.stroke(); }
  zweimal(t, gl, (ctx) => { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26; ctx.fillStyle = '#5FE8B4'; ctx.beginPath(); ctx.arc(M + Math.cos(a) * 23, cy + Math.sin(a) * 23, 2, 0, 7); ctx.fill(); } }, 0.8);
  // Schlüsselschlitz: Rautenform, leuchtet von innen
  t.fillStyle = '#020403'; t.beginPath(); t.moveTo(M, cy - 11); t.lineTo(M + 5, cy); t.lineTo(M, cy + 11); t.lineTo(M - 5, cy); t.closePath(); t.fill();
  zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#5FE8B4'; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(95,232,180,0.9)'; ctx.beginPath(); ctx.moveTo(M, cy - 8); ctx.lineTo(M + 2.5, cy); ctx.lineTo(M, cy + 8); ctx.lineTo(M - 2.5, cy); ctx.closePath(); ctx.fill(); ctx.restore(); });
  // Griffe: Ringe links und rechts vom Schloss
  for (const d of [-1, 1]) { const x = M + d * 58, y = 150; t.fillStyle = '#2a2014'; t.fillRect(x - 6, y - 16, 12, 10); t.strokeStyle = '#c49a4f'; t.lineWidth = 4; t.beginPath(); t.arc(x, y, 11, 0, 7); t.stroke(); t.strokeStyle = 'rgba(255,240,200,0.4)'; t.lineWidth = 1.2; t.beginPath(); t.arc(x - 1, y - 1, 11, 3.6, 5.2); t.stroke(); }
  return c;
}

function gitterTextur(rune = false, an = 0) {
  const c = leinwand(TEX, TEX), t = c.getContext('2d'), rnd = zufall(rune ? 91 : 61);
  const gl = glutVon(c);
  steinrahmen(t, rnd);
  // Dahinter: Dunkelheit mit leichtem Schein
  const hg = t.createRadialGradient(TEX / 2, TEX * 0.7, 6, TEX / 2, TEX * 0.7, TEX * 0.6);
  hg.addColorStop(0, rune ? 'rgba(95,232,180,0.16)' : 'rgba(120,140,130,0.12)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = '#050706'; t.fillRect(33, 33, TEX - 66, TEX - 33); t.fillStyle = hg; t.fillRect(33, 33, TEX - 66, TEX - 33);
  // Energiefeld zwischen den Stäben
  zweimal(t, gl, (ctx) => { const eg = ctx.createLinearGradient(0, 40, 0, TEX); eg.addColorStop(0, `rgba(95,232,180,${rune ? 0.22 : 0.12})`); eg.addColorStop(1, 'rgba(95,232,180,0.02)'); ctx.fillStyle = eg; ctx.fillRect(36, 40, TEX - 72, TEX - 40); }, 0.6);
  // Stäbe: gegliedert, mit Spitzen und Manschetten
  for (let x = 48; x < TEX - 36; x += 22) {
    const g = t.createLinearGradient(x - 5, 0, x + 5, 0); g.addColorStop(0, '#3a2c16'); g.addColorStop(0.45, '#e2bd73'); g.addColorStop(1, '#3a2c16');
    t.fillStyle = g; t.fillRect(x - 4, 74, 8, TEX - 74);
    t.fillStyle = '#d2a95c'; t.beginPath(); t.moveTo(x - 6, 78); t.lineTo(x, 64); t.lineTo(x + 6, 78); t.closePath(); t.fill();
    for (const y of [118, 190]) { metall(t, [[x - 7, y], [x + 7, y], [x + 7, y + 10], [x - 7, y + 10]], '#e2bd73', '#5a4018'); }
  }
  // Querträger mit Rautenmuster
  for (const y of [122, 194]) {
    metall(t, [[34, y - 4], [TEX - 34, y - 4], [TEX - 34, y + 8], [34, y + 8]], '#6a5430', '#20180b');
    zweimal(t, gl, (ctx) => { for (let x = 44; x < TEX - 40; x += 22) { ctx.fillStyle = 'rgba(95,232,180,0.7)'; ctx.beginPath(); ctx.moveTo(x + 11, y - 1); ctx.lineTo(x + 14, y + 2); ctx.lineTo(x + 11, y + 5); ctx.lineTo(x + 8, y + 2); ctx.closePath(); ctx.fill(); } }, rune ? 0.7 : 0.35);
  }
  // Bronzeplatte unter dem Sturz
  metall(t, [[36, 34], [TEX - 36, 34], [TEX - 36, 62], [36, 62]], '#b8914c', '#3b2a12');
  for (const x of [44, TEX - 44]) niete(t, x, 48, 3);
  if (rune) {
    // drei Kristallfassungen, leuchten mit den berührten Runen
    for (let i = 0; i < 3; i++) {
      const x = 84 + i * 44, y = 48;
      t.fillStyle = '#0a0d0c'; t.beginPath(); t.arc(x, y, 10, 0, 7); t.fill();
      niete(t, x - 12, y, 2); niete(t, x + 12, y, 2);
      t.strokeStyle = '#c49a4f'; t.lineWidth = 2.5; t.beginPath(); t.arc(x, y, 10, 0, 7); t.stroke();
      if (i < an) zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#5FE8B4'; ctx.shadowBlur = 16; const kg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, 8); kg.addColorStop(0, '#ffffff'); kg.addColorStop(0.5, '#5FE8B4'); kg.addColorStop(1, 'rgba(95,232,180,0.3)'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.restore(); });
      else { t.fillStyle = '#16231f'; t.beginPath(); t.arc(x, y, 6, 0, 7); t.fill(); }
    }
  } else {
    zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#5FE8B4'; ctx.shadowBlur = 8; runeZeichnen(ctx, 'welle', 128, 48, 10, '#7dffcb', 2.4); ctx.restore(); }, 0.6);
  }
  return c;
}

// Runenzeichen (ohne Text, als Bild)
function runeZeichnen(g, art, x, y, r, farbe, breite = 6) {
  g.save(); g.strokeStyle = farbe; g.fillStyle = farbe; g.lineWidth = breite; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (art === 'welle') {
    for (let k = -1; k <= 1; k++) {
      const yy = y + k * r * 0.55;
      g.moveTo(x - r, yy);
      g.bezierCurveTo(x - r * 0.5, yy - r * 0.35, x - r * 0.2, yy + r * 0.35, x, yy);
      g.bezierCurveTo(x + r * 0.2, yy - r * 0.35, x + r * 0.5, yy + r * 0.35, x + r, yy);
    }
    g.stroke();
  } else if (art === 'stern') {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4;
      g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    }
    g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.22, 0, 7); g.fill();
  } else if (art === 'auge') {
    g.moveTo(x - r, y); g.quadraticCurveTo(x, y - r * 1.1, x + r, y); g.quadraticCurveTo(x, y + r * 1.1, x - r, y);
    g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.28, 0, 7); g.fill();
  } else if (art === 'wurzel') {
    // Stamm mit drei Wurzeln
    g.moveTo(x, y - r); g.lineTo(x, y + r * 0.2);
    g.moveTo(x, y + r * 0.2); g.quadraticCurveTo(x - r * 0.2, y + r * 0.7, x - r * 0.9, y + r);
    g.moveTo(x, y + r * 0.2); g.lineTo(x, y + r);
    g.moveTo(x, y + r * 0.2); g.quadraticCurveTo(x + r * 0.2, y + r * 0.7, x + r * 0.9, y + r);
    g.moveTo(x - r * 0.45, y - r * 0.55); g.lineTo(x, y - r * 0.2); g.lineTo(x + r * 0.45, y - r * 0.55);
    g.stroke();
  } else if (art === 'licht') {
    // Kreis mit Strahlen
    g.arc(x, y, r * 0.42, 0, 7); g.stroke();
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke();
  }
  g.restore();
}

// ---------- Abwechslung an den Wänden ----------
// Jede Wandseite bekommt nach einem festen Muster eine Verzierung (immer gleich für dieselbe Stelle).
function dekoHash(x, y, n) {
  let h = Math.imul(x * 374761393 + y * 668265263 + n * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0);
}
const DEKO_TABELLE = [
  [22, 'stein'], [30, 'paneel'], [42, 'moos'], [51, 'risse'], [61, 'spinnweben'], [67, 'wurzeln'], [72, 'wasser'],
  [77, 'pilze'], [81, 'ritzung'], [84, 'ring'], [89, 'nische_kerze'], [92, 'nische_kristall'], [95, 'nische_krug'], [100, 'flicken']
];
// Je Etage mehr von einer Art (z. B. Pilze und Wurzeln im Wurzelwerk)
let DEKO_EXTRA = null;
function dekoArt(x, y, n) {
  const w = dekoHash(x, y, n) % 100;
  if (DEKO_EXTRA) { const w2 = dekoHash(x, y, n + 31) % 100; if (w2 < DEKO_EXTRA.anteil) return DEKO_EXTRA.arten[w2 % DEKO_EXTRA.arten.length]; }
  for (const [g, a] of DEKO_TABELLE) if (w < g) return a;
  return 'stein';
}

function dekoMalen(t, art, rnd, gl = null) {
  const T = TEX;
  if (art === 'paneel') {
    // Eingelassene Tafel alter Technik: Bronzerahmen, eingravierte Bahnen, die schwach jadegrün leuchten
    const x = 54 + rnd() * 20, y = 46 + rnd() * 16, w = 130 + rnd() * 20, h = 136 + rnd() * 20;
    t.fillStyle = 'rgba(0,0,0,0.55)'; t.fillRect(x - 3, y - 3, w + 6, h + 6);
    const pg = t.createLinearGradient(x, y, x + w, y + h); pg.addColorStop(0, '#3a4446'); pg.addColorStop(1, '#151b1d');
    t.fillStyle = pg; t.fillRect(x, y, w, h);
    t.fillStyle = 'rgba(0,0,0,0.45)'; t.fillRect(x, y, w, 6); t.fillRect(x, y, 6, h);
    t.strokeStyle = '#a07a3a'; t.lineWidth = 2; t.strokeRect(x + 6, y + 6, w - 12, h - 12);
    t.strokeStyle = 'rgba(255,230,170,0.25)'; t.lineWidth = 1; t.strokeRect(x + 8, y + 8, w - 16, h - 16);
    for (const [nx, ny] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) { t.fillStyle = '#c49a4f'; t.beginPath(); t.arc(nx, ny, 3, 0, 7); t.fill(); }
    const bahnen = [];
    for (let i = 0; i < 7; i++) {
      let px = x + 18 + rnd() * (w - 36), py = y + 18 + rnd() * (h - 36); const pts = [[px, py]];
      for (let k = 0; k < 4; k++) { if (rnd() < 0.5) px = Math.min(x + w - 16, Math.max(x + 16, px + (rnd() - 0.5) * 80)); else py = Math.min(y + h - 16, Math.max(y + 16, py + (rnd() - 0.5) * 80)); pts.push([px, py]); }
      bahnen.push(pts);
    }
    const linie = (ctx, breite, farbe) => { ctx.strokeStyle = farbe; ctx.lineWidth = breite; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (const pts of bahnen) { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke(); } };
    linie(t, 4, 'rgba(0,0,0,0.6)');
    zweimal(t, gl, (ctx) => { linie(ctx, 1.6, 'rgba(95,232,180,0.55)'); for (const pts of bahnen) { const [a, b] = pts[pts.length - 1]; ctx.fillStyle = 'rgba(180,255,225,0.8)'; ctx.beginPath(); ctx.arc(a, b, 2.4, 0, 7); ctx.fill(); } });
    // Kristallauge in der Mitte
    const mx = x + w / 2, my = y + h / 2;
    t.fillStyle = '#0a0d0e'; t.beginPath(); t.arc(mx, my, 11, 0, 7); t.fill(); t.strokeStyle = '#c49a4f'; t.lineWidth = 2; t.stroke();
    zweimal(t, gl, (ctx) => { const kg = ctx.createRadialGradient(mx - 2, my - 2, 0, mx, my, 8); kg.addColorStop(0, '#ffffff'); kg.addColorStop(0.5, '#5FE8B4'); kg.addColorStop(1, 'rgba(95,232,180,0.2)'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(mx, my, 7, 0, 7); ctx.fill(); });
    return;
  }
  if (art === 'moos') {
    // Polster von unten, ein paar Ranken von oben
    for (let k = 0; k < 4; k++) {
      const cx = rnd() * T, h = 40 + rnd() * 90;
      for (let i = 0; i < 160; i++) {
        const x = cx + (rnd() - 0.5) * 90 * (1 - i / 220), y = T - rnd() * h;
        const g0 = 90 + rnd() * 80;
        t.fillStyle = `rgba(${40 + rnd() * 30},${g0},${50 + rnd() * 30},${0.35 + rnd() * 0.4})`;
        t.beginPath(); t.arc(x, y, 1.5 + rnd() * 4.5, 0, 7); t.fill();
      }
    }
    for (let k = 0; k < 5; k++) {
      let x = rnd() * T, y = 0; const l = 30 + rnd() * 80;
      t.strokeStyle = `rgba(70,${120 + rnd() * 50},70,0.7)`; t.lineWidth = 2 + rnd() * 2; t.beginPath(); t.moveTo(x, y);
      while (y < l) { x += (rnd() - 0.5) * 6; y += 6; t.lineTo(x, y); }
      t.stroke();
    }
  } else if (art === 'risse' || art === 'riss') {
    const n = art === 'riss' ? 1 : 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) riss(t, rnd, 30 + rnd() * (T - 60), rnd() * 60, 8, 0);
  } else if (art === 'spinnweben') {
    const rechts = rnd() < 0.5, cx = rechts ? T : 0, cy = 0, R0 = 70 + rnd() * 60;
    t.strokeStyle = 'rgba(225,230,225,0.42)'; t.lineWidth = 1.2;
    const strahlen = 7, winkel = [];
    for (let i = 0; i < strahlen; i++) {
      const a = (rechts ? Math.PI / 2 : 0) + (i / (strahlen - 1)) * Math.PI / 2;
      winkel.push(a);
      t.beginPath(); t.moveTo(cx, cy); t.lineTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); t.stroke();
    }
    for (let r = 14; r < R0; r += 11 + rnd() * 5) {
      t.beginPath();
      for (let i = 0; i < strahlen; i++) {
        const a = winkel[i], x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (!i) t.moveTo(x, y);
        else { const am = (winkel[i - 1] + a) / 2, rm = r * 0.86; t.quadraticCurveTo(cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, x, y); }
      }
      t.stroke();
    }
    // Spinne? Nur ein kleiner Punkt am Faden
    t.strokeStyle = 'rgba(225,230,225,0.3)'; const fx = rechts ? T - 40 - rnd() * 30 : 40 + rnd() * 30;
    t.beginPath(); t.moveTo(fx, 0); t.lineTo(fx, 90 + rnd() * 40); t.stroke();
    t.fillStyle = '#121212'; t.beginPath(); t.arc(fx, 95 + rnd() * 40, 4, 0, 7); t.fill();
  } else if (art === 'wurzeln') {
    for (let k = 0; k < 3 + Math.floor(rnd() * 3); k++) wurzel(t, rnd, rnd() * T, 0, 7 + rnd() * 4, 0);
  } else if (art === 'wasser') {
    const x0 = 40 + rnd() * (T - 80);
    const gr = t.createLinearGradient(0, 0, 0, T);
    gr.addColorStop(0, 'rgba(10,20,18,0.55)'); gr.addColorStop(1, 'rgba(10,20,18,0.1)');
    t.fillStyle = gr;
    for (let i = 0; i < 6; i++) { const x = x0 + (rnd() - 0.5) * 50, w = 6 + rnd() * 16; t.fillRect(x, 0, w, T * (0.5 + rnd() * 0.5)); }
    t.fillStyle = 'rgba(200,240,230,0.35)';
    for (let i = 0; i < 5; i++) { t.beginPath(); t.ellipse(x0 + (rnd() - 0.5) * 40, 40 + rnd() * 180, 2, 4, 0, 0, 7); t.fill(); }
  } else if (art === 'pilze') {
    for (let i = 0; i < 9; i++) {
      const x = 30 + rnd() * (T - 60), y = T - 8 - rnd() * 22, r = 5 + rnd() * 9;
      const gf = 220 + rnd() * 35, bf = 180 + rnd() * 40;
      t.fillStyle = '#cfe9dc'; t.fillRect(x - 1.5, y, 3, 10);
      zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#5FE8B4'; ctx.shadowBlur = 14; ctx.fillStyle = `rgba(110,${gf},${bf},0.95)`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, Math.PI, 0); ctx.fill(); ctx.restore(); });
    }
  } else if (art === 'ritzung') {
    t.save(); t.globalAlpha = 0.55;
    const arten = ['welle', 'stern', 'auge'];
    runeZeichnen(t, arten[Math.floor(rnd() * 3)], 80 + rnd() * 100, 90 + rnd() * 60, 22 + rnd() * 10, '#1a201d', 4);
    t.strokeStyle = 'rgba(255,250,230,0.12)'; t.lineWidth = 1; t.strokeRect(50, 60, 156, 120);
    t.restore();
  } else if (art === 'ring') {
    const x = 70 + rnd() * 110, y = 100 + rnd() * 40;
    t.fillStyle = '#26292a'; t.fillRect(x - 12, y - 14, 24, 20);
    t.strokeStyle = '#4a5052'; t.lineWidth = 6; t.beginPath(); t.arc(x, y + 24, 18, 0, 7); t.stroke();
    t.strokeStyle = 'rgba(255,255,255,0.15)'; t.lineWidth = 2; t.beginPath(); t.arc(x - 2, y + 22, 18, Math.PI * 1.1, Math.PI * 1.6); t.stroke();
    t.fillStyle = 'rgba(120,60,20,0.3)'; t.fillRect(x - 6, y + 40, 12, 40);
  } else if (art.startsWith('nische')) {
    nische(t, art, rnd, gl);
  } else if (art === 'flicken') {
    const x0 = 40 + rnd() * 80, y0 = 50 + rnd() * 80, w = 90, h = 70;
    for (let yy = y0; yy < y0 + h; yy += 18) for (let xx = x0 + ((yy / 18) % 2) * 12; xx < x0 + w; xx += 26) {
      const v = 110 + rnd() * 30;
      t.fillStyle = '#0d110f'; t.fillRect(xx, yy, 26, 18);
      t.fillStyle = `rgb(${v + 10},${v},${v - 14})`; t.fillRect(xx + 2, yy + 2, 22, 14);
      t.fillStyle = 'rgba(255,250,230,0.15)'; t.fillRect(xx + 2, yy + 2, 22, 2);
      t.fillStyle = 'rgba(0,0,0,0.35)'; t.fillRect(xx + 2, yy + 14, 22, 2);
    }
  }
}

function riss(t, rnd, x, y, dicke, tiefe) {
  t.lineCap = 'round';
  let px = x, py = y;
  const n = 6 + Math.floor(rnd() * 5);
  for (let i = 0; i < n && dicke > 0.6; i++) {
    const nx = px + (rnd() - 0.5) * 34, ny = py + 14 + rnd() * 20;
    t.strokeStyle = 'rgba(5,7,6,0.85)'; t.lineWidth = dicke;
    t.beginPath(); t.moveTo(px, py); t.lineTo(nx, ny); t.stroke();
    t.strokeStyle = 'rgba(255,250,230,0.12)'; t.lineWidth = 1;
    t.beginPath(); t.moveTo(px + dicke * 0.6, py); t.lineTo(nx + dicke * 0.6, ny); t.stroke();
    if (tiefe < 2 && rnd() < 0.3) riss(t, rnd, nx, ny, dicke * 0.55, tiefe + 1);
    px = nx; py = ny; dicke *= 0.82;
  }
}
function wurzel(t, rnd, x, y, dicke, tiefe) {
  let px = x, py = y;
  while (dicke > 0.8 && py < TEX * 0.85) {
    const nx = px + (rnd() - 0.5) * 18, ny = py + 10 + rnd() * 12;
    t.strokeStyle = '#3b2a1c'; t.lineWidth = dicke; t.lineCap = 'round';
    t.beginPath(); t.moveTo(px, py); t.lineTo(nx, ny); t.stroke();
    t.strokeStyle = 'rgba(200,160,110,0.25)'; t.lineWidth = Math.max(1, dicke * 0.3);
    t.beginPath(); t.moveTo(px - dicke * 0.25, py); t.lineTo(nx - dicke * 0.25, ny); t.stroke();
    if (tiefe < 2 && rnd() < 0.22) wurzel(t, rnd, nx, ny, dicke * 0.6, tiefe + 1);
    px = nx; py = ny; dicke *= 0.88;
  }
}
// Nische: ein Rundbogen in die Wand gehauen, innen dunkel, mit Kerze, Kristall oder Krug
function nische(t, art, rnd, gl = null) {
  const x = 84, y = 70, w = 88, h = 120, sohle = y + h;
  const bogen = (dx = 0, dy = 0, ww = w) => {
    t.beginPath(); t.moveTo(x + dx, sohle + dy); t.lineTo(x + dx, y + ww / 2 + dy);
    t.arc(x + dx + ww / 2, y + ww / 2 + dy, ww / 2, Math.PI, 0); t.lineTo(x + dx + ww, sohle + dy); t.closePath();
  };
  // Rahmen aus hellerem Stein
  t.fillStyle = '#5e6560'; bogen(-10, -10, w + 20); t.fill();
  t.strokeStyle = 'rgba(0,0,0,0.5)'; t.lineWidth = 2; t.stroke();
  // Innen: dunkel, oben und links tiefer Schatten
  const gr = t.createLinearGradient(x, y, x + w * 0.7, sohle);
  gr.addColorStop(0, '#07090a'); gr.addColorStop(1, '#262b28');
  t.fillStyle = gr; bogen(); t.fill();
  const inner = t.createRadialGradient(x + w * 0.55, sohle - 20, 4, x + w * 0.5, sohle - 20, w * 0.8);
  if (art === 'nische_kerze') { inner.addColorStop(0, 'rgba(255,180,90,0.55)'); inner.addColorStop(1, 'rgba(255,140,60,0)'); }
  else if (art === 'nische_kristall') { inner.addColorStop(0, 'rgba(95,232,180,0.5)'); inner.addColorStop(1, 'rgba(95,232,180,0)'); }
  else { inner.addColorStop(0, 'rgba(60,60,50,0.3)'); inner.addColorStop(1, 'rgba(0,0,0,0)'); }
  t.save(); bogen(); t.clip(); t.fillStyle = inner; t.fillRect(x, y, w, h); t.restore();
  // Sims
  t.fillStyle = '#6c736d'; t.fillRect(x - 14, sohle, w + 28, 10);
  t.fillStyle = 'rgba(255,250,230,0.18)'; t.fillRect(x - 14, sohle, w + 28, 2);
  t.fillStyle = 'rgba(0,0,0,0.5)'; t.fillRect(x - 14, sohle + 10, w + 28, 4);
  const mx = x + w / 2;
  if (art === 'nische_kerze') {
    for (const [dx, hh] of [[-18, 34], [6, 46], [24, 26]]) {
      t.fillStyle = '#e8dcc0'; t.fillRect(mx + dx - 5, sohle - hh, 10, hh);
      t.fillStyle = 'rgba(255,255,255,0.3)'; t.fillRect(mx + dx - 5, sohle - hh, 3, hh);
      t.fillStyle = '#e8dcc0'; t.beginPath(); t.arc(mx + dx + 4, sohle - hh + 6, 3, 0, 7); t.fill();
      zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#ffb050'; ctx.shadowBlur = 16;
      const fg = ctx.createRadialGradient(mx + dx, sohle - hh - 9, 1, mx + dx, sohle - hh - 7, 9);
      fg.addColorStop(0, '#fff7d6'); fg.addColorStop(0.6, '#ffbe55'); fg.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(mx + dx, sohle - hh - 8, 5, 10, 0, 0, 7); ctx.fill(); ctx.restore(); });
    }
  } else if (art === 'nische_kristall') {
    zweimal(t, gl, (ctx) => { ctx.save(); ctx.shadowColor = '#5FE8B4'; ctx.shadowBlur = 22;
    const kg = ctx.createLinearGradient(mx - 16, sohle - 60, mx + 16, sohle);
    kg.addColorStop(0, '#d8fff0'); kg.addColorStop(0.5, '#5FE8B4'); kg.addColorStop(1, '#1d7a5c');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.moveTo(mx, sohle - 64); ctx.lineTo(mx + 14, sohle - 30); ctx.lineTo(mx + 8, sohle); ctx.lineTo(mx - 8, sohle); ctx.lineTo(mx - 14, sohle - 30); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mx + 18, sohle - 34); ctx.lineTo(mx + 26, sohle - 14); ctx.lineTo(mx + 20, sohle); ctx.lineTo(mx + 12, sohle); ctx.closePath(); ctx.fill();
    ctx.restore(); }, 0.8);
  } else {
    // alter Krug
    const kg = t.createRadialGradient(mx - 8, sohle - 30, 3, mx, sohle - 22, 26);
    kg.addColorStop(0, '#a5784e'); kg.addColorStop(1, '#4a2f1c');
    t.fillStyle = kg; t.beginPath(); t.ellipse(mx, sohle - 22, 20, 22, 0, 0, 7); t.fill();
    t.fillRect(mx - 8, sohle - 52, 16, 12);
    t.fillStyle = '#3a2416'; t.fillRect(mx - 11, sohle - 54, 22, 5);
    t.strokeStyle = 'rgba(0,0,0,0.4)'; t.lineWidth = 2; t.beginPath(); t.moveTo(mx - 18, sohle - 26); t.lineTo(mx + 18, sohle - 26); t.stroke();
  }
}

// ---------- Anzeige ----------
export function runengruftStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const A = R.AUSR;
  let s = R.standPruefen(opt.stand) || R.neuesSpiel(0);
  R.sichtMerken(s);

  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  wurzel.classList.add('rg');
  wurzel.innerHTML = `
    <div class="rg-kopf">
      <div class="rg-titel"><span class="rg-name">Runengruft</span><span class="rg-etage"></span></div>
      <div class="rg-kopf-knoepfe">
        <button class="rg-klein rg-kobold-knopf" data-a="kobold" aria-label="Hilfe vom Kobold">Kobold</button>
        <button class="rg-klein" data-a="tagebuch" aria-label="Tagebuch">Tagebuch</button>
        <button class="rg-klein" data-a="karte" aria-label="Karte">Karte</button>
        <button class="rg-klein" data-a="hilfe" aria-label="So geht's">?</button>
      </div>
    </div>
    <div class="rg-sicht">
      <canvas class="rg-bild" width="${BREITE}" height="${HOEHE}" aria-label="Blick in den Gang. Tippe auf Dinge an der Wand."></canvas>
      <div class="rg-gegnerleiste" hidden><span class="rg-gegnername"></span><span class="rg-balken"><i></i></span></div>
      <div class="rg-meldung" aria-live="polite"></div>
      <div class="rg-geheim" aria-live="polite"></div>
      <div class="rg-zahlen"></div>
      <div class="rg-tafel" hidden></div>
      <canvas class="rg-karte" width="${BREITE}" height="${HOEHE}" hidden></canvas>
    </div>
    <div class="rg-hier" hidden></div>
    <div class="rg-gruppe"></div>
    <div class="rg-taschen"></div>
    <div class="rg-steuer">
      <button data-a="drehL" aria-label="Nach links drehen">↶</button>
      <button data-a="vor" aria-label="Vorwärts">▲</button>
      <button data-a="drehR" aria-label="Nach rechts drehen">↷</button>
      <button data-a="links" aria-label="Seitwärts nach links">◀</button>
      <button data-a="zurueck" aria-label="Rückwärts">▼</button>
      <button data-a="rechts" aria-label="Seitwärts nach rechts">▶</button>
    </div>
    <div class="rg-fuss">${opt.hinweisZusatz || ''}</div>
    <div class="rg-voll" hidden></div>`;

  const $ = (q) => wurzel.querySelector(q);
  const bild = $('.rg-bild'), g = bild.getContext('2d');
  const karteC = $('.rg-karte');
  const $meldung = $('.rg-meldung'), $tafel = $('.rg-tafel'), $zahlen = $('.rg-zahlen'), $voll = $('.rg-voll');

  // Texturen
  const atlas = steinAtlas(11);
  const tuer = tuerTextur();
  const gitter = gitterTextur(false);
  const cache = new Map();
  // Wandseite n: 0 Nord, 1 Ost, 2 Süd, 3 West (Richtung, in die die Seite schaut).
  // Stück des Wandbands nach der Lage in der Welt (Nord/Süd-Seiten laufen entlang x, Ost/West entlang y).
  const stueckNr = (x, y, n) => (((n % 2 === 0 ? x : y) % ATLAS_FELDER) + ATLAS_FELDER) % ATLAS_FELDER;
  // gespiegelt: für Bilder, die mit der Bildschirm-Richtung gelesen werden (Hebel, Tafel …), Seiten 0 und 1
  function basis(x, y, n, gespiegelt = false) {
    const i = stueckNr(x, y, n);
    return gemerkt(`a${i}${gespiegelt ? 'g' : ''}`, () => {
      const c = leinwand(TEX, TEX), t = c.getContext('2d');
      if (gespiegelt) { t.translate(TEX, 0); t.scale(-1, 1); }
      t.drawImage(atlas, i * TEX, 0, TEX, TEX, 0, 0, TEX, TEX);
      return c;
    });
  }
  const steinFuer = (x, y, n = 0) => basis(x, y, n);
  function steinMitDeko(x, y, n) {
    const c0 = R.zeichen(s, x, y);
    const art = c0 === 'X' ? 'riss' : dekoArt(x, y, n);
    if (art === 'stein') return basis(x, y, n);
    const i = stueckNr(x, y, n), v = dekoHash(x, y, n + 7) % 3;
    return gemerkt(`d${art}${i}${v}`, () => {
      const c = leinwand(TEX, TEX), t = c.getContext('2d');
      t.drawImage(basis(x, y, n), 0, 0);
      dekoMalen(t, art, zufall(i * 31 + v * 7 + art.length * 101), glutVon(c));
      return c;
    });
  }
  // Wird diese Wandseite in Welt-Richtung gelesen (Steine laufen weiter) oder in Bildschirm-Richtung (Bild mit Knöpfen)?
  const weltBild = (x, y) => '#X'.includes(R.zeichen(s, x, y));

  // Wandbild mit Hebel / Knopf / Tafel / Rune (je nach Zustand)
  function wandTextur(x, y, n = 0) {
    const c = R.zeichen(s, x, y);
    const sp = n === 0 || n === 1;
    const steinFuer = (xx, yy) => basis(xx, yy, n, sp);
    const key = `${x},${y}`;
    const gemerkt2 = (k, fn) => gemerkt(k + '|' + n, fn);
    if (c === 'D') return R.istOffen(s, x, y) ? null : tuer;
    if (c === 'G') return R.istOffen(s, x, y) ? null : gitter;
    if (c === 'Q') { if (R.istOffen(s, x, y)) return null; return gemerkt('q' + s.runen.length, () => gitterTextur(true, s.runen.length)); }
    if (c === 'X') return R.istOffen(s, x, y) ? null : steinMitDeko(x, y, n);
    if (c === 'H') {
      const unten = s.hebelUnten.includes(key);
      const art = (R.etageVon(s).hebelArt || {})[key] || 'schalter';
      return gemerkt2('h' + key + unten + art, () => (art === 'ring' ? ringTextur : schalterTextur)(steinFuer(x, y), unten));
    }
    if (c === 'B') return gemerkt2('b' + key, () => knopfTextur(steinFuer(x, y)));
    if (c === 'P') {
      const e = R.etageVon(s);
      if ((e.kohle || []).includes(key)) return gemerkt2('k' + key, () => kohleTextur(steinFuer(x, y), x * 7 + y));
      const runen = key === e.runenTafel ? (e.runenFolge || [e.herzrune]) : null;
      return gemerkt2('p' + key, () => tafelTextur(steinFuer(x, y), runen));
    }
    if (c === 'E') return gemerkt2('e' + key, () => quelleTextur(steinFuer(x, y)));
    if (c === 'Z' || c === 'Y') { const an = s.zieleAn.includes(key) || strahlTrifft(x, y); return gemerkt2('z' + key + an, () => zielTextur(steinFuer(x, y), an)); }
    if (c === 'M') return gemerkt2('m' + key, () => erinnerungTextur(steinFuer(x, y), x * 3 + y));
    if (c === 'K') { const an = s.sporenAn.includes(key); return gemerkt2('k' + key + an, () => sporeTextur(steinFuer(x, y), an)); }
    if (c === 'W') return R.istOffen(s, x, y) ? null : gemerkt('w' + key, () => wurzelwandTextur(x * 7 + y * 13));
    if (c === 'F') {
      const voll = s.fassungenVoll.includes(key);
      return gemerkt2('f' + key + voll, () => fassungTextur(steinFuer(x, y), voll));
    }
    if ('12345'.includes(c)) {
      const rune = R.etageVon(s).runen[c];
      const leuchtet = s.runen.includes(rune) || torOffen();
      return gemerkt2('r' + key + leuchtet, () => runenwandTextur(steinFuer(x, y), rune, leuchtet));
    }
    return steinMitDeko(x, y, n);
  }
  function gemerkt(k, fn) { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); }
  // Runentor der Etage offen?
  function torOffen() {
    const k = R.etageVon(s).karte;
    for (let y = 0; y < k.length; y++) { const x = k[y].indexOf('Q'); if (x >= 0) return R.istOffen(s, x, y); }
    return false;
  }

  // Kristallfassung: Bronzering mit Leitungen; leer = dunkler Schacht, voll = leuchtender Leitkristall
  function fassungTextur(basis, voll) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    const mx = 128, my = 112, gl = glutVon(c);
    // Leitungen aus der Fassung nach unten in den Boden
    for (const dx of [-30, 30]) {
      t.fillStyle = 'rgba(0,0,0,0.45)'; t.fillRect(mx + dx - 6, my + 30, 12, TEX - my - 30);
      metall(t, [[mx + dx - 4, my + 28], [mx + dx + 4, my + 28], [mx + dx + 4, TEX], [mx + dx - 4, TEX]], '#6a6450', '#1c1a14');
      if (voll) { gl.save(); gl.fillStyle = 'rgba(110,230,255,0.85)'; gl.shadowColor = '#6ee6ff'; gl.shadowBlur = 10; gl.fillRect(mx + dx - 1.5, my + 34, 3, TEX - my - 34); gl.restore(); }
    }
    // Platte
    t.fillStyle = 'rgba(0,0,0,0.5)'; t.beginPath(); t.arc(mx, my + 3, 62, 0, 7); t.fill();
    const pl = t.createRadialGradient(mx - 20, my - 24, 8, mx, my, 62);
    pl.addColorStop(0, '#8d856a'); pl.addColorStop(0.7, '#4c4838'); pl.addColorStop(1, '#25231b');
    t.fillStyle = pl; t.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; t.lineTo(mx + Math.cos(a) * 58, my + Math.sin(a) * 58); }
    t.closePath(); t.fill();
    t.strokeStyle = 'rgba(255,240,200,0.18)'; t.lineWidth = 2; t.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; niete(t, mx + Math.cos(a) * 48, my + Math.sin(a) * 48, 3); }
    // Ring mit Kerben
    t.strokeStyle = '#2a271e'; t.lineWidth = 9; t.beginPath(); t.arc(mx, my, 32, 0, 7); t.stroke();
    t.strokeStyle = '#a5946a'; t.lineWidth = 3; t.beginPath(); t.arc(mx, my, 36, 0, 7); t.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      t.strokeStyle = '#1a1813'; t.lineWidth = 2; t.beginPath(); t.moveTo(mx + Math.cos(a) * 37, my + Math.sin(a) * 37); t.lineTo(mx + Math.cos(a) * 44, my + Math.sin(a) * 44); t.stroke();
      if (voll) { gl.save(); gl.strokeStyle = '#7ee8ff'; gl.globalAlpha = 0.6; gl.lineWidth = 2; gl.beginPath(); gl.moveTo(mx + Math.cos(a) * 37, my + Math.sin(a) * 37); gl.lineTo(mx + Math.cos(a) * 44, my + Math.sin(a) * 44); gl.stroke(); gl.restore(); }
    }
    // Schacht
    const sch = t.createRadialGradient(mx, my, 2, mx, my, 28);
    sch.addColorStop(0, voll ? '#0c2a33' : '#020303'); sch.addColorStop(1, '#14130e');
    t.fillStyle = sch; t.beginPath(); t.arc(mx, my, 28, 0, 7); t.fill();
    // Krallen, die den Kristall halten
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      metall(t, [[mx + Math.cos(a) * 30, my + Math.sin(a) * 30], [mx + Math.cos(a + 0.18) * 20, my + Math.sin(a + 0.18) * 20], [mx + Math.cos(a) * 15, my + Math.sin(a) * 15], [mx + Math.cos(a - 0.18) * 20, my + Math.sin(a - 0.18) * 20]], '#b2a274', '#2b281e');
    }
    if (voll) {
      const kr = [[mx, my - 24], [mx + 11, my - 4], [mx + 7, my + 20], [mx - 7, my + 20], [mx - 11, my - 4]];
      zweimal(t, gl, (q) => {
        const gk = q.createLinearGradient(mx - 10, my - 24, mx + 10, my + 20);
        gk.addColorStop(0, '#e9fdff'); gk.addColorStop(0.4, '#6fdcff'); gk.addColorStop(1, '#1c6e9c');
        q.fillStyle = gk; q.beginPath(); kr.forEach(([a, b]) => q.lineTo(a, b)); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(255,255,255,0.7)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(mx, my - 24); q.lineTo(mx, my + 20); q.moveTo(mx - 11, my - 4); q.lineTo(mx, my + 2); q.lineTo(mx + 11, my - 4); q.stroke();
      });
      gl.save(); gl.globalCompositeOperation = 'lighter';
      const hl = gl.createRadialGradient(mx, my, 4, mx, my, 70); hl.addColorStop(0, 'rgba(120,230,255,0.55)'); hl.addColorStop(1, 'rgba(0,0,0,0)');
      gl.fillStyle = hl; gl.fillRect(mx - 70, my - 70, 140, 140); gl.restore();
    } else {
      // leer: nur ein schwacher Rest von Licht am Rand
      gl.save(); gl.strokeStyle = 'rgba(110,220,255,0.25)'; gl.lineWidth = 2; gl.beginPath(); gl.arc(mx, my, 27, 0.4, 1.4); gl.stroke(); gl.restore();
    }
    return c;
  }
  // Lichtquelle: eine Linse aus Kristall in einem Bronzerahmen, hell
  function quelleTextur(basis) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d'), gl = glutVon(c);
    t.drawImage(basis, 0, 0);
    const mx = 128, my = 118;
    t.fillStyle = 'rgba(0,0,0,0.5)'; t.beginPath(); t.arc(mx, my + 4, 66, 0, 7); t.fill();
    metall(t, Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [mx + Math.cos(a) * 62, my + Math.sin(a) * 62]; }), '#9a8a5e', '#2a261a');
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; niete(t, mx + Math.cos(a) * 52, my + Math.sin(a) * 52, 3); }
    zweimal(t, gl, (q) => {
      const gr = q.createRadialGradient(mx - 10, my - 12, 4, mx, my, 40);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#c9f6ff'); gr.addColorStop(1, '#3aa0c8');
      q.fillStyle = gr; q.beginPath(); q.arc(mx, my, 38, 0, 7); q.fill();
    });
    gl.save(); gl.globalCompositeOperation = 'lighter';
    const h = gl.createRadialGradient(mx, my, 10, mx, my, 110); h.addColorStop(0, 'rgba(190,240,255,0.8)'); h.addColorStop(1, 'rgba(0,0,0,0)');
    gl.fillStyle = h; gl.fillRect(0, 0, TEX, TEX); gl.restore();
    return c;
  }
  // Zielkristall: dunkel, bis das Licht ihn trifft
  function zielTextur(basis, an) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d'), gl = glutVon(c);
    t.drawImage(basis, 0, 0);
    const mx = 128, my = 112;
    t.fillStyle = 'rgba(0,0,0,0.5)'; t.beginPath(); t.ellipse(mx, my + 6, 46, 70, 0, 0, 7); t.fill();
    metall(t, [[mx, my - 74], [mx + 40, my - 30], [mx + 40, my + 40], [mx, my + 76], [mx - 40, my + 40], [mx - 40, my - 30]], '#7c7356', '#1e1b13');
    const kr = [[mx, my - 54], [mx + 22, my - 18], [mx + 16, my + 40], [mx, my + 54], [mx - 16, my + 40], [mx - 22, my - 18]];
    const male = (q, a) => {
      const gr = q.createLinearGradient(mx - 20, my - 50, mx + 20, my + 50);
      gr.addColorStop(0, an ? '#ffffff' : '#5a7a86'); gr.addColorStop(0.5, an ? '#9feaff' : '#24404a'); gr.addColorStop(1, an ? '#2c8ab0' : '#0f1d22');
      q.save(); q.globalAlpha = a; q.fillStyle = gr; q.beginPath(); kr.forEach(([x, y]) => q.lineTo(x, y)); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,255,255,0.45)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(mx, my - 54); q.lineTo(mx, my + 54); q.moveTo(mx - 22, my - 18); q.lineTo(mx, my - 4); q.lineTo(mx + 22, my - 18); q.stroke(); q.restore();
    };
    male(t, 1);
    if (an) { male(gl, 1); gl.save(); gl.globalCompositeOperation = 'lighter'; const h = gl.createRadialGradient(mx, my, 8, mx, my, 100); h.addColorStop(0, 'rgba(150,230,255,0.7)'); h.addColorStop(1, 'rgba(0,0,0,0)'); gl.fillStyle = h; gl.fillRect(0, 0, TEX, TEX); gl.restore(); }
    else { gl.save(); gl.globalAlpha = 0.25; male(gl, 0.4); gl.restore(); }
    return c;
  }
  // Erinnerungsspiegel: hoher ovaler Spiegel, silbrig, mit leisem Schimmer
  function erinnerungTextur(basis, seed) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d'), gl = glutVon(c);
    t.drawImage(basis, 0, 0);
    const mx = 128, my = 120;
    t.fillStyle = 'rgba(0,0,0,0.55)'; t.beginPath(); t.ellipse(mx, my + 4, 64, 100, 0, 0, 7); t.fill();
    t.strokeStyle = '#a9935a'; t.lineWidth = 9; t.beginPath(); t.ellipse(mx, my, 58, 94, 0, 0, 7); t.stroke();
    t.strokeStyle = '#4a3f24'; t.lineWidth = 2; t.beginPath(); t.ellipse(mx, my, 63, 99, 0, 0, 7); t.stroke();
    const gr = t.createLinearGradient(mx - 50, my - 80, mx + 50, my + 80);
    gr.addColorStop(0, '#c8d6dc'); gr.addColorStop(0.35, '#6d8590'); gr.addColorStop(0.7, '#2a3a42'); gr.addColorStop(1, '#5c707a');
    t.fillStyle = gr; t.beginPath(); t.ellipse(mx, my, 53, 89, 0, 0, 7); t.fill();
    // Spiegelung: ein Hauch von Gestalten
    t.save(); t.beginPath(); t.ellipse(mx, my, 53, 89, 0, 0, 7); t.clip();
    t.fillStyle = 'rgba(20,30,36,0.35)';
    for (let i = 0; i < 3; i++) { const x = mx - 26 + i * 26; t.beginPath(); t.arc(x, my + 6, 8, 0, 7); t.fill(); t.fillRect(x - 9, my + 14, 18, 40); }
    t.strokeStyle = 'rgba(255,255,255,0.35)'; t.lineWidth = 6; t.beginPath(); t.moveTo(mx - 40, my - 30); t.lineTo(mx - 10, my - 80); t.stroke();
    t.restore();
    gl.save(); gl.globalAlpha = 0.35; gl.strokeStyle = '#bfe8ff'; gl.lineWidth = 3; gl.shadowColor = '#9fdcff'; gl.shadowBlur = 14; gl.beginPath(); gl.ellipse(mx, my, 56, 92, 0, 0, 7); gl.stroke(); gl.restore();
    return c;
  }
  // Wurzeln aus Stein und Kristall versperren den Gang
  function wurzelwandTextur(seed) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d'), gl = glutVon(c), rnd = zufall(seed + 3);
    t.fillStyle = '#0c0a08'; t.fillRect(0, 0, TEX, TEX);
    const wurzel2 = (x0, y0, x1, y1, d) => {
      const gr = t.createLinearGradient(x0 - d, 0, x0 + d, 0); gr.addColorStop(0, '#2e231a'); gr.addColorStop(0.5, '#6e5a44'); gr.addColorStop(1, '#2a2018');
      t.strokeStyle = gr; t.lineWidth = d; t.lineCap = 'round';
      t.beginPath(); t.moveTo(x0, y0); t.bezierCurveTo(x0 + (rnd() - 0.5) * 120, y0 + (y1 - y0) * 0.3, x1 + (rnd() - 0.5) * 120, y0 + (y1 - y0) * 0.7, x1, y1); t.stroke();
    };
    for (let i = 0; i < 14; i++) wurzel2(rnd() * TEX, -10, rnd() * TEX, TEX + 10, 8 + rnd() * 22);
    for (let i = 0; i < 8; i++) wurzel2(-10, rnd() * TEX, TEX + 10, rnd() * TEX, 5 + rnd() * 10);
    // Kristalladern
    for (let i = 0; i < 6; i++) {
      const x = 20 + rnd() * 216, y = 20 + rnd() * 216, l = 10 + rnd() * 18;
      zweimal(t, gl, (q) => { q.fillStyle = '#7fe8c0'; q.beginPath(); q.moveTo(x, y - l); q.lineTo(x + l * 0.35, y); q.lineTo(x, y + l * 0.5); q.lineTo(x - l * 0.35, y); q.fill(); }, 0.35);
    }
    return c;
  }
  // Sporenkristall: trübe Kristallknolle in der Wand, leuchtet nach Funke oder Licht
  function sporeTextur(basis, an) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d'), gl = glutVon(c), rnd = zufall(77);
    t.drawImage(basis, 0, 0);
    // Wurzeln umschlingen den Kristall
    t.strokeStyle = '#4a3a28'; t.lineCap = 'round';
    for (let i = 0; i < 6; i++) { t.lineWidth = 6 + rnd() * 8; t.beginPath(); t.moveTo(rnd() * TEX, 0); t.quadraticCurveTo(128 + (rnd() - 0.5) * 120, 120, rnd() * TEX, TEX); t.stroke(); }
    const kr = [[128, 52], [168, 96], [160, 170], [128, 196], [96, 170], [88, 96]];
    const male = (q, hell) => {
      const gr = q.createLinearGradient(90, 60, 170, 190);
      gr.addColorStop(0, hell ? '#f0fff6' : '#8a9c88'); gr.addColorStop(0.5, hell ? '#9dffc8' : '#4b5c4a'); gr.addColorStop(1, hell ? '#2bb37a' : '#1d261c');
      q.fillStyle = gr; q.beginPath(); kr.forEach(([x, y]) => q.lineTo(x, y)); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,255,255,0.4)'; q.lineWidth = 2; q.beginPath(); q.moveTo(128, 52); q.lineTo(128, 196); q.moveTo(88, 96); q.lineTo(128, 120); q.lineTo(168, 96); q.stroke();
    };
    male(t, an);
    // Sporen: kleine Punkte
    for (let i = 0; i < 30; i++) { t.fillStyle = an ? 'rgba(220,255,230,0.6)' : 'rgba(150,170,130,0.5)'; t.beginPath(); t.arc(80 + rnd() * 96, 50 + rnd() * 150, 1.5 + rnd() * 2, 0, 7); t.fill(); }
    if (an) { male(gl, true); gl.save(); gl.globalCompositeOperation = 'lighter'; const h = gl.createRadialGradient(128, 124, 10, 128, 124, 120); h.addColorStop(0, 'rgba(140,255,190,0.7)'); h.addColorStop(1, 'rgba(0,0,0,0)'); gl.fillStyle = h; gl.fillRect(0, 0, TEX, TEX); gl.restore(); }
    else { gl.save(); gl.globalAlpha = 0.18; male(gl, false); gl.restore(); }
    return c;
  }
  // Miras Karte: mit Kohle an die Wand gezeichnet
  function kohleTextur(basis, seed) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    const rnd = zufall(seed * 13 + 5);
    const strich = (pts, w = 3) => {
      t.strokeStyle = `rgba(14,12,10,${0.7 + rnd() * 0.2})`; t.lineWidth = w; t.lineCap = 'round'; t.lineJoin = 'round';
      t.beginPath(); pts.forEach(([x, y], i) => (i ? t.lineTo : t.moveTo).call(t, x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2)); t.stroke();
    };
    // heller Kalkgrund, verwischt
    t.fillStyle = 'rgba(200,195,175,0.13)'; t.fillRect(44, 50, 168, 128);
    // Gänge als Kästchen und Linien
    strich([[60, 70], [120, 70], [120, 110], [60, 110], [60, 70]]);
    strich([[120, 90], [170, 90], [170, 150]]);
    strich([[170, 150], [130, 150], [130, 170]]);
    strich([[90, 110], [90, 160], [60, 160]]);
    // Zelt und Kreuz
    strich([[78, 100], [88, 82], [98, 100]], 2.5);
    strich([[158, 140], [168, 150]], 3); strich([[168, 140], [158, 150]], 3);
    // Wellen für Wasser
    strich([[64, 128], [70, 124], [76, 128], [82, 124]], 2);
    // blaue Bahn: ein Strich mit blauem Kristallstaub
    t.strokeStyle = 'rgba(80,170,220,0.55)'; t.lineWidth = 3; t.setLineDash([6, 5]);
    t.beginPath(); t.moveTo(120, 102); t.lineTo(196, 102); t.stroke(); t.setLineDash([]);
    // Kürzel
    strich([[186, 160], [186, 176], [192, 168], [198, 176], [198, 160]], 2.5);
    return c;
  }

  // Schalter an der Wand: Bronzeplatte mit Kristallschieber (oben = aus, unten = an)
  function schalterTextur(basis, unten) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    const x = 92, y = 58, w = 72, h = 136;
    // Schatten und Platte
    t.fillStyle = 'rgba(0,0,0,0.55)'; t.fillRect(x + 4, y + 5, w, h);
    const pl = t.createLinearGradient(x, y, x + w, y + h);
    pl.addColorStop(0, '#d8b066'); pl.addColorStop(0.45, '#8a6630'); pl.addColorStop(1, '#4a3418');
    t.fillStyle = pl;
    t.beginPath(); t.moveTo(x + 14, y); t.lineTo(x + w - 14, y); t.lineTo(x + w, y + 14); t.lineTo(x + w, y + h - 14); t.lineTo(x + w - 14, y + h); t.lineTo(x + 14, y + h); t.lineTo(x, y + h - 14); t.lineTo(x, y + 14); t.closePath(); t.fill();
    t.strokeStyle = 'rgba(255,240,200,0.35)'; t.lineWidth = 2; t.stroke();
    // eingravierter Rand
    t.strokeStyle = 'rgba(40,25,8,0.6)'; t.lineWidth = 2; t.strokeRect(x + 8, y + 8, w - 16, h - 16);
    for (const [nx, ny] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) {
      t.fillStyle = '#3a2810'; t.beginPath(); t.arc(nx, ny, 3.5, 0, 7); t.fill();
      t.fillStyle = 'rgba(255,240,200,0.5)'; t.beginPath(); t.arc(nx - 1, ny - 1, 1.3, 0, 7); t.fill();
    }
    // Rune oben
    t.save(); if (unten) { t.shadowColor = '#5FE8B4'; t.shadowBlur = 14; }
    runeZeichnen(t, 'stern', x + w / 2, y + 26, 11, unten ? '#8dffd6' : '#3a2810', 3);
    t.restore();
    // Schlitz
    const sx = x + w / 2 - 9, sy = y + 46, sh = 76;
    t.fillStyle = '#07090a'; t.fillRect(sx, sy, 18, sh);
    if (unten) { const gl = t.createLinearGradient(0, sy, 0, sy + sh); gl.addColorStop(0, 'rgba(95,232,180,0.05)'); gl.addColorStop(1, 'rgba(95,232,180,0.6)'); t.fillStyle = gl; t.fillRect(sx + 3, sy, 12, sh); }
    t.fillStyle = 'rgba(0,0,0,0.6)'; t.fillRect(sx, sy, 18, 4);
    // Kristallschieber
    const ky = unten ? sy + sh - 26 : sy + 4;
    t.save(); t.shadowColor = unten ? '#5FE8B4' : 'rgba(0,0,0,0)'; t.shadowBlur = unten ? 20 : 0;
    const kg = t.createLinearGradient(sx - 6, ky, sx + 24, ky + 22);
    kg.addColorStop(0, unten ? '#eafff7' : '#9ab8ac'); kg.addColorStop(0.5, unten ? '#5FE8B4' : '#3d6a5a'); kg.addColorStop(1, unten ? '#1d7a5c' : '#1a2e27');
    t.fillStyle = kg;
    t.beginPath(); t.moveTo(sx + 9, ky - 4); t.lineTo(sx + 24, ky + 6); t.lineTo(sx + 24, ky + 16); t.lineTo(sx + 9, ky + 26); t.lineTo(sx - 6, ky + 16); t.lineTo(sx - 6, ky + 6); t.closePath(); t.fill();
    t.restore();
    t.fillStyle = 'rgba(255,255,255,0.4)'; t.beginPath(); t.moveTo(sx + 9, ky - 2); t.lineTo(sx - 4, ky + 7); t.lineTo(sx + 6, ky + 8); t.closePath(); t.fill();
    { const gl = glutVon(c); gl.save(); gl.globalAlpha = unten ? 0.9 : 0.25; gl.shadowColor = '#5FE8B4'; gl.shadowBlur = 16; gl.fillStyle = '#5FE8B4';
      gl.beginPath(); gl.moveTo(sx + 9, ky - 4); gl.lineTo(sx + 24, ky + 6); gl.lineTo(sx + 24, ky + 16); gl.lineTo(sx + 9, ky + 26); gl.lineTo(sx - 6, ky + 16); gl.lineTo(sx - 6, ky + 6); gl.closePath(); gl.fill();
      if (unten) { runeZeichnen(gl, 'stern', x + w / 2, y + 26, 11, '#8dffd6', 3); gl.fillStyle = 'rgba(95,232,180,0.5)'; gl.fillRect(sx + 3, sy, 12, sh); }
      gl.restore(); }
    // kleine Pfeilkerben neben dem Schlitz
    t.fillStyle = 'rgba(40,25,8,0.7)';
    for (const yy of [sy + 10, sy + sh - 10]) { t.beginPath(); t.moveTo(sx - 12, yy - 4); t.lineTo(sx - 6, yy); t.lineTo(sx - 12, yy + 4); t.fill(); }
    return c;
  }
  // Ring an einer Kette: oben eine runde Bronzeplatte, gezogen hängt der Ring tiefer
  function ringTextur(basis, unten) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    const mx = 128, py = 62;
    t.fillStyle = 'rgba(0,0,0,0.5)'; t.beginPath(); t.arc(mx + 3, py + 4, 30, 0, 7); t.fill();
    const pl = t.createRadialGradient(mx - 10, py - 10, 4, mx, py, 30);
    pl.addColorStop(0, '#e2bd73'); pl.addColorStop(1, '#5a3e1a');
    t.fillStyle = pl; t.beginPath(); t.arc(mx, py, 28, 0, 7); t.fill();
    t.strokeStyle = 'rgba(40,25,8,0.7)'; t.lineWidth = 2; t.beginPath(); t.arc(mx, py, 21, 0, 7); t.stroke();
    t.save(); if (unten) { t.shadowColor = '#5FE8B4'; t.shadowBlur = 14; }
    runeZeichnen(t, 'auge', mx, py, 11, unten ? '#8dffd6' : '#3a2810', 3);
    t.restore();
    // Kette
    const glieder = unten ? 7 : 4;
    let y = py + 26;
    for (let i = 0; i < glieder; i++) {
      t.strokeStyle = '#2a2f31'; t.lineWidth = 4;
      t.beginPath(); if (i % 2) t.ellipse(mx, y + 6, 3, 7, 0, 0, 7); else t.ellipse(mx, y + 6, 6, 8, 0, 0, 7); t.stroke();
      t.strokeStyle = 'rgba(200,210,205,0.35)'; t.lineWidth = 1.5;
      t.beginPath(); if (i % 2) t.ellipse(mx - 1, y + 5, 3, 7, 0, 3.5, 5.5); else t.ellipse(mx - 1, y + 5, 6, 8, 0, 3.4, 5.4); t.stroke();
      y += 11;
    }
    // Ring
    const ry = y + 22;
    t.fillStyle = 'rgba(0,0,0,0.45)'; t.beginPath(); t.arc(mx + 4, ry + 5, 26, 0, Math.PI * 2); t.moveTo(mx + 19, ry + 5); t.arc(mx + 4, ry + 5, 15, 0, Math.PI * 2, true); t.fill();
    const rg = t.createLinearGradient(mx - 26, ry - 26, mx + 26, ry + 26);
    rg.addColorStop(0, '#f0cf86'); rg.addColorStop(0.5, '#a07a3a'); rg.addColorStop(1, '#4a3418');
    t.fillStyle = rg; t.beginPath(); t.arc(mx, ry, 26, 0, Math.PI * 2); t.moveTo(mx + 15, ry); t.arc(mx, ry, 15, 0, Math.PI * 2, true); t.fill();
    t.strokeStyle = 'rgba(255,245,210,0.45)'; t.lineWidth = 2; t.beginPath(); t.arc(mx, ry, 22, 3.6, 5.2); t.stroke();
    // Jade-Einlage im Ring
    t.save(); t.shadowColor = '#5FE8B4'; t.shadowBlur = unten ? 14 : 4;
    t.fillStyle = unten ? '#8dffd6' : '#2f5a4a'; t.beginPath(); t.arc(mx, ry + 20, 4, 0, 7); t.fill();
    t.restore();
    { const gl = glutVon(c); gl.save(); gl.globalAlpha = unten ? 0.9 : 0.2; gl.shadowColor = '#5FE8B4'; gl.shadowBlur = 12; runeZeichnen(gl, 'auge', mx, py, 11, '#8dffd6', 3); gl.fillStyle = '#8dffd6'; gl.beginPath(); gl.arc(mx, ry + 20, 4, 0, 7); gl.fill(); gl.restore(); }
    return c;
  }
  // Der versteckte Knopf: ein kleiner Stein, kaum heller als die anderen
  function knopfTextur(basis) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    const x = 52, y = 170;
    t.fillStyle = 'rgba(0,0,0,0.35)'; t.fillRect(x - 1, y - 1, 24, 20);
    t.fillStyle = '#56615c'; t.fillRect(x, y, 22, 18);
    t.fillStyle = 'rgba(255,255,240,0.10)'; t.fillRect(x, y, 22, 3);
    t.fillStyle = 'rgba(95,232,180,0.35)'; t.beginPath(); t.arc(x + 11, y + 10, 2, 0, 7); t.fill();
    return c;
  }
  function tafelTextur(basis, runen) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    t.fillStyle = 'rgba(0,0,0,0.4)'; t.fillRect(66, 64, 128, 92);
    const gr = t.createLinearGradient(62, 60, 190, 152); gr.addColorStop(0, '#8b8f80'); gr.addColorStop(1, '#5d6257');
    t.fillStyle = gr; t.fillRect(62, 60, 128, 92);
    t.strokeStyle = '#a99b6a'; t.lineWidth = 3; t.strokeRect(66, 64, 120, 84);
    if (runen) {
      runen.forEach((r, i) => runeZeichnen(t, r, 92 + i * 36, 106, 13, '#2c3a33', 4));
    } else {
      t.fillStyle = 'rgba(30,40,35,0.6)';
      for (let i = 0; i < 4; i++) t.fillRect(80, 80 + i * 16, 60 + ((i * 23) % 30), 4);
    }
    return c;
  }
  function runenwandTextur(basis, rune, leuchtet) {
    const c = leinwand(TEX, TEX), t = c.getContext('2d');
    t.drawImage(basis, 0, 0);
    t.fillStyle = 'rgba(0,0,0,0.3)'; t.beginPath(); t.arc(128, 118, 52, 0, 7); t.fill();
    t.fillStyle = '#4b5550'; t.beginPath(); t.arc(128, 116, 48, 0, 7); t.fill();
    t.strokeStyle = '#8c8160'; t.lineWidth = 3; t.stroke();
    runeZeichnen(t, rune, 128, 116, 28, '#1f2925', 7);
    const gl = glutVon(c);
    gl.save(); gl.globalAlpha = leuchtet ? 1 : 0.28; gl.shadowColor = '#5FE8B4'; gl.shadowBlur = 18;
    runeZeichnen(gl, rune, 128, 116, 28, '#7dffcb', 7); gl.restore();
    return c;
  }

  // ---------- Kamera und Bewegung ----------
  // Die Kamera gleitet zwischen den Feldern. Die Regeln kennen nur ganze Felder und vier Richtungen.
  const winkelVon = (r) => r * Math.PI / 2 - Math.PI / 2;
  let kam = { x: s.x + 0.5, y: s.y + 0.5, a: winkelVon(s.r) };
  let anim = null;          // { von, nach, start, dauer, art, dreh }
  let wartend = null;       // gedrückt, während eine Bewegung lief
  let gegnerVorher = new Map(); // Gegner-Positionen vor dem letzten Schritt (zum Mitgleiten)
  let erscheinung = null;  // kurze Begegnung (Hohler Ritter)
  let blitz = 0, dunkelBlitz = 0, zeit = 0, puls = 1;
  const STILE = {
    gleiten:   { name: 'Gleiten', dauer: 260, drehDauer: 260 },
    gehen:     { name: 'Gehen', dauer: 380, drehDauer: 320, wippen: true },
    klassisch: { name: 'Klassisch', dauer: 0, drehDauer: 0, dunkel: true },
    schwung:   { name: 'Schwung', dauer: 320, drehDauer: 300, schwung: true }
  };
  let stil = 'gehen';

  const sanft = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const schwungKurve = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function kameraStarten(art) {
    const nach = { x: s.x + 0.5, y: s.y + 0.5, a: winkelVon(s.r) };
    let da = nach.a - kam.a;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    nach.a = kam.a + da;
    const st = STILE[stil];
    const dreh = art === 'drehL' || art === 'drehR';
    const dauer = ruhig() ? 0 : (dreh ? st.drehDauer : st.dauer);
    if (!dauer) {
      kam = nach; anim = null;
      if (st.dunkel && !ruhig()) dunkelBlitz = 0.55;
      return;
    }
    anim = { von: { ...kam }, nach, start: performance.now(), dauer, art, dreh };
  }
  function kameraJetzt(t) {
    let bob = 0, roll = 0, fov = 1;
    const st = STILE[stil];
    if (anim) {
      let p = Math.min(1, (t - anim.start) / anim.dauer);
      const e = st.schwung ? schwungKurve(p) : sanft(p);
      kam = {
        x: anim.von.x + (anim.nach.x - anim.von.x) * e,
        y: anim.von.y + (anim.nach.y - anim.von.y) * e,
        a: anim.von.a + (anim.nach.a - anim.von.a) * e
      };
      if (st.wippen && !anim.dreh) bob = -Math.sin(p * Math.PI) * 9;
      if (st.wippen && anim.dreh) bob = -Math.sin(p * Math.PI) * 3;
      if (st.schwung) {
        if (anim.dreh) roll = Math.sin(p * Math.PI) * 0.045 * Math.sign(anim.nach.a - anim.von.a);
        else fov = 1 + Math.sin(p * Math.PI) * 0.05;
      }
      if (p >= 1) {
        kam = { ...anim.nach, a: winkelVon(s.r) };
        anim = null;
        if (wartend) { const w = wartend; wartend = null; setTimeout(() => bewegung(w), 0); }
      }
    }
    if (!ruhig()) bob += Math.sin(t / 900) * 1.2; // atmen
    return { bob, roll, fov };
  }
  const gegnerPos = (gg, t) => {
    const v = gegnerVorher.get(gg.id);
    if (!v || !anim || (v.x === gg.x && v.y === gg.y)) return { x: gg.x + 0.5, y: gg.y + 0.5 };
    const p = sanft(Math.min(1, (t - anim.start) / anim.dauer));
    return { x: v.x + 0.5 + (gg.x - v.x) * p, y: v.y + 0.5 + (gg.y - v.y) * p };
  };

  // ---------- Licht ----------
  // Laterne der Gruppe (warm), Wandfackeln (orange, flackernd), Runen (Jade), Treppe (gold).
  // Werte je Etage (neu berechnet beim Wechsel der Etage)
  let etage, FACKELN, DEKO_LICHT, BAHN;
  function etageVorbereiten() {
    etage = R.etageVon(s);
    DEKO_EXTRA = etage.pilze ? { anteil: 45, arten: ['pilze', 'wurzeln', 'wurzeln', 'pilze', 'moos'] } : null;
    cache.clear();
    FACKELN = (etage.fackeln || []).map(f => ({ ...f, phase: (f.x * 3.1 + f.y * 1.7) % 6 }));
    // Kerzen und Kristalle in Nischen, leuchtende Pilze: kleine Lichter vor der Wandseite
    DEKO_LICHT = [];
    etage.karte.forEach((zeile, y) => [...zeile].forEach((c, x) => {
      if (c !== '#') return;
      R.RICHTUNGEN.forEach(([dx, dy], n) => {
        if (R.blockiert(s, x + dx, y + dy) && !'DGQX'.includes(R.zeichen(s, x + dx, y + dy))) return;
        const art = dekoArt(x, y, n);
        const lx = x + 0.5 + dx * 0.58, ly = y + 0.5 + dy * 0.58;
        if (art === 'nische_kerze') DEKO_LICHT.push({ x: lx, y: ly, r: 1, g: 0.62, b: 0.3, i: 0.75, k: 2.6, phase: x + y });
        else if (art === 'nische_kristall') DEKO_LICHT.push({ x: lx, y: ly, r: 0.3, g: 1, b: 0.72, i: 0.55, k: 2.8 });
        else if (art === 'pilze') DEKO_LICHT.push({ x: lx, y: ly, r: 0.35, g: 1, b: 0.75, i: 0.3, k: 3.5 });
      });
    }));
    // Leitbahnen im Boden: je Feld die Richtungen der Linie (1 N, 2 O, 4 S, 8 W) und die Fassung
    BAHN = new Map();
    for (const [fk, f] of Object.entries(etage.fassungen || {})) {
      const kette = [fk, ...f.bahn, ...f.oeffnet].map(k => k.split(',').map(Number));
      kette.forEach(([x, y], i) => {
        const key = `${x},${y}`;
        if (!BAHN.has(key)) BAHN.set(key, { dirs: 0, fassung: fk, i });
        const b = BAHN.get(key);
        for (const j of [i - 1, i + 1]) {
          const o = kette[j]; if (!o) continue;
          const d = o[1] < y ? 1 : o[0] > x ? 2 : o[1] > y ? 4 : 8;
          b.dirs |= d;
        }
      });
    }
  }
  etageVorbereiten();
  function lichter(t) {
    const fl = ruhig() ? 1 : 1 + Math.sin(t / 130) * 0.06 + Math.sin(t / 53) * 0.04;
    const L = [{ x: kam.x, y: kam.y, r: 0.95, g: 0.84, b: 0.7, i: 0.5 * fl, k: 0.95 }];
    for (const f of FACKELN) {
      if (Math.abs(f.x - kam.x) + Math.abs(f.y - kam.y) > 12) continue;
      const ff = ruhig() ? 1 : 1 + Math.sin(t / 90 + f.phase) * 0.12 + Math.sin(t / 37 + f.phase * 2) * 0.08;
      L.push({ x: f.x, y: f.y, r: 1.0, g: 0.55, b: 0.22, i: 1.25 * ff, k: 1.6 });
    }
    for (const d of DEKO_LICHT) {
      if (Math.abs(d.x - kam.x) + Math.abs(d.y - kam.y) > 9) continue;
      const ff = d.phase === undefined || ruhig() ? 1 : 1 + Math.sin(t / 70 + d.phase) * 0.1;
      L.push({ ...d, i: d.i * ff });
    }
    const k = etage.karte;
    for (let y = 0; y < k.length; y++) for (let x = 0; x < k[0].length; x++) {
      const c = k[y][x];
      if (Math.abs(x + 0.5 - kam.x) + Math.abs(y + 0.5 - kam.y) > 10) continue;
      if ('12345'.includes(c)) {
        const an = s.runen.includes(etage.runen[c]) || torOffen();
        L.push({ x: x + 0.5, y: y - 0.15, r: 0.3, g: 1, b: 0.72, i: an ? 1.0 : 0.22, k: 2.2 });
      } else if (c === 'F') {
        // Licht vor der Fassung (zur offenen Seite hin)
        const voll = s.fassungenVoll.includes(`${x},${y}`);
        for (const [dx, dy] of R.RICHTUNGEN) if (!R.blockiert(s, x + dx, y + dy)) L.push({ x: x + 0.5 + dx * 0.6, y: y + 0.5 + dy * 0.6, r: 0.4, g: 0.85, b: 1, i: voll ? 0.9 : 0.06, k: 2.4 });
      } else if (c === 'T') L.push({ x: x + 0.5, y: y + 0.5, r: 1, g: 0.8, b: 0.42, i: 0.9, k: 1.4 });
      else if (c === 'K' && s.sporenAn.includes(`${x},${y}`)) {
        for (const [dx, dy] of R.RICHTUNGEN) if (!R.blockiert(s, x + dx, y + dy)) L.push({ x: x + 0.5 + dx * 0.6, y: y + 0.5 + dy * 0.6, r: 0.45, g: 1, b: 0.7, i: 0.8, k: 2.2 });
      }
      else if (c === 'E' || ((c === 'Z' || c === 'Y') && (s.zieleAn.includes(`${x},${y}`) || strahlTrifft(x, y)))) {
        for (const [dx, dy] of R.RICHTUNGEN) if (!R.blockiert(s, x + dx, y + dy)) L.push({ x: x + 0.5 + dx * 0.6, y: y + 0.5 + dy * 0.6, r: 0.6, g: 0.92, b: 1, i: 0.8, k: 2.2 });
      }
    }
    // Licht entlang des Strahls (die nächsten Stellen)
    let n = 0;
    for (const w of STRAHL) for (let i = 0; i < w.felder.length && n < 7; i += 2) {
      const [fx, fy] = w.felder[i];
      if (Math.abs(fx + 0.5 - kam.x) + Math.abs(fy + 0.5 - kam.y) > 7) continue;
      L.push({ x: fx + 0.5, y: fy + 0.5, r: 0.55, g: 0.9, b: 1, i: 0.32, k: 3 }); n++;
    }
    return L;
  }
  // Lichtstrahl (je Bild einmal berechnet)
  let STRAHL = [];
  const strahlTrifft = (x, y) => STRAHL.some(w => w.treffer && w.treffer.x === x && w.treffer.y === y);
  // Punkte der Strahl-Linie in der Welt
  function strahlPunkte(w) {
    const [qx, qy] = w.quelle.split(',').map(Number);
    const r0 = (etage.quellen || {})[w.quelle];
    const pts = [[qx + 0.5 + R.RICHTUNGEN[r0][0] * 0.5, qy + 0.5 + R.RICHTUNGEN[r0][1] * 0.5]];
    for (const [x, y, rein, raus] of w.felder) if (rein !== raus) pts.push([x + 0.5, y + 0.5]);
    if (w.treffer) {
      const letzte = w.felder.length ? w.felder[w.felder.length - 1][3] : r0;
      pts.push([w.treffer.x + 0.5 - R.RICHTUNGEN[letzte][0] * 0.5, w.treffer.y + 0.5 - R.RICHTUNGEN[letzte][1] * 0.5]);
    }
    return pts;
  }
  const leuchtPunkt = (() => {
    const c = leinwand(64, 64), t = c.getContext('2d');
    const gr = t.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(200,245,255,0.9)'); gr.addColorStop(0.5, 'rgba(90,190,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = gr; t.fillRect(0, 0, 64, 64); return c;
  })();
  const STRAHL_HOEHE = 0.4;   // über dem Boden (Wand: 0 bis 1)
  // Ketten der Herzkammer: von den Kettenhaltern zum Herz, bis ein Splitter sie löst
  function kettenMalen(Fc, bob) {
    if (!etage.runenErstNachKetten || !etage.deko) return;
    const herz = etage.deko.find(d => d.art === 'herz');
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    for (const fk of Object.keys(etage.fassungen)) {
      if (s.fassungenVoll.includes(fk)) continue;
      const [fx, fy] = fk.split(',').map(Number);
      // Punkt an der Wand (Seite zur Halle) und am Herz
      const nach = R.RICHTUNGEN.find(([dx, dy]) => !R.blockiert(s, fx + dx, fy + dy));
      const ax = fx + 0.5 + nach[0] * 0.5, ay = fy + 0.5 + nach[1] * 0.5, bx = herz.x + 0.5, by = herz.y + 0.5;
      const n = 60;
      for (let j = 0; j <= n; j++) {
        const f = j / n, wx = ax + (bx - ax) * f, wy = ay + (by - ay) * f;
        const h = 0.85 - f * 0.3 - Math.sin(f * Math.PI) * 0.12;   // durchhängend
        const dx = wx - kam.x, dy = wy - kam.y, z = dx * dirx + dy * diry;
        if (z < 0.4) continue;
        const sx = CX + (dx * rx + dy * ry) / z * Fc, col = Math.floor(sx / SP);
        if (col < 0 || col >= SPALTEN || zbuf[col] < z - 0.02) continue;
        const sy = CY + bob + (0.5 - h) * Fc / z, r = Math.max(1.5, 0.025 * Fc / z);
        g.fillStyle = j % 2 ? '#3a3a34' : '#5c5a4e';
        g.beginPath(); g.ellipse(sx, sy, r * (j % 2 ? 0.6 : 1.3), r, 0, 0, 7); g.fill();
      }
    }
  }
  function strahlMalen(Fc, bob, t) {
    if (!STRAHL.length) return;
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const w of STRAHL) {
      const pts = strahlPunkte(w);
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const l = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(l / 0.05));
        for (let j = 0; j <= n; j++) {
          const f = j / n, wx = ax + (bx - ax) * f, wy = ay + (by - ay) * f;
          const dx = wx - kam.x, dy = wy - kam.y;
          const z = dx * dirx + dy * diry;
          if (z < 0.45) continue;
          const sx = CX + (dx * rx + dy * ry) / z * Fc;
          const col = Math.floor(sx / SP);
          if (col < 0 || col >= SPALTEN || zbuf[col] < z - 0.02) continue;
          const sy = CY + bob + (0.5 - STRAHL_HOEHE) * Fc / z;
          const flimmer = ruhig() ? 1 : 0.85 + 0.15 * Math.sin(t / 60 + (i * 40 + j) * 0.7);
          const r = Math.min(16, Math.max(3, 0.09 * Fc / z)) * flimmer;
          g.globalAlpha = Math.min(1, 0.55 + 1 / z * 0.3);
          g.drawImage(leuchtPunkt, sx - r, sy - r, r * 2, r * 2);
        }
      }
    }
    g.restore();
  }
  const AMB = [0.008, 0.016, 0.028];
  function lichtBei(L, x, y, aus) {
    let r = AMB[0], g2 = AMB[1], b = AMB[2];
    for (let i = 0; i < L.length; i++) {
      const l = L[i], dx = x - l.x, dy = y - l.y;
      const w = l.i / (1 + (dx * dx + dy * dy) * l.k);
      r += l.r * w; g2 += l.g * w; b += l.b * w;
    }
    aus[0] = r; aus[1] = g2; aus[2] = b;
    return aus;
  }

  // ---------- Boden und Decke (halbe Auflösung, Pixel für Pixel) ----------
  const BW = BREITE / 2, BH = HOEHE / 2;
  const flaeche = leinwand(BW, BH), fg = flaeche.getContext('2d');
  const fbild = fg.createImageData(BW, BH), fpix = new Uint32Array(fbild.data.buffer);
  const BODEN = bodenMuster(), DECKE = deckenMuster();
  function bodenMuster() {
    const n = 64, a = new Float32Array(n * n * 3), rnd = zufall(5);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      // vier Platten je Feld, Fugen dunkel, Kanten hell
      const px2 = x % 32, py2 = y % 32;
      const fuge = px2 < 2 || py2 < 2;
      const kante = px2 === 2 || py2 === 2;
      const tiefe = px2 > 29 || py2 > 29;
      let v = 0.42 + rnd() * 0.08 + ((x >> 5) + (y >> 5)) % 2 * 0.04;
      if (fuge) v = 0.12; else if (kante) v += 0.12; else if (tiefe) v -= 0.08;
      const i = (y * n + x) * 3;
      a[i] = v * 0.95; a[i + 1] = v * 1.02; a[i + 2] = v * 0.94;
    }
    return a;
  }
  function deckenMuster() {
    const n = 64, a = new Float32Array(n * n * 3), rnd = zufall(9);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = 0.2 + rnd() * 0.07;
      if (x % 64 < 3 || y % 21 < 2) v = 0.08;
      const i = (y * n + x) * 3;
      a[i] = v; a[i + 1] = v * 1.05; a[i + 2] = v * 1.02;
    }
    return a;
  }
  const lb = [0, 0, 0];
  function bodenUndDecke(L, Fc, bob) {
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    const horizont = CY + bob;
    for (let py = 0; py < BH; py++) {
      const sy = py * 2 + 1;
      const p = sy - horizont;
      const boden = p > 0;
      if (Math.abs(p) < 1) { for (let px0 = 0; px0 < BW; px0++) fpix[py * BW + px0] = 0xff000000; continue; }
      const z = 0.5 * Fc / Math.abs(p);
      const muster = boden ? BODEN : DECKE;
      for (let px0 = 0; px0 < BW; px0++) {
        const sx = px0 * 2 + 1;
        const k = (sx - CX) / Fc;
        const wx = kam.x + (dirx + rx * k) * z, wy = kam.y + (diry + ry * k) * z;
        const fx = Math.floor(wx), fy = Math.floor(wy);
        let ti = ((((wy * 64) | 0) & 63) * 64 + (((wx * 64) | 0) & 63)) * 3;
        let mr = muster[ti], mg = muster[ti + 1], mb = muster[ti + 2];
        if (boden && R.zeichen(s, fx, fy) === 'T') {
          // Treppe: dunkle Stufen mit Goldschein
          const st2 = (wy - fy) * 4 | 0;
          const v = 0.08 + st2 * 0.06;
          mr = v * 1.2; mg = v; mb = v * 0.6;
        }
        lichtBei(L, wx, wy, lb);
        const nebel = Math.min(1, z / 9);
        let er = 0, eg2 = 0, eb = 0;
        const bahn = boden && BAHN.size ? BAHN.get(`${fx},${fy}`) : null;
        if (bahn) {
          const u = wx - fx - 0.5, v = wy - fy - 0.5;
          const d = bahn.dirs;
          let abst = 9;
          if ((d & 1 && v <= 0) || (d & 4 && v >= 0)) abst = Math.min(abst, Math.abs(u));
          if ((d & 2 && u >= 0) || (d & 8 && u <= 0)) abst = Math.min(abst, Math.abs(v));
          if (Math.hypot(u, v) < 0.06) abst = 0;
          if (abst < 0.11) {
            const voll = s.fassungenVoll.includes(bahn.fassung);
            if (abst < 0.035) { mr *= 0.35; mg *= 0.4; mb *= 0.5; }      // Rinne im Stein
            if (voll) {
              const welle = 0.65 + 0.35 * Math.sin(zeit / 220 - (bahn.i + (d & 6 ? u + v : -u - v)) * 1.6);
              const kk = (abst < 0.03 ? 190 : 120 * Math.pow(1 - (abst - 0.03) / 0.08, 2)) * welle * (1 - nebel * 0.6);
              er += kk * 0.35; eg2 += kk * 0.85; eb += kk * 1.15;
            } else if (abst < 0.03) { eb += 7 * (1 - nebel); eg2 += 4 * (1 - nebel); }
          }
        }
        const sp = boden && s.spiegel ? s.spiegel[`${fx},${fy}`] : undefined;
        if (sp !== undefined) {
          // Sockel des Spiegels: Ring, darin eine Linie in seiner Stellung
          const u = wx - fx - 0.5, v = wy - fy - 0.5, d = Math.sqrt(u * u + v * v);
          let kk = 0;
          if (Math.abs(d - 0.36) < 0.02) kk = 60;
          if (d < 0.34 && ((sp === 0 && Math.abs(u + v) < 0.035) || (sp === 1 && Math.abs(u - v) < 0.035))) kk = 140;
          if (sp === 2 && d < 0.08) kk = 120;
          if (kk) { kk *= (1 - nebel * 0.6) * puls; er += kk * 0.45; eg2 += kk * 0.85; eb += kk; }
        }
        if (boden && !bahn && sp === undefined && (((fx * 73856093) ^ (fy * 19349663)) & 7) === 3) {
          const u = wx - fx - 0.5, v = wy - fy - 0.5, d = Math.sqrt(u * u + v * v);
          if (Math.abs(d - 0.32) < 0.014 || Math.abs(d - 0.2) < 0.009 || (d < 0.32 && d > 0.2 && (Math.abs(u) < 0.01 || Math.abs(v) < 0.01))) { const k = 110 * puls * (1 - nebel * 0.7); er = k * 0.35; eg2 = k * 1.4; eb = k; }
        }
        const r = Math.min(255, mr * lb[0] * 210 * (1 - nebel * 0.6) + er);
        const g3 = Math.min(255, mg * lb[1] * 210 * (1 - nebel * 0.6) + eg2);
        const b = Math.min(255, mb * lb[2] * 210 * (1 - nebel * 0.5) + nebel * 6 + eb);
        fpix[py * BW + px0] = 0xff000000 | (b << 16) | (g3 << 8) | r;
      }
    }
    fg.putImageData(fbild, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(flaeche, 0, 0, BREITE, HOEHE);
  }

  // ---------- Wände (Strahl je Bildspalte) ----------
  const SP = 2;                        // Spaltenbreite in Pixeln
  const SPALTEN = BREITE / SP;
  const zbuf = new Float32Array(SPALTEN);
  const treffer = new Array(SPALTEN);
  const ao = (() => { const c = leinwand(1, 128), t = c.getContext('2d'); const gr = t.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgb(90,90,90)'); gr.addColorStop(0.12, 'rgb(235,235,235)'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(0.86, 'rgb(225,225,225)'); gr.addColorStop(1, 'rgb(60,60,60)');
    t.fillStyle = gr; t.fillRect(0, 0, 1, 128); return c; })();
  function waende(L, Fc, bob) {
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    for (let c = 0; c < SPALTEN; c++) {
      const sx = c * SP + SP / 2;
      const k = (sx - CX) / Fc;
      const rdx = dirx + rx * k, rdy = diry + ry * k;
      let mx = Math.floor(kam.x), my = Math.floor(kam.y);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let stx, sty, sdx, sdy;
      if (rdx < 0) { stx = -1; sdx = (kam.x - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - kam.x) * ddx; }
      if (rdy < 0) { sty = -1; sdy = (kam.y - my) * ddy; } else { sty = 1; sdy = (my + 1 - kam.y) * ddy; }
      let seite2 = 0, getroffen = false;
      for (let i = 0; i < 24; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; seite2 = 0; } else { sdy += ddy; my += sty; seite2 = 1; }
        if (R.blockiert(s, mx, my)) { getroffen = true; break; }
      }
      if (!getroffen) { zbuf[c] = 99; treffer[c] = null; continue; }
      const z = seite2 === 0 ? sdx - ddx : sdy - ddy;
      let u = seite2 === 0 ? kam.y + z * rdy : kam.x + z * rdx;
      u -= Math.floor(u);
      const uWelt = u;
      if (seite2 === 0 && rdx < 0) u = 1 - u;
      if (seite2 === 1 && rdy > 0) u = 1 - u;
      const zz = Math.max(z, 0.05);
      const h = Fc / zz, top = CY + bob - h / 2;
      zbuf[c] = zz;
      treffer[c] = { x: mx, y: my, u, z: zz, top, h };
      const seiteN = seite2 === 0 ? (stx > 0 ? 3 : 1) : (sty > 0 ? 0 : 2);
      const tex = wandTextur(mx, my, seiteN) || steinFuer(mx, my, seiteN);
      const uBild = weltBild(mx, my) ? uWelt : u;
      g.drawImage(tex, Math.min(TEX - 1, (uBild * TEX) | 0), 0, 1, TEX, c * SP, top, SP + 0.5, h);
      // Licht am Trefferpunkt, etwas vor der Wand
      const wx = kam.x + rdx * (z - 0.04), wy = kam.y + rdy * (z - 0.04);
      lichtBei(L, wx, wy, lb);
      const sf = seite2 === 0 ? 1 : 0.8;              // Ecken plastischer: eine Seite etwas dunkler
      const nebel = Math.min(1, zz / 9);
      const r = Math.min(1, lb[0] * sf * (1 - nebel * 0.6)), gg = Math.min(1, lb[1] * sf * (1 - nebel * 0.6)), b = Math.min(1, lb[2] * sf * (1 - nebel * 0.5));
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${(r * 255) | 0},${(gg * 255) | 0},${(b * 255) | 0})`;
      g.fillRect(c * SP, top, SP + 0.5, h);
      g.drawImage(ao, 0, 0, 1, 128, c * SP, top, SP + 0.5, h);
      if (tex.glut) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.max(0.15, 1 - zz / 10) * puls;
        g.drawImage(tex.glut, Math.min(TEX - 1, (uBild * TEX) | 0), 0, 1, TEX, c * SP, top, SP + 0.5, h);
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = 'source-over';
    }
  }

  // ---------- Figuren und Dinge (Bilder, Spalte für Spalte hinter Wänden versteckt) ----------
  const FW = 560, FH = 420, OX = 280, OY = 390;   // Figuren-Ebene, Fußpunkt bei OX/OY
  const fig = leinwand(FW, FH), fc = fig.getContext('2d');
  let trefferDinge = [];
  function figurZeichnen(wx, wy, malen, opt = {}) {
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    const dx = wx - kam.x, dy = wy - kam.y;
    const z = dx * dirx + dy * diry, xc = dx * rx + dy * ry;
    if (z < 0.3) return null;
    const sk = opt.Fc / z / 275;
    const sx = CX + xc / z * opt.Fc;
    const boden = CY + opt.bob + (0.5 - (opt.hoehe || 0)) * opt.Fc / z;
    fc.setTransform(1, 0, 0, 1, 0, 0);
    fc.clearRect(0, 0, FW, FH);
    fc.save(); fc.translate(OX, OY); const weiss = malen(fc) || 0; fc.restore();
    if (opt.licht) {
      fc.globalCompositeOperation = 'source-atop';
      const l = opt.licht;
      fc.fillStyle = `rgba(${(l[0] * 40) | 0},${(l[1] * 40) | 0},${(l[2] * 40) | 0},${Math.max(0, 1 - Math.min(1, Math.max(l[0], l[1], l[2]) * 1.1)) * (opt.dämpfen ?? 1)})`;
      fc.fillRect(0, 0, FW, FH);
      fc.globalCompositeOperation = 'source-over';
    }
    if (weiss > 0) {   // Treffer: die Figur blitzt weiß auf
      fc.globalCompositeOperation = 'source-atop'; fc.fillStyle = `rgba(255,250,235,${weiss})`; fc.fillRect(0, 0, FW, FH);
      fc.globalCompositeOperation = 'source-over';
    }
    const links = sx - OX * sk, oben = boden - OY * sk, breite = FW * sk, hoehe = FH * sk;
    const c0 = Math.max(0, Math.floor(links / SP)), c1 = Math.min(SPALTEN - 1, Math.floor((links + breite) / SP));
    if (opt.alpha !== undefined) g.globalAlpha = Math.max(0, Math.min(1, opt.alpha));
    for (let c = c0; c <= c1; c++) {
      if (zbuf[c] < z) continue;
      const qx = (c * SP - links) / sk;
      g.drawImage(fig, Math.max(0, qx), 0, SP / sk, FH, c * SP, oben, SP + 0.5, hoehe);
    }
    g.globalAlpha = 1;
    return { sx, boden, sk, z };
  }

  function figuren(L, Fc, bob, t) {
    const liste = [];
    const vorn = R.feldRelativ(s, 1, 0);
    for (const gg of s.gegner) if (gg.leben > 0 && !gg.lauert) { const p = gegnerPos(gg, t); liste.push({ art: 'gegner', gg, x: p.x, y: p.y }); }
    sterbende = sterbende.filter(d => (t - d.start) / 1000 < W.DAUER.besiegt);
    for (const d of sterbende) liste.push({ art: 'sterbend', d, x: d.x + 0.5, y: d.y + 0.5 });
    for (const d of s.dinge) {
      const i = s.dinge.filter(x => x.x === d.x && x.y === d.y).indexOf(d);
      liste.push({ art: 'ding', d, x: d.x + 0.5 + (i - 0.3) * 0.22, y: d.y + 0.5 + i * 0.1 });
    }
    for (const f of FACKELN) liste.push({ art: 'fackel', f, x: f.x, y: f.y });
    for (const d of etage.deko || []) {
      if (d.art === 'herz' && s.gegner.some(g => g.typ === 'herz' && g.leben > 0)) continue;
      liste.push({ art: 'deko', d, x: d.x + 0.5, y: d.y + 0.5 });
    }
    for (const [key, st] of Object.entries(s.spiegel || {})) { const [x, y] = key.split(',').map(Number); liste.push({ art: 'spiegel', st, x: x + 0.5, y: y + 0.5 }); }
    if (erscheinung) liste.push({ art: 'erscheinung', x: erscheinung.x + 0.5, y: erscheinung.y + 0.5 });
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a);
    liste.forEach(e => { e.z = (e.x - kam.x) * dirx + (e.y - kam.y) * diry; });
    liste.sort((a, b) => b.z - a.z);
    for (const e of liste) {
      if (e.z < 0.3 || e.z > 9) continue;
      if (e.art === 'fackel') {
        const r = figurZeichnen(e.x, e.y, (c) => fackelMalen(c, t, e.f.phase), { Fc, bob, hoehe: 0.45 });
        if (r) glut(r, e.f.phase, t);
        continue;
      }
      const licht = lichtBei(L, e.x, e.y, [0, 0, 0]);
      if (e.art === 'spiegel') { figurZeichnen(e.x, e.y, (c) => spiegelFigur(c, e, Fc), { Fc, bob, licht: licht.map(v => v + 0.15), dämpfen: 0.7 }); continue; }
      if (e.art === 'deko') { figurZeichnen(e.x, e.y, (c) => dekoFigur(c, e.d), { Fc, bob, licht: licht.map(v => v * 1.15), dämpfen: 0.95 }); continue; }
      if (e.art === 'erscheinung') {
        const p = (t - erscheinung.start) / 1000;
        const halt = erscheinung.lang ? 7 : 2.6;
        const a = p < 0.8 ? p / 0.8 : p < halt ? 1 : 1 - (p - halt) / 1.2;
        if (a <= 0) { erscheinung = null; continue; }
        const kn = erscheinung.knien;
        figurZeichnen(e.x, e.y, (c) => { if (kn) { c.scale(0.8, 0.56); c.rotate(0.08); } else c.scale(0.8, 0.8); W.ZEICHNER.hohlerritter(c, t / 1000, (Math.sin(t / 500) + 1) / 2); }, { Fc, bob, alpha: a });
        continue;
      }
      if (e.art === 'gegner') figurZeichnen(e.x, e.y, (c) => gegnerMalen(c, e.gg, t), { Fc, bob, licht, dämpfen: 0.55 });
      else if (e.art === 'sterbend') figurZeichnen(e.x, e.y, (c) => gegnerMalen(c, e.d, t, { art: 'besiegt', k: (t - e.d.start) / 1000 / W.DAUER.besiegt }), { Fc, bob, licht, dämpfen: 0.35 });
      else {
        const r = figurZeichnen(e.x, e.y, (c) => dingMalen(c, e.d), { Fc, bob, licht: licht.map(v => v + 0.25) });
        if (r && e.d.x === vorn.x && e.d.y === vorn.y && !anim) trefferDinge.push({ id: e.d.id, x: r.sx, y: r.boden - 25 * r.sk, r: 60 * r.sk });
      }
    }
  }
  function glut(r, phase, t) {
    const fl = ruhig() ? 1 : 1 + Math.sin(t / 90 + phase) * 0.15;
    const x = r.sx, y = r.boden - 78 * r.sk, rad = 120 * r.sk * fl;
    const c = Math.floor(x / SP);
    if (c >= 0 && c < SPALTEN && zbuf[c] < r.z - 0.05) return;
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,170,80,0.38)'); gr.addColorStop(0.4, 'rgba(255,110,40,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    g.globalCompositeOperation = 'source-over';
  }
  function fackelMalen(c, t, phase) {
    c.scale(0.6, 0.6);
    // Halter an der Wand
    c.fillStyle = '#2b2620'; c.fillRect(-10, -60, 20, 70);
    c.fillStyle = '#6e5d36'; c.fillRect(-16, -72, 32, 12);
    c.fillStyle = '#4a3524'; c.fillRect(-7, -110, 14, 44);
    // Flamme
    const w = ruhig() ? 0 : Math.sin(t / 70 + phase) * 4;
    const gr = c.createRadialGradient(0, -135, 2, 0, -128, 34);
    gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.35, '#ffc35a'); gr.addColorStop(0.75, 'rgba(240,110,30,0.85)'); gr.addColorStop(1, 'rgba(200,60,10,0)');
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(-16, -112); c.quadraticCurveTo(-20 + w, -150, w * 1.5, -178); c.quadraticCurveTo(20 + w, -150, 16, -112); c.closePath(); c.fill();
  }
  function dingMalen(c, ding) {
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(0, -4, 34, 9, 0, 0, 7); c.fill();
    if (dingMalenNeu(c, ding)) return;
    if (ding.typ === 'heiltrank' || ding.typ === 'manatrank') {
      const blau = ding.typ === 'manatrank';
      const gr = c.createRadialGradient(-6, -32, 2, 0, -26, 26); gr.addColorStop(0, blau ? '#cfe2ff' : '#b6ffe2'); gr.addColorStop(1, blau ? '#2c4fbf' : '#1c8a66');
      c.fillStyle = gr; c.beginPath(); c.arc(0, -26, 22, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-8, -34, 5, 0, 7); c.fill();
      c.fillStyle = '#c7b98a'; c.fillRect(-7, -60, 14, 16);
      c.fillStyle = '#6b4f2c'; c.fillRect(-9, -66, 18, 8);
    } else if (ding.typ === 'schluessel') {
      c.strokeStyle = '#7dffcb'; c.lineWidth = 7; c.beginPath(); c.arc(-22, -14, 13, 0, 7); c.stroke();
      c.fillStyle = '#7dffcb'; c.fillRect(-10, -18, 46, 8); c.fillRect(24, -18, 6, 18); c.fillRect(12, -18, 6, 13);
    } else if (ding.typ === 'jadeklinge' || ding.typ === 'kurzschwert') {
      c.rotate(-0.25);
      const gr = c.createLinearGradient(0, -90, 0, 0); gr.addColorStop(0, '#e8fff6'); gr.addColorStop(1, '#3fbf8f');
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, -90); c.lineTo(8, -28); c.lineTo(-8, -28); c.closePath(); c.fill();
      c.fillStyle = '#c4a660'; c.fillRect(-20, -28, 40, 7); c.fillStyle = '#4a3524'; c.fillRect(-4, -21, 8, 20);
    }
  }
  // Drehbarer Spiegel: Sockel mit Kristall, darauf eine Scheibe in ihrer Stellung (perspektivisch richtig)
  function spiegelFigur(c, e, Fc) {
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    const proj = (wx, wy) => { const dx = wx - kam.x, dy = wy - kam.y; const z = dx * dirx + dy * diry; return { z, sx: CX + (dx * rx + dy * ry) / z * Fc }; };
    const m = proj(e.x, e.y), sk = Fc / m.z / 275;
    // Sockel
    c.fillStyle = '#2a2d2a'; c.beginPath(); c.ellipse(0, -8, 70, 16, 0, 0, 7); c.fill();
    c.fillStyle = '#4b4a3c'; c.beginPath(); c.ellipse(0, -14, 64, 13, 0, 0, 7); c.fill();
    c.save(); c.shadowColor = '#8fe6ff'; c.shadowBlur = 16; c.fillStyle = '#bff3ff'; c.beginPath(); c.ellipse(0, -16, 12, 4, 0, 0, 7); c.fill(); c.restore();
    if (e.st === 2) {
      // offen: die Scheibe ist eingeklappt, nur der Rahmen ragt auf
      c.fillStyle = '#6a5c38'; c.fillRect(-4, -70, 8, 56);
      c.fillStyle = '#9fb8c2'; c.fillRect(-30, -26, 60, 8);
      return;
    }
    const d = e.st === 0 ? [0.7071, -0.7071] : [0.7071, 0.7071];
    const h = 0.36;
    const a = proj(e.x - d[0] * h, e.y - d[1] * h), b = proj(e.x + d[0] * h, e.y + d[1] * h);
    if (a.z < 0.2 || b.z < 0.2) return;
    const lx1 = (a.sx - m.sx) / sk, lx2 = (b.sx - m.sx) / sk;
    const f1 = m.z / a.z, f2 = m.z / b.z;
    const unten = -24, oben = -232;
    // Vorder- oder Rückseite? (Normale zur Kamera)
    const nx = -d[1], ny = d[0];
    const zur = Math.abs(nx * dirx + ny * diry);
    const gr = c.createLinearGradient(lx1, oben, lx2, unten);
    gr.addColorStop(0, `rgba(${200 + zur * 40},${225 + zur * 25},${235 + zur * 20},1)`); gr.addColorStop(0.45, '#5c7884'); gr.addColorStop(1, '#22333a');
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(lx1, unten * f1); c.lineTo(lx1, oben * f1); c.lineTo(lx2, oben * f2); c.lineTo(lx2, unten * f2); c.closePath(); c.fill();
    c.strokeStyle = '#a9935a'; c.lineWidth = 5; c.stroke();
    // Glanzstreifen
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(lx1 + (lx2 - lx1) * 0.2, oben * (f1 * 0.8 + f2 * 0.2) * 0.7); c.lineTo(lx1 + (lx2 - lx1) * 0.45, oben * (f1 * 0.55 + f2 * 0.45) * 0.95); c.stroke();
    // Stange
    c.fillStyle = '#6a5c38'; c.fillRect(-4, -26, 8, 14);
  }
  // Lager: Zelte aus Stoffresten, kalte Feuerstelle, Kisten (stehen im Weg)
  function dekoFigur(c, d) {
    if (d.art === 'herz') {
      // Das Herz nach dem Kampf: ohne Ringe, ruhiger; am Ende schlägt es im Takt
      c.save(); c.translate(0, -30 + Math.sin(zeit / 900) * 6); c.scale(0.74, 0.74);
      W.ZEICHNER.herzdergruft(c, zeit / 1000 * (s.ende ? 1.4 : 0.5), s.ende ? (Math.sin(zeit / 420) + 1) / 2 : 0.25);
      c.restore();
      return;
    }
    const rnd = zufall(d.x * 31 + d.y * 7);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(0, -2, 150, 22, 0, 0, 7); c.fill();
    if (d.art === 'zelt') {
      // Stangen
      c.strokeStyle = '#3a2e20'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(-8, -232); c.lineTo(0, -4); c.stroke();
      // Stoffbahnen in verschiedenen, verblassten Farben
      const farben = ['#5b4b3a', '#4b5547', '#6a5136', '#3f4a52', '#5e5a48'];
      const bahnen = 5;
      for (let i = 0; i < bahnen; i++) {
        const x0 = -140 + i * 56, x1 = x0 + 62;
        c.fillStyle = farben[(i + d.x) % farben.length];
        c.beginPath(); c.moveTo(-4, -226); c.lineTo(x1 + (rnd() - 0.5) * 8, -8); c.lineTo(x0 + (rnd() - 0.5) * 8, -6); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.stroke();
        // Naht
        c.strokeStyle = 'rgba(220,200,160,0.25)'; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(-4, -220); c.lineTo(x0 + 4, -12); c.stroke(); c.setLineDash([]);
      }
      // Eingang: dunkle Öffnung
      c.fillStyle = '#0b0a08'; c.beginPath(); c.moveTo(-6, -130); c.lineTo(38, -6); c.lineTo(-46, -6); c.closePath(); c.fill();
      c.fillStyle = farben[(d.x + 2) % farben.length]; c.beginPath(); c.moveTo(-6, -130); c.lineTo(38, -6); c.lineTo(18, -6); c.quadraticCurveTo(8, -70, -6, -130); c.fill();
      // Flicken und Schnur
      c.fillStyle = '#7a6545'; c.fillRect(-90, -70, 26, 22); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.strokeRect(-90, -70, 26, 22);
      c.strokeStyle = '#8c7a58'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, -226); c.quadraticCurveTo(-60, -200, -150, -6); c.stroke();
      // Schatten: Stoff an den Seiten und unten dunkler, Falten
      c.globalCompositeOperation = 'source-atop';
      const sg = c.createLinearGradient(-150, 0, 150, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(0.45, 'rgba(0,0,0,0.05)'); sg.addColorStop(1, 'rgba(0,0,0,0.6)');
      c.fillStyle = sg; c.fillRect(-160, -240, 320, 240);
      const sv = c.createLinearGradient(0, -230, 0, 0); sv.addColorStop(0, 'rgba(0,0,0,0.25)'); sv.addColorStop(0.7, 'rgba(0,0,0,0)'); sv.addColorStop(1, 'rgba(0,0,0,0.35)');
      c.fillStyle = sv; c.fillRect(-160, -240, 320, 240);
      c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 3;
      for (let i = 0; i < 9; i++) { const x = -130 + i * 30 + rnd() * 10; c.beginPath(); c.moveTo(-4 + x * 0.1, -200); c.quadraticCurveTo(x * 0.6, -90, x, -8); c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    } else if (d.art === 'feuer') {
      // Steinkreis
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2, x = Math.cos(a) * 70, y = -14 + Math.sin(a) * 18;
        const gr = c.createLinearGradient(x, y - 18, x, y + 6); gr.addColorStop(0, '#77746a'); gr.addColorStop(1, '#2c2b27');
        c.fillStyle = gr; c.beginPath(); c.ellipse(x, y - 6, 18 + rnd() * 6, 13, 0, 0, 7); c.fill();
      }
      // Asche und verkohlte Scheite
      c.fillStyle = '#2a2724'; c.beginPath(); c.ellipse(0, -14, 52, 12, 0, 0, 7); c.fill();
      c.fillStyle = '#56524c'; for (let i = 0; i < 26; i++) { c.globalAlpha = 0.5; c.fillRect((rnd() - 0.5) * 90, -18 + (rnd() - 0.5) * 12, 3, 2); } c.globalAlpha = 1;
      c.lineCap = 'round';
      for (const [a, b, l] of [[-0.4, -22, 60], [0.5, -20, 54], [2.6, -24, 48]]) {
        c.save(); c.translate(0, b); c.rotate(a);
        c.strokeStyle = '#141210'; c.lineWidth = 15; c.beginPath(); c.moveTo(-l / 2, 0); c.lineTo(l / 2, 0); c.stroke();
        c.strokeStyle = 'rgba(120,100,80,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-l / 2 + 4, -4); c.lineTo(l / 2 - 4, -4); c.stroke();
        c.restore();
      }
      // Dreibein mit Kessel
      c.strokeStyle = '#2b2a27'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-60, -4); c.lineTo(0, -150); c.lineTo(60, -6); c.moveTo(0, -150); c.lineTo(10, -20); c.stroke();
      c.strokeStyle = '#5c584c'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -150); c.lineTo(0, -96); c.stroke();
      const kg = c.createLinearGradient(-26, -96, 26, -60); kg.addColorStop(0, '#4a4e4c'); kg.addColorStop(1, '#141615');
      c.fillStyle = kg; c.beginPath(); c.moveTo(-28, -96); c.lineTo(28, -96); c.quadraticCurveTo(30, -58, 0, -56); c.quadraticCurveTo(-30, -58, -28, -96); c.fill();
    } else if (d.art === 'kiste') {
      const kiste = (x, y, w, h) => {
        const gr = c.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#6b5537'); gr.addColorStop(1, '#30251a');
        c.fillStyle = gr; c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2;
        for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x, y + h * i / 4); c.lineTo(x + w, y + h * i / 4); c.stroke(); }
        c.strokeStyle = '#5a5d58'; c.lineWidth = 6; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
        c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + w - 3, y + h - 3); c.stroke();
        c.fillStyle = '#9a9a8c'; for (const [a, b] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) { c.beginPath(); c.arc(a, b, 3, 0, 7); c.fill(); }
      };
      kiste(-120, -96, 120, 92);
      kiste(-6, -84, 104, 80);
      kiste(-82, -170, 96, 76);
      // leerer Kristallsplitter-Rest
      c.fillStyle = 'rgba(110,220,255,0.5)'; c.beginPath(); c.moveTo(40, -86); c.lineTo(46, -100); c.lineTo(50, -86); c.fill();
    }
  }
  function kristallForm(c, farbe1, farbe2, h = 70) {
    const gr = c.createLinearGradient(-14, -h, 14, -8); gr.addColorStop(0, farbe1); gr.addColorStop(1, farbe2);
    c.fillStyle = gr; c.beginPath(); c.moveTo(0, -h); c.lineTo(14, -h * 0.55); c.lineTo(9, -8); c.lineTo(-9, -8); c.lineTo(-14, -h * 0.55); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -h); c.lineTo(0, -8); c.moveTo(-14, -h * 0.55); c.lineTo(0, -h * 0.45); c.lineTo(14, -h * 0.55); c.stroke();
  }
  function dingMalenNeu(c, ding) {
    const kristallFarbe = { frostkristall: ['#f0fbff', '#5aa8e8'], glutkristall: ['#fff3d6', '#d9822b'], schildkristall: ['#f2fff9', '#3fbf92'], lichtkristall: ['#fffbe8', '#e6c45a'] }[ding.typ];
    if (kristallFarbe) {
      c.save(); c.shadowColor = kristallFarbe[1]; c.shadowBlur = 24; kristallForm(c, kristallFarbe[0], kristallFarbe[1], 64); c.restore();
      return true;
    }
    if (ding.typ === 'lederwams' || ding.typ === 'plattenweste' || ding.typ === 'runenmantel') {
      const f = { lederwams: ['#7a5a3a', '#3e2c1c'], plattenweste: ['#7c868a', '#2c3234'], runenmantel: ['#3c4f6a', '#1a2230'] }[ding.typ];
      const gr = c.createLinearGradient(0, -70, 0, -6); gr.addColorStop(0, f[0]); gr.addColorStop(1, f[1]);
      c.fillStyle = gr; c.beginPath(); c.moveTo(-30, -66); c.lineTo(-12, -72); c.quadraticCurveTo(0, -60, 12, -72); c.lineTo(30, -66); c.lineTo(36, -40); c.lineTo(26, -38); c.lineTo(26, -8); c.lineTo(-26, -8); c.lineTo(-26, -38); c.lineTo(-36, -40); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = 'rgba(230,210,160,0.4)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(0, -60); c.lineTo(0, -10); c.stroke(); c.setLineDash([]);
      return true;
    }
    if (ding.typ === 'kraftring' || ding.typ === 'ruheamulett') {
      c.strokeStyle = '#c4a660'; c.lineWidth = 7; c.beginPath(); c.ellipse(0, -20, 18, 12, 0, 0, 7); c.stroke();
      c.save(); c.shadowColor = '#5FE8B4'; c.shadowBlur = 14; c.fillStyle = ding.typ === 'kraftring' ? '#ffd58a' : '#8dffd6'; c.beginPath(); c.arc(0, -34, 7, 0, 7); c.fill(); c.restore();
      return true;
    }
    if (ding.typ === 'leitkristall' || ding.typ === 'kristall') {
      const blau = ding.typ === 'kristall';
      c.save(); c.shadowColor = blau ? '#7aa8ff' : '#6ee6ff'; c.shadowBlur = 26;
      kristallForm(c, '#effeff', blau ? '#2c4fbf' : '#1b7fa8', 76);
      c.restore();
      if (!blau) { c.save(); c.translate(-22, 2); c.scale(0.5, 0.5); kristallForm(c, '#dffaff', '#1b7fa8', 60); c.restore(); }
      return true;
    }
    if (ding.typ === 'notiz') {
      c.rotate(-0.12);
      c.fillStyle = '#c9bb92'; c.beginPath(); c.moveTo(-34, -6); c.lineTo(30, -12); c.lineTo(36, -40); c.lineTo(-30, -36); c.closePath(); c.fill();
      c.fillStyle = '#a8996e'; c.beginPath(); c.moveTo(30, -12); c.lineTo(36, -40); c.lineTo(42, -30); c.lineTo(36, -10); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,30,20,0.6)'; c.lineWidth = 2;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-24, -14 - i * 6); c.lineTo(18 - (i % 2) * 10, -18 - i * 6); c.stroke(); }
      return true;
    }
    if (ding.typ === 'kernspeer') {
      c.rotate(-0.5);
      c.fillStyle = '#3d2c1c'; c.fillRect(-4, -130, 8, 126);
      c.save(); c.shadowColor = '#5FE8B4'; c.shadowBlur = 14;
      c.fillStyle = '#9dffd8'; c.beginPath(); c.moveTo(0, -176); c.lineTo(10, -136); c.lineTo(0, -128); c.lineTo(-10, -136); c.closePath(); c.fill(); c.restore();
      c.fillStyle = '#c4a660'; c.fillRect(-12, -130, 24, 6);
      return true;
    }
    if (ding.typ === 'ritterstueck') {
      c.fillStyle = '#3c4446'; c.beginPath(); c.moveTo(-36, -8); c.lineTo(-30, -40); c.lineTo(0, -52); c.lineTo(32, -40); c.lineTo(38, -8); c.closePath(); c.fill();
      c.strokeStyle = '#8a969a'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#1a1f20'; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, -14); c.lineTo(-16, -38); c.moveTo(20, -14); c.lineTo(16, -38); c.stroke();
      c.save(); c.shadowColor = '#64ff9a'; c.shadowBlur = 18; c.fillStyle = '#9dffb8'; c.beginPath(); c.arc(0, -28, 8, 0, 7); c.fill(); c.restore();
      return true;
    }
    return false;
  }
  // Gegner im Spiel: dieselben Zeichnungen wie im Bestiarium
  const GEGNER_BILD = { schleim: 'kristallschleim', fledermaus: 'glimmermotte', waechter: 'kernwaechter', kaefer: 'splitterkaefer', hund: 'steinhund', drohne: 'waechterdrohne', scherbe: 'spiegelscherbe', auge: 'runenauge', fresser: 'lichtfresser', hueter: 'saeulenhueter', spinne: 'tiefenspinne', spore: 'sporenkristall', wurm: 'echowurm', koloss: 'schlackenkoloss', ritter: 'hohlerritter', herz: 'herzdergruft' };
  // Kampfbewegungen je Gegner: { art: 'angriff' | 'treffer', start } (Zeit in ms)
  const anims = new Map();
  let sterbende = [];   // besiegte Gegner zerfallen noch: { typ, x, y, start }
  function animStarten(gegnerId, art) { anims.set(gegnerId, { art, start: zeit || performance.now() }); }
  function animJetzt(gegnerId, t) {
    const a = anims.get(gegnerId);
    if (!a) return null;
    const k = (t - a.start) / 1000 / W.DAUER[a.art];
    if (k >= 1 || k < 0) { if (k >= 1) anims.delete(gegnerId); return null; }
    return { art: a.art, k };
  }
  const bildVon = (typ) => GEGNER_BILD[typ] || 'kristallschleim';
  function gegnerMalen(c, gg, t0, z = animJetzt(gg.id, t0)) {
    c.scale(0.74, 0.74);
    try { return W.wesenMalen(c, bildVon(gg.typ), t0 / 1000, (Math.sin(t0 / 500) + 1) / 2, ruhig() && z && z.art !== 'besiegt' ? null : z); } catch (e) { return 0; }
  }
  // Wie stark wackelt das Bild gerade (Gegner stößt zu)?
  function bildWackeln(t) {
    let w = 0;
    if (ruhig()) return 0;
    for (const gg of s.gegner) { const z = animJetzt(gg.id, t); if (z) w = Math.max(w, W.wackeln(bildVon(gg.typ), z)); }
    return w;
  }
  function augen(c, dx, dy, r, farbe, leuchten) {
    c.save();
    if (leuchten) { c.shadowColor = farbe; c.shadowBlur = 12; }
    c.fillStyle = leuchten ? farbe : '#f2fff8';
    c.beginPath(); c.arc(dx, dy, r, 0, 7); c.arc(-dx, dy, r, 0, 7); c.fill();
    if (!leuchten) { c.fillStyle = farbe; c.beginPath(); c.arc(dx + 3, dy + 2, r * 0.5, 0, 7); c.arc(-dx + 3, dy + 2, r * 0.5, 0, 7); c.fill(); }
    c.restore();
  }

  // Staub rieselt von der Decke. Er hängt fest im Gang (Welt), die Gruppe läuft hindurch.
  // Je Bodenfeld ein paar Körnchen mit festem Platz; sie fallen langsam und beginnen oben neu.
  const KOERNER = 5;
  function staub(t, Fc, bob, L) {
    if (ruhig()) return;
    const dirx = Math.cos(kam.a), diry = Math.sin(kam.a), rx = -diry, ry = dirx;
    const cx0 = Math.floor(kam.x), cy0 = Math.floor(kam.y);
    const licht = [0, 0, 0];
    g.globalCompositeOperation = 'lighter';
    for (let fy = cy0 - 5; fy <= cy0 + 5; fy++) for (let fx = cx0 - 5; fx <= cx0 + 5; fx++) {
      if (!R.begehbar(s, fx, fy)) continue;
      for (let i = 0; i < KOERNER; i++) {
        const h0 = dekoHash(fx, fy, i + 20);
        const wx = fx + (h0 % 1000) / 1000, wy = fy + ((h0 >>> 10) % 1000) / 1000;
        const tempo = 0.025 + ((h0 >>> 20) % 100) / 100 * 0.05;
        const phase = ((h0 >>> 4) % 1000) / 1000;
        const hoehe = 0.5 - (((t / 1000) * tempo + phase) % 1);           // von der Decke (0.5) bis zum Boden (−0.5)
        const sx0 = wx + Math.sin(t / 1300 + h0) * 0.03, sy0 = wy + Math.cos(t / 1700 + h0) * 0.03;
        const dx = sx0 - kam.x, dy = sy0 - kam.y;
        const z = dx * dirx + dy * diry;
        if (z < 0.15 || z > 5) continue;
        const xc = dx * rx + dy * ry;
        const sx = CX + xc / z * Fc, sy = CY + bob - hoehe / z * Fc;
        const c = Math.floor(sx / SP);
        if (c < 0 || c >= SPALTEN || zbuf[c] < z) continue;
        lichtBei(L, sx0, sy0, licht);
        const hell = Math.min(1, (licht[0] + licht[1]) * 0.5);
        const a = hell * 0.55 * Math.min(1, z * 1.5) * (0.6 + 0.4 * Math.sin(t / 400 + h0));
        if (a < 0.02) continue;
        g.fillStyle = `rgba(255,${190 + (licht[1] > licht[0] ? 50 : 20)},150,${a})`;
        g.beginPath(); g.arc(sx, sy, 1.6 / z + 0.5, 0, 7); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
  }

  function malen(t) {
    trefferDinge = [];
    const { bob, roll, fov } = kameraJetzt(t);
    const Fc = F * fov;
    STRAHL = etage.quellen ? R.strahlWeg(s) : [];
    const L = lichter(t);
    g.save();
    const wk = bildWackeln(t);
    if (wk) g.translate((Math.random() - 0.5) * wk, (Math.random() - 0.5) * wk * 0.6);
    if (roll) { g.translate(CX, CY); g.rotate(roll); g.scale(1.06, 1.06); g.translate(-CX, -CY); }
    bodenUndDecke(L, Fc, bob);
    waende(L, Fc, bob);
    figuren(L, Fc, bob, t);
    kettenMalen(Fc, bob);
    strahlMalen(Fc, bob, t);
    staub(t, Fc, bob, L);
    g.restore();
    glanz();
    // Rand-Vignette
    const v = g.createRadialGradient(CX, CY, 150, CX, CY, 430);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, BREITE, HOEHE);
    if (blitz > 0) { g.fillStyle = `rgba(255,240,200,${blitz * 0.25})`; g.fillRect(0, 0, BREITE, HOEHE); }
    if (dunkelBlitz > 0) { g.fillStyle = `rgba(0,0,0,${dunkelBlitz})`; g.fillRect(0, 0, BREITE, HOEHE); }
  }

  // Glanz: Bild klein rechnen, nur helle Stellen behalten, weich aufaddieren
  const klein = leinwand(160, 120), kg2 = klein.getContext('2d');
  const glanzGeht = 'filter' in kg2;
  function glanz() {
    if (!glanzGeht) return;
    kg2.filter = 'brightness(0.6) contrast(4)';
    kg2.clearRect(0, 0, 160, 120); kg2.drawImage(bild, 0, 0, 160, 120);
    kg2.filter = 'none';
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.filter = 'blur(7px)';
    g.drawImage(klein, 0, 0, BREITE, HOEHE); g.restore(); g.filter = 'none';
  }

  let schleife = null;
  function tick(t) {
    zeit = t;
    puls = ruhig() ? 1 : 0.8 + 0.2 * Math.sin(t / 700);
    blitz = Math.max(0, blitz - 0.06);
    dunkelBlitz = Math.max(0, dunkelBlitz - 0.07);
    malen(t);
    schleife = requestAnimationFrame(tick);
  }

  // ---------- Meldungen ----------
  let meldungTimer = null;
  function sag(text, dauer = 2600) {
    $meldung.textContent = text;
    $meldung.classList.add('an');
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(() => $meldung.classList.remove('an'), dauer);
  }
  function zahl(text, art, x = 50, y = 40) {
    const el = document.createElement('div');
    el.className = 'rg-zahl ' + art; el.textContent = text;
    el.style.left = x + '%'; el.style.top = y + '%';
    $zahlen.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  // ---------- Gruppe, Taschen, „hier liegt“ ----------
  let heilenWahl = false;
  function gruppeZeigen() {
    const k = s.kampf;
    $('.rg-etage').textContent = R.etageVon(s).name;
    $('.rg-gruppe').innerHTML = s.helden.map(h => {
      const tot = h.leben <= 0;
      const getan = k && k.getan[h.id];
      const kw = A.kampfwerte(h);
      const kristall = k && !tot && kw.faehigkeit ? `<button class="rg-akt rg-kristall-akt" data-a="faehigkeit" data-held="${h.id}" ${getan || (k.genutzt && k.genutzt[h.id]) ? 'disabled' : ''} title="${A.FAEHIGKEITEN[kw.faehigkeit].text}">${A.FAEHIGKEITEN[kw.faehigkeit].name}</button>` : '';
      const aktionen = k && !tot ? (h.id === 'rana'
        ? `<button class="rg-akt" data-a="schlag" ${getan ? 'disabled' : ''}>Schlag</button>`
        : `<button class="rg-akt" data-a="funke" ${getan || h.mana < 4 ? 'disabled' : ''}>Funke <small>4</small></button><button class="rg-akt" data-a="heilen" ${getan || h.mana < 3 ? 'disabled' : ''}>Heilen <small>3</small></button>`) + kristall : '';
      return `<div class="rg-held ${tot ? 'tot' : ''} ${heilenWahl ? 'waehlbar' : ''}" data-held="${h.id}">
        <div class="rg-bildchen rg-${h.id}" aria-hidden="true">${h.id === 'rana' ? schwertSvg() : runeSvg()}</div>
        <div class="rg-held-text">
          <div class="rg-held-name"><b>${h.name}</b><span>Stufe ${h.stufe}${h.punkte ? ' <i class="rg-punkt" title="Punkt zu verteilen">+' + h.punkte + '</i>' : ''}</span></div>
          <div class="rg-lp" title="Lebenspunkte"><i style="width:${h.leben / h.max * 100}%"></i><span>${h.leben}/${h.max}</span></div>
          ${h.mana !== undefined ? `<div class="rg-mana" title="Mana"><i style="width:${h.mana / h.manaMax * 100}%"></i><span>${h.mana}/${h.manaMax}</span></div>` : ''}
          ${aktionen ? `<div class="rg-aktionen">${aktionen}</div>` : ''}
        </div>
      </div>`;
    }).join('') + (k ? `<button class="rg-warten" data-a="warten">Abwarten</button>` : '');
    const t = s.taschen;
    const mitFassung = !!etage.fassungen;
    const gh = R.geheimnisStand(s);
    const heil = R.anzahlImBeutel(s, 'heiltrank'), mana = R.anzahlImBeutel(s, 'manatrank');
    const hinweis = s.helden.some(h => h.punkte) || s.beutel.some(d => R.besserFuer(s, d.typ).length);
    $('.rg-taschen').innerHTML = `
      <button class="rg-tasche rg-beutel-knopf ${hinweis ? 'neu' : ''}" data-a="beutel">${beutelSvg()}<span>Beutel ${s.beutel.length}/${A.BEUTEL_PLAETZE}</span></button>
      <button class="rg-tasche" data-a="trank" ${heil ? '' : 'disabled'}>${trankSvg()}<span>Heiltrank × ${heil}</span></button>
      ${mana ? `<button class="rg-tasche" data-a="manatrank">${trankSvg('#5a86e8')}<span>Manatrank × ${mana}</span></button>` : ''}
      ${mitFassung
        ? `<span class="rg-tasche ${t.leitkristall ? '' : 'leer'}">${kristallSvg('#6ee6ff')}<span>Leitkristall × ${t.leitkristall || 0}</span></span>`
        : etage.karte.some(z => z.includes('D')) ? `<span class="rg-tasche ${t.schluessel ? '' : 'leer'}">${schluesselSvg()}<span>Schlüssel × ${t.schluessel}</span></span>` : ''}
      ${s.kael ? `<span class="rg-tasche rg-kael">⚔<span>Kael ${s.kael === 'mensch' ? 'kämpft mit' : 'ist frei'}</span></span>` : ''}
      ${t.ritterstueck ? `<span class="rg-tasche">${kristallSvg('#7dffa8')}<span>Rüstungsstück</span></span>` : ''}
      <button class="rg-tasche rg-geheim-zahl" data-a="tagebuch" title="Geheimnisse dieser Etage">✦<span>Geheimnisse ${gh.gefunden} von ${gh.gesamt}</span></button>`;
    // Dinge auf dem eigenen Feld
    const hier = R.dingAuf(s, s.x, s.y);
    const $h = $('.rg-hier');
    $h.hidden = !hier.length;
    $h.innerHTML = hier.length ? `Hier liegt: ${hier.map(d => `<button class="rg-klein" data-a="nimm" data-id="${d.id}">${R.dingInfo(d.typ).name} aufheben</button>`).join(' ')}` : '';
    // Gegner-Leiste
    const $gl = $('.rg-gegnerleiste');
    if (k) {
      const gg = s.gegner.find(x => x.id === k.gegner);
      $gl.hidden = false;
      $gl.querySelector('.rg-gegnername').textContent = R.GEGNER[gg.typ].name;
      $gl.querySelector('i').style.width = (gg.leben / R.GEGNER[gg.typ].leben * 100) + '%';
    } else $gl.hidden = true;
    wurzel.classList.toggle('im-kampf', !!k);
  }

  // ---------- Handlungen ----------
  function sichern() { if (demo) return; try { sichernExt(JSON.parse(JSON.stringify(s))); } catch (e) { /* egal */ } }

  function nachSchritt() {
    const vorherK = s.kampf;
    const bewegt = R.gegnerZiehen(s);
    R.sichtMerken(s);
    const ev = s.kampf ? null : R.ereignisPruefen(s);
    if (ev && ev.art === 'ritter') ritterZeigen(ev);
    if (ev && ev.art === 'stimme') { blitz = 0.6; setTimeout(() => sprechen(ev.gespraech), 600); }
    const k = R.kampfPruefen(s);
    if (k && !vorherK) {
      const gg = s.gegner.find(x => x.id === k.gegner);
      if (gg.typ === 'ritter') setTimeout(kaelBegegnung, ev ? 3000 : 300);
      else if (gg.typ === 'herz') sag(s.kael === 'mensch' ? 'Die Ringe brummen tief. Kael zieht sein Schwert. Zu dritt gegen das Herz!' : 'Die Ringe brummen tief. Das Herz greift an!', 3200);
      else sag(`${R.GEGNER[gg.typ].artikel || 'Ein'} ${R.GEGNER[gg.typ].name} greift an!`);
      melden('rg_kampf', { gegner: gg.typ });
    } else if (bewegt.length) sag('Etwas bewegt sich im Dunkeln …', 1600);
    if (s.geschafft) geschafft();
    gruppeZeigen(); sichern();
  }

  function ritterZeigen(ev) {
    erscheinung = { x: ev.x, y: ev.y, start: zeit || performance.now() };
    melden('rg_ritter', { id: ev.id });
    const text = ev.text || ['Am Ende des Gangs steht eine Gestalt aus Metall. Ein grünes Licht in der Brust.', 'Sie sieht euch an. Dann geht sie weg.'];
    const gespraech = ev.gespraech || [['Ilo', 'Hast du das gesehen? Er hat uns nicht angegriffen.'], ['Rana', 'Diesmal nicht.']];
    sag(text[0], 3400);
    if (text[1]) setTimeout(() => sag(text[1], 2600), 3500);
    setTimeout(() => sprechen(gespraech), 6400);
  }
  // Nach dem Wächter im Wurzelwerk: der Ritter kniet, legt das Amulett hin
  function ritterKniet(pos, knien) {
    setTimeout(() => {
      erscheinung = { x: pos.x, y: pos.y, start: zeit || performance.now(), knien: true, lang: true };
      sag('Hinter dem Staub kniet der Ritter aus Metall. Er legt etwas vor euch hin.', 3600);
    }, 2600);
    setTimeout(() => sprechen([
      ['Der Ritter', 'Sie … wartet.'],
      ['Ilo', knien.amulettNeu ? 'Das Amulett! Das hat Senna immer getragen.' : 'Er hat Sennas Amulett gesucht. Wir haben es schon.'],
      ['Rana', 'Dann ist Kael kein Feind. Er ist ein Freund, der feststeckt.']
    ]), 6600);
  }
  // Kurzes Gespräch als Tafel
  function sprechen(zeilen, titel = '') {
    if (s.geschafft) return;
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-gespraech">
      ${titel ? `<h2>${titel}</h2>` : ''}
      ${zeilen.map(([wer, was]) => `<p><b>${wer}:</b> „${was}“</p>`).join('')}
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Weiter</button></div></div>`;
    $tafel.dataset.text = zeilen.map(([wer, was]) => `${wer}: ${was}`).join(' ');
  }
  let geheimTimer = null;
  function geheimnisZeigen(gh) {
    if (!gh) return;
    const el = $('.rg-geheim');
    el.innerHTML = `<b>✦ Geheimnis gefunden</b><span>${gh.name}</span><small>${gh.anzahl} von ${gh.gesamt}</small>`;
    el.classList.remove('an'); void el.offsetWidth; el.classList.add('an');
    clearTimeout(geheimTimer);
    geheimTimer = setTimeout(() => el.classList.remove('an'), 4200);
    blitz = Math.max(blitz, 0.5);
    melden('rg_geheimnis', { etage: s.etage, id: gh.id });
    gruppeZeigen();
  }

  let demo = false;
  function bewegung(art, vonDemo = false) {
    if (demo && !vonDemo) return;
    if (s.geschafft || !$tafel.hidden || !$voll.hidden) return;
    if (anim) { wartend = art; return; }
    if (s.kampf) { sag('Erst kämpfen! Oder einen Heiltrank trinken.'); return; }
    gegnerVorher = new Map(s.gegner.map(gg => [gg.id, { x: gg.x, y: gg.y }]));
    const r = R.bewegen(s, art);
    if (!r.ok) {
      if (r.grund === 'wand') { sag('Da geht es nicht weiter.', 1200); wackeln(); }
      return;
    }
    if (r.aufgetaucht) { sag('Der Boden bricht auf! Ein Echowurm!', 2400); dunkelBlitz = 0.35; wackeln(); }
    nachSchritt();
    kameraStarten(art);
  }
  function kameraSetzen() { kam = { x: s.x + 0.5, y: s.y + 0.5, a: winkelVon(s.r) }; anim = null; wartend = null; }

  // Rundgang: zeigt die gewählte Bewegung auf einem festen Weg (ohne Gegner, danach ist alles wie vorher)
  const RUNDGANG = ['vor', 'vor', 'vor', 'vor', 'drehL', 'vor', 'vor', 'drehL', 'vor', 'vor', 'drehR', 'vor', 'vor', 'vor', 'vor', 'drehR', 'vor', 'vor', 'drehR', 'drehR'];
  function rundgang() {
    if (demo || s.kampf) return;
    const vorher2 = JSON.parse(JSON.stringify(s));
    demo = true;
    s = R.neuesSpiel(s.etage); s.gegner = [];
    kameraSetzen();
    sag('Rundgang: ' + STILE[stil].name, 1800);
    let i = 0;
    const weiter = () => {
      if (i >= RUNDGANG.length) {
        s = vorher2; kameraSetzen(); demo = false; dunkelBlitz = 0.5;
        gruppeZeigen(); sag('Rundgang vorbei.', 1400);
        return;
      }
      bewegung(RUNDGANG[i++], true);
      const st = STILE[stil];
      setTimeout(weiter, Math.max(st.dauer, st.drehDauer) + (stil === 'klassisch' ? 380 : 90));
    };
    setTimeout(weiter, 500);
  }
  function wackeln() { bild.classList.remove('stoss'); void bild.offsetWidth; bild.classList.add('stoss'); }

  // Tippen ins Bild: Dinge auf dem Boden, dann die Wand vorne
  function bildGetippt(cx, cy) {
    if (s.geschafft) return;
    const rect = bild.getBoundingClientRect();
    const x = (cx - rect.left) / rect.width * BREITE, y = (cy - rect.top) / rect.height * HOEHE;
    if (anim || demo) return;
    for (const d of trefferDinge) {
      if (Math.hypot(x - d.x, y - d.y) < d.r) { nimm(d.id); return; }
    }
    const w = R.wandVorn(s);
    if (!w) { sag('Nur Dunkelheit.', 1200); return; }
    // Wo im Wandbild wurde getippt? (aus dem Strahl dieser Bildspalte)
    const hit = treffer[Math.max(0, Math.min(SPALTEN - 1, Math.floor(x / SP)))];
    let u = -1, v = -1;
    if (hit && hit.x === w.x && hit.y === w.y) { u = hit.u; v = (y - hit.top) / hit.h; }
    const in_ = (u1, u2, v1, v2) => u >= u1 && u <= u2 && v >= v1 && v <= v2;
    if (w.art === 'hebel') {
      const ring = (R.etageVon(s).hebelArt || {})[`${w.x},${w.y}`] === 'ring';
      if (ring ? in_(0.36, 0.64, 0.12, 0.85) : in_(0.34, 0.66, 0.2, 0.78)) {
        const r = R.hebelUmlegen(s);
        if (ring) sag(r.unten ? 'Du ziehst am Ring. Die Kette rasselt, in der Ferne hebt sich ein Gitter.' : 'Der Ring gleitet zurück. Ein Gitter schließt sich.', 3000);
        else sag(r.unten ? 'Der Kristall gleitet nach unten und leuchtet. In der Ferne hebt sich ein Gitter.' : 'Der Kristall gleitet zurück. Ein Gitter schließt sich.', 3000);
        melden('rg_hebel', { unten: r.unten });
        blitz = 0.4; gruppeZeigen(); sichern();
      } else steinGetippt();
    } else if (w.art === 'knopf') {
      if (in_(0.18, 0.32, 0.63, 0.78)) {
        const r = R.knopfDruecken(s);
        if (r.fach) {
          if (r.leer) sag('Ein Fach hinter dem Stein. Es ist leer.', 2400);
          else {
            if (r.voll) { sag('Ein Fach hinter dem Stein! Aber der Beutel ist voll.', 3000); gruppeZeigen(); return; }
            sag(`Ein Fach hinter dem Stein! Darin: ${R.dingInfo(r.gibt).name}.`, 3200);
            geheimnisZeigen(r.geheimnis);
          }
        } else {
          sag(r.neu ? 'Der Stein gibt nach! Irgendwo schiebt sich eine Wand zur Seite.' : 'Der Stein ist schon gedrückt.', 3200);
          if (r.neu) { blitz = 0.6; melden('rg_knopf', {}); }
        }
        gruppeZeigen(); sichern();
      } else steinGetippt();
    } else if (w.art === 'tafel') {
      if (in_(0.16, 0.84, 0.16, 0.74)) {
        const r = R.tafelLesen(s);
        tafelZeigen(w.text, `${w.x},${w.y}` === etage.runenTafel);
        if (r && r.geheimnis) geheimnisZeigen(r.geheimnis);
        sichern();
      } else steinGetippt();
    } else if (w.art === 'spiegel') {
      const r = R.spiegelDrehen(s);
      if (r) {
        sag(['Der Spiegel dreht sich: /', 'Der Spiegel dreht sich: \\', 'Der Spiegel klappt ein. Das Licht geht vorbei.'][r.stand], 1600);
        if (r.licht) lichtErgebnis(r.licht);
        melden('rg_spiegel', { stand: r.stand });
        gruppeZeigen(); sichern();
      }
    } else if (w.art === 'spore') {
      if (in_(0.18, 0.82, 0.1, 0.85)) {
        const r = R.sporeWecken(s);
        if (!r) sag('Erst kämpfen!', 1400);
        else if (r.ok) {
          sag(r.wie === 'funke' ? 'Ilo schickt einen Funken in den Kristall. Er leuchtet auf. Die Wurzeln weichen zurück!' : 'Der Lichtkristall leuchtet. Der Sporenkristall antwortet. Die Wurzeln weichen zurück!', 3800);
          blitz = 0.9; melden('rg_spore', { wie: r.wie }); gruppeZeigen(); sichern();
        } else if (r.grund === 'schon') sag('Der Kristall leuchtet schon.', 1600);
        else sag('Der Kristall ist trüb. Ilo braucht 4 Mana für einen Funken. Ein Manatrank hilft.', 3400);
      } else steinGetippt();
    } else if (w.art === 'wurzeln') sag('Dicke Wurzeln versperren den Gang. Vielleicht hilft Licht in der Nähe.', 2800);
    else if (w.art === 'quelle') sag('Aus der Linse fällt ein kaltes, helles Licht.', 2200);
    else if (w.art === 'ziel') sag(w.an ? 'Der Kristall ist voller Licht.' : 'Ein dunkler Kristall. Er wartet auf Licht.', 2200);
    else if (w.art === 'erinnerung') {
      if (in_(0.22, 0.78, 0.08, 0.9)) {
        const r = R.erinnerungSehen(s);
        erinnerungZeigen(r);
        if (r.geheimnis) setTimeout(() => geheimnisZeigen(r.geheimnis), 400);
        melden('rg_erinnerung', { bild: r.bild }); sichern();
      } else steinGetippt();
    } else if (w.art === 'fassung') {
      if (in_(0.2, 0.8, 0.15, 0.72)) {
        const r = R.einsetzen(s);
        if (r.ok) {
          if (r.kettenFrei) sag('Die letzte Kette fällt. Das Herz schwebt frei. An den Wänden warten fünf Runen.', 4200);
          else if (etage.runenErstNachKetten) sag('Der Splitter rastet ein. Eine Kette löst sich und fällt klirrend zu Boden.', 3200);
          else sag('Der Leitkristall rastet ein. Licht läuft durch die Bahn im Boden. In der Ferne öffnet sich ein Tor.', 3800);
          blitz = 0.9; melden('rg_fassung', {}); gruppeZeigen(); sichern();
        } else if (r.grund === 'voll') sag('Der Kristall sitzt fest und leuchtet.', 1800);
        else sag(etage.runenErstNachKetten ? (s.phase === 'herz' ? 'Ein Kettenhalter. Die Kette ist straff gespannt.' : 'Ein Kettenhalter. Hier passt ein Splitter der Ringe.') : 'Eine leere Fassung. Hier fehlt ein Leitkristall.', 2600);
      } else steinGetippt();
    } else if (w.art === 'rune') {
      if (in_(0.28, 0.72, 0.24, 0.68)) {
        const r = R.runeBeruehren(s);
        if (r.gesperrt) sag('Die Rune ist kalt. Erst muss das Herz frei sein.', 2600);
        else if (r.ende) { blitz = 1; melden('rg_ende', {}); sichern(); gruppeZeigen(); setTimeout(() => endeSeite(0), 1200); return; }
        else if (r.vorLetzter) { sag('Die Rune leuchtet auf.'); setTimeout(() => sprechen([['Senna', 'Jetzt ich. Lasst mich los. Das Herz kann allein schlagen.']]), 700); }
        else if (r.schon) sag(etage.runenErstNachKetten ? 'Das Herz schlägt schon im Takt.' : 'Das Tor ist schon offen.');
        else if (r.doppelt) sag('Diese Rune leuchtet schon.');
        else if (r.falsch) { sag('Die Runen erlöschen. Fang noch einmal an.'); wackeln(); }
        else if (r.offen) { sag('Alle drei Runen leuchten. Das Runentor öffnet sich!', 3600); blitz = 1; melden('rg_runen', {}); }
        else sag('Die Rune leuchtet auf.');
        sichern();
      } else steinGetippt();
    } else if (w.art === 'tuer') {
      const r = R.tuerAufschliessen(s);
      if (r && r.ok) { sag('Der Schlüssel passt. Die Tür schwingt auf.'); blitz = 0.5; melden('rg_tuer', {}); gruppeZeigen(); sichern(); }
      else sag('Die Tür ist verschlossen. Ein Schlüssel muss her.');
    } else if (w.art === 'gitter') sag(etage.fassungen ? 'Das Tor bewegt sich nicht. Ihm fehlt Kraft aus einer Leitbahn.' : 'Das Gitter sitzt fest. Irgendwo muss ein Hebel sein.');
    else if (w.art === 'runentor') sag('Über dem Tor sind drei leere Fassungen.');
    else steinGetippt();
  }
  const STEIN = ['Kalter Stein.', 'Nur Stein.', 'Hier ist nichts.', 'Feuchter Stein.'];
  let steinN = 0;
  function steinGetippt() { sag(STEIN[steinN++ % STEIN.length], 1200); }

  function nimm(id) {
    const d = s.dinge.find(x => x.id === id);
    const r = R.aufheben(s, id);
    if (!r) return;
    if (r.voll) { sag('Der Beutel ist voll. Leg zuerst etwas ab.', 2600); return; }
    melden('rg_ding', { typ: d.typ });
    const info = R.dingInfo(d.typ);
    if (r.notiz) notizZeigen(r.notiz);
    else if (r.besser && r.besser.length) sag(`${info.name}: Besser für ${r.besser.map(id2 => s.helden.find(h => h.id === id2).name).join(' und ')}! Im Beutel anlegen.`, 3600);
    else sag(`${info.name}: ${info.text}`, 3000);
    geheimnisZeigen(r.geheimnis);
    gruppeZeigen(); sichern();
  }

  function lichtErgebnis(l) {
    blitz = 0.9;
    if (l.oeffnet) sag('Das Licht trifft den Kristall. Er leuchtet auf. In der Ferne öffnet sich ein Tor.', 3800);
    else if (l.voll) sag('Der Kristall öffnet sich. Aber der Beutel ist voll.', 3000);
    else if (l.gibt) { sag(`Der Kristall springt auf. Darin liegt: ${R.dingInfo(l.gibt).name}.`, 3600); geheimnisZeigen(l.geheimnis); }
    else if (l.leer) sag('Der Kristall leuchtet. Er ist leer.', 2400);
  }
  // Bilder in den Erinnerungsspiegeln: Umrisse in kaltem Licht
  function erinnerungMalen(c, nr) {
    const W2 = c.canvas.width, H2 = c.canvas.height;
    const gr = c.createLinearGradient(0, 0, 0, H2); gr.addColorStop(0, '#16242c'); gr.addColorStop(1, '#0a1014');
    c.fillStyle = gr; c.fillRect(0, 0, W2, H2);
    const figur = (x, y, s2 = 1, f = 'rgba(190,225,240,0.85)', haltung = 0) => {
      c.save(); c.translate(x, y); c.scale(s2, s2); c.fillStyle = f;
      c.beginPath(); c.arc(0, -62, 9, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-11, -50); c.lineTo(11, -50); c.lineTo(14 + haltung, -10); c.lineTo(-14, -10); c.closePath(); c.fill();
      c.fillRect(-10, -10, 7, 22); c.fillRect(3, -10, 7, 22);
      c.restore();
    };
    if (nr === 1) {
      // vier Freunde am Lagerfeuer
      const fg = c.createRadialGradient(W2 / 2, H2 - 40, 4, W2 / 2, H2 - 40, 90); fg.addColorStop(0, 'rgba(255,200,120,0.9)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = fg; c.fillRect(0, 0, W2, H2);
      c.fillStyle = '#ffd38a'; c.beginPath(); c.moveTo(W2 / 2 - 12, H2 - 28); c.quadraticCurveTo(W2 / 2, H2 - 70, W2 / 2 + 12, H2 - 28); c.fill();
      [[-100, 0.9], [-50, 1], [50, 1.05], [100, 0.85]].forEach(([dx, s2], i) => figur(W2 / 2 + dx, H2 - 30, s2, `rgba(${150 + i * 10},${190 + i * 8},210,0.85)`));
    } else if (nr === 2) {
      // einer steckt heimlich einen Kristall ein
      figur(W2 / 2 - 60, H2 - 26, 1.05, 'rgba(160,190,205,0.8)');
      c.save(); c.shadowColor = '#7ff2c6'; c.shadowBlur = 16; c.fillStyle = '#9fffe0';
      c.beginPath(); c.moveTo(W2 / 2 - 34, H2 - 76); c.lineTo(W2 / 2 - 28, H2 - 62); c.lineTo(W2 / 2 - 34, H2 - 54); c.lineTo(W2 / 2 - 40, H2 - 62); c.fill(); c.restore();
      figur(W2 / 2 + 90, H2 - 30, 0.75, 'rgba(120,150,165,0.45)');
    } else {
      // ein Ritter stellt sich in den Weg, grünes Licht dahinter
      const gl2 = c.createRadialGradient(W2 / 2 + 50, H2 - 70, 4, W2 / 2 + 50, H2 - 70, 120); gl2.addColorStop(0, 'rgba(110,255,170,0.75)'); gl2.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gl2; c.fillRect(0, 0, W2, H2);
      figur(W2 / 2 - 50, H2 - 26, 1, 'rgba(160,190,205,0.8)');
      figur(W2 / 2 + 40, H2 - 26, 1.25, 'rgba(210,235,225,0.9)', 6);
      c.strokeStyle = 'rgba(220,245,235,0.9)'; c.lineWidth = 4; c.beginPath(); c.moveTo(W2 / 2 + 10, H2 - 60); c.lineTo(W2 / 2 - 20, H2 - 64); c.stroke();
    }
    // ovaler Rand wie ein Spiegel
    c.globalCompositeOperation = 'destination-in';
    c.beginPath(); c.ellipse(W2 / 2, H2 / 2, W2 / 2 - 4, H2 / 2 - 4, 0, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  function erinnerungZeigen(r) {
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-erinnerung">
      <canvas class="rg-erinnerung-bild" width="320" height="170" aria-label="Ein Bild aus der Vergangenheit"></canvas>
      ${r.text.map(t => `<p>${t}</p>`).join('')}
      <p class="rg-klein-text">Erinnerung ${r.gesehen} von ${r.alle}</p>
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Weiter</button></div></div>`;
    $tafel.dataset.text = r.text.join(' ');
    erinnerungMalen($tafel.querySelector('canvas').getContext('2d'), r.bild);
  }
  function notizZeigen(id) {
    const n = R.NOTIZEN[id];
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-notiz ${n.von === 'Senna' ? 'senna' : ''}">
      <h2>${n.titel}</h2>
      ${n.text.map(t => `<p>${t}</p>`).join('')}
      ${(n.antwort || []).map(([wer, was]) => `<p class="rg-antwort"><b>${wer}:</b> „${was}“</p>`).join('')}
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Weiter</button></div></div>`;
    $tafel.dataset.text = n.text.join(' ') + ' ' + (n.antwort || []).map(([w, x]) => `${w}: ${x}`).join(' ');
  }
  function tagebuchZeigen() {
    const gh = R.geheimnisStand(s);
    const notizen = s.notizen.map(id => R.NOTIZEN[id]).filter(Boolean);
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-tagebuch">
      <h2>Tagebuch</h2>
      <h3>Geheimnisse: ${etage.name}</h3>
      <p class="rg-geheim-stand">${gh.gefunden} von ${gh.gesamt} gefunden${gh.gefunden < gh.gesamt ? `. ${gh.gesamt - gh.gefunden} fehlen noch.` : '. Alle!'}</p>
      <ul class="rg-geheim-liste">${gh.liste.map(g => `<li class="${g.gefunden ? 'ja' : ''}">${g.gefunden ? '✦ ' + g.name : '? ? ?'}</li>`).join('')}</ul>
      ${s.herzrunen.length ? `<h3>Herzrunen</h3><p>${s.herzrunen.map(r => R.HERZRUNEN[r]).join(', ')}</p>` : ''}
      <h3>Notizen</h3>
      ${notizen.length ? notizen.map(n => `<details><summary>${n.titel}</summary>${n.text.map(t => `<p>${t}</p>`).join('')}</details>`).join('') : '<p>Noch keine.</p>'}
      <div class="rg-tafel-knoepfe"><button class="rg-haupt" data-a="tafelZu">Zurück</button></div></div>`;
    $tafel.dataset.text = '';
  }
  // Beutel und Heldenbogen: Werte, Punkte verteilen, Ausrüstung anlegen, Tränke trinken
  let beutelWahl = null;   // { quelle: 'beutel', id } oder { quelle: 'held', held, platz }
  const wertText = (h) => `Kraft ${A.wert(h, 'kraft')} · Schutz ${A.wert(h, 'schutz')} · Magie ${A.wert(h, 'magie')}`;
  function beutelZeigen() {
    const kampf = !!s.kampf;
    const wahl = beutelWahl;
    const held = (h) => {
      const kw = A.kampfwerte(h);
      return `<div class="rg-bogen-held">
        <div class="rg-bogen-kopf"><b>${h.name}</b><span>Stufe ${h.stufe} · ${h.leben}/${h.max} Leben${h.id === 'ilo' ? ` · ${h.mana}/${h.manaMax} Mana` : ''}</span></div>
        <div class="rg-bogen-werte">${wertText(h)}</div>
        <div class="rg-bogen-klein">Schlag ${kw.schlag[0]}–${kw.schlag[1]}${kw.funke ? ` · Funke ${kw.funke[0]}–${kw.funke[1]} · Heilen ${kw.heilen}` : ''}${kw.abwehr ? ` · fängt ${kw.abwehr} ab` : ''}</div>
        ${h.punkte ? `<div class="rg-bogen-punkte"><span>${h.punkte} ${h.punkte === 1 ? 'Punkt' : 'Punkte'} verteilen:</span>${A.WERTE.map(w => `<button class="rg-klein" data-a="punkt" data-held="${h.id}" data-wert="${w}">+ ${A.WERT_NAME[w]}</button>`).join('')}</div>` : ''}
        <div class="rg-plaetze">${A.PLAETZE.map(p => {
          const d = h.ausruestung[p];
          const an = wahl && wahl.quelle === 'held' && wahl.held === h.id && wahl.platz === p;
          return `<button class="rg-platz ${d ? '' : 'leer'} ${an ? 'an' : ''}" data-a="platz" data-held="${h.id}" data-platz="${p}"><small>${A.PLATZ_NAME[p]}</small><span>${d ? A.KATALOG[d.typ].name : '–'}</span></button>`;
        }).join('')}</div>
      </div>`;
    };
    const beutel = s.beutel.map(d => {
      const k = A.KATALOG[d.typ];
      const besser = R.besserFuer(s, d.typ);
      const an = wahl && wahl.quelle === 'beutel' && wahl.id === d.id;
      return `<button class="rg-ding ${an ? 'an' : ''}" data-a="ding" data-id="${d.id}"><span>${k.name}</span>${besser.length ? `<i class="rg-besser">▲ ${besser.map(x => x === 'rana' ? 'R' : 'I').join(' ')}</i>` : ''}</button>`;
    }).join('') + Array.from({ length: Math.max(0, A.BEUTEL_PLAETZE - s.beutel.length) }, () => '<span class="rg-ding leer"></span>').join('');
    $voll.hidden = false;
    $voll.innerHTML = `<div class="rg-tafel-innen rg-beutel">
      <h2>Heldenbogen und Beutel</h2>
      <div class="rg-bogen">${s.helden.map(held).join('')}</div>
      <h3>Gemeinsamer Beutel</h3>
      <div class="rg-beutel-gitter">${beutel}</div>
      <div class="rg-auswahl">${auswahlHtml(kampf)}</div>
      <div class="rg-tafel-knoepfe"><button class="rg-haupt" data-a="beutelZu">Fertig</button></div></div>`;
  }
  function auswahlHtml(kampf) {
    const w = beutelWahl;
    if (!w) return '<p class="rg-klein-text">Tippe auf ein Teil. ▲ heißt: besser für Rana (R) oder Ilo (I).</p>';
    if (w.quelle === 'held') {
      const h = s.helden.find(x => x.id === w.held), d = h.ausruestung[w.platz];
      if (!d) return `<p class="rg-klein-text">${h.name}: Platz ${A.PLATZ_NAME[w.platz]} ist leer.</p>`;
      const k = A.KATALOG[d.typ];
      return `<b>${k.name}</b><p>${k.text}</p>${werteText(k)}<div class="rg-tafel-knoepfe">${kampf ? '<span class="rg-klein-text">Im Kampf geht das nicht.</span>' : `<button class="rg-klein" data-a="ablegen">In den Beutel</button>`}</div>`;
    }
    const d = s.beutel.find(x => x.id === w.id);
    if (!d) return '';
    const k = A.KATALOG[d.typ];
    let knoepfe = '', vergleich = '';
    if (k.art === 'trank') {
      knoepfe = s.helden.filter(h => k.wirkung.leben || h.id === 'ilo').map(h => `<button class="rg-klein" data-a="trinken" data-held="${h.id}">${h.name} trinkt</button>`).join('');
    } else {
      for (const h of s.helden) {
        const v = A.vergleich(h, d.typ);
        if (!v) { vergleich += `<p class="rg-vergleich nein">${h.name}: passt nicht.</p>`; continue; }
        const teile = A.WERTE.filter(x => v.werte[x].vorher !== v.werte[x].nachher).map(x => {
          const a = v.werte[x].vorher, b = v.werte[x].nachher;
          return `${A.WERT_NAME[x]} ${a} → <b class="${b > a ? 'plus' : 'minus'}">${b} ${b > a ? '▲' : '▼'}</b>`;
        });
        vergleich += `<p class="rg-vergleich">${h.name}${v.alt ? ` (statt ${A.KATALOG[v.alt].name})` : ''}: ${teile.length ? teile.join(' · ') : 'gleich stark'}</p>`;
        if (!kampf) knoepfe += `<button class="rg-klein" data-a="anlegen" data-held="${h.id}">${h.name} legt an</button>`;
      }
      if (kampf) knoepfe = '<span class="rg-klein-text">Ausrüstung wechseln geht nach dem Kampf.</span>';
    }
    return `<b>${k.name}</b><p>${k.text}</p>${werteText(k)}${vergleich}<div class="rg-tafel-knoepfe">${knoepfe}</div>`;
  }
  function werteText(k) {
    const w = Object.entries(k.werte || {}).map(([x, n]) => `${A.WERT_NAME[x]} +${n}`);
    if (k.faehigkeit) w.push(`${A.FAEHIGKEITEN[k.faehigkeit].name}: ${A.FAEHIGKEITEN[k.faehigkeit].text} (einmal je Kampf)`);
    return w.length ? `<p class="rg-klein-text">${w.join(' · ')}</p>` : '';
  }

  function tafelZeigen(text, mitRunen) {
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen">
      ${text.map(t => `<p>${t}</p>`).join('')}
      ${mitRunen ? `<canvas class="rg-tafel-runen" width="300" height="90" aria-label="Runen"></canvas>` : ''}
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Weiter</button></div></div>`;
    if (mitRunen) {
      const c = $tafel.querySelector('canvas').getContext('2d');
      const folge = etage.runenFolge || [etage.herzrune];
      folge.forEach((r, i) => runeZeichnen(c, r, 150 + (i - (folge.length - 1) / 2) * 90, 45, 28, '#5FE8B4', 6));
    }
    $tafel.dataset.text = text.join(' ');
  }
  function vorlesen(text) {
    try {
      if (!window.speechSynthesis) { sag('Vorlesen geht hier leider nicht.'); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = 0.92;
      speechSynthesis.speak(u);
    } catch (e) { sag('Vorlesen geht hier leider nicht.'); }
  }

  // Kampf
  function handeln(held, aktion, ziel) {
    if (gegnerAmZug) return;
    const kg = s.kampf ? s.gegner.find(x => x.id === s.kampf.gegner) : null;
    const vorher = kg ? { id: kg.id, typ: kg.typ, x: kg.x, y: kg.y } : null;
    const ev = R.heldHandelt(s, held, aktion, Math.random, ziel);
    if (!ev) return;
    if (ev.schaden) {
      zahl('−' + ev.schaden, 'treffer', 50 + (Math.random() - 0.5) * 16, 34); blitz = 0.25;
      if (vorher && !ev.sieg) animStarten(vorher.id, 'treffer');
    }
    if (ev.kael) zahl('Kael −' + ev.kael, 'treffer', 50, 48);
    if (ev.sieg && vorher) siegZeigen(vorher, ev.sieg);
    if (ev.faehigkeit) {
      const f = A.FAEHIGKEITEN[ev.faehigkeit];
      blitz = 0.7;
      if (ev.faehigkeit === 'frost') sag(`${f.name}! Der Gegner erstarrt.`, 2400);
      else if (ev.faehigkeit === 'schild') sag(`${f.name}! Ein Schild aus Licht legt sich um die Gruppe.`, 2400);
      else if (ev.faehigkeit === 'licht') { sag(`${f.name}! Warmes Licht heilt beide.`, 2400); for (const [id2, n] of Object.entries(ev.licht)) if (n) zahl('+' + n, 'heil', id2 === 'rana' ? 25 : 75, 70); }
      else if (ev.faehigkeit === 'glut' && !ev.sieg) sag(`${f.name}!`, 1600);
    }
    if (ev.geheilt) zahl('+' + ev.geheilt, 'heil', ev.ziel === 'rana' ? 25 : 75, 70);
    gruppeZeigen();
    if (ev.gegenzug && vorher) gegnerSchlaegtZu(vorher.id, ev.gegenzug, 500);
    if (!$voll.hidden) beutelZeigen();
    sichern();
  }
  // Ein Gegner ist besiegt: Zerfall (außer Ritter und Herz), Meldung, Begegnungen
  function siegZeigen(vorher, sieg) {
    anims.delete(vorher.id);
    melden('rg_sieg', { gegner: sieg.gegner });
    if (sieg.kael) {
      sag('Die Kristallhülle springt auf. Heraus stolpert ein Mann. Erschöpft, aber heil.', 4000);
      setTimeout(() => sprechen([['Kael', 'Zwanzig Jahre. Und ihr seid trotzdem gekommen.'], ['Ilo', 'Senna wartet. Hilfst du uns?'], ['Kael', 'Deshalb bin ich hier unten geblieben.']]), 3000);
      return;
    }
    if (sieg.herz) {
      blitz = 1; dunkelBlitz = 0.3;
      sag('Die Ringe zerspringen! Vier Splitter fallen zu Boden. Das Herz hängt noch an vier Ketten.', 4600);
      return;
    }
    sterbende.push({ ...vorher, start: zeit || performance.now() });
    const gg = R.GEGNER[sieg.gegner];
    sag(`${gg.name} ist besiegt! +${sieg.erfahrung} Erfahrung.` + (sieg.stufeAuf.length ? ' Eine neue Stufe!' : ''), 3200);
    if (sieg.knien) ritterKniet(vorher, sieg.knien);
  }
  // Begegnung mit Kael (Hohler Ritter) vor dem Herz
  function kaelBegegnung() {
    const mit = R.besitzt(s, 'ruheamulett');
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-gespraech">
      <h2>Der Hohle Ritter</h2>
      <p>Der Ritter aus Metall versperrt den Weg zum Herz. Seine Hände zittern.</p>
      <p>Er kämpft gegen seinen Willen.</p>
      ${mit ? '<p><b>Ilo:</b> „Das Amulett! Vielleicht erkennt er es.“</p>' : ''}
      <div class="rg-tafel-knoepfe">${mit ? '<button class="rg-klein" data-a="tafelZu">Kämpfen</button><button class="rg-haupt" data-a="amulett">Amulett zeigen</button>' : '<button class="rg-haupt" data-a="tafelZu">Kämpfen</button>'}</div></div>`;
    $tafel.dataset.text = 'Der Ritter aus Metall versperrt den Weg zum Herz. Seine Hände zittern. Er kämpft gegen seinen Willen.';
  }
  // Der Gegner holt aus und stößt zu; im Moment des Zustoßens trifft er einen Helden
  let gegnerAmZug = false;
  function gegnerSchlaegtZu(gegnerId, gz, warte) {
    gegnerAmZug = true;
    wurzel.classList.add('gegner-am-zug');
    if (gz.frost) {   // erstarrt: kein Angriff
      setTimeout(() => { gegnerAmZug = false; wurzel.classList.remove('gegner-am-zug'); sag('Der Gegner ist erstarrt und setzt aus.', 2000); gruppeZeigen(); }, warte);
      return;
    }
    setTimeout(() => {
      animStarten(gegnerId, 'angriff');
      setTimeout(() => {
        gegnerAmZug = false; wurzel.classList.remove('gegner-am-zug');
        gegenzugZeigen(gz);
      }, ruhig() ? 0 : W.DAUER.angriff * 470);
    }, warte);
  }
  function gegenzugZeigen(gz) {
    const el = wurzel.querySelector(`.rg-held[data-held="${gz.ziel}"]`);
    if (el) { el.classList.remove('getroffen'); void el.offsetWidth; el.classList.add('getroffen'); }
    if (gz.schild) sag('Der Kristallschild fängt den Treffer ab.', 2000);
    zahl(gz.schild ? '0' : '−' + gz.schaden, gz.schild ? 'heil' : 'aua', gz.ziel === 'rana' ? 25 : 75, 72);
    if (gz.besiegt) {
      sag('Alles wird dunkel … Ihr wacht am Eingang wieder auf. Nichts ist verloren.', 4200);
      melden('rg_besiegt', {});
      kameraSetzen(); dunkelBlitz = 1;
      R.sichtMerken(s);
    }
    gruppeZeigen(); sichern();
  }

  // Weiter nach unten: frei, kaufbar oder noch zu teuer
  function weiterHtml(nr) {
    const naechste = R.ETAGEN[nr];
    const nochmal = '<button class="rg-klein" data-a="nochmal">Noch einmal spielen</button>';
    if (etageFrei(nr)) return `<div class="rg-tafel-knoepfe">${nochmal}<button class="rg-haupt" data-a="weiter">Weiter: ${naechste.name}</button></div>`;
    const inf = ETG.info(nr);
    if (!inf) return `<p class="rg-klein-text">Weitere Etagen folgen.</p><div class="rg-tafel-knoepfe">${nochmal}</div>`;
    if (!inf.fehlt) return `<p>Die Treppe nach unten ist versiegelt. Etage ${nr + 1} kostet ${inf.preis} Runensplitter. Du hast genug!</p><div class="rg-tafel-knoepfe">${nochmal}<button class="rg-haupt" data-a="kaufen" data-etage="${nr}">Öffnen: ${inf.preis} Runensplitter</button></div>`;
    return `<p>Die Treppe nach unten ist versiegelt. Etage ${nr + 1} kostet ${inf.preis} Runensplitter. Dir fehlen noch ${inf.fehlt}. Die gibt es bei den Aufgaben.</p><div class="rg-tafel-knoepfe">${nochmal}</div>`;
  }
  function geschafft() {
    melden('rg_etage', { etage: s.etage, besiegt: s.besiegt });
    const gh = R.geheimnisStand(s);
    const naechste = R.ETAGEN[s.etage + 1];
    const rune = etage.herzrune;
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-ende">
      <h2>${etage.name}: geschafft!</h2>
      ${rune ? `<canvas class="rg-tafel-runen" width="300" height="90" aria-label="Herzrune ${R.HERZRUNEN[rune]}"></canvas><p>Herzrune <b>${R.HERZRUNEN[rune]}</b> gefunden.</p>` : ''}
      <h3>Geheimnisse: ${gh.gefunden} von ${gh.gesamt}</h3>
      <ul class="rg-geheim-liste">${gh.liste.map(g => `<li class="${g.gefunden ? 'ja' : ''}">${g.gefunden ? '✦ ' + g.name : '? ? ?'}</li>`).join('')}</ul>
      <p>${gh.gefunden < gh.gesamt ? `${gh.gesamt - gh.gefunden} ${gh.gesamt - gh.gefunden === 1 ? 'Geheimnis fehlt' : 'Geheimnisse fehlen'} noch. Du kannst die Etage noch einmal spielen.` : 'Du hast alle Geheimnisse gefunden!'}</p>
      ${naechste ? weiterHtml(s.etage + 1) : '<p class="rg-klein-text">Weitere Etagen folgen.</p>'}
      </div>`;
    $tafel.dataset.text = '';
    if (rune) runeZeichnen($tafel.querySelector('canvas').getContext('2d'), rune, 150, 45, 30, '#5FE8B4', 6);
  }
  // ---------- Etagen in der App: freischalten mit Runensplittern ----------
  const ETG = opt.etagen || null;      // { frei(nr), info(nr) → { preis, fehlt, fertig }, kaufen(nr) → bool }
  const SPL = opt.splitter || null;    // { stand(), bezahlen(n, grund) → bool }
  const etageFrei = (nr) => !ETG || ETG.frei(nr);

  // ---------- Hilfen vom Kobold ----------
  let koboldTipp = '';
  function koboldZeigen() {
    const P = R.HILFE_PREISE;
    const stand = SPL ? SPL.stand() : null;
    const preisTipp = s.gratisTipp ? 0 : P.tipp;
    const kann = (n) => !SPL || SPL.test || stand >= n;
    const knopf = (art, n, text, aus) => `<button class="rg-hilfe" data-a="koboldHilfe" data-art="${art}" ${aus || !kann(n) ? 'disabled' : ''}><b>${text}</b><span>${n ? `${n} Runensplitter` : 'gratis'}</span></button>`;
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-kobold">
      <h2>Der alte Kobold</h2>
      <p>„Hm. Brauchst du Hilfe? Hilfe kostet. Ein bisschen.“</p>
      ${SPL && !SPL.test ? `<p class="rg-klein-text">Du hast ${stand} Runensplitter.</p>` : `<p class="rg-klein-text">${SPL ? 'Testmodus' : 'Vorschau'}: Hilfen kosten hier nichts.</p>`}
      <div class="rg-hilfen">
        ${knopf('tipp', preisTipp, 'Was muss ich tun?', false)}
        ${knopf('spur', P.spur, 'Spur zu einem Geheimnis', !R.spurMoeglich(s))}
        ${knopf('trank', P.trank, 'Ein Heiltrank', !!s.kampf || s.beutel.length >= A.BEUTEL_PLAETZE)}
      </div>
      ${koboldTipp ? `<p class="rg-kobold-tipp">${koboldTipp}</p>` : ''}
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Danke</button></div></div>`;
    $tafel.dataset.text = koboldTipp || 'Brauchst du Hilfe? Hilfe kostet. Ein bisschen.';
  }
  function hilfeKaufen(art) {
    const P = R.HILFE_PREISE;
    const preis = art === 'tipp' ? (s.gratisTipp ? 0 : P.tipp) : P[art];
    if (art === 'spur' && !R.spurMoeglich(s)) return;
    if (art === 'trank' && (s.kampf || s.beutel.length >= A.BEUTEL_PLAETZE)) return;
    if (SPL && preis && !SPL.bezahlen(preis, art)) { sag('Dafür reichen die Runensplitter nicht.', 2000); return; }
    melden('rg_hilfe', { art, preis, etage: s.etage });
    if (art === 'tipp') { s.gratisTipp = false; koboldTipp = R.tippFuer(s); }
    else if (art === 'spur') { R.spurLegen(s); koboldTipp = 'Ich habe dir einen Kreis auf die Karte gemalt. Dort in der Nähe ist etwas versteckt.'; }
    else if (art === 'trank') { A.aufnehmen(s, 'heiltrank'); koboldTipp = 'Hier. Ein Heiltrank. Er liegt in deinem Beutel.'; }
    gruppeZeigen(); sichern(); koboldZeigen();
  }

  // ---------- Happy End ----------
  const ENDE = [
    { titel: 'Das Herz schlägt', text: ['Das Herz schlägt im richtigen Takt.', 'Licht strömt die Leitbahnen hinauf.', 'Alle Wächter bleiben stehen und werden still.'] },
    { titel: 'Senna', text: ['Senna tritt aus dem Kristall. Müde, aber gesund.', 'Sie umarmt Ilo.'], gespraech: [['Senna', 'Du bist gekommen.'], ['Kael', 'Zwanzig Jahre. Und ihr seid trotzdem gekommen.']] },
    { titel: 'Am Eingang', text: ['Oben wartet die alte Mira mit ihrer Karte. Neben ihr steht Doran.', 'Er hat die Kristalle all die Jahre aufbewahrt. Er gibt sie zurück.'], gespraech: [['Senna', 'Dann bringen wir sie gemeinsam zurück.']] },
    { titel: 'Morgenlicht', text: ['Der Schrein leuchtet wieder.', 'Ilo wird Hüter des Schreins. Rana bleibt Wächterin.', 'Das Herz schlägt. Der Schrein leuchtet. Und unten in der Gruft ist es zum ersten Mal seit zwanzig Jahren still.'] }
  ];
  function endeMalen(c, nr) {
    const W2 = c.canvas.width, H2 = c.canvas.height;
    const himmel = [['#10202a', '#06090c'], ['#123026', '#06100c'], ['#1c2a3a', '#0a1018'], ['#f2c48a', '#5a6f8a']][nr];
    const gr = c.createLinearGradient(0, 0, 0, H2); gr.addColorStop(0, himmel[0]); gr.addColorStop(1, himmel[1]);
    c.fillStyle = gr; c.fillRect(0, 0, W2, H2);
    const figur = (x, y, s2, f, rock = false) => {
      c.save(); c.translate(x, y); c.scale(s2, s2); c.fillStyle = f;
      c.beginPath(); c.arc(0, -64, 9, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-11, -52); c.lineTo(11, -52); c.lineTo(rock ? 18 : 13, rock ? 4 : -10); c.lineTo(rock ? -18 : -13, rock ? 4 : -10); c.closePath(); c.fill();
      if (!rock) { c.fillRect(-10, -10, 7, 14); c.fillRect(3, -10, 7, 14); }
      c.restore();
    };
    if (nr === 0) {
      for (let i = 0; i < 4; i++) { c.strokeStyle = `rgba(110,255,190,${0.5 - i * 0.1})`; c.lineWidth = 3; c.beginPath(); c.arc(W2 / 2, H2 / 2, 30 + i * 22, 0, 7); c.stroke(); }
      c.save(); c.shadowColor = '#5FE8B4'; c.shadowBlur = 30; c.fillStyle = '#9dffd8'; c.beginPath(); c.moveTo(W2 / 2, H2 / 2 - 28); c.lineTo(W2 / 2 + 18, H2 / 2); c.lineTo(W2 / 2, H2 / 2 + 28); c.lineTo(W2 / 2 - 18, H2 / 2); c.fill(); c.restore();
      c.strokeStyle = 'rgba(110,255,190,0.6)'; c.lineWidth = 2;
      for (const x of [20, 70, W2 - 70, W2 - 20]) { c.beginPath(); c.moveTo(x, H2); c.lineTo(x + (W2 / 2 - x) * 0.3, 0); c.stroke(); }
    } else if (nr === 1) {
      const gl2 = c.createRadialGradient(W2 / 2, H2 / 2, 5, W2 / 2, H2 / 2, 140); gl2.addColorStop(0, 'rgba(160,255,210,0.6)'); gl2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl2; c.fillRect(0, 0, W2, H2);
      figur(W2 / 2 - 8, H2 - 18, 1.05, 'rgba(230,250,240,0.95)', true);   // Senna
      figur(W2 / 2 + 14, H2 - 18, 0.9, 'rgba(160,215,200,0.95)');         // Ilo
      figur(W2 / 2 - 90, H2 - 18, 1.1, 'rgba(200,170,120,0.85)');         // Rana
      figur(W2 / 2 + 92, H2 - 18, 1.15, 'rgba(170,180,190,0.85)');        // Kael
    } else if (nr === 2) {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, H2 - 30, W2, 30);
      figur(70, H2 - 22, 0.95, 'rgba(210,200,170,0.9)', true);            // Mira
      c.fillStyle = 'rgba(230,210,160,0.9)'; c.fillRect(84, H2 - 70, 24, 18);   // Karte
      figur(130, H2 - 22, 1, 'rgba(170,160,150,0.9)');                     // Doran
      c.save(); c.shadowColor = '#5FE8B4'; c.shadowBlur = 14; c.fillStyle = '#9dffd8'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(152 + i * 9, H2 - 52 + (i % 2) * 4, 4, 0, 7); c.fill(); } c.restore();
      figur(W2 - 120, H2 - 22, 1.05, 'rgba(230,250,240,0.95)', true);
      figur(W2 - 70, H2 - 22, 0.9, 'rgba(160,215,200,0.95)');
    } else {
      const sonne = c.createRadialGradient(W2 / 2, H2 - 30, 10, W2 / 2, H2 - 30, 160); sonne.addColorStop(0, 'rgba(255,240,200,0.95)'); sonne.addColorStop(1, 'rgba(255,200,140,0)'); c.fillStyle = sonne; c.fillRect(0, 0, W2, H2);
      // Schrein
      c.fillStyle = '#2a3440'; c.fillRect(W2 / 2 - 40, H2 - 100, 80, 80); c.beginPath(); c.moveTo(W2 / 2 - 52, H2 - 100); c.lineTo(W2 / 2, H2 - 136); c.lineTo(W2 / 2 + 52, H2 - 100); c.fill();
      c.save(); c.shadowColor = '#5FE8B4'; c.shadowBlur = 24; c.fillStyle = '#9dffd8'; c.beginPath(); c.arc(W2 / 2, H2 - 70, 12, 0, 7); c.fill(); c.restore();
      [[-130, 1, false], [-90, 0.95, true], [90, 0.9, false], [130, 1.05, true], [168, 1.1, false]].forEach(([dx, s2, r2]) => figur(W2 / 2 + dx, H2 - 16, s2, 'rgba(40,46,60,0.92)', r2));
    }
  }
  function endeSeite(i) {
    if (i >= ENDE.length) { endeUebersicht(); return; }
    const e = ENDE[i];
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-ende-bild">
      <canvas class="rg-erinnerung-bild" width="320" height="130" aria-label="${e.titel}"></canvas>
      <h2>${e.titel}</h2>
      ${e.text.map(t => `<p>${t}</p>`).join('')}
      ${(e.gespraech || []).map(([w, x]) => `<p><b>${w}:</b> „${x}“</p>`).join('')}
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="ende" data-seite="${i + 1}">Weiter</button></div></div>`;
    $tafel.dataset.text = e.text.join(' ') + ' ' + (e.gespraech || []).map(([w, x]) => `${w}: ${x}`).join(' ');
    endeMalen($tafel.querySelector('canvas').getContext('2d'), i);
  }
  function endeUebersicht() {
    let summe = 0, gesamt = 0;
    const zeilen = R.ETAGEN.map((e, i) => { const st = R.geheimnisStand(s, i); summe += st.gefunden; gesamt += st.gesamt; return `<li class="${st.gefunden === st.gesamt ? 'ja' : ''}">${i + 1}. ${e.name}: ${st.gefunden} von ${st.gesamt}</li>`; }).join('');
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen rg-ende">
      <h2>Die Runengruft ist gerettet!</h2>
      <canvas class="rg-tafel-runen" width="300" height="70" aria-label="Die fünf Herzrunen"></canvas>
      <h3>Geheimnisse: ${summe} von ${gesamt}</h3>
      <ul class="rg-geheim-liste">${zeilen}</ul>
      <p>${summe < gesamt ? `${gesamt - summe} Geheimnisse fehlen noch. Jede Etage kannst du noch einmal spielen.` : 'Du hast alle Geheimnisse gefunden!'}</p>
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="springen" data-etage="0">Etage 1 noch einmal</button><button class="rg-haupt" data-a="nochmal">Herzkammer noch einmal</button></div></div>`;
    const c = $tafel.querySelector('canvas').getContext('2d');
    R.ETAGEN[4].runenFolge.forEach((r, i) => runeZeichnen(c, r, 30 + i * 60, 35, 20, '#5FE8B4', 4));
  }
  // Eine Etage betreten: weiter nach unten oder noch einmal
  const ETAGE_START = [
    ['Tief unter dem Schrein liegt eine alte Gruft.', 'Rana und Ilo steigen hinab. Sie suchen die Runenquelle.', 'Tippe im Bild auf alles, was dir auffällt.'],
    ['Die Treppe endet in einem großen Raum.', 'Hier stehen alte Zelte. Jemand hat hier gewohnt.', 'Die Tore sind dunkel. Ihnen fehlt Kraft.']
  ];
  function etageWechseln(nr) {
    const neu = R.etageBetreten(s, nr);
    if (!neu) return;
    s = neu;
    etageVorbereiten(); kameraSetzen(); R.sichtMerken(s); erscheinung = null;
    gruppeZeigen(); sichern();
    const text = R.ETAGEN[nr].einstieg || ETAGE_START[nr] || [R.ETAGEN[nr].name];
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen"><h2>Etage ${nr + 1}: ${R.ETAGEN[nr].name}</h2>${text.map(t => `<p>${t}</p>`).join('')}
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Los geht's</button></div></div>`;
    $tafel.dataset.text = text.join(' ');
  }

  function hilfeZeigen() {
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen">
      <h2>So geht's</h2>
      <p>Lauf mit den Pfeilen. Oder wisch über das Bild.</p>
      <p>Tippe im Bild auf Dinge an der Wand: Hebel, Tafeln, Runen, Schlösser.</p>
      <p>Manche Steine sind Knöpfe. Schau genau hin.</p>
      <p>Kommt ein Gegner, handeln Rana und Ilo nacheinander. Dann schlägt der Gegner zurück.</p>
      <p>Jede Etage hat Geheimnisse. Im Tagebuch steht, wie viele noch fehlen.</p>
      <p>Steckst du fest? Tippe oben auf „Kobold“.</p>
      <p class="rg-klein-text">${ETG ? 'Etage wählen' : 'Vorschau: direkt zu einer Etage springen'}</p>
      <div class="rg-tafel-knoepfe">${R.ETAGEN.map((e, i) => etageFrei(i) ? `<button class="rg-klein" data-a="springen" data-etage="${i}">${i + 1}: ${e.name}</button>` : '').join('')}</div>
      <div class="rg-tafel-knoepfe">${ETG ? '' : '<button class="rg-klein" data-a="neu">Neu beginnen</button>'}<button class="rg-haupt" data-a="tafelZu">Weiter</button></div></div>`;
  }

  function karteZeigen(auf) {
    karteC.hidden = !auf;
    if (!auf) return;
    const k = karteC.getContext('2d');
    const karte = R.etageVon(s).karte, h = karte.length, w = karte[0].length;
    const z = Math.floor(Math.min(BREITE / (w + 1), HOEHE / (h + 1)));
    const ox = (BREITE - w * z) / 2, oy = (HOEHE - h * z) / 2;
    k.fillStyle = 'rgba(8,10,9,0.94)'; k.fillRect(0, 0, BREITE, HOEHE);
    const gesehen = new Set(s.gesehen);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!gesehen.has(`${x},${y}`)) continue;
      const c = karte[y][x], fx = ox + x * z, fy = oy + y * z;
      if (R.blockiert(s, x, y)) {
        k.fillStyle = 'DGQ'.includes(c) ? '#a08850' : c === 'W' ? '#5a4632' : '#3d4643';
        k.fillRect(fx, fy, z, z);
        if ('HP12345MK'.includes(c)) { k.fillStyle = '#5FE8B4'; k.fillRect(fx + z * 0.35, fy + z * 0.35, z * 0.3, z * 0.3); }
        if (c === 'F') { k.fillStyle = s.fassungenVoll.includes(`${x},${y}`) ? '#7ee8ff' : '#28485a'; k.beginPath(); k.arc(fx + z / 2, fy + z / 2, z * 0.28, 0, 7); k.fill(); }
      } else {
        k.fillStyle = '#1a201e'; k.fillRect(fx, fy, z, z);
        k.strokeStyle = 'rgba(255,255,255,0.04)'; k.strokeRect(fx, fy, z, z);
        const b = BAHN.get(`${x},${y}`);
        if (b) {
          k.strokeStyle = s.fassungenVoll.includes(b.fassung) ? '#6ee6ff' : 'rgba(80,140,170,0.35)'; k.lineWidth = 2;
          const m = [fx + z / 2, fy + z / 2];
          for (const [bit, dx, dy] of [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]) if (b.dirs & bit) { k.beginPath(); k.moveTo(...m); k.lineTo(m[0] + dx * z / 2, m[1] + dy * z / 2); k.stroke(); }
        }
        if (R.dekoAuf(s, x, y)) { k.fillStyle = '#5a4c38'; k.fillRect(fx + z * 0.2, fy + z * 0.2, z * 0.6, z * 0.6); }
        const sp = R.spiegelAuf(s, x, y);
        if (sp) { k.strokeStyle = '#cfe9f2'; k.lineWidth = 3; k.beginPath(); if (sp.stand === 0) { k.moveTo(fx + 3, fy + z - 3); k.lineTo(fx + z - 3, fy + 3); } else if (sp.stand === 1) { k.moveTo(fx + 3, fy + 3); k.lineTo(fx + z - 3, fy + z - 3); } else { k.arc(fx + z / 2, fy + z / 2, 3, 0, 7); } k.stroke(); }
        if (c === 'T') { k.fillStyle = '#c4a660'; for (let i = 0; i < 3; i++) k.fillRect(fx + 3, fy + 4 + i * z / 4, z - 6 - i * 4, 3); }
      }
    }
    // Spuren vom Kobold: goldene Kreise
    for (const sp of s.spuren || []) {
      k.save(); k.strokeStyle = '#e6c45a'; k.lineWidth = 3; k.setLineDash([6, 5]);
      k.beginPath(); k.arc(ox + (sp.x + 0.5) * z, oy + (sp.y + 0.5) * z, z * 1.6, 0, 7); k.stroke(); k.restore();
    }
    // Gruppe als Pfeil
    k.save(); k.translate(ox + (s.x + 0.5) * z, oy + (s.y + 0.5) * z); k.rotate(s.r * Math.PI / 2);
    k.fillStyle = '#7dffcb'; k.beginPath(); k.moveTo(0, -z * 0.4); k.lineTo(z * 0.3, z * 0.3); k.lineTo(-z * 0.3, z * 0.3); k.closePath(); k.fill();
    k.restore();
    k.fillStyle = '#9fb3aa'; k.font = '600 20px "Atkinson Hyperlegible", sans-serif'; k.textAlign = 'center';
    k.fillText('Tippe, um die Karte zu schließen', CX, HOEHE - 14);
  }

  // ---------- Eingaben ----------
  an(wurzel, 'click', (e) => {
    const el = e.target.closest('[data-a]');
    const held = e.target.closest('[data-held]');
    if (heilenWahl && held) { heilenWahl = false; handeln('ilo', 'heilen', held.dataset.held); return; }
    if (trankWahl && held) { trankWahl = false; const r = R.trankTrinken(s, held.dataset.held, 'heiltrank'); if (r) { zahl('+' + r.plus, 'heil', held.dataset.held === 'rana' ? 25 : 75, 70); sag('Der Trank wirkt.'); } else sag('Das geht gerade nicht. Die Leben sind schon voll.'); gruppeZeigen(); sichern(); return; }
    if (!el) return;
    const a = el.dataset.a;
    if (['vor', 'zurueck', 'links', 'rechts', 'drehL', 'drehR'].includes(a)) bewegung(a);
    else if (a === 'schlag') handeln('rana', 'schlag');
    else if (a === 'funke') handeln('ilo', 'funke');
    else if (a === 'heilen') { heilenWahl = true; gruppeZeigen(); sag('Wen soll Ilo heilen? Tippe auf Rana oder Ilo.'); }
    else if (a === 'warten') {
      if (gegnerAmZug) return;
      const kg = s.kampf && s.gegner.find(x => x.id === s.kampf.gegner);
      const vorher = kg ? { id: kg.id, typ: kg.typ, x: kg.x, y: kg.y } : null;
      const ev = R.abwarten(s);
      if (ev) {
        if (ev.kael) zahl('Kael −' + ev.kael, 'treffer', 50, 48);
        if (ev.sieg && vorher) siegZeigen(vorher, ev.sieg);
        gruppeZeigen();
        if (ev.gegenzug && vorher) gegnerSchlaegtZu(vorher.id, ev.gegenzug, 250);
        sichern();
      }
    }
    else if (a === 'amulett') {
      const r = R.amulettZeigen(s);
      if (r) {
        blitz = 1; melden('rg_amulett', {});
        sprechen([['Ilo', 'Kael! Erkennst du das? Es gehört Senna.'], ['Kael', 'Senna … Ich … Das Licht ist weg.'], ['Kael', 'Zwanzig Jahre. Und ihr seid trotzdem gekommen.'], ['Kael', 'Gegen das Herz kämpfe ich mit euch.']], 'Kael ist frei');
        geheimnisZeigen(r.geheimnis);
        gruppeZeigen(); sichern();
      }
    }
    else if (a === 'ende') endeSeite(Number(el.dataset.seite));
    else if (a === 'trank') { trankWahl = true; sag('Wer soll trinken? Tippe auf Rana oder Ilo.'); }
    else if (a === 'manatrank') { const r = R.trankTrinken(s, 'ilo', 'manatrank'); if (r) { zahl('+' + r.mana, 'mana', 75, 70); sag('Ilo trinkt. Das Mana kehrt zurück.'); } else sag('Ilos Mana ist schon voll.'); gruppeZeigen(); sichern(); }
    else if (a === 'faehigkeit') handeln(el.dataset.held, 'faehigkeit');
    else if (a === 'beutel') { beutelWahl = null; beutelZeigen(); }
    else if (a === 'beutelZu') { beutelWahl = null; $voll.hidden = true; gruppeZeigen(); }
    else if (a === 'ding') { beutelWahl = { quelle: 'beutel', id: el.dataset.id }; beutelZeigen(); }
    else if (a === 'platz') { beutelWahl = { quelle: 'held', held: el.dataset.held, platz: el.dataset.platz }; beutelZeigen(); }
    else if (a === 'anlegen') {
      const r = R.anlegen(s, el.dataset.held, beutelWahl.id);
      if (r.ok) { beutelWahl = null; sag(`${s.helden.find(h => h.id === el.dataset.held).name} ist neu ausgerüstet.`, 1800); melden('rg_anlegen', { platz: r.platz }); }
      else sag(r.grund === 'nicht_fuer' ? 'Das passt nicht.' : 'Das geht gerade nicht.', 1800);
      beutelZeigen(); gruppeZeigen(); sichern();
    }
    else if (a === 'ablegen') {
      const r = R.ablegen(s, beutelWahl.held, beutelWahl.platz);
      if (!r.ok) sag(r.grund === 'beutel_voll' ? 'Der Beutel ist voll.' : 'Das geht gerade nicht.', 1800); else beutelWahl = null;
      beutelZeigen(); gruppeZeigen(); sichern();
    }
    else if (a === 'trinken') {
      const d = s.beutel.find(x => x.id === beutelWahl.id);
      const r = d && R.trankTrinken(s, el.dataset.held, d.typ);
      if (r) { beutelWahl = null; sag('Der Trank wirkt.', 1600); } else sag('Das ist schon voll.', 1600);
      beutelZeigen(); gruppeZeigen(); sichern();
    }
    else if (a === 'punkt') { if (R.punktSetzen(s, el.dataset.held, el.dataset.wert)) { melden('rg_punkt', { wert: el.dataset.wert }); beutelZeigen(); gruppeZeigen(); sichern(); } }
    else if (a === 'nimm') nimm(Number(el.dataset.id));
    else if (a === 'tafelZu') { $tafel.hidden = true; try { speechSynthesis.cancel(); } catch (x) { /* egal */ } }
    else if (a === 'vorlesen') vorlesen($tafel.dataset.text || '');
    else if (a === 'karte') karteZeigen(karteC.hidden);
    else if (a === 'hilfe') hilfeZeigen();
    else if (a === 'stil') { stil = el.dataset.stil; try { localStorage.setItem('runengruft-stil', stil); } catch (x) { /* egal */ } stilZeigen(); sag('Bewegung: ' + STILE[stil].name, 1200); }
    else if (a === 'rundgang') rundgang();
    else if (a === 'neu') { if (demo) return; s = R.neuesSpiel(0); etageVorbereiten(); kameraSetzen(); R.sichtMerken(s); erscheinung = null; $tafel.hidden = true; gruppeZeigen(); sichern(); sag('Rana und Ilo steigen in die Runengruft hinab.'); }
    else if (a === 'weiter') { if (etageFrei(s.etage + 1)) etageWechseln(s.etage + 1); }
    else if (a === 'kaufen') { const nr = Number(el.dataset.etage); if (ETG && ETG.kaufen(nr)) { melden('rg_etage_frei', { etage: nr }); etageWechseln(nr); } else geschafft(); }
    else if (a === 'kobold') { if (!s.geschafft && $voll.hidden) { koboldTipp = ''; koboldZeigen(); } }
    else if (a === 'koboldHilfe') hilfeKaufen(el.dataset.art);
    else if (a === 'nochmal') etageWechseln(s.etage);
    else if (a === 'springen') { if (demo || s.kampf || !etageFrei(Number(el.dataset.etage))) return; etageWechseln(Number(el.dataset.etage)); }
    else if (a === 'tagebuch') { if (!s.geschafft) tagebuchZeigen(); }
  });
  let trankWahl = false;
  an(karteC, 'click', () => karteZeigen(false));

  // Wischen und Tippen im Bild
  let druck = null;
  an(bild, 'pointerdown', (e) => { druck = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  an(bild, 'pointerup', (e) => {
    if (!druck) return;
    const dx = e.clientX - druck.x, dy = e.clientY - druck.y;
    druck = null;
    if (Math.hypot(dx, dy) < 22) { bildGetippt(e.clientX, e.clientY); return; }
    if (Math.abs(dx) > Math.abs(dy)) bewegung(dx < 0 ? 'drehL' : 'drehR');
    else bewegung(dy < 0 ? 'vor' : 'zurueck');
  });
  an(window, 'keydown', (e) => {
    const m = { ArrowUp: 'vor', ArrowDown: 'zurueck', ArrowLeft: 'drehL', ArrowRight: 'drehR', w: 'vor', s: 'zurueck', a: 'links', d: 'rechts', q: 'drehL', e: 'drehR' }[e.key];
    if (m) { e.preventDefault(); bewegung(m); }
  });

  function stilZeigen() {
    $('.rg-stil-knoepfe').innerHTML = Object.entries(STILE).map(([k, v]) => `<button class="rg-chip ${k === stil ? 'an' : ''}" data-a="stil" data-stil="${k}" aria-pressed="${k === stil}">${v.name}</button>`).join('');
  }
  gruppeZeigen();
  schleife = requestAnimationFrame(tick);
  if (!opt.stand) {
    $tafel.hidden = false;
    $tafel.innerHTML = `<div class="rg-tafel-innen">
      <h2>Runengruft</h2>
      <p>Tief unter dem Schrein liegt eine alte Gruft.</p>
      <p>Rana und Ilo steigen hinab. Sie suchen die Runenquelle.</p>
      <p>Tippe im Bild auf alles, was dir auffällt.</p>
      <div class="rg-tafel-knoepfe"><button class="rg-klein" data-a="vorlesen">Vorlesen</button><button class="rg-haupt" data-a="tafelZu">Los geht's</button></div></div>`;
    $tafel.dataset.text = 'Tief unter dem Schrein liegt eine alte Gruft. Rana und Ilo steigen hinab. Sie suchen die Runenquelle. Tippe im Bild auf alles, was dir auffällt.';
  }

  return {
    beenden() { cancelAnimationFrame(schleife); aus.abort(); sichern(); },
    anhalten() { /* Kämpfe laufen in Runden: nichts zu tun */ },
    // Spielzeit läuft nicht, solange eine Tafel, eine Notiz oder der Beutel offen ist
    ruht: () => !$tafel.hidden || !$voll.hidden,
    stand: () => JSON.parse(JSON.stringify(s))
  };
}

// ---------- kleine Bilder ----------
function schwertSvg() { return `<svg viewBox="0 0 40 40"><path d="M20 4 L24 24 L16 24 Z" fill="#e8d9a8"/><rect x="11" y="24" width="18" height="4" rx="1" fill="#c4a660"/><rect x="18" y="28" width="4" height="8" fill="#6b4f2c"/></svg>`; }
function runeSvg() { return `<svg viewBox="0 0 40 40"><g stroke="#7dffcb" stroke-width="3" stroke-linecap="round" fill="none"><path d="M20 6 V34"/><path d="M10 12 L30 28"/><path d="M30 12 L10 28"/></g><circle cx="20" cy="20" r="4" fill="#7dffcb"/></svg>`; }
function trankSvg(f = '#3fbf8f') { return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="15" r="7" fill="${f}"/><rect x="9.5" y="3" width="5" height="6" fill="#c7b98a"/></svg>`; }
function schluesselSvg() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="12" r="4" fill="none" stroke="#5FE8B4" stroke-width="2.5"/><path d="M11 12 H21 M18 12 V16 M15 12 V15" stroke="#5FE8B4" stroke-width="2.5"/></svg>`; }
function kristallSvg(f) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L17 9 L14.5 21 H9.5 L7 9 Z" fill="${f}"/><path d="M12 2 V21 M7 9 L12 11 L17 9" stroke="rgba(255,255,255,.7)" stroke-width="1" fill="none"/></svg>`; }
function beutelSvg() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6 Q12 3 16 6 L15 8 Q19 11 19 16 Q19 21 12 21 Q5 21 5 16 Q5 11 9 8 Z" fill="#8a6a42"/><path d="M9 8 Q12 9.5 15 8" stroke="#3a2a18" stroke-width="1.5" fill="none"/><polygon points="12,12 14,15 12,18 10,15" fill="#7ff2c6"/></svg>`; }
function klingeSvg() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L14.5 15 H9.5 Z" fill="#9dffd8"/><rect x="7" y="15" width="10" height="2.5" fill="#c4a660"/><rect x="11" y="17.5" width="2" height="5" fill="#6b4f2c"/></svg>`; }
