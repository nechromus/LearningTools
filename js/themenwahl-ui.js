// Bildschirme der Themenwahl (Auftrag 74): Missionsplanung, Meine Themen, Thema holen, Schnell-Check-Ergebnis, Fortschritt.
// Gestaltung „Logbuch Sternzeit“. Logik in js/themenwahl.js. Klicks kommen über data-act="tw:<aktion>" aus app.js.
import * as TW from './themenwahl.js';
import { esc as escH } from './render.js';

let C = null;          // Verbindung zur App (init)
const ui = { schritt: 1, offen: { 'Schulstoff Klasse 9': true }, detail: null, jetzt: null, c1: [], reiter: 'heute', karteAlle: false, karteSel: null, verlaufThema: null, monat: null, holen: false, zurueck: 'start' };
const esc = (s) => C.esc(s);
const tw = () => C.tw();
const D = () => C.D();
const heute = () => C.heute();
const FEEDBACK = '<div class="sz-hinweisbox">Wenn etwas nicht klappt oder du eine Idee hast: Schreib es über den <b class="sz-pfirsich">Feedback-Knopf</b>. Das liest jemand.</div>';
// Für Themen, die es in der App noch nicht gibt (Wunsch Vater 24.11.)
const VORBEREITET = '<div class="sz-hinweisbox tw-vorbereitet"><b class="sz-pfirsich">Wird vorbereitet:</b> Manche Themen gibt es in der App noch nicht. Wir bauen sie gerade. Das braucht ein paar Tage. Was du wählst, bauen wir zuerst. Ist dir ein Thema besonders wichtig? Schreib es über den <b class="sz-pfirsich">Feedback-Knopf</b>. Gerade jetzt brauchen wir deine Rückmeldung: Was klappt, was fehlt, was ist zu leicht oder zu schwer? So wird die App für deine Themen richtig gut.</div>';
const WAHL_TXT = { pruefen: 'Sitzt', wiederholen: 'Wiederh.', neu: 'Neu', spaeter: 'Später', nicht: 'Nicht' };
const SELBST_TXT = { kann: 'Kann ich', unsicher: 'Unsicher', noch_nicht: 'Noch nicht' };
const STAND_TXT = { sitzt: 'sitzt', wackelt: 'wackelt', offen: 'noch offen' };
const DATUM = (d) => { const [y, m, t] = String(d).split('-'); return `${Number(t)}.${Number(m)}.`; };
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const wochentag = (d) => WT[new Date(d + 'T12:00:00Z').getUTCDay()];
const tageBis = (d) => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(heute() + 'T12:00:00Z')) / 864e5);

export function init(ctx) { C = ctx; }
const tname = (t) => (D().T[t] && D().T[t].name) || t;
const kopf = (titel) => C.kopf(titel);
function zeigen(html, ansicht = 'tw') { C.ansicht(ansicht); C.app.innerHTML = `<div class="screen sz-screen tw-screen">${html}</div>`; C.app.scrollTop = 0; window.scrollTo(0, 0); }
const dot = (stand, selbst = false) => `<span class="tw-dot ${stand}${selbst ? ' selbst' : ''}"></span>`;
const marken = (t) => {
  const z = tw(), m = [];
  if (z.kurs.themen.includes(t)) m.push('<span class="tw-mk kurs">aus dem Kurs</span>');
  if (z.schule.themen.includes(t)) m.push('<span class="tw-mk schule">im Unterricht</span>');
  if (!TW.bereit(t)) m.push('<span class="tw-mk vor">wird vorbereitet</span>');
  if (TW.kurzcheckSchritte(D(), C.kc(), t).length) m.push('<span class="tw-mk check">Schnell-Check da</span>');
  const h = (C.regeln().hinweise || {})[t]; if (h) m.push(`<span class="tw-mk hinw">${esc(h)}</span>`);
  return m.join('');
};
function wahlSetzen(t, w, anlass) {
  const z = tw(), vorher = z.wahl[t] || null;
  if (vorher === w) return;
  z.wahl[t] = w;
  C.protokoll('themenwahl', { thema: t, wahl: w, vorher, anlass });
  TW.geaendert(z); C.sichern();
}
function vorHtml(t) {
  const v = TW.voraussetzungen(D(), t);
  if (!v.length) return '<div class="sz-matt klein">Braucht nichts von außerhalb.</div>';
  return `<div class="sz-label">Braucht vorher</div>${v.map(x => { const st = TW.standVon(tw(), x.id); return `<div class="tw-vor">${dot(st, TW.selbstSitzt(tw(), x.id))}<span>${esc(TW.schrittName(D(), x.id))} <span class="sz-matt klein">· Stufe ${x.stufe} · ${STAND_TXT[st]}</span></span></div>`; }).join('')}`;
}
function hilftHtml(t) { const h = TW.hilft(D(), t); return h.length ? `<div class="sz-label" style="margin-top:6px">Hilft auch</div>${h.map(id => `<div class="tw-vor">${dot(TW.standVon(tw(), id))}<span class="sz-matt">${esc(TW.schrittName(D(), id))}</span></div>`).join('')}` : ''; }

// ---------- Start ----------
export function ringSvg(gr, werte) {
  const c = gr / 2, sw = gr * 0.1; let h = `<svg width="${gr}" height="${gr}" viewBox="0 0 ${gr} ${gr}" aria-hidden="true">`;
  werte.forEach((w, i) => {
    const r = c - sw / 2 - i * (sw + gr * 0.03), u = 2 * Math.PI * r, f = Math.min(1, w.ziel ? w.v / w.ziel : 0);
    h += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${w.farbe}" stroke-opacity=".2" stroke-width="${sw}"/>`;
    if (f > 0) h += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${w.farbe}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${u * f} ${u}" transform="rotate(-90 ${c} ${c})"/>`;
  });
  return h + '</svg>';
}
const ringWerte = () => { const r = TW.ringe(tw(), heute()); return [{ v: r.minuten, ziel: r.ziel.minuten, farbe: '#FF9F5A' }, { v: r.neu, ziel: r.ziel.neu, farbe: '#8FBFFF' }, { v: r.tiefe, ziel: r.ziel.tiefe, farbe: '#C9A0DC' }]; };
export function startHtml({ extras = '', gesperrt = false, wartet = false, version = '' }) {
  const z = tw(), fertig = z.planung.status === 'fertig';
  const r = TW.ringe(z, heute()), wo = TW.woche(z, heute());
  const an = TW.anteile(z, heute(), C.bereit);
  const ka = TW.klassenarbeitJetzt(z, heute());
  const kannUeben = an.some(x => x.ist > 0) || !!z.kc;
  return `${C.startKopf()}
    <p class="sz-gruss">Willkommen an Bord${C.name() ? `, <b>${esc(C.name())}</b>` : ''}.</p>
    ${extras}
    ${fertig ? `<button class="tw-mini" data-act="tw:fortschritt" data-r="heute">${ringSvg(54, ringWerte())}<div><div class="sz-label">Heute</div><div><b>${r.minuten}</b> von ${r.ziel.minuten} Min. · <b>${r.neu}</b> neu · <b>${r.tiefe}</b> tief</div><div class="sz-matt klein">Woche: ${wo.anzahl} von ${wo.ziel} Tagen</div></div><span class="sz-matt">›</span></button>
    ${z.kcErgebnis ? `<button class="sz-knopf blau" data-act="tw:kcErgebnis">Ergebnis vom Schnell-Check <small>▶</small></button>` : ''}
    <div class="sz-panel orange"><div class="sz-label">Deine Mission</div>${an.length ? an.map((x, i) => `<div class="tw-zeile"><span>${i + 1}. ${esc(tname(x.thema))}${C.bereit(x.thema) ? ` <span class="sz-matt klein">· Etappe ${TW.etappeVon(z, x.thema)}</span>` : ' <span class="tw-mk vor">wird vorbereitet</span>'}${x.ka ? ' <span class="tw-mk kurs">Klassenarbeit</span>' : ''}</span><b class="sz-pfirsich">${x.ist ? x.ist + ' %' : ''}</b></div>`).join('') : '<div class="sz-matt">Noch kein Thema aktiv.</div>'}
      ${z.kc ? `<div class="sz-matt klein">Schnell-Check läuft: ${z.kc.idx} von ${z.kc.ids.length}</div>` : ''}</div>
    ${ka ? `<button class="sz-panel gelb tw-ka" data-act="tw:meine"><div class="tw-tage">${Math.max(0, tageBis(ka.datum))}</div><div><div class="sz-label">${tageBis(ka.datum) === 1 ? 'Tag' : 'Tage'} bis zur Klassenarbeit</div><div>${esc(tname(ka.thema))} · ${wochentag(ka.datum)} ${DATUM(ka.datum)}</div></div></button>` : ''}
    ${gesperrt ? `<div class="sz-panel orange"><b class="sz-pfirsich">Für heute hast du dein Pensum erreicht.</b></div><button class="sz-knopf" data-act="uebungszeit">Eltern fragen <small>▶</small></button>`
      : kannUeben ? `<button class="sz-knopf sz-start-knopf" data-act="aufgaben">${wartet ? 'Weiter mit deiner Aufgabe' : z.kc ? 'Weiter mit dem Schnell-Check' : 'Aufgaben machen'} <small>▶</small></button>`
        : '<div class="sz-hinweisbox">Deine aktiven Themen werden noch vorbereitet. Hol dir unter „Meine Themen“ ein Thema, das schon Aufgaben hat.</div>' + VORBEREITET}
    <div class="sz-zeile"><button class="sz-knopf flieder klein" data-act="tw:meine">Meine Themen</button><button class="sz-knopf blau klein" data-act="tw:fortschritt" data-r="heute">Fortschritt</button></div>`
    : `<div class="sz-panel"><p style="margin:0">Physik ruht. Plane zuerst deine Mathe-Mission. Danach gibt es Aufgaben.</p></div>
    <button class="sz-knopf flieder" data-act="tw:planung" data-s="1">Missionsplanung <small>▶</small></button>`}
    <p class="version-zeile">Version ${version}</p>`;
}

