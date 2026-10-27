// Aufgaben-Baukästen: erzeugen Varianten im Projektformat (eng nach den Regeln aus 03-aufgabenformat-und-erstellung.md).
// Jede Aufgabe hat "generator" und "parameter"; die id entsteht aus den Zahlen.

import { zehnerpotenz, einheiten, gewichtskraft, gleichung, formelUmstellen, dichte } from './gen-physik.js';
export { zehnerpotenz, einheiten, gewichtskraft, gleichung, formelUmstellen, dichte };

const M = '−';
const zufall = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const wahl = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const mischen = (rng, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const r1 = x => Math.round(x * 10) / 10;
const r3 = x => Math.round(x * 1000) / 1000;

export function zahlText(n, nachkomma = null) {
  let s = nachkomma != null ? Math.abs(n).toFixed(nachkomma) : String(Math.round(Math.abs(n) * 1000) / 1000);
  s = s.replace('.', ',');
  return (n < 0 ? M : '') + s;
}
const geld = n => Number.isInteger(n) ? zahlText(n) : zahlText(n, 2);

// ---------- Rundung der Zwischenwerte (Körper) ----------
// Ein Schritt mit `genau` (ungerundeter Wert) ist richtig, wenn die Eingabe ein richtiges Ergebnis ist,
// richtig gerundet auf so viele Stellen, wie getippt wurden (oder die ganze Zahl vom Rechner).
// `varianten`: weitere richtige Ergebnisse, wenn die Zahlen der Schritte davor alle auf 1, 2 oder 3 Stellen gerundet eingesetzt werden.
// `abgeschnitten`: Ergebnisse mit abgeschnittenen Zahlen davor (für den Tipp).
const RUND_STELLEN = [null, 1, 2, 3];
const rdK = (x, k) => k == null ? x : Math.round(x * 10 ** k) / 10 ** k;
const abK = (x, k) => k == null ? x : Math.trunc(x * 10 ** k) / 10 ** k;
const r9 = (x) => Math.round(x * 1e9) / 1e9;
// Alle Zwischenwerte gleich behandelt: ganz oder alle auf k Stellen (gemischte Stellen zählen nicht)
function kombis(werte, f, op) {
  return [...new Set(RUND_STELLEN.map(k => r9(f(...werte.map(w => op(w, k))))))];
}
// Schritt aus einem genauen Wert (z. B. π × 9 × 5)
const gs = (schritt, x) => ({ ...schritt, genau: x });
// Schritt aus Zwischenwerten der Schritte davor: f(…werte)
function gsAus(schritt, werte, f) {
  const x = f(...werte), v = kombis(werte, f, rdK).filter(c => Math.abs(c - x) > 1e-9);
  const ab = kombis(werte, f, abK).filter(c => !v.some(w => Math.abs(w - c) < 1e-9) && Math.abs(c - x) > 1e-9);
  return { ...schritt, genau: x, ...(v.length ? { varianten: v } : {}), ...(ab.length ? { abgeschnitten: ab } : {}) };
}
// Rundungsschritt nach einem Schritt mit `genau`: auch die richtige Rundung jeder richtigen Eingabe davor zählt
function rundenAuch(schritte) {
  for (let i = 1; i < (schritte || []).length; i++) {
    const t = schritte[i], v = schritte[i - 1];
    if (t.runden == null || t.wert == null || v.genau == null) continue;
    const auch = new Set();
    for (const c of [v.genau, ...(v.varianten || [])]) for (const k of RUND_STELLEN) { const z = rdK(rdK(c, k), t.runden); if (Math.abs(z - t.wert) > 1e-9) auch.add(r9(z)); }
    if (auch.size) t.auch = [...auch];
  }
  return schritte;
}

function neu(generator, parameter, felder) {
  if (Array.isArray(felder.schritte)) rundenAuch(felder.schritte);
  const id = `gen-${generator}-${parameter.map(p => String(p).replace('.', ',').replace('-', 'm')).join('_')}`;
  return { id, quelle: 'Baukasten', generator, parameter, bonus: false, ...felder };
}

// ---------- Minus-Zahlen (Schulden-Methode) ----------

function satzErgebnis(res) {
  if (res < 0) return `Am Ende ${-res} € Schulden.`;
  if (res > 0) return `Am Ende ${res} € Geld.`;
  return 'Am Ende genau 0 €.';
}

// Doppeltes Minus (Auftrag 21, ab Freigabe): „a − (−b)“ und „−a − (−b)“. Die ersten 5 mit Zwischenschritt.
// Schulden-Methode: − (−b) heißt, b € Schulden fallen weg → + b.
export function minusMinus(stufe, rng, opts = {}) {
  const max = stufe === 1 ? 20 : 50;
  for (let v = 0; v < 200; v++) {
    const a = wahl(rng, [1, -1]) * zufall(rng, 2, max), b = zufall(rng, 2, max), wert = a + b;
    if (wert === 0 || Math.abs(wert) > 100) continue;
    const rechnung = `${zahlText(a)} − (${M}${b})`;
    const felder = {
      thema: 'minus-zahlen', stufe, form: 'minusminus', rechnung, hinweise: ['euro'],
      loesungsweg: [`${rechnung} = ${zahlText(a)} + ${b} = ${zahlText(wert)}`],
      erklaerung: `− (${M}${b}): ${b} € Schulden fallen weg. Das ist wie ${b} € bekommen. ${satzErgebnis(wert)}`
    };
    if (opts.zwischenschritt) return neu('minus-plus', ['minusminus', 'z', a, b], { ...felder, typ: 'schritte', frage: 'Rechne aus. Schreib den Zwischenschritt auf.',
      schritte: [{ text: `${rechnung} = ${zahlText(a)} +`, wert: b }, { text: `${zahlText(a)} + ${b} =`, wert }] });
    return neu('minus-plus', ['minusminus', a, b], { ...felder, typ: 'zahl', frage: 'Rechne aus.', antwort: { wert } });
  }
}

export function minusPlus(stufe, rng, opts = {}) {
  if (opts.minusminus && rng() < 0.25) return minusMinus(stufe, rng, { zwischenschritt: !((opts.formZaehler || {}).minusminus >= 5) });
  const max = stufe === 1 ? 20 : stufe === 2 ? 50 : 100;
  const anzahl = stufe === 1 ? 1 : stufe === 2 ? wahl(rng, [1, 2]) : wahl(rng, [2, 3]);
  for (let versuch = 0; versuch < 200; versuch++) {
    const start = wahl(rng, [-1, -1, 1]) * zufall(rng, 2, max);
    const ops = [];
    let wert = start, ok = true;
    const verlauf = [start];
    for (let i = 0; i < anzahl; i++) {
      const op = start < 0 && i === 0 ? wahl(rng, ['+', '+', '−']) : wahl(rng, ['+', '−']);
      const n = zufall(rng, 2, max);
      wert = op === '+' ? wert + n : wert - n;
      if (Math.abs(wert) > 100) { ok = false; break; }
      ops.push([op, n]); verlauf.push(wert);
    }
    if (!ok || wert === 0) continue;
    if (anzahl === 1 && start > 0 && ops[0][0] === '+') continue;          // zu leicht
    if (anzahl === 1 && start > 0 && ops[0][1] <= start) continue;         // positives Ergebnis ohne Minus-Thema
    if (opts.fokus === 'vorzeichen' && Math.sign(wert) === Math.sign(start) && rng() < 0.6) continue;
    const rechnung = [zahlText(start), ...ops.map(([o, n]) => `${o} ${n}`)].join(' ');
    const weg = [];
    if (anzahl === 1) weg.push(`${rechnung} = ${zahlText(wert)}`);
    else for (let i = 0; i < ops.length; i++) weg.push(`${zahlText(verlauf[i])} ${ops[i][0]} ${ops[i][1]} = ${zahlText(verlauf[i + 1])}`);
    let erkl;
    if (anzahl === 1) {
      const [o, n] = ops[0];
      if (start < 0 && o === '+') erkl = `${-start} € Schulden, du bekommst ${n} €. ${satzErgebnis(wert)}`;
      else if (start < 0) erkl = `${-start} € Schulden, du leihst dir noch ${n} €. ${satzErgebnis(wert)}`;
      else erkl = `${start} € da, ${n} € ausgegeben. ${satzErgebnis(wert)}`;
    } else erkl = `Rechne Schritt für Schritt von links nach rechts. ${satzErgebnis(wert)}`;
    return neu('minus-plus', [start, ...ops.map(([o, n]) => (o === '+' ? n : -n))], {
      thema: 'minus-zahlen', typ: 'zahl', stufe, rechnung, frage: 'Rechne aus.',
      antwort: { wert }, hinweise: ['euro'], loesungsweg: weg, erklaerung: erkl
    });
  }
  return minusPlus(1, rng);
}

// ---------- Reihenfolge ----------

// Minus vor einer Klammer mit negativem Ergebnis (Auftrag 21, ab Freigabe): „a − (b − c)“ mit b < c.
// Erst die Klammer ausrechnen, dann − (−n) mit der Schulden-Methode. Die ersten 5 in Schritten.
export function klammerNegativ(stufe, rng, opts = {}) {
  for (let v = 0; v < 200; v++) {
    const a = zufall(rng, 2, stufe === 1 ? 20 : 40), b = zufall(rng, 2, 9), c = b + zufall(rng, 1, 9), k = b - c, wert = a - k;
    if (wert > 100) continue;
    const rechnung = `${a} − (${b} − ${c})`;
    const felder = {
      thema: 'reihenfolge', stufe, form: 'klammer_negativ', rechnung, hinweise: ['klammer', 'euro'],
      loesungsweg: [`${b} − ${c} = ${zahlText(k)}`, `${a} − (${zahlText(k)}) = ${a} + ${-k} = ${wert}`],
      erklaerung: `Zuerst die Klammer: ${b} − ${c} = ${zahlText(k)}. Dann fallen ${-k} € Schulden weg: + ${-k}.`
    };
    if (opts.zwischenschritt) return neu('reihenfolge', ['klammer_negativ', 'z', a, b, c], { ...felder, typ: 'schritte', frage: 'Rechne aus. Erst die Klammer.',
      schritte: [{ text: `Klammer: ${b} − ${c} =`, wert: k }, { text: `${a} − (${zahlText(k)}) =`, wert }] });
    return neu('reihenfolge', ['klammer_negativ', a, b, c], { ...felder, typ: 'zahl', frage: 'Rechne aus.', antwort: { wert } });
  }
}

export function reihenfolge(stufe, rng, opts = {}) {
  if (opts.minusminus && rng() < 0.25) return klammerNegativ(stufe, rng, { zwischenschritt: !((opts.formZaehler || {}).klammer_negativ >= 5) });
  for (let v = 0; v < 200; v++) {
    const form = stufe === 1 ? wahl(rng, ['a+b*c', 'a-b*c', '(a+b)*c', '(a-b)*c'])
      : stufe === 2 ? wahl(rng, ['a-(b+c)', 'a+b*c', '(a-b)*c', 'a-b*c'])
      : wahl(rng, ['a-b*cN', 'a-(b+c)', 'a*b-c*d']);
    const a = zufall(rng, 2, stufe === 1 ? 20 : 40), b = zufall(rng, 2, 9), c = zufall(rng, 2, stufe === 3 ? 12 : 9), d = zufall(rng, 2, 9);
    let rechnung, wert, weg, erkl;
    if (form === 'a+b*c') { wert = a + b * c; rechnung = `${a} + ${b} · ${c}`; weg = `${rechnung} = ${a} + ${b * c} = ${wert}`; erkl = `Zuerst Punkt: ${b} · ${c} = ${b * c}.`; }
    if (form === 'a-b*c' || form === 'a-b*cN') {
      wert = a - b * c; rechnung = `${a} − ${b} · ${c}`; weg = `${rechnung} = ${a} − ${b * c} = ${zahlText(wert)}`;
      if (form === 'a-b*c' && wert <= 0) continue;
      if (form === 'a-b*cN' && wert >= 0) continue;
      erkl = `Zuerst Punkt: ${b} · ${c} = ${b * c}.` + (wert < 0 ? ` Dann ${a} € haben, ${b * c} € ausgeben.` : '');
    }
    if (form === '(a+b)*c') { if (a > 12) continue; wert = (a + b) * c; rechnung = `(${a} + ${b}) · ${c}`; weg = `${rechnung} = ${a + b} · ${c} = ${wert}`; erkl = `Zuerst die Klammer: ${a} + ${b} = ${a + b}.`; }
    if (form === '(a-b)*c') { if (a <= b || a - b > 12) continue; wert = (a - b) * c; rechnung = `(${a} − ${b}) · ${c}`; weg = `${rechnung} = ${a - b} · ${c} = ${wert}`; erkl = `Zuerst die Klammer: ${a} − ${b} = ${a - b}.`; }
    if (form === 'a-(b+c)') {
      const bb = zufall(rng, 2, 30), cc = zufall(rng, 2, 30);
      wert = a - (bb + cc); rechnung = `${a} − (${bb} + ${cc})`; weg = `${rechnung} = ${a} − ${bb + cc} = ${zahlText(wert)}`;
      erkl = `Zuerst die Klammer: ${bb} + ${cc} = ${bb + cc}.` + (wert < 0 ? ` Dann ${a} € haben, ${bb + cc} € ausgeben.` : '');
      if (wert === 0) continue;
      return neu('reihenfolge', [form, a, bb, cc], { thema: 'reihenfolge', typ: 'zahl', stufe, rechnung, frage: 'Rechne aus.', antwort: { wert }, hinweise: wert < 0 ? ['klammer', 'euro'] : ['klammer'], loesungsweg: [weg], erklaerung: erkl });
    }
    if (form === 'a*b-c*d') { const aa = zufall(rng, 2, 9); wert = aa * b - c * d; rechnung = `${aa} · ${b} − ${c} · ${d}`; weg = `${rechnung} = ${aa * b} − ${c * d} = ${zahlText(wert)}`; erkl = `Zuerst beide Punkt-Rechnungen: ${aa * b} und ${c * d}.` + (wert < 0 ? ` Dann ${aa * b} € haben, ${c * d} € ausgeben.` : ''); if (wert === 0) continue;
      return neu('reihenfolge', [form, aa, b, c, d], { thema: 'reihenfolge', typ: 'zahl', stufe, rechnung, frage: 'Rechne aus.', antwort: { wert }, hinweise: wert < 0 ? ['klammer', 'euro'] : ['klammer'], loesungsweg: [weg], erklaerung: erkl });
    }
    if (Math.abs(wert) > 100) continue;
    return neu('reihenfolge', [form, a, b, c], { thema: 'reihenfolge', typ: 'zahl', stufe, rechnung, frage: 'Rechne aus.', antwort: { wert }, hinweise: wert < 0 ? ['klammer', 'euro'] : ['klammer'], loesungsweg: [weg], erklaerung: erkl });
  }
}

// ---------- Potenzen ----------

const HOCH = { 2: '²', 3: '³', 4: '⁴' };

export function potenz(stufe, rng, opts = {}) {
  if (opts.bonus) {
    if (rng() < 0.5) {
      const [basis, exp] = wahl(rng, [[2, 4], [3, 4], [10, 4]]);
      const wert = basis ** exp;
      return neu('potenz', [basis, exp], { thema: 'potenzen', typ: 'schritte', stufe: 3, bonus: true, rechnung: `${basis}${HOCH[exp]}`, frage: 'Hoch 4 heißt 4-mal malnehmen. Rechne aus. Schreib die Zwischenergebnisse auf.', schritte: potenzSchritte(basis, exp), hinweise: ['potenz'], loesungsweg: potenzWeg(basis, exp), erklaerung: `Viermal die ${basis} malnehmen.` });
    }
    const [x, y] = wahl(rng, [[[3, 2], [2, 3]], [[5, 2], [3, 3]], [[10, 2], [5, 3]], [[6, 2], [3, 3]], [[4, 3], [7, 2]], [[9, 2], [4, 3]]]);
    const opt = [x, y].map(([b, e]) => `${b}${HOCH[e]}`);
    const w = [x, y].map(([b, e]) => b ** e);
    return neu('potenz-vergleich', [opt.join('|')], { thema: 'potenzen', typ: 'auswahl', stufe: 3, bonus: true, frage: 'Was ist größer?', optionen: opt, antwort: { richtig: w[0] > w[1] ? 0 : 1 }, hinweise: ['potenz'], loesungsweg: [`${opt[0]} = ${w[0]}`, `${opt[1]} = ${w[1]}`], erklaerung: `${Math.max(...w)} ist größer als ${Math.min(...w)}.` });
  }
  let basis, exp;
  if (stufe === 1) { basis = zufall(rng, 2, 10); exp = 2; }
  else { [basis, exp] = wahl(rng, [[11, 2], [12, 2], [20, 2], [30, 2], [40, 2], [2, 3], [3, 3], [4, 3], [5, 3], [10, 3], [zufall(rng, 6, 9), 2]]); }
  const wert = basis ** exp;
  let erkl = exp === 2 ? `Hoch 2: die ${basis} zweimal malnehmen.` : `Hoch 3: die ${basis} dreimal malnehmen.`;
  if (basis % 10 === 0 && exp === 2 && basis > 10) erkl = `Trick: ${basis / 10} · ${basis / 10} = ${(basis / 10) ** 2}, dann zwei Nullen anhängen.`;
  if (basis === 10 && exp === 3) erkl = 'Bei 10 hoch 3 hängst du 3 Nullen an die 1.';
  if (basis === 11 && exp === 2) erkl = 'Tipp: 10 · 11 = 110, dann noch 11 dazu.';
  if (basis === 12 && exp === 2) erkl = 'Tipp: 10 · 12 = 120, dann 2 · 12 = 24 dazu.';
  const kette = Array(exp).fill(basis).join(' · ');
  // Ab Hoch 3 mit Zwischenergebnis (Wunsch Vater, 03 Abschnitt 6.1)
  if (exp >= 3) return neu('potenz', [basis, exp], { thema: 'potenzen', typ: 'schritte', stufe, rechnung: `${basis}${HOCH[exp]}`, frage: 'Rechne aus. Schreib das Zwischenergebnis auf.', schritte: potenzSchritte(basis, exp), hinweise: ['potenz'], loesungsweg: potenzWeg(basis, exp), erklaerung: erkl });
  return neu('potenz', [basis, exp], { thema: 'potenzen', typ: 'zahl', stufe, rechnung: `${basis}${HOCH[exp]}`, frage: 'Rechne aus.', antwort: { wert }, hinweise: ['potenz'], loesungsweg: [`${basis}${HOCH[exp]} = ${kette} = ${wert}`], erklaerung: erkl });
}

// Hoch 3: „Zwischenergebnis =“, Hoch 4: „1. Zwischenergebnis =“, „2. Zwischenergebnis =“; zuletzt „4³ =“
function potenzSchritte(basis, exp) {
  const zw = [];
  for (let k = 2; k < exp; k++) zw.push(basis ** k);
  const schritte = zw.map((w, i) => ({ text: zw.length === 1 ? 'Zwischenergebnis =' : `${i + 1}. Zwischenergebnis =`, wert: w }));
  return [...schritte, { text: `${basis}${HOCH[exp]} =`, wert: basis ** exp }];
}
function potenzWeg(basis, exp) {
  const weg = [];
  for (let k = 1; k < exp; k++) weg.push(`${basis ** k} · ${basis} = ${basis ** (k + 1)}`);
  return weg;
}

// ---------- Einmaleins ----------

export function einmaleins(stufe, rng, opts = {}) {
  // Geteilt ab Stufe 2 (Wunsch Vater); opts.art erzwingt 'mal' oder 'geteilt' (für gemischte Dreierblöcke)
  const geteilt = opts.art ? opts.art === 'geteilt' : stufe >= 2 && rng() < (stufe === 2 ? 0.4 : 0.5);
  let a = stufe === 1 ? zufall(rng, 2, 5) : zufall(rng, 3, 10);
  let b = stufe === 1 ? zufall(rng, 2, 10) : zufall(rng, 6, 10);
  if (rng() < 0.5) [a, b] = [b, a];
  const p = a * b;
  if (geteilt) {
    return neu('einmaleins', ['geteilt', p, a], { thema: 'einmaleins', typ: 'zahl', stufe, rechnung: `${p} : ${a}`, frage: 'Rechne aus.', antwort: { wert: b }, hinweise: ['einmaleins'], loesungsweg: [`${p} : ${a} = ${b}`, `Kontrolle: ${a} · ${b} = ${p}`], erklaerung: `Frag dich: Welche Zahl mal ${a} gibt ${p}?` });
  }
  let weg = [`${a} · ${b} = ${p}`], erkl = `Tauschen ist erlaubt: ${a} · ${b} = ${b} · ${a}.`;
  const neun = a === 9 ? b : b === 9 ? a : null;
  const fuenf = a === 5 ? b : b === 5 ? a : null;
  if (neun) { weg = [`10 · ${neun} = ${10 * neun}`, `${10 * neun} − ${neun} = ${p}`]; erkl = `Mal 9: erst mal 10, dann einmal weniger.`; }
  else if (fuenf && fuenf % 2 === 0) { weg = [`10 · ${fuenf} = ${10 * fuenf}`, `${10 * fuenf} : 2 = ${p}`]; erkl = 'Mal 5: erst mal 10, dann halbieren.'; }
  else if (a === 2 || b === 2) erkl = 'Mal 2 heißt verdoppeln.';
  return neu('einmaleins', ['mal', a, b], { thema: 'einmaleins', typ: 'zahl', stufe, rechnung: `${a} · ${b}`, frage: 'Rechne aus.', antwort: { wert: p }, hinweise: ['einmaleins'], loesungsweg: weg, erklaerung: erkl });
}

// ---------- Mal 10 / durch 10 ----------

export function mal10(stufe, rng) {
  const mal = rng() < 0.5;
  let x;
  if (stufe === 1) x = mal ? zufall(rng, 2, 99) : zufall(rng, 2, 99) * 10;
  else if (stufe === 2) x = mal ? zufall(rng, 11, 99) / 10 : zufall(rng, 11, 99);
  else x = mal ? zufall(rng, 101, 999) / 100 : zufall(rng, 101, 999);
  if (!mal && stufe > 1 && x % 10 === 0) x += 1;
  if (mal && stufe > 1 && Number.isInteger(x)) x += stufe === 2 ? 0.5 : 0.25;
  const wert = mal ? Math.round(x * 100) / 10 : Math.round(x * 10) / 100;
  const rechnung = `${zahlText(x)} ${mal ? '·' : ':'} 10`;
  const regel = Number.isInteger(x) && mal ? 'eine Null anhängen' : mal ? 'Komma 1 Stelle nach rechts' : Number.isInteger(wert) ? 'eine Null weg' : 'Komma 1 Stelle nach links';
  return neu('mal10', [mal ? 'mal' : 'durch', x], { thema: 'mal-10', typ: 'zahl', stufe, rechnung, frage: 'Rechne aus.', antwort: { wert }, hinweise: ['mal10'], loesungsweg: [`${rechnung} → ${regel} → ${zahlText(wert)}`], erklaerung: mal ? 'Mal 10 macht die Zahl größer.' : 'Durch 10 macht die Zahl kleiner.' });
}

// ---------- Prozent von … ----------

const PROZENT_REGEL = { 50: 2, 25: 4, 10: 10, 20: 5 };

export function prozent(stufe, rng) {
  for (let v = 0; v < 200; v++) {
    const p = stufe === 1 ? wahl(rng, [50, 10, 25]) : wahl(rng, [50, 25, 10, 20, 75]);
    let g;
    if (p === 50) g = stufe === 1 ? zufall(rng, 5, 100) * 2 : zufall(rng, 5, 150) * (stufe === 2 ? 1 : 2);
    if (p === 10) g = stufe === 1 ? zufall(rng, 2, 50) * 10 : zufall(rng, 11, 300);
    if (p === 25) g = stufe === 1 ? zufall(rng, 2, 25) * 4 : zufall(rng, 3, 60) * 2;
    if (p === 20) g = zufall(rng, 2, 60) * 5;
    if (p === 75) g = zufall(rng, 2, 40) * 4;
    const wert = Math.round(g * p) / 100;
    if (stufe === 1 && !Number.isInteger(wert)) continue;
    if (!Number.isInteger(wert * 100) || wert * 100 % 10 !== 0 && wert * 100 % 50 !== 0 && wert * 100 % 25 !== 0) continue;
    const weg = p === 75 ? [`${g} : 4 = ${geld(g / 4)}`, `${geld(g / 4)} · 3 = ${geld(wert)}`] : [`${g} : ${PROZENT_REGEL[p]} = ${geld(wert)}`];
    const erkl = p === 75 ? 'Erst ein Viertel, dann mal 3.' : `${p} % heißt: durch ${PROZENT_REGEL[p]}.`;
    return neu('prozent', [p, g], { thema: 'prozent', typ: 'zahl', stufe, rechnung: `${p} % von ${g} €`, frage: 'Wie viel Euro sind das?', antwort: { wert, einheit: '€' }, hinweise: ['prozent'], loesungsweg: weg, erklaerung: erkl + (Number.isInteger(wert) ? '' : ` Bei Geld schreibt man ${geld(wert)} €.`) });
  }
}

// ---------- Prozent-Baukasten ----------

export function baukasten(stufe, rng, opts = {}) {
  if (opts.bonus) {
    const g = zufall(rng, 2, 25) * 20;
    const z = g / 10, f = z / 2;
    return neu('baukasten', [15, g, 'bonus'], { thema: 'prozent-baukasten', typ: 'schritte', stufe: 3, bonus: true, frage: `15 % von ${g} €`, schritte: [{ text: '10 % =', wert: z, einheit: '€' }, { text: '5 % =', wert: f, einheit: '€' }, { text: `15 % = ${geld(z)} + ${geld(f)} =`, wert: z + f, einheit: '€' }], hinweise: ['baukasten'], loesungsweg: [`10 % = ${geld(z)} €`, `5 % = ${geld(f)} €`, `15 % = ${geld(z + f)} €`], erklaerung: '15 % sind 10 % und 5 % zusammen.' });
  }
  const p = wahl(rng, [30, 40, 60, 70, 5]);
  let g = p === 5 ? zufall(rng, 2, 25) * 20 : stufe === 3 ? zufall(rng, 3, 100) * 5 : zufall(rng, 2, 40) * 10;
  const z = g / 10;
  const k = p / 10;
  const wert = Math.round(g * p) / 100;
  if (!Number.isInteger(wert * 100)) return baukasten(stufe, rng);
  const zweiter = p === 5 ? `5 % = ${geld(z)} : 2 =` : `${p} % = ${geld(z)} · ${k} =`;
  const weg = [`${g} : 10 = ${geld(z)}`, p === 5 ? `${geld(z)} : 2 = ${geld(wert)}` : `${geld(z)} · ${k} = ${geld(wert)}`];
  const erkl = p === 5 ? '5 % sind die Hälfte von 10 %.' : `${p} % sind ${k}-mal 10 %.`;
  if (stufe === 1) {
    return neu('baukasten', [p, g, 'schritte'], { thema: 'prozent-baukasten', typ: 'schritte', stufe, frage: `${p} % von ${g} €`, schritte: [{ text: '10 % =', wert: z, einheit: '€' }, { text: zweiter, wert, einheit: '€' }], hinweise: ['baukasten'], loesungsweg: weg, erklaerung: erkl });
  }
  return neu('baukasten', [p, g], { thema: 'prozent-baukasten', typ: 'zahl', stufe, rechnung: `${p} % von ${g} €`, frage: 'Wie viel Euro sind das?', antwort: { wert, einheit: '€' }, hinweise: ['baukasten'], loesungsweg: weg, erklaerung: erkl });
}

// ---------- Runden ----------

export function runden(stufe, rng) {
  // Stellen nach dem Komma, auf die gerundet wird (0 = ganze Zahl)
  const d = stufe === 1 ? wahl(rng, [1, 1, 0]) : stufe === 2 ? wahl(rng, [0, 1, 1, 2]) : wahl(rng, [0, 1, 2, 2, 3]);
  const extra = stufe === 1 ? 1 : wahl(rng, [1, 1, 2]);
  const m = d + extra;
  let ganz = stufe === 3 ? wahl(rng, [zufall(rng, 1, 99), 9, 19, 99]) : zufall(rng, 1, 60);
  let ziffern;
  for (let v = 0; v < 200; v++) {
    ziffern = Array.from({ length: m }, () => zufall(rng, 0, 9));
    const sprung = d === 0 ? (ganz % 10 === 9 && ziffern[0] >= 5) : (ziffern[d - 1] === 9 && ziffern[d] >= 5);
    if (stufe === 1 && (sprung || ziffern[d] === 5)) continue;
    if (stufe === 3 && rng() < 0.5) { if (d > 0) ziffern[d - 1] = 9; else ganz = ganz - (ganz % 10) + 9; ziffern[d] = zufall(rng, 5, 9); }
    if (stufe === 2 && rng() < 0.25) ziffern[d] = 5;
    if (ziffern[m - 1] === 0) ziffern[m - 1] = zufall(rng, 1, 9) === ziffern[d] && m - 1 === d ? 1 : (m - 1 === d ? ziffern[d] || 1 : zufall(rng, 1, 9));
    break;
  }
  const N = ganz * 10 ** m + Number(ziffern.join(''));
  const q = Math.floor(N / 10 ** (m - d)) + (ziffern[d] >= 5 ? 1 : 0);
  const wert = q / 10 ** d;
  const auf = ziffern[d] >= 5;
  const zahl = `${ganz},${ziffern.join('')}`;
  const anzeige = zahlText(wert, d);
  const frage = d === 0 ? 'Runde auf eine ganze Zahl.' : d === 1 ? 'Runde auf eine Stelle nach dem Komma.' : `Runde auf ${d} Stellen nach dem Komma.`;
  const strich = d === 0 ? `${ganz}|,${ziffern.join('')}` : `${ganz},${ziffern.slice(0, d).join('')}|${ziffern.slice(d).join('')}`;
  const schau = d === 0 ? 'Schau auf die 1. Stelle nach dem Komma.' : `Schau auf die ${d + 1}. Stelle nach dem Komma.`;
  const erkl = `${schau} Die ${ziffern[d]} heißt ${auf ? 'aufrunden' : 'abrunden'}.` + (auf && ((d > 0 && ziffern[d - 1] === 9) || (d === 0 && ganz % 10 === 9)) ? ' Aus 9 wird 10, darum springt die Stelle davor.' : '');
  return neu('runden', [zahl, d], { thema: 'runden', typ: 'zahl', stufe, rechnung: `${zahl} ≈ ?`, frage, antwort: { wert }, hinweise: d === 1 ? ['runden'] : ['runden', 'runden2'], loesungsweg: [`${strich} → ${auf ? 'aufrunden' : 'abrunden'} → ${anzeige}`], erklaerung: erkl });
}

// ---------- Bruch aus Bild ----------

export function bruchBild(stufe, rng) {
  let bild, z, n, kuerzen = false, erkl = 'Oben die gefärbten Teile, unten alle Teile.';
  if (stufe === 1) {
    if (rng() < 0.6) { n = wahl(rng, [2, 4, 5, 10]); z = zufall(rng, 1, n - 1); bild = { form: 'streifen', teile: n, gefaerbt: z }; }
    else { n = wahl(rng, [2, 4]); z = zufall(rng, 1, n - 1); bild = { form: 'kreis', teile: n, gefaerbt: z }; }
  } else if (stufe === 2) {
    const sp = wahl(rng, [4, 5]); n = 2 * sp; z = zufall(rng, 1, n - 1);
    bild = { form: 'rechteck', zeilen: 2, spalten: sp, gefaerbt: z };
    erkl = `Das Rechteck hat 2 Reihen mit je ${sp} Kästchen. Das sind ${n} Teile.`;
  } else {
    n = 4; z = wahl(rng, [1, 2, 3]); bild = { form: 'quadrat', gefaerbt: z }; kuerzen = true;
    erkl = z === 2 ? '2/4 ist dasselbe wie 1/2.' : 'Das Quadrat hat 4 Felder.';
  }
  return neu('bruch-bild', [bild.form, n, z], { thema: 'bruch-bild', typ: 'bruch', stufe, bild, frage: 'Welcher Bruch ist gefärbt?', antwort: { zaehler: z, nenner: n, kuerzen_erlaubt: kuerzen }, hinweise: ['bruch'], loesungsweg: [`${z} von ${n} Teilen gefärbt → ${z}/${n}`], erklaerung: erkl });
}

// ---------- Kugel ----------

const KUGEL_GESCHICHTEN = [
  { ding: 'Ein Wasserball', satz: 'Er wird am Strand aufgepustet.', frage: 'Wie viel cm³ Luft passt in den Ball?', art: 'V' },
  { ding: 'Ein Fußball', satz: 'Er wird mit einer Pumpe aufgepumpt.', frage: 'Wie viel cm³ Luft passt in den Ball?', art: 'V' },
  { ding: 'Eine Glaskugel', satz: 'Sie ist innen mit Wasser gefüllt.', frage: 'Wie viel cm³ Wasser passt hinein?', art: 'V' },
  { ding: 'Ein Basketball', satz: 'Er ist außen mit Leder überzogen.', frage: 'Wie viel cm² Leder braucht man?', art: 'O' },
  { ding: 'Ein Globus', satz: 'Die Weltkarte ist außen aufgeklebt.', frage: 'Wie viel cm² Papier hat die Weltkarte?', art: 'O' },
  { ding: 'Eine Weihnachtskugel', satz: 'Sie wird außen bemalt.', frage: 'Wie viel cm² Fläche wird bemalt?', art: 'O' }
];

export function kugel(stufe, rng) {
  const mitD = stufe >= 2 && rng() < 0.6;
  const r = zufall(rng, 5, 20);
  const g = stufe === 3 ? wahl(rng, KUGEL_GESCHICHTEN) : null;
  const art = g ? g.art : wahl(rng, ['V', 'O']);
  const schritte = [], weg = [];
  if (g) { schritte.push({ text: 'Volumen oder Oberfläche?', optionen: ['Volumen', 'Oberfläche'], richtig: art === 'V' ? 0 : 1 }); weg.push(art === 'V' ? '„passt hinein" → V (Volumen)' : '„außen" → A_O (Oberfläche)'); }
  if (mitD) { schritte.push({ text: 'Radius r =', wert: r, einheit: 'cm' }); weg.push(`r = ${2 * r} : 2 = ${r} cm`); }
  let x;
  if (art === 'V') {
    x = 4 / 3 * Math.PI * r ** 3;
    schritte.push({ text: 'Zwischenergebnis =', wert: r * r }, { text: 'r³ =', wert: r ** 3 }, gs({ text: `4 ÷ 3 × π × ${r ** 3} =`, wert: r3(x), toleranz: 0.01 }, x), { text: 'Runde auf eine Stelle nach dem Komma. V ≈', wert: r1(x), einheit: 'cm³', runden: 1 });
    weg.push(`${r} · ${r} = ${r * r}`, `r³ = ${r * r} · ${r} = ${r ** 3}`, `4 ÷ 3 × π × ${r ** 3} = ${zahlText(r3(x))}…`, `V ≈ ${zahlText(r1(x), 1)} cm³`);
  } else {
    x = 4 * Math.PI * r ** 2;
    schritte.push({ text: 'r² =', wert: r ** 2 }, gs({ text: `4 × π × ${r ** 2} =`, wert: r3(x), toleranz: 0.01 }, x), { text: 'Runde auf eine Stelle nach dem Komma. O ≈', wert: r1(x), einheit: 'cm²', runden: 1 });
    weg.push(`r² = ${r} · ${r} = ${r ** 2}`, `4 × π × ${r ** 2} = ${zahlText(r3(x))}…`, `O ≈ ${zahlText(r1(x), 1)} cm²`);
  }
  const mass = mitD ? `einen Durchmesser von ${2 * r} cm` : `einen Radius von ${r} cm`;
  const felder = {
    thema: 'kugel', typ: 'schritte', stufe, taschenrechner: true, bild: mitD ? { form: 'kugel', d: 2 * r } : { form: 'kugel', r },
    schritte, hinweise: g ? ['kugel', 'runden', 'lang'] : ['kugel', 'runden'], loesungsweg: weg,
    gegeben: [mitD ? { name: 'Durchmesser d', wert: 2 * r, einheit: 'cm' } : { name: 'Radius r', wert: r, einheit: 'cm' }],
    erklaerung: (art === 'V' ? 'Formel V = 4/3 · π · r³.' : 'Formel O = 4 · π · r².') + (mitD ? ' In der Formel steht r, nicht d.' : '')
  };
  if (g) { felder.geschichte = `${g.ding} hat ${mass}. ${g.satz}`; felder.frage = g.frage; }
  else felder.frage = mitD ? `Eine Kugel hat den Durchmesser d = ${2 * r} cm. Wie groß ist ${art === 'V' ? 'das Volumen' : 'die Oberfläche'}?` : `Kugel mit r = ${r} cm: Wie groß ist ${art === 'V' ? 'das Volumen' : 'die Oberfläche'}?`;
  return neu('kugel', [art, mitD ? 'd' : 'r', mitD ? 2 * r : r, g ? KUGEL_GESCHICHTEN.indexOf(g) : 'x'], felder);
}


// ---------- Zylinder (03 Abschnitt 6.2) ----------
// Stufe 1: Volumen mit r. Stufe 2: Volumen mit d („Radius r =“ ohne „d : 2“) und Geschichten.
// Stufe 3: Oberfläche (A_G, A_M, A_O) oder Mantel, mit „Was ist gesucht?“. Rechenweg wie auf dem Rechner: π × r² × h.

const ZYL_VOLUMEN = [
  { ding: 'Eine Dose hat die Form eines Zylinders.', pr: 'Sie', frage: 'Wie viel cm³ passen in die Dose?', r: [3, 6], h: [8, 15] },
  { ding: 'Ein Trinkglas hat die Form eines Zylinders.', pr: 'Es', frage: 'Wie viel cm³ Wasser passen in das Glas?', r: [3, 5], h: [8, 14] },
  { ding: 'Eine Regentonne hat die Form eines Zylinders.', pr: 'Sie', frage: 'Wie viel cm³ Wasser passen in die Regentonne?', r: [20, 40, 5], h: [50, 100, 10] },
  { ding: 'Eine Kerze hat die Form eines Zylinders.', pr: 'Sie', frage: 'Wie viel cm³ Wachs hat die Kerze?', r: [2, 5], h: [5, 20] },
  { ding: 'Ein kleiner Pool hat die Form eines Zylinders.', pr: 'Er', frage: 'Wie viel m³ Wasser passen in den Pool?', r: [1, 3], h: [1, 2], m: true }
];
// text(hoch, mass): hoch = „10 cm hoch“, mass = „Der Radius ist 4 cm.“
const ZYL_AUSSEN = [
  { art: 'O', frage: 'Wie viel cm² Blech braucht man für eine Dose?', text: (h, m) => `Eine Fabrik macht Dosen aus Blech. Eine Dose ist ${h}. ${m} Die Dose hat einen Boden und einen Deckel.` },
  { art: 'O', frage: 'Wie viel cm² Papier braucht man?', text: (h, m) => `Eine Geschenkdose ist ${h}. ${m} Die ganze Dose wird mit Papier beklebt, auch Boden und Deckel.` },
  { art: 'M', frage: 'Wie viel cm² Papier braucht man?', text: (h, m) => `Eine Dose ist ${h}. ${m} Um die Dose wird ein Etikett geklebt. Es geht einmal außen herum, nicht auf Boden und Deckel.` },
  { art: 'M', frage: 'Wie viel cm² Papier braucht man?', text: (h, m) => `Eine Laterne hat die Form eines Zylinders. Sie ist ${h}. ${m} Das Papier geht nur einmal außen herum.` },
  { art: 'V', frage: 'Wie viel cm³ Wasser passen in die Vase?', text: (h, m) => `Eine Vase hat die Form eines Zylinders. Sie ist ${h}. ${m}` }
];
const ausBereich = (rng, [a, b, schritt = 1]) => a + schritt * zufall(rng, 0, Math.floor((b - a) / schritt));

export function zylinder(stufe, rng, opts = {}) {
  let art = 'V', g = null, r = zufall(rng, 2, 10), h = zufall(rng, 3, 20), mitD = false, m = false;
  if (stufe === 2) {
    mitD = rng() < 0.7;
    if (rng() < 0.6) { g = wahl(rng, ZYL_VOLUMEN); r = ausBereich(rng, g.r); h = ausBereich(rng, g.h); m = !!g.m; }
  } else if (stufe === 3 && opts.ohneAuswahl) {
    // Etappe „Oberfläche und Mantel“: ohne „Was ist gesucht?“, die Frage nennt, was gesucht ist
    art = rng() < 0.5 ? 'O' : 'M';
  } else if (stufe === 3 && !opts.ohneGesucht4 && rng() < 0.25) {
    return zylinderGesucht4(rng);
  } else if (stufe === 3) {
    if (rng() < 0.35) art = 'O';
    else { g = wahl(rng, ZYL_AUSSEN); art = g.art; r = zufall(rng, 2, 8); h = zufall(rng, 5, 20); mitD = rng() < 0.5; }
  }
  const e = m ? 'm' : 'cm';
  const schritte = [], weg = [];
  if (g && stufe === 3) {
    const opt = art === 'M' ? ['Volumen', 'Mantel'] : ['Volumen', 'Oberfläche'];
    if (art === 'V' && rng() < 0.5) opt[1] = 'Mantel';
    schritte.push({ text: 'Was ist gesucht?', optionen: opt, richtig: art === 'V' ? 0 : 1 });
    weg.push(art === 'V' ? 'passt hinein → V (Volumen)' : art === 'M' ? 'außen herum → A_M (Mantel)' : 'Boden, Deckel und Mantel → A_O (Oberfläche)');
  }
  if (mitD) { schritte.push({ text: 'Radius r =', wert: r, einheit: e }); weg.push(`r = ${2 * r} : 2 = ${r} ${e}`); }
  let x, erkl;
  if (art === 'V') {
    x = Math.PI * r * r * h;
    schritte.push({ text: 'r² =', wert: r * r }, gs({ text: `V = π × ${r * r} × ${h} =`, wert: r3(x), toleranz: 0.01 }, x), { text: 'Runde auf eine Stelle nach dem Komma. V ≈', wert: r1(x), einheit: `${e}³`, runden: 1 });
    weg.push(`r² = ${r} · ${r} = ${r * r}`, `π × ${r * r} × ${h} = ${zahlText(r3(x))}…`, `V ≈ ${zahlText(r1(x), 1)} ${e}³`);
    erkl = 'Formel V = π · r² · h. Erst r², dann mal π und mal h.' + (mitD ? ' In der Formel steht r, nicht d.' : '');
  } else {
    const ag = Math.PI * r * r, am = 2 * Math.PI * r * h, ao = 2 * ag + am;
    const formel = !g; // ohne Geschichte: Formeln stehen in der Beschriftung (Einsetzen ist der Lerninhalt)
    if (art === 'O') schritte.push(gs({ text: formel ? 'A_G = π · r² =' : 'A_G =', wert: r3(ag), toleranz: 0.01, einheit: 'cm²' }, ag));
    schritte.push(gs({ text: formel ? 'A_M = 2 · π · r · h =' : 'A_M =', wert: r3(am), toleranz: 0.01, einheit: 'cm²' }, am));
    if (art === 'O') {
      schritte.push(gsAus({ text: formel ? 'A_O = 2 · A_G + A_M =' : 'A_O =', wert: r3(ao), toleranz: 0.02, einheit: 'cm²' }, [ag, am], (g, m) => 2 * g + m));
      weg.push(`A_G = π × ${r * r} = ${zahlText(r3(ag))}… cm²`);
    }
    weg.push(`A_M = 2 × π × ${r} × ${h} = ${zahlText(r3(am))}… cm²`);
    x = art === 'O' ? ao : am;
    const n = art === 'O' ? 'A_O' : 'A_M';
    if (art === 'O') weg.push(`A_O = 2 × ${zahlText(ag, 2)} + ${zahlText(am, 2)} = ${zahlText(2 * Math.round(ag * 100) / 100 + Math.round(am * 100) / 100, 2)} cm²`);
    schritte.push({ text: `Runde auf eine Stelle nach dem Komma. ${n} ≈`, wert: r1(x), einheit: 'cm²', runden: 1 });
    weg.push(`${n} ≈ ${zahlText(r1(x), 1)} cm²`);
    erkl = art === 'O' ? 'Ein Zylinder hat zwei Kreise (Boden und Deckel) und den Mantel.' : 'Nur außen herum, also nur der Mantel.';
  }
  const mass = mitD ? `Der Durchmesser ist ${2 * r} ${e}.` : `Der Radius ist ${r} ${e}.`;
  const felder = {
    thema: 'zylinder', typ: 'schritte', stufe, taschenrechner: true,
    bild: { form: 'zylinder', ...(mitD ? { d: 2 * r } : { r }), h, ...(m ? { einheit: 'm' } : {}) },
    gegeben: [mitD ? { name: 'Durchmesser d', wert: 2 * r, einheit: e } : { name: 'Radius r', wert: r, einheit: e }, { name: 'Höhe h', wert: h, einheit: e }],
    schritte, hinweise: g ? ['zylinder', 'runden', 'lang'] : ['zylinder', 'runden'], loesungsweg: weg, erklaerung: erkl
  };
  if (g) {
    felder.geschichte = g.text ? g.text(`${h} ${e} hoch`, mass) : `${g.ding} ${g.pr} ist ${h} ${e} hoch. ${mass}`;
    felder.frage = g.frage;
  } else {
    const was = art === 'V' ? 'sein Volumen' : art === 'M' ? 'sein Mantel' : 'seine Oberfläche';
    felder.frage = `Ein Zylinder hat ${mitD ? `den Durchmesser d = ${2 * r}` : `den Radius r = ${r}`} ${e} und die Höhe h = ${h} ${e}. Wie groß ist ${was}?`;
  }
  return neu('zylinder', [art, mitD ? 'd' : 'r', mitD ? 2 * r : r, h, g ? (stufe === 3 ? ZYL_AUSSEN : ZYL_VOLUMEN).indexOf(g) : 'x'], felder);
}

// ---------- Geschichten ----------

const NAMEN = [['Emir', 'm'], ['Sara', 'w'], ['Ben', 'm'], ['Lina', 'w'], ['Noah', 'm'], ['Jana', 'w'], ['Paul', 'm'], ['Mia', 'w'], ['Leon', 'm'], ['Ayla', 'w'], ['Malik', 'm'], ['Nele', 'w'], ['Can', 'm'], ['Zoe', 'w']];
const pron = g => g === 'm' ? { er: 'Er', sein: 'seinem', seiner: 'seiner', ihm: 'ihm' } : { er: 'Sie', sein: 'ihrem', seiner: 'ihrer', ihm: 'ihr' };
const VERWANDTE = [['Bruder', 'm'], ['Schwester', 'w'], ['Vater', 'm'], ['Mutter', 'w'], ['Onkel', 'm'], ['Freund', 'm'], ['Freundin', 'w']];
const DINGE = [
  ['eine Kinokarte', 'für eine Kinokarte', 8, 15], ['ein Busticket', 'für ein Busticket', 3, 9], ['einen Döner und ein Getränk', 'für das Essen', 6, 12],
  ['ein Buch', 'für ein Buch', 8, 20], ['ein T-Shirt', 'für ein T-Shirt', 10, 30], ['ein Handyspiel', 'für ein Handyspiel', 5, 40],
  ['Kopfhörer', 'für Kopfhörer', 20, 80], ['Sneaker', 'für Sneaker', 40, 100], ['eine Konzertkarte', 'für eine Konzertkarte', 30, 90], ['ein Videospiel', 'für ein Videospiel', 30, 70]
];
const EINNAHMEN = [['als Taschengeld', 10, 50], ['für Rasenmähen beim Nachbarn', 5, 20], ['zum Geburtstag', 10, 100], ['für Babysitten', 10, 30], ['für Hilfe im Garten', 5, 25]];
const passend = (rng, liste, max, unten = 2, oben = 3) => { const ok = liste.filter(x => x[unten] <= max); const x = wahl(rng, ok.length ? ok : liste); return { x, n: zufall(rng, x[unten], Math.min(x[oben], max)) }; };
const UNNOETIG = ['Draußen scheint die Sonne.', 'Am Abend ist ein Fußballspiel im Fernsehen.', 'Morgen ist Mittwoch.'];

export function geldGeschichte(stufe, rng, opts = {}) {
  const [name, g] = wahl(rng, NAMEN);
  const p = pron(g);
  const max = stufe === 1 ? 20 : stufe === 2 ? 50 : 100;
  const vorlage = stufe === 3 ? wahl(rng, ['schulden-bekommt', 'kauf-leiht', 'kauf-dann-geld']) : wahl(rng, ['schulden-bekommt', 'kauf-leiht', 'noch-mehr-schulden']);
  const [verw, vg] = wahl(rng, VERWANDTE);
  const bei = `bei ${vg === 'm' ? p.sein : p.seiner} ${verw}`;
  let saetze = [], wert, weg, gegeben, erkl, param, karten;
  for (let v = 0; v < 100; v++) {
    const a = zufall(rng, 3, max), b = zufall(rng, 3, max), c = zufall(rng, 3, max);
    if (vorlage === 'schulden-bekommt') {
      const { x: einX, n: b2 } = passend(rng, EINNAHMEN, max, 1, 2);
      const ein = einX[0];
      if (a === b2) continue;
      if (opts.fokus === 'vorzeichen' && b2 > a && rng() < 0.5) continue;
      { const b = b2;
      saetze = [`${name} hat ${a} € Schulden ${bei}.`, `Dann bekommt ${p.er.toLowerCase() === 'er' ? 'er' : 'sie'} ${b} € ${ein}.`, `Mit dem Geld zahlt ${p.er.toLowerCase() === "er" ? "er" : "sie"} sofort Schulden zurück.`];
      wert = -a + b; weg = [`${M}${a} + ${b} = ${zahlText(wert)}`];
      karten = [['Am Anfang', `${M}${a}`, `${a}`], ['Dann', `+ ${b}`, `${M} ${b}`]];
      gegeben = [{ name: 'Schulden am Anfang', wert: a, einheit: '€' }, { name: 'bekommt', wert: b, einheit: '€' }];
      erkl = wert > 0 ? `Die ${a} € Schulden sind weg. Von den ${b} € bleiben ${wert} € übrig.` : `${b} € reichen nicht. Es bleiben ${-wert} € Schulden.`;
      param = [vorlage, a, b]; }
    } else if (vorlage === 'kauf-leiht') {
      const { x: dx, n: b } = passend(rng, DINGE, max);
      const ding = dx[0];
      if (b <= 3) continue;
      const a = zufall(rng, 1, b - 1);
      saetze = [`${name} hat ${a} € im Portemonnaie.`, `${p.er} kauft ${ding} für ${b} €.`, `${vg === 'm' ? 'Sein' : 'Seine'} ${verw} leiht ${p.ihm} das Geld, das fehlt.`];
      if (g === 'w') saetze[2] = `${vg === 'm' ? 'Ihr' : 'Ihre'} ${verw} leiht ${p.ihm} das Geld, das fehlt.`;
      wert = a - b; weg = [`${a} − ${b} = ${zahlText(wert)}`];
      karten = [['Am Anfang', `${a}`, `${M}${a}`], ['Kauf', `${M} ${b}`, `+ ${b}`]];
      gegeben = [{ name: 'Geld am Anfang', wert: a, einheit: '€' }, { name: 'Preis', wert: b, einheit: '€' }];
      erkl = `${name} bezahlt mit ${a} €. Es fehlen ${-wert} €, das sind Schulden.`;
      param = [vorlage, a, b];
    } else if (vorlage === 'noch-mehr-schulden') {
      const { x: dx, n: b } = passend(rng, DINGE, max);
      const fuer = dx[1];
      if (a + b > 100) continue;
      saetze = [`${name} hat schon ${a} € Schulden ${bei}.`, `Am nächsten Tag leiht ${p.er.toLowerCase() === 'er' ? 'er' : 'sie'} sich noch ${b} € ${fuer}.`];
      wert = -a - b; weg = [`${M}${a} − ${b} = ${zahlText(wert)}`];
      karten = [['Am Anfang', `${M}${a}`, `${a}`], ['Dann', `${M} ${b}`, `+ ${b}`]];
      gegeben = [{ name: 'Schulden am Anfang', wert: a, einheit: '€' }, { name: 'leiht sich noch', wert: b, einheit: '€' }];
      erkl = `Die Schulden werden größer: ${a} € und ${b} € sind ${a + b} € Schulden.`;
      param = [vorlage, a, b];
    } else {
      const { x: dx, n: b } = passend(rng, DINGE, max);
      const ding = dx[0];
      const a = zufall(rng, 1, b - 1);
      const { x: ex, n: c } = passend(rng, EINNAHMEN, max, 1, 2);
      if (b <= 3) continue;
      const zw = a - b; wert = zw + c;
      if (wert === 0 || Math.abs(wert) > 100) continue;
      saetze = [`${name} hat ${a} €.`, `${p.er} kauft ${ding} für ${b} € und leiht sich das fehlende Geld.`, `Eine Woche später bekommt ${p.er.toLowerCase() === 'er' ? 'er' : 'sie'} ${c} € ${ex[0]}.`];
      weg = [`${a} − ${b} = ${zahlText(zw)}`, `${zahlText(zw)} + ${c} = ${zahlText(wert)}`];
      karten = [['Am Anfang', `${a}`, `${M}${a}`], ['Kauf', `${M} ${b}`, `+ ${b}`], ['Später', `+ ${c}`, `${M} ${c}`]];
      gegeben = [{ name: 'Geld am Anfang', wert: a, einheit: '€' }, { name: 'Preis', wert: b, einheit: '€' }, { name: 'bekommt später', wert: c, einheit: '€' }];
      erkl = `Nach dem Kauf hat ${name} ${-zw} € Schulden. ${satzErgebnis(wert)}`;
      param = [vorlage, a, b, c];
    }
    break;
  }
  // Ganz kurze Geschichte (1–2 Sätze, ohne Merkzettel) für die kurzen Plätze: Text wird zur Gewohnheit
  if (opts.mini) {
    return neu('geld-mini', [...param, name], {
      thema: 'minus-zahlen', typ: 'zahl', stufe: 1, geschichte: saetze.slice(0, 2).join(' '),
      frage: `Hat ${name} danach Geld oder Schulden? Wie viel?`, antwort: { wert, einheit: '€' },
      hinweise: ['euro'], loesungsweg: weg, erklaerung: erkl
    });
  }
  if (stufe === 3 && rng() < 0.4) saetze.splice(1, 0, wahl(rng, UNNOETIG));
  const lang = saetze.length >= 3;
  // Rechnung legen: je Teil der Geschichte ein Kärtchen wählen (Geld oder Schulden, dazu oder weg)
  const legen = kartenSchritt('Leg die Rechnung. Wähle für jeden Teil ein Kärtchen.', karten, rng);
  const rechnung = karten.map(k => k[1]).join(' ');
  return neu('geld-geschichte', [...param, name], {
    thema: 'minus-zahlen', typ: 'schritte', stufe, geschichte: saetze.join(' '),
    frage: `Hat ${name} danach Geld oder Schulden? Wie viel?`,
    schritte: [legen, { text: `${rechnung} =`, wert, einheit: '€' }],
    hinweise: lang ? ['euro', 'lang'] : ['euro'],
    loesungsweg: [`Rechnung: ${rechnung}`, weg.length > 1 ? weg.join(' → ') : weg[0]], erklaerung: erkl, gegeben
  });
}

// Schritt „Rechnung legen“: karten = [[Bezeichnung, richtig, falsch], …]. Reihenfolge der zwei Kärtchen zufällig.
function kartenSchritt(text, karten, rng) {
  return {
    text,
    karten: karten.map(([label, ok, falsch]) => {
      const vorne = rng() < 0.5;
      return { label, optionen: vorne ? [ok, falsch] : [falsch, ok], richtig: vorne ? 0 : 1 };
    })
  };
}

const LAEDEN = [
  { laden: 'Im Sportgeschäft', nom: 'Ein Paar Fußballschuhe', verb: 'kostet', akk: 'die Fußballschuhe', preise: [60, 80, 90, 100, 120] },
  { laden: 'Im Elektromarkt', nom: 'Kopfhörer', verb: 'kosten', akk: 'die Kopfhörer', preise: [40, 60, 80, 100, 150] },
  { laden: 'Im Spieleladen', nom: 'Ein Videospiel', verb: 'kostet', akk: 'das Videospiel', preise: [40, 50, 60, 70, 80] },
  { laden: 'Im Fahrradladen', nom: 'Ein Fahrradhelm', verb: 'kostet', akk: 'den Helm', preise: [40, 50, 60, 80] },
  { laden: 'Im Modegeschäft', nom: 'Eine Jacke', verb: 'kostet', akk: 'die Jacke', preise: [60, 80, 90, 100, 120] },
  { laden: 'Im Handyladen', nom: 'Eine Handyhülle', verb: 'kostet', akk: 'die Handyhülle', preise: [20, 30, 40, 50] }
];

export function rabattGeschichte(stufe, rng) {
  const l = wahl(rng, LAEDEN);
  const [name] = wahl(rng, NAMEN);
  for (let v = 0; v < 100; v++) {
    const q = stufe >= 3 ? wahl(rng, [30, 40, 20, 25]) : wahl(rng, [10, 20, 25, 50]);
    const preis = wahl(rng, l.preise);
    const spar = preis * q / 100;
    if (!Number.isInteger(spar * 100) || (stufe < 3 && !Number.isInteger(spar))) continue;
    const neuP = preis - spar;
    const saetze = [`${l.laden} gibt es diese Woche ${q} % Rabatt.`, `${l.nom} ${l.verb} normalerweise ${preis} €.`, `${name} kauft ${l.akk}.`];
    const regel = [30, 40].includes(q) ? `10 % = ${geld(preis / 10)} €, mal ${q / 10} = ${geld(spar)} €` : `${q} % von ${preis} € → ${preis} : ${PROZENT_REGEL[q]} = ${geld(spar)} €`;
    // Erst entscheiden, was zuerst gerechnet wird, dann die Rechnung für den neuen Preis legen
    const zuerst = rng() < 0.5 ? [`Was ${name} spart`, `Was ${name} bezahlt`] : [`Was ${name} bezahlt`, `Was ${name} spart`];
    const legen = kartenSchritt('Leg die Rechnung für den neuen Preis.', [['Preis', `${preis}`, `${geld(spar)}`], ['Rabatt', `${M} ${geld(spar)}`, `+ ${geld(spar)}`]], rng);
    return neu('rabatt-geschichte', [q, preis, LAEDEN.indexOf(l), name], {
      thema: 'rabatt', typ: 'schritte', stufe, geschichte: saetze.join(' '), frage: `Wie viel Euro spart ${name}? Wie viel muss ${name} bezahlen?`,
      schritte: [
        { text: 'Was rechnest du zuerst?', optionen: zuerst, richtig: zuerst.indexOf(`Was ${name} spart`) },
        { text: `Wie viel Euro spart ${name}?`, wert: spar, einheit: '€' },
        legen,
        { text: `Wie viel muss ${name} bezahlen?`, wert: neuP, einheit: '€' }
      ],
      hinweise: ['lang', 'text', [30, 40].includes(q) ? 'baukasten' : 'prozent'],
      loesungsweg: ['Zuerst: was gespart wird (der Rabatt)', regel, `Rechnung: ${preis} − ${geld(spar)}`, `${preis} € − ${geld(spar)} € = ${geld(neuP)} €`],
      erklaerung: 'Erst den Rabatt ausrechnen. Dann vom Preis abziehen.',
      gegeben: [{ name: 'Preis', wert: preis, einheit: '€' }, { name: 'Rabatt', wert: q, einheit: '%' }]
    });
  }
}

// ---------- Prozent mit Formel (Auftrag 30, ab Freigabe prozent_formel) ----------
// W = G · p : 100. Stufe 1 Formel direkt, Stufe 2 Formel im Text (Merkzettel G, p), Stufe 3 Rabatt mit Formel.
const PF_P = [5, 8, 12, 15, 18, 20, 25, 30, 35, 40, 45, 60, 65, 75];
const PF_TEXTE = [
  { k: 'bus', g: [20, 32], ganz: true, einheit: 'Kinder', text: (G, p) => `In einer Klasse sind ${G} Kinder. ${p} % kommen mit dem Bus.`, frage: 'Wie viele Kinder kommen mit dem Bus?' },
  { k: 'verein', g: [40, 600], ganz: true, einheit: 'Mitglieder', text: (G, p) => `Ein Sportverein hat ${G} Mitglieder. ${p} % davon spielen Fußball.`, frage: 'Wie viele Mitglieder spielen Fußball?' },
  { k: 'rabatt', g: [20, 600], ganz: false, einheit: '€', text: (G, p, d) => `${d.nom} kostet ${G} €. Heute gibt es ${p} % Rabatt.`, frage: () => 'Wie viel Euro sparst du?' },
  { k: 'erspart', g: [40, 400], ganz: false, einheit: '€', text: (G, p, d, n) => `${n[0]} hat ${G} € gespart. ${n[1] === 'm' ? 'Er' : 'Sie'} gibt ${p} % davon für ${d.akk} aus.`, frage: (d, n) => `Wie viel Euro gibt ${n[0]} aus?` },
  { k: 'saft', g: [200, 1000], ganz: false, einheit: 'g', text: (G, p) => `Eine Flasche Saft hat ${G} g Inhalt. ${p} % davon sind Zucker.`, frage: 'Wie viel Gramm Zucker sind darin?' }
];
const PF_DINGE = [{ nom: 'Ein Handy', akk: 'ein Spiel', preis: [150, 600] }, { nom: 'Ein Fahrrad', akk: 'Kopfhörer', preis: [200, 600] }, { nom: 'Eine Jacke', akk: 'ein T-Shirt', preis: [40, 150] }, { nom: 'Ein Spiel', akk: 'eine Konzertkarte', preis: [20, 70] }, { nom: 'Ein Rucksack', akk: 'ein Buch', preis: [25, 90] }, { nom: 'Ein Paar Sneaker', akk: 'Sneaker', preis: [50, 150] }];
const pfW = (G, p) => Math.round(G * p) / 100;
export function prozentFormel(stufe, rng) {
  for (let v = 0; v < 300; v++) {
    if (stufe === 1) {
      const p = rng() < 1 / 3 ? wahl(rng, [10, 25, 50]) : wahl(rng, PF_P);
      const G = zufall(rng, 20, 300), W = pfW(G, p);
      if (!Number.isInteger(W * 100)) continue;
      return neu('prozent-formel', ['direkt', G, p], {
        thema: 'prozent-formel', typ: 'schritte', stufe, taschenrechner: true, frage: `${p} % von ${G} €`,
        schritte: [{ text: 'G =', wert: G, einheit: '€' }, { text: 'p =', wert: p }, { text: 'W = G · p : 100 =', wert: W, einheit: '€' }],
        hinweise: ['formel'], loesungsweg: [`G = ${G} €, p = ${p}`, `W = ${G} · ${p} : 100 = ${geld(W)} €`],
        erklaerung: 'G ist das Ganze (nach „von“), p die Zahl vor dem %.' + ([10, 25, 50].includes(p) ? ' Das geht auch im Kopf, das Ergebnis ist dasselbe.' : '')
      });
    }
    if (stufe === 2) {
      const t = wahl(rng, PF_TEXTE), d = wahl(rng, PF_DINGE), n = wahl(rng, NAMEN);
      const bereich = t.k === 'rabatt' ? d.preis : t.g;
      const p = wahl(rng, PF_P), G = t.k === 'bus' ? zufall(rng, bereich[0], bereich[1]) : zufall(rng, Math.ceil(bereich[0] / 5), Math.floor(bereich[1] / 5)) * 5, W = pfW(G, p);
      if (t.ganz ? !Number.isInteger(W) : !Number.isInteger(W * 100)) continue;
      if (t.einheit === 'g' && !Number.isInteger(W)) continue;
      const frage = typeof t.frage === 'function' ? t.frage(d, n) : t.frage;
      return neu('prozent-formel', ['text', t.k, G, p, PF_DINGE.indexOf(d), NAMEN.indexOf(n)], {
        thema: 'prozent-formel', typ: 'schritte', stufe, kategorie: 'text', taschenrechner: true,
        geschichte: t.text(G, p, d, n), frage,
        gegeben: [{ name: 'G', wert: G, einheit: t.einheit === 'Kinder' || t.einheit === 'Mitglieder' ? t.einheit : t.einheit }, { name: 'p', wert: p, einheit: '%' }],
        schritte: [{ text: 'W = G · p : 100 =', wert: W, einheit: t.einheit }],
        hinweise: ['formel', 'text'], loesungsweg: [`G = ${G} ${t.einheit}, p = ${p}`, `W = ${G} · ${p} : 100 = ${t.einheit === '€' ? geld(W) : zahlText(W)} ${t.einheit}`],
        erklaerung: 'Erst G und p aus dem Text holen. G ist das Ganze, p die Zahl vor dem %.'
      });
    }
    // Stufe 3: Rabatt mit Formel
    const d = wahl(rng, PF_DINGE);
    const p = wahl(rng, [10, 15, 20, 25, 30, 40]);
    const G = rng() < 0.6 ? zufall(rng, Math.ceil(d.preis[0] / 5), Math.floor(d.preis[1] / 5)) * 5 : zufall(rng, d.preis[0], d.preis[1]);
    const W = pfW(G, p), neuP = Math.round((G - W) * 100) / 100;
    if (!Number.isInteger(W * 100)) continue;
    return neu('prozent-formel', ['rabatt', G, p, PF_DINGE.indexOf(d)], {
      thema: 'prozent-formel', typ: 'schritte', stufe, kategorie: 'text', taschenrechner: true,
      geschichte: `${d.nom} kostet ${G} €. Heute gibt es ${p} % Rabatt.`, frage: 'Wie viel kostet es jetzt?',
      schritte: [{ text: 'G =', wert: G, einheit: '€' }, { text: 'p =', wert: p }, { text: 'Rabatt W = G · p : 100 =', wert: W, einheit: '€' }, { text: 'Neuer Preis = G − W =', wert: neuP, einheit: '€' }],
      hinweise: ['formel', 'text'], loesungsweg: [`G = ${G} €, p = ${p}`, `W = ${G} · ${p} : 100 = ${geld(W)} €`, `${G} € − ${geld(W)} € = ${geld(neuP)} €`],
      erklaerung: 'Erst den Rabatt mit der Formel. Dann vom Preis abziehen.'
    });
  }
  return null;
}

// ---------- Zylinder „Was wird gesucht?“ mit vier Möglichkeiten (Auftrag 30, Form gesucht4) ----------
const ZYL_GESUCHT4 = [
  { art: 'V', text: 'Ein Glas hat die Form eines Zylinders.', frage: 'Wie viel Wasser passt in das Glas?' },
  { art: 'M', text: 'Ein Etikett wird rund um die Dose geklebt. Deckel und Boden bleiben frei.', frage: 'Wie viel cm² Papier braucht man für das Etikett?' },
  { art: 'O', text: 'Eine Dose wird aus Blech gebaut, mit Deckel und Boden.', frage: 'Wie viel cm² Blech braucht man?' },
  { art: 'G', text: 'Eine Dose steht auf dem Tisch.', frage: 'Wie groß ist der runde Boden der Dose?' },
  { art: 'V', text: 'Ein Eimer hat die Form eines Zylinders.', frage: 'Wie viel Sand passt in den Eimer?' },
  { art: 'O', text: 'Eine Tonne wird ganz angemalt, auch Deckel und Boden.', frage: 'Wie viel cm² muss man anmalen?' },
  { art: 'V', text: 'Ein Topf hat die Form eines Zylinders.', frage: 'Wie viel Farbe passt in den Topf?' },
  { art: 'M', text: 'Ein Papierstreifen geht einmal um die Rolle herum.', frage: 'Wie viel cm² Papier braucht man?' },
  { art: 'G', text: 'Ein Untersetzer soll genau so groß sein wie der Boden einer Vase.', frage: 'Wie groß ist die Fläche des Bodens?' }
];
const GESUCHT4_OPT = ['V (Volumen)', 'A_O (Oberfläche)', 'A_M (Mantel)', 'A_G (Grundfläche)'];
const GESUCHT4_IDX = { V: 0, O: 1, M: 2, G: 3 };
function zylinderGesucht4(rng) {
  const g = wahl(rng, ZYL_GESUCHT4), r = zufall(rng, 2, 8), h = zufall(rng, 4, 20), mitD = rng() < 0.4, art = g.art;
  const ag = Math.PI * r * r, am = 2 * Math.PI * r * h, ao = 2 * ag + am, v = ag * h;
  const schritte = [{ text: 'Was wird gesucht?', optionen: GESUCHT4_OPT, richtig: GESUCHT4_IDX[art] }];
  const weg = [art === 'V' ? '„passt hinein“ → V (Volumen)' : art === 'M' ? '„rund herum“ → A_M (Mantel)' : art === 'O' ? '„alles außen, mit Deckel und Boden“ → A_O (Oberfläche)' : '„der runde Boden“ → A_G (Grundfläche)'];
  if (mitD) { schritte.push({ text: 'Radius r =', wert: r, einheit: 'cm' }); weg.push(`r = ${2 * r} : 2 = ${r} cm`); }
  let x, n, e = 'cm²';
  if (art === 'V') {
    schritte.push({ text: 'r² =', wert: r * r }, gs({ text: `V = π × ${r * r} × ${h} =`, wert: r3(v), toleranz: 0.01 }, v));
    weg.push(`π × ${r * r} × ${h} = ${zahlText(r3(v))}…`); x = v; n = 'V'; e = 'cm³';
  } else if (art === 'G') {
    schritte.push(gs({ text: 'A_G = π · r² =', wert: r3(ag), toleranz: 0.01, einheit: 'cm²' }, ag));
    weg.push(`A_G = π × ${r * r} = ${zahlText(r3(ag))}… cm²`); x = ag; n = 'A_G';
  } else if (art === 'M') {
    schritte.push(gs({ text: 'A_M = 2 · π · r · h =', wert: r3(am), toleranz: 0.01, einheit: 'cm²' }, am));
    weg.push(`A_M = 2 × π × ${r} × ${h} = ${zahlText(r3(am))}… cm²`); x = am; n = 'A_M';
  } else {
    schritte.push(gs({ text: 'A_G = π · r² =', wert: r3(ag), toleranz: 0.01, einheit: 'cm²' }, ag), gs({ text: 'A_M = 2 · π · r · h =', wert: r3(am), toleranz: 0.01, einheit: 'cm²' }, am), gsAus({ text: 'A_O = 2 · A_G + A_M =', wert: r3(ao), toleranz: 0.02, einheit: 'cm²' }, [ag, am], (g, m) => 2 * g + m));
    weg.push(`A_G = ${zahlText(r3(ag))}… cm², A_M = ${zahlText(r3(am))}… cm²`, `A_O = 2 · A_G + A_M = ${zahlText(r3(ao))}… cm²`); x = ao; n = 'A_O';
  }
  schritte.push({ text: `Runde auf eine Stelle nach dem Komma. ${n} ≈`, wert: r1(x), einheit: e, runden: 1 });
  weg.push(`${n} ≈ ${zahlText(r1(x), 1)} ${e}`);
  const mass = `${mitD ? `Der Durchmesser ist ${2 * r} cm` : `Der Radius ist ${r} cm`}, die Höhe ${h} cm.`;
  return neu('zylinder', ['gesucht4', art, ZYL_GESUCHT4.indexOf(g), mitD ? 'd' : 'r', mitD ? 2 * r : r, h], {
    thema: 'zylinder', typ: 'schritte', stufe: 3, form: 'gesucht4', taschenrechner: true,
    bild: { form: 'zylinder', ...(mitD ? { d: 2 * r } : { r }), h },
    geschichte: `${g.text} ${mass}`, frage: g.frage,
    gegeben: [mitD ? { name: 'Durchmesser d', wert: 2 * r, einheit: 'cm' } : { name: 'Radius r', wert: r, einheit: 'cm' }, { name: 'Höhe h', wert: h, einheit: 'cm' }],
    schritte, hinweise: ['zylinder', 'runden', 'lang'], loesungsweg: weg,
    erklaerung: '„passt hinein“ → Volumen. „rund herum“ → Mantel. „alles außen, mit Deckel und Boden“ → Oberfläche. „der Boden“ → Grundfläche.'
  });
}

// ---------- Kegel und Pyramide (Auftrag 30) ----------
// Mehr Abwechslung bei viel Übungszeit; die festen Aufgaben app-kegel-*, app-pyramide-* bleiben.
const KEGEL_TRIPEL = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15]];
export function kegel(stufe, rng) {
  const mantel = stufe >= 2 && rng() < (stufe === 3 ? 0.6 : 0.4);
  if (mantel) {
    const [r, h, sl] = wahl(rng, KEGEL_TRIPEL), am = Math.PI * r * sl;
    const opt = rng() < 0.5 ? [`h = ${h} cm`, `s = ${sl} cm`] : [`s = ${sl} cm`, `h = ${h} cm`];
    return neu('kegel', ['mantel', r, h, sl], {
      thema: 'kegel', typ: 'schritte', stufe, taschenrechner: true, bild: { form: 'kegel', r, h, s: sl },
      frage: `Ein Kegel hat den Radius r = ${r} cm, die Höhe h = ${h} cm und die Mantellinie s = ${sl} cm. Wie groß ist sein Mantel?`,
      gegeben: [{ name: 'Radius r', wert: r, einheit: 'cm' }, { name: 'Höhe h', wert: h, einheit: 'cm' }, { name: 'Mantellinie s', wert: sl, einheit: 'cm' }],
      schritte: [{ text: 'Welche Länge brauchst du für den Mantel?', optionen: opt, richtig: opt.findIndex(o => o.startsWith('s')) },
        gs({ text: 'A_M = π · r · s =', wert: r3(am), toleranz: 0.01, einheit: 'cm²' }, am),
        { text: 'Runde auf eine Stelle nach dem Komma. A_M ≈', wert: r1(am), einheit: 'cm²', runden: 1 }],
      hinweise: ['kegel', 'runden'], loesungsweg: ['Mantel → s (schräg außen)', `A_M = π × ${r} × ${sl} = ${zahlText(r3(am))}… cm²`, `A_M ≈ ${zahlText(r1(am), 1)} cm²`],
      erklaerung: 'Für den Mantel brauchst du s, die schräge Linie außen. h ist innen.'
    });
  }
  const mitD = stufe >= 2;
  const r = mitD ? zufall(rng, 2, 8) : zufall(rng, 2, 6), h = zufall(rng, 5, 15);
  const z = Math.PI * r * r * h, v = z / 3;
  const schritte = [], weg = [];
  if (mitD) { schritte.push({ text: 'Radius r =', wert: r, einheit: 'cm' }); weg.push(`r = ${2 * r} : 2 = ${r} cm`); }
  schritte.push({ text: 'r² =', wert: r * r }, gs({ text: `π × ${r * r} × ${h} =`, wert: r3(z), toleranz: 0.01 }, z),
    gsAus({ text: 'Ein Drittel davon (: 3) =', wert: r3(v), toleranz: 0.01 }, [z], (q) => q / 3), { text: 'Runde auf eine Stelle nach dem Komma. V ≈', wert: r1(v), einheit: 'cm³', runden: 1 });
  weg.push(`r² = ${r * r}`, `π × ${r * r} × ${h} = ${zahlText(r3(z))}… (wie Zylinder)`, `: 3 = ${zahlText(r3(v))}…`, `V ≈ ${zahlText(r1(v), 1)} cm³`);
  return neu('kegel', ['volumen', mitD ? 'd' : 'r', mitD ? 2 * r : r, h], {
    thema: 'kegel', typ: 'schritte', stufe, taschenrechner: true, bild: { form: 'kegel', ...(mitD ? { d: 2 * r } : { r }), h },
    frage: `Ein Kegel hat ${mitD ? `den Durchmesser d = ${2 * r}` : `den Radius r = ${r}`} cm und die Höhe h = ${h} cm. Wie groß ist sein Volumen?`,
    gegeben: [mitD ? { name: 'Durchmesser d', wert: 2 * r, einheit: 'cm' } : { name: 'Radius r', wert: r, einheit: 'cm' }, { name: 'Höhe h', wert: h, einheit: 'cm' }],
    schritte, hinweise: ['kegel', 'runden'], loesungsweg: weg,
    erklaerung: 'Erst wie beim Zylinder: π · r² · h. Dann durch 3.' + (mitD ? ' In der Formel steht r, nicht d.' : '')
  });
}
export function pyramide(stufe, rng) {
  for (let v = 0; v < 200; v++) {
    const inM = stufe >= 2 && rng() < 0.25;
    const a = inM ? zufall(rng, 2, 6) : zufall(rng, 3, 12), h = inM ? zufall(rng, 2, 5) : zufall(rng, 4, 15);
    const e = inM ? 'm' : 'cm', ag = a * a, ah = ag * h, vol = ah / 3, ganz = ah % 3 === 0;
    if (stufe === 1 && !ganz) continue;
    const schritte = [{ text: 'A_G = a · a =', wert: ag, einheit: `${e}²` }, { text: 'A_G · h =', wert: ah }];
    const weg = [`A_G = ${a} · ${a} = ${ag} ${e}²`, `${ag} · ${h} = ${ah}`];
    if (ganz) { schritte.push({ text: 'Ein Drittel davon (: 3). V =', wert: vol, einheit: `${e}³` }); weg.push(`${ah} : 3 = ${vol} ${e}³`); }
    else {
      schritte.push(gs({ text: 'Ein Drittel davon (: 3) =', wert: r3(vol), toleranz: 0.01 }, vol), { text: 'Runde auf eine Stelle nach dem Komma. V ≈', wert: r1(vol), einheit: `${e}³`, runden: 1 });
      weg.push(`${ah} : 3 = ${zahlText(r3(vol))}…`, `V ≈ ${zahlText(r1(vol), 1)} ${e}³`);
    }
    return neu('pyramide', ['volumen', a, h, e], {
      thema: 'pyramide', typ: 'schritte', stufe, taschenrechner: true, bild: { form: 'pyramide', a, h, ...(inM ? { einheit: 'm' } : {}) },
      ...(inM ? { geschichte: `Ein Zelt hat die Form einer Pyramide. Unten ist ein Quadrat mit der Seite ${a} m. Das Zelt ist ${h} m hoch.`, frage: 'Wie viel m³ Luft sind im Zelt?' }
        : { frage: `Eine Pyramide hat eine quadratische Grundfläche mit der Seite a = ${a} cm. Sie ist h = ${h} cm hoch. Wie groß ist ihr Volumen?` }),
      gegeben: [{ name: 'Seite a', wert: a, einheit: e }, { name: 'Höhe h', wert: h, einheit: e }],
      schritte, hinweise: ganz ? ['pyramide'] : ['pyramide', 'runden'], loesungsweg: weg,
      erklaerung: 'Erst die Grundfläche a · a, dann mal h. Dann durch 3.'
    });
  }
  return null;
}

