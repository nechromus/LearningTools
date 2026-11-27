// Kassenbuch für die Bildschirmzeit (Auftrag 59, Schritt 1). Reine Logik ohne DOM (testbar mit node).
//
// Idee: Jede App (Mathe, später Lesen) auf jedem Handy ist eine „Quelle“. Sie bucht ihre verdiente Zeit nur in ihre eigene
// Datei daten/<name>/konto/<quelle>.json (ein Schreiber je Datei, nie überschrieben mit weniger). Die Datei enthält
// laufende Summen (kum = Sekunden, kumA = Aufgaben bzw. Lesekarten (= Fragen), kumMs = Übungszeit, kumF = neu gelesene Folgen
// (nur Lesen, seit Archiv 0.15.0)) seit Beginn des Kassenbuchs.
// Abschicken schreibt eine Auszahlung in daten/<name>/konto/auszahlungen.json: Code, je Quelle der Bereich bis zur
// aktuellen Summe, und „bezahlt“ je Quelle. Diese Datei wird nur geschrieben, wenn sie seit dem Lesen unverändert ist
// (sha bei GitHub). Offen ist je Quelle kum − bezahlt. So kann dieselbe Zeit nie zweimal ausgezahlt werden.
//
// Ablauf beim Abschicken: Beim Öffnen des Bildschirms wird reserviert (Auszahlung mit Code, noch nicht geteilt).
// Erst danach kann geteilt werden (das Teilen-Fenster braucht einen frischen Tipp). Wird nicht geteilt, bleibt die
// Reservierung stehen und wird beim nächsten Mal mit neuer Zeit ergänzt (gleicher Code). Nach dem Teilen: Status „geteilt“.

export const FORMAT_QUELLE = 'konto-quelle-1';
export const FORMAT_AUSZAHLUNGEN = 'konto-auszahlungen-1';
export const ORDNER = 'konto';
export const LISTE_MAX = 300;
const zahl = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const summen = (x) => ({ kum: zahl(x && x.kum), kumA: zahl(x && x.kumA), kumMs: zahl(x && x.kumMs), ...(zahl(x && x.kumF) ? { kumF: zahl(x.kumF) } : {}) });
const kf = (x) => zahl(x && x.kumF);

export const quelleId = (app, geraet) => `${app}-${geraet}`;
export const quellPfad = (ordner, quelle) => `daten/${ordner}/${ORDNER}/${quelle}.json`;
export const auszahlungsPfad = (ordner) => `daten/${ordner}/${ORDNER}/auszahlungen.json`;

// Neues Kassenbuch. Startet mit einem Übertrag des alten Kontos (noch nicht abgeschickte Zeit), damit nichts verloren geht.
export function kasseNeu(app, geraet, konto, t = new Date().toISOString()) {
  const k = { app, quelle: quelleId(app, geraet), n: 0, kum: 0, kumA: 0, kumMs: 0, hochN: 0, bez: {}, fremd: {}, res: null, melden: [], letzte: [] };
  const sek = zahl(konto && konto.stand);
  if (sek > 0) buchen(k, { sek, a: zahl(konto.aufgaben), ms: konto.msVoll ? zahl(konto.ms) : 0, t, art: 'uebertrag' });
  return k;
}

// Kassenbuch aus dem Speicher prüfen (fehlende Felder ergänzen)
export function kasseVon(k) {
  if (!k || typeof k !== 'object' || !k.quelle) return null;
  return {
    app: k.app || 'mathe', quelle: k.quelle, n: zahl(k.n), ...summen(k), hochN: zahl(k.hochN),
    bez: k.bez && typeof k.bez === 'object' ? Object.fromEntries(Object.entries(k.bez).map(([q, v]) => [q, summen(v)])) : {},
    fremd: k.fremd && typeof k.fremd === 'object' ? k.fremd : {},
    res: k.res && typeof k.res === 'object' && /^[A-Z0-9]{4}$/.test(k.res.code || '') ? k.res : null,
    melden: Array.isArray(k.melden) ? k.melden.filter(c => /^[A-Z0-9]{4}$/.test(c)).slice(-20) : [],
    letzte: Array.isArray(k.letzte) ? k.letzte.slice(-30) : []
  };
}

