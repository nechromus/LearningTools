// Aufgabenpakete: benannte Sammlung von Themen mit Gewichten (aus / wenig / normal / viel).
// Ein Paket wird pro Kind aktiviert; die Gewichte lassen sich pro Kind anpassen.
// Format für Pakete (auch zum Erstellen mit Claude): siehe app-uebergabe/06-aufgabenpakete.md
import { THEMEN } from './logic.js';
import { etappenNorm, VARIANTEN, FAECHER, WEITER, FORMAT2, STUFE_MAX, grenzenSchluesselOk, baukaestenVon } from './lernplan.js';

export const FORMAT = 'lernapp-paket-1';
export const STUFEN = [
  { w: 0, name: 'aus' }, { w: 1, name: 'wenig' }, { w: 2, name: 'normal' }, { w: 4, name: 'viel' }
];
const ERLAUBT = STUFEN.map(s => s.w);

// Kurze Kopfrechen-Aufgaben: welches Thema welche Baukästen nutzt
export const KOPF_GEN = {
  'minus-zahlen': ['minus-plus'], 'reihenfolge': ['reihenfolge'], 'potenzen': ['potenz'], 'einmaleins': ['einmaleins'],
  'mal-10': ['mal10'], 'prozent': ['prozent'], 'prozent-baukasten': ['baukasten'], 'prozent-formel': ['prozent-formel'], 'kreisdiagramm': ['kreisdiagramm'], 'runden': ['runden'], 'bruch-bild': ['bruch-bild'],
  // Physik und Umstellen (Auftrag 13): kommen wie kurze Aufgaben, etwa halb Pool, halb Baukasten
  'zehnerpotenzen': ['zehnerpotenz'], 'einheiten': ['einheiten'], 'gewichtskraft': ['gewichtskraft'], 'umstellen': ['gleichung', 'formel-umstellen'], 'dichte': ['dichte']
};
// Themen, die etwa zur Hälfte aus dem Pool kommen (mit Geschichten), sonst aus dem Baukasten (neutrale Zahlen)
export const HALB_POOL = ['zehnerpotenzen', 'einheiten', 'gewichtskraft', 'umstellen', 'dichte'];
export const BLOCK_GEN = { 'einmaleins': 'einmaleins', 'potenzen': 'potenz', 'mal-10': 'mal10', 'minus-zahlen': 'minus-plus' };
export const KOPF_THEMEN = Object.keys(KOPF_GEN);
export const WEITERE_THEMEN = THEMEN.filter(t => !KOPF_THEMEN.includes(t));

// Eingebautes Paket: entspricht der bisherigen Mischung für die BOA-Vorbereitung
export const STANDARD_PAKET = Object.freeze({
  format: FORMAT, id: 'boa-10', name: 'BOA Mathe Klasse 10',
  beschreibung: 'Grundlagen für den BOA-Teil ohne Hilfsmittel, dazu Kugel mit Taschenrechner.',
  gewichte: Object.freeze(Object.fromEntries(THEMEN.map(t => [t, 2])))
});

export function stufeName(w) { return (STUFEN.find(s => s.w === w) || STUFEN[2]).name; }

// Nur bekannte Themen, nur erlaubte Stufen; fehlende Themen = aus
export function gewichteNorm(g) {
  const out = {};
  for (const t of THEMEN) {
    const v = g && Number(g[t]);
    out[t] = ERLAUBT.includes(v) ? v : 0;
  }
  return out;
}

// Gewichte ohne Paket aus der Eltern-App: Standard, das Übungsthema auf „viel“
export function gewichteOhnePaket(uebungsthema) {
  const g = { ...STANDARD_PAKET.gewichte };
  for (const t of THEMEN) g[t] = t === uebungsthema ? 4 : 1;
  return g;
}

