// Feature-Grafik fuer Google Play: 1024x500, Pflichtformat.
// Bewusst KEIN aufgeblasener Screenshot — bei 1024x500 (Querformat) waere ein
// Hochkant-Bild entweder winzig oder beschnitten. Stattdessen: Wortmarke links,
// echtes Spielgeschehen rechts als angeschnittener Ausschnitt.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1024px;height:500px;overflow:hidden;
       font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
       background:#04080d}
  .buehne{position:relative;width:1024px;height:500px;
    background:radial-gradient(120% 140% at 18% 30%, #14243a 0%, #0a1220 45%, #04080d 100%)}
  /* Angeschnittener Spielausschnitt rechts, leicht gekippt: gibt Tiefe, ohne
     dass der Screenshot wie ein Fremdkoerper im Banner klebt. */
  .spiel{position:absolute;right:-30px;top:-215px;width:600px;
    transform:rotate(-7deg) scale(1.05);
    -webkit-mask-image:linear-gradient(100deg, transparent 0%, #000 22%, #000 100%);
            mask-image:linear-gradient(100deg, transparent 0%, #000 22%, #000 100%);
    box-shadow:0 30px 90px rgba(0,0,0,.7)}
  .spiel img{width:100%;display:block}
  .text{position:absolute;left:64px;top:0;height:100%;
    display:flex;flex-direction:column;justify-content:center;gap:14px;z-index:2}
  h1{font-size:104px;line-height:.9;font-weight:900;letter-spacing:-5px;
     background:linear-gradient(100deg,#7dd3fc 0%,#60a5fa 45%,#a78bfa 100%);
     -webkit-background-clip:text;background-clip:text;color:transparent;
     filter:drop-shadow(0 6px 30px rgba(56,189,248,.35))}
  .unter{font-size:25px;font-weight:700;color:#93a4bd;letter-spacing:.5px}
  .marken{display:flex;gap:9px;margin-top:6px}
  .marke{font-size:14.5px;font-weight:800;letter-spacing:.06em;
    padding:7px 14px;border-radius:999px;
    background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.4);color:#bfdbfe}
  /* Vignette bindet Text und Bild zusammen, statt sie nebeneinanderzustellen */
  .vig{position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(90deg,#04080d 20%,rgba(4,8,13,.85) 42%,transparent 66%)}
</style></head><body>
<div class="buehne">
  <div class="spiel"><img src="SPIELBILD"></div>
  <div class="vig"></div>
  <div class="text">
    <h1>FORTRESS</h1>
    <div class="unter">Bauen · Verteidigen · Zerstören</div>
    <div class="marken">
      <span class="marke">2–3 SPIELER</span>
      <span class="marke">ONLINE</span>
      <span class="marke">OFFLINE GEGEN BOT</span>
    </div>
  </div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({
    viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1
  })).newPage();
  // Als Daten-URL einbetten, nicht als file://-Verweis: setContent laedt die
  // Seite unter about:blank, und von dort ist der Dateizugriff gesperrt — das
  // Bild blieb schlicht leer, ohne jede Fehlermeldung.
  const fs = require('fs');
  const b64 = fs.readFileSync(path.join(ROOT, 'store/ios-6.7/shoot.png')).toString('base64');
  await p.setContent(HTML.replace('SPIELBILD', 'data:image/png;base64,' + b64));
  await p.waitForTimeout(700);
  const out = path.join(ROOT, 'store/feature-graphic-1024x500.png');
  await p.screenshot({ path: out });
  console.log(' ' + out);
  await browser.close();
})();
