// ⚠️ SCHREIBT IN DIE PRODUKTIVDATENBANK. Laeuft NIE im Dauerlauf.
//
//     node scripts/cloudsave-probe.cjs
//
// Spielt Schritt 5 der Marktstart-Checkliste durch, an der ECHTEN Seite und
// der ECHTEN Datenbank: anmelden → Stand hochladen → oertlich loeschen →
// neu laden → kommt er zurueck? Das laesst sich mit keinem Mock beantworten;
// die Frage ist gerade, ob die echte Kette traegt.
//
// Deshalb hat diese Datei bewusst KEINE FB_SPERRE — und steht als benannte
// Ausnahme in `tests/testsperre.test.js`, mit Begruendung. Jede andere Datei
// im Baum, die einen Browser aufmacht, braucht die Sperre.
//
// Sie raeumt hinter sich auf, und zwar auf beiden Spuren (players/{uid} UND
// leaderboard/{uid}) — so wie `wipeProgress()` es im Spiel tut. Danach wird
// NACHGESEHEN, nicht geglaubt.
// jedes Mal tut, waere genau der Fehler, den FB_SPERRE verhindern soll.
const { chromium } = require('playwright');
const URL = 'https://skkjbeer.github.io/Fortress/';

const res = [];
const ok   = m => { res.push(true);  console.log('✅ ' + m); };
const fail = m => { res.push(false); console.log('❌ ' + m); };

const PROFIL = {
  id: 'p_probe_cloudsave', name: 'Probe', wappen: 'ritter', color: '#2563eb',
  elo: 1000, elo3: 1000, peakElo: 1000, peakElo3: 1000,
  stats: { wins: 0, losses: 0, games: 0 }, stats3: { wins: 0, losses: 0, games: 0 },
  gold: 4242, level: 7, xp: 33, seasonXp: 0,
  achievements: [], unlockedRewards: [], dailyTasks: [],
  // Nachtrags-Migrationen als erledigt markieren, sonst vergibt loadProfile
  // rueckwirkend Gold/XP und der Vergleich unten misst etwas anderes.
  historicalXpApplied: true, achievementsRetroApplied: true
};

const warteAuf = async (page, fn, ms = 20000, takt = 250) => {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    const v = await page.evaluate(fn).catch(() => null);
    if (v) return v;
    await page.waitForTimeout(takt);
  }
  return null;
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let uid = null;
  try {
    // ── 1) Anmelden lassen, echte uid holen ──────────────────────
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    uid = await warteAuf(page, () => (window.__fb && window.__fb.uid) || null, 30000);
    uid ? ok(`Anonyme Anmeldung an der echten Seite: uid ${uid.slice(0, 8)}…`)
        : fail('keine uid — Anmeldung schlug fehl');
    if (!uid) return;

    const anonym = await page.evaluate(() => window.__fb.anon);
    ok(`Anmeldezustand: anonym=${anonym}`);

    // ── 2) Spielstand hinterlegen, neu laden → muss hochgeladen werden ──
    await page.evaluate(p => localStorage.setItem('fortress_profile', JSON.stringify(p)), PROFIL);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const hoch = await warteAuf(page, async () => {
      const F = window.__fb; if (!F || !F.uid) return null;
      const s = await F.get(F.ref(F.db, 'players/' + F.uid));
      if (!s.exists()) return null;
      const v = s.val();
      return (v && typeof v.p === 'string') ? v.p : null;
    }, 30000);

    if (!hoch) { fail('Cloud-Save: nichts unter players/{uid} angekommen'); return; }
    const oben = JSON.parse(hoch);
    ok('Cloud-Save: Profil liegt unter players/{uid} in der echten Datenbank');
    (oben.gold === 4242 && oben.level === 7)
      ? ok(`Cloud-Save: Werte vollstaendig hochgeladen (gold=${oben.gold}, level=${oben.level})`)
      : fail(`Cloud-Save: Werte weichen ab (gold=${oben.gold}, level=${oben.level})`);

    // ── 3) Oertlichen Stand loeschen, neu laden → muss zurueckkommen ──
    await page.evaluate(() => {
      for (const k of ['fortress_profile', 'fortress_daily', 'fortress_tasks'])
        localStorage.removeItem(k);
    });
    const weg = await page.evaluate(() => localStorage.getItem('fortress_profile'));
    weg === null ? ok('Oertlicher Stand geloescht (fortress_profile ist weg)')
                 : fail('Oertlicher Stand liess sich nicht loeschen');

    await page.reload({ waitUntil: 'domcontentloaded' });
    const zurueck = await warteAuf(page, () => {
      const r = localStorage.getItem('fortress_profile');
      if (!r) return null;
      try { const p = JSON.parse(r); return p && p.gold >= 4242 ? r : null; } catch (e) { return null; }
    }, 30000);

    if (zurueck) {
      const p = JSON.parse(zurueck);
      ok(`Wiederherstellung: Stand kam aus der Wolke zurueck (gold=${p.gold}, level=${p.level})`);
      p.name === 'Probe' ? ok('Wiederherstellung: Name erhalten')
                         : fail(`Wiederherstellung: Name weicht ab (${p.name})`);
    } else {
      const jetzt = await page.evaluate(() => localStorage.getItem('fortress_profile'));
      fail(`Wiederherstellung fehlgeschlagen — lokal steht jetzt: ${String(jetzt).slice(0, 200)}`);
    }
  } catch (e) {
    fail('Ausnahme: ' + e.message);
  } finally {
    // ── 4) Aufraeumen: BEIDE Serverspuren, wie wipeProgress es tut ──
    if (uid) {
      const sauber = await page.evaluate(async (lokaleId) => {
        const F = window.__fb; if (!F || !F.uid) return 'kein fb';
        const pfade = ['players/' + F.uid, 'leaderboard/' + F.uid, 'leaderboard/' + lokaleId];
        const ergebnis = {};
        for (const pfad of pfade) {
          try { await F.remove(F.ref(F.db, pfad)); ergebnis[pfad] = 'weg'; }
          catch (e) { ergebnis[pfad] = 'FEHLER ' + (e.code || e.message); }
        }
        // Nachsehen, nicht glauben.
        for (const pfad of ['players/' + F.uid, 'leaderboard/' + F.uid]) {
          try { const s = await F.get(F.ref(F.db, pfad)); ergebnis[pfad] += s.exists() ? ' (STEHT NOCH DA)' : ' (nachgesehen: leer)'; }
          catch (e) { ergebnis[pfad] += ' (nicht lesbar)'; }
        }
        return ergebnis;
      }, PROFIL.id).catch(e => 'Aufraeumen scheiterte: ' + e.message);
      console.log('\nAufgeraeumt:', JSON.stringify(sauber, null, 2));
    }
    await browser.close();
    const gut = res.filter(Boolean).length;
    console.log(`\nErgebnis: ${gut} ✅  ${res.length - gut} ❌`);
    process.exit(res.every(Boolean) ? 0 : 1);
  }
})();
