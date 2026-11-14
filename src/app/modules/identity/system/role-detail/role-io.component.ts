import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, distinctUntilChanged, finalize, forkJoin, map, switchMap } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CapabilityDto,
  FunctionDto,
  FunctionGroupDto,
  RoleDto,
  RolePermissionGroupView,
  RoleSectionTab,
} from '@api/identity/models/identity.dto';
import {
  actionKeys,
  groupActions,
  matchingFunctions,
  permissionKey,
  permissionPairs,
} from '@api/identity/models/identity.util';
import { AuthorizationRefresh } from '@api/identity/services/authorization-refresh.service';
import { CapabilitiesService } from '@api/identity/services/capabilities.service';
import { RolesService } from '@api/identity/services/roles.service';

@Component({
  selector: 'app-role-io',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './role-io.component.html',
})
export class RoleIo extends BaseComponent implements OnInit {
  // System variables
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly notice = signal('');
  private loadRequest?: Subscription;

  // Business variables
  readonly record = signal<RoleDto | null>(null);
  readonly form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
  }>;
  readonly canWrite = computed(
    () =>
      this.session.isCentralAdmin() &&
      this.session.can('Role', this.record() ? 'Update' : 'Create'),
  );

  // Permission matrix: `selected` is what the user ticked, `baseline` is what the server has.
  private readonly functions = signal<readonly FunctionDto[]>([]);
  private readonly functionGroups = signal<readonly FunctionGroupDto[]>([]);
  private readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  readonly section = signal<RoleSectionTab>('info');
  readonly keyword = signal('');
  readonly collapsed = signal<ReadonlySet<string>>(new Set());

  readonly permissionsDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((key) => !this.baseline().has(key)),
  );
  readonly groups = computed<readonly RolePermissionGroupView[]>(() => {
    const visible = matchingFunctions(this.functions(), this.keyword());
    return this.functionGroups()
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
    private readonly rolesService: RolesService,
    private readonly capabilitiesService: CapabilitiesService,
    private readonly authorizationRefresh: AuthorizationRefresh,
    private readonly fb: FormBuilder,
    readonly confirmation: LeaveConfirmation,
  ) {
    super();
    this.form = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.pattern(/\S/u), Validators.maxLength(256)]],
      description: [''],
    });
  }

  ngOnInit(): void {
    if (this.route.snapshot.fragment === 'permissions') this.section.set('permissions');
    // `new` has no `:id`; opening another role reuses this screen and loads again.
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.loadDetail(id));
  }

  loadDetail(id: string | null): void {
    this.loadRequest?.unsubscribe();
    this.errorMessage.set('');
    this.notice.set('');
    this.ready.set(false);
    this.showRole(null, [], []);
    if (id === null) {
      this.ready.set(true);
      return;
    }
    this.loading.set(true);
    this.loadRequest = forkJoin({
      role: this.rolesService.role(id),
      functions: this.rolesService.rolePermissions(id),
      groups: this.capabilitiesService.groups(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ role, functions, groups }) => {
          this.showRole(role, functions, groups);
          this.ready.set(true);
        },
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.loadDetail(this.route.snapshot.paramMap.get('id'));
  }

  saveChange(): void {
    if (!this.ready() || !this.canWrite() || this.saving()) return;
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const current = this.record();
    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      version: current?.version,
    };
    this.startSaving();
    this.authorizationRefresh
      .after(
        this.rolesService
          .saveRole(current?.id ?? null, request)
          .pipe(switchMap((id) => this.rolesService.role(id))),
      )
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.record.set(saved);
          this.form.reset({ name: saved.name, description: saved.description ?? '' });
          this.notice.set('Đã lưu thay đổi.');
          if (!current) {
            // A new role continues on its own URL, at the permission matrix.
            void this.router.navigate(['/admin/system/roles', saved.id], {
              replaceUrl: true,
              queryParamsHandling: 'preserve',
              fragment: 'permissions',
            });
          }
        },
        // The form is left as typed, also on 409: the user decides whether to reload.
        error: (error: unknown) => {
          const apiError = normalizeApiError(error);
          applyServerErrors(this.form, apiError.fieldErrors);
          this.errorMessage.set(apiError.message);
        },
      });
  }

  savePermissions(): void {
    const role = this.record();
    if (!role || !this.ready() || !this.canWrite() || this.saving()) return;
    const snapshot = this.selected();
    this.startSaving();
    this.authorizationRefresh
      .after(
        this.rolesService
          .savePermissions(role.id, role.version, permissionPairs(this.functions(), snapshot))
          .pipe(switchMap(() => this.rolesService.role(role.id))),
      )
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.record.set(saved);
          this.baseline.set(snapshot);
          this.notice.set('Đã lưu thay đổi.');
        },
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  /** Asked by `unsavedChangesGuard` before leaving, and before reloading the role. */
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

  checked(functionId: string, actionId: string): boolean {
    return this.selected().has(permissionKey(functionId, actionId));
  }

  /** A permission that is no longer active can be removed, but not granted again. */
  selectable(f: FunctionDto, action: CapabilityDto): boolean {
    return (f.isActive && action.isActive) || this.baseline().has(permissionKey(f.id, action.id));
  }

  toggle(f: FunctionDto, action: CapabilityDto, checked: boolean): void {
    if (!this.canWrite() || this.saving() || !this.ready()) return;
    if (checked && !this.selectable(f, action)) return;
    const selected = new Set(this.selected());
    if (checked) selected.add(permissionKey(f.id, action.id));
    else selected.delete(permissionKey(f.id, action.id));
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
    this.collapsed.set(new Set(expand ? [] : this.functionGroups().map((group) => group.id)));
  }

  toggleGroup(id: string): void {
    const collapsed = new Set(this.collapsed());
    if (collapsed.has(id)) collapsed.delete(id);
    else collapsed.add(id);
    this.collapsed.set(collapsed);
  }

  private showRole(
    role: RoleDto | null,
    functions: readonly FunctionDto[],
    groups: readonly FunctionGroupDto[],
  ): void {
    this.record.set(role);
    this.form.reset({ name: role?.name ?? '', description: role?.description ?? '' });
    if (this.canWrite()) this.form.enable();
    else this.form.disable();

    const granted = new Set(
      functions.flatMap((f) =>
        f.actionDtos.filter((a) => a.selected).map((a) => permissionKey(f.id, a.id)),
      ),
    );
    this.functions.set(functions);
    this.functionGroups.set(groups);
    this.selected.set(granted);
    this.baseline.set(granted);
  }

  private startSaving(): void {
    this.saving.set(true);
    this.errorMessage.set('');
    this.notice.set('');
  }
}
