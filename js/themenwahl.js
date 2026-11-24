// Themenwahl und Missionsplanung (Auftrag 74): Das Kind wählt seine Themen selbst, die App führt über die Abhängigkeiten.
// Fachneutral: Jedes Thema hat ein Fach (data/themen.json → faecher). Reine Logik ohne Bildschirm, testbar mit node.
// Stand je Teilschritt: offen | wackelt | sitzt (quelle selbst | kurzcheck | ueben). Nur mit einstellungen.json → werte.themenwahl.an.

export const FORMAT = 'themenwahl-1';
export const WAHLEN = ['pruefen', 'wiederholen', 'neu', 'spaeter', 'nicht'];
export const SELBST = ['kann', 'unsicher', 'noch_nicht'];
export const ANTEILE = { 1: [100], 2: [60, 40], 3: [50, 30, 20] };
export const MAX_AKTIV = 3;
export const ZIELE_STD = { tag: { minuten: 45, neu: 2, tiefe: 5 }, woche_tage: 3 };
export const ETAPPEN = 3;
// Antworten der Lernplattform-Befragung → Wahl (B4)
export const VORBELEGUNG = { 'hatten wir': 'pruefen', 'kommt noch': 'spaeter', 'weiß nicht': 'wiederholen', 'will ich': 'neu', pruefen: 'pruefen', wiederholen: 'wiederholen', neu: 'neu', spaeter: 'spaeter', nicht: 'nicht' };
// Themen, die die App schon üben kann: Baukästen (gens) und Pool-Themen der App (pool). Alles andere „wird vorbereitet“.
export const UEBEN = {
  umstellen: { gens: ['gleichung', 'formel-umstellen'], pool: ['umstellen'] },
  potenz: { gens: ['potenz', 'zehnerpotenz'], pool: [] },
  kegel: { gens: ['kegel', 'pyramide', 'kugel', 'zusammengesetzt'], pool: [] },
  trigo: { gens: ['kosinus', 'sinus', 'tangens', 'trig-mix', 'trig-weg'], pool: [] },
  boxplot: { gens: ['daten'], pool: [] },
  qfkt: { gens: ['parabel'], pool: [] },     // 24.11.
  qgl: { gens: ['qgleichung'], pool: [] }
};
// Themen der Schnell-Check-Datei → Themen der Liste (zugeordnet wird über den Teilschritt, das hier ist nur zur Sicherheit)
export const KC_THEMA = { wurzeln: 'wurzel', pythagoras: 'pyth', 'quadr-funktionen': 'qfkt', potenzgesetze: 'potenz', potenzfunktionen: 'potfkt' };

const heuteIso = () => new Date().toISOString();
const tagNr = (d) => Math.floor(Date.parse(d + 'T00:00:00Z') / 864e5);
export const tagPlus = (d, n) => new Date((tagNr(d) + n) * 864e5).toISOString().slice(0, 10);
export const ohneStufe = (ts) => String(ts || '').split('@')[0];
export const stufeVon = (ts) => { const m = /@(\d+)$/.exec(String(ts || '')); return m ? Number(m[1]) : 1; };

// ---------- Daten ----------
// roh = data/themen.json. Gibt { themen, T, SCHRITT, kanten, namen, gruppen, faecher } zurück.
export function datenVon(roh) {
  const themen = (roh && roh.themen || []).filter(t => t && t.id && Array.isArray(t.schritte));
  const T = Object.fromEntries(themen.map(t => [t.id, t]));
  const SCHRITT = {};
  for (const t of themen) for (const s of t.schritte) SCHRITT[s.id] = { ...s, thema: t.id };
  return { themen, T, SCHRITT, kanten: (roh && roh.kanten) || [], namen: (roh && roh.namen) || {}, gruppen: (roh && roh.gruppen) || [], faecher: (roh && roh.faecher) || { mathe: 'Mathe' } };
}
export const schrittName = (D, id) => (D.SCHRITT[id] && D.SCHRITT[id].name) || D.namen[id] || id;
// Themen in der Liste (B3, B4): ohne Gruppe „Grundlage“
export const listenThemen = (D) => D.themen.filter(t => t.gruppe !== 'Grundlage');
export const schulThemen = (D) => D.themen.filter(t => t.gruppe === 'Schulstoff Klasse 9' && t.id !== 'umstellen');
export const bereit = (t) => !!UEBEN[t];
// Beispiel der höchsten Stufe bis Niveau G (B2a)
const NIV = 'ABCDEFGHQ';
export function beispielBisG(D, id) {
  const s = D.SCHRITT[id]; if (!s || !Array.isArray(s.stufen) || !s.stufen.length) return null;
  const ok = s.stufen.filter(x => NIV.indexOf(x.niveau) <= NIV.indexOf('G'));
  return (ok.length ? ok : s.stufen.slice(0, 1)).slice(-1)[0];
}
// Hat das Thema Teilschritte mit Stufen (sonst fragt B2a einmal für das ganze Thema)?
export const mitStufen = (D, tid) => !!(D.T[tid] && D.T[tid].schritte.some(s => Array.isArray(s.stufen) && s.stufen.length));

