import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  defer,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SYSTEM_SECTIONS } from '@constants/system.constants';
import { SystemAdministrationService } from '@services/system-administration.service';
import { FunctionGroupDto, FunctionGroupRequest } from '@models/system.dto';
import { SystemKind, SystemRow } from '@models/system.model';

@Injectable()
export class SystemListStore {
  private readonly service = inject(SystemAdministrationService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | undefined;
  private readonly kindState = signal<SystemKind>('roles');
  private readonly records = signal<readonly SystemRow[]>([]);
  private readonly groupsState = signal<readonly FunctionGroupDto[]>([]);
  private readonly totalState = signal(0);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  private readonly queryState = signal('');
  private readonly pageState = signal(1);
  readonly kind = this.kindState.asReadonly();
  readonly section = computed(() => SYSTEM_SECTIONS[this.kind()]);
  readonly canCreate = computed(() => this.kind() !== 'users' && this.allowed('Create'));
  readonly canUpdate = computed(() => this.allowed('Update'));
  readonly canDelete = computed(() => this.kind() !== 'users' && this.allowed('Delete'));
  readonly groups = this.groupsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly rows = computed(() =>
    this.kind() === 'users'
      ? this.records()
      : this.records().slice((this.page() - 1) * 10, this.page() * 10),
  );
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / 10)));
  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }
  load(kind: SystemKind, query = '', page = 1): void {
    this.request?.unsubscribe();
    this.kindState.set(kind);
    this.queryState.set(query);
    this.pageState.set(page);
    this.errorState.set('');
    this.loadingState.set(true);
    if (!this.allowed('View')) {
      this.records.set([]);
      this.loadingState.set(false);
      return;
    }
    const list: Observable<readonly SystemRow[]> =
      kind === 'roles'
        ? this.service.roles()
        : kind === 'functions'
          ? this.service.functions()
          : this.service.actions();
    const source: Observable<{ rows: readonly SystemRow[]; total: number }> =
      kind === 'users'
        ? this.service.users(query, page).pipe(
            map((result) => ({
              rows: result.data.map((u) => ({
                ...u,
                name:
                  [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                  u.userName ||
                  u.email ||
                  u.id,
              })),
              total: result.totalCount,
            })),
          )
        : list.pipe(
            map((items) => {
              const rows = items.filter((item) =>
                `${item.name} ${'code' in item ? item.code : ''}`
                  .toLocaleLowerCase('vi')
                  .includes(query.toLocaleLowerCase('vi')),
              );
              return { rows, total: rows.length };
            }),
          );
    this.request = forkJoin({
      result: source,
      groups: kind === 'functions' ? this.service.groups() : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ result, groups }) => {
          this.records.set(result.rows);
          this.totalState.set(result.total);
          this.groupsState.set(groups);
          this.pageState.set(Math.min(page, this.pageCount()));
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.errorState.set(normalizeApiError(error).message);
          this.records.set([]);
          this.loadingState.set(false);
        },
      });
  }
  groupName(id: string | undefined): string {
    return this.groups().find((g) => g.id === id)?.name ?? '—';
  }
  canDeleteRow(row: SystemRow): boolean {
    if (!this.canDelete()) return false;
    if (this.kind() !== 'roles') return true;
    return !['ADMIN', 'BASIC'].includes(row.name.trim().toUpperCase());
  }
  delete(row: SystemRow): Observable<void> {
    return defer(() => {
      if (!this.canDeleteRow(row) || this.saving()) return EMPTY;
      const kind = this.kind();
      if (kind === 'users') return EMPTY;
      return this.write<string | void>(
        kind === 'roles'
          ? this.service.deleteRole(row.id, row.version)
          : this.service.deleteCapability(kind, row.id, row.version),
      ).pipe(
        map(() => undefined),
        tap(() => this.reload()),
      );
    });
  }
  saveGroup(id: string | null, request: FunctionGroupRequest): Observable<FunctionGroupDto> {
    return defer(() =>
      !this.session.isCentralAdmin() ||
      !this.session.can('Function', id ? 'Update' : 'Create') ||
      this.saving()
        ? EMPTY
        : this.write(this.service.saveGroup(id, request)).pipe(tap(() => this.reload())),
    );
  }
  deleteGroup(group: FunctionGroupDto): Observable<void> {
    return defer(() =>
      !this.allowed('Delete') || this.saving()
        ? EMPTY
        : this.write(this.service.deleteGroup(group.id, group.version)).pipe(
            tap(() => this.reload()),
          ),
    );
  }
  reload(): void {
    this.load(this.kind(), this.queryState(), this.page());
  }
  private allowed(action: string): boolean {
    return this.session.isCentralAdmin() && this.session.can(this.section().functionCode, action);
  }
  private write<T>(request: Observable<T>): Observable<T> {
    this.savingState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
    return request.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((saved) =>
        this.session.authorizationChanged().pipe(
          catchError(() => of(undefined)),
          map(() => saved),
        ),
      ),
      tap(() => this.noticeState.set('Đã lưu thay đổi.')),
      catchError((error: unknown) => {
        this.errorState.set(normalizeApiError(error).message);
        return EMPTY;
      }),
      finalize(() => this.savingState.set(false)),
    );
  }
}
