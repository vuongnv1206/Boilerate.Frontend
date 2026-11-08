import { Component, DestroyRef, HostListener, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { LeaveConfirmation } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CapabilityDto,
  FunctionDto,
  FunctionGroupDto,
  RoleDto,
  RolePermissionGroupView,
  RoleSectionTab,
  actionKeys,
  groupActions,
  matchingFunctions,
  permissionKey,
  permissionPairs,
} from '../../models/identity.dto';
import { CapabilitiesService } from '../../services/capabilities.service';
import { RolesService } from '../../services/roles.service';

const requiredName = (length: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(length),
];

@Component({
  selector: 'app-role-io',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './role-io.component.html',
})
export class RoleIo implements OnInit {
  // System variables
  private request: Subscription | undefined;
  private generation = 0;
  private revision = 0;
  readonly loading = signal(false);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  // Business variables
  private readonly functionsState = signal<readonly FunctionDto[]>([]);
  private readonly groupsState = signal<readonly FunctionGroupDto[]>([]);
  private readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  readonly form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
  }>;
  readonly section = signal<RoleSectionTab>('info');
  readonly keyword = signal('');
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  readonly record = signal<RoleDto | null>(null);

  readonly canWrite = computed(
    () =>
      this.session.isCentralAdmin() &&
      this.session.can('Role', this.record() ? 'Update' : 'Create'),
  );
  readonly permissionsDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((key) => !this.baseline().has(key)),
  );
  readonly groups = computed<readonly RolePermissionGroupView[]>(() => {
    const visible = matchingFunctions(this.functionsState(), this.keyword());
    return this.groupsState()
      .map((group) => {
        const functions = visible.filter((f) => f.groupId === group.id);
        const keys = functions
          .filter((f) => f.isActive)
          .flatMap((f) =>
            f.actionDtos.filter((a) => a.isActive).map((a) => permissionKey(f.id, a.id)),
          );
        return {
          ...group,
          functions,
          actions: groupActions(functions),
          total: keys.length,
          count: keys.filter((key) => this.selected().has(key)).length,
        };
      })
      .filter((group) => group.functions.length > 0);
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly rolesService: RolesService,
    private readonly capabilitiesService: CapabilitiesService,
    private readonly session: AuthSession,
    private readonly fb: FormBuilder,
    public readonly confirmation: LeaveConfirmation,
  ) {
    this.form = this.fb.nonNullable.group({
      name: ['', requiredName(256)],
      description: [''],
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    if (this.route.snapshot.fragment === 'permissions') this.section.set('permissions');
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision += 1;
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.load(id));
  }

  load(id: string): void {
    this.request?.unsubscribe();
    const generation = ++this.generation;
    this.loading.set(false);
    this.record.set(null);
    this.ready.set(false);
    this.error.set('');
    this.notice.set('');
    this.functionsState.set([]);
    this.groupsState.set([]);
    this.selected.set(new Set());
    this.baseline.set(new Set());
    if (id === 'new') {
      this.hydrateForm();
      this.ready.set(true);
      return;
    }
    this.loading.set(true);
    this.request = this.rolesService
      .role(id)
      .pipe(
        switchMap((role) =>
          forkJoin({
            role: of(role),
            functions: this.rolesService.rolePermissions(id),
            groups: this.capabilitiesService.groups(),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ role, functions, groups }) => {
          if (generation !== this.generation) return;
          this.record.set(role);
          this.functionsState.set(functions);
          this.groupsState.set(groups);
          const selection = new Set(
            functions.flatMap((f) =>
              f.actionDtos.filter((a) => a.selected).map((a) => permissionKey(f.id, a.id)),
            ),
          );
          this.selected.set(selection);
          this.baseline.set(selection);
          this.hydrateForm();
          this.ready.set(true);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          if (generation === this.generation) {
            this.error.set(normalizeApiError(err).message);
            this.loading.set(false);
          }
        },
      });
  }

  checked(functionId: string, actionId: string): boolean {
    return this.selected().has(permissionKey(functionId, actionId));
  }

  selectable(f: FunctionDto, action: CapabilityDto): boolean {
    return (f.isActive && action.isActive) || this.baseline().has(permissionKey(f.id, action.id));
  }

  toggle(f: FunctionDto, action: CapabilityDto, checked: boolean): void {
    if (!this.canWrite() || this.saving() || !this.ready()) return;
    const key = permissionKey(f.id, action.id);
    if (checked && (!f.isActive || !action.isActive) && !this.baseline().has(key)) return;
    const selected = new Set(this.selected());
    if (checked) selected.add(key);
    else selected.delete(key);
    this.selected.set(selected);
  }

  bulkState(functions: readonly FunctionDto[], actionId: string): 'none' | 'some' | 'all' {
    const keys = actionKeys(functions, actionId);
    const count = keys.filter((key) => this.selected().has(key)).length;
    return count && count === keys.length ? 'all' : count ? 'some' : 'none';
  }

  toggleBulk(functions: readonly FunctionDto[], actionId: string, checked: boolean): void {
    if (!this.canWrite() || this.saving() || !this.ready()) return;
    const selected = new Set(this.selected());
    for (const key of actionKeys(functions, actionId)) {
      if (checked) selected.add(key);
      else selected.delete(key);
    }
    this.selected.set(selected);
  }

  expandAll(expand: boolean): void {
    this.collapsed.set(new Set(expand ? [] : this.groupsState().map((group) => group.id)));
  }

  toggleGroup(id: string): void {
    const values = new Set(this.collapsed());
    if (values.has(id)) values.delete(id);
    else values.add(id);
    this.collapsed.set(values);
  }

  saveInfo(): void {
    if (!this.canWrite() || this.saving() || !this.ready()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const role = this.record();
    const isNew = !role;
    const value = this.form.getRawValue();
    const revision = this.revision;
    this.write(
      this.rolesService
        .saveRole(role?.id ?? null, {
          name: value.name.trim(),
          description: value.description.trim() || null,
          version: role?.version,
        })
        .pipe(switchMap((id) => this.rolesService.role(id))),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.record.set(saved);
        if (revision === this.revision) this.hydrateForm();
        if (isNew && !this.form.dirty) {
          void this.router.navigate(['/admin/system/roles', saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
            fragment: 'permissions',
          });
        }
      });
  }

  savePermissions(): void {
    const role = this.record();
    if (!role || !this.canWrite() || this.saving() || !this.ready()) return;
    const snapshot = this.selected();
    this.write(
      this.rolesService
        .savePermissions(role.id, role.version, permissionPairs(this.functionsState(), snapshot))
        .pipe(switchMap(() => this.rolesService.role(role.id))),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.record.set(saved);
        this.baseline.set(snapshot);
      });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.load(this.route.snapshot.paramMap.get('id') ?? 'new');
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty || this.permissionsDirty(), this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.permissionsDirty() || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private hydrateForm(): void {
    this.form.reset(
      { name: this.record()?.name ?? '', description: this.record()?.description ?? '' },
      { emitEvent: false },
    );
    if (!this.canWrite()) this.form.disable({ emitEvent: false });
    else this.form.enable({ emitEvent: false });
  }

  private write<T>(request: Observable<T>): Observable<T> {
    const generation = this.generation;
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
      tap(() => {
        if (generation === this.generation) this.notice.set('Đã lưu thay đổi.');
      }),
      catchError((err: unknown) => {
        if (generation === this.generation) this.error.set(normalizeApiError(err).message);
        return EMPTY;
      }),
      finalize(() => {
        if (generation === this.generation) this.saving.set(false);
      }),
    );
  }
}
