// Cloud-Sicherung gegen die ECHTE Datenbank (v3.117.0).
//
// Bisher nur gegen den Mock geprueft (suiteCloudSave). Diese Probe macht genau,
// was die App fuer jeden Spieler tut — anonym anmelden, Profil nach
// players/<uid> sichern, zuruecklesen, vergleichen — und raeumt danach
// VOLLSTAENDIG auf: Datensatz loeschen, Loeschung nachlesen, anonymes Konto
// entfernen. Es bleibt nichts stehen. Schreibt NICHT in die Bestenliste.
// Aufruf: node scripts/cloudsave-probe.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, deleteUser } from 'firebase/auth';
import { getDatabase, ref, set, get, remove, goOffline } from 'firebase/database';
import { cloudPayload, parseCloud } from '../src/engine/cloudsave.ts';

const app = initializeApp({ apiKey: "AIzaSyBOmaWUaDKjSQCKZbEhYdy-PMl9LRQ-azg", authDomain: "fortress-cbe30.firebaseapp.com", databaseURL: "https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app", projectId: "fortress-cbe30", appId: "1:263415833676:web:73aed868626060a26c40e9" });
const auth = getAuth(app), db = getDatabase(app);
const frist = (p, ms, was) => Promise.race([p, new Promise((_, n) => setTimeout(() => n(new Error(`${was}: keine Antwort in ${ms} ms`)), ms))]);
let fehler = 0;
const pruefe = (b, m) => { console.log(`  ${b ? 'ok  ' : 'FEHL'} ${m}`); if (!b) fehler++; };

const cred = await frist(signInAnonymously(auth), 15000, 'Anmeldung');
const uid = cred.user.uid;
console.log(`Anonym angemeldet: ${uid.slice(0, 6)}…`);
const pfad = `players/${uid}`;
try {
  const profil = { id: 'p_probe', name: 'Probe', wappen: 'skelett', color: '#2563eb', elo: 1077, level: 4, xp: 120, gold: 333,
    stats: { wins: 3, losses: 2, games: 5 }, achievements: ['first_win'], cosmetics: { owned: ['trail_gold'], equipped: { trail: 'trail_gold' } } };
  const rec = cloudPayload(profil, Date.now());
  pruefe(!!rec, 'Datensatz gebaut (wie in der App)');
  await frist(set(ref(db, pfad), rec), 15000, 'Schreiben');
  pruefe(true, 'gesichert nach ' + pfad.slice(0, 14) + '…');
  const zurueck = (await frist(get(ref(db, pfad)), 15000, 'Lesen')).val();
  const p2 = parseCloud(zurueck);
  pruefe(!!p2, 'zurueckgelesen und gelesen (parseCloud)');
  for (const k of ['name', 'elo', 'level', 'xp', 'gold'])
    pruefe(p2 && p2[k] === profil[k], `Feld ${k}: ${p2 && p2[k]} (erwartet ${profil[k]})`);
  pruefe(p2 && p2.stats && p2.stats.wins === 3, 'Statistik vollstaendig');
  pruefe(p2 && JSON.stringify(p2.cosmetics && p2.cosmetics.owned) === JSON.stringify(['trail_gold']), 'gekaufte Kosmetik vollstaendig');
  // Fremder Zugriff: ein ANDERER Pfad darf nicht beschreibbar sein (Regel auth.uid === $uid)
  let fremd = 'erlaubt';
  try { await frist(set(ref(db, 'players/fremde_kennung_probe'), rec), 15000, 'Fremdschreiben'); } catch (e) { fremd = 'abgewiesen'; }
  pruefe(fremd === 'abgewiesen', `fremden Spielstand schreiben: ${fremd}`);
} finally {
  await frist(remove(ref(db, pfad)), 15000, 'Loeschen').catch((e) => { console.log('  FEHL Loeschen: ' + e.message); fehler++; });
  const weg = (await frist(get(ref(db, pfad)), 15000, 'Nachlesen').catch(() => null));
  pruefe(weg && !weg.exists(), 'Datensatz wieder geloescht (nachgelesen)');
  await frist(deleteUser(auth.currentUser), 15000, 'Konto entfernen').then(() => pruefe(true, 'anonymes Konto entfernt'), (e) => pruefe(false, 'anonymes Konto entfernen: ' + e.message));
  goOffline(db);
}
console.log(fehler ? `\n${fehler} Fehler.` : '\nCloud-Sicherung gegen die echte Datenbank: alles gut.');
process.exit(fehler ? 1 : 0);
