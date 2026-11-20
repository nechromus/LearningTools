// Eltern-App, Reiter „Lesen“ (Auftrag 59 Schritt 5, Variante C): Auswertung des Lese-Protokolls ohne DOM (testbar mit node).
// Quelle: daten/<name>/lesen/<geraet>/<tag>.json (Ereignisse lese_* der Lese-App „Archiv der Welten“).

// Namen der Fragetypen (Lernpfad des Lese-Chats). Neue Typen zeigt die App mit ihrer Kennung.
export const TYP_NAMEN = {
  A1: 'Mit anderen Worten wiederfinden', A2: 'Die gesuchte Angabe finden', A3: 'Auf kleine Wörter achten', A4: 'Schwierige Wörter nachschlagen',
  B1: 'Reihenfolge', B2: 'Ursache und Folge', B3: 'Wer oder was ist gemeint?', C1: 'Schlussfolgern'
};
export const typName = (t) => TYP_NAMEN[t] || t;
export const ANTWORT_TEXT = { gleich: 'Mehr davon', art: 'Andere Geschichte derselben Art', anders: 'Lieber etwas ganz anderes', weiss_nicht: 'Weiß nicht' };

// eintraege: Ereignisse der Lese-App (mit geraet), beliebig sortiert. ab: erster Tag (JJJJ-MM-TT, lokal) oder null.
export function leseAuswertung(eintraege, { ab = null, bis = null, tagVon = (t) => String(t).slice(0, 10) } = {}) {
  const liste = (eintraege || []).filter(e => e && e.t && String(e.typ || '').startsWith('lese_') && (!ab || tagVon(e.t) >= ab) && (!bis || tagVon(e.t) <= bis))
    .sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
  const r = { karten: 0, folge: { n: 0, voll: 0 }, ergebnis: { voll: 0, hinweis: 0, leiter: 0, aufloesung: 0 }, lohnSek: 0, sekunden: 0, schnell: 0, ersteVersuche: 0, ersteSchnell: 0,
    typen: {}, stufen: {}, stories: {}, nachgeschlagen: {}, zurueck: 0, wuensche: [], tage: {}, letzte: null, falsch: {}, falschN: 0, tagSchnell: {} };
  const ts = (e) => { const k = tagVon(e.t); return r.tagSchnell[k] || (r.tagSchnell[k] = { erste: 0, schnell: 0, stopp: 0 }); };
  const start = {};                         // geraet|karte → lese_karte_start
  for (const e of liste) {
    const k = `${e.geraet || ''}|${e.karte}`;
    switch (e.typ) {
      case 'lese_karte_start': start[k] = e; break; // Fragetyp in `fragetyp` (seit 0.5.0; `typ` ist der Name des Ereignisses)
      case 'lese_versuch':
        if (e.versuch === 1) { r.ersteVersuche++; const d = ts(e); d.erste++; if (e.ms < 3000) { r.ersteSchnell++; d.schnell++; } }
        if (e.richtig === false) { const ft = e.fehlertyp || 'ohne Typ'; r.falsch[ft] = (r.falsch[ft] || 0) + 1; r.falschN++; }
        break;
      case 'lese_lesestopp': r.schnell++; ts(e).stopp++; break;
      case 'lese_nachschlagen': r.nachgeschlagen[e.wort] = (r.nachgeschlagen[e.wort] || 0) + 1; break;
      case 'lese_zurueckgelegt': r.zurueck++; break;
      case 'lese_story_feedback': r.wuensche.push({ t: e.t, story: e.story, antwort: e.antwort, knopf: e.knopf || ANTWORT_TEXT[e.antwort] || e.antwort, gelesen: e.gelesen, folgen: e.folgen }); break;
      case 'lese_karte_ende': {
        const s = start[k] || {};
        r.karten++;
        if (s.frage_im_text > 1) { r.folge.n++; if (e.ergebnis === 'voll') r.folge.voll++; }
        if (e.ergebnis in r.ergebnis) r.ergebnis[e.ergebnis]++;
        r.lohnSek += e.lohn || 0; r.sekunden += e.sekunden || 0;
        const tag = tagVon(e.t), d = r.tage[tag] || (r.tage[tag] = { karten: 0, voll: 0, lohnSek: 0 });
        d.karten++; d.lohnSek += e.lohn || 0; if (e.ergebnis === 'voll') d.voll++;
        if (s.fragetyp) {
          const ty = r.typen[s.fragetyp] || (r.typen[s.fragetyp] = { typ: s.fragetyp, name: typName(s.fragetyp), n: 0, voll: 0, belegErst: 0, belegN: 0, stufe: 1, geruest: 1, schritt: null, auf: 0, ab: 0 });
          if (e.typ_schritt) ty.schritt = e.typ_schritt;
          if (e.typ_stufe > 0) ty.auf++; else if (e.typ_stufe < 0) ty.ab++;
          ty.n++; if (e.ergebnis === 'voll') ty.voll++;
          if (e.beleg_erst === true || e.beleg_erst === false) { ty.belegN++; if (e.beleg_erst) ty.belegErst++; }
          ty.stufe = s.stufe || ty.stufe; ty.geruest = s.geruest || ty.geruest;
        }
        // Je Fragestufe, sichere Karten und Eingewöhnung getrennt (Auftrag 63)
        if (s.stufe) {
          // Folgefragen (Auftrag 64) zuerst: der Text ist gerade gelesen, das macht sie leichter
          const g = s.frage_im_text > 1 ? 'folge' : s.sicher ? 'sicher' : s.eingewoehnung ? 'ein' : 'normal';
          const z = (r.stufen[s.stufe] || (r.stufen[s.stufe] = {}))[g] || (r.stufen[s.stufe][g] = { n: 0, voll: 0 });
          z.n++; if (e.ergebnis === 'voll') z.voll++;
        }
        if (s.story) {
          const st = r.stories[s.story] || (r.stories[s.story] = { story: s.story, karten: 0, folge: 0 });
          st.karten++; st.folge = Math.max(st.folge, s.beat || 0);
        }
        r.letzte = e.t;
        break;
      }
    }
  }
  r.wuensche.reverse();
  return r;
}

