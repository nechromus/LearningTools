// PDFs aneinanderhängen (Auftrag 26: „Nur geänderte Seiten“ des Hinweisblatts als ein PDF).
// Für einfache PDFs mit klassischer xref-Tabelle, wie sie Chromium (Skia) beim Drucken als PDF erzeugt.
// Keine Bibliothek: Objekte werden neu nummeriert, die Seiten hängen an einem neuen Seitenbaum. Gibt bei
// unbekanntem Aufbau null zurück (dann teilt die Eltern-App die einzelnen PDFs).

const latin = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
const bytes = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xFF; return u; };

// Objekte einer Datei: { nr: text } aus der xref-Tabelle (genaue Positionen, Streams bleiben unverändert)
function lesen(s) {
  if (/\/ObjStm|\/Type\s*\/XRef|\/Encrypt/.test(s)) return null;
  const sx = s.lastIndexOf('startxref');
  if (sx < 0) return null;
  const xref = parseInt(s.slice(sx + 9).trim(), 10);
  if (!(xref > 0) || s.slice(xref, xref + 4) !== 'xref') return null;
  const tr = s.indexOf('trailer', xref);
  if (tr < 0) return null;
  const zeilen = s.slice(xref + 4, tr).trim().split(/\r?\n|\r/);
  const pos = {};
  for (let i = 0; i < zeilen.length;) {
    const [start, anzahl] = zeilen[i].trim().split(/\s+/).map(Number);
    if (!Number.isInteger(start) || !Number.isInteger(anzahl)) return null;
    for (let j = 0; j < anzahl; j++) { const e = zeilen[i + 1 + j].trim().split(/\s+/); if (e[2] === 'n') pos[start + j] = Number(e[0]); }
    i += 1 + anzahl;
  }
  const root = /\/Root\s+(\d+)\s+0\s+R/.exec(s.slice(tr));
  if (!root) return null;
  const nrn = Object.keys(pos).map(Number).sort((a, b) => pos[a] - pos[b]);
  const obj = {};
  nrn.forEach((n, i) => {
    const ende = i + 1 < nrn.length ? pos[nrn[i + 1]] : xref;
    const t = s.slice(pos[n], ende);
    const e = t.lastIndexOf('endobj');
    obj[n] = e >= 0 ? t.slice(0, e + 6) : t;
  });
  return { obj, root: Number(root[1]) };
}

// Verweise „n 0 R“ und den Kopf „n 0 obj“ verschieben, nur außerhalb von Stream-Daten
function verschieben(t, plus, ersetzen) {
  const m = /stream\r?\n/.exec(t);
  let kopf = m ? t.slice(0, m.index) : t;
  const rest = m ? t.slice(m.index) : '';
  kopf = kopf.replace(/^(\d+)(\s+0\s+obj)/, (_, n, r) => (Number(n) + plus) + r);
  kopf = kopf.replace(/(\d+)(\s+0\s+R)/g, (_, n, r) => (Number(n) + plus) + r);
  return ersetzen ? ersetzen(kopf) + rest : kopf + rest;
}

export function pdfsZusammen(liste) {
  try {
    const dateien = liste.map(u8 => lesen(latin(u8 instanceof Uint8Array ? u8 : new Uint8Array(u8))));
    if (dateien.some(d => !d)) return null;
    let plus = 0;
    const teile = [], kinder = [];
    const neuSeiten = 1 + dateien.reduce((s, d) => s + Math.max(...Object.keys(d.obj).map(Number)) + 1, 0);
    const neuRoot = neuSeiten + 1;
    for (const d of dateien) {
      const cat = d.obj[d.root];
      const pm = cat && /\/Pages\s+(\d+)\s+0\s+R/.exec(cat);
      if (!pm) return null;
      const pagesNr = Number(pm[1]);
      const km = /\/Kids\s*\[([^\]]*)\]/.exec(d.obj[pagesNr] || '');
      if (!km) return null;
      const seiten = [...km[1].matchAll(/(\d+)\s+0\s+R/g)].map(x => Number(x[1]));
      if (seiten.some(n => !/\/Type\s*\/Page\b(?!s)/.test(d.obj[n] || ''))) return null; // verschachtelte Seitenbäume: nicht unterstützt
      for (const [n, t] of Object.entries(d.obj)) {
        const nr = Number(n);
        if (nr === d.root || nr === pagesNr) continue;
        const istSeite = seiten.includes(nr);
        teile.push([nr + plus, verschieben(t, plus, istSeite ? (k) => k.replace(/\/Parent\s+\d+\s+0\s+R/, `/Parent ${neuSeiten} 0 R`) : null)]);
      }
      seiten.forEach(n => kinder.push(n + plus));
      plus += Math.max(...Object.keys(d.obj).map(Number)) + 1;
    }
    teile.push([neuSeiten, `${neuSeiten} 0 obj\n<</Type /Pages\n/Count ${kinder.length}\n/Kids [${kinder.map(k => k + ' 0 R').join(' ')}]>>\nendobj`]);
    teile.push([neuRoot, `${neuRoot} 0 obj\n<</Type /Catalog\n/Pages ${neuSeiten} 0 R>>\nendobj`]);
    teile.sort((a, b) => a[0] - b[0]);
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const pos = {};
    for (const [n, t] of teile) { pos[n] = out.length; out += t + '\n'; }
    const groesse = neuRoot + 1;
    const xref = out.length;
    out += `xref\n0 ${groesse}\n0000000000 65535 f \n`;
    for (let n = 1; n < groesse; n++) out += pos[n] != null ? String(pos[n]).padStart(10, '0') + ' 00000 n \n' : '0000000000 65535 f \n';
    out += `trailer\n<</Size ${groesse}\n/Root ${neuRoot} 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
    return bytes(out);
  } catch (e) {
    return null;
  }
}
