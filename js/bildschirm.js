// Bildschirmzeit: Minuten für Konsole, Computer und Videos außerhalb der App.
// Wird wie die Spielzeit verdient (gleiche Regeln), mal einem Faktor aus der Eltern-App.
// Kommt auf ein eigenes Konto, nicht auf die Spielzeit. Das Kind schickt sie per Nachricht an die Eltern.
// Reine Logik ohne DOM (testbar mit node).

export const FAKTOREN = [0.5, 1, 1.5, 2];
export const HOECHSTWERTE = [15, 30, 45, 60];   // Minuten pro Tag
export const EXTRAS = [0, 15, 30, 60];           // „Nur heute mehr zulassen“ (Minuten)
export const MINDESTWERTE = [5, 10, 15, 30];     // Abschicken erst ab so vielen Minuten
export const EXTRA_FAKTOREN = [0.5, 0.75, 1];    // „Nur heute mehr“: so viel zählt der Lohn in der Extra-Zeit (Auftrag 18)
const extraVon = (e) => (e && /^\d{4}-\d{2}-\d{2}$/.test(e.tag) && EXTRAS.includes(e.min) && e.min > 0
  ? { tag: e.tag, min: e.min, faktor: EXTRA_FAKTOREN.includes(e.faktor) ? e.faktor : 0.5 } : null);
// Lohn gutschreiben: bis zur normalen Grenze voll, danach (Extra-Zeit) mal Extra-Faktor, höchstens bis zur Tagesgrenze.
// heute = heute schon verdiente Sekunden. Gibt { plus, extra (Faktor oder null) } zurück.
export function mitExtra(roh, heute, normalSek, grenzeSek, faktor) {
  const platz = Math.max(0, grenzeSek - heute);
  let rest = Math.max(0, roh);
  const voll = Math.min(rest, Math.max(0, normalSek - heute), platz);
  rest -= voll;
  let plus = voll, verbraucht = voll, extra = null;
  if (rest > 0 && faktor != null && platz > voll) {
    const nutz = Math.min(rest, (platz - voll) / faktor);
    plus += nutz * faktor; verbraucht += nutz; extra = faktor;
  }
  // verbraucht: wie viel vom Lohn dafür nötig war (der Rest geht weiter, z. B. zur Spielzeit)
  return { plus: Math.round(plus), extra, verbraucht: Math.round(verbraucht) };
}
export const BZ_STANDARD = Object.freeze({ an: true, faktor: 1, max: 45, ab: 15, extra: null });

// Eigener Höchstwert (Auftrag 30): ganze Minuten 15–240 neben den festen Stufen, optional mit „gilt bis“ (max_bis).
// Nach max_bis gilt wieder max_danach (der vorherige Wert).
export const MAX_FREI = Object.freeze({ min: 15, max: 240 });
const heuteLokal = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
export const maxOk = (v, liste) => liste.includes(v) || (Number.isInteger(v) && v >= MAX_FREI.min && v <= MAX_FREI.max);
export function maxVon(r, liste, std, heute = heuteLokal()) {
  const bis = /^\d{4}-\d{2}-\d{2}$/.test(r.max_bis || '') ? r.max_bis : null;
  const danach = maxOk(r.max_danach, liste) ? r.max_danach : std;
  if (bis && heute > bis) return { max: danach };
  const max = maxOk(r.max, liste) ? r.max : std;
  return bis ? { max, max_bis: bis, max_danach: danach } : { max };
}

// Einstellungen aus der Eltern-App prüfen. extra = { tag: 'JJJJ-MM-TT', min } gilt nur an diesem Tag.
export function bzRegeln(r, heute) {
  const S0 = BZ_STANDARD;
  if (!r || typeof r !== 'object') return { an: S0.an, faktor: S0.faktor, max: S0.max, ab: S0.ab, extra: null };
  const extra = extraVon(r.extra);
  const m = maxVon(r, HOECHSTWERTE, S0.max, heute);
  return {
    an: typeof r.an === 'boolean' ? r.an : S0.an,
    faktor: FAKTOREN.includes(r.faktor) ? r.faktor : S0.faktor,
    max: m.max,
    ab: MINDESTWERTE.includes(r.ab) ? r.ab : S0.ab,
    extra,
    ...(m.max_bis ? { max_bis: m.max_bis, max_danach: m.max_danach } : {})
  };
}

