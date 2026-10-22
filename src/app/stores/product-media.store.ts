import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  defer,
  filter,
  finalize,
  from,
  takeUntil,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_MEDIA } from '@constants/media.constants';
import { MediaAssetDto } from '@models/media.dto';
import { MediaService } from '@services/media.service';

@Injectable()
export class ProductMediaStore {
  private readonly service = inject(MediaService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly uploading = signal(false);
  private readonly failure = signal('');
  private readonly stop = new Subject<void>();

  readonly busy = this.uploading.asReadonly();
  readonly error = this.failure.asReadonly();
  readonly canUpload = computed(
    () => this.session.can('Product', 'Create') || this.session.can('Product', 'Update'),
  );

  constructor() {
    effect(() => {
      if (!this.session.signedIn()) this.stop.next();
    });
  }

  upload(files: readonly File[], remaining: number): Observable<MediaAssetDto> {
    return defer(() => {
      if (this.uploading() || !files.length || !this.session.signedIn() || !this.canUpload())
        return EMPTY;
      this.failure.set('');
      if (files.length > remaining) {
        this.failure.set(`Mỗi sản phẩm có tối đa ${MAX_PRODUCT_MEDIA} ảnh.`);
        return EMPTY;
      }
      if (
        files.some(
          (file) =>
            !/\.(?:png|jpe?g)$/iu.test(file.name) ||
            (file.type !== '' && !['image/png', 'image/jpeg'].includes(file.type)),
        )
      ) {
        this.failure.set('Chọn ảnh PNG hoặc JPEG.');
        return EMPTY;
      }
      if (files.some((file) => file.size === 0 || file.size > MAX_PRODUCT_IMAGE_BYTES)) {
        this.failure.set('Mỗi ảnh phải lớn hơn 0 byte và không quá 5 MiB.');
        return EMPTY;
      }
      this.uploading.set(true);
      const sessionVersion = this.session.getVersion();
      const current = (): boolean =>
        this.session.signedIn() && this.session.getVersion() === sessionVersion;
      return from(files).pipe(
        concatMap((file) => (current() ? this.service.upload(file) : EMPTY)),
        filter(() => current()),
        takeUntil(this.stop),
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.failure.set(normalizeApiError(error).message);
          return EMPTY;
        }),
        finalize(() => this.uploading.set(false)),
      );
    });
  }
}
