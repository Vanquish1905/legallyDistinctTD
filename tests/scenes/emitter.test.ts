import { describe, expect, it, vi } from 'vitest';
import { TypedEmitter } from '../../src/scenes/game/TypedEmitter';

describe('TypedEmitter', () => {
  it('emits to subscribers until they unsubscribe', () => {
    const em = new TypedEmitter<{ ping: { n: number } }>();
    const fn = vi.fn();
    const off = em.on('ping', fn);
    em.emit('ping', { n: 1 });
    off();
    em.emit('ping', { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ n: 1 });
  });

  it('removeAll drops every handler', () => {
    const em = new TypedEmitter<{ a: number; b: string }>();
    const fn = vi.fn();
    em.on('a', fn);
    em.on('b', fn);
    em.removeAll();
    em.emit('a', 1);
    em.emit('b', 'x');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('TypedEmitter during emit', () => {
  it('a handler removing itself does not skip the next handler', () => {
    const em = new TypedEmitter<{ ping: number }>();
    const calls: string[] = [];
    const off = em.on('ping', () => { calls.push('a'); off(); });
    em.on('ping', () => calls.push('b'));
    em.emit('ping', 1);
    em.emit('ping', 2);
    expect(calls).toEqual(['a', 'b', 'b']);
  });

  it('a handler added during emit runs from the next emit on', () => {
    const em = new TypedEmitter<{ ping: number }>();
    const calls: string[] = [];
    em.on('ping', () => { calls.push('a'); if (calls.length === 1) em.on('ping', () => calls.push('late')); });
    em.emit('ping', 1);
    em.emit('ping', 2);
    expect(calls).toEqual(['a', 'a', 'late']);
  });
});