// ---------- Missionsplanung ----------
const punkte = (n) => `<div class="tw-punkte">${[1, 2, 3, 4, 5, 6].map(i => `<i class="${i < n ? 'fertig' : i === n ? 'an' : ''}"></i>`).join('')}</div>`;
const b2aThemen = () => { const z = tw(), l = z.schule.themen.filter(t => D().T[t]); const ka = (z.klassenarbeiten || []).find(k => k.entwurf || k.datum >= heute()); if (ka && ka.thema && D().T[ka.thema] && !l.includes(ka.thema)) l.push(ka.thema); return l; };
const morgen = () => { const [y, m, d] = heute().split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + 1)); return x.toISOString().slice(0, 10); };
const kaEntwurf = () => tw().klassenarbeiten.find(k => k.datum >= heute()) || null;
export function planung(schritt = ui.schritt) {
  ui.schritt = schritt; ui.ort = 'planung';
  const z = tw();
  if (schritt === 1 && z.planung.status !== 'fertig' && z.planung.gezeigt !== heute()) { z.planung.gezeigt = heute(); C.protokoll('missionsplanung', { aktion: 'gezeigt', schritt: 1 }); C.sichern(); }
  const fuss = (weiter = 'Weiter', nr = schritt + 1) => `<button class="sz-knopf" data-act="tw:planung" data-s="${nr}">${weiter} <small>▶</small></button>${schritt > 1 ? `<button class="sz-zurueck" data-act="tw:planung" data-s="${schritt - 1}">‹ Zurück</button>` : ''}`;
  let h = kopf('Missions&shy;planung') + punkte(schritt);
  if (schritt === 1) {
    h += `<h2 class="tw-h">Neue Mission</h2>
      <div class="sz-panel"><p style="margin:0">Physik ruht. Ab jetzt planst du deine Mathe-Mission selbst. Drei kurze Fragen, dann wählst du deine Themen. Du kannst alles später ändern.</p></div>
      ${FEEDBACK}
      <button class="sz-knopf" data-act="tw:planung" data-s="2">Los geht's <small>▶</small></button>
      ${z.planung.status === 'fertig' ? '<button class="sz-zurueck" data-act="tw:meine">‹ Zurück zu meinen Themen</button>' : '<button class="sz-knopf matt klein" data-act="tw:spaeter">Später</button>'}`;
  } else if (schritt === 2) {
    const schul = TW.schulThemen(D()).map(t => t.id).concat(D().T.trigo ? ['trigo'] : []);
    const ka = kaEntwurf();
    h += `<h2 class="tw-h">Schule jetzt</h2><p class="sz-matt">Was macht ihr gerade im Unterricht? Tippe alles an, was passt.</p>
      <div class="tw-chips">${schul.map(t => `<button class="tw-chip${z.schule.themen.includes(t) ? ' an' : ''}" data-act="tw:schule" data-t="${t}">${esc(tname(t))}</button>`).join('')}<button class="tw-chip${z.schule.anders ? ' an' : ''}" data-act="tw:schule" data-t="_anders">anderes …</button></div>
      ${z.schule.anders || ui.anders ? `<input class="tw-feld" id="tw-anders" maxlength="120" placeholder="Was noch?" value="${esc(z.schule.freitext || '')}">` : ''}
      <div class="sz-panel gelb"><div class="sz-label">Nächste Klassenarbeit (freiwillig)</div>
        ${!(ui.kaOffen || ka) ? '<p class="sz-matt" style="margin:4px 0">Keine eingetragen.</p>' : `<input class="tw-feld" type="date" id="tw-ka-datum" min="${morgen()}" value="${ka ? ka.datum : ''}">
        <select class="tw-feld" id="tw-ka-thema"><option value="">Thema wählen</option>${TW.listenThemen(D()).map(t => `<option value="${t.id}"${ka && ka.thema === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`}
        ${ka ? '' : `<button class="sz-zurueck" data-act="tw:kaWeiss">${ui.kaOffen ? 'Doch keine eintragen' : 'Klassenarbeit eintragen'}</button>`}</div>
      ${fuss()}`;
  } else if (schritt === 3) {
    const themen = b2aThemen();
    const ka = kaEntwurf();
    const anders = z.schule.freitext && z.schule.anders;
    const sel = (key, t, ts) => `<div class="tw-seg">${TW.SELBST.map(k => `<button class="${k}${(z.schule.selbst[key] === k) ? ' an' : ''}" data-act="tw:selbst" data-k="${esc(key)}" data-t="${t}"${ts ? ` data-ts="${ts}"` : ''} data-w="${k}">${SELBST_TXT[k]}</button>`).join('')}</div>`;
    const block = (t) => {
      const th = D().T[t];
      const titel = `<div class="sz-liste-kopf">${esc(th.name)}${ka && ka.thema === t ? ' · Klassenarbeit' : ''}</div>`;
      if (!TW.mitStufen(D(), t)) return titel + `<div class="tw-th"><div class="tw-thn">Das ganze Thema</div><div class="sz-matt klein">${esc(th.kern || '')}</div>${sel('_thema:' + t, t)}</div>`;
      return titel + th.schritte.map(s => { const b = TW.beispielBisG(D(), s.id); return `<div class="tw-th"><div class="tw-thn">${esc(s.name)}</div>${b ? `<div class="sz-matt klein">${b.beispiel ? `z. B. <b class="sz-pfirsich">${C.mathe(b.beispiel)}</b>` : esc(b.text)}</div>` : ''}${sel(s.id, t, s.id)}</div>`; }).join('');
    };
    const mitCheck = themen.filter(t => TW.kurzcheckSchritte(D(), C.kc(), t).length);
    h += `<h2 class="tw-h">Was kannst du schon?</h2><p class="sz-matt">Zu deinen Unterrichtsthemen: Kannst du das? Ehrlich ist am besten. Niemand bewertet das.</p>
      ${themen.length ? themen.map(block).join('') : '<div class="sz-panel"><p style="margin:0">Du hast kein Unterrichtsthema angetippt. Dann geht es gleich weiter.</p></div>'}
      ${anders ? `<div class="sz-liste-kopf">${esc(z.schule.freitext)}</div><div class="tw-th"><div class="tw-thn">Das ganze Thema</div>${sel('_anders', '_anders')}</div>` : ''}
      ${mitCheck.length ? `<div class="sz-panel blau"><p style="margin:0 0 6px">Willst du ${mitCheck.map(t => esc(tname(t))).join(' und ')} gleich kurz checken? (etwa 5 Minuten${mitCheck.length > 1 ? ' je Thema' : ''})</p>
        ${ui.b2aCheck == null ? `<div class="sz-zeile"><button class="sz-knopf klein" data-act="tw:b2aCheck" data-w="ja">Ja, gleich</button><button class="sz-knopf matt klein" data-act="tw:b2aCheck" data-w="nein">Später</button></div>`
          : `<p class="sz-matt klein" style="margin:0">${ui.b2aCheck ? 'Der Check kommt nach der Planung, vor der ersten Aufgabe.' : 'Du findest den Check später unter „Meine Themen“.'} <button class="sz-zurueck klein" data-act="tw:b2aCheck" data-w="">ändern</button></p>`}</div>` : ''}
      ${fuss()}`;
  } else if (schritt === 4) {
    h += `<h2 class="tw-h">Wahlpflichtkurs</h2><p class="sz-matt">Welche Themen kommen im Kurs vor? Sie bekommen die Marke „aus dem Kurs“.</p>
      ${D().gruppen.filter(g => g !== 'Grundlage').map(g => { const ts = TW.listenThemen(D()).filter(t => t.gruppe === g); return ts.length ? `<div class="sz-label" style="margin-top:8px">${esc(g)}</div><div class="tw-chips">${ts.map(t => `<button class="tw-chip klein${z.kurs.themen.includes(t.id) ? ' an' : ''}" data-act="tw:kurs" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''; }).join('')}
      <div class="sz-label" style="margin-top:10px">Was macht ihr im Kurs?</div><textarea class="tw-feld" id="tw-kurs-text" maxlength="500" placeholder="Schreib es mit deinen Worten.">${esc(z.kurs.freitext || '')}</textarea>
      ${fuss()}`;
  } else if (schritt === 5) {
    h += `<h2 class="tw-h">Deine Themen</h2>
      <p class="sz-matt klein"><b class="tw-g">Sitzt</b> = kurz checken · <b class="tw-y">Wiederh.</b> = wiederholen · <b class="tw-b">Neu</b> = neu oder noch einmal von vorn. Tippe auf ein Thema für mehr.</p>
      ${themenListe('befragung')}${fuss()}`;
  } else if (schritt === 6) {
    if (!ui.jetzt) ui.jetzt = tw().aktiv.map(a => a.thema);
    h += jetztHtml() + `<button class="sz-knopf" data-act="tw:missionStart"${ui.jetzt.length ? '' : ' disabled'}>Mission starten <small>▶</small></button><p class="sz-matt klein" style="text-align:center">Gilt sofort. Du kannst alles unter „Meine Themen“ ändern.</p><button class="sz-zurueck" data-act="tw:planung" data-s="5">‹ Zurück</button>`;
  }
  zeigen(h);
}
// Themenliste nach Gruppen (B4, „Thema holen“), Wahl je Thema
function themenListe(anlass) {
  const z = tw();
  // Fachneutral: Fächer als oberste Gruppe, nur wenn es Themen aus mehr als einem Fach gibt
  const faecher = [...new Set(TW.listenThemen(D()).map(t => t.fach || 'mathe'))];
  return faecher.map(f => (faecher.length > 1 ? `<div class="tw-fach">${esc(D().faecher[f] || f)}</div>` : '') + D().gruppen.filter(g => g !== 'Grundlage').map(g => {
    const ts = TW.listenThemen(D()).filter(t => t.gruppe === g && (t.fach || 'mathe') === f);
    if (!ts.length) return '';
    const auf = !!ui.offen[g];
    return `<div class="tw-gruppe"><button class="tw-gk" data-act="tw:gruppe" data-g="${esc(g)}"><span>${esc(g)} (${ts.length})</span><span>${auf ? '▴' : '▾'}</span></button>
      ${auf ? ts.map(t => `<div class="tw-th"><div class="tw-thk" data-act="tw:detail" data-t="${t.id}"><div><div class="tw-thn">${esc(t.name)}</div>${marken(t.id)}</div><span class="sz-matt">${ui.detail === t.id ? '▴' : '▾'}</span></div>
        <div class="tw-seg">${TW.WAHLEN.map(w => `<button class="${w}${z.wahl[t.id] === w ? ' an' : ''}" data-act="tw:wahl" data-t="${t.id}" data-w="${w}" data-anlass="${anlass}">${WAHL_TXT[w]}</button>`).join('')}</div>
        ${ui.detail === t.id ? `<div class="tw-detail"><p>${esc(t.kern || '')}</p>${vorHtml(t.id)}${hilftHtml(t.id)}${!TW.bereit(t.id) ? VORBEREITET : ''}${anlass === 'holen' ? holenKnopf(t.id) : ''}</div>` : ''}</div>`).join('') : ''}</div>`;
  }).join('')).join('');
}
function holenKnopf(t) {
  const z = tw();
  if (z.aktiv.some(a => a.thema === t)) return '<p class="sz-matt klein">Ist schon aktiv.</p>';
  if (z.aktiv.length >= TW.MAX_AKTIV) return '<p class="sz-matt klein">Höchstens 3 Themen. Pausiere erst eins.</p>';
  return `<button class="sz-knopf blau klein" data-act="tw:holen" data-t="${t}">Dieses Thema holen</button>`;
}
function jetztHtml() {
  const z = tw(), liste = ui.jetzt;
  const basis = TW.ANTEILE[liste.length] || [];
  const vorschlag = b2aThemen();
  const kand = TW.listenThemen(D()).filter(t => ['neu', 'wiederholen', 'pruefen'].includes(z.wahl[t.id]) && !liste.includes(t.id) && !vorschlag.includes(t.id));
  const ka = kaEntwurf();
  const fiktiv = { ...z, aktiv: liste.map((t, i) => ({ thema: t, platz: i + 1 })), klassenarbeiten: [] };
  const eff = TW.anteile(fiktiv, heute(), C.bereit);
  const vor = eff.filter(x => !C.bereit(x.thema));
  return `<h2 class="tw-h">Jetzt dran</h2><p class="sz-matt">Bis zu 3 Themen. Zieh sie am ≡ in deine Reihenfolge. Platz 1 bekommt am meisten Zeit.</p>
    ${vorschlag.length ? `<div class="sz-panel tw-vorschlag"><div class="sz-label">Vorschlag: gerade im Unterricht${ka ? ' und Klassenarbeit' : ''}</div><div class="tw-chips">${vorschlag.map(t => `<button class="tw-chip klein vorschlag" data-act="tw:jetztAdd" data-t="${t}"${liste.includes(t) || liste.length >= 3 ? ' disabled' : ''}>${liste.includes(t) ? '✓ ' : ''}${esc(tname(t))}${ka && ka.thema === t ? ' · Klassenarbeit' : ''}</button>`).join('')}</div>${liste.length >= 3 && vorschlag.some(t => !liste.includes(t)) ? '<div class="sz-matt klein">Alle 3 Plätze sind voll. Nimm erst eins heraus (✕).</div>' : ''}</div>` : ''}
    <div class="tw-slots" data-liste="jetzt">${[0, 1, 2].map(i => { const t = liste[i]; if (!t) return `<div class="tw-slot leer">Platz ${i + 1} frei</div>`;
      return `<div class="tw-slot p${i + 1}" data-i="${i}"><span class="tw-griff" aria-label="Verschieben">≡</span><span class="tw-platz">${i + 1}</span><div class="tw-slot-text"><div class="tw-thn">${esc(tname(t))}</div>${C.bereit(t) ? '' : '<span class="tw-mk vor">wird vorbereitet</span>'}${z.wahl[t] === 'pruefen' && TW.kurzcheckSchritte(D(), C.kc(), t).length ? '<span class="tw-mk check">erst Schnell-Check</span>' : ''}</div><span class="tw-anteil">${basis[i]} %</span><button class="tw-x" data-act="tw:jetztWeg" data-i="${i}" aria-label="Herausnehmen">✕</button></div>`; }).join('')}</div>
    ${vor.length && eff.some(x => x.ist) ? `<div class="sz-hinweisbox">Bis ${vor.map(x => esc(tname(x.thema))).join(' und ')} fertig vorbereitet ${vor.length > 1 ? 'sind' : 'ist'}, übst du: ${eff.filter(x => x.ist).map(x => `${esc(tname(x.thema))} <b class="sz-pfirsich">${x.ist} %</b>`).join(', ')}.</div>` : vor.length ? '<div class="sz-hinweisbox">Diese Themen werden noch vorbereitet. Nimm noch ein Thema dazu, das schon Aufgaben hat, damit du gleich üben kannst.</div>' : ''}
    ${vor.length ? VORBEREITET : ''}
    ${liste.length < 3 && kand.length ? `<div class="sz-label" style="margin-top:8px">Weitere, antippen zum Hinzufügen</div><div class="tw-chips">${kand.map(t => `<button class="tw-chip klein" data-act="tw:jetztAdd" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}`;
}
// Ziehen am Griff (Reihenfolge)
export function ziehbar() {
  document.querySelectorAll('.tw-slots').forEach(box => box.querySelectorAll('.tw-slot[data-i] .tw-griff').forEach(g => {
    g.onpointerdown = (e) => {
      e.preventDefault();
      const slot = g.closest('.tw-slot'), i = Number(slot.dataset.i), y0 = e.clientY, liste = box.dataset.liste;
      slot.classList.add('zieht'); try { g.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
      g.onpointermove = (ev) => { slot.style.transform = `translateY(${ev.clientY - y0}px) scale(1.03)`; };
      g.onpointerup = (ev) => {
        g.onpointermove = null; g.onpointerup = null;
        const h = slot.offsetHeight + 10, d = Math.round((ev.clientY - y0) / h);
        const arr = liste === 'jetzt' ? ui.jetzt : tw().aktiv.map(a => a.thema);
        const j = Math.max(0, Math.min(arr.length - 1, i + d));
        if (j !== i) { const [x] = arr.splice(i, 1); arr.splice(j, 0, x); }
        if (liste === 'jetzt') planung(6);
        else { if (j !== i) aktivAendern(arr, 'reihenfolge', arr[j]); meine(); }
      };
    };
  }));
}
function aktivAendern(liste, aktion, thema) {
  const z = tw();
  TW.aktivSetzen(z, liste, heute());
  const an = TW.anteile(z, heute(), C.bereit);
  C.protokoll('thema_aktiv', { aktion, thema, platz: liste.indexOf(thema) + 1 || null, anteile: Object.fromEntries(an.map(x => [x.thema, x.mitKa])) });
  TW.geaendert(z); C.sichern();
}

// ---------- Meine Themen (D1) ----------
export function meine() {
  const z = tw(), an = TW.anteile(z, heute(), C.bereit), ka = TW.klassenarbeitJetzt(z, heute());
  const kaStand = ka ? kaAnteil(ka.thema) : null;
  zeigen(`${kopf('Meine Themen')}
    <div class="sz-label">Aktiv · zieh am ≡ zum Tauschen</div>
    <div class="tw-slots" data-liste="aktiv">${z.aktiv.map((a, i) => { const x = an.find(y => y.thema === a.thema) || {}; const kcT = TW.kurzcheckSchritte(D(), C.kc(), a.thema).length;
      return `<div class="tw-slot p${i + 1}" data-i="${i}"><span class="tw-griff">≡</span><span class="tw-platz">${i + 1}</span><div class="tw-slot-text"><div class="tw-thn">${esc(tname(a.thema))}</div><div class="sz-matt klein">${C.bereit(a.thema) ? `Etappe ${TW.etappeVon(z, a.thema)} von ${TW.ETAPPEN}` : '<span class="tw-mk vor">wird vorbereitet</span>'}</div>
      <div class="tw-slot-knoepfe">${kcT ? `<button class="sz-zurueck klein" data-act="tw:check" data-t="${a.thema}">Schnell-Check</button>` : ''}<button class="sz-zurueck klein" data-act="tw:pause" data-t="${a.thema}">Pausieren</button></div></div><span class="tw-anteil">${x.ist ? x.ist + ' %' : '–'}</span></div>`; }).join('') || '<div class="tw-slot leer">Noch kein Thema aktiv.</div>'}</div>
    ${z.aktiv.some(a => !C.bereit(a.thema)) ? VORBEREITET : ''}
    ${ka && !z.aktiv.some(a => a.thema === ka.thema) ? `<div class="sz-matt klein">Bis zur Klassenarbeit kommt ${esc(tname(ka.thema))} zusätzlich dazu.</div>` : ''}
    ${ka ? `<p class="sz-matt klein">Bis zur Klassenarbeit bekommt ${esc(tname(ka.thema))} mindestens 50 %.</p>` : ''}
    <button class="sz-knopf blau klein" data-act="tw:holenListe"${z.aktiv.length >= TW.MAX_AKTIV ? ' disabled' : ''}>+ Thema holen</button>${z.aktiv.length >= TW.MAX_AKTIV ? '<p class="sz-matt klein" style="text-align:center;margin:0">Höchstens 3. Pausiere erst eins.</p>' : ''}
    ${ka ? `<div class="sz-panel gelb"><div class="sz-label">Klassenarbeit</div><div class="tw-ka"><div class="tw-tage">${Math.max(0, tageBis(ka.datum))}</div><div><b>${esc(tname(ka.thema))}</b><div class="sz-matt klein">${wochentag(ka.datum)} ${DATUM(ka.datum)} · noch ${tageBis(ka.datum)} ${tageBis(ka.datum) === 1 ? 'Tag' : 'Tage'}</div></div></div>
      ${kaStand ? `<div class="sz-matt klein" style="margin-top:6px">Teilschritte, die sitzen: ${kaStand.sitzt} von ${kaStand.alle}</div><div class="tw-balken"><i style="width:${kaStand.alle ? Math.round(kaStand.sitzt / kaStand.alle * 100) : 0}%"></i></div><button class="sz-zurueck klein" data-act="tw:fortschritt" data-r="heute">Was noch nicht sitzt ›</button>` : ''}
      <div class="sz-zeile"><button class="sz-knopf matt klein" data-act="tw:kaForm">Ändern</button><button class="sz-knopf matt klein" data-act="tw:kaWeg">Löschen</button></div></div>`
      : '<button class="sz-knopf flieder klein" data-act="tw:kaForm">Klassenarbeit eintragen</button>'}
    ${z.pausiert.length ? `<div class="sz-label" style="margin-top:8px">Pausiert</div>${z.pausiert.map(p => `<div class="sz-panel tw-zeile"><span>${esc(tname(p.thema))} <span class="sz-matt klein">seit ${DATUM(p.seit)}</span></span><button class="sz-zurueck klein" data-act="tw:holen" data-t="${p.thema}"${z.aktiv.length >= TW.MAX_AKTIV ? ' disabled' : ''}>Holen</button></div>`).join('')}` : ''}
    <button class="sz-knopf matt klein" data-act="tw:planung" data-s="2">Missionsplanung</button>
    ${FEEDBACK}
    <button class="sz-zurueck" data-act="start">‹ Zurück</button>`);
  ziehbar();
}
function kaAnteil(t) {
  const th = D().T[t]; if (!th) return null;
  const ids = th.schritte.map(s => s.id);
  const sitzt = ids.filter(id => TW.standVon(tw(), id) === 'sitzt');
  return { alle: ids.length, sitzt: sitzt.length, uebrig: ids.filter(id => !sitzt.includes(id)) };
}
function holenListe() {
  ui.ort = 'holen';
  zeigen(`${kopf('Thema holen')}<p class="sz-matt">Tippe auf ein Thema. Du siehst, was es vorher braucht.</p>${themenListe('holen')}<button class="sz-zurueck" data-act="tw:meine">‹ Zurück</button>`);
}
// C1 vor dem Start: Voraussetzungen der neuen Themen auf einem Bildschirm, dann erst checken oder trotzdem starten
const checkbarVon = (t) => { const v = TW.vorOffen(D(), tw(), t); return [...v.offen, ...v.wackelt].filter(id => C.kc().some(a => TW.ohneStufe(a.teilschritt) === id)); };
function c1Zeigen(themen) {
  const z = tw();
  for (const t of themen) { const v = TW.vorOffen(D(), z, t); C.protokoll('voraussetzung', { aktion: 'gezeigt', thema: t, offen: v.offen, wackelt: v.wackelt }); }
  C.sichern();
  const checkbar = themen.some(t => checkbarVon(t).length);
  const liste = themen.join(',');
  zeigen(`${kopf('Thema holen')}<h2 class="tw-h">Was deine Themen vorher brauchen</h2>
    ${themen.map(t => `<div class="sz-panel blau"><div class="tw-thn" style="margin-bottom:4px">${esc(tname(t))}</div>${vorHtml(t)}</div>`).join('')}
    ${checkbar ? `<div class="sz-hinweisbox">Nicht alles davon sitzt schon. Willst du es erst kurz checken? Das dauert etwa 5 Minuten.</div>
      <button class="sz-knopf" data-act="tw:c1" data-t="${liste}" data-w="erst">Erst checken <small>▶</small></button><button class="sz-knopf matt klein" data-act="tw:c1" data-t="${liste}" data-w="trotzdem">Trotzdem starten</button>`
      : `<div class="sz-hinweisbox">Nicht alles davon sitzt schon. Dafür gibt es noch keinen Check. Du kannst trotzdem starten.</div><button class="sz-knopf" data-act="tw:c1" data-t="${liste}" data-w="trotzdem">Starten <small>▶</small></button>`}
    <p class="sz-matt klein">Beim Starten kommt etwa jede 5. Aufgabe aus dem, was noch wackelt oder offen ist, bis es sitzt.</p>`);
}
// Nach „Mission starten“ und „Thema holen“: erst die Voraussetzungen (C1), dann die Checks der Reihe nach
function weiterNachStart() {
  const z = tw();
  const themen = ui.c1.filter(t => { const v = TW.vorOffen(D(), z, t); return v.offen.length || v.wackelt.length; });
  ui.c1 = [];
  if (themen.length) return c1Zeigen(themen);
  if ((z.kcSchlange || []).length && !z.kc) { kcNaechster(); return C.aufgabenStarten(); }
  if (z.kc) return C.aufgabenStarten();
  C.zeigeStart();
}
function kcNaechster() {
  const z = tw(), q = z.kcSchlange.shift();
  if (!q) return false;
  const ids = TW.kurzcheckAufgaben(C.kc(), q.teilschritte).map(a => a.id);
  if (!ids.length) return kcNaechster();
  z.kc = { thema: q.thema, art: q.art, teilschritte: q.teilschritte, ids, idx: 0, erg: {}, start: Date.now() };
  C.protokoll('einstufung', { aktion: 'start', thema: q.thema, teilschritte: q.teilschritte, art: q.art });
  TW.geaendert(z); C.sichern();
  return true;
}
function kcEinreihen(t, art) {
  const z = tw();
  const ts = art === 'voraus' ? (() => { const v = TW.vorOffen(D(), z, t); return [...v.offen, ...v.wackelt].filter(id => C.kc().some(a => TW.ohneStufe(a.teilschritt) === id)); })() : TW.kurzcheckSchritte(D(), C.kc(), t);
  if (!ts.length) return;
  z.kcSchlange = (z.kcSchlange || []).filter(q => !(q.thema === t && (q.art === art || (art !== 'voraus' && q.art !== 'voraus'))));
  if (art !== 'voraus' && z.kc && z.kc.thema === t && z.kc.art !== 'voraus') return;
  z.kcSchlange.push({ thema: t, art, teilschritte: ts });
}

// ---------- Schnell-Check: Ergebnis (C2) ----------
export function kcErgebnis() {
  const z = tw(), e = z.kcErgebnis; if (!e) return C.zeigeStart();
  const nW = Object.values(e.ergebnis).filter(x => x === 'wackelt').length;
  const frage = e.art !== 'voraus' && nW && e.angenommen == null && z.wahl[e.thema] !== 'wiederholen';
  const ohne = (D().T[e.thema] ? D().T[e.thema].schritte.map(s => s.id) : []).filter(id => !(id in e.ergebnis));
  zeigen(`${kopf('Schnell-Check')}<h2 class="tw-h">${esc(e.art === 'voraus' ? 'Voraussetzungen für ' + tname(e.thema) : tname(e.thema))}</h2><p class="sz-matt klein">${e.n} Aufgaben · ${Math.max(1, Math.round(e.ms / 60000))} Min.</p>
    <div class="sz-panel tw-erg">${Object.entries(e.ergebnis).map(([id, st]) => `<div class="tw-ergz">${dot(st)}<div><div>${esc(TW.schrittName(D(), id))}</div><div class="sz-matt klein">${st === 'sitzt' ? 'sitzt · beide richtig' : 'wackelt · eine war knapp'}</div></div></div>`).join('')}
      ${e.art !== 'voraus' ? ohne.map(id => `<div class="tw-ergz">${dot(TW.standVon(z, id))}<div><div>${esc(TW.schrittName(D(), id))}</div><div class="sz-matt klein">dafür gibt es noch keinen Check</div></div></div>`).join('') : ''}</div>
    ${frage ? `<div class="sz-panel orange"><p style="margin:0 0 6px">${nW === 1 ? 'Ein Teilschritt wackelt' : nW + ' Teilschritte wackeln'}. Thema auf <b>„wiederholen“</b> stellen?</p><div class="sz-zeile"><button class="sz-knopf klein" data-act="tw:kcJa" data-w="ja">Ja</button><button class="sz-knopf matt klein" data-act="tw:kcJa" data-w="nein">Nein, bleibt</button></div></div>`
      : e.angenommen != null ? `<div class="sz-panel"><p style="margin:0">${e.angenommen ? `${esc(tname(e.thema))} steht jetzt auf „wiederholen“.` : 'Bleibt, wie es ist. Was wackelt, kommt ab und zu dran, bis es sitzt.'}</p></div>` : nW ? '<div class="sz-panel"><p style="margin:0">Was wackelt, kommt ab und zu dran, bis es sitzt.</p></div>' : '<div class="sz-panel"><p style="margin:0">Alles sitzt. Stark!</p></div>'}
    ${z.kcGemacht === 1 ? FEEDBACK : ''}
    <button class="sz-knopf" data-act="tw:kcWeiter"${frage ? ' disabled' : ''}>Weiter <small>▶</small></button>`);
}

// ---------- Klassenarbeit (D2) ----------
function kaForm() {
  const ka = TW.klassenarbeitJetzt(tw(), heute());
  zeigen(`${kopf('Klassenarbeit')}<h2 class="tw-h">${ka ? 'Klassenarbeit ändern' : 'Klassenarbeit eintragen'}</h2>
    <div class="sz-panel gelb"><div class="sz-label">Datum</div><input class="tw-feld" type="date" id="tw-ka-datum" min="${morgen()}" value="${ka ? ka.datum : ''}">
    <div class="sz-label" style="margin-top:8px">Thema</div><select class="tw-feld" id="tw-ka-thema"><option value="">Thema wählen</option>${TW.listenThemen(D()).map(t => `<option value="${t.id}"${ka && ka.thema === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    <p class="sz-matt klein">Bis zum Tag der Klassenarbeit bekommt das Thema mindestens die Hälfte der Zeit.</p>
    <button class="sz-knopf" data-act="tw:kaSpeichern">Speichern</button><button class="sz-zurueck" data-act="tw:meine">‹ Zurück</button>`);
}
function kaSpeichern(datum, thema, anlass = 'meine') {
  const z = tw();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !thema || datum <= heute()) return false; // 24.11.: iPhone setzt beim Antippen heute ein, Klassenarbeit frühestens morgen
  const alt = TW.klassenarbeitJetzt(z, heute());
  if (alt) { alt.datum = datum; alt.thema = thema; C.protokoll('klassenarbeit', { aktion: 'geaendert', datum, thema }); }
  else { z.klassenarbeiten.push({ datum, thema, eingetragen: new Date().toISOString(), rueckmeldung: null }); C.protokoll('klassenarbeit', { aktion: 'eingetragen', datum, thema, anlass }); }
  TW.geaendert(z); C.sichern();
  return true;
}
export function kaRueckmeldungFrage() {
  const k = TW.klassenarbeitRueckmeldung(tw(), heute()); if (!k) return false;
  k.gefragt = true; C.sichern();
  C.modal(`<div class="hinweis-text"><h2 class="modal-titel">Wie lief die Klassenarbeit?</h2><p class="gedaempft">${esc(tname(k.thema))} · ${DATUM(k.datum)}</p>
    <div class="abschluss-knoepfe">${[['gut', 'Gut'], ['ging so', 'Ging so'], ['schwer', 'Schwer'], ['weiss_nicht', 'Weiß nicht']].map(([w, t]) => `<button class="btn" data-act="tw:kaAntwort" data-w="${w}" data-d="${k.datum}">${t}</button>`).join('')}</div></div>`);
  return true;
}

// ---------- Fortschritt (E1–E8) ----------
const REITER = [['heute', 'Heute', 'ringe'], ['karte', 'Sternkarte', 'karte'], ['woche', 'Woche', 'rueckblick'], ['verlauf', 'Verlauf', 'verlauf'], ['best', 'Bestleistungen', 'bestleistungen'], ['kal', 'Kalender', 'kalender']];
export function fortschritt(r = ui.reiter) {
  ui.reiter = r;
  const def = REITER.find(x => x[0] === r) || REITER[0];
  C.protokoll('fortschritt', { ansicht: def[2] });
  const inhalt = { heute: fsHeute, karte: fsKarte, woche: fsWoche, verlauf: fsVerlauf, best: fsBest, kal: fsKalender }[def[0]]();
  zeigen(`${kopf('Fortschritt')}<div class="tw-reiter">${REITER.map(([k, t]) => `<button class="${k === def[0] ? 'an' : ''}" data-act="tw:fortschritt" data-r="${k}">${t}</button>`).join('')}</div>${inhalt}<button class="sz-zurueck" data-act="start">‹ Zurück</button>`);
}
function fsHeute() {
  const z = tw(), r = TW.ringe(z, heute()), wo = TW.woche(z, heute()), ka = TW.klassenarbeitJetzt(z, heute());
  const zeile = (farbe, name, info, v, key, schritt) => `<span class="tw-dot" style="background:${farbe}"></span><span><b>${name}</b><br><span class="sz-matt klein">${info}</span></span><span class="tw-w">${v} / <span class="tw-stepper"><button data-act="tw:ziel" data-k="${key}" data-d="-${schritt}" aria-label="weniger">−</button>${key === 'woche' ? z.ziele.woche_tage : z.ziele.tag[key]}<button data-act="tw:ziel" data-k="${key}" data-d="${schritt}" aria-label="mehr">+</button></span></span>`;
  const kaS = ka ? kaAnteil(ka.thema) : null;
  return `<div class="tw-ring-gross">${ringSvg(200, ringWerte())}</div>
    <div class="tw-legende">${zeile('#FF9F5A', 'Üben', 'Minuten geübt', r.minuten, 'minuten', 5)}${zeile('#8FBFFF', 'Neu', 'Teilschritte neu oder eine Stufe höher', r.neu, 'neu', 1)}${zeile('#C9A0DC', 'Tiefe', 'Stufe 3 oder Knobeln ohne Schritte, richtig', r.tiefe, 'tiefe', 1)}</div>
    <p class="sz-matt klein">Ziele stellst du selbst ein. Ein voller Ring ist einfach voll. Sonst passiert nichts.</p>
    <div class="sz-panel blau"><div class="sz-label">Wochenziel</div><div class="tw-zeile"><span><b>${wo.anzahl}</b> von ${wo.ziel} Tagen</span><span class="tw-stepper"><button data-act="tw:ziel" data-k="woche" data-d="-1">−</button><b>${wo.ziel}</b><button data-act="tw:ziel" data-k="woche" data-d="1">+</button></span></div>
      <div class="tw-woche">${wo.tage.map(t => `<div><i class="${t.geuebt ? 'ja' : ''}${t.tag === heute() ? ' heute' : ''}"></i>${wochentag(t.tag)}</div>`).join('')}</div><div class="sz-matt klein">Ein Tag zählt, wenn du mindestens eine Aufgabe fertig hast.</div></div>
    ${ka && kaS ? `<div class="sz-panel gelb"><div class="sz-label">Klassenarbeit · ${esc(tname(ka.thema))}</div><div class="tw-ka"><div class="tw-tage">${Math.max(0, tageBis(ka.datum))}</div><div>${tageBis(ka.datum) === 1 ? 'Tag' : 'Tage'} · ${wochentag(ka.datum)} ${DATUM(ka.datum)}</div></div><div class="sz-matt klein">Teilschritte, die sitzen: ${kaS.sitzt} von ${kaS.alle}</div><div class="tw-balken"><i style="width:${kaS.alle ? Math.round(kaS.sitzt / kaS.alle * 100) : 0}%"></i></div>${kaS.uebrig.map(id => `<div class="tw-vor">${dot(TW.standVon(z, id))}<span class="klein">${esc(TW.schrittName(D(), id))}</span></div>`).join('')}</div>` : ''}`;
}
// Sternkarte (E3): Voraussetzungen links, Themen in Bändern; Grundlagen im Band ihres ersten Ziels (hohle Punkte)
export function karteSvg(Dd, z, themen, aktiv, sel) {
  const innen = new Set(); themen.forEach(t => Dd.T[t] && Dd.T[t].schritte.forEach(s => innen.add(s.id)));
  const ks = Dd.kanten.filter(k => innen.has(k.nach) && (innen.has(k.von) || k.art === 'braucht'));
  const knoten = new Set(innen); ks.forEach(k => knoten.add(k.von));
  const zielVon = {}; ks.forEach(k => { if (!innen.has(k.von) && !zielVon[k.von]) zielVon[k.von] = Dd.SCHRITT[k.nach].thema; });
  const band = (id) => (innen.has(id) ? Dd.SCHRITT[id].thema : zielVon[id]);
  const ebene = {}; knoten.forEach(n => { ebene[n] = innen.has(n) ? 1 : 0; });
  for (let r = 0; r < 40; r++) { let ch = false; for (const k of ks) if (ebene[k.nach] < ebene[k.von] + 1) { ebene[k.nach] = ebene[k.von] + 1; ch = true; } if (!ch) break; }
  const DX = 96, R = 9, ZH = 40; let y = 10; const pos = {}, bandY = [];
  for (const b of themen) {
    const ns = [...knoten].filter(n => band(n) === b).sort((a, c) => ebene[a] - ebene[c]); if (!ns.length) continue;
    const proE = {}; ns.forEach(n => { proE[ebene[n]] = (proE[ebene[n]] || 0) + 1; });
    const h = Math.max(...Object.values(proE)), top = y; y += 24; const zz = {};
    ns.forEach(n => { const e = ebene[n], k = zz[e] || 0; zz[e] = k + 1; pos[n] = { x: 40 + e * DX, y: y + k * ZH + 12 }; });
    y += h * ZH + 8; bandY.push({ b, top, h: y - top }); y += 6;
  }
  const maxE = Math.max(0, ...Object.values(ebene));
  const W = 40 + maxE * DX + 70, H = Math.max(y, 40);
  const farbe = { sitzt: '#8FD9A8', wackelt: '#FF9F5A', offen: '#5B6080' };
  const kurz = (s) => (s.length > 15 ? s.slice(0, 14) + '…' : s);
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sternkarte">`;
  bandY.forEach((b, i) => { svg += `<rect x="4" y="${b.top}" width="${W - 8}" height="${b.h}" rx="12" fill="${i % 2 ? '#0B0D18' : '#0E1120'}"/><text x="14" y="${b.top + 16}" font-size="11" letter-spacing="1.2" fill="#8FBFFF" font-weight="700">${escH((Dd.T[b.b] ? Dd.T[b.b].name : b.b).toUpperCase())}</text>`; });
  for (const k of ks) { const a = pos[k.von], b = pos[k.nach]; if (!a || !b) continue; const mx = (a.x + b.x) / 2; svg += `<path d="M${a.x + R} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x - R} ${b.y}" fill="none" stroke="${k.art === 'braucht' ? '#6E7499' : '#4A4F70'}" stroke-width="${k.art === 'braucht' ? 1.6 : 1.3}"${k.art === 'hilft' ? ' stroke-dasharray="4 4"' : ''} opacity="${sel && k.von !== sel && k.nach !== sel ? 0.25 : 1}"/>`; }
  for (const n of knoten) {
    const p = pos[n]; if (!p) continue; const s = TW.standVon(z, n), selbst = TW.selbstSitzt(z, n);
    const akt = innen.has(n) && aktiv.includes(Dd.SCHRITT[n].thema);
    const voll = innen.has(n) && !selbst;
    svg += `<g data-act="tw:stern" data-n="${escH(n)}" style="cursor:pointer">${akt ? `<circle cx="${p.x}" cy="${p.y}" r="${R + 5}" fill="none" stroke="#F2D27A" stroke-width="1.5" opacity=".8"/>` : ''}${sel === n ? `<circle cx="${p.x}" cy="${p.y}" r="${R + 9}" fill="#F2D27A" opacity=".18"/>` : ''}<circle cx="${p.x}" cy="${p.y}" r="${voll ? R : R - 2}" fill="${voll ? farbe[s] : '#05060C'}" stroke="${farbe[s]}" stroke-width="${voll ? 0 : 3}"/><text x="${p.x}" y="${p.y + R + 12}" font-size="9.5" fill="#A9A9C2" text-anchor="middle">${escH(kurz(TW.schrittName(Dd, n)))}</text><circle cx="${p.x}" cy="${p.y}" r="20" fill="transparent"/></g>`;
  }
  return svg + '</svg>';
}
function fsKarte() {
  const z = tw(), aktiv = z.aktiv.map(a => a.thema);
  const themen = ui.karteAlle ? TW.listenThemen(D()).filter(t => aktiv.includes(t.id) || ['neu', 'wiederholen', 'pruefen'].includes(z.wahl[t.id])).map(t => t.id) : aktiv;
  const sel = ui.karteSel;
  let info = '<p class="sz-matt klein">Tippe auf einen Stern.</p>';
  if (sel) {
    const s = z.teilschritte[sel] || {}, st = TW.standVon(z, sel), erg = s.erg || [];
    info = `<div class="sz-panel ${st === 'sitzt' ? '' : st === 'wackelt' ? 'orange' : 'blau'}"><div class="tw-thn">${esc(TW.schrittName(D(), sel))}</div><div class="sz-matt klein">${STAND_TXT[st]}${s.quelle === 'selbst' ? ' (deine Einschätzung)' : s.quelle === 'kurzcheck' ? ' (Schnell-Check)' : ''} · Stufe ${s.stufe || '–'} · ${erg.length ? `zuletzt im 1. Versuch: ${erg.filter(Boolean).length} von ${erg.length}` : 'noch nicht geübt'} · zuletzt geübt: ${s.zuletzt ? DATUM(s.zuletzt) : 'noch nie'}</div>${D().SCHRITT[sel] ? '' : '<div class="sz-matt klein">Gehört nicht zu deinen Themen, wird aber gebraucht.</div>'}</div>`;
  }
  return `<div class="tw-chips"><button class="tw-chip klein${ui.karteAlle ? '' : ' an'}" data-act="tw:karteAlle" data-w="">Aktive Themen</button><button class="tw-chip klein${ui.karteAlle ? ' an' : ''}" data-act="tw:karteAlle" data-w="1">Alle gewählten</button></div>
    ${themen.length ? `<div class="tw-karte">${karteSvg(D(), z, themen, aktiv, sel)}</div>` : '<p class="sz-matt">Noch keine Themen.</p>'}
    <div class="tw-legende-karte sz-matt klein"><span>${dot('sitzt')} sitzt</span><span>${dot('wackelt')} wackelt</span><span>${dot('offen')} offen</span><span>◯ gelb = aktiv</span><span>— braucht · - - hilft</span><span>hohl = Grundlage aus einem anderen Thema oder eigene Einschätzung</span></div>${info}`;
}
function vergleich(a, b, einheit = '') { if (b == null) return ''; const d = a - b; return `<span class="sz-matt klein">${d === 0 ? 'wie Vorwoche' : `${d > 0 ? '+' : '−'}${Math.abs(d)}${einheit} zur Vorwoche`}</span>`; }
function rueckblickHtml(mo) {
  const z = tw(), w = TW.wochenwerte(z, mo), v = TW.wochenwerte(z, TW.tagPlus(mo, -7));
  const zeile = (t, wert, alt, e = '') => `<div class="tw-zeile"><span>${t}</span><span><b class="sz-pfirsich">${wert}${e}</b> ${vergleich(wert, alt, e)}</span></div>`;
  return `<div class="sz-panel blau"><div class="sz-label">Woche ${DATUM(mo)}–${DATUM(TW.tagPlus(mo, 6))}</div>
    ${zeile('Übungszeit', w.minuten, v.minuten, ' Min.')}${zeile('Aufgaben', w.aufgaben, v.aufgaben)}${zeile('Im 1. Versuch', w.erst, v.erst, ' %')}${zeile('Teilschritte neu sicher', w.neuSitzt, v.neuSitzt)}${zeile('Knobeln ohne Schritte', w.knobelOhne, v.knobelOhne, ' %')}</div>`;
}
function fsWoche() { const mo = TW.montag(heute()); return rueckblickHtml(TW.tagPlus(mo, -7)) + `<div class="sz-label" style="margin-top:6px">Diese Woche bis jetzt</div>` + rueckblickHtml(mo); }
export function rueckblickZeigen() {
  const z = tw(), mo = TW.montag(heute());
  z.rueckblick = mo; C.sichern();
  C.protokoll('fortschritt', { ansicht: 'rueckblick', anlass: 'montag' });
  zeigen(`${kopf('Wochenrückblick')}<h2 class="tw-h">Deine letzte Woche</h2>${rueckblickHtml(TW.tagPlus(mo, -7))}<button class="sz-knopf" data-act="start">Weiter <small>▶</small></button>`);
}
function linie(punkte, w = 300, h = 110) {
  if (!punkte.length) return '<p class="sz-matt klein">Noch keine Übungstage.</p>';
  const n = punkte.length, x = (i) => 20 + (n === 1 ? (w - 40) / 2 : i * (w - 40) / (n - 1)), y = (q) => 10 + (100 - q) / 100 * (h - 30);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="tw-linie">${[0, 50, 100].map(q => `<line x1="16" x2="${w - 10}" y1="${y(q)}" y2="${y(q)}" stroke="#262B45"/><text x="2" y="${y(q) + 4}" font-size="9" fill="#5B6080">${q}</text>`).join('')}
    <polyline fill="none" stroke="#8FBFFF" stroke-width="2" points="${punkte.map((p, i) => `${x(i)},${y(p.quote)}`).join(' ')}"/>${punkte.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.quote)}" r="3.5" fill="#8FBFFF"/>`).join('')}
    <text x="20" y="${h - 4}" font-size="9" fill="#5B6080">${DATUM(punkte[0].tag)}</text><text x="${w - 10}" y="${h - 4}" font-size="9" fill="#5B6080" text-anchor="end">${DATUM(punkte[n - 1].tag)}</text></svg>`;
}
function fsVerlauf() {
  const z = tw();
  const themen = [...new Set([...z.aktiv.map(a => a.thema), ...Object.keys(z.etappen), ...Object.values(z.tage).flatMap(t => Object.keys(t.themen))])].filter(t => D().T[t]);
  if (!themen.length) return '<p class="sz-matt">Noch keine Übungstage.</p>';
  const t = themen.includes(ui.verlaufThema) ? ui.verlaufThema : themen[0];
  const pkt = TW.verlaufThema(z, t, 30, heute()), zul = TW.zuletztGeuebt(z, t);
  return `<div class="tw-chips">${themen.map(x => `<button class="tw-chip klein${x === t ? ' an' : ''}" data-act="tw:verlauf" data-t="${x}">${esc(tname(x))}</button>`).join('')}</div>
    <div class="sz-panel blau"><div class="sz-label">Im 1. Versuch richtig, je Übungstag (%)</div>${linie(pkt)}<div class="sz-matt klein">${C.bereit(t) ? `Etappe ${TW.etappeVon(z, t)} von ${TW.ETAPPEN}` : 'wird vorbereitet'} · zuletzt geübt: ${zul ? DATUM(zul) : 'noch nie'}</div></div>
    <div class="sz-panel">${D().T[t].schritte.map(s => { const x = z.teilschritte[s.id] || {}; return `<div class="tw-vor">${dot(TW.standVon(z, s.id), TW.selbstSitzt(z, s.id))}<span>${esc(s.name)} <span class="sz-matt klein">· ${STAND_TXT[TW.standVon(z, s.id)]}${x.stufe ? ` · Stufe ${x.stufe}` : ''}</span></span></div>`; }).join('')}</div>`;
}
const dauerTxt = (ms) => { const h = ms / 36e5; return h >= 24 ? `${Math.round(h / 24)} Tage` : h >= 1 ? `${Math.round(h)} Std.` : `${Math.max(1, Math.round(ms / 60000))} Min.`; };
function fsBest() {
  const z = tw();
  const stufen = [...new Set([...z.aktiv.map(a => a.thema), ...Object.keys(z.etappen)])].filter(t => C.bereit(t)).map(t => [t, TW.etappeVon(z, t)]);
  const zeiten = Object.entries(z.best.etappeMs || {});
  return `<div class="sz-panel"><div class="sz-label">Längste Folge: Knobeln ohne Schritte, richtig</div><div class="sz-wert">${z.best.knobelMax || 0}</div></div>
    <div class="sz-panel blau"><div class="sz-label">Höchste Etappe je Thema</div>${stufen.length ? stufen.map(([t, n]) => `<div class="tw-zeile"><span>${esc(tname(t))}</span><b class="sz-pfirsich">${n} von ${TW.ETAPPEN}</b></div>`).join('') : '<div class="sz-matt">Noch keine.</div>'}</div>
    <div class="sz-panel flieder"><div class="sz-label">Kürzeste Zeit für eine Etappe</div>${zeiten.length ? zeiten.map(([t, ms]) => `<div class="tw-zeile"><span>${esc(tname(t))}</span><b class="sz-pfirsich">${dauerTxt(ms)}</b></div>`).join('') : '<div class="sz-matt">Noch keine Etappe geschafft.</div>'}</div>`;
}
function fsKalender() {
  const z = tw(), m = ui.monat || heute().slice(0, 7);
  const [y, mm] = m.split('-').map(Number);
  const erster = `${m}-01`, tage = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const versatz = (new Date(erster + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const max = Math.max(30, ...Object.values(z.tage).map(t => t.ms / 60000));
  const zellen = [];
  for (let i = 0; i < versatz; i++) zellen.push('<i class="leer"></i>');
  for (let d = 1; d <= tage; d++) { const k = `${m}-${String(d).padStart(2, '0')}`; const min = z.tage[k] ? Math.round(z.tage[k].ms / 60000) : 0; zellen.push(`<i style="background:${min ? `rgba(255,159,90,${0.2 + 0.8 * Math.min(1, min / max)})` : '#141726'}" title="${min} Min."${k === heute() ? ' class="heute"' : ''}><b>${d}</b>${min ? `<small>${min}</small>` : ''}</i>`); }
  const vor = new Date(Date.UTC(y, mm - 2, 1)).toISOString().slice(0, 7), nach = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 7);
  const name = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][mm - 1];
  return `<div class="tw-zeile"><button class="sz-zurueck" data-act="tw:monat" data-m="${vor}">‹</button><b>${name} ${y}</b><button class="sz-zurueck" data-act="tw:monat" data-m="${nach}"${nach > heute().slice(0, 7) ? ' disabled' : ''}>›</button></div>
    <div class="tw-kal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(t => `<span>${t}</span>`).join('')}${zellen.join('')}</div><p class="sz-matt klein">Zahl = Minuten geübt. Je kräftiger, desto mehr.</p>`;
}

// ---------- Aktionen ----------
function feldWerte(kaForm = false) {
  const z = tw();
  const a = document.getElementById('tw-anders'); if (a) { z.schule.freitext = a.value.trim().slice(0, 120); }
  const k = document.getElementById('tw-kurs-text'); if (k) z.kurs.freitext = k.value.trim().slice(0, 500);
  const d = document.getElementById('tw-ka-datum'), t = document.getElementById('tw-ka-thema');
  if (!kaForm && !ui.kaOffen && !kaEntwurf()) return null; // 24.11.: nur, wenn sie „Klassenarbeit eintragen“ getippt hat
  if (d && t && d.value && t.value) return { datum: d.value, thema: t.value };
  return null;
}
export function aktion(act, el) {
  const z = tw(), d = el.dataset;
  switch (act) {
    case 'planung': {
      const neu = Number(d.s);
      // B2 verlassen: Klassenarbeit und Freitext übernehmen
      if (ui.schritt === 2) { const ka = feldWerte(); if (ka) kaSpeichern(ka.datum, ka.thema, 'befragung'); z.schule.stand = heute(); }
      if (ui.schritt === 4) { feldWerte(); z.kurs.stand = heute(); }
      if (ui.schritt === 3 && neu === 4 && ui.b2aCheck) for (const t of b2aThemen()) kcEinreihen(t, 'schule');
      if (neu === 6) ui.jetzt = z.aktiv.map(a => a.thema);
      TW.geaendert(z); C.sichern();
      return planung(neu);
    }
    case 'spaeter': z.planung.status = 'spaeter'; C.protokoll('missionsplanung', { aktion: 'spaeter', schritt: ui.schritt }); C.sichern(); return C.zeigeStart();
    case 'schule': {
      const t = d.t;
      if (t === '_anders') { z.schule.anders = !z.schule.anders; if (!z.schule.anders) z.schule.freitext = ''; }
      else z.schule.themen = z.schule.themen.includes(t) ? z.schule.themen.filter(x => x !== t) : [...z.schule.themen, t];
      feldWerte(); TW.geaendert(z); C.sichern(); return planung(2);
    }
    case 'kaWeiss': ui.kaOffen = !ui.kaOffen; return planung(2);
    case 'selbst': {
      const key = d.k, w = d.w, t = d.t;
      const anlass = (kaEntwurf() || {}).thema === t && !z.schule.themen.includes(t) ? 'klassenarbeit' : 'schule';
      if (d.ts) { const a = TW.selbstSetzen(z, d.ts, w, heute()); if (a) C.protokoll('teilschritt_stand', a); }
      else z.schule.selbst[key] = w;
      C.protokoll('selbsteinschaetzung', { thema: t, teilschritt: d.ts || null, antwort: w, anlass });
      // Wahl aus der Einschätzung (B4): noch nicht → neu, unsicher → wiederholen, alles kann → pruefen
      if (D().T[t]) {
        const ant = TW.mitStufen(D(), t) ? D().T[t].schritte.map(s => z.schule.selbst[s.id]).filter(Boolean) : [z.schule.selbst['_thema:' + t]].filter(Boolean);
        if (ant.length) wahlSetzen(t, ant.includes('noch_nicht') ? 'neu' : ant.includes('unsicher') ? 'wiederholen' : 'pruefen', 'befragung');
      }
      TW.geaendert(z); C.sichern();
      const y = window.scrollY; planung(3); window.scrollTo(0, y); return;
    }
    case 'b2aCheck': ui.b2aCheck = d.w === '' ? null : d.w === 'ja'; { const y = window.scrollY; planung(3); window.scrollTo(0, y); } return;
    case 'kurs': z.kurs.themen = z.kurs.themen.includes(d.t) ? z.kurs.themen.filter(x => x !== d.t) : [...z.kurs.themen, d.t]; feldWerte(); TW.geaendert(z); C.sichern(); { const y = window.scrollY; planung(4); window.scrollTo(0, y); } return;
    case 'gruppe': ui.offen[d.g] = !ui.offen[d.g]; return neuZeichnen();
    case 'detail': ui.detail = ui.detail === d.t ? null : d.t; return neuZeichnen();
    case 'wahl': wahlSetzen(d.t, d.w, d.anlass === 'befragung' ? 'befragung' : 'meine_themen'); return neuZeichnen();
    case 'jetztAdd': if (ui.jetzt.length < 3 && !ui.jetzt.includes(d.t)) ui.jetzt.push(d.t); return planung(6);
    case 'jetztWeg': ui.jetzt.splice(Number(d.i), 1); return planung(6);
    case 'missionStart': {
      const vorher = z.aktiv.map(a => a.thema);
      aktivAendern(ui.jetzt.slice(), vorher.length ? 'tausch' : 'hinzu', ui.jetzt[0]);
      z.planung.status = 'fertig'; z.planung.fertig = new Date().toISOString();
      C.protokoll('missionsplanung', { aktion: 'fertig', schritt: 6, schule: z.schule.themen, kurs: z.kurs.themen, kurs_freitext: z.kurs.freitext || '', aktiv: z.aktiv.map(a => a.thema), selbst: Object.keys(z.schule.selbst).length });
      // Themen auf „Sitzt“ mit Check: Schnell-Check vor dem Thema; neue Themen mit offenen Voraussetzungen: C1
      ui.c1 = [];
      for (const t of ui.jetzt) { if (z.wahl[t] === 'pruefen') kcEinreihen(t, 'thema'); if (!vorher.includes(t) && !z.trotzdem[t]) ui.c1.push(t); }
      TW.geaendert(z); C.sichern();
      ui.jetzt = null;
      return weiterNachStart();
    }
    case 'meine': return meine();
    case 'holenListe': ui.detail = null; return holenListe();
    case 'holen': {
      if (z.aktiv.length >= TW.MAX_AKTIV || z.aktiv.some(a => a.thema === d.t)) return meine();
      aktivAendern([...z.aktiv.map(a => a.thema), d.t], 'hinzu', d.t);
      if (z.wahl[d.t] === 'pruefen') kcEinreihen(d.t, 'thema');
      ui.c1 = [d.t];
      const v = TW.vorOffen(D(), z, d.t);
      if (v.offen.length || v.wackelt.length) return weiterNachStart();
      if ((z.kcSchlange || []).length) return weiterNachStart();
      return meine();
    }
    case 'pause': {
      const liste = z.aktiv.map(a => a.thema).filter(t => t !== d.t);
      z.pausiert = [...z.pausiert.filter(p => p.thema !== d.t), { thema: d.t, seit: heute() }];
      aktivAendern(liste, 'pause', d.t);
      return meine();
    }
    case 'check': kcEinreihen(d.t, 'thema'); TW.geaendert(z); C.sichern(); if (!z.kc) kcNaechster(); return C.aufgabenStarten();
    case 'c1': {
      for (const t of d.t.split(',').filter(Boolean)) {
        // Erst checken: was einen Check hat; was keinen hat, kommt wie bei „trotzdem“ ab und zu dran (C3)
        if (d.w === 'erst' && checkbarVon(t).length) kcEinreihen(t, 'voraus');
        z.trotzdem[t] = true;
        C.protokoll('voraussetzung', { aktion: d.w === 'erst' ? 'erst_pruefen' : 'trotzdem', thema: t, ...TW.vorOffen(D(), z, t) });
      }
      TW.geaendert(z); C.sichern();
      return weiterNachStart();
    }
    case 'kcErgebnis': return kcErgebnis();
    case 'kcJa': {
      const e = z.kcErgebnis; if (!e) return C.zeigeStart();
      e.angenommen = d.w === 'ja';
      if (e.angenommen) wahlSetzen(e.thema, 'wiederholen', 'meine_themen');
      C.protokoll('einstufung', { aktion: 'ende', thema: e.thema, teilschritte: Object.keys(e.ergebnis), ergebnis: e.ergebnis, angenommen: e.angenommen, art: e.art });
      e.gemeldet = true; C.sichern();
      return kcErgebnis();
    }
    case 'kcWeiter': {
      const e = z.kcErgebnis;
      if (e && !e.gemeldet) C.protokoll('einstufung', { aktion: 'ende', thema: e.thema, teilschritte: Object.keys(e.ergebnis), ergebnis: e.ergebnis, angenommen: null, art: e.art });
      z.kcErgebnis = null; C.sichern();
      if ((z.kcSchlange || []).length && kcNaechster()) return C.aufgabenStarten();
      return C.aufgabenStarten();
    }
    case 'kaForm': return kaForm();
    case 'kaSpeichern': { const w = feldWerte(true); if (!w || !kaSpeichern(w.datum, w.thema)) { const p = document.querySelector('.tw-screen .sz-panel.gelb'); if (p && !p.querySelector('.tw-fehler')) p.insertAdjacentHTML('beforeend', '<p class="tw-fehler">Bitte Datum (ab morgen) und Thema wählen.</p>'); return; } return meine(); }
    case 'kaWeg': { const k = TW.klassenarbeitJetzt(z, heute()); if (k) { z.klassenarbeiten = z.klassenarbeiten.filter(x => x !== k); C.protokoll('klassenarbeit', { aktion: 'geloescht', datum: k.datum, thema: k.thema }); TW.geaendert(z); C.sichern(); } return meine(); }
    case 'kaAntwort': { const k = z.klassenarbeiten.find(x => x.datum === d.d && x.rueckmeldung == null); if (k) { k.rueckmeldung = d.w; C.protokoll('klassenarbeit', { aktion: 'rueckmeldung', datum: k.datum, thema: k.thema, antwort: d.w }); TW.geaendert(z); C.sichern(); } C.modalZu(); return; }
    case 'fortschritt': return fortschritt(d.r || 'heute');
    case 'ziel': {
      const k = d.k, dd = Number(d.d);
      const gr = { minuten: [5, 180], neu: [1, 10], tiefe: [1, 30], woche: [1, 7] }[k];
      if (k === 'woche') z.ziele.woche_tage = Math.max(gr[0], Math.min(gr[1], z.ziele.woche_tage + dd));
      else z.ziele.tag[k] = Math.max(gr[0], Math.min(gr[1], z.ziele.tag[k] + dd));
      C.protokoll('ziel', { art: k === 'woche' ? 'woche' : 'tag', werte: k === 'woche' ? { tage: z.ziele.woche_tage } : { ...z.ziele.tag } });
      TW.geaendert(z); C.sichern();
      return fortschritt('heute');
    }
    case 'karteAlle': ui.karteAlle = !!d.w; ui.karteSel = null; return fortschritt('karte');
    case 'stern': ui.karteSel = ui.karteSel === d.n ? null : d.n; { const k = document.querySelector('.tw-karte'); const x = k ? k.scrollLeft : 0; fortschritt('karte'); const k2 = document.querySelector('.tw-karte'); if (k2) k2.scrollLeft = x; } return;
    case 'verlauf': ui.verlaufThema = d.t; return fortschritt('verlauf');
    case 'monat': ui.monat = d.m; return fortschritt('kal');
  }
}
function neuZeichnen() {
  const y = window.scrollY;
  if (ui.ort === 'planung') planung(ui.schritt); else holenListe();
  window.scrollTo(0, y);
}
// Für app.js: Schnell-Check aus der Warteschlange starten (z. B. nach dem Ergebnis)
export const naechsterCheck = () => kcNaechster();
export const offen = () => ui;
