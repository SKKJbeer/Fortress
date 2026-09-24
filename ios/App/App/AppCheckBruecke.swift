import Foundation
import WebKit
import FirebaseCore
import FirebaseAppCheck

/// Firebase App Check in der App-Huelle (v3.113.0).
///
/// **Wozu.** Die Datenbank laesst jeden angemeldeten Client schreiben, und
/// angemeldet ist man anonym mit einem einzigen Aufruf. App Check verlangt
/// zusaetzlich einen Nachweis, dass die Anfrage aus DIESER App stammt — auf
/// dem iPhone ueber Apples App Attest, das der Hersteller selbst bestaetigt.
///
/// **Warum hier und nicht in der Weboberflaeche.** App Attest ist eine native
/// Schnittstelle (`DCAppAttestService`); JavaScript im WebView kommt nicht
/// heran. Die Huelle holt das Token und reicht es ueber den Kanal `appcheck`
/// an die Weboberflaeche, deren Firebase-SDK es jeder Anfrage beilegt
/// (`CustomProvider` in src/firebase-boot.js).
///
/// **Simulator und Debug-Bau** nehmen den Debug-Anbieter: App Attest gibt es
/// im Simulator nicht. Das Debug-Token kommt beim Probelauf ueber die Umgebung
/// (`FIRAAppCheckDebugToken`) und wird von `ios.yml` fuer genau diesen Lauf in
/// Firebase angelegt und danach wieder geloescht.
enum AppCheckStart {
    /// Die Werte der in Firebase registrierten iOS-App. Nichts davon ist
    /// geheim — dieselbe Art Kennung wie der Web-Schluessel in
    /// src/firebase-boot.js (angelegt ueber `appcheck.yml`, Modus einrichten).
    static let googleAppID = "1:263415833676:ios:1e4837bea6c760ca6c40e9"
    static let absenderID = "263415833676"
    static let apiSchluessel = "AIzaSyCbTUzvBpc6ONVLVGTzA7wZlYma-GvKKrk"
    static let projekt = "fortress-cbe30"

    static func einrichten() {
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(AppAttestFabrik())
        #endif
        let optionen = FirebaseOptions(googleAppID: googleAppID, gcmSenderID: absenderID)
        optionen.apiKey = apiSchluessel
        optionen.projectID = projekt
        optionen.bundleID = Bundle.main.bundleIdentifier ?? "de.skkjbeer.stackandsiege"
        FirebaseApp.configure(options: optionen)
        NSLog("STACK-SIEGE-HUELLE App Check eingerichtet (%@)", anbieter)
    }

    static var anbieter: String {
        #if DEBUG
        return "debug"
        #else
        return "appattest"
        #endif
    }
}

/// App Attest fuer Release-Baeue. Mindestziel ist iOS 15, App Attest gibt es
/// ab iOS 14 — eine Verfuegbarkeitsweiche braucht es deshalb nicht.
final class AppAttestFabrik: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        return AppAttestProvider(app: app)
    }
}

/// Der Kanal `appcheck`: Die Weboberflaeche fragt, die Huelle antwortet mit
/// `{token, ablauf}` (Millisekunden) oder einer Fehlermeldung.
///
/// `WKScriptMessageHandlerWithReply` statt des einfachen Kanals: Die
/// Weboberflaeche braucht eine ANTWORT, und dieser Weg liefert sie als
/// Promise zurueck (`postMessage` gibt dann eines zurueck). Die beiden anderen
/// Kanaele (`textfeld`, `pruefung`) sind reine Meldungen ohne Antwort.
final class AppCheckKanal: NSObject, WKScriptMessageHandlerWithReply {
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        let neu = ((message.body as? [String: Any])?["neu"] as? Bool) ?? false
        AppCheck.appCheck().token(forcingRefresh: neu) { token, fehler in
            DispatchQueue.main.async {
                if let token = token {
                    replyHandler(["token": token.token,
                                  "ablauf": token.expirationDate.timeIntervalSince1970 * 1000,
                                  "anbieter": AppCheckStart.anbieter], nil)
                } else {
                    let text = fehler.map { String(describing: $0) } ?? "kein Token"
                    NSLog("STACK-SIEGE-HUELLE App Check ohne Token: %@", text)
                    replyHandler(nil, String(text.prefix(300)))
                }
            }
        }
    }
}
