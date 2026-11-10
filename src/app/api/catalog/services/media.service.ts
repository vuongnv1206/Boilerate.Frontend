import { DestroyRef, Injectable, computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  concatMap,
  defer,
  filter,
  finalize,
  from,
  takeUntil,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { BaseApiService, QueryParamMap } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_MEDIA, MediaAssetDto } from '../models/media.dto';

const DEFAULT_PREVIEW_OWNER = Symbol('default-preview-owner');

@Injectable({ providedIn: 'root' })
export class MediaService extends BaseApiService {
  private readonly uploadingState = signal(false);
  private readonly uploadFailureState = signal('');
  private readonly stopUploads = new Subject<void>();

  private readonly previewUrls = signal<Readonly<Record<string, string>>>({});
  private readonly previewFailures = signal<Readonly<Record<string, string>>>({});
  private readonly previewPending = signal<ReadonlySet<string>>(new Set());
  private readonly previewRequests = new Map<string, Subscription>();
  private readonly ownerSubscriptions = new Map<symbol, ReadonlySet<string>>();
  private previewGeneration = 0;

  readonly busy = this.uploadingState.asReadonly();
  readonly uploadError = this.uploadFailureState.asReadonly();
  readonly canUpload = computed(
    () => this.session.can('Product', 'Create') || this.session.can('Product', 'Update'),
  );

  constructor(
    private readonly session: AuthSession,
    private readonly destroyRef: DestroyRef,
  ) {
    super();
    effect(() => {
      if (!this.session.signedIn()) {
        this.stopUploads.next();
        untracked(() => this.clear());
      }
    });
    this.destroyRef.onDestroy(() => {
      this.stopUploads.next();
      this.stopUploads.complete();
      this.clear();
    });
  }

