import { describe, expect, it } from 'vitest';
import { KeyedViews, Pool, type KeyedView } from '../../src/render/Pool';

interface V extends KeyedView { bound: number; released: number }

function makeViews() {
  let made = 0;
  const views = new KeyedViews<V>(
    () => { made++; return { uid: 0, seen: 0, bound: 0, released: 0 }; },
    (v) => { v.bound++; },
    (v) => { v.released++; },
  );
  return { views, made: () => made };
}

describe('Pool', () => {
  it('reuses released objects', () => {
    let n = 0;
    const pool = new Pool(() => ({ id: n++ }));
    const a = pool.acquire();
    pool.release(a);
    expect(pool.acquire()).toBe(a);
    expect(pool.size).toBe(1);
  });
});

describe('KeyedViews', () => {
  it('binds views by uid and keeps them while touched', () => {
    const { views } = makeViews();
    views.begin();
    const a = views.touch(1);
    views.touch(2);
    views.sweep();
    views.begin();
    expect(views.touch(1)).toBe(a);
    expect(a.bound).toBe(1);
    views.sweep();
    expect(views.list.length).toBe(1);
    expect(views.get(2)).toBeUndefined();
  });

  it('recycles swept views for new uids without allocating', () => {
    const { views, made } = makeViews();
    for (let frame = 0; frame < 50; frame++) {
      views.begin();
      for (let i = 0; i < 10; i++) views.touch(frame * 10 + i);
      views.sweep();
    }
    expect(made()).toBe(20);
    expect(views.list.length).toBe(10);
  });

  it('remove and clear release views', () => {
    const { views } = makeViews();
    views.begin();
    const a = views.touch(5);
    views.touch(6);
    views.remove(5);
    expect(a.released).toBe(1);
    views.clear();
    expect(views.list.length).toBe(0);
  });
});
