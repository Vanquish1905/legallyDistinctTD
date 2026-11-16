import { describe, expect, it } from 'vitest';
import { FIELD_W, GAME_W, SIDEBAR_W, SIM_DT } from '../src/config';

describe('config', () => {
  it('splits the screen into field and sidebar', () => {
    expect(FIELD_W + SIDEBAR_W).toBe(GAME_W);
  });
  it('uses a 60 Hz sim step', () => {
    expect(SIM_DT).toBeCloseTo(1 / 60);
  });
});