// „braucht“-Teilschritte außerhalb des Themas (C1), mit der höchsten verlangten Stufe
export function voraussetzungen(D, tid) {
  const t = D.T[tid]; if (!t) return [];
  const innen = new Set(t.schritte.map(s => s.id));
  const m = new Map();
  for (const k of D.kanten) if (k.art === 'braucht' && innen.has(k.nach) && !innen.has(k.von)) m.set(k.von, Math.max(m.get(k.von) || 0, k.braucht_stufe || 1));
  return [...m].map(([id, stufe]) => ({ id, stufe }));
}
export const hilft = (D, tid) => { const t = D.T[tid]; if (!t) return []; const innen = new Set(t.schritte.map(s => s.id)); return [...new Set(D.kanten.filter(k => k.art === 'hilft' && innen.has(k.nach) && !innen.has(k.von)).map(k => k.von))]; };

// ---------- Zustand ----------
export function leer(vorbelegung = {}, D = null) {
  const wahl = {};
  if (D) for (const t of listenThemen(D)) wahl[t.id] = VORBELEGUNG[vorbelegung[t.id]] || 'spaeter';
  return {
    format: FORMAT, version: 0, geaendert: null,
    planung: { status: 'offen', gezeigt: null, fertig: null },
    schule: { themen: [], anders: '', freitext: '', stand: null, selbst: {} },
    kurs: { themen: [], freitext: '', stand: null },
    wahl, aktiv: [], pausiert: [], klassenarbeiten: [], teilschritte: {},
    ziele: JSON.parse(JSON.stringify(ZIELE_STD)), etappen: {}, tage: {}, best: { knobelFolge: 0, knobelMax: 0, etappeMs: {} },
    trotzdem: {}, kc: null, kcGemacht: 0, rueckblick: null
  };
}
// Ein Zustand aus Spielstand oder Server: fehlende Teile ergänzen
export function norm(z, vorbelegung = {}, D = null) {
  const l = leer(vorbelegung, D);
  if (!z || typeof z !== 'object') return l;
  const o = { ...l, ...z };
  for (const k of ['planung', 'schule', 'kurs', 'ziele', 'best']) o[k] = { ...l[k], ...(z[k] || {}) };
  o.ziele.tag = { ...l.ziele.tag, ...((z.ziele || {}).tag || {}) };
  o.wahl = { ...l.wahl, ...(z.wahl || {}) };
  for (const k of ['aktiv', 'pausiert', 'klassenarbeiten']) o[k] = Array.isArray(z[k]) ? z[k] : [];
  for (const k of ['teilschritte', 'etappen', 'tage', 'trotzdem']) o[k] = z[k] && typeof z[k] === 'object' ? z[k] : {};
  return o;
}
export function geaendert(tw) { tw.version = (tw.version || 0) + 1; tw.geaendert = heuteIso(); return tw; }

