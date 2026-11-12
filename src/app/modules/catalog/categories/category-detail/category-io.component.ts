import {
  Component,
  HostListener,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  concatMap,
  defer,
  distinctUntilChanged,
  expand,
  filter,
  finalize,
  forkJoin,
  map,
  of,
  reduce,
  takeUntil,
  tap,
} from 'rxjs';
import { AutoComplete } from 'primeng/autocomplete';
import type {
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/types/autocomplete';
import { BaseComponent } from '@core/base/base.component';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { ApiError } from '@core/http/api-error';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CATEGORY_LIMITS,
  CATEGORY_SLUG_PATTERN,
  CategoryDto,
  CategoryProductChange,
  CategoryProductIssueItem,
  CategoryProductResult,
  SaveCategoryRequest,
} from '@api/catalog/models/category.dto';
import {
  ProductDto,
  ProductPage,
  ProductSearch,
  ProductSummary,
} from '@api/catalog/models/product.dto';
import { CategoriesService } from '@api/catalog/services/categories.service';
import { ProductsService } from '@api/catalog/services/products.service';
import { CategoriesWorkspace } from '../categories-workspace.component';

@Component({
  selector: 'app-category-io',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './category-io.component.html',
})
export class CategoryIo extends BaseComponent implements OnInit {
  // System variables
  private readonly productPicker = viewChild(AutoComplete);
  private readonly cancelWrites = new Subject<void>();
  private loadSubscription?: Subscription;
  private membershipSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private generation = 0;
  private searchGeneration = 0;
  private revision = 0;
  private currentId = 'new';

  // Business variables
  readonly form = this.buildForm();
  readonly limits = CATEGORY_LIMITS;
  readonly productSearch = new FormControl<string | ProductSummary | null>(null);
  readonly productSuggestions = signal<ProductSummary[]>([]);
  readonly deleteVisible = signal(false);

