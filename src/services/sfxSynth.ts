/**
 * Tiny procedural sound-effect synth for cues the team never recorded (UI clicks, tesla zaps,
 * boss horns…). Each cue is a recipe of a few oscillator/noise voices with pitch sweeps,
 * envelopes and one-pole filters, rendered once into a mono sample buffer at boot. The math is
 * pure TS (testable); `synthBuffers` turns the samples into WebAudio `AudioBuffer`s.
 * Peaks are kept low so the synth cues sit below the real recordings.
 */

type Wave = 'sine' | 'square' | 'saw' | 'tri' | 'noise';

/** One voice of a recipe. Times in seconds, frequencies in Hz. */
interface Voice {
  wave: Wave;
  /** Start and end frequency (exponential sweep). Ignored by noise unless `lp`/`hp` set. */
  f0: number;
  f1?: number;
  start?: number;
  dur: number;
  attack?: number;
  /** Decay curve power: 1 = linear, higher = snappier. */
  curve?: number;
  gain?: number;
  /** One-pole low-pass / high-pass cutoffs. */
  lp?: number;
  hp?: number;
  vibrato?: { rate: number; depth: number };
  /** Amplitude modulation (tremolo), depth 0..1. */
  am?: { rate: number; depth: number };
}

interface Recipe {
  voices: Voice[];
  /** Peak level after normalisation (0..1). */
  peak: number;
}

/** Keys of the generated cues (registered as `sfx-<name>`). */
export const SYNTH_CUES = [
  'ui-click', 'ui-hover', 'coin', 'zap', 'laser', 'freeze', 'poison', 'flame', 'saw', 'railgun',
  'mortar', 'pulse', 'boss-warning', 'wave-start', 'upgrade', 'error', 'life-lost',
] as const;
export type SynthCue = (typeof SYNTH_CUES)[number];

