// Take the 4 screenshots with Playwright: serve game/ locally, load each
// ?shot= scene, wait for __shotReady + a settle delay, capture 1280x720 JPEG.
// Usage: node shots.mjs  (serves game/ on :8931, writes screenshots/)
import { chromium } from '/tmp/shot-tool/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('./game/', import.meta.url).pathname;
const OUT = new URL('./screenshots/', import.meta.url).pathname;
const SHOTS = JSON.parse(await readFile(new URL('./shots.json', import.meta.url), 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(req.url.split('?')[0].replace(/^\/+/, '') || 'index.html');
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(500); res.end('err'); }
});
await new Promise((r) => server.listen(8931, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
let failed = 0;
for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:8931/${shot.query}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  } catch { errors.push('TIMEOUT waiting for __shotReady'); }
  // Settle: let the world run so tracers / heli / traffic read as alive.
  await page.waitForTimeout(shot.name.includes('combat') ? 1800 : 900);
  await page.screenshot({ path: join(OUT, shot.name), type: 'jpeg', quality: 82 });
  console.log(shot.name, errors.length ? `ERRORS: ${errors.join(' | ')}` : 'ok');
  if (errors.length) failed += 1;
  await page.close();
}
await browser.close();
server.close();
console.log(failed ? `FAILED ${failed} scene(s)` : 'ALL SCENES OK');
process.exit(failed ? 1 : 0);
