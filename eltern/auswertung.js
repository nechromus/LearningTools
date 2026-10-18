// Auswertung der Lerndaten für die Eltern-App. Reine Funktionen, ohne DOM (testbar mit node).
import { tagKey, potenzWert, SPIELZEIT_STANDARD, spielzeitRegeln } from '../js/logic.js';
import { THEMA_NAMEN, FEHLER_NAMEN, GEN_NAMEN } from '../js/namen.js';
import * as P from '../js/paket.js';

const ZU_AUFGABE = new Set(['versuch', 'versuch_wiederholt', 'tipp_bestaetigt', 'hinweis', 'rechner', 'rechner_offen',
  'rechner_angeboten', 'rechner_optional', 'verlassen', 'sprung', 'loesung_gezeigt', 'bonus_teil_uebersprungen', 'hilfe']);

export const zahl = (w) => w == null ? '' : String(w).replace('.', ',').replace(/^-/, '−');

// Teilt die Einträge eines Geräts in Aufgaben auf. Einträge mehrerer Geräte vorher nach Gerät trennen.
export function aufgabenAus(eintraege, geraet = '') {
  const liste = [];
  let offen = null;
  const schliessen = (status, e) => {
    if (!offen) return;
    offen.status = status;
    offen.bis = e ? e.t : offen.events[offen.events.length - 1].t;
    liste.push(offen);
    offen = null;
  };
  for (const e of eintraege) {
    if (e.typ === 'aufgabe_start') {
      schliessen('offen');
      offen = { key: `${geraet}|${e.t}`, geraet, id: e.id, thema: e.thema, stufe: e.stufe, start: e, events: [e], ende: null, tag: tagKey(new Date(e.t)) };
      continue;
    }
    if (!offen) continue;
    if (e.typ === 'aufgabe_ende' && e.id === offen.id) { offen.events.push(e); offen.ende = e; schliessen('fertig', e); continue; }
    if ((e.typ === 'aufgabe_abgebrochen' || e.typ === 'uebersprungen') && e.id === offen.id) { offen.events.push(e); schliessen(e.typ === 'uebersprungen' ? 'uebersprungen' : 'abgebrochen', e); continue; }
    if (ZU_AUFGABE.has(e.typ) && (e.id === offen.id || e.id == null)) offen.events.push(e);
  }
  schliessen('offen');
  return liste;
}

// Spiel-Sitzungen eines Geräts: von spiel_start bis spiel_ende.
// Ältere Einträge haben kein Feld „spiel“: dann war es 2048.
export function spieleAus(eintraege, geraet = '') {
  const liste = [];
  let offen = null;
  const schliessen = (e) => {
    if (!offen) return;
    offen.ende = e || null;
    offen.bis = e ? e.t : offen.events[offen.events.length - 1].t;
    if (e) {
      offen.sekunden = e.sekunden || 0;
      offen.punkte = e.punkte ?? null;
      offen.maxKachel = e.maxKachel ?? null;
      offen.rest = e.rest ?? null;
      offen.hoehle = e.hoehle ?? null;
    } else {
      offen.sekunden = Math.max(0, Math.round((new Date(offen.bis) - new Date(offen.start.t)) / 1000));
    }
    liste.push(offen);
    offen = null;
  };
  for (const e of eintraege) {
    if (e.typ === 'spiel_start') {
      schliessen(null);
      offen = { key: `spiel|${geraet}|${e.t}`, geraet, spiel: e.spiel || '2048', start: e, events: [e], ende: null, tag: tagKey(new Date(e.t)), guthaben: e.guthaben ?? null };
      continue;
    }
    if (!offen) continue;
    if (e.typ === 'spiel_ende') { offen.events.push(e); schliessen(e); continue; }
    if (['spiel_meilenstein', 'spiel_vorbei', 'spiel_neu', 'km_hoehle'].includes(e.typ)) { offen.events.push(e); continue; }
    // Etwas anderes passiert (z. B. Aufgabe begonnen), ohne dass das Spiel beendet wurde: Sitzung endet hier
    if (e.typ === 'aufgabe_start') schliessen(null);
  }
  schliessen(null);
  return liste;
}

export function alleSpiele(eintraegeProGeraet) {
  const out = [];
  for (const [g, liste] of Object.entries(eintraegeProGeraet)) out.push(...spieleAus(liste, g));
  return out.sort((a, b) => a.start.t < b.start.t ? -1 : 1);
}

