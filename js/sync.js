// Automatische Übertragung der Lerndaten in ein privates GitHub-Repo (Contents-API).
// Der Zugangsschlüssel liegt nur auf dem Gerät (localStorage), nie im Code und nie im Export.

const API = 'https://api.github.com';

export function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class UploadFehler extends Error {
  constructor(status, text) { super(text); this.status = status; }
}

function fehlerText(status) {
  if (status === 401) return 'Der Schlüssel ist ungültig oder abgelaufen.';
  if (status === 403) return 'Der Schlüssel darf nicht in dieses Repo schreiben.';
  if (status === 404) return 'Repo nicht gefunden oder der Schlüssel hat keinen Zugriff darauf.';
  if (status === 0) return 'Keine Verbindung. Wird später nochmal versucht.';
  return `GitHub meldet Fehler ${status}.`;
}

async function anfrage(cfg, method, url, body, accept = 'application/vnd.github+json') {
  let r;
  try {
    r = await fetch(url, {
      method, cache: 'no-store',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new UploadFehler(0, fehlerText(0));
  }
  return r;
}

export async function verbindungTesten(cfg) {
  const r = await anfrage(cfg, 'GET', `${API}/repos/${cfg.repo}`);
  if (!r.ok) throw new UploadFehler(r.status, fehlerText(r.status));
  const info = await r.json();
  if (info.permissions && info.permissions.push === false) throw new UploadFehler(403, fehlerText(403));
  return { privat: !!info.private, name: info.full_name };
}

export async function dateiSchreiben(cfg, pfad, inhalt, nachricht) {
  const url = pfadUrl(cfg, pfad);
  for (let versuch = 0; versuch < 2; versuch++) {
    let sha;
    const g = await anfrage(cfg, 'GET', url);
    if (g.status === 200) sha = (await g.json()).sha;
    else if (g.status !== 404) throw new UploadFehler(g.status, fehlerText(g.status));
    const p = await anfrage(cfg, 'PUT', url, { message: nachricht, content: base64(inhalt), ...(sha ? { sha } : {}) });
    if (p.ok) return true;
    if ((p.status === 409 || p.status === 422) && versuch === 0) continue; // jemand war schneller: neu versuchen
    throw new UploadFehler(p.status, fehlerText(p.status));
  }
  return false;
}

const pfadUrl = (cfg, pfad) => `${API}/repos/${cfg.repo}/contents/${pfad.split('/').map(encodeURIComponent).join('/')}`;

// Liest eine JSON-Datei aus dem Repo. Gibt null zurück, wenn es sie nicht gibt.
export async function dateiLesen(cfg, pfad) {
  const r = await anfrage(cfg, 'GET', pfadUrl(cfg, pfad), undefined, 'application/vnd.github.raw+json');
  if (r.status === 404) return null;
  if (!r.ok) throw new UploadFehler(r.status, fehlerText(r.status));
  return JSON.parse(await r.text());
}

// Inhalt eines Ordners: [{ name, path, type: 'file'|'dir', sha, size }]. Fehlt der Ordner: [].
export async function ordnerLesen(cfg, pfad) {
  const r = await anfrage(cfg, 'GET', pfadUrl(cfg, pfad));
  if (r.status === 404) return [];
  if (!r.ok) throw new UploadFehler(r.status, fehlerText(r.status));
  const liste = await r.json();
  return Array.isArray(liste) ? liste.map(({ name, path, type, sha, size }) => ({ name, path, type, sha, size })) : [];
}

// Löscht eine Datei im Repo (nur Eltern-App, für Pakete)
export async function dateiLoeschen(cfg, pfad, nachricht) {
  const url = pfadUrl(cfg, pfad);
  const g = await anfrage(cfg, 'GET', url);
  if (g.status === 404) return false;
  if (!g.ok) throw new UploadFehler(g.status, fehlerText(g.status));
  const { sha } = await g.json();
  const r = await anfrage(cfg, 'DELETE', url, { message: nachricht, sha });
  if (!r.ok) throw new UploadFehler(r.status, fehlerText(r.status));
  return true;
}

// Teilt das Protokoll nach lokalen Tagen auf.
export function nachTagen(log, tagKey) {
  const tage = {};
  for (const e of log) {
    const k = tagKey(new Date(e.t));
    (tage[k] || (tage[k] = [])).push(e);
  }
  return tage;
}

// Einträge aus Zeiten, in denen das Gerät als Testgerät markiert war, nie übertragen.
export function ohneTestphasen(log) {
  let test = false;
  const out = [];
  for (const e of log) {
    if (e.typ === 'testgeraet') { test = !!e.an; continue; }
    if (!test) out.push(e);
  }
  return out;
}
