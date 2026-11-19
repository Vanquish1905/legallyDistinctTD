import { describe, expect, it } from 'vitest';
import { MemoryStore, SafeStore, readVersioned, removeKey, writeVersioned, type KeyValueStore } from '../../src/services/storage';

/** A store whose every call throws (Safari private mode, disabled storage). */
class ThrowingStore implements KeyValueStore {
  getItem(): string | null { throw new Error('SecurityError'); }
  setItem(): void { throw new Error('QuotaExceededError'); }
  removeItem(): void { throw new Error('SecurityError'); }
}

describe('SafeStore', () => {
  it('passes through to a working store', () => {
    const backing = new MemoryStore();
    const s = new SafeStore(backing);
    s.setItem('a', '1');
    expect(backing.getItem('a')).toBe('1');
    expect(new SafeStore(backing).getItem('a')).toBe('1');
  });

  it('keeps a session copy when the backing store throws', () => {
    const s = new SafeStore(new ThrowingStore());
    expect(s.getItem('a')).toBeNull();
    expect(() => s.setItem('a', '1')).not.toThrow();
    expect(s.getItem('a')).toBe('1');
    expect(() => s.removeItem('a')).not.toThrow();
    expect(s.getItem('a')).toBeNull();
  });

  it('works with no backing store at all', () => {
    const s = new SafeStore(null);
    expect(s.persistent).toBe(false);
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
  });

  it('does not resurrect a removed key whose backing removal failed', () => {
    const backing = new MemoryStore();
    backing.setItem('k', 'old');
    const flaky: KeyValueStore = {
      getItem: (k) => backing.getItem(k),
      setItem: (k, v) => backing.setItem(k, v),
      removeItem: () => { throw new Error('nope'); },
    };
    const s = new SafeStore(flaky);
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });
});

describe('versioned documents', () => {
  const validate = (d: unknown) => (typeof d === 'object' && d !== null && 'n' in d ? (d as { n: number }) : null);

  it('round-trips', () => {
    const s = new MemoryStore();
    writeVersioned(s, 'doc', 2, { n: 5 });
    expect(readVersioned(s, 'doc', 2, validate)).toEqual({ n: 5 });
  });

  it('returns null for missing, corrupt, wrong-version or invalid data', () => {
    const s = new MemoryStore();
    expect(readVersioned(s, 'doc', 1, validate)).toBeNull();
    s.setItem('doc', '{not json');
    expect(readVersioned(s, 'doc', 1, validate)).toBeNull();
    s.setItem('doc', 'null');
    expect(readVersioned(s, 'doc', 1, validate)).toBeNull();
    writeVersioned(s, 'doc', 1, { n: 1 });
    expect(readVersioned(s, 'doc', 2, validate)).toBeNull();
    writeVersioned(s, 'doc', 1, { m: 1 });
    expect(readVersioned(s, 'doc', 1, validate)).toBeNull();
  });

  it('never throws on failing stores or unserialisable data', () => {
    const t = new ThrowingStore();
    expect(() => writeVersioned(t, 'doc', 1, { n: 1 })).not.toThrow();
    expect(readVersioned(t, 'doc', 1, validate)).toBeNull();
    expect(() => removeKey(t, 'doc')).not.toThrow();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => writeVersioned(new MemoryStore(), 'doc', 1, cyclic)).not.toThrow();
  });
});
