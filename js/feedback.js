// Feedback: Bild der App, eigener Text, optional ein Foto und der Stand der App als Ticket ins private Daten-Repo.
// Ablage: feedback/<id>.json, feedback/<id>-app.jpg, feedback/<id>-foto.jpg. Der Zugangsschlüssel steht nie im Ticket.
import * as U from './sync.js';

let h2cLaden = null;
function html2canvasLaden() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!h2cLaden) {
    h2cLaden = new Promise((ok, nein) => {
      const s = document.createElement('script');
      s.src = 'vendor/html2canvas.min.js';
      s.onload = () => ok(window.html2canvas);
      s.onerror = () => { h2cLaden = null; nein(new Error('Das Bild-Werkzeug konnte nicht geladen werden.')); };
      document.head.appendChild(s);
    });
  }
  return h2cLaden;
}

// Sichtbarer Teil der App als JPEG (Base64 ohne Präfix). Gibt null zurück, wenn es nicht klappt.
export async function appBild(maxBreite = 900) {
  try {
    const h2c = await html2canvasLaden();
    const b = document.body;
    const scale = Math.min(window.devicePixelRatio || 1, 2, maxBreite / Math.max(1, window.innerWidth));
    const canvas = await h2c(b, {
      x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
      windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
      scale, logging: false, useCORS: true, backgroundColor: getComputedStyle(b).backgroundColor || '#000',
      ignoreElements: (el) => el.classList && (el.classList.contains('fb-knopf') || el.id === 'modal')
    });
    return canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
  } catch (e) {
    return null;
  }
}

// Foto aus der Fotomediathek verkleinern (längste Seite höchstens 1400 px)
export function fotoVerkleinern(datei, max = 1400) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
    img.src = url;
  });
}

const zwei = (n) => String(n).padStart(2, '0');
export function ticketId(d = new Date()) {
  const z = `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}`;
  return `${z}-${Math.random().toString(36).slice(2, 6)}`;
}

// Ticket hochladen. cfg = { repo, token }. Gibt die id zurück.
export async function senden(cfg, { text, bild, foto, kontext, von }) {
  const id = ticketId();
  const bilder = [];
  if (bild) { await U.dateiNeuBase64(cfg, `feedback/${id}-app.jpg`, bild, `Feedback ${id}: Bild der App`); bilder.push(`${id}-app.jpg`); }
  if (foto) { await U.dateiNeuBase64(cfg, `feedback/${id}-foto.jpg`, foto, `Feedback ${id}: Foto`); bilder.push(`${id}-foto.jpg`); }
  const jetzt = new Date().toISOString();
  const ticket = {
    format: 'feedback-1', id, erstellt: jetzt, von, text: String(text || '').slice(0, 4000), bilder,
    status: 'neu', verlauf: [{ zeit: jetzt, status: 'neu', wer: von }], auftrag: '', antwort: '', kontext
  };
  await U.dateiSchreiben(cfg, `feedback/${id}.json`, JSON.stringify(ticket, null, 1), `Feedback ${id}`);
  return id;
}
