"""App Check fuer Stack & Siege — Bestandsaufnahme (und spaeter Einrichtung).

**Warum zuerst nur lesen.** App Check einzurichten heisst, an drei Stellen
etwas anzulegen: im Firebase-Projekt (iOS-App registrieren, App Attest als
Anbieter), bei Apple (Faehigkeit an der Bundle-Kennung) und fuer den Browser
(reCAPTCHA). Ob das OHNE Handarbeit geht, haengt allein daran, was das
Dienstkonto und der App-Store-Connect-Schluessel duerfen. Das wird hier
GEMESSEN, bevor irgendetwas gebaut wird — sonst steht am Ende ein Umbau, der
an einer fehlenden Berechtigung haengt.

    --stand    nur lesen: was gibt es, was darf der Zugang?

Aus der Umgebung: FIREBASE_SA_JSON, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8
"""

import importlib.util
import pathlib
import sys

import requests

WURZEL = pathlib.Path(__file__).resolve().parent


def lade(name: str, datei: str):
    spec = importlib.util.spec_from_file_location(name, WURZEL / datei)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


fr = lade("firebase_regeln", "firebase-regeln.py")
PROJEKT = fr.PROJEKT
BUNDLE = "de.skkjbeer.stackandsiege"

# Berechtigungen, an denen die Einrichtung haengen wuerde. Jede einzeln
# abgefragt — eine Sammelantwort "darf nicht" sagte nicht, WELCHE fehlt.
NOETIG = [
    "firebase.clients.list",
    "firebase.clients.create",
    "firebase.clients.get",
    "firebaseappcheck.appAttestConfig.get",
    "firebaseappcheck.appAttestConfig.update",
    "firebaseappcheck.debugTokens.update",
    "firebaseappcheck.services.get",
    "firebaseappcheck.services.update",
    "firebaseappcheck.recaptchaEnterpriseConfig.update",
    "firebaseappcheck.recaptchaV3Config.update",
    "recaptchaenterprise.keys.create",
    "serviceusage.services.enable",
    "serviceusage.services.get",
]
DIENSTE = ["firebaseappcheck.googleapis.com", "recaptchaenterprise.googleapis.com",
           "firebase.googleapis.com", "cloudbilling.googleapis.com"]


def gtoken() -> str:
    daten = fr.zugangsdaten()
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    z = service_account.Credentials.from_service_account_info(
        daten, scopes=["https://www.googleapis.com/auth/cloud-platform",
                       "https://www.googleapis.com/auth/firebase"])
    z.refresh(Request())
    return z.token


def g(tok: str, url: str, methode="GET", koerper=None):
    r = requests.request(methode, url, headers={"Authorization": f"Bearer {tok}"},
                         json=koerper, timeout=30)
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, {"text": r.text[:200]}


def fehlertext(daten) -> str:
    e = (daten or {}).get("error") or {}
    return (e.get("status", "") + " " + (e.get("message") or "")).strip()[:200]


