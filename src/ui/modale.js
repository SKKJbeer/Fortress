// Die grossen Modale und Effekte (aus src/game/app.js herausgeloest, v3.98.0).
//
// Vierter Schnitt beim Abtragen des Grossblocks (ARCHITEKTUR.md, Schritt 8).
// Anders als die kleinen Anzeigen aus v3.96.0 hingen diese hier am Abschluss —
// an `t` (Uebersetzung, haengt an der Sprachwahl) und an `achTitle`/`achDesc`
// (dasselbe fuer Achievement-Texte). Das steht jetzt in den Signaturen.
//
// **Warum Requisiten und kein Kontext:** Ein React-Kontext waere weniger zu
// tippen, aber er versteckt die Abhaengigkeit wieder. In der Signatur kann man
// sie lesen und im Test einsetzen; genau das war der Zweck des Umzugs.
//
// `forgeRarity` ist nicht mitgekommen — das ist reine Logik und steht seit
// v3.98.0 in `engine/catalog.ts`, wo die Rezepte selbst liegen.
import React from "react";
import { useState, useEffect } from "react";
import { Icon } from "./icons.js";
// WinFx baut auf dem Konfetti aus v3.96.0 auf.
import { ConfettiBurst } from "./anzeigen.js";
import { ACHIEVEMENTS } from "../engine/achievements.js";
import { CANNON_SKIN, IMPACT_FX, TRAIL_COLOR, TRAIL_FORM, MASTER_TRAIL, WIN_ICON, forgeRarity }
  from "../engine/catalog.ts";
import { xpToNextLevel } from "../engine/progression.ts";
import { DAILY_REWARDS, getDailyCollectable, getDailyStreakIndex, dailyWeekMult, dailyReward, msTillMidnight } from "../engine/daily.ts";
import { AVATAR_UNLOCKS } from "./wappen.js";
import { __spreadValues, __spreadProps } from "../spread.js";

export // Sieges-Effekt (v3.23.0, SPEC 14.4): Kosmetik auf dem Result-Screen.
// Deterministisch (keine Math.random) wie ConfettiBurst; fixed overlay,
// rein dekorativ (pointerEvents none).
function WinFx({ kind }) {
  if (kind === "win_fireworks") {
    const bursts = Array.from({ length: 6 }, (_, i) => {
      const left = 15 + (i * 37) % 70;
      const top = 8 + (i * 23) % 34;
      const hue = ["#fbbf24", "#f87171", "#60a5fa", "#4ade80", "#e879f9", "#22d3ee"][i];
      const delay = (i * 0.35).toFixed(2);
      return React.createElement("div", { key: i, style: {
        position: "absolute", left: left + "%", top: top + "%", width: 8, height: 8,
        borderRadius: "50%", background: hue,
        boxShadow: "0 0 18px 4px " + hue,
        animation: "fwBurst 1.6s " + delay + "s ease-out infinite", pointerEvents: "none"
      } });
    });
    return React.createElement("div", { className: "kein-zoom", style: { position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 } }, ...bursts);
  }
  if (kind === "win_goldrain") {
    // Gezeichnete Münzen statt Emoji (v3.29.1): Gold-Verlauf + Prägerand
    const coins = Array.from({ length: 14 }, (_, i) => {
      const left = 4 + (i * 41) % 92;
      const delay = ((i * 0.23) % 1.6).toFixed(2);
      const dur = (2 + (i * 0.13) % 1.2).toFixed(2);
      const s = 12 + (i % 3) * 5;
      return React.createElement("span", { key: i, style: {
        position: "absolute", left: left + "%", top: "-6%",
        width: s, height: s, borderRadius: "50%", display: "block",
        background: "radial-gradient(circle at 32% 28%, #fef3c7 0%, #fbbf24 45%, #b45309 100%)",
        boxShadow: "inset 0 0 0 1.5px rgba(180,83,9,0.55), 0 0 8px rgba(251,191,36,0.7)",
        animation: "coinFall " + dur + "s " + delay + "s linear infinite", pointerEvents: "none"
      } });
    });
    return React.createElement("div", { className: "kein-zoom", style: { position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 } }, ...coins);
  }
  // Standard: Konfetti über die volle Breite
  return React.createElement("div", { className: "kein-zoom", style: { position: "fixed", left: 0, right: 0, top: 0, pointerEvents: "none", zIndex: 5 } },
    React.createElement(ConfettiBurst, { active: true }));
}