  uploadFile(file: File): Observable<MediaAssetDto> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.post<MediaAssetDto>('media', body);
  }

  upload(files: readonly File[], remaining: number): Observable<MediaAssetDto> {
    return defer(() => {
      if (this.uploadingState() || !files.length || !this.session.signedIn() || !this.canUpload()) {
        return EMPTY;
      }
      this.uploadFailureState.set('');
      if (files.length > remaining) {
        this.uploadFailureState.set(`Mỗi sản phẩm có tối đa ${MAX_PRODUCT_MEDIA} ảnh.`);
        return EMPTY;
      }
      if (
        files.some(
          (file) =>
            !/\.(?:png|jpe?g)$/iu.test(file.name) ||
            (file.type !== '' && !['image/png', 'image/jpeg'].includes(file.type)),
        )
      ) {
        this.uploadFailureState.set('Chọn ảnh PNG hoặc JPEG.');
        return EMPTY;
      }
      if (files.some((file) => file.size === 0 || file.size > MAX_PRODUCT_IMAGE_BYTES)) {
        this.uploadFailureState.set('Mỗi ảnh phải lớn hơn 0 byte và không quá 5 MiB.');
        return EMPTY;
      }
      this.uploadingState.set(true);
      const sessionVersion = this.session.getVersion();
      const current = (): boolean =>
        this.session.signedIn() && this.session.getVersion() === sessionVersion;
      return from(files).pipe(
        concatMap((file) => (current() ? this.uploadFile(file) : EMPTY)),
        filter(() => current()),
        takeUntil(this.stopUploads),
        takeUntilDestroyed(this.destroyRef),
        catchError((rawError: unknown) => {
          this.uploadFailureState.set(normalizeApiError(rawError).message);
          return EMPTY;
        }),
        finalize(() => this.uploadingState.set(false)),
      );
    });
  }

  list(params?: QueryParamMap): Observable<readonly MediaAssetDto[]> {
    return this.get<readonly MediaAssetDto[]>('media', params);
  }

  delete(id: string): Observable<void> {
    return this.deleteResource<void>(`media/${encodeURIComponent(id)}`);
  }

  preview(id: string): Observable<Blob> {
    return this.api.blob(`media/${encodeURIComponent(id)}`);
  }

  retainPreviews(owner: symbol, ids: readonly string[]): void {
    if (!this.session.signedIn()) {
      this.clear();
      return;
    }
    this.ownerSubscriptions.set(owner, new Set(ids.filter(Boolean)));
    this.reconcileWantedPreviews();
  }

  releasePreviews(owner: symbol): void {
    if (!this.ownerSubscriptions.has(owner)) return;
    this.ownerSubscriptions.delete(owner);
    this.reconcileWantedPreviews();
  }

  load(ids: readonly string[]): void {
    this.retainPreviews(DEFAULT_PREVIEW_OWNER, ids);
  }

  url(id: string | null | undefined): string | null {
    return id ? (this.previewUrls()[id] ?? null) : null;
  }

  loading(id: string): boolean {
    return this.previewPending().has(id);
  }

  error(id: string): string {
    return this.previewFailures()[id] ?? '';
  }

  reload(id: string): void {
    if (!this.isWanted(id) || !this.session.signedIn() || this.previewPending().has(id)) return;
    this.evictPreview(id);
    this.requestPreview(id);
  }

  clear(): void {
    this.previewGeneration += 1;
    this.ownerSubscriptions.clear();
    for (const request of this.previewRequests.values()) {
      request.unsubscribe();
    }
    this.previewRequests.clear();
    for (const objectUrl of Object.values(this.previewUrls())) {
      URL.revokeObjectURL(objectUrl);
    }
    this.previewUrls.set({});
    this.previewFailures.set({});
    this.previewPending.set(new Set());
  }

  private isWanted(id: string): boolean {
    for (const set of this.ownerSubscriptions.values()) {
      if (set.has(id)) return true;
    }
    return false;
  }

  private reconcileWantedPreviews(): void {
    const unionWanted = new Set<string>();
    for (const set of this.ownerSubscriptions.values()) {
      for (const id of set) {
        unionWanted.add(id);
      }
    }
    const knownIds = new Set([
      ...Object.keys(this.previewUrls()),
      ...Object.keys(this.previewFailures()),
      ...this.previewRequests.keys(),
    ]);
    for (const id of knownIds) {
      if (!unionWanted.has(id)) {
        this.evictPreview(id);
      }
    }
    for (const id of unionWanted) {
      if (
        !this.previewUrls()[id] &&
        !this.previewPending().has(id) &&
        !this.previewFailures()[id]
      ) {
        this.requestPreview(id);
      }
    }
  }

  private requestPreview(id: string): void {
    const generation = this.previewGeneration;
    const sessionVersion = this.session.getVersion();
    const request = new Subscription();
    this.previewRequests.set(id, request);
    this.previewPending.update((pending) => new Set(pending).add(id));
    request.add(
      this.preview(id)
        .pipe(
          finalize(() => {
            if (this.previewRequests.get(id) !== request) return;
            this.previewRequests.delete(id);
            this.previewPending.update((pending) => {
              const next = new Set(pending);
              next.delete(id);
              return next;
            });
          }),
        )
        .subscribe({
          next: (blob) => {
            if (!this.isCurrentPreview(id, generation, sessionVersion)) return;
            if (!['image/png', 'image/jpeg'].includes(blob.type)) {
              this.previewFailures.update((errors) => ({
                ...errors,
                [id]: 'Không thể xem tệp ảnh này.',
              }));
              return;
            }
            const objectUrl = URL.createObjectURL(blob);
            this.previewUrls.update((urls) => ({ ...urls, [id]: objectUrl }));
          },
          error: (rawError: unknown) => {
            if (this.isCurrentPreview(id, generation, sessionVersion)) {
              this.previewFailures.update((errors) => ({
                ...errors,
                [id]: normalizeApiError(rawError).message,
              }));
            }
          },
        }),
    );
  }

  private isCurrentPreview(id: string, generation: number, sessionVersion: number): boolean {
    return (
      this.previewGeneration === generation &&
      this.isWanted(id) &&
      this.session.signedIn() &&
      this.session.getVersion() === sessionVersion
    );
  }

  private evictPreview(id: string): void {
    this.previewRequests.get(id)?.unsubscribe();
    this.previewRequests.delete(id);
    const objectUrl = this.previewUrls()[id];
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    this.previewUrls.update((urls) => {
      const next = { ...urls };
      delete next[id];
      return next;
    });
    this.previewFailures.update((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });
  }
}
