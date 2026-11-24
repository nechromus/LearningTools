// Anzeigenamen, gemeinsam für Übungs-App und Eltern-App.

export const THEMA_NAMEN = {
  'minus-zahlen': 'Minus-Zahlen', 'reihenfolge': 'Reihenfolge', 'potenzen': 'Potenzen',
  'bruch-bild': 'Bruch aus Bild', 'zuordnung': 'Zuordnung', 'prozent': 'Prozent von …',
  'prozent-baukasten': 'Prozent-Baukasten', 'prozent-formel': 'Prozent mit Formel', 'rabatt': 'Rabatt', 'neuer-preis': 'Neuer Preis',
  'kreisdiagramm': 'Kreisdiagramm', 'runden': 'Runden', 'kugel': 'Kugel',
  'einmaleins': 'Einmaleins', 'mal-10': 'Mal 10 und durch 10',
  'zylinder': 'Zylinder', 'kegel': 'Kegel', 'pyramide': 'Pyramide', 'quader': 'Quader', 'zusammengesetzt': 'Quader mit ausgeschnittenem Kegel', 'daten': 'Daten (Minimum, Maximum, Spannweite)', 'diagramm': 'Säulendiagramm', 'kosinus': 'Kosinus', 'sinus': 'Sinus', 'tangens': 'Tangens', 'trig-mix': 'sin, cos, tan gemischt', 'trig-weg': 'sin, cos, tan: Lösungsweg', 'quadr-funktionen': 'Quadratische Funktionen', 'quadr-gleichungen': 'Quadratische Gleichungen',
  'zehnerpotenzen': 'Zehnerpotenzen', 'einheiten': 'Einheiten', 'gewichtskraft': 'Masse und Gewichtskraft', 'umstellen': 'Gleichungen umstellen', 'dichte': 'Dichte',
  'formelsammlung': 'Formelsammlung: Finde es'
};

export const GEN_NAMEN = {
  'minus-plus': 'Minus-Zahlen', 'reihenfolge': 'Reihenfolge', 'potenz': 'Potenzen', 'einmaleins': 'Einmaleins',
  'mal10': 'Mal 10 / durch 10', 'prozent': 'Prozent von …', 'baukasten': 'Prozent-Baukasten', 'runden': 'Runden',
  'bruch-bild': 'Bruch aus Bild', 'kugel': 'Kugel', 'zylinder': 'Zylinder', 'geld-geschichte': 'Geld-Geschichten', 'rabatt-geschichte': 'Rabatt-Geschichten', 'prozent-formel': 'Prozent mit Formel', 'kegel': 'Kegel', 'pyramide': 'Pyramide', 'quader': 'Quader', 'zusammengesetzt': 'Quader − Kegel', 'kreisdiagramm': 'Kreisdiagramm',
  'zehnerpotenz': 'Zehnerpotenzen', 'einheiten': 'Einheiten', 'gewichtskraft': 'Gewichtskraft', 'gleichung': 'Gleichungen', 'formel-umstellen': 'Formeln umstellen', 'dichte': 'Dichte', 'daten': 'Daten (Tabelle)', 'saeulen': 'Säulendiagramm', 'kosinus': 'Kosinus', 'sinus': 'Sinus', 'tangens': 'Tangens', 'trig-weg': 'sin, cos, tan: Lösungsweg', 'trig-mix': 'sin, cos, tan gemischt', 'parabel': 'Parabeln', 'qgleichung': 'Quadratische Gleichungen'
};

