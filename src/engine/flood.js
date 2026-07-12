// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
import { ROWS, COLS, WALL_OF, CASTLE_OF, EMPTY, RUBBLE, RUBBLE_C } from './const.js';

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

// Loch-Zellen (v3.37.3): GENAU die Zellen, die zugemauert werden müssen,
// damit die Burg dicht ist — als MINIMALER SCHNITT (Min-Vertex-Cut via
// Max-Flow) zwischen Burg und Feldrand im Passierbarkeits-Graphen.
// Ein 3er-Beschussloch liefert exakt seine 3 Zellen; baut der Spieler um,
// passt sich die Menge an. Nur bebaubare Zellen (leer/Trümmer) sind
// schneidbar (Kapazität 1); Burg/Kanonen/Gegner-Mauern sind passierbar,
// aber nicht bebaubar (Kapazität ∞ → der Schnitt umgeht sie).
// Ohne eigenen Mauerring in Burg-Nähe: leere Liste (nur die Leck-Spur) —
// eine Markierung ohne Ring hätte keinen Lehrwert. maxCells deckelt den
// Aufwand (größerer Schnitt → keine Markierung).
export function findSealCells(g, player, castle, maxCells = 12) {
  if (!g || !castle) return [];
  const ownWall = WALL_OF[player];
  // Ring-Nähe-Check: ohne eigene Mauern im Umkreis nichts markieren
  let anyWall = false;
  for (let r = Math.max(0, castle.r - 12); r <= Math.min(ROWS - 1, castle.r + 12) && !anyWall; r++)
    for (let c = Math.max(0, castle.c - 12); c <= Math.min(COLS - 1, castle.c + 12); c++)
      if (g[r][c] === ownWall) { anyWall = true; break; }
  if (!anyWall) return [];
  if (!findLeakPath(g, player, castle)) return []; // schon dicht

  // Knoten: Zelle idx → in=2*idx, out=2*idx+1; Super-Senke = 2*N.
  const N = ROWS * COLS;
  const SINK = 2 * N;
  const INF = 1e9;
  // Kompakte Kantenlisten (Dinic): to[], cap[], next[], head[]
  const head = new Int32Array(2 * N + 1).fill(-1);
  const to = [], cap = [], nxt = [];
  const addEdge = (u, v, c) => {
    to.push(v); cap.push(c); nxt.push(head[u]); head[u] = to.length - 1;
    to.push(u); cap.push(0); nxt.push(head[v]); head[v] = to.length - 1;
  };
  const passable = (r, c) => g[r][c] !== ownWall;
  const buildable = (r, c) => { const v = g[r][c]; return v === EMPTY || v === RUBBLE || v === RUBBLE_C; };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!passable(r, c)) continue;
      const idx = r * COLS + c;
      addEdge(2 * idx, 2 * idx + 1, buildable(r, c) ? 1 : INF);
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) addEdge(2 * idx + 1, SINK, INF);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || !passable(nr, nc)) continue;
          addEdge(2 * idx + 1, 2 * (nr * COLS + nc), INF);
        }
      }
    }
  }
  const SRC = 2 * (castle.r * COLS + castle.c) + 1; // Burg ist nie schneidbar
  // Dinic: BFS-Level + DFS-Blocking-Flow; Fluss ist klein (≤ maxCells+1)
  const level = new Int32Array(2 * N + 1);
  const iter = new Int32Array(2 * N + 1);
  const bfs = () => {
    level.fill(-1);
    const q = [SRC];
    level[SRC] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi];
      for (let e = head[u]; e !== -1; e = nxt[e]) {
        if (cap[e] > 0 && level[to[e]] < 0) { level[to[e]] = level[u] + 1; q.push(to[e]); }
      }
    }
    return level[SINK] >= 0;
  };
  const dfs = (u, f) => {
    if (u === SINK) return f;
    for (; iter[u] !== -1; iter[u] = nxt[iter[u]]) {
      const e = iter[u], v = to[e];
      if (cap[e] > 0 && level[v] === level[u] + 1) {
        const d = dfs(v, Math.min(f, cap[e]));
        if (d > 0) { cap[e] -= d; cap[e ^ 1] += d; return d; }
      }
    }
    return 0;
  };
  let flow = 0;
  while (bfs()) {
    for (let i = 0; i <= 2 * N; i++) iter[i] = head[i];
    let f;
    while ((f = dfs(SRC, INF)) > 0) {
      flow += f;
      if (flow > maxCells) return []; // Schnitt zu groß → keine Markierung
    }
  }
  // Min-Cut, SENKEN-seitig extrahiert (v3.37.3): Min-Cuts sind nicht eindeutig
  // — die quellseitige Variante fände die innerste Schnittlinie (direkt an der
  // Burg). Wir wollen die ÄUSSERSTE = das Loch in der Mauerlinie selbst
  // („nur nach außen"). X = Knoten mit Restpfad zur Senke (Rückwärts-BFS über
  // Residualkanten); geschnittene Zelle = out ∈ X, in ∉ X.
  const vis = new Uint8Array(2 * N + 1);
  const q2 = [SINK];
  vis[SINK] = 1;
  for (let qi = 0; qi < q2.length; qi++) {
    const v = q2[qi];
    for (let f = head[v]; f !== -1; f = nxt[f]) {
      // Kante f: v→w; ihre Rückkante f^1: w→v. Residual w→v existiert, wenn
      // cap[f^1] > 0 → w kann die Senke (über v) erreichen.
      const w = to[f];
      if (cap[f ^ 1] > 0 && !vis[w]) { vis[w] = 1; q2.push(w); }
    }
  }
  const seal = [];
  for (let idx = 0; idx < N; idx++) {
    if (vis[2 * idx + 1] && !vis[2 * idx]) seal.push([(idx / COLS) | 0, idx % COLS]);
  }
  return seal;
}