export const idAusName = (name) => String(name || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// Prüft ein Paket (z. B. von Claude als Text erstellt). Gibt { paket, fehler, hinweise } zurück.
// optionen.poolIds: Set der Aufgaben-ids im Pool (prüft die ids der Etappen)
export function paketPruefen(roh, { poolIds = null } = {}) {
  const fehler = [], hinweise = [];
  let p = roh;
  if (typeof roh === 'string') {
    try { p = JSON.parse(roh.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { return { paket: null, fehler: ['Der Text ist kein gültiges JSON.'], hinweise }; }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { paket: null, fehler: ['Ein Paket muss ein JSON-Objekt sein.'], hinweise };
  const name = String(p.name || '').trim().slice(0, 40);
  if (name.length < 2) fehler.push('Das Paket braucht einen Namen (2 bis 40 Zeichen).');
  const id = /^[a-z0-9][a-z0-9-]{1,39}$/.test(p.id || '') ? p.id : idAusName(name);
  if (!p.gewichte || typeof p.gewichte !== 'object') fehler.push('Es fehlen die Gewichte („gewichte“).');
  const gewichte = gewichteNorm(p.gewichte);
  if (p.gewichte && typeof p.gewichte === 'object') {
    for (const [t, v] of Object.entries(p.gewichte)) {
      if (!THEMEN.includes(t)) hinweise.push(`Thema „${t}“ gibt es in der App noch nicht. Es wird ignoriert.`);
      else if (!ERLAUBT.includes(Number(v))) hinweise.push(`${t}: Gewicht ${v} ist nicht erlaubt (0, 1, 2 oder 4). Es wird „aus“.`);
    }
    const fehlt = THEMEN.filter(t => !(t in p.gewichte));
    if (fehlt.length) hinweise.push(`Nicht genannt und damit aus: ${fehlt.join(', ')}.`);
  }
  if (!Object.values(gewichte).some(v => v > 0) && !fehler.length) fehler.push('Mindestens ein Thema muss an sein.');
  if (!KOPF_THEMEN.some(t => gewichte[t] > 0) && !fehler.length) hinweise.push('Kein Thema für kurze Aufgaben ist an. Die App nimmt dann die anderen Themen.');
  // Format 2: Fach, Weiter-Regel, Etappen (12-lerneinheiten-und-pakete.md)
  let etappen = [];
  if (p.etappen != null) {
    if (!Array.isArray(p.etappen)) fehler.push('„etappen“ muss eine Liste sein.');
    else {
      p.etappen.forEach((e, i) => {
        const nr = i + 1;
        if (!e || typeof e !== 'object') { fehler.push(`Etappe ${nr}: kein gültiger Eintrag.`); return; }
        if (Number(e.nr) !== nr) fehler.push(`Etappe ${nr}: Nummer ${e.nr ?? 'fehlt'}. Die Etappen müssen lückenlos ab 1 nummeriert sein.`);
        if (!String(e.name || '').trim()) fehler.push(`Etappe ${nr}: Name fehlt.`);
        for (const [t, g] of Object.entries(e.grenzen || {})) {
          if (!grenzenSchluesselOk(t)) { hinweise.push(`Etappe ${nr}: Baukasten oder Thema „${t}“ gibt es nicht, die Grenze wird ignoriert.`); continue; }
          if (g && g.stufe_max != null && !(Number.isInteger(g.stufe_max) && g.stufe_max >= 1 && g.stufe_max <= STUFE_MAX)) fehler.push(`Etappe ${nr}, ${t}: stufe_max ${g.stufe_max} geht nicht (1 bis ${STUFE_MAX}).`);
          for (const v of (g && g.ohne) || []) if (!baukaestenVon(t).some(b => (VARIANTEN[b] || []).includes(v))) fehler.push(`Etappe ${nr}, ${t}: Variante „${v}“ kennt die App nicht.`);
        }
        if (poolIds) for (const aid of e.aufgaben || []) if (!poolIds.has(aid)) fehler.push(`Etappe ${nr}: Aufgabe „${aid}“ gibt es in der Aufgabensammlung nicht.`);
      });
      etappen = etappenNorm(p.etappen);
    }
  }
  if (p.fach != null && !FAECHER.includes(p.fach)) hinweise.push(`Fach „${p.fach}“ kennt die App noch nicht. Es wird „mathe“.`);
  const paket = {
    format: etappen.length ? FORMAT2 : FORMAT, id, name, fach: FAECHER.includes(p.fach) ? p.fach : 'mathe',
    beschreibung: String(p.beschreibung || '').slice(0, 300), gewichte,
    ...(etappen.length ? { weiter: WEITER.includes(p.weiter) ? p.weiter : 'hand', etappen } : {})
  };
  return { paket: fehler.length ? null : paket, fehler, hinweise };
}

// Zufällig nach Gewicht ziehen. optionen: [{ w, ... }]. Gibt null zurück, wenn alle 0 sind.
export function ziehe(optionen, rng = Math.random) {
  const summe = optionen.reduce((s, o) => s + (o.w > 0 ? o.w : 0), 0);
  if (summe <= 0) return null;
  let r = rng() * summe;
  for (const o of optionen) { if (o.w > 0) { r -= o.w; if (r < 0) return o; } }
  return optionen.filter(o => o.w > 0).pop();
}

// Thema für eine kurze Aufgabe ziehen. Das zuletzt gezogene Thema zählt nur halb (weniger Wiederholung am Stück).
export function kopfThema(gewichte, rng = Math.random, zuletzt = null) {
  const o = ziehe(KOPF_THEMEN.map(t => ({ t, w: (gewichte[t] || 0) * (t === zuletzt ? 0.5 : 1) })), rng);
  return o ? o.t : null;
}

// Ungefährer Anteil jedes Themas an den kurzen Aufgaben (für die Anzeige)
export function kopfAnteile(gewichte) {
  const summe = KOPF_THEMEN.reduce((s, t) => s + (gewichte[t] || 0), 0);
  return Object.fromEntries(KOPF_THEMEN.map(t => [t, summe ? Math.round((gewichte[t] || 0) / summe * 100) : 0]));
}
