// Auswertung der Lerndaten für die Eltern-App. Reine Funktionen, ohne DOM (testbar mit node).
import { tagKey, potenzWert, SPIELZEIT_STANDARD, spielzeitRegeln, BEDIENUNG, FREIGABEN } from '../js/logic.js';
import { THEMA_NAMEN, FEHLER_NAMEN, GEN_NAMEN } from '../js/namen.js';
import * as P from '../js/paket.js';
import * as SP from '../js/splitter.js';
import * as BS from '../js/bildschirm.js';
import * as LP from '../js/lernplan.js';
import * as W from '../js/wochenplan.js';

const ZU_AUFGABE = new Set(['versuch', 'versuch_wiederholt', 'tipp_bestaetigt', 'hinweis', 'rechner', 'rechner_offen',
  'rechner_angeboten', 'rechner_optional', 'verlassen', 'sprung', 'loesung_gezeigt', 'bonus_teil_uebersprungen', 'hilfe',
  'zu_schnell', 'vorlesen', 'gelesen', 'text_hilfe', 'hinweis_kurz', 'hinweis_lang', 'formeluebersicht', 'schritte_an', 'umformen_an', 'umform_versuch', 'umform_schritt', 'umform_hilfe', 'umform_umweg', 'umform_zurueck', 'umform_aufstellen', 'umform_fertig', 'erinnerung']);

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
    if (['spiel_meilenstein', 'spiel_vorbei', 'spiel_neu', 'km_hoehle', 'ss_level', 'rn_spiel', 'rr_stufe', 'rr_neu', 'hk_karte', 'rb_level', 'jsg_runde'].includes(e.typ)) { offen.events.push(e); continue; }
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

export const SPIEL_NAMEN = { '2048': '2048', runenfeld: 'Runenfeld', kristallmine: 'Kristallmine', steinschieber: 'Steinschieber', runenfall: 'Runenfall', runenreihen: 'Runenreihen', hoehlenkarte: 'Höhlenkarte', runenbrecher: 'Runenbrecher', jadeschlange: 'Jadeschlange' };
const HK_GROESSE = { klein: 'kleine Karte', mittel: 'mittlere Karte', gross: 'große Karte' };
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
      case 'ss_level':
        p.titel = `Level ${e.level}${e.name ? ' · ' + e.name : ''} geschafft`;
        p.text = [`${e.schuebe} Schübe${e.optimal != null ? (e.schuebe <= e.optimal ? ' (bestmöglich)' : ` (bestmöglich ${e.optimal})`) : ''}`, e.zurueck ? `${e.zurueck}-mal zurück` : '', e.tipps ? `${e.tipps} ${e.tipps === 1 ? 'Tipp' : 'Tipps'}` : '', e.erstmals === false ? 'wiederholt' : ''].filter(Boolean).join(' · ');
        p.art = 'ok';
        break;
      case 'rn_spiel':
        p.titel = e.ergebnis === 'vorbei' ? (e.rekord ? 'Kein Platz mehr · neuer Rekord' : 'Kein Platz mehr') : 'Neues Spiel begonnen';
        p.text = [`${punkteText(e.punkte)} Punkte`, `${e.reihen} ${e.reihen === 1 ? 'Reihe' : 'Reihen'}`, e.stufe ? `Stufe ${e.stufe}` : ''].filter(Boolean).join(' · ');
        p.art = e.rekord ? 'ok' : 'info';
        break;
      case 'rr_stufe':
        p.titel = `Stufe ${e.stufe} geschafft`; p.text = [`${punkteText(e.punkte)} Punkte`, e.zuege != null ? `${e.zuege} Züge` : ''].filter(Boolean).join(' · '); p.art = 'ok'; break;
      case 'rr_neu':
        p.titel = 'Neues Spiel begonnen'; p.text = `vorher ${punkteText(e.punkte)} Punkte, Stufe ${e.stufe}`; break;
      case 'hk_karte':
        p.titel = `${HK_GROESSE[e.groesse] || 'Karte'}: ${e.ergebnis === 'geschafft' ? 'geschafft' : 'neu begonnen'}`;
        p.text = [e.zurueck ? `${e.zurueck}-mal zurückgenommen` : (e.ergebnis === 'geschafft' ? 'ohne Zurücknehmen' : ''), e.tipps ? `${e.tipps} ${e.tipps === 1 ? 'Tipp' : 'Tipps'}` : '', e.felder != null ? `${e.felder} Felder offen` : ''].filter(Boolean).join(' · ');
        p.art = e.ergebnis === 'geschafft' ? 'ok' : 'info'; break;
      case 'rb_level':
        p.titel = `Level ${e.level}${e.name ? ' · ' + e.name : ''}: ${e.ergebnis === 'geschafft' ? 'geschafft' : 'keine Kugeln mehr'}`;
        p.text = [`${punkteText(e.punkte)} Punkte`, e.ergebnis === 'geschafft' && e.leben != null ? `${e.leben} Kugeln übrig` : ''].filter(Boolean).join(' · ');
        p.art = e.ergebnis === 'geschafft' ? 'ok' : 'info'; break;
      case 'jsg_runde':
        p.titel = e.ergebnis === 'neu' ? 'Neues Spiel begonnen' : (e.rekord ? 'Runde vorbei · neuer Rekord' : 'Runde vorbei');
        p.text = [`${punkteText(e.punkte)} Punkte`, e.laenge ? `Länge ${e.laenge}` : '', e.stufe ? `Stufe ${e.stufe}` : ''].filter(Boolean).join(' · ');
        p.art = e.rekord ? 'ok' : 'info'; break;
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
    if (a.typ === 'detektiv') return `Detektiv: ${a.fremde_rechnung}`;
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
    case 'detektiv': haupt = [a.frage, ...(a.stimmt ? [] : ['Was ist falsch?', (a.richtig_rechnen || {}).text])]; break;
  }
  return [...merk, ...haupt];
}

function optionenVon(a, teil) {
  if (!a) return null;
  if (a.typ === 'auswahl') return teil === teilLabels(a).length - 1 ? a.optionen : null;
  if (a.typ === 'schritte') { const s = a.schritte[teil - (a.gegeben || []).length]; return s && s.optionen; }
  if (a.typ === 'detektiv' && teil === 0) return ['Stimmt', 'Stimmt nicht'];
  return null;
}

