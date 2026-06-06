import { describe, it, expect } from 'vitest';
import { formatArg, formatArgs } from '../../src/debug/ConsoleLogger';

describe('ConsoleLogger serialization', () => {
  it('passes strings through untouched', () => {
    expect(formatArg('hello')).toBe('hello');
  });

  it('stringifies primitives', () => {
    expect(formatArg(42)).toBe('42');
    expect(formatArg(true)).toBe('true');
    expect(formatArg(null)).toBe('null');
    expect(formatArg(undefined)).toBe('undefined');
    expect(formatArg(10n)).toBe('10');
  });

  it('serializes plain objects and arrays as JSON', () => {
    expect(formatArg({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(formatArg([1, 2, 3])).toBe('[1,2,3]');
  });

  it('captures an Error stack (or name/message)', () => {
    const out = formatArg(new Error('boom'));
    expect(out).toContain('boom');
    expect(out).toMatch(/Error/);
  });

  it('survives circular references without throwing', () => {
    const obj: Record<string, unknown> = { name: 'loop' };
    obj.self = obj;
    const out = formatArg(obj);
    expect(out).toContain('"name":"loop"');
    expect(out).toContain('[Circular]');
  });

  it('describes functions', () => {
    function named() {}
    expect(formatArg(named)).toBe('[Function: named]');
    expect(formatArg(() => {})).toMatch(/\[Function/);
  });

  it('joins multiple args with spaces', () => {
    expect(formatArgs(['count', 3, { ok: true }])).toBe('count 3 {"ok":true}');
  });
});
