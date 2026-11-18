import { describe, expect, it } from 'vitest';
import {
  MAX_DOT_STACKS, RESIST_SLOW_FLOOR, RESIST_STUN_COOLDOWN, applyDot, applySlow, applyStun, makeStatus,
  resistedSlowFactor, statusSpeedFactor, tickStatus, type DotEffect,
} from '../../src/sim/status';

const ignore = (): void => {};

describe('slow', () => {
  it('keeps the strongest slow instead of stacking', () => {
    const s = makeStatus();
    applySlow(s, 0.5, 2);
    applySlow(s, 0.8, 5);
    expect(s).toMatchObject({ slowFactor: 0.5, slowRemaining: 2 });
    applySlow(s, 0.3, 1);
    expect(s).toMatchObject({ slowFactor: 0.3, slowRemaining: 1 });
    expect(statusSpeedFactor(s)).toBe(0.3);
  });

  it('refreshes an equal slow to the longer duration', () => {
    const s = makeStatus();
    applySlow(s, 0.5, 1);
    applySlow(s, 0.5, 3);
    applySlow(s, 0.5, 2);
    expect(s.slowRemaining).toBe(3);
  });

  it('expires back to full speed, after which weaker slows apply again', () => {
    const s = makeStatus();
    applySlow(s, 0.2, 0.5);
    tickStatus(s, 0.6, ignore);
    expect(statusSpeedFactor(s)).toBe(1);
    applySlow(s, 0.9, 1);
    expect(s.slowFactor).toBe(0.9);
  });

  it('supports a full freeze and ignores no-op slows', () => {
    const s = makeStatus();
    applySlow(s, 1, 5);
    applySlow(s, 0.5, 0);
    expect(statusSpeedFactor(s)).toBe(1);
    applySlow(s, -1, 1);
    expect(statusSpeedFactor(s)).toBe(0);
  });
});

describe('stun', () => {
  it('stops movement and takes the longer duration', () => {
    const s = makeStatus();
    applySlow(s, 0.5, 5);
    applyStun(s, 1);
    applyStun(s, 0.5);
    expect(s.stunRemaining).toBe(1);
    expect(statusSpeedFactor(s)).toBe(0);
    tickStatus(s, 1, ignore);
    expect(statusSpeedFactor(s)).toBe(0.5);
  });
});

describe('control resistance', () => {
  it('keeps 40% of a slow and never goes below the floor', () => {
    expect(resistedSlowFactor(0.5)).toBeCloseTo(0.8);
    expect(resistedSlowFactor(0.9)).toBeCloseTo(0.96);
    expect(resistedSlowFactor(0)).toBe(RESIST_SLOW_FLOOR);
    expect(resistedSlowFactor(1)).toBe(1);
  });

  it('quarters resisted stuns and puts them on a cooldown', () => {
    const s = makeStatus();
    applyStun(s, 0.4, true);
    expect(s.stunRemaining).toBeCloseTo(0.1);
    tickStatus(s, 0.1, ignore);
    applyStun(s, 0.4, true);
    expect(s.stunRemaining).toBe(0);
    tickStatus(s, RESIST_STUN_COOLDOWN, ignore);
    applyStun(s, 0.4, true);
    expect(s.stunRemaining).toBeCloseTo(0.1);
    applyStun(s, 0.4);
    expect(s.stunRemaining).toBeCloseTo(0.4);
  });
});

describe('damage over time', () => {
  it('stacks per source up to the cap and refreshes duration', () => {
    const s = makeStatus();
    for (let i = 0; i < 8; i++) applyDot(s, 1, 4, 2, 'poison');
    expect(s.dots).toHaveLength(1);
    expect(s.dots[0]!.stacks).toBe(MAX_DOT_STACKS);
    applyDot(s, 2, 4, 2, 'poison');
    applyDot(s, 1, 4, 2, 'fire');
    expect(s.dots).toHaveLength(3);
  });

  it('deals dps × stacks × time and stops at expiry', () => {
    const s = makeStatus();
    applyDot(s, 1, 4, 1, 'poison');
    applyDot(s, 1, 4, 1, 'poison');
    let total = 0;
    const sink = (_d: DotEffect, amount: number): void => { total += amount; };
    tickStatus(s, 0.5, sink);
    expect(total).toBeCloseTo(4);
    tickStatus(s, 0.75, sink);
    expect(total).toBeCloseTo(8);
    expect(s.dots).toHaveLength(0);
  });
});
