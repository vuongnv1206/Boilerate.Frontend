import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import {
  RenewalAdminDto,
  RenewalOutcome,
  RenewalStatus,
  VerifyRenewalRequest,
} from '@models/renewal.dto';
import { RENEWAL_OUTCOME_LABELS, RENEWAL_STATUS_LABELS } from '@constants/renewal.constants';
import { RenewalCommand, RenewalsStore } from '@stores/renewals.store';

@Component({
  selector: 'app-renewal-detail',
  imports: [RouterLink, FormsModule, DatePipe, ContentState, Icon, ConfirmDialog],
  providers: [LeaveConfirmation],
  templateUrl: './renewal-detail.component.html',
  styleUrl: '../../../styles/admin/_renewals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenewalDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(RenewalsStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly outcomeLabels = RENEWAL_OUTCOME_LABELS;
  readonly status = RenewalStatus;
  readonly outcome = RenewalOutcome;
  readonly note = signal('');
  readonly applied = signal(true);
  readonly newExpiresAt = signal('');
  readonly evidence = signal('');
  readonly pendingCommand = signal<RenewalCommand | null>(null);
  readonly dirty = signal(false);
  activeId: string | null = null;

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
        this.store.loadDetail(id);
      });
  }

  claim(): void {
    const detail = this.current();
    if (!detail || !this.store.claimAvailable()) return;
    this.execute(detail.renewal.id, {
      kind: 'claim',
      request: { version: detail.renewal.version, operationId: crypto.randomUUID() },
    });
  }

  release(): void {
    const detail = this.current();
    if (!detail?.claimToken || !this.store.isCommandAvailable(detail, 'release')) return;
    this.execute(detail.renewal.id, {
      kind: 'release',
      request: {
        version: detail.renewal.version,
        operationId: crypto.randomUUID(),
        claimToken: detail.claimToken,
      },
    });
  }

  start(): void {
    const detail = this.current();
    if (!detail?.claimToken || !this.store.isCommandAvailable(detail, 'start')) return;
    this.execute(detail.renewal.id, {
      kind: 'start',
      request: {
        version: detail.renewal.version,
        operationId: crypto.randomUUID(),
        claimToken: detail.claimToken,
      },
    });
  }

  verify(): void {
    const detail = this.current();
    const attempt = detail?.attempts.find((item) => item.outcome === RenewalOutcome.Pending);
    const note = this.note().trim();
    const expiry = this.newExpiresAt();
    if (
      !detail ||
      !attempt ||
      !this.store.isCommandAvailable(detail, 'verify') ||
      !note ||
      note.length > 1200
    )
      return;
    if (
      this.applied() &&
      (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())
    )
      return;
    const request: VerifyRenewalRequest = {
      version: detail.renewal.version,
      operationId: crypto.randomUUID(),
      attemptId: attempt.id,
      applied: this.applied(),
      newExpiresAtUtc: this.applied() ? new Date(expiry).toISOString() : null,
      note,
      evidence: this.evidence().trim() || null,
    };
    this.dirty.set(false);
    this.execute(detail.renewal.id, { kind: 'verify', request });
  }

  retry(): void {
    const pending = this.pendingCommand();
    const id = this.activeId;
    if (pending && id && !this.store.commandBusy()) this.runCommand(id, pending, true);
  }

  revealTarget(): void {
    if (this.activeId) this.store.revealTarget(this.activeId);
  }

  revealEvidence(attemptId: string): void {
    if (this.activeId) this.store.revealEvidence(this.activeId, attemptId);
  }

  hideEvidence(attemptId: string): void {
    this.store.hideEvidence(attemptId);
  }

  hideTarget(): void {
    this.store.hideTarget();
  }

  verifyCanSubmit(): boolean {
    const detail = this.current();
    const attemptPending =
      detail?.attempts.some((attempt) => attempt.outcome === RenewalOutcome.Pending) ?? false;
    const expiry = this.newExpiresAt();
    return (
      !!detail &&
      attemptPending &&
      this.store.isCommandAvailable(detail, 'verify') &&
      !!this.note().trim() &&
      this.note().trim().length <= 1200 &&
      (!this.applied() ||
        (!!expiry && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > Date.now()))
    );
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.dirty() || this.pendingCommand() !== null,
      this.store.commandBusy(),
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.pendingCommand() || this.store.commandBusy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private execute(id: string, command: RenewalCommand): void {
    if (this.pendingCommand() || this.store.commandBusy()) return;
    this.pendingCommand.set(command);
    this.runCommand(id, command, false);
  }

  private runCommand(id: string, command: RenewalCommand, replay: boolean): void {
    this.store
      .execute(id, command, replay)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.pendingCommand() === command) this.pendingCommand.set(null);
          this.resetForm();
        },
        complete: () => {
          if (this.store.commandFailure() === 'rejected' && this.pendingCommand() === command)
            this.pendingCommand.set(null);
        },
      });
  }

  private current(): RenewalAdminDto | null {
    const detail = this.store.detail();
    return detail?.renewal.id === this.activeId ? detail : null;
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
