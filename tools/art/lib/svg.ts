/** Minimal SVG document builder with per-file unique gradient/filter ids. */
import { darken, lighten } from './color';
import { OUTLINE } from './palette';

export type Attrs = Record<string, string | number | undefined>;

/** Rounds numbers so files stay small and diffs stable. */
export function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function attrString(a: Attrs): string {
  let out = '';
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined) continue;
    out += ` ${k}="${typeof v === 'number' ? num(v) : v}"`;
  }
  return out;
}

/** Serialises one element. Children may be a string or a list of strings. */
export function el(tag: string, attrs: Attrs = {}, children: string | string[] = ''): string {
  const inner = Array.isArray(children) ? children.join('') : children;
  return inner ? `<${tag}${attrString(attrs)}>${inner}</${tag}>` : `<${tag}${attrString(attrs)}/>`;
}

/** Group helper. */
export function g(attrs: Attrs, children: string | string[]): string {
  return el('g', attrs, children);
}

/** Standard outline stroke attributes (3px at 128px scale). */
export function ol(width = 3, color = OUTLINE): Attrs {
  return { stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
}

export type Stop = [offset: number, color: string, opacity?: number];

function stopsXml(stops: Stop[]): string {
  return stops
    .map(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }))
    .join('');
}

/** One SVG file. Every def id is prefixed with the file key so ids never collide. */
export class SvgDoc {
  private defs: string[] = [];
  private cache = new Map<string, string>();
  private counter = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly prefix: string,
  ) {}

  /** Returns a new id unique within this document. */
  uid(name: string): string {
    this.counter += 1;
    return `${this.prefix}-${name}${this.counter}`;
  }

  /** Adds a raw def and returns its id (memoised by cache key when given). */
  def(name: string, build: (id: string) => string, key?: string): string {
    if (key) {
      const hit = this.cache.get(key);
      if (hit) return hit;
    }
    const id = this.uid(name);
    this.defs.push(build(id));
    if (key) this.cache.set(key, id);
    return id;
  }

  /** Linear gradient paint; coordinates in objectBoundingBox units. */
  linear(stops: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
    const key = `lin:${JSON.stringify(stops)}:${x1},${y1},${x2},${y2}`;
    const id = this.def('lg', (i) => el('linearGradient', { id: i, x1, y1, x2, y2 }, stopsXml(stops)), key);
    return `url(#${id})`;
  }

  /** Linear gradient in user space (needed for zero-width shapes such as straight strokes). */
  linearUser(stops: Stop[], x1: number, y1: number, x2: number, y2: number): string {
    const key = `linu:${JSON.stringify(stops)}:${x1},${y1},${x2},${y2}`;
    const id = this.def('lu', (i) => el('linearGradient', { id: i, x1, y1, x2, y2, gradientUnits: 'userSpaceOnUse' }, stopsXml(stops)), key);
    return `url(#${id})`;
  }

  /** Radial gradient paint in objectBoundingBox units. */
  radial(stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number): string {
    const key = `rad:${JSON.stringify(stops)}:${cx},${cy},${r},${fx},${fy}`;
    const id = this.def('rg', (i) => el('radialGradient', { id: i, cx, cy, r, fx, fy }, stopsXml(stops)), key);
    return `url(#${id})`;
  }

  /** Top-lit three tone shading for a flat part (light top-left, dark bottom-right). */
  shade(color: string, amount = 0.3): string {
    return this.linear(
      [
        [0, lighten(color, amount)],
        [0.5, color],
        [1, darken(color, amount)],
      ],
      0.2,
      0,
      0.8,
      1,
    );
  }

  /** Spherical shading with an off-centre highlight. */
  sphere(color: string, amount = 0.45): string {
    return this.radial(
      [
        [0, lighten(color, amount)],
        [0.45, color],
        [1, darken(color, amount * 0.8)],
      ],
      0.5,
      0.5,
      0.6,
      0.35,
      0.3,
    );
  }

  /** Soft drop shadow filter. dx = dy = 0 gives a rotation-safe ambient shadow. */
  shadow(dx = 2, dy = 4, blur = 2.5, opacity = 0.4): string {
    const key = `shadow:${dx},${dy},${blur},${opacity}`;
    const id = this.def(
      'sh',
      (i) =>
        el(
          'filter',
          { id: i, x: '-30%', y: '-30%', width: '160%', height: '160%', 'color-interpolation-filters': 'sRGB' },
          el('feDropShadow', { dx, dy, stdDeviation: blur, 'flood-color': '#000000', 'flood-opacity': opacity }),
        ),
      key,
    );
    return `url(#${id})`;
  }

  /** Gaussian blur filter (used for glows and soft blobs). */
  blur(amount: number): string {
    const key = `blur:${amount}`;
    const id = this.def(
      'bl',
      (i) =>
        el(
          'filter',
          { id: i, x: '-50%', y: '-50%', width: '200%', height: '200%' },
          el('feGaussianBlur', { stdDeviation: amount }),
        ),
      key,
    );
    return `url(#${id})`;
  }

  /** Registers a clip path and returns its url reference. */
  clip(content: string): string {
    const id = this.def('cp', (i) => el('clipPath', { id: i }, content));
    return `url(#${id})`;
  }

  /** Registers a pattern and returns its paint url. */
  pattern(width: number, height: number, content: string, extra: Attrs = {}): string {
    const id = this.def('pt', (i) =>
      el('pattern', { id: i, width, height, patternUnits: 'userSpaceOnUse', ...extra }, content),
    );
    return `url(#${id})`;
  }

  /** Serialises the finished document. */
  render(body: string | string[], viewBox?: string): string {
    const inner = Array.isArray(body) ? body.join('') : body;
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    const vb = viewBox ?? `0 0 ${this.width} ${this.height}`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" ` +
      `viewBox="${vb}">${defs}${inner}</svg>\n`
    );
  }
}
