import { CategoryForm, categoryFormValue, categoryRequest } from '@forms/category.form';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  concatMap,
  defer,
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
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';
import { CategoriesService } from '@services/categories.service';
import { ProductsService } from '@services/products.service';
import {
  CategoryDto,
  CategoryProductChange,
  CategoryProductResult,
  SaveCategoryRequest,
} from '@models/category.dto';
import { ProductDto, ProductPage, ProductSearch, ProductSummary } from '@models/product.dto';

interface CategoryProductIssue {
  readonly product: ProductSummary;
  readonly included: boolean;
  readonly message: string;
}

@Injectable()
export class CategoryIoStore {
  private readonly session = inject(AuthSession);
  private readonly cancelWrites = new Subject<void>();
  private readonly summaryState = signal<readonly string[]>([]);
  readonly summary = this.summaryState.asReadonly();
  readonly canWrite = computed(() =>
    this.session.can('Category', this.record() ? 'Update' : 'Create'),
  );
  readonly canViewProducts = computed(() => this.session.can('Product', 'View'));
  readonly canManageProducts = computed(
    () =>
      (this.record() !== null || this.canWrite()) &&
      this.canViewProducts() &&
      this.session.can('Product', 'Update'),
  );
  readonly canSave = computed(
    () =>
      this.canWrite() ||
      (this.record() !== null && this.canManageProducts() && this.productsDirty()),
  );
  private readonly service = inject(CategoriesService);
  private readonly productsService = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recordState = signal<CategoryDto | null>(null);
  private readonly allState = signal<readonly CategoryDto[]>([]);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly savedState = signal(false);
  private readonly readyState = signal(false);
  private readonly productSelectionState = signal<readonly ProductSummary[]>([]);
  private readonly productBaselineState = signal<ReadonlyMap<string, ProductSummary>>(new Map());
  private readonly productResultsState = signal<readonly ProductSummary[]>([]);
  private readonly productQueryState = signal('');
  private readonly productLoadingState = signal(false);
  private readonly productSearchLoadingState = signal(false);
  private readonly productErrorState = signal('');
  private readonly productSearchErrorState = signal('');
  private readonly productIssuesState = signal<readonly CategoryProductIssue[]>([]);
  private readonly productReconcileRequiredState = signal(false);
  private readonly pendingDuplicateState = signal<{
    record: CategoryDto;
    products: readonly ProductSummary[];
  } | null>(null);
  private loadSubscription?: Subscription;
  private membershipSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private generation = 0;
  private searchGeneration = 0;
  private revision = 0;
  private currentId = 'new';

  private currentForm: CategoryForm | null = null;
  readonly record = this.recordState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly saved = this.savedState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly selectedProducts = this.productSelectionState.asReadonly();
  readonly productResults = this.productResultsState.asReadonly();
  readonly productQuery = this.productQueryState.asReadonly();
  readonly productLoading = this.productLoadingState.asReadonly();
  readonly productSearchLoading = this.productSearchLoadingState.asReadonly();
  readonly productError = this.productErrorState.asReadonly();
  readonly productSearchError = this.productSearchErrorState.asReadonly();
  readonly productIssues = this.productIssuesState.asReadonly();
  readonly productReconcileRequired = this.productReconcileRequiredState.asReadonly();
  readonly partialCopy = computed(() => this.pendingDuplicateState()?.record ?? null);
  readonly productsDirty = computed(() => {
    const baseline = this.productBaselineState();
    const selected = this.productSelectionState();
    return baseline.size !== selected.length || selected.some((item) => !baseline.has(item.id));
  });
  readonly availableProducts = computed(() => {
    const selected = new Set(this.productSelectionState().map((item) => item.id));
    return this.productResultsState().filter((item) => !selected.has(item.id));
  });
  readonly parentOptions = computed(() => {
    const current = this.record()?.id;
    const excluded = new Set(current ? [current] : []);
    let count = -1;
    while (count !== excluded.size) {
      count = excluded.size;
      this.allState().forEach((item) => {
        if (item.parentId && excluded.has(item.parentId)) excluded.add(item.id);
      });
    }
    return this.allState().filter((item) => !excluded.has(item.id));
  });