const ERGEBNIS = { erst: '1. Versuch', zweit: '2. Versuch', loesung: 'Lösung gezeigt' };
export const ergebnisText = (rec) => rec.ende ? (rec.ende.gleiche_aufgabe && rec.ende.ergebnis !== 'loesung' ? 'Gleiche Aufgabe' : ERGEBNIS[rec.ende.ergebnis]) : rec.status === 'uebersprungen' ? 'Übersprungen' : rec.status === 'abgebrochen' ? 'Abgebrochen' : 'Nicht beendet';
export const ergebnisArt = (rec) => rec.ende ? (rec.ende.gleiche_aufgabe && rec.ende.ergebnis !== 'loesung' ? 'gleich' : rec.ende.ergebnis) : 'offen';

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
        p.text = [`Aufgabe ${e.serienPos} der Serie`, e.nach_loesung ? (e.nach_loesung === e.id ? 'dieselbe Aufgabe nach gezeigter Lösung' : 'nach gezeigter Lösung, neue Aufgabe derselben Art') : e.wiederholung ? 'Wiederholung' : '', e.bonus ? 'Bonus' : ''].filter(Boolean).join(' · ');
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
        p.text = [e.bildschirm != null ? `Bildschirmzeit +${minutenText(e.bildschirm)}${e.voll ? ' (Tagesgrenze erreicht)' : ''}` : '',
          e.bildschirm == null || e.sekunden ? `Spielzeit +${minutenText(e.sekunden)}${e.spielzeitVoll ? ' (Tagesgrenze erreicht)' : ''}` : '',
          e.kopf ? 'im Kopf gerechnet (Bonus)' : '', e.knobeln ? (e.schritte ? 'Knobeln: in Schritten gelöst' : 'Knobeln: ohne Schritte gelöst') : '',
          e.wp ? `+${e.wp} Wissenspunkte` : '', `Dauer ${dauerText(e.ms)}`].filter(Boolean).join(' · ');
        p.art = e.ergebnis === 'erst' ? 'ok' : e.ergebnis === 'zweit' ? 'info' : 'fehler';
        if (e.gleiche_aufgabe && e.ergebnis !== 'loesung') { p.text = ['Gleiche Aufgabe nach gezeigter Lösung: zählt nicht als 1. Versuch', p.text].join(' · '); p.art = 'info'; }
        break;
      case 'aufgabe_abgebrochen': p.titel = 'Mit „Fertig“ verlassen'; p.text = [e.ohneEingabe ? 'ohne Eingabe' : '', e.wartet ? 'kommt beim nächsten Mal wieder' : ''].filter(Boolean).join(' · '); p.art = 'fehler'; break;
      case 'hilfe': p.titel = `„Hilf mir“ (${e.stufe}. Schritt)`; p.text = (e.zeilen || []).join(' · ') + ' · weniger Spielzeit'; p.art = 'fehler'; break;
      case 'uebersprungen': p.titel = 'Übersprungen'; break;
      case 'umformen_an': p.titel = '„In Schritten umformen“ gewählt'; p.text = `Start auf Stufe ${e.stufe}`; break;
      case 'umform_versuch': p.titel = `Schritt ${e.schritt} (${e.umformung}), ${e.seite === 'l' ? 'links' : 'rechts'}: ${e.eingabe}`; p.text = `${e.richtig ? 'passt' : 'noch nicht'} · ${e.versuch}. Versuch · Stufe ${e.stufe}`; p.art = e.richtig ? 'ok' : 'fehler'; break;
      case 'umform_schritt': p.titel = `Schritt ${e.nr} fertig: ${e.eingabe.l} = ${e.eingabe.r}`; p.text = `${e.umformung} · Stufe ${e.stufe}${e.hilfe ? ' · mit Hilfe' : ''}`; p.art = e.hilfe ? 'info' : 'ok'; break;
      case 'umform_hilfe': p.titel = e.art === 'vorschlag' ? `„Hilf mir“: Vorschlag ${e.vorschlag || '(allgemein)'}` : e.art === 'uebernommen' ? 'Vorschlag übernommen' : e.art === 'aufstellen-tipp' ? '„Hilf mir“ beim Aufstellen: Denkfrage' : e.art === 'aufstellen-gleichung' ? '„Mehr Hilfe“: App schreibt die Gleichung' : `Hilfe ${e.art.replace('stufe', 'Stufe ')}`; p.text = 'weniger Spielzeit'; p.art = 'fehler'; break;
      case 'umform_aufstellen': p.titel = e.richtig ? 'Gleichung aufgestellt' : 'Gleichung passt noch nicht'; p.text = e.eingabe; p.art = e.richtig ? 'ok' : 'fehler'; break;
      case 'umform_zurueck': p.titel = 'Schritt zurück'; p.text = e.von === 'eintragen' ? `Umformung „${e.umformung}“ neu gewählt` : `Schritt „${e.umformung}“ aufgehoben`; break;
      case 'umform_umweg': p.titel = 'Umweg-Hinweis'; p.text = `${e.schritte} Schritte, nötig ${e.noetig}`; break;
      case 'umform_fertig': p.titel = `Umgeformt in ${e.schritte} ${e.schritte === 1 ? 'Schritt' : 'Schritten'}`; p.text = `${e.loesung}${e.zurueck ? ` · ${e.zurueck}× zurück` : ''}${e.stimmt ? '' : ' · stimmt nicht mit der Antwort'}`; p.art = e.stimmt ? 'ok' : 'fehler'; break;
      case 'schritte_an': p.titel = e.auto ? 'Knobeln: nach 2 Versuchen in Schritten weiter' : '„In Schritten rechnen“ gewählt'; p.text = e.versuche ? `vorher ${e.versuche} ${e.versuche === 1 ? 'Versuch' : 'Versuche'} ohne Schritte` : 'ohne eigenen Versuch'; p.art = e.auto ? 'fehler' : 'info'; break;
      case 'hinweis_kurz': p.titel = `Formelübersicht „${hinweisTitel[e.hinweis] || e.hinweis}“ geöffnet`; p.text = (e.abschnitte || []).length ? 'Kurzversion' : 'steht nicht in der Formelübersicht'; break;
      case 'hinweis_lang': p.titel = `Mehr Hilfe: langer Hinweis „${hinweisTitel[e.hinweis] || e.hinweis}“`; p.text = e.stufe === 0 ? 'gleich lang (ohne Formelübersicht)' : `Stufe ${e.stufe}${e.kosten === 'halb' ? ' · halbe Spielzeit' : ''}`; p.art = e.kosten === 'halb' ? 'fehler' : 'info'; break;
      case 'formeluebersicht': p.titel = 'Ganze Formelübersicht geöffnet'; p.text = `Seite ${e.seite}`; break;
      case 'zu_schnell': p.titel = `Zu schnell geantwortet: ${e.eingabe}`; p.text = `nach ${sek(e.ms)} s · zählt nicht, „Lies noch einmal“`; p.art = 'fehler'; break;
      case 'vorlesen': p.titel = 'Geschichte vorlesen lassen'; break;
      case 'erinnerung': p.titel = 'Erinnerung aus dem Wochenplan'; p.text = e.tage > 90 ? `kam in der App noch nie, Frist ${e.frist} Tage` : `zuletzt vor ${e.tage} Tagen geübt, Frist ${e.frist} Tage`; p.art = 'info'; break;
      case 'gelesen': p.titel = 'Geschichte Satz für Satz gelesen'; p.text = `${sek(e.ms)} s`; break;
      case 'text_hilfe': p.titel = e.angenommen ? 'Hilfe beim Text angenommen' : 'Hilfe beim Text abgelehnt'; p.text = e.angenommen ? 'vorgelesen, Zahlen markiert' : 'Aufgabe verlassen'; p.art = e.angenommen ? 'info' : 'fehler'; break;
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
  const erst = auf.filter(r => erstZ(r.ende)).length;
  const proThema = {};
  for (const r of auf) {
    const t = proThema[r.thema] || (proThema[r.thema] = { thema: r.thema, name: THEMA_NAMEN[r.thema] || r.thema, anzahl: 0, erst: 0, loesung: 0, stufe: 0, kurz: 0, kurzOk: 0, lang: 0 });
    t.anzahl++;
    // Kurz-Hinweise: Kommt das Kind mit der Formelübersicht aus (gelöst ohne „Mehr Hilfe“)?
    const k = kurzErgebnis(r);
    if (k) { t.kurz++; if (k === 'ok') t.kurzOk++; if (k === 'lang') t.lang++; }
    if (erstZ(r.ende)) t.erst++;
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
    d.anzahl++; if (erstZ(r.ende)) d.erst++; d.ms += r.ende.ms || 0; d.sekunden += r.ende.sekunden || 0;
  }
  const auffaellig = Object.entries(fehler).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FEHLER_NAMEN[k] || k}: ${n}-mal`);
  if (verlassen) auffaellig.push(`App ${verlassen}-mal verlassen während einer Aufgabe`);
  if (schnell) auffaellig.push(`${schnell}-mal sehr schnell falsch geantwortet (Textaufgaben)`);
  if (rechnerFrei) auffaellig.push(`${rechnerFrei}-mal den freiwilligen Rechner genommen`);
  const kopf = auf.filter(r => r.ende.kopf).length;
  if (kopf) auffaellig.push(`${kopf}-mal im Kopf gerechnet, obwohl der Rechner erlaubt war`);
  if (weg.length) {
    const top = Object.entries(wegThemen).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `${THEMA_NAMEN[t] || t} ${n}-mal`);
    auffaellig.push(`Aufgabe ${weg.length}-mal ohne Eingabe verlassen${top.length ? ` (meist ${top.join(', ')})` : ''}`);
  }
  if (hilfe) auffaellig.push(`${hilfe}-mal „Hilf mir“ genutzt`);
  for (const t of Object.values(proThema).filter(t => t.kurz).sort((a, b) => b.kurz - a.kurz).slice(0, 3)) {
    auffaellig.push(`Kommt mit der Formelübersicht aus: ${t.kurzOk} von ${t.kurz} (${t.name})`);
  }
  return {
    aufgaben: auf.length,
    erst,
    quote: auf.length ? Math.round(erst / auf.length * 100) : null,
    uebungMs: auf.reduce((s, r) => s + (r.ende.ms || 0), 0),
    verdientSek: auf.reduce((s, r) => s + (r.ende.sekunden || 0), 0),
    gespieltSek: ein.filter(e => e.typ === 'spiel_ende').reduce((s, e) => s + (e.sekunden || 0), 0),
    // Bildschirmzeit: verdient (aufgabe_ende.bildschirm) und eingelöst (abgeschickt, Ereignis bildschirmzeit)
    bzVerdientSek: auf.reduce((s, r) => s + (r.ende.bildschirm || 0), 0),
    bzEingeloestSek: ein.filter(e => e.typ === 'bildschirmzeit').reduce((s, e) => s + (e.sekunden || 0), 0),
    bzEingeloest: ein.filter(e => e.typ === 'bildschirmzeit').length,
    geschenkt: ein.filter(e => e.typ === 'basis').length,
    aktiveTage: Object.keys(tage).length,
    themen: Object.values(proThema).sort((a, b) => b.anzahl - a.anzahl).map(t => ({ ...t, quote: Math.round(t.erst / t.anzahl * 100) })),
    tage,
    auffaellig
  };
}

// Kurz-Hinweis in einer Aufgabe: null (keiner geöffnet), 'ok' (gelöst ohne „Mehr Hilfe“), 'lang' („Mehr Hilfe“ genommen), 'nein' (nicht gelöst)
export function kurzErgebnis(r) {
  const ev = r.events || [];
  if (!ev.some(e => e.typ === 'hinweis_kurz')) return null;
  if (ev.some(e => e.typ === 'hinweis_lang')) return 'lang';
  return r.ende && (r.ende.ergebnis === 'erst' || r.ende.ergebnis === 'zweit') ? 'ok' : 'nein';
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
// Übungszeit pro Tag: an, Höchstwert, Nachlauf; extraMin gilt nur heute
export function uzWerte(r, heute = tagKey()) {
  const g = BS.uzRegeln(r);
  return { an: g.an, max: g.max, nachlauf_prozent: g.nachlauf_prozent, extraMin: g.extra && g.extra.tag === heute ? g.extra.min : 0 };
}
export function uzDatei(werte, heute = tagKey()) {
  const w = werte || uzWerte(null, heute);
  return BS.uzRegeln({ an: w.an, max: w.max, nachlauf_prozent: w.nachlauf_prozent, extra: w.extraMin > 0 ? { tag: heute, min: w.extraMin } : null });
}
// Anfragen „mehr Übungszeit“ (neueste zuerst)
export function uzAnfragen(eintraege) {
  return eintraege.filter(e => e.typ === 'uebungszeit_anfrage').slice().sort((a, b) => a.t < b.t ? 1 : -1);
}
// Wissenspunkte: Verlauf aus dem Protokoll (gutgeschrieben und ausgegeben, neueste zuerst)
export function wissenVerlauf(eintraege) {
  return eintraege.filter(e => e.typ === 'wissenspunkte' || e.typ === 'archiv_frei').map(e => ({ t: e.t, n: e.typ === 'archiv_frei' ? -e.kosten : e.n, id: e.id, grund: e.typ === 'archiv_frei' ? 'archiv' : e.grund, stand: e.stand }))
    .sort((a, b) => a.t < b.t ? 1 : -1);
}

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
    langeHinweise: [0, 1, 2, 3].includes(w.langeHinweise) ? w.langeHinweise : [0, 1, 2, 3].includes(e.langeHinweise) ? e.langeHinweise : 1,
    spielzeit: spielzeitRegeln(w.spielzeit || (stand && stand.spielzeit) || SPIELZEIT_STANDARD),
    genStufen,
    splitter: splitterWerte(w.splitter, stand),
    bildschirm: bzWerte(w.bildschirm || (stand && stand.bzRegeln)),
    spielzeitTag: szWerte(w.spielzeitTag || (stand && stand.szRegeln)),
    etappe_anzeigen: w.etappe_anzeigen === true,
    wochenplan: w.wochenplan && typeof w.wochenplan === 'object' ? w.wochenplan : null,
    eingriffe: W.eingriffeNorm(w.eingriffe),
    freigaben: Object.fromEntries(Object.entries((w.freigaben && typeof w.freigaben === 'object') ? w.freigaben : {}).filter(([k, v]) => FREIGABEN.includes(k) && /^\d{4}-\d{2}-\d{2}$/.test(v || ''))),
    gestaltung: ['schrein', 'sternzeit'].includes(w.gestaltung) ? w.gestaltung : 'schrein',
    umform_stufe: [1, 2, 3].includes(w.umform_stufe) ? w.umform_stufe : 3,
    feedback: w.feedback === true,
    boegen_feedback: w.boegen_feedback === true,
    live: w.live === true,
    ...Object.fromEntries(BEDIENUNG.map(b => [b.k, typeof w[b.k] === 'boolean' ? w[b.k] : b.std])),
    ...(typeof w.ansicht_name === 'string' ? { ansicht_name: w.ansicht_name } : {}),
    uebungszeit: uzWerte(w.uebungszeit),
    ...mitPaketen(paketTeil(w, stand, e, paketVon), w, paketVon)
  };
}

// Mehrere Pakete: Liste mit Rolle, Anteil, Etappe und dem Inhalt des Pakets (aus dem Daten-Repo, sonst die Kopie in der Einstellung).
// Eine „nächste Etappe“, deren Datum erreicht ist, gilt als aktuelle Etappe (wie in der Übungs-App).
export function mitPaketen(teil, w, paketVon, heute = tagKey()) {
  const inhalt = (id, kopie) => LP.paketInhalt(paketVon(id) || { id, ...(kopie || {}) });
  let pakete;
  if (Array.isArray(w.pakete) && w.pakete.length) {
    pakete = w.pakete.map(x => LP.eintragNorm({ ...x, paket: inhalt(x.id, x.paket) }));
    LP.naechsteAnwenden(pakete, heute);
  } else {
    pakete = [LP.eintragNorm({ id: teil.paket.id, rolle: 'grund', anteil: 100, paket: inhalt(teil.paket.id, { name: teil.paket.name, gewichte: teil.gewichte }) })];
  }
  return { ...teil, pakete };
}

// Grundpaket der Liste in die alten Felder übernehmen (paket, gewichte), damit Themen-Seite und ältere Apps passen
export function grundUebernehmen(werte, paketVon) {
  const g = LP.grundpaket(werte.pakete);
  if (!g) return werte;
  const pk = paketVon(g.id);
  const basis = pk ? pk.gewichte : g.paket.gewichte;
  if (!werte.paket || werte.paket.id !== g.id) { werte.paket = { id: g.id, name: g.paket.name }; werte.abweichungen = {}; }
  werte.gewichte = gewichteMit(basis, werte.abweichungen || {});
  return werte;
}

// Aufgaben einer Etappe (fertig, in zeitlicher Reihenfolge)
export function etappenAufgaben(aufgaben, paketId, etappe) {
  return aufgaben.filter(r => r.ende && r.start && r.start.paket === paketId && r.start.etappe === etappe);
}
// Quote je Paket und je Etappe
export function paketQuoten(aufgaben, vonTag) {
  const out = {};
  for (const r of aufgaben) {
    if (!r.ende || !r.start || !r.start.paket || r.tag < vonTag) continue;
    const q = out[r.start.paket] || (out[r.start.paket] = { anzahl: 0, erst: 0, etappen: {} });
    q.anzahl++; if (erstZ(r.ende)) q.erst++;
    if (r.start.etappe != null) {
      const e = q.etappen[r.start.etappe] || (q.etappen[r.start.etappe] = { anzahl: 0, erst: 0 });
      e.anzahl++; if (erstZ(r.ende)) e.erst++;
    }
  }
  return out;
}

// Bildschirmzeit-Einstellungen für die Seite. extraMin gilt nur heute (danach 0).
export function bzWerte(r, heute = tagKey()) {
  const g = BS.bzRegeln(r, heute);
  return { an: g.an, faktor: g.faktor, max: g.max, maxBis: g.max_bis || '', maxDanach: g.max_danach || null, ab: g.ab, extraMin: g.extra && g.extra.tag === heute ? g.extra.min : 0, extraFaktor: g.extra ? g.extra.faktor : 0.5 };
}
// Zurück in die Form der Einstellungsdatei
export function bzDatei(werte, heute = tagKey()) {
  const w = werte || bzWerte(null, heute);
  return BS.bzRegeln({ an: w.an, faktor: w.faktor, max: w.max, ...(w.maxBis ? { max_bis: w.maxBis, max_danach: w.maxDanach } : {}), ab: w.ab, extra: w.extraMin > 0 ? { tag: heute, min: w.extraMin, faktor: w.extraFaktor ?? 0.5 } : null }, heute);
}
// Spielzeit im Schrein pro Tag (wie Bildschirmzeit)
export function szWerte(r, heute = tagKey()) {
  const g = BS.szRegeln(r, heute);
  return { max: g.max, maxBis: g.max_bis || '', maxDanach: g.max_danach || null, extraMin: g.extra && g.extra.tag === heute ? g.extra.min : 0, extraFaktor: g.extra ? g.extra.faktor : 0.5 };
}
export function szDatei(werte, heute = tagKey()) {
  const w = werte || szWerte(null, heute);
  return BS.szRegeln({ max: w.max, ...(w.maxBis ? { max_bis: w.maxBis, max_danach: w.maxDanach } : {}), extra: w.extraMin > 0 ? { tag: heute, min: w.extraMin, faktor: w.extraFaktor ?? 0.5 } : null }, heute);
}
// Heute mit Aufgaben verdiente Spielzeit (Sekunden)
export function szHeute(eintraege, heute = tagKey()) {
  return eintraege.filter(e => e.typ === 'aufgabe_ende' && tagKey(new Date(e.t)) === heute).reduce((s, e) => s + (e.sekunden || 0), 0);
}
// Abgeschickte Bildschirmzeit (neueste zuerst)
export function bzAnfragen(eintraege) {
  return eintraege.filter(e => e.typ === 'bildschirmzeit').slice().sort((a, b) => a.t < b.t ? 1 : -1);
}
// Heute verdiente Bildschirmzeit (Sekunden)
export function bzHeute(eintraege, heute = tagKey()) {
  return eintraege.filter(e => e.typ === 'aufgabe_ende' && e.bildschirm && tagKey(new Date(e.t)) === heute).reduce((s, e) => s + e.bildschirm, 0);
}

// Runensplitter-Einstellungen: Preise der neuen Spiele, Boni und von Hand freigeschaltete Spiele
export function splitterWerte(w, stand) {
  const st = (stand && stand.splitter) || {};
  const ok = (p) => Array.isArray(p) && p.length === SP.NEUE_SPIELE.length;
  return {
    preise: ok(w && w.preise) ? w.preise.slice() : ok(st.preise) ? st.preise.slice() : SP.PREISE_STANDARD.slice(),
    boni: (w && Array.isArray(w.boni) ? w.boni : []).map(b => ({ ...b })),
    frei: (w && Array.isArray(w.frei) ? w.frei : []).slice()
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
    werte: { thema: hauptThema(werte), paket: werte.paket, abweichungen: werte.abweichungen || {}, gewichte: P.gewichteNorm(werte.gewichte), basisVon: werte.basisVon, basisBis: werte.basisBis, rechnerAngebot: werte.rechnerAngebot, langeHinweise: [0, 1, 2, 3].includes(werte.langeHinweise) ? werte.langeHinweise : 1, spielzeit: spielzeitRegeln(werte.spielzeit), bildschirm: bzDatei(werte.bildschirm, tagKey(jetzt)), spielzeitTag: szDatei(werte.spielzeitTag, tagKey(jetzt)), genStufen,
      ...(Array.isArray(werte.pakete) ? { pakete: werte.pakete.map(paketEintragDatei), etappe_anzeigen: !!werte.etappe_anzeigen } : {}),
      gestaltung: werte.gestaltung === 'sternzeit' ? 'sternzeit' : 'schrein', umform_stufe: [1, 2, 3].includes(werte.umform_stufe) ? werte.umform_stufe : 3, feedback: werte.feedback === true, ...(werte.boegen_feedback ? { boegen_feedback: true } : {}), ...(werte.live ? { live: true } : {}), ...Object.fromEntries(BEDIENUNG.map(b => [b.k, typeof werte[b.k] === 'boolean' ? werte[b.k] : b.std])), ...(werte.ansicht_name ? { ansicht_name: werte.ansicht_name } : {}),
      uebungszeit: uzDatei(werte.uebungszeit, tagKey(jetzt)),
      ...(werte.freigaben && Object.keys(werte.freigaben).length ? { freigaben: { ...werte.freigaben } } : {}),
      // Wochenplan (Auftrag 24): schreibt nur der Kinder-Chat, darum immer aus der frisch gelesenen Datei übernehmen
      ...(alt && alt.werte && alt.werte.wochenplan ? { wochenplan: alt.werte.wochenplan } : {}),
      ...(eingriffeDatei(werte.eingriffe, jetzt).length ? { eingriffe: eingriffeDatei(werte.eingriffe, jetzt) } : {}),
      ...(werte.splitter ? { splitter: { preise: werte.splitter.preise, boni: werte.splitter.boni.slice(-50), frei: werte.splitter.frei } } : {}) }
  };
}

// Ein Paket beim Kind für die Datei: Rolle, Anteil, Etappe, nächste Etappe und eine Kopie des Inhalts (die Übungs-App liest keine Paket-Dateien)
export function paketEintragDatei(p) {
  const e = LP.eintragNorm(p);
  return { id: e.id, rolle: e.rolle, anteil: e.anteil, ...(e.etappe != null ? { etappe: e.etappe } : {}), ...(e.naechste ? { naechste: e.naechste } : {}), ...(e.etappe_mindest != null ? { etappe_mindest: e.etappe_mindest } : {}), ...(e.start ? { start: e.start } : {}), paket: e.paket };
}

// Paket wurde geändert: neue Gewichte für ein Kind, das dieses Paket nutzt (Abweichungen bleiben). null = nichts zu tun.
export function einstellungMitNeuemPaket(alt, paket, jetzt = new Date()) {
  const w = alt && alt.werte;
  const inListe = !!(w && Array.isArray(w.pakete) && w.pakete.some(p => p.id === paket.id));
  if (!w || (!inListe && (!w.paket || w.paket.id !== paket.id))) return null;
  let neu = { ...w };
  if (inListe) neu.pakete = w.pakete.map(p => p.id === paket.id ? paketEintragDatei({ ...p, paket: LP.paketInhalt(paket) }) : p);
  if (w.paket && w.paket.id === paket.id) {
    const abweichungen = w.abweichungen || abweichungenAus(paket.gewichte, w.gewichte);
    neu = { ...neu, paket: { id: paket.id, name: paket.name }, abweichungen, gewichte: gewichteMit(paket.gewichte, abweichungen) };
  }
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

// ---------- Wochenplan (Auftrag 24) ----------
// Eingriffe der Eltern: nur mit Ablaufdatum; abgelaufene bleiben 14 Tage stehen (für den Kinder-Chat), dann fallen sie weg
export function eingriffeDatei(liste, jetzt = new Date()) {
  const grenze = tagKey(new Date(jetzt.getTime() - 14 * 864e5));
  return W.eingriffeNorm(liste).filter(e => e.bis >= grenze);
}
// Plan gegen Ist aus den Lerndaten: Übungszeit (ms aus aufgabe_ende) je Art seit ab, zuletzt geübt je Thema, fällige Erinnerungen
export function wochenplanStand(werte, eintraege, heute = tagKey()) {
  const wp = W.wpNorm(werte && werte.wochenplan);
  if (!wp) return null;
  const pakete = (werte.pakete || []).filter(p => p && p.paket);
  const status = heute < wp.ab ? 'kommt' : heute > wp.bis ? 'abgelaufen' : 'laeuft';
  const ms = {}, n = {}, zuletzt = {};
  for (const e of eintraege || []) {
    if (e.typ !== 'aufgabe_ende' || !e.thema || !e.t) continue;
    const tag = tagKey(new Date(e.t));
    if (!zuletzt[e.thema] || zuletzt[e.thema] < tag) zuletzt[e.thema] = tag;
    if (tag >= wp.ab && tag <= wp.bis && e.ms > 0) { ms[e.thema] = (ms[e.thema] || 0) + Math.min(e.ms, 10 * 60000); n[e.thema] = (n[e.thema] || 0) + 1; }
  }
  const stichtag = status === 'abgelaufen' ? wp.bis : heute;
  const arten = W.wpArten(wp, pakete, werte.eingriffe, stichtag, werte.freigaben || {});
  const nGesamt = Object.values(n).reduce((s, v) => s + v, 0);
  const ist = W.wpIst(arten, ms).map(a => ({ ...a, n: a.themen.reduce((s, t) => s + (n[t] || 0), 0), istN: nGesamt ? a.themen.reduce((s, t) => s + (n[t] || 0), 0) / nGesamt * 100 : 0 }));
  const imPlan = new Set(arten.flatMap(a => a.themen));
  const sonstMs = Object.keys(ms).filter(t => !imPlan.has(t)).reduce((s, t) => s + ms[t], 0);
  const gesperrt = W.gesperrteThemen(wp, pakete, werte.eingriffe, stichtag, werte.freigaben || {});
  const motiv = (arten.find(a => a.motiv) || { themen: [] }).themen;
  const kand = new Set([...imPlan]);
  for (const p of pakete) for (const [t, g] of Object.entries(p.paket.gewichte || {})) if (g > 0) kand.add(t);
  const faellig = W.faellige(wp, zuletzt, heute, [...kand].filter(t => !motiv.includes(t)), pakete, gesperrt);
  // Erinnerungen mit eigener Frist und „zuletzt geübt“
  const erinnerung = Object.entries(wp.erinnerung).filter(([k]) => k !== 'standard').map(([k, tage]) => {
    const th = W.themenVon(k, pakete);
    const z = th.map(t => zuletzt[t]).filter(Boolean).sort().pop() || null;
    return { art: k, name: W.artName(k, pakete), themen: th, tage, zuletzt: z, faellig: th.some(t => faellig.some(f => f.thema === t)) };
  });
  return { wp, status, arten: ist, minuten: Object.values(ms).reduce((s, v) => s + v, 0) / 60000, sonstMin: sonstMs / 60000, aufgaben: nGesamt,
    zuletzt, faellig, erinnerung, standard: wp.erinnerung.standard || 0, gesperrt, wpGesperrt: wp.gesperrt,
    eingriffe: W.eingriffeNorm(werte.eingriffe), eingriffeAktiv: W.eingriffeAktiv(werte.eingriffe, heute),
    erinnerungen: (eintraege || []).filter(e => e.typ === 'erinnerung' && e.t && tagKey(new Date(e.t)) >= wp.ab) };
}

// ---------- Bögen und Bogen-Feedback (Auftrag 25, nur Kinder mit Schalter „boegen_feedback“) ----------
export const BOGEN_ERGEBNISSE = ['klappt', 'mit Hilfe', 'nicht verstanden', 'ausgelassen'];
export const BOGEN_CHIPS = ['Flüchtigkeitsfehler', '2. Versuch', 'Hinweisblatt benutzt', 'Taschenrechner', 'Rechenweg unklar', 'Text nicht verstanden', 'Brauchte Rückversicherung', 'motiviert', 'unmotiviert'];
// Bonus getrennt bewerten (Auftrag 27): Teile mit bonus: true in bogen.json
export const BOGEN_BONUS = ['klappt', 'mit Hilfe', 'nicht verstanden', 'ausgelassen', 'nicht versucht'];
// Am Anfang nur „Wer trägt ein?“ und „Anfang“, der Rest im Überblick am Ende (Auftrag 27)
export const BOGEN_ANFANG = ['von', 'anfang'];
export const BOGEN_ENDE = ['stimmung', 'hinweisblatt', 'dauer'];
export const BOGEN_ALLGEMEIN = [
  { k: 'von', titel: 'Wer trägt ein?', werte: ['Vater', 'Mutter'] },
  { k: 'anfang', titel: 'Anfang', werte: ['direkt los', 'kurz überredet', 'stark überredet'] },
  { k: 'stimmung', titel: 'Stimmung', werte: ['gut', 'geht', 'schwierig'] },
  { k: 'hinweisblatt', titel: 'Hinweisblatt benutzt?', werte: ['ja', 'nein', 'weiß nicht'] },
  { k: 'dauer', titel: 'Dauer ungefähr', werte: [15, 30, 45, 60], text: (v) => v === 60 ? '60+' : String(v), frei: true }
];
export function bogenNorm(b) {
  if (!b || b.format !== 'bogen-1' || !b.id || !Array.isArray(b.uebungen)) return null;
  return { ...b, uebungen: b.uebungen.filter(u => u && u.nr != null).map(u => {
    const bonus = (Array.isArray(u.teile) ? u.teile : []).filter(t => t && t.bonus === true).map(t => String(t.l || '')).filter(Boolean);
    return { ...u, nr: String(u.nr), ...(bonus.length ? { bonusTeile: bonus } : {}) };
  }) };
}
// Entwurf → Datei bogen-feedback-1. Übungen ohne Eintrag (klappt, keine Beobachtung, keine Notiz, kein Foto) fallen weg.
export function bogenFeedbackDatei(kind, id, e, jetzt = new Date()) {
  const uebungen = {};
  for (const [nr, x] of Object.entries(e.uebungen || {})) {
    const ergebnis = BOGEN_ERGEBNISSE.includes(x.ergebnis) ? x.ergebnis : 'klappt';
    const chips = (x.chips || []).filter(c => BOGEN_CHIPS.includes(c));
    const notiz = String(x.notiz || '').trim();
    const fotos = (x.fotos || []).map(f => typeof f === 'string' ? f : f.name).filter(Boolean);
    const bonus = x.bonus && BOGEN_BONUS.includes(x.bonus.ergebnis) ? { ergebnis: x.bonus.ergebnis, ...(String(x.bonus.notiz || '').trim() ? { notiz: String(x.bonus.notiz).trim() } : {}) } : null;
    if (ergebnis === 'klappt' && !chips.length && !notiz && !fotos.length && !bonus) continue;
    uebungen[nr] = { ergebnis, ...(chips.length ? { chips } : {}), ...(notiz ? { notiz } : {}), ...(fotos.length ? { fotos } : {}), ...(bonus ? { bonus } : {}) };
  }
  const off = -jetzt.getTimezoneOffset(), p = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const lokal = new Date(jetzt.getTime() + off * 60000).toISOString().slice(0, 19) + (off >= 0 ? '+' : '-') + p(off / 60) + ':' + p(off % 60);
  return {
    format: 'bogen-feedback-1', kind, bogen: id,
    ...(e.von ? { von: e.von } : {}), gemacht: e.gemacht || tagKey(jetzt), gespeichert: lokal,
    ...(e.anfang ? { anfang: e.anfang } : {}), ...(e.stimmung ? { stimmung: e.stimmung } : {}), ...(e.hinweisblatt ? { hinweisblatt: e.hinweisblatt } : {}), ...(e.dauer ? { dauer: e.dauer } : {}),
    ...(e.zeit && e.zeit.minuten > 0 ? { zeit: { quelle: e.zeit.quelle === 'knopf' ? 'knopf' : 'hand', ...(e.zeit.start ? { start: e.zeit.start } : {}), ...(e.zeit.ende ? { ende: e.zeit.ende } : {}), ...(e.zeit.pausen && e.zeit.pausen.length ? { pausen: e.zeit.pausen } : {}), minuten: e.zeit.minuten } } : {}),
    uebungen, ...(String(e.sonst || '').trim() ? { sonst: String(e.sonst).trim() } : {}), ...(e.frei ? { ohne_bogen: true } : {})
  };
}
// Gespeicherte Datei → Entwurf (zum Weiterbearbeiten)
export function bogenFeedbackEntwurf(f) {
  if (!f || f.format !== 'bogen-feedback-1') return null;
  const uebungen = {};
  for (const [nr, x] of Object.entries(f.uebungen || {})) uebungen[nr] = { ergebnis: x.ergebnis || 'klappt', chips: x.chips || [], notiz: x.notiz || '', fotos: (x.fotos || []).map(name => ({ name })), ...(x.bonus && x.bonus.ergebnis ? { bonus: { ergebnis: x.bonus.ergebnis, notiz: x.bonus.notiz || '' } } : {}) };
  return { von: f.von || '', gemacht: f.gemacht, anfang: f.anfang || '', stimmung: f.stimmung || '', hinweisblatt: f.hinweisblatt || '', dauer: f.dauer || null, ...(f.zeit ? { zeit: f.zeit } : {}), uebungen, sonst: f.sonst || '', gesehen: Object.keys(uebungen), frei: !!f.ohne_bogen };
}

// ---------- Hinweisblatt zum Ausdrucken (Auftrag 26) ----------
// daten/<name>/hinweisblatt/hinweisblatt.json (hinweisblatt-1) schreibt der Kinder-Chat.
// gedruckt.json (hinweisblatt-gedruckt-1) schreibt die Eltern-App: je Seite der Stand, der zuletzt gedruckt wurde.
const TAG = /^\d{4}-\d{2}-\d{2}$/;
export const HINWEIS_START = '2026-10-23'; // Stand, der beim ersten Start als gedruckt gilt
export function hinweisNorm(h) {
  if (!h || h.format !== 'hinweisblatt-1' || !Array.isArray(h.seiten)) return null;
  const verlauf = (Array.isArray(h.verlauf) ? h.verlauf : []).filter(v => v && TAG.test(v.datum || '') && Array.isArray(v.seiten)).map(v => ({ ...v, seiten: v.seiten.map(Number) }));
  const seiten = h.seiten.filter(s => s && Number.isInteger(+s.nr) && +s.nr > 0).map(s => ({ ...s, nr: +s.nr, geaendert: TAG.test(s.geaendert || '') ? s.geaendert : '' })).sort((a, b) => a.nr - b.nr);
  if (!seiten.length) return null;
  return { ...h, seiten, verlauf };
}
export function gedrucktStart(h, von = 'Eltern-App', am = '') {
  return { format: 'hinweisblatt-gedruckt-1', seiten: Object.fromEntries((h ? h.seiten : [1, 2, 3].map(nr => ({ nr }))).map(s => [String(s.nr), HINWEIS_START])), zuletzt: { von, am } };
}
export function gedrucktNorm(g) {
  if (!g || g.format !== 'hinweisblatt-gedruckt-1' || !g.seiten || typeof g.seiten !== 'object') return null;
  const seiten = {};
  for (const [k, v] of Object.entries(g.seiten)) if (TAG.test(v || '')) seiten[String(+k)] = v;
  return { format: g.format, seiten, zuletzt: g.zuletzt && typeof g.zuletzt === 'object' ? g.zuletzt : {} };
}
// Seiten, deren aktueller Stand nicht gedruckt ist
export function hinweisNeu(h, g) {
  if (!h) return [];
  const gs = (g && g.seiten) || {};
  return h.seiten.filter(s => s.geaendert && (gs[s.nr] || '') < s.geaendert);
}
// Ein Bogen braucht den Stand bis (bogen.hinweisblatt): Seiten mit einer Änderung nach dem gedruckten Stand und bis zu diesem Tag
export function hinweisFuerBogen(h, g, bis) {
  if (!h || !TAG.test(bis || '')) return [];
  const gs = (g && g.seiten) || {};
  return h.seiten.filter(s => {
    const tage = new Set([s.geaendert, ...h.verlauf.filter(v => v.seiten.includes(s.nr)).map(v => v.datum)].filter(Boolean));
    return [...tage].some(d => d > (gs[s.nr] || '') && d <= bis);
  });
}
// Haken: Seite nr ist mit ihrem aktuellen Stand gedruckt (an = false: zurück auf den alten Stand)
export function gedrucktSetzen(g, h, nr, an, von, am, alt) {
  const s = h && h.seiten.find(x => x.nr === +nr);
  const neu = gedrucktNorm(g) || gedrucktStart(h);
  if (!s) return neu;
  if (an) neu.seiten[String(s.nr)] = s.geaendert || neu.seiten[String(s.nr)];
  else if (alt && alt < (s.geaendert || '')) neu.seiten[String(s.nr)] = alt;
  neu.zuletzt = { von, am };
  return neu;
}

// „1. Versuch“ zählt nicht, wenn dieselbe Aufgabe nach einer gezeigten Lösung wiederkam (Auftrag 32)
export const erstZ = (ende) => !!ende && ende.ergebnis === 'erst' && !ende.gleiche_aufgabe;

// ---------- Bogen-Archiv, Deep Link, Formelübersicht (Auftrag 31) ----------
// Woche eines Bogens: Feld woche, sonst aus der id (w5t3b → 5), sonst 0
export function bogenWoche(id, b) {
  const w = b && Number.isInteger(+b.woche) && +b.woche > 0 ? +b.woche : 0;
  if (w) return w;
  const m = /^w(\d+)/i.exec(String(id || ''));
  return m ? +m[1] : 0;
}
// Liste [{id, …}] → [{woche, eintraege}] neueste Woche oben, in der Woche neuester Bogen oben (Datum, dann id)
export function bogenWochen(liste, boegen) {
  const gruppen = new Map();
  for (const x of liste || []) {
    const w = bogenWoche(x.id, boegen && boegen[x.id]);
    if (!gruppen.has(w)) gruppen.set(w, []);
    gruppen.get(w).push(x);
  }
  const datum = (x) => String((boegen && boegen[x.id] && boegen[x.id].datum) || '');
  return [...gruppen.entries()].sort((a, b) => (b[0] || -1) - (a[0] || -1))
    .map(([woche, l]) => ({ woche, eintraege: l.sort((a, b) => datum(b).localeCompare(datum(a)) || String(b.id).localeCompare(String(a.id), 'de', { numeric: true })) }));
}
// Hat der Bogen Lösungsbilder je Übung? (W2/W3 haben nur das Lösungs-PDF)
export const bogenHatBilder = (b, w) => !!(b && b.uebungen.some(u => u.bilder && u.bilder[w]));
// Deep Link auf einen Bogen: …/eltern/#bogen/<kind>/<id> (kind = Ordner unter daten/, id = Ordner unter boegen/)
const LINK_TEIL = /^[a-z0-9_-]+$/i, LINK_ID = /^[\w.-]+$/;
export function bogenLinkLesen(hash) {
  const m = /^#\/?bogen\/([^/]+)\/([^/?#]+)\/?$/.exec(String(hash || ''));
  if (!m) return null;
  const kind = decodeURIComponent(m[1]).toLowerCase(), id = decodeURIComponent(m[2]);
  return LINK_TEIL.test(kind) && LINK_ID.test(id) ? { kind, id } : null;
}
export const bogenLink = (basis, kind, id) => `${basis}#bogen/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
// daten/<name>/formelblatt/formelblatt.json (formelblatt-1) schreibt der Kinder-Chat, gedruckt.json (formelblatt-gedruckt-1) die Eltern-App
export function formelNorm(f) {
  if (!f || f.format !== 'formelblatt-1' || !Array.isArray(f.fassungen)) return null;
  const fassungen = f.fassungen.filter(x => x && typeof x.id === 'string' && LINK_ID.test(x.id))
    .map(x => ({ ...x, titel: x.titel || x.id, bilder: (Array.isArray(x.bilder) ? x.bilder : []).filter(p => typeof p === 'string'), geaendert: TAG.test(x.geaendert || '') ? x.geaendert : '' }));
  return fassungen.length ? { ...f, fassungen, verlauf: Array.isArray(f.verlauf) ? f.verlauf : [] } : null;
}
export function formelGedrucktNorm(g) {
  if (!g || g.format !== 'formelblatt-gedruckt-1' || !g.fassungen || typeof g.fassungen !== 'object') return null;
  const fassungen = {};
  for (const [k, v] of Object.entries(g.fassungen)) if (TAG.test(v || '')) fassungen[k] = v;
  return { format: g.format, fassungen, zuletzt: g.zuletzt && typeof g.zuletzt === 'object' ? g.zuletzt : {} };
}
// Fassungen, deren aktueller Stand nicht gedruckt ist (ohne gedruckt.json: alle)
export function formelNeu(f, g) {
  if (!f) return [];
  const gs = (g && g.fassungen) || {};
  return f.fassungen.filter(x => x.geaendert && (gs[x.id] || '') < x.geaendert);
}
// Haken: Fassung id ist mit ihrem aktuellen Stand gedruckt (an = false: zurück auf den alten Stand oder ungedruckt)
export function formelGedrucktSetzen(g, f, id, an, von, am, alt) {
  const x = f && f.fassungen.find(y => y.id === id);
  const neu = formelGedrucktNorm(g) || { format: 'formelblatt-gedruckt-1', fassungen: {}, zuletzt: {} };
  if (!x) return neu;
  if (an) neu.fassungen[id] = x.geaendert || jetztTag(am);
  else if (alt && alt < (x.geaendert || '')) neu.fassungen[id] = alt;
  else delete neu.fassungen[id];
  neu.zuletzt = { von, am };
  return neu;
}
const jetztTag = (am) => TAG.test(String(am || '').slice(0, 10)) ? String(am).slice(0, 10) : tagKey(new Date());

