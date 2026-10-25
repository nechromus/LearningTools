// Wochenplan (Auftrag 24, Format wochenplan-1): Anteile an der Übungszeit, Mischung im Takt, Erinnerungen, gesperrte Themen.
// Den Plan legt der Kinder-Chat mit dem Vater fest. Die App rechnet keine eigenen Ziele aus, sie sorgt nur dafür,
// dass Plan und Ist zusammenpassen. Ohne gültigen, laufenden Plan: null überall, die App arbeitet wie bisher.
// Reine Logik ohne DOM (testbar mit node), genutzt von der Übungs-App und der Eltern-App.
import { THEMEN, FREIGABE_THEMEN } from './logic.js';

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
export const MOTIVATION = 'motivation';
export const SCHWELLEN = { gelb: [1.5, 3], rot: [2, 5] }; // wie Reiter „Übungsmenge“ (Auftrag 22)

// Plan prüfen. Gibt eine bereinigte Fassung oder null zurück.
export function wpNorm(w) {
  if (!w || typeof w !== 'object' || w.format !== 'wochenplan-1' || !DATUM.test(w.ab || '') || !DATUM.test(w.bis || '') || w.bis < w.ab) return null;
  const zahl = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const anteile = {};
  for (const [k, v] of Object.entries(w.anteile && typeof w.anteile === 'object' ? w.anteile : {})) if (zahl(v)) anteile[String(k)] = zahl(v);
  const m = w.motivation && typeof w.motivation === 'object' ? w.motivation : {};
  const motivation = { themen: (Array.isArray(m.themen) ? m.themen : []).filter(t => THEMEN.includes(t)), anteil: zahl(m.anteil), takt: Math.max(0, Math.round(zahl(m.takt))) };
  const erinnerung = {};
  for (const [k, v] of Object.entries(w.erinnerung && typeof w.erinnerung === 'object' ? w.erinnerung : {})) if (zahl(v)) erinnerung[String(k)] = Math.round(zahl(v));
  const gesperrt = (Array.isArray(w.gesperrt) ? w.gesperrt : []).map(String);
  return { format: 'wochenplan-1', ab: w.ab, bis: w.bis, begruendung: typeof w.begruendung === 'string' ? w.begruendung : '', anteile, motivation, erinnerung, gesperrt };
}
export const wpLaeuft = (wp, heute) => !!(wp && wp.ab <= heute && heute <= wp.bis);
export const wpAbgelaufen = (wp, heute) => !!(wp && heute > wp.bis);

// Eingriffe der Eltern (nur mit Ablaufdatum): { art, typ: 'plus' | 'aus', wert, bis, gesetzt }
export function eingriffeNorm(liste) {
  return (Array.isArray(liste) ? liste : []).filter(e => e && typeof e.art === 'string' && ['plus', 'aus'].includes(e.typ) && DATUM.test(e.bis || ''))
    .map(e => ({ art: e.art, typ: e.typ, ...(e.typ === 'plus' ? { wert: Math.max(-50, Math.min(50, Math.round(+e.wert || 0))) } : {}), bis: e.bis, ...(e.gesetzt ? { gesetzt: e.gesetzt } : {}) }));
}
export const eingriffeAktiv = (liste, heute) => eingriffeNorm(liste).filter(e => heute <= e.bis);

// Themen einer Art: Paket-id (alle Themen mit Gewicht im Paket) oder ein Thema. Unbekannte Arten haben keine Themen.
export function themenVon(art, pakete = []) {
  const p = (pakete || []).find(x => x && x.id === art && x.paket && x.paket.gewichte);
  if (p) return Object.keys(p.paket.gewichte).filter(t => p.paket.gewichte[t] > 0 && THEMEN.includes(t));
  return THEMEN.includes(art) ? [art] : [];
}
export function artName(art, pakete = []) {
  if (art === MOTIVATION) return 'Motivation';
  const p = (pakete || []).find(x => x && x.id === art);
  return p ? (p.paket && p.paket.name) || art : art;
}

