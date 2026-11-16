/**
 * Builds tools/art/contact-sheet.html from the generated art and renders it to
 * test-results/contact-sheet.png (plus one PNG per section) with the preinstalled Playwright.
 * Run with `npm run art:sheet` (regenerates the art first).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allSpriteAssets } from './catalog';
import type { ArtAsset } from './lib/asset';
import { renderMapBackground, renderMapThumbnail } from './maps/render';
import { SAMPLE_MAPS } from './maps/samples';
import { TOWER_ART } from './towers';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const RESULTS = join(ROOT, 'test-results');
const SAMPLES = join(RESULTS, 'art-samples');
const SHEET = join(HERE, 'contact-sheet.html');

interface Page {
  goto(url: string): Promise<unknown>;
  waitForLoadState(state: string): Promise<void>;
  screenshot(o: { path: string; fullPage?: boolean }): Promise<unknown>;
  locator(sel: string): { screenshot(o: { path: string }): Promise<unknown> };
  evaluate<T>(fn: () => T): Promise<T>;
}
interface Browser {
  newPage(o: { viewport: { width: number; height: number } }): Promise<Page>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(): Promise<Browser> };
}

function loadPlaywright(): Playwright {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright') as Playwright;
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return createRequire(root + '/noop.js')('playwright') as Playwright;
  }
}

const art = (a: ArtAsset) => `../../public/assets/art/${a.dir}/${a.key}.svg`;
const img = (src: string, w: number, h: number, extra = '') => `<img src="${src}" width="${w}" height="${h}" ${extra}>`;

function towersSection(byKey: Map<string, ArtAsset>): string {
  const src = (k: string) => {
    const a = byKey.get(k);
    if (!a) throw new Error(`missing ${k}`);
    return art(a);
  };
  const stack = (id: string, size: number, rot: number, t3: boolean) => {
    const turret = src(`tower-${id}-turret${t3 ? '-t3' : ''}`);
    const rotor = id === 'heli' ? img(src('tower-heli-rotor'), size, size, `style="transform:rotate(${rot * 2}deg)"`) : '';
    return `<div class="stack" style="width:${size}px;height:${size}px">${img(src(`tower-${id}-base`), size, size)}${img(turret, size, size, `style="transform:rotate(${rot}deg)"`)}${rotor}</div>`;
  };
  const cards = TOWER_ART.map(
    (t) => `<div class="card"><div class="row">${img(src(`tower-${t.id}-base`), 128, 128)}${img(src(`tower-${t.id}-turret`), 128, 128)}${stack(t.id, 128, -30, false)}${stack(t.id, 128, 40, true)}
      <div class="col"><div class="tile grass">${stack(t.id, 64, -30, false)}</div><div class="tile dark">${stack(t.id, 64, 150, true)}</div></div></div><p>${t.id} <span>${t.category}</span></p></div>`,
  ).join('');
  return `<section id="towers"><h2>Towers (base, turret, composite, t3, 64px)</h2><div class="grid">${cards}</div></section>`;
}

function simpleSection(id: string, title: string, list: ArtAsset[], scales: number[], tile: string): string {
  const cards = list
    .map((a) => {
      const imgs = scales.map((s) => `<div class="tile ${tile}">${img(art(a), Math.round(a.width * s), Math.round(a.height * s))}</div>`).join('');
      return `<div class="card"><div class="row">${imgs}</div><p>${a.key}</p></div>`;
    })
    .join('');
  return `<section id="${id}"><h2>${title}</h2><div class="grid">${cards}</div></section>`;
}

function mapsSection(): string {
  mkdirSync(SAMPLES, { recursive: true });
  const cards = SAMPLE_MAPS.map((m) => {
    writeFileSync(join(SAMPLES, `${m.id}.svg`), renderMapBackground(m));
    writeFileSync(join(SAMPLES, `${m.id}-thumb.svg`), renderMapThumbnail(m));
    return `<div class="card"><div class="row">${img(`../../test-results/art-samples/${m.id}.svg`, 770, 540)}${img(`../../test-results/art-samples/${m.id}-thumb.svg`, 384, 216)}</div><p>${m.id}</p></div>`;
  }).join('');
  return `<section id="maps"><h2>Sample maps (QA only, not shipped)</h2><div class="grid">${cards}</div></section>`;
}

function realMapsSection(): string {
  const dir = join(ROOT, 'public/assets/art/maps');
  if (!existsSync(dir)) return '';
  return `<section id="gamemaps"><h2>Game maps</h2><p>See public/assets/art/maps</p></section>`;
}

function html(): string {
  const assets = allSpriteAssets();
  const byKey = new Map(assets.map((a) => [a.key, a]));
  const of = (prefix: string) => assets.filter((a) => a.key.startsWith(prefix));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Art contact sheet</title><style>
  body{background:#0d1117;color:#e6edf7;font:14px system-ui,sans-serif;margin:0;padding:24px;width:1880px}
  h2{color:#38bdf8;margin:28px 0 12px}
  section{padding:8px 0}
  .grid{display:flex;flex-wrap:wrap;gap:14px}
  .card{background:#121826;border:1px solid #2f3b55;border-radius:14px;padding:10px}
  .card p{margin:6px 0 0;font-weight:600}.card p span{color:#8b9bb8;font-weight:400;margin-left:6px}
  .row{display:flex;gap:8px;align-items:center}.col{display:flex;flex-direction:column;gap:4px}
  .stack{position:relative}.stack img{position:absolute;left:0;top:0}
  .tile{display:flex;align-items:center;justify-content:center;border-radius:8px;padding:4px}
  .grass{background:#62a347}.dark{background:#323d4b}.sand{background:#e3b877}.panel{background:#121826;border:1px solid #2f3b55}
  </style></head><body><h1>LegallyDistinctTD art</h1>
  ${towersSection(byKey)}
  ${simpleSection('enemies', 'Enemies (96 and 48)', of('enemy-'), [1, 0.5], 'grass')}
  ${simpleSection('bosses', 'Bosses (192 and 96)', of('boss-'), [1, 0.5], 'sand')}
  ${simpleSection('projectiles', 'Projectiles (1x and 2x)', of('proj-'), [1, 2], 'dark')}
  ${simpleSection('fx', 'Effects', of('fx-'), [1], 'dark')}
  ${simpleSection('icons', 'Icons (64 and 32)', of('icon-'), [1, 0.5], 'panel')}
  ${simpleSection('logo', 'Logo', of('logo'), [0.6], 'panel')}
  ${mapsSection()}
  ${realMapsSection()}
  </body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(SHEET, html());
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1928, height: 1200 } });
    await page.goto(pathToFileURL(SHEET).href);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: join(RESULTS, 'contact-sheet.png'), fullPage: true });
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('section')).map((s) => s.id));
    for (const id of ids) await page.locator(`#${id}`).screenshot({ path: join(RESULTS, `contact-sheet-${id}.png`) });
  } finally {
    await browser.close();
  }
  process.stdout.write(`art: contact sheet written to ${join(RESULTS, 'contact-sheet.png')}\n`);
}

await main();
