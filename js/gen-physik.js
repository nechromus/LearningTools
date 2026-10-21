// Baukästen für Physik und Umstellen (Auftrag 13, 13-format-physik-und-knobeln.md Abschnitt 7).
// Neutrale Zahlen, Geschichten kommen aus dem Pool. Jede Aufgabe hat generator und parameter, die id entsteht aus den Zahlen.
import { potenzText, hoch, aufZiffern, pruefeFormel } from './physik.js';

const M = '−';
const zufall = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const wahl = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const glatt = (x) => Math.round(x * 1e9) / 1e9;

function neu(generator, parameter, felder) {
  const id = `gen-${generator}-${parameter.map(p => String(p).replace('.', ',').replace('-', 'm')).join('_')}`;
  return { id, quelle: 'Baukasten', generator, parameter, bonus: false, ...felder };
}

// Zahl deutsch mit Leerzeichen ab 1000: 149 600 000 und 0,0000075
export function zahlDe(x) {
  const neg = x < 0;
  let s = String(glatt(Math.abs(x)));
  if (/e/.test(s)) s = Math.abs(x).toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  let [g, k] = s.split('.');
  if (g.length >= 4) g = g.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return (neg ? M : '') + g + (k ? ',' + k : '');
}
const zahlKurz = (x) => String(glatt(x)).replace('.', ',').replace('-', M);
// Wert exakt aus Ziffernfolge und Hochzahl (vermeidet Rundungsreste)
const ausZiffern = (ziffern, e) => Number(`${ziffern[0]}.${ziffern.slice(1) || '0'}e${e}`);
const mantisseVon = (ziffern) => Number(`${ziffern[0]}.${ziffern.slice(1) || '0'}`);

// ---------- Zehnerpotenzen ----------
// Stufe 1 schreiben, Stufe 2 rechnen, Stufe 3 gültige Ziffern und Vergleiche
const basis = { fach: 'physik', thema: 'zehnerpotenzen', hinweise: ['zehnerpotenz'] };

