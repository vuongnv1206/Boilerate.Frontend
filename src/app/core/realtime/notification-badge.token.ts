import { DestroyRef, InjectionToken, Signal, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthSession } from '../auth/auth-session';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { ToastService } from '../feedback/toast.service';
import { ApiService } from '../http/api.service';
import { SignalRClientService } from './signalr-client.service';

export interface NotificationBadgeState {
  readonly unreadCount: Signal<number>;
  readonly liveVersion: Signal<number>;
  refresh(): void;
  decrement(amount?: number): void;
  clear(): void;
}

export const NOTIFICATION_BADGE = new InjectionToken<NotificationBadgeState>(
  'Notification badge state',
  {
    providedIn: 'root',
    factory: () => {
      const unreadCount = signal(0);
      const liveVersion = signal(0);
      const config = inject(RUNTIME_CONFIG, { optional: true });
      if (!config) {
        return {
          unreadCount: unreadCount.asReadonly(),
          liveVersion: liveVersion.asReadonly(),
          refresh(): void {
            /* No-op in isolated component tests without RuntimeConfig */
          },
          decrement(): void {
            /* No-op */
          },
          clear(): void {
            /* No-op */
          },
        };
      }

      const api = inject(ApiService);
      const session = inject(AuthSession);
      const signalR = inject(SignalRClientService);
      const toast = inject(ToastService);
      const destroyRef = inject(DestroyRef);

      effect(() => {
        if (!session.signedIn()) {
          unreadCount.set(0);
        }
      });

      signalR.notifications$.pipe(takeUntilDestroyed(destroyRef)).subscribe((push) => {
        unreadCount.update((count) => count + 1);
        liveVersion.update((version) => version + 1);
        toast.info(`${push.title}: ${push.message}`);
      });

      return {
        unreadCount: unreadCount.asReadonly(),
        liveVersion: liveVersion.asReadonly(),
        refresh(): void {
          if (!session.signedIn()) {
            unreadCount.set(0);
            return;
          }
          api
            .get<number | { readonly unreadCount?: number; readonly count?: number }>(
              'notifications/unread-count',
            )
            .pipe(takeUntilDestroyed(destroyRef))
            .subscribe({
              next: (res) => {
                const count = typeof res === 'number' ? res : (res.unreadCount ?? res.count ?? 0);
                unreadCount.set(Math.max(0, count));
              },
              error: () => undefined,
            });
        },
        decrement(amount = 1): void {
          unreadCount.update((count) => Math.max(0, count - amount));
        },
        clear(): void {
          unreadCount.set(0);
        },
      };
    },
  },
);
