// Vorschaubilder im Querformat 1024x500 — EINE Gestaltung, vier Dateien:
//
//   store/feature-graphic-1024x500.png      Google Play (Pflichtformat)
//   public/social-card.jpg                  geteilte Links aufs Spiel (og:image)
//   docs/website/bilder/social-card.jpg     geteilte Links auf die Website
//   docs/website/bilder/social-card-en.jpg  dasselbe, englische Seite
//
// **Warum neu (v3.130.0).** Bis dahin zeigte die Vorschau des Spiels noch den
// dunklen Glas-Look und einen ALTEN Arbeitstitel als Schriftzug — jeder in
// WhatsApp geteilte Link warb also mit einem Namen, den das Spiel nicht mehr
// traegt. Jetzt: gemalter Menue-Hintergrund, das gesetzte Logo, ein echtes
// Spielbild im Telefonrahmen und die gemalten Avatare. Dieselben Bausteine
// wie im Spiel, damit Vorschau und App zusammenpassen.
//
// Bewusst KEIN aufgeblasener Screenshot — bei 1024x500 (Querformat) waere ein
// Hochkant-Bild entweder winzig oder beschnitten.
//
// Voraussetzung: die Website-Bilder aus `node tools/make-screenshots.cjs website`
// (das Spielbild kommt aus docs/website/bilder/shoot.webp).
//
// Playwright aus node_modules, ersatzweise aus der globalen Installation
// dieses Rechners. Ein fester Pfad allein laeuft ueberall sonst ins Leere
// (v3.94.0) — tests/pfade.test.js haelt das fest.
const { chromium } = (() => {
  try { return require('playwright'); }
  catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
})();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Als Daten-URL einbetten, nicht als file://-Verweis: setContent laedt die
// Seite unter about:blank, und von dort ist der Dateizugriff gesperrt — das
// Bild blieb schlicht leer, ohne jede Fehlermeldung.
const daten = (rel, typ) => `data:${typ};base64,` + fs.readFileSync(path.join(ROOT, rel)).toString('base64');

const TEXTE = {
  de: { zeile: 'Bauen. Verteidigen. Zerstören.', marken: ['1–3 Spieler', 'Online & Bot', 'Kostenlos'] },
  en: { zeile: 'Build. Defend. Destroy.', marken: ['1–3 players', 'Online & bot', 'Free'] },
};

const html = (sprache) => {
  const t = TEXTE[sprache];
  const avatare = ['hexerin', 'pestdoktor', 'phoenix', 'skelett']
    .map((n) => `<img src="${daten(`public/wappen/${n}.webp`, 'image/webp')}">`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Lilita One';src:url(${daten('public/fonts/lilita-one.woff2', 'font/woff2')}) format('woff2')}
  @font-face{font-family:'Nunito';font-weight:200 1000;src:url(${daten('public/fonts/nunito.woff2', 'font/woff2')}) format('woff2')}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1024px;height:500px;overflow:hidden;background:#0d1f45;font-family:'Nunito',sans-serif}
  .buehne{position:absolute;inset:0;background:url(${daten('public/menu-hintergrund.jpg', 'image/jpeg')}) center 62%/cover}
  /* Unten links dunkler: dort stehen Zeile und Marken auf Wiese. */
  .buehne::after{content:"";position:absolute;inset:0;
    background:linear-gradient(90deg,rgba(13,31,69,.55) 0%,rgba(13,31,69,.25) 45%,rgba(13,31,69,0) 70%),
               linear-gradient(180deg,rgba(13,31,69,0) 45%,rgba(13,31,69,.7) 100%)}
  .text{position:absolute;left:48px;top:40px;width:520px;z-index:2}
  .logo{width:470px;display:block;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45))}
  .zeile{margin-top:14px;font-family:'Lilita One';font-size:36px;color:#fff3a6;letter-spacing:.01em;
    text-shadow:0 3px 0 #f08a12,0 2px 0 #1b0f06,2px 2px 0 #1b0f06,-2px 2px 0 #1b0f06,2px -1px 0 #1b0f06,-2px -1px 0 #1b0f06,0 8px 14px rgba(0,0,0,.5)}
  .marken{display:flex;gap:10px;margin-top:18px}
  .marke{font-family:'Lilita One';font-size:20px;color:#fffaf0;padding:5px 16px;border-radius:999px;
    background:linear-gradient(180deg,#8fd0ff,#3f97ea 55%,#1f5fc4);border:3px solid #1b0f06;
    box-shadow:0 4px 0 #1b0f06,inset 0 2px 0 rgba(255,255,255,.45);
    text-shadow:0 2px 0 #1b0f06,1.5px 1.5px 0 #1b0f06,-1.5px 1.5px 0 #1b0f06,1.5px -1px 0 #1b0f06,-1.5px -1px 0 #1b0f06}
  .marke.gold{background:linear-gradient(180deg,#fff2a0,#ffc72e 55%,#f08a12)}
  .marke.gruen{background:linear-gradient(180deg,#b6f59a,#4fd36b 55%,#1c8a3a)}
  /* Telefon rechts, leicht gekippt und unten angeschnitten. */
  .telefon{position:absolute;right:92px;top:34px;width:236px;transform:rotate(6deg);z-index:1;
    padding:8px;border-radius:38px;background:linear-gradient(157deg,#6e7381,#2a2d35 30%,#1b1e25 60%,#3a3e49 85%,#131519);
    box-shadow:0 0 0 3px #1b0f06,0 24px 50px rgba(0,0,0,.6)}
  .telefon .glas{border-radius:31px;overflow:hidden;background:#000}
  .telefon img{display:block;width:100%}
  .avatare{position:absolute;right:30px;bottom:26px;display:flex;z-index:3}
  .avatare img{width:84px;height:84px;border-radius:50%;margin-left:-16px;
    border:4px solid #1b0f06;box-shadow:inset 0 0 0 3px #ffd23a,0 6px 12px rgba(0,0,0,.45);background:#0d1f45}
</style></head><body>
<div class="buehne"></div>
<div class="text">
  <img class="logo" src="${daten('public/logo.png', 'image/png')}">
  <div class="zeile">${t.zeile}</div>
  <div class="marken"><span class="marke gold">${t.marken[0]}</span><span class="marke">${t.marken[1]}</span><span class="marke gruen">${t.marken[2]}</span></div>
</div>
<div class="telefon"><div class="glas"><img src="${daten('docs/website/bilder/shoot.webp', 'image/webp')}"></div></div>
<div class="avatare">${avatare}</div>
</body></html>`;
};

(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({
    viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1
  })).newPage();
  const ziele = [
    ['de', 'store/feature-graphic-1024x500.png', null],
    ['de', 'public/social-card.jpg', 84],
    ['de', 'docs/website/bilder/social-card.jpg', 84],
    ['en', 'docs/website/bilder/social-card-en.jpg', 84],
  ];
  for (const [sprache, rel, guete] of ziele) {
    await p.setContent(html(sprache));
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    const out = path.join(ROOT, rel);
    await p.screenshot(guete ? { path: out, type: 'jpeg', quality: guete } : { path: out });
    console.log(' ' + rel + '  ' + Math.round(fs.statSync(out).size / 1024) + ' kB');
  }
  await browser.close();
})();
