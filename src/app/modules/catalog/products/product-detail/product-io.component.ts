import {
  Component,
  HostListener,
  OnInit,
  Optional,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  firstValueFrom,
  forkJoin,
  map,
  of,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { BaseComponent } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { createOperationId } from '@core/http/operation-id';
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CatalogConfiguration,
  CreateOptionForm,
  CreateProduct,
  CreateSkuForm,
  PRODUCT_FIELD_ALIASES,
  PRODUCT_FULFILLMENT_OPTIONS,
  PRODUCT_LIMITS,
  PRODUCT_STATUS_LABELS,
  ProductCategoryLookup,
  ProductContent,
  ProductDto,
  ProductFieldControlValue,
  ProductFieldDefinition,
  ProductFieldInput,
  ProductFieldValue,
  ProductForm,
  ProductFulfillmentKind,
  ProductOptionInput,
  ProductStatus,
  ProductTypeLookup,
  ProductVariantInput,
  SaveProductEditor,
  createOptionForm,
  createProductForm,
  createProductMediaForm,
  createSkuRow,
  productSlug,
} from '@api/catalog/models/product.dto';
import { ProductFieldType } from '@api/catalog/models/product-type.dto';
import { CategoriesService } from '@api/catalog/services/categories.service';
import { ProductTypesService } from '@api/catalog/services/product-types.service';
import { ProductsService } from '@api/catalog/services/products.service';
import { ProductsWorkspace } from '../products-workspace.component';
import { ProductCommercePanel } from './product-commerce-panel/product-commerce-panel.component';

const fieldNumber: ValidatorFn = (control) => {
  if (control.value === null || control.value === '') return null;
  const value: unknown = control.value;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) < 100000000000000 &&
    Math.abs(Math.round(value * 10000) / 10000 - value) < 1e-8
    ? null
    : { fieldNumber: true };
};

@Component({
  selector: 'app-product-io',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS, ProductCommercePanel],
  templateUrl: './product-io.component.html',
})
export class ProductIo extends BaseComponent implements OnInit {
  // System variables
  private readonly cancelWrites = new Subject<void>();
  private loadSubscription?: Subscription;
  private schemaSubscription?: Subscription;
  private writeSubscription?: Subscription;
  private leaveResolve: ((value: boolean) => void) | null = null;
  private generation = 0;
  private revision = 0;
  private autoSlug = true;

  readonly limits = PRODUCT_LIMITS;
  readonly fieldType = ProductFieldType;
  readonly fulfillmentOptions = PRODUCT_FULFILLMENT_OPTIONS;
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly status = ProductStatus;

  // Business variables
  readonly form: ProductForm = createProductForm();
  readonly commerce = viewChild(ProductCommercePanel);
  readonly item = signal<ProductDto | null>(null);
  readonly categories = signal<readonly ProductCategoryLookup[]>([]);
  readonly productTypes = signal<readonly ProductTypeLookup[]>([]);
  readonly schema = signal<ProductTypeLookup | null>(null);
  readonly schemaLoading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly loaded = signal(false);
  readonly summary = signal<readonly string[]>([]);
  readonly commerceBusy = signal(false);
  readonly commerceDraft = signal(false);
  readonly mediaBusy = signal(false);
  readonly leaveVisible = signal(false);
  readonly deleteVisible = signal(false);

