#!/usr/bin/env python3
"""Wochenbericht aus App Store Connect (Analytics-Berichte) — v3.132.4.

Anlass: Es gab keine Messung, ob Name, Untertitel, Schlagwoerter und Plakate
(1.0.2/1.0.3) in der Suche greifen. Apple liefert die Zahlen ueber die
Analytics-Berichte-Schnittstelle: Einblendungen, Produktseiten-Aufrufe,
Ladevorgaenge — je Quelle (Suche, Stoebern, Web …) und Land.

    (ohne Argument)  NUR LESEN: gibt es Berichtsanfragen, welche Berichte, wie
                     viele Tage liegen vor?
    --einrichten     legt die Berichtsanfragen an (laufend + einmaliger
                     Rueckblick). Verlangt BESTAETIGUNG=BERICHT. Eine Anfrage
                     je Art und App; Apple liefert ab dem Folgetag.
    --bericht        schreibt den Wochenbericht (Markdown) nach $BERICHT_DATEI
                     (Vorgabe bericht.md) und auf die Standardausgabe.

**Was es bewusst nicht tut.** Keine Verkaufsberichte (`salesReports`): die
brauchen die Lieferantennummer, die nirgends im Repository steht, und die
Analytics-Berichte nennen die Quelle der Ladevorgaenge — die Frage, um die es
geht. **Nichts wird geraten:** fehlt eine Spalte in Apples Datei, steht im
Bericht „nicht geliefert", nicht null.

Umgebung: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (wie die anderen Skripte).
"""

import csv
import gzip
import io
import os
import pathlib
import sys

import requests

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import Apple, BUNDLE, BASIS, erste, feld, kurz  # noqa: E402

sag = print
KATEGORIEN = ("APP_STORE_ENGAGEMENT", "COMMERCE")
TAGE = 7  # Berichtszeitraum; verglichen wird mit den TAGE davor


# ── Apple lesen ────────────────────────────────────────────────────────────

def alle(apple: Apple, pfad: str, **werte) -> list:
    """Alle Seiten einer Liste (Apple gibt `links.next` als volle Adresse)."""
    daten, werte = [], dict(werte)
    werte.setdefault("limit", 200)
    while pfad:
        st, aw = apple.holen(pfad, **werte)
        if st != 200:
            sag(f"  ! {pfad} nicht lesbar (HTTP {st}): {kurz(aw)}")
            return daten
        j = aw.json()
        daten += j.get("data") or []
        nxt = (j.get("links") or {}).get("next")
        pfad = nxt.split(BASIS + "/", 1)[1] if nxt else None
        werte = {}
    return daten


def anfragen(apple: Apple, app_id: str) -> list:
    return alle(apple, f"v1/apps/{app_id}/analyticsReportRequests")


def berichte(apple: Apple, anfrage_id: str) -> list:
    out = []
    for k in KATEGORIEN:
        out += alle(apple, f"v1/analyticsReportRequests/{anfrage_id}/reports", **{"filter[category]": k})
    return out


def tsv_laden(url: str) -> list[dict]:
    """Ein Segment: gzip, tabulatorgetrennt, erste Zeile = Spaltennamen."""
    r = requests.get(url, timeout=120)  # signierte Adresse, KEIN Apple-Kopf
    r.raise_for_status()
    try:
        text = gzip.decompress(r.content).decode("utf-8-sig")
    except OSError:
        text = r.content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text), delimiter="\t"))


def tage_eines_berichts(apple: Apple, bericht_id: str) -> dict:
    """{Datum: (Verarbeitungsdatum, Zeilen)} — je Tag die NEUESTE Lieferung.

    Der einmalige Rueckblick und die laufende Lieferung ueberlappen; ohne diese
    Auswahl zaehlte jeder Tag doppelt.
    """
    tage: dict = {}
    for inst in alle(apple, f"v1/analyticsReports/{bericht_id}/instances", **{"filter[granularity]": "DAILY"}):
        verarb = feld(inst, "processingDate") or ""
        zeilen = []
        for seg in alle(apple, f"v1/analyticsReportInstances/{inst['id']}/segments"):
            url = feld(seg, "url")
            if url:
                zeilen += tsv_laden(url)
        je_datum: dict = {}
        for z in zeilen:
            je_datum.setdefault(spalte(z, "Date"), []).append(z)
        for datum, rows in je_datum.items():
            if datum and (datum not in tage or verarb >= tage[datum][0]):
                tage[datum] = (verarb, rows)
    return tage


# ── Auswerten (rein, ohne Netz) ────────────────────────────────────────────

def spalte(zeile: dict, name: str) -> str:
    """Spalte ohne Ruecksicht auf Gross-/Kleinschreibung; '' wenn es sie nicht gibt."""
    for k, v in zeile.items():
        if k and k.strip().lower() == name.lower():
            return (v or "").strip()
    return ""