  readonly record = signal<CategoryDto | null>(null);
  readonly allCategories = signal<readonly CategoryDto[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly ready = signal(false);
  readonly summary = signal<readonly string[]>([]);
  readonly selectedProducts = signal<readonly ProductSummary[]>([]);
  readonly productBaseline = signal<ReadonlyMap<string, ProductSummary>>(new Map());
  readonly productResults = signal<readonly ProductSummary[]>([]);
  readonly productQuery = signal('');
  readonly productLoading = signal(false);
  readonly productSearchLoading = signal(false);
  readonly productError = signal('');
  readonly productSearchError = signal('');
  readonly productIssues = signal<readonly CategoryProductIssueItem[]>([]);
  readonly productReconcileRequired = signal(false);
  readonly pendingDuplicate = signal<{
    record: CategoryDto;
    products: readonly ProductSummary[];
  } | null>(null);

  readonly canWrite = computed(() => this.can('Category', this.record() ? 'Update' : 'Create'));
  readonly canViewProducts = computed(() => this.can('Product', 'View'));
  readonly canManageProducts = computed(
    () =>
      (this.record() !== null || this.canWrite()) &&
      this.canViewProducts() &&
      this.can('Product', 'Update'),
  );
  readonly productsDirty = computed(() => {
    const baseline = this.productBaseline();
    const selected = this.selectedProducts();
    return baseline.size !== selected.length || selected.some((item) => !baseline.has(item.id));
  });
  readonly canSave = computed(
    () =>
      this.canWrite() ||
      (this.record() !== null && this.canManageProducts() && this.productsDirty()),
  );
  readonly partialCopy = computed(() => this.pendingDuplicate()?.record ?? null);
  readonly availableProducts = computed(() => {
    const selected = new Set(this.selectedProducts().map((item) => item.id));
    return this.productResults().filter((item) => !selected.has(item.id));
  });
  readonly rawParentOptions = computed(() => {
    const current = this.record()?.id;
    const excluded = new Set(current ? [current] : []);
    let count = -1;
    while (count !== excluded.size) {
      count = excluded.size;
      this.allCategories().forEach((item) => {
        if (item.parentId && excluded.has(item.parentId)) excluded.add(item.id);
      });
    }
    return this.allCategories().filter((item) => !excluded.has(item.id));
  });
  readonly parentOptions = computed(() => [
    { id: '', label: 'Không có danh mục cha' },
    ...this.rawParentOptions().map((parent) => ({
      id: parent.id,
      label: this.categoryPath(parent.id),
    })),
  ]);

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly injector: Injector,
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
    readonly categories: CategoriesWorkspace,
    readonly confirmation: LeaveConfirmation,
  ) {
    super();
    effect(() => {
      this.canWrite();
      this.applyAccess();
    });
    effect(() => {
      if (this.productSearchLoading()) return;
      this.productSuggestions.set(this.productSearchError() ? [] : [...this.availableProducts()]);
      afterNextRender(() => this.productPicker()?.overlayViewChild()?.alignOverlay(), {
        injector: this.injector,
      });
    });
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.searchGeneration++;
      this.cancelWrites.next();
      this.loadSubscription?.unsubscribe();
      this.membershipSubscription?.unsubscribe();
      this.searchSubscription?.unsubscribe();
    });
  }

  private buildForm() {
    return new FormGroup({
      name: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/\S/u),
          Validators.maxLength(CATEGORY_LIMITS.name),
        ],
      }),
      slug: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(CATEGORY_SLUG_PATTERN),
          Validators.maxLength(CATEGORY_LIMITS.slug),
        ],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(CATEGORY_LIMITS.description)],
      }),
      parentId: new FormControl('', { nonNullable: true }),
      sortOrder: new FormControl(0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
      }),
      isActive: new FormControl(true, { nonNullable: true }),
    });
  }

  private categoryFormValue(category?: CategoryDto) {
    return {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      parentId: category?.parentId ?? '',
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
    };
  }

  private categoryRequest(original: CategoryDto | null): SaveCategoryRequest {
    const value = this.form.getRawValue();
    return {
      id: original?.id ?? null,
      version: original?.version ?? null,
      ...value,
      name: value.name.trim(),
      slug: value.slug.trim().toLowerCase(),
      description: value.description.trim() || null,
      parentId: value.parentId || null,
    };
  }

  ngOnInit(): void {
    this.applyAccess();
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision++;
      this.summary.set([]);
      this.saved.set(false);
      clearServerErrors(this.form);
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.productSearch.reset(null, { emitEvent: false });
        this.load(id);
      });
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.form.dirty ||
      this.productsDirty() ||
      this.productReconcileRequired() ||
      this.productIssues().length ||
      this.saving()
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  load(id: string): void {
    const pendingCopy = this.pendingDuplicate();
    const copyDraft =
      pendingCopy && pendingCopy.record.id === id ? pendingCopy.products : undefined;
    if (copyDraft) this.pendingDuplicate.set(null);
    this.currentId = id;
    this.cancelWrites.next();
    this.membershipSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.searchGeneration++;
    this.summary.set([]);
    this.ready.set(false);
    const generation = ++this.generation;
    this.loadSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.productError.set('');
    this.productSearchError.set('');
    this.productIssues.set([]);
    this.productReconcileRequired.set(false);
    this.selectedProducts.set([]);
    this.productBaseline.set(new Map());
    this.productResults.set([]);
    this.productQuery.set('');
    this.productLoading.set(false);
    this.productSearchLoading.set(false);
    this.record.set(null);
    this.saved.set(false);
    this.saving.set(false);
    this.form.reset(this.categoryFormValue(), { emitEvent: false });
    this.loadSubscription = this.categoriesService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (generation !== this.generation) return;
          this.allCategories.set(items);
          const item = id === 'new' ? undefined : items.find((entry) => entry.id === id);
          this.loading.set(false);
          if (id !== 'new' && !item) {
            this.error.set('Không tìm thấy danh mục này.');
            return;
          }
          this.record.set(item ?? null);
          this.form.reset(this.categoryFormValue(item), { emitEvent: false });
          this.ready.set(true);
          this.applyAccess();
          if (item && this.canViewProducts()) {
            this.loadMemberships(item.id, generation, copyDraft);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(error instanceof ApiError ? error.message : 'Không thể tải danh mục.');
        },
      });
  }

  save(): void {
    const wasNew = !this.route.snapshot.paramMap.has('id');
    this.saveRequest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.categories.upsert(saved);
        this.categories.load();
        if (wasNew && !this.form.dirty) {
          void this.router.navigate(['/admin/collections/categories', saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
        }
      });
  }

  searchProducts(event: AutoCompleteCompleteEvent): void {
    this.runProductSearch(event.query);
  }

  runProductSearch(query: string): void {
    this.productQuery.set(query);
    this.productSearchError.set('');
    if (!this.canManageProducts()) {
      this.productResults.set([]);
      return;
    }
    this.searchSubscription?.unsubscribe();
    const generation = ++this.searchGeneration;
    this.productSearchLoading.set(true);
    const search = query.trim();
    const request: ProductSearch = {
      pageNumber: 1,
      pageSize: 20,
      ...(search ? { search } : {}),
      sortBy: 'name',
      sortDirection: 'asc',
    };
    this.searchSubscription = this.productsService
      .search(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (generation !== this.searchGeneration) return;
          this.productResults.set(page.items);
          this.productSearchLoading.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.searchGeneration) return;
          this.productSearchLoading.set(false);
          this.productSearchError.set(
            error instanceof ApiError ? error.message : 'Không thể tìm sản phẩm.',
          );
        },
      });
  }

  selectProduct(event: AutoCompleteSelectEvent): void {
    const product = event.value as ProductSummary;
    this.addProduct(product);
    if (product.version) {
      this.productSearch.reset(null, { emitEvent: false });
      this.runProductSearch('');
    }
  }

  addProduct(product: ProductSummary): void {
    if (
      !this.canManageProducts() ||
      this.productLoading() ||
      this.saving() ||
      this.selectedProducts().some((item) => item.id === product.id)
    ) {
      return;
    }
    if (!product.version) {
      this.productSearchError.set('Sản phẩm thiếu phiên bản. Tải lại kết quả trước khi thêm.');
      return;
    }
    this.selectedProducts.update((items) => [...items, product]);
    this.productSearchError.set('');
    this.productError.set('');
  }

  removeProduct(id: string): void {
    if (!this.canManageProducts() || this.productLoading() || this.saving()) return;
    this.selectedProducts.update((items) => items.filter((item) => item.id !== id));
    this.productError.set('');
  }

  archive(): void {
    if (!this.canWrite() || !this.form.controls.isActive.value) return;
    this.form.controls.isActive.setValue(false);
    this.save();
  }

  duplicate(): void {
    this.duplicateRequest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((copy) => {
        this.categories.upsert(copy);
        this.categories.load();
        void this.router.navigate(['/admin/collections/categories', copy.id], {
          queryParamsHandling: 'preserve',
        });
      });
  }

  delete(): void {
    const current = this.record();
    if (!current || !this.categories.canDelete()) return;
    this.categories
      .delete(current)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deleted) => {
        if (!deleted) return;
        this.deleteVisible.set(false);
        void this.router.navigate(['/admin/collections/categories'], {
          queryParamsHandling: 'preserve',
        });
      });
  }

  categoryUrlPreview(): string {
    return `/category/${this.form.controls.slug.value.trim() || 'slug'}`;
  }

  activityDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? '—'
      : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) {
      this.load(this.currentId);
    }
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.form.dirty ||
        this.productsDirty() ||
        this.productReconcileRequired() ||
        this.productIssues().length > 0,
      this.saving(),
    );
  }

  validation(control: AbstractControl): string {
    return validationMessage(control);
  }

  invalid(field: keyof CategoryIo['form']['controls']): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  serverError(field: keyof CategoryIo['form']['controls']): string {
    const errors: unknown = this.form.controls[field].errors?.['server'];
    return Array.isArray(errors) ? errors.join(' ') : '';
  }

  categoryPath(id: string): string {
    const byId = new Map(this.allCategories().map((item) => [item.id, item]));
    const names: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' / ') || id;
  }

  reconcileProducts(): void {
    const category = this.record();
    if (!category || !this.canViewProducts() || this.saving() || this.productLoading()) return;
    const generation = this.generation;
    const baseline = this.productBaseline();
    const selected = new Map(this.selectedProducts().map((item) => [item.id, item]));
    const removed = [...baseline.values()].filter((item) => !selected.has(item.id));
    const added = [...selected.values()].filter((item) => !baseline.has(item.id));
    const pending = [
      ...removed.map((product) => ({ product, included: false })),
      ...added.map((product) => ({ product, included: true })),
    ];
    this.membershipSubscription?.unsubscribe();
    this.productLoading.set(true);
    this.productError.set('');
    this.membershipSubscription = this.membershipPages(category.id)
      .pipe(
        concatMap((items) => {
          if (!pending.length) return of({ items, checked: [] });
          return forkJoin(
            pending.map((change) =>
              this.productsService.getById(change.product.id).pipe(
                map((product: ProductDto) => ({ ...change, version: product.version, error: '' })),
                catchError((error: unknown) =>
                  of({
                    ...change,
                    version: '',
                    error:
                      error instanceof ApiError && (error.status === 403 || error.status === 404)
                        ? 'Sản phẩm đã bị xóa hoặc bạn không còn quyền truy cập.'
                        : 'Chưa kiểm tra được phiên bản sản phẩm. Thử đối chiếu lại.',
                  }),
                ),
              ),
            ),
          ).pipe(map((checked) => ({ items, checked })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ items, checked }) => {
          if (generation !== this.generation) return;
          if (items.some((item) => !item.version)) {
            this.productError.set(
              'Có sản phẩm thiếu phiên bản. Bản nhập vẫn được giữ; thử đối chiếu lại.',
            );
            this.productLoading.set(false);
            return;
          }
          const fresh = new Map(
            checked.filter((item) => !item.error).map((item) => [item.product.id, item.version]),
          );
          const canonical = new Map(
            items.map((item) => [
              item.id,
              fresh.has(item.id) ? { ...item, version: fresh.get(item.id) } : item,
            ]),
          );
          const rebased = new Map(canonical);
          for (const product of removed) rebased.delete(product.id);
          for (const product of added) {
            rebased.set(
              product.id,
              fresh.has(product.id) ? { ...product, version: fresh.get(product.id) } : product,
            );
          }
          this.productBaseline.set(canonical);
          this.selectedProducts.set([...rebased.values()]);
          this.productIssues.set(
            checked
              .filter((item) => !!item.error)
              .map((item) => ({
                product: item.product,
                included: item.included,
                message: item.error,
              })),
          );
          this.productReconcileRequired.set(false);
          this.productError.set(
            this.productIssues().length
              ? 'Một số sản phẩm chưa thể đối chiếu. Bỏ ý định thay đổi từng sản phẩm hoặc thử lại trước khi lưu.'
              : 'Đã đối chiếu liên kết. Kiểm tra bản nhập rồi bấm Lưu để ghi thay đổi.',
          );
          this.productLoading.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.productLoading.set(false);
          this.productError.set(
            error instanceof ApiError
              ? error.message
              : 'Không thể đối chiếu liên kết. Bản nhập vẫn được giữ.',
          );
        },
      });
  }

  discardProductChange(id: string): void {
    if (!this.canManageProducts() || this.productLoading() || this.saving()) return;
    const issue = this.productIssues().find((item) => item.product.id === id);
    if (!issue) return;
    const canonical = this.productBaseline().get(id);
    this.selectedProducts.update((items) =>
      canonical
        ? [...items.filter((item) => item.id !== id), canonical]
        : items.filter((item) => item.id !== id),
    );
    this.productIssues.update((items) => items.filter((item) => item.product.id !== id));
    if (!this.productIssues().length) {
      this.productError.set('Đã giải quyết sản phẩm cần đối chiếu. Kiểm tra và bấm Lưu.');
    }
  }

  private saveRequest(): Observable<CategoryDto> {
    return defer(() => {
      if (!this.canSave() || this.saving() || this.loading() || !this.ready()) return EMPTY;
      clearServerErrors(this.form);
      this.summary.set([]);
      this.form.markAllAsTouched();
      if (this.form.invalid) return EMPTY;
      const changes = this.productChanges();
      if (changes.length > 1000) {
        this.summary.set(['Mỗi lần lưu chỉ hỗ trợ thay đổi tối đa 1.000 sản phẩm.']);
        return EMPTY;
      }
      if (changes.length && !this.canManageProducts()) {
        this.error.set('Cần quyền Product.View và Product.Update để lưu liên kết sản phẩm.');
        return EMPTY;
      }
      if (
        this.productReconcileRequired() ||
        this.productIssues().length ||
        (changes.length && this.productLoading())
      ) {
        this.productError.set(
          'Cần đối chiếu và giải quyết sản phẩm không còn truy cập được trước khi lưu liên kết.',
        );
        return EMPTY;
      }
      const generation = this.generation;
      const revision = this.revision;
      this.saving.set(true);
      this.error.set('');
      this.productError.set('');
      this.saved.set(false);
      const request = this.categoryRequest(this.record());
      const current = this.record();
      const metadataChanged =
        !current ||
        request.name !== current.name ||
        request.slug !== current.slug ||
        request.description !== current.description ||
        request.parentId !== current.parentId ||
        request.sortOrder !== current.sortOrder ||
        request.isActive !== current.isActive;
      if (metadataChanged && !this.canWrite()) {
        this.saving.set(false);
        this.error.set('Cần quyền Category.Update để sửa thông tin danh mục.');
        return EMPTY;
      }
      const operation =
        current && !metadataChanged
          ? of(current)
          : request.id
            ? this.categoriesService.update(request.id, request)
            : this.categoriesService.create(request);
      return operation.pipe(
        filter(() => generation === this.generation),
        concatMap((result) => {
          this.record.set(result);
          this.currentId = result.id;
          if (metadataChanged && revision === this.revision) {
            this.form.reset(this.categoryFormValue(result), { emitEvent: false });
          }
          this.saved.set(changes.length === 0 && revision === this.revision);
          if (changes.length === 0) return of(result);
          return this.categoriesService.setProducts(result.id, changes).pipe(
            tap((updated) => this.acceptProductChanges(updated)),
            map(() => result),
            catchError((error: unknown) => {
              this.productError.set(this.productSaveError(error, metadataChanged));
              this.saved.set(false);
              return EMPTY;
            }),
          );
        }),
        tap(() => this.saved.set(this.revision === revision)),
        catchError((error: unknown) => {
          if (generation !== this.generation) return EMPTY;
          if (error instanceof ApiError) {
            this.summary.set(
              applyServerErrors(this.form, error.fieldErrors).flatMap((issue) => issue.messages),
            );
            this.error.set(
              error.status === 409
                ? 'Dữ liệu danh mục đã thay đổi. Nội dung đang nhập được giữ lại; tải lại để đối chiếu trước khi lưu tiếp.'
                : error.message,
            );
          } else {
            this.error.set('Chưa lưu được danh mục. Nội dung đang nhập được giữ lại.');
          }
          return EMPTY;
        }),
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) {
            this.saving.set(false);
            this.applyAccess();
          }
        }),
      );
    });
  }

  private duplicateRequest(): Observable<CategoryDto> {
    return defer(() => {
      const current = this.record();
      if (!current || !this.can('Category', 'Create') || this.saving() || this.loading()) {
        return EMPTY;
      }
      if (this.partialCopy()) {
        this.error.set(
          'Bản sao đã được tạo. Mở bản sao để hoàn tất liên kết trước khi nhân bản tiếp.',
        );
        return EMPTY;
      }
      if (this.form.dirty || this.productsDirty()) {
        this.error.set('Lưu thay đổi hiện tại trước khi nhân bản danh mục.');
        return EMPTY;
      }
      if (!this.canViewProducts() || this.productLoading() || this.productError()) {
        this.error.set('Cần tải được danh sách sản phẩm hiện tại trước khi nhân bản danh mục.');
        return EMPTY;
      }
      const members = this.selectedProducts();
      if (members.length && !this.canManageProducts()) {
        this.error.set('Cần quyền Product.View và Product.Update để nhân bản liên kết sản phẩm.');
        return EMPTY;
      }
      if (members.length > 1000 || members.some((item) => !item.version)) {
        this.error.set(
          'Không thể nhân bản: danh sách sản phẩm thiếu phiên bản hoặc vượt giới hạn một lần lưu.',
        );
        return EMPTY;
      }
      const value = this.form.getRawValue();
      const request: SaveCategoryRequest = {
        id: null,
        version: null,
        name: `${value.name.trim()} copy`.slice(0, 256),
        slug: this.uniqueCopySlug(value.slug),
        description: value.description.trim() || null,
        parentId: value.parentId || null,
        sortOrder: value.sortOrder,
        isActive: value.isActive,
      };
      const generation = this.generation;
      this.saving.set(true);
      this.error.set('');
      return this.categoriesService.create(request).pipe(
        concatMap((copy) => {
          if (members.length === 0) return of(copy);
          const changes: CategoryProductChange[] = members.map((product) => ({
            productId: product.id,
            version: product.version ?? '',
            included: true,
          }));
          return this.categoriesService.setProducts(copy.id, changes).pipe(
            tap((updated) => this.acceptProductChanges(updated)),
            map(() => copy),
            catchError((error: unknown) => {
              this.pendingDuplicate.set({ record: copy, products: members });
              this.error.set(
                `Đã tạo bản sao ${copy.name}, nhưng chưa sao chép được liên kết sản phẩm. Mở bản sao để đối chiếu và lưu các liên kết đang chờ. ${error instanceof ApiError ? error.message : ''}`,
              );
              return EMPTY;
            }),
          );
        }),
        filter(() => generation === this.generation),
        catchError((error: unknown) => {
          this.error.set(
            error instanceof ApiError ? error.message : 'Không thể nhân bản danh mục.',
          );
          return EMPTY;
        }),
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) this.saving.set(false);
        }),
      );
    });
  }

  private loadMemberships(
    categoryId: string,
    generation: number,
    copyDraft?: readonly ProductSummary[],
  ): void {
    this.productLoading.set(true);
    this.membershipSubscription = this.membershipPages(categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (generation !== this.generation) return;
          if (items.some((item) => !item.version)) {
            this.productError.set('Có sản phẩm thiếu phiên bản; tải lại trước khi sửa liên kết.');
            this.productLoading.set(false);
            return;
          }
          this.productBaseline.set(new Map(items.map((item) => [item.id, item])));
          const selection = new Map(items.map((item) => [item.id, item]));
          for (const product of copyDraft ?? []) selection.set(product.id, product);
          this.selectedProducts.set([...selection.values()]);
          this.productReconcileRequired.set(!!copyDraft);
          this.productError.set(
            copyDraft
              ? 'Bản sao đã được tạo; các liên kết đang chờ được giữ trong bản nhập. Bấm Đối chiếu liên kết trước khi lưu.'
              : '',
          );
          this.productLoading.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.productLoading.set(false);
          this.productError.set(
            error instanceof ApiError ? error.message : 'Không thể tải sản phẩm đang liên kết.',
          );
        },
      });
  }

  private membershipPages(categoryId: string): Observable<ProductSummary[]> {
    const first: ProductSearch = {
      pageNumber: 1,
      pageSize: 100,
      categoryId,
      sortBy: 'name',
      sortDirection: 'asc',
    };
    const requestPage = (pageNumber: number) =>
      this.productsService.search({ ...first, pageNumber });
    return requestPage(1).pipe(
      expand((page: ProductPage) =>
        page.pageNumber * page.pageSize < page.total ? requestPage(page.pageNumber + 1) : EMPTY,
      ),
      reduce((all, page) => [...all, ...page.items], [] as ProductSummary[]),
    );
  }

  private productChanges(): CategoryProductChange[] {
    const baseline = this.productBaseline();
    const selected = new Map(this.selectedProducts().map((item) => [item.id, item]));
    const changes: CategoryProductChange[] = [];
    for (const [productId, product] of baseline) {
      if (!selected.has(productId)) {
        changes.push({ productId, version: product.version ?? '', included: false });
      }
    }
    for (const [productId, product] of selected) {
      if (!baseline.has(productId)) {
        changes.push({ productId, version: product.version ?? '', included: true });
      }
    }
    return changes;
  }

  private acceptProductChanges(results: readonly CategoryProductResult[]): void {
    const updated = new Map(results.map((result) => [result.productId, result]));
    this.productResults.update((items) =>
      items.map((product) => {
        const result = updated.get(product.id);
        return result ? { ...product, version: result.version } : product;
      }),
    );
    const selected = this.selectedProducts().map((product) => {
      const result = updated.get(product.id);
      return result ? { ...product, version: result.version } : product;
    });
    this.selectedProducts.set(selected);
    this.productBaseline.set(new Map(selected.map((item) => [item.id, item])));
    this.productError.set('');
  }

  private uniqueCopySlug(source: string): string {
    const known = new Set(this.allCategories().map((item) => item.slug));
    const base = source.slice(0, 194).replace(/-+$/u, '') || 'category';
    let slug = `${base}-copy`;
    let suffix = 2;
    while (known.has(slug)) {
      const tail = `-${suffix++}`;
      slug = `${base.slice(0, 200 - tail.length)}${tail}`;
    }
    return slug;
  }

  private productSaveError(error: unknown, metadataChanged = true): string {
    const prefix = metadataChanged ? 'Danh mục đã lưu, còn liên kết được giữ trong bản nhập; ' : '';
    if (error instanceof ApiError && error.status === 409) {
      return `Có sản phẩm đã thay đổi. ${prefix}Bấm Đối chiếu liên kết rồi kiểm tra trước khi lưu.`;
    }
    return error instanceof ApiError
      ? `${prefix}${error.message}`
      : `${prefix}Chưa cập nhật được liên kết sản phẩm.`;
  }

  private applyAccess(): void {
    if (this.canWrite()) {
      if (this.form.disabled) this.form.enable({ emitEvent: false });
    } else if (this.form.enabled) {
      this.form.disable({ emitEvent: false });
    }
  }
}
