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
import { einrichtungsLink, einrichtungLesen, kameraScan } from '../js/einrichtung.js';
import qrcode from './vendor/qrcode.mjs';

export const ELTERN_VERSION = '1.23.0';
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
  einstellungen: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/>',
  zurueck: '<path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  weiter: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
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
  const aktiv = route.seite === 'aufgabe' || route.seite === 'spiel' ? 'verlauf' : ['spielzeit', 'gewichte', 'pakete', 'paket', 'qr', 'einheit', 'splitter'].includes(route.seite) ? 'einstellungen' : route.seite;
  return [['uebersicht', 'Übersicht'], ['verlauf', 'Verlauf'], ['einstellungen', 'Einstellungen']].map(([k, t]) =>
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
  const neuKnopf = `<button class="knopf-icon" data-act="neuLaden" aria-label="Neu laden">${svg('neu', 22)}</button>`;
  if (breit.matches) {
    app.innerHTML = `<div class="rahmen-breit">
      <aside class="seitenleiste">
        <div class="marke">${logo(36)}<div><div class="marke-titel">Schrein der Zahlen</div><div class="klein gedaempft">Eltern</div></div></div>
        ${nutzerWahl('nutzer-feld')}
        <nav class="seiten-nav">${navLinks('nav-link')}</nav>
        <div class="seitenleiste-fuss"><span class="klein gedaempft">${standZeile()}</span>${neuKnopf}</div>
      </aside>
      <main class="inhalt-breit${route.seite === 'verlauf' || route.seite === 'aufgabe' ? ' ohne-rand' : ''}">${inhalt}</main>
    </div>`;
  } else {
    app.innerHTML = `<div class="rahmen-schmal">
      <main class="inhalt-schmal">${inhalt}</main>
      <nav class="tabs">${navLinks('tab')}</nav>
    </div>`;
  }
}

function seiteHtml() {
  if (D.fehler && !D.daten) return `<div class="seite"><h1>Laden hat nicht geklappt</h1><p class="hinweis-box">${esc(D.fehler)}</p><button class="knopf haupt" data-act="neuLaden">Nochmal versuchen</button>${schluesselKarte()}</div>`;
  if (!D.daten) return `<div class="seite lade-seite">${logo(64)}<p>Lerndaten werden geladen …</p></div>`;
  if (D.daten.leer) return `<div class="seite"><h1>Noch keine Daten</h1><p>Im Daten-Repo gibt es noch keinen Ordner mit Namen. Sobald sich jemand in der Übungs-App mit Namen angemeldet hat und Daten übertragen wurden, erscheinen sie hier.</p><button class="knopf haupt" data-act="neuLaden">Neu laden</button>${schluesselKarte()}</div>`;
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
    default: return uebersichtSeite();
  }
}

// ---------- Übersicht ----------

function kopfSchmal(titel) {
  return `<header class="kopf-schmal">
    ${logo(34)}
    <div class="kopf-titel"><span class="marke-titel">${esc(titel)}</span><span class="klein gedaempft">${standZeile()}</span></div>
    ${nutzerWahl('nutzer-chip')}
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
    ['Spielzeit verdient', A.minutenText(k.verdientSek), `${A.minutenText(k.gespieltSek)} gespielt`]
  ].map(([l, w, z]) => `<div class="kachel"><span class="kachel-label">${l}</span><span class="kachel-wert">${w}</span><span class="kachel-zusatz">${z}</span></div>`).join('');

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
    <div class="kacheln">${kacheln}</div>
    ${leer}
    <div class="zwei-spalten">
      <div class="spalte">${balken}${!breit.matches ? auff : ''}</div>
      <div class="spalte">${paketQuotenKarte(tage[0])}${uzKarte()}${wissenKarte()}${bzKarte()}${themen}${breit.matches ? auff : ''}</div>
    </div>
  </div>`;
}

// ---------- Verlauf ----------

