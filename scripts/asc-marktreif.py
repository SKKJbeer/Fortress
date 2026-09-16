#!/usr/bin/env python3
"""Was fehlt bis zur EINREICHUNG im App Store? — fragen, nicht raten.

`asc.py --stand` prueft, was aus dem Repository kommt: Texte, Kontakt, Bauten.
Zur Einreichung gehoert mehr, und dieses Mehr steht in App Store Connect,
nicht bei uns: Kategorien, Altersfreigabe, Bildschirmfotos, Preis und
Verfuegbarkeit, der zugeordnete Bau, der Zustand einer laufenden Einreichung.

**Dieses Skript schreibt nichts.** Es fragt und berichtet. Was es findet, ist
der Zustand von heute — eine von Hand gepflegte Liste waere am Tag darauf
wieder falsch.

Jede Pruefung nennt den HTTP-Zustand mit. Das ist Absicht: Faellt eine Abfrage
auf 404 oder 409, soll im Protokoll stehen, dass die ABFRAGE nicht ging, und
nicht die Behauptung, die Sache sei nicht eingetragen. Zwischen „nicht gesetzt"
und „konnte ich nicht sehen" liegt der ganze Unterschied.

Umgebung wie bei asc.py: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8.
"""

import os
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, FASSUNG, erste, feld, kurz  # noqa: E402

# Apples Kuerzel fuer die Bildschirmgroessen, die eine Einreichung braucht.
# 6,7" ist Pflicht; die uebrigen erbt Apple daraus, WENN nichts eigenes da ist.
# iPad ist Pflicht, solange die App auf dem iPad laeuft — und das tut sie.
PFLICHT_GROESSEN = {
    "APP_IPHONE_67": 'iPhone 6,7" (1290x2796)',
    "APP_IPAD_PRO_3GEN_129": 'iPad 12,9" (2048x2732)',
}

erledigt: list[str] = []
offen: list[str] = []
unklar: list[str] = []


def hake(text): erledigt.append(text)
def fehlt(text): offen.append(text)
def blind(text): unklar.append(text)


