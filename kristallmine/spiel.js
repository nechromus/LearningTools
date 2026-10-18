// Kristallmine (Testseite): Anzeige, Steuerung und Ablauf. Regeln in ../js/kristallmine.js
import * as K from '../js/kristallmine.js?v=1.9.7';

const SPEICHER = 'kristallmine-test-v1';
const LEBEN_START = 3;
const EXTRA_LEBEN = 500; // alle 500 Punkte ein Leben dazu (wie beim Vorbild)

const $ = (id) => document.getElementById(id);
const welt = $('welt'), rahmen = $('rahmen'), stick = $('stick'), pfeil = $('pfeil');
let figur = null;             // Figur als eigenes Element, gleitet von Feld zu Feld

let spiel = laden();          // { hoehle, leben, punkte, naechstesLeben, rekord }
let s = null;                 // Stand der aktuellen Höhle
let zellen = [];              // DOM-Zellen
let klassen = [];             // aktuelle Klasse je Zelle
let g = 30;                   // Zellgröße in px
let timer = null;
let laeuft = false;
let gehalten = null;          // gehaltene Richtung
let einmal = null;            // kurzer Tipp: mindestens ein Schritt
let kamera = { x: 0, y: 0 };
let punkteVorHoehle = 0;

function laden() {
  const std = { hoehle: 0, leben: LEBEN_START, punkte: 0, naechstesLeben: EXTRA_LEBEN, rekord: 0 };
  try { return { ...std, ...JSON.parse(localStorage.getItem(SPEICHER) || '{}') }; } catch (e) { return std; }
}
function sichern() { try { localStorage.setItem(SPEICHER, JSON.stringify(spiel)); } catch (e) { /* egal */ } }

// ---------- Höhle aufbauen ----------

