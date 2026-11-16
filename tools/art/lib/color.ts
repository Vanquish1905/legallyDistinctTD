/** Small color helpers working on #rrggbb strings. */

type RGB = [number, number, number];

function parse(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function format([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear blend of two colors, t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return format([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

/** Blend toward white. */
export function lighten(c: string, t: number): string {
  return mix(c, '#ffffff', t);
}

/** Blend toward a cool near-black (keeps shadows from going muddy). */
export function darken(c: string, t: number): string {
  return mix(c, '#141826', t);
}
