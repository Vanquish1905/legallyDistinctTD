/**
 * Free-list object pool. `create` builds a new object when the free list is empty; callers
 * reset/hide objects themselves on release.
 */
export class Pool<T> {
  private readonly free: T[] = [];
  private created = 0;

  constructor(private readonly create: () => T) {}

  /** Take an object from the pool (or make a new one). */
  acquire(): T {
    const item = this.free.pop();
    if (item !== undefined) return item;
    this.created++;
    return this.create();
  }

  /** Give an object back for reuse. */
  release(item: T): void {
    this.free.push(item);
  }

  /** Objects ever created by this pool. */
  get size(): number {
    return this.created;
  }
}

/** A view bound to one sim object (enemy, tower, projectile) by uid. */
export interface KeyedView {
  uid: number;
  /** Frame stamp of the last sync that saw the sim object. */
  seen: number;
}

/**
 * Views keyed by sim uid, backed by a pool. Each frame the owner calls `touch(uid)` for every
 * live sim object, then `sweep()` releases the views whose objects are gone. No allocations
 * once the pool is warm.
 */
export class KeyedViews<V extends KeyedView> {
  /** Live views (unordered). */
  readonly list: V[] = [];
  private readonly byUid = new Map<number, V>();
  private readonly pool: Pool<V>;
  private frame = 0;

  /**
   * @param create builds a new, hidden view
   * @param onBind called when a view is (re)bound to a uid
   * @param onRelease called when a view goes back to the pool (hide it there)
   */
  constructor(
    create: () => V,
    private readonly onBind: (view: V) => void,
    private readonly onRelease: (view: V) => void,
  ) {
    this.pool = new Pool(create);
  }

  /** Start a new sync pass. */
  begin(): void {
    this.frame++;
  }

  /** View for `uid`, binding a pooled one when new. Marks it as seen this pass. */
  touch(uid: number): V {
    let v = this.byUid.get(uid);
    if (!v) {
      v = this.pool.acquire();
      v.uid = uid;
      this.byUid.set(uid, v);
      this.list.push(v);
      this.onBind(v);
    }
    v.seen = this.frame;
    return v;
  }

  /** The live view for `uid`, if any. */
  get(uid: number): V | undefined {
    return this.byUid.get(uid);
  }

  /** Release every view not touched since `begin()`. */
  sweep(): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i] as V;
      if (v.seen === this.frame) continue;
      this.removeAt(i);
    }
  }

  /** Release the view for `uid` right away. */
  remove(uid: number): void {
    const v = this.byUid.get(uid);
    if (!v) return;
    this.removeAt(this.list.indexOf(v));
  }

  /** Release every view. */
  clear(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.removeAt(i);
  }

  private removeAt(i: number): void {
    const v = this.list[i] as V;
    const last = this.list.pop() as V;
    if (i < this.list.length) this.list[i] = last;
    this.byUid.delete(v.uid);
    this.onRelease(v);
    this.pool.release(v);
  }
}
