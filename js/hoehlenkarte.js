// Höhlenkarte: versteckte Fallen finden (wie das klassische Minen-Spiel). Ohne Zeit, mit Zurücknehmen.
// Reine Logik ohne DOM (testbar mit node). Anzeige in hoehlenkarte-ui.js.

export const GROESSEN = {
  klein: { name: 'Klein', w: 8, h: 8, fallen: 8 },
  mittel: { name: 'Mittel', w: 9, h: 12, fallen: 16 },
  gross: { name: 'Groß', w: 10, h: 15, fallen: 28 }
};

function zufall(s) {
  s.zufall = (s.zufall + 0x6D2B79F5) >>> 0;
  let t = s.zufall;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function neueKarte(groesse = 'klein', startwert = Date.now()) {
  const g = GROESSEN[groesse] || GROESSEN.klein;
  const n = g.w * g.h;
  return {
    groesse: GROESSEN[groesse] ? groesse : 'klein', w: g.w, h: g.h, fallen: g.fallen, zufall: startwert >>> 0,
    gelegt: false, feld: new Array(n).fill(0), offen: new Array(n).fill(0), markiert: new Array(n).fill(0), bekannt: new Array(n).fill(0),
    vorbei: null, falle: -1, zurueck: 0, tipps: 0, zuege: 0
  };
}

export function nachbarn(s, i) {
  const r = Math.floor(i / s.w), c = i % s.w, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < s.h && cc < s.w) out.push(rr * s.w + cc);
  }
  return out;
}

// Fallen legen, nicht im 3×3-Feld um den ersten Tipp
function legen(s, erst) {
  const frei = new Set([erst, ...nachbarn(s, erst)]);
  const moeglich = [];
  for (let i = 0; i < s.w * s.h; i++) if (!frei.has(i)) moeglich.push(i);
  for (let k = 0; k < s.fallen && moeglich.length; k++) {
    const j = Math.floor(zufall(s) * moeglich.length);
    s.feld[moeglich[j]] = -1;
    moeglich.splice(j, 1);
  }
  for (let i = 0; i < s.feld.length; i++) {
    if (s.feld[i] === -1) continue;
    s.feld[i] = nachbarn(s, i).filter(j => s.feld[j] === -1).length;
  }
  s.gelegt = true;
}

export const istFalle = (s, i) => s.feld[i] === -1;
export const geschafft = (s) => s.gelegt && s.feld.every((f, i) => f === -1 || s.offen[i]);
export const fallenUebrig = (s) => s.fallen - s.markiert.reduce((a, b) => a + b, 0) - s.bekannt.reduce((a, b) => a + b, 0);
export const offeneZahl = (s) => s.offen.reduce((a, b) => a + b, 0);

// Felder öffnen (Breitensuche ab i). Gibt [{ i, d }] in Reihenfolge zurück (d = Abstand, für die Welle).
function oeffnen(s, start) {
  const out = [];
  const q = [[start, 0]];
  const gesehen = new Set([start]);
  while (q.length) {
    const [i, d] = q.shift();
    if (s.offen[i] || s.markiert[i] || s.bekannt[i]) continue;
    s.offen[i] = 1;
    out.push({ i, d });
    if (s.feld[i] === 0) for (const j of nachbarn(s, i)) if (!gesehen.has(j) && !s.offen[j]) { gesehen.add(j); q.push([j, d + 1]); }
  }
  return out;
}

// Ein Feld antippen. Gibt { geoeffnet: [{ i, d }], falle: Index oder -1, geschafft } zurück oder null, wenn nichts passiert.
export function aufdecken(s, i) {
  if (s.vorbei || i < 0 || i >= s.feld.length) return null;
  if (s.offen[i]) return akkord(s, i);
  if (s.markiert[i] || s.bekannt[i]) return null;
  if (!s.gelegt) legen(s, i);
  s.zuege++;
  if (s.feld[i] === -1) {
    s.vorbei = 'falle'; s.falle = i;
    return { geoeffnet: [], falle: i, geschafft: false };
  }
  const geoeffnet = oeffnen(s, i);
  const fertig = geschafft(s);
  if (fertig) s.vorbei = 'geschafft';
  return { geoeffnet, falle: -1, geschafft: fertig };
}

