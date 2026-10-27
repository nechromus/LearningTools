// Eltern-App: Lerndaten ansehen (bis zur einzelnen Aufgabe) und Einstellungen der Übungs-App aus der Ferne ändern.
// Daten liegen im privaten Repo (LearningToolsTracking). Der Zugangsschlüssel bleibt nur auf diesem Gerät.
import * as U from '../js/sync.js';
import * as L from '../js/logic.js';
import { THEMA_NAMEN, GEN_NAMEN } from '../js/namen.js';
import { esc, mathe, bildSvg } from '../js/render.js';
import * as A from './auswertung.js';
import * as P from '../js/paket.js';
import { LANG_STUFEN, langStufeInfo } from '../js/formeluebersicht.js';
import * as SP from '../js/splitter.js';
import * as BS from '../js/bildschirm.js';
import * as LP from '../js/lernplan.js';
import { pdfsZusammen } from './pdfzusammen.js';
import * as W from '../js/wochenplan.js';
import { einrichtungsLink, einrichtungLesen, kameraScan } from '../js/einrichtung.js';
import qrcode from './vendor/qrcode.mjs';
import { Lernplan } from './lernplan.mjs';

export const ELTERN_VERSION = '1.48.0';
const KEY = 'eltern-v1';
const MIN_APP = '1.4.0'; // ab dieser Version übernimmt die Übungs-App Einstellungen aus der Ferne

const app = document.getElementById('app');
const breit = window.matchMedia('(min-width: 760px)');

let C = konfigLaden();
const D = { nutzer: null, pool: new Map(), hinweise: {}, daten: null, fehler: null, pakete: [] };
let route = { seite: 'uebersicht', arg: '' };
let entwurf = null;
let paketEntwurf = null;   // Paket, das gerade bearbeitet wird
let paketText = { text: '', ergebnis: null }; // Paket aus Text einfügen
let qr = { name: '', token: '', link: '', art: 'kind' }; // QR-Code zum Einrichten (Schlüssel wird nicht gespeichert)
let scanStopp = null;
let geaenderteStufen = new Set();
let meldung = null;
let filter = 'alle';
let laedt = false;

function konfigLaden() {
  const std = { repo: '', token: '', nutzer: '', zeitraum: 7 };
  try { return { ...std, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return std; }
}
function konfigSichern() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { /* privat: dann nur für diese Sitzung */ } }

// ---------- Hilfen ----------

const icon = {
  uebersicht: '<path d="M4 19V10M10 19V5M16 19v-7M21 19H3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  verlauf: '<path d="M5 6h14M5 12h14M5 18h9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  lernplan: '<rect x="3" y="5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h5M7 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  berichte: '<path d="M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 15v-3M12 15V9M16 15v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  boegen: '<path d="M6 3h9l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15 3v4h4M9 12h7M9 16h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  tickets: '<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  einstellungen: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/>',
  zurueck: '<path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  weiter: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  uhr: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  neu: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
};
const svg = (name, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${icon[name]}</svg>`;
const logo = (size = 34) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#DCEDED" stroke="#1F6F75" stroke-width="1.6"/><path d="M8 15l3-6 2 4 3-5" stroke="#1F6F75" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const tagLang = (k) => new Date(k + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const tagKurz = (k) => new Date(k + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const wochentag = (k) => new Date(k + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
const uhr = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const wann = (iso) => {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  const heute = L.tagKey(), k = L.tagKey(d);
  return (k === heute ? 'heute' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })) + ' ' + uhr(iso);
};
const zahlText = (x) => String(x).replace('.', ',');
function versionAlt(v, min) {
  const a = String(v || '0').split('.').map(Number), b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i]; }
  return false;
}
const name = () => (D.daten && D.daten.name) || 'Kind';

// ---------- Daten laden ----------

async function grunddatenLaden() {
  const [pool, hw] = await Promise.all([
    fetch('../data/aufgaben.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ aufgaben: [] })),
    fetch('../data/hinweise.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ hinweise: [] }))
  ]);
  D.pool = new Map((pool.aufgaben || []).map(a => [a.id, a]));
  D.hinweise = Object.fromEntries((hw.hinweise || []).map(h => [h.id, h.titel]));
  // Logbuch-Einträge: Etappen ohne geschriebenen Eintrag sind „kommt bald“
  D.logbuch = await fetch('../data/logbuch.json', { cache: 'no-cache' }).then(r => r.json()).then(d => d.eintraege || []).catch(() => []);
  D.archiv = await fetch('../data/wissensarchiv.json', { cache: 'no-cache' }).then(r => r.json()).then(d => Object.fromEntries((d.eintraege || []).map(e => [e.id, e.titel]))).catch(() => ({}));
}

async function nutzerLaden() {
  const ordner = (await U.ordnerLesen(C, 'daten')).filter(x => x.type === 'dir');
  const liste = await Promise.all(ordner.map(async d => {
    const innen = await U.ordnerLesen(C, d.path);
    const geraete = innen.filter(x => x.type === 'dir');
    return geraete.length ? { ordner: d.name, name: d.name.charAt(0).toUpperCase() + d.name.slice(1), geraete } : null;
  }));
  D.nutzer = liste.filter(Boolean);
  if (!D.nutzer.some(n => n.ordner === C.nutzer)) { C.nutzer = D.nutzer.length ? D.nutzer[0].ordner : ''; konfigSichern(); }
}

async function paketeLaden() {
  const dateien = (await U.ordnerLesen(C, 'pakete')).filter(f => f.type === 'file' && f.name.endsWith('.json'));
  const inhalte = await Promise.all(dateien.map(f => U.dateiLesen(C, f.path).catch(() => null)));
  D.pakete = inhalte.map(x => x && P.paketPruefen(x).paket).filter(Boolean);
}

// Eingebautes Paket plus die Pakete aus dem Daten-Repo (gleiche id im Repo ersetzt das eingebaute)
function allePakete() {
  const map = new Map([[P.STANDARD_PAKET.id, { ...P.STANDARD_PAKET, eingebaut: true }]]);
  for (const p of D.pakete) map.set(p.id, p);
  return [...map.values()];
}
const paketVon = (id) => allePakete().find(p => p.id === id);

async function tagDateiHolen(f, cache, behalten) {
  const key = `https://cache.eltern.local/${f.path}?sha=${f.sha}`;
  behalten.add(key);
  try { const hit = cache && await cache.match(key); if (hit) return await hit.json(); } catch (e) { /* weiter ohne Speicher */ }
  const json = await U.dateiLesen(C, f.path);
  try { if (cache) await cache.put(key, new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } })); } catch (e) { /* egal */ }
  return json;
}

async function datenLaden() {
  const n = D.nutzer.find(x => x.ordner === C.nutzer);
  if (!n) { D.daten = { leer: true }; return; }
  const ab = A.letzteTage(31)[0];
  let cache = null;
  try { cache = await caches.open('eltern-tage-v1'); } catch (e) { /* ohne Speicher */ }
  const behalten = new Set();
  const proGeraet = {}, staende = [];
  // Geräte-Ordner frisch lesen (es können neue dazugekommen sein)
  const geraete = (await U.ordnerLesen(C, `daten/${n.ordner}`)).filter(x => x.type === 'dir');
  const kennung = [];
  await Promise.all(geraete.map(async g => {
    const dateien = await U.ordnerLesen(C, g.path);
    kennung.push(...tageKennung(g.name, dateien, ab));
    const standDatei = dateien.find(f => f.name === 'stand.json');
    const tage = dateien.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f.name) && f.name.slice(0, 10) >= ab);
    const [stand, ...tagInhalte] = await Promise.all([
      standDatei ? U.dateiLesen(C, standDatei.path) : null,
      ...tage.map(f => tagDateiHolen(f, cache, behalten))
    ]);
    if (stand) staende.push({ geraet: g.name, stand });
    proGeraet[g.name] = tagInhalte.flatMap(t => (t && t.eintraege) || []).sort((a, b) => a.t < b.t ? -1 : 1);
  }));
  if (cache) {
    try { for (const req of await cache.keys()) if (req.url.includes(`/daten/${n.ordner}/`) && !behalten.has(req.url)) await cache.delete(req); } catch (e) { /* egal */ }
  }
  const einst = await U.dateiLesen(C, `daten/${n.ordner}/einstellungen.json`);
  staende.sort((a, b) => (a.stand.stand || '') < (b.stand.stand || '') ? 1 : -1);
  const eintraege = Object.entries(proGeraet).flatMap(([g, l]) => l.map(e => ({ ...e, g }))).sort((a, b) => a.t < b.t ? -1 : 1);
  D.daten = {
    ordner: n.ordner,
    name: (staende[0] && staende[0].stand.nutzer) || n.name,
    staende, proGeraet, eintraege,
    aufgaben: A.alleAufgaben(proGeraet),
    spiele: A.alleSpiele(proGeraet),
    einst, geladen: Date.now(), kennung: kennung.sort().join('|')
  };
  datenHinweisWeg();
  berichteLaden(n.ordner);
  liveLaden(n.ordner);
}

// ---------- Neue Daten melden ----------
// Fingerabdruck der Tagesdateien (Name + sha). Ändert er sich, hat ein Handy neue Lerndaten übertragen.
function tageKennung(geraet, dateien, ab) {
  return dateien.filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f.name) && f.name.slice(0, 10) >= ab).map(f => `${geraet}/${f.name}:${f.sha}`);
}

let datenGemeldet = null;   // Fingerabdruck, der schon gemeldet (oder mit „Später“ weggeklickt) wurde
let datenPruefungLaeuft = false;
let letzteDatenPruefung = 0;

async function neueDatenPruefen() {
  if (!C.token || laedt || datenPruefungLaeuft || !D.daten || D.daten.leer || D.daten.kennung === undefined) return;
  if (document.visibilityState !== 'visible') return;
  datenPruefungLaeuft = true; letzteDatenPruefung = Date.now();
  try {
    const ordner = D.daten.ordner, ab = A.letzteTage(31)[0];
    const geraete = (await U.ordnerLesen(C, `daten/${ordner}`)).filter(x => x.type === 'dir');
    const listen = await Promise.all(geraete.map(async g => tageKennung(g.name, await U.ordnerLesen(C, g.path), ab)));
    const kennung = listen.flat().sort().join('|');
    if (!D.daten || D.daten.ordner !== ordner || laedt) return;
    if (kennung !== D.daten.kennung && kennung !== datenGemeldet) { datenGemeldet = kennung; datenHinweisZeigen(); }
  } catch (e) { /* offline: später nochmal */ }
  finally { datenPruefungLaeuft = false; }
}

function datenHinweisZeigen() {
  if (document.getElementById('daten-leiste')) return;
  const d = document.createElement('div');
  d.id = 'daten-leiste';
  d.className = 'update-leiste daten-leiste';
  d.setAttribute('role', 'status');
  d.innerHTML = `<span>Neue Daten von ${esc(name())} sind da.</span>
    <button class="knopf haupt" data-act="datenLaden">Laden</button>
    <button class="knopf-text" data-act="datenSpaeter">Später</button>`;
  document.body.appendChild(d);
}
function datenHinweisWeg() { document.getElementById('daten-leiste')?.remove(); }

async function allesLaden({ nutzerliste = false } = {}) {
  if (laedt) return;
  laedt = true; D.fehler = null;
  zeichne();
  try {
    if (!D.pool.size) await grunddatenLaden();
    if (nutzerliste || !D.nutzer) await nutzerLaden();
    await Promise.all([datenLaden(), paketeLaden()]);
  } catch (e) {
    D.fehler = e.message || 'Laden hat nicht geklappt.';
  }
  laedt = false;
  zeichne();
}

const neuesterStand = () => D.daten && D.daten.staende[0] ? D.daten.staende[0].stand : null;

// ---------- Rahmen ----------

