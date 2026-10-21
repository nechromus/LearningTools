// Bild für die Nachricht „Bildschirmzeit abschicken“ (wird mit dem Text geteilt).
// Alle Angaben stehen auch im Bild, falls eine App beim Teilen den Text weglässt.
import { minText, zeitpunktText } from './bildschirm.js';

const B = 1080, H = 1350;
const BLAU = '#2F4F8F', DUNKEL = '#1E3566', HELL = '#E3EAF7';

const KONSOLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40"><rect x="2" y="4" width="14" height="32" rx="7" fill="#5B6B8C"/><rect x="48" y="4" width="14" height="32" rx="7" fill="#5B6B8C"/><rect x="15" y="5" width="34" height="30" rx="3" fill="#1E2A3E"/><rect x="18" y="8" width="28" height="24" rx="1.5" fill="#6C8CCB"/><circle cx="9" cy="14" r="3" fill="#1E2A3E"/><circle cx="55" cy="24" r="3" fill="#1E2A3E"/><circle cx="55" cy="12" r="1.6" fill="#E3EAF7"/><circle cx="58" cy="15" r="1.6" fill="#E3EAF7"/><circle cx="52" cy="15" r="1.6" fill="#E3EAF7"/><path d="M7 26h4M9 24v4" stroke="#E3EAF7" stroke-width="1.6"/></svg>`;
const COMPUTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 40"><rect x="3" y="3" width="42" height="27" rx="3" fill="#1E2A3E"/><rect x="6" y="6" width="36" height="21" rx="1" fill="#8FB0E6"/><path d="M9 22l7-7 5 5 6-8 9 10" stroke="#2F4F8F" stroke-width="2" fill="none"/><rect x="20" y="30" width="8" height="5" fill="#5B6B8C"/><rect x="13" y="35" width="22" height="3" rx="1.5" fill="#5B6B8C"/></svg>`;
const VIDEO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#2F4F8F" stroke-width="2.5"/><path d="M16 12l12 8-12 8z" fill="#2F4F8F"/></svg>`;

function bildLaden(svg) {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fehler;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function rundRechteck(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// Liefert eine PNG-Datei (File) oder null, wenn das Zeichnen nicht klappt.
export async function bildschirmBild({ sekunden, aufgaben, code, name = '' }, jetzt = new Date()) {
  try {
    const cv = document.createElement('canvas');
    cv.width = B; cv.height = H;
    const c = cv.getContext('2d');
    const schrift = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    // Hintergrund
    const g = c.createLinearGradient(0, 0, B, H);
    g.addColorStop(0, '#EEF2FA'); g.addColorStop(1, '#C9D6EF');
    c.fillStyle = g; c.fillRect(0, 0, B, H);
    // Karte
    rundRechteck(c, 60, 60, B - 120, H - 120, 48);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
    c.lineWidth = 6; c.strokeStyle = BLAU; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    // Titel
    c.fillStyle = DUNKEL;
    c.font = `700 64px ${schrift}`;
    c.fillText('Bildschirmzeit', B / 2, 190);
    // Symbole
    const [k, p, v] = await Promise.all([bildLaden(KONSOLE), bildLaden(COMPUTER), bildLaden(VIDEO)]);
    const hS = 130, y0 = 240;
    const breiten = [hS * 1.6, hS * 1.2, hS];
    let x = B / 2 - (breiten[0] + breiten[1] + breiten[2] + 80) / 2;
    [k, p, v].forEach((img, i) => { c.drawImage(img, x, y0, breiten[i], hS); x += breiten[i] + 40; });
    // Minuten
    c.font = `800 190px ${schrift}`;
    c.fillText(minText(sekunden), B / 2, 600);
    // Name, Zeitpunkt, Aufgaben
    c.font = `500 48px ${schrift}`;
    c.fillStyle = '#3A4A6B';
    const zeilen = [name ? `für ${name}` : '', `${zeitpunktText(jetzt)} Uhr`, `${aufgaben} ${aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'} geschafft`].filter(Boolean);
    zeilen.forEach((z, i) => c.fillText(z, B / 2, 710 + i * 66));
    // Code
    const cy = 950;
    c.font = `500 40px ${schrift}`;
    c.fillText('Code', B / 2, cy);
    rundRechteck(c, B / 2 - 270, cy + 30, 540, 150, 24);
    c.fillStyle = '#fff'; c.fill();
    c.setLineDash([18, 12]); c.lineWidth = 5; c.strokeStyle = BLAU; c.stroke(); c.setLineDash([]);
    c.fillStyle = DUNKEL;
    c.font = `700 96px ui-monospace, Menlo, Consolas, monospace`;
    c.fillText((code || '').split('').join(' '), B / 2, cy + 140);
    // Fuß
    c.font = `600 36px Cinzel, Georgia, serif`;
    c.fillStyle = '#5B6B8C';
    c.fillText('Schrein der Zahlen', B / 2, H - 110);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
    if (!blob) return null;
    return new File([blob], `bildschirmzeit-${code || 'x'}.png`, { type: 'image/png' });
  } catch (e) {
    return null;
  }
}
