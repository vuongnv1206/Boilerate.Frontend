import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { MediaService } from '@services/media.service';

/** Owns authenticated image requests and the lifetime of their in-memory object URLs. */
@Injectable()
export class MediaPreviewStore {
  private readonly service = inject(MediaService);
  private readonly session = inject(AuthSession);
  private readonly urls = signal<Readonly<Record<string, string>>>({});
  private readonly failures = signal<Readonly<Record<string, string>>>({});
  private readonly pending = signal<ReadonlySet<string>>(new Set());
  private readonly requests = new Map<string, Subscription>();
  private readonly wanted = new Set<string>();
  private generation = 0;

  constructor() {
    effect(() => {
      if (!this.session.signedIn()) untracked(() => this.clear());
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  load(ids: readonly string[]): void {
    if (!this.session.signedIn()) {
      this.clear();
      return;
    }
    const desired = new Set(ids.filter(Boolean));
    for (const id of this.wanted) {
      if (!desired.has(id)) this.release(id);
    }
    for (const id of desired) {
      this.wanted.add(id);
      if (!this.urls()[id] && !this.pending().has(id) && !this.failures()[id]) this.request(id);
    }
  }

  url(id: string | null | undefined): string | null {
    return id ? (this.urls()[id] ?? null) : null;
  }

  loading(id: string): boolean {
    return this.pending().has(id);
  }

  error(id: string): string {
    return this.failures()[id] ?? '';
  }

  reload(id: string): void {
    if (!this.wanted.has(id) || !this.session.signedIn() || this.pending().has(id)) return;
    this.release(id);
    this.wanted.add(id);
    this.request(id);
  }

  clear(): void {
    this.generation += 1;
    this.wanted.clear();
    for (const request of this.requests.values()) request.unsubscribe();
    this.requests.clear();
    for (const url of Object.values(this.urls())) URL.revokeObjectURL(url);
    this.urls.set({});
    this.failures.set({});
    this.pending.set(new Set());
  }

  private request(id: string): void {
    const generation = this.generation;
    const sessionVersion = this.session.getVersion();
    const request = new Subscription();
    this.requests.set(id, request);
    this.pending.update((pending) => new Set(pending).add(id));
    request.add(
      this.service
        .preview(id)
        .pipe(
          finalize(() => {
            if (this.requests.get(id) !== request) return;
            this.requests.delete(id);
            this.pending.update((pending) => {
              const next = new Set(pending);
              next.delete(id);
              return next;
            });
          }),
        )
        .subscribe({
          next: (blob) => {
            if (!this.isCurrent(id, generation, sessionVersion)) return;
            if (!['image/png', 'image/jpeg'].includes(blob.type)) {
              this.failures.update((errors) => ({ ...errors, [id]: 'Không thể xem tệp ảnh này.' }));
              return;
            }
            const url = URL.createObjectURL(blob);
            this.urls.update((urls) => ({ ...urls, [id]: url }));
          },
          error: (error: unknown) => {
            if (this.isCurrent(id, generation, sessionVersion)) {
              this.failures.update((errors) => ({
                ...errors,
                [id]: normalizeApiError(error).message,
              }));
            }
          },
        }),
    );
  }

  private isCurrent(id: string, generation: number, sessionVersion: number): boolean {
    return (
      this.generation === generation &&
      this.wanted.has(id) &&
      this.session.signedIn() &&
      this.session.getVersion() === sessionVersion
    );
  }

  private release(id: string): void {
    this.wanted.delete(id);
    this.requests.get(id)?.unsubscribe();
    this.requests.delete(id);
    const url = this.urls()[id];
    if (url) URL.revokeObjectURL(url);
    this.urls.update((urls) => {
      const next = { ...urls };
      delete next[id];
      return next;
    });
    this.failures.update((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });
  }
}