function leseRoute() {
  const [seite, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  route = { seite: seite || 'uebersicht', arg: rest.length ? decodeURIComponent(rest.join('/')) : '' };
}

function nutzerWahl(klasse) {
  if (!D.nutzer || !D.nutzer.length) return '';
  const opts = D.nutzer.map(n => `<option value="${esc(n.ordner)}"${n.ordner === C.nutzer ? ' selected' : ''}>${esc(n.ordner === (D.daten && D.daten.ordner) ? name() : n.name)}</option>`).join('');
  return `<label class="${klasse}"><span class="unsichtbar">Kind auswählen</span><select name="nutzer-wahl">${opts}</select></label>`;
}

function navLinks(art) {
  const aktiv = route.seite === 'aufgabe' || route.seite === 'spiel' ? 'verlauf' : route.seite === 'ticket' ? 'tickets' : ['spielzeit', 'gewichte', 'pakete', 'paket', 'qr', 'einheit', 'splitter'].includes(route.seite) ? 'einstellungen' : route.seite;
  if (C.nur === 'boegen') return `<a href="#boegen" class="${art} aktiv" aria-current="page">${svg('boegen', 24)}<span>Bögen</span></a>`;
  return [['uebersicht', 'Übersicht'], ['verlauf', 'Verlauf'], ['lernplan', 'Lernplan'], ...(boegenAn() ? [['boegen', 'Bögen']] : []), ...(berichteAn() ? [['berichte', 'Berichte']] : []), ['tickets', 'Tickets'], ['einstellungen', 'Einstellungen']].map(([k, t]) =>
    `<a href="#${k}" class="${art}${aktiv === k ? ' aktiv' : ''}"${aktiv === k ? ' aria-current="page"' : ''}>${svg(k, 24)}<span>${t}</span></a>`).join('');
}

function standZeile() {
  if (laedt) return 'Lädt …';
  if (!D.daten || !D.daten.geladen) return '';
  const st = neuesterStand();
  return `Daten vom Handy: ${st ? wann(st.stand) : 'noch keine'}`;
}

function zeichne() {
  if (!C.token) return zeichneEinrichten();
  const inhalt = seiteHtml();
  const scroll = bgScrollMerken();
  const neuKnopf = `<button class="knopf-icon" data-act="neuLaden" aria-label="Neu laden">${svg('neu', 22)}</button>`;
  if (breit.matches) {
    app.innerHTML = `<div class="rahmen-breit">
      <aside class="seitenleiste">
        <div class="marke">${logo(36)}<div><div class="marke-titel">Schrein der Zahlen</div><div class="klein gedaempft">Eltern</div></div></div>
        ${C.nur ? '' : nutzerWahl('nutzer-feld')}
        <nav class="seiten-nav">${navLinks('nav-link')}</nav>
        <div class="seitenleiste-fuss"><span class="klein gedaempft">${standZeile()}</span>${neuKnopf}</div>
      </aside>
      <main class="inhalt-breit${route.seite === 'verlauf' || route.seite === 'aufgabe' || route.seite === 'boegen' || route.seite === 'berichte' ? ' ohne-rand' : ''}">${inhalt}</main>
    </div>`;
  } else {
    app.innerHTML = `<div class="rahmen-schmal">
      <main class="inhalt-schmal">${inhalt}</main>
      ${C.nur ? '' : `<nav class="tabs${boegenAn() && berichteAn() ? ' sieben' : boegenAn() || berichteAn() ? ' sechs' : ''}">${navLinks('tab')}</nav>`}
    </div>`;
  }
  if (route.seite === 'lernplan') lernplanEinhaengen();
  bgScrollZurueck(scroll);
}
// Bögen auf dem iPad: Liste und Bogen scrollen getrennt. Beim Neuzeichnen bleibt die Liste stehen;
// der Bogen bleibt stehen, solange derselbe Bogen offen ist, sonst geht er nach oben.
const BGS = { liste: null, haupt: 0, arg: null, gezeigt: null };
function bgScrollMerken() {
  const l = document.querySelector('.bg-seite-liste'), h = document.querySelector('.bg-haupt');
  if (l) BGS.liste = l.scrollTop;
  if (h) BGS.haupt = h.scrollTop;
  return BGS;
}
function bgScrollZurueck() {
  const l = document.querySelector('.bg-seite-liste'), h = document.querySelector('.bg-haupt');
  if (!l || !h) { BGS.arg = null; return; }
  if (BGS.liste != null) l.scrollTop = BGS.liste;
  // Von außen geöffnet (Lernplan, Deep Link): gewählten Bogen einmal in der Liste zeigen, wenn er nicht zu sehen ist
  const g = l.querySelector('.bg-zeile.gewaehlt');
  if (g && BGS.gezeigt !== route.arg) {
    BGS.gezeigt = route.arg;
    const r = g.getBoundingClientRect(), lr = l.getBoundingClientRect();
    if (r.top < lr.top || r.bottom > lr.bottom) l.scrollTop += r.top - lr.top - (lr.height - r.height) / 2;
  }
  h.scrollTop = BGS.arg === route.arg ? BGS.haupt : 0;
  BGS.arg = route.arg; BGS.liste = l.scrollTop;
}

function seiteHtml() {
  if (D.fehler && !D.daten) return `<div class="seite"><h1>Laden hat nicht geklappt</h1><p class="hinweis-box">${esc(D.fehler)}</p><button class="knopf haupt" data-act="neuLaden">Nochmal versuchen</button>${schluesselKarte()}</div>`;
  if (!D.daten) return `<div class="seite lade-seite">${logo(64)}<p>Lerndaten werden geladen …</p></div>`;
  if (D.daten.leer) return `<div class="seite"><h1>Noch keine Daten</h1><p>Im Daten-Repo gibt es noch keinen Ordner mit Namen. Sobald sich jemand in der Übungs-App mit Namen angemeldet hat und Daten übertragen wurden, erscheinen sie hier.</p><button class="knopf haupt" data-act="neuLaden">Neu laden</button>${schluesselKarte()}</div>`;
  if (C.nur === 'boegen' && route.seite !== 'boegen') { history.replaceState(null, '', location.pathname + '#boegen'); route = { seite: 'boegen', arg: '' }; }
  switch (route.seite) {
    case 'verlauf': return breit.matches ? verlaufBreit() : (route.arg ? tagSeite(route.arg) : tageListe());
    case 'aufgabe': return breit.matches ? verlaufBreit() : aufgabeSeite(route.arg);
    case 'spiel': return breit.matches ? verlaufBreit() : spielSeite(route.arg);
    case 'einstellungen': return einstellungenSeite();
    case 'spielzeit': return spielzeitSeite();
    case 'gewichte': return gewichteSeite();
    case 'splitter': return splitterSeite();
    case 'pakete': return paketeSeite();
    case 'paket': return paketSeite(route.arg);
    case 'einheit': return einheitSeite(route.arg);
    case 'qr': return qrSeite();
    case 'lernplan': return lernplanSeite();
    case 'tickets': return ticketsSeite();
    case 'boegen': return boegenSeite();
    case 'berichte': return berichteSeite();
    case 'ticket': return ticketSeite(route.arg);
    default: return uebersichtSeite();
  }
}

// ---------- Live-Anzeige: daten/<name>/live.json ----------
const LV = { kind: null, live: null, geholt: 0 };
function liveAn() { const w = D.daten && D.daten.einst && D.daten.einst.werte; return !!(w && w.live === true); }
async function liveLaden(o) {
  if (!liveAn()) return;
  try { const x = await U.dateiLesen(C, `daten/${o}/live.json`); if (C.nutzer === o) { LV.kind = o; LV.live = x; LV.geholt = Date.now(); zeichne(); } } catch (e) { /* später */ }
}
// Solange die Übersicht offen ist: alle 30 Sekunden nachsehen
setInterval(() => { if (!document.hidden && route.seite === 'uebersicht' && C.token && D.daten && !D.daten.leer) liveLaden(C.nutzer); }, 30000);
const lvUhr = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function liveKarte() {
  if (!liveAn() || LV.kind !== C.nutzer) return '';
  const st = A.liveStand(LV.live, D.daten.eintraege || []);
  if (!st) return '';
  const nm = esc(name());
  if (!st.aktiv) return `<section class="karte live-karte aus"><span class="live-punkt"></span><span class="live-text"><b>Gerade nicht in der App</b><span class="klein gedaempft">zuletzt aktiv ${esc(wann(new Date(st.letzte).toISOString()))}</span></span></section>`;
  const was = st.zustand === 'spiel' ? `Spielt ${esc(SPIELNAMEN[st.spiel] || st.spiel || 'im Schrein')} seit ${lvUhr(st.seit)}`
    : `Übt seit ${lvUhr(st.seit)}${st.thema ? ' · ' + esc(THEMA_NAMEN[st.thema] || st.thema) : ''}${st.zweck === 'bild' ? ' · für Bildschirmzeit' : ''}`;
  const zahlen = `heute ${st.heute.aufgaben} ${st.heute.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}, ${st.heute.erst} im 1. Versuch · Stand ${lvUhr(st.letzte)}`;
  return `<section class="karte live-karte an"><span class="live-punkt"></span><span class="live-text"><b>${nm} ist gerade in der App</b><span>${was}</span><span class="klein gedaempft">${zahlen}</span></span><button class="knopf-icon" data-act="neuLaden" aria-label="Neu laden" title="Neu laden">${svg('neu', 20)}</button></section>`;
}
const SPIELNAMEN = { '2048': '2048', runenfeld: 'Runenfeld', kristallmine: 'Kristallmine', steinschieber: 'Steinschieber', runenfall: 'Runenfall', runenreihen: 'Runenreihen', hoehlenkarte: 'Höhlenkarte' };

// ---------- Berichte (Auftrag 28) ----------
// daten/<name>/berichte/index.json (berichte-1) und <id>.html schreibt der Kinder-Chat. Hier nur lesen.
const BR = { kind: null, index: null, html: {}, laedt: false, art: 'plan' };
function berichteAn() { return BR.kind === C.nutzer && !!(BR.index && BR.index.length); }
async function berichteLaden(o, neu = false) {
  if (BR.laedt || (BR.kind === o && BR.index && !neu)) return;
  if (BR.kind !== o) Object.assign(BR, { kind: o, index: null, html: {} });
  BR.laedt = true;
  try {
    const x = await U.dateiLesen(C, `daten/${o}/berichte/index.json`);
    BR.index = A.berichteNorm(x);
    if (neu) BR.html = {};
  } catch (e) { BR.index = BR.index || []; }
  BR.laedt = false; zeichne();
}
const BR_STATUS = { vorschlag: 'Vorschlag', freigegeben: 'freigegeben', fertig: 'fertig', 'rückwirkend': 'rückwirkend' };
const brStatus = (b) => BR_STATUS[b.status] || b.status || '';
const brStatusKlasse = (b) => b.status === 'freigegeben' || b.status === 'fertig' ? 'fertig' : b.status === 'vorschlag' ? 'warn' : 'grau';
const brNachArt = (art) => (BR.index || []).filter(b => b.art === art);
const brPlanAktuell = () => A.planAktuell(brNachArt('plan'), L.tagKey());
const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const monatText = (m) => m ? `${MONATSNAMEN[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}` : 'Ohne Datum';
const brZeitraum = (b) => b.zeitraum ? `${datumKurz(b.zeitraum[0])}–${datumKurz(b.zeitraum[1])}` : datumKurz(b.datum);
function brHtml(b) {
  const k = b.id;
  if (BR.html[k] === undefined) {
    BR.html[k] = null;
    U.dateiBlob(C, `daten/${BR.kind}/berichte/${b.datei}`).then(x => x ? x.text() : 'fehlt').then(t => { BR.html[k] = t; zeichne(); }).catch(() => { BR.html[k] = 'fehlt'; zeichne(); });
  }
  return BR.html[k];
}
function brZeile(b, aktuell, gewaehlt) {
  return `<a class="zeile br-zeile${aktuell ? ' aktuell' : ''}${gewaehlt ? ' gewaehlt' : ''}" href="#berichte/${encodeURIComponent(b.id)}">
    <span class="zeile-haupt"><b>${esc(b.titel || b.id)}</b><span class="klein gedaempft block">${b.woche ? `Woche ${b.woche} · ` : ''}${esc(brZeitraum(b))}${b.kommentare ? ` · ${b.kommentare} ${b.kommentare === 1 ? 'Kommentar' : 'Kommentare'}` : ''}</span></span>
    <span class="br-pills">${aktuell ? '<span class="bg-pill">aktuell</span>' : ''}<span class="bg-pill ${brStatusKlasse(b)}">${esc(brStatus(b))}</span></span></a>`;
}
function brUmschalter() {
  return `<div class="segmente br-umschalter" role="group" aria-label="Art">${[['bericht', 'Wochenberichte'], ['plan', 'Wochenpläne']].map(([a, t]) => `<button class="segment${BR.art === a ? ' an' : ''}" data-act="brArt" data-w="${a}" aria-pressed="${BR.art === a}">${t}</button>`).join('')}</div>`;
}
function brListe(gewaehlt) {
  const l = brNachArt(BR.art), akt = BR.art === 'plan' ? brPlanAktuell() : null;
  return `${brUmschalter()}
    ${BR.laedt && !BR.index ? '<p class="gedaempft pad">Berichte werden geladen …</p>' : ''}
    ${BR.index && !l.length ? `<p class="gedaempft pad">Noch keine ${BR.art === 'plan' ? 'Wochenpläne' : 'Wochenberichte'}.</p>` : ''}
    ${A.berichteNachMonat(l).map(g => `<h2 class="abschnitt">${esc(monatText(g.monat))}</h2><section class="karte liste-karte">${g.liste.map(b => brZeile(b, akt && akt.id === b.id, gewaehlt === b.id)).join('')}</section>`).join('')}
    <button class="knopf bg-neu-laden" data-act="brNeuLaden">${BR.laedt ? 'Lädt …' : 'Neu laden'}</button>`;
}
function brPartner(b) { return b.partner ? (BR.index || []).find(x => x.id === b.partner) || null : null; }
function brPartnerKnopf(b) {
  const p = brPartner(b);
  return p ? `<a class="knopf br-partner" href="#berichte/${encodeURIComponent(p.id)}">${p.art === 'plan' ? 'Zum Plan ›' : '‹ Zum Rückblick'}</a>` : '';
}
function brAnsicht(b) {
  const h = brHtml(b);
  const kopf = `<div class="br-kopf"><div><span class="br-art">${b.art === 'plan' ? 'Wochenplan' : 'Wochenbericht · Rückblick'}${b.woche ? ' · Woche ' + b.woche : ''}</span><h1>${esc(b.titel || b.id)}</h1><span class="klein gedaempft">${esc(brZeitraum(b))} · ${esc(brStatus(b))}${b.kommentare ? ` · ${b.kommentare} ${b.kommentare === 1 ? 'Kommentar' : 'Kommentare'}` : ''} · nur zum Lesen</span></div>
    <span class="br-knoepfe">${brPartnerKnopf(b)}${b.quelle && /^https:\/\/claude\.ai\//.test(b.quelle) ? `<a class="knopf" href="${esc(b.quelle)}" target="_blank" rel="noopener">In Claude öffnen ↗</a>` : ''}</span></div>`;
  if (!h || h === 'fehlt') return `${kopf}<p class="gedaempft pad">${h === 'fehlt' ? 'Die Berichtsdatei fehlt im Daten-Repo.' : 'Bericht wird geladen …'}</p>`;
  // Feste Fassung in einem abgeschotteten Rahmen: eigenes Inline-Skript ja, Zugriff auf die Eltern-App nein. Immer hell wie die App.
  const doc = String(h).replace(/<html(\s|>)/i, (m, z) => `<html data-theme="light"${z}`);
  return `${kopf}<iframe class="br-rahmen" title="${esc(b.titel || 'Bericht')}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" srcdoc="${esc(doc)}"></iframe>`;
}
function berichteSeite() {
  if (!berichteAn()) return `<div class="seite">${breit.matches ? '<h1>Berichte</h1>' : kopfSchmal('Berichte')}<section class="karte"><p class="pad">${BR.laedt ? 'Berichte werden geladen …' : `Für ${esc(name())} gibt es noch keine Berichte. Sie erscheinen, sobald der Kinder-Chat sie ablegt.`}</p></section></div>`;
  const b = route.arg ? (BR.index || []).find(x => x.id === route.arg) : null;
  if (b) BR.art = b.art;
  if (breit.matches) {
    const zeige = b || (BR.art === 'plan' ? brPlanAktuell() : A.berichteSortiert(brNachArt('bericht'))[0]);
    return `<div class="bg-breit br-breit"><aside class="bg-seite-liste"><h1>Berichte</h1>${brListe(zeige && zeige.id)}</aside>
      <section class="bg-haupt br-haupt">${zeige ? brAnsicht(zeige) : '<p class="gedaempft pad">Wähle links einen Bericht.</p>'}</section></div>`;
  }
  if (!b) return `<div class="seite schmal-inhalt">${kopfSchmal('Berichte')}<p class="klein gedaempft">${esc(name())} · ${BR.art === 'plan' ? 'Wochenpläne für die kommende Woche' : 'Rückblicke auf die vergangene Woche'}</p>${brListe('')}</div>`;
  return `<div class="seite schmal-inhalt br-schmal"><a class="zurueck" href="#berichte">‹ Berichte</a>${brAnsicht(b)}</div>`;
}
// Übersicht: Kachel „Wochenplan“ mit dem aktuellen Bericht
function berichtKachel() {
  if (!berichteAn()) return '';
  const b = brPlanAktuell();
  if (!b) return '';
  const p = brPartner(b);
  return `<div class="karte br-kachel"><span class="br-k-l">${svg('berichte', 22)}</span>
    <a class="br-k-m" href="#berichte/${encodeURIComponent(b.id)}"><span class="kachel-label">Wochenplan${b.woche ? ' · Woche ' + b.woche : ''}</span><b>${esc(b.titel || b.id)}</b><span class="klein gedaempft">${esc(brZeitraum(b))} · ${esc(brStatus(b))}${b.kommentare ? ` · ${b.kommentare} ${b.kommentare === 1 ? 'Kommentar' : 'Kommentare'}` : ''}</span></a>
    <span class="br-k-r"><a href="#berichte/${encodeURIComponent(b.id)}">Lesen ›</a>${p ? `<a class="klein" href="#berichte/${encodeURIComponent(p.id)}">Rückblick</a>` : ''}</span></div>`;
}

// ---------- Bögen und Bogen-Feedback (Auftrag 25) ----------
// daten/<name>/boegen/<id>/ (bogen.json, aufgaben.pdf, loesungen.pdf, bilder/) legt der Kinder-Chat an.
// Das Feedback schreibt die Eltern-App nach daten/<name>/bogen-feedback/<id>.json (Fotos unter fotos/). Zwischenstand auf dem Gerät.
const BG = { kind: null, liste: null, laedt: false, fehler: null, boegen: {}, fb: {}, bilder: {}, pdf: {}, zeig: {}, meldung: null, speichert: false, hb: null, hbG: null, hbPdf: {}, hbAlt: {}, hbMeldung: null, hbSchreibt: false, fo: null, foG: null, foPdf: {}, foAlt: {}, foMeldung: null, foSchreibt: false, wochenAuf: {}, zeit: {}, zeitSchreibt: false, zeitMeldung: null };
function boegenAn() { const w = D.daten && D.daten.einst && D.daten.einst.werte; return !!(w && w.boegen_feedback === true); }
const bgKey = (id) => `bogen-fb:${C.nutzer}:${id}`;
function bgEntwurf(id) {
  BG.entwuerfe = BG.entwuerfe || {};
  const k = bgKey(id);
  if (BG.entwuerfe[k]) return BG.entwuerfe[k];
  let e = null;
  try { e = JSON.parse(localStorage.getItem(k) || 'null'); } catch (x) {}
  if (!e && BG.fb[id]) e = A.bogenFeedbackEntwurf(BG.fb[id]);
  if (!e) { let von = ''; try { von = localStorage.getItem('bogen-von') || ''; } catch (x) {} e = { von, gemacht: A.gemachtStandard(BG.boegen[id], L.tagKey()), anfang: '', stimmung: '', hinweisblatt: '', dauer: null, uebungen: {}, sonst: '', gesehen: [] }; }
  e.uebungen = e.uebungen || {}; e.gesehen = e.gesehen || [];
  return (BG.entwuerfe[k] = e);
}
function bgSichern(id, e) { e.geaendert = true; try { localStorage.setItem(bgKey(id), JSON.stringify(e)); } catch (x) { BG.meldung = { art: 'fehler', text: 'Der Zwischenstand passt nicht mehr in den Speicher dieses Geräts (zu viele Fotos?). Bitte speichern.' }; } }
function bgHatEntwurf(id) { try { return !!localStorage.getItem(bgKey(id)); } catch (x) { return false; } }
function bgUe(e, nr) { return e.uebungen[nr] || (e.uebungen[nr] = { ergebnis: 'klappt', chips: [], notiz: '', fotos: [] }); }
function bgGesehen(id, nr) { const e = bgEntwurf(id); if (!e.gesehen.includes(nr)) { e.gesehen.push(nr); try { localStorage.setItem(bgKey(id), JSON.stringify(e)); } catch (x) {} } }
async function bgLaden(neu = false) {
  const o = C.nutzer;
  if (BG.laedt || (BG.kind === o && BG.liste && !neu)) return;
  if (BG.kind !== o) Object.assign(BG, { kind: o, liste: null, boegen: {}, fb: {}, bilder: {}, pdf: {}, zeig: {}, entwuerfe: {}, hb: null, hbG: null, hbPdf: {}, hbAlt: {}, hbMeldung: null, fo: null, foG: null, foPdf: {}, foAlt: {}, foMeldung: null, zeit: {} });
  BG.laedt = true; BG.fehler = null; zeichne();
  try {
    const [ordner, fbs] = await Promise.all([U.ordnerLesen(C, `daten/${o}/boegen`), U.ordnerLesen(C, `daten/${o}/bogen-feedback`)]);
    const ids = ordner.filter(x => x.type === 'dir').map(x => x.name);
    const fbIds = fbs.filter(x => x.type === 'file' && x.name.endsWith('.json') && !x.name.endsWith('.zeit.json')).map(x => x.name.slice(0, -5));
    const zeitIds = fbs.filter(x => x.type === 'file' && x.name.endsWith('.zeit.json')).map(x => x.name.slice(0, -10));
    await Promise.all([
      ...ids.filter(id => neu || !BG.boegen[id]).map(id => U.dateiLesen(C, `daten/${o}/boegen/${id}/bogen.json`).then(b => { BG.boegen[id] = A.bogenNorm(b); }).catch(() => { BG.boegen[id] = null; })),
      ...fbIds.map(id => U.dateiLesen(C, `daten/${o}/bogen-feedback/${id}.json`).then(x => { BG.fb[id] = x; }).catch(() => {})),
      ...zeitIds.map(id => U.dateiLesen(C, ZEIT(o, id)).then(x => { BG.zeit[id] = A.zeitNorm(x); }).catch(() => {})),
      hbLaden(o), foLaden(o)
    ]);
    const lokal = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(`bogen-fb:${o}:`)) lokal.push(k.split(':').slice(2).join(':')); } } catch (x) {}
    BG.liste = [...new Set([...ids, ...fbIds, ...lokal])].map(id => ({ id, ordner: ids.includes(id), fertig: fbIds.includes(id) }));
  } catch (e) { BG.fehler = e.message || 'Laden hat nicht geklappt.'; }
  BG.laedt = false; zeichne();
}
// ---------- Hinweisblatt zum Ausdrucken (Auftrag 26) ----------
// daten/<name>/hinweisblatt/: hinweisblatt.json, PDFs und Seitenbilder schreibt der Kinder-Chat.
// gedruckt.json schreibt nur die Eltern-App (Haken je Seite, gilt für beide Eltern).
const HB = (o) => `daten/${o}/hinweisblatt`;
const jetztLokal = () => { const d = new Date(), off = -d.getTimezoneOffset(), p = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0'); return new Date(d.getTime() + off * 60000).toISOString().slice(0, 19) + (off >= 0 ? '+' : '-') + p(off / 60) + ':' + p(off % 60); };
const hbVon = () => { const std = C.nur ? 'Großeltern' : 'Eltern'; try { return localStorage.getItem('bogen-von') || std; } catch (x) { return std; } };
async function hbLaden(o) {
  try {
    BG.hb = A.hinweisNorm(await U.dateiLesen(C, `${HB(o)}/hinweisblatt.json`));
    if (!BG.hb) return;
    const g = await U.dateiLesen(C, `${HB(o)}/gedruckt.json`);
    if (g) { BG.hbG = A.gedrucktNorm(g); return; }
    // Erster Start: Stand 23.10. gilt für alle Seiten als gedruckt
    const start = A.gedrucktStart(BG.hb, 'Eltern-App (Start)', jetztLokal());
    BG.hbG = start;
    await U.dateiSchreiben(C, `${HB(o)}/gedruckt.json`, JSON.stringify(start, null, 1), `${ordnerName(o)}: Hinweisblatt gedruckt.json angelegt`);
  } catch (e) { if (!BG.hb) BG.hb = null; }
}
const hbNeu = () => A.hinweisNeu(BG.hb, BG.hbG);
const hbFuerBogen = (id) => { const b = BG.boegen[id]; return b && b.hinweisblatt ? A.hinweisFuerBogen(BG.hb, BG.hbG, b.hinweisblatt) : []; };
const hbSeitenText = (l) => l.length === 1 ? `Seite ${l[0].nr}` : `Seiten ${l.map(s => s.nr).join(', ').replace(/, (\d+)$/, ' und $1')}`;
const hbAktuell = (s) => !A.hinweisNeu({ seiten: [s] }, BG.hbG).length;
// PDFs laden: hinweisblatt.pdf und seite-n.pdf, zusammengesetzte PDFs je Seitenliste
function hbPdf(datei) {
  if (!datei) return 'fehlt';
  if (BG.hbPdf[datei] === undefined) {
    BG.hbPdf[datei] = null;
    U.dateiBlob(C, `${HB(C.nutzer)}/${datei}`).then(x => { BG.hbPdf[datei] = x || 'fehlt'; zeichne(); }).catch(() => { BG.hbPdf[datei] = 'fehlt'; zeichne(); });
  }
  return BG.hbPdf[datei];
}
// Dateien für eine Seitenliste: ein Blob (eine Seite oder zusammengesetzt), sonst mehrere einzelne. null: lädt noch.
function hbDateien(seiten) {
  if (!BG.hb) return null;
  const alle = seiten.length === BG.hb.seiten.length;
  if (alle && BG.hb.pdf) { const b = hbPdf(BG.hb.pdf); if (b && b !== 'fehlt') return [{ blob: b, name: 'Hinweisblatt.pdf' }]; if (!b) return null; }
  const einzeln = seiten.map(s => ({ s, blob: hbPdf(s.pdf) }));
  if (einzeln.some(x => !x.blob)) return null;
  const da = einzeln.filter(x => x.blob !== 'fehlt');
  if (!da.length) return 'fehlt';
  const name = `Hinweisblatt ${hbSeitenText(da.map(x => x.s))}.pdf`;
  if (da.length === 1) return [{ blob: da[0].blob, name }];
  const k = 'zus:' + da.map(x => x.s.nr).join(',');
  if (BG.hbPdf[k] === undefined) {
    BG.hbPdf[k] = null;
    Promise.all(da.map(x => x.blob.arrayBuffer())).then(l => { const u = pdfsZusammen(l.map(b => new Uint8Array(b))); BG.hbPdf[k] = u ? new Blob([u], { type: 'application/pdf' }) : 'einzeln'; zeichne(); }).catch(() => { BG.hbPdf[k] = 'einzeln'; zeichne(); });
  }
  const z = BG.hbPdf[k];
  if (!z) return null;
  return z === 'einzeln' ? da.map(x => ({ blob: x.blob, name: `Hinweisblatt Seite ${x.s.nr}.pdf` })) : [{ blob: z, name }];
}
function pdfTeilen(liste) {
  const files = liste.map(x => new File([x.blob], x.name, { type: 'application/pdf' }));
  if (navigator.canShare && navigator.canShare({ files })) { navigator.share({ files, title: files[0].name }).catch(() => {}); return; }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const fenster = window.open(url, '_blank');
    if (!fenster) { const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); }
  }
}
function hbDrucken(welche) {
  if (!BG.hb) return;
  const seiten = welche === 'alle' ? BG.hb.seiten : welche === 'neu' ? hbNeu() : BG.hb.seiten.filter(s => String(welche).split(',').includes(String(s.nr)));
  const d = seiten.length ? hbDateien(seiten) : null;
  if (Array.isArray(d)) pdfTeilen(d);
}
function hbKnopf(welche, seiten, text, extra = '') {
  const d = seiten.length ? hbDateien(seiten) : 'fehlt';
  return `<button class="bg-pdf-knopf ${extra}" data-act="hbDrucken" data-w="${esc(welche)}"${d === 'fehlt' ? ' disabled' : ''}>${text}${!d ? ' <span class="klein">(lädt …)</span>' : d === 'fehlt' ? ' <span class="klein">(fehlt)</span>' : ''}</button>`;
}
// Warnung oben in der Liste (kurz) oder auf der Seite (mit Grund je Seite)
function hbWarnung(kurz) {
  const neu = hbNeu();
  if (!neu.length) return '';
  hbDateien(neu);
  return `<div class="hb-warn"><b>Hinweisblatt: ${hbSeitenText(neu)} ${neu.length === 1 ? 'ist' : 'sind'} neu</b>
    ${kurz ? '' : neu.map(s => `<span class="hb-grund">Seite ${s.nr}, ${esc(datumKurz(s.geaendert))}: ${esc(s.aenderung || 'geändert')}</span>`).join('')}
    <button class="knopf hb-warn-knopf" data-act="hbWarnDrucken">${neu.length === 1 ? `Seite ${neu[0].nr} drucken` : 'Geänderte Seiten drucken'}</button></div>`;
}
function hbZeile(gewaehlt) {
  if (!BG.hb) return '';
  const n = hbNeu().length;
  return `<a class="zeile bg-zeile${gewaehlt ? ' gewaehlt' : ''}" href="#boegen/hinweisblatt">
    <span class="zeile-haupt"><b>Hinweisblatt</b><span class="klein gedaempft block">${BG.hb.seiten.length} Seiten${BG.hb.stand ? ' · Stand ' + esc(datumKurz(BG.hb.stand)) : ''}</span></span>
    <span class="bg-pdfi" title="PDF zum Ausdrucken">PDF</span><span class="bg-pill ${n ? 'warn' : 'fertig'}">${n ? 'neu' : 'aktuell'}</span></a>`;
}
function hbBild(s) {
  if (!s.bild) return 'fehlt';
  const k = 'hb:' + s.bild;
  if (BG.bilder[k] === undefined) {
    BG.bilder[k] = null;
    U.dateiBlob(C, `${HB(C.nutzer)}/${s.bild}`).then(x => { BG.bilder[k] = x ? URL.createObjectURL(x) : 'fehlt'; zeichne(); }).catch(() => { BG.bilder[k] = 'fehlt'; zeichne(); });
  }
  return BG.bilder[k];
}
function hinweisSeite(breitAn) {
  if (!BG.hb) return `${breitAn ? '<h1>Hinweisblatt</h1>' : '<a class="zurueck" href="#boegen">‹ Bögen</a><h1>Hinweisblatt</h1>'}<p class="gedaempft pad">${BG.laedt ? 'Wird geladen …' : 'Noch kein Hinweisblatt. Es erscheint, sobald Claude es im Kinder-Chat ablegt.'}</p>`;
  const neu = hbNeu(), z = BG.hbG && BG.hbG.zuletzt;
  const seiten = BG.hb.seiten.map(s => { const src = hbBild(s), ok = hbAktuell(s); return `<figure class="hb-seite${ok ? '' : ' neu'}">${src && src !== 'fehlt' ? `<img src="${src}" data-act="bgGross" alt="Hinweisblatt Seite ${s.nr}" title="Antippen: groß anzeigen">` : `<span class="hb-platz klein gedaempft">${src === 'fehlt' ? 'Kein Bild' : 'Lädt …'}</span>`}
    <figcaption><b>Seite ${s.nr}</b><span class="klein gedaempft">${esc(s.inhalt || '')}</span>${ok ? `<span class="bg-pill fertig">gedruckt ${esc(datumKurz((BG.hbG && BG.hbG.seiten[s.nr]) || ''))}</span>` : `<span class="bg-pill warn">neu seit ${esc(datumKurz(s.geaendert))}</span>`}</figcaption></figure>`; }).join('');
  const haken = BG.hb.seiten.map(s => { const ok = hbAktuell(s); return `<button class="hb-haken" data-act="hbHaken" data-nr="${s.nr}" aria-pressed="${ok}"${BG.hbSchreibt ? ' disabled' : ''}><span class="hb-box">${ok ? '✓' : ''}</span>Seite ${s.nr} ist gedruckt (Stand ${esc(datumKurz(s.geaendert))})</button>`; }).join('');
  const knoepfe = `${neu.length ? hbKnopf('neu', neu, `Nur geänderte Seite${neu.length > 1 ? 'n' : ''} · PDF`, 'warn') : ''}${hbKnopf('alle', BG.hb.seiten, `Alle ${BG.hb.seiten.length} Seiten · PDF`)}`;
  return `${breitAn ? `<div class="bg-kopf"><div><h1>Hinweisblatt</h1><span class="klein gedaempft">${BG.hb.stand ? 'Stand ' + esc(datumKurz(BG.hb.stand)) + ' · ' : ''}${BG.hb.seiten.length} Seiten</span></div></div>` : `<a class="zurueck" href="#boegen">‹ Bögen</a><h1>Hinweisblatt</h1><span class="klein gedaempft">${BG.hb.stand ? 'Stand ' + esc(datumKurz(BG.hb.stand)) + ' · ' : ''}${BG.hb.seiten.length} Seiten</span>`}
    ${hbWarnung(false)}
    <div class="hb-seiten">${seiten}</div>
    <div class="bg-pdf"><span class="bg-pdf-titel">Zum Ausdrucken</span>${knoepfe}</div>
    <h2 class="abschnitt">Nach dem Drucken abhaken</h2>
    <div class="hb-haken-liste">${haken}</div>
    ${BG.hbMeldung ? `<p class="meldung ${BG.hbMeldung.art}">${esc(BG.hbMeldung.text)}</p>` : ''}
    <p class="klein gedaempft">Der Haken gilt für beide Eltern.${z && z.am && z.von && !/Start/.test(z.von) ? ` Zuletzt: ${esc(z.von)}, ${esc(datumKurz(String(z.am).slice(0, 10)))}.` : ''} Das PDF zu öffnen setzt noch keinen Haken.</p>`;
}
async function hbHaken(nr) {
  const o = C.nutzer, s = BG.hb && BG.hb.seiten.find(x => x.nr === +nr);
  if (!s || BG.hbSchreibt) return;
  const an = !hbAktuell(s);
  BG.hbSchreibt = true; BG.hbMeldung = null; zeichne();
  try {
    const frisch = A.gedrucktNorm(await U.dateiLesen(C, `${HB(o)}/gedruckt.json`)) || BG.hbG;
    if (an) BG.hbAlt[s.nr] = (frisch && frisch.seiten[s.nr]) || '';
    const neu = A.gedrucktSetzen(frisch, BG.hb, s.nr, an, hbVon(), jetztLokal(), BG.hbAlt[s.nr] || A.HINWEIS_START);
    await U.dateiSchreiben(C, `${HB(o)}/gedruckt.json`, JSON.stringify(neu, null, 1), `${ordnerName(o)}: Hinweisblatt Seite ${s.nr} ${an ? 'gedruckt' : 'doch nicht gedruckt'}`);
    BG.hbG = neu;
  } catch (e) { BG.hbMeldung = { art: 'fehler', text: e.message || 'Speichern hat nicht geklappt.' }; }
  BG.hbSchreibt = false; zeichne();
}
// Im Bogen: braucht er einen neueren Stand als gedruckt?
function hbBogenBox(id) {
  const l = hbFuerBogen(id);
  if (!l.length) return '';
  hbDateien(l);
  return `<div class="hb-warn"><b>Erst Hinweisblatt ${hbSeitenText(l)} neu drucken</b>${l.map(s => `<span class="hb-grund">Neu auf Seite ${s.nr}: ${esc(s.aenderung || 'geändert')}</span>`).join('')}
    <button class="knopf hb-warn-knopf" data-act="hbDrucken" data-w="${l.map(s => s.nr).join(',')}">${l.length === 1 ? `Seite ${l[0].nr} drucken` : 'Geänderte Seiten drucken'}</button></div>`;
}
// ---------- Formelübersicht zum Ausdrucken (Auftrag 31) ----------
// daten/<name>/formelblatt/: formelblatt.json, PDFs und Seitenbilder schreibt der Kinder-Chat.
// gedruckt.json (fassungen {id: datum}) schreibt nur die Eltern-App. Ohne gedruckt.json gilt keine Fassung als gedruckt.
const FO = (o) => `daten/${o}/formelblatt`;
async function foLaden(o) {
  try {
    BG.fo = A.formelNorm(await U.dateiLesen(C, `${FO(o)}/formelblatt.json`));
    if (BG.fo) BG.foG = A.formelGedrucktNorm(await U.dateiLesen(C, `${FO(o)}/gedruckt.json`).catch(() => null));
  } catch (e) { BG.fo = null; }
}
const foNeu = () => A.formelNeu(BG.fo, BG.foG);
const foAktuell = (x) => !A.formelNeu({ fassungen: [x] }, BG.foG).length;
function foPdf(datei) {
  if (!datei) return 'fehlt';
  if (BG.foPdf[datei] === undefined) {
    BG.foPdf[datei] = null;
    U.dateiBlob(C, `${FO(C.nutzer)}/${datei}`).then(x => { BG.foPdf[datei] = x || 'fehlt'; zeichne(); }).catch(() => { BG.foPdf[datei] = 'fehlt'; zeichne(); });
  }
  return BG.foPdf[datei];
}
function foBild(pfad) {
  const k = 'fo:' + pfad;
  if (BG.bilder[k] === undefined) {
    BG.bilder[k] = null;
    U.dateiBlob(C, `${FO(C.nutzer)}/${pfad}`).then(x => { BG.bilder[k] = x ? URL.createObjectURL(x) : 'fehlt'; zeichne(); }).catch(() => { BG.bilder[k] = 'fehlt'; zeichne(); });
  }
  return BG.bilder[k];
}
function foKnopf(x, text, extra = '') {
  const d = foPdf(x.pdf);
  return `<button class="bg-pdf-knopf ${extra}" data-act="foDrucken" data-id="${esc(x.id)}"${d === 'fehlt' ? ' disabled' : ''}>${text}${!d ? ' <span class="klein">(lädt …)</span>' : d === 'fehlt' ? ' <span class="klein">(fehlt)</span>' : ''}</button>`;
}
function foDrucken(id) {
  const x = BG.fo && BG.fo.fassungen.find(y => y.id === id), b = x && foPdf(x.pdf);
  if (b && b !== 'fehlt') pdfTeilen([{ blob: b, name: `${String(x.titel).replace(/\s*·\s*/g, ' ')}.pdf` }]);
}
const foNamen = (l) => l.map(x => `„${String(x.titel).split(' · ').slice(-1)[0]}“`).join(' und ');
function foWarnung(kurz) {
  const neu = foNeu();
  if (!neu.length) return '';
  const nie = neu.every(x => !(BG.foG && BG.foG.fassungen[x.id]));
  return `<div class="hb-warn"><b>Formelübersicht: ${nie ? 'noch nicht gedruckt' : `${foNamen(neu)} ${neu.length === 1 ? 'ist' : 'sind'} neu`}</b>
    ${kurz ? '' : neu.map(x => `<span class="hb-grund">${esc(String(x.titel).split(' · ').slice(-1)[0])}, ${esc(datumKurz(x.geaendert))}: ${esc(x.aenderung || 'geändert')}</span>`).join('')}
    ${kurz ? '<a class="knopf hb-warn-knopf" href="#boegen/formelblatt">Ansehen und drucken</a>' : ''}</div>`;
}
function foZeile(gewaehlt) {
  if (!BG.fo) return '';
  const n = foNeu().length;
  return `<a class="zeile bg-zeile${gewaehlt ? ' gewaehlt' : ''}" href="#boegen/formelblatt">
    <span class="zeile-haupt"><b>Formelübersicht</b><span class="klein gedaempft block">${BG.fo.fassungen.length} Fassungen${BG.fo.stand ? ' · Stand ' + esc(datumKurz(BG.fo.stand)) : ''}</span></span>
    <span class="bg-pdfi" title="PDF zum Ausdrucken">PDF</span><span class="bg-pill ${n ? 'warn' : 'fertig'}">${n ? 'neu' : 'aktuell'}</span></a>`;
}
function formelSeite(breitAn) {
  const kopf = (unter) => breitAn ? `<div class="bg-kopf"><div><h1>Formelübersicht</h1>${unter}</div></div>` : `<a class="zurueck" href="#boegen">‹ Bögen</a><h1>Formelübersicht</h1>${unter}`;
  if (!BG.fo) return kopf('') + `<p class="gedaempft pad">${BG.laedt ? 'Wird geladen …' : 'Noch keine Formelübersicht. Sie erscheint, sobald Claude sie im Kinder-Chat ablegt.'}</p>`;
  const z = BG.foG && BG.foG.zuletzt;
  const fassung = (x) => {
    const ok = foAktuell(x), gedr = BG.foG && BG.foG.fassungen[x.id];
    const bilder = x.bilder.map((p, i) => { const src = foBild(p); return `<figure class="hb-seite${ok ? '' : ' neu'}">${src && src !== 'fehlt' ? `<img src="${src}" data-act="bgGross" alt="${esc(x.titel)} Seite ${i + 1}" title="Antippen: groß anzeigen">` : `<span class="hb-platz klein gedaempft">${src === 'fehlt' ? 'Kein Bild' : 'Lädt …'}</span>`}<figcaption><span class="klein gedaempft">Seite ${i + 1}</span></figcaption></figure>`; }).join('');
    return `<section class="karte fo-fassung${ok ? '' : ' neu'}"><div class="fo-kopf"><h3 class="bg-h3">${esc(String(x.titel).split(' · ').slice(-1)[0])}</h3>${ok ? `<span class="bg-pill fertig">gedruckt ${esc(datumKurz(gedr || ''))}</span>` : `<span class="bg-pill warn">${gedr ? 'neu seit ' + esc(datumKurz(x.geaendert)) : 'noch nicht gedruckt'}</span>`}</div>
      ${x.beschreibung ? `<p class="klein gedaempft">${esc(x.beschreibung)}</p>` : ''}
      <div class="fo-seiten">${bilder}</div>
      ${foKnopf(x, `${x.bilder.length > 1 ? x.bilder.length + ' Seiten' : 'Drucken'} · PDF`, ok ? '' : 'warn')}
      <button class="hb-haken" data-act="foHaken" data-id="${esc(x.id)}" aria-pressed="${ok}"${BG.foSchreibt ? ' disabled' : ''}><span class="hb-box">${ok ? '✓' : ''}</span>Ist gedruckt (Stand ${esc(datumKurz(x.geaendert))})</button></section>`;
  };
  return `${kopf(`<span class="klein gedaempft">${BG.fo.stand ? 'Stand ' + esc(datumKurz(BG.fo.stand)) + ' · ' : ''}${BG.fo.fassungen.length} Fassungen</span>`)}
    ${foWarnung(false)}
    <div class="fo-fassungen">${BG.fo.fassungen.map(fassung).join('')}</div>
    ${BG.foMeldung ? `<p class="meldung ${BG.foMeldung.art}">${esc(BG.foMeldung.text)}</p>` : ''}
    <p class="klein gedaempft">Der Haken gilt für beide Eltern.${z && z.am && z.von ? ` Zuletzt: ${esc(z.von)}, ${esc(datumKurz(String(z.am).slice(0, 10)))}.` : ''} Das PDF zu öffnen setzt noch keinen Haken. Im Test ist nur das Blatt der Schule erlaubt.</p>`;
}
async function foHaken(id) {
  const o = C.nutzer, x = BG.fo && BG.fo.fassungen.find(y => y.id === id);
  if (!x || BG.foSchreibt) return;
  const an = !foAktuell(x);
  BG.foSchreibt = true; BG.foMeldung = null; zeichne();
  try {
    const frisch = A.formelGedrucktNorm(await U.dateiLesen(C, `${FO(o)}/gedruckt.json`).catch(() => null)) || BG.foG;
    if (an) BG.foAlt[id] = (frisch && frisch.fassungen[id]) || '';
    const neu = A.formelGedrucktSetzen(frisch, BG.fo, id, an, hbVon(), jetztLokal(), BG.foAlt[id] || '');
    await U.dateiSchreiben(C, `${FO(o)}/gedruckt.json`, JSON.stringify(neu, null, 1), `${ordnerName(o)}: Formelübersicht ${id} ${an ? 'gedruckt' : 'doch nicht gedruckt'}`);
    BG.foG = neu;
  } catch (e) { BG.foMeldung = { art: 'fehler', text: e.message || 'Speichern hat nicht geklappt.' }; }
  BG.foSchreibt = false; zeichne();
}
// ---------- Zeit messen (Auftrag 34): bogen-feedback/<id>.zeit.json (bogen-zeit-1), für beide Eltern sichtbar ----------
// Eigene Datei, damit eine laufende Messung nicht wie ein fertiges Feedback aussieht (Übungen ohne Eintrag gelten dort als „klappt“).
const ZEIT = (o, id) => `daten/${o}/bogen-feedback/${id}.zeit.json`;
const VERGESSEN_MS = 3 * 60 * 60 * 1000;
function laufSek(z) {
  if (!z || !z.start) return 0;
  const ende = z.ende ? new Date(z.ende).getTime() : Date.now();
  const pause = (z.pausen || []).reduce((s, [a, b]) => s + Math.max(0, (b ? new Date(b).getTime() : ende) - new Date(a).getTime()), 0);
  return Math.max(0, Math.floor((ende - new Date(z.start).getTime() - pause) / 1000));
}
const uhrText = (sek) => `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
const uhrZeit = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
// In den Entwurf: gemessene Zeit, Dauer vorausgefüllt
function zeitInsFeedback(id, z) {
  const e = bgEntwurf(id), min = A.zeitMinuten(z);
  e.zeit = { quelle: 'knopf', start: z.start, ende: z.ende, pausen: (z.pausen || []).filter(p => p[1]), minuten: min };
  e.dauer = min || null;
  bgSichern(id, e);
}
async function bgZeit(id, art, wert) {
  const o = C.nutzer;
  if (BG.zeitSchreibt) return;
  BG.zeitSchreibt = true; BG.zeitMeldung = null; zeichne();
  try {
    let z = A.zeitNorm(await U.dateiLesen(C, ZEIT(o, id)).catch(() => null));
    const jetzt = jetztLokal();
    if (art === 'start') z = { format: 'bogen-zeit-1', kind: o, bogen: id, laeuft: true, start: jetzt, pausen: [], von: hbVon() };
    else if (!z) throw new Error('Die Messung wurde nicht gefunden. Vielleicht hat das andere Handy sie beendet.');
    else if (art === 'pause' && z.laeuft && !A.zeitPausiert(z)) z.pausen = [...z.pausen, [jetzt, null]];
    else if (art === 'weiter' && A.zeitPausiert(z)) z.pausen = z.pausen.map(p => p[1] ? p : [p[0], jetzt]);
    else if (art === 'fertig' || art === 'ende') {
      let ende = jetzt;
      if (art === 'ende') { const [h, m] = String(wert || '').split(':').map(Number); const d = new Date(z.start); d.setHours(h, m, 0, 0); if (!(d.getTime() > new Date(z.start).getTime())) throw new Error('Bitte eine Uhrzeit nach dem Start eingeben.'); ende = isoLokal(d); }
      z.pausen = z.pausen.map(p => p[1] ? p : [p[0], ende]);
      z.ende = ende; z.laeuft = false;
    } else if (art === 'weg') z = null;
    if (z) { z.geaendert = jetzt; await U.dateiSchreiben(C, ZEIT(o, id), JSON.stringify(z, null, 1), `${ordnerName(o)}: Bogen ${id} Zeit (${art})`); }
    else await U.dateiLoeschen(C, ZEIT(o, id), `${ordnerName(o)}: Bogen ${id} Zeitmessung verworfen`).catch(() => {});
    BG.zeit[id] = z;
    if (z && !z.laeuft && z.ende) { zeitInsFeedback(id, z); if (art === 'fertig' || art === 'ende') { BG.zeitSchreibt = false; location.hash = '#boegen/' + encodeURIComponent(id); return; } }
  } catch (e) { BG.zeitMeldung = { id, text: e.message || 'Speichern hat nicht geklappt.' }; }
  BG.zeitSchreibt = false; zeichne();
}
const isoLokal = (d) => { const off = -d.getTimezoneOffset(), p = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0'); return new Date(d.getTime() + off * 60000).toISOString().slice(0, 19) + (off >= 0 ? '+' : '-') + p(off / 60) + ':' + p(off % 60); };
// Kasten mit Uhr und Knöpfen (beim Bogen und auf der Übersicht)
function zeitBox(id, kompakt = false) {
  const z = BG.zeit[id], fb = BG.fb[id], dis = BG.zeitSchreibt ? ' disabled' : '';
  const meld = BG.zeitMeldung && BG.zeitMeldung.id === id ? `<p class="meldung fehler">${esc(BG.zeitMeldung.text)}</p>` : '';
  if (!z) {
    if (fb) return '';
    return `<div class="bgz bgz-aus${kompakt ? ' kompakt' : ''}"><button class="knopf haupt bgz-start" data-act="bgZeit" data-w="start" data-id="${esc(id)}"${dis}>▶ Bogen beginnt</button>${kompakt ? '' : '<span class="klein gedaempft">Die Uhr misst die Zeit am Bogen. Pausen zählen nicht. Das andere Handy sieht die Messung auch.</span>'}${meld}</div>`;
  }
  if (!z.laeuft) return `<div class="bgz bgz-fertig${kompakt ? ' kompakt' : ''}"><span>⏱ Gemessen: <b>${A.zeitMinuten(z)} Min.</b> <span class="klein gedaempft">${uhrZeit(z.start)}–${uhrZeit(z.ende)}${z.pausen.length ? ` · ${z.pausen.length} ${z.pausen.length === 1 ? 'Pause' : 'Pausen'}` : ''}</span></span>${meld}</div>`;
  const pausiert = A.zeitPausiert(z), alt = Date.now() - new Date(z.start).getTime() > VERGESSEN_MS;
  const frage = alt ? `<div class="bgz-vergessen"><b>Bogen noch offen seit ${uhrZeit(z.start)}. Wann war Schluss?</b><span class="bgz-ende"><input type="time" id="bgz-ende-${esc(id)}" value="${uhrZeit(new Date(new Date(z.start).getTime() + 45 * 60000).toISOString())}"><button class="knopf" data-act="bgZeitEnde" data-id="${esc(id)}"${dis}>Speichern</button></span></div>` : '';
  return `<div class="bgz bgz-an${pausiert ? ' pausiert' : ''}${kompakt ? ' kompakt' : ''}">
    <div class="bgz-kopf"><span class="bgz-uhr" data-bgz="${esc(id)}">${uhrText(laufSek(z))}</span><span class="klein">${pausiert ? 'Pause' : 'läuft'} · seit ${uhrZeit(z.start)}${z.von ? ' · ' + esc(z.von) : ''}</span></div>
    ${frage}
    <div class="bgz-knoepfe">${pausiert ? `<button class="knopf" data-act="bgZeit" data-w="weiter" data-id="${esc(id)}"${dis}>▶ Weiter</button>` : `<button class="knopf" data-act="bgZeit" data-w="pause" data-id="${esc(id)}"${dis}>⏸ Pause</button>`}
      <button class="knopf haupt" data-act="bgZeit" data-w="fertig" data-id="${esc(id)}"${dis}>■ Bogen fertig</button></div>${meld}</div>`;
}
setInterval(() => { document.querySelectorAll('[data-bgz]').forEach(el => { const z = BG.zeit[el.dataset.bgz]; if (z) el.textContent = uhrText(laufSek(z)); }); }, 1000);

// ---------- Übersicht: Bögen und Übungszeit App / Bogen (Auftrag 34) ----------
// Bogen-Zeit: gemessen oder eingetragen, sonst geschätzt aus App-Zeiten mal Papier-Faktor (nur Anzeige, wird nicht gespeichert)
function bogenZeiten(heute) {
  const jt = A.appJeTeil(D.daten.aufgaben, D.pool, heute);
  const liste = Object.values(BG.boegen).filter(b => b && !b.archiv);
  const paare = liste.map(b => { const g = A.bogenZeitAusFeedback(BG.fb[b.id]); return g ? { gemessen: g.minuten, roh: A.bogenRoh(b, BG.fb[b.id], jt) } : null; }).filter(Boolean);
  const faktor = A.papierFaktor(paare);
  const zeitVon = (b) => {
    const fb = BG.fb[b.id], z = BG.zeit[b.id];
    const g = A.bogenZeitAusFeedback(fb);
    if (g) return { ...g, tag: fb.gemacht || b.datum };
    if (z) return { minuten: A.zeitMinuten(z), quelle: z.laeuft ? 'laeuft' : 'knopf', tag: z.start.slice(0, 10) };
    if (fb) { const roh = A.bogenRoh(b, fb, jt); return roh ? { minuten: A.auf5(roh * faktor), quelle: 'geschaetzt', tag: fb.gemacht || b.datum, roh } : null; }
    return null;
  };
  return { faktor, jt, zeitVon, liste };
}
const QUELLE_TEXT = { knopf: 'gemessen', hand: 'eingetragen', geschaetzt: 'geschätzt', laeuft: 'läuft' };
const minTxt = (m, ca) => `${ca ? 'ca. ' : ''}${Math.round(m)} Min.`;
function ampelHtml(amp) {
  return `<span class="bgk-ampel">${amp.map(u => `<i class="bgk-p a-${u.ergebnis ? A.AMPEL[u.ergebnis] || 'gruen' : 'offen'}" title="Übung ${esc(u.nr)}: ${esc(u.ergebnis || 'offen')}">${u.bonus ? `<b class="bgk-bonus a-${A.AMPEL[u.bonus] || 'offen'}"></b>` : ''}</i>`).join('')}</span>`;
}
function bogenKachel() {
  if (!boegenAn()) return '';
  if (BG.kind !== C.nutzer || (!BG.liste && !BG.laedt && !BG.fehler)) setTimeout(() => bgLaden(), 0);
  if (!BG.liste) return `<section class="karte bgk"><div class="karte-kopf"><h2>Bögen</h2></div><p class="klein gedaempft pad">${BG.laedt ? 'Wird geladen …' : ''}</p></section>`;
  const heute = L.tagKey(), woche = A.wocheVon(heute);
  const { zeitVon, liste, faktor } = bogenZeiten(heute);
  const sortiert = liste.slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  const b = sortiert.find(x => x.datum === heute) || sortiert.find(x => x.datum > heute && !BG.fb[x.id]);
  let oben = '<p class="klein gedaempft">Heute ist kein Bogen geplant.</p>';
  if (b) {
    const fb = BG.fb[b.id], z = BG.zeit[b.id], t = zeitVon(b);
    const status = fb ? '<span class="bg-pill fertig">erledigt</span>' : z && z.laeuft ? `<span class="bg-pill halb">${A.zeitPausiert(z) ? 'Pause' : 'läuft seit ' + uhrZeit(z.start)}</span>` : '<span class="bg-pill grau">offen</span>';
    const amp = A.bogenAmpel(b, fb);
    const probleme = fb ? amp.filter(u => u.ergebnis === 'mit Hilfe' || u.ergebnis === 'nicht verstanden') : [];
    oben = `<a class="bgk-heute" href="#boegen/${encodeURIComponent(b.id)}"><span class="bgk-titel"><span class="kachel-label">${b.datum === heute ? 'Heute' : 'Als Nächstes · ' + wochentag(b.datum) + ' ' + datumKurz(b.datum)}</span><b>${esc(bgTitel(b.id))}</b><span class="klein gedaempft">${esc(String(b.titel || '').split(' · ').slice(2).join(' · '))}</span></span>${status}</a>
      ${fb ? `${ampelHtml(amp)}
        <p class="bgk-meta klein">${[fb.anfang ? 'Anfang: ' + fb.anfang : '', fb.stimmung ? 'Stimmung: ' + fb.stimmung : '', fb.hinweisblatt ? 'Hinweisblatt: ' + fb.hinweisblatt : '', t ? `Dauer: <span class="${t.quelle === 'geschaetzt' ? 'gesch' : ''}">${minTxt(t.minuten, t.quelle === 'geschaetzt')}</span> (${QUELLE_TEXT[t.quelle]})` : ''].filter(Boolean).join(' · ')}</p>
        ${probleme.length ? `<div class="bgk-probleme">${probleme.map(u => `<a href="#boegen/${encodeURIComponent(b.id)}/${encodeURIComponent(u.nr)}" class="bgk-pz"><i class="bgk-p a-${A.AMPEL[u.ergebnis]}"></i><span><b>${esc(u.nr)} · ${esc(u.titel)}</b>${u.notiz ? `<span class="klein gedaempft block">${esc(u.notiz.split(/\s+/).slice(0, 10).join(' '))}${u.notiz.split(/\s+/).length > 10 ? ' …' : ''}</span>` : ''}</span><span class="klein">${esc(u.ergebnis)}</span></a>`).join('')}</div>` : ''}` : zeitBox(b.id, true)}`;
  }
  const wb = sortiert.filter(x => woche.includes(x.datum));
  const wZeilen = wb.map(x => { const fb = BG.fb[x.id], t = zeitVon(x);
    return `<a class="bgk-w${fb ? '' : ' offen'}" href="#boegen/${encodeURIComponent(x.id)}"><span class="bgk-wt">${wochentag(x.datum)}</span><span class="bgk-wn">${esc(bgTitel(x.id))}</span>${fb ? ampelHtml(A.bogenAmpel(x, fb)) : `<span class="klein gedaempft">${BG.zeit[x.id] && BG.zeit[x.id].laeuft ? 'läuft' : 'offen'}</span>`}<span class="bgk-wd${t && t.quelle === 'geschaetzt' ? ' gesch' : ''}">${t ? minTxt(t.minuten, t.quelle === 'geschaetzt') : ''}</span></a>`; }).join('');
  return `<section class="karte bgk"><div class="karte-kopf"><h2>Bögen</h2><a class="klein" href="#boegen">Alle Bögen ›</a></div>
    ${oben}
    ${wb.length ? `<h3 class="bgk-h3">Diese Woche</h3><div class="bgk-woche">${wZeilen}</div>` : ''}
    <p class="klein gedaempft bgk-leg"><i class="bgk-p a-gruen"></i> klappt <i class="bgk-p a-gelb"></i> mit Hilfe <i class="bgk-p a-rot"></i> nicht verstanden <i class="bgk-p a-grau"></i> ausgelassen</p></section>`;
}
function uebungszeitKarte() {
  const heute = L.tagKey(), woche = A.wocheVon(heute);
  const app = A.appMinutenJeTag(D.daten.aufgaben);
  const bog = {}, gesch = {};
  let faktor = A.PAPIER_FAKTOR_START;
  if (boegenAn() && BG.liste) {
    const z = bogenZeiten(heute); faktor = z.faktor;
    for (const b of z.liste) { const t = z.zeitVon(b); if (!t || !woche.includes(t.tag)) continue; bog[t.tag] = (bog[t.tag] || 0) + t.minuten; if (t.quelle === 'geschaetzt') gesch[t.tag] = true; }
  }
  const sum = (o, tage) => tage.reduce((s, t) => s + (o[t] || 0), 0);
  const ca = (tage) => tage.some(t => gesch[t]);
  const zeile = (name, tage) => { const a = sum(app, tage), bo = sum(bog, tage), c = ca(tage);
    return `<tr><th>${name}</th><td>${minTxt(a)}</td><td class="${c ? 'gesch' : ''}">${boegenAn() ? minTxt(bo, c) : '–'}</td><td class="${c ? 'gesch' : ''}"><b>${minTxt(a + bo, c)}</b></td></tr>`; };
  const max = Math.max(1, ...woche.map(t => (app[t] || 0) + (bog[t] || 0)));
  const balken = `<div class="uz-balken">${woche.map(t => { const a = app[t] || 0, bo = bog[t] || 0;
    return `<span class="uz-sp${t === heute ? ' heute' : ''}" title="${tagLang(t)}: App ${Math.round(a)} Min., Bogen ${gesch[t] ? 'ca. ' : ''}${Math.round(bo)} Min."><span class="uz-zahl">${a + bo ? Math.round(a + bo) : ''}</span><span class="uz-stapel" style="height:${Math.round((a + bo) / max * 100)}%"><span class="uz-b${gesch[t] ? ' gesch' : ''}" style="flex-grow:${bo}"></span><span class="uz-a" style="flex-grow:${a}"></span></span><span class="uz-tag">${wochentag(t)}</span></span>`; }).join('')}</div>`;
  return `<section class="karte uzk"><div class="karte-kopf"><h2>Übungszeit</h2><span class="legende"><i class="farbe-teal"></i>App</span>${boegenAn() ? '<span class="legende"><i class="farbe-amber"></i>Bogen</span>' : ''}</div>
    <table class="uz-tab"><thead><tr><th></th><th>App</th><th>Bogen</th><th>Zusammen</th></tr></thead><tbody>${zeile('Heute', [heute])}${zeile('Diese Woche', woche)}</tbody></table>
    ${balken}
    ${Object.keys(gesch).length ? `<p class="klein gedaempft">ca. = geschätzt aus App-Zeiten (Faktor ${String(faktor).replace('.', ',')}). Gemessene oder eingetragene Zeiten gehen vor.</p>` : ''}</section>`;
}
function bgTitel(id) { const b = BG.boegen[id]; return b ? (b.woche && b.tag ? `W${b.woche} · Tag ${b.tag}` : b.titel || id) : id.toUpperCase(); }
function bgUntertitel(id) {
  const b = BG.boegen[id], f = BG.fb[id];
  const teile = [];
  if (b && b.titel) { const t = String(b.titel).split(' · ').slice(2).join(' · '); if (t) teile.push(t); }
  if (b && b.datum) teile.push((b.datum_genau === false ? 'ca. ' : '') + wochentag(b.datum) + ' ' + datumKurz(b.datum));
  if (f && f.von) teile.push(f.von);
  else if (b) teile.push(`${b.uebungen.length} Übungen`);
  if (!b) teile.push(BG.liste && BG.liste.find(x => x.id === id && x.ordner) ? 'Bogen-Datei fehlt' : 'ohne Bogen-Ordner');
  return teile.join(' · ');
}
function bgNummern(id) { const b = BG.boegen[id]; return b ? b.uebungen.map(u => u.nr) : Object.keys(bgEntwurf(id).uebungen); }
function bgZeile(x, gewaehlt) {
  const b = BG.boegen[x.id], n = b ? b.uebungen.length : 0;
  const entwurf = bgHatEntwurf(x.id);
  const g = entwurf ? bgEntwurf(x.id).gesehen.filter(nr => !b || b.uebungen.some(u => u.nr === nr)).length : 0;
  const hbFehlt = !x.fertig && hbFuerBogen(x.id).length;
  const pill = b && b.archiv && !x.fertig && !entwurf ? '<span class="bg-pill grau" title="Alter Bogen: ansehen und drucken, ohne Feedback">Archiv</span>' : hbFehlt ? '<span class="bg-pill warn" title="Erst Hinweisblatt neu drucken">⚠ Hinweis</span>' : x.fertig && !entwurf ? '<span class="bg-pill fertig">fertig</span>' : entwurf && n ? `<span class="bg-pill halb">${g} von ${n}</span>` : entwurf ? '<span class="bg-pill halb">angefangen</span>' : '';
  return `<a class="zeile bg-zeile${gewaehlt ? ' gewaehlt' : ''}${!x.fertig && !entwurf && x.ordner && !(b && b.archiv) ? ' neu' : ''}" href="#boegen/${encodeURIComponent(x.id)}">
    <span class="zeile-haupt"><b>${esc(bgTitel(x.id))}</b><span class="klein gedaempft block">${esc(bgUntertitel(x.id))}</span></span>
    ${b && b.pdf ? '<span class="bg-pdfi" title="PDF zum Ausdrucken">PDF</span>' : ''}${pill}</a>`;
}
const bgArchiv = (id) => !!(BG.boegen[id] && BG.boegen[id].archiv);
// Liste: Warnungen, Offen (neue Bögen ohne Feedback), Immer da (Hinweisblatt, Formelübersicht), dann alle übrigen Bögen nach Wochen (neueste oben)
function bgListe(gewaehlt) {
  const l = BG.liste || [];
  const offen = l.filter(x => (!x.fertig && !bgArchiv(x.id)) || bgHatEntwurf(x.id));
  const rest = l.filter(x => !offen.includes(x));
  const datum = (x) => String((BG.boegen[x.id] || {}).datum || x.id);
  offen.sort((a, b) => datum(b).localeCompare(datum(a)));
  const immer = hbZeile(gewaehlt === 'hinweisblatt') + foZeile(gewaehlt === 'formelblatt');
  const wochen = A.bogenWochen(rest, BG.boegen);
  return `${BG.fehler ? `<p class="hinweis-box">${esc(BG.fehler)}</p>` : ''}
    ${hbWarnung(true)}${foWarnung(true)}
    ${BG.laedt && !BG.liste ? '<p class="gedaempft pad">Bögen werden geladen …</p>' : ''}
    ${BG.liste && !l.length ? '<p class="gedaempft pad">Noch keine Bögen. Sie erscheinen, sobald Claude sie im Kinder-Chat anlegt.</p>' : ''}
    ${offen.length ? `<h2 class="abschnitt">Offen</h2><section class="karte liste-karte">${offen.map(x => bgZeile(x, x.id === gewaehlt)).join('')}</section>` : ''}
    ${immer ? `<h2 class="abschnitt">Immer da</h2><section class="karte liste-karte">${immer}</section>` : ''}
    ${wochen.map((g, i) => { const auf = BG.wochenAuf[g.woche] !== undefined ? BG.wochenAuf[g.woche] : i < 2 || g.eintraege.some(x => x.id === gewaehlt);
      return `<details class="bg-woche" data-woche="${g.woche}"${auf ? ' open' : ''}><summary class="abschnitt bg-woche-kopf"><span>${g.woche ? 'Woche ' + g.woche : 'Ohne Woche'}</span><span class="klein gedaempft">${g.eintraege.length} ${g.eintraege.length === 1 ? 'Bogen' : 'Bögen'}</span></summary><section class="karte liste-karte">${g.eintraege.map(x => bgZeile(x, x.id === gewaehlt)).join('')}</section></details>`; }).join('')}
    <details class="bg-frei"><summary>Feedback ohne Bogen-Ordner</summary><p class="klein gedaempft">Für einen Bogen, den Claude nicht angelegt hat: Allgemein und je Übungsnummer Ergebnis und Notiz.</p>
      <div class="bg-frei-form"><input id="bg-frei-id" placeholder="Kürzel, z. B. w6t1" autocomplete="off"><button class="knopf" data-act="bgFrei">Anlegen</button></div></details>
    <button class="knopf bg-neu-laden" data-act="bgNeuLaden">${BG.laedt ? 'Lädt …' : 'Neu laden'}</button>
    ${C.nur ? `<section class="karte klein-karte nur-karte"><p class="klein">Dieses Gerät zeigt nur die Bögen von ${esc(name())}. Version ${ELTERN_VERSION}.</p><button class="knopf-text" data-act="abmelden">Zugang von diesem Gerät löschen</button></section>` : ''}`;
}
function boegenSeite() {
  if (!boegenAn()) return `<div class="seite">${breit.matches ? '<h1>Bögen</h1>' : kopfSchmal('Bögen')}<section class="karte"><p class="pad">Der Bereich „Bögen“ ist für ${esc(name())} aus. Einschalten unter Einstellungen → Gestaltung, Bedienung und Übungszeit.</p></section></div>`;
  if (BG.kind !== C.nutzer || (!BG.liste && !BG.laedt && !BG.fehler)) setTimeout(() => bgLaden(), 0);
  const [id, schritt] = route.arg ? route.arg.split('/') : ['', ''];
  if (breit.matches) {
    return `<div class="bg-breit"><aside class="bg-seite-liste"><h1>Bögen</h1>${bgListe(id)}</aside>
      <section class="bg-haupt">${id === 'hinweisblatt' ? hinweisSeite(true) : id === 'formelblatt' ? formelSeite(true) : !id ? '<p class="gedaempft pad">Wähle links einen Bogen.</p>' : bgArchiv(id) ? bogenArchiv(id) : !schritt ? bogenAllgemein(id) : schritt === 'ende' ? bogenEnde(id) : bogenKarte(id, schritt)}</section></div>`;
  }
  if (id === 'hinweisblatt') return `<div class="seite schmal-inhalt bg-schritt">${hinweisSeite(false)}</div>`;
  if (id === 'formelblatt') return `<div class="seite schmal-inhalt bg-schritt">${formelSeite(false)}</div>`;
  if (bgArchiv(id)) return bogenArchiv(id);
  if (!id) return `<div class="seite schmal-inhalt">${kopfSchmal('Bögen')}<p class="klein gedaempft">${esc(name())} · Bögen ausdrucken und Feedback eintragen</p>${bgListe('')}</div>`;
  if (!schritt) return bogenAllgemein(id);
  if (schritt === 'ende') return bogenEnde(id);
  return bogenKarte(id, schritt);
}
function bgPdfLeiste(id) {
  const b = BG.boegen[id];
  if (!b || !b.pdf) return '';
  bgPdfLaden(id);
  const k = (w) => BG.pdf[id + ':' + w];
  const knopf = (w, t) => b.pdf[w] ? `<button class="bg-pdf-knopf" data-act="bgPdf" data-id="${esc(id)}" data-w="${w}"${k(w) === 'fehlt' ? ' disabled' : ''}>${t} · PDF${!k(w) ? ' <span class="klein">(lädt …)</span>' : k(w) === 'fehlt' ? ' <span class="klein">(fehlt)</span>' : ''}</button>` : '';
  const hl = hbFuerBogen(id);
  const hk = BG.hb && !b.archiv ? (hl.length ? hbKnopf(hl.map(s => s.nr).join(','), hl, 'Hinweisblatt · ⚠ neu', 'zweit warn-rand') : hbKnopf('alle', BG.hb.seiten, 'Hinweisblatt · aktuell', 'zweit')) : '';
  const mitLoes = A.bogenHatBilder(b, 'loes');
  const ansehen = A.bogenHatBilder(b, 'auf') ? `<div class="bg-ansehen"><span class="bg-pdf-titel">In der App ansehen</span><button class="knopf" data-act="bgAnsicht" data-id="${esc(id)}" data-w="auf">Aufgaben</button>${mitLoes ? `<button class="knopf" data-act="bgAnsicht" data-id="${esc(id)}" data-w="loes">Lösungen</button>` : '<span class="klein gedaempft bg-nur-pdf">Lösungen nur als PDF</span>'}</div>` : '';
  return `${hbBogenBox(id)}${ansehen}<div class="bg-pdf"><span class="bg-pdf-titel">Zum Ausdrucken</span>${knopf('aufgaben', 'Aufgaben')}${knopf('loesungen', 'Lösungen')}${hk}</div>`;
}
function bgPdfLaden(id) {
  const b = BG.boegen[id]; if (!b || !b.pdf) return;
  for (const w of ['aufgaben', 'loesungen']) {
    const k = id + ':' + w;
    if (!b.pdf[w] || BG.pdf[k] !== undefined) continue;
    BG.pdf[k] = null;
    U.dateiBlob(C, `daten/${C.nutzer}/boegen/${id}/${b.pdf[w]}`).then(x => { BG.pdf[k] = x || 'fehlt'; zeichne(); }).catch(() => { BG.pdf[k] = 'fehlt'; zeichne(); });
  }
}
// PDF teilen (iOS: Teilen-Menü mit Drucken, AirPrint), sonst in einem neuen Fenster öffnen
function bgPdfTeilen(id, w) {
  const blob = BG.pdf[id + ':' + w];
  if (!blob || blob === 'fehlt') return;
  const name = `${bgTitel(id).replace(' · ', ' ')} ${w === 'aufgaben' ? 'Aufgaben' : 'Lösungen'}.pdf`;
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(() => {}); return; }
  const url = URL.createObjectURL(file);
  const fenster = window.open(url, '_blank');
  if (!fenster) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
}
function bgBild(id, pfad) {
  const k = id + ':' + pfad;
  if (BG.bilder[k] === undefined) {
    BG.bilder[k] = null;
    U.dateiBlob(C, `daten/${C.nutzer}/boegen/${id}/${pfad}`).then(x => { BG.bilder[k] = x ? URL.createObjectURL(x) : 'fehlt'; zeichne(); }).catch(() => { BG.bilder[k] = 'fehlt'; zeichne(); });
  }
  return BG.bilder[k];
}
function bgSeg(id, k, werte, aktuell, text = (v) => v, spalten = werte.length) {
  return `<div class="bg-seg" style="grid-template-columns:repeat(${spalten},minmax(0,1fr))" role="group">${werte.map(v => `<button data-act="bgWert" data-id="${esc(id)}" data-k="${k}" data-v="${esc(v)}" aria-pressed="${aktuell === v}">${esc(text(v))}</button>`).join('')}</div>`;
}
// keys: welche allgemeinen Fragen (Anfang: von, anfang + Datum; Ende: stimmung, hinweisblatt, dauer)
function bgAllgemeinFelder(id, e, keys = A.BOGEN_ANFANG, mitDatum = true) {
  return A.BOGEN_ALLGEMEIN.filter(f => keys.includes(f.k)).map(f => f.k === 'dauer' ? dauerFeld(id, e) : `<div class="bg-gruppe"><span class="bg-lbl">${esc(f.titel)}${f.frei ? ' <span class="klein gedaempft">(optional)</span>' : ''}</span>${bgSeg(id, f.k, f.werte, e[f.k], f.text)}</div>`).join('') +
    (mitDatum ? `<div class="bg-gruppe"><span class="bg-lbl">Gemacht am</span><input type="date" id="bg-gemacht" data-id="${esc(id)}" value="${esc(e.gemacht || L.tagKey())}" max="${L.tagKey()}"></div>` : '');
}
// Dauer (Auftrag 34): gemessen vorausgefüllt, sonst Zahlenfeld in Minuten und die schnellen Stufen
function dauerFeld(id, e) {
  const f = A.BOGEN_ALLGEMEIN.find(x => x.k === 'dauer'), z = e.zeit;
  const info = z && z.quelle === 'knopf' && z.start && z.ende ? `<span class="klein gedaempft">Gemessen ${uhrZeit(z.start)}–${uhrZeit(z.ende)}${(z.pausen || []).length ? ', ohne Pausen' : ''}. Du kannst die Minuten ändern.</span>` : '';
  return `<div class="bg-gruppe bg-dauer"><span class="bg-lbl">Dauer <span class="klein gedaempft">(Minuten am Bogen, optional)</span></span>
    <span class="bg-dauer-zeile"><input type="number" inputmode="numeric" min="1" max="300" class="bg-dauer-feld" data-id="${esc(id)}" value="${e.dauer || ''}" placeholder="z. B. 35"><span>Min.</span></span>
    ${bgSeg(id, 'dauer', f.werte, e.dauer, f.text)}${info}</div>`;
}
function dauerSetzen(e, min) {
  e.dauer = min > 0 ? Math.round(min) : null;
  if (!e.dauer) e.zeit = null;
  else if (!(e.zeit && e.zeit.quelle === 'knopf' && e.zeit.minuten === e.dauer)) e.zeit = { ...(e.zeit || {}), quelle: 'hand', minuten: e.dauer };
}
function bgUeInfo(id, nr) { const b = BG.boegen[id]; return b ? b.uebungen.find(u => u.nr === nr) : { nr, titel: '' }; }
// Stand einer Übung für die Leiste: offen (noch nicht angesehen, nichts eingetragen) oder das Ergebnis
function bgUeStand(id, nr) {
  const e = bgEntwurf(id), u = e.uebungen[nr];
  if (!u || (!e.gesehen.includes(nr) && u.ergebnis === 'klappt' && !u.chips.length && !u.notiz && !(u.fotos || []).length && !u.bonus)) return 'offen';
  return u.ergebnis;
}
// Leiste mit allen Übungen: antippen springt, Farbe nach Ergebnis
function bgLeiste(id, aktiv) {
  const nrn = bgNummern(id);
  if (!nrn.length) return '';
  return `<nav class="bg-leiste" aria-label="Übungen">${nrn.map(n => `<a href="#boegen/${encodeURIComponent(id)}/${encodeURIComponent(n)}" class="bg-l" data-stand="${esc(bgUeStand(id, n))}"${n === aktiv ? ' aria-current="true"' : ''} title="Übung ${esc(n)}: ${esc(bgUeStand(id, n))}">${esc(n)}</a>`).join('')}
    <a href="#boegen/${encodeURIComponent(id)}/ende" class="bg-l bg-l-ende"${aktiv === 'ende' ? ' aria-current="true"' : ''}>Überblick</a></nav>`;
}
function ueKarte(id, nr, kompakt) {
  const e = bgEntwurf(id), u = bgUe(e, nr), x = bgUeInfo(id, nr) || { nr };
  const loesAn = BG.zeig[id + '|' + nr] === 'loes';
  const bild = (w) => { const pfad = x.bilder && x.bilder[w]; if (!pfad) return ''; const src = bgBild(id, pfad);
    return src && src !== 'fehlt' ? `<img class="bg-mini${w === 'loes' ? ' loes' : ''}" data-act="bgGross" src="${src}" alt="${w === 'auf' ? 'Aufgabe' : 'Lösung'} Übung ${esc(nr)}" title="Antippen: groß anzeigen">` : `<span class="bg-mini-platz klein gedaempft">${src === 'fehlt' ? 'Kein Bild' : 'Bild lädt …'}</span>`; };
  const bonus = x.bonusTeile ? `<div class="bg-gruppe bg-bonus"><span class="bg-lbl">Bonus${x.bonusTeile.filter(t => !/^bonus$/i.test(t)).length ? ' (Teil ' + esc(x.bonusTeile.filter(t => !/^bonus$/i.test(t)).join(', ')) + ')' : ''}</span>
      <div class="bg-seg bg-erg" style="grid-template-columns:repeat(3,minmax(0,1fr))" role="group">${A.BOGEN_BONUS.map(v => `<button data-act="bgBonus" data-id="${esc(id)}" data-nr="${esc(nr)}" data-v="${esc(v)}" data-erg="${esc(v)}" aria-pressed="${!!(u.bonus && u.bonus.ergebnis === v)}">${esc(v)}</button>`).join('')}</div>
      <textarea class="bg-text bg-text-klein" data-id="${esc(id)}" data-nr="${esc(nr)}" data-bonus="1" rows="1" placeholder="Notiz zum Bonus (optional)">${esc((u.bonus && u.bonus.notiz) || '')}</textarea></div>` : '';
  const loesKnopf = `<button class="bg-loes-knopf" data-act="bgZeig" data-id="${esc(id)}" data-nr="${esc(nr)}" data-w="loes" aria-pressed="${loesAn}">${loesAn ? 'Lösung ausblenden' : 'Lösung zeigen'}</button>`;
  return `${x.bilder && x.bilder.auf ? `<div class="bg-aufgabe"><div class="bg-a-auf"><span class="bg-a-lbl">Aufgabe</span>${bild('auf')}</div>
    <div class="bg-a-loes${loesAn ? ' an' : ''}">${loesAn ? `<span class="bg-a-lbl">Lösung</span>${bild('loes')}` : ''}${x.bilder.loes ? loesKnopf : ''}</div></div>` : ''}
    <div class="bg-bewertung">${x.neu ? '<div class="bg-neu">Neu auf diesem Bogen. Wie kam es an?</div>' : ''}
    <div class="bg-gruppe bg-erg-gruppe"><span class="bg-lbl">Ergebnis${x.bonusTeile ? ' ohne Bonus' : ''}</span><div class="bg-seg bg-erg" style="grid-template-columns:repeat(2,minmax(0,1fr))" role="group">${A.BOGEN_ERGEBNISSE.map(v => `<button data-act="bgErg" data-id="${esc(id)}" data-nr="${esc(nr)}" data-v="${esc(v)}" data-erg="${esc(v)}" aria-pressed="${u.ergebnis === v}">${esc(v)}</button>`).join('')}</div></div>
    ${bonus}
    <div class="bg-gruppe"><span class="bg-lbl">Beobachtungen</span><div class="bg-chips">${A.BOGEN_CHIPS.map(c => `<button class="bg-chip" data-act="bgChip" data-id="${esc(id)}" data-nr="${esc(nr)}" data-v="${esc(c)}" aria-pressed="${u.chips.includes(c)}">${esc(c)}</button>`).join('')}</div></div>
    <label class="bg-gruppe"><span class="bg-lbl">Notiz</span><textarea class="bg-text" data-id="${esc(id)}" data-nr="${esc(nr)}" rows="${kompakt ? 2 : 3}" placeholder="Was ist dir aufgefallen? Diktieren: Mikrofon auf der Tastatur">${esc(u.notiz || '')}</textarea></label>
    <div class="bg-fotos">${u.fotos.map((p, i) => `<span class="bg-foto-mini">${p.data ? `<img src="${p.data}" alt="Foto ${i + 1}">` : `<span class="klein">Foto ${i + 1} gespeichert</span>`}<button class="bg-foto-weg" data-act="bgFotoWeg" data-id="${esc(id)}" data-nr="${esc(nr)}" data-i="${i}" aria-label="Foto entfernen">✕</button></span>`).join('')}
      <label class="bg-foto-neu">＋ Foto<input type="file" accept="image/*" class="bg-foto" data-id="${esc(id)}" data-nr="${esc(nr)}" hidden></label></div></div>`;
}
function bgSpeichernKnopf(id) {
  return `${BG.meldung ? `<p class="meldung ${BG.meldung.art}">${esc(BG.meldung.text)}</p>` : ''}<button class="knopf haupt breit" data-act="bgSpeichern" data-id="${esc(id)}"${BG.speichert ? ' disabled' : ''}>${BG.speichert ? 'Wird gespeichert …' : 'Speichern und an den Chat geben'}</button>`;
}
function bgFreiNeu(id) { return `<div class="bg-frei-form"><input id="bg-ue-nr" placeholder="Übung, z. B. 3b" autocomplete="off"><button class="knopf" data-act="bgUeNeu" data-id="${esc(id)}">Übung hinzufügen</button></div>`; }
const bgSonst = (id, e) => `<label class="bg-gruppe"><span class="bg-lbl">Sonst noch etwas?</span><textarea class="bg-text" data-id="${esc(id)}" rows="3" placeholder="z. B. Ideen für die App. Diktieren: Mikrofon auf der Tastatur">${esc(e.sonst || '')}</textarea></label>`;
// Archiv (alte Bögen, Auftrag 31): ansehen und drucken, ohne Feedback. Bilder laden erst hier.
function bogenArchiv(id) {
  const b = BG.boegen[id];
  const ue = b.uebungen.map(u => {
    const bild = (w) => { const pfad = u.bilder && u.bilder[w]; if (!pfad) return ''; const src = bgBild(id, pfad);
      return src && src !== 'fehlt' ? `<img class="bg-mini${w === 'loes' ? ' loes' : ''}" data-act="bgGross" src="${src}" alt="${w === 'auf' ? 'Aufgabe' : 'Lösung'} Übung ${esc(u.nr)}" title="Antippen: groß anzeigen">` : `<span class="bg-mini-platz klein gedaempft">${src === 'fehlt' ? 'Kein Bild' : 'Bild lädt …'}</span>`; };
    const an = BG.zeig[id + '|' + u.nr] === 'loes';
    return `<section class="karte bg-arch-ue"><h3 class="bg-h3">Übung ${esc(u.nr)}${u.titel ? ' · ' + esc(u.titel) : ''}</h3>
      ${u.bilder && u.bilder.auf ? `<div class="bg-aufgabe"><div class="bg-a-auf"><span class="bg-a-lbl">Aufgabe</span>${bild('auf')}</div><div class="bg-a-loes${an ? ' an' : ''}">${an ? `<span class="bg-a-lbl">Lösung</span>${bild('loes')}` : ''}${u.bilder.loes ? `<button class="bg-loes-knopf" data-act="bgZeig" data-id="${esc(id)}" data-nr="${esc(u.nr)}" data-w="loes" aria-pressed="${an}">${an ? 'Lösung ausblenden' : 'Lösung zeigen'}</button>` : ''}</div></div>` : '<p class="klein gedaempft">Kein Bild.</p>'}</section>`;
  }).join('');
  return `<div class="seite schmal-inhalt bg-schritt"><a class="zurueck" href="#boegen">‹ Bögen</a><h1>${esc(bgTitel(id))}</h1><span class="klein gedaempft">${esc(bgUntertitel(id))}</span>
    <p class="bg-arch-hinweis"><span class="bg-pill grau">Archiv</span> Alter Bogen zum Ansehen und Drucken. Feedback gibt es hier nicht.${b.datum_genau === false ? ' Das Datum ist ungefähr.' : ''}</p>
    ${bgPdfLeiste(id)}
    <h2 class="abschnitt">Übungen</h2>${ue}${bgAnsichtOverlay(id)}</div>`;
}
// iPhone und iPad: Allgemein → je Übung eine Karte → Überblick
function bogenAllgemein(id) {
  const e = bgEntwurf(id), nrn = bgNummern(id);
  return `<div class="seite schmal-inhalt bg-schritt"><a class="zurueck" href="#boegen">‹ Bögen</a><h1>${esc(bgTitel(id))}</h1><span class="klein gedaempft">${esc(bgUntertitel(id))}</span>
    ${zeitBox(id)}
    ${bgPdfLeiste(id)}
    <p class="klein gedaempft">Schritt 1 von 3 · Allgemein</p>
    <section class="karte bg-allg">${bgAllgemeinFelder(id, e)}</section>
    ${BG.boegen[id] ? '' : bgFreiNeu(id)}
    ${nrn.length ? `<div class="bg-gruppe"><span class="bg-lbl">Direkt zu einer Übung</span>${bgLeiste(id, '')}</div>` : ''}
    <a class="knopf haupt breit" href="#boegen/${encodeURIComponent(id)}/${nrn.length ? encodeURIComponent(nrn[0]) : 'ende'}">${nrn.length ? 'Weiter zu den Übungen' : 'Weiter zum Überblick'}</a>
    ${bgAnsichtOverlay(id)}</div>`;
}
function bogenKarte(id, nr) {
  bgGesehen(id, nr);
  const nrn = bgNummern(id), i = nrn.indexOf(nr), x = bgUeInfo(id, nr) || {};
  const vor = i > 0 ? `#boegen/${encodeURIComponent(id)}/${encodeURIComponent(nrn[i - 1])}` : `#boegen/${encodeURIComponent(id)}`;
  const nach = i < nrn.length - 1 ? `#boegen/${encodeURIComponent(id)}/${encodeURIComponent(nrn[i + 1])}` : `#boegen/${encodeURIComponent(id)}/ende`;
  return `<div class="seite schmal-inhalt bg-schritt bg-wisch" data-vor="${vor}" data-nach="${nach}">
    <div class="bg-oben"><a class="knopf bg-pfeil" href="${vor}" aria-label="Zurück">‹</a><span class="bg-oben-mitte"><b>Übung ${esc(nr)}</b><span class="klein gedaempft">${i + 1} von ${nrn.length}</span></span><a class="knopf bg-pfeil" href="${nach}" aria-label="Weiter">›</a><a class="knopf bg-zum-ende" href="#boegen/${encodeURIComponent(id)}/ende">Überblick</a></div>
    ${bgLeiste(id, nr)}
    <h1 class="bg-h">${x.titel ? esc(x.titel) : 'Übung ' + esc(nr)}</h1>
    <section class="karte bg-karte${x.neu ? ' neu' : ''}">${ueKarte(id, nr, false)}</section>
    <div class="bg-weiter"><a class="knopf" href="${vor}">‹ ${i > 0 ? 'Übung ' + esc(nrn[i - 1]) : 'Allgemein'}</a><a class="knopf haupt" href="${nach}">${i < nrn.length - 1 ? 'Übung ' + esc(nrn[i + 1]) + ' ›' : 'Überblick ›'}</a></div>
    <p class="klein gedaempft mitte">Wischen wechselt die Übung.</p>${bgAnsichtOverlay(id)}</div>`;
}
function bogenEnde(id) {
  const e = bgEntwurf(id), nrn = bgNummern(id);
  const zurueck = `#boegen/${encodeURIComponent(id)}/${nrn.length ? encodeURIComponent(nrn[nrn.length - 1]) : ''}`;
  return `<div class="seite schmal-inhalt bg-schritt bg-wisch" data-vor="${zurueck}"><a class="zurueck" href="${zurueck}">‹ ${nrn.length ? 'Übung ' + esc(nrn[nrn.length - 1]) : 'Allgemein'}</a><h1>Fertig?</h1><p class="klein gedaempft">Schritt 3 von 3 · Überblick</p>
    ${bgLeiste(id, 'ende')}
    <section class="karte liste-karte">${nrn.map(nr => { const u = e.uebungen[nr] || { ergebnis: 'klappt', chips: [], notiz: '' }, x = bgUeInfo(id, nr) || {}; return `<a class="zeile bg-ueb" href="#boegen/${encodeURIComponent(id)}/${encodeURIComponent(nr)}"><span class="zeile-haupt">${esc(nr)}${x.titel ? ' · ' + esc(x.titel) : ''}<span class="klein gedaempft block">${[u.bonus ? 'Bonus: ' + u.bonus.ergebnis : '', u.chips.length ? u.chips.join(', ') : '', u.notiz ? 'Notiz' : '', u.fotos && u.fotos.length ? u.fotos.length + ' Foto' + (u.fotos.length > 1 ? 's' : '') : ''].filter(Boolean).join(' · ')}</span></span><span class="bg-pill" data-erg="${esc(u.ergebnis)}">${esc(u.ergebnis)}</span></a>`; }).join('')}</section>
    <section class="karte bg-allg"><h3 class="bg-h3">Zum Schluss</h3>${bgAllgemeinFelder(id, e, A.BOGEN_ENDE, false)}${bgSonst(id, e)}</section>
    ${bgSpeichernKnopf(id)}<p class="klein gedaempft mitte">Danach im Chat: „Bogen ${esc(bgTitel(id).replace(' · ', ' '))} erledigt“</p></div>`;
}
// Bogen in der App ansehen (Auftrag 27): alle Übungen als Bilder untereinander, antippen zoomt
function bgAnsichtOverlay(id) {
  const a = BG.ansicht;
  if (!a || a.id !== id) return '';
  const b = BG.boegen[id];
  if (!b) return '';
  const mitLoes = A.bogenHatBilder(b, 'loes'), w = a.w === 'loes' && mitLoes ? 'loes' : 'auf';
  return `<div class="bg-ansicht" role="dialog" aria-modal="true" aria-label="${w === 'auf' ? 'Aufgaben' : 'Lösungen'} ansehen">
    <div class="bg-ansicht-kopf"><div class="bg-seg" style="grid-template-columns:1fr 1fr" role="group"><button data-act="bgAnsicht" data-id="${esc(id)}" data-w="auf" aria-pressed="${w === 'auf'}">Aufgaben</button><button data-act="bgAnsicht" data-id="${esc(id)}" data-w="loes" aria-pressed="${w === 'loes'}"${mitLoes ? '' : ' disabled title="Lösungen nur als PDF"'}>Lösungen</button></div>
      <button class="knopf bg-ansicht-zu" data-act="bgAnsichtZu" aria-label="Schließen">✕</button></div>
    <div class="bg-ansicht-inhalt">${b.uebungen.map(u => { const pfad = u.bilder && u.bilder[w]; const src = pfad ? bgBild(id, pfad) : 'fehlt';
      return `<figure class="bg-ansicht-ue"><figcaption><b>Übung ${esc(u.nr)}</b>${u.titel ? ' · ' + esc(u.titel) : ''}</figcaption>${src && src !== 'fehlt' ? `<img src="${src}" data-act="bgGross" alt="${w === 'auf' ? 'Aufgabe' : 'Lösung'} Übung ${esc(u.nr)}">` : `<span class="klein gedaempft">${src === 'fehlt' ? 'Kein Bild' : 'Lädt …'}</span>`}</figure>`; }).join('')}
      <p class="klein gedaempft mitte">Antippen vergrößert. Zum Drucken die PDF-Knöpfe nutzen.</p></div></div>`;
}
// Fotos: verkleinert auf 1600 px an der langen Seite, bis zum Speichern im Zwischenstand
function bildVerkleinern(file, max = 1600) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Das Bild konnte nicht gelesen werden.')); };
    img.src = url;
  });
}
async function bgFotoNeu(id, nr, files) {
  try {
    const e = bgEntwurf(id), u = bgUe(e, nr);
    for (const f of files) u.fotos.push({ data: await bildVerkleinern(f) });
    bgSichern(id, e);
  } catch (x) { BG.meldung = { art: 'fehler', text: x.message }; }
  zeichne();
}
async function bgSpeichern(id) {
  const o = C.nutzer, e = bgEntwurf(id);
  if (!e.von) { BG.meldung = { art: 'fehler', text: 'Bitte oben antippen, wer einträgt.' }; return zeichne(); }
  BG.speichert = true; BG.meldung = { art: 'info', text: 'Wird gespeichert …' }; zeichne();
  try {
    let n = 0;
    for (const [nr, u] of Object.entries(e.uebungen)) {
      for (const p of u.fotos || []) {
        if (!p.data) continue;
        const name = `${id}-${String(nr).replace(/[^a-z0-9]+/gi, '')}-${Date.now()}-${++n}.jpg`;
        await U.dateiNeuBase64(C, `daten/${o}/bogen-feedback/fotos/${name}`, p.data.split(',')[1], `${ordnerName(o)}: Foto zu Bogen ${id}`);
        delete p.data; p.name = name;
        bgSichern(id, e);
      }
    }
    const datei = A.bogenFeedbackDatei(o, id, e);
    await U.dateiSchreiben(C, `daten/${o}/bogen-feedback/${id}.json`, JSON.stringify(datei, null, 1), `${ordnerName(o)}: Bogen-Feedback ${id}`);
    BG.fb[id] = datei;
    try { localStorage.removeItem(bgKey(id)); } catch (x) {}
    delete BG.entwuerfe[bgKey(id)];
    if (BG.liste && !BG.liste.some(x => x.id === id)) BG.liste.push({ id, ordner: !!BG.boegen[id], fertig: true });
    for (const x of BG.liste || []) if (x.id === id) x.fertig = true;
    BG.meldung = { art: 'ok', text: `Gespeichert. Sag im Chat für ${esc(name())}: „Bogen ${bgTitel(id).replace(' · ', ' ')} erledigt“.` };
  } catch (x) { BG.meldung = { art: 'fehler', text: x.message || 'Speichern hat nicht geklappt. Der Zwischenstand bleibt auf diesem Gerät.' }; }
  BG.speichert = false; zeichne();
}
const ordnerName = (o) => o.charAt(0).toUpperCase() + o.slice(1);
// Bild groß: Antippen schließt, zwei Finger zoomen, Doppeltipp vergrößert, ziehen verschiebt
function lupeAuf(src, alt) {
  let el = document.getElementById('bg-lupe');
  if (!el) { el = document.createElement('div'); el.id = 'bg-lupe'; el.innerHTML = '<button class="bg-lupe-zu" aria-label="Schließen">✕</button><img alt="">'; document.body.appendChild(el); lupeSteuerung(el); }
  const img = el.querySelector('img'); img.src = src; img.alt = alt || '';
  el.zoom = { s: 1, x: 0, y: 0 }; img.style.transform = '';
  el.hidden = false;
}
function lupeSteuerung(el) {
  const img = el.querySelector('img'), p = new Map();
  let start = null, letzterTipp = 0, bewegt = false;
  const setzen = () => { const z = el.zoom; img.style.transform = `translate(${z.x}px, ${z.y}px) scale(${z.s})`; };
  el.querySelector('.bg-lupe-zu').onclick = () => { el.hidden = true; };
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('.bg-lupe-zu')) return; el.setPointerCapture(e.pointerId); p.set(e.pointerId, { x: e.clientX, y: e.clientY }); bewegt = false; start = { z: { ...el.zoom }, pts: [...p.values()].map(q => ({ ...q })) }; });
  el.addEventListener('pointermove', (e) => {
    if (!p.has(e.pointerId) || !start) return;
    p.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...p.values()];
    if (pts.length >= 2 && start.pts.length >= 2) {
      const d0 = Math.hypot(start.pts[0].x - start.pts[1].x, start.pts[0].y - start.pts[1].y), d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      el.zoom.s = Math.max(1, Math.min(6, start.z.s * d1 / Math.max(10, d0))); bewegt = true;
    } else if (pts.length === 1 && start.pts.length === 1) {
      const dx = pts[0].x - start.pts[0].x, dy = pts[0].y - start.pts[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 6) bewegt = true;
      if (el.zoom.s > 1) { el.zoom.x = start.z.x + dx; el.zoom.y = start.z.y + dy; }
    }
    setzen();
  });
  const ende = (e) => {
    p.delete(e.pointerId);
    if (p.size) { start = { z: { ...el.zoom }, pts: [...p.values()].map(q => ({ ...q })) }; return; }
    if (!bewegt) {
      const jetzt = Date.now();
      if (jetzt - letzterTipp < 320) { el.zoom = el.zoom.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }; setzen(); letzterTipp = 0; }
      else { letzterTipp = jetzt; setTimeout(() => { if (letzterTipp === jetzt && el.zoom.s === 1) el.hidden = true; }, 330); }
    }
    start = null;
  };
  el.addEventListener('pointerup', ende); el.addEventListener('pointercancel', ende);
  el.addEventListener('wheel', (e) => { e.preventDefault(); el.zoom.s = Math.max(1, Math.min(6, el.zoom.s * Math.exp(-e.deltaY * 0.002))); if (el.zoom.s === 1) { el.zoom.x = 0; el.zoom.y = 0; } setzen(); }, { passive: false });
}