export const SPIEL_NAMEN = { '2048': '2048', runenfeld: 'Runenfeld', kristallmine: 'Kristallmine' };
const KM_ERGEBNIS = { geschafft: 'geschafft', treffer: 'getroffen', zeit: 'Zeit der Höhle um', neu: 'neu begonnen' };
const KM_GRUND = { stein: 'von einem Stein getroffen', kristall: 'von einem Kristall getroffen', gluehwurm: 'Glühwurm berührt', schmetterling: 'Schmetterling berührt', explosion: 'in eine Explosion geraten' };
export const punkteText = (n) => n == null ? '' : Number(n).toLocaleString('de-DE');

// Ereignisse einer Spiel-Sitzung als Zeitleiste
export function spielZeitleiste(sp) {
  const t0 = new Date(sp.start.t).getTime();
  const zeit = (e) => { const s = sek(new Date(e.t).getTime() - t0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const out = [];
  for (const e of sp.events) {
    const p = { zeit: zeit(e), titel: '', text: '', art: 'info' };
    switch (e.typ) {
      case 'spiel_start': p.titel = `${SPIEL_NAMEN[sp.spiel] || sp.spiel} geöffnet`; p.text = e.guthaben != null ? `Spielzeit vorher ${minutenText(e.guthaben)}` : ''; break;
      case 'spiel_meilenstein': p.titel = `Stein ${e.stein} erreicht`; p.text = e.punkte != null ? `${punkteText(e.punkte)} Punkte` : ''; p.art = 'ok'; break;
      case 'spiel_vorbei': p.titel = sp.spiel === 'runenfeld' ? 'Kein Platz mehr' : 'Spiel vorbei'; p.text = [e.punkte != null ? `${punkteText(e.punkte)} Punkte` : '', e.maxKachel ? `höchster Stein ${e.maxKachel}` : ''].filter(Boolean).join(' · '); break;
      case 'km_hoehle':
        p.titel = `Höhle ${e.hoehle}${e.name ? ' · ' + e.name : ''}: ${(e.ergebnis === 'treffer' && KM_GRUND[e.grund || 'stein']) || KM_ERGEBNIS[e.ergebnis] || e.ergebnis}`;
        p.text = [e.kristalle != null ? `${e.kristalle} Kristalle` : '', e.ergebnis === 'geschafft' && e.punkte != null ? `${punkteText(e.punkte)} Punkte` : '', e.ergebnis !== 'geschafft' && e.leben != null ? `noch ${e.leben} Leben` : ''].filter(Boolean).join(' · ');
        p.art = e.ergebnis === 'geschafft' ? 'ok' : 'info';
        break;
      case 'spiel_neu': p.titel = 'Neues Spiel begonnen'; p.text = e.altePunkte != null ? `vorher ${punkteText(e.altePunkte)} Punkte` : ''; break;
      case 'spiel_ende': p.titel = 'Spiel verlassen'; p.text = [`${minutenText(e.sekunden)} gespielt`, e.rest != null ? `Spielzeit danach ${minutenText(e.rest)}` : ''].filter(Boolean).join(' · '); p.art = 'ok'; break;
      default: continue;
    }
    out.push(p);
  }
  if (!sp.ende) out.push({ zeit: zeit({ t: sp.bis }), titel: 'Ende nicht gemeldet', text: 'App wurde wohl im Spiel geschlossen. Dauer geschätzt.', art: 'info' });
  return out;
}

// Alle Geräte zusammen, nach Startzeit sortiert
export function alleAufgaben(eintraegeProGeraet) {
  const out = [];
  for (const [g, liste] of Object.entries(eintraegeProGeraet)) out.push(...aufgabenAus(liste, g));
  return out.sort((a, b) => a.start.t < b.start.t ? -1 : 1);
}

// Aufgabe auflösen: erzeugte Aufgaben sind im Protokoll, eingebaute kommen aus aufgaben.json
export function aufgabeVon(rec, pool) {
  return rec.start.aufgabe || (pool && pool.get(rec.id)) || null;
}

export function kurztext(rec, a) {
  if (a) {
    if (a.typ === 'mehrfrage' && (a.generator || '').startsWith('block')) return a.fragen.map(f => f.frage.replace(/\s*=$/, '')).join(', ');
    if (a.rechnung) return a.rechnung;
    if (a.geschichte) return a.geschichte.split(/(?<=[.!?])\s/)[0];
    if (a.frage) return a.frage;
  }
  if (rec.start.rechnung) return rec.start.rechnung;
  if (rec.start.geschichte) return rec.start.geschichte.split(/(?<=[.!?])\s/)[0];
  return rec.id;
}

// Beschriftungen der Teile, so wie die Übungs-App sie aufbaut (Merkzettel zuerst)
export function teilLabels(a) {
  if (!a) return [];
  const merk = (a.gegeben || []).map(g => `${g.name} =`);
  let haupt = [];
  switch (a.typ) {
    case 'zahl': haupt = [a.rechnung ? `${a.rechnung} =` : null]; break;
    case 'bruch': haupt = ['Bruch:']; break;
    case 'auswahl': {
      const werte = (a.optionen || []).map(potenzWert);
      if (werte.length && werte.every(Boolean)) haupt = a.optionen.map(o => `${o} =`);
      haupt.push(a.frage);
      break;
    }
    case 'schritte': haupt = a.schritte.map(s => s.text); break;
    case 'mehrfrage': haupt = a.fragen.map(q => q.frage); break;
    case 'zuordnung': haupt = ['Zuordnung']; break;
  }
  return [...merk, ...haupt];
}

function optionenVon(a, teil) {
  if (!a) return null;
  if (a.typ === 'auswahl') return teil === teilLabels(a).length - 1 ? a.optionen : null;
  if (a.typ === 'schritte') { const s = a.schritte[teil - (a.gegeben || []).length]; return s && s.optionen; }
  return null;
}

const ERGEBNIS = { erst: '1. Versuch', zweit: '2. Versuch', loesung: 'Lösung gezeigt' };
export const ergebnisText = (rec) => rec.ende ? ERGEBNIS[rec.ende.ergebnis] : rec.status === 'uebersprungen' ? 'Übersprungen' : rec.status === 'abgebrochen' ? 'Abgebrochen' : 'Nicht beendet';
export const ergebnisArt = (rec) => rec.ende ? rec.ende.ergebnis : 'offen';

const sek = (ms) => Math.max(0, Math.round((ms || 0) / 1000));
export function dauerText(ms) {
  const s = sek(ms);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} Min.`;
}
export function minutenText(sekunden) {
  const m = Math.round((sekunden || 0) / 6) / 10;
  return `${zahl(m)} Min.`;
}

// Zeitleiste einer Aufgabe: [{ zeit, titel, text, art: 'ok'|'fehler'|'info' }]
export function zeitleiste(rec, a, hinweisTitel = {}) {
  const t0 = new Date(rec.start.t).getTime();
  const labels = teilLabels(a);
  const nMerk = a ? (a.gegeben || []).length : 0;
  const zeit = (e) => { const s = sek(new Date(e.t).getTime() - t0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const out = [];
  for (const e of rec.events) {
    const p = { zeit: zeit(e), titel: '', text: '', art: 'info' };
    switch (e.typ) {
      case 'aufgabe_start':
        p.titel = e.fortsetzung ? 'Aufgabe wieder geöffnet (hatte gewartet)' : 'Aufgabe geöffnet';
        p.text = [`Aufgabe ${e.serienPos} der Serie`, e.wiederholung ? 'Wiederholung' : '', e.bonus ? 'Bonus' : ''].filter(Boolean).join(' · ');
        break;
      case 'versuch': {
        let label = e.label != null ? e.label : labels[e.teil];
        let eingabe = e.eingabe;
        const opt = optionenVon(a, e.teil);
        if (opt && /^\d+$/.test(String(eingabe))) eingabe = opt[Number(eingabe)] ?? eingabe;
        else if (typeof eingabe === 'string' && /^[-\d.]+\/?[-\d.]*$/.test(eingabe)) eingabe = eingabe.split('/').map(zahl).join('/');
        if (a && a.typ === 'zuordnung') { p.titel = `Zuordnung, ${e.versuch}. Versuch`; p.text = e.richtig ? 'alles richtig' : `${e.falsch} Kästchen nicht richtig`; p.art = e.richtig ? 'ok' : 'fehler'; break; }
        if (!label) label = 'Antwort:';
        p.titel = `${e.merk ? 'Merkzettel: ' : ''}${/[=≈:]$/.test(label.trim()) ? label.trim() : label.trim() + ':'} ${eingabe}`;
        const teile = [];
        if (e.richtig) teile.push(`richtig im ${e.versuch}. Versuch`);
        else teile.push(e.fehler ? (FEHLER_NAMEN[e.fehler] || e.fehler) : 'nicht richtig', e.versuch < 2 && !(opt) ? 'Tipp gezeigt' : '');
        if (e.ms != null) teile.push(`${sek(e.ms)} s überlegt`);
        if (e.schnell && !e.richtig) teile.push('sehr schnell geantwortet');
        p.text = teile.filter(Boolean).join(' · ');
        p.art = e.richtig ? 'ok' : 'fehler';
        break;
      }
      case 'versuch_wiederholt': p.titel = `Gleiche Antwort nochmal: ${zahl(e.eingabe)}`; p.text = 'zählt nicht als neuer Versuch'; break;
      case 'tipp_bestaetigt': p.titel = 'Tipp gelesen'; break;
      case 'hinweis': p.titel = `Hinweis „${hinweisTitel[e.hinweis] || e.hinweis}“ geöffnet`; break;
      case 'rechner_offen': p.titel = 'Taschenrechner geöffnet'; break;
      case 'rechner_angeboten': p.titel = 'Freiwilligen Rechner angesehen'; break;
      case 'rechner_optional': p.titel = 'Freiwilligen Rechner genommen'; p.text = 'weniger Spielzeit'; p.art = 'fehler'; break;
      case 'rechner': p.titel = `Rechner: ${e.ausdruck}${e.ohneGleich ? '' : ' ='}${e.ergebnis != null ? ' ' + zahl(Math.round(e.ergebnis * 1000) / 1000) : ''}`; p.text = e.ohneGleich ? 'ohne „=“ eingetragen' : ''; break;
      case 'verlassen': p.titel = `App verlassen (${sek(e.ms)} s)`; p.text = e.strafe === 'null' ? 'keine Spielzeit für diese Aufgabe' : e.strafe === 'halb' ? 'halbe Spielzeit' : ''; p.art = 'fehler'; break;
      case 'sprung': p.titel = 'Auf ein späteres Feld getippt'; p.text = e.abgegeben ? 'Antwort damit abgegeben' : 'Feld war noch leer, hat geblinkt'; break;
      case 'loesung_gezeigt': p.titel = 'Lösung gezeigt'; p.text = 'nach 2 Versuchen'; p.art = 'fehler'; break;
      case 'bonus_teil_uebersprungen': p.titel = 'Bonus-Teil übersprungen'; break;
      case 'aufgabe_ende':
        p.titel = `Fertig: ${ERGEBNIS[e.ergebnis]}`;
        p.text = [`Spielzeit +${minutenText(e.sekunden)}`, `Dauer ${dauerText(e.ms)}`].join(' · ');
        p.art = e.ergebnis === 'erst' ? 'ok' : e.ergebnis === 'zweit' ? 'info' : 'fehler';
        break;
      case 'aufgabe_abgebrochen': p.titel = 'Mit „Fertig“ verlassen'; p.text = [e.ohneEingabe ? 'ohne Eingabe' : '', e.wartet ? 'kommt beim nächsten Mal wieder' : ''].filter(Boolean).join(' · '); p.art = 'fehler'; break;
      case 'hilfe': p.titel = `„Hilf mir“ (${e.stufe}. Schritt)`; p.text = (e.zeilen || []).join(' · ') + ' · weniger Spielzeit'; p.art = 'fehler'; break;
      case 'uebersprungen': p.titel = 'Übersprungen'; break;
      default: continue;
    }
    out.push(p);
  }
  return out;
}

// Kennzahlen für einen Zeitraum (Tage-Schlüssel ab „vonTag“ einschließlich)
export function kennzahlen(aufgaben, eintraege, vonTag) {
  const auf = aufgaben.filter(r => r.tag >= vonTag && r.ende);
  const ein = eintraege.filter(e => tagKey(new Date(e.t)) >= vonTag);
  const erst = auf.filter(r => r.ende.ergebnis === 'erst').length;
  const proThema = {};
  for (const r of auf) {
    const t = proThema[r.thema] || (proThema[r.thema] = { thema: r.thema, name: THEMA_NAMEN[r.thema] || r.thema, anzahl: 0, erst: 0, loesung: 0, stufe: 0 });
    t.anzahl++;
    if (r.ende.ergebnis === 'erst') t.erst++;
    if (r.ende.ergebnis === 'loesung') t.loesung++;
    t.stufe = r.stufe || t.stufe;
  }
  const fehler = {};
  let schnell = 0;
  for (const e of ein) {
    if (e.typ === 'versuch' && e.fehler) fehler[e.fehler] = (fehler[e.fehler] || 0) + 1;
    if (e.typ === 'versuch' && e.schnell && !e.richtig) schnell++;
  }
  const verlassen = ein.filter(e => e.typ === 'verlassen').length;
  const rechnerFrei = ein.filter(e => e.typ === 'rechner_optional').length;
  const hilfe = new Set(ein.filter(e => e.typ === 'hilfe').map(e => `${e.id}|${tagKey(new Date(e.t))}`)).size;
  const weg = ein.filter(e => e.typ === 'aufgabe_abgebrochen' && ohneEingabe(e, aufgaben));
  const wegThemen = {};
  for (const e of weg) { const th = e.thema || (aufgaben.find(r => r.id === e.id) || {}).thema; if (th) wegThemen[th] = (wegThemen[th] || 0) + 1; }
  const tage = {};
  for (const r of auf) {
    const d = tage[r.tag] || (tage[r.tag] = { tag: r.tag, anzahl: 0, erst: 0, ms: 0, sekunden: 0 });
    d.anzahl++; if (r.ende.ergebnis === 'erst') d.erst++; d.ms += r.ende.ms || 0; d.sekunden += r.ende.sekunden || 0;
  }
  const auffaellig = Object.entries(fehler).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FEHLER_NAMEN[k] || k}: ${n}-mal`);
  if (verlassen) auffaellig.push(`App ${verlassen}-mal verlassen während einer Aufgabe`);
  if (schnell) auffaellig.push(`${schnell}-mal sehr schnell falsch geantwortet (Textaufgaben)`);
  if (rechnerFrei) auffaellig.push(`${rechnerFrei}-mal den freiwilligen Rechner genommen`);
  if (weg.length) {
    const top = Object.entries(wegThemen).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `${THEMA_NAMEN[t] || t} ${n}-mal`);
    auffaellig.push(`Aufgabe ${weg.length}-mal ohne Eingabe verlassen${top.length ? ` (meist ${top.join(', ')})` : ''}`);
  }
  if (hilfe) auffaellig.push(`${hilfe}-mal „Hilf mir“ genutzt`);
  return {
    aufgaben: auf.length,
    erst,
    quote: auf.length ? Math.round(erst / auf.length * 100) : null,
    uebungMs: auf.reduce((s, r) => s + (r.ende.ms || 0), 0),
    verdientSek: auf.reduce((s, r) => s + (r.ende.sekunden || 0), 0),
    gespieltSek: ein.filter(e => e.typ === 'spiel_ende').reduce((s, e) => s + (e.sekunden || 0), 0),
    geschenkt: ein.filter(e => e.typ === 'basis').length,
    aktiveTage: Object.keys(tage).length,
    themen: Object.values(proThema).sort((a, b) => b.anzahl - a.anzahl).map(t => ({ ...t, quote: Math.round(t.erst / t.anzahl * 100) })),
    tage,
    auffaellig
  };
}

