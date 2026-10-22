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

// ---------- Dichte (ρ = m/V), Auftrag 15 ----------
// Varianten = Muster im Pool (quelle „Muster <name>“). Grenzen je Etappe über „ohne“.
// Stufe 1: rho, quader (ρ gesucht) · Stufe 2: umrechnen · Stufe 3: masse-volumen, quader (m gesucht), vergleich, verhaeltnis, gewichtskraft
export const DICHTE_VARIANTEN = { rho: 1, quader: 1, umrechnen: 2, 'masse-volumen': 3, vergleich: 3, verhaeltnis: 3, gewichtskraft: 3 };
// Wie zahlDe, aber vierstellige Zahlen ohne Leerzeichen (1350 g, 13 530 kg/m³)
const zD = (x) => { const t = zahlDe(x); return /^\d\u00A0\d{3}(,|$)/.test(t) ? t.replace('\u00A0', '') : t; };
// Zahl mit n gültigen Ziffern, Nullen am Ende bleiben stehen: 8,00 und 13,0
export function zahlZ(x, n) {
  const r = aufZiffern(x, n);
  const e = Math.floor(Math.log10(Math.abs(r || 1)));
  const stellen = Math.max(0, n - 1 - e);
  return stellen > 0 ? zD(r).split(',')[0] + ',' + r.toFixed(stellen).split('.')[1] : zD(r);
}
const basisD = { fach: 'physik', thema: 'dichte', hinweise: ['dichte'] };
const knobelD = (k = 2) => ({ typ: 'schritte', modus: 'knobeln', wissenspunkte: { knobeln: k, schritte: 1 } });
// Dichte mit 2 oder 3 gültigen Ziffern zwischen 0,2 und 20 g/cm³
const zufallsDichte = (rng, n = 3) => aufZiffern(wahl(rng, [zufall(rng, 20, 99) / 100, zufall(rng, 10, 99) / 10, zufall(rng, 100, 199) / 10]), n);
const dichteText = (rho) => `${zahlZ(rho, 3)} g/cm³`;

function dichteRho(rng) {
  const V = wahl(rng, [zufall(rng, 4, 20), zufall(rng, 2, 30) * 5, zufall(rng, 3, 25) * 10, zufall(rng, 11, 99) / 2]);
  const m = aufZiffern(zufallsDichte(rng) * V, 3);
  const rho = m / V;
  if (rho < 0.2 || rho > 20 || m < 1) return dichteRho(rng);
  return neu('dichte', ['rho', m, V], {
    ...basisD, variante: 'rho', typ: 'zahl', stufe: 1,
    rechnung: `m = ${zahlZ(m, 3)} g · V = ${zahlZ(V, 3)} cm³`, frage: 'Berechne die Dichte ρ.',
    antwort: { wert: rho, einheit: 'g/cm³', gueltige_ziffern: 3 },
    loesungsweg: ['ρ = m/V', `ρ = ${zahlZ(m, 3)} g : ${zahlZ(V, 3)} cm³ = ${dichteText(rho)}`],
    erklaerung: 'Die Dichte sagt, welche Masse in einem Kubikzentimeter eines Stoffes steckt.'
  });
}

