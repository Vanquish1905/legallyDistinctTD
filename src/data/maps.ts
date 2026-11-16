import type { MapDef, Vec2 } from '../sim/types';

/** Pinned map ids, in menu order (index 0 = tutorial). */
export type MapId =
  | 'tutorial' | 'green-valley' | 'dune-canyon' | 'frostbite-lake' | 'magma-works'
  | 'bogwater' | 'bio-lab' | 'crystal-hollow' | 'neon-district';

/** A map definition whose id is one of the pinned map ids. */
export interface GameMapDef extends MapDef { id: MapId }

/** Compact waypoint notation: [[x, y], ...] → Vec2[]. */
function pts(list: readonly (readonly [number, number])[]): Vec2[] {
  return list.map(([x, y]) => ({ x, y }));
}

/**
 * The tutorial's gentle S-curve: one full sine period across the field, sampled every ~86 px
 * between x = 80 and x = 1460, entering off-screen on the left and leaving on the right.
 */
function sCurve(): Vec2[] {
  const at = (x: number): Vec2 => ({ x, y: Math.round(580 - 220 * Math.sin((2 * Math.PI * x) / 1540)) });
  const out: Vec2[] = [at(-60)];
  const steps = 16;
  for (let i = 0; i <= steps; i++) out.push(at(Math.round(80 + (1380 * i) / steps)));
  out.push(at(1600));
  return out;
}

/*
 * Legacy maps (world 1880×1030, map area 1620 wide) are scaled by x·1540/1620 and y·1080/1030,
 * then nudged so the path band clears the top bar and the field edges, and both ends sit off-screen.
 */
const TUTORIAL: GameMapDef = {
  id: 'tutorial', name: 'Tutorial Meadow', theme: 'meadow', difficulty: 1,
  description: 'A lazy, winding brook of a trail where new engineers learn which end of a turret points at the bugs.',
  paths: [sCurve()],
  pathWidth: 72, decorSeed: 1101, background: 'map-tutorial',
};

/** Legacy GameMap1. */
const GREEN_VALLEY: GameMapDef = {
  id: 'green-valley', name: 'Green Valley', theme: 'meadow', difficulty: 1,
  description: 'The original pasture: two lazy steps down the hill, with plenty of grass for your machines.',
  paths: [pts([[-60, 244], [715, 244], [715, 557], [1344, 557], [1344, 1140]])],
  pathWidth: 72, decorSeed: 2203, background: 'map-green-valley',
};

/** Legacy GameMap2. */
const DUNE_CANYON: GameMapDef = {
  id: 'dune-canyon', name: 'Dune Canyon', theme: 'desert', difficulty: 2,
  description: 'Parasites tumble down from the northern ridge and zig-zag across a sun-baked canyon floor.',
  paths: [pts([[1334, -60], [1334, 404], [206, 404], [206, 908], [1600, 908]])],
  pathWidth: 72, decorSeed: 3307, background: 'map-dune-canyon',
};

const FROSTBITE_LAKE: GameMapDef = {
  id: 'frostbite-lake', name: 'Frostbite Lake', theme: 'snow', difficulty: 2,
  description: 'A switchback trail across a frozen lake, where thin ice and fishing holes leave little room to build.',
  paths: [pts([[-60, 860], [380, 860], [380, 240], [820, 240], [820, 700], [1200, 700], [1200, 300], [1600, 300]])],
  pathWidth: 72, decorSeed: 4409,
  blockers: [
    { x: 600, y: 500, r: 72 },
    { x: 1010, y: 480, r: 58 },
    { x: 160, y: 470, r: 66 },
    { x: 1400, y: 880, r: 70 },
    { x: 1000, y: 950, r: 54 },
  ],
  background: 'map-frostbite-lake',
};

