// Runengruft: Regeln (ohne Anzeige). Erkunden in Schritten, Rätsel an den Wänden, Kämpfe in Runden.
// Anzeige und Bedienung in ./runengruft-ui.js.
//
// Karte: ein Zeichen je Feld.
//   #  Wand            .  Boden          S  Start (Boden)     T  Treppe nach unten (Boden)
//   D  Tür mit Schloss (Schlüssel)       G  Gitter (Hebel)    Q  Runentor (Runen in der richtigen Reihenfolge)
//   X  Geheimwand (öffnet ein versteckter Knopf)
//   H  Wand mit Hebel  B  Wand mit verstecktem Knopf  P  Wand mit Tafel  1 2 3  Wand mit Rune
//   F  Wand mit Kristallfassung (Leitkristall einsetzen: öffnet Tore, Leitbahn leuchtet)
//   E  Lichtquelle in der Wand   Z / Y  Zielkristall (Lichtstrahl trifft: Tor öffnet sich bzw. Fach)
//   M  Erinnerungsspiegel (zeigt ein Bild aus der Vergangenheit)
//   K  Sporenkristall in der Wand (Funke oder Lichtkristall: Wurzeln weichen)   W  Wurzeln versperren den Gang
// Drehbare Spiegel stehen auf dem Boden (etage.spiegel), Stellung 0 = /, 1 = \, 2 = offen (Licht geht durch).
// Wände mit etwas daran (H, B, P, 1–3, F) wirken nur von der Seite, auf der man davorsteht.
// Dazu je Etage: deko (Zelte, Feuerstelle, Kisten: versperren den Weg, aber nicht die Sicht),
// geheimnisse (Liste; gefunden über Dinge, Fächer hinter Knöpfen, Tafeln oder alle Notizen),
// ereignisse (einmalige Begegnungen, wenn man ein Feld sieht).

import * as A from './runengruft-ausruestung.js';

export const AUSR = A;   // für die Anzeige (Katalog, Werte, Plätze)

export const RICHTUNGEN = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // Norden, Osten, Süden, Westen
export const RICHTUNG_NAME = ['Norden', 'Osten', 'Süden', 'Westen'];

const WAND = new Set(['#', 'H', 'B', 'P', '1', '2', '3', '4', '5', 'F', 'E', 'Z', 'Y', 'M', 'K']);
const TUER = new Set(['D', 'G', 'Q', 'X', 'W']);