  constructor() {
    effect(() => {
      this.canWrite();
      this.applyAccess();
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
  get form(): CategoryForm {
    if (!this.currentForm) throw new Error('Set the editor form before loading data.');
    return this.currentForm;
  }

  setForm(form: CategoryForm): void {
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
    const pendingCopy = this.pendingDuplicateState();
    const copyDraft =
      pendingCopy && pendingCopy.record.id === id ? pendingCopy.products : undefined;
    if (copyDraft) this.pendingDuplicateState.set(null);
    this.currentId = id;
    this.cancelWrites.next();
    this.membershipSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.searchGeneration++;
    this.summaryState.set([]);
    this.readyState.set(false);
    const generation = ++this.generation;
    this.loadSubscription?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set('');
    this.productErrorState.set('');
    this.productSearchErrorState.set('');
    this.productIssuesState.set([]);
    this.productReconcileRequiredState.set(false);
    this.productSelectionState.set([]);
    this.productBaselineState.set(new Map());
    this.productResultsState.set([]);
    this.productQueryState.set('');
    this.productLoadingState.set(false);
    this.productSearchLoadingState.set(false);
    this.recordState.set(null);
    this.savedState.set(false);
    this.savingState.set(false);
    this.form.reset(categoryFormValue(), { emitEvent: false });
    this.loadSubscription = this.service
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (generation !== this.generation) return;
          this.allState.set(items);
          const item = id === 'new' ? undefined : items.find((entry) => entry.id === id);
          this.loadingState.set(false);
          if (id !== 'new' && !item) {
            this.errorState.set('Không tìm thấy danh mục này.');
            return;
          }
          this.recordState.set(item ?? null);
          this.form.reset(categoryFormValue(item), { emitEvent: false });
          this.readyState.set(true);
          this.applyAccess();
          if (item && this.canViewProducts()) this.loadMemberships(item.id, generation, copyDraft);
        },
        error: (error: unknown) => {
          this.loadingState.set(false);
          this.errorState.set(
            error instanceof ApiError ? error.message : 'Không thể tải danh mục.',
          );
        },
      });
  }
  retry(): void {
    this.load(this.currentId);
  }

