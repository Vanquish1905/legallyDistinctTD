/** Tower texture list: base, turret and max-tier turret for each of the 18 machines. */
import type { ArtAsset } from '../lib/asset';
import { CATEGORY_COLOR, type Category } from '../lib/palette';
import { SvgDoc } from '../lib/svg';
import { coinfactoryBase, heliBase, mortarBase, pulseBase, radarBase, spikesBase, teslaBase, type BaseFn } from './bases';
import { housing, SIZE, turretGroup, type BaseShape } from './kit';
import * as A from './turretsA';
import * as B from './turretsB';

interface TowerArt {
  id: string;
  category: Category;
  base: BaseFn;
  turret: A.TurretFn;
}

const std = (shape: BaseShape, category: Category, plate?: string): BaseFn => (doc) => housing(doc, shape, CATEGORY_COLOR[category], plate);

/** Art definitions in TOWER_ORDER. */
export const TOWER_ART: TowerArt[] = [
  { id: 'blaster', category: 'basic', base: std('oct', 'basic'), turret: A.blaster },
  { id: 'gatling', category: 'basic', base: std('square', 'basic'), turret: A.gatling },
  { id: 'sniper', category: 'basic', base: std('hex', 'basic', '#5f6e5a'), turret: A.sniper },
  { id: 'frost', category: 'magic', base: std('round', 'magic', '#6a8db3'), turret: A.frost },
  { id: 'flamethrower', category: 'heavy', base: std('oct', 'heavy', '#6e5f5a'), turret: A.flamethrower },
  { id: 'rocket', category: 'heavy', base: std('square', 'heavy', '#5f6b55'), turret: A.rocket },
  { id: 'seeker', category: 'heavy', base: std('hex', 'heavy', '#675a74'), turret: A.seeker },
  { id: 'spikes', category: 'basic', base: spikesBase, turret: A.spikes },
  { id: 'heli', category: 'heavy', base: heliBase, turret: A.heli },
  { id: 'tesla', category: 'magic', base: teslaBase, turret: B.tesla },
  { id: 'laser', category: 'magic', base: std('hex', 'magic', '#5a5577'), turret: B.laser },
  { id: 'mortar', category: 'heavy', base: mortarBase, turret: B.mortar },
  { id: 'toxin', category: 'magic', base: std('oct', 'magic', '#55684a'), turret: B.toxin },
  { id: 'saw', category: 'basic', base: std('oct', 'basic', '#6d6560'), turret: B.saw },
  { id: 'pulse', category: 'magic', base: pulseBase, turret: B.pulse },
  { id: 'railgun', category: 'heavy', base: std('hex', 'heavy', '#4a5670'), turret: B.railgun },
  { id: 'radar', category: 'support', base: radarBase, turret: B.radar },
  { id: 'coinfactory', category: 'support', base: coinfactoryBase, turret: B.coinfactory },
];

function turretAsset(t: TowerArt, t3: boolean): ArtAsset {
  const key = `tower-${t.id}-turret${t3 ? '-t3' : ''}`;
  return {
    key,
    dir: 'towers',
    width: SIZE,
    height: SIZE,
    render: () => {
      const doc = new SvgDoc(SIZE, SIZE, key);
      return doc.render(turretGroup(doc, t.turret(doc, { t3 }), t.id === 'heli' ? 1 : 1.12));
    },
  };
}

/** All tower textures (base and turret share the canvas centre). */
export function towerAssets(): ArtAsset[] {
  const out: ArtAsset[] = [];
  for (const t of TOWER_ART) {
    const key = `tower-${t.id}-base`;
    out.push({
      key,
      dir: 'towers',
      width: SIZE,
      height: SIZE,
      render: () => {
        const doc = new SvgDoc(SIZE, SIZE, key);
        return doc.render(t.base(doc));
      },
    });
    out.push(turretAsset(t, false), turretAsset(t, true));
  }
  out.push({
    key: 'tower-heli-rotor',
    dir: 'towers',
    width: SIZE,
    height: SIZE,
    render: () => {
      const doc = new SvgDoc(SIZE, SIZE, 'tower-heli-rotor');
      return doc.render(turretGroup(doc, A.heliRotor(doc), 1));
    },
  });
  return out;
}
