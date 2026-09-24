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


def main() -> int:
    if "--stand" not in sys.argv:
        print("Nur --stand ist bisher vorgesehen.")
        return 2
    fehler = 0
    for teil in (firebase_stand, apple_stand):
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
