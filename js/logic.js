// Reine Logik ohne Bildschirm: Antworten, Fehlertypen, Spielzeit, Auswahl, Rechner, 2048.
// Alles hier ist ohne Browser testbar (siehe tests/).

export const SUPER = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

// ---------- Zahlen lesen ----------

export function parseZahl(text) {
  if (text == null) return { ok: false };
  const s = String(text).trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return { ok: false };
  const teile = s.replace('-', '').split('.');
  const nachkomma = teile[1] ? teile[1].length : 0;
  return { ok: true, wert: Number(s), nachkomma };
}

export const gleich = (a, b) => Math.abs(a - b) < 1e-9;

// Ziel: { wert, toleranz?, runden? }
export function pruefeZahl(text, ziel) {
  const p = parseZahl(text);
  if (!p.ok) return false;
  if (ziel.toleranz != null) {
    if (Math.abs(p.wert - ziel.wert) <= ziel.toleranz + 1e-9) return true;
    // „die ersten Nachkommastellen“: abgeschnitten oder gerundet, ab 2 Stellen
    if (p.nachkomma >= 2) {
      const f = 10 ** p.nachkomma;
      const ab = Math.trunc(ziel.wert * f) / f;
      const ge = Math.round(ziel.wert * f) / f;
      if (gleich(p.wert, ab) || gleich(p.wert, ge)) return true;
    }
    return false;
  }
  return gleich(p.wert, ziel.wert);
}

export function pruefeBruch(zText, nText, antwort) {
  const z = parseZahl(zText), n = parseZahl(nText);
  if (!z.ok || !n.ok || n.wert === 0) return false;
  if (gleich(z.wert, antwort.zaehler) && gleich(n.wert, antwort.nenner)) return true;
  if (antwort.kuerzen_erlaubt) return gleich(z.wert * antwort.nenner, n.wert * antwort.zaehler);
  return false;
}