// ---------- Etagen ----------
export const ETAGEN = [
  {
    name: 'Halle der ersten Rune',
    karte: [
      '###############',
      '#S....#......k#',
      '#.###.#.####.##',
      '#.#.....#....P#',
      '#.#.###.#.#####',
      '#...#P..#.....#',
      '#######D#######',
      '#.....#.....#.B',
      '#.###.#.###.#.#',
      'B.#.#.....#...#',
      '#.X.#######H#.#',
      '#.#.#########.#',
      '#####P#######G#',
      'B.............#',
      '#Q###1##2##3###',
      '#............T#',
      '###############'
    ],
    start: { x: 1, y: 1, r: 2 },
    // Was auf dem Boden liegt
    dinge: [
      { x: 13, y: 1, typ: 'schluessel' },
      { x: 5, y: 7, typ: 'heiltrank' },
      { x: 3, y: 11, typ: 'jadeklinge' },
      { x: 3, y: 9, typ: 'heiltrank' },
      { x: 3, y: 10, typ: 'notiz', notiz: 'senna1', geheimnis: 'senna1' },
      { x: 9, y: 13, typ: 'manatrank' }
    ],
    gegner: [
      { x: 3, y: 3, typ: 'schleim' },
      { x: 11, y: 1, typ: 'schleim' },
      { x: 9, y: 7, typ: 'fledermaus' },
      { x: 5, y: 9, typ: 'schleim' },
      { x: 12, y: 13, typ: 'fledermaus' },
      { x: 10, y: 15, typ: 'waechter' }
    ],
    // Tafeln: Text je Feld
    tafeln: {
      '5,5': ['Der Schrein ist versunken.', 'Unten wartet die Runenquelle.', 'Findet die Treppe nach unten.'],
      '13,3': ['Nicht jede Wand ist nur eine Wand.', 'Tippt auf die Steine.', 'Manche Steine sind Knöpfe.'],
      '5,12': ['Das Tor hört auf drei Runen.', 'Berührt sie in dieser Reihenfolge.']
    },
    // Runen an den Wänden 1, 2, 3 und die richtige Reihenfolge (Zeichen: welle, auge, stern)
    runen: { '1': 'stern', '2': 'welle', '3': 'auge' },
    runenFolge: ['welle', 'stern', 'auge'],
    // Hebel öffnet Gitter, Knopf öffnet Geheimwand
    hebel: { '11,10': '13,12' },
    // Wandfackeln (Weltkoordinaten, dicht vor der Wand)
    fackeln: [{ x: 1.14, y: 3.5 }, { x: 7.86, y: 4.5 }, { x: 7.14, y: 8.5 }, { x: 11.14, y: 9.5 }, { x: 1.14, y: 13.5 }, { x: 13.86, y: 15.5 }],
    knoepfe: { '0,9': '2,10', '14,7': { gibt: 'schildkristall', geheimnis: 'fach1' }, '0,13': { gibt: 'heiltrank', geheimnis: 'fach2' } },
    runenTafel: '5,12',
    herzrune: 'welle',
    stufeMax: 3,
    geheimnisse: [
      { id: 'senna1', name: 'Sennas erste Notiz' },
      { id: 'fach1', name: 'Ein Schildkristall im Stein' },
      { id: 'fach2', name: 'Ein Vorrat hinter der Wand' }
    ]
  },
  {
    name: 'Das Lager',
    karte: [
      '#################',
      '#S..#...........#',
      '#...#...........#',
      '#...P...........B',
      '#...............#',
      '#.###...........#',
      '#########F#G#####',
      '#.....#.....#...#',
      '#.###.B.###.#.#.#',
      '#.#..X#...B...#.#',
      '#.#####.#.#####.#',
      '#.....#.........#',
      '#.###.#.#B#####F#',
      'P...#...X.......#',
      '#####G###########',
      '#..P...........T#',
      '#...............#',
      '#################'
    ],
    start: { x: 1, y: 1, r: 2 },
    dinge: [
      { x: 13, y: 2, typ: 'leitkristall' },
      { x: 8, y: 2, typ: 'notiz', notiz: 'doran1' },
      { x: 1, y: 5, typ: 'heiltrank' },
      { x: 3, y: 9, typ: 'leitkristall' },
      { x: 13, y: 9, typ: 'notiz', notiz: 'doran2' },
      { x: 1, y: 13, typ: 'notiz', notiz: 'doran3' },
      { x: 7, y: 13, typ: 'heiltrank' },
      { x: 12, y: 13, typ: 'notiz', notiz: 'senna2', geheimnis: 'senna2' },
      { x: 15, y: 13, typ: 'kernspeer' },
      { x: 10, y: 13, typ: 'kraftring' },
      { x: 6, y: 2, typ: 'lederwams' },
      { x: 4, y: 16, typ: 'manatrank' }
    ],
    gegner: [
      { x: 8, y: 4, typ: 'kaefer' },
      { x: 12, y: 3, typ: 'kaefer' },
      { x: 8, y: 7, typ: 'kaefer' },
      { x: 12, y: 9, typ: 'hund' },
      { x: 3, y: 11, typ: 'drohne' },
      { x: 9, y: 15, typ: 'drohne' },
      { x: 11, y: 16, typ: 'drohne' },
      { x: 13, y: 15, typ: 'waechter' }
    ],
    tafeln: {
      '4,3': ['Lager 1. Wasser gut.', 'Senna sagt: nicht weiter als bis zur blauen Bahn.'],
      '0,13': ['M. war hier. Dritter Tag.', 'Kael hält Wache am Gitter.', 'Doran schläft nicht.'],
      '3,15': ['Ein Stern mit acht Strahlen ist in den Stein geschnitten.', 'Das ist die zweite Herzrune.', 'Ilo zeichnet sie ab.']
    },
    // Kristallfassungen: Leitkristall einsetzen öffnet Tore, die Leitbahn (Bodenfelder) leuchtet auf
    fassungen: {
      '9,6': { oeffnet: ['11,6'], bahn: ['9,5', '10,5', '11,5'] },
      '15,12': { oeffnet: ['5,14'], bahn: ['15,11', '14,11', '13,11', '12,11', '11,11', '10,11', '9,11', '8,11', '7,11', '7,12', '7,13', '6,13', '5,13'] }
    },
    knoepfe: { '6,8': '5,9', '9,12': '8,13', '16,3': { gibt: 'manatrank', geheimnis: 'fach_lager' }, '10,9': { gibt: 'frostkristall', geheimnis: 'fach_kristall' } },
    deko: [
      { x: 7, y: 1, art: 'zelt' }, { x: 11, y: 1, art: 'zelt' }, { x: 9, y: 3, art: 'feuer' },
      { x: 5, y: 5, art: 'kiste' }, { x: 15, y: 5, art: 'kiste' }, { x: 14, y: 1, art: 'kiste' }
    ],
    // Der Hohle Ritter steht kurz am Ende des Gangs, wenn man ihn sieht (Abstand mindestens 3)
    ereignisse: [
      { id: 'ritter', art: 'ritter', x: 14, y: 11, ding: { x: 14, y: 11, typ: 'ritterstueck', geheimnis: 'ritter' } }
    ],
    fackeln: [{ x: 1.14, y: 2.5 }, { x: 15.86, y: 2.5 }, { x: 1.14, y: 8.5 }, { x: 15.86, y: 7.5 }, { x: 4.5, y: 11.14 }, { x: 1.14, y: 15.5 }, { x: 15.86, y: 16.5 }],
    kohle: ['4,3', '0,13'],          // Tafeln als Kohlezeichnung (Miras Karten)
    runenTafel: '3,15',
    herzrune: 'stern',
    stufeMax: 5,
    geheimnisse: [
      { id: 'senna2', name: 'Sennas zweite Notiz' },
      { id: 'tagebuch', name: 'Dorans ganzes Tagebuch', art: 'notizen', alle: ['doran1', 'doran2', 'doran3'] },
      { id: 'mira', name: 'Miras Zeichen', art: 'tafel', tafel: '0,13' },
      { id: 'fach_lager', name: 'Ein Manatrank im Lager' },
      { id: 'fach_kristall', name: 'Ein Frostkristall im Stein' },
      { id: 'ritter', name: 'Ein Stück vom Hohlen Ritter' }
    ]
  },
  {
    name: 'Die Spiegelhallen',
    karte: [
      '###H###Y#########',
      '#S....#.........#',
      '#.....G.........#',
      'B.....Z.........#',
      '#.....#.........#',
      '##M####.........#',
      '######E.........#',
      '#######.........#',
      '#####B###G####M##',
      '#...#...........B',
      '#...X.#.#.#.##..#',
      '#...#.#.#.#.#...M',
      '#####.#...#.#.#.#',
      'P.....###.#...#.#',
      '#.#.#.#.#.#.#.#.#',
      '#..............T#',
      '#######P#########'
    ],
    start: { x: 1, y: 1, r: 1 },
    dinge: [
      { x: 3, y: 2, typ: 'manatrank' },
      { x: 15, y: 7, typ: 'runenmantel' },
      { x: 2, y: 10, typ: 'notiz', notiz: 'senna3', geheimnis: 'senna3' },
      { x: 13, y: 13, typ: 'heiltrank' },
      { x: 1, y: 15, typ: 'heiltrank' }
    ],
    gegner: [
      { x: 9, y: 2, typ: 'scherbe' },
      { x: 11, y: 7, typ: 'auge' },
      { x: 12, y: 9, typ: 'scherbe' },
      { x: 9, y: 12, typ: 'fresser' },
      { x: 3, y: 15, typ: 'auge' },
      { x: 11, y: 15, typ: 'hueter', wach: 2 }
    ],
    tafeln: {
      '0,13': ['Die Schrift an der Wand ist verdreht.', 'Ilo liest sie im Spiegel: „Vertraut dem Ritter.“'],
      '7,16': ['Ein Auge mit einer Pupille ist in den Stein geschnitten.', 'Das ist die dritte Herzrune.', 'Ilo zeichnet sie ab.']
    },
    hebel: { '3,0': '6,2' },
    hebelArt: { '3,0': 'ring' },
    knoepfe: { '5,8': '4,10', '0,3': { gibt: 'heiltrank', geheimnis: 'fach_a' }, '16,9': { gibt: 'lichtkristall', geheimnis: 'fach_licht' } },
    // Licht lenken: Quelle, drehbare Spiegel, Ziele
    quellen: { '6,6': 1 },                         // Richtung des Strahls (0 N, 1 O, 2 S, 3 W)
    spiegel: [{ x: 10, y: 6, stand: 0 }, { x: 13, y: 6, stand: 1 }, { x: 13, y: 3, stand: 2 }, { x: 7, y: 3, stand: 2 }],
    ziele: {
      '6,3': { oeffnet: ['9,8'] },
      '7,0': { gibt: 'ruheamulett', geheimnis: 'amulett' }   // Geheimnis: der vierte Spiegel lenkt das Licht nach oben
    },
    erinnerungen: {
      '2,5': { bild: 1, text: ['So fing es an.', 'Vier Freunde und eine Karte.'] },
      '14,8': { bild: 2, text: ['Niemand hat es gesehen.', 'Nur der Spiegel.'] },
      '16,11': { bild: 3, text: ['Kael: „Leg ihn zurück, Doran. Sofort.“'] }
    },
    fackeln: [{ x: 1.14, y: 3.5 }, { x: 15.86, y: 6.5 }, { x: 7.14, y: 1.5 }, { x: 15.86, y: 12.5 }, { x: 1.14, y: 15.5 }],
    kohle: [],
    runenTafel: '7,16',
    herzrune: 'auge',
    stufeMax: 7,
    einstieg: ['Die Treppe führt in eine hohe Halle.', 'Überall hängen Spiegel aus Kristall.', 'Es ist kalt und sehr still.'],
    geheimnisse: [
      { id: 'senna3', name: 'Sennas dritte Notiz' },
      { id: 'amulett', name: 'Das Amulett im Kristall' },
      { id: 'erinnerungen', name: 'Alle drei Erinnerungen', art: 'erinnerungen' },
      { id: 'spiegelschrift', name: 'Die Spiegelschrift', art: 'tafel', tafel: '0,13' },
      { id: 'fach_a', name: 'Ein Heiltrank hinter der Wand' },
      { id: 'fach_licht', name: 'Ein Lichtkristall im Stein' }
    ]
  },
  {
    name: 'Das Wurzelwerk',
    karte: [
      '#########B#######',
      '#S....#.........#',
      '#.###.#.#######.#',
      '#.#...#.#.....#.#',
      '#.#.#.#.#.###.#.#',
      '#...#...K...#...#',
      '#######W#########',
      '#.....#.........#',
      '#.###.#.#.###.#.#',
      '#.#...#.#...#.#.#',
      '#.#.###.#.#.#.#.#',
      'P.......#..K#.#.B',
      '####XB####W######',
      '##...#......K...#',
      '##...P......W...#',
      '#####T......#...#',
      '#################'
    ],
    start: { x: 1, y: 1, r: 1 },
    dinge: [
      { x: 1, y: 5, typ: 'manatrank' },
      { x: 13, y: 3, typ: 'heiltrank' },
      { x: 15, y: 9, typ: 'plattenweste' },
      { x: 9, y: 9, typ: 'manatrank' },
      { x: 3, y: 13, typ: 'notiz', notiz: 'senna4', geheimnis: 'senna4' },
      { x: 2, y: 14, typ: 'runenstab' },
      { x: 7, y: 13, typ: 'notiz', notiz: 'senna5' },
      { x: 15, y: 13, typ: 'glutkristall', geheimnis: 'wurzelkammer' }
    ],
    gegner: [
      { x: 3, y: 3, typ: 'spinne' },
      { x: 11, y: 5, typ: 'spore' },
      { x: 13, y: 9, typ: 'spinne' },
      { x: 2, y: 11, typ: 'spore' },
      { x: 3, y: 9, typ: 'wurm', lauert: true },
      { x: 14, y: 15, typ: 'wurm', lauert: true },
      { x: 8, y: 14, typ: 'koloss' }
    ],
    tafeln: {
      '0,11': ['In den Stein ist etwas geritzt.', 'K. – Ich halte Wache.', 'Bis sie zurückkommt.'],
      '5,14': ['Ein Stamm mit drei Wurzeln ist in den Stein geschnitten.', 'Das ist die vierte Herzrune.', 'Ilo zeichnet sie ab.']
    },
    // Sporenkristalle: Licht (Funke oder Lichtkristall) lässt die Wurzeln zurückweichen
    sporen: { '8,5': { oeffnet: ['7,6'] }, '11,11': { oeffnet: ['10,12'] }, '12,13': { oeffnet: ['12,14'] } },
    knoepfe: { '5,12': '4,12', '9,0': { gibt: 'heiltrank', geheimnis: 'fach_heil' }, '16,11': { gibt: 'manatrank', geheimnis: 'fach_mana' } },
    ereignisse: [
      { id: 'ritter1', art: 'ritter', x: 14, y: 1, text: ['Am Ende des Gangs steht wieder der Ritter aus Metall.', 'Er hebt die Hand. Dann ist er fort.'] },
      { id: 'ritter2', art: 'ritter', x: 14, y: 7, text: ['Der Ritter steht zwischen den Wurzeln.', 'Er zeigt nach unten. Dann geht er.'], gespraech: [['Ilo', 'Er will, dass wir weitergehen.'], ['Rana', 'Oder er warnt uns.']] }
    ],
    nachWaechter: { typ: 'koloss', gibt: 'ruheamulett' },
    fackeln: [{ x: 1.14, y: 3.5 }, { x: 15.86, y: 3.5 }, { x: 1.14, y: 8.5 }, { x: 15.86, y: 8.5 }, { x: 6.14, y: 14.5 }],
    kohle: [],
    pilze: true,
    runenTafel: '5,14',
    herzrune: 'wurzel',
    stufeMax: 9,
    einstieg: ['Es wird eng und warm.', 'Wurzeln aus Stein und Kristall wachsen durch die Wände.', 'Manche Gänge sind zugewachsen.'],
    geheimnisse: [
      { id: 'senna4', name: 'Sennas vierte Notiz' },
      { id: 'wurzelkammer', name: 'Die Kammer hinter den Wurzeln' },
      { id: 'kael', name: 'Kaels Zeichen', art: 'tafel', tafel: '0,11' },
      { id: 'fach_heil', name: 'Ein Heiltrank im Stein' },
      { id: 'fach_mana', name: 'Ein Manatrank im Stein' }
    ]
  },
  {
    name: 'Die Herzkammer',
    karte: [
      '#########B#######',
      '#S..#.....#.....#',
      '#.#.#.###.#.###.#',
      'P.#...#.....#...#',
      '#.#####.#####.#.#',
      '#...............#',
      '####F#P#.###F####',
      '###...........###',
      '##.............##',
      '#1.............3#',
      '##.............##',
      '##.............##',
      '##.............##',
      '#2.............4#',
      '###...........###',
      '####F###5###F####',
      '#################'
    ],
    start: { x: 1, y: 1, r: 2 },
    dinge: [
      { x: 7, y: 3, typ: 'heiltrank' },
      { x: 15, y: 1, typ: 'manatrank' },
      { x: 1, y: 5, typ: 'heiltrank' }
    ],
    gegner: [
      { x: 3, y: 3, typ: 'spore' },
      { x: 13, y: 3, typ: 'scherbe' },
      { x: 11, y: 5, typ: 'auge' },
      { x: 8, y: 7, typ: 'ritter', steht: true },
      { x: 8, y: 11, typ: 'herz', steht: true }
    ],
    tafeln: {
      '0,3': ['Hier hat jemand geschlafen.', 'Ein Stern ist in den Stein geritzt.', 'Darunter steht: Für Ilo.'],
      '6,6': ['Fünf Runen stimmen das Herz.', 'In dieser Reihenfolge.', 'Die letzte leuchtet erst, wenn die anderen stimmen.']
    },
    runen: { '1': 'auge', '2': 'welle', '3': 'wurzel', '4': 'stern', '5': 'licht' },
    runenFolge: ['auge', 'welle', 'wurzel', 'stern', 'licht'],
    runenErstNachKetten: true,
    // Kettenhalter: vier Leitkristalle lösen die Ketten des Herzens
    fassungen: {
      '4,6': { oeffnet: [], bahn: ['4,7', '4,8', '4,9', '4,10', '4,11', '5,11', '6,11', '7,11'] },
      '12,6': { oeffnet: [], bahn: ['12,7', '12,8', '12,9', '12,10', '12,11', '11,11', '10,11', '9,11'] },
      '4,15': { oeffnet: [], bahn: ['4,14', '4,13', '4,12'] },
      '12,15': { oeffnet: [], bahn: ['12,14', '12,13', '12,12'] }
    },
    knoepfe: { '9,0': { gibt: 'manatrank', geheimnis: 'fach_herz' } },
    deko: [{ x: 8, y: 11, art: 'herz' }],
    ereignisse: [
      { id: 'stimme', art: 'stimme', x: 8, y: 11, gespraech: [['Eine Stimme aus dem Kristall', 'Ilo? Du bist groß geworden.'], ['Ilo', 'Meisterin Senna!']] }
    ],
    fackeln: [{ x: 1.14, y: 1.5 }, { x: 15.86, y: 1.5 }, { x: 2.14, y: 8.5 }, { x: 14.86, y: 8.5 }, { x: 2.14, y: 12.5 }, { x: 14.86, y: 12.5 }],
    kohle: [],
    runenTafel: '6,6',
    herzrune: 'licht',
    stufeMax: 10,
    einstieg: ['Ganz unten ist es hell.', 'Ein tiefes Brummen füllt die Luft.', 'Das Herz der Gruft ist nah.'],
    geheimnisse: [
      { id: 'fuer_ilo', name: 'Sennas Schlafplatz', art: 'tafel', tafel: '0,3' },
      { id: 'fach_herz', name: 'Ein Manatrank im Stein' },
      { id: 'kael_frei', name: 'Kael ohne Kampf befreit' }
    ]
  }
];

