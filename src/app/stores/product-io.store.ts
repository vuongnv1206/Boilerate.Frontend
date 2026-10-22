import { ProductFieldControlValue, ProductForm } from '@forms/product-form.model';
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
  forkJoin,
  map,
  of,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { PRODUCT_LIMITS } from '@constants/product.constants';
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';
import { ProductsService } from '@services/products.service';
import { ProductStatus } from '@enums/product.enum';
import { generateSkuRows, optionInputs, skuInputs } from '@forms/product-commerce.form';
import {
  configureProductFields,
  initializeProductForm,
  productSlug,
  productFieldAliases,
  setProductIdentityReadonly,
  toProductContent,
  productEditorRequest,
  productConfiguration,
  productEditorAliases,
  captureCatalogIdentity,
  reconcileCatalogIdentity,
} from '@forms/product.form';
import { ProductCategoryLookup, ProductTypeLookup } from '@models/product-lookups.dto';
import { CreateProduct, ProductDto } from '@models/product.dto';

/** Owns editor I/O and its form. All writes are explicit and optimistic-versioned. */
@Injectable()
export class ProductIoStore {
  private readonly session = inject(AuthSession);
  private readonly cancelWrites = new Subject<void>();
  private readonly summaryState = signal<readonly string[]>([]);
  readonly summary = this.summaryState.asReadonly();
  readonly canWrite = computed(() =>
    this.session.can('Product', this.item() ? 'Update' : 'Create'),
  );
  readonly canPublish = computed(() => this.session.can('Product', 'Publish'));
  readonly canDelete = computed(() => this.session.can('Product', 'Delete'));
  readonly canCreate = computed(() => this.session.can('Product', 'Create'));
  readonly canPrice = computed(() => this.session.can('Price', 'Update'));
  private readonly service = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private currentForm: ProductForm | null = null;
  private readonly itemState = signal<ProductDto | null>(null);
  private readonly categoriesState = signal<readonly ProductCategoryLookup[]>([]);
  private readonly typesState = signal<readonly ProductTypeLookup[]>([]);
  private readonly schemaState = signal<ProductTypeLookup | null>(null);
  private readonly loadingState = signal(false);
  private readonly schemaLoadingState = signal(false);
  private readonly busyState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  private readonly dirtyState = signal(false);
  private readonly loadedState = signal(false);
  readonly item = this.itemState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly productTypes = this.typesState.asReadonly();
  readonly schema = this.schemaState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly schemaLoading = this.schemaLoadingState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly dirty = this.dirtyState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly isNew = computed(() => this.item() === null);
  readonly title = computed(() => this.item()?.name ?? 'Sản phẩm mới');
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
  private loadSubscription?: Subscription;
  private schemaSubscription?: Subscription;
  private writeSubscription?: Subscription;
  private generation = 0;
  private revision = 0;
  private autoSlug = true;