export const FEHLER_NAMEN = {
  'vorzeichen': 'Vorzeichen falsch (Geld/Schulden)', 'potenz-mal': 'Potenz als „mal“ gerechnet',
  'kugel-d-statt-r': 'Kugel: d statt r', 'kugel-ohne-4-3': 'Kugel: 4 ÷ 3 vergessen',
  'rabatt-ersparnis': 'Ersparnis statt neuer Preis', 'runden': 'Falsch gerundet', 'bruch-vertauscht': 'Bruch vertauscht',
  'merk': 'Wert im Text nicht gefunden (Merkzettel)',
  'formel-ohne-100': 'Prozent-Formel: nicht durch 100 geteilt', 'formel-g-p-vertauscht': 'Prozent-Formel: G und p vertauscht', 'formel-rabatt-statt-preis': 'Rabatt statt neuer Preis', 'formel-1prozent-statt-g': 'Prozent-Formel: 1 % statt G beim neuen Preis', 'formel-preis-negativ': 'Preis kleiner als 0', 'kegel-drittel-vergessen': 'Kegel: Drittel vergessen', 'zylinder-gesucht': 'Zylinder: falsch gewählt, was gesucht ist',
  'potenz-zweimal': 'Hoch 3: nur zweimal malgenommen', 'd-statt-r': 'Zylinder/Kegel: d statt r',
  'abgeschnitten': 'Abgeschnitten statt gerundet', 'kreis-prozent-statt-anzahl': 'Kreisdiagramm: Prozent statt Anzahl', 'mal10-nicht-verschoben': 'Mal 10: Komma nicht verschoben', 'mal10-falsche-richtung': 'Mal 10: falsche Richtung', 'mal10-stellen': 'Mal 10: Komma zu weit', 'mal10-ziffer-weg': 'Mal 10: Ziffer weg oder gerundet', 'einmaleins-geteilt': 'Einmaleins: geteilt', 'zylinder-ein-kreis': 'Zylinder: nur ein Kreis', 'drittel-vergessen': 'Kegel/Pyramide: Drittel vergessen',
  'pyramide-hs-statt-h': 'Pyramide: hₛ statt h', 'pyramide-h-statt-hs': 'Pyramide: h statt hₛ',
  'pyramide-ein-dreieck': 'Pyramide: nur 1 Dreieck', 'zusammen-statt-abziehen': 'Zusammengezählt statt abgezogen', 'zerlegen': 'Körper falsch zerlegt', 'kegel-hoehe-bild': 'Kegelhöhe im Bild nicht erkannt', 'kegel-breite-bild': 'Größter Kegel: Breite nicht erkannt', 'nachgerundet': 'Gerundete Zahl noch einmal gerundet', 'kegel-h-statt-s': 'Kegel: h statt s', 'kegel-zwei-kreise': 'Kegel: zwei Kreise',
  'zp-form': 'Zehnerpotenz: Zahl nicht zwischen 1 und 10', 'zp-vorzeichen': 'Zehnerpotenz: Hochzahl mit falschem Vorzeichen', 'zp-hochzahl': 'Zehnerpotenz: Hochzahl falsch',
  'formel-kehrwert': 'Formel: Kehrwert', 'formel-links': 'Formel: links nicht die gesuchte Größe', 'formel-ziel-rechts': 'Formel: gesuchte Größe rechts', 'formel': 'Formel falsch umgestellt',
  'knobel': 'Knobeln: Ergebnis falsch',
  // Genauer eingeordnet (14.11., nur Protokoll)
  'runden-zu-frueh': 'Runden: auf zu wenige Stellen', 'runden-als-ziffer': 'Runden: „eine Stelle“ als Ziffer 1 geschrieben', 'runden-hochgezaehlt': 'Runden: letzte Ziffer um eins verändert',
  'runden-auf-statt-ab': 'Runden: aufgerundet statt abgerundet', 'runden-ab-statt-auf': 'Runden: abgerundet statt aufgerundet', 'runden-null': 'Runden: Null nach dem Komma übersprungen',
  'runden-nicht-gerundet': 'Runden: nicht gerundet (abgeschrieben)', 'runden-uebertrag': 'Runden: aus 9 wird 0, Stelle davor nicht erhöht',
  'tastenmuster': 'Tastenmuster (eher durchgeklickt)', 'komma-verschoben': 'Komma verschoben (×/÷ 10, 100, 1000)', 'anderer-teil': 'Ergebnis eines anderen Felds',
  'um-eins': 'Um 1 daneben', 'knapp': 'Knapp daneben (unter 1 %)', 'zahlendreher': 'Zahlendreher',
  'einmaleins-nachbar': 'Einmaleins: Nachbaraufgabe', 'einmaleins-reihe': 'Einmaleins: andere Zahl aus der Reihe', 'potenz-nachbarbasis': 'Potenz: Nachbarzahl gerechnet',
  // 24.11.: Quadratische Funktionen und Gleichungen
  'scheitel-vorzeichen': 'Scheitel: Vorzeichen in der Klammer nicht gedreht', 'scheitel-y-vorzeichen': 'Scheitel: y-Wert mit falschem Vorzeichen', 'scheitel-x-y-vertauscht': 'Scheitel: x und y vertauscht',
  'parabel-oeffnung': 'Parabel: nach oben/unten verwechselt', 'parabel-breite': 'Parabel: schmaler/breiter verwechselt', 'quadrat-minus': 'Quadrat einer Minus-Zahl negativ',
  'binom-2ab': 'Binomische Formel: Mittelglied ohne 2', 'binom-vorzeichen': 'Binomische Formel: Vorzeichen Mittelglied', 'binom-quadrat-vergessen': 'Binomische Formel: d² vergessen',
  'ergaenzung-plus': 'Quadratische Ergänzung: addiert statt abgezogen', 'ergaenzung-vergessen': 'Quadratische Ergänzung: nicht abgezogen', 'aufstellen-e': 'a bestimmen: e nicht auf die andere Seite', 'a-kehrwert': 'a bestimmen: Kehrwert',
  'scheitel-nullstelle': 'Scheitel und Nullstelle verwechselt', 'nur-positive': 'Nur die positive Lösung', 'quadrat-negativ': 'x² negativ: keine Lösung übersehen', 'null-verloren': 'Durch x geteilt, Lösung 0 verloren',
  'nullprodukt-vorzeichen': 'Nullprodukt: Vorzeichen nicht gedreht', 'pq-vorzeichen-p': 'pq-Formel: Vorzeichen von p', 'pq-vorzeichen-q': 'pq-Formel: Vorzeichen von q', 'pq-q-vorzeichen': 'pq-Formel: unter der Wurzel + q statt − q',
  'pq-halbe-vergessen': 'pq-Formel: p nicht halbiert', 'diskriminante': 'Anzahl der Lösungen falsch', 'normalform-nicht-geteilt': 'Normalform: nicht durch a geteilt', 'normalform-nur-teil': 'Normalform: nur ein Teil geteilt',
  'vieta-vorzeichen': 'Vieta: Summe ist −p', 'vieta-summe': 'Vieta: Produkt passt, Summe nicht', 'sache-gleichung': 'Textaufgabe: Gleichung falsch aufgestellt',
  // Auftrag 54
  'spannweite-max': 'Spannweite: nur das Maximum', 'spannweite-summe': 'Spannweite: Maximum + Minimum', 'spannweite-minusminus': 'Spannweite: Minus minus nicht plus',
  'daten-erster-letzter': 'Daten: erster/letzter Wert statt Min./Max.', 'daten-min-ohne-minus': 'Daten: Minimum ohne Minus',
  'diagramm-nachbar': 'Diagramm: Säule daneben abgelesen', 'diagramm-strich': 'Diagramm: um eine Linie daneben', 'diagramm-summe-statt-unterschied': 'Diagramm: addiert statt abgezogen',
  'saeule-hoehe': 'Säule falsch hoch', 'achse-beschriftung': 'Achse falsch beschriftet',
  'formel-p-mal-statt-geteilt': 'p gesucht: mal statt geteilt', 'formel-p-w-durch-g': 'p gesucht: W : G ohne · 100', 'formel-g-ist-1prozent': 'G gesucht: 1 % als Ergebnis', 'formel-g-w-mal-p': 'G gesucht: W · p statt W : p', 'formel-gesucht': 'Prozent: falsch gewählt, was gesucht ist',
  // Auftrag 55
  'cos-hypotenuse': 'Kosinus: falsche Seite als Hypotenuse', 'cos-gegenkathete': 'Kosinus: Gegenkathete statt Ankathete', 'cos-kehrwert': 'Kosinus: Hypotenuse : Ankathete',
  'cos-wert-statt-winkel': 'Kosinus: cos-Wert statt Winkel', 'cos-statt-umkehr': 'Kosinus: cos statt 2nd cos', 'cos-rad': 'Kosinus: Rechner nicht in Grad', 'cos-vom-bruch': 'Kosinus: cos von Ankathete ÷ Hypotenuse gerechnet',
  'sin-ankathete': 'Sinus: Ankathete statt Gegenkathete', 'sin-hypotenuse': 'Sinus: falsche Seite als Hypotenuse', 'sin-kehrwert': 'Sinus: Hypotenuse : Gegenkathete',
  'tan-hypotenuse': 'Tangens: Hypotenuse statt Kathete', 'tan-kehrwert': 'Tangens: Ankathete : Gegenkathete', 'trig-falsche-funktion': 'sin, cos, tan verwechselt',
  'sin-statt-umkehr': 'Sinus: sin statt 2nd sin', 'tan-statt-umkehr': 'Tangens: tan statt 2nd tan', 'trig-abgeschnitten': 'Abgeschnitten statt gerundet',
  'trig-seite-geteilt': 'Seite: geteilt statt mal', 'trig-unten-mal': 'x unten: mal statt geteilt', 'trig-vom-bruch': 'sin/tan vom Bruch gerechnet', 'trig-wert-statt-winkel': 'sin/tan-Wert statt Winkel', 'trig-rad': 'Rechner nicht in Grad',
  'trig-gesucht': 'Winkel oder Seite verwechselt', 'trig-taste-umkehr': '2nd, obwohl eine Seite gesucht ist', 'trig-taste-ohne-2nd': 'ohne 2nd, obwohl der Winkel gesucht ist', 'trig-erst-funktion': 'Funktion vor dem Teilen gedrückt', 'weg-name': 'Lösungsweg: Funktion vor dem Ergebnis', 'weg-anderer-winkel': 'Lösungsweg: der andere Winkel', 'weg-runden': 'Lösungsweg: falsch gerundet', 'weg-etappe': 'Lösungsweg: falsche Zeile an dieser Stelle', 'weg-kein-schritt': 'Lösungsweg: wahr, aber kein Schritt', 'weg-ergebnis-ohne-weg': 'Lösungsweg: Ergebnis ohne Weg', 'weg-ruecksprung': 'Lösungsweg: Schritt zurück', 'weg-falsch': 'Lösungsweg: Zeile stimmt nicht',
  'zylinder-hoehe-vergessen': 'Zylinder-Mantel: Höhe vergessen', 'zylinder-grundflaeche-statt-mantel': 'Zylinder: Grundfläche statt Mantel', 'minus-betraege': 'Minus-Zahlen: Beträge addiert'
};
