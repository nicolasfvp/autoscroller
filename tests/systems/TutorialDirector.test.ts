import { describe, it, expect, beforeEach } from 'vitest';
import { tutorialDirector, TUTORIAL_STEPS } from '../../src/systems/tutorial/TutorialDirector';
import { SCENE_KEYS } from '../../src/state/SceneKeys';

describe('TutorialDirector', () => {
  beforeEach(() => {
    // Reset the singleton between tests by completing any in-flight tutorial
    // (complete() resets index + active flag).
    tutorialDirector.complete();
  });

  it('starts inactive', () => {
    expect(tutorialDirector.isActive()).toBe(false);
    expect(tutorialDirector.getCurrentStep()).toBeNull();
  });

  it('activates and lands on the first step (welcome)', () => {
    tutorialDirector.start();
    expect(tutorialDirector.isActive()).toBe(true);
    const step = tutorialDirector.getCurrentStep();
    expect(step?.id).toBe('welcome');
    expect(step?.scene).toBe(SCENE_KEYS.CHARACTER_SELECT);
  });

  it('advanceIfMatches only advances when the id matches', () => {
    tutorialDirector.start();
    // Current is 'welcome'; passing the wrong id is a no-op.
    expect(tutorialDirector.advanceIfMatches('pick-warrior')).toBe(false);
    expect(tutorialDirector.getCurrentStep()?.id).toBe('welcome');
    // Correct id advances.
    expect(tutorialDirector.advanceIfMatches('welcome')).toBe(true);
    expect(tutorialDirector.getCurrentStep()?.id).toBe('pick-warrior');
  });

  it('walks through every step in order and completes at the end', () => {
    tutorialDirector.start();
    const expectedIds = TUTORIAL_STEPS.map(s => s.id);
    const visited: string[] = [];
    while (tutorialDirector.isActive()) {
      const step = tutorialDirector.getCurrentStep();
      if (!step) break;
      visited.push(step.id);
      tutorialDirector.advance();
    }
    expect(visited).toEqual(expectedIds);
    expect(tutorialDirector.isActive()).toBe(false);
  });

  it('getStepForScene returns null when the current step belongs to another scene', () => {
    tutorialDirector.start();
    // Welcome lives on CHARACTER_SELECT.
    expect(tutorialDirector.getStepForScene(SCENE_KEYS.CHARACTER_SELECT)?.id).toBe('welcome');
    expect(tutorialDirector.getStepForScene(SCENE_KEYS.GAME)).toBeNull();
  });

  it('notifies subscribers on each advance', () => {
    tutorialDirector.start();
    let count = 0;
    const unsub = tutorialDirector.subscribe(() => { count++; });
    tutorialDirector.advance();
    tutorialDirector.advance();
    expect(count).toBe(2);
    unsub();
    tutorialDirector.advance();
    expect(count).toBe(2);
  });

  it('every step references a valid scene key', () => {
    const valid = new Set(Object.values(SCENE_KEYS));
    for (const step of TUTORIAL_STEPS) {
      expect(valid.has(step.scene as (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS])).toBe(true);
    }
  });

  it('routes through the shop (relic + 2 elements) before the forge', () => {
    const ids = TUTORIAL_STEPS.map(s => s.id);
    // The shop visit is gated between placing the subtile and opening the forge,
    // so the player has elements to craft with by the time they reach it.
    const order = ['place-subtile', 'shop-intro', 'shop-buy-relic',
                   'shop-buy-elements', 'shop-leave', 'forge-intro', 'forge-craft'];
    const positions = order.map(id => ids.indexOf(id));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // The three in-shop steps live on the Shop scene.
    for (const id of ['shop-buy-relic', 'shop-buy-elements', 'shop-leave']) {
      expect(TUTORIAL_STEPS.find(s => s.id === id)?.scene).toBe(SCENE_KEYS.SHOP);
    }
  });

  describe('snapshot / restore (run-save persistence)', () => {
    it('snapshot captures the active flag and current step index', () => {
      tutorialDirector.start();
      tutorialDirector.advanceIfMatches('welcome'); // → pick-warrior (index 1)
      const snap = tutorialDirector.snapshot();
      expect(snap.active).toBe(true);
      expect(snap.stepIndex).toBe(1);
      expect(TUTORIAL_STEPS[snap.stepIndex].id).toBe('pick-warrior');
    });

    it('snapshot of an inactive director is inactive at index -1', () => {
      expect(tutorialDirector.snapshot()).toEqual({ active: false, stepIndex: -1 });
    });

    it('restore resumes at the saved step (simulates reload + Continue)', () => {
      // Walk to an arbitrary mid-tutorial step and snapshot it.
      tutorialDirector.start();
      tutorialDirector.advanceIfMatches('welcome');
      tutorialDirector.advanceIfMatches('pick-warrior');
      const snap = tutorialDirector.snapshot(); // deck-review (index 2)
      expect(TUTORIAL_STEPS[snap.stepIndex].id).toBe('deck-review');

      // Reload wipes the in-memory singleton; the menu blindly restarts it.
      tutorialDirector.complete();
      tutorialDirector.start();
      expect(tutorialDirector.getCurrentStep()?.id).toBe('welcome');

      // Continue restores from the saved run → back to deck-review.
      tutorialDirector.restore(snap);
      expect(tutorialDirector.isActive()).toBe(true);
      expect(tutorialDirector.getCurrentStep()?.id).toBe('deck-review');
    });

    it('restore deactivates for missing, inactive, or out-of-range snapshots', () => {
      tutorialDirector.start();
      tutorialDirector.restore(undefined); // legacy save with no tutorial field
      expect(tutorialDirector.isActive()).toBe(false);

      tutorialDirector.start();
      tutorialDirector.restore({ active: false, stepIndex: 3 });
      expect(tutorialDirector.isActive()).toBe(false);

      tutorialDirector.start();
      tutorialDirector.restore({ active: true, stepIndex: TUTORIAL_STEPS.length });
      expect(tutorialDirector.isActive()).toBe(false);
    });
  });
});