// Eine Buchung: sek Bildschirmzeit, a Aufgaben (bzw. Lesekarten), ms Übungszeit (je Aufgabe höchstens 10 Min.), f neu gelesene Folgen (Lesen)
export function buchen(k, { sek, a = 1, ms = 0, f = 0, t = new Date().toISOString(), art }) {
  const s = zahl(sek), aa = zahl(a), m = art === 'uebertrag' ? zahl(ms) : Math.min(zahl(ms), 10 * 60 * 1000), ff = zahl(f);
  if (!s && !aa) return null;
  k.n += 1; k.kum += s; k.kumA += aa; k.kumMs += m;
  if (ff) k.kumF = kf(k) + ff;
  const b = { n: k.n, t, sek: s, ...(aa !== 1 ? { a: aa } : {}), ...(m ? { ms: m } : {}), ...(ff ? { f: ff } : {}), ...(art ? { art } : {}) };
  k.letzte = [...(k.letzte || []), b].slice(-30);
  return b;
}

// Inhalt der eigenen Quell-Datei
export function quellDatei(k, geraet, heute, t = new Date().toISOString()) {
  return { format: FORMAT_QUELLE, app: k.app, geraet, quelle: k.quelle, n: k.n, kum: k.kum, kumA: k.kumA, kumMs: k.kumMs, ...(kf(k) ? { kumF: kf(k) } : {}),
    ...(heute ? { heute } : {}), geaendert: t, letzte: k.letzte };
}
// Darf die eigene Datei auf dem Server überschrieben werden? Nie mit weniger Buchungen.
export const darfSchreiben = (k, server) => !server || zahl(server.n) <= k.n;

// Auszahlungs-Datei prüfen
export function auszahlungenVon(d) {
  const x = d && typeof d === 'object' ? d : {};
  return {
    format: FORMAT_AUSZAHLUNGEN,
    bezahlt: x.bezahlt && typeof x.bezahlt === 'object' ? Object.fromEntries(Object.entries(x.bezahlt).map(([q, v]) => [q, summen(v)])) : {},
    liste: Array.isArray(x.liste) ? x.liste.filter(e => e && /^[A-Z0-9]{4}$/.test(e.code || '')) : []
  };
}

// Stand aller Quellen: die eigene aus dem Speicher (immer am neuesten), die anderen aus ihren Dateien auf dem Server
export function quellenStand(k, fremd) {
  const q = { [k.quelle]: { app: k.app, ...summen(k) } };
  for (const [id, f] of Object.entries(fremd || {})) if (id !== k.quelle && f) q[id] = { app: f.app || id.split('-')[0], ...summen(f) };
  return q;
}

// Offene Zeit je Quelle (Summe − bezahlt). Ergebnis: { teile: { quelle: { app, sek, a, ms, bis } }, sek, je: { app: { sek, a, ms } } }
export function offen(quellen, bezahlt) {
  const teile = {}, je = {};
  let sek = 0;
  for (const [id, q] of Object.entries(quellen)) {
    const b = summen(bezahlt && bezahlt[id]);
    const f = Math.max(0, kf(q) - kf(b));
    const t = { app: q.app, sek: Math.max(0, q.kum - b.kum), a: Math.max(0, q.kumA - b.kumA), ms: Math.max(0, q.kumMs - b.kumMs), ...(f ? { f } : {}), bis: summen(q) };
    if (t.sek <= 0 && t.a <= 0) continue;
    teile[id] = t; sek += t.sek;
    const j = je[q.app] || (je[q.app] = { sek: 0, a: 0, ms: 0, f: 0 });
    j.sek += t.sek; j.a += t.a; j.ms += t.ms; j.f += f;
  }
  return { teile, sek, je };
}

// Summen einer Auszahlung je App (für Anzeige und Nachricht)
export function jeApp(teile) {
  const je = {};
  for (const t of Object.values(teile || {})) {
    const j = je[t.app] || (je[t.app] = { sek: 0, a: 0, ms: 0, f: 0 });
    j.sek += t.sek || 0; j.a += t.a || 0; j.ms += t.ms || 0; j.f += t.f || 0;
  }
  return je;
}