// Arten mit Soll-Anteil (in %, Summe 100), Themen und Merkmal Motivation. Gesperrte und ausgeschaltete Themen fallen weg.
// Ein Thema gehört zu genau einer Art: Motivation vor Plan-Arten, Thema vor Paket.
// Gesperrte Arten, die ihr Freigabedatum erreicht haben, sind frei (Auftrag 30: prozent-formel ab freigaben.prozent_formel)
const freiAb = (g, freigaben = {}, heute = '') => { const k = FREIGABE_THEMEN[g]; return !!(k && freigaben && freigaben[k] && freigaben[k] <= heute); };
export function wpArten(wp, pakete = [], eingriffe = [], heute = '', freigaben = {}) {
  if (!wp) return [];
  const aktiv = eingriffeAktiv(eingriffe, heute);
  const aus = new Set();
  for (const e of aktiv) if (e.typ === 'aus') themenVon(e.art, pakete).forEach(t => aus.add(t));
  const gesperrt = new Set();
  for (const g of wp.gesperrt) if (!freiAb(g, freigaben, heute)) themenVon(g, pakete).forEach(t => gesperrt.add(t));
  const weg = (t) => aus.has(t) || gesperrt.has(t);
  const vergeben = new Set();
  const arten = [];
  const motiv = wp.motivation.themen.filter(t => !weg(t));
  if (motiv.length && wp.motivation.anteil > 0) { arten.push({ art: MOTIVATION, themen: motiv, soll0: wp.motivation.anteil, motiv: true }); motiv.forEach(t => vergeben.add(t)); }
  const keys = Object.keys(wp.anteile).sort((a, b) => themenVon(a, pakete).length - themenVon(b, pakete).length); // Themen vor Paketen
  for (const k of keys) {
    const th = themenVon(k, pakete).filter(t => !weg(t) && !vergeben.has(t));
    if (!th.length) continue;
    th.forEach(t => vergeben.add(t));
    arten.push({ art: k, themen: th, soll0: wp.anteile[k], motiv: false });
  }
  for (const e of aktiv) if (e.typ === 'plus') { const a = arten.find(x => x.art === e.art); if (a) a.soll0 = Math.max(0, a.soll0 + e.wert); }
  const summe = arten.reduce((s, a) => s + a.soll0, 0);
  for (const a of arten) a.soll = summe ? a.soll0 / summe * 100 : 0;
  return arten.filter(a => a.soll > 0).map(a => ({ ...a, name: artName(a.art, pakete) }));
}
export function artVonThema(arten, t) { return (arten || []).find(a => a.themen.includes(t)) || null; }
export function gesperrteThemen(wp, pakete = [], eingriffe = [], heute = '', freigaben = {}) {
  if (!wp) return [];
  const s = new Set();
  for (const g of wp.gesperrt) if (!freiAb(g, freigaben, heute)) themenVon(g, pakete).forEach(t => s.add(t));
  for (const e of eingriffeAktiv(eingriffe, heute)) if (e.typ === 'aus') themenVon(e.art, pakete).forEach(t => s.add(t));
  return [...s];
}

// Ist seit ab: msJe = { thema: ms }. Ist-% bezogen auf die ganze Übungszeit (auch Erinnerungen und Themen ohne Plan).
// dauerJe = { thema: mittlere ms je Aufgabe } (optional): daraus die mittlere Dauer einer Aufgabe der Art.
export function wpIst(arten, msJe = {}, dauerJe = {}) {
  const gesamt = Object.values(msJe).reduce((s, v) => s + (v || 0), 0);
  return arten.map(a => {
    const ms = a.themen.reduce((s, t) => s + (msJe[t] || 0), 0);
    const ist = gesamt ? ms / gesamt * 100 : 0;
    const d = a.themen.map(t => dauerJe[t]).filter(x => x > 0);
    return { ...a, ms, min: ms / 60000, ist, dauer: d.length ? d.reduce((x, y) => x + y, 0) / d.length : 0, b: gesamt ? bewerten(a.soll, ist, ms > 0) : null };
  });
}
export function bewerten(plan, ist, gekommen, g = SCHWELLEN) {
  if (!(plan > 0)) return null;
  if (!gekommen) return { st: 'rot', wort: 'nie gekommen' };
  const pp = Math.abs(ist - plan), f = ist / plan, wort = ist < plan ? 'zu wenig' : 'zu viel';
  if ((f >= g.rot[0] || f <= 1 / g.rot[0]) && pp >= g.rot[1]) return { st: 'rot', wort };
  if ((f >= g.gelb[0] || f <= 1 / g.gelb[0] + 1e-9) && pp >= g.gelb[1]) return { st: 'gelb', wort };
  return null;
}

