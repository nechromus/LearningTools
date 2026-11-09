// Bildschirmzeit in Stufen (Auftrag 49): Anzeige, Erklärung und Effekte zum Feiern.
// Reine HTML-Bausteine ohne Zustand. Effekte nur nach einer Aufgabe, Antippen überspringt,
// bei „Bewegung reduzieren“ nur Farbe (CSS in styles.css, Abschnitt „Bildschirmzeit in Stufen“).

import { stufenVon } from './bildschirm.js';

const HEX = '12,2 21,7 21,17 12,22 3,17 3,7';
const minText = (sek) => `${Math.floor(Math.max(0, sek) / 60)}`;
const komma = (x) => String(x).replace('.', ',');

// Ein Sechseck. art: 'leer' | 'voll' | 'jetzt' | 'schnell' | 'schnell-leer'
function hex(art, nr, opt = {}) {
  const gross = art === 'jetzt' || art === 'schnell';
  const g = gross ? 38 : 28;
  const schnell = art === 'schnell' || art === 'schnell-leer';
  const inhalt = art === 'schnell'
    ? '<path d="M8.6 9.3l2.6 2.7-2.6 2.7M12.6 9.3l2.6 2.7-2.6 2.7" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    : art === 'jetzt' ? `<text x="12" y="15.6" text-anchor="middle" font-size="9" font-weight="700" fill="#FFFFFF">${nr}</text>`
      : art === 'leer' || art === 'schnell-leer' ? `<text x="12" y="15.4" text-anchor="middle" font-size="8" font-weight="700" fill="${schnell ? '#9A5B06' : '#8A9696'}">${schnell ? '»' : nr}</text>` : '';
  return `<span class="bz-hex bz-hex-${art}${opt.neu ? ' bz-neu' : ''}${opt.leeren ? ' bz-leeren' : ''}" style="--i:${nr}"${opt.neu ? ` data-neu="${nr}"` : ''}>
    <svg width="${g}" height="${g}" viewBox="0 0 24 24" aria-hidden="true"><polygon class="bz-hex-rand" points="${HEX}"/><polygon class="bz-hex-f" points="${HEX}"/>${inhalt}</svg></span>`;
}

// Sechsecke der Stufen. st = Stand (stufe, anzahl), neu = Stufe, die gerade erreicht wurde, leeren = Stufen leeren sich (Extra-Runde)
export function hexReihe(st, { neu = 0, leeren = 0 } = {}) {
  const n = st.anzahl || 4;
  let h = '';
  for (let i = 1; i <= n; i++) {
    const letzte = i === n && n > 1;
    let art = i < st.stufe ? 'voll' : i === st.stufe ? (letzte ? 'schnell' : 'jetzt') : (letzte ? 'schnell-leer' : 'leer');
    h += hex(art, i, { neu: i === neu, leeren: leeren && i <= leeren && i > 1 });
  }
  return `<span class="bz-hexe" role="img" aria-label="Stufe ${st.stufe} von ${n}${st.schnell ? ', schneller Bereich' : ''}">${h}</span>`;
}

// Stand der Minuten: normal „62 / 90 Min.“, in der Extra-Runde „12 / 30 Min. Extra-Zeit“
export function minutenStand(konto, regeln, st) {
  const max = regeln.max * 60;
  if (st.extraRunde && regeln.extra) {
    const ex = regeln.extra.min * 60;
    return { text: `${minText(konto.heute - max)} / ${regeln.extra.min} Min.`, anteil: Math.min(1, (konto.heute - max) / ex), extra: true };
  }
  return { text: `${minText(Math.min(konto.heute, max))} / ${regeln.max} Min.`, anteil: Math.min(1, konto.heute / max), extra: false };
}

