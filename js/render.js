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
    .replace(/\bA_([GMO])\b/g, 'A<sub>$1</sub>')
    .replace(/\bF_G\b/g, 'F<sub>G</sub>')
    .replace(/v₀/g, 'v<sub>0</sub>')
    .replace(/(\d) (€|cm|m(?![a-zäöüß])|%|Min\.)/g, '$1\u00A0$2');
}

export function formatWert(wert, einheit) {
  let t;
  if (einheit === '€' && !Number.isInteger(wert)) t = wert.toFixed(2);
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
export function stellentafelHtml({ x, mal }, mitErgebnis = false) {
  const res = Math.round((mal ? x * 10 : x / 10) * 1000) / 1000;
  const z = (v) => String(v).replace('.', ',');
  const [g0, k0 = ''] = String(x).split('.');
  // Ziffern, die nur zum Rutschen dazukommen, sind grau: ,0 bei ganzen Zahlen, eine 0 vorne bzw. hinten
  const dig = [...g0].map(d => [d, false]).concat((k0 || '0').split('').map(d => [d, !k0]));
  let alt = g0.length;
  if (!mal && alt === 1) { dig.unshift(['0', true]); alt = 2; }
  if (mal) dig.push(['0', true]);
  const neu = mal ? alt + 1 : alt - 1;
  const W = 40, L = 10, yZ = 48, H = 98;
  const kx = (pos) => L + pos * W;
  const zif = dig.map(([d, grau], i) => `<text x="${L + i * W + W / 2}" y="${yZ}" text-anchor="middle" class="kt-z${grau ? ' grau' : ''}">${d}</text>`).join('');
  const x1 = kx(alt), x2 = kx(neu), ym = yZ + 30, tief = yZ + 46; // Pfeil unter der Zeile, flacher Bogen
  const pfeil = `<path d="M ${x1} ${ym} Q ${(x1 + x2) / 2} ${tief}, ${x2} ${ym}" class="kt-pfeil" marker-end="url(#kt-spitze)"/>`;
  const breite = L * 2 + dig.length * W;
  const svg = `<svg class="komma-sprung" viewBox="0 0 ${breite} ${H}" width="${breite}" height="${H}" role="img" aria-label="${z(x)} ${mal ? 'mal' : 'durch'} 10: Das Komma rutscht eine Stelle nach ${mal ? 'rechts' : 'links'}.">
    <defs><marker id="kt-spitze" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="kt-spitze"/></marker></defs>
    ${zif}<text x="${x1}" y="${yZ + 6}" text-anchor="middle" class="kt-komma alt">,</text><text x="${x2}" y="${yZ + 6}" text-anchor="middle" class="kt-komma neu">,</text>${pfeil}</svg>`;
  const ganzX = Number.isInteger(x) ? `<p>${z(x)} ist ${z(x)},0. Das Komma steht hinter der ${String(x).slice(-1)}.</p>` : '';
  return `<div class="komma-tipp">${ganzX}${svg}<p>${mal ? 'Mal 10' : 'Durch 10'}: Das Komma rutscht eine Stelle nach ${mal ? 'rechts' : 'links'}. Die Ziffern bleiben.</p>${mitErgebnis ? `<p><b>${z(x)} ${mal ? '·' : ':'} 10 = ${z(res)}</b></p>` : ''}</div>`;
}
