"""Google Search Console — ohne Klick in der Oberflaeche (v3.115.1).

Das Dienstkonto (FIREBASE_SA_JSON) bestaetigt sich per Meta-Angabe als
Eigentuemer der Website, meldet sie in der Search Console an und reicht die
Sitemap ein. Ohne diese Anmeldung erfaehrt Google von der Seite nur zufaellig —
eine Websuche fand im September 2026 nichts.

    --stand        nur lesen: Sind die Schnittstellen erreichbar? Welche
                   Bestaetigungs-Angabe gehoert in die Website?
    --einrichten   bestaetigen (die Angabe muss LIVE sein), Seite anmelden,
                   Sitemap einreichen

Aus der Umgebung: FIREBASE_SA_JSON
"""
import importlib.util
import pathlib
import sys
import urllib.parse

import requests

WURZEL = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("fr", WURZEL / "firebase-regeln.py")
fr = importlib.util.module_from_spec(spec); spec.loader.exec_module(fr)

SEITE = "https://stack-and-siege.pages.dev/"
SITEMAP = SEITE + "sitemap.xml"
BEREICHE = ["https://www.googleapis.com/auth/siteverification",
            "https://www.googleapis.com/auth/webmasters"]


def tok() -> str:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    z = service_account.Credentials.from_service_account_info(fr.zugangsdaten(), scopes=BEREICHE)
    z.refresh(Request())
    return z.token


def anfrage(t, methode, url, koerper=None):
    r = requests.request(methode, url, headers={"Authorization": f"Bearer {t}"}, json=koerper, timeout=30)
    try:
        d = r.json()
    except ValueError:
        d = {"text": r.text[:200]}
    return r.status_code, d


def fehler(d) -> str:
    e = (d or {}).get("error") or {}
    return f"{e.get('status', '')} {e.get('message', '')}".strip()[:300]


def meta_wert(t):
    s, d = anfrage(t, "POST", "https://www.googleapis.com/siteVerification/v1/token",
                   {"site": {"type": "SITE", "identifier": SEITE}, "verificationMethod": "META"})
    if s != 200:
        return None, f"HTTP {s} {fehler(d)}"
    m = __import__("re").search(r'content="([^"]+)"', d.get("token", ""))
    return (m.group(1) if m else None), d.get("token")


def stand() -> int:
    t = tok()
    wert, roh = meta_wert(t)
    print(f"  Bestaetigungs-Schnittstelle: {'erreichbar' if wert else 'NICHT erreichbar — ' + str(roh)}")
    if wert:
        print(f"  META-WERT={wert}")
    s, d = anfrage(t, "GET", "https://www.googleapis.com/webmasters/v3/sites")
    print(f"  Search-Console-Schnittstelle: HTTP {s} "
          + (f"— {len(d.get('siteEntry', []))} Seite(n) bekannt" if s == 200 else fehler(d)))
    return 0 if wert and s == 200 else 1


def einrichten() -> int:
    t = tok()
    wert, roh = meta_wert(t)
    if not wert:
        print(f"::error::Bestaetigungs-Schnittstelle nicht erreichbar: {roh}")
        return 1
    live = requests.get(SEITE, timeout=30).text
    if wert not in live:
        print(f"::error::Die Angabe google-site-verification={wert} steht noch nicht auf {SEITE}")
        return 1
    s, d = anfrage(t, "POST",
                   "https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=META",
                   {"site": {"type": "SITE", "identifier": SEITE}})
    print(f"  {'✓' if s == 200 else '✗'} Eigentum bestaetigt (HTTP {s}) {'' if s == 200 else fehler(d)}")
    if s != 200:
        return 1
    kodiert = urllib.parse.quote(SEITE, safe="")
    s, d = anfrage(t, "PUT", f"https://www.googleapis.com/webmasters/v3/sites/{kodiert}")
    print(f"  {'✓' if s in (200, 204) else '✗'} in der Search Console angemeldet (HTTP {s}) {'' if s in (200, 204) else fehler(d)}")
    s, d = anfrage(t, "PUT", f"https://www.googleapis.com/webmasters/v3/sites/{kodiert}/sitemaps/"
                             + urllib.parse.quote(SITEMAP, safe=""))
    print(f"  {'✓' if s in (200, 204) else '✗'} Sitemap eingereicht (HTTP {s}) {'' if s in (200, 204) else fehler(d)}")
    s, d = anfrage(t, "GET", f"https://www.googleapis.com/webmasters/v3/sites/{kodiert}/sitemaps")
    for sm in d.get("sitemap", []):
        print(f"    {sm.get('path')}: eingereicht {sm.get('lastSubmitted', '?')}, "
              f"Fehler {sm.get('errors', 0)}, Warnungen {sm.get('warnings', 0)}")
    return 0