// ---------- Lernplan (daten/<name>/lernplan.json, Export der Lernplan-Seite in claude.ai) ----------
// Gleicher Code wie die Seite in claude.ai (lernplan.mjs, gebaut aus lernplan/ im Code-Repo). Hier nur lesbar.
const LPL = {}; // je Kind: { laedt, fehler, daten, el, inst, geholt }
function lernplanLaden(ordner, neu = false) {
  const z = LPL[ordner] || (LPL[ordner] = {});
  if (z.laedt || (z.geholt && !neu)) return;
  z.laedt = true; z.fehler = null;
  U.dateiLesen(C, `daten/${ordner}/lernplan.json`).then(d => {
    z.daten = d && d.format === 'lernplan-1' ? d : null; z.geholt = Date.now();
    if (z.inst && z.daten) z.inst.setzen(Lernplan.ausExport(z.daten));
    if (z.el) z.el.querySelector('.lp-info') && (z.el.querySelector('.lp-info').innerHTML = lernplanInfo(z.daten));
  }).catch(e => { z.fehler = e.message || 'Laden hat nicht geklappt.'; }).finally(() => { z.laedt = false; zeichne(); });
}
function lernplanInfo(d) {
  if (!d) return '';
  const ex = d.exportiert ? new Date(d.exportiert) : null;
  const wann = ex && !isNaN(ex) ? `${ex.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${ex.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '';
  return `${wann ? `<span>Exportiert ${esc(wann)}</span>` : ''}${d.quelle && /^https:\/\/claude\.ai\//.test(d.quelle) ? `<a href="${esc(d.quelle)}" target="_blank" rel="noopener">In Claude bearbeiten ↗</a>` : ''}<span>Nur zum Lesen</span>`;
}
function lernplanSeite() {
  const ordner = C.nutzer;
  const z = LPL[ordner] || {};
  if (!z.geholt && !z.laedt && !z.fehler) setTimeout(() => lernplanLaden(ordner), 0);
  const kopf = breit.matches ? '' : kopfSchmal('Lernplan');
  if (z.fehler && !z.daten) return `<div class="seite lp-seite">${kopf}<p class="hinweis-box">${esc(z.fehler)}</p><button class="knopf" data-act="lernplanNeu">Nochmal versuchen</button></div>`;
  if (!z.daten) return `<div class="seite lp-seite">${kopf}<section class="karte"><p class="pad">${z.laedt || !z.geholt ? 'Der Lernplan wird geladen …' : `Für ${esc(name())} gibt es noch keinen Lernplan in der Eltern-App. Die Kinder-Chats legen ihn an, sobald sie die Lernplan-Seite ändern.`}</p></section></div>`;
  return `<div class="seite lp-seite">${kopf}<div id="lp-platz"></div><button class="knopf knopf-klein lp-neu" data-act="lernplanNeu">${z.laedt ? 'Lädt …' : 'Neu laden'}</button></div>`;
}
// Nach dem Zeichnen: den Lernplan des Kindes einhängen. Das Element bleibt bestehen, damit Ansicht, Auswahl und Aufklappen erhalten bleiben.
function lernplanEinhaengen() {
  const platz = document.getElementById('lp-platz');
  const z = LPL[C.nutzer];
  if (!platz || !z || !z.daten) return;
  if (!z.el) {
    z.el = document.createElement('div');
    z.inst = Lernplan.erstellen(z.el, { daten: z.daten, eingebettet: true, hell: true, speicher: 'lp-open-' + C.nutzer, info: lernplanInfo(z.daten), bogenOeffnen: (id) => { location.hash = '#boegen/' + encodeURIComponent(id); } });
  }
  platz.appendChild(z.el);
  const tabs = document.querySelector('.tabs');
  z.el.style.setProperty('--lp-unten', tabs && tabs.offsetHeight ? `${tabs.offsetHeight}px` : '0px');
  const main = platz.closest('main');
  z.el.style.setProperty('--lp-links', main ? `${Math.round(main.getBoundingClientRect().left)}px` : '0px');
}

// ---------- Tickets (Feedback aus der Übungs-App, feedback/ im Daten-Repo) ----------
// Status: neu → claude (Auftrag an Claude) → erledigt. Claude liest die Tickets auf Bitte im Chat und trägt die Antwort ein.
const T = { liste: null, laedt: false, fehler: null, bilder: {} };
const TICKET_STATUS = { neu: 'Neu', claude: 'Für Claude', erledigt: 'Erledigt' };
async function ticketsLaden() {
  if (T.laedt) return;
  T.laedt = true; T.fehler = null; zeichne();
  try {
    const dateien = (await U.ordnerLesen(C, 'feedback')).filter(f => f.type === 'file' && f.name.endsWith('.json'));
    T.liste = (await Promise.all(dateien.map(f => U.dateiLesen(C, f.path).catch(() => null)))).filter(t => t && t.id)
      .sort((a, b) => (a.erstellt < b.erstellt ? 1 : -1));
  } catch (e) { T.fehler = e.message || 'Laden hat nicht geklappt.'; }
  T.laedt = false; zeichne();
}
function ticketBildLaden(name) {
  if (T.bilder[name] !== undefined) return;
  T.bilder[name] = null;
  U.dateiBlob(C, `feedback/${name}`).then(b => { T.bilder[name] = b ? URL.createObjectURL(b) : ''; zeichne(); }).catch(() => { T.bilder[name] = ''; zeichne(); });
}
const ticketWann = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`; };
const ticketVon = (t) => (t.von ? t.von.charAt(0).toUpperCase() + t.von.slice(1) : '?') + (t.kontext && t.kontext.testgeraet ? ` · Testgerät${t.kontext.testAls ? ' als ' + t.kontext.testAls.charAt(0).toUpperCase() + t.kontext.testAls.slice(1) : ''}` : '');
function ticketsSeite() {
  if (!T.liste && !T.laedt && !T.fehler) setTimeout(ticketsLaden, 0);
  const filter = C.ticketFilter || 'offen';
  const liste = (T.liste || []).filter(t => filter === 'alle' || (filter === 'offen' ? t.status !== 'erledigt' : t.status === filter));
  const zahl = (st) => (T.liste || []).filter(t => st === 'offen' ? t.status !== 'erledigt' : t.status === st).length;
  return `<div class="seite schmal-inhalt">${breit.matches ? '<h1>Tickets</h1>' : kopfSchmal('Tickets')}
    <div class="segmente" role="group">${[['offen', 'Offen'], ['claude', 'Für Claude'], ['erledigt', 'Erledigt'], ['alle', 'Alle']].map(([k, t]) =>
      `<button class="segment${filter === k ? ' an' : ''}" data-act="ticketFilter" data-w="${k}">${t}${k !== 'alle' && T.liste ? ` · ${zahl(k)}` : ''}</button>`).join('')}</div>
    ${T.fehler ? `<p class="hinweis-box">${esc(T.fehler)}</p>` : ''}
    ${T.laedt && !T.liste ? '<p class="gedaempft">Tickets werden geladen …</p>' : ''}
    ${T.liste && !liste.length ? '<p class="gedaempft">Keine Tickets.</p>' : ''}
    <section class="karte liste-karte">${liste.map(t => `<a class="zeile ticket-zeile" href="#ticket/${encodeURIComponent(t.id)}">
      <span class="ticket-status st-${esc(t.status)}">${esc(TICKET_STATUS[t.status] || t.status)}</span>
      <span class="zeile-haupt"><b>${esc(String(t.text || '').slice(0, 90))}${String(t.text || '').length > 90 ? ' …' : ''}</b><span class="klein gedaempft block">${ticketWann(t.erstellt)} · ${esc(ticketVon(t))}${t.kontext && t.kontext.aufgabe ? ' · ' + esc(t.kontext.aufgabe.id) : ''}</span></span></a>`).join('')}</section>
    <button class="knopf" data-act="ticketsLaden">${T.laedt ? 'Lädt …' : 'Neu laden'}</button>
  </div>`;
}
function ticketSeite(id) {
  if (!T.liste && !T.laedt) setTimeout(ticketsLaden, 0);
  const t = (T.liste || []).find(x => x.id === id);
  if (!t) return `<div class="seite schmal-inhalt"><a href="#tickets" class="zurueck">‹ Tickets</a><p class="gedaempft">${T.laedt ? 'Lädt …' : 'Ticket nicht gefunden.'}</p></div>`;
  (t.bilder || []).forEach(ticketBildLaden);
  const k = t.kontext || {};
  const a = k.aufgabe;
  const zeile = (n, w) => (w == null || w === '' ? '' : `<div class="info-zeile"><span>${n}</span><b>${esc(String(w))}</b></div>`);
  return `<div class="seite schmal-inhalt"><a href="#tickets" class="zurueck">‹ Tickets</a>
    <h1>Ticket ${esc(t.id)}</h1>
    <p><span class="ticket-status st-${esc(t.status)}">${esc(TICKET_STATUS[t.status] || t.status)}</span> <span class="gedaempft">${ticketWann(t.erstellt)} · ${esc(ticketVon(t))}</span></p>
    <section class="karte"><p class="ticket-text">${esc(t.text || '')}</p></section>
    <div class="ticket-bilder">${(t.bilder || []).map(b => T.bilder[b] ? `<a href="${T.bilder[b]}" target="_blank" rel="noopener"><img src="${T.bilder[b]}" alt="${b.endsWith('-foto.jpg') ? 'Foto' : 'Bild der App'}"></a>` : `<div class="ticket-bild-platz gedaempft klein">${T.bilder[b] === '' ? 'Bild fehlt' : 'Bild lädt …'}</div>`).join('')}</div>
    ${t.antwort ? `<section class="karte"><h2 class="abschnitt">Antwort von Claude</h2><p class="ticket-text">${esc(t.antwort)}</p></section>` : ''}
    ${t.fuer_kind ? `<section class="karte"><h2 class="abschnitt">So sieht es das Kind</h2><p class="ticket-text">${esc(t.fuer_kind)}</p><p class="klein gedaempft">Erscheint einmal auf dem Startbildschirm, sobald das Ticket erledigt ist.</p></section>` : ''}
    <section class="karte">
      <label class="block" for="ticket-auftrag"><b>Was soll Claude tun?</b> <span class="klein gedaempft">(optional)</span></label>
      <textarea id="ticket-auftrag" class="ticket-auftrag" rows="3">${esc(t.auftrag || '')}</textarea>
      <div class="knopf-reihe">
        ${t.status !== 'claude' ? `<button class="knopf haupt" data-act="ticketStatus" data-id="${esc(t.id)}" data-w="claude">Auftrag an Claude</button>` : `<button class="knopf haupt" data-act="ticketAuftragKopieren" data-id="${esc(t.id)}">Text für den Chat kopieren</button>`}
        ${t.status !== 'erledigt' ? `<button class="knopf" data-act="ticketStatus" data-id="${esc(t.id)}" data-w="erledigt">Erledigt</button>` : `<button class="knopf" data-act="ticketStatus" data-id="${esc(t.id)}" data-w="neu">Wieder öffnen</button>`}
      </div>
      ${T.meldung ? `<p class="klein">${esc(T.meldung)}</p>` : ''}
    </section>
    <h2 class="abschnitt">Stand der App</h2>
    <section class="karte liste-karte">
      ${zeile('Version', k.app)}${zeile('Ansicht', k.ansicht)}${zeile('Gestaltung', k.gestaltung)}
      ${zeile('Pakete', (k.pakete || []).map(p => `${p.id} ${p.anteil} %${p.etappe != null ? ' E' + p.etappe : ''}${p.start ? ' (wartet)' : ''}`).join(' · '))}
      ${zeile('Gezielt testen', k.testFokus ? `${k.testFokus.thema} · Stufe ${k.testFokus.stufe}` : '')}
      ${a ? zeile('Aufgabe', `${a.id} (${a.thema}, ${a.typ})`) + zeile('Stand', `Teil ${a.idx + 1}, ${a.phase}${a.uf ? ', Umformen: ' + a.uf.phase + ', Stufe ' + a.uf.stufe : ''}${a.fertig ? ', fertig' : ''}`) + zeile('Meldung', a.meldung) : ''}
      ${k.geraet ? zeile('Gerät', `${k.geraet.breite} × ${k.geraet.hoehe}${k.geraet.homeBildschirm ? ', Home-Bildschirm' : ', Browser'}${k.geraet.zoom !== '1' ? ', Zoom ' + k.geraet.zoom : ''}`) : ''}
    </section>
    <details class="karte"><summary>Alle Daten (für Claude)</summary><pre class="ticket-json">${esc(JSON.stringify(k, null, 1))}</pre></details>
  </div>`;
}
async function ticketStatus(id, status) {
  const t = (T.liste || []).find(x => x.id === id);
  if (!t) return;
  const auftrag = document.getElementById('ticket-auftrag');
  const neu = { ...t, status, auftrag: auftrag ? auftrag.value.trim() : t.auftrag, verlauf: [...(t.verlauf || []), { zeit: new Date().toISOString(), status, wer: 'eltern' }] };
  T.meldung = 'Wird gespeichert …'; zeichne();
  try {
    await U.dateiSchreiben(C, `feedback/${id}.json`, JSON.stringify(neu, null, 1), `Ticket ${id}: ${TICKET_STATUS[status] || status}`);
    Object.assign(t, neu);
    T.meldung = status === 'claude' ? 'Gespeichert. Sag Claude im Chat: „Bearbeite die Tickets für Claude.“' : 'Gespeichert.';
    if (status === 'claude') ticketTextKopieren(t);
  } catch (e) { T.meldung = `Speichern hat nicht geklappt: ${e.message || 'Fehler'}`; }
  zeichne();
}
function ticketTextKopieren(t) {
  const text = `Bitte bearbeite Ticket ${t.id} (feedback/${t.id}.json im Daten-Repo).${t.auftrag ? ' ' + t.auftrag : ''}`;
  try { navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { /* ohne Zwischenablage */ }
  return text;
}
function ticketAuftragKopieren(id) {
  const t = (T.liste || []).find(x => x.id === id);
  if (!t) return;
  ticketTextKopieren(t);
  T.meldung = 'Text kopiert. Füge ihn im Chat mit Claude ein.'; zeichne();
}

// ---------- Übersicht ----------

function kopfSchmal(titel) {
  return `<header class="kopf-schmal">
    ${logo(34)}
    <div class="kopf-titel"><span class="marke-titel">${esc(titel)}</span><span class="klein gedaempft">${standZeile()}</span></div>
    ${C.nur ? '' : nutzerWahl('nutzer-chip')}
  </header>`;
}

function zeitraumWahl() {
  return `<div class="segmente" role="group" aria-label="Zeitraum">${[[1, 'Heute'], [7, '7 Tage'], [30, '30 Tage']].map(([n, t]) =>
    `<button class="segment${C.zeitraum === n ? ' an' : ''}" data-act="zeitraum" data-n="${n}" aria-pressed="${C.zeitraum === n}">${t}</button>`).join('')}</div>`;
}

function uebersichtSeite() {
  const tage = A.letzteTage(C.zeitraum);
  const k = A.kennzahlen(D.daten.aufgaben, D.daten.eintraege, tage[0]);
  const vor = A.kennzahlen(D.daten.aufgaben.filter(r => r.tag < tage[0]), D.daten.eintraege, A.letzteTage(C.zeitraum * 2)[0]);
  const kacheln = [
    ['Aufgaben', k.aufgaben, C.zeitraum > 1 ? `an ${k.aktiveTage} von ${C.zeitraum} Tagen` : 'heute'],
    ['Richtig im 1. Versuch', k.quote == null ? '–' : `${k.quote} %`, vor.quote == null ? '' : `davor ${vor.quote} %`],
    ['Übungszeit', A.minutenText(k.uebungMs / 1000), 'reine Aufgabenzeit'],
    ['Spielzeit verdient', A.minutenText(k.verdientSek), `${A.minutenText(k.gespieltSek)} gespielt`],
    ...(bzKachelZeigen(k) ? [['Bildschirmzeit verdient', A.minutenText(k.bzVerdientSek), bzKachelZusatz(k), 'bz']] : [])
  ].map(([l, w, z, kl]) => `<div class="kachel${kl ? ' kachel-' + kl : ''}"><span class="kachel-label">${l}</span><span class="kachel-wert">${w}</span><span class="kachel-zusatz">${z}</span></div>`).join('');

  const max = Math.max(1, ...tage.map(t => (k.tage[t] || {}).anzahl || 0));
  const balken = C.zeitraum === 1 ? '' : `<section class="karte">
    <div class="karte-kopf"><h2>Aufgaben pro Tag</h2><span class="legende"><i class="farbe-teal"></i>1. Versuch</span><span class="legende"><i class="farbe-amber"></i>später</span></div>
    <div class="balken${C.zeitraum > 7 ? ' viele' : ''}">${tage.map(t => {
      const d = k.tage[t] || { anzahl: 0, erst: 0 };
      return `<a class="balken-spalte" href="#verlauf/${t}" aria-label="${tagLang(t)}: ${d.anzahl} Aufgaben">
        <span class="balken-zahl">${d.anzahl || ''}</span>
        <span class="balken-stapel" style="height:${Math.round(d.anzahl / max * 100)}%"><span class="b-spaet" style="flex-grow:${d.anzahl - d.erst}"></span><span class="b-erst" style="flex-grow:${d.erst}"></span></span>
        <span class="balken-tag">${C.zeitraum > 7 ? t.slice(8) : wochentag(t)}</span></a>`;
    }).join('')}</div></section>`;

  const themen = k.themen.length ? `<section class="karte liste-karte">
    <div class="karte-kopf"><h2>Themen</h2></div>
    ${k.themen.map(t => `<div class="themen-zeile">
      <span class="themen-name">${esc(t.name)}</span>
      <span class="themen-balken"><span style="width:${t.quote}%" class="${t.quote >= 75 ? 'gut' : 'mittel'}"></span></span>
      <span class="themen-quote">${t.quote} %</span>
      <span class="themen-info">${t.anzahl} · St. ${t.stufe || '–'}</span>
      ${t.kurz ? `<span class="themen-kurz">Kommt mit der Formelübersicht aus: ${t.kurzOk} von ${t.kurz}${t.lang ? ` · ${t.lang}-mal „Mehr Hilfe“` : ''}</span>` : ''}
    </div>`).join('')}</section>` : '';

  const auff = k.auffaellig.length ? `<section class="hinweis-box"><h2>Auffällig</h2>${k.auffaellig.slice(0, 5).map(t => `<p>${esc(t)}</p>`).join('')}</section>` : '';
  const leer = !k.aufgaben ? `<p class="gedaempft">In diesem Zeitraum wurden keine Aufgaben gemacht.</p>` : '';

  return `<div class="seite">
    ${breit.matches ? `<header class="kopf-breit"><h1>Übersicht · ${esc(name())}</h1>${nutzerWahl('nutzer-chip nur-hoch')}${zeitraumWahl()}</header>` : kopfSchmal('Übersicht') + zeitraumWahl()}
    ${liveKarte()}
    ${berichtKachel()}
    ${bogenKachel()}
    <div class="kacheln">${kacheln}</div>
    ${leer}
    <div class="zwei-spalten">
      <div class="spalte">${uebungszeitKarte()}${balken}${!breit.matches ? auff : ''}</div>
      <div class="spalte">${wochenplanKarte(false)}${paketQuotenKarte(tage[0])}${uzKarte()}${wissenKarte()}${bzKarte()}${themen}${breit.matches ? auff : ''}</div>
    </div>
  </div>`;
}

// ---------- Verlauf ----------

function tageMitAufgaben() {
  const map = {};
  const tagVon = (k) => map[k] || (map[k] = { tag: k, anzahl: 0, erst: 0, ms: 0, spiele: 0, spielSek: 0 });
  for (const r of D.daten.aufgaben) {
    const d = tagVon(r.tag);
    if (r.ende) { d.anzahl++; if (A.erstZ(r.ende)) d.erst++; d.ms += r.ende.ms || 0; }
  }
  for (const sp of D.daten.spiele || []) { const d = tagVon(sp.tag); d.spiele++; d.spielSek += sp.sekunden || 0; }
  return Object.values(map).filter(d => d.anzahl || d.spiele).sort((a, b) => a.tag < b.tag ? 1 : -1);
}

// Kurzzeile für einen Tag: Aufgaben und Spielen
function tagKurzText(d, lang = true) {
  const teile = [];
  if (d.anzahl) teile.push(lang ? `${d.anzahl} Aufgaben · ${Math.round(d.erst / d.anzahl * 100)} % im 1. Versuch · ${A.minutenText(d.ms / 1000)}` : `${d.anzahl} Aufgaben · ${Math.round(d.erst / d.anzahl * 100)} %`);
  else teile.push('keine Aufgaben');
  if (d.spielSek) teile.push(`${A.minutenText(d.spielSek)} gespielt`);
  return teile.join(' · ');
}

function tageListe() {
  const tage = tageMitAufgaben();
  return `<div class="seite">
    ${kopfSchmal('Verlauf')}
    ${tage.length ? `<section class="karte liste-karte">${tage.map(d => `<a class="zeile" href="#verlauf/${d.tag}">
      <span class="zeile-haupt"><b>${tagLang(d.tag)}</b><span class="klein gedaempft">${tagKurzText(d)}</span></span>
      ${svg('weiter', 18)}</a>`).join('')}</section>` : '<p class="gedaempft">Noch keine Aufgaben in den letzten 30 Tagen.</p>'}
  </div>`;
}

function aufgabenVonTag(tag) {
  return D.daten.aufgaben.filter(r => r.tag === tag);
}

function spieleVonTag(tag) {
  return (D.daten.spiele || []).filter(sp => sp.tag === tag);
}

// Aufgaben und Spiele eines Tages in zeitlicher Reihenfolge (je nach Filter)
function gefiltert(liste, spiele = []) {
  if (filter === 'fehler') return liste.filter(r => r.ende && r.ende.ergebnis !== 'erst');
  if (filter === 'hinweis') return liste.filter(r => r.events.some(e => ['hinweis', 'hinweis_kurz', 'hinweis_lang'].includes(e.typ)));
  if (filter === 'spiele') return spiele;
  return [...liste, ...spiele].sort((a, b) => a.start.t < b.start.t ? -1 : 1);
}

function spielZeile(sp, gewaehlt) {
  const info = [];
  if (sp.punkte != null) info.push(`${A.punkteText(sp.punkte)} Punkte`);
  if (sp.maxKachel) info.push(`höchster Stein ${sp.maxKachel}`);
  const hoehlen = sp.events.filter(e => e.typ === 'km_hoehle' && e.ergebnis === 'geschafft').length;
  const level = sp.events.filter(e => e.typ === 'ss_level').length;
  const zahl = (typ, f = () => true) => sp.events.filter(e => e.typ === typ && f(e)).length;
  if (sp.spiel === 'runenreihen' && zahl('rr_stufe')) info.push(`${zahl('rr_stufe')} ${zahl('rr_stufe') === 1 ? 'Stufe' : 'Stufen'} geschafft`);
  if (sp.spiel === 'hoehlenkarte' && zahl('hk_karte', e => e.ergebnis === 'geschafft')) info.push(`${zahl('hk_karte', e => e.ergebnis === 'geschafft')} ${zahl('hk_karte', e => e.ergebnis === 'geschafft') === 1 ? 'Karte' : 'Karten'} geschafft`);
  if (sp.spiel === 'runenbrecher' && zahl('rb_level', e => e.ergebnis === 'geschafft')) info.push(`${zahl('rb_level', e => e.ergebnis === 'geschafft')} Level geschafft`);
  if (sp.spiel === 'jadeschlange' && zahl('jsg_runde')) info.push(`${zahl('jsg_runde')} ${zahl('jsg_runde') === 1 ? 'Runde' : 'Runden'}`);
  const runden = sp.events.filter(e => e.typ === 'rn_spiel');
  if (sp.spiel === 'runenfall' && runden.length) info.push(`${runden.length} ${runden.length === 1 ? 'Runde' : 'Runden'}, beste ${A.punkteText(Math.max(...runden.map(e => e.punkte || 0)))} Punkte`);
  if (sp.spiel === 'steinschieber') info.push(level ? `${level} Level geschafft` : (sp.ende && sp.ende.level ? `bei Level ${sp.ende.level}` : ''));
  if (sp.spiel === 'kristallmine') info.push(hoehlen ? `${hoehlen} ${hoehlen === 1 ? 'Höhle' : 'Höhlen'} geschafft` : (sp.hoehle ? `in Höhle ${sp.hoehle}` : ''));
  const neu = sp.events.filter(e => e.typ === 'spiel_neu').length;
  if (neu) info.push(`${neu}-mal neu begonnen`);
  return `<a class="zeile spiel-zeile${sp.key === gewaehlt ? ' gewaehlt' : ''}" href="#spiel/${encodeURIComponent(sp.key)}">
      <span class="zeile-zeit">${uhr(sp.start.t)}</span>
      <span class="zeile-haupt"><b class="einzeilig">${esc(A.SPIEL_NAMEN[sp.spiel] || sp.spiel)} · ${A.minutenText(sp.sekunden)}${sp.ende ? '' : ' (ca.)'}</b><span class="klein gedaempft">${info.join(' · ') || 'gespielt'}</span></span>
      <span class="badge b-spiel">Spiel</span></a>`;
}

function badge(r) {
  return `<span class="badge b-${A.ergebnisArt(r)}">${A.ergebnisText(r)}</span>`;
}

function aufgabenZeilen(liste, gewaehlt) {
  return liste.map(r => {
    if (r.spiel) return spielZeile(r, gewaehlt);
    const a = A.aufgabeVon(r, D.pool);
    const extra = [];
    if (r.events.some(e => e.typ === 'hinweis_lang')) extra.push('Mehr Hilfe'); else if (r.events.some(e => ['hinweis', 'hinweis_kurz'].includes(e.typ))) extra.push('Hinweis');
    if (r.events.some(e => e.typ === 'rechner' || e.typ === 'rechner_optional')) extra.push('Rechner');
    if (r.events.some(e => e.typ === 'verlassen')) extra.push('App verlassen');
    if (r.events.some(e => e.typ === 'hilfe')) extra.push('Hilf mir');
    if (a && a.gegeben) extra.push('Merkzettel');
    const block = (r.start.generator || '').startsWith('block');
    return `<a class="zeile${r.key === gewaehlt ? ' gewaehlt' : ''}" href="#aufgabe/${encodeURIComponent(r.key)}">
      <span class="zeile-zeit">${uhr(r.start.t)}</span>
      <span class="zeile-haupt"><b class="einzeilig">${mathe(A.kurztext(r, a))}</b><span class="klein gedaempft">${esc(THEMA_NAMEN[r.thema] || r.thema)}${block ? ' · Dreierblock' : ''}${extra.length ? ' · ' + extra.join(' · ') : ''}</span></span>
      ${badge(r)}</a>`;
  }).join('');
}

function filterLeiste() {
  return `<div class="filter">${[['alle', 'Alle'], ['fehler', 'Mit Fehler'], ['hinweis', 'Mit Hinweis'], ['spiele', 'Spiele']].map(([k, t]) =>
    `<button class="chip${filter === k ? ' an' : ''}" data-act="filter" data-f="${k}" aria-pressed="${filter === k}">${t}</button>`).join('')}</div>`;
}

function tagZusammenfassung(liste, spiele = []) {
  const fertig = liste.filter(r => r.ende);
  const erst = fertig.filter(r => A.erstZ(r.ende)).length;
  const ms = fertig.reduce((s, r) => s + (r.ende.ms || 0), 0);
  const sek = fertig.reduce((s, r) => s + (r.ende.sekunden || 0), 0);
  const gespielt = spiele.reduce((s, sp) => s + (sp.sekunden || 0), 0);
  return `${fertig.length} Aufgaben · ${erst} im 1. Versuch · ${A.minutenText(ms / 1000)} geübt · ${A.minutenText(sek)} Spielzeit verdient${spiele.length ? ` · ${A.minutenText(gespielt)} gespielt (${spiele.length}-mal)` : ''}`;
}

function tagSeite(tag) {
  const liste = aufgabenVonTag(tag), spiele = spieleVonTag(tag);
  return `<div class="seite">
    <a class="zurueck" href="#verlauf">${svg('zurueck', 20)}Alle Tage</a>
    <h1>${tagLang(tag)}</h1>
    <p class="klein gedaempft">${tagZusammenfassung(liste, spiele)}</p>
    ${filterLeiste()}
    <section class="karte liste-karte">${aufgabenZeilen(gefiltert(liste, spiele)) || '<p class="leer">Nichts Passendes an diesem Tag.</p>'}</section>
  </div>`;
}

function verlaufBreit() {
  const tage = tageMitAufgaben();
  let rec = route.seite === 'aufgabe' ? D.daten.aufgaben.find(r => r.key === route.arg)
    : route.seite === 'spiel' ? (D.daten.spiele || []).find(sp => sp.key === route.arg) : null;
  const tag = rec ? rec.tag : (route.arg || (tage[0] && tage[0].tag) || L.tagKey());
  const liste = aufgabenVonTag(tag), spiele = spieleVonTag(tag);
  return `<div class="drei-spalten">
    <section class="spalte-tage">
      <h2 class="spalten-titel">${esc(name())}</h2>
      ${tage.map(d => `<a class="tag-knopf${d.tag === tag ? ' gewaehlt' : ''}" href="#verlauf/${d.tag}"><b>${tagKurz(d.tag)}</b><span class="klein gedaempft">${tagKurzText(d, false)}</span></a>`).join('') || '<p class="leer">Noch keine Aufgaben.</p>'}
    </section>
    <section class="spalte-aufgaben">
      <div class="spalten-kopf"><label class="nur-hoch tag-feld"><span class="unsichtbar">Tag auswählen</span><select name="tag-wahl">${tage.map(d => `<option value="${d.tag}"${d.tag === tag ? ' selected' : ''}>${tagKurz(d.tag)} · ${d.anzahl} Aufgaben</option>`).join('')}</select></label><b>${tagLang(tag)}</b><span class="klein gedaempft">${tagZusammenfassung(liste, spiele)}</span>${filterLeiste()}</div>
      ${aufgabenZeilen(gefiltert(liste, spiele), rec && rec.key) || '<p class="leer">Nichts Passendes an diesem Tag.</p>'}
    </section>
    <section class="spalte-detail">${rec ? (rec.spiel ? spielDetail(rec) : aufgabeDetail(rec)) : '<div class="leer-detail">Tippe links auf eine Aufgabe oder ein Spiel.<br>Dann siehst du, was genau passiert ist.</div>'}</section>
  </div>`;
}

// ---------- Eine Spiel-Sitzung ----------

function spielSeite(key) {
  const sp = (D.daten.spiele || []).find(x => x.key === key);
  if (!sp) return `<div class="seite"><a class="zurueck" href="#verlauf">${svg('zurueck', 20)}Verlauf</a><p>Dieses Spiel gibt es nicht mehr in den geladenen Daten.</p></div>`;
  return `<div class="seite">
    <a class="zurueck" href="#verlauf/${sp.tag}">${svg('zurueck', 20)}${tagLang(sp.tag)}</a>
    ${spielDetail(sp)}
  </div>`;
}

function spielDetail(sp) {
  const name_ = A.SPIEL_NAMEN[sp.spiel] || sp.spiel;
  // Was kam vorher? Aufgaben seit dem letzten Spiel an diesem Tag
  const vorher = (D.daten.spiele || []).filter(x => x.geraet === sp.geraet && x.start.t < sp.start.t).pop();
  const aufg = D.daten.aufgaben.filter(r => r.geraet === sp.geraet && r.ende && r.start.t < sp.start.t && (!vorher || r.start.t > vorher.start.t) && r.tag === sp.tag);
  const verdient = aufg.reduce((s, r) => s + (r.ende.sekunden || 0), 0);
  const kacheln = [
    ['Gespielt', `${A.minutenText(sp.sekunden)}${sp.ende ? '' : ' (ca.)'}`],
    ['Spielzeit vorher', sp.guthaben != null ? A.minutenText(sp.guthaben) : '–'],
    ['Spielzeit danach', sp.rest != null ? A.minutenText(sp.rest) : '–'],
    ['Punkte am Ende', sp.punkte != null ? A.punkteText(sp.punkte) : '–']
  ];
  const schritte = A.spielZeitleiste(sp);
  return `<article class="detail">
    <div class="detail-kopf"><h1>${esc(name_)} · ${uhr(sp.start.t)}–${uhr(sp.bis)}</h1><span class="klein gedaempft">${tagLang(sp.tag)}</span></div>
    <section class="kacheln spiel-kacheln">${kacheln.map(([t, w]) => `<div class="kachel"><span class="klein gedaempft">${t}</span><b>${w}</b></div>`).join('')}</section>
    <p class="klein gedaempft">${aufg.length ? `Davor seit dem letzten Spiel: <b>${aufg.length} Aufgaben</b>, ${A.minutenText(verdient)} Spielzeit verdient.` : 'Davor seit dem letzten Spiel keine Aufgaben (Spielzeit von früher oder geschenkt).'}</p>
    <section>
      <h2>Ablauf</h2>
      <ol class="zeitleiste">${schritte.map(s => `<li class="schritt s-${s.art}"><span class="schritt-zeit">${s.zeit}</span><span class="schritt-punkt" aria-hidden="true"></span><span class="schritt-text"><b>${esc(s.titel)}</b>${s.text ? `<span>${esc(s.text)}</span>` : ''}</span></li>`).join('')}</ol>
    </section>
  </article>`;
}

// ---------- Eine Aufgabe ----------

function aufgabeSeite(key) {
  const rec = D.daten.aufgaben.find(r => r.key === key);
  if (!rec) return `<div class="seite"><a class="zurueck" href="#verlauf">${svg('zurueck', 20)}Verlauf</a><p>Diese Aufgabe gibt es nicht mehr in den geladenen Daten.</p></div>`;
  return `<div class="seite">
    <a class="zurueck" href="#verlauf/${rec.tag}">${svg('zurueck', 20)}${tagLang(rec.tag)}</a>
    ${aufgabeDetail(rec)}
  </div>`;
}

function aufgabeDetail(rec) {
  const a = A.aufgabeVon(rec, D.pool);
  const nr = aufgabenVonTag(rec.tag).indexOf(rec) + 1;
  const schritte = A.zeitleiste(rec, a, D.hinweise);
  const tasten = rec.events.filter(e => e.typ === 'rechner').map(e => esc(e.ausdruck) + (e.ohneGleich ? '' : ' ='));
  const fehlerTypen = [...new Set(rec.events.filter(e => e.typ === 'versuch' && e.fehler).map(e => e.fehler))];
  const gleich = fehlerTypen.map(f => {
    const n = D.daten.aufgaben.filter(r => r.events.some(e => e.typ === 'versuch' && e.fehler === f)).length;
    return n > 1 ? `<p>Diesen Fehler gab es in den letzten 30 Tagen bei <b>${n} Aufgaben</b>.</p>` : '';
  }).join('');
  const pkName = rec.start.paket ? ((paketVon(rec.start.paket) || {}).name || rec.start.paket) : '';
  const quelle = (rec.start.generator ? 'Baukasten' : D.pool.has(rec.id) ? 'Aufgabensammlung' : 'Hinzugefügt')
    + (pkName ? ` · Paket ${esc(pkName)}${rec.start.etappe != null ? `, Etappe ${rec.start.etappe}` : ''}` : '');
  const teile = a && a.typ === 'mehrfrage' && (a.generator || '').startsWith('block')
    ? `<p>${a.fragen.map(f => mathe(f.frage.replace(/\s*=$/, ''))).join(' · ')}</p>` : '';
  return `<article class="detail">
    <div class="detail-kopf"><h1>Aufgabe ${nr} · ${esc(THEMA_NAMEN[rec.thema] || rec.thema)}</h1><span class="klein gedaempft">Stufe ${rec.stufe || '–'} · ${quelle}</span></div>
    <section class="aufgabe-karte">
      ${a && a.bild ? `<div class="aufgabe-bild">${bildSvg(a.bild, true)}</div>` : ''}
      <div class="aufgabe-text">
        ${a && a.geschichte ? `<p>${mathe(a.geschichte)}</p>` : ''}
        ${a && a.rechnung ? `<p class="rechnung">${mathe(a.rechnung)}</p>` : ''}
        ${teile}
        ${a && a.frage ? `<p><b>${mathe(a.frage)}</b></p>` : ''}
        ${!a ? `<p>${esc(A.kurztext(rec, null))}</p>` : ''}
        <p class="klein gedaempft">Ergebnis: <b>${A.ergebnisText(rec)}</b>${rec.ende ? ` · Dauer ${A.dauerText(rec.ende.ms)} · Spielzeit +${A.minutenText(rec.ende.sekunden)}` : ''}</p>
      </div>
    </section>
    <div class="detail-spalten">
      <section>
        <h2>So ist ${esc(name())} vorgegangen</h2>
        <ol class="zeitleiste">${schritte.map(s => `<li class="schritt s-${s.art}"><span class="schritt-zeit">${s.zeit}</span><span class="schritt-punkt" aria-hidden="true"></span><span class="schritt-text"><b>${mathe(s.titel)}</b>${s.text ? `<span>${esc(s.text)}</span>` : ''}</span></li>`).join('')}</ol>
      </section>
      <section class="detail-rand">
        ${a && a.loesungsweg ? `<div class="karte klein-karte"><h2>Lösungsweg</h2>${a.loesungsweg.map(z => `<p>${mathe(z)}</p>`).join('')}${a.erklaerung ? `<p class="gedaempft">${mathe(a.erklaerung)}</p>` : ''}</div>` : ''}
        ${tasten.length ? `<div class="karte klein-karte"><h2>Eingaben am Rechner</h2>${tasten.map(t => `<p class="rechner-zeile">${t}</p>`).join('')}</div>` : ''}
        ${gleich ? `<div class="hinweis-box">${gleich}</div>` : ''}
      </section>
    </div>
  </article>`;
}

// ---------- Einstellungen ----------

function entwurfHolen() {
  if (!entwurf) { entwurf = A.startWerte(D.daten.einst, neuesterStand(), paketVon); geaenderteStufen = new Set(); }
  return entwurf;
}
// Vergleich unabhängig von der Reihenfolge der Schlüssel
const kanon = (v) => Array.isArray(v) ? v.map(kanon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, kanon(v[k])])) : v;
function geaendert() {
  return JSON.stringify(kanon(entwurfHolen())) !== JSON.stringify(kanon(A.startWerte(D.daten.einst, neuesterStand(), paketVon))) || geaenderteStufen.size > 0;
}

function lieferStatus() {
  const einst = D.daten.einst, st = neuesterStand();
  const zeilen = [];
  for (const { geraet, stand } of D.daten.staende) {
    const alt = versionAlt(stand.version, MIN_APP);
    const fv = (stand.fern && stand.fern.version) || 0;
    let status;
    if (alt) status = `App-Version ${esc(stand.version)} kann noch keine Einstellungen aus der Ferne. Sie lädt das Update beim nächsten Öffnen.`;
    else if (!einst) status = 'Nutzt seine eigenen Einstellungen.';
    else if (fv >= einst.version) status = `Einstellungen angekommen (${wann(stand.fern.angewendet)}).`;
    else status = `Gesendet ${wann(einst.geaendert)}. Kommt an, sobald ${esc(name())} die App öffnet.`;
    zeilen.push(`<p><b>Handy ${esc(geraet.slice(0, 4))}…</b> · App ${esc(stand.version)} · zuletzt gemeldet ${wann(stand.stand)}<br><span class="klein">${status}</span></p>`);
  }
  if (!st) zeilen.push('<p>Von diesem Handy kam noch kein Stand.</p>');
  return `<section class="info-box">${zeilen.join('')}</section>`;
}

function stepper(act, attrs, wert, label) {
  return `<span class="stepper"><button class="knopf-klein" data-act="${act}" ${attrs} data-d="-1" aria-label="${label} weniger">−</button><b>${wert}</b><button class="knopf-klein" data-act="${act}" ${attrs} data-d="1" aria-label="${label} mehr">+</button></span>`;
}

function speicherLeiste() {
  const an = geaendert();
  return `<div class="speicher-leiste">
    ${meldung ? `<p class="meldung ${meldung.art}">${esc(meldung.text)}</p>` : ''}
    <div class="knopf-reihe">
      ${an ? '<button class="knopf" data-act="verwerfen">Verwerfen</button>' : ''}
      <button class="knopf haupt breit" data-act="speichern"${an ? '' : ' disabled'}>${an ? `Speichern und an ${esc(name())} senden` : 'Keine Änderungen'}</button>
    </div>
  </div>`;
}

function einstellungenSeite() {
  const w = entwurfHolen();
  const stunden = (sel) => Array.from({ length: 25 }, (_, h) => `<option value="${h}"${h === sel ? ' selected' : ''}>${h} Uhr</option>`).join('');
  const st = neuesterStand();
  const liveStufe = (g) => (st && st.genStufen && st.genStufen[g] && st.genStufen[g].stufe) || 1;
  return `<div class="seite schmal-inhalt">
    ${breit.matches ? `<header class="kopf-breit"><h1>Einstellungen für ${esc(name())}</h1>${nutzerWahl('nutzer-chip nur-hoch')}</header>` : kopfSchmal('Einstellungen')}
    ${lieferStatus()}
    ${w.wochenplan ? wochenplanKarte(true) : ''}
    ${w.wochenplan ? `<details class="experte"${experteOffen ? ' open' : ''}><summary data-act="experte">Experte: Pakete, Gewichte und Baukästen<span class="klein gedaempft block">Gilt nur ohne laufenden Wochenplan oder für Etappen. Den Wochenplan legt Claude mit dir fest.</span></summary>${paketeKarte(w)}<section class="karte liste-karte">${gewichteZeile(w)}</section>${baukastenTeil(w, liveStufe)}</details>` : paketeKarte(w)}
    <section class="karte liste-karte">
      ${w.wochenplan ? '' : gewichteZeile(w)}
      <div class="einstell-zeile"><span>Geschenkte Spielzeit</span><span class="zwei-felder"><label><span class="unsichtbar">ab</span><select id="e-von">${stunden(w.basisVon)}</select></label><span>bis</span><label><span class="unsichtbar">bis</span><select id="e-bis">${stunden(w.basisBis)}</select></label></span></div>
      <a class="einstell-zeile" href="#splitter"><span>Runensplitter und neue Spiele</span><span class="wert">${splitterKurzText()}</span>${svg('weiter', 16)}</a>
      <a class="einstell-zeile" href="#spielzeit"><span>Spielzeit pro Aufgabe</span><span class="wert">${w.spielzeit.staffel.map(zahlText).join(' / ')} Min.</span>${svg('weiter', 16)}</a>
      <label class="einstell-zeile"><span>Freiwilliger Taschenrechner<span class="klein gedaempft block">bei jeder Aufgabe, kostet Spielzeit (wo er nicht erlaubt ist)</span></span><input type="checkbox" class="schalter" id="e-rechner"${w.rechnerAngebot ? ' checked' : ''}></label>
      <div class="einstell-block"><span>Kopf-Bonus<span class="klein gedaempft block">Rechner erlaubt (Körper, große Zahlen), aber nicht benutzt und App nicht verlassen. Dazu +5 Runensplitter.</span></span>
        <div class="segmente" role="group" aria-label="Kopf-Bonus">${L.KOPF_FAKTOREN.map(f => `<button class="segment${w.spielzeit.kopf === f ? ' an' : ''}" data-act="kopf" data-w="${f}" aria-pressed="${w.spielzeit.kopf === f}">${f === 1 ? 'Aus' : '×' + String(f).replace('.', ',')}</button>`).join('')}</div></div>
      <div class="einstell-block"><span>Lange Hinweise<span class="klein gedaempft block">Sonst kommt zuerst die Formelübersicht. „Mehr Hilfe“ öffnet den langen Hinweis.</span></span>
        <div class="segmente" role="group" aria-label="Lange Hinweise">${LANG_STUFEN.map(s => `<button class="segment${w.langeHinweise === s.stufe ? ' an' : ''}" data-act="langeHinweise" data-w="${s.stufe}" aria-pressed="${w.langeHinweise === s.stufe}">${s.name}</button>`).join('')}</div>
        <span class="klein gedaempft">${esc(langStufeInfo(w.langeHinweise).name)}: ${esc(langStufeInfo(w.langeHinweise).text)}.</span></div>
    </section>
    ${gestaltungEinstellungen(w)}
    ${szEinstellungen(w)}
    ${bzEinstellungen(w)}
    ${w.wochenplan ? '' : baukastenTeil(w, liveStufe)}
    ${speicherLeiste()}
    <section class="karte liste-karte"><a class="einstell-zeile" href="#pakete"><span>Aufgabenpakete verwalten<span class="klein gedaempft block">anlegen, ändern, mit Claude erstellen</span></span>${svg('weiter', 16)}</a>
      <a class="einstell-zeile" href="#qr"><span>Handy mit QR-Code einrichten<span class="klein gedaempft block">nach dem Löschen der App oder für ein neues Handy</span></span>${svg('weiter', 16)}</a></section>
    ${schluesselKarte()}
  </div>`;
}

function gewichteZeile(w) {
  return `<a class="einstell-zeile" href="#gewichte"><span>Themen und Gewichte<span class="klein gedaempft block">Anpassungen für ${esc(name())}, gelten in jedem Paket</span></span><span class="wert">${gewichteKurz(w.gewichte)}</span>${svg('weiter', 16)}</a>`;
}
function baukastenTeil(w, liveStufe) {
  return `<h2 class="abschnitt">Baukästen: Schwierigkeit und Häufigkeit</h2>
    <section class="karte liste-karte">
      ${Object.keys(GEN_NAMEN).map(g => baukastenZeile(g, w, liveStufe)).join('')}
    </section>
    <p class="klein gedaempft">Die App passt die Stufen weiter selbst an. Was du hier änderst, ist der neue Startpunkt.</p>
    ${freigabeKarte(w)}
    <p class="klein gedaempft">Die Häufigkeit kommt aus dem Paket. Änderst du sie hier, gilt das nur für ${esc(name())}. Das Paket bleibt, wie es ist.</p>`;
}

// ---------- Wochenplan (Auftrag 24) ----------
// Plan gegen Ist wie im Reiter „Übungsmenge“ des Lernplans (Strich = Plan, kräftig = Aufgaben, hell = Übungszeit)
let experteOffen = false;
const pzt = (v) => (Math.round(v * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: v < 10 ? 1 : 0 }) + ' %';
const themaName = (t) => THEMA_NAMEN[t] || t;
const datumKurz = (d) => { const a = String(d || '').split('-'); return a.length === 3 ? `${+a[2]}.${+a[1]}.` : ''; };
function wochenplanKarte(bearbeiten) {
  const werte = bearbeiten ? entwurfHolen() : ((D.daten.einst && D.daten.einst.werte) || {});
  const st = A.wochenplanStand({ ...werte, pakete: werte.pakete || (D.daten.einst && D.daten.einst.werte && D.daten.einst.werte.pakete) || [] }, D.daten.eintraege || []);
  if (!st) return '';
  const wp = st.wp, heute = L.tagKey();
  const statusText = st.status === 'laeuft' ? 'läuft' : st.status === 'kommt' ? `beginnt am ${datumKurz(wp.ab)}` : 'abgelaufen';
  const skala = Math.max(40, Math.ceil(Math.max(...st.arten.map(a => Math.max(a.soll, a.ist, a.istN)), 1) / 10) * 10);
  const sk = (v) => Math.min(100, v / skala * 100);
  const zeilen = st.arten.slice().sort((a, b) => ((a.b ? { rot: 0, gelb: 1 }[a.b.st] : 2) - (b.b ? { rot: 0, gelb: 1 }[b.b.st] : 2)) || (b.soll - a.soll)).map(a => `
    <div class="wp-zeile${a.b ? ' ' + a.b.st : ''}">
      <span class="wp-name">${esc(a.motiv ? 'Motivation' : a.name === a.art ? themaName(a.art) : a.name)}${a.themen.length > 1 || a.motiv ? `<span class="klein gedaempft block">${esc(a.themen.map(themaName).join(', '))}</span>` : ''}${st.eingriffeAktiv.filter(e => e.art === a.art && e.typ === 'plus').map(e => `<span class="klein amber block">Eingriff ${e.wert > 0 ? '+' : '−'}${Math.abs(e.wert)} % bis ${datumKurz(e.bis)}</span>`).join('')}</span>
      <span class="wp-balken" title="Plan ${pzt(a.soll)}, Ist ${pzt(a.ist)} der Übungszeit, ${pzt(a.istN)} der Aufgaben"><span class="wp-n" style="width:${sk(a.istN)}%"></span><span class="wp-z" style="width:${sk(a.ist)}%"></span><span class="wp-s" style="left:calc(${sk(a.soll)}% - 1.5px)"></span></span>
      <span class="wp-werte">Plan <b>${pzt(a.soll)}</b> · Ist <b class="iz">${pzt(a.ist)}</b> <span class="klein gedaempft">${A.minutenText(a.ms / 1000)}</span>${a.b ? ` <span class="abw ${a.b.st}">${esc(a.b.wort)}</span>` : ''}</span>
    </div>`).join('');
  const mo = wp.motivation;
  const ein = st.eingriffe;
  const artOptionen = [...new Set([...st.arten.filter(a => !a.motiv).map(a => a.art), ...Object.keys(wp.erinnerung).filter(k => k !== 'standard'), ...L.THEMEN.filter(t => (werte.gewichte || {})[t] > 0)])];
  const bisStd = wp.bis < heute ? heute : (L.tagKey(new Date(Date.now() + 7 * 864e5)) < wp.bis ? L.tagKey(new Date(Date.now() + 7 * 864e5)) : wp.bis);
  return `<section class="karte wochenplan-karte">
    <div class="karte-kopf"><h2>Wochenplan</h2><span class="wp-status ${st.status}">${esc(statusText)}</span><span class="klein gedaempft">${datumKurz(wp.ab)} bis ${datumKurz(wp.bis)}</span></div>
    ${st.status === 'abgelaufen' ? `<p class="meldung fehler">Wochenplan abgelaufen am ${datumKurz(wp.bis)}. Die App arbeitet wie ohne Plan, bis Claude einen neuen einträgt.</p>` : ''}
    ${wp.begruendung ? `<p class="wp-grund">${esc(wp.begruendung)}</p>` : ''}
    <h3 class="wp-h">Plan gegen Ist <span class="klein gedaempft">seit ${datumKurz(wp.ab)}: ${st.aufgaben} Aufgaben, ${A.minutenText(st.minuten * 60)}${st.sonstMin > 0.5 ? `, davon ${A.minutenText(st.sonstMin * 60)} Erinnerungen und Themen ohne Plan` : ''}</span></h3>
    ${st.aufgaben ? '' : '<p class="klein gedaempft">Noch keine Aufgaben in diesem Zeitraum.</p>'}
    <div class="wp-liste">${zeilen}</div>
    <p class="klein gedaempft">Strich = Plan, kräftiger Balken = Anteil an den Aufgaben, heller Balken = Anteil an der Übungszeit. Bewertet wird die Übungszeit: gelb ab Faktor 1,5 und 3 Prozentpunkten, rot ab Faktor 2 und 5 Prozentpunkten.</p>
    <h3 class="wp-h">Mischung</h3>
    <p>${mo.themen.length ? `Motivierend: ${esc(mo.themen.map(themaName).join(', '))}. Anteil ${mo.anteil} %, spätestens nach ${mo.takt} anderen Aufgaben kommt eine. Eine Sitzung beginnt motivierend.` : 'Keine motivierenden Aufgaben festgelegt.'}</p>
    <h3 class="wp-h">Erinnerungen</h3>
    <div class="wp-erin">${st.erinnerung.map(e => `<div class="wp-e${e.faellig ? ' faellig' : ''}"><b>${esc(e.name === e.art ? themaName(e.art) : e.name)}</b><span>alle ${e.tage} Tage</span><span class="klein gedaempft">${e.zuletzt ? `zuletzt ${datumKurz(e.zuletzt)}` : 'in der App noch nie'}${e.faellig ? ' · fällig' : ''}</span></div>`).join('')}
      ${st.standard ? `<div class="wp-e"><b>Alle anderen</b><span>alle ${st.standard} Tage</span><span class="klein gedaempft">wenn schon einmal geübt</span></div>` : ''}</div>
    ${st.erinnerungen.length ? `<p class="klein gedaempft">Seit ${datumKurz(wp.ab)}: ${st.erinnerungen.length} ${st.erinnerungen.length === 1 ? 'Erinnerung' : 'Erinnerungen'} (${esc([...new Set(st.erinnerungen.map(e => themaName(e.thema)))].join(', '))}).</p>` : ''}
    ${st.gesperrt.length || wp.gesperrt.length ? `<h3 class="wp-h">Gesperrt</h3><p>${esc([...new Set([...st.gesperrt.map(themaName), ...wp.gesperrt.filter(g => !L.THEMEN.includes(g))])].join(', '))} <span class="klein gedaempft">kommt nicht in die App</span></p>` : ''}
    <h3 class="wp-h">Eingriffe</h3>
    ${ein.length ? `<div class="wp-ein">${ein.map((e, i) => `<div class="wp-ei${e.bis < heute ? ' alt' : ''}"><span><b>${esc(W.artName(e.art, werte.pakete || []) === e.art ? themaName(e.art) : W.artName(e.art, werte.pakete || []))}</b> ${e.typ === 'aus' ? 'aus' : (e.wert > 0 ? '+' : '−') + Math.abs(e.wert) + ' %'} bis ${datumKurz(e.bis)}${e.bis < heute ? ' (abgelaufen)' : ''}</span>${bearbeiten ? `<button class="knopf klein-knopf" data-act="wpEingriffWeg" data-i="${i}">Entfernen</button>` : ''}</div>`).join('')}</div>` : '<p class="klein gedaempft">Keine. Ein Eingriff gilt nur bis zu seinem Datum, danach wieder der Wochenplan.</p>'}
    ${bearbeiten ? `<div class="wp-form">
      <label><span class="klein">Was</span><select id="wp-art">${artOptionen.map(a => `<option value="${esc(a)}">${esc(W.artName(a, werte.pakete || []) === a ? themaName(a) : W.artName(a, werte.pakete || []))}</option>`).join('')}</select></label>
      <label><span class="klein">Wie</span><select id="wp-typ"><option value="plus:10">+10 %</option><option value="plus:20">+20 %</option><option value="plus:-10">−10 %</option><option value="aus">aus</option></select></label>
      <label><span class="klein">bis</span><input type="date" id="wp-bis" value="${bisStd}" min="${heute}"></label>
      <button class="knopf" data-act="wpEingriff">Eingriff vormerken</button>
    </div><p class="klein gedaempft">Wird mit „Speichern und an ${esc(name())} senden“ gesendet. Claude sieht den Eingriff bei der nächsten Auswertung.</p>` : `<p class="klein gedaempft">Eingriffe unter <a href="#einstellungen">Einstellungen</a>.</p>`}
  </section>`;
}

// ---------- Runensplitter und neue Spiele ----------

// Gestaltung („Logbuch Sternzeit“) und Übungszeit pro Tag (Auftrag 13)
function gestaltungEinstellungen(w) {
  const u = w.uebungszeit;
  const seg = (act, werte, akt, text = (x) => x) => `<div class="segmente" role="group">${werte.map(x => `<button class="segment${x === akt ? ' an' : ''}" data-act="${act}" data-w="${x}" aria-pressed="${x === akt}">${text(x)}</button>`).join('')}</div>`;
  const st = neuesterStand();
  const heute = st && st.uebung && st.uebung.tag === L.tagKey() ? st.uebung.sek : 0;
  return `<h2 class="abschnitt">Gestaltung, Bedienung und Übungszeit</h2>
    <section class="karte liste-karte">
      <div class="einstell-block"><span>Gestaltung der App<span class="klein gedaempft block">Logbuch Sternzeit: dunkle Konsole, Logbuch, Wissensarchiv und Wissenspunkte. Hinweiskarten bleiben gleich.</span></span>${seg('gestaltung', ['schrein', 'sternzeit'], w.gestaltung, x => x === 'schrein' ? 'Schrein' : 'Logbuch Sternzeit')}</div>
      <div class="einstell-block"><span>Bögen und Feedback<span class="klein gedaempft block">Bereich „Bögen“: Bögen ausdrucken und Feedback eintragen. Die Bögen legt Claude im Kinder-Chat an.</span></span>${seg('boegenAn', [true, false], w.boegen_feedback === true, x => x ? 'An' : 'Aus')}</div>
      <div class="einstell-block"><span>Live-Anzeige<span class="klein gedaempft block">Die Übersicht zeigt, ob ${esc(name())} gerade übt oder spielt. Die App meldet nur Beginn und Ende.</span></span>${seg('liveAn', [true, false], w.live === true, x => x ? 'An' : 'Aus')}</div>
      <div class="einstell-block"><span>Feedback-Knopf<span class="klein gedaempft block">Kleiner Knopf am rechten Rand. ${esc(name())} kann damit ein Bild der App und einen Text schicken. Er landet unter „Tickets“. Auf Testgeräten ist er immer da.</span></span>${seg('feedbackAn', [true, false], w.feedback === true, x => x ? 'An' : 'Aus')}</div>
      <div class="einstell-block"><span>„In Schritten umformen“: Start-Stufe<span class="klein gedaempft block">3: beide Seiten selbst vereinfachen. 2: die App schreibt eine Seite. 1: die App vereinfacht. Die anderen Stufen gibt es als Hilfe.</span></span>${seg('umformStufe', [3, 2, 1], w.umform_stufe, x => 'Stufe ' + x)}</div>
      ${L.BEDIENUNG.map(b => `<div class="einstell-block"><span>${esc(b.titel)}<span class="klein gedaempft block">${esc(b.text)}</span></span>${seg('bedienung" data-k="' + b.k, [true, false], w[b.k] ?? b.std, x => x ? 'An' : 'Aus')}</div>`).join('')}
      <div class="einstell-block"><span>Übungszeit pro Tag begrenzen<span class="klein gedaempft block">Gezählt wird die Zeit in Aufgaben. Danach fragt ${esc(name())} dich nach mehr.</span></span>${seg('uzAn', [true, false], u.an, x => x ? 'An' : 'Aus')}</div>
      ${u.an ? `<div class="einstell-block"><span>Höchstens pro Tag</span>${seg('uzMax', BS.UZ_HOECHSTWERTE, u.max)}<span class="klein gedaempft">Minuten. Dann kommt ein freundlicher Hinweis, die laufende Aufgabe darf fertig werden.</span></div>
      <div class="einstell-block"><span>Nachlauf</span>${seg('uzNachlauf', [0, 10, 20], u.nachlauf_prozent, x => x + ' %')}<span class="klein gedaempft">Danach ist für heute Schluss mit Üben: ${Math.round(u.max * (1 + u.nachlauf_prozent / 100))} Min.</span></div>
      <div class="einstell-block"><span>Heute mehr Übungszeit</span>${seg('uzExtra', [0, ...BS.UZ_EXTRAS], u.extraMin, x => '+' + x)}<span class="klein gedaempft">Heute: ${u.max + u.extraMin} Min., geübt ${A.minutenText(heute)}${st && st.uebung ? '' : ' (noch keine Meldung)'}. Morgen gilt wieder der normale Wert.</span></div>` : ''}
    </section>`;
}

// Übersicht: Anfragen „mehr Übungszeit“ mit Code
function uzKarte() {
  const ein = D.daten.eintraege || [];
  const liste = A.uzAnfragen(ein).filter(e => L.tagKey(new Date(e.t)) >= letzteTageKey(7));
  if (!liste.length) return '';
  const zeitText = (t) => BS.zeitpunktText(new Date(t));
  return `<section class="karte liste-karte bz-liste">
    <div class="karte-kopf"><h2>Mehr Übungszeit?</h2></div>
    ${liste.slice(0, 6).map(e => `<div class="bz-zeile"><div><b>${esc(zeitText(e.t))}</b><span class="klein gedaempft block">${A.minutenText(e.sek)} geübt</span></div><span class="bz-code">${esc(e.code || '–')}</span></div>`).join('')}
    <p class="klein gedaempft">Mehr Zeit gibst du unter Einstellungen → „Heute mehr Übungszeit“.</p>
    <div class="knopf-spalte"><a class="knopf" href="#einstellungen">Zu den Einstellungen</a></div>
  </section>`;
}
const letzteTageKey = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return L.tagKey(d); };

// Übersicht: Wissenspunkte (Stand und Verlauf)
function wissenKarte() {
  const ein = D.daten.eintraege || [];
  const verlauf = A.wissenVerlauf(ein);
  const st = neuesterStand();
  if (!verlauf.length && !(st && st.wissen)) return '';
  const stand = st && st.wissen ? st.wissen.stand : (verlauf[0] && verlauf[0].stand) || 0;
  const grundText = { knobeln: 'Knobeln ohne Schritte', schritte: 'Knobeln mit Schritten', aufgabe: 'Aufgabe gelöst', archiv: 'Archiv freigeschaltet' };
  const tage = {};
  for (const v of verlauf) { const k = L.tagKey(new Date(v.t)); const t = tage[k] || (tage[k] = { plus: 0, minus: [] }); if (v.n > 0) t.plus += v.n; else t.minus.push(v); }
  return `<section class="karte liste-karte">
    <div class="karte-kopf"><h2>Wissenspunkte</h2><span class="klein gedaempft">Stand ${stand}</span></div>
    ${Object.entries(tage).slice(0, 7).map(([k, t]) => `<div class="bz-zeile"><div><b>${esc(tagKurz(k))}</b><span class="klein gedaempft block">+${t.plus} verdient${t.minus.map(m => ` · −${-m.n} ${esc(grundText[m.grund])}: ${esc((D.archiv || {})[m.id] || m.id)}`).join('')}</span></div></div>`).join('')}
    <p class="klein gedaempft pad">Knobeln ohne Schritte bringt mehr Punkte. Mit Punkten schaltet ${esc(name())} Einträge im Wissensarchiv frei.</p>
  </section>`;
}

const extraText = (x) => ({ 0.5: '½', 0.75: '¾', 1: 'voll' })[x];
const extraBlock = (act, w, heuteMin, nm) => {
  const seg = (a, werte, akt, text) => `<div class="segmente" role="group">${werte.map(x => `<button class="segment${x === akt ? ' an' : ''}" data-act="${a}" data-w="${x}" aria-pressed="${x === akt}">${text(x)}</button>`).join('')}</div>`;
  const f = w.extraFaktor ?? 0.5;
  return `<div class="einstell-block"><span>Nur heute mehr zulassen</span>${seg(act, BS.EXTRAS, w.extraMin, x => '+' + x)}
    ${w.extraMin > 0 ? `<span class="einstell-unter">Extra-Zeit zählt ${seg(act + 'Faktor', BS.EXTRA_FAKTOREN, f, extraText)}</span>` : ''}
    <span class="klein gedaempft">Heute: ${w.max + w.extraMin} Min. erlaubt, ${heuteMin} verdient.${w.extraMin > 0 && f < 1 ? ` Ab Minute ${w.max} bekommt ${nm} für jede Aufgabe ${f === 0.5 ? 'die Hälfte' : 'drei Viertel'}.` : ''} Morgen gilt wieder der normale Wert.</span></div>`;
};
// Höchstwert pro Tag: feste Stufen oder eigener Wert (15–240 Min.), optional „gilt bis“ (Auftrag 30)
function maxBlock(art, w, liste, text) {
  const eigen = !liste.includes(w.max);
  const danach = w.maxDanach || (liste.includes(w.max) ? w.max : 45);
  return `<div class="einstell-block max-block"><span>Höchstens pro Tag</span>
    <div class="segmente" role="group">${liste.map(x => `<button class="segment${x === w.max ? ' an' : ''}" data-act="${art}Max" data-w="${x}" aria-pressed="${x === w.max}">${x}</button>`).join('')}<button class="segment${eigen ? ' an' : ''}" data-act="maxEigen" data-art="${art}" aria-pressed="${eigen}">Eigener Wert</button></div>
    ${eigen || w.maxBis ? `<div class="max-eigen"><label>Minuten <input type="number" inputmode="numeric" min="${BS.MAX_FREI.min}" max="${BS.MAX_FREI.max}" step="5" data-maxfeld="${art}" value="${w.max}"></label>
      <label>gilt bis <input type="date" data-maxbis="${art}" value="${esc(w.maxBis || '')}" min="${L.tagKey()}"></label>
      ${w.maxBis ? `<button class="knopf knopf-klein" data-act="maxBisWeg" data-art="${art}">ohne Ende</button>` : ''}</div>
      <span class="klein gedaempft">${w.maxBis ? `Bis ${esc(datumKurz(w.maxBis))} gelten ${w.max} Min., danach wieder ${danach} Min.` : `Gilt jeden Tag, bis du es änderst. Erlaubt sind ${BS.MAX_FREI.min} bis ${BS.MAX_FREI.max} Minuten.`}</span>` : ''}
    <span class="klein gedaempft">${text}</span></div>`;
}
// Spielzeit im Schrein pro Tag: Höchstwert und „nur heute mehr“ (zählt nur mit Aufgaben verdiente Zeit)
function szEinstellungen(w) {
  const z = w.spielzeitTag;
  const seg = (act, werte, akt, text = (x) => x) => `<div class="segmente" role="group">${werte.map(x => `<button class="segment${x === akt ? ' an' : ''}" data-act="${act}" data-w="${x}" aria-pressed="${x === akt}">${text(x)}</button>`).join('')}</div>`;
  const heute = A.szHeute(D.daten.eintraege || []);
  return `<h2 class="abschnitt">Spielzeit im Schrein pro Tag</h2>
    <section class="karte liste-karte">
      ${maxBlock('sz', z, BS.SZ_HOECHSTWERTE, `Minuten, die ${esc(name())} pro Tag mit Aufgaben verdienen kann. Geschenkte Minuten zählen nicht mit.`)}
      ${extraBlock('szExtra', z, A.minutenText(heute), esc(name()))}
    </section>`;
}

// Bildschirmzeit: an/aus, Faktor, Höchstwert pro Tag, „nur heute mehr“
function bzEinstellungen(w) {
  const b = w.bildschirm;
  const seg = (act, werte, akt, text = (x) => x) => `<div class="segmente" role="group">${werte.map(x => `<button class="segment${x === akt ? ' an' : ''}" data-act="${act}" data-w="${x}" aria-pressed="${x === akt}">${text(x)}</button>`).join('')}</div>`;
  const bruch = (x) => ({ 0.5: '½', 1: '1', 1.5: '1½', 2: '2' })[x];
  const heute = A.bzHeute(D.daten.eintraege || []);
  return `<h2 class="abschnitt">Bildschirmzeit</h2>
    <section class="karte liste-karte">
      <div class="einstell-block"><span>Kann für Bildschirmzeit üben<span class="klein gedaempft block">Vor der ersten Aufgabe fragt die App: Spielzeit oder Bildschirmzeit?</span></span>${seg('bzAn', [true, false], b.an, x => x ? 'An' : 'Aus')}</div>
      ${b.an ? `<div class="einstell-block"><span>Faktor zur Spielzeit</span>${seg('bzFaktor', BS.FAKTOREN, b.faktor, bruch)}<span class="klein gedaempft">1 = gleich viel wie Spielzeit. Gleiche Regeln (Serie, 2. Versuch, Hilfen).</span></div>
      ${maxBlock('bz', b, BS.HOECHSTWERTE, 'Minuten.')}
      <div class="einstell-block"><span>Abschicken ab</span>${seg('bzAb', BS.MINDESTWERTE, b.ab)}<span class="klein gedaempft">Minuten. Vorher kann ${esc(name())} noch nichts abschicken.</span></div>
      ${extraBlock('bzExtra', b, A.minutenText(heute), esc(name()))}` : ''}
    </section>`;
}

// Übersicht: Quote je Paket und je Etappe (Aufgaben ab Version 2.13.0 wissen, aus welchem Paket sie kamen)
function paketQuotenKarte(vonTag) {
  const q = A.paketQuoten(D.daten.aufgaben, vonTag);
  const ids = Object.keys(q);
  if (!ids.length) return '';
  const pct = (x) => x.anzahl ? Math.round(x.erst / x.anzahl * 100) : 0;
  return `<section class="karte liste-karte">
    <div class="karte-kopf"><h2>Pakete</h2><span class="klein gedaempft">richtig im 1. Versuch</span></div>
    ${ids.map(id => { const x = q[id]; const n = (paketVon(id) || {}).name || id; return `<div class="themen-zeile">
      <span class="themen-name">${esc(n)}</span><span class="themen-balken"><span style="width:${pct(x)}%" class="${pct(x) >= 75 ? 'gut' : 'mittel'}"></span></span>
      <span class="themen-quote">${pct(x)} %</span><span class="themen-info">${x.anzahl}</span>
      ${Object.keys(x.etappen).length ? `<span class="themen-kurz">${Object.entries(x.etappen).map(([e, y]) => `Etappe ${e}: ${y.erst} von ${y.anzahl}`).join(' · ')}</span>` : ''}
    </div>`; }).join('')}
  </section>`;
}

// Übersicht-Kachel Bildschirmzeit: im Zeitraum verdient und eingelöst (abgeschickt), dazu der Kontostand auf dem Gerät
// Konto je Gerät (stand.json → bildschirm, ab App 2.26.4), über alle Geräte zusammen
function bzKonto() {
  const l = ((D.daten && D.daten.staende) || []).map(x => x.stand && x.stand.bildschirm).filter(b => b && Number.isFinite(b.stand));
  return l.length ? { stand: l.reduce((s, b) => s + b.stand, 0) } : null;
}
function bzKachelZeigen(k) {
  const w = D.daten.einst && D.daten.einst.werte && D.daten.einst.werte.bildschirm;
  return !!((w && w.an) || k.bzVerdientSek || k.bzEingeloest);
}
function bzKachelZusatz(k) {
  const konto = bzKonto();
  return `${A.minutenText(k.bzEingeloestSek)} eingelöst${k.bzEingeloest ? ` (${k.bzEingeloest}-mal)` : ''}${konto ? ` · ${A.minutenText(konto.stand)} noch nicht abgeschickt` : ''}`;
}
// Übersicht: heute verdient und abgeschickte Bildschirmzeit mit Code
function bzKarte() {
  const ein = D.daten.eintraege || [];
  const liste = A.bzAnfragen(ein);
  const w = A.bzWerte((D.daten.einst && D.daten.einst.werte && D.daten.einst.werte.bildschirm) || (neuesterStand() && neuesterStand().bzRegeln));
  const heute = A.bzHeute(ein);
  if (!liste.length && !heute) return '';
  const zeitText = (t) => BS.zeitpunktText(new Date(t));
  return `<section class="karte liste-karte bz-liste">
    <div class="karte-kopf"><h2>Bildschirmzeit</h2></div>
    <div class="bz-zeile"><div><b>Heute</b><span class="klein gedaempft block">verdient ${A.minutenText(heute)} von ${w.max + w.extraMin} Min.</span></div></div>
    ${liste.slice(0, 10).map(e => `<div class="bz-zeile"><div><b>${esc(zeitText(e.t))}</b><span class="klein gedaempft block">${A.minutenText(e.sekunden)} · ${e.aufgaben} ${e.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}</span></div><span class="bz-code">${esc(e.code || '–')}</span></div>`).join('')}
    ${liste.length ? '<p class="klein gedaempft">Stimmt der Code in der Nachricht mit dem hier überein, ist die Anfrage echt.</p>' : ''}
  </section>`;
}

function splitterKurzText() {
  const st = neuesterStand(), sp = st && st.splitter;
  if (!sp) return 'noch keine Daten';
  return `${sp.stand} Splitter · ${sp.frei.length} von ${SP.NEUE_SPIELE.length} frei`;
}

function splitterSeite() {
  const w = entwurfHolen().splitter;
  const st = neuesterStand(), sp = st && st.splitter;
  const frei = new Set([...(sp ? sp.frei : []), ...w.frei]);
  const angekommen = new Set(sp ? sp.boni || [] : []);
  const offeneBoni = w.boni.filter(b => !angekommen.has(b.id));
  const zeit = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }) + ' ' + uhr(iso);
  const stand = sp ? `<section class="info-box">
      <p><b>${sp.stand} Runensplitter</b> · insgesamt ${sp.gesamt} verdient</p>
      <p class="klein">Tagesziel (10 Aufgaben) an ${sp.tage && sp.tage.zahl ? sp.tage.zahl : 0} Tagen am Stück${sp.tage && sp.tage.letzter ? `, zuletzt am ${new Date(sp.tage.letzter + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}` : ''}.${sp.steinschieber ? ` Steinschieber: ${sp.steinschieber.geschafft} von 30 Level geschafft.` : ''}${sp.runenfall ? ` Runenfall: Rekord ${A.punkteText(sp.runenfall.rekord)} Punkte.` : ''}</p>
      <p class="klein gedaempft">Stand vom ${wann(st.stand)}.</p></section>`
    : `<section class="info-box"><p>Von ${esc(name())} kam noch kein Stand mit Runensplittern. Die App ab Version 2.2.0 schickt ihn mit.</p></section>`;
  const spiele = SP.NEUE_SPIELE.map((g, i) => {
    const istFrei = frei.has(g.id), vonHand = w.frei.includes(g.id) && !(sp && sp.frei.includes(g.id));
    return `<div class="einstell-block baukasten-zeile"><div class="baukasten-kopf">
      <span class="gewicht-name"><b>${i + 1}. ${esc(g.name)}</b> <span class="klein ${istFrei ? 'gruen' : 'gedaempft'}">${istFrei ? (vonHand ? 'wird freigeschaltet' : 'freigeschaltet') : g.fertig ? 'gesperrt' : 'kommt bald'}</span></span>
      ${stepper('splitterPreis', `data-i="${i}"`, `${w.preise[i]} Splitter`, 'Preis ' + g.name)}</div>
      ${!istFrei ? `<div class="baukasten-haeufig"><button class="knopf-text klein" data-act="splitterFrei" data-id="${g.id}">Ohne Splitter freischalten</button></div>` : ''}
    </div>`;
  }).join('');
  const verlauf = sp && sp.verlauf && sp.verlauf.length ? sp.verlauf.slice(0, 30).map(e => `<div class="gewicht-zeile"><span class="gewicht-name">${esc(e.text)}</span><span class="klein ${e.n < 0 ? 'gedaempft' : 'gruen'}">${e.n > 0 ? '+' : ''}${e.n}</span><span class="klein gedaempft">${zeit(e.t)}</span></div>`).join('') : '<p class="klein gedaempft">Noch nichts.</p>';
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>
    <h1>Runensplitter für ${esc(name())}</h1>
    ${stand}
    <h2 class="abschnitt">Neue Spiele und Preise</h2>
    <p class="klein gedaempft">Die Spiele werden der Reihe nach freigeschaltet. Der Preis gilt für das jeweilige Spiel. Auf Test-Handys kann man alle fertigen Spiele schon ausprobieren.</p>
    <section class="karte liste-karte">${spiele}</section>
    ${JSON.stringify(w.preise) !== JSON.stringify(SP.PREISE_STANDARD) ? '<button class="knopf-text" data-act="splitterPreiseStandard">Preise zurücksetzen</button>' : ''}
    <h2 class="abschnitt">Bonus schenken</h2>
    <section class="karte klein-karte">
      <div class="zwei-felder"><label class="feld">Splitter<input id="b-n" type="number" min="1" max="500" value="10" inputmode="numeric"></label>
      <label class="feld breit-feld">Grund<input id="b-text" type="text" maxlength="60" placeholder="z. B. Super Woche!"></label></div>
      <button class="knopf" data-act="splitterBonus">Bonus vormerken</button>
      ${offeneBoni.length ? `<p class="klein amber">Wird gesendet: ${offeneBoni.map(b => `+${b.n} ${esc(b.text)}`).join(', ')}</p>` : ''}
    </section>
    ${speicherLeiste()}
    <h2 class="abschnitt">Verlauf</h2>
    <p class="klein gedaempft">Einzelne gelöste Aufgaben (+1) sind hier zusammen mit den besonderen Erfolgen aufgeführt.</p>
    <section class="karte liste-karte">${verlauf}</section>
  </div>`;
}