// Leiste über der Aufgabe (Variante B): Sechsecke, Minuten, Satz zur nächsten Stufe, schmaler Balken, „i“
export function leisteHtml(st, konto, regeln) {
  const m = minutenStand(konto, regeln, st);
  const satz = st.schnell ? 'Schneller Bereich'
    : st.bisNaechste != null ? `Noch ${st.bisNaechste} Min. bis Stufe ${st.stufe + 1}` : '';
  return `<div class="bz-leiste${st.schnell ? ' schnell' : ''}${m.extra ? ' extra' : ''}">
    <div class="bz-leiste-oben">${hexReihe(st)}
      <div class="bz-leiste-zahl"><b>${m.text}</b><span>${m.extra ? `Extra-Runde${satz ? ' · ' + satz : ''}` : satz}</span></div>
      <button class="bz-info" data-act="bzInfo" aria-label="So wächst deine Bildschirmzeit">i</button></div>
    <div class="bz-balken" role="img" aria-label="${m.text} Bildschirmzeit"><div style="width:${Math.round(m.anteil * 100)}%"></div></div>
  </div>`;
}

// Funken für den Effekt: mehr Funken bei höheren Stufen
function funken(n, warm) {
  let h = '';
  for (let i = 0; i < n; i++) {
    const dx = Math.round((i / Math.max(1, n - 1) - 0.5) * 120 + ((i * 37) % 13) - 6);
    const hoch = 46 + ((i * 29) % 34);
    h += `<i class="bz-funke${warm ? ' warm' : ''}" style="--dx:${dx}px;--hoch:${hoch}px;--d:${(i * 0.07).toFixed(2)}s"></i>`;
  }
  return `<span class="bz-funken" aria-hidden="true">${h}</span>`;
}

// Feier nach der Aufgabe. art: 'auf' (Aufstieg), 'schnell' (Eintritt schneller Bereich), 'voll' (Grenze voll),
// 'extra' (90 voll, Extra-Zeit beginnt: Stufen leeren sich und starten neu)
export function feierHtml(art, { st, vorher, regeln }) {
  const n = st.anzahl || 4;
  if (art === 'auf') {
    return `<div class="bz-feier bz-feier-auf stufe-${st.stufe}" data-act="bzFeierFertig" role="status">
      <div class="bz-feier-buehne">${funken(2 + st.stufe * 2, false)}${hexReihe(st, { neu: st.stufe })}</div>
      <div class="bz-feier-text"><b>Stufe ${st.stufe}!</b><span>Jetzt gibt jede Aufgabe mehr.</span></div></div>`;
  }
  if (art === 'schnell') {
    return `<div class="bz-feier bz-feier-schnell" data-act="bzFeierFertig" role="status">
      <div class="bz-feier-buehne"><span class="bz-strahlen" aria-hidden="true"></span>${funken(14, true)}${hexReihe(st, { neu: st.stufe })}</div>
      <div class="bz-feier-text"><b>Schneller Bereich!</b><span>Ab jetzt gibt jede Aufgabe am meisten.</span></div></div>`;
  }
  if (art === 'voll') {
    return `<div class="bz-feier bz-feier-voll" data-act="bzFeierFertig" role="status">
      <div class="bz-feier-buehne"><span class="bz-ring" aria-hidden="true"></span>${funken(10, true)}
        <span class="bz-voll-hex"><svg width="54" height="54" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${HEX}" fill="#9A5B06"/><path d="M7.5 12.5l3 3L16.5 9" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
      <div class="bz-feier-text"><b>${regeln.max} Minuten voll!</b><span>Deine Bildschirmzeit für heute ist geschafft.</span></div></div>`;
  }
  // Extra-Runde beginnt: alte Stufen leeren sich von rechts nach links, das Licht wandert zu Stufe 1
  const alt = { ...(vorher || st), anzahl: n, stufe: (vorher && vorher.stufe) || n, schnell: !!(vorher && vorher.schnell) };
  return `<div class="bz-feier bz-feier-extra" data-act="bzFeierFertig" role="status">
    <div class="bz-feier-text"><b>${regeln.max} Minuten voll!</b><span>Deine Bildschirmzeit für heute ist geschafft.</span></div>
    <div class="bz-extra-box"><b>Heute gibt es ${regeln.extra ? regeln.extra.min : ''} Min. Extra-Zeit.</b><span>Die Stufen fangen dafür wieder bei 1 an.</span></div>
    <div class="bz-feier-buehne bz-wechsel"><span class="bz-alt">${hexReihe(alt, { leeren: n })}</span><span class="bz-neu-reihe">${hexReihe({ ...st, stufe: 1, schnell: false }, { neu: 1 })}</span></div>
    <div class="bz-feier-unter">Extra-Runde · Stufe 1 von ${n}</div></div>`;
}