def besitzer() -> int:
    """Ein Google-Konto als weiteren Eigentuemer eintragen — damit der
    Betreiber die Suchdaten in SEINER Search Console sieht.

    Die Adresse kommt aus der Eingabe des Laufs, gelesen aus der
    Ereignisdatei — NICHT ueber `env:`. Werte aus `env:` druckt GitHub im
    Kopf des Schritts aus, und die Protokolle sind bei einem oeffentlichen
    Repository fuer jeden lesbar. Vor jeder Ausgabe wird sie maskiert.
    """
    import json, os, re
    ereignis = json.loads(pathlib.Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    adresse = str((ereignis.get("inputs") or {}).get("besitzer") or "").strip()
    if adresse:
        print(f"::add-mask::{adresse}")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[a-z]{2,}", adresse, re.I):
        print("::error::Eingabe 'besitzer' fehlt oder ist keine Mailadresse")
        return 1
    t = tok()
    kennung = urllib.parse.quote(SEITE, safe="")
    url = f"https://www.googleapis.com/siteVerification/v1/webResource/{kennung}"
    s, d = anfrage(t, "GET", url)
    if s != 200:
        print(f"::error::Eigentum nicht lesbar (HTTP {s}) {fehler(d)} — erst 'einrichten'")
        return 1
    alt = d.get("owners", [])
    if adresse.lower() in (o.lower() for o in alt):
        print(f"  Schon eingetragen ({len(alt)} Eigentuemer)")
        return 0
    s, d = anfrage(t, "PUT", url, {"site": d["site"], "owners": alt + [adresse]})
    print(f"  {'✓' if s == 200 else '✗'} Eigentuemer ergaenzt (HTTP {s}) {'' if s == 200 else fehler(d)}"
          f" — jetzt {len(d.get('owners', alt))} Eigentuemer")
    return 0 if s == 200 else 1


def bericht() -> int:
    """NUR LESEN: Was weiss Google ueber die Website? (v3.117.x)

    - Indexierung je Seite (URL-Pruefung: im Index? wann gecrawlt? welche
      massgebliche Adresse hat Google gewaehlt?)
    - Suchanfragen und Seiten der letzten 28 Tage (Impressionen, Klicks, Position)
    - Stand der Sitemap
    """
    import datetime
    t = tok()
    kodiert = urllib.parse.quote(SEITE, safe="")
    print("Indexierung (URL-Pruefung)")
    for pfad in ["", "en/", "privacy", "agb", "impressum"]:
        url = SEITE + pfad
        s, d = anfrage(t, "POST", "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                       {"inspectionUrl": url, "siteUrl": SEITE, "languageCode": "de"})
        if s != 200:
            print(f"  {url}: HTTP {s} {fehler(d)}")
            continue
        r = (d.get("inspectionResult") or {}).get("indexStatusResult") or {}
        print(f"  {url}: {r.get('verdict', '?')} · {r.get('coverageState', '?')} · "
              f"gecrawlt {r.get('lastCrawlTime', 'nie')} · Google-kanonisch {r.get('googleCanonical', '-')} · "
              f"robots {r.get('robotsTxtState', '?')} · Indexierung {r.get('indexingState', '?')}")
    heute = datetime.date.today()
    von = (heute - datetime.timedelta(days=28)).isoformat()
    for dim in ["query", "page", "country", "device"]:
        s, d = anfrage(t, "POST", f"https://www.googleapis.com/webmasters/v3/sites/{kodiert}/searchAnalytics/query",
                       {"startDate": von, "endDate": heute.isoformat(), "dimensions": [dim], "rowLimit": 25})
        zeilen = d.get("rows", []) if s == 200 else []
        print(f"\nSuchleistung nach {dim} ({von} bis heute): "
              + (f"{len(zeilen)} Zeile(n)" if s == 200 else f"HTTP {s} {fehler(d)}"))
        for z in zeilen:
            print(f"  {z['keys'][0][:70]:70} Impr {z.get('impressions', 0):>5} · Klicks {z.get('clicks', 0):>3} · "
                  f"Pos {z.get('position', 0):.1f}")
    s, d = anfrage(t, "GET", f"https://www.googleapis.com/webmasters/v3/sites/{kodiert}/sitemaps")
    print("\nSitemaps")
    for sm in d.get("sitemap", []):
        inhalte = ", ".join(f"{c.get('type')}: {c.get('submitted')} eingereicht / {c.get('indexed', '?')} indexiert"
                            for c in sm.get("contents", []))
        print(f"  {sm.get('path')}: zuletzt gelesen {sm.get('lastDownloaded', 'nie')}, Fehler {sm.get('errors', 0)}, "
              f"Warnungen {sm.get('warnings', 0)} — {inhalte}")
    return 0


if __name__ == "__main__":
    if "--bericht" in sys.argv:
        sys.exit(bericht())
    if "--besitzer" in sys.argv:
        sys.exit(besitzer())
    if "--einrichten" in sys.argv:
        sys.exit(einrichten())
    sys.exit(stand())
