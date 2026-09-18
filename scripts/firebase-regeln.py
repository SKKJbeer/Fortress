#!/usr/bin/env python3
"""Die Sicherheitsregeln der Realtime Database lesen, vergleichen, veroeffentlichen.

    --stand            aktuelle Regeln lesen und mit der Datei vergleichen
    --trocken          zeigen, was veroeffentlicht WUERDE (nichts schreiben)
    --veroeffentlichen einspielen, danach pruefen, bei Fehlschlag ZURUECKROLLEN

**Warum das ein Skript ist und kein Handgriff in der Console.** Die Regeln
haben eine Reihenfolge-Falle: Sie verlangen `auth != null`. Wer sie einspielt,
bevor alle Clients sich anmelden koennen, sperrt die Spieler aus, die gerade
spielen — und merkt es erst, wenn sich jemand beschwert. Von Hand ist das genau
einmal falsch zu machen.

Hier laeuft stattdessen: alte Regeln sichern → neue einspielen → SOFORT pruefen,
ob unangemeldete Zugriffe abgewiesen werden UND angemeldete noch durchkommen →
bei Fehlschlag automatisch die alten Regeln zurueckspielen. Das ist der
eigentliche Grund fuer den Dienstkonto-Zugang; Bequemlichkeit waere keiner.

Aus der Umgebung: FIREBASE_SA_JSON (Dienstkonto-Schluessel, ein GEHEIMNIS)
"""

import base64
import codecs
import json
import os
import pathlib
import re
import sys

import requests

# `google-auth` wird ERST IN token() importiert, nicht hier oben.
# Grund: `zugangsdaten()` unten kommt mit der Standardbibliothek aus und soll
# auch dann eine verstaendliche Diagnose liefern, wenn die Bibliothek fehlt.
# Beim ersten Anlauf stand hier ein ModuleNotFoundError — also wieder ein
# Stapelabzug statt einer Antwort, und die Diagnose lief nie.

PROJEKT = "fortress-cbe30"
DB = "https://fortress-cbe30-default-rtdb.europe-west1.firebasedatabase.app"
WEB_KEY = "AIzaSyBOmaWUaDKjSQCKZbEhYdy-PMl9LRQ-azg"   # oeffentliche Client-Kennung
WURZEL = pathlib.Path(__file__).resolve().parent.parent
REGELDATEI = WURZEL / "firebase-rules-PASTE.json"
BEREICHE = [
    "https://www.googleapis.com/auth/firebase.database",
    "https://www.googleapis.com/auth/userinfo.email",
]

sag = print