// ---------- Anteile (B5, D2) ----------
// Laufende Klassenarbeit: die nächste mit Datum ab heute
export function klassenarbeitJetzt(tw, heute) {
  return (tw.klassenarbeiten || []).filter(k => k.datum >= heute && k.thema).sort((a, b) => a.datum.localeCompare(b.datum))[0] || null;
}
// Vergangene Klassenarbeit ohne Rückmeldung (fragt einmal)
export const klassenarbeitRueckmeldung = (tw, heute) => (tw.klassenarbeiten || []).find(k => k.datum < heute && k.rueckmeldung == null && !k.gefragt) || null;
// Anteile in Prozent: soll (Reihenfolge), mitKa (Klassenarbeit mindestens 50 %), ist (nur Themen mit Aufgaben, Rest verteilt)
export function anteile(tw, heute, istBereit = bereit) {
  const liste = tw.aktiv.map(a => a.thema);
  const basis = ANTEILE[liste.length] || [];
  let a = liste.map((t, i) => ({ thema: t, soll: basis[i] || 0 }));
  const ka = klassenarbeitJetzt(tw, heute);
  if (ka) {
    if (!a.some(x => x.thema === ka.thema)) a.push({ thema: ka.thema, soll: 0, ka: true });
    const k = a.find(x => x.thema === ka.thema);
    const rest = a.filter(x => x !== k).reduce((s, x) => s + x.soll, 0);
    const kAnteil = Math.max(50, k.soll);
    for (const x of a) x.mitKa = x === k ? kAnteil : rest ? Math.round(x.soll / rest * (100 - kAnteil)) : 0;
  } else for (const x of a) x.mitKa = x.soll;
  const summe = a.filter(x => istBereit(x.thema)).reduce((s, x) => s + x.mitKa, 0);
  for (const x of a) x.ist = istBereit(x.thema) && summe ? Math.round(x.mitKa / summe * 100) : 0;
  return a;
}
// Thema für die nächste Aufgabe: das mit dem größten Rückstand nach Übungszeit heute (ms je Thema)
export function themaWaehlen(an, msHeute = {}, rng = Math.random) {
  const kand = an.filter(x => x.ist > 0);
  if (!kand.length) return null;
  const ges = kand.reduce((s, x) => s + (msHeute[x.thema] || 0), 0) + 60000;
  let best = null, bw = -Infinity;
  for (const x of kand) { const w = x.ist / 100 * ges - (msHeute[x.thema] || 0) + rng() * 20000; if (w > bw) { bw = w; best = x.thema; } }
  return best;
}
export function aktivSetzen(tw, liste, heute) {
  const alt = Object.fromEntries(tw.aktiv.map(a => [a.thema, a.seit]));
  const basis = ANTEILE[liste.length] || [];
  tw.aktiv = liste.slice(0, MAX_AKTIV).map((t, i) => ({ thema: t, platz: i + 1, anteil: basis[i], seit: alt[t] || heute }));
  tw.pausiert = tw.pausiert.filter(p => !liste.includes(p.thema));
  return tw.aktiv;
}

