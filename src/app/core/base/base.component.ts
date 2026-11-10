import { DestroyRef, Directive, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize } from 'rxjs';
import { AuthSession } from '../auth/auth-session';
import { ToastService } from '../feedback/toast.service';
import { ApiError } from '../http/api-error';
import { normalizeApiError } from '../http/normalize-api-error';
import { IdempotentActionTracker } from '../http/operation-id';

export interface RunRequestOptions<T> {
  readonly busy?: WritableSignal<boolean>;
  readonly successMessage?: string;
  readonly toastOnError?: boolean;
  readonly onSuccess?: (result: T) => void;
  readonly onError?: (error: ApiError) => void;
}

/**
 * Lightweight base class for Pages & Panels (eco-fe style).
 * Provides busy/error signals, permission checks, normalized error handling
 * and OperationId idempotency.
 */
@Directive()
export abstract class BaseComponent {
  // System variables
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(AuthSession);
  protected readonly toast = inject(ToastService);
  private readonly idempotency = new IdempotentActionTracker();

  readonly loading = signal(false);
  readonly working = signal(false);
  readonly errorMessage = signal('');

  can(functionCode: string, actionCode: string): boolean {
    return this.session.can(functionCode, actionCode);
  }

  protected run<T>(source$: Observable<T>, options: RunRequestOptions<T> = {}): Subscription {
    const busySignal = options.busy ?? this.working;
    busySignal.set(true);
    this.loading.set(true);
    this.errorMessage.set('');
    return source$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          busySignal.set(false);
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          if (options.successMessage) this.toast.success(options.successMessage);
          options.onSuccess?.(result);
        },
        error: (rawError: unknown) => {
          const apiError = normalizeApiError(rawError);
          this.errorMessage.set(apiError.message);
          if (options.toastOnError) this.toast.error(apiError.message);
          options.onError?.(apiError);
        },
      });
  }

  protected runIdempotent<T>(
    actionKey: string,
    payload: unknown,
    factory: (operationId: string) => Observable<T>,
    options: RunRequestOptions<T> = {},
  ): Subscription {
    const operationId = this.idempotency.resolve(actionKey, payload);
    return this.run(factory(operationId), {
      ...options,
      onSuccess: (result) => {
        this.idempotency.clear(actionKey);
        options.onSuccess?.(result);
      },
      onError: (apiError) => {
        if (!['network', 'server', 'rate-limit'].includes(apiError.kind)) {
          this.idempotency.clear(actionKey);
        }
        options.onError?.(apiError);
      },
    });
  }

  protected resetOperationId(actionKey: string): void {
    this.idempotency.clear(actionKey);
  }
}
