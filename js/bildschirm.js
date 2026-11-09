// Bildschirmzeit: Minuten für Konsole, Computer und Videos außerhalb der App.
// Wird wie die Spielzeit verdient (gleiche Regeln), mal einem Faktor aus der Eltern-App.
// Kommt auf ein eigenes Konto, nicht auf die Spielzeit. Das Kind schickt sie per Nachricht an die Eltern.
// Reine Logik ohne DOM (testbar mit node).

export const FAKTOREN = [0.5, 1, 1.5, 2];
// Grundfaktor als Schieberegler (Auftrag 49): 0,10–1,50 in Schritten von 0,05 (alte Werte bis 2 bleiben gültig)
export const FAKTOR_REGLER = Object.freeze({ min: 0.1, max: 1.5, schritt: 0.05 });
const f05 = (v) => Number.isFinite(v) && v >= 0.1 - 1e-9 && v <= 2 + 1e-9 && Math.abs(v * 20 - Math.round(v * 20)) < 1e-6;
export const faktorOk = (v) => FAKTOREN.includes(v) || f05(v);
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
    faktor: faktorOk(r.faktor) ? Math.round(r.faktor * 100) / 100 : S0.faktor,
    ...(r.stufen_an === true || Array.isArray(r.stufen) ? { stufen_an: r.stufen_an === true, stufen: stufenVon(r.stufen) } : {}),
    ...(Number.isFinite(r.schnitt) && r.schnitt >= 10 && r.schnitt <= 1200 ? { schnitt: Math.round(r.schnitt) } : {}),
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
    code: typeof k.code === 'string' && /^[A-Z0-9]{4}$/.test(k.code) ? k.code : null,
    gesendet: codesVon(k.gesendet),
    // Auftrag 49: Übungszeit heute in ms (je Aufgabe höchstens 10 Min.) und Übungszeit beim Start der Extra-Runde
    uebMs: gleicherTag && Number.isFinite(k.uebMs) && k.uebMs > 0 ? Math.round(k.uebMs) : 0,
    extraAb: gleicherTag && Number.isFinite(k.extraAb) && k.extraAb >= 0 ? Math.round(k.extraAb) : null
  };
}

// Schon abgeschickte Codes (die letzten 20), damit ein alter Stand vom Server nicht noch einmal abgeschickt wird
const CODE_RE = /^[A-Z0-9]{4}$/;
function codesVon(l) {
  return Array.isArray(l) ? [...new Set(l.filter(c => typeof c === 'string' && CODE_RE.test(c)))].slice(-20) : [];
}

// Nach dem Übernehmen eines Spielstands: Codes von Handy und Server zusammenführen.
// Steht im übernommenen Konto ein Code, der schon abgeschickt ist, war das Konto schon eingelöst: zurück auf 0.
// Gibt { sekunden, aufgaben, code } zurück, wenn zurückgesetzt wurde, sonst null.
export function schonGesendetPruefen(konto, lokaleCodes) {
  konto.gesendet = codesVon([...(konto.gesendet || []), ...(lokaleCodes || [])]);
  if (!konto.code || !konto.gesendet.includes(konto.code) || !(konto.stand > 0)) return null;
  const weg = { sekunden: konto.stand, aufgaben: konto.aufgaben, code: konto.code };
  konto.stand = 0;
  konto.aufgaben = 0;
  konto.code = null;
  return weg;
}

// Abschicken erst ab der Mindestzeit (Standard 15 Min.)
export const abSek = (regeln) => bzRegeln(regeln).ab * 60;
export const kannAbschicken = (konto, regeln) => konto.stand > 0 && konto.stand >= abSek(regeln);

export const restSek = (konto, regeln) => Math.max(0, grenzeSek(regeln, konto.tag) - konto.heute);

// Spielzeit-Sekunden einer Aufgabe in Bildschirmzeit umrechnen und gutschreiben (höchstens bis zur Tagesgrenze).
// Gibt { plus, voll } zurück. voll = Tagesgrenze jetzt erreicht.
export function gutschreiben(konto, spielSek, regeln, stufenFaktor = 1) {
  const r = bzRegeln(regeln, konto.tag);
  const roh = Math.round(Math.max(0, spielSek) * r.faktor * stufenFaktor);
  const ex = r.extra && r.extra.tag === konto.tag ? r.extra : null;
  const g = mitExtra(roh, konto.heute, r.max * 60, grenzeSek(r, konto.tag), ex ? ex.faktor : null);
  const plus = g.plus;
  konto.stand += plus;
  konto.heute += plus;
  konto.aufgaben += 1;
  return { plus, voll: restSek(konto, r) <= 0, extra: g.extra, verbraucht: g.verbraucht };
}

