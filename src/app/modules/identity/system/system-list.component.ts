import { Component, DestroyRef, HostListener, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  FunctionGroupDto,
  FunctionGroupRequest,
  SYSTEM_SECTIONS,
  SystemKind,
  SystemRow,
} from '@api/identity/models/identity.dto';
import { readSystemListQuery, systemListQueryParams } from '@api/identity/models/identity.util';
import { CapabilitiesService } from '@api/identity/services/capabilities.service';
import { RolesService } from '@api/identity/services/roles.service';
import { UsersService } from '@api/identity/services/users.service';

const requiredName = (length: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(length),
];

@Component({
  selector: 'app-system-list',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './system-list.component.html',
})
export class SystemList implements OnInit {
  // System variables
  private request: Subscription | undefined;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly searchTerm = signal('');
  readonly page = signal(1);

  // Business variables
  readonly kind = signal<SystemKind>('roles');
  readonly records = signal<readonly SystemRow[]>([]);
  readonly groups = signal<readonly FunctionGroupDto[]>([]);
  readonly total = signal(0);
  readonly deleteTarget = signal<SystemRow | null>(null);
  readonly deleteGroupTarget = signal<FunctionGroupDto | null>(null);
  readonly groupOpen = signal(false);
  readonly groupTarget = signal<FunctionGroupDto | null>(null);
  readonly groupForm: FormGroup<{
    code: FormControl<string>;
    name: FormControl<string>;
    sortOrder: FormControl<number>;
  }>;

