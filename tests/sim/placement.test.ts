import { describe, expect, it } from 'vitest';
import { PATH_Y, makeSim, stubTower } from './helpers';

function sim() {
  return makeSim({ towers: { gun: stubTower(), spikes: stubTower({ id: 'spikes', placement: 'path', footprint: 20 }) } });
}

describe('placement', () => {
  it('accepts open ground', () => {
    expect(sim().canPlace('gun', 600, 300)).toEqual({ ok: true });
  });

  it('keeps ground towers off the path band (pathWidth/2 + footprint)', () => {
    const s = sim();
    // band = 32 + 30 = 62 from the centre line
    expect(s.canPlace('gun', 600, PATH_Y - 61).ok).toBe(false);
    expect(s.canPlace('gun', 600, PATH_Y - 62).ok).toBe(true);
    expect(s.canPlace('gun', 600, PATH_Y).reason).toBe('Too close to the path');
  });

  it('requires path towers to sit on the path', () => {
    const s = sim();
    expect(s.canPlace('spikes', 600, PATH_Y + 10).ok).toBe(true);
    expect(s.canPlace('spikes', 600, PATH_Y + 32).ok).toBe(true);
    expect(s.canPlace('spikes', 600, PATH_Y + 40).reason).toBe('Must be placed on the path');
  });

  it('keeps footprints inside the field and below the top bar', () => {
    const s = sim();
    expect(s.canPlace('gun', 20, 300).reason).toBe('Outside the field');
    expect(s.canPlace('gun', 1520, 300).reason).toBe('Outside the field');
    expect(s.canPlace('gun', 600, 1070).reason).toBe('Outside the field');
    expect(s.canPlace('gun', 600, 90).reason).toBe('Under the top bar');
    expect(s.canPlace('gun', 600, 102).ok).toBe(true);
  });

  it('rejects blockers and overlapping towers', () => {
    const s = sim();
    expect(s.canPlace('gun', 330, 320).reason).toBe('Blocked by terrain');
    expect(s.placeTower('gun', 600, 300)).not.toBeNull();
    expect(s.canPlace('gun', 650, 300).reason).toBe('Overlaps another tower');
    expect(s.canPlace('gun', 660, 300).ok).toBe(true);
    expect(s.placeTower('spikes', 600, PATH_Y)).not.toBeNull();
    expect(s.canPlace('spikes', 630, PATH_Y).reason).toBe('Overlaps another tower');
  });

  it('rejects unknown towers and unaffordable ones', () => {
    const s = makeSim({ towers: { gun: stubTower({ cost: 5000 }) } });
    expect(s.canPlace('nope', 600, 300).reason).toBe('Unknown tower');
    expect(s.canPlace('gun', 600, 300).reason).toBe('Not enough money');
    expect(s.placeTower('gun', 600, 300)).toBeNull();
    expect(s.money).toBe(1000);
  });
});
