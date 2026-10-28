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

// Ziel: { wert, toleranz?, runden?, gueltige? } (gueltige: Anzahl gültiger Ziffern, Physik)
// Zahl (schon ausgerechnet, z. B. aus Zahl · 10ⁿ) gegen das Ziel prüfen
export function pruefeWert(wert, ziel) {
  if (!Number.isFinite(wert)) return false;
  if (ziel.gueltige) return pruefeGueltig(wert, ziel.wert, ziel.gueltige);
  if (ziel.toleranz != null) return Math.abs(wert - ziel.wert) <= ziel.toleranz + 1e-9;
  return Math.abs(wert - ziel.wert) <= 1e-9 * Math.max(1, Math.abs(ziel.wert));
}
// Ist x (mit k Nachkommastellen getippt) der Wert c, richtig gerundet auf k Stellen? Mindestens 1 Stelle, außer c ist ganz.
// Viele Stellen (ganze Zahl vom Rechner) haben einen kleinen Spielraum für die Anzeige des Rechners.
export function rundetRichtig(x, k, c) {
  if (Number.isInteger(c) && Math.abs(x - c) < 1e-9) return true;
  if (k < 1) return false;
  return Math.abs(x - c) <= 0.5 * 10 ** -k * (1 + 1e-9) + 1e-9 * Math.max(1, Math.abs(c));
}
const kandidaten = (ziel) => [ziel.genau, ...(ziel.varianten || [])];
export function pruefeZahl(text, ziel) {
  const p = parseZahl(text);
  if (!p.ok) return false;
  if (ziel.gueltige) return pruefeGueltig(p.wert, ziel.wert, ziel.gueltige);
  // Körper-Baukästen: nur richtig gerundete Ergebnisse (auch mit gerundeten Zwischenwerten), nicht abgeschnitten
  if (ziel.genau != null) return kandidaten(ziel).some(c => rundetRichtig(p.wert, p.nachkomma, c));
  if (ziel.auch && ziel.auch.some(z => gleich(p.wert, z))) return true;
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

// Auswahl-Schritte bei Körpern: falsche Länge gewählt. Gibt { typ, text } oder null zurück.
export function erkenneWahlFehler(aufgabe, teil, gewaehlt) {
  if (!teil || !Array.isArray(teil.optionen) || gewaehlt === teil.richtig) return null;
  const o = String(teil.optionen[gewaehlt] || ''), frage = teil.text || '';
  if (aufgabe.thema === 'pyramide' && /Volumen/.test(frage) && /^hₛ/.test(o)) return { typ: 'pyramide-hs-statt-h', text: 'hₛ liegt außen auf der Seitenfläche. Für das Volumen brauchst du h: von der Spitze gerade nach unten.' };
  if (aufgabe.thema === 'pyramide' && /Seitenfl/.test(frage) && /^h\s*=/.test(o)) return { typ: 'pyramide-h-statt-hs', text: 'Die Seitenfläche ist ein Dreieck außen. Seine Höhe ist hₛ.' };
  if (aufgabe.thema === 'kegel' && /Mantel/.test(frage) && /^h\s*=/.test(o)) return { typ: 'kegel-h-statt-s', text: aufgabe.generator === 'kegel' ? 'A_M (Mantel) → s (schräg außen). h ist innen.' : 'Für A_M (Mantel) brauchst du s, die schräge Linie außen.' };
  // Zylinder „Was wird gesucht?“ mit vier Möglichkeiten (Auftrag 30)
  if (aufgabe.form === 'gesucht4' && /gesucht/.test(frage)) return { typ: 'zylinder-gesucht', text: '„passt hinein“ → V (Volumen). „rund herum“ → A_M (Mantel). „alles außen, mit Deckel und Boden“ → A_O (Oberfläche). „der Boden“ → A_G (Grundfläche).' };
  return null;
}
// Prozent mit Formel: G und p aus den Parametern (direkt|rabatt: [art, G, p, …], text: [art, k, G, p, …])
const PF_VERTAUSCHT = { typ: 'formel-g-p-vertauscht', text: 'G ist das Ganze: die Zahl nach „von“, zum Beispiel der Preis.' };
function pfGp(a) {
  const par = a.parameter || [];
  if (par[0] === 'text') return [par[2], par[3]];
  if (par[0] === 'direkt' || par[0] === 'rabatt') return [par[1], par[2]];
  return null;
}
// Merkzettel: falsche Zahl aus dem Text. Gibt { typ, text } oder null zurück.
export function erkenneMerkFehler(aufgabe, label, eingabeText) {
  const p = parseZahl(eingabeText);
  if (!p.ok || aufgabe.generator !== 'prozent-formel') return null;
  const gp = pfGp(aufgabe);
  if (!gp) return null;
  if ((/^G\b/.test(label || '') && gleich(p.wert, gp[1])) || (/^p\b/.test(label || '') && gleich(p.wert, gp[0]))) return PF_VERTAUSCHT;
  return null;
}
// Gibt { typ, text } oder null zurück. teil = Schritt/Frage-Objekt oder null.

export function erkenneFehler(aufgabe, teil, eingabeText) {
  const p = parseZahl(eingabeText);
  if (!p.ok) return null;
  const w = p.wert;
  const ziel = teil ? teil.wert : aufgabe.antwort && aufgabe.antwort.wert;
  if (ziel == null) return null;

  // Doppeltes Minus und Minus vor einer Klammer mit Minus innen (Auftrag 21)
  const par = (aufgabe.parameter || []).filter(x => typeof x === 'number');
  const ttx = teil ? teil.text || '' : '';
  if (aufgabe.form === 'minusminus' && par.length >= 2) {
    const [a, b] = par.slice(-2);
    if (gleich(w, a - b) || (/\+\s*$/.test(ttx) && gleich(w, -b))) return { typ: 'minusminus-nicht-gedreht', text: 'Schulden fallen weg. Das ist wie Geld bekommen.' };
  }
  if (aufgabe.form === 'klammer_negativ' && par.length >= 3) {
    const [a, b, c] = par.slice(-3);
    if (gleich(w, a - (c - b)) || (/^Klammer/.test(ttx) && gleich(w, c - b))) return { typ: 'klammer-negativ', text: 'Erst die Klammer ausrechnen. Was kommt in der Klammer heraus?' };
  }

  // Prozent mit Formel (Auftrag 30): ohne : 100, G und p vertauscht, Rabatt statt neuer Preis
  if (aufgabe.generator === 'prozent-formel') {
    const gp = pfGp(aufgabe);
    if (gp) {
      const [G, p] = gp;
      if (/^G =/.test(ttx) && gleich(w, p)) return PF_VERTAUSCHT;
      if (/^p =/.test(ttx) && gleich(w, G)) return PF_VERTAUSCHT;
      if (/W = G/.test(ttx) && gleich(w, G * p)) return { typ: 'formel-ohne-100', text: 'Hast du durch 100 geteilt?' };
      if (/^Neuer Preis/.test(ttx) && gleich(w, G * p / 100)) return { typ: 'formel-rabatt-statt-preis', text: 'Das ist der Rabatt. Wie viel kostet es jetzt? G − Rabatt.' };
    }
  }

  // Mal 10 / durch 10 (Auftrag 36), auch im Dreierblock und bei festen Aufgaben
  if (aufgabe.thema === 'mal-10' || /block-mal10/.test(aufgabe.generator || '')) {
    const f = mal10Fehler(aufgabe.rechnung, w, ziel);
    if (f) return f;
  }
  // Einmaleins geteilt (Auftrag 36): über die Malfolge, ohne das Ergebnis zu verraten
  if (aufgabe.thema === 'einmaleins') {
    const g = /^\s*(\d+)\s*:\s*(\d+)\s*=?\s*$/.exec(String(aufgabe.rechnung || ''));
    if (g) { const p = Number(g[1]), a = Number(g[2]); return { typ: 'einmaleins-geteilt', text: `Welche Zahl mal ${a} gibt ${p}? Zähl in ${a}er-Schritten: ${[a, 2 * a, 3 * a].filter(x => x < p).slice(0, 3).join(', ')}, … bis ${p}. Wie viele Schritte?`, loesung: `${a} · ${p / a} = ${p} → ${p} : ${a} = ${p / a}` }; }
  }

  // Radius aus Durchmesser: Rechenweg steht nicht in der Frage, Tipp erst nach einem Fehler
  if (teil && /^Radius\b/.test(teil.text || '')) {
    if (gleich(w, 2 * ziel)) return { typ: 'kugel-d-statt-r', text: 'Das ist der Durchmesser. Der Radius ist halb so lang.' };
    return { typ: 'radius', text: 'Der Radius geht von der Mitte bis zum Rand. Das ist der halbe Durchmesser.' };
  }

  // Potenz: 5² mit 10 beantwortet
  const pot = potenzWert(aufgabe.rechnung);
  if (pot && gleich(w, pot.basis * pot.exp) && !gleich(w, pot.wert)) {
    return { typ: 'potenz-mal', text: `Hoch ${pot.exp} heißt: ${Array(pot.exp).fill(pot.basis).join(' · ')}, nicht ${pot.basis} · ${pot.exp}.` };
  }

  // Hoch 3: Endergebnis = Zwischenergebnis (erst zweimal malgenommen)
  const t3 = teil ? teil.text || '' : aufgabe.rechnung || '';
  if (/³\s*=?\s*$/.test(t3) && ziel > 1) {
    const b = Math.round(Math.cbrt(ziel));
    if (b ** 3 === ziel && gleich(w, b * b)) return { typ: 'potenz-zweimal', text: 'Du hast erst zweimal malgenommen. Hoch 3 heißt dreimal.' };
  }

  const bild = aufgabe.bild || {};
  const nah = (a, b) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.01, 0.05);
  const ttext = teil ? teil.text || '' : '';
  const koerper = ['zylinder', 'kegel', 'pyramide'].includes(aufgabe.thema);
  const schritte = aufgabe.schritte || [];
  const vorher = teil ? schritte[schritte.indexOf(teil) - 1] : null;

  // Kreisdiagramm (Auftrag 33): Prozentzahl statt Anzahl eingegeben
  if (aufgabe.thema === 'kreisdiagramm' && teil && /^Wie viele\b/.test(teil.frage || teil.text || '') && aufgabe.bild && aufgabe.bild.gesamt) {
    const p = parseZahl(eingabeText);
    if (p.ok && !gleich(p.wert, teil.wert) && (aufgabe.bild.segmente || []).some(sg => !sg.prozent_versteckt && gleich(sg.prozent, p.wert)))
      return { typ: 'kreis-prozent-statt-anzahl', text: `Gefragt ist die Anzahl: Wie viele von ${aufgabe.bild.gesamt}?` };
  }
  // Abgeschnitten statt gerundet (Körper-Baukästen mit genau): 50,26 statt 50,27 oder Ergebnis aus abgeschnittenen Zahlen
  if (teil && teil.genau != null) {
    const p = parseZahl(eingabeText), k = p.ok ? p.nachkomma : 0;
    const ab = (c) => k >= 1 && gleich(p.wert, Math.trunc(c * 10 ** k) / 10 ** k);
    if (p.ok && ([teil.genau, ...(teil.varianten || [])].some(ab) || (teil.abgeschnitten || []).some(c => rundetRichtig(p.wert, k, c))))
      return { typ: 'abgeschnitten', text: 'Runde richtig: Schau auf die nächste Stelle. Oder nimm die ganze Zahl vom Rechner.' };
  }
  if (koerper && teil && teil.wert != null) {
    // Kegel/Pyramide: Drittel vergessen
    if (/Drittel/.test(ttext) && vorher && vorher.wert != null && nah(w, vorher.wert)) {
      if (aufgabe.generator === 'kegel') return { typ: 'kegel-drittel-vergessen', text: 'Das Drittel nicht vergessen! Erst wie Zylinder, dann durch 3.' };
      if (aufgabe.generator === 'pyramide') return { typ: 'drittel-vergessen', text: 'Das Drittel nicht vergessen! Erst A_G (Grundfläche) · h, dann durch 3.' };
      return { typ: 'drittel-vergessen', text: 'Hast du an das Drittel gedacht? Teile durch 3.' };
    }
    if ((aufgabe.generator === 'kegel' || aufgabe.generator === 'pyramide') && /≈\s*$/.test(ttext) && nah(w, teil.wert * 3)) {
      return aufgabe.generator === 'kegel' ? { typ: 'kegel-drittel-vergessen', text: 'Das Drittel nicht vergessen! Erst wie Zylinder, dann durch 3.' } : { typ: 'drittel-vergessen', text: 'Das Drittel nicht vergessen! Erst A_G (Grundfläche) · h, dann durch 3.' };
    }
    if (aufgabe.thema !== 'zylinder' && /\bV\s*[=≈]\s*$/.test(ttext) && nah(w, teil.wert * 3)) {
      return { typ: 'drittel-vergessen', text: aufgabe.thema === 'kegel' ? 'Ein Kegel ist nur ein Drittel. Teile durch 3.' : 'Eine Pyramide ist nur ein Drittel. Teile durch 3.' };
    }
    // Pyramide: Mantel nur 1 Dreieck
    if (aufgabe.thema === 'pyramide' && /A_M/.test(ttext) && nah(w, teil.wert / 4)) {
      return { typ: 'pyramide-ein-dreieck', text: 'Die Pyramide hat 4 Dreiecke außen.' };
    }
    const r = bild.r != null ? bild.r : bild.d != null ? bild.d / 2 : null;
    if (r != null) {
      // Kegel: Mantel mit h statt s
      if (aufgabe.thema === 'kegel' && /A_M/.test(ttext) && bild.h != null && nah(w, Math.PI * r * bild.h)) {
        return { typ: 'kegel-h-statt-s', text: 'Für A_M (Mantel) brauchst du s, die schräge Linie außen.' };
      }
      // Oberfläche: Zahl der Kreise
      if (/A_O/.test(ttext) && aufgabe.thema === 'kegel' && nah(w, teil.wert + Math.PI * r * r)) {
        return { typ: 'kegel-zwei-kreise', text: 'Ein Kegel hat nur einen Kreis: unten.' };
      }
      if (/A_O/.test(ttext) && aufgabe.thema === 'zylinder' && nah(w, teil.wert - Math.PI * r * r)) {
        return { typ: 'zylinder-ein-kreis', text: 'Ein Zylinder hat zwei Kreise: Boden und Deckel.' };
      }
      // Mit d statt r gerechnet
      if (bild.d != null && ((/A_G/.test(ttext) && nah(w, teil.wert * 4)) || (/A_M/.test(ttext) && aufgabe.thema !== 'pyramide' && nah(w, teil.wert * 2)) ||
        (/^r²/.test(ttext) && gleich(w, bild.d * bild.d)))) {
        return { typ: 'd-statt-r', text: 'Schau nochmal: In der Formel steht r, nicht d.' };
      }
    }
  }

  // Kugel: mit d statt r gerechnet
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
  if (aufgabe.typ === 'schritte' && teil && /(neuer preis|bezahl|kostet)/i.test(teil.text || '')) {
    const spar = (aufgabe.schritte || []).find(s => s !== teil && s.wert != null && /spar/i.test(s.text || ''));
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
    const d = aufgabe.generator === 'runden' ? aufgabe.parameter[1] : teil && teil.runden != null ? teil.runden : 1;
    const stelle = d === 0 ? 'die 1. Stelle nach dem Komma' : `die ${d + 1}. Stelle nach dem Komma`;
    return { typ: 'runden', text: `Schau auf ${stelle}. 5 bis 9 heißt aufrunden.` };
  }

  return null;
}

