// Runenbrecher: Anzeige und Steuerung als Baustein (wie runenfall-ui.js).
// Regeln in ./runenbrecher.js, Aussehen in ../runenbrecher/rb.css (unter .rb, nutzt Grundstile aus km.css).
// Gezeichnet wird auf einem Canvas, Tafeln liegen als HTML darüber.
//
// runenbrecherStarten(wurzel, {
//   stand,              // gespeicherter Fortschritt (oder null)
//   sichern(stand),     // Fortschritt speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll ('rb_level')
//   darfLaufen(),       // false, wenn gerade nicht gespielt werden darf
//   hinweisZusatz,
// }) → { beenden(), anhalten(), stand(), ruht() }
import * as B from './runenbrecher.js';

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TASTEN_TEMPO = 110; // Einheiten pro Sekunde mit den Pfeiltasten
const FARBEN = {
  n: ['#8ff5d2', '#2a9c76', '#155a45'],
  s: ['#d9c2ff', '#8569c9', '#45346e'],
  g: ['#fff2c4', '#d8b05a', '#6e5420'],
  x: ['#7d8a86', '#46514e', '#252c2a']
};
const EXTRA_TEXT = { breit: 'Breiter Schild', zwei: 'Zwei Kugeln', langsam: 'Langsamer' };

// ---------- Zeichnen (auch für Vorschau und Anleitung, damit alles gleich aussieht) ----------

// Steinbild einmal vorzeichnen (schneller als jedes Mal Verläufe)
function steinBildMalen(art, riss, massstab, dpr) {
  const w = Math.ceil(B.STEIN.breite * massstab * dpr), h = Math.ceil(B.STEIN.hoehe * massstab * dpr);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const [c1, c2, c3] = FARBEN[art];
  const r = Math.min(h * 0.28, 6 * dpr);
  const gr = x.createLinearGradient(0, 0, w * 0.4, h);
  gr.addColorStop(0, c1); gr.addColorStop(0.55, c2); gr.addColorStop(1, c3);
  x.fillStyle = gr;
  rund(x, 0, 0, w, h, r); x.fill();
  // Kanten
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = Math.max(1, dpr);
  x.beginPath(); x.moveTo(r, dpr); x.lineTo(w - r, dpr); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.45)';
  x.beginPath(); x.moveTo(r, h - dpr); x.lineTo(w - r, h - dpr); x.stroke();
  // Rune in der Mitte
  if (art !== 'x') {
    x.fillStyle = art === 'g' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)';
    const cx = w / 2, cy = h / 2, rr = h * 0.32;
    x.beginPath(); x.moveTo(cx, cy - rr); x.lineTo(cx + rr * 0.3, cy - rr * 0.3); x.lineTo(cx + rr, cy); x.lineTo(cx + rr * 0.3, cy + rr * 0.3);
    x.lineTo(cx, cy + rr); x.lineTo(cx - rr * 0.3, cy + rr * 0.3); x.lineTo(cx - rr, cy); x.lineTo(cx - rr * 0.3, cy - rr * 0.3); x.closePath(); x.fill();
  } else {
    x.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(w * (0.18 + k * 0.21), h * (k % 2 ? 0.65 : 0.35), h * 0.09, 0, 7); x.fill(); }
  }
  if (riss) {
    x.strokeStyle = 'rgba(15,10,30,0.8)'; x.lineWidth = Math.max(1.2, 1.4 * dpr);
    x.beginPath(); x.moveTo(w * 0.22, 0); x.lineTo(w * 0.32, h * 0.45); x.lineTo(w * 0.24, h * 0.7); x.lineTo(w * 0.34, h);
    x.moveTo(w * 0.32, h * 0.45); x.lineTo(w * 0.5, h * 0.55);
    x.moveTo(w * 0.78, 0); x.lineTo(w * 0.7, h * 0.5); x.lineTo(w * 0.8, h); x.stroke();
  }
  return c;
}

function rund(x, a, b, w, h, r) {
  x.beginPath();
  x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
  x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
  x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
  x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
}