// Wurde die Aufgabe ohne jede Eingabe verlassen? Neue Einträge haben das Feld, ältere werden aus den Versuchen bestimmt.
function ohneEingabe(e, aufgaben) {
  if (typeof e.ohneEingabe === 'boolean') return e.ohneEingabe;
  const rec = aufgaben.find(r => r.status === 'abgebrochen' && r.bis === e.t && r.id === e.id);
  return rec ? !rec.events.some(x => x.typ === 'versuch') : false;
}

// Tage-Schlüssel der letzten n Tage, ältester zuerst
export function letzteTage(n, heute = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(heute); d.setDate(d.getDate() - i); out.push(tagKey(d)); }
  return out;
}

// Aktuelle Werte für die Einstellungen: aus der letzten Eltern-Einstellung, sonst aus dem neuesten Stand des Handys
// Gewichte eines Kindes = Paket-Gewichte, darüber die Abweichungen für dieses Kind
export function gewichteMit(paketGewichte, abweichungen) {
  return P.gewichteNorm({ ...P.gewichteNorm(paketGewichte), ...(abweichungen || {}) });
}

// Abweichungen nur für Themen, die wirklich anders sind als im Paket
export function abweichungenAus(paketGewichte, gewichte) {
  const p = P.gewichteNorm(paketGewichte), g = P.gewichteNorm(gewichte);
  return Object.fromEntries(Object.keys(g).filter(t => g[t] !== p[t]).map(t => [t, g[t]]));
}

