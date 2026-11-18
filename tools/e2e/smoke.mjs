// Playwright smoke test: serves dist via `vite preview`, loads the page and checks for errors.
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return createRequire(root + '/noop.js')('playwright');
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

const { chromium } = loadPlaywright();
const port = await freePort();
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
});
const errors = [];
const isFontHost = (u) => /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u || '');
let browser;
try {
  const url = `http://127.0.0.1:${port}/`;
  await waitForServer(url);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (isFontHost(m.location().url)) return;
    errors.push(`console: ${m.text()} (${m.location().url})`);
  });
  page.on('requestfailed', (r) => {
    if (!isFontHost(r.url())) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !isFontHost(r.url())) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  // Easy gives enough start money for four towers.
  await page.goto(`${url}?difficulty=easy`);
  await page.waitForFunction(() => window.__LDTD__?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/smoke.png' });

  // Place towers through the debug API (Green Valley: path runs y=244, x=715, y=557).
  const placed = await page.evaluate(() => {
    const api = window.__LDTD__;
    return [api.placeTower('blaster', 420, 330), api.placeTower('blaster', 620, 330), api.placeTower('spikes', 715, 420)];
  });
  if (placed.some((uid) => uid === null)) throw new Error(`tower placement failed: ${JSON.stringify(placed)}`);

  // Place one more with real input: hotkey 1 picks the Blaster, a click on the field places it.
  const box = await page.locator('canvas').boundingBox();
  const toScreen = (x, y) => [box.x + (x / 1920) * box.width, box.y + (y / 1080) * box.height];
  await page.keyboard.press('Digit1');
  await page.mouse.move(...toScreen(800, 150));
  await page.mouse.click(...toScreen(800, 150));
  const towers = await page.evaluate(() => window.__LDTD__.sim.towers.length);
  if (towers !== 4) throw new Error(`expected 4 towers after mouse placement, got ${towers}`);

  const moneyBefore = await page.evaluate(() => window.__LDTD__.sim.money);
  await page.evaluate(() => {
    window.__LDTD__.setSpeed(3);
    window.__LDTD__.startWave();
  });
  const t0 = Date.now();
  await page.waitForFunction(() => window.__LDTD__.sim.enemies.length >= 3, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/gameplay.png' });
  await page.waitForTimeout(Math.max(0, 20000 - (Date.now() - t0)));
  const after = await page.evaluate(() => ({
    money: window.__LDTD__.sim.money,
    wave: window.__LDTD__.sim.wave,
    phase: window.__LDTD__.sim.phase,
    stats: window.__LDTD__.stats(),
  }));
  console.log(`gameplay: money ${moneyBefore} -> ${after.money}, wave ${after.wave} (${after.phase}), stats ${JSON.stringify(after.stats)}`);
  if (!(after.money > moneyBefore)) throw new Error('no enemies were killed (money did not increase)');

  // Touch (phone): pick a tower, then tap the field to place it.
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(`phone pageerror: ${e.message}`));
  await phone.goto(`${url}?difficulty=easy`);
  await phone.waitForFunction(() => window.__LDTD__?.ready === true, null, { timeout: 30000 });
  const pbox = await phone.locator('canvas').boundingBox();
  await phone.evaluate(() => window.__LDTD__.controller.beginPlacement('frost'));
  await phone.touchscreen.tap(pbox.x + (600 / 1920) * pbox.width, pbox.y + (360 / 1080) * pbox.height);
  const phoneTowers = await phone.evaluate(() => window.__LDTD__.sim.towers.map((t) => t.def.id));
  if (phoneTowers.join() !== 'frost') throw new Error(`touch placement failed: ${JSON.stringify(phoneTowers)}`);
  await phone.close();
} catch (e) {
  errors.push(String(e));
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (errors.length) {
  console.error('Smoke test failed:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Smoke test passed');
