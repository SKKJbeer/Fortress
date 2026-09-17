// Bot-Daten: Stufen, Namen, Wappen (aus app.js herausgeloest, v3.101.0).
//
// `BOT_LEVELS` ist Balancing — und dafuer gilt die Architekturregel dieses
// Projekts: Balancing-Konstanten nie inline im Spielcode. Hier stehen sie
// beieinander und lassen sich ohne Browser nachlesen und pruefen.
export type BotStufe = {
  spread: number;      // Streuung beim Zielen — kleiner = genauer
  fire: number;        // Feuer-Drossel; groesser = seltener geschossen
  maxCannons: number;  // wie viele Kanonen die Stufe aufbaut
  buy: 'basic' | 'standard' | 'optimal';
};

// Drei Stufen, klar getrennt: Wer „leicht" waehlt, soll den Unterschied
// SEHEN — nicht nur in der Statistik.
export const BOT_LEVELS: Record<string, BotStufe> = {
  easy: { spread: 2.4, fire: 1.8, maxCannons: 3, buy: 'basic' },
  mid:  { spread: 1.0, fire: 1.0, maxCannons: 6, buy: 'standard' },
  hard: { spread: 0.4, fire: 1.0, maxCannons: 8, buy: 'optimal' },
};

export const BOT_WAPPEN = ['roboter', 'skelett', 'vampir', 'pestdoc', 'eismagie', 'schatten'];

// Die Namen sind Teil des Spiels, kein Fuellmaterial: Sie geben dem Gegner
// ein Gesicht, ohne dass jemand echte Spielernamen missbrauchen koennte.
export const BOT_NAMES = [
  "Sir Bröckelbert von Bruchstein", "Gundula Geröllheimer", "Graf Zerbrösel III.",
  "Mortimer Mörtelbart", "Katapulta die Ungeduldige", "Baron von Trümmerfeld",
  "Zinnen-Zenzi", "Ritter Rums von Wumms", "Splitterhilde die Spröde",
  "Lord Fassadenriss", "Bimsbert der Belagerte", "Fräulein Schießscharte",
  "Der Graue Grantler", "Kanonikus Knall", "Burgfried Bröselmeier",
  "Walli die Wallmeisterin", "Herzog Halbdach", "Pulverpaula",
  "Steinbeißer Sepp", "Madame Mauerblume", "Türmchen-Toni",
  "General Gipsbruch", "Erkerhard der Schiefe", "Ballista Ballerina",
  "Freiherr von Fallgitter", "Trebuchet-Trude", "Mörser-Mechthild",
  "Ziegelrich Löwenmut", "Attila der Zinnenlose", "Burgunda von Bollwerk",
  "Kasimir Kanonenfutter", "Der Nörgelnde Normanne", "Schuttkönig Schorsch",
  "Prinzessin Pulverdampf", "Wackelwart von Windschief", "Festungs-Ferdi",
  "Gräfin Giebelbruch", "Bastian Bastion", "Zugbrücken-Zacharias",
  "Hilde Hagelschlag", "Ritter Kunibert Kachelschreck", "Munitiona die Großzügige",
  "Doktor Donnerschlag", "Schamane Schuttberg", "Vroni von der Vorburg",
  "Käpt'n Kartätsche", "Ottokar Ohnedach", "Magier Mauerfraß",
  "Isolde Eisenpforte", "Der Letzte Zinnensteher"
];
