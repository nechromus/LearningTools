// Runenreihen: facettierte, funkelnde Edelsteine als SVG (eigene Schliffe, je Art eigene Farbe und Form)

// Farben je Art: hell, mittel, dunkel, Leuchten
const FARBEN = [
  ['#d9fff0', '#33d69c', '#0b5e44', '#5FE8B4'],   // 0 Jade (sechseckiger Kristall)
  ['#fff6cf', '#f2c443', '#7a5410', '#F6D26A'],   // 1 Gold (runder Brillant)
  ['#ffe0c2', '#ff7a2a', '#7a2a08', '#FF9A4D'],   // 2 Bernstein (breites Kissen)
  ['#e0f6ff', '#3fb4f0', '#0f3f6e', '#6FD0FF'],   // 3 Himmel (Dreieck)
  ['#f0e2ff', '#a46cf2', '#3a1878', '#C49BFF'],   // 4 Violett (Smaragdschliff)
  ['#ffe0ea', '#f03a6e', '#6e0a28', '#FF6E98']    // 5 Rubin (Navette)
];

// Umrisse (Viewbox 100 × 100), Tafel = verkleinerter Umriss
const UMRISS = [
  [[50, 3], [82, 21], [82, 79], [50, 97], [18, 79], [18, 21]],
  Array.from({ length: 10 }, (_, k) => { const w = (k / 10) * Math.PI * 2 - Math.PI / 2; return [50 + 44 * Math.cos(w), 52 + 44 * Math.sin(w)]; }),
  [[26, 14], [74, 14], [96, 50], [74, 86], [26, 86], [4, 50]],
  [[50, 6], [95, 88], [5, 88]],
  [[30, 8], [70, 8], [90, 28], [90, 72], [70, 92], [30, 92], [10, 72], [10, 28]],
  [[50, 2], [80, 30], [86, 54], [50, 98], [14, 54], [20, 30]]
];
const TAFEL = [0.48, 0.52, 0.5, 0.42, 0.56, 0.42];

const mischen = (a, b, t) => {
  const h = (x) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  const m = (u, v) => Math.round(u + (v - u) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
};
const pk = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const cache = new Map();

// Edelstein als SVG-Text. Licht kommt von oben links.
export function edelstein(art) {
  if (cache.has(art)) return cache.get(art);
  const [hell, mittel, dunkel] = FARBEN[art];
  const aussen = UMRISS[art];
  const cx = aussen.reduce((a, p) => a + p[0], 0) / aussen.length, cy = aussen.reduce((a, p) => a + p[1], 0) / aussen.length - 3;
  const innen = aussen.map(([x, y]) => [cx + (x - cx) * TAFEL[art], cy + (y - cy) * TAFEL[art]]);
  let facetten = '';
  for (let i = 0; i < aussen.length; i++) {
    const j = (i + 1) % aussen.length;
    const mx = (aussen[i][0] + aussen[j][0]) / 2 - cx, my = (aussen[i][1] + aussen[j][1]) / 2 - cy;
    // Helligkeit nach Richtung: oben links hell, unten rechts dunkel
    const licht = (-mx * 0.7 - my * 0.9) / Math.hypot(mx, my); // -1 … 1
    const farbe = licht > 0 ? mischen(mittel, hell, licht * 0.85) : mischen(mittel, dunkel, -licht * 0.8);
    facetten += `<polygon points="${pk([aussen[i], aussen[j], innen[j], innen[i]])}" fill="${farbe}"/>`;
  }
  // Tafel mit Verlauf und Glanzfacette, Funkeln als eigene Gruppe (blinkt per CSS)
  const id = 'rrv' + art;
  const glanz = [innen[0], innen[1 % innen.length], [cx, cy]];
  const svg = `<svg viewBox="0 0 100 100" class="rr-gem" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hell}"/><stop offset=".55" stop-color="${mittel}"/><stop offset="1" stop-color="${mischen(mittel, dunkel, 0.5)}"/></linearGradient></defs>
    <polygon points="${pk(aussen)}" fill="${dunkel}"/>
    ${facetten}
    <polygon points="${pk(innen)}" fill="url(#${id})"/>
    <polygon points="${pk(aussen)}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6" stroke-linejoin="round"/>
    <g class="rr-glanz"><polygon points="${pk(glanz)}" fill="#fff" opacity=".55"/>
      <path d="M${innen[0][0] - 2} ${innen[0][1] + 6} l2.5 -7 l2.5 7 l7 2.5 l-7 2.5 l-2.5 7 l-2.5 -7 l-7 -2.5 z" fill="#fff"/></g>
  </svg>`;
  cache.set(art, svg);
  return svg;
}

export const LEUCHTEN = FARBEN.map(f => f[3]);
