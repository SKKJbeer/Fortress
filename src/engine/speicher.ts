// Die Schluessel des lokalen Speichers — an EINER Stelle.
//
// Aus dem Spielcode zusammengezogen (v3.100.0). Vorher standen sie als
// Zeichenketten an 37 Stellen verteilt. Ein Tippfehler in so einer Zeichenkette
// ist kein Absturz und keine Warnung: Der Schluessel wird schlicht nicht
// gefunden, das Spiel legt ein frisches Profil an, und jemandes Fortschritt ist
// weg. `tests/speicher.test.js` prueft deshalb, dass im ganzen Quellbaum kein
// unbekannter `fortress_`-Schluessel auftaucht.
export const SCHLUESSEL = {
  profil:       'fortress_profile',
  tag:          'fortress_daily',
  aufgaben:     'fortress_tasks',
  geraet:       'fortress_device_id',
  eigenesSpiel: 'fortress_my_game',
  sprache:      'fortress_lang',
  ton:          'fortress_sound',
  musik:        'fortress_music',
  musikLaut:    'fortress_music_vol',
  haptik:       'fortress_haptics',
  eingefuehrt:  'fortress_onboarded',
  tutorial:     'fortress_tutorial_done',
  achGesehen:   'fortress_ach_seen',
  leistung:     'fortress_perf',
} as const;

export type SchluesselName = keyof typeof SCHLUESSEL;

// Alle bekannten Schluessel als Menge — fuer die Pruefung und fuer
// „Fortschritt loeschen".
export const ALLE_SCHLUESSEL: string[] = Object.values(SCHLUESSEL);
