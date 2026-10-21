// „In Schritten umformen“ (Auftrag 14, Teil 4): reine Logik ohne DOM, testbar mit node.
// Gleichungen stehen als Text in der Schreibweise von physik.js (Brüche als „(a)/(b)“, Wurzel „√(…)“).
import { zerlegeFormel, parseFormel, rechne, variablenIn } from './physik.js';

const M = '−';

// ---------- Lesen und Rechnen ----------
export function baum(text, vars) {
  const t = zerlegeFormel(String(text), vars);
  if (!t || !t.length) return null;
  try { return parseFormel(t); } catch (e) { return null; }
}
export function seiten(gleichung) {
  const teile = String(gleichung).split('=');
  return teile.length === 2 ? { l: teile[0].trim(), r: teile[1].trim() } : null;
}
// Größen einer Aufgabe: Formel-Aufgaben aus der Rechnung, Gleichungen mit x
export function groessenVon(a) {
  const r = String(a.rechnung || '');
  const v = new Set(variablenIn(r));
  if (a.antwort && Array.isArray(a.antwort.variablen)) a.antwort.variablen.forEach(x => v.add(x));
  if (a.antwort && a.antwort.ziel) v.add(a.antwort.ziel);
  if (/x/.test(r)) v.add('x');
  return [...v].filter(x => x !== 'π');
}
// Gesuchte Größe: bei Formeln antwort.ziel, bei Gleichungen x
export function zielVon(a) {
  if (a.typ === 'formel' && a.antwort && a.antwort.ziel) return a.antwort.ziel;
  return /x/.test(String(a.rechnung || '')) ? 'x' : null;
}
// Kann diese Aufgabe in Schritten umgeformt werden?
export function umformbar(a) {
  if (!a || a.thema !== 'umstellen' || !['zahl', 'formel'].includes(a.typ)) return false;
  const s = seiten(a.rechnung || '');
  const z = zielVon(a);
  if (!s || !z) return false;
  const vars = groessenVon(a);
  return !!(baum(s.l, vars) && baum(s.r, vars));
}

// Zufallswerte (0,5 bis 9), Konstanten wie π sind echte Zahlen (stehen als Zahl im Baum)
function proben(vars, n, rng) {
  return Array.from({ length: n }, () => Object.fromEntries(vars.map(v => [v, 0.5 + rng() * 8.5])));
}
// Sind zwei Terme gleichwertig? Proben, bei denen etwas nicht definiert ist (z. B. Teilen durch 0), zählen nicht.
export function gleichwertig(a, b, vars, rng = Math.random) {
  const ba = typeof a === 'string' ? baum(a, vars) : a, bb = typeof b === 'string' ? baum(b, vars) : b;
  if (!ba || !bb) return null;
  let gut = 0;
  for (const w of proben(vars, 12, rng)) {
    const x = rechne(ba, w), y = rechne(bb, w);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x - y) > 1e-7 * Math.max(1, Math.abs(x), Math.abs(y))) return false;
    gut++;
  }
  return gut >= 4;
}
// Kommt die Größe im Term vor?
export function enthaelt(text, groesse, vars) {
  const t = zerlegeFormel(String(text), vars);
  return !!(t && t.some(x => x.t === 'var' && x.v === groesse));
}
export function istAllein(text, groesse, vars) {
  const t = zerlegeFormel(String(text), vars);
  return !!(t && t.length === 1 && t[0].t === 'var' && t[0].v === groesse);
}