// Erlaubte Sekunden an einem Tag
export function grenzeSek(regeln, tag) {
  const r = bzRegeln(regeln, tag);
  return (r.max + (r.extra && r.extra.tag === tag ? r.extra.min : 0)) * 60;
}

// Konto auf dem Gerät: { stand (Sekunden, bleibt über Nacht), tag, heute (heute verdient), aufgaben (seit dem letzten Abschicken), code }
export function kontoVon(b, tag) {
  const k = b && typeof b === 'object' ? b : {};
  const stand = Number.isFinite(k.stand) && k.stand > 0 ? Math.round(k.stand) : 0;
  const gleicherTag = k.tag === tag;
  return {
    stand,
    tag,
    heute: gleicherTag && Number.isFinite(k.heute) && k.heute > 0 ? Math.round(k.heute) : 0,
    aufgaben: Number.isInteger(k.aufgaben) && k.aufgaben > 0 ? k.aufgaben : 0,
    code: typeof k.code === 'string' && /^[A-Z0-9]{4}$/.test(k.code) ? k.code : null
  };
}

// Abschicken erst ab der Mindestzeit (Standard 15 Min.)
export const abSek = (regeln) => bzRegeln(regeln).ab * 60;
export const kannAbschicken = (konto, regeln) => konto.stand > 0 && konto.stand >= abSek(regeln);

export const restSek = (konto, regeln) => Math.max(0, grenzeSek(regeln, konto.tag) - konto.heute);

// Spielzeit-Sekunden einer Aufgabe in Bildschirmzeit umrechnen und gutschreiben (höchstens bis zur Tagesgrenze).
// Gibt { plus, voll } zurück. voll = Tagesgrenze jetzt erreicht.
export function gutschreiben(konto, spielSek, regeln) {
  const r = bzRegeln(regeln, konto.tag);
  const roh = Math.round(Math.max(0, spielSek) * r.faktor);
  const ex = r.extra && r.extra.tag === konto.tag ? r.extra : null;
  const g = mitExtra(roh, konto.heute, r.max * 60, grenzeSek(r, konto.tag), ex ? ex.faktor : null);
  const plus = g.plus;
  konto.stand += plus;
  konto.heute += plus;
  konto.aufgaben += 1;
  return { plus, voll: restSek(konto, r) <= 0, extra: g.extra, verbraucht: g.verbraucht };
}