function dichteQuader(rng, mGesucht) {
  if (!mGesucht) {
    const a = zufall(rng, 2, 10), b = zufall(rng, 2, 10), c = zufall(rng, 2, 20) / 2;
    const V = glatt(a * b * c);
    const m = aufZiffern(zufallsDichte(rng, 2) * V, 2);
    const rho = m / V;
    if (rho < 0.2 || rho > 20 || V < 5) return dichteQuader(rng, false);
    return neu('dichte', ['quader', 'rho', a, b, c, m], {
      ...basisD, ...knobelD(2), variante: 'quader', stufe: 1,
      rechnung: `Quader: a = ${zahlZ(a, 2)} cm · b = ${zahlZ(b, 2)} cm · c = ${zahlZ(c, 2)} cm · m = ${zD(m)} g`,
      frage: 'Berechne die Dichte ρ des Quaders.',
      antwort: { wert: rho, einheit: 'g/cm³', gueltige_ziffern: 2 },
      schritte: [{ text: 'Volumen V =', wert: V, einheit: 'cm³' }, { text: 'ρ =', wert: rho, einheit: 'g/cm³', gueltige_ziffern: 2 }],
      loesungsweg: [`V = a · b · c = ${zahlKurz(a)} · ${zahlKurz(b)} · ${zahlKurz(c)} cm³ = ${zD(V)} cm³`, `ρ = m/V = ${zD(m)} g : ${zD(V)} cm³ = ${zahlZ(rho, 2)} g/cm³`],
      erklaerung: 'Erst das Volumen aus den Kantenlängen, dann die Dichte.'
    });
  }
  const a = zufall(rng, 2, 12), b = zufall(rng, 2, 10), c = zufall(rng, 1, 6);
  const V = a * b * c;
  const rho = zufallsDichte(rng);
  const m = glatt(rho * V);
  return neu('dichte', ['quader', 'm', a, b, c, rho], {
    ...basisD, ...knobelD(2), variante: 'quader', stufe: 3,
    rechnung: `Quader: ${a} cm × ${b} cm × ${c} cm · ρ = ${dichteText(rho)}`,
    frage: 'Berechne die Masse m des Quaders.',
    antwort: { wert: m, einheit: 'g', gueltige_ziffern: 3 },
    schritte: [{ text: 'V =', wert: V, einheit: 'cm³' }, { text: 'm =', wert: m, einheit: 'g', gueltige_ziffern: 3 }],
    loesungsweg: [`V = ${a} · ${b} · ${c} cm³ = ${zD(V)} cm³`, `m = ρ · V = ${dichteText(rho)} · ${zD(V)} cm³ = ${zD(m)} g`, `m ≈ ${zahlZ(m, 3)} g`],
    erklaerung: 'Erst das Volumen, dann m = ρ · V.'
  });
}

