// Jadeschlange: Anzeige und Steuerung als Baustein (wie runenfall-ui.js).
// Regeln in ./jadeschlange.js, Aussehen in ../jadeschlange/jsg.css (unter .js-spiel, nutzt Grundstile aus km.css).
//
// jadeschlangeStarten(wurzel, {
//   stand,              // gespeichertes Spiel (oder null)
//   sichern(stand),     // Spiel speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll ('jsg_runde')
//   darfLaufen(),       // false, wenn gerade nicht gespielt werden darf
//   hinweisZusatz,
// }) → { beenden(), anhalten(), stand(), ruht() }
import * as J from './jadeschlange.js';

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const RICHTUNG_WINKEL = { rechts: 0, runter: 90, links: 180, hoch: 270 };

export function jadeschlangeStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let s = J.standPruefen(opt.stand) || J.neuesSpiel();
  let g = 24, laeuft = false, pause = false, beendet = false, gemeldet = false;
  let raf = 0, letzte = 0, seitTakt = 0, von = [], glieder = [], kopfWinkel = RICHTUNG_WINKEL[s.richtung];
  let kristallEl = null, goldEl = null, steinEls = new Map();

  wurzel.classList.add('km', 'js-spiel');
  wurzel.innerHTML = `
    <div class="kopf"><span class="titel">Jadeschlange</span><button class="knopf klein leise" id="jsg-pause">Pause</button></div>
    <div class="chips">
      <span class="chip p" id="jsg-punkte">0</span>
      <span class="chip">Länge <b id="jsg-laenge">4</b></span>
      <span class="chip k">Stufe <b id="jsg-stufe">1</b></span>
    </div>
    <div class="feld-rahmen" id="jsg-rahmen">
      <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
      <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
      <div class="jsg-brett" id="jsg-brett">
        <div class="jsg-dinge" id="jsg-dinge"></div>
        <div class="jsg-spur" id="jsg-spur"></div>
        <div class="jsg-schlange" id="jsg-schlange"></div>
        <div class="jsg-effekte" id="jsg-effekte"></div>
      </div>
    </div>
    <div class="steuer">
      <div class="kreuz" id="jsg-kreuz">
        <span></span><button class="taste" data-r="hoch" aria-label="Hoch" tabindex="-1">▲</button><span></span>
        <button class="taste" data-r="links" aria-label="Links" tabindex="-1">◀</button><span class="mitte"></span><button class="taste" data-r="rechts" aria-label="Rechts" tabindex="-1">▶</button>
        <span></span><button class="taste" data-r="runter" aria-label="Runter" tabindex="-1">▼</button><span></span>
      </div>
    </div>
    <div class="leiste"><button class="knopf klein" id="jsg-kreuz-schalter" aria-pressed="false">Steuerkreuz</button></div>
    <p class="hinweis" id="jsg-hinweis"></p>
    <div id="jsg-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#jsg-' + id);
  const rahmen = $('rahmen'), brett = $('brett'), dinge = $('dinge'), spurEl = $('spur'), schlangeEl = $('schlange'), effekte = $('effekte'), kreuz = $('kreuz');

  // ---------- Aufbau ----------

  function aufbauen() {
    const breite = rahmen.clientWidth - 12, hoehe = rahmen.clientHeight - 12;
    g = Math.max(12, Math.floor(Math.min(breite / s.w, hoehe / s.h)));
    const bw = s.w * g, bh = s.h * g;
    brett.style.width = bw + 'px'; brett.style.height = bh + 'px';
    brett.style.setProperty('--g', g + 'px');
    brett.style.left = Math.round((rahmen.clientWidth - bw) / 2) + 'px';
    brett.style.top = Math.round((rahmen.clientHeight - bh) / 2) + 'px';
    dinge.innerHTML = ''; schlangeEl.innerHTML = ''; spurEl.innerHTML = '';
    kristallEl = null; goldEl = null; steinEls = new Map(); glieder = [];
    von = s.schlange.slice();
    dingeZeichnen();
    gliederAbgleichen();
    zeichnen(1);
    anzeige();
  }

  const xy = (i) => [(i % s.w) * g, Math.floor(i / s.w) * g];

  function element(klasse, i, eltern = dinge) {
    const e = document.createElement('div');
    e.className = klasse;
    const [x, y] = xy(i);
    e.style.transform = `translate(${x}px, ${y}px)`;
    e.innerHTML = '<i></i>';
    eltern.appendChild(e);
    return e;
  }

  function dingeZeichnen() {
    if (s.kristall >= 0) {
      if (!kristallEl) kristallEl = element('jsg-kristall', s.kristall);
      else { const [x, y] = xy(s.kristall); kristallEl.style.transform = `translate(${x}px, ${y}px)`; kristallEl.classList.remove('neu'); void kristallEl.offsetWidth; kristallEl.classList.add('neu'); }
    }
    if (s.gold && !goldEl) goldEl = element('jsg-kristall gold', s.gold.i);
    if (!s.gold && goldEl) { goldEl.remove(); goldEl = null; }
    for (const [i, e] of steinEls) if (!s.steine.includes(i)) { e.remove(); steinEls.delete(i); }
    for (const i of s.steine) if (!steinEls.has(i)) { const e = element('jsg-stein v' + (i % 3), i); steinEls.set(i, e); }
  }

  function gliederAbgleichen() {
    while (glieder.length < s.schlange.length) {
      const e = document.createElement('div');
      e.className = glieder.length === 0 ? 'jsg-glied kopf' : 'jsg-glied';
      e.innerHTML = glieder.length === 0 ? '<i class="auge l"></i><i class="auge r"></i>' : '<i></i>';
      schlangeEl.appendChild(e);
      glieder.push(e);
    }
    while (glieder.length > s.schlange.length) glieder.pop().remove();
    // Körper wird zum Schwanz hin schmaler
    const n = glieder.length;
    glieder.forEach((e, k) => { if (k) e.style.setProperty('--d', (0.95 - 0.35 * (k / Math.max(1, n - 1))).toFixed(3)); e.style.zIndex = String(n - k); });
  }

  // Zwischen zwei Takten weich gleiten. Durch ein Tor kommt das Glied von außen herein.
  function zeichnen(t) {
    const zeit = performance.now() / 1000;
    for (let k = 0; k < glieder.length; k++) {
      const ziel = s.schlange[k], start = von[Math.min(k, von.length - 1)] ?? ziel;
      let [x1, y1] = xy(ziel), [x0, y0] = xy(start);
      if (Math.abs(x1 - x0) > g * 1.5) x0 = x1 + (x1 > x0 ? -g : g);
      if (Math.abs(y1 - y0) > g * 1.5) y0 = y1 + (y1 > y0 ? -g : g);
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const welle = ruhig() || k === 0 ? 1 : 1 + 0.06 * Math.sin(zeit * 4 - k * 0.7);
      if (k === 0) glieder[k].style.transform = `translate(${x}px, ${y}px) rotate(${kopfWinkel}deg)`;
      else glieder[k].style.transform = `translate(${x}px, ${y}px) scale(${welle.toFixed(3)})`;
    }
    if (goldEl && s.gold) goldEl.style.setProperty('--rest', Math.max(0, (s.gold.bis - s.takte) / J.GOLD_TAKTE).toFixed(3));
  }

  function anzeige() {
    $('punkte').textContent = s.punkte.toLocaleString('de-DE');
    $('laenge').textContent = s.schlange.length + s.wachsen;
    $('stufe').textContent = s.stufe;
  }

  // ---------- Effekte ----------

  function effekt(html, klasse, i, dauer, eltern = effekte) {
    if (ruhig()) return;
    const e = document.createElement('div');
    e.className = klasse; e.innerHTML = html;
    const [x, y] = xy(i);
    e.style.left = x + g / 2 + 'px'; e.style.top = y + g / 2 + 'px';
    eltern.appendChild(e);
    setTimeout(() => e.remove(), dauer);
  }
  const funken = (n) => Array.from({ length: n }, (_, k) => `<span style="--w:${Math.round(k * 360 / n)}deg"></span>`).join('');

  function spur(i) {
    if (ruhig()) return;
    const [x, y] = xy(i);
    const e = document.createElement('div');
    e.className = 'jsg-funke';
    e.style.left = x + g / 2 + (Math.random() - 0.5) * g * 0.6 + 'px';
    e.style.top = y + g / 2 + (Math.random() - 0.5) * g * 0.6 + 'px';
    spurEl.appendChild(e);
    setTimeout(() => e.remove(), 1400);
  }

  function ereignisse(ev) {
    for (const e of ev) {
      if (e.art === 'kristall') {
        effekt(funken(8), 'jsg-platzen', e.i, 800);
        effekt(`+${J.PUNKTE_KRISTALL * (s.stufe - (s.kristalle % J.KRISTALLE_PRO_STUFE === 0 ? 1 : 0))}`, 'jsg-plus', e.i, 900);
        const kopf = glieder[0];
        if (kopf && !ruhig()) { kopf.classList.remove('frisst'); void kopf.offsetWidth; kopf.classList.add('frisst'); }
      }
      if (e.art === 'gold') { effekt(funken(12), 'jsg-platzen gold', e.i, 1000); effekt(`+${J.PUNKTE_GOLD * s.stufe}`, 'jsg-plus gold', e.i, 1100); }
      if (e.art === 'gold_weg') effekt('', 'jsg-verpufft', e.i, 700);
      if (e.art === 'stein') { effekt(funken(6), 'jsg-platzen stein', e.i, 700); if (e.kuerzer) meldung('Stein zerbrochen. Die Schlange ist etwas kürzer.'); }
      if (e.art === 'stufe') {
        effekt(`<b>Stufe ${e.stufe}</b>${e.steine.length ? '<span>Neue Steine im Weg</span>' : ''}`, 'jsg-stufe', Math.floor(s.h / 3) * s.w + Math.floor(s.w / 2), 1800);
        if (!ruhig()) { rahmen.classList.remove('jsg-glanz'); void rahmen.offsetWidth; rahmen.classList.add('jsg-glanz'); }
      }
    }
    dingeZeichnen();
    gliederAbgleichen();
    anzeige();
  }

  let meldungT = 0;
  function meldung(t) {
    $('hinweis').textContent = t;
    clearTimeout(meldungT);
    meldungT = setTimeout(hinweisNormal, 2500);
  }
  function hinweisNormal() {
    $('hinweis').textContent = (wurzel.classList.contains('mit-kreuz') ? 'Steuerkreuz tippen oder auf dem Feld wischen' : 'Auf dem Feld wischen, um die Schlange zu lenken')
      + (opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : '');
  }

  // ---------- Ablauf ----------

  function sichern() { const k = { ...s, puffer: [] }; sichernExt(JSON.parse(JSON.stringify(k))); }

  function schleife(t) {
    raf = 0;
    if (beendet || !laeuft) return;
    const dt = Math.min(100, letzte ? t - letzte : 16);
    letzte = t;
    if (!pause && darfLaufen() && !s.vorbei && !document.hidden) {
      seitTakt += dt;
      const ms = J.schrittMs(s.kristalle);
      if (seitTakt >= ms) {
        seitTakt -= ms;
        if (seitTakt > ms) seitTakt = 0;
        von = s.schlange.slice();
        const vorher = s.schlange[s.schlange.length - 1];
        const ev = J.takt(s);
        kopfWinkel = naechsterWinkel(kopfWinkel, RICHTUNG_WINKEL[s.richtung]);
        if (s.vorbei) { gebissen(ev.find(e => e.art === 'biss')); return; }
        spur(vorher);
        if (ev.length) { ereignisse(ev); if (ev.some(e => e.art === 'kristall' || e.art === 'gold' || e.art === 'stufe')) sichern(); }
        else if (s.takte % 25 === 0) sichern();
      }
      zeichnen(Math.min(1, seitTakt / J.schrittMs(s.kristalle)));
    }
    raf = requestAnimationFrame(schleife);
  }

  // Kopf dreht sich auf dem kürzesten Weg
  function naechsterWinkel(alt, neu) {
    let d = ((neu - alt) % 360 + 540) % 360 - 180;
    return alt + d;
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
    s.puffer = [];
    sichern();
    if (zeigen) tafel(`<div class="tafel jade"><h2>Pause</h2><p>${s.punkte.toLocaleString('de-DE')} Punkte · Länge ${s.schlange.length}</p>
      <button class="haupt" data-jsg="weiter">Weiter</button><button class="neben" data-jsg="neuFrage">Neues Spiel</button></div>`);
  }

  function gebissen(e) {
    laeuft = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    zeichnen(1);
    if (!ruhig()) {
      glieder.forEach((el, k) => { el.style.transitionDelay = `${k * 25}ms`; el.classList.add('loest'); });
      if (e) effekt(funken(10), 'jsg-platzen', e.i, 900);
    }
    const rekord = s.punkte > 0 && s.punkte >= s.rekord;
    if (!gemeldet) { gemeldet = true; melden('jsg_runde', { ergebnis: 'biss', punkte: s.punkte, laenge: s.schlange.length, stufe: s.stufe, kristalle: s.kristalle, rekord }); }
    sichern();
    setTimeout(() => {
      if (beendet) return;
      tafel(`<div class="tafel jade"><div class="bild-schlange"></div><h2>${rekord ? 'Neuer Rekord!' : 'Die Schlange hat sich gebissen'}</h2>
        <p class="gross">${s.punkte.toLocaleString('de-DE')}</p><p>Länge ${s.schlange.length} · ${s.kristalle} Kristalle · Stufe ${s.stufe}</p>
        ${!rekord && s.rekord ? `<p>Rekord: ${s.rekord.toLocaleString('de-DE')}</p>` : ''}
        <button class="haupt" data-jsg="neu">Nochmal</button></div>`);
    }, ruhig() ? 50 : 900);
  }

  function neuesSpiel() {
    if (!s.vorbei && s.kristalle > 0 && !gemeldet) melden('jsg_runde', { ergebnis: 'neu', punkte: s.punkte, laenge: s.schlange.length, stufe: s.stufe, kristalle: s.kristalle, rekord: false });
    s = J.neuStarten(s);
    gemeldet = false; seitTakt = 0; kopfWinkel = RICHTUNG_WINKEL[s.richtung];
    aufbauen(); sichern(); starten();
  }

  // ---------- Steuerung ----------

  function lenke(r) {
    if (!laeuft || pause || s.vorbei || !darfLaufen()) return;
    J.lenken(s, r);
  }

  // Wischen auf dem Feld: Richtung nach etwa 16 px festlegen, danach kann im selben Zug neu gewischt werden
  let zug = null;
  an(rahmen, 'pointerdown', (e) => { zug = { x: e.clientX, y: e.clientY }; });
  an(rahmen, 'pointermove', (e) => {
    if (!zug) return;
    const dx = e.clientX - zug.x, dy = e.clientY - zug.y;
    if (Math.hypot(dx, dy) < 16) return;
    lenke(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch'));
    zug = { x: e.clientX, y: e.clientY };
  });
  for (const typ of ['pointerup', 'pointercancel', 'pointerleave']) an(rahmen, typ, () => { zug = null; });
  an(rahmen, 'touchmove', (e) => e.preventDefault(), { passive: false });

  // Steuerkreuz: Richtung aus der Lage zur Mitte
  function kreuzRichtung(e) {
    const b = kreuz.getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    if (Math.hypot(dx, dy) < 12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch');
  }
  const kreuzZeigen = (r) => { for (const t of kreuz.querySelectorAll('.taste')) t.classList.toggle('an', t.dataset.r === r); };
  let kreuzAktiv = null, kreuzGedrueckt = false;
  an(kreuz, 'pointerdown', (e) => {
    e.preventDefault();
    try { kreuz.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    kreuzGedrueckt = true;
    const r = kreuzRichtung(e); kreuzAktiv = r; kreuzZeigen(r); if (r) lenke(r);
  });
  an(kreuz, 'pointermove', (e) => {
    if (!kreuzGedrueckt) return;
    const r = kreuzRichtung(e);
    if (r && r !== kreuzAktiv) { kreuzAktiv = r; kreuzZeigen(r); lenke(r); }
  });
  for (const typ of ['pointerup', 'pointercancel']) an(kreuz, typ, () => { kreuzGedrueckt = false; kreuzAktiv = null; kreuzZeigen(null); });

  function kreuzAnzeigen(ein) {
    wurzel.classList.toggle('mit-kreuz', ein);
    $('kreuz-schalter').setAttribute('aria-pressed', String(ein));
    s.kreuz = ein;
    hinweisNormal();
    requestAnimationFrame(() => { if (!beendet) { aufbauen(); } });
  }
  an($('kreuz-schalter'), 'click', () => { kreuzAnzeigen(!wurzel.classList.contains('mit-kreuz')); sichern(); });

  an(document, 'keydown', (e) => {
    if (!wurzel.isConnected) return;
    const r = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'hoch', ArrowDown: 'runter', a: 'links', d: 'rechts', w: 'hoch', s: 'runter' }[e.key];
    if (r) { e.preventDefault(); lenke(r); }
    else if (e.key === 'p' || e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      if (laeuft) pausieren(); else if (pause && $('tafel').innerHTML && darfLaufen()) starten();
    }
  });

  an(wurzel, 'click', (e) => {
    const el = e.target.closest('[data-jsg]');
    if (!el) return;
    const a = el.dataset.jsg;
    if (a === 'los' || a === 'weiter' || a === 'pauseZurueck') { if (darfLaufen()) starten(); }
    if (a === 'neu') { tafel(''); neuesSpiel(); }
    if (a === 'neuFrage') tafel(`<div class="tafel"><h2>Neues Spiel?</h2><p>Das jetzige Spiel ist dann weg.</p>
      <button class="haupt" data-jsg="neu">Neues Spiel</button><button class="neben" data-jsg="pauseZurueck">Weiterspielen</button></div>`);
  });
  an($('pause'), 'click', () => { if (laeuft) pausieren(); else if (!s.vorbei && !$('tafel').innerHTML) starten(); });
  an(document, 'visibilitychange', () => { if (document.hidden && laeuft) pausieren(); });
  let rt = null;
  an(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!beendet) aufbauen(); }, 150); });

  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

  // ---------- Start ----------
  if (s.vorbei) s = J.neuStarten(s);
  wurzel.classList.toggle('mit-kreuz', !!s.kreuz);
  $('kreuz-schalter').setAttribute('aria-pressed', String(!!s.kreuz));
  hinweisNormal();
  aufbauen();
  if (s.takte > 0) {
    tafel(`<div class="tafel jade"><h2>Jadeschlange</h2><p>Dein Spiel ist gespeichert: ${s.punkte.toLocaleString('de-DE')} Punkte, Länge ${s.schlange.length}.</p>
      <button class="haupt" data-jsg="weiter">Weiter</button><button class="neben" data-jsg="neuFrage">Neues Spiel</button></div>`);
  } else {
    tafel(`<div class="tafel jade"><div class="bild-schlange"></div><h2>Jadeschlange</h2>
      <p>Lenke die Schlange zu den <b>Kristallen</b>. Mit jedem Kristall wird sie länger.</p>
      <p>Am Rand kommt sie auf der anderen Seite wieder heraus. Beiß dich nur nicht selbst.</p>
      <button class="haupt" data-jsg="los">Los!</button></div>`);
  }

  return {
    beenden() { if (beendet) return; if (raf) cancelAnimationFrame(raf); clearTimeout(meldungT); sichern(); beendet = true; aus.abort(); },
    anhalten() { if (laeuft) pausieren(false); },
    stand: () => JSON.parse(JSON.stringify(s)),
    ruht: () => !laeuft || pause || s.vorbei || !!$('tafel').innerHTML
  };
}