// ---------- Umformungen ----------
// { art: 'op', op: '+'|'-'|'*'|'/', term } | { art: 'tauschen' } | { art: 'klammer' } | { art: 'wurzel' }
const OP_ZEICHEN = { '+': '+', '-': M, '*': '·', '/': ':' };
export function umformungText(u) {
  if (!u) return '';
  if (u.art === 'tauschen') return 'Seiten tauschen';
  if (u.art === 'klammer') return 'Klammer auflösen';
  if (u.art === 'wurzel') return '√';
  const t = String(u.term).trim();
  const kl = (u.op === '*' || u.op === '/') && /[+\-−]/.test(t.replace(/^[−-]/, '')) ? `(${t})` : t;
  return `${OP_ZEICHEN[u.op]} ${kl}`;
}
// Steht oben auf der Ebene eine Summe? Dann braucht der Term beim Malnehmen Klammern.
function summe(text, vars) {
  const b = baum(text, vars);
  if (!b) return true;
  let k = b; while (k.op === '()') k = k.l;
  return k.op === '+' || k.op === '-';
}
const kl = (text, vars) => (summe(text, vars) ? `(${text})` : text);
// Die Umformung auf eine Seite anwenden, noch nicht vereinfacht
export function anwenden(seite, u, vars) {
  if (u.art === 'klammer') return seite;
  if (u.art === 'wurzel') return `√(${seite})`;
  const t = String(u.term).trim();
  if (u.op === '+') return `${seite} + ${t}`;
  if (u.op === '-') return `${seite} - ${t}`;
  if (u.op === '*') return `${kl(seite, vars)} · ${kl(t, vars)}`;
  return `(${seite})/(${t})`;
}
// Umformung aus einer Zeile des Lösungswegs („2A = g · h   | : g“) lesen
export function umformungAus(text) {
  const s = String(text || '').trim().replace(/[−–]/g, '-');
  if (!s) return null;
  if (/^klammer/i.test(s)) return { art: 'klammer' };
  if (/^seiten/i.test(s)) return { art: 'tauschen' };
  if (s === '√') return { art: 'wurzel' };
  const m = /^([+\-·:*/])\s*(.+)$/.exec(s);
  if (!m) return null;
  const op = { '+': '+', '-': '-', '·': '*', '*': '*', ':': '/', '/': '/' }[m[1]];
  let term = m[2].trim();
  if ((op === '*' || op === '/') && /^\(.*\)$/.test(term)) term = term.slice(1, -1).trim();
  return { art: 'op', op, term: term.replace(/-/g, M) };
}
// Lösungsweg: Gleichungen und Umformungen. Zeilen ohne „|“ sind Zwischenergebnisse.
export function wegVon(a) {
  return (a.loesungsweg || []).map(z => {
    const [gl, um] = String(z).split('|');
    return { gleichung: gl.trim(), umformung: um ? um.trim() : null };
  });
}
export function noetigeSchritte(a) {
  const n = wegVon(a).filter(z => z.umformung).length;
  return n || 2;
}
// Vorschlag für den nächsten Schritt (aus dem Lösungsweg): passende Zeile zur aktuellen Gleichung, sonst der k-te Schritt
export function vorschlag(a, aktuell, k, vars) {
  const weg = wegVon(a).filter(z => z.umformung);
  // zuerst die Zeile, die genau so dasteht, sonst die späteste gleichwertige (gleichwertig sind z. B. auch Zeilen vor und nach „Klammer auflösen“)
  const n = (t) => String(t).replace(/\s+/g, '').replace(/[−–]/g, '-');
  for (const z of weg) { const s = seiten(z.gleichung); if (s && n(s.l) === n(aktuell.l) && n(s.r) === n(aktuell.r)) return z.umformung; }
  for (const z of [...weg].reverse()) {
    const s = seiten(z.gleichung);
    if (s && gleichwertigGl(s, aktuell, vars)) return z.umformung;
  }
  return weg[k] ? weg[k].umformung : null;
}
function gleichwertigGl(s, t, vars) {
  return (gleichwertig(s.l, t.l, vars) && gleichwertig(s.r, t.r, vars)) || (gleichwertig(s.l, t.r, vars) && gleichwertig(s.r, t.l, vars));
}

