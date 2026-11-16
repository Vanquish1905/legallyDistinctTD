/** Effect sprites (`fx-<kind>`), meant to be scaled/faded/tinted by the renderer. */
import type { ArtAsset } from '../lib/asset';
import { OUTLINE, UI } from '../lib/palette';
import { Rng } from '../lib/rng';
import { blob, gloss, starPts } from '../lib/shapes';
import { el, g, SvgDoc } from '../lib/svg';
import { snowflake } from '../towers/turretsA';
import { coinGlyph } from '../towers/turretsB';

interface FxArt {
  kind: string;
  size: number;
  draw(doc: SvgDoc, r: number): string[];
}

function puffs(doc: SvgDoc, rng: Rng, n: number, r: number, color: string, opacity: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const d = r * rng.range(0.3, 0.55);
    out.push(el('circle', { cx: Math.cos(a) * d, cy: Math.sin(a) * d, r: r * rng.range(0.32, 0.45), fill: doc.sphere(color, 0.35), opacity }));
  }
  return out.join('');
}

const FX: FxArt[] = [
  {
    kind: 'explosion', size: 128,
    draw: (doc, r) => {
      const rng = new Rng(3);
      return [
        el('circle', { cx: 0, cy: 0, r: r * 0.95, fill: '#f97316', opacity: 0.35, filter: doc.blur(6) }),
        puffs(doc, rng, 7, r * 0.95, '#6b7280', 0.75),
        el('polygon', { points: starPts(0, 0, r * 0.85, r * 0.5, 9, 0.2), fill: doc.radial([[0, '#fff7c2'], [0.5, '#fb923c'], [1, '#dc2626']]), stroke: '#7c2d12', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
        el('polygon', { points: starPts(0, 0, r * 0.55, r * 0.32, 7, 0.6), fill: doc.radial([[0, '#ffffff'], [0.6, '#fde047'], [1, '#fb923c']]) }),
        el('circle', { cx: 0, cy: 0, r: r * 0.2, fill: '#ffffff', opacity: 0.9 }),
      ];
    },
  },
  {
    kind: 'frost-burst', size: 128,
    draw: (doc, r) => {
      const out = [el('circle', { cx: 0, cy: 0, r: r * 0.9, fill: doc.radial([[0, '#e0f2fe', 0.1], [0.7, '#7dd3fc', 0.35], [1, '#38bdf8', 0]]) })];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = Math.cos(a) * r * 0.62;
        const y = Math.sin(a) * r * 0.62;
        out.push(g({ transform: `rotate(${(a * 180) / Math.PI} ${x} ${y})` }, el('polygon', { points: `${x - 12},${y - 5} ${x + 14},${y} ${x - 12},${y + 5}`, fill: doc.shade('#e0f2fe', 0.3), stroke: '#0c4a6e', 'stroke-width': 1.8, 'stroke-linejoin': 'round' })));
      }
      out.push(snowflake(0, 0, r * 0.3, '#f0f9ff'));
      return out;
    },
  },
  {
    kind: 'poison-cloud', size: 128,
    draw: (doc, r) => {
      const rng = new Rng(11);
      return [
        el('circle', { cx: 0, cy: 0, r: r * 0.9, fill: '#84cc16', opacity: 0.25, filter: doc.blur(8) }),
        g({ filter: doc.blur(1.5) }, puffs(doc, rng, 8, r * 0.9, '#a3e635', 0.55)),
        ...[0, 1, 2, 3, 4].map(() => el('circle', { cx: rng.range(-r, r) * 0.5, cy: rng.range(-r, r) * 0.5, r: rng.range(2, 4), fill: '#ecfccb', opacity: 0.85 })),
      ];
    },
  },
  {
    kind: 'spark', size: 64,
    draw: (doc, r) => [
      el('circle', { cx: 0, cy: 0, r: r * 0.6, fill: '#e0f2fe', opacity: 0.6, filter: doc.blur(4) }),
      el('polygon', { points: starPts(0, 0, r * 0.9, r * 0.14, 4, 0), fill: '#ffffff' }),
      el('polygon', { points: starPts(0, 0, r * 0.5, r * 0.12, 4, Math.PI / 4), fill: '#bae6fd' }),
    ],
  },
  {
    kind: 'splat', size: 96,
    draw: (doc, r) => {
      const rng = new Rng(21);
      const out = [el('path', { d: blob(rng, 0, 0, r * 0.55, 0.3, 12), fill: doc.sphere('#9bd35a', 0.35), stroke: OUTLINE, 'stroke-width': 2.5 })];
      for (let i = 0; i < 7; i++) {
        const a = rng.range(0, Math.PI * 2);
        const d = r * rng.range(0.62, 0.85);
        out.push(el('circle', { cx: Math.cos(a) * d, cy: Math.sin(a) * d, r: rng.range(3, 7), fill: '#9bd35a', stroke: OUTLINE, 'stroke-width': 2 }));
      }
      out.push(gloss(-r * 0.15, -r * 0.2, r * 0.18, r * 0.07, 0.6));
      return out;
    },
  },
  {
    kind: 'coin', size: 48,
    draw: (doc, r) => [
      el('circle', { cx: 0, cy: 2, r: r * 0.82, fill: '#b45309', stroke: OUTLINE, 'stroke-width': 2.5 }),
      el('circle', { cx: 0, cy: 0, r: r * 0.82, fill: doc.sphere(UI.gold, 0.45), stroke: OUTLINE, 'stroke-width': 2.5 }),
      el('circle', { cx: 0, cy: 0, r: r * 0.58, fill: 'none', stroke: '#b45309', 'stroke-width': 1.8 }),
      coinGlyph(0, 0, r * 0.38),
      gloss(-r * 0.25, -r * 0.4, r * 0.28, r * 0.1, 0.8),
    ],
  },
  {
    kind: 'ring', size: 128,
    draw: (doc, r) => [
      el('circle', { cx: 0, cy: 0, r: r * 0.86, fill: 'none', stroke: '#ffffff', 'stroke-width': 8, opacity: 0.45, filter: doc.blur(3) }),
      el('circle', { cx: 0, cy: 0, r: r * 0.86, fill: 'none', stroke: '#ffffff', 'stroke-width': 3 }),
    ],
  },
  {
    kind: 'smoke', size: 96,
    draw: (doc, r) => [g({ filter: doc.blur(2) }, puffs(doc, new Rng(17), 6, r * 0.9, '#cbd5e1', 0.7))],
  },
  {
    kind: 'shield', size: 128,
    draw: (doc, r) => [
      el('circle', { cx: 0, cy: 0, r: r * 0.88, fill: doc.radial([[0, '#38bdf8', 0], [0.75, '#38bdf8', 0.12], [1, '#7dd3fc', 0.55]]), stroke: '#bae6fd', 'stroke-width': 2.5, 'stroke-opacity': 0.9 }),
      el('path', { d: `M${-r * 0.55},${-r * 0.45} A${r * 0.75},${r * 0.75} 0 0 1 ${r * 0.3},${-r * 0.7}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.7 }),
    ],
  },
  {
    kind: 'heal', size: 64,
    draw: (doc, r) => [
      el('circle', { cx: 0, cy: 0, r: r * 0.7, fill: '#34d399', opacity: 0.35, filter: doc.blur(4) }),
      el('path', { d: 'M-6,-18 h12 v12 h12 v12 h-12 v12 h-12 v-12 h-12 v-12 h12 Z', fill: doc.shade('#4ade80', 0.35), stroke: OUTLINE, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
      gloss(-4, -12, 3, 1.5, 0.7, 0),
    ],
  },
];

/** Effect textures (`fx-<kind>`). */
export function effectAssets(): ArtAsset[] {
  return FX.map((f) => {
    const key = `fx-${f.kind}`;
    return {
      key,
      dir: 'fx',
      width: f.size,
      height: f.size,
      render: () => {
        const doc = new SvgDoc(f.size, f.size, key);
        return doc.render(g({ transform: `translate(${f.size / 2} ${f.size / 2})` }, f.draw(doc, f.size / 2 - 4)));
      },
    };
  });
}