export const GEGNER = {
  schleim: { name: 'Kristallschleim', artikel: 'Ein', leben: 14, schaden: [1, 3], erfahrung: 4 },
  fledermaus: { name: 'Glimmermotte', artikel: 'Eine', leben: 18, schaden: [2, 4], erfahrung: 6 },
  waechter: { name: 'Kernwächter', artikel: 'Ein', leben: 45, schaden: [3, 6], erfahrung: 15 },
  kaefer: { name: 'Splitterkäfer', artikel: 'Ein', leben: 16, schaden: [2, 4], erfahrung: 5 },
  hund: { name: 'Frosthund', artikel: 'Ein', leben: 24, schaden: [3, 5], erfahrung: 8 },
  scherbe: { name: 'Spiegelscherbe', artikel: 'Eine', leben: 20, schaden: [3, 5], erfahrung: 8 },
  auge: { name: 'Runenauge', artikel: 'Ein', leben: 22, schaden: [3, 6], erfahrung: 9 },
  fresser: { name: 'Lichtfresser', artikel: 'Ein', leben: 28, schaden: [3, 6], erfahrung: 11 },
  hueter: { name: 'Säulenhüter', artikel: 'Ein', leben: 60, schaden: [4, 7], erfahrung: 22 },
  spinne: { name: 'Tiefenspinne', artikel: 'Eine', leben: 30, schaden: [4, 6], erfahrung: 12 },
  spore: { name: 'Sporenkristall', artikel: 'Ein', leben: 26, schaden: [3, 7], erfahrung: 11 },
  wurm: { name: 'Echowurm', artikel: 'Ein', leben: 34, schaden: [4, 7], erfahrung: 14 },
  koloss: { name: 'Schlackenkoloss', artikel: 'Ein', leben: 80, schaden: [5, 8], erfahrung: 30 },
  ritter: { name: 'Der Hohle Ritter', artikel: '', leben: 70, schaden: [5, 8], erfahrung: 25 },
  herz: { name: 'Das Herz der Gruft', artikel: '', leben: 110, schaden: [5, 9], erfahrung: 40 },
  drohne: { name: 'Wächterdrohne', artikel: 'Eine', leben: 18, schaden: [2, 4], erfahrung: 6 }
};

export const DINGE = {
  schluessel: { name: 'Jadeschlüssel', text: 'Er passt in ein Schloss.' },
  leitkristall: { name: 'Leitkristall', text: 'Er passt in eine leere Fassung.' },
  kristall: { name: 'Sternsplitter', text: 'Ein seltener Kristall. Er leuchtet blau.' },
  ritterstueck: { name: 'Rüstungsstück', text: 'Ein Stück Metall mit grünem Kristall. Es ist noch warm.' },
  notiz: { name: 'Notiz', text: '' }
};
// Name und Text eines Dings: Quest-Dinge hier, Ausrüstung und Tränke aus dem Katalog
export const dingInfo = (typ) => DINGE[typ] || A.KATALOG[typ] || { name: typ, text: '' };
// Kommt ein Ding in den gemeinsamen Beutel? (Ausrüstung und Tränke)
const inDenBeutel = (typ) => !!A.KATALOG[typ] && A.KATALOG[typ].art !== 'schluessel';
const istAusruestung = (typ) => !!A.KATALOG[typ] && A.PLAETZE.includes(A.KATALOG[typ].art);
// Hat die Gruppe dieses Teil schon (angelegt oder im Beutel)?
export const besitzt = (s, typ) => s.beutel.some(d => d.typ === typ) || s.helden.some(h => A.PLAETZE.some(p => h.ausruestung[p] && h.ausruestung[p].typ === typ));

// Notizen und Tagebuchseiten (Sammelstücke, erzählen die Geschichte)
export const NOTIZEN = {
  senna1: { von: 'Senna', titel: 'Sennas Notiz 1', text: ['Wer das liest:', 'Das Herz ist nicht euer Feind.', 'Es hat nur den Takt verloren.'], antwort: [['Ilo', 'Das ist Sennas Schrift. Ich würde sie überall erkennen.'], ['Rana', 'Dann war sie hier. Gehen wir weiter.']] },
  senna3: { von: 'Senna', titel: 'Sennas Notiz 3', text: ['Nach dem Auge kommt die Welle.', 'Dann etwas, das tief unten wächst.', 'Ich habe es noch nicht gefunden.'], antwort: [['Ilo', 'Sie war allein, als sie weitersuchen musste.'], ['Rana', 'Jetzt ist sie es nicht mehr.']] },
  senna4: { von: 'Senna', titel: 'Sennas Notiz 4', text: ['Die vierte Rune wächst. Die Wurzel.', 'Kael hält Wache.', 'Er hört nicht auf, obwohl das Licht ihn verändert.'] },
  senna5: { von: 'Senna', titel: 'Sennas Notiz 5', text: ['Ich schaffe die letzten Runen nicht mehr.', 'Ich binde mich an das Herz.', 'Wer das findet: Die letzte Rune bin ich.'] },
  senna2: { von: 'Senna', titel: 'Sennas Notiz 2', text: ['Die Erbauer stimmen das Herz mit fünf Runen.', 'Ich kenne erst drei.', 'Zuerst kommt das Auge.'] },
  doran1: { von: 'Doran', titel: 'Dorans Tagebuch 1', text: ['Ein Kristall aus der Wand reicht für ein ganzes Haus.', 'Keiner wird es merken.'] },
  doran2: { von: 'Doran', titel: 'Dorans Tagebuch 2', text: ['Senna hat es gemerkt. Kael auch.', 'Ich habe ihnen gesagt, dass es nur Glas war.'] },
  doran3: { von: 'Doran', titel: 'Dorans Tagebuch 3', text: ['Das Licht flackert.', 'Ich glaube, ich habe etwas kaputt gemacht.'] }
};
export const HERZRUNEN = { welle: 'Welle', stern: 'Stern', auge: 'Auge', wurzel: 'Wurzel', licht: 'Licht' };

