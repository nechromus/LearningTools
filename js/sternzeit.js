// Gestaltung „Logbuch Sternzeit“: Logbuch, Wissensarchiv und Wissenspunkte (Auftrag 13). Reine Logik ohne DOM.
import { etappeOffen } from './lernplan.js';

// Logbuch-Eintrag einer Etappe (nur geschriebene Einträge)
export function eintragVon(paket, nr, logbuch) {
  const e = ((paket && paket.etappen) || [])[nr - 1];
  if (!e || !e.logbuch) return null;
  const lb = (logbuch || []).find(x => x.id === e.logbuch);
  return lb && Array.isArray(lb.absaetze) && lb.absaetze.length ? lb : null;
}

export const logbuchVon = (x) => ({ frei: { ...((x && x.frei) || {}) }, gelesen: [...((x && x.gelesen) || [])] });

// Einträge aller erreichten Etappen freischalten. Gibt die neu freigeschalteten zurück.
// pakete: S.pakete, logbuch: Einträge aus data/logbuch.json, tag: 'JJJJ-MM-TT', sz: Sternzeit (Zahl)
export function freischalten(stand, pakete, logbuch, tag, sz) {
  const neu = [];
  for (const p of pakete || []) {
    const et = (p.paket && p.paket.etappen) || [];
    for (let nr = 1; nr <= Math.min(p.etappe || 0, et.length); nr++) {
      const lb = eintragVon(p.paket, nr, logbuch);
      if (!lb || stand.frei[lb.id]) continue;
      stand.frei[lb.id] = { tag, sternzeit: sz, paket: p.id, etappe: nr };
      neu.push(lb.id);
    }
  }
  return neu;
}
// Freigeschaltet, aber noch nicht gelesen (in der Reihenfolge der Freischaltung)
export const ungelesen = (stand) => Object.keys(stand.frei).filter(id => !stand.gelesen.includes(id));

// Text mit der Sternzeit des Freischalt-Tages
export const mitSternzeit = (text, szText) => String(text).replace(/\{sternzeit\}/g, szText);

// Liste für den Bereich „Logbuch“: je Paket alle Etappen, freigeschaltet, offen oder „kommt bald“
export function logbuchListe(pakete, logbuch, stand) {
  return (pakete || []).filter(p => p.paket && (p.paket.etappen || []).length).map(p => ({
    paket: p.id, name: p.paket.name,
    etappen: p.paket.etappen.map((e, i) => {
      const nr = i + 1;
      const lb = eintragVon(p.paket, nr, logbuch);
      const frei = lb && stand.frei[lb.id] ? stand.frei[lb.id] : null;
      return { nr, name: e.name, eintrag: frei ? lb : null, frei, bald: !etappeOffen(p.paket, nr, logbuch) };
    })
  }));
}

// ---------- Wissenspunkte ----------
export const wissenVon = (w) => ({ stand: Math.max(0, Number(w && w.stand) || 0), verlauf: Array.isArray(w && w.verlauf) ? w.verlauf.slice(-200) : [] });
export function wissenPlus(w, n, grund, id, t = new Date().toISOString()) {
  if (!(n > 0)) return w;
  w.stand += n;
  w.verlauf = [...w.verlauf, { t, n, grund, ...(id ? { id } : {}) }].slice(-200);
  return w;
}

// ---------- Wissensarchiv ----------
export const archivVon = (a) => ({ gekauft: [...((a && a.gekauft) || [])] });
// Sichtbar ab Paket und Etappe (das Paket muss beim Kind sein und die Etappe erreicht)
export function archivSichtbar(eintrag, pakete) {
  const ab = eintrag && eintrag.ab;
  if (!ab) return true;
  const p = (pakete || []).find(x => x.id === ab.paket);
  return !!(p && (p.etappe || 0) >= (ab.etappe || 1));
}
// Kaufen mit Wissenspunkten. Gibt true zurück, wenn es geklappt hat.
export function kaufen(wissen, archiv, eintrag, t) {
  if (!eintrag || archiv.gekauft.includes(eintrag.id) || wissen.stand < eintrag.kosten) return false;
  wissen.stand -= eintrag.kosten;
  wissen.verlauf = [...wissen.verlauf, { t: t || new Date().toISOString(), n: -eintrag.kosten, grund: 'archiv', id: eintrag.id }].slice(-200);
  archiv.gekauft.push(eintrag.id);
  return true;
}
