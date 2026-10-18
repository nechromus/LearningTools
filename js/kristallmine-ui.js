// Kristallmine: Anzeige, Steuerung und Ablauf als Baustein.
// Wird von der Übungs-App (Spiel-Bildschirm) und von der Testseite kristallmine/ benutzt.
// Regeln in ./kristallmine.js, Aussehen in ../kristallmine/km.css (alle Regeln unter .km).
//
// kristallmineStarten(wurzel, {
//   stand,              // gespeicherter Fortschritt (oder null): { hoehle, leben, punkte, naechstesLeben, rekord, hoechste, kreuz, hoehleStand }
//   sichern(stand),     // Fortschritt speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll (z. B. 'km_hoehle')
//   darfLaufen(),       // false, wenn das Spiel nicht laufen darf (z. B. keine Spielzeit)
//   hinweisZusatz,      // Text unten (z. B. Versionsnummer der Testseite)
// }) → { anhalten(), beenden(), stand() }
import * as K from './kristallmine.js';

export const LEBEN_START = 3;
const EXTRA_LEBEN = 500;   // alle 500 Punkte ein Leben dazu (wie beim Vorbild)
const ETAPPE = 5;          // Etappen-Höhlen 1, 6, 11 …: nach „Keine Leben mehr“ geht es dort weiter

export function neuerFortschritt() {
  return { hoehle: 0, leben: LEBEN_START, punkte: 0, naechstesLeben: EXTRA_LEBEN, rekord: 0, hoechste: 0, kreuz: false, hoehleStand: null };
}