// ---------- Neues Spiel ----------
// Helden mit Werten und Ausrüstung (siehe runengruft-ausruestung.js). max und manaMax werden mitgeführt.
export function neueHelden() {
  return A.neueGruppe().helden.map(h => auffrischen({ ...h, name: A.GRUND[h.id].name, art: A.GRUND[h.id].art }));
}
export function auffrischen(h) {
  h.max = A.lebenMax(h);
  h.leben = Math.min(h.leben, h.max);
  if (h.id === 'ilo') { h.manaMax = A.manaMax(h); h.mana = Math.min(h.mana, h.manaMax); }
  return h;
}

export function neuesSpiel(etage = 0, mit = null) {
  const e = ETAGEN[etage];
  const s = {
    etage,
    x: e.start.x, y: e.start.y, r: e.start.r,
    helden: neueHelden(),
    taschen: { schluessel: 0, leitkristall: 0 },   // Dinge für Rätsel und Sammelstücke
    beutel: [A.ding('heiltrank')],                 // gemeinsamer Beutel: Ausrüstung und Tränke
    offen: [],                       // geöffnete Türen/Gitter/Geheimwände „x,y“
    hebelUnten: [],                  // umgelegte Hebel
    dinge: [],
    gegner: e.gegner.map((g, i) => ({ ...g, id: i, leben: GEGNER[g.typ].leben })),
    gesehen: [],                     // erkundete Felder „x,y“ (für die Karte)
    runen: [],                       // bisher berührte Runen
    kampf: null,                     // { gegner: id, runde, getan: {rana, ilo} }
    geschafft: false,
    besiegt: 0,                      // wie oft die Gruppe zum Eingang zurück musste
    fassungenVoll: [],               // Fassungen mit Kristall „x,y“
    gedrueckt: [],                   // Knöpfe mit Fach, die in diesem Durchgang schon offen sind
    ereignisse: [],                  // erlebte Begegnungen (ids)
    spiegel: Object.fromEntries((e.spiegel || []).map(sp => [`${sp.x},${sp.y}`, sp.stand])),  // Stellung der Spiegel
    zieleAn: [],                     // Zielkristalle, die schon Licht bekommen haben
    erinnert: [],                    // angesehene Erinnerungsspiegel
    sporenAn: [],                    // Sporenkristalle, die schon leuchten
    kael: null,                      // Herzkammer: 'mensch' (mit Amulett befreit) oder 'befreit' (nach dem Kampf)
    gratisTipp: true,                // der erste Kobold-Tipp je Etage kostet nichts
    spuren: [],                      // Geheimnis-Spuren auf der Karte [{ id, x, y }]
    phase: 'herz',                   // Herzkammer: herz → ketten → runen → frei
    ende: false,
    // bleibt über Etagen und Durchgänge:
    notizen: [],                     // gelesene Notizen (ids)
    gefunden: {},                    // Geheimnisse je Etage { "0": [ids] }
    herzrunen: [],
    geschafftBis: -1                 // höchste geschaffte Etage
  };
  if (mit) {
    s.helden = JSON.parse(JSON.stringify(mit.helden)).map(h => { auffrischen(h); h.leben = h.max; if (h.id === 'ilo') h.mana = h.manaMax; return h; });
    s.beutel = JSON.parse(JSON.stringify(mit.beutel || []));
    s.taschen = { ...mit.taschen, schluessel: 0, leitkristall: 0 };
    s.notizen = [...(mit.notizen || [])];
    s.gefunden = JSON.parse(JSON.stringify(mit.gefunden || {}));
    s.herzrunen = [...(mit.herzrunen || [])];
    s.geschafftBis = mit.geschafftBis ?? -1;
  }
  // Einmalige Dinge kommen nicht wieder, wenn man sie schon hat
  s.dinge = e.dinge.map((d, i) => ({ ...d, id: i })).filter(d =>
    !(d.geheimnis && gefundenIn(s, etage).includes(d.geheimnis)) &&
    !(d.typ === 'notiz' && s.notizen.includes(d.notiz)) &&
    !(istAusruestung(d.typ) && besitzt(s, d.typ)));
  return s;
}

// Eine Etage betreten (weiter nach unten oder dieselbe noch einmal): Helden, Beutel, Notizen,
// gefundene Geheimnisse und Herzrunen bleiben. Gegner, Rätsel und Tore beginnen von vorn.
export function etageBetreten(s, etage) {
  if (!ETAGEN[etage]) return null;
  return neuesSpiel(etage, s);
}
// Wie weit darf man? Geschaffte Etagen und die nächste darunter.
export const etageOffen = (s, etage) => !!ETAGEN[etage] && etage <= (s.geschafftBis ?? -1) + 1;

// ---------- Karte lesen ----------
export const etageVon = (s) => ETAGEN[s.etage];
export function zeichen(s, x, y) {
  const k = etageVon(s).karte;
  if (y < 0 || y >= k.length || x < 0 || x >= k[0].length) return '#';
  return k[y][x];
}
export const istOffen = (s, x, y) => s.offen.includes(`${x},${y}`);

// Kann man das Feld betreten?
export function begehbar(s, x, y) {
  return !blockiert(s, x, y) && !dekoAuf(s, x, y) && !spiegelAuf(s, x, y);
}
export const spiegelAuf = (s, x, y) => s.spiegel && s.spiegel[`${x},${y}`] !== undefined ? { x, y, stand: s.spiegel[`${x},${y}`] } : null;
// Ist das Feld für die Sicht eine Wand (oder geschlossene Tür)?
export function blockiert(s, x, y) {
  const c = zeichen(s, x, y);
  if (WAND.has(c)) return true;
  if (TUER.has(c)) return !istOffen(s, x, y);
  return false;
}
export const dekoAuf = (s, x, y) => (etageVon(s).deko || []).find(d => d.x === x && d.y === y) || null;

export const gegnerAuf = (s, x, y) => s.gegner.find(g => g.leben > 0 && g.x === x && g.y === y) || null;
export const dingAuf = (s, x, y) => s.dinge.filter(d => d.x === x && d.y === y);

// Feld vor, links, rechts … relativ zur Blickrichtung: vor = Schritte nach vorn, seite = nach rechts (+) / links (−)
export function feldRelativ(s, vor, seite, r = s.r) {
  const [fx, fy] = RICHTUNGEN[r];
  const [rx, ry] = RICHTUNGEN[(r + 1) % 4];
  return { x: s.x + fx * vor + rx * seite, y: s.y + fy * vor + ry * seite };
}

// ---------- Bewegen ----------
// art: 'vor' | 'zurueck' | 'links' | 'rechts' (seitwärts) | 'drehL' | 'drehR'
// Gibt { ok, grund } zurück. Gegner ziehen danach (siehe gegnerZiehen).
export function bewegen(s, art) {
  if (s.kampf) return { ok: false, grund: 'kampf' };
  if (art === 'drehL') { s.r = (s.r + 3) % 4; return { ok: true, gedreht: true }; }
  if (art === 'drehR') { s.r = (s.r + 1) % 4; return { ok: true, gedreht: true }; }
  const rel = { vor: [1, 0], zurueck: [-1, 0], links: [0, -1], rechts: [0, 1] }[art];
  if (!rel) return { ok: false, grund: 'art' };
  const z = feldRelativ(s, rel[0], rel[1]);
  if (!begehbar(s, z.x, z.y)) return { ok: false, grund: 'wand' };
  if (gegnerAuf(s, z.x, z.y)) return { ok: false, grund: 'gegner' };
  s.x = z.x; s.y = z.y;
  const raus = lauerndePruefen(s);
  if (zeichen(s, s.x, s.y) === 'T') etageGeschafft(s);
  return raus.length ? { ok: true, aufgetaucht: raus.map(g => g.id) } : { ok: true };
}

function etageGeschafft(s) {
  s.geschafft = true;
  const e = etageVon(s);
  if (e.herzrune && !s.herzrunen.includes(e.herzrune)) s.herzrunen.push(e.herzrune);
  s.geschafftBis = Math.max(s.geschafftBis ?? -1, s.etage);
}