def main() -> int:
    apple = Apple()

    stand, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        print(f"Kein App-Eintrag fuer {BUNDLE} (HTTP {stand}).")
        return 1
    app_id = app["id"]
    hake(f"App-Eintrag: {feld(app, 'name')}")

    # ── Kategorien ────────────────────────────────────────────────────────
    stand, antwort = apple.holen(f"v1/apps/{app_id}/appInfos",
                                 **{"include": "primaryCategory,secondaryCategory"})
    if stand != 200:
        blind(f"Kategorien nicht abfragbar (HTTP {stand}: {kurz(antwort)})")
        info_id = None
    else:
        daten = antwort.json().get("data") or []
        info_id = daten[0]["id"] if daten else None
        haupt = neben = None
        for eintrag in daten:
            bez = eintrag.get("relationships", {})
            h = (bez.get("primaryCategory") or {}).get("data")
            n = (bez.get("secondaryCategory") or {}).get("data")
            haupt = haupt or (h or {}).get("id")
            neben = neben or (n or {}).get("id")
        if haupt:
            hake(f"Hauptkategorie: {haupt}" + (f", Nebenkategorie: {neben}" if neben else ""))
        else:
            fehlt("Hauptkategorie fehlt — ohne sie nimmt Apple keine Einreichung an")

    # ── Altersfreigabe ────────────────────────────────────────────────────
    if info_id:
        stand, erkl = erste(apple, f"v1/appInfos/{info_id}/ageRatingDeclaration")
        if stand != 200:
            blind(f"Altersfreigabe nicht abfragbar (HTTP {stand})")
        elif not erkl:
            fehlt("Altersfreigabe: kein Fragebogen hinterlegt")
        else:
            werte = (erkl.get("attributes") or {})
            gesetzt = [k for k, v in werte.items() if v not in (None, "", False, "NONE")]
            if gesetzt:
                hake(f"Altersfreigabe beantwortet ({len(gesetzt)} Angaben, u. a. "
                     + ", ".join(sorted(gesetzt)[:3]) + ")")
            else:
                fehlt("Altersfreigabe: Fragebogen vorhanden, aber leer")

    # ── Die Fassung 1.0 und was an ihr haengt ─────────────────────────────
    stand, fass = erste(apple, f"v1/apps/{app_id}/appStoreVersions",
                        **{"filter[versionString]": FASSUNG})
    if not fass:
        fehlt(f"Fassung {FASSUNG} nicht gefunden (HTTP {stand})")
        return bericht()
    fass_id = fass["id"]
    hake(f"Fassung {FASSUNG}: {feld(fass, 'appStoreState')}")

    # Bau zugeordnet?
    stand, bau = erste(apple, f"v1/appStoreVersions/{fass_id}/build")
    if stand == 200 and bau:
        hake(f"Bau {feld(bau, 'version')} ist der Fassung zugeordnet")
    else:
        fehlt("Der Fassung ist KEIN Bau zugeordnet — das ist der haeufigste "
              "Grund, warum sich der Einreichen-Knopf nicht druecken laesst")

    # Pruefangaben
    stand, det = erste(apple, f"v1/appStoreVersions/{fass_id}/appStoreReviewDetail")
    if stand == 200 and det:
        a = det.get("attributes") or {}
        fehlend = [n for n in ("contactFirstName", "contactLastName",
                               "contactPhone", "contactEmail") if not a.get(n)]
        if fehlend:
            fehlt("Pruefkontakt unvollstaendig: " + ", ".join(fehlend))
        else:
            hake("Pruefkontakt vollstaendig")
        if a.get("notes"):
            hake("Pruefhinweise hinterlegt")
        else:
            fehlt("Pruefhinweise leer — mit `asc.py --fuellen` eintragbar")
    else:
        fehlt(f"Keine Pruefangaben an der Fassung (HTTP {stand})")

    # ── Bildschirmfotos ───────────────────────────────────────────────────
    stand, antwort = apple.holen(f"v1/appStoreVersions/{fass_id}/appStoreVersionLocalizations")
    if stand != 200:
        blind(f"Sprachfassungen nicht abfragbar (HTTP {stand})")
    else:
        sprachen = antwort.json().get("data") or []
        if not sprachen:
            fehlt("Keine Sprachfassung an der Fassung 1.0")
        for sprache in sprachen:
            kuerzel = feld(sprache, "locale")
            st, aw = apple.holen(f"v1/appStoreVersionLocalizations/{sprache['id']}/appScreenshotSets")
            if st != 200:
                blind(f"Bildschirmfotos ({kuerzel}) nicht abfragbar (HTTP {st})")
                continue
            saetze = {}
            for satz in aw.json().get("data") or []:
                typ = feld(satz, "screenshotDisplayType")
                sst, saw = apple.holen(f"v1/appScreenshotSets/{satz['id']}/appScreenshots")
                anzahl = len(saw.json().get("data") or []) if sst == 200 else -1
                saetze[typ] = anzahl
            for typ, name in PFLICHT_GROESSEN.items():
                n = saetze.get(typ, 0)
                if n > 0:
                    hake(f"Bildschirmfotos {name} ({kuerzel}): {n}")
                else:
                    fehlt(f"Bildschirmfotos {name} ({kuerzel}) fehlen — Pflicht")
            weitere = {t: n for t, n in saetze.items() if t not in PFLICHT_GROESSEN and n}
            if weitere:
                hake(f"Weitere Groessen ({kuerzel}): " + ", ".join(f"{t}={n}" for t, n in weitere.items()))

    # ── Preis und Verfuegbarkeit ──────────────────────────────────────────
    stand, plan = erste(apple, f"v1/apps/{app_id}/appPriceSchedule")
    if stand == 200 and plan:
        hake("Preisplan vorhanden")
    else:
        fehlt(f"Kein Preisplan — ohne ihn ist die App nirgends erhaeltlich (HTTP {stand})")

    stand, antwort = apple.holen(f"v2/apps/{app_id}/appAvailability",
                                 **{"include": "territoryAvailabilities"})
    if stand == 200:
        anzahl = len((antwort.json().get("included") or []))
        if anzahl:
            hake(f"Verfuegbarkeit gesetzt ({anzahl} Gebiete gelistet)")
        else:
            fehlt("Verfuegbarkeit: kein Gebiet ausgewaehlt")
    else:
        blind(f"Verfuegbarkeit nicht abfragbar (HTTP {stand})")

    # ── Laeuft schon eine Einreichung? ────────────────────────────────────
    stand, antwort = apple.holen("v1/reviewSubmissions", **{"filter[app]": app_id})
    if stand == 200:
        laeufe = antwort.json().get("data") or []
        offen_e = [e for e in laeufe if feld(e, "state") not in ("COMPLETE", "CANCELING")]
        if offen_e:
            hake("Einreichung laeuft: " + ", ".join(feld(e, "state") for e in offen_e))
        else:
            fehlt("Noch keine Einreichung begonnen")
    else:
        blind(f"Einreichungen nicht abfragbar (HTTP {stand})")

    return bericht()


def bericht() -> int:
    def block(titel, zeilen, zeichen):
        print(f"\n=== {titel} " + "=" * max(0, 58 - len(titel)))
        for z in zeilen:
            if z:
                print(f"  {zeichen} {z}")
    block("ERLEDIGT", erledigt, "✓")
    block("OFFEN", offen, "·")
    if unklar:
        block('NICHT ABFRAGBAR (nicht mit fehlend verwechseln)', unklar, '?')
    print("\n=== NUR VON HAND " + "=" * 42)
    print("  ! Datenschutz-Fragebogen (App-Datenschutz → Bearbeiten). Apples "
          "Schnittstelle bietet ihn nicht an.")
    print("  ! Haendlerstatus nach dem EU-Digitale-Dienste-Gesetz "
          "(Business → Agreements → Compliance UND je App).")
    print(f"\nOffen: {len([o for o in offen if o])} · Nicht abfragbar: {len(unklar)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
