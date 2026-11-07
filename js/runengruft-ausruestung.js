// Runengruft: Werte der Helden, Ausrüstung und gemeinsamer Beutel (ohne Anzeige).
//
// Werte: Kraft (Schlag), Schutz (weniger Schaden), Magie (Funke, Heilen, Mana).
// Jede Stufe bringt einen Punkt zum Verteilen. Ausrüstung: Waffe, Rüstung, Schmuck, Kristall.
// Ein Kristall gibt eine Fähigkeit, die einmal je Kampf geht.

export const PLAETZE = ['waffe', 'ruestung', 'schmuck', 'kristall'];
export const PLATZ_NAME = { waffe: 'Waffe', ruestung: 'Rüstung', schmuck: 'Schmuck', kristall: 'Kristall' };
export const WERTE = ['kraft', 'schutz', 'magie'];
export const WERT_NAME = { kraft: 'Kraft', schutz: 'Schutz', magie: 'Magie' };
export const BEUTEL_PLAETZE = 16;

export const FAEHIGKEITEN = {
  frost: { name: 'Frostsplitter', text: 'Der Gegner erstarrt und setzt einen Angriff aus.' },
  glut: { name: 'Glutschlag', text: 'Ein Schlag mit 6 Schaden mehr.' },
  schild: { name: 'Kristallschild', text: 'Der nächste Treffer macht keinen Schaden.' },
  licht: { name: 'Lichtquelle', text: 'Beide Helden bekommen 8 Leben zurück.' }
};

// art: waffe | ruestung | schmuck | kristall | trank | schluessel
export const KATALOG = {
  kurzschwert: { name: 'Kurzschwert', art: 'waffe', fuer: ['rana'], werte: { kraft: 1 }, text: 'Ein einfaches Schwert aus Bronze.' },
  jadeklinge: { name: 'Jadeklinge', art: 'waffe', fuer: ['rana'], werte: { kraft: 3 }, text: 'Eine leichte Klinge mit leuchtender Rinne.' },
  kernspeer: { name: 'Kernspeer', art: 'waffe', fuer: ['rana'], werte: { kraft: 2, schutz: 1 }, text: 'Lang und schwer. Hält Gegner auf Abstand.' },
  lehrstab: { name: 'Lehrstab', art: 'waffe', fuer: ['ilo'], werte: { magie: 1 }, text: 'Ein schlichter Stab mit einem kleinen Kristall.' },
  runenstab: { name: 'Runenstab', art: 'waffe', fuer: ['ilo'], werte: { magie: 3 }, text: 'In den Stab sind Runen geritzt. Sie leuchten bei jedem Zauber.' },
  lederwams: { name: 'Lederwams', art: 'ruestung', fuer: ['rana', 'ilo'], werte: { schutz: 1 }, text: 'Weich und leise.' },
  plattenweste: { name: 'Plattenweste', art: 'ruestung', fuer: ['rana'], werte: { schutz: 3 }, text: 'Schwere Platten aus alter Technik. Zu schwer für Ilo.' },
  runenmantel: { name: 'Runenmantel', art: 'ruestung', fuer: ['ilo'], werte: { schutz: 1, magie: 2 }, text: 'Ein Mantel mit eingewebten Leuchtfäden.' },
  kraftring: { name: 'Ring der Kraft', art: 'schmuck', fuer: ['rana', 'ilo'], werte: { kraft: 2 }, text: 'Ein schwerer Bronzering.' },
  ruheamulett: { name: 'Amulett der Ruhe', art: 'schmuck', fuer: ['rana', 'ilo'], werte: { schutz: 1, magie: 1 }, text: 'Ein Jadestein, der langsam pulsiert.' },
  frostkristall: { name: 'Frostkristall', art: 'kristall', fuer: ['rana', 'ilo'], werte: {}, faehigkeit: 'frost', text: 'Kalt wie Eis.' },
  glutkristall: { name: 'Glutkristall', art: 'kristall', fuer: ['rana', 'ilo'], werte: {}, faehigkeit: 'glut', text: 'Warm. Darin glimmt Bernstein.' },
  schildkristall: { name: 'Schildkristall', art: 'kristall', fuer: ['rana', 'ilo'], werte: { schutz: 1 }, faehigkeit: 'schild', text: 'Ein Kristall mit sechs glatten Flächen.' },
  lichtkristall: { name: 'Lichtkristall', art: 'kristall', fuer: ['rana', 'ilo'], werte: { magie: 1 }, faehigkeit: 'licht', text: 'Er leuchtet von innen.' },
  heiltrank: { name: 'Heiltrank', art: 'trank', wirkung: { leben: 12 }, text: 'Gibt 12 Leben zurück.' },
  manatrank: { name: 'Manatrank', art: 'trank', wirkung: { mana: 8 }, text: 'Gibt Ilo 8 Mana zurück.' },
  schluessel: { name: 'Jadeschlüssel', art: 'schluessel', text: 'Er passt in ein Ringschloss.' }
};

