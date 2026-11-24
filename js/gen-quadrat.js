// Quadratische Funktionen (Baukasten „parabel“) und quadratische Gleichungen (Baukasten „qgleichung“), 24.11., Themenwahl.
// Stufe = Etappe: 1 ablesen und einfache Fälle, 2 umformen und Lösungsformel, 3 aufstellen, runden, Sachaufgaben.
// Jeder Schritt hat `teilschritt` (Liste themen.json). Typische Fehler stehen am Schritt: `typische` [{ wert, typ, text }]
// bei Zahlen, `fehlerWahl` [Index → { typ, text }] bei Auswahl (logic.js erkennt beides allgemein).
// Zwei Lösungen: immer zuerst „Wie viele Lösungen?“, dann x₁ (die kleinere) und x₂ (die größere).

const M = '−';
const zufall = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const wahl = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const mischen = (rng, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const glatt = (x) => Math.round(x * 1e9) / 1e9;
const r2 = (x) => Math.round(x * 100) / 100;

function neu(generator, parameter, felder) {
  // Typische Fehler, die zufällig das richtige Ergebnis sind, und doppelte weglassen
  for (const t of felder.schritte || []) if (Array.isArray(t.typische)) {
    const gesehen = new Set();
    t.typische = t.typische.filter(f => Number.isFinite(f.wert) && Math.abs(f.wert - t.wert) > 1e-9 && !gesehen.has(glatt(f.wert)) && gesehen.add(glatt(f.wert)));
    if (!t.typische.length) delete t.typische;
  }
  const id = `gen-${generator}-${parameter.map(p => String(p).replace('.', ',').replace('-', 'm')).join('_')}`;
  return { id, quelle: 'Baukasten', generator, parameter, bonus: false, ...felder };
}
// Zahl deutsch: −2,5
export const zt = (x) => String(glatt(x)).replace('.', ',').replace('-', M);
// „ + 3“ / „ − 3“ (nichts bei 0)
const plus = (n) => n === 0 ? '' : n > 0 ? ` + ${zt(n)}` : ` ${M} ${zt(-n)}`;
// Faktor vor x² bzw. x: 1 → „“, −1 → „−“
const fak = (a) => a === 1 ? '' : a === -1 ? M : zt(a);
// (x − d)² bzw. x² bei d = 0
const klammer = (d) => d === 0 ? 'x²' : `(x${plus(-d)})²`;
// y = a(x − d)² + e
export const scheitelForm = (a, d, e, f = 'y') => `${f} = ${fak(a)}${klammer(d)}${plus(e)}`;
// ax² + bx + c (ohne „y =“)
export function normalTerm(a, b, c, v = 'x') {
  let s = `${fak(a)}${v}²`;
  if (b) s += b === 1 ? ` + ${v}` : b === -1 ? ` ${M} ${v}` : `${plus(b)}${v}`;
  return s + plus(c);
}
const kz = (x) => x < 0 ? `(${zt(x)})` : zt(x);
const pkt = (x, y) => `(${zt(x)}|${zt(y)})`;

const ANZAHL = ['keine', 'eine', 'zwei'];
const anzahlSchritt = (n, ts, fehlerWahl) => ({ text: 'Wie viele Lösungen?', optionen: ANZAHL.slice(), richtig: n, zwei_versuche: true, teilschritt: ts, ...(fehlerWahl ? { fehlerWahl } : {}) });
const SCHEITEL_VZ = (d) => ({ typ: 'scheitel-vorzeichen', text: `In der Klammer steht x ${d > 0 ? M : '+'} ${zt(Math.abs(d))}. Der Scheitel liegt bei x = ${zt(d)}: Das Vorzeichen dreht sich.` });

// ==================== Quadratische Funktionen ====================
const basisF = { thema: 'quadr-funktionen', fach: 'mathe', hinweise: ['parabel'] };
const A_FORM = [-3, -2, -0.5, -0.25, 0.25, 0.5, 2, 3];

export function parabel(stufe, rng, opts = {}) {
  const st = Math.max(1, Math.min(3, stufe || 1));
  const formen = { 1: ['scheitel', 'scheitel', 'form', 'punkt'], 2: ['ausmult', 'ergaenzung', 'bild'], 3: ['aufstellen', 'aufstellen', 'sache'] }[st];
  const form = opts.form || wahl(rng, formen);
  for (let v = 0; v < 200; v++) {
    const a = parabelForm(form, st, rng);
    if (a) return a;
  }
  return null;
}

function parabelForm(form, st, rng) {
  if (form === 'scheitel') {
    // Stufe 1: nur oben/unten (d = 0) oder beides; Vorzeichen-Falle bei d
    const d = rng() < 0.35 ? 0 : zufall(rng, -6, 6), e = zufall(rng, -6, 6);
    if (d === 0 && e === 0) return null;
    const ts = d === 0 ? 'qfkt.verschieben@1' : 'qfkt.verschieben@2';
    const schritte = [
      { text: 'x-Wert vom Scheitel =', wert: d, teilschritt: ts, ...(d !== 0 ? { typische: [{ wert: -d, ...SCHEITEL_VZ(d) }] } : {}) },
      { text: 'y-Wert vom Scheitel =', wert: e, teilschritt: ts, typische: [{ wert: -e, typ: 'scheitel-y-vorzeichen', text: 'Die Zahl hinten ist der y-Wert. Ihr Vorzeichen bleibt.' }, ...(d !== 0 ? [{ wert: d, typ: 'scheitel-x-y-vertauscht', text: 'Erst x, dann y. Der x-Wert kommt aus der Klammer, der y-Wert ist die Zahl hinten.' }] : [])] }
    ];
    return neu('parabel', ['scheitel', d, e], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: ts,
      rechnung: scheitelForm(1, d, e), frage: 'Wo liegt der Scheitel S?', schritte,
      loesungsweg: [d === 0 ? 'Keine Klammer: Der Scheitel liegt auf der y-Achse, x = 0.' : `In der Klammer x ${d > 0 ? M : '+'} ${zt(Math.abs(d))} → x = ${zt(d)} (Vorzeichen dreht sich)`, `Die Zahl hinten: y = ${zt(e)}`, `S${pkt(d, e)}`],
      erklaerung: 'y = (x − d)² + e hat den Scheitel S(d|e). Die Zahl in der Klammer dreht ihr Vorzeichen, die Zahl hinten nicht.'
    });
  }
  if (form === 'form') {
    const a = wahl(rng, A_FORM);
    const unten = a < 0, schmal = Math.abs(a) > 1;
    const opt = ['nach oben, schmaler', 'nach oben, breiter', 'nach unten, schmaler', 'nach unten, breiter'];
    const richtig = (unten ? 2 : 0) + (schmal ? 0 : 1);
    const fehlerWahl = opt.map((o, i) => i === richtig ? null : ((i >= 2) !== unten)
      ? { typ: 'parabel-oeffnung', text: unten ? 'Minus vor dem x² → nach unten geöffnet.' : 'Kein Minus vor dem x² → nach oben geöffnet.' }
      : { typ: 'parabel-breite', text: 'Ohne Vorzeichen größer als 1 → schmaler. Zwischen 0 und 1 → breiter.' });
    return neu('parabel', ['form', a], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.strecken@1',
      rechnung: `y = ${fak(a)}x²`, frage: 'Wie sieht die Parabel aus, verglichen mit der Normalparabel y = x²?',
      schritte: [{ text: 'Die Parabel ist geöffnet …', optionen: opt, richtig, zwei_versuche: true, teilschritt: 'qfkt.strecken@1', fehlerWahl }],
      loesungsweg: [`Faktor ${zt(a)}: ${unten ? 'Minus → nach unten' : 'kein Minus → nach oben'}`, `Ohne Vorzeichen ${zt(Math.abs(a))} ${schmal ? '> 1 → schmaler' : '< 1 → breiter'}`],
      erklaerung: 'Vorzeichen: Plus → nach oben, Minus → nach unten. Größe: über 1 → schmaler, zwischen 0 und 1 → breiter.'
    });
  }
  if (form === 'punkt') {
    const d = rng() < 0.5 ? 0 : zufall(rng, -3, 3), e = zufall(rng, -5, 5);
    const x = rng() < 0.3 ? wahl(rng, [-1.5, -2.5, 1.5, 0.5]) : zufall(rng, -4, 4);
    if (x - d >= 0 && rng() < 0.6) return null; // meist ein negativer Wert in der Klammer
    const q = (x - d) ** 2, y = glatt(q + e);
    const typische = [];
    if (x - d < 0) typische.push({ wert: glatt(-q + e), typ: 'quadrat-minus', text: `(${zt(x - d)})² = (${zt(x - d)}) · (${zt(x - d)}) = ${zt(q)}. Minus mal Minus ist Plus.` });
    return neu('parabel', ['punkt', d, e, x], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.normal@1',
      rechnung: scheitelForm(1, d, e), frage: `Berechne y für x = ${zt(x)}.`,
      schritte: [...(d !== 0 ? [{ text: `x ${d > 0 ? M : '+'} ${zt(Math.abs(d))} =`, wert: glatt(x - d), teilschritt: 'qfkt.normal@1' }] : []),
        { text: d === 0 ? `(${zt(x)})² =` : `(${zt(x - d)})² =`, wert: glatt(q), teilschritt: 'qfkt.normal@1', typische: x - d < 0 ? [{ wert: -glatt(q), typ: 'quadrat-minus', text: 'Minus mal Minus ist Plus. Ein Quadrat ist nie negativ.' }] : [] },
        ...(e !== 0 ? [{ text: 'y =', wert: y, teilschritt: 'qfkt.normal@1', typische }] : [])],
      loesungsweg: [`y = (${zt(x)}${plus(-d)})²${plus(e)}`, `= ${zt(q)}${plus(e)}`, `y = ${zt(y)}`],
      erklaerung: 'Für x die Zahl einsetzen, mit Klammer. Erst die Klammer, dann hoch 2, dann die Zahl hinten.'
    });
  }
  if (form === 'ausmult') {
    const d = zufall(rng, -6, 6), e = zufall(rng, -9, 9);
    if (d === 0) return null;
    const b = -2 * d, c = d * d + e;
    return neu('parabel', ['ausmult', d, e], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.scheitelform@1',
      rechnung: scheitelForm(1, d, e), frage: 'Schreib die Gleichung in der Normalform y = x² + bx + c.',
      schritte: [
        { text: `${klammer(d)} = x² + □x + ${zt(d * d)}. Was steht im Kästchen? b =`, wert: b, teilschritt: 'qfkt.scheitelform@1',
          typische: [{ wert: -d, typ: 'binom-2ab', text: `Das Mittelglied ist 2 · x · ${zt(Math.abs(d))}, also ${zt(Math.abs(2 * d))}x, mit dem Vorzeichen aus der Klammer.` }, { wert: 2 * d, typ: 'binom-vorzeichen', text: `In der Klammer steht ${d > 0 ? M : '+'}. Das Mittelglied hat dasselbe Vorzeichen.` }] },
        { text: `c = ${zt(d * d)}${plus(e)} =`, wert: c, teilschritt: 'qfkt.scheitelform@1',
          typische: [{ wert: e, typ: 'binom-quadrat-vergessen', text: `${klammer(d)} hat hinten ${zt(d * d)}. Das kommt zu ${zt(e)} dazu.` }, { wert: d + e, typ: 'binom-quadrat-vergessen', text: `${zt(d)}² = ${zt(d * d)}, nicht ${zt(d)}.` }] }
      ],
      loesungsweg: [`${klammer(d)} = x²${plus(b)}x + ${zt(d * d)} (binomische Formel)`, `y = x²${plus(b)}x + ${zt(d * d)}${plus(e)}`, `y = ${normalTerm(1, b, c)}`],
      erklaerung: `(x − d)² = x² − 2dx + d². Danach die Zahl hinten dazurechnen.`
    });
  }
  if (form === 'ergaenzung') {
    const h = zufall(rng, -5, 5), c = zufall(rng, -9, 9);
    if (h === 0) return null;
    const b = 2 * h, e = c - h * h;
    return neu('parabel', ['ergaenzung', b, c], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.scheitelform@2',
      rechnung: `y = ${normalTerm(1, b, c)}`, frage: 'Bring die Gleichung mit der quadratischen Ergänzung in die Scheitelform. Wo liegt der Scheitel?',
      schritte: [
        { text: `Hälfte von ${zt(b)} =`, wert: h, teilschritt: 'qfkt.scheitelform@2' },
        { text: `(${zt(h)})² =`, wert: h * h, teilschritt: 'qfkt.scheitelform@2', typische: h < 0 ? [{ wert: -h * h, typ: 'quadrat-minus', text: 'Minus mal Minus ist Plus.' }] : [] },
        { text: `y = (x${plus(h)})² + □. Im Kästchen: ${zt(c)} ${M} ${zt(h * h)} =`, wert: e, teilschritt: 'qfkt.scheitelform@2',
          typische: [{ wert: c + h * h, typ: 'ergaenzung-plus', text: `Du hast ${zt(h * h)} dazugetan. Damit es gleich bleibt, ziehst du es wieder ab.` }, { wert: c, typ: 'ergaenzung-vergessen', text: `Die ${zt(h * h)} steckt jetzt in der Klammer. Zieh sie hinten ab.` }] },
        { text: 'x-Wert vom Scheitel =', wert: -h, teilschritt: 'qfkt.verschieben@2', typische: [{ wert: h, ...SCHEITEL_VZ(-h) }] },
        { text: 'y-Wert vom Scheitel =', wert: e, teilschritt: 'qfkt.verschieben@2' }
      ],
      loesungsweg: [`y = x²${plus(b)}x + ${zt(h * h)} ${M} ${zt(h * h)}${plus(c)}`, `y = (x${plus(h)})²${plus(e)}`, `S${pkt(-h, e)}`],
      erklaerung: 'Hälfte der Zahl vor x, davon das Quadrat dazutun und gleich wieder abziehen. Die ersten drei Teile sind dann (x + Hälfte)².'
    });
  }
  if (form === 'bild') {
    const d = zufall(rng, -4, 4), e = zufall(rng, -4, 4), a = wahl(rng, [1, 1, -1]);
    if (d === 0 || e === 0) return null;
    const kand = [[a, d, e], [a, -d, e], [a, d, -e], [-a, d, e]];
    const opt = kand.map(([x, y, z]) => scheitelForm(x, y, z));
    const reihen = mischen(rng, [0, 1, 2, 3]);
    const optionen = reihen.map(i => opt[i]), richtig = reihen.indexOf(0);
    const fw = { 1: SCHEITEL_VZ(d), 2: { typ: 'scheitel-y-vorzeichen', text: 'Lies den Scheitel im Bild ab. Die Zahl hinten ist sein y-Wert, mit Vorzeichen.' }, 3: { typ: 'parabel-oeffnung', text: a < 0 ? 'Die Parabel ist nach unten geöffnet → Minus vor der Klammer.' : 'Die Parabel ist nach oben geöffnet → kein Minus vor der Klammer.' } };
    return neu('parabel', ['bild', a, d, e], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.verschieben@2',
      frage: 'Welche Gleichung gehört zur Parabel im Bild?',
      bild: { form: 'parabel', a, d, e, scheitel: false },
      schritte: [{ text: 'Welche Gleichung passt?', optionen, richtig, zwei_versuche: true, spalte: true, teilschritt: 'qfkt.verschieben@2', fehlerWahl: reihen.map(i => fw[i] || null) }],
      loesungsweg: [`Scheitel im Bild: S${pkt(d, e)}`, a < 0 ? 'nach unten geöffnet → Minus vor der Klammer' : 'nach oben geöffnet', `x-Wert ${zt(d)} → in der Klammer x ${d > 0 ? M : '+'} ${zt(Math.abs(d))}`, scheitelForm(a, d, e)],
      erklaerung: 'Erst den Scheitel ablesen. Dann: In der Klammer dreht sich das Vorzeichen vom x-Wert, hinten steht der y-Wert.'
    });
  }
  if (form === 'aufstellen') {
    const a = wahl(rng, [-3, -2, -1, -0.5, 0.5, 2, 3]), d = zufall(rng, -4, 4), e = zufall(rng, -6, 6);
    const dx = wahl(rng, [-3, -2, -1, 1, 2, 3]) * (Math.abs(a) === 0.5 ? 2 : 1);
    const px = d + dx, k = dx * dx, py = glatt(a * k + e);
    if (Math.abs(py) > 40 || Math.abs(px) > 8) return null;
    return neu('parabel', ['aufstellen', d, e, px, py], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.aufstellen@1',
      frage: `Der Scheitel ist S${pkt(d, e)}. Die Parabel geht durch P${pkt(px, py)}. Bestimme a in y = a · ${klammer(d)}${plus(e)}.`,
      schritte: [
        { text: `Setz P ein: ${zt(py)} = a · (${zt(px)}${plus(-d)})²${plus(e)}. Die Klammer: (${zt(px)}${plus(-d)})² =`, wert: k, teilschritt: 'qfkt.aufstellen@1' },
        { text: `${zt(py)}${plus(-e)} =`, wert: glatt(py - e), teilschritt: 'qfkt.aufstellen@1', typische: e !== 0 ? [{ wert: glatt(py + e), typ: 'aufstellen-e', text: `Die ${zt(e)} muss auf die andere Seite: ${e > 0 ? 'abziehen' : 'dazuzählen'}.` }] : [] },
        { text: `a = ${zt(py - e)} : ${zt(k)} =`, wert: a, teilschritt: 'qfkt.aufstellen@1', typische: [{ wert: glatt(k / (py - e)), typ: 'a-kehrwert', text: 'a steht vor der Klammer. Also: Zahl links geteilt durch die Klammer.' }] }
      ],
      loesungsweg: [`${zt(py)} = a · ${zt(k)}${plus(e)}`, `${zt(py - e)} = a · ${zt(k)}`, `a = ${zt(a)}`, scheitelForm(a, d, e)],
      erklaerung: 'Den Punkt für x und y einsetzen. Dann so umstellen, dass a allein steht.'
    });
  }
  if (form === 'sache') {
    if (rng() < 0.5) {
      // Wurf: h(t) = −5(t − d)² + e
      const d = wahl(rng, [0.8, 1, 1.2, 1.5, 2]), e = glatt(5 * d * d + wahl(rng, [0, 1, 1.5, 2]));
      return neu('parabel', ['wurf', d, e], {
        ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.sache@1', kategorie: 'text',
        geschichte: `Ein Ball wird geworfen. Seine Höhe in Metern ist h(t) = ${M}5(t ${M} ${zt(d)})² + ${zt(e)}. t ist die Zeit in Sekunden.`,
        frage: 'Wie hoch fliegt der Ball höchstens? Nach wie vielen Sekunden?',
        schritte: [
          { text: 'Höchster Punkt: h =', wert: e, einheit: 'm', teilschritt: 'qfkt.sache@1', typische: [{ wert: d, typ: 'scheitel-x-y-vertauscht', text: 'Der höchste Punkt ist der Scheitel. Die Höhe ist sein y-Wert: die Zahl hinten.' }] },
          { text: 'nach t =', wert: d, einheit: 's', teilschritt: 'qfkt.sache@1', typische: [{ wert: -d, ...SCHEITEL_VZ(d) }, { wert: e, typ: 'scheitel-x-y-vertauscht', text: 'Die Zeit ist der x-Wert vom Scheitel: aus der Klammer.' }] }
        ],
        loesungsweg: [`Scheitel S${pkt(d, e)}`, `Höchster Punkt ${zt(e)} m nach ${zt(d)} s`],
        erklaerung: 'Minus vor der Klammer: Die Parabel ist nach unten geöffnet. Der Scheitel ist der höchste Punkt.'
      });
    }
    // Zaun: Rechteck mit Umfang U, größte Fläche bei einem Quadrat
    const U = wahl(rng, [16, 20, 24, 28, 32, 36, 40, 48]), x = U / 4;
    return neu('parabel', ['zaun', U], {
      ...basisF, typ: 'schritte', stufe: st, form, teilschritt: 'qfkt.sache@1', kategorie: 'text',
      geschichte: `Mit ${U} m Zaun soll eine rechteckige Fläche eingezäunt werden. Eine Seite ist x Meter lang. Die Fläche ist A(x) = x · (${U / 2} ${M} x) = ${M}x² + ${U / 2}x.`,
      frage: 'Bei welcher Länge x ist die Fläche am größten? Wie groß ist sie?',
      schritte: [
        { text: `Quadratische Ergänzung: A(x) = ${M}(x ${M} □)² + …. Im Kästchen steht die Hälfte von ${U / 2}:`, wert: x, teilschritt: 'qfkt.scheitelform@3' },
        { text: 'größte Fläche bei x =', wert: x, einheit: 'm', teilschritt: 'qfkt.sache@1', typische: [{ wert: U / 2, typ: 'scheitel-nullstelle', text: `Bei x = ${U / 2} ist die Fläche 0. Gesucht ist die Mitte zwischen 0 und ${U / 2}: der Scheitel.` }] },
        { text: 'größte Fläche A =', wert: x * x, einheit: 'm²', teilschritt: 'qfkt.sache@1' }
      ],
      loesungsweg: [`A(x) = ${M}x² + ${U / 2}x = ${M}(x ${M} ${x})² + ${x * x}`, `Scheitel S(${x}|${x * x})`, `x = ${x} m, A = ${x} · ${x} = ${x * x} m²`],
      erklaerung: 'Die Fläche ist eine nach unten geöffnete Parabel. Am Scheitel ist sie am größten. Das Rechteck ist dann ein Quadrat.'
    });
  }
  return null;
}

