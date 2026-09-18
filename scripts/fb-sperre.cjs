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

module.exports = { FB_SPERRE };
