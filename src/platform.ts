// Die EINE Plattform-Weiche (ARCHITEKTUR.md E7).
//
// Sobald sich Plattform-Abfragen ueber den Code verteilen, weiss niemand mehr,
// worin sich die App von der Website unterscheidet — und Unterschiede, die man
// nicht aufzaehlen kann, kann man nicht testen. Deshalb steht hier alles an
// einer Stelle, und der Rest des Spiels fragt nur diese Funktionen.

/** Laeuft der Code in der nativen Huelle (Capacitor) statt im Browser? */
export function istNativ(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  // Capacitor setzt window.Capacitor. `__NATIVE__` ist der Testschalter — die
  // E2E-Suite muss beide Zustaende pruefen koennen, ohne eine App zu bauen.
  if (w.__NATIVE__ === true) return true;
  if (w.__NATIVE__ === false) return false;
  return !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
}

/**
 * Darf ein Konto verknuepft werden?
 *
 * In der App NEIN (v1) — die Verknuepfung zieht drei Ablehnungsgruende nach
 * sich, die alle entfallen, solange es keine Kontoanlage gibt: 5.1.1(v)
 * (Loeschpflicht), 4.8 (Sign in with Apple), und Googles Sperre fuer OAuth in
 * eingebetteten WebViews (`disallowed_useragent`), an der der Redirect-Flow
 * aus v3.72.0 in Capacitor ohnehin scheitern wuerde.
 *
 * Cloud-Save laeuft in der App trotzdem — ueber die anonyme Kennung.
 */
export function kontoVerknuepfbar(): boolean {
  return !istNativ();
}

/** Vibration. `navigator.vibrate` gibt es auf iOS nicht. */
export function vibriere(ms: number): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (istNativ() && w.Capacitor?.Plugins?.Haptics) {
    // Capacitor-Haptik kennt keine Dauer, sondern Staerkegrade.
    try {
      w.Capacitor.Plugins.Haptics.impact({ style: ms >= 30 ? "MEDIUM" : "LIGHT" });
      return;
    } catch (e) { /* faellt unten auf den Browser-Weg zurueck */ }
  }
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
}