// Begegnungen: einmal je Durchgang, wenn das Feld geradeaus zu sehen ist (3 bis 8 Felder weit).
export function ereignisPruefen(s) {
  for (const ev of etageVon(s).ereignisse || []) {
    if (s.ereignisse.includes(ev.id)) continue;
    for (let vor = 1; vor <= 8; vor++) {
      const f = feldRelativ(s, vor, 0);
      if (blockiert(s, f.x, f.y)) break;
      if (f.x === ev.x && f.y === ev.y) {
        if (vor < 3) break;
        s.ereignisse.push(ev.id);
        if (ev.ding && !(ev.ding.geheimnis && gefundenIn(s, s.etage).includes(ev.ding.geheimnis))) {
          s.dinge.push({ ...ev.ding, id: 1000 + s.dinge.length });
        }
        return { ...ev, abstand: vor };
      }
    }
  }
  return null;
}

// ---------- Geheimnisse ----------
export const gefundenIn = (s, etage) => (s.gefunden && s.gefunden[etage]) || [];
export function geheimnisStand(s, etage = s.etage) {
  const alle = ETAGEN[etage].geheimnisse || [];
  const da = gefundenIn(s, etage);
  return { gefunden: alle.filter(g => da.includes(g.id)).length, gesamt: alle.length,
    liste: alle.map(g => ({ id: g.id, name: g.name, gefunden: da.includes(g.id) })) };
}
function geheimnisMerken(s, id) {
  const g = (etageVon(s).geheimnisse || []).find(x => x.id === id);
  if (!g) return null;
  if (!s.gefunden[s.etage]) s.gefunden[s.etage] = [];
  if (s.gefunden[s.etage].includes(id)) return null;
  s.gefunden[s.etage].push(id);
  const st = geheimnisStand(s);
  return { id, name: g.name, anzahl: st.gefunden, gesamt: st.gesamt };
}
// Geheimnisse mit Bedingungen (alle Notizen beisammen)
function geheimnisseNachNotiz(s) {
  for (const g of etageVon(s).geheimnisse || []) {
    if (g.art === 'notizen' && g.alle.every(n => s.notizen.includes(n))) {
      const r = geheimnisMerken(s, g.id);
      if (r) return r;
    }
  }
  return null;
}

// Tafel lesen (merkt eine geheime Tafel)
export function tafelLesen(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'tafel') return null;
  const key = `${w.x},${w.y}`;
  const g = (etageVon(s).geheimnisse || []).find(x => x.art === 'tafel' && x.tafel === key);
  return { ...w, geheimnis: g ? geheimnisMerken(s, g.id) : null };
}

// ---------- Licht lenken ----------
// '/' lenkt O→N, N→O, W→S, S→W; '\' lenkt O→S, S→O, W→N, N→W; offen: geradeaus
const UMLENKEN = [[1, 0, 3, 2], [3, 2, 1, 0]];
// Weg des Lichts: Felder [x, y, rein, raus] und die Wand, die es trifft
export function strahlWeg(s) {
  const wege = [];
  for (const [k, r0] of Object.entries(etageVon(s).quellen || {})) {
    let [x, y] = k.split(',').map(Number), r = r0;
    const felder = [];
    let treffer = null;
    for (let i = 0; i < 80; i++) {
      x += RICHTUNGEN[r][0]; y += RICHTUNGEN[r][1];
      if (blockiert(s, x, y)) { treffer = { x, y, zeichen: zeichen(s, x, y) }; break; }
      const st = s.spiegel[`${x},${y}`];
      const rein = r;
      if (st === 0 || st === 1) r = UMLENKEN[st][r];
      felder.push([x, y, rein, r]);
    }
    wege.push({ quelle: k, felder, treffer });
  }
  return wege;
}
// Trifft das Licht einen Zielkristall, der noch dunkel ist? Dann wirkt er (einmal je Durchgang).
function lichtPruefen(s) {
  const ziele = etageVon(s).ziele || {};
  for (const w of strahlWeg(s)) {
    if (!w.treffer) continue;
    const key = `${w.treffer.x},${w.treffer.y}`;
    const z = ziele[key];
    if (!z || s.zieleAn.includes(key)) continue;
    s.zieleAn.push(key);
    const ev = { ziel: key };
    if (z.oeffnet) { for (const o of z.oeffnet) if (!s.offen.includes(o)) s.offen.push(o); ev.oeffnet = [...z.oeffnet]; }
    if (z.gibt) {
      if (z.geheimnis && gefundenIn(s, s.etage).includes(z.geheimnis)) ev.leer = true;
      else if (inDenBeutel(z.gibt) && s.beutel.length >= A.BEUTEL_PLAETZE) { s.zieleAn.pop(); ev.voll = true; }
      else { if (inDenBeutel(z.gibt)) A.aufnehmen(s, z.gibt); else s.taschen[z.gibt] = (s.taschen[z.gibt] || 0) + 1; ev.gibt = z.gibt; ev.geheimnis = geheimnisMerken(s, z.geheimnis); }
    }
    return ev;
  }
  return null;
}
// Spiegel vor der Gruppe drehen: / → \ → offen → /
export function spiegelDrehen(s) {
  if (s.kampf) return null;
  const w = wandVorn(s);
  if (!w || w.art !== 'spiegel') return null;
  const key = `${w.x},${w.y}`;
  s.spiegel[key] = (s.spiegel[key] + 1) % 3;
  return { stand: s.spiegel[key], licht: lichtPruefen(s) };
}
// Erinnerungsspiegel ansehen
export function erinnerungSehen(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'erinnerung') return null;
  const key = `${w.x},${w.y}`;
  if (!s.erinnert.includes(key)) s.erinnert.push(key);
  let geheimnis = null;
  const alle = Object.keys(etageVon(s).erinnerungen || {});
  const g = (etageVon(s).geheimnisse || []).find(x => x.art === 'erinnerungen');
  if (g && alle.every(k => s.erinnert.includes(k))) geheimnis = geheimnisMerken(s, g.id);
  return { ...w, geheimnis, gesehen: s.erinnert.length, alle: alle.length };
}

// ---------- Hilfen vom Kobold (für Runensplitter) ----------
export const HILFE_PREISE = { tipp: 10, spur: 30, trank: 15 };
const offenK = (s, k) => s.offen.includes(k);
const zuEtwas = (s, typ) => s.dinge.some(d => d.typ === typ);
// Ein Satz: was als Nächstes zu tun ist (nach dem Stand der Etage)
export function tippFuer(s) {
  const e = s.etage, t = s.taschen;
  if (s.kampf) return 'Erst den Kampf gewinnen. Tränke helfen, und Ilo kann heilen.';
  if (e === 0) {
    if (!offenK(s, '7,6') && !t.schluessel) return 'Im Norden liegt ein Schlüssel. Er öffnet die Tür in der Mitte.';
    if (!offenK(s, '7,6')) return 'Geh mit dem Schlüssel zur Tür in der Mitte und tippe auf das Schloss.';
    if (!offenK(s, '13,12')) return 'Ein Kristallschalter an einer Wand öffnet das Gitter im Osten. Tippe auf den Kristall.';
    if (!offenK(s, '1,14')) return 'Die Tafel vor den Runen zeigt die Reihenfolge. Berühre die Runen genau so.';
    return 'Das Runentor ist offen. Die Treppe liegt ganz im Südosten.';
  }
  if (e === 1) {
    if (!offenK(s, '11,6') && !t.leitkristall) return 'Im Lager liegt ein Leitkristall. Heb ihn auf.';
    if (!offenK(s, '11,6')) return 'Setz den Leitkristall in die leere Fassung am Ende des Lagers.';
    if (!offenK(s, '5,14') && !t.leitkristall && !offenK(s, '5,9')) return 'Ein Stein in der Werkstatt ist ein Knopf. Dahinter liegt der zweite Leitkristall.';
    if (!offenK(s, '5,14') && !t.leitkristall) return 'Hinter der offenen Geheimwand liegt der zweite Leitkristall.';
    if (!offenK(s, '5,14')) return 'Ganz im Osten der Werkstatt ist die zweite Fassung. Setz den Kristall dort ein.';
    return 'Das Tor im Süden ist offen. Dahinter wartet der Wächter vor der Treppe.';
  }
  if (e === 2) {
    if (!offenK(s, '6,2')) return 'Zieh am Ring an der Kette, ganz oben im Norden.';
    if (!offenK(s, '9,8')) return 'Klapp den ersten Spiegel ein. Lenke das Licht mit den anderen beiden zum dunklen Kristall im Westen.';
    return 'Das Tor ist offen. Die Treppe liegt hinter den Säulen im Süden.';
  }
  if (e === 3) {
    if (!offenK(s, '7,6')) return 'Ilo kann einen Funken in den trüben Kristall schicken. Das kostet 4 Mana. Ein Lichtkristall geht auch.';
    if (!offenK(s, '10,12')) return 'Im Süden der Höhle steckt der nächste trübe Kristall neben den Wurzeln. Bring ihn zum Leuchten.';
    return 'Die Treppe liegt unten links. Der Schlackenkoloss bewacht sie.';
  }
  if (e === 4) {
    if (s.phase === 'herz' && !s.kael) return besitzt(s, 'ruheamulett') ? 'Zeig dem Ritter das Amulett der Ruhe.' : 'Der Ritter versperrt den Weg. Ihr müsst ihn besiegen. Dann ist er frei.';
    if (s.phase === 'herz') return 'Zerschlagt die Ringe des Herzens im Kampf.';
    if (s.phase === 'ketten') return 'Heb die vier Splitter auf. Setz sie in die vier Kettenhalter an den Wänden.';
    if (s.phase === 'runen') return 'Die Tafel am Eingang zeigt die Reihenfolge: Auge, Welle, Wurzel, Stern, Licht.';
  }
  return 'Erkunde die Etage. Tippe auf alles, was dir auffällt.';
}
// Wo liegt ein Geheimnis, das noch fehlt? (Ort für die Spur)
export function geheimnisOrt(s, id) {
  const e = etageVon(s);
  const pos = (k) => { const [x, y] = k.split(',').map(Number); return { x, y }; };
  const d = e.dinge.find(x => x.geheimnis === id);
  if (d) return { x: d.x, y: d.y };
  for (const [k, v] of Object.entries(e.knoepfe || {})) if (v && typeof v === 'object' && v.geheimnis === id) return pos(k);
  for (const [k, v] of Object.entries(e.ziele || {})) if (v.geheimnis === id) return pos(k);
  const g = (e.geheimnisse || []).find(x => x.id === id);
  if (g && g.art === 'tafel') return pos(g.tafel);
  if (g && g.art === 'notizen') { const n = e.dinge.find(x => x.typ === 'notiz' && g.alle.includes(x.notiz) && !s.notizen.includes(x.notiz)); if (n) return { x: n.x, y: n.y }; }
  if (g && g.art === 'erinnerungen') { const k = Object.keys(e.erinnerungen).find(x => !s.erinnert.includes(x)); if (k) return pos(k); }
  const ev = (e.ereignisse || []).find(x => x.ding && x.ding.geheimnis === id);
  if (ev) return { x: ev.x, y: ev.y };
  if (id === 'kael_frei') { const r = e.gegner.find(x => x.typ === 'ritter'); if (r) return { x: r.x, y: r.y }; }
  return null;
}
// Spur zu einem noch fehlenden Geheimnis: ein Kreis in der Nähe (nicht genau auf dem Feld)
export function spurLegen(s, rnd = Math.random) {
  const da = gefundenIn(s, s.etage);
  const offen = (etageVon(s).geheimnisse || []).filter(g => !da.includes(g.id) && !s.spuren.some(x => x.id === g.id));
  for (const g of offen) {
    const o = geheimnisOrt(s, g.id);
    if (!o) continue;
    const sp = { id: g.id, x: o.x + Math.round((rnd() - 0.5) * 2), y: o.y + Math.round((rnd() - 0.5) * 2) };
    s.spuren.push(sp);
    return sp;
  }
  return null;
}
// Gibt es überhaupt noch eine Spur zu legen?
export const spurMoeglich = (s) => (etageVon(s).geheimnisse || []).some(g => !gefundenIn(s, s.etage).includes(g.id) && !s.spuren.some(x => x.id === g.id) && geheimnisOrt(s, g.id));