// ---------- Baukästen: Stufe und Häufigkeit ----------
// Welches Thema die Häufigkeit eines Baukastens steuert. Geschichten hängen an einem anderen Baukasten-Thema.
const GEN_THEMA = {
  'minus-plus': 'minus-zahlen', 'reihenfolge': 'reihenfolge', 'potenz': 'potenzen', 'einmaleins': 'einmaleins', 'mal10': 'mal-10',
  'prozent': 'prozent', 'baukasten': 'prozent-baukasten', 'prozent-formel': 'prozent-formel', 'runden': 'runden', 'bruch-bild': 'bruch-bild', 'kugel': 'kugel', 'zylinder': 'zylinder', 'kegel': 'kegel', 'pyramide': 'pyramide', 'kreisdiagramm': 'kreisdiagramm'
};
const GEN_WIE = { 'geld-geschichte': ['minus-zahlen'], 'rabatt-geschichte': ['rabatt', 'neuer-preis'] };

// Freigaben mit Datum (Auftrag 21): neue Aufgabenformen erst ab dem Tag, an dem der Bogen sie eingeführt hat
const FREIGABE_TEXTE = { minusminus: ['Doppeltes Minus und Minus in Klammern', 'Minus-Zahlen: 6 − (−4). Reihenfolge: 10 − (3 − 8). Etwa jede 4. Aufgabe, die ersten 5 mit Zwischenschritt.'],
  prozent_formel: ['Prozent mit Formel', 'W = G · p : 100: Formel direkt, im Text, Rabatt mit Formel. Steht die Art im Wochenplan unter „gesperrt“, wird sie ab diesem Tag frei.'] };