  readonly isNew = computed(() => this.item() === null);
  readonly title = computed(() => this.item()?.name ?? 'Sản phẩm mới');
  readonly canWrite = computed(() => this.can('Product', this.item() ? 'Update' : 'Create'));
  readonly canPublish = computed(() => this.can('Product', 'Publish'));
  readonly canDelete = computed(() => this.can('Product', 'Delete'));
  readonly canCreate = computed(() => this.can('Product', 'Create'));
  readonly canPrice = computed(() => this.can('Price', 'Update'));
  readonly canAdjust = computed(
    () => this.can('Inventory', 'Adjust') && this.can('Inventory', 'View'),
  );
  readonly categoryOptions = computed(() => this.categories().slice());
  readonly typeOptions = computed(() => this.productTypes().slice());
  readonly visibleFields = computed(
    () =>
      this.schema()
        ?.fields.filter(
          (field) =>
            field.isActive ||
            this.item()?.fields.some((value) => value.fieldDefinitionId === field.id),
        )
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder) ?? [],
  );

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly productTypesService: ProductTypesService,
    @Optional() private readonly workspace?: ProductsWorkspace | null,
  ) {
    super();
    effect(() => {
      this.canWrite();
      this.canPrice();
      this.canAdjust();
      this.applyAccess();
    });
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.cancelRequests();
      this.leaveResolve?.(false);
      this.leaveResolve = null;
    });
  }

  readonly refreshProductFn = (): Observable<unknown> => {
    const current = this.item();
    if (!current) return of(null);
    return this.productsService.getById(current.id).pipe(
      tap((refreshed) => {
        this.acceptCommerceProduct(refreshed);
        this.workspace?.load();
      }),
    );
  };

  ngOnInit(): void {
    this.applyAccess();
    this.form.controls.slug.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.autoSlug = false;
    });
    this.form.controls.name.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        if (this.autoSlug && this.isNew()) {
          this.form.controls.slug.setValue(productSlug(name), { emitEvent: false });
        }
      });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision++;
      this.summary.set([]);
      clearServerErrors(this.form);
      this.dirty.set(this.form.dirty);
      this.notice.set('');
    });
    this.form.controls.productTypeId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (!this.isNew() || !id) return;
        this.loadSchema(id);
      });

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) =>
        this.load(id, id ? null : this.route.snapshot.queryParamMap.get('duplicateFrom')),
      );
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges() || this.commerceDraft() || this.commerceBusy()) {
      event.preventDefault();
    }
  }

  load(id: string | null, duplicateFrom: string | null = null): void {
    this.generation++;
    this.cancelRequests();
    const generation = this.generation;
    this.loading.set(true);
    this.busy.set(false);
    this.schemaLoading.set(false);
    this.loaded.set(false);
    this.error.set('');
    this.notice.set('');
    this.dirty.set(false);
    this.item.set(null);
    this.schema.set(null);
    this.autoSlug = !id;
    this.summary.set([]);
    this.revision = 0;
    this.initializeProductForm(null);
    const sourceId = id || duplicateFrom;
    this.loadSubscription = forkJoin({
      item: sourceId ? this.productsService.getById(sourceId) : of(null),
      categories: this.categoriesService.getAll(),
      types: this.productTypesService.getAll(),
    })
      .pipe(
        switchMap((result) => {
          const typeId =
            result.item?.productTypeId ?? result.types.find((type) => type.isActive)?.id;
          const schemaRequest: Observable<ProductTypeLookup | null> = typeId
            ? this.productTypesService.getById(typeId)
            : of(null);
          return schemaRequest.pipe(map((schema) => ({ ...result, schema })));
        }),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ item, categories, types, schema }) => {
          if (generation !== this.generation) return;
          this.item.set(duplicateFrom ? null : item);
          this.categories.set(
            categories.filter(
              (category) => category.isActive || item?.categoryIds.includes(category.id),
            ),
          );
          this.productTypes.set(
            types.filter((type) => type.isActive || type.id === item?.productTypeId),
          );
          this.schema.set(schema);
          this.initializeProductForm(item);
          if (duplicateFrom && item) {
            this.form.controls.name.setValue(`${item.name} (bản sao)`, { emitEvent: false });
            this.form.controls.slug.setValue(`${item.slug.slice(0, 190)}-copy`, {
              emitEvent: false,
            });
            const defaultRow = this.form.controls.variants.controls.find(
              (row) => row.controls.id.value === this.form.controls.defaultVariantId.value,
            );
            for (const option of this.form.controls.options.controls) {
              option.controls.id.setValue('', { emitEvent: false });
              option.controls.clientId.setValue(createOperationId(), { emitEvent: false });
              for (const value of option.controls.values.controls) {
                value.controls.id.setValue('', { emitEvent: false });
                value.controls.clientId.setValue(createOperationId(), { emitEvent: false });
              }
            }
            for (const row of this.form.controls.variants.controls) {
              const copySku = row.controls.sku.value
                ? `${row.controls.sku.value.slice(0, PRODUCT_LIMITS.sku - 5)}-COPY`
                : '';
              row.patchValue(
                {
                  id: '',
                  clientId: createOperationId(),
                  sku: copySku,
                  quantity: 0,
                  inventoryVersion: null,
                },
                { emitEvent: false },
              );
              if (!this.canPrice()) {
                row.patchValue({ price: null, compareAtPrice: null }, { emitEvent: false });
              }
            }
            if (defaultRow) {
              this.form.controls.sku.setValue(defaultRow.controls.sku.value, { emitEvent: false });
              this.form.controls.defaultVariantSku.setValue(defaultRow.controls.sku.value, {
                emitEvent: false,
              });
            }
            if (!this.canPrice()) {
              this.form.controls.price.setValue(null, { emitEvent: false });
            }
            this.form.controls.defaultVariantId.setValue(
              defaultRow?.controls.clientId.value || '',
              { emitEvent: false },
            );
          }
          if (schema) {
            this.form.controls.productTypeId.setValue(schema.id, { emitEvent: false });
            this.configureProductFields(schema, item?.fields);
          }
          this.applyAccess();
          this.form.markAsPristine();
          if (duplicateFrom) {
            this.form.markAsDirty();
            this.dirty.set(true);
            this.notice.set(
              this.canPrice()
                ? 'Bản sao chưa được tạo. Kiểm tra đường dẫn rồi lưu sản phẩm mới.'
                : 'Bản sao chưa được tạo. Giá không được sao chép vì chưa có quyền cập nhật giá; kiểm tra đường dẫn rồi lưu sản phẩm mới.',
            );
          }
          this.loading.set(false);
          this.loaded.set(true);
          if (!schema) {
            this.error.set('Chưa có loại sản phẩm hoạt động. Hãy tạo loại sản phẩm trước.');
          }
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.setError(error, 'Không thể tải sản phẩm. Vui lòng thử lại.');
        },
      });
  }

  save(): void {
    if (!this.prepareSave()) return;
    const wasNew = !this.route.snapshot.paramMap.has('id');
    this.saveRequest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.workspace?.load();
        if (wasNew && !this.form.dirty) {
          void this.router.navigate(['/admin/collections/products', saved.id], {
            replaceUrl: true,
            queryParams: { duplicateFrom: null },
            queryParamsHandling: 'merge',
          });
        }
      });
  }

  deleteProduct(): void {
    const current = this.item();
    if (!current || !this.canDelete() || this.busy()) return;
    this.busy.set(true);
    this.productsService
      .deleteProduct(current.id, current.version)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.deleteVisible.set(false);
          this.form.markAsPristine();
          this.dirty.set(false);
          this.workspace?.load();
          void this.router.navigate(['/admin/collections/products']);
        },
        error: (error: unknown) => {
          this.setError(error, 'Không xóa được sản phẩm.');
        },
      });
  }

  changeStatus(nextStatus: ProductStatus): void {
    const current = this.item();
    if (!this.canPublish() || !current || this.busy() || this.form.dirty) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set('');
    this.writeSubscription = this.productsService
      .changeStatus({ id: current.id, version: current.version, status: nextStatus })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          if (generation !== this.generation) return;
          this.item.set(saved);
          this.busy.set(false);
          this.notice.set('Đã cập nhật trạng thái sản phẩm.');
          this.workspace?.load();
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.busy.set(false);
          this.setError(error, 'Không thể cập nhật trạng thái sản phẩm.');
        },
      });
  }

  dismissNotice(): void {
    this.notice.set('');
  }

  retry(): void {
    this.load(this.route.snapshot.paramMap.get('id'));
  }

  async reload(): Promise<void> {
    if (await this.confirmLeave()) {
      this.retry();
    }
  }

  confirmLeave(): boolean | Promise<boolean> {
    if (this.busy() || this.commerceBusy() || this.mediaBusy()) return false;
    if (!this.form.dirty && !this.commerceDraft()) return true;
    if (this.leaveResolve) return false;
    this.leaveVisible.set(true);
    return new Promise<boolean>((resolve) => {
      this.leaveResolve = resolve;
    });
  }

  async answerLeave(choice: 'save' | 'discard' | 'stay'): Promise<void> {
    if (!this.leaveResolve || this.busy()) return;
    if (choice === 'save') {
      if (!this.prepareSave()) return;
      const saved = await firstValueFrom(
        this.saveRequest().pipe(takeUntilDestroyed(this.destroyRef), defaultIfEmpty(null)),
      );
      if (!saved || this.form.dirty) return;
      this.workspace?.load();
    }
    if (choice === 'discard') {
      this.commerce()?.resetDraft();
      this.discard();
    }
    const resolve = this.leaveResolve;
    this.leaveResolve = null;
    this.leaveVisible.set(false);
    resolve(choice !== 'stay');
  }

  async discardChanges(): Promise<void> {
    if (await this.confirmLeave()) {
      this.discard();
    }
  }

  discard(): void {
    const currentSchema = this.schema();
    this.initializeProductForm(this.item());
    if (currentSchema) {
      this.configureProductFields(currentSchema, this.item()?.fields);
    }
    this.applyAccess();
    this.form.markAsPristine();
    this.dirty.set(false);
    this.error.set('');
    this.summary.set([]);
  }

  reloadCanonical(): void {
    const current = this.item();
    if (!current || this.busy()) return;
    const generation = this.generation;
    const draftFields: Record<string, ProductFieldControlValue> = {};
    for (const [id, control] of Object.entries(this.form.controls.fields.controls)) {
      if (control.dirty) draftFields[id] = control.value;
    }
    this.busy.set(true);
    this.schemaLoading.set(true);
    this.error.set('');
    this.productsService
      .getById(current.id)
      .pipe(
        switchMap((saved) =>
          this.productTypesService
            .getById(saved.productTypeId)
            .pipe(map((schema) => ({ saved, schema }))),
        ),
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) {
            this.busy.set(false);
            this.schemaLoading.set(false);
          }
        }),
      )
      .subscribe({
        next: ({ saved, schema }) => {
          if (generation !== this.generation) return;
          this.item.set(saved);
          this.configureProductFields(schema, saved.fields);
          for (const definition of schema.fields) {
            const control = this.form.controls.fields.controls[definition.id];
            const draftValue = draftFields[definition.id];
            if (control && draftValue !== undefined) {
              control.setValue(draftValue, { emitEvent: false });
              control.markAsDirty();
            }
          }
          this.form.markAsDirty();
          this.schema.set(schema);
          this.productTypes.update((types) =>
            types.map((type) => (type.id === schema.id ? schema : type)),
          );
          this.dirty.set(true);
          if (!this.canPrice()) {
            for (const row of this.form.controls.variants.controls) {
              const canonical = saved.variants.find(
                (variant) => variant.id === row.controls.id.value,
              );
              if (canonical) {
                row.patchValue(
                  { price: canonical.price, compareAtPrice: canonical.compareAtPrice },
                  { emitEvent: false },
                );
              }
            }
          }
          this.error.set('');
          this.notice.set(
            'Đã tải phiên bản mới. Nội dung đang nhập được giữ; kiểm tra rồi lưu lại.',
          );
        },
        error: (error: unknown) => {
          if (generation === this.generation) {
            this.setError(error, 'Không tải được phiên bản mới hoặc cấu trúc loại sản phẩm.');
          }
        },
      });
  }

  acceptCommerceProduct(product: ProductDto): void {
    if (this.item()?.id !== product.id) return;
    this.item.set(product);
    const currentSchema = this.schema();
    if (!this.form.dirty && currentSchema) {
      this.initializeProductForm(product);
      this.configureProductFields(currentSchema, product.fields);
      this.applyAccess();
      this.form.markAsPristine();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty || this.busy();
  }

  errorMessageFor(control: AbstractControl | undefined): string {
    return validationMessage(control);
  }

  dateValue(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  setDateValue(control: FormControl, value: Date | null): void {
    const formatted = value
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : null;
    this.setFieldValue(control, formatted);
  }

  setFieldValue(control: AbstractControl, value: string | number | boolean | null): void {
    if (this.fieldDisabled(control)) return;
    control.setValue(value);
    control.markAsDirty();
    this.form.markAsDirty();
  }

  fieldDisabled(control: AbstractControl): boolean {
    return control.disabled || this.commerceBusy() || this.mediaBusy() || this.busy();
  }

  choiceOptions(field: {
    choices: readonly { id: string; label: string; isActive: boolean }[];
  }): { label: string; value: string; disabled: boolean }[] {
    return field.choices.map((choice) => ({
      label: choice.label,
      value: choice.id,
      disabled: !choice.isActive,
    }));
  }

  private setProductIdentityReadonly(readonly: boolean): void {
    for (const control of [
      this.form.controls.productTypeId,
      this.form.controls.fulfillmentKind,
      this.form.controls.sku,
      this.form.controls.price,
    ]) {
      if (readonly) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    }
  }

  private initializeProductForm(item: ProductDto | null): void {
    this.form.controls.options.clear({ emitEvent: false });
    this.form.controls.variants.clear({ emitEvent: false });
    this.form.controls.media.clear({ emitEvent: false });
    this.form.reset(
      {
        name: item?.name ?? '',
        slug: item?.slug ?? '',
        description: item?.description ?? '',
        productTypeId: item?.productTypeId ?? '',
        categoryIds: [...(item?.categoryIds ?? [])],
        fulfillmentKind: item?.fulfillmentKind ?? ProductFulfillmentKind.Physical,
        sku: item?.variants.find((variant) => variant.isDefault)?.sku ?? '',
        price: item?.variants.find((variant) => variant.isDefault)?.price ?? 0,
        defaultVariantSku: item?.variants.find((variant) => variant.isDefault)?.sku ?? '',
        defaultVariantId: item?.variants.find((variant) => variant.isDefault)?.id ?? '',
      },
      { emitEvent: false },
    );
    for (const media of item?.media ?? []) {
      this.form.controls.media.push(createProductMediaForm(media), { emitEvent: false });
    }
    for (const option of item?.options ?? []) {
      this.form.controls.options.push(createOptionForm(option), { emitEvent: false });
    }
    const assignedMediaIds = new Set(
      item?.variants.flatMap((variant) => [
        variant.imageMediaId,
        ...(variant.images ?? []).map((image) => image.mediaAssetId),
      ]) ?? [],
    );
    const legacyGallery =
      item?.media.filter((media) => !assignedMediaIds.has(media.mediaAssetId)) ?? [];
    const rawVariants = [...(item?.variants ?? [])];
    if (item?.options?.length) {
      rawVariants.sort((a, b) => {
        for (const option of item.options) {
          const aSel = a.selections.find((s) => s.optionId === option.id);
          const bSel = b.selections.find((s) => s.optionId === option.id);
          const aIndex = aSel ? option.values.findIndex((v) => v.id === aSel.optionValueId) : -1;
          const bIndex = bSel ? option.values.findIndex((v) => v.id === bSel.optionValueId) : -1;
          if (aIndex !== bIndex) return aIndex - bIndex;
        }
        return 0;
      });
    }
    for (const variant of rawVariants) {
      const selection: Record<string, string> = {};
      for (const selected of variant.selections) {
        const option = item?.options.find((value) => value.id === selected.optionId);
        const value = option?.values.find((value) => value.id === selected.optionValueId);
        if (option && value) selection[option.code] = value.code;
      }
      const row = createSkuRow(variant.sku, selection, variant.price);
      row.patchValue(
        {
          id: variant.id,
          clientId: variant.id,
          trackInventory: variant.trackInventory ?? true,
          quantity: variant.quantity ?? null,
          inventoryVersion: variant.inventoryVersion ?? null,
          images: variant.images?.length
            ? variant.images
            : variant.isDefault
              ? legacyGallery.slice(variant.imageMediaId ? 0 : 1)
              : [],
          weight: variant.weight ?? null,
          width: variant.width ?? null,
          height: variant.height ?? null,
          length: variant.length ?? null,
          compareAtPrice: variant.compareAtPrice,
          isActive: variant.isActive,
          imageMediaId:
            variant.imageMediaId ??
            (variant.isDefault ? (legacyGallery[0]?.mediaAssetId ?? null) : null),
        },
        { emitEvent: false },
      );
      this.form.controls.variants.push(row, { emitEvent: false });
    }
    if (!item) {
      const row = createSkuRow('', {}, 0);
      this.form.controls.variants.push(row, { emitEvent: false });
      this.form.controls.defaultVariantId.setValue(row.controls.clientId.value, {
        emitEvent: false,
      });
    }
    this.setProductIdentityReadonly(!!item);
  }

  private fieldControlValue(
    definition: ProductFieldDefinition,
    existing?: ProductFieldValue,
  ): ProductFieldControlValue {
    if (existing) {
      return (
        existing.textValue ??
        existing.numberValue ??
        existing.booleanValue ??
        existing.dateValue ??
        existing.choiceId ??
        null
      );
    }
    return definition.dataType === ProductFieldType.Boolean ? false : null;
  }

  private typedFieldValue(
    type: ProductFieldType,
    value: Exclude<ProductFieldControlValue, null>,
  ): Partial<ProductFieldInput> {
    switch (type) {
      case ProductFieldType.Text:
        return { textValue: String(value).trim() };
      case ProductFieldType.Number:
        return { numberValue: Number(value) };
      case ProductFieldType.Boolean:
        return { booleanValue: Boolean(value) };
      case ProductFieldType.Date:
        return { dateValue: String(value) };
      case ProductFieldType.Choice:
        return { choiceId: String(value) };
    }
  }

  private configureProductFields(
    schema: ProductTypeLookup,
    values: readonly ProductFieldValue[] = [],
  ): void {
    const controls: any = this.form.controls.fields;
    for (const key of Object.keys(controls.controls)) {
      controls.removeControl(key, { emitEvent: false });
    }
    for (const definition of schema.fields) {
      const existing = values.find((value) => value.fieldDefinitionId === definition.id);
      if (!definition.isActive && !existing) continue;
      const value = this.fieldControlValue(definition, existing);
      const validators: ValidatorFn[] = [];
      if (definition.isRequired && definition.isActive) {
        validators.push((control) =>
          control.value === null ||
          control.value === '' ||
          (typeof control.value === 'string' && !control.value.trim())
            ? { required: true }
            : null,
        );
      }
      if (definition.dataType === ProductFieldType.Text) validators.push(Validators.maxLength(500));
      if (definition.dataType === ProductFieldType.Number) validators.push(fieldNumber);
      const control = new FormControl<ProductFieldControlValue>(value, validators);
      if (!definition.isActive) control.disable({ emitEvent: false });
      controls.addControl(definition.id, control, { emitEvent: false });
    }
  }

  private optionInputs(forms: readonly CreateOptionForm[]): ProductOptionInput[] {
    return forms.map((form) => {
      const raw = form.getRawValue();
      return {
        code: raw.code.trim().toUpperCase(),
        name: raw.name.trim(),
        values: raw.values.map((value) => ({
          code: value.code.trim().toUpperCase(),
          label: value.label.trim(),
        })),
      };
    });
  }

  private skuInputs(forms: readonly CreateSkuForm[]): ProductVariantInput[] {
    return forms.map((form) => {
      const raw = form.getRawValue();
      return {
        sku: raw.sku.trim(),
        price: raw.price,
        compareAtPrice: raw.compareAtPrice,
        options: raw.options,
        isActive: raw.isActive,
        imageMediaId: raw.imageMediaId,
      };
    });
  }

  private toProductContent(schema: ProductTypeLookup, original: ProductDto | null): ProductContent {
    const value = this.form.getRawValue();
    const fields: ProductFieldInput[] = [];
    for (const definition of schema.fields) {
      const control = this.form.controls.fields.controls[definition.id];
      if (!control) continue;
      const raw = control.value;
      if (!definition.isActive) {
        const previous = original?.fields.find(
          (field) => field.fieldDefinitionId === definition.id,
        );
        if (previous) {
          fields.push({
            fieldDefinitionId: previous.fieldDefinitionId,
            fieldType: previous.fieldType,
            textValue: previous.textValue,
            numberValue: previous.numberValue,
            booleanValue: previous.booleanValue,
            dateValue: previous.dateValue,
            choiceId: previous.choiceId,
          });
        }
      } else if (raw !== null && raw !== '' && !(typeof raw === 'string' && !raw.trim())) {
        fields.push({
          fieldDefinitionId: definition.id,
          fieldType: definition.dataType,
          ...this.typedFieldValue(definition.dataType, raw),
        });
      }
    }
    const referencedMedia = new Set(
      value.variants.flatMap((variant) => [
        variant.imageMediaId,
        ...variant.images.map((image) => image.mediaAssetId),
      ]),
    );
    return {
      name: value.name.trim(),
      slug: value.slug.trim().toLowerCase(),
      description: value.description.trim() || null,
      categoryIds: value.categoryIds,
      fields,
      media: value.media
        .filter((media) => referencedMedia.has(media.mediaAssetId))
        .map((media, index) => ({
          mediaAssetId: media.mediaAssetId,
          sortOrder: index,
          altText: media.altText?.trim() || null,
        })),
    };
  }

  private productConfiguration(
    allowPrice = true,
    original: ProductDto | null = null,
  ): CatalogConfiguration {
    const options = this.form.controls.options.controls;
    const optionKey = (option: (typeof options)[number]) =>
      option.controls.id.value || option.controls.clientId.value;
    const variants = this.form.controls.variants.controls;
    return {
      options: options.map((option) => ({
        id: optionKey(option),
        name: option.controls.name.value.trim(),
        values: option.controls.values.controls.map((value) => ({
          id: value.controls.id.value || value.controls.clientId.value,
          label: value.controls.label.value.trim(),
        })),
      })),
      variants: variants.map((row) => {
        const raw = row.getRawValue();
        const canonical = original?.variants.find((variant) => variant.id === raw.id);
        const selections: Record<string, string> = {};
        for (const option of options) {
          const value = option.controls.values.controls.find(
            (candidate) =>
              candidate.controls.code.value === raw.options[option.controls.code.value],
          );
          if (value) {
            selections[optionKey(option)] =
              value.controls.id.value || value.controls.clientId.value;
          }
        }
        return {
          ...raw,
          id: raw.id || raw.clientId,
          sku: raw.sku.trim(),
          price: allowPrice ? raw.price : (canonical?.price ?? null),
          compareAtPrice: allowPrice ? raw.compareAtPrice : (canonical?.compareAtPrice ?? null),
          selections,
        };
      }),
      defaultVariantId:
        this.form.controls.defaultVariantId.value || variants[0]?.controls.clientId.value || '',
    };
  }

  private productEditorRequest(
    schema: ProductTypeLookup,
    item: ProductDto,
    allowPrice = true,
  ): SaveProductEditor {
    const raw = this.form.getRawValue();
    return {
      id: item.id,
      configuration: this.productConfiguration(allowPrice, item),
      version: item.version,
      productTypeVersion: schema.version,
      content: this.toProductContent(schema, item),
      addedOptions: this.optionInputs(
        this.form.controls.options.controls.filter((option) => !option.controls.id.value),
      ),
      optionEdits: raw.options
        .filter((option) => !!option.id)
        .map((option) => ({
          optionId: option.id,
          name: option.name.trim(),
          sortOrder: option.sortOrder,
          addValues: option.values
            .filter((value) => !value.id)
            .map((value) => ({ code: value.code.trim().toUpperCase(), label: value.label.trim() })),
          values: option.values
            .filter((value) => !!value.id)
            .map((value) => ({
              id: value.id,
              label: value.label.trim(),
              sortOrder: value.sortOrder,
            })),
        })),
      variantEdits: raw.variants
        .filter((variant) => !!variant.id)
        .map((variant) => {
          const canonical = item.variants.find((value) => value.id === variant.id);
          return {
            variantId: variant.id,
            price: allowPrice ? variant.price : (canonical?.price ?? null),
            compareAtPrice: allowPrice
              ? variant.compareAtPrice
              : (canonical?.compareAtPrice ?? null),
            isActive: variant.isActive,
            imageMediaId: variant.imageMediaId,
          };
        }),
      addedVariants: raw.variants
        .filter((variant) => !variant.id)
        .map((variant) => ({
          sku: variant.sku.trim(),
          options: variant.options,
          price: allowPrice ? variant.price : null,
          compareAtPrice: allowPrice ? variant.compareAtPrice : null,
          isActive: variant.isActive,
          imageMediaId: variant.imageMediaId,
        })),
      defaultVariantSku:
        raw.defaultVariantSku || item.variants.find((variant) => variant.isDefault)?.sku || '',
    };
  }

  private captureCatalogIdentity() {
    return {
      options: this.form.controls.options.controls.map((option, position) => ({
        id: option.controls.id.value || option.controls.clientId.value,
        position,
        name: option.controls.name.value.trim(),
        values: option.controls.values.controls.map((value, valuePosition) => ({
          id: value.controls.id.value || value.controls.clientId.value,
          position: valuePosition,
          label: value.controls.label.value.trim(),
        })),
      })),
      variants: this.form.controls.variants.controls.map((variant) => {
        const selections: Record<string, string> = {};
        for (const option of this.form.controls.options.controls) {
          const value = option.controls.values.controls.find(
            (candidate) =>
              candidate.controls.code.value ===
              variant.controls.options.value[option.controls.code.value],
          );
          if (value) {
            selections[option.controls.id.value || option.controls.clientId.value] =
              value.controls.id.value || value.controls.clientId.value;
          }
        }
        return {
          id: variant.controls.id.value || variant.controls.clientId.value,
          selectionCodes: { ...variant.controls.options.value },
          selections,
        };
      }),
    };
  }

  private reconcileCatalogIdentity(saved: ProductDto, snapshot: any): void {
    for (const submitted of snapshot.options) {
      const savedOption = saved.options.find((option) => option.sortOrder === submitted.position);
      const currentOption = this.form.controls.options.controls.find(
        (option) => (option.controls.id.value || option.controls.clientId.value) === submitted.id,
      );
      if (!savedOption || !currentOption) continue;
      currentOption.patchValue(
        { id: savedOption.id, clientId: savedOption.id, sortOrder: savedOption.sortOrder },
        { emitEvent: false },
      );
      for (const submittedValue of submitted.values) {
        const savedValue = savedOption.values.find(
          (value) => value.sortOrder === submittedValue.position,
        );
        const currentValue = currentOption.controls.values.controls.find(
          (value) =>
            (value.controls.id.value || value.controls.clientId.value) === submittedValue.id,
        );
        if (savedValue && currentValue) {
          currentValue.patchValue(
            { id: savedValue.id, clientId: savedValue.id, sortOrder: savedValue.sortOrder },
            { emitEvent: false },
          );
        }
      }
    }

    const signature = (selections: readonly (readonly [string, string])[]) =>
      JSON.stringify([...selections].sort(([left], [right]) => left.localeCompare(right)));
    const submittedVariants = new Map<string, any>(
      snapshot.variants.map((variant: any) => [variant.id, variant]),
    );
    const variantsBySignature = new Map<string, ProductDto['variants'][number]>();
    for (const variant of saved.variants) {
      const selections: [string, string][] = [];
      for (const selection of variant.selections) {
        const option = saved.options.find((candidate) => candidate.id === selection.optionId);
        const value = option?.values.find((candidate) => candidate.id === selection.optionValueId);
        if (option && value) selections.push([option.name, value.label]);
      }
      variantsBySignature.set(signature(selections), variant);
    }

    const variantIds = new Map<string, string>();
    for (const row of this.form.controls.variants.controls) {
      const rowId = row.controls.id.value || row.controls.clientId.value;
      const submitted = submittedVariants.get(rowId);
      if (
        !submitted ||
        JSON.stringify(
          Object.entries(row.controls.options.value).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ) !==
          JSON.stringify(
            Object.entries(submitted.selectionCodes).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          )
      ) {
        continue;
      }
      const submittedSelectionLabels: [string, string][] = [];
      for (const [optionId, valueId] of Object.entries(submitted.selections)) {
        const option = snapshot.options.find((candidate: any) => candidate.id === optionId);
        const value = option?.values.find((candidate: any) => candidate.id === valueId);
        if (option && value) submittedSelectionLabels.push([option.name, value.label]);
      }
      const savedVariant = variantsBySignature.get(signature(submittedSelectionLabels));
      if (!savedVariant) continue;
      variantIds.set(rowId, savedVariant.id);
      row.patchValue(
        {
          id: savedVariant.id,
          clientId: savedVariant.id,
          inventoryVersion: savedVariant.inventoryVersion ?? null,
          inventoryOperationId: createOperationId(),
        },
        { emitEvent: false },
      );
    }

    const savedDefault = variantIds.get(this.form.controls.defaultVariantId.value);
    if (savedDefault) {
      this.form.controls.defaultVariantId.setValue(savedDefault, { emitEvent: false });
    }
  }

  private productFieldAliases(
    fields: readonly ProductFieldInput[],
  ): Readonly<Record<string, string>> {
    const aliases: Record<string, string> = { ...PRODUCT_FIELD_ALIASES };
    fields.forEach((field, index) => {
      for (const prefix of ['Content.Fields', 'content.fields', 'Fields', 'fields']) {
        const target = `fields.${field.fieldDefinitionId}`;
        aliases[`${prefix}[${index}]`] = target;
        for (const name of [
          'TextValue',
          'NumberValue',
          'BooleanValue',
          'DateValue',
          'ChoiceId',
          'FieldDefinitionId',
          'textValue',
          'numberValue',
          'booleanValue',
          'dateValue',
          'choiceId',
          'fieldDefinitionId',
        ]) {
          aliases[`${prefix}[${index}].${name}`] = target;
          aliases[`${prefix}.${index}.${name}`] = target;
        }
      }
    });
    return aliases;
  }

  private productEditorAliases(request: SaveProductEditor): Readonly<Record<string, string>> {
    const aliases: Record<string, string> = { ...this.productFieldAliases(request.content.fields) };
    const rows = this.form.controls.variants.controls;
    const addAliases = (
      prefix: string,
      index: number,
      target: string,
      fields: readonly string[],
    ) => {
      for (const field of fields) {
        for (const name of [prefix, `${prefix[0]?.toLowerCase() ?? ''}${prefix.slice(1)}`]) {
          const lower = `${field[0]?.toLowerCase() ?? ''}${field.slice(1)}`;
          aliases[`${name}[${index}].${field}`] = `${target}.${lower}`;
          aliases[`${name}[${index}].${lower}`] = `${target}.${lower}`;
        }
      }
    };
    request.variantEdits.forEach((variant, index) =>
      addAliases(
        'VariantEdits',
        index,
        `variants.${rows.findIndex((row) => row.controls.id.value === variant.variantId)}`,
        ['Price', 'CompareAtPrice', 'IsActive', 'ImageMediaId'],
      ),
    );
    request.addedVariants.forEach((variant, index) =>
      addAliases(
        'AddedVariants',
        index,
        `variants.${rows.findIndex((row) => !row.controls.id.value && row.controls.sku.value.trim() === variant.sku)}`,
        ['Sku', 'Price', 'CompareAtPrice', 'IsActive', 'ImageMediaId'],
      ),
    );
    request.optionEdits.forEach((option, index) => {
      const optionIndex = this.form.controls.options.controls.findIndex(
        (row) => row.controls.id.value === option.optionId,
      );
      addAliases('OptionEdits', index, `options.${optionIndex}`, ['Name', 'SortOrder']);
    });
    return aliases;
  }

  private prepareSave(): boolean {
    if (this.commerceBusy() || this.mediaBusy()) return false;
    const commerce = this.commerce();
    if (commerce && !commerce.finishOption()) return false;
    if (commerce?.expanded() && !commerce.closeRow()) return false;
    return !commerce?.expanded() && !this.commerceDraft();
  }

  private saveRequest(): Observable<ProductDto> {
    return defer(() => {
      if (!this.canWrite() || this.busy() || this.loading() || this.schemaLoading()) return EMPTY;
      clearServerErrors(this.form);
      this.summary.set([]);
      this.form.markAllAsTouched();
      const currentSchema = this.schema();
      if (this.form.invalid || !currentSchema) {
        this.error.set('Kiểm tra các trường được đánh dấu trước khi lưu.');
        return EMPTY;
      }
      const current = this.item();
      const catalogIdentity = this.captureCatalogIdentity();
      const content = this.toProductContent(currentSchema, current);
      const raw = this.form.getRawValue();
      const editorRequest = current
        ? this.productEditorRequest(currentSchema, current, this.canPrice())
        : null;
      const request: Observable<ProductDto> = editorRequest
        ? this.productsService.saveEditor(editorRequest)
        : this.productsService.create({
            productTypeId: currentSchema.id,
            productTypeVersion: currentSchema.version,
            content,
            options: this.optionInputs(this.form.controls.options.controls),
            variants: this.skuInputs(this.form.controls.variants.controls).map((variant) =>
              this.canPrice() ? variant : { ...variant, price: null, compareAtPrice: null },
            ),
            configuration: this.productConfiguration(this.canPrice()),
            fulfillmentKind: raw.fulfillmentKind,
            defaultVariantSku: raw.defaultVariantSku || raw.variants[0]?.sku || raw.sku.trim(),
          } satisfies CreateProduct);
      const aliases: Record<string, string> = {
        ...(editorRequest
          ? this.productEditorAliases(editorRequest)
          : this.productFieldAliases(content.fields)),
      };
      if (!current && raw.options.length) {
        raw.variants.forEach((_variant, index) => {
          for (const field of ['Sku', 'Price', 'CompareAtPrice']) {
            aliases[`Variants[${index}].${field}`] =
              `variants.${index}.${field[0]?.toLowerCase()}${field.slice(1)}`;
          }
        });
      }
      const generation = this.generation;
      const revision = this.revision;
      this.busy.set(true);
      this.setProductIdentityReadonly(true);
      this.error.set('');
      this.notice.set('');
      return request.pipe(
        take(1),
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        filter(() => generation === this.generation),
        tap((saved) => {
          this.item.set(saved);
          this.autoSlug = false;
          if (revision === this.revision) {
            this.initializeProductForm(saved);
            this.configureProductFields(currentSchema, saved.fields);
            this.form.markAsPristine();
            this.dirty.set(false);
            this.notice.set('Đã lưu sản phẩm.');
          } else {
            this.reconcileCatalogIdentity(saved, catalogIdentity);
            this.form.markAsDirty();
            this.dirty.set(true);
            this.notice.set('Đã lưu phiên bản trước. Thay đổi mới chưa được lưu.');
          }
        }),
        catchError((error: unknown) => {
          if (generation !== this.generation) return EMPTY;
          if (error instanceof ApiError) {
            this.summary.set(
              applyServerErrors(this.form, error.fieldErrors, aliases).flatMap(
                (issue) => issue.messages,
              ),
            );
          }
          this.setError(error, 'Không thể lưu sản phẩm. Nội dung đang sửa vẫn được giữ lại.');
          return EMPTY;
        }),
        finalize(() => {
          if (generation === this.generation) {
            this.busy.set(false);
            this.applyAccess();
          }
        }),
      );
    });
  }

  private loadSchema(id: string): void {
    this.schemaSubscription?.unsubscribe();
    const generation = this.generation;
    this.schema.set(null);
    this.schemaLoading.set(true);
    this.error.set('');
    this.schemaSubscription = this.productTypesService
      .getById(id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schema) => {
          if (generation !== this.generation) return;
          this.schema.set(schema);
          this.configureProductFields(schema);
          this.schemaLoading.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.schemaLoading.set(false);
          this.setError(error, 'Không tải được cấu trúc loại sản phẩm.');
        },
      });
  }

  private setError(error: unknown, fallback: string): void {
    this.error.set(
      error instanceof ApiError
        ? error.status === 409
          ? 'Dữ liệu đã thay đổi trên máy chủ. Nội dung của anh vẫn được giữ; tải lại bản ghi trước khi lưu tiếp.'
          : error.message
        : fallback,
    );
  }

  private applyAccess(): void {
    const wasDirty = this.form.dirty;
    if (!this.canWrite()) {
      if (this.form.enabled) this.form.disable({ emitEvent: false });
    } else {
      if (this.form.disabled) this.form.enable({ emitEvent: false });
      this.setProductIdentityReadonly(!!this.item() || this.busy());
      for (const option of this.form.controls.options.controls) {
        if (option.controls.id.value) {
          option.controls.code.disable({ emitEvent: false });
          for (const value of option.controls.values.controls) {
            if (value.controls.id.value) value.controls.code.disable({ emitEvent: false });
          }
        }
      }
      for (const variant of this.form.controls.variants.controls) {
        if (!this.canPrice()) {
          variant.controls.price.disable({ emitEvent: false });
          variant.controls.compareAtPrice.disable({ emitEvent: false });
        } else {
          variant.controls.price.enable({ emitEvent: false });
          variant.controls.compareAtPrice.enable({ emitEvent: false });
        }
        if (!this.canAdjust() || this.busy()) {
          variant.controls.quantity.disable({ emitEvent: false });
        } else {
          variant.controls.quantity.enable({ emitEvent: false });
        }
      }
      if (!this.canPrice()) this.form.controls.price.disable({ emitEvent: false });
      for (const field of this.schema()?.fields ?? []) {
        if (!field.isActive) {
          this.form.controls.fields.controls[field.id]?.disable({ emitEvent: false });
        }
      }
    }
    if (wasDirty) this.form.markAsDirty();
  }

  private cancelRequests(): void {
    this.cancelWrites.next();
    this.loadSubscription?.unsubscribe();
    this.schemaSubscription?.unsubscribe();
    this.writeSubscription?.unsubscribe();
  }
}
