import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  defer,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SystemUserDto, UserRoleDto } from '@models/system.dto';
import { SystemAdministrationService } from '@services/system-administration.service';

@Injectable()
export class UserRolesStore {
  private readonly service = inject(SystemAdministrationService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | undefined;
  private readonly recordState = signal<SystemUserDto | null>(null);
  private readonly rolesState = signal<readonly UserRoleDto[]>([]);
  private readonly selectedState = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  private readonly loadingState = signal(false);
  private readonly readyState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  readonly record = this.recordState.asReadonly();
  readonly roles = this.rolesState.asReadonly();
  readonly selected = this.selectedState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly canWrite = computed(
    () => this.session.isCentralAdmin() && this.session.can('User', 'Update'),
  );
  readonly dirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((id) => !this.baseline().has(id)),
  );
  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }
  load(id: string): void {
    this.request?.unsubscribe();
    this.readyState.set(false);
    this.loadingState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
    this.request = this.service
      .user(id)
      .pipe(
        switchMap((user) => this.service.userRoles(id).pipe(map((roles) => ({ user, roles })))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ user, roles }) => {
          this.recordState.set(user);
          this.rolesState.set(roles);
          const selected = new Set(roles.filter((r) => r.enabled).map((r) => r.roleId));
          this.selectedState.set(selected);
          this.baseline.set(selected);
          this.readyState.set(true);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.errorState.set(normalizeApiError(error).message);
          this.loadingState.set(false);
        },
      });
  }
  toggle(id: string, checked: boolean): void {
    if (!this.canWrite() || this.saving()) return;
    const values = new Set(this.selected());
    if (checked) values.add(id);
    else values.delete(id);
    this.selectedState.set(values);
  }
  save(): Observable<SystemUserDto> {
    return defer(() => {
      const user = this.record();
      if (!user || !this.ready() || !this.canWrite() || this.saving()) return EMPTY;
      const snapshot = this.selected();
      this.savingState.set(true);
      this.errorState.set('');
      this.noticeState.set('');
      return this.service.saveUserRoles(user.id, user.version, [...snapshot]).pipe(
        switchMap(() => this.service.user(user.id)),
        takeUntilDestroyed(this.destroyRef),
        tap((saved) => {
          this.recordState.set(saved);
          this.baseline.set(snapshot);
          this.noticeState.set('Đã lưu vai trò của người dùng.');
        }),
        switchMap((saved) =>
          this.session.authorizationChanged().pipe(
            catchError(() => of(undefined)),
            map(() => saved),
          ),
        ),
        catchError((error: unknown) => {
          this.errorState.set(normalizeApiError(error).message);
          return EMPTY;
        }),
        finalize(() => this.savingState.set(false)),
      );
    });
  }
}
