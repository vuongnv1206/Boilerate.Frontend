import { Component, HostListener, Optional, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  of,
  tap,
} from 'rxjs';
import { BaseComponent, LeaveConfirmation } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { createOperationId } from '@core/http/operation-id';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  RENEWAL_OUTCOME_LABELS,
  RENEWAL_STATUS_LABELS,
  RenewalAdminDto,
  RenewalCommand,
  RenewalCommandFailure,
  RenewalContentDto,
  RenewalHistoryDto,
  RenewalOutcome,
  RenewalStatus,
  VerifyRenewalRequest,
  readRenewalListQuery,
  renewalListQueryParams,
  renewalStatusTone,
} from '@api/renewals/models/renewal.dto';
import { RenewalsService } from '@api/renewals/services/renewals.service';
import { RenewalsWorkspace } from '../renewals-workspace.component';

@Component({
  selector: 'app-renewal-detail',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './renewal-detail.component.html',
})
export class RenewalDetail extends BaseComponent implements OnInit {
  // System variables
  private detailSub: Subscription | null = null;
  private historySub: Subscription | null = null;
  private detailSequence = 0;
  private revealSequence = 0;
  private targetSequence = 0;
  private readonly evidenceSequences = new Map<string, number>();

  // Business variables
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly outcomeLabels = RENEWAL_OUTCOME_LABELS;
  readonly status = RenewalStatus;
  readonly outcome = RenewalOutcome;

  readonly detail = signal<RenewalAdminDto | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly history = signal<readonly RenewalHistoryDto[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly commandError = signal('');
  readonly commandFailure = signal<RenewalCommandFailure>(null);
  readonly commandBusy = signal(false);
  readonly revealedTarget = signal<RenewalContentDto | null>(null);
  readonly revealedEvidence = signal<Record<string, RenewalContentDto>>({});

  readonly note = signal('');
  readonly applied = signal(true);
  readonly newExpiresAt = signal('');
  readonly evidence = signal('');
  readonly pendingCommand = signal<RenewalCommand | null>(null);
  readonly dirty = signal(false);
  activeId: string | null = null;

  readonly canView = computed(() => this.can('Renewal', 'View'));
  readonly canProcess = computed(() => this.can('Renewal', 'Process'));
  readonly canVerify = computed(() => this.can('Renewal', 'Verify'));
  readonly canReveal = computed(() => this.can('Renewal', 'Reveal'));
  readonly canViewOrders = computed(() => this.can('Order', 'View'));
  readonly expiryDateValue = computed(() => {
    const value = this.newExpiresAt();
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly renewalsService: RenewalsService,
    readonly confirmation: LeaveConfirmation,
    @Optional() private readonly workspace?: RenewalsWorkspace,
  ) {
    super();
    this.destroyRef.onDestroy(() => this.clearDetail());
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (!id) return;
        this.activeId = id;
        this.resetForm();
        this.loadDetail(id);
      });
  }

  statusLabel(value: RenewalStatus): string {
    return this.statusLabels[value];
  }

  routeQuery(): Record<string, string | number> {
    return renewalListQueryParams(readRenewalListQuery(this.route.snapshot.queryParams));
  }

