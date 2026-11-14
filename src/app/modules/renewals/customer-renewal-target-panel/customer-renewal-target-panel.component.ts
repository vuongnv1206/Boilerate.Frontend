import { Component, effect, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { SecretReveal } from '@shared/ui/secret-reveal/secret-reveal.component';
import { RENEWAL_STATUS_LABELS, RenewalDto, RenewalStatus } from '@api/renewals/models/renewal.dto';
import { renewalStatusTone } from '@api/renewals/models/renewal.util';
import { RenewalsService } from '@api/renewals/services/renewals.service';

@Component({
  selector: 'app-customer-renewal-target-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS, SecretReveal],
  templateUrl: './customer-renewal-target-panel.component.html',
})
export class CustomerRenewalTargetPanel extends BaseComponent {
  // System variables
  private loadSub: Subscription | null = null;
  private readonly revealSubs = new Map<string, Subscription>();
  readonly orderId = input.required<string>();
  readonly paid = input(false);

  // Business variables
  readonly renewals = signal<readonly RenewalDto[]>([]);
  readonly drafts = signal<Readonly<Record<string, string>>>({});
  readonly submittingIds = signal<Readonly<Record<string, boolean>>>({});
  readonly itemErrors = signal<Readonly<Record<string, string>>>({});
  readonly revealedTargets = signal<Readonly<Record<string, string>>>({});
  readonly revealingIds = signal<Readonly<Record<string, boolean>>>({});
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly renewalStatus = RenewalStatus;

  constructor(private readonly renewalsService: RenewalsService) {
    super();
    this.destroyRef.onDestroy(() => {
      this.loadSub?.unsubscribe();
      for (const sub of this.revealSubs.values()) sub.unsubscribe();
      this.revealSubs.clear();
    });
    effect(() => {
      const id = this.orderId();
      const isPaid = this.paid();
      void isPaid;
      untracked(() => {
        if (!id) {
          this.resetState();
          return;
        }
        this.loadRenewals(id);
      });
    });
  }

  reload(): void {
    const id = this.orderId();
    if (id) {
      this.loadRenewals(id);
    }
  }

  canEditTarget(renewal: RenewalDto): boolean {
    return (
      renewal.status === RenewalStatus.AwaitingTarget || renewal.status === RenewalStatus.Ready
    );
  }

  draftValue(renewalId: string): string {
    return this.drafts()[renewalId] ?? '';
  }

  setDraft(renewalId: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [renewalId]: value }));
    if (this.itemErrors()[renewalId]) {
      this.itemErrors.update((current) => ({ ...current, [renewalId]: '' }));
    }
  }

  canSubmitTarget(renewal: RenewalDto): boolean {
    const value = this.draftValue(renewal.id).trim();
    return (
      this.canEditTarget(renewal) &&
      value.length > 0 &&
      value.length <= 256 &&
      this.submittingIds()[renewal.id] !== true
    );
  }

  submitTarget(renewal: RenewalDto): void {
    const currentOrderId = this.orderId();
    const identifier = this.draftValue(renewal.id).trim();
    if (!currentOrderId || !this.canSubmitTarget(renewal)) return;

    const payload = {
      version: renewal.version,
      accountIdentifier: identifier,
    };
    this.submittingIds.update((current) => ({ ...current, [renewal.id]: true }));
    this.itemErrors.update((current) => ({ ...current, [renewal.id]: '' }));

    this.runIdempotent(
      `customer-renewal-target:${renewal.id}`,
      payload,
      (operationId) =>
        this.renewalsService.submitCustomerTarget(currentOrderId, renewal.id, {
          ...payload,
          operationId,
        }),
      {
        successMessage: 'Đã lưu tài khoản gia hạn.',
        onSuccess: (updated) => {
          this.submittingIds.update((current) => ({ ...current, [renewal.id]: false }));
          this.drafts.update((current) => ({ ...current, [renewal.id]: '' }));
          this.hideTarget(renewal.id);
          this.renewals.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
        },
        onError: (apiError) => {
          this.submittingIds.update((current) => ({ ...current, [renewal.id]: false }));
          this.itemErrors.update((current) => ({
            ...current,
            [renewal.id]: apiError.message,
          }));
          if (apiError.status === 409) {
            this.loadRenewals(currentOrderId);
          }
        },
      },
    );
  }

  revealTarget(renewalId: string): void {
    const currentOrderId = this.orderId();
    if (!currentOrderId || this.revealingIds()[renewalId]) return;
    this.revealSubs.get(renewalId)?.unsubscribe();
    this.revealingIds.update((current) => ({ ...current, [renewalId]: true }));
    this.itemErrors.update((current) => ({ ...current, [renewalId]: '' }));

    const sub = this.renewalsService
      .revealCustomerTarget(currentOrderId, renewalId)
      .pipe(
        finalize(() => {
          this.revealingIds.update((current) => ({ ...current, [renewalId]: false }));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.revealedTargets.update((current) => ({
            ...current,
            [renewalId]: result.content,
          }));
        },
        error: (err: unknown) => {
          this.itemErrors.update((current) => ({
            ...current,
            [renewalId]: normalizeApiError(err).message,
          }));
        },
      });
    this.revealSubs.set(renewalId, sub);
  }

  hideTarget(renewalId: string): void {
    this.revealSubs.get(renewalId)?.unsubscribe();
    this.revealSubs.delete(renewalId);
    this.revealedTargets.update((current) => {
      const next = { ...current };
      delete next[renewalId];
      return next;
    });
  }

  private resetState(): void {
    this.loadSub?.unsubscribe();
    for (const sub of this.revealSubs.values()) sub.unsubscribe();
    this.revealSubs.clear();
    this.renewals.set([]);
    this.drafts.set({});
    this.submittingIds.set({});
    this.itemErrors.set({});
    this.revealedTargets.set({});
    this.revealingIds.set({});
    this.loading.set(false);
    this.errorMessage.set('');
  }

  private loadRenewals(orderId: string): void {
    this.loadSub?.unsubscribe();
    this.loadSub = this.run(this.renewalsService.getCustomerOrderRenewals(orderId), {
      onSuccess: (items) => {
        this.renewals.set(items);
        this.revealedTargets.set({});
      },
    });
  }
}