export function zehnerpotenz(stufe, rng) {
  if (stufe === 1) {
    const n = zufall(rng, 2, 4);
    let ziffern = String(zufall(rng, 1, 9));
    for (let i = 1; i < n; i++) ziffern += zufall(rng, 0, 9);
    ziffern = ziffern.replace(/0+$/, '') || ziffern[0];
    const klein = rng() < 0.45;
    const e = klein ? -zufall(rng, 2, 8) : zufall(rng, 3, 9);
    const wert = ausZiffern(ziffern, e), m = mantisseVon(ziffern);
    if (rng() < 0.3 && Math.abs(e) <= 5) {
      // Rückweg: aus der Zehnerpotenz eine normale Zahl machen
      return neu('zehnerpotenz', [1, 'z', ziffern, e], {
        ...basis, typ: 'zahl', stufe, rechnung: potenzText(m, e), frage: 'Schreibe als normale Zahl.',
        antwort: { wert },
        loesungsweg: [`Komma um ${Math.abs(e)} Stellen nach ${e > 0 ? 'rechts' : 'links'}`, `${potenzText(m, e)} = ${zahlDe(wert)}`],
        erklaerung: e > 0 ? 'Positive Hochzahl: Die Zahl wird größer, das Komma wandert nach rechts.' : 'Negative Hochzahl: Die Zahl wird kleiner, das Komma wandert nach links.'
      });
    }
    return neu('zehnerpotenz', [1, 'w', ziffern, e], {
      ...basis, typ: 'zehnerpotenz', stufe, rechnung: zahlDe(wert), frage: 'Schreibe in wissenschaftlicher Schreibweise.',
      antwort: { mantisse: m, exponent: e },
      loesungsweg: [`Komma um ${Math.abs(e)} Stellen nach ${e > 0 ? 'links' : 'rechts'} → ${zahlKurz(m)}`, `${zahlDe(wert)} = ${potenzText(m, e)}`],
      erklaerung: 'Vor dem Komma steht genau eine Ziffer, die nicht 0 ist. Die Hochzahl sagt, um wie viele Stellen das Komma gewandert ist.'
    });
  }
  if (stufe === 2) {
    const art = wahl(rng, ['mal', 'durch', 'produkt', 'produkt']);
    const hz = () => (rng() < 0.35 ? -1 : 1) * zufall(rng, 2, 9);
    if (art === 'mal' || art === 'durch') {
      const a = hz(), b = hz();
      const n = art === 'mal' ? a + b : a - b;
      const zeichen = art === 'mal' ? '·' : ':';
      return neu('zehnerpotenz', [2, art, a, b], {
        ...basis, typ: 'zahl', stufe, rechnung: `10${hoch(a)} ${zeichen} 10${hoch(b)} = 10ⁿ`, frage: 'Bestimme die Hochzahl n.',
        antwort: { wert: n },
        loesungsweg: [art === 'mal' ? 'Hochzahlen addieren' : 'Hochzahlen subtrahieren', `${zahlKurz(a)} ${art === 'mal' ? '+' : M} ${b < 0 ? `(${zahlKurz(b)})` : b} = ${zahlKurz(n)}`],
        erklaerung: art === 'mal' ? 'Beim Malnehmen werden die Hochzahlen addiert: 10ᵐ · 10ⁿ = 10ᵐ⁺ⁿ.' : 'Beim Teilen werden die Hochzahlen subtrahiert: 10ᵐ : 10ⁿ = 10ᵐ⁻ⁿ.'
      });
    }
    // (a · 10ᵐ) · (b · 10ⁿ), Zahlen 2 bis 9; ist a · b ≥ 10, muss noch umgeformt werden
    const a = zufall(rng, 2, 9), b = zufall(rng, 2, 9), m = hz(), n = hz();
    const p = a * b;
    const groß = p >= 10;
    const mant = groß ? p / 10 : p, e = m + n + (groß ? 1 : 0);
    const weg = [`${a} · ${b} = ${p}`, `10${hoch(m)} · 10${hoch(n)} = 10${hoch(m + n)}`];
    if (groß) weg.push(`${p} · 10${hoch(m + n)} = ${potenzText(mant, e)}`);
    else weg.push(`= ${potenzText(mant, e)}`);
    return neu('zehnerpotenz', [2, 'p', a, m, b, n], {
      ...basis, typ: 'zehnerpotenz', stufe, rechnung: `(${a} · 10${hoch(m)}) · (${b} · 10${hoch(n)})`,
      frage: 'Berechne und gib das Ergebnis in wissenschaftlicher Schreibweise an.',
      antwort: { mantisse: mant, exponent: e }, loesungsweg: weg,
      erklaerung: 'Zahlen und Zehnerpotenzen getrennt malnehmen.' + (groß ? ` ${p} ist größer als 10, darum wird daraus ${zahlKurz(mant)} · 10¹.` : '')
    });
  }
  // Stufe 3
  if (rng() < 0.6) {
    // gültige Ziffern: lange Zahl auf 2 oder 3 gültige Ziffern
    const n = wahl(rng, [2, 3, 3]);
    let ziffern = String(zufall(rng, 1, 9));
    for (let i = 1; i < 6; i++) ziffern += zufall(rng, 0, 9);
    const e = rng() < 0.3 ? -zufall(rng, 2, 6) : zufall(rng, 4, 9);
    const wert = ausZiffern(ziffern, e);
    const mant = aufZiffern(mantisseVon(ziffern), n);
    // Rundet die Zahl auf 10,0 auf, rückt die Hochzahl eins weiter
    const ue = mant >= 10;
    const m2 = ue ? mant / 10 : mant, e2 = ue ? e + 1 : e;
    return neu('zehnerpotenz', [3, 'g', ziffern, e, n], {
      ...basis, typ: 'zehnerpotenz', stufe, rechnung: zahlDe(wert),
      frage: `Schreibe in wissenschaftlicher Schreibweise mit ${n} gültigen Ziffern.`,
      antwort: { mantisse: m2, exponent: e2, gueltige_ziffern: n },
      loesungsweg: [`${zahlDe(wert)} = ${zahlKurz(mantisseVon(ziffern))} · 10${hoch(e)}`, `auf ${n} gültige Ziffern: ${potenzText(m2, e2, n)}`],
      erklaerung: `Gültige Ziffern zählen ab der ersten Ziffer, die nicht 0 ist. Bei ${n} gültigen Ziffern bleiben ${n} Ziffern stehen, die letzte wird gerundet.`
    });
  }
  // Vergleich: Welche Zahl ist größer?
  for (let v = 0; v < 50; v++) {
    const m1 = zufall(rng, 11, 99) / 10, m2 = zufall(rng, 11, 99) / 10;
    const e1 = (rng() < 0.3 ? -1 : 1) * zufall(rng, 2, 8);
    const e2 = rng() < 0.5 ? e1 : e1 + wahl(rng, [-2, -1, 1, 2]);
    const w1 = m1 * 10 ** e1, w2 = m2 * 10 ** e2;
    if (w1 === w2 || (e1 === e2 && Math.abs(m1 - m2) < 0.5)) continue;
    // Falle: größere Zahl vorne, aber kleinere Hochzahl
    if (e1 !== e2 && (m1 > m2) === (e1 > e2) && rng() < 0.7) continue;
    const richtig = w1 > w2 ? 0 : 1;
    return neu('zehnerpotenz', [3, 'v', m1, e1, m2, e2], {
      ...basis, typ: 'auswahl', stufe, frage: 'Welche Zahl ist größer?',
      optionen: [potenzText(m1, e1), potenzText(m2, e2)], antwort: { richtig },
      loesungsweg: e1 === e2 ? ['Gleiche Hochzahl → die Zahlen vorne vergleichen'] : ['Erst die Hochzahlen vergleichen', `10${hoch(Math.max(e1, e2))} ist größer als 10${hoch(Math.min(e1, e2))}`],
      erklaerung: e1 === e2 ? 'Bei gleicher Hochzahl entscheidet die Zahl vor der Zehnerpotenz.' : 'Die Hochzahl entscheidet zuerst. Die Zahl vor der Zehnerpotenz liegt immer zwischen 1 und 10.'
    });
  }
  return zehnerpotenz(2, rng);
}