function dichteUmrechnen(rng) {
  const art = wahl(rng, ['zuKgM3', 'zuGCm3', 'kgDm3', 'klein', 'ausKgDm3']);
  const z = { ...basisD, variante: 'umrechnen', stufe: 2 };
  if (art === 'zuKgM3') {
    const rho = zufallsDichte(rng);
    return neu('dichte', ['umrechnen', 1, rho], { ...z, typ: 'zahl', rechnung: `ρ = ${dichteText(rho)}`, frage: 'Rechne in kg/m³ um.',
      antwort: { wert: glatt(rho * 1000), einheit: 'kg/m³' },
      loesungsweg: ['1 g/cm³ = 1 kg/dm³ = 1000 kg/m³', `${zahlZ(rho, 3)} · 1000 = ${zD(glatt(rho * 1000))} kg/m³`],
      erklaerung: 'Ein Kubikmeter hat 10⁶ cm³, ein Kilogramm 10³ g. Zusammen ergibt das den Faktor 10⁶ : 10³ = 1000.' });
  }
  if (art === 'zuGCm3') {
    const k = wahl(rng, [zufall(rng, 11, 99) * 10, zufall(rng, 2, 19) * 50, zufall(rng, 101, 199) * 10]);
    return neu('dichte', ['umrechnen', 2, k], { ...z, typ: 'zahl', rechnung: `ρ = ${zD(k)} kg/m³`, frage: 'Rechne in g/cm³ um.',
      antwort: { wert: glatt(k / 1000), einheit: 'g/cm³' },
      loesungsweg: ['1000 kg/m³ = 1 g/cm³', `${zD(k)} : 1000 = ${zD(glatt(k / 1000))} g/cm³`],
      erklaerung: 'Von kg/m³ zu g/cm³ teilt man durch 1000.' });
  }
  if (art === 'kgDm3') {
    const rho = zufall(rng, 5, 199) / 10;
    const hin = rng() < 0.5;
    return neu('dichte', ['umrechnen', 3, rho, hin ? 1 : 0], { ...z, typ: 'zahl', rechnung: `ρ = ${zahlKurz(rho)} ${hin ? 'kg/dm³' : 'g/cm³'}`, frage: `Rechne in ${hin ? 'g/cm³' : 'kg/dm³'} um.`,
      antwort: { wert: rho, einheit: hin ? 'g/cm³' : 'kg/dm³' },
      loesungsweg: ['1 kg = 1000 g und 1 dm³ = 1000 cm³', hin ? `${zahlKurz(rho)} kg/dm³ = ${zD(glatt(rho * 1000))} g : 1000 cm³ = ${zahlKurz(rho)} g/cm³` : `${zahlKurz(rho)} g/cm³ = ${zahlKurz(rho)} kg/dm³`],
      erklaerung: 'Zähler und Nenner werden beide mit 1000 umgerechnet – der Zahlenwert bleibt gleich. kg/dm³ und g/cm³ sind gleich große Einheiten.' });
  }
  if (art === 'klein') {
    const ziffern = zufall(rng, 11, 99);
    const e = wahl(rng, [3, 4]);
    const rho = glatt(ziffern / 10 ** e); // 0,0036 oder 0,00036
    return neu('dichte', ['umrechnen', 4, rho], { ...z, typ: 'zahl', rechnung: `ρ = ${zD(rho)} g/cm³`, frage: 'Rechne in kg/m³ um.',
      antwort: { wert: glatt(rho * 1000), einheit: 'kg/m³' },
      loesungsweg: ['1 g/cm³ = 1000 kg/m³', `${zD(rho)} · 1000 = ${zD(glatt(rho * 1000))} kg/m³`],
      erklaerung: 'So kleine Dichten haben Gase. Für sie ist kg/m³ die handlichere Einheit.' });
  }
  // ρ aus kg und dm³, Ergebnis in kg/m³
  const V = zufall(rng, 4, 40) / 10, rho = zufall(rng, 6, 99) / 10;
  const m = glatt(rho * V);
  if (String(m).replace('.', '').replace(/^0+/, '').length > 3) return dichteUmrechnen(rng);
  return neu('dichte', ['umrechnen', 5, m, V], { ...z, ...knobelD(2),
    rechnung: `m = ${zahlKurz(m)} kg · V = ${zahlKurz(V)} dm³`, frage: 'Berechne die Dichte ρ in kg/m³.',
    antwort: { wert: glatt(rho * 1000), einheit: 'kg/m³', gueltige_ziffern: 2 },
    schritte: [{ text: 'ρ in kg/dm³ =', wert: rho, einheit: 'kg/dm³' }, { text: 'ρ in kg/m³ =', wert: glatt(rho * 1000), einheit: 'kg/m³', gueltige_ziffern: 2 }],
    loesungsweg: [`ρ = ${zahlKurz(m)} kg : ${zahlKurz(V)} dm³ = ${zahlKurz(rho)} kg/dm³`, `1 m³ = 1000 dm³ → ${zahlKurz(rho)} · 1000 = ${zD(glatt(rho * 1000))} kg/m³`],
    erklaerung: 'Erst in der passenden Einheit rechnen, dann umrechnen.' });
}

