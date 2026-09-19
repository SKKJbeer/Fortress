// Stack & Siege — Spielcode.
//
// Bis v3.77.0 lag dieser Block als 9.900-Zeilen-Skript INLINE in index.html.
// Das war der groesste Hemmschuh der Weiterentwicklung: keine parallele Arbeit
// (CLAUDE.md musste ausdruecklich "immer nur EINE Session an index.html"
// vorschreiben), kein brauchbarer Diff, keine Werkzeugunterstuetzung.
//
// Der Inhalt ist beim Herausloesen UNVERAENDERT geblieben — nur die
// Importpfade wurden angezogen. Zerlegt wird von hier aus schrittweise nach
// aussen (ARCHITEKTUR.md, "Wie der Grossblock zerfaellt"), jeder Schritt unter
// laufendem Test.
// React kommt aus node_modules statt vom CDN (Architektur E3). Die beiden
// Bezeichner heissen bewusst weiter React/ReactDOM: so bleiben alle 543
// React.createElement-Aufrufe und der createRoot-Aufruf unveraendert gueltig,
// ohne 10.000 Zeilen anzufassen.
import React from "react";
import * as ReactDOM from "react-dom/client";
import { CELL, COLS, ROWS_HALF, ROWS, W, H, BUILD_TIME, SHOOT_TIME, CANNON_TIME, SETUP_TIME, CANNON_HP, RELOAD_MS, KILL_BLAST, SLAYER_DMG, FAN_SPREAD, FAN_CHANCE, GRAV, EMPTY, WALL1, WALL2, CANNON1, CANNON2, RUBBLE, CASTLE1, CASTLE2, RIVER, MOUNTAIN, WALL3, CANNON3, CASTLE3, RUBBLE_C, WALL_OF, CANNON_OF, CASTLE_OF, CASTLE_P1, CASTLE_P2, C1, C2 } from '../engine/const.ts';
import { SCRAP_WALL, SCRAP_CANNON, SCRAP_SURVIVE, SCRAP_REBUILD, SHOP } from '../engine/economy.ts';
const SHOP_SLAYER = SHOP.slayer.price;
const SALVO_LOCK_MS = 2600;   // Umruestzeit nach einem Wechsel der Kanonenart
import { makeRng, castle3Positions, WORLD_THEMES, worldThemeOf, generateTerrainFromSeed, generateTerrain, generateTerrain3FromSeed, sectorOf, buildSectorMap, isBuildable, sectorFingerprint } from '../engine/terrain.ts';
import { computeOutsideMap, computeOutsideMapForCannons, isObjectClosed, isCastleClosed, closedCannons, isCannonClosed, findLeakPath, findSealCells } from '../engine/flood.ts';
import { getLevelTier, eloDelta, goldDelta, xpToNextLevel, computeXpGain, applyXpGain, dropMigratedDupes } from '../engine/progression.ts';
import { normalisiereProfil } from '../engine/profil.ts';
import { BOT_LEVELS, BOT_NAMES, BOT_WAPPEN } from '../engine/bot.ts';
import { SCHLUESSEL } from '../engine/speicher.ts';
import { DAILY_REWARDS, DAILY_TASK_POOL, todayStr, msTillMidnight, getDailyCollectable, getDailyStreakIndex, dailyWeekMult, dailyReward, rollDailyTasks, taskDef } from '../engine/daily.ts';
import { mergeProfiles, cloudPayload, parseCloud } from '../engine/cloudsave.ts';
import { istNativ, kontoVerknuepfbar, vibriere, lupeNurInTextfeldern, textbedienung } from '../platform.ts';
import { COSMETICS, TRAIL_COLOR, WIN_ICON, FRAME_STYLE, cosOf, MAT_ORDER, MAT_META, matOf, craftbar, TASK_MAT, CANNON_SKIN, IMPACT_FX, MASTER_TRAIL, TRAIL_FORM, RECIPES, forgeRarity } from '../engine/catalog.ts';
import { LANGS } from '../i18n.js';
import { PROTO_VERSION, sanitizeState, sanitizeAction, EMOTES } from '../net/protocol.js';
import { MM_BASE_RADIUS, MM_GROWTH_PER_SEC, mmRadius, MM_TICK_MS, MM_HEARTBEAT_STALE_MS, MM_CLAIM_HEAL_MS, MM_GUEST_JOIN_TIMEOUT_MS, MM_BOT_BACKFILL_S, computeMatchGroup } from '../net/matchmaking.js';
import { ICON_PATHS, Icon } from '../ui/icons.js';
import { WAPPEN_SRC, WAPPEN, WAPPEN_GLOW, WAPPEN_MIGRATION, AVATAR_UNLOCKS } from '../ui/wappen.js';
import { LevelBadge, ConfettiBurst, WappenAvatar, XpBarUI, MatPip, MatRow } from '../ui/anzeigen.js';
import { WinFx, AchievementPopup, AchievementsModal, ItemRevealModal, XpResultAnim, OnboardingModal, DailyRewardModal } from '../ui/modale.js';
import { drawWall, drawRubble, ROOF_OF, FLAG_OF, ACCENT_OF, ACCENT_RGB, GHOST_RGB, GHOST_HEX, BALL_MID, BALL_DARK, BALL_GLOW, ballSprite, drawCastle, roundRectPath, SPR, mkSpriteCanvas, wallSprite, crackSprite, rubbleSprite, CANNON_NEON, cannonDomeSprite, BARREL_PAD, cannonBarrelSprite, drawCannonFull } from '../render/sprites.js';
import { __spreadValues, __spreadProps } from '../spread.js';
import { SFX, MUSIC } from '../audio.js';
import { GameEventBus, GAME_EVENTS, ACHIEVEMENTS, ACH_EN, processAchievementEvents } from '../engine/achievements.js';
import { SHADOW_DX, SHADOW_DY, SHAPES, rotateCW, randomShape } from '../engine/shapes.js';
const { useState, useEffect, useRef, useCallback } = React;
// ── Sound & Haptik (v3.28.0): echte CC0-Samples (Kenney.nl + OpenGameArt, Public
// Domain) via Web Audio Buffer. Prozedurale Töne bleiben als Fallback, bis die
// Samples geladen/dekodiert sind (oder falls der Codec fehlt, z. B. Headless-Tests).
// Dateien in sounds/*.mp3 (mono, -16 LUFS, ~88 KB gesamt), SW-precached → offline/TWA-tauglich. ──
const FB_URL = "https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app";
const FB_CONFIG = {
  databaseURL: "https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fortress-cbe30"
};
const MP_CONFIGURED = FB_URL.startsWith("https://") && FB_URL.includes("firebasedatabase");
const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
// Geräte-stabile ID (v3.14.12): überlebt Reloads/App-Neustarts. Verhindert
// Selbst-Matches im Matchmaking — die SESSION_ID ändert sich bei jedem Laden,
// die Profil-ID existiert bei Erstspielern evtl. noch nicht. Nur die DEVICE_ID
// identifiziert eigene (auch verwaiste) Queue-Tickets zuverlässig.
const DEVICE_ID = (() => {
  try {
    let d = localStorage.getItem("fortress_device_id");
    if (!d) {
      d = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("fortress_device_id", d);
    }
    return d;
  } catch (e) { return SESSION_ID; }
})();
const MAX_STATE_BYTES = 15e4;
let _fbError = "";
/** Letzte Firebase-Fehlermeldung, damit die Oberflaeche sie zeigen kann. */
function fbFehler() { return _fbError || ""; }
let _pushCount = 0;
let _pushWindow = 0;
function sdk() {
  return typeof window !== "undefined" && window.__fb ? window.__fb : null;
}
// Auth-UID der anonymen Firebase-Session (null wenn Auth nicht aktiv/verfügbar).
function authUid() {
  const s = sdk();
  return s && s.uid ? s.uid : null;
}
// Schreib-Schlüssel für identitätsgebundene Nodes (Leaderboard): bevorzugt die
// Auth-UID, fällt sonst auf die lokale Profil-ID zurück (Übergangsphase ohne Rules).
function writeId(localId) {
  return authUid() || localId;
}
const fb = {
  // Einmalig Wert schreiben (PUT-Äquivalent)
  async set(path, data) {
    const s = sdk();
    if (!s) {
      _fbError = "SDK nicht geladen";
      return false;
    }
    try {
      const body = JSON.stringify(data);
      if (body.length > MAX_STATE_BYTES) {
        _fbError = "State zu gro\xDF";
        return false;
      }
      await s.set(s.ref(s.db, path), data);
      return true;
    } catch (e) {
      _fbError = e.message;
      return false;
    }
  },
  // Teilweise aktualisieren (PATCH-Äquivalent)
  async patch(path, data) {
    const s = sdk();
    if (!s) {
      _fbError = "SDK nicht geladen";
      return false;
    }
    try {
      const body = JSON.stringify(data);
      if (body.length > MAX_STATE_BYTES) {
        _fbError = "Payload zu gro\xDF";
        return false;
      }
      await s.update(s.ref(s.db, path), data);
      return true;
    } catch (e) {
      _fbError = e.message;
      return false;
    }
  },
  // Einmalig lesen
  async get(path) {
    const s = sdk();
    if (!s) {
      _fbError = "SDK nicht geladen";
      return null;
    }
    try {
      const snap = await s.get(s.ref(s.db, path));
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      _fbError = e.message;
      return null;
    }
  },
  // Löschen
  async delete(path) {
    const s = sdk();
    if (!s) return;
    try {
      await s.remove(s.ref(s.db, path));
    } catch (e) {
    }
  },
  // 🚀 ECHTES REALTIME: onValue-Subscription statt Polling
  // Liefert sofort bei jeder Änderung — kein Intervall, kein Lag.
  subscribe(path, onData) {
    const s = sdk();
    if (!s) {
      _fbError = "SDK nicht geladen";
      return { stop: () => {
      } };
    }
    const nodeRef = s.ref(s.db, path);
    // WICHTIG (v3.14.11): onValue() der modularen SDK gibt eine UNSUBSCRIBE-Funktion
    // zurück — off(ref,'value',unsub) matcht dagegen keinen registrierten Listener
    // und meldete NIE ab. Geister-Listener alter Spiele feuerten dann in neue
    // Sessions hinein ("2. Spiel kommt nicht zustande"). Immer unsub() nutzen.
    const unsub = s.onValue(nodeRef, (snap) => {
      const data = snap.exists() ? snap.val() : null;
      if (data) onData(data);
    }, (err) => {
      _fbError = err.message;
    });
    return { stop: () => {
      try {
        unsub();
      } catch (e) {
      }
    } };
  },
  // Atomare Slot-Reservierung per Transaktion. Schreibt joinData NUR wenn der
  // Slot noch leer ist. Gibt true zurück bei Erfolg, false wenn schon belegt.
  // Verhindert, dass zwei gleichzeitig beitretende Gäste denselben Slot bekommen.
  async reserve(path, joinData) {
    const s = sdk();
    if (!s || !s.runTransaction) {
      _fbError = "Transaktion nicht verf\xFCgbar";
      return false;
    }
    try {
      const res = await s.runTransaction(s.ref(s.db, path), (current) => {
        if (current != null) return;
        return joinData;
      });
      return !!(res && res.committed);
    } catch (e) {
      _fbError = e.message;
      return false;
    }
  },
  // Generische Transaktion. mutateFn(current) gibt den neuen Wert zurück,
  // oder undefined um abzubrechen. Gibt { committed, value } zurück.
  async transact(path, mutateFn) {
    const s = sdk();
    if (!s || !s.runTransaction) {
      _fbError = "Transaktion nicht verf\xFCgbar";
      return { committed: false, value: null };
    }
    try {
      const res = await s.runTransaction(s.ref(s.db, path), mutateFn);
      return { committed: !!(res && res.committed), value: res ? res.snapshot.val() : null };
    } catch (e) {
      _fbError = e.message;
      return { committed: false, value: null };
    }
  },
  // Wie subscribe, aber liefert AUCH den Null-/Gelöscht-Fall an den Consumer:
  // onData(data, exists). Nötig um zu erkennen, wenn der Host den Spielknoten löscht.
  subscribeRaw(path, onData) {
    const s = sdk();
    if (!s) {
      _fbError = "SDK nicht geladen";
      return { stop: () => {} };
    }
    const nodeRef = s.ref(s.db, path);
    // Siehe subscribe(): onValue() liefert die Unsubscribe-Funktion (v3.14.11).
    const unsub = s.onValue(nodeRef, (snap) => {
      const exists = snap.exists();
      onData(exists ? snap.val() : null, exists);
    }, (err) => { _fbError = err.message; });
    return { stop: () => { try { unsub(); } catch (e) {} } };
  },
  // Echter Verbindungsstatus des SDK (v3.70.0). Nötig für den Herzschlag:
  // Ist die EIGENE Leitung weg, sehen fremde Herzschläge zwangsläufig tot aus —
  // ohne diese Gegenprobe würde der Host bei einem eigenen Netz-Aussetzer den
  // Gast rauswerfen. `.info/connected` ist ein lokaler Pseudo-Knoten des SDK,
  // kostet keine Bandbreite und ist auch im Spark-Plan verfügbar.
  subscribeConnected(onChange) {
    const s = sdk();
    if (!s) return { stop: () => {} };
    try {
      const unsub = s.onValue(s.ref(s.db, ".info/connected"), (snap) => onChange(snap.val() === true));
      return { stop: () => { try { unsub(); } catch (e) {} } };
    } catch (e) { return { stop: () => {} }; }
  },
  // Registriert serverseitiges Auto-Löschen falls die Verbindung abbricht
  // (Tab geschlossen, Crash, Netzwerkausfall) — ohne Cloud Functions.
  // Gibt eine Cancel-Funktion zurück.
  onDisconnectRemove(path) {
    const s = sdk();
    if (!s || !s.onDisconnect) return () => {
    };
    try {
      const dc = s.onDisconnect(s.ref(s.db, path));
      dc.remove();
      return () => {
        try {
          dc.cancel();
        } catch (e) {
        }
      };
    } catch (e) {
      return () => {
      };
    }
  }
};
async function getFirebase() {
  if (!MP_CONFIGURED) {
    _fbError = "Firebase-URL fehlt";
    return null;
  }
  let s = sdk();
  if (!s) {
    for (let i = 0; i < 30 && !s; i++) {
      await new Promise((r) => setTimeout(r, 100));
      s = sdk();
    }
  }
  if (!s) {
    _fbError = typeof window !== "undefined" && window.__fbError ? "Firebase-Fehler: " + window.__fbError : "Firebase SDK konnte nicht geladen werden (Internet?)";
    return null;
  }
  // Auf anonyme Auth warten (best effort, max ~3s) — nötig sobald die auth-gebundenen
  // Rules aktiv sind. Bricht SOFORT ab sobald der Login fehlschlägt (__fbAuthError),
  // damit es ohne aktivierte Anon-Auth KEINE 3s-Verzögerung gibt. Ist Auth nicht aktiv,
  // bleibt uid null und wir fahren mit den offenen Rules der Übergangsphase fort.
  if (s.auth && !s.uid) {
    for (let i = 0; i < 30 && !s.uid && !(typeof window !== "undefined" && window.__fbAuthError); i++)
      await new Promise((r) => setTimeout(r, 100));
  }
  try {
    await s.set(s.ref(s.db, "games/ping"), { createdAt: Date.now() });
    s.remove(s.ref(s.db, "games/ping"));
    _fbError = "";
    return fb;
  } catch (e) {
    _fbError = e.message;
    return null;
  }
}
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
// Bot-Namen (v3.14.16): pro Bot-Spiel wird zufällig einer gezogen.
// Burgen-/Belagerungs-Fantasy mit Augenzwinkern.
// ── Premium-Shop-Design (v3.17.0): pro Upgrade eine Farbwelt + maßgeschneidertes
// SVG-Icon (kein Emoji). Rein optisch — Preise/Mechanik unverändert.
const SHOP_THEME = {
  cannon: { c1: "#7dd3fc", c2: "#2563eb", c3: "#0b2a6b", glow: "96,165,250" },
  reload: { c1: "#fde68a", c2: "#f59e0b", c3: "#7c3d06", glow: "251,191,36" },
  armor:  { c1: "#ddd6fe", c2: "#8b5cf6", c3: "#4c1d95", glow: "167,139,250" },
  repair: { c1: "#a7f3d0", c2: "#10b981", c3: "#065f46", glow: "52,211,153" },
  // Kanonen-Bezwinger (v3.57.0): violette Farbwelt, klar von der blauen
  // Standardkanone unterschieden — die Farbe wiederholt sich im Feld-Aufsatz.
  slayer: { c1: "#e9d5ff", c2: "#7c3aed", c3: "#3b0764", glow: "167,139,250" }
};
const SHOP_ICONS = {
  cannon: '<svg viewBox="0 0 24 24" width="21" height="21" style="display:block"><circle cx="10.4" cy="14.4" r="6.9" fill="#fff"/><rect x="8.7" y="6.1" width="3.3" height="2.7" rx="0.7" fill="#fff"/><path d="M12.4 6.3 q2.9-2.7 4.9-0.6" stroke="#fde68a" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="17.6" cy="4.5" r="2" fill="#fde68a"/><circle cx="17.6" cy="4.5" r="0.9" fill="#f59e0b"/><circle cx="7.8" cy="11.9" r="2.2" fill="rgba(0,0,0,0.10)"/></svg>',
  reload: '<svg viewBox="0 0 24 24" width="21" height="21" style="display:block"><path fill="#fff" d="M12.4 2 L4.8 13 a0.9 0.9 0 0 0 0.74 1.42 H9.6 l-1.3 6.9 a0.55 0.55 0 0 0 0.98 0.43 L18.9 10.4 a0.9 0.9 0 0 0-0.72-1.44 H13.9 l1.35-6.2 A0.62 0.62 0 0 0 12.4 2 z"/></svg>',
  armor:  '<svg viewBox="0 0 24 24" width="21" height="21" style="display:block"><path fill="#fff" d="M12 2.2 L20 5.1 v5.7 c0 5-3.4 8.4-8 11 -4.6-2.6-8-6-8-11 V5.1 z"/><path fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M8.4 12.1 l2.5 2.5 4.7-5"/></svg>',
  repair: '<svg viewBox="0 0 24 24" width="21" height="21" style="display:block"><path fill="#fff" d="M20.9 6 a4.1 4.1 0 0 1-5.15 5.15 L8.2 18.7 a1.95 1.95 0 0 1-2.76-2.76 L13 8.4 A4.1 4.1 0 0 1 18.15 3.25 L15.5 5.9 a1.25 1.25 0 0 0 1.77 1.77 z"/></svg>',
  slayer: '<svg viewBox="0 0 24 24" width="21" height="21" style="display:block"><circle cx="12" cy="12" r="8.4" fill="none" stroke="#fff" stroke-width="1.7"/><path d="M12 1.6v3.6M12 18.8v3.6M1.6 12h3.6M18.8 12h3.6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="3.4" fill="#fff"/><circle cx="12" cy="12" r="1.5" fill="#7c3aed"/></svg>'
};
const PHASE_BANNERS = {
  setup:  { title: "SPIELSTART",  sub: "Platziere 2 Kanonen rund um deine Burg", color: "#38bdf8", bg: "rgba(2,32,64,0.95)",  glow: "rgba(56,189,248,0.5)"  },
  build:  { title: "BAUPHASE",    sub: "Mauere deine Burg l\xFCckenlos ein!",     color: "#4ade80", bg: "rgba(2,40,15,0.95)",  glow: "rgba(74,222,128,0.5)"  },
  shoot:  { title: "FEUER FREI!", sub: "Zieh von deiner Burg weg zum Zielen",  color: "#f87171", bg: "rgba(60,4,4,0.95)",   glow: "rgba(239,68,68,0.5)"   },
  cannon: { title: "R\xDCSTPHASE", sub: "Kaufe Upgrades im Shop — Beute gibt es f\xFCrs Zerst\xF6ren",  color: "#fbbf24", bg: "rgba(48,30,2,0.95)",  glow: "rgba(245,158,11,0.5)"  },
};
// ── Game Event Bus ─────────────────────────────────────────────
window.StackSiegeApp = function StackSiegeApp() {
  var _a, _b;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const scoreBarRef = useRef(null);
  const row3Ref = useRef(null);
  const bottomBarRef = useRef(null);
  const [screen, setScreen] = useState("menu");
  const [phase, setPhase] = useState("build");
  const [timer, setTimer] = useState(BUILD_TIME);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ 1: 0, 2: 0, 3: 0 });
  const [resultInfo, setResultInfo] = useState(null);
  // `top` = gemessene Hoehe der Kopfzeile (bei 3 Spielern zwei Reihen). Alle
  // ueberlagerten Meldungen haengen sich daran statt an eine geratene Zahl —
  // vorher stand 52 an sieben Stellen, und bei drei Spielern stimmte keine davon.
  const [viewSize, setViewSize] = useState({ w: W, h: H, bar: 52, top: 52, voll: W, tablett: false });
  const [warn, setWarn] = useState(null);
  const warnTimer = useRef(null);
  const [phaseBanner, setPhaseBanner] = useState(null);
  const phaseBannerTimer = useRef(null);
  const phaseBannerKey = useRef(0);
  const bannerActive = useRef(false);
  const [, setUiTick] = useState(0);
  const [numPlayers, setNumPlayers] = useState(2);
  const numPlayersRef = useRef(2);
  const playersList = () => numPlayersRef.current === 3 ? [1, 2, 3] : [1, 2];
  const [lang, setLang] = React.useState(() => {
    try {
      const stored = localStorage.getItem('fortress_lang');
      if (stored) return stored;
      // Erststart: Gerätesprache erkennen (nicht stur Deutsch). de → Deutsch, sonst Englisch.
      const nav = ((typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en').toLowerCase();
      return nav.startsWith('de') ? 'de' : 'en';
    } catch (e) { return 'de'; }
  });
  React.useEffect(() => { localStorage.setItem('fortress_lang', lang); }, [lang]);
  const t = (key, vars = {}) => {
    const str = (LANGS[lang] && LANGS[lang][key]) || (LANGS.de[key]) || key;
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? String(vars[k]) : '{' + k + '}');
  };
  // Achievement-Texte übersetzen (DE = Array-Fallback, EN aus ACH_EN-Map)
  const achTitle = (def) => (lang === 'en' && ACH_EN[def.id]) ? ACH_EN[def.id].t : def.title;
  const achDesc  = (def) => (lang === 'en' && ACH_EN[def.id]) ? ACH_EN[def.id].d : def.desc;
  function loadDailyState() {
    try { return JSON.parse(localStorage.getItem('fortress_daily')) || {}; } catch { return {}; }
  }
  function saveDailyState(d) {
    try { localStorage.setItem('fortress_daily', JSON.stringify(d)); } catch (e) {}
  }
  function loadTasksState() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem("fortress_tasks")); } catch (e) {}
    const day = todayStr();
    if (!st || st.day !== day || !Array.isArray(st.tasks)) {
      st = { day, tasks: rollDailyTasks(day) };
      saveTasksState(st); // sofort persistieren — ein Tag = eine stabile Rotation
    }
    return st;
  }
  function saveTasksState(st) { try { localStorage.setItem("fortress_tasks", JSON.stringify(st)); } catch (e) {} }
  const PROFILE_COLORS = [    { name: "Blau", hex: "#2563eb" },
    { name: "Rot", hex: "#dc2626" },
    { name: "Gr\xFCn", hex: "#059669" },
    { name: "Lila", hex: "#7c3aed" },
    { name: "Orange", hex: "#ea580c" },
    { name: "Gold", hex: "#ca8a04" },
    { name: "T\xFCrkis", hex: "#0891b2" },
    { name: "Pink", hex: "#db2777" }
  ];
  // Duenne Huelle: Lesen, Normalisieren, bei Bedarf zurueckschreiben.
  // Das Normalisieren steht seit v3.100.0 in `engine/profil.ts` und ist dort
  // durchgeprueft — es entscheidet, ob gekaufte Gegenstaende ein Neuladen
  // ueberleben.
  function loadProfile() {
    try {
      const raw = localStorage.getItem(SCHLUESSEL.profil);
      if (!raw) return null;
      const erg = normalisiereProfil(JSON.parse(raw),
        { migration: WAPPEN_MIGRATION, vorhanden: WAPPEN_SRC });
      if (!erg) return null;
      if (erg.mussSpeichern) {
        try { localStorage.setItem(SCHLUESSEL.profil, JSON.stringify(erg.profil)); } catch (e) {}
      }
      return erg.profil;
    } catch (e) {
      return null;
    }
  }
  const profileRef = React.useRef(null); // always holds latest profile
  const [profile, setProfile] = useState(() => loadProfile());
  profileRef.current = profile;
  function saveProfile(p) {
    try {
      localStorage.setItem("fortress_profile", JSON.stringify(p));
    } catch (e) {
    }
    setProfile(p);
    cloudPush(p);
  }
  // ── Cloud-Save (v3.72.0) ──────────────────────────────────────────────
  // Der Fortschritt lag bis v3.71.0 ausschliesslich im localStorage — eine
  // Neuinstallation loeschte ELO, Gold, Level, Achievements UND gekaufte
  // Kosmetik ohne jede Wiederherstellung.
  //
  // Stufe 1 haengt das Profil an die anonyme uid: ueberlebt App-Updates und
  // geloeschte Browser-Caches, aber KEINE Neuinstallation (die uid ist dann
  // auch weg). Stufe 2 (Google verknuepfen, `linkAccount`) macht die uid
  // dauerhaft — erst damit ueberlebt der Stand Geraetewechsel.
  const cloudTimer = useRef(null);
  const cloudPending = useRef(null);
  const cloudSyncedFor = useRef(null);   // uid, fuer die schon gelesen wurde
  const cloudLastSent = useRef("");
  const [cloudState, setCloudState] = useState("idle"); // idle|syncing|saved|error
  function cloudPush(p) {
    if (!MP_CONFIGURED || !p) return;
    cloudPending.current = p;
    if (cloudTimer.current) return;
    // Gedrosselt: der Ergebnis-Screen speichert mehrfach kurz hintereinander
    // (Stats, Achievements, Tasks) — das waeren sonst vier Schreibvorgaenge.
    cloudTimer.current = setTimeout(async () => {
      cloudTimer.current = null;
      const prof2 = cloudPending.current;
      cloudPending.current = null;
      const uid = authUid();
      if (!uid || !prof2) return;
      const rec = cloudPayload(prof2, Date.now());
      if (!rec) return;
      // Unveraenderte Staende nicht erneut hochladen (updatedAt ausgenommen).
      const sig = rec.p;
      if (sig === cloudLastSent.current) return;
      const ok = await fb.set(`players/${uid}`, rec);
      if (ok !== false) { cloudLastSent.current = sig; setCloudState("saved"); }
      else setCloudState("error");
    }, 2500);
  }
  // Beim Start (und nach jedem Auth-Wechsel) den Cloud-Stand holen und mit dem
  // lokalen zusammenfuehren. Nach einer Neuinstallation ist der lokale Stand
  // leer — mergeProfiles holt dann alles zurueck.
  async function cloudPull() {
    const uid = authUid();
    if (!MP_CONFIGURED || !uid) return;
    if (cloudSyncedFor.current === uid) return;
    cloudSyncedFor.current = uid;
    setCloudState("syncing");
    try {
      const rec = await fb.get(`players/${uid}`);
      const remote = parseCloud(rec);
      const local = profileRef.current;
      if (!remote) {
        // Erster Sync auf diesem Konto: lokalen Stand hochladen.
        if (local) { cloudLastSent.current = ""; cloudPush(local); }
        setCloudState("saved");
        return;
      }
      const merged = mergeProfiles(local, remote);
      if (!merged) { setCloudState("error"); return; }
      merged.id = (local && local.id) || merged.id;
      cloudLastSent.current = "";
      saveProfile(merged);            // schreibt lokal UND stoesst den Push an
      setCloudState("saved");
    } catch (e) {
      setCloudState("error");
    }
  }
  // Fortschritt vollstaendig loeschen (v3.76.0). Apple verlangt das, sobald
  // eine App Konten anlegt (5.1.1(v)) — und es gehoert ohnehin zum Cloud-Save:
  // wer Daten in die Wolke legt, muss sie auch wieder herausbekommen.
  // Geloescht wird BEIDES: der Serverdatensatz und der lokale Stand. Nur eins
  // von beidem waere schlimmer als nichts, weil der jeweils andere ihn beim
  // naechsten Sync wiederherstellen wuerde.
  const [confirmWipe, setConfirmWipe] = useState(false);
  async function wipeProgress() {
    const uid = authUid();
    // BEIDE Serverspuren entfernen (v3.78.1). Der Bestaetigungstext verspricht
    // Loeschung "auf diesem Geraet UND in der Wolke" — der Ranglisten-Eintrag
    // blieb aber stehen, mit Name und Wertung oeffentlich sichtbar. Ein
    // Versprechen, das nur halb eingeloest wird, ist schlimmer als keines.
    // Der Ranglisten-Schluessel folgt writeId(): auth.uid, sonst die lokale
    // Profil-ID. Beide Faelle abdecken, sonst bleibt je nach Anmeldezustand
    // eine Spur zurueck.
    const lokaleId = profileRef.current && profileRef.current.id;
    const serverPfade = [
      uid && `players/${uid}`,
      ...[uid, lokaleId].filter((v, i, a) => v && a.indexOf(v) === i).map((k) => `leaderboard/${k}`)
    ].filter(Boolean);
    // Die Serverloeschung darf den Vorgang NICHT aufhalten. Ohne Zeitgrenze
    // haengt bei fehlendem Netz das `await` — und der Nutzer tippt auf
    // "loeschen", worauf sichtbar nichts passiert, weil auch das Neuladen
    // unten nie erreicht wird. Der lokale Stand MUSS in jedem Fall weg.
    await Promise.race([
      Promise.all(serverPfade.map((pfad) => fb.delete(pfad).catch(() => {}))),
      new Promise((r) => setTimeout(r, 4000))
    ]).catch(() => {});
    cloudSyncedFor.current = null;      // sonst laedt cloudPull nie wieder
    cloudLastSent.current = "";
    cloudPending.current = null;
    if (cloudTimer.current) { clearTimeout(cloudTimer.current); cloudTimer.current = null; }
    try {
      for (const k of ["fortress_profile", "fortress_daily", "fortress_tasks",
                       "fortress_ach_seen", "fortress_onboarded", "fortress_tutorial_done"]) {
        localStorage.removeItem(k);
      }
    } catch (e) {}
    setConfirmWipe(false);
    setShowProfileEditor(false);
    // Neu laden statt den Zustand von Hand zurueckzusetzen: das Spiel haelt
    // seinen Fortschritt in Dutzenden Refs, und ein uebersehener waere genau
    // der Fehler, den man erst Wochen spaeter bemerkt.
    try { location.reload(); } catch (e) {}
  }
  // Stufe 2: Google-Konto verknuepfen. REDIRECT, nie Popup — ein Auth-Popup
  // bricht in der TWA (siehe CLAUDE.md, Store-Vorbereitung).
  async function linkAccount() {
    const F = window.__fb;
    if (!F || !F.auth || !F.GoogleAuthProvider) return;
    try {
      const prov = new F.GoogleAuthProvider();
      const user = F.auth.currentUser;
      if (user && user.isAnonymous) await F.linkWithRedirect(user, prov);
      else await F.signInWithRedirect(F.auth, prov);
    } catch (e) {
      window.__fbLinkError = e && (e.code || e.message);
      setCloudState("error");
    }
  }
  function recordResult(won, mode) {
    if (!profile) return;
    const m3 = mode === 3;
    const key = m3 ? "stats3" : "stats";
    const eloKey = m3 ? "elo3" : "elo";
    const cur = profile[key] || { wins: 0, losses: 0, games: 0 };
    const bucket = __spreadProps(__spreadValues({}, cur), { games: cur.games + 1 });
    const score = won === true ? 1 : won === null ? 0.5 : 0;
    if (won === true) bucket.wins += 1;
    else if (won === false) bucket.losses += 1;
    const myElo = typeof profile[eloKey] === "number" ? profile[eloKey] : 1e3;
    const opponents = playersList().filter((p) => p !== myRole.current).map((p) => {
      var _a2;
      return typeof ((_a2 = playerInfo.current[p]) == null ? void 0 : _a2.elo) === "number" ? playerInfo.current[p].elo : 1e3;
    });
    let newElo = myElo;
    if (opponents.length) {
      const avgDelta = opponents.reduce((sum, opp) => sum + eloDelta(myElo, opp, score), 0) / opponents.length;
      newElo = Math.round(myElo + avgDelta);
    }
    eloChangeRef.current = { oldElo: myElo, newElo, delta: newElo - myElo };
    const peakEloKey = m3 ? "peakElo3" : "peakElo";
    const curPeak = typeof profile[peakEloKey] === "number" ? profile[peakEloKey] : myElo;
    const newPeakElo = Math.max(newElo, curPeak);
    const oldGold = typeof profile.gold === "number" ? profile.gold : 100;
    const goldEarned = won === true && opponents.length
      ? Math.round(opponents.reduce((sum, opp) => sum + goldDelta(myElo, opp), 0) / opponents.length)
      : 0;
    const newGold = oldGold + goldEarned;
    goldChangeRef.current = { oldGold, newGold, delta: goldEarned };
    const xpGained = computeXpGain(won === true, myElo, opponents);
    const { level: newLevel, xp: newXp, levelsGained } = applyXpGain(profile, xpGained);
    xpChangeRef.current = { oldLevel: typeof profile.level === "number" ? profile.level : 1, newLevel, oldXp: typeof profile.xp === "number" ? profile.xp : 0, newXp, xpGained, levelsGained };
    // Win streak
    const prevStreak = typeof profile.winStreak === 'number' ? profile.winStreak : 0;
    const newWinStreak = won === true ? prevStreak + 1 : 0;
    // Lifetime gold
    const prevLifetimeGold = typeof profile.lifetimeGold === 'number' ? profile.lifetimeGold : 0;
    const newLifetimeGold = prevLifetimeGold + goldEarned;
    // Blocks destroyed accumulated from game — aus der Match-Statistik (v3.21.0).
    // Vorher zählte ein Host-only-Ref; Gäste bekamen 0. matchStats ist via
    // State-Sync auf allen Geräten identisch → zählt auch für Gäste korrekt.
    const meP = online.current ? (myRole.current || 1) : 1;
    const prevBlocks = typeof profile.blocksDestroyed === 'number' ? profile.blocksDestroyed : 0;
    const newBlocks = prevBlocks + ((matchStats.current[meP] || {}).walls || 0);
    // Schmiede-Materialien (v3.33.0): jedes Online-Match zahlt ein — Sieg mehr
    // als Niederlage (Retention), jede volle 3er-Siegesserie 1 Drachenstahl.
    const prevMats = matOf(profile);
    const matGain = {
      iron: won === true ? 5 : 2,
      silver: won === true ? 1 : 0,
      dragon: won === true && newWinStreak >= 3 && newWinStreak % 3 === 0 ? 1 : 0,
      star: 0
    };
    const newMats = { iron: prevMats.iron + matGain.iron, silver: prevMats.silver + matGain.silver, dragon: prevMats.dragon + matGain.dragon, star: prevMats.star };
    matChangeRef.current = matGain;
    const updated = __spreadProps(__spreadValues({}, profile), { [key]: bucket, [eloKey]: newElo, [peakEloKey]: newPeakElo, gold: newGold, level: newLevel, xp: newXp, winStreak: newWinStreak, lifetimeGold: newLifetimeGold, blocksDestroyed: newBlocks, materials: newMats });
    // Process achievements
    const achEvents = [
      { type: GAME_EVENTS.GAME_PLAYED },
      ...(won === true ? [{ type: GAME_EVENTS.GAME_WON }] : []),
      ...(goldEarned > 0 ? [{ type: GAME_EVENTS.GOLD_EARNED }] : []),
      { type: GAME_EVENTS.ELO_CHANGED },
      { type: GAME_EVENTS.WIN_STREAK_CHANGED }
    ];
    const achResult = processAchievementEvents(updated, achEvents);
    let finalProfile = __spreadProps(__spreadValues({}, updated), { achievements: achResult.achievements });
    if (achResult.xpGained > 0 || achResult.goldGained > 0) {
      const { level: aLvl, xp: aXp } = applyXpGain(finalProfile, achResult.xpGained);
      finalProfile = __spreadProps(__spreadValues({}, finalProfile), { level: aLvl, xp: aXp, gold: finalProfile.gold + achResult.goldGained });
    }
    if (achResult.newlyUnlocked.length > 0) {
      setAchievementQueue(function(prev) { return prev.concat(achResult.newlyUnlocked); });
      // Sternenstaub (v3.33.0): 1 pro frisch freigeschaltetem Achievement
      const fm = matOf(finalProfile);
      finalProfile = __spreadProps(__spreadValues({}, finalProfile), { materials: __spreadProps(__spreadValues({}, fm), { star: fm.star + achResult.newlyUnlocked.length }) });
      matChangeRef.current = __spreadProps(__spreadValues({}, matChangeRef.current || {}), { star: achResult.newlyUnlocked.length });
    }
    // Emit to event bus for future QuestManager
    GameEventBus.emit(GAME_EVENTS.GAME_PLAYED, { won: won, mode: mode });
    saveProfile(finalProfile);
    pushLeaderboard(finalProfile);
  }
  const [editName, setEditName] = useState("");
  const [editWappen, setEditWappen] = useState("\u2654");
  const [editColor, setEditColor] = useState("#2563eb");
  const [achievementQueue, setAchievementQueue] = React.useState([]);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  // Anzahl der Achievements, die der Spieler zuletzt gesehen hat (wie „gelesen"-Marker).
  const [achSeenCount, setAchSeenCount] = useState(() => { try { return parseInt(localStorage.getItem('fortress_ach_seen') || '0', 10) || 0; } catch (e) { return 0; } });
  function openAchievements() {
    const u = Array.isArray(profile && profile.achievements) ? profile.achievements.filter((a) => a.unlocked).length : 0;
    setAchSeenCount(u);
    try { localStorage.setItem('fortress_ach_seen', String(u)); } catch (e) {}
    setShowAchievements(true);
  }
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [showTutorialDone, setShowTutorialDone] = useState(false);
  const [showTutorialIntro, setShowTutorialIntro] = useState(false); // Ziel-Erklärung vor dem Tutorial (v3.37.0)
  // Pausierende Coach-Popups (v3.37.2): solange ein Popup offen ist, stehen
  // Timer, Bot und Kugeln still; "OK" setzt fort. Pro Phase wird jede
  // Popup-Variante nur einmal gezeigt (coachShownRef).
  const [coachMsg, setCoachMsg] = useState(null);
  const tutPausedRef = useRef(false);
  // Bildraten-Anzeige (v3.82.0): auf dem Geraet messen statt im Rechenzentrum
  // raten. Im Browser war die Zeichenzeit 1 ms und trotzdem nur die halbe
  // Bildrate — das lag an der Software-Rasterung ohne Grafikkarte und sagte
  // ueber ein Telefon nichts aus.
  const perfAn = useRef(false);
  const perfPuffer = useRef([]);
  const perfLetzt = useRef(0);
  const perfTipps = useRef([]);
  const [perfSichtbar, setPerfSichtbar] = useState(() => {
    try { return localStorage.getItem('fortress_perf') === '1'; } catch (e) { return false; }
  });
  useEffect(() => { perfAn.current = perfSichtbar; }, [perfSichtbar]);
  // Die Anzeige aktualisiert sich ZWEIMAL pro Sekunde, nicht pro Bild. Ein
  // React-Rendern je Bild waere selbst die Last, die hier gemessen werden soll.
  const [perfText, setPerfText] = useState("");
  useEffect(() => {
    if (!perfSichtbar) return;
    const id = setInterval(() => {
      const a = perfPuffer.current.slice().sort((x, y) => x - y);
      if (!a.length) return;
      const q = (pp) => a[Math.min(a.length - 1, Math.floor(a.length * pp))];
      const med = q(0.5);
      setPerfText(`${Math.round(1000 / med)} B/s · Median ${med.toFixed(1)} ms · p95 ${q(0.95).toFixed(1)} · max ${a[a.length - 1].toFixed(0)}`);
    }, 500);
    return () => clearInterval(id);
  }, [perfSichtbar]);
  const coachShownRef = useRef({});
  const leakPathRef = useRef({}); // Leck-Spur-Cache je Spieler (Key: gridVersion, v3.37.0)
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem('fortress_sound') !== '0'; } catch (e) { return true; } });
  const [musicOn, setMusicOn] = useState(() => { try { return localStorage.getItem('fortress_music') !== '0'; } catch (e) { return true; } });
  const [musicVol, setMusicVol] = useState(() => { try { const v = parseFloat(localStorage.getItem('fortress_music_vol')); return isNaN(v) ? 0.45 : Math.max(0, Math.min(1, v)); } catch (e) { return 0.45; } });
  useEffect(() => { MUSIC.setVolume(musicVol); try { localStorage.setItem('fortress_music_vol', String(musicVol)); } catch (e) {} }, [musicVol]);
  useEffect(() => { MUSIC.setEnabled(musicOn); try { localStorage.setItem('fortress_music', musicOn ? '1' : '0'); } catch (e) {} }, [musicOn]);
  // Track je Screen (v3.39.0): im Spiel die MUSIK DER AKTUELLEN WELT
  // (WORLD_THEMES[..].music via terrainSeed — deterministisch, online synchron);
  // phase als Dependency, damit neue Karten/Runden den Track nachziehen.
  useEffect(() => {
    if (screen === "game") {
      const wt = worldThemeOf(terrainSeed.current || 0);
      MUSIC.play((wt && wt.music) || "w_crystal");
    } else {
      MUSIC.play("menu");
    }
  }, [screen, phase]);
  const [hapticsOn, setHapticsOn] = useState(() => { try { return localStorage.getItem('fortress_haptics') !== '0'; } catch (e) { return true; } });
  useEffect(() => { SFX.enabled = soundOn; try { localStorage.setItem('fortress_sound', soundOn ? '1' : '0'); } catch (e) {} }, [soundOn]);
  useEffect(() => { SFX.haptics = hapticsOn; try { localStorage.setItem('fortress_haptics', hapticsOn ? '1' : '0'); } catch (e) {} }, [hapticsOn]);
  // AudioContext erst nach User-Geste starten (Browser-Autoplay-Policy)
  useEffect(() => {
    const r = () => { SFX.resume(); MUSIC.retry(); };
    window.addEventListener('pointerdown', r);
    // iOS: Context wird im Hintergrund suspendiert/interrupted → bei Rückkehr
    // in den Tab wieder anwerfen (v3.32.2).
    const v = () => { if (!document.hidden) SFX.resume(); };
    document.addEventListener('visibilitychange', v);
    // iOS-Lupe (v3.32.3, Härtung): CSS user-select reicht nicht immer — Safari
    // startet die Text-Lupe trotzdem gelegentlich per Long-Press. Textauswahl
    // und Kontextmenü hart unterbinden (Eingabefelder ausgenommen).
    const noSel = (e) => { const tg = e.target; if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return; e.preventDefault(); };
    document.addEventListener('selectstart', noSel);
    document.addEventListener('contextmenu', noSel);
    return () => { window.removeEventListener('pointerdown', r); document.removeEventListener('visibilitychange', v); document.removeEventListener('selectstart', noSel); document.removeEventListener('contextmenu', noSel); };
  }, []);
  // Gated Test-Hook (nur bei window.__mmDebug): Schrott gutschreiben, damit
  // Tests den echten Kauf-Flow im Shop deterministisch auslösen können.
  useEffect(() => {
    // Test-Hooks IMMER installieren, aber JEDE Funktion prüft zur Aufrufzeit
    // window.__mmDebug (kein Cheat in Produktion, da __mmDebug dort nie gesetzt).
    // So sind sie auch verfügbar, wenn __mmDebug erst mitten im Spiel gesetzt wird.
    if (typeof window === "undefined") return;
    const gated = (fn) => (...a) => window.__mmDebug ? fn(...a) : null;
    window.__grantScrap = gated((p, n) => { scrap.current[p] = (scrap.current[p] || 0) + n; setUiTick((t) => t + 1); return true; });
    window.__readScrap = gated((p) => scrap.current[p] || 0);
    window.__matchStats = gated((p) => JSON.parse(JSON.stringify(matchStats.current[p] || {})));
    window.__phase = gated(() => phase_r.current);
    // Wer wird gerade zum Zumauern gemahnt? Nur eigene Burgen duerfen hier
    // stehen — im Bot-Modus also nie die 2.
    window.__urgent = gated(() => Object.keys(urgentRef2.current).map(Number));
    // Testhilfen (v3.32.4): Bot-Backfill — Wartezeit vorspulen + Bot-Modus lesen
    window.__mmForceWait = gated((s) => { mmStartedAt.current = Date.now() - s * 1e3; return true; });
    window.__botMode = gated(() => botMode.current);
    // Testhilfe: eine fast gelandete Kugel von `shooter` auf eine Feindmauer
    window.__spawnBallAtEnemy = gated((shooter) => {
      const g = grid.current; if (!g) return null;
      const enemyWall = shooter === 1 ? WALL2 : WALL1;
      let tr = -1, tc = -1;
      for (let r = 0; r < ROWS && tr < 0; r++) for (let c = 0; c < COLS; c++) if (g[r][c] === enemyWall) { tr = r; tc = c; break; }
      if (tr < 0) return null;
      const before = scrap.current[shooter] || 0;
      balls.current.push({ sx: tc * CELL + CELL / 2, sy: (tr + 5) * CELL, tx: tc * CELL + CELL / 2, ty: tr * CELL + CELL / 2, prog: 0.8, dur: 18, arcH: 8, player: shooter, alive: true, cannonIndex: 0, trail: [] });
      return before;
    });
    // Testhilfe: Nachlauf jetzt starten (nur in echter Schussphase mit Kugeln)
    window.__setSettling = gated(() => {
      if (phase_r.current === "shoot" && balls.current.some((b) => b.alive)) { shootSettling.current = true; return true; }
      return false;
    });
    // Testhilfen für die „Fertig"-Bestätigung (v3.18.1)
    window.__readTimer = gated(() => timerVal.current);
    window.__readReady = gated(() => __spreadValues({}, armoryReady.current));
    window.__forceReady = gated((p) => { setArmoryReady(p); return true; });
    // Testhilfe: Reset-Hover-Zustand lesen (v3.18.2, Bottom-Placement-Fix)
    window.__cancelHover = gated((p) => !!cancelHover.current[p]);
    // Testhilfe: Kanonen-Kill auslösen (CANNON_HP Bälle auf eine Feindkanone)
    window.__testCannonKill = gated((shooter) => {
      const g = grid.current; if (!g) return null;
      const ep = shooter === 1 ? 2 : 1;
      const list = cannons.current[ep] || [];
      if (!list.length) return null;
      const cn = list[0];
      const before = scrap.current[shooter] || 0;
      // Seit v3.57.0 toeten NUR Bezwinger-Kugeln (kt:"slayer") Kanonen —
      // Mauerbrecher richten dort nichts aus. Der Testschuss muss also die
      // richtige Art tragen, sonst prueft er eine Wirkung, die es nicht gibt.
      const n = Math.ceil(CANNON_HP / SLAYER_DMG);
      for (let i = 0; i < n; i++) {
        balls.current.push({ sx: cn.c * CELL + CELL / 2, sy: (cn.r + 6) * CELL, tx: cn.c * CELL + CELL / 2, ty: cn.r * CELL + CELL / 2, prog: 0.8, dur: 16, arcH: 6, player: shooter, alive: true, cannonIndex: 0, kt: "slayer", trail: [] });
      }
      return { before, beforeCannons: list.length, hp: CANNON_HP, schuesse: n };
    });
    window.__enemyCannonCount = gated((shooter) => (cannons.current[shooter === 1 ? 2 : 1] || []).length);
    // Testhilfe (v3.31.1): Reparatur darf NUR Mauer-Trümmer (RUBBLE) wandeln,
    // Kanonen-Trümmer (RUBBLE_C) bleiben liegen. Zählt beide Sorten im ganzen
    // Grid, führt eine Reparatur aus und zählt erneut.
    window.__repairCheck = gated((p) => {
      const count = () => {
        const g = grid.current; let wall = 0, cannon = 0;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (g[r][c] === RUBBLE) wall++;
          else if (g[r][c] === RUBBLE_C) cannon++;
        }
        return { wall, cannon };
      };
      // Determinismus: liegt kein Mauer-Trümmer im Radius (Bot hat evtl. schon
      // repariert), eines auf einer freien Zelle nahe der Burg anlegen.
      const ct = castles.current[p];
      const g0 = grid.current;
      let has = false;
      for (let r = Math.max(0, ct.r - 10); r <= Math.min(ROWS - 1, ct.r + 10) && !has; r++)
        for (let c = Math.max(0, ct.c - 10); c <= Math.min(COLS - 1, ct.c + 10); c++)
          if (g0[r][c] === RUBBLE) { has = true; break; }
      if (!has) {
        outer: for (let d = 2; d <= 10; d++)
          for (let c = Math.max(1, ct.c - d); c <= Math.min(COLS - 2, ct.c + d); c++) {
            const r = ct.r + d;
            if (r < ROWS - 1 && g0[r][c] === EMPTY) { const ng = g0.map((row) => [...row]); ng[r][c] = RUBBLE; setGrid(ng); break outer; }
          }
      }
      const before = count();
      const fixed = repairRubble(p, 3);
      return { before, fixed, after: count(), fx: repairFx.current.length };
    });
    // Testhilfen Bot-KI (v3.29.0): Burg-Status lesen + gezielt eine Bresche
    // in die Schutzmauer von Spieler p schlagen (n zusammenhängende Mauerzellen → Trümmer).
    // Wiederaufbau-Paket (v3.30.0): Comeback-Status + wirksamer Kanonenpreis
    window.__rebuildAid = gated((p) => ({ active: rebuildAidActive(p), price: cannonPriceOf(p) }));
    // Terrain-Diagnose (v3.30.2, Flip-Bug-Regression): logische Wasserzellen
    window.__waterCells = gated(() => {
      const ter = terrain.current && terrain.current.grid;
      if (!ter) return null;
      const out = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (ter[r][c] === 3) out.push([r, c]);
      return out;
    });
    // Absolute Wasser-Referenzfarben des aktuellen Welt-Themas (v3.45.0).
    // Nötig für den Terrain-Flip-Regressionstest: Eine aus dem GERENDERTEN Bild
    // abgeleitete Referenz wandert bei einem Zeichenfehler mit und kann den Bug
    // deshalb nicht fangen — bewiesen durch einen absichtlich gespiegelten Fluss,
    // den die frühere Prüfung durchwinkte. Diese Werte kommen aus dem Thema,
    // sind also unabhängig davon, WO gezeichnet wurde.
    window.__waterTheme = gated(() => {
      const WT = worldThemeOf((terrain.current && terrain.current.seed) || terrainSeed.current || 0);
      return { water: WT.water.slice(), bank: WT.bank, edge: WT.waterEdge, name: WT.name };
    });
    window.__castleClosed = gated((p) => {
      const g = grid.current, ct = castles.current[p];
      if (!g || !ct) return null;
      return isCastleClosed(g, p, ct);
    });
    // Wie viele Zellen im autoritativen Gitter gehoeren Spieler p? (v3.111.0)
    //
    // Damit laesst sich eine Gast-AKTION bis in den Zustand des HOSTS
    // verfolgen: Gast baut → Zahl beim Host steigt. Bis v3.110.1 pruefte die
    // Online-Suite nur „Tap ohne Absturz" — das belegt keinen Multiplayer,
    // sondern nur, dass nichts explodiert.
    window.__zellen = gated((p) => {
      const g = grid.current;
      if (!g) return null;
      const w = WALL_OF[p], k = CANNON_OF[p];
      let mauern = 0, kanonen = 0;
      for (let r = 0; r < g.length; r++)
        for (let c = 0; c < g[r].length; c++) {
          if (g[r][c] === w) mauern++;
          else if (g[r][c] === k) kanonen++;
        }
      return { mauern, kanonen };
    });
    // Fingerabdruck der Sektorkarte (v3.111.0, nur 3 Spieler).
    //
    // Die Karte wird beim Gast NICHT uebertragen, sondern aus Seed und Burgen
    // NEU BERECHNET (`buildSectorMap`). Weicht sie ab, darf ein Spieler
    // scheinbar bauen, und der Host lehnt ab — oder umgekehrt. Ein
    // Fingerabdruck laesst sich zwischen den Seiten vergleichen, ohne die
    // ganze Karte durch die Pruefung zu schleifen.
    window.__sektorHash = gated(() => {
      const sm = terrain.current && terrain.current.sectorMap;
      if (!sm) return null;
      // `buildSectorMap` liefert ein FLACHES Int8Array (ROWS*COLS), kein
      // 2D-Feld. Der erste Anlauf lief ueber sm[r][c] — bei einem Int8Array
      // ist sm[r] eine Zahl, sm[r][c] also undefined, und die innere Schleife
      // lief NIE. Der Fingerabdruck war ueber null Zellen gebildet und auf
      // allen Seiten trivial gleich: eine Pruefung, die nicht rot werden
      // KONNTE. Aufgefallen ist es nur, weil die Meldung die Zellenzahl
      // mitnennt — „identisch (0 Zellen)" ist keine Uebereinstimmung.
      let h = 2166136261;
      const n = sm.length;
      for (let i = 0; i < n; i++) {
        h ^= (sm[i] | 0) + 1;
        h = Math.imul(h, 16777619);
      }
      // Wie viele Zellen gehoeren ueberhaupt jemandem? Eine Karte aus lauter
      // Nullen haette sonst ebenfalls einen huebschen, gleichen Hash.
      let belegt = 0;
      for (let i = 0; i < n; i++) if (sm[i]) belegt++;
      return { hash: (h >>> 0).toString(16), zellen: n, belegt, seed: terrainSeed.current };
    });
    // Wer ist ausgeschieden? (v3.111.0) Die 3-Spieler-Regel: Wessen Burg am
    // Bauende offen ist, fliegt raus; das Spiel endet bei hoechstens einem
    // Verbliebenen. Ohne Haken war das von aussen nicht nachweisbar.
    // Die Sektorkarte absichtlich verbiegen (v3.111.0) — NUR zum Pruefen des
    // Abgleichs. Zwei Faelle, weil sie sich unterschiedlich verhalten MUESSEN:
    //   'karte'  — nur die Karte verfaelschen. Die Eingaben stimmen noch, das
    //              Neuberechnen stellt sie wieder her: SELBSTHEILUNG, keine
    //              Meldung. Wer hier eine Meldung saehe, wuerde Spieler wegen
    //              eines Schluckaufs erschrecken.
    //   'gelaende' — das GELAENDE verbiegen, aus dem die Karte entsteht. Das
    //              Neuberechnen hilft dann nicht, und die Meldung muss kommen.
    //              Ohne diesen Fall waere der ganze Schutz Code, der nie
    //              ausloest.
    //
    // Warum GELAENDE und nicht Burgpositionen: Die Burgen schickt der Host in
    // jedem Zustand mit (`castles.current = s.castles`), eine Verfaelschung
    // dort waere im naechsten Takt wieder weg — der erste Anlauf dieser
    // Gegenprobe blieb genau deshalb still. Das Gelaende dagegen wird beim
    // Gast aus dem Seed abgeleitet und NIE uebertragen; eine Abweichung dort
    // ist dauerhaft. Sie bildet damit auch den echten Gefahrenfall ab.
    window.__sektorVerbiegen = gated((modus) => {
      const ter = terrain.current;
      if (!ter || !ter.sectorMap) return false;
      if (modus === "gelaende") {
        const g = ter.grid;
        if (!g || !g.length) return false;
        // Einen Riegel Wasser (3) quer durchs Feld ziehen: `buildSectorMap`
        // laeuft nicht durch Wasser, die Zuteilung faellt damit anders aus.
        const reihe = Math.floor(g.length / 2);
        for (let c = 0; c < g[reihe].length; c++) g[reihe][c] = 3;
      }
      for (let i = 0; i < ter.sectorMap.length; i += 97) ter.sectorMap[i] = 0;
      return true;
    });
    window.__eliminiert = gated(() => Object.keys(eliminated.current || {}).map(Number).sort());
    window.__blastWall = gated((p, n) => {
      const g = grid.current, ct = castles.current[p];
      if (!g || !ct) return 0;
      const wall = WALL_OF[p];
      let start = null;
      for (let d = 1; d <= 8 && !start; d++)
        for (let c = ct.c - d; c <= ct.c + d && !start; c++) {
          if (ct.r - d >= 0 && g[ct.r - d][c] === wall) start = { r: ct.r - d, c };
          else if (ct.r + d < ROWS && g[ct.r + d][c] === wall) start = { r: ct.r + d, c };
        }
      if (!start) return 0;
      const newG = g.map((row) => [...row]);
      let done = 0;
      for (let dc = 0; dc < (n || 1) + 4 && done < (n || 1); dc++) {
        const cc = start.c + dc;
        if (cc < COLS && newG[start.r][cc] === wall) { newG[start.r][cc] = RUBBLE; done++; }
      }
      setGrid(newG);
      return done;
    });
    // Balancing-Messung: vollständiger Ökonomie-Snapshot
    window.__econFull = gated(() => ({
      round: roundRefVal.current, phase: phase_r.current,
      scrap: __spreadValues({}, scrap.current),
      cannons: { 1: (cannons.current[1] || []).length, 2: (cannons.current[2] || []).length, 3: (cannons.current[3] || []).length },
      up: JSON.parse(JSON.stringify(upgrades.current)),
      elim: __spreadValues({}, eliminated.current)
    }));
    // Herzschlag-Diagnose (v3.70.0): Alter der zuletzt gesehenen Lebenszeichen
    // je Gast-Slot, plus eigener SDK-Verbindungsstatus.
    window.__hbDbg = gated(() => {
      const out = { fbOnline: fbOnline.current, opp: oppLostRef.current,
                    started: gameStarted.current, role: myRole.current,
                    online: online.current, screen: screenRef.current,
                    watch: !!hbWatchdog.current, slots: {} };
      for (const k of Object.keys(hbSeen.current)) {
        const r = hbSeen.current[k];
        out.slots[k] = { ever: r.ever, ageMs: r.last ? Date.now() - r.last : null };
      }
      return out;
    });
  }, []);
  // mpScreen früh deklarieren: finishOnboarding + Onboarding-Effect (oben) lesen es (v3.14.12).
  const [mpScreen, setMpScreen] = useState(null);
  // Beim Oeffnen des Online-Schirms EINMAL messen (v3.111.2).
  useEffect(() => {
    if (mpScreen !== "online") return;
    let weg = false;
    setNetzInfo(null);
    pruefeVerbindung().then((i) => { if (!weg) setNetzInfo(i); }).catch(() => {});
    return () => { weg = true; };
  }, [mpScreen]);

  function openTutorial() { setOnboardStep(0); setShowOnboarding(true); }
  function finishOnboarding() {
    try { localStorage.setItem('fortress_onboarded', '1'); } catch (e) {}
    setShowOnboarding(false);
    // Erstspieler direkt ins interaktive Tutorial führen (wie bei anderen Spielen).
    // NUR wenn der Spieler untätig im Hauptmenü ist — nie mitten in Matchmaking,
    // Online-Session oder laufendem Spiel (v3.14.12).
    let tutDone = true;
    try { tutDone = !!localStorage.getItem('fortress_tutorial_done'); } catch (e) {}
    const idleInMenu = screenRef.current === "menu" && mpScreen == null && !mmActive.current && !online.current;
    if (!tutDone && profile && idleInMenu) setTimeout(() => startGuidedTutorial(), 250);
  }
  function endTutorial(goOnline) {
    tutorialMode.current = false;
    botMode.current = false;
    setShowTutorialDone(false);
    quitGame();
    if (goOnline) setTimeout(() => setMpScreen("online"), 80);
  }
  function openProfileEditor() {
    setEditName((profile == null ? void 0 : profile.name) || "");
    setEditWappen((profile == null ? void 0 : profile.wappen) || "\u2654");
    setEditColor((profile == null ? void 0 : profile.color) || "#2563eb");
    setShowProfileEditor(true);
  }
  function saveProfileEditor() {
    const name = editName.trim().slice(0, 16) || t('playerDefault');
    const id = (profile == null ? void 0 : profile.id) || "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const p = {
      id,
      name,
      wappen: editWappen,
      color: editColor,
      elo: typeof (profile == null ? void 0 : profile.elo) === "number" ? profile.elo : 1e3,
      elo3: typeof (profile == null ? void 0 : profile.elo3) === "number" ? profile.elo3 : 1e3,
      stats: (profile == null ? void 0 : profile.stats) || { wins: 0, losses: 0, games: 0 },
      stats3: (profile == null ? void 0 : profile.stats3) || { wins: 0, losses: 0, games: 0 },
      gold: typeof (profile == null ? void 0 : profile.gold) === "number" ? profile.gold : 100,
      level: typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1,
      xp: typeof (profile == null ? void 0 : profile.xp) === "number" ? profile.xp : 0,
      unlockedRewards: Array.isArray(profile == null ? void 0 : profile.unlockedRewards) ? profile.unlockedRewards : [],
      peakElo: typeof (profile == null ? void 0 : profile.peakElo) === "number" ? profile.peakElo : (typeof (profile == null ? void 0 : profile.elo) === "number" ? profile.elo : 1000),
      peakElo3: typeof (profile == null ? void 0 : profile.peakElo3) === "number" ? profile.peakElo3 : (typeof (profile == null ? void 0 : profile.elo3) === "number" ? profile.elo3 : 1000),
      achievements: Array.isArray(profile == null ? void 0 : profile.achievements) ? profile.achievements : [],
      dailyTasks: Array.isArray(profile == null ? void 0 : profile.dailyTasks) ? profile.dailyTasks : [],
      seasonXp: typeof (profile == null ? void 0 : profile.seasonXp) === "number" ? profile.seasonXp : 0,
      historicalXpApplied: !!(profile == null ? void 0 : profile.historicalXpApplied),
      winStreak: typeof (profile == null ? void 0 : profile.winStreak) === 'number' ? profile.winStreak : 0,
      blocksDestroyed: typeof (profile == null ? void 0 : profile.blocksDestroyed) === 'number' ? profile.blocksDestroyed : 0,
      lifetimeGold: typeof (profile == null ? void 0 : profile.lifetimeGold) === 'number' ? profile.lifetimeGold : 0,
      achievementsRetroApplied: !!(profile == null ? void 0 : profile.achievementsRetroApplied),
      // Gold-Shop-Käufe durchreichen (v3.26.1) — sonst löscht jede Profiländerung sie.
      cosmetics: (profile == null ? void 0 : profile.cosmetics) || { owned: [], equipped: {} }
    };
    saveProfile(p);
    setShowProfileEditor(false);
    pushLeaderboard(p);
  }
  function handleDailyCollect(reward, streakIdx) {
    if (!profile) return;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const curDaily = loadDailyState();
    const wasStreak = curDaily.lastStreakDay === yesterday;
    const newStreak = wasStreak ? (curDaily.streak || 0) + 1 : 1;
    const newDaily = { lastCollect: Date.now(), streak: newStreak, lastStreakDay: today };
    saveDailyState(newDaily);
    setDailyState(newDaily);
    const newGold = (typeof profile.gold === "number" ? profile.gold : 100) + reward.gold;
    let updatedProfile = __spreadProps(__spreadValues({}, profile), { gold: newGold });
    if (reward.xp > 0) {
      const { level: newLevel, xp: newXp } = applyXpGain(updatedProfile, reward.xp);
      updatedProfile = __spreadProps(__spreadValues({}, updatedProfile), { level: newLevel, xp: newXp });
    }
    // Tag-7-Kiste (v3.33.0): +1 Drachenstahl für die Schmiede
    if (reward.special === "chest") {
      const dm = matOf(updatedProfile);
      updatedProfile = __spreadProps(__spreadValues({}, updatedProfile), { materials: __spreadProps(__spreadValues({}, dm), { dragon: dm.dragon + 1 }) });
      showMatGain({ dragon: 1 });
    }
    saveProfile(updatedProfile);
    setDailyCollected(true);
    setTimeout(() => { setShowDailyModal(false); setDailyCollected(false); }, 1400);
  }
  const [leaderboard, setLeaderboard] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showShopInfo, setShowShopInfo] = useState(false);
  const [botSelect, setBotSelect] = useState(false); // Bot-Stufen-Auswahl ausgeklappt (v3.20.0)
  useEffect(() => { setBotSelect(false); }, [mpScreen]); // beim Panelwechsel einklappen
  const [dailyState, setDailyState] = useState(() => loadDailyState());
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyCollected, setDailyCollected] = useState(false);
  // Material-Toast (v3.68.0): kurze Einblendung, wenn ausserhalb des
  // Ergebnis-Screens Schmiede-Material anfaellt (Tagesaufgabe, Tag-7-Kiste).
  const [matToast, setMatToast] = useState(null);
  const matToastT = useRef(null);
  function showMatGain(gain) {
    if (!gain || !MAT_ORDER.some((k) => (gain[k] || 0) > 0)) return;
    setMatToast(gain);
    if (matToastT.current) clearTimeout(matToastT.current);
    matToastT.current = setTimeout(() => setMatToast(null), 2800);
  }
  // ── Daily Tasks State (v3.22.0) ──
  const [tasksState, setTasksState] = useState(() => loadTasksState());
  const [showTasksModal, setShowTasksModal] = useState(false);
  const tasksHarvested = useRef(false);
  // Fortschritt am Rundenende aus matchStats ernten. Läuft als Effect NACH
  // applyState/endShoot → matchStats ist auf Host UND Gast final.
  function harvestDailyTasks(winner) {
    if (tasksHarvested.current) return;
    if (tutorialMode.current) return;
    if (!botMode.current && !online.current) return; // lokales Duell am selben Gerät zählt nicht
    tasksHarvested.current = true;
    const meP = online.current ? (myRole.current || 1) : 1;
    const ms = (matchStats.current && matchStats.current[meP]) || {};
    const won = winner != null && winner === meP;
    const st = loadTasksState();
    let changed = false;
    for (const tk of st.tasks) {
      if (tk.collected) continue;
      const def = taskDef(tk.id);
      if (!def) continue;
      const inc = def.stat === "played" ? 1 : def.stat === "won" ? (won ? 1 : 0) : (ms[def.stat] || 0);
      if (inc > 0) { tk.prog = Math.min(def.target, (tk.prog || 0) + inc); changed = true; }
    }
    if (changed) { saveTasksState(st); setTasksState(st); }
  }
  function collectDailyTask(taskId) {
    if (!profile) return;
    const st = loadTasksState();
    const tk = st.tasks.find((x) => x.id === taskId);
    const def = taskDef(taskId);
    if (!tk || !def || tk.collected || (tk.prog || 0) < def.target) return;
    tk.collected = true;
    saveTasksState(st);
    setTasksState(st);
    const oldGold = typeof profile.gold === "number" ? profile.gold : 100;
    // Schmiede-Material als Task-Bonus (v3.33.0): +3 Eisensplitter, +1 Silbererz
    const tm = matOf(profile);
    const updated = __spreadProps(__spreadValues({}, profile), {
      gold: oldGold + def.gold,
      lifetimeGold: (typeof profile.lifetimeGold === "number" ? profile.lifetimeGold : 0) + def.gold,
      materials: __spreadProps(__spreadValues({}, tm), { iron: tm.iron + TASK_MAT.iron, silver: tm.silver + TASK_MAT.silver })
    });
    saveProfile(updated);
    showMatGain(TASK_MAT);
    SFX.win && SFX.win();
  }
  const tasksClaimable = tasksState.tasks.filter((tk) => { const d = taskDef(tk.id); return d && !tk.collected && (tk.prog || 0) >= d.target; }).length;
  const forgeReadyN = profile ? craftbar(profile) : 0; // Abzeichen am Schmiede-Button (v3.68.0)
  // ── Gold-Shop State (v3.23.0) ──
  const [showGoldShop, setShowGoldShop] = useState(false);
  // Kauf-Bestätigung (v3.26.2): {cat, item} des zur Bestätigung anstehenden Kaufs
  const [confirmBuy, setConfirmBuy] = useState(null);
  function cosmeticOwned(cos, item) { return item.price === 0 || cos.owned.includes(item.id); }
  function buyOrEquipCosmetic(cat, item) {
    if (!profile) return;
    const cos = cosOf(profile);
    let updated;
    if (cosmeticOwned(cos, item)) {
      if (cos.equipped[cat] === item.id) return; // schon angelegt
      updated = __spreadProps(__spreadValues({}, profile), { cosmetics: { owned: cos.owned, equipped: __spreadProps(__spreadValues({}, cos.equipped), { [cat]: item.id }) } });
    } else {
      const g = typeof profile.gold === "number" ? profile.gold : 100;
      if (g < item.price) return;
      updated = __spreadProps(__spreadValues({}, profile), {
        gold: g - item.price,
        cosmetics: { owned: [...cos.owned, item.id], equipped: __spreadProps(__spreadValues({}, cos.equipped), { [cat]: item.id }) }
      });
      SFX.buy && SFX.buy();
    }
    saveProfile(updated);
  }
  // ── Schmiede: Craften oder (bereits geschmiedet) an-/umlegen (v3.33.0) ──
  const [showForge, setShowForge] = useState(false);
  const [confirmCraft, setConfirmCraft] = useState(null); // Rezept, das zur Bestätigung ansteht
  const [craftReveal, setCraftReveal] = useState(null); // frisch geschmiedetes Rezept → episches Reveal
  function canCraft(rec) {
    if (!profile) return false;
    const mats = matOf(profile);
    const g = typeof profile.gold === "number" ? profile.gold : 100;
    for (const k of MAT_ORDER) if ((rec.cost[k] || 0) > mats[k]) return false;
    if ((rec.cost.gold || 0) > g) return false;
    if (rec.base && !cosOf(profile).owned.includes(rec.base)) return false;
    return true;
  }
  function craftOrEquip(rec) {
    if (!profile) return;
    const cos = cosOf(profile);
    if (cos.owned.includes(rec.id)) {
      if (cos.equipped[rec.cat] === rec.id) return;
      saveProfile(__spreadProps(__spreadValues({}, profile), { cosmetics: { owned: cos.owned, equipped: __spreadProps(__spreadValues({}, cos.equipped), { [rec.cat]: rec.id }) } }));
      return;
    }
    if (!canCraft(rec)) return;
    const mats = matOf(profile);
    const newMats = {};
    for (const k of MAT_ORDER) newMats[k] = mats[k] - (rec.cost[k] || 0);
    const g = typeof profile.gold === "number" ? profile.gold : 100;
    saveProfile(__spreadProps(__spreadValues({}, profile), {
      gold: g - (rec.cost.gold || 0),
      materials: newMats,
      cosmetics: { owned: [...cos.owned, rec.id], equipped: __spreadProps(__spreadValues({}, cos.equipped), { [rec.cat]: rec.id }) }
    }));
    // Episches Reveal (v3.40.0): frisch geschmiedete Items werden zelebriert.
    // Höherwertige Raritäten bekommen den satteren Sieges-Sound.
    const rar = forgeRarity(rec);
    if ((rar === "epic" || rar === "legendary") && SFX.win) SFX.win();
    else if (SFX.buy) SFX.buy();
    setCraftReveal(rec);
  }
  // Zurück auf Standard-Optik (Kanone/Einschlag abrüsten)
  function unequipForgeCat(cat) {
    if (!profile) return;
    const cos = cosOf(profile);
    const std = cat === "cannon" ? "cannon_standard" : "impact_standard";
    if (cos.equipped[cat] === std) return;
    saveProfile(__spreadProps(__spreadValues({}, profile), { cosmetics: { owned: cos.owned, equipped: __spreadProps(__spreadValues({}, cos.equipped), { [cat]: std }) } }));
  }
  useEffect(() => {
    if (screen === "result") harvestDailyTasks((resultInfo || {}).winner);
    else tasksHarvested.current = false; // nächste Runde/Spiel darf wieder ernten
  }, [screen, resultInfo]);
  // ── Balancing-Experimente (v3.49.0, gated) ──────────────────────────────
  // Regelvarianten fuer die Selbstspiel-Analyse. NUR aktiv, wenn window.__balExp
  // gesetzt ist — im normalen Spiel existiert keine dieser Regeln. So lassen
  // sich Ideen messen, BEVOR eine davon ins Spiel wandert.
  //   narben:   Eine Zelle, die 2x zerstoert wurde, wird zur dauerhaften Narbe
  //             und ist nicht mehr bebaubar. Die Front frisst sich nach innen.
  //   bruch:    Ein Treffer reisst Nachbarmauern an; angerissene fallen beim
  //             naechsten Treffer sofort. Schaden kaskadiert.
  //   druck:    Bauzeit schrumpft je Runde (Untergrenze 12s).
  //   faecher:  Jede Kanone einer Salve zielt auf eine ANDERE Zelle.
  function balExp() { return (typeof window !== "undefined" && window.__balExp) || null; }
  const placedThisPhase = useRef({});
  const burning = useRef({});     // "r_c" -> Runde, bis zu der die Zelle brennt
  const scarCount = useRef({});   // "r_c" -> wie oft zerstoert (nur bei narben)
  const scars = useRef({});       // "r_c" -> true = dauerhaft unbebaubar

  // ── Match-Telemetrie (v3.47.0) ──────────────────────────────────────────
  // Schreibt eine ANONYME Match-Zusammenfassung nach Firebase, damit sich
  // Spielverhalten und Balancing über viele echte Partien auswerten lassen
  // (Dashboard: stats.html). Bewusst OHNE Namen/Profil-IDs — es geht um
  // Aggregate (wie viele Kanonen, wie viel Schrott, wie lange), nicht um
  // Einzelpersonen. Best-effort: Fehler dürfen das Spiel nie stören.
  // ── Trichter-Telemetrie (v3.79.0) ─────────────────────────────────────
  // Bisher wurde nur der AUSGANG von Matches erfasst — also ausschliesslich
  // von Leuten, die es bis zum Ende geschafft haben. Wo die anderen
  // abspringen, war unsichtbar; jede Aussage darueber war geraten.
  //
  // Erfasst wird NUR der Ablauf, nie wer: kein Name, keine Profil-ID, keine
  // Geraetekennung — gleiche Linie wie die Match-Telemetrie.
  function trichter(schritt, daten) {
    try {
      if (!MP_CONFIGURED || tutorialMode.current) return;
      const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      const rec = __spreadValues({ ts: Date.now(), schritt, art: "funnel" }, daten || {});
      if (typeof window !== "undefined" && window.__mmDebug) {
        (window.__trichter = window.__trichter || []).push(rec);
      }
      if (window.__fb) fb.set("funnel/" + id, rec);
    } catch (e) { /* Telemetrie darf nie das Spiel stoeren */ }
  }
  function pushTelemetry(winner) {
    try {
      if (tutorialMode.current) return;           // Tutorial verfälscht die Daten
      if (telemetrySent.current) return;          // pro Match genau einmal
      telemetrySent.current = true;
      const players = playersList();
      const per = {};
      for (const p of players) {
        const m = matchStats.current[p] || {};
        const u = upgrades.current[p] || {};
        per["p" + p] = {
          walls: m.walls || 0, cannons: m.cannons || 0, scrap: m.scrap || 0,
          shots: m.shots || 0, hits: m.hits || 0, buys: m.buys || 0,
          reload: u.reload || 0, armor: u.armor || 0, repair: u.repair || 0,
          left: scrap.current[p] || 0,
          alive: !eliminated.current[p]
        };
      }
      const rec = {
        ts: Date.now(),
        v: "3.47.0",
        mode: online.current ? (numPlayersRef.current === 3 ? "online3" : "online2")
             : botMode.current ? "bot" : "local",
        botLvl: botMode.current ? (botLevel.current || "mid") : null,
        rounds: roundRefVal.current,
        world: (worldThemeOf(terrainSeed.current || 0) || {}).name || null,
        winner: winner === null || winner === void 0 ? "draw" : ("p" + winner),
        players: players.length,
        per
      };
      const id = rec.ts.toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      if (typeof window !== "undefined") window.__lastTelemetry = rec;  // Diagnose/Test
      if (window.__fb) fb.set("telemetry/" + id, rec);
    } catch (e) { /* Telemetrie darf nie das Spiel stören */ }
  }
  async function quitGame() {
    setShowQuitConfirm(false);
    running.current = false;
    if (online.current) {
      // Ranked-Integrität (v3.30.3): Aufgeben mitten im laufenden Spiel zählt
      // als NIEDERLAGE für den Aufgebenden. Vorher verbuchte der Quitter gar
      // nichts — absehbare Niederlagen ließen sich per „Beenden" dodgen.
      // Nur wenn das Spiel wirklich läuft und noch nichts verbucht wurde
      // (vom Ergebnis-Screen aus ist bereits verbucht).
      if (screenRef.current === "game" && !statRecorded.current) {
        statRecorded.current = true;
        recordResult(false, numPlayersRef.current);
      }
      const wasHost = myRole.current === 1;
      if (wasHost) {
        await hostLeaveResolve();
      } else {
        try {
          await sendAction({ type: "leave" });
        } catch (e) {
        }
        await new Promise((res) => setTimeout(res, 250));
      }
      leaveOnline();
    } else {
      screenRef.current = "menu";
      setScreen("menu");
    }
  }
  async function hostLeaveResolve() {
    eliminated.current[1] = true;
    const players = playersList();
    const stillIn = players.filter((p) => !eliminated.current[p]);
    const winner = stillIn.length >= 1 ? stillIn[0] : null;
    const info = { loser: 1, winner, reason: "host_left", numPlayers: numPlayersRef.current };
    resultRef.current = info;
    screenRef.current = "result";
    phase_r.current = "result";
    try {
      await pushState(true);
      await new Promise((res) => setTimeout(res, 250));
      await pushState(true);
      await new Promise((res) => setTimeout(res, 250));
    } catch (e) {
    }
  }
  async function pushLeaderboard(p) {
    if (!p || !p.id || !MP_CONFIGURED) return;
    try {
      const s = sdk();
      if (!s) {
        await getFirebase();
      }
      const s2 = p.stats || { wins: 0, losses: 0, games: 0 };
      const s3 = p.stats3 || { wins: 0, losses: 0, games: 0 };
      await fb.set(`leaderboard/${writeId(p.id)}`, {
        name: p.name,
        wappen: p.wappen,
        color: p.color,
        // 2-Spieler-Werte (Bestand, oberste Ebene für Kompatibilität)
        wins: s2.wins,
        losses: s2.losses,
        games: s2.games,
        // 3-Spieler-Werte
        wins3: s3.wins,
        losses3: s3.losses,
        games3: s3.games,
        // ELO-Wertungen (Start 1000)
        elo: typeof p.elo === "number" ? p.elo : 1e3,
        elo3: typeof p.elo3 === "number" ? p.elo3 : 1e3,
        gold: typeof p.gold === "number" ? p.gold : 100,
        level: typeof p.level === "number" ? p.level : 1,
        xp: typeof p.xp === "number" ? p.xp : 0,
        peakElo: typeof p.peakElo === "number" ? p.peakElo : (typeof p.elo === "number" ? p.elo : 1000),
        peakElo3: typeof p.peakElo3 === "number" ? p.peakElo3 : (typeof p.elo3 === "number" ? p.elo3 : 1000),
        updatedAt: Date.now()
      });
    } catch (e) {
    }
  }
  // Onboarding bei Erstkontakt automatisch zeigen (hat Vorrang vor Daily-Modal).
  // NUR im untätigen Hauptmenü (v3.14.12) — nie über Matchmaking/Online-Screens
  // poppen: das Schließen startete dort das Erstspieler-Tutorial und kaperte
  // die laufende Queue-Session. Wird nachgeholt, sobald der Spieler ins Menü
  // zurückkehrt (deps enthalten screen + mpScreen).
  useEffect(() => {
    if (!profile) return;
    if (screen !== "menu" || mpScreen != null || mmActive.current || online.current) return;
    let onboarded = true;
    try { onboarded = !!localStorage.getItem('fortress_onboarded'); } catch (e) {}
    if (!onboarded) {
      const timer = setTimeout(() => { setOnboardStep(0); setShowOnboarding(true); }, 600);
      return () => clearTimeout(timer);
    }
  }, [profile?.id, screen, mpScreen]);
  useEffect(() => {
    if (!profile) return;
    // v3.90.0: NICHT ueber den Profil-Editor legen. Die Tages-Belohnung ist
    // das einzige Fenster, das sich UNGEFRAGT oeffnet — 1,2 s nachdem ein
    // Profil da ist. Stand der Editor offen, landete sie darueber, und das
    // Namensfeld war nicht mehr zu treffen: beide lagen auf Ebene 1100, und
    // dann entscheidet die Reihenfolge im Dokument, nicht die Absicht.
    // Sie kommt, sobald der Editor zu ist — der Effekt haengt jetzt daran.
    if (showProfileEditor) return;
    let onboarded = true;
    try { onboarded = !!localStorage.getItem('fortress_onboarded'); } catch (e) {}
    const d = loadDailyState();
    if (onboarded && getDailyCollectable(d)) {
      const timer = setTimeout(() => setShowDailyModal(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [profile?.id, showProfileEditor]);
  // Sieg-/Niederlage-Sound beim Erscheinen des Ergebnisbildschirms
  useEffect(() => {
    if (screen !== "result") return;
    const info = resultInfo || {};
    const won = online.current ? info.winner === myRole.current : !!info.winner;
    const timer = setTimeout(() => { won ? SFX.win() : SFX.lose(); }, 250);
    return () => clearTimeout(timer);
  }, [screen, resultInfo]);
  // ── Selbstauskunft zur Verbindung (v3.111.2) ───────────────────────────
  //
  // Anlass: Aus der TestFlight-App kam „geht gar nichts" — Matchmaking ohne
  // Reaktion, Bestenliste ewig auf „Laedt…". Server, Regeln und Konfiguration
  // waren nachweislich in Ordnung (WebSocket-Handshake 101, Bestenliste
  // unangemeldet in 0,5 s lesbar). Der Fehler sitzt auf dem Geraet — und dort
  // ist von aussen nichts zu sehen.
  //
  // Diese Zeile macht den Zustand LESBAR: Ist das SDK da? Gibt es eine uid?
  // Wie lange braucht ein winziger Lesezugriff? Ohne sie bleibt jede weitere
  // Diagnose Raten, und Raten hat in dieser Sitzung schon zweimal danebengelegen.
  const [netzInfo, setNetzInfo] = useState(null);
  async function pruefeVerbindung() {
    const w = typeof window !== "undefined" ? window : {};
    const s = sdk();
    const info = {
      sdk: !!s,
      uid: s && s.uid ? String(s.uid).slice(0, 6) + "\u2026" : null,
      bootFehler: w.__fbError || "",
      authFehler: w.__fbAuthError || "",
      // `navigator.onLine` steht hier aus einem bestimmten Grund (v3.111.3):
      // Das Firebase-SDK fragt es, BEVOR es eine Verbindung aufbaut. Meldet
      // der WebView faelschlich `false` — ein bekanntes Verhalten, wenn die
      // Seite unter einem eigenen Schema wie `capacitor://localhost` laeuft —
      // dann versucht das SDK es gar nicht erst und wartet auf ein
      // `online`-Ereignis, das nie kommt. Kein Fehler, keine Ablehnung, nur
      // Stille: genau das gemeldete Bild. Ohne diese Angabe waere der Fall
      // von aussen nicht von „Netz weg" zu unterscheiden.
      online: typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
        ? navigator.onLine : null,
      lesen: null
    };
    if (!s) return info;
    const t0 = Date.now();
    // Ein winziger, oeffentlich lesbarer Pfad. Auch „gibt es nicht" ist eine
    // Antwort — gemessen wird die Umlaufzeit, nicht der Inhalt.
    const r = await Promise.race([
      fb.get("leaderboard/ping"),
      new Promise((x) => setTimeout(() => x("__zeit"), 6000))
    ]);
    info.lesen = r === "__zeit" ? "zeit" : Date.now() - t0;
    return info;
  }
  const [lbRaw, setLbRaw] = useState(null);
  // Warum die Bestenliste leer ist (v3.111.1) — null = kein Fehler.
  const [lbFehler, setLbFehler] = useState(null);
  const [lbMode, setLbMode] = useState(2);
  async function openLeaderboard() {
    setShowLeaderboard(true);
    setLeaderboard(null);
    setLbFehler(null);
    setLbMode(2);
    if (!MP_CONFIGURED) {
      setLeaderboard([]);
      setLbRaw([]);
      return;
    }
    if (!sdk()) await getFirebase();
    // ZEITGRENZE (v3.111.1). Vorher stand hier ein nacktes `await fb.get(...)`.
    //
    // `fb.get` faengt Fehler ab und liefert null — eine abgelehnte Berechtigung
    // endet also in „keine Eintraege". Was NICHT abgefangen war: Das SDK loest
    // `get()` gar nicht auf, solange keine Verbindung zustande kommt. Dann
    // wurde `setLeaderboard` nie aufgerufen, der Zustand blieb `null`, und die
    // Anzeige stand FUER IMMER auf „Laedt…" — ohne Meldung, ohne Knopf, ohne
    // Hinweis worauf gewartet wird. Genau so gemeldet aus der TestFlight-App.
    //
    // Acht Sekunden sind reichlich: Ein voller Lesezugriff auf die echte
    // Datenbank dauert gemessen rund eine halbe Sekunde.
    const data = await Promise.race([
      fb.get("leaderboard"),
      new Promise((r) => setTimeout(() => r("__zeit"), 8000))
    ]);
    if (data === "__zeit") {
      setLbFehler(t('lbTimeout'));
      setLeaderboard([]);
      setLbRaw([]);
      return;
    }
    if (!data) {
      // Auch hier: sagen, WARUM nichts kam, statt „noch keine Eintraege" zu
      // behaupten. Das ist ein Unterschied, den der Spieler kennen muss.
      if (fbFehler()) setLbFehler(fbFehler());
      setLeaderboard([]);
      setLbRaw([]);
      return;
    }
    const raw = Object.entries(data).filter(([id]) => id !== "ping").map(([id, v]) => __spreadValues({ id }, v));
    setLbRaw(raw);
    applyLbMode(raw, 2);
  }
  function applyLbMode(raw, mode) {
    const m3 = mode === 3;
    // Alt-Eintraege derselben Person ausblenden (v3.71.0) — sie sind seit der
    // Rules-Umstellung fuer keinen Client mehr loeschbar.
    const list = dropMigratedDupes(raw).map((e) => ({
      id: e.id,
      name: e.name,
      wappen: e.wappen,
      color: e.color,
      elo: typeof (m3 ? e.elo3 : e.elo) === "number" ? m3 ? e.elo3 : e.elo : 1e3,
      wins: m3 ? e.wins3 || 0 : e.wins || 0,
      losses: m3 ? e.losses3 || 0 : e.losses || 0,
      games: m3 ? e.games3 || 0 : e.games || 0
    })).filter((e) => e.games > 0).sort((a, b) => b.elo - a.elo || b.wins - a.wins || b.games - a.games);
    setLeaderboard(list);
  }
  function switchLbMode(mode) {
    setLbMode(mode);
    if (lbRaw) applyLbMode(lbRaw, mode);
  }
  const [cleanupBusy, setCleanupBusy] = useState(false);
  async function cleanupMyDuplicates() {
    if (!profile || !profile.id || !MP_CONFIGURED) return;
    setCleanupBusy(true);
    try {
      if (!sdk()) await getFirebase();
      const data = await fb.get("leaderboard");
      if (!data) {
        setCleanupBusy(false);
        return;
      }
      // Security (v3.39.1): NUR EIGENE Eintraege zusammenfuehren — der aktuelle
      // auth.uid-Schluessel plus ein evtl. verwaister alter localStorage-ID-Key
      // aus der Migration. NIE nach Name auswaehlen: Namen sind nicht eindeutig,
      // die alte Version loeschte damit fremde Leaderboard-Eintraege mit gleichem
      // Namen (Griefing). Fremde Schluessel werden hier nie angefasst; die Rules
      // (auth.uid === $playerId) sind die zweite Verteidigungslinie.
      const myKey = writeId(profile.id);
      const ownIds = [myKey, profile.id].filter((v, i, a) => v && a.indexOf(v) === i);
      const mine = ownIds.map((id) => data[id] ? __spreadValues({ id }, data[id]) : null).filter(Boolean);
      if (mine.length <= 1) {
        setCleanupBusy(false);
        setLbRaw(null);
        openLeaderboard();
        return;
      }
      const merged = {
        name: profile.name,
        wappen: profile.wappen,
        color: profile.color,
        wins: Math.max(...mine.map((e) => e.wins || 0)),
        losses: Math.max(...mine.map((e) => e.losses || 0)),
        games: Math.max(...mine.map((e) => e.games || 0)),
        wins3: Math.max(...mine.map((e) => e.wins3 || 0)),
        losses3: Math.max(...mine.map((e) => e.losses3 || 0)),
        games3: Math.max(...mine.map((e) => e.games3 || 0)),
        updatedAt: Date.now()
      };
      await fb.set(`leaderboard/${myKey}`, merged);
      for (const e of mine) {
        if (e.id !== myKey) await fb.delete(`leaderboard/${e.id}`);
      }
      saveProfile(__spreadProps(__spreadValues({}, profile), {
        stats: { wins: merged.wins, losses: merged.losses, games: merged.games },
        stats3: { wins: merged.wins3, losses: merged.losses3, games: merged.games3 }
      }));
      setLbRaw(null);
      await openLeaderboard();
    } catch (e) {
    }
    setCleanupBusy(false);
  }
  const [mpCode, setMpCode] = useState("");
  const [mpInput, setMpInput] = useState("");
  const [mpError, setMpError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [shareShared, setShareShared] = useState(false);
  const [mmElapsed, setMmElapsed] = useState(0);
  const mmChannel = useRef(null);
  const mmTickTimer = useRef(null);
  const mmDisplayTimer = useRef(null);
  const mmHealTimer = useRef(null);
  const mmWatchdog = useRef(null);
  const mmCancelDisconnect = useRef(null);
  const mmQueueSnapshot = useRef({});
  const mmMyTicket = useRef(null);
  // Beobachtungsbasierte Heartbeat-Überwachung (v3.15.2): {id: {hb, at}}.
  // Ein Ticket gilt erst als verwaist, wenn sich sein hb über 35s MEINER
  // Beobachtung nicht geändert hat — immun gegen falsch gehende Geräte-Uhren
  // (Wanduhr-Vergleich löschte sonst fremde, frische Tickets).
  const mmHbSeen = useRef({});
  // true = laufendes Spiel kam aus dem Matchmaking (gewertet, kein Rematch) —
  // false = Code-Spiel mit Freunden (Rematch erlaubt). (v3.14.14)
  const mmMatched = useRef(false);
  const mmStartedAt = useRef(0);
  const mmBusy = useRef(false);
  const mmActive = useRef(false);
  const mmHealFor = useRef(null);
  const mmNp = useRef(2);
  const mmPendingCandidates = useRef({});
  const [showDbg, setShowDbg] = useState(false);
  const dbg = useRef({ statesRecv: 0, statesPush: 0, actSent: 0, actRecv: 0, lastErr: "", lastInfo: "" });
  function dbgBump(field, info) {
    dbg.current[field] = (dbg.current[field] || 0) + 1;
    if (info) dbg.current.lastInfo = info;
  }
  // Freund herausfordern (v3.79.0).
  //
  // Bis hierher verschickte das Teilen nach einem Match nur die nackte
  // Adresse — der Empfaenger landete im Menue und musste selbst herausfinden,
  // wie man zusammen spielt. Bei zehn aktiven Spielern ist die Einladung an
  // einen KONKRETEN Menschen aber der einzige Weg, der ohne Spielerbasis
  // funktioniert: er braucht niemanden in der Warteschlange.
  //
  // Deshalb wird hier erst eine Lobby geoeffnet und DANN deren Beitritts-Link
  // geteilt. Der Empfaenger tippt einmal und steht neben dir.
  async function challengeFriend() {
    trichter("herausforderung");
    const client = await getFirebase();
    if (!client) { setMpError(MP_CONFIGURED ? t('warnVerbindung') : t('fbMissing')); return; }
    setScreen("menu"); screenRef.current = "menu";
    setMpScreen("online");
    // hostCreateGame setzt mpCode und oeffnet die Lobby; das Teilen folgt
    // danach, weil der Code vorher noch nicht existiert.
    await hostCreateGame();
  }
  function shareResult(iWon, drawn) {
    const url = "https://skkjbeer.github.io/Fortress/";
    const emoji = drawn ? "\u{1F91D}" : iWon ? "\u{1F3C6}" : "\u{1F480}";
    const outcome = drawn ? t('shareTextDraw') : iWon ? t('shareTextWin') : t('shareTextLose');
    const text = `${emoji} ${outcome} — ${t('shareTextInvite')}`;
    if (navigator.share) {
      navigator.share({ title: "Stack & Siege", text, url }).catch(() => {});
    } else {
      const full = text + "\n" + url;
      const ta = document.createElement("textarea");
      ta.value = full; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    }
    setShareShared(true);
    setTimeout(() => setShareShared(false), 2500);
  }
  function copyCode() {
    const code = mpCode;
    const done = () => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2e3);
    };
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) {
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(fallback);
    } else fallback();
  }
  // Ein-Tap-Einladung (v3.40.1): teilt den vollen Deeplink statt nur den Code.
  // Der Freund tippt den Link an → landet direkt in der Lobby (guestJoinGame via
  // ?join=CODE beim Laden). navigator.share (WhatsApp/iMessage …), sonst Clipboard.
  function inviteFriend() {
    const code = mpCode;
    const link = "https://skkjbeer.github.io/Fortress/?join=" + code;
    const text = t('inviteText');
    const done = () => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2e3); };
    const clipFallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text + " " + link;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        done();
      } catch (e) {}
    };
    if (navigator.share) {
      navigator.share({ title: "Stack & Siege", text, url: link }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " " + link).then(done).catch(clipFallback);
    } else clipFallback();
  }
  const [pasteError, setPasteError] = useState("");
  function pasteCode() {
    setPasteError("");
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then((txt) => {
        const clean = (txt || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
        if (clean.length === 0) {
          setPasteError("Keine g\xFCltigen Zeichen in der Zwischenablage.");
          return;
        }
        setMpInput(clean);
      }).catch(() => {
        setPasteError("Einf\xFCgen nicht m\xF6glich \u2014 bitte Code manuell eintippen.");
      });
    } else {
      setPasteError("Einf\xFCgen wird hier nicht unterst\xFCtzt \u2014 bitte manuell eintippen.");
    }
  }
  const online = useRef(false);
  const myRole = useRef(0);
  const mpChannel = useRef(null);
  const joinPollRef = useRef(null);
  const mpCodeRef = useRef("");
  const lastPush = useRef(0);
  const pendingActions = useRef([]);
  const guestStateApplied = useRef(0);
  function showWarn(msg) {
    setWarn(msg);
    clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarn(null), 3e3);
  }
  function showPhaseBanner(ph, onDone) {
    phaseBannerKey.current += 1;
    bannerActive.current = true;
    setPhaseBanner(ph);
    clearTimeout(phaseBannerTimer.current);
    phaseBannerTimer.current = setTimeout(() => {
      bannerActive.current = false;
      setPhaseBanner(null);
      if (onDone) onDone();
    }, 2500);
  }
  const grid = useRef(null);
  const phase_r = useRef("build");
  const running = useRef(false);
  const animId = useRef(null);
  const timerID = useRef(null);
  const timerVal = useRef(BUILD_TIME);
  const scoresRef = useRef({ 1: 0, 2: 0 });
  const bgCanvas = useRef(null);
  const bgDirty = useRef(true);
  const floodCache = useRef({
    gridVersion: -1,
    outside: {},
    cannonOutside: {},
    castleClosed: {},
    // Legacy-Felder (2-Spieler-Kompatibilität)
    outsideP1: null,
    outsideP2: null,
    cannonOutsideP1: null,
    cannonOutsideP2: null,
    castleClosedP1: true,
    castleClosedP2: true
  });
  const gridVersion = useRef(0);
  const zoneCanvas = useRef(null);
  // Fließ-Adern des Flusses (v3.41.0): Kernzellen aus dem bgCanvas-Bake,
  // pro Frame als leichte Animationsebene darübergelegt.
  const riverFlow = useRef({ cells: [], anim: "255,255,255" });
  // Kontaktschatten-Ebene (v3.41.0): gebacken pro gridVersion, siehe Render-Loop.
  const shadowCanvas = useRef(null);
  const shadowSilhouette = useRef(null);
  const shadowKeyRef = useRef("");
  const zoneKeyRef = useRef("");
  function setGrid(newG) {
    grid.current = newG;
    gridVersion.current++;
  }
  function getFloodCache() {
    const fc = floodCache.current;
    const g = grid.current;
    if (!g || fc.gridVersion === gridVersion.current) return fc;
    const players = playersList();
    for (const p of players) {
      fc.outside[p] = computeOutsideMap(g, p);
      fc.cannonOutside[p] = computeOutsideMapForCannons(g, p);
      fc.castleClosed[p] = castles.current[p] ? isObjectClosed(fc.outside[p], castles.current[p]) : true;
    }
    fc.outsideP1 = fc.outside[1];
    fc.outsideP2 = fc.outside[2];
    fc.cannonOutsideP1 = fc.cannonOutside[1];
    fc.cannonOutsideP2 = fc.cannonOutside[2];
    fc.castleClosedP1 = fc.castleClosed[1];
    fc.castleClosedP2 = fc.castleClosed[2];
    fc.gridVersion = gridVersion.current;
    return fc;
  }
  const pieces = useRef({
    1: { cells: randomShape(), ghostR: null, ghostC: null },
    2: { cells: randomShape(), ghostR: null, ghostC: null }
  });
  const terrain = useRef(null);
  const castles = useRef({ 1: __spreadValues({}, CASTLE_P1), 2: __spreadValues({}, CASTLE_P2) });
  const cannons = useRef({ 1: [], 2: [] });
  const cannonSeq = useRef(0);
  const cannonBudget = useRef({ 1: 0, 2: 0 });
  // Schrott-Ökonomie (v3.16.0): Währung, gekaufte Upgrades, angeknackste Mauern
  const scrap = useRef({ 1: 0, 2: 0, 3: 0 });
  const upgrades = useRef({ 1: { reload: 0, armor: 0, repair: 0, cbought: 0 }, 2: { reload: 0, armor: 0, repair: 0, cbought: 0 }, 3: { reload: 0, armor: 0, repair: 0, cbought: 0 } });
  // ── Match-Statistik (v3.21.0, SPEC 14.2) ────────────────────────────────
  // Host-autoritativ gezählt, via State-Push synchronisiert. Speist den
  // Result-Screen und die Daily Tasks. buys zählt Rüstungs-Shop-Käufe.
  function msZero() { return { walls: 0, cannons: 0, scrap: 0, shots: 0, hits: 0, buys: 0 }; }
  const matchStats = useRef({ 1: msZero(), 2: msZero(), 3: msZero() });
  const telemetrySent = useRef(false);   // Telemetrie pro Match nur einmal (v3.47.0)
  function msOf(p) { return matchStats.current[p] || (matchStats.current[p] = msZero()); }
  const wallHp = useRef({});
  // „Fertig"-Bestätigung in der Rüstphase (v3.18.1): Sind alle aktiven Spieler
  // bereit, springt der Timer auf 3s (wenn > 3) — wie das Auto-Vorspulen im Setup.
  const armoryReady = useRef({ 1: false, 2: false, 3: false });
  // ── Emotes (v3.25.0) ────────────────────────────────────────────────────
  // Host-autoritativ: Gäste senden {type:'emote', e}; der Host prüft das
  // Rate-Limit (3s/Spieler), setzt emoteCur (State-Feld `emo`) und zeigt
  // lokal an. Gäste zeigen ausschließlich über das State-Echo (Dedupe via n).
  const emoteCur = useRef(null);
  const emoteSeq = useRef(0);
  const emoteLastAt = useRef({});
  const emoteSeen = useRef(0);
  const emoteHideTimer = useRef(null);
  const emoteSentAt = useRef(0);
  const [emoteShow, setEmoteShow] = useState(null);
  const [emoteBarOpen, setEmoteBarOpen] = useState(false);
  function displayEmote(p, e) {
    setEmoteShow({ p, e, key: Date.now() });
    clearTimeout(emoteHideTimer.current);
    emoteHideTimer.current = setTimeout(() => setEmoteShow(null), 2600);
  }
  function hostEmote(p, e) {
    const now = Date.now();
    if (now - (emoteLastAt.current[p] || 0) < 3000) return;
    emoteLastAt.current[p] = now;
    emoteCur.current = { p, e, n: ++emoteSeq.current };
    displayEmote(p, e);
  }
  function sendEmote(e) {
    const now = Date.now();
    if (now - emoteSentAt.current < 3000) return;
    emoteSentAt.current = now;
    setEmoteBarOpen(false);
    if (myRole.current === 1) { hostEmote(1, e); pushState(true); }
    else sendAction({ type: "emote", e });
  }
  function checkArmoryReady() {
    if (phase_r.current !== "cannon") return;
    const active = playersList().filter((p) => !eliminated.current[p]);
    if (active.length && active.every((p) => armoryReady.current[p]) && timerVal.current > 3) {
      timerVal.current = 3;
      setTimer(3);
    }
  }
  function setArmoryReady(player) {
    if (phase_r.current !== "cannon" || eliminated.current[player]) return;
    armoryReady.current[player] = true;
    setUiTick((t) => t + 1);
    checkArmoryReady();
    if (online.current && myRole.current === 1) pushState(true);
  }
  function confirmArmory(player) {
    if (online.current && myRole.current !== 1) { sendAction({ type: "ready" }); armoryReady.current[player] = true; setUiTick((t) => t + 1); return; }
    setArmoryReady(player);
  }
  // Kauf-Pop pro Karte (v3.17.0): Zähler erhöht → React-key ändert → Karte
  // remountet → shopBuyPop-Animation spielt erneut. Nur Optik.
  const shopBuyAnim = useRef({});
  // „+N Beute"-Popups (v3.16.3): am TREFFERORT in Spielerfarbe, wie explosions
  // über den State synchronisiert (Gäste sehen sie dadurch identisch).
  const scrapPops = useRef([]);
  // Reparatur-Highlight (v3.32.0): reparierte Zellen kurz grün markieren —
  // via State synchronisiert (wie scrapPops). Shop blendet währenddessen aus.
  const repairFx = useRef([]);
  const shopHideUntil = useRef({});
  function addScrapPop(x, y, amt, player) {
    scrapPops.current.push({ x, y, amt, player, frame: 0 });
    if (scrapPops.current.length > 24) scrapPops.current.shift();
  }
  function reloadMsOf(player) {
    const lvl = (upgrades.current[player] || {}).reload || 0;
    let ms = RELOAD_MS * SHOP.reload.factors[lvl];
    // ESKALATION (Experiment v3.52.0): jede Runde laedt schneller nach.
    // Fruehe Runden bleiben bedaechtig, spaete werden zum Trommelfeuer.
    const XE = balExp() || {};
    if (XE.eskal) {
      const f = Math.max(XE.eskalMin || 0.45,
        1 - (roundRefVal.current - 1) * (XE.eskal || 0.06));
      ms *= f;
    }
    return ms;
  }
  const warnedOpen = useRef({ 1: false, 2: false });
  const cannonAngle = useRef({ 1: Math.PI / 2, 2: -Math.PI / 2 });
  const balls = useRef([]);
  const explosions = useRef([]);
  const particles = useRef([]);
  const prevExplCount = useRef(0);
  const lastFrameTime = useRef(0);
  const waterCellsRef = useRef({ seed: null, cells: [] });
  const prevBigCount = useRef(0);
  const shakeRef = useRef(0);
  const reload = useRef({ 1: 1, 2: 1 });
  const lastShot = useRef({ 1: -99999, 2: -99999 });
  // AUFLADEN (Experiment v3.52.0): wer eine ganze Schussphase NICHT feuert,
  // sammelt Ladung — die naechste Salve schiesst entsprechend mehr Kugeln.
  // Damit ist "aussetzen und zuschlagen" eine echte Alternative zum Dauerfeuer.
  const salveCharge = useRef({ 1: 0, 2: 0, 3: 0 });
  const firedPhase = useRef({ 1: false, 2: false, 3: false });
  const pointers = useRef(/* @__PURE__ */ new Map());
  const activeDrag = useRef({ 1: null, 2: null });
  const activeBuild = useRef({ 1: null, 2: null });
  // Reset-Geste (v3.16.6): true wenn der Finger gerade über der Vorschau-Leiste
  // unterhalb des Spielfelds schwebt → Loslassen bricht die Platzierung ab.
  const cancelHover = useRef({ 1: false, 2: false, 3: false });
  const fitTimerRef = useRef(null);
  // Der Platz, den die Spiel-Huelle wirklich hat — also der Bildschirm ABZUEGLICH
  // der Sicherheitsbereiche. Bevorzugt am Element gemessen (clientHeight schliesst
  // die Polsterung schon aus); solange es die Huelle nicht gibt (Menue, erster
  // Lauf) aus den Polsterwerten des Koerpers gerechnet. Eine Quelle fuer beide
  // Faelle, damit die Zahl nicht an zwei Stellen auseinanderlaufen kann.
  function nutzRaum() {
    const el = wrapRef.current;
    if (el && el.clientHeight > 0 && el.clientWidth > 0) return { w: el.clientWidth, h: el.clientHeight };
    let oben = 0, unten = 0, links = 0, rechts = 0;
    try {
      const cs = getComputedStyle(document.body);
      oben = parseFloat(cs.paddingTop) || 0;
      unten = parseFloat(cs.paddingBottom) || 0;
      links = parseFloat(cs.paddingLeft) || 0;
      rechts = parseFloat(cs.paddingRight) || 0;
    } catch (e) { /* ohne Dokument: die vollen Masse */ }
    return { w: window.innerWidth - links - rechts, h: window.innerHeight - oben - unten };
  }
  useEffect(() => {
    function fit() {
      // getBoundingClientRect statt offsetHeight (v3.88.0): Die Kopfzeile
      // steht auf einem Tablett unter einer Zoomstufe, und `offsetHeight`
      // meldet dann die Hoehe VOR dem Zoom — gemessen 50 gegen gezeichnete 80.
      // Mit dem falschen Wert reserviert `fit` zu wenig, das Brett faellt zu
      // gross aus und die Unterleiste rutscht aus dem Bild. Der Kasten aus
      // getBoundingClientRect ist der gezeichnete.
      const hoeheVon = (el) => el ? el.getBoundingClientRect().height : 0;
      const topH = Math.ceil(hoeheVon(scoreBarRef.current) + (row3Ref.current ? hoeheVon(row3Ref.current) + 4 : 0));
      // v3.69.0: Die Unterleiste wird NICHT mehr gemessen, sondern berechnet.
      // Vorher ging ihre Isthöhe in `chrome` ein — dadurch konnte sie nie
      // wachsen, ohne das Brett zu verkleinern (Rückkopplung), und die
      // Resthöhe blieb als schwarzer Balken liegen. Jetzt reserviert `fit` nur
      // die MINDESThöhe und gibt den kompletten Rest an die Leiste weiter.
      // v3.88.0: Auf einem Tablett bekommt die Unterleiste mehr als das
      // Mindestmass. Vorher bekam sie dort GENAU das Mindestmass: Das Brett
      // ist auf dem iPad hoehenbegrenzt und braucht den ganzen Rest auf, also
      // blieben 52 px — und `pieceBox` (barH − 38, gedeckelt bei 24 nach
      // unten) fiel auf seinen KLEINSTEN Wert. Gemessen: Bauteil-Vorschau
      // 24 px auf dem iPad gegen 57 px auf dem iPhone. Das groessere Geraet
      // hatte die kleinere Vorschau. Die 96 kosten das Brett ~4 % Kantenlaenge
      // und geben der Vorschau das Dreifache.
      //
      // v3.85.0: NICHT window.innerHeight — das ist der ganze Bildschirm
      // einschliesslich der Sicherheitsbereiche. Gerechnet werden muss mit dem
      // Platz, den die Huelle wirklich hat; sonst faellt das Brett zu gross aus
      // und die Unterleiste bekommt eine Hoehe, die es nicht gibt. Auf dem
      // iPhone waren das 93 px zu viel — genau die fehlten unten.
      const raum = nutzRaum();
      const tablett = raum.w >= 700 && raum.h >= 900;
      // Anteilig statt fest: Ein iPad mini hat 1089 nutzbare Punkte, ein
      // 12,9-Zoll-iPad 1322. Ein fester Wert waere auf dem kleinen zu viel
      // und auf dem grossen zu wenig. 9,2 % liegt zwischen den 7 %, die die
      // Leiste vorher auf dem iPad bekam, und den 17 %, die sie auf einem
      // iPhone von selbst bekommt (dort ist das Brett BREITEN-begrenzt, also
      // faellt unten viel ab — auf dem iPad faellt gar nichts ab).
      // Der Deckel ist 118 und keine runde Zahl: Die Vorschau ist bei 76
      // gedeckelt und braucht daneben 42 fuer Polsterung, Abstand und
      // Beschriftung. Was die Leiste darueber hinaus bekaeme, sieht niemand —
      // auf einem Tablett ist das Brett hoehenbegrenzt, jeder dieser Punkte
      // fehlt also direkt am Brett.
      const BAR_MIN = tablett ? Math.min(118, Math.max(96, Math.round(raum.h * 0.092))) : 52;
      const vw = raum.w - 2;
      const vh = raum.h - topH - BAR_MIN - 8;
      const scale = Math.min(vw / W, vh / H, 1.4);
      const w = Math.floor(W * scale), h = Math.floor(H * scale);
      const bar = Math.max(BAR_MIN, Math.min(150, raum.h - topH - h - 8));
      // `voll` ist die volle nutzbare Breite — das Brett behaelt sein
      // Seitenverhaeltnis, Kopfzeile, Buehne und Unterleiste spannen darueber
      // hinaus bis an den Rand. Sonst stehen auf einem iPad links und rechts
      // je ~120 px schwarz, und der Schirm sieht aus wie ein vergroessertes
      // Telefonbild.
      const voll = raum.w;
      setViewSize((prev) => (prev.w === w && prev.h === h && prev.bar === bar && prev.top === topH && prev.voll === voll && prev.tablett === tablett)
        ? prev : { w, h, bar, top: topH, voll, tablett });
      clearTimeout(fitTimerRef.current);
      fitTimerRef.current = setTimeout(() => {
        if (canvasRef.current) canvasRect.current = canvasRef.current.getBoundingClientRect();
      }, 50);
    }
    fit();
    const onScroll = () => {
      if (canvasRef.current) canvasRect.current = canvasRef.current.getBoundingClientRect();
    };
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", onScroll, true);
    const ro = new ResizeObserver(fit);
    if (scoreBarRef.current) ro.observe(scoreBarRef.current);
    if (bottomBarRef.current) ro.observe(bottomBarRef.current);
    return () => {
      clearTimeout(fitTimerRef.current);
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", onScroll, true);
      ro.disconnect();
    };
  }, [phase, numPlayers]);
  // v3.90.0: Die Textbedienung von iOS wird nur AUSgeschaltet, solange das
  // Spielfeld oben ist — dort gibt es kein Eingabefeld, und dort erschien die
  // Lupe. Ueberall sonst bleibt sie an. Vorher war sie ab dem ersten Bild der
  // App aus; damit war das Namensfeld im Profil-Editor nicht zu bedienen.
  useEffect(() => { textbedienung(screen !== "game"); }, [screen]);
  function serializeState() {
    var _a2;
    const players = playersList();
    const rp = {};
    for (const p of players) rp[p] = Math.min(1, (performance.now() - ((_a2 = lastShot.current[p]) != null ? _a2 : -99999)) / reloadMsOf(p));
    return {
      pv: PROTO_VERSION,
      grid: grid.current,
      terrainSeed: terrainSeed.current,
      // Fingerabdruck der Sektorkarte (v3.111.0, nur 3 Spieler).
      //
      // Der Gast BERECHNET die Karte selbst neu, statt sie zu empfangen — das
      // ist deterministisch, solange beide dieselben Eingaben haben. Laufen
      // sie auseinander, darf der Gast scheinbar bauen und der Host lehnt ab:
      // fuer den Spieler sieht das aus, als reagiere das Spiel nicht, und im
      // Protokoll steht nichts, weil nichts abstuerzt.
      //
      // Ein zusaetzliches Feld ist rueckwaertsvertraeglich: Alte Gaeste lesen
      // es nicht, alte Hosts schicken es nicht, und der Gast prueft nur, wenn
      // es da ist. Deshalb bleibt PROTO_VERSION unveraendert.
      sh: terrain.current && terrain.current.sectorMap ? sectorFingerprint(terrain.current.sectorMap) : null,
      numPlayers: numPlayersRef.current,
      castles: castles.current,
      cannons: cannons.current,
      cannonBudget: cannonBudget.current,
      scrap: scrap.current,
      upgrades: upgrades.current,
      wallHp: wallHp.current,
      armoryReady: armoryReady.current,
      ms: matchStats.current,
      emo: emoteCur.current,
      piece1: pieces.current[1] && pieces.current[1].cells,
      piece2: pieces.current[2] && pieces.current[2].cells,
      piece3: pieces.current[3] && pieces.current[3].cells,
      balls: balls.current.map((b) => ({
        sx: b.sx,
        sy: b.sy,
        tx: b.tx,
        ty: b.ty,
        prog: b.prog,
        dur: b.dur,
        arcH: b.arcH,
        player: b.player,
        alive: b.alive
      })),
      explosions: explosions.current.map((e) => ({ x: e.x, y: e.y, frame: e.frame, big: e.big, fx: e.fx })),
      scrapPops: scrapPops.current.map((f) => ({ x: f.x, y: f.y, amt: f.amt, player: f.player, frame: f.frame })),
      repairFx: repairFx.current.map((f) => ({ r: f.r, c: f.c, frame: f.frame })),
      phase: phase_r.current,
      timer: timerVal.current,
      round: roundRefVal.current,
      scores: scoresRef.current,
      screen: screenRef.current,
      resultInfo: resultRef.current,
      lastShot: lastShot.current,
      reloadProg: rp,
      frozenReady: frozenReady.current,
      eliminated: eliminated.current,
      hostSession: SESSION_ID,
      playerInfo: playerInfo.current,
      t: Date.now()
    };
  }
  const roundRefVal = useRef(1);
  const screenRef = useRef("menu");
  const resultRef = useRef(null);
  const terrainSeed = useRef(0);
  const reloadProgRef = useRef(null);
  const lastSeenPhase = useRef(null);
  const playerInfo = useRef({ 1: { name: t('playerFallback', {n: 1}), wappen: "\u2654", color: "#2563eb" }, 2: { name: t('playerFallback', {n: 2}), wappen: "\u265A", color: "#dc2626" } });
  const lastStateAt = useRef(0);
  // ── Verbindungsstatus / Reconnect ──────────────────────────────────────────
  const [connLost, setConnLost] = useState(false);
  const connLostRef = useRef(false);
  const pushFails = useRef(0);
  const resubAttempted = useRef(false);
  const resubTries = useRef(0);      // Reconnect-Versuche (v3.70.0, Backoff)
  const nextResubAt = useRef(0);
  const connWatchdog = useRef(null);
  const gameDisconnectCancel = useRef(null);
  const everGotState = useRef(false);
  const disconnectEnding = useRef(false);
  // ── Herzschlag (v3.70.0) ───────────────────────────────────────────────────
  // Verlässt ein Gast das Spiel SAUBER, schickt er `leave` und handlePlayerLeft
  // regelt alles korrekt. Bricht er HART weg (App gekillt, Netz weg, Tab zu),
  // kommt gar nichts — der Host spielte danach gegen einen Geist weiter und
  // erfuhr nie, warum der Gegner nichts mehr tut. Es fehlte schlicht ein
  // Lebenszeichen: ein untätiger Gast schreibt sonst NIE etwas.
  const hbTimer = useRef(null);            // Gast: Schreib-Intervall
  const hbCancel = useRef(null);           // Gast: onDisconnect-Abbruchfunktion
  const hbMyRole = useRef(0);              // Gast: eigener Slot (leaveOnline nullt myRole vorher)
  const hbChannels = useRef({});           // Host: Abos je Gast-Slot
  const hbSeen = useRef({});               // Host: {2:{last,ever}, 3:{...}}
  const hbWatchdog = useRef(null);         // Host: Prüf-Intervall
  const [oppLost, setOppLost] = useState(null); // Name des vermissten Gegners
  const oppLostRef = useRef(null);
  const fbOnline = useRef(true);           // .info/connected — eigene Leitung
  // Fristen. `window.__hbFast` staucht sie fuer die E2E-Suite zusammen —
  // 30 s Wartezeit je Testfall waeren sonst untragbar (gleiche Bauart wie
  // __mmDebug/__balExp: Schalter nur fuer Diagnose und Tests).
  const HB_FAST = typeof window !== "undefined" && window.__hbFast;
  const HB_WRITE_MS = HB_FAST ? 400 : 3e3;        // Schreibtakt des Gastes
  const HB_WARN_MS  = HB_FAST ? 1600 : 10e3;      // → Banner "Gegner offline?"
  const HB_DROP_MS  = HB_FAST ? 4500 : 30e3;      // → Partie sauber beenden
  function setOpp(name) {
    if (oppLostRef.current === name) return;
    oppLostRef.current = name;
    setOppLost(name);
  }
  function setConn(lost) {
    if (connLostRef.current === lost) return;
    connLostRef.current = lost;
    setConnLost(lost);
  }
  // Gast: schreibt alle 3 s einen Zeitstempel nach games/{code}/hb{rolle}.
  // Zusätzlich onDisconnect-Löschung auf GENAU DIESEN Knoten — damit erkennt
  // der Host einen harten Abbruch sofort statt erst nach Ablauf der Frist.
  // (Die Regression aus v3.14.10 betraf das Löschen des SPIELKNOTENS; ein
  // eigener Herzschlag-Knoten ist davon nicht berührt — geht er verloren,
  // bleibt die Lobby bestehen.)
  function startHeartbeat(code, role) {
    stopHeartbeat();
    if (!code || role === 1) return;
    hbMyRole.current = role;
    const path = `games/${code}/hb${role}`;
    const beat = () => { fb.patch(`games/${code}`, { ["hb" + role]: Date.now() }); };
    beat();
    try { hbCancel.current = fb.onDisconnectRemove(path); } catch (e) {}
    hbTimer.current = setInterval(beat, HB_WRITE_MS);
  }
  function stopHeartbeat() {
    if (hbTimer.current) { clearInterval(hbTimer.current); hbTimer.current = null; }
    if (hbCancel.current) { try { hbCancel.current(); } catch (e) {} hbCancel.current = null; }
  }
  // Host: beobachtet die Herzschläge aller Gäste und beendet die Partie über
  // handlePlayerLeft — denselben Weg wie ein sauberes Verlassen. Dadurch
  // entstehen KEINE neuen ELO-/Ergebnis-Regeln: der Weggebliebene verliert,
  // genau wie der, der auf "Beenden" tippt.
  function startHostHeartbeatWatch(code, np) {
    stopHostHeartbeatWatch();
    const slots = np === 3 ? [2, 3] : [2];
    for (const p of slots) {
      hbSeen.current[p] = { last: 0, ever: false, val: 0 };
      hbChannels.current[p] = fb.subscribeRaw(`games/${code}/hb${p}`, (val, exists) => {
        const rec = hbSeen.current[p];
        if (!rec) return;
        if (!exists) { if (rec.ever) rec.last = 0; return; }  // Knoten weg (onDisconnect) = sofort tot
        if (typeof val !== "number") return;
        // NUR ein GEÄNDERTER Wert zählt als Lebenszeichen. Auf das blosse
        // Eintreffen eines Events zu vertrauen wäre falsch: liefert die
        // Zustellung denselben Stand erneut aus (Re-Emit, Wiederverbindung,
        // Ereignis am Elternknoten), hielte das einen toten Gast beliebig
        // lange am Leben — genau das hat der E2E-Test aufgedeckt.
        // Der Abstand wird auf der HOST-Uhr gemessen, nie im Vergleich zum
        // Zeitstempel des Gastes: fremde Uhren dürfen hier nichts entscheiden.
        if (val === rec.val) return;
        rec.val = val; rec.last = Date.now(); rec.ever = true;
      });
    }
    hbWatchdog.current = setInterval(() => {
      if (!online.current || myRole.current !== 1) return;
      if (screenRef.current === "result" || !gameStarted.current) return;
      // Eigene Leitung weg? Dann sind ALLE Herzschläge zwangsläufig still —
      // das ist kein Gast-Problem. Niemanden verdächtigen, erst recht keinen
      // rauswerfen; die Frist läuft weiter, sobald die Verbindung wieder steht.
      if (!fbOnline.current) {
        for (const p of slots) if (hbSeen.current[p]) hbSeen.current[p].last = Date.now();
        setOpp(null);
        return;
      }
      let vermisst = null;
      for (const p of slots) {
        const rec = hbSeen.current[p];
        if (!rec || !rec.ever) continue;              // nie da gewesen → nicht unser Fall
        if (eliminated.current[p]) continue;          // schon raus
        const still = rec.last === 0 ? HB_DROP_MS + 1 : Date.now() - rec.last;
        if (still > HB_DROP_MS) { handlePlayerLeft(p); continue; }
        if (still > HB_WARN_MS && !vermisst) {
          vermisst = (playerInfo.current[p] || {}).name || t('playerFallback', { n: p });
        }
      }
      setOpp(vermisst);
    }, HB_FAST ? 350 : 2e3);
  }
  function stopHostHeartbeatWatch() {
    if (hbWatchdog.current) { clearInterval(hbWatchdog.current); hbWatchdog.current = null; }
    for (const k of Object.keys(hbChannels.current)) {
      try { hbChannels.current[k].stop(); } catch (e) {}
    }
    hbChannels.current = {};
    hbSeen.current = {};
    setOpp(null);
  }
  // Gemeinsamer Gast-State-Handler: erkennt Löschung des Spielknotens (exists=false)
  // als sauberes Host-Spielende. Wird von startPolling und resubscribeGuestState genutzt.
  function guestStateHandler(stateStr, exists) {
    // Schutz vor Geister-Events (v3.14.11): nur reagieren wenn wir wirklich
    // gerade Online-Gast sind — ein verwaister Listener eines früheren Spiels
    // darf keine neue Session beenden.
    if (!online.current || myRole.current === 1) return;
    if (exists === false) {
      // Host hat das Spiel beendet/gelöscht — nur reagieren wenn das Spiel lief.
      // Auf dem Ergebnisbildschirm ignorieren (v3.14.14): Das Match ist vorbei,
      // der Gegner darf gehen, ohne uns von der ELO-Anzeige zu werfen.
      if (everGotState.current && screenRef.current !== "result") endOnlineDisconnected('warnHostEnded');
      return;
    }
    if (stateStr == null) return;
    lastStateAt.current = Date.now();
    everGotState.current = true;
    setConn(false);
    resubAttempted.current = false;
    resubTries.current = 0;
    nextResubAt.current = 0;
    dbgBump("statesRecv", "state empfangen (" + (typeof stateStr === "string" ? stateStr.length : "?") + "B)");
    try { applyState(JSON.parse(stateStr)); } catch (e) { dbg.current.lastErr = "applyState: " + e.message; }
    if (typeof window !== "undefined" && window.__mmDebug) window.__guestDbg = { recv: dbg.current.statesRecv, lastErr: dbg.current.lastErr, screen: screenRef.current, role: myRole.current, online: online.current };
  }
  // H-C: Gast verlässt sauber das Online-Spiel wenn der Host verschwindet
  // (Knoten gelöscht ODER Hard-Timeout). Kehrt ins Menü zurück mit Hinweis.
  function endOnlineDisconnected(reasonKey) {
    if (disconnectEnding.current) return;
    disconnectEnding.current = true;
    leaveOnline();
    showWarn(t(reasonKey));
    setTimeout(() => { disconnectEnding.current = false; }, 1500);
  }
  function resubscribeGuestState() {
    // Stoppt den State-Listener und baut ihn neu auf, um Firebase zu einem
    // sofortigen Reconnect zu bewegen (onValue liefert den letzten Stand erneut).
    if (!online.current || myRole.current === 1 || !mpCodeRef.current) return;
    try { if (mpChannel.current && mpChannel.current.stop) mpChannel.current.stop(); } catch (e) {}
    mpChannel.current = fb.subscribeRaw(`games/${mpCodeRef.current}/state`, guestStateHandler);
  }
  function applyState(raw) {
    let s;
    try {
      s = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      dbg.current.lastErr = "JSON parse";
      return;
    }
    const s0 = s;
    s = sanitizeState(s);
    if (!s) {
      dbg.current.lastErr = "sanitize FAIL grid=" + (Array.isArray(s0 == null ? void 0 : s0.grid) ? s0.grid.length : typeof (s0 == null ? void 0 : s0.grid)) + " phase=" + (s0 == null ? void 0 : s0.phase) + " timer=" + typeof (s0 == null ? void 0 : s0.timer);
      return;
    }
    // Protokoll-Versions-Check (v3.35.0): Host ist neuer als dieser Client →
    // einmalig freundlich auf Reload hinweisen statt still Geist-Bugs zu riskieren.
    if (typeof s.pv === "number" && s.pv > PROTO_VERSION && !protoWarned.current) {
      protoWarned.current = true;
      showWarn(t('protoOutdated'));
    }
    if (s.hostSession && s.hostSession !== hostSessionRef.current) {
      if (hostSessionRef.current) {
        dbg.current.lastErr = "session mismatch";
        return;
      }
      hostSessionRef.current = s.hostSession;
    }
    lastStateAt.current = Date.now();
    try {
      if (s.numPlayers && s.numPlayers !== numPlayersRef.current) {
        numPlayersRef.current = s.numPlayers;
        setNumPlayers(s.numPlayers);
      }
      if (online.current && myRole.current !== 1 && s.phase !== lastSeenPhase.current) {
        lastSeenPhase.current = s.phase;
        const np = s.numPlayers || numPlayersRef.current || 2;
        const pl = np === 3 ? [1, 2, 3] : [1, 2];
        activeBuild.current = pl.reduce((o, p) => (o[p] = null, o), {});
        activeDrag.current = pl.reduce((o, p) => (o[p] = null, o), {});
        pointers.current.clear();
        if (PHASE_BANNERS[s.phase]) showPhaseBanner(s.phase);
      }
      phase_r.current = s.phase;
      timerVal.current = s.timer;
      roundRefVal.current = s.round;
      scoresRef.current = s.scores;
      setPhase(s.phase);
      setTimer(s.timer);
      setRound(s.round);
      setScores(__spreadValues({}, s.scores));
      resultRef.current = s.resultInfo || null;
      setResultInfo(s.resultInfo || null);
      if (s.resultInfo && online.current && myRole.current !== 1 && !statRecorded.current) {
        statRecorded.current = true;
        const w = s.resultInfo.winner;
        const myWin = w === myRole.current ? true : w === null ? null : false;
        recordResult(myWin, s.resultInfo.numPlayers || numPlayersRef.current || 2);
      }
      const newScreen = s.screen || "game";
      if (newScreen !== screenRef.current) {
        screenRef.current = newScreen;
        setScreen(newScreen);
      }
      try {
        for (const p of playersList()) {
          if (!pieces.current[p]) pieces.current[p] = { cells: randomShape(), ghostR: null, ghostC: null };
        }
        setGrid(s.grid);
        const need3 = s.numPlayers === 3;
        const haveWrongTerrain = need3 && (!terrain.current || !terrain.current.mode3);
        if (s.terrainSeed && (s.terrainSeed !== terrainSeed.current || haveWrongTerrain)) {
          terrainSeed.current = s.terrainSeed;
          // WICHTIG (v3.15.3): seed in BEIDEN Zweigen anhängen — ohne ihn rendert
          // der Gast worldThemeOf(undefined) = immer Welt 0 (Theme-Desync!).
          terrain.current = need3 ? __spreadProps(__spreadValues({}, generateTerrain3FromSeed(s.terrainSeed)), { seed: s.terrainSeed }) : __spreadProps(__spreadValues({}, generateTerrainFromSeed(s.terrainSeed)), { seed: s.terrainSeed });
          bgDirty.current = true;
        }
        castles.current = s.castles || castles.current;
        if (need3 && terrain.current && terrain.current.mode3 && castles.current && !terrain.current.sectorMap) {
          terrain.current.sectorMap = buildSectorMap(terrain.current, castles.current);
        }
        // Stimmt meine selbst berechnete Karte mit der des Hosts ueberein?
        // (v3.111.0) Ein EINMALIGER Neuversuch, dann eine Meldung. Stillhalten
        // waere hier das Schlimmste: Der Spieler tippt, nichts passiert, und
        // niemand erfaehrt warum.
        if (need3 && myRole.current !== 1 && s.sh && terrain.current && terrain.current.sectorMap
            && !sektorGewarnt.current) {
          const meine = sectorFingerprint(terrain.current.sectorMap);
          if (meine && meine !== s.sh) {
            if (!sektorNeuversuch.current) {
              sektorNeuversuch.current = true;
              terrain.current.sectorMap = buildSectorMap(terrain.current, castles.current);
            } else if (sectorFingerprint(terrain.current.sectorMap) !== s.sh) {
              sektorGewarnt.current = true;
              showWarn(t('warnSektorAbweichung'));
            }
          }
        }
        cannons.current = s.cannons || cannons.current;
        cannonBudget.current = s.cannonBudget || cannonBudget.current;
        if (s.scrap) scrap.current = s.scrap;
        if (s.upgrades) upgrades.current = s.upgrades;
        wallHp.current = s.wallHp || {};
        if (s.armoryReady) armoryReady.current = s.armoryReady;
        // Match-Statistik (v3.21.0): Host-Zahlen übernehmen; fehlende Spieler-
        // Einträge auffüllen (Firebase lässt leere Objekte weg).
        if (s.ms) matchStats.current = { 1: s.ms[1] || msZero(), 2: s.ms[2] || msZero(), 3: s.ms[3] || msZero() };
        // Emote-Echo (v3.25.0): neue Sequenznummer → Bubble zeigen (nur Gast;
        // der Host hat lokal schon angezeigt).
        if (s.emo && s.emo.n && s.emo.n !== emoteSeen.current) {
          emoteSeen.current = s.emo.n;
          if (myRole.current !== 1) displayEmote(s.emo.p, s.emo.e);
        }
        if (s.scrapPops) scrapPops.current = s.scrapPops;
        if (s.repairFx) repairFx.current = s.repairFx;
        if (s.eliminated) eliminated.current = s.eliminated;
        if (s.piece1 && pieces.current[1]) pieces.current[1].cells = s.piece1;
        if (s.piece2 && pieces.current[2]) pieces.current[2].cells = s.piece2;
        if (s.piece3 && pieces.current[3]) pieces.current[3].cells = s.piece3;
        // trail-Array beim Empfang initialisieren (v3.32.5): serialisierte
        // Kugeln haben KEIN trail-Feld → `if (ball.trail)` im Render-Loop war
        // auf Gästen immer false → Gäste sahen GAR keine Kugel-Schweife, auch
        // keine gekauften Kosmetik-Trails aus dem Gold-Shop (v3.23.0).
        balls.current = (s.balls || []).map((b) => (b && !b.trail ? __spreadProps(__spreadValues({}, b), { trail: [] }) : b));
        explosions.current = s.explosions || [];
        lastShot.current = s.lastShot || { 1: -99999, 2: -99999, 3: -99999 };
        reloadProgRef.current = {
          1: s.reloadProg ? s.reloadProg[1] : 1,
          2: s.reloadProg ? s.reloadProg[2] : 1,
          3: s.reloadProg ? s.reloadProg[3] : 1,
          at: performance.now()
        };
        frozenReady.current = s.frozenReady || { 1: [], 2: [], 3: [] };
        if (s.playerInfo) playerInfo.current = s.playerInfo;
      } catch (e2) {
        dbg.current.lastErr = "applyObjects: " + e2.message;
      }
      setUiTick((t) => t + 1);
    } catch (e) {
      dbg.current.lastErr = "apply: " + e.message;
    }
  }
  const hostSessionRef = useRef("");
  const protoWarned = useRef(false); // Proto-Versions-Hinweis nur einmal je Session (v3.35.0)
  async function pushState(force) {
    if (!online.current || myRole.current !== 1) return;
    const now = Date.now();
    if (force) {
      lastPush.current = now;
      const s2 = serializeState();
      const ok2 = await fb.patch(`games/${mpCodeRef.current}`, { state: JSON.stringify(s2), updatedAt: now });
      hostPushResult(ok2);
      dbgBump("statesPush", ok2 === false ? "PUSH FEHLER: " + _fbError : "push ok (force)");
      return;
    }
    if (document.hidden) return;
    if (now - lastPush.current < 125) return;
    if (now - _pushWindow > 1e3) {
      _pushWindow = now;
      _pushCount = 0;
    }
    if (_pushCount >= 8) return;
    _pushCount++;
    lastPush.current = now;
    const s = serializeState();
    const ok = await fb.patch(`games/${mpCodeRef.current}`, { state: JSON.stringify(s), updatedAt: now });
    hostPushResult(ok);
    dbgBump("statesPush", ok === false ? "PUSH FEHLER: " + _fbError : "push ok");
  }
  // Host-Verbindungsstatus aus Push-Ergebnissen ableiten: 3 Fehler in Folge → Banner.
  function hostPushResult(ok) {
    if (ok === false) {
      pushFails.current++;
      if (pushFails.current >= 3) setConn(true);
    } else {
      pushFails.current = 0;
      setConn(false);
    }
  }
  async function sendAction(action) {
    if (!online.current || myRole.current === 1) return;
    const slot = "guestAction" + myRole.current;
    const ok = await fb.patch(`games/${mpCodeRef.current}`, {
      [slot]: JSON.stringify(__spreadProps(__spreadValues({}, action), { n: Date.now() }))
    });
    dbgBump("actSent", ok === false ? "SEND FEHLER: " + _fbError : "gesendet: " + action.type);
  }
  function handleGuestAction(raw, actingPlayer) {
    const a = sanitizeAction(raw);
    if (!a || myRole.current !== 1) return;
    if (a.type === "join") {
      const p2 = actingPlayer;
      const m3 = numPlayersRef.current === 3;
      playerInfo.current[p2] = {
        name: a.name || "Gast " + p2,
        wappen: a.wappen || (p2 === 2 ? "\u265A" : "\u265C"),
        color: a.color || (p2 === 2 ? "#dc2626" : "#059669"),
        elo: typeof a.elo === "number" ? a.elo : 1e3,
        trail: a.trail, frame: a.frame, // Kosmetik (v3.23.0), undefined = Standard
        cannon: typeof a.cannon === "string" && CANNON_SKIN[a.cannon] ? a.cannon : void 0,
        impact: typeof a.impact === "string" && IMPACT_FX[a.impact] ? a.impact : void 0
      };
      playerInfo.current[1] = {
        name: (profile == null ? void 0 : profile.name) || "Host",
        wappen: (profile == null ? void 0 : profile.wappen) || "\u2654",
        color: (profile == null ? void 0 : profile.color) || "#2563eb",
        elo: typeof (m3 ? profile == null ? void 0 : profile.elo3 : profile == null ? void 0 : profile.elo) === "number" ? m3 ? profile.elo3 : profile.elo : 1e3,
        trail: cosOf(profile).equipped.trail,
        frame: cosOf(profile).equipped.frame,
        cannon: cosOf(profile).equipped.cannon,
        impact: cosOf(profile).equipped.impact
      };
      joinedGuests.current[p2] = true;
      // Matchmaking: das Kandidat-Ticket dieses Gastes erst jetzt löschen, wo
      // der echte Beitritt bestätigt ist. Sind alle Kandidaten beigetreten,
      // wird der Watchdog gestoppt.
      if (mmPendingCandidates.current && mmPendingCandidates.current[p2]) {
        fb.delete(mmPendingCandidates.current[p2]);
        delete mmPendingCandidates.current[p2];
        const remaining = Object.keys(mmPendingCandidates.current);
        if (remaining.length === 0 && mmWatchdog.current) {
          clearTimeout(mmWatchdog.current);
          mmWatchdog.current = null;
        } else if (remaining.length > 0 && mmWatchdog.current) {
          // Erster Gast beigetreten, zweiter noch ausstehend — Watchdog
          // zurücksetzen damit der erste nicht nach kurzem Timeout rausfliegt.
          clearTimeout(mmWatchdog.current);
          const hostCode = mpCodeRef.current;
          mmWatchdog.current = setTimeout(() => {
            mmWatchdog.current = null;
            if (gameStarted.current) return;
            for (const k of Object.keys(mmPendingCandidates.current)) {
              fb.delete(mmPendingCandidates.current[k]);
            }
            mmPendingCandidates.current = {};
            const reNp = mmNp.current;
            mmAbandonHostGame(hostCode);
            startMatchmaking(reNp);
          }, MM_GUEST_JOIN_TIMEOUT_MS);
        }
      }
      const need = numPlayersRef.current === 3 ? 2 : 1;
      const have = (joinedGuests.current[2] ? 1 : 0) + (joinedGuests.current[3] ? 1 : 0);
      if (!gameStarted.current && have >= need) {
        gameStarted.current = true;
        startOnlineGame(1);
      } else if (!gameStarted.current) {
        setUiTick((t) => t + 1);
      } else {
        pushState(true);
        setTimeout(() => pushState(true), 300);
        setTimeout(() => pushState(true), 700);
      }
      return;
    }
    if (!gameStarted.current) return;
    if (a.type === "leave") {
      handlePlayerLeft(actingPlayer);
      return;
    }
    if (!joinedGuests.current[actingPlayer]) {
      joinedGuests.current[actingPlayer] = true;
      if (!playerInfo.current[actingPlayer]) {
        playerInfo.current[actingPlayer] = {
          name: "Gast " + actingPlayer,
          wappen: actingPlayer === 2 ? "\u265A" : "\u265C",
          color: actingPlayer === 2 ? "#dc2626" : "#059669"
        };
      }
    }
    if (!pieces.current[actingPlayer]) {
      pieces.current[actingPlayer] = { cells: randomShape(), ghostR: null, ghostC: null };
    }
    if (a.n && a.n <= (guestActionApplied.current[actingPlayer] || 0)) return;
    guestActionApplied.current[actingPlayer] = a.n || 0;
    const p = actingPlayer;
    const ph = phase_r.current;
    if (a.type === "place" && ph === "build") placePiece(p, a.r, a.c);
    else if (a.type === "cannon" && (ph === "setup" || ph === "cannon")) placeCannon(p, a.r, a.c);
    else if (a.type === "buy" && ph === "cannon") buyUpgrade(p, a.item);
    else if (a.type === "salvo") {
      // Host-autoritativ: der Gast zahlt dieselbe Umruestzeit. Ohne das koennte
      // ein Gast beliebig oft gratis wechseln.
      const neu = a.m === "slayer" ? "slayer" : "std";
      if (salvenModus.current[p] !== neu
          && performance.now() - (salvoSwitchAt.current[p] || -99999) >= SALVO_LOCK_MS) {
        salvenModus.current[p] = neu;
        salvoSwitchAt.current[p] = performance.now();
      }
    }
    else if (a.type === "ready" && ph === "cannon") setArmoryReady(p);
    else if (a.type === "fire" && ph === "shoot") fireMortar(p, a.tx, a.ty);
    else if (a.type === "aim") cannonAngle.current[p] = a.angle;
    else if (a.type === "rotate") pieces.current[p].cells = rotateCW(pieces.current[p].cells);
    else if (a.type === "emote") hostEmote(p, a.e);
    pushState(true);
  }
  const joinedGuests = useRef({ 2: false, 3: false });
  // Sektorkarten-Abgleich (v3.111.0): einmal neu berechnen, dann einmal melden.
  const sektorNeuversuch = useRef(false);
  const sektorGewarnt = useRef(false);
  const guestActionApplied = useRef({ 2: 0, 3: 0 });
  function handlePlayerLeft(player) {
    if (myRole.current !== 1) return;
    if (eliminated.current[player]) return;
    eliminated.current[player] = true;
    joinedGuests.current[player] = false;
    const players = playersList();
    const stillIn = players.filter((p) => !eliminated.current[p]);
    const pname = (x) => {
      var _a2;
      return ((_a2 = playerInfo.current[x]) == null ? void 0 : _a2.name) || t('playerFallback', {n: x});
    };
    if (stillIn.length <= 1) {
      running.current = false;
      clearInterval(timerID.current);
      const winner = stillIn.length === 1 ? stillIn[0] : null;
      if (winner) {
        const ns = __spreadProps(__spreadValues({}, scoresRef.current), { [winner]: (scoresRef.current[winner] || 0) + 1 });
        scoresRef.current = ns;
        setScores(__spreadValues({}, ns));
      }
      const info = { loser: player, winner, reason: "left", numPlayers: numPlayersRef.current };
      resultRef.current = info;
      screenRef.current = "result";
      phase_r.current = "result";
      setResultInfo(info);
      setPhase("result");
      setScreen("result");
      if (!statRecorded.current) {
        statRecorded.current = true;
        const myWin = winner === myRole.current ? true : winner === null ? null : false;
        recordResult(myWin, numPlayersRef.current);
      }
      // Nur der Host schreibt Telemetrie — sonst läge jedes Online-Match
      // mehrfach in den Daten (einmal je Gerät).
      if (!online.current || myRole.current === 1) pushTelemetry(winner);
      pushState(true);
      setTimeout(() => pushState(true), 300);
      setTimeout(() => pushState(true), 800);
    } else {
      showWarn(t('warnVerlassen', {name: pname(player)}));
      setUiTick((t) => t + 1);
      pushState(true);
    }
  }
  function startPolling(code, role) {
    if (typeof window !== "undefined" && window.__mmDebug) window.__myRole = role;
    if (mpChannel.current) {
      mpChannel.current.stop();
      mpChannel.current = null;
    }
    if (mpChannel2.current) {
      mpChannel2.current.stop();
      mpChannel2.current = null;
    }
    lastStateAt.current = Date.now();
    setConn(false);
    resubAttempted.current = false;
    everGotState.current = false;
    disconnectEnding.current = false;
    resubTries.current = 0;
    nextResubAt.current = 0;
    stopHeartbeat();
    stopHostHeartbeatWatch();
    if (role !== 1) {
      startHeartbeat(code, role);
      mpChannel.current = fb.subscribeRaw(`games/${code}/state`, guestStateHandler);
      // Verbindungs-Watchdog: nach 6s ohne State → "verbunden?"-Banner + einmaliger
      // Reconnect-Versuch. Banner verschwindet automatisch sobald wieder State fließt.
      // Nach 30s ohne State → H-C: Host gilt als verloren, sauber zurück ins Menü.
      const timeoutCheck = setInterval(() => {
        if (!online.current) {
          clearInterval(timeoutCheck);
          return;
        }
        const stale = Date.now() - lastStateAt.current;
        // Ergebnisbildschirm: Match vorbei, Host pusht nichts mehr — kein Timeout (v3.14.14).
        if (screenRef.current === "result") return;
        if (stale > 30e3 && everGotState.current) {
          clearInterval(timeoutCheck);
          endOnlineDisconnected('warnHostLost');
          return;
        }
        // Tote Lobby (v3.14.15): beigetreten, aber NIE State bekommen — der Host
        // ist weg (normal pusht er sofort nach dem Join). Nach 45s sauber raus,
        // statt ewig auf dem Wartescreen zu hängen.
        if (stale > 45e3 && !everGotState.current) {
          clearInterval(timeoutCheck);
          endOnlineDisconnected('warnHostLost');
          return;
        }
        if (stale > 6e3) {
          setConn(true);
          // v3.70.0: vorher genau EIN Versuch (`resubAttempted`) — half der
          // nicht, passierte bis zum harten 30-s-Abbruch nichts mehr. Jetzt
          // wird mit wachsendem Abstand weiter versucht (4/6/8/… bis 12 s).
          const now = Date.now();
          if (now >= nextResubAt.current) {
            resubTries.current++;
            nextResubAt.current = now + Math.min(12e3, 2e3 + resubTries.current * 2e3);
            resubscribeGuestState();
          }
        }
      }, 2e3);
      connWatchdog.current = timeoutCheck;
      const origStop = mpChannel.current.stop;
      mpChannel.current.stop = () => {
        clearInterval(timeoutCheck);
        stopHeartbeat();
        origStop();
      };
    } else {
      startHostHeartbeatWatch(code, numPlayersRef.current || 2);
      mpChannel.current = fb.subscribe(`games/${code}/guestAction2`, (actionStr) => {
        dbgBump("actRecv", "Aktion P2");
        handleGuestAction(actionStr, 2);
      });
      mpChannel2.current = fb.subscribe(`games/${code}/guestAction3`, (actionStr) => {
        dbgBump("actRecv", "Aktion P3");
        handleGuestAction(actionStr, 3);
      });
    }
  }
  const mpChannel2 = useRef(null);
  async function hostCreateGame() {
    setMpError("");
    const client = await getFirebase();
    if (!client) {
      setMpError(MP_CONFIGURED ? t('warnVerbindung') + " " + _fbError : t('fbMissing'));
      return;
    }
    botMode.current = false;
    tutorialMode.current = false;
    mmMatched.current = false;
    gcOwnStaleGame();
    const code = makeCode();
    const ok = await fb.set(`games/${code}`, {
      createdAt: Date.now(),
      state: null,
      guestAction2: null,
      guestAction3: null,
      numPlayers: numPlayersRef.current
      // 2 oder 3 → Gäste lesen das aus
    });
    if (!ok) {
      setMpError("Konnte Spiel nicht anlegen: " + _fbError);
      return;
    }
    try { localStorage.setItem("fortress_my_game", JSON.stringify({ code, ts: Date.now() })); } catch (e) {}
    mpCodeRef.current = code;
    myRole.current = 1;
    online.current = true;
    gameStarted.current = false;
    joinedGuests.current = { 2: false, 3: false };
    guestActionApplied.current = { 2: 0, 3: 0 };
    mmPendingCandidates.current = {};
    hostSessionRef.current = SESSION_ID;
    statRecorded.current = false;
    telemetrySent.current = false;
    scarCount.current = {}; scars.current = {};
    // KEIN onDisconnect-Auto-Löschen des Spielknotens mehr (v3.14.10):
    // Mobile Browser trennen die Firebase-Verbindung schon beim kurzen App-Wechsel
    // (z.B. Code per WhatsApp teilen) → der Server löschte das Spiel, der Gast fand
    // den Code nicht mehr. Verwaiste Knoten sind das kleinere Übel; sauberes
    // Verlassen löscht weiterhin explizit (cleanupGame), Gäste haben Watchdogs.
    gameDisconnectCancel.current = null;
    setMpCode(code);
    setMpScreen("waiting");
    startPolling(code, 1);
  }
  const gameStarted = useRef(false);
  async function guestJoinGame(explicitCode) {
    setMpError("");
    // explicitCode kommt vom Deeplink (?join=CODE); als onClick-Handler wird
    // stattdessen ein Event übergeben → nur echte Strings akzeptieren.
    const code = ((typeof explicitCode === "string" ? explicitCode : mpInput) || "").trim().toUpperCase();
    if (code.length !== 6) {
      setMpError(t('warnCode6'));
      return;
    }
    const client = await getFirebase();
    if (!client) {
      setMpError(MP_CONFIGURED ? t('warnVerbindung') + " " + _fbError : t('fbMissing'));
      return;
    }
    botMode.current = false;
    tutorialMode.current = false;
    mmMatched.current = false;
    const data = await fb.get(`games/${code}`);
    if (!data) {
      setMpError(t('warnSpielNichtGefunden'));
      return;
    }
    // Verwaiste Lobby: nie gestartet (kein State) und älter als 2h → Host ist weg.
    // Beim Join-Versuch aufräumen und wie "nicht gefunden" behandeln (v3.14.10).
    if (!data.state && Date.now() - (data.createdAt || 0) > 72e5) {
      fb.delete(`games/${code}`);
      setMpError(t('warnSpielNichtGefunden'));
      return;
    }
    const np = data.numPlayers || 2;
    numPlayersRef.current = np;
    setNumPlayers(np);
    const myElo = np === 3 ? typeof (profile == null ? void 0 : profile.elo3) === "number" ? profile.elo3 : 1e3 : typeof (profile == null ? void 0 : profile.elo) === "number" ? profile.elo : 1e3;
    const joinPayload = (role2) => JSON.stringify({
      type: "join",
      n: Date.now(),
      name: (profile == null ? void 0 : profile.name) || "Gast " + role2,
      wappen: (profile == null ? void 0 : profile.wappen) || (role2 === 2 ? "\u265A" : "\u265C"),
      color: (profile == null ? void 0 : profile.color) || (role2 === 2 ? "#dc2626" : "#059669"),
      elo: myElo,
      trail: cosOf(profile).equipped.trail,
      frame: cosOf(profile).equipped.frame,
      cannon: cosOf(profile).equipped.cannon,
      impact: cosOf(profile).equipped.impact
    });
    let role = 0;
    if (await fb.reserve(`games/${code}/guestAction2`, joinPayload(2))) {
      role = 2;
    } else if (np === 3 && await fb.reserve(`games/${code}/guestAction3`, joinPayload(3))) {
      role = 3;
    }
    if (!role) {
      setMpError(np === 3 ? t('warnSpielVoll3') : t('warnSpielVoll'));
      return;
    }
    mpCodeRef.current = code;
    myRole.current = role;
    online.current = true;
    hostSessionRef.current = "";
    // ⚠ ELO-Fix (v3.30.3): Gast-Eintrittspfad — siehe mmJoinMatchedGame.
    statRecorded.current = false;
    telemetrySent.current = false;
    scarCount.current = {}; scars.current = {};
    eloChangeRef.current = null;
    goldChangeRef.current = null;
    xpChangeRef.current = null;
    matChangeRef.current = null;
    setMpCode(code);
    startPolling(code, role);
    setMpScreen("waiting");
  }
  // Deeplink-Beitritt (v3.40.1): ?join=CODE beim Laden → direkt in die Lobby.
  // Verwandelt die Einladung von „Code abtippen" (4 Schritte) in einen Tap.
  const deepJoinHandled = useRef(false);
  useEffect(() => {
    if (deepJoinHandled.current) return;
    deepJoinHandled.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const code = (params.get("join") || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
      if (code.length !== 6) return;
      // URL bereinigen, damit ein Reload nicht erneut auto-joint.
      try { window.history.replaceState(null, "", window.location.pathname); } catch (e) {}
      setMpInput(code);
      setMpScreen("joining");
      // kurzer Tick, damit Firebase/Profil bereitstehen; scheitert der Join
      // (Spiel weg/voll), bleibt der Code im Feld → Nutzer sieht Fehler + Retry.
      setTimeout(() => { guestJoinGame(code); }, 400);
    } catch (e) {}
  }, []);
  // ───────────────── Matchmaking (2 oder 3 Spieler) ─────────────────
  // Statt aktiv einen Code zu teilen, trägt sich der Spieler in
  // /queue2/{SESSION_ID} (2-Spieler) bzw. /queue3/{SESSION_ID} (3-Spieler) ein.
  // Getrennte Queues, damit 2er- und 3er-Suchende sich nie vermischen.
  // Jeder wartende Client sucht selbst per onValue-Snapshot nach passenden
  // Gegnern (ELO-Differenz innerhalb eines mit der Wartezeit wachsenden Radius)
  // und claimt sie atomar per Transaktion (kein Cloud Functions nötig, bleibt im
  // kostenlosen Spark-Plan). Bei 3 Spielern sammelt der Initiator zwei Gegner
  // und wird Host; bei einem Teil-Claim werden bereits geclaimte Tickets wieder
  // freigegeben. Der Claimer wird automatisch Host.
  function mmQueueName() {
    return mmNp.current === 3 ? "queue3" : "queue2";
  }
  function myEloForMode(np) {
    if (np === 3) return typeof (profile == null ? void 0 : profile.elo3) === "number" ? profile.elo3 : 1e3;
    return typeof (profile == null ? void 0 : profile.elo) === "number" ? profile.elo : 1e3;
  }
  function stopMatchmakingListeners(deleteTicket) {
    if (mmChannel.current) {
      mmChannel.current.stop();
      mmChannel.current = null;
    }
    if (mmTickTimer.current) {
      clearInterval(mmTickTimer.current);
      mmTickTimer.current = null;
    }
    if (mmDisplayTimer.current) {
      clearInterval(mmDisplayTimer.current);
      mmDisplayTimer.current = null;
    }
    if (mmHealTimer.current) {
      clearTimeout(mmHealTimer.current);
      mmHealTimer.current = null;
    }
    if (mmCancelDisconnect.current) {
      mmCancelDisconnect.current();
      mmCancelDisconnect.current = null;
    }
    if (deleteTicket) fb.delete(`${mmQueueName()}/${SESSION_ID}`);
  }
  function mmScheduleClaimHeal(claimTs) {
    if (mmHealTimer.current && mmHealFor.current === claimTs) return;
    if (mmHealTimer.current) {
      clearTimeout(mmHealTimer.current);
      mmHealTimer.current = null;
    }
    mmHealFor.current = claimTs;
    mmHealTimer.current = setTimeout(async () => {
      mmHealTimer.current = null;
      if (!mmActive.current) return;
      const qn = mmQueueName();
      // Transaktional heilen — nie ein gelöschtes Ticket wiederbeleben (v3.15.3)
      await fb.transact(`${qn}/${SESSION_ID}`, (cur) => {
        if (!cur || cur.status !== "claiming" || cur.claimTs !== claimTs) return;
        return { ...cur, status: "waiting", claimBy: null, claimTs: null };
      });
    }, MM_CLAIM_HEAL_MS);
  }
  async function mmJoinMatchedGame(code, role, np) {
    trichter("gegner_gefunden", { wartete: mmElapsed, np, rolle: role });
    // Tiefenverteidigung (v3.15.2): niemals als Gast in ein Spiel joinen,
    // das ich selbst hoste — und nur echte Gast-Rollen (2/3) akzeptieren.
    if (myRole.current === 1 && mpCodeRef.current === code) return;
    if (role !== 2 && role !== 3) {
      fb.delete(`${mmQueueName()}/${SESSION_ID}`);
      startMatchmaking(np === 3 ? 3 : 2);
      return;
    }
    np = np === 3 ? 3 : 2;
    stopMatchmakingListeners(false);
    fb.delete(`${np === 3 ? "queue3" : "queue2"}/${SESSION_ID}`);
    numPlayersRef.current = np;
    setNumPlayers(np);
    const joinPayload = JSON.stringify({
      type: "join",
      n: Date.now(),
      name: (profile == null ? void 0 : profile.name) || ("Gast " + role),
      wappen: (profile == null ? void 0 : profile.wappen) || (role === 2 ? "♚" : "♜"),
      color: (profile == null ? void 0 : profile.color) || (role === 2 ? "#dc2626" : "#059669"),
      elo: myEloForMode(np),
      trail: cosOf(profile).equipped.trail,
      frame: cosOf(profile).equipped.frame,
      cannon: cosOf(profile).equipped.cannon,
      impact: cosOf(profile).equipped.impact
    });
    // Existenz-Check (v3.15.3): Ist das Spiel schon wieder weg (Host-Watchdog/
    // Abbruch, veralteter matched-Status), NICHT per Reserve einen Orphan-Knoten
    // erzeugen — direkt weitersuchen.
    const gameData = await fb.get(`games/${code}`);
    if (!gameData || !gameData.createdAt) {
      startMatchmaking(np);
      return;
    }
    const got = await fb.reserve(`games/${code}/guestAction${role}`, joinPayload);
    if (!got) {
      setMpError(t('warnSpielVoll'));
      startMatchmaking(np);
      return;
    }
    mmMatched.current = true;
    mpCodeRef.current = code;
    myRole.current = role;
    online.current = true;
    hostSessionRef.current = "";
    // ⚠ ELO-Fix (v3.30.3): Gäste durchlaufen NIE startOnlineGame (das läuft nur
    // beim Host) — ohne diesen Reset blieb statRecorded aus dem VORIGEN Spiel
    // true und applyState verbuchte für alle Folge-Spiele der Session weder
    // Stats noch ELO. Muss in JEDEM Gast-Eintrittspfad stehen.
    statRecorded.current = false;
    telemetrySent.current = false;
    scarCount.current = {}; scars.current = {};
    eloChangeRef.current = null;
    goldChangeRef.current = null;
    xpChangeRef.current = null;
    matChangeRef.current = null;
    setMpCode(code);
    startPolling(code, role);
    setMpScreen("waiting");
  }
  function mmAbandonHostGame(code) {
    online.current = false;
    myRole.current = 0;
    hostSessionRef.current = "";
    cleanupGame(code, false);
    mpCodeRef.current = "";
  }
  function mmBecomeHost(code, pendingPaths) {
    mmActive.current = false;
    mmMatched.current = true;
    stopMatchmakingListeners(false);
    mpCodeRef.current = code;
    myRole.current = 1;
    online.current = true;
    numPlayersRef.current = mmNp.current;
    setNumPlayers(mmNp.current);
    gameStarted.current = false;
    joinedGuests.current = { 2: false, 3: false };
    guestActionApplied.current = { 2: 0, 3: 0 };
    hostSessionRef.current = SESSION_ID;
    statRecorded.current = false;
    telemetrySent.current = false;
    scarCount.current = {}; scars.current = {};
    setMpCode(code);
    setMpScreen("waiting");
    startPolling(code, 1);
    // Eigenes Ticket wird nicht mehr gebraucht (wir wissen bereits, dass wir
    // gematcht sind). Die Kandidaten-Tickets bleiben aber bestehen, bis der
    // jeweilige Gast tatsächlich beigetreten ist (siehe handleGuestAction
    // "join") — eine fixe Lösch-Verzögerung wäre ein Race: wenn ein Gast seinen
    // "matched"-Status erst nach Ablauf der Verzögerung liest, verliert er
    // sein Ticket, bevor er je davon erfahren hat, und hängt für immer in
    // der Suche fest.
    fb.delete(`${mmQueueName()}/${SESSION_ID}`);
    mmPendingCandidates.current = { ...pendingPaths };
    if (mmWatchdog.current) clearTimeout(mmWatchdog.current);
    mmWatchdog.current = setTimeout(() => {
      mmWatchdog.current = null;
      if (gameStarted.current) return;
      for (const k of Object.keys(mmPendingCandidates.current)) {
        fb.delete(mmPendingCandidates.current[k]);
      }
      mmPendingCandidates.current = {};
      const reNp = mmNp.current;
      mmAbandonHostGame(code);
      startMatchmaking(reNp);
    }, MM_GUEST_JOIN_TIMEOUT_MS);
  }
  async function mmClaimAndMatch(candidateIds) {
    const qn = mmQueueName();
    const np = mmNp.current;
    const claimTs = Date.now();
    // Letzte Sicherung: keinen Kandidaten claimen der ich selbst bin (Selbst-Match)
    const my = mmQueueSnapshot.current[SESSION_ID];
    for (const cid of candidateIds) {
      const cTk = mmQueueSnapshot.current[cid];
      if (!cTk || !my) continue;
      const samePid = my.pid && cTk.pid && my.pid === cTk.pid;
      const sameDev = cTk.dev && cTk.dev === DEVICE_ID;
      if (samePid || sameDev) {
        fb.delete(`${qn}/${cid}`); // Zombie-Ticket entfernen (eigener alter Tab / eigenes Gerät)
        return; // kein Match
      }
    }
    // Schritt 0 (v3.14.13): EIGENES Ticket zuerst atomar auf 'claiming' setzen.
    // Schließt die Race "gleichzeitig claimen & geclaimt werden" bei Snapshot-
    // Versatz: sobald wir nicht mehr 'waiting' sind, kann uns niemand claimen —
    // und wurden wir bereits geclaimt, brechen wir ab und folgen dem Match.
    const selfRes = await fb.transact(`${qn}/${SESSION_ID}`, (cur) => {
      if (!cur || cur.status !== "waiting") return;
      return { ...cur, status: "claiming", claimBy: SESSION_ID, claimTs };
    });
    if (!selfRes.committed) return;
    // Freigaben NUR über Transaktionen "wenn Ticket noch existiert" (v3.15.3):
    // Ein blinder Patch auf ein inzwischen gelöschtes Ticket erschuf sonst
    // einen matchbaren 'waiting'-GEIST ohne Besitzer — Dritte matchten sich
    // scheinbar mit Spielern, die längst im Spiel waren.
    const reviveToWaiting = (path) => fb.transact(path, (cur) => {
      if (!cur) return; // gelöscht → gelöscht lassen, nie wiederbeleben
      return { ...cur, status: "waiting", claimBy: null, claimTs: null };
    });
    const releaseSelf = () => mmActive.current
      ? reviveToWaiting(`${qn}/${SESSION_ID}`)
      : fb.delete(`${qn}/${SESSION_ID}`);
    if (!mmActive.current) { await releaseSelf(); return; }
    const claimed = [];
    const releaseAll = async () => {
      for (const rid of claimed) {
        await reviveToWaiting(`${qn}/${rid}`);
      }
      await releaseSelf();
    };
    // Alle (np-1) Kandidaten nacheinander atomar claimen. Schlägt einer fehl
    // (jemand anderes war schneller), werden die bereits geclaimten freigegeben.
    for (const cid of candidateIds) {
      const { committed, value } = await fb.transact(`${qn}/${cid}`, (current) => {
        // ts-Pflicht: nie einen felderlosen Geist claimen (v3.15.3)
        if (!current || current.status !== "waiting" || !current.ts) return;
        return { ...current, status: "claiming", claimBy: SESSION_ID, claimTs };
      });
      if (!committed || !value || value.claimBy !== SESSION_ID) {
        await releaseAll();
        return;
      }
      claimed.push(cid);
    }
    // Abbruch-Prüfung: Suche wurde während der Claims beendet → alles freigeben.
    if (!mmActive.current) {
      await releaseAll();
      return;
    }
    const code = makeCode();
    const ok = await fb.set(`games/${code}`, {
      createdAt: Date.now(),
      state: null,
      guestAction2: null,
      guestAction3: null,
      numPlayers: np
    });
    if (!ok) {
      await releaseAll();
      return;
    }
    // Abbruch-Prüfung nach Spielanlage: Knoten wieder löschen, Tickets freigeben.
    if (!mmActive.current) {
      await releaseAll();
      fb.delete(`games/${code}`);
      return;
    }
    // Crash-Marker: eigener Spielknoten — wird bei sauberem Verlassen entfernt,
    // nach einem Absturz beim nächsten Online-Einstieg aufgeräumt (v3.14.15).
    try { localStorage.setItem("fortress_my_game", JSON.stringify({ code, ts: Date.now() })); } catch (e) {}
    // Kein onDisconnect-Auto-Löschen — Begründung siehe hostCreateGame (v3.14.10).
    gameDisconnectCancel.current = null;
    // Rollen vergeben: Kandidaten bekommen Rolle 2, 3, …; ich selbst Rolle 1.
    const pendingPaths = {};
    let role = 2;
    for (const cid of claimed) {
      await fb.patch(`${qn}/${cid}`, { status: "matched", code, role });
      pendingPaths[role] = `${qn}/${cid}`;
      role++;
    }
    // WICHTIG (v3.15.2): Das EIGENE Ticket NICHT auf 'matched' patchen!
    // Die eigene Queue-Subscription pushte das Update sofort zurück →
    // mmOnQueueUpdate hielt es für ein Fremd-Match, mmJoinMatchedGame zwang
    // role 1 → 2 und der Host jointe als Gast IN SEIN EIGENES SPIEL
    // (Selbst-Match!). mmBecomeHost löscht das Ticket ohnehin sofort.
    mmBecomeHost(code, pendingPaths);
  }
  async function mmTryFindMatch() {
    if (mmBusy.current) return;
    const data = mmQueueSnapshot.current;
    const my = data[SESSION_ID];
    if (!my || my.status !== "waiting") return;
    const np = mmNp.current;
    const qn = mmQueueName();
    const now = Date.now();
    // ── Deterministisches globales Pairing (v3.14.13) ──────────────────────
    // ALLE Clients berechnen aus demselben Queue-Snapshot dieselbe Gruppen-
    // Zuteilung: ELO-sortierte Liste, gierig benachbarte 2er-/3er-Gruppen,
    // pro Gruppe claimt GENAU der Client mit der kleinsten Session-ID.
    // Das alte Verfahren (jeder wählt seinen ELO-nächsten Wunschgegner und
    // claimt nur bei kleinerer eigener ID) bildete ab ~15 Wartenden
    // Präferenz-Ketten ohne zuständigen Claimer → Livelock, niemand matchte.
    const wait = [];
    const seen = mmHbSeen.current;
    for (const k of Object.keys(seen)) if (!data[k]) delete seen[k]; // Karteileichen der Beobachtung
    for (const [id, tk] of Object.entries(data)) {
      if (!tk || tk.status !== "waiting") continue;
      if (id !== SESSION_ID) {
        // Wohlgeformtheit (v3.15.3): echte Tickets haben immer ts UND pid/dev.
        // Geister (aus Patch-Wiederbelebung) sofort löschen statt matchen.
        if (!tk.ts || (!tk.pid && !tk.dev)) {
          fb.delete(`${qn}/${id}`);
          continue;
        }
        if (my.pid && tk.pid && tk.pid === my.pid) continue; // selber Spieler (gleiche Profil-ID)
        if (tk.dev && tk.dev === DEVICE_ID) continue; // selbes Gerät — nie selbst matchen
        // Verwaist = hb hat sich über 35s MEINER Beobachtung nicht geändert
        // (uhren-immun; kein Vergleich lokale Uhr vs. fremder Zeitstempel).
        const hb = tk.hb || tk.ts || 0;
        const rec = seen[id];
        if (!rec || rec.hb !== hb) {
          seen[id] = { hb, at: now };
        } else if (now - rec.at > MM_HEARTBEAT_STALE_MS) {
          fb.delete(`${qn}/${id}`);
          delete seen[id];
          continue;
        }
      }
      wait.push({ id, elo: typeof tk.elo === "number" ? tk.elo : 1e3, ts: tk.ts || now });
    }
    if (wait.length < np) return;
    // Pairing-Kern extrahiert (v3.35.0): src/net/matchmaking.js — identische
    // Logik, jetzt unit-getestet (Determinismus über alle Clients).
    const pairing = computeMatchGroup(wait, np, now, SESSION_ID);
    if (typeof window !== "undefined" && window.__mmDebug) window.__mmDbg = { sid: SESSION_ID.slice(0, 6), n: wait.length, sorted: pairing.sorted.map((x) => x.id.slice(0, 6) + ":" + x.elo), group: pairing.group && pairing.group.map((x) => x.id.slice(0, 6)), t: Date.now() };
    if (!pairing.group) return;
    if (typeof window !== "undefined" && window.__mmDebug) window.__mmDbg.claimer = pairing.claimer.id.slice(0, 6);
    if (pairing.claimer.id !== SESSION_ID) return; // der zuständige Partner claimt mich
    const chosen = pairing.group.filter((x) => x.id !== SESSION_ID).map((x) => x.id);
    mmBusy.current = true;
    try {
      await mmClaimAndMatch(chosen);
    } finally {
      mmBusy.current = false;
    }
  }
  function mmOnQueueUpdate() {
    if (!mmActive.current) return;
    const my = mmQueueSnapshot.current[SESSION_ID];
    if (!my) return;
    if (my.status === "matched" && my.code) {
      // Selbst-Match-Schutz (v3.15.2): NUR Fremd-Matches befolgen. Läuft mein
      // eigener Claim (mmBusy) oder trägt das Ticket meine Rolle 1 / meine
      // eigene claimBy-Signatur, ist es ein Echo des eigenen Claims —
      // mmBecomeHost übernimmt, niemals als Gast ins eigene Spiel joinen.
      if (mmBusy.current || my.claimBy === SESSION_ID || (my.role || 2) === 1) return;
      mmActive.current = false;
      mmJoinMatchedGame(my.code, my.role || 2, mmNp.current);
      return;
    }
    if (my.status === "claiming") {
      // Eigener aktiver Claim heilt sich nicht selbst zurück auf 'waiting'
      // (sonst könnte ein Dritter einen aktiven Claimer claimen) — Finding 3.
      if (my.claimBy === SESSION_ID && mmBusy.current) return;
      mmScheduleClaimHeal(my.claimTs);
      return;
    }
    mmTryFindMatch();
  }
  function mmTick() {
    if (typeof window !== "undefined" && window.__mmDebug) window.__mmTicks = (window.__mmTicks || 0) + 1;
    if (!mmActive.current) return;
    const qn = mmQueueName();
    const my = mmQueueSnapshot.current[SESSION_ID];
    // Selbstheilung (v3.14.10): Nach einem kurzen Verbindungsabbruch hat der Server
    // das Ticket per onDisconnect gelöscht. Ein blindes hb-Patch würde nur einen
    // status-losen Stub erzeugen, den niemand matchen kann ("sucht ewig").
    // Stattdessen: komplettes Ticket neu eintragen + onDisconnect neu scharfstellen
    // (onDisconnect-Operationen feuern nur EINMAL und müssen re-registriert werden).
    if ((!my || !my.status) && mmMyTicket.current) {
      fb.set(`${qn}/${SESSION_ID}`, { ...mmMyTicket.current, hb: Date.now() });
      if (mmCancelDisconnect.current) mmCancelDisconnect.current();
      mmCancelDisconnect.current = fb.onDisconnectRemove(`${qn}/${SESSION_ID}`);
      return;
    }
    // Heartbeat transaktional — nie einen {hb}-Stub auf gelöschtem Pfad erzeugen (v3.15.3)
    fb.transact(`${qn}/${SESSION_ID}`, (cur) => cur ? { ...cur, hb: Date.now() } : void 0);
    mmOnQueueUpdate();
  }
  function cancelMatchmaking() {
    // Die Wartedauer ist hier die Kernzahl: sie sagt, ab wann Leute aufgeben —
    // und damit, ob eine Wartezeit ueberhaupt zumutbar ist.
    trichter("suche_abbruch", { wartete: mmElapsed, np: mmNp.current || 2 });
    mmActive.current = false;
    mmPendingCandidates.current = {};
    stopMatchmakingListeners(true);
    setMpScreen("online");
    setMmElapsed(0);
  }
  // Bot-Backfill (v3.32.4): Queue nach MM_BOT_BACKFILL_S leer → Suche sauber
  // beenden und nahtlos ein Bot-Match starten (gleicher Flow wie „Übung gegen
  // Bot", Stufe Mittel). Nur 2P — der Bot unterstützt keine 3-Spieler-Partien.
  // Niemals mitten in einem Claim/Match feuern (mmBusy / Ticket-Status-Guards).
  function mmBotBackfill(automatisch) {
    if (!mmActive.current || mmBusy.current) return;
    // Getrennt erfasst: wer den Knopf drueckt, hat sich ENTSCHIEDEN; wer nach
    // Ablauf hineinfaellt, hat gewartet. Zwei sehr verschiedene Aussagen.
    trichter("bot_start", { wartete: mmElapsed, auto: !!automatisch });
    const my = mmQueueSnapshot.current[SESSION_ID];
    if (my && my.status && my.status !== "waiting") return;
    mmActive.current = false;
    mmPendingCandidates.current = {};
    stopMatchmakingListeners(true);
    setMmElapsed(0);
    botLevel.current = "mid";
    online.current = false;
    botMode.current = true;
    tutorialMode.current = false;
    initBotMatchIdentity();
    numPlayersRef.current = 2;
    setNumPlayers(2);
    setMpScreen(null);
    fullReset();
    showWarn(t('mmBotFallback', { name: playerInfo.current[2].name }));
  }
  async function startMatchmaking(np) {
    trichter("suche_start", { np });
    np = np === 3 ? 3 : 2;
    setMpError("");
    const client = await getFirebase();
    if (!client) {
      setMpError(MP_CONFIGURED ? t('warnVerbindung') + " " + _fbError : t('fbMissing'));
      return;
    }
    botMode.current = false;
    tutorialMode.current = false;
    gcOwnStaleGame();
    // Idempotenter Wiedereintritt (v3.14.12): evtl. noch laufende Timer/Listener
    // einer früheren Suche zuerst stoppen — nie zwei mmTick-Loops parallel.
    stopMatchmakingListeners(false);
    mmNp.current = np;
    numPlayersRef.current = np;
    setNumPlayers(np);
    const qn = np === 3 ? "queue3" : "queue2";
    const now = Date.now();
    const ticket = {
      name: (profile == null ? void 0 : profile.name) || "Spieler",
      wappen: (profile == null ? void 0 : profile.wappen) || "♔",
      color: (profile == null ? void 0 : profile.color) || "#2563eb",
      elo: myEloForMode(np),
      pid: (profile == null ? void 0 : profile.id) || DEVICE_ID,
      dev: DEVICE_ID,
      ts: now,
      hb: now,
      status: "waiting",
      claimBy: null,
      claimTs: null,
      code: null,
      role: null
    };
    const ok = await fb.set(`${qn}/${SESSION_ID}`, ticket);
    if (!ok) {
      setMpError("Konnte nicht in die Warteschlange eintragen: " + _fbError);
      return;
    }
    mmMyTicket.current = ticket;
    mmHbSeen.current = {};
    mmStartedAt.current = now;
    mmQueueSnapshot.current = { [SESSION_ID]: ticket };
    mmActive.current = true;
    mmPendingCandidates.current = {};
    if (mmCancelDisconnect.current) mmCancelDisconnect.current();
    mmCancelDisconnect.current = fb.onDisconnectRemove(`${qn}/${SESSION_ID}`);
    // Alte eigene Tickets bereinigen (z.B. von einem anderen Tab oder nach Absturz)
    // WICHTIG: await Promise.all() — Subscription startet erst NACH Abschluss aller Löschungen,
    // sonst kann mmTryFindMatch() das Zombie-Ticket noch sehen (Race Condition).
    const myPid = (profile == null ? void 0 : profile.id) || null;
    {
      // Zombie-Tickets des eigenen Browsers bereinigen (z.B. nach Absturz oder Tab-Wechsel).
      // Nur pid-basiert — Name/Wappen wären zu unspezifisch und würden Tickets anderer Spieler löschen.
      const snap = await fb.get(qn);
      if (snap) {
        const dels = [];
        for (const [oldId, oldTk] of Object.entries(snap)) {
          if (oldId === SESSION_ID || !oldTk) continue;
          if ((myPid && oldTk.pid === myPid) || (oldTk.dev && oldTk.dev === DEVICE_ID)) dels.push(fb.delete(`${qn}/${oldId}`));
        }
        if (dels.length > 0) await Promise.all(dels);
      }
    }
    setMmElapsed(0);
    setMpScreen("matchmaking");
    if (mmChannel.current) mmChannel.current.stop();
    // subscribeRaw, NICHT subscribe (v3.94.0): fb.subscribe verschluckt den
    // Null-Fall (`if (data) onData(data)`), und die Realtime Database loescht
    // einen Knoten, sobald sein letztes Kind verschwindet. War man der einzige
    // Wartende und das eigene Ticket fiel per onDisconnect weg (kurzer
    // Netzaussetzer, App-Wechsel), kam die Leerung hier nie an: der
    // Schnappschuss behielt das eigene Ticket, mmTick hielt es fuer vorhanden
    // und trug es NIE neu ein. Ergebnis: ein Spieler, der in einer leeren
    // Warteschlange wartet, ist fuer alle anderen unsichtbar und sucht ewig —
    // dasselbe Bild wie v3.14.10, das im Ein-Mann-Fall ueberlebt hat.
    // Das `|| {}` unten stand schon immer da und war bis hierher toter Code.
    mmChannel.current = fb.subscribeRaw(qn, (data) => {
      mmQueueSnapshot.current = data || {};
      mmOnQueueUpdate();
    });
    if (mmTickTimer.current) clearInterval(mmTickTimer.current);
    // Direkt vor Neuanlage räumen: zwei parallele startMatchmaking-Aufrufe
    // (Doppelklick / Rejoin nach fehlgeschlagenem Reserve) dürfen nie zwei
    // mmTick-Intervalle hinterlassen (v3.14.13).
    if (mmTickTimer.current) clearInterval(mmTickTimer.current);
    mmTickTimer.current = setInterval(mmTick, MM_TICK_MS);
    // Eigener 1-Sekunden-Ticker nur für die Anzeige (Wartezeit + Radius),
    // damit der Zähler flüssig hochläuft und nicht im 2s-Heartbeat-Takt springt.
    if (mmDisplayTimer.current) clearInterval(mmDisplayTimer.current);
    mmDisplayTimer.current = setInterval(() => {
      if (!mmActive.current) return;
      const el = Math.round((Date.now() - mmStartedAt.current) / 1e3);
      setMmElapsed(el);
      // Bot-Backfill nach 60s ohne Gegner (nur 2P-Queue)
      if (el >= MM_BOT_BACKFILL_S && mmNp.current === 2) mmBotBackfill(true);
    }, 1e3);
  }
  function startOnlineGame(role) {
    myRole.current = role;
    online.current = true;
    lastSeenPhase.current = null;
    statRecorded.current = false;
    telemetrySent.current = false;
    scarCount.current = {}; scars.current = {};
    eloChangeRef.current = null;
    goldChangeRef.current = null;
    xpChangeRef.current = null;
    matChangeRef.current = null;
    setMpScreen(null);
    if (role === 1) {
      initGrid();
      setRound(1);
      roundRefVal.current = 1;
      resetEconomy();  // v3.19.1: Online-Spielstart resettet die Schrott-Ökonomie
      beginSetup();
      screenRef.current = "game";
      setTimeout(() => pushState(true), 300);
    } else {
      const players = playersList();
      pieces.current = players.reduce((o, p) => (o[p] = { cells: randomShape(), ghostR: null, ghostC: null }, o), {});
      eliminated.current = {};
      // Gast: lokale Match-Statistik nullen (v3.21.0) — der Host-Sync
      // überschreibt sie gleich, aber bis dahin darf nichts Altes stehen.
      matchStats.current = { 1: msZero(), 2: msZero(), 3: msZero() };
      screenRef.current = "game";
      setScreen("game");
    }
  }
  // Crash-Hinterlassenschaft beseitigen (v3.14.15): Ist von einer früheren
  // Session noch ein EIGENER Spielknoten übrig (App-Absturz / Tab-Kill vor dem
  // sauberen Verlassen), wird er beim nächsten Online-Einstieg gelöscht.
  // Nur alte Marker (>30 Min) anfassen — ein zweiter offener Tab mit laufendem
  // Spiel bleibt unberührt. Fremde Knoten kann kein Client aufräumen (Rules
  // verbieten das Auflisten der games-Collection — gewollt).
  function gcOwnStaleGame() {
    try {
      const raw = localStorage.getItem("fortress_my_game");
      if (!raw) return;
      const m = JSON.parse(raw);
      if (!m || !m.code) { localStorage.removeItem("fortress_my_game"); return; }
      if (m.code === mpCodeRef.current) return; // aktuelles eigenes Spiel
      if (Date.now() - (m.ts || 0) < 18e5) return; // <30 Min: evtl. anderer Tab
      fb.delete(`games/${m.code}`);
      localStorage.removeItem("fortress_my_game");
    } catch (e) {}
  }
  function cleanupGame(code, wasHost) {
    // ── Zentraler Teardown (v3.14.15): JEDER Online-Ausstieg läuft hier durch.
    // Alles Matchmaking-Bezogene wird mit abgeräumt, damit keine Leichen den
    // nächsten Queue-Beitritt stören.
    // 1) Scharfer Gast-Beitritts-Watchdog: würde sonst nach Abbruch des
    //    Wartescreens später feuern und UNSICHTBAR ein neues Matchmaking starten.
    if (mmWatchdog.current) {
      clearTimeout(mmWatchdog.current);
      mmWatchdog.current = null;
    }
    // 2) Reservierte Kandidaten-Tickets freigeben (Gäste, die noch nicht
    //    beigetreten sind, sollen sofort wieder suchen können).
    for (const k of Object.keys(mmPendingCandidates.current)) {
      try { fb.delete(mmPendingCandidates.current[k]); } catch (e) {}
    }
    mmPendingCandidates.current = {};
    // 3) Falls irgendein Pfad mit noch aktiver Queue-Maschinerie hier landet:
    //    Suche vollständig stoppen und eigenes Ticket löschen.
    if (mmActive.current) {
      mmActive.current = false;
      stopMatchmakingListeners(true);
    }
    mmMatched.current = false;
    mmMyTicket.current = null;
    // Geplantes Auto-Löschen (onDisconnect) abbestellen — sauberes Leave löscht selbst.
    if (gameDisconnectCancel.current) {
      try { gameDisconnectCancel.current(); } catch (e) {}
      gameDisconnectCancel.current = null;
    }
    // Herzschlag beidseitig einstellen (v3.70.0): der Gast hört auf zu schlagen
    // und bestellt sein onDisconnect ab, der Host beendet seine Beobachtung.
    // Ohne das schlüge ein Gast im Menü weiter in ein fremdes Spiel hinein.
    stopHeartbeat();
    stopHostHeartbeatWatch();
    if (!wasHost && code && hbMyRole.current) { try { fb.delete(`games/${code}/hb${hbMyRole.current}`); } catch (e) {} }
    hbMyRole.current = 0;
    if (wasHost && code) {
      setTimeout(() => {
        try {
          fb.delete(`games/${code}`);
          // Eigener Spielknoten sauber entfernt → Crash-Marker löschen.
          try { localStorage.removeItem("fortress_my_game"); } catch (e) {}
        } catch (e) {
        }
      }, 2500);
    }
    if (mpChannel.current) {
      mpChannel.current.stop();
      mpChannel.current = null;
    }
    if (mpChannel2.current) {
      mpChannel2.current.stop();
      mpChannel2.current = null;
    }
    if (joinPollRef.current) {
      clearInterval(joinPollRef.current);
      joinPollRef.current = null;
    }
    if (connWatchdog.current) {
      clearInterval(connWatchdog.current);
      connWatchdog.current = null;
    }
    pushFails.current = 0;
    resubAttempted.current = false;
    everGotState.current = false;
    setConn(false);
    joinedGuests.current = { 2: false, 3: false };
    guestActionApplied.current = { 2: 0, 3: 0 };
  }
  function leaveOnline() {
    const code = mpCodeRef.current;
    const wasHost = myRole.current === 1;
    online.current = false;
    myRole.current = 0;
    hostSessionRef.current = "";
    cleanupGame(code, wasHost);
    setMpScreen(null);
    setMpCode("");
    setMpInput("");
    setMpError("");
    mpCodeRef.current = "";
    // WICHTIG (v3.14.17): screenRef MIT dem State setzen. applyState wechselt den
    // Screen nur bei Differenz zum Ref — blieb der Ref nach einem Gast-Ausstieg
    // auf "game", zeigte der nächste Online-Beitritt für immer das Menü,
    // während alle Refs längst im Spiel waren (3P-Rejoin-Bug).
    screenRef.current = "menu";
    setScreen("menu");
  }
  // Verbindungsstatus des SDK dauerhaft mitführen (v3.70.0) — siehe
  // fb.subscribeConnected: die Gegenprobe für den Herzschlag-Watchdog.
  useEffect(() => {
    const sub = fb.subscribeConnected((up) => { fbOnline.current = up; });
    return () => { try { sub.stop(); } catch (e) {} };
  }, []);
  useEffect(() => {
    const onVisibility = () => {
      if (!mpChannel.current) return;
      mpChannel.current._bgMode = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  function initGrid() {
    const is3 = numPlayersRef.current === 3;
    let terObj;
    if (is3) {
      const seed = Math.floor(Math.random() * 4294967295);
      terObj = __spreadProps(__spreadValues({}, generateTerrain3FromSeed(seed)), { seed });
    } else {
      terObj = generateTerrain();
    }
    terrain.current = terObj;
    terrainSeed.current = terObj.seed;
    bgDirty.current = true;
    const ter = terObj.grid;
    const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
    cannonSeq.current = 0;
    let castleSetup;
    if (is3) {
      const pos = castle3Positions();
      castles.current = { 1: __spreadValues({}, pos[1]), 2: __spreadValues({}, pos[2]), 3: __spreadValues({}, pos[3]) };
      castleSetup = [
        [pos[1], CASTLE1, WALL1],
        [pos[2], CASTLE2, WALL2],
        [pos[3], CASTLE3, WALL3]
      ];
    } else {
      castles.current = { 1: __spreadValues({}, CASTLE_P1), 2: __spreadValues({}, CASTLE_P2) };
      castleSetup = [
        [CASTLE_P1, CASTLE1, WALL1],
        [CASTLE_P2, CASTLE2, WALL2]
      ];
    }
    cannons.current = is3 ? { 1: [], 2: [], 3: [] } : { 1: [], 2: [] };
    for (const [castle, castleMark, wallMark] of castleSetup) {
      const innerW = 5;
      const innerH = 2;
      for (let dr = -innerH - 2; dr <= innerH + 2; dr++)
        for (let dc = -innerW - 2; dc <= innerW + 2; dc++) {
          const r = castle.r + dr, c = castle.c + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS && ter[r][c] >= 3) ter[r][c] = 1;
        }
      for (let dr = -innerH - 1; dr <= innerH + 1; dr++)
        for (let dc = -innerW - 1; dc <= innerW + 1; dc++) {
          const isBorder = dr === -innerH - 1 || dr === innerH + 1 || dc === -innerW - 1 || dc === innerW + 1;
          if (!isBorder) continue;
          const r = castle.r + dr, c = castle.c + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = wallMark;
        }
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = castle.r + dr, c = castle.c + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = castleMark;
        }
    }
    if (is3) {
      terObj.sectorMap = buildSectorMap(terObj, castles.current);
    }
    setGrid(g);
  }
  const eliminated = useRef({});
  function checkLossOrContinue(nextPhaseFn) {
    const g = grid.current;
    const players = playersList();
    const activePlayers = players.filter((p) => !eliminated.current[p]);
    const newlyOut = activePlayers.filter((p) => {
      const open = !isCastleClosed(g, p, castles.current[p]);
      // Tutorial: den Spieler nicht eliminieren, sondern die Regel erklären (kein Sackgassen-Verlust).
      if (open && tutorialMode.current && p === 1) { showWarn(t('tutorialCastleOpen')); return false; }
      return open;
    });
    // Verlust-Diagnose (gated, v3.50.1): WARUM ist die Burg offen geblieben —
    // war der Nachschub aufgebraucht (Regel griff) oder hatte der Spieler noch
    // Teile uebrig und hat die Luecke schlicht nicht geschlossen (KI-Schwaeche)?
    if (typeof window !== "undefined" && window.__mmDebug && newlyOut.length) {
      const XD = balExp() || {};
      const lim = XD.limitStart
        ? Math.max(XD.limitMin || 5, XD.limitStart - (roundRefVal.current - 1) * (XD.limitStep || 1))
        : (XD.limit || null);
      const ld = window.__lossDbg = window.__lossDbg || { total: 0, ausTeilen: 0, trotzTeilen: 0, ohneLimit: 0, det: [] };
      for (const p of newlyOut) {
        ld.total++;
        const used = placedThisPhase.current[p] || 0;
        if (lim === null) ld.ohneLimit++;
        else if (used >= lim) ld.ausTeilen++;
        else ld.trotzTeilen++;
        if (ld.det.length < 20) ld.det.push({ r: roundRefVal.current, p, used, lim });
      }
    }
    for (const p of newlyOut) eliminated.current[p] = true;
    const stillIn = players.filter((p) => !eliminated.current[p]);
    if (stillIn.length <= 1) {
      running.current = false;
      clearInterval(timerID.current);
      const winner = stillIn.length === 1 ? stillIn[0] : null;
      let loser;
      if (numPlayersRef.current === 2) {
        loser = winner === null ? "both" : winner === 1 ? 2 : 1;
      } else {
        loser = newlyOut.length ? newlyOut : null;
      }
      if (winner) {
        const ns = __spreadProps(__spreadValues({}, scoresRef.current), { [winner]: (scoresRef.current[winner] || 0) + 1 });
        scoresRef.current = ns;
        setScores(__spreadValues({}, ns));
      }
      const info = { loser, winner, reason: "open", numPlayers: numPlayersRef.current };
      resultRef.current = info;
      screenRef.current = "result";
      phase_r.current = "result";
      setResultInfo(info);
      setPhase("result");
      setScreen("result");
      if (online.current && !statRecorded.current) {
        statRecorded.current = true;
        const myWin = winner === myRole.current ? true : winner === null ? null : false;
        recordResult(myWin, numPlayersRef.current);
      }
      if (online.current && myRole.current === 1) {
        pushState(true);
        setTimeout(() => pushState(true), 300);
        setTimeout(() => pushState(true), 800);
      }
      // Telemetrie auch auf DIESEM Pfad (v3.47.0): hier enden lokale-, Bot- und
      // Online-Matches durch die Umschlossen-Regel. Der zweite Einhängepunkt
      // weiter unten deckt nur das Ausscheiden per Verbindungsende ab — ohne
      // diesen hier fehlten sämtliche regulär gewonnenen Partien in den Daten.
      if (!online.current || myRole.current === 1) pushTelemetry(winner);
      return false;
    }
    if (newlyOut.length && numPlayersRef.current === 3) {
      const names = newlyOut.map((p) => {
        var _a2;
        return ((_a2 = playerInfo.current[p]) == null ? void 0 : _a2.name) || t('playerFallback', {n: p});
      }).join(", ");
      showWarn(t('warnAusgeschieden', {names}));
    }
    nextPhaseFn();
    return true;
  }
  const statRecorded = useRef(false);
  const eloChangeRef = useRef(null);
  const goldChangeRef = useRef(null);
  const matChangeRef = useRef(null); // Schmiede-Material-Gewinn des letzten Matches (v3.33.0)
  const xpChangeRef = useRef(null);
  function startBuild() {
    const players = playersList();
    const mk = (v) => players.reduce((o, p) => (o[p] = v, o), {});
    phase_r.current = "build";
    setPhase("build");
    placedThisPhase.current = {};   // Bauteil-Limit je Bauphase zuruecksetzen
    {  // abgebrannte Zellen freigeben
      const bs = burning.current, rn = roundRefVal.current;
      for (const k in bs) if (bs[k] <= rn) delete bs[k];
    }
    {
      const X = balExp();
      const bt = (X && X.druck)
        ? Math.max(X.druckMin || 12, BUILD_TIME - (roundRefVal.current - 1) * (X.druckStep || 1))
        : BUILD_TIME;
      timerVal.current = bt;
      setTimer(bt);
    }
    pieces.current = players.reduce((o, p) => (o[p] = { cells: randomShape(), ghostR: null, ghostC: null }, o), {});
    warnedOpen.current = mk(false);
    activeBuild.current = mk(null);
    activeDrag.current = mk(null);
    pointers.current.clear();
    setUiTick((t) => t + 1);
    showPhaseBanner("build", startTimer);
  }
  const frozenReady = useRef({ 1: [], 2: [] });
  // Nach Ablauf der Schussphase noch fliegende Kugeln ausspielen lassen
  // (v3.18.0): Phase bleibt kurz „shoot", Kugeln landen normal (Treffer +
  // Schrott-Gutschriften), erst DANN geht es in die Rüstphase.
  const shootSettling = useRef(false);
  const shootSettleTimeout = useRef(null);
  function startShoot() {
    const players = playersList();
    const mk = (v) => players.reduce((o, p) => (o[p] = v, o), {});
    shootSettling.current = false;
    if (shootSettleTimeout.current) { clearTimeout(shootSettleTimeout.current); shootSettleTimeout.current = null; }
    phase_r.current = "shoot";
    setPhase("shoot");
    timerVal.current = SHOOT_TIME;
    setTimer(SHOOT_TIME);
    balls.current = [];
    explosions.current = [];
    reload.current = mk(1);
    lastShot.current = mk(-99999);
    activeDrag.current = mk(null);
    const g = grid.current;
    frozenReady.current = players.reduce((o, p) => (o[p] = closedCannons(g, p, cannons.current[p]).map((c) => c.id), o), {});
    showPhaseBanner("shoot", startTimer);
  }
  function endBuild() {
    checkLossOrContinue(startShoot);
  }
  function endShoot() {
    {
      const XS = balExp() || {};
      if (XS.salve) for (const p of playersList()) {
        if (eliminated.current[p]) continue;
        if (firedPhase.current[p]) salveCharge.current[p] = 0;
        else salveCharge.current[p] = Math.min(XS.salveMax || 2, (salveCharge.current[p] || 0) + 1);
        firedPhase.current[p] = false;
      }
    }
    const players = playersList();
    const mk = (v) => players.reduce((o, p) => (o[p] = v, o), {});
    // Diagnose (gated): bei endShoot dürfen KEINE Kugeln mehr fliegen (v3.18.0)
    if (typeof window !== "undefined" && window.__mmDebug) window.__discardedAtEnd = (window.__discardedAtEnd || 0) + balls.current.filter((b) => b.alive).length;
    shootSettling.current = false;
    if (shootSettleTimeout.current) { clearTimeout(shootSettleTimeout.current); shootSettleTimeout.current = null; }
    phase_r.current = "cannon";
    setPhase("cannon");
    timerVal.current = CANNON_TIME;
    setTimer(CANNON_TIME);
    balls.current = [];
    explosions.current = [];
    armoryReady.current = { 1: false, 2: false, 3: false };
    // Schrott-Ökonomie (v3.16.0): KEIN Gratis-Kanonen-Budget mehr — Kanonen
    // werden im Shop gekauft. Überlebens-Sold für alle aktiven Spieler.
    cannonBudget.current = players.reduce((o, p) => (o[p] = 0, o), {});
    for (const p of players) if (!eliminated.current[p]) {
      // Wiederaufbau-Paket A (v3.30.0): ohne Kanonen doppelter Sold (+12)
      const sold = rebuildAidActive(p) ? SCRAP_REBUILD : SCRAP_SURVIVE;
      // ZINS (Experiment v3.52.0): Verzinsung des NICHT ausgegebenen Schrotts.
      // Damit ist Sparen eine eigene Linie gegen sofortiges Nachbauen.
      const XZ = balExp() || {};
      const zins = XZ.zins ? Math.floor((scrap.current[p] || 0) * XZ.zins) : 0;
      scrap.current[p] = (scrap.current[p] || 0) + sold + zins;
      msOf(p).scrap += sold + zins; // Match-Statistik (v3.21.0)
      if (zins > 0 && typeof window !== "undefined" && window.__mmDebug) {
        const zd = window.__zinsDbg = window.__zinsDbg || { gezahlt: 0, summe: 0 };
        zd.gezahlt++; zd.summe += zins;
      }
      const ct = castles.current[p];
      if (ct) addScrapPop(ct.c * CELL + CELL / 2, ct.r * CELL - CELL, sold, p);
    }
    if (typeof window !== "undefined" && window.__mmDebug) window.__econ = { scrap: { ...scrap.current }, up: JSON.parse(JSON.stringify(upgrades.current)), t: Date.now() };
    activeBuild.current = mk(null);
    activeDrag.current = mk(null);
    pointers.current.clear();
    // Rüstphase läuft IMMER volle 15s (v3.16.1) — die frühere Auto-Verkürzung
    // („niemand kann kaufen → 4s") wirkte wie ein Timer-Bug und nahm die Zeit
    // zum Planen. Nutzer-Entscheid: konsistente Phasendauer.
    setUiTick((t) => t + 1);
    showPhaseBanner("cannon", startTimer);
  }
  function endCannon() {
    setShowShopInfo(false);
    setRound((r) => r + 1);
    roundRefVal.current = roundRefVal.current + 1; // Ref mitziehen (v3.47.0) — er wird an die Gaeste gesendet
    startBuild();
  }
  function endSetup() {
    setRound(1);
    roundRefVal.current = 1;
    startShoot();
  }
  function startTimer() {
    clearInterval(timerID.current);
    if (online.current && myRole.current !== 1) return;
    timerID.current = setInterval(() => {
      if (tutPausedRef.current) return; // Tutorial-Popup offen → Spiel pausiert (v3.37.2)
      timerVal.current -= 1;
      setTimer(timerVal.current);
      if (timerVal.current <= 0) {
        clearInterval(timerID.current);
        if (phase_r.current === "setup") endSetup();
        else if (phase_r.current === "build") endBuild();
        else if (phase_r.current === "shoot") {
          // Noch fliegende Kugeln erst zu Ende fliegen lassen (v3.18.0):
          // Phase bleibt „shoot", der Render-Loop lässt sie normal einschlagen
          // (Treffer + Schrott), danach ruft er endShoot() auf. Sicherheits-
          // Timeout, falls eine Kugel doch mal hängt.
          if (balls.current.some((b) => b.alive)) {
            shootSettling.current = true;
            if (shootSettleTimeout.current) clearTimeout(shootSettleTimeout.current);
            shootSettleTimeout.current = setTimeout(() => {
              if (shootSettling.current && phase_r.current === "shoot") {
                shootSettling.current = false;
                endShoot();
              }
            }, 4000);
          } else {
            endShoot();
          }
        }
        else if (phase_r.current === "cannon") endCannon();
      }
    }, 1e3);
  }
  function fireMortar(player, targetX, targetY) {
    if (eliminated.current[player]) return false;
    // Kein neuer Schuss mehr im Nachlauf nach Ablauf der Schussphase (v3.18.0)
    if (shootSettling.current) return false;
    const now = performance.now();
    if (now - lastShot.current[player] < reloadMsOf(player)) return false;
    if (now - (salvoSwitchAt.current[player] || -99999) < SALVO_LOCK_MS) {
      if (!online.current || player === myRole.current) showWarn(t('warnSalvoLock'));
      return false;
    }
    const g = grid.current;
    let ready;
    if (phase_r.current === "shoot" && frozenReady.current[player]) {
      const frozenIds = new Set(frozenReady.current[player]);
      ready = cannons.current[player].filter((c) => frozenIds.has(c.id) && c.hp > 0);
    } else {
      ready = closedCannons(g, player, cannons.current[player]);
    }
    {
      // Salven-Schalter: es feuert NUR die gewaehlte Kanonenart. Wer Kanonen
      // jagt, macht in dieser Runde keinen Mauerschaden — und umgekehrt.
      const modus = salvenModus.current[player] || "std";
      ready = ready.filter((c) => (c.kt || "std") === modus);
    }
    // STOERSENDER (Experiment): getroffene Kanonen sind fuer X Runden
    // lahmgelegt statt zerstoert — sie blockieren weiter Platz und Schrott.
    // (c.emp ist ohne das Experiment nie gesetzt.)
    ready = ready.filter((c) => !(c.emp > roundRefVal.current));
    if (ready.length === 0) {
      if (!online.current || player === myRole.current) showWarn(t('warnNoCannonReady'));
      return false;
    }
    lastShot.current[player] = now;
    firedPhase.current[player] = true;
    SFX.shoot();
    msOf(player).shots += ready.length; // Match-Statistik (v3.21.0): eine Kugel je schussbereiter Kanone
    // ── LASER (Experiment v3.50.0) ────────────────────────────────────────
    // Voellig andere Wirkmechanik als der Moerser: keine Flugbahn, kein
    // Aufschlagpunkt — ein SOFORTIGER Strahl vom Rohr zum Ziel, der eine
    // Schneise durch die ERSTEN N Mauern auf der Linie schlaegt. Damit trifft
    // er systematisch mehrere Zellen und kann per Definition nicht in einer
    // bereits geschlagenen Bresche verpuffen (Trummer-Problem entfaellt).
    // Waffen-Mix (v3.50.0): `mix` = Anteil der Kanonen einer Salve, die den
    // Sondertyp tragen (1 = alle, 0.33 = jede dritte). Damit laesst sich ein
    // GEMISCHTES Arsenal messen statt eines Alles-oder-nichts-Modus.
    // Zwei Sondertypen sind kombinierbar (weapon/mix + weapon2/mix2) — damit
    // laesst sich ein echtes gemischtes Arsenal messen, z. B. 1/3 Laser +
    // 1/3 Steilfeuer + 1/3 normaler Moerser.
    const XMIX = balExp() || {};
    const evOf = (m) => Math.max(1, Math.round(1 / (m == null ? 1 : m)));
    const wpEvery = XMIX.weapon ? evOf(XMIX.mix) : 0;
    const wpEvery2 = XMIX.weapon2 ? evOf(XMIX.mix2) : 0;
    const wpAt = (i) => {
      if (wpEvery2 && i % wpEvery2 === 1) return XMIX.weapon2;
      if (wpEvery && i % wpEvery === 0) return XMIX.weapon;
      return null;
    };
    {
      const XL = balExp();
      if (XL && (XL.weapon === "laser" || XL.weapon2 === "laser")) {
        const pierce = XL.laserPierce || 3;
        // eslint-disable-next-line no-unused-vars
        // Der Strahl startet INNERHALB der eigenen Burg — die eigenen Mauern
        // duerfen das Durchschlagsbudget deshalb nicht aufbrauchen (sonst
        // verpufft der Laser im eigenen Mauerring). Nur GEGNER-Strukturen
        // zaehlen als Durchschlag.
        const enemyVals = new Set();
        for (const p2 of playersList()) {
          if (p2 === player) continue;
          enemyVals.add(WALL_OF[p2]); enemyVals.add(CANNON_OF[p2]); enemyVals.add(CASTLE_OF[p2]);
        }
        const dbg = typeof window !== "undefined" && window.__mmDebug
          ? (window.__laserDbg = window.__laserDbg || { beams: 0, seg: 0, own: 0, enemy: 0, exhausted: 0 }) : null;
        for (let li = 0; li < ready.length; li++) {
          if (wpAt(li) !== "laser") continue;   // diese Kanone ist ein normaler Moerser
          const cn = ready[li];
          const sx0 = cn.c * CELL + CELL / 2, sy0 = cn.r * CELL + CELL / 2;
          const dx0 = targetX - sx0, dy0 = targetY - sy0;
          const len = Math.hypot(dx0, dy0) || 1;
          const ux = dx0 / len, uy = dy0 / len;
          let done = 0, lastKey = "";
          if (dbg) dbg.beams++;
          for (let step = CELL; step <= len + CELL * 6 && done < pierce; step += CELL * 0.5) {
            const px2 = sx0 + ux * step, py2 = sy0 + uy * step;
            const rr5 = Math.floor(py2 / CELL), cc5 = Math.floor(px2 / CELL);
            if (rr5 < 0 || rr5 >= ROWS || cc5 < 0 || cc5 >= COLS) break;
            const k5 = rr5 + "_" + cc5;
            if (k5 === lastKey) continue;
            lastKey = k5;
            if (dbg) dbg.seg++;
            const v5 = grid.current[rr5][cc5];
            if (v5 === WALL_OF[player] || v5 === CANNON_OF[player] || v5 === CASTLE_OF[player]) {
              if (dbg) dbg.own++;
              continue;   // eigene Struktur: Strahl geht hindurch, kostet nichts
            }
            if (!enemyVals.has(v5)) continue;   // leer, Truemmer, Terrain
            if (dbg) dbg.enemy++;
            impactAt({ tx: px2, ty: py2, player });   // gleiche Schadensaufloesung
            done++;
          }
          if (dbg && done >= pierce) dbg.exhausted++;
        }
        if (XL.weapon === "laser" && wpEvery === 1) return true;   // reines Laser-Arsenal → keine Kugeln
      }
    }
    // Ladung wird von der ERSTEN Salve der Phase verbraucht — sonst waere jede
    // weitere Salve derselben Phase ebenfalls aufgeladen.
    // Diagnose (gated, v3.59.0): Wohin zielt die Salve, und wo schlaegt sie
    // wirklich ein? Damit ist pruefbar, dass die Zielzelle IMMER getroffen wird
    // und die Bresche zusammenhaengt — statt das nur zu behaupten.
    const salvoDbg = (typeof window !== "undefined" && window.__mmDebug)
      ? { ziel: [Math.floor(targetY / CELL), Math.floor(targetX / CELL)], treffer: [] } : null;
    const salveUsed = (balExp() || {}).salve ? (salveCharge.current[player] || 0) : 0;
    salveCharge.current[player] = 0;
    ready.forEach((cn, index) => {
      const wp = wpAt(index);
      if (wp === "laser") return;   // wurde oben schon als Strahl abgehandelt
      const sx = cn.c * CELL + CELL / 2;
      const sy = cn.r * CELL + CELL / 2;
      let tx = targetX;
      let ty = targetY;
      if (wp === "mortar" || wp === "emp") {
        // Steilfeuer/Stoersender ueberfliegen den Mauerring und zielen auf eine
        // Kanone im Burghof. Preis dafuer: deutliche Streuung.
        const E2 = playersList().filter((p2) => p2 !== player && !eliminated.current[p2]);
        let cand = [];
        for (const e2 of E2) cand = cand.concat((cannons.current[e2] || []).filter((c2) => c2.hp > 0
          && !(wp === "emp" && c2.emp > roundRefVal.current)));
        if (!cand.length) return;   // kein Hofziel → dieser Lauf feuert nicht
        const pick2 = cand[(botAimSeq.current + index) % cand.length];
        const sc2 = (XMIX.mortarScatter || 1.6) * CELL;
        tx = pick2.c * CELL + CELL / 2 + (Math.random() - 0.5) * 2 * sc2;
        ty = pick2.r * CELL + CELL / 2 + (Math.random() - 0.5) * 2 * sc2;
        tx = Math.max(CELL / 2, Math.min(W - CELL / 2, tx));
        ty = Math.max(CELL / 2, Math.min(H - CELL / 2, ty));
      }
      const arc = (wp === "mortar" || wp === "emp");   // eigenes Ziel, keine Salven-Streuung
      const XF = arc ? null : balExp();
      // Salvenform folgt der Kanonenart (v3.57.0): Mauerbrecher FAECHERN sich
      // entlang der Mauer (breite Bresche statt alle in dasselbe Loch),
      // Bezwinger BUENDELN auf ein Ziel (Fokusfeuer — bei 12 Trefferpunkten je
      // Kanone ist verteiltes Feuer verschenkt). Gemessen: Fokusfeuer macht
      // den Unterschied zwischen 19/24 und 9/24 entschiedenen Partien.
      // ── Salvenform (v3.60.0, geaendert v3.83.0) ─────────────────────────
      // Die ERSTE Kanone trifft garantiert die anvisierte Zelle — wer zielt,
      // wird belohnt. Jede WEITERE traf bis v3.82.0 immer irgendwo im Quadrat
      // ±FAN_SPREAD; bei Spannweite 2 sind das 25 Zellen, die anvisierte
      // darunter genau eine. Auf dem Telefon fuehlte sich das an, als ginge
      // die Salve auseinander statt dorthin, wohin man zeigt.
      //
      // Jetzt streut sie nur mit Wahrscheinlichkeit FAN_CHANCE — sonst trifft
      // auch sie die anvisierte Zelle. Begruendung und Preis stehen bei der
      // Konstante in engine/const.ts.
      const streut = (XF && XF.faecherChance != null) ? XF.faecherChance : FAN_CHANCE;
      if (index > 0 && Math.random() < streut) {
        const R2 = (XF && XF.faecherSpan) || FAN_SPREAD;
        const dc = Math.floor(Math.random() * (R2 * 2 + 1)) - R2;
        const dr = Math.floor(Math.random() * (R2 * 2 + 1)) - R2;
        tx += dc * CELL;
        ty += dr * CELL;
        tx = Math.max(CELL / 2, Math.min(W - CELL / 2, tx));
        ty = Math.max(CELL / 2, Math.min(H - CELL / 2, ty));
      }
      if (salvoDbg) salvoDbg.treffer.push([Math.floor(ty / CELL), Math.floor(tx / CELL)]);
      const dist = Math.hypot(tx - sx, ty - sy);
      const dur = Math.max(30, 26 + dist * 0.09);
      // Aufgeladene Salve: zusaetzliche Kugeln je Ladungsstufe, leicht versetzt
      const XSa = balExp() || {};
      const extra = salveUsed;
      for (let ex = 1; ex <= extra; ex++) {
        const off = ex * (XSa.salveSpread || 1.2) * CELL * (ex % 2 ? 1 : -1);
        balls.current.push({
          sx, sy,
          tx: Math.max(CELL / 2, Math.min(W - CELL / 2, tx + off)),
          ty: Math.max(CELL / 2, Math.min(H - CELL / 2, ty)),
          prog: 0, dur, arcH: 24 + dist * 0.22, player, alive: true,
          cannonIndex: index, wp, trail: []
        });
        msOf(player).shots += 1;
      }
      balls.current.push({
        sx,
        sy,
        tx,
        ty,
        prog: 0,
        dur,
        arcH: 24 + dist * 0.22,
        player,
        alive: true,
        cannonIndex: index,
        wp,                 // Waffentyp dieses Laufs (Experiment, sonst null)
        kt: cn.kt || "std", // Kanonenart: mauerbrechend oder kanonenjagend
        trail: []
      });
      const angle = Math.atan2(ty - sy, tx - sx);
      const pCap = particles.current.length < 350;
      for (let i = 0; i < 10; i++) {
        const a = angle + (Math.random() - 0.5) * 0.9;
        const s = 1.5 + Math.random() * 3.5;
        const smoke = i >= 6;
        if (pCap) particles.current.push({
          x: sx + Math.cos(angle) * CELL * 2.2,
          y: sy + Math.sin(angle) * CELL * 2.2,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: smoke ? 22 : 10,
          maxLife: smoke ? 22 : 10,
          color: smoke ? ["#94a3b8", "#cbd5e1", "#78716c"][Math.floor(Math.random() * 3)] : (ACCENT_OF[player] || "#fbbf24"),
          size: smoke ? 3 + Math.random() * 2.5 : 1.5 + Math.random() * 2,
          round: true,
          gravity: smoke ? -0.05 : 0.06
        });
      }
    });
    if (salvoDbg) {
      const sd = window.__salvoDbg = window.__salvoDbg || [];
      sd.push(salvoDbg);
      if (sd.length > 60) sd.shift();
    }
    return true;
  }
  function impactAt(ball) {
    // Diagnose (gated): Einschläge im Nachlauf nach Schussphasen-Ende (v3.18.0)
    if (typeof window !== "undefined" && window.__mmDebug && shootSettling.current) window.__lateImpacts = (window.__lateImpacts || 0) + 1;
    const g = grid.current;
    const hitC = Math.floor(ball.tx / CELL);
    const hitR = Math.floor(ball.ty / CELL);
    if (hitR < 0 || hitR >= ROWS || hitC < 0 || hitC >= COLS) return;
    const target = g[hitR][hitC];
    // Einschlags-Diagnose (v3.48.0, gated): zaehlt, WORAUF Kugeln landen.
    // Aus der Balancing-Analyse: 40-51 % aller Einschlaege treffen TRUEMMER,
    // also bereits zerstoerte Zellen - weil alle Kanonen einer Salve nahezu
    // denselben Punkt beschiessen. Auswertung: window.__impactStats.
    if (typeof window !== "undefined" && window.__mmDebug) {
      const st = window.__impactStats = window.__impactStats || {empty:0, ownWall:0, enemyWall:0, rubble:0, cannon:0, castle:0, terrain:0, total:0};
      st.total++;
      const ep2 = ball.player === 1 ? 2 : 1;
      if (target === EMPTY) st.empty++;
      else if (target === WALL_OF[ep2]) st.enemyWall++;
      else if (target === WALL_OF[ball.player]) st.ownWall++;
      else if (target === RUBBLE || target === RUBBLE_C) st.rubble++;
      else if (target === CANNON_OF[ep2] || target === CANNON_OF[ball.player]) st.cannon++;
      else if (target === CASTLE_OF[1] || target === CASTLE_OF[2] || target === CASTLE_OF[3]) st.castle++;
      else st.terrain++;
    }
    // Schmiede-Einschlag-Effekt (v3.33.0): Palette des Schützen — Partikel
    // lokal, fx-Feld wandert über den State-Sync auch zu den Gästen.
    const impId = (playerInfo.current[ball.player] || {}).impact;
    const impFx = impId ? IMPACT_FX[impId] : null;
    explosions.current.push({ x: ball.tx, y: ball.ty, frame: 0, fx: impFx ? impId : void 0 });
    shakeRef.current = Math.max(shakeRef.current, 7);
    const pCap = particles.current.length < 350;
    const firePal = impFx ? impFx.p : ["#fff9c4", "#fbbf24", "#f97316", "#ef4444"];
    // Physik je Einschlag-Effekt (v3.66.0). Ohne gekauften Effekt gilt das
    // bisherige Standardverhalten — Feuerfunken plus grauer Schutt.
    const A = (impFx && impFx.art) || { n: 20, v: 4.5, auf: 1.2, grav: 0.10, life: 16, size: 3, rund: true, std: true };
    const zx = hitC * CELL + CELL / 2, zy = hitR * CELL + CELL / 2;
    for (let i = 0; i < A.n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = A.v * (0.45 + Math.random() * 0.75);
      // Standard behaelt die alte Mischung aus Funken und Schutt bei
      const fire = A.std ? Math.random() < 0.6 : true;
      if (!pCap) break;
      if (A.sog) {
        // Implosion: Start auf einem Ring, Bewegung nach INNEN
        const rad = CELL * (1.1 + Math.random() * 0.9);
        particles.current.push({
          x: zx + Math.cos(a) * rad, y: zy + Math.sin(a) * rad,
          vx: -Math.cos(a) * s * 0.55, vy: -Math.sin(a) * s * 0.55,
          life: A.life, maxLife: A.life,
          color: firePal[Math.floor(Math.random() * 4)],
          size: A.size * (0.6 + Math.random() * 0.7),
          round: A.rund, gravity: 0
        });
        continue;
      }
      particles.current.push({
        x: zx, y: zy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (A.auf || 0),
        life: fire ? A.life : 30, maxLife: fire ? A.life : 30,
        color: fire
          ? firePal[Math.floor(Math.random() * 4)]
          : ["#9ca3af", "#6b7280", "#78716c"][Math.floor(Math.random() * 3)],
        size: (fire ? A.size : 2) * (0.55 + Math.random() * 0.8),
        round: fire ? A.rund : false,
        gravity: fire ? A.grav : 0.05
      });
    }
    const opponents = playersList().filter((p) => p !== ball.player);
    let ep = null, kind = null;
    for (const p of opponents) {
      if (target === CANNON_OF[p]) {
        ep = p;
        kind = "cannon";
        break;
      }
      if (target === CASTLE_OF[p]) {
        ep = p;
        kind = "castle";
        break;
      }
      if (target === WALL_OF[p]) {
        ep = p;
        kind = "wall";
        break;
      }
    }
    if (ep === null) return;
    const pname = (x) => {
      var _a2;
      return ((_a2 = playerInfo.current[x]) == null ? void 0 : _a2.name) || (x === 1 ? t('bluePlayer') : x === 2 ? t('redPlayer') : t('greenPlayer'));
    };
    if (kind === "cannon") {
      // Zwei Kanonenarten: der Mauerbrecher richtet an Kanonen NICHTS aus.
      if ((ball.kt || "std") !== "slayer") return;   // Mauerbrecher wirken nicht auf Kanonen
      const enemyCannon = CANNON_OF[ep];
      const cn = cannons.current[ep].find((c) => Math.abs(hitR - c.r) <= 1 && Math.abs(hitC - c.c) <= 1);
      if (cn) {
        const XC = balExp() || {};
        if (ball.wp === "emp") {
          // Kein HP-Schaden: die Kanone verstummt fuer X Runden.
          cn.emp = roundRefVal.current + (XC.empRounds || 2);
          if (ball.player !== ep) msOf(ball.player).hits += 1;
          return;
        }
        // Durchschlag: entweder GEKAUFT (wuchtKauf, Standard) oder — nur als
        // Vergleichsmessung — automatisch mit der Runde (wucht).
        let wucht = 1;
        // Der Bezwinger ist Spezialist: er trifft haerter als der fruehere
        // Allrounder — sonst lohnt der eigene Lauf nicht, weil jede Salve nur
        // eine Haelfte des Arsenals einsetzt.
        wucht = SLAYER_DMG;   // Spezialist trifft haerter: jede Salve nutzt nur eine Arsenalhaelfte
        if (XC.wuchtKauf) wucht = 1 + ((upgrades.current[ball.player] || {}).power || 0);
        else if (XC.wucht) wucht = Math.min(XC.wuchtMax || 3,
          1 + Math.floor((roundRefVal.current - 1) / (XC.wucht || 3)));
        cn.hp -= (ball.wp === "mortar") ? (XC.mortarDmg || 3) : wucht;
        if (ball.player !== ep) msOf(ball.player).hits += 1; // Wirkungstreffer (Kanonen-Schaden)
        if (cn.hp <= 0) {
          // Kill-Belohnung (v3.16.0): Schrott für den Schützen
          let killScrap = 0;
          if (ball.player !== ep) {
            killScrap = SCRAP_CANNON;
            scrap.current[ball.player] = (scrap.current[ball.player] || 0) + SCRAP_CANNON;
            const ms = msOf(ball.player);
            ms.cannons += 1;
            ms.scrap += SCRAP_CANNON;
          }
          const newG2 = g.map((row) => [...row]);
          const enemyWallT = WALL_OF[ep];
          // Eine Kanone belegt SELBST ein 3x3-Feld (placeCannon). Radius 1
          // deckte damit exakt die Kanone ab und erreichte KEINE einzige
          // Mauer — die seit v3.16.0 dokumentierte Wirkung "Kill oeffnet die
          // Huelle" trat nie ein (gemessen: 144 Kills, 0 Mauern, 0 geoeffnete
          // Burgen). Radius 2 (v3.57.0): erst der Ring AUSSERHALB der Kanone
          // erreicht die Mauern, in die sie eingebaut ist. Gemessen oeffnen
          // damit 43 % aller Kills die Burg des Besitzers.
          const blastR = KILL_BLAST;
          // Wiederaufbau-Paket C (v3.30.0): war das die LETZTE Kanone (die
          // sterbende hat hp<=0 und zählt nicht mehr), birgt der Verteidiger
          // +1 Schrott je eigener Mauer, die die Explosion mitreißt.
          const salvage = rebuildAidActive(ep) && !eliminated.current[ep];
          let salvaged = 0;
          for (let dr = -blastR; dr <= blastR; dr++)
            for (let dc = -blastR; dc <= blastR; dc++) {
              const r = cn.r + dr, c = cn.c + dc;
              if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
              if (newG2[r][c] === enemyCannon) newG2[r][c] = RUBBLE_C;
              else if (newG2[r][c] === enemyWallT) {
                newG2[r][c] = RUBBLE;
                delete wallHp.current[r + "_" + c];
                if (ball.player !== ep) {
                  killScrap += SCRAP_WALL;
                  scrap.current[ball.player] = (scrap.current[ball.player] || 0) + SCRAP_WALL;
                  const msW = msOf(ball.player);
                  msW.walls += 1;
                  msW.scrap += SCRAP_WALL;
                  if (salvage) {
                    salvaged += SCRAP_WALL;
                    scrap.current[ep] = (scrap.current[ep] || 0) + SCRAP_WALL;
                    msOf(ep).scrap += SCRAP_WALL;
                  }
                }
              }
            }
          // Diagnose (gated): OEFFNET die Kill-Explosion die Burg des Besitzers?
          // Genau das ist die These hinter der Spieler-Taktik "erst die Kanonen".
          if (typeof window !== "undefined" && window.__mmDebug) {
            const kd = window.__killDbg = window.__killDbg || { kills: 0, oeffnend: 0, warOffen: 0 };
            kd.kills++;
            const zuVor = isCastleClosed(g, ep, castles.current[ep]);
            const zuDanach = isCastleClosed(newG2, ep, castles.current[ep]);
            if (!zuVor) kd.warOffen++;
            else if (!zuDanach) kd.oeffnend++;
          }
          if (killScrap > 0) addScrapPop(cn.c * CELL + CELL / 2, cn.r * CELL, killScrap, ball.player);
          if (salvaged > 0) addScrapPop(cn.c * CELL + CELL / 2, cn.r * CELL + CELL * 1.8, salvaged, ep);
          setGrid(newG2);
          cannons.current[ep] = cannons.current[ep].filter((c) => c.id !== cn.id);
          explosions.current.push({ x: cn.c * CELL + CELL / 2, y: cn.r * CELL + CELL / 2, frame: 0, big: true });
          shakeRef.current = Math.max(shakeRef.current, 14);
          const pCapC = particles.current.length < 350;
          for (let i = 0; i < 26; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 2.5 + Math.random() * 5.5;
            const fire = Math.random() < 0.65;
            if (pCapC) particles.current.push({
              x: cn.c * CELL + CELL / 2, y: cn.r * CELL + CELL / 2,
              vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.5,
              life: fire ? 26 : 38, maxLife: fire ? 26 : 38,
              color: fire
                ? ["#fff9c4", "#fbbf24", "#f97316", "#ef4444", "#b45309"][Math.floor(Math.random() * 5)]
                : ["#9ca3af", "#6b7280", "#78716c", "#a8a29e"][Math.floor(Math.random() * 4)],
              size: fire ? 3 + Math.random() * 4.5 : 2 + Math.random() * 3,
              round: fire,
              gravity: fire ? 0.14 : 0.08
            });
          }
          showWarn(t('warnKanoneZerstoert', {name: pname(ep)}));
          setUiTick((t) => t + 1);
        }
      }
      return;
    }
    if (kind === "castle") return;
    // Der Bezwinger richtet an Mauern NICHTS aus — er ist reine Kanonenjagd.
    if ((ball.kt || "std") === "slayer") return;    // Bezwinger wirkt nicht auf Mauern
    {
      // STEILFEUER-MOERSER (Experiment): die Granate fliegt UEBER den Mauerring
      // und detoniert erst im Burghof — an der Mauer richtet sie nichts aus.
      if (ball.wp === "mortar" || ball.wp === "emp") return;
    }
    const enemyWall = WALL_OF[ep];
    const castleClosedBefore = isCastleClosed(g, ep, castles.current[ep]);
    const newG = g.map((row) => [...row]);
    let wallDestroyed = false;
    if (target === enemyWall) {
      const wkey = hitR + "_" + hitC;
      // Panzermauern (v3.16.0): erster Treffer knackst nur an
      if ((upgrades.current[ep] || {}).armor && !wallHp.current[wkey]) {
        wallHp.current[wkey] = 1;
        if (ball.player !== ep) msOf(ball.player).hits += 1; // Riss = Wirkungstreffer
      } else {
        delete wallHp.current[wkey];
        newG[hitR][hitC] = RUBBLE;
        wallDestroyed = true;
        {
          if (ball.wp === "splash") {
            // SPLASH-MOERSER: reisst ein Kreuz aus der Mauer statt einer Zelle.
            for (const [nr3, nc3] of [[hitR-1,hitC],[hitR+1,hitC],[hitR,hitC-1],[hitR,hitC+1]]) {
              if (nr3 < 0 || nr3 >= ROWS || nc3 < 0 || nc3 >= COLS) continue;
              if (newG[nr3][nc3] !== WALL_OF[ep]) continue;
              newG[nr3][nc3] = RUBBLE;
              delete wallHp.current[nr3 + "_" + nc3];
              if (ball.player !== ep) { msOf(ball.player).walls += 1; msOf(ball.player).hits += 1; }
            }
          }
          if (ball.wp === "fire") {
            // BRANDSATZ: die Zelle und ihre Nachbarn brennen und sind fuer
            // X Runden unbebaubar. Greift die Wiederaufbau-Kapazitaet direkt an,
            // statt mehr Schaden zu machen.
            const until = roundRefVal.current + ((balExp() || {}).fireRounds || 3);
            burning.current[hitR + "_" + hitC] = until;
            if (typeof window !== "undefined" && window.__mmDebug) {
              const fd = window.__fireDbg = window.__fireDbg || { marked: 0, blocked: 0 };
              fd.marked++;
            }
            for (const [nr4, nc4] of [[hitR-1,hitC],[hitR+1,hitC],[hitR,hitC-1],[hitR,hitC+1]]) {
              if (nr4 < 0 || nr4 >= ROWS || nc4 < 0 || nc4 >= COLS) continue;
              if (newG[nr4][nc4] === EMPTY || newG[nr4][nc4] === RUBBLE) burning.current[nr4 + "_" + nc4] = until;
            }
          }
          const X = balExp();
          if (X && X.narben) {
            const k2 = hitR + "_" + hitC;
            scarCount.current[k2] = (scarCount.current[k2] || 0) + 1;
            if (scarCount.current[k2] >= (X.narbenAb || 2)) scars.current[k2] = true;
          }
          if (X && X.bruch) {
            // Nachbarmauern des GETROFFENEN Spielers anreissen (wallHp-Riss)
            const nb2 = [[hitR-1,hitC],[hitR+1,hitC],[hitR,hitC-1],[hitR,hitC+1]];
            for (const [nr2, nc2] of nb2) {
              if (nr2 < 0 || nr2 >= ROWS || nc2 < 0 || nc2 >= COLS) continue;
              if (newG[nr2][nc2] !== WALL_OF[ep]) continue;
              const nk = nr2 + "_" + nc2;
              if (wallHp.current[nk]) { newG[nr2][nc2] = RUBBLE; delete wallHp.current[nk]; }
              else wallHp.current[nk] = 1;   // angerissen
            }
          }
        }
        if (ball.player !== ep) {
          const lohn = (balExp() || {}).wandLohn || SCRAP_WALL;
          scrap.current[ball.player] = (scrap.current[ball.player] || 0) + lohn;
          addScrapPop(hitC * CELL + CELL / 2, hitR * CELL, lohn, ball.player);
          const msD = msOf(ball.player);
          msD.walls += 1;
          msD.scrap += lohn;
          msD.hits += 1;
          // Wiederaufbau-Paket C (v3.30.0): Trümmer-Bergung — der kanonenlose
          // Verteidiger birgt +1 Schrott aus der eigenen zerstörten Mauer.
          if (rebuildAidActive(ep) && !eliminated.current[ep]) {
            scrap.current[ep] = (scrap.current[ep] || 0) + SCRAP_WALL;
            msOf(ep).scrap += SCRAP_WALL;
            addScrapPop(hitC * CELL + CELL / 2, hitR * CELL + CELL * 1.6, SCRAP_WALL, ep);
          }
        }
      }
    }
    setGrid(newG);
    const castleClosedAfter = isCastleClosed(newG, ep, castles.current[ep]);
    if (castleClosedBefore && !castleClosedAfter && !warnedOpen.current[ep]) {
      warnedOpen.current[ep] = true;
      showWarn(t('warnBurgOffen', {name: pname(ep)}));
    }
  }
  function placePiece(player, gr, gc) {
    const g = grid.current;
    if (!g) return;
    if (eliminated.current[player]) return;
    const ter = terrain.current;
    const p = pieces.current[player];
    const { cells } = p;
    const offR = gr - Math.floor(Math.max(...cells.map(([r]) => r)) / 2);
    const offC = gc - Math.floor(Math.max(...cells.map(([, c]) => c)) / 2);
    const abs = cells.map(([r, c]) => [r + offR, c + offC]);
    const XP = balExp();
    if (XP && (XP.limit || XP.limitStart)) {
      // Bauteil-Limit je Bauphase: begrenzt die Wiederaufbau-KAPAZITAET statt
      // der Zeit. Zeitdruck trifft nur Menschen - ein Bot platziert sofort.
      // WICHTIG (Messung v3.49.0): Ein STARRES Limit zerstoert die Eroeffnung -
      // mit 4 Teilen laesst sich die Burg nicht einmal initial versiegeln,
      // Partien endeten nach 1,5 Runden. Daher schrumpfender Nachschub:
      // anfangs grosszuegig, mit jeder Runde knapper.
      const lim = XP.limitStart
        ? Math.max(XP.limitMin || 5, XP.limitStart - (roundRefVal.current - 1) * (XP.limitStep || 1))
        : XP.limit;
      const used = placedThisPhase.current[player] || 0;
      if (used >= lim) return;
    }
    {
      // BAURADIUS (Experiment v3.53.0): Mauern duerfen nur nahe der eigenen Burg
      // stehen. Ohne das weicht der Verteidiger einer Bresche einfach aus und
      // zieht den Ring weiter aussen neu — die Truemmer, die der Beschuss
      // hinterlaesst, sind dann folgenlos. Anders als ein Bauteil-Limit haengt
      // diese Regel NICHT davon ab, wie viele Teile jemand setzt: sie trifft
      // Mensch und Bot gleich.
      const XR = balExp() || {};
      if (XR.bauRadius) {
        const ct = castles.current[player];
        if (ct) for (const [r, c] of abs) {
          if (Math.max(Math.abs(r - ct.r), Math.abs(c - ct.c)) > XR.bauRadius) return;
        }
      }
    }
    for (const [r, c] of abs) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      if (g[r][c] !== EMPTY) return;
      if (!isBuildable(ter, r, c, player)) return;
      if (XP && XP.narben && scars.current[r + "_" + c]) return;  // dauerhafte Narbe
      if (burning.current[r + "_" + c] > roundRefVal.current) {   // brennt noch
        if (typeof window !== "undefined" && window.__mmDebug) {
          const fd = window.__fireDbg = window.__fireDbg || { marked: 0, blocked: 0 };
          fd.blocked++;
        }
        return;
      }
    }
    {
      const XK = balExp() || {};
      // Messung: Kosten AB DEM ERSTEN TEIL machen die Eroeffnung unmoeglich —
      // Startschrott 15, erster Mauerring ~20 Teile, Partien endeten in Runde 1
      // mit ueber 2000 abgelehnten Bauzuegen. Deshalb ein Freikontingent je
      // Bauphase; erst der Wiederaufbau DARUEBER HINAUS kostet. Und Runde 1
      // bleibt ganz frei, damit die Burg initial versiegelbar ist.
      const frei = XK.mauerFrei == null ? 6 : XK.mauerFrei;
      const zahlpflichtig = XK.mauerKosten
        && roundRefVal.current > 1
        && (placedThisPhase.current[player] || 0) >= frei;
      if (zahlpflichtig) {
        // Bauen kostet — wer viele Loecher stopfen muss, kann sich weniger
        // Kanonen leisten. Erst dadurch wird der Mauer-Beschuss wirtschaftlich
        // wirksam statt folgenlos.
        const kosten = XK.mauerKosten;
        if ((scrap.current[player] || 0) < kosten) {
          if (typeof window !== "undefined" && window.__mmDebug) {
            const bd = window.__bauDbg = window.__bauDbg || { gebaut: 0, bezahlt: 0, abgelehnt: 0 };
            bd.abgelehnt++;
          }
          return;   // kein Schrott -> Loch bleibt offen
        }
        scrap.current[player] -= kosten;
        if (typeof window !== "undefined" && window.__mmDebug) {
          const bd = window.__bauDbg = window.__bauDbg || { gebaut: 0, bezahlt: 0, abgelehnt: 0 };
          bd.gebaut++; bd.bezahlt += kosten;
        }
      }
    }
    placedThisPhase.current[player] = (placedThisPhase.current[player] || 0) + 1;
    const newG = g.map((row) => [...row]);
    const mark = WALL_OF[player];
    for (const [r, c] of abs) newG[r][c] = mark;
    setGrid(newG);
    // Nachlege-Stein OHNE Ghost (v3.16.3): die geerbte Position blieb als
    // Phantom-Vorschau stehen (v.a. nach Bot-/Gegner-Zügen sichtbar).
    pieces.current[player] = { cells: randomShape(), ghostR: null, ghostC: null };
    setUiTick((t) => t + 1);
    // Tutorial: hat der Spieler (P1) das vom Bot geschossene Loch wieder geschlossen? → geschafft!
    if (tutorialMode.current && player === 1 && tutorialBotShot.current && !tutorialDoneQueued.current &&
        castles.current[1] && isCastleClosed(newG, 1, castles.current[1])) {
      tutorialDoneQueued.current = true;
      showWarn(t('tutorialSealed'));
      setTimeout(() => setShowTutorialDone(true), 1500);
    }
  }
  // UI-Einstieg: Gast sendet Action, Host/lokal kauft direkt (v3.16.0)
  function doBuy(player, item) {
    SFX.buy && SFX.buy();
    // Reparatur: Shop-Panel ~1,8s ausblenden, damit das grüne Highlight der
    // reparierten Zellen sichtbar ist (v3.32.0). Gast: optimistisch (Kauf
    // läuft asynchron über den Host).
    const hideForRepair = () => {
      shopHideUntil.current[player] = performance.now() + 1800;
      setUiTick((t) => t + 1);
      setTimeout(() => setUiTick((t) => t + 1), 1900);
    };
    if (online.current && myRole.current !== 1) {
      if (item === "repair") hideForRepair();
      sendAction({ type: "buy", item });
      return;
    }
    const bought = buyUpgrade(player, item);
    if (bought && item === "repair") hideForRepair();
  }
  // Reparatur-Trupp (v3.16.4): bis zu maxN Trümmer im Umkreis der eigenen
  // Burg (Chebyshev ≤ 10) sofort in eigene Mauern verwandeln. Gibt Anzahl zurück.
  function repairRubble(player, maxN) {
    const g = grid.current;
    const castle = castles.current[player];
    if (!g || !castle) return 0;
    const cand = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (g[r][c] !== RUBBLE) continue;
        const d = Math.max(Math.abs(r - castle.r), Math.abs(c - castle.c));
        if (d <= 10) cand.push([r, c, d]);
      }
    if (!cand.length) return 0;
    cand.sort((a, b) => a[2] - b[2]);
    const newG = g.map((row) => [...row]);
    const n = Math.min(maxN, cand.length);
    for (let i = 0; i < n; i++) {
      newG[cand[i][0]][cand[i][1]] = WALL_OF[player];
      repairFx.current.push({ r: cand[i][0], c: cand[i][1], frame: 0 });
    }
    if (repairFx.current.length > 12) repairFx.current.splice(0, repairFx.current.length - 12);
    setGrid(newG);
    return n;
  }
  // Shop-Kauf (v3.16.0). Läuft NUR beim Zustands-Besitzer (Host/lokal) —
  // Gäste senden eine buy-Action. Rückgabe: true wenn gekauft.
  function buyUpgrade(player, item) {
    if (phase_r.current !== "cannon" || eliminated.current[player]) return false;
    const up = upgrades.current[player] || (upgrades.current[player] = { reload: 0, armor: 0, repair: 0, cbought: 0 });
    const have = scrap.current[player] || 0;
    let price = 0;
    // SPERRFEUER (Experiment): teurer Grosskauf als SPARZIEL. Schlaegt sofort
    // eine Schneise in den gegnerischen Mauerring — der Moment, in dem sich
    // Zurueckhalten auszahlt. Ohne so ein Ziel ist Sparen sinnlos (gemessen).
    if (item === "sperr") {
      const XS = balExp() || {};
      if (!XS.sperr) return false;
      const pr = XS.sperrPreis || 120;
      if (have < pr) return false;
      const E = playersList().find((q) => q !== player && !eliminated.current[q]);
      const ec = E && castles.current[E];
      if (!ec) return false;
      // Schneise: die dem Schuetzen zugewandte Mauerseite auf Breite N
      const g0 = grid.current, wallT = WALL_OF[E];
      const src = slingAnchor(player);
      const dirDown = (ec.r * CELL) > src.y ? -1 : 1;   // von welcher Seite kommt der Angriff
      const newG = g0.map((row) => [...row]);
      let hit = 0;
      const br = XS.sperrBreite || 7;
      for (let dc = -Math.floor(br / 2); dc <= Math.floor(br / 2); dc++) {
        // von aussen nach innen die ERSTE Mauerzelle je Spalte sprengen
        for (let step = 9; step >= 2; step--) {
          const r = ec.r + dirDown * step, c = ec.c + dc;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
          if (newG[r][c] !== wallT) continue;
          newG[r][c] = RUBBLE;
          delete wallHp.current[r + "_" + c];
          msOf(player).walls += 1;
          hit++;
          break;
        }
      }
      scrap.current[player] = have - pr;
      msOf(player).buys += 1;
      setGrid(newG);
      shakeRef.current = Math.max(shakeRef.current, 18);
      if (typeof window !== "undefined" && window.__mmDebug) {
        const sd2 = window.__sperrDbg = window.__sperrDbg || { kaeufe: 0, mauern: 0 };
        sd2.kaeufe++; sd2.mauern += hit;
      }
      setUiTick((t) => t + 1);
      return true;
    }
    if (item === "cannon") {
      // Wiederaufbau-Paket B (v3.30.0): ohne Kanonen gilt der Basispreis
      // (Staffel pausiert für diesen Kauf, cbought zählt trotzdem weiter)
      price = cannonPriceOf(player);
      if (have < price) return false;
      up.cbought += 1;
      cannonBudget.current[player] = (cannonBudget.current[player] || 0) + 1;
    } else if (item === "reload") {
      if (up.reload >= 2) return false;
      price = SHOP.reload.prices[up.reload];
      if (have < price) return false;
      up.reload += 1;
    } else if (item === "armor") {
      if (up.armor) return false;
      price = SHOP.armor.price;
      if (have < price) return false;
      up.armor = 1;
    } else if (item === "slayer") {
      // Keine Regel-Sperre mehr (v3.73.0): der Preis allein haelt den Bezwinger
      // aus Runde 1 heraus — Begruendung und Rechnung in economy.js.
      price = SHOP_SLAYER;
      if (have < price) return false;
      cannonBudget.current[player] = (cannonBudget.current[player] || 0) + 1;
      cannonTypeQueue.current[player].push("slayer");
    } else if (item === "power") {
      const XW = balExp() || {};
      if (!XW.wuchtKauf) return false;
      const preise = XW.powerPreise || [30, 60, 100];
      const stufe = up.power || 0;
      if (stufe >= preise.length) return false;
      price = preise[stufe];
      if (have < price) return false;
      up.power = stufe + 1;
    } else if (item === "repair") {
      // Preis-Staffel (v3.24.0): 15 → 20 → 25 … pro Karte (Reset in beginSetup)
      price = SHOP.repair.base + SHOP.repair.step * (up.repair || 0);
      if (have < price) return false;
      // SOFORT reparieren (v3.16.4): bis zu 3 Trümmer nahe der eigenen Burg
      // werden augenblicklich wieder zu Mauern — sichtbarer Effekt statt
      // unsichtbarer Gutschrift für später.
      const fixedN = repairRubble(player, 3);
      if (fixedN === 0) return false;
      up.repair = (up.repair || 0) + 1;
      showWarn(t("repairDone", { n: fixedN }));
    } else return false;
    scrap.current[player] = have - price;
    msOf(player).buys += 1; // Match-Statistik (v3.21.0): Rüstungs-Shop-Käufe
    if (typeof window !== "undefined" && window.__mmDebug) (window.__buys = window.__buys || []).push(player + ":" + item);
    // Kauf-Pop-Animation triggern (v3.17.0, rein optisch)
    const bk = player + "_" + item;
    shopBuyAnim.current[bk] = (shopBuyAnim.current[bk] || 0) + 1;
    SFX.place && SFX.place();
    setUiTick((t) => t + 1);
    if (online.current && myRole.current === 1) pushState(true);
    return true;
  }
  function placeCannon(player, gr, gc) {
    var _a2;
    const g = grid.current;
    if (!g) return;
    if (eliminated.current[player]) return;
    if (cannonBudget.current[player] <= 0) return;
    const ter = terrain.current;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = gr + dr, c = gc + dc;
        if (r < 1 || r >= ROWS - 1 || c < 1 || c >= COLS - 1) return;
        if (g[r][c] !== EMPTY) return;
        if (!isBuildable(ter, r, c, player)) return;
      }
    const newG = g.map((row) => [...row]);
    const mark = CANNON_OF[player];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        newG[gr + dr][gc + dc] = mark;
    setGrid(newG);
    if (typeof window !== "undefined" && window.__mmDebug) { window.__places = window.__places || {}; window.__places[player] = (window.__places[player] || 0) + 1; }
    cannonSeq.current += 1;
    const kTyp = (cannonTypeQueue.current[player] || []).shift() || "std";
    cannons.current[player].push({ r: gr, c: gc, id: "c" + cannonSeq.current, hp: CANNON_HP, kt: kTyp });
    cannonBudget.current[player] -= 1;
    setUiTick((t) => t + 1);
    const left = cannonBudget.current[player];
    const pn = ((_a2 = playerInfo.current[player]) == null ? void 0 : _a2.name) || (player === 1 ? t('bluePlayer') : player === 2 ? t('redPlayer') : t('greenPlayer'));
    showWarn(left > 0 ? t('warnKanoneGesetzt', {name: pn, left}) : t('warnLastCannon', {flag: FLAG_OF[player] || "\u2654", name: pn}));
    if (phase_r.current === "setup" && playersList().every((p) => cannonBudget.current[p] <= 0) && timerVal.current > 3) {
      timerVal.current = 3;
      setTimer(3);
    }
  }
  const rotatePiece = (player) => {
    const guest = online.current && myRole.current !== 1;
    pieces.current[player].cells = rotateCW(pieces.current[player].cells);
    setUiTick((t) => t + 1);
    vibriere(30);
    if (guest) {
      sendAction({ type: "rotate" });
      return;
    }
    if (online.current) pushState(true);
  };
  // ── Bot / KI-Gegner (lokaler Einzelspieler-Modus) ──────────────────────────
  // Mensch = P1, KI = P2. Die KI nutzt dieselben Spielfunktionen wie ein Spieler.
  const botMode = useRef(false);
  const tutorialMode = useRef(false); // geführtes erstes Spiel: Bot schießt EIN Loch + Coach-Hinweise
  const tutorialBotShot = useRef(false);   // Bot hat sein einmaliges Tutorial-Loch geschossen
  const tutorialDoneQueued = useRef(false); // Abschluss (nach Wieder-Verschließen) bereits ausgelöst
  // Startet das interaktive Tutorial: lokales Spiel gegen einen passiven Bot mit
  // Coach-Anweisungen pro Phase. Markiert sofort als gesehen (kein erneuter Auto-Start).
  // Bot-Spiel-Identitäten (v3.14.16): Mensch = eigenes Profil, Bot = zufälliger
  // Name aus BOT_NAMES + zufälliges Wappen. Das HUD zeigt dann Namen statt P1/P2.
  function initBotMatchIdentity() {
    playerInfo.current[1] = {
      name: (profile == null ? void 0 : profile.name) || t('playerFallback', { n: 1 }),
      wappen: (profile == null ? void 0 : profile.wappen) || "skelett",
      color: (profile == null ? void 0 : profile.color) || "#2563eb",
      elo: 1e3,
      trail: cosOf(profile).equipped.trail, // eigene Kosmetik auch im Bot-Spiel sichtbar
      frame: cosOf(profile).equipped.frame,
      cannon: cosOf(profile).equipped.cannon,
      impact: cosOf(profile).equipped.impact
    };
    playerInfo.current[2] = {
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      wappen: BOT_WAPPEN[Math.floor(Math.random() * BOT_WAPPEN.length)],
      color: "#dc2626",
      elo: 1e3
    };
  }
  function startGuidedTutorial() {
    // Flow-Exklusivität (v3.14.12): Das Tutorial darf NIE eine laufende
    // Online-Session kapern. Läuft Matchmaking, wird es sauber abgebrochen
    // (Ticket löschen, Listener stoppen) — sonst sucht die Queue-Maschinerie
    // unsichtbar hinter dem Tutorial weiter und matcht mitten hinein.
    if (online.current) return;
    if (mmActive.current) cancelMatchmaking();
    // Auch bei Abbruch des Intros kein erneuter Auto-Start (Erstspieler-Flow).
    try { localStorage.setItem('fortress_tutorial_done', '1'); } catch (e) {}
    setShowOnboarding(false);
    setMpScreen(null);
    // Ziel-Erklärung ZUERST (v3.37.0): Gewinnen/Verlieren/Kanonen-Regel —
    // die Umschlossen-Regel ist die häufigste Verständnishürde.
    setShowTutorialIntro(true);
  }
  function beginTutorialRun() {
    setShowTutorialIntro(false);
    online.current = false;
    botMode.current = true;
    tutorialMode.current = true;
    initBotMatchIdentity();
    tutorialBotShot.current = false;
    tutorialDoneQueued.current = false;
    setShowTutorialDone(false);
    numPlayersRef.current = 2;
    setNumPlayers(2);
    fullReset();
  }
  function botPlaceOneCannon(g, B) {
    const castle = castles.current[B];
    if (!castle) return false;
    const ter = terrain.current;
    const oc = computeOutsideMapForCannons(g, B);
    const wall = WALL_OF[B];
    const offs = [];
    for (let dr = -11; dr <= 11; dr++) for (let dc = -11; dc <= 11; dc++) {
      if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue; // Burg nicht überbauen
      offs.push([dr, dc]);
    }
    offs.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])));
    // Pass 0: bereits eingemauerte Plätze (sofort schussbereit).
    // Pass 1: an die eigene Festung angrenzende Plätze — werden in der Bauphase ummauert.
    //         So wächst der Bot jede Runde um eine Kanone, statt bei 2 stehenzubleiben.
    for (let pass = 0; pass < 2; pass++) {
      for (const [dr, dc] of offs) {
        const r = castle.r + dr, c = castle.c + dc;
        if (r < 2 || r >= ROWS - 2 || c < 2 || c >= COLS - 2) continue;
        let free = true;
        for (let q = -1; q <= 1 && free; q++) for (let w = -1; w <= 1; w++) {
          if (g[r + q][c + w] !== EMPTY || !isBuildable(ter, r + q, c + w, B)) { free = false; break; }
        }
        if (!free) continue;
        if (pass === 0) {
          if (oc[r * COLS + c] !== 0) continue;
        } else {
          let near = false;
          for (let q = -2; q <= 2 && !near; q++) for (let w = -2; w <= 2; w++) {
            const rr = r + q, cc = c + w;
            if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && g[rr][cc] === wall) { near = true; break; }
          }
          if (!near) continue;
        }
        const before = cannonBudget.current[B];
        placeCannon(B, r, c);
        if (cannonBudget.current[B] < before) return true;
      }
    }
    return false;
  }
  // Füllt die einem Objekt (Burg/Kanone) nächsten außen-erreichbaren Leerzellen solide auf,
  // bis es 8-dicht ummauert ist. Anker dort, wo das Teil passt (nicht an Mauern zentrieren).
  function botFillNear(g, ter, B, outside, obj, maxPlace) {
    const cands = [];
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      if (!outside[r * COLS + c] || g[r][c] !== EMPTY || !isBuildable(ter, r, c, B)) continue;
      const d = Math.max(Math.abs(r - obj.r), Math.abs(c - obj.c));
      if (d > 5) continue; // nah am Objekt bleiben → kompakter Schutzring statt riesiger Klotz
      cands.push({ r, c, d });
    }
    cands.sort((a, b) => a.d - b.d);
    let placed = 0;
    for (let i = 0; i < Math.min(cands.length, 16) && placed < maxPlace; i++) {
      const { r, c } = cands[i];
      for (let rot = 0; rot < 4; rot++) {
        const gv = grid.current;
        placePiece(B, r, c);
        if (grid.current !== gv) { placed++; break; }
        pieces.current[B].cells = rotateCW(pieces.current[B].cells);
      }
    }
    return placed > 0;
  }
  // ── Abdeckungs-genaues Platzieren (v3.29.0) ───────────────────────────────
  // Platziert das AKTUELLE Bauteil so, dass eine seiner Zellen EXAKT (tr,tc)
  // abdeckt. Probiert alle 4 Rotationen × alle Zell-Offsets. Das ist der
  // Kern-Fix der Bau-KI: vorher wurden Teile platziert, die zwar NEBEN die
  // Lücke passten, sie aber nicht abdeckten — der Bot baute Müll neben das
  // Loch und hielt es für repariert.
  function botPlaceCovering(B, tr, tc, ter) {
    for (let rot = 0; rot < 4; rot++) {
      const cells = pieces.current[B].cells;
      const maxR = Math.max(...cells.map(([r]) => r));
      const maxC = Math.max(...cells.map(([, c]) => c));
      for (const [dr, dc] of cells) {
        const offR = tr - dr, offC = tc - dc;
        let fits = true;
        for (const [er, ec] of cells) {
          const rr = er + offR, cc = ec + offC;
          if (rr < 1 || rr >= ROWS - 1 || cc < 1 || cc >= COLS - 1 || grid.current[rr][cc] !== EMPTY || !isBuildable(ter, rr, cc, B)) { fits = false; break; }
        }
        if (!fits) continue;
        // placePiece zentriert das Teil um (gr,gc) — Anker so wählen, dass offR/offC reproduziert werden
        const gr = offR + Math.floor(maxR / 2), gc = offC + Math.floor(maxC / 2);
        const gv = grid.current;
        placePiece(B, gr, gc);
        if (grid.current !== gv) return true;
      }
      pieces.current[B].cells = rotateCW(pieces.current[B].cells);
    }
    return false;
  }
  // Baut die SOLL-Mauer als sauberes Rechteck (wie die Start-Mauer) wieder auf: füllt die
  // Lücken exakt auf dem Mauer-Rand um obj (±hH Zeilen, ±hW Spalten) → sieht aus wie eine
  // reparierte Mauer, nicht wie ein zufälliger Klotz. Seit v3.29.0 nur noch mit
  // Platzierungen, die die Lückenzelle WIRKLICH abdecken.
  function botRebuildRing(g, ter, B, obj, hH, hW, maxPlace) {
    const gaps = [];
    for (let dr = -hH; dr <= hH; dr++) for (let dc = -hW; dc <= hW; dc++) {
      if (dr !== -hH && dr !== hH && dc !== -hW && dc !== hW) continue; // nur der Rand
      const r = obj.r + dr, c = obj.c + dc;
      if (r < 1 || r >= ROWS - 1 || c < 1 || c >= COLS - 1) continue;
      if (g[r][c] === EMPTY && isBuildable(ter, r, c, B)) gaps.push({ r, c });
    }
    let placed = 0;
    for (const gap of gaps) {
      if (placed >= maxPlace) break;
      if (grid.current[gap.r][gap.c] !== EMPTY) continue; // schon durch ein vorheriges Teil gefüllt
      if (botPlaceCovering(B, gap.r, gap.c, ter)) placed++;
    }
    return placed > 0;
  }
  // ── Leck-Versiegler (v3.29.0) ────────────────────────────────────────────
  // Solange die Burg offen ist: die außen-erreichbare, bebaubare Zelle mit dem
  // kleinsten Burg-Abstand ABDECKEND bebauen und neu prüfen. Konvergiert auch,
  // wenn Trümmer (nicht bebaubar!) in der Soll-Mauer liegen — dann entsteht
  // automatisch ein Umgehungs-Ring um die Trümmerzelle. Das konnte die alte KI
  // nicht: sie kannte nur den Rechteck-Ring und blindes Auffüllen.
  function botSealCastle(B, ter, maxPlace) {
    let placed = 0;
    while (placed < maxPlace) {
      const g = grid.current;
      const castle = castles.current[B];
      if (!castle || isCastleClosed(g, B, castle)) break;
      const outside = computeOutsideMap(g, B);
      const cands = [];
      for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
        if (!outside[r * COLS + c] || g[r][c] !== EMPTY || !isBuildable(ter, r, c, B)) continue;
        const d = Math.max(Math.abs(r - castle.r), Math.abs(c - castle.c));
        if (d < 2 || d > 9) continue; // d≥2: direkt an der Burg dichtet nicht (isObjectClosed prüft die 3×3-Nachbarn)
        cands.push({ r, c, d });
      }
      if (!cands.length) break;
      cands.sort((a, b) => a.d - b.d);
      let ok = false;
      for (let i = 0; i < Math.min(cands.length, 24) && !ok; i++)
        ok = botPlaceCovering(B, cands[i].r, cands[i].c, ter);
      if (!ok) break; // aktuelles Teil passt nirgends abdeckend → Fallback (FillNear) verbrennt es
      placed++;
    }
    return placed > 0;
  }
  // ── Wiederaufbau-Paket (v3.30.0): Comeback-Hilfe ohne Kanonen ──────────────
  // Aktiv, wenn ein Spieler KEINE einsatzfähige Kanone mehr hat (auch keine
  // gekaufte, noch unplatzierte). Dann greifen drei Hilfen:
  //   A) Überlebens-Sold verdoppelt (SCRAP_REBUILD statt SCRAP_SURVIVE),
  //   B) nächste Kanone zum Basispreis (Preisstaffel pausiert diesen Kauf),
  //   C) Trümmer-Bergung: +1 Schrott, wenn die EIGENE Mauer zerstört wird.
  // Nicht ausnutzbar: Kanonen verlieren kostet die Investition UND schenkt dem
  // Gegner +12 pro Kill — die Hilfen kompensieren nur teilweise.
  function rebuildAidActive(p) {
    const alive = (cannons.current[p] || []).filter((c) => c.hp > 0).length;
    return alive + (cannonBudget.current[p] || 0) <= 0;
  }
  function cannonPriceOf(p) {
    const up = upgrades.current[p] || {};
    return rebuildAidActive(p) ? SHOP.cannon.base : SHOP.cannon.base + SHOP.cannon.step * (up.cbought || 0);
  }
  // Liegen Trümmer im Reparatur-Radius (≤10) der Bot-Burg? (v3.20.0, Schwer-Bot)
  function botRubbleNearCastle(B) {
    const g = grid.current, ct = castles.current[B];
    if (!g || !ct) return false;
    for (let r = Math.max(0, ct.r - 10); r <= Math.min(ROWS - 1, ct.r + 10); r++)
      for (let c = Math.max(0, ct.c - 10); c <= Math.min(COLS - 1, ct.c + 10); c++)
        if (g[r][c] === RUBBLE) return true;
    return false;
  }
  function botBuild(g, ter, B) {
    const castle = castles.current[B];
    // 1) Burg schließen — HÖCHSTE Priorität, dreistufig (v3.29.0):
    //    a) Soll-Ring sauber wieder aufbauen (hübsches Rechteck, deckend),
    //    b) Leck-Versiegler (umbaut auch Trümmer in der Soll-Mauer),
    //    c) Auffüllen nahe der Burg (verbrennt ein Teil, das nirgends
    //       abdeckend passt → nächster Tick bekommt ein neues Zufallsteil).
    if (castle && !isCastleClosed(g, B, castle)) {
      if (botRebuildRing(g, ter, B, castle, 3, 6, 2)) return;
      if (botSealCastle(B, ter, 2)) return;
      if (botFillNear(g, ter, B, computeOutsideMap(g, B), castle, 1)) return;
      return; // Burg offen, aber nichts platzierbar → nicht an Kanonen weiterbauen
    }
    if (tutorialMode.current) return; // Tutorial: nur Burg sichern, keine Kanonen-Ummauerung/Wachstum
    // 2) Noch offene Kanonen mit engem Ring einmauern → werden schussbereit (wachsende Feuerkraft).
    const oc = computeOutsideMapForCannons(g, B);
    const openCannons = (cannons.current[B] || []).filter((cn) => cn.hp > 0 && !isObjectClosed(oc, cn));
    for (const cn of openCannons) {
      if (botRebuildRing(g, ter, B, cn, 2, 2, 2)) return;
      if (botFillNear(g, ter, B, oc, cn, 2)) return;
    }
  }
  // Der Bot entscheidet EINMAL JE RUNDE, welche Kanonenart feuert — so wie ein
  // Mensch es tut. Ein Wechsel je Salve waere weder realistisch noch spielbar:
  // er zahlte dann permanent die Umruestzeit und kaeme kaum noch zum Schuss
  // (gemessen: 4 statt ~40 Schuss je Partie).
  const botModusRunde = useRef({ 1: -1, 2: -1, 3: -1 });
  function botWaehleModus(B, art) {
    if (botModusRunde.current[B] === roundRefVal.current) return;   // schon entschieden
    botModusRunde.current[B] = roundRefVal.current;
    if ((salvenModus.current[B] || "std") === art) return;
    salvenModus.current[B] = art;
    salvoSwitchAt.current[B] = performance.now();   // zahlt dieselbe Umruestzeit
  }
  function botShoot(g, B) {
    // Tutorial: der Bot schießt EIN Loch in die noch geschlossene Spielerburg (authentisch);
    // sobald sie offen ist, bleibt er passiv → der Spieler muss die Lücke selbst schließen.
    if (tutorialMode.current && (!castles.current[1] || !isCastleClosed(g, 1, castles.current[1]))) return;
    // Feuer-Drossel je Stufe (v3.20.0): Leicht wartet 1.8× Nachladezeit
    if (performance.now() - lastShot.current[B] < reloadMsOf(B) * botLvl().fire) return;
    const E = B === 1 ? 2 : 1;
    const enemy = castles.current[E];
    if (!enemy) return;
    const wall = WALL_OF[E];
    // Regelverständnis: Um die gegnerische Burg zu ÖFFNEN, müssen die sie umschließenden
    // Mauern fallen. Sammle burgnahe gegnerische Mauerzellen (innerste = am wirksamsten).
    const walls = [];
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      if (g[r][c] !== wall) continue;
      const d = Math.max(Math.abs(r - enemy.r), Math.abs(c - enemy.c));
      if (d > 7) continue;
      walls.push({ r, c, d });
    }
    // ── Zielstrategie (Experiment v3.51.0) ───────────────────────────────
    // Der Bot beschoss bisher IMMER zuerst die Mauern. Echte Spieler gehen von
    // Anfang an auf die KANONEN — und das ist mechanisch stark: ein Kill gibt
    // 18 Schrott, nimmt dem Gegner Feuerkraft UND sprengt ein 3x3-Loch in
    // DESSEN eigene Mauern (impactAt, Kill-Explosion). Der Kanonenweg ist damit
    // womoeglich der eigentliche Oeffnungsweg, den die KI nie gegangen ist.
    //   aim: "cannon" → immer erst Kanonen, Mauern nur ohne Ziel
    //   aim: "mixed"  → wechselt salvenweise zwischen Kanone und Mauer
    // aimFocus (Standard an): Fokusfeuer auf die Kanone mit den WENIGSTEN HP,
    // so wie ein Mensch nachlegt statt die Schaeden zu verteilen.
    {
      const XA = balExp() || {};
      // Der Bot wechselt salvenweise zwischen den Arten — er nutzt also beide
      // Rohre, statt wie frueher nur auf Mauern zu schiessen (0,0 Kanonen-Kills
      // je Partie). Experiment-Flags aimP1/aimP2/aim koennen das ueberschreiben.
      const hatSlayer = (cannons.current[B] || []).some((c) => c.kt === "slayer" && c.hp > 0);
      const perP = XA["aimP" + B];
      const modus = perP || XA.aim || (hatSlayer ? "mixed" : "wall");
      // Seit v3.58.0 kostet jeder Wechsel Umruestzeit. Der Bot bleibt deshalb
      // DREI Salven bei einer Art, statt jede Salve zu wechseln — sonst zahlt
      // er permanent die Sperre und feuert kaum noch.
      // Bei gemischter Spielweise entscheidet die RUNDE, nicht die Salve.
      const wantCannon = modus === "cannon"
        || (modus === "mixed" && roundRefVal.current % 2 === 0);
      if (wantCannon && !tutorialMode.current) {
        const cann = (cannons.current[E] || []).filter((cn) => cn.hp > 0);
        if (cann.length) {
          let pick;
          if (XA.aimFocus === false) {
            pick = cann[botAimSeq.current % cann.length];
          } else {
            // wenigste HP zuerst; bei Gleichstand die der eigenen Stellung naechste
            const src = slingAnchor(B);
            pick = cann.slice().sort((x, y) => (x.hp - y.hp)
              || (Math.hypot(x.c*CELL - src.x, x.r*CELL - src.y)
                - Math.hypot(y.c*CELL - src.x, y.r*CELL - src.y)))[0];
          }
          botWaehleModus(B, "slayer");
          if ((salvenModus.current[B] || "std") !== "slayer") return;   // diese Runde Mauern
          botAimSeq.current++;
          lastAimWall.current[B] = false;   // Kanonenziel -> buendeln
          const jitC = botLvl().spread * 0.35;
          if (typeof window !== "undefined" && window.__mmDebug) {
            const ad = window.__aimDbg = window.__aimDbg || { cannon: 0, wall: 0 };
            ad.cannon++;
          }
          fireMortar(B,
            pick.c * CELL + CELL / 2 + (Math.random() - 0.5) * jitC * CELL,
            pick.r * CELL + CELL / 2 + (Math.random() - 0.5) * jitC * CELL);
          return;
        }
      }
      botWaehleModus(B, "std");
      if ((salvenModus.current[B] || "std") !== "std") return;   // diese Runde Kanonen
      lastAimWall.current[B] = true;    // Mauerziel -> faechern
      if (typeof window !== "undefined" && window.__mmDebug) {
        const ad = window.__aimDbg = window.__aimDbg || { cannon: 0, wall: 0 };
        ad.wall++;
      }
    }
    let tx, ty;
    if (walls.length) {
      walls.sort((a, b) => a.d - b.d);
      // Tutorial: die burgnächste Mauer (öffnet die Burg sicher).
      // Sonst: rotierend über die innersten Mauern → das Feuer WANDERT die Schutzmauer
      // entlang und trägt sie systematisch ab, statt immer dieselbe Stelle zu treffen.
      const pool = walls.slice(0, Math.min(12, walls.length));
      const pick = tutorialMode.current ? pool[0] : pool[botAimSeq.current % pool.length];
      if (!tutorialMode.current) botAimSeq.current++;
      tx = pick.c * CELL + CELL / 2; ty = pick.r * CELL + CELL / 2;
    } else {
      // Keine Schutzmauern mehr → gegnerische Kanonen ausschalten (Offensive brechen),
      // sonst vor die (unzerstörbare) Burg.
      const cann = (cannons.current[E] || []).filter((cn) => cn.hp > 0);
      if (cann.length) {
        const cn = cann[botAimSeq.current % cann.length]; botAimSeq.current++;
        tx = cn.c * CELL + CELL / 2; ty = cn.r * CELL + CELL / 2;
      } else {
        const src = slingAnchor(B);
        const dx = src.x - (enemy.c * CELL + CELL / 2), dy = src.y - (enemy.r * CELL + CELL / 2), L = Math.hypot(dx, dy) || 1;
        tx = enemy.c * CELL + CELL / 2 + dx / L * CELL * 2.5; ty = enemy.r * CELL + CELL / 2 + dy / L * CELL * 2.5;
      }
    }
    if (tutorialMode.current) {
      const ok = fireMortar(B, tx, ty); // exakt auf die Mauerzelle → garantiertes Loch
      if (ok) tutorialBotShot.current = true;
      return;
    }
    const jit = botLvl().spread * 0.35; // Streuung je Schwierigkeitsgrad (v3.20.0)
    fireMortar(B, tx + (Math.random() - 0.5) * jit * CELL, ty + (Math.random() - 0.5) * jit * CELL);
  }
  // ── Bot-Schwierigkeitsgrade (v3.20.0, SPEC 14.1) ──────────────────────
  // Drei Stufen über Streuung / Feuer-Drossel / Einkauf. Bauverhalten (Burg
  // schließen) bleibt auf allen Stufen gleich. Tutorial nutzt immer 'mid'.
  // KEINE Vorauswahl (v3.29.0): Die Stufe wird bei JEDEM Bot-Start aktiv im
  // Auswahlmenü angetippt (der Tipp startet das Spiel) — nichts ist vordefiniert
  // oder hervorgehoben, nichts wird gespeichert. "mid" hier ist nur ein inerter
  // Laufzeit-Fallback (z. B. Tutorial), keine UI-Vorauswahl.
  const botLevel = useRef("mid");
  function botLvl() { return BOT_LEVELS[tutorialMode.current ? "mid" : botLevel.current] || BOT_LEVELS.mid; }
  // Fuer die Salven-Wahl (Experiment v3.53.0): worauf hat dieser Spieler
  // zuletzt gezielt? Mauer -> faechern (breite Bresche), Kanone -> buendeln
  // (Fokusfeuer). So bekommt JEDE Route ihr eigenes Werkzeug.
  // ZWEI KANONENARTEN (Experiment v3.56.0, Playtest-Idee):
  // Standard = Mauerbrecher (Schaden NUR an Mauern),
  // Bezwinger = Kanonenjaeger (Schaden NUR an Kanonen).
  // In der Schussphase waehlt man je Salve, WELCHE Art feuert. Damit kostet
  // die Kanonenjagd zum ersten Mal etwas: den Mauerschaden derselben Runde.
  const cannonTypeQueue = useRef({ 1: [], 2: [], 3: [] });   // Typ der naechsten Platzierung
  const salvenModus = useRef({ 1: "std", 2: "std", 3: "std" }); // gewaehlte Art
  // Umruest-Sperre (v3.58.0): Nach einem Wechsel muessen die Rohre neu
  // ausgerichtet werden — solange feuert NIEMAND. Ohne diese Kosten waere der
  // Schalter gratis und man wuerde einfach beides in derselben Runde machen;
  // genau das soll die Wahl ja verhindern.
  const salvoSwitchAt = useRef({ 1: -99999, 2: -99999, 3: -99999 });
  const lastAimWall = useRef({ 1: false, 2: false, 3: false });
  const botAimSeq = useRef(0); // rotiert die Zielmauer, damit das Feuer nicht auf einer Stelle klebt
  function botActFor(B) {
    if (eliminated.current[B]) return;
    const g = grid.current, ter = terrain.current;
    if (!g || !ter) return;
    const ph = phase_r.current;
    // Setup + Kanonenphase: Kanonen setzen. Auch im Tutorial — so ist das Budget beider
    // Spieler schnell 0 und die Phase springt vorzeitig weiter (Tutorial läuft flotter).
    if (ph === "setup" || ph === "cannon") {
      // Bot-Einkauf (v3.16.0, Stufen seit v3.20.0): Kaufstrategie je Schwierigkeit
      if (ph === "cannon" && !tutorialMode.current) {
        const lvl = botLvl();
        const up = upgrades.current[B] || {};
        const have = scrap.current[B] || 0;
        const cPrice = cannonPriceOf(B); // v3.30.0: Basispreis bei 0 Kanonen
        const canCannon = cannonBudget.current[B] <= 0 && have >= cPrice && (cannons.current[B] || []).length < lvl.maxCannons;
        // Sparziel: liegt ein Sperrfeuer in Reichweite, wird dafuer gespart
        // statt jede Runde Kleinkram zu kaufen.
        const XSp = balExp() || {};
        if (XSp.sperr) {
          const pr = XSp.sperrPreis || 120;
          if (have >= pr) { buyUpgrade(B, "sperr"); return; }
          if (have >= pr * (XSp.sparAb || 0.55)) return;   // zurueckhalten
        }
        // Durchschlag ist fuer den Bot eine echte Alternative zur naechsten
        // Kanone: teurer, aber wirkt auf ALLE Kanonen gleichzeitig.
        {
          // Der Bot haelt ein Verhaeltnis: etwa jede dritte Kanone ein
          // Bezwinger. Ohne Bezwinger kann er keine Kanone toeten, mit zu
          // vielen macht er keinen Mauerschaden mehr.
          const alle = cannons.current[B] || [];
          const slay = alle.filter((c) => c.kt === "slayer").length;
          const anteil = 0.4;
          const preisS = SHOP_SLAYER;
          const willBezwinger = alle.length >= 2
            && slay < Math.max(1, Math.round(alle.length * anteil))
            && cannonBudget.current[B] <= 0 && alle.length < lvl.maxCannons;
          if (willBezwinger) {
            if (have >= preisS) {
              // NUR abbrechen, wenn der Kauf auch geklappt hat — sonst blockiert
              // ein gescheiterter Kauf den ganzen Einkauf und der Bot bleibt bei
              // zwei Kanonen stehen (gemessen: 7 Runden ohne jeden Zubau).
              if (buyUpgrade(B, "slayer")) return;
            } else if (have >= preisS * 0.5) {
              // SPAREN (v3.73.0): Der Bezwinger kostet jetzt mehr, als in einer
              // Runde zusammenkommt. Ohne Zurueckhalten verteilt der Bot seine
              // Beute jede Runde auf Kleinkram und erreicht den Preis NIE —
              // gemessen 0 Kaeufe in 20 Partien. Ab der Haelfte wird gespart,
              // gleiches Muster wie beim Sperrfeuer-Sparziel oben.
              return;
            }
          }
        }
        const XPw = balExp() || {};
        if (XPw.wuchtKauf) {
          const preise = XPw.powerPreise || [30, 60, 100];
          const st = up.power || 0;
          const pw = st < preise.length ? preise[st] : null;
          // Schwer kauft frueh Durchschlag, Mittel erst ab 2 Kanonen,
          // Leicht gar nicht — so entstehen unterschiedliche Spielweisen.
          const willPower = lvl.buy === "optimal" ? st < 2
            : lvl.buy === "standard" ? (st < 1 && (cannons.current[B] || []).length >= 2)
            : false;
          if (pw && willPower && have >= pw) { buyUpgrade(B, "power"); return; }
        }
        if (lvl.buy === "basic") {
          // Leicht: nur gelegentlich eine Kanone, keine Upgrades
          if (canCannon && Math.random() < 0.5) buyUpgrade(B, "cannon");
        } else if (lvl.buy === "optimal") {
          // Schwer: Panzerung zuerst (stärkster Erstkauf), dann Schnellladen,
          // dann Kanonen; Reparatur wenn Trümmer nahe der Burg liegen.
          if (!up.armor && have >= SHOP.armor.price) buyUpgrade(B, "armor");
          else if ((up.reload || 0) < 2 && have >= SHOP.reload.prices[up.reload || 0]) buyUpgrade(B, "reload");
          else if (canCannon) buyUpgrade(B, "cannon");
          else if (have >= SHOP.repair.base + SHOP.repair.step * (up.repair || 0) + 20 && botRubbleNearCastle(B)) buyUpgrade(B, "repair");
        } else {
          // Mittel: bisherige Logik unverändert
          if (canCannon) buyUpgrade(B, "cannon");
          else if ((up.reload || 0) < 2 && have >= SHOP.reload.prices[up.reload || 0]) buyUpgrade(B, "reload");
          else if (!up.armor && have >= SHOP.armor.price) buyUpgrade(B, "armor");
        }
      }
      let guard = 0;
      while (cannonBudget.current[B] > 0 && guard++ < 4) {
        if (!botPlaceOneCannon(g, B)) break;
      }
      // Bot bestätigt „Fertig", sobald er nichts mehr kaufen/platzieren kann
      // (v3.18.1) → mit-auslösend fürs Vorspulen auf 3s.
      if (ph === "cannon" && cannonBudget.current[B] <= 0 && !armoryReady.current[B]) {
        // Tutorial (v3.37.4): der passive Bot kauft nichts — sofort „Fertig",
        // damit der Spieler nicht die volle Rüstphase absitzen muss (Timer
        // springt auf 3s, sobald auch der Spieler bestätigt).
        if (tutorialMode.current) { setArmoryReady(B); return; }
        const lvl = botLvl();
        const up = upgrades.current[B] || {};
        const have = scrap.current[B] || 0;
        const cPrice = cannonPriceOf(B); // v3.30.0: Basispreis bei 0 Kanonen
        // „Will noch etwas kaufen?“ muss zur Kaufstrategie der Stufe passen
        // (v3.20.0), sonst bestätigt z. B. der Leicht-Bot nie „Fertig“.
        const wantsMore = lvl.buy === "basic"
          ? false
          : (have >= cPrice && (cannons.current[B] || []).length < lvl.maxCannons) || ((up.reload || 0) < 2 && have >= SHOP.reload.prices[up.reload || 0]) || (!up.armor && have >= SHOP.armor.price);
        if (!wantsMore) setArmoryReady(B);
      }
    } else if (ph === "build") {
      botBuild(g, ter, B);
    } else if (ph === "shoot") {
      botShoot(g, B);
    }
  }
  function botTick() {
    if (tutPausedRef.current) return; // Tutorial-Popup offen → Bot pausiert (v3.37.2)
    if (!botMode.current || online.current || bannerActive.current) return;
    botActFor(2);
    // Gated Selbstspiel (Diagnose): beide Seiten von der KI steuern lassen
    if (typeof window !== "undefined" && window.__botSelfPlay) botActFor(1);
  }
  useEffect(() => {
    if (screen !== "game" || !botMode.current || online.current) return;
    const id = setInterval(botTick, 600);
    return () => clearInterval(id);
  }, [screen]);
  const canvasRect = useRef(null);
  const canvasRectAt = useRef(0);
  function refreshRect() {
    const canvas = canvasRef.current;
    if (canvas) canvasRect.current = canvas.getBoundingClientRect();
  }
  const toCanvas = useCallback((e) => {
    let rect = canvasRect.current;
    if (!rect) {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      rect = canvas.getBoundingClientRect();
      canvasRect.current = rect;
    }
    const rawY = (e.clientY - rect.top) / rect.height * H;
    const p1Flipped = (online.current && myRole.current === 1 || botMode.current) && numPlayersRef.current === 2;
    return {
      x: (e.clientX - rect.left) / rect.width * W,
      y: p1Flipped ? H - rawY : rawY
    };
  }, []);
  const LIFT_ROWS = 6;
  function liftedGhost(player, x, y) {
    const fl = (online.current && myRole.current === 1 || botMode.current) && numPlayersRef.current === 2;
    let gr = Math.floor(y / CELL) + (fl ? LIFT_ROWS : -LIFT_ROWS);
    let gc = Math.floor(x / CELL);
    // Formabhängig klemmen (v3.40.4): placePiece setzt den Anker (gr,gc) per
    // offR=gr-floor(maxR/2) / offC=gc-floor(maxC/2) in Zellen um. Der frühere
    // feste Clamp [1,ROWS-2]/[1,COLS-2] (v3.16.2) hielt nur den ANKER im Feld,
    // nicht die versetzten Teil-Zellen — je nach Teil-Breite/Höhe fehlte 1 Zelle
    // Reichweite nach rechts/links/unten, dort schlug die Platzierung still fehl
    // (Tester-Report). Jetzt so klemmen, dass GENAU alle Zellen des Teils ins
    // Grid [0..ROWS-1]×[0..COLS-1] passen — nicht mehr, nicht weniger.
    const cells = (pieces.current[player] && pieces.current[player].cells) || [[0, 0]];
    const maxR = Math.max(...cells.map(([r]) => r));
    const maxC = Math.max(...cells.map(([, c]) => c));
    const loR = Math.floor(maxR / 2), hiR = maxR - loR; // = ceil(maxR/2)
    const loC = Math.floor(maxC / 2), hiC = maxC - loC;
    gr = Math.max(loR, Math.min(ROWS - 1 - hiR, gr));
    gc = Math.max(loC, Math.min(COLS - 1 - hiC, gc));
    return { gr, gc };
  }
  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    if (bannerActive.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvasRect.current = canvas.getBoundingClientRect();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (e2) {
    }
    const { x, y } = toCanvas(e);
    let player;
    if (online.current) {
      player = myRole.current;
    } else if (numPlayersRef.current === 3) {
      player = sectorOf(Math.floor(y / CELL), Math.floor(x / CELL));
    } else if (botMode.current) {
      player = 1; // gegen Bot steuert der Mensch immer P1
    } else {
      player = y < ROWS_HALF * CELL ? 1 : 2;
    }
    pointers.current.set(e.pointerId, { player, x, y, startX: x, startY: y, startCX: e.clientX, startCY: e.clientY, t: performance.now() });
    if (phase_r.current === "build" || phase_r.current === "cannon" || phase_r.current === "setup") {
      const heldId = activeBuild.current[player];
      if (heldId !== null && !pointers.current.has(heldId)) {
        activeBuild.current[player] = null;
      }
      if (activeBuild.current[player] !== null) {
        pointers.current.delete(e.pointerId);
        return;
      }
      activeBuild.current[player] = e.pointerId;
      cancelHover.current[player] = false;
      const { gr, gc } = liftedGhost(player, x, y);
      pieces.current[player].ghostR = gr;
      pieces.current[player].ghostC = gc;
    } else if (phase_r.current === "shoot") {
      if (activeDrag.current[player] === null) {
        activeDrag.current[player] = e.pointerId;
        const a = slingAnchor(player);
        const dx = a.x - x, dy = a.y - y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
          cannonAngle.current[player] = Math.atan2(dy, dx);
      }
    }
  }, [toCanvas]);
  const onPointerMove = useCallback((e) => {
    e.preventDefault();
    if (bannerActive.current) return;
    const pt = pointers.current.get(e.pointerId);
    if (!pt) return;
    // Rect-Drift-Schutz (v3.16.2): mobile Browserleisten kollabieren WÄHREND
    // des Drags → Canvas verschiebt sich → Ghost hängt versetzt zum Finger.
    // Sanft gedrosselt neu messen (alle 400ms, nicht pro Move).
    const nowRe = performance.now();
    if (nowRe - (canvasRectAt.current || 0) > 400) {
      const cv = canvasRef.current;
      if (cv) canvasRect.current = cv.getBoundingClientRect();
      canvasRectAt.current = nowRe;
    }
    const { x, y } = toCanvas(e);
    pt.x = x;
    pt.y = y;
    const player = pt.player;
    if (phase_r.current === "build" || phase_r.current === "cannon" || phase_r.current === "setup") {
      if (activeBuild.current[player] !== e.pointerId) return;
      // Reset-Zone (v3.16.6 / v3.18.2): Finger TIEF unterhalb des Spielfelds
      // (klar in der Leiste) → Loslassen bricht ab. WICHTIG: Die untersten
      // Bau-Reihen erreicht man, indem der Finger knapp unter den Feldrand geht
      // (der Ghost ist um LIFT_ROWS nach oben versetzt) — daher erst ab
      // (LIFT_ROWS+2) Zellen unter dem Rand als Reset werten, sonst konnte man
      // ganz unten nicht mehr platzieren.
      const rc = canvasRect.current;
      cancelHover.current[player] = !!(rc && e.clientY > rc.bottom + (LIFT_ROWS + 2) * (rc.height / ROWS));
      const { gr, gc } = liftedGhost(player, x, y);
      pieces.current[player].ghostR = gr;
      pieces.current[player].ghostC = gc;
    } else if (phase_r.current === "shoot") {
      if (activeDrag.current[player] === e.pointerId) {
        const a = slingAnchor(player);
        const dx = a.x - x, dy = a.y - y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
          cannonAngle.current[player] = Math.atan2(dy, dx);
      }
    }
  }, [toCanvas]);
  function slingAnchor(player) {
    // v3.32.0: fester Standard-Anker = EIGENE BURG. Vorher: Schwerpunkt der
    // schussbereiten Kanonen — der sprang je nach Kanonenlage (z. B. nur die
    // ganz rechte bereit → Anker außen am Rand, Zielen extrem unhandlich).
    const ct = castles.current[player];
    if (ct) return { x: ct.c * CELL + CELL / 2, y: ct.r * CELL + CELL / 2 };
    const list = cannons.current[player] || [];
    if (!list.length) return { x: W / 2, y: H / 2 };
    let sx = 0, sy = 0;
    for (const cn of list) {
      sx += cn.c * CELL + CELL / 2;
      sy += cn.r * CELL + CELL / 2;
    }
    return { x: sx / list.length, y: sy / list.length };
  }
  const SLING_K = 3.2;
  function slingTarget(player, fx, fy) {
    const a = slingAnchor(player);
    const dx = a.x - fx, dy = a.y - fy;
    const dist = Math.hypot(dx, dy);
    if (dist < CELL * 0.9) return null;
    const tx = Math.max(CELL / 2, Math.min(W - CELL / 2, a.x + dx * SLING_K));
    const ty = Math.max(CELL / 2, Math.min(H - CELL / 2, a.y + dy * SLING_K));
    return { tx, ty };
  }
  const onPointerUp = useCallback((e) => {
    e.preventDefault();
    const pt = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (bannerActive.current || !pt) return;
    const player = pt.player;
    const guest = online.current && myRole.current !== 1;
    if (phase_r.current === "build") {
      if (activeBuild.current[player] !== e.pointerId) return;
      activeBuild.current[player] = null;
      // Reset-Geste (v3.16.6 / v3.18.2): tief unter dem Feldrand losgelassen →
      // abbrechen. Schwelle wie in onPointerMove, damit die untersten Bau-Reihen
      // (Finger knapp unter dem Rand) weiter platzierbar bleiben.
      const rcU = canvasRect.current;
      if (rcU && e.clientY > rcU.bottom + (LIFT_ROWS + 2) * (rcU.height / ROWS)) {
        pieces.current[player].ghostR = null;
        pieces.current[player].ghostC = null;
        cancelHover.current[player] = false;
        setUiTick((t) => t + 1);
        return;
      }
      const moved = Math.hypot(e.clientX - pt.startCX, e.clientY - pt.startCY);
      if (moved < 14 && performance.now() - pt.t < 450) {
        pieces.current[player].ghostR = null;
        pieces.current[player].ghostC = null;
        rotatePiece(player);
        return;
      }
      const gr = pieces.current[player].ghostR;
      const gc = pieces.current[player].ghostC;
      if (gr !== null && gc !== null) {
        if (guest) {
          placePiece(player, gr, gc);
          sendAction({ type: "place", r: gr, c: gc });
        } else {
          placePiece(player, gr, gc);
          if (online.current) pushState(true);
        }
      }
      pieces.current[player].ghostR = null;
      pieces.current[player].ghostC = null;
    } else if (phase_r.current === "cannon" || phase_r.current === "setup") {
      if (activeBuild.current[player] !== e.pointerId) return;
      activeBuild.current[player] = null;
      // Reset-Geste (v3.16.6 / v3.18.2): tief unter dem Feldrand → abbrechen.
      const rcC = canvasRect.current;
      if (rcC && e.clientY > rcC.bottom + (LIFT_ROWS + 2) * (rcC.height / ROWS)) {
        pieces.current[player].ghostR = null;
        pieces.current[player].ghostC = null;
        cancelHover.current[player] = false;
        setUiTick((t) => t + 1);
        return;
      }
      const gr = pieces.current[player].ghostR;
      const gc = pieces.current[player].ghostC;
      if (gr !== null && gc !== null) {
        if (guest) {
          placeCannon(player, gr, gc);
          sendAction({ type: "cannon", r: gr, c: gc });
        } else {
          placeCannon(player, gr, gc);
          if (online.current) pushState(true);
        }
      }
      pieces.current[player].ghostR = null;
      pieces.current[player].ghostC = null;
    } else if (phase_r.current === "shoot") {
      if (activeDrag.current[player] === e.pointerId) {
        activeDrag.current[player] = null;
        const tgt = slingTarget(player, pt.x, pt.y);
        if (tgt) {
          if (guest) {
            const frozenIds = frozenReady.current[player] || [];
            const readyCannons = cannons.current[player].filter(c => frozenIds.includes(c.id) && c.hp > 0);
            if (readyCannons.length === 0) { showWarn(t('warnNoCannonReady')); }
            else { SFX.shoot(); sendAction({ type: "fire", tx: tgt.tx, ty: tgt.ty }); }
          } else {
            fireMortar(player, tgt.tx, tgt.ty);
            if (online.current) pushState(true);
          }
        }
      }
    }
  }, []);
  const onPointerCancel = useCallback((e) => {
    const pt = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (pt) {
      if (activeDrag.current[pt.player] === e.pointerId) activeDrag.current[pt.player] = null;
      if (activeBuild.current[pt.player] === e.pointerId) {
        activeBuild.current[pt.player] = null;
        pieces.current[pt.player].ghostR = null;
        pieces.current[pt.player].ghostC = null;
      }
    }
  }, []);
  const renderLoop = useCallback(() => {
    var _a2;
    if (typeof window !== "undefined" && window.__perfDbg) window.__frameT0 = performance.now();
    // Bildabstand messen, wenn die Anzeige eingeschaltet ist (v3.82.0).
    // KEIN React-Zustand hier: eine Zustandsaenderung pro Bild waere genau die
    // Art Last, die man messen will, und verfaelschte die Messung.
    if (perfAn.current) {
      const jetzt = performance.now();
      if (perfLetzt.current) {
        const abstand = jetzt - perfLetzt.current;
        const puffer = perfPuffer.current;
        puffer.push(abstand);
        if (puffer.length > 180) puffer.shift();
      }
      perfLetzt.current = jetzt;
    }
    const canvas = canvasRef.current;
    if (!canvas || !running.current) return;
    const ctx = canvas.getContext("2d");
    const g = grid.current;
    if (!g) {
      animId.current = requestAnimationFrame(renderLoop);
      return;
    }
    const now = performance.now();
    // Zeitbasierte Bewegung (v3.19.3): Kugel-Fortschritt an die reale Frame-Zeit
    // koppeln statt an die Framerate. Sonst werden Kugeln bei FPS-Einbrüchen
    // (viele Kanonen/Risse/Schrott-Popups) sichtbar langsamer. 1 = 60fps-Norm,
    // gedeckelt auf 3, damit ein Stall die Kugel nicht überschießt.
    const frameScale = lastFrameTime.current ? Math.min(3, (now - lastFrameTime.current) / (1e3 / 60)) : 1;
    lastFrameTime.current = now;
    const players = playersList();
    const isGuest = online.current && myRole.current !== 1;
    if (isGuest && reloadProgRef.current) {
      const rp = reloadProgRef.current;
      for (const p of players)
        reload.current[p] = Math.min(1, ((_a2 = rp[p]) != null ? _a2 : 1) + (now - (rp.at || now)) / reloadMsOf(p));
    } else {
      for (const p of players)
        reload.current[p] = Math.min(1, (now - lastShot.current[p]) / reloadMsOf(p));
    }
    if (phase_r.current === "shoot" && !tutPausedRef.current) {
      if (!isGuest) {
        for (const ball of balls.current) {
          if (!ball.alive) continue;
          ball.prog += frameScale / ball.dur;
          if (ball.prog >= 1) {
            ball.alive = false;
            impactAt(ball);
          }
        }
        balls.current = balls.current.filter((b) => b.alive);
        // Nachlauf (v3.18.0): Timer abgelaufen + alle Kugeln eingeschlagen →
        // jetzt erst in die Rüstphase wechseln.
        if (shootSettling.current && balls.current.length === 0) {
          shootSettling.current = false;
          if (shootSettleTimeout.current) { clearTimeout(shootSettleTimeout.current); shootSettleTimeout.current = null; }
          endShoot();
        }
      } else {
        for (const ball of balls.current) {
          if (!ball.alive) continue;
          ball.prog += frameScale / ball.dur;
          if (ball.prog >= 1) ball.alive = false;
        }
        balls.current = balls.current.filter((b) => b.alive);
      }
    }
    for (const p of particles.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy = p.vy * 0.92 + (p.gravity || 0.08);
      p.life--;
    }
    particles.current = particles.current.filter((p) => p.life > 0);
    ctx.clearRect(0, 0, W, H);
    const didShake = shakeRef.current > 0.3;
    if (didShake) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
      shakeRef.current *= 0.72;
    }
    const p1Flipped = (online.current && myRole.current === 1 || botMode.current) && numPlayersRef.current === 2;
    let p1FlipPatch = null;
    if (p1Flipped) {
      ctx.save();
      ctx.translate(0, H);
      ctx.scale(1, -1);
      const _origFT = CanvasRenderingContext2D.prototype.fillText;
      p1FlipPatch = function(text, x, y, maxW) {
        this.save();
        this.translate(x, y);
        this.scale(1, -1);
        _origFT.call(this, text, 0, 0, maxW);
        this.restore();
      };
      ctx.fillText = p1FlipPatch;
    }
    function p1CounterFlip(cx, cy) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, -1); ctx.translate(-cx, -cy);
      ctx.fillText = CanvasRenderingContext2D.prototype.fillText;
    }
    function p1CounterFlipEnd() {
      ctx.restore();
      ctx.fillText = p1FlipPatch;
    }
    try {
    const terObj = terrain.current;
    const ter = terObj ? terObj.grid : null;
    if (!bgCanvas.current) {
      bgCanvas.current = document.createElement("canvas");
      bgCanvas.current.width = W;
      bgCanvas.current.height = H;
      bgDirty.current = true;
    }
    if (bgDirty.current && ter) {
      bgDirty.current = false;
      const bc = bgCanvas.current.getContext("2d");
      // Welt-Thema deterministisch aus dem Seed — identisch auf allen Clients.
      const WT = worldThemeOf((terObj && terObj.seed) || terrainSeed.current || 0);
      // ⚠ KEIN Vor-Flip des Hintergrunds mehr (v3.30.2, Bug-Fix): Der frühere
      // bc-Flip + Haupt-Canvas-Flip = Doppel-Flip → das TERRAIN erschien
      // aufrecht, während Mauern/Kanonen gespiegelt rendern. Folge: Der Fluss
      // wurde an der GESPIEGELTEN Position gezeichnet — Spieler konnten
      // scheinbar „im Fluss" bauen (logisch war dort Land) und der echte Fluss
      // lag unsichtbar woanders. Der Hintergrund durchläuft jetzt denselben
      // Haupt-Flip wie alle Spielobjekte → Optik == Logik. Nur der
      // Welt-Namenszug bekommt unten einen eigenen Gegen-Flip (lesbar).
      // — Tiefer atmosphärischer Untergrund (Thema) —
      const mg2 = bc.createLinearGradient(0, 0, 0, H);
      mg2.addColorStop(0, WT.bg[0]);
      mg2.addColorStop(0.5, WT.bg[1]);
      mg2.addColorStop(1, WT.bg[2]);
      bc.fillStyle = mg2;
      bc.fillRect(0, 0, W, H);
      // sanftes Lichtfeld von oben
      const topGlow = bc.createRadialGradient(W / 2, -H * 0.08, 0, W / 2, -H * 0.08, H * 0.6);
      topGlow.addColorStop(0, WT.glow);
      topGlow.addColorStop(1, "rgba(0,0,0,0)");
      bc.fillStyle = topGlow;
      bc.fillRect(0, 0, W, H * 0.6);
      // Deterministischer Deko-RNG (eigener Strom, unabhängig vom Terrain-RNG)
      const drng = makeRng(((terObj && terObj.seed) >>> 0) ^ 2654435769);
      // — Große weiche Farbinseln (hand-painted Look statt harter Kacheln) —
      for (let i = 0; i < 12; i++) {
        const bx = drng() * W, by = drng() * H, br = 60 + drng() * 130;
        const blob = bc.createRadialGradient(bx, by, 0, bx, by, br);
        blob.addColorStop(0, i % 2 ? WT.tex1 : WT.tex2);
        blob.addColorStop(1, "rgba(0,0,0,0)");
        bc.fillStyle = blob;
        bc.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      // Organische Bodenflecken — weiche Radial-Verläufe (Farbe → transparent),
      // hash-gestreut mit Jitter: gemalte Bodentextur statt harter Kreise.
      for (let r = 0; r < ROWS; r += 3)
        for (let c = 0; c < COLS; c += 3) {
          const t = ter[r][c];
          if (t !== 1 && t !== 2) continue;
          const h = Math.abs(Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
          if (h > 0.55) continue;
          const jx = (h * 13) % 1 * CELL * 3 - CELL * 1.5, jy = (h * 51) % 1 * CELL * 3 - CELL * 1.5;
          const px = c * CELL + CELL + jx, py = r * CELL + CELL + jy;
          const pr2 = CELL * (2.2 + h * 3);
          const soft = bc.createRadialGradient(px, py, 0, px, py, pr2);
          soft.addColorStop(0, t === 1 ? WT.tex1 : WT.tex2);
          soft.addColorStop(1, "rgba(0,0,0,0)");
          bc.fillStyle = soft;
          bc.fillRect(px - pr2, py - pr2, pr2 * 2, pr2 * 2);
        }
      // feines Punktraster
      bc.fillStyle = WT.dots;
      for (let r = 0; r < ROWS; r += 3)
        for (let c = ((r / 3) % 2 ? 3 : 0); c < COLS; c += 6) {
          bc.beginPath();
          bc.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 1, 0, Math.PI * 2);
          bc.fill();
        }
      // ── MITTLERE Detailfrequenz (v3.41.0, AAA-Stufe 2) ──────────────────────
      // Bisher gab es nur sehr grobe Farbinseln und ein sehr feines Punktraster
      // — dazwischen NICHTS. Genau diese Lücke ließ das Feld leer wirken.
      // Alles hier wird EINMAL gebacken → im Frame-Loop null Kosten.
      // Deko meidet die Burgumgebung, damit der Bauplatz lesbar bleibt.
      const nearCastle = (px2, py2) => {
        for (const p of [1, 2, 3]) {
          const ct2 = castles.current[p];
          if (!ct2) continue;
          if (Math.abs(px2 - (ct2.c * CELL)) < CELL * 9 && Math.abs(py2 - (ct2.r * CELL)) < CELL * 7) return true;
        }
        return false;
      };
      // (a) Sedimentfelder — organische Senken mit Licht von oben links
      for (let i = 0; i < 22; i++) {
        const px2 = drng() * W, py2 = drng() * H, rad = CELL * (2.4 + drng() * 4.2);
        if (nearCastle(px2, py2)) continue;
        const n = 9 + Math.floor(drng() * 4);
        const pts2 = [];
        for (let v = 0; v <= n; v++) {
          const ang2 = v / n * Math.PI * 2, rr3 = rad * (0.78 + drng() * 0.42);
          pts2.push([px2 + Math.cos(ang2) * rr3, py2 + Math.sin(ang2) * rr3 * 0.55]);
        }
        bc.beginPath();
        bc.moveTo(pts2[0][0], pts2[0][1]);
        for (let v = 1; v < pts2.length; v++) bc.lineTo(pts2[v][0], pts2[v][1]);
        bc.closePath();
        // Nur Füllung, KEINE umlaufende Kontur: eine durchgehende Outline ließ
        // die Felder wie Low-Poly-Flächen wirken statt wie weicher Boden.
        bc.fillStyle = "rgba(0,0,0,0.14)";
        bc.fill();
        // Lichtkante nur an der OBERSEITE (Licht von oben links) → wirkt als Senke
        bc.save();
        bc.clip();
        bc.strokeStyle = WT.tex1;
        bc.lineWidth = 2.6;
        bc.beginPath();
        bc.moveTo(px2 - rad, py2 - rad * 0.3);
        bc.lineTo(px2 + rad, py2 - rad * 0.3);
        bc.stroke();
        bc.restore();
      }
      // (b) Bodenrisse — verzweigt, mit heller Lichtkante an der Oberseite
      for (let i = 0; i < 16; i++) {
        let cx5 = drng() * W, cy5 = drng() * H, ang3 = drng() * Math.PI * 2;
        if (nearCastle(cx5, cy5)) continue;
        bc.beginPath();
        bc.moveTo(cx5, cy5);
        for (let seg = 0; seg < 5; seg++) {
          ang3 += (drng() - 0.5) * 1.1;
          const len = CELL * (1.2 + drng() * 2.6);
          cx5 += Math.cos(ang3) * len; cy5 += Math.sin(ang3) * len;
          bc.lineTo(cx5, cy5);
        }
        bc.strokeStyle = "rgba(0,0,0,0.42)";
        bc.lineWidth = 1.1 + drng() * 1.5;
        bc.lineCap = "round";
        bc.stroke();
        bc.strokeStyle = WT.mtnEdge;
        bc.lineWidth = 0.7;
        bc.stroke();
      }
      // (c) Geröll — Streusteine MIT Bodenschatten (Licht von oben links).
      // Das ist der eigentliche Dichte-Gewinn: kleine Objekte, die Volumen haben.
      for (let i = 0; i < 34; i++) {
        const px2 = drng() * W, py2 = drng() * H, s2 = CELL * (0.30 + drng() * 0.5);
        if (nearCastle(px2, py2)) continue;
        bc.fillStyle = "rgba(0,0,0,0.34)";
        bc.beginPath();
        bc.ellipse(px2 + s2 * 0.45, py2 + s2 * 0.5, s2 * 1.05, s2 * 0.5, 0, 0, Math.PI * 2);
        bc.fill();
        bc.fillStyle = WT.mtn[0];
        bc.beginPath();
        bc.moveTo(px2 - s2, py2 + s2 * 0.5);
        bc.lineTo(px2 - s2 * 0.5, py2 - s2 * 0.6);
        bc.lineTo(px2 + s2 * 0.35, py2 - s2 * 0.8);
        bc.lineTo(px2 + s2, py2 + s2 * 0.5);
        bc.closePath();
        bc.fill();
        bc.fillStyle = WT.mtn[1];
        bc.beginPath();
        bc.moveTo(px2 + s2 * 0.35, py2 - s2 * 0.8);
        bc.lineTo(px2 + s2, py2 + s2 * 0.5);
        bc.lineTo(px2 + s2 * 0.2, py2 + s2 * 0.5);
        bc.closePath();
        bc.fill();
      }
      // — Organischer Fluss (Metaball-Look: weiche runde Ufer statt Kacheln) —
      const waterCells = [];
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (ter[r][c] === 3) waterCells.push([r, c]);
      // ── Fluss als FLÜSSIGKEIT (v3.41.0, AAA-Stufe 2) ────────────────────────
      // Vorher: gleichfarbige Kreise → las sich als „orange Blöcke", also
      // dieselbe Formsprache wie die Mauern. Jetzt: TIEFENKARTE (BFS vom Ufer
      // nach innen) und Einfärbung nach Abstand zum Ufer — außen dunkle Kruste,
      // innen glühender Kern. Das erzeugt den Flüssigkeits-Look, OHNE die
      // Radien zu vergrößern.
      // ⚠ Radien-Regel (v3.30.1) bleibt unangetastet: max 0.68·CELL, sonst sieht
      // eine Mauer auf der Nachbarzelle aus, als stünde sie „im Wasser".
      // >0.5 bleibt Pflicht, damit benachbarte Kreise zum Band verschmelzen.
      const wIdx = (r, c) => r * COLS + c;
      const wDepth = new Int16Array(ROWS * COLS).fill(-1);
      let wQueue = [];
      for (const [r, c] of waterCells) {
        // Randzelle = hat mindestens einen Nicht-Wasser-Nachbarn (4er-Nachbarschaft)
        const edge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ||
          ter[r - 1][c] !== 3 || ter[r + 1][c] !== 3 || ter[r][c - 1] !== 3 || ter[r][c + 1] !== 3;
        if (edge) { wDepth[wIdx(r, c)] = 0; wQueue.push([r, c]); }
      }
      let wMax = 0;
      for (let qi = 0; qi < wQueue.length; qi++) {
        const [r, c] = wQueue[qi], d = wDepth[wIdx(r, c)];
        const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        for (const [nr, nc] of nb) {
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          if (ter[nr][nc] !== 3 || wDepth[wIdx(nr, nc)] !== -1) continue;
          wDepth[wIdx(nr, nc)] = d + 1;
          if (d + 1 > wMax) wMax = d + 1;
          wQueue.push([nr, nc]);
        }
      }
      // Farbverlauf Ufer → Kern. Kern-Ton aus waterEdge (hellster Themenwert).
      const hex2rgb = (h) => {
        const s = h.replace("#", "");
        return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
      };
      const mixHex = (a, b, t) => {
        const A = hex2rgb(a), B = hex2rgb(b);
        return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * t) + "," +
          Math.round(A[1] + (B[1] - A[1]) * t) + "," + Math.round(A[2] + (B[2] - A[2]) * t) + ")";
      };
      // Pass 1: Uferband / erkaltete Kruste (dunkelster Ton, größter Radius)
      bc.fillStyle = WT.bank;
      for (const [r, c] of waterCells) {
        bc.beginPath();
        bc.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.68, 0, Math.PI * 2);
        bc.fill();
      }
      // Pass 2: Körper mit Glow — Ton wandert mit der Tiefe von dunkel nach hell
      bc.save();
      bc.shadowColor = WT.waterGlow;
      bc.shadowBlur = 10;
      for (const [r, c] of waterCells) {
        // Untergrenze 0.30 (v3.43.0): Ufer-Zellen dürfen NICHT bis auf den
        // dunkelsten Ton abfallen, sonst liegen sie farblich zu nah am Land und
        // der Spieler hält den Fluss dort für bebaubar (Bug-Klasse v3.30.1).
        // Der Kruste→Kern-Verlauf bleibt erhalten, startet nur heller.
        const t2 = wMax > 0 ? wDepth[wIdx(r, c)] / wMax : 1;
        bc.fillStyle = mixHex(WT.water[1], WT.water[0], 0.30 + t2 * 0.62);
        bc.beginPath();
        bc.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.6, 0, Math.PI * 2);
        bc.fill();
      }
      bc.restore();
      // Pass 3: glühender Kern — nur die inneren Zellen, dadurch entsteht die
      // charakteristische helle Ader in der Flussmitte statt einer flachen Fläche
      for (const [r, c] of waterCells) {
        const d = wDepth[wIdx(r, c)];
        if (wMax > 0 && d < wMax * 0.34) continue;
        const t3 = wMax > 0 ? (d - wMax * 0.34) / Math.max(0.5, wMax * 0.66) : 1;
        bc.fillStyle = mixHex(WT.water[0], WT.waterEdge.startsWith("#") ? WT.waterEdge : WT.water[0], Math.min(1, t3) * 0.7);
        bc.beginPath();
        bc.arc(c * CELL + CELL / 2, r * CELL + CELL / 2 - 1, CELL * 0.5, 0, Math.PI * 2);
        bc.fill();
      }
      // Pass 4: erkaltete Krustenschollen an den Uferzellen — dunkle Flecken
      // statt Linien. Linien lasen sich als gleichförmige „Kratzer"; Schollen
      // wirken wie aufgebrochene Oberfläche.
      for (const [r, c] of waterCells) {
        if (wDepth[wIdx(r, c)] !== 0) continue;
        const h = Math.abs(Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
        if (h > 0.4) continue;
        const h2 = Math.abs(Math.sin(r * 45.164 + c * 21.71) * 43758.5453) % 1;
        const cx4 = c * CELL + CELL / 2 + (h - 0.5) * CELL * 0.35;
        const cy4 = r * CELL + CELL / 2 + (h2 - 0.5) * CELL * 0.35;
        bc.fillStyle = "rgba(0,0,0,0.26)";
        bc.beginPath();
        bc.ellipse(cx4, cy4, CELL * (0.16 + h * 0.16), CELL * (0.11 + h2 * 0.12), h * 3, 0, Math.PI * 2);
        bc.fill();
      }
      // Pass 5: Glanzlichter an der Oberkante (nur oberste Wasserzellen)
      bc.fillStyle = WT.waterEdge;
      for (const [r, c] of waterCells) {
        if (r === 0 || ter[r - 1][c] !== 3) {
          bc.beginPath();
          bc.ellipse(c * CELL + CELL / 2, r * CELL + 2.5, CELL * 0.42, 1.7, 0, 0, Math.PI * 2);
          bc.fill();
        }
      }
      // Kernzellen für die animierte Strömung merken (Pro-Frame-Layer, gedeckelt)
      const flowCells = [];
      for (const [r, c] of waterCells) {
        if (wMax > 0 && wDepth[wIdx(r, c)] >= wMax * 0.65) flowCells.push([r, c]);
      }
      riverFlow.current = { cells: flowCells.slice(0, 220), anim: WT.waterAnim || "255,255,255" };
      // — Plastische Berge: Bodenschatten + Licht-/Schattenfacette + Gipfel —
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (ter[r][c] !== 4) continue;
          const cx3 = c * CELL + CELL / 2, baseY3 = r * CELL + CELL, topY = r * CELL - 2;
          // weicher Bodenschatten
          bc.fillStyle = "rgba(0,0,0,0.30)";
          bc.beginPath();
          bc.ellipse(cx3 + 1.5, baseY3 - 0.5, CELL * 0.55, 2.6, 0, 0, Math.PI * 2);
          bc.fill();
          // dunkle (rechte) Facette
          bc.fillStyle = WT.mtn[1];
          bc.beginPath();
          bc.moveTo(cx3, topY);
          bc.lineTo(c * CELL + CELL, baseY3 - 1);
          bc.lineTo(cx3 - 1, baseY3 - 1);
          bc.closePath();
          bc.fill();
          // helle (linke) Facette — Lichteinfall von links oben
          bc.fillStyle = WT.mtn[0];
          bc.beginPath();
          bc.moveTo(cx3, topY);
          bc.lineTo(cx3 + 2, baseY3 - 1);
          bc.lineTo(c * CELL - 1, baseY3 - 1);
          bc.closePath();
          bc.fill();
          // Kantenlicht
          bc.strokeStyle = WT.mtnEdge;
          bc.lineWidth = 1;
          bc.beginPath();
          bc.moveTo(cx3, topY);
          bc.lineTo(c * CELL - 1, baseY3 - 1);
          bc.stroke();
          // Gipfelkappe
          bc.fillStyle = WT.mtnCap;
          bc.beginPath();
          bc.moveTo(cx3, topY);
          bc.lineTo(cx3 + 3.4, topY + 5.5);
          bc.lineTo(cx3 - 3.4, topY + 5.5);
          bc.closePath();
          bc.fill();
        }
      // — Thematische Deko-Props (seeded → auf allen Clients identisch) —
      // Bäume/Büsche, Kristalle oder Kakteen; klein & gedeckt, damit Mauern/
      // Kanonen klar im Vordergrund bleiben.
      const propAt = (px, py, sc) => {
        const [pMain, pDark, pAcc] = WT.props;
        // Bodenschatten für alle Typen
        bc.fillStyle = "rgba(0,0,0,0.28)";
        bc.beginPath();
        bc.ellipse(px + 1, py + 5.5 * sc, 5 * sc, 2 * sc, 0, 0, Math.PI * 2);
        bc.fill();
        if (WT.propType === "tree") {
          bc.fillStyle = pDark;
          bc.fillRect(px - 1 * sc, py + 2 * sc, 2 * sc, 4 * sc); // Stamm
          bc.beginPath(); bc.arc(px, py, 4.6 * sc, 0, Math.PI * 2); bc.fill(); // Krone dunkel
          bc.fillStyle = pMain;
          bc.beginPath(); bc.arc(px - 1 * sc, py - 1.2 * sc, 3.4 * sc, 0, Math.PI * 2); bc.fill(); // Licht
          bc.fillStyle = pAcc;
          bc.beginPath(); bc.arc(px - 2 * sc, py - 2.4 * sc, 1.2 * sc, 0, Math.PI * 2); bc.fill(); // Glanz
        } else if (WT.propType === "cactus") {
          bc.fillStyle = pDark;
          bc.fillRect(px - 1.6 * sc, py - 4 * sc, 3.2 * sc, 9 * sc); // Körper
          bc.fillRect(px - 5 * sc, py - 1 * sc, 3.4 * sc, 2.2 * sc); // Arm links
          bc.fillRect(px - 5 * sc, py - 3.5 * sc, 2.2 * sc, 3 * sc);
          bc.fillStyle = pMain;
          bc.fillRect(px - 1.6 * sc, py - 4 * sc, 1.6 * sc, 9 * sc); // Lichtseite
          bc.fillStyle = pAcc;
          bc.beginPath(); bc.arc(px, py - 4 * sc, 1 * sc, 0, Math.PI * 2); bc.fill(); // Blüte
        } else { // crystal
          bc.fillStyle = pDark;
          bc.beginPath();
          bc.moveTo(px, py - 6.5 * sc); bc.lineTo(px + 2.6 * sc, py + 4 * sc); bc.lineTo(px - 0.4 * sc, py + 4 * sc);
          bc.closePath(); bc.fill();
          bc.fillStyle = pMain;
          bc.beginPath();
          bc.moveTo(px, py - 6.5 * sc); bc.lineTo(px - 2.6 * sc, py + 4 * sc); bc.lineTo(px + 0.4 * sc, py + 4 * sc);
          bc.closePath(); bc.fill();
          bc.fillStyle = pDark;
          bc.beginPath();
          bc.moveTo(px + 3.4 * sc, py - 2.5 * sc); bc.lineTo(px + 5 * sc, py + 4 * sc); bc.lineTo(px + 2 * sc, py + 4 * sc);
          bc.closePath(); bc.fill();
          bc.fillStyle = pAcc;
          bc.globalAlpha = 0.9;
          bc.beginPath();
          bc.moveTo(px, py - 6.5 * sc); bc.lineTo(px - 1 * sc, py - 2 * sc); bc.lineTo(px + 0.6 * sc, py - 2.5 * sc);
          bc.closePath(); bc.fill();
          bc.globalAlpha = 1;
        }
      };
      let placed = 0;
      for (let tries = 0; tries < 160 && placed < 34; tries++) {
        const pr = 2 + Math.floor(drng() * (ROWS - 4));
        const pc = 2 + Math.floor(drng() * (COLS - 4));
        // nur auf freiem Boden, mit Abstand zu Wasser/Bergen
        let free = true;
        for (let q = -1; q <= 1 && free; q++)
          for (let w = -1; w <= 1; w++)
            if (ter[pr + q][pc + w] >= 3) { free = false; break; }
        if (!free) continue;
        propAt(pc * CELL + CELL / 2, pr * CELL + CELL / 2, 0.85 + drng() * 0.55);
        placed++;
      }
      // Ambient-Partikel (kühler Staub)
      for (let i = 0; i < 26; i++) {
        const fc3 = i * 313 % COLS, fr3 = i * 191 % ROWS;
        if (ter[fr3][fc3] >= 3) continue;
        const fx3 = fc3 * CELL + i * 71 % CELL, fy3 = fr3 * CELL + i * 37 % CELL;
        bc.fillStyle = WT.particles[i % 3];
        bc.beginPath();
        bc.arc(fx3, fy3, 1.1, 0, Math.PI * 2);
        bc.fill();
      }
      // cinematic vignette
      const vig = bc.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.62)");
      bc.fillStyle = vig;
      bc.fillRect(0, 0, W, H);
      // Welt-Namenszug, dezent unten links. Bei p1Flipped mit EIGENEM
      // Gegen-Flip zeichnen: der Haupt-Canvas spiegelt erneut → lesbar,
      // und er landet weiterhin unten links auf dem Bildschirm.
      bc.save();
      if (p1Flipped) { bc.translate(0, H); bc.scale(1, -1); }
      bc.font = "700 13px 'Segoe UI', system-ui, sans-serif";
      bc.textBaseline = "bottom";
      const wtLabel = WT.name.toUpperCase();
      const wtW = bc.measureText(wtLabel).width;
      // Pill-Badge mit Theme-Kante
      bc.fillStyle = "rgba(0,0,0,0.45)";
      bc.beginPath();
      if (bc.roundRect) bc.roundRect(6, H - 26, wtW + 20, 21, 10.5);
      else bc.rect(6, H - 26, wtW + 20, 21);
      bc.fill();
      bc.strokeStyle = WT.mtnEdge;
      bc.lineWidth = 1;
      bc.stroke();
      bc.fillStyle = WT.mtnCap;
      bc.globalAlpha = 0.75;
      bc.fillText(wtLabel, 16, H - 9);
      bc.restore();
      // ── Vignette (v3.41.0, AAA-Stufe 2) ─────────────────────────────────────
      // Randbereiche abdunkeln → das Auge wandert zur Spielmitte. Ohne das
      // konkurrieren Deko und Spielobjekte um dieselbe Aufmerksamkeit.
      // Kommt ZULETZT in den Bake, liegt also über der gesamten Deko.
      const vg2 = bc.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.72);
      vg2.addColorStop(0, "rgba(0,0,0,0)");
      vg2.addColorStop(1, "rgba(0,0,0,0.42)");
      bc.fillStyle = vg2;
      bc.fillRect(0, 0, W, H);
    }
    if (bgCanvas.current) ctx.drawImage(bgCanvas.current, 0, 0);
    const WTa = worldThemeOf((terObj && terObj.seed) || terrainSeed.current || 0);
    if (ter) {
      // Wasserzellen einmal pro Terrain cachen (v3.19.4): statt jeden Frame alle
      // 2992 Zellen zu scannen, nur die tatsächlichen Wasserzellen animieren.
      const wSeed = (terObj && terObj.seed) != null ? terObj.seed : (terrainSeed.current || 0);
      if (waterCellsRef.current.seed !== wSeed) {
        const wc = [];
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (ter[r][c] === 3) wc.push(r * COLS + c);
        waterCellsRef.current = { seed: wSeed, cells: wc };
      }
      // Fließ-Adern (v3.41.0, AAA-Stufe 2): helle Glanzpunkte wandern über die
      // KERNZELLEN des Flusses (aus dem bgCanvas-Bake). Dadurch wirkt das Band
      // wie strömende Flüssigkeit statt wie eine statische Fläche.
      // Kosten: max ~220 Zellen, davon pro Frame ein Bruchteil → vernachlässigbar.
      const rf = riverFlow.current;
      if (rf && rf.cells.length) {
        const wave = now / 900;
        for (let i = 0; i < rf.cells.length; i++) {
          const r = rf.cells[i][0], c = rf.cells[i][1];
          // Phase entlang der Fließrichtung (diagonal versetzt) → wandernde Ader
          const ph = Math.sin((c * 0.55 + r * 0.28) - wave * 2.2);
          if (ph < 0.55) continue;
          const a = (ph - 0.55) / 0.45;
          ctx.fillStyle = `rgba(${rf.anim},${(0.30 * a).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL * 0.40, CELL * 0.20, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const fc = getFloodCache();
    // Zonen-Overlay gecacht (v3.15.5): ändert sich nur mit dem Grid — in
    // Offscreen-Canvas rendern und pro Frame blitten statt >1000 fillRects.
    const zoneKey = gridVersion.current + ":" + players.join("");
    if (!zoneCanvas.current) {
      zoneCanvas.current = document.createElement("canvas");
      zoneCanvas.current.width = W;
      zoneCanvas.current.height = H;
    }
    if (zoneKeyRef.current !== zoneKey) {
      zoneKeyRef.current = zoneKey;
      const zc = zoneCanvas.current.getContext("2d");
      zc.clearRect(0, 0, W, H);
      const ZONE_FILL = { 1: "rgba(56,120,230,0.28)", 2: "rgba(220,50,50,0.28)", 3: "rgba(16,150,90,0.28)" };
      for (const player of players) {
        const outside = fc.outside[player];
        if (!outside) continue;
        const ownWall = WALL_OF[player];
        zc.fillStyle = ZONE_FILL[player];
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++) {
            if (!outside[r * COLS + c] && g[r][c] !== ownWall)
              zc.fillRect(c * CELL, r * CELL, CELL, CELL);
          }
      }
    }
    ctx.drawImage(zoneCanvas.current, 0, 0);
    // ── Leck-Spur (v3.37.0): macht die Umschlossen-Regel SICHTBAR ──────────
    // Pulsierende rote Spur von der Burg durch die Lücke bis zum Feldrand.
    // Tutorial: die ganze Bauphase, solange offen. Normale Spiele: in den
    // letzten 8s zusammen mit der ZUMAUERN-Warnung (nur eigene Burg).
    // BFS nur bei Grid-Änderung (Cache je gridVersion) — Frame-Kosten: Arcs.
    if (phase_r.current === "build") {
      const showFor = [];
      if (tutorialMode.current) {
        if (!fc.castleClosed[1]) showFor.push(1);
      } else if (timerVal.current <= 8 && timerVal.current > 0) {
        const cand = online.current ? (myRole.current >= 1 ? [myRole.current] : []) : botMode.current ? [1] : players;
        for (const p of cand) if (!eliminated.current[p] && !fc.castleClosed[p]) showFor.push(p);
      }
      for (const p of showFor) {
        const cache = leakPathRef.current;
        if (!cache[p] || cache[p].v !== gridVersion.current) {
          const lp = findLeakPath(g, p, castles.current[p]);
          // Min-Cut (v3.37.3): exakt die Zellen, die das Loch schließen
          cache[p] = { v: gridVersion.current, path: lp, gaps: lp ? findSealCells(g, p, castles.current[p]) : [] };
        }
        const path = cache[p].path;
        if (!path) continue;
        for (let i = 1; i < path.length - 1; i += 2) {
          const a = 0.45 + 0.4 * Math.sin(now / 150 - i * 0.7);
          if (a <= 0.05) continue;
          const [pr, pc] = path[i];
          ctx.fillStyle = "rgba(239,68,68," + a.toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(pc * CELL + CELL / 2, pr * CELL + CELL / 2, 2.4 + 1.2 * a, 0, Math.PI * 2);
          ctx.fill();
        }
        // Lücken-Zellen (v3.37.1): GENAU hier ist der Ring offen — pulsierender
        // roter Rahmen + Füllung auf den Loch-Zellen an der Mauer-Mündung.
        const gaps = cache[p].gaps || [];
        if (gaps.length) {
          const ga = 0.55 + 0.35 * Math.sin(now / 180);
          ctx.fillStyle = "rgba(239,68,68," + (ga * 0.35).toFixed(2) + ")";
          ctx.strokeStyle = "rgba(255,255,255," + ga.toFixed(2) + ")";
          ctx.lineWidth = 2;
          for (const [gr, gc] of gaps) {
            roundRectPath(ctx, gc * CELL + 1, gr * CELL + 1, CELL - 2, CELL - 2, 3.5);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = "rgba(239,68,68," + ga.toFixed(2) + ")";
            ctx.lineWidth = 2.5;
            roundRectPath(ctx, gc * CELL - 1.5, gr * CELL - 1.5, CELL + 3, CELL + 3, 4.5);
            ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255," + ga.toFixed(2) + ")";
            ctx.lineWidth = 2;
          }
        }
      }
    }
    // ── Kontaktschatten-Ebene (v3.41.0, AAA-Stufe 1: Licht & Tiefe) ─────────
    // Vorher lagen Mauern/Burgen/Kanonen flach auf dem Terrain — nichts warf
    // Schatten, dadurch wirkte alles wie aufgeklebt. Jetzt: EINE versetzte,
    // weichgezeichnete Silhouette aller massiven Zellen, gebacken pro
    // gridVersion (Muster wie zoneCanvas) → pro Frame nur ein drawImage.
    // PERF-REGEL eingehalten: filter/Blur NUR beim Backen, nie im Frame-Loop.
    const shKey = String(gridVersion.current);
    // Silhouette in HALBER Auflösung (v3.41.0): der Schatten ist ohnehin
    // weichgezeichnet — halbe Auflösung ist optisch identisch, kostet aber nur
    // ~1/4. Gemessen: Bake-Spitze 14,7 ms → 3,6 ms (Worst Case ~1000 Zellen).
    // Wichtig, weil das Grid auch MITTEN im Schuss kippt (zerstörte Mauern).
    const SH_S = 0.5;
    if (!shadowCanvas.current) {
      shadowCanvas.current = document.createElement("canvas");
      shadowCanvas.current.width = W;
      shadowCanvas.current.height = H;
      shadowSilhouette.current = document.createElement("canvas");
      shadowSilhouette.current.width = Math.ceil(W * SH_S);
      shadowSilhouette.current.height = Math.ceil(H * SH_S);
    }
    if (shadowKeyRef.current !== shKey) {
      shadowKeyRef.current = shKey;
      const sc = shadowCanvas.current.getContext("2d");
      const sil = shadowSilhouette.current.getContext("2d");
      const sw = shadowSilhouette.current.width, shh = shadowSilhouette.current.height;
      sc.clearRect(0, 0, W, H);
      sil.clearRect(0, 0, sw, shh);
      // 1) harte Silhouette aller massiven Zellen sammeln (halbe Auflösung)
      sil.fillStyle = "#000";
      const hc = CELL * SH_S;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const v = g[r][c];
          if (v === EMPTY || v === RIVER || v === MOUNTAIN) continue;
          sil.fillRect(c * hc + 0.3, r * hc + 0.3, hc - 0.6, hc - 0.6);
        }
      const canBlur = typeof sc.filter === "string";
      // 2) breiter Schlagschatten, versetzt entlang der Lichtachse
      sc.globalAlpha = 0.5;
      if (canBlur) sc.filter = "blur(2.6px)";
      sc.drawImage(shadowSilhouette.current, SHADOW_DX, SHADOW_DY, W, H);
      if (canBlur) sc.filter = "none";
      // 3) enger, dunklerer Kontaktschatten direkt an der Kante (Andockung)
      sc.globalAlpha = 0.34;
      if (canBlur) sc.filter = "blur(1.1px)";
      sc.drawImage(shadowSilhouette.current, SHADOW_DX * 0.45, SHADOW_DY * 0.45, W, H);
      if (canBlur) sc.filter = "none";
      sc.globalAlpha = 1;
    }
    ctx.drawImage(shadowCanvas.current, 0, 0);
    // Mauern/Trümmer als vorgerenderte Sprites blitten (v3.15.5) — pro Zelle
    // nur noch EIN drawImage statt Gradient + 6 Pfad-Operationen.
    // wallHp ist meist leer (keine Panzermauern gekauft) → String-Concat pro
    // Mauerzelle nur dann bauen, wenn überhaupt Risse existieren (v3.19.4).
    const anyCrack = wallHp.current && Object.keys(wallHp.current).length > 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = g[r][c];
        if (v === EMPTY) continue;
        const px = c * CELL, py = r * CELL;
        if (v === WALL1 || v === WALL2 || v === WALL3) {
          // Variante deterministisch aus der Zellposition (v3.63.0): dieselbe
          // Zelle sieht immer gleich aus, Nachbarzellen aber verschieden —
          // eine Mauerreihe wirkt gemauert statt gekachelt. Kostet nichts:
          // es sind weiterhin nur vier vorgebackene Sprites je Farbe.
          // Verzahnung (v3.64.0): Maske aus den vier Nachbarn DERSELBEN
          // Mauerfarbe. Nur freie Seiten bekommen Kante und Rundung — so
          // wird aus Einzelsteinen ein Mauerwerk mit klarer Aussenkontur.
          const mk = (r > 0 && g[r - 1][c] === v ? 1 : 0)
                   | (c < COLS - 1 && g[r][c + 1] === v ? 2 : 0)
                   | (r < ROWS - 1 && g[r + 1][c] === v ? 4 : 0)
                   | (c > 0 && g[r][c - 1] === v ? 8 : 0);
          ctx.drawImage(wallSprite(v, (r * 7 + c * 3) % 4, mk), px, py);
          // Panzermauer angeknackst (v3.16.0): Riss-Overlay
          if (anyCrack && wallHp.current[r + "_" + c])
            ctx.drawImage(crackSprite((r * 3 + c) % 3), px, py);
        }
        else if (v === RUBBLE || v === RUBBLE_C) ctx.drawImage(rubbleSprite((r * 5 + c * 2) % 3), px, py);
      }
    }
    for (const player of players) {
      const ct = castles.current[player];
      if (!ct) continue;
      const cx2 = ct.c * CELL + CELL / 2, cy2 = ct.r * CELL + CELL / 2;
      const open2 = !fc.castleClosed[player];
      if (p1Flipped) p1CounterFlip(cx2, cy2);
      drawCastle(ctx, cx2, cy2, player, open2, now);
      if (p1Flipped) p1CounterFlipEnd();
    }
    if (phase_r.current === "build") {
      for (const player of players) {
        const p = pieces.current[player];
        if (p.ghostR === null) continue;
        const { cells } = p;
        const offR = p.ghostR - Math.floor(Math.max(...cells.map(([r]) => r)) / 2);
        const offC = p.ghostC - Math.floor(Math.max(...cells.map(([, c]) => c)) / 2);
        const abs = cells.map(([r, c]) => [r + offR, c + offC]);
        let valid = abs.every(
          ([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS && g[r][c] === EMPTY && isBuildable(terObj, r, c, player)
        );
        const ghostCenterX = (p.ghostC + 0.5) * CELL;
        const ghostCenterY = (p.ghostR + 0.5) * CELL;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        for (const [r, c] of abs) {
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
          ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
        }
        const resetting = cancelHover.current[player];
        const col = resetting ? "rgba(148,163,184," : valid ? GHOST_RGB[player] || GHOST_RGB[1] : "rgba(120,120,120,";
        ctx.fillStyle = col + "0.55)";
        ctx.strokeStyle = col + "0.9)";
        ctx.lineWidth = 2;
        for (const [r, c] of abs) {
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
          ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          ctx.strokeRect(c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3);
        }
        ctx.strokeStyle = col + "0.4)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        const ownFlipped = p1Flipped && player === 1;
        const liftSign = ownFlipped ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(ghostCenterX, ownFlipped ? offR * CELL : (p.ghostR + Math.floor(Math.max(...cells.map(([r]) => r)) / 2) + 1) * CELL);
        ctx.lineTo(ghostCenterX, ghostCenterY + liftSign * LIFT_ROWS * CELL);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = resetting ? "#94a3b8" : valid ? GHOST_HEX[player] || GHOST_HEX[1] : "#6b7280";
        ctx.font = `bold ${CELL * 0.8}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(resetting ? "\u21ba" : valid ? "\u2713" : "\u2717", ghostCenterX, ghostCenterY + liftSign * LIFT_ROWS * CELL - 2);
        ctx.textAlign = "left";
      }
    } else if (phase_r.current === "cannon" || phase_r.current === "setup") {
      const GFILL = { 1: "rgba(245,158,11,0.45)", 2: "rgba(139,92,246,0.45)", 3: "rgba(16,185,129,0.45)" };
      const GSTROKE = { 1: "#fbbf24", 2: "#a78bfa", 3: "#34d399" };
      for (const player of players) {
        if (cannonBudget.current[player] <= 0) continue;
        const p = pieces.current[player];
        if (p.ghostR === null) continue;
        const gr0 = p.ghostR, gc0 = p.ghostC;
        let valid = true;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const r = gr0 + dr, c = gc0 + dc;
            if (r < 1 || r >= ROWS - 1 || c < 1 || c >= COLS - 1 || g[r][c] !== EMPTY || !isBuildable(terObj, r, c, player)) valid = false;
          }
        const resettingC = cancelHover.current[player];
        ctx.fillStyle = resettingC ? "rgba(148,163,184,0.35)" : valid ? GFILL[player] : "rgba(120,120,120,0.3)";
        ctx.strokeStyle = resettingC ? "rgba(148,163,184,0.7)" : valid ? GSTROKE[player] : "rgba(160,160,160,0.5)";
        ctx.lineWidth = 2;
        ctx.fillRect((gc0 - 1) * CELL, (gr0 - 1) * CELL, CELL * 3, CELL * 3);
        ctx.strokeRect((gc0 - 1) * CELL + 1, (gr0 - 1) * CELL + 1, CELL * 3 - 2, CELL * 3 - 2);
        ctx.fillStyle = resettingC ? "#cbd5e1" : valid ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)";
        ctx.font = `${CELL * 1.4}px serif`;
        ctx.textAlign = "center";
        ctx.fillText(resettingC ? "\u21ba" : "\u2295", gc0 * CELL + CELL / 2, gr0 * CELL + CELL);
        ctx.textAlign = "left";
      }
    }
    const zielOverlays = [];   // Zielhilfen: erst NACH allen Kanonen zeichnen
    for (const player of players) {
      const angle = cannonAngle.current[player];
      const outsideMap = fc.cannonOutside[player];
      const list = cannons.current[player];
      const anchor = slingAnchor(player);
      const frozen = frozenReady.current[player] || [];
      const isReady = (cn) => cn.hp > 0 && (phase_r.current === "shoot" ? frozen.includes(cn.id) : isCannonClosed(outsideMap, cn));
      // Z-ORDER (v3.57.1): Der Zieler wurde bisher MITTEN in der Spielerschleife
      // gezeichnet — die Kanonen des jeweils naechsten Spielers malten dann
      // darueber, sodass das Fadenkreuz hinter Kanonen verschwand. Er wandert
      // deshalb in eine aufgeschobene Liste und wird nach ALLEN Kanonen
      // gezeichnet. Zielhilfen gehoeren immer ganz nach vorn.
      if (phase_r.current === "shoot" && activeDrag.current[player] !== null) {
        const pid = activeDrag.current[player];
        const pt = pointers.current.get(pid);
        if (pt) zielOverlays.push(() => {
          const tgt = slingTarget(player, pt.x, pt.y);
          const col = ACCENT_RGB[player] || ACCENT_RGB[1];
          ctx.strokeStyle = col + "0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(anchor.x, anchor.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
          if (tgt) {
            const { tx, ty } = tgt;
            const pulse2 = 1 + 0.15 * Math.sin(now / 150);
            // Nur die Kanonen der gewaehlten Art zeigen ihre Schusslinie — sonst
            // verspricht der Zieler Feuer aus Rohren, die gar nicht schiessen.
            const aktiveArt = salvenModus.current[player] || "std";
            const readyCannons = list.filter((cn) => isReady(cn) && (cn.kt || "std") === aktiveArt);
            ctx.strokeStyle = col + "0.45)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 7]);
            for (const cn of readyCannons) {
              ctx.beginPath();
              ctx.moveTo(cn.c * CELL + CELL / 2, cn.r * CELL + CELL / 2);
              ctx.lineTo(tx, ty);
              ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.strokeStyle = col + "0.95)";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(tx, ty, CELL * 0.85 * pulse2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(tx, ty, CELL * 0.28, 0, Math.PI * 2);
            ctx.stroke();
            for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              ctx.beginPath();
              ctx.moveTo(tx + ddx * CELL * 0.5, ty + ddy * CELL * 0.5);
              ctx.lineTo(tx + ddx * CELL * 1.15 * pulse2, ty + ddy * CELL * 1.15 * pulse2);
              ctx.stroke();
            }
            if (readyCannons.length > 1) {
              const maxScatter = Math.min((readyCannons.length - 1) * 0.3, 1) * CELL;
              ctx.strokeStyle = col + "0.25)";
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.arc(tx, ty, maxScatter, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = col + "0.9)";
              ctx.font = `bold ${CELL * 0.75}px system-ui`;
              ctx.textAlign = "center";
              ctx.fillText(`\xD7${readyCannons.length}`, tx, ty - CELL * 1.4 * pulse2);
              ctx.textAlign = "left";
            }
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.font = `${CELL * 0.6}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText("weiter ziehen\u2026", anchor.x, anchor.y < H / 2 ? anchor.y + CELL * 3.6 : anchor.y - CELL * 3.2);
            ctx.textAlign = "left";
          }
        });
      }
      // Schmiede-Kanonen-Skin (v3.33.0): EIN Lookup pro Spieler, dann pro
      // Kanone nur das (skin-gecachte) Sprite blitten — keine neuen Frame-Kosten.
      const pSkinId = (playerInfo.current[player] || {}).cannon;
      const pSkinDef = pSkinId ? CANNON_SKIN[pSkinId] : null;
      for (const cn of list) {
        const cx = cn.c * CELL + CELL / 2;
        const cy = cn.r * CELL + CELL / 2;
        const isClosed = isReady(cn);
        if (p1Flipped) p1CounterFlip(cx, cy);
        drawCannonFull(ctx, cx, cy, p1Flipped ? -angle : angle, player, reload.current[player], now, pSkinDef ? pSkinId : null, pSkinDef, cn.kt);
        if (p1Flipped) p1CounterFlipEnd();
        if (cn.hp < CANNON_HP) {
          const bw = CELL * 2.4, bx = cx - bw / 2, by = p1Flipped ? cy + CELL * 2.1 : cy - CELL * 2.1;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          roundRectPath(ctx, bx, by, bw, 5, 2.5);
          ctx.fill();
          const frac = cn.hp / CANNON_HP;
          ctx.fillStyle = frac > 0.5 ? "#4ade80" : frac > 0.25 ? "#fbbf24" : "#ef4444";
          roundRectPath(ctx, bx + 1, by + 1, (bw - 2) * frac, 3, 1.5);
          ctx.fill();
        }
        if (!isClosed) {
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.beginPath();
          ctx.arc(cx, cy, CELL * 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(239,68,68,0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx - CELL * 0.6, cy - CELL * 0.6);
          ctx.lineTo(cx + CELL * 0.6, cy + CELL * 0.6);
          ctx.moveTo(cx + CELL * 0.6, cy - CELL * 0.6);
          ctx.lineTo(cx - CELL * 0.6, cy + CELL * 0.6);
          ctx.stroke();
        }
      }
    }
    // Zielhilfen zuletzt: Fadenkreuz und Schusslinien liegen damit ueber ALLEN
    // Kanonen — auch ueber denen des Gegners und den neuen Bezwinger-Aufsaetzen.
    for (const zeichne of zielOverlays) zeichne();
    for (const ball of balls.current) {
      const p2 = ball.prog;
      const bx = ball.sx + (ball.tx - ball.sx) * p2;
      const by = ball.sy + (ball.ty - ball.sy) * p2;
      const h = Math.sin(Math.PI * p2) * ball.arcH;
      const shScale = 1 - h / (ball.arcH + 40) * 0.6;
      const drawY = by - h * 0.55;
      // projectile trail
      if (ball.trail) {
        // Kosmetik-Trail (v3.23.0) + Meister-Trails aus der Schmiede (v3.33.0):
        // Meister = längerer, kräftigerer, mehrfarbiger Schweif. Nur billige
        // fillStyle-Farben + arcs — KEINE Gradients/shadowBlur (Perf-Regel).
        const trailId = (playerInfo.current[ball.player] || {}).trail;
        const mPal = trailId ? MASTER_TRAIL[trailId] : null;
        const maxTrail = mPal ? 13 : 9;
        ball.trail.push({ x: bx, y: drawY });
        if (ball.trail.length > maxTrail) ball.trail.shift();
        const trailCol = TRAIL_COLOR[trailId] || BALL_MID[ball.player] || BALL_MID[1];
        // Form je Schweif (v3.66.0) — ohne gekauften Trail bleibt es die
        // bisherige Kugelkette. Bewusst nur fillStyle + Pfade, keine
        // Gradients oder Schatten (Perf-Regel gilt im Frame).
        const tf = TRAIL_FORM[trailId];
        for (let ti = 0; ti < ball.trail.length - 1; ti++) {
          const tp = ball.trail[ti];
          const f = ti / ball.trail.length;
          ctx.globalAlpha = f * (mPal ? 0.75 : 0.4);
          ctx.fillStyle = mPal ? mPal[ti % 3] : trailCol;
          if (!tf) {
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, (mPal ? 2 : 1.5) + ti * 0.5, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }
          // Deterministisches Ausfransen: gleiche Kugel -> gleiches Muster,
          // kein Flackern zwischen Frames.
          const j = Math.sin((ti + ball.cannonIndex * 3.1) * 12.9898) * 43758.5453;
          const seit = ((Math.abs(j) % 1) - 0.5) * tf.drift * (1 - f) * 4;
          const gr = (mPal ? 1.8 : 1.3) + ti * tf.wachs * (mPal ? 1.25 : 1);
          const px = tp.x + seit, py = tp.y + seit * 0.4;
          if (tf.form === "kristall") {          // eckige Eissplitter
            ctx.save(); ctx.translate(px, py); ctx.rotate(j % 3);
            ctx.fillRect(-gr, -gr * 0.55, gr * 2, gr * 1.1);
            ctx.restore();
          } else if (tf.form === "muenze") {     // flache Goldplaettchen
            ctx.beginPath();
            ctx.ellipse(px, py, gr * 1.25, gr * 0.45, j % 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (tf.form === "funke") {      // spitze Funken, nach hinten schmal
            ctx.beginPath();
            ctx.moveTo(px - gr * 1.6, py); ctx.lineTo(px, py - gr * 0.75);
            ctx.lineTo(px + gr * 0.5, py); ctx.lineTo(px, py + gr * 0.75);
            ctx.closePath(); ctx.fill();
          } else {                                // Blasen mit heller Kappe
            ctx.beginPath(); ctx.arc(px, py, gr, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = f * 0.35;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(px - gr * 0.3, py - gr * 0.35, gr * 0.35, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(bx, by, 6 * shScale, 4 * shScale, 0, 0, Math.PI * 2);
      ctx.fill();
      const ballR = 5 + h / (ball.arcH + 1) * 5;
      // Vorgerendertes Ball-Sprite skaliert blitten (v3.15.5) — kein
      // shadowBlur/Gradient mehr pro Ball pro Frame.
      const bs = ballSprite(ball.player);
      const bsc = ballR / 8;
      ctx.drawImage(bs, bx - 24 * bsc, drawY - 24 * bsc, 48 * bsc, 48 * bsc);
    }
    for (const p of particles.current) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const ps = p.size || 2;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, ps, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - ps, p.y - ps, ps * 2, ps * 2);
      }
    }
    ctx.globalAlpha = 1;
    // „+N Beute"-Popups (v3.16.3): am Trefferort, Spielerfarbe, steigen bildschirm-
    // aufwärts (flip-bewusst); frame-basiert und via State synchronisiert.
    if (scrapPops.current.length) {
      const POP_HEX = { 1: "#93c5fd", 2: "#fca5a5", 3: "#6ee7b7" };
      ctx.font = "800 13px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const f of scrapPops.current) {
        const fa = 1 - f.frame / 80;
        const rise = f.frame * 0.55 * (p1Flipped ? 1 : -1);
        ctx.globalAlpha = Math.max(0, Math.min(1, fa * 1.6));
        ctx.fillStyle = "#0a0d14";
        ctx.fillText("+" + f.amt, f.x + 1, f.y + rise + 1);
        ctx.fillStyle = POP_HEX[f.player] || "#fbbf24";
        ctx.fillText("+" + f.amt, f.x, f.y + rise);
        // Kleiner Edelstein hinter der Zahl — im Canvas gezeichnet statt als
        // Glyphe, damit er zum Icon im HUD passt.
        {
          const bw = ctx.measureText("+" + f.amt).width;
          const gx = f.x + bw / 2 + 6, gy = f.y + rise - 3.5, gs = 4.2;
          ctx.beginPath();
          ctx.moveTo(gx, gy - gs); ctx.lineTo(gx + gs * 0.78, gy);
          ctx.lineTo(gx, gy + gs); ctx.lineTo(gx - gs * 0.78, gy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath();
          ctx.moveTo(gx, gy - gs); ctx.lineTo(gx + gs * 0.36, gy - gs * 0.15);
          ctx.lineTo(gx, gy + gs * 0.1); ctx.closePath();
          ctx.fill();
        }
        f.frame++;
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      scrapPops.current = scrapPops.current.filter((f) => f.frame < 80);
    }
    // Reparatur-Highlight (v3.32.0): reparierte Zellen pulsieren ~1,5s grün
    if (repairFx.current.length) {
      for (const f of repairFx.current) {
        const px = f.c * CELL, py = f.r * CELL;
        const tt = f.frame / 90;
        const pulse = 0.5 + 0.5 * Math.sin(f.frame / 4.5);
        ctx.globalAlpha = (1 - tt) * (0.35 + 0.35 * pulse);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(px, py, CELL, CELL);
        const grow = 2 + tt * 7;
        ctx.globalAlpha = 1 - tt;
        ctx.strokeStyle = "#bbf7d0";
        ctx.lineWidth = 2;
        ctx.strokeRect(px - grow, py - grow, CELL + grow * 2, CELL + grow * 2);
        f.frame++;
      }
      ctx.globalAlpha = 1;
      repairFx.current = repairFx.current.filter((f) => f.frame < 90);
    }
    explosions.current = explosions.current.filter((e2) => e2.frame < 22);
    // Sound bei neuen Explosionen (funktioniert geräteübergreifend, da explosions synchronisiert sind)
    const explNow = explosions.current.length;
    const bigNow = explosions.current.filter((e2) => e2.big).length;
    if (explNow > prevExplCount.current) {
      if (bigNow > prevBigCount.current) SFX.destroy();
      else SFX.impact();
    }
    prevExplCount.current = explNow;
    prevBigCount.current = bigNow;
    // ── Impact-Stack (v3.41.0, AAA-Stufe 3: Juice) ──────────────────────────
    // Vorher: EIN Radialverlauf → der Treffer, also der emotionale Höhepunkt
    // jeder Runde, fühlte sich an wie ein Klick. Jetzt fünf gestaffelte Lagen.
    // ⚠ MUSS deterministisch sein: Explosionen werden online synchronisiert
    // (nur x/y/frame gehen über den Draht) — daher Pseudo-Zufall aus x,y,i
    // statt Math.random, sonst sähen Host und Gast Unterschiedliches.
    for (const ex of explosions.current) {
      const t = ex.frame / 22;
      const rr = t * CELL * (ex.big ? 6 : 2.8);
      const a = 1 - t;
      const exFx = ex.fx ? IMPACT_FX[ex.fx] : null;
      const ring = exFx ? exFx.ring : ["255,255,210", "251,191,36", "239,68,68"];
      const seed0 = (ex.x * 12.9898 + ex.y * 78.233);
      const rnd2 = (i) => Math.abs(Math.sin(seed0 + i * 37.719) * 43758.5453) % 1;
      // (1) Kernglut — der bisherige Verlauf, bleibt als Basis
      const grd = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, Math.max(rr, 1));
      grd.addColorStop(0, `rgba(${ring[0]},${a})`);
      grd.addColorStop(0.35, `rgba(${ring[1]},${a * 0.9})`);
      grd.addColorStop(0.7, `rgba(${ring[2]},${a * 0.6})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, Math.max(rr, 1), 0, Math.PI * 2);
      ctx.fill();
      // (2) Lichtblitz — kurz, hell, überstrahlt den Einschlagpunkt
      if (t < 0.28) {
        const f = 1 - t / 0.28;
        const fr = CELL * (ex.big ? 3.4 : 1.8) * (0.5 + f);
        const fl = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, fr);
        fl.addColorStop(0, `rgba(255,255,245,${(0.9 * f).toFixed(3)})`);
        fl.addColorStop(0.5, `rgba(${ring[1]},${(0.45 * f).toFixed(3)})`);
        fl.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fl;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, fr, 0, Math.PI * 2);
        ctx.fill();
      }
      // (3) Druckwelle — zwei versetzte Ringe, werden dünner beim Aufweiten
      for (let w = 0; w < 2; w++) {
        const wt = t - w * 0.10;
        if (wt <= 0 || wt > 0.75) continue;
        const wp = wt / 0.75;
        ctx.strokeStyle = `rgba(${w ? ring[1] : ring[0]},${((1 - wp) * 0.75).toFixed(3)})`;
        ctx.lineWidth = (1 - wp) * (ex.big ? 4.5 : 2.6) + 0.6;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, wp * CELL * (ex.big ? 7 : 3.6) + CELL * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // (4) Trümmer — fliegen mit Schwerkraft auseinander, drehen sich
      const nDeb = ex.big ? 12 : 7;
      for (let d = 0; d < nDeb; d++) {
        const ang = rnd2(d) * Math.PI * 2;
        const spd = CELL * (1.6 + rnd2(d + 50) * 3.2) * (ex.big ? 1.5 : 1);
        const dx2 = ex.x + Math.cos(ang) * spd * t;
        const dy2 = ex.y + Math.sin(ang) * spd * t + CELL * 5 * t * t;
        const sz = (1.4 + rnd2(d + 90) * 2.2) * (1 - t * 0.5);
        if (sz <= 0.2) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(dx2, dy2);
        ctx.rotate(ang + t * 9 * (rnd2(d + 20) > 0.5 ? 1 : -1));
        ctx.fillStyle = `rgba(${ring[2]},0.95)`;
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      // (5) Staubwolke — weiche Puffs, bleiben am längsten stehen
      const nDust = ex.big ? 7 : 4;
      for (let u = 0; u < nDust; u++) {
        const ua = rnd2(u + 130) * Math.PI * 2;
        const ud = CELL * (0.5 + rnd2(u + 160) * 1.4) * (ex.big ? 1.8 : 1);
        const ux = ex.x + Math.cos(ua) * (ud + t * CELL * 2.6);
        const uy = ex.y + Math.sin(ua) * (ud + t * CELL * 1.9) - t * CELL * 0.8;
        const ur = CELL * (0.5 + t * (ex.big ? 2.2 : 1.3));
        ctx.globalAlpha = Math.max(0, (1 - t) * 0.22);
        const dg2 = ctx.createRadialGradient(ux, uy, 0, ux, uy, ur);
        dg2.addColorStop(0, "rgba(210,196,180,0.85)");
        dg2.addColorStop(1, "rgba(210,196,180,0)");
        ctx.fillStyle = dg2;
        ctx.beginPath();
        ctx.arc(ux, uy, ur, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ex.frame++;
    }
    // decorative gold battlefield border
    ctx.strokeStyle = "rgba(170,140,55,0.35)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    } finally {
      if (p1Flipped) { ctx.fillText = CanvasRenderingContext2D.prototype.fillText; ctx.restore(); }
      if (didShake) ctx.restore();
    }
    if (online.current && myRole.current === 1) pushState(false);
    // Gated Perf-Metrik (v3.15.5): window.__perfDbg = true → Zeichendauer in __frameMs
    if (typeof window !== "undefined" && window.__perfDbg && window.__frameT0) {
      const fm = window.__frameMs = window.__frameMs || [];
      fm.push(performance.now() - window.__frameT0);
      if (fm.length > 600) fm.shift();
    }
    animId.current = requestAnimationFrame(renderLoop);
  }, []);
  useEffect(() => {
    if (screen !== "game") {
      running.current = false;
      clearInterval(timerID.current);
      cancelAnimationFrame(animId.current);
      clearTimeout(phaseBannerTimer.current);
      bannerActive.current = false;
      setPhaseBanner(null);
      return;
    }
    running.current = true;
    animId.current = requestAnimationFrame(renderLoop);
    return () => {
      running.current = false;
      clearInterval(timerID.current);
      cancelAnimationFrame(animId.current);
      clearTimeout(phaseBannerTimer.current);
      bannerActive.current = false;
    };
  }, [screen]);
  useEffect(() => {
    const h = (e) => {
      if (phase_r.current !== "build") return;
      if (e.key === "r" || e.key === "R") rotatePiece(1);
      if (e.key === "t" || e.key === "T") rotatePiece(2);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    const iv = setInterval(() => {
      if (online.current && showDbg) setUiTick((t) => t + 1);
    }, 500);
    return () => clearInterval(iv);
  }, [showDbg]);
  // Cloud-Sync anstossen, sobald eine uid feststeht — und erneut, wenn sich die
  // Identitaet aendert (Google verknuepft oder zu einem bestehenden Konto
  // gewechselt). cloudPull() schuetzt sich selbst gegen Doppellaeufe.
  useEffect(() => {
    const onAuth = () => { cloudPull(); };
    window.addEventListener("fb-auth", onAuth);
    window.addEventListener("fb-linked", onAuth);
    if (authUid()) cloudPull();
    return () => {
      window.removeEventListener("fb-auth", onAuth);
      window.removeEventListener("fb-linked", onAuth);
    };
  }, []);
  useEffect(() => {
    if (!profile || !profile.id) return;
    let done = false;
    const sync = () => {
      if (done) return;
      done = true;
      pushLeaderboard(profile);
    };
    if (sdk()) sync();
    else {
      window.addEventListener("fb-ready", sync, { once: true });
      const t = setTimeout(() => {
        if (sdk()) sync();
      }, 2500);
      return () => {
        window.removeEventListener("fb-ready", sync);
        clearTimeout(t);
      };
    }
  }, []);
  function beginSetup() {
    const players = playersList();
    eliminated.current = {};
    const mk = (val) => players.reduce((o, p) => (o[p] = val, o), {});
    pieces.current = players.reduce((o, p) => (o[p] = { cells: randomShape(), ghostR: null, ghostC: null }, o), {});
    balls.current = [];
    explosions.current = [];
    particles.current = [];
    reload.current = mk(1);
    lastShot.current = mk(-99999);
    pointers.current.clear();
    activeDrag.current = mk(null);
    activeBuild.current = mk(null);
    warnedOpen.current = mk(false);
    cannonBudget.current = mk(2);
    // Match-Progression (v3.16.0): Schrott + Upgrades ÜBERLEBEN den Rundenwechsel
    // (Level-Gefühl übers ganze Match). Nur Karten-Lokales wird zurückgesetzt:
    // wallHp (neue Karte) und die Kanonenpreis-Staffel (frische Kanonen-Ökonomie).
    for (const p of players) {
      if (typeof scrap.current[p] !== "number") scrap.current[p] = 0;
      const up = upgrades.current[p] || (upgrades.current[p] = { reload: 0, armor: 0, repair: 0, cbought: 0 });
      up.cbought = 0;
      up.repair = 0; // Reparatur-Staffel pro Karte (v3.24.0), analog Kanonenpreis
    }
    wallHp.current = {};
    if (numPlayersRef.current === 3) {
      cannonAngle.current = { 1: Math.PI, 2: Math.PI * 1.67, 3: Math.PI * 0.33 };
    } else {
      cannonAngle.current = { 1: Math.PI / 2, 2: -Math.PI / 2 };
    }
    phase_r.current = "setup";
    setPhase("setup");
    timerVal.current = SETUP_TIME;
    setTimer(SETUP_TIME);
    setResultInfo(null);
    setScreen("game");
    showPhaseBanner("setup", startTimer);
  }
  // Ökonomie eines NEUEN Spiels zurücksetzen (v3.19.1): 150 Beute Startkapital,
  // keine Upgrades, keine angeknacksten Mauern. MUSS bei jedem Spielstart laufen
  // — auch online (sonst schleppt das nächste Spiel den Schrott des vorigen mit,
  // Startwert war dadurch bei jedem Online-Spiel anders).
  function resetEconomy() {
    scrap.current = { 1: 150, 2: 150, 3: 150 };
    upgrades.current = { 1: { reload: 0, armor: 0, repair: 0, cbought: 0 }, 2: { reload: 0, armor: 0, repair: 0, cbought: 0 }, 3: { reload: 0, armor: 0, repair: 0, cbought: 0 } };
    wallHp.current = {};
    matchStats.current = { 1: msZero(), 2: msZero(), 3: msZero() };
  }
  function startGame() {
    initGrid();
    setRound(1);
    roundRefVal.current = 1;
    // Neues Spiel: Ökonomie zurücksetzen — mit 150 Beute Startkapital (v3.16.4),
    // damit schon in der ersten Rüstphase eine echte Kaufentscheidung möglich ist.
    resetEconomy();
    beginSetup();
  }
  function fullReset() {
    const players = playersList();
    const z = players.reduce((o, p) => (o[p] = 0, o), {});
    scoresRef.current = __spreadValues({}, z);
    setScores(__spreadValues({}, z));
    startGame();
  }
  function nextRound() {
    initGrid();
    setRound((r) => r + 1);
    roundRefVal.current = roundRefVal.current + 1; // Ref mitziehen (v3.47.0) — er wird an die Gaeste gesendet
    // Match-Bilanz zählt pro Runde (v3.21.0): Result-Screen und Daily-Task-
    // Ernte beziehen sich auf die gerade gespielte Runde, nicht die Session.
    matchStats.current = { 1: msZero(), 2: msZero(), 3: msZero() };
    beginSetup();
  }
  const timerColor = timer <= 5 ? "#ef4444" : timer <= 10 ? "#f59e0b" : "#4ade80";
  // Pro Spieler: ist in den letzten 8 Bau-Sekunden die Burg noch offen?
  //
  // **Nur fuer Burgen, die der Mensch am Geraet selbst zumauern kann.** Die
  // Warnung ist ein Handlungsaufruf — „ZUMAUERN!", pulsierend, dazu der rote
  // Rahmen ums Brett. Fuer eine fremde Burg ist das kein Aufruf, sondern
  // Laerm: Man kann dort nichts tun, und es liest sich, als sei man selbst in
  // Not. Gemeldet vom Geraet (v3.91.0): Im Bot-Modus pulsierte die Leiste des
  // BOTS, waehrend die eigene Burg dicht war.
  //
  // Online war es von Anfang an richtig begrenzt. Offline lief alles ueber
  // `playersList()` — und das schliesst im Bot-Modus und im Tutorial die KI
  // ein. Beim Spiel zu zweit oder zu dritt an EINEM Geraet ist die Liste
  // dagegen richtig: Dort sitzt hinter jeder Burg ein Mensch.
  const meineBurgen = online.current
    ? (myRole.current >= 1 ? [myRole.current] : playersList())
    : (botMode.current || tutorialMode.current) ? [1] : playersList();
  // Spiegel fuer den gesicherten Haken `__urgent` (nur mit __mmDebug). Die
  // Warnung haengt an einem waehrend des Renderns gerechneten Wert; ohne
  // Spiegel muesste eine Pruefung sie ueber die Anzeige erraten, und dann
  // prueft sie das Aussehen statt der Regel.
  const urgentRef2 = useRef({});
  const urgentPlayers = (phase === "build" && timer <= 8 && timer > 0) ? (() => {
    const fc = getFloodCache();
    const res = {};
    meineBurgen.forEach((p) => { if (!eliminated.current[p] && !fc.castleClosed[p]) res[p] = true; });
    return res;
  })() : {};
  urgentRef2.current = urgentPlayers;
  const buildUrgencyOpen = Object.keys(urgentPlayers).length > 0;
  // Tutorial: ist die Spielerburg (P1) gerade offen (vom Bot aufgeschossen)? → Coach-Text/Key
  const coachP1Open = tutorialMode.current && screen === "game" && !getFloodCache().castleClosed[1];
  // Coach-Popup-Steuerung (v3.37.2): Pause-Flag synchron halten
  useEffect(() => { tutPausedRef.current = tutorialMode.current && !!coachMsg; }, [coachMsg]);
  // Phasen-Popup: bei jedem Phasenwechsel im Tutorial einmal zeigen (pausiert)
  useEffect(() => {
    if (!tutorialMode.current || screen !== "game") { setCoachMsg(null); return; }
    if (!["setup", "build", "shoot", "cannon"].includes(phase)) return;
    coachShownRef.current = {};
    coachShownRef.current[phase + "_base"] = true;
    const textKey = phase === "setup" ? "coachSetup"
      : phase === "build" ? "coachBuild"
      : phase === "shoot" ? (((frozenReady.current[1] || []).length === 0) ? "coachShootNoCannon" : "coachShoot")
      : "coachCannon";
    setCoachMsg({ key: phase + "_base", textKey });
  }, [phase, screen]);
  // Zustands-Popups (Burg aufgeschossen): je Phase einmal, erst wenn das
  // aktuelle Popup bestätigt wurde. Läuft mit dem Sekunden-Tick des Timers.
  useEffect(() => {
    if (!tutorialMode.current || screen !== "game" || coachMsg) return;
    const shown = coachShownRef.current;
    if (phase === "build" && coachP1Open && !shown.build_open) {
      shown.build_open = true;
      setCoachMsg({ key: "build_open", textKey: "coachBuildOpen" });
    } else if (phase === "shoot" && coachP1Open && ((frozenReady.current[1] || []).length > 0) && !shown.shoot_open) {
      shown.shoot_open = true;
      setCoachMsg({ key: "shoot_open", textKey: "coachShootOpen" });
    }
  });
  // Achievements-„Ungelesen"-Zähler: nur NEUE (noch nicht gesehene) freigeschaltete Achievements.
  const achUnlockedCount = Array.isArray(profile && profile.achievements) ? profile.achievements.filter((a) => a.unlocked).length : 0;
  const achNew = Math.max(0, achUnlockedCount - achSeenCount);
  // Schriftzug in der Spieler-Namensbox als Ergänzung zum pochenden Rand.
  const closeWarnSpan = (align) => /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 14, color: "#fee2e2", fontWeight: 900, letterSpacing: "0.02em",
    whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto", display: "inline-block",
    textAlign: align || "left",
    transformOrigin: (align === "right" ? "right" : align === "center" ? "center" : "left") + " center",
    animation: "closePulse 0.45s ease-in-out infinite"
  } }, "⚠ " + t('closeWarn'));
  if (screen === "menu") return /* @__PURE__ */ React.createElement("div", { style: {
    background: "radial-gradient(ellipse 120% 80% at 50% -10%, #102036 0%, #081225 38%, #040a16 70%, #02060f 100%)",
    // **100% statt 100dvh.** Der Koerper ist bereits um die Sicherheitsbereiche
    // verkuerzt; volle 100dvh machen das Menue hoeher als seinen Platz, und die
    // Fusszeile verschwand unter dem Rand.
    height: "100%",
    // Rollbar, weil ein Menue auf einem kleinen Telefon laenger sein darf als
    // der Schirm. Vorher wurde es schlicht abgeschnitten.
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    display: "flex",
    // flex-start + margin:auto am Kind statt alignItems:center — zentriert,
    // solange es passt, und schneidet oben NICHT ab, wenn es nicht passt.
    // Mit alignItems:center waere der obere Teil in einem rollbaren Kasten
    // unerreichbar.
    alignItems: "flex-start",
    justifyContent: "center",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    color: "#eef2f9",
    padding: 16,
    boxSizing: "border-box"
  } }, /* @__PURE__ */ React.createElement("div", { className: "gross-spalte", style: { textAlign: "center", maxWidth: 440, width: "100%", margin: "auto 0" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 6, color: "#60a5fa" } }, /* @__PURE__ */ React.createElement(Icon, { name: "shield", size: 26, color: "#22d3ee" }), /* @__PURE__ */ React.createElement(Icon, { name: "swords", size: 30, color: "#a78bfa" }), /* @__PURE__ */ React.createElement(Icon, { name: "crown", size: 26, color: "#fbbf24" })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, letterSpacing: "0.3em", color: "#22d3ee", marginBottom: 8, fontWeight: 600 } }, t('tagline')), /* @__PURE__ */ React.createElement("h1", { style: {
    // v3.80.0: Der Name hat 13 Zeichen statt 8. Mit den alten 14vw lief er
    // auf einem schmalen Telefon rechts aus dem Bild. Gemessen, nicht geraten
    // — siehe Changelog.
    fontSize: "clamp(30px,8.2vw,50px)",
    fontWeight: 900,
    margin: "0 0 4px",
    background: "linear-gradient(120deg,#22d3ee 0%,#60a5fa 45%,#a78bfa 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-1px",
    lineHeight: 1.05,
    filter: "drop-shadow(0 4px 28px rgba(56,189,248,0.35))"
  } }, "Stack & Siege"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 13, color: "#64748b", marginBottom: 6, letterSpacing: "0.04em" } }, t('subtitle')), profile && /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${profile.color}55`,
    borderRadius: 14,
    padding: "12px 14px",
    marginBottom: 16,
    textAlign: "left"
  } }, /* @__PURE__ */ React.createElement("div", { style: (() => {
    // Wappen-Rahmen (v3.23.0): gekaufter Zierrahmen um das eigene Wappen
    const fr = FRAME_STYLE[cosOf(profile).equipped.frame];
    return {
      width: 72,
      height: 72,
      borderRadius: "50%",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Der Rahmen ist jetzt ein gemusterter Ring (CSS-Verlauf), kein
      // einfarbiger Rand mehr. padding erzeugt die Ringbreite, der Avatar
      // sitzt darin — so wirkt Bronze genietet, Gold als Zierkranz usw.
      border: "none",
      padding: fr ? (fr.dick || 4) : 0,
      background: fr ? fr.bg : "transparent",
      boxShadow: fr
        ? `0 0 16px ${fr.glow}, inset 0 0 0 1px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.55)`
        : `0 0 20px ${profile.color}77, 0 0 40px ${profile.color}33`
    };
  })() }, React.createElement("div", { style: { borderRadius: "50%", overflow: "hidden", background: "#0b101c", display: "flex", lineHeight: 0 } },
      React.createElement(WappenAvatar, { id: profile.wappen, size: FRAME_STYLE[cosOf(profile).equipped.frame] ? 62 : 72 }))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 800, fontSize: 16, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, profile.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#94a3b8", marginTop: 3, display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement(Icon, { name: "swords", size: 12, color: "#60a5fa" }), /* @__PURE__ */ React.createElement("span", { style: { color: "#fbbf24", fontWeight: 700 } }, typeof profile.elo === "number" ? profile.elo : 1e3), " ELO \xB7 ", profile.stats.wins, "S \xB7 ", profile.stats.losses, "N \xB7 ", Math.round(profile.stats.wins * 100 / Math.max(1, profile.stats.games || profile.stats.wins + profile.stats.losses)), "%"), profile.stats3 && profile.stats3.games > 0 && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement(Icon, { name: "crown", size: 12, color: "#34d399" }), /* @__PURE__ */ React.createElement("span", { style: { color: "#fbbf24", fontWeight: 700 } }, typeof profile.elo3 === "number" ? profile.elo3 : 1e3), " ELO \xB7 ", profile.stats3.wins, "S \xB7 ", profile.stats3.losses, "N"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#f59e0b", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement(Icon, { name: "coins", size: 13, color: "#fbbf24" }), typeof profile.gold === "number" ? profile.gold : 100, " Gold"),
    // Schmiede-Bestand (v3.68.0): steht jetzt direkt neben dem Gold, damit man
    // sieht, dass sich Material ansammelt — Klick fuehrt in die Schmiede.
    /* @__PURE__ */ React.createElement("div", { onClick: () => setShowForge(true), title: t("matToForge"), style: { display: "flex", alignItems: "center", gap: 7, marginTop: 4, cursor: "pointer" } },
      React.createElement(Icon, { name: "hammer", size: 12, color: forgeReadyN > 0 ? "#fb923c" : "#64748b" }),
      React.createElement(MatRow, { t, vals: matOf(profile), size: 11, gap: 4 })
    ), React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 2 } }, React.createElement(LevelBadge, { level: typeof profile.level === "number" ? profile.level : 1 }), React.createElement(XpBarUI, { level: typeof profile.level === "number" ? profile.level : 1, xp: typeof profile.xp === "number" ? profile.xp : 0 }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 } },
    /* @__PURE__ */ React.createElement("button", { onClick: openProfileEditor, title: t('profileTitle'), style: {
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
      color: "#cbd5e1", borderRadius: 8, padding: "7px 11px", fontSize: 13, cursor: "pointer"
    } }, /* @__PURE__ */ React.createElement(Icon, { name: "user", size: 16 })),
    /* @__PURE__ */ React.createElement("button", { onClick: openAchievements, title: "Achievements", style: {
      background: achNew > 0 ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.08)",
      border: achNew > 0 ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.15)",
      color: achNew > 0 ? "#fbbf24" : "#cbd5e1",
      borderRadius: 8, padding: "7px 11px", fontSize: 13, cursor: "pointer", position: "relative"
    } },
      React.createElement(Icon, { name: "trophy", size: 16 }),
      achNew > 0 ? React.createElement("span", { style: { position: "absolute", top: -4, right: -4, background: "#fbbf24", color: "#000", borderRadius: "50%", width: 14, height: 14, fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 } }, achNew) : null
    ),
    // Daily Tasks (v3.22.0): 📋-Button mit Badge (Anzahl abholbereiter Aufgaben)
    /* @__PURE__ */ React.createElement("button", { onClick: () => { setTasksState(loadTasksState()); setShowTasksModal(true); }, title: t('tasksTitle'), style: {
      background: tasksClaimable > 0 ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.08)",
      border: tasksClaimable > 0 ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.15)",
      color: tasksClaimable > 0 ? "#34d399" : "#cbd5e1",
      borderRadius: 8, padding: "7px 11px", fontSize: 13, cursor: "pointer", position: "relative",
      animation: tasksClaimable > 0 ? "streakGlow 2s ease infinite" : "none"
    } },
      React.createElement(Icon, { name: "clipboard", size: 16 }),
      tasksClaimable > 0 ? React.createElement("span", { style: { position: "absolute", top: -4, right: -4, background: "#34d399", color: "#000", borderRadius: "50%", width: 14, height: 14, fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 } }, tasksClaimable) : null
    ),
    // Gold-Shop (v3.23.0): Kosmetik gegen erspieltes Gold
    /* @__PURE__ */ React.createElement("button", { onClick: () => setShowGoldShop(true), title: t('goldShopTitle'), style: {
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
      color: "#cbd5e1", borderRadius: 8, padding: "7px 11px", fontSize: 13, cursor: "pointer"
    } }, React.createElement(Icon, { name: "shoppingCart", size: 16 })),
    // Schmiede-Button mit Abzeichen (v3.68.0): zeigt, wie viele Rezepte JETZT
    // bezahlbar sind — sonst bleibt gesammeltes Material unbemerkt liegen.
    /* @__PURE__ */ React.createElement("button", { onClick: () => setShowForge(true), title: t('forgeTitle') + (forgeReadyN > 0 ? " \xB7 " + forgeReadyN + " " + t("forgeReady") : ""), style: {
      background: forgeReadyN > 0 ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.1)",
      border: "1px solid " + (forgeReadyN > 0 ? "rgba(251,146,60,0.75)" : "rgba(251,146,60,0.35)"),
      color: "#fdba74", borderRadius: 8, padding: "7px 11px", fontSize: 13, cursor: "pointer", position: "relative",
      animation: forgeReadyN > 0 ? "streakGlow 2s ease infinite" : "none"
    } },
      React.createElement(Icon, { name: "hammer", size: 16 }),
      forgeReadyN > 0 ? React.createElement("span", { style: { position: "absolute", top: -4, right: -4, background: "#fb923c", color: "#2b1204", borderRadius: "50%", width: 14, height: 14, fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 } }, forgeReadyN) : null
    )
  )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => setLang('de'), style: { background: lang === 'de' ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.06)", border: lang === 'de' ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.12)", color: lang === 'de' ? "#4ade80" : "#64748b", borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "DE"), /* @__PURE__ */ React.createElement("button", { onClick: () => setLang('en'), style: { background: lang === 'en' ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.06)", border: lang === 'en' ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.12)", color: lang === 'en' ? "#4ade80" : "#64748b", borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "EN"), /* @__PURE__ */ React.createElement("button", { onClick: () => { const next = !soundOn; setSoundOn(next); if (next) { SFX.enabled = true; SFX.resume(); setTimeout(() => SFX.buy(), 150); } }, title: "Sound", style: { background: soundOn ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.06)", border: soundOn ? "1px solid rgba(96,165,250,0.5)" : "1px solid rgba(255,255,255,0.12)", color: soundOn ? "#93c5fd" : "#64748b", borderRadius: 8, padding: "5px 12px", fontSize: 15, fontWeight: 700, cursor: "pointer" } }, React.createElement(Icon, { name: soundOn ? "volume2" : "volumeX", size: 16 })), /* @__PURE__ */ React.createElement("button", { onClick: () => setMusicOn((v2) => !v2), title: "Musik", style: { background: musicOn ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.06)", border: musicOn ? "1px solid rgba(52,211,153,0.5)" : "1px solid rgba(255,255,255,0.12)", color: musicOn ? "#6ee7b7" : "#64748b", borderRadius: 8, padding: "5px 12px", fontSize: 15, fontWeight: 700, cursor: "pointer" } }, React.createElement(Icon, { name: "music", size: 16 })), /* @__PURE__ */ React.createElement("button", { onClick: () => { const next = !hapticsOn; setHapticsOn(next); if (next) { vibriere(20); } }, title: "Vibration", style: { background: hapticsOn ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.06)", border: hapticsOn ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.12)", color: hapticsOn ? "#c4b5fd" : "#64748b", borderRadius: 8, padding: "5px 12px", fontSize: 15, fontWeight: 700, cursor: "pointer" } }, React.createElement(Icon, { name: hapticsOn ? "vibrate" : "vibrateOff", size: 16 }))), musicOn && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginBottom: 12, padding: "0 26px" } },
    /* @__PURE__ */ React.createElement(Icon, { name: "music", size: 13, color: "#6ee7b7" }),
    /* @__PURE__ */ React.createElement("input", { type: "range", min: 0, max: 100, value: Math.round(musicVol * 100), "aria-label": "Musik-Lautst\u00e4rke",
      onChange: (e) => setMusicVol(parseInt(e.target.value, 10) / 100),
      style: { flex: 1, maxWidth: 220, accentColor: "#34d399", height: 18, cursor: "pointer" } }),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: "#64748b", width: 30, textAlign: "left" } }, Math.round(musicVol * 100) + "%")
  ), getDailyCollectable(dailyState) && /* @__PURE__ */ React.createElement("button", { onClick: () => setShowDailyModal(true), title: t('dailyTitle'), style: { width: "100%", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: "pointer", animation: "streakGlow 2s ease infinite" } }, /* @__PURE__ */ React.createElement(Icon, { name: "zap", size: 16, color: "#fbbf24" }), t("dailyTitle")), /* @__PURE__ */ React.createElement("button", { onClick: () => setMpScreen("local"), style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    border: "1px solid rgba(124,58,237,0.5)",
    padding: "16px",
    fontSize: 16,
    fontWeight: 800,
    borderRadius: 14,
    cursor: "pointer",
    letterSpacing: "0.04em",
    boxShadow: "0 6px 30px rgba(59,130,246,0.35)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "swords", size: 19 }), t('playLocal')), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    numPlayersRef.current = 2;
    setNumPlayers(2);
    setMpError("");
    setMpScreen("online");
  }, style: {
    width: "100%",
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(34,211,238,0.16))",
    color: "#e2e8f0",
    border: "1px solid rgba(16,185,129,0.45)",
    padding: "15px",
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 14,
    cursor: "pointer",
    boxShadow: "0 4px 22px rgba(16,185,129,0.18)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "globe", size: 18 }), t('playOnline')), /* @__PURE__ */ React.createElement("button", { onClick: openLeaderboard, style: {
    width: "100%",
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    background: "rgba(251,191,36,0.1)",
    color: "#fde68a",
    border: "1px solid rgba(251,191,36,0.32)",
    padding: "13px",
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 14,
    cursor: "pointer"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "trophy", size: 17 }), t('lbTitle')), /* @__PURE__ */ React.createElement("p", { onClick: () => {
    // Fuenfmal auf die Versionszeile: Bildraten-Anzeige an/aus. Versteckt,
    // weil sie niemanden stoeren soll, der sie nicht sucht — und ohne
    // Einstellungsmenue, weil sie kein Spiel-Merkmal ist, sondern ein
    // Messgeraet.
    const t = perfTipps.current;
    t.push(Date.now());
    while (t.length && Date.now() - t[0] > 3000) t.shift();
    if (t.length >= 5) {
      t.length = 0;
      perfAn.current = !perfAn.current;
      perfPuffer.current = []; perfLetzt.current = 0;
      try { localStorage.setItem('fortress_perf', perfAn.current ? '1' : '0'); } catch (e) {}
      setPerfSichtbar(perfAn.current);
    }
  }, style: { marginTop: 18, fontSize: 12, color: "#64748b", letterSpacing: "0.08em", fontWeight: 600, cursor: "default" } }, "Stack & Siege \xB7 Version 3.111.6"), // **Rechtslinks nur im Browser.** In der App sind Impressum und
    // Nutzungsbedingungen auf dem Startbildschirm fehl am Platz: Dort steht
    // kein Anbieter zur Auswahl, und Apple verlangt die Datenschutzadresse in
    // den Store-Angaben, nicht in der App. Geprueft wird ueber die EINE
    // Plattform-Weiche (ARCHITEKTUR.md E7).
    !istNativ() && /* @__PURE__ */ React.createElement("div", { key: "recht" }, /* @__PURE__ */ React.createElement("a", { href: "privacy.html", target: "_blank", rel: "noopener", style: { display: "inline-block", marginTop: 8, fontSize: 11, color: "#475569", letterSpacing: "0.06em", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid rgba(71,85,105,0.5)" } }, t('privacyLink')), /* @__PURE__ */ React.createElement("span", { style: { color: "#334155", fontSize: 11, margin: "0 8px" } }, "\xB7"), /* @__PURE__ */ React.createElement("a", { href: "impressum.html", target: "_blank", rel: "noopener", style: { display: "inline-block", marginTop: 8, fontSize: 11, color: "#475569", letterSpacing: "0.06em", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid rgba(71,85,105,0.5)" } }, t('imprintLink')), /* @__PURE__ */ React.createElement("span", { style: { color: "#334155", fontSize: 11, margin: "0 8px" } }, "\xB7"), /* @__PURE__ */ React.createElement("a", { href: "agb.html", target: "_blank", rel: "noopener", style: { display: "inline-block", marginTop: 8, fontSize: 11, color: "#475569", letterSpacing: "0.06em", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid rgba(71,85,105,0.5)" } }, t('termsLink')), /* @__PURE__ */ React.createElement("span", { style: { color: "#334155", fontSize: 11, margin: "0 8px" } }, "\xB7"), /* @__PURE__ */ React.createElement("a", { href: "uebersicht.html", target: "_blank", rel: "noopener", style: { display: "inline-block", marginTop: 8, fontSize: 11, color: "#475569", letterSpacing: "0.06em", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid rgba(71,85,105,0.5)" } }, t('reportsLink')))), showTutorialIntro && (() => {
    const h = React.createElement;
    // Mini-Diagramm: Burg (Quadrat) + Mauerring; gap=true lässt oben eine
    // Lücke und zeichnet die rote Leck-Spur hindurch.
    const ringSvg = (gap) => {
      const cells = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (gap && dr === -1 && dc === 0) continue; // Lücke oben
        cells.push(h("rect", { key: dr + "_" + dc, x: 20 + dc * 13, y: 20 + dr * 13, width: 11, height: 11, rx: 2, fill: gap ? "#64748b" : "#3b82f6" }));
      }
      return h("svg", { viewBox: "0 0 51 51", width: 64, height: 64, style: { display: "block", margin: "0 auto 6px" } },
        cells,
        h("rect", { x: 20, y: 20, width: 11, height: 11, rx: 2, fill: gap ? "#ef4444" : "#fbbf24" }),
        gap ? h("path", { d: "M25.5 23 L25.5 4", stroke: "#ef4444", strokeWidth: 2.4, strokeDasharray: "3 3", fill: "none" }) : null,
        gap ? h("path", { d: "M21.5 9 L25.5 3 L29.5 9", stroke: "#ef4444", strokeWidth: 2.4, fill: "none" }) : null
      );
    };
    const panel = (borderC, bgC, icon, iconC, title, text, svg) => h("div", { style: {
      flex: 1, minWidth: 0, borderRadius: 14, padding: "12px 10px", textAlign: "center",
      background: bgC, border: "1px solid " + borderC
    } },
      svg,
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 5 } },
        h(Icon, { name: icon, size: 14, color: iconC }),
        h("div", { style: { fontSize: 11, fontWeight: 900, color: iconC, letterSpacing: "0.06em" } }, title)
      ),
      h("div", { style: { fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.45 } }, text)
    );
    return h("div", { key: "tutintro", style: {
      position: "fixed", inset: 0, zIndex: 1300, background: "rgba(2,6,15,0.93)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 16px) calc(var(--sa-right,0px) + 16px) calc(var(--sa-bottom,0px) + 16px) calc(var(--sa-left,0px) + 16px)"
    } },
      h("div", { style: {
        maxWidth: 440, width: "100%", maxHeight: "92vh", overflowY: "auto",
        background: "linear-gradient(160deg,#15082a,#0f1f2e)", border: "1px solid rgba(124,58,237,0.4)",
        borderRadius: 20, padding: "20px 16px 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        animation: "dailyBounceIn 0.45s cubic-bezier(.36,1.6,.56,1) both", textAlign: "center"
      } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 } },
          h(Icon, { name: "target", size: 20, color: "#a78bfa" }),
          h("div", { style: { fontSize: 19, fontWeight: 900, color: "#f1f5f9" } }, t("tutIntroTitle"))
        ),
        h("div", { style: { fontSize: 12.5, color: "#94a3b8", marginBottom: 14, lineHeight: 1.45 } }, t("tutIntroSub")),
        h("div", { style: { display: "flex", gap: 8, marginBottom: 10 } },
          panel("rgba(74,222,128,0.35)", "rgba(74,222,128,0.06)", "trophy", "#4ade80", t("tutIntroWinTitle"), t("tutIntroWinText"), ringSvg(false)),
          panel("rgba(239,68,68,0.35)", "rgba(239,68,68,0.06)", "skull", "#f87171", t("tutIntroLoseTitle"), t("tutIntroLoseText"), ringSvg(true))
        ),
        h("div", { style: {
          display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", borderRadius: 12,
          padding: "10px 12px", background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", marginBottom: 8
        } },
          h(Icon, { name: "flame", size: 15, color: "#fbbf24", style: { marginTop: 1 } }),
          h("div", { style: { fontSize: 11.5, color: "#e2e8f0", lineHeight: 1.45 } }, t("tutIntroCannonRule"))
        ),
        h("div", { style: {
          display: "flex", alignItems: "center", gap: 10, textAlign: "left", borderRadius: 12,
          padding: "10px 12px", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.28)", marginBottom: 8
        } },
          h("svg", { viewBox: "0 0 40 40", width: 40, height: 40, style: { flexShrink: 0 } },
            h("rect", { x: 4, y: 4, width: 14, height: 14, rx: 2, fill: "#3b82f6" }),
            h("rect", { x: 22, y: 22, width: 14, height: 14, rx: 2, fill: "#3b82f6" }),
            h("path", { d: "M30 6 L10 32", stroke: "#ef4444", strokeWidth: 2.4, strokeDasharray: "3 3", fill: "none" }),
            h("path", { d: "M10.5 25 L9.5 33 L17 31", stroke: "#ef4444", strokeWidth: 2.2, fill: "none" })
          ),
          h("div", { style: { fontSize: 11.5, color: "#e2e8f0", lineHeight: 1.45 } }, t("tutIntroDiagRule"))
        ),
        h("div", { style: {
          display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", borderRadius: 12,
          padding: "10px 12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 16
        } },
          h(Icon, { name: "zap", size: 15, color: "#f87171", style: { marginTop: 1 } }),
          h("div", { style: { fontSize: 11.5, color: "#e2e8f0", lineHeight: 1.45 } }, t("tutIntroLeakHint"))
        ),
        h("button", { onClick: beginTutorialRun, style: {
          width: "100%", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "#fff",
          border: "none", padding: "14px", fontSize: 16, fontWeight: 800, borderRadius: 12,
          cursor: "pointer", marginBottom: 8, boxShadow: "0 4px 20px rgba(124,58,237,0.35)"
        } }, t("tutIntroGo")),
        h("button", { onClick: () => setShowTutorialIntro(false), style: {
          width: "100%", background: "rgba(255,255,255,0.06)", color: "#94a3b8",
          border: "1px solid rgba(255,255,255,0.12)", padding: "11px", fontSize: 13,
          fontWeight: 700, borderRadius: 12, cursor: "pointer"
        } }, t("tutIntroLater"))
      )
    );
  })(), (showProfileEditor || !profile) && /* @__PURE__ */ React.createElement("div", { style: {    position: "fixed",    inset: 0,
    background: "rgba(2,6,15,0.93)",
    backdropFilter: "blur(16px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    // v3.90.0: 1160 statt 1100. Auf 1100 liegen auch die Tages-Belohnung und
    // die Bestenliste; bei gleicher Ebene entscheidet die Reihenfolge im
    // Dokument, welches Fenster oben liegt. Der Editor enthaelt das EINZIGE
    // Textfeld des Spiels — wird er verdeckt, kann man sich keinen Namen
    // geben, und das sieht nicht nach einem Fenster aus, sondern nach einem
    // toten Feld.
    zIndex: 1160,
    padding: "24px 16px",
    overflowY: "auto"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(160deg,#09152a,#110826)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "14px 14px 14px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center"
  } },
  /* ══ HEADER: AVATAR + NAME + LEVEL + XP ══ */
  /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(160deg,rgba(255,255,255,0.065),rgba(255,255,255,0.02))",
    border: "1px solid " + (WAPPEN_GLOW[editWappen] || "#7c3aed") + "33",
    borderRadius: 18,
    padding: "12px 14px 12px",
    marginBottom: 10
  } },
    /* @__PURE__ */ React.createElement("div", { style: {
      width: 72, height: 72, borderRadius: "50%",
      margin: "0 auto 10px",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 0 20px " + (WAPPEN_GLOW[editWappen] || "#7c3aed") + "66,0 0 40px " + (WAPPEN_GLOW[editWappen] || "#7c3aed") + "22"
    } },
      /* @__PURE__ */ React.createElement(WappenAvatar, { id: editWappen || "skelett", size: 72 })
    ),
    /* @__PURE__ */ React.createElement("input", {
      value: editName,
      onChange: (e) => setEditName(e.target.value.slice(0, 16)),
      placeholder: t('profileNamePlaceholder'),
      style: {
        width: "100%", boxSizing: "border-box",
        textAlign: "center", fontSize: 18, fontWeight: 900,
        padding: "3px 8px",
        border: "none",
        borderBottom: "2px solid " + (WAPPEN_GLOW[editWappen] || "#7c3aed") + "55",
        background: "transparent",
        color: "#f1f5f9",
        letterSpacing: "0.02em",
        outline: "none",
        marginBottom: 8
      }
    }),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 } },
      /* @__PURE__ */ React.createElement(LevelBadge, { level: typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1, size: "lg" }),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: "0.06em" } },
        getLevelTier(typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1).label
      )
    ),
    /* @__PURE__ */ React.createElement("div", { style: { height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", position: "relative", marginBottom: 3 } },
      /* @__PURE__ */ React.createElement("div", { style: {
        position: "absolute", top: 0, left: 0, height: "100%",
        width: (() => { const l = typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1; const x = typeof (profile == null ? void 0 : profile.xp) === "number" ? profile.xp : 0; return Math.min(100, x / xpToNextLevel(l) * 100) + "%"; })(),
        background: "linear-gradient(90deg," + (WAPPEN_GLOW[editWappen] || "#7c3aed") + ",#22d3ee)",
        borderRadius: 4,
        boxShadow: "0 0 10px " + (WAPPEN_GLOW[editWappen] || "#7c3aed") + "88"
      } })
    ),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#475569", fontWeight: 600 } },
      (() => { const l = typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1; const x = typeof (profile == null ? void 0 : profile.xp) === "number" ? profile.xp : 0; return x + " / " + xpToNextLevel(l) + " XP"; })()
    )
  ),
  /* ══ AVATAR GALERIE ══ */
  /* @__PURE__ */ React.createElement("div", { style: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "10px 12px",
    marginBottom: 12
  } },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em" } }, React.createElement(Icon, { name: "sparkles", size: 12, style: { verticalAlign: "-2px", marginRight: 5 } }), t('avatarGallery')),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, background: "rgba(124,58,237,0.2)", color: "#a78bfa", padding: "2px 8px", borderRadius: 10, fontWeight: 700 } },
        WAPPEN.filter((w) => (AVATAR_UNLOCKS[w] || 1) <= (typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1)).length + "/" + WAPPEN.length
      )
    ),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 10 } },
      WAPPEN.filter((w) => (AVATAR_UNLOCKS[w] || 1) <= (typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1)).map((w) => {
        const glowColor = WAPPEN_GLOW[w] || "#888";
        const isSel = editWappen === w;
        return /* @__PURE__ */ React.createElement("button", { key: w, onClick: () => setEditWappen(w), style: {
          width: 52, height: 52, borderRadius: "50%", cursor: "pointer",
          background: "transparent", border: "none", padding: 0,
          position: "relative", flexShrink: 0,
          boxShadow: isSel ? "0 0 0 3px #fff,0 0 0 5px " + glowColor + ",0 0 18px " + glowColor : "0 0 0 2px " + glowColor + "44",
          outline: "none",
          transform: isSel ? "scale(1.12)" : "scale(1)",
          transition: "all 0.18s cubic-bezier(.36,1.6,.56,1)"
        }, title: w },
          /* @__PURE__ */ React.createElement(WappenAvatar, { id: w, size: 52 })
        );
      })
    ),
    /* @__PURE__ */ React.createElement("div", { style: { height: 1, background: "rgba(255,255,255,0.07)", margin: "0 0 8px" } }),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 } },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: "0.08em" } }, React.createElement(Icon, { name: "lock", size: 12, style: { verticalAlign: "-2px", marginRight: 5 } }), t('avatarLocked')),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, color: "#334155", fontWeight: 600 } },
        "(" + WAPPEN.filter((w) => (AVATAR_UNLOCKS[w] || 1) > (typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1)).length + ")"
      )
    ),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 10 } },
      WAPPEN.filter((w) => (AVATAR_UNLOCKS[w] || 1) > (typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1)).map((w) => {
        const reqLevel = AVATAR_UNLOCKS[w] || 1;
        return /* @__PURE__ */ React.createElement("div", { key: w, style: {
          width: 52, height: 52, borderRadius: "50%",
          position: "relative", flexShrink: 0, cursor: "not-allowed"
        }, title: t("lockedAt", { n: reqLevel }) },
          /* @__PURE__ */ React.createElement("div", { style: { filter: "grayscale(0.75) brightness(0.45)", width: 52, height: 52 } },
            /* @__PURE__ */ React.createElement(WappenAvatar, { id: w, size: 52 })
          ),
          /* @__PURE__ */ React.createElement("div", { style: {
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            borderRadius: "50%",
            background: "rgba(2,6,15,0.45)", gap: 2
          } },
            /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 14 }),
            /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.05em" } }, "L" + reqLevel)
          )
        );
      })
    ),
    (() => {
      const lvl = typeof (profile == null ? void 0 : profile.level) === "number" ? profile.level : 1;
      const nextW = WAPPEN.filter((w) => (AVATAR_UNLOCKS[w] || 1) > lvl).sort((a, b) => (AVATAR_UNLOCKS[a] || 1) - (AVATAR_UNLOCKS[b] || 1))[0];
      if (!nextW) return null;
      const reqLvl = AVATAR_UNLOCKS[nextW] || 1;
      const pct = Math.min(99, Math.round(lvl / reqLvl * 100));
      const gc = WAPPEN_GLOW[nextW] || "#888";
      return /* @__PURE__ */ React.createElement("div", { style: {
        background: "linear-gradient(135deg,rgba(124,58,237,0.12),rgba(34,211,238,0.06))",
        border: "1px solid " + gc + "33",
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 10
      } },
        /* @__PURE__ */ React.createElement("div", { style: { filter: "grayscale(0.5) brightness(0.55)", flexShrink: 0 } },
          /* @__PURE__ */ React.createElement(WappenAvatar, { id: nextW, size: 40 })
        ),
        /* @__PURE__ */ React.createElement("div", { style: { flex: 1, textAlign: "left" } },
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 } }, t('nextUnlock')),
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#e2e8f0", fontWeight: 800, marginBottom: 5 } }, nextW),
          /* @__PURE__ */ React.createElement("div", { style: { height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" } },
            /* @__PURE__ */ React.createElement("div", { style: { height: "100%", width: pct + "%", background: "linear-gradient(90deg," + gc + ",#22d3ee)", borderRadius: 2 } })
          )
        ),
        /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right", flexShrink: 0 } },
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, color: gc, fontWeight: 900 } }, "L" + reqLvl),
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, color: "#475569" } }, t('requiredLabel'))
        )
      );
    })()
  ),
  /* ══ INVENTAR (v3.26.1): gekaufte Kosmetik ansehen + anlegen ══ */
  profile && (() => {
    const h = React.createElement;
    const cos = cosOf(profile);
    const CATS = [["cannon", t("cosSectionCannon")], ["trail", t("cosSectionTrail")], ["frame", t("cosSectionFrame")], ["win", t("cosSectionWin")]];
    const invPreview = (cat, it) => {
      if (cat === "trail") return h("div", { style: {
        width: 22, height: 22, borderRadius: "50%",
        background: TRAIL_COLOR[it.id] || "#93a4bd",
        boxShadow: TRAIL_COLOR[it.id] ? "0 0 8px " + TRAIL_COLOR[it.id] : "none"
      } });
      if (cat === "frame") { const fr = FRAME_STYLE[it.id]; return h("div", { style: {
        width: 22, height: 22, borderRadius: "50%",
        border: fr ? "3px solid " + fr.c : "2px dashed rgba(255,255,255,0.25)",
        boxShadow: fr ? "0 0 8px " + fr.glow : "none", boxSizing: "border-box"
      } }); }
      const wi = WIN_ICON[it.id] || WIN_ICON.win_confetti;
      return h("div", { style: {
        width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.07)", boxShadow: "0 0 8px " + wi.c + "44"
      } }, h(Icon, { name: wi.name, size: 14, color: wi.c }));
    };
    const ownedTotal = Object.keys(COSMETICS).reduce((s, cat) => s + COSMETICS[cat].filter((it) => cosmeticOwned(cos, it)).length, 0);
    return h("div", { style: {
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "10px 12px", marginBottom: 12
    } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } },
        h("span", { style: { fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em" } }, h(Icon, { name: "backpack", size: 12, style: { verticalAlign: "-2px", marginRight: 5 } }), t('invTitle')),
        h("span", { style: { fontSize: 10, background: "rgba(251,191,36,0.15)", color: "#fcd34d", padding: "2px 8px", borderRadius: 10, fontWeight: 700 } }, ownedTotal + "")
      ),
      CATS.map(([cat, label]) => {
        const items = COSMETICS[cat].filter((it) => cosmeticOwned(cos, it));
        return h("div", { key: cat, style: { marginBottom: 8 } },
          h("div", { style: { fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5, textAlign: "left" } }, label),
          h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            items.map((it) => {
              const equipped = cos.equipped[cat] === it.id;
              return h("button", { key: it.id, onClick: () => buyOrEquipCosmetic(cat, it), title: t("cos_" + it.id), style: {
                border: "none", borderRadius: 11, padding: "7px 9px 6px", minWidth: 62,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                cursor: equipped ? "default" : "pointer",
                background: equipped ? "linear-gradient(180deg, rgba(52,211,153,0.2), rgba(10,14,24,0.6))" : "rgba(255,255,255,0.06)",
                boxShadow: equipped ? "inset 0 0 0 1.5px rgba(52,211,153,0.7)" : "inset 0 0 0 1px rgba(255,255,255,0.09)"
              } },
                invPreview(cat, it),
                h("span", { style: { fontSize: 8.5, fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap" } }, t("cos_" + it.id)),
                h("span", { style: { fontSize: 7.5, fontWeight: 900, color: equipped ? "#34d399" : "#64748b" } }, equipped ? t("cosEquipped") : t("invTapEquip"))
              );
            })
          )
        );
      }),
      h("button", { onClick: () => { setShowProfileEditor(false); setShowGoldShop(true); }, style: {
        width: "100%", marginTop: 2, border: "1px solid rgba(251,191,36,0.25)", cursor: "pointer",
        borderRadius: 10, padding: "8px", background: "rgba(251,191,36,0.08)",
        color: "#fcd34d", fontSize: 11.5, fontWeight: 800
      } }, h(Icon, { name: "shoppingCart", size: 12, style: { verticalAlign: "-2px", marginRight: 5 } }), t('invMoreInShop'))
    );
  })(),
  // ── Fortschritt sichern (v3.72.0, dritter Zustand v3.102.0) ────────────
  //
  // **Drei Zustaende, nicht zwei.** Bis v3.101.0 kannte dieser Block nur
  // „gesichert" und „nicht gesichert" — und zeigte im zweiten Fall
  // „wird automatisch gesichert". Gemessen am 18.09.: `getAuth()` wirft ohne
  // Firebase-API-Schluessel (`auth/invalid-api-key`), `__fb.auth` bleibt leer,
  // `uid` bleibt null, und die Sicherung laeuft NIE an
  // (`if (!uid) return;` im Upload). Jeder Tester las also ein Versprechen,
  // das niemand gehalten hat.
  //
  // Der Unterschied ist nicht kosmetisch: „liegt auf diesem Geraet und wird
  // gesichert" und „liegt auf diesem Geraet, Punkt" sind zwei verschiedene
  // Auskuenfte, und nur eine davon war wahr. Schwammige Formulierungen fuehren
  // dazu, dass niemand den Knopf drueckt — falsche dazu, dass er es fuer
  // unnoetig haelt.
  MP_CONFIGURED && (() => {
    const h = React.createElement;
    const F = (typeof window !== "undefined" && window.__fb) || {};
    const gesichert = !!authUid() && F.anon === false;
    // Kann ueberhaupt gesichert werden? Ohne Anmelde-Dienst nicht.
    const anmeldungLaeuft = !!F.auth && !!authUid();
    const garNichts = !gesichert && !anmeldungLaeuft;
    const farbe = gesichert ? "#34d399" : garNichts ? "#f87171" : "#fbbf24";
    const helle = gesichert ? "#6ee7b7" : garNichts ? "#fca5a5" : "#fcd34d";
    const flaeche = gesichert ? "52,211,153" : garNichts ? "248,113,113" : "251,191,36";
    return h("div", { style: {
      background: "rgba(" + flaeche + ",0.07)",
      border: "1px solid rgba(" + flaeche + ",0.28)",
      borderRadius: 16, padding: "11px 12px", marginBottom: 12, textAlign: "left"
    } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 5 } },
        h(Icon, { name: gesichert ? "shieldCheck" : "cloud", size: 14, color: farbe }),
        h("span", { style: { fontSize: 12, fontWeight: 800, color: helle } },
          t(gesichert ? "cloudOnTitle" : "cloudOffTitle")),
        cloudState === "syncing" ? h("span", { style: { fontSize: 9.5, color: "#64748b", marginLeft: "auto" } }, t("cloudSyncing")) : null,
        cloudState === "saved" ? h("span", { style: { fontSize: 9.5, color: "#4ade80", marginLeft: "auto" } }, "✓") : null
      ),
      h("div", { style: { fontSize: 10.5, color: "#94a3b8", lineHeight: 1.4, marginBottom: gesichert ? 0 : 9 } },
        gesichert   ? t("cloudOnSub", { mail: F.mail || "" })
      : garNichts   ? t("cloudNoAuthSub")
      : kontoVerknuepfbar() ? t("cloudOffSub") : t("cloudOffSubApp")),
      // In der App gibt es keinen Verknuepfungs-Knopf (ARCHITEKTUR.md E8) —
      // Cloud-Save laeuft dort ueber die anonyme Kennung.
      //
      // Und OHNE Anmelde-Dienst gibt es ihn nirgends: `linkAccount` kehrt bei
      // fehlendem `F.auth` stillschweigend zurueck. Ein Knopf, der nichts tut
      // und nichts sagt, ist schlimmer als kein Knopf — man drueckt ihn
      // zweimal und haelt dann das Spiel fuer kaputt.
      (gesichert || garNichts || !kontoVerknuepfbar()) ? null : h("button", { onClick: linkAccount, style: {
        width: "100%", border: "none", cursor: "pointer", borderRadius: 10, padding: "9px",
        background: "linear-gradient(180deg,#fbbf24,#d97706)", color: "#2b1204",
        fontSize: 12, fontWeight: 900
      } }, t("cloudLink")),
      // Loeschen steht bewusst unauffaellig: es ist unwiderruflich und darf
      // nicht neben "Speichern" wie eine gleichwertige Wahl aussehen.
      h("button", { onClick: () => setConfirmWipe(true), style: {
        width: "100%", marginTop: 8, cursor: "pointer", borderRadius: 10, padding: "7px",
        background: "transparent", border: "1px solid rgba(248,113,113,0.25)",
        color: "#f87171", fontSize: 10.5, fontWeight: 700
      } }, t("wipeButton"))
    );
  })(),
  confirmWipe && /* @__PURE__ */ React.createElement("div", { onClick: () => setConfirmWipe(false), style: {
    position: "fixed", inset: 0, zIndex: 1400, background: "rgba(2,6,15,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 22px) calc(var(--sa-right,0px) + 22px) calc(var(--sa-bottom,0px) + 22px) calc(var(--sa-left,0px) + 22px)",
    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)"
  } }, /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
    maxWidth: 330, width: "100%", background: "linear-gradient(180deg, rgba(48,14,14,0.99), rgba(14,11,20,0.99))",
    border: "1px solid rgba(248,113,113,0.4)", borderRadius: 18, padding: "18px 16px",
    textAlign: "center", boxShadow: "0 20px 55px rgba(0,0,0,0.75)"
  } },
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 900, color: "#fca5a5", marginBottom: 6 } }, t("wipeTitle")),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#fecaca", lineHeight: 1.45, marginBottom: 14 } }, t("wipeSub")),
    /* @__PURE__ */ React.createElement("button", { onClick: wipeProgress, style: {
      width: "100%", border: "none", cursor: "pointer", borderRadius: 12, padding: "12px",
      background: "linear-gradient(180deg,#f87171,#b91c1c)", color: "#fff",
      fontSize: 14, fontWeight: 900, marginBottom: 8
    } }, t("wipeConfirm")),
    /* @__PURE__ */ React.createElement("button", { onClick: () => setConfirmWipe(false), style: {
      width: "100%", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
      borderRadius: 12, padding: "10px", background: "rgba(255,255,255,0.05)",
      color: "#cbd5e1", fontSize: 13, fontWeight: 700
    } }, t("cancel"))
  )),
  /* @__PURE__ */ React.createElement("button", { onClick: saveProfileEditor, style: {
    width: "100%",
    background: "linear-gradient(135deg,#7c3aed,#0284c7)",
    color: "white", border: "none",
    padding: "16px",
    fontSize: 16, fontWeight: 900,
    borderRadius: 12,
    cursor: "pointer",
    letterSpacing: "0.06em",
    boxShadow: "0 4px 24px rgba(124,58,237,0.45),0 1px 0 rgba(255,255,255,0.15) inset",
    marginBottom: profile ? 10 : 0,
    textTransform: "uppercase"
  } }, React.createElement(Icon, { name: profile ? "save" : "swords", size: 16, style: { verticalAlign: "-3px", marginRight: 7 } }), profile ? t('profileSave') : t('profileCreate')),
  profile && /* @__PURE__ */ React.createElement("button", { onClick: () => setShowProfileEditor(false), style: {
    background: "transparent", color: "#475569",
    border: "none", fontSize: 13, cursor: "pointer",
    padding: "4px 12px", letterSpacing: "0.02em"
  } }, t('cancel')))), showLeaderboard && /* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed",
    inset: 0,
    background: "rgba(5,8,15,0.94)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1100,
    padding: 20
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(160deg,#0f1f2e,#15082a)",
    border: "1px solid rgba(202,138,4,0.3)",
    borderRadius: 16,
    padding: 22,
    maxWidth: 420,
    width: "100%",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 } }, /* @__PURE__ */ React.createElement("h2", { style: { margin: 0, fontSize: 20 } }, t('lbTitle')), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowLeaderboard(false), style: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#cbd5e1",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 14,
    cursor: "pointer"
  } }, "\u2715")), /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 12, margin: "0 0 10px" } }, t('lbSubtitle')), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14 } }, [2, 3].map((m) => /* @__PURE__ */ React.createElement("button", { key: m, onClick: () => switchLbMode(m), style: {
    flex: 1,
    padding: "8px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    background: lbMode === m ? "rgba(202,138,4,0.25)" : "rgba(255,255,255,0.05)",
    color: lbMode === m ? "#fde68a" : "#94a3b8",
    border: lbMode === m ? "1px solid rgba(202,138,4,0.5)" : "1px solid rgba(255,255,255,0.1)"
  } }, m === 2 ? t('local2p') : React.createElement("span", null, React.createElement(Icon, { name: "crown", size: 13, style: { verticalAlign: "-2px", marginRight: 5 } }), t('online3p'))))), /* @__PURE__ */ React.createElement("div", { style: { overflowY: "auto", flex: 1 } }, leaderboard === null && /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", textAlign: "center", padding: "30px 0" } }, t('lbLoading')), lbFehler && /* @__PURE__ */ React.createElement("div", { "data-lb-fehler": "1", style: { color: "#f59e0b", textAlign: "center", padding: "24px 12px", fontSize: 14, lineHeight: 1.5 } }, lbFehler), leaderboard && leaderboard.length === 0 && !lbFehler && /* @__PURE__ */ React.createElement("div", { style: { color: "#64748b", textAlign: "center", padding: "30px 0", fontSize: 14 } }, lbMode === 3 ? t('lbEmpty3p') : t('lbEmpty')), leaderboard && leaderboard.map((e, i) => {
    const isMe = profile && e.id === profile.id;
    const medalCol = i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : i === 2 ? "#d97706" : null;
    const medal = medalCol ? React.createElement(Icon, { name: "medal", size: 16, color: medalCol }) : `${i + 1}.`;
    return /* @__PURE__ */ React.createElement("div", { key: e.id, style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: isMe ? "rgba(202,138,4,0.15)" : "rgba(255,255,255,0.04)",
      border: isMe ? "1px solid rgba(202,138,4,0.5)" : "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
      padding: "9px 11px",
      marginBottom: 6
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: "#94a3b8", width: 28, textAlign: "center", flexShrink: 0 } }, medal), /* @__PURE__ */ React.createElement("div", { style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      flexShrink: 0,
      background: e.color || "#2563eb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18
    } }, React.createElement(WappenAvatar, { id: e.wappen || "skelett", size: 22 })), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, fontSize: 14, color: isMe ? "#fde68a" : "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.name, isMe && t('youSuffix')), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#64748b" } }, e.wins, " " + t('winsLabel') + " \xB7 ", e.losses, " " + t('lossLabel') + " \xB7 ", e.games, " " + t('gamesAbbr'))), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 900, fontSize: 18, color: "#fbbf24" } }, e.elo), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#475569" } }, "ELO")));  })), /* @__PURE__ */ React.createElement("button", { onClick: openLeaderboard, style: {    marginTop: 12,
    background: "rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "11px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "rotateCw", size: 15 }), t('lbRefresh')))), showDailyModal && React.createElement(DailyRewardModal, { t,
    daily: dailyState,
    onCollect: handleDailyCollect,
    onClose: () => setShowDailyModal(false),
    collected: dailyCollected
  }),
  // ── Material-Toast (v3.68.0) ──────────────────────────────
  // Liegt ueber allen Modals, damit die Einblendung auch beim Abholen einer
  // Aufgabe oder der Tag-7-Kiste sichtbar ist.
  matToast && React.createElement("div", { style: {
    position: "fixed", left: "50%", transform: "translateX(-50%)",
    bottom: "calc(var(--sa-bottom, 0px) + 26px)", zIndex: 1400,
    display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
    borderRadius: 999, pointerEvents: "none",
    background: "linear-gradient(180deg, rgba(48,30,12,0.97), rgba(14,11,20,0.97))",
    border: "1px solid rgba(251,146,60,0.5)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 22px rgba(251,146,60,0.25)",
    animation: "dailyBounceIn 0.32s cubic-bezier(.36,1.5,.56,1) both"
  } },
    React.createElement(Icon, { name: "hammer", size: 15, color: "#fdba74" }),
    React.createElement("span", { style: { fontSize: 11.5, fontWeight: 800, color: "#fdba74" } }, t("matEarned")),
    React.createElement(MatRow, { t, vals: matToast, nurPositive: true, plus: true, size: 12, gap: 8 })
  ),
  // ── Daily-Tasks-Modal (v3.22.0, SPEC 14.3) ──
  showTasksModal && (() => {
    const h = React.createElement;
    const allDone = tasksState.tasks.every((tk) => tk.collected);
    return h("div", { onClick: () => setShowTasksModal(false), style: {
      position: "fixed", inset: 0, zIndex: 1450, background: "rgba(2,6,15,0.9)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 18px) calc(var(--sa-right,0px) + 18px) calc(var(--sa-bottom,0px) + 18px) calc(var(--sa-left,0px) + 18px)"
    } },
      h("div", { onClick: (e) => e.stopPropagation(), style: {
        maxWidth: 400, width: "100%",
        background: "linear-gradient(180deg, rgba(30,41,66,0.98) 0%, rgba(11,16,30,0.99) 100%)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "18px 16px 16px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)",
        animation: "dailyBounceIn 0.4s cubic-bezier(.36,1.5,.56,1) both"
      } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 } },
          h(Icon, { name: "clipboard", size: 17, color: "#34d399" }),
          h("div", { style: { fontSize: 16, fontWeight: 900, color: "#f1f5f9" } }, t("tasksTitle"))
        ),
        h("div", { style: { fontSize: 11.5, color: "#64748b", marginBottom: 14 } }, t("tasksSub")),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 9, marginBottom: 6 } },
          tasksState.tasks.map((tk) => {
            const def = taskDef(tk.id);
            if (!def) return null;
            const prog = Math.min(def.target, tk.prog || 0);
            const ready = !tk.collected && prog >= def.target;
            const frac = prog / def.target;
            return h("div", { key: tk.id, style: {
              display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 13,
              background: tk.collected ? "rgba(74,222,128,0.06)" : ready ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)",
              border: "1px solid " + (tk.collected ? "rgba(74,222,128,0.2)" : ready ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.08)")
            } },
              h("div", { style: {
                width: 34, height: 34, borderRadius: 999, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: tk.collected ? "rgba(255,255,255,0.05)" : "rgba(96,165,250,0.12)",
                border: "1px solid " + (tk.collected ? "rgba(255,255,255,0.08)" : "rgba(96,165,250,0.3)")
              } }, h(Icon, { name: def.icon, size: 17, color: tk.collected ? "#64748b" : "#93c5fd" })),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: 12.5, fontWeight: 700, color: tk.collected ? "#64748b" : "#e2e8f0", textDecoration: tk.collected ? "line-through" : "none" } }, t("task_" + tk.id)),
                h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginTop: 4 } },
                  h("div", { style: { flex: 1, height: 5, borderRadius: 999, background: "rgba(0,0,0,0.4)", overflow: "hidden" } },
                    h("div", { style: { width: Math.round(frac * 100) + "%", height: "100%", borderRadius: 999, background: tk.collected ? "#4ade80" : ready ? "linear-gradient(90deg,#34d399,#10b981)" : "linear-gradient(90deg,#60a5fa,#818cf8)", transition: "width 0.4s ease" } })
                  ),
                  h("span", { style: { fontSize: 10, fontWeight: 800, color: "#94a3b8", flexShrink: 0 } }, prog + "/" + def.target)
                )
              ),
              tk.collected
                ? h("span", { style: { fontSize: 11, fontWeight: 900, color: "#4ade80", flexShrink: 0 } }, "✓")
                : ready
                  ? h("button", { onClick: () => collectDailyTask(tk.id), style: {
                      flexShrink: 0, border: "none", cursor: "pointer", borderRadius: 9, padding: "7px 11px",
                      background: "linear-gradient(180deg,#34d399,#059669)", color: "#052e1a",
                      fontSize: 11.5, fontWeight: 900, boxShadow: "0 3px 10px rgba(16,185,129,0.4)",
                      animation: "streakGlow 2s ease infinite"
                    } }, t("tasksCollect"))
                  : h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 } },
                      h("span", { style: { fontSize: 11, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", padding: "3px 8px", borderRadius: 8 } }, "+" + def.gold + " G"),
                      // Material war bisher eine stille Zugabe — jetzt steht sie dran
                      h(MatRow, { vals: TASK_MAT, nurPositive: true, plus: true, size: 9.5, gap: 5 })
                    )
            );
          })
        ),
        allDone && h("div", { style: { fontSize: 11.5, color: "#4ade80", fontWeight: 700, textAlign: "center", margin: "6px 0 2px" } }, t("tasksAllDone")),
        h("button", { onClick: () => setShowTasksModal(false), style: {
          width: "100%", marginTop: 10, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
          borderRadius: 12, padding: "10px", background: "rgba(255,255,255,0.06)",
          color: "#cbd5e1", fontSize: 13, fontWeight: 700
        } }, t("close"))
      )
    );
  })(),
  // ── Gold-Shop-Modal (v3.23.0, SPEC 14.4) ──
  showGoldShop && (() => {
    const h = React.createElement;
    const cos = cosOf(profile);
    const gold = typeof (profile && profile.gold) === "number" ? profile.gold : 100;
    const preview = (cat, it) => {
      // Kanonen-Vorschau (v3.45.0): zeichnet das ECHTE Modell in ein Mini-Canvas,
      // damit im Shop sichtbar ist, was man bekommt — statt eines Farbpunkts.
      if (cat === "cannon") return h("canvas", {
        width: 76, height: 76,
        style: { width: 38, height: 38, display: "block" },
        ref: (el) => {
          if (!el || el.__drawn === it.id) return;
          el.__drawn = it.id;
          const c2 = el.getContext("2d");
          c2.clearRect(0, 0, 76, 76);
          c2.save();
          c2.translate(38, 38);
          c2.scale(0.78, 0.78);
          c2.translate(-38, -38);
          try {
            drawCannonFull(c2, 38, 38, -0.6, 1, 1, 3000,
              it.id === "cannon_standard" ? null : it.id,
              it.id === "cannon_standard" ? null : CANNON_SKIN[it.id]);
          } catch (e) {}
          c2.restore();
        }
      });
      if (cat === "trail") return h("div", { style: {
        width: 26, height: 26, borderRadius: "50%",
        background: TRAIL_COLOR[it.id] || "#93a4bd",
        boxShadow: TRAIL_COLOR[it.id] ? "0 0 10px " + TRAIL_COLOR[it.id] : "none"
      } });
      if (cat === "frame") { const fr = FRAME_STYLE[it.id]; return h("div", { style: {
        width: 26, height: 26, borderRadius: "50%",
        border: fr ? "3px solid " + fr.c : "2px dashed rgba(255,255,255,0.25)",
        boxShadow: fr ? "0 0 10px " + fr.glow : "none",
        boxSizing: "border-box"
      } }); }
      const wi = WIN_ICON[it.id] || WIN_ICON.win_confetti;
      return h("div", { style: {
        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.07)", boxShadow: "0 0 10px " + wi.c + "55"
      } }, h(Icon, { name: wi.name, size: 16, color: wi.c }));
    };
    const section = (cat, label) => h("div", { key: cat, style: { marginBottom: 13 } },
      h("div", { style: { fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7, textAlign: "left" } }, label),
      h("div", { style: { display: "flex", gap: 6 } },
        COSMETICS[cat].map((it) => {
          const owned = cosmeticOwned(cos, it);
          const equipped = cos.equipped[cat] === it.id;
          const afford = gold >= it.price;
          const clickable = equipped ? false : (owned || afford);
          // Kauf-Bestätigung (v3.26.2): Besessenes wird direkt angelegt (gratis),
          // unbesessene Artikel öffnen erst den Bestätigungsdialog.
          return h("button", { key: it.id, onClick: () => owned ? buyOrEquipCosmetic(cat, it) : setConfirmBuy({ cat, item: it }), disabled: !clickable && !equipped, style: {
            flex: 1, minWidth: 0, border: "none", borderRadius: 12, padding: "9px 2px 7px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            cursor: clickable ? "pointer" : "default",
            background: equipped ? "linear-gradient(180deg, rgba(52,211,153,0.2), rgba(10,14,24,0.6))" : owned ? "rgba(255,255,255,0.07)" : afford ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
            boxShadow: equipped ? "inset 0 0 0 1.5px rgba(52,211,153,0.7)" : "inset 0 0 0 1px rgba(255,255,255,0.09)",
            opacity: !owned && !afford ? 0.55 : 1
          } },
            preview(cat, it),
            h("span", { style: { fontSize: 8.5, fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, t("cos_" + it.id)),
            equipped
              ? h("span", { style: { fontSize: 8, fontWeight: 900, color: "#34d399" } }, t("cosEquipped"))
              : owned
                ? h("span", { style: { fontSize: 8, fontWeight: 800, color: "#94a3b8" } }, t("cosOwned"))
                : h("span", { style: { fontSize: 9, fontWeight: 900, color: afford ? "#fcd34d" : "#64748b" } }, it.price + " G")
          );
        })
      )
    );
    return h("div", { onClick: () => { setConfirmBuy(null); setShowGoldShop(false); }, style: {
      position: "fixed", inset: 0, zIndex: 1450, background: "rgba(2,6,15,0.9)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 18px) calc(var(--sa-right,0px) + 18px) calc(var(--sa-bottom,0px) + 18px) calc(var(--sa-left,0px) + 18px)"
    } },
      h("div", { onClick: (e) => e.stopPropagation(), style: {
        maxWidth: 420, width: "100%", maxHeight: "88vh", overflowY: "auto",
        background: "linear-gradient(180deg, rgba(30,41,66,0.98) 0%, rgba(11,16,30,0.99) 100%)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "18px 16px 16px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)",
        animation: "dailyBounceIn 0.4s cubic-bezier(.36,1.5,.56,1) both"
      } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            h(Icon, { name: "shoppingCart", size: 17, color: "#fbbf24" }),
            h("div", { style: { fontSize: 16, fontWeight: 900, color: "#f1f5f9" } }, t("goldShopTitle"))
          ),
          h("div", { style: {
            display: "flex", alignItems: "center", gap: 4, padding: "3px 12px 3px 9px",
            background: "linear-gradient(180deg,#fde68a 0%,#f59e0b 100%)", borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 2px 9px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.7)"
          } }, h("span", { style: { fontSize: 13, fontWeight: 900, color: "#3b2606" } }, gold + " G"))
        ),
        h("div", { style: { fontSize: 11.5, color: "#64748b", marginBottom: 14, textAlign: "left" } }, t("goldShopSub")),
        section("cannon", t("cosSectionCannon")),
        section("trail", t("cosSectionTrail")),
        section("frame", t("cosSectionFrame")),
        section("win", t("cosSectionWin")),
        h("button", { onClick: () => { setConfirmBuy(null); setShowGoldShop(false); }, style: {
          width: "100%", marginTop: 4, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
          borderRadius: 12, padding: "10px", background: "rgba(255,255,255,0.06)",
          color: "#cbd5e1", fontSize: 13, fontWeight: 700
        } }, t("close"))
      ),
      // ── Kauf-Bestätigung (v3.26.2): Overlay über dem Shop ──
      confirmBuy && (() => {
        const it = confirmBuy.item, cat = confirmBuy.cat;
        const canPay = gold >= it.price;
        return h("div", { onClick: (e) => { e.stopPropagation(); setConfirmBuy(null); }, style: {
          position: "fixed", inset: 0, zIndex: 1470, background: "rgba(2,6,15,0.75)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 24px) calc(var(--sa-right,0px) + 24px) calc(var(--sa-bottom,0px) + 24px) calc(var(--sa-left,0px) + 24px)"
        } },
          h("div", { onClick: (e) => e.stopPropagation(), style: {
            maxWidth: 320, width: "100%", textAlign: "center",
            background: "linear-gradient(180deg, rgba(38,50,78,0.99) 0%, rgba(13,18,33,0.99) 100%)",
            border: "1px solid rgba(251,191,36,0.35)", borderRadius: 18, padding: "20px 18px 16px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.12)",
            animation: "dailyBounceIn 0.32s cubic-bezier(.36,1.5,.56,1) both"
          } },
            h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 10 } }, preview(cat, it)),
            h("div", { style: { fontSize: 15, fontWeight: 900, color: "#f1f5f9", marginBottom: 3 } }, t("cos_" + it.id)),
            h("div", { style: { fontSize: 12, color: "#94a3b8", marginBottom: 12 } }, t("confirmBuyQuestion")),
            h("div", { style: {
              display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 15,
              padding: "8px 10px", borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)"
            } },
              h("div", null,
                h("div", { style: { fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" } }, t("confirmBuyPrice")),
                h("div", { style: { fontSize: 15, fontWeight: 900, color: "#fcd34d" } }, it.price + " G")
              ),
              h("div", { style: { width: 1, height: 26, background: "rgba(255,255,255,0.1)" } }),
              h("div", null,
                h("div", { style: { fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" } }, t("confirmBuyAfter")),
                h("div", { style: { fontSize: 15, fontWeight: 900, color: canPay ? "#e2e8f0" : "#ef4444" } }, (gold - it.price) + " G")
              )
            ),
            h("button", { onClick: () => { buyOrEquipCosmetic(cat, it); setConfirmBuy(null); }, disabled: !canPay, style: {
              width: "100%", border: "none", cursor: canPay ? "pointer" : "default", borderRadius: 12, padding: "12px",
              background: canPay ? "linear-gradient(180deg,#fde68a,#f59e0b)" : "rgba(255,255,255,0.06)",
              color: canPay ? "#3b2606" : "#64748b", fontSize: 14, fontWeight: 900, letterSpacing: "0.03em",
              boxShadow: canPay ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 14px rgba(245,158,11,0.4)" : "none",
              marginBottom: 8
            } }, "✓ " + t("confirmBuyYes")),
            h("button", { onClick: () => setConfirmBuy(null), style: {
              width: "100%", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
              borderRadius: 12, padding: "10px", background: "rgba(255,255,255,0.05)",
              color: "#cbd5e1", fontSize: 13, fontWeight: 700
            } }, t("cancel"))
          )
        );
      })()
    );
  })(), showForge && (() => {
    const h = React.createElement;
    const cos = cosOf(profile);
    const mats = matOf(profile);
    const gold = typeof (profile && profile.gold) === "number" ? profile.gold : 100;
    // Vorschau je Kategorie (CSS, keine Canvas-Kosten)
    const preview = (rec) => {
      if (rec.cat === "cannon") {
        const sk = CANNON_SKIN[rec.id];
        // Echtes Geschuetz-Modell (v3.46.0): vorher eine Farbkugel - dieselbe
        // Kugel fuer alle Skins, dadurch war im Crafting nicht erkennbar, WAS
        // man bekommt. Jetzt identisch zum Gold-Shop das gerenderte Modell.
        return h("canvas", {
          width: 80, height: 80,
          style: { width: 40, height: 40, display: "block", flexShrink: 0 },
          ref: (el) => {
            if (!el || el.__drawn === rec.id) return;
            el.__drawn = rec.id;
            const c2 = el.getContext("2d");
            c2.clearRect(0, 0, 80, 80);
            c2.save();
            c2.translate(40, 40); c2.scale(0.8, 0.8); c2.translate(-40, -40);
            try { drawCannonFull(c2, 40, 40, -0.6, 1, 1, 3000, rec.id, sk); } catch (e) {}
            c2.restore();
          }
        });
      }
      if (rec.cat === "impact") {
        const fx = IMPACT_FX[rec.id];
        // Einschlag-Vorschau (v3.46.0): zeichnet Druckwelle + Truemmer + Kernglut
        // in der Palette des Effekts, statt nur eines Farbverlaufs.
        return h("canvas", {
          width: 80, height: 80,
          style: { width: 40, height: 40, display: "block", flexShrink: 0 },
          ref: (el) => {
            if (!el || el.__drawn === rec.id) return;
            el.__drawn = rec.id;
            const c2 = el.getContext("2d");
            const R = fx.ring, P = fx.p || [];
            c2.clearRect(0, 0, 80, 80);
            const g2 = c2.createRadialGradient(40, 40, 0, 40, 40, 30);
            g2.addColorStop(0, "rgba(" + R[0] + ",1)");
            g2.addColorStop(0.32, "rgba(" + R[1] + ",0.92)");
            g2.addColorStop(0.68, "rgba(" + R[2] + ",0.5)");
            g2.addColorStop(1, "rgba(0,0,0,0)");
            c2.fillStyle = g2;
            c2.beginPath(); c2.arc(40, 40, 30, 0, Math.PI * 2); c2.fill();
            c2.strokeStyle = "rgba(" + R[0] + ",0.9)"; c2.lineWidth = 2.4;
            c2.beginPath(); c2.arc(40, 40, 21, 0, Math.PI * 2); c2.stroke();
            c2.strokeStyle = "rgba(" + R[1] + ",0.65)"; c2.lineWidth = 1.6;
            c2.beginPath(); c2.arc(40, 40, 30, 0, Math.PI * 2); c2.stroke();
            for (let d = 0; d < 8; d++) {
              const a = d / 8 * Math.PI * 2 + 0.4, dd = 20 + (d % 3) * 6;
              c2.save(); c2.translate(40 + Math.cos(a) * dd, 40 + Math.sin(a) * dd); c2.rotate(a);
              c2.fillStyle = P[d % P.length] || "rgba(" + R[1] + ",1)";
              c2.fillRect(-2.4, -2.4, 4.8, 4.8); c2.restore();
            }
          }
        });
      }
      const pal = MASTER_TRAIL[rec.id] || [];
      return h("div", { style: { display: "flex", alignItems: "center", gap: 3, width: 30, flexShrink: 0 } },
        pal.map((c, i) => h("span", { key: i, style: { width: 6 + i * 2.4, height: 6 + i * 2.4, borderRadius: "50%", background: c, boxShadow: "0 0 " + (3 + i * 2) + "px " + c } }))
      );
    };
    const matChip = (k, n, need) => h("span", { key: k, style: {
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999,
      background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
      fontSize: 10.5, fontWeight: 800, color: need !== void 0 && need > (mats[k] || 0) ? "#f87171" : "#e2e8f0", whiteSpace: "nowrap"
    } },
      h("span", { style: { width: 8, height: 8, background: MAT_META[k].c, transform: "rotate(45deg)", borderRadius: 2, boxShadow: "0 0 5px " + MAT_META[k].c, flexShrink: 0 } }),
      // Fehlt etwas, steht der Fortschritt dran (v3.68.0) — "2/5" sagt, wie weit
      // man ist; die nackte Zahl 5 sagte nur, dass es nicht reicht.
      need === void 0 ? (mats[k] || 0)
        : need > (mats[k] || 0) ? (mats[k] || 0) + "/" + need
        : need
    );
    const goldChip = (n, short) => h("span", { style: {
      display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 999,
      background: "rgba(0,0,0,0.35)", border: "1px solid rgba(251,191,36,0.3)",
      fontSize: 10.5, fontWeight: 800, color: n > gold ? "#f87171" : "#fcd34d", whiteSpace: "nowrap"
    } }, h(Icon, { name: "coins", size: 10, color: "#fbbf24" }), n);
    const stdCard = (cat) => {
      const std = cat === "cannon" ? "cannon_standard" : "impact_standard";
      const isEq = cos.equipped[cat] === std;
      return h("button", { key: std, onClick: () => unequipForgeCat(cat), style: {
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        border: isEq ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "8px 11px", cursor: isEq ? "default" : "pointer",
        background: isEq ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.035)", marginBottom: 6
      } },
        // Auch die Standard-Zeile zeigt das ECHTE Modell (v3.46.0) — sonst
        // bleibt genau die Zeile eine Farbkugel, gegen die man vergleicht.
        h("canvas", { width: 80, height: 80, style: { width: 40, height: 40, display: "block", flexShrink: 0 },
          ref: (el) => {
            if (!el || el.__drawn === cat) return;
            el.__drawn = cat;
            const c2 = el.getContext("2d");
            c2.clearRect(0, 0, 80, 80);
            if (cat === "cannon") {
              c2.save(); c2.translate(40, 40); c2.scale(0.8, 0.8); c2.translate(-40, -40);
              try { drawCannonFull(c2, 40, 40, -0.6, 1, 1, 3000, null, null); } catch (e) {}
              c2.restore();
            } else {
              const g2 = c2.createRadialGradient(40, 40, 0, 40, 40, 28);
              g2.addColorStop(0, "rgba(255,255,210,1)");
              g2.addColorStop(0.35, "rgba(251,191,36,0.9)");
              g2.addColorStop(0.7, "rgba(239,68,68,0.45)");
              g2.addColorStop(1, "rgba(0,0,0,0)");
              c2.fillStyle = g2; c2.beginPath(); c2.arc(40, 40, 28, 0, Math.PI * 2); c2.fill();
              c2.strokeStyle = "rgba(255,255,210,0.8)"; c2.lineWidth = 2;
              c2.beginPath(); c2.arc(40, 40, 20, 0, Math.PI * 2); c2.stroke();
            }
          }
        }),
        h("div", { style: { flex: 1, fontSize: 12.5, fontWeight: 800, color: "#cbd5e1" } }, t("forgeStandard")),
        isEq
          ? h("span", { style: { fontSize: 10, fontWeight: 900, color: "#4ade80", whiteSpace: "nowrap" } }, t("forgeEquipped"))
          : h("span", { style: { fontSize: 10.5, fontWeight: 800, color: "#93c5fd", whiteSpace: "nowrap" } }, t("forgeEquip"))
      );
    };
    const recipeCard = (rec) => {
      const owned = cos.owned.includes(rec.id);
      const isEq = cos.equipped[rec.cat] === rec.id;
      const needsBase = !!(rec.base && !cos.owned.includes(rec.base));
      const afford = canCraft(rec);
      return h("button", { key: rec.id, onClick: () => {
        if (isEq) return;
        if (owned) { craftOrEquip(rec); return; }
        if (afford) setConfirmCraft(rec);
      }, disabled: isEq || (!owned && !afford), style: {
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        border: isEq ? "1px solid rgba(74,222,128,0.5)" : owned ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "8px 11px", cursor: isEq || (!owned && !afford) ? "default" : "pointer",
        background: isEq ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.035)",
        opacity: !owned && !afford ? 0.6 : 1, marginBottom: 6
      } },
        preview(rec),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontSize: 12.5, fontWeight: 800, color: "#f1f5f9", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t("cos_" + rec.id)),
          owned ? null : needsBase
            ? h("div", { style: { fontSize: 9.5, color: "#f59e0b", display: "flex", alignItems: "center", gap: 4 } }, h(Icon, { name: "lock", size: 9 }), t("forgeNeedsBase"))
            : h("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
                MAT_ORDER.filter((k) => rec.cost[k]).map((k) => matChip(k, null, rec.cost[k])),
                rec.cost.gold ? goldChip(rec.cost.gold) : null
              )
        ),
        isEq
          ? h("span", { style: { fontSize: 10, fontWeight: 900, color: "#4ade80", whiteSpace: "nowrap" } }, t("forgeEquipped"))
          : owned
            ? h("span", { style: { fontSize: 10.5, fontWeight: 800, color: "#93c5fd", whiteSpace: "nowrap" } }, t("forgeEquip"))
            : h("span", { style: {
                // Massiver Button statt Umriss-Chip (v3.46.0): Schmieden ist die
                // teuerste Aktion im Spiel und sah aus wie ein passives Label.
                // Metallfassung + Glanzkante, gleiche Sprache wie die Shop-Plaketten.
                fontSize: 11, fontWeight: 900, letterSpacing: "0.02em",
                color: afford ? "#2a1705" : "#64748b",
                border: afford ? "1px solid rgba(255,255,255,0.45)" : "1px solid rgba(255,255,255,0.1)",
                padding: "5px 13px", borderRadius: 999, whiteSpace: "nowrap",
                background: afford
                  ? "linear-gradient(180deg,#fdba74 0%,#f97316 55%,#c2410c 100%)"
                  : "rgba(255,255,255,0.04)",
                boxShadow: afford
                  ? "inset 0 1.5px 0 rgba(255,255,255,0.6), inset 0 -2px 4px rgba(120,53,15,0.5), 0 3px 9px rgba(249,115,22,0.45)"
                  : "none",
                textShadow: afford ? "0 1px 0 rgba(255,255,255,0.35)" : "none"
              } }, t("forgeCraft"))
      );
    };
    const section = (cat, label) => h("div", { key: cat, style: { marginBottom: 12 } },
      h("div", { style: { fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, textAlign: "left" } }, label),
      cat !== "trail" ? stdCard(cat) : null,
      RECIPES.filter((r) => r.cat === cat).map(recipeCard)
    );
    return h("div", { key: "forgeModal", onClick: () => { setShowForge(false); setConfirmCraft(null); }, style: {
      position: "fixed", inset: 0, zIndex: 1150, background: "rgba(2,6,15,0.92)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 14px) calc(var(--sa-right,0px) + 14px) calc(var(--sa-bottom,0px) + 14px) calc(var(--sa-left,0px) + 14px)"
    } },
      h("div", { onClick: (e) => e.stopPropagation(), style: {
        maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto",
        background: "linear-gradient(180deg, rgba(40,26,12,0.98) 0%, rgba(12,10,18,0.99) 100%)",
        border: "1px solid rgba(251,146,60,0.25)", borderRadius: 20, padding: "16px 14px 13px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
        animation: "dailyBounceIn 0.4s cubic-bezier(.36,1.5,.56,1) both", textAlign: "left"
      } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            h(Icon, { name: "hammer", size: 18, color: "#fdba74" }),
            h("div", { style: { fontSize: 16, fontWeight: 900, color: "#fdba74" } }, t("forgeTitle"))
          ),
          h("div", { style: {
            display: "flex", alignItems: "center", gap: 4, padding: "3px 11px 3px 8px",
            background: "linear-gradient(180deg,#fde68a 0%,#f59e0b 100%)", borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 9px rgba(245,158,11,0.45)"
          } }, h(Icon, { name: "coins", size: 13, color: "#3b2606" }), h("span", { style: { fontSize: 13, fontWeight: 900, color: "#3b2606" } }, gold))
        ),
        h("div", { style: { fontSize: 11, color: "#94a3b8", marginBottom: 11, lineHeight: 1.4 } }, t("forgeSub")),
        h("div", { style: { marginBottom: 12, padding: "8px 10px", borderRadius: 12, background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.18)" } },
          h("div", { style: { fontSize: 9.5, fontWeight: 800, color: "#fdba74", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 } }, t("forgeMats")),
          h("div", { style: { display: "flex", gap: 5, flexWrap: "wrap" } },
            MAT_ORDER.map((k) => h("span", { key: k, title: t("mat_" + k), style: {
              display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
              background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 11, fontWeight: 900, color: "#e2e8f0"
            } },
              h("span", { style: { width: 9, height: 9, background: MAT_META[k].c, transform: "rotate(45deg)", borderRadius: 2, boxShadow: "0 0 6px " + MAT_META[k].c } }),
              mats[k] || 0
            ))
          ),
          h("div", { style: { fontSize: 9, color: "#64748b", marginTop: 6, lineHeight: 1.45 } }, t("forgeHowTo")),
          // Klartext, wie viele Rezepte gerade drin sind (v3.68.0)
          h("div", { style: {
            fontSize: 10, fontWeight: 800, marginTop: 5,
            color: forgeReadyN > 0 ? "#fdba74" : "#475569"
          } }, forgeReadyN > 0 ? forgeReadyN + " " + t("forgeReady") : t("forgeNothing"))
        ),
        section("cannon", t("forgeCatCannon")),
        section("impact", t("forgeCatImpact")),
        section("trail", t("forgeCatTrail")),
        h("button", { onClick: () => setShowForge(false), style: {
          width: "100%", cursor: "pointer", borderRadius: 12, padding: "11px", marginTop: 2,
          background: "rgba(255,255,255,0.08)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.14)",
          fontSize: 13.5, fontWeight: 800
        } }, t("shopInfoClose")),
        // Schmiede-Bestätigung (analog Kauf-Bestätigung v3.26.2)
        confirmCraft && (() => {
          const rec = confirmCraft;
          return h("div", { onClick: () => setConfirmCraft(null), style: {
            position: "fixed", inset: 0, zIndex: 1250, background: "rgba(2,6,15,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 22px) calc(var(--sa-right,0px) + 22px) calc(var(--sa-bottom,0px) + 22px) calc(var(--sa-left,0px) + 22px)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)"
          } },
            h("div", { onClick: (e) => e.stopPropagation(), style: {
              maxWidth: 330, width: "100%", background: "linear-gradient(180deg, rgba(48,30,12,0.99), rgba(14,11,20,0.99))",
              border: "1px solid rgba(251,146,60,0.35)", borderRadius: 18, padding: "18px 16px",
              boxShadow: "0 20px 55px rgba(0,0,0,0.75)", textAlign: "center",
              animation: "dailyBounceIn 0.3s cubic-bezier(.36,1.5,.56,1) both"
            } },
              h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 8 } }, preview(rec)),
              h("div", { style: { fontSize: 15, fontWeight: 900, color: "#f1f5f9", marginBottom: 3 } }, t("cos_" + rec.id)),
              h("div", { style: { fontSize: 12, fontWeight: 800, color: "#fdba74", marginBottom: 10 } }, t("confirmCraftTitle")),
              h("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 } },
                MAT_ORDER.filter((k) => rec.cost[k]).map((k) => matChip(k, null, rec.cost[k])),
                rec.cost.gold ? goldChip(rec.cost.gold) : null
              ),
              h("button", { onClick: () => { craftOrEquip(rec); setConfirmCraft(null); }, style: {
                width: "100%", border: "none", cursor: "pointer", borderRadius: 12, padding: "12px",
                background: "linear-gradient(180deg,#fdba74,#ea580c)", color: "#2b1204",
                fontSize: 14, fontWeight: 900, letterSpacing: "0.03em", marginBottom: 8,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 14px rgba(234,88,12,0.4)"
              } }, "✓ " + t("confirmCraftYes")),
              h("button", { onClick: () => setConfirmCraft(null), style: {
                width: "100%", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                borderRadius: 12, padding: "10px", background: "rgba(255,255,255,0.05)",
                color: "#cbd5e1", fontSize: 13, fontWeight: 700
              } }, t("cancel"))
            )
          );
        })()
      )
    );
  })(), connLost && online.current && screen === "game" && /* @__PURE__ */ React.createElement("div", {
    style: { position: "fixed", top: "calc(var(--sa-top, 0px) + 8px)", left: 8, right: 8, zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, pointerEvents: "none" }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, background: "rgba(30,16,8,0.94)", border: "1px solid rgba(251,146,60,0.5)", borderRadius: 12, padding: "9px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", animation: "urgencyPulse 1.6s ease infinite", maxWidth: 460 }
  },
    /* @__PURE__ */ React.createElement("div", { style: { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(251,146,60,0.35)", borderTopColor: "#fb923c", animation: "radarSpin 0.8s linear infinite", flexShrink: 0 } }),
    /* @__PURE__ */ React.createElement("div", { style: { textAlign: "left", minWidth: 0 } },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: "#fdba74", lineHeight: 1.2 } }, t('connLostTitle')),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#fed7aa", opacity: 0.85, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t('connLostSub'))
    ),
    /* @__PURE__ */ React.createElement("button", {
      onClick: () => {
        lastStateAt.current = Date.now();
        resubAttempted.current = false;
        pushFails.current = 0;
        if (myRole.current === 1) pushState(true); else resubscribeGuestState();
      },
      style: { flexShrink: 0, background: "rgba(251,146,60,0.18)", border: "1px solid rgba(251,146,60,0.5)", color: "#fdba74", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }
    }, t('connReconnect'))
  )),
  // Gegner-Herzschlag ausgeblieben (v3.70.0). Eigenes Verbindungsproblem hat
  // Vorrang — sonst stünden zwei Banner übereinander und das falsche würde
  // dem Gegner die Schuld geben.
  oppLost && !connLost && online.current && screen === "game" && /* @__PURE__ */ React.createElement("div", {
    style: { position: "fixed", top: "calc(var(--sa-top, 0px) + 8px)", left: 8, right: 8, zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, background: "rgba(40,10,10,0.94)", border: "1px solid rgba(248,113,113,0.5)", borderRadius: 12, padding: "9px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", animation: "urgencyPulse 1.6s ease infinite", maxWidth: 460 }
  },
    /* @__PURE__ */ React.createElement("div", { style: { width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(248,113,113,0.35)", borderTopColor: "#f87171", animation: "radarSpin 0.8s linear infinite", flexShrink: 0 } }),
    /* @__PURE__ */ React.createElement("div", { style: { textAlign: "left", minWidth: 0 } },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: "#fca5a5", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t('oppLostTitle', { name: oppLost })),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#fecaca", opacity: 0.85, lineHeight: 1.25 } }, t('oppLostSub'))
    )
  )), showOnboarding && React.createElement(OnboardingModal, { t,
    step: onboardStep,
    setStep: setOnboardStep,
    onFinish: finishOnboarding
  }), showAchievements && React.createElement(AchievementsModal, { t, achTitle, achDesc,
    profile: profile,
    onClose: () => setShowAchievements(false)
  }), achievementQueue.length > 0 && React.createElement(AchievementPopup, { achTitle,
    key: achievementQueue[0].id + "_popup",
    item: achievementQueue[0],
    onDone: () => setAchievementQueue(function(prev) { return prev.slice(1); })
  }), craftReveal && React.createElement(ItemRevealModal, { t,
    key: "reveal_" + craftReveal.id,
    rec: craftReveal,
    onClose: () => setCraftReveal(null)
  }), mpScreen && /* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,15,0.78)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1e3,
    padding: 20
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(165deg, rgba(16,32,54,0.85), rgba(8,18,37,0.9))",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 28,
    maxWidth: 380,
    width: "100%",
    textAlign: "center",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)"
  } }, mpScreen === "local" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10, color: "#a78bfa", display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(Icon, { name: "users", size: 30 })), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 4px", fontSize: 22 } }, t('localTitle')), /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 13, marginBottom: 20 } }, t('localSub')), /* @__PURE__ */ React.createElement("button", { onClick: () => startGuidedTutorial(), style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg,#7c3aed,#db2777)",
    color: "white",
    border: "1px solid rgba(219,39,119,0.5)",
    padding: "16px",
    fontSize: 16,
    fontWeight: 800,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 10,
    letterSpacing: "0.03em",
    boxShadow: "0 6px 26px rgba(124,58,237,0.3)"
  } }, React.createElement(Icon, { name: "gradCap", size: 16, style: { verticalAlign: "-3px", marginRight: 7 } }), t('guidedTutorial')), /* @__PURE__ */ React.createElement("button", { onClick: () => setBotSelect((s) => !s), style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg,#0891b2,#16a34a)",
    color: "white",
    border: "1px solid rgba(34,197,94,0.5)",
    padding: "16px",
    fontSize: 16,
    fontWeight: 800,
    borderRadius: botSelect ? "14px 14px 0 0" : 14,
    cursor: "pointer",
    marginBottom: botSelect ? 0 : 10,
    letterSpacing: "0.03em",
    boxShadow: "0 6px 26px rgba(8,145,178,0.3)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "target", size: 18 }), t('vsBot')), botSelect && /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex", gap: 6, marginBottom: 10, padding: "8px",
    background: "rgba(8,145,178,0.12)", border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "0 0 14px 14px", borderTop: "none"
  } }, [
    { k: "easy", icon: "moon", label: t('botLvlEasy') },
    { k: "mid", icon: "swords", label: t('botLvlMid') },
    { k: "hard", icon: "skull", label: t('botLvlHard') }
  ].map((lv) => /* @__PURE__ */ React.createElement("button", { key: lv.k, onClick: () => {
    // Aktive Wahl startet das Spiel — bewusst KEINE Hervorhebung/Persistenz
    // einer Stufe (v3.29.0): nichts ist vordefiniert.
    botLevel.current = lv.k;
    setBotSelect(false);
    online.current = false;
    botMode.current = true;
    tutorialMode.current = false;
    initBotMatchIdentity();
    numPlayersRef.current = 2;
    setNumPlayers(2);
    setMpScreen(null);
    fullReset();
  }, style: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    background: "rgba(255,255,255,0.06)",
    color: "white", border: "1px solid rgba(255,255,255,0.12)",
    padding: "10px 4px", fontSize: 13, fontWeight: 800, borderRadius: 10, cursor: "pointer"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: lv.icon, size: 17 }), lv.label))), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    online.current = false;
    botMode.current = false;
    numPlayersRef.current = 2;
    setNumPlayers(2);
    setMpScreen(null);
    fullReset();
  }, style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    border: "1px solid rgba(124,58,237,0.5)",
    padding: "16px",
    fontSize: 16,
    fontWeight: 800,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 10,
    letterSpacing: "0.03em",
    boxShadow: "0 6px 26px rgba(59,130,246,0.3)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "swords", size: 18 }), t('local2p')), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    online.current = false;
    botMode.current = false;
    numPlayersRef.current = 3;
    setNumPlayers(3);
    setMpScreen(null);
    fullReset();
  }, style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg,#7c3aed,#0891b2)",
    color: "white",
    border: "1px solid rgba(124,58,237,0.5)",
    padding: "16px",
    fontSize: 16,
    fontWeight: 800,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 16,
    letterSpacing: "0.03em",
    boxShadow: "0 6px 26px rgba(124,58,237,0.3)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "crown", size: 18 }), t('local3p')), /* @__PURE__ */ React.createElement("button", { onClick: () => setMpScreen(null), style: {
    width: "100%",
    background: "transparent",
    color: "#64748b",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "12px",
    fontSize: 14,
    borderRadius: 12,
    cursor: "pointer"
  } }, t('back'))), mpScreen === "online" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10, color: "#22d3ee", display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(Icon, { name: "globe", size: 30 })), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 4px", fontSize: 22 } }, t('onlineTitle')), /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 13, marginBottom: 20 } }, t('onlineSubtitle')), /* @__PURE__ */ React.createElement("div", { "data-netz": "1", style: { fontSize: 11, lineHeight: 1.6, marginBottom: 14, padding: "8px 10px", borderRadius: 8, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.6)", color: netzInfo && netzInfo.sdk && typeof netzInfo.lesen === "number" ? "#64748b" : "#f59e0b", letterSpacing: "0.02em" } }, netzInfo === null ? t('netzPruefe') : [t('netzLabel'), ": ", netzInfo.sdk ? "SDK \u2713" : "SDK \u2717", " \u00B7 ", netzInfo.uid ? netzInfo.uid : t('netzKeineAnmeldung'), " \u00B7 ", typeof netzInfo.lesen === "number" ? netzInfo.lesen + " ms" : t('netzKeineVerbindung'), netzInfo.online === false ? " \u00B7 navigator.onLine=false" : "", netzInfo.authFehler ? " \u00B7 " + netzInfo.authFehler : "", netzInfo.bootFehler ? " \u00B7 " + netzInfo.bootFehler : ""].join("")), !MP_CONFIGURED && /* @__PURE__ */ React.createElement("div", { style: {
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    color: "#fbbf24",
    marginBottom: 16,
    lineHeight: 1.5
  } }, t('fbMissing')), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#64748b", textAlign: "left", marginBottom: 6 } }, t('playerCount')), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } }, [2, 3].map((m) => /* @__PURE__ */ React.createElement("button", { key: m, onClick: () => {
    numPlayersRef.current = m;
    setNumPlayers(m);
  }, style: {
    flex: 1,
    padding: "11px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    background: numPlayers === m ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.05)",
    color: numPlayers === m ? "#67e8f9" : "#94a3b8",
    border: numPlayers === m ? "1px solid rgba(34,211,238,0.55)" : "1px solid rgba(255,255,255,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  } }, /* @__PURE__ */ React.createElement(Icon, { name: m === 2 ? "swords" : "crown", size: 15 }), m === 2 ? t('local2p') : t('online3p')))), /* @__PURE__ */ React.createElement("button", { onClick: () => startMatchmaking(numPlayers), style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "linear-gradient(135deg,#f59e0b,#ec4899)",
    color: "white",
    border: "1px solid rgba(236,72,153,0.5)",
    padding: "16px",
    fontSize: 16,
    fontWeight: 800,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 8,
    letterSpacing: "0.03em",
    boxShadow: "0 6px 26px rgba(245,158,11,0.3)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "zap", size: 19 }), t('quickMatchBtn', { n: numPlayers })), /* @__PURE__ */ React.createElement("p", { style: { color: "#475569", fontSize: 11, marginBottom: 18 } }, t('quickMatchSub')), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: 1, background: "rgba(255,255,255,0.1)" } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#475569" } }, t('orDivider')), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, height: 1, background: "rgba(255,255,255,0.1)" } })), /* @__PURE__ */ React.createElement("button", { onClick: hostCreateGame, style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    background: "linear-gradient(135deg,#2563eb,#0891b2)",
    color: "white",
    border: "1px solid rgba(8,145,178,0.5)",
    padding: "15px",
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 10,
    boxShadow: "0 4px 20px rgba(37,99,235,0.25)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 17 }), `${t('createGame', {n: numPlayers})}`), /* @__PURE__ */ React.createElement("button", { onClick: () => setMpScreen("joining"), style: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 16
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "key", size: 16 }), t('joinGameBtn')), mpError && /* @__PURE__ */ React.createElement("div", { style: { color: "#f87171", fontSize: 12, marginBottom: 10 } }, mpError), /* @__PURE__ */ React.createElement("button", { onClick: leaveOnline, style: {
    background: "transparent",
    color: "#64748b",
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline"
  } }, t('back'))), mpScreen === "matchmaking" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
    width: 52,
    height: 52,
    marginBottom: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "radarSpin 3s linear infinite",
    filter: "drop-shadow(0 0 10px rgba(34,211,238,0.85))"
  } }, React.createElement(Icon, { name: "target", size: 48, color: "#22d3ee" })), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 6px", fontSize: 20 } }, t('searchingOpponent')), /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 13, marginBottom: 6 } }, t('searchingSince', { s: mmElapsed })), /* @__PURE__ */ React.createElement("p", { style: { color: "#334155", fontSize: 11, marginBottom: 6 } }, t('searchingRadius', { r: Math.round(mmRadius(mmElapsed)) })), numPlayers === 2 && /* @__PURE__ */ React.createElement("button", {
    // Der Bot war bis v3.79.0 nur ein HINWEIS mit Countdown: "in 47 s spielst
    // du gegen den Bot". Bei zehn aktiven Spielern ist die Schlange fast immer
    // leer, und niemand sieht einem Suchbildschirm 60 Sekunden zu — die Suche
    // war damit eine Sackgasse. Als KNOPF ab Sekunde eins wird daraus eine
    // Wahl: die Suche laeuft weiter, aber niemand muss warten.
    onClick: () => mmBotBackfill(),
    style: {
      width: "100%", maxWidth: 320, marginBottom: 14, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.45)",
      color: "#6ee7b7", borderRadius: 12, padding: "11px", fontSize: 13.5, fontWeight: 800
    }
  }, React.createElement(Icon, { name: "swords", size: 15 }), t('searchingBotNow')), (() => {
    // Tipps-Karussell (v3.26.0): nutzt den laufenden mmElapsed-Ticker —
    // alle 5s der nächste Tipp, kein zusätzlicher Timer.
    const tipIdx = Math.floor(mmElapsed / 5) % 8;
    return /* @__PURE__ */ React.createElement("div", { key: "qtip" + tipIdx, style: {
      marginBottom: 20, padding: "10px 14px", borderRadius: 12, textAlign: "left",
      background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.22)",
      display: "flex", alignItems: "flex-start", gap: 9,
      animation: "badgePop 0.35s ease both"
    } },
      /* @__PURE__ */ React.createElement("span", { style: {
        flexShrink: 0, fontSize: 9, fontWeight: 900, color: "#22d3ee", letterSpacing: "0.12em",
        background: "rgba(34,211,238,0.14)", borderRadius: 6, padding: "3px 7px", marginTop: 1
      } }, React.createElement(Icon, { name: "lightbulb", size: 12, style: { verticalAlign: "-2px", marginRight: 4 } }), t('queueTipLabel')),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#94a3b8", lineHeight: 1.45 } }, t('queueTip_' + tipIdx))
    );
  })(), mpError && /* @__PURE__ */ React.createElement("div", { style: { color: "#f87171", fontSize: 12, marginBottom: 10 } }, mpError), /* @__PURE__ */ React.createElement("button", { onClick: cancelMatchmaking, style: {
    width: "100%",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.15)",
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 10,
    cursor: "pointer"
  } }, t('cancelSearch'))), mpScreen === "joining" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10, color: "#22d3ee", display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(Icon, { name: "key", size: 28 })), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 14px", fontSize: 20 } }, t('enterCode')), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: mpInput,
      onChange: (e) => setMpInput(e.target.value.toUpperCase().slice(0, 6)),
      placeholder: "ABC123",
      style: {
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: "0.3em",
        padding: "12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(0,0,0,0.3)",
        color: "#fff",
        marginBottom: 10,
        fontFamily: "monospace"
      }
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: pasteCode, style: {
    width: "100%",
    background: "rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,0.15)",
    padding: "11px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 10,
    cursor: "pointer",
    marginBottom: 12
  } }, React.createElement(Icon, { name: "clipboard", size: 14, style: { verticalAlign: "-2px", marginRight: 6 } }), t('pasteCode')), pasteError && /* @__PURE__ */ React.createElement("div", { style: { color: "#fbbf24", fontSize: 11, marginBottom: 10 } }, pasteError), /* @__PURE__ */ React.createElement("button", { onClick: guestJoinGame, style: {
    width: "100%",
    background: "linear-gradient(135deg,#059669,#0284c7)",
    color: "white",
    border: "none",
    padding: "15px",
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 10,
    cursor: "pointer",
    marginBottom: 12
  } }, t('join')), mpError && /* @__PURE__ */ React.createElement("div", { style: { color: "#f87171", fontSize: 12, marginBottom: 10 } }, mpError), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setMpScreen("online");
    setMpError("");
  }, style: {
    background: "transparent",
    color: "#64748b",
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline"
  } }, t('back'))), mpScreen === "waiting" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10, color: "#a78bfa", display: "flex", justifyContent: "center", animation: "glowpulse 1.6s ease-in-out infinite" } }, /* @__PURE__ */ React.createElement(Icon, { name: "hourglass", size: 28 })), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 6px", fontSize: 20 } }, myRole.current === 1 ? t('waitingHost') : t('waitingGuest')), myRole.current === 1 && mpCode && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 13, marginBottom: 10 } }, t('shareCode')), /* @__PURE__ */ React.createElement("button", { onClick: copyCode, style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    cursor: "pointer",
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: "0.2em",
    fontFamily: "monospace",
    color: "#4ade80",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(74,222,128,0.3)",
    borderRadius: 10,
    padding: "14px",
    marginBottom: 8
  } }, mpCode, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center", color: codeCopied ? "#4ade80" : "#94a3b8" } }, codeCopied ? /* @__PURE__ */ React.createElement("span", { style: { fontSize: 18 } }, "\u2713") : /* @__PURE__ */ React.createElement(Icon, { name: "copy", size: 17 }))), /* @__PURE__ */ React.createElement("button", { onClick: inviteFriend, style: {
    width: "100%",
    cursor: "pointer",
    marginBottom: 8,
    background: codeCopied ? "rgba(74,222,128,0.15)" : "linear-gradient(135deg,#059669,#0284c7)",
    color: codeCopied ? "#4ade80" : "#fff",
    border: codeCopied ? "1px solid rgba(74,222,128,0.4)" : "none",
    padding: "12px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    transition: "all 0.2s",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8
  } }, codeCopied ? t('copied') : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Icon, { name: "share", size: 16 }), t('inviteFriend'))), /* @__PURE__ */ React.createElement("p", { style: { color: "#334155", fontSize: 11, marginBottom: 18 } }, numPlayers === 3 ? t('waitFor', {count: (joinedGuests.current[2] ? 1 : 0) + (joinedGuests.current[3] ? 1 : 0), total: 2}) : t('gameStartsAuto'))), myRole.current !== 1 && /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 13, marginBottom: 18 } }, t('guestJoined', {n: myRole.current === 2 ? "2 ♚" : "3 ♜"}), /* @__PURE__ */ React.createElement("br", null), t('waitFirstState'), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#334155" } }, t('startsAuto'))), /* @__PURE__ */ React.createElement("button", { onClick: leaveOnline, style: {
    background: "transparent",
    color: "#64748b",
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline"
  } }, t('cancel'))))));
  if (screen === "result") {
    let onlineNextRound2 = function() {
      if (!isHost) return;
      nextRound();
    };
    const info = resultInfo || {};
    const isWin = !!info.winner;
    const isHost = !online.current || myRole.current === 1;
    const iWon = online.current ? info.winner === myRole.current : isWin;
    const drawn = !isWin;
    const wonState = online.current ? iWon : isWin;
    // Spieleridentität für Header-Chip
    const myPI = online.current && playerInfo.current ? playerInfo.current[myRole.current] : null;
    const myName = myPI ? myPI.name : (profile ? profile.name : null);
    const myWap = (myPI ? myPI.wappen : null) || (profile ? profile.wappen : null) || "skelett";
    // Einheitlicher Karten-Stil (ELO / Gold / XP)
    const card = (r, g, b) => ({
      background: "rgba(" + r + "," + g + "," + b + ",0.09)",
      border: "1px solid rgba(" + r + "," + g + "," + b + ",0.28)",
      borderRadius: 14,
      padding: "11px 18px",
      boxShadow: "0 2px 18px rgba(" + r + "," + g + "," + b + ",0.12)",
      textAlign: "center"
    });
    const LABEL = { fontSize: 9, color: "#64748b", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 };
    return React.createElement("div", { className: "gross-schirm", style: {
      background: "radial-gradient(ellipse at 50% 5%,#180f30 0%,#06080f 65%)",
      // Siehe Spiel-Huelle: 100% des bereits verkuerzten Koerpers, nicht 100dvh.
      // "safe center" zentriert nur, SOLANGE der Inhalt passt; wird er hoeher
      // (3 Spieler, Level-Aufstieg, langer Name), rutscht er auf flex-start
      // statt oben aus dem rollbaren Kasten heraus — bei schlichtem "center"
      // waere der obere Teil unerreichbar.
      height: "100%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "safe center",
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      color: "#e2e8f0",
      padding: "14px 18px",
      textAlign: "center",
      overflowY: "auto"
    }},
    // ── SIEGES-EFFEKT (v3.23.0): gekaufter Kosmetik-Effekt bei eigenem Sieg ──
    wonState && !drawn && React.createElement(WinFx, { kind: cosOf(profile).equipped.win }),
    // ── EINMALIGER FARBBLITZ (v3.40.0): dramatischer Einstieg Sieg/Niederlage ──
    !drawn && React.createElement("div", { key: "resflash", className: "kein-zoom", style: {
      position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
      background: wonState ? "rgba(251,191,36,0.55)" : "rgba(239,68,68,0.5)",
      animation: "revealFlash 0.8s ease-out both"
    }}),
    // ── ONLINE + SPIELERNAME CHIP ─────────────────────────────
    online.current && React.createElement("div", { style: {
      fontSize: 11, color: "#4ade80", marginBottom: 14, fontWeight: 700,
      background: "rgba(74,222,128,0.08)", borderRadius: 20, padding: "5px 14px",
      display: "inline-flex", alignItems: "center", gap: 6,
      border: "1px solid rgba(74,222,128,0.2)"
    }},
      React.createElement(Icon, { name: "globe", size: 12, color: "#4ade80" }),
      React.createElement("span", null, "ONLINE"),
      React.createElement("span", { style: { color: "#334155" } }, "\xB7"),
      React.createElement(WappenAvatar, { id: myWap, size: 15 }),
      myName && React.createElement("span", { style: { color: "#cbd5e1", fontWeight: 600 } }, myName)
    ),
    // ── POKAL / VERLOREN-ICON MIT GLOW ────────────────────────
    React.createElement("div", { style: { position: "relative", marginBottom: 6, display: "flex", justifyContent: "center", alignItems: "center" }},
      wonState && !drawn && React.createElement("div", { style: {
        position: "absolute", width: 180, height: 90,
        background: "radial-gradient(ellipse,rgba(251,191,36,0.32) 0%,transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-55%)",
        filter: "blur(8px)", pointerEvents: "none"
      }}),
      React.createElement("div", { style: {
        color: drawn ? "#fbbf24" : wonState ? "#fbbf24" : "#ef4444",
        filter: "drop-shadow(0 0 24px currentColor)",
        animation: "trophyPop 0.65s cubic-bezier(.2,1.5,.4,1) both"
      }}, React.createElement(Icon, { name: drawn ? "swords" : wonState ? "trophy" : "x", size: wonState && !drawn ? 82 : 70 }))
    ),
    // ── SIEG / NIEDERLAGE TEXT ────────────────────────────────
    React.createElement("div", { style: {
      fontSize: wonState && !drawn ? "clamp(28px,7.5vw,36px)" : "clamp(24px,6.5vw,30px)", fontWeight: 900, marginBottom: 3,
      letterSpacing: "-0.01em",
      color: drawn ? "#fbbf24" : wonState ? "#fbbf24" : "#ef4444",
      textShadow: wonState || drawn ? "0 0 36px rgba(251,191,36,0.45)" : "0 0 22px rgba(239,68,68,0.4)",
      animation: "titleSlam 0.6s 0.08s cubic-bezier(.2,1.3,.4,1) both"
    }}, (() => {
      const wname = (p) => {
        var _a2;
        return online.current
          ? ((_a2 = playerInfo.current[p]) == null ? void 0 : _a2.name) || (t("playerDefault") + " " + p)
          : (FLAG_OF[p] || "") + " " + (p === 1 ? t("bluePlayer") : p === 2 ? t("redPlayer") : t("greenPlayer"));
      };
      if (!isWin) return t("resultDraw");
      if (online.current) return iWon ? t("resultWin") : t("resultLose");
      return t("resultWinner", { name: wname(info.winner) });
    })()),
    // ── GRUND / UNTERTITEL ────────────────────────────────────
    React.createElement("div", { style: { fontSize: 12, color: "#64748b", marginBottom: 12 }},
      info.reason === "left" || info.reason === "host_left" ? t("resultLeft")
      : info.numPlayers === 3 || numPlayers === 3 ? t("resultLastStanding")
      : info.reason === "breach" ? t("resultBurgDurch")
      : t("resultBurgOffen")
    ),
    // ── SCORE-BOX ─────────────────────────────────────────────
    React.createElement("div", { style: {
      display: "inline-flex", alignItems: "center", gap: 10,
      marginBottom: 14,
      background: "linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))",
      borderRadius: 16, padding: "8px 22px",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.06)"
    }},
      React.createElement("span", { style: { color: "#60a5fa", fontSize: 26, fontWeight: 900, textShadow: "0 0 14px rgba(96,165,250,0.55)" }}, "♔ " + scores[1]),
      React.createElement("span", { style: { color: "#334155", fontSize: 16, fontWeight: 400 }}, ":"),
      React.createElement("span", { style: { color: "#f87171", fontSize: 26, fontWeight: 900, textShadow: "0 0 14px rgba(248,113,113,0.55)" }}, scores[2] + " ♚"),
      (info.numPlayers === 3 || numPlayers === 3) && React.createElement(React.Fragment, null,
        React.createElement("span", { style: { color: "#334155", fontSize: 16, fontWeight: 400 }}, ":"),
        React.createElement("span", { style: { color: "#34d399", fontSize: 26, fontWeight: 900, textShadow: "0 0 14px rgba(52,211,153,0.55)" }}, (scores[3] || 0) + " ♜")
      )
    ),
    // ── MATCH-BILANZ (v3.21.0, SPEC 14.2): 4 Kacheln für den eigenen Spieler ──
    (() => {
      const meP = online.current ? (myRole.current || 1) : 1;
      const ms = (matchStats.current && matchStats.current[meP]) || { walls: 0, cannons: 0, scrap: 0, shots: 0, hits: 0 };
      const acc = ms.shots > 0 ? Math.round(ms.hits / ms.shots * 100) + "%" : "—";
      const tiles = [
        { icon: "zap", val: ms.walls, label: t("statWalls") },
        { icon: "bomb", val: ms.cannons, label: t("statCannons") },
        { icon: "coins", val: ms.scrap, label: t("statScrap") },
        { icon: "target", val: acc, label: t("statAcc") }
      ];
      return React.createElement("div", { style: { width: "100%", maxWidth: 320, marginBottom: 12 } },
        React.createElement("div", { style: { display: "flex", gap: 6 } },
          tiles.map((tl, i) => React.createElement("div", { key: i, style: {
            flex: 1, minWidth: 0, padding: "8px 2px 7px", borderRadius: 12,
            background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2
          } },
            React.createElement(Icon, { name: tl.icon, size: 14 }),
            React.createElement("span", { style: { fontSize: 16, fontWeight: 900, color: "#e2e8f0", lineHeight: 1.1 } }, tl.val),
            React.createElement("span", { style: { fontSize: 8.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, tl.label)
          ))
        )
      );
    })(),
    // ── BELOHNUNGS-KARTEN (ELO / GOLD / XP) ──────────────────
    online.current && React.createElement("div", { style: {
      display: "flex", flexDirection: "column", gap: 8,
      width: "100%", maxWidth: 320, marginBottom: 12
    }},
      // ELO-KARTE
      eloChangeRef.current && React.createElement("div", { style:
        eloChangeRef.current.delta >= 0 ? card(74, 222, 128) : card(239, 68, 68) },
        React.createElement("div", { style: LABEL }, t("eloChange")),
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }},
          React.createElement("span", { style: { fontSize: 20, fontWeight: 700, color: "#64748b" }}, eloChangeRef.current.oldElo),
          React.createElement("span", { style: { color: "#334155", fontSize: 14 }}, "→"),
          React.createElement("span", { style: {
            fontSize: 28, fontWeight: 900,
            color: eloChangeRef.current.delta >= 0 ? "#4ade80" : "#ef4444",
            textShadow: "0 0 10px currentColor"
          }}, eloChangeRef.current.newElo),
          React.createElement("span", { style: {
            fontSize: 13, fontWeight: 800,
            color: eloChangeRef.current.delta >= 0 ? "#4ade80" : "#ef4444",
            background: eloChangeRef.current.delta >= 0 ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)",
            borderRadius: 6, padding: "2px 7px"
          }}, (eloChangeRef.current.delta >= 0 ? "+" : "") + eloChangeRef.current.delta)
        )
      ),
      // GOLD-KARTE
      goldChangeRef.current && goldChangeRef.current.delta > 0 && React.createElement("div", { style: card(251, 191, 36) },
        React.createElement("div", { style: LABEL }, t("goldLabel")),
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }},
          React.createElement("span", { style: { fontSize: 20, fontWeight: 700, color: "#64748b" }}, goldChangeRef.current.oldGold),
          React.createElement("span", { style: { color: "#334155", fontSize: 14 }}, "→"),
          React.createElement("span", { style: {
            fontSize: 28, fontWeight: 900, color: "#fbbf24",
            textShadow: "0 0 10px rgba(251,191,36,0.5)"
          }}, goldChangeRef.current.newGold),
          React.createElement("span", { style: {
            fontSize: 13, fontWeight: 800, color: "#fbbf24",
            background: "rgba(251,191,36,0.15)", borderRadius: 6, padding: "2px 7px"
          }}, "+" + goldChangeRef.current.delta + " G")
        )
      ),
      // XP-KARTE
      xpChangeRef.current && React.createElement(XpResultAnim, { t, xpChange: xpChangeRef.current }),
      // MATERIAL-KARTE (v3.68.0): Schmiede-Material floss bisher unsichtbar ins
      // Profil. Jetzt steht die Beute neben ELO/Gold/XP — inklusive Hinweis,
      // wofuer sie gut ist.
      matChangeRef.current && MAT_ORDER.some((k) => (matChangeRef.current[k] || 0) > 0) && React.createElement("div", { style: card(251, 146, 60) },
        React.createElement("div", { style: LABEL }, t("matEarned")),
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" } },
          MAT_ORDER.filter((k) => (matChangeRef.current[k] || 0) > 0).map((k) => React.createElement("div", { key: k, style: {
            display: "flex", alignItems: "center", gap: 6
          } },
            React.createElement(MatPip, { k, size: 13 }),
            React.createElement("span", { style: { fontSize: 22, fontWeight: 900, color: MAT_META[k].c, textShadow: "0 0 10px " + MAT_META[k].c + "88" } }, "+" + matChangeRef.current[k]),
            React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: "#94a3b8" } }, t("mat_" + k))
          ))
        ),
        React.createElement("div", { style: { fontSize: 9.5, color: "#fdba74", marginTop: 6, fontWeight: 700 } }, t("matToForge"))
      )
    ),
    // ── TEILEN ────────────────────────────────────────────────
    // Herausforderung steht VOR dem blossen Teilen und ist der auffaelligere
    // der beiden Knoepfe: sie fuehrt zu einer Partie, das Teilen nur zu einem
    // Link. Bei einem Zweipersonenspiel ohne Spielerbasis ist das der
    // Unterschied zwischen Wachstum und Rauschen.
    React.createElement("button", { onClick: challengeFriend, style: {
      width: "100%", maxWidth: 320,
      background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "#fff",
      border: "1px solid rgba(124,58,237,0.5)",
      padding: "12px", fontSize: 14, fontWeight: 800,
      borderRadius: 12, cursor: "pointer", marginBottom: 8,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8
    }},
      React.createElement(Icon, { name: "swords", size: 15 }),
      t('challengeFriend')
    ),
    React.createElement("button", { onClick: () => shareResult(iWon, drawn), style: {
      width: "100%", maxWidth: 320,
      background: shareShared ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
      color: shareShared ? "#4ade80" : "#475569",
      border: "1px solid " + (shareShared ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.07)"),
      padding: "10px", fontSize: 13, fontWeight: 600,
      borderRadius: 12, cursor: "pointer",
      marginBottom: 8, transition: "all 0.2s",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6
    }},
      React.createElement(Icon, { name: shareShared ? "check" : "share2", size: 14 }),
      shareShared ? t("shareBtnDone") : t("shareBtn")
    ),
    // ── ACTION-BUTTONS ────────────────────────────────────────
    online.current && mmMatched.current ? (
      // Matchmaking-Spiel (gewertet): kein Rematch — wie echtes Ranked.
      // Zurück ins Menü, neue Gegner über neues Matchmaking.
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320, alignItems: "center" }},
        React.createElement("button", { onClick: () => {
          scoresRef.current = { 1: 0, 2: 0 };
          setScores({ 1: 0, 2: 0 });
          leaveOnline();
        }, style: {
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          width: "100%", background: "linear-gradient(135deg,#2563eb,#7c3aed)",
          color: "white", border: "none", padding: "15px",
          fontSize: 16, fontWeight: 800, borderRadius: 14, cursor: "pointer",
          boxShadow: "0 4px 24px rgba(59,130,246,0.4)"
        }}, React.createElement(Icon, { name: "home", size: 16 }), t("mainMenu"))
      )
    ) : online.current && !isHost ? (
      // Gast: Warte-Status + Hauptmenü
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320, alignItems: "center" }},
        React.createElement("div", { style: {
          color: "#475569", fontSize: 12, fontStyle: "italic",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "13px 20px", width: "100%", boxSizing: "border-box"
        }}, t("waitHost")),
        React.createElement("button", { onClick: () => {
          scoresRef.current = { 1: 0, 2: 0 };
          setScores({ 1: 0, 2: 0 });
          leaveOnline();
        }, style: {
          width: "100%", background: "rgba(255,255,255,0.06)", color: "#94a3b8",
          border: "1px solid rgba(255,255,255,0.1)", padding: "12px", fontSize: 13,
          borderRadius: 12, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6
        }}, React.createElement(Icon, { name: "home", size: 14 }), t("mainMenu"))
      )
    ) : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }},
      // PRIMÄR: Nächste Runde
      React.createElement("button", { onClick: onlineNextRound2, style: {
        display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        background: "linear-gradient(135deg,#2563eb,#7c3aed)",
        color: "white", border: "none", padding: "15px",
        fontSize: 16, fontWeight: 800, borderRadius: 14, cursor: "pointer",
        boxShadow: "0 4px 24px rgba(59,130,246,0.4)"
      }}, React.createElement(Icon, { name: "rotateCw", size: 18 }), t("nextRound")),
      // SEKUNDÄR: Hauptmenü ("Neue Karte" entfernt v3.19.5 — war funktional
      // identisch zu „Nächste Runde": beide erzeugen via initGrid eine neue
      // Zufallskarte. Für einen kompletten Neustart → Hauptmenü.)
      React.createElement("button", { onClick: () => {
        scoresRef.current = { 1: 0, 2: 0 };
        setScores({ 1: 0, 2: 0 });
        if (online.current) leaveOnline();
        else { screenRef.current = "menu"; setScreen("menu"); }
      }, style: {
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: "transparent", color: "#475569",
        border: "1px solid rgba(255,255,255,0.06)", padding: "10px",
        fontSize: 13, borderRadius: 12, cursor: "pointer"
      }}, React.createElement(Icon, { name: "home", size: 14 }), t("mainMenu"))
    )
    );
  }
  // ── Unterleiste (v3.69.0) ────────────────────────────────────────────
  // Das Spielfeld ist BREITEN-begrenzt (Raster 44×68 ist relativ breiter als
  // ein Hochkant-Telefon), deshalb blieben unter dem Brett rund 120 px übrig.
  // In der Bauphase stand dort ein dünner Streifen mit einem 24-px-Punktmuster,
  // in der Schussphase GAR NICHTS — ein Viertel des Bildschirms war schwarz.
  // Die Leiste darf bis ~120 px wachsen, ohne das Brett zu verkleinern (`fit`
  // skaliert nach Breite), also füllt sie den Platz jetzt mit echtem Inhalt.
  const PANEL_COL = { 1: { a: "96,165,250", d: "#60a5fa" }, 2: { a: "248,113,113", d: "#f87171" }, 3: { a: "52,211,153", d: "#34d399" } };
  const barH = viewSize.bar || 52;
  // Die volle nutzbare Breite. Kopfzeile, Buehne und Unterleiste spannen
  // darueber; nur das Brett selbst bleibt bei seinem Seitenverhaeltnis.
  const vollB = viewSize.voll || viewSize.w;
  // Die Kopfzeile waechst mit der Breite (v3.89.0; vorher ein Ja/Nein fuer
  // Tabletts). Gemessen war sie auf JEDEM iPhone 53 px hoch — auf einem
  // 16 Pro Max mit 440 Punkten Breite genauso wie auf einem SE mit 375. Sie
  // wurde damit auf dem groesseren Geraet proportional immer kleiner, obwohl
  // ein Punkt auf allen iPhones ungefaehr gleich gross ist.
  //
  // Und es kostet dort NICHTS: Auf einem breiten Telefon ist das Brett
  // BREITEN-begrenzt, die Hoehe reicht ohnehin. Was die Kopfzeile mehr
  // braucht, nimmt sie der Unterleiste, die dort bis 150 px Spielraum hat —
  // nicht dem Brett. Nachgemessen auf dem 16 Pro Max: Brett unveraendert
  // 438x676, Leiste 116 statt 123.
  //
  // Der Deckel bei 1,3 gilt weiter fuer Tabletts: 1024/390 waere 2,6, und ein
  // Punkt ist auf einem iPad ohnehin rund ein Viertel groesser als auf einem
  // iPhone — die volle Relation ergaebe dreifache Schrift. 390 als Bezug ist
  // die Breite, fuer die die Kopfzeile gesetzt wurde. Die Breite wird durch
  // die Zoomstufe geteilt, sonst laeuft die Leiste um denselben Faktor ueber.
  const hudZ = Math.min(1.3, Math.max(1, vollB / 390));
  const hudBreite = vollB / hudZ;
  // Die Buehne (v3.88.0): 616:952 ist hoch, ein iPad ist es weniger — links
  // und rechts bleiben je ~120 px uebrig, und die waren bisher leer. Jetzt
  // gehoeren sie zur Buehne: ein weicher Schein hinter dem Brett, nach aussen
  // auslaufend. Das kostet KEIN Pixel pro Bild, es ist ein Verlauf auf einem
  // Kasten — die Zeichenschleife merkt davon nichts. Auf dem Telefon, wo
  // nichts uebrig bleibt, faellt der Verlauf ganz weg.
  const buehneStil = {
    width: vollB, height: viewSize.h, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative",
    background: vollB - viewSize.w > 24
      ? "radial-gradient(ellipse 58% 76% at 50% 46%, rgba(56,189,248,0.10) 0%, rgba(37,99,235,0.045) 44%, rgba(2,6,15,0) 74%)"
      : void 0
  };
  const hudH = viewSize.top || 52;
  // −42, nicht −38 (v3.88.0): Die 38 waren zu knapp gerechnet. Neben dem Bild
  // stehen in der Leiste noch ihre eigene Polsterung, die des Feldes, der
  // Abstand und die Beschriftung — zusammen 42. Mit 38 versprach die Formel
  // ein Quadrat, das nicht hineinpasste, und der Kasten wurde vom Flexlayout
  // flachgedrueckt: auf dem iPad gemessene 58 × 54 statt 58 × 58. Jetzt sagt
  // die Zahl die Wahrheit, und `flexShrink: 0` am Kasten haelt sie.
  const pieceBox = Math.max(24, Math.min(76, barH - 42));
  // Vorher drei fast identische Blöcke (nur Farbe + Spiegelung unterschiedlich);
  // eine gemeinsame Funktion hält sie garantiert in Deckung.
  function piecePanel(pl) {
    const col = PANEL_COL[pl];
    // P1 sieht sein Feld vertikal gespiegelt (scale(1,-1)) im Bot-/Online-Host-
    // Modus bei 2 Spielern. Die Hand-Vorschau MUSS dieselbe Spiegelung zeigen —
    // sonst zeigt sie eine andere Richtung als der Ghost, den man zieht.
    const flip = pl === 1 && (online.current && myRole.current === 1 || botMode.current) && numPlayersRef.current === 2;
    return React.createElement("div", {
      key: "pp" + pl,
      onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); rotatePiece(pl); },
      style: {
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "8px 6px", background: "rgba(" + col.a + ",0.10)",
        border: "1px solid rgba(" + col.a + ",0.28)", borderRadius: 10,
        cursor: "pointer", touchAction: "manipulation", userSelect: "none", minHeight: 36
      }
    }, (() => {
      const p = pieces.current[pl]; if (!p) return null;
      const cells = p.cells;
      const maxR = Math.max(...cells.map(([r]) => r));
      const maxC = Math.max(...cells.map(([, c]) => c));
      // Punktgröße wächst jetzt mit dem freien Platz (vorher fix 4–7 px).
      const BOX = pieceBox;
      const dot = Math.max(5, Math.min(16, Math.floor(BOX / Math.max(maxR + 1, maxC + 1)) - 2));
      return React.createElement("div", { style: { width: BOX, height: BOX, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: `repeat(${maxC + 1}, ${dot}px)`, gridTemplateRows: `repeat(${maxR + 1}, ${dot}px)`, gap: 2 } },
          Array.from({ length: (maxR + 1) * (maxC + 1) }).map((_, i) => {
            const r = Math.floor(i / (maxC + 1)), c = i % (maxC + 1);
            const on = cells.some(([cr, cc]) => cr === (flip ? maxR - r : r) && cc === c);
            return React.createElement("div", { key: i, style: {
              width: dot, height: dot, borderRadius: 3,
              background: on ? col.d : "rgba(255,255,255,0.04)",
              boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,0.45), 0 0 6px rgba(" + col.a + ",0.5)" : "none"
            } });
          })
        )
      );
    })(),
      // Der Streifen war schon immer tippbar zum Drehen — nur stand das nirgends.
      pieceBox >= 40 ? React.createElement("div", { style: {
        display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800,
        letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(" + col.a + ",0.95)"
      } }, React.createElement(Icon, { name: "rotateCw", size: 10 }), t("panelRotate")) : null
    );
  }
  // Schussphase: zeigt, wie viele eigene Kanonen DIESE Runde feuern dürfen.
  // Die Regel „nur rundum eingemauerte Kanonen schießen" war bislang nirgends
  // beziffert — man sah nur, dass weniger Kugeln kamen als erwartet.
  function readyPanel(pl) {
    const col = PANEL_COL[pl];
    const alle = (cannons.current[pl] || []).filter((c) => c.hp > 0).length;
    const bereit = (frozenReady.current[pl] || []).length;
    const stumm = Math.max(0, alle - bereit);
    return React.createElement("div", { key: "rp" + pl, style: {
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 3, padding: "8px 6px", background: "rgba(" + col.a + ",0.08)",
      border: "1px solid rgba(" + col.a + ",0.22)", borderRadius: 10, minHeight: 36
    } },
      React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 3 } },
        React.createElement("span", { style: { fontSize: 22, fontWeight: 900, color: col.d, textShadow: "0 0 10px rgba(" + col.a + ",0.6)", lineHeight: 1 } }, bereit),
        React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: "rgba(148,163,184,0.8)" } }, "/ " + alle)
      ),
      React.createElement("div", { style: {
        fontSize: 9, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase",
        color: "rgba(" + col.a + ",0.9)"
      } }, t("panelReady")),
      stumm > 0 ? React.createElement("div", { style: { fontSize: 8.5, fontWeight: 700, color: "#fca5a5" } }, stumm + " " + t("panelMute")) : null
    );
  }
  return /* @__PURE__ */ React.createElement("div", { ref: wrapRef, style: {
    background: "#04080d",
    // **100% statt 100dvh** — dieselbe Falle wie im Menue (v3.84.0): Der
    // Koerper ist bereits um die Sicherheitsbereiche verkuerzt. Volle 100dvh
    // machten die Huelle um oberen PLUS unteren Bereich zu hoch (auf dem
    // iPhone 93 px), und overflow:hidden schnitt genau das unten ab — die
    // Bauteil-Leiste ragte aus dem Bildschirm.
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    color: "#e2e8f0",
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none"
  } }, online.current && showDbg && /* @__PURE__ */ React.createElement("div", { onClick: () => setShowDbg(false), style: {
    position: "absolute",
    top: 42,
    right: 6,
    zIndex: 60,
    background: "rgba(2,6,12,0.9)",
    border: "1px solid rgba(96,165,250,0.4)",
    color: "#93c5fd",
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 9,
    fontFamily: "monospace",
    lineHeight: 1.5,
    maxWidth: 180,
    textAlign: "left"
  } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#fbbf24", fontWeight: 700 } }, "SYNC \xB7 Rolle ", myRole.current === 1 ? "Host" : "Gast " + myRole.current), /* @__PURE__ */ React.createElement("div", null, "State empf.: ", dbg.current.statesRecv), /* @__PURE__ */ React.createElement("div", null, "State push: ", dbg.current.statesPush), /* @__PURE__ */ React.createElement("div", null, "Akt. gesendet: ", dbg.current.actSent), /* @__PURE__ */ React.createElement("div", null, "Akt. empf.: ", dbg.current.actRecv), /* @__PURE__ */ React.createElement("div", { style: { color: "#fde68a" } }, "Grid-Bauten: ", (() => {
    const g = grid.current;
    if (!g) return "?";
    let n = 0;
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] !== 0) n++;
    return n;
  })()), /* @__PURE__ */ React.createElement("div", { style: { color: "#fde68a" } }, "screen=", screenRef.current, " phase=", phase_r.current), /* @__PURE__ */ React.createElement("div", { style: { color: "#86efac", wordBreak: "break-all" } }, dbg.current.lastInfo), dbg.current.lastErr && /* @__PURE__ */ React.createElement("div", { style: { color: "#fca5a5", wordBreak: "break-all" } }, "ERR: ", dbg.current.lastErr), /* @__PURE__ */ React.createElement("div", { style: { color: "#475569", marginTop: 2 } }, "(tippen zum Schlie\xDFen)")), /* @__PURE__ */ React.createElement("div", { ref: scoreBarRef, style: {
    width: hudBreite,
    zoom: hudZ === 1 ? void 0 : hudZ,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "5px 2px 3px",
    boxSizing: "border-box",
    gap: 4
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    flex: "1 1 0",
    minWidth: 0,
    background: "linear-gradient(160deg, rgba(59,130,246,0.20), rgba(30,58,138,0.30))",
    border: "1px solid rgba(59,130,246,0.45)",
    borderRadius: 14,
    padding: "4px 6px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    backdropFilter: "blur(12px)",
    boxShadow: "0 2px 16px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
    justifyContent: "flex-start"
  } }, /* @__PURE__ */ React.createElement(WappenAvatar, { id: online.current || botMode.current ? playerInfo.current[1].wappen : "skelett", size: 20 }), /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 } }, (urgentPlayers[1] ? closeWarnSpan("left") : /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#93c5fd", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", maxWidth: "100%" } }, online.current || botMode.current ? playerInfo.current[1].name + (myRole.current === 1 || botMode.current ? t('youSuffix') : "") : "P1")), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: "#fbbf24", flexShrink: 0, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "1px 5px", minWidth: 42, justifyContent: "center", fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 2 } }, React.createElement(Icon, { name: "gem", size: 9, color: "#fbbf24" }), String(scrap.current[1] || 0))), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 17, fontWeight: 900, color: "#fde68a", flexShrink: 0, textShadow: "0 0 8px rgba(251,191,36,0.7)" } }, scores[1])), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", flex: "0 0 auto", padding: "0 2px", maxWidth: "24%" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 1 } }, /* @__PURE__ */ React.createElement("span", { style: {    background: phase === "build" ? "rgba(74,222,128,0.18)" : phase === "shoot" ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.20)",    border: `1px solid ${phase === "build" ? "rgba(74,222,128,0.55)" : phase === "shoot" ? "rgba(239,68,68,0.55)" : "rgba(245,158,11,0.60)"}`,
    boxShadow: phase === "build" ? "0 0 8px rgba(74,222,128,0.30)" : phase === "shoot" ? "0 0 8px rgba(239,68,68,0.30)" : "0 0 8px rgba(245,158,11,0.30)",
    borderRadius: 6,
    padding: "1px 6px",
    fontSize: 9,
    fontWeight: 700,
    color: phase === "build" ? "#4ade80" : phase === "shoot" ? "#f87171" : "#fbbf24",
    display: "inline-block"
  } }, phase === "build" ? t('phaseBuild') : phase === "shoot" ? t('phaseShoot') : phase === "setup" ? t('phaseSetup') : t('phaseCannon')), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowQuitConfirm(true), title: "beenden", style: { background: "rgba(100,116,139,0.12)", border: "1px solid rgba(100,116,139,0.22)", color: "#64748b", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer", lineHeight: 1, flexShrink: 0 } }, "✕")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5 } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 30,
    fontWeight: 900,
    color: timerColor,
    textShadow: timer <= 5 ? `0 0 18px ${timerColor}` : "0 0 5px rgba(200,180,100,0.25)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1
  } }, String(timer).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, color: "#64748b" } }, t('roundLabel'), round))), /* @__PURE__ */ React.createElement("div", { style: {
    flex: "1 1 0",
    minWidth: 0,
    background: "linear-gradient(160deg, rgba(239,68,68,0.20), rgba(127,29,29,0.30))",
    border: "1px solid rgba(239,68,68,0.45)",
    borderRadius: 14,
    padding: "4px 6px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    backdropFilter: "blur(12px)",
    boxShadow: "0 2px 16px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
    justifyContent: "flex-end"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 17, fontWeight: 900, color: "#fde68a", flexShrink: 0, textShadow: "0 0 8px rgba(251,191,36,0.7)" } }, scores[2]), /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 } }, (urgentPlayers[2] ? closeWarnSpan("right") : /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#fca5a5", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", maxWidth: "100%", textAlign: "right" } }, online.current || botMode.current ? playerInfo.current[2].name + (myRole.current === 2 ? t('youSuffix') : "") : "P2")), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: "#fbbf24", flexShrink: 0, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "1px 5px", minWidth: 42, justifyContent: "center", fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 2 } }, React.createElement(Icon, { name: "gem", size: 9, color: "#fbbf24" }), String(scrap.current[2] || 0))), /* @__PURE__ */ React.createElement(WappenAvatar, { id: online.current || botMode.current ? playerInfo.current[2].wappen : "roboter", size: 20 }))), numPlayers === 3 && /* @__PURE__ */ React.createElement("div", { ref: row3Ref, style: { width: hudBreite, zoom: hudZ === 1 ? void 0 : hudZ, display: "flex", justifyContent: "center", marginTop: 4 } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(160deg, rgba(16,185,129,0.20), rgba(6,78,59,0.30))",
    border: "1px solid rgba(16,185,129,0.45)",
    borderRadius: 14,    padding: "2px 10px",    display: "flex",
    alignItems: "center",
    gap: 8,
    backdropFilter: "blur(12px)",
    boxShadow: "0 2px 16px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
    maxWidth: "70%",
    opacity: eliminated.current[3] ? 0.4 : 1
  } }, /* @__PURE__ */ React.createElement(WappenAvatar, { id: online.current ? (((_a = playerInfo.current[3]) == null ? void 0 : _a.wappen) || "phoenix") : "phoenix", size: 20 }), (urgentPlayers[3] ? closeWarnSpan("center") : /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "#6ee7b7", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 } }, online.current ? (((_b = playerInfo.current[3]) == null ? void 0 : _b.name) || "P3") + (myRole.current === 3 ? t('youSuffix') : "") : t('p3GreenFallback'), eliminated.current[3] && " \u2620\uFE0F")), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 17, fontWeight: 900, color: "#fde68a", flexShrink: 0, textShadow: "0 0 8px rgba(251,191,36,0.7)" } }, scores[3] || 0))), warn && /* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed",
    top: 70,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(127,29,29,0.92)",
    border: "1px solid rgba(248,113,113,0.5)",
    borderRadius: 10,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 700,
    color: "#fecaca",
    zIndex: 999,
    pointerEvents: "none",
    boxShadow: "0 4px 24px rgba(239,68,68,0.4)",
    whiteSpace: "nowrap",
    maxWidth: "92vw",
    overflow: "hidden",
    textOverflow: "ellipsis"
  } }, warn), phase === "cannon" && (() => {
    const mine = online.current ? [myRole.current] : botMode.current ? [1] : playersList();
    const h = React.createElement;
    const renderInner = (sp) => {
      // Kanone gekauft und wartet auf Platzierung → Shop AUSBLENDEN (v3.17.1),
      // damit das ganze Feld frei ist (das Panel verdeckte sonst die eigene
      // Burg unten, man konnte dort nicht platzieren). Stattdessen ein schmaler,
      // nicht-blockierender Hinweis oben. Kommt zurück, sobald die Kanone
      // gesetzt ist (Budget wieder 0).
      // Reparatur-Highlight (v3.32.0): Shop kurz weg, Blick aufs Feld frei
      if ((shopHideUntil.current[sp] || 0) > performance.now()) return null;
      if ((cannonBudget.current[sp] || 0) > 0) {
        return { kind: "placehint", el: h("div", { key: "placehint" + sp, style: {
            padding: "6px 15px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: "#fde68a",
            background: "linear-gradient(180deg, rgba(30,41,66,0.94), rgba(11,16,30,0.94))",
            border: "1px solid rgba(251,191,36,0.45)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)", animation: "shopCoinPulse 1.1s ease-in-out infinite"
          } }, t("armoryPlaceHint")) };
      }
      // Spieler hat „Fertig" bestätigt → kompaktes Warte-Panel statt Shop (v3.18.1)
      if (armoryReady.current[sp]) {
        return { kind: "wait", el: h("div", { key: "armoryWait" + sp, style: {
            padding: "9px 18px", borderRadius: 14, fontSize: 13, fontWeight: 800, color: "#6ee7b7",
            background: "linear-gradient(180deg, rgba(30,41,66,0.94), rgba(11,16,30,0.96))",
            border: "1px solid rgba(52,211,153,0.4)",
            boxShadow: "0 8px 26px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)", animation: "shopRise 0.32s cubic-bezier(.22,1,.36,1) both"
          } }, t("armoryWaiting")) };
      }
      const up = upgrades.current[sp] || {};
      const have = scrap.current[sp] || 0;
      const items = [
        { k: "cannon", label: t("shopCannon"), tag: t("shopTagCannon"), price: cannonPriceOf(sp), max: false },
        // Der Bezwinger ist nicht mehr gesperrt, nur teuer (v3.73.0) — er
        // verhaelt sich damit wie jede andere Karte: zu wenig Beute = grau.
        { k: "slayer", label: t("shopSlayer"), tag: t("shopTagSlayer"), price: SHOP_SLAYER, max: false },
        { k: "reload", label: t("shopReload"), tag: t("shopTagReload"), price: (up.reload || 0) >= 2 ? 0 : SHOP.reload.prices[up.reload || 0], max: (up.reload || 0) >= 2 },
        { k: "armor", label: t("shopArmor"), tag: t("shopTagArmor"), price: SHOP.armor.price, max: !!up.armor },
        { k: "repair", label: t("shopRepair"), tag: t("shopTagRepair"), price: SHOP.repair.base + SHOP.repair.step * (up.repair || 0), max: false, noNeed: (() => {
          const gg = grid.current, ctl = castles.current[sp];
          if (!gg || !ctl) return true;
          for (let rr = Math.max(0, ctl.r - 10); rr <= Math.min(ROWS - 1, ctl.r + 10); rr++)
            for (let cc = Math.max(0, ctl.c - 10); cc <= Math.min(COLS - 1, ctl.c + 10); cc++)
              if (gg[rr][cc] === RUBBLE) return false;
          return true;
        })() }
      ];
      // Spieler-Kennung im Shop-Header (v3.40.3): bei mehreren Panels (lokaler
      // 2–3-Spieler-Hotseat) muss klar sein, WESSEN Shop das ist. Farbe + Flagge
      // wie im HUD; online/Bot der echte Name, lokal P1/P2/P3.
      const pColor = sp === 1 ? "#93c5fd" : sp === 2 ? "#fca5a5" : "#6ee7b7";
      const pGlow = sp === 1 ? "rgba(59,130,246,0.5)" : sp === 2 ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)";
      const pFlag = FLAG_OF[sp] || "";
      const pName = (online.current || botMode.current) && playerInfo.current[sp] && playerInfo.current[sp].name ? playerInfo.current[sp].name : ("P" + sp);
      return { kind: "shop", el: h("div", { key: "shop" + sp, style: {
          width: "100%", maxWidth: 452, pointerEvents: "auto",
          background: "linear-gradient(180deg, rgba(30,41,66,0.96) 0%, rgba(11,16,30,0.975) 100%)",
          border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: "9px 10px 11px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 18px 46px rgba(0,0,0,0.62), 0 0 0 1px rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          animation: "shopRise 0.42s cubic-bezier(.22,1,.36,1) both"
        } },
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 3px" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: "1 1 auto" } },
              h("span", { style: { fontSize: 15, lineHeight: 1, color: pColor, flexShrink: 0, textShadow: "0 0 8px " + pGlow } }, pFlag),
              h("span", { style: { fontSize: 12.5, fontWeight: 800, letterSpacing: "0.03em", color: pColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.55)" } }, pName),
              h("span", { style: { fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#64748b", textTransform: "uppercase", flexShrink: 0, marginLeft: 2 } }, t("bannerCannonTitle"))
            ),
            h("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
              h("button", { onClick: () => setShowShopInfo(true), "aria-label": "Info", style: {
                width: 22, height: 22, borderRadius: 999, border: "1px solid rgba(148,163,184,0.5)", cursor: "pointer",
                background: "linear-gradient(180deg, rgba(51,65,85,0.9), rgba(15,23,42,0.9))",
                color: "#cbd5e1", fontSize: 12, fontWeight: 900, fontStyle: "italic", lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.4)"
              } }, "i"),
              h("div", { key: "coin" + have, style: {
                display: "flex", alignItems: "center", gap: 4, padding: "3px 12px 3px 9px",
                background: "linear-gradient(180deg,#fde68a 0%,#f59e0b 100%)", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.55)",
                boxShadow: "0 2px 9px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 4px rgba(180,83,9,0.4)",
                animation: "shopCoinPulse 0.42s ease both"
              } },
                h("span", { style: { fontSize: 14, fontWeight: 900, color: "#3b2606", textShadow: "0 1px 0 rgba(255,255,255,0.4)", display: "inline-flex", alignItems: "center", gap: 3 } },
                  React.createElement(Icon, { name: "gem", size: 12, color: "#3b2606" }), String(have))
              )
            )
          ),
          h("div", { style: { display: "flex", gap: 7, alignItems: "stretch" } },
            items.map((it, idx) => {
              const th = SHOP_THEME[it.k];
              const afford = !it.max && !it.noNeed && have >= it.price;
              const dim = !afford;
              const buyC = shopBuyAnim.current[sp + "_" + it.k] || 0;
              return h("button", {
                key: it.k + "_" + buyC,
                onClick: () => doBuy(sp, it.k),
                disabled: !afford,
                className: "shop-card" + (afford ? " afford" : ""),
                style: {
                  flex: 1, minWidth: 0, border: "none", cursor: afford ? "pointer" : "default",
                  borderRadius: 15, padding: "8px 3px 6px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  background: afford
                    ? "linear-gradient(180deg, rgba(" + th.glow + ",0.24) 0%, rgba(10,14,24,0.55) 100%)"
                    : "linear-gradient(180deg, rgba(40,48,64,0.42), rgba(12,16,26,0.55))",
                  boxShadow: afford
                    ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(" + th.glow + ",0.6), 0 6px 16px rgba(" + th.glow + ",0.3), 0 4px 10px rgba(0,0,0,0.42)"
                    : "inset 0 0 0 1px rgba(255,255,255,0.06), 0 3px 8px rgba(0,0,0,0.38)",
                  filter: dim ? "saturate(0.5)" : "none", opacity: dim ? 0.84 : 1,
                  animation: buyC ? "shopBuyPop 0.44s ease both" : ("shopCardIn 0.44s cubic-bezier(.22,1.4,.4,1) " + (0.04 + idx * 0.05).toFixed(2) + "s both")
                }
              },
                // Gegenstands-Plakette (v3.43.0, AAA): statt flacher Farbscheibe
                // jetzt geschmiedetes Medaillon - Metallfassung, Innenschein,
                // Lichtreflex oben links (globale Lichtrichtung), Tiefenschatten.
                h("div", { className: "shop-medal", style: {
                  position: "relative", width: 38, height: 38, borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: dim
                    ? "linear-gradient(155deg,#5b6472,#2a3140 60%,#1b212c)"
                    : "radial-gradient(circle at 32% 24%, " + th.c1 + " 0%, " + th.c2 + " 52%, " + th.c3 + " 100%)",
                  boxShadow: dim
                    ? "inset 0 1.5px 0 rgba(255,255,255,0.16), inset 0 -3px 6px rgba(0,0,0,0.5), 0 3px 7px rgba(0,0,0,0.45)"
                    : "inset 0 2px 0 rgba(255,255,255,0.72), inset 0 -3px 7px rgba(0,0,0,0.42), inset 0 0 10px rgba(" + th.glow + ",0.5), 0 0 0 1.5px rgba(" + th.glow + ",0.45), 0 4px 12px rgba(" + th.glow + ",0.5), 0 2px 5px rgba(0,0,0,0.5)",
                  border: dim ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.5)"
                } },
                  // Glanzsichel oben links - lässt die Plakette gewölbt wirken
                  h("div", { style: {
                    position: "absolute", inset: 0, borderRadius: 999, pointerEvents: "none",
                    background: "radial-gradient(ellipse 60% 42% at 30% 20%, rgba(255,255,255," + (dim ? "0.22" : "0.55") + ") 0%, rgba(255,255,255,0) 62%)"
                  } }),
                  h("div", { style: { position: "relative", display: "flex", filter: dim ? "none" : "drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))" },
                    dangerouslySetInnerHTML: { __html: SHOP_ICONS[it.k] } })
                ),
                h("div", { style: { fontSize: 9.5, fontWeight: 800, color: dim ? "#94a3b8" : "#f1f5f9", textAlign: "center", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textShadow: "0 1px 2px rgba(0,0,0,0.5)" } }, it.label),
                h("div", { style: { fontSize: 7.8, fontWeight: 700, color: dim ? "rgba(148,163,184,0.7)" : "rgba(" + th.glow + ",0.95)", textAlign: "center", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", letterSpacing: "0.01em" } }, it.tag),
                it.max
                  ? h("div", { style: { padding: "2px 9px", borderRadius: 999, background: "linear-gradient(180deg,#34d399,#059669)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 6px rgba(16,185,129,0.4)", fontSize: 9, fontWeight: 900, color: "#052e1a", letterSpacing: "0.05em" } }, t("shopMax"))
                  : h("div", { style: {
                      display: "flex", alignItems: "center", gap: 2, padding: "2px 9px", borderRadius: 999,
                      background: afford ? "linear-gradient(180deg, rgba(0,0,0,0.48), rgba(0,0,0,0.74))" : "rgba(0,0,0,0.42)",
                      border: "1px solid rgba(255,255,255,0.08)"
                    } },
                      React.createElement(Icon, { name: "gem", size: 10 }),
                      h("span", { style: { fontSize: 11.5, fontWeight: 900, color: afford ? "#fcd34d" : "#64748b" } }, it.price)
                    )
              );
            })
          ),
          // „FERTIG"-Button (v3.18.1): bestätigt Bereitschaft → Timer auf 3s
          // sobald alle aktiven Spieler bestätigt haben.
          h("button", { onClick: () => confirmArmory(sp), className: "shop-card", style: {
            marginTop: 8, width: "100%", border: "none", cursor: "pointer", borderRadius: 13, padding: "9px",
            background: "linear-gradient(180deg,#34d399,#059669)", color: "#052e1a",
            fontSize: 14, fontWeight: 900, letterSpacing: "0.04em",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 14px rgba(16,185,129,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6
          } }, "✓ " + t("armoryDone"))
        ) };
    };
    const active = mine.filter((sp) => sp >= 1 && !eliminated.current[sp]);
    const parts = active.map((sp) => ({ sp, r: renderInner(sp) })).filter((x) => x.r);
    if (!parts.length) return null;
    // Online/Bot: genau ein eigenes Panel — Platzier-Hinweis oben, sonst unten.
    if (online.current || botMode.current) {
      return parts.map(({ sp, r }) => h("div", {
        key: "shopwrap" + sp,
        style: __spreadValues({ position: "fixed", zIndex: 1200, display: "flex", justifyContent: "center", pointerEvents: "none" },
          r.kind === "placehint"
            ? { left: 0, right: 0, top: `calc(var(--sa-top,0px) + ${hudH + 2}px)` }
            : { left: 6, right: 6, bottom: "calc(var(--sa-bottom, 0px) + 12px)" })
      }, r.el));
    }
    // Lokaler 2–3-Spieler-Hotseat (v3.40.2): alle Nicht-P1-Panels sauber in einer
    // Flex-Spalte oben stapeln (mit Gap) statt fixer Einzel-Offsets 54/116px, die
    // sich bei vollhohen Shop-Panels überlappten. P1 bleibt unten. Der Container
    // ist pointer-events-transparent; nur die Panels selbst sind klickbar.
    const stack = (list, posStyle, key) => list.length ? h("div", {
      key, style: __spreadValues({ position: "fixed", left: 6, right: 6, zIndex: 1200, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }, posStyle)
    }, list.map((x) => x.r.el)) : null;
    return [
      stack(parts.filter((x) => x.sp !== 1), { top: `calc(var(--sa-top,0px) + ${hudH + 4}px)` }, "shopStackTop"),
      stack(parts.filter((x) => x.sp === 1), { bottom: "calc(var(--sa-bottom, 0px) + 12px)" }, "shopStackBot")
    ];
  })(), showShopInfo && phase === "cannon" && (() => {
    const h = React.createElement;
    const earn = [
      { l: t("shopInfoEarnWall"), v: "+" + SCRAP_WALL },
      { l: t("shopInfoEarnCannon"), v: "+" + SCRAP_CANNON },
      { l: t("shopInfoEarnSurvive"), v: "+" + SCRAP_SURVIVE },
      { l: t("shopInfoEarnStart"), v: "15" }
    ];
    const rows = [
      { k: "cannon", label: t("shopCannon"), desc: t("shopInfoCannonDesc") },
      { k: "slayer", label: t("shopSlayer"), desc: t("shopInfoSlayerDesc") },
      { k: "reload", label: t("shopReload"), desc: t("shopInfoReloadDesc") },
      { k: "armor", label: t("shopArmor"), desc: t("shopInfoArmorDesc") },
      { k: "repair", label: t("shopRepair"), desc: t("shopInfoRepairDesc") }
    ];
    return h("div", { key: "shopinfo", onClick: () => setShowShopInfo(false), style: {
      position: "fixed", inset: 0, zIndex: 1460, background: "rgba(2,6,15,0.9)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 18px) calc(var(--sa-right,0px) + 18px) calc(var(--sa-bottom,0px) + 18px) calc(var(--sa-left,0px) + 18px)"
    } },
      h("div", { onClick: (e) => e.stopPropagation(), style: {
        maxWidth: 420, width: "100%", maxHeight: "86vh", overflowY: "auto",
        background: "linear-gradient(180deg, rgba(30,41,66,0.98) 0%, rgba(11,16,30,0.99) 100%)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "18px 16px 16px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)",
        animation: "dailyBounceIn 0.4s cubic-bezier(.36,1.5,.56,1) both"
      } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 12 } },
          h(Icon, { name: "hammer", size: 17, color: "#fbbf24" }),
          h("div", { style: { fontSize: 15, fontWeight: 900, color: "#f1f5f9", letterSpacing: "0.02em" } }, t("shopInfoTitle"))
        ),
        h("div", { style: { fontSize: 10, fontWeight: 800, color: "#fbbf24", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 } }, t("shopInfoEarnTitle")),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 3, marginBottom: 14, padding: "8px 10px", borderRadius: 12, background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.22)" } },
          earn.map((e, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#e2e8f0" } },
            h("span", null, e.l),
            h("span", { style: { fontWeight: 900, color: "#fcd34d", display: "inline-flex", alignItems: "center", gap: 3 } },
              React.createElement(Icon, { name: "gem", size: 11, color: "#fcd34d" }), String(e.v))
          )),
          // Wiederaufbau-Paket (v3.30.0): Comeback-Regel transparent machen
          h("div", { style: { fontSize: 10.5, color: "#94a3b8", lineHeight: 1.35, marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(245,158,11,0.18)" } }, t("shopInfoEarnRebuild"))
        ),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 } },
          rows.map((it) => {
            const th = SHOP_THEME[it.k];
            return h("div", { key: it.k, style: { display: "flex", alignItems: "flex-start", gap: 10 } },
              h("div", { style: {
                flex: "0 0 auto", width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                background: "radial-gradient(circle at 35% 26%, " + th.c1 + " 0%, " + th.c2 + " 56%, " + th.c3 + " 100%)",
                boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.55), 0 2px 7px rgba(" + th.glow + ",0.5)",
                border: "1px solid rgba(255,255,255,0.28)"
              }, dangerouslySetInnerHTML: { __html: SHOP_ICONS[it.k] } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: 13, fontWeight: 800, color: "#f1f5f9", marginBottom: 1 } }, it.label),
                h("div", { style: { fontSize: 11.5, color: "#94a3b8", lineHeight: 1.35 } }, it.desc)
              )
            );
          })
        ),
        h("button", { onClick: () => setShowShopInfo(false), style: {
          width: "100%", border: "none", cursor: "pointer", borderRadius: 12, padding: "11px",
          background: "linear-gradient(180deg,#34d399,#059669)", color: "#052e1a",
          fontSize: 14, fontWeight: 900, letterSpacing: "0.03em",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 5px 14px rgba(16,185,129,0.4)"
        } }, "✓ " + t("shopInfoClose"))
      )
    );
  })(),
  // ── Salven-Schalter (v3.58.0): welche Kanonenart feuert? ──────────────
  // Oben rechts, ausserhalb der Daumen-Zone: ein Wechsel soll eine bewusste
  // Entscheidung sein, kein Reflex. Er kostet Umruestzeit — solange feuert
  // NIEMAND, und das zeigt ein Fortschrittsring am Knopf.
  phase === "shoot" && (() => {
    const meS = online.current ? myRole.current : (botMode.current ? 1 : null);
    if (!meS) return null;
    const mine = (cannons.current[meS] || []).filter((c) => c.hp > 0);
    if (!mine.some((c) => c.kt === "slayer")) return null;   // erst ab dem 1. Bezwinger
    const frozen = new Set(frozenReady.current[meS] || []);
    const zaehl = (art) => mine.filter((c) => (c.kt || "std") === art && frozen.has(c.id)).length;
    const modus = salvenModus.current[meS] || "std";
    const restMs = Math.max(0, SALVO_LOCK_MS - (performance.now() - (salvoSwitchAt.current[meS] || -99999)));
    const gesperrt = restMs > 0;
    const knopf = (art, icon, label) => {
      const aktiv = modus === art, n = zaehl(art);
      return /* @__PURE__ */ React.createElement("button", {
        key: art,
        disabled: gesperrt || aktiv,
        onClick: () => {
          if (gesperrt || salvenModus.current[meS] === art) return;
          salvenModus.current[meS] = art;
          salvoSwitchAt.current[meS] = performance.now();
          if (online.current && myRole.current !== 1) sendAction({ type: "salvo", m: art });
          SFX.buy && SFX.buy();
          setUiTick((t2) => t2 + 1);
          // Countdown weiterlaufen lassen — die UI rendert sonst nur beim
          // naechsten Timer-Tick und der Balken stuende still.
          const iv = setInterval(() => setUiTick((t2) => t2 + 1), 100);
          setTimeout(() => { clearInterval(iv); setUiTick((t2) => t2 + 1); }, SALVO_LOCK_MS + 120);
        },
        "aria-label": label,
        style: {
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", gap: 6,
          cursor: gesperrt || aktiv ? "default" : "pointer",
          padding: "7px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 800,
          border: "1px solid " + (aktiv ? "rgba(96,165,250,0.85)" : "rgba(255,255,255,0.14)"),
          background: aktiv
            ? "linear-gradient(180deg,#2563eb,#1d4ed8)"
            : "linear-gradient(180deg, rgba(30,41,66,0.92), rgba(11,16,30,0.94))",
          color: aktiv ? "#f8fafc" : (n ? "#cbd5e1" : "#64748b"),
          boxShadow: aktiv ? "0 4px 16px rgba(37,99,235,0.45)" : "0 3px 12px rgba(0,0,0,0.45)",
          opacity: gesperrt && !aktiv ? 0.4 : (n ? 1 : 0.6)
        }
      },
        React.createElement(Icon, { name: icon, size: 14, color: aktiv ? "#f8fafc" : (n ? "#cbd5e1" : "#64748b") }),
        label,
        /* @__PURE__ */ React.createElement("span", {
          style: { fontFamily: "ui-monospace,monospace", fontSize: 11, opacity: 0.85 } }, n));
    };
    return /* @__PURE__ */ React.createElement("div", { key: "salvo", style: {
      // 118px statt 58px (v3.64.0): Auf 58 lag der Schalter GENAU unter dem
      // Warnbanner ("Kanonen werden umgeruestet") und wurde davon verdeckt —
      // ausgerechnet von der Meldung, die zum Schalter gehoert.
      position: "fixed", right: 8, top: `calc(var(--sa-top,0px) + ${hudH + 66}px)`,
      zIndex: 1150, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5
    } },
      /* @__PURE__ */ React.createElement("span", { style: {
        fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em",
        color: gesperrt ? "#fbbf24" : "#64748b",
        textTransform: "uppercase", paddingRight: 4,
        textShadow: "0 1px 3px rgba(0,0,0,0.8)"
      } }, gesperrt ? t("salvoLock") + " " + (restMs / 1000).toFixed(1) + "s" : t("salvoHint")),
      knopf("std", "bricks", t("salvoWalls")),
      knopf("slayer", "crosshair", t("salvoSlayer")),
      // Umruest-Balken: macht die Wartezeit sichtbar, statt sie nur zu spueren
      gesperrt && /* @__PURE__ */ React.createElement("div", { style: {
        width: 110, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.10)", overflow: "hidden"
      } }, /* @__PURE__ */ React.createElement("div", { style: {
        height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
        width: (100 - restMs / SALVO_LOCK_MS * 100).toFixed(1) + "%"
      } }))
    );
  })(),
  // ── Emotes (v3.25.0): Button + Leiste (nur online) ──
  online.current && /* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed", left: 8, bottom: `calc(var(--sa-bottom,0px) + ${barH + 12}px)`,
    zIndex: 1150, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6
  } },
    emoteBarOpen && /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex", gap: 4, padding: "6px 7px", borderRadius: 999,
      background: "linear-gradient(180deg, rgba(30,41,66,0.95), rgba(11,16,30,0.96))",
      border: "1px solid rgba(255,255,255,0.14)",
      boxShadow: "0 8px 26px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)",
      backdropFilter: "blur(10px)", animation: "badgePop 0.22s ease both"
    } }, EMOTES.map((em, i) => /* @__PURE__ */ React.createElement("button", { key: i, onClick: () => sendEmote(i), style: {
      width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.06)", fontSize: 17, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 0
    } }, em))),
    /* @__PURE__ */ React.createElement("button", { onClick: () => setEmoteBarOpen((v) => !v), "aria-label": "Emote", style: {
      width: 36, height: 36, borderRadius: "50%", cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.18)", fontSize: 17, padding: 0,
      background: emoteBarOpen ? "linear-gradient(180deg,#2563eb,#7c3aed)" : "linear-gradient(180deg, rgba(30,41,66,0.92), rgba(11,16,30,0.94))",
      boxShadow: "0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
      display: "flex", alignItems: "center", justifyContent: "center"
    } }, React.createElement(Icon, { name: "smile", size: 18 }))
  ),
  // ── Emote-Bubble: schwebt oben mittig, Spielerfarbe + Name ──
  emoteShow && (() => {
    const pi = playerInfo.current[emoteShow.p] || {};
    const col = pi.color || (emoteShow.p === 1 ? "#2563eb" : emoteShow.p === 2 ? "#dc2626" : "#059669");
    return /* @__PURE__ */ React.createElement("div", { key: "emote" + emoteShow.key, style: {
      position: "fixed", left: 0, right: 0, top: `calc(var(--sa-top,0px) + ${hudH + 42}px)`,
      zIndex: 1240, display: "flex", justifyContent: "center", pointerEvents: "none"
    } },
      /* @__PURE__ */ React.createElement("div", { style: {
        display: "flex", alignItems: "center", gap: 8, padding: "7px 16px 7px 12px", borderRadius: 999,
        background: "linear-gradient(180deg, rgba(30,41,66,0.95), rgba(11,16,30,0.96))",
        border: "1.5px solid " + col,
        boxShadow: "0 8px 30px rgba(0,0,0,0.55), 0 0 18px " + col + "55",
        backdropFilter: "blur(10px)", animation: "badgePop 0.3s cubic-bezier(.36,1.6,.56,1) both"
      } },
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: 26, lineHeight: 1 } }, EMOTES[emoteShow.e] || "👍"),
        pi.name && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 800, color: "#e2e8f0", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pi.name)
      )
    );
  })(), perfSichtbar && /* @__PURE__ */ React.createElement("div", {
    style: { position: "fixed", top: "calc(var(--sa-top, 0px) + 4px)", left: 4, zIndex: 9999,
      background: "rgba(0,0,0,0.72)", color: "#7dd3fc", font: "600 10px ui-monospace, Menlo, monospace",
      padding: "3px 6px", borderRadius: 6, pointerEvents: "none", letterSpacing: "0.02em" }
  }, perfText || "messe \u2026"), tutorialMode.current && coachMsg && /* @__PURE__ */ React.createElement("div", {
    // v3.37.2: Pausierendes Coach-Popup OBEN. Der Vollbild-Container blockiert
    // alle Eingaben (Spiel pausiert: Timer/Bot/Kugeln stehen still); leichter
    // Dim-Hintergrund signalisiert die Pause. "OK" setzt fort.
    style: { position: "fixed", inset: 0, zIndex: 1250, background: "rgba(2,6,15,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", pointerEvents: "auto", // EINE Kurzform. In v3.84.0 stand sie NACH paddingTop/Left/Right und hat die
      // drei ueberschrieben — die Coach-Blase verlor damit ihren Abstand zur
      // Kopfzeile und klebte oben am Rand.
      padding: `calc(var(--sa-top,0px) + ${hudH + 8}px) calc(var(--sa-right,0px) + 8px) var(--sa-bottom,0px) calc(var(--sa-left,0px) + 8px)` }
  }, /* @__PURE__ */ React.createElement("div", {
    key: "coach_" + coachMsg.key,
    style: { maxWidth: 460, width: "100%", background: "linear-gradient(135deg,rgba(124,58,237,0.97),rgba(8,145,178,0.97))", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 14, padding: "10px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", textAlign: "left", animation: "coachPop 0.4s cubic-bezier(.36,1.5,.5,1) both, coachFlash 0.8s ease 0.1s" }
  },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 } },
      /* @__PURE__ */ React.createElement(Icon, { name: "gradCap", size: 15 }),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.82)", letterSpacing: "0.14em" } }, t('coachLabel')),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, fontWeight: 800, color: "#0b1020", background: "rgba(253,230,138,0.95)", borderRadius: 999, padding: "2px 8px", letterSpacing: "0.08em" } }, t('coachPausedTag')),
      /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)" } }, phase === "setup" ? "1/4" : phase === "build" ? "2/4" : phase === "shoot" ? "3/4" : phase === "cannon" ? "4/4" : "✓")
    ),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13.5, fontWeight: 700, color: "#fff", lineHeight: 1.42 } }, t(coachMsg.textKey)),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 9 } },
      /* @__PURE__ */ React.createElement("button", { onClick: () => setCoachMsg(null), style: { flex: 1, background: "rgba(255,255,255,0.95)", border: "none", color: "#1e1b4b", borderRadius: 9, padding: "9px", fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.3)" } }, t('coachOk')),
      /* @__PURE__ */ React.createElement("button", { onClick: () => setShowQuitConfirm(true), style: { background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.32)", color: "#fff", borderRadius: 9, padding: "9px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" } }, t('tutorialExit'))
    )
  )), showTutorialDone && /* @__PURE__ */ React.createElement("div", {
    style: { position: "fixed", inset: 0, zIndex: 1400, background: "rgba(2,6,15,0.9)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 20px) calc(var(--sa-right,0px) + 20px) calc(var(--sa-bottom,0px) + 20px) calc(var(--sa-left,0px) + 20px)" }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { maxWidth: 380, width: "100%", textAlign: "center", background: "linear-gradient(160deg,#15082a,#0f1f2e)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 18, padding: 26, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", animation: "dailyBounceIn 0.45s cubic-bezier(.36,1.6,.56,1) both" }
  },
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 8 } }, t('tutorialDoneTitle')),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#94a3b8", lineHeight: 1.5, marginBottom: 20 } }, t('tutorialDoneText')),
    /* @__PURE__ */ React.createElement("button", { onClick: () => endTutorial(true), style: { width: "100%", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "#fff", border: "none", padding: "14px", fontSize: 16, fontWeight: 800, borderRadius: 12, cursor: "pointer", marginBottom: 9, boxShadow: "0 4px 20px rgba(124,58,237,0.35)" } }, React.createElement(Icon, { name: "globe", size: 15, style: { verticalAlign: "-2px", marginRight: 6 } }), t('tutorialToOnline')),
    /* @__PURE__ */ React.createElement("button", { onClick: () => endTutorial(false), style: { width: "100%", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.12)", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: "pointer" } }, t('mainMenu'))
  )), phaseBanner && (() => { const pb = PHASE_BANNERS[phaseBanner]; const pbTitleKey = phaseBanner === "setup" ? "bannerSetupTitle" : phaseBanner === "build" ? "bannerBuildTitle" : phaseBanner === "shoot" ? "bannerShootTitle" : "bannerCannonTitle"; const pbSubKey = phaseBanner === "setup" ? "bannerSetupSub" : phaseBanner === "build" ? "bannerBuildSub" : phaseBanner === "shoot" ? "bannerShootSub" : "bannerCannonSub"; return /* @__PURE__ */ React.createElement("div", { key: "pb" + phaseBannerKey.current, style: { position: "fixed", top: `calc(var(--sa-top,0px) + ${hudH + 10}px)`, left: "50%", transform: "translateX(-50%)", zIndex: 1200, pointerEvents: "none", textAlign: "left", animation: "phasebanner 2.5s ease forwards", // Ohne width:max-content bleibt das Schild auf der HALBEN Bildschirm-
      // breite haengen: bei left:50% ohne right reicht der Platz eines fest
      // positionierten Kastens nur noch bis zum rechten Rand. Der Text brach
      // deshalb auf drei Zeilen um und deckte ein Drittel des Bretts zu.
      width: "max-content", background: pb.bg, border: `1.5px solid ${pb.color}`, borderRadius: 14, padding: "9px 20px", boxShadow: `0 0 34px ${pb.glow}, 0 6px 24px rgba(0,0,0,0.6)`, maxWidth: "min(92vw,430px)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: 13 } }, /* @__PURE__ */ React.createElement("div", { style: { color: pb.color, display: "flex", flexShrink: 0, filter: `drop-shadow(0 0 12px ${pb.glow})` } }, /* @__PURE__ */ React.createElement(Icon, { name: { setup: "crown", build: "shield", shoot: "flame", cannon: "target" }[phaseBanner] || "shield", size: 26 })), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 17, fontWeight: 900, color: pb.color, letterSpacing: "0.04em", textShadow: `0 0 16px ${pb.glow}`, lineHeight: 1.15 } }, t(pbTitleKey)), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: 600, lineHeight: 1.3 } }, t(pbSubKey)))); })(), /* @__PURE__ */ React.createElement("div", { style: buehneStil }, /* @__PURE__ */ React.createElement("div", { style: {
    width: viewSize.w,
    height: viewSize.h,
    border: buildUrgencyOpen ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: buildUrgencyOpen ? undefined : "0 8px 40px rgba(0,0,0,0.7)",
    animation: buildUrgencyOpen ? "dangerGlow 0.6s ease-in-out infinite" : undefined,
    position: "relative"
  } }, /* @__PURE__ */ React.createElement(
    "canvas",
    {
      ref: canvasRef,
      width: W,
      height: H,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style: {
        display: "block",
        width: viewSize.w,
        height: viewSize.h,
        touchAction: "none",
        cursor: phase === "build" || phase === "cannon" || phase === "setup" ? "crosshair" : "default"
      }
    }
  ))), /* @__PURE__ */ React.createElement("div", { ref: bottomBarRef, style: {
    width: vollB,
    height: barH,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-between",
    padding: "4px 2px",
    boxSizing: "border-box",
    gap: 6
  } }, phase === "build" ? React.createElement(React.Fragment, null,
    (!online.current || myRole.current === 1) && piecePanel(1),
    // Bot-Modus (v3.30.1): Die Hand des Bots (P2) wird NICHT angezeigt — wie
    // online sieht man nur das eigene nächste Teil (kein Info-Vorteil/Clutter).
    (!online.current && !botMode.current || online.current && myRole.current === 2) && piecePanel(2),
    (!online.current && numPlayers === 3 || online.current && myRole.current === 3) && piecePanel(3)
  ) : phase === "shoot" ? React.createElement(React.Fragment, null,
    (!online.current || myRole.current === 1) && readyPanel(1),
    (!online.current && !botMode.current || online.current && myRole.current === 2) && readyPanel(2),
    (!online.current && numPlayers === 3 || online.current && myRole.current === 3) && readyPanel(3)
  ) : null), showQuitConfirm &&/* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,15,0.78)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    padding: 20
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(165deg, rgba(16,32,54,0.85), rgba(8,18,37,0.9))",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 24,
    maxWidth: 340,
    width: "100%",
    textAlign: "center",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10, color: "#f87171", display: "flex", justifyContent: "center" } }, /* @__PURE__ */ React.createElement(Icon, { name: "x", size: 30 })), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 6px", fontSize: 20 } }, t('quitTitle')), /* @__PURE__ */ React.createElement("p", { style: { color: "#64748b", fontSize: 13, marginBottom: 22 } }, online.current ? t('quitMsgOnline') : t('quitMsgLocal')), /* @__PURE__ */ React.createElement("button", { onClick: quitGame, style: {
    width: "100%",
    background: "linear-gradient(135deg,#ef4444,#991b1b)",
    color: "white",
    border: "1px solid rgba(239,68,68,0.5)",
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 14,
    cursor: "pointer",
    marginBottom: 10,
    boxShadow: "0 4px 20px rgba(239,68,68,0.3)"
  } }, t('quitYes')), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowQuitConfirm(false), style: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "13px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 14,
    cursor: "pointer"
  } }, t('quitContinue')))));
};

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(React.createElement(window.StackSiegeApp));
// Ein Lebenszeichen fuer die Browser-Konsole und den Web-Inspektor.
//
// **Es taugt NICHT als Pruefung fuer die App.** Der erste Versuch suchte diese
// Zeile im Systemprotokoll von iOS; im Lauf nachgemessen: 983 Protokollzeilen
// der App, kein Marker. WebKit reicht Konsolenausgaben an den Web-Inspektor
// weiter, nicht an os_log. Der Marker, an dem der Simulator-Probelauf haengt,
// kommt deshalb aus SpielViewController (ios/App/App/SceneDelegate.swift),
// sobald die erste Nachricht ueber die Bruecke geht.
//
// Hier bleibt die Zeile trotzdem: Im Browser und im Web-Inspektor sieht man
// damit auf einen Blick, ob die Oberflaeche gestartet ist und welche Fassung
// laeuft.
console.log('STACK-SIEGE-BEREIT ' + (document.title || '').replace(/^\D+/, ''));
setTimeout(() => { const s = document.getElementById('splash'); if (s) { s.style.opacity='0'; setTimeout(()=>s.remove(),500); } }, 600);
// **Der Hinweis „Zum Home-Bildschirm" gehoert NUR in den Browser.**
//
// In der App war er sichtbar, und das ergab dort keinen Sinn: Sie IST schon
// installiert. Die alte Bedingung konnte das nicht erkennen — in Capacitors
// WebView steht „iPhone" im Kennzeichen, und `navigator.standalone` gibt es
// dort gar nicht (eine reine Safari-Eigenschaft). `!undefined` ist wahr, also
// erschien der Hinweis ausgerechnet da, wo er falsch ist.
//
// Geprueft wird deshalb ueber die EINE Plattform-Weiche (ARCHITEKTUR.md E7),
// nicht ueber ein weiteres selbstgebautes Merkmal.
// Sicherheitsnetz fuer die iOS-Text-Lupe: Fokus in einem Feld schaltet die
// Textbedienung IMMER ein. Das Ausschalten haengt am Bildschirm — siehe den
// Effekt in der Komponente und die Begruendung in platform.ts.
lupeNurInTextfeldern();

const _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (!istNativ() && _isIOS && !window.navigator.standalone && !localStorage.getItem('_fh')) {
  setTimeout(() => { document.getElementById('ios-hint').style.display='block'; localStorage.setItem('_fh','1'); }, 3500);
}