function freigabeKarte(w) {
  const f = w.freigaben || {}, heute = L.tagKey();
  return `<section class="karte liste-karte">${L.FREIGABEN.map(k => {
    const ab = f[k], an = !!ab;
    return `<div class="einstell-block"><span>${esc(FREIGABE_TEXTE[k][0])}<span class="klein gedaempft block">${esc(FREIGABE_TEXTE[k][1])}${an ? ` ${ab > heute ? `In der App ab ${tagKurz(ab)}.` : `In der App seit ${tagKurz(ab)}.`}` : ''}</span></span><div class="segmente" role="group">${[[0, 'Aus'], [1, 'An']].map(([v, t]) => `<button class="segment${(v === 1) === an ? ' an' : ''}" data-act="freigabe" data-k="${k}" data-v="${v}" aria-pressed="${(v === 1) === an}">${t}</button>`).join('')}</div></div>`;
  }).join('')}</section>`;
}

function baukastenZeile(g, w, liveStufe) {
  const kopf = `<div class="baukasten-kopf"><span class="gewicht-name"><b>${esc(GEN_NAMEN[g])}</b>${geaenderteStufen.has(g) ? ` <span class="klein amber">vorher Stufe ${liveStufe(g)}</span>` : ''}</span>${stepper('stufe', `data-g="${g}"`, `Stufe ${w.genStufen[g]}`, GEN_NAMEN[g])}</div>`;
  const t = GEN_THEMA[g];
  let haeufig;
  if (t) {
    const pk = paketVon(w.paket.id);
    const paketWert = pk ? pk.gewichte[t] : null;
    const angepasst = t in w.abweichungen;
    haeufig = `<div class="baukasten-haeufig">
      <span class="segmente klein-seg" role="group" aria-label="Häufigkeit ${esc(GEN_NAMEN[g])}">${P.STUFEN.map(st => `<button class="segment${w.gewichte[t] === st.w ? ' an' : ''}" data-act="gewicht" data-t="${t}" data-w="${st.w}" aria-pressed="${w.gewichte[t] === st.w}">${st.name}</button>`).join('')}</span>
      <span class="klein ${angepasst ? 'amber' : 'gedaempft'}">${angepasst ? `angepasst · Paket: ${P.stufeName(paketWert)}` : 'wie im Paket'}</span>${angepasst ? ` <button class="knopf-text klein" data-act="abweichungWeg" data-t="${t}">wie im Paket</button>` : ''}
    </div>`;
  } else {
    const themen = GEN_WIE[g] || [];
    const wert = Math.max(0, ...themen.map(x => w.gewichte[x] || 0));
    haeufig = `<div class="baukasten-haeufig"><span class="klein gedaempft">Häufigkeit: ${P.stufeName(wert)} – wie ${themen.map(x => esc(THEMA_NAMEN[x] || x)).join(' / ')}</span></div>`;
  }
  return `<div class="einstell-block baukasten-zeile">${kopf}${haeufig}</div>`;
}