// ---------- Spielzeit ----------

export const BASIS_SEKUNDEN = 180;

// Spielzeit-Regeln. Werte in Minuten (eine Nachkommastelle), Anteile 1 = alles, 0,5 = Hälfte, 0 = nichts.
// Werden in der Eltern-App eingestellt; ohne Einstellung gelten diese Standardwerte.
export const SPIELZEIT_STANDARD = Object.freeze({ staffel: Object.freeze([1, 1.5, 2, 2.5]), zweit: 0.5, rechner: 0.5, hilfe: 0.5, basisMin: 3, kopf: 1.5,
  muehe: Object.freeze({ kurz: 0.5, normal: 1, lang: 1.5, schwer: 2 }), bonus: 1.5, durchklick: false, hilfeAb: 0 });
// Lohn nach Mühe (Auftrag 18): Faktor je Aufgabenart, Bonus bei der Wiederholung nach dem Durchklick-Hinweis,
// Sperre für „Hilf mir“ am Anfang jedes Schritts (Sekunden)
export const MUEHE_GRUPPEN = ['kurz', 'normal', 'lang', 'schwer'];
export const MUEHE_FAKTOREN = [0.5, 1, 1.5, 2, 3];
export const BONUS_FAKTOREN = [1, 1.25, 1.5, 2];
export const HILFE_AB = [0, 10, 20, 30];
const ANTEILE = [0, 0.5, 1];
// Kopf-Bonus: Rechner wäre erlaubt, wurde aber nicht benutzt (1 = aus)
export const KOPF_FAKTOREN = [1, 1.25, 1.5, 2];