// ---------- Vereinfachen (für Hilfe-Stufe 1 und 2) ----------
// Normalform: Summe von Gliedern, Glied = Zahl · Produkt von Faktoren mit Hochzahl.
// Faktoren sind Größen, π oder nicht weiter zerlegbare Teile (Summe im Nenner, Wurzel einer Summe).
function glied(coef, f = new Map()) { return { coef, f }; }
const schluessel = (f) => [...f.entries()].filter(([, e]) => e !== 0).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, e]) => `${k}^${e}`).join('*');
function summeVon(glieder) {
  const m = new Map();
  for (const g of glieder) {
    const f = new Map([...g.f].filter(([, e]) => e !== 0));
    const k = schluessel(f);
    const alt = m.get(k);
    if (alt) alt.coef += g.coef; else m.set(k, glied(g.coef, f));
  }
  return [...m.values()].filter(g => Math.abs(g.coef) > 1e-12);
}
function mal(a, b) {
  const out = [];
  for (const x of a) for (const y of b) {
    const f = new Map(x.f);
    for (const [k, e] of y.f) f.set(k, (f.get(k) || 0) + e);
    out.push(glied(x.coef * y.coef, f));
  }
  return summeVon(out);
}
const ATOME = new Map(); // Schlüssel → Text für zusammengesetzte Faktoren
function atom(text) { const k = `[${text}]`; ATOME.set(k, text); return k; }
function norm(b) {
  if ('zahl' in b) return b.pi ? [glied(1, new Map([['π', 1]]))] : [glied(b.zahl)];
  if ('name' in b) return [glied(1, new Map([[b.name, 1]]))];
  switch (b.op) {
    case '()': return norm(b.l);
    case '+': return summeVon([...norm(b.l), ...norm(b.r)]);
    case '-': return summeVon([...norm(b.l), ...norm(b.r).map(g => glied(-g.coef, g.f))]);
    case 'neg': return norm(b.l).map(g => glied(-g.coef, g.f));
    case '*': return mal(norm(b.l), norm(b.r));
    case '^': { let p = [glied(1)]; const n = norm(b.l); for (let i = 0; i < b.n; i++) p = mal(p, n); return p; }
    case '/': {
      const z = norm(b.l), n = norm(b.r);
      if (n.length === 1) {
        const inv = glied(1 / n[0].coef, new Map([...n[0].f].map(([k, e]) => [k, -e])));
        return mal(z, [inv]);
      }
      return mal(z, [glied(1, new Map([[atom(text(n)), -1]]))]);
    }
    case 'sqrt': {
      const n = norm(b.l);
      if (n.length === 1 && n[0].coef >= 0 && [...n[0].f.values()].every(e => e % 2 === 0)) {
        return [glied(Math.sqrt(n[0].coef), new Map([...n[0].f].map(([k, e]) => [k, e / 2])))];
      }
      return [glied(1, new Map([[atom(`√(${text(n)})`), 1]]))];
    }
  }
  return [glied(NaN)];
}
// Bruch p/q mit kleinem Nenner finden
function bruch(x) {
  for (let q = 1; q <= 24; q++) { const p = Math.round(x * q); if (Math.abs(p / q - x) < 1e-9) return [p, q]; }
  return null;
}
const zahlText = (x) => String(Math.round(x * 1e9) / 1e9).replace('.', ',');
const HOCH = { 2: '²', 3: '³' };
function faktorText(k, e) {
  const n = ATOME.has(k) ? `(${ATOME.get(k)})` : k;
  if (e === 1) return n;
  if (HOCH[e]) return n + HOCH[e];
  return Array(e).fill(n).join(' · ');
}
function gliedText(g, ersterOhneVorzeichen) {
  const pos = [...g.f].filter(([, e]) => e > 0), neg = [...g.f].filter(([, e]) => e < 0);
  let c = Math.abs(g.coef), cz = null, cn = 1;
  const br = bruch(c);
  if (br) { cz = br[0]; cn = br[1]; } else cz = c;
  const fz = pos.map(([k, e]) => faktorText(k, e));
  const fn = neg.map(([k, e]) => faktorText(k, -e));
  let z;
  if (!fz.length) z = zahlText(cz);
  else if (cz === 1) z = fz.join(' · ');
  else z = /^[A-Za-zρπ]/.test(fz[0]) && fz[0].length === 1 ? `${zahlText(cz)}${fz.join(' · ')}` : `${zahlText(cz)} · ${fz.join(' · ')}`;
  const nenner = [...(cn !== 1 ? [String(cn)] : []), ...fn];
  const t = nenner.length ? `(${z})/(${nenner.join(' · ')})` : z;
  return { t, neg: g.coef < 0 };
}
function text(glieder) {
  if (!glieder.length) return '0';
  return glieder.map((g, i) => {
    const { t, neg } = gliedText(g);
    if (i === 0) return neg ? `-${t}` : t;
    return neg ? ` - ${t}` : ` + ${t}`;
  }).join('');
}
// Zeichen ohne Klammern zählen (zum Vergleich: ist die vereinfachte Form wirklich kürzer?)
function laenge(t, vars) { const z = zerlegeFormel(t, vars); return z ? z.filter(x => x.t !== '(' && x.t !== ')').length : 999; }
export function vereinfachen(t, vars) {
  const b = baum(t, vars);
  if (!b) return t;
  // Ohne Größen: als Zahl (4,25 statt 17/4), wenn sie kurz ist
  if (!zerlegeFormel(t, vars).some(x => x.t === 'var' || x.pi)) {
    const w = rechne(b, {});
    if (Number.isFinite(w) && Math.abs(w * 1e4 - Math.round(w * 1e4)) < 1e-6) return (w < 0 ? '-' : '') + zahlText(Math.abs(w));
  }
  let n;
  try { n = text(norm(b)); } catch (e) { return t; }
  if (!baum(n, vars) || gleichwertig(n, t, vars) === false) return t;
  return laenge(n, vars) <= laenge(t, vars) ? n : t;
}
// Klammer auflösen: ganz ausmultiplizieren
export function ausmultiplizieren(t, vars) {
  const b = baum(t, vars);
  if (!b) return t;
  try { const n = text(norm(b)); return baum(n, vars) && gleichwertig(n, t, vars) !== false ? n : t; } catch (e) { return t; }
}
// Ergebnis eines Schritts, wie die App es eintragen würde (Hilfe-Stufe 1).
// Passt die Umformung zum Lösungsweg der Aufgabe, nimmt die App die nächste Zeile von dort (so wie im Heft).
export function ergebnisMitWeg(a, gl, u, roh, vars) {
  const weg = wegVon(a);
  for (let i = 0; i < weg.length - 1; i++) {
    const s = seiten(weg[i].gleichung), w = umformungAus(weg[i].umformung);
    if (!s || !w || !gleicheUmformung(w, u, vars) || !gleichwertigGl(s, gl, vars)) continue;
    const n = seiten(weg[i + 1].gleichung);
    if (!n) continue;
    if (gleichwertig(n.l, roh.l, vars) && gleichwertig(n.r, roh.r, vars)) return { l: n.l, r: n.r };
    if (gleichwertig(n.l, roh.r, vars) && gleichwertig(n.r, roh.l, vars)) return { l: n.r, r: n.l };
  }
  return ergebnis(roh, u, vars);
}
export function gleicheUmformung(a, b, vars) {
  if (!a || !b || a.art !== b.art) return false;
  if (a.art !== 'op') return true;
  return a.op === b.op && gleichwertig(a.term, b.term, vars) === true;
}
export function ergebnis(roh, u, vars) {
  return u.art === 'klammer' ? { l: ausmultiplizieren(roh.l, vars), r: ausmultiplizieren(roh.r, vars) } : { l: vereinfachen(roh.l, vars), r: vereinfachen(roh.r, vars) };
}
// Hilfe-Stufe 2: Welche Seite schreibt die App? Die Seite ohne die gesuchte Größe, sonst die linke.
export function appSeite(roh, ziel, vars) {
  if (!enthaelt(roh.l, ziel, vars)) return 'l';
  if (!enthaelt(roh.r, ziel, vars)) return 'r';
  return 'l';
}