// ---------- Stand je Teilschritt (C) ----------
export function standVon(tw, id) { const s = tw.teilschritte[ohneStufe(id)]; return s ? s.stand : 'offen'; }
export const selbstSitzt = (tw, id) => { const s = tw.teilschritte[ohneStufe(id)]; return !!s && s.stand === 'sitzt' && s.quelle === 'selbst'; };
function setzen(tw, id, stand, quelle, grund, heute) {
  const k = ohneStufe(id);
  const s = tw.teilschritte[k] || (tw.teilschritte[k] = { stand: 'offen', stufe: 0, erg: [] });
  const vorher = s.stand;
  if (vorher === stand && s.quelle === quelle) return null;
  s.stand = stand; s.quelle = quelle; s.seit = heute;
  return vorher !== stand ? { teilschritt: k, vorher, nachher: stand, grund } : null;
}
// Selbsteinschätzung (B2a): kann → sitzt (selbst), unsicher → wackelt, noch_nicht → offen. Überschreibt keinen geprüften oder geübten Stand.
export function selbstSetzen(tw, id, antwort, heute) {
  tw.schule.selbst[id] = antwort;
  const s = tw.teilschritte[ohneStufe(id)];
  if (s && (s.quelle === 'kurzcheck' || s.quelle === 'ueben')) return null;
  return setzen(tw, id, { kann: 'sitzt', unsicher: 'wackelt', noch_nicht: 'offen' }[antwort] || 'offen', 'selbst', 'selbst', heute);
}
// Normales Üben: letzte 5 Aufgaben des Teilschritts; mindestens 4 im 1. Versuch → sitzt, höchstens 2 → wackelt (ab 3 Aufgaben)
export function uebenBuchen(tw, ts, erst, heute) {
  const k = ohneStufe(ts); if (!k) return { aenderung: null, neu: false };
  const s = tw.teilschritte[k] || (tw.teilschritte[k] = { stand: 'offen', stufe: 0, erg: [] });
  const st = stufeVon(ts);
  // „Neu“ für den Tagesring: zum ersten Mal geübt oder zum ersten Mal diese höhere Stufe
  const neu = !s.erstTag || st > (s.stufe || 0);
  if (!s.erstTag) s.erstTag = heute;
  if (st > (s.stufe || 0)) s.stufe = st;
  s.erg = [...(s.erg || []), erst ? 1 : 0].slice(-5);
  s.n = (s.n || 0) + 1; s.zuletzt = heute;
  const n1 = s.erg.filter(Boolean).length;
  let aenderung = null;
  if (s.erg.length >= 3 && n1 <= 2) aenderung = setzen(tw, k, 'wackelt', 'ueben', 'ueben', heute);
  if (n1 >= 4) aenderung = setzen(tw, k, 'sitzt', 'ueben', 'ueben', heute);
  return { aenderung, neu };
}
// Schnell-Check (C2): beide Aufgaben im 1. oder 2. Versuch richtig → sitzt, sonst wackelt. erg = { teilschritt: [ok, ok] }
export function kurzcheckAuswerten(tw, erg, heute) {
  const ergebnis = {}, aenderungen = [];
  for (const [ts, oks] of Object.entries(erg)) {
    const k = ohneStufe(ts);
    ergebnis[k] = oks.length && oks.every(Boolean) ? 'sitzt' : 'wackelt';
    const s = tw.teilschritte[k] || (tw.teilschritte[k] = { stand: 'offen', stufe: 0, erg: [] });
    s.stufe = Math.max(s.stufe || 0, 1);
    const a = setzen(tw, k, ergebnis[k], 'kurzcheck', 'kurzcheck', heute);
    if (a) aenderungen.push(a);
  }
  return { ergebnis, aenderungen };
}
// Aufgaben für den Schnell-Check: je Teilschritt die (zwei) Aufgaben der Datei, in der Reihenfolge der Teilschritte
export function kurzcheckAufgaben(pool, teilschritte) {
  const out = [];
  for (const ts of teilschritte) out.push(...pool.filter(a => ohneStufe(a.teilschritt) === ts).slice(0, 2));
  return out;
}
export const kurzcheckSchritte = (D, pool, tid) => (D.T[tid] ? D.T[tid].schritte.map(s => s.id).filter(id => pool.some(a => ohneStufe(a.teilschritt) === id)) : []);
// Offene und wackelnde Voraussetzungen eines Themas
export function vorOffen(D, tw, tid) {
  const v = voraussetzungen(D, tid);
  return { offen: v.filter(x => standVon(tw, x.id) === 'offen').map(x => x.id), wackelt: v.filter(x => standVon(tw, x.id) === 'wackelt').map(x => x.id) };
}
// C3: Teilschritte, aus denen etwa jede 5. Aufgabe kommt (aktive Themen mit „trotzdem starten“)
export function c3Schritte(D, tw) {
  const s = new Set();
  for (const a of tw.aktiv) if (tw.trotzdem[a.thema]) { const v = vorOffen(D, tw, a.thema); for (const id of [...v.wackelt, ...v.offen]) s.add(id); }
  return [...s];
}

// ---------- Etappen (D3) ----------
// Etappe sitzt: mindestens min Aufgaben in der Etappe, an mindestens tage Tagen, von den letzten 10 mindestens 8 im 1. Versuch
export function etappeVon(tw, t) { return (tw.etappen[t] && tw.etappen[t].nr) || 1; }
export function etappeBuchen(tw, t, erst, heute, { min = 0, tage = 1 } = {}, ms = 0) {
  const e = tw.etappen[t] || (tw.etappen[t] = { nr: 1, seit: heute, erg: [], tage: [], n: 0, ms: 0, erste: null });
  e.n++; e.erg = [...e.erg, erst ? 1 : 0].slice(-10); e.ms = (e.ms || 0) + Math.min(ms, 600000);
  if (!e.tage.includes(heute)) e.tage.push(heute);
  if (!e.erste) e.erste = Date.now();
  e.letzte = Date.now();
  if (e.nr >= ETAPPEN) return null;
  if (e.n >= min && e.tage.length >= tage && e.erg.length >= 10 && e.erg.filter(Boolean).length >= 8) {
    const dauer = e.letzte - e.erste;
    const alt = tw.best.etappeMs[t]; if (!alt || dauer < alt) tw.best.etappeMs[t] = dauer;
    const von = e.nr;
    tw.etappen[t] = { nr: von + 1, seit: heute, erg: [], tage: [], n: 0, ms: 0, erste: null };
    return { thema: t, von, nach: von + 1 };
  }
  return null;
}

