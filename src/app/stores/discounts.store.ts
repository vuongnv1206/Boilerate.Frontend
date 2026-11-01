import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { DiscountDto } from '@models/discount.dto';
import { DiscountsService } from '@services/discounts.service';

@Injectable()
export class DiscountsStore {
  private readonly service = inject(DiscountsService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly itemsState = signal<readonly DiscountDto[]>([]);
  private readonly totalState = signal(0);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private subscription?: Subscription;
  readonly items = this.itemsState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly canCreate = computed(() => this.session.can('Discount', 'Create'));

  load(page: number, search: string, isActive: boolean | null): void {
    this.subscription?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set('');
    this.subscription = this.service
      .list(page, search, isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.itemsState.set(result.items);
          this.totalState.set(result.total);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.itemsState.set([]);
          this.loadingState.set(false);
          this.errorState.set(normalizeApiError(error).message);
        },
      });
  }
}