def hat_spalte(zeilen: list, name: str) -> bool:
    return bool(zeilen) and any(k and k.strip().lower() == name.lower() for k in zeilen[0])


def zahl(s: str) -> int:
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return 0


def zeitraeume(daten: list[str], tage: int = TAGE):
    """(aktuell, davor): die letzten `tage` Daten und die `tage` davor."""
    d = sorted(set(daten))
    aktuell = d[-tage:]
    davor = d[-2 * tage:-tage] if len(d) > tage else []
    return aktuell, davor


def summe(zeilen: list, daten: set, **filter_) -> int:
    n = 0
    for z in zeilen:
        if spalte(z, "Date") not in daten:
            continue
        if all(spalte(z, k.replace("_", " ")).lower() == v.lower() for k, v in filter_.items()):
            n += zahl(spalte(z, "Counts"))
    return n


def nach(zeilen: list, daten: set, schluessel: str, **filter_) -> list:
    """[(Wert, Summe)] absteigend, je Wert der Spalte `schluessel`."""
    s: dict = {}
    for z in zeilen:
        if spalte(z, "Date") not in daten:
            continue
        if not all(spalte(z, k.replace("_", " ")).lower() == v.lower() for k, v in filter_.items()):
            continue
        w = spalte(z, schluessel) or "—"
        s[w] = s.get(w, 0) + zahl(spalte(z, "Counts"))
    return sorted(s.items(), key=lambda x: -x[1])


def prozent(a: int, b: int) -> str:
    return "—" if not b else f"{100 * a / b:.1f} %"


def veraenderung(jetzt: int, davor: int | None) -> str:
    if davor is None:
        return "—"
    if davor == 0:
        return "neu" if jetzt else "0"
    d = round(100 * (jetzt - davor) / davor)
    return "0 %" if d == 0 else f"{d:+d} %"


def bericht_schreiben(eng: list, dl: list, suche: list) -> str:
    """Markdown. `eng` = Discovery-and-Engagement-Zeilen, `dl` = Downloads, `suche` = Zeilen mit Suchbegriff."""
    alle_daten = [spalte(z, "Date") for z in eng + dl]
    if not alle_daten:
        return ("# Wochenbericht\n\nNoch keine Daten. Apple liefert die Berichte ab dem Folgetag nach "
                "`--einrichten`; der einmalige Rueckblick kann bis zu zwei Tage dauern.\n")
    jetzt, davor = zeitraeume(alle_daten)
    J, D = set(jetzt), set(davor)
    zeile = f"{jetzt[0]} bis {jetzt[-1]}" + (f" (verglichen mit {davor[0]} bis {davor[-1]})" if davor else " (kein Vorzeitraum)")
    out = [f"# Wochenbericht Stack & Siege", "", f"Zeitraum: {zeile}", ""]

    def wert(zeilen, filt):
        a = summe(zeilen, J, **filt)
        b = summe(zeilen, D, **filt) if davor else None
        return a, b

    imp, imp0 = wert(eng, {"Event": "Impression"})
    pv, pv0 = wert(eng, {"Event": "Page view"})
    neu = [z for z in dl if spalte(z, "Download Type").lower() == "first-time download"]
    erst = summe(neu, J)
    erst0 = summe(neu, D) if davor else None
    wieder = summe([z for z in dl if spalte(z, "Download Type").lower() == "redownload"], J)

    out += ["| Kennzahl | Zeitraum | Veraenderung |", "|---|---:|---:|",
            f"| Einblendungen im Store | {imp} | {veraenderung(imp, imp0)} |",
            f"| Produktseiten-Aufrufe | {pv} | {veraenderung(pv, pv0)} |",
            f"| Erstladungen | {erst} | {veraenderung(erst, erst0)} |",
            f"| Wiederladungen | {wieder} | |",
            f"| Aufruf → Ladung | {prozent(erst, pv) if dl else '—'} | |",
            f"| Einblendung → Aufruf | {prozent(pv, imp)} | |", ""]

    if not dl:
        out += ["_Ladevorgaenge: Bericht nicht geliefert._", ""]
    if not eng:
        out += ["_Einblendungen/Aufrufe: Bericht nicht geliefert._", ""]

    def tabelle(titel, paare, kopf, n=8):
        if not paare:
            return [f"**{titel}:** nicht geliefert", ""]
        z = [f"**{titel}**", "", f"| {kopf} | Anzahl |", "|---|---:|"]
        z += [f"| {k} | {v} |" for k, v in paare[:n]]
        return z + [""]

    if hat_spalte(eng, "Source Type"):
        out += tabelle("Einblendungen nach Quelle", nach(eng, J, "Source Type", Event="Impression"), "Quelle")
        out += tabelle("Produktseiten-Aufrufe nach Quelle", nach(eng, J, "Source Type", Event="Page view"), "Quelle")
    if hat_spalte(neu, "Source Type"):
        out += tabelle("Erstladungen nach Quelle", nach(neu, J, "Source Type"), "Quelle")
    if hat_spalte(neu, "Territory"):
        out += tabelle("Erstladungen nach Land", nach(neu, J, "Territory"), "Land")

    if suche:
        begriffe = nach(suche, J, "Search Term", Event="Impression") if hat_spalte(suche, "Event") else nach(suche, J, "Search Term")
        out += tabelle("Suchbegriffe (Einblendungen)", begriffe, "Begriff", n=15)
    else:
        out += ["**Suchbegriffe:** nicht geliefert (der Detail-Bericht hat noch keine Tage oder Apple blendet "
                "kleine Zahlen aus)", ""]

    gesamt = imp + pv + erst
    if gesamt < 50:
        out += ["_Hinweis: Apple blendet Zahlen unter einer Mindestmenge aus; bei so wenigen Ladungen ist "
                "vieles leer oder gerundet. Aussagekraft wächst mit den Wochen._", ""]
    return "\n".join(out)


