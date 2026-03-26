import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EventBus } from '../../src/core/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('on + emit: calls handler with payload', () => {
    let received: unknown = null;
    const handler = (data: { enemyId: string; isElite: boolean; isBoss: boolean }) => {
      received = data;
    };
    bus.on('combat:start', handler);
    const payload = { enemyId: 'slime', isElite: false, isBoss: false };
    bus.emit('combat:start', payload);
    expect(received).toEqual(payload);
  });

  it('off: removed handler is NOT called on emit', () => {
    let callCount = 0;
    const handler = () => { callCount++; };
    bus.on('combat:start', handler);
    bus.off('combat:start', handler);
    bus.emit('combat:start', { enemyId: 'slime', isElite: false, isBoss: false });
    expect(callCount).toBe(0);
  });

  it('removeAllListeners(event): removes all handlers for that event', () => {
    let count = 0;
    bus.on('combat:start', () => { count++; });
    bus.on('combat:start', () => { count++; });
    bus.removeAllListeners('combat:start');
    bus.emit('combat:start', { enemyId: 'slime', isElite: false, isBoss: false });
    expect(count).toBe(0);
  });

  it('removeAllListeners(): clears ALL events', () => {
    let count = 0;
    bus.on('combat:start', () => { count++; });
    bus.on('hero:damaged', () => { count++; });
    bus.removeAllListeners();
    bus.emit('combat:start', { enemyId: 'slime', isElite: false, isBoss: false });
    bus.emit('hero:damaged', { amount: 10, currentHP: 90, maxHP: 100 });
    expect(count).toBe(0);
  });

  it('listenerCount: returns correct count after add/remove', () => {
    const h1 = () => {};
    const h2 = () => {};
    bus.on('combat:start', h1);
    bus.on('combat:start', h2);
    expect(bus.listenerCount('combat:start')).toBe(2);
    bus.off('combat:start', h1);
    expect(bus.listenerCount('combat:start')).toBe(1);
  });

  it('emit with no listeners does not throw', () => {
    expect(() => {
      bus.emit('combat:start', { enemyId: 'slime', isElite: false, isBoss: false });
    }).not.toThrow();
  });

  it('EventBus module has zero Phaser imports', () => {
    const filePath = path.resolve(__dirname, '../../src/core/EventBus.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain("from 'phaser'");
    expect(content).not.toContain('import Phaser');
  });
});