// ---------- Lese-Verlauf (Auftrag 66): Tage und Karten ----------
// Jede Karte mit allem, was dazu im Protokoll steht. Schlüssel: Gerät + Kartennummer (die Lese-App zählt je Gerät hoch).
// Abgebrochene Karten (lese_karte_abbruch, seit 0.9.0) stehen mit `abbruch`; Karten ohne Ende und ohne Abbruch
// (vor 0.9.0 oder noch offen) mit `offen: true`.
export function leseVerlauf(eintraege, { tagVon = (t) => String(t).slice(0, 10) } = {}) {
  const liste = (eintraege || []).filter(e => e && e.t && String(e.typ || '').startsWith('lese_'))
    .sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
  const karten = {}, reihe = [];
  const karte = (e) => karten[`${e.geraet || ''}|${e.karte}`];
  for (const e of liste) {
    if (e.typ === 'lese_karte_start') {
      const k = { id: `${e.geraet || ''}-${e.karte}`, geraet: e.geraet || '', nr: e.karte, start: e, t: e.t, tag: tagVon(e.t), frage: e.frage, text: e.text, story: e.story,
        versuche: [], zf: [], beleg: [], leiter: [], nachgeschlagen: [], hintergrundMs: 0, lesestopp: 0, aufloesung: false, zurueckgelegt: false, wiederkehr: null, ende: null, abbruch: null };
      karten[`${e.geraet || ''}|${e.karte}`] = k; reihe.push(k);
      continue;
    }
    if (e.typ === 'lese_wiederkehr') { const k = reihe.filter(x => x.frage === e.frage && x.geraet === (e.geraet || '')).pop(); if (k) k.wiederkehr = e; continue; }
    const k = e.karte != null ? karte(e) : null;
    if (!k) continue;
    switch (e.typ) {
      case 'lese_versuch': k.versuche.push(e); break;
      case 'lese_zf': k.zf.push(e); break;
      case 'lese_beleg': k.beleg.push(e); break;
      case 'lese_leiter': k.leiter.push(e.stufe); break;
      case 'lese_lesestopp': k.lesestopp++; break;
      case 'lese_aufloesung': k.aufloesung = true; break;
      case 'lese_nachschlagen': k.nachgeschlagen.push(e.wort); break;
      case 'lese_hintergrund': k.hintergrundMs += e.ms || 0; break;
      case 'lese_zurueckgelegt': k.zurueckgelegt = true; break;
      case 'lese_karte_ende': k.ende = e; break;
      case 'lese_karte_abbruch': k.abbruch = e; break;
    }
  }
  const tage = {};
  for (const k of reihe) {
    k.offen = !k.ende && !k.abbruch;
    k.ergebnis = k.ende ? k.ende.ergebnis : k.abbruch ? 'abbruch' : 'offen';
    k.sekunden = k.ende ? k.ende.sekunden || 0 : k.abbruch ? k.abbruch.sekunden || 0 : 0;
    const d = tage[k.tag] || (tage[k.tag] = { tag: k.tag, karten: [], fertig: 0, ergebnis: { voll: 0, hinweis: 0, leiter: 0, aufloesung: 0 }, abbruch: 0, offen: 0,
      lohnSek: 0, sekunden: 0, ersteVersuche: 0, ersteSchnell: 0, lesestopp: 0, falsch: {}, falschN: 0 });
    d.karten.push(k);
    if (k.ende) { d.fertig++; if (k.ende.ergebnis in d.ergebnis) d.ergebnis[k.ende.ergebnis]++; d.lohnSek += k.ende.lohn || 0; }
    else if (k.abbruch) d.abbruch++; else d.offen++;
    d.sekunden += k.sekunden;
    d.lesestopp += k.lesestopp;
    for (const v of k.versuche) {
      if (v.versuch === 1) { d.ersteVersuche++; if (v.ms < 3000) d.ersteSchnell++; }
      if (!v.richtig) { const ft = v.fehlertyp || 'ohne Typ'; d.falsch[ft] = (d.falsch[ft] || 0) + 1; d.falschN++; }
    }
  }
  return { karten: reihe, tage: Object.values(tage).sort((a, b) => a.tag < b.tag ? 1 : -1) };
}

