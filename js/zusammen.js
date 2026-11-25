// Mehrere Geräte (25.11., Wunsch Vater): Spielstand zusammenführen statt „Server gewinnt“.
// Drei Stände: basis = zuletzt mit dem Server abgeglichen, lokal = dieses Gerät, server = Stand des anderen Geräts.
// Je Feld: nur eine Seite geändert → diese Seite. Beide geändert → Regel nach Pfad:
//   add   Zahlen, die sich ansammeln: server + (lokal − basis) (Aufgaben, Splitter, Spielzeit, Übungsminuten …)
//   max   Fortschritt: der größere Wert (Stufen, Etappen, Rekorde, Versionen)
//   union Listen ohne Reihenfolge-Sinn: beide zusammen (freigeschaltete Spiele, gelesene Einträge …)
//   neuer Entscheidungen der Themenwahl: die Seite mit dem neueren tw.geaendert
//   spiel  laufende Spiele: ganz von diesem Gerät, nur Rekorde als Maximum
//   lokal alles andere (wartende Aufgabe, Reihenfolgen): dieses Gerät
// Reine Logik ohne Bildschirm, testbar mit node.

const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const istObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Regeln: Pfad mit „*“ (ein beliebiger Schlüssel) und „**“ (alles darunter)
const REGELN = [
  ['add', ['guthaben', 'verlauf.zaehler', 'tag.verlassen', 'tag.aufgaben', 'tag.ersterVersuch', 'tag.verdient',
    'splitter.stand', 'splitter.gesamt', 'splitter.texte', 'statistik.*.gesehen', 'uebung.sek', 'wissen.stand',
    'bildschirm.uebMs', 'bildschirm.ms', 'bildschirm.heute', 'bildschirm.aufgaben', 'bildschirm.stand', 'serie.erledigt',
    'tw.tage.**', 'tw.kcGemacht']],
  ['max', ['**.rekord', '**.hoechste', 'genStufen.*.stufe', 'statistik.*.zuletzt', 'fern.version', 'fern.geholt', 'fern.angewendet',
    'tw.version', 'tw.geaendert', 'tw.etappen.**', 'tw.best.knobelMax', 'splitter.tage.zahl', 'serie.pos', 'serie.letzteAktivitaet']],
  ['union', ['splitter.frei', 'splitter.gemeistert', 'splitter.boni', 'logbuch.gelesen', 'archiv.gekauft', 'bildschirm.gesendet', 'splitter.verlauf', 'wissen.verlauf']],
  ['neuer', ['tw.planung', 'tw.schule', 'tw.kurs', 'tw.wahl', 'tw.aktiv', 'tw.pausiert', 'tw.klassenarbeiten', 'tw.ziele', 'tw.trotzdem', 'tw.kc', 'tw.rueckblick']],
  ['teilschritt', ['tw.teilschritte.*']],
  ['spiel', ['spiel', 'bloecke', 'kristallmine', 'steinschieber', 'runenfall', 'runenreihen', 'hoehlenkarte', 'runenbrecher', 'jadeschlange', 'runengruft']],
  ['ganz', ['wartet', 'wiederholen', 'extraAufgaben', 'verlauf.letzteIds']]
];
function passt(muster, pfad) {
  const m = muster.split('.');
  const geht = (i, j) => {
    if (i === m.length) return j === pfad.length;
    if (m[i] === '**') { for (let k = j; k <= pfad.length; k++) if (geht(i + 1, k)) return true; return false; }
    if (j >= pfad.length) return false;
    return (m[i] === '*' || m[i] === pfad[j]) && geht(i + 1, j + 1);
  };
  return geht(0, 0);
}
// Liegen unter diesem Pfad Zahlen mit der Regel „add“?
const ADD = REGELN.find(r => r[0] === 'add')[1];
function enthaeltAdd(pfad) {
  return ADD.some(m => { const t = m.split('.'); for (let i = 0; i < pfad.length; i++) { if (i >= t.length) return false; if (t[i] === '**') return true; if (t[i] !== '*' && t[i] !== pfad[i]) return false; } return t.length > pfad.length || t[t.length - 1] === '**'; });
}
export function regelFuer(pfad) {
  for (const [r, liste] of REGELN) if (liste.some(m => passt(m, pfad))) return r;
  return null;
}

// Tagesfelder: Gehören die beiden Stände zu verschiedenen Tagen, gilt der neuere Tag ganz
const TAG_FELD = { tag: 'key', bildschirm: 'tag', uebung: 'tag' };

