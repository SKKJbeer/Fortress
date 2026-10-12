// Avatar-Katalog (aus src/game/app.js herausgeloest, v3.95.0).
//
// **Reine Daten, keine Verflechtung** — deshalb der erste Schnitt beim Abtragen
// des Grossblocks (ARCHITEKTUR.md, Schritt 8, Wuergefeigen-Muster). Die Bilder
// sind der mit Abstand groesste Datenposten des Spiels; sie haben hier ein
// Zuhause und muessen nicht mehr mitten im Spielcode gesucht werden.
//
// **WAPPEN_SVG ist dabei entfallen.** Es standen zwoelf Inline-SVG-Medaillons
// darin, 17,2 KB, die JEDER Spieler bei JEDEM Laden mitbekam — und die einzige
// verbliebene Verwendung war `Object.keys()`, also eine Liste von zwoelf Namen.
// Gezeichnet wird seit laengerem aus WAPPEN_SRC. Die Namensliste kommt jetzt
// aus WAPPEN_SRC selbst: eine Quelle statt zweier, die auseinanderlaufen
// koennen. Gegengeprueft vor dem Loeschen: beide Schluesselmengen waren
// identisch, auch in der Reihenfolge (die Reihenfolge ist sichtbar, der
// Profil-Editor zeigt die Avatare in ihr).


// Avatare als Dateien (v3.125.0). Jeder Avatar ist einzeln mit dem Skill
// `spielgrafik` gemalt (FLUX.1-schnell, Herkunft in assets/wappen/ENTSTEHUNG.md)
// und liegt als WebP (256 px) in public/wappen/. Bis v3.124.0 standen hier
// zwoelf Base64-PNGs mitten im Bundle — jeder Seitenaufruf lud sie, auch wer
// das Profil nie oeffnete. Jetzt laedt der Browser nur, was er zeigt, und der
// Service Worker haelt die Dateien offline vor.
//
// Die Schluessel und ihre REIHENFOLGE sind ein Vertrag: sie gehen uebers Netz
// (playerInfo.wappen) und der Profil-Editor zeigt sie in dieser Folge.
export const WAPPEN_SRC = {
  skelett: 'wappen/skelett.webp',
  waldhueter: 'wappen/waldhueter.webp',
  eismagier: 'wappen/eismagier.webp',
  roboter: 'wappen/roboter.webp',
  hexerin: 'wappen/hexerin.webp',
  kanone: 'wappen/kanone.webp',
  frankenstein: 'wappen/frankenstein.webp',
  feuerschaedel: 'wappen/feuerschaedel.webp',
  pestdoktor: 'wappen/pestdoktor.webp',
  blitz: 'wappen/blitz.webp',
  trojanischespferd: 'wappen/trojanischespferd.webp',
  phoenix: 'wappen/phoenix.webp',
};

// Reihenfolge = Anzeigereihenfolge im Profil-Editor.
export const WAPPEN = Object.keys(WAPPEN_SRC);

// Glow-Farbe je Avatar (für Profil-Editor Auswahl-Ringe)
export const WAPPEN_GLOW = {
  skelett:'#cc00ff', waldhueter:'#22ff44', eismagier:'#00ccff', roboter:'#8899aa',
  hexerin:'#bb00ff', kanone:'#0099ff',
  frankenstein:'#00ff44', feuerschaedel:'#ff5500', pestdoktor:'#00cc33',
  blitz:'#ffcc00', trojanischespferd:'#ffaa00', phoenix:'#ff4400',
};

// Migration: alte Avatar-Keys → neue Keys
export const WAPPEN_MIGRATION = {
  vampir:'skelett', pestdoc:'waldhueter', eismagie:'eismagier', schatten:'roboter',
  sternmage:'hexerin', golem:'kanone', seehexe:'frankenstein', feuergeist:'feuerschaedel',
  totenmage:'pestdoktor', sturmreiter:'blitz', golddrache:'trojanischespferd',
};

// Avatar-Unlock-System: Erste 4 sofort verfügbar, restliche 8 per Level
export const AVATAR_UNLOCKS = {
  skelett:1, waldhueter:1, eismagier:1, roboter:1,
  hexerin:5, kanone:10, frankenstein:15, feuerschaedel:20,
  pestdoktor:25, blitz:30, trojanischespferd:40, phoenix:50,
};
