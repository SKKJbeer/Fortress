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
        else:
            # Zeichen-ZAEHLUNGEN, kein Inhalt. Sie sagen, WAS fuer ein Gebilde
            # das ist, ohne ein Zeichen davon preiszugeben — und ersparen die
            # naechste Raterunde. `{` = 0 heisst: in keiner Verpackung ein JSON.
            z = {"{": roh.count("{"), "}": roh.count("}"), '"': roh.count('"'),
                 "\\": roh.count("\\"), "-": roh.count("-"),
                 "Zeilenumbrueche": roh.count("\n"), "Doppelpunkte": roh.count(":")}
            sag("  Zeichen       : " + ", ".join(f"{k}={v}" for k, v in z.items()))
            sag(f"  nur ASCII     : {'ja' if roh.isascii() else 'nein'}")
            sag(f"  letztes Zeichen: {roh[-1]!r}")
            if z["{"] == 0:
                sag("  → Kein '{' im Text: Das ist in KEINER Verpackung ein JSON-Objekt.")
                sag("    Es ist also nicht der Dienstkonto-Schluessel, auch nicht verpackt.")
            # Der haeufigste Einzelfehler, gemessen am 18.09.: nicht die DATEI
            # kopiert, sondern nur den Wert von "private_key" daraus.
            # Kennzeichen: Base64-Alphabet, Endung auf '=', keine Klammern,
            # keine Doppelpunkte, und ungefaehr ein Backslash je 64 Zeichen —
            # das sind die \\n der zeilenumbrochenen PEM-Zeilen.
            nur_b64 = re.fullmatch(r"[A-Za-z0-9+/=\\\\]+", roh) is not None
            if nur_b64 and roh.endswith("=") and z["{"] == 0 and z["Doppelpunkte"] == 0:
                je = len(roh) / max(z["\\"], 1)
                sag(f"  → Sieht aus wie der WERT von \"private_key\" allein:")
                sag(f"    Base64, Endung '=', ein Backslash je ~{je:.0f} Zeichen"
                    f" (PEM bricht bei 64 um).")
                sag("    Gebraucht wird die GANZE Datei, nicht ein Feld daraus.")
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


def anon_konto() -> tuple[str | None, str | None, str]:
    """Eine echte anonyme Anmeldung holen — genau die, die ein Spieler bekommt.

    Das ist zugleich die Probe, ob die anonyme Anmeldung im Projekt ueberhaupt
    eingeschaltet ist. Die Console zu befragen waere eine zweite Wahrheit; hier
    zaehlt, was der Client tatsaechlich in die Hand bekommt.
    """
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={WEB_KEY}",
        json={"returnSecureToken": True}, timeout=30)
    if r.status_code != 200:
        grund = ""
        try:
            grund = r.json().get("error", {}).get("message", "")
        except Exception:
            pass
        if grund == "ADMIN_ONLY_OPERATION":
            grund = ("ADMIN_ONLY_OPERATION — die anonyme Anmeldung ist im Projekt AUS. "
                     "Console → Authentication → Sign-in method → Anonym aktivieren.")
        return None, None, f"HTTP {r.status_code} {grund}".strip()
    d = r.json()
    return d.get("idToken"), d.get("localId"), ""


def anon_weg(tok: str) -> None:
    """Das Wegwerf-Konto der Probe wieder loeschen — keine Leiche in Auth."""
    try:
        requests.post(f"https://identitytoolkit.googleapis.com/v1/accounts:delete?key={WEB_KEY}",
                      json={"idToken": tok}, timeout=30)
    except Exception:
        pass


def weg(pfad: str, admin: str) -> None:
    """Aufraeumen mit dem Dienstkonto — das umgeht die Regeln und kommt immer durch.

    Wichtig fuer telemetry/funnel: dort steht `newData.exists()` in der
    Schreibregel, ein Loeschen ist damit fuer Spieler VERBOTEN (Absicht:
    niemand soll fremde Messpunkte tilgen). Die Probe raeumt also als Admin
    auf, sonst bleibt ihr eigener Abfall liegen.
    """
    requests.delete(f"{DB}/{pfad}.json", headers={"Authorization": f"Bearer {admin}"}, timeout=30)