// ---------- Berichte (Auftrag 28): daten/<name>/berichte/index.json, Format berichte-1 ----------
export function berichteNorm(x) {
  if (!x || x.format !== 'berichte-1' || !Array.isArray(x.berichte)) return [];
  const TAG = /^\d{4}-\d{2}-\d{2}$/;
  return x.berichte.filter(b => b && typeof b.id === 'string' && /^[\w.-]+$/.test(b.id) && typeof b.datei === 'string' && /^[\w.-]+\.html$/.test(b.datei))
    .map(b => ({ ...b, zeitraum: Array.isArray(b.zeitraum) && TAG.test(b.zeitraum[0] || '') && TAG.test(b.zeitraum[1] || '') ? b.zeitraum : null,
      kommentare: Number.isInteger(b.kommentare) && b.kommentare > 0 ? b.kommentare : 0,
      // Auftrag 29: art bericht (Rückblick) oder plan (Wochenplan); alte Einträge ohne art gelten als plan
      art: b.art === 'bericht' ? 'bericht' : 'plan',
      woche: Number.isInteger(b.woche) ? b.woche : null,
      partner: typeof b.partner === 'string' && b.partner ? b.partner : null }));
}
const brAb = (b) => (b.zeitraum && b.zeitraum[0]) || b.datum || '';
// Neueste zuerst (nach Beginn des Zeitraums, sonst Datum)
export function berichteSortiert(l) { return l.slice().sort((a, b) => brAb(b).localeCompare(brAb(a)) || String(b.datum || '').localeCompare(String(a.datum || ''))); }
// Aktuell: der Bericht, dessen Zeitraum heute läuft; sonst der nächste kommende; sonst der neueste
export function berichtAktuell(l, heute) {
  const s = berichteSortiert(l);
  return s.find(b => b.zeitraum && b.zeitraum[0] <= heute && heute <= b.zeitraum[1])
    || s.filter(b => b.zeitraum && b.zeitraum[0] > heute).sort((a, b) => a.zeitraum[0].localeCompare(b.zeitraum[0]))[0]
    || s[0] || null;
}
// Nach Monat gruppieren (Beginn des Zeitraums), neueste zuerst: [{ monat: 'JJJJ-MM', liste }]
export function berichteNachMonat(l) {
  const out = [];
  for (const b of berichteSortiert(l)) {
    const m = brAb(b).slice(0, 7);
    if (!out.length || out[out.length - 1].monat !== m) out.push({ monat: m, liste: [] });
    out[out.length - 1].liste.push(b);
  }
  return out;
}
// Aktueller Wochenplan (Auftrag 29, Wunsch des Vaters): liegt schon ein Plan für eine kommende Woche vor, gilt er
// ab sofort (der Plan entsteht sonntags); sonst der Plan, dessen Zeitraum heute läuft; sonst der neueste.
export function planAktuell(l, heute) {
  const s = berichteSortiert(l);
  return s.filter(b => b.zeitraum && b.zeitraum[0] > heute).sort((a, b) => a.zeitraum[0].localeCompare(b.zeitraum[0]))[0]
    || s.find(b => b.zeitraum && b.zeitraum[0] <= heute && heute <= b.zeitraum[1])
    || s[0] || null;
}

