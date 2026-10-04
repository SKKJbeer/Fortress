// Leitungs-Probe gegen die ECHTE Datenbank (v3.117.0) — NUR LESEN.
//
// Die App startet die Datenbank getrennt und weckt sie nur bei Bedarf
// (goOnline/goOffline, app.js `leitung`). Ob das SDK nach goOffline wirklich
// wieder verbindet, kann die E2E-Suite nicht zeigen: Dort verbindet der
// WebSocket-Stub nie. Diese Probe liest dreimal die oeffentliche Bestenliste,
// jeweils nach goOffline → goOnline. Sie schreibt nichts und meldet sich nicht
// an. Aufruf: node scripts/leitung-probe.mjs
// Gemessen am 04.10.2026: 3/3, Wiederverbindung je 0,3–0,6 s.
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, onValue, goOffline, goOnline } from 'firebase/database';
const app = initializeApp({ apiKey: "AIzaSyBOmaWUaDKjSQCKZbEhYdy-PMl9LRQ-azg", databaseURL: "https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app", projectId: "fortress-cbe30", appId: "1:263415833676:web:73aed868626060a26c40e9" });
const db = getDatabase(app);
const t0 = Date.now(); const ms = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
goOffline(db);
onValue(ref(db, '.info/connected'), s => console.log(ms(), 'verbunden =', s.val()));
const lies = async (was) => { const a = Date.now(); const r = await Promise.race([get(ref(db, 'leaderboard')).then(x => 'ok, ' + Object.keys(x.val() || {}).length + ' Eintraege'), new Promise(r => setTimeout(() => r('FRIST 15s'), 15000))]); console.log(ms(), was, '→', r, `(${Date.now() - a} ms)`); };
await new Promise(r => setTimeout(r, 3000));
console.log(ms(), 'goOnline #1'); goOnline(db); await lies('Lesen 1');
console.log(ms(), 'goOffline'); goOffline(db); await new Promise(r => setTimeout(r, 4000));
console.log(ms(), 'goOnline #2'); goOnline(db); await lies('Lesen 2');
goOffline(db); await new Promise(r => setTimeout(r, 2000));
console.log(ms(), 'goOnline #3'); goOnline(db); await lies('Lesen 3');
goOffline(db); setTimeout(() => process.exit(0), 500);

