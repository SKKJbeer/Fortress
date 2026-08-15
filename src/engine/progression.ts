// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
// ELO-, Gold-, XP- und Level-Formeln. Alle Funktionen sind pure —
// dieselben Formeln kann eine spaetere Cloud Function serverseitig ausfuehren.
export function getLevelTier(level: number) {
  if (level >= 50) return { name: "legend", label: "LEGENDÄR", color: "#a78bfa", glow: "rgba(167,139,250,0.7)", border: "#7c3aed" };
  if (level >= 25) return { name: "platin", label: "PLATIN",   color: "#22d3ee", glow: "rgba(34,211,238,0.7)",  border: "#0891b2" };
  if (level >= 10) return { name: "gold",   label: "GOLD",     color: "#fbbf24", glow: "rgba(251,191,36,0.7)", border: "#ca8a04" };
  return              { name: "silver",  label: "SILBER",   color: "#94a3b8", glow: "rgba(148,163,184,0.5)", border: "#64748b" };
}
export function eloDelta(current: number, opponent: number, score: number): number {
  const expected = 1 / (1 + Math.pow(10, (opponent - current) / 400));
  return 32 * (score - expected);
}
export function goldDelta(myElo: number, opponentElo: number): number {
  const eloDiff = opponentElo - myElo;
  return Math.min(50, Math.max(5, Math.round(10 * (1 + Math.max(0, eloDiff) / 100))));
}
// ── XP / Level-System ────────────────────────────────────────────────────
export function xpToNextLevel(level: number): number { return 100 + level * 25; }
export function computeXpGain(won: boolean, myElo: number, opponentElos: number[]): number {
  const base = won ? 25 : 10;
  if (!won || !opponentElos.length) return base;
  const avgOpp = opponentElos.reduce((a, b) => a + b, 0) / opponentElos.length;
  const diff = avgOpp - myElo;
  const bonus = diff >= 100 ? Math.min(20, 15 + Math.round((diff - 100) / 50))
              : diff >= -50  ? 10
              : diff >= -150 ? Math.max(0, 5 + Math.round((diff + 50) / 20))
              : 0;
  return base + bonus;
}
export function applyXpGain(prof: { level?: number; xp?: number }, xpGained: number) {
  let level = typeof prof.level === "number" ? prof.level : 1;
  let xp = (typeof prof.xp === "number" ? prof.xp : 0) + xpGained;
  const levelsGained = [];
  while (xp >= xpToNextLevel(level)) { xp -= xpToNextLevel(level); level++; levelsGained.push(level); }
  return { level, xp, levelsGained };
}

// ── Bestenliste: Migrations-Dubletten ausblenden (v3.71.0) ───────────────
// Bis zu den auth-gebundenen Security-Rules war der Schluessel eines
// Ranglisten-Eintrags die localStorage-Profil-ID ("p_..."); seither ist es die
// Firebase-uid. Ein zurueckkehrender Spieler legt dadurch einen ZWEITEN Eintrag
// an — und den alten kann niemand mehr loeschen, weil die Rules Schreibzugriff
// nur noch auf den eigenen uid-Schluessel erlauben (auth.uid === $playerId).
// Deshalb wird der veraltete Eintrag nur noch AUSGEBLENDET.
export function isLegacyKey(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("p_");
}
// Ausgeblendet wird ein Alt-Eintrag NUR, wenn zum selben Namen bereits ein
// Eintrag im neuen Format existiert. Ohne diese Bedingung verschwaenden alle
// Spieler aus der Liste, die seit der Umstellung nicht mehr gespielt haben —
// direkt nach der Umstellung waere die Bestenliste schlagartig leer.
// Zwei verschiedene Personen mit gleichem Namen bleiben unberuehrt: beide
// haetten neue Schluessel, und neue Eintraege blendet diese Funktion nie aus.
export function dropMigratedDupes<T extends { id?: unknown; name?: unknown }>(entries: T[]): T[] {
  if (!Array.isArray(entries)) return [];
  const modern = new Set();
  for (const e of entries) {
    if (e && e.name && !isLegacyKey(e.id)) modern.add(e.name);
  }
  return entries.filter((e) => !(e && isLegacyKey(e.id) && modern.has(e.name)));
}