function minutenWert(x, standard, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return standard;
  return Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;
}

export function spielzeitRegeln(r) {
  const S0 = SPIELZEIT_STANDARD;
  if (!r || typeof r !== 'object') r = {};
  const staffel = S0.staffel.map((w, i) => minutenWert(Array.isArray(r.staffel) ? r.staffel[i] : undefined, w, 10));
  const m = r.muehe && typeof r.muehe === 'object' ? r.muehe : {};
  return {
    staffel,
    muehe: Object.fromEntries(MUEHE_GRUPPEN.map(g => [g, MUEHE_FAKTOREN.includes(m[g]) ? m[g] : S0.muehe[g]])),
    bonus: BONUS_FAKTOREN.includes(r.bonus) ? r.bonus : S0.bonus,
    durchklick: typeof r.durchklick === 'boolean' ? r.durchklick : S0.durchklick,
    hilfeAb: HILFE_AB.includes(r.hilfeAb) ? r.hilfeAb : S0.hilfeAb,
    zweit: ANTEILE.includes(r.zweit) ? r.zweit : S0.zweit,
    rechner: ANTEILE.includes(r.rechner) ? r.rechner : S0.rechner,
    hilfe: ANTEILE.includes(r.hilfe) ? r.hilfe : S0.hilfe,
    basisMin: minutenWert(r.basisMin, S0.basisMin, 15),
    kopf: KOPF_FAKTOREN.includes(r.kopf) ? r.kopf : S0.kopf
  };
}

export function minutenFuerPosition(pos, regeln = SPIELZEIT_STANDARD) {
  const st = regeln.staffel;
  if (pos <= 3) return st[0];
  if (pos <= 6) return st[1];
  if (pos <= 9) return st[2];
  return st[3];
}

// Kurzer Text für einen Anteil: „die halbe Spielzeit“ usw.
export function anteilText(a) {
  return a >= 1 ? 'die volle Spielzeit' : a > 0 ? 'die halbe Spielzeit' : 'keine Spielzeit';
}

// Mühe-Gruppe einer Aufgabe (Auftrag 18). umformen: in Schritten umgeformt.
const DICHTE_GRUPPE = { rho: 'normal', umrechnen: 'normal', quader: 'lang', 'masse-volumen': 'lang', vergleich: 'lang', verhaeltnis: 'lang', gewichtskraft: 'schwer' };
export function muehGruppe(a, { umformen = false } = {}) {
  if (!a) return 'normal';
  const g = String(a.generator || '');
  if (a.thema === 'dichte' && DICHTE_GRUPPE[a.variante]) return DICHTE_GRUPPE[a.variante];
  if (KOERPER.includes(a.thema) || a.typ === 'detektiv' || a.modus === 'knobeln') return 'schwer';
  if (a.typ === 'auswahl') return 'normal';
  if (a.fach === 'physik' && a.geschichte) return 'schwer';                 // Physik-Geschichten
  if (umformen) return 'lang';                                              // „In Schritten umformen“
  if (a.bild && a.bild.linien) return 'lang';                               // „Gleich viel gefärbt“
  if (g.startsWith('block') || a.typ === 'bruch') return 'kurz';
  if (g === 'zehnerpotenz') return a.stufe === 1 ? 'kurz' : 'normal';       // schreiben / rechnen
  if (g === 'einheiten') return 'kurz';
  if (g === 'gleichung') return a.stufe === 1 ? 'kurz' : 'normal';
  if (g === 'formel-umstellen' || a.typ === 'formel') return 'normal';
  if (['mehrfrage', 'zuordnung'].includes(a.typ)) return 'lang';
  if (a.typ === 'schritte' && a.thema !== 'potenzen') return 'lang';
  if (a.geschichte && a.geschichte.length > 120) return 'lang';
  if (a.typ === 'zahl' && !a.geschichte && a.thema !== 'prozent' && !a.fach) return 'kurz';
  return 'normal';
}
export const muehFaktor = (a, regeln = SPIELZEIT_STANDARD, opts) => ((regeln.muehe || SPIELZEIT_STANDARD.muehe)[muehGruppe(a, opts)] ?? 1);