// ---------- Einheiten ----------
const LAENGE = [['mm', 'cm', 10], ['cm', 'm', 100], ['m', 'km', 1000], ['mm', 'm', 1000], ['cm', 'dm', 10], ['dm', 'm', 10]];
const FLAECHE_VOLUMEN = [['mm²', 'cm²', 100], ['cm²', 'dm²', 100], ['cm²', 'm²', 10000], ['dm²', 'm²', 100], ['cm³', 'dm³', 1000], ['dm³', 'm³', 1000], ['ml', 'l', 1000], ['l', 'm³', 1000], ['cm³', 'l', 1000], ['dm³', 'l', 1]];
const IN_MM = { mm: 1, cm: 10, dm: 100, m: 1000, km: 1e6 };

function schoeneZahl(rng, stufe) {
  const art = wahl(rng, stufe === 1 ? ['ganz', 'ganz', 'komma'] : ['ganz', 'komma', 'komma']);
  if (art === 'ganz') return wahl(rng, [zufall(rng, 2, 99), zufall(rng, 1, 9) * 100, zufall(rng, 11, 99) * 10]);
  return zufall(rng, 11, 999) / wahl(rng, [10, 100]);
}

export function einheiten(stufe, rng) {
  const basisE = { fach: 'physik', thema: 'einheiten', hinweise: ['zehnerpotenz'] };
  if (stufe === 3) {
    // Gemischte Summe in einer Zieleinheit (Länge)
    const ziel = wahl(rng, ['cm', 'm', 'mm']);
    const teile = [['m', zufall(rng, 1, 9) + wahl(rng, [0, 0.5, 0.25])], ['cm', zufall(rng, 5, 95)], ['mm', zufall(rng, 2, 9) * 10 + wahl(rng, [0, 5])]];
    const summe = glatt(teile.reduce((s, [e, x]) => s + x * IN_MM[e], 0) / IN_MM[ziel]);
    const rechnung = teile.map(([e, x]) => `${zahlKurz(x)} ${e}`).join(' + ') + ` = … ${ziel}`;
    return neu('einheiten', [3, ziel, ...teile.map(t => t[1])], {
      ...basisE, typ: 'zahl', stufe, rechnung, frage: `Rechne alles in ${ziel} um und addiere.`,
      antwort: { wert: summe, einheit: ziel },
      loesungsweg: [...teile.map(([e, x]) => `${zahlKurz(x)} ${e} = ${zahlKurz(glatt(x * IN_MM[e] / IN_MM[ziel]))} ${ziel}`), `Summe: ${zahlKurz(summe)} ${ziel}`],
      erklaerung: 'Erst alles in dieselbe Einheit umrechnen, dann addieren.'
    });
  }
  const [klein, gross, f] = wahl(rng, stufe === 1 ? LAENGE : FLAECHE_VOLUMEN);
  const runter = rng() < 0.5; // von groß nach klein
  const x = schoeneZahl(rng, stufe);
  const von = runter ? gross : klein, nach = runter ? klein : gross;
  const wert = glatt(runter ? x * f : x / f);
  if (wert < 0.001 || wert > 1e7) return einheiten(stufe, rng);
  return neu('einheiten', [stufe, von, nach, x], {
    ...basisE, typ: 'zahl', stufe, rechnung: `${zahlDe(x)} ${von} = … ${nach}`, frage: 'Rechne um.',
    antwort: { wert, einheit: nach },
    loesungsweg: [`1 ${gross} = ${zahlDe(f)} ${klein}`, `${zahlDe(x)} ${runter ? '·' : ':'} ${zahlDe(f)} = ${zahlDe(wert)}`, `${zahlDe(x)} ${von} = ${zahlDe(wert)} ${nach}`],
    erklaerung: (runter ? 'Von der großen zur kleinen Einheit: Die Zahl wird größer, also mal ' : 'Von der kleinen zur großen Einheit: Die Zahl wird kleiner, also geteilt durch ') + `${zahlDe(f)}.` +
      (f === 1 ? ' 1 dm³ ist genau 1 Liter.' : '')
  });
}

