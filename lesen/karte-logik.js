// Archiv der Welten: Lesekarten ohne DOM (testbar mit node). Auftrag 57, Format 60 mit Rückmeldung 60a.
//
// Inhalt: daten/<name>/lesen/inhalt/ (index.json, storylines.json, texte/, fragen/). Gespielt wird nur, was in index.json
// steht und dessen Version passt. Sätze kommen fertig aus dem Text (saetze), die App trennt nicht selbst (60a, Punkt 1).
// Fragestufe über den Abstand der richtigen Formulierung (60a, Punkt 2). Gerüst und Fragestufe legt die App je Fragetyp fest.

export const LOHN_SEK = 120;           // voller Lohn je Karte (2 Min., vor dem Lohnfaktor)
export const KARTE_MAX_MS = 6 * 60 * 1000;
export const RUNDE = 5;
export const SCHNELL_MS = 3000;        // Lesestopp nach einem Fehler in unter 3 s
export const STOPP_MS = 5000;          // „Weiter“ erst nach 5 s

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// ---------- Inhalt prüfen ----------
// roh = { index, storylines, texte: {id: text}, fragen: {id: frage} }. Gibt { stories, texte, fragen, fehler } zurück;
// nur fehlerfreie Texte und Fragen bleiben drin.
export function inhaltPruefen(roh) {
  const fehler = [];
  const idx = roh && roh.index;
  if (!idx || idx.format !== 'lese-inhalt-1') return { stories: [], texte: {}, fragen: {}, fehler: [{ id: 'index', grund: 'format' }] };
  const stories = ((roh.storylines && roh.storylines.storylines) || []).filter(s => s && s.id);
  const storyIds = new Set(stories.map(s => s.id));
  const texte = {}, fragen = {};
  for (const { id, v } of idx.texte || []) {
    const t = roh.texte && roh.texte[id];
    const f = (grund) => fehler.push({ id, grund });
    if (!t) { f('fehlt'); continue; }
    if (t.v !== v) { f('version'); continue; }
    if (!storyIds.has(t.story)) { f('storyline'); continue; }
    if (!Array.isArray(t.absaetze) || !t.absaetze.length) { f('absaetze'); continue; }
    if (!Array.isArray(t.saetze) || t.saetze.length !== t.absaetze.length) { f('saetze'); continue; }
    if (t.saetze.some((s, i) => !Array.isArray(s) || norm(s.join(' ')) !== norm(t.absaetze[i]))) { f('saetze-text'); continue; }
    if (t.story === 'retro' && !(t.bild && (t.bild.datei || t.bild.svg))) { f('bild'); continue; } // 57c: Zeitreise nur mit Bild
    texte[id] = t;
  }
  for (const { id, v } of idx.fragen || []) {
    const q = roh.fragen && roh.fragen[id];
    const f = (grund) => fehler.push({ id, grund });
    if (!q) { f('fehlt'); continue; }
    if (q.v !== v) { f('version'); continue; }
    const t = texte[q.text];
    if (!t) { f('text'); continue; }
    if (!Array.isArray(q.richtig) || q.richtig.length < 2) { f('richtig'); continue; }
    if (!Array.isArray(q.falsch) || q.falsch.length < 4) { f('falsch'); continue; }
    if (!Array.isArray(q.zf) || q.zf.length !== 2) { f('zwischenfragen'); continue; }
    if (!Array.isArray(q.richtigAbstand) || q.richtigAbstand.length !== q.richtig.length) { f('abstand'); continue; }
    const b = (q.beleg || [])[0];
    if (!(b >= 0 && b < t.saetze.length)) { f('beleg'); continue; }
    if (!Array.isArray(q.belegSatz) || q.belegSatz.some(s => !(s >= 0 && s < t.saetze[b].length))) { f('belegSatz'); continue; }
    fragen[id] = q;
  }
  return { stories: stories.filter(s => Object.values(texte).some(t => t.story === s.id)), texte, fragen, fehler };
}

