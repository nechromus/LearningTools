// Runenfall: Anzeige und Steuerung als Baustein (wie kristallmine-ui.js).
// Regeln in ./runenfall.js, Aussehen in ../runenfall/rn.css (unter .rnf, nutzt Grundstile aus km.css).
//
// runenfallStarten(wurzel, {
//   stand,              // gespeichertes Spiel (oder null)
//   sichern(stand),     // Spiel speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll ('rn_spiel')
//   darfLaufen(),       // false, wenn gerade nicht gespielt werden darf
//   hinweisZusatz,
// }) → { beenden(), anhalten(), stand(), ruht() }
import * as R from './runenfall.js';

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const HALTEN_MS = 500;     // so lange darf ein aufliegender Stein noch geschoben werden
const HALTEN_MAX = 15;     // höchstens so oft neu
const WIEDERHOLEN = { start: 280, schritt: 110, runter: 50 };

export function runenfallStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let s = R.standPruefen(opt.stand) || R.neuesSpiel();
  let g = 24, zellen = [], klassen = [], laeuft = false, pause = false, beendet = false;
  let zeitFall = 0, zeitHalten = 0, halteZaehler = 0, letzte = 0, raf = 0, gemeldet = false;

  wurzel.classList.add('km', 'rnf');
  wurzel.innerHTML = `
    <div class="kopf"><span class="titel">Runenfall</span><button class="knopf klein leise" id="rn-pause">Pause</button></div>
    <div class="chips">
      <span class="chip p" id="rn-punkte">0</span>
      <span class="chip">Reihen <b id="rn-reihen">0</b></span>
      <span class="chip k">Stufe <b id="rn-stufe">1</b></span>
    </div>
    <div class="rn-buehne">
      <div class="feld-rahmen" id="rn-rahmen">
        <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
        <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
        <div class="rn-brett" id="rn-brett"></div>
        <div class="rn-effekte" id="rn-effekte"></div>
      </div>
      <div class="rn-seite">
        <span class="rn-klein">Als Nächstes</span>
        <div class="rn-vorschau" id="rn-vorschau"></div>
        <span class="rn-klein">Rekord</span><b class="rn-rekord" id="rn-rekord">0</b>
      </div>
    </div>
    <div class="rn-steuer">
      <button class="taste" data-rn="links" aria-label="Nach links">◀</button>
      <button class="taste" data-rn="drehen" aria-label="Drehen">⟳</button>
      <button class="taste" data-rn="rechts" aria-label="Nach rechts">▶</button>
      <button class="taste" data-rn="runter" aria-label="Schneller fallen">▼</button>
      <button class="taste breit" data-rn="ganz" aria-label="Ganz nach unten">⤓</button>
    </div>
    <p class="hinweis">Tippen dreht · seitlich ziehen schiebt · nach unten wischen lässt fallen${opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : ''}</p>
    <div id="rn-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#rn-' + id);
  const brett = $('brett'), rahmen = $('rahmen'), effekte = $('effekte');

  // ---------- Aufbau und Zeichnen ----------

  function aufbauen() {
    const breite = rahmen.clientWidth - 12, hoehe = rahmen.clientHeight - 12;
    g = Math.max(12, Math.floor(Math.min((breite - R.BREITE) / R.BREITE, (hoehe - R.HOEHE) / R.HOEHE)));
    brett.style.setProperty('--g', g + 'px');
    effekte.style.setProperty('--g', g + 'px');
    brett.style.gridTemplateColumns = `repeat(${R.BREITE}, ${g}px)`;
    brett.style.gridAutoRows = `${g}px`;
    brett.innerHTML = '';
    zellen = []; klassen = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < R.BREITE * R.HOEHE; i++) {
      const d = document.createElement('div');
      d.className = 'rz'; frag.appendChild(d); zellen.push(d); klassen.push('rz');
    }
    brett.appendChild(frag);
    const bw = R.BREITE * (g + 1), bh = R.HOEHE * (g + 1);
    const x = Math.round((rahmen.clientWidth - bw) / 2), y = Math.round((rahmen.clientHeight - bh) / 2);
    brett.style.transform = effekte.style.transform = `translate(${x}px, ${y}px)`;
    zeichnen();
  }

  function zeichnen() {
    const soll = s.feld.map(f => (f ? 'rz f' + f : 'rz'));
    const t = s.teil;
    if (t) {
      const farbe = R.FORMEN[t.form].farbe;
      const zellenT = R.zellenVon(t.form, t.dreh);
      if (!s.vorbei) {
        const gz = R.geistZeile(s);
        if (gz > t.r) for (const [dr, dc] of zellenT) { const r = gz + dr; if (r >= 0) soll[r * R.BREITE + t.c + dc] = 'rz geist g' + farbe; }
      }
      for (const [dr, dc] of zellenT) { const r = t.r + dr; if (r >= 0) soll[r * R.BREITE + t.c + dc] = 'rz f' + farbe + ' aktiv'; }
    }
    for (let i = 0; i < zellen.length; i++) if (soll[i] !== klassen[i]) { zellen[i].className = soll[i]; klassen[i] = soll[i]; }
    $('punkte').textContent = s.punkte.toLocaleString('de-DE');
    $('reihen').textContent = s.reihen;
    $('stufe').textContent = s.stufe;
    $('rekord').textContent = Math.max(s.rekord || 0, s.punkte).toLocaleString('de-DE');
    vorschau();
  }

  let vorschauText = '';
  function vorschau() {
    const text = s.naechste.slice(0, 2).join('');
    if (text === vorschauText) return;
    vorschauText = text;
    $('vorschau').innerHTML = s.naechste.slice(0, 2).map((form, k) => {
      const z = R.zellenVon(form, 0), farbe = R.FORMEN[form].farbe;
      const minR = Math.min(...z.map(x => x[0])), minC = Math.min(...z.map(x => x[1]));
      const w = Math.max(...z.map(x => x[1])) - minC + 1, h = Math.max(...z.map(x => x[0])) - minR + 1;
      return `<div class="rn-mini${k ? ' zweit' : ''}" style="grid-template-columns:repeat(${w},1fr);aspect-ratio:${w}/${h}">${
        Array.from({ length: w * h }, (_, i) => z.some(([r, c]) => (r - minR) * w + (c - minC) === i) ? `<i class="rz f${farbe}"></i>` : '<i></i>').join('')}</div>`;
    }).join('');
  }

  // ---------- Effekte ----------

  function effekt(html, klasse, x, y, dauer) {
    if (ruhig()) return;
    const e = document.createElement('div');
    e.className = klasse; e.innerHTML = html;
    if (x != null) { e.style.left = x + 'px'; e.style.top = y + 'px'; }
    effekte.appendChild(e);
    setTimeout(() => e.remove(), dauer);
  }

  function nachFestlegen(erg) {
    if (!erg) return;
    for (const i of erg.zellen) {
      const z = zellen[i];
      if (z && !ruhig()) { z.classList.add('landet'); setTimeout(() => z.classList.remove('landet'), 350); }
    }
    if (erg.reihen.length) {
      for (const r of erg.reihen) {
        effekt('', 'rn-strahl' + (erg.reihen.length >= 4 ? ' gold' : ''), 0, r * (g + 1), 700);
        effekt(Array.from({ length: 10 }, (_, k) => `<span style="left:${(k + 0.5) * (g + 1)}px;--dx:${(k - 4.5) * 6}px;--dy:${-20 - (k * 37 % 30)}px"></span>`).join(''), 'rn-funken', 0, r * (g + 1) + g / 2, 900);
      }
      const mitte = Math.min(...erg.reihen) * (g + 1);
      const text = erg.leer ? 'Alles frei!' : erg.reihen.length >= 4 ? 'Vierer!' : erg.reihen.length === 3 ? 'Dreier!' : erg.reihen.length === 2 ? 'Doppel!' : '';
      effekt(`${text ? `<b>${text}</b>` : ''}<span>+${erg.punkte}</span>`, 'rn-plus' + (erg.reihen.length >= 3 ? ' gross' : ''), R.BREITE * (g + 1) / 2, mitte, 1300);
      if (erg.reihen.length >= 4 && !ruhig()) { rahmen.classList.remove('beben'); void rahmen.offsetWidth; rahmen.classList.add('beben'); }
    }
    if (erg.stufeHoch) effekt(`<b>Stufe ${s.stufe}</b>`, 'rn-plus stufe', R.BREITE * (g + 1) / 2, R.HOEHE * (g + 1) * 0.35, 1600);
    sichern();
    if (s.vorbei) vorbei();
  }

  // ---------- Ablauf ----------

  function sichern() { sichernExt(JSON.parse(JSON.stringify(s))); }

  function schleife(t) {
    raf = 0;
    if (beendet || !laeuft) return;
    const dt = Math.min(100, letzte ? t - letzte : 16);
    letzte = t;
    if (!pause && darfLaufen() && !s.vorbei && !document.hidden) {
      if (R.liegtAuf(s)) {
        zeitHalten += dt;
        if (zeitHalten >= HALTEN_MS) { zeitHalten = 0; halteZaehler = 0; const erg = R.festlegen(s); zeichnen(); nachFestlegen(erg); }
      } else {
        zeitHalten = 0;
        zeitFall += dt;
        if (zeitFall >= R.fallMs(s.stufe)) { zeitFall = 0; R.runter(s); zeichnen(); }
      }
    }
    raf = requestAnimationFrame(schleife);
  }

  function starten() {
    if (s.vorbei) return;
    tafel(''); pause = false; laeuft = true; letzte = 0;
    $('pause').textContent = 'Pause';
    if (!raf) raf = requestAnimationFrame(schleife);
  }

  function pausieren(zeigen = true) {
    if (!laeuft || s.vorbei) return;
    pause = true; laeuft = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    sichern();
    if (zeigen) tafel(`<div class="tafel jade"><h2>Pause</h2><p>${s.punkte.toLocaleString('de-DE')} Punkte · ${s.reihen} Reihen</p>
      <button class="haupt" data-rnt="weiter">Weiter</button><button class="neben" data-rnt="neuFrage">Neues Spiel</button></div>`);
  }

  function vorbei() {
    laeuft = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const rekord = s.punkte >= (s.rekord || 0) && s.punkte > 0;
    if (!gemeldet) { gemeldet = true; melden('rn_spiel', { ergebnis: 'vorbei', punkte: s.punkte, reihen: s.reihen, stufe: s.stufe, teile: s.teile, rekord }); }
    sichern();
    setTimeout(() => {
      if (beendet) return;
      tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>${rekord ? 'Neuer Rekord!' : 'Kein Platz mehr'}</h2>
        <p class="gross">${s.punkte.toLocaleString('de-DE')}</p><p>${s.reihen} ${s.reihen === 1 ? 'Reihe' : 'Reihen'} · Stufe ${s.stufe}</p>
        <button class="haupt" data-rnt="neu">Nochmal</button></div>`);
    }, ruhig() ? 50 : 700);
  }

  function neuesSpiel() {
    if (!s.vorbei && s.teile > 0 && !gemeldet) melden('rn_spiel', { ergebnis: 'neu', punkte: s.punkte, reihen: s.reihen, stufe: s.stufe, teile: s.teile });
    s = R.neuStarten(s);
    gemeldet = false; zeitFall = 0; zeitHalten = 0; halteZaehler = 0; vorschauText = '';
    zeichnen(); sichern(); starten();
  }

  // ---------- Steuerung ----------

  const kannSteuern = () => laeuft && !pause && !s.vorbei && darfLaufen() && !$('tafel').innerHTML;
  function nachBewegung(ok) {
    if (!ok) return;
    if (R.liegtAuf(s) && halteZaehler < HALTEN_MAX) { zeitHalten = 0; halteZaehler++; }
    zeichnen();
  }
  const aktionen = {
    links: () => nachBewegung(R.bewegen(s, -1)),
    rechts: () => nachBewegung(R.bewegen(s, 1)),
    drehen: () => nachBewegung(R.drehen(s, 1)),
    runter: () => { if (R.runter(s, true)) { zeitFall = 0; zeichnen(); } },
    ganz: () => { const e = R.ganzRunter(s); zeitFall = 0; zeitHalten = 0; halteZaehler = 0; zeichnen(); nachFestlegen(e); }
  };
  function tun(a) { if (kannSteuern()) aktionen[a](); }

  // Tasten mit Wiederholung beim Festhalten
  let halten = null;
  function haltenStopp() { if (halten) { clearTimeout(halten.t); halten.el.classList.remove('an'); halten = null; } }
  an(wurzel.querySelector('.rn-steuer'), 'pointerdown', (e) => {
    const el = e.target.closest('[data-rn]');
    if (!el) return;
    e.preventDefault();
    haltenStopp();
    const a = el.dataset.rn;
    el.classList.add('an');
    tun(a);
    halten = { el, t: 0 };
    if (a === 'links' || a === 'rechts' || a === 'runter') {
      const wieder = () => { if (!halten) return; tun(a); halten.t = setTimeout(wieder, a === 'runter' ? WIEDERHOLEN.runter : WIEDERHOLEN.schritt); };
      halten.t = setTimeout(wieder, WIEDERHOLEN.start);
    }
  });
  for (const typ of ['pointerup', 'pointercancel', 'pointerleave']) an(wurzel.querySelector('.rn-steuer'), typ, haltenStopp);
  an(window, 'blur', haltenStopp);

  // Gesten auf dem Feld
  let zug = null;
  an(rahmen, 'pointerdown', (e) => { zug = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, bewegt: false, richtung: null }; });
  an(rahmen, 'pointermove', (e) => {
    if (!zug) return;
    const gx = e.clientX - zug.x, gy = e.clientY - zug.y;
    // Richtung einmal festlegen: wer nach unten zieht, schiebt in diesem Zug nicht mehr zur Seite (und umgekehrt)
    if (!zug.richtung) {
      if (Math.hypot(gx, gy) < 16) return;
      zug.richtung = Math.abs(gx) > Math.abs(gy) ? 'seite' : 'runter';
    }
    if (zug.richtung === 'seite') {
      // etwa 1,3 Felder Weg pro Schritt, der erste Schritt braucht etwas mehr
      const schritt = Math.max(30, g * 1.3), anlauf = schritt * 0.3;
      const weg = Math.abs(gx) - anlauf, soll = weg >= schritt ? Math.sign(gx) * Math.floor(weg / schritt) : 0;
      while (zug.dx !== soll) { const r = soll > zug.dx ? 1 : -1; tun(r > 0 ? 'rechts' : 'links'); zug.dx += r; zug.bewegt = true; }
    } else {
      const runterSchritt = Math.max(16, g);
      let dy = gy - zug.dy * runterSchritt;
      while (dy >= runterSchritt) { tun('runter'); zug.dy++; zug.bewegt = true; dy -= runterSchritt; }
    }
  });
  an(rahmen, 'pointerup', (e) => {
    if (!zug) return;
    const dt = performance.now() - zug.t, dy = e.clientY - zug.y, dx = e.clientX - zug.x;
    if (zug.richtung !== 'seite' && dy > 60 && dt < 260 && Math.abs(dy) > Math.abs(dx) * 1.2) tun('ganz');
    else if (!zug.bewegt && Math.abs(dx) < 10 && Math.abs(dy) < 10) tun('drehen');
    zug = null;
  });
  an(rahmen, 'pointercancel', () => { zug = null; });
  an(rahmen, 'touchmove', (e) => e.preventDefault(), { passive: false });
  an(document, 'keydown', (e) => {
    if (!wurzel.isConnected) return;
    const a = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'drehen', ArrowDown: 'runter', ' ': 'ganz' }[e.key];
    if (a) { e.preventDefault(); tun(a); }
    else if (e.key === 'p' || e.key === 'Escape') { e.preventDefault(); if (laeuft) pausieren(); }
  });

  an(wurzel, 'click', (e) => {
    const el = e.target.closest('[data-rnt]');
    if (!el) return;
    const a = el.dataset.rnt;
    if (a === 'los' || a === 'weiter') { if (darfLaufen()) starten(); }
    if (a === 'neu') { tafel(''); neuesSpiel(); }
    if (a === 'neuFrage') tafel(`<div class="tafel"><h2>Neues Spiel?</h2><p>Das jetzige Spiel ist dann weg.</p>
      <button class="haupt" data-rnt="neu">Neues Spiel</button><button class="neben" data-rnt="pauseZurueck">Weiterspielen</button></div>`);
    if (a === 'pauseZurueck') { if (darfLaufen()) starten(); }
  });
  an($('pause'), 'click', () => { if (laeuft) pausieren(); else if (!s.vorbei && !$('tafel').innerHTML) starten(); });
  an(document, 'visibilitychange', () => { if (document.hidden && laeuft) pausieren(); });
  let rt = null;
  an(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(aufbauen, 150); });

  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

  // ---------- Start ----------
  aufbauen();
  if (s.vorbei) { s = R.neuStarten(s); zeichnen(); }
  if (s.teile > 0) {
    tafel(`<div class="tafel jade"><h2>Runenfall</h2><p>Dein Spiel ist gespeichert: ${s.punkte.toLocaleString('de-DE')} Punkte.</p>
      <button class="haupt" data-rnt="weiter">Weiter</button><button class="neben" data-rnt="neuFrage">Neues Spiel</button></div>`);
  } else {
    tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>Runenfall</h2>
      <p>Runensteine fallen herunter. Lege sie so, dass <b>Reihen voll</b> werden. Volle Reihen verschwinden.</p>
      <p>Es wird langsam schneller. Mit „Pause“ kannst du jederzeit anhalten.</p>
      <button class="haupt" data-rnt="los">Los!</button></div>`);
  }

  return {
    beenden() { if (beendet) return; haltenStopp(); if (raf) cancelAnimationFrame(raf); sichern(); beendet = true; aus.abort(); },
    anhalten() { if (laeuft) pausieren(false); },
    stand: () => JSON.parse(JSON.stringify(s)),
    ruht: () => !laeuft || pause || s.vorbei || !!$('tafel').innerHTML
  };
}
