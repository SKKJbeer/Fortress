// Die Firebase-Sperre — EINE Quelle fuer alle, die einen Browser aufmachen.
//
// Sie setzt `window.__fb` VOR dem Seitenskript. `firebase-boot.js` sieht das
// und haelt sich vollstaendig heraus: keine Anmeldung, keine Verbindung,
// keine Schreibvorgaenge. Routen-Blockaden reichen dafuer NICHT — die
// Realtime Database spricht ueber WebSocket mit *.firebasedatabase.app und
// laesst sich so nicht zuverlaessig abfangen.
//
// **Warum das hier liegt und nicht in der Suite.** Bis v3.109.0 stand die
// Sperre nur in `test_fortress.cjs`, und der Riegel `tests/testsperre.test.js`
// las auch nur diese eine Datei. `tools/make-screenshots.cjs` macht aber
// ebenfalls vier Browser-Kontexte auf und laedt damit die echte App von
// `localhost:8765` — seit v3.103.0 mit API-Schluessel im Buendel. Der naechste
// Lauf haette das Demo-Profil „ARIN" mit ELO 1284 in die ECHTE Bestenliste
// geschrieben, also ueber jeden echten Spieler (Spitzenwert dort: 1046).
// Gemessen am 18.09.2026: noch nicht passiert. Eine Sperre, die nur die
// Haelfte der Aufrufer kennt, ist eben keine.
const FB_SPERRE = `
  window.__fb = window.__fb || {
    __gesperrt: true, uid: null, anon: true, mail: null,
    ref: () => ({}), set: async () => {}, update: async () => {}, remove: async () => {},
    get: async () => ({ exists: () => false, val: () => null }),
    onValue: () => () => {}, off: () => {},
    runTransaction: async () => ({ committed: false, snapshot: { exists: () => false, val: () => null } }),
    onDisconnect: () => ({ remove: () => {}, cancel: () => {} })
  };
`;


// Die ZWEITE Sperre: WebSocket stilllegen (v3.111.6).
//
// `FB_SPERRE` verhindert, dass `firebase-boot.js` ueberhaupt laeuft — gut fuer
// die Spielpruefungen, aber damit wurde der ECHTE Firebase-Start in keinem
// einzigen Test je ausgefuehrt. Genau dort sass der Fehler aus v3.111.4:
// `getRedirectResult` startete den Weiterleitungs-Aufloeser, dessen iframe im
// WebView haengt, und mit ihm die ganze Anmeldung.
//
// Fuer die Boot-Pruefung muss der echte Start also LAUFEN. Damit dabei nichts
// die Produktivdatenbank erreicht, wird hier die Realtime Database an ihrem
// Transport abgeschnitten: Sie spricht ueber WebSocket, und WebSocket laesst
// sich mit Routen NICHT abfangen (die Lehre aus v3.78.1). Ein Stub, der nie
// verbindet, ist die einzige zuverlaessige Bremse.
//
// Der Auth-Weg bleibt offen — er laeuft ueber fetch/XHR und iframes, ist also
// beobachtbar und per Route blockierbar. Genau der soll ja geprueft werden.
const WS_SPERRE = `
  (function () {
    const Echt = window.WebSocket;
    window.__wsVersuche = [];
    function Stub(url) {
      window.__wsVersuche.push(String(url));
      this.url = String(url);
      this.readyState = 0;            // CONNECTING, bleibt es auch
      this.close = function () {};
      this.send = function () {};
      this.addEventListener = function () {};
      this.removeEventListener = function () {};
    }
    Stub.CONNECTING = 0; Stub.OPEN = 1; Stub.CLOSING = 2; Stub.CLOSED = 3;
    Stub.__echt = Echt;
    window.WebSocket = Stub;
  })();
`;

module.exports = { FB_SPERRE, WS_SPERRE };