// Kurzer Code ohne leicht verwechselbare Zeichen (kein 0/O, 1/I/L, 5/S, 8/B, 2/Z)
const ZEICHEN = 'ACDEFGHJKMNPQRTUVWXY34679';
export function neuerCode(rnd = Math.random) {
  let c = '';
  for (let i = 0; i < 4; i++) c += ZEICHEN[Math.floor(rnd() * ZEICHEN.length) % ZEICHEN.length];
  return c;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const zwei = (n) => String(n).padStart(2, '0');
export function zeitpunktText(d) {
  return `${WOCHENTAGE[d.getDay()]} ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}., ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

// Minuten als Text: „14 Min.“, „13,5 Min.“
export function minText(sek) {
  const m = Math.round(sek / 6) / 10;
  return `${String(m).replace('.', ',')} Min.`;
}

// Text für die Nachricht an die Eltern
export function nachrichtText(konto, jetzt) {
  const a = konto.aufgaben;
  return `📺 Bildschirmzeit: ${minText(konto.stand)}\n${zeitpunktText(jetzt)} · ${a} ${a === 1 ? 'Aufgabe' : 'Aufgaben'}\nCode: ${konto.code}`;
}

// Nach dem Teilen: Konto auf 0, Eintrag für das Protokoll zurückgeben
export function abschicken(konto) {
  const eintrag = { sekunden: konto.stand, aufgaben: konto.aufgaben, code: konto.code };
  konto.stand = 0;
  konto.aufgaben = 0;
  konto.code = null;
  return eintrag;
}

// ---------- Spielzeit im Schrein: Höchstwert pro Tag ----------
// Zählt nur die mit Aufgaben verdiente Spielzeit (nicht die geschenkten Basis-Minuten).
export const SZ_HOECHSTWERTE = [15, 30, 45, 60, 90];
export const SZ_STANDARD = Object.freeze({ max: 45, extra: null });
export function szRegeln(r, heute) {
  if (!r || typeof r !== 'object') return { max: SZ_STANDARD.max, extra: null };
  const extra = extraVon(r.extra);
  const m = maxVon(r, SZ_HOECHSTWERTE, SZ_STANDARD.max, heute);
  return { max: m.max, extra, ...(m.max_bis ? { max_bis: m.max_bis, max_danach: m.max_danach } : {}) };
}
export function szGrenzeSek(regeln, tag) {
  const r = szRegeln(regeln, tag);
  return (r.max + (r.extra && r.extra.tag === tag ? r.extra.min : 0)) * 60;
}
// Noch verdienbare Spielzeit heute (verdient = heute schon mit Aufgaben verdiente Sekunden)
export const szRestSek = (regeln, tag, verdient) => Math.max(0, szGrenzeSek(regeln, tag) - Math.max(0, verdient || 0));
// Spielzeit einer Aufgabe gutschreiben: normale Grenze voll, Extra-Zeit mal Extra-Faktor
export function szGutschrift(regeln, tag, verdient, sek) {
  const r = szRegeln(regeln, tag);
  const ex = r.extra && r.extra.tag === tag ? r.extra : null;
  return mitExtra(sek, Math.max(0, verdient || 0), r.max * 60, szGrenzeSek(r, tag), ex ? ex.faktor : null);
}

// ---------- Übungszeit pro Tag (Auftrag 13) ----------
// Gezählt wird die Zeit in Aufgaben. Bei max: freundlicher Hinweis, die laufende Aufgabe darf fertig werden.
// Nach weiteren nachlauf_prozent ist Schluss. „Heute mehr“ (+15/+30/+60) gilt nur am genannten Tag.
export const UZ_HOECHSTWERTE = [20, 30, 45, 60, 75, 90, 120];
export const UZ_EXTRAS = [15, 30, 60];
export function uzRegeln(r) {
  if (!r || typeof r !== 'object') return { an: false, max: 60, nachlauf_prozent: 10, extra: null };
  const extra = r.extra && /^\d{4}-\d{2}-\d{2}$/.test(r.extra.tag) && Number.isInteger(r.extra.min) && r.extra.min > 0 && r.extra.min <= 180
    ? { tag: r.extra.tag, min: r.extra.min } : null;
  const max = Number.isInteger(r.max) && r.max >= 5 && r.max <= 240 ? r.max : 60;
  const nl = Number.isInteger(r.nachlauf_prozent) && r.nachlauf_prozent >= 0 && r.nachlauf_prozent <= 50 ? r.nachlauf_prozent : 10;
  return { an: r.an === true, max, nachlauf_prozent: nl, extra };
}
export function uzGrenzen(regeln, tag) {
  const r = uzRegeln(regeln);
  const max = (r.max + (r.extra && r.extra.tag === tag ? r.extra.min : 0)) * 60;
  return { an: r.an, hinweis: max, schluss: Math.round(max * (1 + r.nachlauf_prozent / 100)) };
}
// Stand: { tag, sek, hinweis (schon gezeigt), code }
export function uzKontoVon(k, tag) {
  if (!k || typeof k !== 'object' || k.tag !== tag) return { tag, sek: 0, hinweis: false, code: null, gefragt: null };
  return { tag, sek: Math.max(0, Number(k.sek) || 0), hinweis: !!k.hinweis, code: k.code || null, gefragt: k.gefragt || null };
}
// 'frei' | 'hinweis' (Pensum erreicht, laufende Aufgabe fertig machen) | 'schluss'
export function uzStatus(konto, regeln) {
  const g = uzGrenzen(regeln, konto.tag);
  if (!g.an) return 'frei';
  if (konto.sek >= g.schluss) return 'schluss';
  if (konto.sek >= g.hinweis) return 'hinweis';
  return 'frei';
}
export function uzNachricht(name, konto, code) {
  return `✦ Mehr Übungszeit?\n${name || 'Ich'} hat heute ${Math.floor(konto.sek / 60)} Min. geübt.\nCode: ${code}`;
}