// paketVon(id) liefert das Paket (mit gewichte) oder nichts, wenn es das Paket nicht mehr gibt
export function startWerte(einst, stand, paketVon = () => null) {
  const e = (stand && stand.einstellungen) || {};
  const w = (einst && einst.werte) || {};
  const genStufen = {};
  for (const g of Object.keys(GEN_NAMEN)) genStufen[g] = (stand && stand.genStufen && stand.genStufen[g] && stand.genStufen[g].stufe) || 1;
  return {
    thema: w.thema || e.thema || 'minus-zahlen',
    basisVon: w.basisVon ?? e.basisVon ?? 14,
    basisBis: w.basisBis ?? e.basisBis ?? 21,
    rechnerAngebot: w.rechnerAngebot ?? (e.rechnerAngebot !== false),
    spielzeit: spielzeitRegeln(w.spielzeit || (stand && stand.spielzeit) || SPIELZEIT_STANDARD),
    genStufen,
    ...paketTeil(w, stand, e, paketVon)
  };
}

function paketTeil(w, stand, e, paketVon) {
  const ref = w.paket ? { id: w.paket.id, name: w.paket.name }
    : (stand && stand.paket) ? { id: stand.paket.id, name: stand.paket.name }
    : { id: P.STANDARD_PAKET.id, name: P.STANDARD_PAKET.name };
  const bisher = w.gewichte || (stand && stand.paket && stand.paket.gewichte) || (stand && stand.gewichte) || P.gewichteOhnePaket(e.thema || 'minus-zahlen');
  const paket = paketVon(ref.id);
  if (!paket) return { paket: ref, abweichungen: {}, gewichte: P.gewichteNorm(bisher) }; // Paket gelöscht: Gewichte bleiben stehen
  const abweichungen = w.abweichungen ? { ...w.abweichungen } : abweichungenAus(paket.gewichte, bisher);
  return { paket: { id: paket.id, name: paket.name }, abweichungen, gewichte: gewichteMit(paket.gewichte, abweichungen) };
}

