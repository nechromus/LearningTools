// Runensplitter: Währung für Lern-Erfolge. Damit werden neue Spiele freigeschaltet.
// Getrennt von der Spielzeit (kein Umtausch). Reine Logik ohne DOM (testbar mit node).

// Neue Spiele in der Reihenfolge, in der sie freigeschaltet werden (Wunsch Vater)
export const NEUE_SPIELE = [
  { id: 'steinschieber', name: 'Steinschieber', fertig: true },
  { id: 'runenfall', name: 'Runenfall', fertig: false },
  { id: 'runenreihen', name: 'Runenreihen', fertig: false },
  { id: 'hoehlenkarte', name: 'Höhlenkarte', fertig: false },
  { id: 'runenbrecher', name: 'Runenbrecher', fertig: false },
  { id: 'jadeschlange', name: 'Jadeschlange', fertig: false }
];
// Das erste Spiel ist schnell erreicht (etwa eine Übungsrunde), damit das Kind versteht, wie es funktioniert
export const PREISE_STANDARD = [30, 150, 200, 250, 300, 350];

// Wofür es Splitter gibt (Text für die Erfolge-Seite und die Eltern-App)
export const GRUENDE = {
  aufgabe: 'Aufgabe gelöst',
  erst: 'Im 1. Versuch richtig',
  folge5: '5 am Stück richtig',
  folge10: '10 am Stück richtig',
  comeback: 'Aufgabe von früher jetzt gelöst',
  drangeblieben: 'Drangeblieben: wartende Aufgabe gelöst',
  tagesziel: 'Tagesziel: 10 Aufgaben',
  tage3: '3 Tage am Stück',
  tage7: '7 Tage am Stück',
  stufe: 'Eine Stufe aufgestiegen',
  gemeistert: 'Thema auf höchster Stufe',
  bonus: 'Bonus von den Eltern',
  freigeschaltet: 'Spiel freigeschaltet'
};

export const TAGESZIEL = 10;

export function neuerSplitter() {
  return { stand: 0, gesamt: 0, verlauf: [], frei: [], folgeErst: 0, zielTag: null, tage: { letzter: null, zahl: 0 }, gemeistert: [], boni: [], preise: null };
}

// Fehlende Felder ergänzen (ältere Spielstände)
export function splitterVon(sp) {
  return { ...neuerSplitter(), ...(sp && typeof sp === 'object' ? sp : {}) };
}

export function gutschreiben(sp, n, grund, text = null, jetzt = new Date()) {
  const e = { t: jetzt.toISOString(), n, grund, text: text || GRUENDE[grund] || grund };
  sp.stand = Math.max(0, sp.stand + n);
  if (n > 0) sp.gesamt += n;
  sp.verlauf = [e, ...sp.verlauf].slice(0, 200);
  return e;
}

const tagVorher = (tag) => {
  const d = new Date(tag + 'T12:00');
  d.setDate(d.getDate() - 1);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Nach einer fertigen Aufgabe. info: { ergebnis, wiederholung, wartete, tagAufgaben, stufeHoch, stufeNeu, generator, heute }
// Gibt die neuen Einträge zurück (für die Anzeige im Ergebnis).
export function nachAufgabe(sp, info, jetzt = new Date()) {
  const neu = [];
  const plus = (n, grund) => neu.push(gutschreiben(sp, n, grund, null, jetzt));
  const geloest = info.ergebnis === 'erst' || info.ergebnis === 'zweit';
  if (geloest) plus(1, 'aufgabe');
  if (info.ergebnis === 'erst') {
    plus(1, 'erst');
    sp.folgeErst = (sp.folgeErst || 0) + 1;
    if (sp.folgeErst === 5) plus(3, 'folge5');
    if (sp.folgeErst % 10 === 0) plus(6, 'folge10');
  } else {
    sp.folgeErst = 0;
  }
  if (geloest && info.wiederholung) plus(2, 'comeback');
  if (geloest && info.wartete) plus(2, 'drangeblieben');
  if (info.stufeHoch) {
    plus(5, 'stufe');
    if (info.stufeNeu >= 3 && info.generator && !sp.gemeistert.includes(info.generator)) {
      sp.gemeistert = [...sp.gemeistert, info.generator];
      plus(15, 'gemeistert');
    }
  }
  if (info.tagAufgaben >= TAGESZIEL && sp.zielTag !== info.heute) {
    sp.zielTag = info.heute;
    plus(5, 'tagesziel');
    const t = sp.tage || { letzter: null, zahl: 0 };
    t.zahl = t.letzter === tagVorher(info.heute) ? t.zahl + 1 : 1;
    t.letzter = info.heute;
    sp.tage = t;
    if (t.zahl === 3) plus(10, 'tage3');
    if (t.zahl > 0 && t.zahl % 7 === 0) plus(25, 'tage7');
  }
  return neu;
}

export const preise = (sp) => (Array.isArray(sp.preise) && sp.preise.length === NEUE_SPIELE.length ? sp.preise : PREISE_STANDARD);

// Das nächste Spiel, das freigeschaltet werden kann: { spiel, preis, fehlt } oder null (alles frei)
export function naechstes(sp) {
  const i = NEUE_SPIELE.findIndex(g => !sp.frei.includes(g.id));
  if (i < 0) return null;
  const preis = preise(sp)[i];
  return { spiel: NEUE_SPIELE[i], index: i, preis, fehlt: Math.max(0, preis - sp.stand) };
}

// Freischalten (nur das nächste Spiel, nur wenn es fertig ist und genug Splitter da sind)
export function freischalten(sp, id, jetzt = new Date()) {
  const n = naechstes(sp);
  if (!n || n.spiel.id !== id || !n.spiel.fertig || n.fehlt > 0) return null;
  sp.frei = [...sp.frei, id];
  return gutschreiben(sp, -n.preis, 'freigeschaltet', `${n.spiel.name} freigeschaltet`, jetzt);
}

export const istFrei = (sp, id) => sp.frei.includes(id);

// Aus der Eltern-App: { preise: [6 Zahlen], boni: [{ id, n, text }], frei: [ids] }. Gibt Änderungen zurück.
export function fernAnwenden(sp, w, jetzt = new Date()) {
  const geaendert = [];
  if (!w || typeof w !== 'object') return geaendert;
  if (Array.isArray(w.preise) && w.preise.length === NEUE_SPIELE.length && w.preise.every(p => Number.isInteger(p) && p >= 0 && p <= 5000)) {
    if (JSON.stringify(w.preise) !== JSON.stringify(sp.preise)) { sp.preise = w.preise.slice(); geaendert.push('preise'); }
  }
  for (const b of Array.isArray(w.boni) ? w.boni : []) {
    if (!b || typeof b.id !== 'string' || sp.boni.includes(b.id)) continue;
    const n = Math.round(Number(b.n));
    if (!(n > 0 && n <= 500)) continue;
    sp.boni = [...sp.boni, b.id].slice(-200);
    gutschreiben(sp, n, 'bonus', 'Bonus: ' + String(b.text || 'von den Eltern').slice(0, 80), jetzt);
    geaendert.push('bonus');
  }
  for (const id of Array.isArray(w.frei) ? w.frei : []) {
    if (NEUE_SPIELE.some(g => g.id === id) && !sp.frei.includes(id)) {
      sp.frei = [...sp.frei, id];
      gutschreiben(sp, 0, 'freigeschaltet', `${NEUE_SPIELE.find(g => g.id === id).name} von den Eltern freigeschaltet`, jetzt);
      geaendert.push('frei');
    }
  }
  return geaendert;
}
