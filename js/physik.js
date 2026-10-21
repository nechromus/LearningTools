// Physik und Umstellen (Auftrag 13): Sternzeit, gültige Ziffern, Zahl · 10ⁿ, Formeln prüfen durch Einsetzen.
// Reine Logik ohne DOM (testbar mit node).

// ---------- Sternzeit ----------
// Verbreitete Fan-Formel (es gibt keine offizielle): 1000 · (Jahr − 2323) + 1000 · (Tag im Jahr − 1 + Uhrzeit/24) / Tage im Jahr
export function sternzeit(d = new Date()) {
  const j = d.getFullYear();
  const tag = (Date.UTC(j, d.getMonth(), d.getDate()) - Date.UTC(j, 0, 1)) / 864e5;
  const tage = (Date.UTC(j + 1, 0, 1) - Date.UTC(j, 0, 1)) / 864e5;
  const v = 1000 * (j - 2323) + 1000 * (tag + (d.getHours() + d.getMinutes() / 60) / 24) / tage;
  return Math.round(v * 10) / 10;
}
export const sternzeitText = (z) => z.toFixed(1).replace('.', ',').replace('-', '−');

// ---------- Gültige Ziffern ----------
export function aufZiffern(x, n) {
  if (!Number.isFinite(x) || x === 0) return x;
  const e = Math.floor(Math.log10(Math.abs(x)));
  const f = 10 ** (n - 1 - e);
  return Math.round(x * f) / f;
}
const fastGleich = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
// Richtig ist jede Eingabe, die auf n gültige Ziffern gerundet mit dem Wert übereinstimmt (3803, 3800, 3,80 · 10³ bei 3802,75)
export function pruefeGueltig(wert, ziel, n) {
  if (!Number.isFinite(wert)) return false;
  return fastGleich(aufZiffern(wert, n), aufZiffern(ziel, n));
}

// ---------- Zahl · 10ⁿ ----------
const zahl = (t) => {
  const s = String(t ?? '').trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
  return /^-?(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN;
};
export const wertAusPotenz = (mText, eText) => {
  const m = zahl(mText), e = zahl(eText || '0');
  return Number.isFinite(m) && Number.isInteger(e) ? m * 10 ** e : NaN;
};

// antwort: { mantisse, exponent, gueltige_ziffern? }. Gibt { richtig, fehler: { typ, text } | null } zurück.
export function pruefeZehnerpotenz(mText, eText, antwort) {
  const m = zahl(mText), e = zahl(eText);
  if (!Number.isFinite(m) || !Number.isInteger(e)) return { richtig: false, fehler: null, unvollstaendig: true };
  const ziel = antwort.mantisse * 10 ** antwort.exponent;
  const n = antwort.gueltige_ziffern;
  const wertStimmt = n ? pruefeGueltig(m * 10 ** e, ziel, n) : fastGleich(m * 10 ** e, ziel);
  const normal = Math.abs(m) >= 1 && Math.abs(m) < 10;
  if (wertStimmt && normal) {
    // mit gültigen Ziffern: auch die Zahl selbst auf n Ziffern vergleichen
    if (!n || pruefeGueltig(m, antwort.mantisse, n)) return { richtig: true, fehler: null };
  }
  if (wertStimmt && !normal) return { richtig: false, fehler: { typ: 'zp-form', text: 'Vor dem Komma steht genau eine Ziffer, die nicht 0 ist.' } };
  if (fastGleich(m, antwort.mantisse) && e === -antwort.exponent && e !== 0) {
    return { richtig: false, fehler: { typ: 'zp-vorzeichen', text: 'Schau auf die Richtung: Komma nach links → Hochzahl positiv, Komma nach rechts → Hochzahl negativ.' } };
  }
  if (fastGleich(m, antwort.mantisse) && e !== antwort.exponent) return { richtig: false, fehler: { typ: 'zp-hochzahl', text: 'Die Zahl stimmt. Zähle noch einmal, um wie viele Stellen das Komma wandert.' } };
  return { richtig: false, fehler: null };
}

// Text für eine Zahl in Zehnerpotenz-Schreibweise: 1,496 · 10⁸
const HOCH = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export const hoch = (n) => String(n).split('').map(c => HOCH[c] || c).join('');
export function potenzText(m, e, n = null) {
  const mt = n ? aufZiffern(m, n).toFixed(Math.max(0, n - 1)) : String(m);
  return `${mt.replace('.', ',')} · 10${hoch(e)}`;
}
// Wert in normierte Schreibweise zerlegen
export function zerlege(x) {
  if (x === 0) return { m: 0, e: 0 };
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (Math.abs(m) >= 10 - 1e-12) { m /= 10; e++; }
  return { m: Math.round(m * 1e10) / 1e10, e };
}

// ---------- Formeln (Gleichungen umstellen) ----------
// Zerlegt einen Ausdruck in Zeichen. variablen: erlaubte Größen (auch mehrbuchstabig wie F_G).
const OPS = { '+': '+', '−': '-', '-': '-', '·': '*', '*': '*', '×': '*', ':': '/', '/': '/', '÷': '/' };
export function zerlegeFormel(text, variablen = []) {
  const s = String(text).replace(/\s+/g, '');
  const namen = [...variablen].sort((a, b) => b.length - a.length);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const name = namen.find(v => s.startsWith(v, i));
    if (name) { out.push({ t: 'var', v: name }); i += name.length; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < s.length && /[0-9,.]/.test(s[j])) j++; out.push({ t: 'zahl', v: Number(s.slice(i, j).replace(',', '.')) }); i = j; continue; }
    if (OPS[c]) { out.push({ t: 'op', v: OPS[c] }); i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    if (c === '²' || c === '³') { out.push({ t: 'hoch', v: c === '²' ? 2 : 3 }); i++; continue; }
    if (c === '½') { out.push({ t: 'zahl', v: 0.5, halb: true }); i++; continue; }
    if (c === 'π') { out.push({ t: 'zahl', v: Math.PI, pi: true }); i++; continue; }
    if (c === '√') { out.push({ t: 'wurzel' }); i++; continue; }
    if (c === '=') { out.push({ t: '=' }); i++; continue; }
    return null; // unbekanntes Zeichen
  }
  return out;
}

