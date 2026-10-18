// Steinschieber: Anzeige und Steuerung als Baustein (wie kristallmine-ui.js).
// Regeln in ./steinschieber.js, Aussehen in ../steinschieber/ss.css (unter .ss, nutzt Grundstile aus km.css).
//
// steinschieberStarten(wurzel, {
//   stand,              // Fortschritt: { level, geschafft: [], best: {}, aktuell: { zuege, rueck, tipps } }
//   sichern(stand),     // Fortschritt speichern
//   melden(typ, daten), // Ereignisse fürs Protokoll ('ss_level')
//   darfLaufen(),       // false, wenn gerade nicht gespielt werden darf
//   hinweisZusatz,
// }) → { beenden(), stand(), ruht() }
import * as S from './steinschieber.js';

export function neuerFortschritt() {
  return { level: 0, geschafft: [], best: {}, aktuell: null };
}

const ruhig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const variante = (i) => ' v' + ((i * 7 + (i >> 2)) % 3);
const SCHRITT_MS = 120;

// Bis zu welchem Level darf gewählt werden: alle geschafften und die nächsten zwei (eins darf man überspringen)
export function offeneLevel(f) {
  let offen = 0, frei = 0;
  for (let i = 0; i < S.LEVEL.length && frei < 2; i++) { offen = i; if (!f.geschafft.includes(i)) frei++; }
  return offen;
}