# ── Ablauf ─────────────────────────────────────────────────────────────────

def app_holen(apple: Apple):
    st, app = erste(apple, "v1/apps", **{"filter[bundleId]": BUNDLE})
    if not app:
        sag(f"Kein App-Eintrag fuer {BUNDLE} (HTTP {st})")
        return None
    return app["id"]


def lesen(apple: Apple, app_id: str) -> int:
    reqs = anfragen(apple, app_id)
    if not reqs:
        sag("Keine Berichtsanfrage. Mit --einrichten (BESTAETIGUNG=BERICHT) anlegen.")
        return 0
    for r in reqs:
        sag(f"— Anfrage {r['id']}: {feld(r, 'accessType')}"
            + (" — WEGEN INAKTIVITAET GESTOPPT" if feld(r, 'stoppedDueToInactivity') else ""))
        for b in berichte(apple, r["id"]):
            inst = alle(apple, f"v1/analyticsReports/{b['id']}/instances", **{"filter[granularity]": "DAILY"})
            daten = sorted(feld(i, "processingDate") or "" for i in inst)
            sag(f"    {feld(b, 'category')} / {feld(b, 'name')}: {len(inst)} Tage"
                + (f" ({daten[0]} … {daten[-1]})" if daten else ""))
    return 0


def einrichten(apple: Apple, app_id: str) -> int:
    if os.environ.get("BESTAETIGUNG") != "BERICHT":
        sag("Zum Anlegen die Eingabe 'bestaetigung' auf BERICHT setzen.")
        return 1
    vorhanden = {feld(r, "accessType") for r in anfragen(apple, app_id)}
    rc = 0
    for art in ("ONGOING", "ONE_TIME_SNAPSHOT"):
        if art in vorhanden:
            sag(f"  {art}: gibt es schon — nichts geschrieben")
            continue
        st, aw = apple.anlegen("v1/analyticsReportRequests", {"data": {
            "type": "analyticsReportRequests", "attributes": {"accessType": art},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
        if st in (200, 201):
            sag(f"  ✓ {art} angelegt")
        else:
            sag(f"  ! {art} abgelehnt (HTTP {st}): {kurz(aw)}")
            rc = 1
    return rc


def sammeln(apple: Apple, app_id: str):
    """(Engagement-Zeilen, Download-Zeilen, Zeilen mit Suchbegriff)."""
    eng: dict = {}
    dl: dict = {}
    such: dict = {}
    for r in anfragen(apple, app_id):
        for b in berichte(apple, r["id"]):
            name = (feld(b, "name") or "").lower()
            # „Detailed" traegt den Suchbegriff; „Standard" die Gesamtzahlen. Beide
            # zu summieren zaehlte jede Einblendung doppelt.
            if "discovery and engagement" in name:
                ziel = such if "detailed" in name else eng
            elif "download" in name and "detailed" not in name:
                ziel = dl
            else:
                continue
            for datum, (verarb, rows) in tage_eines_berichts(apple, b["id"]).items():
                if datum not in ziel or verarb >= ziel[datum][0]:
                    ziel[datum] = (verarb, rows)
    flach = lambda d: [z for _, rows in d.values() for z in rows]  # noqa: E731
    return flach(eng), flach(dl), flach(such)


def main() -> int:
    argv = sys.argv[1:]
    apple = Apple()
    app_id = app_holen(apple)
    if not app_id:
        return 1
    if "--einrichten" in argv:
        return einrichten(apple, app_id)
    if "--bericht" in argv:
        eng, dl, such = sammeln(apple, app_id)
        text = bericht_schreiben(eng, dl, such)
        pathlib.Path(os.environ.get("BERICHT_DATEI", "bericht.md")).write_text(text, encoding="utf-8")
        sag(text)
        return 0
    return lesen(apple, app_id)


if __name__ == "__main__":
    sys.exit(main())
