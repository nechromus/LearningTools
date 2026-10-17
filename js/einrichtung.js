// Einrichtung per QR-Code: Repo, Zugangsschlüssel und Name in einem Link.
// Der Teil nach „#“ wird nie an den Server geschickt. Die App entfernt ihn nach dem Lesen aus der Adresse.
export const SCHLUESSEL = 'einrichten=';

const zuB64url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const ausB64url = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

export function einrichtungsLink(basisUrl, { repo, token, name }) {
  const daten = { v: 1, r: repo, t: token };
  if (name) daten.n = name;
  return `${basisUrl.split('#')[0]}#${SCHLUESSEL}${zuB64url(JSON.stringify(daten))}`;
}

// Liest einen Link (oder nur den Teil nach „einrichten=“). Gibt { repo, token, name } oder null zurück.
export function einrichtungLesen(text) {
  const s = String(text || '').trim();
  const i = s.indexOf(SCHLUESSEL);
  if (i < 0) return null;
  try {
    const d = JSON.parse(ausB64url(s.slice(i + SCHLUESSEL.length).split(/[&\s]/)[0]));
    if (!d || d.v !== 1) return null;
    const repo = String(d.r || '').trim(), token = String(d.t || '').trim();
    const name = String(d.n || '').trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || token.length < 20 || /\s/.test(token)) return null;
    return { repo, token, name: name.length >= 2 ? name : '' };
  } catch (e) {
    return null;
  }
}