// ---------- Kreisdiagramm (Auftrag 33) ----------
// Stufe 1: 3 Teile, gefragt 2 Teile mit 50/25/10/20 %. Stufe 2: 3–4 Teile, alle gefragt, der letzte als Bonus.
// Stufe 3: umgekehrt: Anzahl → Prozent, oder ein Teil ohne Prozent („Der Rest“). Jede Anzahl ist ganz.
const KD_FARBEN = ['#1F6F75', '#E9B65A', '#9FC8C8', '#C98A5A'];
const KD_THEMEN = [
  { titel: 'Wie kommst du zur Schule?', wer: 'Schülerinnen und Schüler', teile: [
    ['Bus', 'fahren mit dem Bus'], ['Fahrrad', 'fahren Fahrrad'], ['zu Fuß', 'gehen zu Fuß'], ['Auto', 'kommen mit dem Auto'], ['Bahn', 'fahren mit der Bahn']] },
  { titel: 'Was ist dein Lieblingssport?', wer: 'Jugendliche', teile: [
    ['Fußball', 'mögen Fußball am liebsten'], ['Schwimmen', 'mögen Schwimmen am liebsten'], ['Basketball', 'mögen Basketball am liebsten'], ['Tanzen', 'mögen Tanzen am liebsten'], ['Radfahren', 'mögen Radfahren am liebsten']] },
  { titel: 'Welches Haustier hast du?', wer: 'Kinder', teile: [
    ['Hund', 'haben einen Hund'], ['Katze', 'haben eine Katze'], ['Fische', 'haben Fische'], ['Hase', 'haben einen Hasen'], ['kein Tier', 'haben kein Tier']] },
  { titel: 'Was ist auf deinem Pausenbrot?', wer: 'Schülerinnen und Schüler', teile: [
    ['Käse', 'haben Käse auf dem Brot'], ['Wurst', 'haben Wurst auf dem Brot'], ['Marmelade', 'haben Marmelade auf dem Brot'], ['Gemüse', 'haben Gemüse auf dem Brot'], ['kein Brot', 'haben kein Brot dabei']] },
  { titel: 'Was spielst du am liebsten?', wer: 'Jugendliche', teile: [
    ['Brettspiele', 'spielen am liebsten Brettspiele'], ['Kartenspiele', 'spielen am liebsten Kartenspiele'], ['Videospiele', 'spielen am liebsten Videospiele'], ['Ballspiele', 'spielen am liebsten Ballspiele'], ['Rätsel', 'lösen am liebsten Rätsel']] }
];
const KD_GESAMT = [20, 40, 60, 80, 100, 200];
const KD_P1 = [50, 25, 10, 20], KD_P2 = [50, 25, 10, 20, 15, 30, 40, 5];
const kdGanz = (g, p) => (g * p) % 100 === 0;
function kdProzente(stufe, rng) {
  for (let v = 0; v < 500; v++) {
    if (stufe === 1) {
      const a = wahl(rng, KD_P1), b = wahl(rng, KD_P1.filter(x => x !== a)), rest = 100 - a - b;
      if ([25, 30, 40, 50, 60, 70].includes(rest)) return [a, b, rest];
      continue;
    }
    const n = rng() < 0.5 ? 3 : 4, l = [];
    for (let i = 0; i < n - 1; i++) l.push(wahl(rng, KD_P2));
    const rest = 100 - l.reduce((x, y) => x + y, 0);
    if (rest > 0 && KD_P2.includes(rest)) return [...l, rest].sort((x, y) => y - x);
  }
  return [50, 25, 25];
}
export function kreisdiagramm(stufe, rng) {
  const st = Math.min(3, Math.max(1, stufe || 1));
  const th = wahl(rng, KD_THEMEN);
  for (let v = 0; v < 200; v++) {
    const pz = kdProzente(st, rng);
    const gesamt = wahl(rng, KD_GESAMT.filter(g => pz.every(p => kdGanz(g, p))));
    if (!gesamt) continue;
    const teile = mischen(rng, th.teile.slice()).slice(0, pz.length);
    const seg = pz.map((p, i) => ({ name: teile[i][0], prozent: p, farbe: KD_FARBEN[i % 4], anzahl: gesamt * p / 100, verb: teile[i][1] }));
    const bild = { form: 'kreisdiagramm', titel: th.titel, gesamt, segmente: seg.map(x => ({ name: x.name, prozent: x.prozent, farbe: x.farbe })) };
    const fragen = [], weg = [];
    const anzahlFrage = (x, bonus) => { fragen.push({ frage: `Wie viele ${x.verb}?`, wert: x.anzahl, prozent: x.prozent, art: 'anzahl', ...(bonus ? { bonus: true } : {}) }); weg.push(`${x.prozent} % von ${gesamt} = ${gesamt} · ${x.prozent} : 100 = ${x.anzahl}`); };
    let geschichte = `${gesamt} ${th.wer} wurden gefragt.`, form = 'anzahl';
    if (st === 1) { seg.slice(0, 2).forEach(x => anzahlFrage(x)); }
    else if (st === 2) { seg.forEach((x, i) => anzahlFrage(x, i === seg.length - 1 && seg.length > 2)); }
    else if (rng() < 0.5) {
      // Anzahl → Prozent: ein Teil ohne Prozentzahl im Bild, seine Anzahl steht im Text
      form = 'prozent';
      const k = 1 + Math.floor(rng() * (seg.length - 1)), x = seg[k];
      bild.segmente[k] = { ...bild.segmente[k], prozent_versteckt: true };
      geschichte += ` ${x.anzahl} davon ${x.verb}.`;
      fragen.push({ frage: `Wie viel Prozent ${x.verb}?`, wert: x.prozent, einheit: '%', art: 'prozent' });
      weg.push(`${x.anzahl} von ${gesamt} → ${x.anzahl} : ${gesamt} · 100 = ${x.prozent} %`);
      anzahlFrage(seg[0]);
    } else {
      // Der Rest: der letzte Teil hat keine Prozentzahl
      form = 'rest';
      const k = seg.length - 1, x = seg[k];
      bild.segmente[k] = { ...bild.segmente[k], prozent_versteckt: true };
      fragen.push({ frage: `Wie viel Prozent ${x.verb}?`, wert: x.prozent, einheit: '%', art: 'prozent' });
      weg.push(`Der Rest: 100 % − ${seg.slice(0, k).map(y => y.prozent + ' %').join(' − ')} = ${x.prozent} %`);
      anzahlFrage(x);
    }
    return neu('kreisdiagramm', [st, form, gesamt, ...pz], {
      thema: 'kreisdiagramm', typ: 'mehrfrage', stufe: st, bild, geschichte,
      frage: 'Lies das Kreisdiagramm.', fragen, hinweise: ['diagramm', 'prozent'], loesungsweg: weg,
      erklaerung: st === 3 && form !== 'anzahl' ? 'Alle Teile zusammen sind 100 %.' : `Kontrolle: Alle Teile zusammen sind ${gesamt}.`
    });
  }
  return null;
}