// ---------- Gewichtskraft (F_G = m · g) ----------
// Stufe 1 gibt es nur im Pool (Verständnis). Stufe 2 F_G = m · g (knobeln), Stufe 3 umstellen nach m oder g.
// [Name, g, fest]: fest = man kann dort stehen; bei Gasplaneten gilt g an der Wolkenobergrenze
export const ORTSFAKTOREN = [
  ['Erde', 9.81, 'der'], ['Mond', 1.62, 'dem'], ['Mars', 3.71, 'dem'], ['Venus', 8.87, 'der'], ['Merkur', 3.70, 'dem'], ['Jupiter', 24.8, null],
  ['Saturn', 10.4, null], ['Uranus', 8.87, null], ['Neptun', 11.2, null], ['Titan', 1.35, 'dem'], ['Pluto', 0.62, 'dem'], ['Ceres', 0.28, 'der']
];
const ortText = ([name, , art]) => (art ? `auf ${art} ${name}` : `an der Wolkenobergrenze des ${name}`);
const gText = (g) => (g >= 10 ? g.toFixed(1) : g.toFixed(2)).replace('.', ',');
const gross1 = (t) => t[0].toUpperCase() + t.slice(1);
const KOERPER = [
  ['Eine Astronautin mit Ausrüstung', 60, 180, 1], ['Ein Astronaut mit Ausrüstung', 60, 180, 1],
  ['Ein Rover', 100, 1100, 5], ['Eine Landesonde', 100, 1100, 5], ['Eine Raumsonde', 1000, 6000, 50]
];

