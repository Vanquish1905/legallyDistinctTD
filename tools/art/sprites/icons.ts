/** UI icons (`icon-<name>`, 64x64): bold shaded glyphs with dark outline and soft shadow. */
import { darken, lighten } from '../lib/color';
import type { ArtAsset } from '../lib/asset';
import { OUTLINE, UI } from '../lib/palette';
import { gloss, starPts } from '../lib/shapes';
import { el, g, SvgDoc, type Attrs } from '../lib/svg';
import { coinGlyph } from '../towers/turretsB';

const S = 64;
const WHITE = '#eef3fb';

/** Filled shape with outline drawn underneath (paint-order) so the fill keeps its full size. */
function fillShape(doc: SvgDoc, tag: string, attrs: Attrs, color: string, w = 5): string {
  return el(tag, { ...attrs, fill: doc.shade(color, 0.3), stroke: OUTLINE, 'stroke-width': w, 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
}

/** Stroked line glyph (outline + colour pass). */
function line(d: string, color: string, w = 6): string {
  return (
    el('path', { d, fill: 'none', stroke: OUTLINE, 'stroke-width': w + 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) +
    el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  );
}

const tri = (x: number, y: number, w: number, h: number) => `M${x},${y - h / 2} L${x + w},${y} L${x},${y + h / 2} Z`;

function speed(doc: SvgDoc, n: number): string[] {
  const w = n === 1 ? 26 : n === 2 ? 18 : 14;
  const total = w * n;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(fillShape(doc, 'path', { d: tri(32 - total / 2 + i * w, 32, w + 2, 32) }, i === n - 1 ? UI.accent : WHITE));
  return out;
}

function medal(doc: SvgDoc, color: string): string[] {
  return [
    fillShape(doc, 'path', { d: 'M20,4 L30,4 L36,26 L26,26 Z' }, '#2563eb', 4),
    fillShape(doc, 'path', { d: 'M44,4 L34,4 L28,26 L38,26 Z' }, '#dc2626', 4),
    fillShape(doc, 'circle', { cx: 32, cy: 40, r: 18 }, color),
    el('circle', { cx: 32, cy: 40, r: 12, fill: 'none', stroke: darken(color, 0.35), 'stroke-width': 2 }),
    el('polygon', { points: starPts(32, 40, 8, 3.6, 5), fill: lighten(color, 0.45), stroke: darken(color, 0.45), 'stroke-width': 1.2 }),
    gloss(25, 32, 5, 2, 0.6),
  ];
}

function skull(doc: SvgDoc, color: string): string[] {
  return [
    fillShape(doc, 'path', { d: 'M32,8 C47,8 54,18 54,30 C54,38 50,42 46,44 L46,54 L18,54 L18,44 C14,42 10,38 10,30 C10,18 17,8 32,8 Z' }, color),
    el('ellipse', { cx: 23, cy: 32, rx: 6, ry: 7, fill: OUTLINE }),
    el('ellipse', { cx: 41, cy: 32, rx: 6, ry: 7, fill: OUTLINE }),
    el('path', { d: 'M32,38 L28,45 L36,45 Z', fill: OUTLINE }),
    ...[26, 32, 38].map((x) => el('line', { x1: x, y1: 47, x2: x, y2: 54, stroke: OUTLINE, 'stroke-width': 2.2 })),
  ];
}

const ICONS: Record<string, (doc: SvgDoc) => string[]> = {
  coin: (doc) => [
    el('circle', { cx: 32, cy: 35, r: 24, fill: '#b45309', stroke: OUTLINE, 'stroke-width': 3 }),
    fillShape(doc, 'circle', { cx: 32, cy: 31, r: 24 }, UI.gold),
    el('circle', { cx: 32, cy: 31, r: 17, fill: 'none', stroke: '#b45309', 'stroke-width': 2.5 }),
    coinGlyph(32, 31, 10),
    gloss(24, 20, 7, 3, 0.7),
  ],
  heart: (doc) => [fillShape(doc, 'path', { d: 'M32,54 C14,42 6,32 6,22 C6,13 13,8 20,8 C26,8 30,12 32,16 C34,12 38,8 44,8 C51,8 58,13 58,22 C58,32 50,42 32,54 Z' }, UI.danger), gloss(19, 18, 6, 3.5, 0.7, -30)],
  wave: (doc) => [
    fillShape(doc, 'path', { d: 'M6,40 C14,28 22,28 30,36 C38,44 46,44 58,30 L58,54 L6,54 Z' }, UI.accent),
    line('M8,24 C16,14 24,14 32,22 C40,30 48,30 56,18', lighten(UI.accent, 0.4), 5),
    el('circle', { cx: 44, cy: 12, r: 3, fill: WHITE, stroke: OUTLINE, 'stroke-width': 2 }),
  ],
  speed1: (doc) => speed(doc, 1),
  speed2: (doc) => speed(doc, 2),
  speed3: (doc) => speed(doc, 3),
  pause: (doc) => [fillShape(doc, 'rect', { x: 14, y: 10, width: 13, height: 44, rx: 4 }, WHITE), fillShape(doc, 'rect', { x: 37, y: 10, width: 13, height: 44, rx: 4 }, WHITE)],
  play: (doc) => [fillShape(doc, 'path', { d: 'M18,8 L54,32 L18,56 Z' }, UI.ok)],
  gear: (doc) => [fillShape(doc, 'polygon', { points: gearPts(32, 32, 26, 20, 8) }, '#a5b4cb'), el('circle', { cx: 32, cy: 32, r: 9, fill: '#1f2737', stroke: OUTLINE, 'stroke-width': 3 })],
  lock: (doc) => [line('M20,30 L20,22 C20,8 44,8 44,22 L44,30', '#94a3b8', 6), fillShape(doc, 'rect', { x: 12, y: 28, width: 40, height: 28, rx: 6 }, UI.gold), el('circle', { cx: 32, cy: 39, r: 4, fill: OUTLINE }), el('rect', { x: 30, y: 40, width: 4, height: 9, rx: 2, fill: OUTLINE })],
  star: (doc) => [fillShape(doc, 'polygon', { points: starPts(32, 34, 27, 12, 5) }, UI.gold), gloss(25, 24, 5, 2.5, 0.7)],
  'star-empty': () => [el('polygon', { points: starPts(32, 34, 27, 12, 5), fill: '#2a3347', stroke: OUTLINE, 'stroke-width': 5, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }), el('polygon', { points: starPts(32, 34, 21, 9, 5), fill: 'none', stroke: '#4b587a', 'stroke-width': 2, 'stroke-linejoin': 'round' })],
  'medal-bronze': (doc) => medal(doc, '#cd7f45'),
  'medal-silver': (doc) => medal(doc, '#cbd5e1'),
  'medal-gold': (doc) => medal(doc, UI.gold),
  sell: (doc) => [
    el('circle', { cx: 26, cy: 38, r: 18, fill: '#b45309', stroke: OUTLINE, 'stroke-width': 3 }),
    fillShape(doc, 'circle', { cx: 26, cy: 35, r: 18 }, UI.gold),
    coinGlyph(26, 35, 8),
    fillShape(doc, 'path', { d: 'M42,4 L54,4 L54,16 L62,16 L48,32 L34,16 L42,16 Z' }, UI.ok, 4),
  ],
  upgrade: (doc) => [fillShape(doc, 'path', { d: 'M32,6 L56,32 L42,32 L42,56 L22,56 L22,32 L8,32 Z' }, UI.ok), gloss(26, 20, 4, 2, 0.6, -45)],
  target: () => [
    line('M32,10 A22,22 0 1 1 31.9,10', UI.danger, 5),
    line('M32,4 L32,18 M32,46 L32,60 M4,32 L18,32 M46,32 L60,32', WHITE, 4),
    el('circle', { cx: 32, cy: 32, r: 4, fill: UI.danger, stroke: OUTLINE, 'stroke-width': 2 }),
  ],
  close: () => [line('M16,16 L48,48 M48,16 L16,48', WHITE, 8)],
  music: (doc) => [line('M24,46 L24,12 L50,6 L50,40', WHITE, 5), fillShape(doc, 'ellipse', { cx: 18, cy: 47, rx: 9, ry: 7 }, UI.accent, 4), fillShape(doc, 'ellipse', { cx: 44, cy: 41, rx: 9, ry: 7 }, UI.accent, 4)],
  sfx: (doc) => [fillShape(doc, 'path', { d: 'M8,24 L18,24 L32,10 L32,54 L18,40 L8,40 Z' }, WHITE), line('M40,22 Q46,32 40,42', UI.accent, 4), line('M47,15 Q57,32 47,49', UI.accent, 4)],
  skull: (doc) => skull(doc, WHITE),
  boss: (doc) => [
    fillShape(doc, 'path', { d: 'M12,22 L4,4 L22,14 Z' }, '#f5e6c8', 4),
    fillShape(doc, 'path', { d: 'M52,22 L60,4 L42,14 Z' }, '#f5e6c8', 4),
    ...skull(doc, UI.danger),
  ],
  info: (doc) => [fillShape(doc, 'circle', { cx: 32, cy: 32, r: 26 }, UI.accent), el('circle', { cx: 32, cy: 19, r: 4.5, fill: WHITE }), el('rect', { x: 27.5, y: 27, width: 9, height: 22, rx: 3, fill: WHITE })],
  check: () => [line('M12,34 L26,48 L52,16', UI.ok, 9)],
  next: (doc) => [fillShape(doc, 'path', { d: 'M8,12 L30,32 L8,52 Z' }, WHITE), fillShape(doc, 'path', { d: 'M30,12 L52,32 L30,52 Z' }, UI.accent), fillShape(doc, 'rect', { x: 52, y: 12, width: 7, height: 40, rx: 2 }, UI.accent, 4)],
  home: (doc) => [fillShape(doc, 'path', { d: 'M32,6 L60,30 L52,30 L52,56 L12,56 L12,30 L4,30 Z' }, WHITE), el('rect', { x: 26, y: 38, width: 12, height: 18, rx: 2, fill: UI.accent, stroke: OUTLINE, 'stroke-width': 2.5 })],
  restart: (doc) => [line('M50,32 A18,18 0 1 1 42,17', WHITE, 7), fillShape(doc, 'path', { d: 'M36,4 L54,14 L38,26 Z' }, WHITE, 4)],
  dice: (doc) => [
    fillShape(doc, 'rect', { x: 8, y: 8, width: 48, height: 48, rx: 10 }, WHITE),
    ...[[20, 20], [44, 20], [32, 32], [20, 44], [44, 44]].map(([x, y]) => el('circle', { cx: x, cy: y, r: 5, fill: UI.danger, stroke: OUTLINE, 'stroke-width': 1.5 })),
    gloss(20, 14, 9, 2.5, 0.5, 0),
  ],
};

function gearPts(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? outer : inner;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return pts.join(' ');
}

/** Icon textures in the pinned order. */
export function iconAssets(): ArtAsset[] {
  return Object.entries(ICONS).map(([name, draw]) => {
    const key = `icon-${name}`;
    return {
      key,
      dir: 'icons',
      width: S,
      height: S,
      render: () => {
        const doc = new SvgDoc(S, S, key);
        return doc.render(g({ filter: doc.shadow(0, 2, 1.5, 0.45) }, draw(doc)));
      },
    };
  });
}