function dichteMasseVolumen(rng) {
  const art = wahl(rng, ['m', 'V', 'Vkg']);
  const z = { ...basisD, variante: 'masse-volumen', stufe: 3 };
  if (art === 'm') {
    const rho = zufallsDichte(rng), V = wahl(rng, [zufall(rng, 5, 50) * 2, zufall(rng, 2, 40) * 5, zufall(rng, 101, 499)]);
    const m = glatt(rho * V);
    return neu('dichte', ['masse-volumen', 'm', rho, V], { ...z, typ: 'zahl',
      rechnung: `ρ = ${dichteText(rho)} · V = ${zahlZ(V, 3)} cm³`, frage: 'Berechne die Masse m.',
      antwort: { wert: m, einheit: 'g', gueltige_ziffern: 3 },
      loesungsweg: ['ρ = m/V   | · V', 'm = ρ · V', `m = ${dichteText(rho)} · ${zahlZ(V, 3)} cm³ = ${zD(m)} g`, `m ≈ ${zahlZ(m, 3)} g`],
      erklaerung: 'Die Einheit cm³ kürzt sich weg, übrig bleibt g.' });
  }
  if (art === 'V') {
    const rho = aufZiffern(zufallsDichte(rng), 2), V = zufall(rng, 3, 80) * 5;
    const m = glatt(rho * V);
    if (String(m).replace('.', '').replace(/^0+/, '').length > 4) return dichteMasseVolumen(rng);
    return neu('dichte', ['masse-volumen', 'V', rho, m], { ...z, typ: 'zahl',
      rechnung: `ρ = ${zahlZ(rho, 2)} g/cm³ · m = ${zD(m)} g`, frage: 'Berechne das Volumen V.',
      antwort: { wert: V, einheit: 'cm³', gueltige_ziffern: 2 },
      loesungsweg: ['ρ = m/V   | · V   | : ρ', 'V = m/ρ', `V = ${zD(m)} g : ${zahlZ(rho, 2)} g/cm³ = ${zD(V)} cm³`],
      erklaerung: rho < 1 ? 'Ist die Dichte kleiner als 1 g/cm³, ist das Volumen in cm³ größer als die Masse in g.' : 'Ist die Dichte größer als 1 g/cm³, ist das Volumen in cm³ kleiner als die Masse in g.' });
  }
  // Masse in kg, erst in g umrechnen
  const rho = wahl(rng, [0.8, 1.25, 1.6, 2, 2.5, 4, 5, 8, 0.25, 0.5]);
  const mkg = zufall(rng, 2, 40) / 2;
  const mg = glatt(mkg * 1000), V = glatt(mg / rho);
  return neu('dichte', ['masse-volumen', 'Vkg', rho, mkg], { ...z, ...knobelD(2),
    rechnung: `ρ = ${zahlZ(rho, 3)} g/cm³ · m = ${zahlZ(mkg, 2)} kg`, frage: 'Berechne das Volumen V in cm³.',
    antwort: { wert: V, einheit: 'cm³', gueltige_ziffern: 2 },
    schritte: [{ text: 'm in g =', wert: mg, einheit: 'g' }, { text: 'V =', wert: V, einheit: 'cm³', gueltige_ziffern: 2 }],
    loesungsweg: [`m = ${zahlZ(mkg, 2)} kg = ${zD(mg)} g`, `V = m/ρ = ${zD(mg)} g : ${zahlZ(rho, 3)} g/cm³ = ${zD(V)} cm³`],
    erklaerung: 'Masse und Dichte müssen zueinander passende Einheiten haben: g zu g/cm³.' });
}

