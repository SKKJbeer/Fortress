import UIKit
import WebKit
import Capacitor

/// Die Ansicht des Spiels — sie unterscheidet sich von Capacitors Vorgabe in
/// genau einem Punkt: **sie kann die Text-Lupe von iOS abschalten.**
///
/// Gemeldet vom Geraet: Beim Ziehen ueber Kopfzeile und Shop klappte die Lupe
/// auf. Das CSS in index.html schaltet seit v3.32.1 Textauswahl und
/// Kontextmenue global ab; im Browser genuegt das, in Capacitors WebView
/// nicht. Die Textbedienung von WebKit haengt an der ANSICHT, nicht am
/// Dokument — sie greift auch dort, wo gar nichts auswaehlbar ist.
///
/// ── Was v3.86.0 hier falsch gemacht hat (behoben in v3.90.0) ──────────────
///
/// Damals stand an dieser Stelle `isTextInteractionEnabled = false`, gesetzt
/// an der Konfiguration, BEVOR die Ansicht entsteht. Zwei Fehler auf einmal:
///
///   1. `false` heisst laut Apple „nicht auswaehlen UND NICHT BEARBEITEN".
///      Ab dem ersten Bild der App war damit jedes Eingabefeld tot. Das erste
///      Bild fuer einen neuen Spieler ist der Profil-Editor, und dessen
///      einziges Feld ist der Name — **man konnte sich keinen Namen geben.**
///   2. Das Wiedereinschalten unten lief ins Leere. `webView.configuration`
///      ist laut Apple „eine KOPIE der Konfiguration, mit der die Ansicht
///      erzeugt wurde". An der Kopie zu drehen aendert an der lebenden Ansicht
///      nichts; der Schalter blieb aus, fuer immer.
///
/// **Deshalb wird hier nichts mehr abgeschaltet.** Die Textbedienung startet
/// an, wie iOS sie vorsieht. Ausgeschaltet wird sie nur auf Zuruf der
/// Weboberflaeche, solange das Spielfeld oben ist (`src/platform.ts`).
///
/// Der Fehlerfall ist damit gedreht, und das ist der eigentliche Gewinn:
/// Beisst der Zuruf auf dem Geraet nicht, erscheint schlimmstenfalls wieder
/// die Lupe. Vorher hiess der Fehlerfall „die App ist nicht zu bedienen".
final class SpielViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let konfiguration = super.webViewConfiguration(for: instanceConfiguration)
        // Diagnose: Wird diese Ansicht ueberhaupt benutzt? Der Simulator-
        // Probelauf fand den Bruecken-Marker nicht, und dafuer gibt es zwei
        // moegliche Gruende — die Bruecke schweigt, oder dieser Kode laeuft
        // gar nicht. Diese Zeile trennt die beiden Faelle.
        NSLog("STACK-SIEGE-HUELLE SpielViewController konfiguriert")
        // Der Nachrichtenkanal haelt den Empfaenger stark fest. Bei einem
        // beliebigen Bildschirm waere das ein Zyklus; diese Ansicht ist die
        // Wurzel der App und lebt ohnehin, solange die App laeuft.
        konfiguration.userContentController.add(self, name: "textfeld")
        return konfiguration
    }

    /// Ein Lebenszeichen fuer den Probelauf im Simulator — einmal pro Start.
    ///
    /// **Warum ueber diesen Kanal und nicht ueber console.log.** Der erste
    /// Versuch schrieb die Zeile in der Weboberflaeche und suchte sie im
    /// Systemprotokoll. Im Lauf nachgesehen: 983 Protokollzeilen der App, kein
    /// Marker. WebKit reicht Konsolenausgaben an den Web-Inspektor weiter, nicht
    /// an os_log — die Pruefung fand vorher nur ihren eigenen Suchbegriff in der
    /// Aufrufzeile von `log` und war damit leer.
    ///
    /// Diese Zeile sagt mehr als „React ist gestartet": Sie beweist, dass die
    /// BRUECKE zwischen Weboberflaeche und Huelle traegt. Die erste Nachricht
    /// kommt beim Aufbau des Menues (`textbedienung` in src/platform.ts).
    private var lebenszeichenGesendet = false

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "textfeld", let an = message.body as? Bool else { return }
        if !lebenszeichenGesendet {
            lebenszeichenGesendet = true
            NSLog("STACK-SIEGE-BEREIT Bruecke steht, Textbedienung=%@", an ? "an" : "aus")
        }
        // Bestmoeglicher Versuch — siehe Punkt 2 oben. Schlaegt er fehl, bleibt
        // die Textbedienung an, und die App bleibt bedienbar.
        webView?.configuration.preferences.isTextInteractionEnabled = an
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SpielViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
