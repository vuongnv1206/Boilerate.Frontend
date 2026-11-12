import {
  Component,
  HostListener,
  OnInit,
  ViewEncapsulation,
  computed,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { formatVnDateTime } from '@shared/utils/date.util';
import {
  ACCOUNT_TABS,
  AccountTabKey,
  AuditDto,
  PersonalProfileDto,
  UserSessionDto,
} from '@api/personal/models/personal.dto';
import { PersonalService } from '@api/personal/services/personal.service';

const requiredTrimmed = (maxLength: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(maxLength),
];

const matchingNewPasswords: ValidatorFn = (control: AbstractControl) => {
  const next = control.get('newPassword')?.value;
  const confirm = control.get('confirmNewPassword')?.value;
  return next === confirm ? null : { passwordMismatch: true };
};

type PersonalProfileForm = FormGroup<{
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  phoneNumber: FormControl<string>;
  deleteCurrentImage: FormControl<boolean>;
}>;

@Component({
  selector: 'app-account',
  host: {
    style:
      '--border-1: var(--border); --radius-md: var(--radius); --radius-lg: 12px; display: block;',
  },
  encapsulation: ViewEncapsulation.None,
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './account.component.html',
  styleUrl: '../../../../styles/ui/_account.scss',
})
export class AccountComponent extends BaseComponent implements OnInit {
  // System variables
  readonly saving = signal(false);
  readonly conflict = signal(false);
  readonly summaryErrors = signal<readonly string[]>([]);
  readonly activeTab = signal<AccountTabKey>('profile');
  readonly canViewAudit = computed(() => this.can('Users', 'View'));
  readonly canExportAudit = computed(() => this.can('Users', 'Export'));
  readonly visibleTabs = computed(() =>
    ACCOUNT_TABS.filter((tab) => !tab.requiresAuditView || this.canViewAudit()),
  );
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');
  readonly linkingProvider = signal<'google' | 'facebook' | null>(null);
  readonly linkError = signal('');
  readonly sessionsLoading = signal(false);
  readonly sessionsLoaded = signal(false);
  readonly sessionsError = signal('');
  readonly revokingSessionId = signal<string | null>(null);
  readonly auditLoading = signal(false);
  readonly auditLoaded = signal(false);
  readonly auditError = signal('');
  readonly exportingAudit = signal(false);

  // Business variables
  readonly record = signal<PersonalProfileDto | null>(null);
  readonly form: PersonalProfileForm;
  readonly passwordForm: FormGroup<{
    password: FormControl<string>;
    newPassword: FormControl<string>;
    confirmNewPassword: FormControl<string>;
  }>;
  readonly externalLinkForm: FormGroup<{
    googleIdToken: FormControl<string>;
    facebookIdToken: FormControl<string>;
  }>;

  readonly sessions = signal<readonly UserSessionDto[]>([]);
  readonly auditItems = signal<readonly AuditDto[]>([]);
  readonly auditTotal = signal(0);
  readonly auditPage = signal(1);
  readonly auditPageSize = signal(10);
  readonly auditTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.auditTotal() / Math.max(1, this.auditPageSize()))),
  );
  readonly auditKeyword = signal('');

  readonly initials = computed(() => {
    const profile = this.record();
    if (!profile) return 'TK';
    const first = profile.firstName?.trim().charAt(0) ?? '';
    const last = profile.lastName?.trim().charAt(0) ?? '';
    const combined = `${first}${last}`.toUpperCase();
    return (
      combined || (profile.userName?.charAt(0) ?? profile.email?.charAt(0) ?? 'U').toUpperCase()
    );
  });

  constructor(
    private readonly personalService: PersonalService,
    private readonly fb: FormBuilder,
    readonly confirmation: LeaveConfirmation,
  ) {
    super();
    this.form = this.fb.nonNullable.group({
      firstName: ['', requiredTrimmed(75)],
      lastName: ['', requiredTrimmed(75)],
      email: [{ value: '', disabled: true }],
      phoneNumber: [''],
      deleteCurrentImage: [false],
    });
    this.passwordForm = this.fb.nonNullable.group(
      {
        password: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(9)]],
        confirmNewPassword: ['', [Validators.required]],
      },
      { validators: matchingNewPasswords },
    );
    this.externalLinkForm = this.fb.nonNullable.group({
      googleIdToken: [''],
      facebookIdToken: [''],
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  selectTab(tab: AccountTabKey): void {
    if (tab === 'audit' && !this.canViewAudit()) return;
    this.activeTab.set(tab);
    if (tab === 'sessions' && !this.sessionsLoaded()) {
      this.loadSessions();
    } else if (tab === 'audit' && !this.auditLoaded()) {
      this.loadAuditLogs(1);
    }
  }

  profileFieldError(field: 'firstName' | 'lastName' | 'phoneNumber'): string | null {
    const msg = validationMessage(this.form.controls[field]);
    return msg || null;
  }

  submitChangePassword(): void {
    if (this.passwordSaving()) return;
    this.passwordError.set('');
    clearServerErrors(this.passwordForm);
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    const raw = this.passwordForm.getRawValue();
    this.run(
      this.personalService.changePassword({
        password: raw.password,
        newPassword: raw.newPassword,
        confirmNewPassword: raw.confirmNewPassword,
      }),
      {
        busy: this.passwordSaving,
        successMessage: 'Đã đổi mật khẩu thành công.',
        onSuccess: () => {
          this.passwordForm.reset(
            { password: '', newPassword: '', confirmNewPassword: '' },
            { emitEvent: false },
          );
          this.passwordForm.markAsPristine();
          this.passwordForm.markAsUntouched();
        },
        onError: (apiError) => {
          if (apiError.kind === 'validation') {
            const unmapped = applyServerErrors(this.passwordForm, apiError.fieldErrors);
            if (unmapped.length > 0 || Object.keys(apiError.fieldErrors).length === 0) {
              this.passwordError.set(apiError.message);
            }
          } else {
            this.passwordError.set(apiError.message);
          }
        },
      },
    );
  }

  passwordFieldError(field: 'password' | 'newPassword' | 'confirmNewPassword'): string | null {
    const control = this.passwordForm.controls[field];
    if (field === 'newPassword' && control.touched && control.hasError('minlength')) {
      return 'Mật khẩu mới cần tối thiểu 9 ký tự.';
    }
    if (
      field === 'confirmNewPassword' &&
      control.touched &&
      this.passwordForm.hasError('passwordMismatch')
    ) {
      return 'Mật khẩu xác nhận chưa khớp.';
    }
    const msg = validationMessage(control);
    return msg || null;
  }

  linkExternal(provider: 'google' | 'facebook'): void {
    if (this.linkingProvider()) return;
    this.linkError.set('');
    const raw = this.externalLinkForm.getRawValue();
    const idToken = (provider === 'google' ? raw.googleIdToken : raw.facebookIdToken).trim();
    if (!idToken) {
      this.linkError.set('Vui lòng nhập mã xác thực (ID Token / Access Token) để liên kết.');
      return;
    }
    this.linkingProvider.set(provider);
    const request$ =
      provider === 'google'
        ? this.personalService.linkGoogle({ idToken })
        : this.personalService.linkFacebook({ idToken });
    this.run(request$, {
      successMessage:
        provider === 'google' ? 'Đã liên kết tài khoản Google.' : 'Đã liên kết tài khoản Facebook.',
      onSuccess: () => {
        this.linkingProvider.set(null);
        if (provider === 'google') {
          this.externalLinkForm.controls.googleIdToken.setValue('');
        } else {
          this.externalLinkForm.controls.facebookIdToken.setValue('');
        }
      },
      onError: (apiError) => {
        this.linkingProvider.set(null);
        this.linkError.set(apiError.message);
      },
    });
  }

  loadSessions(): void {
    this.sessionsError.set('');
    this.run(this.personalService.getSessions(), {
      busy: this.sessionsLoading,
      onSuccess: (items) => {
        this.sessions.set(items);
        this.sessionsLoaded.set(true);
      },
      onError: (apiError) => {
        this.sessionsError.set(apiError.message);
      },
    });
  }

  isCurrentSession(item: UserSessionDto): boolean {
    const currentId = this.session.sessionId();
    return Boolean(currentId && item.id.toLowerCase() === currentId.toLowerCase());
  }

  revokeSession(item: UserSessionDto): void {
    if (this.isCurrentSession(item) || this.revokingSessionId()) return;
    this.revokingSessionId.set(item.id);
    this.sessionsError.set('');
    this.run(this.personalService.revokeSession(item.id), {
      successMessage: 'Đã thu hồi phiên đăng nhập.',
      onSuccess: () => {
        this.revokingSessionId.set(null);
        this.sessions.update((list) => list.filter((entry) => entry.id !== item.id));
      },
      onError: (apiError) => {
        this.revokingSessionId.set(null);
        this.sessionsError.set(apiError.message);
      },
    });
  }

  searchAudit(keyword: string): void {
    this.auditKeyword.set(keyword.trim());
    this.loadAuditLogs(1);
  }

  loadAuditLogs(pageNumber = this.auditPage()): void {
    if (!this.canViewAudit()) return;
    const safePage = Math.max(1, pageNumber);
    this.auditError.set('');
    this.run(
      this.personalService.getAuditLogs({
        keyword: this.auditKeyword(),
        pageNumber: safePage,
        pageSize: this.auditPageSize(),
      }),
      {
        busy: this.auditLoading,
        onSuccess: (result) => {
          this.auditItems.set(result.items);
          this.auditTotal.set(result.total);
          this.auditPage.set(result.page);
          this.auditPageSize.set(result.pageSize);
          this.auditLoaded.set(true);
        },
        onError: (apiError) => {
          this.auditError.set(apiError.message);
        },
      },
    );
  }

  exportAudit(): void {
    if (!this.canExportAudit() || this.exportingAudit()) return;
    this.run(
      this.personalService.exportAuditLogs({
        keyword: this.auditKeyword(),
      }),
      {
        busy: this.exportingAudit,
        successMessage: 'Đã xuất tệp Excel nhật ký hoạt động.',
        toastOnError: true,
      },
    );
  }

  formatDateTime(value: string | null | undefined): string {
    return formatVnDateTime(value);
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    this.conflict.set(false);
    this.personalService
      .getProfile()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.showProfile(profile),
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.loadData();
  }

  saveChange(): void {
    const record = this.record();
    if (!record || this.saving()) return;
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    this.conflict.set(false);
    this.personalService
      .updateProfile({
        id: record.id,
        version: record.version,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: (record.email ?? value.email).trim(),
        phoneNumber: value.phoneNumber.trim() || null,
        deleteCurrentImage: value.deleteCurrentImage,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.showProfile(saved);
          this.toast.success('Đã cập nhật hồ sơ cá nhân.');
          this.session
            .reloadAuthorization()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ error: () => undefined });
        },
        // The form keeps what was typed, also on 409: the user reloads when ready.
        error: (error: unknown) => {
          const apiError = normalizeApiError(error);
          const unmapped = applyServerErrors(this.form, apiError.fieldErrors).flatMap(
            (entry) => entry.messages,
          );
          this.conflict.set(apiError.kind === 'conflict');
          if (apiError.kind !== 'validation') {
            this.errorMessage.set(apiError.message);
            this.summaryErrors.set(unmapped);
          } else if (unmapped.length || Object.keys(apiError.fieldErrors).length) {
            this.summaryErrors.set(unmapped);
          } else {
            this.summaryErrors.set([apiError.message]);
          }
        },
      });
  }

  /** Asked by `unsavedChangesGuard` before leaving, and before reloading the profile. */
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty, this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private showProfile(profile: PersonalProfileDto): void {
    this.record.set(profile);
    this.form.reset({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      email: profile.email ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      deleteCurrentImage: false,
    });
  }
}
