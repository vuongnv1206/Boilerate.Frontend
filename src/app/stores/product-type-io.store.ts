import { ProductTypeForm } from '@forms/product-type.form';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  defer,
  filter,
  finalize,
  takeUntil,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';
import { PRODUCT_TYPE_LIMITS } from '@constants/product-type.constants';
import { ProductTypesService } from '@services/product-types.service';
import { ProductFieldType } from '@enums/product-field-type.enum';
import {
  createChoiceForm,
  createFieldForm,
  createProductTypeRequest,
  editProductTypeRequest,
  resetProductTypeForm,
  productTypeErrorAliases,
  synchronizeProductTypeIdentity,
} from '@forms/product-type.form';
import { ProductTypeDto } from '@models/product-type.dto';

@Injectable()
export class ProductTypeIoStore {
  private readonly session = inject(AuthSession);
  private readonly cancelWrites = new Subject<void>();
  private readonly summaryState = signal<readonly string[]>([]);
  readonly summary = this.summaryState.asReadonly();
  readonly canWrite = computed(() =>
    this.session.can('ProductType', this.record() ? 'Update' : 'Create'),
  );
  private readonly service = inject(ProductTypesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recordState = signal<ProductTypeDto | null>(null);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly readyState = signal(false);
  private readonly errorState = signal('');
  private readonly savedState = signal(false);
  private loadSubscription?: Subscription;
  private generation = 0;
  private revision = 0;
  private currentId = 'new';

  private currentForm: ProductTypeForm | null = null;
  readonly record = this.recordState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly saved = this.savedState.asReadonly();

  constructor() {
    effect(() => {
      this.canWrite();
      this.applyAccess();
    });
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.cancelWrites.next();
      this.loadSubscription?.unsubscribe();
    });
  }
  get form(): ProductTypeForm {
    if (!this.currentForm) throw new Error('Set the editor form before loading data.');
    return this.currentForm;
  }

  setForm(form: ProductTypeForm): void {
    if (this.currentForm) throw new Error('The editor form is already set.');
    this.currentForm = form;
    this.applyAccess();

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision++;
      this.summaryState.set([]);
      this.savedState.set(false);
      clearServerErrors(this.form);
    });
  }

  load(id: string): void {
    this.currentId = id;
    this.cancelWrites.next();
    this.summaryState.set([]);
    const generation = ++this.generation;
    this.loadSubscription?.unsubscribe();
    this.loadingState.set(false);
    this.readyState.set(false);
    this.errorState.set('');
    this.recordState.set(null);
    this.savedState.set(false);
    this.savingState.set(false);
    resetProductTypeForm(this.form);
    if (id === 'new') {
      this.readyState.set(true);
      this.applyAccess();
      return;
    }
    this.loadingState.set(true);
    this.loadSubscription = this.service
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (record) => {
          if (generation !== this.generation) return;
          this.recordState.set(record);
          resetProductTypeForm(this.form, record);
          this.readyState.set(true);
          this.applyAccess();
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.loadingState.set(false);
          this.errorState.set(
            error instanceof ApiError ? error.message : 'Không thể tải loại sản phẩm.',
          );
        },
      });
  }
  retry(): void {
    this.load(this.currentId);
  }
  addField(): void {
    if (
      !this.canWrite() ||
      this.form.controls.fields.length >= PRODUCT_TYPE_LIMITS.fields ||
      this.saving()
    )
      return;
    this.form.controls.fields.push(createFieldForm(undefined, this.form.controls.fields.length));
    this.form.markAsDirty();
  }
  removeNewField(index: number): void {
    const field = this.form.controls.fields.at(index);
    if (!this.canWrite() || !field || field.controls.id.value || this.saving()) return;
    this.form.controls.fields.removeAt(index);
    this.form.markAsDirty();
  }
  changeFieldType(index: number): void {
    const field = this.form.controls.fields.at(index);
    if (!this.canWrite() || !field || field.controls.id.value) return;
    if (field.controls.dataType.value !== ProductFieldType.Choice) field.controls.choices.clear();
  }
  addChoice(index: number): void {
    const field = this.form.controls.fields.at(index);
    if (
      !this.canWrite() ||
      !field ||
      field.controls.dataType.value !== ProductFieldType.Choice ||
      field.controls.choices.length >= PRODUCT_TYPE_LIMITS.choices ||
      this.saving()
    )
      return;
    field.controls.choices.push(createChoiceForm(undefined, field.controls.choices.length));
    this.form.markAsDirty();
  }
  removeNewChoice(fieldIndex: number, choiceIndex: number): void {
    const field = this.form.controls.fields.at(fieldIndex);
    const choice = field?.controls.choices.at(choiceIndex);
    if (!this.canWrite() || !choice || choice.controls.id.value || this.saving()) return;
    field.controls.choices.removeAt(choiceIndex);
    this.form.markAsDirty();
  }
  save(): Observable<ProductTypeDto> {
    return defer(() => {
      if (!this.canWrite() || this.saving() || this.loading() || !this.ready()) return EMPTY;
      clearServerErrors(this.form);
      this.summaryState.set([]);
      this.form.markAllAsTouched();
      if (this.form.invalid) return EMPTY;
      const generation = this.generation;
      const revision = this.revision;
      this.savingState.set(true);
      this.errorState.set('');
      this.savedState.set(false);
      const original = this.record();
      const errorAliases = productTypeErrorAliases(this.form, !!original);
      const operation = original
        ? this.service.update(original.id, editProductTypeRequest(this.form, original))
        : this.service.create(createProductTypeRequest(this.form));
      return operation.pipe(
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        filter(() => generation === this.generation),
        tap((record) => {
          this.recordState.set(record);
          if (revision === this.revision) resetProductTypeForm(this.form, record);
          else synchronizeProductTypeIdentity(this.form, record);
          this.savedState.set(revision === this.revision);
        }),
        catchError((error: unknown) => {
          if (generation !== this.generation) return EMPTY;
          if (error instanceof ApiError) {
            this.summaryState.set(
              applyServerErrors(this.form, error.fieldErrors, errorAliases()).flatMap(
                (issue) => issue.messages,
              ),
            );
            this.errorState.set(
              error.status === 409
                ? 'Dữ liệu đã thay đổi. Nội dung đang nhập được giữ lại; tải lại để đối chiếu trước khi lưu tiếp.'
                : error.message,
            );
          } else this.errorState.set('Chưa lưu được dữ liệu. Nội dung đang nhập được giữ lại.');
          return EMPTY;
        }),
        finalize(() => {
          if (generation === this.generation) {
            this.savingState.set(false);
            this.applyAccess();
          }
        }),
      );
    });
  }

  private applyAccess(): void {
    if (!this.currentForm) return;
    if (this.canWrite()) {
      if (this.currentForm.disabled) this.currentForm.enable({ emitEvent: false });
    } else if (this.currentForm.enabled) this.currentForm.disable({ emitEvent: false });
  }
}
