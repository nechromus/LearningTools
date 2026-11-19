// Archiv der Welten: Lese-App (Auftrag 57–59). Schritt 2: Gerüst mit Einrichtung, Startbildschirm und Abschicken.
// Gleiches Gefühl wie der Schrein der Zahlen, aber nur Bildschirmzeit (keine Spiele, keine Spielzeit, keine Splitter).
// Eigener Speicher (auf dem iPhone hat jede Home-Bildschirm-App ihren eigenen), eigene Geräte-Id, eigenes Protokoll unter
// daten/<name>/lesen/<geraet>/<tag>.json. Bildschirmzeit über das gemeinsame Kassenbuch (js/kasse.js), Quelle lesen-<geraet>.
// Der Zugangsschlüssel bleibt auf dem Gerät und steht nie im Protokoll.
import * as U from '../js/sync.js';
import * as K from '../js/kasse.js';
import * as BS from '../js/bildschirm.js';
import { kasseAblauf } from '../js/kasse-ablauf.js';
import { bildschirmBild } from '../js/bildschirm-bild.js';
import { einrichtungLesen, kameraScan } from '../js/einrichtung.js';
import { esc, sechseck } from '../js/render.js';
import * as LL from './lesen-logik.js';

export const LESE_VERSION = '0.2.0';
const KEY = 'archiv-v1', LOG_KEY = 'archiv-v1-log';
const $app = document.getElementById('app');
const tagKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const neueId = () => Math.random().toString(36).slice(2, 10);
const ordnerVon = (name) => (name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------- Zustand ----------
function laden() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  let log = [];
  try { log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { log = []; }
  return {
    name: s.name || '', geraetId: s.geraetId || neueId(), upload: { tage: {}, ...(s.upload || {}) },
    einst: s.einst || null, kasse: s.kasse || null, tag: s.tag || null, pin: s.pin || null, log: Array.isArray(log) ? log : []
  };
}
const S = laden();
function sichern() {
  const { log, ...rest } = S;
  try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch (e) { /* voll: unten kürzen */ }
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) { logKuerzen(true); }
}
function protokoll(typ, daten = {}) {
  S.log.push({ ...daten, t: new Date().toISOString(), typ });
  sichern();
}
// Von Anfang an kürzen (Lehre aus der Mathe-App): übertragene Tage nur 7 Tage behalten, bei vollem Speicher die ältesten
function logKuerzen(voll = false) {
  const grenze = tagKey(new Date(Date.now() - 7 * 86400000));
  const heute = tagKey();
  S.log = S.log.filter(e => { const k = tagKey(new Date(e.t)); return k >= grenze || !(S.upload.tage[k] >= 0); });
  if (voll) { const tage = [...new Set(S.log.map(e => tagKey(new Date(e.t))))].sort(); while (tage.length > 2 && JSON.stringify(S.log).length > 1500000) { const alt = tage.shift(); if (alt === heute) break; S.log = S.log.filter(e => tagKey(new Date(e.t)) !== alt); } }
  try { localStorage.setItem(LOG_KEY, JSON.stringify(S.log)); } catch (e) { /* nichts zu machen */ }
}

