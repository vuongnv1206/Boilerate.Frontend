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
  CapabilityKind,
  FunctionDto,
  FunctionGroupDto,
} from '../../models/identity.dto';
import { CapabilitiesService } from '../../services/capabilities.service';

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
export class CapabilityIo implements OnInit {
  // System variables
  private request: Subscription | undefined;
  private revision = 0;
  private generation = 0;
  readonly loading = signal(false);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  // Business variables
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  readonly form: FormGroup<{
    code: FormControl<string>;
    name: FormControl<string>;
    isActive: FormControl<boolean>;
    groupId: FormControl<string>;
  }>;
  readonly kind = signal<CapabilityKind>('functions');
  readonly record = signal<CapabilityDto | FunctionDto | null>(null);
  readonly groups = signal<readonly FunctionGroupDto[]>([]);
  readonly actions = signal<readonly CapabilityDto[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());

  readonly canWrite = computed(
    () =>
      this.session.isCentralAdmin() &&
      this.session.can(
        this.kind() === 'functions' ? 'Function' : 'Action',
        this.record() ? 'Update' : 'Create',
      ),
  );
  readonly actionsDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((id) => !this.baseline().has(id)),
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly capabilitiesService: CapabilitiesService,
    private readonly session: AuthSession,
    private readonly fb: FormBuilder,
    public readonly confirmation: LeaveConfirmation,
  ) {
    this.form = this.fb.nonNullable.group({
      code: ['', [Validators.required, Validators.pattern(/^[a-z0-9_-]{1,100}$/iu)]],
      name: ['', requiredName(100)],
      isActive: [true],
      groupId: [''],
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision += 1;
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.load(this.route.snapshot.data['kind'] as CapabilityKind, id));
  }

  load(kind: CapabilityKind, id: string): void {
    this.request?.unsubscribe();
    const generation = ++this.generation;
    this.kind.set(kind);
    this.record.set(null);
    this.ready.set(false);
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');
    this.selected.set(new Set());
    this.baseline.set(new Set());
    this.request = forkJoin({
      record: id === 'new' ? of(null) : this.capabilitiesService.capability(kind, id),
      groups: kind === 'functions' ? this.capabilitiesService.groups() : of([]),
      actions: kind === 'functions' ? this.capabilitiesService.actions() : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ record, groups, actions }) => {
          if (generation !== this.generation) return;
          this.record.set(record);
          this.groups.set(groups);
          this.actions.set(actions);
          const selected = new Set(
            record && 'actionDtos' in record
              ? record.actionDtos.filter((a) => a.selected).map((a) => a.id)
              : [],
          );
          this.selected.set(selected);
          this.baseline.set(selected);
          this.hydrate();
          this.ready.set(true);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          if (generation === this.generation) {
            this.loading.set(false);
            this.error.set(normalizeApiError(err).message);
          }
        },
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

  saveInfo(): void {
    if (!this.ready() || !this.canWrite() || this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const isNew = !this.record();
    const snapshot = this.form.getRawValue();
    const revision = this.revision;
    this.write(
      this.capabilitiesService.saveCapability(this.kind(), this.record()?.id ?? null, {
        code: snapshot.code,
        name: snapshot.name.trim(),
        isActive: snapshot.isActive,
        version: this.record()?.version,
        ...(this.kind() === 'functions' ? { groupId: snapshot.groupId } : {}),
      }),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.record.set(saved);
        if (revision === this.revision) this.hydrate();
        if (isNew && !this.form.dirty) {
          void this.router.navigate(['/admin/system', this.kind(), saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
        }
      });
  }

  saveActions(): void {
    const record = this.record();
    if (!record || this.kind() !== 'functions' || !this.canWrite() || this.saving()) return;
    const snapshot = this.selected();
    this.write(
      this.capabilitiesService.saveFunctionActions(record.id, record.version, [...snapshot]),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.record.set(saved);
        this.baseline.set(snapshot);
      });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) {
      this.load(this.kind(), this.route.snapshot.paramMap.get('id') ?? 'new');
    }
  }

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

  private hydrate(): void {
    const record = this.record();
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
    if (!this.canWrite()) this.form.disable({ emitEvent: false });
    else this.form.enable({ emitEvent: false });
    if (record) this.form.controls.code.disable({ emitEvent: false });
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