// ---------- Fortschritt ----------
// fs = { erledigt: { frageId: true }, zurueck: { frageId: { karte, t } }, karte (laufende Nummer), typen: { typ: { lvl, hist } } }
export function fortschrittVon(x) {
  const f = x && typeof x === 'object' ? x : {};
  return { erledigt: f.erledigt || {}, zurueck: f.zurueck || {}, karte: f.karte || 0, typen: f.typen || {}, nachschlagTipp: !!f.nachschlagTipp, letzteStory: f.letzteStory || null, runde: f.runde || null, gelesen: f.gelesen || {}, gefragt: f.gefragt || {} };
}
const textFragen = (inh, textId) => Object.values(inh.fragen).filter(q => q.text === textId).sort((a, b) => a.id < b.id ? -1 : 1);
const storyTexte = (inh, story) => Object.values(inh.texte).filter(t => t.story === story).sort((a, b) => a.beat - b.beat || a.teil - b.teil);
// Eine zurückgelegte Karte (Leiter oder Auflösung) bleibt offen, kommt aber erst nach WIEDER_NACH anderen Karten wieder.
export const WIEDER_NACH = 3;
const spielbar = (fs, q) => !fs.erledigt[q.id] && !(fs.zurueck[q.id] && fs.karte - fs.zurueck[q.id].karte < WIEDER_NACH);
// Nächster Text einer Storyline: der erste (nach Folge) mit einer spielbaren Frage.
export function naechsterText(inh, fs, story) {
  for (const t of storyTexte(inh, story)) if (textFragen(inh, t.id).some(q => spielbar(fs, q))) return t;
  return null;
}
export function frageFuer(inh, fs, textId) {
  return textFragen(inh, textId).find(q => spielbar(fs, q)) || null;
}
// „Etwas anderes“: andere Storylines mit einem offenen Text (höchstens 3)
export function andere(inh, fs, ausser) {
  return inh.stories.filter(s => s.id !== ausser && naechsterText(inh, fs, s.id)).slice(0, 3);
}
// Folge X von Y
export const folgeVon = (inh, t) => ({ x: t.beat, y: (inh.stories.find(s => s.id === t.story) || {}).folgen || storyTexte(inh, t.story).length });

// ---------- Gerüst und Fragestufe je Fragetyp (Lernpfad Version 4, Regeln 4 und 5; Auftrag 62) ----------
// Treppe mit 5 Schritten, je Schritt ändert sich nur eine Einstellung: Fragestufe und Gerüst steigen abwechselnd.
export const TREPPE = [null, { stufe: 1, geruest: 1 }, { stufe: 2, geruest: 1 }, { stufe: 2, geruest: 2 }, { stufe: 3, geruest: 2 }, { stufe: 3, geruest: 3 }];
// Alter Stand (lvl 1–9, bis 0.5.0) → Schritt: 1 → 1, 2–3 → 2, 4–5 → 3, 6–7 → 4, 8–9 → 5
export const schrittAusLvl = (lvl) => Math.min(5, Math.max(1, Math.floor((lvl || 1) / 2) + 1));
function typEintrag(fs, typ) {
  const x = fs.typen[typ];
  if (!x) return { schritt: 1, hist: [] };
  const schritt = Number.isInteger(x.schritt) ? Math.min(5, Math.max(1, x.schritt)) : schrittAusLvl(x.lvl);
  return { schritt, hist: Array.isArray(x.hist) ? x.hist : [] };
}
// Aufstieg: 3 der letzten 4 Karten gut (1. Versuch richtig und Beleg sofort; bei Gerüst 1 nur der 1. Versuch).
// Abstieg: 2 Karten hintereinander mit Leiter. Nach jedem Wechsel wird der Verlauf geleert.
export function typStand(fs, typ) {
  const x = typEintrag(fs, typ);
  return { schritt: x.schritt, ...TREPPE[x.schritt], neu: !fs.typen[typ] };
}
export function typNachKarte(fs, typ, { erstUndBeleg, leiter }) {
  const x = typEintrag(fs, typ);
  const hist = [...x.hist, { gut: !!erstUndBeleg, leiter: !!leiter }].slice(-4);
  let schritt = x.schritt, wechsel = 0;
  if (hist.length >= 3 && hist.filter(h => h.gut).length >= 3 && schritt < 5) { schritt++; wechsel = 1; }
  else if (hist.length >= 2 && hist[hist.length - 1].leiter && hist[hist.length - 2].leiter && schritt > 1) { schritt--; wechsel = -1; }
  fs.typen[typ] = { schritt, hist: wechsel ? [] : hist };
  return wechsel;
}
// Fragestufe der Frage: gewünschte Stufe, sonst die höchste vorhandene darunter (60a). ersatz = true, wenn sie fehlte.
export function stufeFuer(q, gewuenscht) {
  const vorhanden = (q.stufen || [1]).filter(s => s <= gewuenscht);
  const s = vorhanden.length ? Math.max(...vorhanden) : Math.min(...(q.stufen || [1]));
  return { stufe: s, ersatz: s !== gewuenscht };
}