export function gewichtskraft(stufe, rng) {
  const st = Math.max(2, stufe);
  const k = wahl(rng, KOERPER);
  const [wer, mmin, mmax, schritt] = k;
  // Menschen, Rover und Landesonden nur dort, wo man stehen kann
  const mensch = wer.includes('Astronaut');
  const orte = wer === 'Eine Raumsonde' ? ORTSFAKTOREN : ORTSFAKTOREN.filter(o => o[2] && !(mensch && o[0] === 'Venus'));
  const o = wahl(rng, orte);
  const [name, g] = o;
  const m = mmin + schritt * zufall(rng, 0, Math.floor((mmax - mmin) / schritt));
  const F = glatt(m * g);
  const Fz = aufZiffern(F, 3);
  const gegebenM = { name: 'Masse m', wert: m, einheit: 'kg' }, gegebenG = { name: 'Ortsfaktor g', wert: g, einheit: 'N/kg' };
  const gemeinsam = { fach: 'physik', thema: 'gewichtskraft', typ: 'schritte', modus: 'knobeln', taschenrechner: true, hinweise: ['gewichtskraft'], wissenspunkte: { knobeln: 3, schritte: 1 } };
  const oi = ORTSFAKTOREN.indexOf(o), ki = KOERPER.indexOf(k);
  if (st === 2) {
    const e = Math.floor(Math.log10(Fz));
    return neu('gewichtskraft', [2, oi, m, ki], {
      ...gemeinsam, stufe: 2,
      geschichte: `${wer} hat die Masse m = ${zahlDe(m)} kg. ${gross1(ortText(o))} ist der Ortsfaktor g = ${gText(g)} N/kg.`,
      frage: 'Berechne die Gewichtskraft F_G. Gib das Ergebnis mit drei gültigen Ziffern an.',
      antwort: { wert: F, einheit: 'N', gueltige_ziffern: 3 }, gegeben: [gegebenM, gegebenG],
      schritte: [
        { text: 'Welche Formel brauchst du?', optionen: ['F_G = m · g', 'F_G = m : g', 'F_G = g : m'], richtig: 0 },
        { text: 'F_G =', wert: F, einheit: 'N', gueltige_ziffern: 3 }
      ],
      loesungsweg: ['F_G = m · g', `F_G = ${zahlDe(m)} kg · ${gText(g)} N/kg = ${zahlDe(F)} N`, `F_G ≈ ${Fz >= 1000 ? potenzText(Fz / 10 ** e, e, 3) : zahlDe(Fz)} N`],
      erklaerung: `${gross1(ortText(o))} wirkt auf jedes Kilogramm eine Kraft von ${gText(g)} N. Darum Masse mal Ortsfaktor.`
    });
  }
  // Stufe 3: nach m oder nach g umstellen
  const nachM = rng() < 0.55;
  const Ftext = zahlDe(F);
  if (nachM) {
    return neu('gewichtskraft', [3, 'm', oi, m, ki], {
      ...gemeinsam, stufe: 3,
      geschichte: `${wer} ist ${ortText(o)}. Dort wirkt auf ${wer.startsWith('Eine') ? 'sie' : 'ihn'} die Gewichtskraft F_G = ${Ftext} N. Der Ortsfaktor ist g = ${gText(g)} N/kg.`,
      frage: 'Wie groß ist die Masse m? Gib das Ergebnis mit drei gültigen Ziffern an.',
      antwort: { wert: m, einheit: 'kg', gueltige_ziffern: 3 },
      gegeben: [{ name: 'Gewichtskraft F_G', wert: F, einheit: 'N' }, gegebenG],
      schritte: [
        { text: 'Stelle F_G = m · g nach m um.', optionen: ['m = F_G : g', 'm = F_G · g', 'm = g : F_G'], richtig: 0 },
        { text: 'm =', wert: m, einheit: 'kg', gueltige_ziffern: 3 }
      ],
      loesungsweg: ['F_G = m · g   | : g', 'm = F_G : g', `m = ${Ftext} N : ${gText(g)} N/kg = ${zahlDe(m)} kg`],
      erklaerung: 'Die Masse ist überall gleich. Aus der Gewichtskraft und dem Ortsfaktor lässt sie sich zurückrechnen.'
    });
  }
  const gleich = ORTSFAKTOREN.filter(x => x[1] === g).map(ortText);
  return neu('gewichtskraft', [3, 'g', oi, m, ki], {
    ...gemeinsam, stufe: 3,
    geschichte: `${wer} hat die Masse m = ${zahlDe(m)} kg. An einem Ort im Sonnensystem wirkt auf ${wer.startsWith('Eine') ? 'sie' : 'ihn'} die Gewichtskraft F_G = ${Ftext} N.`,
    frage: 'Wie groß ist der Ortsfaktor g dort? Gib das Ergebnis mit drei gültigen Ziffern an.',
    antwort: { wert: g, einheit: 'N/kg', gueltige_ziffern: 3 },
    gegeben: [gegebenM, { name: 'Gewichtskraft F_G', wert: F, einheit: 'N' }],
    schritte: [
      { text: 'Stelle F_G = m · g nach g um.', optionen: ['g = F_G : m', 'g = F_G · m', 'g = m : F_G'], richtig: 0 },
      { text: 'g =', wert: g, einheit: 'N/kg', gueltige_ziffern: 3 }
    ],
    loesungsweg: ['F_G = m · g   | : m', 'g = F_G : m', `g = ${Ftext} N : ${zahlDe(m)} kg = ${gText(g)} N/kg`],
    erklaerung: `${gText(g)} N/kg ist der Ortsfaktor ${gleich.join(' und ')}.`
  });
}

