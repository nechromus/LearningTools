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
    .replace(/(\d) (€|cm|%|Min\.)/g, '$1\u00A0$2');
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
    const legende = segs.map((sg, i) => `<li><span class="leg-farbe" style="background:${sg.farbe || farben[i % 4]}"></span>${esc(sg.name)}: <b>${sg.prozent} %</b></li>`).join('');
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
  return '';
}

const SECHSECK = '12,1.5 21.5,7 21.5,17 12,22.5 2.5,17 2.5,7';

export function hinweisIcon(h, size = 40) {
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
    ${h.beispiel ? `<div class="hw-beispiel"><span class="hw-beispiel-label">Beispiel</span>${mathe(h.beispiel)}</div>` : ''}`;
}
