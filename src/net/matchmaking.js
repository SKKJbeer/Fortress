// Netz-Schicht (Phase 2 der Modularisierung, v3.35.0).
// Pure Logik — kein DOM, kein Firebase. Unit-testbar via node --test.
// Matchmaking: ELO-naher Suchradius, der mit der Wartezeit wächst, damit
// niemand ewig wartet. Sanftes Wachstum (±60 Basis, +8/s): nach 60s ±540,
// nach 2min praktisch unbegrenzt — bevorzugt also möglichst faire Paarungen.
export const MM_BASE_RADIUS = 60;
export const MM_GROWTH_PER_SEC = 8;
export function mmRadius(waitSec) {
  return MM_BASE_RADIUS + Math.max(0, waitSec) * MM_GROWTH_PER_SEC;
}
export const MM_TICK_MS = 2000;
export const MM_HEARTBEAT_STALE_MS = 35e3;
export const MM_CLAIM_HEAL_MS = 6e3;
export const MM_GUEST_JOIN_TIMEOUT_MS = 15e3;
// Bot-Backfill (v3.32.4): nach dieser Wartezeit ohne Gegner wird die Suche
// beendet und nahtlos ein Übungsmatch gegen den Bot gestartet (nur 2P-Queue;
// zählt wie jedes Bot-Spiel NICHT für ELO/Stats). Verhindert den Launch-Killer
// „leere Queue → Spieler wartet ewig → deinstalliert".
export const MM_BOT_BACKFILL_S = 60;

// ── Deterministisches globales Pairing (v3.14.13, extrahiert v3.35.0) ──
// ALLE Clients berechnen aus demselben Queue-Snapshot dieselbe Gruppen-
// Zuteilung: ELO-sortierte Liste (Tie-Break Session-ID), gierig benachbarte
// np-Gruppen im wachsenden ELO-Radius; pro Gruppe claimt GENAU der Client
// mit der kleinsten Session-ID (wird Host). NIE zurueck zu "jeder waehlt
// seinen Wunschgegner" — das erzeugte ab ~15 Wartenden Praeferenz-Ketten
// ohne zustaendigen Claimer (Livelock, siehe SPEC v3.14.13).
// wait: [{id, elo, ts}] · np: 2|3 · nowMs: Snapshot-Zeit · myId: eigene Session
// → { sorted, group|null, claimer|null }
export function computeMatchGroup(wait, np, nowMs, myId) {
  const sorted = [...wait].sort((a, b) => a.elo - b.elo || (a.id < b.id ? -1 : 1));
  const radOk = (a, b) => Math.abs(a.elo - b.elo) <= Math.max(mmRadius((nowMs - a.ts) / 1e3), mmRadius((nowMs - b.ts) / 1e3));
  let group = null;
  let i = 0;
  while (i + np <= sorted.length) {
    const g = sorted.slice(i, i + np);
    let okG = true;
    for (let a = 0; a < g.length && okG; a++) {
      for (let b = a + 1; b < g.length; b++) {
        if (!radOk(g[a], g[b])) { okG = false; break; }
      }
    }
    if (okG) {
      if (g.some((x) => x.id === myId)) { group = g; break; }
      i += np; // fertige Gruppe anderer Spieler ueberspringen
    } else {
      i += 1;
    }
  }
  if (!group) return { sorted, group: null, claimer: null };
  const claimer = group.reduce((m, x) => x.id < m.id ? x : m, group[0]);
  return { sorted, group, claimer };
}
