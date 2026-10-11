#!/usr/bin/env python3
"""Einmaliger Umbau alter Inline-Stile auf das Designsystem src/ui/stil.js (v3.121.0).

Erkennt drei Muster in React.createElement-Aufrufen und ersetzt die SICHTBAREN
Eigenschaften (Hintergrund, Rand, Schatten, Schrift) durch Bausteine; Layout
(Breite, Abstaende, Ausrichtung, zIndex) bleibt unangetastet:

  KNOPF    <button> mit kraeftigem Zwei-Farben-Verlauf und weisser Schrift
           -> ...knopf(variante)   (Variante nach dem ersten Farbton)
  PANEL    Kasten mit dunklem Glas-Verlauf (rgba(16..54,…)) und hellem Rand
           -> ...panel()
  NEBENKNOPF <button> volle Breite mit hellem Glas (rgba(255,255,255,0.02–0.12))
           -> ...knopf("grau")    (Zurueck, Abbrechen, Weiterspielen …)
  SCHLEIER fester Vollbild-Kasten mit rgba(2,6,15,…) und Unschaerfe
           -> ...schleier()

Nur LITERALE Werte werden angefasst; Stile mit Bedingungen (?:) an den
sichtbaren Eigenschaften bleiben stehen und werden von Hand umgestellt.

  stil-umbau.py DATEI [--schreiben]     ohne --schreiben: nur auflisten
"""
import re, sys

SICHTBAR = {"background", "color", "border", "boxShadow", "fontWeight", "letterSpacing",
            "textShadow", "backdropFilter", "WebkitBackdropFilter", "borderTop"}

def variante(farbe):
    f = farbe.lower()
    tabelle = [("2563eb", "gold"), ("3b82f6", "blau"), ("0891b2", "gruen"), ("059669", "gruen"), ("10b981", "gruen"),
               ("16a34a", "gruen"), ("22c55e", "gruen"), ("34d399", "gruen"), ("7c3aed", "lila"), ("6d28d9", "lila"),
               ("a855f7", "lila"), ("db2777", "lila"), ("dc2626", "rot"), ("ef4444", "rot"), ("b91c1c", "rot"),
               ("f87171", "rot"), ("f59e0b", "gold"), ("fbbf24", "gold"), ("d97706", "gold"), ("ea580c", "gold"),
               ("fdba74", "gold"), ("fde68a", "gold"), ("0ea5e9", "blau"), ("06b6d4", "blau"), ("1d4ed8", "blau")]
    for k, v in tabelle:
        if f.startswith("#" + k):
            return v
    return None

def objekt_ende(s, i):
    """i zeigt auf '{'; liefert Index nach der passenden '}' (Zeichenketten beachtet)."""
    tiefe, j, q = 0, i, None
    while j < len(s):
        c = s[j]
        if q:
            if c == "\\": j += 2; continue
            if c == q: q = None
        elif c in "\"'`": q = c
        elif c == "{": tiefe += 1
        elif c == "}":
            tiefe -= 1
            if tiefe == 0: return j + 1
        j += 1
    raise ValueError("unbalanciert")

def eigenschaften(obj):
    """Top-Level-Schluessel eines Objektliterals -> (schluessel, wert-text). None bei Spread o. ae."""
    innen = obj[1:-1]
    teile, tiefe, q, start = [], 0, None, 0
    for j, c in enumerate(innen):
        if q:
            if c == q and innen[j - 1] != "\\": q = None
            continue
        if c in "\"'`": q = c
        elif c in "([{": tiefe += 1
        elif c in ")]}": tiefe -= 1
        elif c == "," and tiefe == 0:
            teile.append(innen[start:j]); start = j + 1
    teile.append(innen[start:])
    erg = []
    for t in teile:
        t = re.sub(r"//[^\n]*", "", t).strip()
        if not t: continue
        m = re.match(r"^([A-Za-z_$][\w$]*)\s*:\s*(.+)$", t, re.S)
        if not m: return None
        erg.append((m.group(1), m.group(2).strip()))
    return erg

def zu_text(paare, baustein):
    rest = [f"{k}: {v}" for k, v in paare if k not in SICHTBAR]
    return "{ " + ", ".join([baustein] + rest) + " }"

def umbau(s, schreiben):
    treffer, aus, pos = [], [], 0
    for m in re.finditer(r'(?:React\.createElement|(?<![\w$.])h)\("(button|div)", \{', s):
        el, props_start = m.group(1), m.end() - 1
        try: props_ende = objekt_ende(s, props_start)
        except ValueError: continue
        props = s[props_start:props_ende]
        sm = re.search(r'(?<![\w$])style: \{', props)
        if not sm: continue
        o_start = props_start + sm.end() - 1
        o_ende = objekt_ende(s, o_start)
        if o_start < pos: continue
        obj = s[o_start:o_ende]
        paare = eigenschaften(obj)
        if not paare: continue
        d = dict(paare)
        bg = d.get("background", "")
        if any("?" in d.get(k, "") for k in ("background", "border", "color", "boxShadow")):
            continue
        neu = None
        g = re.match(r'^"linear-gradient\(135deg, ?(#[0-9a-fA-F]{6}), ?(#[0-9a-fA-F]{6})\)"$', bg)
        if el == "button" and g and d.get("color", "").strip('"').lower() in ("white", "#fff", "#ffffff"):
            v = variante(g.group(1))
            if v:
                fs = re.match(r"^(\d+)$", d.get("fontSize", ""))
                extra = f'{{ fontSize: {int(fs.group(1)) + 3} }}' if fs else "{}"
                paare = [(k, v2) for k, v2 in paare if k != "fontSize"]
                neu, art = zu_text(paare, f'...knopf("{v}", {extra})'), "KNOPF " + v
        elif re.match(r'^"linear-gradient\(1[0-9]{2}deg, ?rgba\((1[0-9]|[2-5][0-9]), ?\d+, ?\d+, ?0\.[89]', bg):
            neu, art = zu_text(paare, "...panel()"), "PANEL"
        elif el == "button" and (re.match(r'^"rgba\(255, ?255, ?255, ?0\.(0[2-9]|1[0-2])\)"$', bg) or (bg == '"transparent"' and "rgba(255,255,255" in d.get("border", ""))) and d.get("width") == '"100%"':
            fs = re.match(r"^(\d+)$", d.get("fontSize", ""))
            extra = f'{{ fontSize: {int(fs.group(1)) + 3} }}' if fs else "{}"
            paare = [(k, v2) for k, v2 in paare if k != "fontSize"]
            neu, art = zu_text(paare, f'...knopf("grau", {extra})'), "NEBENKNOPF"
        elif d.get("position") == '"fixed"' and re.match(r'^"rgba\(2, ?6, ?15, ?0\.[789]', bg):
            neu, art = zu_text(paare, "...schleier()"), "SCHLEIER"
        if neu:
            zeile = s.count("\n", 0, o_start) + 1
            treffer.append((zeile, art))
            aus.append(s[pos:o_start]); aus.append(neu); pos = o_ende
    aus.append(s[pos:])
    return "".join(aus), treffer

if __name__ == "__main__":
    pfad = sys.argv[1]; s = open(pfad).read()
    neu, t = umbau(s, "--schreiben" in sys.argv)
    for z, a in t: print(f"  {pfad}:{z}  {a}")
    print(f"{len(t)} Stellen")
    if "--schreiben" in sys.argv: open(pfad, "w").write(neu)
