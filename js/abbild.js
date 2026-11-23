// Abbild des Daten-Repos (23.11., Konzept „Daten nur laden, wenn sie sich geändert haben“).
// Eine Anfrage holt die Liste aller Dateien mit Fingerabdruck (sha). Inhalte liegen im Speicher unter ihrem sha:
// gleicher sha = gleicher Inhalt, also nie wieder holen. Ohne Liste (Fehler, zu lang) geht alles wie vorher direkt.
// Nach eigenem Schreiben: vergessen(pfad) → dieser Pfad und sein Ordner werden bis zur nächsten Liste direkt gelesen.
import * as U from './sync.js';
import * as M from './messung.js';

const CACHE = 'daten-blob-v1';
const KEY = (sha) => `https://abbild.local/${sha}`;
let baum = null, geholt = 0, laeuft = null, aufgeraeumt = false;
const veraltet = new Set();

export const da = () => !!baum;
export const alter = () => (baum ? Date.now() - geholt : Infinity);

// Liste holen (höchstens alle maxAlter ms). Gibt true zurück, wenn eine Liste da ist.
export async function auffrischen(cfg, { maxAlter = 0 } = {}) {
  if (baum && Date.now() - geholt <= maxAlter) return true;
  if (laeuft) return laeuft;
  laeuft = (async () => {
    try { baum = await U.baumLesen(cfg); geholt = Date.now(); veraltet.clear(); aufraeumen(); return true; }
    catch (e) { baum = null; return false; }
    finally { laeuft = null; }
  })();
  return laeuft;
}
export function vergessen(pfad) { veraltet.add(pfad); }
export function leeren() { baum = null; veraltet.clear(); }

// undefined = unbekannt (direkt lesen), null = gibt es nicht, sonst Eintrag
function eintrag(pfad) {
  if (!baum || veraltet.has(pfad)) return undefined;
  return baum.get(pfad) || null;
}

// Wie U.ordnerLesen: [{ name, path, type: 'file'|'dir', sha, size }], fehlt der Ordner: []
export async function ordner(cfg, pfad) {
  const pre = pfad.replace(/\/$/, '') + '/';
  if (!baum || [...veraltet].some(p => p.startsWith(pre))) return U.ordnerLesen(cfg, pfad);
  const out = [];
  for (const [p, e] of baum) {
    if (!p.startsWith(pre)) continue;
    const name = p.slice(pre.length);
    if (!name || name.includes('/')) continue;
    out.push({ name, path: p, type: e.type === 'tree' ? 'dir' : 'file', sha: e.sha, size: e.size });
  }
  return out;
}

async function blobVon(cfg, pfad, e) {
  let cache = null;
  try { cache = await caches.open(CACHE); } catch (x) { /* ohne Speicher */ }
  if (cache) {
    try { const t = performance.now(); const hit = await cache.match(KEY(e.sha)); if (hit) { const b = await hit.blob(); M.speicher(pfad, b.size, performance.now() - t); return b; } } catch (x) { /* weiter */ }
  }
  const b = await U.blobLesen(cfg, e.sha);
  if (cache) { try { await cache.put(KEY(e.sha), new Response(b)); } catch (x) { /* voll: egal */ } }
  return b;
}

// Wie U.dateiLesen (JSON oder null)
export async function datei(cfg, pfad) {
  const e = eintrag(pfad);
  if (e === undefined) return U.dateiLesen(cfg, pfad);
  if (e === null || e.type !== 'blob') return null;
  return JSON.parse(await (await blobVon(cfg, pfad, e)).text());
}
// Wie U.dateiBlob (Blob oder null)
export async function blob(cfg, pfad) {
  const e = eintrag(pfad);
  if (e === undefined) return U.dateiBlob(cfg, pfad);
  if (e === null || e.type !== 'blob') return null;
  return blobVon(cfg, pfad, e);
}

// Einmal je Sitzung: Inhalte, deren Fingerabdruck nicht mehr in der Liste steht, aus dem Speicher löschen
async function aufraeumen() {
  if (aufgeraeumt || !baum) return;
  aufgeraeumt = true;
  try {
    const shas = new Set([...baum.values()].map(e => e.sha));
    const cache = await caches.open(CACHE);
    for (const req of await cache.keys()) if (!shas.has(req.url.split('/').pop())) await cache.delete(req);
  } catch (e) { /* egal */ }
}