// ---------- Dreierblock ----------

export function block(gen, rng, stufe = 1) {
  const teile = [];
  const ids = new Set();
  // Einmaleins ab Stufe 2: mal und geteilt gemischt (mindestens eine von beiden Arten)
  const arten = gen === 'einmaleins' && stufe >= 2 ? (rng() < 0.5 ? ['mal', 'geteilt', 'mal'] : ['geteilt', 'mal', 'geteilt']) : null;
  for (let v = 0; v < 80 && teile.length < 3; v++) {
    const t = arten ? GENERATOREN[gen](stufe, rng, { art: arten[teile.length] }) : GENERATOREN[gen](stufe, rng);
    if (t.typ !== 'zahl' || ids.has(t.id)) continue;
    // Runden: alle drei auf dieselbe Stellenzahl, damit die Frage für alle gilt
    if (gen === 'runden' && teile.length && t.parameter[1] !== teile[0].parameter[1]) continue;
    ids.add(t.id); teile.push(t);
  }
  return {
    id: `gen-block-${teile.map(t => t.id.replace('gen-', '')).join('+')}`,
    quelle: 'Baukasten', generator: `block-${gen}`, parameter: teile.map(t => t.parameter),
    thema: teile[0].thema, typ: 'mehrfrage', stufe, bonus: false,
    frage: gen === 'runden' ? (teile[0].parameter[1] === 0 ? 'Runde alle drei auf ganze Zahlen.' : teile[0].frage.replace('Runde auf', 'Runde alle drei auf')) : 'Rechne alle drei aus.',
    fragen: teile.map(t => gen === 'runden'
      ? { frage: t.rechnung.replace(/\s*≈\s*\?$/, ' ≈'), wert: t.antwort.wert, runden: t.parameter[1] }
      : { frage: `${t.rechnung} =`, wert: t.antwort.wert, einheit: t.antwort.einheit || '' }),
    hinweise: teile[0].hinweise, loesungsweg: teile.map(t => t.loesungsweg[t.loesungsweg.length - 1]),
    erklaerung: teile[0].erklaerung.split('.')[0] + '.'
  };
}

