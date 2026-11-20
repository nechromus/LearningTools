// Eltern-App, Reiter „Lesen“ (Auftrag 59 Schritt 5, Variante C): Auswertung des Lese-Protokolls ohne DOM (testbar mit node).
// Quelle: daten/<name>/lesen/<geraet>/<tag>.json (Ereignisse lese_* der Lese-App „Archiv der Welten“).

// Namen der Fragetypen (Lernpfad des Lese-Chats). Neue Typen zeigt die App mit ihrer Kennung.
export const TYP_NAMEN = {
  A1: 'Mit anderen Worten wiederfinden', A2: 'Die gesuchte Angabe finden', A3: 'Auf kleine Wörter achten', A4: 'Schwierige Wörter nachschlagen',
  B1: 'Reihenfolge', B2: 'Ursache und Folge', C1: 'Schlussfolgern'
};
export const typName = (t) => TYP_NAMEN[t] || t;
export const ANTWORT_TEXT = { gleich: 'Mehr davon', art: 'Andere Geschichte derselben Art', anders: 'Lieber etwas ganz anderes', weiss_nicht: 'Weiß nicht' };

// eintraege: Ereignisse der Lese-App (mit geraet), beliebig sortiert. ab: erster Tag (JJJJ-MM-TT, lokal) oder null.
export function leseAuswertung(eintraege, { ab = null, tagVon = (t) => String(t).slice(0, 10) } = {}) {
  const liste = (eintraege || []).filter(e => e && e.t && String(e.typ || '').startsWith('lese_') && (!ab || tagVon(e.t) >= ab))
    .sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
  const r = { karten: 0, folge: { n: 0, voll: 0 }, ergebnis: { voll: 0, hinweis: 0, leiter: 0, aufloesung: 0 }, lohnSek: 0, sekunden: 0, schnell: 0, ersteVersuche: 0, ersteSchnell: 0,
    typen: {}, stufen: {}, stories: {}, nachgeschlagen: {}, zurueck: 0, wuensche: [], tage: {}, letzte: null };
  const start = {};                         // geraet|karte → lese_karte_start
  for (const e of liste) {
    const k = `${e.geraet || ''}|${e.karte}`;
    switch (e.typ) {
      case 'lese_karte_start': start[k] = e; break; // Fragetyp in `fragetyp` (seit 0.5.0; `typ` ist der Name des Ereignisses)
      case 'lese_versuch':
        if (e.versuch === 1) { r.ersteVersuche++; if (e.ms < 3000) r.ersteSchnell++; }
        break;
      case 'lese_lesestopp': r.schnell++; break;
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
          const ty = r.typen[s.fragetyp] || (r.typen[s.fragetyp] = { typ: s.fragetyp, name: typName(s.fragetyp), n: 0, voll: 0, belegErst: 0, belegN: 0, stufe: 1, geruest: 1 });
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