// ==================== Quadratische Gleichungen ====================
const basisG = { thema: 'quadr-gleichungen', fach: 'mathe', hinweise: ['qgl'] };
const lsgSchritte = (l1, l2, ts, typ1 = [], typ2 = []) => l1 === l2
  ? [{ text: 'x =', wert: l1, teilschritt: ts, typische: typ1 }]
  : [{ text: 'x₁ (die kleinere) =', wert: l1, teilschritt: ts, typische: typ1 }, { text: 'x₂ (die größere) =', wert: l2, teilschritt: ts, typische: typ2 }];
const NUR_POS = (k) => ({ typ: 'nur-positive', text: `Auch die Zahl mit Minus passt: (${M}${k}) · (${M}${k}) = ${k * k}. Also zwei Lösungen.` });
const NEGATIV = { typ: 'quadrat-negativ', text: 'Ein Quadrat ist nie negativ. Dann gibt es keine Lösung.' };

export function qgleichung(stufe, rng, opts = {}) {
  const st = Math.max(1, Math.min(3, stufe || 1));
  const formen = { 1: ['rein', 'rein', 'ausklammern', 'nullprodukt'], 2: ['pq', 'pq', 'pq', 'normalform'], 3: ['pqrund', 'pqrund', 'sache', 'vieta'] }[st];
  const form = opts.form || wahl(rng, formen);
  for (let v = 0; v < 300; v++) {
    const a = qglForm(form, st, rng);
    if (a) return a;
  }
  return null;
}