// ergebnis: 'erst' | 'zweit' | 'loesung'; strafe: 'keine' | 'halb' | 'null'
// muehe: Faktor je Aufgabenart; zweitVoll: 2. Versuch ohne zu schnelle Eingaben (volle Zeit); bonus: Faktor bei der Wiederholung
export function sekundenFuerAufgabe({ ergebnis, serienPos, strafe = 'keine', rechnerHalb = false, hilfe = false, langHalb = false, kopf = false, regeln = SPIELZEIT_STANDARD, muehe = 1, zweitVoll = false, bonus = 1 }) {
  let min = minutenFuerPosition(serienPos, regeln) * muehe * bonus;
  if (kopf) min *= regeln.kopf ?? SPIELZEIT_STANDARD.kopf; // im Kopf gerechnet, obwohl der Rechner erlaubt war
  if (rechnerHalb) min *= regeln.rechner;
  if (langHalb) min *= 0.5; // „Mehr Hilfe“ (langer Hinweis) in Stufe 2
  if (hilfe) min *= regeln.hilfe ?? SPIELZEIT_STANDARD.hilfe;
  if (ergebnis === 'zweit') { if (!zweitVoll) min *= regeln.zweit; }
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
  // Fehler-Detektiv nur über den eigenen Platz (höchstens 1 pro 10 Aufgaben, siehe app.js)
  if (a.typ === 'detektiv' || kategorie === 'detektiv') return kategorie === 'detektiv' && a.typ === 'detektiv' && !a.bonus;
  switch (kategorie) {
    case 'aufwaermen': return !a.bonus && AUFWAERM_THEMEN.includes(a.thema) && a.stufe <= 2 && a.thema !== thema;
    case 'thema': return !a.bonus && a.thema === thema;
    case 'text': return !a.bonus && !!a.geschichte && !KOERPER.includes(a.thema);
    case 'abschluss': return !a.bonus && (a.thema === 'runden' || a.thema === 'kugel');
    case 'bonus': return !!a.bonus;
    case 'struktur': return !a.bonus && !KOERPER.includes(a.thema) && (['schritte', 'zuordnung', 'bruch'].includes(a.typ) || (a.typ === 'mehrfrage' && !!a.bild));
    default: return !a.bonus;
  }
}

// statistik: { [id]: { gesehen, zuletzt (Zähler), letztesErgebnis, letzterTag } }
// verlauf: { zaehler, letzteIds: [...], themaZuletzt: { [thema]: { ergebnis, stufe } } }
export function waehleAufgabe(aufgaben, { kategorie, thema, statistik = {}, verlauf = {}, heute, gesperrt = null }, rng = Math.random) {
  const zaehler = verlauf.zaehler || 0;
  const letzte = verlauf.letzteIds || [];
  let pool = aufgaben.filter(a => passtKategorie(a, kategorie, thema));
  if (!pool.length) pool = aufgaben.filter(a => !a.bonus);
  if (!pool.length) pool = aufgaben.slice();
  // Nach „Zeig mir die Lösung“ (Auftrag 32): dieselbe Aufgabe erst nach 20 Minuten Übungszeit
  if (gesperrt && gesperrt.size) { const o = pool.filter(a => !gesperrt.has(a.id)); if (o.length) pool = o; }
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
    if (s.letztesErgebnis === 'loesung' && !s.ersetzt && zaehler - s.zuletzt >= 3) p += 2000; // fällig zur Wiederholung (nicht, wenn schon eine andere Aufgabe derselben Art kam)
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

export const TYPEN = ['zahl', 'auswahl', 'bruch', 'schritte', 'zuordnung', 'mehrfrage', 'zehnerpotenz', 'formel', 'detektiv'];
export const THEMEN = ['minus-zahlen', 'reihenfolge', 'potenzen', 'bruch-bild', 'zuordnung', 'prozent', 'prozent-baukasten', 'prozent-formel', 'rabatt', 'neuer-preis', 'kreisdiagramm', 'runden', 'kugel', 'einmaleins', 'mal-10', 'zylinder', 'kegel', 'pyramide', 'zehnerpotenzen', 'einheiten', 'gewichtskraft', 'umstellen', 'dichte'];
// Fach je Thema (Auftrag 13). Fehlt das Feld fach an der Aufgabe, gilt das Fach des Themas.
export const PHYSIK_THEMEN = ['zehnerpotenzen', 'einheiten', 'gewichtskraft', 'dichte'];
export const fachVon = (a) => (a && (a.fach || (PHYSIK_THEMEN.includes(a.thema) ? 'physik' : 'mathe'))) || 'mathe';
// Körper mit Taschenrechner: eigene Plätze (Schritte und Abschluss), nicht bei Text und Struktur aus dem allgemeinen Pool
export const KOERPER = ['kugel', 'zylinder', 'kegel', 'pyramide'];
export const BILDFORMEN = ['streifen', 'kreis', 'quadrat', 'rechteck', 'kreisdiagramm', 'kugel', 'zylinder', 'kegel', 'pyramide'];

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
  if (a.bild && a.bild.form && !BILDFORMEN.includes(a.bild.form)) f.push(`${id}: unbekannte Bildform „${a.bild.form}“`);
  if (a.taschenrechner != null && typeof a.taschenrechner !== 'boolean') f.push(`${id}: taschenrechner muss true oder false sein`);
  if (a.gegeben != null) {
    if (!Array.isArray(a.gegeben)) f.push(`${id}: gegeben muss eine Liste sein`);
    else a.gegeben.forEach((g, i) => { if (!g || !g.name || typeof g.wert !== 'number') f.push(`${id}: gegeben ${i + 1} braucht name und wert`); });
  }
  const text = JSON.stringify(a);
  // Doppeltes Minus ist seit 2026-10-24 erlaubt (Auftrag 21, Wunsch Vater); die Prüfung darauf ist entfernt.
  if (a.fach != null && !['mathe', 'physik'].includes(a.fach)) f.push(`${id}: fach muss mathe oder physik sein`);
  if (a.modus != null && a.modus !== 'knobeln') f.push(`${id}: unbekannter modus „${a.modus}“`);
  if (a.modus === 'knobeln' && !(Array.isArray(a.schritte) && a.schritte.length)) f.push(`${id}: knobeln braucht schritte für „In Schritten rechnen“`);
  if (a.modus === 'knobeln' && a.typ === 'schritte' && !(a.antwort && (typeof a.antwort.wert === 'number' || typeof a.antwort.mantisse === 'number'))) f.push(`${id}: knobeln braucht antwort (Ergebnisfeld)`);
  if (a.wissenspunkte != null && !(typeof a.wissenspunkte.knobeln === 'number' && typeof a.wissenspunkte.schritte === 'number')) f.push(`${id}: wissenspunkte braucht knobeln und schritte`);
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
        if (s.karten) {
          if (!Array.isArray(s.karten) || !s.karten.length || s.karten.some(k => !Array.isArray(k.optionen) || k.optionen.length < 2 || typeof k.richtig !== 'number' || !k.optionen[k.richtig]))
            f.push(`${id}: Schritt ${i + 1}: karten braucht je Platz optionen und richtig`);
        }
        else if (s.optionen) { if (typeof s.richtig !== 'number') f.push(`${id}: Schritt ${i + 1} braucht „richtig“`); }
        else if (s.linien_waehlen) {
          const r = s.linien_waehlen.richtig, n = ((a.bild || {}).linien || []).length;
          if (!Array.isArray(r) || !r.length || r.some(x => !Number.isInteger(x) || x < 0 || x >= n)) f.push(`${id}: Schritt ${i + 1}: linien_waehlen.richtig passt nicht zu bild.linien`);
        }
        else if (s.bruch) { if (typeof s.bruch.zaehler !== 'number' || typeof s.bruch.nenner !== 'number') f.push(`${id}: Schritt ${i + 1}: bruch braucht zaehler und nenner`); }
        else if (typeof s.wert !== 'number') f.push(`${id}: Schritt ${i + 1} braucht „wert“`);
      });
      break;
    case 'detektiv':
      if (!a.geschichte || !a.fremde_rechnung) f.push(`${id}: detektiv braucht geschichte und fremde_rechnung`);
      if (typeof a.stimmt !== 'boolean') f.push(`${id}: stimmt muss true oder false sein`);
      else if (a.stimmt && !a.bestaetigung) f.push(`${id}: bestaetigung fehlt`);
      else if (!a.stimmt) {
        if (!Array.isArray(a.fehler_optionen) || a.fehler_optionen.length < 2 || !Number.isInteger(a.fehler_richtig) || !a.fehler_optionen[a.fehler_richtig]) f.push(`${id}: fehler_optionen oder fehler_richtig fehlen`);
        if (!a.richtig_rechnen || typeof a.richtig_rechnen.wert !== 'number' || !a.richtig_rechnen.text) f.push(`${id}: richtig_rechnen braucht text und wert`);
      }
      break;
    case 'mehrfrage':
      if (!Array.isArray(a.fragen) || !a.fragen.length) f.push(`${id}: fragen fehlen`);
      else a.fragen.forEach((q, i) => { if (typeof q.wert !== 'number') f.push(`${id}: Frage ${i + 1} braucht „wert“`); });
      break;
    case 'zuordnung':
      if (!Array.isArray(a.gruppen) || a.gruppen.length < 2) f.push(`${id}: gruppen fehlen`);
      break;
    case 'zehnerpotenz': {
      const w = a.antwort || {};
      if (typeof w.mantisse !== 'number' || !Number.isInteger(w.exponent)) f.push(`${id}: antwort.mantisse und antwort.exponent fehlen`);
      else if (Math.abs(w.mantisse) < 1 || Math.abs(w.mantisse) >= 10) f.push(`${id}: mantisse muss zwischen 1 und 10 liegen`);
      break;
    }
    case 'formel': {
      const w = a.antwort || {};
      if (!['auswahl', 'karten', 'frei'].includes(a.eingabe)) f.push(`${id}: eingabe muss auswahl, karten oder frei sein`);
      if (!w.ziel || !w.formel || !Array.isArray(w.variablen)) { f.push(`${id}: antwort braucht ziel, formel und variablen`); break; }
      if (!pruefeFormelFn(`${w.ziel} = ${w.formel}`, w).richtig) f.push(`${id}: antwort.formel lässt sich nicht lesen`);
      if (a.eingabe === 'auswahl') {
        if (!Array.isArray(a.optionen) || typeof w.richtig !== 'number') f.push(`${id}: optionen oder antwort.richtig fehlen`);
        else a.optionen.forEach((o, k) => { if (pruefeFormelFn(o, w).richtig !== (k === w.richtig)) f.push(`${id}: Option ${k + 1} passt nicht zu antwort.richtig`); });
      }
      if (a.eingabe === 'karten' && !(Array.isArray(a.karten) && a.karten.includes(w.ziel) && a.karten.includes('='))) f.push(`${id}: karten brauchen die Zielgröße und „=“`);
      break;
    }
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