export function rarityMeta(r, t) {
  const M = {
    common:    { key: "common",    c: "#94a3b8", glow: "148,163,184", label: t("rarityCommon") },
    rare:      { key: "rare",      c: "#60a5fa", glow: "59,130,246",   label: t("rarityRare") },
    epic:      { key: "epic",      c: "#c084fc", glow: "168,85,247",   label: t("rarityEpic") },
    legendary: { key: "legendary", c: "#fbbf24", glow: "251,191,36",   label: t("rarityLegendary") }
  };
  return M[r] || M.common;
}

export // Große Item-Darstellung fürs Reveal (skaliert, gleiche Katalog-Daten wie die
// Mini-Vorschau in der Schmiede).
function forgeItemVisual(rec, S) {
  const h = React.createElement;
  if (rec.cat === "cannon") {
    const sk = CANNON_SKIN[rec.id];
    return h("div", { style: {
      width: S, height: S, borderRadius: "50%", position: "relative",
      background: "radial-gradient(circle at 34% 28%, " + sk.dome[0] + " 0%, " + sk.dome[1] + " 55%, " + sk.dome[2] + " 100%)",
      boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), 0 0 " + (S * 0.4) + "px " + sk.core + "99",
      border: "2px solid rgba(255,255,255,0.28)"
    } }, h("span", { style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: S * 0.24, height: S * 0.24, borderRadius: "50%", background: sk.core, boxShadow: "0 0 " + (S * 0.18) + "px " + sk.core } }));
  }
  if (rec.cat === "impact") {
    const fx = IMPACT_FX[rec.id];
    return h("div", { style: {
      width: S, height: S, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(" + fx.ring[0] + ",0.98) 0%, rgba(" + fx.ring[1] + ",0.9) 42%, rgba(" + fx.ring[2] + ",0.5) 72%, rgba(0,0,0,0) 100%)"
    } });
  }
  const pal = MASTER_TRAIL[rec.id] || [];
  return h("div", { style: { display: "flex", alignItems: "center", gap: S * 0.07 } },
    pal.map((c, i) => h("span", { key: i, style: { width: S * (0.26 + i * 0.1), height: S * (0.26 + i * 0.1), borderRadius: "50%", background: c, boxShadow: "0 0 " + (S * 0.16) + "px " + c } })));
}

export function AchievementPopup({ item, onDone , achTitle }) {
  const [vis, setVis] = React.useState(false);
  React.useEffect(() => {
    const t1 = setTimeout(() => setVis(true), 50);
    const t2 = setTimeout(() => setVis(false), 3200);
    const t3 = setTimeout(() => onDone(), 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return React.createElement("div", { style: {
    position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
    zIndex: 9999, pointerEvents: "none", textAlign: "center",
    opacity: vis ? 1 : 0, transition: "opacity 0.4s ease",
    background: "linear-gradient(135deg,rgba(124,58,237,0.97),rgba(2,132,199,0.97))",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 16, padding: "12px 20px", minWidth: 240, maxWidth: 300,
    boxShadow: "0 0 40px rgba(124,58,237,0.7),0 8px 32px rgba(0,0,0,0.6)",
    backdropFilter: "blur(20px)"
  } },
    React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 } },
      React.createElement(Icon, { name: "trophy", size: 11, color: "#fbbf24" }), "ACHIEVEMENT"),
    React.createElement("div", { style: { marginBottom: 4, display: "flex", justifyContent: "center", color: "#fff" } },
      React.createElement(Icon, { name: item.icon, size: 22 })),
    React.createElement("div", { style: { fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 6 } }, achTitle(item)),
    React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center" } },
      item.xp > 0 && React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.18)", padding: "2px 8px", borderRadius: 8 } }, "+" + item.xp + " XP"),
      item.gold > 0 && React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.18)", padding: "2px 8px", borderRadius: 8 } }, "+" + item.gold + " Gold")
    )
  );
}

