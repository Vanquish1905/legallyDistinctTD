/** Hard-coded sample maps (one per theme) for visual QA in the contact sheet only. */
import type { MapArtInput } from './types';

const P = (...xy: number[]) => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: xy[i] as number, y: xy[i + 1] as number });
  return out;
};

export const SAMPLE_MAPS: MapArtInput[] = [
  { id: 'sample-meadow', theme: 'meadow', pathWidth: 64, decorSeed: 11, paths: [P(-60, 220, 420, 220, 420, 760, 980, 760, 980, 320, 1600, 320)], blockers: [{ x: 1250, y: 760, r: 90 }] },
  { id: 'sample-desert', theme: 'desert', pathWidth: 64, decorSeed: 23, paths: [P(-60, 900, 300, 900, 300, 200, 760, 200, 760, 860, 1200, 860, 1200, -60)] },
  { id: 'sample-snow', theme: 'snow', pathWidth: 64, decorSeed: 37, paths: [P(770, -60, 770, 260, 260, 260, 260, 820, 1300, 820, 1300, 1140)], blockers: [{ x: 620, y: 560, r: 110 }, { x: 1180, y: 400, r: 80 }] },
  { id: 'sample-volcano', theme: 'volcano', pathWidth: 64, decorSeed: 41, paths: [P(-60, 540, 340, 540, 340, 160, 1120, 160, 1120, 900, 600, 900, 600, 1140)], blockers: [{ x: 760, y: 560, r: 120 }] },
  { id: 'sample-swamp', theme: 'swamp', pathWidth: 64, decorSeed: 53, paths: [P(-60, 260, 560, 260, 860, 540, 1600, 540), P(-60, 860, 560, 860, 860, 540)], blockers: [{ x: 1200, y: 240, r: 100 }] },
  { id: 'sample-lab', theme: 'lab', pathWidth: 64, decorSeed: 67, paths: [P(-60, 300, 1600, 300), P(500, -60, 500, 1140), P(-60, 820, 1100, 820, 1100, -60)], blockers: [{ x: 1320, y: 700, r: 80 }] },
  { id: 'sample-crystal', theme: 'crystal', pathWidth: 64, decorSeed: 71, paths: [P(-60, 200, 600, 200, 900, 540, 1600, 540), P(-60, 900, 600, 900, 900, 540)], blockers: [{ x: 1250, y: 860, r: 95 }] },
  { id: 'sample-city', theme: 'city', pathWidth: 64, decorSeed: 83, paths: [P(-60, 180, 1600, 180), P(-60, 540, 700, 540, 700, 900, 1600, 900), P(1100, -60, 1100, 1140)], blockers: [{ x: 360, y: 860, r: 85 }] },
];