// ---------- Freiwilliger Taschenrechner bei großen Zahlen ----------
// Angeboten bei diesen Themen, wenn in der Aufgabe eine Zahl ab 100 vorkommt. Kostet die halbe Spielzeit.
export const RECHNER_OPTIONAL_THEMEN = ['minus-zahlen', 'reihenfolge', 'prozent', 'prozent-baukasten', 'prozent-formel', 'rabatt', 'neuer-preis', 'kreisdiagramm'];

export function groessteZahl(a) {
  const texte = [a.rechnung, a.geschichte, a.frage, ...(a.fragen || []).map(f => f.frage), ...(a.schritte || []).map(s => s.text || '')].filter(Boolean).join(' ');
  const werte = (texte.match(/\d+(?:[.,]\d+)?/g) || []).map(x => Number(x.replace(',', '.')));
  if (a.antwort && typeof a.antwort.wert === 'number') werte.push(Math.abs(a.antwort.wert));
  for (const t of [...(a.fragen || []), ...(a.schritte || []), ...(a.gegeben || [])]) if (typeof t.wert === 'number') werte.push(Math.abs(t.wert));
  return werte.length ? Math.max(...werte) : 0;
}

export function rechnerOptional(a) {
  return !a.taschenrechner && RECHNER_OPTIONAL_THEMEN.includes(a.thema) && groessteZahl(a) >= 100;
}
// Taschenrechner wäre hier erlaubt (Körper-Aufgaben oder große Zahlen) → im Kopf gerechnet gibt einen Bonus
export function rechnerZulaessig(a) {
  if (fachVon(a) === 'physik') return false; // Physik: Rechner frei, kein Kopf-Bonus
  return !!a.taschenrechner || rechnerOptional(a);
}
// Rechner frei (ohne Abzug): Aufgaben mit taschenrechner und alle Physik-Aufgaben
export const rechnerFrei = (a) => !!(a && (a.taschenrechner || fachVon(a) === 'physik'));
// Freiwilliger Rechner wird bei jeder Aufgabe angeboten (kostet Spielzeit), außer dort, wo er ohnehin erlaubt ist
export function rechnerAnbieten(a) {
  return !rechnerFrei(a) && !['auswahl', 'zuordnung', 'formel'].includes(a.typ);
}
// Kopf-Bonus: Rechner erlaubt, nicht geöffnet, App nicht verlassen, Aufgabe gelöst
export function kopfBonus({ aufgabe, rechnerGenutzt, verlassen, ergebnis }) {
  return rechnerZulaessig(aufgabe) && !rechnerGenutzt && !verlassen && (ergebnis === 'erst' || ergebnis === 'zweit');
}

// ---------- Wissenspunkte (nur Gestaltung Sternzeit) ----------
// Mit Feld wissenspunkte: knobeln = ohne Schritte gelöst, schritte = mit Schritten. Sonst 1 fürs Lösen, +1 im 1. Versuch.
export function wissenspunkteFuer(a, { ergebnis, schritte }) {
  if (!a || ergebnis === 'loesung') return 0;
  const wp = a.wissenspunkte;
  if (wp && typeof wp.knobeln === 'number' && typeof wp.schritte === 'number') return schritte ? wp.schritte : wp.knobeln;
  return 1 + (ergebnis === 'erst' ? 1 : 0);
}

// ---------- Einstellungen aus der Eltern-App ----------

