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
  const serien = ((roh.storylines && roh.storylines.serien) || []).filter(x => x && x.id && x.titel);
  return { stories: stories.filter(s => Object.values(texte).some(t => t.story === s.id)), storyListe: stories, serien, texte, fragen, fehler };
}

// ---------- Fortschritt ----------
// fs = { erledigt: { frageId: true }, zurueck: { frageId: { karte, t } }, karte (laufende Nummer), typen: { typ: { lvl, hist } } }
export function fortschrittVon(x) {
  const f = x && typeof x === 'object' ? x : {};
  return { erledigt: f.erledigt || {}, zurueck: f.zurueck || {}, karte: f.karte || 0, typen: f.typen || {}, nachschlagTipp: !!f.nachschlagTipp, letzteStory: f.letzteStory || null, runde: f.runde || null, gelesen: f.gelesen || {}, gefragt: f.gefragt || {}, heute: f.heute || null, frei: null, fertig: f.fertig || {}, freiSeit: f.freiSeit || {}, morgen: f.morgen || {} };
}
const textFragen = (inh, textId) => Object.values(inh.fragen).filter(q => q.text === textId).sort((a, b) => a.id < b.id ? -1 : 1);
const storyTexte = (inh, story) => Object.values(inh.texte).filter(t => t.story === story).sort((a, b) => a.beat - b.beat || a.teil - b.teil);
// Eine zurückgelegte Karte (Leiter oder Auflösung) bleibt offen, kommt aber erst nach WIEDER_NACH anderen Karten wieder.
export const WIEDER_NACH = 3;
const wartet = (fs, q) => !!(fs.zurueck[q.id] && fs.karte - fs.zurueck[q.id].karte < WIEDER_NACH);
const spielbar = (fs, q) => !fs.erledigt[q.id] && (!wartet(fs, q) || fs.frei === q.id);
// Engpass (Auftrag 65): Gibt es sonst keine spielbare Karte, wird die zurückgelegte Karte frei, die am längsten wartet.
// Nicht direkt nach ihrer eigenen Leiter oder Auflösung (letzteKarte = Nummer der zuletzt gespielten Karte in dieser
// Sitzung, nach einem neuen Start null). Setzt fs.frei und gibt { frei, gesperrt } zurück: gesperrt = die einzige
// wartende Karte ist die gerade gespielte (dann bietet der Start „Noch einmal versuchen“ an).
export function engpassPruefen(inh, fs, letzteKarte = null) {
  fs.frei = null;
  const offen = Object.values(inh.fragen).filter(q => !fs.erledigt[q.id]);
  if (!offen.length || offen.some(q => !wartet(fs, q))) return { frei: null, gesperrt: null };
  const warte = offen.filter(q => fs.zurueck[q.id]).sort((a, b) => fs.zurueck[a.id].karte - fs.zurueck[b.id].karte);
  const ok = warte.find(q => fs.zurueck[q.id].karte !== letzteKarte);
  if (ok) { fs.frei = ok.id; return { frei: ok.id, gesperrt: null }; }
  return { frei: null, gesperrt: warte.length ? warte[0].id : null };
}
// Nächster Text einer Storyline: der erste (nach Folge) mit einer spielbaren Frage.
export function naechsterText(inh, fs, story) {
  for (const t of storyTexte(inh, story)) if (textFragen(inh, t.id).some(q => spielbar(fs, q))) return t;
  return null;
}
// „Wie geht es weiter?“ (Auftrag 64): die nächste Folge nach diesem Text, nicht derselbe Text mit seiner Folgefrage.
// Gibt es danach nichts mehr, ein anderer offener Text der Geschichte (z. B. eine zurückgelegte Karte).
export function weiterText(inh, fs, t) {
  const l = storyTexte(inh, t.story).filter(x => x.id !== t.id && textFragen(inh, x.id).some(q => spielbar(fs, q)));
  return l.find(x => x.beat > t.beat || (x.beat === t.beat && x.teil > t.teil)) || l[0] || null;
}
// „Noch eine Frage zum Text“ (Auftrag 64): nur wenn eine Frage zum Text spielbar ist, die Runde nicht voll ist und
// eine Folgefrage auf Platz 5 die Bedingung für sichere Karten erfüllt. Gibt den Plan der Karte zurück oder null.
export function nochEine(inh, fs, textId) {
  if (!frageFuer(inh, fs, textId)) return null;
  const k = (fs.runde && fs.runde.karten) || 0;
  if (!fs.runde || k >= RUNDE) return null;
  const pl = kartePlanen(inh, fs, textId, k + 1, !!fs.runde.neuTyp);
  if (!pl || (SICHER_PLAETZE.includes(k + 1) && !pl.sicher)) return null;
  return pl;
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
  return { schritt, hist: Array.isArray(x.hist) ? x.hist : [], ein: Math.max(0, x.ein | 0) };
}
// Aufstieg: 3 der letzten 4 Karten gut (1. Versuch richtig und Beleg sofort; bei Gerüst 1 nur der 1. Versuch).
// Abstieg: 2 Karten hintereinander mit Leiter. Nach jedem Wechsel wird der Verlauf geleert.
export function typStand(fs, typ) {
  const x = typEintrag(fs, typ);
  return { schritt: x.schritt, ...TREPPE[x.schritt], neu: !fs.typen[typ], ein: x.ein };
}
export function typNachKarte(fs, typ, { erstUndBeleg, leiter }) {
  const x = typEintrag(fs, typ);
  const hist = [...x.hist, { gut: !!erstUndBeleg, leiter: !!leiter }].slice(-4);
  let schritt = x.schritt, wechsel = 0;
  if (hist.length >= 3 && hist.filter(h => h.gut).length >= 3 && schritt < 5) { schritt++; wechsel = 1; }
  else if (hist.length >= 2 && hist[hist.length - 1].leiter && hist[hist.length - 2].leiter && schritt > 1) { schritt--; wechsel = -1; }
  // Eingewöhnung (Auftrag 63): steigt die Fragestufe, sind die nächsten 2 Karten des Typs ohne Wortfallen im 1. Versuch
  let ein = Math.max(0, x.ein - 1);
  if (wechsel === 1 && TREPPE[schritt].stufe > TREPPE[x.schritt].stufe) ein = EINGEWOEHNUNG;
  if (wechsel === -1) ein = 0;
  fs.typen[typ] = { schritt, hist: wechsel ? [] : hist, ...(ein ? { ein } : {}) };
  return wechsel;
}
export const EINGEWOEHNUNG = 2;
export const SICHER_PLAETZE = [1, 5];