  constructor() {
    effect(() => {
      this.canWrite();
      this.applyAccess();
    });
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.cancelRequests();
    });
  }

  get form(): ProductForm {
    if (!this.currentForm) throw new Error('Set the editor form before loading data.');
    return this.currentForm;
  }

  setForm(form: ProductForm): void {
    if (this.currentForm) throw new Error('The editor form is already set.');
    this.currentForm = form;
    this.applyAccess();

    this.form.controls.slug.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.autoSlug = false;
    });
    this.form.controls.name.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        if (this.autoSlug && this.isNew())
          this.form.controls.slug.setValue(productSlug(name), { emitEvent: false });
      });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision++;
      this.summaryState.set([]);
      clearServerErrors(this.form);
      this.dirtyState.set(this.form.dirty);
      this.noticeState.set('');
    });
    this.form.controls.productTypeId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (!this.isNew() || !id) return;
        this.loadSchema(id);
      });
  }

  load(id: string | null, duplicateFrom: string | null = null): void {
    this.generation++;
    this.cancelRequests();
    const generation = this.generation;
    this.loadingState.set(true);
    this.busyState.set(false);
    this.schemaLoadingState.set(false);
    this.loadedState.set(false);
    this.errorState.set('');
    this.noticeState.set('');
    this.dirtyState.set(false);
    this.itemState.set(null);
    this.schemaState.set(null);
    this.autoSlug = !id;
    this.summaryState.set([]);
    this.revision = 0;
    initializeProductForm(this.form, null);
    const sourceId = id || duplicateFrom;
    this.loadSubscription = forkJoin({
      item: sourceId ? this.service.get(sourceId) : of(null),
      categories: this.service.categories(),
      types: this.service.productTypes(),
    })
      .pipe(
        switchMap((result) => {
          const typeId =
            result.item?.productTypeId ?? result.types.find((type) => type.isActive)?.id;
          const schemaRequest: Observable<ProductTypeLookup | null> = typeId
            ? this.service.productType(typeId)
            : of(null);
          return schemaRequest.pipe(map((schema) => ({ ...result, schema })));
        }),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ item, categories, types, schema }) => {
          if (generation !== this.generation) return;
          this.itemState.set(duplicateFrom ? null : item);
          this.categoriesState.set(
            categories.filter(
              (category) => category.isActive || item?.categoryIds.includes(category.id),
            ),
          );
          this.typesState.set(
            types.filter((type) => type.isActive || type.id === item?.productTypeId),
          );
          this.schemaState.set(schema);
          initializeProductForm(this.form, item);
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
              option.controls.clientId.setValue(crypto.randomUUID(), { emitEvent: false });
              for (const value of option.controls.values.controls) {
                value.controls.id.setValue('', { emitEvent: false });
                value.controls.clientId.setValue(crypto.randomUUID(), { emitEvent: false });
              }
            }
            for (const row of this.form.controls.variants.controls) {
              const copySku = row.controls.sku.value
                ? `${row.controls.sku.value.slice(0, PRODUCT_LIMITS.sku - 5)}-COPY`
                : '';
              row.patchValue(
                {
                  id: '',
                  clientId: crypto.randomUUID(),
                  sku: copySku,
                  quantity: 0,
                  inventoryVersion: null,
                },
                { emitEvent: false },
              );
              if (!this.canPrice())
                row.patchValue({ price: null, compareAtPrice: null }, { emitEvent: false });
            }
            if (defaultRow) {
              this.form.controls.sku.setValue(defaultRow.controls.sku.value, { emitEvent: false });
              this.form.controls.defaultVariantSku.setValue(defaultRow.controls.sku.value, {
                emitEvent: false,
              });
            }
            if (!this.canPrice()) this.form.controls.price.setValue(null, { emitEvent: false });
            this.form.controls.defaultVariantId.setValue(
              defaultRow?.controls.clientId.value || '',
              { emitEvent: false },
            );
          }
          if (schema) {
            this.form.controls.productTypeId.setValue(schema.id, { emitEvent: false });
            configureProductFields(this.form, schema, item?.fields);
          }
          this.applyAccess();
          this.form.markAsPristine();
          if (duplicateFrom) {
            this.form.markAsDirty();
            this.dirtyState.set(true);
            this.noticeState.set(
              this.canPrice()
                ? 'Bản sao chưa được tạo. Kiểm tra đường dẫn rồi lưu sản phẩm mới.'
                : 'Bản sao chưa được tạo. Giá không được sao chép vì chưa có quyền cập nhật giá; kiểm tra đường dẫn rồi lưu sản phẩm mới.',
            );
          }
          this.loadingState.set(false);
          this.loadedState.set(true);
          if (!schema)
            this.errorState.set('Chưa có loại sản phẩm hoạt động. Hãy tạo loại sản phẩm trước.');
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.loadingState.set(false);
          this.setError(error, 'Không thể tải sản phẩm. Vui lòng thử lại.');
        },
      });
  }

  deleteProduct(): Observable<boolean> {
    return defer(() => {
      const item = this.item();
      if (!item || !this.canDelete() || this.busy()) return EMPTY;
      this.busyState.set(true);
      return this.service.deleteProduct(item.id, item.version).pipe(
        tap(() => {
          this.form.markAsPristine();
          this.dirtyState.set(false);
          this.busyState.set(false);
        }),
        catchError((error: unknown) => {
          this.setError(error, 'Không xóa được sản phẩm.');
          return EMPTY;
        }),
        finalize(() => this.busyState.set(false)),
        takeUntilDestroyed(this.destroyRef),
      );
    });
  }

  save(): Observable<ProductDto> {
    return defer(() => {
      if (!this.canWrite() || this.busy() || this.loading() || this.schemaLoading()) return EMPTY;
      clearServerErrors(this.form);
      this.summaryState.set([]);
      this.form.markAllAsTouched();
      const schema = this.schema();
      if (this.form.invalid || !schema) {
        this.errorState.set('Kiểm tra các trường được đánh dấu trước khi lưu.');
        return EMPTY;
      }
      const item = this.item();
      const catalogIdentity = captureCatalogIdentity(this.form);
      const content = toProductContent(this.form, schema, item);
      const raw = this.form.getRawValue();
      const editorRequest = item
        ? productEditorRequest(this.form, schema, item, this.canPrice())
        : null;
      const request: Observable<ProductDto> = editorRequest
        ? this.service.saveEditor(editorRequest)
        : this.service.create({
            productTypeId: schema.id,
            productTypeVersion: schema.version,
            content,
            options: optionInputs(this.form.controls.options.controls),
            variants: this.form.controls.options.length
              ? skuInputs(this.form.controls.variants.controls).map((variant) =>
                  this.canPrice() ? variant : { ...variant, price: null, compareAtPrice: null },
                )
              : [
                  {
                    sku: raw.sku.trim(),
                    price: this.canPrice() ? raw.price : null,
                    compareAtPrice: null,
                    options: {},
                  },
                ],
            configuration: productConfiguration(this.form, this.canPrice()),
            fulfillmentKind: raw.fulfillmentKind,
            defaultVariantSku: raw.defaultVariantSku || raw.variants[0]?.sku || raw.sku.trim(),
          } satisfies CreateProduct);
      const aliases = {
        ...(editorRequest
          ? productEditorAliases(editorRequest, this.form)
          : productFieldAliases(content.fields)),
      };
      if (!item && raw.options.length) {
        raw.variants.forEach((_variant, index) => {
          for (const field of ['Sku', 'Price', 'CompareAtPrice'])
            aliases[`Variants[${index}].${field}`] =
              `variants.${index}.${field[0]?.toLowerCase()}${field.slice(1)}`;
        });
      }
      const generation = this.generation;
      const revision = this.revision;
      this.busyState.set(true);
      setProductIdentityReadonly(this.form, true);
      this.errorState.set('');
      this.noticeState.set('');
      return request.pipe(
        take(1),
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        filter(() => generation === this.generation),
        tap((saved) => {
          this.itemState.set(saved);
          this.autoSlug = false;
          if (revision === this.revision) {
            initializeProductForm(this.form, saved);
            configureProductFields(this.form, schema, saved.fields);
            this.form.markAsPristine();
            this.dirtyState.set(false);
            this.noticeState.set('Đã lưu sản phẩm.');
          } else {
            reconcileCatalogIdentity(this.form, saved, catalogIdentity);
            this.form.markAsDirty();
            this.dirtyState.set(true);
            this.noticeState.set('Đã lưu phiên bản trước. Thay đổi mới chưa được lưu.');
          }
        }),
        catchError((error: unknown) => {
          if (generation !== this.generation) return EMPTY;
          if (error instanceof ApiError)
            this.summaryState.set(
              applyServerErrors(this.form, error.fieldErrors, aliases).flatMap(
                (issue) => issue.messages,
              ),
            );
          this.setError(error, 'Không thể lưu sản phẩm. Nội dung đang sửa vẫn được giữ lại.');
          return EMPTY;
        }),
        finalize(() => {
          if (generation === this.generation) {
            this.busyState.set(false);
            this.applyAccess();
          }
        }),
      );
    });
  }

  changeStatus(status: ProductStatus): void {
    const item = this.item();
    if (!this.canPublish() || !item || this.busy() || this.form.dirty) return;
    const generation = this.generation;
    this.busyState.set(true);
    this.errorState.set('');
    this.writeSubscription = this.service
      .changeStatus({ id: item.id, version: item.version, status })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          if (generation !== this.generation) return;
          this.itemState.set(saved);
          this.busyState.set(false);
          this.noticeState.set('Đã cập nhật trạng thái sản phẩm.');
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.busyState.set(false);
          this.setError(error, 'Không thể cập nhật trạng thái sản phẩm.');
        },
      });
  }

  dismissNotice(): void {
    this.noticeState.set('');
  }

  generateSkus(): void {
    if (!this.isNew() || !this.canWrite()) return;
    this.form.controls.options.markAllAsTouched();
    if (this.form.controls.options.invalid) {
      this.errorState.set('Kiểm tra mã và tên lựa chọn trước khi tạo tổ hợp.');
      return;
    }
    try {
      const rows = generateSkuRows(
        optionInputs(this.form.controls.options.controls),
        this.form.controls.sku.value,
        this.canPrice() ? this.form.controls.price.value : null,
        this.form.controls.variants.controls,
      );
      this.form.controls.variants.clear({ emitEvent: false });
      rows.forEach((row) => this.form.controls.variants.push(row, { emitEvent: false }));
      this.form.markAsDirty();
      this.form.updateValueAndValidity();
      this.dirtyState.set(true);
      this.errorState.set('');
    } catch (error: unknown) {
      this.errorState.set(error instanceof Error ? error.message : 'Không tạo được tổ hợp SKU.');
    }
  }

  acceptCommerceProduct(product: ProductDto): void {
    if (this.item()?.id !== product.id) return;
    this.itemState.set(product);
    const schema = this.schema();
    if (!this.form.dirty && schema) {
      initializeProductForm(this.form, product);
      configureProductFields(this.form, schema, product.fields);
      this.applyAccess();
      this.form.markAsPristine();
    }
  }

  discard(): void {
    const schema = this.schema();
    initializeProductForm(this.form, this.item());
    if (schema) configureProductFields(this.form, schema, this.item()?.fields);
    this.applyAccess();
    this.form.markAsPristine();
    this.dirtyState.set(false);
    this.errorState.set('');
    this.summaryState.set([]);
  }

  reloadCanonical(): void {
    const item = this.item();
    if (!item || this.busy()) return;
    const generation = this.generation;
    const draftFields: Record<string, ProductFieldControlValue> = {};
    for (const [id, control] of Object.entries(this.form.controls.fields.controls)) {
      if (control.dirty) draftFields[id] = control.value;
    }
    this.busyState.set(true);
    this.schemaLoadingState.set(true);
    this.errorState.set('');
    this.service
      .get(item.id)
      .pipe(
        switchMap((saved) =>
          this.service.productType(saved.productTypeId).pipe(map((schema) => ({ saved, schema }))),
        ),
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) {
            this.busyState.set(false);
            this.schemaLoadingState.set(false);
          }
        }),
      )
      .subscribe({
        next: ({ saved, schema }) => {
          if (generation !== this.generation) return;
          this.itemState.set(saved);
          configureProductFields(this.form, schema, saved.fields);
          for (const definition of schema.fields) {
            const control = this.form.controls.fields.controls[definition.id];
            const draftValue = draftFields[definition.id];
            if (control && draftValue !== undefined) {
              control.setValue(draftValue, { emitEvent: false });
              control.markAsDirty();
            }
          }
          this.form.markAsDirty();
          this.schemaState.set(schema);
          this.typesState.update((types) =>
            types.map((type) => (type.id === schema.id ? schema : type)),
          );
          this.dirtyState.set(true);
          if (!this.canPrice()) {
            for (const row of this.form.controls.variants.controls) {
              const canonical = saved.variants.find(
                (variant) => variant.id === row.controls.id.value,
              );
              if (canonical)
                row.patchValue(
                  { price: canonical.price, compareAtPrice: canonical.compareAtPrice },
                  { emitEvent: false },
                );
            }
          }
          this.errorState.set('');
          this.noticeState.set(
            'Đã tải phiên bản mới. Nội dung đang nhập được giữ; kiểm tra rồi lưu lại.',
          );
        },
        error: (error: unknown) => {
          if (generation === this.generation)
            this.setError(error, 'Không tải được phiên bản mới hoặc cấu trúc loại sản phẩm.');
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty || this.busy();
  }

  private loadSchema(id: string): void {
    this.schemaSubscription?.unsubscribe();
    const generation = this.generation;
    this.schemaState.set(null);
    this.schemaLoadingState.set(true);
    this.errorState.set('');
    this.schemaSubscription = this.service
      .productType(id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schema) => {
          if (generation !== this.generation) return;
          this.schemaState.set(schema);
          configureProductFields(this.form, schema);
          this.schemaLoadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.schemaLoadingState.set(false);
          this.setError(error, 'Không tải được cấu trúc loại sản phẩm.');
        },
      });
  }

  private setError(error: unknown, fallback: string): void {
    this.errorState.set(
      error instanceof ApiError
        ? error.status === 409
          ? 'Dữ liệu đã thay đổi trên máy chủ. Nội dung của anh vẫn được giữ; tải lại bản ghi trước khi lưu tiếp.'
          : error.message
        : fallback,
    );
  }

  private applyAccess(): void {
    if (!this.currentForm) return;
    const wasDirty = this.currentForm.dirty;
    if (!this.canWrite()) {
      if (this.currentForm.enabled) this.currentForm.disable({ emitEvent: false });
    } else {
      if (this.currentForm.disabled) this.currentForm.enable({ emitEvent: false });
      setProductIdentityReadonly(this.currentForm, !!this.item() || this.busy());
      for (const option of this.currentForm.controls.options.controls) {
        if (option.controls.id.value) {
          option.controls.code.disable({ emitEvent: false });
          for (const value of option.controls.values.controls)
            if (value.controls.id.value) value.controls.code.disable({ emitEvent: false });
        }
      }
      for (const variant of this.currentForm.controls.variants.controls) {
        if (!this.canPrice()) {
          variant.controls.price.disable({ emitEvent: false });
          variant.controls.compareAtPrice.disable({ emitEvent: false });
        }
      }
      if (!this.canPrice()) this.currentForm.controls.price.disable({ emitEvent: false });
      for (const field of this.schema()?.fields ?? [])
        if (!field.isActive)
          this.currentForm.controls.fields.controls[field.id]?.disable({ emitEvent: false });
    }
    if (wasDirty) this.currentForm.markAsDirty();
  }

  private cancelRequests(): void {
    this.cancelWrites.next();
    this.loadSubscription?.unsubscribe();
    this.schemaSubscription?.unsubscribe();
    this.writeSubscription?.unsubscribe();
  }
}