// Testgerät (wie in der Mathe-App): es wird nichts geschrieben, nur Einstellungen gelesen. „Testen als“ wählt ein Kind
// aus dem Daten-Repo. Lesen gilt auf dem Testgerät immer als freigeschaltet; Bildschirmzeit bleibt nur auf dem Gerät.
const test = () => !!S.upload.testgeraet;
const testAls = () => (test() && S.upload.testAls) || null;
const gross = (o) => o ? o.charAt(0).toUpperCase() + o.slice(1) : '';
const ordner = () => testAls() || ordnerVon(S.name);
const W = () => (S.einst && S.einst.werte) || {};
const R = () => { const r = LL.leseRegeln(W().lesen); return test() ? { ...r, an: true } : r; };
const bereit = () => !!(S.upload.repo && S.upload.token && (S.name || testAls()));
const offen = () => bereit() && R().an && (W().kasse === true || test());
function heute() { S.tag = LL.tagVon(S.tag, tagKey()); return S.tag; }
function kasse() {
  if (!offen()) return null;
  const quelle = test() ? `test-${S.geraetId}` : K.quelleId('lesen', S.geraetId);
  if (!S.kasse || S.kasse.quelle !== quelle) {
    S.kasse = K.kasseNeu('lesen', S.geraetId, null);
    S.kasse.quelle = quelle;
    if (!test()) protokoll('kasse_start', { quelle, uebertrag: 0 });
  }
  return S.kasse;
}
const ablauf = kasseAblauf({
  app: 'lesen', kasse, cfg: () => S.upload, ordner, geraet: () => S.geraetId,
  heute: () => { const t = heute(); return { tag: t.tag, sek: t.sek }; }, protokoll, sichern
});

// ---------- Übertragung ----------
let syncLaeuft = false;
async function einstellungenHolen() {
  if (!bereit()) return false;
  const e = await U.dateiLesen(S.upload, `daten/${ordner()}/einstellungen.json`);
  const neu = !!e && (!S.einst || e.version !== S.einst.version);
  if (e) S.einst = { version: e.version, werte: { lesen: e.werte.lesen || null, kasse: e.werte.kasse === true, bildschirm: e.werte.bildschirm || null, feedback: e.werte.feedback === true } };
  if (neu) protokoll('einstellungen', { version: e.version });
  sichern();
  return neu;
}
async function syncen(erzwingen = false) {
  if (!bereit() || syncLaeuft) return;
  syncLaeuft = true;
  try {
    const neu = await einstellungenHolen();
    if (test()) return; // Testgerät: nur die Einstellungen lesen (das Test-Konto bleibt getrennt vom echten)
    if (kasse()) await ablauf.sync(erzwingen || neu);
    // Protokoll je Tag, beim Hochladen mit dem Server zusammenführen (nie mit weniger überschreiben). Einträge aus Testphasen nie.
    const tage = U.nachTagen(U.ohneTestphasen(S.log), d => tagKey(d));
    for (const tag of Object.keys(tage).sort().filter(k => tage[k].length > (S.upload.tage[k] || 0)).slice(-14)) {
      const pfad = `daten/${ordner()}/lesen/${S.geraetId}/${tag}.json`;
      const server = await U.dateiLesen(S.upload, pfad);
      const eintraege = U.eintraegeZusammen(server && server.eintraege, tage[tag]);
      await U.dateiSchreiben(S.upload, pfad, JSON.stringify({ app: 'archiv', fach: 'lesen', version: LESE_VERSION, nutzer: S.name, geraetId: S.geraetId, tag, hochgeladen: new Date().toISOString(), eintraege }), `Lese-Daten ${tag}`);
      S.upload.tage[tag] = tage[tag].length;
    }
    S.upload.fehler = null;
    logKuerzen();
  } catch (e) {
    S.upload.fehler = e.message || 'Fehler';
  } finally {
    syncLaeuft = false;
    sichern();
    if (ansicht === 'start') zeigeStart(false);
  }
}

// ---------- Bildschirme ----------
let ansicht = 'start';
const VIDEO = (h) => `<svg width="${h}" height="${h}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#2F4F8F" stroke-width="2.5"/><path d="M16 12l12 8-12 8z" fill="#2F4F8F"/></svg>`;
const BUCH = `<path d="M7.2 9.2c1.6-.6 3-.4 4.8.7 1.8-1.1 3.2-1.3 4.8-.7v6.6c-1.6-.6-3-.4-4.8.7-1.8-1.1-3.2-1.3-4.8-.7z" fill="#fff" stroke="#262F70" stroke-width=".8" stroke-linejoin="round"/><path d="M12 9.9v6.6" stroke="#262F70" stroke-width=".7"/>`;
const minTxt = (sek) => BS.minText(sek);

