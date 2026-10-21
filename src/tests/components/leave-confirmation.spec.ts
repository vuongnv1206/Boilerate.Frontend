import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { LeaveConfirmation } from '@app/shared/ui/confirm-dialog/leave-confirmation';

describe('Leave confirmation lifecycle', () => {
  afterEach(() => TestBed.resetTestingModule());
  function controller(): LeaveConfirmation {
    TestBed.configureTestingModule({ providers: [LeaveConfirmation] });
    return TestBed.inject(LeaveConfirmation);
  }
  it('shares one pending decision, supports cancel and can ask again', async () => {
    const state = controller();
    const first = state.request(true, false);
    expect(state.request(true, false)).toBe(first);
    expect(state.visible()).toBe(true);
    state.answer(false);
    expect(await first).toBe(false);
    const next = state.request(true, false);
    state.answer(true);
    expect(await next).toBe(true);
  });
  it('blocks leaving during a write and resolves an abandoned dialog on destruction', async () => {
    const state = controller();
    expect(state.request(false, true)).toBe(false);
    expect(state.request(false, false)).toBe(true);
    const pending = state.request(true, false);
    TestBed.resetTestingModule();
    expect(await pending).toBe(false);
  });
});
