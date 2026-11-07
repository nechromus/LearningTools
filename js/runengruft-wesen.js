// Runengruft: Gegner-Zeichnungen (Leinwand), gemeinsam für Spiel und Bestiarium.
// Jede Zeichnung malt um den Fußpunkt (0, 0), nach oben negativ, etwa 275 Einheiten je Feldhöhe × 1,1.
// ZEICHNER[id](ctx, zeitInSekunden, puls 0–1)
// ---------- Zeichnen, Fassung 2: filigran, schwebende Teile, Leuchtbahnen, Licht ----------
const FARBE = { obsidian: '#15191b', stein: '#2c3335', steinHell: '#6d7775', bronze: '#9a7438', bronzeHell: '#e6c27a', jade: '#5FE8B4', tuerkis: '#62e2f2', bernstein: '#ffb347', violett: '#b892ff', eis: '#bfefff' };
const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function mischen(a, b, k) { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const f = (s) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return `rgb(${f(16)},${f(8)},${f(0)})`; }
function zufall(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function pfad(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }
function leuchten(c, x, y, r, farbe, a = 0.5) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(farbe, a)); g.addColorStop(0.35, hexA(farbe, a * 0.35)); g.addColorStop(1, hexA(farbe, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
// Lichtschweif quer über einen hellen Punkt (Linsenreflex)
function reflex(c, x, y, l, farbe, a = 0.6) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(x - l, y, x + l, y);
  g.addColorStop(0, hexA(farbe, 0)); g.addColorStop(0.5, hexA('#ffffff', a)); g.addColorStop(1, hexA(farbe, 0));
  c.fillStyle = g; c.fillRect(x - l, y - 1.2, l * 2, 2.4);
  const g2 = c.createLinearGradient(x, y - l * 0.35, x, y + l * 0.35);
  g2.addColorStop(0, hexA(farbe, 0)); g2.addColorStop(0.5, hexA(farbe, a * 0.6)); g2.addColorStop(1, hexA(farbe, 0));
  c.fillStyle = g2; c.fillRect(x - 0.8, y - l * 0.35, 1.6, l * 0.7);
  c.restore();
}
// Platte: Verlauf, Fase, feine Gravur, Randlicht von oben
function platte(c, pts, o = {}) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const hell = o.hell || FARBE.steinHell, dunkel = o.dunkel || FARBE.obsidian;
  const g = c.createLinearGradient(x0, y0, x1 * 0.3 + x0 * 0.7, y1);
  g.addColorStop(0, hell); g.addColorStop(0.55, mischen(hell, dunkel, 0.6)); g.addColorStop(1, dunkel);
  pfad(c, pts); c.fillStyle = g; c.fill();
  // Gravur: feine Linien parallel zum Rand
  if (o.gravur !== false) {
    c.save(); pfad(c, pts); c.clip();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    c.beginPath(); pts.forEach(([x, y], i) => { const xx = cx + (x - cx) * 0.78, yy = cy + (y - cy) * 0.78; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); c.closePath(); c.stroke();
    c.strokeStyle = 'rgba(255,245,220,0.07)'; c.beginPath(); pts.forEach(([x, y], i) => { const xx = cx + (x - cx) * 0.78 + 0.8, yy = cy + (y - cy) * 0.78 + 0.8; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); c.closePath(); c.stroke();
    // Körnung
    const rnd = zufall(Math.floor(x0 * 7 + y0 * 13));
    for (let i = 0; i < (x1 - x0) * (y1 - y0) / 60; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.05)'; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1, 1); }
    c.restore();
  }
  // Umriss dunkel, Randlicht oben
  pfad(c, pts); c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 1.4; c.stroke();
  c.save(); pfad(c, pts); c.clip();
  const rl = c.createLinearGradient(0, y0, 0, y0 + (y1 - y0) * 0.35);
  rl.addColorStop(0, hexA(o.rand || '#fff4dc', 0.5)); rl.addColorStop(1, 'rgba(0,0,0,0)');
  c.strokeStyle = rl; c.lineWidth = 3; pfad(c, pts); c.stroke();
  c.restore();
  if (o.bronze) { pfad(c, pts); c.strokeStyle = hexA(FARBE.bronzeHell, 0.7); c.lineWidth = 1.2; c.stroke(); }
}
// Leuchtbahnen (Schaltkreis-Muster) innerhalb einer Fläche
function bahnen(c, pts, farbe, p, seed = 1, dichte = 6) {
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rnd = zufall(seed);
  c.save(); pfad(c, pts); c.clip();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < dichte; i++) {
    let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (rnd() < 0.5) x += (rnd() - 0.5) * (x1 - x0) * 0.6; else y += (rnd() - 0.5) * (y1 - y0) * 0.6;
      c.lineTo(x, y);
    }
    const a = 0.25 + 0.5 * p * (0.5 + 0.5 * Math.sin(i * 1.7 + p * 6));
    c.strokeStyle = hexA(farbe, a * 0.35); c.lineWidth = 4; c.stroke();
    c.strokeStyle = hexA(farbe, a); c.lineWidth = 1.1; c.stroke();
    c.fillStyle = hexA('#ffffff', a); c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
  }
  c.restore();
}
// Kristall mit Facetten
function kristall(c, x, y, w, h, farbe, glanz = 1, winkel = 0) {
  c.save(); c.translate(x, y); c.rotate(winkel);
  const spitze = [0, -h], ol = [-w * 0.5, -h * 0.58], or = [w * 0.5, -h * 0.6], ul = [-w * 0.38, 0], ur = [w * 0.4, 0], mi = [w * 0.06, -h * 0.5];
  c.save(); c.shadowColor = farbe; c.shadowBlur = 22 * glanz;
  pfad(c, [spitze, or, ur, ul, ol]); c.fillStyle = hexA(farbe, 0.85); c.fill(); c.restore();
  const facetten = [[[spitze, ol, mi], 0.95], [[spitze, mi, or], 0.55], [[ol, ul, mi], 0.45], [[mi, ul, ur], 0.25], [[mi, ur, or], 0.65]];
  for (const [f, l] of facetten) { pfad(c, f); c.fillStyle = mischen(farbe, l > 0.5 ? '#ffffff' : '#06120e', Math.abs(l - 0.5) * 1.3); c.globalAlpha = 0.85; c.fill(); }
  c.globalAlpha = 1;
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.8; pfad(c, [spitze, or, ur, ul, ol]); c.stroke();
  c.beginPath(); c.moveTo(...spitze); c.lineTo(...mi); c.lineTo(...ul); c.moveTo(...mi); c.lineTo(...ur); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.stroke();
  c.restore();
}
function kern(c, x, y, r, farbe, p, flare = true) {
  leuchten(c, x, y, r * 5, farbe, 0.28 + 0.2 * p);
  c.fillStyle = '#05080a'; c.beginPath(); c.arc(x, y, r * 1.35, 0, TAU); c.fill();
  c.strokeStyle = FARBE.bronzeHell; c.lineWidth = 1.5; c.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); c.lineTo(x + Math.cos(a) * r * 1.55, y + Math.sin(a) * r * 1.55); c.strokeStyle = hexA(FARBE.bronzeHell, 0.6); c.lineWidth = 1; c.stroke(); }
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, mischen(farbe, '#ffffff', 0.5)); g.addColorStop(0.8, farbe); g.addColorStop(1, hexA(farbe, 0.4));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * (0.92 + 0.08 * p), 0, TAU); c.fill();
  if (flare) reflex(c, x, y, r * 6, farbe, 0.45 + 0.3 * p);
}
function auge(c, x, y, w, farbe, p, flare = true) {
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = hexA(farbe, 0.25); c.beginPath(); c.ellipse(x, y, w * 1.4, w * 0.6, 0, 0, TAU); c.fill();
  c.fillStyle = hexA('#ffffff', 0.85); c.beginPath(); c.ellipse(x, y, w * 0.6, w * 0.18, 0, 0, TAU); c.fill();
  c.restore();
  if (flare) reflex(c, x, y, w * 3, farbe, 0.3 + 0.3 * p);
}
// Energiebogen (gezackt)
function bogen(c, x1, y1, x2, y2, farbe, t, a = 0.8) {
  const rnd = zufall(Math.floor(t * 20) + Math.floor(x1 * 3 + y2));
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
  const pts = [[x1, y1]];
  for (let i = 1; i < 7; i++) { const k = i / 7; pts.push([x1 + (x2 - x1) * k + (rnd() - 0.5) * 14, y1 + (y2 - y1) * k + (rnd() - 0.5) * 14]); }
  pts.push([x2, y2]);
  for (const [w, al] of [[5, 0.2], [1.4, 1]]) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = hexA(w > 2 ? farbe : '#ffffff', al * a); c.lineWidth = w; c.stroke(); }
  c.restore();
}
// Funken / Staub
function funken(c, t, n, seed, bereich, farbe, opt = {}) {
  const rnd = zufall(seed);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = bereich[0] + rnd() * bereich[2], v = 10 + rnd() * 30, ph = rnd();
    const lauf = ((t * v / bereich[3]) + ph) % 1;
    const y = opt.fallen ? bereich[1] + lauf * bereich[3] : bereich[1] + bereich[3] - lauf * bereich[3];
    const x = x0 + Math.sin(t * 1.3 + i) * 8;
    const a = Math.sin(lauf * Math.PI) * (opt.a || 0.8);
    c.fillStyle = hexA(farbe, a); c.beginPath(); c.arc(x, y, 0.8 + rnd() * 1.6, 0, TAU); c.fill();
  }
  c.restore();
}
// Glied (Stab zwischen zwei Gelenken) für filigrane Beine und Arme
function glied(c, a, b, dicke, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const d1 = dicke, d2 = dicke * (o.spitz ? 0.25 : 0.7);
  platte(c, [[a[0] + nx * d1, a[1] + ny * d1], [b[0] + nx * d2, b[1] + ny * d2], [b[0] - nx * d2, b[1] - ny * d2], [a[0] - nx * d1, a[1] - ny * d1]], { hell: o.hell || FARBE.steinHell, dunkel: o.dunkel, gravur: false, bronze: o.bronze });
  if (o.leucht) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(o.leucht, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.restore(); }
}
function gelenk(c, x, y, r, farbe, p) {
  c.fillStyle = '#0b0e0f'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = hexA(FARBE.bronzeHell, 0.8); c.lineWidth = 1.2; c.stroke();
  if (farbe) { c.fillStyle = hexA(farbe, 0.6 + 0.4 * p); c.beginPath(); c.arc(x, y, r * 0.45, 0, TAU); c.fill(); leuchten(c, x, y, r * 3, farbe, 0.25 * p + 0.1); }
}
// Energiespalt zwischen schwebenden Teilen
function spalt(c, x1, x2, y, farbe, p) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, y - 6, 0, y + 6); g.addColorStop(0, hexA(farbe, 0)); g.addColorStop(0.5, hexA(farbe, 0.5 + 0.3 * p)); g.addColorStop(1, hexA(farbe, 0));
  c.fillStyle = g; c.fillRect(x1, y - 6, x2 - x1, 12); c.restore();
}
function nebel(c, t, farbe, breite = 160, hoehe = 30, a = 0.18) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const x = Math.sin(t * 0.3 + i * 1.3) * breite * 0.6, y = -6 - (i % 3) * 8; const g = c.createRadialGradient(x, y, 0, x, y, breite * 0.5); g.addColorStop(0, hexA(farbe, a)); g.addColorStop(1, hexA(farbe, 0)); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, breite * 0.5, hoehe, 0, 0, TAU); c.fill(); }
  c.restore();
}
function schatten(c, r = 110) { const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r, r * 0.16, 0, 0, TAU); c.fill(); }