function zeigeStart(syncJetzt = true) {
  if (!bereit()) return zeigeEinrichtung();
  ansicht = 'start';
  if (syncJetzt) syncen();
  const r = R(), t = heute(), k = kasse();
  const anz = k ? K.anzeige(k) : { sek: 0 };
  const grenze = LL.grenzeSek(r, t.tag), voll = t.sek >= grenze;
  const m = k ? LL.matheHeute(k.fremd, W().bildschirm, t.tag) : { sek: 0, frei: 0 };
  const ab = BS.abSek(W().bildschirm);
  const kopf = `<header class="start-kopf marke">${sechseck(56, '#E3E6F5', '#33408F', BUCH)}<div><h1>Archiv der Welten</h1><p class="gedaempft">Hallo${S.name ? ', ' + esc(S.name) : ''}!</p></div></header>`;
  const testLeiste = test() ? `<button class="test-leiste" data-act="persona"><span class="test-leiste-marke">Testgerät</span>
    <span class="test-leiste-text">Testen als <b>${testAls() ? esc(gross(testAls())) : '…'}</b><span class="klein block">Es wird nichts gesendet. Bildschirmzeit bleibt auf diesem Handy.</span></span><span class="test-leiste-pfeil">Ändern ›</span></button>` : '';
  if (!offen()) {
    $app.innerHTML = `<div class="screen start">${kopf}${testLeiste}<section class="info-karte bald"><b>Das Archiv öffnet bald.</b><div class="gedaempft">Deine Eltern schalten es frei.</div></section><p class="gedaempft bz-mitte klein">Version ${LESE_VERSION}</p></div>`;
    return;
  }
  $app.innerHTML = `
  <div class="screen start">
    ${kopf}${testLeiste}
    ${anz.sek > 0 ? `<section class="bz-karte">
      <span class="bz-icons">${VIDEO(40)}</span>
      <div class="bz-text"><div class="bz-zahl">${minTxt(anz.sek)}</div><div class="gedaempft">Bildschirmzeit gesammelt</div></div>
      ${anz.sek >= ab ? '<button class="btn btn-bz" data-act="bz">Abschicken</button>' : `<div class="bz-ab gedaempft">Ab ${minTxt(ab)} kannst du abschicken. Noch ${minTxt(ab - anz.sek)}</div>`}
    </section>` : ''}
    <button class="btn btn-haupt btn-gross lese-knopf" data-act="lesen" disabled>Weiterlesen<span class="unter">Die ersten Geschichten kommen bald.</span></button>
    <button class="btn btn-gross" data-act="anderes" disabled>Etwas anderes lesen</button>
    ${test() ? '<button class="btn btn-bz-rand" data-act="testKarte">Test: eine Lesekarte mit 2 Min. buchen</button>' : ''}
    <section class="info-karte">
      <div class="info-zeile"><span>Heute gelesen</span><b>${t.karten} ${t.karten === 1 ? 'Karte' : 'Karten'}</b></div>
      <div class="info-zeile"><span>Lese-Zeit</span><b>${minTxt(t.sek)} von ${minTxt(grenze)}</b></div>
      <div class="balken"><i style="width:${Math.min(100, Math.round(100 * t.sek / Math.max(1, grenze)))}%"></i></div>
      ${voll ? '<div class="voll-zeile">Für heute ist deine Lese-Zeit voll. Weiterlesen geht, aber ohne Zeit.</div>' : ''}
      ${W().bildschirm && !test() ? `<div class="info-zeile info-trenner"><span>Aus Mathe heute</span><b>${minTxt(m.sek)}</b></div>
      ${voll && m.frei > 0 ? `<div class="gedaempft klein">In Mathe ist heute noch Zeit frei.</div>` : ''}` : ''}
    </section>
    <p class="gedaempft bz-mitte klein">Version ${LESE_VERSION}${S.upload.fehler ? ' · Übertragung klappt gerade nicht' : ''}</p>
  </div>`;
}