def firebase_stand() -> None:
    print("=== Firebase / Google Cloud ===")
    tok = gtoken()

    # 1) Was DARF der Zugang?
    s, d = g(tok, f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJEKT}:testIamPermissions",
             "POST", {"permissions": NOETIG})
    if s == 200:
        hat = set(d.get("permissions", []))
        for p in NOETIG:
            print(f"  {'✓' if p in hat else '✗'} {p}")
    else:
        print(f"  ? Berechtigungen nicht abfragbar: HTTP {s} {fehlertext(d)}")

    # 2) Welche Dienste sind eingeschaltet?
    for dienst in DIENSTE:
        s, d = g(tok, f"https://serviceusage.googleapis.com/v1/projects/{PROJEKT}/services/{dienst}")
        zustand = d.get("state") if s == 200 else f"HTTP {s} {fehlertext(d)}"
        print(f"  Dienst {dienst}: {zustand}")

    # 3) Welche Apps sind registriert?
    for art in ("iosApps", "webApps"):
        s, d = g(tok, f"https://firebase.googleapis.com/v1beta1/projects/{PROJEKT}/{art}")
        if s == 200:
            apps = d.get("apps", [])
            print(f"  {art}: {len(apps)}")
            for a in apps:
                print(f"    - {a.get('appId')}  {a.get('bundleId') or a.get('displayName') or ''}")
        else:
            print(f"  {art}: HTTP {s} {fehlertext(d)}")

    # 4) App-Check-Durchsetzung je Dienst
    s, d = g(tok, f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/services")
    if s == 200:
        dienste = d.get("services", [])
        print(f"  App-Check-Dienste: {len(dienste)}")
        for x in dienste:
            print(f"    - {x.get('name', '').split('/')[-1]}: {x.get('enforcementMode')}")
    else:
        print(f"  App-Check-Dienste: HTTP {s} {fehlertext(d)}")

    # 4b) Was ist an den Apps WIRKLICH hinterlegt? Zurueckgelesen, nicht
    #     angenommen — ein PATCH mit HTTP 200 sagt nicht, dass das Feld sass.
    ac = f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/apps"
    for art, pfad in (("webApps", "recaptchaV3Config"), ("webApps", "recaptchaEnterpriseConfig"),
                      ("iosApps", "appAttestConfig"), ("iosApps", "deviceCheckConfig")):
        s2, d2 = g(tok, f"https://firebase.googleapis.com/v1beta1/projects/{PROJEKT}/{art}")
        for app in d2.get("apps", []):
            s3, d3 = g(tok, f"{ac}/{app['appId']}/{pfad}")
            felder = {k: v for k, v in d3.items() if k != "name"} if s3 == 200 else fehlertext(d3)
            print(f"  {pfad} @ {app['appId'][-24:]}: HTTP {s3} {felder}")

    # 4c) Liegt der reCAPTCHA-Schluessel IN DIESEM Projekt? Seit 2024 gehoert
    #     jeder neu angelegte Schluessel zu einem Google-Cloud-Projekt. 404
    #     heisst: nicht hier; 403: keine Berechtigung bzw. Schnittstelle aus.
    site = "6LffVMwtAAAAANSbtQ5sZe2ERcBXIt2agDUfWsWr"
    s4, d4 = g(tok, f"https://recaptchaenterprise.googleapis.com/v1/projects/{PROJEKT}/keys/{site}")
    print(f"  reCAPTCHA-Schluessel im Projekt {PROJEKT}: HTTP {s4} "
          + (str({k: d4.get(k) for k in ('displayName', 'webSettings', 'createTime')}) if s4 == 200
             else fehlertext(d4)))

    # 5) Abrechnungskonto verbunden? (reCAPTCHA Enterprise haengt womoeglich daran)
    s, d = g(tok, f"https://cloudbilling.googleapis.com/v1/projects/{PROJEKT}/billingInfo")
    print(f"  Abrechnung: " + (f"aktiv={d.get('billingEnabled')}" if s == 200
                               else f"HTTP {s} {fehlertext(d)}"))


def apple_stand() -> None:
    print("=== Apple / App Store Connect ===")
    asc = lade("asc", "asc.py")
    apple = asc.Apple()
    s, a = apple.holen("v1/bundleIds", **{"filter[identifier]": BUNDLE})
    daten = a.json().get("data", []) if s == 200 else []
    if not daten:
        print(f"  ✗ Bundle-Kennung nicht gefunden (HTTP {s})")
        return
    bid = daten[0]["id"]
    print(f"  Bundle-Kennung {BUNDLE}: {bid}")
    s, a = apple.holen(f"v1/bundleIds/{bid}/bundleIdCapabilities")
    if s == 200:
        faehig = [c["attributes"].get("capabilityType") for c in a.json().get("data", [])]
        print(f"  Faehigkeiten ({len(faehig)}): {', '.join(sorted(filter(None, faehig))) or '—'}")
    else:
        print(f"  Faehigkeiten: HTTP {s} {asc.kurz(a)}")

    # Die entscheidende Frage fuer App Attest: Traegt ein Verteilprofil dieser
    # Kennung die Berechtigung `com.apple.developer.devicecheck.appattest-
    # environment`? Wenn ja, braucht es KEINE Faehigkeit im Portal (die
    # Schnittstelle kennt keine fuer App Attest). Gelesen wird das Profil,
    # das der iOS-Ablauf zuletzt angelegt hat — nichts wird veraendert.
    import base64, re
    s, a = apple.holen(f"v1/bundleIds/{bid}/profiles", limit=20)
    profile = a.json().get("data", []) if s == 200 else []
    print(f"  Profile zur Kennung: {len(profile)}")
    for pr in profile[:3]:
        at = pr["attributes"]
        roh = base64.b64decode(at.get("profileContent") or "").decode("latin-1")
        m = re.search(r"<key>Entitlements</key>\s*<dict>(.*?)</dict>", roh, re.S)
        schluessel = re.findall(r"<key>([^<]+)</key>", m.group(1)) if m else []
        print(f"    - {at.get('name')} ({at.get('profileType')}, {at.get('profileState')})")
        print(f"      Berechtigungen: {', '.join(schluessel) or '—'}")
        print(f"      App Attest enthalten: "
              f"{'JA' if any('appattest' in k for k in schluessel) else 'nein'}")


def zugaenge_stand() -> None:
    """Liegen die Werte aus den beiden Handgriffen vor? Nur Laenge, nie Inhalt."""
    import os
    print("=== Secrets aus den Handgriffen ===")
    for name in ("RECAPTCHA_SECRET", "RECAPTCHA_SITE_KEY"):
        wert = os.environ.get(name, "")
        print(f"  {'✓' if wert else '✗'} {name}" + (f" ({len(wert)} Zeichen)" if wert else " fehlt"))


def probeprofil() -> None:
    """Traegt ein FRISCHES Verteilprofil jetzt die App-Attest-Berechtigung?

    Das bestehende Profil stammt von vor dem Haken im Portal und sagt darueber
    nichts. Also wird ein Probeprofil unter eigenem Namen angelegt, gelesen und
    sofort wieder geloescht. Das Profil des iOS-Ablaufs bleibt unberuehrt.
    """
    import base64, re
    print("=== Probeprofil ===")
    ap = lade("asc_profil", "asc-profil.py")
    apple = ap.Apple(ap.anmeldung())
    name = "Stack and Siege AppCheck Probe"
    for alt in apple.holen("profiles", **{"filter[name]": name, "limit": 50}).get("data", []):
        apple.loeschen(f"profiles/{alt['id']}")
    a = apple.anlegen("profiles", {"data": {
        "type": "profiles",
        "attributes": {"name": name, "profileType": ap.ART},
        "relationships": {
            "bundleId": {"data": {"type": "bundleIds", "id": ap.kennung(apple)}},
            "certificates": {"data": ap.zertifikate(apple)}}}})
    if a.status_code != 201:
        print(f"  ✗ Probeprofil abgelehnt: HTTP {a.status_code} {a.text[:200]}")
        return
    d = a.json()["data"]
    roh = base64.b64decode(d["attributes"]["profileContent"]).decode("latin-1")
    apple.loeschen(f"profiles/{d['id']}")
    m = re.search(r"<key>Entitlements</key>\s*<dict>(.*?)</dict>", roh, re.S)
    inhalt = m.group(1) if m else ""
    schluessel = re.findall(r"<key>([^<]+)</key>", inhalt)
    wert = re.search(r"appattest-environment</key>\s*<string>([^<]*)</string>", inhalt)
    print(f"  Berechtigungen: {', '.join(schluessel)}")
    print(f"  App Attest: " + (f"JA ({wert.group(1)})" if wert else
          ("JA" if any('appattest' in k for k in schluessel) else "NEIN — Haken im Portal fehlt")))
    print("  (Probeprofil wieder geloescht)")


def warte_auf(tok: str, op: dict) -> dict:
    """Firebase legt Apps als lang laufenden Vorgang an — abwarten, mit Frist."""
    import time
    name = op.get("name")
    for _ in range(30):
        if op.get("done"):
            if op.get("error"):
                raise RuntimeError(f"Vorgang gescheitert: {op['error']}")
            return op.get("response", {})
        time.sleep(2)
        s, op = g(tok, f"https://firebase.googleapis.com/v1beta1/{name}")
        if s != 200:
            raise RuntimeError(f"Vorgang nicht lesbar: HTTP {s} {fehlertext(op)}")
    raise RuntimeError("Vorgang nach 60 s nicht fertig")


def einrichten() -> int:
    """Alles, was sich am Firebase-Projekt einrichten laesst — wiederholbar.

    Jeder Schritt prueft zuerst, ob es ihn schon gibt. Ein zweiter Lauf aendert
    also nichts, statt eine zweite iOS-App anzulegen.
    """
    import os
    team = os.environ.get("APPLE_TEAM_ID", "").strip()
    if not team:
        print("::error::APPLE_TEAM_ID fehlt — App Attest braucht die Team-Kennung")
        return 1
    tok = gtoken()
    basis = f"https://firebase.googleapis.com/v1beta1/projects/{PROJEKT}"

    # 1) iOS-App registrieren (mit Team-Kennung — ohne sie lehnt App Attest ab)
    s, d = g(tok, f"{basis}/iosApps")
    ios = next((x for x in d.get("apps", []) if x.get("bundleId") == BUNDLE), None)
    if not ios:
        s, op = g(tok, f"{basis}/iosApps", "POST",
                  {"bundleId": BUNDLE, "displayName": "Stack & Siege iOS", "teamId": team})
        if s not in (200, 201):
            print(f"  ✗ iOS-App nicht angelegt: HTTP {s} {fehlertext(op)}")
            return 1
        ios = warte_auf(tok, op)
        print(f"  ✓ iOS-App angelegt: {ios.get('appId')}")
    else:
        print(f"  = iOS-App vorhanden: {ios.get('appId')}")
        if ios.get("teamId") != team:
            s, d = g(tok, f"https://firebase.googleapis.com/v1beta1/{ios['name']}?updateMask=teamId",
                     "PATCH", {"teamId": team})
            print(f"  {'✓' if s == 200 else '✗'} Team-Kennung nachgetragen (HTTP {s})")
    ios_id = ios["appId"]

    # 2) Konfiguration der iOS-App — die Werte gehen in die App-Huelle.
    #    Alles davon ist oeffentlich (wie der Web-Schluessel), nichts geheim.
    s, d = g(tok, f"{basis}/iosApps/{ios_id}/config")
    if s == 200:
        import base64, re
        plist = base64.b64decode(d.get("configFileContents", "")).decode("utf-8", "replace")
        for k in ("API_KEY", "GCM_SENDER_ID", "GOOGLE_APP_ID", "PROJECT_ID"):
            m = re.search(rf"<key>{k}</key>\s*<string>([^<]*)</string>", plist)
            print(f"  KONFIG {k}={m.group(1) if m else '?'}")
    else:
        print(f"  ✗ Konfiguration nicht lesbar: HTTP {s} {fehlertext(d)}")

    ac = f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/apps"

    # 3) App Attest als Anbieter der iOS-App
    s, d = g(tok, f"{ac}/{ios_id}/appAttestConfig?updateMask=tokenTtl", "PATCH",
             {"tokenTtl": "3600s"})
    print(f"  {'✓' if s == 200 else '✗'} App Attest fuer iOS (HTTP {s}) {'' if s == 200 else fehlertext(d)}")

    # 4) reCAPTCHA v3 als Anbieter der Web-App — mit dem Secret aus den Secrets
    geheim = os.environ.get("RECAPTCHA_SECRET", "").strip()
    s, d = g(tok, f"{basis}/webApps")
    web = (d.get("apps") or [{}])[0].get("appId")
    if geheim and web:
        s, d = g(tok, f"{ac}/{web}/recaptchaV3Config?updateMask=siteSecret,tokenTtl", "PATCH",
                 {"siteSecret": geheim, "tokenTtl": "3600s"})
        print(f"  {'✓' if s == 200 else '✗'} reCAPTCHA v3 fuer Web (HTTP {s}) {'' if s == 200 else fehlertext(d)}")
    else:
        print("  ✗ reCAPTCHA fuer Web uebersprungen (Secret oder Web-App fehlt)")

    # 5) Durchsetzung wird hier NICHT angefasst — das kommt erst, wenn alle
    #    Clients nachweislich Tokens schicken. Nur ausgeben, wie es steht.
    s, d = g(tok, f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/services")
    print(f"  Durchsetzung: {[(x['name'].split('/')[-1], x.get('enforcementMode')) for x in d.get('services', [])] or 'nirgends'}")
    return 0


IOS_APP = "1:263415833676:ios:1e4837bea6c760ca6c40e9"
DEBUG_NAME = "ci-simulator-probe"


def debug_token_anlegen() -> int:
    """Ein Debug-Token NUR fuer diesen Probelauf.

    App Attest gibt es im Simulator nicht; der Debug-Bau nimmt dort den
    Debug-Anbieter, und der braucht ein in Firebase hinterlegtes Token. Ein
    dauerhaftes Token waere ein Generalschluessel an App Check vorbei — also
    wird fuer jeden Lauf ein frisches angelegt und danach geloescht
    (`--debug-token-weg`, im Ablauf mit `if: always()`).

    Das Token geht maskiert nach $GITHUB_ENV und erscheint nie im Protokoll.
    """
    import os, uuid
    wert = str(uuid.uuid4())
    print(f"::add-mask::{wert}")
    tok = gtoken()
    s, d = g(tok, f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/apps/{IOS_APP}/debugTokens",
             "POST", {"displayName": DEBUG_NAME, "token": wert})
    if s != 200:
        print(f"::error::Debug-Token nicht angelegt: HTTP {s} {fehlertext(d)}")
        return 1
    ziel = os.environ.get("GITHUB_ENV")
    if ziel:
        with open(ziel, "a", encoding="utf-8") as f:
            f.write(f"APPCHECK_DEBUG_TOKEN={wert}\n")
    print(f"  ✓ Debug-Token fuer den Probelauf angelegt ({d.get('name', '').split('/')[-1]})")
    return 0


def debug_token_weg() -> int:
    """Alle Probelauf-Tokens loeschen — auch die liegengebliebener Laeufe."""
    tok = gtoken()
    basis = f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/apps/{IOS_APP}/debugTokens"
    s, d = g(tok, basis)
    weg = 0
    for t in d.get("debugTokens", []):
        if t.get("displayName") == DEBUG_NAME:
            s2, _ = g(tok, f"https://firebaseappcheck.googleapis.com/v1/{t['name']}", "DELETE")
            weg += s2 == 200
    print(f"  ✓ {weg} Probelauf-Token(s) geloescht")
    return 0


def recaptcha_pruefen() -> int:
    """Passen Site-Key und Secret zusammen — und welche Bewertung gab es?

    Firebase antwortet auf einen abgelehnten Austausch nur mit
    „App attestation failed". Das trennt zwei Ursachen nicht: falsches Secret
    oder zu niedrige Bewertung (ein automatisierter Browser bekommt von
    reCAPTCHA wenig Vertrauen). Googles eigene Pruefstelle sagt beides.

    Das Token kommt als Eingabe des Ablaufs (gilt zwei Minuten, einmalig).
    Ausgegeben wird nur, was nicht geheim ist: Erfolg, Bewertung, Aktion,
    Herkunft, Fehlercodes.
    """
    import json, os, urllib.parse, urllib.request
    token = os.environ.get("RECAPTCHA_TOKEN", "").strip()
    geheim = os.environ.get("RECAPTCHA_SECRET", "").strip()
    if not token or not geheim:
        print("::error::RECAPTCHA_TOKEN (Eingabe) oder RECAPTCHA_SECRET fehlt")
        return 1
    daten = urllib.parse.urlencode({"secret": geheim, "response": token}).encode()
    with urllib.request.urlopen("https://www.google.com/recaptcha/api/siteverify",
                                data=daten, timeout=30) as r:
        a = json.load(r)
    for k in ("success", "score", "action", "hostname", "challenge_ts", "error-codes"):
        print(f"  {k}: {a.get(k)}")
    return 0


def schwelle() -> int:
    """Mindestbewertung fuer reCAPTCHA im Browser setzen (Diagnose).

    Nur fuer die Frage „lehnt Firebase wegen der Bewertung ab?" gedacht —
    mit 0 muss der Austausch durchgehen, wenn es daran liegt. Danach wieder
    auf 0.5 (Voreinstellung). Solange nicht durchgesetzt ist, hat der Wert
    keine Wirkung auf Spieler.
    """
    import os
    try:
        wert = float(os.environ.get("SCHWELLE", ""))
    except ValueError:
        print("::error::SCHWELLE fehlt oder ist keine Zahl")
        return 1
    if not 0.0 <= wert <= 1.0:
        print("::error::SCHWELLE muss zwischen 0 und 1 liegen")
        return 1
    tok = gtoken()
    s, d = g(tok, f"https://firebase.googleapis.com/v1beta1/projects/{PROJEKT}/webApps")
    web = d["apps"][0]["appId"]
    s, d = g(tok, f"https://firebaseappcheck.googleapis.com/v1/projects/{PROJEKT}/apps/{web}"
                  f"/recaptchaV3Config?updateMask=minValidScore", "PATCH", {"minValidScore": wert})
    print(f"  {'✓' if s == 200 else '✗'} minValidScore = {d.get('minValidScore', '?')} (HTTP {s})")
    return 0 if s == 200 else 1


def apple_faehigkeit() -> int:
    """App Attest an der Bundle-Kennung einschalten.

    Die Schnittstelle von App Store Connect nennt die erlaubten Werte selbst,
    wenn einer nicht passt — deshalb wird nacheinander versucht und jede
    Antwort ausgegeben, statt einen Namen zu raten und still zu scheitern.
    Unschaedlich: Der iOS-Ablauf legt das Verteilprofil bei JEDEM Bau neu an,
    ein durch die neue Faehigkeit ungueltig gewordenes altes Profil stoert also
    nicht.
    """
    asc = lade("asc", "asc.py")
    apple = asc.Apple()
    s, a = apple.holen("v1/bundleIds", **{"filter[identifier]": BUNDLE})
    bid = a.json()["data"][0]["id"]
    for art in ("APP_ATTEST",):
        s, a = apple.anlegen("v1/bundleIdCapabilities", {"data": {
            "type": "bundleIdCapabilities",
            "attributes": {"capabilityType": art},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}}}}})
        print(f"  {art}: HTTP {s} — {asc.kurz(a) if s >= 300 else 'angelegt'}")
        if s < 300:
            return 0
    return 1


def main() -> int:
    if "--apple-faehigkeit" in sys.argv:
        return apple_faehigkeit()
    if "--einrichten" in sys.argv:
        return einrichten()
    if "--schwelle" in sys.argv:
        return schwelle()
    if "--recaptcha-pruefen" in sys.argv:
        return recaptcha_pruefen()
    if "--debug-token-anlegen" in sys.argv:
        return debug_token_anlegen()
    if "--debug-token-weg" in sys.argv:
        return debug_token_weg()
    if "--stand" not in sys.argv:
        print("Modi: --stand, --apple-faehigkeit")
        return 2
    fehler = 0
    for teil in (zugaenge_stand, firebase_stand, apple_stand, probeprofil):
        try:
            teil()
        except SystemExit:
            raise
        except Exception as e:          # Ein Teil darf den anderen nicht verdecken
            fehler += 1
            print(f"  ! {teil.__name__} abgebrochen: {type(e).__name__}: {str(e)[:200]}")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