function einFeld(b, l, s, pfad, ctx) {
  if (gleich(l, b)) return s;
  if (gleich(s, b)) return l;
  const regel = regelFuer(pfad);
  // Beide gleich geändert: bei Zahlen, die sich ansammeln, trotzdem beide zählen (2 × +60 s = +120 s), sonst ist es dieselbe Änderung
  if (gleich(l, s) && !(regel === 'add' || (istObj(l) && enthaeltAdd(pfad)))) return l;
  if (!gleich(l, s)) ctx.konflikte.push(pfad.join('.'));
  if (pfad.length === 1 && TAG_FELD[pfad[0]] && istObj(l) && istObj(s)) {
    const k = TAG_FELD[pfad[0]];
    if (l[k] !== s[k]) return String(l[k] || '') >= String(s[k] || '') ? l : s;
    if (istObj(b) && b[k] !== l[k]) b = undefined; // beide schon im neuen Tag: Zähler ab 0
  }
  if (regel === 'add' && typeof l === 'number' && typeof s === 'number') return Math.round((s + (l - (typeof b === 'number' ? b : 0))) * 1e6) / 1e6;
  if (regel === 'max' && (typeof l === typeof s) && (typeof l === 'number' || typeof l === 'string')) return l >= s ? l : s;
  if (regel === 'union' && Array.isArray(l) && Array.isArray(s)) {
    const seen = new Set(), out = [];
    for (const x of [...s, ...l]) { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
    if (out.every(x => istObj(x) && typeof x.t === 'string')) out.sort((x, y) => x.t < y.t ? -1 : 1);
    return pfad[pfad.length - 1] === 'verlauf' ? out.slice(-200) : out;
  }
  if (regel === 'neuer') return ctx.twLokalNeuer ? l : s;
  // Spiele: das Feld nie aus zwei Ständen mischen. Dieses Gerät, nur Rekorde vom anderen
  if (regel === 'spiel' && istObj(l) && istObj(s)) {
    const out = { ...l };
    for (const k of ['rekord', 'hoechste', 'maxKachel']) if (typeof l[k] === 'number' && typeof s[k] === 'number') out[k] = Math.max(l[k], s[k]);
    return out;
  }
  if (regel === 'ganz') return l;
  if (regel === 'teilschritt' && istObj(l) && istObj(s)) {
    // Mehr Übungen gezählt gewinnt, sonst der neuere Stand
    if ((l.n || 0) !== (s.n || 0)) return (l.n || 0) > (s.n || 0) ? l : s;
    return String(l.zuletzt || l.seit || '') >= String(s.zuletzt || s.seit || '') ? l : s;
  }
  if (istObj(l) && istObj(s) && (b === undefined || b === null || istObj(b))) {
    const out = {};
    for (const k of new Set([...Object.keys(s), ...Object.keys(l)])) {
      const v = einFeld(istObj(b) ? b[k] : undefined, l[k], s[k], [...pfad, k], ctx);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return l;
}

// zustand-Objekte (spielstand.json → zustand). Gibt { zustand, konflikte } zurück.
export function zusammenfuehren(basis, lokal, server) {
  const b = basis || {}, l = lokal || {}, s = server || {};
  const ctx = { konflikte: [], twLokalNeuer: String((l.tw || {}).geaendert || '') >= String((s.tw || {}).geaendert || '') };
  const zustand = {};
  for (const k of new Set([...Object.keys(s), ...Object.keys(l)])) {
    const v = einFeld(b[k], l[k], s[k], [k], ctx);
    if (v !== undefined) zustand[k] = v;
  }
  // Themenwahl: neue Version über beiden, damit themenwahl.json wieder hochgeladen wird
  if (zustand.tw && l.tw && s.tw && !gleich(zustand.tw, s.tw) && !gleich(zustand.tw, l.tw)) {
    zustand.tw = { ...zustand.tw, version: Math.max(l.tw.version || 0, s.tw.version || 0) + 1 };
  }
  // Nie negativ (zwei Geräte geben gleichzeitig aus)
  if (typeof zustand.guthaben === 'number' && zustand.guthaben < 0) zustand.guthaben = 0;
  if (zustand.splitter && typeof zustand.splitter.stand === 'number' && zustand.splitter.stand < 0) zustand.splitter = { ...zustand.splitter, stand: 0 };
  return { zustand, konflikte: ctx.konflikte };
}