const RECIPES: Record<SynthCue, Recipe> = {
  'ui-click': { peak: 0.32, voices: [
    { wave: 'sine', f0: 2200, f1: 1400, dur: 0.035, attack: 0.001, curve: 3 },
    { wave: 'noise', f0: 0, dur: 0.012, attack: 0.0005, curve: 2, gain: 0.25, hp: 3000 },
  ] },
  'ui-hover': { peak: 0.1, voices: [{ wave: 'sine', f0: 1700, f1: 1900, dur: 0.03, attack: 0.004, curve: 2 }] },
  coin: { peak: 0.3, voices: [
    { wave: 'square', f0: 988, dur: 0.07, attack: 0.002, curve: 1, gain: 0.5, lp: 5000 },
    { wave: 'square', f0: 1319, start: 0.065, dur: 0.22, attack: 0.002, curve: 2.5, gain: 0.5, lp: 5000 },
  ] },
  zap: { peak: 0.34, voices: [
    { wave: 'saw', f0: 90, f1: 140, dur: 0.16, attack: 0.002, curve: 2, am: { rate: 55, depth: 0.8 }, lp: 4200 },
    { wave: 'noise', f0: 0, dur: 0.12, attack: 0.001, curve: 3, gain: 0.5, hp: 2500, am: { rate: 90, depth: 1 } },
  ] },
  laser: { peak: 0.24, voices: [
    { wave: 'saw', f0: 440, dur: 0.38, attack: 0.04, curve: 1.5, lp: 1800, vibrato: { rate: 18, depth: 0.03 } },
    { wave: 'sine', f0: 880, dur: 0.38, attack: 0.04, curve: 1.5, gain: 0.5, vibrato: { rate: 18, depth: 0.03 } },
  ] },
  freeze: { peak: 0.26, voices: [
    { wave: 'sine', f0: 2400, f1: 700, dur: 0.35, attack: 0.005, curve: 2, vibrato: { rate: 30, depth: 0.04 } },
    { wave: 'noise', f0: 0, dur: 0.3, attack: 0.02, curve: 2, gain: 0.35, hp: 5000 },
  ] },
  poison: { peak: 0.2, voices: [{ wave: 'noise', f0: 0, dur: 0.32, attack: 0.06, curve: 1.5, hp: 3500, lp: 9000 }] },
  flame: { peak: 0.22, voices: [
    { wave: 'noise', f0: 0, dur: 0.3, attack: 0.03, curve: 1.4, lp: 1400, am: { rate: 23, depth: 0.35 } },
    { wave: 'sine', f0: 70, dur: 0.3, attack: 0.03, curve: 1.4, gain: 0.4 },
  ] },
  saw: { peak: 0.2, voices: [
    { wave: 'saw', f0: 280, f1: 520, dur: 0.26, attack: 0.01, curve: 1.5, lp: 2600, am: { rate: 38, depth: 0.6 } },
  ] },
  railgun: { peak: 0.38, voices: [
    { wave: 'noise', f0: 0, dur: 0.06, attack: 0.0005, curve: 3, hp: 1500 },
    { wave: 'sine', f0: 1800, f1: 90, dur: 0.28, attack: 0.001, curve: 2.5, gain: 0.8 },
    { wave: 'square', f0: 220, f1: 55, dur: 0.2, attack: 0.001, curve: 3, gain: 0.25, lp: 1200 },
  ] },
  mortar: { peak: 0.4, voices: [
    { wave: 'sine', f0: 130, f1: 42, dur: 0.32, attack: 0.002, curve: 2 },
    { wave: 'noise', f0: 0, dur: 0.12, attack: 0.001, curve: 3, gain: 0.4, lp: 900 },
  ] },
  pulse: { peak: 0.3, voices: [
    { wave: 'sine', f0: 220, f1: 70, dur: 0.3, attack: 0.01, curve: 2 },
    { wave: 'tri', f0: 330, f1: 105, dur: 0.3, attack: 0.01, curve: 2, gain: 0.4 },
  ] },
  'boss-warning': { peak: 0.42, voices: [
    { wave: 'saw', f0: 110, dur: 1.5, attack: 0.25, curve: 1.2, lp: 900, am: { rate: 2.2, depth: 0.5 } },
    { wave: 'saw', f0: 111.5, dur: 1.5, attack: 0.25, curve: 1.2, lp: 900, am: { rate: 2.2, depth: 0.5 } },
    { wave: 'sine', f0: 55, dur: 1.5, attack: 0.25, curve: 1.2, gain: 0.8 },
  ] },
  'wave-start': { peak: 0.42, voices: [
    { wave: 'sine', f0: 160, f1: 55, dur: 0.22, attack: 0.002, curve: 2.5 },
    { wave: 'noise', f0: 0, dur: 0.05, attack: 0.001, curve: 3, gain: 0.3, lp: 3000 },
    { wave: 'sine', f0: 160, f1: 55, start: 0.18, dur: 0.3, attack: 0.002, curve: 2.5 },
    { wave: 'noise', f0: 0, start: 0.18, dur: 0.05, attack: 0.001, curve: 3, gain: 0.3, lp: 3000 },
  ] },
  upgrade: { peak: 0.28, voices: [
    { wave: 'sine', f0: 1047, dur: 0.12, attack: 0.003, curve: 2 },
    { wave: 'sine', f0: 1319, start: 0.07, dur: 0.12, attack: 0.003, curve: 2 },
    { wave: 'sine', f0: 1568, start: 0.14, dur: 0.3, attack: 0.003, curve: 2.2 },
    { wave: 'tri', f0: 2093, start: 0.14, dur: 0.3, attack: 0.003, curve: 2.2, gain: 0.25 },
  ] },
  error: { peak: 0.24, voices: [
    { wave: 'square', f0: 150, dur: 0.09, attack: 0.002, curve: 1, lp: 1500 },
    { wave: 'square', f0: 120, start: 0.11, dur: 0.12, attack: 0.002, curve: 1.2, lp: 1500 },
  ] },
  'life-lost': { peak: 0.38, voices: [
    { wave: 'sine', f0: 95, f1: 38, dur: 0.4, attack: 0.003, curve: 2 },
    { wave: 'noise', f0: 0, dur: 0.15, attack: 0.002, curve: 2.5, gain: 0.35, lp: 600 },
  ] },
};