function hoehleStarten() {
  stoppen();
  s = K.hoehleLaden(spiel.hoehle);
  punkteVorHoehle = spiel.punkte;
  groesseBerechnen();
  welt.innerHTML = '';
  welt.style.gridTemplateColumns = `repeat(${s.w}, ${g}px)`;
  welt.style.gridAutoRows = `${g}px`;
  welt.style.setProperty('--g', g + 'px');
  const frag = document.createDocumentFragment();
  zellen = []; klassen = [];
  for (let i = 0; i < s.feld.length; i++) {
    const d = document.createElement('div');
    d.innerHTML = '<div class="in"></div>';
    frag.appendChild(d); zellen.push(d); klassen.push('');
  }
  const eff = document.createElement('div');
  eff.className = 'effekte'; eff.id = 'effekte';
  frag.appendChild(eff);
  lichter = new Map();
  figur = document.createElement('div');
  figur.className = 'sprite figur erscheint';
  figur.innerHTML = '<div class="koerper"><div class="in"></div></div><div class="laterne"></div>';
  frag.appendChild(figur);
  welt.appendChild(frag);
  welt.style.transition = 'none'; figur.style.transition = 'none';
  zeichnen(true);
  lichterAbgleichen();
  figurSetzen();
  kameraSetzen();
  requestAnimationFrame(() => requestAnimationFrame(() => { welt.style.transition = ''; figur.style.transition = ''; }));
  anzeige();
  tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>Höhle ${spiel.hoehle + 1} · ${s.name}</h2>
    <p>Sammle <b>${s.brauche} Kristalle</b>. Dann öffnet sich der Ausgang.</p><p>Zeit: ${s.zeit} Sekunden</p>
    <button class="haupt" data-act="los">Los!</button></div>`);
}

function groesseBerechnen() {
  const breite = rahmen.clientWidth || 360, hoehe = rahmen.clientHeight || 480;
  // Etwa 13 Spalten sichtbar; die Höhle soll aber das Feld nach unten ausfüllen
  g = Math.max(24, Math.min(40, Math.max(Math.floor((breite - 4) / 13), Math.ceil(hoehe / s.h))));
}

const variante = (i) => ' v' + ((i * 7 + (i >> 2)) % 3);

function klasseVon(i) {
  const r = Math.floor(i / s.w), c = i % s.w;
  const ch = s.feld[i];
  if (s.lebt && r === s.pr && c === s.pc) return ch === 'E' ? 'z leer ausgang offen' : 'z leer';
  switch (ch) {
    case '#': return 'z wand stahl';
    case 'w': return 'z wand mauer' + variante(i) + ((i * 31) % 23 === 0 ? ' rune' : '');
    case '.': return 'z erde' + variante(i);
    case 'o': return 'z leer stein' + variante(i) + (s.faellt[i] ? ' faellt' : '');
    case '*': return 'z leer kristall' + variante(i);
    case 'E': return 'z ausgang' + (K.offen(s) ? ' offen' : ' zu');
    case 'X': return 'z leer explo';
    default: return 'z leer';
  }
}

function zeichnen(alles = false) {
  for (let i = 0; i < zellen.length; i++) {
    const k = klasseVon(i);
    if (alles || k !== klassen[i]) {
      // Die Explosion färbt die ganze Zelle, sonst die normalen Kacheln
      zellen[i].className = k === 'z leer explo' ? 'z explo' : k;
      klassen[i] = k;
    }
  }
}

// Figur gleitet in einem Takt zum nächsten Feld
function figurSetzen() {
  if (!figur) return;
  figur.style.transform = `translate(${s.pc * (g + 1)}px, ${s.pr * (g + 1)}px)`;
  figur.style.display = s.lebt || s.ende === 'geschafft' ? '' : 'none';
}

// Steine und Kristalle, die sich bewegt haben, gleiten von ihrem alten Feld herüber
function bewegungenGleiten() {
  const sp = g + 1;
  for (const { von, nach } of s.bewegt || []) {
    const el = zellen[nach] && zellen[nach].firstChild;
    if (!el) continue;
    const dx = (von % s.w - nach % s.w) * sp, dy = (Math.floor(von / s.w) - Math.floor(nach / s.w)) * sp;
    el.style.transition = 'none';
    el.style.translate = `${dx}px ${dy}px`;
    void el.offsetWidth;
    el.style.transition = `translate ${K.TAKT_MS}ms linear`;
    el.style.translate = '0px 0px';
  }
}

// Kamera folgt der Figur gleichmäßig (gleitet mit), am Rand der Höhle bleibt sie stehen
function kameraSetzen() {
  const vw = rahmen.clientWidth, vh = rahmen.clientHeight;
  const sp = g + 1;
  const weltB = s.w * sp - 1, weltH = s.h * sp - 1;
  const px = s.pc * sp + g / 2, py = s.pr * sp + g / 2;
  let x = px - vw / 2, y = py - vh / 2;
  x = weltB <= vw ? -(vw - weltB) / 2 : Math.max(0, Math.min(weltB - vw, x));
  y = weltH <= vh ? -(vh - weltH) / 2 : Math.max(0, Math.min(weltH - vh, y));
  kamera = { x, y };
  welt.style.transform = `translate(${-x}px, ${-y}px)`;
  pfeilSetzen();
}

// Ist der Ausgang offen und nicht zu sehen, zeigt ein goldener Pfeil am Rand die Richtung
function pfeilSetzen() {
  const ai = s.feld.indexOf('E');
  if (!K.offen(s) || ai < 0 || s.ende) { pfeil.classList.remove('an'); return; }
  const vw = rahmen.clientWidth, vh = rahmen.clientHeight, sp = g + 1;
  const ax = (ai % s.w) * sp + g / 2 - kamera.x, ay = Math.floor(ai / s.w) * sp + g / 2 - kamera.y;
  if (ax > 0 && ay > 0 && ax < vw && ay < vh) { pfeil.classList.remove('an'); return; }
  const mx = vw / 2, my = vh / 2, dx = ax - mx, dy = ay - my;
  const k = Math.min((vw / 2 - 26) / Math.abs(dx || 1), (vh / 2 - 26) / Math.abs(dy || 1));
  pfeil.style.left = (mx + dx * k) + 'px';
  pfeil.style.top = (my + dy * k) + 'px';
  pfeil.style.setProperty('--w', Math.atan2(dy, dx) + 'rad');
  pfeil.classList.add('an');
}

function anzeige() {
  $('titel').textContent = `Höhle ${spiel.hoehle + 1} · ${s.name}`;
  $('kristalle').textContent = `${s.kristalle} / ${s.brauche}`;
  $('chip-k').classList.toggle('offen', K.offen(s));
  $('zeit').textContent = s.zeit + ' s';
  $('chip-zeit').classList.toggle('knapp', s.zeit <= 10);
  $('punkte').textContent = punkteText(spiel.punkte + s.punkte);
  $('leben').innerHTML = Array.from({ length: Math.max(LEBEN_START, spiel.leben) }, (_, k) => `<i class="${k < spiel.leben ? '' : 'weg'}"></i>`).join('');
}
const punkteText = (n) => Number(n).toLocaleString('de-DE');

// ---------- Ablauf ----------

function starten() {
  if (laeuft || !s || s.ende) return;
  laeuft = true;
  timer = setInterval(schritt, K.TAKT_MS);
}
function stoppen() { laeuft = false; if (timer) clearInterval(timer); timer = null; }

function schritt() {
  const richtung = gehalten || einmal;
  einmal = null;
  const vorher = s.punkte;
  const alt = { r: s.pr, c: s.pc };
  const ev = K.takt(s, richtung);
  haltung(alt, richtung);
  if (s.punkte !== vorher) extraLeben();
  zeichnen();
  lichterAbgleichen();
  bewegungenGleiten();
  figurSetzen();
  kameraSetzen();
  for (const e of ev) effekt(e);
  anzeige();
  if (s.ende) ende();
}

// Kristalle (und der offene Ausgang) leuchten ihre Umgebung an. Die Lichter wandern mit, wenn Kristalle fallen.
let lichter = new Map();
function lichtEl(i, art) {
  const d = document.createElement('div');
  d.className = 'licht-' + art;
  d.style.transform = lichtPos(i);
  d.style.animationDelay = (-(i * 0.37) % 3) + 's';
  $('effekte').appendChild(d);
  return d;
}
const lichtPos = (i) => `translate(${(i % s.w) * (g + 1) + g / 2}px, ${Math.floor(i / s.w) * (g + 1) + g / 2}px)`;
function lichterAbgleichen() {
  if (!$('effekte')) return;
  for (const { von, nach } of s.bewegt || []) {
    const d = lichter.get(von);
    if (d && s.feld[nach] === '*') { lichter.delete(von); lichter.set(nach, d); d.style.transform = lichtPos(nach); }
  }
  for (const [i, d] of lichter) {
    const soll = d.classList.contains('licht-tor') ? 'E' : '*';
    if (s.feld[i] !== soll) { lichter.delete(i); d.classList.add('aus'); setTimeout(() => d.remove(), 700); }
  }
  s.feld.forEach((ch, i) => {
    if (ch === '*' && !lichter.has(i)) lichter.set(i, lichtEl(i, 'kristall'));
    if (ch === 'E' && K.offen(s) && !lichter.has(i)) lichter.set(i, lichtEl(i, 'tor'));
  });
}

// Figur lehnt sich in die Bewegung und hinterlässt eine verblassende Leuchtspur
const LAUF = ['lauf-links', 'lauf-rechts', 'lauf-hoch', 'lauf-runter', 'laeuft', 'drueckt'];
function haltung(alt, richtung) {
  if (!figur) return;
  const bewegt = alt.r !== s.pr || alt.c !== s.pc;
  figur.classList.remove(...LAUF);
  if (bewegt) {
    const r = s.pr - alt.r, c = s.pc - alt.c;
    figur.classList.add('laeuft', c > 0 ? 'lauf-rechts' : c < 0 ? 'lauf-links' : r < 0 ? 'lauf-hoch' : 'lauf-runter');
    spur(alt.r, alt.c);
  } else if (richtung && s.lebt) {
    // drückt gegen etwas (z. B. einen Stein): leicht hineinlehnen
    figur.classList.add('drueckt', 'lauf-' + richtung);
  }
}

// Glühwürmchen: tauchen im sichtbaren Bereich auf (gern bei Kristallen), schweben ein Stück und verblassen
let wuermchenZahl = 0;
function wuermchen() {
  const eff = $('effekte');
  if (!eff || !s || document.hidden || wuermchenZahl >= 14 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const vw = rahmen.clientWidth, vh = rahmen.clientHeight, sp = g + 1;
  let x = kamera.x + Math.random() * vw, y = kamera.y + Math.random() * vh;
  const kristalle = [...lichter.keys()].filter(i => s.feld[i] === '*');
  if (kristalle.length && Math.random() < 0.45) {
    const i = kristalle[Math.floor(Math.random() * kristalle.length)];
    x = (i % s.w) * sp + g / 2 + (Math.random() - 0.5) * g * 1.6;
    y = Math.floor(i / s.w) * sp + g / 2 + (Math.random() - 0.5) * g * 1.6;
  }
  const d = document.createElement('div');
  d.className = 'wuermchen' + (Math.random() < 0.3 ? ' gold' : '') + (Math.random() < 0.4 ? ' klein' : '');
  const dauer = 3 + Math.random() * 3;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  d.style.setProperty('--dx', ((Math.random() - 0.5) * g * 1.8).toFixed(1) + 'px');
  d.style.setProperty('--dy', (-(0.3 + Math.random()) * g).toFixed(1) + 'px');
  d.style.setProperty('--dauer', dauer.toFixed(2) + 's');
  eff.appendChild(d);
  wuermchenZahl++;
  setTimeout(() => { d.remove(); wuermchenZahl--; }, dauer * 1000 + 100);
}
setInterval(() => { if (Math.random() < 0.7) wuermchen(); }, 380);

function spur(r, c) {
  const eff = $('effekte');
  if (!eff || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const d = document.createElement('div');
  d.className = 'spur';
  d.style.left = (c * (g + 1) + g / 2) + 'px';
  d.style.top = (r * (g + 1) + g / 2) + 'px';
  eff.appendChild(d);
  setTimeout(() => d.remove(), 3300);
}

function extraLeben() {
  const gesamt = spiel.punkte + s.punkte;
  while (gesamt >= spiel.naechstesLeben) {
    spiel.leben++; spiel.naechstesLeben += EXTRA_LEBEN;
    schwebeText('+1 Leben', s.pr, s.pc, true);
  }
}

function ende() {
  stoppen();
  gehalten = null;
  if (s.ende === 'geschafft') {
    const bonus = K.zeitBonus(s);
    spiel.punkte += s.punkte;
    const letzte = spiel.hoehle >= K.HOEHLEN.length - 1;
    zeitBonusZaehlen(bonus, () => {
      spiel.rekord = Math.max(spiel.rekord, spiel.punkte);
      if (!letzte) spiel.hoehle++;
      sichern();
      tafel(`<div class="tafel"><div class="bild-raute"></div><h2>${letzte ? 'Alle Höhlen geschafft!' : 'Höhle geschafft!'}</h2>
        <p>${s.kristalle} Kristalle · Zeitbonus ${bonus}</p><p class="gross">${punkteText(spiel.punkte)}</p>
        ${letzte ? `<p>Rekord: ${punkteText(spiel.rekord)}</p><button class="haupt" data-act="neuesSpiel">Nochmal von vorn</button>` : `<button class="haupt" data-act="weiter">Nächste Höhle</button>`}</div>`);
    });
    return;
  }
  spiel.leben--;
  const zeit = s.ende === 'zeit', neu = s.ende === 'neu';
  setTimeout(() => {
    if (spiel.leben <= 0) {
      spiel.rekord = Math.max(spiel.rekord, spiel.punkte + s.punkte);
      const erreicht = spiel.hoehle + 1;
      sichern();
      tafel(`<div class="tafel"><div class="bild-stein"></div><h2>Keine Leben mehr</h2>
        <p>Du bist bis Höhle ${erreicht} gekommen.</p><p class="gross">${punkteText(spiel.punkte + s.punkte)}</p><p>Rekord: ${punkteText(spiel.rekord)}</p>
        <button class="haupt" data-act="neuesSpiel">Neues Spiel</button></div>`);
      spiel = { ...spiel, hoehle: 0, leben: LEBEN_START, punkte: 0, naechstesLeben: EXTRA_LEBEN };
      sichern();
      return;
    }
    sichern();
    tafel(`<div class="tafel"><div class="bild-stein"></div><h2>${zeit ? 'Zeit ist um!' : neu ? 'Höhle neu' : 'Bumm! Ein Stein.'}</h2>
      <p>Noch ${spiel.leben} ${spiel.leben === 1 ? 'Leben' : 'Leben'}. Die Höhle beginnt von vorn.</p>
      <button class="haupt" data-act="nochmal">Weiter</button></div>`);
  }, zeit || neu ? 200 : 700);
}

function zeitBonusZaehlen(bonus, fertig) {
  let rest = bonus;
  const t = setInterval(() => {
    const n = Math.min(rest, 5);
    rest -= n; spiel.punkte += n; s.zeit = Math.max(0, s.zeit - n);
    $('zeit').textContent = s.zeit + ' s';
    $('punkte').textContent = punkteText(spiel.punkte);
    if (rest <= 0) { clearInterval(t); setTimeout(fertig, 400); }
  }, 40);
}

// ---------- Effekte ----------

function effektEl(html, r, c, klasse, dauer = 1600) {
  const eff = $('effekte');
  if (!eff) return;
  const d = document.createElement('div');
  d.className = klasse;
  d.style.left = (c * (g + 1) + g / 2) + 'px';
  d.style.top = (r * (g + 1) + g / 2) + 'px';
  d.style.animationIterationCount = '1';
  d.innerHTML = html;
  eff.appendChild(d);
  d.querySelectorAll('*').forEach(x => { x.style.animationIterationCount = '1'; x.style.animationFillMode = 'forwards'; });
  setTimeout(() => d.remove(), dauer);
}

function funken(n, weite) {
  return Array.from({ length: n }, (_, k) => {
    const w = (k / n) * Math.PI * 2 + Math.random() * 0.4;
    return `<span class="fu" style="--dx:${Math.round(Math.cos(w) * weite)}px;--dy:${Math.round(Math.sin(w) * weite)}px"></span>`;
  }).join('');
}

function schwebeText(text, r, c, gold = false) {
  effektEl(`<span class="plus" style="${gold ? 'color:#FFF1C8;text-shadow:0 0 12px #D8B05A,0 2px 0 #0c1011' : ''}">${text}</span>`, r, c, 'platzen', 1600);
}

function effekt(e) {
  switch (e.art) {
    case 'kristall':
      effektEl(`<span class="ring"></span>${funken(6, 22)}<span class="plus">+${s.kristalle > s.brauche ? 15 : 10}</span>`, e.r, e.c, 'platzen');
      break;
    case 'offen': {
      const b = document.createElement('div'); b.className = 'blitz'; rahmen.appendChild(b); setTimeout(() => b.remove(), 1000);
      schwebeText('Ausgang offen!', s.pr, s.pc, true);
      break;
    }
    case 'landen':
      if (e.was === 'o') effektEl(`<span style="--dx:-14px;--dy:-4px"></span><span style="--dx:14px;--dy:-5px"></span><span style="--dx:-7px;--dy:-9px"></span><span style="--dx:8px;--dy:-8px"></span>`, e.r + 0.4, e.c, 'staubwolke', 1300);
      break;
    case 'explosion':
      effektEl(`<span class="ring"></span>${funken(10, 46)}`, e.r, e.c, 'einschlag', 1900);
      rahmen.classList.remove('beben'); void rahmen.offsetWidth; rahmen.classList.add('beben');
      break;
    case 'geschafft': {
      const b = document.createElement('div'); b.className = 'blitz'; rahmen.appendChild(b); setTimeout(() => b.remove(), 1000);
      break;
    }
    default: break;
  }
}

// ---------- Tafeln ----------

function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'los') { tafel(''); starten(); }
  if (act === 'neuesSpiel') { spiel = { ...spiel, hoehle: 0, leben: LEBEN_START, punkte: 0, naechstesLeben: EXTRA_LEBEN }; sichern(); }
  if (act === 'nochmal' || act === 'weiter' || act === 'neuesSpiel') { tafel(''); hoehleStarten(); }
  if (act === 'fortsetzen') { tafel(''); starten(); }
});

$('pause').addEventListener('click', () => {
  if (!s || s.ende) return;
  stoppen();
  tafel(`<div class="tafel jade"><h2>Pause</h2><p>Höhle ${spiel.hoehle + 1} · ${s.kristalle} von ${s.brauche} Kristallen · noch ${s.zeit} s</p>
    <button class="haupt" data-act="fortsetzen">Weiter</button></div>`);
});
$('neu').addEventListener('click', () => {
  if (!s) return;
  stoppen();
  tafel(`<div class="tafel"><h2>Höhle neu?</h2><p>Das kostet ein Leben, wie beim Vorbild.</p>
    <button class="haupt" data-act="neuJa">Ja, neu beginnen</button><button class="neben" data-act="fortsetzen">Abbrechen</button></div>`);
});
document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-act="neuJa"]')) { tafel(''); s.lebt = false; s.ende = 'neu'; ende(); }
});

// App versteckt: anhalten
document.addEventListener('visibilitychange', () => {
  if (document.hidden && laeuft) $('pause').click();
});

// ---------- Steuerung ----------

const TASTEN = { ArrowUp: 'hoch', ArrowDown: 'runter', ArrowLeft: 'links', ArrowRight: 'rechts', w: 'hoch', s: 'runter', a: 'links', d: 'rechts' };
document.addEventListener('keydown', (e) => {
  const r = TASTEN[e.key];
  if (!r) return;
  e.preventDefault();
  if (gehalten !== r) einmal = r;
  gehalten = r;
});
document.addEventListener('keyup', (e) => { if (TASTEN[e.key] === gehalten) gehalten = null; });

// Steuerkreuz: antippen und halten, oder aus der Mitte heraus in eine Richtung ziehen
const kreuz = $('kreuz');
let kreuzZug = null;
function kreuzRichtung(e) {
  const b = kreuz.getBoundingClientRect();
  const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
  if (Math.hypot(dx, dy) / zoom < 12) return null; // tote Mitte
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch');
}
function kreuzZeigen(r) {
  for (const t of kreuz.querySelectorAll('.taste')) t.classList.toggle('an', t.dataset.r === r);
}
kreuz.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { kreuz.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
  kreuzZug = e.pointerId;
  const r = kreuzRichtung(e);
  if (r) { gehalten = r; einmal = r; }
  kreuzZeigen(r);
});
kreuz.addEventListener('pointermove', (e) => {
  if (kreuzZug !== e.pointerId) return;
  const r = kreuzRichtung(e);
  if (r && r !== gehalten) einmal = r;
  gehalten = r;
  kreuzZeigen(r);
});
const kreuzEnde = (e) => { if (kreuzZug !== e.pointerId) return; kreuzZug = null; gehalten = null; kreuzZeigen(null); };
kreuz.addEventListener('pointerup', kreuzEnde);
kreuz.addEventListener('pointercancel', kreuzEnde);
kreuz.addEventListener('lostpointercapture', kreuzEnde);

// Auf dem Feld ziehen: wirkt wie ein Stick, solange der Finger liegt
let zug = null;
rahmen.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try { rahmen.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
  const b = rahmen.getBoundingClientRect();
  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
  zug = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: b.left, by: b.top, zoom };
  stick.style.left = ((e.clientX - b.left) / zoom) + 'px';
  stick.style.top = ((e.clientY - b.top) / zoom) + 'px';
  stick.querySelector('i').style.transform = '';
  stick.classList.add('an');
});
rahmen.addEventListener('pointermove', (e) => {
  if (!zug || e.pointerId !== zug.id) return;
  const dx = (e.clientX - zug.x) / zug.zoom, dy = (e.clientY - zug.y) / zug.zoom;
  const weit = Math.hypot(dx, dy);
  const k = Math.min(1, 26 / (weit || 1));
  stick.querySelector('i').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  if (weit < 14) { gehalten = null; return; }
  const r = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch');
  if (r !== gehalten) einmal = r;
  gehalten = r;
});
const zugEnde = (e) => { if (zug && e.pointerId === zug.id) { zug = null; gehalten = null; stick.classList.remove('an'); } };
rahmen.addEventListener('pointerup', zugEnde);
rahmen.addEventListener('pointercancel', zugEnde);

window.addEventListener('resize', () => { if (s) kameraSetzen(); });

hoehleStarten();

// Nur für Tests im Browser
window.kristallmineStand = () => s;
