// Runengruft freischalten: Ein alter Kobold bietet das Abenteuer für alle Runensplitter an.
// Danach kostet jede weitere Etage einmal Runensplitter (wie die Spiele). Reine Logik, testbar mit node.
import { gutschreiben } from './splitter.js';

export const KOBOLD_AB = 300;                       // ab diesem Kontostand erscheint der Kobold
export const ETAGEN_PREISE = [0, 450, 500, 550, 600]; // Etage 1 gibt es beim Kobold, danach je ein Preis
export const ETAGEN_FERTIG = 5;                     // so viele Etagen gibt es schon

// Stand im Splitter-Objekt ergänzen (ältere Spielstände)
export function rgVon(sp) {
  const rg = { kobold: false, frei: [], gegeben: 0, preise: null, ...(sp.runengruft || {}) };
  sp.runengruft = rg;
  return rg;
}
export const preiseVon = (sp) => {
  const p = rgVon(sp).preise;
  return Array.isArray(p) && p.length === ETAGEN_PREISE.length && p.every(n => Number.isInteger(n) && n >= 0 && n <= 5000) ? p : ETAGEN_PREISE;
};

// Wartet der Kobold am Schrein?
export const koboldDa = (sp) => !rgVon(sp).kobold && sp.stand >= KOBOLD_AB;

// Das Kind sagt Ja: alle Splitter gehen an den Kobold, Etage 1 ist offen.
export function koboldAnnehmen(sp, jetzt = new Date()) {
  if (!koboldDa(sp)) return null;
  const rg = rgVon(sp);
  const n = sp.stand;
  rg.kobold = true;
  rg.gegeben = n;
  rg.frei = [0];
  gutschreiben(sp, -n, 'kobold', 'Dem alten Kobold gegeben: die Runengruft', jetzt);
  return { gegeben: n };
}

// Nächste Etage, die man freischalten kann: { etage, preis, fehlt, fertig } oder null
export function naechsteEtage(sp) {
  const rg = rgVon(sp);
  if (!rg.kobold) return null;
  const i = rg.frei.length;
  if (i >= ETAGEN_PREISE.length) return null;
  const preis = preiseVon(sp)[i];
  return { etage: i, preis, fehlt: Math.max(0, preis - sp.stand), fertig: i < ETAGEN_FERTIG };
}

export function etageFreischalten(sp, etage, jetzt = new Date()) {
  const n = naechsteEtage(sp);
  if (!n || n.etage !== etage || !n.fertig || n.fehlt > 0) return null;
  rgVon(sp).frei.push(etage);
  return gutschreiben(sp, -n.preis, 'etage', `Runengruft: Etage ${etage + 1} geöffnet`, jetzt);
}

export const etageFrei = (sp, etage) => rgVon(sp).frei.includes(etage);
