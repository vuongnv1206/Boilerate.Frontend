import { ButtonDirective } from 'primeng/button';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { FormField } from '@shared/ui/form-field/form-field.component';
import { Table } from 'primeng/table';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Textarea } from 'primeng/textarea';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import {
  RenewalAdminDto,
  RenewalOutcome,
  RenewalStatus,
  VerifyRenewalRequest,
} from '@models/renewal.dto';
import {
  RENEWAL_OUTCOME_LABELS,
  RENEWAL_STATUS_LABELS,
  renewalStatusTone,
} from '@constants/renewal.constants';
import { RenewalCommand, RenewalsStore } from '@stores/renewals.store';

@Component({
  selector: 'app-renewal-detail',
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    ContentState,
    Icon,
    StatusBadge,
    ConfirmDialog,
    FormField,
    Table,
    Checkbox,
    DatePicker,
    Textarea,
    ButtonDirective,
  ],
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
  readonly statusTone = renewalStatusTone;
  readonly outcomeLabels = RENEWAL_OUTCOME_LABELS;
  readonly status = RenewalStatus;
  readonly outcome = RenewalOutcome;
  readonly note = signal('');
  readonly applied = signal(true);
  readonly newExpiresAt = signal('');
  readonly expiryDateValue = computed(() => {
    const value = this.newExpiresAt();
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });
  readonly evidence = signal('');
  readonly pendingCommand = signal<RenewalCommand | null>(null);
  readonly dirty = signal(false);
  activeId: string | null = null;

  statusLabel(value: RenewalStatus): string {
    return this.statusLabels[value];
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
    const raw = (event.target as HTMLInputElement)?.value?.trim();
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

  routeQuery(): Record<string, string | number> {
    const params = this.route.snapshot.queryParams;
    const rawPage = Number(params['page'] ?? 1);
    const rawStatus = Number(params['status']);
    const page = Number.isSafeInteger(rawPage) && rawPage > 1 ? rawPage : 1;
    const status = Object.values(RenewalStatus).includes(rawStatus as RenewalStatus)
      ? (rawStatus as RenewalStatus)
      : null;
    return { ...(page > 1 ? { page } : {}), ...(status !== null ? { status } : {}) };
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.store.clearDetail());
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

  formatRevealedEvidence(content: string): string {
    if (!content) return '';
    try {
      let parsed = JSON.parse(content) as unknown;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // not JSON inside string
        }
      }
      if (parsed && typeof parsed === 'object') {
        const evidence =
          (parsed as Record<string, unknown>)['Evidence'] ??
          (parsed as Record<string, unknown>)['evidence'];
        if (typeof evidence === 'string' && evidence.trim()) return evidence;
      }
    } catch {
      // not JSON
    }
    return content;
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