export const GENERATOREN = {
  'minus-plus': minusPlus, 'reihenfolge': reihenfolge, 'potenz': potenz, 'einmaleins': einmaleins, 'mal10': mal10,
  'prozent': prozent, 'baukasten': baukasten, 'runden': runden, 'bruch-bild': bruchBild, 'kugel': kugel, 'zylinder': zylinder,
  'geld-geschichte': geldGeschichte, 'rabatt-geschichte': rabattGeschichte, 'prozent-formel': prozentFormel, 'kegel': kegel, 'pyramide': pyramide, 'kreisdiagramm': kreisdiagramm,
  'zehnerpotenz': zehnerpotenz, 'einheiten': einheiten, 'gewichtskraft': gewichtskraft, 'gleichung': gleichung, 'formel-umstellen': formelUmstellen, 'dichte': dichte
};

// Welche Baukästen zu welchem Übungsthema gehören
export const THEMA_GENERATOREN = {
  'minus-zahlen': ['minus-plus', 'minus-plus', 'reihenfolge'], 'reihenfolge': ['reihenfolge'], 'potenzen': ['potenz'],
  'bruch-bild': ['bruch-bild'], 'zuordnung': ['bruch-bild'], 'prozent': ['prozent'], 'prozent-baukasten': ['baukasten'],
  'prozent-formel': ['prozent-formel'], 'rabatt': ['prozent', 'baukasten'], 'neuer-preis': ['prozent', 'baukasten'], 'kreisdiagramm': ['kreisdiagramm'],
  'runden': ['runden'], 'kugel': ['potenz', 'runden'], 'zylinder': ['zylinder'], 'kegel': ['kegel'], 'pyramide': ['pyramide'], 'einmaleins': ['einmaleins'], 'mal-10': ['mal10'],
  'zehnerpotenzen': ['zehnerpotenz'], 'einheiten': ['einheiten'], 'gewichtskraft': ['gewichtskraft'], 'umstellen': ['gleichung', 'formel-umstellen'], 'dichte': ['dichte']
};
export const MIX_GENERATOREN = ['einmaleins', 'potenz', 'mal10', 'prozent', 'runden', 'bruch-bild', 'minus-plus', 'reihenfolge', 'baukasten', 'einmaleins'];
export const BLOCK_GENERATOREN = ['einmaleins', 'potenz', 'mal10', 'minus-plus', 'einmaleins'];
export const KOPF_GENERATOREN = ['minus-plus', 'reihenfolge', 'potenz', 'einmaleins', 'mal10', 'prozent', 'baukasten', 'runden', 'bruch-bild'];
// Nur für Tests
export const __test = { gs, gsAus, rundenAuch };