// Lese-Minuten je Tag (Karten: Ende oder Abbruch; Sekunden je Karte sind schon gedeckelt)
export function leseMinutenJeTag(verlauf) {
  const r = {};
  for (const d of (verlauf && verlauf.tage) || []) r[d.tag] = d.sekunden / 60;
  return r;
}

// Mathe-Schnitt der 7 Tage vor dem ersten Lesetag (Minuten am Tag, Tage ohne Übung zählen mit 0). null ohne Lesetag
// oder ohne Mathe-Daten aus dieser Woche.
export function matheSchnittVorLesen(matheMin, ersterLesetag, tageDavor) {
  if (!ersterLesetag || !tageDavor || !tageDavor.length) return null;
  const wo = tageDavor.filter(t => t < ersterLesetag).slice(-7);
  if (wo.length < 7 || !wo.some(t => matheMin[t])) return null;
  return wo.reduce((s, t) => s + (matheMin[t] || 0), 0) / 7;
}

// Antwort-Wortlaut zu einer Kennung r#/f# (Frage-Datei aus dem Inhalt); null, wenn unbekannt
export function antwortText(q, id) {
  if (!q || !id) return null;
  const m = /^([rf])(\d+)$/.exec(id); if (!m) return null;
  const i = Number(m[2]);
  return m[1] === 'r' ? (q.richtig || [])[i] ?? null : ((q.falsch || [])[i] || {}).t ?? null;
}

// ---------- Markierungen (Auftrag 66, Abschnitt 3 „muss“) ----------
// Kurze Sätze ohne Wertung. Startwerte aus 66: Raten über 30 % der 1. Versuche an einem Tag (ab 3 Antworten);
// Lesen verdrängt Mathe: an 3 der letzten 7 Tage Mathe unter 70 % des Schnitts vor dem Lesen, an diesen Tagen wurde gelesen;
// Fragetyp hakt: 2 Abstiege in 7 Tagen oder unter 40 % gleich richtig bei mindestens 6 Karten.
export const MARKER = { raten: 0.3, ratenMin: 3, matheAnteil: 0.7, matheTage: 3, abstiege: 2, typQuote: 0.4, typMin: 6 };
export function leseMarker({ woche, tage7 = [], heute = null, matheMin = {}, leseMin = {}, schnitt = null } = {}) {
  const m = [];
  const pzt = (a, b) => Math.round(a / b * 100);
  // 1. Schnelles Raten: der jüngste Tag der Woche, an dem es zutrifft
  for (const t of [...tage7].reverse()) {
    const d = woche && woche.tagSchnell[t];
    if (d && d.erste >= MARKER.ratenMin && d.schnell / d.erste > MARKER.raten) {
      m.push({ art: 'raten', tag: t, text: `Viele schnelle Antworten ${t === heute ? 'heute' : 'am ' + t.slice(8, 10).replace(/^0/, '') + '.' + t.slice(5, 7).replace(/^0/, '') + '.'} (${pzt(d.schnell, d.erste)} %).` });
      break;
    }
  }
  // 2. Lesen verdrängt Mathe
  if (schnitt) {
    const tage = tage7.filter(t => t !== heute && (matheMin[t] || 0) < MARKER.matheAnteil * schnitt && (leseMin[t] || 0) > 0);
    if (tage.length >= MARKER.matheTage) m.push({ art: 'mathe', tage, text: `An ${tage.length} Tagen weniger Mathe als vor dem Lesen (unter ${Math.round(MARKER.matheAnteil * schnitt)} Min.), an diesen Tagen wurde gelesen.` });
  }
  // 3. Ein Fragetyp hakt
  for (const ty of Object.values((woche && woche.typen) || {})) {
    if (ty.ab >= MARKER.abstiege) m.push({ art: 'typ', typ: ty.typ, text: `„${ty.name}“ ist in 7 Tagen ${ty.ab}-mal eine Stufe tiefer gegangen.` });
    else if (ty.n >= MARKER.typMin && ty.voll / ty.n < MARKER.typQuote) m.push({ art: 'typ', typ: ty.typ, text: `„${ty.name}“ ist nur bei ${pzt(ty.voll, ty.n)} % der Karten gleich richtig (${ty.voll} von ${ty.n}).` });
  }
  return m;
}