  loadDetail(id: string, preserveFailure = false): void {
    this.clearDetail();
    const sequence = this.detailSequence;
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detailSub = this.renewalsService
      .getById(id)
      .pipe(
        catchError((error: unknown) => {
          if (sequence === this.detailSequence) {
            this.detailError.set(
              error instanceof ApiError ? error.message : 'Không thể tải yêu cầu gia hạn.',
            );
          }
          return of(null);
        }),
        finalize(() => {
          if (sequence === this.detailSequence) this.detailLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((renewal) => {
        if (!renewal || sequence !== this.detailSequence) return;
        this.detail.set(renewal);
        this.clearRevealedContent();
        if (!preserveFailure) {
          this.commandError.set('');
          this.commandFailure.set(null);
        }
        this.reloadHistory();
      });
  }

  reloadDetail(): void {
    const id = this.detail()?.renewal.id ?? this.activeId;
    if (id) this.loadDetail(id);
  }

  reloadHistory(afterWrite = false): void {
    const id = this.detail()?.renewal.id;
    if (!id) return;
    const sequence = this.detailSequence;
    this.historySub?.unsubscribe();
    this.historyLoading.set(true);
    this.historyError.set('');
    this.historySub = this.renewalsService
      .getHistory(id)
      .pipe(
        catchError((error: unknown) => {
          if (this.isCurrentDetail(id, sequence)) {
            const message =
              error instanceof ApiError ? error.message : 'Không thể tải lịch sử gia hạn.';
            this.historyError.set(afterWrite ? `Thao tác đã lưu. ${message}` : message);
          }
          return of(null);
        }),
        finalize(() => {
          if (this.isCurrentDetail(id, sequence)) this.historyLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((entries) => {
        if (entries && this.isCurrentDetail(id, sequence)) {
          this.history.set(entries);
        }
      });
  }

  claimAvailable(): boolean {
    const current = this.detail();
    if (!current || !this.canProcess()) return false;
    return (
      current.renewal.status === RenewalStatus.Ready ||
      (current.renewal.status === RenewalStatus.Claimed &&
        Boolean(current.claimUntilUtc) &&
        Date.parse(current.claimUntilUtc ?? '') <= Date.now())
    );
  }

  isCommandAvailable(current: RenewalAdminDto, kind: RenewalCommand['kind']): boolean {
    if (kind === 'claim') {
      return (
        this.canProcess() &&
        (current.renewal.status === RenewalStatus.Ready ||
          (current.renewal.status === RenewalStatus.Claimed &&
            Boolean(current.claimUntilUtc) &&
            Date.parse(current.claimUntilUtc ?? '') <= Date.now()))
      );
    }
    if (kind === 'release' || kind === 'start') {
      if (
        !this.canProcess() ||
        current.renewal.status !== RenewalStatus.Claimed ||
        !current.claimToken
      ) {
        return false;
      }
      return !current.claimUntilUtc || Date.parse(current.claimUntilUtc) > Date.now();
    }
    return (
      this.canVerify() &&
      current.renewal.status === RenewalStatus.PendingVerification &&
      current.attempts.some((attempt) => attempt.outcome === RenewalOutcome.Pending)
    );
  }

  setExpiryDate(value: Date | null): void {
    this.newExpiresAt.set(
      value
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        : '',
    );
    this.dirty.set(true);
  }

  onExpiryInput(event: Event): void {
    const raw = (event.target as HTMLInputElement | null)?.value?.trim();
    if (!raw) {
      this.newExpiresAt.set('');
      return;
    }
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/u.exec(raw);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]) - 1;
      const year = Number(dmy[3]);
      const hour = Number(dmy[4] ?? 0);
      const minute = Number(dmy[5] ?? 0);
      const date = new Date(year, month, day, hour, minute);
      if (!Number.isNaN(date.getTime())) {
        this.setExpiryDate(date);
        return;
      }
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      this.setExpiryDate(parsed);
    }
  }

  claim(): void {
    const current = this.current();
    if (!current || !this.claimAvailable()) return;
    this.execute(current.renewal.id, {
      kind: 'claim',
      request: { version: current.renewal.version, operationId: createOperationId() },
    });
  }

  release(): void {
    const current = this.current();
    if (!current?.claimToken || !this.isCommandAvailable(current, 'release')) return;
    this.execute(current.renewal.id, {
      kind: 'release',
      request: {
        version: current.renewal.version,
        operationId: createOperationId(),
        claimToken: current.claimToken,
      },
    });
  }

  start(): void {
    const current = this.current();
    if (!current?.claimToken || !this.isCommandAvailable(current, 'start')) return;
    this.execute(current.renewal.id, {
      kind: 'start',
      request: {
        version: current.renewal.version,
        operationId: createOperationId(),
        claimToken: current.claimToken,
      },
    });
  }

  verify(): void {
    const current = this.current();
    const attempt = current?.attempts.find((item) => item.outcome === RenewalOutcome.Pending);
    const trimmedNote = this.note().trim();
    const expiry = this.newExpiresAt();
    if (
      !current ||
      !attempt ||
      !this.isCommandAvailable(current, 'verify') ||
      !trimmedNote ||
      trimmedNote.length > 1200
    ) {
      return;
    }
    if (
      this.applied() &&
      (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())
    ) {
      return;
    }
    const request: VerifyRenewalRequest = {
      version: current.renewal.version,
      operationId: createOperationId(),
      attemptId: attempt.id,
      applied: this.applied(),
      newExpiresAtUtc: this.applied() ? new Date(expiry).toISOString() : null,
      note: trimmedNote,
      evidence: this.evidence().trim() || null,
    };
    this.execute(current.renewal.id, { kind: 'verify', request });
  }

  retry(): void {
    const pending = this.pendingCommand();
    const id = this.activeId;
    if (pending && id && !this.commandBusy()) {
      this.runCommand(id, pending, true);
    }
  }

  revealTarget(): void {
    const id = this.activeId;
    if (!id || !this.canReveal() || this.commandBusy() || this.detail()?.renewal.id !== id) return;
    const sequence = this.detailSequence;
    const revealSeq = this.revealSequence;
    const targetSeq = ++this.targetSequence;
    const isCurrent = () =>
      this.isCurrentDetail(id, sequence) &&
      revealSeq === this.revealSequence &&
      targetSeq === this.targetSequence &&
      this.canReveal();
    this.renewalsService
      .revealAdminTarget(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (content) => {
          if (isCurrent()) this.revealedTarget.set(content);
        },
        error: (error: unknown) => {
          if (isCurrent()) {
            this.commandError.set(
              error instanceof ApiError ? error.message : 'Không thể xem thông tin tài khoản.',
            );
          }
        },
      });
  }

  revealEvidence(attemptId: string): void {
    const id = this.activeId;
    if (
      !id ||
      !this.canVerify() ||
      this.commandBusy() ||
      this.detail()?.renewal.id !== id ||
      !this.detail()?.attempts.some((attempt) => attempt.id === attemptId)
    ) {
      return;
    }
    const sequence = this.detailSequence;
    const revealSeq = this.revealSequence;
    const evidenceSeq = (this.evidenceSequences.get(attemptId) ?? 0) + 1;
    this.evidenceSequences.set(attemptId, evidenceSeq);
    const isCurrent = () =>
      this.isCurrentDetail(id, sequence) &&
      revealSeq === this.revealSequence &&
      evidenceSeq === this.evidenceSequences.get(attemptId) &&
      this.canVerify();
    this.renewalsService
      .revealEvidence(id, attemptId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (content) => {
          if (isCurrent()) {
            this.revealedEvidence.update((current) => ({ ...current, [attemptId]: content }));
          }
        },
        error: (error: unknown) => {
          if (isCurrent()) {
            this.commandError.set(
              error instanceof ApiError ? error.message : 'Không thể xem nội dung đối soát.',
            );
          }
        },
      });
  }

  hideTarget(): void {
    this.targetSequence++;
    this.revealedTarget.set(null);
  }

  hideEvidence(attemptId: string): void {
    this.evidenceSequences.set(attemptId, (this.evidenceSequences.get(attemptId) ?? 0) + 1);
    this.revealedEvidence.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => id !== attemptId)),
    );
  }

  formatRevealedEvidence(content: string): string {
    if (!content) return '';
    try {
      let parsed = JSON.parse(content) as unknown;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // Plain text inside JSON string
        }
      }
      if (parsed && typeof parsed === 'object') {
        const extracted =
          (parsed as Record<string, unknown>)['Evidence'] ??
          (parsed as Record<string, unknown>)['evidence'];
        if (typeof extracted === 'string' && extracted.trim()) return extracted;
      }
    } catch {
      // Plain text content
    }
    return content;
  }

  verifyCanSubmit(): boolean {
    const current = this.current();
    const attemptPending =
      current?.attempts.some((attempt) => attempt.outcome === RenewalOutcome.Pending) ?? false;
    const expiry = this.newExpiresAt();
    return (
      Boolean(current) &&
      attemptPending &&
      Boolean(current && this.isCommandAvailable(current, 'verify')) &&
      Boolean(this.note().trim()) &&
      this.note().trim().length <= 1200 &&
      (!this.applied() ||
        (Boolean(expiry) && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > Date.now()))
    );
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.dirty() || this.pendingCommand() !== null,
      this.commandBusy(),
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.pendingCommand() || this.commandBusy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private execute(id: string, command: RenewalCommand): void {
    if (this.pendingCommand() || this.commandBusy()) return;
    this.pendingCommand.set(command);
    this.runCommand(id, command, false);
  }

  private runCommand(id: string, command: RenewalCommand, replay: boolean): void {
    const current = this.detail();
    if (!current || current.renewal.id !== id || this.commandBusy()) return;
    const action = command.kind === 'verify' ? 'Verify' : 'Process';
    if (!this.can('Renewal', action) || (replay && !this.canView())) return;
    if (!replay && !this.isCommandAvailable(current, command.kind)) return;

    this.commandBusy.set(true);
    this.commandError.set('');
    this.commandFailure.set(null);
    const sequence = this.detailSequence;
    const request$ =
      command.kind === 'claim'
        ? this.renewalsService.claim(id, command.request)
        : command.kind === 'release'
          ? this.renewalsService.release(id, command.request)
          : command.kind === 'start'
            ? this.renewalsService.start(id, command.request)
            : this.renewalsService.verify(id, command.request);

    request$
      .pipe(
        filter(() => this.isCurrentDetail(id, sequence)),
        tap((saved) => {
          this.detail.set(saved);
          this.clearRevealedContent();
          this.reloadHistory(true);
          this.workspace?.refreshPage(true);
        }),
        catchError((error: unknown) => {
          if (!this.isCurrentDetail(id, sequence)) return EMPTY;
          const httpStatus = error instanceof ApiError ? error.status : 0;
          this.commandFailure.set(httpStatus > 0 && httpStatus < 500 ? 'rejected' : 'uncertain');
          this.commandError.set(
            error instanceof ApiError
              ? error.message
              : 'Chưa nhận được kết quả từ máy chủ. Hãy kiểm tra cùng yêu cầu.',
          );
          if (httpStatus === 409) {
            this.loadDetail(id, true);
            this.workspace?.refreshPage(false);
          }
          return EMPTY;
        }),
        finalize(() => this.commandBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (this.pendingCommand() === command) this.pendingCommand.set(null);
          this.resetForm();
        },
        complete: () => {
          if (this.commandFailure() === 'rejected' && this.pendingCommand() === command) {
            this.pendingCommand.set(null);
          }
        },
      });
  }

  private current(): RenewalAdminDto | null {
    const current = this.detail();
    return current?.renewal.id === this.activeId ? current : null;
  }

  private clearDetail(): void {
    this.detailSequence++;
    this.detailSub?.unsubscribe();
    this.historySub?.unsubscribe();
    this.clearRevealedContent();
    this.detail.set(null);
    this.history.set([]);
    this.historyError.set('');
    this.historyLoading.set(false);
    this.detailError.set('');
    this.detailLoading.set(false);
  }

  private clearRevealedContent(): void {
    this.revealSequence++;
    this.evidenceSequences.clear();
    this.revealedTarget.set(null);
    this.revealedEvidence.set({});
  }

  private isCurrentDetail(id: string, sequence: number): boolean {
    return sequence === this.detailSequence && this.detail()?.renewal.id === id;
  }

  private resetForm(): void {
    this.note.set('');
    this.applied.set(true);
    this.newExpiresAt.set('');
    this.evidence.set('');
    this.dirty.set(false);
    this.pendingCommand.set(null);
  }
}
