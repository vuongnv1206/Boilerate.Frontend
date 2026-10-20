import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, defer, of, take } from 'rxjs';
import { CONTENT_EDITOR_AUTOSAVE_DELAY_MS } from '../constants/content-editor.constants';
import { ContentService } from '../data-access/content.service';
import { CollectionKey, ContentStatus, ContentTab, ContentSaveState } from '../enums/content.enum';
import { createContentForm } from '../forms/content-form';
import {
  ContentItem,
  collectionDefinition,
  createContentDraft,
  slugify,
} from '../models/content-item';

/** Page-scoped form and editing lifecycle. The service owns persisted demo records. */
@Injectable()
export class ContentIoStore {
  private readonly service = inject(ContentService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = createContentForm();
  private readonly itemState = signal<ContentItem | null>(null);
  readonly definition = computed(() => collectionDefinition(this.item()?.collection ?? null));
  private readonly activeTabState = signal<ContentTab>(ContentTab.Details);
  private readonly saveStateValue = signal<ContentSaveState>(ContentSaveState.Saved);
  private readonly noticeState = signal('');
  private readonly loadingState = signal(false);
  private readonly busyState = signal(false);
  private readonly loadErrorState = signal('');
  private readonly mutationErrorState = signal(false);
  private readonly notFoundState = signal(false);
  readonly item = this.itemState.asReadonly();
  readonly activeTab = this.activeTabState.asReadonly();
  readonly saveState = this.saveStateValue.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();
  readonly mutationError = this.mutationErrorState.asReadonly();
  readonly notFound = this.notFoundState.asReadonly();
  private loadSubscription?: Subscription;
  private writeSubscription?: Subscription;
  private autosaveTimer?: ReturnType<typeof setTimeout>;
  private pendingWrite?: Promise<boolean>;
  private resolveWrite?: (success: boolean) => void;
  private generation = 0;
  private revision = 0;
  private autoSlug = false;

  constructor() {
    this.form.controls.slug.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.autoSlug = false;
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.autoSlug) {
        this.form.controls.slug.setValue(slugify(this.form.controls.name.value), {
          emitEvent: false,
        });
      }
      this.changed();
    });
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.cancelPendingWork();
    });
  }

  load(id: string, collection: CollectionKey): void {
    this.generation++;
    this.cancelPendingWork();
    const generation = this.generation;
    this.revision = 0;
    this.autoSlug = id === 'new';
    this.itemState.set(null);
    this.form.reset(undefined, { emitEvent: false });
    this.activeTabState.set(ContentTab.Details);
    this.noticeState.set('');
    this.loadErrorState.set('');
    this.mutationErrorState.set(false);
    this.notFoundState.set(false);
    this.saveStateValue.set(id === 'new' ? ContentSaveState.New : ContentSaveState.Saved);
    this.loadingState.set(true);
    this.loadSubscription = defer(() =>
      id === 'new' ? of(createContentDraft(collection)) : this.service.getById(id),
    )
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          if (generation !== this.generation) return;
          this.loadingState.set(false);
          this.itemState.set(item ?? null);
          this.notFoundState.set(!item);
          if (item) this.form.reset(item, { emitEvent: false });
        },
        error: () => {
          if (generation !== this.generation) return;
          this.loadingState.set(false);
          this.loadErrorState.set('Không tải được nội dung. Vui lòng thử lại.');
        },
        complete: () => {
          if (generation === this.generation && this.loading()) {
            this.loadingState.set(false);
            this.notFoundState.set(true);
          }
        },
      });
  }

  setActiveTab(tab: ContentTab): void {
    this.activeTabState.set(tab);
  }

  dismissNotice(): void {
    this.noticeState.set('');
  }

  invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  async save(announce = true): Promise<boolean> {
    this.clearAutosave();
    if (this.pendingWrite) {
      const generation = this.generation;
      const success = await this.pendingWrite;
      if (!success || generation !== this.generation) return false;
      return this.form.dirty ? this.save(announce) : true;
    }
    const item = this.item();
    if (!item) return false;
    if (this.form.invalid) {
      this.activeTabState.set(ContentTab.Details);
      this.form.markAllAsTouched();
      this.saveStateValue.set(ContentSaveState.Invalid);
      this.mutationErrorState.set(true);
      this.noticeState.set('Kiểm tra các trường được đánh dấu trước khi lưu.');
      return false;
    }
    const revision = this.revision;
    const snapshot = { ...item, ...this.form.getRawValue() };
    return this.write(
      () => this.service.save(snapshot),
      (saved) => {
        const unchanged = revision === this.revision;
        this.itemState.set(
          unchanged ? saved : { ...saved, image: this.item()?.image ?? saved.image },
        );
        if (unchanged) {
          this.form.reset(saved, { emitEvent: false });
          this.saveStateValue.set(ContentSaveState.Saved);
          if (announce) {
            this.noticeState.set(
              'Đã lưu thay đổi trong bản mẫu. Dữ liệu sẽ được đặt lại khi tải lại trang.',
            );
          }
        } else {
          this.form.markAsDirty();
          this.saveStateValue.set(
            this.form.valid ? ContentSaveState.Pending : ContentSaveState.Invalid,
          );
        }
      },
    );
  }

  async publish(): Promise<boolean> {
    if (!(await this.save(false))) return false;
    if (this.form.dirty) {
      this.noticeState.set('Có thay đổi mới trong khi lưu. Lưu lại nội dung trước khi xuất bản.');
      return false;
    }
    const success = await this.changeStatus(ContentStatus.Published);
    if (success) this.noticeState.set('Đã chuyển sang trạng thái xuất bản trong bản mẫu UI.');
    return success;
  }

  async restoreDraft(): Promise<boolean> {
    const success = await this.changeStatus(ContentStatus.Draft);
    if (success) {
      this.scheduleAutosave();
      this.noticeState.set('Đã khôi phục bản nháp trong bản mẫu.');
    }
    return success;
  }

  setImage(name: string): void {
    const item = this.item();
    if (!item) return;
    this.itemState.set({ ...item, image: `/images/${name}.svg` });
    this.form.markAsDirty();
    this.changed();
  }

  private changed(): void {
    this.revision++;
    this.saveStateValue.set(this.form.valid ? ContentSaveState.Pending : ContentSaveState.Invalid);
    this.noticeState.set('');
    this.mutationErrorState.set(false);
    this.scheduleAutosave();
  }

  private scheduleAutosave(): void {
    this.clearAutosave();
    if (this.item()?.status === ContentStatus.Draft && this.form.valid) {
      this.autosaveTimer = setTimeout(
        () => void this.save(false),
        CONTENT_EDITOR_AUTOSAVE_DELAY_MS,
      );
    }
  }

  private clearAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = undefined;
  }

  private changeStatus(status: ContentStatus): Promise<boolean> {
    this.clearAutosave();
    const item = this.item();
    if (!item || this.pendingWrite) return Promise.resolve(false);
    return this.write(
      () => this.service.setStatus([item.id], status),
      (items) => {
        const saved = items.find((record) => record.id === item.id);
        if (!saved) throw new Error('The updated record was missing from the response.');
        // Form edits remain local; status and updatedAt come from the canonical response.
        this.itemState.set({ ...saved, image: this.item()?.image ?? saved.image });
      },
    );
  }

  private write<T>(request: () => Observable<T>, accept: (value: T) => void): Promise<boolean> {
    const generation = this.generation;
    this.busyState.set(true);
    this.mutationErrorState.set(false);
    const task = new Promise<boolean>((resolve) => {
      this.resolveWrite = resolve;
    });
    this.pendingWrite = task;
    let received = false;
    const finish = (success: boolean) => {
      if (generation !== this.generation) return;
      this.busyState.set(false);
      const resolve = this.resolveWrite;
      this.pendingWrite = undefined;
      this.resolveWrite = undefined;
      if (!success) {
        this.mutationErrorState.set(true);
        this.noticeState.set(
          'Chưa lưu được thay đổi. Nội dung đang chỉnh sửa được giữ lại để thử lại.',
        );
      } else if (this.form.dirty && this.item()?.status === ContentStatus.Draft) {
        this.scheduleAutosave();
      }
      resolve?.(success);
    };
    this.writeSubscription = defer(request)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          if (generation !== this.generation) return;
          received = true;
          try {
            accept(value);
            finish(true);
          } catch {
            finish(false);
          }
        },
        error: () => finish(false),
        complete: () => {
          if (!received) finish(false);
        },
      });
    return task;
  }

  private cancelPendingWork(): void {
    this.clearAutosave();
    this.loadSubscription?.unsubscribe();
    this.writeSubscription?.unsubscribe();
    this.resolveWrite?.(false);
    this.resolveWrite = undefined;
    this.pendingWrite = undefined;
    this.busyState.set(false);
  }
}