def probe(admin: str, anon: str, uid: str) -> list[str]:
    """Nach dem Einspielen: Greifen die Regeln — und laeuft das Spiel noch?

    BEIDE Richtungen zaehlen. Eine Regel, die alles abweist, ist nicht sicher,
    sondern kaputt: Dann kann auch kein Spieler mehr spielen.
    """
    fehler = []
    m = "__probe_x"

    # a) unangemeldet schreiben — muss abgewiesen werden
    for pfad in (f"games/{m}/createdAt", f"queue2/{m}/ts", f"queue3/{m}/ts",
                 f"leaderboard/{m}/wins", f"players/{m}/v",
                 f"telemetry/{m}/ts", f"funnel/{m}/ts"):
        zweig = pfad.split("/")[0]
        r = requests.put(f"{DB}/{pfad}.json", json=1, timeout=30)
        if r.status_code in (401, 403):
            sag(f"  ✓ unangemeldet abgewiesen: {zweig} (HTTP {r.status_code})")
        else:
            fehler.append(f"unangemeldeter Schreibzugriff auf {pfad} kam durch (HTTP {r.status_code})")
            sag(f"  ✗ DURCHGEKOMMEN: {zweig} (HTTP {r.status_code}) — wird aufgeraeumt")
            weg("/".join(pfad.split("/")[:2]), admin)

    # b) ANGEMELDET schreiben — muss klappen, sonst ist das Spiel tot.
    #    JEDER Zweig einzeln, nicht nur einer stellvertretend: `players` und
    #    `leaderboard` haengen an `auth.uid === $schluessel`, `games` nicht.
    #    Ein Tippfehler genau dort faellt nur auf, wenn man den Zweig auch
    #    anfasst — sonst ist die Bestenliste still tot und die Probe gruen.
    proben = [
        (f"games/{m}2",        {"createdAt": 1, "numPlayers": 2}),
        (f"queue2/{m}",        {"ts": 1, "status": "warte"}),
        (f"queue3/{m}",        {"ts": 1, "status": "warte"}),
        (f"leaderboard/{uid}", {"name": "__probe", "wins": 0, "games": 0}),
        (f"players/{uid}",     {"p": "{}", "updatedAt": 1}),
        (f"telemetry/{m}",     {"ts": 1, "mode": "probe", "rounds": 1, "per": 1}),
        (f"funnel/{m}",        {"ts": 1, "schritt": "probe"}),
    ]
    for pfad, wert in proben:
        zweig = pfad.split("/")[0]
        r = requests.put(f"{DB}/{pfad}.json", json=wert, params={"auth": anon}, timeout=30)
        if r.status_code == 200:
            sag(f"  ✓ angemeldet schreiben klappt: {zweig}")
        else:
            fehler.append(f"ANGEMELDETER Schreibzugriff auf {zweig} abgewiesen "
                          f"(HTTP {r.status_code}) — die Regeln sperren echte Spieler aus")
            sag(f"  ✗ angemeldet abgewiesen: {zweig} (HTTP {r.status_code}) — {r.text[:120]}")
        weg(pfad, admin)
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
        anon, uid, warum = anon_konto()
        if anon:
            sag(f"Anonyme Anmeldung  : geht (uid {uid[:6]}…)")
            anon_weg(anon)
        else:
            sag(f"Anonyme Anmeldung  : GEHT NICHT — {warum}")
        sag("\nNur gelesen. --trocken zeigt den Unterschied, --veroeffentlichen spielt ein.")
        return 0

    if gleich and "--veroeffentlichen" not in arg:
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

    # Reihenfolge-Riegel: ERST feststellen, ob sich ueberhaupt jemand anmelden
    # kann, DANN schreiben. Die neuen Regeln verlangen `auth != null`. Ist die
    # anonyme Anmeldung im Projekt aus, sperren sie JEDEN aus — das faellt sonst
    # erst der Probe auf, also NACH dem Schreiben, mit einem Rueckrollen
    # dazwischen, das seinerseits schiefgehen kann. Hier kostet es einen
    # HTTP-Aufruf, es vorher zu wissen.
    anon, uid, warum = anon_konto()
    if not anon:
        sag("ABBRUCH — es wurde NICHTS geschrieben.")
        sag(f"  Anonyme Anmeldung nicht moeglich: {warum}")
        sag("  Die neuen Regeln verlangen auth != null; ohne Anmeldung sperren sie")
        sag("  jeden Spieler aus. Erst die Anmeldung einschalten, dann erneut starten.")
        return 1
    sag(f"Anonyme Anmeldung funktioniert (uid {uid[:6]}…) — die Reihenfolge stimmt.\n")

    # Sicherung IMMER ausgeben, bevor geschrieben wird — steht damit im
    # Ablauf-Protokoll, auch wenn danach alles schiefgeht.
    sag("--- SICHERUNG DER ALTEN REGELN (fuer die Hand-Rueckkehr) ---")
    sag(alt)
    sag("--- ENDE SICHERUNG ---\n")

    if gleich:
        # Schon eingespielt — aber "identisch" ist ein Textvergleich, keine
        # Aussage ueber Verhalten. Die Probe laeuft trotzdem: So laesst sich
        # der Ablauf jederzeit erneut fahren, um zu BESTAETIGEN, dass die
        # Regeln noch greifen, statt es aus einer Zeichenzahl zu schliessen.
        sag("Die Datenbank hat bereits diese Regeln — nur nachpruefen, nichts schreiben.\n")
    else:
        sag("Spiele die neuen Regeln ein …")
        if not regeln_schreiben(tok, neu):
            return 1
        sag("  ✓ eingespielt\n")

    sag("Pruefe sofort nach:")
    fehler = probe(tok, anon, uid)
    if not fehler:
        anon_weg(anon)
        sag("\nAlles wie vorgesehen. Die Regeln stehen.")
        return 0

    sag("\n!!! Die Pruefung ist durchgefallen:")
    for f in fehler:
        sag(f"  - {f}")
    if gleich:
        # Nichts geschrieben, also nichts zurueckzurollen. Ein Rueckrollen auf
        # "die alten Regeln" waere hier ein Rueckrollen auf DIESELBEN.
        sag("\nEs wurde nichts geschrieben — die Regeln standen schon so.")
        sag("Der Fehlschlag betrifft also den ZUSTAND der Datenbank, nicht diesen Lauf.")
        anon_weg(anon)
        return 1

    sag("\nRolle auf die alten Regeln zurueck …")
    if regeln_schreiben(tok, alt):
        sag("  ✓ zurueckgerollt — der Zustand ist wie vorher.")
    else:
        sag("  ! ZURUECKROLLEN FEHLGESCHLAGEN. Die Sicherung steht oben im Protokoll,")
        sag("    sie muss von Hand in die Console eingefuegt werden.")
    anon_weg(anon)
    return 1


if __name__ == "__main__":
    sys.exit(main())
