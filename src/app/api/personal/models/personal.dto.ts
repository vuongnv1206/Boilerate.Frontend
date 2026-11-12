export type AccountTabKey = 'profile' | 'security' | 'sessions' | 'audit';

interface AccountTabItem {
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