// ---------- Gleichungen lösen (immer ganzzahlige Lösung) ----------
const v = (n) => (n < 0 ? `${M} ${-n}` : `+ ${n}`); // „+ 5“ oder „− 5“
const ax = (a) => (a === 1 ? 'x' : `${a}x`);
const zk = zahlKurz;
const basisU = { fach: 'mathe', thema: 'umstellen', hinweise: ['umstellen'], typ: 'zahl', frage: 'Löse die Gleichung. x =' };

export function gleichung(stufe, rng) {
  for (let versuch = 0; versuch < 100; versuch++) {
    const x = zufall(rng, 1, 12) * (stufe >= 2 && rng() < 0.15 ? -1 : 1);
    if (stufe === 1) {
      const a = zufall(rng, 2, 9), b = (rng() < 0.4 ? -1 : 1) * zufall(rng, 1, 20);
      const c = a * x + b;
      return neu('gleichung', [1, a, b, c], {
        ...basisU, stufe, rechnung: `${ax(a)} ${v(b)} = ${zk(c)}`, antwort: { wert: x },
        loesungsweg: [`${ax(a)} ${v(b)} = ${zk(c)}   | ${b < 0 ? '+' : M} ${Math.abs(b)}`, `${ax(a)} = ${zk(a * x)}   | : ${a}`, `x = ${zk(x)}`],
        erklaerung: 'Erst die Zahl ohne x auf die andere Seite bringen, dann durch die Zahl vor x teilen.'
      });
    }
    if (stufe === 2) {
      if (rng() < 0.5) {
        // ax + b = cx + d
        const c = zufall(rng, 1, 6), a = c + zufall(rng, 1, 6), b = (rng() < 0.5 ? -1 : 1) * zufall(rng, 1, 15);
        const d = (a - c) * x + b;
        if (d === b) continue;
        return neu('gleichung', [2, 'xx', a, b, c, d], {
          ...basisU, stufe, rechnung: `${ax(a)} ${v(b)} = ${ax(c)} ${v(d)}`, antwort: { wert: x },
          loesungsweg: [`${ax(a)} ${v(b)} = ${ax(c)} ${v(d)}   | ${M} ${ax(c)}`, `${ax(a - c)} ${v(b)} = ${zk(d)}   | ${b < 0 ? '+' : M} ${Math.abs(b)}`, ...(a - c > 1 ? [`${ax(a - c)} = ${zk(d - b)}   | : ${a - c}`] : []), `x = ${zk(x)}`],
          erklaerung: 'Erst alle x auf eine Seite sammeln, dann die Zahlen auf die andere.'
        });
      }
      // a(x + b) = c
      const a = zufall(rng, 2, 6), b = (rng() < 0.5 ? -1 : 1) * zufall(rng, 1, 9);
      if (x + b === 0) continue;
      const c = a * (x + b);
      return neu('gleichung', [2, 'kl', a, b, c], {
        ...basisU, stufe, rechnung: `${a}(x ${v(b)}) = ${zk(c)}`, antwort: { wert: x },
        loesungsweg: [`${a}(x ${v(b)}) = ${zk(c)}   | Klammer auflösen`, `${a}x ${v(a * b)} = ${zk(c)}   | ${a * b < 0 ? '+' : M} ${Math.abs(a * b)}`, `${a}x = ${zk(c - a * b)}   | : ${a}`, `x = ${zk(x)}`],
        erklaerung: 'Erst die Klammer auflösen: Die Zahl vor der Klammer wird mit jedem Teil in der Klammer malgenommen.'
      });
    }
    // Stufe 3: Brüche
    if (rng() < 0.5) {
      // x/a + b = c, x ist ein Vielfaches von a
      const a = zufall(rng, 2, 6), k = zufall(rng, 1, 8) * (rng() < 0.15 ? -1 : 1), xx = a * k, b = (rng() < 0.4 ? -1 : 1) * zufall(rng, 1, 12);
      const c = k + b;
      return neu('gleichung', [3, 'b', a, b, c], {
        ...basisU, stufe, rechnung: `x/${a} ${v(b)} = ${zk(c)}`, antwort: { wert: xx },
        loesungsweg: [`x/${a} ${v(b)} = ${zk(c)}   | ${b < 0 ? '+' : M} ${Math.abs(b)}`, `x/${a} = ${zk(k)}   | · ${a}`, `x = ${zk(xx)}`],
        erklaerung: 'Das Gegenteil von „geteilt durch“ ist „mal“. Darum am Ende mit dem Nenner malnehmen.'
      });
    }
    // (x + b)/a = c
    const a = zufall(rng, 2, 6), c = zufall(rng, 1, 9), b = (rng() < 0.5 ? -1 : 1) * zufall(rng, 1, 9);
    const xx = a * c - b;
    if (xx === 0) continue;
    return neu('gleichung', [3, 'kb', a, b, c], {
      ...basisU, stufe, rechnung: `(x ${v(b)})/${a} = ${c}`, antwort: { wert: xx },
      loesungsweg: [`(x ${v(b)})/${a} = ${c}   | · ${a}`, `x ${v(b)} = ${a * c}   | ${b < 0 ? '+' : M} ${Math.abs(b)}`, `x = ${zk(xx)}`],
      erklaerung: 'Erst den Bruch wegmachen: beide Seiten mit dem Nenner malnehmen.'
    });
  }
  return gleichung(1, rng);
}

