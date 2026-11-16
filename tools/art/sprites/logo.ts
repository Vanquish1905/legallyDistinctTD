/** Title wordmark built from a stroke font (no font files needed when Phaser rasterises it). */
import type { ArtAsset } from '../lib/asset';
import { OUTLINE } from '../lib/palette';
import { starPts } from '../lib/shapes';
import { el, g, SvgDoc, type Stop } from '../lib/svg';

interface Glyph {
  w: number;
  d: string;
}

/** Uppercase stroke glyphs on a 14-unit cap height. */
const GLYPHS: Record<string, Glyph> = {
  L: { w: 8, d: 'M0,0 L0,14 L8,14' },
  E: { w: 9, d: 'M9,0 L0,0 L0,14 L9,14 M0,7 L7,7' },
  G: { w: 11, d: 'M11,3 C9.5,0.8 7.5,0 6,0 C2.5,0 0,3 0,7 C0,11 2.5,14 6,14 C9,14 11,12 11,9 L11,8 L6.5,8' },
  A: { w: 11, d: 'M0,14 L5.5,0 L11,14 M2.4,8.5 L8.6,8.5' },
  Y: { w: 10, d: 'M0,0 L5,7 L10,0 M5,7 L5,14' },
  D: { w: 11, d: 'M0,0 L0,14 L4,14 C9,14 11,11 11,7 C11,3 9,0 4,0 Z' },
  I: { w: 0, d: 'M0,0 L0,14' },
  S: { w: 10, d: 'M10,2.5 C8.5,0.6 7,0 5,0 C2,0 0.4,1.6 0.4,4 C0.4,6.8 3.5,7.2 5.5,7.6 C8,8.1 10,9 10,11 C10,13 8,14 5,14 C3,14 1.2,13.2 0,11.5' },
  T: { w: 10, d: 'M0,0 L10,0 M5,0 L5,14' },
  N: { w: 10, d: 'M0,14 L0,0 L10,14 L10,0' },
  C: { w: 11, d: 'M11,3 C9.5,0.8 7.5,0 6,0 C2.5,0 0,3 0,7 C0,11 2.5,14 6,14 C7.5,14 9.5,13.2 11,11' },
};

const GAP = 4.6;

function wordWidth(word: string): number {
  let w = 0;
  for (const ch of word) w += (GLYPHS[ch]?.w ?? 0) + GAP;
  return w - GAP;
}

/** One word as glyph paths in unit space, starting at x = 0. */
function wordPaths(word: string, attrs: Record<string, string | number>): string {
  let x = 0;
  const out: string[] = [];
  for (const ch of word) {
    const gl = GLYPHS[ch];
    if (!gl) throw new Error(`logo glyph ${ch} missing`);
    out.push(el('path', { d: gl.d, transform: `translate(${x} 0)`, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }));
    x += gl.w + GAP;
  }
  return out.join('');
}

/** Chunky 3/4 lettering: shadow, extruded side, outline, gradient face and shine. */
function lettering(doc: SvgDoc, word: string, cx: number, top: number, k: number, face: Stop[], side: string): string {
  const w = wordWidth(word);
  const sw = 3.4;
  const layer = (dy: number, attrs: Record<string, string | number>) => g({ transform: `translate(${cx - (w * k) / 2} ${top + dy}) scale(${k})` }, wordPaths(word, attrs));
  const paint = doc.linearUser(face, 0, -1.5, 0, 15.5);
  return [
    g({ filter: doc.blur(6), opacity: 0.55 }, layer(14, { stroke: '#000000', 'stroke-width': sw + 2.6 })),
    layer(9, { stroke: OUTLINE, 'stroke-width': sw + 2.2 }),
    layer(6, { stroke: side, 'stroke-width': sw + 0.4 }),
    layer(0, { stroke: OUTLINE, 'stroke-width': sw + 2.2 }),
    layer(0, { stroke: paint, 'stroke-width': sw }),
    layer(-0.25 * k, { stroke: '#ffffff', 'stroke-width': 0.7, opacity: 0.55 }),
  ].join('');
}

/** Builds the logo SVG (1024x420). */
function renderLogo(doc: SvgDoc): string[] {
  const cyan: Stop[] = [[0, '#e0f7ff'], [0.45, '#38bdf8'], [1, '#1d6fd1']];
  const gold: Stop[] = [[0, '#fff3c4'], [0.45, '#fbbf24'], [1, '#d9730d']];
  const out: string[] = [];
  out.push(el('ellipse', { cx: 512, cy: 220, rx: 470, ry: 170, fill: '#38bdf8', opacity: 0.16, filter: doc.blur(40) }));
  out.push(lettering(doc, 'LEGALLY', 512, 40, 9, cyan, '#134e8a'));
  out.push(lettering(doc, 'DISTINCT', 512, 200, 9, gold, '#8a4a0b'));
  // "TD" badge: tilted red ribbon with white lettering
  const bx = 896;
  const by = 356;
  out.push(
    g({ transform: `rotate(-8 ${bx} ${by})` }, [
      el('path', { d: `M${bx - 92},${by - 40} L${bx + 92},${by - 40} L${bx + 76},${by} L${bx + 92},${by + 40} L${bx - 92},${by + 40} L${bx - 76},${by} Z`, fill: '#000000', opacity: 0.4, transform: 'translate(4 10)', filter: doc.blur(5) }),
      el('path', { d: `M${bx - 92},${by - 40} L${bx + 92},${by - 40} L${bx + 76},${by} L${bx + 92},${by + 40} L${bx - 92},${by + 40} L${bx - 76},${by} Z`, fill: doc.shade('#f43f5e', 0.3), stroke: OUTLINE, 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      g({ transform: `translate(${bx - 52} ${by - 28}) scale(4)` }, [wordPaths('TD', { stroke: OUTLINE, 'stroke-width': 5.2 }), wordPaths('TD', { stroke: '#ffffff', 'stroke-width': 3.2 })]),
    ]),
  );
  for (const [x, y, r] of [[96, 70, 16], [940, 60, 12], [120, 330, 10]] as const) {
    out.push(el('polygon', { points: starPts(x, y, r, r * 0.4, 4, 0), fill: '#ffffff', opacity: 0.85 }));
  }
  return out;
}

/** The `logo` texture. */
export function logoAssets(): ArtAsset[] {
  return [
    {
      key: 'logo',
      dir: 'ui',
      width: 1024,
      height: 420,
      render: () => {
        const doc = new SvgDoc(1024, 420, 'logo');
        return doc.render(renderLogo(doc));
      },
    },
  ];
}