// Wendet daten/<name>/einstellungen.json auf den Zustand an (nur wenn die Version neuer ist).
// Baukasten-Stufen werden nur übernommen, wenn sie in einer neueren Version geändert wurden,
// damit die App sie zwischendurch weiter selbst anpassen kann.
import { splitterVon, fernAnwenden as fernSplitter } from './splitter.js';
import { bzRegeln, szRegeln, uzRegeln } from './bildschirm.js';
export const GESTALTUNGEN = ['schrein', 'sternzeit'];
// Bedienung pro Kind (Wünsche aus Aliatras erster Nutzung, 2026-10-22). Schlüssel in einstellungen.json → Feld in S.einstellungen, Standard.
export const BEDIENUNG = [
  { k: 'satzweise', f: 'satzweise', std: true, titel: 'Geschichten Satz für Satz', text: 'Längere Geschichten kommen Satz für Satz mit „Nächster Satz“. Aus: der ganze Text steht gleich da.' },
  { k: 'verstanden', f: 'verstandenKnopf', std: true, titel: '„Verstanden“ nach einem Fehler', text: 'Nach einer falschen Antwort muss der Tipp mit „Verstanden“ bestätigt werden. Aus: der Tipp bleibt stehen, weitertippen genügt.' },
  { k: 'spielzeit_zeigen', f: 'spielzeitZeigen', std: true, titel: 'Spielzeit und Spiele zeigen', text: 'Aus: keine Spielzeit, kein „Abholen“, keine Spiele und keine Minuten in der Aufgabe. Bildschirmzeit bleibt, wenn sie an ist.' },
  { k: 'rechner_frei', f: 'rechnerFrei', std: false, titel: 'Taschenrechner immer ohne Abzug', text: 'An: Der Taschenrechner kostet nie Zeit.' },
  { k: 'umformen_sofort', f: 'umformenSofort', std: false, titel: 'Gleichungen gleich in Schritten umformen', text: 'An: Gleichungen starten direkt mit „In Schritten umformen“, ohne Abzug bei den Wissenspunkten.' }
];
// Kürzel mit Namen (Auftrag 35): Auswahl bei Körpern zeigt „V (Volumen)“, „A_O (Oberfläche)“ …
export const KOERPER_THEMEN = ['zylinder', 'kegel', 'pyramide', 'kugel'];
const KUERZEL_VON = { 'Volumen': 'V', 'Oberfläche': 'A_O', 'Mantel': 'A_M', 'Grundfläche': 'A_G' };
export function mitKuerzel(o) {
  const m = String(o).match(/^(Volumen|Oberfläche|Mantel|Grundfläche)(?:\s+(?:V|A_[OMG]))?(?:\s*\((.+)\))?$/);
  return m ? `${KUERZEL_VON[m[1]]} (${m[1]}${m[2] ? ', ' + m[2] : ''})` : String(o);
}
// Lösungsweg bei Körpern: „→ Volumen“ wird „→ V (Volumen)“
export function kuerzelAufgabe(a) {
  if (!a || !KOERPER_THEMEN.includes(a.thema) || !Array.isArray(a.loesungsweg)) return a;
  const lw = a.loesungsweg.map(z => typeof z === 'string' ? z.replace(/→\s*(Volumen|Oberfläche|Mantel|Grundfläche)\b(?!\s*\()/g, (_, w) => `→ ${KUERZEL_VON[w]} (${w})`) : z);
  return lw.some((z, i) => z !== a.loesungsweg[i]) ? { ...a, loesungsweg: lw } : a;
}
export const FREIGABEN = ['minusminus', 'prozent_formel'];
// Befristete Grenzen pro Kind (Auftrag 36), aus einstellungen.json → werte.befristet:
// { bis: 'JJJJ-MM-TT', stufe_max: { <generator>: 1–3 }, einmaleins_geteilt: 0–3 (von 3 im Block), prozent: [Prozentsätze] }
export function befristetNorm(b) {
  if (!b || typeof b !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(b.bis || '')) return null;
  const n = { bis: b.bis };
  if (b.stufe_max && typeof b.stufe_max === 'object') {
    const sm = Object.fromEntries(Object.entries(b.stufe_max).filter(([k, v]) => /^[a-z0-9-]+$/.test(k) && [1, 2, 3].includes(v)));
    if (Object.keys(sm).length) n.stufe_max = sm;
  }
  if ([0, 1, 2, 3].includes(b.einmaleins_geteilt)) n.einmaleins_geteilt = b.einmaleins_geteilt;
  if (Array.isArray(b.prozent)) { const l = [...new Set(b.prozent.filter(x => Number.isInteger(x) && x > 0 && x < 100))].sort((x, y) => x - y); if (l.length) n.prozent = l; }
  return n;
}
export const befristetAktiv = (z, heute) => (z && z.befristet && heute <= z.befristet.bis ? z.befristet : null);
// Feste Aufgabe in der befristeten Zeit erlaubt? Prozent/Rabatt nur mit den erlaubten Sätzen, Mal 10 ohne Zahlen mit zwei Nachkommastellen
export function befristetErlaubt(a, bef) {
  if (!bef || !a) return true;
  const PT = ['prozent', 'rabatt', 'neuer-preis', 'prozent-baukasten'];
  if (a.generator) {
    if (bef.prozent && PT.includes(a.thema) && typeof (a.parameter || [])[0] === 'number' && !bef.prozent.includes(a.parameter[0])) return false;
    const sm = bef.stufe_max && bef.stufe_max[String(a.generator).replace(/^block-/, '')];
    if (sm && (a.stufe || 1) > sm) return false;
    return true;
  }
  const txt = [a.rechnung, a.frage, a.geschichte, a.fremde_rechnung].filter(x => typeof x === 'string').join(' ');
  if (bef.prozent && PT.includes(a.thema)) {
    const saetze = [...txt.matchAll(/(\d+)\s*%/g)].map(m => Number(m[1]));
    if (saetze.some(x => !bef.prozent.includes(x))) return false;
  }
  if (bef.stufe_max && bef.stufe_max.mal10 && bef.stufe_max.mal10 < 3 && a.thema === 'mal-10' && /\d,\d\d/.test(txt)) return false;
  return true;
}
// Mal 10 / durch 10 (Auftrag 36): Fehler erkennen und Stellentafel zeigen
const ziffern = (v) => String(Math.round(Math.abs(v) * 1000) / 1000).replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
export function mal10Fehler(rechnung, w, ziel) {
  const m = /^\s*(\d+(?:,\d+)?)\s*([·:])\s*10\s*=?\s*$/.exec(String(rechnung || ''));
  if (!m) return null;
  const x = Number(m[1].replace(',', '.')), mal = m[2] === '·';
  const tafel = { x, mal };
  if (gleich(w, x)) return { typ: 'mal10-nicht-verschoben', text: `Die Zahl muss sich ändern. Mal 10 wird größer, durch 10 wird kleiner.`, tafel };
  if (ziffern(w) === ziffern(ziel)) {
    if (mal ? w < x : w > x) return { typ: 'mal10-falsche-richtung', text: mal ? 'Mal 10 wird die Zahl größer.' : 'Durch 10 wird die Zahl kleiner.', tafel };
    return { typ: 'mal10-stellen', text: 'Das Komma rutscht genau eine Stelle. Nicht mehr.', tafel };
  }
  return { typ: 'mal10-ziffer-weg', text: 'Alle Ziffern bleiben. Nur das Komma rutscht.', tafel };
}
// Themen, die erst ab ihrem Freigabedatum kommen (Auftrag 30). Steht so ein Thema im Wochenplan unter „gesperrt“, wird es ab dem Datum frei.
export const FREIGABE_THEMEN = { 'prozent-formel': 'prozent_formel' };
export const themaFreigegeben = (z, thema, heute) => !FREIGABE_THEMEN[thema] || freigegeben(z, FREIGABE_THEMEN[thema], heute);
export const freigegeben = (z, k, heute) => !!(z && z.freigaben && z.freigaben[k] && z.freigaben[k] <= heute);
export const bedienung = (e, k) => { const b = BEDIENUNG.find(x => x.k === k); return typeof (e || {})[b.f] === 'boolean' ? e[b.f] : b.std; };
import { paketeAusWerte } from './lernplan.js';
import { pruefeFormel as pruefeFormelFn, pruefeGueltig } from './physik.js';

export function fernAnwenden(z, datei) {
  const alt = (z.fern && z.fern.version) || 0;
  if (!datei || typeof datei !== 'object' || !(Number(datei.version) > alt)) return null;
  const w = datei.werte || {};
  const geaendert = [];
  const e = z.einstellungen;
  if (THEMEN.includes(w.thema) && w.thema !== e.thema) { e.thema = w.thema; geaendert.push('thema'); }
  const stunde = x => Number.isInteger(x) && x >= 0 && x <= 24;
  if (stunde(w.basisVon) && stunde(w.basisBis)) {
    const von = Math.min(w.basisVon, w.basisBis), bis = Math.max(w.basisVon, w.basisBis);
    if (von !== e.basisVon || bis !== e.basisBis) { e.basisVon = von; e.basisBis = bis; geaendert.push('basiszeit'); }
  }
  if (typeof w.rechnerAngebot === 'boolean' && w.rechnerAngebot !== (e.rechnerAngebot !== false)) { e.rechnerAngebot = w.rechnerAngebot; geaendert.push('rechnerAngebot'); }
  // Lange Hinweise: 0 gleich lang, 1 frei, 2 halbe Spielzeit, 3 aus
  if ([0, 1, 2, 3].includes(w.langeHinweise) && w.langeHinweise !== (e.langeHinweise ?? 1)) { e.langeHinweise = w.langeHinweise; geaendert.push('langeHinweise'); }
  // „In Schritten umformen“: Start-Stufe (3 beide Seiten selbst, 2 eine Seite, 1 die App vereinfacht)
  if ([1, 2, 3].includes(w.umform_stufe) && w.umform_stufe !== (e.umformStufe ?? 3)) { e.umformStufe = w.umform_stufe; geaendert.push('umformStufe'); }
  for (const b of BEDIENUNG) if (typeof w[b.k] === 'boolean' && w[b.k] !== bedienung(e, b.k)) { e[b.f] = w[b.k]; geaendert.push(b.f); }
  // Spielzeit im Schrein: Höchstwert pro Tag und „nur heute mehr“
  if (w.spielzeitTag && typeof w.spielzeitTag === 'object') {
    const neu = szRegeln(w.spielzeitTag);
    if (JSON.stringify(neu) !== JSON.stringify(szRegeln(z.szRegeln))) geaendert.push('spielzeitTag');
    z.szRegeln = neu;
  }
  if (w.spielzeit) {
    const neu = spielzeitRegeln(w.spielzeit);
    if (JSON.stringify(neu) !== JSON.stringify(spielzeitRegeln(z.spielzeit))) geaendert.push('spielzeit');
    z.spielzeit = neu;
  }
  // Bildschirmzeit: an/aus, Faktor, Höchstwert pro Tag, „nur heute mehr“
  if (w.bildschirm && typeof w.bildschirm === 'object') {
    const neu = bzRegeln(w.bildschirm);
    if (JSON.stringify(neu) !== JSON.stringify(bzRegeln(z.bzRegeln))) geaendert.push('bildschirm');
    z.bzRegeln = neu;
  }
  // Mehrere Pakete pro Kind mit Rolle, Anteil und Etappe (ein altes „paket“ wird ein Grundpaket mit 100 %)
  const liste = paketeAusWerte(w);
  if (liste) {
    // Etappen, die die App selbst weitergeschaltet hat („weiter: automatisch“), bleiben stehen,
    // solange die Eltern-App die Etappe dieses Pakets nicht geändert hat
    const vorher = z.fernEtappen || {};
    for (const p of liste) {
      const lokal = (z.pakete || []).find(x => x.id === p.id);
      if (lokal && p.etappe != null && vorher[p.id] === p.etappe && (lokal.etappe || 0) > p.etappe) p.etappe = lokal.etappe;
    }
    z.fernEtappen = Object.fromEntries(liste.filter(p => p.etappe != null).map(p => [p.id, (w.pakete || []).find(x => x && x.id === p.id)?.etappe ?? p.etappe]));
    if (JSON.stringify(liste) !== JSON.stringify(z.pakete || null)) geaendert.push('pakete');
    z.pakete = liste;
    z.abweichungen = w.abweichungen && typeof w.abweichungen === 'object' ? { ...w.abweichungen } : {};
  }
  // Freigaben pro Kind mit Datum (Auftrag 21): minusminus = doppeltes Minus und Minus vor Klammer mit Minus innen
  if (w.freigaben && typeof w.freigaben === 'object') {
    const neu = {};
    for (const k of FREIGABEN) if (/^\d{4}-\d{2}-\d{2}$/.test(w.freigaben[k] || '')) neu[k] = w.freigaben[k];
    if (JSON.stringify(neu) !== JSON.stringify(z.freigaben || {})) geaendert.push('freigaben');
    z.freigaben = neu;
  }
  // Befristete Grenzen (Auftrag 36): bis einschließlich „bis“, danach wie vorher
  {
    const neu = befristetNorm(w.befristet);
    if (JSON.stringify(neu) !== JSON.stringify(z.befristet || null)) geaendert.push('befristet');
    if (neu) z.befristet = neu; else delete z.befristet;
  }
  // Wochenplan und Eingriffe der Eltern (Auftrag 24): unverändert übernehmen, geprüft wird in js/wochenplan.js.
  // Fehlt der Abschnitt, ist kein Plan da (die App arbeitet wie bisher).
  {
    const wp = w.wochenplan && typeof w.wochenplan === 'object' ? JSON.parse(JSON.stringify(w.wochenplan)) : null;
    const ein = Array.isArray(w.eingriffe) ? JSON.parse(JSON.stringify(w.eingriffe)) : [];
    if (JSON.stringify(wp) !== JSON.stringify(z.wochenplan ?? null)) geaendert.push('wochenplan');
    if (JSON.stringify(ein) !== JSON.stringify(z.eingriffe || [])) geaendert.push('eingriffe');
    z.wochenplan = wp; z.eingriffe = ein;
  }
  // Feedback-Knopf pro Kind (Testgeräte haben ihn immer)
  if (typeof w.feedback === 'boolean' && w.feedback !== !!z.feedbackAn) { z.feedbackAn = w.feedback; geaendert.push('feedback'); }
  // Live-Anzeige pro Kind: App meldet „übt“, „spielt“, „weg“ nach daten/<name>/live.json
  if (typeof w.live === 'boolean' && w.live !== !!z.liveAn) { z.liveAn = w.live; geaendert.push('live'); }
  if (typeof w.etappe_anzeigen === 'boolean' && w.etappe_anzeigen !== !!z.etappeAnzeigen) { z.etappeAnzeigen = w.etappe_anzeigen; geaendert.push('etappeAnzeigen'); }
  // Gestaltung pro Kind: schrein (Standard) oder sternzeit („Logbuch Sternzeit“)
  if (GESTALTUNGEN.includes(w.gestaltung) && w.gestaltung !== (z.gestaltung || 'schrein')) { z.gestaltung = w.gestaltung; geaendert.push('gestaltung'); }
  if (typeof w.ansicht_name === 'string' && w.ansicht_name.trim().slice(0, 30) !== (z.ansichtName || '')) { z.ansichtName = w.ansicht_name.trim().slice(0, 30); geaendert.push('ansichtName'); }
  // Übungszeit pro Tag (an, max, nachlauf_prozent, extra nur heute)
  if (w.uebungszeit && typeof w.uebungszeit === 'object') {
    const neu = uzRegeln(w.uebungszeit);
    if (JSON.stringify(neu) !== JSON.stringify(uzRegeln(z.uzRegeln))) geaendert.push('uebungszeit');
    z.uzRegeln = neu;
  }
  // Aufgabenpaket mit Gewichten je Thema (0 aus, 1 wenig, 2 normal, 4 viel)
  if (w.paket && typeof w.paket === 'object' && w.gewichte && typeof w.gewichte === 'object') {
    const gewichte = {};
    for (const t of THEMEN) { const v = Number(w.gewichte[t]); gewichte[t] = [0, 1, 2, 4].includes(v) ? v : 0; }
    if (Object.values(gewichte).some(v => v > 0)) {
      const neu = { id: String(w.paket.id || '').slice(0, 40), name: String(w.paket.name || '').slice(0, 40), gewichte };
      if (JSON.stringify(neu) !== JSON.stringify(z.paket || null)) geaendert.push('paket');
      z.paket = neu;
    }
  }
  if (w.genStufen && typeof w.genStufen === 'object') {
    for (const [g, v] of Object.entries(w.genStufen)) {
      if (!/^[a-z0-9-]{1,30}$/.test(g) || !v || !(Number(v.v) > alt)) continue;
      const stufe = Math.max(1, Math.min(3, Math.round(Number(v.stufe)) || 1));
      z.genStufen[g] = { stufe, folge: 0 };
      geaendert.push('stufe:' + g);
    }
  }
  // Runensplitter: Preise, Bonus, von Hand freigeschaltete Spiele
  if (w.splitter && typeof w.splitter === 'object') {
    z.splitter = splitterVon(z.splitter);
    if (fernSplitter(z.splitter, w.splitter).length) geaendert.push('splitter');
  }
  z.fern = { ...(z.fern || {}), version: Number(datei.version), geaendert: datei.geaendert || null, angewendet: new Date().toISOString() };
  return geaendert;
}

// ---------- „Hilf mir“ ----------
// Zeigt Zeilen aus dem Lösungsweg, aber das Ergebnis der neuesten Zeile ist verdeckt („?“).
// Verdeckt wird alles nach dem letzten „=“, „≈“ oder „→“.
export function verdecken(zeile) {
  const s = String(zeile || '');
  const m = [...s.matchAll(/=|≈|→/g)].pop();
  if (!m) return null;
  return s.slice(0, m.index + m[0].length) + ' ?';
}

// Welche Lösungsweg-Zeilen gehören zum aktuellen Teil?
// weg: Zeilen, anzahlTeile: Teile ohne Merkzettel, teilNr: aktueller Teil (ohne Merkzettel, ab 0)
export function hilfeZeilen(weg, anzahlTeile, teilNr) {
  const n = (weg || []).length;
  if (!n) return [];
  if (anzahlTeile <= 1) return weg.map((_, i) => i);   // eine Frage: Schritt für Schritt
  if (n === anzahlTeile) return [teilNr];                // je Teil eine Zeile
  return [Math.min(teilNr, n - 1)];
}

// Was „Hilf mir“ nach `stufe` Mal Tippen zeigt: frühere Zeilen offen, die neueste verdeckt.
// Gibt { zeilen: [text], mehr: bool } zurück. Zeilen ohne „=“ usw. lassen sich nicht verdecken und werden übersprungen.
export function hilfeAnzeige(weg, anzahlTeile, teilNr, stufe) {
  const idx = hilfeZeilen(weg, anzahlTeile, teilNr).filter(i => verdecken(weg[i]));
  const k = Math.max(1, Math.min(stufe, idx.length));
  if (!idx.length) return { zeilen: [], mehr: false };
  const zeilen = idx.slice(0, k).map((i, j) => j === k - 1 ? verdecken(weg[i]) : weg[i]);
  return { zeilen, mehr: k < idx.length };
}

// ---------- Textaufgaben ----------
// Geschichte in Sätze teilen (für „Satz für Satz“)
export function saetzeVon(text) {
  return String(text || '').split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"0-9−])/).map(s => s.trim()).filter(Boolean);
}
// Zu schnelle Antwort: zählt nicht als Versuch (Raten bringt nichts, kein Abzug).
// 'text': erster Versuch einer Textaufgabe; 'tipp': nach einem Fehler, bei allen Aufgaben (Auftrag 18). Sonst false.
export const TEXT_MINDEST_MS = 4000;
export function zuSchnell(aufgabe, teil, ms) {
  if ((teil && teil.merk) || !(ms < TEXT_MINDEST_MS)) return false;
  if (teil && (teil.versuche || []).some(v => !v.richtig)) return 'tipp';
  return aufgabe && aufgabe.geschichte ? 'text' : false;
}
// Fehler-Detektiv (Auftrag 18): Ist die Eingabe ein Ergebnis aus der fremden Rechnung? (bis auf die letzte Stelle)
export function fremdeZahl(a, wert) {
  if (!a || a.typ !== 'detektiv' || !Number.isFinite(wert)) return false;
  const zahlen = [...String(a.fremde_rechnung || '').matchAll(/[=≈]\s*([−-]?\d[\d.]*(?:,\d+)?)/g)]
    .map(m => Number(m[1].replace(/\./g, '').replace(',', '.').replace('−', '-')));
  const r = a.richtig_rechnen && Number.isInteger(a.richtig_rechnen.runden) ? a.richtig_rechnen.runden : 2;
  const tol = Math.pow(10, -r) + 1e-9;
  const richtig = a.richtig_rechnen ? Number(a.richtig_rechnen.wert) : NaN;
  // Liegt die fremde Zahl selbst nah an der richtigen (Rundungsfehler), zählt nur genau dieselbe Zahl
  return zahlen.some(z => Number.isFinite(z) && (Math.abs(z - richtig) <= tol ? Math.abs(z - wert) < 1e-9 : Math.abs(z - wert) <= tol));
}
// Name aus der Detektiv-Geschichte im Genitiv: „Pauls“, „Max’“ (null ohne Namen)
export function fremderGenitiv(a) {
  const name = String((a && a.geschichte) || '').split(/\s+/)[0] || '';
  if (!/^[A-ZÄÖÜ][a-zäöüß]+$/.test(name)) return null;
  return name + (/[sxzß]$/.test(name) ? '’' : 's');
}

// Rechnung legen: gewählte Kärtchen prüfen. wahl = [Index je Platz]. Gibt { richtig, falsch: [Plätze] } zurück.
export function pruefeKarten(karten, wahl) {
  const falsch = karten.map((k, i) => (wahl[i] === k.richtig ? -1 : i)).filter(i => i >= 0);
  return { richtig: !falsch.length, falsch };
}

// ---------- Nach „Zeig mir die Lösung“ (Auftrag 32) ----------
export const LOESUNG_SPERRE_MS = 20 * 60 * 1000; // dieselbe feste Aufgabe frühestens nach 20 Minuten Übungszeit
// Art einer Baukasten-Aufgabe: gleiche Form bzw. gleiche Wörter vorne in parameter (z. B. Zylinder „O“ mit „r“,
// Reihenfolge „klammer_negativ“ mit „z“), beim Runden die Stellenzahl, bei Potenzen die Hochzahl.
export function artSchluessel(a) {
  if (!a || !a.generator) return '';
  const p = Array.isArray(a.parameter) ? a.parameter : [];
  if (a.generator === 'runden') return 'stellen:' + p[1];
  if (a.generator === 'potenz') return 'hoch:' + p[1];
  if (a.generator === 'zylinder' && p[0] !== 'gesucht4') return [a.form || '', p[0], p[1], p[4] === 'x' ? 'ohne' : 'geschichte'].join('|');
  const vorne = [];
  for (const x of p) { if (typeof x !== 'string' || /^-?[\d,.]+$/.test(x)) break; vorne.push(x); }
  return [a.form || '', ...vorne].join('|');
}
// Ergebnis zählt als „1. Versuch“? Nicht, wenn dieselbe Aufgabe nach einer gezeigten Lösung wiederkam.
export const erstZaehlt = (ende) => !!ende && ende.ergebnis === 'erst' && !ende.gleiche_aufgabe;