// ---------- Formeln umstellen ----------
// Je Formel: Zielgrößen mit richtiger Formel und Fehl-Formeln für die Auswahl. Schreibweise wie die Pool-Aufgaben.
const FORMELN = {
  1: [
    { r: 'F_G = m · g', z: { m: ['F_G / g', ['F_G · g', 'g / F_G']], g: ['F_G / m', ['F_G · m', 'm / F_G']] } },
    { r: 'ρ = m/V', z: { m: ['ρ · V', ['ρ/V', 'V/ρ']], V: ['m / ρ', ['ρ/m', 'm · ρ']] } },
    { r: 'v = s/t', z: { s: ['v · t', ['v/t', 't/v']], t: ['s / v', ['v/s', 's · v']] } },
    { r: 'U = R · I', z: { R: ['U / I', ['U · I', 'I/U']], I: ['U / R', ['U · R', 'R/U']] } },
    { r: 'A = a · b', z: { a: ['A / b', ['A · b', 'b/A']], b: ['A / a', ['A · a', 'a/A']] } },
    { r: 'P = W/t', z: { W: ['P · t', ['P/t', 't/P']], t: ['W / P', ['P/W', 'W · P']] } },
    { r: 'p = F/A', z: { F: ['p · A', ['p/A', 'A/p']], A: ['F / p', ['p/F', 'F · p']] } },
    { r: 'W = F · s', z: { F: ['W / s', ['W · s', 's/W']], s: ['W / F', ['W · F', 'F/W']] } }
  ],
  2: [
    { r: 'A = ½ · g · h', z: { g: ['2 · A / h', ['A/(2 · h)', '2 · h/A']], h: ['2 · A / g', ['A/(2 · g)', '2 · g/A']] } },
    { r: 'V = a · b · c', z: { a: ['V / (b · c)', ['V · b · c', 'b · c/V']], c: ['V / (a · b)', ['V · a · b', 'a · b/V']] } },
    { r: 's = ½ · a · t²', z: { a: ['2 · s / t²', ['s/(2 · t²)', '2 · t²/s']] } },
    { r: 'E = m · c²', z: { m: ['E / c²', ['E · c²', 'c²/E']] } }
  ],
  3: [
    { r: 'A_O = 2 · π · r² + 2 · π · r · h', z: { h: ['(A_O − 2 · π · r²) / (2 · π · r)', ['A_O/(2 · π · r) − 2 · π · r²', '(A_O − 2 · π · r)/(2 · π · r²)']] } },
    { r: 'u = 2 · (a + b)', z: { b: ['u / 2 − a', ['u − 2 · a', '(u − a)/2']] } },
    { r: 'v = v₀ + a · t', z: { t: ['(v − v₀) / a', ['v/a − v₀', '(v + v₀)/a']] } }
  ]
};
const VARS = (text) => [...new Set(String(text).match(/F_G|A_O|v₀|[A-Za-zρ](?![a-zäöüß_₀])/g) || [])];
const ohneLeer = (t) => t.replace(/ \/ /g, '/');
// Kärtchen für „Rechnung legen“ aus einer Formel: Größen, Zahlen, Rechenzeichen, Klammern, dazu ein falsches Rechenzeichen
function kartenAus(ziel, formel, rng) {
  const teile = String(formel).match(/F_G|A_O|v₀|[A-Za-zρπ]|\d+|[·/+−²()]/g) || [];
  const karten = [ziel, '=', ...teile.map(t => (t === '/' ? ':' : t))];
  const extra = karten.includes(':') ? '·' : ':';
  karten.push(extra);
  return karten;
}