// ---------- Karte planen (Auftrag 63): sichere Karten und höchstens 1 neuer Fragetyp je Runde ----------
// platz = Platz der Karte in der Runde (1–5), neuSchon = in dieser Runde kam schon ein neuer Typ.
// Gibt { q, sicher, neu, neuZweiter, stufe, ersatz, geruest, schritt, eingewoehnung } zurück.
export function kartePlanen(inh, fs, textId, platz, neuSchon) {
  const offen = textFragen(inh, textId).filter(q => spielbar(fs, q));
  if (!offen.length) return null;
  const istNeu = (q) => !fs.typen[q.typ];
  let q = offen[0], neuZweiter = false;
  if (neuSchon && istNeu(q)) {
    const bekannt = offen.find(x => !istNeu(x));
    if (bekannt) q = bekannt; else neuZweiter = true;   // keine andere Frage zum Text: kommt trotzdem
  }
  const ts = typStand(fs, q.typ);
  const sicher = SICHER_PLAETZE.includes(platz) && !ts.neu;
  const gewuenscht = sicher ? Math.max(1, ts.stufe - 1) : ts.stufe;
  const st = stufeFuer(q, gewuenscht);
  return { q, sicher, neu: ts.neu, neuZweiter, stufe: st.stufe, ersatz: st.ersatz, gewuenscht, geruest: ts.geruest, schritt: ts.schritt,
    eingewoehnung: !sicher && ts.ein > 0 };
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
export function ziehen(q, { abstand, schonR = [], schonF = [], ohneWortfalle = false }, rnd = Math.random) {
  const rIdx = q.richtig.map((_, i) => i);
  const passend = (a) => rIdx.filter(i => q.richtigAbstand[i] === a);
  let kand = [];
  for (let a = abstand; a >= 1 && !kand.length; a--) kand = passend(a);
  if (!kand.length) kand = rIdx;
  const neuR = kand.filter(i => !schonR.includes(i));
  const r = pick(neuR.length ? neuR : kand, rnd);
  // Eingewöhnung: im 1. Versuch keine Wortfallen (jede Frage hat mindestens 3 andere falsche Antworten)
  const alleF = q.falsch.map((_, i) => i);
  const ohne = alleF.filter(i => q.falsch[i].fehlertyp !== 'Wortfalle');
  const fIdx = ohneWortfalle && ohne.length >= 2 ? ohne : alleF;
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

// ---------- Eine neue Geschichte pro Tag (Auftrag 67) ----------
// storylines[].ab (Tag, frühestens frei) und .nach (story-id): frei, wenn die Vorgänger-Geschichte an einem früheren Tag
// fertig wurde (fs.fertig[nach] = Tag, an dem die letzte Folge mit voll, hinweis oder leiter beendet wurde). Beides: das Spätere.
export const plusTag = (tag, n) => { const d = new Date(tag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Tag, ab dem die Geschichte frei ist; null = Vorgänger noch nicht fertig
export function freiAm(s, fs) {
  let tag = s && s.ab ? s.ab : null;
  if (s && s.nach) {
    const f = fs.fertig && fs.fertig[s.nach];
    if (!f) return null;
    const t2 = plusTag(f, 1);
    if (!tag || t2 > tag) tag = t2;
  }
  return tag || '0000-00-00';
}
export const storyFrei = (s, fs, tag) => { const a = freiAm(s, fs); return a != null && a <= tag; };
export const mitTakt = (s) => !!(s && (s.ab || s.nach));
// Inhalt ohne gesperrte Geschichten: deren Texte und Fragen kommen nicht in Runden, Folgefragen oder den Engpass
export function inhaltFrei(inh, fs, tag) {
  const frei = inh.stories.filter(s => storyFrei(s, fs, tag));
  if (frei.length === inh.stories.length) return inh;
  const ids = new Set(frei.map(s => s.id));
  const texte = {}, fragen = {};
  for (const [id, t] of Object.entries(inh.texte)) if (ids.has(t.story)) texte[id] = t;
  for (const [id, q] of Object.entries(inh.fragen)) if (texte[q.text]) fragen[id] = q;
  return { ...inh, stories: frei, texte, fragen };
}
// Gesperrte Geschichten, deren Vorgänger schon fertig ist: [{ story, am }]. Ohne fertigen Vorgänger zeigt die App sie nicht.
export function demnaechst(inh, fs, tag) {
  return (inh.storyListe || inh.stories).filter(s => s.nach && fs.fertig[s.nach] && !storyFrei(s, fs, tag))
    .map(s => ({ story: s, am: freiAm(s, fs) }));
}
// Die letzte Folge zählt als fertig bei voll, hinweis oder leiter
export const FERTIG_ERGEBNIS = ['voll', 'hinweis', 'leiter'];

// ---------- Serien, Staffeln, Folgen (Entscheidung 68, Konzept E) ----------
// storylines.json: serien [{id, titel, kurz, bild, style}], je Geschichte serie (id) und staffel (Nummer), optional jahr.
// Ohne serie ist die Geschichte eine eigene Serie mit Staffel 1. inhAlle = alle geprüften Inhalte, inhFrei = nur freie.
export function serienListe(inhAlle) {
  const alle = inhAlle.storyListe || inhAlle.stories;
  const mitText = new Set(Object.values(inhAlle.texte).map(t => t.story));
  const def = new Map((inhAlle.serien || []).map(x => [x.id, x]));
  const out = new Map();
  for (const s of alle) {
    // Geschichten ohne Texte nur zeigen, wenn sie zu einer Serie gehören (angekündigte Staffel)
    const sid = s.serie && def.has(s.serie) ? s.serie : s.id;
    if (!mitText.has(s.id) && sid === s.id) continue;
    if (!out.has(sid)) { const d = def.get(sid); out.set(sid, { id: sid, titel: d ? d.titel : s.titel, kurz: d ? d.kurz || '' : s.kurz || '', bild: d ? d.bild || s.icon : s.icon, style: (d && d.style) || s.style, staffeln: [] }); }
    out.get(sid).staffeln.push(s);
  }
  for (const x of out.values()) x.staffeln.sort((a, b) => (a.staffel || 1) - (b.staffel || 1));
  return [...out.values()].filter(x => x.staffeln.some(s => mitText.has(s.id)));
}
export const serieVon = (liste, story) => liste.find(x => x.staffeln.some(s => s.id === story)) || null;
// Folgen einer Staffel: [{ beat, titel, texte, gelesen, offen, jetzt }]; jetzt = Folge des nächsten Texts
export function folgenStand(inh, fs, story) {
  const texte = storyTexte(inh, story);
  const nt = naechsterText(inh, fs, story);
  const m = new Map();
  for (const t of texte) {
    if (!m.has(t.beat)) m.set(t.beat, { beat: t.beat, titel: t.titel, texte: [], gelesen: false, offen: false, jetzt: false });
    const x = m.get(t.beat);
    x.texte.push(t.id);
    if (fs.gelesen[t.id]) x.gelesen = true;
    if (textFragen(inh, t.id).some(q => spielbar(fs, q))) x.offen = true;
  }
  if (nt && m.has(nt.beat)) m.get(nt.beat).jetzt = true;
  return [...m.values()].sort((a, b) => a.beat - b.beat);
}
// Stand einer Staffel: fertig | laeuft | neu (frei, noch nichts gelesen) | gesperrt (mit am = Tag der Freigabe oder null)
export function staffelStand(inhAlle, inhFrei, fs, story, tag) {
  const s = (inhAlle.storyListe || inhAlle.stories).find(x => x.id === story);
  const frei = inhFrei.stories.some(x => x.id === story);
  const y = (s && s.folgen) || storyTexte(inhAlle, story).length;
  // am nur, wenn der Tag feststeht und noch kommt (ohne Texte oder ohne ab/nach: „Kommt danach“)
  if (!frei) { const am = s && mitTakt(s) ? freiAm(s, fs) : null; return { art: 'gesperrt', am: am && am > tag ? am : null, gelesen: 0, folgen: y }; }
  const fo = folgenStand(inhFrei, fs, story);
  const gelesen = fo.filter(x => x.gelesen).length;
  const offen = fo.some(x => x.offen);
  if (fs.fertig[story] || (!offen && gelesen)) return { art: 'fertig', gelesen, folgen: y, offen };
  return { art: gelesen ? 'laeuft' : 'neu', gelesen, folgen: y, offen };
}
// Wunsch Eltern 21.11.: erste ungelesene Folge der ganzen Serie (Staffeln der Reihe nach, nur freie Staffeln, nur mit spielbarer Frage)
// → { story, text, beat } oder null
export function serieErsteOffene(inh, fs, serie) {
  for (const st of serie.staffeln) {
    if (!inh.stories.some(s => s.id === st.id)) continue;
    for (const fo of folgenStand(inh, fs, st.id)) {
      if (fo.gelesen) continue;
      const tid = fo.texte.find(id => frageFuer(inh, fs, id));
      if (tid) return { story: st.id, text: tid, beat: fo.beat };
    }
  }
  return null;
}
// Fehlen vor (story, beat) noch Folgen der Serie? Dann die erste fehlende, sonst null
export function lueckeVor(inh, fs, serie, story, beat) {
  const e = serieErsteOffene(inh, fs, serie);
  if (!e) return null;
  const i = serie.staffeln.findIndex(s => s.id === story), j = serie.staffeln.findIndex(s => s.id === e.story);
  if (i < 0 || j < 0) return null;
  return j < i || (j === i && e.beat < beat) ? e : null;
}
// Noch keine Folge der Serie gelesen?
export const serieUngelesen = (inh, fs, serie) => serie.staffeln.every(st => !storyTexte(inh, st.id).some(t => fs.gelesen[t.id]));
// Staffel zum Weiterlesen in einer Serie: die zuletzt gelesene, wenn dort etwas offen ist, sonst die erste offene
export function staffelWeiter(inh, fs, serie) {
  const ids = serie.staffeln.map(s => s.id);
  if (fs.letzteStory && ids.includes(fs.letzteStory) && naechsterText(inh, fs, fs.letzteStory)) return fs.letzteStory;
  return ids.find(id => inh.stories.some(s => s.id === id) && naechsterText(inh, fs, id)) || null;
}