// ---------- Mehrere Pakete beim Kind, Lerneinheiten mit Etappen ----------

const morgen = () => { const d = new Date(); d.setDate(d.getDate() + 1); return L.tagKey(d); };
const rolleChip = (r) => `<span class="rolle r-${r}">${LP.ROLLEN_NAMEN[r]}</span>`;
function etappeText(p, lang = false) {
  const et = p.paket.etappen;
  if (!et) return `${Object.values(p.paket.gewichte).filter(v => v > 0).length} Themen${p.rolle === 'grund' ? ' · Einstieg kommt immer von hier' : ''}`;
  const akt = p.etappe > 0 ? `Etappe ${p.etappe} von ${et.length} · ${et[p.etappe - 1].name}` : `noch nicht begonnen (${et.length} Etappen)`;
  return akt + (p.naechste ? ` · Etappe ${p.naechste.etappe} ${p.naechste.ab === morgen() ? 'ab morgen' : p.naechste.ab <= L.tagKey() ? 'ab heute' : 'ab ' + tagKurz(p.naechste.ab)}` : '');
}

function paketeKarte(w, gewaehlt = null) {
  const summe = w.pakete.reduce((s, p) => s + p.anteil, 0);
  const frei = allePakete().filter(p => !w.pakete.some(x => x.id === p.id));
  return `<section class="karte liste-karte pakete-karte">
    <div class="karte-kopf"><h2>Pakete</h2><button class="knopf-text" data-act="pkVorschlag">50 / 40 / 10 vorschlagen</button></div>
    ${w.pakete.map(p => LP.wartetAufStart(p) ? `<div class="pk wartet${p.id === gewaehlt ? ' gewaehlt' : ''}">
      <div class="pk-kopf"><b>${esc(p.paket.name)}</b><span class="rolle r-wartet">wartet</span></div>
      <p class="start-zeile">${svg('uhr', 16)}<span>${esc(gross(LP.startText(p, w.pakete)))}. Dann ${esc(p.start.anteile[p.id] ?? 0)} %.</span></p>
      <a class="etappe-link" href="#einheit/${encodeURIComponent(p.id)}"><span>Start und Etappen ansehen</span>${svg('weiter', 16)}</a>
    </div>` : `<div class="pk${p.id === gewaehlt ? ' gewaehlt' : ''}">
      <div class="pk-kopf"><b>${esc(p.paket.name)}</b>${rolleChip(p.rolle)}</div>
      <label class="anteil"><span class="unsichtbar">Anteil ${esc(p.paket.name)}</span><input type="range" min="0" max="100" step="10" value="${p.anteil}" data-pk="${esc(p.id)}"><b>${p.anteil} %</b></label>
      <a class="etappe-link" href="#einheit/${encodeURIComponent(p.id)}"><span>${esc(etappeText(p))}</span>${svg('weiter', 16)}</a>
    </div>`).join('')}
    <div class="summe"><span>Zusammen</span><span class="${summe === 100 ? 'ok' : 'nicht-ok'}">${summe} %${summe === 100 ? ' ✓' : ' – bitte auf 100 % bringen'}</span></div>
    ${w.pakete.filter(LP.wartetAufStart).map(p => `<p class="klein gedaempft pad start-hinweis">Startet ${esc(p.paket.name)}, gelten die geplanten Anteile. Was du vorher hier änderst, wird dann überschrieben.</p>`).join('')}
    ${frei.length ? `<label class="einstell-zeile"><span>Paket hinzufügen</span><select id="pk-neu"><option value="">Wählen …</option>${frei.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.etappen ? ` (${p.etappen.length} Etappen)` : ''}</option>`).join('')}</select></label>` : ''}
    <label class="einstell-zeile"><span>Etappe dem Kind zeigen<span class="klein gedaempft block">„Du übst gerade: Zylinder · Etappe 2 von 4“ auf dem Startbildschirm</span></span><input type="checkbox" class="schalter" id="e-etappe"${w.etappe_anzeigen ? ' checked' : ''}></label>
  </section>`;
}

function einheitDetail(w, p) {
  const et = p.paket.etappen;
  const quoten = (A.paketQuoten(D.daten.aufgaben, '0000-00-00')[p.id] || { etappen: {} }).etappen;
  const qText = (n) => { const q = quoten[n]; return q ? ` · ${q.erst} von ${q.anzahl} im 1. Versuch` : ''; };
  const sitzt = et && p.etappe > 0 ? LP.etappeSitzt(A.etappenAufgaben(D.daten.aufgaben, p.id, p.etappe)) : null;
  const n = et ? et.length : 0;
  return `<section class="karte liste-karte einheit-karte">
    <div class="karte-kopf"><h2>${esc(p.paket.name)}</h2>${LP.wartetAufStart(p) ? '<span class="rolle r-wartet">wartet</span>' : `${rolleChip(p.rolle)}<span class="klein gedaempft">${p.anteil} %</span>`}</div>
    ${p.paket.beschreibung ? `<p class="klein gedaempft pad">${esc(p.paket.beschreibung)}</p>` : ''}
    ${LP.wartetAufStart(p) ? startKarte(w, p) : ''}
    ${et ? `<p class="klein gedaempft pad">Weiter: ${{ hand: 'von Hand', vorschlag: 'Vorschlag', automatisch: 'automatisch' }[p.paket.weiter]}${p.naechste ? ` · Etappe ${p.naechste.etappe} ab ${p.naechste.ab === morgen() ? 'morgen' : ''} (${tagKurz(p.naechste.ab)})`.replace('ab  (', 'ab (') : ''}</p>
    ${et.map(e => `<div class="et${e.nr < p.etappe ? ' fertig' : ''}${e.nr === p.etappe ? ' aktuell' : ''}"><span class="nr">${e.nr}</span><div class="txt"><b>${mathe(e.name)}</b><span class="klein gedaempft">${esc(e.bogen || '')}${qText(e.nr)}</span>${e.nr === p.etappe ? '<span class="marke">aktuell</span>' : ''}${!LP.etappeOffen(p.paket, e.nr, D.logbuch || []) ? '<span class="marke bald">kommt bald</span>' : ''}${p.naechste && p.naechste.etappe === e.nr ? `<span class="marke">${p.naechste.ab === morgen() ? 'ab morgen' : 'ab ' + tagKurz(p.naechste.ab)}</span>` : ''}</div></div>`).join('')}
    ${p.rolle === 'einheit' ? `<div class="einstell-block mind"><span>Neue Etappe mindestens<span class="klein gedaempft block">So viele von 10 Aufgaben kommen aus der aktuellen Etappe${p.etappe > 0 && et[p.etappe - 1] ? ` (Etappe ${p.etappe}: ${mathe(et[p.etappe - 1].name)})` : ''}, auch auf anderen Plätzen. Detektive zählen nicht.</span></span><div class="segmente" role="group">${LP.ETAPPE_MINDEST.map(v => `<button class="segment${(p.etappe_mindest ?? 2) === v ? ' an' : ''}" data-act="etMindest" data-pk="${esc(p.id)}" data-v="${v}" aria-pressed="${(p.etappe_mindest ?? 2) === v}">${v || 'aus'}</button>`).join('')}</div><span class="klein gedaempft">von 10 Aufgaben</span></div>` : ''}
    ${sitzt && sitzt.anzahl ? `<p class="${sitzt.sitzt ? 'sitzt' : 'sitzt-noch'}">Etappe ${p.etappe}${sitzt.sitzt ? ' sitzt' : ''}: ${sitzt.gut} von ${sitzt.anzahl} im 1. Versuch${sitzt.anzahl < 10 ? ' (letzte Aufgaben der Etappe)' : ''}</p>` : ''}
    ${LP.wartetAufStart(p) ? '' : `<div class="knopf-spalte">
      <button class="knopf haupt" data-act="etBogen" data-pk="${esc(p.id)}"${(p.naechste ? p.naechste.etappe : p.etappe) >= n ? ' disabled' : ''}>Bogen erledigt – nächste Etappe ab morgen</button>
      <div class="knopf-reihe"><button class="knopf" data-act="etSofort" data-pk="${esc(p.id)}"${!p.naechste && p.etappe >= n ? ' disabled' : ''}>Sofort</button><button class="knopf" data-act="etZurueck" data-pk="${esc(p.id)}"${!p.naechste && p.etappe <= 0 ? ' disabled' : ''}>Eine Etappe zurück</button></div>
      ${p.rolle === 'einheit' ? `<button class="knopf gestrichelt" data-act="einheitFertig" data-pk="${esc(p.id)}">Einheit fertig → Wiederholung</button>` : ''}
    </div>`}` : `<p class="klein gedaempft pad">Dieses Paket hat keine Etappen. Die Themen stellst du unter „Aufgabenpakete“ ein.</p>`}
  </section>
  <section class="karte liste-karte">
    <label class="einstell-zeile"><span>Rolle</span><select id="pk-rolle" data-pk="${esc(p.id)}">${LP.ROLLEN.map(r => `<option value="${r}"${r === p.rolle ? ' selected' : ''}>${LP.ROLLEN_NAMEN[r]}</option>`).join('')}</select></label>
    ${p.rolle !== 'grund' ? `<div class="knopf-spalte"><button class="knopf" data-act="pkWeg" data-pk="${esc(p.id)}">Paket entfernen</button></div>` : '<p class="klein gedaempft pad">Das Grundpaket lässt sich nicht entfernen. Mach zuerst ein anderes Paket zum Grundpaket.</p>'}
  </section>`;
}

// Paket mit „start“ (Auftrag 15): wann es startet, was sich dann ändert, Knöpfe „Jetzt starten“ und „Start entfernen“
const gross = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Etappe laut Lerndaten der App (automatisch weitergeschaltet), sonst laut Einstellung
function etappeInApp(id, liste) {
  const ev = ((D.daten && D.daten.eintraege) || []).filter(e => e.typ === 'etappe_neu' && e.paket === id && typeof e.nach === 'number');
  const ein = (liste.find(x => x.id === id) || {}).etappe || 0;
  return ev.length ? Math.max(ein, ev[ev.length - 1].nach) : ein;
}
function startKarte(w, p) {
  const st = p.start;
  const ausl = w.pakete.find(x => x.id === st.wenn.paket);
  const stand = ausl ? etappeInApp(ausl.id, w.pakete) : 0;
  const nameVon = (id) => { const x = w.pakete.find(y => y.id === id); return x ? x.paket.name : id; };
  const rolleVon = (id) => st.rollen[id] || (w.pakete.find(y => y.id === id) || {}).rolle;
  const ids = [...new Set([...Object.keys(st.anteile), ...w.pakete.map(x => x.id)])].filter(id => w.pakete.some(x => x.id === id));
  return `<div class="start-box">
    <p class="start-titel">${svg('uhr', 18)}<b>${esc(gross(LP.startText(p, w.pakete)))}</b></p>
    ${ausl ? `<p class="klein">${esc(ausl.paket.name)} steht ${stand >= st.wenn.etappe ? 'schon auf' : 'gerade auf'} Etappe ${stand} von ${(ausl.paket.etappen || []).length}.</p>` : `<p class="klein amber">Das Paket „${esc(st.wenn.paket)}“ fehlt bei ${esc(name())}. Ohne es startet ${esc(p.paket.name)} nicht von selbst.</p>`}
    <p class="klein gedaempft">Dann gilt, am selben Tag:</p>
    <div class="start-anteile">${ids.map(id => `<div class="${id === p.id ? 'neu' : ''}"><span>${esc(nameVon(id))}</span>${rolleChip(rolleVon(id))}<b>${st.anteile[id] ?? 0} %</b></div>`).join('')}</div>
    <p class="klein gedaempft">${esc(p.paket.name)} beginnt mit Etappe 1 und dem Logbuch-Eintrag. Änderst du vorher Rollen oder Anteile, gelten beim Start trotzdem diese Anteile.</p>
    <div class="knopf-reihe"><button class="knopf haupt breit" data-act="pkStartJetzt" data-pk="${esc(p.id)}">Jetzt starten</button><button class="knopf breit" data-act="pkStartWeg" data-pk="${esc(p.id)}">Start entfernen</button></div>
  </div>`;
}

function einheitSeite(id) {
  const w = entwurfHolen();
  const p = w.pakete.find(x => x.id === id) || w.pakete[0];
  const zurueck = `<a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>`;
  if (breit.matches) {
    return `<div class="seite"><header class="kopf-breit"><h1>Pakete für ${esc(name())}</h1>${nutzerWahl('nutzer-chip nur-hoch')}</header>${zurueck}
      <div class="einheit-spalten"><div>${paketeKarte(w, p.id)}</div><div>${einheitDetail(w, p)}</div></div>${speicherLeiste()}</div>`;
  }
  return `<div class="seite schmal-inhalt">${zurueck}${einheitDetail(w, p)}${speicherLeiste()}</div>`;
}

// Änderungen an der Paketliste: Grundpaket in die alten Felder übernehmen
function paketeGeaendert() { A.grundUebernehmen(entwurf, paketVon); meldung = null; zeichne(); }
function etappeAendern(id, art) {
  const p = entwurf.pakete.find(x => x.id === id);
  if (!p || !p.paket.etappen) return;
  const n = p.paket.etappen.length;
  if (art === 'bogen') { const basis = p.naechste ? p.naechste.etappe : p.etappe; if (basis < n) p.naechste = { etappe: basis + 1, ab: morgen() }; }
  else if (art === 'sofort') { p.etappe = Math.min(n, p.naechste ? p.naechste.etappe : p.etappe + 1); delete p.naechste; }
  else if (art === 'zurueck') { if (p.naechste) delete p.naechste; else p.etappe = Math.max(0, p.etappe - 1); }
  paketeGeaendert();
}

// ---------- Themen und Gewichte ----------

function gewichteKurz(g) {
  const viel = Object.values(g).filter(v => v === 4).length, aus = Object.values(g).filter(v => v === 0).length;
  return [viel ? `${viel} viel` : '', aus ? `${aus} aus` : ''].filter(Boolean).join(' · ') || 'alle normal';
}

function gewichtZeilen(g, vergleich, act, abweichungen = null) {
  const anteile = P.kopfAnteile(g);
  const zeile = (t) => `<div class="gewicht-zeile">
    <span class="gewicht-name">${esc(THEMA_NAMEN[t] || t)}${P.KOPF_THEMEN.includes(t) && g[t] ? ` <span class="klein gedaempft">≈ ${anteile[t]} %</span>` : ''}${abweichungen && t in abweichungen ? ` <span class="klein amber">angepasst · Paket: ${P.stufeName(vergleich ? vergleich[t] : 2)}</span> <button class="knopf-text klein" data-act="abweichungWeg" data-t="${t}">wie im Paket</button>` : ''}</span>
    <span class="segmente klein-seg" role="group" aria-label="${esc(THEMA_NAMEN[t] || t)}">${P.STUFEN.map(st => `<button class="segment${g[t] === st.w ? ' an' : ''}" data-act="${act}" data-t="${t}" data-w="${st.w}" aria-pressed="${g[t] === st.w}">${st.name}</button>`).join('')}</span>
  </div>`;
  return `<h2 class="abschnitt">Kurze Aufgaben (7 von 10)</h2>
    <section class="karte liste-karte">${P.KOPF_THEMEN.map(zeile).join('')}</section>
    <h2 class="abschnitt">Text, Schritte und Abschluss</h2>
    <p class="klein gedaempft">Daraus kommen die übrigen 3 von 10 Aufgaben. „Minus-Zahlen“ steuert auch die Geld-Geschichten, „Prozent-Baukasten“ die Schritte-Aufgaben, „Kugel“ und „Runden“ den Abschluss.</p>
    <section class="karte liste-karte">${P.WEITERE_THEMEN.map(zeile).join('')}</section>`;
}

function gewichteSeite() {
  const w = entwurfHolen();
  const p = paketVon(w.paket.id);
  const anzahl = Object.keys(w.abweichungen).length;
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>
    <h1>Themen für ${esc(name())}</h1>
    <section class="info-box"><p>Paket: <b>${esc(w.paket.name)}</b>${anzahl ? ` · ${anzahl} ${anzahl === 1 ? 'Thema' : 'Themen'} für ${esc(name())} angepasst` : ''}</p>
      <p class="klein">Ändert sich das Paket, gilt das auch für ${esc(name())}. Angepasste Themen bleiben so, wie du sie hier eingestellt hast.</p>
      <p class="klein">aus = kommt nicht vor · wenig = halb so oft wie normal · viel = doppelt so oft wie normal</p>
      ${anzahl ? '<button class="knopf-text" data-act="paketStandard">Alle Anpassungen entfernen</button>' : ''}</section>
    ${gewichtZeilen(w.gewichte, p ? p.gewichte : null, 'gewicht', w.abweichungen)}
    ${speicherLeiste()}
  </div>`;
}