export const GRUND = {
  rana: { name: 'Rana', art: 'Kriegerin', werte: { kraft: 3, schutz: 2, magie: 0 }, leben0: 24, lebenJeStufe: 6 },
  ilo: { name: 'Ilo', art: 'Runenkundiger', werte: { kraft: 1, schutz: 1, magie: 3 }, leben0: 16, lebenJeStufe: 4 }
};

let naechsteId = 1;
export const ding = (typ) => ({ id: 'd' + (naechsteId++) + Math.random().toString(36).slice(2, 6), typ });

export function neueGruppe() {
  const held = (id, waffe, ruestung) => {
    const h = { id, stufe: 1, erfahrung: 0, punkte: 0, extra: { kraft: 0, schutz: 0, magie: 0 }, ausruestung: { waffe: ding(waffe), ruestung: ruestung ? ding(ruestung) : null, schmuck: null, kristall: null } };
    h.leben = lebenMax(h); if (id === 'ilo') h.mana = manaMax(h);
    return h;
  };
  return { helden: [held('rana', 'kurzschwert', 'lederwams'), held('ilo', 'lehrstab', null)], beutel: [] };
}

// ---------- Werte ----------
export function grundwert(h, w) { return GRUND[h.id].werte[w] + (h.extra[w] || 0); }
export function ausruestungswert(h, w) {
  let s = 0;
  for (const p of PLAETZE) { const d = h.ausruestung[p]; if (d) s += (KATALOG[d.typ].werte || {})[w] || 0; }
  return s;
}
export const wert = (h, w) => grundwert(h, w) + ausruestungswert(h, w);
export function lebenMax(h) { const g = GRUND[h.id]; return g.leben0 + h.stufe * g.lebenJeStufe + wert(h, 'schutz') * 2; }
export function manaMax(h) { return h.id === 'ilo' ? 6 + wert(h, 'magie') * 2 : 0; }
export const erfahrungFuerStufe = (stufe) => stufe * 10;

// Was die Werte im Kampf bedeuten (zum Anzeigen)
export function kampfwerte(h) {
  const k = wert(h, 'kraft'), sch = wert(h, 'schutz'), m = wert(h, 'magie');
  const out = { schlag: [1 + k, 4 + k], abwehr: Math.floor(sch / 2) };
  if (h.id === 'ilo') { out.funke = [3 + m, 6 + m]; out.heilen = 6 + m * 2; }
  const kr = h.ausruestung.kristall;
  if (kr && KATALOG[kr.typ].faehigkeit) out.faehigkeit = KATALOG[kr.typ].faehigkeit;
  return out;
}

// ---------- Ausrüstung ----------
export function passt(h, typ) {
  const k = KATALOG[typ];
  if (!k || !PLAETZE.includes(k.art)) return { ok: false, grund: 'kein_teil' };
  if (!k.fuer.includes(h.id)) return { ok: false, grund: 'nicht_fuer' };
  return { ok: true, platz: k.art };
}
// Werte vorher/nachher, wenn h das Ding anlegt (für den Vergleich)
export function vergleich(h, typ) {
  const p = passt(h, typ);
  if (!p.ok) return null;
  const alt = h.ausruestung[p.platz];
  const r = {};
  for (const w of WERTE) {
    const minus = alt ? (KATALOG[alt.typ].werte || {})[w] || 0 : 0;
    const plus = (KATALOG[typ].werte || {})[w] || 0;
    r[w] = { vorher: wert(h, w), nachher: wert(h, w) - minus + plus };
  }
  return { platz: p.platz, alt: alt ? alt.typ : null, werte: r };
}