export function steinschieberStarten(wurzel, opt = {}) {
  const sichernExt = opt.sichern || (() => {});
  const melden = opt.melden || (() => {});
  const darfLaufen = opt.darfLaufen || (() => true);
  const aus = new AbortController();
  const an = (ziel, typ, fn, o = {}) => ziel.addEventListener(typ, fn, { ...o, signal: aus.signal });

  let f = { ...neuerFortschritt(), ...(opt.stand || {}) };
  f.geschafft = Array.isArray(f.geschafft) ? f.geschafft : [];
  f.best = f.best && typeof f.best === 'object' ? f.best : {};
  if (!(f.level >= 0 && f.level < S.LEVEL.length)) f.level = 0;
  let s = null, g = 40, figur = null, steine = [], schlange = [], schrittTimer = null, tippMarke = null, tippStand = null, arbeiter = null, beendet = false;

  wurzel.classList.add('km', 'ss');
  wurzel.innerHTML = `
    <div class="kopf"><span class="titel" id="ss-titel">Steinschieber</span><button class="knopf klein leise" id="ss-wahl">Level wählen</button></div>
    <div class="chips">
      <span class="chip k" id="ss-chip-ziel"><span class="raute"></span><span id="ss-ziele">0 / 0</span></span>
      <span class="chip" id="ss-chip-schuebe">Schübe <b id="ss-schuebe">0</b></span>
      <span class="chip p" id="ss-nr">1 / ${S.LEVEL.length}</span>
    </div>
    <div class="feld-rahmen" id="ss-rahmen">
      <span class="ecke" style="left:-7px;top:-7px"></span><span class="ecke" style="right:-7px;top:-7px"></span>
      <span class="ecke" style="left:-7px;bottom:-7px"></span><span class="ecke" style="right:-7px;bottom:-7px"></span>
      <div class="welt" id="ss-welt"></div>
      <div class="ss-meldung" id="ss-meldung" aria-live="polite"></div>
    </div>
    <div class="leiste">
      <button class="knopf" id="ss-zurueck" aria-label="Schritt zurück">↶ Zurück</button>
      <button class="knopf" id="ss-tipp">Tipp</button>
      <button class="knopf klein leise" id="ss-neu">Neu starten</button>
    </div>
    <p class="hinweis" id="ss-hinweis">Wische oder tippe ein Feld an. Schiebe alle Steine auf die Runen.${opt.hinweisZusatz ? ' · ' + opt.hinweisZusatz : ''}</p>
    <div id="ss-tafel"></div>`;
  const $ = (id) => wurzel.querySelector('#ss-' + id);
  const welt = $('welt'), rahmen = $('rahmen');

  function sichern() {
    f.aktuell = s && !s.fertig ? { zuege: s.zuege, rueck: s.rueck, tipps: s.tipps } : null;
    sichernExt(JSON.parse(JSON.stringify(f)));
  }

  // ---------- Level aufbauen ----------

  function levelStarten(n, gespeichert = null) {
    schrittStopp();
    tippWeg();
    f.level = n;
    s = gespeichert ? S.wiederherstellen(n, gespeichert) : S.levelLaden(n);
    groesse();
    welt.innerHTML = '';
    welt.style.setProperty('--g', g + 'px');
    welt.style.gridTemplateColumns = `repeat(${s.w}, ${g}px)`;
    welt.style.gridAutoRows = `${g}px`;
    const frag = document.createDocumentFragment();
    const boden = (i) => i >= 0 && i < s.w * s.h && !s.wand[i] && !s.aussen[i];
    for (let i = 0; i < s.w * s.h; i++) {
      const d = document.createElement('div');
      const r = Math.floor(i / s.w), c = i % s.w;
      let k = 'z';
      if (s.wand[i]) {
        // Nur Wände am Raum zeigen, der Rest bleibt dunkel
        let nah = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < s.h && cc < s.w && boden(rr * s.w + cc)) nah = true;
        }
        k += nah ? ' wand mauer' + variante(i) : ' nichts';
      } else if (s.aussen[i]) k += ' nichts';
      else k += ' leer boden' + (s.ziel[i] ? ' ziel' : '');
      d.className = k;
      d.dataset.i = i;
      d.innerHTML = '<div class="in"></div>';
      frag.appendChild(d);
    }
    steine = s.kisten.map(() => {
      const d = document.createElement('div');
      d.className = 'sprite runenstein';
      d.innerHTML = '<div class="in"><i></i></div>';
      frag.appendChild(d);
      return d;
    });
    figur = document.createElement('div');
    figur.className = 'sprite figur erscheint';
    figur.innerHTML = '<div class="koerper"><div class="in"></div></div>';
    frag.appendChild(figur);
    tippStand = document.createElement('div');
    tippStand.className = 'ss-tipp-stand';
    tippMarke = document.createElement('div');
    tippMarke.className = 'ss-tipp-marke';
    frag.appendChild(tippStand);
    frag.appendChild(tippMarke);
    welt.appendChild(frag);
    for (const el of [figur, ...steine]) el.style.transition = 'none';
    zeichnen();
    requestAnimationFrame(() => requestAnimationFrame(() => { for (const el of [figur, ...steine]) el.style.transition = ''; }));
    $('titel').textContent = `${n + 1} · ${S.levelName(n)}`;
    $('nr').textContent = `${n + 1} / ${S.LEVEL.length}`;
    meldung('');
    sichern();
    if (!gespeichert && n < 2 && !f.geschafft.includes(n)) {
      tafel(`<div class="tafel jade"><div class="bild-block"></div><h2>${n + 1} · ${S.levelName(n)}</h2>
        <p>Schiebe jeden <b>Runenstein</b> auf ein <b>leuchtendes Feld</b>.</p><p>Steine kann man nur schieben, nicht ziehen. Mit „Zurück“ nimmst du Schritte zurück.</p>
        <button class="haupt" data-ss="los">Los!</button></div>`);
    }
  }

  function groesse() {
    const breite = (rahmen.clientWidth || 360) - 16, hoehe = (rahmen.clientHeight || 420) - 16;
    g = Math.max(24, Math.min(58, Math.floor(Math.min((breite - s.w) / s.w, (hoehe - s.h) / s.h))));
  }

  const pos = (i) => [(i % s.w) * (g + 1), Math.floor(i / s.w) * (g + 1)];
  function weltMitte() {
    const bw = s.w * (g + 1), bh = s.h * (g + 1);
    welt.style.transform = `translate(${Math.round((rahmen.clientWidth - bw) / 2)}px, ${Math.round((rahmen.clientHeight - bh) / 2)}px)`;
  }

  function zeichnen() {
    weltMitte();
    const [fx, fy] = pos(s.figur);
    figur.style.transform = `translate(${fx}px, ${fy}px)`;
    const fest = new Set(S.festeSteine(s));
    s.kisten.forEach((k, i) => {
      const [x, y] = pos(k);
      steine[i].style.transform = `translate(${x}px, ${y}px)`;
      steine[i].classList.toggle('auf-ziel', s.ziel[k]);
      steine[i].classList.toggle('fest', fest.has(i));
    });
    const auf = s.kisten.filter(k => s.ziel[k]).length;
    $('ziele').textContent = `${auf} / ${s.kisten.length}`;
    $('schuebe').textContent = s.schuebe;
    $('zurueck').disabled = !s.zuege.length;
    if (fest.size && !s.fertig) meldung('Ein Stein steckt fest. Nimm ein paar Schritte zurück.');
    else if (/fest\./.test($('meldung').textContent)) meldung('');
  }

  function meldung(t) { const m = $('meldung'); m.textContent = t; m.classList.toggle('an', !!t); }

  // ---------- Bewegen ----------

  function schritt(richtung) {
    if (!s || s.fertig || !darfLaufen() || $('tafel').innerHTML) return false;
    const vorherAuf = s.kisten.filter(k => s.ziel[k]).length;
    const r = S.zug(s, richtung);
    if (!r) { stoss(richtung); return false; }
    tippWeg();
    figur.classList.remove('lauf-hoch', 'lauf-runter', 'lauf-links', 'lauf-rechts', 'drueckt');
    figur.classList.add('lauf-' + richtung);
    if (r.geschoben >= 0) figur.classList.add('drueckt');
    clearTimeout(figur._t);
    figur._t = setTimeout(() => figur.classList.remove('lauf-' + richtung, 'drueckt'), 220);
    zeichnen();
    const nachherAuf = s.kisten.filter(k => s.ziel[k]).length;
    if (r.geschoben >= 0 && nachherAuf > vorherAuf) funke(s.kisten[r.geschoben]);
    if (s.zuege.length % 8 === 0) sichern();
    if (s.fertig) geschafft();
    return true;
  }

  function stoss(richtung) {
    if (ruhig()) return;
    figur.classList.remove('stoss-hoch', 'stoss-runter', 'stoss-links', 'stoss-rechts');
    void figur.offsetWidth;
    figur.classList.add('stoss-' + richtung);
    setTimeout(() => figur.classList.remove('stoss-' + richtung), 200);
  }

  function funke(i) {
    if (ruhig()) return;
    const [x, y] = pos(i);
    const e = document.createElement('div');
    e.className = 'ss-funke';
    e.style.left = x + g / 2 + 'px'; e.style.top = y + g / 2 + 'px';
    e.innerHTML = Array.from({ length: 8 }, (_, k) => `<span style="--w:${k * 45}deg"></span>`).join('');
    welt.appendChild(e);
    setTimeout(() => e.remove(), 900);
  }

  function schrittStopp() { clearTimeout(schrittTimer); schrittTimer = null; schlange = []; }

  function laufen(liste) {
    schrittStopp();
    schlange = liste.slice();
    const weiter = () => {
      const r = schlange.shift();
      if (!r) { schrittTimer = null; sichern(); return; }
      if (!schritt(r)) { schrittStopp(); return; }
      schrittTimer = setTimeout(weiter, ruhig() ? 40 : SCHRITT_MS);
    };
    weiter();
  }

  function zurueck() {
    schrittStopp();
    if (!s || !s.zuege.length || $('tafel').innerHTML) return;
    tippWeg();
    S.zurueck(s);
    zeichnen();
    sichern();
  }

  // ---------- Tipp ----------

  function tippWeg() {
    if (tippMarke) tippMarke.className = 'ss-tipp-marke';
    if (tippStand) tippStand.className = 'ss-tipp-stand';
    steine.forEach(st => st.classList.remove('tipp'));
  }

  function tippZeigen(t) {
    if (!t || !t.erster) return;
    const { weg, richtung, kiste } = t.erster;
    // Standfeld: dort muss die Figur stehen
    let i = s.figur;
    for (const r of weg) { const [dr, dc] = S.RICHTUNGEN[r]; i += dr * s.w + dc; }
    const [x, y] = pos(i);
    tippStand.style.transform = `translate(${x}px, ${y}px)`;
    if (weg.length) tippStand.className = 'ss-tipp-stand an';
    // Pfeil zwischen Stein und Zielfeld des Schubs
    const [dr, dc] = S.RICHTUNGEN[richtung];
    const [kx, ky] = pos(s.kisten[kiste]);
    tippMarke.style.transform = `translate(${kx + dc * (g + 1) * 0.62}px, ${ky + dr * (g + 1) * 0.62}px) rotate(${{ rechts: 0, runter: 90, links: 180, hoch: 270 }[richtung]}deg)`;
    tippMarke.className = 'ss-tipp-marke an';
    steine[kiste].classList.add('tipp');
    meldung(weg.length ? 'Geh auf das Feld mit dem Pfeil und schiebe in Pfeilrichtung.' : 'Schiebe den leuchtenden Stein in Pfeilrichtung.');
  }

  function tipp() {
    if (!s || s.fertig || !darfLaufen()) return;
    schrittStopp();
    if (S.festeSteine(s).length) { meldung('Ein Stein steckt fest. Nimm ein paar Schritte zurück.'); return; }
    s.tipps++;
    meldung('Ich überlege …');
    const level = f.level, zuege = s.zuege;
    const fertig = (t) => {
      if (beendet || !s || f.level !== level || s.zuege !== zuege) return;
      if (t && t.erster) tippZeigen(t);
      else meldung(t && t.gross ? 'Das ist gerade zu knifflig für einen Tipp. Probier „Zurück“.' : 'So geht es nicht mehr. Nimm ein paar Schritte zurück oder starte neu.');
      sichern();
    };
    try {
      if (!arbeiter) arbeiter = new Worker(new URL('./steinschieber-tipp.js', import.meta.url), { type: 'module' });
      arbeiter.onmessage = (e) => fertig(e.data);
      arbeiter.onerror = () => { arbeiter = null; fertig(S.loesen(s, 60000)); };
      arbeiter.postMessage({ level, zuege });
    } catch (e) {
      setTimeout(() => fertig(S.loesen(s, 60000)), 30);
    }
  }

  // ---------- Geschafft ----------

  function geschafft() {
    const n = f.level, optimal = S.LEVEL[n].schuebe;
    const neu = !f.geschafft.includes(n);
    if (neu) f.geschafft = [...f.geschafft, n];
    const vorher = f.best[n];
    if (vorher == null || s.schuebe < vorher) f.best[n] = s.schuebe;
    melden('ss_level', { level: n + 1, name: S.levelName(n), schuebe: s.schuebe, zuege: s.zuege.length, zurueck: s.rueck, tipps: s.tipps, optimal, erstmals: neu });
    const naechstes = n + 1 < S.LEVEL.length ? n + 1 : null;
    f.level = naechstes ?? n;
    f.aktuell = null;
    sichernExt(JSON.parse(JSON.stringify(f)));
    const perfekt = s.schuebe <= optimal;
    setTimeout(() => {
      if (beendet) return;
      tafel(`<div class="tafel jade"><div class="bild-block an"></div><h2>Geschafft!</h2>
        <p>${n + 1} · ${S.levelName(n)} mit <b>${s.schuebe} Schüben</b>.</p>
        ${perfekt ? '<p class="gross">Meisterhaft!</p><p>So wenig Schübe wie möglich.</p>' : `<p>Es geht auch mit ${optimal} Schüben. Nur wenn du Lust hast.</p>`}
        ${naechstes != null ? '<button class="haupt" data-ss="weiter">Nächstes Level</button>' : '<p>Du hast alle Level geschafft!</p>'}
        <button class="neben" data-ss="nochmal">Nochmal spielen</button></div>`);
    }, ruhig() ? 50 : 650);
  }

  // ---------- Tafeln ----------

  function tafel(html) { $('tafel').innerHTML = html ? `<div class="tafel-grund">${html}</div>` : ''; }

  function wahlZeigen() {
    schrittStopp();
    const bis = offeneLevel(f);
    const knoepfe = S.LEVEL.map((l, i) => {
      const ok = f.geschafft.includes(i), offen = i <= bis;
      return `<button class="ss-level${ok ? ' ok' : ''}${i === f.level ? ' jetzt' : ''}" ${offen ? `data-ss="level" data-n="${i}"` : 'disabled'} aria-label="Level ${i + 1}${ok ? ', geschafft' : ''}">${i + 1}</button>`;
    }).join('');
    tafel(`<div class="tafel jade ss-wahl"><h2>Level wählen</h2><div class="ss-level-gitter">${knoepfe}</div>
      <p class="klein">${f.geschafft.length} von ${S.LEVEL.length} geschafft. Ein Level darfst du überspringen.</p>
      <button class="neben" data-ss="zu">Schließen</button></div>`);
  }

  // ---------- Eingaben ----------

  an(wurzel, 'click', (ev) => {
    const el = ev.target.closest('[data-ss]');
    if (!el) return;
    const act = el.dataset.ss;
    if (act === 'los' || act === 'zu') tafel('');
    if (act === 'weiter') { tafel(''); levelStarten(f.level); }
    if (act === 'nochmal') { tafel(''); levelStarten(s ? s.nr : f.level); }
    if (act === 'level') { tafel(''); levelStarten(Number(el.dataset.n)); }
    if (act === 'neuJa') { tafel(''); S.neustart(s); tippWeg(); zeichnen(); sichern(); }
  });
  an($('zurueck'), 'click', zurueck);
  an($('tipp'), 'click', tipp);
  an($('wahl'), 'click', wahlZeigen);
  an($('neu'), 'click', () => {
    if (!s || !s.zuege.length) return;
    schrittStopp();
    tafel(`<div class="tafel"><h2>Neu starten?</h2><p>Alle Steine gehen zurück an den Anfang.</p>
      <button class="haupt" data-ss="neuJa">Neu starten</button><button class="neben" data-ss="zu">Weiterspielen</button></div>`);
  });

  // Wischen: ein Schritt pro Wisch. Antippen: hinlaufen oder angrenzenden Stein schieben.
  let x0 = null, y0 = null;
  an(rahmen, 'pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  an(rahmen, 'pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24) {
      schrittStopp();
      schritt(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch'));
      return;
    }
    // Antippen
    const b = welt.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / (g + 1)), r = Math.floor((e.clientY - b.top) / (g + 1));
    if (!s || r < 0 || c < 0 || r >= s.h || c >= s.w) return;
    const i = r * s.w + c;
    const fr = Math.floor(s.figur / s.w), fc = s.figur % s.w;
    if (Math.abs(r - fr) + Math.abs(c - fc) === 1) { schrittStopp(); schritt(r < fr ? 'hoch' : r > fr ? 'runter' : c < fc ? 'links' : 'rechts'); return; }
    const w = S.weg(s, i);
    if (w && w.length) laufen(w);
  });
  an(rahmen, 'touchmove', (e) => e.preventDefault(), { passive: false });
  an(document, 'keydown', (e) => {
    if (!wurzel.isConnected) return;
    const m = { ArrowLeft: 'links', ArrowRight: 'rechts', ArrowUp: 'hoch', ArrowDown: 'runter' }[e.key];
    if (m) { e.preventDefault(); schrittStopp(); schritt(m); }
    else if (e.key === 'z' || e.key === 'Backspace') { e.preventDefault(); zurueck(); }
  });
  let rt = null;
  an(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!s) return; const alt = g; groesse(); if (alt !== g) levelStarten(f.level, { zuege: s.zuege, rueck: s.rueck, tipps: s.tipps }); else zeichnen(); }, 150); });

  // Start: angefangenes Level fortsetzen
  levelStarten(f.level, f.aktuell);

  return {
    beenden() { if (beendet) return; schrittStopp(); sichern(); beendet = true; aus.abort(); if (arbeiter) arbeiter.terminate(); },
    stand: () => JSON.parse(JSON.stringify(f)),
    ruht: () => !!$('tafel').innerHTML,
    level: () => s
  };
}