// Baum aus Zeichen (Punkt vor Strich, Klammern, Hoch 2/3, Malpunkt darf fehlen)
export function parseFormel(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const expr = () => {
    let l = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = tokens[i++].v; l = { op, l, r: term() }; }
    return l;
  };
  const startFaktor = (t) => t && (t.t === 'zahl' || t.t === 'var' || t.t === '(' || t.t === 'wurzel');
  const term = () => {
    let l = unaer();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { i++; l = { op: t.v, l, r: unaer() }; }
      else if (startFaktor(t)) l = { op: '*', l, r: unaer(), impl: true };
      else return l;
    }
  };
  const unaer = () => {
    if (peek() && peek().t === 'op' && peek().v === '-') { i++; return { op: 'neg', l: unaer() }; }
    return potenz();
  };
  const potenz = () => {
    let b = atom();
    while (peek() && peek().t === 'hoch') b = { op: '^', l: b, n: tokens[i++].v };
    return b;
  };
  const atom = () => {
    const t = tokens[i++];
    if (!t) throw new Error('Ausdruck endet zu früh');
    if (t.t === 'zahl') return { zahl: t.v, pi: !!t.pi, ...(t.halb ? { halb: true } : {}) };
    if (t.t === 'var') return { name: t.v };
    if (t.t === 'wurzel') return { op: 'sqrt', l: potenz() };
    if (t.t === '(') { const e = expr(); if (!peek() || peek().t !== ')') throw new Error('Klammer fehlt'); i++; return { op: '()', l: e }; }
    throw new Error('Unerwartetes Zeichen');
  };
  const baum = expr();
  if (i !== tokens.length) throw new Error('Rest übrig');
  return baum;
}

export function rechne(b, werte) {
  if ('zahl' in b) return b.zahl;
  if ('name' in b) return werte[b.name];
  switch (b.op) {
    case '+': return rechne(b.l, werte) + rechne(b.r, werte);
    case '-': return rechne(b.l, werte) - rechne(b.r, werte);
    case '*': return rechne(b.l, werte) * rechne(b.r, werte);
    case '/': return rechne(b.l, werte) / rechne(b.r, werte);
    case 'neg': return -rechne(b.l, werte);
    case '^': return rechne(b.l, werte) ** b.n;
    case '()': return rechne(b.l, werte);
    case 'sqrt': return Math.sqrt(rechne(b.l, werte));
  }
  return NaN;
}

