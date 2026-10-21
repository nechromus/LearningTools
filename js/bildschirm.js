// Bildschirmzeit: Minuten für Konsole, Computer und Videos außerhalb der App.
// Wird wie die Spielzeit verdient (gleiche Regeln), mal einem Faktor aus der Eltern-App.
// Kommt auf ein eigenes Konto, nicht auf die Spielzeit. Das Kind schickt sie per Nachricht an die Eltern.
// Reine Logik ohne DOM (testbar mit node).

export const FAKTOREN = [0.5, 1, 1.5, 2];
export const HOECHSTWERTE = [15, 30, 45, 60];   // Minuten pro Tag
export const EXTRAS = [0, 15, 30, 60];           // „Nur heute mehr zulassen“ (Minuten)
export const BZ_STANDARD = Object.freeze({ an: true, faktor: 1, max: 45, extra: null });

// Einstellungen aus der Eltern-App prüfen. extra = { tag: 'JJJJ-MM-TT', min } gilt nur an diesem Tag.
export function bzRegeln(r) {
  const S0 = BZ_STANDARD;
  if (!r || typeof r !== 'object') return { an: S0.an, faktor: S0.faktor, max: S0.max, extra: null };
  const extra = r.extra && /^\d{4}-\d{2}-\d{2}$/.test(r.extra.tag) && EXTRAS.includes(r.extra.min) && r.extra.min > 0
    ? { tag: r.extra.tag, min: r.extra.min } : null;
  return {
    an: typeof r.an === 'boolean' ? r.an : S0.an,
    faktor: FAKTOREN.includes(r.faktor) ? r.faktor : S0.faktor,
    max: HOECHSTWERTE.includes(r.max) ? r.max : S0.max,
    extra
  };
}

// Erlaubte Sekunden an einem Tag
export function grenzeSek(regeln, tag) {
  const r = bzRegeln(regeln);
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

export const restSek = (konto, regeln) => Math.max(0, grenzeSek(regeln, konto.tag) - konto.heute);

// Spielzeit-Sekunden einer Aufgabe in Bildschirmzeit umrechnen und gutschreiben (höchstens bis zur Tagesgrenze).
// Gibt { plus, voll } zurück. voll = Tagesgrenze jetzt erreicht.
export function gutschreiben(konto, spielSek, regeln) {
  const r = bzRegeln(regeln);
  const roh = Math.round(Math.max(0, spielSek) * r.faktor);
  const plus = Math.min(roh, restSek(konto, r));
  konto.stand += plus;
  konto.heute += plus;
  konto.aufgaben += 1;
  return { plus, voll: restSek(konto, r) <= 0 };
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