// ---------- Fertig? ----------
// Die gesuchte Größe steht allein auf einer Seite und kommt auf der anderen nicht vor.
export function fertig(gl, ziel, vars) {
  if (istAllein(gl.l, ziel, vars) && !enthaelt(gl.r, ziel, vars)) return { seite: 'l', loesung: gl.r };
  if (istAllein(gl.r, ziel, vars) && !enthaelt(gl.l, ziel, vars)) return { seite: 'r', loesung: gl.l };
  return null;
}
// Stimmt das Endergebnis mit der Antwort überein?
export function endePruefen(a, loesung, vars) {
  if (a.typ === 'formel') return gleichwertig(loesung, a.antwort.formel, vars) === true;
  const b = baum(loesung, vars);
  const w = b ? rechne(b, {}) : NaN;
  return Number.isFinite(w) && Math.abs(w - a.antwort.wert) < 1e-9 * Math.max(1, Math.abs(w));
}

// ---------- Eingabe mit echten Brüchen (Formel-Tastatur) ----------
// Flache Liste von Zeichen mit Struktur-Zeichen: ⟨B Bruch-Anfang, ⟨T Bruchstrich, ⟩B Bruch-Ende, ⟨W Wurzel-Anfang, ⟩W Wurzel-Ende.
// Cursor c = Position zwischen den Zeichen.
export const leer = () => ({ t: [], c: 0 });
const STRUKTUR = new Set(['⟨B', '⟨T', '⟩B', '⟨W', '⟩W']);
export function tippen(ed, k) {
  if (k === '⌫') return loeschen(ed);
  if (k === '←') { ed.c = Math.max(0, ed.c - 1); return ed; }
  if (k === '→') { ed.c = Math.min(ed.t.length, ed.c + 1); return ed; }
  if (k === 'bruch') { ed.t.splice(ed.c, 0, '⟨B', '⟨T', '⟩B'); ed.c += 1; return ed; }
  if (k === '√') { ed.t.splice(ed.c, 0, '⟨W', '⟩W'); ed.c += 1; return ed; }
  if (ed.t.length >= 60) return ed;
  ed.t.splice(ed.c, 0, k); ed.c += 1;
  return ed;
}
function loeschen(ed) {
  if (ed.c === 0) return ed;
  const z = ed.t[ed.c - 1];
  if (!STRUKTUR.has(z)) { ed.t.splice(ed.c - 1, 1); ed.c -= 1; return ed; }
  // Leeren Bruch bzw. leere Wurzel ganz entfernen, sonst nur nach links
  if (z === '⟨B' && ed.t[ed.c] === '⟨T' && ed.t[ed.c + 1] === '⟩B') { ed.t.splice(ed.c - 1, 3); ed.c -= 1; return ed; }
  if (z === '⟨W' && ed.t[ed.c] === '⟩W') { ed.t.splice(ed.c - 1, 2); ed.c -= 1; return ed; }
  ed.c -= 1;
  return ed;
}
export function setzen(text) { return { t: tokens(text), c: tokens(text).length }; }
function tokens(text) {
  return String(text).match(/F_G|A_[GMO]|v₀|\d|[A-Za-zρπ]|[,+\-−·:*/()²³√]/g)?.map(x => (x === '-' ? M : x === '*' ? '·' : x)) || [];
}
// Text der Eingabe für die Prüfung (Brüche als „((a)/(b))“)
export function alsText(ed) {
  return ed.t.map(z => ({ '⟨B': '((', '⟨T': ')/(', '⟩B': '))', '⟨W': '√(', '⟩W': ')' }[z] || z)).join(' ').replace(/\s+/g, ' ').trim();
}
export const istLeer = (ed) => !ed.t.some(z => !STRUKTUR.has(z));
// Baum der Eingabe für die Anzeige: [{z} | {bruch: [seq, seq]} | {wurzel: seq} | {cursor}]
// Jedes Zeichen hat p (Cursor-Stelle davor), jede Folge die Stellen start und ende (nicht aufzählbar), zum Antippen.
export function struktur(ed, mitCursor = true) {
  let i = 0;
  const marke = (out, start, ende) => { Object.defineProperty(out, 'start', { value: start }); Object.defineProperty(out, 'ende', { value: ende }); return out; };
  const seq = (ende) => {
    const out = [], start = i;
    while (i <= ed.t.length) {
      if (mitCursor && i === ed.c) out.push({ cursor: true });
      if (i === ed.t.length) { const e = i; i++; return marke(out, start, e); }
      const z = ed.t[i];
      if (ende.includes(z)) return marke(out, start, i);
      const p = i;
      i++;
      if (z === '⟨B') { const zae = seq(['⟨T']); i++; const nen = seq(['⟩B']); i++; out.push({ bruch: [zae, nen], p }); }
      else if (z === '⟨W') { const w = seq(['⟩W']); i++; out.push({ wurzel: w, p }); }
      else out.push({ z, p });
    }
    return marke(out, start, i);
  };
  return seq([]);
}
// Cursor an eine Stelle setzen (nach Antippen)
export function cursorAuf(ed, p) { ed.c = Math.max(0, Math.min(ed.t.length, Number(p) || 0)); return ed; }

