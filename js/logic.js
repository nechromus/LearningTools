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
// Gibt { typ, text } oder null zurück. teil = Schritt/Frage-Objekt oder null.

export function erkenneFehler(aufgabe, teil, eingabeText) {
  const p = parseZahl(eingabeText);
  if (!p.ok) return null;
  const w = p.wert;
  const ziel = teil ? teil.wert : aufgabe.antwort && aufgabe.antwort.wert;
  if (ziel == null) return null;

  // Potenz: 5² mit 10 beantwortet
  const pot = potenzWert(aufgabe.rechnung);
  if (pot && gleich(w, pot.basis * pot.exp) && !gleich(w, pot.wert)) {
    return { typ: 'potenz-mal', text: `Hoch ${pot.exp} heißt: ${Array(pot.exp).fill(pot.basis).join(' · ')}, nicht ${pot.basis} · ${pot.exp}.` };
  }

  // Kugel: mit d statt r gerechnet
  const bild = aufgabe.bild || {};
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
  if (aufgabe.typ === 'schritte' && teil && /neuer preis/i.test(teil.text || '')) {
    const spar = (aufgabe.schritte || []).find(s => s !== teil && /spar/i.test(s.text || ''));
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
    return { typ: 'runden', text: 'Schau auf die 2. Stelle nach dem Komma. 5 bis 9 heißt aufrunden.' };
  }

  return null;
}

// ---------- Spielzeit ----------

export const BASIS_SEKUNDEN = 180;

export function minutenFuerPosition(pos) {
  if (pos <= 3) return 1;
  if (pos <= 6) return 1.5;
  if (pos <= 9) return 2;
  return 2.5;
}

// ergebnis: 'erst' | 'zweit' | 'loesung'; strafe: 'keine' | 'halb' | 'null'
export function sekundenFuerAufgabe({ ergebnis, serienPos, strafe = 'keine' }) {
  let min = minutenFuerPosition(serienPos);
  if (ergebnis === 'zweit') min /= 2;
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
    case 'text': return !a.bonus && !!a.geschichte && a.thema !== 'kugel';
    case 'abschluss': return !a.bonus && (a.thema === 'runden' || a.thema === 'kugel');
    case 'bonus': return !!a.bonus;
    case 'struktur': return !a.bonus && a.thema !== 'kugel' && (['schritte', 'zuordnung', 'bruch'].includes(a.typ) || (a.typ === 'mehrfrage' && !!a.bild));
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
export const THEMEN = ['minus-zahlen', 'reihenfolge', 'potenzen', 'bruch-bild', 'zuordnung', 'prozent', 'prozent-baukasten', 'rabatt', 'neuer-preis', 'kreisdiagramm', 'runden', 'kugel', 'einmaleins', 'mal-10'];

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
        if (s.optionen) { if (typeof s.richtig !== 'number') f.push(`${id}: Schritt ${i + 1} braucht „richtig“`); }
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
