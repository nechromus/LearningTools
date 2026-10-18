// Runenreihen: Anzeige und Steuerung als Baustein (wie runenfall-ui.js).
// Regeln in ./runenreihen.js, Aussehen in ../runenreihen/rr.css (unter .rr, nutzt Grundstile aus km.css).
//
// runenreihenStarten(wurzel, {
//   stand,              // gespeichertes Spiel (oder null)
//   sichern(stand),     // Spiel speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll ('rr_stufe', 'rr_neu')
//   darfLaufen(),       // false, wenn gerade nicht gespielt werden darf
//   hinweisZusatz,
// }) → { beenden(), anhalten(), stand(), ruht() }
import * as R from './runenreihen.js';

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIPP_MS = 6000;
const ZEIT = { tausch: 190, weg: 260, fallProZeile: 70, fallMin: 160, fallMax: 420, wackeln: 320 };

export function runenreihenStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let s = R.standPruefen(opt.stand) || R.neuesSpiel();
  let g = 40, p = 42, sprites = new Map(), beschaeftigt = false, gewaehlt = -1, beendet = false, gestoppt = false;
  let tippTimer = 0, laufende = [];

  wurzel.classList.add('km', 'rr');
  wurzel.innerHTML = `
    <div class="kopf"><span class="titel">Runenreihen</span><button class="knopf klein leise" id="rr-neu">Neues Spiel</button></div>
    <div class="chips">
      <span class="chip p" id="rr-punkte">0</span>
      <span class="chip k rr-stufe-chip"><span>Stufe <b id="rr-stufe">1</b></span><span class="rr-balken"><i id="rr-balken"></i></span></span>
    </div>
    <div class="feld-rahmen" id="rr-rahmen">
      <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
      <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
      <div class="rr-brett" id="rr-brett"><div class="rr-gitter" id="rr-gitter"></div><div class="rr-steine" id="rr-steine"></div><div class="rr-effekte" id="rr-effekte"></div></div>
      <div class="rr-meldung" id="rr-meldung" aria-live="polite"></div>
    </div>
    <div class="leiste">
      <button class="knopf" id="rr-tipp">Tipp</button>
      <span class="rr-rekord">Rekord <b id="rr-rekord">0</b></span>
    </div>
    <p class="hinweis">Wische einen Stein zum Nachbarn oder tippe zwei Nachbarn an. Drei gleiche in einer Reihe verschwinden.${opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : ''}</p>
    <div id="rr-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#rr-' + id);
  const rahmen = $('rahmen'), brett = $('brett'), steineEbene = $('steine'), effekte = $('effekte');

  // ---------- Aufbau und Zeichnen ----------

  const pos = (i) => [R.spalte(i) * p, R.zeile(i) * p];
  const klasse = (x) => `rr-stein a${x.s === R.STERN ? 's' : x.a}${x.s === 1 ? ' funke-h' : x.s === 2 ? ' funke-v' : x.s === R.STERN ? ' stern' : ''}`;

  function aufbauen() {
    const breite = rahmen.clientWidth - 16, hoehe = rahmen.clientHeight - 16;
    p = Math.max(30, Math.min(62, Math.floor(Math.min(breite, hoehe) / R.N)));
    g = p - 3;
    brett.style.setProperty('--g', g + 'px');
    brett.style.setProperty('--p', p + 'px');
    brett.style.width = brett.style.height = R.N * p + 'px';
    brett.style.left = Math.round((rahmen.clientWidth - R.N * p) / 2) + 'px';
    brett.style.top = Math.round((rahmen.clientHeight - R.N * p) / 2) + 'px';
    $('gitter').innerHTML = Array.from({ length: R.N * R.N }, (_, i) => `<i class="${(R.zeile(i) + R.spalte(i)) % 2 ? 'dunkel' : ''}"></i>`).join('');
    steineEbene.innerHTML = '';
    sprites = new Map();
    s.feld.forEach((x, i) => spriteNeu(x, i));
    anzeige();
  }

  function spriteNeu(x, i, vonZeile = null) {
    const d = document.createElement('div');
    d.className = klasse(x);
    d.innerHTML = '<i></i>';
    const [px, py] = pos(i);
    d.style.transition = 'none';
    d.style.transform = `translate(${px}px, ${vonZeile == null ? py : vonZeile * p}px)`;
    steineEbene.appendChild(d);
    sprites.set(x.id, d);
    return d;
  }

  function setzen(id, i, dauer = null) {
    const d = sprites.get(id);
    if (!d) return;
    const [x, y] = pos(i);
    d.style.transition = dauer == null ? '' : `transform ${dauer}ms ${dauer > 200 ? 'cubic-bezier(.45,.05,.75,1.25)' : 'ease-out'}`;
    d.style.transform = `translate(${x}px, ${y}px)`;
  }

  // Alles hart auf den Stand der Logik setzen (nach Animationen, beim Anhalten)
  function abgleichen() {
    const da = new Set();
    s.feld.forEach((x, i) => {
      da.add(x.id);
      let d = sprites.get(x.id);
      if (!d) d = spriteNeu(x, i);
      d.className = klasse(x);
      setzen(x.id, i, 0);
    });
    for (const [id, d] of sprites) if (!da.has(id)) { d.remove(); sprites.delete(id); }
    anzeige();
  }

  function anzeige() {
    $('punkte').textContent = s.punkte.toLocaleString('de-DE');
    $('stufe').textContent = s.stufe;
    $('balken').style.width = Math.min(100, Math.round(s.stufePunkte / R.zielPunkte(s.stufe) * 100)) + '%';
    $('rekord').textContent = Math.max(s.rekord || 0, s.punkte).toLocaleString('de-DE');
  }

  function meldung(t, ms = 1600) {
    const m = $('meldung');
    m.textContent = t; m.classList.toggle('an', !!t);
    clearTimeout(m._t);
    if (t) m._t = setTimeout(() => m.classList.remove('an'), ms);
  }

  // ---------- Effekte ----------

  function effekt(html, kl, x, y, dauer) {
    if (ruhig()) return;
    const e = document.createElement('div');
    e.className = kl; e.innerHTML = html;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    effekte.appendChild(e);
    setTimeout(() => e.remove(), dauer);
  }
  const mitte = (i) => { const [x, y] = pos(i); return [x + p / 2, y + p / 2]; };

  function funken(i, art) {
    const [x, y] = mitte(i);
    effekt(Array.from({ length: 7 }, (_, k) => `<span style="--w:${k * 51 + (i * 13) % 50}deg"></span>`).join(''), 'rr-funken a' + art, x, y, 700);
  }

  // ---------- Ablauf der Schritte ----------

  const warten = (ms) => new Promise(r => { const t = setTimeout(r, ruhig() ? Math.min(ms, 60) : ms); laufende.push(t); });

  async function abspielen(erg) {
    for (const st of erg.schritte) {
      if (beendet || gestoppt) break;
      if (st.typ === 'tausch') {
        setzen(st.ids[0], st.b, ZEIT.tausch); setzen(st.ids[1], st.a, ZEIT.tausch);
        await warten(ZEIT.tausch);
      } else if (st.typ === 'weg') {
        for (const l of st.linien) linieZeigen(l);
        st.zellen.forEach((z, k) => {
          const d = sprites.get(st.ids[k]);
          if (d) { const art = d.className.match(/ a(\w)/)?.[1]; d.classList.add('weg'); if (k % 2 === 0 || st.zellen.length < 7) funken(z, art); }
        });
        for (const n of st.neuSpezial) {
          const d = sprites.get(n.id);
          if (d) { d.className = klasse(n) + ' entsteht'; }
        }
        const z0 = st.zellen.reduce((a, b) => a + b, 0) / st.zellen.length;
        const [mx, my] = mitte(Math.round(z0));
        const text = st.kette >= 2 ? `<b>Kette ×${st.kette}</b>` : st.neuSpezial.some(n => n.s === R.STERN) ? '<b>Sternrune!</b>' : st.neuSpezial.length ? '<b>Funkenrune!</b>' : '';
        effekt(`${text}<span>+${st.punkte}</span>`, 'rr-plus' + (st.kette >= 3 ? ' gross' : ''), Math.min(Math.max(mx, p * 2), p * (R.N - 2)), my, 1200);
        await warten(ZEIT.weg);
        st.ids.forEach(id => { const d = sprites.get(id); if (d) { d.remove(); sprites.delete(id); } });
      } else if (st.typ === 'fall') {
        let laengste = ZEIT.fallMin;
        for (const n of st.neu) spriteNeu(n, n.nach, n.von);
        void steineEbene.offsetWidth;
        const dauer = (zeilen) => Math.max(ZEIT.fallMin, Math.min(ZEIT.fallMax, ZEIT.fallProZeile * zeilen + 100));
        for (const b of st.bewegt) {
          const d = sprites.get(b.id);
          const alt = d ? Math.round(parseFloat(d.style.transform.split(',')[1]) / p) : 0;
          const ms = dauer(R.zeile(b.nach) - alt);
          laengste = Math.max(laengste, ms);
          setzen(b.id, b.nach, ms);
        }
        for (const n of st.neu) { const ms = dauer(R.zeile(n.nach) - n.von); laengste = Math.max(laengste, ms); setzen(n.id, n.nach, ms); }
        await warten(laengste + 20);
      } else if (st.typ === 'gemischt') {
        meldung('Kein Zug mehr möglich. Neu gemischt!', 2000);
        for (const o of st.orte) setzen(o.id, o.nach, 450);
        await warten(480);
      }
    }
    abgleichen();
  }

  function linieZeigen(l) {
    if (l.typ === 'zeile') effekt('', 'rr-strahl h', 0, l.n * p, 600);
    else if (l.typ === 'spalte') effekt('', 'rr-strahl v', l.n * p, 0, 600);
    else { const [x, y] = mitte(l.zelle); effekt('', 'rr-stern-blitz', x, y, 800); }
  }

  // ---------- Züge ----------

  async function versuch(a, b) {
    if (beschaeftigt || beendet || !darfLaufen() || $('tafel').innerHTML) return;
    gestoppt = false;
    waehlen(-1);
    tippWeg();
    const ida = s.feld[a].id, idb = s.feld[b].id;
    const erg = R.tauschen(s, a, b);
    if (!erg) { wackeln(ida, idb, a, b); return; }
    beschaeftigt = true;
    await abspielen(erg);
    beschaeftigt = false;
    if (beendet) return;
    sichern();
    for (const stufe of erg.stufen) {
      melden('rr_stufe', { stufe, punkte: s.punkte, zuege: s.zuege });
    }
    if (erg.stufen.length) stufeFeiern(erg.stufen[erg.stufen.length - 1]);
    tippPlanen();
  }

  async function wackeln(ida, idb, a, b) {
    beschaeftigt = true;
    const halb = (id, von, nach) => {
      const d = sprites.get(id); if (!d) return;
      const [x1, y1] = pos(von), [x2, y2] = pos(nach);
      d.style.transition = `transform ${ZEIT.wackeln / 2}ms ease-out`;
      d.style.transform = `translate(${x1 + (x2 - x1) * 0.35}px, ${y1 + (y2 - y1) * 0.35}px)`;
    };
    halb(ida, a, b); halb(idb, b, a);
    await warten(ZEIT.wackeln / 2);
    setzen(ida, a, ZEIT.wackeln / 2); setzen(idb, b, ZEIT.wackeln / 2);
    await warten(ZEIT.wackeln / 2);
    beschaeftigt = false;
    tippPlanen();
  }

  function waehlen(i) {
    if (gewaehlt >= 0) { const d = sprites.get(s.feld[gewaehlt]?.id); if (d) d.classList.remove('gewaehlt'); }
    gewaehlt = i;
    if (i >= 0) { const d = sprites.get(s.feld[i].id); if (d) d.classList.add('gewaehlt'); }
  }

  // ---------- Tipp ----------

  function tippWeg() {
    clearTimeout(tippTimer);
    for (const d of steineEbene.querySelectorAll('.tipp')) d.classList.remove('tipp');
  }
  function tippZeigen() {
    if (beschaeftigt || beendet || gestoppt || $('tafel').innerHTML) return;
    const z = R.zugFinden(s);
    if (!z) return;
    for (const i of z) { const d = sprites.get(s.feld[i].id); if (d) d.classList.add('tipp'); }
  }
  function tippPlanen() { tippWeg(); tippTimer = setTimeout(tippZeigen, TIPP_MS); }

  // ---------- Stufen und Tafeln ----------

  function stufeFeiern(stufe) {
    tippWeg();
    tafel(`<div class="tafel jade"><div class="rr-bild"><span class="rr-stein a0"><i></i></span><span class="rr-stein as stern"><i></i></span><span class="rr-stein a1"><i></i></span></div>
      <h2>Stufe ${stufe} geschafft!</h2><p>${s.punkte.toLocaleString('de-DE')} Punkte.</p>
      <p>Nächstes Ziel: ${R.zielPunkte(s.stufe).toLocaleString('de-DE')} Punkte in Stufe ${s.stufe}.</p>
      <button class="haupt" data-rrt="weiter">Weiter</button></div>`);
  }

  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

  function sichern() { sichernExt(JSON.parse(JSON.stringify(s))); }

  function neuesSpiel() {
    if (s.zuege > 0) melden('rr_neu', { punkte: s.punkte, stufe: s.stufe, zuege: s.zuege });
    s = R.neuStarten(s);
    sichern();
    aufbauen();
    tippPlanen();
  }

  // ---------- Eingaben ----------

  const zelleBei = (e) => {
    const b = brett.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / p), r = Math.floor((e.clientY - b.top) / p);
    return r >= 0 && c >= 0 && r < R.N && c < R.N ? r * R.N + c : -1;
  };
  let zug = null;
  an(rahmen, 'pointerdown', (e) => {
    const i = zelleBei(e);
    zug = i >= 0 ? { i, x: e.clientX, y: e.clientY, fertig: false } : null;
  });
  an(rahmen, 'pointermove', (e) => {
    if (!zug || zug.fertig) return;
    const dx = e.clientX - zug.x, dy = e.clientY - zug.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < p * 0.35) return;
    zug.fertig = true;
    const r = R.zeile(zug.i), c = R.spalte(zug.i);
    let ziel = -1;
    if (Math.abs(dx) > Math.abs(dy)) ziel = dx > 0 ? (c < R.N - 1 ? zug.i + 1 : -1) : (c > 0 ? zug.i - 1 : -1);
    else ziel = dy > 0 ? (r < R.N - 1 ? zug.i + R.N : -1) : (r > 0 ? zug.i - R.N : -1);
    if (ziel >= 0) versuch(zug.i, ziel);
  });
  an(rahmen, 'pointerup', () => {
    if (zug && !zug.fertig && !beschaeftigt && darfLaufen() && !$('tafel').innerHTML) {
      const i = zug.i;
      if (gewaehlt < 0) waehlen(i);
      else if (gewaehlt === i) waehlen(-1);
      else if (R.nachbarn(gewaehlt, i)) versuch(gewaehlt, i);
      else waehlen(i);
    }
    zug = null;
  });
  an(rahmen, 'pointercancel', () => { zug = null; });
  an(rahmen, 'touchmove', (e) => e.preventDefault(), { passive: false });

  an($('tipp'), 'click', () => { tippWeg(); tippZeigen(); });
  an($('neu'), 'click', () => {
    if (beschaeftigt) return;
    tafel(`<div class="tafel"><h2>Neues Spiel?</h2><p>Das jetzige Spiel ist dann weg. Dein Rekord bleibt.</p>
      <button class="haupt" data-rrt="neu">Neues Spiel</button><button class="neben" data-rrt="zu">Weiterspielen</button></div>`);
  });
  an(wurzel, 'click', (e) => {
    const el = e.target.closest('[data-rrt]');
    if (!el) return;
    const a = el.dataset.rrt;
    if (a === 'los' || a === 'weiter' || a === 'zu') { tafel(''); tippPlanen(); }
    if (a === 'neu') { tafel(''); neuesSpiel(); }
  });
  // Größe folgt dem Rahmen (auch wenn das Layout erst nach dem Start fertig ist)
  let rt = null, altB = 0, altH = 0;
  const neuMessen = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (beendet || (rahmen.clientWidth === altB && rahmen.clientHeight === altH)) return;
      if (beschaeftigt) { neuMessen(); return; }
      altB = rahmen.clientWidth; altH = rahmen.clientHeight;
      aufbauen();
    }, 120);
  };
  if (window.ResizeObserver) { const ro = new ResizeObserver(neuMessen); ro.observe(rahmen); aus.signal.addEventListener('abort', () => ro.disconnect()); }
  an(window, 'resize', neuMessen);

  // ---------- Start ----------
  aufbauen();
  altB = rahmen.clientWidth; altH = rahmen.clientHeight;
  if (s.zuege > 0) {
    tafel(`<div class="tafel jade"><h2>Runenreihen</h2><p>Dein Spiel ist gespeichert: Stufe ${s.stufe}, ${s.punkte.toLocaleString('de-DE')} Punkte.</p>
      <button class="haupt" data-rrt="weiter">Weiter</button><button class="neben" data-rrt="neu">Neues Spiel</button></div>`);
  } else {
    tafel(`<div class="tafel jade"><div class="rr-bild"><span class="rr-stein a0"><i></i></span><span class="rr-stein a0"><i></i></span><span class="rr-stein a0"><i></i></span></div>
      <h2>Runenreihen</h2>
      <p>Tausche zwei Nachbarn. <b>Drei gleiche</b> in einer Reihe verschwinden.</p>
      <p>Vier gleiche geben eine <b>Funkenrune</b>, fünf eine <b>Sternrune</b>. Es gibt keine Zeit und keine Zuggrenze.</p>
      <button class="haupt" data-rrt="los">Los!</button></div>`);
  }

  return {
    beenden() { if (beendet) return; beendet = true; tippWeg(); laufende.forEach(clearTimeout); sichern(); aus.abort(); },
    anhalten() { gestoppt = true; tippWeg(); laufende.forEach(clearTimeout); laufende = []; beschaeftigt = false; abgleichen(); sichern(); },
    stand: () => JSON.parse(JSON.stringify(s)),
    ruht: () => !!$('tafel').innerHTML
  };
}
