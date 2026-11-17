/**
 * Renders large SVGs (map backgrounds) to JPEG with the preinstalled Playwright Chromium.
 * Big SVGs with blur filters are expensive for mobile Safari to rasterise at load time and
 * can crash the tab, so maps ship as pre-rendered images instead.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

interface Page {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  setContent(html: string): Promise<void>;
  screenshot(o: { path: string; type: 'jpeg'; quality: number }): Promise<unknown>;
}
interface Browser {
  newPage(): Promise<Page>;
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

export interface RasterJob {
  svg: string;
  width: number;
  height: number;
  outPath: string;
}

/** Renders each SVG at its exact pixel size and saves it as a JPEG. */
export async function rasterizeToJpeg(jobs: RasterJob[], quality = 86): Promise<void> {
  if (jobs.length === 0) return;
  const browser = await loadPlaywright().chromium.launch();
  try {
    const page = await browser.newPage();
    for (const job of jobs) {
      await page.setViewportSize({ width: job.width, height: job.height });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;overflow:hidden">${job.svg}</body></html>`,
      );
      await page.screenshot({ path: job.outPath, type: 'jpeg', quality });
    }
  } finally {
    await browser.close();
  }
}