// Datei für daten/<name>/einstellungen.json bauen. Stufen bekommen nur dann die neue Version, wenn sie geändert wurden.
export function einstellungsDatei(alt, werte, geaenderteStufen, jetzt = new Date()) {
  const version = ((alt && alt.version) || 0) + 1;
  const genStufen = { ...((alt && alt.werte && alt.werte.genStufen) || {}) };
  for (const g of geaenderteStufen) genStufen[g] = { stufe: werte.genStufen[g], v: version };
  return {
    app: 'lernapp-2048-eltern', version, geaendert: jetzt.toISOString(),
    werte: { thema: hauptThema(werte), paket: werte.paket, abweichungen: werte.abweichungen || {}, gewichte: P.gewichteNorm(werte.gewichte), basisVon: werte.basisVon, basisBis: werte.basisBis, rechnerAngebot: werte.rechnerAngebot, spielzeit: spielzeitRegeln(werte.spielzeit), genStufen }
  };
}

// Paket wurde geändert: neue Gewichte für ein Kind, das dieses Paket nutzt (Abweichungen bleiben). null = nichts zu tun.
export function einstellungMitNeuemPaket(alt, paket, jetzt = new Date()) {
  const w = alt && alt.werte;
  if (!w || !w.paket || w.paket.id !== paket.id) return null;
  const abweichungen = w.abweichungen || abweichungenAus(paket.gewichte, w.gewichte);
  const gewichte = gewichteMit(paket.gewichte, abweichungen);
  const neu = { ...w, paket: { id: paket.id, name: paket.name }, abweichungen, gewichte };
  if (JSON.stringify(neu) === JSON.stringify(w)) return null;
  neu.thema = hauptThema(neu);
  return { ...alt, version: alt.version + 1, geaendert: jetzt.toISOString(), werte: neu };
}

// Für ältere Übungs-Apps ohne Pakete: das kurze Thema mit dem höchsten Gewicht
function hauptThema(werte) {
  const g = werte.gewichte || {};
  let best = null;
  for (const t of P.KOPF_THEMEN) if ((g[t] || 0) > (best ? g[best] : 0)) best = t;
  return best || werte.thema;
}

// Mögliche Spielzeit für 10 Aufgaben am Stück, alle im 1. Versuch
export function serieMinuten(regeln) {
  const s = regeln.staffel;
  return Math.round((3 * s[0] + 3 * s[1] + 3 * s[2] + s[3]) * 10) / 10;
}