const punkteText = (n) => Number(n).toLocaleString('de-DE');
const variante = (i) => ' v' + ((i * 7 + (i >> 2)) % 3);
const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function kristallmineStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let spiel = { ...neuerFortschritt(), ...(opt.stand || {}) };
  let s = null, zellen = [], klassen = [], g = 30, timer = null, laeuft = false;
  let gehalten = null, einmal = null, kamera = { x: 0, y: 0 }, figur = null, lichter = new Map();
  let wuermchenZahl = 0, beendet = false;
  const intervalle = [];

  wurzel.classList.add('km');
  wurzel.innerHTML = `
    <div class="kopf km-kopf"><span class="titel" id="km-titel">Kristallmine</span><span class="leben" id="km-leben" aria-label="Leben"></span></div>
    <div class="chips">
      <span class="chip k" id="km-chip-k"><span class="raute"></span><span id="km-kristalle">0 / 0</span></span>
      <span class="chip" id="km-chip-zeit"><span class="uhr"></span><span id="km-zeit">0</span></span>
      <span class="chip p" id="km-punkte">0</span>
    </div>
    <div class="feld-rahmen" id="km-rahmen">
      <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
      <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
      <div class="welt" id="km-welt"></div>
      <div class="pfeil" id="km-pfeil" aria-hidden="true"></div>
      <div class="stick" id="km-stick"><i></i></div>
    </div>
    <div class="steuer">
      <div class="kreuz" id="km-kreuz">
        <span></span><button class="taste" data-r="hoch" aria-label="Hoch">▲</button><span></span>
        <button class="taste" data-r="links" aria-label="Links">◀</button><span class="mitte"></span><button class="taste" data-r="rechts" aria-label="Rechts">▶</button>
        <span></span><button class="taste" data-r="runter" aria-label="Runter">▼</button><span></span>
      </div>
    </div>
    <div class="leiste">
      <button class="knopf klein" id="km-pause">Pause</button>
      <button class="knopf klein leise" id="km-neu">Höhle neu</button>
      <button class="knopf klein" id="km-kreuz-schalter" aria-pressed="false">Steuerkreuz</button>
    </div>
    <p class="hinweis" id="km-hinweis"></p>
    <div id="km-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#km-' + id);
  const welt = $('welt'), rahmen = $('rahmen'), stick = $('stick'), pfeil = $('pfeil'), kreuz = $('kreuz');

  function sichern() {
    spiel.hoechste = Math.max(spiel.hoechste || 0, spiel.hoehle);
    sichernExt(JSON.parse(JSON.stringify(spiel)));
  }

  // ---------- Höhle aufbauen ----------

  function hoehleStarten(gespeichert = null) {
    stoppen();
    s = gespeichert || K.hoehleLaden(spiel.hoehle);
    spiel.hoehleStand = null;
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
    eff.className = 'effekte'; eff.id = 'km-effekte';
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
    if (gespeichert) {
      tafel(`<div class="tafel jade"><h2>Höhle ${spiel.hoehle + 1} · ${s.name}</h2>
        <p>${s.kristalle} von ${s.brauche} Kristallen · noch ${s.zeit} s</p>
        <button class="haupt" data-km="fortsetzen">Weiter</button></div>`);
    } else {
      tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>Höhle ${spiel.hoehle + 1} · ${s.name}</h2>
        <p>Sammle <b>${s.brauche} Kristalle</b>. Dann öffnet sich der Ausgang.</p><p>Zeit: ${s.zeit} Sekunden</p>
        <button class="haupt" data-km="los">Los!</button></div>`);
    }
  }

  function groesseBerechnen() {
    const breite = rahmen.clientWidth || 360, hoehe = rahmen.clientHeight || 480;
    // Etwa 13 Spalten sichtbar; die Höhle soll aber das Feld nach unten ausfüllen
    g = Math.max(24, Math.min(40, Math.max(Math.floor((breite - 4) / 13), Math.ceil(hoehe / s.h))));
  }

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
      case 'X': return 'z explo';
      case 'f': return 'z leer gluehwurm';
      case 'b': return 'z leer falter';
      default: return 'z leer';
    }
  }

  function zeichnen(alles = false) {
    for (let i = 0; i < zellen.length; i++) {
      const k = klasseVon(i);
      if (alles || k !== klassen[i]) { zellen[i].className = k; klassen[i] = k; }
    }
  }

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

  // Kamera folgt der Figur gleichmäßig, am Rand der Höhle bleibt sie stehen
  function kameraSetzen() {
    if (!s) return;
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

  // ---------- Ablauf ----------

  function starten() {
    if (laeuft || !s || s.ende || beendet || !darfLaufen()) return;
    laeuft = true;
    timer = setInterval(schritt, K.TAKT_MS);
  }
  function stoppen() { laeuft = false; if (timer) clearInterval(timer); timer = null; gehalten = null; }

  function schritt() {
    if (!darfLaufen()) { pausieren(); return; }
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

  function pausieren() {
    if (!s || s.ende) return;
    stoppen();
    tafel(`<div class="tafel jade"><h2>Pause</h2><p>Höhle ${spiel.hoehle + 1} · ${s.kristalle} von ${s.brauche} Kristallen · noch ${s.zeit} s</p>
      <button class="haupt" data-km="fortsetzen">Weiter</button></div>`);
  }

  // Kristalle (und der offene Ausgang) leuchten ihre Umgebung an. Die Lichter wandern mit.
  const LICHT_ART = { '*': 'kristall', E: 'tor', f: 'wurm', b: 'falter' };
  function lichtEl(i, art) {
    const d = document.createElement('div');
    d.className = 'licht-' + art;
    d.dataset.ch = Object.keys(LICHT_ART).find(k => LICHT_ART[k] === art);
    d.style.transform = lichtPos(i);
    d.style.animationDelay = (-(i * 0.37) % 3) + 's';
    $('effekte').appendChild(d);
    return d;
  }
  const lichtPos = (i) => `translate(${(i % s.w) * (g + 1) + g / 2}px, ${Math.floor(i / s.w) * (g + 1) + g / 2}px)`;
  function lichterAbgleichen() {
    if (!$('effekte')) return;
    // Lichter wandern mit (fallende Kristalle, laufende Gegner)
    const umzug = [];
    for (const { von, nach } of s.bewegt || []) {
      const d = lichter.get(von);
      if (d && s.feld[nach] === d.dataset.ch) { lichter.delete(von); umzug.push([nach, d]); d.style.transform = lichtPos(nach); }
    }
    for (const [nach, d] of umzug) lichter.set(nach, d);
    for (const [i, d] of lichter) {
      if (s.feld[i] !== d.dataset.ch) { lichter.delete(i); d.classList.add('aus'); setTimeout(() => d.remove(), 700); }
    }
    s.feld.forEach((ch, i) => {
      if (lichter.has(i)) return;
      if (ch === '*' || ch === 'f' || ch === 'b') lichter.set(i, lichtEl(i, LICHT_ART[ch]));
      if (ch === 'E' && K.offen(s)) lichter.set(i, lichtEl(i, 'tor'));
    });
  }

  // Figur lehnt sich in die Bewegung und hinterlässt eine Spur aus Fünkchen
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
      figur.classList.add('drueckt', 'lauf-' + richtung);
    }
  }

  function funkeEl(klasse, x, y, dx, dy, dauer, verz = 0) {
    const d = document.createElement('div');
    d.className = klasse;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.setProperty('--dx', dx.toFixed(1) + 'px');
    d.style.setProperty('--dy', dy.toFixed(1) + 'px');
    d.style.setProperty('--dauer', dauer.toFixed(2) + 's');
    if (verz) d.style.animationDelay = verz.toFixed(2) + 's';
    $('effekte').appendChild(d);
    return d;
  }

  // Glühwürmchen: tauchen im sichtbaren Bereich auf (gern bei Kristallen), schweben ein Stück und verblassen
  function wuermchen() {
    if (!s || !$('effekte') || document.hidden || wuermchenZahl >= 14 || ruhig()) return;
    const vw = rahmen.clientWidth, vh = rahmen.clientHeight, sp = g + 1;
    let x = kamera.x + Math.random() * vw, y = kamera.y + Math.random() * vh;
    const kristalle = [...lichter.keys()].filter(i => s.feld[i] === '*');
    if (kristalle.length && Math.random() < 0.45) {
      const i = kristalle[Math.floor(Math.random() * kristalle.length)];
      x = (i % s.w) * sp + g / 2 + (Math.random() - 0.5) * g * 1.6;
      y = Math.floor(i / s.w) * sp + g / 2 + (Math.random() - 0.5) * g * 1.6;
    }
    const dauer = 3 + Math.random() * 3;
    const d = funkeEl('wuermchen' + (Math.random() < 0.3 ? ' gold' : '') + (Math.random() < 0.4 ? ' klein' : ''), x, y, (Math.random() - 0.5) * g * 1.8, -(0.3 + Math.random()) * g, dauer);
    wuermchenZahl++;
    setTimeout(() => { d.remove(); wuermchenZahl--; }, dauer * 1000 + 100);
  }
  intervalle.push(setInterval(() => { if (Math.random() < 0.7) wuermchen(); }, 380));

  function spur(r, c) {
    if (!$('effekte') || ruhig()) return;
    const sp = g + 1;
    const n = 3 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const dauer = 1.8 + Math.random() * 1.6;
      const d = funkeEl('wuermchen spur-funke' + (Math.random() < 0.4 ? ' gold' : '') + (Math.random() < 0.5 ? ' klein' : ''),
        c * sp + g / 2 + (Math.random() - 0.5) * g * 0.9, r * sp + g / 2 + (Math.random() - 0.5) * g * 0.9,
        (Math.random() - 0.5) * g * 1.1, -(0.2 + Math.random() * 0.8) * g, dauer, Math.random() * 0.25);
      setTimeout(() => d.remove(), (dauer + 0.4) * 1000);
    }
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
    spiel.hoehleStand = null;
    const nr = spiel.hoehle;
    if (s.ende === 'geschafft') {
      const bonus = K.zeitBonus(s);
      spiel.punkte += s.punkte;
      const letzte = spiel.hoehle >= K.HOEHLEN.length - 1;
      melden('km_hoehle', { hoehle: nr + 1, name: s.name, ergebnis: 'geschafft', kristalle: s.kristalle, punkte: s.punkte + bonus, zeitRest: s.zeit });
      zeitBonusZaehlen(bonus, () => {
        spiel.rekord = Math.max(spiel.rekord, spiel.punkte);
        if (!letzte) spiel.hoehle++;
        sichern();
        tafel(`<div class="tafel"><div class="bild-raute"></div><h2>${letzte ? 'Alle Höhlen geschafft!' : 'Höhle geschafft!'}</h2>
          <p>${s.kristalle} Kristalle · Zeitbonus ${bonus}</p><p class="gross">${punkteText(spiel.punkte)}</p>
          ${letzte ? `<p>Rekord: ${punkteText(spiel.rekord)}</p><button class="haupt" data-km="vonVorn">Nochmal von vorn</button>` : `<button class="haupt" data-km="weiter">Nächste Höhle</button>`}</div>`);
      });
      return;
    }
    spiel.leben--;
    const zeit = s.ende === 'zeit', neu = s.ende === 'neu';
    melden('km_hoehle', { hoehle: nr + 1, name: s.name, ergebnis: zeit ? 'zeit' : neu ? 'neu' : 'treffer', grund: s.grund || null, kristalle: s.kristalle, leben: spiel.leben });
    const TITEL = { stein: 'Bumm! Ein Stein.', kristall: 'Bumm! Ein Kristall.', gluehwurm: 'Bumm! Ein Glühwurm.', schmetterling: 'Ein Schmetterling!', explosion: 'Bumm! Eine Explosion.' };
    setTimeout(() => {
      if (beendet) return;
      if (spiel.leben <= 0) {
        spiel.rekord = Math.max(spiel.rekord, spiel.punkte + s.punkte);
        const etappe = Math.floor(spiel.hoehle / ETAPPE) * ETAPPE;
        tafel(`<div class="tafel"><div class="bild-stein"></div><h2>Keine Leben mehr</h2>
          <p>Du bist bis Höhle ${nr + 1} gekommen.</p><p class="gross">${punkteText(spiel.punkte + s.punkte)}</p><p>Rekord: ${punkteText(spiel.rekord)}</p>
          <p>Neues Spiel ab Höhle ${etappe + 1}.</p>
          <button class="haupt" data-km="weiter">Neues Spiel</button></div>`);
        spiel = { ...spiel, hoehle: etappe, leben: LEBEN_START, punkte: 0, naechstesLeben: EXTRA_LEBEN };
        sichern();
        return;
      }
      sichern();
      tafel(`<div class="tafel"><div class="bild-stein"></div><h2>${zeit ? 'Zeit ist um!' : neu ? 'Höhle neu' : (TITEL[s.grund] || 'Bumm!')}</h2>
        <p>Noch ${spiel.leben} Leben. Die Höhle beginnt von vorn.</p>
        <button class="haupt" data-km="weiter">Weiter</button></div>`);
    }, zeit || neu ? 200 : 700);
  }

  function zeitBonusZaehlen(bonus, fertig) {
    let rest = bonus;
    const t = setInterval(() => {
      if (beendet) { clearInterval(t); spiel.punkte += rest; fertig(); return; }
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
  function blitz() { const b = document.createElement('div'); b.className = 'blitz'; rahmen.appendChild(b); setTimeout(() => b.remove(), 1000); }
  function effekt(e) {
    switch (e.art) {
      case 'kristall': effektEl(`<span class="ring"></span>${funken(6, 22)}<span class="plus">+${s.kristalle > s.brauche ? 15 : 10}</span>`, e.r, e.c, 'platzen'); break;
      case 'offen': blitz(); schwebeText('Ausgang offen!', s.pr, s.pc, true); break;
      case 'landen':
        if (e.was === 'o') effektEl(`<span style="--dx:-14px;--dy:-4px"></span><span style="--dx:14px;--dy:-5px"></span><span style="--dx:-7px;--dy:-9px"></span><span style="--dx:8px;--dy:-8px"></span>`, e.r + 0.4, e.c, 'staubwolke', 1300);
        break;
      case 'explosion':
        effektEl(`<span class="ring"></span>${funken(10, 46)}`, e.r, e.c, 'einschlag' + (e.kristalle ? ' jade' : ''), 1900);
        rahmen.classList.remove('beben'); void rahmen.offsetWidth; rahmen.classList.add('beben');
        break;
      case 'geschafft': blitz(); break;
      default: break;
    }
  }

  // ---------- Tafeln und Knöpfe ----------

  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

  an(wurzel, 'click', (ev) => {
    const el = ev.target.closest('[data-km]');
    if (!el) return;
    const act = el.dataset.km;
    if (act === 'los' || act === 'fortsetzen') { if (!darfLaufen()) return; tafel(''); starten(); }
    if (act === 'weiter') { tafel(''); hoehleStarten(); }
    if (act === 'vonVorn') { spiel = { ...spiel, hoehle: 0, leben: LEBEN_START, punkte: 0, naechstesLeben: EXTRA_LEBEN }; sichern(); tafel(''); hoehleStarten(); }
    if (act === 'neuJa') { tafel(''); s.lebt = false; s.ende = 'neu'; ende(); }
  });
  an($('pause'), 'click', () => pausieren());
  an($('neu'), 'click', () => {
    if (!s || s.ende) return;
    stoppen();
    tafel(`<div class="tafel"><h2>Höhle neu?</h2><p>Das kostet ein Leben, wie beim Vorbild.</p>
      <button class="haupt" data-km="neuJa">Ja, neu beginnen</button><button class="neben" data-km="fortsetzen">Abbrechen</button></div>`);
  });
  // App versteckt: anhalten und den Stand der Höhle sichern (falls das Handy die App beendet)
  an(document, 'visibilitychange', () => {
    if (!document.hidden) return;
    if (laeuft) pausieren();
    if (s && !s.ende) { spiel.hoehleStand = JSON.parse(JSON.stringify({ ...s, bewegt: [], explosion: [] })); sichern(); }
  });

  // ---------- Steuerung ----------

  const zoomVon = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
  const TASTEN = { ArrowUp: 'hoch', ArrowDown: 'runter', ArrowLeft: 'links', ArrowRight: 'rechts', w: 'hoch', s: 'runter', a: 'links', d: 'rechts' };
  an(document, 'keydown', (e) => {
    const r = TASTEN[e.key];
    if (!r || !laeuft) return;
    e.preventDefault();
    if (gehalten !== r) einmal = r;
    gehalten = r;
  });
  an(document, 'keyup', (e) => { if (TASTEN[e.key] === gehalten) gehalten = null; });

  // Steuerkreuz ein- und ausblenden (gemerkt)
  function kreuzAnzeigen(ein) {
    wurzel.classList.toggle('mit-kreuz', ein);
    $('kreuz-schalter').setAttribute('aria-pressed', String(ein));
    $('hinweis').textContent = (ein ? 'Steuerkreuz halten oder aus der Mitte ziehen · oder auf dem Feld ziehen' : 'Auf dem Feld ziehen und halten') + (opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : '');
    spiel.kreuz = ein;
    requestAnimationFrame(() => kameraSetzen());
  }
  an($('kreuz-schalter'), 'click', () => { kreuzAnzeigen(!wurzel.classList.contains('mit-kreuz')); sichern(); });
  kreuzAnzeigen(!!spiel.kreuz);

  // Steuerkreuz: antippen und halten, oder aus der Mitte heraus in eine Richtung ziehen
  let kreuzZug = null;
  function kreuzRichtung(e) {
    const b = kreuz.getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    if (Math.hypot(dx, dy) / zoomVon() < 12) return null; // tote Mitte
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch');
  }
  const kreuzZeigen = (r) => { for (const t of kreuz.querySelectorAll('.taste')) t.classList.toggle('an', t.dataset.r === r); };
  an(kreuz, 'pointerdown', (e) => {
    e.preventDefault();
    try { kreuz.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    kreuzZug = e.pointerId;
    const r = kreuzRichtung(e);
    if (r) { gehalten = r; einmal = r; }
    kreuzZeigen(r);
  });
  an(kreuz, 'pointermove', (e) => {
    if (kreuzZug !== e.pointerId) return;
    const r = kreuzRichtung(e);
    if (r && r !== gehalten) einmal = r;
    gehalten = r;
    kreuzZeigen(r);
  });
  const kreuzEnde = (e) => { if (kreuzZug !== e.pointerId) return; kreuzZug = null; gehalten = null; kreuzZeigen(null); };
  an(kreuz, 'pointerup', kreuzEnde);
  an(kreuz, 'pointercancel', kreuzEnde);
  an(kreuz, 'lostpointercapture', kreuzEnde);

  // Auf dem Feld ziehen: wirkt wie ein Stick, solange der Finger liegt
  let zug = null;
  an(rahmen, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { rahmen.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    const b = rahmen.getBoundingClientRect(), zoom = zoomVon();
    zug = { id: e.pointerId, x: e.clientX, y: e.clientY, zoom };
    stick.style.left = ((e.clientX - b.left) / zoom) + 'px';
    stick.style.top = ((e.clientY - b.top) / zoom) + 'px';
    stick.querySelector('i').style.transform = '';
    stick.classList.add('an');
  });
  an(rahmen, 'pointermove', (e) => {
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
  an(rahmen, 'pointerup', zugEnde);
  an(rahmen, 'pointercancel', zugEnde);
  an(window, 'resize', () => kameraSetzen());

  // Start: gespeicherte Höhle fortsetzen oder neue beginnen
  const gesp = spiel.hoehleStand;
  if (gesp && gesp.feld && gesp.nr === spiel.hoehle && !gesp.ende) hoehleStarten({ ...gesp, bewegt: [], explosion: [] });
  else hoehleStarten();

  return {
    // anhalten ohne eigene Tafel (z. B. wenn die Spielzeit um ist; die App zeigt dann ihre Meldung)
    anhalten() { stoppen(); },
    pausieren,
    // Bildschirm verlassen: alles stoppen, Stand der laufenden Höhle mitspeichern
    beenden() {
      if (beendet) return;
      beendet = true;
      stoppen();
      intervalle.forEach(clearInterval);
      aus.abort();
      if (s && !s.ende) spiel.hoehleStand = JSON.parse(JSON.stringify({ ...s, bewegt: [], explosion: [] }));
      sichern();
    },
    stand: () => JSON.parse(JSON.stringify(spiel)),
    hoehle: () => s,
    laeuft: () => laeuft,
    // true, solange das Spiel steht (Start-, Pause- oder Ende-Tafel): dann läuft auch die Spielzeit nicht
    ruht: () => !laeuft
  };
}
