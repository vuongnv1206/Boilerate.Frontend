import { DOCUMENT } from '@angular/common';
import { DestroyRef, Inject, Injectable } from '@angular/core';
import { Observable, defer, firstValueFrom, from } from 'rxjs';

export type SessionEvent = 'logout' | 'authorization-changed';

const SESSION_NAME = 'boilerate-session';

/** Keeps the tabs of one browser in step: a channel for session events, a lock for the cookie. */
@Injectable({ providedIn: 'root' })
export class SessionSync {
  private readonly channel: BroadcastChannel | null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    destroyRef: DestroyRef,
  ) {
    const view = this.document.defaultView;
    this.channel = view?.BroadcastChannel ? new view.BroadcastChannel(SESSION_NAME) : null;
    destroyRef.onDestroy(() => this.channel?.close());
  }

  /** Tells the other tabs. The sending tab does not receive its own event. */
  notify(event: SessionEvent): void {
    this.channel?.postMessage(event);
  }

  onEvent(handler: (event: SessionEvent) => void): void {
    if (!this.channel) return;
    this.channel.onmessage = (message: MessageEvent<unknown>) => {
      if (message.data === 'logout' || message.data === 'authorization-changed') {
        handler(message.data);
      }
    };
  }

  /** Runs one request at a time across tabs, so two tabs never rotate the refresh cookie together. */
  withLock<T>(request: () => Observable<T>): Observable<T> {
    const locks = this.document.defaultView?.navigator.locks;
    return locks
      ? defer(() => from(locks.request(SESSION_NAME, () => firstValueFrom(request()))))
      : defer(request);
  }
}
