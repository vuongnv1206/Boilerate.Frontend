import { CurrencyPipe, DatePipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs';
import { Icon } from '../../../shared/ui/icon/icon';
import { ContentState } from '../../../shared/ui/content-state/content-state';
import { FieldMessage } from '../../../shared/ui/field-message/field-message';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { focusWhenVisible } from '../../../shared/ui/focus-when-visible';
import {
  collectionDefinition,
  ContentItem,
  ContentStatus,
  slugify,
  STATUS_LABELS,
} from '../content-model';
import { DemoContentStore } from '../demo-content-store';

const trimmedRequired: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

@Component({
  selector: 'app-item-editor',
  imports: [
    A11yModule,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Icon,
    ContentState,
    FieldMessage,
    StatusBadge,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ToggleSwitchModule,
  ],
  templateUrl: './item-editor.html',
  styleUrl: './item-editor.scss',
})
export class ItemEditor {
  readonly store = inject(DemoContentStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly builder = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly inspectorToggle = viewChild<ElementRef<HTMLButtonElement>>('inspectorToggle');
  private readonly inspectorClose = viewChild<ElementRef<HTMLButtonElement>>('inspectorClose');
  private readonly inspectorQuery = window.matchMedia('(max-width: 1050px)');
  readonly narrowInspector = signal(this.inspectorQuery.matches);
  readonly item = signal<ContentItem | null>(null);
  readonly activeTab = signal<'details' | 'media' | 'seo'>('details');
  readonly saveState = signal<'new' | 'saved' | 'pending' | 'invalid'>('saved');
  readonly notice = signal('');
  readonly confirmPublish = signal(false);
  readonly leaveOpen = signal(false);
  readonly inspectorOpen = signal(false);
  readonly inspectorModal = computed(() => this.inspectorOpen() && this.narrowInspector());
  readonly notFound = signal(false);
  readonly statusLabels = STATUS_LABELS;
  readonly categories = [
    'Phụ kiện',
    'Không gian sống',
    'Công nghệ',
    'Nội thất',
    'Thời trang',
    'Văn phòng phẩm',
  ];
  readonly images = ['bag', 'lamp', 'headphones', 'chair', 'vase', 'camera', 'shoe', 'notebook'];
  readonly form = this.builder.nonNullable.group({
    name: ['', [trimmedRequired, Validators.maxLength(180)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    description: ['', Validators.maxLength(2000)],
    category: ['Phụ kiện'],
    price: [0, [Validators.required, Validators.min(0)]],
    sku: ['', Validators.maxLength(64)],
    stock: [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    featured: [false],
    seoTitle: ['', Validators.maxLength(70)],
    seoDescription: ['', Validators.maxLength(160)],
  });
  private autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
  private leaveResolver: ((leave: boolean) => void) | undefined;
  private autoSlug = false;

  constructor() {
    const onInspectorViewportChange = (event: MediaQueryListEvent) => {
      this.narrowInspector.set(event.matches);
      if (!event.matches) this.inspectorOpen.set(false);
    };
    this.inspectorQuery.addEventListener('change', onInspectorViewportChange);
    this.destroyRef.onDestroy(() =>
      this.inspectorQuery.removeEventListener('change', onInspectorViewportChange),
    );
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        map(() => ({
          id: this.route.snapshot.paramMap.get('id'),
          collection: collectionDefinition(this.route.snapshot.queryParamMap.get('collection')).key,
        })),
        distinctUntilChanged(
          (previous, current) =>
            previous.id === current.id && previous.collection === current.collection,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ id, collection }) => {
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSlug = id === 'new';
        const item = id === 'new' ? this.store.draft(collection) : this.store.get(id ?? '');
        this.item.set(item ?? null);
        this.notFound.set(!item);
        this.activeTab.set('details');
        this.saveState.set(id === 'new' ? 'new' : 'saved');
        this.notice.set('');
        if (item) this.form.reset(item, { emitEvent: false });
      });
    this.form.controls.slug.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.autoSlug = false;
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.autoSlug)
        this.form.controls.slug.setValue(slugify(this.form.controls.name.value), {
          emitEvent: false,
        });
      this.saveState.set(this.form.valid ? 'pending' : 'invalid');
      this.notice.set('');
      this.scheduleAutosave();
    });
    this.destroyRef.onDestroy(() => {
      if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
      this.leaveResolver?.(false);
    });
  }

  definition() {
    return collectionDefinition(this.item()?.collection ?? null);
  }

  toggleInspector(): void {
    if (this.inspectorOpen()) this.closeInspector();
    else {
      this.inspectorOpen.set(true);
      afterNextRender(
        () => {
          const close = this.inspectorClose()?.nativeElement;
          const panel = close?.closest<HTMLElement>('.inspector');
          focusWhenVisible(panel ?? undefined, close, () => this.inspectorModal());
        },
        { injector: this.injector },
      );
    }
  }

  @HostListener('document:keydown.escape')
  closeInspector(restoreFocus = true): void {
    if (!this.inspectorOpen()) return;
    this.inspectorOpen.set(false);
    if (restoreFocus)
      afterNextRender(() => this.inspectorToggle()?.nativeElement.focus(), {
        injector: this.injector,
      });
  }

  invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  save(announce = true): boolean {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    const item = this.item();
    if (!item) return false;
    if (this.form.invalid) {
      this.activeTab.set('details');
      this.form.markAllAsTouched();
      this.saveState.set('invalid');
      this.notice.set('Kiểm tra các trường được đánh dấu trước khi lưu.');
      return false;
    }
    const saved = this.store.save({ ...item, ...this.form.getRawValue() });
    this.item.set(saved);
    this.form.markAsPristine();
    this.saveState.set('saved');
    if (announce)
      this.notice.set('Đã lưu thay đổi trong bản mẫu. Dữ liệu sẽ được đặt lại khi tải lại trang.');
    return true;
  }

  publish(): void {
    if (!this.save(false)) {
      this.confirmPublish.set(false);
      return;
    }
    this.changeStatus('published');
    this.confirmPublish.set(false);
    this.notice.set('Đã chuyển sang trạng thái xuất bản trong bản mẫu UI.');
  }

  restoreDraft(): void {
    this.changeStatus('draft');
    this.scheduleAutosave();
    this.notice.set('Đã khôi phục bản nháp trong bản mẫu.');
  }

  setImage(name: string): void {
    const item = this.item();
    if (!item) return;
    this.item.set({ ...item, image: `/images/${name}.svg` });
    this.form.markAsDirty();
    this.saveState.set('pending');
    this.scheduleAutosave();
  }

  confirmLeave(): Promise<boolean> | boolean {
    this.closeInspector(false);
    if (!this.form.dirty) return true;
    if (this.item()?.status === 'draft' && this.form.valid) return this.save(false);
    this.leaveOpen.set(true);
    return new Promise<boolean>((resolve) => {
      this.leaveResolver = resolve;
    });
  }

  resolveLeave(leave: boolean, save = false): void {
    if (save && !this.save()) return;
    this.leaveOpen.set(false);
    this.leaveResolver?.(leave);
    this.leaveResolver = undefined;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  returnToList(): void {
    void this.router.navigate(['/admin/collections', this.definition().key]);
  }

  private scheduleAutosave(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    if (this.item()?.status === 'draft' && this.form.valid)
      this.autoSaveTimer = setTimeout(() => this.save(false), 700);
  }

  private changeStatus(status: ContentStatus): void {
    const item = this.item();
    if (!item) return;
    this.store.setStatus(new Set([item.id]), status);
    this.item.set({ ...item, status });
  }
}