// ---------- Tagesringe, Woche, Kalender (E1, E2, E8) ----------
export function tagVon(tw, d) { return tw.tage[d] || (tw.tage[d] = { ms: 0, n: 0, erst: 0, zweit: 0, tiefe: 0, neu: [], knobel: 0, knobelOhne: 0, themen: {} }); }
// Eine fertige Aufgabe buchen. info: { thema (Liste), ms, ergebnis, stufe, knobelOhne, neu: [teilschritte] }
export function tagBuchen(tw, d, info) {
  const t = tagVon(tw, d);
  t.ms += Math.min(info.ms || 0, 600000); t.n++;
  if (info.ergebnis === 'erst') t.erst++;
  if (info.ergebnis === 'zweit') t.zweit++;
  const ok = info.ergebnis === 'erst' || info.ergebnis === 'zweit';
  if (ok && ((info.stufe || 1) >= 3 || info.knobelOhne)) t.tiefe++;
  if (info.knobel) t.knobel++;
  if (info.knobelOhne) t.knobelOhne++;
  for (const n of info.neu || []) if (!t.neu.includes(n)) t.neu.push(n);
  if (info.thema) { const x = t.themen[info.thema] || (t.themen[info.thema] = { n: 0, erst: 0, ms: 0 }); x.n++; if (info.ergebnis === 'erst') x.erst++; x.ms += Math.min(info.ms || 0, 600000); }
  // Bestleistung: längste Folge von Knobel-Aufgaben ohne Schritte, richtig
  if (info.knobel) { tw.best.knobelFolge = info.knobelOhne && ok ? (tw.best.knobelFolge || 0) + 1 : 0; tw.best.knobelMax = Math.max(tw.best.knobelMax || 0, tw.best.knobelFolge); }
  // Alte Tage nach 400 Tagen weg
  const grenze = tagPlus(d, -400);
  for (const k of Object.keys(tw.tage)) if (k < grenze) delete tw.tage[k];
  return t;
}
export function ringe(tw, d) {
  const t = tw.tage[d] || { ms: 0, neu: [], tiefe: 0 }, z = tw.ziele.tag;
  return { minuten: Math.round(t.ms / 60000), neu: t.neu.length, tiefe: t.tiefe, ziel: z };
}
// Montag der Woche
export function montag(d) { const n = tagNr(d); const wt = (new Date(n * 864e5).getUTCDay() + 6) % 7; return tagPlus(d, -wt); }
export function woche(tw, d) {
  const mo = montag(d);
  const tage = Array.from({ length: 7 }, (_, i) => { const k = tagPlus(mo, i); return { tag: k, geuebt: !!(tw.tage[k] && tw.tage[k].n > 0) }; });
  return { tage, anzahl: tage.filter(x => x.geuebt).length, ziel: tw.ziele.woche_tage };
}
// Wochenrückblick (E4) für die Woche ab montag; neuSitzt aus den Teilschritten (seit in der Woche, Stand sitzt, nicht selbst)
export function wochenwerte(tw, mo) {
  let ms = 0, n = 0, erst = 0, knobel = 0, knobelOhne = 0;
  for (let i = 0; i < 7; i++) { const t = tw.tage[tagPlus(mo, i)]; if (!t) continue; ms += t.ms; n += t.n; erst += t.erst; knobel += t.knobel; knobelOhne += t.knobelOhne; }
  const bis = tagPlus(mo, 6);
  const neuSitzt = Object.values(tw.teilschritte).filter(s => s.stand === 'sitzt' && s.quelle !== 'selbst' && s.seit >= mo && s.seit <= bis).length;
  return { minuten: Math.round(ms / 60000), aufgaben: n, erst: n ? Math.round(erst / n * 100) : 0, neuSitzt, knobelOhne: n ? Math.round(knobelOhne / n * 100) : 0 };
}
export const rueckblickFaellig = (tw, heute) => { const mo = montag(heute); return heute === mo && tw.rueckblick !== mo && Object.keys(tw.tage).some(k => k < mo && k >= tagPlus(mo, -7)); };
// Verlauf je Thema (E5): Quote im 1. Versuch je Übungstag
export function verlaufThema(tw, t, tage = 30, heute) {
  const out = [];
  for (let i = tage - 1; i >= 0; i--) { const k = tagPlus(heute, -i); const x = tw.tage[k] && tw.tage[k].themen[t]; if (x && x.n) out.push({ tag: k, quote: Math.round(x.erst / x.n * 100), n: x.n }); }
  return out;
}
export function zuletztGeuebt(tw, t) { const k = Object.keys(tw.tage).filter(d => tw.tage[d].themen[t]).sort().pop(); return k || null; }
// Merge zweier Stände (Server/Handy): höhere Version gewinnt, Tage werden zusammengeführt (größere Werte bleiben)
export function zusammen(server, lokal) {
  if (!server) return lokal;
  if (!lokal) return server;
  const sieger = (server.version || 0) > (lokal.version || 0) ? server : lokal;
  const andere = sieger === server ? lokal : server;
  const tage = { ...(andere.tage || {}) };
  for (const [k, v] of Object.entries(sieger.tage || {})) tage[k] = !tage[k] || (v.n || 0) >= (tage[k].n || 0) ? v : tage[k];
  return { ...sieger, tage };
}
// Datei für daten/<kind>/themenwahl.json (Eltern-App und Aufgaben-Chat lesen sie)
export function dateiVon(tw, kind, heute, D = null) {
  const an = anteile(tw, heute);
  return {
    format: FORMAT, kind, geaendert: tw.geaendert, version: tw.version,
    planung: tw.planung, schule: tw.schule, kurs: tw.kurs, wahl: tw.wahl,
    aktiv: tw.aktiv.map(a => ({ ...a, anteil: (an.find(x => x.thema === a.thema) || {}).mitKa ?? a.anteil, ...(bereit(a.thema) ? {} : { vorbereitet: true }) })),
    pausiert: tw.pausiert, klassenarbeiten: tw.klassenarbeiten,
    teilschritte: Object.fromEntries(Object.entries(tw.teilschritte).map(([k, s]) => [k, { stand: s.stand, stufe: s.stufe || 0, seit: s.seit || null, quelle: s.quelle || null, ...(s.n ? { n: s.n, erg: s.erg, zuletzt: s.zuletzt } : {}) }])),
    etappen: Object.fromEntries(Object.entries(tw.etappen).map(([t, e]) => [t, { nr: e.nr, seit: e.seit, n: e.n, tage: e.tage.length }])),
    ziele: tw.ziele, tage: tw.tage, best: tw.best, trotzdem: tw.trotzdem,
    ...(D ? { themen_stand: D.themen.length } : {})
  };
}

