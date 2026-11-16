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
  await page.goto(url);
  await page.waitForFunction(() => window.__LDTD__?.ready === true, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/smoke.png' });
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
