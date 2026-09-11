#!/usr/bin/env python3
"""Holt die App-Store-Geheimnisse aus dem Schwesterprojekt — ohne sie zu lesen.

**Der Kern der Sache.** Secret-Werte gibt GitHub niemandem zurueck; es gibt
keinen Endpunkt dafuer, auch nicht fuer einen Zugriffsschluessel mit allen
Rechten. Sie entstehen nur an einer einzigen Stelle als Klartext: in einem Lauf
des Quell-Repositories, wo Actions sie als Umgebungsvariablen einsetzt.

Also arbeitet dieses Skript dort. Es legt einen Ablauf im Quell-Repository ab,
stoesst ihn an, wartet auf sein Ergebnis und raeumt ihn danach wieder weg. Der
Ablauf drueben versiegelt jeden Wert mit dem oeffentlichen Schluessel des Ziels
(Sealed Box) und uebergibt nur die Box. Klartext geht nie ueber die Leitung und
steht in keinem Protokoll.

**Warum der Ablauf danach geloescht wird.** Ein dauerhafter Knopf, der
Geheimnisse zwischen Repositories schiebt, ist eine Angriffsflaeche ohne
laufenden Nutzen. Gebraucht wird er genau einmal.
"""

import base64
import calendar
import os
import pathlib
import sys
import time

import requests

API = "https://api.github.com"
PFAD = ".github/workflows/geheimnisse-uebertragen.yml"
VORLAGE = pathlib.Path(__file__).resolve().parent.parent / "tools" / "geheimnisse-uebertragen.yml.vorlage"

# Was am Ende dastehen soll. Der Kontaktname fehlt drueben bewusst (er kam dort
# aus dem Impressum) — er wird deshalb erwartet, aber nicht verlangt.
PFLICHT = ["APPLE_TEAM_ID", "ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8"]
KUER = ["DIST_P12_BASE64", "DIST_P12_PASSWORD",
        "ASC_KONTAKT_NAME", "ASC_KONTAKT_MAIL", "ASC_KONTAKT_TELEFON"]


def fehler(satz: str) -> None:
    print(f"::error::{satz}")
    sys.exit(1)


class GitHub:
    def __init__(self, token: str) -> None:
        self.kopf = {"Authorization": f"Bearer {token}",
                     "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28"}

    def get(self, pfad: str, **werte):
        return requests.get(f"{API}{pfad}", headers=self.kopf, params=werte, timeout=30)

    def put(self, pfad: str, koerper: dict):
        return requests.put(f"{API}{pfad}", headers=self.kopf, json=koerper, timeout=60)

    def post(self, pfad: str, koerper: dict):
        return requests.post(f"{API}{pfad}", headers=self.kopf, json=koerper, timeout=60)

    def delete(self, pfad: str, koerper: dict):
        return requests.delete(f"{API}{pfad}", headers=self.kopf, json=koerper, timeout=60)


def kurz(antwort) -> str:
    try:
        daten = antwort.json()
        return str(daten.get("message", ""))[:200]
    except ValueError:
        return antwort.text[:200]


def ablegen(gh: GitHub, quelle: str, inhalt: str) -> str | None:
    """Legt den Ablauf drueben ab. Gibt den sha zurueck, den das Loeschen braucht."""
    vorhanden = gh.get(f"/repos/{quelle}/contents/{PFAD}")
    koerper = {"message": "Geheimnisse einmalig nach Fortress uebertragen",
               "content": base64.b64encode(inhalt.encode()).decode()}
    if vorhanden.status_code == 200:
        koerper["sha"] = vorhanden.json()["sha"]
    antwort = gh.put(f"/repos/{quelle}/contents/{PFAD}", koerper)
    if antwort.status_code not in (200, 201):
        fehler(f"Ablauf liess sich nicht in {quelle} ablegen "
               f"({antwort.status_code}): {kurz(antwort)} — deckt GH_PAT dieses "
               f"Repository ab, mit 'Contents: Read and write' UND "
               f"'Workflows: Write'?")
    return antwort.json()["content"]["sha"]


