import UIKit
import WebKit
import Capacitor

/// Die Ansicht des Spiels — sie unterscheidet sich von Capacitors Vorgabe in
/// genau einem Punkt: **die Text-Lupe von iOS ist aus.**
///
/// Gemeldet vom Geraet: Beim Ziehen ueber Kopfzeile und Shop klappte die Lupe
/// auf. Das CSS in index.html schaltet seit v3.32.1 Textauswahl und
/// Kontextmenue global ab; im Browser genuegt das, in Capacitors WebView
/// nicht. Die Textbedienung von WebKit haengt an der ANSICHT, nicht am
/// Dokument — sie greift auch dort, wo gar nichts auswaehlbar ist.
///
/// Abgeschaltet wird sie ueber `isTextInteractionEnabled` (ab iOS 14.5; das
/// Ziel dieses Projekts ist 15.0, eine Verfuegbarkeitsabfrage ist also
/// unnoetig). Gesetzt wird sie an der KONFIGURATION, bevor die Ansicht
/// entsteht — Capacitor sieht `webViewConfiguration(for:)` genau dafuer vor
/// und empfiehlt, die Vorgabe zu erweitern statt sie zu ersetzen.
///
/// **Sie bleibt schaltbar.** Ohne Textbedienung laesst sich in einem
/// Eingabefeld kein Wort markieren und die Schreibmarke nicht setzen — fuers
/// Spielfeld erwuenscht, fuer die Eingabe des Spielernamens nicht. Die
/// Weboberflaeche meldet deshalb ueber den Kanal `textfeld`, wenn ein Feld den
/// Fokus bekommt oder verliert (`src/platform.ts`), und hier wird
/// entsprechend umgeschaltet.
final class SpielViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let konfiguration = super.webViewConfiguration(for: instanceConfiguration)
        konfiguration.preferences.isTextInteractionEnabled = false
        // Der Nachrichtenkanal haelt den Empfaenger stark fest. Bei einem
        // beliebigen Bildschirm waere das ein Zyklus; diese Ansicht ist die
        // Wurzel der App und lebt ohnehin, solange die App laeuft.
        konfiguration.userContentController.add(self, name: "textfeld")
        return konfiguration
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "textfeld", let an = message.body as? Bool else { return }
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
