/** Minimal typed event emitter (no Phaser dependency, safe to unit test). */
export class TypedEmitter<Events extends object> {
  private readonly handlers: { [K in keyof Events]?: ((payload: Events[K]) => void)[] } = {};

  /** Subscribe; returns a function that unsubscribes. */
  on<K extends keyof Events>(name: K, fn: (payload: Events[K]) => void): () => void {
    const list = this.handlers[name] ?? (this.handlers[name] = []);
    list.push(fn);
    return () => this.off(name, fn);
  }

  /** Unsubscribe a handler added with `on`. */
  off<K extends keyof Events>(name: K, fn: (payload: Events[K]) => void): void {
    const list = this.handlers[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  /** Call every handler of `name` with `payload`. */
  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    const list = this.handlers[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) (list[i] as (payload: Events[K]) => void)(payload);
  }

  /** Drop every handler. */
  removeAll(): void {
    for (const k of Object.keys(this.handlers) as (keyof Events)[]) delete this.handlers[k];
  }
}
