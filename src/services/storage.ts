/**
 * Safe key/value persistence. `localStorage` can throw (Safari private mode, quota, disabled
 * storage, sandboxed iframes); every access here is wrapped and falls back to memory, so the
 * game keeps working for the session and simply forgets on reload. Pure TS: no Phaser.
 */

/** The subset of the Web Storage API the services use (lets tests pass a fake). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Plain in-memory store (fallback and tests). */
export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/**
 * Wraps a possibly failing backing store. Reads that throw return the in-memory copy; writes
 * that throw (quota, private mode) are kept in memory so the current session stays consistent.
 */
export class SafeStore implements KeyValueStore {
  /** Session copy of every key touched; `null` marks a removed key. */
  private readonly memory = new Map<string, string | null>();
  private backing: KeyValueStore | null;

  constructor(backing: KeyValueStore | null) {
    this.backing = backing;
  }

  /** True when a backing store (localStorage) is available; writes may still fail on quota. */
  get persistent(): boolean {
    return this.backing !== null;
  }

  getItem(key: string): string | null {
    const mem = this.memory.get(key);
    if (mem !== undefined) return mem;
    if (!this.backing) return null;
    try {
      return this.backing.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    this.memory.set(key, value);
    if (!this.backing) return;
    try {
      this.backing.setItem(key, value);
    } catch {
      // Quota or private mode: keep the session copy only.
    }
  }

  removeItem(key: string): void {
    this.memory.set(key, null);
    if (!this.backing) return;
    try {
      this.backing.removeItem(key);
    } catch {
      // ignore
    }
  }
}

let defaultStore: SafeStore | null = null;

/** The app-wide store: `window.localStorage` when reachable, otherwise memory only. */
export function getDefaultStore(): SafeStore {
  if (defaultStore) return defaultStore;
  let backing: KeyValueStore | null = null;
  try {
    const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (ls) {
      const probe = '__ldtd_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      backing = ls;
    }
  } catch {
    backing = null;
  }
  defaultStore = new SafeStore(backing);
  return defaultStore;
}

/** Envelope written around every stored document. */
interface Envelope {
  v: number;
  data: unknown;
}

/**
 * Read a versioned JSON document. Returns `null` when the key is missing, the JSON is corrupt,
 * the version differs, or `validate` rejects the data. Never throws.
 */
export function readVersioned<T>(store: KeyValueStore, key: string, version: number, validate: (data: unknown) => T | null): T | null {
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const env = parsed as Partial<Envelope>;
    if (env.v !== version) return null;
    return validate(env.data);
  } catch {
    return null;
  }
}

/** Write a versioned JSON document. Never throws. */
export function writeVersioned(store: KeyValueStore, key: string, version: number, data: unknown): void {
  try {
    const env: Envelope = { v: version, data };
    store.setItem(key, JSON.stringify(env));
  } catch {
    // Serialisation or storage failure: drop silently, the game must go on.
  }
}

/** Remove a key. Never throws. */
export function removeKey(store: KeyValueStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}