def anstossen(gh: GitHub, quelle: str, zweig: str) -> None:
    datei = PFAD.rsplit("/", 1)[-1]
    antwort = gh.post(f"/repos/{quelle}/actions/workflows/{datei}/dispatches",
                      {"ref": zweig})
    if antwort.status_code != 204:
        fehler(f"Ablauf liess sich nicht anstossen ({antwort.status_code}): "
               f"{kurz(antwort)} — braucht 'Actions: Read and write'.")


def abwarten(gh: GitHub, quelle: str, ab: float) -> tuple[str, str]:
    """Wartet auf den Lauf, den wir gerade angestossen haben.

    Nach der Startzeit gefiltert, NICHT einfach der neueste: im Quell-Repository
    laufen andere Ablaeufe, und der neueste koennte einer davon sein.
    """
    datei = PFAD.rsplit("/", 1)[-1]
    for _ in range(60):                     # bis zu fuenf Minuten
        time.sleep(5)
        antwort = gh.get(f"/repos/{quelle}/actions/workflows/{datei}/runs",
                         event="workflow_dispatch", per_page=10)
        if antwort.status_code != 200:
            continue
        for lauf in antwort.json().get("workflow_runs", []):
            # timegm, NICHT mktime: GitHub liefert UTC, mktime rechnet lokal.
            # Auf einem Laeufer faellt das nicht auf (der steht auf UTC), auf
            # einem Rechner mit Zeitzone verschoebe es die Auswahl um Stunden.
            gestartet = calendar.timegm(time.strptime(lauf["created_at"],
                                                      "%Y-%m-%dT%H:%M:%SZ"))
            if gestartet + 60 < ab:         # aelter als unser Anstoss
                continue
            if lauf["status"] == "completed":
                return lauf["conclusion"], lauf["html_url"]
            print(f"  … laeuft ({lauf['status']})")
            break
    fehler("Der Lauf drueben ist in fuenf Minuten nicht fertig geworden.")


def aufraeumen(gh: GitHub, quelle: str, sha: str) -> None:
    antwort = gh.delete(f"/repos/{quelle}/contents/{PFAD}",
                        {"message": "Uebertragung erledigt, Ablauf entfernt",
                         "sha": sha})
    if antwort.status_code not in (200, 204):
        print(f"::warning::Ablauf drueben nicht entfernt ({antwort.status_code}): "
              f"{kurz(antwort)} — bitte {PFAD} in {quelle} von Hand loeschen.")
    else:
        print(f"  ✓ {PFAD} in {quelle} wieder entfernt")


def nachsehen(gh: GitHub, ziel: str) -> int:
    """Welche Namen stehen jetzt hier? Namen, nicht Werte — mehr gibt es nicht."""
    antwort = gh.get(f"/repos/{ziel}/actions/secrets", per_page=100)
    if antwort.status_code != 200:
        print(f"::warning::Secrets nicht auflistbar ({antwort.status_code})")
        return 0
    da = {e["name"] for e in antwort.json().get("secrets", [])}
    fehlend = [n for n in PFLICHT if n not in da]
    print("\n=== JETZT HINTERLEGT " + "=" * 40)
    for name in PFLICHT + KUER:
        print(("  ✓ " if name in da else "  · ") + name +
              ("" if name in da else "  (fehlt)"))
    if fehlend:
        print(f"::error::Es fehlen noch: {', '.join(fehlend)}")
        return 1
    print("\nAlle Pflichtwerte stehen. Der iOS-Build kann hochladen.")
    return 0


