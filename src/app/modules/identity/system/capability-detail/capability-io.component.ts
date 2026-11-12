import { Component, HostListener, OnInit, Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, distinctUntilChanged, finalize, forkJoin, map, of } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CapabilityDto,
  CapabilityKind,
  FunctionDto,
  FunctionGroupDto,
} from '@api/identity/models/identity.dto';
import { AuthorizationRefresh } from '@api/identity/services/authorization-refresh.service';
import { CapabilitiesService } from '@api/identity/services/capabilities.service';

/** Editor for a function or an action; a function also maps the actions it supports. */
@Component({
  selector: 'app-capability-io',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './capability-io.component.html',
})
export class CapabilityIo extends BaseComponent implements OnInit {
  // System variables
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly notice = signal('');
  private loadRequest?: Subscription;

  // Business variables
  readonly kind: Signal<CapabilityKind>;
  readonly record = signal<CapabilityDto | FunctionDto | null>(null);
  readonly form: FormGroup<{
    code: FormControl<string>;
    name: FormControl<string>;
    isActive: FormControl<boolean>;
    groupId: FormControl<string>;
  }>;
  readonly canWrite = computed(
    () =>
      this.session.isCentralAdmin() &&
      this.can(
        this.kind() === 'functions' ? 'Function' : 'Action',
        this.record() ? 'Update' : 'Create',
      ),
  );

  // Actions of a function: `selected` is what the user ticked, `baseline` is what the server has.
  readonly groups = signal<readonly FunctionGroupDto[]>([]);
  readonly actions = signal<readonly CapabilityDto[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  readonly actionsDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((id) => !this.baseline().has(id)),
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly capabilitiesService: CapabilitiesService,
    private readonly authorizationRefresh: AuthorizationRefresh,
    private readonly fb: FormBuilder,
    readonly confirmation: LeaveConfirmation,
  ) {
    super();
    const kind = this.route.snapshot.data['kind'] as CapabilityKind;
    this.kind = signal(kind);
    this.form = this.fb.nonNullable.group({
      code: ['', [Validators.required, Validators.pattern(/^[a-z0-9_-]{1,100}$/iu)]],
      name: ['', [Validators.required, Validators.pattern(/\S/u), Validators.maxLength(100)]],
      isActive: [true],
      groupId: ['', kind === 'functions' ? [Validators.required] : []],
    });
  }

  ngOnInit(): void {
    // `new` has no `:id`; opening another record reuses this screen and loads again.
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.loadDetail(id));
  }

  loadDetail(id: string | null): void {
    const isFunction = this.kind() === 'functions';
    this.loadRequest?.unsubscribe();
    this.errorMessage.set('');
    this.notice.set('');
    this.ready.set(false);
    this.loading.set(true);
    this.showRecord(null);
    this.loadRequest = forkJoin({
      record: id === null ? of(null) : this.capabilitiesService.capability(this.kind(), id),
      groups: isFunction ? this.capabilitiesService.groups() : of([]),
      actions: isFunction ? this.capabilitiesService.actions() : of([]),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ record, groups, actions }) => {
          this.groups.set(groups);
          this.actions.set(actions);
          this.showRecord(record);
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
    this.startSaving();
    this.authorizationRefresh
      .after(
        this.capabilitiesService.saveCapability(this.kind(), current?.id ?? null, {
          code: value.code,
          name: value.name.trim(),
          isActive: value.isActive,
          version: current?.version,
          ...(this.kind() === 'functions' ? { groupId: value.groupId } : {}),
        }),
      )
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          // Saving the form does not touch the action mapping; keep what the user ticked.
          const selected = this.selected();
          const baseline = this.baseline();
          this.showRecord(saved);
          this.selected.set(selected);
          this.baseline.set(baseline);
          this.notice.set('Đã lưu thay đổi.');
          if (!current) {
            void this.router.navigate(['/admin/system', this.kind(), saved.id], {
              replaceUrl: true,
              queryParamsHandling: 'preserve',
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

  saveActions(): void {
    const record = this.record();
    if (!record || this.kind() !== 'functions' || !this.canWrite() || this.saving()) return;
    const snapshot = this.selected();
    this.startSaving();
    this.authorizationRefresh
      .after(this.capabilitiesService.saveFunctionActions(record.id, record.version, [...snapshot]))
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

  /** An action that is no longer active can be removed, but not mapped again. */
  selectable(action: CapabilityDto): boolean {
    return action.isActive || this.baseline().has(action.id);
  }

  toggleAction(action: CapabilityDto, checked: boolean): void {
    if (!this.canWrite() || this.saving() || (checked && !this.selectable(action))) return;
    const selected = new Set(this.selected());
    if (checked) selected.add(action.id);
    else selected.delete(action.id);
    this.selected.set(selected);
  }

  /** Asked by `unsavedChangesGuard` before leaving, and before reloading the record. */
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty || this.actionsDirty(), this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.actionsDirty() || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private showRecord(record: CapabilityDto | FunctionDto | null): void {
    this.record.set(record);
    this.form.reset({
      code: record?.code ?? '',
      name: record?.name ?? '',
      isActive: record?.isActive ?? true,
      groupId: record && 'groupId' in record ? record.groupId : (this.groups()[0]?.id ?? ''),
    });
    if (this.canWrite()) this.form.enable();
    else this.form.disable();
    // The code is immutable once the record exists.
    if (record) this.form.controls.code.disable();

    const mapped = new Set(
      record && 'actionDtos' in record
        ? record.actionDtos.filter((a) => a.selected).map((a) => a.id)
        : [],
    );
    this.selected.set(mapped);
    this.baseline.set(mapped);
  }

  private startSaving(): void {
    this.saving.set(true);
    this.errorMessage.set('');
    this.notice.set('');
  }
}