  searchProducts(query: string): void {
    this.productQueryState.set(query);
    this.productSearchErrorState.set('');
    if (!this.canManageProducts()) {
      this.productResultsState.set([]);
      return;
    }
    this.searchSubscription?.unsubscribe();
    const generation = ++this.searchGeneration;
    this.productSearchLoadingState.set(true);
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
          this.productResultsState.set(page.items);
          this.productSearchLoadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.searchGeneration) return;
          this.productSearchLoadingState.set(false);
          this.productSearchErrorState.set(
            error instanceof ApiError ? error.message : 'Không thể tìm sản phẩm.',
          );
        },
      });
  }

  addProduct(product: ProductSummary): void {
    if (
      !this.canManageProducts() ||
      this.productLoading() ||
      this.saving() ||
      this.productSelectionState().some((item) => item.id === product.id)
    )
      return;
    if (!product.version) {
      this.productSearchErrorState.set('Sản phẩm thiếu phiên bản. Tải lại kết quả trước khi thêm.');
      return;
    }
    this.productSelectionState.update((items) => [...items, product]);
    this.productSearchErrorState.set('');
    this.productErrorState.set('');
  }

  removeProduct(id: string): void {
    if (!this.canManageProducts() || this.productLoading() || this.saving()) return;
    this.productSelectionState.update((items) => items.filter((item) => item.id !== id));
    this.productErrorState.set('');
  }

  save(): Observable<CategoryDto> {
    return defer(() => {
      if (!this.canSave() || this.saving() || this.loading() || !this.ready()) return EMPTY;
      clearServerErrors(this.form);
      this.summaryState.set([]);
      this.form.markAllAsTouched();
      if (this.form.invalid) return EMPTY;
      const changes = this.productChanges();
      if (changes.length > 1000) {
        this.summaryState.set(['Mỗi lần lưu chỉ hỗ trợ thay đổi tối đa 1.000 sản phẩm.']);
        return EMPTY;
      }
      if (changes.length && !this.canManageProducts()) {
        this.errorState.set('Cần quyền Product.View và Product.Update để lưu liên kết sản phẩm.');
        return EMPTY;
      }
      if (
        this.productReconcileRequired() ||
        this.productIssues().length ||
        (changes.length && this.productLoading())
      ) {
        this.productErrorState.set(
          'Cần đối chiếu và giải quyết sản phẩm không còn truy cập được trước khi lưu liên kết.',
        );
        return EMPTY;
      }
      const generation = this.generation;
      const revision = this.revision;
      this.savingState.set(true);
      this.errorState.set('');
      this.productErrorState.set('');
      this.savedState.set(false);
      const request = categoryRequest(this.form, this.record());
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
        this.savingState.set(false);
        this.errorState.set('Cần quyền Category.Update để sửa thông tin danh mục.');
        return EMPTY;
      }
      const operation =
        current && !metadataChanged
          ? of(current)
          : request.id
            ? this.service.update(request.id, request)
            : this.service.create(request);
      return operation.pipe(
        filter(() => generation === this.generation),
        concatMap((result) => {
          this.recordState.set(result);
          this.currentId = result.id;
          if (metadataChanged && revision === this.revision)
            this.form.reset(categoryFormValue(result), { emitEvent: false });
          this.savedState.set(changes.length === 0 && revision === this.revision);
          if (changes.length === 0) return of(result);
          return this.service.setProducts(result.id, changes).pipe(
            tap((updated) => this.acceptProductChanges(updated)),
            map(() => result),
            catchError((error: unknown) => {
              this.productErrorState.set(this.productSaveError(error, metadataChanged));
              this.savedState.set(false);
              return EMPTY;
            }),
          );
        }),
        tap(() => this.savedState.set(this.revision === revision)),
        catchError((error: unknown) => {
          if (generation !== this.generation) return EMPTY;
          if (error instanceof ApiError) {
            this.summaryState.set(
              applyServerErrors(this.form, error.fieldErrors).flatMap((issue) => issue.messages),
            );
            this.errorState.set(
              error.status === 409
                ? 'Dữ liệu danh mục đã thay đổi. Nội dung đang nhập được giữ lại; tải lại để đối chiếu trước khi lưu tiếp.'
                : error.message,
            );
          } else this.errorState.set('Chưa lưu được danh mục. Nội dung đang nhập được giữ lại.');
          return EMPTY;
        }),
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) {
            this.savingState.set(false);
            this.applyAccess();
          }
        }),
      );
    });
  }

  duplicate(): Observable<CategoryDto> {
    return defer(() => {
      const record = this.record();
      if (!record || !this.session.can('Category', 'Create') || this.saving() || this.loading())
        return EMPTY;
      if (this.partialCopy()) {
        this.errorState.set(
          'Bản sao đã được tạo. Mở bản sao để hoàn tất liên kết trước khi nhân bản tiếp.',
        );
        return EMPTY;
      }
      if (this.form.dirty || this.productsDirty()) {
        this.errorState.set('Lưu thay đổi hiện tại trước khi nhân bản danh mục.');
        return EMPTY;
      }
      if (!this.canViewProducts() || this.productLoading() || this.productError()) {
        this.errorState.set(
          'Cần tải được danh sách sản phẩm hiện tại trước khi nhân bản danh mục.',
        );
        return EMPTY;
      }
      const members = this.selectedProducts();
      if (members.length && !this.canManageProducts()) {
        this.errorState.set(
          'Cần quyền Product.View và Product.Update để nhân bản liên kết sản phẩm.',
        );
        return EMPTY;
      }
      if (members.length > 1000 || members.some((item) => !item.version)) {
        this.errorState.set(
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
      this.savingState.set(true);
      this.errorState.set('');
      const create = this.service.create(request);
      return create.pipe(
        concatMap((copy) => {
          if (members.length === 0) return of(copy);
          const changes: CategoryProductChange[] = members.map((product) => ({
            productId: product.id,
            version: product.version ?? '',
            included: true,
          }));
          return this.service.setProducts(copy.id, changes).pipe(
            tap((updated) => this.acceptProductChanges(updated)),
            map(() => copy),
            catchError((error: unknown) => {
              this.pendingDuplicateState.set({ record: copy, products: members });
              this.errorState.set(
                `Đã tạo bản sao ${copy.name}, nhưng chưa sao chép được liên kết sản phẩm. Mở bản sao để đối chiếu và lưu các liên kết đang chờ. ${error instanceof ApiError ? error.message : ''}`,
              );
              return EMPTY;
            }),
          );
        }),
        filter(() => generation === this.generation),
        catchError((error: unknown) => {
          this.errorState.set(
            error instanceof ApiError ? error.message : 'Không thể nhân bản danh mục.',
          );
          return EMPTY;
        }),
        takeUntil(this.cancelWrites),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) this.savingState.set(false);
        }),
      );
    });
  }

  categoryPath(id: string): string {
    const byId = new Map(this.allState().map((item) => [item.id, item]));
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
    const baseline = this.productBaselineState();
    const selected = new Map(this.productSelectionState().map((item) => [item.id, item]));
    const removed = [...baseline.values()].filter((item) => !selected.has(item.id));
    const added = [...selected.values()].filter((item) => !baseline.has(item.id));
    const pending = [
      ...removed.map((product) => ({ product, included: false })),
      ...added.map((product) => ({ product, included: true })),
    ];
    this.membershipSubscription?.unsubscribe();
    this.productLoadingState.set(true);
    this.productErrorState.set('');
    this.membershipSubscription = this.membershipPages(category.id)
      .pipe(
        concatMap((items) => {
          if (!pending.length) return of({ items, checked: [] });
          return forkJoin(
            pending.map((change) =>
              this.productsService.get(change.product.id).pipe(
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
            this.productErrorState.set(
              'Có sản phẩm thiếu phiên bản. Bản nhập vẫn được giữ; thử đối chiếu lại.',
            );
            this.productLoadingState.set(false);
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
          for (const product of added)
            rebased.set(
              product.id,
              fresh.has(product.id) ? { ...product, version: fresh.get(product.id) } : product,
            );
          this.productBaselineState.set(canonical);
          this.productSelectionState.set([...rebased.values()]);
          this.productIssuesState.set(
            checked
              .filter((item) => !!item.error)
              .map((item) => ({
                product: item.product,
                included: item.included,
                message: item.error,
              })),
          );
          this.productReconcileRequiredState.set(false);
          this.productErrorState.set(
            this.productIssues().length
              ? 'Một số sản phẩm chưa thể đối chiếu. Bỏ ý định thay đổi từng sản phẩm hoặc thử lại trước khi lưu.'
              : 'Đã đối chiếu liên kết. Kiểm tra bản nhập rồi bấm Lưu để ghi thay đổi.',
          );
          this.productLoadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.productLoadingState.set(false);
          this.productErrorState.set(
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
    const canonical = this.productBaselineState().get(id);
    this.productSelectionState.update((items) =>
      canonical
        ? [...items.filter((item) => item.id !== id), canonical]
        : items.filter((item) => item.id !== id),
    );
    this.productIssuesState.update((items) => items.filter((item) => item.product.id !== id));
    if (!this.productIssues().length)
      this.productErrorState.set('Đã giải quyết sản phẩm cần đối chiếu. Kiểm tra và bấm Lưu.');
  }

  private loadMemberships(
    categoryId: string,
    generation: number,
    copyDraft?: readonly ProductSummary[],
  ): void {
    this.productLoadingState.set(true);
    this.membershipSubscription = this.membershipPages(categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (generation !== this.generation) return;
          if (items.some((item) => !item.version)) {
            this.productErrorState.set(
              'Có sản phẩm thiếu phiên bản; tải lại trước khi sửa liên kết.',
            );
            this.productLoadingState.set(false);
            return;
          }
          this.productBaselineState.set(new Map(items.map((item) => [item.id, item])));
          const selection = new Map(items.map((item) => [item.id, item]));
          for (const product of copyDraft ?? []) selection.set(product.id, product);
          this.productSelectionState.set([...selection.values()]);
          this.productReconcileRequiredState.set(!!copyDraft);
          this.productErrorState.set(
            copyDraft
              ? 'Bản sao đã được tạo; các liên kết đang chờ được giữ trong bản nhập. Bấm Đối chiếu liên kết trước khi lưu.'
              : '',
          );
          this.productLoadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.productLoadingState.set(false);
          this.productErrorState.set(
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
    const baseline = this.productBaselineState();
    const selected = new Map(this.productSelectionState().map((item) => [item.id, item]));
    const changes: CategoryProductChange[] = [];
    for (const [productId, product] of baseline) {
      if (!selected.has(productId))
        changes.push({ productId, version: product.version ?? '', included: false });
    }
    for (const [productId, product] of selected) {
      if (!baseline.has(productId))
        changes.push({ productId, version: product.version ?? '', included: true });
    }
    return changes;
  }

  private acceptProductChanges(results: readonly CategoryProductResult[]): void {
    const updated = new Map(results.map((result) => [result.productId, result]));
    this.productResultsState.update((items) =>
      items.map((product) => {
        const result = updated.get(product.id);
        return result ? { ...product, version: result.version } : product;
      }),
    );
    const selected = this.productSelectionState().map((product) => {
      const result = updated.get(product.id);
      return result ? { ...product, version: result.version } : product;
    });
    this.productSelectionState.set(selected);
    this.productBaselineState.set(new Map(selected.map((item) => [item.id, item])));
    this.productErrorState.set('');
  }

  private uniqueCopySlug(source: string): string {
    const known = new Set(this.allState().map((item) => item.slug));
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
    if (error instanceof ApiError && error.status === 409)
      return `Có sản phẩm đã thay đổi. ${prefix}Bấm Đối chiếu liên kết rồi kiểm tra trước khi lưu.`;
    return error instanceof ApiError
      ? `${prefix}${error.message}`
      : `${prefix}Chưa cập nhật được liên kết sản phẩm.`;
  }

  private applyAccess(): void {
    if (!this.currentForm) return;
    if (this.canWrite()) {
      if (this.currentForm.disabled) this.currentForm.enable({ emitEvent: false });
    } else if (this.currentForm.enabled) this.currentForm.disable({ emitEvent: false });
  }
}
