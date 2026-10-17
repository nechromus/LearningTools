// Eltern-App: Lerndaten ansehen (bis zur einzelnen Aufgabe) und Einstellungen der Übungs-App aus der Ferne ändern.
// Daten liegen im privaten Repo (LearningToolsTracking). Der Zugangsschlüssel bleibt nur auf diesem Gerät.
import * as U from '../js/sync.js';
import * as L from '../js/logic.js';
import { THEMA_NAMEN, GEN_NAMEN } from '../js/namen.js';
import { esc, mathe, bildSvg } from '../js/render.js';
import * as A from './auswertung.js';

export const ELTERN_VERSION = '1.0.0';
const KEY = 'eltern-v1';
const MIN_APP = '1.4.0'; // ab dieser Version übernimmt die Übungs-App Einstellungen aus der Ferne

const app = document.getElementById('app');
const breit = window.matchMedia('(min-width: 760px)');

let C = konfigLaden();
const D = { nutzer: null, pool: new Map(), hinweise: {}, daten: null, fehler: null };
let route = { seite: 'uebersicht', arg: '' };
let entwurf = null;
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
  await Promise.all(geraete.map(async g => {
    const dateien = await U.ordnerLesen(C, g.path);
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
    einst, geladen: Date.now()
  };
}

async function allesLaden({ nutzerliste = false } = {}) {
  if (laedt) return;
  laedt = true; D.fehler = null;
  zeichne();
  try {
    if (!D.pool.size) await grunddatenLaden();
    if (nutzerliste || !D.nutzer) await nutzerLaden();
    await datenLaden();
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
  const aktiv = route.seite === 'aufgabe' ? 'verlauf' : route.seite === 'spielzeit' ? 'einstellungen' : route.seite;
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
    case 'einstellungen': return einstellungenSeite();
    case 'spielzeit': return spielzeitSeite();
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
    </div>`).join('')}</section>` : '';

  const auff = k.auffaellig.length ? `<section class="hinweis-box"><h2>Auffällig</h2>${k.auffaellig.slice(0, 5).map(t => `<p>${esc(t)}</p>`).join('')}</section>` : '';
  const leer = !k.aufgaben ? `<p class="gedaempft">In diesem Zeitraum wurden keine Aufgaben gemacht.</p>` : '';

  return `<div class="seite">
    ${breit.matches ? `<header class="kopf-breit"><h1>Übersicht · ${esc(name())}</h1>${nutzerWahl('nutzer-chip nur-hoch')}${zeitraumWahl()}</header>` : kopfSchmal('Übersicht') + zeitraumWahl()}
    <div class="kacheln">${kacheln}</div>
    ${leer}
    <div class="zwei-spalten">
      <div class="spalte">${balken}${!breit.matches ? auff : ''}</div>
      <div class="spalte">${themen}${breit.matches ? auff : ''}</div>
    </div>
  </div>`;
}

// ---------- Verlauf ----------

function tageMitAufgaben() {
  const map = {};
  for (const r of D.daten.aufgaben) {
    const d = map[r.tag] || (map[r.tag] = { tag: r.tag, anzahl: 0, erst: 0, ms: 0 });
    if (r.ende) { d.anzahl++; if (r.ende.ergebnis === 'erst') d.erst++; d.ms += r.ende.ms || 0; }
  }
  return Object.values(map).filter(d => d.anzahl).sort((a, b) => a.tag < b.tag ? 1 : -1);
}

function tageListe() {
  const tage = tageMitAufgaben();
  return `<div class="seite">
    ${kopfSchmal('Verlauf')}
    ${tage.length ? `<section class="karte liste-karte">${tage.map(d => `<a class="zeile" href="#verlauf/${d.tag}">
      <span class="zeile-haupt"><b>${tagLang(d.tag)}</b><span class="klein gedaempft">${d.anzahl} Aufgaben · ${Math.round(d.erst / d.anzahl * 100)} % im 1. Versuch · ${A.minutenText(d.ms / 1000)}</span></span>
      ${svg('weiter', 18)}</a>`).join('')}</section>` : '<p class="gedaempft">Noch keine Aufgaben in den letzten 30 Tagen.</p>'}
  </div>`;
}

function aufgabenVonTag(tag) {
  return D.daten.aufgaben.filter(r => r.tag === tag);
}

function gefiltert(liste) {
  if (filter === 'fehler') return liste.filter(r => r.ende && r.ende.ergebnis !== 'erst');
  if (filter === 'hinweis') return liste.filter(r => r.events.some(e => e.typ === 'hinweis'));
  return liste;
}

function badge(r) {
  return `<span class="badge b-${A.ergebnisArt(r)}">${A.ergebnisText(r)}</span>`;
}

function aufgabenZeilen(liste, gewaehlt) {
  return liste.map(r => {
    const a = A.aufgabeVon(r, D.pool);
    const extra = [];
    if (r.events.some(e => e.typ === 'hinweis')) extra.push('Hinweis');
    if (r.events.some(e => e.typ === 'rechner' || e.typ === 'rechner_optional')) extra.push('Rechner');
    if (r.events.some(e => e.typ === 'verlassen')) extra.push('App verlassen');
    if (a && a.gegeben) extra.push('Merkzettel');
    const block = (r.start.generator || '').startsWith('block');
    return `<a class="zeile${r.key === gewaehlt ? ' gewaehlt' : ''}" href="#aufgabe/${encodeURIComponent(r.key)}">
      <span class="zeile-zeit">${uhr(r.start.t)}</span>
      <span class="zeile-haupt"><b class="einzeilig">${mathe(A.kurztext(r, a))}</b><span class="klein gedaempft">${esc(THEMA_NAMEN[r.thema] || r.thema)}${block ? ' · Dreierblock' : ''}${extra.length ? ' · ' + extra.join(' · ') : ''}</span></span>
      ${badge(r)}</a>`;
  }).join('');
}

function filterLeiste() {
  return `<div class="filter">${[['alle', 'Alle'], ['fehler', 'Mit Fehler'], ['hinweis', 'Mit Hinweis']].map(([k, t]) =>
    `<button class="chip${filter === k ? ' an' : ''}" data-act="filter" data-f="${k}" aria-pressed="${filter === k}">${t}</button>`).join('')}</div>`;
}

function tagZusammenfassung(liste) {
  const fertig = liste.filter(r => r.ende);
  const erst = fertig.filter(r => r.ende.ergebnis === 'erst').length;
  const ms = fertig.reduce((s, r) => s + (r.ende.ms || 0), 0);
  const sek = fertig.reduce((s, r) => s + (r.ende.sekunden || 0), 0);
  return `${fertig.length} Aufgaben · ${erst} im 1. Versuch · ${A.minutenText(ms / 1000)} geübt · ${A.minutenText(sek)} Spielzeit`;
}

function tagSeite(tag) {
  const liste = aufgabenVonTag(tag);
  return `<div class="seite">
    <a class="zurueck" href="#verlauf">${svg('zurueck', 20)}Alle Tage</a>
    <h1>${tagLang(tag)}</h1>
    <p class="klein gedaempft">${tagZusammenfassung(liste)}</p>
    ${filterLeiste()}
    <section class="karte liste-karte">${aufgabenZeilen(gefiltert(liste)) || '<p class="leer">Keine passenden Aufgaben.</p>'}</section>
  </div>`;
}

function verlaufBreit() {
  const tage = tageMitAufgaben();
  let rec = route.seite === 'aufgabe' ? D.daten.aufgaben.find(r => r.key === route.arg) : null;
  const tag = rec ? rec.tag : (route.arg || (tage[0] && tage[0].tag) || L.tagKey());
  const liste = aufgabenVonTag(tag);
  return `<div class="drei-spalten">
    <section class="spalte-tage">
      <h2 class="spalten-titel">${esc(name())}</h2>
      ${tage.map(d => `<a class="tag-knopf${d.tag === tag ? ' gewaehlt' : ''}" href="#verlauf/${d.tag}"><b>${tagKurz(d.tag)}</b><span class="klein gedaempft">${d.anzahl} Aufgaben · ${Math.round(d.erst / d.anzahl * 100)} %</span></a>`).join('') || '<p class="leer">Noch keine Aufgaben.</p>'}
    </section>
    <section class="spalte-aufgaben">
      <div class="spalten-kopf"><label class="nur-hoch tag-feld"><span class="unsichtbar">Tag auswählen</span><select name="tag-wahl">${tage.map(d => `<option value="${d.tag}"${d.tag === tag ? ' selected' : ''}>${tagKurz(d.tag)} · ${d.anzahl} Aufgaben</option>`).join('')}</select></label><b>${tagLang(tag)}</b><span class="klein gedaempft">${tagZusammenfassung(liste)}</span>${filterLeiste()}</div>
      ${aufgabenZeilen(gefiltert(liste), rec && rec.key) || '<p class="leer">Keine passenden Aufgaben.</p>'}
    </section>
    <section class="spalte-detail">${rec ? aufgabeDetail(rec) : '<div class="leer-detail">Tippe links auf eine Aufgabe.<br>Dann siehst du, wie die Aufgabe gelöst wurde.</div>'}</section>
  </div>`;
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
  const quelle = rec.start.generator ? 'Baukasten' : D.pool.has(rec.id) ? 'Aufgabensammlung' : 'Hinzugefügt';
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
  if (!entwurf) { entwurf = A.startWerte(D.daten.einst, neuesterStand()); geaenderteStufen = new Set(); }
  return entwurf;
}
function geaendert() {
  return JSON.stringify(entwurfHolen()) !== JSON.stringify(A.startWerte(D.daten.einst, neuesterStand())) || geaenderteStufen.size > 0;
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
  const optThema = L.THEMEN.map(t => `<option value="${t}"${t === w.thema ? ' selected' : ''}>${esc(THEMA_NAMEN[t])}</option>`).join('');
  const stunden = (sel) => Array.from({ length: 25 }, (_, h) => `<option value="${h}"${h === sel ? ' selected' : ''}>${h} Uhr</option>`).join('');
  const st = neuesterStand();
  const liveStufe = (g) => (st && st.genStufen && st.genStufen[g] && st.genStufen[g].stufe) || 1;
  return `<div class="seite schmal-inhalt">
    ${breit.matches ? `<header class="kopf-breit"><h1>Einstellungen für ${esc(name())}</h1>${nutzerWahl('nutzer-chip nur-hoch')}</header>` : kopfSchmal('Einstellungen')}
    ${lieferStatus()}
    <section class="karte liste-karte">
      <label class="einstell-zeile"><span>Übungsthema</span><select id="e-thema">${optThema}</select></label>
      <div class="einstell-zeile"><span>Geschenkte Spielzeit</span><span class="zwei-felder"><label><span class="unsichtbar">ab</span><select id="e-von">${stunden(w.basisVon)}</select></label><span>bis</span><label><span class="unsichtbar">bis</span><select id="e-bis">${stunden(w.basisBis)}</select></label></span></div>
      <a class="einstell-zeile" href="#spielzeit"><span>Spielzeit pro Aufgabe</span><span class="wert">${w.spielzeit.staffel.map(zahlText).join(' / ')} Min.</span>${svg('weiter', 16)}</a>
      <label class="einstell-zeile"><span>Freiwilliger Taschenrechner<span class="klein gedaempft block">bei großen Zahlen, kostet Spielzeit</span></span><input type="checkbox" class="schalter" id="e-rechner"${w.rechnerAngebot ? ' checked' : ''}></label>
    </section>
    <h2 class="abschnitt">Schwierigkeit der Baukästen</h2>
    <section class="karte liste-karte">
      ${Object.keys(GEN_NAMEN).map(g => `<div class="einstell-zeile"><span>${esc(GEN_NAMEN[g])}${geaenderteStufen.has(g) ? ` <span class="klein amber">vorher ${liveStufe(g)}</span>` : ''}</span>${stepper('stufe', `data-g="${g}"`, `Stufe ${w.genStufen[g]}`, GEN_NAMEN[g])}</div>`).join('')}
    </section>
    <p class="klein gedaempft">Die App passt die Stufen weiter selbst an. Was du hier änderst, ist der neue Startpunkt.</p>
    ${speicherLeiste()}
    ${schluesselKarte()}
  </div>`;
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
      <div class="einstell-zeile"><span>Geschenkt pro Stunde</span>${minFeld('basis', r.basisMin, 'Geschenkte Zeit')}</div>
    </section>
    <section class="hinweis-box"><p><b>So wirkt es:</b> 10 Aufgaben am Stück, alle im 1. Versuch richtig, bringen bis zu <b>${zahlText(A.serieMinuten(r))} Min.</b> Spielzeit.</p><p class="klein">App verlassen bei Aufgaben ohne Rechner halbiert die Zeit weiterhin (ab dem 3. Mal am Tag: keine Zeit).</p></section>
    <button class="knopf" data-act="standardZeit">Standardwerte einsetzen</button>
    ${speicherLeiste()}
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

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'verbinden': verbinden(); break;
    case 'neuLaden': allesLaden({ nutzerliste: true }); break;
    case 'zeitraum': C.zeitraum = Number(el.dataset.n); konfigSichern(); zeichne(); break;
    case 'filter': filter = el.dataset.f; zeichne(); break;
    case 'stufe': {
      const g = el.dataset.g;
      entwurf.genStufen[g] = Math.max(1, Math.min(3, entwurf.genStufen[g] + Number(el.dataset.d)));
      const start = A.startWerte(D.daten.einst, neuesterStand()).genStufen[g];
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
    case 'anteil': entwurf.spielzeit[el.dataset.k] = Number(el.dataset.v); meldung = null; zeichne(); break;
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
  if (el.id === 'e-thema') entwurf.thema = el.value;
  else if (el.id === 'e-von' || el.id === 'e-bis') {
    const von = Number(document.getElementById('e-von').value), bis = Number(document.getElementById('e-bis').value);
    entwurf.basisVon = Math.min(von, bis); entwurf.basisBis = Math.max(von, bis);
  } else if (el.id === 'e-rechner') entwurf.rechnerAngebot = el.checked;
  else if (el.classList.contains('min-feld')) { const v = minutenLesen(el.id); if (v != null) minutenSetzen(el.id, v); }
  else return;
  meldung = null;
  zeichne();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.target.id === 'r-token' || ev.target.id === 'r-repo')) verbinden();
  if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('min-feld')) ev.target.blur();
});

window.addEventListener('hashchange', () => { leseRoute(); meldung = route.seite === 'einstellungen' || route.seite === 'spielzeit' ? meldung : null; zeichne(); window.scrollTo(0, 0); });
breit.addEventListener('change', zeichne);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && C.token && D.daten && Date.now() - (D.daten.geladen || 0) > 2 * 60 * 1000) allesLaden();
});

leseRoute();
if (C.token) allesLaden(); else zeichneEinrichten();
