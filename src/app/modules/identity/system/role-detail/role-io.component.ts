import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { BaseEditorComponent } from '@core/base/base-editor.component';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
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
} from '@api/identity/models/identity.dto';
import { AuthorizationRefresh } from '@api/identity/services/authorization-refresh.service';
import { CapabilitiesService } from '@api/identity/services/capabilities.service';
import { RolesService } from '@api/identity/services/roles.service';

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
export class RoleIo extends BaseEditorComponent<RoleDto> implements OnInit {
  // System variables
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
    private readonly rolesService: RolesService,
    private readonly capabilitiesService: CapabilitiesService,
    private readonly authorizationRefresh: AuthorizationRefresh,
    private readonly fb: FormBuilder,
  ) {
    super();
    this.form = this.fb.nonNullable.group({
      name: ['', requiredName(256)],
      description: [''],
    });
  }

  override ngOnInit(): void {
    if (this.route.snapshot.fragment === 'permissions') this.section.set('permissions');
    super.ngOnInit();
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

  savePermissions(): void {
    const role = this.record();
    if (!role || !this.canWrite() || this.saving() || !this.ready()) return;
    const snapshot = this.selected();
    this.notice.set('');
    this.write(
      this.authorizationRefresh.after(
        this.rolesService
          .savePermissions(role.id, role.version, permissionPairs(this.functionsState(), snapshot))
          .pipe(switchMap(() => this.rolesService.role(role.id))),
      ),
    ).subscribe((saved) => {
      this.record.set(saved);
      this.baseline.set(snapshot);
      this.notice.set('Đã lưu thay đổi.');
    });
  }

  protected fetchRecord(id: string | null): Observable<RoleDto | null> {
    this.notice.set('');
    if (id === null) return of(null);
    return this.rolesService.role(id).pipe(
      switchMap((role) =>
        forkJoin({
          functions: this.rolesService.rolePermissions(id),
          groups: this.capabilitiesService.groups(),
        }).pipe(
          tap(({ functions, groups }) => {
            this.functionsState.set(functions);
            this.groupsState.set(groups);
            const selection = new Set(
              functions.flatMap((f) =>
                f.actionDtos.filter((a) => a.selected).map((a) => permissionKey(f.id, a.id)),
              ),
            );
            this.selected.set(selection);
            this.baseline.set(selection);
          }),
          map(() => role),
        ),
      ),
    );
  }

  /** `null` is the blank editor shown while loading and for a new role: it has no matrix yet. */
  protected hydrate(record: RoleDto | null): void {
    if (!record) {
      this.functionsState.set([]);
      this.groupsState.set([]);
      this.selected.set(new Set());
      this.baseline.set(new Set());
    }
    this.form.reset(
      { name: record?.name ?? '', description: record?.description ?? '' },
      { emitEvent: false },
    );
  }

  protected persist(record: RoleDto | null): Observable<RoleDto> {
    const value = this.form.getRawValue();
    this.notice.set('');
    return this.authorizationRefresh.after(
      this.rolesService
        .saveRole(record?.id ?? null, {
          name: value.name.trim(),
          description: value.description.trim() || null,
          version: record?.version,
        })
        .pipe(switchMap((id) => this.rolesService.role(id))),
    );
  }

  protected canWriteRecord(record: RoleDto | null): boolean {
    return this.session.isCentralAdmin() && this.session.can('Role', record ? 'Update' : 'Create');
  }

  protected override extraDirty(): boolean {
    return this.permissionsDirty();
  }

  protected override afterSaved(saved: RoleDto, wasNew: boolean): void {
    this.notice.set('Đã lưu thay đổi.');
    if (wasNew) this.openCreated(['/admin/system/roles', saved.id], 'permissions');
  }
}
