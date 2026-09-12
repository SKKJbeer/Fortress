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
 * `WKPreferences.isTextInteractionEnabled`, gesetzt in
 * `SpielViewController` (ios/App/App/SceneDelegate.swift).
 *
 * **Warum trotzdem eine Schaltung und kein dauerhaftes Aus.** Ohne
 * Textbedienung laesst sich in einem Eingabefeld kein Wort markieren und die
 * Schreibmarke nicht setzen. Fuers Spielfeld ist das erwuenscht, fuer die
 * Eingabe des Spielernamens waere es eine Verschlechterung. Also: aus, solange
 * niemand in einem Feld steht, an, sobald eines den Fokus hat.
 *
 * Im Browser tut die Funktion nichts — dort gibt es den Kanal nicht, und das
 * CSS erledigt die Sache ohnehin.
 */
export function lupeNurInTextfeldern(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const kanal = (window as any).webkit?.messageHandlers?.textfeld;
  if (!kanal) return;
  const melden = (an: boolean) => { try { kanal.postMessage(an); } catch (e) {} };
  const istFeld = (z: EventTarget | null) =>
    !!z && typeof (z as Element).closest === "function" &&
    !!(z as Element).closest("input:not([type=range]), textarea");
  document.addEventListener("focusin", (e) => { if (istFeld(e.target)) melden(true); });
  document.addEventListener("focusout", (e) => { if (istFeld(e.target)) melden(false); });
}

/**
 * Vibration. `navigator.vibrate` gibt es auf iOS nicht.
 *
 * Der Parameter ist entweder eine Dauer ODER ein MUSTER — `SFX.destroy()`
 * uebergibt `[30, 40, 60]`. Ein blosser Vergleich `ms >= 30` ist auf ein Feld
 * blind (`[30,40,60] >= 30` ergibt false), womit ausgerechnet der staerkste
 * Effekt des Spiels nativ als schwaechster Impuls ankaeme.
 */
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
