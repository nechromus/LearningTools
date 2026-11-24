// Eltern-App: Bereich „Themenwahl“ im Reiter Mathe (Auftrag 74, Teil 8). Nur lesen.
// daten/<name>/themenwahl.json (Format themenwahl-1, schreibt die Übungs-App) und ../data/themen.json (Themen, Teilschritte, Abhängigkeiten).
import * as TW from '../js/themenwahl.js';
import { ringSvg, karteSvg } from '../js/themenwahl-ui.js';
import { esc } from '../js/render.js';

const WAHL = { pruefen: 'sitzt (kurz checken)', wiederholen: 'wiederholen', neu: 'neu', spaeter: 'später', nicht: 'nicht' };
const SELBST = { kann: 'kann', unsicher: 'unsicher', noch_nicht: 'noch nicht' };
const STAND = { sitzt: 'sitzt', wackelt: 'wackelt', offen: 'offen' };
const d = (x) => { const a = String(x || '').split('-'); return a.length === 3 ? `${+a[2].slice(0, 2)}.${+a[1]}.` : ''; };
const EREIGNISSE = ['missionsplanung', 'themenwahl', 'thema_aktiv', 'einstufung', 'voraussetzung', 'klassenarbeit', 'ziel', 'teilschritt_stand', 'etappe_neu'];

let TD = null, laedt = null;
export const themenSetzen = (roh) => { TD = TW.datenVon(roh); };
export function themenLaden(zeichne) {
  if (TD || laedt) return TD;
  laedt = fetch('../data/themen.json').then(r => r.json()).then(j => { TD = TW.datenVon(j); zeichne(); }).catch(() => { laedt = null; });
  return null;
}

function ereignisText(e, n) {
  const t = (x) => esc(n(x));
  switch (e.typ) {
    case 'missionsplanung': return e.aktion === 'fertig' ? `Missionsplanung fertig: aktiv ${(e.aktiv || []).map(t).join(', ') || '–'}` : e.aktion === 'spaeter' ? 'Missionsplanung: „Später“' : 'Missionsplanung gezeigt';
    case 'themenwahl': return `${t(e.thema)}: ${esc(WAHL[e.vorher] || e.vorher || '–')} → <b>${esc(WAHL[e.wahl] || e.wahl)}</b>${e.anlass === 'meine_themen' ? ' (Meine Themen)' : ''}`;
    case 'thema_aktiv': return `${{ hinzu: 'Thema geholt', tausch: 'Themen getauscht', pause: 'Pausiert', reihenfolge: 'Reihenfolge geändert' }[e.aktion] || e.aktion}: ${t(e.thema)}${e.anteile ? ` · ${Object.entries(e.anteile).map(([k, v]) => `${t(k)} ${v} %`).join(', ')}` : ''}`;
    case 'einstufung': return e.aktion === 'start' ? `Schnell-Check begonnen: ${t(e.thema)}${e.art === 'voraus' ? ' (Voraussetzungen)' : ''}` : `Schnell-Check ${t(e.thema)}: ${Object.values(e.ergebnis || {}).filter(x => x === 'sitzt').length} sitzt, ${Object.values(e.ergebnis || {}).filter(x => x === 'wackelt').length} wackelt${e.angenommen === true ? ' · auf „wiederholen“ gestellt' : e.angenommen === false ? ' · Vorschlag abgelehnt' : ''}`;
    case 'voraussetzung': return `Voraussetzungen ${t(e.thema)}: ${e.aktion === 'erst_pruefen' ? 'erst checken' : e.aktion === 'trotzdem' ? 'trotzdem starten' : 'gezeigt'} (${(e.offen || []).length} offen, ${(e.wackelt || []).length} wackelt)`;
    case 'klassenarbeit': return `Klassenarbeit ${e.aktion === 'rueckmeldung' ? `Rückmeldung „${esc(e.antwort)}“` : { eingetragen: 'eingetragen', geaendert: 'geändert', geloescht: 'gelöscht' }[e.aktion] || e.aktion}: ${t(e.thema)} am ${d(e.datum)}`;
    case 'ziel': return `Ziel geändert: ${esc(Object.entries(e.werte || {}).map(([k, v]) => `${k} ${v}`).join(', '))}`;
    case 'teilschritt_stand': return `${esc(n(e.teilschritt, true))}: ${esc(STAND[e.vorher] || e.vorher)} → <b>${esc(STAND[e.nachher] || e.nachher)}</b> <span class="gedaempft">(${esc({ selbst: 'eigene Einschätzung', kurzcheck: 'Schnell-Check', ueben: 'Üben' }[e.grund] || e.grund)})</span>`;
    case 'etappe_neu': return e.thema ? `Neue Etappe: ${t(e.thema)} ${e.von} → ${e.nach}` : '';
  }
  return '';
}