/** Duration of a cue in seconds (end of its last voice plus a short tail). */
export function cueDuration(cue: SynthCue): number {
  let end = 0;
  for (const v of RECIPES[cue].voices) end = Math.max(end, (v.start ?? 0) + v.dur);
  return end + 0.01;
}

/** Deterministic noise source (so every boot sounds the same). */
function noiseGen(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

function osc(wave: Wave, phase: number, noise: () => number): number {
  switch (wave) {
    case 'sine': return Math.sin(phase * 2 * Math.PI);
    case 'square': return phase % 1 < 0.5 ? 1 : -1;
    case 'saw': return 2 * (phase % 1) - 1;
    case 'tri': { const p = phase % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }
    case 'noise': return noise();
  }
}

/** One-pole filter coefficient for a cutoff. */
function coef(cutoff: number, sampleRate: number): number {
  return 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
}

/** Render a cue into mono samples at `sampleRate`. Pure and deterministic. */
export function renderCue(cue: SynthCue, sampleRate: number): Float32Array<ArrayBuffer> {
  const recipe = RECIPES[cue];
  const total = Math.ceil(cueDuration(cue) * sampleRate);
  const out = new Float32Array(total);
  const noise = noiseGen(cue.length * 7919 + total);
  for (const v of recipe.voices) {
    const start = Math.floor((v.start ?? 0) * sampleRate);
    const n = Math.min(total - start, Math.floor(v.dur * sampleRate));
    const attack = Math.max(1, Math.floor((v.attack ?? 0.005) * sampleRate));
    const curve = v.curve ?? 2;
    const gain = v.gain ?? 1;
    const f1 = v.f1 ?? v.f0;
    const lpA = v.lp ? coef(v.lp, sampleRate) : 1;
    const hpA = v.hp ? coef(v.hp, sampleRate) : 0;
    let phase = 0;
    let lp = 0;
    let hpLow = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const k = n > 1 ? i / (n - 1) : 0;
      let f = v.f0 * Math.pow(f1 / Math.max(1, v.f0), k);
      if (v.vibrato) f *= 1 + v.vibrato.depth * Math.sin(2 * Math.PI * v.vibrato.rate * t);
      phase += f / sampleRate;
      let s = osc(v.wave, phase, noise);
      if (v.hp) {
        hpLow += hpA * (s - hpLow);
        s -= hpLow;
      }
      lp += lpA * (s - lp);
      s = lp;
      const env = i < attack ? i / attack : Math.pow(1 - (i - attack) / Math.max(1, n - attack), curve);
      const am = v.am ? 1 - v.am.depth * 0.5 * (1 + Math.sin(2 * Math.PI * v.am.rate * t)) : 1;
      out[start + i]! += s * env * am * gain;
    }
  }
  let max = 0;
  for (let i = 0; i < total; i++) max = Math.max(max, Math.abs(out[i]!));
  const scale = max > 0 ? recipe.peak / max : 0;
  const fade = Math.min(total, Math.floor(0.004 * sampleRate));
  for (let i = 0; i < total; i++) {
    const edge = i >= total - fade ? (total - i) / fade : 1;
    out[i] = out[i]! * scale * edge;
  }
  return out;
}

/** Render one cue into an AudioBuffer for `ctx` (null on failure). Never throws. */
export function synthBuffer(ctx: BaseAudioContext, cue: SynthCue): AudioBuffer | null {
  try {
    const samples = renderCue(cue, ctx.sampleRate);
    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.copyToChannel(samples, 0);
    return buf;
  } catch {
    return null; // A cue that fails to build simply stays silent.
  }
}
