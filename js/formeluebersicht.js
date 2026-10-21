// Kurz-Hinweise in Formelübersicht-Form (Auftrag 11-auftrag-kurz-hinweise.md, Vorlage 10-formeluebersicht-vorlage.html).
// Zeigt Abschnitte der Formelübersicht so, wie sie auf dem Blatt stehen: Zeichen, Titel, Formeln, Skizze. Keine Beispiele, keine Tipps.
// Reine Funktionen ohne DOM (testbar mit node). Daten: data/formeluebersicht.json.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// „K_n : Kapital“ → K<sub>n</sub>
const tief = (s) => esc(s).replace(/([A-Za-z])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');

// Kleine Abschnitte stehen auf dem Blatt paarweise nebeneinander
export const PAARE = [['dichte', 'tempo'], ['rechteck', 'trapez'], ['wuerfel', 'quader']];

// Stufen für lange Hinweise (Eltern-App, pro Kind): 1 frei, 2 halbe Spielzeit, 3 aus
export const LANG_STUFEN = [
  { stufe: 1, name: 'Frei', text: '„Mehr Hilfe“ kostet nichts' },
  { stufe: 2, name: 'Halbe Zeit', text: '„Mehr Hilfe“ halbiert die Spielzeit' },
  { stufe: 3, name: 'Aus', text: 'nur Formelübersicht' }
];
export const langStufe = (x) => ([1, 2, 3].includes(Number(x)) ? Number(x) : 1);

export const LEER_TEXT = 'In der Formelübersicht steht dazu nichts. Das rechnest du im Kopf.';

function zeichen(daten, id, size) {
  const z = daten.zeichen_svg[id] || '';
  return z.replace(/width="24" height="24"/, `width="${size}" height="${size}"`);
}

function zufallInhalt() {
  return `<div class="zf"><div>Sind alle Ergebnisse bei einem Zufallsexperiment gleich wahrscheinlich, so gilt für ein Ereignis A:</div>
<div class="zf-f">P(A) = <span class="fr"><span>Anzahl der für A günstigen Ergebnisse</span><span>Anzahl der möglichen Ergebnisse</span></span></div>
<div class="zf-e">P(A) : Wahrscheinlichkeit von A</div>
<div><b>Produktregel:</b> Die Wahrscheinlichkeit eines Ergebnisses ist gleich dem Produkt der Wahrscheinlichkeiten entlang des jeweiligen Pfades im Baumdiagramm. &#160;Bsp.: P(D) = p₁ · p₄</div>
<div><b>Summenregel:</b> Die Wahrscheinlichkeit eines Ereignisses ist gleich der Summe der Wahrscheinlichkeiten aller Pfade, die für dieses Ereignis günstig sind. &#160;Bsp.: H = {D, E}: P(H) = p₁ · p₄ + p₂ · p₅</div></div>`;
}

// Eine Zeile der Formelübersicht
export function abschnittHtml(daten, a, { halb = false } = {}) {
  const kopf = `<div class="nm">${zeichen(daten, a.id, halb ? 30 : 34)}<div><p class="nt" style="color:${a.farbe}">${esc(a.titel)}</p>${a.zusatz ? `<div class="nz">${esc(a.zusatz)}</div>` : ''}</div></div>`;
  let fx;
  if (a.id === 'zufall') fx = zufallInhalt();
  else {
    const zeilen = a.formeln.map(f => `<div class="lb${f.blass ? ' bl' : ''}">${esc(f.bezeichnung)}</div><div class="f${f.blass ? ' bl' : ''}">${f.html || esc(f.text)}</div>`).join('');
    const vr = a.erklaerungen.length ? `<div class="vr">${a.erklaerungen.map(e => `<span>${tief(e)}</span>`).join('')}</div>` : '';
    fx = `<div class="fx">${zeilen}${vr}</div>`;
  }
  const sk = a.skizze && daten.skizzen_svg[a.skizze] ? daten.skizzen_svg[a.skizze] : '';
  return `<div class="row${halb ? ' half' : ''}${a.blass ? ' blass' : ''}" data-abschnitt="${a.id}" style="border-left-color:${a.farbe}">${kopf}<div class="hb">${fx}${sk ? `<div class="sk">${sk}</div>` : ''}</div></div>`;
}

export const abschnittVon = (daten, id) => daten.abschnitte.find(a => a.id === id);

// Abschnitte zu einem Hinweis (Zuordnung aus 10-formeluebersicht.json). [] = steht nicht drauf.
export function abschnitteFuer(daten, hinweisId) {
  return ((daten.zuordnung_hinweis_zu_abschnitt || {})[hinweisId] || []).map(id => abschnittVon(daten, id)).filter(Boolean);
}

// Kurzversion für ein Sheikah-Zeichen
export function kurzHtml(daten, hinweisId) {
  const ab = abschnitteFuer(daten, hinweisId);
  if (!ab.length) return `<div class="fue"><p class="fue-leer">${LEER_TEXT}</p></div>`;
  return `<div class="fue">${ab.map(a => abschnittHtml(daten, a)).join('')}</div>`;
}

// Eine Seite der ganzen Formelübersicht (1 oder 2)
export function seiteHtml(daten, nr) {
  const liste = daten.abschnitte.filter(a => a.seite === nr);
  const fertig = new Set();
  let html = '';
  for (const a of liste) {
    if (fertig.has(a.id)) continue;
    const paar = PAARE.find(p => p[0] === a.id);
    if (paar) {
      html += `<div class="pair">${paar.map(id => abschnittHtml(daten, abschnittVon(daten, id), { halb: true })).join('')}</div>`;
      paar.forEach(id => fertig.add(id));
    } else { html += abschnittHtml(daten, a); fertig.add(a.id); }
  }
  return `<div class="fue fue-seite"><div class="fue-kopf"><h2>Formelübersicht</h2><span>Seite ${nr} von 2</span></div><p class="fue-info">Nur das, was auch auf dem offiziellen Blatt steht. Blasse Teile brauchst du nicht.</p>${html}</div>`;
}