// tw = Inhalt von themenwahl.json; eintraege = Protokoll (letzte Tage); heute = JJJJ-MM-TT
export function seite({ tw, eintraege, heute, name, laedt: dateiLaedt }) {
  if (!TD) return '<section class="karte"><p class="pad gedaempft">Themen werden geladen …</p></section>';
  if (!tw) return `<section class="karte"><p class="pad gedaempft">${dateiLaedt ? 'Themenwahl wird geladen …' : `${esc(name)} hat die Missionsplanung noch nicht gemacht (keine themenwahl.json).`}</p></section>`;
  const z = TW.norm(tw, {}, TD);
  const n = (id, schritt = false) => (schritt ? TW.schrittName(TD, id) : (TD.T[id] || {}).name || id);
  const an = TW.anteile(z, heute);
  const r = TW.ringe(z, heute), wo = TW.woche(z, heute), ka = TW.klassenarbeitJetzt(z, heute);
  const sitzt = Object.values(z.teilschritte).filter(s => s.stand === 'sitzt').length, wack = Object.values(z.teilschritte).filter(s => s.stand === 'wackelt').length;
  const gewaehlt = TW.listenThemen(TD).filter(t => z.aktiv.some(a => a.thema === t.id) || ['neu', 'wiederholen', 'pruefen'].includes(z.wahl[t.id])).map(t => t.id);
  const ev = (eintraege || []).filter(e => EREIGNISSE.includes(e.typ) && (e.typ !== 'etappe_neu' || e.thema)).slice(-60).reverse();
  const selbst = Object.entries(z.schule.selbst || {});
  const monat = heute.slice(0, 7), [y, m] = monat.split('-').map(Number), tage = new Date(Date.UTC(y, m, 0)).getUTCDate(), versatz = (new Date(`${monat}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const maxMin = Math.max(30, ...Object.values(z.tage).map(t => t.ms / 60000));
  const kal = [...Array(versatz).fill('<i class="leer"></i>'), ...Array.from({ length: tage }, (_, i) => { const k = `${monat}-${String(i + 1).padStart(2, '0')}`; const min = z.tage[k] ? Math.round(z.tage[k].ms / 60000) : 0; return `<i style="background:${min ? `rgba(255,159,90,${0.2 + 0.8 * Math.min(1, min / maxMin)})` : 'var(--flaeche, #eee)'}"><b>${i + 1}</b>${min ? `<small>${min}</small>` : ''}</i>`; })];
  return `
  <section class="karte tw-e"><h2 class="abschnitt-in">Mission</h2>
    <p class="klein gedaempft">${z.planung.status === 'fertig' ? `Missionsplanung fertig am ${d(z.planung.fertig)}` : z.planung.status === 'spaeter' ? 'Missionsplanung auf „Später“ gestellt' : 'Missionsplanung noch offen'} · Stand ${esc(z.geaendert ? new Date(z.geaendert).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–')} · Version ${z.version}</p>
    <table class="tw-e-tab"><tr><th>Platz</th><th>Thema</th><th>Anteil</th><th>Etappe</th></tr>${an.map((x, i) => `<tr><td>${x.ka ? 'Klassenarbeit' : i + 1}</td><td>${esc(n(x.thema))}${TW.bereit(x.thema) ? '' : ' <span class="bg-pill warn">wird vorbereitet</span>'}</td><td>${x.mitKa} %${x.ist !== x.mitKa ? ` <span class="gedaempft">(geübt ${x.ist} %)</span>` : ''}</td><td>${TW.bereit(x.thema) ? `${TW.etappeVon(z, x.thema)} von ${TW.ETAPPEN}` : '–'}</td></tr>`).join('') || '<tr><td colspan="4" class="gedaempft">Kein Thema aktiv.</td></tr>'}</table>
    ${z.pausiert.length ? `<p class="klein">Pausiert: ${z.pausiert.map(p => `${esc(n(p.thema))} (seit ${d(p.seit)})`).join(', ')}</p>` : ''}
    ${z.kc ? `<p class="klein">Schnell-Check läuft: ${esc(n(z.kc.thema))}, ${z.kc.idx} von ${z.kc.ids.length}</p>` : ''}
    ${(z.klassenarbeiten || []).length ? `<h3>Klassenarbeiten</h3><ul class="tw-e-liste">${z.klassenarbeiten.map(k => `<li>${d(k.datum)} · ${esc(n(k.thema))}${k.rueckmeldung ? ` · Rückmeldung: „${esc(k.rueckmeldung)}“` : k.datum < heute ? ' · noch keine Rückmeldung' : ` · noch ${Math.round((Date.parse(k.datum) - Date.parse(heute)) / 864e5)} Tage`}</li>`).join('')}</ul>` : ''}
  </section>
  <section class="karte tw-e tw-dunkel"><h2 class="abschnitt-in">Heute und diese Woche</h2>
    <div class="tw-e-ringe">${ringSvg(120, [{ v: r.minuten, ziel: r.ziel.minuten, farbe: '#FF9F5A' }, { v: r.neu, ziel: r.ziel.neu, farbe: '#8FBFFF' }, { v: r.tiefe, ziel: r.ziel.tiefe, farbe: '#C9A0DC' }])}
      <div><div><b>${r.minuten}</b> von ${r.ziel.minuten} Min. geübt</div><div><b>${r.neu}</b> von ${r.ziel.neu} Teilschritten neu</div><div><b>${r.tiefe}</b> von ${r.ziel.tiefe} in der Tiefe</div><div class="klein">Woche: ${wo.anzahl} von ${wo.ziel} Tagen (${wo.tage.filter(t => t.geuebt).map(t => d(t.tag)).join(', ') || '–'})</div></div></div>
    <div class="tw-e-kal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(t => `<span>${t}</span>`).join('')}${kal.join('')}</div>
  </section>
  <section class="karte tw-e"><h2 class="abschnitt-in">Befragung</h2>
    <p><b>Schule jetzt:</b> ${z.schule.themen.map(t => esc(n(t))).join(', ') || '–'}${z.schule.freitext ? ` · anderes: „${esc(z.schule.freitext)}“` : ''}</p>
    ${selbst.length ? `<p><b>Eigene Einschätzung:</b> ${['kann', 'unsicher', 'noch_nicht'].map(k => `${selbst.filter(x => x[1] === k).length} ${SELBST[k]}`).join(' · ')}</p><details><summary class="klein">Einzeln</summary><ul class="tw-e-liste">${selbst.map(([k, v]) => `<li>${esc(k.startsWith('_') ? (k === '_anders' ? 'anderes' : n(k.split(':')[1])) : n(k, true))}: <b>${esc(SELBST[v] || v)}</b></li>`).join('')}</ul></details>` : ''}
    <p><b>Wahlpflichtkurs:</b> ${z.kurs.themen.map(t => esc(n(t))).join(', ') || '–'}${z.kurs.freitext ? `<br><span class="gedaempft">„${esc(z.kurs.freitext)}“</span>` : ''}</p>
    <details><summary><b>Wahl je Thema</b> <span class="klein gedaempft">(${Object.values(z.wahl).filter(w => w === 'neu').length} neu, ${Object.values(z.wahl).filter(w => w === 'wiederholen').length} wiederholen, ${Object.values(z.wahl).filter(w => w === 'pruefen').length} sitzt)</span></summary>
      ${TD.gruppen.filter(g => g !== 'Grundlage').map(g => { const ts = TW.listenThemen(TD).filter(t => t.gruppe === g); return ts.length ? `<h3>${esc(g)}</h3><ul class="tw-e-liste">${ts.map(t => `<li>${esc(t.name)}: <b>${esc(WAHL[z.wahl[t.id]] || '–')}</b>${z.kurs.themen.includes(t.id) ? ' · Kurs' : ''}${z.schule.themen.includes(t.id) ? ' · Unterricht' : ''}${TW.bereit(t.id) ? '' : ' · <span class="gedaempft">wird vorbereitet</span>'}</li>`).join('')}</ul>` : ''; }).join('')}</details>
  </section>
  <section class="karte tw-e tw-dunkel"><h2 class="abschnitt-in">Stand je Teilschritt</h2>
    <p class="klein">${sitzt} sitzen, ${wack} wackeln. Voll = geprüft oder geübt, Ring = eigene Einschätzung oder Grundlage aus einem anderen Thema. Gelber Ring = aktives Thema.</p>
    ${gewaehlt.length ? `<div class="tw-karte">${karteSvg(TD, z, gewaehlt, z.aktiv.map(a => a.thema), null)}</div>` : '<p class="gedaempft">Noch keine Themen gewählt.</p>'}
  </section>
  <section class="karte tw-e"><h2 class="abschnitt-in">Verlauf der Änderungen</h2>
    ${ev.length ? `<ul class="tw-e-liste">${ev.map(e => { const tx = ereignisText(e, n); return tx ? `<li><span class="gedaempft">${esc(new Date(e.t).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span> ${tx}</li>` : ''; }).join('')}</ul>` : '<p class="gedaempft">Noch keine Änderungen in den geladenen Tagen.</p>'}
  </section>`;
}
