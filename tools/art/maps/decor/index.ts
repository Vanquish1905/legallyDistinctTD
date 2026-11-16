/** Decor sets per theme. */
import type { Theme } from '../types';
import type { ThemeDecor } from './common';
import { DESERT, MEADOW, SNOW, SWAMP } from './nature';
import { CITY, CRYSTAL, LAB, VOLCANO } from './special';

export const DECOR: Record<Theme, ThemeDecor> = {
  meadow: MEADOW,
  desert: DESERT,
  snow: SNOW,
  volcano: VOLCANO,
  swamp: SWAMP,
  lab: LAB,
  crystal: CRYSTAL,
  city: CITY,
};
