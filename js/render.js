import { KARTEN, ZEICHEN } from './hinweiskarten.js';
// Zeichnen: Bruch-Bilder, Kreisdiagramm, Kugel, Hinweis-Zeichen, Textformat.

const FUELL = '#E9B65A', LEER = '#FBFAF5', LINIE = '#1E2A2B';

export function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function bruchHtml(z, n, gross = false) {
  return `<span class="fr${gross ? ' fr-gross' : ''}" role="math" aria-label="${esc(z)} von ${esc(n)}"><span>${esc(z)}</span><span>${esc(n)}</span></span>`;
}

// Text sicher ausgeben, 3/4 als echten Bruch zeigen.
export function mathe(text) {
  return esc(text)
    .replace(/(\d+)\/(\d+)/g, (_, z, n) => bruchHtml(z, n))
    .replace(/([A-Za-zÄÖÜäöü]+)\u2044([A-Za-zÄÖÜäöü]+)/g, (_, z, n) => bruchHtml(z, n))   // Buchstaben-Bruch mit ⁄ (Kosinus: b⁄c)
    .replace(/(^|[\s(→=])([WGp])\/(\d+|[WGp])(?![\w\/])/g, (_, v, z, n) => v + bruchHtml(z, n))   // Prozentformel W/p = G/100 (Auftrag 47)
    .replace(/\bA_([GMO])\b/g, 'A<sub>$1</sub>')
    .replace(/\bV_(Quader|Kegel|Würfel)(?![\wäöüß])/g, 'V<sub>$1</sub>')
    .replace(/\bF_G\b/g, 'F<sub>G</sub>')
    .replace(/v₀/g, 'v<sub>0</sub>')
    .replace(/(\d) (€|cm|m(?![a-zäöüß])|%|Min\.)/g, '$1\u00A0$2');
}

export function formatWert(wert, einheit, stellen = null) {
  let t;
  if (stellen != null) t = wert.toFixed(stellen);   // feste Stellen (Kosinus: 4 nach dem Komma)
  else if (einheit === '€' && !Number.isInteger(wert)) t = wert.toFixed(2);
  else t = String(Math.round(wert * 1000) / 1000);
  t = t.replace('-', '−').replace('.', ',');
  return einheit ? `${t} ${einheit}` : t;
}

function svg(w, h, inhalt, label) {
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img" aria-label="${esc(label)}">${inhalt}</svg>`;
}

function torte(cx, cy, r, start, ende, fill) {
  // Winkel in Grad, 0 = 12 Uhr, im Uhrzeigersinn
  if (ende - start >= 359.999) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${LINIE}" stroke-width="1.5"/>`;
  const p = a => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  const [x1, y1] = p(start), [x2, y2] = p(ende);
  const gross = ende - start > 180 ? 1 : 0;
  return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${gross} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${fill}" stroke="${LINIE}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

export function bildSvg(bild, klein = false) {
  if (!bild) return '';
  const f = bild.form;
  if (f === 'dreieck') return dreieckSvg(bild);
  if (f === 'streifen') {
    const n = bild.teile, w = klein ? 150 : 300, h = klein ? 30 : 48, tw = (w - 4) / n;
    let s = '';
    for (let i = 0; i < n; i++) s += `<rect x="${2 + i * tw}" y="2" width="${tw}" height="${h - 4}" fill="${i < bild.gefaerbt ? FUELL : LEER}" stroke="${LINIE}" stroke-width="1.5"/>`;
    return svg(w, h, s, `Streifen mit ${n} Teilen, ${bild.gefaerbt} gefärbt`);
  }
  if (f === 'kreis') {
    const n = bild.teile, size = klein ? 64 : 120, r = size / 2 - 3, c = size / 2;
    let s = '';
    for (let i = 0; i < n; i++) s += torte(c, c, r, i * 360 / n, (i + 1) * 360 / n, i < bild.gefaerbt ? FUELL : LEER);
    return svg(size, size, s, `Kreis mit ${n} Teilen, ${bild.gefaerbt} gefärbt`);
  }
  if (f === 'quadrat' || f === 'rechteck') {
    const zeilen = bild.zeilen || 2, spalten = bild.spalten || 2;
    const zelle = klein ? 26 : 44;
    const w = spalten * zelle + 4, h = zeilen * zelle + 4;
    let s = '', k = 0;
    for (let r = 0; r < zeilen; r++) for (let c = 0; c < spalten; c++, k++) {
      s += `<rect x="${2 + c * zelle}" y="${2 + r * zelle}" width="${zelle}" height="${zelle}" fill="${k < bild.gefaerbt ? FUELL : LEER}" stroke="${LINIE}" stroke-width="1.5"/>`;
    }
    return svg(w, h, s, `${f === 'quadrat' ? 'Quadrat' : 'Rechteck'} mit ${zeilen * spalten} Feldern, ${bild.gefaerbt} gefärbt`);
  }
  if (f === 'kreisdiagramm') {
    const segs = (bild.segmente || []).map(sg => typeof sg === 'number' ? { prozent: sg } : sg);
    const farben = ['#1F6F75', '#E9B65A', '#9FC8C8', '#C98A5A'];
    const size = klein ? 70 : 150, r = size / 2 - 3, c = size / 2;
    let s = '', a = 0;
    segs.forEach((sg, i) => { const e = a + sg.prozent * 3.6; s += torte(c, c, r, a, e, sg.farbe || farben[i % 4]); a = e; });
    const torteSvg = svg(size, size, s, 'Kreisdiagramm');
    if (klein || !segs[0].name) return torteSvg;
    const legende = segs.map((sg, i) => `<li><span class="leg-farbe" style="background:${sg.farbe || farben[i % 4]}"></span>${esc(sg.name)}: <b>${sg.prozent_versteckt ? '?' : sg.prozent} %</b></li>`).join('');
    return `<div class="diagramm">${bild.titel ? `<div class="diagramm-titel">${esc(bild.titel)}</div>` : ''}<div class="diagramm-inhalt">${torteSvg}<ul class="legende">${legende}</ul></div></div>`;
  }
  if (f === 'kugel') {
    const w = klein ? 140 : 240, h = klein ? 120 : 190, cx = w / 2 - (klein ? 0 : 20), cy = h / 2, r = klein ? 50 : 80;
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#F6DCE6" stroke="${LINIE}" stroke-width="1.5"/>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.28}" fill="none" stroke="${LINIE}" stroke-width="1" stroke-dasharray="4 4"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${LINIE}"/>`;
    s += `<text x="${cx - 12}" y="${cy - 8}" font-size="14" font-weight="700" fill="${LINIE}">M</text>`;
    const beschr = klein ? '' : (bild.d ? `d = ${bild.d} cm` : bild.r ? `r = ${bild.r} cm` : '');
    if (bild.d || (!bild.r && klein)) {
      s += `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="#993556" stroke-width="3"/>`;
      if (beschr) s += `<text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="16" font-weight="700" fill="#72243E">${beschr}</text>`;
      if (klein) s += `<text x="${cx + r - 6}" y="${cy + 16}" font-size="12" font-weight="700" fill="#72243E">d</text>`;
    }
    if (bild.r || klein) {
      const ex = cx + r * Math.cos(-Math.PI / 4), ey = cy + r * Math.sin(-Math.PI / 4);
      s += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#1F6F75" stroke-width="3"/>`;
      if (beschr && bild.r) s += `<text x="${ex + 6}" y="${ey - 4}" font-size="16" font-weight="700" fill="#0E4A4F">${beschr}</text>`;
      if (klein) s += `<text x="${ex + 4}" y="${ey - 2}" font-size="12" font-weight="700" fill="#0E4A4F">r</text>`;
    }
    return svg(w, h, s, beschr ? `Kugel, ${beschr}` : 'Kugel mit Mittelpunkt, Radius und Durchmesser');
  }
  EINHEIT = bild.einheit || 'cm';
  if (f === 'zylinder') return zylinderSvg(bild);
  if (f === 'kegel') return kegelSvg(bild);
  if (f === 'pyramide') return pyramideSvg(bild);
  if (f === 'quader') return quaderSvg(bild);
  if (f === 'quader-kegel') return quaderKegelSvg(bild);
  return '';
}

// ---------- Körper: Zylinder, Kegel, Pyramide ----------
// Farben wie auf den Hinweiskarten: h rostrot (gestrichelt innen), s/hₛ blaugrün (dick außen), r/a gold, d beere.
const K = { h: '#993C1D', s: '#1F6F75', r: '#9A5B06', d: '#993556' };
const SCHRIFT = 'font-family="Atkinson Hyperlegible, sans-serif"';
let EINHEIT = 'cm';
const zahlCm = (v) => `${String(v).replace('.', ',')}\u00A0${EINHEIT}`;
const txt = (x, y, t, farbe, extra = '') => `<text x="${x}" y="${y}" font-size="15" font-weight="700" fill="${farbe}" ${SCHRIFT} ${extra}>${t}</text>`;
const pfeil = (x1, y1, x2, y2, farbe) => {
  const w = Math.atan2(y2 - y1, x2 - x1), sp = (x, y, a) => `M${(x + 8 * Math.cos(a + 0.5)).toFixed(1)} ${(y + 8 * Math.sin(a + 0.5)).toFixed(1)}L${x} ${y}L${(x + 8 * Math.cos(a - 0.5)).toFixed(1)} ${(y + 8 * Math.sin(a - 0.5)).toFixed(1)}`;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${farbe}" stroke-width="2.2"/><path d="${sp(x1, y1, w)}${sp(x2, y2, w + Math.PI)}" fill="none" stroke="${farbe}" stroke-width="2.2"/>`;
};
// Legende rechts: Wert groß, Erklärung klein, gleiche Farbe wie die Linie
const legende = (x, y0, zeilen) => zeilen.map(([t, klein, farbe], i) =>
  `<text x="${x}" y="${y0 + i * 44}" font-size="16" font-weight="700" fill="${farbe}" ${SCHRIFT}>${t}</text>` +
  (klein ? `<text x="${x}" y="${y0 + i * 44 + 17}" font-size="13" fill="${farbe}" ${SCHRIFT}>${klein}</text>` : '')).join('');

function zylinderSvg(b) {
  const cx = 95, rx = 66, ry = 16, oben = 46, unten = 168, linie = '#08506A';
  let s = `<path d="M${cx - rx} ${oben}V${unten}A${rx} ${ry} 0 0 0 ${cx + rx} ${unten}V${oben}Z" fill="#E9F4F8" stroke="${linie}" stroke-width="2"/>`;
  s += `<path d="M${cx - rx} ${unten}A${rx} ${ry} 0 0 1 ${cx + rx} ${unten}" fill="none" stroke="${linie}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  s += `<ellipse cx="${cx}" cy="${oben}" rx="${rx}" ry="${ry}" fill="#D7ECF3" stroke="${linie}" stroke-width="2"/>`;
  if (b.d != null) {
    s += pfeil(cx - rx + 2, oben, cx + rx - 2, oben, K.d);
    s += txt(cx, oben - ry - 8, `d = ${zahlCm(b.d)}`, K.d, 'text-anchor="middle"');
  } else {
    s += `<line x1="${cx}" y1="${oben}" x2="${cx + rx - 1}" y2="${oben}" stroke="${K.r}" stroke-width="2.8"/><circle cx="${cx}" cy="${oben}" r="3" fill="${LINIE}"/>`;
    if (b.r != null) s += txt(cx + rx / 2, oben - ry - 8, `r = ${zahlCm(b.r)}`, K.r, 'text-anchor="middle"');
  }
  if (b.h != null) {
    s += pfeil(cx + rx + 18, oben, cx + rx + 18, unten, K.h);
    s += txt(cx + rx + 28, (oben + unten) / 2 + 5, `h = ${zahlCm(b.h)}`, K.h);
  }
  const was = [b.r != null && `Radius ${zahlCm(b.r)}`, b.d != null && `Durchmesser ${zahlCm(b.d)}`, b.h != null && `Höhe ${zahlCm(b.h)}`].filter(Boolean).join(', ');
  return svg(270, 196, s, `Zylinder${was ? ': ' + was : ''}`);
}

function kegelSvg(b) {
  const cx = 95, rx = 72, ry = 17, spitze = 22, boden = 160, linie = '#8A2E08';
  let s = `<path d="M${cx - rx} ${boden}L${cx} ${spitze}L${cx + rx} ${boden}A${rx} ${ry} 0 0 1 ${cx - rx} ${boden}Z" fill="#FDF0E7"/>`;
  s += `<path d="M${cx - rx} ${boden}A${rx} ${ry} 0 0 1 ${cx + rx} ${boden}" fill="none" stroke="${linie}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  s += `<path d="M${cx - rx} ${boden}A${rx} ${ry} 0 0 0 ${cx + rx} ${boden}" fill="none" stroke="${linie}" stroke-width="2"/>`;
  s += `<line x1="${cx - rx}" y1="${boden}" x2="${cx}" y2="${spitze}" stroke="${linie}" stroke-width="2"/>`;
  const zeilen = [];
  if (b.s != null) {
    s += `<line x1="${cx + rx}" y1="${boden}" x2="${cx}" y2="${spitze}" stroke="${K.s}" stroke-width="4.5" stroke-linecap="round"/>`;
    s += txt(cx + rx / 2 + 12, (spitze + boden) / 2 - 2, 's', K.s);
  } else s += `<line x1="${cx + rx}" y1="${boden}" x2="${cx}" y2="${spitze}" stroke="${linie}" stroke-width="2"/>`;
  if (b.h != null) {
    s += `<line x1="${cx}" y1="${spitze}" x2="${cx}" y2="${boden}" stroke="${K.h}" stroke-width="2.4" stroke-dasharray="6 4"/>`;
    s += `<path d="M${cx} ${boden - 9}H${cx + 9}V${boden}" fill="none" stroke="${K.h}" stroke-width="1.5"/>`;
    s += txt(cx - 13, (spitze + boden) / 2 + 12, 'h', K.h, 'text-anchor="middle"');
  }
  if (b.d != null) {
    s += pfeil(cx - rx + 2, boden, cx + rx - 2, boden, K.d);
    s += txt(cx, boden + ry + 16, 'd', K.d, 'text-anchor="middle"');
  } else {
    s += `<line x1="${cx}" y1="${boden}" x2="${cx + rx - 1}" y2="${boden}" stroke="${K.r}" stroke-width="2.8"/>`;
    s += txt(cx + rx / 2, boden + ry + 14, 'r', K.r, 'text-anchor="middle"');
  }
  s += `<circle cx="${cx}" cy="${boden}" r="3" fill="${LINIE}"/>`;
  if (b.r != null) zeilen.push([`r = ${zahlCm(b.r)}`, 'Mitte bis Rand', K.r]);
  if (b.d != null) zeilen.push([`d = ${zahlCm(b.d)}`, 'ganz quer', K.d]);
  if (b.h != null) zeilen.push([`h = ${zahlCm(b.h)}`, 'gerade nach unten, innen', K.h]);
  if (b.s != null) zeilen.push([`s = ${zahlCm(b.s)}`, 'schräg außen', K.s]);
  s += legende(190, 106 - (zeilen.length - 1) * 22, zeilen);
  return svg(360, 200, s, `Kegel: ${zeilen.map(z => z[0]).join(', ')}`);
}

// ---------- Quader und Quader mit ausgeschnittenem Kegel (Auftrag 43) ----------
// Quader schräg: a vorne unten, b nach hinten, c senkrecht. Verdeckte Kanten gestrichelt.
function quaderGeom(b) {
  const W = 160, H = Math.max(70, Math.min(125, W * b.c / b.a)), L = Math.max(36, Math.min(72, 70 * b.b / b.a));
  const dx = L * 0.82, dy = -L * 0.57, x0 = 78, yB = 196, yT = yB - H;
  const P = { ftl: [x0, yT], ftr: [x0 + W, yT], fbl: [x0, yB], fbr: [x0 + W, yB] };
  for (const k of ['ftl', 'ftr', 'fbl', 'fbr']) P['b' + k.slice(1)] = [P[k][0] + dx, P[k][1] + dy];
  return { W, H, L, dx, dy, x0, yB, yT, P };
}
const pt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
function quaderKoerper(g, farben) {
  const { P } = g, f = farben;
  let s = `<path d="M${pt(P.ftl)}L${pt(P.ftr)}L${pt(P.fbr)}L${pt(P.fbl)}Z" fill="${f.vorne}" stroke="${f.linie}" stroke-width="2"/>`;
  s += `<path d="M${pt(P.ftr)}L${pt(P.btr)}L${pt(P.bbr)}L${pt(P.fbr)}Z" fill="${f.seite}" stroke="${f.linie}" stroke-width="2"/>`;
  s += `<path d="M${pt(P.ftl)}L${pt(P.btl)}L${pt(P.btr)}L${pt(P.ftr)}Z" fill="${f.oben}" stroke="${f.linie}" stroke-width="2"/>`;
  s += `<path d="M${pt(P.fbl)}L${pt(P.bbl)}L${pt(P.bbr)}M${pt(P.bbl)}L${pt(P.btl)}" fill="none" stroke="${f.linie}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  return s;
}
function quaderMasse(g, b, farbe) {
  const { P } = g, mb = [(P.fbr[0] + P.bbr[0]) / 2, (P.fbr[1] + P.bbr[1]) / 2];
  return txt((P.fbl[0] + P.fbr[0]) / 2, P.fbl[1] + 18, `a = ${zahlCm(b.a)}`, farbe.a, 'text-anchor="middle"')
    + txt(mb[0] + 10, mb[1] + 14, `b = ${zahlCm(b.b)}`, farbe.b)
    + txt(P.ftl[0] - 8, (P.ftl[1] + P.fbl[1]) / 2 + 5, `c = ${zahlCm(b.c)}`, farbe.c, 'text-anchor="end"');
}
const HALO = 'stroke="#fff" stroke-width="4" paint-order="stroke"';
const QF = { vorne: '#E9F4F8', seite: '#D7ECF3', oben: '#F3F9FB', linie: '#08506A' };
const QF_SCHULE = { vorne: '#FFFFFF', seite: '#F2F2F2', oben: '#FAFAFA', linie: LINIE };
function quaderSvg(b) {
  EINHEIT = b.einheit || 'cm';
  const g = quaderGeom(b);
  const s = quaderKoerper(g, QF) + quaderMasse(g, b, { a: K.r, b: K.s, c: K.h });
  return svg(360, 222, s, `Quader: a = ${zahlCm(b.a)}, b = ${zahlCm(b.b)}, c = ${zahlCm(b.c)}`);
}
function quaderKegelSvg(b) {
  EINHEIT = 'cm';
  const g = quaderGeom(b), farbig = !!b.farbig, f = farbig ? QF : QF_SCHULE, kl = farbig ? '#C2410C' : LINIE;
  const r = b.r != null ? b.r : b.d / 2;
  const c = [(g.P.ftl[0] + g.P.ftr[0]) / 2 + g.dx / 2, g.yT + g.dy / 2];   // Mitte der Deckfläche
  const rx = r * g.W / b.a, ry = Math.max(6, r * Math.abs(g.dy) / b.b), spitze = [c[0], c[1] + b.h * g.H / b.c];
  let s = quaderKoerper(g, f);
  // Kegel: Öffnung oben sichtbar, Seiten innen (gestrichelt), farbig orange
  s += `<path d="M${c[0] - rx} ${c[1]}L${pt(spitze)}L${c[0] + rx} ${c[1]}Z" fill="${farbig ? '#FCE3D3' : '#EDEDED'}" fill-opacity="${farbig ? 0.75 : 0.6}"/>`;
  s += `<ellipse cx="${c[0]}" cy="${c[1]}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${farbig ? '#F8C9A8' : '#DCDCDC'}" stroke="${kl}" stroke-width="2"/>`;
  s += `<path d="M${(c[0] - rx).toFixed(1)} ${c[1]}L${pt(spitze)}L${(c[0] + rx).toFixed(1)} ${c[1]}" fill="none" stroke="${kl}" stroke-width="1.6" stroke-dasharray="5 3"/>`;
  s += `<circle cx="${spitze[0]}" cy="${spitze[1].toFixed(1)}" r="2.6" fill="${kl}"/>`;
  s += `<line x1="${g.P.ftl[0]}" y1="${g.yT}" x2="${g.P.ftr[0]}" y2="${g.yT}" stroke="${f.linie}" stroke-width="2"/>`; // vordere Kante liegt vor dem Kegel
  // Maße: r bzw. d oben, h innen (Stufe 3 ohne h: die Spitze berührt den Boden)
  const mf = farbig ? { a: K.r, b: K.s, c: K.h, r: K.r, d: K.d, h: K.h } : { a: LINIE, b: LINIE, c: LINIE, r: LINIE, d: LINIE, h: LINIE };
  if (b.groesster) { /* größter Kegel: d = a und h = a selbst erkennen */ }
  else if (b.d != null) {
    s += pfeil(c[0] - rx + 2, c[1], c[0] + rx - 2, c[1], mf.d);
    s += txt(c[0], c[1] - ry - 6, `d = ${zahlCm(b.d)}`, mf.d, 'text-anchor="middle" ' + HALO);
  } else {
    s += `<line x1="${c[0]}" y1="${c[1]}" x2="${(c[0] + rx - 1).toFixed(1)}" y2="${c[1]}" stroke="${mf.r}" stroke-width="2.6"/><circle cx="${c[0]}" cy="${c[1]}" r="2.4" fill="${LINIE}"/>`;
    s += txt(c[0] + rx / 2, c[1] - ry - 6, `r = ${zahlCm(r)}`, mf.r, 'text-anchor="middle" ' + HALO);
  }
  if (!b.h_gleich) {
    s += `<line x1="${c[0]}" y1="${c[1]}" x2="${spitze[0]}" y2="${spitze[1].toFixed(1)}" stroke="${mf.h}" stroke-width="2" stroke-dasharray="3 3"/>`;
    const my = Math.max((c[1] + spitze[1]) / 2, c[1] + ry + 16);
    s += txt(c[0] - rx / 2 - 8, my + 5, `h = ${zahlCm(b.h)}`, mf.h, 'text-anchor="end" ' + HALO);
  }
  s += b.groesster ? txt((g.P.fbl[0] + g.P.fbr[0]) / 2, g.P.fbl[1] + 18, `a = ${zahlCm(b.a)}`, mf.a, 'text-anchor="middle"') : quaderMasse(g, b, mf);
  const kegel = b.groesster ? 'größter Kegel, der hineinpasst, Spitze unten auf dem Boden' : `Kegel ${b.d != null ? `d = ${zahlCm(b.d)}` : `r = ${zahlCm(r)}`}${b.h_gleich ? ', Spitze unten auf dem Boden' : `, h = ${zahlCm(b.h)}`}`;
  return svg(360, 222, s, `${b.groesster ? `Würfel a = ${zahlCm(b.a)}` : `Quader a = ${zahlCm(b.a)}, b = ${zahlCm(b.b)}, c = ${zahlCm(b.c)}`}, oben ein Kegel ausgeschnitten: ${kegel}`);
}

function pyramideSvg(b) {
  // Quadrat schräg von vorne: vorne links/rechts, hinten rechts/links; Spitze über der Mitte
  const vl = [30, 166], vr = [160, 166], hr = [212, 132], hl = [82, 132], m = [121, 149], sp = [121, 22], linie = '#5E4810';
  const P = (p) => `${p[0]} ${p[1]}`;
  let s = `<path d="M${P(vl)}L${P(vr)}L${P(hr)}L${P(sp)}Z" fill="#FAF5E8"/><path d="M${P(vl)}L${P(sp)}L${P(vr)}Z" fill="#F3EBD3"/>`;
  s += `<path d="M${P(vl)}L${P(hl)}L${P(hr)}M${P(sp)}L${P(hl)}" fill="none" stroke="${linie}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  s += `<path d="M${P(vr)}L${P(hr)}M${P(sp)}L${P(vl)}M${P(sp)}L${P(vr)}M${P(sp)}L${P(hr)}" fill="none" stroke="${linie}" stroke-width="2"/>`;
  s += `<line x1="${vl[0]}" y1="${vl[1]}" x2="${vr[0]}" y2="${vr[1]}" stroke="${K.r}" stroke-width="3.2"/>`;
  s += txt((vl[0] + vr[0]) / 2, vl[1] + 20, 'a', K.r, 'text-anchor="middle"');
  const zeilen = [[`a = ${zahlCm(b.a)}`, 'Seite vom Quadrat', K.r]];
  if (b.h != null) {
    s += `<line x1="${sp[0]}" y1="${sp[1]}" x2="${m[0]}" y2="${m[1]}" stroke="${K.h}" stroke-width="2.4" stroke-dasharray="6 4"/><circle cx="${m[0]}" cy="${m[1]}" r="3" fill="${LINIE}"/>`;
    s += txt(m[0] + 6, 124, 'h', K.h);
    zeilen.push([`h = ${zahlCm(b.h)}`, 'gerade nach unten, innen', K.h]);
  }
  if (b.hs != null) {
    const fm = [(vl[0] + vr[0]) / 2, vl[1]];
    s += `<line x1="${sp[0]}" y1="${sp[1]}" x2="${fm[0]}" y2="${fm[1]}" stroke="${K.s}" stroke-width="4.5" stroke-linecap="round"/>`;
    s += txt(92, 150, 'h<tspan font-size="11" dy="3">s</tspan>', K.s, 'text-anchor="end"');
    zeilen.push([`h<tspan font-size="11" dy="3">s</tspan><tspan dy="-3"> = ${zahlCm(b.hs)}</tspan>`, 'Seitenfläche, außen', K.s]);
  }
  s += legende(232, 106 - (zeilen.length - 1) * 22, zeilen);
  const lab = zeilen.map(z => z[0].replace(/<[^>]+>/g, '')).join(', ').replace('hs =', 'hₛ =');
  return svg(400, 200, s, `Pyramide: ${lab}`);
}

const SECHSECK = '12,1.5 21.5,7 21.5,17 12,22.5 2.5,17 2.5,7';

export function hinweisIcon(h, size = 40) {
  // Zeichen wie auf den gedruckten Hinweiskarten
  if (ZEICHEN[h.id]) return ZEICHEN[h.id].replace('<svg ', `<svg width="${size}" height="${size}" `);
  let inner;
  if (h.id === 'diagramm') {
    inner = `<circle cx="12" cy="12" r="5.2" fill="none" stroke="${h.farbe_text}" stroke-width="1.4"/><path d="M12,6.8 A5.2,5.2 0 0 1 12,17.2 Z" fill="${h.farbe_text}"/>`;
  } else {
    const len = [...h.symbol].length;
    const fs = len <= 1 ? 10 : len === 2 ? 8 : 6.5;
    inner = `<text x="12" y="12.4" text-anchor="middle" dominant-baseline="central" font-family="'Atkinson Hyperlegible', sans-serif" font-weight="700" font-size="${fs}" fill="${h.farbe_text}">${esc(h.symbol)}</text>`;
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><polygon points="${SECHSECK}" fill="${h.farbe_hell}" stroke="${h.farbe}" stroke-width="1.6" stroke-linejoin="round"/>${inner}</svg>`;
}

export function sechseck(size, fill, stroke, inhalt = '') {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>${inhalt}</svg>`;
}

export function hinweisBlatt(h) {
  // Karte wie auf dem gedruckten Hinweisblatt (Vorlage 07-hinweiskarten.html)
  if (KARTEN[h.id]) return `<div class="hinweiskarte">${KARTEN[h.id]}</div>`;
  let bild = '';
  if (h.bild) {
    if (h.bild.form === 'kreis') bild = `<div class="hw-bild">${bildSvg(h.bild)}${h.bild.daneben_gross ? (() => { const [z, n] = h.bild.daneben_gross.split('/'); return bruchHtml(z, n, true); })() : ''}</div>`;
    else if (h.bild.form === 'kugel') bild = `<div class="hw-bild">${bildSvg({ form: 'kugel' }, true)}<ul class="hw-beschr">${h.bild.beschriftung.map(b => `<li>${mathe(b)}</li>`).join('')}</ul></div>`;
    else if (h.bild.form === 'kreisdiagramm') bild = `<div class="hw-bild">${bildSvg({ form: 'kreisdiagramm', segmente: h.bild.segmente }, false)}</div>`;
  }
  const regeln = h.regeln.map(r => `<div class="hw-regel" style="border-color:${h.farbe}">${mathe(r)}</div>`).join('');
  return `
    <div class="hw-kopf">${hinweisIcon(h, 52)}<h2 class="hw-titel" style="color:${h.farbe_text}">${esc(h.titel)}</h2></div>
    ${bild}
    <div class="hw-regeln">${regeln}</div>
    ${h.achtung ? `<div class="hw-achtung"><b>Achtung:</b> ${mathe(h.achtung)}</div>` : ''}
    ${h.zusatz ? `<div class="hw-zusatz">${mathe(h.zusatz)}</div>` : ''}
    ${h.beispiel ? `<div class="hw-beispiel"><span class="hw-beispiel-label">Beispiel</span>${mathe(h.beispiel)}</div>` : ''}${h.beispiel2 ? `<div class="hw-beispiel"><span class="hw-beispiel-label">Beispiel</span>${mathe(h.beispiel2)}</div>` : ''}`;
}

// „Gleich viel gefärbt“ (Auftrag 17): Bild mit Linien zum Antippen.
// Linien dünn gestrichelt grau; gewählte und feste Linien dick in Teal. Um jede Linie ein 44 px breiter Tippbereich.
export function linienSvg(bild, { gewaehlt = [], fest = [], tippbar = false, alle = tippbar } = {}) {
  const TEAL = '#1F6F75', GRAU = '#8A9696';
  let s = '', w, h, seg;
  if (bild.form === 'kreis') {
    const n = bild.teile, size = 230, r = 100, c = size / 2;
    w = h = size;
    for (let i = 0; i < n; i++) s += torte(c, c, r, i * 360 / n, (i + 1) * 360 / n, i < bild.gefaerbt ? FUELL : LEER);
    seg = bild.linien.map(l => {
      const a = l.winkel * Math.PI / 180, dx = (r + 10) * Math.sin(a), dy = -(r + 10) * Math.cos(a);
      return [c - dx, c - dy, c + dx, c + dy];
    });
  } else {
    const streifen = bild.form === 'streifen';
    const zeilen = streifen ? 1 : (bild.zeilen || 2), spalten = streifen ? bild.teile : (bild.spalten || 2);
    const zx = streifen ? Math.min(32, 300 / spalten) : 60, zy = streifen ? 64 : 60, pad = 14;
    w = spalten * zx + 2 * pad; h = zeilen * zy + 2 * pad;
    let k = 0;
    for (let r = 0; r < zeilen; r++) for (let c = 0; c < spalten; c++, k++) {
      s += `<rect x="${pad + c * zx}" y="${pad + r * zy}" width="${zx}" height="${zy}" fill="${k < bild.gefaerbt ? FUELL : LEER}" stroke="${LINIE}" stroke-width="1.5"/>`;
    }
    seg = bild.linien.map(l => [pad + l.von[0] * zx, pad + l.von[1] * zy, pad + l.bis[0] * zx, pad + l.bis[1] * zy]);
  }
  seg.forEach(([x1, y1, x2, y2], i) => {
    const an = gewaehlt.includes(i) || fest.includes(i);
    const zeigen = alle || an;
    if (zeigen) s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${an ? TEAL : GRAU}" stroke-width="${an ? 6 : 2.5}"${an ? '' : ' stroke-dasharray="7 6"'} stroke-linecap="round"/>`;
    if (tippbar) s += `<line class="linie-tipp" data-act="linie" data-i="${i}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="transparent" stroke-width="44" role="button" aria-label="Linie ${i + 1}${an ? ', gewählt' : ''}"/>`;
  });
  return svg(w, h, s, `${bild.form === 'kreis' ? 'Kreis' : bild.form === 'streifen' ? 'Streifen' : 'Rechteck'} mit ${bild.gefaerbt} gefärbten Teilen${tippbar ? '. Linien zum Antippen' : ''}`);
}

// Mal 10 / durch 10 (Auftrag 36): Ziffern mit dem Komma und einem Pfeil, wie das Komma rutscht
export function stellentafelHtml({ x, mal, stellen = 1 }, mitErgebnis = false) {
  const f = 10 ** stellen;
  const res = Math.round((mal ? x * f : x / f) * 1000) / 1000;
  const z = (v) => String(v).replace('.', ',');
  const [g0, k0 = ''] = String(x).split('.');
  // Ziffern, die nur zum Rutschen dazukommen, sind grau: ,0 bei ganzen Zahlen, Nullen vorne bzw. hinten
  const dig = [...g0].map(d => [d, false]).concat((k0 || '0').split('').map(d => [d, !k0]));
  let alt = g0.length;
  while (!mal && alt - stellen < 1) { dig.unshift(['0', true]); alt++; }
  if (mal) for (let i = 0, n = stellen === 1 ? 1 : Math.max(0, stellen - k0.length); i < n; i++) dig.push(['0', true]);
  const neu = mal ? alt + stellen : alt - stellen;
  const W = 40, L = 10, yZ = 48, H = 98;
  const kx = (pos) => L + pos * W;
  const zif = dig.map(([d, grau], i) => `<text x="${L + i * W + W / 2}" y="${yZ}" text-anchor="middle" class="kt-z${grau ? ' grau' : ''}">${d}</text>`).join('');
  const x1 = kx(alt), x2 = kx(neu), ym = yZ + 30, tief = yZ + 46; // Pfeil unter der Zeile, flacher Bogen
  const pfeil = `<path d="M ${x1} ${ym} Q ${(x1 + x2) / 2} ${tief}, ${x2} ${ym}" class="kt-pfeil" marker-end="url(#kt-spitze)"/>`;
  const breite = L * 2 + dig.length * W;
  const wie = `${stellen === 1 ? 'eine Stelle' : stellen === 2 ? 'zwei Stellen' : stellen + ' Stellen'} nach ${mal ? 'rechts' : 'links'}`;
  const svg = `<svg class="komma-sprung" viewBox="0 0 ${breite} ${H}" width="${breite}" height="${H}" role="img" aria-label="${z(x)} ${mal ? 'mal' : 'durch'} ${f}: Das Komma rutscht ${wie}.">
    <defs><marker id="kt-spitze" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="kt-spitze"/></marker></defs>
    ${zif}<text x="${x1}" y="${yZ + 6}" text-anchor="middle" class="kt-komma alt">,</text><text x="${x2}" y="${yZ + 6}" text-anchor="middle" class="kt-komma neu">,</text>${pfeil}</svg>`;
  const ganzX = Number.isInteger(x) ? `<p>${z(x)} ist ${z(x)},0. Das Komma steht hinter der ${String(x).slice(-1)}.</p>` : '';
  return `<div class="komma-tipp">${ganzX}${svg}<p>${mal ? 'Mal' : 'Durch'} ${f}: Das Komma rutscht ${wie}. Die Ziffern bleiben.</p>${mitErgebnis ? `<p><b>${z(x)} ${mal ? '·' : ':'} ${f} = ${z(res)}</b></p>` : ''}</div>`;
}

// ---------- Daten und Säulendiagramm (Auftrag 54) ----------
const zahlAnz = (x) => String(x).replace('-', '−').replace('.', ',');
// Tabelle mit Kopfzeile. Kurze Überschriften (Spiel 1, Mo …) quer, Namen hochkant. mark: Werte, die gelb markiert werden.
export function tabelleHtml(bild, mark = []) {
  const sp = bild.spalten || [], ws = bild.werte || [];
  const m = (x) => mark.some(y => Math.abs(y - x) < 1e-9) ? ' class="tab-mark"' : '';
  // Quer nur, wenn alles auf ein Handy passt (sonst würde ein Wert aus dem Bild geschoben)
  const quer = sp.every(x => String(x).length <= 3) && (sp.length <= 6 || bild.kopf === 'Tag');
  if (quer) return `<table class="daten-tabelle quer"><tr><th scope="row">${esc(bild.kopf)}</th>${sp.map(x => `<th scope="col">${esc(x)}</th>`).join('')}</tr>
    <tr><th scope="row">${esc(bild.zeile)}</th>${ws.map(x => `<td${m(x)}>${esc(zahlAnz(x))}</td>`).join('')}</tr></table>`;
  return `<table class="daten-tabelle hoch"><tr><th scope="col">${esc(bild.kopf)}</th><th scope="col">${esc(bild.zeile)}</th></tr>
    ${sp.map((x, i) => `<tr><th scope="row">${esc(x)}</th><td${m(ws[i])}>${esc(zahlAnz(ws[i]))}</td></tr>`).join('')}</table>`;
}
// Säulendiagramm: Linie bei jedem Wert, Zahlen bei jedem 2. Wert. fehlt: Index der fehlenden Säule (gestrichelt, Höhe h).
// tippbar: jede Linie ist eine Tippfläche (data-act="saeuleTippen"). achseZeigen: Beschriftung links, sonst „?“.
export function saeulenSvg(bild, { h = null, tippbar = false, achseZeigen = true } = {}) {
  const kat = bild.kategorien || [], ws = bild.werte || [], oben = bild.oben || 10, n = kat.length;
  const W = 330, H = 250, x0 = 46, y0 = 205, yTop = 22, u = (y0 - yTop) / oben, bw = Math.min(46, (W - x0 - 14) / n - 14);
  const xs = (i) => x0 + 10 + i * ((W - x0 - 10) / n) + ((W - x0 - 10) / n - bw) / 2;
  let s = '';
  for (let v = 0; v <= oben; v++) {
    const y = y0 - v * u;
    s += `<line x1="${x0}" x2="${W - 4}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${v === 0 ? LINIE : '#C9D3D3'}" stroke-width="${v === 0 ? 1.6 : 1}"/>`;
    if (v % 2 === 0) s += `<text x="${x0 - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="${LINIE}">${v}</text>`;
  }
  s += `<line x1="${x0}" x2="${x0}" y1="${y0}" y2="${yTop - 6}" stroke="${LINIE}" stroke-width="1.6"/>`;
  kat.forEach((k, i) => {
    const x = xs(i), fehlt = bild.fehlt === i;
    const wert = fehlt ? h : ws[i];
    if (fehlt) s += `<rect x="${x.toFixed(1)}" y="${yTop}" width="${bw.toFixed(1)}" height="${(y0 - yTop).toFixed(1)}" fill="none" stroke="#C98A2C" stroke-dasharray="4 3" stroke-width="1.4"/>`;
    if (wert > 0) s += `<rect x="${x.toFixed(1)}" y="${(y0 - wert * u).toFixed(1)}" width="${bw.toFixed(1)}" height="${(wert * u).toFixed(1)}" fill="${fehlt ? '#E3A94B' : '#5AA89C'}" stroke="${LINIE}" stroke-width="1"/>`;
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${y0 + 16}" text-anchor="middle" font-size="${k.length > 8 ? 10 : 11.5}" fill="${LINIE}">${esc(k)}</text>`;
  });
  s += `<text x="13" y="${((y0 + yTop) / 2).toFixed(1)}" text-anchor="middle" font-size="12" fill="${LINIE}" transform="rotate(-90 13 ${((y0 + yTop) / 2).toFixed(1)})">${achseZeigen ? esc(bild.achse) : '?'}</text>`;
  if (tippbar) for (let v = 1; v <= oben; v++) {
    const y = y0 - v * u;
    s += `<rect class="saeule-tipp" data-act="saeuleTippen" data-v="${v}" x="${x0}" y="${(y - u / 2).toFixed(1)}" width="${W - x0 - 4}" height="${u.toFixed(1)}" fill="transparent"><title>Höhe ${v}</title></rect>`;
  }
  const titel = bild.titel ? `<div class="saeulen-titel">${esc(bild.titel)}</div>` : '';
  return `${titel}<svg class="saeulen-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Säulendiagramm: ${esc(kat.map((k, i) => `${k} ${bild.fehlt === i ? 'fehlt' : ws[i]}`).join(', '))}">${s}</svg>`;
}

// ---------- Rechtwinkliges Dreieck (Kosinus, Auftrag 55) ----------
// bild: { form: 'dreieck', lage (0–9 oder 'sach'), an, geg (Längen fürs Bild), winkel ('α'), namen {hyp, an, geg},
//         laengen? {hyp, an, geg} (Text neben dem Buchstaben), deko? ('boden' | 'wand'), farbig? (Merkbild: Hypotenuse blau, Ankathete rot) }
// Lagen 0–3: um 0/90/180/270° gedreht, 4–7 dazu gespiegelt, 8/9: Hypotenuse waagerecht (rechter Winkel oben/unten), 'sach': Boden unten, rechter Winkel rechts.
export const KOS_BLAU = '#1D4ED8', KOS_ROT = '#C2410C', KOS_GRUEN = '#15803D';   // Gegenkathete grün (Auftrag 69)
export function dreieckLage(bild) {
  const an = bild.an || 4, geg = bild.geg || 3;
  let P = { R: [0, 0], W: [an, 0], T: [0, geg] };
  const lage = bild.lage;
  const dreh = (p, f) => [p[0] * Math.cos(f) - p[1] * Math.sin(f), p[0] * Math.sin(f) + p[1] * Math.cos(f)];
  const alle = (f) => { for (const k in P) P[k] = f(P[k]); };
  if (lage === 'sach') alle(p => [-p[0], p[1]]);
  else if (lage === 'sach-oben') alle(p => dreh(p, Math.PI / 2));   // Winkel oben an der Wand, rechter Winkel unten rechts
  else if (lage === 8 || lage === 9) {
    const phi = Math.atan2(P.T[1] - P.W[1], P.T[0] - P.W[0]);
    alle(p => dreh(p, -phi));
    const oben = P.R[1] > P.W[1];
    if ((lage === 8) !== oben) alle(p => dreh(p, Math.PI));
  } else {
    const l = Number(lage) || 0;
    if (l >= 4) alle(p => [-p[0], p[1]]);
    alle(p => dreh(p, (l % 4) * Math.PI / 2));
  }
  return P;
}
export function dreieckSvg(bild, { breite = 330, hoehe = 220 } = {}) {
  const P0 = dreieckLage(bild);
  const xs = Object.values(P0).map(p => p[0]), ys = Object.values(P0).map(p => -p[1]);
  const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
  // 1. Durchgang: wie weit ragen die Beschriftungen über das Dreieck hinaus? 2. Durchgang: so groß wie möglich
  const s1 = Math.min((breite - 120) / bw, (hoehe - 60) / bh);
  const z1 = dreieckZeichnen(bild, P0, bx, by, s1, 0, 0);
  const ueL = Math.max(8, -z1.box[0]), ueR = Math.max(8, z1.box[1] - bw * s1), ueO = Math.max(8, -z1.box[2]), ueU = Math.max(8, z1.box[3] - bh * s1);
  const s = Math.min((breite - ueL - ueR) / bw, (hoehe - ueO - ueU) / bh);
  const z = dreieckZeichnen(bild, P0, bx, by, s, ueL, ueO);
  const w = Math.round(bw * s + ueL + ueR), h = Math.round(bh * s + ueO + ueU);
  const n = bild.namen || { hyp: 'c', an: 'b', geg: 'a' };
  const label = `Rechtwinkliges Dreieck. Rechter Winkel zwischen ${n.an} und ${n.geg}. Winkel ${bild.winkel || 'α'} zwischen ${n.an} und ${n.hyp}.`;
  return svg(w, h, z.inhalt, label);
}
function dreieckZeichnen(bild, P0, bx, by, s, ox, oy) {
  const P = {}, box = [Infinity, -Infinity, Infinity, -Infinity];
  const merke = (x0, x1, y0, y1) => { box[0] = Math.min(box[0], x0 - ox); box[1] = Math.max(box[1], x1 - ox); box[2] = Math.min(box[2], y0 - oy); box[3] = Math.max(box[3], y1 - oy); };
  for (const k in P0) P[k] = [ox + (P0[k][0] - bx) * s, oy + (-P0[k][1] - by) * s];
  const f = (x) => Math.round(x * 10) / 10;
  const M = [(P.R[0] + P.W[0] + P.T[0]) / 3, (P.R[1] + P.W[1] + P.T[1]) / 3];
  const einh = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
  const n = bild.namen || { hyp: 'c', an: 'b', geg: 'a' }, L = bild.laengen || {};
  // farbig: true = Kosinus (Hypotenuse blau, Ankathete rot); 'sin' bzw. 'tan' (Auftrag 69): dazu Gegenkathete grün, die nicht gebrauchte Seite dünn
  const fb = bild.farbig;
  const farbe = { hyp: fb && fb !== 'tan' ? KOS_BLAU : LINIE, an: fb ? KOS_ROT : LINIE, geg: fb === 'sin' || fb === 'tan' ? KOS_GRUEN : LINIE };
  const dick = (k) => !!fb && (fb === true ? k !== 'geg' : fb === 'sin' ? k !== 'an' : k !== 'hyp');
  const seiten = { hyp: [P.W, P.T], an: [P.R, P.W], geg: [P.R, P.T] };
  let inhalt = '';
  // Deko: Boden (Rampe, Dach) bzw. Boden und Wand (Leiter)
  // Boden = die Kathete unten (waagerecht), Wand = die Kathete am rechten Winkel nach oben
  const bodenK = bild.lage === 'sach-oben' ? 'geg' : 'an', wandK = bodenK === 'an' ? 'geg' : 'an';
  if (bild.deko) {
    const [a, b] = seiten[bodenK], y = Math.max(a[1], b[1]) + 1.5;
    inhalt += `<line x1="${f(Math.min(a[0], b[0]) - 22)}" y1="${f(y)}" x2="${f(Math.max(a[0], b[0]) + 22)}" y2="${f(y)}" stroke="#8A7F6A" stroke-width="3"/>`;
    const oben = Math.min(...seiten[wandK].map(q => q[1]));
    if (bild.deko === 'wand') inhalt += `<rect x="${f(P.R[0])}" y="${f(oben - 10)}" width="10" height="${f(P.R[1] - oben + 11)}" fill="#E7E1D3" stroke="#8A7F6A" stroke-width="1.5"/>`;
  }
  for (const k of ['geg', 'an', 'hyp']) {
    const [a, b] = seiten[k];
    inhalt += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${farbe[k]}" stroke-width="${dick(k) ? 4.5 : 2.5}" stroke-linecap="round"/>`;
  }
  // rechter Winkel: kleines Quadrat mit Punkt
  const u = einh(P.R, P.W), v = einh(P.R, P.T), q = 15;
  const pt = (k1, k2) => `${f(P.R[0] + u[0] * k1 + v[0] * k2)},${f(P.R[1] + u[1] * k1 + v[1] * k2)}`;
  inhalt += `<polyline points="${pt(q, 0)} ${pt(q, q)} ${pt(0, q)}" fill="none" stroke="${LINIE}" stroke-width="1.6"/>`;
  const dp = pt(q / 2, q / 2).split(',');
  inhalt += `<circle cx="${dp[0]}" cy="${dp[1]}" r="2" fill="${LINIE}"/>`;
  // gesuchter Winkel: Bogen und Name
  const a1 = einh(P.W, P.R), a2 = einh(P.W, P.T), rb = 28;
  const kreuz = a1[0] * a2[1] - a1[1] * a2[0];
  inhalt += `<path d="M ${f(P.W[0] + a1[0] * rb)} ${f(P.W[1] + a1[1] * rb)} A ${rb} ${rb} 0 0 ${kreuz > 0 ? 1 : 0} ${f(P.W[0] + a2[0] * rb)} ${f(P.W[1] + a2[1] * rb)}" fill="none" stroke="${LINIE}" stroke-width="1.6"/>`;
  inhalt += `<path d="M ${f(P.W[0])} ${f(P.W[1])} L ${f(P.W[0] + a1[0] * rb)} ${f(P.W[1] + a1[1] * rb)} A ${rb} ${rb} 0 0 ${kreuz > 0 ? 1 : 0} ${f(P.W[0] + a2[0] * rb)} ${f(P.W[1] + a2[1] * rb)} Z" fill="#F6D88E" fill-opacity="0.55" stroke="none"/>`;
  const bi = einh([0, 0], [a1[0] + a2[0], a1[1] + a2[1]]);
  // Winkelgröße (Auftrag 69, Seite berechnen): „β = 31°“ etwas weiter außen im Winkel
  if (bild.winkelWert) {
    const wx = P.W[0] + bi[0] * 62, wy = P.W[1] + bi[1] * 62 + 6, tw = 70, anker = bi[0] > 0.3 ? 'start' : bi[0] < -0.3 ? 'end' : 'middle';
    const x0 = anker === 'start' ? wx - 10 : anker === 'end' ? wx - tw + 10 : wx - tw / 2;
    merke(x0, x0 + tw, wy - 18, wy + 6);
    inhalt += `<text x="${f(wx)}" y="${f(wy)}" text-anchor="${anker}" font-size="18" fill="${LINIE}"><tspan font-style="italic">${esc(bild.winkel || 'α')}</tspan> = <tspan font-weight="700">${esc(bild.winkelWert)}</tspan></text>`;
  } else inhalt += `<text x="${f(P.W[0] + bi[0] * 44)}" y="${f(P.W[1] + bi[1] * 44 + 6)}" text-anchor="middle" font-size="19" font-style="italic" fill="${LINIE}">${esc(bild.winkel || 'α')}</text>`;
  // Seiten beschriften: außen neben der Mitte
  for (const k of ['hyp', 'an', 'geg']) {
    const [a, b] = seiten[k], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let no = [-(b[1] - a[1]), b[0] - a[0]];
    const d = Math.hypot(...no) || 1; no = [no[0] / d, no[1] / d];
    if ((m[0] - M[0]) * no[0] + (m[1] - M[1]) * no[1] < 0) no = [-no[0], -no[1]];
    const ab = bild.deko === 'wand' && k === wandK ? 26 : 14;
    const x = m[0] + no[0] * ab, y = m[1] + no[1] * ab + 6 + (no[1] > 0.5 ? 6 : no[1] < -0.5 ? -4 : 0);
    const anker = no[0] > 0.35 ? 'start' : no[0] < -0.35 ? 'end' : 'middle';
    const txt = `<tspan font-style="italic">${esc(n[k])}</tspan>${L[k] ? ` = ${esc(String(L[k]))}` : ''}`;
    const fs = bild.farbig ? 15 : 17, tw = (String(n[k]).length + (L[k] ? String(L[k]).length + 3 : 0)) * fs * 0.56;
    const x0 = anker === 'start' ? x : anker === 'end' ? x - tw : x - tw / 2;
    merke(x0 - 4, x0 + tw + 4, y - fs - 2, y + 6);
    inhalt += `<text x="${f(x)}" y="${f(y)}" text-anchor="${anker}" font-size="${fs}" font-weight="${dick(k) ? 700 : 400}" fill="${farbe[k] === LINIE ? LINIE : farbe[k]}">${txt}</text>`;
  }
  if (bild.deko) { const bo = seiten[bodenK]; merke(Math.min(bo[0][0], bo[1][0]) - 24, Math.max(bo[0][0], bo[1][0]) + (bild.deko === 'wand' ? 12 : 24), Math.min(P.R[1], P.W[1], P.T[1]) - 12, Math.max(bo[0][1], bo[1][1]) + 4); }
  return { inhalt, box };
}
