import { describe, expect, it } from 'vitest';
import { ScrollPhysics, rubberBand } from '../../src/ui/ScrollPhysics';

function settle(p: ScrollPhysics, seconds = 5): void {
  for (let i = 0; i < seconds * 60 && p.moving; i++) p.step(1 / 60);
}

describe('ScrollPhysics', () => {
  it('clamps offset and scrollTo into [0, max]', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 1000);
    expect(p.max).toBe(600);
    p.scrollTo(900);
    expect(p.offset).toBe(600);
    p.scrollTo(-50);
    expect(p.offset).toBe(0);
    p.scrollTo(500);
    p.setSize(400, 600); // content shrank
    expect(p.offset).toBe(200);
    p.setSize(400, 300);
    expect(p.max).toBe(0);
    expect(p.offset).toBe(0);
  });

  it('follows a drag 1:1 inside bounds', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 1000);
    p.beginDrag(500, 0);
    p.dragTo(400, 16);
    expect(p.offset).toBe(100);
    p.dragTo(300, 32);
    expect(p.offset).toBe(200);
    expect(p.isDragging).toBe(true);
  });

  it('rubber-bands overscroll and springs back after release', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 1000);
    p.beginDrag(100, 0);
    p.dragTo(300, 100); // 200 px past the top
    expect(p.offset).toBeLessThan(0);
    expect(p.offset).toBeGreaterThan(-200);
    expect(p.offset).toBeCloseTo(rubberBand(-200, 400, 0.55));
    p.endDrag(400); // held still: no fling
    expect(p.moving).toBe(true);
    settle(p);
    expect(p.offset).toBe(0);
    expect(p.moving).toBe(false);
  });

  it('flings with inertia that decays and stops inside bounds', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 5000);
    p.beginDrag(600, 0);
    for (let i = 1; i <= 6; i++) p.dragTo(600 - i * 30, i * 10); // 3000 px/s upward swipe
    const released = p.offset;
    p.endDrag(60);
    expect(p.velocity).toBeGreaterThan(2000);
    expect(p.flinging).toBe(true);
    p.step(1 / 60);
    expect(p.offset).toBeGreaterThan(released);
    settle(p, 10);
    expect(p.velocity).toBe(0);
    expect(p.offset).toBeGreaterThan(released + 300);
    expect(p.offset).toBeLessThanOrEqual(p.max);
  });

  it('a fling into the end bounces and settles exactly on max', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 800);
    p.scrollTo(350);
    p.beginDrag(600, 0);
    for (let i = 1; i <= 5; i++) p.dragTo(600 - i * 40, i * 10);
    p.endDrag(50);
    let peak = 0;
    for (let i = 0; i < 600 && p.moving; i++) {
      p.step(1 / 60);
      peak = Math.max(peak, p.offset);
    }
    expect(peak).toBeGreaterThan(p.max);
    expect(p.offset).toBe(400);
  });

  it('does not fling after a pause before release', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 2000);
    p.beginDrag(600, 0);
    p.dragTo(400, 20);
    p.endDrag(400);
    expect(p.velocity).toBe(0);
  });

  it('wheel steps ease to a clamped target', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 1000);
    p.wheel(120);
    p.wheel(120);
    expect(p.moving).toBe(true);
    settle(p);
    expect(p.offset).toBe(240);
    p.wheel(10_000);
    settle(p);
    expect(p.offset).toBe(600);
  });

  it('stop() freezes motion and grabbing a moving list stops it', () => {
    const p = new ScrollPhysics();
    p.setSize(400, 3000);
    p.beginDrag(600, 0);
    for (let i = 1; i <= 5; i++) p.dragTo(600 - i * 40, i * 10);
    p.endDrag(50);
    p.step(1 / 60);
    p.stop();
    expect(p.velocity).toBe(0);
    expect(p.moving).toBe(false);
  });
});
