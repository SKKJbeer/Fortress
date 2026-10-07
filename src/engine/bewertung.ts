// Wann die App um eine Bewertung bittet (v3.118.0).
//
// Bewertungen sind der staerkste Hebel fuer die Sichtbarkeit im App Store —
// und die schlechteste Gelegenheit, nach einer zu fragen, ist eine Niederlage
// oder der erste Start. Deshalb: nur nach einem SIEG, erst nach einigen
// Partien, und mit langem Abstand. Apple begrenzt die Abfrage ohnehin auf drei
// Anzeigen je Jahr und entscheidet selbst, ob sie erscheint — die Regel hier
// sorgt dafuer, dass wir die drei Gelegenheiten nicht verschwenden.
//
// Pur: kein localStorage, keine Uhr. Den Zustand haelt der Aufrufer
// (SCHLUESSEL.bewertung).

export interface BewertungsStand {
  /** Zeitpunkt der letzten Bitte (ms), 0 = nie */
  zuletzt: number;
  /** Wie oft schon gebeten wurde */
  anzahl: number;
  /** Gewertete Partien seit Installation (Bot + Online). Das Profil zaehlt
   *  nur Online-Partien — wer nur gegen den Bot spielt, kaeme nie dran. */
  spiele: number;
}

/** Erst nach so vielen gewerteten Partien (Bot + Online). */
export const BEWERTUNG_AB_SPIELEN = 5;
/** Mindestabstand zwischen zwei Bitten. */
export const BEWERTUNG_ABSTAND_MS = 120 * 24 * 3600 * 1000;
/** Danach nie wieder — wer dreimal nicht wollte, will nicht. */
export const BEWERTUNG_HOECHSTENS = 3;

export function leererBewertungsStand(): BewertungsStand {
  return { zuletzt: 0, anzahl: 0, spiele: 0 };
}

/** Aus dem Speicher gelesenen Wert absichern (fremd, alt, kaputt). */
export function bewertungsStandAus(roh: unknown): BewertungsStand {
  const o = (roh && typeof roh === 'object') ? roh as Record<string, unknown> : {};
  const zahl = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
  return { zuletzt: zahl(o.zuletzt), anzahl: Math.floor(zahl(o.anzahl)), spiele: Math.floor(zahl(o.spiele)) };
}

export function sollUmBewertungBitten(
  stand: BewertungsStand,
  e: { gewonnen: boolean; jetzt: number },
): boolean {
  if (!e.gewonnen) return false;
  if (stand.spiele < BEWERTUNG_AB_SPIELEN) return false;
  if (stand.anzahl >= BEWERTUNG_HOECHSTENS) return false;
  if (stand.zuletzt && e.jetzt - stand.zuletzt < BEWERTUNG_ABSTAND_MS) return false;
  return true;
}

export function nachPartie(stand: BewertungsStand): BewertungsStand {
  return { ...stand, spiele: stand.spiele + 1 };
}

export function nachBitte(stand: BewertungsStand, jetzt: number): BewertungsStand {
  return { ...stand, zuletzt: jetzt, anzahl: stand.anzahl + 1 };
}