export function AchievementsModal({ profile: prof, onClose , t, achTitle, achDesc }) {
  const achs = Array.isArray(prof && prof.achievements) ? prof.achievements : [];
  const unlockedCount = achs.filter(a => a.unlocked).length;
  const cats = [
    { key: 'siege',       icon: 'swords',   label: t('achcat_siege'),       color: '#f87171' },
    { key: 'spiele',      icon: 'gamepad',  label: t('achcat_spiele'),       color: '#60a5fa' },
    { key: 'zerstoerung', icon: 'bomb',     label: t('achcat_zerstoerung'),  color: '#fb923c' },
    { key: 'gold',        icon: 'coins',    label: t('achcat_gold'),         color: '#fbbf24' },
    { key: 'elo',         icon: 'barChart', label: t('achcat_elo'),          color: '#a78bfa' },
    { key: 'serien',      icon: 'flame',    label: t('achcat_serien'),       color: '#34d399' },
  ];
  return React.createElement("div", { style: {
    position: "fixed", inset: 0, zIndex: 3000,
    background: "rgba(2,6,15,0.85)", backdropFilter: "blur(18px)",
    display: "flex", flexDirection: "column", alignItems: "center",
    // **Oben MUSS der Sicherheitsabstand mit.** `position: fixed` sitzt am
    // Sichtfenster, nicht im Koerper — die Polsterung des Koerpers gilt hier
    // also nicht. Ohne diese Zeile lag die Ueberschrift unter der Uhrzeit und
    // der Schliessen-Knopf hinter der Batterieanzeige.
    padding: "var(--sa-top,0px) var(--sa-right,0px) var(--sa-bottom,0px) var(--sa-left,0px)"
  } },
    React.createElement("div", { style: {
      width: "100%", maxWidth: 480,
      display: "flex", flexDirection: "column", height: "100%"
    } },
      React.createElement("div", { style: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0
      } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 7 } },
            React.createElement(Icon, { name: "trophy", size: 17, color: "#fbbf24" }), "Achievements"),
          React.createElement("div", { style: { fontSize: 11, color: "#64748b", marginTop: 2 } },
            t('achUnlocked', { n: unlockedCount, total: ACHIEVEMENTS.length })
          )
        ),
        React.createElement("button", { onClick: onClose, "aria-label": "Schlie\xDFen", style: {
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
          color: "#94a3b8", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13
        } }, React.createElement(Icon, { name: "x", size: 14 }))
      ),
      React.createElement("div", { style: { overflowY: "auto", flex: 1, padding: "12px 14px 20px" } },
        cats.map(cat => {
          const catAchs = ACHIEVEMENTS.filter(d => d.cat === cat.key);
          return React.createElement("div", { key: cat.key, style: { marginBottom: 18 } },
            React.createElement("div", { style: {
              fontSize: 11, fontWeight: 800, color: cat.color, letterSpacing: "0.1em",
              marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.06)"
            } }, React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 5 } },
              React.createElement(Icon, { name: cat.icon, size: 12 }), cat.label)),
            catAchs.map(def => {
              const entry = achs.find(a => a.id === def.id);
              const unlocked = !!(entry && entry.unlocked);
              const progress = entry ? entry.progress : 0;
              const pct = Math.min(100, Math.round(progress / def.target * 100));
              const isHidden = def.hidden && !unlocked;
              return React.createElement("div", { key: def.id, style: {
                display: "flex", alignItems: "flex-start", gap: 12,
                background: unlocked ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)",
                border: unlocked ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "10px 12px", marginBottom: 8,
                opacity: unlocked ? 1 : 0.7
              } },
                React.createElement("div", { style: {
                  lineHeight: 1, flexShrink: 0, width: 36, display: "flex", justifyContent: "center", paddingTop: 2,
                  color: unlocked ? "#e2e8f0" : "#64748b"
                } }, React.createElement(Icon, { name: isHidden ? "helpCircle" : def.icon, size: 26 })),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                  React.createElement("div", { style: {
                    fontWeight: 800, fontSize: 13, color: unlocked ? "#e2e8f0" : "#94a3b8",
                    marginBottom: 2
                  } }, isHidden ? "???" : achTitle(def)),
                  React.createElement("div", { style: { fontSize: 11, color: "#475569", marginBottom: 6 } },
                    isHidden ? t('achSecret') : achDesc(def)
                  ),
                  !unlocked && React.createElement("div", { style: { marginBottom: 6 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 3 } },
                      React.createElement("span", { style: { fontSize: 9, color: "#334155" } }, progress + " / " + def.target),
                      React.createElement("span", { style: { fontSize: 9, color: "#334155" } }, pct + "%")
                    ),
                    React.createElement("div", { style: { height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" } },
                      React.createElement("div", { style: {
                        height: "100%", width: pct + "%",
                        background: "linear-gradient(90deg," + cat.color + "99," + cat.color + ")",
                        borderRadius: 2, transition: "width 0.4s ease"
                      } })
                    )
                  ),
                  unlocked && React.createElement("div", { style: { fontSize: 10, color: "#22d3ee", marginBottom: 6, fontWeight: 700 } }, t('achDone')),
                  React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                    def.xp > 0 && React.createElement("span", { style: {
                      fontSize: 10, fontWeight: 700, color: "#a78bfa",
                      background: "rgba(167,139,250,0.15)", padding: "2px 7px", borderRadius: 6,
                      border: "1px solid rgba(167,139,250,0.25)"
                    } }, "+" + def.xp + " XP"),
                    def.gold > 0 && React.createElement("span", { style: {
                      fontSize: 10, fontWeight: 700, color: "#fbbf24",
                      background: "rgba(251,191,36,0.12)", padding: "2px 7px", borderRadius: 6,
                      border: "1px solid rgba(251,191,36,0.25)"
                    } }, "+" + def.gold + " Gold")
                  )
                )
              );
            })
          );
        })
      )
    )
  );
}

