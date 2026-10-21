import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Screen-scoped UI state. Never owns forms, requests or navigation. */
@Injectable()
export class LeaveConfirmation {
  readonly visible = signal(false);
  private pending: Promise<boolean> | undefined;
  private resolve: ((allowed: boolean) => void) | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.answer(false));
  }

  request(dirty: boolean, busy: boolean): boolean | Promise<boolean> {
    if (busy) return false;
    if (!dirty) return true;
    if (this.pending) return this.pending;
    this.visible.set(true);
    this.pending = new Promise<boolean>((resolve) => {
      this.resolve = resolve;
    });
    return this.pending;
  }

  answer(allowed: boolean): void {
    this.visible.set(false);
    this.resolve?.(allowed);
    this.resolve = undefined;
    this.pending = undefined;
  }
}
