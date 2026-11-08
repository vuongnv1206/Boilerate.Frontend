import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  readonly id: number;
  readonly tone: ToastTone;
  readonly message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly itemsSignal = signal<readonly ToastItem[]>([]);

  readonly items = this.itemsSignal.asReadonly();

  success(message: string, durationMs = 3600): void {
    this.show('success', message, durationMs);
  }

  error(message: string, durationMs = 5200): void {
    this.show('error', message, durationMs);
  }

  warning(message: string, durationMs = 4500): void {
    this.show('warning', message, durationMs);
  }

  info(message: string, durationMs = 3600): void {
    this.show('info', message, durationMs);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.itemsSignal.update((list) => list.filter((item) => item.id !== id));
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.itemsSignal.set([]);
  }

  private show(tone: ToastTone, message: string, durationMs: number): void {
    const text = message.trim();
    if (!text) return;
    const id = this.nextId++;
    this.itemsSignal.update((list) => [...list.slice(-3), { id, tone, message: text }]);
    if (durationMs > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), durationMs),
      );
    }
  }
}