// ---------- Bildschirmzeit in Stufen (Auftrag 49) ----------
// Der Lohn je Aufgabe wird mal dem Faktor der Stufe beim Start der Aufgabe genommen. Die Stufe hängt an den Übungsminuten heute
// (Summe der Aufgabenzeiten, je Aufgabe höchstens 10 Min., ohne Spiele und Bögen). Ist die normale Grenze voll und gibt es
// heute Extra-Zeit, beginnen die Stufen wieder bei 0 Min. (Extra-Runde).
export const STUFEN_STD = Object.freeze([{ ab: 0, faktor: 0.3 }, { ab: 10, faktor: 0.5 }, { ab: 20, faktor: 0.7 }, { ab: 30, faktor: 1.05 }]);
export const STUFE_FAKTOR = Object.freeze({ min: 0.1, max: 2, schritt: 0.05 });
export const UEB_MAX_MS = 10 * 60 * 1000;
export function stufenVon(l) {
  if (!Array.isArray(l)) return STUFEN_STD.map(x => ({ ...x }));
  const ok = l.filter(x => x && Number.isInteger(x.ab) && x.ab >= 0 && x.ab <= 240 && f05(x.faktor))
    .map(x => ({ ab: x.ab, faktor: Math.round(x.faktor * 100) / 100 })).sort((a, b) => a.ab - b.ab)
    .filter((x, i, a) => i === 0 || x.ab !== a[i - 1].ab).slice(0, 8);
  if (!ok.length) return STUFEN_STD.map(x => ({ ...x }));
  if (ok[0].ab !== 0) ok[0] = { ...ok[0], ab: 0 };
  return ok;
}
// Extra-Runde: normale Grenze erreicht und heute gibt es Extra-Zeit
export function extraRunde(konto, regeln) {
  const r = bzRegeln(regeln, konto.tag);
  return !!(r.extra && r.extra.tag === konto.tag && konto.heute >= r.max * 60);
}
// Stand der Stufen. Ohne Stufen: { an: false, faktor: 1 }.
export function stufeVon(konto, regeln) {
  const r = bzRegeln(regeln, konto.tag);
  if (!r.stufen_an) return { an: false, faktor: 1 };
  const ex = extraRunde(konto, r);
  const ms = ex ? Math.max(0, konto.uebMs - (konto.extraAb ?? konto.uebMs)) : konto.uebMs;
  const min = ms / 60000;
  const st = stufenVon(r.stufen);
  let i = 0;
  while (i + 1 < st.length && min >= st[i + 1].ab) i++;
  const naechste = st[i + 1] || null;
  return { an: true, stufe: i + 1, anzahl: st.length, faktor: st[i].faktor, uebMin: Math.floor(min * 10) / 10, extraRunde: ex,
    bisNaechste: naechste ? Math.max(1, Math.ceil(naechste.ab - min)) : null, schnell: i + 1 === st.length && st.length > 1 };
}
// Nach jeder Aufgabe (auch für Spielzeit): Übungszeit buchen. Beginnt die Extra-Runde, merkt sich das Konto den Startpunkt.
export function uebungBuchen(konto, ms, regeln) {
  konto.uebMs += Math.min(Math.max(0, ms || 0), UEB_MAX_MS);
  extraStartMerken(konto, regeln);
}
export function extraStartMerken(konto, regeln) {
  if (konto.extraAb == null && extraRunde(konto, regeln)) konto.extraAb = konto.uebMs;
}
// Grobe Schätzung für die Eltern-App: Übungsminuten bis zur Grenze, bei lohnProMin (Lohn in s je Übungsminute vor allen Faktoren)
export function minutenBis(zielSek, lohnProMin, grundfaktor, stufen) {
  if (!(lohnProMin > 0) || !(grundfaktor > 0)) return null;
  const st = stufenVon(stufen);
  let sek = 0;
  for (let m = 0; m < 600; m++) {
    let i = 0;
    while (i + 1 < st.length && m >= st[i + 1].ab) i++;
    sek += lohnProMin * grundfaktor * st[i].faktor;
    if (sek >= zielSek) return m + 1;
  }
  return null;
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
  if (konto.code) konto.gesendet = codesVon([...(konto.gesendet || []), konto.code]);
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