export function ItemRevealModal({ rec, onClose , t }) {
  const h = React.createElement;
  const rar = rarityMeta(forgeRarity(rec), t);
  const [vis, setVis] = React.useState(false);
  React.useEffect(() => { const t1 = setTimeout(() => setVis(true), 30); return () => clearTimeout(t1); }, []);
  const catLabel = rec.cat === "cannon" ? t("forgeCatCannon") : rec.cat === "impact" ? t("forgeCatImpact") : t("forgeCatTrail");
  const legendary = rar.key === "legendary";
  // Deterministische Funken rund um die Medaille (keine Math.random).
  const sparks = Array.from({ length: 16 }, (_, i) => {
    const ang = (i / 16) * Math.PI * 2;
    const rad = 92 + (i % 3) * 16;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad * 0.82;
    const delay = ((i * 0.11) % 1.4).toFixed(2);
    const sz = 4 + (i % 3) * 2;
    return h("span", { key: i, style: {
      position: "absolute", left: "calc(50% + " + x.toFixed(0) + "px)", top: "calc(44% + " + y.toFixed(0) + "px)",
      width: sz, height: sz, borderRadius: "50%", background: rar.c,
      boxShadow: "0 0 " + (sz + 3) + "px " + rar.c, pointerEvents: "none",
      animation: "sparkFloat 1.8s " + delay + "s ease-out infinite"
    } });
  });
  const badgeStyle = legendary
    ? { backgroundImage: "linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b,#fbbf24,#fde68a)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "legShimmer 2s linear infinite, revealBurstIn 0.5s 0.28s both" }
    : { color: rar.c, animation: "revealBurstIn 0.5s 0.28s both" };
  return h("div", { onClick: onClose, style: {
    position: "fixed", inset: 0, zIndex: 3000, cursor: "pointer", overflow: "hidden",
    background: "radial-gradient(ellipse at center 44%, rgba(" + rar.glow + ",0.14) 0%, rgba(2,4,10,0.95) 60%)",
    backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "calc(var(--sa-top,0px) + 24px) calc(var(--sa-right,0px) + 24px) calc(var(--sa-bottom,0px) + 24px) calc(var(--sa-left,0px) + 24px)"
  } },
    // Einmaliger Farbblitz
    h("div", { style: { position: "fixed", inset: 0, background: "rgba(" + rar.glow + ",0.55)", pointerEvents: "none", animation: "revealFlash 0.7s ease-out both" } }),
    // Rotierende Lichtstrahlen
    h("div", { style: {
      position: "absolute", left: "50%", top: "44%", width: 560, height: 560,
      opacity: vis ? 1 : 0, transition: "opacity 0.6s ease", pointerEvents: "none", borderRadius: "50%",
      background: "repeating-conic-gradient(from 0deg, rgba(" + rar.glow + ",0) 0deg, rgba(" + rar.glow + ",0.22) 5deg, rgba(" + rar.glow + ",0) 11deg)",
      animation: "revealSpin " + (legendary ? 10 : 16) + "s linear infinite",
      WebkitMaskImage: "radial-gradient(circle, #000 26%, transparent 66%)", maskImage: "radial-gradient(circle, #000 26%, transparent 66%)"
    } }),
    h("div", { style: { fontSize: 12, fontWeight: 900, letterSpacing: "0.28em", color: "rgba(255,255,255,0.85)", marginBottom: 16, textTransform: "uppercase", animation: "revealBurstIn 0.5s 0.12s both" } }, t("forgeRevealNew")),
    // Medaille mit pulsierendem Halo
    h("div", { style: { position: "relative", marginBottom: 22, animation: "revealBurstIn 0.6s cubic-bezier(.2,1.5,.4,1) both" } },
      h("div", { style: { position: "absolute", left: "50%", top: "50%", width: 230, height: 230, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(" + rar.glow + ",0.5) 0%, transparent 68%)", filter: "blur(6px)", animation: "revealHalo 2.2s ease-in-out infinite", pointerEvents: "none" } }),
      h("div", { style: { position: "relative", width: 152, height: 152, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 40% 32%, rgba(30,36,52,0.92), rgba(6,9,16,0.97))", border: "2px solid rgba(" + rar.glow + ",0.85)", boxShadow: "0 0 44px rgba(" + rar.glow + ",0.6), inset 0 0 30px rgba(" + rar.glow + ",0.22)" } },
        forgeItemVisual(rec, rec.cat === "trail" ? 118 : 94))
    ),
    ...sparks,
    h("div", { style: __spreadValues({ fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", padding: "5px 20px", borderRadius: 999, border: "1.5px solid " + rar.c, marginBottom: 12, textShadow: "0 0 14px rgba(" + rar.glow + ",0.8)", background: "rgba(" + rar.glow + ",0.08)" }, badgeStyle) }, rar.label),
    h("div", { style: { fontSize: "clamp(23px,7vw,32px)", fontWeight: 900, color: "#fff", textAlign: "center", textShadow: "0 0 24px rgba(" + rar.glow + ",0.7)", marginBottom: 6, animation: "revealBurstIn 0.5s 0.34s both" } }, t("cos_" + rec.id)),
    h("div", { style: { fontSize: 12, color: "#94a3b8", marginBottom: 30, animation: "revealBurstIn 0.5s 0.4s both" } }, catLabel + " · " + t("forgeRevealEquipped")),
    h("div", { style: { fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", animation: "glowpulse 1.6s ease-in-out infinite" } }, t("forgeRevealTap"))
  );
}

export // Animierter XP-Reward-Screen nach Online-Spiel
function XpResultAnim({ xpChange , t }) {
  const [started, setStarted] = useState(false);
  const [showLvlUp, setShowLvlUp] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setStarted(true), 350);
    const t2 = xpChange.newLevel > xpChange.oldLevel
      ? setTimeout(() => setShowLvlUp(true), 1100)
      : null;
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, []);
  const needed = xpToNextLevel(xpChange.newLevel);
  const startPct = Math.min(100, xpChange.oldXp / xpToNextLevel(xpChange.oldLevel) * 100);
  const endPct = Math.min(100, xpChange.newXp / needed * 100);
  const pct = started ? endPct : startPct;
  const nextUnlockEntry = Object.entries(AVATAR_UNLOCKS).filter(([, lvl]) => lvl > xpChange.newLevel).sort(([, a], [, b]) => a - b)[0];
  return React.createElement("div", { style: { marginTop: 0, marginBottom: 0 } },
    showLvlUp && React.createElement(ConfettiBurst, { active: true }),
    showLvlUp && React.createElement("div", { style: {
      background: "linear-gradient(135deg,rgba(251,191,36,0.15),rgba(167,139,250,0.15))",
      border: "1.5px solid rgba(251,191,36,0.6)",
      borderRadius: 14, padding: "8px 16px", marginBottom: 8,
      textAlign: "center",
      animation: "lvlUpFlash 0.55s cubic-bezier(.36,1.6,.56,1) both",
      boxShadow: "0 2px 18px rgba(251,191,36,0.15)"
    } },
      React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: "#fbbf24", letterSpacing: "0.18em", textShadow: "0 0 18px rgba(251,191,36,0.8)" } }, "★ LEVEL UP! ★"),
      React.createElement("div", { style: { fontSize: 12, color: "#a78bfa", marginTop: 3, fontWeight: 700 } }, "Level " + xpChange.oldLevel + " → Level " + xpChange.newLevel)
    ),
    React.createElement("div", { style: {
      background: "rgba(167,139,250,0.09)", border: "1px solid rgba(167,139,250,0.28)",
      borderRadius: 14, padding: "11px 18px", textAlign: "center",
      boxShadow: "0 2px 18px rgba(167,139,250,0.12)"
    } },
      React.createElement("div", { style: { fontSize: 9, color: "#64748b", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 } }, "XP"),
      React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: "#a78bfa", marginBottom: 8, textShadow: "0 0 16px rgba(167,139,250,0.7)", animation: "xpNumPop 0.4s ease" } }, "+" + xpChange.xpGained + " XP"),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 6 } },
        React.createElement("span", null, "Level " + xpChange.newLevel),
        React.createElement("span", null, xpChange.newXp + " / " + needed)
      ),
      React.createElement("div", { style: { height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden", position: "relative" } },          React.createElement("div", { style: {
          position: "absolute", top: 0, left: 0, height: "100%",
          width: pct + "%",
          background: "linear-gradient(90deg,#7c3aed,#22d3ee)",
          borderRadius: 6,
          boxShadow: "0 0 14px rgba(124,58,237,0.8)",
          transition: started ? "width 1s cubic-bezier(0.34,1.1,0.64,1)" : "none"
        } })
      )
    ),
    nextUnlockEntry && React.createElement("div", { style: { marginTop: 6, fontSize: 10, color: "#64748b", textAlign: "center", fontStyle: "italic" } },
      t('nextRewardAt', { n: nextUnlockEntry[1] })
    )
  );
}

