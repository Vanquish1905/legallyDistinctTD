import { describe, expect, it } from 'vitest';
import {
  bossPhaseMarkers, cardState, enemyHint, formatCompact, formatNumber, hotkeyLabel, keyStats, previewChips,
  specialStats, towersInCategory, upgradeButtonState, usesTargetMode, waveLabel,
} from '../../src/ui/hud/hudModel';
import { TOWER_ORDER, TOWERS } from '../../src/data/towers';
import { ENEMIES } from '../../src/data/enemies';
import { towerStatsAt } from '../../src/sim/upgrades';

describe('tower list', () => {
  it('filters by category in shop order', () => {
    expect(towersInCategory('all')).toEqual([...TOWER_ORDER]);
    expect(towersInCategory('support')).toEqual(['radar', 'coinfactory']);
    expect(towersInCategory('basic')).toEqual(['blaster', 'gatling', 'sniper', 'spikes', 'saw']);
    const total = (['basic', 'magic', 'heavy', 'support'] as const).reduce((n, c) => n + towersInCategory(c).length, 0);
    expect(total).toBe(TOWER_ORDER.length);
  });

  it('gives the first ten towers hotkeys 1-9, 0', () => {
    expect(hotkeyLabel('blaster')).toBe('1');
    expect(hotkeyLabel('heli')).toBe('9');
    expect(hotkeyLabel('tesla')).toBe('0');
    expect(hotkeyLabel('laser')).toBeNull();
    expect(hotkeyLabel('nope')).toBeNull();
  });

  it('derives card state from money and unlocks', () => {
    expect(cardState(200, 200, undefined, 0)).toBe('ok');
    expect(cardState(201, 200, undefined, 0)).toBe('expensive');
    expect(cardState(100, 999, 5, 4)).toBe('locked');
    expect(cardState(100, 999, 5, 5)).toBe('ok');
  });
});

describe('upgrade buttons', () => {
  it('maps sim checks to button states', () => {
    expect(upgradeButtonState({ ok: true, cost: 80 })).toEqual({ state: 'buy', cost: 80 });
    expect(upgradeButtonState({ ok: false, reason: 'money', cost: 600 })).toEqual({ state: 'money', cost: 600 });
    expect(upgradeButtonState({ ok: false, reason: 'locked', cost: null })).toEqual({ state: 'locked', cost: null });
    expect(upgradeButtonState({ ok: false, reason: 'maxed', cost: null })).toEqual({ state: 'maxed', cost: null });
    expect(upgradeButtonState(null).state).toBe('maxed');
  });
});

describe('formatting', () => {
  it('formats numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(-1500)).toBe('-1,500');
    expect(formatCompact(9999)).toBe('9,999');
    expect(formatCompact(12500)).toBe('12.5k');
    expect(formatCompact(40000)).toBe('40k');
    expect(formatCompact(2_300_000)).toBe('2.3M');
  });

  it('labels waves', () => {
    expect(waveLabel(3, 40, false)).toBe('Wave 3 / 40');
    expect(waveLabel(45, 40, true)).toBe('Wave 45');
  });
});

describe('stats', () => {
  it('shows damage, rate, range and a special for every tower', () => {
    for (const id of TOWER_ORDER) {
      const def = TOWERS[id];
      const lines = keyStats(def, def.stats);
      expect(lines.map((l) => l.label)[0]).toBe('Damage');
      expect(lines).toHaveLength(4);
      for (const l of lines) expect(l.value.length).toBeGreaterThan(0);
    }
    const blaster = keyStats(TOWERS.blaster, TOWERS.blaster.stats);
    expect(blaster[0]?.value).toBe('8');
    expect(blaster[1]?.value).toBe('1.8/s');
    expect(blaster[2]?.value).toBe('260');
  });

  it('lists specials, and they follow upgrades', () => {
    expect(specialStats(TOWERS.frost.stats)).toContain('Slow 45%');
    expect(specialStats(TOWERS.coinfactory.stats)[0]).toBe('+80 coins / wave');
    expect(specialStats(TOWERS.radar.stats)).toContain('Reveals stealth');
    expect(specialStats(TOWERS.mortar.stats)).toContain('Ground only');
    const t2 = towerStatsAt(TOWERS.blaster, [2, 0]);
    expect(specialStats(t2)).toContain('Pierce 4');
    expect(keyStats(TOWERS.coinfactory, TOWERS.coinfactory.stats)[0]?.value).toBe('—');
  });

  it('knows which towers aim', () => {
    expect(usesTargetMode(TOWERS.blaster)).toBe(true);
    expect(usesTargetMode(TOWERS.heli)).toBe(true);
    expect(usesTargetMode(TOWERS.coinfactory)).toBe(false);
    expect(usesTargetMode(TOWERS.radar)).toBe(false);
    expect(usesTargetMode(TOWERS.spikes)).toBe(false);
  });
});

describe('wave preview and enemies', () => {
  it('puts the boss first and caps chips', () => {
    const r = previewChips({
      groups: [{ enemy: 'larva', count: 10 }, { enemy: 'mite', count: 30 }, { enemy: 'tick', count: 5 }, { enemy: 'queen', count: 1 }],
      boss: 'queen', newEnemies: ['tick'], totalHpEstimate: 1,
    }, 3);
    expect(r.boss).toBe('queen');
    expect(r.chips.map((c) => c.enemy)).toEqual(['queen', 'mite', 'larva']);
    expect(r.more).toBe(1);
    expect(previewChips(null, 4)).toEqual({ chips: [], more: 0, boss: null });
    const n = previewChips({ groups: [{ enemy: 'tick', count: 2 }], newEnemies: ['tick'], totalHpEstimate: 1 }, 4);
    expect(n.chips[0]).toEqual({ enemy: 'tick', count: 2, isNew: true });
  });

  it('hints how to fight new enemies', () => {
    expect(enemyHint(ENEMIES.phantom)).toBe('needs detection!');
    expect(enemyHint(ENEMIES.gnat)).toContain('flies');
    expect(enemyHint(ENEMIES.larva)).toBe('watch out!');
  });

  it('finds boss phase markers', () => {
    expect(bossPhaseMarkers(ENEMIES.irontick)).toEqual([0.75, 0.5]);
    expect(bossPhaseMarkers(ENEMIES.queen)).toEqual([]);
    expect(bossPhaseMarkers(ENEMIES.omega)).toEqual([0.75, 0.5, 0.25]);
  });
});