// Ding aus dem Beutel anlegen. Das alte Teil wandert in den Beutel.
export function anlegen(g, heldId, dingId) {
  const h = g.helden.find(x => x.id === heldId);
  const i = g.beutel.findIndex(d => d.id === dingId);
  if (!h || i < 0) return { ok: false, grund: 'fehlt' };
  const d = g.beutel[i];
  const p = passt(h, d.typ);
  if (!p.ok) return p;
  const alt = h.ausruestung[p.platz];
  g.beutel.splice(i, 1);
  if (alt) g.beutel.splice(i, 0, alt);
  h.ausruestung[p.platz] = d;
  werteAnpassen(h);
  return { ok: true, platz: p.platz, alt: alt ? alt.typ : null };
}
// Teil ablegen (in den Beutel)
export function ablegen(g, heldId, platz) {
  const h = g.helden.find(x => x.id === heldId);
  if (!h || !h.ausruestung[platz]) return { ok: false, grund: 'leer' };
  if (g.beutel.length >= BEUTEL_PLAETZE) return { ok: false, grund: 'beutel_voll' };
  g.beutel.push(h.ausruestung[platz]);
  h.ausruestung[platz] = null;
  werteAnpassen(h);
  return { ok: true };
}
// Teil direkt von einem Helden zum anderen geben (gleicher Platz)
export function tauschen(g, vonId, nachId, platz) {
  const a = g.helden.find(x => x.id === vonId), b = g.helden.find(x => x.id === nachId);
  const d = a && a.ausruestung[platz];
  if (!d) return { ok: false, grund: 'leer' };
  const p = passt(b, d.typ);
  if (!p.ok) return p;
  const alt = b.ausruestung[platz];
  b.ausruestung[platz] = d; a.ausruestung[platz] = null;
  if (alt) { if (passt(a, alt.typ).ok) a.ausruestung[platz] = alt; else g.beutel.push(alt); }
  werteAnpassen(a); werteAnpassen(b);
  return { ok: true };
}
// Trank trinken
export function benutzen(g, heldId, dingId) {
  const h = g.helden.find(x => x.id === heldId);
  const i = g.beutel.findIndex(d => d.id === dingId);
  if (!h || i < 0) return { ok: false, grund: 'fehlt' };
  const k = KATALOG[g.beutel[i].typ];
  if (k.art !== 'trank') return { ok: false, grund: 'kein_trank' };
  if (k.wirkung.mana && h.id !== 'ilo') return { ok: false, grund: 'kein_mana' };
  if (k.wirkung.leben && h.leben >= lebenMax(h)) return { ok: false, grund: 'voll' };
  if (k.wirkung.mana && h.mana >= manaMax(h)) return { ok: false, grund: 'voll' };
  g.beutel.splice(i, 1);
  if (k.wirkung.leben) { const v = h.leben; h.leben = Math.min(lebenMax(h), h.leben + k.wirkung.leben); return { ok: true, leben: h.leben - v }; }
  const v = h.mana; h.mana = Math.min(manaMax(h), h.mana + k.wirkung.mana); return { ok: true, mana: h.mana - v };
}
export function aufnehmen(g, typ) {
  if (g.beutel.length >= BEUTEL_PLAETZE) return { ok: false, grund: 'beutel_voll' };
  const d = ding(typ); g.beutel.push(d); return { ok: true, id: d.id };
}
// Leben und Mana bleiben nach Wechseln im erlaubten Bereich
function werteAnpassen(h) {
  h.leben = Math.min(h.leben, lebenMax(h));
  if (h.id === 'ilo') h.mana = Math.min(h.mana, manaMax(h));
}

// ---------- Stufen ----------
export function erfahrungDazu(h, n) {
  h.erfahrung += n;
  let auf = 0;
  while (h.erfahrung >= erfahrungFuerStufe(h.stufe)) {
    h.erfahrung -= erfahrungFuerStufe(h.stufe);
    h.stufe++; h.punkte++; auf++;
    h.leben = lebenMax(h); if (h.id === 'ilo') h.mana = manaMax(h);
  }
  return auf;
}
export function punktSetzen(h, w) {
  if (!h.punkte || !WERTE.includes(w)) return false;
  h.punkte--; h.extra[w]++;
  const vorher = lebenMax(h) - 2; // Schutz erhöht das Leben: gleich mit auffüllen
  if (w === 'schutz') h.leben = Math.min(lebenMax(h), h.leben + 2);
  if (w === 'magie' && h.id === 'ilo') h.mana = Math.min(manaMax(h), h.mana + 2);
  void vorher;
  return true;
}