function dichteVergleich(rng) {
  const rhoA = wahl(rng, [0.8, 0.9, 1.2, 1.5, 2.5, 2.7, 4.5, 7.8, 8.9, 11.3, 19.3]);
  const gleich = rng() < 0.5;
  const rhoB = gleich ? rhoA : aufZiffern(rhoA * wahl(rng, [0.5, 0.8, 1.25, 1.5, 2]), 2);
  const VA = zufall(rng, 4, 40) * 10;            // cm³
  const VB = zufall(rng, 2, 20) / 10;            // dm³
  const mA = glatt(rhoA * VA);                   // g
  const mB = glatt(rhoB * VB);                   // kg
  return neu('dichte', ['vergleich', rhoA, rhoB, VA, VB], {
    ...basisD, ...knobelD(3), variante: 'vergleich', stufe: 3,
    rechnung: `Körper A: m = ${zD(mA)} g, V = ${zD(VA)} cm³ · Körper B: m = ${zD(mB)} kg, V = ${zahlZ(VB, 3)} dm³`,
    frage: 'Berechne beide Dichten. Können A und B aus demselben Stoff bestehen?',
    antwort: { wert: rhoA, einheit: 'g/cm³', gueltige_ziffern: 3 },
    schritte: [
      { text: 'ρ_A =', wert: rhoA, einheit: 'g/cm³', gueltige_ziffern: 3 },
      { text: 'ρ_B =', wert: rhoB, einheit: 'g/cm³', gueltige_ziffern: 3 },
      { text: 'Gleicher Stoff möglich?', optionen: ['Ja', 'Nein'], richtig: gleich ? 0 : 1 }
    ],
    loesungsweg: [`ρ_A = ${zD(mA)} g : ${zD(VA)} cm³ = ${dichteText(rhoA)}`, `ρ_B = ${zD(mB)} kg : ${zahlZ(VB, 3)} dm³ = ${zahlZ(rhoB, 3)} kg/dm³ = ${dichteText(rhoB)}`,
      gleich ? 'gleiche Dichte → gleicher Stoff möglich' : 'verschiedene Dichten → nicht derselbe Stoff'],
    erklaerung: 'Erst beide Dichten in derselben Einheit, dann vergleichen. Gleiche Dichte beweist nicht denselben Stoff, verschiedene Dichten schließen ihn aber aus.'
  });
}

function dichteVerhaeltnis(rng) {
  const art = wahl(rng, ['m', 'V', 'rho']);
  const z = { ...basisD, variante: 'verhaeltnis', typ: 'zahl', stufe: 3 };
  if (art === 'm' || art === 'V') {
    const k = zufall(rng, 2, 6);
    const klein = wahl(rng, [zufall(rng, 5, 30) / 10, zufall(rng, 2, 9) / 2]);
    const gross = glatt(klein * k);
    if (art === 'm') return neu('dichte', ['verhaeltnis', 'm', gross, klein], { ...z,
      rechnung: `V_A = V_B · ρ_A = ${zahlKurz(gross)} g/cm³ · ρ_B = ${zahlKurz(klein)} g/cm³`,
      frage: 'Zwei Körper haben dasselbe Volumen. Wievielmal so groß ist die Masse m_A wie m_B?',
      antwort: { wert: k },
      loesungsweg: ['m = ρ · V, V gleich', `m_A : m_B = ρ_A : ρ_B = ${zahlKurz(gross)} : ${zahlKurz(klein)} = ${k}`],
      erklaerung: 'Bei gleichem Volumen verhalten sich die Massen wie die Dichten – das Volumen kürzt sich heraus.' });
    return neu('dichte', ['verhaeltnis', 'V', klein, gross], { ...z,
      rechnung: `m_A = m_B · ρ_A = ${zahlKurz(klein)} g/cm³ · ρ_B = ${zahlKurz(gross)} g/cm³`,
      frage: 'Zwei Körper haben dieselbe Masse. Wievielmal so groß ist das Volumen V_A wie V_B?',
      antwort: { wert: k },
      loesungsweg: ['V = m/ρ, m gleich', `V_A : V_B = ρ_B : ρ_A = ${zahlKurz(gross)} : ${zahlKurz(klein)} = ${k}`],
      erklaerung: 'Bei gleicher Masse ist es umgekehrt: Der Stoff mit der kleineren Dichte braucht mehr Platz.' });
  }
  // Faktoren für Masse und Volumen
  const [fV, fm] = wahl(rng, [[1.5, 3], [2, 6], [2, 3], [2.5, 5], [4, 2], [1.5, 6], [3, 1.5], [2, 5], [4, 6], [0.5, 2], [2.5, 10]]);
  const r = glatt(fm / fV);
  return neu('dichte', ['verhaeltnis', 'rho', fV, fm], { ...z,
    rechnung: `V_A = ${zahlKurz(fV)} · V_B · m_A = ${zahlKurz(fm)} · m_B`,
    frage: 'Wievielmal so groß ist die Dichte ρ_A wie ρ_B?',
    antwort: { wert: r },
    loesungsweg: [`ρ_A = m_A/V_A = (${zahlKurz(fm)} · m_B) : (${zahlKurz(fV)} · V_B)`, `= (${zahlKurz(fm)} : ${zahlKurz(fV)}) · m_B/V_B = ${zahlKurz(r)} · ρ_B`],
    erklaerung: `Die Faktoren für Masse und Volumen lassen sich getrennt rechnen: ${zahlKurz(fm)} : ${zahlKurz(fV)} = ${zahlKurz(r)}.` });
}

