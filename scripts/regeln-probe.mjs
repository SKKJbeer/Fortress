#!/usr/bin/env node
// Prueft, was die Realtime Database UNANGEMELDETEN Zugriffen erlaubt.
//
// Aufruf:
//   node scripts/regeln-probe.mjs            nur LESEN (voellig harmlos)
//   node scripts/regeln-probe.mjs --schreiben zusaetzlich Schreibversuche
//
// **Warum das Schreiben hinter einem Schalter steht.** Es geht gegen die
// echte Datenbank, in der die Profile und Ranglisten wirklicher Spieler
// liegen. Wenn die Regeln greifen, passiert nichts — der Versuch wird
// abgewiesen und das IST das Ergebnis. Greifen sie nicht, liegt danach ein
// Fremdkoerper in der Datenbank, und dieses Skript raeumt ihn sofort wieder
// weg. Beides soll man bewusst ausloesen, nicht aus Versehen.
//
// Geschrieben wird ausschliesslich unter `__probe/…` — ein Pfad, den das
// Spiel nirgends benutzt und der in keiner Regel vorkommt. Damit faellt ein
// vergessener Rest sofort auf, statt sich unter echten Daten zu verstecken.

const BASIS = 'https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app';
const SCHREIBEN = process.argv.includes('--schreiben');
const marke = 'p' + Date.now().toString(36);

const gruen = (s) => `\x1b[32m${s}\x1b[0m`;
const rot   = (s) => `\x1b[31m${s}\x1b[0m`;
const grau  = (s) => `\x1b[90m${s}\x1b[0m`;

let befunde = 0;

async function lesen(pfad) {
  const r = await fetch(`${BASIS}/${pfad}.json?shallow=true&limitToFirst=1`);
  return r.status;
}

async function schreiben(pfad, wert) {
  const r = await fetch(`${BASIS}/${pfad}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wert),
  });
  return r.status;
}

async function loeschen(pfad) {
  const r = await fetch(`${BASIS}/${pfad}.json`, { method: 'DELETE' });
  return r.status;
}

console.log(`\nRealtime Database: ${BASIS.replace(/^https:\/\//, '')}`);
console.log(grau(`Modus: ${SCHREIBEN ? 'LESEN + SCHREIBEN' : 'nur LESEN'}\n`));

// ── 1) Lesen ───────────────────────────────────────────────────────────────
// `leaderboard` und die Warteschlangen sind bewusst oeffentlich lesbar — das
// Spiel zeigt sie jedem. `games` und `players` duerfen es nicht sein.
const LESEN = [
  ['leaderboard', 200, 'soll oeffentlich lesbar sein'],
  ['queue2',      200, 'soll oeffentlich lesbar sein'],
  ['queue3',      200, 'soll oeffentlich lesbar sein'],
  ['games',       401, 'darf NICHT oeffentlich lesbar sein'],
  ['players',     401, 'darf NICHT oeffentlich lesbar sein'],
];
console.log('LESEN (unangemeldet)');
for (const [pfad, erwartet, warum] of LESEN) {
  const code = await lesen(pfad);
  const ok = code === erwartet;
  if (!ok) befunde++;
  console.log(`  ${ok ? gruen('✓') : rot('✗')} ${pfad.padEnd(12)} HTTP ${code}`
    + grau(`   erwartet ${erwartet} — ${warum}`));
}

// ── 2) Schreiben ───────────────────────────────────────────────────────────
if (!SCHREIBEN) {
  console.log(grau('\nSchreibversuche uebersprungen (--schreiben setzen).'));
  process.exit(befunde ? 1 : 0);
}

const SCHREIBPFADE = [
  [`games/__probe_${marke}/createdAt`,  'Spielknoten'],
  [`queue2/__probe_${marke}/ts`,        'Warteschlange 2'],
  [`queue3/__probe_${marke}/ts`,        'Warteschlange 3'],
  [`leaderboard/__probe_${marke}/wins`, 'Bestenliste'],
  [`players/__probe_${marke}/v`,        'Cloud-Save'],
];
console.log('\nSCHREIBEN (unangemeldet) — erwartet wird ueberall ABWEISUNG');
const durchgekommen = [];
for (const [pfad, was] of SCHREIBPFADE) {
  const code = await schreiben(pfad, Date.now());
  const abgewiesen = code === 401 || code === 403;
  if (!abgewiesen) { befunde++; durchgekommen.push(pfad); }
  console.log(`  ${abgewiesen ? gruen('✓ abgewiesen') : rot('✗ DURCHGEKOMMEN')}  ${was.padEnd(16)} HTTP ${code}`);
}

// ── 3) Aufraeumen ──────────────────────────────────────────────────────────
if (durchgekommen.length) {
  console.log(rot(`\n${durchgekommen.length} Schreibzugriff(e) kamen durch — wird sofort aufgeraeumt:`));
  for (const pfad of durchgekommen) {
    const eltern = pfad.split('/').slice(0, 2).join('/');   // z. B. games/__probe_xyz
    const code = await loeschen(eltern);
    const weg = await lesen(eltern);
    console.log(`  ${eltern}: DELETE ${code}, danach ${weg === 200 ? rot('NOCH DA') : gruen('weg')}`);
  }
  console.log(rot('\nDie Regeln greifen nicht. Nichts als erledigt melden.'));
} else {
  console.log(gruen('\nAlle Schreibversuche abgewiesen — die Regeln greifen.'));
  console.log(grau('Nichts aufzuraeumen: Ein abgewiesener Zugriff hinterlaesst nichts.'));
}

process.exit(befunde ? 1 : 0);
