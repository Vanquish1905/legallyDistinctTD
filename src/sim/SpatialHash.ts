/** Anything stored in the hash: a circle. */
export interface Circle { x: number; y: number; radius: number }

const KEY_OFFSET = 1024;
const KEY_STRIDE = 4096;

/**
 * Uniform-grid spatial hash (default 128 px cells), rebuilt every tick. Cell arrays are reused
 * across `clear()` calls, so steady-state rebuilds do not allocate.
 */
export class SpatialHash<T extends Circle> {
  private readonly cells = new Map<number, T[]>();
  private readonly used: T[][] = [];
  private maxRadius = 0;

  constructor(readonly cellSize = 128) {}

  private key(cx: number, cy: number): number {
    return (cx + KEY_OFFSET) * KEY_STRIDE + (cy + KEY_OFFSET);
  }

  /** Remove all items (keeps cell storage). */
  clear(): void {
    for (const cell of this.used) cell.length = 0;
    this.used.length = 0;
    this.maxRadius = 0;
  }

  /** Insert an item by its centre. */
  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    if (cell.length === 0) this.used.push(cell);
    cell.push(item);
    if (item.radius > this.maxRadius) this.maxRadius = item.radius;
  }

  /**
   * Collect items whose circle touches the query circle (centre distance <= r + item.radius).
   * Results are appended to `out` (cleared first) in a deterministic order.
   */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const reach = r + this.maxRadius;
    const minX = Math.floor((x - reach) / this.cellSize);
    const maxX = Math.floor((x + reach) / this.cellSize);
    const minY = Math.floor((y - reach) / this.cellSize);
    const maxY = Math.floor((y + reach) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const item of cell) {
          const dx = item.x - x;
          const dy = item.y - y;
          const touch = r + item.radius;
          if (dx * dx + dy * dy <= touch * touch) out.push(item);
        }
      }
    }
    return out;
  }
}
