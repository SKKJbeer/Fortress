// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
import { ROWS, COLS, WALL_OF, CASTLE_OF } from './const.js';

export function computeOutsideMap(g, player) {
  const ownWall = WALL_OF[player];
  const ownCastle = CASTLE_OF[player];
  const visited = new Uint8Array(ROWS * COLS);
  const stack = [];
  for (let c = 0; c < COLS; c++) {
    stack.push(c);
    stack.push((ROWS - 1) * COLS + c);
  }
  for (let r = 0; r < ROWS; r++) {
    stack.push(r * COLS);
    stack.push(r * COLS + COLS - 1);
  }
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    const v = g[r][c];
    if (v === ownWall || v === ownCastle) continue;
    visited[idx] = 1;
    if (r > 0) stack.push(idx - COLS);
    if (r < ROWS - 1) stack.push(idx + COLS);
    if (c > 0) stack.push(idx - 1);
    if (c < COLS - 1) stack.push(idx + 1);
    if (r > 0 && c > 0) stack.push(idx - COLS - 1);
    if (r > 0 && c < COLS - 1) stack.push(idx - COLS + 1);
    if (r < ROWS - 1 && c > 0) stack.push(idx + COLS - 1);
    if (r < ROWS - 1 && c < COLS - 1) stack.push(idx + COLS + 1);
  }
  return visited;
}
export function computeOutsideMapForCannons(g, player) {
  const ownWall = WALL_OF[player];
  const visited = new Uint8Array(ROWS * COLS);
  const stack = [];
  for (let c = 0; c < COLS; c++) {
    stack.push(c);
    stack.push((ROWS - 1) * COLS + c);
  }
  for (let r = 0; r < ROWS; r++) {
    stack.push(r * COLS);
    stack.push(r * COLS + COLS - 1);
  }
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    const v = g[r][c];
    if (v === ownWall) continue;
    visited[idx] = 1;
    if (r > 0) stack.push(idx - COLS);
    if (r < ROWS - 1) stack.push(idx + COLS);
    if (c > 0) stack.push(idx - 1);
    if (c < COLS - 1) stack.push(idx + 1);
    if (r > 0 && c > 0) stack.push(idx - COLS - 1);
    if (r > 0 && c < COLS - 1) stack.push(idx - COLS + 1);
    if (r < ROWS - 1 && c > 0) stack.push(idx + COLS - 1);
    if (r < ROWS - 1 && c < COLS - 1) stack.push(idx + COLS + 1);
  }
  return visited;
}
export function isObjectClosed(outsideMap, obj) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = obj.r + dr, c = obj.c + dc;
      if (r <= 0 || r >= ROWS - 1 || c <= 0 || c >= COLS - 1) return false;
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (outsideMap[nr * COLS + nc]) return false;
      }
    }
  }
  return true;
}
export function isCastleClosed(g, player, castle) {
  if (!castle) return true;
  return isObjectClosed(computeOutsideMap(g, player), castle);
}
export function closedCannons(g, player, cannonList) {
  const outside = computeOutsideMapForCannons(g, player);
  return cannonList.filter((cn) => isObjectClosed(outside, cn));
}
export const isCannonClosed = isObjectClosed;

// ── Leck-Pfad (v3.37.0, Tutorial-/Warnvisualisierung) ──────────────────
// Macht die Umschließungs-Regel SICHTBAR: kürzester Weg vom Burginneren
// durch die Lücke bis zum Feldrand (8-Richtungen, konsistent zum Flood-Fill;
// nur EIGENE Mauern blockieren). Liefert [[r,c], …] Burg→Rand oder null,
// wenn die Burg dicht ist. Kosten: eine BFS — nur bei Grid-Änderung rufen.
export function findLeakPath(g, player, castle) {
  if (!g || !castle) return null;
  const ownWall = WALL_OF[player];
  const start = castle.r * COLS + castle.c;
  const prev = new Int32Array(ROWS * COLS).fill(-2); // -2 = unbesucht, -1 = Start
  prev[start] = -1;
  const q = [start];
  let exit = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = q[qi];
    const r = (idx / COLS) | 0, c = idx - r * COLS;
    if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) { exit = idx; break; }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const nidx = nr * COLS + nc;
        if (prev[nidx] !== -2) continue;
        if (g[nr][nc] === ownWall) continue;
        prev[nidx] = idx;
        q.push(nidx);
      }
    }
  }
  if (exit < 0) return null; // dicht — kein Leck
  const path = [];
  for (let cur = exit; cur !== -1; cur = prev[cur]) path.push([(cur / COLS) | 0, cur - ((cur / COLS) | 0) * COLS]);
  path.reverse();
  return path;
}

// Lücken-Zellen (v3.37.1): die Zellen des Leck-Pfads, die an einer EIGENEN
// Mauer anliegen — das ist die "Mündung" des Lochs im Ring. Genau dort wird
// im Tutorial rot markiert, wo gebaut werden muss.
export function leakGapCells(g, player, path) {
  if (!g || !path) return [];
  const ownWall = WALL_OF[player];
  const out = [];
  for (const [r, c] of path) {
    let nearWall = false;
    for (let dr = -1; dr <= 1 && !nearWall; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (g[nr][nc] === ownWall) { nearWall = true; break; }
      }
    }
    if (nearWall) out.push([r, c]);
  }
  return out;
}
