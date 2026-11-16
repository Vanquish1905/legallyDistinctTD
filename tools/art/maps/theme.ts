/** Colour sets for the eight map themes. */
import type { Theme } from './types';

export interface ThemePalette {
  /** Base ground colour. */
  ground: string;
  /** Soft large-scale variation tones. */
  patches: string[];
  /** Fine grain marks (grass blades, speckles). */
  grain: [string, string];
  grainKind: 'blades' | 'specks' | 'tiles' | 'cracks';
  road: string;
  roadEdge: string;
  /** Pebbles / texture marks inside the road. */
  roadMark: string;
  roadStyle: 'dirt' | 'stone' | 'snow' | 'basalt' | 'mud' | 'metal' | 'glow' | 'asphalt';
  /** Blocker liquid. */
  liquid: { deep: string; shallow: string; rim: string; shine: string; glow?: boolean };
  /** Edge vignette strength 0..1. */
  vignette: number;
}

export const THEME_PALETTES: Record<Theme, ThemePalette> = {
  meadow: {
    ground: '#62a347',
    patches: ['#71b552', '#56933e', '#7fc05b', '#4e8a39', '#8cc663'],
    grain: ['#4c8636', '#8fcf68'],
    grainKind: 'blades',
    road: '#cfa86d',
    roadEdge: '#7e5f39',
    roadMark: '#a8834f',
    roadStyle: 'dirt',
    liquid: { deep: '#2a78b8', shallow: '#4aa3d8', rim: '#d9c08a', shine: '#bde8ff' },
    vignette: 0.32,
  },
  desert: {
    ground: '#e3b877',
    patches: ['#edc78c', '#d6a764', '#f3d39d', '#cf9d5a', '#e8bf80'],
    grain: ['#c99a5a', '#f6dcaa'],
    grainKind: 'specks',
    road: '#b98a5c',
    roadEdge: '#7f5a37',
    roadMark: '#9c7148',
    roadStyle: 'stone',
    liquid: { deep: '#1f8a8a', shallow: '#3fb8a8', rim: '#f1d7a0', shine: '#c8fff3' },
    vignette: 0.28,
  },
  snow: {
    ground: '#e4eef7',
    patches: ['#f6fbff', '#d3e2ef', '#ffffff', '#cbdcea', '#eaf3fb'],
    grain: ['#c3d5e6', '#ffffff'],
    grainKind: 'specks',
    road: '#a9b9cb',
    roadEdge: '#6f839a',
    roadMark: '#8c9fb4',
    roadStyle: 'snow',
    liquid: { deep: '#0f4c7a', shallow: '#2f7fb3', rim: '#ffffff', shine: '#d8f1ff' },
    vignette: 0.3,
  },
  volcano: {
    ground: '#3f3130',
    patches: ['#4c3b38', '#322625', '#57423c', '#2b2120', '#5e3a2c'],
    grain: ['#2a1f1e', '#6b4f45'],
    grainKind: 'cracks',
    road: '#6f625d',
    roadEdge: '#1d1514',
    roadMark: '#52463f',
    roadStyle: 'basalt',
    liquid: { deep: '#e04812', shallow: '#ff8a1f', rim: '#2a1c19', shine: '#ffe08a', glow: true },
    vignette: 0.45,
  },
  swamp: {
    ground: '#4f6b3a',
    patches: ['#5c7b43', '#425c30', '#6a7f45', '#3b532c', '#57703d'],
    grain: ['#3a5229', '#7d9452'],
    grainKind: 'blades',
    road: '#7a6343',
    roadEdge: '#46392a',
    roadMark: '#5f4c33',
    roadStyle: 'mud',
    liquid: { deep: '#2c4a3c', shallow: '#4b7559', rim: '#5d5a35', shine: '#a8d8b0' },
    vignette: 0.42,
  },
  lab: {
    ground: '#323d4b',
    patches: ['#36424f', '#2d3745', '#3a4656', '#2a3340', '#34404e'],
    grain: ['#28313d', '#465366'],
    grainKind: 'tiles',
    road: '#59687c',
    roadEdge: '#1e2530',
    roadMark: '#46546a',
    roadStyle: 'metal',
    liquid: { deep: '#3f9d1f', shallow: '#86e23a', rim: '#4a5566', shine: '#e5ffb8', glow: true },
    vignette: 0.38,
  },
  crystal: {
    ground: '#2f2748',
    patches: ['#3a2f59', '#261f3b', '#43356a', '#221b35', '#352b52'],
    grain: ['#211a33', '#4e3f78'],
    grainKind: 'specks',
    road: '#5a4c7c',
    roadEdge: '#17122a',
    roadMark: '#493c68',
    roadStyle: 'glow',
    liquid: { deep: '#5b2bb5', shallow: '#9a62f0', rim: '#1d1633', shine: '#f0dcff', glow: true },
    vignette: 0.45,
  },
  city: {
    ground: '#2c3140',
    patches: ['#30364a', '#272c3a', '#353b4f', '#252a37', '#2f3444'],
    grain: ['#232735', '#3d4458'],
    grainKind: 'tiles',
    road: '#30333c',
    roadEdge: '#7c8496',
    roadMark: '#262930',
    roadStyle: 'asphalt',
    liquid: { deep: '#123d63', shallow: '#1f6aa0', rim: '#59627a', shine: '#9fdcff' },
    vignette: 0.42,
  },
};