// Erklärung (einmalig, danach über „i“). schnitt = Lohn je Übungsminute in s (vor Faktor), wenn bekannt.
export function erklaerungHtml(regeln, ziel) {
  const st = stufenVon(regeln.stufen), n = st.length;
  const maxF = Math.max(...st.map(x => x.faktor));
  const viertel = (x) => { const q = Math.max(0.5, Math.round(x * 2) / 2), g = Math.floor(q), r = q - g; return `${g || ''}${r ? '½' : ''}`; };   // auf halbe Minuten
  const verh = (f) => regeln.schnitt ? `1 : ${viertel(regeln.schnitt * regeln.faktor * f / 60)}` : `×${komma(f)}`;
  const saeulen = st.map((x, i) => {
    const letzte = i === n - 1 && n > 1;
    return `<div class="bz-saeule${letzte ? ' schnell' : ''}" style="--h:${Math.round(30 + 70 * x.faktor / maxF)}%"><b>Stufe ${i + 1}</b><span>${verh(x.faktor)}</span>${letzte ? '<small>SCHNELL</small>' : ''}</div>`;
  }).join('');
  const ab = st.slice(1).map(x => x.ab);
  const abText = ab.length > 1 ? `${ab.slice(0, -1).join(', ')} und ${ab[ab.length - 1]}` : `${ab[0]}`;
  return `<div class="bz-erkl"><div class="bz-erkl-kopf"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${HEX}" fill="#DCEDED" stroke="#1F6F75" stroke-width="1.6"/><path d="M8 15h3v-3h3v-3h3" fill="none" stroke="#1F6F75" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Neu im Schrein</span></div>
    <h2 class="modal-titel">Deine Bildschirmzeit wächst mit.</h2>
    <div class="bz-saeulen-box"><div class="bz-saeulen">${saeulen}</div>
      <div class="bz-saeulen-ab">${st.map(x => `<span>ab ${x.ab} Min.</span>`).join('')}</div>
      ${regeln.schnitt ? '<small>1 Minute Üben → so viele Minuten Bildschirmzeit (etwa)</small>' : ''}</div>
    <p>Am Anfang bekommst du für jede Minute Üben etwa ${regeln.schnitt ? (viertel(regeln.schnitt * regeln.faktor * st[0].faktor / 60) === '1' ? 'eine Minute' : viertel(regeln.schnitt * regeln.faktor * st[0].faktor / 60) + ' Minuten') : 'eine Minute'} Bildschirmzeit.</p>
    <p>Je länger du an einem Tag übst, desto mehr gibt es pro Minute.</p>
    ${ab.length ? `<p>Nach ${abText} Minuten steigst du eine Stufe auf.</p>` : ''}
    ${ziel ? `<p><b>Mit etwa ${ziel} Minuten Üben hast du deine ${regeln.max} Minuten voll.</b></p>` : ''}
    <p class="gedaempft">Gibt es heute Extra-Zeit, fängt es dafür wieder bei Stufe 1 an.</p>
    <button class="btn btn-haupt" data-act="bzVerstanden">Verstanden</button></div>`;
}

// Kurzer, leiser Ton bei „voll“ (nur wenn das Handy nicht stumm ist: Audio-Sitzung „ambient“)
export function tonVoll() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const c = new Ctx(), t = c.currentTime;
    [[659.3, 0], [987.8, 0.12], [1318.5, 0.24]].forEach(([f, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.06, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
      o.connect(g); g.connect(c.destination); o.start(t + d); o.stop(t + d + 0.55);
    });
    setTimeout(() => c.close && c.close(), 1200);
  } catch (e) { /* ohne Ton */ }
}
