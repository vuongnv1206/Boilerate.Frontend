import { Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Observable, Subscription, finalize, map, of, tap } from 'rxjs';
import { BaseEditorComponent } from '@core/base/base-editor.component';
import { clearServerErrors } from '@core/base/form-errors.util';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { ApiError } from '@core/http/api-error';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { createOperationId } from '@core/http/operation-id';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { ProductPage, ProductSummary } from '@api/catalog/models/product.dto';
import {
  CreateProductTypeRequest,
  EditProductTypeRequest,
  FieldDefinitionInput,
  PRODUCT_FIELD_TYPE_OPTIONS,
  PRODUCT_TYPE_CODE_PATTERN,
  PRODUCT_TYPE_LIMITS,
  ProductFieldChoiceDto,
  ProductFieldDefinitionDto,
  ProductFieldType,
  ProductTypeDto,
} from '@api/catalog/models/product-type.dto';
import { ProductTypesService } from '@api/catalog/services/product-types.service';
import { ProductsService } from '@api/catalog/services/products.service';
import { ProductTypesWorkspace } from '../product-types-workspace.component';

function generatedTypeToken(prefix: string): string {
  return `${prefix}_${createOperationId().replaceAll('-', '')}`;
}

function uniqueCodes(control: AbstractControl): ValidationErrors | null {
  if (!(control instanceof FormArray)) return null;
  const codes = control.controls
    .map((child: AbstractControl) =>
      String(child.get('code')?.value ?? '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  return new Set(codes).size === codes.length ? null : { duplicateCodes: true };
}

@Component({
  selector: 'app-product-type-io',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './product-type-io.component.html',
})
export class ProductTypeIo extends BaseEditorComponent<ProductTypeDto> {
  // System variables
  private productSubscription?: Subscription;
  private errorAliases: () => Readonly<Record<string, string>> = () => ({});

  // Business variables
  readonly form = this.buildForm();
  readonly limits = PRODUCT_TYPE_LIMITS;
  readonly fieldTypes = [...PRODUCT_FIELD_TYPE_OPTIONS];
  readonly fieldType = ProductFieldType;

  readonly linkedProductsPage = signal<ProductPage | null>(null);
  readonly productLoading = signal(false);
  readonly productError = signal('');

  readonly canCreate = computed(() => this.can('ProductType', 'Create'));
  readonly canViewProducts = computed(() => this.can('Product', 'View'));
  readonly linkedProducts = computed<readonly ProductSummary[]>(
    () => this.linkedProductsPage()?.items ?? [],
  );
  readonly linkedProductCount = computed(() => this.linkedProductsPage()?.total ?? 0);

  constructor(
    private readonly productTypesService: ProductTypesService,
    private readonly productsService: ProductsService,
    private readonly listStore: ProductTypesWorkspace,
  ) {
    super();
    this.destroyRef.onDestroy(() => this.productSubscription?.unsubscribe());
  }

  private buildChoiceForm(choice?: ProductFieldChoiceDto, index = 0) {
    return new FormGroup({
      id: new FormControl(choice?.id ?? '', { nonNullable: true }),
      code: new FormControl(choice?.code || generatedTypeToken('VALUE'), {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(PRODUCT_TYPE_CODE_PATTERN),
          Validators.maxLength(PRODUCT_TYPE_LIMITS.code),
        ],
      }),
      label: new FormControl(choice?.label ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/u),
          Validators.maxLength(PRODUCT_TYPE_LIMITS.label),
        ],
      }),
      isActive: new FormControl(choice?.isActive ?? true, { nonNullable: true }),
      sortOrder: new FormControl(choice?.sortOrder ?? index, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
      }),
    });
  }

  private buildFieldForm(field?: ProductFieldDefinitionDto, index = 0) {
    return new FormGroup({
      id: new FormControl(field?.id ?? '', { nonNullable: true }),
      code: new FormControl(field?.code || generatedTypeToken('FIELD'), {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(PRODUCT_TYPE_CODE_PATTERN),
          Validators.maxLength(PRODUCT_TYPE_LIMITS.code),
        ],
      }),
      dataType: new FormControl(field?.dataType ?? ProductFieldType.Text, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      label: new FormControl(field?.label ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/u),
          Validators.maxLength(PRODUCT_TYPE_LIMITS.label),
        ],
      }),
      helpText: new FormControl(field?.helpText ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(PRODUCT_TYPE_LIMITS.help)],
      }),
      isRequired: new FormControl(field?.isRequired ?? false, { nonNullable: true }),
      isFilterable: new FormControl(field?.isFilterable ?? false, { nonNullable: true }),
      isActive: new FormControl(field?.isActive ?? true, { nonNullable: true }),
      sortOrder: new FormControl(field?.sortOrder ?? index, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
      }),
      choices: new FormArray(
        (field?.choices ?? []).map((choice, choiceIndex) =>
          this.buildChoiceForm(choice, choiceIndex),
        ),
        { validators: [uniqueCodes, Validators.maxLength(PRODUCT_TYPE_LIMITS.choices)] },
      ),
    });
  }

  private buildForm() {
    return new FormGroup({
      code: new FormControl(generatedTypeToken('TYPE'), {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(PRODUCT_TYPE_CODE_PATTERN),
          Validators.maxLength(PRODUCT_TYPE_LIMITS.code),
        ],
      }),
      name: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/u),
          Validators.maxLength(PRODUCT_TYPE_LIMITS.name),
        ],
      }),
      isActive: new FormControl(true, { nonNullable: true }),
      fields: new FormArray<ReturnType<ProductTypeIo['buildFieldForm']>>([], {
        validators: [uniqueCodes, Validators.maxLength(PRODUCT_TYPE_LIMITS.fields)],
      }),
    });
  }

  async duplicate(): Promise<void> {
    const current = this.record();
    if (!current || !this.canCreate() || this.saving() || this.loading()) return;
    if (!(await this.confirmLeave())) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.saved.set(false);
    this.productTypesService
      .create(this.duplicateProductTypeRequest(current))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (copy) => {
          this.listStore.upsert(copy);
          void this.router.navigate(['/admin/collections/product-types', copy.id], {
            queryParamsHandling: 'preserve',
          });
        },
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  retryProducts(): void {
    const current = this.record();
    if (current) {
      this.loadLinkedProducts(current.id);
    }
  }

  addField(): void {
    if (
      !this.canWrite() ||
      this.form.controls.fields.length >= PRODUCT_TYPE_LIMITS.fields ||
      this.saving()
    ) {
      return;
    }
    this.form.controls.fields.push(
      this.buildFieldForm(undefined, this.form.controls.fields.length),
    );
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
    if (field.controls.dataType.value !== ProductFieldType.Choice) {
      field.controls.choices.clear();
    }
  }

  addChoice(index: number): void {
    const field = this.form.controls.fields.at(index);
    if (
      !this.canWrite() ||
      !field ||
      field.controls.dataType.value !== ProductFieldType.Choice ||
      field.controls.choices.length >= PRODUCT_TYPE_LIMITS.choices ||
      this.saving()
    ) {
      return;
    }
    field.controls.choices.push(this.buildChoiceForm(undefined, field.controls.choices.length));
    this.form.markAsDirty();
  }

  removeNewChoice(fieldIndex: number, choiceIndex: number): void {
    const field = this.form.controls.fields.at(fieldIndex);
    const choice = field?.controls.choices.at(choiceIndex);
    if (!this.canWrite() || !choice || choice.controls.id.value || this.saving()) return;
    field.controls.choices.removeAt(choiceIndex);
    this.form.markAsDirty();
  }

  validation(control: AbstractControl): string {
    return validationMessage(control);
  }

  invalid(field: 'code' | 'name'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  serverError(field: 'code' | 'name'): string {
    const errors: unknown = this.form.controls[field].errors?.['server'];
    return Array.isArray(errors) ? errors.join(' ') : '';
  }

  typeLabel(type: ProductFieldType): string {
    return this.fieldTypes.find((option) => option.value === type)?.label ?? 'Không xác định';
  }

  private resetProductTypeForm(type?: ProductTypeDto): void {
    this.form.controls.fields.clear({ emitEvent: false });
    (type?.fields ?? []).forEach((field, index) =>
      this.form.controls.fields.push(this.buildFieldForm(field, index), { emitEvent: false }),
    );
    this.form.reset(
      {
        code: type?.code || generatedTypeToken('TYPE'),
        name: type?.name ?? '',
        isActive: type?.isActive ?? true,
        fields: this.form.controls.fields.getRawValue(),
      },
      { emitEvent: false },
    );
  }

  private fieldInput(field: any): FieldDefinitionInput {
    return {
      code: field.code.trim(),
      dataType: field.dataType,
      label: field.label.trim(),
      helpText: field.helpText.trim() || null,
      isRequired: field.isRequired,
      isFilterable: field.isFilterable,
      choices:
        field.dataType === ProductFieldType.Choice
          ? field.choices.map((choice: any) => ({
              code: choice.code.trim(),
              label: choice.label.trim(),
            }))
          : [],
    };
  }

  private createProductTypeRequest(): CreateProductTypeRequest {
    const value = this.form.getRawValue();
    return {
      code: value.code.trim(),
      name: value.name.trim(),
      fields: value.fields.map((f) => this.fieldInput(f)),
    };
  }

  private duplicateProductTypeRequest(type: ProductTypeDto): CreateProductTypeRequest {
    const suffix = ' (Bản sao)';
    const name = `${type.name.slice(0, PRODUCT_TYPE_LIMITS.name - suffix.length)}${suffix}`;
    return {
      code: generatedTypeToken('TYPE'),
      name,
      fields: type.fields
        .filter((field) => field.isActive)
        .map((field) => ({
          code: generatedTypeToken('FIELD'),
          dataType: field.dataType,
          label: field.label,
          helpText: field.helpText,
          isRequired: field.isRequired,
          isFilterable: field.isFilterable,
          choices: field.choices
            .filter((choice) => choice.isActive)
            .map((choice) => ({ code: generatedTypeToken('VALUE'), label: choice.label })),
        })),
    };
  }

  private synchronizeProductTypeIdentity(type: ProductTypeDto): void {
    for (const field of this.form.controls.fields.controls) {
      const canonical = type.fields.find(
        (item) =>
          item.id === field.controls.id.value ||
          item.code.toUpperCase() === field.controls.code.value.trim().toUpperCase(),
      );
      if (!canonical) continue;
      field.patchValue(
        {
          id: canonical.id,
          code: canonical.code,
          dataType: canonical.dataType,
          isRequired: canonical.isRequired,
        },
        { emitEvent: false },
      );
      for (const choice of field.controls.choices.controls) {
        const saved = canonical.choices.find(
          (item) =>
            item.id === choice.controls.id.value ||
            item.code.toUpperCase() === choice.controls.code.value.trim().toUpperCase(),
        );
        if (saved) choice.patchValue({ id: saved.id, code: saved.code }, { emitEvent: false });
      }
    }
  }

  private editProductTypeRequest(original: ProductTypeDto): EditProductTypeRequest {
    const value = this.form.getRawValue();
    return {
      id: original.id,
      version: original.version,
      name: value.name.trim(),
      isActive: value.isActive,
      addFields: value.fields
        .filter((field) => !field.id)
        .map((field) => ({ ...this.fieldInput(field), isRequired: false })),
      fields: value.fields
        .filter((field) => !!field.id)
        .map((field) => ({
          id: field.id,
          label: field.label.trim(),
          helpText: field.helpText.trim() || null,
          isFilterable: field.isFilterable,
          isActive: field.isActive,
          sortOrder: field.sortOrder,
          addChoices: field.choices
            .filter((choice) => !choice.id)
            .map((choice) => ({ code: choice.code.trim(), label: choice.label.trim() })),
          choices: field.choices
            .filter((choice) => !!choice.id)
            .map((choice) => ({
              id: choice.id,
              label: choice.label.trim(),
              isActive: choice.isActive,
              sortOrder: choice.sortOrder,
            })),
        })),
    };
  }

  private productTypeErrorAliases(editing: boolean): () => Readonly<Record<string, string>> {
    const entries: {
      source: string;
      field: any;
      member: string;
      choice?: any;
      choiceMember?: string;
    }[] = [];
    const groups = editing
      ? ([
          [
            'fields',
            this.form.controls.fields.controls.filter((field) => !!field.controls.id.value),
          ],
          [
            'addFields',
            this.form.controls.fields.controls.filter((field) => !field.controls.id.value),
          ],
        ] as const)
      : ([['fields', [...this.form.controls.fields.controls]]] as const);
    for (const [group, fields] of groups) {
      fields.forEach((field, index) => {
        entries.push({ source: `${group}[${index}]`, field, member: '' });
        for (const member of Object.keys(field.controls)) {
          entries.push({ source: `${group}[${index}].${member}`, field, member });
        }
        const choiceGroups =
          editing && group === 'fields'
            ? ([
                [
                  'choices',
                  field.controls.choices.controls.filter((choice) => !!choice.controls.id.value),
                ],
                [
                  'addChoices',
                  field.controls.choices.controls.filter((choice) => !choice.controls.id.value),
                ],
              ] as const)
            : ([['choices', [...field.controls.choices.controls]]] as const);
        for (const [choiceGroup, choices] of choiceGroups) {
          choices.forEach((choice, choiceIndex) => {
            entries.push({
              source: `${group}[${index}].${choiceGroup}[${choiceIndex}]`,
              field,
              member: 'choices',
              choice,
            });
            for (const choiceMember of Object.keys(choice.controls)) {
              entries.push({
                source: `${group}[${index}].${choiceGroup}[${choiceIndex}].${choiceMember}`,
                field,
                member: 'choices',
                choice,
                choiceMember,
              });
            }
          });
        }
      });
    }
    return () =>
      Object.fromEntries(
        entries.map((entry) => {
          const index = this.form.controls.fields.controls.indexOf(entry.field);
          const choiceIndex = entry.choice
            ? entry.field.controls.choices.controls.indexOf(entry.choice)
            : -1;
          const target =
            index < 0 || (entry.choice && choiceIndex < 0)
              ? '__unmapped__'
              : `fields.${index}${entry.member ? `.${entry.member}` : ''}${entry.choice ? `.${choiceIndex}${entry.choiceMember ? `.${entry.choiceMember}` : ''}` : ''}`;
          return [entry.source, target];
        }),
      );
  }

  protected fetchRecord(id: string | null): Observable<ProductTypeDto | null> {
    this.productSubscription?.unsubscribe();
    this.linkedProductsPage.set(null);
    this.productLoading.set(false);
    this.productError.set('');
    if (id === null) return of(null);
    return this.productTypesService
      .getById(id)
      .pipe(tap((record) => this.loadLinkedProducts(record.id)));
  }

  protected hydrate(record: ProductTypeDto | null): void {
    this.resetProductTypeForm(record ?? undefined);
  }

  protected persist(record: ProductTypeDto | null): Observable<ProductTypeDto> {
    this.errorAliases = this.productTypeErrorAliases(!!record);
    return record
      ? this.productTypesService.update(record.id, this.editProductTypeRequest(record))
      : this.productTypesService.create(this.createProductTypeRequest());
  }

  protected canWriteRecord(record: ProductTypeDto | null): boolean {
    return this.can('ProductType', record ? 'Update' : 'Create');
  }

  protected override fieldAliases(): Readonly<Record<string, string>> {
    return this.errorAliases();
  }

  protected override onDraftChange(): void {
    this.summaryErrors.set([]);
    clearServerErrors(this.form);
  }

  protected override saveErrorMessage(error: ApiError): string {
    return error.status === 409
      ? 'Dữ liệu đã thay đổi. Nội dung đang nhập được giữ lại; tải lại để đối chiếu trước khi lưu tiếp.'
      : error.message;
  }

  protected override afterSaved(saved: ProductTypeDto, wasNew: boolean): void {
    // Edits typed during the save are kept; they only pick up the ids the server just assigned.
    if (!this.saved()) this.synchronizeProductTypeIdentity(saved);
    this.loadLinkedProducts(saved.id);
    this.listStore.upsert(saved);
    if (wasNew) this.openCreated(['/admin/collections/product-types', saved.id]);
  }

  private loadLinkedProducts(id: string): void {
    this.productSubscription?.unsubscribe();
    this.linkedProductsPage.set(null);
    this.productError.set('');
    if (!this.canViewProducts()) return;
    this.productLoading.set(true);
    this.productSubscription = this.productsService
      .search({
        pageNumber: 1,
        pageSize: 8,
        productTypeId: id,
        sortBy: 'modified',
        sortDirection: 'desc',
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((page) => ({ id, page })),
      )
      .subscribe({
        next: ({ id: responseId, page }) => {
          if (this.record()?.id !== responseId) return;
          this.linkedProductsPage.set(page);
          this.productLoading.set(false);
        },
        error: (error: unknown) => {
          if (this.record()?.id !== id) return;
          this.productLoading.set(false);
          this.productError.set(
            error instanceof ApiError ? error.message : 'Không thể tải sản phẩm của loại này.',
          );
        },
      });
  }
}