// ---------- Herzkammer ----------
// Ilo hält dem Hohlen Ritter das Amulett hin: Kael wird wieder er selbst und hilft im Kampf gegen das Herz.
export function amulettZeigen(s) {
  const k = s.kampf;
  const g = k && s.gegner.find(x => x.id === k.gegner);
  if (!g || g.typ !== 'ritter' || !besitzt(s, 'ruheamulett')) return null;
  g.leben = 0;
  s.kampf = null;
  s.kael = 'mensch';
  return { geheimnis: geheimnisMerken(s, 'kael_frei') };
}
// Kael schlägt mit zu (nur gegen das Herz, wenn er mit dem Amulett befreit wurde)
function kaelHilft(s, g, rnd) {
  if (s.kael !== 'mensch' || g.typ !== 'herz' || g.leben <= 0) return null;
  const n = wurf(rnd, [4, 7]);
  g.leben = Math.max(0, g.leben - n);
  return n;
}

// ---------- Sporenkristalle ----------
// Ein Lichtkristall (angelegt) bringt den Kristall zum Leuchten, sonst Ilos Funke (4 Mana).
export function sporeWecken(s) {
  if (s.kampf) return null;
  const w = wandVorn(s);
  if (!w || w.art !== 'spore') return null;
  if (w.an) return { ok: false, grund: 'schon' };
  const key = `${w.x},${w.y}`;
  const licht = s.helden.some(h => h.leben > 0 && h.ausruestung.kristall && h.ausruestung.kristall.typ === 'lichtkristall');
  let wie = 'licht';
  if (!licht) {
    const ilo = s.helden.find(h => h.id === 'ilo');
    if (!ilo || ilo.leben <= 0 || ilo.mana < 4) return { ok: false, grund: 'mana' };
    ilo.mana -= 4; wie = 'funke';
  }
  s.sporenAn.push(key);
  const z = etageVon(s).sporen[key];
  for (const o of z.oeffnet) if (!s.offen.includes(o)) s.offen.push(o);
  return { ok: true, wie, oeffnet: [...z.oeffnet] };
}

// Lauernde Gegner (Echowürmer) brechen aus dem Boden, wenn die Gruppe direkt daneben steht.
export function lauerndePruefen(s) {
  const raus = [];
  for (const g of s.gegner) {
    if (!g.lauert || g.leben <= 0) continue;
    if (Math.abs(g.x - s.x) + Math.abs(g.y - s.y) <= 1) { g.lauert = false; raus.push(g); }
  }
  return raus;
}

// Leitkristall in die Fassung vor der Gruppe setzen
export function einsetzen(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'fassung') return null;
  if (w.voll) return { ok: false, grund: 'voll' };
  if (!s.taschen.leitkristall) return { ok: false, grund: 'kein_kristall' };
  const key = `${w.x},${w.y}`;
  const f = etageVon(s).fassungen[key];
  s.taschen.leitkristall--;
  s.fassungenVoll.push(key);
  for (const z of f.oeffnet) if (!s.offen.includes(z)) s.offen.push(z);
  const ev = { ok: true, oeffnet: [...f.oeffnet], bahn: [...f.bahn] };
  if (s.phase === 'ketten' && Object.keys(etageVon(s).fassungen).every(k => s.fassungenVoll.includes(k))) { s.phase = 'runen'; ev.kettenFrei = true; }
  return ev;
}
// Felder mit leuchtender Leitbahn (für die Anzeige)
export function bahnFelder(s) {
  const f = etageVon(s).fassungen || {};
  const an = new Set(), aus = new Set();
  for (const [k, v] of Object.entries(f)) for (const b of v.bahn) (s.fassungenVoll.includes(k) ? an : aus).add(b);
  return { an, aus };
}

// ---------- Sicht und Karte ----------
// Felder in Sicht (für die automatische Karte): bis 4 Felder nach vorn, je 2 zur Seite, bis zur ersten Wand.
export function sichtMerken(s) {
  const neu = new Set(s.gesehen);
  neu.add(`${s.x},${s.y}`);
  for (let seite = -1; seite <= 1; seite++) {
    for (let vor = 0; vor <= 4; vor++) {
      const f = feldRelativ(s, vor, seite);
      neu.add(`${f.x},${f.y}`);
      if (blockiert(s, f.x, f.y)) break;
    }
  }
  // Die Wände direkt neben jedem gesehenen Bodenfeld gehören auch dazu
  s.gesehen = [...neu];
}

// ---------- Wände antippen ----------
// Was ist an der Wand direkt vor der Gruppe? Gibt { art, x, y, ... } oder null.
export function wandVorn(s) {
  const f = feldRelativ(s, 1, 0);
  const sp = spiegelAuf(s, f.x, f.y);
  if (sp) return { art: 'spiegel', ...sp };
  const c = zeichen(s, f.x, f.y);
  const key = `${f.x},${f.y}`;
  const e = etageVon(s);
  if (c === 'H') return { art: 'hebel', x: f.x, y: f.y, unten: s.hebelUnten.includes(key) };
  if (c === 'B') return { art: 'knopf', x: f.x, y: f.y };
  if (c === 'P') return { art: 'tafel', x: f.x, y: f.y, text: e.tafeln[key] || [] };
  if ('12345'.includes(c)) return { art: 'rune', x: f.x, y: f.y, rune: e.runen[c] };
  if (c === 'D') return { art: 'tuer', x: f.x, y: f.y, offen: istOffen(s, f.x, f.y) };
  if (c === 'G') return { art: 'gitter', x: f.x, y: f.y, offen: istOffen(s, f.x, f.y) };
  if (c === 'Q') return { art: 'runentor', x: f.x, y: f.y, offen: istOffen(s, f.x, f.y) };
  if (c === 'F') return { art: 'fassung', x: f.x, y: f.y, voll: s.fassungenVoll.includes(key) };
  if (c === 'E') return { art: 'quelle', x: f.x, y: f.y };
  if (c === 'Z' || c === 'Y') return { art: 'ziel', x: f.x, y: f.y, an: s.zieleAn.includes(key) };
  if (c === 'M') return { art: 'erinnerung', x: f.x, y: f.y, ...e.erinnerungen[key] };
  if (c === 'K') return { art: 'spore', x: f.x, y: f.y, an: s.sporenAn.includes(key) };
  if (c === 'W') return istOffen(s, f.x, f.y) ? null : { art: 'wurzeln', x: f.x, y: f.y };
  if (c === 'X' && !istOffen(s, f.x, f.y)) return { art: 'wand', x: f.x, y: f.y };
  if (c === '#') return { art: 'wand', x: f.x, y: f.y };
  return null;
}

