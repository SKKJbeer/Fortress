#!/usr/bin/env python3
"""Die Fassung zur Pruefung bei Apple einreichen (v3.117.1).

Der EINE Schritt, den `asc-store.py` bewusst nie tut — und der deshalb hier
steht, getrennt und mit Riegeln:

    (ohne Argument)   TROCKENLAUF. Prueft alle Voraussetzungen und sagt, was
                      geschaehe. Schreibt nichts.
    --einreichen      Wirklich einreichen. Der Ablauf verlangt dafuer die
                      Eingabe „EINREICHEN" (appstore.yml), das Skript selbst
                      verlangt die Umgebungsvariable BESTAETIGUNG=EINREICHEN.

**Veroeffentlichung von Hand.** Vor dem Einreichen wird `releaseType` auf
MANUAL gesetzt: Auch nach der Freigabe durch Apple erscheint die App erst, wenn
der Betreiber den Knopf „Freigeben" drueckt — er bestimmt den Tag.

**Was dieses Skript NICHT kann**, und warum es trotzdem sicher ist: Apples
Schnittstelle kennt weder den App-Datenschutz-Fragebogen noch den
DSA-Haendlerstatus. Fehlen sie, lehnt Apple die Einreichung mit einer
Fehlermeldung ab (HTTP 409), und das Skript gibt diese Meldung wortgetreu aus.
Es gibt also keinen Weg, an den beiden Pflichtangaben vorbei einzureichen.
Zurueckziehen laesst sich eine Einreichung in der Pruefung ueber App Store
Connect („Aus der Pruefung entfernen").

Wiederholbar: Laeuft schon eine Einreichung, bricht das Skript ab, statt eine
zweite anzulegen.
"""

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, FASSUNG, erste, feld, kurz  # noqa: E402

# Der neueste gueltige Bau MUSS an der Fassung haengen: Eingereicht wird, was
# dranhaengt. Genau diese Verwechslung hat der Trockenlauf von asc-store.py
# bis v3.94.0 gehabt (Bau 20 dran, Bau 28 da).
sag = print


def verbundene_fehler(antwort) -> list:
    """Apples „associated errors": Bei 409 sagt der Kopf nur „kann nicht geprueft
    werden", WAS fehlt, steht in meta.associatedErrors (Pfad -> Liste). Ohne
    diese Zeilen bleibt nur das Raten — genau das war der erste Versuch."""
    zeilen = []
    try:
        for e in antwort.json().get("errors", []):
            for pfad, liste in ((e.get("meta") or {}).get("associatedErrors") or {}).items():
                for f in liste:
                    zeilen.append(f"{pfad}: {f.get('code', '')} — {f.get('detail', '')}"[:300])
    except (ValueError, AttributeError):
        pass
    return zeilen


def nummer(bau) -> int:
    try:
        return int(feld(bau, "version"))
    except (TypeError, ValueError):
        return -1


def vorbedingungen(apple: Apple):
    """(app_id, fass_id, offene_einreichung, fehler[]) — alles, was VOR dem
    Einreichen stimmen muss."""
    fehler = []
    stand, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        return None, None, None, [f"Kein App-Eintrag fuer {BUNDLE} (HTTP {stand})"]
    app_id = app["id"]
    stand, fass = erste(apple, f"v1/apps/{app_id}/appStoreVersions",
                        **{"filter[versionString]": FASSUNG})
    if not fass:
        return app_id, None, None, [f"Fassung {FASSUNG} nicht gefunden (HTTP {stand})"]
    fass_id = fass["id"]
    zustand = feld(fass, "appStoreState")
    sag(f"App {feld(app, 'name')}, Fassung {FASSUNG} ({zustand})")
    if zustand != "PREPARE_FOR_SUBMISSION":
        fehler.append(f"Fassung steht auf {zustand}, nicht PREPARE_FOR_SUBMISSION")

    # Haengt der NEUESTE gueltige Bau dran?
    stand, dran = erste(apple, f"v1/appStoreVersions/{fass_id}/build")
    # Dieselbe Abfrage wie asc-store.py `neuester_bau` — der hoechste Bau nach
    # ZAHL, nicht nach Text (Apples sort=-version sortiert „99" vor „100").
    stand2, antwort = apple.holen("v1/builds", **{
        "filter[app]": app_id, "filter[processingState]": "VALID",
        "sort": "-version", "limit": 50})
    bauten = (antwort.json().get("data") or []) if stand2 == 200 else []
    neu = max(bauten, key=nummer) if bauten else None
    if not dran:
        fehler.append("Kein Bau an der Fassung")
    elif not neu:
        fehler.append("Kein gueltiger Bau bei Apple gefunden")
    elif nummer(dran) != nummer(neu):
        fehler.append(f"Bau {feld(dran, 'version')} haengt dran, neuester gueltiger ist "
                      f"{feld(neu, 'version')} — erst `store` laufen lassen")
    else:
        sag(f"  ✓ Bau {feld(dran, 'version')} haengt dran und ist der neueste")

    # Laeuft schon eine Einreichung? Eine NOCH NICHT ABGESCHICKTE
    # (READY_FOR_REVIEW) ist ein Rest eines frueheren, gescheiterten Versuchs —
    # sie wird weiterverwendet statt eine zweite anzulegen. Alles andere
    # (WAITING_FOR_REVIEW, IN_REVIEW, UNRESOLVED_ISSUES …) ist wirklich
    # unterwegs und sperrt.
    stand, antwort = apple.holen("v1/reviewSubmissions", **{"filter[app]": app_id})
    offene_id = None
    if stand == 200:
        offen = [e for e in (antwort.json().get("data") or [])
                 if feld(e, "state") not in ("COMPLETE", "CANCELING")]
        unterwegs = [e for e in offen if feld(e, "state") != "READY_FOR_REVIEW"]
        if unterwegs:
            fehler.append("Es laeuft bereits eine Einreichung: "
                          + ", ".join(feld(e, "state") for e in unterwegs))
        elif offen:
            offene_id = offen[0]["id"]
            sag("  ✓ Keine laufende Einreichung (eine unabgeschickte vom frueheren Versuch wird weiterverwendet)")
        else:
            sag("  ✓ Keine laufende Einreichung")
    else:
        fehler.append(f"Einreichungen nicht abfragbar (HTTP {stand})")
    return app_id, fass_id, offene_id, fehler