const ZEICHNER = {
  kernwaechter(c, t, p) {
    schatten(c, 120); nebel(c, t, FARBE.jade, 180, 24, 0.12);
    const s = Math.sin(t * 1.3) * 3;
    // Beine: schlank, Knieplatten
    for (const d of [-1, 1]) {
      const h = [d * 26, -150], k = [d * 34, -78], f = [d * 30, -4];
      glied(c, h, k, 7); glied(c, k, f, 6, { spitz: false });
      platte(c, [[d * 22, -96], [d * 46, -90], [d * 44, -66], [d * 24, -70]], { bronze: true, hell: '#7d6a45', dunkel: '#2a2112' });
      gelenk(c, k[0], k[1], 5, FARBE.jade, p);
      platte(c, [[d * 18, -4], [d * 44, -4], [d * 40, 2], [d * 16, 2]], { gravur: false });
    }
    // Becken
    platte(c, [[-36, -168 + s * 0.3], [36, -168 + s * 0.3], [26, -140], [-26, -140]], {});
    // Rumpf aus drei schwebenden Platten
    const r1 = -180 + s, r2 = -226 + s * 1.3, r3 = -268 + s * 1.6;
    spalt(c, -40, 40, r1 + 4, FARBE.jade, p); spalt(c, -50, 50, r2 + 4, FARBE.jade, p);
    const t1 = [[-44, r1 - 30], [44, r1 - 30], [34, r1], [-34, r1]];
    const t2 = [[-56, r2 - 36], [56, r2 - 36], [46, r2], [-46, r2]];
    const t3 = [[-62, r3 - 22], [62, r3 - 22], [70, r3 - 4], [50, r3 + 8], [-50, r3 + 8], [-70, r3 - 4]];
    for (const [pl, sd] of [[t1, 3], [t2, 5], [t3, 7]]) { platte(c, pl, {}); bahnen(c, pl, FARBE.jade, p, sd, 5); }
    kern(c, 0, r2 - 16, 11, FARBE.jade, p);
    // Arme: Schulterring, segmentiert, Kristallklingen als Finger
    for (const d of [-1, 1]) {
      const sh = [d * 74, r3 - 6 + Math.sin(t * 1.1 + d) * 3], el = [d * 92, r3 + 62], hd = [d * 86, r3 + 128 + Math.sin(t * 1.4 + d) * 4];
      platte(c, [[d * 58, r3 - 26], [d * 96, r3 - 30], [d * 102, r3 - 6], [d * 70, r3 + 8]], { bronze: true, hell: '#8a7444', dunkel: '#2a2112' });
      glied(c, sh, el, 6, { leucht: FARBE.jade }); gelenk(c, el[0], el[1], 4.5, FARBE.jade, p); glied(c, el, hd, 5, { leucht: FARBE.jade });
      for (let k = -1; k <= 1; k++) kristall(c, hd[0] + k * 6 * d, hd[1] + 2, 6, 34, FARBE.jade, 0.7, Math.PI + k * 0.25 * d);
      kristall(c, d * 104, r3 - 34 + Math.sin(t * 2 + d) * 5, 9, 26, FARBE.jade, 0.8, d * 0.25);
    }
    // Kopf: schwebende Sichel mit Augenschlitz
    const k0 = r3 - 50 + Math.sin(t * 1.6) * 4;
    spalt(c, -16, 16, r3 - 28, FARBE.jade, p);
    platte(c, [[-26, k0 - 10], [0, k0 - 30], [26, k0 - 10], [20, k0 + 10], [0, k0 + 4], [-20, k0 + 10]], { bronze: true });
    auge(c, 0, k0 - 6, 10, FARBE.jade, p);
    funken(c, t, 16, 4, [-80, -300, 160, 300], FARBE.jade, { a: 0.5 });
  },
  splitterkaefer(c, t, p) {
    for (const [dx, sk, ph] of [[-96, 0.55, 1.2], [92, 0.62, 2.4], [0, 1, 0]]) {
      c.save(); c.translate(dx, sk < 1 ? -34 : 0); c.scale(sk, sk);
      schatten(c, 100);
      const kr = Math.sin(t * 7 + ph);
      // Beine: lang, dünn, mit Nadelspitzen
      for (let i = 0; i < 3; i++) for (const d of [-1, 1]) {
        const a = [d * 20, -30 - i * 6], k = [d * (68 + i * 6 + kr * 3 * (i % 2 ? 1 : -1)), -62 - i * 4], f = [d * (96 + i * 10), 0];
        glied(c, a, k, 3, { bronze: true, hell: '#8a7444', dunkel: '#2a2112' }); glied(c, k, f, 2.5, { spitz: true, hell: '#a08a5a' });
        gelenk(c, k[0], k[1], 2.5, null, p);
      }
      // Hinterleib in Segmenten
      for (let i = 0; i < 4; i++) {
        const y = -36 - i * 4, w = 58 - i * 6;
        platte(c, [[-w, y + 6], [-w * 0.8, y - 20], [w * 0.8, y - 20], [w, y + 6], [w * 0.7, y + 14], [-w * 0.7, y + 14]], { hell: '#4a5452', dunkel: '#0b0e0f' });
      }
      bahnen(c, [[-50, -64], [50, -64], [58, -26], [-58, -26]], FARBE.bernstein, p, 9 + ph * 10, 4);
      // Kristallstacheln
      for (let i = 0; i < 5; i++) kristall(c, -36 + i * 18, -60 - Math.abs(i - 2) * -3, 7, 26 + (2 - Math.abs(i - 2)) * 14, FARBE.bernstein, 0.9, (i - 2) * 0.22);
      // Kopf mit Mandibeln
      platte(c, [[-22, -40], [22, -40], [18, -16], [-18, -16]], { bronze: true, hell: '#6e5a33', dunkel: '#1a140a' });
      for (const d of [-1, 1]) { c.save(); c.translate(d * 12, -18); c.rotate(d * (0.3 + 0.15 * kr)); platte(c, [[0, 0], [d * 4, 18], [d * -4, 26], [d * -4, 6]], { hell: '#c8a35c', gravur: false }); c.restore(); }
      auge(c, -8, -30, 4, FARBE.bernstein, p, false); auge(c, 8, -30, 4, FARBE.bernstein, p, false);
      c.restore();
    }
    funken(c, t, 10, 7, [-120, -120, 240, 120], FARBE.bernstein, { a: 0.6 });
  },
  runenauge(c, t, p) {
    const h = -160 + Math.sin(t * 1.3) * 8;
    schatten(c, 70);
    // Lichtkegel nach unten
    c.save(); c.globalCompositeOperation = 'lighter';
    const kg = c.createLinearGradient(0, h, 0, 0); kg.addColorStop(0, hexA(FARBE.tuerkis, 0.35 * p + 0.1)); kg.addColorStop(1, hexA(FARBE.tuerkis, 0));
    c.fillStyle = kg; pfad(c, [[-14, h + 30], [14, h + 30], [70, 0], [-70, 0]]); c.fill(); c.restore();
    c.translate(0, h);
    // Ringe hinten
    const ringe = (vorn) => {
      for (let i = 0; i < 3; i++) {
        c.save(); c.rotate(i * 0.9 + t * 0.15 * (i - 1));
        const rx = 104 - i * 12, ry = 26 + i * 18, a0 = t * (0.6 + i * 0.25) * (i % 2 ? -1 : 1);
        c.beginPath(); c.ellipse(0, 0, rx, ry, 0, vorn ? 0 : Math.PI, vorn ? Math.PI : TAU);
        c.strokeStyle = hexA(FARBE.bronzeHell, 0.9); c.lineWidth = 2.2; c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, rx - 3, ry - 2, 0, vorn ? 0 : Math.PI, vorn ? Math.PI : TAU); c.stroke();
        for (let k = 0; k < 18; k++) { const a = a0 + k / 18 * TAU; const s = Math.sin(a); if ((s > 0) !== vorn) continue; const x = Math.cos(a) * rx, y = s * ry; c.fillStyle = k % 3 ? hexA(FARBE.bronzeHell, 0.8) : hexA(FARBE.tuerkis, 0.9); c.fillRect(x - 1.5, y - 1.5, 3, 3); if (k % 3 === 0) leuchten(c, x, y, 8, FARBE.tuerkis, 0.4); }
        c.restore();
      }
    };
    ringe(false);
    // Kugel aus Platten mit Lichtspalten
    leuchten(c, 0, 0, 90, FARBE.tuerkis, 0.2 + 0.15 * p);
    for (let i = 0; i < 8; i++) {
      const a1 = i / 8 * TAU + 0.05 + Math.sin(t) * 0.02, a2 = (i + 1) / 8 * TAU - 0.05, r1 = 30, r2 = 50 + (i % 2) * 2;
      const pts = []; for (let k = 0; k <= 4; k++) { const a = a1 + (a2 - a1) * k / 4; pts.push([Math.cos(a) * r2, Math.sin(a) * r2]); } for (let k = 4; k >= 0; k--) { const a = a1 + (a2 - a1) * k / 4; pts.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
      platte(c, pts, { gravur: false });
    }
    // Licht aus den Spalten
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.strokeStyle = hexA(FARBE.tuerkis, 0.5 + 0.3 * p); c.lineWidth = 1.5; c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); c.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); c.stroke(); }
    c.restore();
    // Iris mit Lamellen
    c.fillStyle = '#04090b'; c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fill();
    for (let i = 0; i < 10; i++) { c.save(); c.rotate(i / 10 * TAU + t * 0.2); c.fillStyle = i % 2 ? '#1a2a2e' : '#14222a'; pfad(c, [[0, -8 - 6 * (1 - p)], [26, -14], [28, 0], [6, 0]]); c.fill(); c.restore(); }
    kern(c, 0, 0, 9 + 3 * p, FARBE.tuerkis, p);
    ringe(true);
    // angezogene Partikel
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { const k = ((t * 0.4 + i / 18) % 1), a = i * 2.4, r = 140 * (1 - k); c.fillStyle = hexA(FARBE.tuerkis, k * 0.8); c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r * 0.6, 1.5, 0, TAU); c.fill(); }
    c.restore();
  },
  scherbenschwarm(c, t, p) {
    schatten(c, 90);
    c.translate(0, -150);
    leuchten(c, 0, 0, 140, FARBE.violett, 0.15 + 0.1 * p);
    const pos = [];
    for (let i = 0; i < 54; i++) {
      const r = 26 + ((i * 37) % 96), sp = 0.4 + (i % 5) * 0.12, a = t * sp + i * 2.4, k = Math.sin(i * 1.7 + t * 0.5);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.5 + k * 34;
      pos.push([x, y]);
      // Lichtspur
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(FARBE.violett, 0.15); c.lineWidth = 2; c.beginPath(); c.ellipse(0, k * 34, r, r * 0.5, 0, a - 0.5, a); c.stroke(); c.restore();
      kristall(c, x, y + 8, 5 + (i % 3) * 2.5, 12 + (i % 4) * 6, i % 9 === 0 ? FARBE.tuerkis : FARBE.violett, 0.6, a * 2 + i);
    }
    // Bögen zwischen nahen Scherben
    for (let i = 0; i < 4; i++) { const a = pos[(i * 13 + Math.floor(t * 2)) % pos.length], b = pos[(i * 13 + 5 + Math.floor(t * 2)) % pos.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 90) bogen(c, a[0], a[1], b[0], b[1], FARBE.violett, t, 0.5 + 0.4 * p); }
    // Kern: kleiner Bruchstern
    for (let i = 0; i < 6; i++) kristall(c, 0, 0, 5, 18 + 4 * p, '#e9dcff', 1, i / 6 * TAU + t * 0.5);
    leuchten(c, 0, 0, 40, '#e9dcff', 0.5 + 0.3 * p); reflex(c, 0, 0, 70, FARBE.violett, 0.5);
  },
  steinhund(c, t, p) {
    // Geisterwolf aus dunklen Panzerplatten: tiefe Brust, schmale Taille, Kopf tief, Eis bricht aus Schultern und Rücken
    schatten(c, 150);
    const frost = (x, w) => { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, 0, 0, x, 0, w); g.addColorStop(0, hexA(FARBE.eis, 0.35)); g.addColorStop(1, hexA(FARBE.eis, 0)); c.fillStyle = g; c.beginPath(); c.ellipse(x, 0, w, w * 0.18, 0, 0, TAU); c.fill(); c.restore(); for (let i = 0; i < 5; i++) kristall(c, x - w * 0.5 + i * w * 0.25, 2, 3, 6 + (i % 3) * 5, FARBE.eis, 0.4, (i - 2) * 0.4); };
    frost(-60, 50); frost(70, 46);
    const atem = Math.sin(t * 2.2), lauern = Math.sin(t * 0.9) * 3;
    const P = { hell: '#4a5458', dunkel: '#0a0d10', rand: '#cfefff' };
    // Geisterfahne hinten
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { const k = i / 18, x = -120 - k * 120, y = -150 + Math.sin(t * 2 + k * 6) * 10 + k * 40; const r = 30 * (1 - k) + 6; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(FARBE.eis, 0.25 * (1 - k))); g.addColorStop(1, hexA(FARBE.eis, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.restore();
    // Hinterbeine (fern)
    const bein = (pts, d) => { for (let i = 0; i < pts.length - 1; i++) glied(c, pts[i], pts[i + 1], d[i], { ...P, gravur: false, leucht: i === 0 ? FARBE.eis : null }); gelenk(c, pts[1][0], pts[1][1], 3, FARBE.eis, p); const z = pts[pts.length - 1]; for (let k = -1; k <= 1; k++) glied(c, z, [z[0] + 12, z[1] + 2 + k * 2], 1.5, { spitz: true, hell: '#e6f4ff' }); };
    const sw = (ph) => Math.sin(t * 2.2 + ph) * 6;
    bein([[-78, -128], [-112, -84 + sw(1)], [-96, -40], [-108, -2]], [9, 5, 3.5]);
    bein([[58, -150 + lauern], [72, -96], [64, -40 + sw(2)], [78, -2]], [8, 5, 3.5]);
    // Körper: Platten von der Brust zur Hüfte, mit Licht in den Fugen
    const koerper = [[96, -196 + lauern], [130, -168 + lauern], [116, -112], [70, -84], [10, -104], [-50, -106], [-92, -96], [-110, -126], [-86, -156], [-20, -164], [40, -186 + lauern]];
    c.save(); c.globalCompositeOperation = 'lighter'; pfad(c, koerper); c.shadowColor = FARBE.eis; c.shadowBlur = 30; c.fillStyle = hexA(FARBE.eis, 0.25 + 0.15 * p); c.fill(); c.restore();
    const plattenListe = [
      [[96, -196 + lauern], [130, -168 + lauern], [118, -120], [80, -110], [70, -160]],
      [[70, -164], [80, -108], [40, -92], [24, -140], [40, -180 + lauern]],
      [[20, -150], [36, -96], [-8, -102], [-14, -150]],
      [[-18, -152], [-10, -104], [-52, -108], [-56, -154]],
      [[-60, -156], [-56, -108], [-92, -98], [-110, -126], [-88, -154]]
    ];
    plattenListe.forEach((pl, i) => { const versatz = Math.sin(t * 2 + i) * 1.5; c.save(); c.translate(0, versatz); platte(c, pl, P); bahnen(c, pl, FARBE.eis, p, 50 + i, 2); c.restore(); });
    // Eis bricht aus Schultern und Rücken, nach hinten geneigt
    const kamm = [[104, -192], [86, -188], [66, -178], [44, -184], [20, -160], [-6, -160], [-32, -160], [-58, -160], [-82, -150]];
    kamm.forEach(([x, y], i) => kristall(c, x, y + lauern * (x > 40 ? 1 : 0), 5 + (i < 4 ? 3 : 0), 30 + (i < 4 ? 26 - i * 4 : 10) + Math.sin(i * 1.7) * 6, FARBE.eis, 0.8 + 0.3 * p, -0.75 + i * 0.03));
    // Vorderbeine (nah), kräftig
    bein([[-60, -120], [-82, -76 + sw(3)], [-66, -36], [-74, -2]], [10, 6, 4]);
    bein([[100, -150 + lauern], [116, -92], [106, -40 + sw(0)], [122, -2]], [11, 6, 4.2]);
    // Hals und Kopf tief gesenkt
    const kx = 150, ky = -138 + lauern + atem * 2;
    platte(c, [[96, -196 + lauern], [134, -170 + lauern], [kx + 4, ky - 6], [kx - 18, ky + 20], [110, -128]], P);
    c.save(); c.translate(kx, ky); c.rotate(0.38);
    // Schädel: lang, flach, Dornen
    platte(c, [[-20, -14], [16, -22], [62, -12], [78, 0], [52, 6], [-12, 12]], { hell: '#6a767a', dunkel: '#101418', rand: '#e6f6ff' });
    bahnen(c, [[-20, -14], [16, -22], [62, -12], [78, 0], [52, 6], [-12, 12]], FARBE.eis, p, 61, 2);
    c.save(); c.rotate(0.16 + 0.1 * (0.5 + 0.5 * atem));
    platte(c, [[-6, 10], [64, 6], [54, 18], [-4, 22]], { hell: '#3e484c', dunkel: '#06080a', gravur: false });
    c.restore();
    // Maul innen glüht kalt
    leuchten(c, 34, 12, 26, FARBE.eis, 0.4 + 0.2 * p);
    for (let i = 0; i < 7; i++) { glied(c, [16 + i * 7, 6], [17 + i * 7, 14], 1.4, { spitz: true, hell: '#f2fbff' }); glied(c, [18 + i * 7, 22], [19 + i * 7, 14], 1.2, { spitz: true, hell: '#e2eef6' }); }
    for (let i = 0; i < 4; i++) kristall(c, -6 + i * 10, -16, 3.2, 30 - i * 6, FARBE.eis, 0.7, -1.15 + i * 0.05);
    auge(c, 30, -6, 8, FARBE.eis, p);
    c.restore();
    // Lichtspur aus dem Auge nach hinten
    c.save(); c.globalCompositeOperation = 'lighter'; const ex = kx + 24, ey = ky + 8; const sp = c.createLinearGradient(ex, ey, ex - 90, ey - 30); sp.addColorStop(0, hexA(FARBE.eis, 0.6)); sp.addColorStop(1, hexA(FARBE.eis, 0)); c.strokeStyle = sp; c.lineWidth = 2.5; c.beginPath(); c.moveTo(ex, ey); c.bezierCurveTo(ex - 30, ey - 10 + atem * 4, ex - 60, ey - 20, ex - 90, ey - 34); c.stroke(); c.restore();
    // kalter Atem
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) { const k = ((t * 0.5 + i / 10) % 1), x = kx + 72 + k * 60, y = ky + 34 + k * 6 + Math.sin(i * 3 + t) * 5, r = 6 + k * 22; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(FARBE.eis, 0.22 * (1 - k))); g.addColorStop(1, hexA(FARBE.eis, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.restore();
    funken(c, t, 22, 21, [-200, -260, 400, 260], FARBE.eis, { a: 0.5, fallen: true });
  },
  tiefenspinne(c, t, p) {
    const h = -150 + Math.sin(t * 0.8) * 10;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(FARBE.violett, 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(0, -330); c.lineTo(0, h - 20); c.stroke(); c.restore();
    schatten(c, 120);
    c.translate(0, h);
    // Beine: acht, sehr lang, mehrgliedrig
    for (let i = 0; i < 4; i++) for (const d of [-1, 1]) {
      const zuck = Math.sin(t * 3 + i * 1.3 + d) * 5;
      const a = [d * 10, -4 + i * 5], k1 = [d * (60 + i * 10), -84 + i * 18 + zuck], k2 = [d * (118 + i * 12), -40 + i * 26 + zuck * 0.5], f = [d * (138 + i * 10), 150 - i * 6];
      glied(c, a, k1, 3.2, { bronze: true, hell: '#8a7444', dunkel: '#20180b', leucht: FARBE.violett });
      glied(c, k1, k2, 2.6, { bronze: true, hell: '#a08a5a', dunkel: '#20180b' });
      glied(c, k2, f, 2.2, { spitz: true, hell: '#c8b07a' });
      gelenk(c, k1[0], k1[1], 3, FARBE.violett, p); gelenk(c, k2[0], k2[1], 2.4, null, p);
    }
    // Hinterleib: rissiger Kristall mit Adern
    c.save(); c.translate(0, 6);
    const hl = [[0, 100], [34, 70], [42, 26], [26, 4], [-26, 4], [-42, 26], [-34, 70]];
    c.save(); c.shadowColor = FARBE.violett; c.shadowBlur = 30 * (0.6 + 0.4 * p); pfad(c, hl); const kg = c.createRadialGradient(-10, 30, 4, 0, 50, 60); kg.addColorStop(0, '#f2e8ff'); kg.addColorStop(0.4, FARBE.violett); kg.addColorStop(1, '#2a1650'); c.fillStyle = kg; c.fill(); c.restore();
    c.save(); pfad(c, hl); c.clip(); c.strokeStyle = 'rgba(30,10,60,0.7)'; c.lineWidth = 1.2; const rnd = zufall(5);
    for (let i = 0; i < 9; i++) { let x = (rnd() - 0.5) * 60, y = 10 + rnd() * 20; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 20; y += 12; c.lineTo(x, y); } c.stroke(); }
    c.restore();
    pfad(c, hl); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.8; c.stroke();
    c.restore();
    // Rumpf und Kopf mit Augentraube
    platte(c, [[-24, -26], [24, -26], [30, -6], [20, 10], [-20, 10], [-30, -6]], { bronze: true, hell: '#5c5040', dunkel: '#100d08' });
    bahnen(c, [[-24, -26], [24, -26], [30, -6], [20, 10], [-20, 10], [-30, -6]], FARBE.violett, p, 31, 3);
    for (const [x, y, r] of [[-8, -16, 3.2], [8, -16, 3.2], [-15, -10, 2], [15, -10, 2], [-4, -8, 1.8], [4, -8, 1.8], [0, -22, 2.4]]) { leuchten(c, x, y, r * 4, FARBE.violett, 0.5); c.fillStyle = '#f4ecff'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    // Kieferklauen
    for (const d of [-1, 1]) glied(c, [d * 6, 8], [d * 3, 26 + p * 3], 2.2, { spitz: true, hell: '#d8c38c' });
    // leuchtender Tropfen
    const tr = (t * 0.5) % 1; leuchten(c, 0, 106 + tr * 140, 6, FARBE.violett, 0.7 * (1 - tr)); c.fillStyle = hexA('#f2e8ff', 1 - tr); c.beginPath(); c.arc(0, 106 + tr * 140, 2, 0, TAU); c.fill();
  },
  saeulenhueter(c, t, p) {
    schatten(c, 110);
    const auf = (Math.sin(t * 0.7) + 1) / 2;
    // Sockel und Kapitell
    platte(c, [[-58, -22], [58, -22], [64, 0], [-64, 0]], {});
    platte(c, [[-60, -300], [60, -300], [52, -280], [-52, -280]], {});
    // inneres Werk, sichtbar wenn offen
    c.save(); c.globalCompositeOperation = 'lighter';
    const ig = c.createLinearGradient(0, -280, 0, -22); ig.addColorStop(0, hexA(FARBE.jade, 0.0)); ig.addColorStop(0.5, hexA(FARBE.jade, 0.45 * auf)); ig.addColorStop(1, hexA(FARBE.jade, 0.1 * auf));
    c.fillStyle = ig; c.fillRect(-16 * auf - 4, -280, 32 * auf + 8, 258); c.restore();
    for (let i = 0; i < 6; i++) { const y = -250 + i * 38; c.save(); c.translate(0, y); c.rotate(t * (i % 2 ? 1 : -1)); c.strokeStyle = hexA(FARBE.bronzeHell, 0.7 * auf); c.lineWidth = 1.5; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); } c.stroke(); c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.stroke(); c.restore(); }
    // zwei Hälften mit Kanneluren
    for (const d of [-1, 1]) {
      c.save(); c.translate(d * auf * 18, 0);
      const pts = d < 0 ? [[-50, -280], [-2, -280], [-2, -22], [-50, -22]] : [[2, -280], [50, -280], [50, -22], [2, -22]];
      platte(c, pts, { hell: '#7a8381', dunkel: '#151a1b' });
      c.save(); pfad(c, pts); c.clip();
      for (let k = 0; k < 4; k++) { const x = d * (10 + k * 11); const g = c.createLinearGradient(x - 4, 0, x + 4, 0); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = g; c.fillRect(x - 4, -280, 8, 258); }
      c.restore();
      bahnen(c, pts, FARBE.jade, auf * p, 40 + d * 3, 4);
      c.restore();
    }
    // Maske, filigran, über dem Spalt schwebend
    const my = -214 + Math.sin(t * 1.2) * 2;
    platte(c, [[-30, my - 26], [0, my - 40], [30, my - 26], [34, my + 4], [12, my + 30], [0, my + 24], [-12, my + 30], [-34, my + 4]], { bronze: true, hell: '#a88a4c', dunkel: '#2a1f0e' });
    c.strokeStyle = 'rgba(40,25,8,0.7)'; c.lineWidth = 1; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-26 + i * 13, my - 26 + Math.abs(i - 2) * -4); c.lineTo(-18 + i * 9, my + 18); c.stroke(); }
    auge(c, -12, my - 6, 6, FARBE.jade, auf); auge(c, 12, my - 6, 6, FARBE.jade, auf);
    // vier Arme falten sich aus
    for (const d of [-1, 1]) for (const k of [0, 1]) {
      const by = -168 + k * 56, l = 30 + auf * 50;
      const a = [d * (54 + auf * 18), by], e = [d * (54 + auf * 18 + l * 0.6), by - 30 + k * 10], h = [d * (54 + auf * 18 + l), by + 10 - k * 6];
      c.save(); c.globalAlpha = 0.25 + 0.75 * auf;
      glied(c, a, e, 3, { bronze: true, hell: '#a88a4c', leucht: FARBE.jade }); gelenk(c, e[0], e[1], 3, FARBE.jade, p); glied(c, e, h, 2.5, { hell: '#c8a35c' });
      kristall(c, h[0], h[1], 5, 30, FARBE.jade, 0.8, d * (1.9 - k * 0.5));
      c.restore();
    }
  },
  lichtfresser(c, t, p) {
    schatten(c, 130);
    // abgesaugtes Licht: Bernsteinfunken strömen zum Kopf
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) { const k = ((t * 0.35 + i / 26) % 1), a = i * 2.39, sx = Math.cos(a) * 170, sy = -60 + Math.sin(a) * 60; const x = sx + (0 - sx) * k, y = sy + (-200 - sy) * k * k; c.fillStyle = hexA(FARBE.bernstein, (1 - k) * 0.8); c.beginPath(); c.arc(x, y, 1.6 + (1 - k) * 1.5, 0, TAU); c.fill(); }
    c.restore();
    // Rauchsträhnen
    for (let i = 0; i < 34; i++) {
      const x0 = (i / 34 - 0.5) * 120, wel = Math.sin(t * 1.2 + i * 0.7);
      const g = c.createLinearGradient(0, -210, 0, -10); g.addColorStop(0, 'rgba(4,5,8,0.95)'); g.addColorStop(1, 'rgba(4,5,8,0)');
      c.strokeStyle = g; c.lineWidth = 8 - (i % 4); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0 * 0.4, -200); c.bezierCurveTo(x0 * 0.8 + wel * 10, -150, x0 * 1.3 - wel * 18, -90, x0 * 1.6 + wel * 26, -14 - (i % 5) * 6); c.stroke();
    }
    // Rand aus violettem Kantenlicht
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(FARBE.violett, 0.25); c.lineWidth = 2; c.beginPath(); c.ellipse(0, -190, 44, 56, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.restore();
    c.fillStyle = '#030406'; c.beginPath(); c.ellipse(0, -188, 36, 48, 0, 0, TAU); c.fill();
    // Krone aus schwarzen Splittern mit violetter Kante
    for (let i = 0; i < 11; i++) { const a = (i - 5) * 0.2, l = 30 + (5 - Math.abs(i - 5)) * 9; c.save(); c.translate(Math.sin(a) * 34, -222 - Math.cos(a) * 6); c.rotate(a); pfad(c, [[0, -l], [5, -l * 0.4], [3, 0], [-3, 0], [-5, -l * 0.4]]); c.fillStyle = '#0a0812'; c.fill(); c.strokeStyle = hexA(FARBE.violett, 0.7); c.lineWidth = 1; c.stroke(); c.restore(); }
    leuchten(c, 0, -246, 50, FARBE.violett, 0.15 + 0.1 * p);
    // Augen: kalt
    auge(c, -14, -190, 8, '#d8e8ff', p); auge(c, 14, -190, 8, '#d8e8ff', p);
    // Mundspalt
    c.strokeStyle = hexA('#d8e8ff', 0.25); c.lineWidth = 1; c.beginPath(); c.moveTo(-10, -166); c.quadraticCurveTo(0, -162 + p * 3, 10, -166); c.stroke();
  },
  echowurm(c, t, p) {
    // Bodenrisse leuchten
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(FARBE.tuerkis, 0.4 + 0.3 * p); c.lineWidth = 1.5;
    const rnd = zufall(8); for (let i = 0; i < 9; i++) { let x = 0, y = 0, a = i / 9 * TAU; c.beginPath(); c.moveTo(0, 0); for (let k = 0; k < 5; k++) { a += (rnd() - 0.5) * 0.6; x += Math.cos(a) * 26; y += Math.sin(a) * 5; c.lineTo(x, y); } c.stroke(); }
    c.restore();
    c.fillStyle = '#060808'; c.beginPath(); c.ellipse(0, 0, 70, 14, 0, 0, TAU); c.fill();
    // Gesteinsbrocken fliegen
    for (let i = 0; i < 8; i++) { const k = (t * 0.5 + i / 8) % 1, x = (i - 4) * 18 + Math.sin(i) * 20, y = -k * 140 + k * k * 120; platte(c, [[x - 5, y - 4], [x + 4, y - 6], [x + 6, y + 3], [x - 3, y + 5]], { gravur: false }); }
    const seg = 9;
    for (let i = 0; i < seg; i++) {
      const y = -i * 28, x = Math.sin(t * 1.3 + i * 0.55) * (i * 6), r = 44 - i * 2.2;
      // überlappende Panzerplatten
      platte(c, [[x - r, y - 6], [x - r * 0.8, y - 26], [x + r * 0.8, y - 26], [x + r, y - 6], [x + r * 0.7, y + 4], [x - r * 0.7, y + 4]], { hell: '#6a7472', dunkel: '#0e1213' });
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(FARBE.tuerkis, 0.5 + 0.3 * p); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - r * 0.75, y + 2); c.lineTo(x + r * 0.75, y + 2); c.stroke(); c.restore();
      if (i % 2) { kristall(c, x - r, y - 10, 5, 16, FARBE.tuerkis, 0.6, -1.1); kristall(c, x + r, y - 10, 5, 16, FARBE.tuerkis, 0.6, 1.1); }
    }
    const kx = Math.sin(t * 1.3 + seg * 0.55) * (seg * 6), ky = -seg * 28 - 6;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + Math.PI / 2 + Math.sin(t * 2) * 0.06 * p; c.save(); c.translate(kx, ky); c.rotate(a); c.translate(0, -10 - 12 * p); platte(c, [[0, 0], [12, -18], [6, -58], [0, -66], [-6, -58], [-12, -18]], { bronze: true, hell: '#b08f50', dunkel: '#2a1f0e' }); bahnen(c, [[0, 0], [12, -18], [6, -58], [-6, -58], [-12, -18]], FARBE.tuerkis, p, 70 + i, 2); c.restore(); }
    kern(c, kx, ky, 12, FARBE.tuerkis, p);
  },
  glimmermotte(c, t, p) {
    const h = -170 + Math.sin(t * 1.5) * 10, fl = Math.sin(t * 6);
    schatten(c, 80);
    c.translate(0, h);
    leuchten(c, 0, 0, 160, '#9fd8ff', 0.12);
    const farben = ['#8ef4ff', '#c9a6ff', '#ffd98a', '#8dffd0'];
    for (const d of [-1, 1]) {
      c.save(); c.scale(d * (0.7 + 0.3 * Math.abs(fl)), 1);
      for (const [pts, vein] of [[[[6, -8], [56, -112], [150, -96], [160, -40], [120, -6], [30, 2]], 7], [[[6, 8], [96, 18], [120, 76], [80, 106], [30, 70]], 5]]) {
        const g = c.createLinearGradient(0, -110, 160, 100); farben.forEach((f, i) => g.addColorStop(i / 3, hexA(f, 0.38)));
        pfad(c, pts); c.fillStyle = g; c.fill();
        // Adern wie Kristallbruch
        c.save(); pfad(c, pts); c.clip(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < vein; i++) { const tx = pts[1 + (i % (pts.length - 1))]; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(tx[0] * 0.5, tx[1] * 0.4 + 6, tx[0] * 0.95, tx[1] * 0.95); c.stroke(); }
        for (let i = 0; i < 26; i++) { const x = 20 + ((i * 37) % 130), y = -100 + ((i * 53) % 190); c.fillStyle = hexA(farben[i % 4], 0.5 + 0.5 * Math.sin(t * 3 + i)); c.fillRect(x, y, 1.6, 1.6); }
        c.restore();
        pfad(c, pts); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1; c.stroke();
      }
      c.restore();
    }
    // Leib aus Bronzeringen
    for (let i = 0; i < 8; i++) platte(c, [[-9 + i * 0.6, -26 + i * 10], [9 - i * 0.6, -26 + i * 10], [8 - i * 0.6, -18 + i * 10], [-8 + i * 0.6, -18 + i * 10]], { bronze: true, hell: '#d8b066', dunkel: '#3b2c14', gravur: false });
    platte(c, [[-10, -44], [10, -44], [12, -28], [-12, -28]], { bronze: true, hell: '#e6c27a', dunkel: '#3b2c14', gravur: false });
    for (const d of [-1, 1]) { c.strokeStyle = FARBE.bronzeHell; c.lineWidth = 1.2; c.beginPath(); c.moveTo(d * 4, -44); c.quadraticCurveTo(d * 24, -86, d * 40, -78); c.stroke(); for (let k = 0; k < 8; k++) { const x = d * (8 + k * 4), y = -50 - k * 4 + k * k * 0.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + d * 4, y - 6); c.stroke(); } }
    auge(c, -5, -36, 3, '#ffe6a8', p, false); auge(c, 5, -36, 3, '#ffe6a8', p, false);
    funken(c, t, 30, 33, [-160, -100, 320, 260], '#e8f6ff', { a: 0.7, fallen: true });
  },
  hohlerritter(c, t, p) {
    // Metallgerippe: Schädel, Wirbelsäule, Rippenkorb mit Kristallherz, lange Knochenglieder, Energieadern
    schatten(c, 110); nebel(c, t, FARBE.jade, 150, 18, 0.12);
    const s = Math.sin(t * 1.1) * 2.5, M = { hell: '#b9c2c0', dunkel: '#262b2d' }, B = { hell: '#d8b066', dunkel: '#3b2c14', bronze: true };
    const knochen = (a, b, d, glow = true) => { glied(c, a, b, d, { ...M, leucht: glow ? FARBE.jade : null }); glied(c, a, b, d * 0.35, { hell: '#e8efed', dunkel: '#8a9391', gravur: false }); };
    // Beine
    for (const d of [-1, 1]) {
      const h = [d * 18, -146 + s * 0.3], k = [d * 26, -76], f = [d * 22, -6];
      knochen(h, k, 5); knochen(k, f, 4.2);
      gelenk(c, k[0], k[1], 5, FARBE.jade, p);
      platte(c, [[d * 10, -6], [d * 40, -6], [d * 44, 0], [d * 8, 0]], { ...M, gravur: false });
      for (let i = 0; i < 3; i++) glied(c, [d * (36 + i * 2), -2], [d * (48 + i * 5), 0], 1.4, { spitz: true, hell: '#cfd8d6' });
    }
    // Becken
    platte(c, [[-34, -160 + s * 0.4], [34, -160 + s * 0.4], [24, -138], [8, -146], [-8, -146], [-24, -138]], M);
    // Wirbelsäule
    for (let i = 0; i < 9; i++) { const y = -168 - i * 13 + s; platte(c, [[-7, y - 9], [7, y - 9], [9, y], [-9, y]], { ...M, gravur: false }); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = hexA(FARBE.jade, 0.4 + 0.4 * Math.sin(t * 4 - i * 0.6)); c.fillRect(-1.5, y - 3, 3, 3); c.restore(); }
    // Rippenkorb, Herz dahinter
    const by = -232 + s;
    leuchten(c, 0, by, 90, FARBE.jade, 0.28 + 0.2 * p);
    kristall(c, 0, by + 22, 11, 40, FARBE.jade, 1.2, 0); reflex(c, 0, by, 70, FARBE.jade, 0.5 + 0.3 * p);
    for (let i = 0; i < 6; i++) {
      const y = by - 30 + i * 13, w = 46 - Math.abs(i - 2) * 4 - (i > 3 ? (i - 3) * 6 : 0);
      for (const d of [-1, 1]) { c.lineCap = 'round'; c.strokeStyle = '#2a3032'; c.lineWidth = 5; c.beginPath(); c.moveTo(d * 6, y); c.bezierCurveTo(d * w, y - 10, d * (w + 6), y + 14, d * (w * 0.55), y + 22); c.stroke(); c.strokeStyle = '#c4cdcb'; c.lineWidth = 1.6; c.stroke(); }
    }
    bogen(c, 0, by, -40, by - 26, FARBE.jade, t, 0.3); bogen(c, 0, by, 38, by + 18, FARBE.jade, t + 1, 0.3);
    // Schlüsselbein und schmale Schulterplatten
    const sy = by - 40;
    for (const d of [-1, 1]) {
      knochen([d * 4, sy + 4], [d * 52, sy - 2], 3.2, false);
      platte(c, [[d * 40, sy - 14 + Math.sin(t * 1.4 + d) * 3], [d * 74, sy - 18], [d * 80, sy - 2], [d * 50, sy + 6]], B);
      // Arm: Oberarm, Unterarm, lange Finger
      const sh = [d * 60, sy], el = [d * 74, sy + 66], hd = [d * 66 - d * Math.sin(t * 1.2) * 4, sy + 126];
      knochen(sh, el, 4.2); gelenk(c, el[0], el[1], 4, FARBE.jade, p); knochen(el, hd, 3.6);
      for (let k = -2; k <= 2; k++) glied(c, hd, [hd[0] + k * 5 * d, hd[1] + 22 - Math.abs(k) * 3], 1.3, { spitz: true, hell: '#e0e8e6' });
    }
    // Schädel: lang, Stirnkamm, leere Augenhöhlen mit Licht, Kieferplatten
    const ky = sy - 44 + Math.sin(t * 1.5) * 2;
    knochen([0, sy + 2], [0, ky + 20], 4, false);
    platte(c, [[-22, ky - 18], [-8, ky - 34], [8, ky - 34], [22, ky - 18], [24, ky + 4], [14, ky + 14], [-14, ky + 14], [-24, ky + 4]], M);
    platte(c, [[-4, ky - 42], [4, ky - 42], [6, ky - 16], [-6, ky - 16]], B);
    c.fillStyle = '#020404'; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 4, ky - 10); c.lineTo(d * 20, ky - 14); c.lineTo(d * 16, ky - 2); c.lineTo(d * 5, ky - 2); c.closePath(); c.fill(); }
    auge(c, -11, ky - 8, 7, FARBE.jade, p); auge(c, 11, ky - 8, 7, FARBE.jade, p);
    c.save(); c.translate(0, ky + 12 + p * 2); platte(c, [[-14, 0], [14, 0], [10, 14], [-10, 14]], { ...M, gravur: false }); for (let i = -3; i <= 3; i++) { c.fillStyle = '#0a0d0e'; c.fillRect(i * 3.5 - 0.6, 0, 1.2, 9); } c.restore();
    // Waffe: lange Klinge mit Leuchtrinne
    c.save(); c.translate(70, -192 + s); c.rotate(-0.08);
    platte(c, [[-3, -190], [3, -200], [7, -184], [4, 40], [-4, 40]], { hell: '#d8e0dd', dunkel: '#3a4240', gravur: false });
    c.save(); c.globalCompositeOperation = 'lighter'; const lg = c.createLinearGradient(0, -190, 0, 40); lg.addColorStop(0, hexA(FARBE.jade, 0.9)); lg.addColorStop(1, hexA(FARBE.jade, 0.2)); c.fillStyle = lg; c.fillRect(-0.8, -186, 1.6, 222); c.restore();
    platte(c, [[-16, 40], [16, 40], [12, 46], [-12, 46]], B); glied(c, [0, 46], [0, 86], 2.5, { hell: '#3b2c14' });
    c.restore();
    funken(c, t, 16, 44, [-120, -320, 240, 320], FARBE.jade, { a: 0.5 });
  },
  spiegelscherbe(c, t, p) {
    schatten(c, 80);
    const h = -160 + Math.sin(t) * 6;
    c.translate(0, h);
    // Lichtbrechung: Regenbogenfächer
    c.save(); c.globalCompositeOperation = 'lighter';
    ['#ff7a7a', '#ffd27a', '#8dffb0', '#7ad8ff', '#b48cff'].forEach((f, i) => { c.fillStyle = hexA(f, 0.08 + 0.05 * p); pfad(c, [[40, -20], [40, -10], [180, 40 + i * 14], [180, 30 + i * 14]]); c.fill(); });
    c.restore();
    const teile = [[[-52, -118], [36, -128], [52, -40], [-4, -20], [-60, -40]], [[-60, -30], [-6, -10], [10, 70], [-40, 104], [-70, 40]], [[2, -12], [58, -30], [70, 30], [44, 112], [14, 72]]];
    teile.forEach((pts, i) => {
      c.save(); c.translate(Math.sin(t * 0.9 + i * 2) * 4, Math.cos(t * 0.8 + i) * 4);
      const g = c.createLinearGradient(-60, -120, 60, 110); g.addColorStop(0, 'rgba(225,250,255,0.9)'); g.addColorStop(0.5, 'rgba(70,120,140,0.7)'); g.addColorStop(1, 'rgba(190,235,245,0.85)');
      pfad(c, pts); c.fillStyle = g; c.fill();
      c.save(); pfad(c, pts); c.clip();
      // verzerrtes Spiegelbild: zwei Gestalten und eine Laterne
      c.globalAlpha = 0.55; c.fillStyle = '#081013'; const w = Math.sin(t * 2 + i) * 8;
      c.beginPath(); c.ellipse(-22 + w, -30, 13, 15, 0.2, 0, TAU); c.fill(); c.fillRect(-36 + w, -16, 30, 90);
      c.beginPath(); c.ellipse(24 - w, -20, 11, 13, -0.2, 0, TAU); c.fill(); c.fillRect(12 - w, -8, 26, 84);
      c.globalAlpha = 1; leuchten(c, 6 + w, 20, 18, FARBE.bernstein, 0.6);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-90 + ((t * 70 + i * 40) % 220), -140, 10, 280);
      c.restore();
      pfad(c, pts); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1; c.stroke();
      c.restore();
    });
    // Bronzeklammern mit Energie
    for (const [x, y] of [[-52, -118], [52, -40], [-70, 40], [44, 112]]) { gelenk(c, x, y, 5, FARBE.tuerkis, p); }
    bogen(c, -52, -118, 52, -40, FARBE.tuerkis, t, 0.3); bogen(c, -70, 40, 44, 112, FARBE.tuerkis, t + 1, 0.3);
    leuchten(c, 0, 0, 150, FARBE.tuerkis, 0.08 + 0.06 * p);
  },
  sporenkristall(c, t, p) {
    c.fillStyle = '#060808'; c.beginPath(); c.ellipse(0, 0, 120, 18, 0, 0, TAU); c.fill();
    // Ranken mit Leuchtadern
    for (let i = 0; i < 9; i++) { const d = i % 2 ? 1 : -1, l = 70 + i * 9; c.lineCap = 'round'; const pts = [[0, -8], [d * 26, -30 - i * 3], [d * (l * 0.7), -10 - i * 5 + Math.sin(t + i) * 4], [d * (l + Math.sin(t * 0.8 + i) * 6), -2 - i * 2]]; c.strokeStyle = '#1d3a2e'; c.lineWidth = 6 - i * 0.4; c.beginPath(); c.moveTo(...pts[0]); c.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); c.stroke(); c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA('#7dffb0', 0.3 + 0.3 * Math.sin(t * 2 - i)); c.lineWidth = 1.2; c.beginPath(); c.moveTo(...pts[0]); c.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); c.stroke(); c.restore(); }
    const atem = 1 + Math.sin(t * 2) * 0.03;
    leuchten(c, 0, -60, 140, '#7dffb0', 0.15 + 0.15 * p);
    c.save(); c.scale(atem, atem);
    [[-70, 0, 12, 56, -0.7], [66, 0, 12, 64, 0.6], [-40, 0, 18, 104, -0.36], [40, 0, 18, 116, 0.3], [-14, 0, 14, 86, -0.12], [18, 0, 13, 92, 0.16], [0, 0, 26, 176, 0], [-24, -4, 8, 40, -0.9], [26, -4, 8, 46, 0.95]]
      .forEach(([x, y, w, h, a]) => kristall(c, x, y, w, h, '#7dffb0', 0.6 + 0.4 * p, a));
    c.restore();
    reflex(c, 0, -170, 50, '#7dffb0', 0.4);
    funken(c, t, 34, 13, [-130, -280, 260, 270], '#c8ffe0', { a: 0.8 });
  },
  schlackenkoloss(c, t, p) {
    schatten(c, 150);
    // Hitzeflimmern / Rauch
    c.save(); for (let i = 0; i < 8; i++) { const k = (t * 0.2 + i / 8) % 1, x = Math.sin(i * 2 + t * 0.5) * 40, y = -290 - k * 60; const g = c.createRadialGradient(x, y, 0, x, y, 30 + k * 30); g.addColorStop(0, `rgba(30,24,20,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(30,24,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 30 + k * 30, 0, TAU); c.fill(); } c.restore();
    const lava = (pts, seed) => {
      platte(c, pts, { hell: '#4a4440', dunkel: '#0a0807', rand: '#ffcf8a' });
      // Rissnetz
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const rnd = zufall(seed); c.save(); pfad(c, pts); c.clip(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) { let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); const seg = [[x, y]]; for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.3) * 24; seg.push([x, y]); }
        for (const [w, a, f] of [[7, 0.25, FARBE.bernstein], [3, 0.7, '#ff8a3a'], [1.2, 1, '#fff0c0']]) { c.beginPath(); seg.forEach(([a1, b1], k) => k ? c.lineTo(a1, b1) : c.moveTo(a1, b1)); c.strokeStyle = hexA(f.startsWith('#ff8') ? '#ff8a3a' : f, a * (0.6 + 0.4 * p)); c.lineWidth = w; c.stroke(); } }
      c.restore();
    };
    lava([[-74, 0], [-84, -96], [-40, -108], [-26, 0]], 1); lava([[26, 0], [40, -108], [84, -96], [74, 0]], 2);
    lava([[-100, -250], [-20, -268], [100, -246], [92, -120], [60, -96], [-60, -96], [-94, -124]], 3);
    for (const d of [-1, 1]) { const sw = Math.sin(t * 0.9 + d) * 4; lava([[d * 96, -258], [d * 150, -240 + sw], [d * 164, -170 + sw], [d * 140, -96 + sw], [d * 110, -110], [d * 98, -200]], 5 + d); lava([[d * 130, -96 + sw], [d * 160, -90 + sw], [d * 156, -40 + sw], [d * 124, -44 + sw]], 8 + d); }
    lava([[-34, -310], [34, -310], [42, -268], [-42, -268]], 9);
    kern(c, 0, -180, 22, FARBE.bernstein, p);
    auge(c, -14, -290, 8, FARBE.bernstein, p, false); auge(c, 14, -290, 8, FARBE.bernstein, p, false);
    // Glut tropft und Funken steigen
    funken(c, t, 40, 17, [-160, -320, 320, 320], '#ffb060', { a: 0.9 });
    for (let i = 0; i < 6; i++) { const k = (t * 0.7 + i / 6) % 1, x = -70 + i * 28; leuchten(c, x, -96 + k * 96, 8, '#ff8a3a', 0.8 * (1 - k)); }
    leuchten(c, 0, 0, 160, '#ff8a3a', 0.15 + 0.1 * p);
  },
  waechterdrohne(c, t, p) {
    schatten(c, 110);
    for (const [dx, ph, sk] of [[-74, 0, 0.72], [64, 2.1, 1]]) {
      const y = -170 + Math.sin(t * 2 + ph) * 12;
      c.save(); c.translate(dx, y); c.scale(sk, sk);
      // Suchkegel
      c.save(); c.globalCompositeOperation = 'lighter'; c.rotate(Math.sin(t * 0.8 + ph) * 0.35);
      const kg = c.createLinearGradient(0, 0, 0, 170); kg.addColorStop(0, hexA(FARBE.tuerkis, 0.35)); kg.addColorStop(1, hexA(FARBE.tuerkis, 0)); c.fillStyle = kg; pfad(c, [[-6, 10], [6, 10], [50, 170], [-50, 170]]); c.fill(); c.restore();
      // Lichtklingen
      c.save(); c.rotate(t * 4 + ph);
      for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(14, 0, 84, 0); g.addColorStop(0, hexA(FARBE.tuerkis, 0.9)); g.addColorStop(1, hexA(FARBE.tuerkis, 0)); c.fillStyle = g; pfad(c, [[14, -3], [84, -1], [84, 1], [14, 3]]); c.fill(); c.fillStyle = hexA(FARBE.tuerkis, 0.12); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 84, -0.5, 0); c.fill(); c.restore(); }
      c.restore();
      // Gehäuse: Ring aus Bronze mit Gravur
      c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fillStyle = '#0c1012'; c.fill();
      for (let i = 0; i < 6; i++) { const a1 = i / 6 * TAU + 0.08, a2 = (i + 1) / 6 * TAU - 0.08; const pts = []; for (let k = 0; k <= 3; k++) { const a = a1 + (a2 - a1) * k / 3; pts.push([Math.cos(a) * 34, Math.sin(a) * 34]); } for (let k = 3; k >= 0; k--) { const a = a1 + (a2 - a1) * k / 3; pts.push([Math.cos(a) * 24, Math.sin(a) * 24]); } platte(c, pts, { bronze: true, hell: '#c8a35c', dunkel: '#3b2c14', gravur: false }); }
      kern(c, 0, 0, 10, FARBE.tuerkis, p);
      // Antrieb unten
      leuchten(c, 0, 30, 24, FARBE.tuerkis, 0.5); c.fillStyle = hexA('#ffffff', 0.8); c.fillRect(-6, 30, 12, 2);
      c.restore();
    }
    bogen(c, -74, -170 + Math.sin(t * 2) * 12, 64, -170 + Math.sin(t * 2 + 2.1) * 12, FARBE.tuerkis, t, 0.25 + 0.3 * p);
  },
  kristallschleim(c, t, p) {
    schatten(c, 120);
    const w = 1 + Math.sin(t * 2.6) * 0.04;
    c.save(); c.scale(w, 2 - w);
    const form = () => { c.beginPath(); c.moveTo(-100, -4); c.bezierCurveTo(-108, -112, -46, -158, 0, -158); c.bezierCurveTo(46, -158, 108, -112, 100, -4); c.closePath(); };
    // Lichtbrechung: innen dunkel, Rand hell
    form(); const g = c.createRadialGradient(-20, -100, 10, 0, -70, 120); g.addColorStop(0, 'rgba(180,255,226,0.75)'); g.addColorStop(0.55, 'rgba(40,150,110,0.6)'); g.addColorStop(1, 'rgba(10,60,44,0.85)'); c.fillStyle = g; c.fill();
    c.save(); form(); c.clip();
    // Kaustiken
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { c.strokeStyle = hexA('#c8ffe8', 0.12 + 0.08 * Math.sin(t * 2 + i)); c.lineWidth = 1.5; c.beginPath(); c.moveTo(-100, -140 + i * 12); for (let x = -100; x <= 100; x += 20) c.lineTo(x, -140 + i * 12 + Math.sin(x * 0.05 + t * 2 + i) * 8); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 12; i++) kristall(c, -70 + ((i * 47) % 140), -24 - ((i * 31) % 100), 6 + (i % 3) * 3, 18 + (i % 4) * 6, i % 4 ? FARBE.jade : '#ffffff', 0.5 + 0.5 * p * (i % 2), i * 0.9 + t * 0.2);
    // Blasen
    for (let i = 0; i < 10; i++) { const k = (t * 0.25 + i / 10) % 1, x = -60 + ((i * 29) % 120), y = -10 - k * 140; c.strokeStyle = hexA('#e8fff6', 0.5 * (1 - k)); c.lineWidth = 1; c.beginPath(); c.arc(x, y, 2 + (i % 3), 0, TAU); c.stroke(); }
    c.restore();
    form(); c.strokeStyle = 'rgba(200,255,235,0.55)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-40, -124, 22, 9, -0.5, 0, TAU); c.fill();
    c.restore();
    auge(c, -26, -86, 10, '#e8fff6', p, false); auge(c, 26, -86, 10, '#e8fff6', p, false);
    leuchten(c, 0, -70, 150, FARBE.jade, 0.12);
  },
  herzdergruft(c, t, p) {
    c.translate(0, -160);
    leuchten(c, 0, 0, 230, FARBE.jade, 0.15 + 0.1 * p);
    // Ketten an vier Ecken
    for (const [x, y] of [[-170, -170], [170, -170], [-170, 170], [170, 170]]) {
      for (let i = 1; i < 12; i++) { const k = i / 12, cx = x * (1 - k * 0.72), cy = y * (1 - k * 0.72) + Math.sin(k * Math.PI) * 10; c.save(); c.translate(cx, cy); c.rotate(Math.atan2(y, x) + (i % 2) * Math.PI / 2); c.strokeStyle = '#3a3226'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 6, 3.5, 0, 0, TAU); c.stroke(); c.strokeStyle = hexA(FARBE.bronzeHell, 0.5); c.lineWidth = 1; c.stroke(); c.restore(); }
    }
    // Ringe mit Glyphen
    const ringe = (vorn) => {
      for (let i = 0; i < 4; i++) {
        c.save(); c.rotate(i * 0.7 + Math.sin(t * 0.2 + i) * 0.1);
        const rx = 150 - i * 18, ry = 40 + i * 28, a0 = t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1);
        c.beginPath(); c.ellipse(0, 0, rx, ry, 0, vorn ? 0 : Math.PI, vorn ? Math.PI : TAU); c.strokeStyle = hexA(i % 2 ? FARBE.bronzeHell : FARBE.bronze, 0.95); c.lineWidth = 4 - i * 0.5; c.stroke();
        c.beginPath(); c.ellipse(0, 0, rx - 5, ry - 4, 0, vorn ? 0 : Math.PI, vorn ? Math.PI : TAU); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.stroke();
        for (let k = 0; k < 24; k++) { const a = a0 + k / 24 * TAU, s = Math.sin(a); if ((s > 0) !== vorn) continue; const x = Math.cos(a) * rx, y = s * ry; c.save(); c.translate(x, y); c.rotate(a); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(FARBE.jade, 0.5 + 0.5 * Math.sin(t * 3 + k)); c.lineWidth = 1; c.beginPath(); c.moveTo(-3, -3); c.lineTo(0, 3); c.lineTo(3, -3); c.stroke(); c.restore(); }
        c.restore();
      }
    };
    ringe(false);
    // Energiebögen vom Kern zu den Ringen
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * 0.7; bogen(c, 0, 0, Math.cos(a) * 120, Math.sin(a) * 60, FARBE.jade, t + i, 0.4 + 0.4 * p); }
    const s = 1 + 0.04 * Math.sin(t * 2.4);
    c.save(); c.scale(s, s);
    kristall(c, 0, 80, 76, 160, FARBE.jade, 1.2, 0); kristall(c, 0, -80, 76, 160, FARBE.jade, 1.2, Math.PI);
    for (let i = 0; i < 6; i++) kristall(c, Math.cos(i) * 40, 20 + Math.sin(i * 2) * 20, 10, 40, FARBE.jade, 0.6, i * 1.1 + Math.PI);
    c.restore();
    leuchten(c, 0, 0, 60, '#ffffff', 0.4 + 0.3 * p); reflex(c, 0, 0, 200, FARBE.jade, 0.7);
    ringe(true);
    funken(c, t, 40, 19, [-200, -200, 400, 400], FARBE.jade, { a: 0.6 });
  }
};


export { ZEICHNER, FARBE };

// ---------- Bewegung im Kampf: Angriff, Treffer, Besiegt ----------
// zustand = { art: 'angriff' | 'treffer' | 'besiegt', k: 0..1 } oder null.
// Jeder Gegner hat einen Ankerpunkt (Kern, Kopf, Maul) und eine Angriffsart.
const KAMPF = {
  kernwaechter: { anker: [0, -226], art: 'stoss', farbe: FARBE.jade },
  splitterkaefer: { anker: [0, -40], art: 'biss', farbe: FARBE.bernstein },
  runenauge: { anker: [0, -160], art: 'strahl', farbe: FARBE.tuerkis },
  scherbenschwarm: { anker: [0, -150], art: 'schwarm', farbe: FARBE.violett },
  steinhund: { anker: [176, -118], art: 'biss', farbe: FARBE.eis },
  tiefenspinne: { anker: [0, -150], art: 'biss', farbe: FARBE.violett },
  saeulenhueter: { anker: [0, -190], art: 'klinge', farbe: FARBE.jade },
  lichtfresser: { anker: [0, -190], art: 'dunkel', farbe: FARBE.violett },
  echowurm: { anker: [30, -262], art: 'stoss', farbe: FARBE.tuerkis },
  glimmermotte: { anker: [0, -170], art: 'staub', farbe: '#bfe6ff' },
  hohlerritter: { anker: [0, -232], art: 'klinge', farbe: FARBE.jade },
  spiegelscherbe: { anker: [0, -160], art: 'strahl', farbe: FARBE.tuerkis },
  sporenkristall: { anker: [0, -90], art: 'gift', farbe: '#7dffb0' },
  schlackenkoloss: { anker: [0, -180], art: 'feuer', farbe: FARBE.bernstein },
  waechterdrohne: { anker: [64, -170], art: 'strahl', farbe: FARBE.tuerkis },
  kristallschleim: { anker: [0, -80], art: 'stoss', farbe: FARBE.jade },
  herzdergruft: { anker: [0, -160], art: 'nova', farbe: FARBE.jade }
};
const DAUER = { angriff: 1.1, treffer: 0.6, besiegt: 3.4 };
const ZERFALL = 1.8; // Sekunden für Aufflammen und Zerbrechen, danach bleibt Staub und wird weggeweht
const glatt = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// Körperhaltung: Ausholen, Zustoßen (näher an die Gruppe = größer), Zurückfedern; Treffer: zurückweichen und zittern
function haltung(c, z, kampf) {
  if (!z) return 1;
  const k = z.k, [ax, ay] = kampf.anker;
  if (z.art === 'angriff') {
    const aus = glatt(0, 0.35, k) * (1 - glatt(0.35, 0.45, k));
    const stoss = glatt(0.35, 0.47, k) * (1 - glatt(0.55, 0.95, k));
    const s = 1 - aus * 0.06 + stoss * 0.22;
    c.translate(0, aus * -10 + stoss * 14);
    c.translate(ax * 0.3, ay * 0.5); c.rotate(-aus * 0.05 + stoss * 0.03); c.scale(s, s); c.translate(-ax * 0.3, -ay * 0.5);
    return 1;
  }
  if (z.art === 'treffer') {
    const w = 1 - glatt(0, 1, k);
    c.translate(Math.sin(k * 60) * 9 * w, -w * 6);
    c.translate(0, ay * 0.5); c.scale(1 - w * 0.08, 1 - w * 0.08); c.rotate(-w * 0.06); c.translate(0, -ay * 0.5);
    return 1;
  }
  if (z.art === 'besiegt') {
    // kurzes Zittern, bevor die Gestalt zerbricht
    const w = glatt(0, 0.14, k) * (1 - glatt(0.14, 0.2, k));
    c.translate(Math.sin(k * 90) * 6 * w, 0);
    return 1;
  }
  return 1;
}

// Gegner zeichnen mit Kampfbewegung. Gibt zurück, wie stark ein weißer Blitz auf die Figur gelegt werden soll (Treffer).
function wesenMalen(c, id, t, p, z0) {
  const kampf = KAMPF[id] || KAMPF.kristallschleim;
  // Beim Besiegen läuft der Zerfall in den ersten 1,8 s, der Staub bis zum Ende
  const z = z0 && z0.art === 'besiegt' ? { art: 'besiegt', k: Math.min(1, z0.k * DAUER.besiegt / ZERFALL), staub: z0.k } : z0;
  c.save();
  const sicht = haltung(c, z, kampf);
  c.globalAlpha *= sicht;
  // beim Ausholen lädt der Kern sichtbar auf
  const lad = z && z.art === 'angriff' ? glatt(0, 0.4, z.k) * (1 - glatt(0.45, 0.6, z.k)) : 0;
  if (z && z.art === 'besiegt' && z.k > 0.16) zerfallen(c, id, t, p, kampf, glatt(0.16, 1, z.k), z.staub);
  else if (sicht > 0.01) ZEICHNER[id](c, t, Math.min(1, p + lad));
  if (lad > 0) { leuchten(c, kampf.anker[0], kampf.anker[1], 60 + lad * 80, kampf.farbe, lad * 0.6); reflex(c, kampf.anker[0], kampf.anker[1], 120 * lad, kampf.farbe, lad); }
  c.restore();
  if (z) effekt(c, id, kampf, z, t);
  if (z && z.art === 'treffer') return (1 - glatt(0, 0.35, z.k)) * 0.75;
  if (z && z.art === 'besiegt') return glatt(0, 0.12, z.k) * (1 - glatt(0.12, 0.4, z.k)) * 0.8;
  return 0;
}

// Zerfallen: Die Figur wird auf eine eigene Ebene gemalt und in Dreiecke zerschnitten.
// Die Stücke treiben vom Kern weg, drehen sich, schrumpfen und lösen sich nacheinander auf; ihre Kanten glühen.
let zfEbene = null, zfStuecke = null, zfGroesse = '', zfStaub = null;
function zerfallen(c, id, t, p, kampf, f, sk0) {
  const W = c.canvas.width, H = c.canvas.height, m = c.getTransform();
  if (!zfEbene || zfEbene.width !== W || zfEbene.height !== H) { zfEbene = document.createElement('canvas'); zfEbene.width = W; zfEbene.height = H; }
  const e = zfEbene.getContext('2d');
  e.setTransform(1, 0, 0, 1, 0, 0); e.clearRect(0, 0, W, H);
  e.setTransform(m); ZEICHNER[id](e, t, p); e.setTransform(1, 0, 0, 1, 0, 0);
  if (zfGroesse !== W + 'x' + H) {
    zfGroesse = W + 'x' + H; zfStuecke = [];
    const n = 18, zw = W / n, zh = H / n, rnd = zufall(99);
    const pt = []; for (let y = 0; y <= n; y++) { pt.push([]); for (let x = 0; x <= n; x++) pt[y].push([x * zw + (x && x < n ? (rnd() - 0.5) * zw * 0.7 : 0), y * zh + (y && y < n ? (rnd() - 0.5) * zh * 0.7 : 0)]); }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = pt[y][x], b = pt[y][x + 1], cc = pt[y + 1][x + 1], d = pt[y + 1][x];
      for (const tri of (rnd() < 0.5 ? [[a, b, cc], [a, cc, d]] : [[a, b, d], [b, cc, d]])) zfStuecke.push({ tri, r: [rnd(), rnd(), rnd(), rnd()] });
    }
  }
  const anker = new DOMPoint(kampf.anker[0], kampf.anker[1]).matrixTransform(m);
  const sk = W / 560;
  // Staubkörner dort, wo die Figur war (einmal je Zerfall aus den Bildpunkten gewählt)
  if (!zfStaub || zfStaub.id !== id || zfStaub.W !== W || f < zfStaub.f) {
    const d = e.getImageData(0, 0, W, H).data, rnd = zufall(5), pk = [];
    for (let i = 0; i < 9000 && pk.length < 380; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H) | 0, o = (y * W + x) * 4;
      if (d[o + 3] > 60) pk.push({ x, y, c: [d[o], d[o + 1], d[o + 2]], r: rnd(), q: rnd() });
    }
    // Wind für diesen Zerfall: Richtung (nach links oder rechts, etwas schräg) und Stärke der Verwirbelung zufällig
    const seite = Math.random() < 0.5 ? -1 : 1, schraeg = (Math.random() - 0.6) * 0.7;
    const wirbel = Math.random() < 0.25 ? 0.15 + Math.random() * 0.2 : 0.4 + Math.random() * 1.2;
    zfStaub = { id, W, f, pk, wx: Math.cos(schraeg) * seite, wy: Math.sin(schraeg), wirbel, staerke: 0.75 + Math.random() * 0.6, wo: [Math.random() * 6, Math.random() * 6] };
  }
  zfStaub.f = f;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  for (const st of zfStuecke) {
    const [a, b, cc] = st.tri, [r1, r2, r3, r4] = st.r;
    const ende = 0.35 + r1 * 0.6;                        // jedes Stück löst sich zu einer anderen Zeit auf
    const sicht = 1 - glatt(ende - 0.25, ende, f);
    if (sicht <= 0.01) continue;
    const mx = (a[0] + b[0] + cc[0]) / 3, my = (a[1] + b[1] + cc[1]) / 3;
    let dx = mx - anker.x, dy = my - anker.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const weg = f * (30 + r2 * 150) * sk, auf = f * f * (20 + r3 * 60) * sk;
    const x = dx * weg + (r4 - 0.5) * 30 * f * sk, y = dy * weg * 0.7 - auf;
    const xs = [a[0], b[0], cc[0]], ys = [a[1], b[1], cc[1]];
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1), y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
    const x1 = Math.min(W, Math.ceil(Math.max(...xs)) + 1), y1 = Math.min(H, Math.ceil(Math.max(...ys)) + 1);
    c.save();
    c.translate(mx + x, my + y); c.rotate((r3 - 0.5) * 3.2 * f); const s2 = 1 - f * 0.45 * r2; c.scale(s2, s2); c.translate(-mx, -my);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.closePath();
    c.save(); c.clip(); c.globalAlpha = sicht; c.drawImage(zfEbene, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); c.restore();
    c.restore();
  }
  // Staub: erscheint, während die Splitter vergehen, schwebt eine Weile und wird vom Wind zur Seite geweht
  if (sk0 !== undefined) {
    const sz = sk0;
    for (let i = 0; i < zfStaub.pk.length; i++) {
      const s2 = zfStaub.pk[i], r = s2.r, q = s2.q;
      const da = glatt(0.12 + q * 0.12, 0.3 + q * 0.15, sz);
      const wind = glatt(0.5 + r * 0.18, 1, sz);
      const weg = 1 - glatt(0.62 + r * 0.25, 1, sz);
      const a = da * weg * (0.35 + q * 0.35);
      if (a < 0.01) continue;
      const st = zfStaub, weit = wind * wind * (240 + r * 320) * st.staerke * sk;
      // Verwirbelung: wellige Bahnen, mal ruhig, mal stark; je weiter der Staub fliegt, desto mehr dreht er
      const wb = st.wirbel * (0.3 + wind) * sk;
      const wbx = Math.sin(s2.y * 0.025 + t * 2.1 + st.wo[0] + r * 3) * 26 * wb + Math.sin(t * 3.7 + i) * 6 * wb;
      const wby = Math.cos(s2.x * 0.022 + t * 1.6 + st.wo[1] + q * 3) * 22 * wb + Math.cos(t * 2.9 + i * 1.3) * 5 * wb;
      const x = s2.x + Math.sin(t * 1.3 + i) * 4 * sk + st.wx * weit + wbx * wind;
      const y = s2.y - glatt(0.12, 1, sz) * (10 + q * 18) * sk + Math.cos(t * 0.9 + i * 1.7) * 3 * sk + st.wy * weit - wind * (10 + r * 30) * sk + wby * wind;
      const grau = (v) => Math.round(v * 0.35 + 150 * 0.65);
      c.fillStyle = `rgba(${grau(s2.c[0])},${grau(s2.c[1])},${grau(s2.c[2])},${a})`;
      const l = (1 + wind * 5) * sk;
      c.beginPath(); c.ellipse(x, y, (0.9 + q * 1.2) * sk + l, (0.9 + q * 1.2) * sk, Math.atan2(zfStaub.wy, zfStaub.wx) + Math.sin(t * 2 + i) * 0.4 * zfStaub.wirbel, 0, Math.PI * 2); c.fill();
    }
  }
  // glühende Kanten: nur dort, wo die Figur war (Figur hell aufgeblendet über die Lücken)
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = (1 - glatt(0, 0.6, f)) * 0.55;
  c.filter = 'blur(2px)';
  c.drawImage(zfEbene, 0, 0);
  c.filter = 'none';
  c.restore();
}

// Wirkung des Angriffs, vor dem Gegner gezeichnet (zur Gruppe hin)
function effekt(c, id, kampf, z, t) {
  const k = z.k, [ax, ay] = kampf.anker, f = kampf.farbe;
  const rnd = zufall(7);
  c.save(); c.globalCompositeOperation = 'lighter';
  if (z.art === 'angriff') {
    const s = glatt(0.4, 0.55, k) * (1 - glatt(0.6, 1, k));   // Stärke im Moment des Zustoßens
    const w = glatt(0.4, 1, k);                                  // wie weit die Welle ist
    if (kampf.art === 'stoss') {
      for (let i = 0; i < 3; i++) { const r = 30 + (w - i * 0.12) * 260; if (r < 30) continue; c.strokeStyle = hexA(f, s * (0.8 - i * 0.2)); c.lineWidth = 6 - i * 1.5; c.beginPath(); c.ellipse(0, -4, r, r * 0.18, 0, 0, TAU); c.stroke(); }
      for (let i = 0; i < 24; i++) { const a = rnd() * Math.PI, r = w * (80 + rnd() * 160); c.fillStyle = hexA(f, s); c.beginPath(); c.arc(Math.cos(a) * r, -4 - Math.sin(a) * r * 0.35 - w * rnd() * 60, 2 + rnd() * 2, 0, TAU); c.fill(); }
      leuchten(c, 0, -10, 200 * s, f, s * 0.5);
    } else if (kampf.art === 'strahl') {
      const b = s * (14 + rnd() * 4);
      const g = c.createLinearGradient(ax, ay, ax, 140); g.addColorStop(0, hexA('#ffffff', s)); g.addColorStop(0.3, hexA(f, s * 0.8)); g.addColorStop(1, hexA(f, s * 0.2));
      c.fillStyle = g; c.beginPath(); c.moveTo(ax - b * 0.4, ay); c.lineTo(ax + b * 0.4, ay); c.lineTo(ax + b * 5, 160); c.lineTo(ax - b * 5, 160); c.closePath(); c.fill();
      leuchten(c, ax, ay, 90 * s + 20, f, s); reflex(c, ax, ay, 260 * s, f, s);
      for (let i = 0; i < 16; i++) { const y = ay + rnd() * (160 - ay); c.fillStyle = hexA('#ffffff', s * rnd()); c.fillRect(ax + (rnd() - 0.5) * b * 6 * ((y - ay) / (160 - ay)), y, 2, 6); }
    } else if (kampf.art === 'biss' || kampf.art === 'klinge') {
      // Krallen- bzw. Klingenspuren quer vor dem Gegner
      const n = kampf.art === 'biss' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const a0 = -2.5 + i * 0.25, l = glatt(0.38, 0.5, k);
        c.save(); c.translate(ax * 0.6, ay * 0.6 + i * 18); c.rotate(kampf.art === 'klinge' ? -0.5 : 0.35);
        c.strokeStyle = hexA('#ffffff', s); c.lineWidth = kampf.art === 'klinge' ? 7 : 4; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 60, 150, a0, a0 + l * 1.4); c.stroke();
        c.strokeStyle = hexA(f, s * 0.7); c.lineWidth = kampf.art === 'klinge' ? 18 : 10; c.stroke();
        c.restore();
      }
      leuchten(c, ax * 0.6, ay * 0.6, 120 * s, f, s * 0.4);
    } else if (kampf.art === 'schwarm') {
      for (let i = 0; i < 30; i++) { const a = rnd() * TAU, r = 20 + rnd() * 60, vor = w * (1.5 + rnd()); const x = Math.cos(a) * r * (1 + vor * 2), y = ay + Math.sin(a) * r * 0.5 * (1 + vor) + vor * 120; c.save(); c.globalAlpha = s; kristall(c, x, y, 5 + vor * 6, 14 + vor * 18, f, 0.8, a); c.restore(); }
    } else if (kampf.art === 'dunkel') {
      c.globalCompositeOperation = 'source-over';
      const g = c.createRadialGradient(ax, ay, 10, ax, ay, 60 + w * 420); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, `rgba(2,2,6,${s * 0.85})`); g.addColorStop(1, 'rgba(2,2,6,0)');
      c.fillStyle = g; c.fillRect(-400, -500, 800, 700);
      c.globalCompositeOperation = 'lighter'; leuchten(c, ax - 14, ay, 30 * s, '#d8e8ff', s); leuchten(c, ax + 14, ay, 30 * s, '#d8e8ff', s);
    } else if (kampf.art === 'staub') {
      for (let i = 0; i < 60; i++) { const a = rnd() * TAU, r = w * (60 + rnd() * 200); c.fillStyle = hexA(['#8ef4ff', '#c9a6ff', '#ffd98a', '#8dffd0'][i % 4], s * (0.4 + rnd() * 0.6)); c.beginPath(); c.arc(ax + Math.cos(a) * r, ay + Math.sin(a) * r * 0.6 + w * 80, 1.5 + rnd() * 2.5, 0, TAU); c.fill(); }
      leuchten(c, ax, ay, 220 * s, '#ffffff', s * 0.35);
    } else if (kampf.art === 'gift') {
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2, r = w * (40 + rnd() * 180); const x = ax + Math.cos(a) * r, y = ay + Math.sin(a) * r * 0.4 + w * 100; const g = c.createRadialGradient(x, y, 0, x, y, 20 + w * 40); g.addColorStop(0, hexA(f, s * 0.45)); g.addColorStop(1, hexA(f, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, 20 + w * 40, 0, TAU); c.fill(); }
    } else if (kampf.art === 'feuer') {
      for (let i = 0; i < 40; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, r = w * (40 + rnd() * 220); const x = ax + Math.cos(a) * r * 1.4, y = ay + Math.sin(a) * r * 0.3 + w * 140 * rnd(); const col = rnd() < 0.3 ? '#fff0c0' : rnd() < 0.6 ? '#ffb347' : '#ff7a2a'; const g = c.createRadialGradient(x, y, 0, x, y, 8 + rnd() * 18); g.addColorStop(0, hexA(col, s)); g.addColorStop(1, hexA(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, 26, 0, TAU); c.fill(); }
      leuchten(c, ax, ay, 260 * s, FARBE.bernstein, s * 0.6);
    } else if (kampf.art === 'nova') {
      for (let i = 0; i < 4; i++) { const r = 40 + (w - i * 0.1) * 380; if (r < 40) continue; c.strokeStyle = hexA(i % 2 ? '#ffffff' : f, s * (1 - i * 0.2)); c.lineWidth = 8 - i * 1.5; c.beginPath(); c.arc(ax, ay, r, 0, TAU); c.stroke(); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t; bogen(c, ax, ay, ax + Math.cos(a) * 200 * w, ay + Math.sin(a) * 200 * w, f, t + i, s); }
    }
  } else if (z.art === 'treffer') {
    const s = 1 - glatt(0, 1, k);
    // Hieb über den Gegner und Splitter in seiner Farbe
    c.save(); c.translate(ax, ay); c.rotate(-0.7);
    const l = glatt(0, 0.25, k);
    c.strokeStyle = hexA('#ffffff', s); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-120 * l, 0); c.lineTo(120 * l, 0); c.stroke();
    c.strokeStyle = hexA('#ffe6b0', s * 0.6); c.lineWidth = 16; c.stroke();
    c.restore();
    leuchten(c, ax, ay, 110 * s, '#ffffff', s * 0.7);
    for (let i = 0; i < 18; i++) { const a = rnd() * TAU, v = 60 + rnd() * 160, r = glatt(0, 1, k) * v; c.save(); c.globalAlpha = s; kristall(c, ax + Math.cos(a) * r, ay + Math.sin(a) * r + k * k * 60, 3 + rnd() * 3, 8 + rnd() * 8, f, 0.6, a + k * 6); c.restore(); }
    c.strokeStyle = hexA(f, s * 0.8); c.lineWidth = 3; c.beginPath(); c.arc(ax, ay, 20 + k * 90, 0, TAU); c.stroke();
  } else if (z.art === 'besiegt') {
    // Kern flammt auf, ein Lichtring breitet sich aus, Funken steigen auf und verglühen
    const auf = glatt(0, 0.14, k) * (1 - glatt(0.16, 0.45, k));
    leuchten(c, ax, ay, 40 + auf * 280, f, auf);
    reflex(c, ax, ay, 320 * auf, f, auf);
    const r = glatt(0.14, 0.6, k);
    if (r > 0 && r < 1) { c.strokeStyle = hexA(f, (1 - r) * 0.8); c.lineWidth = 4 * (1 - r) + 1; c.beginPath(); c.arc(ax, ay, 20 + r * 260, 0, TAU); c.stroke(); }
    const z2 = glatt(0.16, 1, k);
    for (let i = 0; i < 46; i++) {
      const sx = ax + (rnd() - 0.5) * 180, sy = ay + (rnd() - 0.3) * 220, vy = 60 + rnd() * 160, ph = rnd();
      const a2 = Math.max(0, Math.sin(Math.min(1, z2 * 1.3 - ph * 0.3) * Math.PI));
      if (a2 <= 0) continue;
      c.fillStyle = hexA(i % 4 ? f : '#ffffff', a2 * 0.9);
      c.beginPath(); c.arc(sx + Math.sin(t * 2 + i) * 10 * z2, sy - vy * z2, 1.2 + rnd() * 2.2, 0, TAU); c.fill();
    }
  }
  c.restore();
}
// Wie stark wackelt das ganze Bild (beim Zustoßen)?
function wackeln(id, z) {
  if (!z || z.art !== 'angriff') return 0;
  const kampf = KAMPF[id] || {};
  const s = glatt(0.42, 0.5, z.k) * (1 - glatt(0.5, 0.8, z.k));
  return s * ({ stoss: 10, feuer: 9, nova: 12, biss: 6, klinge: 6 }[kampf.art] || 4);
}
export { wesenMalen, wackeln, KAMPF, DAUER };