// Offene Zahl antippen: stimmen die Markierungen drumherum, öffnen sich die übrigen Nachbarn
export function akkord(s, i) {
  if (s.vorbei || !s.offen[i] || s.feld[i] <= 0) return null;
  const nb = nachbarn(s, i);
  const markiert = nb.filter(j => s.markiert[j] || s.bekannt[j]).length;
  const zu = nb.filter(j => !s.offen[j] && !s.markiert[j] && !s.bekannt[j]);
  if (markiert !== s.feld[i] || !zu.length) return null;
  s.zuege++;
  const falle = zu.find(j => s.feld[j] === -1);
  const geoeffnet = [];
  for (const j of zu) if (s.feld[j] !== -1) geoeffnet.push(...oeffnen(s, j).map(x => ({ i: x.i, d: x.d + 1 })));
  if (falle != null) { s.vorbei = 'falle'; s.falle = falle; return { geoeffnet, falle, geschafft: false }; }
  const fertig = geschafft(s);
  if (fertig) s.vorbei = 'geschafft';
  return { geoeffnet, falle: -1, geschafft: fertig };
}

export function markieren(s, i) {
  if (s.vorbei || s.offen[i] || s.bekannt[i]) return false;
  s.markiert[i] = s.markiert[i] ? 0 : 1;
  return true;
}

// Nach einer Falle: weiterspielen, die Falle bleibt sichtbar markiert
export function zuruecknehmen(s) {
  if (s.vorbei !== 'falle') return false;
  s.bekannt[s.falle] = 1;
  s.markiert[s.falle] = 0;
  s.falle = -1;
  s.vorbei = null;
  s.zurueck++;
  if (geschafft(s)) s.vorbei = 'geschafft';
  return true;
}

// Sicheres Feld für einen Tipp: zuerst eins, das man sich überlegen kann, sonst eins am Rand des offenen Bereichs
export function tippFeld(s) {
  if (s.vorbei) return -1;
  if (!s.gelegt) return Math.floor(s.h / 2) * s.w + Math.floor(s.w / 2);
  const n = s.feld.length;
  const sicherFalle = s.bekannt.slice();
  const sicherFrei = new Array(n).fill(0);
  let neu = true;
  while (neu) {
    neu = false;
    for (let i = 0; i < n; i++) {
      if (!s.offen[i] || s.feld[i] <= 0) continue;
      const nb = nachbarn(s, i).filter(j => !s.offen[j]);
      const fallenDa = nb.filter(j => sicherFalle[j]).length;
      const offenUnklar = nb.filter(j => !sicherFalle[j] && !sicherFrei[j]);
      if (!offenUnklar.length) continue;
      if (fallenDa === s.feld[i]) { offenUnklar.forEach(j => { sicherFrei[j] = 1; }); neu = true; }
      else if (fallenDa + offenUnklar.length === s.feld[i]) { offenUnklar.forEach(j => { sicherFalle[j] = 1; }); neu = true; }
    }
  }
  const kandidaten = [];
  for (let i = 0; i < n; i++) if (sicherFrei[i] && !s.offen[i] && s.feld[i] !== -1) kandidaten.push(i);
  const ohneMarke = kandidaten.filter(i => !s.markiert[i]);
  if (ohneMarke.length) return ohneMarke[0];
  if (kandidaten.length) return kandidaten[0];
  // Nichts sicher Ableitbares: ein freies Feld am Rand des offenen Bereichs
  const rand = [], rest = [];
  for (let i = 0; i < n; i++) {
    if (s.offen[i] || s.feld[i] === -1 || s.markiert[i]) continue;
    (nachbarn(s, i).some(j => s.offen[j]) ? rand : rest).push(i);
  }
  const liste = rand.length ? rand : rest;
  return liste.length ? liste[Math.floor(zufall(s) * liste.length)] : -1;
}

// Tipp benutzen: Feld wird geöffnet (falsche Markierung dort wird entfernt)
export function tipp(s) {
  const i = tippFeld(s);
  if (i < 0) return null;
  s.tipps++;
  s.markiert[i] = 0;
  const erg = aufdecken(s, i);
  return erg ? { ...erg, feld: i } : null;
}

// Gespeicherten Stand prüfen
export function standPruefen(st) {
  if (!st || !GROESSEN[st.groesse]) return null;
  const g = GROESSEN[st.groesse], n = g.w * g.h;
  for (const k of ['feld', 'offen', 'markiert', 'bekannt']) if (!Array.isArray(st[k]) || st[k].length !== n) return null;
  if (st.w !== g.w || st.h !== g.h) return null;
  return { ...st, zurueck: st.zurueck || 0, tipps: st.tipps || 0, zuege: st.zuege || 0 };
}
