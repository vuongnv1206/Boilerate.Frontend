import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Validators } from '@angular/forms';
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
import { createCapabilityForm } from '@forms/system.form';
import { CapabilityDto, FunctionDto, FunctionGroupDto } from '@models/system.dto';
import { SystemAdministrationService } from '@services/system-administration.service';

@Injectable()
export class CapabilityIoStore {
  private readonly service = inject(SystemAdministrationService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | undefined;
  private revision = 0;
  private generation = 0;
  private formState: ReturnType<typeof createCapabilityForm> | null = null;
  private readonly kindState = signal<'functions' | 'actions'>('functions');
  private readonly recordState = signal<CapabilityDto | FunctionDto | null>(null);
  private readonly groupsState = signal<readonly FunctionGroupDto[]>([]);
  private readonly actionsState = signal<readonly CapabilityDto[]>([]);
  private readonly selection = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  private readonly loadingState = signal(false);
  private readonly readyState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  readonly kind = this.kindState.asReadonly();
  readonly record = this.recordState.asReadonly();
  readonly groups = this.groupsState.asReadonly();
  readonly actions = this.actionsState.asReadonly();
  readonly selected = this.selection.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
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
  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }
  setForm(form: ReturnType<typeof createCapabilityForm>): void {
    this.formState = form;
    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.revision++);
  }
  load(kind: 'functions' | 'actions', id: string): void {
    this.request?.unsubscribe();
    const generation = ++this.generation;
    this.kindState.set(kind);
    this.recordState.set(null);
    this.readyState.set(false);
    this.loadingState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
    this.selection.set(new Set());
    this.baseline.set(new Set());
    this.request = forkJoin({
      record: id === 'new' ? of(null) : this.service.capability(kind, id),
      groups: kind === 'functions' ? this.service.groups() : of([]),
      actions: kind === 'functions' ? this.service.actions() : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ record, groups, actions }) => {
          if (generation !== this.generation) return;
          this.recordState.set(record);
          this.groupsState.set(groups);
          this.actionsState.set(actions);
          const selected = new Set(
            record && 'actionDtos' in record
              ? record.actionDtos.filter((a) => a.selected).map((a) => a.id)
              : [],
          );
          this.selection.set(selected);
          this.baseline.set(selected);
          this.hydrate();
          this.readyState.set(true);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation === this.generation) {
            this.loadingState.set(false);
            this.errorState.set(normalizeApiError(error).message);
          }
        },
      });
  }
  toggleAction(action: CapabilityDto, checked: boolean): void {
    if (
      !this.canWrite() ||
      this.saving() ||
      (checked && !action.isActive && !this.baseline().has(action.id))
    )
      return;
    const selected = new Set(this.selected());
    if (checked) selected.add(action.id);
    else selected.delete(action.id);
    this.selection.set(selected);
  }
  selectable(action: CapabilityDto): boolean {
    return action.isActive || this.baseline().has(action.id);
  }
  saveInfo(): Observable<CapabilityDto | FunctionDto> {
    return defer(() => {
      const form = this.formState;
      if (!form || !this.ready() || !this.canWrite() || this.saving()) return EMPTY;
      form.markAllAsTouched();
      if (form.invalid) return EMPTY;
      const snapshot = form.getRawValue();
      const revision = this.revision;
      return this.write(
        this.service.saveCapability(this.kind(), this.record()?.id ?? null, {
          code: snapshot.code,
          name: snapshot.name.trim(),
          isActive: snapshot.isActive,
          version: this.record()?.version,
          ...(this.kind() === 'functions' ? { groupId: snapshot.groupId } : {}),
        }),
      ).pipe(
        tap((saved) => {
          this.recordState.set(saved);
          if (revision === this.revision) this.hydrate();
        }),
      );
    });
  }
  saveActions(): Observable<FunctionDto> {
    return defer(() => {
      const record = this.record();
      if (!record || this.kind() !== 'functions' || !this.canWrite() || this.saving()) return EMPTY;
      const snapshot = this.selected();
      return this.write(
        this.service.saveFunctionActions(record.id, record.version, [...snapshot]),
      ).pipe(
        tap((saved) => {
          this.recordState.set(saved);
          this.baseline.set(snapshot);
        }),
      );
    });
  }
  private hydrate(): void {
    const record = this.record();
    this.formState?.controls.groupId.setValidators(
      this.kind() === 'functions' ? Validators.required : [],
    );
    this.formState?.reset(
      {
        code: record?.code ?? '',
        name: record?.name ?? '',
        isActive: record?.isActive ?? true,
        groupId: record && 'groupId' in record ? record.groupId : (this.groups()[0]?.id ?? ''),
      },
      { emitEvent: false },
    );
    if (!this.canWrite()) this.formState?.disable({ emitEvent: false });
    else this.formState?.enable({ emitEvent: false });
    if (record) this.formState?.controls.code.disable({ emitEvent: false });
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
