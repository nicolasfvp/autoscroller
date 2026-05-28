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
});
