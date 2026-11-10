import { Component, computed, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable, forkJoin, map, of, tap } from 'rxjs';
import { BaseEditorComponent } from '@core/base/base-editor.component';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CapabilityDto,
  CapabilityKind,
  FunctionDto,
  FunctionGroupDto,
} from '@api/identity/models/identity.dto';
import { AuthorizationRefresh } from '@api/identity/services/authorization-refresh.service';
import { CapabilitiesService } from '@api/identity/services/capabilities.service';

const requiredName = (length: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(length),
];

@Component({
  selector: 'app-capability-io',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './capability-io.component.html',
})
export class CapabilityIo extends BaseEditorComponent<CapabilityDto | FunctionDto> {
  // System variables
  readonly notice = signal('');

  // Business variables
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  readonly form: FormGroup<{
    code: FormControl<string>;
    name: FormControl<string>;
    isActive: FormControl<boolean>;
    groupId: FormControl<string>;
  }>;
  readonly kind = signal(this.route.snapshot.data['kind'] as CapabilityKind);
  readonly groups = signal<readonly FunctionGroupDto[]>([]);
  readonly actions = signal<readonly CapabilityDto[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());

  readonly actionsDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((id) => !this.baseline().has(id)),
  );

  constructor(
    private readonly capabilitiesService: CapabilitiesService,
    private readonly authorizationRefresh: AuthorizationRefresh,
    private readonly fb: FormBuilder,
  ) {
    super();
    this.form = this.fb.nonNullable.group({
      code: ['', [Validators.required, Validators.pattern(/^[a-z0-9_-]{1,100}$/iu)]],
      name: ['', requiredName(100)],
      isActive: [true],
      groupId: [''],
    });
  }

  toggleAction(action: CapabilityDto, checked: boolean): void {
    if (
      !this.canWrite() ||
      this.saving() ||
      (checked && !action.isActive && !this.baseline().has(action.id))
    ) {
      return;
    }
    const selected = new Set(this.selected());
    if (checked) selected.add(action.id);
    else selected.delete(action.id);
    this.selected.set(selected);
  }

  selectable(action: CapabilityDto): boolean {
    return action.isActive || this.baseline().has(action.id);
  }

  saveActions(): void {
    const record = this.record();
    if (!record || this.kind() !== 'functions' || !this.canWrite() || this.saving()) return;
    const snapshot = this.selected();
    this.notice.set('');
    this.write(
      this.authorizationRefresh.after(
        this.capabilitiesService.saveFunctionActions(record.id, record.version, [...snapshot]),
      ),
    ).subscribe((saved) => {
      this.record.set(saved);
      this.baseline.set(snapshot);
      this.notice.set('Đã lưu thay đổi.');
    });
  }

  protected fetchRecord(id: string | null): Observable<CapabilityDto | FunctionDto | null> {
    const kind = this.kind();
    this.notice.set('');
    return forkJoin({
      record: id === null ? of(null) : this.capabilitiesService.capability(kind, id),
      groups: kind === 'functions' ? this.capabilitiesService.groups() : of([]),
      actions: kind === 'functions' ? this.capabilitiesService.actions() : of([]),
    }).pipe(
      tap(({ record, groups, actions }) => {
        this.groups.set(groups);
        this.actions.set(actions);
        const selected = new Set(
          record && 'actionDtos' in record
            ? record.actionDtos.filter((a) => a.selected).map((a) => a.id)
            : [],
        );
        this.selected.set(selected);
        this.baseline.set(selected);
      }),
      map(({ record }) => record),
    );
  }

  /** `null` is the blank editor shown while loading and for a new record: nothing is mapped yet. */
  protected hydrate(record: CapabilityDto | FunctionDto | null): void {
    if (!record) {
      this.selected.set(new Set());
      this.baseline.set(new Set());
    }
    this.form.controls.groupId.setValidators(
      this.kind() === 'functions' ? Validators.required : [],
    );
    this.form.reset(
      {
        code: record?.code ?? '',
        name: record?.name ?? '',
        isActive: record?.isActive ?? true,
        groupId: record && 'groupId' in record ? record.groupId : (this.groups()[0]?.id ?? ''),
      },
      { emitEvent: false },
    );
  }

  protected persist(
    record: CapabilityDto | FunctionDto | null,
  ): Observable<CapabilityDto | FunctionDto> {
    const snapshot = this.form.getRawValue();
    this.notice.set('');
    return this.authorizationRefresh.after(
      this.capabilitiesService.saveCapability(this.kind(), record?.id ?? null, {
        code: snapshot.code,
        name: snapshot.name.trim(),
        isActive: snapshot.isActive,
        version: record?.version,
        ...(this.kind() === 'functions' ? { groupId: snapshot.groupId } : {}),
      }),
    );
  }

  protected canWriteRecord(record: CapabilityDto | FunctionDto | null): boolean {
    return (
      this.session.isCentralAdmin() &&
      this.session.can(
        this.kind() === 'functions' ? 'Function' : 'Action',
        record ? 'Update' : 'Create',
      )
    );
  }

  /** The code is immutable once the record exists. */
  protected override restrictControls(): void {
    if (this.record()) this.form.controls.code.disable({ emitEvent: false });
  }

  protected override extraDirty(): boolean {
    return this.actionsDirty();
  }

  protected override afterSaved(saved: CapabilityDto | FunctionDto, wasNew: boolean): void {
    this.notice.set('Đã lưu thay đổi.');
    if (wasNew) this.openCreated(['/admin/system', this.kind(), saved.id]);
  }
}
