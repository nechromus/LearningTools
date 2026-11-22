// Lösungsweg Zeile für Zeile (Thema „trig-weg“, Wunsch Eltern 22.11.): reine Logik ohne DOM, testbar mit node.
// Eine Zeile ist eine Gleichung „links = rechts“ oder „links ≈ rechts“ mit einer Unbekannten (x oder α/β).
// Prüfung: wahr (genauer Wert der Unbekannten eingesetzt), Etappe (Formel, Wert, Umkehr, Umgestellt, Ergebnis),
// sinnvoll (passende bzw. spätere Etappe, nicht nur wahr) und bei falschen Zeilen die typische Fehlerart.

const KG = Math.PI / 180;
export const FN = {
  sin: (g) => Math.sin(g * KG), cos: (g) => Math.cos(g * KG), tan: (g) => Math.tan(g * KG),
  'sin⁻¹': (x) => Math.asin(x) / KG, 'cos⁻¹': (x) => Math.acos(x) / KG, 'tan⁻¹': (x) => Math.atan(x) / KG
};
const RANG = { formel: 1, wert: 2, umkehr: 3, umgestellt: 3, ergebnis: 4 };
export const ETAPPE_NAME = { formel: 'Formel', wert: 'Wert', umkehr: 'Winkel mit 2nd', umgestellt: 'Umgestellt', ergebnis: 'Ergebnis' };

// ---------- Zerlegen ----------
// Zeichen: Zahl (Komma), Funktion (sin, cos, tan, sin⁻¹ …), Unbekannte (x, α, β), ° (wird überlesen), · : + − ( ) = ≈
export function zerlegen(text, unbekannt) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const f = /^(sin|cos|tan)(⁻¹|\^-1)?/.exec(s.slice(i));
    if (f) { out.push({ t: 'fn', v: f[1] + (f[2] ? '⁻¹' : '') }); i += f[0].length; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < s.length && /[0-9,]/.test(s[j])) j++; const roh = s.slice(i, j); if ((roh.match(/,/g) || []).length > 1 || roh.endsWith(',')) return null; out.push({ t: 'zahl', v: Number(roh.replace(',', '.')), stellen: roh.includes(',') ? roh.split(',')[1].length : 0, roh }); i = j; continue; }
    if (c === unbekannt || (unbekannt === 'α' && c === 'α') || (unbekannt === 'β' && c === 'β')) { out.push({ t: 'var' }); i++; continue; }
    if (c === '°') { i++; continue; }
    if (s.startsWith('cm', i)) { i += 2; continue; }
    if ('·*×'.includes(c)) { out.push({ t: 'op', v: '*' }); i++; continue; }
    if (':÷/'.includes(c)) { out.push({ t: 'op', v: '/' }); i++; continue; }
    if (c === '+') { out.push({ t: 'op', v: '+' }); i++; continue; }
    if (c === '−' || c === '-') { out.push({ t: 'op', v: '-' }); i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    if (c === '=' || c === '≈') { out.push({ t: 'rel', v: c }); i++; continue; }
    return null;
  }
  return out;
}

// Baum: Punkt vor Strich, Malpunkt darf fehlen, Funktion gilt für das nächste Glied (sin 35°, sin α, sin⁻¹(0,6), sin(6 : 8))
function baum(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const expr = () => {
    let l = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = tokens[i++].v; l = { op, l, r: term() }; }
    return l;
  };
  const start = (t) => t && (t.t === 'zahl' || t.t === 'var' || t.t === '(' || t.t === 'fn');
  const term = () => {
    let l = unaer();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { i++; l = { op: t.v, l, r: unaer() }; }
      else if (start(t)) l = { op: '*', l, r: unaer() };
      else return l;
    }
  };
  const unaer = () => { if (peek() && peek().t === 'op' && peek().v === '-') { i++; return { op: 'neg', l: unaer() }; } return atom(); };
  const atom = () => {
    const t = tokens[i++];
    if (!t) throw new Error('Ende');
    if (t.t === 'zahl') return { zahl: t.v, stellen: t.stellen, roh: t.roh };
    if (t.t === 'var') return { var: true };
    if (t.t === 'fn') return { fn: t.v, l: atom() };
    if (t.t === '(') { const e = expr(); if (!peek() || peek().t !== ')') throw new Error('Klammer'); i++; return { op: '()', l: e }; }
    throw new Error('Zeichen');
  };
  const b = expr();
  if (i !== tokens.length) throw new Error('Rest');
  return b;
}
const ohneKlammer = (b) => (b && b.op === '()' ? ohneKlammer(b.l) : b);

