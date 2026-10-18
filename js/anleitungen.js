// Kurze Anleitungen („So geht's“) für alle Spiele: Seiten mit kleinem Bild und kurzen Sätzen.
// Reine Daten und SVG-Bilder, ohne DOM (testbar mit node).

const J = '#5FE8B4', JH = '#B9FFE2', JT = '#1E7A5F', GO = '#D8B05A', GH = '#F6DFA2', ST = '#3a4644', ST2 = '#56645f', BO = '#1b2324', TXT = '#E8F1EC';

const svg = (inhalt, h = 120) => `<svg viewBox="0 0 200 ${h}" class="anl-bild" aria-hidden="true">${inhalt}</svg>`;
const k = (x, y, w, h, f, r = 4, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" ${extra}/>`;
const t = (x, y, s, f = TXT, size = 16, w = 700) => `<text x="${x}" y="${y}" fill="${f}" font-size="${size}" font-weight="${w}" text-anchor="middle" font-family="Atkinson Hyperlegible, system-ui, sans-serif">${s}</text>`;
const pfeil = (x1, y1, x2, y2, f = GH) => {
  const a = Math.atan2(y2 - y1, x2 - x1), l = 8;
  const p1 = [x2 - l * Math.cos(a - 0.5), y2 - l * Math.sin(a - 0.5)], p2 = [x2 - l * Math.cos(a + 0.5), y2 - l * Math.sin(a + 0.5)];
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${f}" stroke-width="3" stroke-linecap="round"/><polygon points="${x2},${y2} ${p1.join(',')} ${p2.join(',')}" fill="${f}"/>`;
};
const raute = (cx, cy, r, f) => `<polygon points="${cx},${cy - r} ${cx + r * 0.8},${cy} ${cx},${cy + r} ${cx - r * 0.8},${cy}" fill="${f}"/>`;
const finger = (x, y) => `<g opacity=".95"><circle cx="${x}" cy="${y}" r="9" fill="rgba(246,223,162,.25)" stroke="${GH}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3" fill="${GH}"/></g>`;
const figur = (x, y, r = 9) => `<ellipse cx="${x}" cy="${y}" rx="${r * 0.8}" ry="${r}" fill="#e2bd68"/><circle cx="${x - 2.5}" cy="${y - 1}" r="1.4" fill="${JH}"/><circle cx="${x + 2.5}" cy="${y - 1}" r="1.4" fill="${JH}"/>`;
const runenstein = (x, y, s, f = '#8c7b5e') => k(x, y, s, s, f, s * 0.2) + `<path d="M${x + s / 2} ${y + s * 0.25}v${s * 0.5}M${x + s / 2} ${y + s / 2}l${-s * 0.18} ${-s * 0.15}M${x + s / 2} ${y + s / 2}l${s * 0.18} ${-s * 0.15}" stroke="#2a2219" stroke-width="2" fill="none"/>`;
const zielfeld = (x, y, s) => `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.32}" fill="none" stroke="${J}" stroke-width="2"/>`;

// Höhlenkarte: 3×3-Ausschnitt mit Zahlen und verdeckten Feldern
function karte(felder, x0 = 55, y0 = 12, s = 30, hervor = []) {
  let out = '';
  felder.forEach((z, r) => [...z].forEach((ch, c) => {
    const x = x0 + c * (s + 2), y = y0 + r * (s + 2), i = r * z.length + c;
    const h = hervor.includes(i);
    if (ch === '#') out += k(x, y, s, s, h ? '#6a7a74' : ST2, 4, h ? `stroke="${GH}" stroke-width="2.5"` : '');
    else if (ch === 'F') out += k(x, y, s, s, ST2, 4, `stroke="${GO}" stroke-width="2.5"`) + raute(x + s / 2, y + s / 2, 9, J);
    else if (ch === 'X') out += k(x, y, s, s, '#3b2a24', 4) + `<path d="M${x + 8} ${y + 8}l${s - 16} ${s - 16}M${x + s - 8} ${y + 8}l${-(s - 16)} ${s - 16}" stroke="${GO}" stroke-width="3"/>`;
    else if (ch === 'O') out += k(x, y, s, s, '#2a3a35', 4, `stroke="${J}" stroke-width="2.5"`) + t(x + s / 2, y + s / 2 + 5, '✓', JH, 15);
    else out += k(x, y, s, s, BO, 4, h ? `stroke="${GH}" stroke-width="2.5"` : '') + (ch === '.' ? '' : t(x + s / 2, y + s / 2 + 6, ch, ['', '#7fd4ff', '#8ff5a8', '#ffb38a', '#d0a8ff'][Number(ch)] || TXT, 17));
  }));
  return out;
}

export const ANLEITUNGEN = {
  '2048': { titel: '2048', seiten: [
    { bild: svg([0, 1, 2, 3].map(c => k(20 + c * 30, 40, 26, 26, c === 0 ? GO : ST)).join('') + t(33, 58, '2', '#0c1011') + pfeil(150, 53, 185, 53) + pfeil(150, 53, 115, 53) + pfeil(150, 53, 150, 20) + pfeil(150, 53, 150, 88)),
      text: ['Wische nach links, rechts, oben oder unten.', 'Alle Steine rutschen in diese Richtung.'] },
    { bild: svg(k(20, 45, 30, 30, GO) + t(35, 66, '2', '#0c1011') + k(54, 45, 30, 30, GO) + t(69, 66, '2', '#0c1011') + pfeil(95, 60, 125, 60) + k(140, 45, 34, 30, J) + t(157, 66, '4', '#0c1011')),
      text: ['Zwei gleiche Steine stoßen zusammen.', 'Dann verschmelzen sie: 2 und 2 werden 4, 4 und 4 werden 8.'] },
    { bild: svg(k(70, 25, 60, 60, J, 8) + t(100, 63, '2048', '#0c1011', 18) + raute(40, 55, 10, GH) + raute(160, 55, 10, GH)),
      text: ['Baue einen möglichst großen Stein.', 'Geht nichts mehr, beginnst du neu. Deine Spielzeit bleibt.'] }
  ] },
  runenfeld: { titel: 'Runenfeld', seiten: [
    { bild: svg([0, 1, 2, 3, 4].map(c => k(15 + c * 20, 20, 18, 18, ST)).join('') + [0, 1, 2, 3, 4].map(c => k(15 + c * 20, 40, 18, 18, ST)).join('') + k(135, 70, 18, 18, J) + k(155, 70, 18, 18, J) + k(155, 90, 18, 18, J) + finger(165, 98) + pfeil(145, 65, 80, 50)),
      text: ['Ziehe eine Form von unten aufs Feld.', 'Lass sie dort los, wo Platz ist.'] },
    { bild: svg([0, 1, 2, 3, 4, 5].map(c => k(20 + c * 27, 45, 25, 25, c === 5 ? J : GO)).join('') + `<rect x="14" y="40" width="172" height="35" rx="6" fill="none" stroke="${JH}" stroke-width="2" stroke-dasharray="5 4"/>` + t(100, 100, 'Reihe voll: weg!', JH, 14)),
      text: ['Eine volle Reihe oder Spalte verschwindet.', 'Das gibt Punkte. Mehrere auf einmal geben mehr.'] },
    { bild: svg(k(40, 30, 50, 50, ST) + k(110, 30, 50, 50, BO, 4, `stroke="${J}" stroke-width="2" stroke-dasharray="5 4"`) + t(135, 61, '?', JH, 20)),
      text: ['Passt keine Form mehr, ist das Spiel vorbei.', 'Tipp: Lass Platz für große Formen.'] }
  ] },
  kristallmine: { titel: 'Kristallmine', seiten: [
    { bild: svg(k(10, 10, 180, 100, '#3b2f21', 6) + k(60, 45, 80, 26, '#141a1b', 4) + figur(125, 58) + finger(100, 95) + pfeil(100, 95, 140, 95)),
      text: ['Halte den Finger auf das Feld und ziehe in eine Richtung.', 'Die Figur gräbt sich durch die Erde.'] },
    { bild: svg(raute(50, 55, 16, J) + raute(85, 55, 16, J) + pfeil(110, 55, 140, 55) + k(150, 35, 36, 40, GO, 6) + t(168, 61, '⬢', '#fff4d0', 18)),
      text: ['Sammle genug Kristalle.', 'Dann öffnet sich der Ausgang. Lauf hinein!'] },
    { bild: svg(`<circle cx="100" cy="30" r="15" fill="#8a948f"/>` + pfeil(100, 50, 100, 72, GH) + figur(100, 92, 11) + t(160, 60, 'Achtung!', GH, 14)),
      text: ['Steine und Kristalle fallen, wenn darunter frei ist.', 'Lauf nicht direkt unter einen fallenden Stein.'] },
    { bild: svg(`<rect x="40" y="45" width="18" height="18" rx="4" fill="#fff4d0" transform="rotate(45 49 54)"/>` + t(49, 95, 'Glühwurm', GH, 12) + `<ellipse cx="140" cy="54" rx="16" ry="10" fill="${J}"/>` + t(140, 95, 'Schmetterling', JH, 12)),
      text: ['Ab Höhle 6 gibt es Gegner. Berühre sie nicht.', 'Ein Stein auf einem Schmetterling macht Kristalle.'] }
  ] },
  steinschieber: { titel: 'Steinschieber', seiten: [
    { bild: svg(figur(45, 60) + runenstein(70, 45, 30) + pfeil(108, 60, 135, 60) + zielfeld(140, 45, 30)),
      text: ['Schiebe jeden Runenstein auf ein leuchtendes Feld.', 'Wische oder tippe ein Feld an, um zu laufen.'] },
    { bild: svg(figur(30, 60) + runenstein(50, 45, 30) + runenstein(84, 45, 30) + t(150, 66, 'geht nicht', GH, 14)),
      text: ['Du kannst Steine nur schieben, nicht ziehen.', 'Zwei Steine hintereinander sind zu schwer.'] },
    { bild: svg(k(40, 20, 120, 8, ST2, 2) + k(40, 20, 8, 80, ST2, 2) + runenstein(50, 30, 28) + t(130, 66, '↶ Zurück', JH, 16)),
      text: ['Ein Stein in der Ecke steckt fest.', 'Dann hilft „Zurück“. „Tipp“ zeigt dir den nächsten Schub.'] }
  ] },
  runenfall: { titel: 'Runenfall', seiten: [
    { bild: svg(k(85, 10, 16, 16, '#8569c9') + k(69, 26, 16, 16, '#8569c9') + k(85, 26, 16, 16, '#8569c9') + k(101, 26, 16, 16, '#8569c9') + pfeil(93, 50, 93, 80) + [0, 1, 2, 3, 4, 5, 6, 7].map(c => c === 4 ? '' : k(30 + c * 18, 95, 16, 16, J)).join('')),
      text: ['Runensteine fallen von oben herunter.', 'Tippe aufs Feld zum Drehen. Ziehe seitlich zum Schieben.'] },
    { bild: svg([0, 1, 2, 3, 4, 5, 6, 7].map(c => k(30 + c * 18, 55, 16, 16, c === 4 ? '#8569c9' : J)).join('') + `<rect x="25" y="51" width="152" height="24" rx="5" fill="none" stroke="${JH}" stroke-width="2" stroke-dasharray="5 4"/>` + t(100, 100, 'volle Reihe: weg!', JH, 14)),
      text: ['Fülle eine ganze Reihe ohne Lücke.', 'Dann verschwindet sie und du bekommst Punkte.'] },
    { bild: svg(k(85, 15, 16, 16, GO) + k(101, 15, 16, 16, GO) + k(85, 31, 16, 16, GO) + k(101, 31, 16, 16, GO) + `<rect x="85" y="85" width="32" height="32" rx="4" fill="none" stroke="${JH}" stroke-width="1.5" stroke-dasharray="4 3"/>` + pfeil(150, 25, 150, 95) + t(165, 60, '', GH)),
      text: ['Schnell nach unten wischen: Der Stein fällt sofort.', 'Der Schatten zeigt, wo er landet. „Pause“ geht immer.'] }
  ] },
  runenreihen: { titel: 'Runenreihen', seiten: [
    { bild: svg(raute(60, 60, 18, J) + `<circle cx="110" cy="60" r="15" fill="${GO}"/>` + pfeil(72, 35, 98, 35) + pfeil(98, 85, 72, 85) + finger(60, 60)),
      text: ['Tausche zwei Nachbarn.', 'Wische über einen Stein oder tippe beide nacheinander an.'] },
    { bild: svg(raute(50, 60, 16, J) + raute(85, 60, 16, J) + raute(120, 60, 16, J) + `<rect x="30" y="38" width="110" height="44" rx="8" fill="none" stroke="${JH}" stroke-width="2" stroke-dasharray="5 4"/>` + t(170, 66, 'weg!', JH, 16)),
      text: ['Drei gleiche in einer Reihe verschwinden.', 'Neue Steine fallen von oben nach.'] },
    { bild: svg(raute(50, 50, 18, J) + `<circle cx="50" cy="50" r="24" fill="none" stroke="${GH}" stroke-width="2"/>` + t(50, 100, '4 = Funken', GH, 13) + raute(140, 50, 18, '#8569c9') + `<path d="M140 22l5 18 18 5-18 5-5 18-5-18-18-5 18-5z" fill="${GH}" opacity=".7"/>` + t(140, 100, '5 = Stern', GH, 13)),
      text: ['Vier in einer Reihe machen eine Funkenrune.', 'Fünf machen eine Sternrune. Beide räumen viel ab.'] },
    { bild: svg(k(30, 50, 140, 14, '#0c1011', 7) + k(30, 50, 100, 14, J, 7) + t(100, 95, 'Stufe geschafft!', GH, 15)),
      text: ['Erreiche das Punkteziel. Dann kommt die nächste Stufe.', 'Es gibt keine Zeit und keine Zuggrenze.'] }
  ] },
  hoehlenkarte: { titel: 'Höhlenkarte', seiten: [
    { bild: svg(karte(['###', '###', '###'], 52, 10, 30) + `<g opacity=".85">${raute(155, 40, 12, GO)}</g>` + t(155, 75, 'Fallen', GH, 13)),
      text: ['Unter manchen Steinen sind Fallen versteckt.', 'Decke alle Felder ohne Falle auf. Das erste Feld ist immer sicher.'] },
    { bild: svg(karte(['###', '#1#', '###'], 52, 10, 30, [0, 1, 2, 3, 5, 6, 7, 8]) + t(165, 52, '8', GH, 22) + t(165, 72, 'Nachbarn', GH, 12)),
      text: ['Eine Zahl sagt: So viele Fallen liegen direkt um dieses Feld.', 'Alle 8 Nachbarn zählen mit, auch schräg.'] },
    { bild: svg(karte(['...', '.11', '.1#'], 52, 10, 30, [8]) + pfeil(150, 30, 120, 82, GH) + t(170, 25, 'Falle!', GH, 14)),
      text: ['Beispiel: Die 1 hat nur noch einen verdeckten Nachbarn.', 'Also ist genau dort die Falle.'] },
    { bild: svg(karte(['...', '.11', '.1F'], 52, 10, 30) + k(140, 45, 54, 26, '#16231F', 8, `stroke="${J}" stroke-width="1.5"`) + raute(152, 58, 6, J) + t(173, 63, 'Mark.', JH, 10)),
      text: ['Markiere die Falle mit einem Kristall.', 'Knopf „Markieren“ antippen oder lange auf das Feld drücken.'] },
    { bild: svg(karte(['1##', '1F#', '1##'], 52, 10, 30, [1, 7]) + t(160, 58, 'sicher', JH, 14)),
      text: ['Die Einsen links haben ihre Falle schon: den Kristall.', 'Ihre anderen Nachbarn sind sicher. Du kannst sie aufdecken.'] },
    { bild: svg(karte(['1##', 'F1#', '1##'], 40, 10, 30) + finger(87, 57) + t(165, 50, 'Zahl', JH, 13) + t(165, 68, 'antippen', JH, 13)),
      text: ['Sind um eine Zahl alle Fallen markiert, tippe die Zahl an.', 'Dann öffnen sich die übrigen Nachbarn von selbst.'] },
    { bild: svg(karte(['X'], 40, 30, 40) + t(140, 45, 'Eine Falle!', GH, 15) + k(105, 60, 72, 26, JT, 8) + t(141, 78, 'Zurück', '#fff', 13)),
      text: ['Unsicher? „Tipp“ öffnet ein sicheres Feld.', 'Und nach einer Falle kannst du zurücknehmen.'] }
  ] },
  runenbrecher: { titel: 'Runenbrecher', seiten: [
    { bild: svg(k(60, 95, 70, 10, GO, 5) + finger(95, 100) + pfeil(70, 80, 40, 80) + pfeil(120, 80, 150, 80)),
      text: ['Ziehe den Finger hin und her.', 'Der goldene Schild folgt deinem Finger.'] },
    { bild: svg(k(70, 98, 60, 9, GO, 5) + `<circle cx="100" cy="88" r="7" fill="${JH}"/>` + pfeil(100, 76, 125, 30, JH) + t(160, 60, 'Tippen', GH, 13)),
      text: ['Tippe aufs Feld. Dann fliegt die Kugel los.', 'Fang sie mit dem Schild wieder auf.'] },
    { bild: svg([0, 1, 2, 3, 4].map(c => k(15 + c * 35, 20, 32, 14, c === 2 ? '#c9a04a' : c === 4 ? '#5a6460' : J, 3)).join('') + t(31, 55, '1×', TXT, 12) + t(101, 55, 'Gold', GH, 12) + t(171, 55, 'fest', TXT, 12) + `<circle cx="66" cy="80" r="7" fill="${JH}"/>`),
      text: ['Triff alle Steine. Manche brauchen zwei Treffer.', 'Graue feste Steine bleiben stehen.'] },
    { bild: svg(k(85, 30, 30, 16, J, 8) + t(100, 43, '↔', '#0c1011', 13) + pfeil(100, 52, 100, 80) + k(70, 90, 60, 9, GO, 5)),
      text: ['Manchmal fallen Zeichen herunter. Fang sie!', 'Sie machen den Schild breiter, die Kugel langsamer oder geben eine zweite Kugel.'] }
  ] },
  jadeschlange: { titel: 'Jadeschlange', seiten: [
    { bild: svg([0, 1, 2, 3].map(c => `<circle cx="${40 + c * 18}" cy="60" r="8" fill="${J}"/>`).join('') + `<circle cx="112" cy="60" r="9" fill="${JH}"/>` + finger(150, 80) + pfeil(150, 80, 150, 35)),
      text: ['Wische in eine Richtung.', 'Die Schlange biegt dorthin ab.'] },
    { bild: svg([0, 1, 2].map(c => `<circle cx="${40 + c * 18}" cy="60" r="8" fill="${J}"/>`).join('') + `<circle cx="94" cy="60" r="9" fill="${JH}"/>` + raute(130, 60, 10, J) + raute(165, 60, 10, GO) + t(165, 90, 'mehr', GH, 12)),
      text: ['Sammle Kristalle. Die Schlange wird länger.', 'Goldene Kristalle geben mehr Punkte.'] },
    { bild: svg(k(30, 20, 140, 80, 'none', 6, `stroke="${J}" stroke-width="2" stroke-dasharray="6 4"`) + `<circle cx="165" cy="60" r="8" fill="${JH}"/>` + pfeil(172, 60, 192, 60) + `<circle cx="38" cy="60" r="8" fill="${JH}"/>` + pfeil(8, 60, 28, 60)),
      text: ['Am Rand ist ein Tor.', 'Die Schlange kommt auf der anderen Seite wieder heraus.'] },
    { bild: svg(`<path d="M40 85 h60 v-40 h-40 v25" stroke="${J}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` + `<circle cx="60" cy="71" r="9" fill="${JH}"/>` + t(160, 30, 'Nicht', GH, 13) + t(160, 48, 'beißen!', GH, 13)),
      text: ['Beiß dich nicht selbst. Dann ist die Runde vorbei.', 'Steine im Weg kosten zwei Glieder.'] }
  ] }
};

export const hatAnleitung = (id) => !!ANLEITUNGEN[id];