const formelBaum = (text, variablen) => { const t = zerlegeFormel(text, variablen); return t ? parseFormel(t) : null; };
function proben(variablen, rng) {
  return Array.from({ length: 5 }, () => Object.fromEntries(variablen.map(v => [v, 0.5 + rng() * 8.5])));
}
// Eingabe: Text der rechten Seite (oder ganze Gleichung „V = m : ρ“). antwort: { ziel, formel, variablen }
// Gibt { richtig, fehler, gueltig } zurück.
export function pruefeFormel(eingabe, antwort, rng = Math.random) {
  const vars = antwort.variablen || [];
  let tokens = zerlegeFormel(eingabe, [...vars, antwort.ziel]);
  if (!tokens || !tokens.length) return { richtig: false, gueltig: false, fehler: null };
  const gl = tokens.findIndex(t => t.t === '=');
  if (gl >= 0) {
    const links = tokens.slice(0, gl);
    if (links.length !== 1 || links[0].t !== 'var' || links[0].v !== antwort.ziel) return { richtig: false, gueltig: true, fehler: { typ: 'formel-links', text: `Links vom = steht nur die gesuchte Größe ${antwort.ziel}.` } };
    tokens = tokens.slice(gl + 1);
  }
  if (tokens.some(t => t.t === 'var' && t.v === antwort.ziel)) return { richtig: false, gueltig: true, fehler: { typ: 'formel-ziel-rechts', text: `${antwort.ziel} darf rechts nicht mehr vorkommen.` } };
  let baum, soll;
  try { baum = parseFormel(tokens); soll = formelBaum(antwort.formel, vars); } catch (e) { return { richtig: false, gueltig: false, fehler: null }; }
  const pr = proben(vars, rng);
  const ist = pr.map(w => rechne(baum, w)), ziel = pr.map(w => rechne(soll, w));
  if (ist.some(x => !Number.isFinite(x))) return { richtig: false, gueltig: true, fehler: null };
  const rel = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if (ist.every((x, k) => rel(x, ziel[k]))) return { richtig: true, gueltig: true, fehler: null };
  if (ist.every((x, k) => rel(x, 1 / ziel[k]))) return { richtig: false, gueltig: true, fehler: { typ: 'formel-kehrwert', text: probeText(antwort, soll) } };
  return { richtig: false, gueltig: true, fehler: { typ: 'formel', text: `Schau, was mit ${antwort.ziel} passiert, und mach es auf beiden Seiten rückgängig.` } };
}
// „Probe: Setze m = 6 und ρ = 2 ein. Passt V = 3?“
function probeText(antwort, soll) {
  const vars = antwort.variablen || [];
  const zahlen = [6, 2, 3, 4, 5];
  const w = Object.fromEntries(vars.map((v, k) => [v, zahlen[k] || 2]));
  const x = rechne(soll, w);
  const xt = String(Math.round(x * 1000) / 1000).replace('.', ',');
  const liste = vars.map(v => `${v} = ${w[v]}`);
  const teil = liste.length > 1 ? `${liste.slice(0, -1).join(', ')} und ${liste[liste.length - 1]}` : liste[0];
  return `Probe: Setze ${teil} ein. Passt ${antwort.ziel} = ${xt}?`;
}

// Baum als HTML mit echten Brüchen (für die Anzeige der Eingabe)
export function formelHtml(b, esc = (s) => s, name = (n) => n) {
  const inner = (x) => formelHtml(x, esc, name);
  if (!b) return '';
  if ('zahl' in b) return b.pi ? 'π' : b.halb ? '½' : String(b.zahl).replace('.', ',');
  if ('name' in b) return name(b.name);
  switch (b.op) {
    case '+': return `${inner(b.l)} + ${inner(b.r)}`;
    case '-': return `${inner(b.l)} − ${inner(b.r)}`;
    // „3x“ und „2(x + 3)“ ohne Malpunkt, wie geschrieben
    case '*': return b.impl && 'zahl' in b.l && !b.l.pi ? `${inner(b.l)}${inner(b.r)}` : `${inner(b.l)} · ${inner(b.r)}`;
    case '/': {
      const ohneKl = (x) => { while (x && x.op === '()') x = x.l; return x; };
      return `<span class="fr2"><span>${inner(ohneKl(b.l))}</span><span>${inner(ohneKl(b.r))}</span></span>`;
    }
    case 'neg': return `−${inner(b.l)}`;
    case '^': return `${inner(b.l)}<sup>${b.n}</sup>`;
    case '()': {
      // Klammern um einen Bruch oder eine Wurzel braucht man in der zweizeiligen Anzeige nicht
      let k = b.l; while (k && k.op === '()') k = k.l;
      return k && (k.op === '/' || k.op === 'sqrt' || 'name' in k || 'zahl' in k) ? inner(k) : `(${inner(b.l)})`;
    }
    case 'sqrt': { let k = b.l; while (k && k.op === '()') k = k.l; return `<span class="wurzel">√<span>${inner(k)}</span></span>`; }
  }
  return '';
}

// Ganze Gleichung („(2x + 1)/3 = (x + 4)/2“, „ρ = m/V“) mit echten Brüchen. Geht das Lesen nicht, kommt null.
export function gleichungHtml(text, variablen = [], esc = (s) => s, name = (n) => n) {
  const seiten = String(text).split('=');
  try {
    const teile = seiten.map(t => { const tk = zerlegeFormel(t, variablen); if (!tk || !tk.length) throw new Error('leer'); return formelHtml(parseFormel(tk), esc, name); });
    return teile.join(' = ');
  } catch (e) { return null; }
}
// Buchstaben einer Gleichung (für Anzeige): einzelne Buchstaben, F_G, v₀, griechische
export function variablenIn(text) {
  return [...new Set(String(text).match(/F_G|A_[GMO]|v₀|[A-Za-zρπ](?![a-zäöüß])/g) || [])].filter(v => v !== 'π');
}
