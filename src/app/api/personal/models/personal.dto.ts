import { AbstractControl, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';

export type AccountTabKey = 'profile' | 'security' | 'sessions' | 'audit';

export interface AccountTabItem {
  readonly key: AccountTabKey;
  readonly label: string;
  readonly icon: string;
  readonly requiresAuditView?: boolean;
}

export const ACCOUNT_TABS: readonly AccountTabItem[] = [
  { key: 'profile', label: 'Hồ sơ cá nhân', icon: 'user' },
  { key: 'security', label: 'Đổi mật khẩu & Liên kết', icon: 'shield-check' },
  { key: 'sessions', label: 'Phiên đăng nhập thiết bị', icon: 'smartphone' },
  { key: 'audit', label: 'Nhật ký hoạt động', icon: 'history', requiresAuditView: true },
];

export interface PersonalProfileDto {
  readonly id: string;
  readonly version: string;
  readonly userName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly isActive: boolean;
  readonly emailConfirmed: boolean;
  readonly phoneNumber: string | null;
  readonly imageUrl: string | null;
}

export interface UpdatePersonalProfileRequest {
  readonly id: string;
  readonly version?: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly deleteCurrentImage?: boolean;
}

export interface ChangePasswordRequest {
  readonly password: string;
  readonly newPassword: string;
  readonly confirmNewPassword: string;
}

export interface ExternalLinkRequest {
  readonly idToken: string;
}

export interface UserSessionDto {
  readonly id: string;
  readonly createdOn: string;
  readonly expiresOn: string;
  readonly ipAddress: string;
}

export interface AuditDto {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly tableName: string;
  readonly dateTime: string;
  readonly oldValues: string | null;
  readonly newValues: string | null;
  readonly affectedColumns: string | null;
  readonly primaryKey: string;
}

export interface PersonalAuditFilter {
  readonly keyword?: string;
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly tableName?: string | null;
  readonly type?: string | null;
  readonly fromDate?: string | null;
  readonly toDate?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

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

export function createPersonalProfileForm() {
  return new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: requiredTrimmed(75) }),
    lastName: new FormControl('', { nonNullable: true, validators: requiredTrimmed(75) }),
    email: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
    phoneNumber: new FormControl('', { nonNullable: true }),
    deleteCurrentImage: new FormControl(false, { nonNullable: true }),
  });
}

export function createChangePasswordForm() {
  return new FormGroup(
    {
      password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(9)],
      }),
      confirmNewPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: matchingNewPasswords },
  );
}

export function createExternalLinkForm() {
  return new FormGroup({
    googleIdToken: new FormControl('', { nonNullable: true }),
    facebookIdToken: new FormControl('', { nonNullable: true }),
  });
}