def pruefen(gh: GitHub, quelle: str, ziel: str) -> int:
    """Geht die noetigen Rechte einzeln durch, ohne irgendetwas zu veraendern.

    **Warum das lohnt.** Ein Schluessel, dem eine der vier Berechtigungen fehlt,
    scheitert sonst mitten im Vorgang — und die Meldung von GitHub lautet
    „Resource not accessible by personal access token", ohne zu sagen, WELCHE
    Ressource. Hier steht es zeilenweise.

    **Was diese Pruefung nicht kann:** Schreibrechte beweisen, ohne zu
    schreiben. Wo GitHub nichts hergibt, steht das ausdruecklich dabei.
    """
    zeilen: list[tuple[bool, str]] = []

    # 1) Wer bin ich ueberhaupt?
    antwort = gh.get("/user")
    if antwort.status_code != 200:
        print(f"::error::Der Schluessel ist ungueltig oder abgelaufen "
              f"({antwort.status_code}): {kurz(antwort)}")
        return 1
    print(f"Schluessel gehoert zu: {antwort.json().get('login')}\n")

    # 2) Beide Repositories sichtbar? (Metadata)
    for name in (quelle, ziel):
        a = gh.get(f"/repos/{name}")
        zeilen.append((a.status_code == 200,
                       f"{name} sichtbar" if a.status_code == 200
                       else f"{name} NICHT sichtbar ({a.status_code}) — deckt der "
                            f"Schluessel dieses Repository ab?"))

    # 3) Contents lesen im Quell-Repository (Schreiben braucht dieselbe
    #    Berechtigung eine Stufe hoeher, das zeigt erst der Ernstfall).
    a = gh.get(f"/repos/{quelle}/contents/README.md")
    zeilen.append((a.status_code in (200, 404),
                   "Contents lesbar" if a.status_code in (200, 404)
                   else f"Contents NICHT lesbar ({a.status_code}) — 'Contents' fehlt"))

    # 4) Actions: Ablaeufe auflisten
    a = gh.get(f"/repos/{quelle}/actions/workflows", per_page=1)
    zeilen.append((a.status_code == 200,
                   "Actions lesbar" if a.status_code == 200
                   else f"Actions NICHT lesbar ({a.status_code}) — 'Actions' fehlt"))

    # 5) Secrets: das ist die Berechtigung, die am haeufigsten fehlt. Namen
    #    auflisten setzt sie bereits voraus — Werte gibt GitHub ohnehin nie her.
    a = gh.get(f"/repos/{ziel}/actions/secrets", per_page=1)
    zeilen.append((a.status_code == 200,
                   "Secrets schreibbar (Auflisten setzt die Berechtigung voraus)"
                   if a.status_code == 200
                   else f"Secrets NICHT zugaenglich ({a.status_code}) — "
                        f"'Secrets: Read and write' fehlt"))

    print("=== RECHTE " + "=" * 50)
    for gut, satz in zeilen:
        print(("  ✓ " if gut else "  ✗ ") + satz)
    fehlend = [s for gut, s in zeilen if not gut]
    print("\n  ! 'Workflows: Write' laesst sich nur durch Schreiben beweisen — "
          "ohne sie scheitert das Ablegen der Ablaufdatei, nichts sonst.")
    if fehlend:
        print(f"\n::error::{len(fehlend)} Berechtigung(en) fehlen — siehe oben.")
        return 1
    print("\nAlles da. Der Modus „uebertragen\" kann laufen.")
    return 0


def main() -> int:
    token = os.environ.get("GH_PAT", "")
    if not token:
        fehler("GH_PAT fehlt in diesem Repository. Ohne diesen Schluessel kommt "
               "kein Lauf an das andere Repository heran — GitHub verlangt die "
               "ausdrueckliche Vollmacht mit Absicht.")
    quelle = os.environ["QUELLE"]
    ziel = os.environ["ZIEL"]
    gh = GitHub(token)

    if os.environ.get("MODUS", "uebertragen") == "pruefen":
        return pruefen(gh, quelle, ziel)

    # Der Standardzweig drueben — „main" ist nicht ueberall der Name.
    antwort = gh.get(f"/repos/{quelle}")
    if antwort.status_code != 200:
        fehler(f"{quelle} nicht erreichbar ({antwort.status_code}): {kurz(antwort)}")
    zweig = antwort.json()["default_branch"]

    inhalt = VORLAGE.read_text(encoding="utf-8").replace("SKKJbeer/Fortress", ziel)
    print(f"Lege {PFAD} in {quelle} ab (Zweig {zweig}) …")
    sha = ablegen(gh, quelle, inhalt)

    ab = time.time()
    print("Stosse den Lauf an …")
    anstossen(gh, quelle, zweig)
    ergebnis, adresse = abwarten(gh, quelle, ab)
    print(f"Lauf drueben: {ergebnis} — {adresse}")

    aufraeumen(gh, quelle, sha)

    if ergebnis != "success":
        fehler(f"Die Uebertragung drueben ist nicht durchgelaufen ({ergebnis}). "
               f"Das Protokoll steht unter {adresse}.")
    return nachsehen(gh, ziel)


if __name__ == "__main__":
    sys.exit(main())
