// Archiv der Welten: Lese-App (Auftrag 57–59). Schritt 2: Gerüst, Einrichtung, Abschicken. Schritt 3: Lesekarten.
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
import * as KL from './karte-logik.js';

export const LESE_VERSION = '0.12.1';
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
    einst: s.einst || null, kasse: s.kasse || null, tag: s.tag || null, pin: s.pin || null, lese: s.lese || null, laufend: s.laufend || null, inhaltGemeldet: s.inhaltGemeldet || null, log: Array.isArray(log) ? log : []
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
    if (offen()) await inhaltLaden();
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

// ---------- Serien (Entscheidung 68, Konzept E): Kanäle oben, Feed mit höchstens 3 Karten ----------
const SERIEN = () => KL.serienListe(INH_ALLE);
const serieZu = (story) => KL.serieVon(SERIEN(), story);
const staffelText = (sr, st) => sr && sr.staffeln.length > 1 ? `Staffel ${st.staffel || sr.staffeln.indexOf(st) + 1}` : '';
const bildImg = (datei, cls, alt = '') => datei ? `<img class="${cls}" data-datei="${esc(datei)}" alt="${esc(alt)}">` : `<span class="${cls} leer"></span>`;
// Blauer Punkt: in der Serie ist heute eine Staffel neu frei
const serieNeu = (sr) => sr.staffeln.some(st => istNeu(st.id));
function kanaeleHtml() {
  const l = SERIEN();
  if (!l.length) return '';
  return `<nav class="tv-kanaele" aria-label="Serien">${l.map(sr => `<button class="tv-kanal" data-act="kanal" data-s="${esc(sr.id)}"><span class="tv-av">${bildImg(sr.bild, 'tv-av-bild')}${serieNeu(sr) ? '<i class="tv-punkt" aria-label="Neu"></i>' : ''}</span><span class="tv-kanal-name">${esc(sr.titel)}</span></button>`).join('')}</nav>`;
}
function weiterKarte(story, f) {
  const t = KL.naechsterText(INH, f, story), fo = KL.folgeVon(INH, t), s = storyVon(story), sr = serieZu(story);
  const stt = staffelText(sr, s);
  const gel = KL.folgenStand(INH, f, story).filter(x => x.gelesen).length;
  const nFragen = Object.values(INH.fragen).filter(q => q.text === t.id).length;
  const cover = t.bild && t.bild.datei ? bildImg(t.bild.datei, 'tv-cover-bild') : `<span class="tv-cover-icon">${bildImg(s.icon, 'tv-cover-ic')}</span>`;
  return `<section class="tv-next">
    <div class="tv-cover tvs-${esc(s.style || 'neutral')}">${cover}<span class="tv-tag">${stt ? stt + ' · ' : ''}${gel}/${fo.y}</span><span class="tv-prog"><i style="width:${Math.round(100 * gel / Math.max(1, fo.y))}%"></i></span></div>
    <div class="tv-info">${bildImg(sr ? sr.bild : s.icon, 'tv-av-klein')}<div><b>${istNeu(story) ? '<span class="tv-marke neu">Neu</span> ' : ''}${esc(s.titel)} · Folge ${fo.x}: ${esc(t.titel)}</b><small>${esc(sr ? sr.titel : '')}${nFragen ? ` · ${nFragen} ${nFragen === 1 ? 'Frage' : 'Fragen'}` : ''}</small></div></div>
    <button class="tv-btn" data-act="lesen"><span class="tv-play"></span>Weiterlesen</button>
  </section>`;
}
function premiereKarte(x) {
  const sr = serieZu(x.story.id), stt = staffelText(sr, x.story);
  return `<section class="tv-premiere"><span class="tv-pr-bild">${bildImg(x.story.icon, 'tv-pr-ic')}<span class="tv-tag blau">${esc(amText(x.am))}</span></span>
    <div><small>${esc(sr ? sr.titel : '')}${stt ? ' · ' + stt : ''}</small><b>${esc(x.story.titel)}</b><small>${esc(x.story.kurz || '')}</small></div></section>`;
}
function neuKarte(st) {
  const sr = serieZu(st.id), stt = staffelText(sr, st);
  return `<button class="tv-premiere tv-neu" data-act="storyWahl" data-s="${esc(st.id)}"><span class="tv-pr-bild">${bildImg(st.icon, 'tv-pr-ic')}<span class="tv-tag blau">Neu</span></span>
    <div><small>${esc(sr ? sr.titel : '')}${stt ? ' · ' + stt : ''}</small><b>${esc(st.titel)}</b><small>Jetzt lesen ›</small></div></button>`;
}
function startKnoepfe() {
  if (!INH || !INH.stories.length) return `<button class="btn btn-haupt btn-gross lese-knopf" disabled>Weiterlesen<span class="unter">${inhaltLaedt ? 'Die Geschichten werden geladen …' : inhaltFehler === 'offline' ? 'Zum ersten Laden braucht die App Internet.' : 'Die ersten Geschichten kommen bald.'}</span></button>`;
  const f = fs();
  const story = standardStory(f);
  if (!story && engpass.gesperrt) return `<button class="btn btn-haupt btn-gross lese-knopf" data-act="nochmalVersuchen">Noch einmal versuchen<span class="unter">Die Karte von eben kommt noch einmal.</span></button>`;
  if (!story) {
    const bald = KL.demnaechst(INH_ALLE, f, heute().tag);
    bald.forEach(x => morgenMelden(x.story.id, 'start'));
    return `<section class="info-karte"><b>Alle Folgen sind gelesen.</b><div class="gedaempft">Neue Staffeln kommen bald.</div></section>
      ${bald.length ? `<p class="tv-ueber">Neu im Archiv</p>${bald.slice(0, 2).map(premiereKarte).join('')}` : ''}`;
  }
  // Feed (Entscheidung 68): „Als Nächstes“, dann neu freie Staffeln und Ankündigungen, zusammen höchstens 3 Karten
  const neue = INH.stories.filter(x => x.id !== story && istNeu(x.id) && KL.naechsterText(INH, f, x.id));
  const bald = KL.demnaechst(INH_ALLE, f, heute().tag);
  bald.forEach(x => morgenMelden(x.story.id, 'start'));
  const rest = [...neue.map(neuKarte), ...bald.map(premiereKarte)].slice(0, 2);
  return `<p class="tv-ueber">Als Nächstes</p>${weiterKarte(story, f)}${rest.length ? `<p class="tv-ueber">Neu im Archiv</p>${rest.join('')}` : ''}`;
}
function zeigeStart(syncJetzt = true) {
  bodyStyle(null);
  if (!bereit()) return zeigeEinrichtung();
  ansicht = 'start';
  if (syncJetzt) syncen();
  if (offen() && !INH && !inhaltLaedt) inhaltLaden().then(() => { if (ansicht === 'start') zeigeStart(false); });
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
  bodyStyle('tv');
  ansichtKanal = null;
  $app.innerHTML = `
  <div class="screen start tv">
    <header class="tv-kopf"><span class="tv-logo">${sechseck(34, '#1C2440', '#F2994A', BUCH)}<span><b>Archiv der Welten</b><small>Hallo${S.name ? ', ' + esc(S.name) : ''}!</small></span></span></header>
    ${testLeiste}
    ${anz.sek > 0 ? `<section class="bz-karte">
      <span class="bz-icons">${VIDEO(40)}</span>
      <div class="bz-text"><div class="bz-zahl">${minTxt(anz.sek)}</div><div class="gedaempft">Bildschirmzeit gesammelt</div></div>
      ${anz.sek >= ab ? '<button class="btn btn-bz" data-act="bz">Abschicken</button>' : `<div class="bz-ab gedaempft">Ab ${minTxt(ab)} kannst du abschicken. Noch ${minTxt(ab - anz.sek)}</div>`}
    </section>` : ''}
    ${INH ? kanaeleHtml() : ''}
    ${startKnoepfe()}
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
  bilderEinsetzen();
}

// ---------- Lesekarten (Auftrag 57, Schritt 3) ----------
// Inhalt aus daten/<name>/lesen/inhalt/ (nur lesen). Zwischengespeichert auf dem Gerät, neu geladen, wenn sich index.json ändert.
const INHALT_KEY = 'archiv-v1-inhalt';
// INH_ALLE: alle geprüften Inhalte; INH: nur freie Geschichten (Auftrag 67, eine neue Geschichte pro Tag)
let INH = null, INH_ALLE = null, inhaltFehler = null, inhaltLaedt = null;
const inhaltPfad = (p) => `daten/${ordner()}/lesen/inhalt/${p}`;
function inhaltCache() { try { return JSON.parse(localStorage.getItem(INHALT_KEY) || 'null'); } catch (e) { return null; } }
function inhaltAnwenden(roh) {
  INH_ALLE = KL.inhaltPruefen(roh);
  INH = INH_ALLE;
  freiAktualisieren();
  if (INH_ALLE.fehler.length && roh.index && S.inhaltGemeldet !== roh.index.stand) { protokoll('lese_karte_fehler', { fehler: INH_ALLE.fehler.slice(0, 30), stand: roh.index.stand }); S.inhaltGemeldet = roh.index.stand; }
}
async function inhaltLaden() {
  if (!bereit()) return;
  if (inhaltLaedt) return inhaltLaedt;
  inhaltLaedt = (async () => {
    const alt = inhaltCache();
    if (alt && alt.ordner === ordner() && !INH) inhaltAnwenden(alt);
    try {
      const index = await U.dateiLesen(S.upload, inhaltPfad('index.json'));
      if (!index) { INH = null; inhaltFehler = 'leer'; return; }
      if (alt && alt.ordner === ordner() && alt.index && alt.index.stand === index.stand) {
        // storylines.json ist klein: immer neu lesen (Knopftexte, Style, Folgen können sich ohne neuen Stand ändern)
        const sl = await U.dateiLesen(S.upload, inhaltPfad('storylines.json'));
        if (sl && JSON.stringify(sl) !== JSON.stringify(alt.storylines)) { alt.storylines = sl; try { localStorage.setItem(INHALT_KEY, JSON.stringify(alt)); } catch (e) { /* egal */ } inhaltAnwenden(alt); }
        else if (!INH) inhaltAnwenden(alt);
        return;
      }
      const roh = { ordner: ordner(), index, storylines: await U.dateiLesen(S.upload, inhaltPfad('storylines.json')), texte: {}, fragen: {} };
      const nimm = async (art, liste) => {
        for (const { id, v } of liste || []) {
          const a = alt && alt.ordner === ordner() && alt[art] && alt[art][id];
          roh[art][id] = a && a.v === v ? a : await U.dateiLesen(S.upload, inhaltPfad(`${art}/${id}.json`));
        }
      };
      await nimm('texte', index.texte); await nimm('fragen', index.fragen);
      try { localStorage.setItem(INHALT_KEY, JSON.stringify(roh)); } catch (e) { /* zu groß: nur im Speicher */ }
      inhaltAnwenden(roh);
      inhaltFehler = null;
    } catch (e) { inhaltFehler = INH ? null : (e.status === 0 ? 'offline' : 'fehler'); }
  })().finally(() => { inhaltLaedt = null; });
  return inhaltLaedt;
}
// Bilder und Icons aus dem Daten-Repo (mit Schlüssel), als Blob-Adresse
const BILD_TYP = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const bildCache = {};
function bildUrl(datei) {
  if (!datei) return Promise.resolve(null);
  if (!bildCache[datei]) bildCache[datei] = U.dateiBlob(S.upload, inhaltPfad(datei)).then(b => b ? URL.createObjectURL(new Blob([b], { type: BILD_TYP[datei.split('.').pop().toLowerCase()] || b.type })) : null).catch(() => { delete bildCache[datei]; return null; });
  return bildCache[datei];
}
function bilderEinsetzen() {
  document.querySelectorAll('img[data-datei]').forEach(img => bildUrl(img.dataset.datei).then(u => { if (u) img.src = u; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'bild-fehlt', textContent: img.alt || '' })); }));
}
// Zuletzt gespielte Karte in dieser Sitzung (Auftrag 65: eine zurückgelegte Karte kommt nicht direkt nach sich selbst)
let letzteKarte = null, engpass = { frei: null, gesperrt: null };
const fs = () => { S.lese = KL.fortschrittVon(S.lese); if (INH_ALLE) freiAktualisieren(); if (INH) engpass = KL.engpassPruefen(INH, S.lese, letzteKarte); return S.lese; };
// Auftrag 67: gesperrte Geschichten herausnehmen; eine Geschichte mit ab/nach, die zum ersten Mal frei ist, melden
function freiAktualisieren() {
  const f = S.lese = KL.fortschrittVon(S.lese), tag = heute().tag;
  INH = KL.inhaltFrei(INH_ALLE, f, tag);
  for (const st of INH.stories) if (KL.mitTakt(st) && !f.freiSeit[st.id]) {
    f.freiSeit[st.id] = tag;
    protokoll('lese_story_frei', { story: st.id, nach: st.nach || null, seit: st.nach ? f.fertig[st.nach] || null : null, ...(st.ab ? { ab: st.ab } : {}) });
  }
}
// Weiterlesen: die zuletzt gelesene Geschichte; ist sie fertig, zuerst eine heute neu freie (Auftrag 67), sonst die erste offene
function standardStory(f) {
  if (f.letzteStory && KL.naechsterText(INH, f, f.letzteStory)) return f.letzteStory;
  const offen = INH.stories.filter(s => KL.naechsterText(INH, f, s.id));
  return ((offen.find(s => istNeu(s.id)) || offen[0]) || {}).id;
}
// Am Tag der Freigabe „Neu“, bis die erste Karte der Geschichte gelesen ist
const istNeu = (id) => { const f = S.lese || {}; return !!(f.freiSeit && f.freiSeit[id] === heute().tag) && !Object.keys(f.gelesen || {}).some(tid => INH_ALLE && INH_ALLE.texte[tid] && INH_ALLE.texte[tid].story === id); };
const neuMarke = (id) => istNeu(id) ? '<span class="marke-neu">Neu</span>' : '';
function morgenMelden(story, anlass) {
  const f = S.lese, tag = heute().tag, m = f.morgen[story] || (f.morgen[story] = {});
  if (m[anlass] === tag) return;
  m[anlass] = tag; protokoll('lese_story_morgen', { story, anlass });
}
const amText = (am) => am === KL.plusTag(heute().tag, 1) ? 'Morgen neu' : `Neu ab ${Number(am.slice(8, 10))}.${Number(am.slice(5, 7))}.`;
// Styles (Auftrag 58): Name des Faktenkastens, Trennornament und Hintergrund für den ganzen Bildschirm
const STYLES = {
  raumfahrt: { kasten: 'Telemetrie', orn: '— · —', bg: '#0E1726' }, fantasy: { kasten: 'Aus der Chronik', orn: '✦ ✦ ✦', bg: '#F3E7CC' },
  videogames: { kasten: 'Highscore', orn: '▪ ▪ ▪', bg: '#000000' }, scifi: { kasten: 'Scan', orn: '◇ ◇ ◇', bg: '#06222A' },
  musik: { kasten: 'Ticket', orn: '♪ ♪ ♪', bg: '#1B1416' }, seefahrt: { kasten: 'Logbuch', orn: '~ ~ ~', bg: '#E6EEF2' },
  rekord: { kasten: 'Zeitnahme', orn: '› › ›', bg: '#2B2D31' },
  tv: { kasten: '', orn: '', bg: '#0A0E1A' }   // Start und Kanalseite (Entscheidung 68)
};
const styleVon = (story) => { const k = (storyVon(story) || {}).style; return STYLES[k] ? k : 'neutral'; };
function bodyStyle(k) {
  const b = document.body, st = STYLES[k];
  if (st) { b.dataset.style = k; b.style.setProperty('--sbg', st.bg); } else { delete b.dataset.style; b.style.removeProperty('--sbg'); }
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = st ? st.bg : '#F4F1E8';
}
const storyVon = (id) => (INH && INH.stories.find(s => s.id === id)) || (INH_ALLE && (INH_ALLE.storyListe || INH_ALLE.stories).find(s => s.id === id));
const iconHtml = (story, gross) => { const s = storyVon(story); return s && s.icon ? `<img class="${gross ? 'icon-gross' : 'icon-klein'}" data-datei="${esc(s.icon)}" alt="">` : ''; };

// Laufende Karte
let A = null;
// textId: bestimmter Text („Wie geht es weiter?“ = nächste Folge, „Noch eine Frage zum Text“ = derselbe Text)
function karteStarten(story, wahl, textId = null) {
  const f = fs();
  const t = textId ? INH.texte[textId] : KL.naechsterText(INH, f, story);
  if (!t) return zeigeWahl();
  if (!f.runde || f.runde.karten >= KL.RUNDE) { f.runde = { nr: ((f.runde && f.runde.nr) || 0) + 1, karten: 0 }; protokoll('lese_runde', { aktion: 'start', nr: f.runde.nr }); }
  const pl = KL.kartePlanen(INH, f, t.id, f.runde.karten + 1, !!f.runde.neuTyp);
  const q = pl.q;
  f.karte += 1; f.letzteStory = story; f.runde.karten += 1;
  if (pl.neu) f.runde.neuTyp = true;
  // Auftrag 64: die wievielte Frage zu diesem Text in dieser Sitzung, und ob der Text heute schon als Karte offen war
  const imText = wahl === 'noch_eine' && A && A.text === t.id ? (A.imText || 1) + 1 : 1;
  const tag = heute().tag;
  if (!f.heute || f.heute.tag !== tag) f.heute = { tag, texte: {} };
  const vorher = !!f.heute.texte[t.id];
  f.heute.texte[t.id] = true;
  const wieder = f.zurueck[q.id] || null;
  A = { nr: f.karte, platz: f.runde.karten, story, text: t.id, frage: q.id, typ: q.typ, stufe: pl.stufe, geruest: pl.geruest, sicher: pl.sicher, eingewoehnung: pl.eingewoehnung,
    imText, phase: 'frage', versuch: 1, schonR: [], schonF: [], start: Date.now(), belegHinweis: false, leiter: false, nachgeschlagen: [], antwortGegeben: false, zfNr: 0 };
  neuZiehen(pl.stufe);
  protokoll('lese_karte_start', { karte: A.nr, text: t.id, frage: q.id, v: q.v ?? null, tv: t.v ?? null, kv: q.kv, fragetyp: q.typ, stufe: pl.stufe, ...(pl.ersatz ? { stufe_ersatz: pl.gewuenscht } : {}), textstufe: t.textstufe, geruest: pl.geruest, typ_schritt: pl.schritt, story, beat: t.beat, platz: A.platz, neu_typ: pl.neu,
    ...(pl.sicher ? { sicher: true } : {}), ...(pl.eingewoehnung ? { eingewoehnung: true } : {}), ...(pl.neuZweiter ? { neu_typ_zweiter: true } : {}), frage_im_text: imText, ...(vorher ? { text_gelesen_vorher: true } : {}), wieder: !!wieder, ...(wieder ? { nach_karten: f.karte - wieder.karte } : {}), wahl });
  if (wieder) protokoll('lese_wiederkehr', { frage: q.id, nach_karten: f.karte - wieder.karte, nach_min: Math.round((Date.now() - new Date(wieder.t)) / 60000), ...(f.frei === q.id ? { engpass: true } : {}) });
  sichern();
  zeigeKarte(true);
}
function neuZiehen(abstand) {
  const q = INH.fragen[A.frage];
  const z = KL.ziehen(q, { abstand, schonR: A.schonR, schonF: A.schonF, ohneWortfalle: A.eingewoehnung && A.versuch === 1 });
  A.zug = z.antworten; A.schonR.push(z.r); A.schonF.push(...z.f); A.gezeigt = Date.now();
  // Auftrag 66: Abstand der gezeigten richtigen Antwort und Zahl der gezeigten Wortfallen
  A.zugAbstand = (q.richtigAbstand || [])[z.r] ?? null;
  A.zugWortfallen = z.f.filter(i => q.falsch[i].fehlertyp === 'Wortfalle').length;
}
// Auftrag 66: laufende Karte merken, damit ein Abbruch (Start, App neu, im Hintergrund beendet) im Protokoll steht
function laufendMerken() {
  if (!A || A.phase === 'fertig') { if (S.laufend) { S.laufend = null; sichern(); } return; }
  S.laufend = { karte: A.nr, frage: A.frage, phase: A.phase, versuch: A.versuch, start: A.start, zuletzt: Date.now(), hintergrund: !!(S.laufend && S.laufend.karte === A.nr && S.laufend.hintergrund) };
  sichern();
}
function abbruch(grund, l = S.laufend) {
  if (!l) return;
  protokoll('lese_karte_abbruch', { karte: l.karte, frage: l.frage, phase: l.phase, versuch: l.versuch, sekunden: Math.round(((grund === 'start' ? Date.now() : l.zuletzt) - l.start) / 1000), grund });
  S.laufend = null; sichern();
}
const satzHtml = (t, i, mark) => t.saetze[i].map((s, j) => {
  let h = esc(s);
  return mark && mark.includes(j) ? `<mark>${h}</mark>` : h;
}).join(' ');
// Beim Beleg-Schritt öffnen die Wörter kein Fenster: der Tipp zählt für den Absatz (Auftrag 62, Punkt 2)
function glossiert(html, glossar, tippbar = true) {
  for (const w of Object.keys(glossar || {})) {
    const e = esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`(^|[^\\wäöüÄÖÜß])(${e})(?=[^\\wäöüÄÖÜß]|$)`), tippbar ? `$1<button class="gl" data-act="gl" data-w="${esc(w)}">$2</button>` : '$1<span class="gl">$2</span>');
  }
  return html;
}
function zeigeKarte(nachOben = false) {
  ansicht = 'karte';
  laufendMerken();
  const q = INH.fragen[A.frage], t = INH.texte[A.text], f = fs();
  const fo = KL.folgeVon(INH, t), s = storyVon(t.story) || {};
  const b = q.beleg[0];
  const um = ['leiter1', 'leiter2', 'leiterHinweis', 'merksatz', 'stopp', 'aufloesung', 'belegMarkiert'].includes(A.phase) || (A.geruest === 1 && A.phase !== 'fertig');
  const satzMark = ['leiter2', 'leiterHinweis', 'merksatz', 'aufloesung'].includes(A.phase) ? q.belegSatz : null;
  const tippbar = A.phase === 'beleg' || A.phase === 'belegHinweis' || A.phase === 'belegMarkiert';
  const absaetze = t.absaetze.map((_, i) => {
    const cls = ['abs', i === b && um ? 'um' : '', i === b && (A.phase === 'stopp' || A.geruest === 1) ? 'mark' : '', tippbar ? 'tippbar' : '', A.phase === 'belegMarkiert' && i !== b ? 'aus' : ''].filter(Boolean).join(' ');
    const inner = glossiert(satzHtml(t, i, i === b ? satzMark : null), t.glossar, !tippbar);
    return tippbar ? `<div class="${cls}" data-act="absatz" data-i="${i}" data-abs="${i}" role="button" tabindex="0"><span class="nr">Absatz ${i + 1}</span>${inner}</div>` : `<p class="${cls}" data-abs="${i}"><span class="nr">Absatz ${i + 1}</span>${inner}</p>`;
  }).join('');
  const sk = styleVon(t.story), st = STYLES[sk] || { kasten: 'Fakten', orn: '' };
  bodyStyle(sk);
  const kasten = t.kasten && t.kasten.length ? `<div class="kas k-${sk}"><div class="kt">${esc(st.kasten)}</div>${t.kasten.map(([a, w]) => `<div class="kr"><span>${esc(a)}</span><b>${esc(w)}</b></div>`).join('')}</div>` : '';
  const bild = t.bild ? `<figure class="${t.bild.glatt ? '' : 'pixel'}"><div class="rahmen r-${sk}"><img data-datei="${esc(t.bild.datei)}" alt="${esc(t.bild.alt || '')}"></div><figcaption>${esc(t.bild.quelle || '')}</figcaption></figure>` : '';
  const ersterText = !t.bisher;
  const tipp = !f.nachschlagTipp && Object.keys(t.glossar || {}).length ? `<div class="tipp"><b>Tipp:</b> Wörter mit gestrichelter Linie kannst du antippen. Dann siehst du, was sie bedeuten.<br><button class="ctl-t" data-act="tippOk">Alles klar</button></div>` : '';
  if (tipp && !A.tippGezeigt) { A.tippGezeigt = true; protokoll('lese_tipp', { aktion: 'gezeigt', karte: A.nr }); }
  const dots = Array.from({ length: KL.RUNDE }, (_, i) => `<i class="${i < A.platz ? 'an' : ''}"></i>`).join('');
  const ohneZeit = heute().sek >= LL.grenzeSek(R(), heute().tag);
  $app.innerHTML = `<div class="screen les st-${sk}${test() ? ' test' : ''}">
    <div class="top"><button class="ctl-t" data-act="start">‹ Start</button>${ohneZeit ? '<span class="ohnezeit">ohne Zeit</span>' : ''}<span class="dots">${dots}<span>Karte ${A.platz} von ${KL.RUNDE}</span></span></div>
    ${tipp}
    ${ersterText ? `<div class="shead">${iconHtml(t.story, true)}<span class="st">${esc(s.titel || '')}</span></div>` : ''}
    <div class="meta">Folge ${fo.x} von ${fo.y}<span class="badge">${s.art === 'wahr' ? 'Wahr' : 'Erfunden'}</span></div>
    ${t.bisher ? `<div class="bis b-${sk}">${iconHtml(t.story, false)}<div><b>Bisher:</b> ${esc(t.bisher)}</div></div>` : ''}
    <h2 class="les-titel">${esc(t.titel)}</h2>
    ${st.orn ? `<div class="trenner" aria-hidden="true">${st.orn}</div>` : ''}
    ${bild}${absaetze}${kasten}
    ${frageTeil(q, t)}
  </div>`;
  bilderEinsetzen();
  if (nachOben) window.scrollTo(0, 0);
  else { const z = document.querySelector('[data-ziel]'); if (z) z.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  if (A.phase === 'stopp') stoppBalken();
  gelesenBeobachten();
}
// Auftrag 66 („gut“): bis zu welchem Absatz der Text vor der ersten Antwort zu sehen war (mindestens zur Hälfte im Bild oder das halbe Bild füllend)
let absBeob = null;
function gelesenBeobachten() {
  if (absBeob) { absBeob.disconnect(); absBeob = null; }
  if (!A || A.phase !== 'frage' || A.versuch !== 1 || A.gelesenGeloggt || typeof IntersectionObserver === 'undefined') return;
  if (A.absMax == null) A.absMax = -1;
  absBeob = new IntersectionObserver((eintraege) => {
    // gesehen: mindestens zur Hälfte im Bild, oder (lange Absätze) mindestens das halbe Bild füllt
    for (const e of eintraege) if (e.isIntersecting && A && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= 0.5 * window.innerHeight)) A.absMax = Math.max(A.absMax, Number(e.target.dataset.abs));
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1] });
  document.querySelectorAll('[data-abs]').forEach(el => absBeob.observe(el));
}
function frageTeil(q, t) {
  const b = q.beleg[0] + 1;
  const ant = (liste, act) => liste.map(a => `<button class="ant" data-act="${act}" data-id="${a.id}">${esc(a.t)}</button>`).join('');
  const frage = `${A.imText > 1 ? `<div class="frage-nr" data-ziel>Frage ${A.imText} zum Text</div>` : ''}<div class="fr"${A.imText > 1 ? '' : ' data-ziel'}>${esc(q.frage)}</div>`;
  switch (A.phase) {
    case 'frage':
      return `${A.geruest === 2 && A.versuch === 1 ? `<p class="gerust">Die Antwort steckt in Absatz ${b}.</p>` : ''}${frage}${ant(A.zug, 'antwort')}`;
    case 'hinweis':
      return `${frage}<div class="blatt nn" data-ziel><div class="t nn">Noch nicht.</div><p>${esc(A.hinweis)}</p><button class="weiter" data-act="verstanden">Verstanden</button></div>`;
    case 'stopp':
      return `${frage}<div class="blatt nn" data-ziel><div class="t nn">Noch nicht.</div><p>${esc(A.hinweis)}</p>${/\bLies\b/.test(A.hinweis) ? '' : `<p><b>Lies Absatz ${b} noch einmal.</b></p>`}<div class="ruhe"><i id="stopp-balken"></i></div><button class="weiter" data-act="verstanden" id="stopp-weiter" disabled>Weiter</button></div>`;
    case 'leiter1': case 'leiter2': {
      const zf = q.zf[A.zfNr];
      const opts = KL.mischen([{ id: 'ja', t: zf.richtig }, { id: 'nein', t: zf.falsch }]);
      return `${frage}<div class="blatt" data-ziel><div class="t">${A.phase === 'leiter1' ? 'Wir suchen zusammen.' : 'Lies den markierten Satz.'}</div>${A.phase === 'leiter1' ? `<p>${esc(q.eingrenzen)}</p>` : ''}<p><b>${esc(zf.frage)}</b></p>${ant(opts, 'zf')}</div>`;
    }
    case 'leiterHinweis':
      return `${frage}<div class="blatt nn" data-ziel><div class="t nn">Noch nicht.</div><p>${esc(q.zf[A.zfNr].hinweis)}</p><button class="weiter" data-act="leiterWeiter">Weiter</button></div>`;
    case 'merksatz':
      return `${frage}<div class="blatt ja" data-ziel><div class="t">Merk dir:</div><p>${esc(q.merksatz)}</p><button class="weiter" data-act="merksatzWeiter">Zur Frage</button></div>`;
    case 'beleg':
      return `${frage}<div class="blatt ja" data-ziel><div class="t ja">Richtig!</div><p><b>Wo steht das? Tippe den Absatz an.</b></p></div>`;
    case 'belegHinweis':
      return `${frage}<div class="blatt nn" data-ziel><div class="t nn">Noch nicht.</div><p>${esc(q.belegHinweis)}</p><p><b>Tippe den Absatz an.</b></p></div>`;
    case 'belegMarkiert':
      return `${frage}<div class="blatt" data-ziel><p>${esc(q.belegHinweis)}</p><p><b>Er ist markiert. Tippe ihn an.</b></p></div>`;
    case 'aufloesung':
      return `${frage}<div class="blatt" data-ziel><div class="t">Hier steht es: Absatz ${b}.</div><p>Das heißt: ${esc(q.aufloesung)}</p><button class="weiter" data-act="aufloesungWeiter">Weiter</button></div>`;
    case 'fertig': return endeTeil(q, t);
  }
  return '';
}
function endeTeil(q, t) {
  const f = fs();
  const lohn = A.lohnPlus > 0 ? `<span class="lohn">+${minTxt(A.lohnPlus)}</span>` : (A.ergebnis === 'voll' || A.ergebnis === 'hinweis') ? '<span class="lohn aus">ohne Zeit</span>' : '';
  const kopf = A.ergebnis === 'aufloesung' ? `<div class="blatt" data-ziel style="position:static"><div class="t">Diese Karte kommt später noch einmal.</div><p>Lies jetzt etwas anderes.</p></div>`
    : A.ergebnis === 'leiter' ? `<div class="blatt ja" data-ziel style="position:static"><div class="t ja">Geschafft!</div><p>Diese Karte kommt später noch einmal.</p></div>`
    : `<div class="blatt ja" data-ziel style="position:static"><div class="t ja">Geschafft!</div>${lohn}</div>`;
  const voll = A.vollJetzt ? `<div class="tipp"><b>Für heute ist deine Lese-Zeit voll.</b><br>Weiterlesen geht. Es bringt heute aber keine Zeit mehr.${LL.matheHeute(S.kasse && S.kasse.fremd, W().bildschirm, heute().tag).frei > 0 && !test() ? '<br><span class="gedaempft">In Mathe ist heute noch Zeit frei.</span>' : ''}</div>` : '';
  if (A.fb) return `${kopf}<div class="fb" data-ziel><div class="fr">Das war die letzte Folge. Wie soll es weitergehen?</div>
    ${['gleich', 'art', 'anders'].map(k => `<button class="ant" data-act="storyFb" data-a="${k}">${esc(A.fb[k])}</button>`).join('')}
    <button class="weissnicht" data-act="storyFb" data-a="weiss_nicht">Weiß nicht</button></div>`;
  const rundeFertig = f.runde && f.runde.karten >= KL.RUNDE ? `<div class="runde-fertig"><b>Runde geschafft!</b> 5 von 5 Karten.</div>` : '';
  const weiter = A.ergebnis !== 'aufloesung' ? KL.weiterText(INH, f, t) : null;
  const noch = A.ergebnis !== 'aufloesung' ? KL.nochEine(INH, f, A.text) : null;
  const letzte = weiter == null && t.beat === KL.folgeVon(INH, t).y;
  // Nach der letzten offenen Folge springt „weiter“ zurück an eine frühere Folge mit offenen Fragen: dann nicht „Wie geht es weiter?“
  const zurueckInStory = !!weiter && (weiter.beat < t.beat || (weiter.beat === t.beat && (weiter.teil || 0) < (t.teil || 0)));
  const andere = KL.andere(INH, f, A.story);
  // Auftrag 67: nach der letzten Folge die nächste Geschichte ankündigen (nur wenn sie noch gesperrt ist)
  const morgen = t.beat === KL.folgeVon(INH, t).y ? KL.demnaechst(INH_ALLE, f, heute().tag).find(x => x.story.nach === t.story) : null;
  if (morgen) morgenMelden(morgen.story.id, 'ende');
  if (!weiter && !andere.length && !A.engpass) { A.engpass = true; protokoll('lese_engpass', { story: A.story }); }
  // Entscheidung 68: nach der Folge die Playlist der Staffel; „Nächste Folge“ ist der leichteste Weg, nichts anderes lenkt ab
  const sr = serieZu(t.story), stt = staffelText(sr, storyVon(t.story) || {});
  const folgen = KL.folgenStand(INH, f, t.story), y = KL.folgeVon(INH, t).y, gel = folgen.filter(x => x.gelesen).length;
  const i = Math.max(0, folgen.findIndex(x => x.beat === t.beat));
  const playlist = weiter && !zurueckInStory ? `<section class="playlist" data-ziel><div class="pl-kopf"><b>${esc((storyVon(t.story) || {}).titel || '')}</b><small>${esc(sr && sr.staffeln.length > 1 ? sr.titel + ' · ' + stt : sr ? sr.titel : '')} · ${gel}/${y}</small></div>
      ${folgen.slice(Math.max(0, i - 1), i + 3).map(x => `<div class="pl-folge${x.beat === t.beat ? ' eben' : ''}${x.beat === weiter.beat ? ' naechste' : ''}"><span class="nr">${x.beat}</span><span class="ti"><b>${esc(x.titel)}</b><small>${x.beat === t.beat ? 'eben gelesen' : x.beat === weiter.beat ? 'als Nächstes' : x.gelesen ? '✓ gelesen' : 'offen'}</small></span><span class="st">${x.gelesen ? '✓' : x.beat === weiter.beat ? '›' : ''}</span></div>`).join('')}
    </section>` : '';
  return `${kopf}${voll}${rundeFertig}
    ${playlist}
    ${weiter ? (zurueckInStory
      ? `<button class="wahl" data-act="weiter"><b>Neue Fragen zu ${esc((storyVon(t.story) || {}).titel || 'dieser Geschichte')}</b>Zurück zu Folge ${weiter.beat}${weiter.titel ? ': ' + esc(weiter.titel) : ''}</button>`
      : `<button class="naechste-folge" data-act="weiter"><b>Nächste Folge ${weiter.beat}: ${esc(weiter.titel || '')}</b>${letzte ? '' : `<span>${esc(t.teaser || '')}</span>`}</button>`) : ''}
    ${noch ? `<button class="wahl" data-act="nochEine"><b>Noch eine Frage zum Text</b>Der Text bleibt stehen.</button>` : ''}
    ${morgen ? `<section class="morgen-kasten"><div class="morgen-kopf">${esc(amText(morgen.am))}: <b>${esc(morgen.story.titel)}</b></div>
      <div class="mini">${iconHtml(morgen.story.id, false)}<span>${esc(morgen.story.kurz || '')}</span></div>${t.teaser ? `<p class="morgen-teaser">${esc(t.teaser)}</p>` : ''}</section>`
      : letzte && t.teaser ? `<p class="gedaempft">${esc(t.teaser)}</p>` : ''}
    ${andere.length && !weiter ? `<p class="wahl-kopf"><b>${morgen ? 'Bis dahin: andere Geschichten' : 'Etwas anderes'}</b></p>${andere.map(s => `<button class="wahl" data-act="storyWahl" data-s="${esc(s.id)}"><span class="mini">${iconHtml(s.id, false)}<span><b>${esc(s.titel)}</b>${neuMarke(s.id)}${esc(s.kurz || '')}</span></span></button>`).join('')}`
      : (!weiter ? '<p>Neue Folgen kommen bald.</p>' : '')}
    <button class="btn" data-act="start">Zum Start</button>`;
}
let stoppTimer = null;
function stoppBalken() {
  const bar = document.getElementById('stopp-balken'), knopf = document.getElementById('stopp-weiter');
  const bis = A.stoppBis;
  clearInterval(stoppTimer);
  stoppTimer = setInterval(() => {
    const rest = bis - Date.now();
    if (bar) bar.style.width = `${Math.min(100, 100 - (rest / KL.STOPP_MS) * 100)}%`;
    if (rest <= 0) { clearInterval(stoppTimer); if (knopf) knopf.disabled = false; }
  }, 100);
}
// Antwort auf die Hauptfrage
function antworten(id) {
  const q = INH.fragen[A.frage];
  const a = A.zug.find(x => x.id === id);
  if (!a) return;
  const ms = Date.now() - A.gezeigt;
  A.antwortGegeben = true;
  if (A.versuch === 1 && !A.gelesenGeloggt) {
    A.gelesenGeloggt = true;
    protokoll('lese_gelesen_bis', { karte: A.nr, absatz_max: A.absMax ?? null, absaetze: INH.texte[A.text].absaetze.length, beleg: q.beleg[0], ms_bis_antwort: Date.now() - A.start });
  }
  protokoll('lese_versuch', { karte: A.nr, versuch: A.versuch, gezeigt: A.zug.map(x => x.id), gewaehlt: id, richtig: a.richtig, ...(a.richtig ? {} : { fehlertyp: q.falsch[a.f].fehlertyp }), ms, abstand: A.zugAbstand, wortfallen: A.zugWortfallen });
  if (a.richtig) {
    A.ergebnis = A.versuch === 1 ? 'voll' : A.versuch === 2 ? 'hinweis' : 'leiter';
    if (A.geruest === 1 || A.versuch === 3) return karteFertig();
    A.phase = 'beleg'; A.belegVersuch = 1; return zeigeKarte();
  }
  if (A.versuch >= 3) { A.phase = 'aufloesung'; A.ergebnis = 'aufloesung'; protokoll('lese_aufloesung', { karte: A.nr }); return zeigeKarte(); }
  A.hinweis = q.falsch[a.f].hinweis;
  if (A.versuch === 2) { A.leiter = true; A.phase = 'leiter1'; A.zfNr = 0; protokoll('lese_leiter', { karte: A.nr, stufe: 'absatz' }); A.gezeigt = Date.now(); return zeigeKarte(); }
  if (ms < KL.SCHNELL_MS) { A.phase = 'stopp'; A.stoppBis = Date.now() + KL.STOPP_MS; protokoll('lese_lesestopp', { karte: A.nr, absatz: q.beleg[0] }); }
  else A.phase = 'hinweis';
  zeigeKarte();
}
function naechsterVersuch(abstand) {
  A.versuch += 1; A.phase = 'frage';
  neuZiehen(abstand);
  zeigeKarte();
}
function zfAntwort(ok) {
  const zf = INH.fragen[A.frage].zf[A.zfNr];
  protokoll('lese_zf', { karte: A.nr, nr: A.zfNr + 1, richtig: ok, ms: Date.now() - A.gezeigt });
  if (ok) { A.phase = 'merksatz'; return zeigeKarte(); }
  if (A.zfNr === 0) { A.phase = 'leiterHinweis'; return zeigeKarte(); }
  A.phase = 'leiterHinweis'; A.zfZweiterFehler = true; zeigeKarte();
  void zf;
}
function belegAntwort(i) {
  const q = INH.fragen[A.frage];
  const ok = i === q.beleg[0];
  if (A.phase === 'belegMarkiert' && !ok) return;
  protokoll('lese_beleg', { karte: A.nr, versuch: A.belegVersuch, absatz: i, richtig: ok });
  if (ok) return karteFertig();
  A.belegHinweis = true;
  if (A.belegVersuch === 1) { A.belegVersuch = 2; A.phase = 'belegHinweis'; }
  else { A.belegVersuch = 3; A.phase = 'belegMarkiert'; }
  zeigeKarte();
}
function karteFertig() {
  letzteKarte = A.nr;
  const f = fs(), q = INH.fragen[A.frage];
  const ms = Math.min(Date.now() - A.start, KL.KARTE_MAX_MS);
  const k = kasse();
  const roh = KL.lohnSek(A.ergebnis, A.belegHinweis);
  const vorher = heute().sek;
  const g = k ? LL.verdienen(k, heute(), roh, R(), { ms }) : { plus: 0, voll: false };
  A.lohnPlus = g.plus; A.vollJetzt = g.voll && vorher < LL.grenzeSek(R(), heute().tag);
  f.gelesen[A.text] = true;
  // Auftrag 67: Geschichte fertig, wenn die letzte Folge mit voll, hinweis oder leiter endet (Tag merken)
  { const tt = INH.texte[A.text]; if (KL.FERTIG_ERGEBNIS.includes(A.ergebnis) && tt.beat === KL.folgeVon(INH, tt).y && !f.fertig[tt.story]) f.fertig[tt.story] = heute().tag; }
  A.fb = KL.abschlussFrage(INH, f, INH.texte[A.text]);
  if (A.fb) { A.fbSeit = Date.now(); protokoll('lese_story_feedback_gezeigt', { story: A.story, text: A.text }); }
  if (A.ergebnis === 'voll' || A.ergebnis === 'hinweis') { f.erledigt[q.id] = true; delete f.zurueck[q.id]; }
  else { f.zurueck[q.id] = { karte: A.nr, t: new Date().toISOString() }; protokoll('lese_zurueckgelegt', { karte: A.nr, frage: q.id }); }
  const erstUndBeleg = A.ergebnis === 'voll' && !A.belegHinweis;
  // Sichere Karten zählen nicht für Auf- und Abstieg (Auftrag 63)
  const wechsel = A.sicher ? 0 : KL.typNachKarte(f, q.typ, { erstUndBeleg, leiter: A.leiter });
  if (A.sicher && !f.typen[q.typ]) f.typen[q.typ] = { schritt: 1, hist: [] };
  protokoll('lese_karte_ende', { karte: A.nr, frage: q.id, ergebnis: A.ergebnis, beleg_erst: A.geruest === 1 ? null : !A.belegHinweis, lohn: g.plus, lohn_roh: roh, sekunden: Math.round(ms / 1000), nachgeschlagen: A.nachgeschlagen.length, ...(wechsel ? { typ_stufe: wechsel } : {}), typ_schritt: KL.typStand(f, q.typ).schritt });
  if (f.runde && f.runde.karten >= KL.RUNDE) protokoll('lese_runde', { aktion: 'ende', nr: f.runde.nr, karten: f.runde.karten });
  A.phase = 'fertig'; S.laufend = null;
  sichern();
  if (!test()) syncen();
  zeigeKarte();
}
// ---------- Kanalseite einer Serie (Entscheidung 68): Staffeln, die laufende klappt ihre Folgen auf ----------
let ansichtKanal = null, kanalAuf = null;
function zeigeKanal(serieId, auf) {
  const sr = SERIEN().find(x => x.id === serieId);
  if (!sr) return zeigeStart(false);
  if (ansichtKanal !== serieId) { ansichtKanal = serieId; kanalAuf = null; }
  bodyStyle('tv');
  ansicht = 'kanal';
  const f = fs(), tag = heute().tag;
  const weiter = KL.staffelWeiter(INH, f, sr);
  if (auf !== undefined) kanalAuf = auf;
  const offenId = kanalAuf ?? weiter ?? sr.staffeln.find(st => INH.stories.some(x => x.id === st.id))?.id ?? null;
  const folgenGesamt = sr.staffeln.reduce((n, st) => n + (st.folgen || 0), 0);
  let weiterKnopf = '';
  if (weiter) { const t = KL.naechsterText(INH, f, weiter), st = storyVon(weiter), stt = staffelText(sr, st); weiterKnopf = `<button class="tv-btn" data-act="kanalLesen" data-s="${esc(weiter)}"><span class="tv-play"></span>Weiterlesen: ${stt ? stt + ', ' : ''}Folge ${t.beat}</button>`; }
  const zeilen = sr.staffeln.map(st => {
    const stand = KL.staffelStand(INH_ALLE, INH, f, st.id, tag), stt = staffelText(sr, st);
    const kopf = `${stt}${stt && st.jahr ? ' · ' : ''}${st.jahr || ''}`;
    if (stand.art === 'gesperrt') {
      const txt = stand.am ? amText(stand.am) : 'Kommt danach';
      return `<div class="tv-staffel gesperrt"><span class="tv-st-bild">${bildImg(st.icon, 'tv-st-ic')}</span><div><small>${esc(kopf)}</small><b>${esc(st.titel)}</b><span class="tv-marke ${stand.am ? 'blau' : ''}">${stand.am ? '' : '<i class="tv-schloss"></i>'}${esc(txt)}</span></div></div>`;
    }
    const auf = st.id === offenId;
    const status = stand.art === 'fertig' ? `<span class="tv-ok">✓ alle ${stand.folgen} Folgen</span>` : stand.art === 'neu' ? `<span class="tv-marke${istNeu(st.id) ? ' neu' : ''}">${istNeu(st.id) ? 'Neu' : 'Noch nicht gelesen'}</span>` : `<span class="tv-bar"><i style="width:${Math.round(100 * stand.gelesen / Math.max(1, stand.folgen))}%"></i></span>`;
    const liste = auf ? `<div class="tv-folgen">${KL.folgenStand(INH, f, st.id).map(fo => {
      const tid = fo.texte.find(id => KL.frageFuer(INH, f, id));
      const st2 = fo.jetzt ? '<em class="jetzt">Jetzt ›</em>' : fo.gelesen && !fo.offen ? '<em class="ok">✓</em>' : fo.gelesen ? '<em>Frage offen</em>' : '<em>offen</em>';
      const inner = `<span class="nr">${fo.beat}</span><span class="ti"><b>${esc(fo.titel)}</b><small>${fo.gelesen ? '✓ gelesen' : `${fo.texte.reduce((n, id) => n + Object.values(INH.fragen).filter(q => q.text === id).length, 0)} Fragen`}</small></span>${st2}`;
      return tid ? `<button class="tv-folge${fo.jetzt ? ' jetzt' : ''}" data-act="folge" data-s="${esc(st.id)}" data-t="${esc(tid)}">${inner}</button>` : `<div class="tv-folge fertig">${inner}</div>`;
    }).join('')}</div>` : '';
    return `<button class="tv-staffel${auf ? ' auf' : ''}" data-act="staffelAuf" data-s="${esc(st.id)}"><span class="tv-st-bild">${bildImg(st.icon, 'tv-st-ic')}</span><div><small>${esc(kopf)}</small><b>${esc(st.titel)}</b>${status}</div><span class="tv-pfeil">${auf ? '⌃' : '⌄'}</span></button>${liste}`;
  }).join('');
  $app.innerHTML = `<div class="screen start tv kanal">
    <div class="tv-top"><button class="tv-zurueck" data-act="start" aria-label="Zurück zum Start">‹</button></div>
    <header class="tv-kanal-kopf">${bildImg(sr.bild, 'tv-av-gross')}<div><h2>${esc(sr.titel)}</h2>${sr.kurz ? `<small>${esc(sr.kurz)}</small>` : ''}<small>${sr.staffeln.length} ${sr.staffeln.length === 1 ? 'Staffel' : 'Staffeln'}${folgenGesamt ? ` · ${folgenGesamt} Folgen` : ''}</small></div></header>
    ${weiterKnopf}
    <p class="tv-ueber">${sr.staffeln.length > 1 ? 'Staffeln' : 'Folgen'}</p>
    <div class="tv-staffeln">${zeilen}</div>
  </div>`;
  bilderEinsetzen();
}
// „Etwas anderes“ vom Start aus
function zeigeWahl() {
  bodyStyle(null);
  ansicht = 'wahl';
  const f = fs();
  const liste = INH.stories.filter(s => KL.naechsterText(INH, f, s.id));
  if (!liste.length) protokoll('lese_engpass', { story: null });
  $app.innerHTML = `<div class="screen les">
    <div class="top"><button class="ctl-t" data-act="start">‹ Start</button></div>
    <h2 class="les-titel">Was willst du lesen?</h2>
    ${liste.map(s => { const t = KL.naechsterText(INH, f, s.id), fo = KL.folgeVon(INH, t); return `<button class="wahl" data-act="storyWahl" data-s="${esc(s.id)}"><span class="mini">${iconHtml(s.id, false)}<span><b>${esc(s.titel)}</b>${neuMarke(s.id)}${esc(s.kurz || '')}<span class="gedaempft block">Folge ${fo.x} von ${fo.y}</span></span></span></button>`; }).join('') || '<p>Gerade sind alle Geschichten gelesen. Neue Folgen kommen bald.</p>'}
  </div>`;
  bilderEinsetzen();
}
function lesenWeiter() {
  const f = fs();
  const story = standardStory(f);
  if (!story) return zeigeWahl();
  karteStarten(story, 'start');
}
function glossarZeigen(w, el) {
  const t = INH.texte[A.text];
  const m = document.getElementById('modal');
  protokoll('lese_nachschlagen', { karte: A.nr, wort: w, vor_antwort: !A.antwortGegeben });
  if (!A.nachgeschlagen.includes(w)) A.nachgeschlagen.push(w);
  m.classList.add('offen');
  m.innerHTML = `<div class="modal-hinter" data-act="modalZu"></div><div class="modal-box gl-box" role="dialog" aria-modal="true"><button class="modal-x" data-act="modalZu" aria-label="Schließen">✕</button><h2 class="modal-titel">${esc(w)}</h2><p>${esc(t.glossar[w])}</p></div>`;
  void el;
}

// Abschicken: wie in der Mathe-App. Beim Öffnen reservieren, dann teilen.
let bzBild = null, bzGeschickt = null, bzGeoeffnet = 0;
function resDaten() {
  const r = S.kasse && S.kasse.res;
  return r ? { stand: r.sek, aufgaben: r.aufgaben || 0, ms: r.uebung_ms || 0, msVoll: true, code: r.code, teile: { mathe: r.mathe || 0, lesen: r.lesen || 0, karten: r.lesekarten || 0 } } : null;
}
function zeigeAbschicken() {
  bodyStyle(null);
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
  bodyStyle(null);
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
    case 'start': clearInterval(stoppTimer); if (A && A.phase !== 'fertig') abbruch('start'); zeigeStart(); break;
    case 'lesen': if (INH) lesenWeiter(); break;
    case 'nochmalVersuchen': if (INH) { letzteKarte = null; lesenWeiter(); } break;
    case 'anderes': if (INH) zeigeWahl(); break;
    case 'kanal': if (INH) { protokoll('lese_serie', { serie: el.dataset.s, anlass: ansicht === 'karte' ? 'ende' : 'start' }); window.scrollTo(0, 0); zeigeKanal(el.dataset.s); } break;
    case 'staffelAuf': zeigeKanal(ansichtKanal, kanalAuf === el.dataset.s || (kanalAuf == null && KL.staffelWeiter(INH, fs(), SERIEN().find(x => x.id === ansichtKanal)) === el.dataset.s) ? '' : el.dataset.s); break;
    case 'kanalLesen': karteStarten(el.dataset.s, 'kanal'); break;
    case 'folge': protokoll('lese_wahl', { art: 'folge', story: el.dataset.s, text: el.dataset.t }); karteStarten(el.dataset.s, 'kanal', el.dataset.t); break;
    case 'storyWahl': if (ansicht === 'karte' && A) protokoll('lese_wahl', { art: 'anders', story: el.dataset.s }); karteStarten(el.dataset.s, ansicht === 'karte' ? 'anders' : 'start'); break;
    case 'weiter': { const w = KL.weiterText(INH, fs(), INH.texte[A.text]); protokoll('lese_wahl', { art: 'weiter', story: A.story }); karteStarten(A.story, 'weiter', w ? w.id : null); break; }
    case 'nochEine': protokoll('lese_wahl', { art: 'noch_eine', story: A.story, text: A.text }); karteStarten(A.story, 'noch_eine', A.text); break;
    case 'storyFb': if (A && A.fb) {
      const f = fs(), t = INH.texte[A.text];
      protokoll('lese_story_feedback', { story: A.story, antwort: el.dataset.a, gelesen: KL.folgenGelesen(INH, f, A.story), folgen: KL.folgeVon(INH, t).y, ms: Date.now() - A.fbSeit, text: A.text, ...(el.dataset.a !== 'weiss_nicht' ? { knopf: A.fb[el.dataset.a] } : {}) });
      f.gefragt[A.story] = A.text; A.fb = null; sichern(); zeigeKarte();
    } break;
    case 'antwort': if (A && A.phase === 'frage') antworten(el.dataset.id); break;
    case 'verstanden': if (A && (A.phase === 'hinweis' || A.phase === 'stopp')) naechsterVersuch(Math.max(1, A.stufe - 1)); break;
    case 'zf': if (A && (A.phase === 'leiter1' || A.phase === 'leiter2')) zfAntwort(el.dataset.id === 'ja'); break;
    case 'leiterWeiter': if (A.zfNr === 0) { A.zfNr = 1; A.phase = 'leiter2'; protokoll('lese_leiter', { karte: A.nr, stufe: 'satz' }); A.gezeigt = Date.now(); } else A.phase = 'merksatz'; zeigeKarte(); break;
    case 'merksatzWeiter': naechsterVersuch(1); break;
    case 'absatz': if (A && ['beleg', 'belegHinweis', 'belegMarkiert'].includes(A.phase)) belegAntwort(Number(el.dataset.i)); break;
    case 'aufloesungWeiter': karteFertig(); break;
    case 'tippOk': fs().nachschlagTipp = true; protokoll('lese_tipp', { aktion: 'alles_klar' }); sichern(); zeigeKarte(); break;
    case 'gl': if (A) glossarZeigen(el.dataset.w, el); break;
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
    case 'testZurueck': { if (S.kasse && test()) { S.kasse = null; S.tag = null; sichern(); } zeigeEltern('Test-Lese-Zeit und Test-Konto sind gelöscht.'); break; }
    case 'neuEinrichten': S.name = ''; S.upload = { tage: {} }; S.einst = null; S.kasse = test() ? null : S.kasse; sichern(); zeigeEinrichtung(); break;
    case 'eltern': zeigeEltern(); break;
  }
});
document.addEventListener('visibilitychange', () => {
  if (teilenLaeuft && document.hidden) teilenWeg = true;
  // Auftrag 66: Karte im Hintergrund (kommt das Kind zurück: lese_hintergrund; wird die App dabei beendet: Abbruch beim nächsten Start)
  const karteLaeuft = ansicht === 'karte' && A && A.phase !== 'fertig';
  if (document.hidden && karteLaeuft) { A.wegSeit = Date.now(); if (S.laufend) { S.laufend.hintergrund = true; S.laufend.zuletzt = Date.now(); sichern(); } }
  if (!document.hidden && A && A.wegSeit) { if (karteLaeuft) { protokoll('lese_hintergrund', { karte: A.nr, ms: Date.now() - A.wegSeit }); if (S.laufend) S.laufend.hintergrund = false; laufendMerken(); } A.wegSeit = null; }
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

// Auftrag 66: Karte vom letzten Mal nicht zu Ende gespielt
if (S.laufend) abbruch(S.laufend.hintergrund ? 'hintergrund' : 'app_neu');
// Start: Einrichtungs-Link in der Adresse (Kamera-App) übernehmen
if (einrichtungLesen(location.hash)) einrichten(location.hash);
else { zeigeStart(); versionPruefen(); }
setInterval(() => { if (!document.hidden) syncen(); }, 10 * 60 * 1000);