function tageMitAufgaben() {
  const map = {};
  const tagVon = (k) => map[k] || (map[k] = { tag: k, anzahl: 0, erst: 0, ms: 0, spiele: 0, spielSek: 0 });
  for (const r of D.daten.aufgaben) {
    const d = tagVon(r.tag);
    if (r.ende) { d.anzahl++; if (r.ende.ergebnis === 'erst') d.erst++; d.ms += r.ende.ms || 0; }
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
  const erst = fertig.filter(r => r.ende.ergebnis === 'erst').length;
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
    ${paketeKarte(w)}
    <section class="karte liste-karte">
      <a class="einstell-zeile" href="#gewichte"><span>Themen und Gewichte<span class="klein gedaempft block">Anpassungen für ${esc(name())}, gelten in jedem Paket</span></span><span class="wert">${gewichteKurz(w.gewichte)}</span>${svg('weiter', 16)}</a>
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
    <h2 class="abschnitt">Baukästen: Schwierigkeit und Häufigkeit</h2>
    <section class="karte liste-karte">
      ${Object.keys(GEN_NAMEN).map(g => baukastenZeile(g, w, liveStufe)).join('')}
    </section>
    <p class="klein gedaempft">Die App passt die Stufen weiter selbst an. Was du hier änderst, ist der neue Startpunkt.</p>
    <p class="klein gedaempft">Die Häufigkeit kommt aus dem Paket. Änderst du sie hier, gilt das nur für ${esc(name())}. Das Paket bleibt, wie es ist.</p>
    ${speicherLeiste()}
    <section class="karte liste-karte"><a class="einstell-zeile" href="#pakete"><span>Aufgabenpakete verwalten<span class="klein gedaempft block">anlegen, ändern, mit Claude erstellen</span></span>${svg('weiter', 16)}</a>
      <a class="einstell-zeile" href="#qr"><span>Handy mit QR-Code einrichten<span class="klein gedaempft block">nach dem Löschen der App oder für ein neues Handy</span></span>${svg('weiter', 16)}</a></section>
    ${schluesselKarte()}
  </div>`;
}

// ---------- Runensplitter und neue Spiele ----------

// Gestaltung („Logbuch Sternzeit“) und Übungszeit pro Tag (Auftrag 13)
function gestaltungEinstellungen(w) {
  const u = w.uebungszeit;
  const seg = (act, werte, akt, text = (x) => x) => `<div class="segmente" role="group">${werte.map(x => `<button class="segment${x === akt ? ' an' : ''}" data-act="${act}" data-w="${x}" aria-pressed="${x === akt}">${text(x)}</button>`).join('')}</div>`;
  const st = neuesterStand();
  const heute = st && st.uebung && st.uebung.tag === L.tagKey() ? st.uebung.sek : 0;
  return `<h2 class="abschnitt">Gestaltung, Umformen und Übungszeit</h2>
    <section class="karte liste-karte">
      <div class="einstell-block"><span>Gestaltung der App<span class="klein gedaempft block">Logbuch Sternzeit: dunkle Konsole, Logbuch, Wissensarchiv und Wissenspunkte. Hinweiskarten bleiben gleich.</span></span>${seg('gestaltung', ['schrein', 'sternzeit'], w.gestaltung, x => x === 'schrein' ? 'Schrein' : 'Logbuch Sternzeit')}</div>
      <div class="einstell-block"><span>„In Schritten umformen“: Start-Stufe<span class="klein gedaempft block">3: beide Seiten selbst vereinfachen. 2: die App schreibt eine Seite. 1: die App vereinfacht. Die anderen Stufen gibt es als Hilfe.</span></span>${seg('umformStufe', [3, 2, 1], w.umform_stufe, x => 'Stufe ' + x)}</div>
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

// Spielzeit im Schrein pro Tag: Höchstwert und „nur heute mehr“ (zählt nur mit Aufgaben verdiente Zeit)
function szEinstellungen(w) {
  const z = w.spielzeitTag;
  const seg = (act, werte, akt, text = (x) => x) => `<div class="segmente" role="group">${werte.map(x => `<button class="segment${x === akt ? ' an' : ''}" data-act="${act}" data-w="${x}" aria-pressed="${x === akt}">${text(x)}</button>`).join('')}</div>`;
  const heute = A.szHeute(D.daten.eintraege || []);
  return `<h2 class="abschnitt">Spielzeit im Schrein pro Tag</h2>
    <section class="karte liste-karte">
      <div class="einstell-block"><span>Höchstens pro Tag</span>${seg('szMax', BS.SZ_HOECHSTWERTE, z.max)}<span class="klein gedaempft">Minuten, die ${esc(name())} pro Tag mit Aufgaben verdienen kann. Geschenkte Minuten zählen nicht mit.</span></div>
      <div class="einstell-block"><span>Nur heute mehr zulassen</span>${seg('szExtra', BS.EXTRAS, z.extraMin, x => '+' + x)}<span class="klein gedaempft">Heute: ${z.max + z.extraMin} Min. erlaubt, ${A.minutenText(heute)} verdient. Morgen gilt wieder der normale Wert.</span></div>
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
      <div class="einstell-block"><span>Höchstens pro Tag</span>${seg('bzMax', BS.HOECHSTWERTE, b.max)}<span class="klein gedaempft">Minuten. Gilt jeden Tag.</span></div>
      <div class="einstell-block"><span>Abschicken ab</span>${seg('bzAb', BS.MINDESTWERTE, b.ab)}<span class="klein gedaempft">Minuten. Vorher kann ${esc(name())} noch nichts abschicken.</span></div>
      <div class="einstell-block"><span>Nur heute mehr zulassen</span>${seg('bzExtra', BS.EXTRAS, b.extraMin, x => '+' + x)}<span class="klein gedaempft">Heute: ${b.max + b.extraMin} Min. erlaubt, ${A.minutenText(heute)} verdient. Morgen gilt wieder der normale Wert.</span></div>` : ''}
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
  'prozent': 'prozent', 'baukasten': 'prozent-baukasten', 'runden': 'runden', 'bruch-bild': 'bruch-bild', 'kugel': 'kugel', 'zylinder': 'zylinder'
};
const GEN_WIE = { 'geld-geschichte': ['minus-zahlen'], 'rabatt-geschichte': ['rabatt', 'neuer-preis'] };

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
    ${w.pakete.map(p => `<div class="pk${p.id === gewaehlt ? ' gewaehlt' : ''}">
      <div class="pk-kopf"><b>${esc(p.paket.name)}</b>${rolleChip(p.rolle)}</div>
      <label class="anteil"><span class="unsichtbar">Anteil ${esc(p.paket.name)}</span><input type="range" min="0" max="100" step="10" value="${p.anteil}" data-pk="${esc(p.id)}"><b>${p.anteil} %</b></label>
      <a class="etappe-link" href="#einheit/${encodeURIComponent(p.id)}"><span>${esc(etappeText(p))}</span>${svg('weiter', 16)}</a>
    </div>`).join('')}
    <div class="summe"><span>Zusammen</span><span class="${summe === 100 ? 'ok' : 'nicht-ok'}">${summe} %${summe === 100 ? ' ✓' : ' – bitte auf 100 % bringen'}</span></div>
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
    <div class="karte-kopf"><h2>${esc(p.paket.name)}</h2>${rolleChip(p.rolle)}<span class="klein gedaempft">${p.anteil} %</span></div>
    ${p.paket.beschreibung ? `<p class="klein gedaempft pad">${esc(p.paket.beschreibung)}</p>` : ''}
    ${et ? `<p class="klein gedaempft pad">Weiter: ${{ hand: 'von Hand', vorschlag: 'Vorschlag', automatisch: 'automatisch' }[p.paket.weiter]}${p.naechste ? ` · Etappe ${p.naechste.etappe} ab ${p.naechste.ab === morgen() ? 'morgen' : ''} (${tagKurz(p.naechste.ab)})`.replace('ab  (', 'ab (') : ''}</p>
    ${et.map(e => `<div class="et${e.nr < p.etappe ? ' fertig' : ''}${e.nr === p.etappe ? ' aktuell' : ''}"><span class="nr">${e.nr}</span><div class="txt"><b>${mathe(e.name)}</b><span class="klein gedaempft">${esc(e.bogen || '')}${qText(e.nr)}</span>${e.nr === p.etappe ? '<span class="marke">aktuell</span>' : ''}${!LP.etappeOffen(p.paket, e.nr, D.logbuch || []) ? '<span class="marke bald">kommt bald</span>' : ''}${p.naechste && p.naechste.etappe === e.nr ? `<span class="marke">${p.naechste.ab === morgen() ? 'ab morgen' : 'ab ' + tagKurz(p.naechste.ab)}</span>` : ''}</div></div>`).join('')}
    ${sitzt && sitzt.anzahl ? `<p class="${sitzt.sitzt ? 'sitzt' : 'sitzt-noch'}">Etappe ${p.etappe}${sitzt.sitzt ? ' sitzt' : ''}: ${sitzt.gut} von ${sitzt.anzahl} im 1. Versuch${sitzt.anzahl < 10 ? ' (letzte Aufgaben der Etappe)' : ''}</p>` : ''}
    <div class="knopf-spalte">
      <button class="knopf haupt" data-act="etBogen" data-pk="${esc(p.id)}"${(p.naechste ? p.naechste.etappe : p.etappe) >= n ? ' disabled' : ''}>Bogen erledigt – nächste Etappe ab morgen</button>
      <div class="knopf-reihe"><button class="knopf" data-act="etSofort" data-pk="${esc(p.id)}"${!p.naechste && p.etappe >= n ? ' disabled' : ''}>Sofort</button><button class="knopf" data-act="etZurueck" data-pk="${esc(p.id)}"${!p.naechste && p.etappe <= 0 ? ' disabled' : ''}>Eine Etappe zurück</button></div>
      ${p.rolle === 'einheit' ? `<button class="knopf gestrichelt" data-act="einheitFertig" data-pk="${esc(p.id)}">Einheit fertig → Wiederholung</button>` : ''}
    </div>` : `<p class="klein gedaempft pad">Dieses Paket hat keine Etappen. Die Themen stellst du unter „Aufgabenpakete“ ein.</p>`}
  </section>
  <section class="karte liste-karte">
    <label class="einstell-zeile"><span>Rolle</span><select id="pk-rolle" data-pk="${esc(p.id)}">${LP.ROLLEN.map(r => `<option value="${r}"${r === p.rolle ? ' selected' : ''}>${LP.ROLLEN_NAMEN[r]}</option>`).join('')}</select></label>
    ${p.rolle !== 'grund' ? `<div class="knopf-spalte"><button class="knopf" data-act="pkWeg" data-pk="${esc(p.id)}">Paket entfernen</button></div>` : '<p class="klein gedaempft pad">Das Grundpaket lässt sich nicht entfernen. Mach zuerst ein anderes Paket zum Grundpaket.</p>'}
  </section>`;
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

function spielzeitSeite() {
  const w = entwurfHolen();
  const r = w.spielzeit;
  const staffelNamen = ['Aufgabe 1 bis 3', 'Aufgabe 4 bis 6', 'Aufgabe 7 bis 9', 'Ab Aufgabe 10'];
  const minFeld = (id, wert, label) => `<span class="stepper"><button class="knopf-klein" data-act="minuten" data-feld="${id}" data-d="-1" aria-label="${label} weniger">−</button><label><span class="unsichtbar">${label} in Minuten</span><input class="min-feld" id="${id}" inputmode="decimal" value="${zahlText(wert)}" autocomplete="off"></label><span class="einheit">Min.</span><button class="knopf-klein" data-act="minuten" data-feld="${id}" data-d="1" aria-label="${label} mehr">+</button></span>`;
  const anteil = (k, titel) => `<div class="einstell-block"><span>${titel}</span><div class="segmente">${[[1, 'Alles'], [0.5, 'Hälfte'], [0, 'Nichts']].map(([v, t]) =>
    `<button class="segment${r[k] === v ? ' an' : ''}" data-act="anteil" data-k="${k}" data-v="${v}" aria-pressed="${r[k] === v}">${t}</button>`).join('')}</div></div>`;
  return `<div class="seite schmal-inhalt">
    <a class="zurueck" href="#einstellungen">${svg('zurueck', 20)}Einstellungen</a>
    <h1>Spielzeit pro Aufgabe</h1>
    <h2 class="abschnitt">Richtig im 1. Versuch</h2>
    <section class="karte liste-karte">${staffelNamen.map((n, i) => `<div class="einstell-zeile"><span>${n}</span>${minFeld('s' + i, r.staffel[i], n)}</div>`).join('')}</section>
    <p class="klein gedaempft">Eine Nachkommastelle möglich, z. B. 1,2 Min. Höchstens 10 Min.</p>
    <h2 class="abschnitt">Anteile</h2>
    <section class="karte liste-karte">
      ${anteil('zweit', 'Richtig im 2. Versuch')}
      ${anteil('rechner', 'Mit freiwilligem Taschenrechner')}
      ${anteil('hilfe', 'Mit „Hilf mir“ (nächster Schritt)')}
      <div class="einstell-zeile"><span>Geschenkt pro Stunde</span>${minFeld('basis', r.basisMin, 'Geschenkte Zeit')}</div>
    </section>
    <section class="hinweis-box"><p><b>So wirkt es:</b> 10 Aufgaben am Stück, alle im 1. Versuch richtig, bringen bis zu <b>${zahlText(A.serieMinuten(r))} Min.</b> Spielzeit.</p><p class="klein">App verlassen bei Aufgaben ohne Rechner halbiert die Zeit weiterhin (ab dem 3. Mal am Tag: keine Zeit).</p></section>
    <button class="knopf" data-act="standardZeit">Standardwerte einsetzen</button>
    ${speicherLeiste()}
  </div>`;
}

// ---------- Handy per QR-Code einrichten ----------

function qrSeite() {
  if (!qr.name && D.daten && D.daten.name) qr.name = D.daten.name;
  const eltern = qr.art === 'eltern';
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
      <button class="segment${eltern ? ' an' : ''}" data-act="qrArt" data-art="eltern" aria-pressed="${eltern}">Weitere Eltern-App</button>
    </div>
    <p class="klein gedaempft">${eltern
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
      <label class="feld">Zugangsschlüssel für ${eltern ? 'das andere Eltern-Gerät' : 'das Kinder-Handy'}<input id="qr-token" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(qr.token)}"></label>
      <p class="klein gedaempft">Am besten ein eigener Schlüssel pro Gerät (nur Daten-Repo, „Contents: Read and write“). Er wird hier nicht gespeichert.</p>
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
    konfigSichern();
    if (d.name) C.nutzer = d.name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    konfigSichern();
    history.replaceState(null, '', location.pathname + '#uebersicht');
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
const DATEIEN = ['./', 'index.html', 'eltern.js', 'eltern.css', 'auswertung.js', 'vendor/qrcode.mjs', 'manifest.webmanifest',
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
    case 'bzMax': entwurf.bildschirm = { ...entwurf.bildschirm, max: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'gestaltung': entwurf.gestaltung = el.dataset.w; if (entwurf.gestaltung === 'sternzeit' && !entwurf.ansicht_name) entwurf.ansicht_name = 'Logbuch Sternzeit'; meldung = null; zeichne(); break;
    case 'umformStufe': entwurf.umform_stufe = Number(el.dataset.w); meldung = null; zeichne(); break;
    case 'uzAn': entwurf.uebungszeit = { ...entwurf.uebungszeit, an: el.dataset.w === 'true' }; meldung = null; zeichne(); break;
    case 'uzMax': entwurf.uebungszeit = { ...entwurf.uebungszeit, max: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'uzNachlauf': entwurf.uebungszeit = { ...entwurf.uebungszeit, nachlauf_prozent: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'uzExtra': entwurf.uebungszeit = { ...entwurf.uebungszeit, extraMin: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'szMax': entwurf.spielzeitTag = { ...entwurf.spielzeitTag, max: Number(el.dataset.w) }; meldung = null; zeichne(); break;
    case 'szExtra': entwurf.spielzeitTag = { ...entwurf.spielzeitTag, extraMin: Number(el.dataset.w) }; meldung = null; zeichne(); break;
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
      const eltern = qr.art === 'eltern';
      const nEl = document.getElementById('qr-name');
      const name = nEl ? nEl.value.trim().replace(/\s+/g, ' ').slice(0, 20) : '';
      const token = document.getElementById('qr-token').value.trim();
      qr.name = name || qr.name; qr.token = token;
      if (!eltern && name.length < 2) { meldung = { art: 'fehler', text: 'Bitte den Namen des Kindes eingeben (wie in der App).' }; zeichne(); break; }
      if (token.length < 20) { meldung = { art: 'fehler', text: 'Bitte den ganzen Zugangsschlüssel einfügen.' }; zeichne(); break; }
      meldung = null;
      qr.link = eltern
        ? einrichtungsLink(new URL('./', location.href).href, { repo: C.repo, token, art: 'eltern' })
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
    case 'standardZeit': entwurf.spielzeit = L.spielzeitRegeln(null); meldung = null; zeichne(); break;
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
  if (el.name === 'nutzer-wahl' || el.name === 'tag-wahl') {
    if (el.name === 'tag-wahl') { location.hash = '#verlauf/' + el.value; return; }
    C.nutzer = el.value; konfigSichern();
    D.daten = null; entwurf = null; geaenderteStufen = new Set(); meldung = null;
    allesLaden(); return;
  }
  if (!entwurf) return;
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
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.target.id === 'r-token' || ev.target.id === 'r-repo')) verbinden();
  if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('min-feld')) ev.target.blur();
});

window.addEventListener('hashchange', () => { if (location.hash.includes('einrichten=')) return linkPruefen(); leseRoute(); if (route.seite !== 'qr') qr = { name: '', token: '', link: '', art: 'kind' }; meldung = ['einstellungen', 'spielzeit', 'gewichte', 'pakete', 'splitter', 'einheit'].includes(route.seite) ? meldung : null; zeichne(); window.scrollTo(0, 0); });
breit.addEventListener('change', zeichne);
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
updatePruefen();
if (!linkPruefen()) { if (C.token) allesLaden(); else zeichneEinrichten(); }
