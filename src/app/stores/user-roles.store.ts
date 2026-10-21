import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  defer,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { createUserForm } from '@forms/system.form';
import { SystemUserDto, UserRoleDto } from '@models/system.dto';
import { SystemAdministrationService } from '@services/system-administration.service';

/** User profile, lifecycle and role assignment state for the system administration editor. */
@Injectable()
export class UserRolesStore {
  private readonly service = inject(SystemAdministrationService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | undefined;
  private formState: ReturnType<typeof createUserForm> | null = null;
  private readonly imageState = signal<File | null>(null);
  private readonly formRevision = signal(0);
  private readonly recordState = signal<SystemUserDto | null>(null);
  private readonly rolesState = signal<readonly UserRoleDto[]>([]);
  private readonly selectedState = signal<ReadonlySet<string>>(new Set());
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  private readonly loadingState = signal(false);
  private readonly readyState = signal(false);
  private readonly savingState = signal(false);
  private readonly createdState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');

  readonly record = this.recordState.asReadonly();
  readonly roles = this.rolesState.asReadonly();
  readonly selected = this.selectedState.asReadonly();
  readonly image = this.imageState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly created = this.createdState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly isNew = computed(() => this.record() === null);
  readonly canWrite = computed(() => (this.isNew() ? this.canCreate() : this.canUpdate()));
  readonly canUpdate = computed(
    () => !!this.record() && this.session.isCentralAdmin() && this.session.can('User', 'Update'),
  );
  readonly canCreate = computed(
    () =>
      this.isNew() &&
      !this.created() &&
      this.session.isCentralAdmin() &&
      this.session.can('User', 'Create'),
  );
  readonly profileDirty = computed(() => {
    this.formRevision();
    return Boolean(this.formState?.dirty || this.image());
  });
  readonly rolesDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((id) => !this.baseline().has(id)),
  );
  readonly dirty = computed(() => this.profileDirty() || this.rolesDirty());

  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  setForm(form: ReturnType<typeof createUserForm>): void {
    this.formState = form;
    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formRevision.update((revision) => revision + 1);
    });
  }

  load(id: string): void {
    this.request?.unsubscribe();
    this.readyState.set(false);
    this.loadingState.set(false);
    this.errorState.set('');
    this.noticeState.set('');
    this.createdState.set(false);
    this.recordState.set(null);
    this.rolesState.set([]);
    this.selectedState.set(new Set());
    this.baseline.set(new Set());
    this.imageState.set(null);

    if (id === 'new') {
      this.hydrateForm();
      this.readyState.set(true);
      return;
    }

    this.loadingState.set(true);
    this.request = this.service
      .user(id)
      .pipe(
        switchMap((user) => this.service.userRoles(id).pipe(map((roles) => ({ user, roles })))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ user, roles }) => {
          this.recordState.set(user);
          this.rolesState.set(roles);
          const selected = new Set(roles.filter((role) => role.enabled).map((role) => role.roleId));
          this.selectedState.set(selected);
          this.baseline.set(selected);
          this.hydrateForm();
          this.readyState.set(true);
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.errorState.set(normalizeApiError(error).message);
          this.loadingState.set(false);
        },
      });
  }

  toggle(id: string, checked: boolean): void {
    if (!this.canUpdate() || this.saving()) return;
    const values = new Set(this.selected());
    if (checked) values.add(id);
    else values.delete(id);
    this.selectedState.set(values);
  }

  setImage(file: File | null): void {
    if (!this.canUpdate() || this.saving()) return;
    this.imageState.set(file);
    this.formRevision.update((revision) => revision + 1);
  }

  saveProfile(): Observable<SystemUserDto | null> {
    return defer(() => {
      const form = this.formState;
      if (!form || !this.ready() || !this.canWrite() || this.saving()) return EMPTY;
      form.markAllAsTouched();
      if (form.invalid) return EMPTY;
      const value = form.getRawValue();
      const current = this.record();
      const phoneNumber = value.phoneNumber.trim() || null;

      if (!current) {
        return this.write(
          this.service
            .createUser({
              firstName: value.firstName.trim(),
              lastName: value.lastName.trim(),
              email: value.email.trim(),
              userName: value.userName.trim(),
              password: value.password,
              confirmPassword: value.confirmPassword,
              phoneNumber,
            })
            .pipe(map((message) => ({ message }))),
        ).pipe(
          tap(({ message }) => {
            this.createdState.set(true);
            this.noticeState.set(message.replace(/\r?\n/gu, ' '));
          }),
          map(() => null),
        );
      }

      return this.write(
        this.service
          .updateUser(current.id, {
            version: current.version,
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            email: value.email.trim(),
            phoneNumber,
            image: this.image(),
            deleteCurrentImage: value.deleteCurrentImage,
          })
          .pipe(
            switchMap(() => this.service.user(current.id)),
            tap((saved) => {
              this.recordState.set(saved);
              this.imageState.set(null);
              this.hydrateForm();
            }),
          ),
      );
    });
  }

  save(): Observable<SystemUserDto> {
    return this.saveRoles();
  }

  saveRoles(): Observable<SystemUserDto> {
    return defer(() => {
      const user = this.record();
      if (!user || !this.ready() || !this.canUpdate() || this.saving()) return EMPTY;
      const snapshot = this.selected();
      return this.write(
        this.service.saveUserRoles(user.id, user.version, [...snapshot]).pipe(
          switchMap(() => this.service.user(user.id)),
          tap((saved) => {
            this.recordState.set(saved);
            this.baseline.set(snapshot);
          }),
        ),
      );
    });
  }

  toggleStatus(): Observable<SystemUserDto> {
    return defer(() => {
      const user = this.record();
      if (!user || !this.ready() || !this.canUpdate() || this.saving()) return EMPTY;
      return this.write(
        this.service.toggleUserStatus(user.id, user.version, !user.isActive).pipe(
          switchMap(() => this.service.user(user.id)),
          tap((saved) => {
            this.recordState.set(saved);
            this.hydrateForm();
          }),
        ),
      );
    });
  }

  requestPasswordReset(): Observable<string> {
    return defer(() => {
      const user = this.record();
      if (!user || !this.ready() || !this.canUpdate() || this.saving()) return EMPTY;
      return this.write(
        this.service
          .requestUserPasswordReset(user.id)
          .pipe(tap(() => this.noticeState.set('Đã yêu cầu gửi liên kết đặt lại mật khẩu.'))),
      );
    });
  }

  private hydrateForm(): void {
    const form = this.formState;
    if (!form) return;
    const user = this.record();
    form.reset(
      {
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        email: user?.email ?? '',
        userName: user?.userName ?? '',
        phoneNumber: user?.phoneNumber ?? '',
        password: '',
        confirmPassword: '',
        deleteCurrentImage: false,
      },
      { emitEvent: false },
    );
    form.enable({ emitEvent: false });
    if (user) {
      form.controls.userName.disable({ emitEvent: false });
      form.controls.email.disable({ emitEvent: false });
      form.controls.password.disable({ emitEvent: false });
      form.controls.confirmPassword.disable({ emitEvent: false });
    }
    if (!this.canWrite()) form.disable({ emitEvent: false });
    this.formRevision.update((revision) => revision + 1);
  }

  private write<T>(request: Observable<T>): Observable<T> {
    this.savingState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
    return request.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((saved) =>
        this.session.authorizationChanged().pipe(
          catchError(() => of(undefined)),
          map(() => saved),
        ),
      ),
      tap(() => this.noticeState.set('Đã lưu thay đổi.')),
      catchError((error: unknown) => {
        this.errorState.set(normalizeApiError(error).message);
        return EMPTY;
      }),
      finalize(() => this.savingState.set(false)),
    );
  }
}