// Ganze Szene malen. z: { steine, extras, schild: { x, breite }, kugeln: [{x,y}], spuren: Map, teilchen, beben, blitz }
// ansicht: { massstab, dpr, steinBild(art, riss), ausschnitt: { x, y } (optional, in Feld-Einheiten) }
function szeneMalen(ctx, canvas, z, ansicht) {
  const { massstab, dpr, steinBild } = ansicht;
  const m = massstab * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (z.beben > 0 && !ruhig()) ctx.translate((Math.random() - 0.5) * z.beben * dpr, (Math.random() - 0.5) * z.beben * dpr);
  // Hintergrund: dunkle Höhle mit leichtem Raster
  const bg = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.35, 10, canvas.width / 2, canvas.height * 0.4, canvas.height * 0.8);
  bg.addColorStop(0, '#141b1c'); bg.addColorStop(1, '#07090a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (ansicht.ausschnitt) ctx.translate(-ansicht.ausschnitt.x * m, -ansicht.ausschnitt.y * m);
  ctx.strokeStyle = 'rgba(95,232,180,0.04)'; ctx.lineWidth = 1;
  for (let gx = 10; gx < B.BREITE; gx += 10) { ctx.beginPath(); ctx.moveTo(gx * m, 0); ctx.lineTo(gx * m, B.HOEHE * m); ctx.stroke(); }
  // Steine
  for (const st of z.steine || []) {
    const q = B.steinRechteck(st);
    const bild = steinBild(st.art, st.art === 's' && st.hp === 1);
    if (st.art === 'g') { ctx.shadowColor = 'rgba(216,176,90,0.7)'; ctx.shadowBlur = 8 * dpr; }
    ctx.drawImage(bild, q.x * m, q.y * m, q.w * m, q.h * m);
    ctx.shadowBlur = 0;
  }
  // Extras
  for (const e of z.extras || []) {
    const x = e.x * m, y = e.y * m, r = 2.6 * m;
    ctx.shadowColor = e.art === 'langsam' ? '#6ec6e8' : e.art === 'zwei' ? '#5FE8B4' : '#D8B05A'; ctx.shadowBlur = 10 * dpr;
    ctx.fillStyle = ctx.shadowColor;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0c1011'; ctx.font = `700 ${Math.round(2.6 * m)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.art === 'breit' ? '↔' : e.art === 'zwei' ? '2' : '~', x, y + 0.2 * m);
  }
  // Teilchen
  for (const t of z.teilchen || []) {
    ctx.globalAlpha = Math.max(0, t.leben / t.dauer);
    ctx.fillStyle = t.farbe;
    ctx.fillRect((t.x - t.g / 2) * m, (t.y - t.g / 2) * m, t.g * m, t.g * m);
  }
  ctx.globalAlpha = 1;
  // Schild
  if (z.schild) {
    const b = z.schild.breite, sx = (z.schild.x - b / 2) * m, sy = B.SCHILD.y * m, sw = b * m, sh = B.SCHILD.hoehe * m;
    ctx.shadowColor = 'rgba(216,176,90,0.6)'; ctx.shadowBlur = 12 * dpr;
    const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    sg.addColorStop(0, '#fff2c4'); sg.addColorStop(0.45, '#d8b05a'); sg.addColorStop(1, '#6e5420');
    ctx.fillStyle = sg; rund(ctx, sx, sy, sw, sh, sh / 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(60,40,10,0.55)';
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(sx + sw * k / 4, sy + sh / 2, sh * 0.16, 0, 7); ctx.fill(); }
  }
  // Kugeln mit Leuchtspur
  (z.kugeln || []).forEach((k, i) => {
    const spur = (z.spuren && z.spuren.get(i)) || [];
    spur.forEach((p, j) => {
      const a = (j + 1) / spur.length;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = '#5FE8B4';
      ctx.beginPath(); ctx.arc(p.x * m, p.y * m, B.RADIUS * m * (0.4 + 0.6 * a), 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const x = k.x * m, y = k.y * m, r = B.RADIUS * m;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    halo.addColorStop(0, 'rgba(185,255,226,0.55)'); halo.addColorStop(1, 'rgba(95,232,180,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill();
    const kg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    kg.addColorStop(0, '#ffffff'); kg.addColorStop(0.5, '#7ff2c6'); kg.addColorStop(1, '#1E7A5F');
    ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  });
  // Blitz über allem (Level geschafft)
  if (z.blitz > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.3, 0, canvas.width / 2, canvas.height * 0.3, canvas.height * 0.7);
    g.addColorStop(0, `rgba(246,223,162,${0.6 * z.blitz})`); g.addColorStop(1, 'rgba(246,223,162,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Standbild für Vorschau und Anleitung (nur im Browser). szene: { steine, extras, schild, kugeln, spuren: { 0: [{x,y}] } }
// ausschnitt { x, y, w, h } in Feld-Einheiten (Standard: ganzes Feld). Gibt eine Daten-URL zurück.
export function runenbrecherBild(breitePx, hoehePx, szene = {}, ausschnitt = null) {
  const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const aus = ausschnitt || { x: 0, y: 0, w: B.BREITE, h: B.HOEHE };
  const massstab = Math.min(breitePx / aus.w, hoehePx / aus.h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(aus.w * massstab * dpr); canvas.height = Math.round(aus.h * massstab * dpr);
  const ctx = canvas.getContext('2d');
  const bilder = new Map();
  const steinBild = (art, riss) => { const k = art + (riss ? 'r' : ''); if (!bilder.has(k)) bilder.set(k, steinBildMalen(art, riss, massstab, dpr)); return bilder.get(k); };
  const spuren = new Map(Object.entries(szene.spuren || {}).map(([k, v]) => [Number(k), v]));
  szeneMalen(ctx, canvas, { ...szene, spuren, beben: 0, blitz: 0 }, { massstab, dpr, steinBild, ausschnitt: aus });
  return canvas.toDataURL('image/png');
}

export function runenbrecherStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let f = B.fortschrittPruefen(opt.stand) || B.neuerFortschritt();
  let s = B.levelStarten(f);
  let massstab = 3, dpr = 1, laeuft = false, pause = false, beendet = false, raf = 0, letzte = 0, rest = 0;
  let ziel = null, tasten = { links: false, rechts: false };
  let teilchen = [], spuren = new Map(), beben = 0, blitz = 0, hinweisText = null;

  wurzel.classList.add('km', 'rb');
  wurzel.innerHTML = `
    <div class="kopf"><span class="titel" id="rb-titel">Runenbrecher</span><button class="knopf klein leise" id="rb-pause">Pause</button></div>
    <div class="chips">
      <span class="chip p" id="rb-punkte">0</span>
      <span class="chip k">Level <b id="rb-level">1</b></span>
      <span class="chip rb-leben" id="rb-leben" aria-label="Kugeln"></span>
    </div>
    <div class="feld-rahmen" id="rb-rahmen">
      <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
      <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
      <canvas id="rb-canvas"></canvas>
      <div class="rb-meldung" id="rb-meldung" aria-live="polite"></div>
      <div class="rb-effekte" id="rb-effekte"></div>
    </div>
    <div class="rb-zone" id="rb-zone" aria-hidden="true"><span class="rb-griff"><i></i><b>◀ Hier ziehen ▶</b><i></i></span></div>
    <p class="hinweis">Ziehe irgendwo unten mit dem Finger, um den Schild zu bewegen. Tippe, um die Kugel loszuschicken.${opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : ''}</p>
    <div id="rb-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#rb-' + id);
  const rahmen = $('rahmen'), canvas = $('canvas'), ctx = canvas.getContext('2d');

  // ---------- Größe ----------

  let ox = 0, oy = 0;
  function groesse() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = rahmen.clientWidth - 8, ch = rahmen.clientHeight - 8;
    massstab = Math.max(1, Math.min(cw / B.BREITE, ch / B.HOEHE));
    const w = Math.round(B.BREITE * massstab), h = Math.round(B.HOEHE * massstab);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ox = Math.round((rahmen.clientWidth - w) / 2); oy = Math.round((rahmen.clientHeight - h) / 2);
    canvas.style.left = ox + 'px'; canvas.style.top = oy + 'px';
    const eff = $('effekte');
    eff.style.left = ox + 'px'; eff.style.top = oy + 'px'; eff.style.width = w + 'px'; eff.style.height = h + 'px';
    steinBilder = new Map();
    zeichnen();
  }

  // ---------- Zeichnen ----------

  let steinBilder = new Map();
  function steinBild(art, riss) {
    const key = art + (riss ? 'r' : '');
    if (!steinBilder.has(key)) steinBilder.set(key, steinBildMalen(art, riss, massstab, dpr));
    return steinBilder.get(key);
  }

  function zeichnen() {
    szeneMalen(ctx, canvas, { steine: s.steine, extras: s.extras, teilchen, schild: s.schild, kugeln: s.kugeln, spuren, beben, blitz }, { massstab, dpr, steinBild });
    anzeige();
  }

  let anzeigeAlt = '';
  function anzeige() {
    const text = `${s.punkte}|${s.level}|${s.leben}`;
    if (text === anzeigeAlt) return;
    anzeigeAlt = text;
    $('punkte').textContent = s.punkte.toLocaleString('de-DE');
    $('level').textContent = s.level + 1;
    $('leben').innerHTML = Array.from({ length: Math.max(0, s.leben) }, () => '<i></i>').join('');
    $('titel').textContent = `${s.level + 1} · ${B.LEVEL[s.level].name}`;
  }

  // ---------- Effekte ----------

  function splittern(x, y, art, viele = true) {
    const n = ruhig() ? 3 : viele ? 14 : 6;
    const farben = FARBEN[art] || FARBEN.n;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * Math.PI * 2, v = 10 + Math.random() * 28;
      teilchen.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 8, g: 0.6 + Math.random() * 1, leben: 0.7, dauer: 0.7, farbe: farben[i % 2] });
    }
    if (teilchen.length > 220) teilchen.splice(0, teilchen.length - 220);
  }

  function schwebeText(text, x, y, klasse = '') {
    if (ruhig() && !klasse) return;
    const e = document.createElement('div');
    e.className = 'rb-plus ' + klasse;
    e.textContent = text;
    e.style.left = x * massstab + 'px'; e.style.top = y * massstab + 'px';
    $('effekte').appendChild(e);
    setTimeout(() => e.remove(), 1200);
  }

  function meldung(t, dauer = 1800) {
    const m = $('meldung');
    m.textContent = t; m.classList.toggle('an', !!t);
    clearTimeout(meldung.t);
    if (t && dauer) meldung.t = setTimeout(() => { if (!s.liegt) meldung(''); }, dauer);
  }

  function ereignisse(ev) {
    for (const e of ev) {
      if (e.art === 'bruch') {
        splittern(e.x, e.y, e.steinArt, true);
        if (e.steinArt !== 'n') schwebeText('+' + e.punkte, e.x, e.y, e.steinArt === 'g' ? 'gold' : '');
        if (e.steinArt === 's') beben = Math.max(beben, 3);
      } else if (e.art === 'riss') { splittern(e.x, e.y, 's', false); beben = Math.max(beben, 2); }
      else if (e.art === 'fels') splittern(e.x, e.y, 'x', false);
      else if (e.art === 'extra') { schwebeText(EXTRA_TEXT[e.extra], e.x, B.SCHILD.y - 6, 'extra'); }
      else if (e.art === 'kugelWeg') { spuren.clear(); meldung('Die Kugel ist weg. Tippe für die nächste.', 0); sichern(); }
      else if (e.art === 'verloren') verloren();
      else if (e.art === 'geschafft') geschafft();
    }
  }

  // ---------- Ablauf ----------

  function sichern() {
    f = B.fortschrittVon(s);
    sichernExt(JSON.parse(JSON.stringify(f)));
  }

  function schleife(t) {
    raf = 0;
    if (beendet) return;
    const dt = Math.min(0.1, letzte ? (t - letzte) / 1000 : 0.016);
    letzte = t;
    const aktiv = laeuft && !pause && darfLaufen() && !document.hidden && !s.ende;
    if (aktiv) {
      // Tasten bewegen das Ziel gleichmäßig
      if (tasten.links || tasten.rechts) {
        const basis = ziel ?? s.schild.x;
        ziel = Math.max(0, Math.min(B.BREITE, basis + (tasten.rechts - tasten.links) * TASTEN_TEMPO * dt));
      }
      rest += dt;
      let ev = [];
      while (rest >= B.SCHRITT) { rest -= B.SCHRITT; ev = ev.concat(B.schritt(s, ziel)); if (s.ende) break; }
      // Leuchtspur merken
      s.kugeln.forEach((k, i) => {
        const sp = spuren.get(i) || [];
        if (!s.liegt) sp.push({ x: k.x, y: k.y }); else sp.length = 0;
        if (sp.length > (ruhig() ? 0 : 9)) sp.shift();
        spuren.set(i, sp);
      });
      if (spuren.size > s.kugeln.length) for (const i of [...spuren.keys()]) if (i >= s.kugeln.length) spuren.delete(i);
      ereignisse(ev);
    } else rest = 0;
    // Teilchen und Effekte laufen auch, wenn das Spiel ruht (sie verblassen nur)
    for (const p of teilchen) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.leben -= dt; }
    teilchen = teilchen.filter(p => p.leben > 0);
    beben = Math.max(0, beben - dt * 14);
    blitz = Math.max(0, blitz - dt * 1.2);
    zeichnen();
    raf = requestAnimationFrame(schleife);
  }

  function starten() {
    if (s.ende) return;
    tafel(''); pause = false; laeuft = true; letzte = 0;
    $('pause').textContent = 'Pause';
    if (s.liegt) meldung('Tippe, um die Kugel loszuschicken.', 0);
    if (!raf) raf = requestAnimationFrame(schleife);
  }

  function pausieren(zeigen = true) {
    if (!laeuft || s.ende) return;
    pause = true;
    sichern();
    if (zeigen) tafel(`<div class="tafel jade"><h2>Pause</h2><p>Level ${s.level + 1} · ${s.punkte.toLocaleString('de-DE')} Punkte</p>
      <button class="haupt" data-rbt="weiter">Weiter</button></div>`);
  }

  function loslassen() {
    if (!laeuft || pause || !darfLaufen() || $('tafel').innerHTML) return;
    if (B.abschiessen(s)) meldung('');
  }

  function geschafft() {
    blitz = 1;
    melden('rb_level', { level: s.level + 1, name: B.LEVEL[s.level].name, ergebnis: 'geschafft', punkte: s.punkte, leben: s.leben });
    const n = s.level + 1;
    const alleGeschafft = n >= B.LEVEL.length;
    f = B.naechstesLevel(s);
    sichernExt(JSON.parse(JSON.stringify(f)));
    const lichtEl = document.createElement('div');
    lichtEl.className = 'rb-licht';
    if (!ruhig()) { $('effekte').appendChild(lichtEl); setTimeout(() => lichtEl.remove(), 1600); }
    setTimeout(() => {
      if (beendet) return;
      tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>${alleGeschafft ? 'Alle Mauern gebrochen!' : 'Mauer gebrochen!'}</h2>
        <p>Level ${n} · ${B.LEVEL[s.level].name}</p><p class="gross">${s.punkte.toLocaleString('de-DE')}</p>
        <p>${alleGeschafft ? 'Du hast alle 15 Level geschafft. Es geht von vorn los.' : `Dafür gibt es eine Kugel dazu.`}</p>
        <button class="haupt" data-rbt="naechstes">${alleGeschafft ? 'Weiter' : 'Nächstes Level'}</button></div>`);
    }, ruhig() ? 50 : 900);
  }

  function verloren() {
    melden('rb_level', { level: s.level + 1, name: B.LEVEL[s.level].name, ergebnis: 'verloren', punkte: s.punkte, leben: 0 });
    const rekord = s.punkte >= s.rekord && s.punkte > 0;
    f = B.levelNochmal(s);
    sichernExt(JSON.parse(JSON.stringify(f)));
    meldung('');
    setTimeout(() => {
      if (beendet) return;
      tafel(`<div class="tafel jade"><h2>Keine Kugeln mehr</h2><p class="gross">${s.punkte.toLocaleString('de-DE')}</p>
        <p>${rekord ? 'Neuer Rekord! ' : ''}Du bist bis Level ${s.level + 1} gekommen.</p><p>Probier dieses Level noch einmal.</p>
        <button class="haupt" data-rbt="nochmal">Nochmal</button></div>`);
    }, ruhig() ? 50 : 600);
  }

  function levelLaden(neu) {
    f = neu;
    s = B.levelStarten(f);
    teilchen = []; spuren.clear(); ziel = null; anzeigeAlt = '';
    zeichnen();
    starten();
  }

  // ---------- Eingaben ----------

  let zug = null;
  const feldX = (e) => (e.clientX - canvas.getBoundingClientRect().left) / massstab;
  // Gesteuert wird auf dem ganzen Spielfeld und in der Zone darunter (nicht auf Knöpfen und Tafeln)
  const flaeche = (e) => !e.target.closest('button, .tafel-grund, .kopf, .chips');
  an(wurzel, 'pointerdown', (e) => {
    if (!flaeche(e)) return;
    zug = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (laeuft && !pause) ziel = feldX(e);
    try { wurzel.setPointerCapture(e.pointerId); } catch (_) { /* egal */ }
  });
  an(wurzel, 'pointermove', (e) => { if (zug && laeuft && !pause) ziel = feldX(e); });
  an(wurzel, 'pointerup', (e) => {
    if (!zug) return;
    const kurz = performance.now() - zug.t < 400 && Math.hypot(e.clientX - zug.x, e.clientY - zug.y) < 14;
    zug = null;
    if (kurz && s.liegt) loslassen();
  });
  an(wurzel, 'pointercancel', () => { zug = null; });
  an(rahmen, 'touchmove', (e) => e.preventDefault(), { passive: false });
  an($('zone'), 'touchmove', (e) => e.preventDefault(), { passive: false });
  an(document, 'keydown', (e) => {
    if (!wurzel.isConnected) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); tasten.links = true; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tasten.rechts = true; }
    else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); loslassen(); }
    else if (e.key === 'p' || e.key === 'Escape') { e.preventDefault(); if (laeuft && !pause) pausieren(); }
  });
  an(document, 'keyup', (e) => {
    if (e.key === 'ArrowLeft') tasten.links = false;
    if (e.key === 'ArrowRight') tasten.rechts = false;
  });
  an(window, 'blur', () => { tasten = { links: false, rechts: false }; });

  an(wurzel, 'click', (e) => {
    const el = e.target.closest('[data-rbt]');
    if (!el) return;
    const a = el.dataset.rbt;
    if (a === 'los' || a === 'weiter') { if (darfLaufen()) starten(); }
    if (a === 'naechstes' || a === 'nochmal') { tafel(''); levelLaden(f); }
  });
  an($('pause'), 'click', () => { if (laeuft && !pause) pausieren(); else if (!s.ende && !$('tafel').innerHTML) starten(); });
  an(document, 'visibilitychange', () => { if (document.hidden && laeuft && !pause) pausieren(); });
  let rt = null;
  an(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(groesse, 150); });

  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

  // ---------- Start ----------
  groesse();
  const fortsetzen = opt.stand && (f.level > 0 || f.punkte > 0);
  if (fortsetzen) {
    tafel(`<div class="tafel jade"><h2>Runenbrecher</h2><p>Weiter mit Level ${f.level + 1} · ${B.LEVEL[f.level].name}.</p>
      <p>${f.punkte.toLocaleString('de-DE')} Punkte · ${f.leben} ${f.leben === 1 ? 'Kugel' : 'Kugeln'}</p>
      <button class="haupt" data-rbt="los">Weiter</button></div>`);
  } else {
    tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>Runenbrecher</h2>
      <p>Lenke den <b>goldenen Schild</b> mit dem Finger. Die Kugel prallt ab und bricht die <b>Runensteine</b>.</p>
      <p>Lila Steine brauchen zwei Treffer. Goldene lassen etwas fallen. Fang es auf!</p>
      <button class="haupt" data-rbt="los">Los!</button></div>`);
  }
  raf = requestAnimationFrame(schleife);

  return {
    beenden() { if (beendet) return; if (raf) cancelAnimationFrame(raf); if (!s.ende) sichern(); beendet = true; aus.abort(); },
    anhalten() { if (laeuft && !pause) pausieren(false); },
    stand: () => JSON.parse(JSON.stringify(s.ende ? f : B.fortschrittVon(s))),
    ruht: () => !laeuft || pause || s.liegt || !!s.ende || !!$('tafel').innerHTML
  };
}
