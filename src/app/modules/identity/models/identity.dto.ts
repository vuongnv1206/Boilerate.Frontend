import { AbstractControl, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';

export interface CapabilityDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: string;
  readonly isActive: boolean;
}

export interface ActionDto extends CapabilityDto {
  readonly selected: boolean;
}

export interface FunctionDto extends CapabilityDto {
  readonly groupId: string;
  readonly actionDtos: readonly ActionDto[];
}

export interface FunctionGroupDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly version: string;
}

export interface RoleDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: string;
}

export interface SystemUserDto {
  readonly id: string;
  readonly userName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly isActive: boolean;
  readonly emailConfirmed: boolean;
  readonly imageUrl: string | null;
  readonly version: string;
}

export interface UserRoleDto {
  readonly roleId: string;
  readonly roleName: string;
  readonly description: string | null;
  readonly enabled: boolean;
}

export interface UserPageDto {
  readonly data: readonly SystemUserDto[];
  readonly totalCount: number;
}

export interface CreateUserRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly userName: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly phoneNumber: string | null;
}

export type SelfRegisterRequest = CreateUserRequest;

export interface UpdateUserRequest {
  readonly version: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly image?: File | null;
  readonly deleteCurrentImage?: boolean;
}

export interface CapabilityRequest {
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly version?: string;
  readonly groupId?: string;
}

export interface FunctionGroupRequest {
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly version?: string;
}

export interface RoleRequest {
  readonly name: string;
  readonly description: string | null;
  readonly version?: string;
}

export interface PermissionPair {
  readonly functionId: string;
  readonly actionId: string;
}

export interface UserSearchFilter {
  readonly keyword?: string;
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly isActive?: boolean | null;
}

export interface ExportUsersRequest {
  readonly keyword?: string;
  readonly isActive?: boolean | null;
  readonly role?: string | null;
}

export interface ForgotPasswordRequest {
  readonly email: string;
}

export interface ResetPasswordRequest {
  readonly email: string;
  readonly password: string;
  readonly token: string;
}

export interface ConfirmAccountParams {
  readonly userId: string;
  readonly code: string;
}

export interface OAuthLoginRequest {
  readonly idToken: string;
}

export type ConfirmMode = 'email' | 'phone';

export interface ConfirmModeOption {
  readonly label: string;
  readonly value: ConfirmMode;
}

export const CONFIRM_MODE_OPTIONS: readonly ConfirmModeOption[] = [
  { label: 'Xác nhận email', value: 'email' },
  { label: 'Xác nhận số điện thoại', value: 'phone' },
] as const;

export type SystemKind = 'roles' | 'users' | 'functions' | 'actions';
export type CapabilityKind = 'functions' | 'actions';
export type UserSectionTab = 'profile' | 'roles';
export type UserLifecycleAction = 'status' | 'password-reset';
export type RoleSectionTab = 'info' | 'permissions';

export interface SystemRow {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly code?: string;
  readonly description?: string | null;
  readonly email?: string | null;
  readonly isActive?: boolean;
  readonly groupId?: string;
}

export interface RolePermissionGroupView extends FunctionGroupDto {
  readonly functions: readonly FunctionDto[];
  readonly actions: readonly CapabilityDto[];
  readonly total: number;
  readonly count: number;
}

export interface SystemListQuery {
  readonly q: string;
  readonly page: number;
}

export const SYSTEM_SECTIONS = {
  roles: { title: 'Vai trò và phân quyền', singular: 'vai trò', functionCode: 'Role' },
  users: { title: 'Người dùng', singular: 'người dùng', functionCode: 'User' },
  functions: { title: 'Chức năng', singular: 'chức năng', functionCode: 'Function' },
  actions: { title: 'Hành động', singular: 'hành động', functionCode: 'Action' },
} as const satisfies Record<SystemKind, { title: string; singular: string; functionCode: string }>;

export function readSystemListQuery(values: Readonly<Record<string, unknown>>): SystemListQuery {
  const rawPage = values['page'];
  const parsed = typeof rawPage === 'string' && /^\d+$/u.test(rawPage) ? Number(rawPage) : NaN;
  return {
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    page: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
  };
}

export function systemListQueryParams(query: SystemListQuery): Record<string, string | number> {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.page > 1 ? { page: query.page } : {}),
  };
}

