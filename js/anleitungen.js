// Kurze Anleitungen („So geht's“) für alle Spiele: Seiten mit Bild und kurzen Sätzen.
// Die Bilder entstehen aus den echten Spielteilen (spielbilder.js), damit sie immer zum aktuellen Aussehen passen.
// `bild` wird erst beim Anzeigen gebaut (Getter), ohne DOM beim Laden (testbar mit node).
import { BILDER } from './spielbilder.js';

const TEXTE = {
  '2048': { titel: '2048', seiten: [
    ['Wische nach links, rechts, oben oder unten.', 'Alle Steine rutschen in diese Richtung.'],
    ['Zwei gleiche Steine stoßen zusammen.', 'Dann verschmelzen sie: 2 und 2 werden 4, 4 und 4 werden 8.'],
    ['Baue einen möglichst großen Stein.', 'Geht nichts mehr, beginnst du neu. Deine Spielzeit bleibt.']
  ] },
  runenfeld: { titel: 'Runenfeld', seiten: [
    ['Ziehe eine Form von unten aufs Feld.', 'Lass sie dort los, wo Platz ist.'],
    ['Eine volle Reihe oder Spalte verschwindet.', 'Das gibt Punkte. Mehrere auf einmal geben mehr.'],
    ['Passt keine Form mehr, ist das Spiel vorbei.', 'Tipp: Lass Platz für große Formen.']
  ] },
  kristallmine: { titel: 'Kristallmine', seiten: [
    ['Halte den Finger auf das Feld und ziehe in eine Richtung.', 'Die Figur gräbt sich durch die Erde.'],
    ['Sammle genug Kristalle.', 'Dann öffnet sich der Ausgang. Lauf hinein!'],
    ['Steine und Kristalle fallen, wenn darunter frei ist.', 'Lauf nicht direkt unter einen fallenden Stein.'],
    ['Ab Höhle 6 gibt es Gegner: Glühwürmer und Schmetterlinge.', 'Berühre sie nicht. Ein Stein auf einem Schmetterling macht Kristalle.']
  ] },
  steinschieber: { titel: 'Steinschieber', seiten: [
    ['Schiebe jeden Runenstein auf ein leuchtendes Feld.', 'Wische oder tippe ein Feld an, um zu laufen.'],
    ['Du kannst Steine nur schieben, nicht ziehen.', 'Zwei Steine hintereinander sind zu schwer.'],
    ['Ein Stein in der Ecke steckt fest.', 'Dann hilft „Zurück“. „Tipp“ zeigt dir den nächsten Schub.']
  ] },
  runenfall: { titel: 'Runenfall', seiten: [
    ['Runensteine fallen von oben herunter.', 'Tippe aufs Feld zum Drehen. Ziehe seitlich zum Schieben.'],
    ['Fülle eine ganze Reihe ohne Lücke.', 'Dann verschwindet sie und du bekommst Punkte.'],
    ['Schnell nach unten wischen: Der Stein fällt sofort.', 'Der Schatten zeigt, wo er landet. „Pause“ geht immer.']
  ] },
  runenreihen: { titel: 'Runenreihen', seiten: [
    ['Tausche zwei Nachbarn.', 'Wische über einen Stein oder tippe beide nacheinander an.'],
    ['Drei gleiche in einer Reihe verschwinden.', 'Neue Steine fallen von oben nach.'],
    ['Vier in einer Reihe machen eine Funkenrune.', 'Fünf machen eine Sternrune. Beide räumen viel ab.'],
    ['Jede Stufe hat ein Ziel: Punkte oder eine kleine Aufgabe.', 'Zum Beispiel: Räume 14 Rubine ab. Das Ziel steht über dem Feld.'],
    ['Ab Stufe 3 hält ein Runenbann manche Steine fest.', 'Räume direkt daneben etwas ab. Dann ist der Stein frei.'],
    ['Ab Stufe 4 kommt der Mondstein dazu.', 'Es gibt keine Zeit und keine Zuggrenze.']
  ] },
  hoehlenkarte: { titel: 'Höhlenkarte', seiten: [
    ['Unter manchen Steinen sind Fallen versteckt.', 'Decke alle Felder ohne Falle auf. Das erste Feld ist immer sicher.'],
    ['Eine Zahl sagt: So viele Fallen liegen direkt um dieses Feld.', 'Alle 8 Nachbarn zählen mit, auch schräg.'],
    ['Beispiel: Die 1 hat nur noch einen verdeckten Nachbarn.', 'Also ist genau dort die Falle.'],
    ['Markiere die Falle mit einem Kristall.', 'Knopf „Markieren“ antippen oder lange auf das Feld drücken.'],
    ['Die Einsen links haben ihre Falle schon: den Kristall.', 'Ihre anderen Nachbarn sind sicher. Du kannst sie aufdecken.'],
    ['Sind um eine Zahl alle Fallen markiert, tippe die Zahl an.', 'Dann öffnen sich die übrigen Nachbarn von selbst.'],
    ['Unsicher? „Tipp“ öffnet ein sicheres Feld.', 'Nach einer Falle kannst du zurücknehmen. Sie bleibt dann markiert.']
  ] },
  runenbrecher: { titel: 'Runenbrecher', seiten: [
    ['Ziehe den Finger unten hin und her.', 'Der goldene Schild folgt deinem Finger.'],
    ['Tippe aufs Feld. Dann fliegt die Kugel los.', 'Fang sie mit dem Schild wieder auf.'],
    ['Triff alle Steine. Violette brauchen zwei Treffer.', 'Gold gibt mehr Punkte. Graue feste Steine bleiben stehen.'],
    ['Manchmal fallen Zeichen herunter. Fang sie!', 'Sie machen den Schild breiter, die Kugel langsamer oder geben eine zweite Kugel.']
  ] },
  jadeschlange: { titel: 'Jadeschlange', seiten: [
    ['Wische in eine Richtung.', 'Die Schlange biegt dorthin ab.'],
    ['Sammle Kristalle. Die Schlange wird länger.', 'Goldene Kristalle geben mehr Punkte.'],
    ['Am Rand ist ein Tor.', 'Die Schlange kommt auf der anderen Seite wieder heraus.'],
    ['Beiß dich nicht selbst. Dann ist die Runde vorbei.', 'Steine im Weg kosten zwei Glieder.']
  ] }
};

export const ANLEITUNGEN = Object.fromEntries(Object.entries(TEXTE).map(([id, a]) => [id, {
  titel: a.titel,
  seiten: a.seiten.map((text, k) => ({ text, get bild() { const f = BILDER[id] && BILDER[id][k]; return f ? f() : ''; } }))
}]));

export const hatAnleitung = (id) => !!ANLEITUNGEN[id];