// „3²“ → 9, „10³“ → 1000. null, wenn kein Potenz-Ausdruck.
export function potenzWert(ausdruck) {
  const m = /^\s*(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*$/.exec(ausdruck || '');
  if (!m) return null;
  const exp = Number([...m[2]].map(c => SUPER[c]).join(''));
  return { basis: Number(m[1]), exp, wert: Number(m[1]) ** exp };
}

// ---------- Typische Fehler erkennen ----------

// Auswahl-Schritte bei Körpern: falsche Länge gewählt. Gibt { typ, text } oder null zurück.
export function erkenneWahlFehler(aufgabe, teil, gewaehlt) {
  if (!teil || !Array.isArray(teil.optionen) || gewaehlt === teil.richtig) return null;
  const o = String(teil.optionen[gewaehlt] || ''), frage = teil.text || '';
  if (aufgabe.thema === 'pyramide' && /Volumen/.test(frage) && /^hₛ/.test(o)) return { typ: 'pyramide-hs-statt-h', text: 'hₛ liegt außen auf der Seitenfläche. Für das Volumen brauchst du h: von der Spitze gerade nach unten.' };
  if (aufgabe.thema === 'pyramide' && /Seitenfl/.test(frage) && /^h\s*=/.test(o)) return { typ: 'pyramide-h-statt-hs', text: 'Die Seitenfläche ist ein Dreieck außen. Seine Höhe ist hₛ.' };
  if (aufgabe.thema === 'kegel' && /Mantel/.test(frage) && /^h\s*=/.test(o)) return { typ: 'kegel-h-statt-s', text: 'Für den Mantel brauchst du s, die schräge Linie außen.' };
  return null;
}
// Gibt { typ, text } oder null zurück. teil = Schritt/Frage-Objekt oder null.

export function erkenneFehler(aufgabe, teil, eingabeText) {
  const p = parseZahl(eingabeText);
  if (!p.ok) return null;
  const w = p.wert;
  const ziel = teil ? teil.wert : aufgabe.antwort && aufgabe.antwort.wert;
  if (ziel == null) return null;

  // Radius aus Durchmesser: Rechenweg steht nicht in der Frage, Tipp erst nach einem Fehler
  if (teil && /^Radius\b/.test(teil.text || '')) {
    if (gleich(w, 2 * ziel)) return { typ: 'kugel-d-statt-r', text: 'Das ist der Durchmesser. Der Radius ist halb so lang.' };
    return { typ: 'radius', text: 'Der Radius geht von der Mitte bis zum Rand. Das ist der halbe Durchmesser.' };
  }

  // Potenz: 5² mit 10 beantwortet
  const pot = potenzWert(aufgabe.rechnung);
  if (pot && gleich(w, pot.basis * pot.exp) && !gleich(w, pot.wert)) {
    return { typ: 'potenz-mal', text: `Hoch ${pot.exp} heißt: ${Array(pot.exp).fill(pot.basis).join(' · ')}, nicht ${pot.basis} · ${pot.exp}.` };
  }

  // Hoch 3: Endergebnis = Zwischenergebnis (erst zweimal malgenommen)
  const t3 = teil ? teil.text || '' : aufgabe.rechnung || '';
  if (/³\s*=?\s*$/.test(t3) && ziel > 1) {
    const b = Math.round(Math.cbrt(ziel));
    if (b ** 3 === ziel && gleich(w, b * b)) return { typ: 'potenz-zweimal', text: 'Du hast erst zweimal malgenommen. Hoch 3 heißt dreimal.' };
  }

  const bild = aufgabe.bild || {};
  const nah = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.01, 0.05);
  const ttext = teil ? teil.text || '' : '';
  const koerper = ['zylinder', 'kegel', 'pyramide'].includes(aufgabe.thema);
  const schritte = aufgabe.schritte || [];
  const vorher = teil ? schritte[schritte.indexOf(teil) - 1] : null;

  if (koerper && teil && teil.wert != null) {
    // Kegel/Pyramide: Drittel vergessen
    if (/Drittel/.test(ttext) && vorher && vorher.wert != null && nah(w, vorher.wert)) {
      return { typ: 'drittel-vergessen', text: 'Hast du an das Drittel gedacht? Teile durch 3.' };
    }
    if (aufgabe.thema !== 'zylinder' && /\bV\s*[=≈]\s*$/.test(ttext) && nah(w, teil.wert * 3)) {
      return { typ: 'drittel-vergessen', text: aufgabe.thema === 'kegel' ? 'Ein Kegel ist nur ein Drittel. Teile durch 3.' : 'Eine Pyramide ist nur ein Drittel. Teile durch 3.' };
    }
    // Pyramide: Mantel nur 1 Dreieck
    if (aufgabe.thema === 'pyramide' && /A_M/.test(ttext) && nah(w, teil.wert / 4)) {
      return { typ: 'pyramide-ein-dreieck', text: 'Die Pyramide hat 4 Dreiecke außen.' };
    }
    const r = bild.r != null ? bild.r : bild.d != null ? bild.d / 2 : null;
    if (r != null) {
      // Kegel: Mantel mit h statt s
      if (aufgabe.thema === 'kegel' && /A_M/.test(ttext) && bild.h != null && nah(w, Math.PI * r * bild.h)) {
        return { typ: 'kegel-h-statt-s', text: 'Für den Mantel brauchst du s, die schräge Linie außen.' };
      }
      // Oberfläche: Zahl der Kreise
      if (/A_O/.test(ttext) && aufgabe.thema === 'kegel' && nah(w, teil.wert + Math.PI * r * r)) {
        return { typ: 'kegel-zwei-kreise', text: 'Ein Kegel hat nur einen Kreis: unten.' };
      }
      if (/A_O/.test(ttext) && aufgabe.thema === 'zylinder' && nah(w, teil.wert - Math.PI * r * r)) {
        return { typ: 'zylinder-ein-kreis', text: 'Ein Zylinder hat zwei Kreise: Boden und Deckel.' };
      }
      // Mit d statt r gerechnet
      if (bild.d != null && ((/A_G/.test(ttext) && nah(w, teil.wert * 4)) || (/A_M/.test(ttext) && aufgabe.thema !== 'pyramide' && nah(w, teil.wert * 2)) ||
        (/^r²/.test(ttext) && gleich(w, bild.d * bild.d)))) {
        return { typ: 'd-statt-r', text: 'Schau nochmal: In der Formel steht r, nicht d.' };
      }
    }
  }

  // Kugel: mit d statt r gerechnet
  if (aufgabe.thema === 'kugel' && bild.d && teil && teil.wert != null) {
    const r = bild.d / 2, d = bild.d;
    const text = teil.text || '';
    const dStattR =
      (gleich(teil.wert, r) && gleich(w, d)) ||
      (/r²/.test(text) && gleich(teil.wert, r * r) && gleich(w, d * d)) ||
      (/r³/.test(text) && gleich(teil.wert, r ** 3) && gleich(w, d ** 3));
    if (dStattR) return { typ: 'kugel-d-statt-r', text: 'Schau nochmal: In der Formel steht r, nicht d.' };
  }

  // Kugel-Volumen ohne 4/3
  if (aufgabe.thema === 'kugel' && teil && /4\s*÷\s*3/.test(teil.text || '')) {
    const nah = (a, b) => Math.abs(a - b) <= Math.abs(b) * 0.01;
    if (nah(w, teil.wert * 3 / 4) || nah(w, teil.wert * 3)) {
      return { typ: 'kugel-ohne-4-3', text: 'Hast du an 4 ÷ 3 gedacht?' };
    }
  }

  // Rabatt: Ersparnis statt neuem Preis
  if (aufgabe.typ === 'mehrfrage' && teil && /(bezahl|kostet)/i.test(teil.frage || '')) {
    const spar = (aufgabe.fragen || []).find(f => f !== teil && /spar/i.test(f.frage) && f.wert != null);
    if (spar && gleich(w, spar.wert) && !gleich(w, teil.wert)) {
      return { typ: 'rabatt-ersparnis', text: 'Das ist, was man spart. Was kostet es dann?' };
    }
  }
  if (aufgabe.typ === 'schritte' && teil && /(neuer preis|bezahl|kostet)/i.test(teil.text || '')) {
    const spar = (aufgabe.schritte || []).find(s => s !== teil && s.wert != null && /spar/i.test(s.text || ''));
    if (spar && gleich(w, spar.wert)) {
      return { typ: 'rabatt-ersparnis', text: 'Das ist, was man spart. Was kostet es dann?' };
    }
  }

  // Minus-Zahlen: richtiger Betrag, falsches Vorzeichen
  if (ziel !== 0 && gleich(w, -ziel)) {
    const text = aufgabe.geschichte
      ? 'Fast! Hat die Person am Ende Geld oder Schulden?'
      : 'Fast! Ist das am Ende Geld oder Schulden?';
    return { typ: 'vorzeichen', text };
  }

  // Runden: richtige Stelle, aber nicht gerundet (abgeschnitten)
  if ((teil && teil.runden) || aufgabe.thema === 'runden') {
    const d = aufgabe.generator === 'runden' ? aufgabe.parameter[1] : teil && teil.runden != null ? teil.runden : 1;
    const stelle = d === 0 ? 'die 1. Stelle nach dem Komma' : `die ${d + 1}. Stelle nach dem Komma`;
    return { typ: 'runden', text: `Schau auf ${stelle}. 5 bis 9 heißt aufrunden.` };
  }

  return null;
}