def einreichen(apple: Apple, app_id: str, fass_id: str, offene_id=None) -> int:
    # 1) Veroeffentlichung von Hand
    stand, a = apple.aendern(f"v1/appStoreVersions/{fass_id}", {"data": {
        "type": "appStoreVersions", "id": fass_id,
        "attributes": {"releaseType": "MANUAL"}}})
    if stand != 200:
        sag(f"  ! releaseType nicht auf MANUAL setzbar ({stand}): {kurz(a)}")
        return 1
    sag("  ✓ Veroeffentlichung: von Hand (MANUAL)")

    # 2) Einreichung anlegen — oder die unabgeschickte vom letzten Versuch nehmen
    if offene_id:
        sub_id = offene_id
        sag("  ✓ Unabgeschickte Einreichung wiederverwendet")
    else:
        stand, a = apple.anlegen("v1/reviewSubmissions", {"data": {
            "type": "reviewSubmissions", "attributes": {"platform": "IOS"},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
        if stand not in (200, 201):
            sag(f"  ! Einreichung nicht anlegbar ({stand}): {kurz(a)}")
            return 1
        sub_id = a.json()["data"]["id"]
        sag("  ✓ Einreichung angelegt")

    # 3) Die Fassung hineinlegen
    stand, a = apple.anlegen("v1/reviewSubmissionItems", {"data": {
        "type": "reviewSubmissionItems", "relationships": {
            "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
            "appStoreVersion": {"data": {"type": "appStoreVersions", "id": fass_id}}}}})
    if stand not in (200, 201):
        sag(f"  ! Fassung nicht hinzufuegbar ({stand}): {kurz(a)}")
        for z in verbundene_fehler(a):
            sag(f"    Apple sagt: {z}")
        sag("    Meist fehlt der App-Datenschutz-Fragebogen oder der Haendlerstatus —"
            " beides nur in App Store Connect. Die (leere) Einreichung bleibt"
            " angelegt und wird beim naechsten Versuch weiterverwendet.")
        return 1
    sag("  ✓ Fassung in die Einreichung gelegt")

    # 4) Abschicken — hier pruft Apple die Pflichtangaben
    stand, a = apple.aendern(f"v1/reviewSubmissions/{sub_id}", {"data": {
        "type": "reviewSubmissions", "id": sub_id, "attributes": {"submitted": True}}})
    if stand != 200:
        sag(f"  ! Apple lehnt das Abschicken ab ({stand}): {kurz(a)}")
        for z in verbundene_fehler(a):
            sag(f"    Apple sagt: {z}")
        sag("    Meist fehlt der App-Datenschutz-Fragebogen oder der Haendlerstatus —"
            " beides nur in App Store Connect. Die Einreichung bleibt angelegt;"
            " nach dem Nachtragen erneut ausfuehren.")
        return 1
    sag(f"  ✓ EINGEREICHT. Zustand: {feld(a.json()['data'], 'state')}")
    sag("    Nach der Freigabe erscheint die App erst, wenn du in App Store Connect"
        " auf „Freigeben\" tippst.")
    return 0


def main() -> int:
    echt = "--einreichen" in sys.argv[1:]
    if echt and os.environ.get("BESTAETIGUNG") != "EINREICHEN":
        sag("Abbruch: Zum Einreichen muss BESTAETIGUNG=EINREICHEN gesetzt sein.")
        return 2
    apple = Apple()
    app_id, fass_id, offene_id, fehler = vorbedingungen(apple)
    if fehler:
        sag("\nNICHT EINREICHBAR:")
        for f in fehler:
            sag(f"  ! {f}")
        return 1
    if not echt:
        sag("\nTROCKENLAUF — alle Voraussetzungen stehen. Es wuerde:")
        sag("  → die Veroeffentlichung auf „von Hand\" stellen (MANUAL)")
        sag("  → die Fassung zur Pruefung einreichen")
        sag("  Nicht pruefbar: App-Datenschutz-Fragebogen und Haendlerstatus (nur von Hand).")
        return 0
    sag("\nEINREICHEN")
    return einreichen(apple, app_id, fass_id, offene_id)


if __name__ == "__main__":
    sys.exit(main())