// Hebel umlegen: öffnet das zugehörige Gitter (und schließt es wieder beim Zurücklegen)
export function hebelUmlegen(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'hebel') return null;
  const key = `${w.x},${w.y}`;
  const ziel = etageVon(s).hebel[key];
  if (s.hebelUnten.includes(key)) {
    s.hebelUnten = s.hebelUnten.filter(k => k !== key);
    s.offen = s.offen.filter(k => k !== ziel);
    return { unten: false, ziel };
  }
  s.hebelUnten.push(key);
  if (!s.offen.includes(ziel)) s.offen.push(ziel);
  return { unten: true, ziel };
}

// Versteckter Knopf: öffnet die Geheimwand für immer
export function knopfDruecken(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'knopf') return null;
  const key = `${w.x},${w.y}`;
  const ziel = etageVon(s).knoepfe[key];
  if (ziel && typeof ziel === 'object') {
    // Fach hinter dem Stein: einmal je Durchgang; schon gefundene Geheimnisse geben nichts mehr
    if (s.gedrueckt.includes(key) || gefundenIn(s, s.etage).includes(ziel.geheimnis)) {
      if (!s.gedrueckt.includes(key)) s.gedrueckt.push(key);
      return { fach: true, leer: true };
    }
    if (inDenBeutel(ziel.gibt) && s.beutel.length >= A.BEUTEL_PLAETZE) return { fach: true, gibt: ziel.gibt, voll: true };
    s.gedrueckt.push(key);
    if (inDenBeutel(ziel.gibt)) A.aufnehmen(s, ziel.gibt);
    else s.taschen[ziel.gibt] = (s.taschen[ziel.gibt] || 0) + 1;
    return { fach: true, gibt: ziel.gibt, geheimnis: geheimnisMerken(s, ziel.geheimnis) };
  }
  const neu = !s.offen.includes(ziel);
  if (neu) s.offen.push(ziel);
  return { ziel, neu };
}

// Schlüssel ins Schloss: Tür geht auf, der Schlüssel bleibt stecken
export function tuerAufschliessen(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'tuer' || w.offen) return null;
  if (!s.taschen.schluessel) return { ok: false, grund: 'kein_schluessel' };
  s.taschen.schluessel--;
  s.offen.push(`${w.x},${w.y}`);
  return { ok: true };
}

// Rune berühren. Richtige Reihenfolge öffnet das Runentor. Falsche Rune: alles von vorn.
export function runeBeruehren(s) {
  const w = wandVorn(s);
  if (!w || w.art !== 'rune') return null;
  const folge = etageVon(s).runenFolge;
  const tor = torPosition(s);
  if (tor && istOffen(s, tor.x, tor.y)) return { schon: true };
  if (etageVon(s).runenErstNachKetten) {
    if (s.ende) return { schon: true };
    if (s.phase !== 'runen') return { gesperrt: true };
  }
  if (s.runen.includes(w.rune)) return { doppelt: true, runen: [...s.runen] };
  const soll = folge[s.runen.length];
  if (w.rune !== soll) { s.runen = []; return { falsch: true }; }
  s.runen.push(w.rune);
  if (s.runen.length === folge.length) {
    if (tor) s.offen.push(`${tor.x},${tor.y}`);
    if (etageVon(s).runenErstNachKetten) { s.ende = true; s.phase = 'frei'; etageGeschafft(s); return { offen: true, ende: true }; }
    return { offen: true };
  }
  return { richtig: true, runen: [...s.runen], vorLetzter: s.runen.length === folge.length - 1 };
}
function torPosition(s) {
  const k = etageVon(s).karte;
  for (let y = 0; y < k.length; y++) { const x = k[y].indexOf('Q'); if (x >= 0) return { x, y }; }
  return null;
}

// Dinge aufheben (auf dem eigenen Feld oder dem Feld davor)
export function aufheben(s, id) {
  const d = s.dinge.find(x => x.id === id);
  if (!d) return null;
  const vorn = feldRelativ(s, 1, 0);
  const nah = (d.x === s.x && d.y === s.y) || (d.x === vorn.x && d.y === vorn.y && begehbar(s, vorn.x, vorn.y));
  if (!nah) return null;
  if (inDenBeutel(d.typ) && s.beutel.length >= A.BEUTEL_PLAETZE) return { typ: d.typ, voll: true };
  s.dinge = s.dinge.filter(x => x.id !== id);
  const ev = { typ: d.typ };
  if (inDenBeutel(d.typ)) { ev.beutel = A.aufnehmen(s, d.typ).id; ev.besser = besserFuer(s, d.typ); }
  else if (d.typ === 'notiz') {
    if (!s.notizen.includes(d.notiz)) s.notizen.push(d.notiz);
    ev.notiz = d.notiz;
  } else s.taschen[d.typ] = (s.taschen[d.typ] || 0) + 1;
  if (d.geheimnis) ev.geheimnis = geheimnisMerken(s, d.geheimnis);
  if (!ev.geheimnis) ev.geheimnis = geheimnisseNachNotiz(s);
  return ev;
}

// Trank trinken (auch im Kampf, zählt nicht als Handlung)
export function trankTrinken(s, heldId, typ = 'heiltrank') {
  const d = s.beutel.find(x => x.typ === typ);
  if (!d) return null;
  const r = A.benutzen(s, heldId, d.id);
  if (!r.ok) return null;
  return { plus: r.leben || 0, mana: r.mana || 0 };
}
export const anzahlImBeutel = (s, typ) => s.beutel.filter(d => d.typ === typ).length;

// Für wen wäre ein Teil besser? (Summe der Werte steigt) – für den Hinweis „besser“
export function besserFuer(s, typ) {
  const wer = [];
  for (const h of s.helden) {
    const v = A.vergleich(h, typ);
    if (!v) continue;
    const plus = A.WERTE.reduce((n, w) => n + v.werte[w].nachher - v.werte[w].vorher, 0);
    if (plus > 0) wer.push(h.id);
  }
  return wer;
}
// Ausrüstung ändern (außerhalb des Kampfs); Leben und Mana passen sich an
export function anlegen(s, heldId, dingId) {
  if (s.kampf) return { ok: false, grund: 'kampf' };
  const r = A.anlegen(s, heldId, dingId);
  s.helden.forEach(auffrischen);
  return r;
}
export function ablegen(s, heldId, platz) {
  if (s.kampf) return { ok: false, grund: 'kampf' };
  const r = A.ablegen(s, heldId, platz);
  s.helden.forEach(auffrischen);
  return r;
}
export function punktSetzen(s, heldId, wert) {
  const h = s.helden.find(x => x.id === heldId);
  if (!h || !A.punktSetzen(h, wert)) return false;
  auffrischen(h);   // A.punktSetzen füllt Leben und Mana schon mit auf
  return true;
}

// ---------- Gegner ----------
// Gegner, die die Gruppe sehen (höchstens 4 Felder Weg), kommen nach jedem Schritt ein Feld näher.
export function gegnerZiehen(s) {
  const bewegt = [];
  for (const g of s.gegner) {
    if (g.leben <= 0 || g.lauert || g.steht) continue;
    const weg = wegZur(s, g);
    if (weg && weg.length >= 2 && weg.length - 1 <= (g.wach || 4)) {
      const [nx, ny] = weg[1];
      if (nx === s.x && ny === s.y) continue; // schon daneben
      if (gegnerAuf(s, nx, ny)) continue;
      g.x = nx; g.y = ny;
      bewegt.push(g.id);
    }
  }
  return bewegt;
}
// Kürzester Weg vom Gegner zur Gruppe (Liste von Feldern), höchstens 6 Schritte
function wegZur(s, g) {
  const ziel = `${s.x},${s.y}`;
  const start = `${g.x},${g.y}`;
  const vorher = new Map([[start, null]]);
  let rand = [[g.x, g.y]];
  for (let tiefe = 0; tiefe < 6 && rand.length; tiefe++) {
    const neu = [];
    for (const [x, y] of rand) {
      for (const [dx, dy] of RICHTUNGEN) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (vorher.has(k) || !begehbar(s, nx, ny)) continue;
        vorher.set(k, `${x},${y}`);
        if (k === ziel) {
          const pfad = [];
          for (let p = k; p; p = vorher.get(p)) pfad.unshift(p.split(',').map(Number));
          return pfad;
        }
        neu.push([nx, ny]);
      }
    }
    rand = neu;
  }
  return null;
}

// Steht ein Gegner direkt neben der Gruppe? Dann beginnt der Kampf, die Gruppe dreht sich zu ihm.
export function kampfPruefen(s) {
  if (s.kampf) return s.kampf;
  for (let r = 0; r < 4; r++) {
    const [dx, dy] = RICHTUNGEN[r];
    const g = gegnerAuf(s, s.x + dx, s.y + dy);
    if (g && !g.lauert) {
      s.r = r;
      s.kampf = { gegner: g.id, runde: 1, getan: {} };
      return s.kampf;
    }
  }
  return null;
}