/** Legacy GameMap6, with an extra loop through the foundry. */
const MAGMA_WORKS: GameMapDef = {
  id: 'magma-works', name: 'Magma Works', theme: 'volcano', difficulty: 3,
  description: 'An abandoned foundry where the conveyor road loops between bubbling lava pools.',
  paths: [pts([[180, -60], [180, 840], [620, 840], [620, 380], [1080, 380], [1080, 840], [1600, 840]])],
  pathWidth: 72, decorSeed: 5501,
  blockers: [
    { x: 400, y: 520, r: 80 },
    { x: 850, y: 620, r: 84 },
    { x: 1320, y: 560, r: 78 },
    { x: 850, y: 170, r: 56 },
  ],
  background: 'map-magma-works',
};

const BOGWATER: GameMapDef = {
  id: 'bogwater', name: 'Bogwater', theme: 'swamp', difficulty: 3,
  description: 'Two muddy trails squeeze past each other in the middle of the marsh before splitting toward the exit.',
  paths: [
    pts([[-60, 200], [640, 200], [640, 480], [1100, 480], [1100, 170], [1600, 170]]),
    pts([[-60, 880], [640, 880], [640, 620], [1100, 620], [1100, 920], [1600, 920]]),
  ],
  pathWidth: 72, decorSeed: 6607,
  blockers: [
    { x: 320, y: 540, r: 92 },
    { x: 1340, y: 545, r: 84 },
    { x: 870, y: 330, r: 48 },
    { x: 870, y: 750, r: 48 },
  ],
  background: 'map-bogwater',
};

/** Legacy GameMap7, plus a second corridor that cuts across it three times. */
const BIO_LAB: GameMapDef = {
  id: 'bio-lab', name: 'Bio-Lab 7', theme: 'lab', difficulty: 4,
  description: 'Containment has failed: two ventilation corridors cross the lab floor and the specimens use both.',
  paths: [
    pts([[1327, -60], [1327, 402], [160, 402], [160, 935], [1600, 935]]),
    pts([[-60, 640], [560, 640], [560, 190], [940, 190], [940, 760], [1600, 760]]),
  ],
  pathWidth: 72, decorSeed: 7703, background: 'map-bio-lab',
};

/** Legacy GameMap8, with a second tunnel joining it inside the loop. */
const CRYSTAL_HOLLOW: GameMapDef = {
  id: 'crystal-hollow', name: 'Crystal Hollow', theme: 'crystal', difficulty: 4,
  description: 'Two glittering tunnels merge into one deep shaft, so every parasite in the cave funnels past the same spot.',
  paths: [
    pts([[-60, 178], [1389, 178], [1389, 722], [197, 722], [197, 1140]]),
    pts([[-60, 450], [1100, 450], [1100, 722], [197, 722], [197, 1140]]),
  ],
  pathWidth: 72, decorSeed: 8809, background: 'map-crystal-hollow',
};

const NEON_DISTRICT: GameMapDef = {
  id: 'neon-district', name: 'Neon District', theme: 'city', difficulty: 5,
  description: 'Three lanes of night-time traffic carry the swarm through a narrow, glowing downtown.',
  paths: [
    pts([[-60, 170], [460, 170], [460, 380], [1000, 380], [1000, 170], [1600, 170]]),
    pts([[-60, 560], [1600, 560]]),
    pts([[300, 1140], [300, 900], [760, 900], [760, 720], [1240, 720], [1240, 940], [1600, 940]]),
  ],
  pathWidth: 64, decorSeed: 9901, background: 'map-neon-district',
};

/** All maps in menu order; index 0 is the tutorial. */
export const MAPS: GameMapDef[] = [
  TUTORIAL, GREEN_VALLEY, DUNE_CANYON, FROSTBITE_LAKE, MAGMA_WORKS,
  BOGWATER, BIO_LAB, CRYSTAL_HOLLOW, NEON_DISTRICT,
];

/** Map ids in menu order. */
export const MAP_ORDER: MapId[] = MAPS.map((m) => m.id);

/** Look up a map by id; undefined for unknown ids. */
export function getMap(id: string): GameMapDef | undefined {
  return MAPS.find((m) => m.id === id);
}