export function formelUmstellen(stufe, rng) {
  const st = Math.min(3, Math.max(1, stufe));
  const f = wahl(rng, FORMELN[st]);
  const ziel = wahl(rng, Object.keys(f.z));
  const [richtigF, falsch] = f.z[ziel];
  const variablen = VARS(f.r).filter(x => x !== ziel);
  const antwort = { ziel, formel: richtigF, variablen };
  const eingabe = st === 1 ? wahl(rng, ['auswahl', 'auswahl', 'karten']) : st === 2 ? wahl(rng, ['auswahl', 'karten', 'frei']) : wahl(rng, ['auswahl', 'frei']);
  const felder = {
    fach: 'mathe', thema: 'umstellen', typ: 'formel', stufe: st, rechnung: f.r, frage: `Stelle die Formel nach ${ziel} um.`, eingabe,
    hinweise: ['umstellen'], loesungsweg: [f.r, `${ziel} = ${ohneLeer(richtigF)}`],
    erklaerung: `Mach rückgängig, was mit ${ziel} passiert, auf beiden Seiten. Probe: Zahlen einsetzen, beide Seiten müssen gleich sein.`
  };
  if (eingabe === 'auswahl') {
    const opt = [`${ziel} = ${ohneLeer(richtigF)}`, ...falsch.map(x => `${ziel} = ${x}`)];
    // mischen
    const reihe = opt.map((o, k) => [rng(), o, k]).sort((a, b) => a[0] - b[0]);
    felder.optionen = reihe.map(x => x[1]);
    antwort.richtig = reihe.findIndex(x => x[2] === 0);
  }
  if (eingabe === 'karten') {
    const reihe = kartenAus(ziel, richtigF, rng).map(k => [rng(), k]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    felder.karten = reihe;
  }
  felder.antwort = antwort;
  return neu('formel-umstellen', [st, FORMELN[st].indexOf(f), ziel, eingabe], felder);
}

// Selbstkontrolle (für Tests): passen Auswahl und richtige Formel zusammen?
export function formelnStimmig() {
  const fehler = [];
  for (const st of [1, 2, 3]) for (const f of FORMELN[st]) for (const [ziel, [richtigF, falsch]] of Object.entries(f.z)) {
    const variablen = VARS(f.r).filter(x => x !== ziel);
    const ant = { ziel, formel: richtigF, variablen };
    // richtige Formel muss die Ausgangsformel erfüllen: Ausgangsformel nach Einsetzen prüfen
    if (!pruefeFormel(`${ziel} = ${richtigF}`, ant).richtig) fehler.push(`${f.r} nach ${ziel}: richtige Formel nicht lesbar`);
    for (const x of falsch) if (pruefeFormel(`${ziel} = ${x}`, ant).richtig) fehler.push(`${f.r} nach ${ziel}: ${x} ist auch richtig`);
  }
  return fehler;
}
export { FORMELN };