export // ── Onboarding / Tutorial (Erstkontakt-Anleitung in 5 Slides) ──────────────
function OnboardingModal({ step, setStep, onFinish , t }) {
  const steps = [
    { icon: "swords", col: "#a78bfa", title: t('onbWelcomeTitle'), text: t('onbWelcomeText') },
    { icon: "crown",  col: "#22d3ee", title: t('onbStep1Title'),   text: t('onbStep1Text') },
    { icon: "shield", col: "#4ade80", title: t('onbStep2Title'),   text: t('onbStep2Text') },
    { icon: "flame",  col: "#f87171", title: t('onbStep3Title'),   text: t('onbStep3Text') },
    { icon: "trophy", col: "#fbbf24", title: t('onbStep4Title'),   text: t('onbStep4Text') }
  ];
  const i = Math.min(Math.max(step, 0), steps.length - 1);
  const cur = steps[i];
  const isLast = i >= steps.length - 1;
  return React.createElement("div", {
    style: { position: "fixed", inset: 0, background: "rgba(5,8,15,0.95)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "calc(var(--sa-top,0px) + 20px) calc(var(--sa-right,0px) + 20px) calc(var(--sa-bottom,0px) + 20px) calc(var(--sa-left,0px) + 20px)" }
  },
    React.createElement("div", { style: {
      background: "linear-gradient(160deg,#0f1f2e,#15082a)", border: "1px solid rgba(124,58,237,0.3)",
      borderRadius: 18, padding: 24, maxWidth: 380, width: "100%", textAlign: "center",
      animation: "dailyBounceIn 0.45s cubic-bezier(.36,1.6,.56,1) both", boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
    } },
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", minHeight: 18, marginBottom: 2 } },
        !isLast && React.createElement("button", { onClick: onFinish, style: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 600 } }, t('onbSkip'))
      ),
      React.createElement("div", { key: "onbico" + i, style: { marginBottom: 12, display: "flex", justifyContent: "center", animation: "badgePop 0.4s ease both" } },
        React.createElement("div", { style: { width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid " + cur.col + "55", boxShadow: "0 0 24px " + cur.col + "33" } },
          React.createElement(Icon, { name: cur.icon, size: 38, color: cur.col })
        )
      ),
      React.createElement("h2", { style: { margin: "0 0 8px", fontSize: 21, color: "#f1f5f9", fontWeight: 800 } }, cur.title),
      React.createElement("p", { style: { color: "#94a3b8", fontSize: 14, lineHeight: 1.55, marginBottom: 18, minHeight: 88 } }, cur.text),
      React.createElement("div", { style: { display: "flex", gap: 7, justifyContent: "center", marginBottom: 18 } },
        steps.map((_, k) => React.createElement("div", { key: k, onClick: () => setStep(k), style: { width: k === i ? 22 : 8, height: 8, borderRadius: 4, background: k === i ? cur.col : "rgba(255,255,255,0.18)", cursor: "pointer", transition: "all 0.25s ease" } }))
      ),
      React.createElement("div", { style: { display: "flex", gap: 8 } },
        i > 0 && React.createElement("button", { onClick: () => setStep(i - 1), style: { flex: "0 0 auto", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.12)", padding: "14px 18px", fontSize: 15, fontWeight: 700, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 } },
          React.createElement(Icon, { name: "chevronDown", size: 15, style: { transform: "rotate(90deg)" } }), t('onbBack')),
        React.createElement("button", { onClick: () => isLast ? onFinish() : setStep(i + 1), style: { flex: 1, background: isLast ? "linear-gradient(135deg,#16a34a,#4ade80)" : "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", border: "none", padding: "14px", fontSize: 16, fontWeight: 800, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: isLast ? "0 4px 20px rgba(74,222,128,0.35)" : "0 4px 20px rgba(124,58,237,0.35)" } },
          isLast ? t('onbStart') : t('onbNext'),
          !isLast && React.createElement(Icon, { name: "chevronDown", size: 16, style: { transform: "rotate(-90deg)" } }))
      )
    )
  );
}

export function DailyRewardModal({ daily, onCollect, onClose, collected, t }) {
  const [collecting, setCollecting] = useState(false);
  const canCollect = getDailyCollectable(daily);
  const streakIdx = getDailyStreakIndex(daily);
  const baseReward = DAILY_REWARDS[streakIdx];
  const mult = dailyWeekMult(daily && daily.streak);
  const week = Math.floor(((daily && daily.streak) || 0) / 7) + 1;
  // Effektive Belohnung inkl. Treue-Bonus. Die Rechnung steht seit v3.97.0 in
  // `engine/daily.ts` und ist dort durchgerechnet — Anzeige UND Vergabe
  // nehmen denselben Wert, weil `onCollect` genau dieses Objekt bekommt.
  // Stuenden im Kalender andere Zahlen als auf dem Konto, waere das ein
  // gebrochenes Versprechen und kein Anzeigefehler.
  const reward = dailyReward(daily);
  const msLeft = msTillMidnight();
  const hLeft = Math.floor(msLeft / 3600000);
  const mLeft = Math.floor((msLeft % 3600000) / 60000);
  function handleCollect() {
    if (!canCollect || collecting || collected) return;
    setCollecting(true);
    setTimeout(() => onCollect(reward, streakIdx), 350);
  }
  const days = DAILY_REWARDS.map((r, i) => {
    const isPast = i < streakIdx;
    const isCurrent = i === streakIdx;
    return React.createElement("div", { key: i, style: {
      flex: 1, textAlign: "center",
      background: isCurrent ? "rgba(251,191,36,0.18)" : isPast ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
      border: "1px solid " + (isCurrent ? "rgba(251,191,36,0.6)" : isPast ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"),
      borderRadius: 8, padding: "6px 2px",
      animation: isCurrent ? "streakGlow 2s ease infinite" : "none"
    } },
      React.createElement("div", { style: { fontSize: 8, color: "#64748b", marginBottom: 2 } }, "T" + (i + 1)),
      React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: isCurrent ? "#fbbf24" : isPast ? "#4ade80" : "#475569" } },
        isPast ? "✓" : r.special === "chest" ? "★" : "+" + Math.round(r.gold * mult) + "G"
      )
    );
  });
  return React.createElement("div", {
    style: { position: "fixed", inset: 0, background: "rgba(5,8,15,0.94)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "calc(var(--sa-top,0px) + 20px) calc(var(--sa-right,0px) + 20px) calc(var(--sa-bottom,0px) + 20px) calc(var(--sa-left,0px) + 20px)" }
  },
    React.createElement("div", { style: {
      background: "linear-gradient(160deg,#0f1f2e,#15082a)", border: "1px solid rgba(251,191,36,0.3)",
      borderRadius: 16, padding: 24, maxWidth: 360, width: "100%", textAlign: "center",
      animation: "dailyBounceIn 0.45s cubic-bezier(.36,1.6,.56,1) both"
    } },
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end" } },
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "#475569", cursor: "pointer" } },
          React.createElement(Icon, { name: "x", size: 18 })
        )
      ),
      React.createElement("div", { style: { marginBottom: 4, color: "#fbbf24", display: "flex", justifyContent: "center" } },
        React.createElement(Icon, { name: "zap", size: 28, color: "#fbbf24" })
      ),
      React.createElement("h2", { style: { margin: "0 0 4px", fontSize: 20, color: "#f1f5f9" } }, t('dailyTitle')),
      React.createElement("p", { style: { color: "#64748b", fontSize: 12, marginBottom: mult > 1 ? 6 : 16 } }, t('dailyStreak', { n: daily.streak || 0 })),
      mult > 1 && React.createElement("div", { style: { display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 14, background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.45)", color: "#fdba74", borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", animation: "streakGlow 2s ease infinite" } }, React.createElement(Icon, { name: "flame", size: 12 }), t('dailyLoyalty', { m: mult, w: week })),
      React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 16 } }, ...days),
      collected
        ? React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: "#4ade80", marginBottom: 12, animation: "collectBounce 0.5s ease" } }, t('dailyCollected'))
        : canCollect
          ? React.createElement("div", { style: { marginBottom: 12 } },
              React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: "#fbbf24" } }, "+" + reward.gold + " Gold"),
              reward.xp > 0 && React.createElement("div", { style: { fontSize: 14, color: "#a78bfa", marginTop: 4 } }, "+" + reward.xp + " XP"),
              reward.special === "chest" && React.createElement("div", { style: { fontSize: 12, color: "#22d3ee", marginTop: 4 } }, t('dailyChest'))
            )
          : React.createElement("div", { style: { fontSize: 13, color: "#64748b", marginBottom: 12 } }, t('dailyNextIn', { h: hLeft, m: mLeft })),
      canCollect && !collected && React.createElement("button", {
        onClick: handleCollect,
        style: { width: "100%", background: "linear-gradient(135deg,#ca8a04,#fbbf24)", color: "#0a0a0a", border: "none", padding: "15px", fontSize: 16, fontWeight: 900, borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 20px rgba(251,191,36,0.4)" }
      }, t('dailyCollect'))
    )
  );
}
