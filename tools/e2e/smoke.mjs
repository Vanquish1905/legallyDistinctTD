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

/**
 * Drive the HUD with real mouse input: scroll the tower list, pick the Railgun card, place it,
 * select it, change its target mode, upgrade it, toggle speed and start a wave from the top bar.
 */
async function driveHud(page) {
  const box = await page.locator('canvas').boundingBox();
  const at = (p) => [box.x + (p.x / 1920) * box.width, box.y + (p.y / 1080) * box.height];
  const click = async (p) => {
    await page.mouse.move(...at(p));
    await page.mouse.click(...at(p));
  };
  const hud = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 15000 }).then((h) => h.jsonValue())
    .catch((e) => { throw new Error(`HUD wait failed for ${fn}: ${e.message}`); });
  await page.waitForFunction(() => window.__LDTD__?.ready === true && window.__LDTD__.hud, null, { timeout: 30000 });
  await page.evaluate(() => window.__LDTD__.controller.sim.grantMoney(6000));

  // Scroll the list with the mouse wheel until the Railgun card is fully in view.
  await page.mouse.move(...at({ x: 1730, y: 600 }));
  for (let i = 0; i < 12; i++) {
    const card = await page.evaluate(() => window.__LDTD__.hud.cardCenter('railgun'));
    if (card) break;
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(250);
  }
  await hud(() => !window.__LDTD__.hud.listMoving());
  const offset = await page.evaluate(() => window.__LDTD__.hud.listOffset());
  if (!(offset > 0)) throw new Error(`tower list did not scroll (offset ${offset})`);
  const card = await hud(() => window.__LDTD__.hud.cardCenter('railgun'));
  await click(card);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/hud.png' });
  const pending = await page.evaluate(() => window.__LDTD__.controller.pendingTowerId);
  if (pending !== 'railgun') throw new Error(`clicking the Railgun card did not start placement (${pending})`);
  // Any free spot on whatever map is loaded.
  const spot = await page.evaluate(() => {
    const sim = window.__LDTD__.controller.sim;
    for (let y = 200; y < 1000; y += 40) for (let x = 200; x < 1400; x += 40) if (sim.canPlace('railgun', x, y).ok) return { x, y };
    return null;
  });
  if (!spot) throw new Error('no free spot for the railgun');
  await click(spot);
  const rail = await page.evaluate(() => window.__LDTD__.sim.towers.find((t) => t.def.id === 'railgun')?.uid ?? null);
  if (rail === null) throw new Error('railgun was not placed by clicking the field');

  // Select it on the field, then use the tower panel.
  await click(spot);
  const selected = await page.evaluate(() => window.__LDTD__.controller.selectedUid);
  if (selected !== rail) throw new Error(`clicking the railgun did not select it (${selected})`);
  await click(await hud(() => window.__LDTD__.hud.control('target-strong')));
  await click(await hud(() => window.__LDTD__.hud.control('upgrade0')));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/hud-panel.png' });
  const t = await page.evaluate((uid) => {
    const tw = window.__LDTD__.sim.towers.find((x) => x.uid === uid);
    return { mode: tw.targetMode, tiers: [...tw.tiers] };
  }, rail);
  if (t.mode !== 'strong') throw new Error(`target mode not changed via panel (${t.mode})`);
  if (t.tiers.join() !== '1,0') throw new Error(`upgrade via panel failed (${t.tiers})`);

  // Top bar: speed toggle and next wave.
  await click(await hud(() => window.__LDTD__.hud.control('speed')));
  const speed = await page.evaluate(() => window.__LDTD__.controller.speed);
  if (speed !== 2) throw new Error(`speed button did not toggle (${speed})`);
  await click(await hud(() => window.__LDTD__.hud.control('next')));
  const wave = await page.evaluate(() => window.__LDTD__.sim.wave);
  if (wave !== 1) throw new Error(`next-wave button did not start wave 1 (${wave})`);
  console.log(`hud: list scrolled ${Math.round(offset)} px, railgun placed, upgraded, targeting strong, speed ${speed}x, wave ${wave}`);
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
  await page.goto(`${url}?e2e&difficulty=easy`);
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
    // Count kills: the wave-clear bonus alone would also raise money.
    window.__kills = 0;
    window.__LDTD__.controller.events.on('sim', (e) => {
      if (e.type === 'enemyKilled') window.__kills++;
    });
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
    kills: window.__kills,
  }));
  console.log(`gameplay: ${after.kills} kills, money ${moneyBefore} -> ${after.money}, wave ${after.wave} (${after.phase}), stats ${JSON.stringify(after.stats)}`);
  if (!(after.kills > 0)) throw new Error('no enemies were killed');
  if (!(after.money > moneyBefore)) throw new Error('money did not increase');

  // Restart on another map, then the same one: teardown frees the old map texture and reloads.
  for (const mapId of ['dune-canyon', 'dune-canyon']) {
    await page.evaluate((id) => window.__LDTD__.restart(id), mapId);
    await page.waitForFunction((id) => window.__LDTD__?.ready === true && window.__LDTD__.sim.map.id === id, mapId, { timeout: 30000 });
  }
  const restarted = await page.evaluate(() => window.__LDTD__.sim.towers.length);
  if (restarted !== 0) throw new Error(`restart kept ${restarted} towers`);

  await driveHud(page);

  // Production players get no debug hooks.
  const plain = await browser.newPage({ viewport: { width: 800, height: 450 } });
  plain.on('pageerror', (e) => errors.push(`plain pageerror: ${e.message}`));
  await plain.goto(`${url}?stress=300`);
  await plain.waitForTimeout(4000);
  if (await plain.evaluate(() => window.__LDTD__ !== undefined)) errors.push('debug API exposed without ?e2e');
  await plain.close();

  // Touch (phone): pick a tower, then tap the field to place it.
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(`phone pageerror: ${e.message}`));
  await phone.goto(`${url}?e2e&difficulty=easy`);
  await phone.waitForFunction(() => window.__LDTD__?.ready === true, null, { timeout: 30000 });
  const pbox = await phone.locator('canvas').boundingBox();
  const ptap = (p) => phone.touchscreen.tap(pbox.x + (p.x / 1920) * pbox.width, pbox.y + (p.y / 1080) * pbox.height);
  await phone.evaluate(() => window.__LDTD__.controller.beginPlacement('frost'));
  await ptap({ x: 600, y: 360 });
  // Then with the HUD: tap the Blaster card, tap the field.
  await phone.waitForFunction(() => window.__LDTD__.hud?.cardCenter('blaster') != null, null, { timeout: 10000 });
  await ptap(await phone.evaluate(() => window.__LDTD__.hud.cardCenter('blaster')));
  const phonePending = await phone.evaluate(() => window.__LDTD__.controller.pendingTowerId);
  if (phonePending !== 'blaster') throw new Error(`tapping the Blaster card did not start placement (${phonePending})`);
  await ptap({ x: 420, y: 330 });
  const phoneTowers = await phone.evaluate(() => window.__LDTD__.sim.towers.map((t) => t.def.id));
  if (phoneTowers.join() !== 'frost,blaster') throw new Error(`touch placement failed: ${JSON.stringify(phoneTowers)}`);
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