function dichteGewichtskraft(rng) {
  const [ort, g] = wahl(rng, [['Erde', 9.81], ['Erde', 9.81], ['Mond', 1.62]]);
  const gT = `g = ${gText(g)} N/kg`;
  const art = wahl(rng, ['V', 'wuerfel', 'quader', 'zylinder', 'liter']);
  const z = { ...basisD, ...knobelD(2), variante: 'gewichtskraft', stufe: 3, hinweise: ['dichte', 'gewichtskraft'], taschenrechner: true };
  const rho = zufallsDichte(rng, 2);
  const ende = (V, Vtext, schritteV, wegV, extra = {}) => {
    const mg = rho * V, mkg = mg / 1000, F = mkg * g;
    return {
      ...z, ...extra,
      rechnung: Vtext.startsWith('V =') ? `ρ = ${zahlZ(rho, 2)} g/cm³ · ${Vtext} · ${gT}` : `${Vtext} · ρ = ${zahlZ(rho, 2)} g/cm³ · ${gT}`,
      frage: `Berechne die Gewichtskraft F_G${ort === 'Mond' ? ' auf dem Mond' : ''}.`,
      antwort: { wert: F, einheit: 'N', gueltige_ziffern: 3 },
      schritte: [...schritteV, { text: 'm in kg =', wert: mkg, einheit: 'kg', gueltige_ziffern: 3 }, { text: 'F_G =', wert: F, einheit: 'N', gueltige_ziffern: 3 }],
      loesungsweg: [...wegV, `m = ρ · V = ${zahlZ(rho, 2)} · ${zD(glatt(V))} g = ${zD(glatt(mg))} g ≈ ${zahlZ(mkg, 3)} kg`, `F_G = m · g = ${zahlZ(mkg, 3)} kg · ${gText(g)} N/kg ≈ ${zahlZ(F, 3)} N`],
      erklaerung: 'Zwei Schritte: Aus Dichte und Volumen folgt die Masse, aus Masse und Ortsfaktor die Gewichtskraft. Die Masse vorher in kg umrechnen, weil g in N/kg angegeben ist.'
    };
  };
  if (art === 'V') {
    const V = zufall(rng, 2, 40) * 50;
    return neu('dichte', ['gewichtskraft', 'V', rho, V, g], ende(V, `V = ${zD(V)} cm³`, [], []));
  }
  if (art === 'wuerfel') {
    const a = zufall(rng, 3, 15);
    const V = a ** 3;
    return neu('dichte', ['gewichtskraft', 'w', rho, a, g], ende(V, `Würfel: a = ${a} cm`, [{ text: 'V =', wert: V, einheit: 'cm³' }], [`V = a³ = (${a} cm)³ = ${zD(V)} cm³`]));
  }
  if (art === 'quader') {
    const a = zufall(rng, 4, 20), b = zufall(rng, 2, 10), c = zufall(rng, 1, 8);
    const V = a * b * c;
    return neu('dichte', ['gewichtskraft', 'q', rho, a, b, c, g], ende(V, `Quader: ${a} cm × ${b} cm × ${c} cm`, [{ text: 'V =', wert: V, einheit: 'cm³' }], [`V = ${a} · ${b} · ${c} cm³ = ${zD(V)} cm³`]));
  }
  if (art === 'zylinder') {
    const r = zufall(rng, 2, 8) / (rng() < 0.5 ? 1 : 2) + (rng() < 0.3 ? 0.5 : 0), h = zufall(rng, 3, 20);
    const V = Math.PI * r * r * h;
    return neu('dichte', ['gewichtskraft', 'z', rho, r, h, g], ende(V, `Zylinder: r = ${zahlZ(r, 2)} cm · h = ${zahlZ(h, 3)} cm`,
      [{ text: 'V =', wert: V, einheit: 'cm³', gueltige_ziffern: 3 }], [`V = π · r² · h = π · ${zahlKurz(glatt(r * r))} · ${h} cm³ = ${zahlKurz(Math.round(V * 100) / 100)} cm³`],
      { hinweise: ['dichte', 'gewichtskraft', 'zylinder'] }));
  }
  // Volumen in Litern: mit kg/dm³ ohne Umweg
  const L = zufall(rng, 2, 40) / 2;
  const mkg = glatt(rho * L), F = mkg * g;
  return neu('dichte', ['gewichtskraft', 'L', rho, L, g], {
    ...z, typ: 'zahl', modus: undefined, wissenspunkte: undefined,
    rechnung: `ρ = ${zahlZ(rho, 2)} g/cm³ · V = ${zahlZ(L, 2)} L · ${gT}`,
    frage: `Berechne die Gewichtskraft F_G${ort === 'Mond' ? ' auf dem Mond' : ''}.`,
    antwort: { wert: F, einheit: 'N', gueltige_ziffern: 2 },
    loesungsweg: [`V = ${zahlZ(L, 2)} L = ${zahlZ(L, 2)} dm³ und ${zahlZ(rho, 2)} g/cm³ = ${zahlZ(rho, 2)} kg/dm³`, `m = ${zahlZ(rho, 2)} kg/dm³ · ${zahlZ(L, 2)} dm³ = ${zahlKurz(mkg)} kg`, `F_G = ${zahlKurz(mkg)} kg · ${gText(g)} N/kg = ${zahlKurz(glatt(F))} N ≈ ${zahlZ(F, 2)} N`],
    erklaerung: 'Mit kg/dm³ und Litern geht es ohne Umweg: Ein Liter ist ein Kubikdezimeter.'
  });
}

// opts.ohne: Varianten, die die aktuelle Etappe nicht erlaubt
export function dichte(stufe, rng, opts = {}) {
  const st = Math.min(3, Math.max(1, stufe || 1));
  const ohne = opts.ohne || [];
  let moeglich = Object.entries(DICHTE_VARIANTEN).filter(([v, s]) => s <= st && !ohne.includes(v));
  if (!moeglich.length) moeglich = [['rho', 1]];
  // Varianten der aktuellen Stufe kommen doppelt so oft
  const v = wahl(rng, moeglich.flatMap(([n, s]) => (s === st ? [n, n] : [n])));
  let a;
  if (v === 'rho') a = dichteRho(rng);
  else if (v === 'quader') a = dichteQuader(rng, st >= 3 && rng() < 0.6);
  else if (v === 'umrechnen') a = dichteUmrechnen(rng);
  else if (v === 'masse-volumen') a = dichteMasseVolumen(rng);
  else if (v === 'vergleich') a = dichteVergleich(rng);
  else if (v === 'verhaeltnis') a = dichteVerhaeltnis(rng);
  else a = dichteGewichtskraft(rng);
  for (const k of Object.keys(a)) if (a[k] === undefined) delete a[k];
  return a;
}
