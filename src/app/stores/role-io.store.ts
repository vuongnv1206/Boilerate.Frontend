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
import { createRoleForm } from '@forms/system.form';
import { CapabilityDto, FunctionDto, FunctionGroupDto, RoleDto } from '@models/system.dto';
import { SystemAdministrationService } from '@services/system-administration.service';
import {
  actionKeys,
  groupActions,
  matchingFunctions,
  permissionKey,
  permissionPairs,
} from '@utils/permission-selection.util';

@Injectable()
export class RoleIoStore {
  private readonly service = inject(SystemAdministrationService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | undefined;
  private generation = 0;
  private revision = 0;
  private formState: ReturnType<typeof createRoleForm> | null = null;
  private readonly roleState = signal<RoleDto | null>(null);
  private readonly functionsState = signal<readonly FunctionDto[]>([]);
  private readonly groupsState = signal<readonly FunctionGroupDto[]>([]);
  private readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  private readonly loadingState = signal(false);
  private readonly readyState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  readonly keyword = signal('');
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  readonly record = this.roleState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
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
  readonly groups = computed(() => {
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
      .filter((group) => group.functions.length);
  });
  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }
  setForm(form: ReturnType<typeof createRoleForm>): void {
    this.formState = form;
    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.revision++);
  }
  load(id: string): void {
    this.request?.unsubscribe();
    const generation = ++this.generation;
    this.loadingState.set(false);
    this.roleState.set(null);
    this.readyState.set(false);
    this.errorState.set('');
    this.noticeState.set('');
    this.functionsState.set([]);
    this.groupsState.set([]);
    this.selected.set(new Set());
    this.baseline.set(new Set());
    if (id === 'new') {
      this.hydrateForm();
      this.readyState.set(true);
      return;
    }
    this.loadingState.set(true);
    this.request = this.service
      .role(id)
      .pipe(
        switchMap((role) =>
          forkJoin({
            role: of(role),
            functions: this.service.rolePermissions(id),
            groups: this.service.groups(),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ role, functions, groups }) => {
          if (generation !== this.generation) return;
          this.roleState.set(role);
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
          this.readyState.set(true);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation === this.generation) {
            this.errorState.set(normalizeApiError(error).message);
            this.loadingState.set(false);
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
  saveInfo(): Observable<RoleDto> {
    return defer(() => {
      const form = this.formState;
      if (!form || !this.canWrite() || this.saving() || !this.ready()) return EMPTY;
      form.markAllAsTouched();
      if (form.invalid) return EMPTY;
      const role = this.record();
      const value = form.getRawValue();
      const revision = this.revision;
      return this.write(
        this.service
          .saveRole(role?.id ?? null, {
            name: value.name.trim(),
            description: value.description.trim() || null,
            version: role?.version,
          })
          .pipe(switchMap((id) => this.service.role(id))),
      ).pipe(
        tap((saved) => {
          this.roleState.set(saved);
          if (revision === this.revision) this.hydrateForm();
        }),
      );
    });
  }
  savePermissions(): Observable<RoleDto> {
    return defer(() => {
      const role = this.record();
      if (!role || !this.canWrite() || this.saving() || !this.ready()) return EMPTY;
      const snapshot = this.selected();
      return this.write(
        this.service
          .savePermissions(role.id, role.version, permissionPairs(this.functionsState(), snapshot))
          .pipe(switchMap(() => this.service.role(role.id))),
      ).pipe(
        tap((saved) => {
          this.roleState.set(saved);
          this.baseline.set(snapshot);
        }),
      );
    });
  }
  private hydrateForm(): void {
    this.formState?.reset(
      { name: this.record()?.name ?? '', description: this.record()?.description ?? '' },
      { emitEvent: false },
    );
    if (!this.canWrite()) this.formState?.disable({ emitEvent: false });
    else this.formState?.enable({ emitEvent: false });
  }
  private write<T>(request: Observable<T>): Observable<T> {
    const generation = this.generation;
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
      tap(() => {
        if (generation === this.generation) this.noticeState.set('Đã lưu thay đổi.');
      }),
      catchError((error: unknown) => {
        if (generation === this.generation) this.errorState.set(normalizeApiError(error).message);
        return EMPTY;
      }),
      finalize(() => {
        if (generation === this.generation) this.savingState.set(false);
      }),
    );
  }
}
