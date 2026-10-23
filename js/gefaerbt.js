// „Gleich viel gefärbt“ (Auftrag 17): Linien im Bild wählen, die es in gleiche Hälften oder Viertel teilen.
// Reine Logik ohne DOM (testbar mit node).
// bild: { form: rechteck|quadrat|streifen|kreis, zeilen, spalten | teile, gefaerbt, linien: [{ von, bis } | { winkel }] }

// Die Teile des Bildes (Kästchen oder Kreisstücke) mit Mittelpunkt und „gefärbt“
function stuecke(bild) {
  if (bild.form === 'kreis') {
    const n = bild.teile;
    return Array.from({ length: n }, (_, i) => ({ a1: i * 360 / n, a2: (i + 1) * 360 / n, gefaerbt: i < bild.gefaerbt }));
  }
  const zeilen = bild.form === 'streifen' ? 1 : (bild.zeilen || 2), spalten = bild.form === 'streifen' ? bild.teile : (bild.spalten || 2);
  const out = [];
  for (let r = 0; r < zeilen; r++) for (let c = 0; c < spalten; c++) out.push({ x: c + 0.5, y: r + 0.5, gefaerbt: out.length < bild.gefaerbt });
  return out;
}

const sin = (g) => Math.sin(g * Math.PI / 180);
// Auf welcher Seite der Linie liegt ein Stück? +1 / −1, 0 = die Linie schneidet das Stück
function seite(st, l) {
  if (l.winkel != null) {
    const e = 0.5;
    const s1 = Math.sign(sin(st.a1 + e - l.winkel)), s2 = Math.sign(sin(st.a2 - e - l.winkel));
    return s1 === s2 ? s1 : 0;
  }
  const [x1, y1] = l.von, [x2, y2] = l.bis;
  const k = (x2 - x1) * (st.y - y1) - (y2 - y1) * (st.x - x1);
  // Linie durch ein Kästchen hindurch (nicht auf einer Kante): schneidet
  if (x1 === x2 && Math.abs(st.x - x1) < 0.5) return 0;
  if (y1 === y2 && Math.abs(st.y - y1) < 0.5) return 0;
  return Math.sign(k);
}

// Teile, in die die gewählten Linien das Bild zerlegen: [{ anzahl, gefaerbt }], null = eine Linie schneidet ein Stück
export function teileVonLinien(bild, gewaehlt) {
  const linien = gewaehlt.map(i => bild.linien[i]).filter(Boolean);
  const gruppen = new Map();
  for (const st of stuecke(bild)) {
    const sig = linien.map(l => seite(st, l));
    if (sig.includes(0)) return null;
    const k = sig.join(',');
    const g = gruppen.get(k) || { anzahl: 0, gefaerbt: 0 };
    g.anzahl++; if (st.gefaerbt) g.gefaerbt++;
    gruppen.set(k, g);
  }
  return [...gruppen.values()];
}

// Wie viele gleiche Teile verlangt die Aufgabe? (aus den richtigen Linien: 2 Hälften oder 4 Viertel)
export function zielTeile(bild, richtig) {
  const t = teileVonLinien(bild, richtig);
  return t ? t.length : 2;
}
export const teileWort = (k) => (k === 4 ? 'Viertel' : k === 2 ? 'Hälften' : 'Teile');

// Gewählte Linien prüfen. Richtig ist jede Wahl, die das Bild in k gleiche Teile zerlegt,
// bei der jeder Teil ganz gefärbt oder ganz leer ist (auch eine andere als in „richtig“).
export function pruefeLinien(bild, gewaehlt, richtig) {
  const k = zielTeile(bild, richtig);
  const wort = teileWort(k);
  if (!gewaehlt.length) return { richtig: false, fehler: { typ: 'linien-leer', text: 'Tippe zuerst eine Linie an.' } };
  const t = teileVonLinien(bild, gewaehlt);
  if (k === 4 && gewaehlt.length < 2) return { richtig: false, fehler: { typ: 'linien-zu-wenig', text: 'Für Viertel brauchst du zwei Linien.' } };
  if (!t || t.length !== k || t.some(x => x.anzahl !== t[0].anzahl)) return { richtig: false, fehler: { typ: 'linien-ungleich', text: 'Sind alle Teile gleich groß?' } };
  if (t.some(x => x.gefaerbt > 0 && x.gefaerbt < x.anzahl)) return { richtig: false, fehler: { typ: 'linien-nicht-ganz', text: `Die gefärbten Teile sollen ganze ${wort} füllen.` } };
  return { richtig: true, fehler: null, gefaerbt: t.filter(x => x.gefaerbt).length, teile: k };
}