def zugangsdaten() -> dict:
    """Den Dienstkonto-Schluessel aus der Umgebung holen — mit Diagnose.

    **Es wird NIE ein Teil des Geheimnisses ausgegeben.** Gemeldet wird nur die
    FORM: Laenge, erstes Zeichen, erkanntes Muster. Das genuegt, um zu sagen,
    was falsch ist, und verraet nichts, was in ein Protokoll gehoert, das
    jeder mit Lesezugriff aufs Repository sehen kann.

    Beim ersten Anlauf (18.09.) stand hier ein `json.loads`-Stapelabzug und
    sonst nichts. Der sagt nur, dass etwas nicht passt — nicht, was. Wer dann
    raet, verbrennt Anlaeufe.
    """
    roh = os.environ.get("FIREBASE_SA_JSON", "").strip()
    if not roh:
        sag("FEHLER: Das Geheimnis FIREBASE_SA_JSON ist leer oder fehlt.")
        sys.exit(2)

    def form() -> str:
        if roh.startswith("{"):                 return "JSON-Objekt"
        if roh.startswith("1//"):               return "Google-OAuth-Auffrischungs-Token (z. B. aus `firebase login:ci`)"
        if roh.startswith("ya29."):             return "kurzlebiges Google-Zugangs-Token"
        if roh.startswith("ey") and roh.count(".") == 2: return "JWT"
        if roh.startswith("ghp_") or roh.startswith("github_pat_"): return "GitHub-Token"
        if re.fullmatch(r"[A-Za-z0-9+/=\s]+", roh): return "Base64 oder Zeichenkette ohne Struktur"
        return "unbekanntes Format"

    # Mehrere Anlaeufe, die haeufigsten Verpackungen zuerst. Jeder geglueckte
    # Rettungsversuch wird GEMELDET — ein Geheimnis, das nur durch Nachhelfen
    # lesbar ist, liegt falsch hinterlegt und sollte ersetzt werden, auch wenn
    # es heute funktioniert.
    daten, wie = None, None
    versuche = [
        ("unveraendert", lambda t: t),
        ("Base64-verpackt", lambda t: base64.b64decode(t, validate=True).decode("utf-8")),
        ("in Anfuehrungszeichen", lambda t: json.loads(t) if t[:1] in ('"', "'") else None),
        ("escaped (\\n statt Zeilenumbruch)", lambda t: codecs.decode(t, "unicode_escape")),
        ("escaped UND in Anfuehrungszeichen", lambda t: codecs.decode(t.strip('"\''), "unicode_escape")),
    ]
    for name, entpacken in versuche:
        try:
            k = entpacken(roh)
            if not isinstance(k, str):
                continue
            k = k.strip()
            if not k.startswith("{"):
                continue
            daten = json.loads(k)
            wie = name
            break
        except Exception:
            continue
    if daten is not None and wie != "unveraendert":
        sag(f"Hinweis: Das Geheimnis war {wie} — konnte ausgepackt werden.")
        sag("         Bitte trotzdem neu hinterlegen: den JSON-Text unveraendert,")
        sag("         ohne Anfuehrungszeichen und ohne Escaping.")

    if daten is None:
        sag("FEHLER: FIREBASE_SA_JSON enthaelt keinen Dienstkonto-Schluessel.")
        sag(f"  Laenge        : {len(roh)} Zeichen")
        sag(f"  erstes Zeichen: {roh[0]!r}")
        sag(f"  sieht aus wie : {form()}")
        # Strukturelle Merkmale — das sind FELDNAMEN, keine Geheimnisse. Sie
        # unterscheiden „falsche Sorte Zugang" von „richtiger Inhalt, falsch
        # verpackt", und das sind zwei voellig verschiedene Reparaturen.
        marker = [m for m in ("service_account", "private_key", "client_email",
                              "BEGIN PRIVATE KEY", "project_id") if m in roh]
        sag(f"  enthaelt      : {', '.join(marker) if marker else 'keine bekannten Feldnamen'}")
        if marker:
            sag("  → Der INHALT sieht richtig aus, nur die Verpackung nicht.")
            sag("    Wahrscheinlich beim Einfuegen escaped oder in Anfuehrungszeichen.")
        sag("")
        sag("Gebraucht wird die JSON-DATEI aus:")
        sag("  Firebase-Console → Projekteinstellungen → Dienstkonten →")
        sag("  „Neuen privaten Schluessel generieren\"")
        sag("Sie beginnt mit '{' und enthaelt \"type\": \"service_account\".")
        sag("")
        sag("NICHT gebraucht: ein Token aus `firebase login:ci`, ein OAuth-Token,")
        sag("ein GitHub-Token oder das alte „Datenbank-Geheimnis\". Keins davon")
        sag("kann Sicherheitsregeln schreiben.")
        sys.exit(2)

    fehlt = [k for k in ("type", "project_id", "private_key", "client_email") if not daten.get(k)]
    if fehlt:
        sag(f"FEHLER: Im JSON fehlen Felder: {', '.join(fehlt)}")
        sag("Das sieht nicht nach einem Dienstkonto-Schluessel aus.")
        sys.exit(2)
    if daten.get("type") != "service_account":
        sag(f"FEHLER: type ist '{daten.get('type')}', erwartet 'service_account'.")
        sys.exit(2)
    if daten.get("project_id") != PROJEKT:
        # Ein Schluessel fuer das FALSCHE Projekt waere die unangenehmste
        # Variante: Er funktioniert, aber er veraendert eine fremde Datenbank.
        sag(f"FEHLER: Der Schluessel gehoert zum Projekt '{daten['project_id']}',")
        sag(f"        gebraucht wird '{PROJEKT}'. Abbruch, bevor etwas Fremdes")
        sag("        veraendert wird.")
        sys.exit(2)

    sag(f"Dienstkonto erkannt: {daten['client_email']} (Projekt {daten['project_id']})")
    return daten


def token() -> str:
    daten = zugangsdaten()          # zuerst pruefen, dann erst die Bibliothek
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    zugang = service_account.Credentials.from_service_account_info(daten, scopes=BEREICHE)
    zugang.refresh(Request())
    return zugang.token


def regeln_lesen(tok: str):
    r = requests.get(f"{DB}/.settings/rules.json",
                     headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    if r.status_code != 200:
        sag(f"FEHLER: Regeln nicht lesbar (HTTP {r.status_code}): {r.text[:200]}")
        sys.exit(1)
    return r.text


def regeln_schreiben(tok: str, inhalt: str) -> bool:
    r = requests.put(f"{DB}/.settings/rules.json", data=inhalt.encode("utf-8"),
                     headers={"Authorization": f"Bearer {tok}",
                              "Content-Type": "application/json"}, timeout=30)
    if r.status_code != 200:
        sag(f"  ! Schreiben fehlgeschlagen (HTTP {r.status_code}): {r.text[:300]}")
        return False
    return True


def anon_token() -> str | None:
    """Ein echtes anonymes Anmelde-Token — genau das, was ein Spieler haette."""
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={WEB_KEY}",
        json={"returnSecureToken": True}, timeout=30)
    return r.json().get("idToken") if r.status_code == 200 else None