// ---------- Spielzeit ----------

export const BASIS_SEKUNDEN = 180;

// Spielzeit-Regeln. Werte in Minuten (eine Nachkommastelle), Anteile 1 = alles, 0,5 = Hälfte, 0 = nichts.
// Werden in der Eltern-App eingestellt; ohne Einstellung gelten diese Standardwerte.
export const SPIELZEIT_STANDARD = Object.freeze({ staffel: Object.freeze([1, 1.5, 2, 2.5]), zweit: 0.5, rechner: 0.5, hilfe: 0.5, basisMin: 3 });
const ANTEILE = [0, 0.5, 1];

function minutenWert(x, standard, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return standard;
  return Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;
}

export function spielzeitRegeln(r) {
  const S0 = SPIELZEIT_STANDARD;
  if (!r || typeof r !== 'object') return { staffel: [...S0.staffel], zweit: S0.zweit, rechner: S0.rechner, hilfe: S0.hilfe, basisMin: S0.basisMin };
  const staffel = S0.staffel.map((w, i) => minutenWert(Array.isArray(r.staffel) ? r.staffel[i] : undefined, w, 10));
  return {
    staffel,
    zweit: ANTEILE.includes(r.zweit) ? r.zweit : S0.zweit,
    rechner: ANTEILE.includes(r.rechner) ? r.rechner : S0.rechner,
    hilfe: ANTEILE.includes(r.hilfe) ? r.hilfe : S0.hilfe,
    basisMin: minutenWert(r.basisMin, S0.basisMin, 15)
  };
}

export function minutenFuerPosition(pos, regeln = SPIELZEIT_STANDARD) {
  const st = regeln.staffel;
  if (pos <= 3) return st[0];
  if (pos <= 6) return st[1];
  if (pos <= 9) return st[2];
  return st[3];
}

// Kurzer Text für einen Anteil: „die halbe Spielzeit“ usw.
export function anteilText(a) {
  return a >= 1 ? 'die volle Spielzeit' : a > 0 ? 'die halbe Spielzeit' : 'keine Spielzeit';
}

// ergebnis: 'erst' | 'zweit' | 'loesung'; strafe: 'keine' | 'halb' | 'null'
export function sekundenFuerAufgabe({ ergebnis, serienPos, strafe = 'keine', rechnerHalb = false, hilfe = false, regeln = SPIELZEIT_STANDARD }) {
  let min = minutenFuerPosition(serienPos, regeln);
  if (rechnerHalb) min *= regeln.rechner;
  if (hilfe) min *= regeln.hilfe ?? SPIELZEIT_STANDARD.hilfe;
  if (ergebnis === 'zweit') min *= regeln.zweit;
  else if (ergebnis !== 'erst') min = 0;
  if (strafe === 'halb') min /= 2;
  if (strafe === 'null') min = 0;
  return Math.round(min * 60);
}

// n = wievieltes Verlassen heute (1, 2, 3 …)
export function strafeFuerVerlassen(n) {
  if (n <= 0) return 'keine';
  if (n <= 2) return 'halb';
  return 'null';
}

export function tagKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function stundenSlot(d = new Date()) {
  return `${tagKey(d)}-${String(d.getHours()).padStart(2, '0')}`;
}