// ---------- Live-Anzeige: daten/<name>/live.json (live-1) ----------
// Zustand aus live.json und dem letzten Lebenszeichen der Lerndaten. offen = vor höchstens grenzeMin Minuten etwas gehört.
export function liveStand(live, eintraege = [], jetzt = Date.now(), grenzeMin = 15) {
  if (!live || live.format !== 'live-1' || !['uebung', 'spiel', 'weg'].includes(live.zustand) || !live.seit) return null;
  const seit = Date.parse(live.seit);
  if (!Number.isFinite(seit)) return null;
  const nach = eintraege.filter(e => e.t && Date.parse(e.t) >= seit && Date.parse(e.t) <= jetzt + 60000);
  const letzte = Math.max(seit, ...nach.map(e => Date.parse(e.t)).filter(Number.isFinite));
  const aktiv = live.zustand !== 'weg' && jetzt - letzte <= grenzeMin * 60000;
  const heute = tagKey(new Date(jetzt));
  const ende = eintraege.filter(e => e.typ === 'aufgabe_ende' && tagKey(new Date(e.t)) === heute);
  const starts = nach.filter(e => e.typ === 'aufgabe_start');
  return { zustand: live.zustand, aktiv, seit, letzte, thema: (starts.length ? starts[starts.length - 1].thema : live.thema) || null,
    spiel: live.spiel || null, zweck: live.zweck || null,
    heute: { aufgaben: ende.length, erst: ende.filter(e => erstZ(e)).length },
    seitStart: nach.filter(e => e.typ === 'aufgabe_ende').length };
}