// ---------- Antworten ziehen ----------
// 1 richtige Formulierung (Abstand passend zur Stufe) und 2 falsche, gemischt. Im nächsten Versuch andere falsche und
// eine andere richtige Formulierung. Nach einem Hinweis eine Stufe näher am Text (Abstand − 1, mindestens 1).
export function ziehen(q, { abstand, schonR = [], schonF = [] }, rnd = Math.random) {
  const rIdx = q.richtig.map((_, i) => i);
  const passend = (a) => rIdx.filter(i => q.richtigAbstand[i] === a);
  let kand = [];
  for (let a = abstand; a >= 1 && !kand.length; a--) kand = passend(a);
  if (!kand.length) kand = rIdx;
  const neuR = kand.filter(i => !schonR.includes(i));
  const r = pick(neuR.length ? neuR : kand, rnd);
  const fIdx = q.falsch.map((_, i) => i);
  const neuF = fIdx.filter(i => !schonF.includes(i));
  const fl = mischen(neuF.length >= 2 ? neuF : fIdx, rnd).slice(0, 2);
  const antworten = mischen([{ id: `r${r}`, t: q.richtig[r], richtig: true }, ...fl.map(i => ({ id: `f${i}`, t: q.falsch[i].t, richtig: false, f: i }))], rnd);
  return { antworten, r, f: fl };
}
const pick = (l, rnd) => l[Math.floor(rnd() * l.length) % l.length];
export function mischen(l, rnd = Math.random) {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Lohn (Auftrag 57) ----------
// voll: gleich richtig mit richtigem Beleg. hinweis: im 2. Versuch richtig → ½. leiter, aufloesung: 0.
// Beleg mit Hinweis halbiert.
export function lohnSek(ergebnis, belegHinweis, basis = LOHN_SEK) {
  const f = { voll: 1, hinweis: 0.5, leiter: 0, aufloesung: 0 }[ergebnis] ?? 0;
  return Math.round(basis * f * (belegHinweis ? 0.5 : 1));
}

// ---------- Abschlussfrage nach der letzten Folge (Auftrag 61) ----------
// Nur nach der ersten fertigen Karte zum letzten Text (Folge Y von Y), einmal je Storyline und letzter Folge,
// nur wenn die Storyline feedback {gleich, art, anders} hat.
export function abschlussFrage(inh, fs, t) {
  const s = inh.stories.find(x => x.id === t.story);
  if (!s || !s.feedback || !s.feedback.gleich || !s.feedback.art || !s.feedback.anders) return null;
  if (t.beat !== folgeVon(inh, t).y) return null;
  if (fs.gefragt[t.story] === t.id) return null;
  return s.feedback;
}
// Folgen dieser Storyline mit mindestens einer fertigen Karte
export function folgenGelesen(inh, fs, story) {
  return new Set(Object.values(inh.texte).filter(t => t.story === story && fs.gelesen[t.id]).map(t => t.beat)).size;
}