// Gibt den Slot zurück, wenn jetzt Basiszeit abgeholt werden darf, sonst null.
export function basisSlotJetzt(now, einstellungen, letzterSlot) {
  const h = now.getHours();
  const von = einstellungen.basisVon ?? 14, bis = einstellungen.basisBis ?? 21;
  if (h < von || h >= bis) return null;
  const slot = stundenSlot(now);
  return slot === letzterSlot ? null : slot;
}

export function formatZeit(sek) {
  sek = Math.max(0, Math.round(sek));
  const m = Math.floor(sek / 60), s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMinuten(sek) {
  const min = sek / 60;
  const t = Number.isInteger(min) ? String(min) : min.toFixed(1).replace('.', ',');
  return `${t} Min.`;
}

// ---------- Aufgabenauswahl ----------

export const MUSTER = ['aufwaermen', 'thema', 'thema', 'text', 'thema', 'abschluss', 'bonus'];

const AUFWAERM_THEMEN = ['potenzen', 'reihenfolge', 'bruch-bild', 'zuordnung', 'prozent'];

export function passtKategorie(a, kategorie, thema) {
  switch (kategorie) {
    case 'aufwaermen': return !a.bonus && AUFWAERM_THEMEN.includes(a.thema) && a.stufe <= 2 && a.thema !== thema;
    case 'thema': return !a.bonus && a.thema === thema;
    case 'text': return !a.bonus && !!a.geschichte && !KOERPER.includes(a.thema);
    case 'abschluss': return !a.bonus && (a.thema === 'runden' || a.thema === 'kugel');
    case 'bonus': return !!a.bonus;
    case 'struktur': return !a.bonus && !KOERPER.includes(a.thema) && (['schritte', 'zuordnung', 'bruch'].includes(a.typ) || (a.typ === 'mehrfrage' && !!a.bild));
    default: return !a.bonus;
  }
}

// statistik: { [id]: { gesehen, zuletzt (Zähler), letztesErgebnis, letzterTag } }
// verlauf: { zaehler, letzteIds: [...], themaZuletzt: { [thema]: { ergebnis, stufe } } }
export function waehleAufgabe(aufgaben, { kategorie, thema, statistik = {}, verlauf = {}, heute }, rng = Math.random) {
  const zaehler = verlauf.zaehler || 0;
  const letzte = verlauf.letzteIds || [];
  let pool = aufgaben.filter(a => passtKategorie(a, kategorie, thema));
  if (!pool.length) pool = aufgaben.filter(a => !a.bonus);
  if (!pool.length) pool = aufgaben.slice();
  // nicht direkt wiederholen
  const ohneLetzte = pool.filter(a => !letzte.slice(-4).includes(a.id));
  if (ohneLetzte.length) pool = ohneLetzte;

  // Nach einem Lösungsweg beim Thema: leichter weitermachen
  const tz = verlauf.themaZuletzt && verlauf.themaZuletzt[thema];
  if (kategorie === 'thema' && tz && tz.ergebnis === 'loesung') {
    const leichter = pool.filter(a => a.stufe < tz.stufe);
    if (leichter.length) pool = leichter;
  }

  const bewerte = a => {
    const s = statistik[a.id];
    if (!s) return 1000 + rng();                         // noch nie gesehen
    let p = 0;
    if (s.letztesErgebnis === 'loesung' && zaehler - s.zuletzt >= 3) p += 2000; // fällig zur Wiederholung
    if (s.letzterTag !== heute) p += 500;
    p += Math.min(zaehler - s.zuletzt, 400);              // lange nicht gesehen
    if (s.letztesErgebnis === 'erst') p -= 50;
    return p + rng();
  };
  pool.sort((x, y) => bewerte(y) - bewerte(x));
  return pool[0];
}

export function mischen(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Taschenrechner ----------
// Ausdruck mit × ÷ − + ( ) π ² ³ und Komma. Gibt Zahl oder null zurück.

export function rechne(ausdruck) {
  const s = (ausdruck || '').replace(/\s+/g, '');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9,.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9,.]/.test(s[j])) j++;
      const zahl = s.slice(i, j).replace(',', '.');
      if ((zahl.match(/\./g) || []).length > 1) return null;
      tokens.push({ t: 'n', v: Number(zahl) });
      i = j;
    } else if (c === 'π') { tokens.push({ t: 'n', v: Math.PI }); i++; }
    else if (c === '²' || c === '³') { tokens.push({ t: 'post', v: c === '²' ? 2 : 3 }); i++; }
    else if ('+−-×÷*/·:'.includes(c)) {
      const op = { '−': '-', '×': '*', '÷': '/', '·': '*', ':': '/' }[c] || c;
      tokens.push({ t: 'op', v: op }); i++;
    } else if (c === '(' || c === ')') { tokens.push({ t: c }); i++; }
    else return null;
  }
  // implizites Mal: 2π, 2(…), π(…), )(
  const mit = [];
  for (const tk of tokens) {
    const prev = mit[mit.length - 1];
    if (prev && (prev.t === 'n' || prev.t === ')' || prev.t === 'post') && (tk.t === 'n' || tk.t === '(')) {
      mit.push({ t: 'op', v: '*' });
    }
    mit.push(tk);
  }
  let pos = 0;
  const peek = () => mit[pos];
  const next = () => mit[pos++];
  function primaer() {
    const tk = next();
    if (!tk) throw 0;
    let v;
    if (tk.t === 'n') v = tk.v;
    else if (tk.t === '(') { v = summe(); if (!next() || mit[pos - 1].t !== ')') throw 0; }
    else if (tk.t === 'op' && tk.v === '-') return -primaer();
    else if (tk.t === 'op' && tk.v === '+') return primaer();
    else throw 0;
    while (peek() && peek().t === 'post') v = v ** next().v;
    return v;
  }
  function produkt() {
    let v = primaer();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = next().v, r = primaer();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function summe() {
    let v = produkt();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v, r = produkt();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  try {
    if (!mit.length) return null;
    const v = summe();
    if (pos !== mit.length || !Number.isFinite(v)) return null;
    return v;
  } catch { return null; }
}

export function formatRechnerZahl(v) {
  if (v == null) return 'Fehler';
  let t = Number(v.toPrecision(12)).toString();
  if (/e/.test(t)) t = v.toFixed(6);
  return t.replace('-', '−').replace('.', ',');
}

// ---------- 2048 ----------

export function leeresFeld() { return Array.from({ length: 4 }, () => [0, 0, 0, 0]); }

export function neueKachel(feld, rng = Math.random) {
  const frei = [];
  feld.forEach((z, r) => z.forEach((v, c) => { if (!v) frei.push([r, c]); }));
  if (!frei.length) return null;
  const [r, c] = frei[Math.floor(rng() * frei.length)];
  feld[r][c] = rng() < 0.9 ? 2 : 4;
  return [r, c];
}

function schiebeZeile(zeile) {
  const werte = zeile.filter(v => v);
  const neu = [], merges = [];
  let punkte = 0;
  for (let i = 0; i < werte.length; i++) {
    if (werte[i] === werte[i + 1]) {
      neu.push(werte[i] * 2); punkte += werte[i] * 2; merges.push(neu.length - 1); i++;
    } else neu.push(werte[i]);
  }
  while (neu.length < 4) neu.push(0);
  return { neu, punkte, merges };
}

// richtung: 'links' | 'rechts' | 'hoch' | 'runter'
export function bewege(feld, richtung) {
  const f = feld.map(z => z.slice());
  let punkte = 0, bewegt = false;
  const verschmolzen = [];
  for (let i = 0; i < 4; i++) {
    let zeile;
    if (richtung === 'links') zeile = f[i].slice();
    if (richtung === 'rechts') zeile = f[i].slice().reverse();
    if (richtung === 'hoch') zeile = [f[0][i], f[1][i], f[2][i], f[3][i]];
    if (richtung === 'runter') zeile = [f[3][i], f[2][i], f[1][i], f[0][i]];
    const { neu, punkte: p, merges } = schiebeZeile(zeile);
    punkte += p;
    for (let k = 0; k < 4; k++) {
      let r, c;
      if (richtung === 'links') { r = i; c = k; }
      if (richtung === 'rechts') { r = i; c = 3 - k; }
      if (richtung === 'hoch') { r = k; c = i; }
      if (richtung === 'runter') { r = 3 - k; c = i; }
      if (f[r][c] !== neu[k]) bewegt = true;
      f[r][c] = neu[k];
      if (merges.includes(k)) verschmolzen.push([r, c]);
    }
  }
  return { feld: f, punkte, bewegt, verschmolzen };
}

export function kannBewegen(feld) {
  return ['links', 'rechts', 'hoch', 'runter'].some(r => bewege(feld, r).bewegt);
}

export function hoechsteKachel(feld) {
  return Math.max(...feld.flat());
}

// ---------- Aufgaben aus JSON kontrollieren (Elternbereich, Tools) ----------

export const TYPEN = ['zahl', 'auswahl', 'bruch', 'schritte', 'zuordnung', 'mehrfrage'];
export const THEMEN = ['minus-zahlen', 'reihenfolge', 'potenzen', 'bruch-bild', 'zuordnung', 'prozent', 'prozent-baukasten', 'rabatt', 'neuer-preis', 'kreisdiagramm', 'runden', 'kugel', 'einmaleins', 'mal-10', 'zylinder', 'kegel', 'pyramide'];
// Körper mit Taschenrechner: eigene Plätze (Schritte und Abschluss), nicht bei Text und Struktur aus dem allgemeinen Pool
export const KOERPER = ['kugel', 'zylinder', 'kegel', 'pyramide'];
export const BILDFORMEN = ['streifen', 'kreis', 'quadrat', 'rechteck', 'kreisdiagramm', 'kugel', 'zylinder', 'kegel', 'pyramide'];

export function kontrolliereAufgabe(a, hinweisIds, vorhandeneIds = new Set()) {
  const f = [];
  const id = a && a.id ? a.id : '(ohne id)';
  if (!a || typeof a !== 'object') return [`Eintrag ist kein Objekt`];
  for (const feld of ['id', 'thema', 'typ', 'stufe', 'frage', 'hinweise', 'loesungsweg', 'erklaerung']) {
    if (a[feld] == null || a[feld] === '') f.push(`${id}: Feld „${feld}“ fehlt`);
  }
  if (typeof a.bonus !== 'boolean') f.push(`${id}: Feld „bonus“ muss true oder false sein`);
  if (a.typ && !TYPEN.includes(a.typ)) f.push(`${id}: unbekannter typ „${a.typ}“`);
  if (a.thema && !THEMEN.includes(a.thema)) f.push(`${id}: unbekanntes thema „${a.thema}“`);
  if (a.stufe != null && ![1, 2, 3].includes(a.stufe)) f.push(`${id}: stufe muss 1, 2 oder 3 sein`);
  if (vorhandeneIds.has(a.id)) f.push(`${id}: id gibt es schon`);
  if (Array.isArray(a.hinweise)) {
    for (const h of a.hinweise) if (!hinweisIds.includes(h)) f.push(`${id}: Hinweis „${h}“ gibt es nicht`);
  } else if (a.hinweise != null) f.push(`${id}: hinweise muss eine Liste sein`);
  if (a.bild && a.bild.form && !BILDFORMEN.includes(a.bild.form)) f.push(`${id}: unbekannte Bildform „${a.bild.form}“`);
  if (a.taschenrechner != null && typeof a.taschenrechner !== 'boolean') f.push(`${id}: taschenrechner muss true oder false sein`);
  if (a.gegeben != null) {
    if (!Array.isArray(a.gegeben)) f.push(`${id}: gegeben muss eine Liste sein`);
    else a.gegeben.forEach((g, i) => { if (!g || !g.name || typeof g.wert !== 'number') f.push(`${id}: gegeben ${i + 1} braucht name und wert`); });
  }
  const text = JSON.stringify(a);
  if (/−\s*\(\s*−/.test(text)) f.push(`${id}: doppeltes Minus wie −(−3) ist noch nicht erlaubt`);
  if (/\d - \d|"-\d/.test(JSON.stringify([a.rechnung, a.frage, a.geschichte, a.loesungsweg]))) f.push(`${id}: Bindestrich statt echtem Minus „−“`);
  if (text.includes('^')) f.push(`${id}: enthält ^ – bitte hochgestellte Zahlen (² ³) verwenden`);
  if (/prüfung/i.test(text)) f.push(`${id}: enthält das Wort „Prüfung“`);
  switch (a.typ) {
    case 'zahl': if (!a.antwort || typeof a.antwort.wert !== 'number') f.push(`${id}: antwort.wert fehlt`); break;
    case 'auswahl': if (!Array.isArray(a.optionen) || !a.antwort || typeof a.antwort.richtig !== 'number') f.push(`${id}: optionen oder antwort.richtig fehlen`); break;
    case 'bruch': if (!a.antwort || typeof a.antwort.zaehler !== 'number' || typeof a.antwort.nenner !== 'number') f.push(`${id}: antwort.zaehler/nenner fehlen`); break;
    case 'schritte':
      if (!Array.isArray(a.schritte) || !a.schritte.length) f.push(`${id}: schritte fehlen`);
      else a.schritte.forEach((s, i) => {
        if (s.karten) {
          if (!Array.isArray(s.karten) || !s.karten.length || s.karten.some(k => !Array.isArray(k.optionen) || k.optionen.length < 2 || typeof k.richtig !== 'number' || !k.optionen[k.richtig]))
            f.push(`${id}: Schritt ${i + 1}: karten braucht je Platz optionen und richtig`);
        }
        else if (s.optionen) { if (typeof s.richtig !== 'number') f.push(`${id}: Schritt ${i + 1} braucht „richtig“`); }
        else if (typeof s.wert !== 'number') f.push(`${id}: Schritt ${i + 1} braucht „wert“`);
      });
      break;
    case 'mehrfrage':
      if (!Array.isArray(a.fragen) || !a.fragen.length) f.push(`${id}: fragen fehlen`);
      else a.fragen.forEach((q, i) => { if (typeof q.wert !== 'number') f.push(`${id}: Frage ${i + 1} braucht „wert“`); });
      break;
    case 'zuordnung':
      if (!Array.isArray(a.gruppen) || a.gruppen.length < 2) f.push(`${id}: gruppen fehlen`);
      break;
  }
  return f;
}

// ---------- 2048 mit Kachel-Objekten (für Animationen) ----------
// kachel: { id, wert, r, c }

export function kachelnAusFeld(feld, zaehler) {
  const k = [];
  feld.forEach((z, r) => z.forEach((v, c) => { if (v) k.push({ id: zaehler.n++, wert: v, r, c }); }));
  return k;
}

export function feldAusKacheln(kacheln) {
  const f = leeresFeld();
  for (const k of kacheln) f[k.r][k.c] = k.wert;
  return f;
}

export function bewegeKacheln(kacheln, richtung, zaehler) {
  const pos = (i, k) => ({
    links: [i, k], rechts: [i, 3 - k], hoch: [k, i], runter: [3 - k, i]
  })[richtung];
  const gitter = leeresFeld().map(z => z.map(() => null));
  for (const k of kacheln) gitter[k.r][k.c] = k;
  const neu = [], wandernd = [], merges = [];
  let punkte = 0, bewegt = false;
  for (let i = 0; i < 4; i++) {
    const zeile = [];
    for (let k = 0; k < 4; k++) { const [r, c] = pos(i, k); if (gitter[r][c]) zeile.push(gitter[r][c]); }
    let ziel = 0;
    for (let j = 0; j < zeile.length; j++) {
      const [r, c] = pos(i, ziel);
      const a = zeile[j], b = zeile[j + 1];
      if (b && a.wert === b.wert) {
        const w = a.wert * 2;
        wandernd.push({ ...a, r, c }, { ...b, r, c });
        const m = { id: zaehler.n++, wert: w, r, c, neuVerschmolzen: true };
        neu.push(m); merges.push(m);
        punkte += w; bewegt = true; j++;
      } else {
        if (a.r !== r || a.c !== c) bewegt = true;
        neu.push({ id: a.id, wert: a.wert, r, c });
      }
      ziel++;
    }
  }
  return { kacheln: neu, wandernd, merges, punkte, bewegt };
}

export function neueKachelObjekt(kacheln, zaehler, rng = Math.random) {
  const f = feldAusKacheln(kacheln);
  const pos = neueKachel(f, rng);
  if (!pos) return null;
  const k = { id: zaehler.n++, wert: f[pos[0]][pos[1]], r: pos[0], c: pos[1], neuGesetzt: true };
  kacheln.push(k);
  return k;
}

// ---------- Freiwilliger Taschenrechner bei großen Zahlen ----------
// Angeboten bei diesen Themen, wenn in der Aufgabe eine Zahl ab 100 vorkommt. Kostet die halbe Spielzeit.
export const RECHNER_OPTIONAL_THEMEN = ['minus-zahlen', 'reihenfolge', 'prozent', 'prozent-baukasten', 'rabatt', 'neuer-preis', 'kreisdiagramm'];

export function groessteZahl(a) {
  const texte = [a.rechnung, a.geschichte, a.frage, ...(a.fragen || []).map(f => f.frage), ...(a.schritte || []).map(s => s.text || '')].filter(Boolean).join(' ');
  const werte = (texte.match(/\d+(?:[.,]\d+)?/g) || []).map(x => Number(x.replace(',', '.')));
  if (a.antwort && typeof a.antwort.wert === 'number') werte.push(Math.abs(a.antwort.wert));
  for (const t of [...(a.fragen || []), ...(a.schritte || []), ...(a.gegeben || [])]) if (typeof t.wert === 'number') werte.push(Math.abs(t.wert));
  return werte.length ? Math.max(...werte) : 0;
}

export function rechnerOptional(a) {
  return !a.taschenrechner && RECHNER_OPTIONAL_THEMEN.includes(a.thema) && groessteZahl(a) >= 100;
}

// ---------- Einstellungen aus der Eltern-App ----------

// Wendet daten/<name>/einstellungen.json auf den Zustand an (nur wenn die Version neuer ist).
// Baukasten-Stufen werden nur übernommen, wenn sie in einer neueren Version geändert wurden,
// damit die App sie zwischendurch weiter selbst anpassen kann.
import { splitterVon, fernAnwenden as fernSplitter } from './splitter.js';

export function fernAnwenden(z, datei) {
  const alt = (z.fern && z.fern.version) || 0;
  if (!datei || typeof datei !== 'object' || !(Number(datei.version) > alt)) return null;
  const w = datei.werte || {};
  const geaendert = [];
  const e = z.einstellungen;
  if (THEMEN.includes(w.thema) && w.thema !== e.thema) { e.thema = w.thema; geaendert.push('thema'); }
  const stunde = x => Number.isInteger(x) && x >= 0 && x <= 24;
  if (stunde(w.basisVon) && stunde(w.basisBis)) {
    const von = Math.min(w.basisVon, w.basisBis), bis = Math.max(w.basisVon, w.basisBis);
    if (von !== e.basisVon || bis !== e.basisBis) { e.basisVon = von; e.basisBis = bis; geaendert.push('basiszeit'); }
  }
  if (typeof w.rechnerAngebot === 'boolean' && w.rechnerAngebot !== (e.rechnerAngebot !== false)) { e.rechnerAngebot = w.rechnerAngebot; geaendert.push('rechnerAngebot'); }
  if (w.spielzeit) {
    const neu = spielzeitRegeln(w.spielzeit);
    if (JSON.stringify(neu) !== JSON.stringify(spielzeitRegeln(z.spielzeit))) geaendert.push('spielzeit');
    z.spielzeit = neu;
  }
  // Aufgabenpaket mit Gewichten je Thema (0 aus, 1 wenig, 2 normal, 4 viel)
  if (w.paket && typeof w.paket === 'object' && w.gewichte && typeof w.gewichte === 'object') {
    const gewichte = {};
    for (const t of THEMEN) { const v = Number(w.gewichte[t]); gewichte[t] = [0, 1, 2, 4].includes(v) ? v : 0; }
    if (Object.values(gewichte).some(v => v > 0)) {
      const neu = { id: String(w.paket.id || '').slice(0, 40), name: String(w.paket.name || '').slice(0, 40), gewichte };
      if (JSON.stringify(neu) !== JSON.stringify(z.paket || null)) geaendert.push('paket');
      z.paket = neu;
    }
  }
  if (w.genStufen && typeof w.genStufen === 'object') {
    for (const [g, v] of Object.entries(w.genStufen)) {
      if (!/^[a-z0-9-]{1,30}$/.test(g) || !v || !(Number(v.v) > alt)) continue;
      const stufe = Math.max(1, Math.min(3, Math.round(Number(v.stufe)) || 1));
      z.genStufen[g] = { stufe, folge: 0 };
      geaendert.push('stufe:' + g);
    }
  }
  // Runensplitter: Preise, Bonus, von Hand freigeschaltete Spiele
  if (w.splitter && typeof w.splitter === 'object') {
    z.splitter = splitterVon(z.splitter);
    if (fernSplitter(z.splitter, w.splitter).length) geaendert.push('splitter');
  }
  z.fern = { ...(z.fern || {}), version: Number(datei.version), geaendert: datei.geaendert || null, angewendet: new Date().toISOString() };
  return geaendert;
}

// ---------- „Hilf mir“ ----------
// Zeigt Zeilen aus dem Lösungsweg, aber das Ergebnis der neuesten Zeile ist verdeckt („?“).
// Verdeckt wird alles nach dem letzten „=“, „≈“ oder „→“.
export function verdecken(zeile) {
  const s = String(zeile || '');
  const m = [...s.matchAll(/=|≈|→/g)].pop();
  if (!m) return null;
  return s.slice(0, m.index + m[0].length) + ' ?';
}

// Welche Lösungsweg-Zeilen gehören zum aktuellen Teil?
// weg: Zeilen, anzahlTeile: Teile ohne Merkzettel, teilNr: aktueller Teil (ohne Merkzettel, ab 0)
export function hilfeZeilen(weg, anzahlTeile, teilNr) {
  const n = (weg || []).length;
  if (!n) return [];
  if (anzahlTeile <= 1) return weg.map((_, i) => i);   // eine Frage: Schritt für Schritt
  if (n === anzahlTeile) return [teilNr];                // je Teil eine Zeile
  return [Math.min(teilNr, n - 1)];
}

// Was „Hilf mir“ nach `stufe` Mal Tippen zeigt: frühere Zeilen offen, die neueste verdeckt.
// Gibt { zeilen: [text], mehr: bool } zurück. Zeilen ohne „=“ usw. lassen sich nicht verdecken und werden übersprungen.
export function hilfeAnzeige(weg, anzahlTeile, teilNr, stufe) {
  const idx = hilfeZeilen(weg, anzahlTeile, teilNr).filter(i => verdecken(weg[i]));
  const k = Math.max(1, Math.min(stufe, idx.length));
  if (!idx.length) return { zeilen: [], mehr: false };
  const zeilen = idx.slice(0, k).map((i, j) => j === k - 1 ? verdecken(weg[i]) : weg[i]);
  return { zeilen, mehr: k < idx.length };
}

// ---------- Textaufgaben ----------
// Geschichte in Sätze teilen (für „Satz für Satz“)
export function saetzeVon(text) {
  return String(text || '').split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"0-9−])/).map(s => s.trim()).filter(Boolean);
}
// Zu schnelle Antwort bei einer Textaufgabe: zählt nicht als Versuch (Raten bringt nichts, kein Abzug)
export const TEXT_MINDEST_MS = 4000;
export function zuSchnell(aufgabe, teil, ms) {
  return !!(aufgabe && aufgabe.geschichte) && !(teil && teil.merk) && ms < TEXT_MINDEST_MS;
}
// Rechnung legen: gewählte Kärtchen prüfen. wahl = [Index je Platz]. Gibt { richtig, falsch: [Plätze] } zurück.
export function pruefeKarten(karten, wahl) {
  const falsch = karten.map((k, i) => (wahl[i] === k.richtig ? -1 : i)).filter(i => i >= 0);
  return { richtig: !falsch.length, falsch };
}