def probe() -> list[str]:
    """Nach dem Einspielen: Greifen die Regeln — und laeuft das Spiel noch?

    BEIDE Richtungen zaehlen. Eine Regel, die alles abweist, ist nicht sicher,
    sondern kaputt: Dann kann auch kein Spieler mehr spielen.
    """
    fehler = []
    marke = "__probe_x"

    # a) unangemeldet schreiben — muss abgewiesen werden
    for pfad in (f"games/{marke}/createdAt", f"queue2/{marke}/ts",
                 f"leaderboard/{marke}/wins", f"players/{marke}/v"):
        r = requests.put(f"{DB}/{pfad}.json", json=1, timeout=30)
        if r.status_code in (401, 403):
            sag(f"  ✓ unangemeldet abgewiesen: {pfad.split('/')[0]} (HTTP {r.status_code})")
        else:
            fehler.append(f"unangemeldeter Schreibzugriff auf {pfad} kam durch (HTTP {r.status_code})")
            sag(f"  ✗ DURCHGEKOMMEN: {pfad} (HTTP {r.status_code}) — wird aufgeraeumt")
            requests.delete(f"{DB}/{'/'.join(pfad.split('/')[:2])}.json", timeout=30)

    # b) ANGEMELDET schreiben — muss klappen, sonst ist das Spiel tot
    tok = anon_token()
    if not tok:
        fehler.append("kein anonymes Token zu bekommen — Anmeldung pruefen")
        sag("  ✗ kein anonymes Anmelde-Token")
        return fehler
    r = requests.put(f"{DB}/games/{marke}2.json",
                     json={"createdAt": 1, "numPlayers": 2}, params={"auth": tok}, timeout=30)
    if r.status_code == 200:
        sag("  ✓ angemeldet schreiben klappt (Spiel bleibt spielbar)")
        requests.delete(f"{DB}/games/{marke}2.json", params={"auth": tok}, timeout=30)
    else:
        fehler.append(f"ANGEMELDETER Schreibzugriff abgewiesen (HTTP {r.status_code}) "
                      f"— die Regeln sperren echte Spieler aus")
        sag(f"  ✗ angemeldet abgewiesen (HTTP {r.status_code}) — das sperrt Spieler aus")
    return fehler


def main() -> int:
    arg = set(sys.argv[1:])
    neu = REGELDATEI.read_text(encoding="utf-8")
    try:
        json.loads(neu)
    except Exception as e:
        sag(f"FEHLER: {REGELDATEI.name} ist kein gueltiges JSON: {e}")
        return 2

    tok = token()
    alt = regeln_lesen(tok)
    gleich = json.loads(alt) == json.loads(neu)

    sag(f"\nRegeln in der Datenbank : {len(alt)} Zeichen")
    sag(f"Regeln in {REGELDATEI.name} : {len(neu)} Zeichen")
    sag(f"identisch               : {'ja' if gleich else 'NEIN'}\n")

    if "--stand" in arg or not arg:
        sag("Nur gelesen. --trocken zeigt den Unterschied, --veroeffentlichen spielt ein.")
        return 0

    if gleich:
        sag("Nichts zu tun — die Datenbank hat bereits diese Regeln.")
        return 0

    if "--trocken" in arg:
        sag("WUERDE die Regeln aus der Datei einspielen. Aktuelle Regeln als Sicherung:")
        sag("--- ANFANG ALTE REGELN ---")
        sag(alt)
        sag("--- ENDE ALTE REGELN ---")
        return 0

    if "--veroeffentlichen" not in arg:
        sag("Unbekannter Aufruf. --stand | --trocken | --veroeffentlichen")
        return 2

    # Sicherung IMMER ausgeben, bevor geschrieben wird — steht damit im
    # Ablauf-Protokoll, auch wenn danach alles schiefgeht.
    sag("--- SICHERUNG DER ALTEN REGELN (fuer die Hand-Rueckkehr) ---")
    sag(alt)
    sag("--- ENDE SICHERUNG ---\n")

    sag("Spiele die neuen Regeln ein …")
    if not regeln_schreiben(tok, neu):
        return 1
    sag("  ✓ eingespielt\n")

    sag("Pruefe sofort nach:")
    fehler = probe()
    if not fehler:
        sag("\nAlles wie vorgesehen. Die Regeln stehen.")
        return 0

    sag("\n!!! Die Pruefung ist durchgefallen:")
    for f in fehler:
        sag(f"  - {f}")
    sag("\nRolle auf die alten Regeln zurueck …")
    if regeln_schreiben(tok, alt):
        sag("  ✓ zurueckgerollt — der Zustand ist wie vorher.")
    else:
        sag("  ! ZURUECKROLLEN FEHLGESCHLAGEN. Die Sicherung steht oben im Protokoll,")
        sag("    sie muss von Hand in die Console eingefuegt werden.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
