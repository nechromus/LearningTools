// Höhlenkarte: Anzeige und Steuerung als Baustein (wie runenfall-ui.js).
// Regeln in ./hoehlenkarte.js, Aussehen in ../hoehlenkarte/hk.css (unter .hk, nutzt Grundstile aus km.css).
//
// hoehlenkarteStarten(wurzel, {
//   stand,              // gespeicherte Karte (oder null)
//   sichern(stand),     // Karte speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll ('hk_karte')
//   darfLaufen(),       // false, wenn gerade nicht gespielt werden darf
//   hinweisZusatz,
// }) → { beenden(), anhalten(), stand(), ruht() }
import * as H from './hoehlenkarte.js';

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const LANG_MS = 400;

export function hoehlenkarteStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let s = H.standPruefen(opt.stand);
  let g = 32, zellen = [], klassen = [], markierModus = false, angehalten = false, beendet = false, gemeldet = false;
  let letzteGroesse = (s && s.groesse) || 'klein';

  wurzel.classList.add('km', 'hk');
  wurzel.innerHTML = `
    <div class="kopf"><span class="titel">Höhlenkarte</span><span class="chip" id="hk-groesse">Klein</span></div>
    <div class="chips">
      <span class="chip k" id="hk-chip-fallen"><span class="hk-falle-mini"></span>Fallen <b id="hk-fallen">0</b></span>
      <span class="chip p" id="hk-offen">0 %</span>
    </div>
    <div class="feld-rahmen" id="hk-rahmen">
      <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
      <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
      <div class="hk-brett" id="hk-brett"></div>
      <div class="hk-effekte" id="hk-effekte"></div>
      <div class="hk-meldung" id="hk-meldung" aria-live="polite"></div>
    </div>
    <div class="leiste">
      <button class="knopf hk-modus" id="hk-modus" aria-pressed="false"><span class="hk-kristall-mini"></span>Markieren</button>
      <button class="knopf" id="hk-tipp">Tipp</button>
      <button class="knopf klein leise" id="hk-neu">Neue Karte</button>
    </div>
    <p class="hinweis">Tippe ein Feld an. Die Zahl sagt, wie viele Fallen daneben liegen. Lange drücken markiert.${opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : ''}</p>
    <div id="hk-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#hk-' + id);
  const brett = $('brett'), rahmen = $('rahmen'), effekte = $('effekte');

  function sichern() { if (s) sichernExt(JSON.parse(JSON.stringify(s))); }
  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }
  function meldung(t) { const m = $('meldung'); m.textContent = t; m.classList.toggle('an', !!t); clearTimeout(meldung.t); if (t) meldung.t = setTimeout(() => m.classList.remove('an'), 3200); }

  // ---------- Aufbau und Zeichnen ----------

  function aufbauen() {
    if (!s) { brett.innerHTML = ''; return; }
    const breite = rahmen.clientWidth - 14, hoehe = rahmen.clientHeight - 14;
    g = Math.max(22, Math.min(54, Math.floor(Math.min((breite - s.w) / s.w, (hoehe - s.h) / s.h))));
    brett.style.setProperty('--g', g + 'px');
    effekte.style.setProperty('--g', g + 'px');
    brett.style.gridTemplateColumns = `repeat(${s.w}, ${g}px)`;
    brett.style.gridAutoRows = `${g}px`;
    brett.innerHTML = '';
    zellen = []; klassen = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < s.w * s.h; i++) {
      const d = document.createElement('div');
      d.dataset.i = i;
      d.className = 'hz'; frag.appendChild(d); zellen.push(d); klassen.push('');
    }
    brett.appendChild(frag);
    const bw = s.w * (g + 1), bh = s.h * (g + 1);
    const x = Math.round((rahmen.clientWidth - bw) / 2), y = Math.round((rahmen.clientHeight - bh) / 2);
    brett.style.transform = effekte.style.transform = `translate(${x}px, ${y}px)`;
    zeichnen();
  }

  function klasseVon(i) {
    const v = ' v' + ((i * 7 + (i >> 3)) % 3);
    if (s.offen[i]) return 'hz offen' + v + (s.feld[i] > 0 ? ' n' + s.feld[i] : '');
    if (s.bekannt[i]) return 'hz zu bekannt' + v;
    if (s.vorbei === 'falle' && i === s.falle) return 'hz offen getroffen' + v;
    if (s.vorbei === 'geschafft' && s.feld[i] === -1) return 'hz zu ruhig' + v;
    return 'hz zu' + v + (s.markiert[i] ? ' mark' : '');
  }

  function zeichnen() {
    if (!s) return;
    for (let i = 0; i < zellen.length; i++) {
      const k = klasseVon(i);
      if (k !== klassen[i]) {
        zellen[i].className = k; klassen[i] = k;
        zellen[i].textContent = s.offen[i] && s.feld[i] > 0 ? s.feld[i] : '';
      }
    }
    $('fallen').textContent = s.vorbei === 'geschafft' ? 0 : Math.max(0, H.fallenUebrig(s));
    $('groesse').textContent = H.GROESSEN[s.groesse].name;
    const sicher = s.w * s.h - s.fallen;
    $('offen').textContent = Math.floor(H.offeneZahl(s) / sicher * 100) + ' %';
    $('modus').classList.toggle('an', markierModus);
    $('modus').setAttribute('aria-pressed', markierModus);
  }

  // Welle beim Aufdecken
  function welle(geoeffnet) {
    if (ruhig() || !geoeffnet.length) return;
    for (const { i, d } of geoeffnet) {
      const z = zellen[i];
      if (!z) continue;
      z.style.animationDelay = Math.min(d, 14) * 35 + 'ms';
      z.classList.remove('neu'); void z.offsetWidth; z.classList.add('neu');
      setTimeout(() => { z.classList.remove('neu'); z.style.animationDelay = ''; }, Math.min(d, 14) * 35 + 450);
    }
  }

  function effekt(html, klasse, x, y, dauer) {
    if (ruhig()) return;
    const e = document.createElement('div');
    e.className = klasse; e.innerHTML = html;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    effekte.appendChild(e);
    setTimeout(() => e.remove(), dauer);
  }
  const mitte = (i) => [(i % s.w) * (g + 1) + g / 2, Math.floor(i / s.w) * (g + 1) + g / 2];

  // ---------- Spielzüge ----------

  const kannSpielen = () => s && !s.vorbei && !angehalten && darfLaufen() && !$('tafel').innerHTML;

  function nachZug(erg) {
    if (!erg) return;
    zeichnen();
    welle(erg.geoeffnet);
    sichern();
    if (erg.falle >= 0) {
      const [x, y] = mitte(erg.falle);
      effekt('<i></i><i></i><i></i>', 'hk-falle-effekt', x, y, 1100);
      if (!ruhig()) { rahmen.classList.remove('beben'); void rahmen.offsetWidth; rahmen.classList.add('beben'); }
      setTimeout(() => {
        if (beendet || !s || s.vorbei !== 'falle') return;
        tafel(`<div class="tafel"><div class="hk-bild-falle"></div><h2>Eine Falle!</h2>
          <p>Kein Problem. Nimm den Schritt zurück und spiel weiter.</p><p>Die Falle bleibt dann markiert.</p>
          <button class="haupt" data-hkt="zurueck">Zurücknehmen</button><button class="neben" data-hkt="neuWahl">Neue Karte</button></div>`);
      }, ruhig() ? 50 : 650);
    } else if (erg.geschafft) gewonnen();
  }

  function tippen(i) {
    if (!kannSpielen()) return;
    if (markierModus && !s.offen[i]) { if (H.markieren(s, i)) { zeichnen(); sichern(); } return; }
    nachZug(H.aufdecken(s, i));
  }

  function lang(i) {
    if (!kannSpielen() || s.offen[i]) return;
    if (H.markieren(s, i)) {
      zeichnen(); sichern();
      if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) { /* egal */ }
      const z = zellen[i];
      if (z && !ruhig()) { z.classList.remove('gesetzt'); void z.offsetWidth; z.classList.add('gesetzt'); }
    }
  }

  function tipp() {
    if (!kannSpielen()) return;
    const erg = H.tipp(s);
    if (!erg) return;
    const [x, y] = mitte(erg.feld);
    effekt('', 'hk-tipp-ring', x, y, 1200);
    meldung(erg.falle >= 0 ? '' : 'Dieses Feld ist sicher.');
    nachZug(erg);
  }

  function gewonnen() {
    if (!gemeldet) { gemeldet = true; melden('hk_karte', { groesse: s.groesse, ergebnis: 'geschafft', zurueck: s.zurueck, tipps: s.tipps, felder: H.offeneZahl(s) }); }
    sichern();
    if (!ruhig()) {
      s.feld.forEach((f, i) => {
        if (f !== -1) return;
        const [x, y] = mitte(i);
        setTimeout(() => effekt('<i></i><i></i><i></i><i></i>', 'hk-funkeln', x, y, 1200), 120 + (i % 9) * 60);
      });
    }
    setTimeout(() => {
      if (beendet) return;
      tafel(`<div class="tafel jade"><div class="bild-raute"></div><h2>Karte vollständig!</h2>
        <p>Du hast alle ${s.fallen} Fallen gefunden.</p>
        <p>Größe: ${H.GROESSEN[s.groesse].name}${s.zurueck ? ` · ${s.zurueck}-mal zurückgenommen` : ' · ohne Zurücknehmen'}${s.tipps ? ` · ${s.tipps} ${s.tipps === 1 ? 'Tipp' : 'Tipps'}` : ''}</p>
        <button class="haupt" data-hkt="neuWahl">Neue Karte</button></div>`);
    }, ruhig() ? 50 : 1300);
  }

  function abbrechenMelden() {
    if (s && !gemeldet && s.gelegt && s.vorbei !== 'geschafft' && s.zuege > 0) {
      gemeldet = true;
      melden('hk_karte', { groesse: s.groesse, ergebnis: 'neu', zurueck: s.zurueck, tipps: s.tipps, felder: H.offeneZahl(s) });
    }
  }

  function groessenWahl(abbrechbar = false) {
    const k = (id) => { const x = H.GROESSEN[id]; return `<button class="hk-wahl${id === letzteGroesse ? ' jetzt' : ''}" data-hkt="neu" data-g="${id}"><b>${x.name}</b><span>${x.w} × ${x.h} Felder · ${x.fallen} Fallen</span></button>`; };
    tafel(`<div class="tafel jade"><div class="hk-bild-karte"></div><h2>Höhlenkarte</h2>
      <p>In der Höhle sind Fallen versteckt. Decke alle sicheren Felder auf.</p>
      <div class="hk-wahl-liste">${k('klein')}${k('mittel')}${k('gross')}</div>
      ${abbrechbar ? '<button class="neben" data-hkt="zu">Weiterspielen</button>' : ''}</div>`);
  }

  function neueKarte(groesse) {
    abbrechenMelden();
    letzteGroesse = groesse;
    s = H.neueKarte(groesse);
    gemeldet = false; markierModus = false;
    tafel('');
    aufbauen(); sichern();
  }

  // ---------- Eingaben ----------

  let druck = null;
  an(brett, 'pointerdown', (e) => {
    const z = e.target.closest('.hz');
    if (!z) return;
    const i = Number(z.dataset.i);
    druck = { i, x: e.clientX, y: e.clientY, lang: false, t: setTimeout(() => { if (druck) { druck.lang = true; lang(i); } }, LANG_MS) };
    z.classList.add('gedrueckt');
  });
  const druckEnde = () => { if (druck) { clearTimeout(druck.t); const z = zellen[druck.i]; if (z) z.classList.remove('gedrueckt'); } };
  an(brett, 'pointermove', (e) => { if (druck && Math.hypot(e.clientX - druck.x, e.clientY - druck.y) > 12) { druckEnde(); druck = null; } });
  an(brett, 'pointerup', () => { if (!druck) return; druckEnde(); if (!druck.lang) tippen(druck.i); druck = null; });
  an(brett, 'pointercancel', () => { druckEnde(); druck = null; });
  an(brett, 'contextmenu', (e) => e.preventDefault());
  an(rahmen, 'touchmove', (e) => e.preventDefault(), { passive: false });

  an($('modus'), 'click', () => { markierModus = !markierModus; zeichnen(); meldung(markierModus ? 'Jetzt markierst du Fallen.' : 'Jetzt deckst du Felder auf.'); });
  an($('tipp'), 'click', tipp);
  an($('neu'), 'click', () => {
    if (!s || !s.gelegt || s.vorbei === 'geschafft') return groessenWahl(!!s && !s.vorbei);
    tafel(`<div class="tafel"><h2>Neue Karte?</h2><p>Die jetzige Karte ist dann weg.</p>
      <button class="haupt" data-hkt="neuWahl">Neue Karte</button><button class="neben" data-hkt="zu">Weiterspielen</button></div>`);
  });
  an(wurzel, 'click', (e) => {
    const el = e.target.closest('[data-hkt]');
    if (!el) return;
    const a = el.dataset.hkt;
    if (a === 'zu') tafel('');
    if (a === 'neuWahl') groessenWahl(false);
    if (a === 'neu') neueKarte(el.dataset.g);
    if (a === 'zurueck') { if (H.zuruecknehmen(s)) { tafel(''); zeichnen(); sichern(); meldung('Die Falle ist jetzt markiert.'); if (s.vorbei === 'geschafft') gewonnen(); } }
  });
  an(document, 'keydown', (e) => {
    if (!wurzel.isConnected) return;
    if (e.key === 'm') { markierModus = !markierModus; zeichnen(); }
  });
  let rt = null;
  an(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(aufbauen, 150); });

  // ---------- Start ----------
  if (s && s.vorbei === 'geschafft') s = null;
  if (s) {
    aufbauen();
    if (s.vorbei === 'falle') nachZug({ geoeffnet: [], falle: s.falle, geschafft: false });
  } else groessenWahl(false);

  return {
    beenden() { if (beendet) return; druckEnde(); sichern(); beendet = true; aus.abort(); },
    anhalten() { angehalten = true; },
    stand: () => (s ? JSON.parse(JSON.stringify(s)) : null),
    ruht: () => !!$('tafel').innerHTML
  };
}