  readonly section = computed(() => SYSTEM_SECTIONS[this.kind()]);
  readonly canCreate = computed(() => this.allowed('Create'));
  readonly canUpdate = computed(() => this.allowed('Update'));
  readonly canDelete = computed(() => this.kind() !== 'users' && this.allowed('Delete'));
  readonly canExport = computed(
    () =>
      this.kind() === 'users' &&
      this.session.isCentralAdmin() &&
      (this.session.can('User', 'Export') || this.session.can('User', 'View')),
  );
  readonly rows = computed(() =>
    this.kind() === 'users'
      ? this.records()
      : this.records().slice((this.page() - 1) * 10, this.page() * 10),
  );
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / 10)));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly session: AuthSession,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly capabilitiesService: CapabilitiesService,
    private readonly fb: FormBuilder,
    public readonly confirmation: LeaveConfirmation,
  ) {
    this.groupForm = this.fb.nonNullable.group({
      code: ['', [Validators.required, Validators.pattern(/^[a-z0-9_-]{1,100}$/iu)]],
      name: ['', requiredName(100)],
      sortOrder: [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)]],
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = readSystemListQuery(params);
      this.searchTerm.set(query.q);
      this.load(this.route.snapshot.data['kind'] as SystemKind, query.q, query.page);
    });
  }

  load(kind: SystemKind, query = '', page = 1): void {
    this.request?.unsubscribe();
    this.kind.set(kind);
    this.searchTerm.set(query);
    this.page.set(page);
    this.error.set('');
    this.loading.set(true);
    if (!this.allowed('View')) {
      this.records.set([]);
      this.loading.set(false);
      return;
    }
    const list: Observable<readonly SystemRow[]> =
      kind === 'roles'
        ? this.rolesService.roles()
        : kind === 'functions'
          ? this.capabilitiesService.functions()
          : this.capabilitiesService.actions();
    const source: Observable<{ rows: readonly SystemRow[]; total: number }> =
      kind === 'users'
        ? this.usersService.searchUsers(query, page).pipe(
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
      groups: kind === 'functions' ? this.capabilitiesService.groups() : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ result, groups }) => {
          this.records.set(result.rows);
          this.total.set(result.total);
          this.groups.set(groups);
          this.page.set(Math.min(page, this.pageCount()));
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(normalizeApiError(err).message);
          this.records.set([]);
          this.loading.set(false);
        },
      });
  }

  reload(): void {
    this.load(this.kind(), this.searchTerm(), this.page());
  }

  search(value: string): void {
    this.navigate(value, 1);
  }

  setPage(page: number): void {
    this.navigate(this.searchTerm(), page);
  }

  exportUsers(): void {
    if (this.exporting() || !this.canExport()) return;
    this.exporting.set(true);
    this.error.set('');
    this.usersService
      .exportUsers({ keyword: this.searchTerm() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.exporting.set(false)),
      )
      .subscribe({
        next: () => this.notice.set('Đã tải xuống tệp Excel người dùng.'),
        error: (err: unknown) => this.error.set(normalizeApiError(err).message),
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

  openGroups(): void {
    this.editGroup(null);
    this.groupOpen.set(true);
  }

  editGroup(group: FunctionGroupDto | null): void {
    this.groupTarget.set(group);
    this.groupForm.reset({
      code: group?.code ?? '',
      name: group?.name ?? '',
      sortOrder: group?.sortOrder ?? 0,
    });
    this.groupForm.enable();
    if (group) this.groupForm.controls.code.disable();
  }

  async chooseGroup(group: FunctionGroupDto | null): Promise<void> {
    if (await this.confirmation.request(this.groupForm.dirty, this.saving())) {
      this.editGroup(group);
    }
  }

  async closeGroups(): Promise<void> {
    if (await this.confirmLeave()) this.groupOpen.set(false);
  }

  saveGroup(): void {
    this.groupForm.markAllAsTouched();
    if (this.groupForm.invalid) return;
    const value = this.groupForm.getRawValue();
    const id = this.groupTarget()?.id ?? null;
    const request: FunctionGroupRequest = {
      ...value,
      name: value.name.trim(),
      version: this.groupTarget()?.version,
    };
    if (
      !this.session.isCentralAdmin() ||
      !this.session.can('Function', id ? 'Update' : 'Create') ||
      this.saving()
    ) {
      return;
    }
    this.write(this.capabilitiesService.saveGroup(id, request))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.reload();
        this.editGroup(saved);
      });
  }

  delete(): void {
    const group = this.deleteGroupTarget();
    const row = this.deleteTarget();
    if (group) {
      if (!this.allowed('Delete') || this.saving()) return;
      this.write(this.capabilitiesService.deleteGroup(group.id, group.version))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.deleteTarget.set(null);
          this.deleteGroupTarget.set(null);
          if (group.id === this.groupTarget()?.id) this.editGroup(null);
          this.reload();
        });
      return;
    }
    if (!row || !this.canDeleteRow(row) || this.saving()) return;
    const kind = this.kind();
    if (kind === 'users') return;
    this.write<string | void>(
      kind === 'roles'
        ? this.rolesService.deleteRole(row.id, row.version)
        : this.capabilitiesService.deleteCapability(kind, row.id, row.version),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.deleteTarget.set(null);
        this.deleteGroupTarget.set(null);
        this.reload();
      });
  }

  closeDelete(): void {
    if (!this.saving()) {
      this.deleteTarget.set(null);
      this.deleteGroupTarget.set(null);
    }
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.groupOpen() && this.groupForm.dirty, this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if ((this.groupOpen() && this.groupForm.dirty) || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private allowed(action: string): boolean {
    return this.session.isCentralAdmin() && this.session.can(this.section().functionCode, action);
  }

  private write<T>(request: Observable<T>): Observable<T> {
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    return request.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((saved) =>
        this.session.authorizationChanged().pipe(
          catchError(() => of(undefined)),
          map(() => saved),
        ),
      ),
      tap(() => this.notice.set('Đã lưu thay đổi.')),
      catchError((err: unknown) => {
        this.error.set(normalizeApiError(err).message);
        return EMPTY;
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  private navigate(q: string, page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: systemListQueryParams({ q, page }),
      replaceUrl: true,
    });
  }
}