// Abschicken: wie in der Mathe-App. Beim Öffnen reservieren, dann teilen.
let bzBild = null, bzGeschickt = null, bzGeoeffnet = 0;
function resDaten() {
  const r = S.kasse && S.kasse.res;
  return r ? { stand: r.sek, aufgaben: r.aufgaben || 0, ms: r.uebung_ms || 0, msVoll: true, code: r.code, teile: { mathe: r.mathe || 0, lesen: r.lesen || 0, karten: r.lesekarten || 0 } } : null;
}
function zeigeAbschicken() {
  ansicht = 'bz';
  if (bzGeschickt) {
    $app.innerHTML = `<div class="screen bz-screen"><header class="topbar"><button class="btn-text" data-act="start">‹ Zum Start</button></header>
      <div class="bz-gross-icon">${VIDEO(64)}</div><div class="erfolg-titel bz-titel">Abgeschickt!</div>
      <p class="bz-mitte">${minTxt(bzGeschickt.sek)} Bildschirmzeit sind unterwegs zu deinen Eltern.</p>
      <button class="btn btn-haupt btn-gross" data-act="start">Zum Start</button></div>`;
    return;
  }
  const k = kasse();
  if (!k) return zeigeStart();
  const anz = K.anzeige(k), ab = BS.abSek(W().bildschirm);
  if (test() && anz.sek >= ab && !k.res) {
    const r = K.reservieren(null, K.quellenStand(k, {}), { res: null, code: BS.neuerCode(), app: 'lesen', geraet: S.geraetId });
    if (r.eintrag) { k.res = r.eintrag; k.bez = r.datei.bezahlt; sichern(); }
  } else if (!test() && anz.sek >= ab && !ablauf.laeuft() && Date.now() - bzGeoeffnet > 20000) {
    bzGeoeffnet = Date.now();
    ablauf.reservieren().then(() => { if (ansicht === 'bz') zeigeAbschicken(); });
  }
  const res = resDaten(), jetzt = new Date();
  const fertig = res && res.stand >= ab;
  bzBild = null;
  if (fertig) bildschirmBild({ sekunden: res.stand, aufgaben: res.aufgaben, code: res.code, name: S.name, geuebt: BS.geuebtText(res), teile: BS.teileText(res.teile), karten: res.teile.karten, fuss: 'Archiv der Welten' }, jetzt).then(f => { bzBild = f; });
  const teile = fertig && res.teile.lesen > 0 && res.teile.mathe > 0
    ? `<div class="bz-teile"><div><b>${minTxt(res.teile.mathe)}</b><span>aus Mathe</span></div><div><b>${minTxt(res.teile.lesen)}</b><span>aus Lesen</span></div></div>` : '';
  const zeilen = fertig ? [res.aufgaben ? `${res.aufgaben} ${res.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}` : '', res.teile.karten ? `${res.teile.karten} ${res.teile.karten === 1 ? 'Lesekarte' : 'Lesekarten'}` : ''].filter(Boolean).join(' · ') : '';
  let unten;
  if (fertig) unten = `
    <p class="gedaempft bz-mitte">${esc(BS.zeitpunktText(jetzt))} Uhr${zeilen ? '<br>' + zeilen : ''}${BS.geuebtText(res) ? '<br>' + esc(BS.geuebtText(res)) : ''}</p>
    <div><p class="gedaempft bz-mitte bz-code-label">Dein Code</p><div class="bz-code">${esc(res.code.split('').join(' '))}</div></div>
    <button class="btn btn-bz btn-gross" data-act="teilen">Teilen</button>
    <p class="gedaempft bz-mitte">Schick die Nachricht an deine Eltern.<br>Danach steht hier wieder 0.</p>
    <p class="meldung-bz" id="bz-meldung" hidden></p>`;
  else if (anz.sek < ab) unten = `<p class="bz-mitte">${anz.sek > 0 ? `Ab ${minTxt(ab)} kannst du abschicken. Noch ${minTxt(ab - anz.sek)}` : 'Gerade ist nichts zum Abschicken da.'}</p>`;
  else if (ablauf.status.fehler === 'offline') unten = `<p class="bz-mitte">Zum Abschicken braucht die App Internet.<br>Versuch es gleich noch einmal.</p><button class="btn btn-bz btn-gross" data-act="bzNeu">Noch einmal versuchen</button>`;
  else if (ablauf.status.fehler) unten = `<p class="bz-mitte">Das hat gerade nicht geklappt.</p><button class="btn btn-bz btn-gross" data-act="bzNeu">Noch einmal versuchen</button>`;
  else unten = `<p class="gedaempft bz-mitte bz-code-label">Dein Code</p><div class="bz-code bz-code-warten">· · · ·</div><button class="btn btn-bz btn-gross" disabled>Einen Moment …</button>`;
  $app.innerHTML = `<div class="screen bz-screen">
    <header class="topbar"><button class="btn-text" data-act="start">‹ Zurück</button></header>
    <div class="bz-gross-icon">${VIDEO(64)}</div>
    <div class="bz-gross">${minTxt(fertig ? res.stand : anz.sek)}</div>
    <p class="bz-mitte bz-label">Bildschirmzeit</p>
    ${teile}${unten}</div>`;
}
let teilenLaeuft = false, teilenWeg = false;
async function teilen() {
  const res = resDaten();
  if (!res) return;
  const text = (test() ? 'TEST – nicht gültig\n' : '') + BS.nachrichtText({ ...res, aufgaben: res.aufgaben }, new Date(), res.teile).replace(/ · 0 Aufgaben| 0 Aufgaben · /, '');
  let geteilt = false, mitBild = false;
  if (navigator.share) {
    mitBild = !!(bzBild && navigator.canShare && navigator.canShare({ files: [bzBild], text }));
    teilenLaeuft = true; teilenWeg = false;
    try { await navigator.share(mitBild ? { files: [bzBild], text } : { text }); geteilt = true; }
    catch (e) {
      if (e && e.name === 'AbortError') {
        const weg = teilenWeg; teilenLaeuft = false;
        protokoll('teilen_abbruch', { code: res.code, sekunden: res.stand, weg });
        if (weg) nachfragen(mitBild);
        return;
      }
    } finally { teilenLaeuft = false; }
  }
  if (!geteilt) {
    try { await navigator.clipboard.writeText(text); } catch (e) { /* egal */ }
    const m = document.getElementById('bz-meldung');
    if (m && m.hidden) { m.hidden = false; m.textContent = 'Der Text ist kopiert. Füge ihn in deine Nachricht ein. Dann tippe noch einmal auf „Teilen“.'; return; }
  }
  abgeschickt(mitBild);
}
function nachfragen(mitBild) {
  const m = document.getElementById('modal');
  m.classList.add('offen');
  m.innerHTML = `<div class="modal-hinter"></div><div class="modal-box" role="dialog" aria-modal="true"><div class="hinweis-text"><h2 class="modal-titel">Ist die Nachricht angekommen?</h2>
    <p>Hast du sie an deine Eltern geschickt?</p><div class="knopf-reihe"><button class="btn btn-haupt" data-act="angekommen" data-bild="${mitBild ? 1 : 0}">Ja, geschickt</button><button class="btn" data-act="nichtAngekommen">Nein</button></div></div></div>`;
}
function abgeschickt(mitBild, bestaetigt = false) {
  const res = test() ? (() => { const r = S.kasse.res; S.kasse.res = null; sichern(); return r; })() : ablauf.geteilt();
  if (!res) return;
  protokoll('bildschirmzeit', { sekunden: res.sek, aufgaben: res.aufgaben || 0, lesekarten: res.lesekarten || 0, code: res.code, mathe: res.mathe || 0, lesen: res.lesen || 0, ...(res.uebung_ms ? { uebung_ms: res.uebung_ms } : {}), kasse: true, bild: !!mitBild, ...(bestaetigt ? { bestaetigt: true } : {}) });
  syncen();
  bzGeschickt = { sek: res.sek };
  zeigeAbschicken();
  bzGeschickt = null;
}