const wurf = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));
export const lebende = (s) => s.helden.filter(h => h.leben > 0);

// Aktion eines Helden: 'schlag' (Rana), 'funke' (Ilo, 4 Mana), 'heilen' (Ilo, 3 Mana, Ziel: Held)
// Haben alle lebenden Helden gehandelt, schlägt der Gegner zurück und eine neue Runde beginnt.
export function heldHandelt(s, heldId, aktion, rnd = Math.random, ziel = null) {
  const k = s.kampf;
  if (!k) return null;
  const h = s.helden.find(x => x.id === heldId);
  const g = s.gegner.find(x => x.id === k.gegner);
  if (!h || h.leben <= 0 || k.getan[heldId] || !g) return null;
  const ev = { held: heldId, aktion };
  const kw = A.kampfwerte(h);
  if (aktion === 'schlag') {
    ev.schaden = wurf(rnd, kw.schlag);
    g.leben = Math.max(0, g.leben - ev.schaden);
  } else if (aktion === 'funke') {
    if (h.id !== 'ilo' || h.mana < 4) return null;
    h.mana -= 4;
    ev.schaden = wurf(rnd, kw.funke);
    g.leben = Math.max(0, g.leben - ev.schaden);
  } else if (aktion === 'heilen') {
    if (h.id !== 'ilo' || h.mana < 3) return null;
    const z = s.helden.find(x => x.id === (ziel || heldId));
    if (!z || z.leben <= 0) return null;
    h.mana -= 3;
    const vorher = z.leben;
    z.leben = Math.min(z.max, z.leben + kw.heilen);
    ev.geheilt = z.leben - vorher; ev.ziel = z.id;
  } else if (aktion === 'faehigkeit') {
    // Kristall: einmal je Kampf und Held
    const f = kw.faehigkeit;
    k.genutzt = k.genutzt || {};
    if (!f || k.genutzt[heldId]) return null;
    k.genutzt[heldId] = true;
    ev.faehigkeit = f;
    if (f === 'glut') { ev.schaden = wurf(rnd, kw.schlag) + 6; g.leben = Math.max(0, g.leben - ev.schaden); }
    else if (f === 'frost') k.frost = true;
    else if (f === 'schild') k.schild = true;
    else if (f === 'licht') { ev.licht = {}; for (const x of lebende(s)) { const v = x.leben; x.leben = Math.min(x.max, x.leben + 8); ev.licht[x.id] = x.leben - v; } }
  } else return null;
  k.getan[heldId] = true;
  if (g.leben <= 0) { ev.sieg = siegen(s, g); return ev; }
  if (lebende(s).every(x => k.getan[x.id])) {
    const kael = kaelHilft(s, g, rnd);
    if (kael) { ev.kael = kael; if (g.leben <= 0) { ev.sieg = siegen(s, g); return ev; } }
    ev.gegenzug = gegnerSchlaegt(s, rnd);
  }
  return ev;
}

// Abwarten: wer noch nicht gehandelt hat, setzt aus (Ilo sammelt dabei 2 Mana)
export function abwarten(s, rnd = Math.random) {
  const k = s.kampf;
  if (!k) return null;
  for (const h of lebende(s)) {
    if (!k.getan[h.id] && h.mana !== undefined) h.mana = Math.min(h.manaMax, h.mana + 2);
    k.getan[h.id] = true;
  }
  const g = s.gegner.find(x => x.id === k.gegner);
  const kael = kaelHilft(s, g, rnd);
  if (kael && g.leben <= 0) return { kael, sieg: siegen(s, g) };
  return { kael, gegenzug: gegnerSchlaegt(s, rnd) };
}

function gegnerSchlaegt(s, rnd) {
  const k = s.kampf;
  const g = s.gegner.find(x => x.id === k.gegner);
  k.runde++;
  k.getan = {};
  // Frostsplitter: Der Gegner setzt einmal aus
  if (k.frost) { k.frost = false; return { ziel: null, schaden: 0, frost: true }; }
  const ziele = lebende(s);
  const z = ziele[Math.floor(rnd() * ziele.length)];
  // Schutz fängt etwas ab (mindestens 1 Schaden bleibt); Kristallschild fängt einen Treffer ganz ab
  let schaden = Math.max(1, wurf(rnd, GEGNER[g.typ].schaden) - A.kampfwerte(z).abwehr);
  const ev = { ziel: z.id, schaden };
  if (k.schild) { k.schild = false; schaden = 0; ev.schaden = 0; ev.schild = true; }
  z.leben = Math.max(0, z.leben - schaden);
  if (!lebende(s).length) ev.besiegt = gruppeBesiegt(s);
  return ev;
}

function siegen(s, g) {
  s.kampf = null;
  const xp = GEGNER[g.typ].erfahrung;
  const auf = [];
  const stufeMax = etageVon(s).stufeMax || 99;
  for (const h of lebende(s)) {
    // Höchststufe je Etage: Wiederholen lohnt sich für Geheimnisse, nicht zum endlosen Aufsteigen
    h.erfahrung = h.stufe >= stufeMax ? Math.min(h.erfahrung + xp, h.stufe * 10 - 1) : h.erfahrung + xp;
    while (h.stufe < stufeMax && h.erfahrung >= h.stufe * 10) {
      h.erfahrung -= h.stufe * 10;
      h.stufe++; h.punkte = (h.punkte || 0) + 1;   // ein Punkt zum Verteilen
      auffrischen(h);
      h.leben = h.max;
      if (h.id === 'ilo') h.mana = h.manaMax;
      auf.push(h.id);
    }
  }
  // Ilo bekommt nach jedem Kampf etwas Mana zurück
  const ilo = s.helden.find(h => h.id === 'ilo');
  if (ilo && ilo.leben > 0) ilo.mana = Math.min(ilo.manaMax, ilo.mana + 4);
  const ev = { gegner: g.typ, erfahrung: xp, stufeAuf: auf };
  if (g.typ === 'ritter') { s.kael = 'befreit'; ev.kael = 'befreit'; }
  if (g.typ === 'herz') {
    // Die Ringe sind zerschlagen. Vier Splitter fallen zu Boden: damit lassen sich die Ketten lösen.
    s.phase = 'ketten'; ev.herz = true;
    for (const [x, y] of [[7, 10], [9, 10], [7, 12], [9, 12]]) s.dinge.push({ x, y, typ: 'leitkristall', id: 3000 + x * 20 + y });
  }
  // Nach dem Wächter: der Hohle Ritter kniet nieder und legt das Amulett hin (falls es noch fehlt)
  const nw = etageVon(s).nachWaechter;
  if (nw && nw.typ === g.typ) {
    ev.knien = { amulettNeu: false };
    if (!besitzt(s, nw.gibt)) {
      if (s.beutel.length < A.BEUTEL_PLAETZE) A.aufnehmen(s, nw.gibt);
      else s.dinge.push({ x: s.x, y: s.y, typ: nw.gibt, id: 2000 });
      ev.knien.amulettNeu = true;
    }
  }
  return ev;
}

// Alle Helden am Boden: Die Gruppe wacht am Eingang der Etage wieder auf. Nichts geht verloren,
// besiegte Gegner bleiben besiegt, der Gegner aus dem Kampf ist wieder ganz gesund.
function gruppeBesiegt(s) {
  const e = etageVon(s);
  const g = s.gegner.find(x => x.id === s.kampf.gegner);
  if (g) g.leben = GEGNER[g.typ].leben;
  s.kampf = null;
  s.x = e.start.x; s.y = e.start.y; s.r = e.start.r;
  for (const h of s.helden) { h.leben = h.max; if (h.manaMax !== undefined) h.mana = h.manaMax; }
  s.besiegt++;
  return true;
}

// Stand prüfen (nach dem Laden): fehlende Felder ergänzen
export function standPruefen(st) {
  if (!st || typeof st !== 'object' || !ETAGEN[st.etage]) return null;
  const neu = neuesSpiel(st.etage);
  const s = { ...neu, ...st, taschen: { ...neu.taschen, ...(st.taschen || {}) }, gefunden: { ...(st.gefunden || {}) } };
  // Ältere Stände ohne Ausrüstung: neue Helden auf derselben Stufe, Tränke in den Beutel
  if (!Array.isArray(st.helden) || !st.helden.every(h => h.ausruestung)) {
    s.helden = neueHelden().map(h => {
      const alt = (st.helden || []).find(x => x.id === h.id);
      if (alt && alt.stufe > 1) { h.stufe = alt.stufe; h.punkte = alt.stufe - 1; auffrischen(h); h.leben = h.max; if (h.id === 'ilo') h.mana = h.manaMax; }
      return h;
    });
  }
  if (!Array.isArray(st.beutel)) {
    s.beutel = [];
    for (let i = 0; i < Math.min(8, (st.taschen && st.taschen.trank) || 0); i++) s.beutel.push(A.ding('heiltrank'));
  }
  delete s.taschen.trank;
  return s;
}