export function permissionKey(functionId: string, actionId: string): string {
  return `${functionId}:${actionId}`;
}

export function permissionPairs(
  functions: readonly FunctionDto[],
  selected: ReadonlySet<string>,
): PermissionPair[] {
  return functions.flatMap((fn) =>
    fn.actionDtos
      .filter((action) => selected.has(permissionKey(fn.id, action.id)))
      .map((action) => ({ functionId: fn.id, actionId: action.id })),
  );
}

export function matchingFunctions(
  functions: readonly FunctionDto[],
  query: string,
): readonly FunctionDto[] {
  const keyword = query.trim().toLocaleLowerCase('vi');
  return functions.filter((fn) =>
    `${fn.name} ${fn.code}`.toLocaleLowerCase('vi').includes(keyword),
  );
}

export function groupActions(functions: readonly FunctionDto[]): readonly CapabilityDto[] {
  const actions = new Map<string, CapabilityDto>();
  for (const fn of functions.filter((item) => item.isActive)) {
    for (const action of fn.actionDtos.filter((item) => item.isActive)) {
      actions.set(action.id, action);
    }
  }
  return [...actions.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function actionKeys(functions: readonly FunctionDto[], actionId: string): readonly string[] {
  return functions
    .filter((fn) => fn.isActive && fn.actionDtos.some((a) => a.id === actionId && a.isActive))
    .map((fn) => permissionKey(fn.id, actionId));
}

export const AUTH_FORM_STYLES = `
  :host {
    display: block;
    height: 100%;
  }

  .auth-page {
    display: grid;
    min-height: 100%;
    place-items: center;
    overflow: auto;
    padding: 40px 20px;
    background: var(--surface-1);
  }

  .auth-card {
    display: grid;
    gap: 0;
    width: min(500px, 100%);
    padding: 40px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface-0);
  }

  .auth-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    justify-self: flex-start;
    margin-bottom: 24px;
    color: var(--text-1);
    font-size: 16px;
    font-weight: 650;
    text-decoration: none;
  }

  .auth-brand span {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 22px;
    font-weight: 700;
  }

  .auth-eyebrow {
    margin: 0 0 8px;
    color: var(--accent-ink);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .auth-title {
    margin: 0;
    color: var(--text-1);
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }

  .auth-intro {
    margin: 10px 0 24px;
    color: var(--text-2);
    font-size: 14px;
    line-height: 1.6;
  }

  .auth-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 14px;
  }

  .auth-field {
    display: grid;
    gap: 6px;
    margin-bottom: 16px;
  }

  .auth-field label {
    color: var(--text-1);
    font-size: 13px;
    font-weight: 500;
  }

  .auth-field input {
    width: 100%;
  }

  .auth-hint {
    color: var(--text-3);
    font-size: 12px;
    line-height: 1.45;
  }

  .auth-error {
    margin: 0 0 16px;
    color: var(--danger);
    font-size: 12px;
    line-height: 1.5;
  }

  .auth-success {
    margin: 0 0 20px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-1);
    color: var(--text-1);
    font-size: 14px;
    line-height: 1.6;
  }

  .auth-submit {
    width: 100%;
  }

  .auth-links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .auth-link {
    color: var(--accent-ink);
    font-size: 14px;
    text-decoration: none;
  }

  .auth-link:hover {
    text-decoration: underline;
  }

  .auth-link:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 3px;
  }

  .auth-mode-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
  }

  @media (max-width: 600px) {
    .auth-card {
      padding: 28px 22px;
    }

    .auth-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const requiredTrimmed = (maxLength: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(maxLength),
];

const confirmPasswordMatch: ValidatorFn = (control: AbstractControl) => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

export function createLoginForm() {
  return new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

export function createRegisterForm() {
  return new FormGroup(
    {
      firstName: new FormControl('', { nonNullable: true, validators: requiredTrimmed(75) }),
      lastName: new FormControl('', { nonNullable: true, validators: requiredTrimmed(75) }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      userName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      phoneNumber: new FormControl('', { nonNullable: true }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(9)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: confirmPasswordMatch },
  );
}

export function createConfirmEmailForm() {
  return new FormGroup({
    mode: new FormControl<ConfirmMode>('email', { nonNullable: true }),
    userId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

export function createForgotPasswordForm() {
  return new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
}

export function createResetPasswordForm() {
  return new FormGroup(
    {
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(9)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: confirmPasswordMatch },
  );
}