// Einrichtung: derselbe QR-Code wie für das Kinder-Handy in der Eltern-App (Einstellungen → „Handy mit QR-Code einrichten“)
let scanStopp = null;
function zeigeEinrichtung(meldung = '') {
  ansicht = 'einrichtung';
  $app.innerHTML = `<div class="screen einrichten">
    <header class="start-kopf marke">${sechseck(56, '#E3E6F5', '#33408F', BUCH)}<div><h1>Archiv der Welten</h1><p class="gedaempft">Einrichten</p></div></header>
    <p>Scanne den QR-Code für das Kinder-Handy aus der Eltern-App. Mit dem Code „Weitere Eltern-App“ wird dieses Handy ein Testgerät.</p>
    <button class="btn btn-haupt btn-gross" data-act="scannen">QR-Code scannen</button>
    <video id="kamera" playsinline muted hidden></video>
    <details><summary>Link einfügen</summary><textarea id="link" aria-label="Link aus der Eltern-App"></textarea><button class="btn" data-act="linkOk">Übernehmen</button></details>
    ${meldung ? `<p class="meldung">${esc(meldung)}</p>` : ''}
    <p class="gedaempft bz-mitte klein">Version ${LESE_VERSION}</p></div>`;
}
async function einrichten(text) {
  const d = einrichtungLesen(text);
  if (!d || !(d.art === 'eltern' || (d.art === 'kind' && d.name))) { zeigeEinrichtung('Diesen Code kennt die Lese-App nicht. Nimm den Code für das Kinder-Handy.'); return false; }
  try {
    await U.verbindungTesten({ repo: d.repo, token: d.token });
  } catch (e) { zeigeEinrichtung(e.message || 'Keine Verbindung.'); return false; }
  S.name = d.art === 'kind' ? d.name : ''; S.upload = { ...S.upload, repo: d.repo, token: d.token };
  if (d.art === 'eltern') { S.upload.testgeraet = true; protokoll('testgeraet', { an: true }); }
  protokoll('einrichtung_qr', { app: 'archiv', art: d.art });
  history.replaceState(null, '', location.pathname);
  await einstellungenHolen().catch(() => {});
  if (test() && !testAls()) { zeigeStart(false); personaWahl(); return true; }
  zeigeStart();
  return true;
}