// Gewicht einer Art für die nächste Aufgabe: Soll geteilt durch die mittlere Dauer einer Aufgabe (Anteil an der Zeit,
// nicht an der Zahl der Aufgaben), mal Korrektur. Die Korrektur ist begrenzt (⅓ bis 3),
// damit keine Art plötzlich nur noch kommt: je 10 Prozentpunkte Rückstand doppelt so oft.
export function korrektur(soll, ist, hatZeit) { return hatZeit ? Math.max(1 / 3, Math.min(3, Math.pow(2, (soll - ist) / 10))) : 1; }

// Fällige Erinnerungen: Themen, die schon geübt wurden (zuletzt = Tag) und deren Frist erreicht ist. Älteste zuerst.
// erinnerung: { art: tage, standard: tage }; kandidaten: Themen, die die App gerade anbieten kann.
export function faellige(wp, zuletzt = {}, heute, kandidaten = [], pakete = [], gesperrt = []) {
  if (!wp) return [];
  const tage = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const frist = {};
  for (const [k, v] of Object.entries(wp.erinnerung)) if (k !== 'standard') themenVon(k, pakete).forEach(t => { frist[t] = v; });
  const std = wp.erinnerung.standard || 0;
  const out = [];
  for (const t of kandidaten) {
    if (gesperrt.includes(t)) continue;
    // Standard-Frist nur für eingeführte Themen (in der App schon geübt). Eine eigene Frist im Plan gilt auch,
    // wenn das Thema in der App noch nie kam (auf dem Bogen eingeführt): dann ist es gleich fällig.
    if (!zuletzt[t] && !frist[t]) continue;
    const f = frist[t] || std;
    if (!f) continue;
    const her = zuletzt[t] ? tage(zuletzt[t], heute) : f + 99;
    if (her >= f) out.push({ thema: t, tage: her, frist: f });
  }
  return out.sort((a, b) => (b.tage - b.frist) - (a.tage - a.frist));
}

// Nächste Art wählen. z = { sitzungsStart, seitMotivation, faellig: [...], letzteErinnerung: bool }
// Reihenfolge: Einstieg und Takt → Motivation; fällige Erinnerung → dieses Thema; sonst Art nach Soll mal Korrektur.
export function naechsteArt(arten, ist, z = {}, rng = Math.random) {
  if (!arten.length) return null;
  const motiv = arten.find(a => a.motiv);
  if (motiv && z.sitzungsStart) return { art: motiv, grund: 'einstieg' };
  if (motiv && z.takt > 0 && z.seitMotivation >= z.takt) return { art: motiv, grund: 'takt' };
  if (z.faellig && z.faellig.length && !z.letzteErinnerung) return { art: null, thema: z.faellig[0].thema, grund: 'erinnerung', info: z.faellig[0] };
  const hatZeit = ist.some(a => a.ms > 0);
  const mitDauer = ist.every(a => a.dauer > 0);
  const w = ist.map(a => a.soll / (mitDauer ? a.dauer : 1) * korrektur(a.soll, a.ist, hatZeit));
  let r = rng() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < ist.length; i++) { r -= w[i]; if (r < 0) return { art: ist[i], grund: 'plan' }; }
  return { art: ist[ist.length - 1], grund: 'plan' };
}

// Eintrag für das Protokoll plan_ist
export function planIstEintrag(wp, ist, msJe, erinnerungen = []) {
  const gesamt = Object.values(msJe || {}).reduce((s, v) => s + (v || 0), 0);
  return {
    ab: wp.ab, bis: wp.bis, minuten: Math.round(gesamt / 6000) / 10,
    arten: Object.fromEntries(ist.map(a => [a.art, { soll: Math.round(a.soll * 10) / 10, ist: Math.round(a.ist * 10) / 10, min: Math.round(a.min * 10) / 10, ...(a.b ? { abw: a.b.st } : {}) }])),
    erinnerungen
  };
}
