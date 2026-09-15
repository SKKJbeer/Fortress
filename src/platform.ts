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

/**
 * Die Text-Lupe von iOS aus dem Spiel heraushalten — und nur dort zulassen,
 * wo sie hingehoert: im Namensfeld.
 *
 * **Warum das CSS nicht reicht.** `-webkit-user-select:none` und
 * `-webkit-touch-callout:none` stehen seit v3.32.1 global in index.html. Im
 * Browser genuegt das; in Capacitors WebView nicht. Die Textbedienung von
 * WebKit ist eine Eigenschaft der ANSICHT, keine des Dokuments — sie greift
 * auch dort, wo nichts auswaehlbar ist, und die Lupe erscheint beim Ziehen
 * ueber Kopfzeile und Shop. Abschalten laesst sie sich nur nativ:
 * `WKPreferences.isTextInteractionEnabled`, gesetzt in `SpielViewController`
 * (ios/App/App/SceneDelegate.swift).
 *
 * ── Warum die Richtung gedreht wurde (v3.90.0) ────────────────────────────
 *
 * v3.86.0 schaltete die Textbedienung beim Erzeugen der Ansicht AUS und
 * wollte sie einschalten, sobald ein Feld den Fokus bekommt. Das war in zwei
 * Punkten falsch, und beides zusammen kostete die Namenseingabe:
 *
 *   1. `isTextInteractionEnabled = false` heisst laut Apple „nicht auswaehlen
 *      UND NICHT BEARBEITEN". Ab dem ersten Bild der App war damit jedes
 *      Eingabefeld tot — und das erste Bild fuer einen neuen Spieler ist der
 *      Profil-Editor mit genau einem Feld: dem Namen.
 *   2. Das Wiedereinschalten lief ins Leere. `webView.configuration` ist laut
 *      Apple „eine KOPIE der Konfiguration, mit der die Ansicht erzeugt
 *      wurde"; an der Kopie zu drehen aendert an der lebenden Ansicht nichts.
 *      Der Schalter blieb also aus, fuer immer.
 *
 * Jetzt gilt die umgekehrte Richtung: Die Textbedienung bleibt AN, und
 * ausgeschaltet wird sie nur, solange das SPIELFELD oben ist — dort gibt es
 * kein Eingabefeld. Der Unterschied ist nicht Geschmack, sondern der
 * Fehlerfall: Beisst die Schaltung auf dem Geraet nicht, erscheint
 * schlimmstenfalls wieder die Lupe. Vorher war der Fehlerfall „man kann
 * seinen Namen nicht eintippen".
 *
 * Im Browser tut das alles nichts — dort gibt es den Kanal nicht, und das CSS
 * erledigt die Sache ohnehin.
 */
let letzteMeldung: boolean | null = null;

/** Meldet der nativen Huelle, ob die Textbedienung gebraucht wird. */
export function textbedienung(an: boolean): void {
  if (typeof window === "undefined") return;
  const kanal = (window as any).webkit?.messageHandlers?.textfeld;
  if (!kanal) return;
  // Nur bei Aenderung melden: Ein Bildschirmwechsel loest mehrere Renderlaeufe
  // aus, und jede Nachricht quert die Bruecke zwischen Web und App.
  if (letzteMeldung === an) return;
  letzteMeldung = an;
  try { kanal.postMessage(an); } catch (e) { /* ohne Bruecke: egal */ }
}

/**
 * Sicherheitsnetz: Bekommt irgendwo ein Eingabefeld den Fokus, wird die
 * Textbedienung eingeschaltet — ganz gleich, welcher Bildschirm sich das
 * gerade anders gedacht hat. Ein Feld, in das man nicht schreiben kann, ist
 * der schlimmere Fehler.
 */
export function lupeNurInTextfeldern(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const istFeld = (z: EventTarget | null) =>
    !!z && typeof (z as Element).closest === "function" &&
    !!(z as Element).closest("input:not([type=range]), textarea");
  document.addEventListener("focusin", (e) => { if (istFeld(e.target)) textbedienung(true); });
}

export function vibriere(muster: number | number[]): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (istNativ() && w.Capacitor?.Plugins?.Haptics) {
    // Capacitor-Haptik kennt keine Dauer, sondern Staerkegrade. Bei einem
    // Muster zaehlt die Gesamtdauer — es ist als kraeftigeres Ereignis gemeint.
    const gesamt = Array.isArray(muster)
      ? muster.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0)
      : muster;
    const stufe = gesamt >= 80 ? "HEAVY" : gesamt >= 25 ? "MEDIUM" : "LIGHT";
    try {
      w.Capacitor.Plugins.Haptics.impact({ style: stufe });
      return;
    } catch (e) { /* faellt unten auf den Browser-Weg zurueck */ }
  }
  try { navigator.vibrate && navigator.vibrate(muster as any); } catch (e) {}
}
