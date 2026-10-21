import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, defer, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { AuthSession } from '@core/auth/auth-session';
import {
  ClaimRenewalRequest,
  RenewalAdminDto,
  RenewalContentDto,
  RenewalHistoryDto,
  RenewalPage,
  RenewalStatus,
  ReleaseRenewalRequest,
  StartRenewalRequest,
  VerifyRenewalRequest,
} from '@models/renewal.dto';
import { RenewalsService } from '@services/renewals.service';

export type RenewalCommand =
  | { readonly kind: 'claim'; readonly request: ClaimRenewalRequest }
  | { readonly kind: 'release'; readonly request: ReleaseRenewalRequest }
  | { readonly kind: 'start'; readonly request: StartRenewalRequest }
  | { readonly kind: 'verify'; readonly request: VerifyRenewalRequest };

@Injectable()
export class RenewalsStore {
  private readonly service = inject(RenewalsService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageRequests = new Subject<{ page: number; status: RenewalStatus | null }>();
  private readonly detailRequests = new Subject<{
    id: string;
    sequence: number;
    preserveFailure: boolean;
  }>();
  private detailSequence = 0;
  private readonly pageState = signal<RenewalPage>({
    items: [],
    total: 0,
    pageNumber: 1,
    pageSize: 20,
  });
  private readonly selectedStatusState = signal<RenewalStatus | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private readonly pageCorrectionState = signal<number | null>(null);
  private readonly detailState = signal<RenewalAdminDto | null>(null);
  private readonly historyState = signal<readonly RenewalHistoryDto[]>([]);
  private readonly historyErrorState = signal('');
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal('');
  private readonly commandErrorState = signal('');
  private readonly commandFailureState = signal<'rejected' | 'uncertain' | null>(null);
  private readonly commandBusyState = signal(false);
  private readonly revealedTargetState = signal<RenewalContentDto | null>(null);
  private readonly revealedEvidenceState = signal<Record<string, RenewalContentDto>>({});
  readonly page = this.pageState.asReadonly();
  readonly selectedStatus = this.selectedStatusState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly pageCorrection = this.pageCorrectionState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly history = this.historyState.asReadonly();
  readonly historyError = this.historyErrorState.asReadonly();
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly commandError = this.commandErrorState.asReadonly();
  readonly commandFailure = this.commandFailureState.asReadonly();
  readonly commandBusy = this.commandBusyState.asReadonly();
  readonly revealedTarget = this.revealedTargetState.asReadonly();
  readonly revealedEvidence = this.revealedEvidenceState.asReadonly();
  readonly canView = computed(() => this.session.can('Renewal', 'View'));
  readonly canProcess = computed(() => this.session.can('Renewal', 'Process'));
  readonly canVerify = computed(() => this.session.can('Renewal', 'Verify'));
  readonly canReveal = computed(() => this.session.can('Renewal', 'Reveal'));
  readonly canViewOrders = computed(() => this.session.can('Order', 'View'));
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / this.page().pageSize)),
  );

  constructor() {
    this.pageRequests
      .pipe(
        switchMap(({ page, status }) => {
          this.loadingState.set(true);
          this.errorState.set('');
          return this.service.list(page, status).pipe(
            catchError((error: unknown) => {
              this.errorState.set(
                error instanceof ApiError ? error.message : 'Không thể tải danh sách gia hạn.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loadingState.set(false);
        if (!result) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (result.pageNumber > lastPage) {
          this.pageCorrectionState.set(lastPage);
          return;
        }
        this.pageCorrectionState.set(null);
        this.pageState.set(result);
      });
    this.detailRequests
      .pipe(
        switchMap(({ id, sequence, preserveFailure }) => {
          this.detailLoadingState.set(true);
          this.detailErrorState.set('');
          this.historyErrorState.set('');
          return forkJoin({
            renewal: this.service.get(id),
            history: this.service.history(id),
          }).pipe(
            catchError((error: unknown) => {
              if (sequence === this.detailSequence)
                this.detailErrorState.set(
                  error instanceof ApiError ? error.message : 'Không thể tải yêu cầu gia hạn.',
                );
              return of(null);
            }),
            finalize(() => {
              if (sequence === this.detailSequence) this.detailLoadingState.set(false);
            }),
            map((result) => result && { ...result, sequence, preserveFailure }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result || result.sequence !== this.detailSequence) return;
        this.detailState.set(result.renewal);
        this.historyState.set(result.history);
        this.revealedTargetState.set(null);
        this.revealedEvidenceState.set({});
        if (!result.preserveFailure) {
          this.commandErrorState.set('');
          this.commandFailureState.set(null);
        }
      });
    this.destroyRef.onDestroy(() => {
      this.pageRequests.complete();
      this.detailRequests.complete();
    });
  }

  loadPage(page = 1, status = this.selectedStatus()): void {
    const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
    this.selectedStatusState.set(status);
    this.pageCorrectionState.set(null);
    this.clearRevealedContent();
    this.pageRequests.next({ page: safePage, status });
  }

  loadDetail(id: string, preserveFailure = false): void {
    this.detailSequence++;
    this.clearRevealedContent();
    this.detailState.set(null);
    this.historyState.set([]);
    this.detailRequests.next({ id, sequence: this.detailSequence, preserveFailure });
  }

  reloadDetail(): void {
    const id = this.detail()?.renewal.id;
    if (id) this.loadDetail(id);
  }

  execute(id: string, command: RenewalCommand, replay = false) {
    return defer(() => {
      const detail = this.detail();
      if (!detail || detail.renewal.id !== id || this.commandBusy()) return EMPTY;
      const action = command.kind === 'verify' ? 'Verify' : 'Process';
      if (!this.session.can('Renewal', action) || (replay && !this.canView())) return EMPTY;
      if (!replay && !this.isCommandAvailable(detail, command.kind)) return EMPTY;
      this.commandBusyState.set(true);
      this.commandErrorState.set('');
      this.commandFailureState.set(null);
      const request =
        command.kind === 'claim'
          ? this.service.claim(id, command.request)
          : command.kind === 'release'
            ? this.service.release(id, command.request)
            : command.kind === 'start'
              ? this.service.start(id, command.request)
              : this.service.verify(id, command.request);
      return request.pipe(
        switchMap((saved) => {
          this.detailState.set(saved);
          this.revealedTargetState.set(null);
          this.revealedEvidenceState.set({});
          return this.service.history(id).pipe(
            catchError((error: unknown) => {
              this.historyErrorState.set(
                error instanceof ApiError ? error.message : 'Không thể tải lịch sử gia hạn.',
              );
              return of(null);
            }),
            switchMap((history) => of({ saved, history })),
          );
        }),
        catchError((error: unknown) => {
          if (this.detail()?.renewal.id !== id) return EMPTY;
          const status = error instanceof ApiError ? error.status : 0;
          this.commandFailureState.set(status > 0 && status < 500 ? 'rejected' : 'uncertain');
          this.commandErrorState.set(
            error instanceof ApiError
              ? error.message
              : 'Chưa nhận được kết quả từ máy chủ. Hãy kiểm tra cùng yêu cầu.',
          );
          if (status === 409) this.loadDetail(id, true);
          return EMPTY;
        }),
        finalize(() => this.commandBusyState.set(false)),
        takeUntilDestroyed(this.destroyRef),
      );
    });
  }

  claimAvailable(): boolean {
    const detail = this.detail();
    if (!detail || !this.canProcess()) return false;
    return (
      detail.renewal.status === 2 ||
      (detail.renewal.status === 3 &&
        !!detail.claimUntilUtc &&
        Date.parse(detail.claimUntilUtc) <= Date.now())
    );
  }

  isCommandAvailable(detail: RenewalAdminDto, kind: RenewalCommand['kind']): boolean {
    if (kind === 'claim')
      return (
        this.canProcess() &&
        (detail.renewal.status === 2 ||
          (detail.renewal.status === 3 &&
            !!detail.claimUntilUtc &&
            Date.parse(detail.claimUntilUtc) <= Date.now()))
      );
    if (kind === 'release' || kind === 'start') {
      if (!this.canProcess() || detail.renewal.status !== 3 || !detail.claimToken) return false;
      return !detail.claimUntilUtc || Date.parse(detail.claimUntilUtc) > Date.now();
    }
    return (
      this.canVerify() &&
      detail.renewal.status === 4 &&
      detail.attempts.some((attempt) => attempt.outcome === 1)
    );
  }

  revealTarget(id: string): void {
    if (!this.canReveal() || this.commandBusy() || this.detail()?.renewal.id !== id) return;
    this.service
      .revealTarget(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (content) => this.revealedTargetState.set(content),
        error: (error: unknown) =>
          this.commandErrorState.set(
            error instanceof ApiError ? error.message : 'Không thể xem thông tin tài khoản.',
          ),
      });
  }

  revealEvidence(id: string, attemptId: string): void {
    if (
      !this.canVerify() ||
      this.commandBusy() ||
      this.detail()?.renewal.id !== id ||
      !this.detail()?.attempts.some((attempt) => attempt.id === attemptId)
    )
      return;
    this.service
      .revealEvidence(id, attemptId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (content) =>
          this.revealedEvidenceState.update((current) => ({ ...current, [attemptId]: content })),
        error: (error: unknown) =>
          this.commandErrorState.set(
            error instanceof ApiError ? error.message : 'Không thể xem nội dung đối soát.',
          ),
      });
  }

  hideTarget(): void {
    this.revealedTargetState.set(null);
  }

  hideEvidence(attemptId: string): void {
    this.revealedEvidenceState.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => id !== attemptId)),
    );
  }

  private clearRevealedContent(): void {
    this.revealedTargetState.set(null);
    this.revealedEvidenceState.set({});
  }
}