// ---------- Teilschritt einer Aufgabe ----------
// Pool-Aufgaben bringen das Feld mit; Trigonometrie und Daten haben es schon (logic.js). Sonst Zuordnung für die Baukästen.
export function teilschrittFuer(a) {
  if (!a) return null;
  if (a.teilschritt) return a.teilschritt;
  const p0 = Array.isArray(a.parameter) ? a.parameter[0] : null, st = a.stufe || 1;
  switch (a.generator) {
    case 'gleichung': return `gl.einfach@${Math.min(st, 2)}`;
    case 'formel-umstellen': return 'formeln.umstellen@1';
    case 'potenz': return `potenz.hoch@${Math.min(st, 2)}`;
    case 'zehnerpotenz': return 'potenz.negativ@2';
    case 'kegel': return p0 === 'mantel' ? 'kegel.mantel@2' : p0 === 'oberflaeche' ? 'kegel.oberflaeche@1' : 'kegel.volumen@1';
    case 'pyramide': return 'kegel.volumen@1';
    case 'kugel': return 'kugel.volumen@1';
    case 'zusammengesetzt': return 'kegel.volumen@1';
  }
  if (a.thema === 'umstellen') return 'formeln.umstellen@1';
  return null;
}
// Lernplattform-Thema einer App-Aufgabe
export function themaFuer(a) {
  if (!a) return null;
  if (a.zweck === 'kurzpruefung') return KC_THEMA[a.thema] || null;
  for (const [t, u] of Object.entries(UEBEN)) if (u.gens.includes(a.generator) || (!a.generator && u.pool.includes(a.thema))) return t;
  return null;
}
// Mischt die Antworten einer Auswahl-Aufgabe (in der Datei steht die richtige immer zuerst)
export function gemischt(a, rng = Math.random) {
  if (a.typ !== 'auswahl' || !Array.isArray(a.optionen)) return a;
  const r = a.optionen.map((o, i) => [rng(), o, i]).sort((x, y) => x[0] - y[0]);
  return { ...a, optionen: r.map(x => x[1]), antwort: { ...a.antwort, richtig: r.findIndex(x => x[2] === a.antwort.richtig) } };
}