// ---------- Bausteine zum Wählen der Umformung ----------
// Glieder der Summen, ihre Faktoren, Nenner und „was mit der gesuchten Größe malgenommen ist“
export function knotenText(b) {
  if (!b) return '';
  if ('zahl' in b) return b.pi ? 'π' : b.halb ? '½' : String(b.zahl).replace('.', ',');
  if ('name' in b) return b.name;
  const kl = (x) => (x && (x.op === '+' || x.op === '-') ? `(${knotenText(x)})` : knotenText(x));
  switch (b.op) {
    case '()': { const k = ohneKl(b); return k.op === '/' || 'name' in k || 'zahl' in k ? knotenText(k) : `(${knotenText(k)})`; }
    case '+': return `${knotenText(b.l)} + ${knotenText(b.r)}`;
    case '-': return `${knotenText(b.l)} ${M} ${kl(b.r)}`;
    case 'neg': return `${M}${kl(b.l)}`;
    case '*': return b.impl && 'zahl' in b.l ? `${knotenText(b.l)}${kl(b.r)}` : `${kl(b.l)} · ${kl(b.r)}`;
    case '/': { const a = (x) => { x = ohneKl(x); return 'name' in x || 'zahl' in x || x.op === '^' ? knotenText(x) : `(${knotenText(x)})`; }; return `${a(b.l)}/${a(b.r)}`; }
    case '^': return `${kl(b.l)}${b.n === 2 ? '²' : '³'}`;
    case 'sqrt': return `√(${knotenText(b.l)})`;
  }
  return '';
}
const ohneKl = (b) => { while (b && b.op === '()') b = b.l; return b; };
function glieder(b) {
  b = ohneKl(b);
  if (b.op === '+') return [...glieder(b.l), ...glieder(b.r)];
  if (b.op === '-') return [...glieder(b.l), ...glieder(b.r)];
  if (b.op === 'neg') return glieder(b.l);
  return [b];
}
function faktoren(b) {
  b = ohneKl(b);
  if (b.op === '*') return [...faktoren(b.l), ...faktoren(b.r)];
  if (b.op === '/') return [...faktoren(b.l), { nenner: ohneKl(b.r) }];
  return [b];
}
export function bausteine(gl, ziel, vars) {
  const out = [];
  const dazu = (t) => { t = String(t).trim(); if (t && t !== '1' && !out.includes(t)) out.push(t); };
  for (const s of [gl.l, gl.r]) {
    const b = baum(s, vars);
    if (!b) continue;
    for (const g of glieder(b)) {
      const f = faktoren(g);
      const mitZiel = enthaelt(knotenText(g), ziel, vars);
      if (f.length > 1 || g.op === '/') dazu(knotenText(g));
      for (const x of f) dazu(knotenText(x.nenner || x));
      // was mit der gesuchten Größe malgenommen ist (z. B. π · r² bei π · r² · h)
      if (mitZiel) {
        const rest = f.filter(x => !x.nenner && !enthaelt(knotenText(x), ziel, vars));
        if (rest.length > 1) dazu(rest.map(knotenText).join(' · '));
      }
    }
  }
  // Größen zuerst, dann Zahlen, dann zusammengesetzte Terme
  const art = (t) => (/^[\d,½]+$/.test(t) ? 1 : vars.includes(t) || t === 'π' ? 0 : 2);
  return out.sort((a, b) => art(a) - art(b)).slice(0, 10);
}

// Lesbarer Text für Protokoll und Eltern-App: „(v − v₀)/a“ statt „(( v − v₀ )/( a ))“
export function lesbar(t, vars) {
  const b = baum(t, vars);
  return b ? knotenText(ohneKl(b)) : String(t);
}
