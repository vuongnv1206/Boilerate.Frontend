import { DestroyRef, Inject, Injectable, effect, signal } from '@angular/core';
import type { HubConnection } from '@microsoft/signalr';
import { Subject, firstValueFrom } from 'rxjs';
import { AuthSession } from '../auth/auth-session';
import { RuntimeConfig } from '../config/runtime-config';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';

interface RealtimeNotificationPush {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly type: number;
  readonly actionUrl?: string | null;
  readonly createdOn: string;
}

/**
 * Manages the authenticated SignalR connection to `/hubs/notifications`.
 * Connects automatically when `AuthSession.signedIn()` is true and disconnects cleanly on logout.
 * Fails silently when running in offline/mocked test environments.
 */
@Injectable({ providedIn: 'root' })
export class SignalRClientService {
  // System variables
  private readonly incomingSubject = new Subject<RealtimeNotificationPush>();
  private connection: HubConnection | null = null;
  private activeSessionId: string | null = null;

  // Business variables
  readonly connected = signal(false);
  readonly notifications$ = this.incomingSubject.asObservable();

  constructor(
    private readonly session: AuthSession,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    destroyRef: DestroyRef,
  ) {
    effect(() => {
      const signedIn = this.session.signedIn();
      const sid = this.session.sessionId();
      if (signedIn && sid) {
        if (this.activeSessionId !== sid) {
          void this.reconnect(sid);
        }
      } else {
        void this.disconnect();
      }
    });
    destroyRef.onDestroy(() => {
      void this.disconnect();
      this.incomingSubject.complete();
    });
  }

  private async reconnect(sessionId: string): Promise<void> {
    await this.disconnect();
    if (typeof WebSocket === 'undefined' && typeof fetch === 'undefined') return;
    this.activeSessionId = sessionId;

    const { HubConnectionBuilder, HubConnectionState, LogLevel } =
      await import('@microsoft/signalr');
    if (this.activeSessionId !== sessionId) return;

    const hubUrl = resolveHubUrl(this.config.apiBaseUrl, 'notifications');
    const hub = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const current = this.session.accessToken();
          if (current) return current;
          try {
            return await firstValueFrom(this.session.refresh());
          } catch {
            return '';
          }
        },
      })
      .withAutomaticReconnect([2000, 5000, 15000, 30000])
      .configureLogging(LogLevel.None)
      .build();

    hub.on('ReceiveNotification', (payload: RealtimeNotificationPush) => {
      if (payload && typeof payload.id === 'string') {
        this.incomingSubject.next(payload);
      }
    });
    hub.onreconnected(() => this.connected.set(true));
    hub.onreconnecting(() => this.connected.set(false));
    hub.onclose(() => this.connected.set(false));

    this.connection = hub;
    try {
      await hub.start();
      if (this.connection === hub && hub.state === HubConnectionState.Connected) {
        this.connected.set(true);
      }
    } catch {
      this.connected.set(false);
    }
  }

  private async disconnect(): Promise<void> {
    this.activeSessionId = null;
    this.connected.set(false);
    const current = this.connection;
    this.connection = null;
    if (current) {
      try {
        await current.stop();
      } catch {
        /* Ignore stop errors on teardown */
      }
    }
  }
}

function resolveHubUrl(apiBaseUrl: string, hubName: string): string {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/u, '');
  const root = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  return `${root}/hubs/${hubName}`;
}
