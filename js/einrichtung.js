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

// art: 'kind' (Übungs-App) oder 'eltern' (Eltern-App)
export function einrichtungsLink(basisUrl, { repo, token, name, art = 'kind' }) {
  const daten = { v: 1, r: repo, t: token };
  if (name) daten.n = name;
  if (art === 'eltern') daten.a = 'e';
  if (art === 'boegen') daten.a = 'b'; // Großeltern: Eltern-App nur mit „Bögen“ (Auftrag 35)
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
    return { repo, token, name: name.length >= 2 ? name : '', art: d.a === 'e' ? 'eltern' : d.a === 'b' ? 'boegen' : 'kind' };
  } catch (e) {
    return null;
  }
}

// QR-Code mit der Kamera lesen. Lädt jsQR bei Bedarf. Gibt eine Funktion zum Stoppen zurück.
export async function kameraScan(video, jsqrUrl, beiText) {
  if (!window.jsQR) {
    await new Promise((ok, fehler) => {
      const sc = document.createElement('script');
      sc.src = jsqrUrl; sc.onload = ok;
      sc.onerror = () => fehler(new Error('Der QR-Leser konnte nicht geladen werden. Ist das Internet an?'));
      document.head.appendChild(sc);
    });
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  let aktiv = true;
  const stopp = () => { aktiv = false; stream.getTracks().forEach(t => t.stop()); };
  video.srcObject = stream;
  await video.play().catch(() => {});
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const runde = () => {
    if (!aktiv || !video.isConnected) return stopp();
    if (video.readyState >= 2 && video.videoWidth) {
      const f = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * f); canvas.height = Math.round(video.videoHeight * f);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = window.jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data && beiText(code.data) === true) return stopp();
    }
    requestAnimationFrame(runde);
  };
  requestAnimationFrame(runde);
  return stopp;
}
