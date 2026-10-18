// Kristallmine (Testseite): Anzeige, Steuerung und Ablauf. Regeln in ../js/kristallmine.js
import * as K from '../js/kristallmine.js';

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
  figur = document.createElement('div');
  figur.className = 'sprite figur erscheint';
  figur.innerHTML = '<div class="in"></div><div class="laterne"></div>';
  frag.appendChild(figur);
  welt.appendChild(frag);
  welt.style.transition = 'none'; figur.style.transition = 'none';
  zeichnen(true);
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
  const ev = K.takt(s, richtung);
  if (s.punkte !== vorher) extraLeben();
  zeichnen();
  bewegungenGleiten();
  figurSetzen();
  kameraSetzen();
  for (const e of ev) effekt(e);
  anzeige();
  if (s.ende) ende();
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

// Steuerkreuz: gedrückt halten
for (const b of document.querySelectorAll('.taste')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    gehalten = b.dataset.r; einmal = b.dataset.r;
    b.classList.add('an');
  });
  const los = () => { if (gehalten === b.dataset.r) gehalten = null; b.classList.remove('an'); };
  b.addEventListener('pointerup', los);
  b.addEventListener('pointercancel', los);
  b.addEventListener('lostpointercapture', los);
}

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
