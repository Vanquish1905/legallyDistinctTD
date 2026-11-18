/** Particle detail level; the settings screen picks one, effects scale their counts by it. */
export type ParticleQuality = 'low' | 'medium' | 'high';

/** Particle count multiplier per quality level. */
export const QUALITY_MUL: Readonly<Record<ParticleQuality, number>> = { low: 0.35, medium: 0.7, high: 1 };

/** Most effect sprites alive at once per quality level (oldest are recycled beyond this). */
export const QUALITY_CAP: Readonly<Record<ParticleQuality, number>> = { low: 120, medium: 260, high: 420 };