// ---------- Aufgabenpakete ----------

function paketJson(p) {
  return JSON.stringify({ format: p.etappen ? LP.FORMAT2 : P.FORMAT, id: p.id, name: p.name, fach: p.fach || 'mathe', beschreibung: p.beschreibung || '', gewichte: p.gewichte,
    ...(p.etappen ? { weiter: p.weiter || 'hand', etappen: p.etappen } : {}) }, null, 1);
}

function paketeSeite() {
  const erg = paketText.ergebnis;
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>
    <h1>Aufgabenpakete</h1>
    <p class="klein gedaempft">Ein Paket legt fest, welche Themen vorkommen und wie oft. Pro Kind wählst du in den Einstellungen ein Paket und kannst die Gewichte dort noch anpassen.</p>
    ${meldung ? `<p class="meldung ${meldung.art}">${esc(meldung.text)}</p>` : ''}
    ${allePakete().map(p => `<section class="karte paket-karte">
      <div class="paket-kopf"><h2>${esc(p.name)}</h2>${p.eingebaut ? '<span class="badge b-offen">eingebaut</span>' : ''}</div>
      ${p.beschreibung ? `<p class="klein">${esc(p.beschreibung)}</p>` : ''}
      <p class="klein gedaempft">${gewichteKurz(p.gewichte)}${p.etappen ? ` · Lerneinheit mit ${p.etappen.length} Etappen` : ''}</p>
      <div class="knopf-reihe"><a class="knopf als-link" href="#paket/${encodeURIComponent(p.id)}">Bearbeiten</a><button class="knopf" data-act="paketKopieren" data-id="${esc(p.id)}">Als Text kopieren</button></div>
    </section>`).join('')}
    <a class="knopf haupt breit als-link" href="#paket/neu">Neues Paket</a>
    <h2 class="abschnitt">Paket von Claude einfügen</h2>
    <section class="karte">
      <p class="klein">Bitte Claude im Projekt um ein Aufgabenpaket (Format in <i>06-aufgabenpakete.md</i>, mit Etappen in <i>12-lerneinheiten-und-pakete.md</i>) und füge den Text hier ein.</p>
      <label class="feld"><span class="unsichtbar">Paket als Text</span><textarea id="p-text" rows="7" placeholder='{"name": "…", "gewichte": {"einmaleins": 4, …}}'>${esc(paketText.text)}</textarea></label>
      ${erg ? `${erg.fehler.map(f => `<p class="fehler-text">${esc(f)}</p>`).join('')}${erg.hinweise.length ? `<details class="klein"><summary>${erg.hinweise.length} Hinweise</summary>${erg.hinweise.map(h => `<p>${esc(h)}</p>`).join('')}</details>` : ''}${erg.paket ? `<p class="meldung ok">„${esc(erg.paket.name)}“ ist in Ordnung: ${gewichteKurz(erg.paket.gewichte)}.${paketVon(erg.paket.id) ? ' Ein Paket mit diesem Namen gibt es schon, es wird ersetzt.' : ''}</p>` : ''}` : ''}
      <div class="knopf-reihe"><button class="knopf" data-act="paketTextPruefen">Prüfen</button>${erg && erg.paket ? '<button class="knopf haupt breit" data-act="paketTextSpeichern">Paket speichern</button>' : ''}</div>
    </section>
  </div>`;
}

function paketSeite(id) {
  if (!paketEntwurf || paketEntwurf.route !== id) {
    const vorlage = id === 'neu' ? null : paketVon(id);
    paketEntwurf = vorlage
      ? { route: id, neu: false, eingebaut: !!vorlage.eingebaut && !D.pakete.some(p => p.id === id), id: vorlage.id, name: vorlage.name, beschreibung: vorlage.beschreibung || '', gewichte: { ...vorlage.gewichte },
        fach: vorlage.fach, weiter: vorlage.weiter, etappen: vorlage.etappen }
      : { route: id, neu: true, id: '', name: '', beschreibung: '', gewichte: { ...P.STANDARD_PAKET.gewichte } };
  }
  const e = paketEntwurf;
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#pakete">${svg('zurueck', 20)}Aufgabenpakete</a>
    <h1>${e.neu ? 'Neues Paket' : 'Paket bearbeiten'}</h1>
    <section class="karte">
      <label class="feld">Name<input id="p-name" type="text" maxlength="40" value="${esc(e.name)}" placeholder="z. B. Klasse 7 Grundlagen" autocomplete="off"></label>
      <label class="feld">Beschreibung (optional)<input id="p-beschr" type="text" maxlength="300" value="${esc(e.beschreibung)}" autocomplete="off"></label>
      ${e.eingebaut ? '<p class="klein gedaempft">Das ist das eingebaute Paket. Beim Speichern wird deine Fassung im Daten-Repo abgelegt und ersetzt es.</p>' : ''}
    </section>
    ${e.etappen ? `<section class="info-box"><p><b>Lerneinheit mit ${e.etappen.length} Etappen</b></p>${e.etappen.map(x => `<p class="klein">${x.nr}. ${esc(x.name)}${x.bogen ? ` · ${esc(x.bogen)}` : ''}</p>`).join('')}<p class="klein gedaempft">Etappen änderst du über „Paket von Claude einfügen“.</p></section>` : ''}
    ${gewichtZeilen(e.gewichte, null, 'pgewicht')}
    <p class="klein gedaempft">Änderungen gelten sofort für alle Kinder mit diesem Paket. Was du bei einem Kind extra angepasst hast, bleibt bei ihm so.</p>
    <div class="speicher-leiste">
      ${meldung ? `<p class="meldung ${meldung.art}">${esc(meldung.text)}</p>` : ''}
      <div class="knopf-reihe">${!e.neu && !e.eingebaut ? '<button class="knopf" data-act="paketLoeschen">Löschen</button>' : ''}<button class="knopf haupt breit" data-act="paketSpeichern">Paket speichern</button></div>
    </div>
  </div>`;
}

async function paketSchreiben(paket, alteId) {
  await U.dateiSchreiben(C, `pakete/${paket.id}.json`, paketJson(paket), `Aufgabenpaket ${paket.name}`);
  D.pakete = [...D.pakete.filter(p => p.id !== paket.id && p.id !== alteId), paket];
  return kinderNachziehen(paket);
}

// Alle Kinder, die dieses Paket nutzen, bekommen die neuen Paket-Gewichte (ihre Anpassungen bleiben)
async function kinderNachziehen(paket) {
  const namen = [];
  for (const n of D.nutzer || []) {
    const pfad = `daten/${n.ordner}/einstellungen.json`;
    const alt = await U.dateiLesen(C, pfad);
    const neu = A.einstellungMitNeuemPaket(alt, paket);
    if (!neu) continue;
    await U.dateiSchreiben(C, pfad, JSON.stringify(neu, null, 1), `Einstellungen für ${n.ordner}: Paket ${paket.name} geändert (Version ${neu.version})`);
    if (D.daten && D.daten.ordner === n.ordner) { D.daten.einst = neu; entwurf = null; geaenderteStufen = new Set(); }
    namen.push(D.daten && D.daten.ordner === n.ordner ? D.daten.name : n.name);
  }
  return namen;
}

async function paketSpeichern() {
  const e = paketEntwurf;
  const geprueft = P.paketPruefen({ id: e.neu ? undefined : e.id, name: e.name, beschreibung: e.beschreibung, gewichte: e.gewichte, fach: e.fach, weiter: e.weiter, etappen: e.etappen });
  if (!geprueft.paket) { meldung = { art: 'fehler', text: geprueft.fehler.join(' ') }; return zeichne(); }
  const paket = geprueft.paket;
  if (e.neu) { let id = paket.id, n = 2; while (paketVon(id)) id = `${paket.id}-${n++}`; paket.id = id; }
  meldung = { art: 'info', text: 'Wird gespeichert …' }; zeichne();
  try {
    const kinder = await paketSchreiben(paket);
    paketEntwurf = null;
    meldung = { art: 'ok', text: `Paket „${paket.name}“ gespeichert.${kinder.length ? ` Gilt jetzt auch für ${kinder.join(' und ')}.` : ''}` };
    location.hash = '#pakete';
  } catch (err) { meldung = { art: 'fehler', text: err.message || 'Speichern hat nicht geklappt.' }; zeichne(); }
}

// Lohn nach Mühe (Auftrag 18): Faktor je Aufgabenart, gilt für Spielzeit und Bildschirmzeit
const MUEHE_TEXTE = {
  schrein: { kurz: 'Einmaleins, Mal 10, Runden, Reihenfolge, Bruch aus Bild, Dreierblöcke', normal: 'Potenz mit Zwischenschritt, Prozent, kurze Geldgeschichte, Auswahl', lang: 'Textaufgaben, Prozent-Baukasten, Rabatt, mehrere Fragen, Zuordnung, Gleich viel gefärbt', schwer: 'Kugel, Zylinder, Kegel, Pyramide, Fehler-Detektiv' },
  sternzeit: { kurz: 'Zehnerpotenzen schreiben, Einheiten umrechnen, Gleichungen Stufe 1', normal: 'Zehnerpotenzen rechnen, Formeln umstellen, Dichte ρ und Umrechnen, Auswahl', lang: 'Geschichten, In Schritten umformen, Dichte mit mehreren Schritten', schwer: 'Knobeln, Physik-Geschichten, Dichte und Gewichtskraft' }
};
const MUEHE_TITEL = { kurz: 'Kurze Kopfaufgaben', normal: 'Normale Aufgaben', lang: 'Text und Schritte', schwer: 'Körper und Knobeln' };
const faktorKurz = (x) => ({ 0.5: '½', 1.25: '1¼', 1.5: '1½' })[x] || String(x).replace('.', ',');
function muehAbschnitt(w, r) {
  const texte = MUEHE_TEXTE[w.gestaltung === 'sternzeit' ? 'sternzeit' : 'schrein'];
  const std = L.SPIELZEIT_STANDARD.muehe;
  return `<h2 class="abschnitt">Mühe je Aufgabenart</h2>
    <section class="karte liste-karte">
      <p class="klein gedaempft pad" style="padding-top:12px">Lohn = Spielzeit nach Serienplatz × Faktor. Gilt auch für Bildschirmzeit.</p>
      ${L.MUEHE_GRUPPEN.map(g => `<div class="einstell-block"><span>${MUEHE_TITEL[g]}<span class="klein gedaempft block">${esc(texte[g])}</span></span><div class="segmente" role="group">${L.MUEHE_FAKTOREN.map(v =>
        `<button class="segment${r.muehe[g] === v ? ' an' : ''}" data-act="muehe" data-g="${g}" data-v="${v}" aria-pressed="${r.muehe[g] === v}">×${faktorKurz(v)}</button>`).join('')}</div></div>`).join('')}
      <div class="knopf-spalte"><button class="knopf" data-act="muehStandard">Standard: ${L.MUEHE_GRUPPEN.map(g => faktorKurz(std[g])).join(' / ')}</button></div>
    </section>`;
}
function durchklickAbschnitt(r) {
  const seg = (act, werte, akt, text) => `<div class="segmente" role="group">${werte.map(v => `<button class="segment${v === akt ? ' an' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${v === akt}">${text(v)}</button>`).join('')}</div>`;
  return `<h2 class="abschnitt">Gegen Raten und Durchklicken</h2>
    <section class="karte liste-karte">
      <div class="einstell-block"><span>Hinweis gegen Durchklicken<span class="klein gedaempft block">Nach zwei zu schnellen Eingaben in einer Aufgabe: „Durchklicken bringt dir keine Zeit …“. Die Aufgabe oder eine ähnliche kommt wieder.</span></span>${seg('durchklick', [1, 0], r.durchklick ? 1 : 0, v => (v ? 'An' : 'Aus'))}</div>
      <div class="einstell-block"><span>Bonuszeit, wenn sie dann im 1. Versuch klappt</span>${seg('bonusF', L.BONUS_FAKTOREN, r.bonus, v => '×' + faktorKurz(v))}</div>
      <div class="einstell-block"><span>„Hilf mir“ ab<span class="klein gedaempft block">Der Knopf zählt am Anfang jedes Schritts herunter. Nach einem falschen Versuch ist er sofort frei.</span></span>${seg('hilfeAb', L.HILFE_AB, r.hilfeAb, v => (v ? v + ' s' : 'sofort'))}</div>
    </section>`;
}

function spielzeitSeite() {
  const w = entwurfHolen();
  const r = w.spielzeit;
  const staffelNamen = ['Aufgabe 1 bis 3', 'Aufgabe 4 bis 6', 'Aufgabe 7 bis 9', 'Ab Aufgabe 10'];
  const minFeld = (id, wert, label) => `<span class="stepper"><button class="knopf-klein" data-act="minuten" data-feld="${id}" data-d="-1" aria-label="${label} weniger">−</button><label><span class="unsichtbar">${label} in Minuten</span><input class="min-feld" id="${id}" inputmode="decimal" value="${zahlText(wert)}" autocomplete="off"></label><span class="einheit">Min.</span><button class="knopf-klein" data-act="minuten" data-feld="${id}" data-d="1" aria-label="${label} mehr">+</button></span>`;
  const anteil = (k, titel, unter = '') => `<div class="einstell-block"><span>${titel}${unter ? `<span class="klein gedaempft block">${unter}</span>` : ''}</span><div class="segmente">${[[1, 'Alles'], [0.5, 'Hälfte'], [0, 'Nichts']].map(([v, t]) =>
    `<button class="segment${r[k] === v ? ' an' : ''}" data-act="anteil" data-k="${k}" data-v="${v}" aria-pressed="${r[k] === v}">${t}</button>`).join('')}</div></div>`;
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>
    <h1>Spielzeit pro Aufgabe</h1>
    <h2 class="abschnitt">Richtig im 1. Versuch</h2>
    <section class="karte liste-karte">${staffelNamen.map((n, i) => `<div class="einstell-zeile"><span>${n}</span>${minFeld('s' + i, r.staffel[i], n)}</div>`).join('')}</section>
    <p class="klein gedaempft">Eine Nachkommastelle möglich, z. B. 1,2 Min. Höchstens 10 Min.</p>
    ${muehAbschnitt(w, r)}
    <h2 class="abschnitt">Anteile</h2>
    <section class="karte liste-karte">
      ${anteil('zweit', 'Richtig im 2. Versuch nach zu schnellen Eingaben', 'Ein überlegter 2. Versuch gibt immer die volle Zeit.')}
      ${anteil('rechner', 'Mit freiwilligem Taschenrechner')}
      ${anteil('hilfe', 'Mit „Hilf mir“ (nächster Schritt)')}
      <div class="einstell-zeile"><span>Geschenkt pro Stunde</span>${minFeld('basis', r.basisMin, 'Geschenkte Zeit')}</div>
    </section>
    ${durchklickAbschnitt(r)}
    <section class="hinweis-box"><p><b>So wirkt es:</b> 10 Aufgaben am Stück, alle im 1. Versuch richtig, bringen bis zu <b>${zahlText(A.serieMinuten(r))} Min.</b> Spielzeit.</p><p class="klein">App verlassen bei Aufgaben ohne Rechner halbiert die Zeit weiterhin (ab dem 3. Mal am Tag: keine Zeit).</p></section>
    <button class="knopf" data-act="standardZeit">Standardwerte einsetzen</button>
    ${speicherLeiste()}
  </div>`;
}

// ---------- Handy per QR-Code einrichten ----------

function qrSeite() {
  if (!qr.name && D.daten && D.daten.name) qr.name = D.daten.name;
  const eltern = qr.art === 'eltern' || qr.art === 'boegen', gross = qr.art === 'boegen';
  const svgCode = qr.link ? (() => {
    const q = qrcode(0, 'M');
    q.addData(qr.link);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
  })() : '';
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>
    <h1>Per QR-Code einrichten</h1>
    <div class="segmente" role="group" aria-label="Was einrichten?">
      <button class="segment${eltern ? '' : ' an'}" data-act="qrArt" data-art="kind" aria-pressed="${!eltern}">Kinder-Handy</button>
      <button class="segment${eltern && !gross ? ' an' : ''}" data-act="qrArt" data-art="eltern" aria-pressed="${eltern && !gross}">Weitere Eltern-App</button>
      <button class="segment${gross ? ' an' : ''}" data-act="qrArt" data-art="boegen" aria-pressed="${gross}">Nur Bögen</button>
    </div>
    <p class="klein gedaempft">${gross
      ? `Für ein Gerät der Großeltern: Die Eltern-App zeigt dort nur die Bögen von ${esc(name())} (ansehen, drucken, Zeit messen, Feedback). Übersicht, Verlauf und Einstellungen fehlen.`
      : eltern
      ? 'Für ein weiteres Eltern-Gerät (z. B. iPad oder das Handy der Mutter): Code zeigen und dort in der Eltern-App scannen.'
      : 'Nach dem Löschen der App vom Home-Bildschirm oder für ein neues Handy: Code zeigen und auf dem Kinder-Handy scannen. Danach kommen Spielzeit und Spielstände vom Server zurück.'}</p>
    ${qr.link ? `
    <section class="karte qr-karte">
      <div class="qr-bild" role="img" aria-label="QR-Code zum Einrichten">${svgCode}</div>
      ${eltern ? `<p><b>So geht's auf dem anderen Gerät:</b></p>
      <ol class="klein">
        <li>Eltern-App öffnen (${esc(new URL('./', location.href).href)}).</li>
        <li>Auf „Mit QR-Code einrichten“ tippen.</li>
        <li>Kamera auf diesen Code halten.</li>
      </ol>` : `<p><b>So geht's auf dem Kinder-Handy:</b></p>
      <ol class="klein">
        <li>Übungs-App öffnen.</li>
        <li>Beim Namen auf „Mit QR-Code aus der Eltern-App einrichten“ tippen (oder im Elternbereich „QR-Code scannen“).</li>
        <li>Kamera auf diesen Code halten.</li>
      </ol>`}
      <p class="hinweis-box klein">Der Code enthält den Zugangsschlüssel. Nur zum Scannen zeigen, nicht fotografieren oder verschicken.</p>
      <div class="knopf-reihe"><button class="knopf" data-act="qrLinkKopieren">Link kopieren</button><button class="knopf haupt breit" data-act="qrAus">Code ausblenden</button></div>
    </section>` : `
    <section class="karte">
      ${eltern ? '' : `<label class="feld">Name des Kindes<input id="qr-name" type="text" maxlength="20" value="${esc(qr.name)}" autocomplete="off"></label>`}
      <label class="feld">Zugangsschlüssel für ${gross ? 'das Gerät der Großeltern' : eltern ? 'das andere Eltern-Gerät' : 'das Kinder-Handy'}<input id="qr-token" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(qr.token)}"></label>
      <p class="klein gedaempft">Am besten ein eigener Schlüssel pro Gerät (nur Daten-Repo, „Contents: Read and write“)${gross ? ', mit Ablaufdatum kurz nach dem Besuch' : ''}. Er wird hier nicht gespeichert.</p>
      <button class="knopf-text" data-act="qrEigenerSchluessel">Schlüssel dieser Eltern-App verwenden</button>
      <p class="fehler-text" id="qr-fehler">${meldung && meldung.art === 'fehler' ? esc(meldung.text) : ''}</p>
      <button class="knopf haupt breit" data-act="qrZeigen">QR-Code zeigen</button>
    </section>`}
  </div>`;
}

function schluesselKarte() {
  return `<section class="karte klein-karte geraet-karte">
    <h2>Diese Eltern-App</h2>
    <p class="klein">Repo <b>${esc(C.repo)}</b> · Schlüssel endet auf …${esc(C.token.slice(-4))} · Version ${ELTERN_VERSION}</p>
    <button class="knopf-text" data-act="abmelden">Schlüssel von diesem Gerät löschen</button>
  </section>`;
}

async function speichern() {
  const n = D.daten;
  const summe = entwurf.pakete.reduce((s, p) => s + p.anteil, 0);
  if (summe !== 100) { meldung = { art: 'fehler', text: `Die Anteile der Pakete ergeben ${summe} %. Bitte auf 100 % bringen.` }; return zeichne(); }
  meldung = { art: 'info', text: 'Wird gesendet …' };
  zeichne();
  try {
    const alt = await U.dateiLesen(C, `daten/${n.ordner}/einstellungen.json`); // frisch lesen, falls ein anderes Gerät gespeichert hat
    const datei = A.einstellungsDatei(alt, entwurf, [...geaenderteStufen]);
    await U.dateiSchreiben(C, `daten/${n.ordner}/einstellungen.json`, JSON.stringify(datei, null, 1), `Einstellungen für ${n.ordner} (Version ${datei.version})`);
    n.einst = datei;
    entwurf = null; geaenderteStufen = new Set();
    meldung = { art: 'ok', text: `Gespeichert. Kommt an, sobald ${n.name} die App öffnet.` };
  } catch (e) {
    meldung = { art: 'fehler', text: e.message || 'Senden hat nicht geklappt.' };
  }
  zeichne();
}

// ---------- Einrichten ----------

function zeichneEinrichten(fehler = '') {
  app.innerHTML = `<div class="einrichten">
    ${logo(72)}
    <h1>Schrein der Zahlen · Eltern</h1>
    <p>Hier siehst du die Lerndaten und änderst die Einstellungen der Übungs-App.</p>
    <section class="karte">
      <label class="feld">Daten-Repo (Besitzer/Name)<input id="r-repo" type="text" value="${esc(C.repo)}" placeholder="besitzer/LearningToolsTracking" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="feld">Zugangsschlüssel<input id="r-token" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <p class="fehler-text" id="r-fehler" role="alert">${esc(fehler)}</p>
      <button class="knopf haupt breit" data-act="verbinden">Verbinden</button>
    </section>
    <section class="karte">
      <p class="klein">Schon eine Eltern-App eingerichtet? Dort unter Einstellungen → „Per QR-Code einrichten“ → „Weitere Eltern-App“ einen Code zeigen lassen.</p>
      <button class="knopf breit" data-act="elternScan">Mit QR-Code einrichten</button>
    </section>
    <details class="karte klein-karte"><summary>Wie bekomme ich einen Schlüssel?</summary>
      <ol class="klein">
        <li>Auf github.com: Settings → Developer settings → Fine-grained tokens → Generate new token.</li>
        <li>Repository access: <b>Only select repositories</b>, nur das Daten-Repo.</li>
        <li>Permissions: <b>Contents: Read and write</b>.</li>
        <li>Für jedes Eltern-Gerät einen eigenen Schlüssel anlegen. Dann lässt sich jedes Gerät einzeln sperren.</li>
      </ol>
      <p class="klein">Der Schlüssel bleibt nur auf diesem Gerät.</p>
    </details>
  </div>`;
}

// Einrichtung per QR-Code (Kamera oder Link)
async function elternEinrichten(d, fehlerFeld) {
  try {
    const info = await U.verbindungTesten({ repo: d.repo, token: d.token });
    if (!info.privat) throw new Error('Das Repo ist öffentlich. Bitte nur ein privates Repo verwenden.');
    C = { ...C, repo: d.repo, token: d.token };
    if (d.art === 'boegen') C.nur = 'boegen'; else delete C.nur;
    konfigSichern();
    if (d.name) C.nutzer = d.name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    konfigSichern();
    history.replaceState(null, '', location.pathname + (C.nur ? '#boegen' : '#uebersicht'));
    leseRoute();
    allesLaden({ nutzerliste: true });
  } catch (e) {
    zeichneEinrichten(e.message || 'Verbindung nicht möglich.');
  }
}

function elternScan() {
  app.innerHTML = `<div class="einrichten">
    <h1>QR-Code scannen</h1>
    <p class="klein gedaempft">Halte die Kamera auf den Code aus der anderen Eltern-App.</p>
    <div class="scan-bild"><video id="scan-video" playsinline muted autoplay></video><span class="scan-rahmen"></span></div>
    <p class="klein gedaempft" id="scan-info">Kamera wird gestartet …</p>
    <details class="karte klein-karte"><summary>Kamera geht nicht? Link einfügen</summary>
      <textarea id="scan-text" rows="3" placeholder="Link einfügen"></textarea>
      <button class="knopf" data-act="elternScanText">Übernehmen</button>
    </details>
    <button class="knopf" data-act="elternScanZu">Zurück</button>
  </div>`;
  const info = (t) => { const i = document.getElementById('scan-info'); if (i) i.textContent = t; };
  kameraScan(document.getElementById('scan-video'), '../vendor/jsQR.js', (text) => {
    const d = einrichtungLesen(text);
    if (!d) { info('Das ist kein Einrichtungs-Code.'); return false; }
    info('Code erkannt. Verbindung wird geprüft …');
    elternEinrichten(d);
    return true;
  }).then(stopp => { scanStopp = stopp; info('Suche nach dem Code …'); })
    .catch(e => info(e && e.name === 'NotAllowedError' ? 'Die Kamera ist nicht erlaubt. Du kannst den Link unten einfügen.' : (e.message || 'Die Kamera konnte nicht gestartet werden.')));
}

// Deep Link auf einen Bogen (Auftrag 31): …/eltern/#bogen/<kind>/<id> → Kind wählen, #boegen/<id> öffnen.
// Gibt true zurück, wenn das Kind gewechselt wurde (dann neu laden).
function bogenLinkPruefen() {
  const l = A.bogenLinkLesen(location.hash);
  if (!l) return false;
  history.replaceState(null, '', location.pathname + location.search + '#boegen/' + encodeURIComponent(l.id));
  leseRoute();
  if (l.kind === C.nutzer) return false;
  C.nutzer = l.kind; if (C.token) konfigSichern();
  D.daten = null; entwurf = null; geaenderteStufen = new Set(); meldung = null;
  return true;
}
// Link aus der Kamera-App (…/eltern/#einrichten=…)
function linkPruefen() {
  const d = einrichtungLesen(location.hash);
  if (!d) return false;
  history.replaceState(null, '', location.pathname);
  app.innerHTML = '<div class="einrichten"><p>Wird eingerichtet …</p></div>';
  elternEinrichten(d);
  return true;
}

