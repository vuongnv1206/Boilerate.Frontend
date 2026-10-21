import { ProductForm } from '@forms/product-form.model';
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
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';
import { ProductsService } from '@services/products.service';
import { ProductStatus } from '@enums/product.enum';
import {
  configureProductFields,
  initializeProductForm,
  productSlug,
  productFieldAliases,
  setProductIdentityReadonly,
  toProductContent,
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

  load(id: string | null): void {
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
    this.loadSubscription = forkJoin({
      item: id ? this.service.get(id) : of(null),
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
          this.itemState.set(item);
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
          if (schema) {
            this.form.controls.productTypeId.setValue(schema.id, { emitEvent: false });
            configureProductFields(this.form, schema, item?.fields);
          }
          this.applyAccess();
          this.form.markAsPristine();
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
      const content = toProductContent(this.form, schema, item);
      const raw = this.form.getRawValue();
      const request: Observable<ProductDto> = item
        ? this.service.edit({
            id: item.id,
            version: item.version,
            productTypeVersion: schema.version,
            content,
          })
        : this.service.create({
            productTypeId: schema.id,
            productTypeVersion: schema.version,
            content,
            options: [],
            variants: [
              { sku: raw.sku.trim(), price: raw.price ?? 0, compareAtPrice: null, options: {} },
            ],
            fulfillmentKind: raw.fulfillmentKind,
          } satisfies CreateProduct);
      const aliases = productFieldAliases(content.fields);
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
    if (!this.canWrite()) {
      if (this.currentForm.enabled) this.currentForm.disable({ emitEvent: false });
    } else {
      if (this.currentForm.disabled) this.currentForm.enable({ emitEvent: false });
      setProductIdentityReadonly(this.currentForm, !!this.item() || this.busy());
      for (const field of this.schema()?.fields ?? [])
        if (!field.isActive)
          this.currentForm.controls.fields.controls[field.id]?.disable({ emitEvent: false });
    }
  }

  private cancelRequests(): void {
    this.cancelWrites.next();
    this.loadSubscription?.unsubscribe();
    this.schemaSubscription?.unsubscribe();
    this.writeSubscription?.unsubscribe();
  }
}