export function rechne(b, u) {
  if (!b) return NaN;
  if ('zahl' in b) return b.zahl;
  if (b.var) return u;
  if (b.fn) return FN[b.fn](rechne(b.l, u));
  const l = rechne(b.l, u), r = b.r ? rechne(b.r, u) : 0;
  switch (b.op) { case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r; case 'neg': return -l; case '()': return l; }
  return NaN;
}
const hat = (b, p) => !!b && (p(b) || hat(b.l, p) || hat(b.r, p));
const hatVar = (b) => hat(b, x => x.var);
const hatFn = (b, inv) => hat(b, x => x.fn && (inv == null || x.fn.endsWith('⁻¹') === inv));

// Zeile lesen: { l, r, rel, text } oder { fehlt: 'rel' | 'seite' | 'zeichen' }
export function zeileLesen(text, unbekannt) {
  const t = zerlegen(text, unbekannt);
  if (!t) return { fehlt: 'zeichen' };
  const rels = t.filter(x => x.t === 'rel');
  if (rels.length !== 1) return { fehlt: 'rel' };
  const k = t.findIndex(x => x.t === 'rel');
  if (k === 0 || k === t.length - 1) return { fehlt: 'seite' };
  try { return { l: baum(t.slice(0, k)), r: baum(t.slice(k + 1)), rel: rels[0].v }; } catch (e) { return { fehlt: 'zeichen' }; }
}