// ---------- Elternbereich (Logo 2 Sekunden gedrückt halten, eigener PIN dieser App) ----------
function modal(html) {
  const m = document.getElementById('modal');
  m.classList.add('offen');
  m.innerHTML = `<div class="modal-hinter" data-act="modalZu"></div><div class="modal-box" role="dialog" aria-modal="true"><button class="modal-x" data-act="modalZu" aria-label="Schließen">✕</button>${html}</div>`;
  setTimeout(() => { const i = m.querySelector('input'); if (i) i.focus(); }, 50);
}
function elternZugang() {
  if (!S.pin) modal(`<div class="pin-form"><h2 class="modal-titel">Elternbereich einrichten</h2>
    <p>Lege einen PIN fest (4 bis 8 Ziffern). Damit kommst du später in den Elternbereich: Logo 2 Sekunden gedrückt halten.</p>
    <input id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="PIN">
    <input id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="PIN wiederholen">
    <p class="fehler-text" id="pin-fehler"></p><button class="btn btn-haupt" data-act="pinSetzen">Speichern</button></div>`);
  else modal(`<div class="pin-form"><h2 class="modal-titel">Elternbereich</h2>
    <input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="PIN">
    <p class="fehler-text" id="pin-fehler"></p><button class="btn btn-haupt" data-act="pinPruefen">Öffnen</button></div>`);
}
let kinder = null;
async function personaWahl() {
  modal(`<div class="hinweis-text persona-wahl"><h2 class="modal-titel">Testen als …</h2><p class="gedaempft klein">Liest die Einstellungen dieses Kindes. Es wird nichts gesendet.</p><p class="gedaempft">Wird geladen …</p></div>`);
  try {
    if (!kinder) {
      const dirs = (await U.ordnerLesen(S.upload, 'daten')).filter(f => f.type === 'dir').map(f => f.name);
      kinder = [];
      for (const o of dirs) { try { if (await U.dateiLesen(S.upload, `daten/${o}/einstellungen.json`)) kinder.push(o); } catch (e) { /* weiter */ } }
    }
  } catch (e) { kinder = []; }
  modal(`<div class="hinweis-text persona-wahl"><h2 class="modal-titel">Testen als …</h2><p class="gedaempft klein">Liest die Einstellungen dieses Kindes. Es wird nichts gesendet.</p>
    <div class="persona-liste">${kinder.map(o => `<button class="btn${testAls() === o ? ' btn-haupt' : ''}" data-act="personaSetzen" data-o="${esc(o)}">${esc(gross(o))}</button>`).join('') || '<p>Keine Kinder im Daten-Repo gefunden.</p>'}</div></div>`);
}
function zeigeEltern(meldung = '') {
  ansicht = 'eltern';
  const r = R(), w = W();
  const lesenText = w.lesen ? `${LL.leseRegeln(w.lesen).an ? 'an' : 'aus'} · ${r.max} Min. am Tag · Faktor ${String(r.faktor).replace('.', ',')}` : 'noch nicht eingestellt';
  $app.innerHTML = `<div class="screen eltern-seite">
    <header class="topbar"><button class="btn-text" data-act="start">‹ Zum Start</button></header>
    <h2>Elternbereich</h2>
    ${meldung ? `<p class="meldung">${esc(meldung)}</p>` : ''}
    <section class="info-karte">
      <div class="info-zeile"><span>Name</span><b>${esc(S.name || '–')}</b></div>
      <div class="info-zeile"><span>Lesen für ${esc(gross(ordner()) || '–')}</span><b>${esc(lesenText)}</b></div>
      <div class="info-zeile"><span>Konto gemeinsam</span><b>${w.kasse ? 'an' : 'aus'}</b></div>
      <div class="info-zeile"><span>Übertragung</span><b>${test() ? 'aus (Testgerät)' : S.upload.fehler ? esc(S.upload.fehler) : 'in Ordnung'}</b></div>
      <div class="info-zeile"><span>Version</span><b>${LESE_VERSION}</b></div>
    </section>
    <section class="info-karte">
      <label class="schalter-zeile"><input type="checkbox" data-act="testAn"${test() ? ' checked' : ''}><span><b>Dieses Handy ist ein Testgerät</b><br><span class="gedaempft klein">Es wird nichts gesendet. Lesen ist zum Ausprobieren immer offen. Bildschirmzeit bleibt auf diesem Handy, der Code gilt nicht.</span></span></label>
      ${test() ? `<button class="btn" data-act="persona">Testen als: ${esc(gross(testAls()) || 'bitte wählen')}</button>
      <button class="btn" data-act="testZurueck">Test-Lese-Zeit und Test-Konto löschen</button>` : ''}
    </section>
    <button class="btn" data-act="neuEinrichten">Neu einrichten (QR-Code)</button>
    <p class="gedaempft klein">Lese-Zeit, Lohnfaktor und „Nur heute mehr“ stellt ihr in der Eltern-App ein.</p>
  </div>`;
}
let druckZeit = null;
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.marke svg')) return;
  druckZeit = setTimeout(() => { druckZeit = null; elternZugang(); }, 1500);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => { if (druckZeit) { clearTimeout(druckZeit); druckZeit = null; } }));
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.marke')) e.preventDefault(); });

