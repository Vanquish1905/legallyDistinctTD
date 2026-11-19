import { describe, expect, it } from 'vitest';
import { LONG_PRESS_MS, PressGesture, TAP_SLOP } from '../../src/ui/gesture';

describe('PressGesture', () => {
  it('a short still press is a tap', () => {
    const g = new PressGesture();
    g.down(10, 10, 0);
    expect(g.move(12, 13)).toBe(false);
    expect(g.up(12, 13)).toBe(true);
    expect(g.active).toBe(false);
  });

  it('moving past the slop turns it into a drag (no tap)', () => {
    const g = new PressGesture();
    g.down(0, 0, 0);
    expect(g.move(0, TAP_SLOP + 1)).toBe(true);
    expect(g.kind).toBe('drag');
    expect(g.move(0, 50)).toBe(false); // reported once
    expect(g.up(0, 0)).toBe(false);
  });

  it('release far away without move events is not a tap', () => {
    const g = new PressGesture();
    g.down(0, 0, 0);
    expect(g.up(100, 0)).toBe(false);
  });

  it('holding still becomes a long-press, which is not a tap', () => {
    const g = new PressGesture();
    g.down(0, 0, 0);
    expect(g.tick(LONG_PRESS_MS - 1)).toBe(false);
    expect(g.tick(LONG_PRESS_MS)).toBe(true);
    expect(g.tick(LONG_PRESS_MS + 100)).toBe(false);
    expect(g.up(0, 0)).toBe(false);
  });

  it('suppressTap (press that stopped a fling) never taps', () => {
    const g = new PressGesture();
    g.down(0, 0, 0);
    g.suppressTap = true;
    expect(g.up(0, 0)).toBe(false);
    g.down(0, 0, 10);
    expect(g.suppressTap).toBe(false);
    expect(g.up(0, 0)).toBe(true);
  });
});
