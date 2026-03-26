import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';

describe('Memory: Listener Leak Prevention', () => {
  it('after 50 on/off cycles for same handler, listenerCount is 0', () => {
    const bus = new EventBus();
    const handler = () => {};

    for (let i = 0; i < 50; i++) {
      bus.on('combat:start', handler);
      bus.off('combat:start', handler);
    }

    expect(bus.listenerCount('combat:start')).toBe(0);
  });

  it('after 50 on/removeAllListeners cycles, listenerCount is 0', () => {
    const bus = new EventBus();

    for (let i = 0; i < 50; i++) {
      bus.on('combat:start', () => {});
      bus.removeAllListeners('combat:start');
    }

    expect(bus.listenerCount('combat:start')).toBe(0);
  });
});
