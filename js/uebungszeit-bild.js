// Bild für „Eltern fragen“ (mehr Übungszeit) im Stil „Logbuch Sternzeit“. Alle Angaben stehen auch im Bild.

const B = 1080, H = 1350;
const GRUND = '#07080F', PANEL = '#141726', ORANGE = '#FF9F5A', PFIRSICH = '#FFCC99', FLIEDER = '#C9A0DC', BLAU = '#8FBFFF', TEXT = '#F1ECE4', MATT = '#A9A9C2';

function rund(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export async function uebungszeitBild({ sekunden, code, name = '', sternzeit = '', titel = 'Logbuch Sternzeit' }) {
  try {
    const cv = document.createElement('canvas');
    cv.width = B; cv.height = H;
    const c = cv.getContext('2d');
    const schrift = '"Atkinson Hyperlegible", -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    c.fillStyle = GRUND; c.fillRect(0, 0, B, H);
    // Kopf: Winkel und Farbbalken
    c.fillStyle = ORANGE;
    rund(c, 60, 60, 200, 230, 70); c.fill();
    c.fillRect(160, 60, 100, 230);
    c.fillStyle = GRUND; rund(c, 190, 230, 120, 80, 40); c.fill();
    const balken = [[280, 250, 420, ORANGE], [710, 250, 130, FLIEDER], [850, 250, 170, BLAU]];
    for (const [x, y, w, f] of balken) { c.fillStyle = f; c.fillRect(x, y, w, 40); }
    c.textAlign = 'left';
    c.fillStyle = PFIRSICH; c.font = `700 64px ${schrift}`;
    c.fillText(titel.toUpperCase(), 290, 150);
    c.fillStyle = MATT; c.font = `400 36px ${schrift}`;
    c.fillText('STERNZEIT', 290, 210);
    c.fillStyle = BLAU; c.font = `700 40px ${schrift}`;
    c.fillText(sternzeit, 500, 210);
    // Karte
    c.textAlign = 'center';
    rund(c, 60, 360, B - 120, 820, 48); c.fillStyle = PANEL; c.fill();
    c.fillStyle = FLIEDER; c.fillRect(60, 400, 26, 740);
    c.fillStyle = PFIRSICH; c.font = `700 80px ${schrift}`;
    c.fillText('✦ Mehr Übungszeit?', B / 2, 500);
    c.fillStyle = TEXT; c.font = `400 52px ${schrift}`;
    c.fillText(`${name || 'Ich'} hat heute`, B / 2, 620);
    c.fillStyle = ORANGE; c.font = `700 160px ${schrift}`;
    c.fillText(`${Math.floor(sekunden / 60)} Min.`, B / 2, 790);
    c.fillStyle = TEXT; c.font = `400 52px ${schrift}`;
    c.fillText('geübt.', B / 2, 870);
    c.fillStyle = MATT; c.font = `400 40px ${schrift}`;
    c.fillText('Code', B / 2, 960);
    rund(c, B / 2 - 270, 990, 540, 150, 28); c.fillStyle = '#0B0D18'; c.fill();
    c.lineWidth = 5; c.strokeStyle = BLAU; c.stroke();
    c.fillStyle = TEXT; c.font = `700 96px ui-monospace, Menlo, Consolas, monospace`;
    c.fillText((code || '').split('').join(' '), B / 2, 1100);
    c.fillStyle = MATT; c.font = `400 34px ${schrift}`;
    c.fillText('In der Eltern-App: „Heute mehr Übungszeit“', B / 2, H - 100);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
    if (!blob) return null;
    return new File([blob], `uebungszeit-${code || 'x'}.png`, { type: 'image/png' });
  } catch (e) {
    return null;
  }
}