function qglForm(form, st, rng) {
  if (form === 'rein') {
    const k = zufall(rng, 2, 12), art = wahl(rng, ['xx', 'xx', 'minus', 'faktor', 'keine']);
    let rechnung, weg;
    if (art === 'keine') {
      const c = zufall(rng, 1, 30);
      rechnung = `x² = ${M}${c}`;
      return neu('qgleichung', ['rein', 'keine', c], {
        ...basisG, typ: 'schritte', stufe: st, form, teilschritt: 'qgl.rein@2', rechnung, frage: 'Löse die Gleichung.',
        schritte: [anzahlSchritt(0, 'qgl.rein@2', [null, NEGATIV, NEGATIV])],
        loesungsweg: [`x² = ${M}${c}`, 'Ein Quadrat ist nie negativ.', 'keine Lösung'],
        erklaerung: 'Jede Zahl mal sich selbst ergibt 0 oder mehr. x² kann nie negativ sein.'
      });
    }
    if (art === 'xx') { rechnung = `x² = ${k * k}`; weg = [rechnung]; }
    else if (art === 'minus') { rechnung = `x² ${M} ${k * k} = 0`; weg = [rechnung + `   | + ${k * k}`, `x² = ${k * k}`]; }
    else { const f = zufall(rng, 2, 5); rechnung = `${f}x² = ${f * k * k}`; weg = [rechnung + `   | : ${f}`, `x² = ${k * k}`]; }
    return neu('qgleichung', ['rein', art, k, ...(art === 'faktor' ? [Number(rechnung.split('x')[0])] : [])], {
      ...basisG, typ: 'schritte', stufe: st, form, teilschritt: 'qgl.rein@1', rechnung, frage: 'Löse die Gleichung.',
      schritte: [anzahlSchritt(2, 'qgl.rein@1', [NUR_POS(k), NUR_POS(k), null]), ...lsgSchritte(-k, k, 'qgl.rein@1', [{ wert: k, ...NUR_POS(k) }])],
      loesungsweg: [...weg, `x = ${M}${k} oder x = ${k}`],
      erklaerung: `${k} · ${k} = ${k * k} und (${M}${k}) · (${M}${k}) = ${k * k}. Darum gibt es zwei Lösungen.`
    });
  }
  if (form === 'ausklammern') {
    const b = zufall(rng, 2, 12) * (rng() < 0.4 ? -1 : 1), f = rng() < 0.3 ? zufall(rng, 2, 4) : 1;
    const rechnung = `${normalTerm(f, -f * b, 0)} = 0`;
    const [l1, l2] = [0, b].sort((x, y) => x - y);
    const verlorenTyp = { typ: 'null-verloren', text: `Nicht durch x teilen, sonst geht eine Lösung verloren. x · (${f === 1 ? '' : f}x${plus(-f * b)}) = 0 → x = 0 oder ${f === 1 ? '' : f}x${plus(-f * b)} = 0.` };
    return neu('qgleichung', ['ausklammern', f, b], {
      ...basisG, typ: 'schritte', stufe: st, form, teilschritt: 'qgl.ausklammern@1', rechnung, frage: 'Löse die Gleichung. Klammere x aus.',
      schritte: [anzahlSchritt(2, 'qgl.ausklammern@1', [verlorenTyp, verlorenTyp, null]),
        ...lsgSchritte(l1, l2, 'qgl.ausklammern@1', l1 === 0 ? [{ wert: b, ...verlorenTyp }, { wert: -b, typ: 'nullprodukt-vorzeichen', text: `x${plus(-b)} = 0 → x = ${zt(b)}.` }] : [{ wert: -b, typ: 'nullprodukt-vorzeichen', text: `x${plus(-b)} = 0 → x = ${zt(b)}.` }],
          l2 === 0 ? [{ wert: b, ...verlorenTyp }] : [{ wert: -b, typ: 'nullprodukt-vorzeichen', text: `x${plus(-b)} = 0 → x = ${zt(b)}.` }])],
      loesungsweg: [`x · (${f === 1 ? '' : f}x${plus(-f * b)}) = 0`, `x = 0 oder ${f === 1 ? '' : f}x${plus(-f * b)} = 0`, `x = 0 oder x = ${zt(b)}`],
      erklaerung: 'Ein Produkt ist 0, wenn einer der Faktoren 0 ist. Darum: x = 0 ist immer eine Lösung.'
    });
  }
  if (form === 'nullprodukt') {
    const m = zufall(rng, -9, 9), n = zufall(rng, -9, 9);
    if (m === n || m === 0 || n === 0) return null;
    const rechnung = `(x${plus(-m)})(x${plus(-n)}) = 0`;
    const [l1, l2] = [m, n].sort((x, y) => x - y);
    const vz = (z) => ({ typ: 'nullprodukt-vorzeichen', text: `x${plus(-z)} = 0 → x = ${zt(z)}. Das Vorzeichen dreht sich.` });
    return neu('qgleichung', ['nullprodukt', m, n], {
      ...basisG, typ: 'schritte', stufe: st, form, teilschritt: 'qgl.ausklammern@2', rechnung, frage: 'Löse die Gleichung.',
      schritte: [anzahlSchritt(2, 'qgl.ausklammern@2'), ...lsgSchritte(l1, l2, 'qgl.ausklammern@2', [{ wert: -l1, ...vz(l1) }], [{ wert: -l2, ...vz(l2) }])],
      loesungsweg: [`x${plus(-m)} = 0 oder x${plus(-n)} = 0`, `x = ${zt(m)} oder x = ${zt(n)}`],
      erklaerung: 'Ein Produkt ist 0, wenn eine Klammer 0 ist. Jede Klammer einzeln auf 0 setzen.'
    });
  }
  if (form === 'pq' || form === 'normalform' || form === 'pqrund') {
    let p, q, l1, l2, n, f = 1;
    if (form === 'pqrund') {
      p = zufall(rng, -8, 8); q = zufall(rng, -12, 8);
      const D = (p / 2) ** 2 - q;
      if (D <= 0 || Number.isInteger(Math.sqrt(D)) || Number.isInteger(Math.sqrt(D * 4))) return null;
      l1 = -p / 2 - Math.sqrt(D); l2 = -p / 2 + Math.sqrt(D); n = 2;
      // auf 2 Stellen eindeutig (nicht genau auf …5)
      if ([l1, l2].some(x => Math.abs(Math.abs(x * 100) % 1 - 0.5) < 0.02)) return null;
    } else {
      const art = rng() < 0.15 ? 0 : rng() < 0.12 ? 1 : 2;
      if (art === 2) { const a = zufall(rng, -9, 9), b = zufall(rng, -9, 9); if (a === b) return null; [l1, l2] = [a, b].sort((x, y) => x - y); p = -(a + b); q = a * b; }
      else if (art === 1) { l1 = l2 = zufall(rng, -6, 6); if (l1 === 0) return null; p = -2 * l1; q = l1 * l1; }
      else { p = zufall(rng, -6, 6); q = glatt((p / 2) ** 2 + zufall(rng, 1, 9)); if (!Number.isInteger(q)) return null; }
      n = art;
      if (p === 0 || q === 0) return null;
      if (form === 'normalform') f = wahl(rng, [2, 3, -1, -2]);
      if (Math.abs(p) > 14 || Math.abs(q) > 40) return null;
    }
    const D = glatt((p / 2) ** 2 - q);
    const ts = form === 'pqrund' ? 'qgl.pq@2' : 'qgl.pq@1';
    const rechnung = `${normalTerm(f, f * p, f * q)} = 0`;
    const schritte = [];
    if (f !== 1) schritte.push({ text: `Normalform: Teile alles durch ${zt(f)}. Die Zahl vor x: p =`, wert: p, teilschritt: 'qgl.normalform@1', typische: [{ wert: f * p, typ: 'normalform-nicht-geteilt', text: `Erst durch ${zt(f)} teilen. Dann steht vor x² nur noch 1.` }, { wert: -p, typ: 'pq-vorzeichen-p', text: 'p ist die Zahl vor x, mit ihrem Vorzeichen.' }] },
      { text: 'Die Zahl ohne x: q =', wert: q, teilschritt: 'qgl.normalform@1', typische: [{ wert: f * q, typ: 'normalform-nur-teil', text: `Jede Zahl durch ${zt(f)} teilen, auch die Zahl ohne x.` }, { wert: -q, typ: 'pq-vorzeichen-q', text: 'q ist die Zahl ohne x, mit ihrem Vorzeichen.' }] });
    else schritte.push({ text: 'p =', wert: p, teilschritt: ts, typische: [{ wert: -p, typ: 'pq-vorzeichen-p', text: 'p ist die Zahl vor x, mit ihrem Vorzeichen.' }] },
      { text: 'q =', wert: q, teilschritt: ts, typische: [{ wert: -q, typ: 'pq-vorzeichen-q', text: 'q ist die Zahl ohne x, mit ihrem Vorzeichen.' }] });
    const typD = [{ wert: glatt((p / 2) ** 2 + q), typ: 'pq-q-vorzeichen', text: `Unter der Wurzel steht (p/2)² − q. ${q < 0 ? `Minus (${zt(q)}) wird plus.` : `Also ${M} ${zt(q)}.`}` },
      { wert: glatt(p * p - q), typ: 'pq-halbe-vergessen', text: `Erst p halbieren: ${zt(p)} : 2 = ${zt(p / 2)}. Dann hoch 2.` }];
    schritte.push({ text: `(p/2)² ${M} q = (${zt(p / 2)})² ${M} ${q < 0 ? `(${zt(q)})` : zt(q)} =`, wert: D, teilschritt: ts, typische: typD });
    schritte.push(anzahlSchritt(n, 'qgl.diskriminante@1', n === 0 ? [null, { typ: 'diskriminante', text: 'Unter der Wurzel ist die Zahl negativ. Aus einer negativen Zahl gibt es keine Wurzel: keine Lösung.' }, { typ: 'diskriminante', text: 'Unter der Wurzel ist die Zahl negativ. Aus einer negativen Zahl gibt es keine Wurzel: keine Lösung.' }]
      : n === 1 ? [{ typ: 'diskriminante', text: 'Unter der Wurzel steht 0. Das gibt genau eine Lösung.' }, null, { typ: 'diskriminante', text: 'Unter der Wurzel steht 0. ± 0 ist dasselbe: genau eine Lösung.' }]
      : [{ typ: 'diskriminante', text: 'Unter der Wurzel ist die Zahl positiv: zwei Lösungen (± Wurzel).' }, { typ: 'diskriminante', text: 'Unter der Wurzel ist die Zahl positiv: zwei Lösungen (± Wurzel).' }, null]));
    if (n > 0) {
      const w = Math.sqrt(D), vzP = (x) => [{ wert: form === 'pqrund' ? r2(-x) : glatt(-x), typ: 'pq-vorzeichen-p', text: `Vorne steht −p/2 = ${zt(-p / 2)}. Das Vorzeichen von p dreht sich.` }];
      if (form === 'pqrund') {
        schritte.push({ text: 'x₁ (die kleinere) ≈', wert: r2(l1), rundenAuf: 2, teilschritt: ts, typische: [{ wert: r2(p / 2 - w), typ: 'pq-vorzeichen-p', text: `Vorne steht −p/2 = ${zt(-p / 2)}.` }] },
          { text: 'x₂ (die größere) ≈', wert: r2(l2), rundenAuf: 2, teilschritt: ts, typische: [{ wert: r2(p / 2 + w), typ: 'pq-vorzeichen-p', text: `Vorne steht −p/2 = ${zt(-p / 2)}.` }] });
      } else schritte.push(...lsgSchritte(l1, l2, ts, vzP(l2), vzP(l1)));
    }
    const weg = [...(f !== 1 ? [`${rechnung}   | : ${zt(f)}`] : []), `${normalTerm(1, p, q)} = 0 → p = ${zt(p)}, q = ${zt(q)}`, `x = ${zt(-p / 2)} ± √(${zt(D)})`];
    if (n === 0) weg.push('Unter der Wurzel negativ → keine Lösung');
    else if (n === 1) weg.push(`x = ${zt(l1)}`);
    else weg.push(form === 'pqrund' ? `x₁ ≈ ${zt(r2(l1))}, x₂ ≈ ${zt(r2(l2))}` : `x₁ = ${zt(l1)}, x₂ = ${zt(l2)}`);
    return neu('qgleichung', [form, f, p, q], {
      ...basisG, typ: 'schritte', stufe: st, form, teilschritt: f !== 1 ? 'qgl.normalform@1' : ts, rechnung,
      frage: form === 'pqrund' ? 'Löse mit der pq-Formel. Runde auf 2 Stellen nach dem Komma.' : f !== 1 ? 'Bring die Gleichung auf Normalform. Löse dann mit der pq-Formel.' : 'Löse mit der pq-Formel.',
      schritte, loesungsweg: weg,
      erklaerung: 'x² + px + q = 0 → x = −p/2 ± √((p/2)² − q). Der Wert unter der Wurzel sagt, wie viele Lösungen es gibt.'
    });
  }
  if (form === 'vieta') {
    const a = zufall(rng, -8, 8), b = zufall(rng, -8, 8);
    if (a === b || a === 0 || b === 0 || a === -b) return null;
    const p = -(a + b), q = a * b;
    const [l1, l2] = [a, b].sort((x, y) => x - y);
    const kand = [[l1, l2], [-l2, -l1]];
    // ein Paar mit gleichem Produkt, aber anderer Summe
    for (const t of [1, 2, 3, 4, 6, 8, 9, 12]) if (q % t === 0) { const u = q / t; if (t !== l1 && t !== l2 && t + u !== -p && !kand.some(k => k[0] === Math.min(t, u) && k[1] === Math.max(t, u))) { kand.push([Math.min(t, u), Math.max(t, u)]); break; } }
    if (kand.length < 3) return null;
    const pTxt = (k) => `${zt(k[0])} und ${zt(k[1])}`;
    const reihen = mischen(rng, kand.map((_, i) => i));
    const fw = { 1: { typ: 'vieta-vorzeichen', text: `Die Summe der Lösungen ist −p = ${zt(-p)}, nicht p.` }, 2: { typ: 'vieta-summe', text: `Das Produkt passt. Die Summe muss aber −p = ${zt(-p)} sein.` } };
    return neu('qgleichung', ['vieta', a, b], {
      ...basisG, typ: 'schritte', stufe: st, form, teilschritt: 'qgl.vieta@1', rechnung: `${normalTerm(1, p, q)} = 0`,
      frage: 'Finde die Lösungen mit dem Satz von Vieta: x₁ + x₂ = −p und x₁ · x₂ = q.',
      schritte: [
        { text: 'x₁ + x₂ = −p =', wert: -p, teilschritt: 'qgl.vieta@1', typische: [{ wert: p, typ: 'vieta-vorzeichen', text: 'Die Summe ist −p: Das Vorzeichen dreht sich.' }] },
        { text: 'x₁ · x₂ = q =', wert: q, teilschritt: 'qgl.vieta@1' },
        { text: 'Welche Zahlen sind die Lösungen?', optionen: reihen.map(i => pTxt(kand[i])), richtig: reihen.indexOf(0), zwei_versuche: true, teilschritt: 'qgl.vieta@1', fehlerWahl: reihen.map(i => fw[i] || null) }
      ],
      loesungsweg: [`Summe ${zt(-p)}, Produkt ${zt(q)}`, `${kz(l1)} + ${kz(l2)} = ${zt(-p)} und ${kz(l1)} · ${kz(l2)} = ${zt(q)}`, `x₁ = ${zt(l1)}, x₂ = ${zt(l2)}`],
      erklaerung: 'Zwei Zahlen suchen: zusammen −p, malgenommen q. Erst die Paare fürs Produkt, dann die Summe prüfen.'
    });
  }
  if (form === 'sache') {
    // Rechteck: Fläche A, Umfang U → x² − (U/2)x + A = 0
    const a = zufall(rng, 2, 12), b = zufall(rng, 2, 15);
    if (a === b) return null;
    const s = a + b, A = a * b, U = 2 * s;
    const opt = [`x² ${M} ${s}x + ${A} = 0`, `x² + ${s}x + ${A} = 0`, `x² ${M} ${U}x + ${A} = 0`];
    const reihen = mischen(rng, [0, 1, 2]);
    const fw = { 1: { typ: 'sache-gleichung', text: `Die andere Seite ist ${s} ${M} x. Dann x · (${s} ${M} x) = ${A}.` }, 2: { typ: 'sache-gleichung', text: `Länge + Breite ist der halbe Umfang: ${U} : 2 = ${s}.` } };
    const [k, l] = [a, b].sort((x, y) => x - y);
    return neu('qgleichung', ['sache', a, b], {
      ...basisG, typ: 'schritte', stufe: st, form, teilschritt: 'qgl.sache@1', kategorie: 'text',
      geschichte: `Ein rechteckiges Beet hat ${A} m² Fläche und ${U} m Umfang. Eine Seite ist x Meter lang.`,
      frage: 'Wie lang sind die Seiten?',
      schritte: [
        { text: 'Länge + Breite (halber Umfang) =', wert: s, einheit: 'm', teilschritt: 'qgl.sache@1', typische: [{ wert: U, typ: 'sache-gleichung', text: 'Der Umfang hat jede Seite zweimal. Länge + Breite ist die Hälfte.' }] },
        { text: 'Welche Gleichung passt?', optionen: reihen.map(i => opt[i]), richtig: reihen.indexOf(0), zwei_versuche: true, spalte: true, teilschritt: 'qgl.sache@1', fehlerWahl: reihen.map(i => fw[i] || null) },
        { text: 'kürzere Seite =', wert: k, einheit: 'm', teilschritt: 'qgl.pq@1' },
        { text: 'längere Seite =', wert: l, einheit: 'm', teilschritt: 'qgl.pq@1' }
      ],
      loesungsweg: [`x · (${s} ${M} x) = ${A}`, `x² ${M} ${s}x + ${A} = 0`, `x = ${zt(s / 2)} ± √(${zt((s / 2) ** 2 - A)})`, `Seiten ${k} m und ${l} m`],
      erklaerung: 'Die andere Seite ist halber Umfang minus x. Fläche = x mal andere Seite. Beide Lösungen sind die zwei Seiten.'
    });
  }
  return null;
}