// Reservieren bzw. eine bestehende Reservierung ergänzen. datei = gelesene auszahlungen.json (oder null).
// res = Reservierung dieses Geräts (oder null), code = Code für eine neue Reservierung.
// Gibt { datei (neu zu schreiben, null = nichts zu schreiben), eintrag } zurück; eintrag null = nichts offen.
export function reservieren(datei, quellen, { res, code, app, geraet, t = new Date().toISOString() }) {
  const d = auszahlungenVon(datei);
  const vorhanden = res ? d.liste.find(e => e.code === res.code) : null;
  if (vorhanden && vorhanden.status === 'geteilt') return { datei: null, eintrag: { ...vorhanden }, schonGeteilt: true };
  const o = offen(quellen, d.bezahlt);
  if (vorhanden) {
    if (o.sek <= 0 && Object.keys(o.teile).length === 0) return { datei: null, eintrag: { ...vorhanden } };
    const teile = { ...(vorhanden.teile || {}) };
    for (const [id, x] of Object.entries(o.teile)) {
      const alt = teile[id] || { app: x.app, sek: 0, a: 0, ms: 0 };
      const f = (alt.f || 0) + (x.f || 0);
      teile[id] = { app: x.app, sek: alt.sek + x.sek, a: alt.a + x.a, ms: alt.ms + x.ms, ...(f ? { f } : {}), bis: x.bis };
    }
    const eintrag = eintragAus({ ...vorhanden, teile, t_neu: t });
    const bezahlt = { ...d.bezahlt };
    for (const [id, x] of Object.entries(o.teile)) bezahlt[id] = x.bis;
    return { datei: { ...d, bezahlt, liste: d.liste.map(e => e.code === eintrag.code ? eintrag : e) }, eintrag };
  }
  if (o.sek <= 0) return { datei: null, eintrag: null };
  const neuCode = res && res.code ? res.code : code; // Reservierung kam nie an: denselben Code nehmen
  const eintrag = eintragAus({ code: neuCode, t, app, geraet, status: 'reserviert', teile: o.teile });
  const bezahlt = { ...d.bezahlt };
  for (const [id, x] of Object.entries(o.teile)) bezahlt[id] = x.bis;
  return { datei: { ...d, bezahlt, liste: [...d.liste, eintrag].slice(-LISTE_MAX) }, eintrag };
}
function eintragAus(e) {
  const je = jeApp(e.teile);
  const sek = Object.values(e.teile).reduce((s, x) => s + (x.sek || 0), 0);
  const { t_neu, ...rest } = e;
  return { ...rest, ...(t_neu ? { geaendert: t_neu } : {}), sek, mathe: (je.mathe && je.mathe.sek) || 0, lesen: (je.lesen && je.lesen.sek) || 0,
    aufgaben: (je.mathe && je.mathe.a) || 0, lesekarten: (je.lesen && je.lesen.a) || 0, folgen: (je.lesen && je.lesen.f) || 0, uebung_ms: Object.values(je).reduce((s, x) => s + x.ms, 0) };
}

// Nach dem Teilen: Status „geteilt“ eintragen (Eltern-App zählt nur geteilte als eingelöst)
export function alsGeteilt(datei, code, t = new Date().toISOString()) {
  const d = auszahlungenVon(datei);
  const e = d.liste.find(x => x.code === code);
  if (!e || e.status === 'geteilt') return null;
  return { ...d, liste: d.liste.map(x => x.code === code ? { ...x, status: 'geteilt', geteilt: t } : x) };
}

// Anzeige für das Kind: alles, was noch nicht geteilt ist (offen bei allen Quellen + eigene Reservierung).
// bezahlt = zuletzt bekannter Stand vom Server, fremd = zuletzt bekannte andere Quellen.
export function anzeige(k) {
  const o = offen(quellenStand(k, k.fremd), k.bez);
  const res = k.res ? { sek: k.res.sek || 0, je: jeApp(k.res.teile) } : { sek: 0, je: {} };
  const je = {};
  for (const src of [o.je, res.je]) for (const [app, x] of Object.entries(src)) {
    const j = je[app] || (je[app] = { sek: 0, a: 0, ms: 0, f: 0 });
    j.sek += x.sek; j.a += x.a; j.ms += x.ms; j.f += x.f || 0;
  }
  return { sek: o.sek + res.sek, je };
}

// Neue Quell-Dateien und Auszahlungen übernehmen (nach dem Lesen vom Server)
export function serverStand(k, datei, fremdDateien) {
  const d = auszahlungenVon(datei);
  k.bez = d.bezahlt;
  const fremd = {};
  for (const f of fremdDateien || []) if (f && f.quelle && f.quelle !== k.quelle) fremd[f.quelle] = { app: f.app, ...summen(f), heute: f.heute || null, geaendert: f.geaendert || null };
  k.fremd = fremd;
  // Eigene Reservierung: auf dem Server schon geteilt (z. B. von früher) → erledigt
  if (k.res) { const e = d.liste.find(x => x.code === k.res.code); if (e && e.status === 'geteilt') k.res = null; else if (e) k.res = e; }
  return k;
}