async function verbinden() {
  const repo = document.getElementById('r-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const token = document.getElementById('r-token').value.trim();
  const f = document.getElementById('r-fehler');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { f.textContent = 'Bitte das Repo als Besitzer/Name angeben.'; return; }
  if (token.length < 20) { f.textContent = 'Bitte den ganzen Schlüssel einfügen.'; return; }
  f.textContent = 'Wird geprüft …';
  try {
    const info = await U.verbindungTesten({ repo, token });
    if (!info.privat) { f.textContent = 'Das Repo ist öffentlich. Bitte nur ein privates Repo verwenden.'; return; }
    C = { ...C, repo, token };
    konfigSichern();
    if (!location.hash) location.hash = '#uebersicht';
    allesLaden({ nutzerliste: true });
  } catch (e) {
    f.textContent = e.message;
  }
}

// ---------- Ereignisse ----------

function minutenLesen(id) {
  const el = document.getElementById(id);
  const n = Number(String(el ? el.value : '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function minutenSetzen(feld, wert) {
  const r = entwurf.spielzeit;
  const max = feld === 'basis' ? 15 : 10;
  const v = Math.round(Math.min(max, Math.max(0, wert)) * 10) / 10;
  if (feld === 'basis') r.basisMin = v; else r.staffel[Number(feld.slice(1))] = v;
}

// ---------- Neue Version suchen ----------
// Prüft beim Start, beim Zurückkehren in die App und alle 15 Minuten eltern/version.json
// und die Version der Übungs-App (die Eltern-App nutzt deren Dateien in ../js/ mit).
// Ohne Offline-Speicher: Vor dem Neuladen werden alle Dateien mit cache: 'reload' frisch geholt,
// damit der Browser nicht die alten Dateien aus seinem Zwischenspeicher nimmt.
const DATEIEN = ['../js/feedback.js', 'lernplan.mjs', 'lernplan.css', './', 'index.html', 'eltern.js', 'eltern.css', 'auswertung.js', 'vendor/qrcode.mjs', 'manifest.webmanifest',
  '../js/sync.js', '../js/logic.js', '../js/namen.js', '../js/render.js', '../js/paket.js', '../js/einrichtung.js',
  '../js/physik.js', '../js/umformen.js', '../js/lernplan.js', '../js/bildschirm.js', '../js/splitter.js', '../js/hinweiskarten.js', '../data/logbuch.json'];
let basisVersion = null;   // Version der Übungs-App beim Laden dieser Seite
let neueVersion = null;
let updateSpaeter = false;
let letztePruefung = 0;

async function versionHolen(url) {
  const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return (await r.json()).version || null;
}

async function updatePruefen() {
  letztePruefung = Date.now();
  try {
    const [eigene, basis] = await Promise.all([versionHolen('version.json'), versionHolen('../version.json').catch(() => null)]);
    if (basisVersion === null) basisVersion = basis;
    let neu = null;
    if (eigene && eigene !== ELTERN_VERSION) neu = eigene;
    else if (basis && basisVersion && basis !== basisVersion) neu = ELTERN_VERSION + ' (Übungs-App ' + basis + ')';
    if (!neu) return;
    neueVersion = neu;
    updateAnbieten();
  } catch (e) { /* offline: später nochmal */ }
}

// Gerade wird etwas eingegeben oder bearbeitet? Dann nicht einfach neu laden.
function inArbeit() {
  const a = document.activeElement;
  if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.name !== 'nutzer-wahl') return true;
  if (paketEntwurf || qr.token || qr.link || scanStopp || laedt) return true;
  if (['spielzeit', 'gewichte', 'paket', 'qr', 'einheit'].includes(route.seite)) return true;
  if (!C.token && document.querySelector('#r-token')?.value) return true;
  return false;
}

function updateAnbieten() {
  if (!neueVersion) return;
  if (!inArbeit()) { updateLaden(); return; }
  if (updateSpaeter || document.getElementById('update-leiste')) return;
  const d = document.createElement('div');
  d.id = 'update-leiste';
  d.className = 'update-leiste';
  d.setAttribute('role', 'status');
  d.innerHTML = `<span>Neue Version der Eltern-App ist da.</span>
    <button class="knopf haupt" data-act="updateLaden">Jetzt laden</button>
    <button class="knopf-text" data-act="updateSpaeter">Später</button>`;
  document.body.appendChild(d);
}

async function updateLaden() {
  // Schutz gegen Neuladen in Dauerschleife, falls der Server noch alte Dateien liefert
  let versuch = null;
  try { versuch = JSON.parse(sessionStorage.getItem('eltern-update') || 'null'); } catch (e) { /* egal */ }
  if (versuch && versuch.v === neueVersion && Date.now() - versuch.t < 10 * 60 * 1000) return;
  try { sessionStorage.setItem('eltern-update', JSON.stringify({ v: neueVersion, t: Date.now() })); } catch (e) { /* egal */ }
  document.getElementById('update-leiste')?.remove();
  const d = document.createElement('div');
  d.className = 'update-leiste';
  d.innerHTML = '<span>Neue Version wird geladen …</span>';
  document.body.appendChild(d);
  await Promise.all(DATEIEN.map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
  location.reload();
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'verbinden': verbinden(); break;
    case 'neuLaden': allesLaden({ nutzerliste: true }); break;
    case 'updateLaden': updateLaden(); break;
    case 'datenLaden': datenHinweisWeg(); allesLaden(); break;
    case 'datenSpaeter': datenHinweisWeg(); break;
    case 'updateSpaeter': updateSpaeter = true; document.getElementById('update-leiste')?.remove(); break;
    case 'zeitraum': C.zeitraum = Number(el.dataset.n); konfigSichern(); zeichne(); break;
    case 'filter': filter = el.dataset.f; zeichne(); break;
    case 'stufe': {
      const g = el.dataset.g;
      entwurf.genStufen[g] = Math.max(1, Math.min(3, entwurf.genStufen[g] + Number(el.dataset.d)));
      const start = A.startWerte(D.daten.einst, neuesterStand(), paketVon).genStufen[g];
      if (entwurf.genStufen[g] === start) geaenderteStufen.delete(g); else geaenderteStufen.add(g);
      meldung = null; zeichne(); break;
    }
    case 'minuten': {
      const feld = el.dataset.feld;
      const jetzt = minutenLesen(feld) ?? 0;
      // ± springt auf die nächste halbe Minute
      const ziel = Number(el.dataset.d) > 0 ? Math.floor(jetzt * 2 + 1e-9) / 2 + 0.5 : Math.ceil(jetzt * 2 - 1e-9) / 2 - 0.5;
      minutenSetzen(feld, ziel); meldung = null; zeichne(); break;
    }
    case 'splitterPreis': {
      const i = Number(el.dataset.i), p = entwurf.splitter.preise.slice();
      p[i] = Math.max(0, Math.min(5000, p[i] + Number(el.dataset.d) * 10));
      entwurf.splitter.preise = p; meldung = null; zeichne(); break;
    }
    case 'splitterPreiseStandard': entwurf.splitter.preise = SP.PREISE_STANDARD.slice(); meldung = null; zeichne(); break;
    case 'splitterFrei': if (!entwurf.splitter.frei.includes(el.dataset.id)) entwurf.splitter.frei = [...entwurf.splitter.frei, el.dataset.id]; meldung = null; zeichne(); break;
    case 'splitterBonus': {
      const n = Math.round(Number(document.getElementById('b-n').value));
      const text = document.getElementById('b-text').value.trim() || 'von den Eltern';
      if (!(n > 0 && n <= 500)) { meldung = { art: 'fehler', text: 'Bitte 1 bis 500 Splitter eintragen.' }; zeichne(); break; }
      entwurf.splitter.boni = [...entwurf.splitter.boni, { id: 'b' + Date.now().toString(36), n, text }];
      meldung = null; zeichne(); break;
    }
    case 'anteil': entwurf.spielzeit[el.dataset.k] = Number(el.dataset.v); meldung = null; zeichne(); break;
    case 'muehe': entwurf.spielzeit = { ...entwurf.spielzeit, muehe: { ...entwurf.spielzeit.muehe, [el.dataset.g]: Number(el.dataset.v) } }; meldung = null; zeichne(); break;
    case 'wpEingriff': {
      const art = document.getElementById('wp-art').value, typ = document.getElementById('wp-typ').value, bis = document.getElementById('wp-bis').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bis) || bis < L.tagKey()) { meldung = { art: 'fehler', text: 'Bitte ein Ablaufdatum ab heute wählen.' }; zeichne(); break; }
      const e = typ === 'aus' ? { art, typ: 'aus', bis } : { art, typ: 'plus', wert: Number(typ.split(':')[1]), bis };
      entwurf.eingriffe = [...(entwurf.eingriffe || []).filter(x => x.art !== art || x.bis < L.tagKey()), { ...e, gesetzt: new Date().toISOString() }];
      meldung = null; zeichne(); break;
    }
    case 'wpEingriffWeg': { entwurf.eingriffe = (entwurf.eingriffe || []).filter((_, i) => i !== Number(el.dataset.i)); meldung = null; zeichne(); break; }
    case 'experte': { ev.preventDefault(); experteOffen = !experteOffen; zeichne(); break; }
    case 'freigabe': { const f = { ...(entwurf.freigaben || {}) }; if (el.dataset.v === '1') f[el.dataset.k] = f[el.dataset.k] || L.tagKey(); else delete f[el.dataset.k]; entwurf.freigaben = f; meldung = null; zeichne(); break; }
    case 'muehStandard': entwurf.spielzeit = { ...entwurf.spielzeit, muehe: { ...L.SPIELZEIT_STANDARD.muehe } }; meldung = null; zeichne(); break;
    case 'durchklick': entwurf.spielzeit = { ...entwurf.spielzeit, durchklick: el.dataset.v === '1' }; meldung = null; zeichne(); break;
    case 'bonusF': entwurf.spielzeit = { ...entwurf.spielzeit, bonus: Number(el.dataset.v) }; meldung = null; zeichne(); break;
    case 'hilfeAb': entwurf.spielzeit = { ...entwurf.spielzeit, hilfeAb: Number(el.dataset.v) }; meldung = null; zeichne(); break;
    case 'etMindest': { const p = entwurf.pakete.find(x => x.id === el.dataset.pk); if (p) { p.etappe_mindest = Number(el.dataset.v); meldung = null; zeichne(); } break; }
    case 'gewicht': {
      const t = el.dataset.t, v = Number(el.dataset.w), pk = paketVon(entwurf.paket.id);
      const ab = { ...entwurf.abweichungen };
      if (pk && pk.gewichte[t] === v) delete ab[t]; else ab[t] = v;
      entwurf.abweichungen = ab;
      entwurf.gewichte = pk ? A.gewichteMit(pk.gewichte, ab) : { ...entwurf.gewichte, [t]: v };
      meldung = null; zeichne(); break;
    }
    case 'abweichungWeg': {
      const pk = paketVon(entwurf.paket.id), ab = { ...entwurf.abweichungen };
      delete ab[el.dataset.t];
      entwurf.abweichungen = ab;
      if (pk) entwurf.gewichte = A.gewichteMit(pk.gewichte, ab);
      meldung = null; zeichne(); break;
    }
    case 'langeHinweise': entwurf.langeHinweise = Number(el.dataset.w); meldung = null; zeichne(); break;
    case 'bzAn': entwurf.bildschirm = { ...entwurf.bildschirm, an: el.dataset.w === 'true' }; meldung = null; zeichne(); break;
    case 'bzFaktor': entwurf.bildschirm = { ...entwurf.bildschirm, faktor: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'bzMax': entwurf.bildschirm = { ...entwurf.bildschirm, max: Number(el.dataset.w), maxBis: '', maxDanach: null }; meldung = null; zeichne(); break;
    case 'maxEigen': { const k = el.dataset.art === 'bz' ? 'bildschirm' : 'spielzeitTag', w = entwurf[k]; const liste = el.dataset.art === 'bz' ? BS.HOECHSTWERTE : BS.SZ_HOECHSTWERTE;
      if (liste.includes(w.max)) entwurf[k] = { ...w, maxDanach: w.max, max: Math.min(BS.MAX_FREI.max, liste[liste.length - 1] + 30) }; meldung = null; zeichne(); break; }
    case 'maxBisWeg': { const k = el.dataset.art === 'bz' ? 'bildschirm' : 'spielzeitTag'; entwurf[k] = { ...entwurf[k], maxBis: '', maxDanach: null }; meldung = null; zeichne(); break; }
    case 'gestaltung': entwurf.gestaltung = el.dataset.w; if (entwurf.gestaltung === 'sternzeit' && !entwurf.ansicht_name) entwurf.ansicht_name = 'Logbuch Sternzeit'; meldung = null; zeichne(); break;
    case 'umformStufe': entwurf.umform_stufe = Number(el.dataset.w); meldung = null; zeichne(); break;
    case 'feedbackAn': entwurf.feedback = el.dataset.w === 'true'; meldung = null; zeichne(); break;
    case 'boegenAn': entwurf.boegen_feedback = el.dataset.w === 'true'; meldung = null; zeichne(); break;
    case 'liveAn': entwurf.live = el.dataset.w === 'true'; meldung = null; zeichne(); break;
    case 'brArt': BR.art = el.dataset.w === 'bericht' ? 'bericht' : 'plan'; if (route.arg) location.hash = '#berichte'; else zeichne(); break;
    case 'brNeuLaden': berichteLaden(C.nutzer, true); break;
    case 'bgNeuLaden': BG.hbPdf = {}; bgLaden(true); break;
    case 'hbDrucken': hbDrucken(el.dataset.w); break;
    case 'hbWarnDrucken': hbDrucken('neu'); if (route.arg !== 'hinweisblatt') location.hash = '#boegen/hinweisblatt'; break;
    case 'hbHaken': hbHaken(el.dataset.nr); break;
    case 'foHaken': foHaken(el.dataset.id); break;
    case 'bgZeit': bgZeit(el.dataset.id, el.dataset.w); break;
    case 'bgZeitEnde': { const f = document.getElementById('bgz-ende-' + el.dataset.id); bgZeit(el.dataset.id, 'ende', f && f.value); break; }
    case 'foDrucken': foDrucken(el.dataset.id); break;
    case 'bgWert': { const e = bgEntwurf(el.dataset.id); const k = el.dataset.k; let v = el.dataset.v; if (k === 'dauer') { v = Number(v); dauerSetzen(e, e.dauer === v ? 0 : v); } else e[k] = v; if (k === 'von') { try { localStorage.setItem('bogen-von', v); } catch (x) {} } bgSichern(el.dataset.id, e); zeichne(); break; }
    case 'bgErg': { const e = bgEntwurf(el.dataset.id), u = bgUe(e, el.dataset.nr); u.ergebnis = el.dataset.v; bgSichern(el.dataset.id, e); zeichne(); break; }
    case 'bgChip': { const e = bgEntwurf(el.dataset.id), u = bgUe(e, el.dataset.nr), c = el.dataset.v; u.chips = u.chips.includes(c) ? u.chips.filter(x => x !== c) : [...u.chips, c]; bgSichern(el.dataset.id, e); zeichne(); break; }
    case 'bgZeig': { const k = el.dataset.id + '|' + el.dataset.nr; BG.zeig[k] = BG.zeig[k] === el.dataset.w ? null : el.dataset.w; zeichne(); break; }
    case 'bgBonus': { const e = bgEntwurf(el.dataset.id), u = bgUe(e, el.dataset.nr), v = el.dataset.v; u.bonus = u.bonus && u.bonus.ergebnis === v ? null : { ergebnis: v, notiz: (u.bonus && u.bonus.notiz) || '' }; bgSichern(el.dataset.id, e); zeichne(); break; }
    case 'bgAnsicht': BG.ansicht = { id: el.dataset.id, w: el.dataset.w }; zeichne(); break;
    case 'bgAnsichtZu': BG.ansicht = null; zeichne(); break;
    case 'bgGross': lupeAuf(el.getAttribute('src'), el.getAttribute('alt')); break;
    case 'bgFotoWeg': { const e = bgEntwurf(el.dataset.id), u = bgUe(e, el.dataset.nr); u.fotos = u.fotos.filter((_, i) => i !== Number(el.dataset.i)); bgSichern(el.dataset.id, e); zeichne(); break; }
    case 'bgPdf': bgPdfTeilen(el.dataset.id, el.dataset.w); break;
    case 'bgSpeichern': bgSpeichern(el.dataset.id); break;
    case 'bgFrei': { const id = (document.getElementById('bg-frei-id').value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''); if (!id) { BG.meldung = { art: 'fehler', text: 'Bitte ein Kürzel eingeben, z. B. w6t1.' }; zeichne(); break; } const e = bgEntwurf(id); e.frei = true; bgSichern(id, e); location.hash = '#boegen/' + encodeURIComponent(id); break; }
    case 'bgUeNeu': { const nr = (document.getElementById('bg-ue-nr').value || '').trim(); if (!nr) break; const e = bgEntwurf(el.dataset.id); bgUe(e, nr); bgSichern(el.dataset.id, e); zeichne(); break; }
    case 'bedienung': entwurf[el.dataset.k] = el.dataset.w === 'true'; meldung = null; zeichne(); break;
    case 'ticketsLaden': ticketsLaden(); break;
    case 'lernplanNeu': lernplanLaden(C.nutzer, true); break;
    case 'ticketFilter': C.ticketFilter = el.dataset.w; konfigSichern(); zeichne(); break;
    case 'ticketStatus': ticketStatus(el.dataset.id, el.dataset.w); break;
    case 'ticketAuftragKopieren': ticketAuftragKopieren(el.dataset.id); break;
    case 'uzAn': entwurf.uebungszeit = { ...entwurf.uebungszeit, an: el.dataset.w === 'true' }; meldung = null; zeichne(); break;
    case 'uzMax': entwurf.uebungszeit = { ...entwurf.uebungszeit, max: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'uzNachlauf': entwurf.uebungszeit = { ...entwurf.uebungszeit, nachlauf_prozent: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'uzExtra': entwurf.uebungszeit = { ...entwurf.uebungszeit, extraMin: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'szMax': entwurf.spielzeitTag = { ...entwurf.spielzeitTag, max: Number(el.dataset.w), maxBis: '', maxDanach: null }; meldung = null; zeichne(); break;
    case 'szExtra': entwurf.spielzeitTag = { ...entwurf.spielzeitTag, extraMin: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'szExtraFaktor': entwurf.spielzeitTag = { ...entwurf.spielzeitTag, extraFaktor: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'bzExtraFaktor': entwurf.bildschirm = { ...entwurf.bildschirm, extraFaktor: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'kopf': entwurf.spielzeit = { ...entwurf.spielzeit, kopf: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'pkVorschlag': LP.vorschlag(entwurf.pakete); paketeGeaendert(); break;
    case 'etBogen': etappeAendern(el.dataset.pk, 'bogen'); break;
    case 'etSofort': etappeAendern(el.dataset.pk, 'sofort'); break;
    case 'etZurueck': etappeAendern(el.dataset.pk, 'zurueck'); break;
    case 'einheitFertig': {
      const p = entwurf.pakete.find(x => x.id === el.dataset.pk), g = LP.grundpaket(entwurf.pakete);
      if (!p || !g) break;
      const frei = Math.max(0, p.anteil - 10);
      if (!confirm(`„${p.paket.name}“ wird Wiederholung mit 10 %. Das Grundpaket „${g.paket.name}“ bekommt ${frei} % dazu (dann ${g.anteil + frei} %). Einverstanden?`)) break;
      p.rolle = 'wiederholung'; p.etappe = p.paket.etappen ? p.paket.etappen.length : p.etappe; delete p.naechste;
      p.anteil = Math.min(10, p.anteil); g.anteil += frei;
      paketeGeaendert(); break;
    }
    case 'pkStartJetzt': {
      const p = entwurf.pakete.find(x => x.id === el.dataset.pk);
      if (!p || !p.start || !confirm(`„${p.paket.name}“ jetzt starten? Etappe 1 und die geplanten Anteile gelten, sobald du speicherst und ${name()} die App öffnet.`)) break;
      LP.startAusfuehren(entwurf.pakete, p.id);
      paketeGeaendert(); break;
    }
    case 'pkStartWeg': {
      const p = entwurf.pakete.find(x => x.id === el.dataset.pk);
      if (!p || !p.start || !confirm(`Start von „${p.paket.name}“ entfernen? Das Paket bleibt bei 0 % und startet nicht mehr von selbst. Du kannst es später mit „Sofort“ beginnen.`)) break;
      delete p.start;
      paketeGeaendert(); break;
    }
    case 'pkWeg': {
      const p = entwurf.pakete.find(x => x.id === el.dataset.pk);
      if (!p || p.rolle === 'grund' || !confirm(`„${p.paket.name}“ bei ${name()} entfernen? Die Anteile werden neu verteilt (50 / 40 / 10).`)) break;
      entwurf.pakete = entwurf.pakete.filter(x => x !== p);
      LP.vorschlag(entwurf.pakete);
      location.hash = '#einstellungen';
      paketeGeaendert(); break;
    }
    case 'bzAb': entwurf.bildschirm = { ...entwurf.bildschirm, ab: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'bzExtra': entwurf.bildschirm = { ...entwurf.bildschirm, extraMin: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'paketStandard': { const pk = paketVon(entwurf.paket.id); entwurf.abweichungen = {}; if (pk) entwurf.gewichte = { ...pk.gewichte }; meldung = null; zeichne(); break; }
    case 'pgewicht': paketEntwurf.gewichte[el.dataset.t] = Number(el.dataset.w); meldung = null; zeichne(); break;
    case 'paketSpeichern': paketSpeichern(); break;
    case 'paketLoeschen': {
      const e = paketEntwurf;
      if (!confirm(`Paket „${e.name}“ löschen? Kinder, die es nutzen, behalten ihre jetzigen Gewichte.`)) break;
      U.dateiLoeschen(C, `pakete/${e.id}.json`, `Aufgabenpaket ${e.name} gelöscht`).then(() => {
        D.pakete = D.pakete.filter(x => x.id !== e.id); paketEntwurf = null;
        meldung = { art: 'ok', text: `Paket „${e.name}“ gelöscht.` }; location.hash = '#pakete';
      }).catch(err => { meldung = { art: 'fehler', text: err.message }; zeichne(); });
      break;
    }
    case 'paketKopieren': {
      const pk = paketVon(el.dataset.id);
      const text = paketJson(pk);
      const fertig = (ok) => { meldung = ok ? { art: 'ok', text: `„${pk.name}“ als Text kopiert. Du kannst es jetzt Claude schicken.` } : { art: 'info', text: 'Kopieren ging nicht. Der Text steht unten im Feld.' }; if (!ok) paketText = { text, ergebnis: null }; zeichne(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => fertig(true), () => fertig(false));
      else fertig(false);
      break;
    }
    case 'paketTextPruefen': {
      paketText.text = document.getElementById('p-text').value;
      paketText.ergebnis = P.paketPruefen(paketText.text, { poolIds: new Set(D.pool.keys()) });
      meldung = null; zeichne(); break;
    }
    case 'paketTextSpeichern': {
      const pk = paketText.ergebnis && paketText.ergebnis.paket;
      if (!pk) break;
      meldung = { art: 'info', text: 'Wird gespeichert …' }; zeichne();
      paketSchreiben(pk).then((kinder) => { paketText = { text: '', ergebnis: null }; meldung = { art: 'ok', text: `Paket „${pk.name}“ gespeichert.${kinder.length ? ` Gilt jetzt auch für ${kinder.join(' und ')}.` : ''}` }; zeichne(); })
        .catch(err => { meldung = { art: 'fehler', text: err.message }; zeichne(); });
      break;
    }
    case 'qrArt': qr = { name: qr.name, token: '', link: '', art: el.dataset.art }; meldung = null; zeichne(); break;
    case 'qrEigenerSchluessel': {
      if (!confirm('Dann nutzt das andere Gerät denselben Schlüssel wie diese Eltern-App. Sperrst du ihn später, gehen beide nicht mehr. Trotzdem verwenden?')) break;
      const n = document.getElementById('qr-name'); if (n) qr.name = n.value;
      qr.token = C.token; meldung = null; zeichne(); break;
    }
    case 'qrZeigen': {
      const eltern = qr.art === 'eltern' || qr.art === 'boegen';
      const nEl = document.getElementById('qr-name');
      const name = nEl ? nEl.value.trim().replace(/\s+/g, ' ').slice(0, 20) : '';
      const token = document.getElementById('qr-token').value.trim();
      qr.name = name || qr.name; qr.token = token;
      if (!eltern && name.length < 2) { meldung = { art: 'fehler', text: 'Bitte den Namen des Kindes eingeben (wie in der App).' }; zeichne(); break; }
      if (token.length < 20) { meldung = { art: 'fehler', text: 'Bitte den ganzen Zugangsschlüssel einfügen.' }; zeichne(); break; }
      meldung = null;
      qr.link = eltern
        ? einrichtungsLink(new URL('./', location.href).href, qr.art === 'boegen' ? { repo: C.repo, token, name: C.nutzer, art: 'boegen' } : { repo: C.repo, token, art: 'eltern' })
        : einrichtungsLink(new URL('../', location.href).href, { repo: C.repo, token, name });
      zeichne(); break;
    }
    case 'qrAus': qr = { name: qr.name, token: '', link: '', art: qr.art }; zeichne(); break;
    case 'elternScan': elternScan(); break;
    case 'elternScanText': {
      const d = einrichtungLesen(document.getElementById('scan-text').value);
      if (!d) { document.getElementById('scan-info').textContent = 'Der Link ist nicht richtig. Bitte den ganzen Link einfügen.'; break; }
      if (scanStopp) scanStopp();
      elternEinrichten(d); break;
    }
    case 'elternScanZu': if (scanStopp) scanStopp(); scanStopp = null; zeichneEinrichten(); break;
    case 'qrLinkKopieren':
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(qr.link).then(() => alert('Link kopiert. Auf dem Kinder-Handy im Scan-Fenster unter „Link einfügen“ einfügen.'), () => prompt('Link kopieren:', qr.link));
      else prompt('Link kopieren:', qr.link);
      break;
    case 'standardZeit': { const alt = entwurf.spielzeit || {}; entwurf.spielzeit = { ...L.spielzeitRegeln(null), durchklick: !!alt.durchklick, hilfeAb: alt.hilfeAb ?? 0, bonus: alt.bonus ?? L.SPIELZEIT_STANDARD.bonus }; meldung = null; zeichne(); break; }
    case 'verwerfen': entwurf = null; geaenderteStufen = new Set(); meldung = null; zeichne(); break;
    case 'speichern': if (geaendert()) speichern(); break;
    case 'abmelden':
      if (!confirm('Schlüssel von diesem Gerät löschen? Danach musst du ihn neu eintragen.')) break;
      C = { ...C, token: '' }; konfigSichern(); D.daten = null; D.nutzer = null;
      try { caches.delete('eltern-tage-v1'); } catch (e) { /* egal */ }
      zeichneEinrichten(); break;
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.classList && el.classList.contains('bg-foto') && el.files && el.files.length) { bgFotoNeu(el.dataset.id, el.dataset.nr, el.files); return; }
  if (el.name === 'nutzer-wahl' || el.name === 'tag-wahl') {
    if (el.name === 'tag-wahl') { location.hash = '#verlauf/' + el.value; return; }
    C.nutzer = el.value; konfigSichern();
    D.daten = null; entwurf = null; geaenderteStufen = new Set(); meldung = null;
    allesLaden(); return;
  }
  if (!entwurf) return;
  if (el.dataset.maxfeld) {
    const k = el.dataset.maxfeld === 'bz' ? 'bildschirm' : 'spielzeitTag', n = Math.round(Number(el.value));
    if (Number.isFinite(n)) { entwurf[k] = { ...entwurf[k], max: Math.max(BS.MAX_FREI.min, Math.min(BS.MAX_FREI.max, n)) }; meldung = null; }
    zeichne(); return;
  }
  if (el.dataset.maxbis) {
    const k = el.dataset.maxbis === 'bz' ? 'bildschirm' : 'spielzeitTag', w = entwurf[k];
    entwurf[k] = { ...w, maxBis: el.value || '', maxDanach: el.value ? (w.maxDanach || 45) : null }; meldung = null; zeichne(); return;
  }
  if (el.dataset.pk && el.type === 'range') {
    const p = entwurf.pakete.find(x => x.id === el.dataset.pk);
    if (p) p.anteil = Number(el.value);
  }
  else if (el.id === 'pk-neu' && el.value) {
    const pk = paketVon(el.value);
    if (pk) {
      // neue Lerneinheit: Etappe 0 („noch nicht begonnen“), mit „Bogen erledigt“ startet Etappe 1
      entwurf.pakete.push(LP.eintragNorm({ id: pk.id, rolle: pk.etappen ? 'einheit' : 'wiederholung', anteil: 0, etappe: 0, paket: pk }));
      LP.vorschlag(entwurf.pakete);
      A.grundUebernehmen(entwurf, paketVon);
    }
  }
  else if (el.id === 'pk-rolle') {
    const p = entwurf.pakete.find(x => x.id === el.dataset.pk);
    if (p) {
      if (el.value === 'grund') for (const x of entwurf.pakete) if (x.rolle === 'grund') x.rolle = 'einheit';
      p.rolle = el.value;
      if (!entwurf.pakete.some(x => x.rolle === 'grund')) entwurf.pakete[0].rolle = 'grund';
      A.grundUebernehmen(entwurf, paketVon);
    }
  }
  else if (el.id === 'e-etappe') entwurf.etappe_anzeigen = el.checked;
  else if (el.id === 'e-von' || el.id === 'e-bis') {
    const von = Number(document.getElementById('e-von').value), bis = Number(document.getElementById('e-bis').value);
    entwurf.basisVon = Math.min(von, bis); entwurf.basisBis = Math.max(von, bis);
  } else if (el.id === 'e-rechner') entwurf.rechnerAngebot = el.checked;
  else if (el.classList.contains('min-feld')) { const v = minutenLesen(el.id); if (v != null) minutenSetzen(el.id, v); }
  else return;
  meldung = null;
  zeichne();
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (paketEntwurf && el.id === 'p-name') paketEntwurf.name = el.value;
  if (paketEntwurf && el.id === 'p-beschr') paketEntwurf.beschreibung = el.value;
  if (el.id === 'p-text') paketText.text = el.value;
  if (el.classList && el.classList.contains('bg-text')) { const e = bgEntwurf(el.dataset.id); if (el.dataset.bonus) { const u = bgUe(e, el.dataset.nr); u.bonus = { ergebnis: (u.bonus && u.bonus.ergebnis) || '', notiz: el.value }; } else if (el.dataset.nr) bgUe(e, el.dataset.nr).notiz = el.value; else e.sonst = el.value; bgSichern(el.dataset.id, e); }
  if (el.classList && el.classList.contains('bg-dauer-feld')) { const e = bgEntwurf(el.dataset.id); dauerSetzen(e, Number(el.value)); bgSichern(el.dataset.id, e); return; }
  if (el.id === 'bg-gemacht') { const e = bgEntwurf(el.dataset.id); e.gemacht = el.value; bgSichern(el.dataset.id, e); }
});

// Bögen: auf- und zugeklappte Wochen merken (toggle steigt nicht auf, darum capture)
document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.classList && d.classList.contains('bg-woche')) BG.wochenAuf[d.dataset.woche] = d.open; }, true);
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.target.id === 'r-token' || ev.target.id === 'r-repo')) verbinden();
  if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('min-feld')) ev.target.blur();
});

window.addEventListener('hashchange', () => { if (location.hash.includes('einrichten=')) return linkPruefen(); if (bogenLinkPruefen() && C.token) { allesLaden(); return; } leseRoute(); if (route.seite !== 'qr') qr = { name: '', token: '', link: '', art: 'kind' }; meldung = ['einstellungen', 'spielzeit', 'gewichte', 'pakete', 'splitter', 'einheit'].includes(route.seite) ? meldung : null; zeichne(); window.scrollTo(0, 0); });
breit.addEventListener('change', zeichne);
// Bogen-Feedback (iPhone): waagerecht wischen wechselt die Übung (nicht in Textfeldern, der Leiste oder groß angezeigten Bildern)
(() => {
  let w = null;
  document.addEventListener('touchstart', (ev) => {
    const t = ev.target, box = t.closest && t.closest('.bg-wisch');
    w = box && ev.touches.length === 1 && !t.closest('textarea, input, .bg-leiste, #bg-lupe, .bg-ansicht') ? { box, x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener('touchend', (ev) => {
    if (!w || !ev.changedTouches.length) return;
    const dx = ev.changedTouches[0].clientX - w.x, dy = ev.changedTouches[0].clientY - w.y, ziel = dx < 0 ? w.box.dataset.nach : w.box.dataset.vor;
    w = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && ziel) location.hash = ziel;
  }, { passive: true });
})();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - letztePruefung > 60 * 1000) updatePruefen();
  // Zurück in der App: nachsehen, ob es neue Daten gibt, und das melden (geladen wird erst nach „Laden“)
  if (document.visibilityState === 'visible' && C.token && D.daten && Date.now() - letzteDatenPruefung > 20 * 1000) neueDatenPruefen();
});

// Bei jeder Änderung der Ansicht: ein wartendes Update laden, sobald nichts mehr bearbeitet wird
window.addEventListener('hashchange', () => setTimeout(updateAnbieten, 300));
setInterval(updatePruefen, 15 * 60 * 1000);
setInterval(neueDatenPruefen, 60 * 1000); // solange die Eltern-App offen ist: jede Minute nach neuen Daten sehen

leseRoute();
bogenLinkPruefen();
updatePruefen();
if (!linkPruefen()) { if (C.token) allesLaden(); else zeichneEinrichten(); }
