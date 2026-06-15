const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#050d05"/>
  <rect x="80" y="140" width="60" height="70" rx="6" fill="#4ade80"/>
  <rect x="160" y="140" width="60" height="70" rx="6" fill="#4ade80"/>
  <rect x="292" y="140" width="60" height="70" rx="6" fill="#f87171"/>
  <rect x="372" y="140" width="60" height="70" rx="6" fill="#f87171"/>
  <rect x="70" y="190" width="100" height="190" rx="10" fill="#2563eb"/>
  <rect x="342" y="190" width="100" height="190" rx="10" fill="#dc2626"/>
  <rect x="186" y="210" width="140" height="170" rx="8" fill="#cbd5e1"/>
  <rect x="236" y="310" width="40" height="70" rx="20" fill="#451a03"/>
  <line x1="256" y1="80" x2="256" y2="420" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
  <line x1="180" y1="240" x2="332" y2="240" stroke="#38bdf8" stroke-width="14" stroke-linecap="round"/>
</svg>`;

(async () => {
  const browser = await chromium.launch();
  const dir = path.join(__dirname);

  for (const size of [512, 192, 96]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent">
      <img src="data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}"
           width="${size}" height="${size}" style="display:block"/>
    </body></html>`);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
    fs.writeFileSync(path.join(dir, `icon-${size}.png`), buf);
    console.log(`icon-${size}.png erstellt (${buf.length} bytes)`);
    await page.close();
  }

  await browser.close();
  console.log('Alle Icons erstellt.');
})();