// ---------- Wahr? ----------
// '=': beide Seiten gleich. Eine gerundete Zahl mit „=“ zählt auch (mindestens 2 Stellen beim Wert), dann mit Hinweis „≈“.
// '≈': eine Seite ist eine Zahl; die andere, auf so viele Stellen gerundet, ergibt genau diese Zahl. Abgeschnitten zählt nicht.
const nah = (a, b, d = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= d * Math.max(1, Math.abs(a), Math.abs(b));
const rund = (x, k) => Math.round(x * 10 ** k + 1e-9 * Math.sign(x)) / 10 ** k;
const ab = (x, k) => Math.trunc(x * 10 ** k + 1e-9 * Math.sign(x)) / 10 ** k;
export function wahrheit(z, u) {
  const L = rechne(z.l, u), R = rechne(z.r, u);
  if (!Number.isFinite(L) || !Number.isFinite(R)) return { wahr: false, L, R };
  const lit = (b) => { const o = ohneKlammer(b); return o && 'zahl' in o ? o : null; };
  const zahl = lit(z.r) ? { n: lit(z.r), w: L } : lit(z.l) ? { n: lit(z.l), w: R } : null;
  if (nah(L, R)) return { wahr: true, L, R, gerundet: false, ...(zahl ? { stellen: zahl.n.stellen } : {}) };
  if (zahl) {
    const k = zahl.n.stellen;
    if (Math.abs(rund(zahl.w, k) - zahl.n.zahl) < 1e-9 && (k >= 1 || Math.abs(zahl.w) >= 10)) return { wahr: true, L, R, gerundet: true, stellen: k, mitGleich: z.rel === '=' };
    if (k >= 1 && Math.abs(ab(zahl.w, k) - zahl.n.zahl) < 1e-9) return { wahr: false, L, R, abgeschnitten: true, stellen: k };
  }
  // Gerundete Zwischenwerte (z. B. α = sin⁻¹(0,2917)): so viel Abweichung, wie das Runden dieser Zahlen ausmachen kann
  const tol = rundToleranz(z, u);
  if (tol > 0 && Math.abs(L - R) <= tol) return { wahr: true, L, R, gerundet: true, mitGleich: z.rel === '=' };
  return { wahr: false, L, R };
}
function rundToleranz(z, u) {
  const lits = [];
  const sammle = (b) => { if (!b) return; if ('zahl' in b && b.stellen >= 2) lits.push(b); sammle(b.l); sammle(b.r); };
  sammle(z.l); sammle(z.r);
  let tol = 0;
  const diff = () => rechne(z.l, u) - rechne(z.r, u);
  const d0 = diff();
  for (const b of lits) {
    const h = 0.5 * 10 ** -b.stellen, alt = b.zahl;
    b.zahl = alt + h; const d1 = diff(); b.zahl = alt - h; const d2 = diff(); b.zahl = alt;
    tol += Math.max(Math.abs(d1 - d0), Math.abs(d2 - d0));
  }
  return Number.isFinite(tol) ? tol * 1.01 + 1e-12 : 0;
}

// ---------- Etappe ----------
// Seite gesucht (x): formel (fn(Winkel) = … x …), umgestellt (x = … ohne x, mit fn), ergebnis (x ≈ Zahl)
// Winkel gesucht (α): formel (fn α = Bruch), wert (fn α = Zahl), umkehr (α = fn⁻¹(…)), ergebnis (α ≈ Zahl)
export function etappe(z, gesucht) {
  for (const [a, b] of [[ohneKlammer(z.l), ohneKlammer(z.r)], [ohneKlammer(z.r), ohneKlammer(z.l)]]) {
    const lit = b && 'zahl' in b;
    if (gesucht === 'seite') {
      if (a.var && lit) return 'ergebnis';
      if (a.var && !hatVar(b) && hatFn(b, false)) return 'umgestellt';
      if (a.fn && !a.fn.endsWith('⁻¹') && !hatVar(a) && hatVar(b) && !ohneKlammer(b).var) return 'formel';
    } else {
      if (a.var && lit) return 'ergebnis';
      if (a.var && !hatVar(b) && hatFn(b, true)) return 'umkehr';
      if (a.fn && !a.fn.endsWith('⁻¹') && ohneKlammer(a.l).var && !hatVar(b)) return lit ? 'wert' : 'formel';
    }
  }
  return 'keine';
}

// ---------- Eine Zeile prüfen ----------
// ctx: { gesucht, fn, w (α|β), u (genauer Wert der Unbekannten), g (Winkel bei Seite), n (gegebene Länge bei Seite),
//        zz, nn (Längen bei Winkel), stellen (Ergebnis: 2 bei Seite, 1 bei Winkel) }
// opt: { erwartet (Etappe, Stufe 2/3), vorher (Etappen der Zeilen davor), texte (Zeilen davor) }
// → { ok, fehlt, etappe, wahr, gerundet, mitGleich, fehler: {typ, text} }
export function pruefen(ctx, text, opt = {}) {
  const unb = ctx.gesucht === 'seite' ? 'x' : ctx.w;
  const z = zeileLesen(text, unb);
  if (z.fehlt) return { ok: false, fehlt: z.fehlt };
  const w = wahrheit(z, ctx.u);
  const et = etappe(z, ctx.gesucht);
  const res = { ok: false, etappe: et, wahr: w.wahr, gerundet: !!w.gerundet, mitGleich: !!w.mitGleich };
  if (!w.wahr) return { ...res, fehler: fehlerArt(ctx, z, et, w) };
  // Ergebnis mit der verlangten Stellenzahl
  if (et === 'ergebnis' && w.stellen !== ctx.stellen) return { ...res, fehler: { typ: 'weg-runden', text: `Runde auf ${ctx.stellen} ${ctx.stellen === 1 ? 'Stelle' : 'Stellen'} nach dem Komma.` } };
  if (et === 'wert' && w.gerundet && w.stellen < 3) return { ...res, fehler: { typ: 'weg-runden', text: 'Runde hier auf 4 Stellen nach dem Komma. Sonst wird der Winkel ungenau.' } };
  const vorher = opt.vorher || [];
  if ((opt.texte || []).some(t => t.replace(/\s+/g, '') === String(text).replace(/\s+/g, ''))) return { ...res, fehler: { typ: 'weg-kein-schritt', text: 'Diese Zeile steht schon da. Schreib den nächsten Schritt.' } };
  if (opt.erwartet) {
    if (et !== opt.erwartet) return { ...res, fehler: { typ: 'weg-etappe', text: ETAPPE_TIPP[opt.erwartet](ctx) } };
    return { ...res, ok: true };
  }
  // Frei (Stufe 4): Etappe muss es geben, vorwärts gehen, Ergebnis nicht ohne Weg
  if (et === 'keine') return { ...res, fehler: { typ: 'weg-kein-schritt', text: 'Die Zeile stimmt, bringt dich aber nicht weiter. Was ist der nächste Schritt?' } };
  if (et === 'ergebnis' && !vorher.length) return { ...res, fehler: { typ: 'weg-ergebnis-ohne-weg', text: 'Die Zahl stimmt. Schreib zuerst die Formel auf, dann den Weg.' } };
  const letzte = vorher.length ? RANG[vorher[vorher.length - 1]] : 0;
  if (RANG[et] < letzte) return { ...res, fehler: { typ: 'weg-ruecksprung', text: 'Das hattest du schon weiter oben. Mach mit dem nächsten Schritt weiter.' } };
  return { ...res, ok: true };
}
const ETAPPE_TIPP = {
  formel: (c) => `Hier kommt die Formel: ${c.fn} ${c.gesucht === 'seite' ? c.g + '°' : c.w} = … : …`,
  wert: (c) => `Hier kommt der Wert: ${c.fn} ${c.w} ≈ Zahl. Erst teilen.`,
  umkehr: (c) => `Hier kommt der Winkel mit 2nd: ${c.w} = ${c.fn}⁻¹(…)`,
  umgestellt: (c) => `Hier steht x allein: x = … · ${c.fn} ${c.g}°`,
  ergebnis: (c) => `Hier steht das Ergebnis: ${c.gesucht === 'seite' ? 'x' : c.w} ≈ Zahl`
};

// Fehlerart einer falschen Zeile: Werte der typischen Fehler vergleichen
const RN = { hyp: 'Hypotenuse', an: 'Ankathete', geg: 'Gegenkathete' };
const TZ = { cos: ['an', 'hyp'], sin: ['geg', 'hyp'], tan: ['geg', 'an'] };
function fehlerArt(ctx, z, et, w) {
  const { fn } = ctx, n = ctx.w || 'α', andere = ['sin', 'cos', 'tan'].filter(f => f !== fn);
  const [zr, nr] = TZ[fn];
  if (w.abgeschnitten) return { typ: 'trig-abgeschnitten', text: 'Runden, nicht abschneiden: Schau auf die nächste Ziffer.' };
  // Wert der Seite ohne Unbekannte (bei Ergebnis/Wert: die Zahl)
  const seite = (b) => !hatVar(b);
  const ohne = seite(z.r) ? z.r : seite(z.l) ? z.l : null;
  const v = ohne ? rechne(ohne, ctx.u) : NaN;
  const passt = (x, d = 0.006) => Number.isFinite(x) && Number.isFinite(v) && Math.abs(v - x) <= d * Math.max(1, Math.abs(x));
  const T = (typ, text) => ({ typ, text });
  const FALSCHE_FN = () => ({ typ: 'trig-falsche-funktion', text: `Welche Seiten hast du? ${RN[zr]} und ${RN[nr]}: ${fn} ${n} = ${RN[zr]} : ${RN[nr]}.` });
  if (ctx.gesucht === 'seite') {
    const { g, n: N } = ctx;
    // Formel: Seite mit fn(Zahl) und Seite mit x
    const fnSeite = [z.l, z.r].map(ohneKlammer).find(b => b.fn && !hatVar(b));
    if (fnSeite && hatVar(fnSeite === ohneKlammer(z.l) ? z.r : z.l)) {
      if (fnSeite.fn !== fn) return fnSeite.fn.endsWith('⁻¹') ? T('trig-taste-umkehr', `Die Seite ist gesucht. Dann ohne 2nd: ${fn} ${g}°.`) : FALSCHE_FN();
      const xs = fnSeite === ohneKlammer(z.l) ? z.r : z.l;
      if (nah(rechne(xs, ctx.u), 1 / FN[fn](g), 1e-6)) return T(fn === 'cos' ? 'cos-kehrwert' : `${fn}-kehrwert`, `${fn} ${n} = ${RN[zr]} : ${RN[nr]}. Die ${RN[nr]} steht unten.`);
      return null;
    }
    if (ohne && (hatFn(ohne, true))) return T('trig-taste-umkehr', `Die Seite ist gesucht. Dann ohne 2nd: x = Zahl · ${fn}.`);
    if (passt(N / FN[fn](g))) return T('trig-seite-geteilt', 'x steht oben im Bruch. Dann rechnest du mal.');
    if (andere.some(f => passt(N * FN[f](g)))) return FALSCHE_FN();
    if (passt(N * Math[fn](g))) return T('trig-rad', 'Der Rechner muss in Grad rechnen (DEG).');
    return null;
  }
  // Winkel gesucht
  const c = ctx.zz / ctx.nn, gw = ctx.u;
  if (et === 'formel' || et === 'wert') {
    if (passt(1 / c, 1e-4)) return T(fn === 'cos' ? 'cos-kehrwert' : `${fn}-kehrwert`, `${fn} ${n} = ${RN[zr]} : ${RN[nr]}. Die ${RN[nr]} steht unten.`);
    if (passt(FN[fn](c), 2e-4) || passt(FN[fn](1 / c), 2e-4)) return T('trig-vom-bruch', `Erst teilen. Hier noch kein ${fn} drücken.`);
    // links eine andere Funktion als gedacht
    const lf = ohneKlammer(z.l).fn || ohneKlammer(z.r).fn;
    if (lf && lf !== fn) return FALSCHE_FN();
  }
  // „fn α ≈ 36,9“: Funktion vor dem Ergebnis
  if ((ohneKlammer(z.l).fn && ohneKlammer(ohneKlammer(z.l).l).var && passt(gw, 0.002)) || (ohneKlammer(z.r).fn && ohneKlammer(ohneKlammer(z.r).l).var && passt(gw, 0.002)))
    return T('weg-name', `Unten steht nur der Winkel: ${n} ≈ …°. Ohne ${fn} davor.`);
  // α = Zahl, die der fn-Wert ist
  if ((ohneKlammer(z.l).var || ohneKlammer(z.r).var) && passt(c, 2e-4)) return T('trig-wert-statt-winkel', `Die Zahl ist der ${fn}-Wert. Vor ihr steht ${fn} ${n}, nicht ${n}.`);
  if ((ohneKlammer(z.l).var || ohneKlammer(z.r).var) && (passt(FN[fn](c), 2e-4) || (hatFn(ohne, false) && !hatFn(ohne, true)))) return T('trig-taste-ohne-2nd', `Der Winkel ist gesucht. Dann brauchst du 2nd: ${fn}⁻¹.`);
  if (passt(90 - gw, 0.002)) return T('weg-anderer-winkel', `Das ist der andere Winkel. ${n} ist im Bild markiert.`);
  if (andere.some(f => passt(FN[f + '⁻¹'](c), 0.002))) return FALSCHE_FN();
  if (passt(Math[{ sin: 'asin', cos: 'acos', tan: 'atan' }[fn]](c), 0.01)) return T('trig-rad', 'Der Rechner muss in Grad rechnen (DEG).');
  return null;
}

// ---------- Eingabe (Stufe 2–4) ----------
// Zeile als Liste von Bausteinen; Text mit Leerzeichen wie im Heft
export function zeileText(teile) {
  let s = '';
  for (const t of teile) {
    const vorne = s.slice(-1);
    const eng = /^[0-9,]$/.test(t) && /[0-9,]$/.test(vorne) || t === ',' || vorne === ',' || t === ')' || vorne === '(' || t === '°' || t === '(' && /(sin|cos|tan|⁻¹)$/.test(s) || vorne === '';
    s += (eng ? '' : ' ') + t;
  }
  return s.trim();
}