function modalZu() { const m = document.getElementById('modal'); m.classList.remove('offen'); m.innerHTML = ''; }

// ---------- Bedienung ----------
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  switch (el.dataset.act) {
    case 'start': zeigeStart(); break;
    case 'bz': zeigeAbschicken(); break;
    case 'bzNeu': bzGeoeffnet = 0; ablauf.status.fehler = null; zeigeAbschicken(); break;
    case 'teilen': teilen(); break;
    case 'angekommen': modalZu(); abgeschickt(el.dataset.bild === '1', true); break;
    case 'nichtAngekommen': modalZu(); protokoll('teilen_nicht_angekommen', {}); break;
    case 'scannen': {
      const v = document.getElementById('kamera'); v.hidden = false;
      try { scanStopp = await kameraScan(v, '../vendor/jsQR.js', (txt) => { if (einrichtungLesen(txt)) { einrichten(txt); return true; } return false; }); }
      catch (e) { zeigeEinrichtung(e.message || 'Die Kamera geht gerade nicht. Füge den Link ein.'); }
      break;
    }
    case 'linkOk': einrichten(document.getElementById('link').value); break;
    case 'pinSetzen': {
      const a = document.getElementById('pin1').value, b = document.getElementById('pin2').value;
      if (!/^\d{4,8}$/.test(a)) { document.getElementById('pin-fehler').textContent = 'Bitte 4 bis 8 Ziffern.'; break; }
      if (a !== b) { document.getElementById('pin-fehler').textContent = 'Die beiden PINs sind nicht gleich.'; break; }
      S.pin = a; sichern(); modalZu(); zeigeEltern(); break;
    }
    case 'pinPruefen': if (document.getElementById('pin').value === S.pin) { modalZu(); zeigeEltern(); } else document.getElementById('pin-fehler').textContent = 'Der PIN stimmt nicht.'; break;
    case 'modalZu': modalZu(); break;
    case 'testAn': {
      const an = el.checked;
      S.upload.testgeraet = an; if (!an) S.upload.testAls = null;
      S.kasse = null; S.einst = null; // Test-Konto und Einstellungen verwerfen
      protokoll('testgeraet', { an }); sichern();
      await einstellungenHolen().catch(() => {});
      zeigeEltern(); break;
    }
    case 'persona': personaWahl(); break;
    case 'personaSetzen': S.upload.testAls = el.dataset.o; S.einst = null; sichern(); modalZu(); await einstellungenHolen().catch(() => {}); if (ansicht === 'eltern') zeigeEltern(); else zeigeStart(); break;
    case 'testKarte': { const k = kasse(); if (k) { LL.verdienen(k, heute(), 120, R()); sichern(); zeigeStart(false); } break; }
    case 'testZurueck': { if (S.kasse && test()) { S.kasse = null; S.tag = null; sichern(); } zeigeEltern('Test-Lese-Zeit und Test-Konto sind gelöscht.'); break; }
    case 'neuEinrichten': S.name = ''; S.upload = { tage: {} }; S.einst = null; S.kasse = test() ? null : S.kasse; sichern(); zeigeEinrichtung(); break;
    case 'eltern': zeigeEltern(); break;
  }
});
document.addEventListener('visibilitychange', () => {
  if (teilenLaeuft && document.hidden) teilenWeg = true;
  if (!document.hidden) { if (ansicht === 'start') zeigeStart(); versionPruefen(); }
});

// Neue Version: auf dem Startbildschirm neu laden
async function versionPruefen() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const v = (await r.json()).version;
    if (v && v !== LESE_VERSION && ansicht === 'start') location.reload();
  } catch (e) { /* offline */ }
}

// Start: Einrichtungs-Link in der Adresse (Kamera-App) übernehmen
if (einrichtungLesen(location.hash)) einrichten(location.hash);
else { zeigeStart(); versionPruefen(); }
setInterval(() => { if (!document.hidden) syncen(); }, 10 * 60 * 1000);