// ---------- Bögen auf der Übersicht, Übungszeit App/Bogen, Zeit messen (Auftrag 34) ----------
// Zeilen des Lernplans (bogen.json → uebungen[].row) → Themen der App
export const ROW_THEMEN = {
  einmal: ['einmaleins'], minus: ['minus-zahlen'], mal10: ['mal-10'], prozent: ['prozent'], rabatt: ['rabatt', 'neuer-preis'],
  zyl: ['zylinder'], z1: ['zylinder'], z2: ['zylinder'], z3: ['zylinder'], z4: ['zylinder'], zw: ['zylinder'],
  runden: ['runden'], potenz: ['potenzen'], reihen: ['reihenfolge'], bruch: ['bruch-bild', 'zuordnung'], bw: ['bruch-bild'], kugel: ['kugel'],
  kreis: ['kreisdiagramm'], formel: ['prozent-formel'], bauk: ['prozent-baukasten'], kp: ['kegel', 'pyramide'], k1: ['kegel', 'pyramide'], k2: ['kegel', 'pyramide']
};
export const PAPIER_FAKTOR_START = 2.0;
const AUFGABE_MAX_MS = 10 * 60 * 1000;
// Montag bis Sonntag der Woche von tag
export function wocheVon(tag) {
  const d = new Date(tag + 'T12:00:00'), wt = (d.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() - wt + i); return tagKey(x); });
}
// App-Zeit je Tag in Minuten (je Aufgabe höchstens 10 Min.)
export function appMinutenJeTag(aufgaben) {
  const t = {};
  for (const r of aufgaben || []) if (r.ende) t[r.tag] = (t[r.tag] || 0) + Math.min(r.ende.ms || 0, AUFGABE_MAX_MS) / 60000;
  return t;
}
// Teilaufgaben einer App-Aufgabe (Zahl der Felder)
export function teileVon(r, a) {
  if (r && r.start && Array.isArray(r.start.teile) && r.start.teile.length) return r.start.teile.filter(Boolean).length || 1;
  if (a) {
    if (Array.isArray(a.fragen)) return a.fragen.length || 1;
    if (Array.isArray(a.schritte)) return a.schritte.filter(s => s && s.wert != null).length || 1;
    if (Array.isArray(a.gruppen)) return a.gruppen.length || 1;
  }
  return 1;
}
const median = (l) => { if (!l.length) return null; const s = l.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// App-Minuten je Teilaufgabe: Median der letzten 14 Tage je Thema und über alle (ohne „Lösung gezeigt“ und gleiche Aufgabe)
export function appJeTeil(aufgaben, pool, bis, tage = 14) {
  const ab = (() => { const d = new Date(bis + 'T12:00:00'); d.setDate(d.getDate() - (tage - 1)); return tagKey(d); })();
  const je = {}, alle = [];
  for (const r of aufgaben || []) {
    if (!r.ende || r.tag < ab || r.tag > bis || r.ende.ergebnis === 'loesung' || r.ende.gleiche_aufgabe) continue;
    const v = Math.min(r.ende.ms || 0, AUFGABE_MAX_MS) / 60000 / teileVon(r, aufgabeVon(r, pool));
    if (!(v > 0)) continue;
    (je[r.thema] || (je[r.thema] = [])).push(v); alle.push(v);
  }
  return { je: Object.fromEntries(Object.entries(je).map(([k, l]) => [k, median(l)])), alle: median(alle) };
}
// Schätzung eines Bogens ohne Papier-Faktor (Minuten): je Übung Teilaufgaben × App-Minuten je Teilaufgabe des Themas
export function bogenRoh(b, fb, jt) {
  if (!b) return null;
  let s = 0;
  for (const u of b.uebungen || []) {
    const erg = fb && fb.uebungen && fb.uebungen[u.nr] && fb.uebungen[u.nr].ergebnis;
    if (erg === 'ausgelassen') continue;
    const teile = Array.isArray(u.teile) && u.teile.length ? u.teile.length : 1;
    const th = [...new Set((Array.isArray(u.row) ? u.row : u.row ? [u.row] : []).flatMap(r => ROW_THEMEN[r] || []))];
    const werte = th.map(t => jt.je[t]).filter(v => v > 0);
    const m = werte.length ? werte.reduce((x, y) => x + y, 0) / werte.length : jt.alle;
    if (m > 0) s += teile * m;
  }
  return s;
}
// Papier-Faktor: Mittel aus gemessen : Schätzung über Bögen mit gemessener oder eingetragener Zeit, ab 2 Bögen, sonst 2,0
export function papierFaktor(paare) {
  const l = (paare || []).filter(p => p.gemessen > 0 && p.roh > 0).map(p => p.gemessen / p.roh);
  return l.length >= 2 ? Math.round(l.reduce((x, y) => x + y, 0) / l.length * 10) / 10 : PAPIER_FAKTOR_START;
}
export const auf5 = (m) => Math.max(5, Math.round(m / 5) * 5);
// Zeitmessung (bogen-feedback/<id>.zeit.json, Format bogen-zeit-1): Minuten ohne Pausen
const ms = (t) => new Date(t).getTime();
export function zeitMinuten(z, jetzt = Date.now()) {
  if (!z || !z.start) return null;
  const ende = z.ende ? ms(z.ende) : jetzt;
  const pause = (z.pausen || []).reduce((s, [a, b]) => s + Math.max(0, (b ? ms(b) : ende) - ms(a)), 0);
  return Math.max(0, Math.round((ende - ms(z.start) - pause) / 60000));
}
export const zeitPausiert = (z) => !!(z && z.laeuft && (z.pausen || []).some(p => !p[1]));
export function zeitNorm(z) {
  if (!z || z.format !== 'bogen-zeit-1' || !z.start) return null;
  return { ...z, pausen: Array.isArray(z.pausen) ? z.pausen.filter(p => Array.isArray(p) && p[0]) : [] };
}
// Gemessene oder eingetragene Bogen-Zeit aus dem Feedback: { minuten, quelle } oder null
export function bogenZeitAusFeedback(fb) {
  if (!fb) return null;
  if (fb.zeit && fb.zeit.minuten > 0) return { minuten: fb.zeit.minuten, quelle: fb.zeit.quelle === 'knopf' ? 'knopf' : 'hand' };
  if (fb.dauer > 0) return { minuten: fb.dauer, quelle: 'hand' };
  return null;
}
// Ampel je Übung aus dem Feedback (Übungen ohne Eintrag: klappt)
export const AMPEL = { 'klappt': 'gruen', 'mit Hilfe': 'gelb', 'nicht verstanden': 'rot', 'ausgelassen': 'grau', 'nicht versucht': 'grau' };
export function bogenAmpel(b, fb) {
  return (b ? b.uebungen : []).map(u => {
    const x = fb && fb.uebungen && fb.uebungen[u.nr];
    return { nr: u.nr, titel: u.titel || '', ergebnis: fb ? (x && x.ergebnis) || 'klappt' : null, bonus: x && x.bonus ? x.bonus.ergebnis : (u.bonusTeile ? (fb ? 'offen' : null) : null), notiz: (x && x.notiz) || '' };
  });
}
