import {
  Directive,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
} from 'rxjs';
import { ApiError } from '../http/api-error';
import { normalizeApiError } from '../http/normalize-api-error';
import { BaseComponent } from './base.component';
import { applyServerErrors, clearServerErrors } from './form-errors.util';
import { LeaveConfirmation } from './leave-confirmation';

/**
 * Base class for Create / Update editors (`-io` screens and single-record settings forms).
 *
 * A screen declares only its business part:
 * - `fetchRecord(id)` — `id` is the route `:id`, or `null` for a new record / a screen without `:id`
 * - `hydrate(record)` — put the record into the form; `null` means the blank editor
 * - `persist(record)` — build the save request from the current form value
 * - `canWriteRecord(record)` — permission to save
 *
 * The base owns everything else: following the route, dropping superseded loads, read-only mode,
 * keeping edits typed during an in-flight save, server field errors, `409 Conflict` draft
 * preservation, and the unsaved-changes guard (`confirmLeave()` + `beforeunload`).
 *
 * The screen must list `LeaveConfirmation` in its own `providers`.
 */
@Directive()
export abstract class BaseEditorComponent<TDto, TForm extends FormGroup = FormGroup>
  extends BaseComponent
  implements OnInit
{
  // System variables
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  readonly confirmation = inject(LeaveConfirmation);

  /** Server field path -> form control path, for fields whose names differ. */
  protected readonly fieldErrorAliases: Readonly<Record<string, string>> = {};
  /** Disable every control while a save is in flight. */
  protected readonly lockFormWhileSaving: boolean = false;
  /** Show the API message as a banner for validation failures too, not only as field errors. */
  protected readonly bannerOnValidationError: boolean = true;

  readonly record = signal<TDto | null>(null);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly conflict = signal(false);
  readonly summaryErrors = signal<readonly string[]>([]);
  readonly canWrite = computed(() => this.canWriteRecord(this.record()));

  private readonly formWritable = computed(
    () => this.canWrite() && !(this.lockFormWhileSaving && this.saving()),
  );
  private loadRequest: Subscription | undefined;
  private generation = 0;
  private revision = 0;
  private currentId: string | null = null;

  abstract readonly form: TForm;

  protected abstract fetchRecord(id: string | null): Observable<TDto | null>;
  protected abstract hydrate(record: TDto | null): void;
  protected abstract persist(record: TDto | null): Observable<TDto>;
  protected abstract canWriteRecord(record: TDto | null): boolean;

  constructor() {
    super();
    effect(() => {
      this.formWritable();
      untracked(() => this.applyAccess());
    });
    this.destroyRef.onDestroy(() => {
      this.generation += 1;
      this.loadRequest?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision += 1;
      this.saved.set(false);
      this.onDraftChange();
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.load(id));
  }

  load(id: string | null = this.currentId): void {
    this.currentId = id;
    const generation = ++this.generation;
    this.loadRequest?.unsubscribe();
    this.ready.set(false);
    this.loading.set(true);
    this.clearFeedback();
    this.show(null);
    this.loadRequest = this.fetchRecord(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (record) => {
          if (generation !== this.generation) return;
          this.show(record);
          this.loading.set(false);
          this.ready.set(true);
        },
        error: (rawError: unknown) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.errorMessage.set(normalizeApiError(rawError).message);
        },
      });
  }

  save(): void {
    if (!this.ready() || !this.canWrite() || this.saving()) return;
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const current = this.record();
    const revision = this.revision;
    this.write(this.persist(current)).subscribe((saved) => {
      this.record.set(saved);
      if (revision === this.revision) {
        this.show(saved);
        this.saved.set(true);
      }
      this.afterSaved(saved, current === null);
    });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.load();
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.isDirty(), this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty() || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /** Called after a successful `save()`; `wasNew` is true when the record was just created. */
  protected afterSaved(_saved: TDto, _wasNew: boolean): void {
    void _saved;
    void _wasNew;
  }

  /** Unsaved state that lives outside the form (e.g. a permission matrix). */
  protected extraDirty(): boolean {
    return false;
  }

  /** Controls that stay disabled even when the record is writable (e.g. an immutable code). */
  protected restrictControls(): void {
    return;
  }

  /** Called on every user edit of the form. */
  protected onDraftChange(): void {
    return;
  }

  /** Banner text for a failed save. */
  protected saveErrorMessage(error: ApiError): string {
    return error.message;
  }

  /** Replaces the `new` URL with the created record's URL unless the user kept typing. */
  protected openCreated(commands: readonly unknown[], fragment?: string): void {
    if (this.form.dirty) return;
    void this.router.navigate([...commands], {
      replaceUrl: true,
      queryParamsHandling: 'preserve',
      ...(fragment ? { fragment } : {}),
    });
  }

  /**
   * Runs a write that is not the main form save (e.g. saving a permission matrix) with the same
   * busy flag, error reporting and stale-response protection. Emits only on success.
   */
  protected write<T>(request: Observable<T>): Observable<T> {
    const generation = this.generation;
    this.saving.set(true);
    this.clearFeedback();
    this.applyAccess();
    return request.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => generation === this.generation),
      catchError((rawError: unknown) => {
        if (generation === this.generation) {
          // Unlock first: re-enabling a control re-runs its validators and would drop server errors.
          this.endWrite();
          this.reportSaveError(normalizeApiError(rawError));
        }
        return EMPTY;
      }),
      finalize(() => {
        if (generation === this.generation) this.endWrite();
      }),
    );
  }

  private isDirty(): boolean {
    return this.form.dirty || this.extraDirty();
  }

  private show(record: TDto | null): void {
    this.record.set(record);
    this.hydrate(record);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.applyAccess();
  }

  private endWrite(): void {
    this.saving.set(false);
    this.applyAccess();
  }

  /** Idempotent: toggling an already matching form would re-run validators for nothing. */
  private applyAccess(): void {
    if (!this.formWritable()) {
      if (this.form.enabled) this.form.disable({ emitEvent: false });
      return;
    }
    if (this.form.disabled) this.form.enable({ emitEvent: false });
    this.restrictControls();
  }

  private clearFeedback(): void {
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    this.saved.set(false);
    this.conflict.set(false);
  }

  private reportSaveError(error: ApiError): void {
    const unmapped = applyServerErrors(
      this.form,
      error.fieldErrors,
      this.fieldErrorAliases,
    ).flatMap((entry) => entry.messages);
    this.conflict.set(error.kind === 'conflict');
    if (error.kind === 'validation' && !this.bannerOnValidationError) {
      const hasFieldErrors = Object.keys(error.fieldErrors).length > 0;
      this.summaryErrors.set(unmapped.length || hasFieldErrors ? unmapped : [error.message]);
      return;
    }
    this.errorMessage.set(this.saveErrorMessage(error));
    this.summaryErrors.set(unmapped);
  }
}
