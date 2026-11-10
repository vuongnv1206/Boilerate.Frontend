import { Component, DestroyRef, HostListener, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { LeaveConfirmation } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  SystemUserDto,
  UserLifecycleAction,
  UserRoleDto,
  UserSectionTab,
} from '@api/identity/models/identity.dto';
import { UsersService } from '@api/identity/services/users.service';

const requiredName = (length: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(length),
];

const matchingPasswords: ValidatorFn = (control: AbstractControl) => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-user-io',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './user-io.component.html',
})
export class UserIo implements OnInit {
  // System variables
  private readonly cancelWrites = new Subject<void>();
  private request: Subscription | undefined;
  private generation = 0;
  private actionTrigger: HTMLElement | null = null;
  private readonly formRevision = signal(0);
  readonly loading = signal(false);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly created = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  // Business variables
  private readonly baseline = signal<ReadonlySet<string>>(new Set());
  readonly form: FormGroup<{
    firstName: FormControl<string>;
    lastName: FormControl<string>;
    email: FormControl<string>;
    userName: FormControl<string>;
    phoneNumber: FormControl<string>;
    password: FormControl<string>;
    confirmPassword: FormControl<string>;
    deleteCurrentImage: FormControl<boolean>;
  }>;
  readonly section = signal<UserSectionTab>('profile');
  readonly actionTarget = signal<UserLifecycleAction | null>(null);
  readonly record = signal<SystemUserDto | null>(null);
  readonly roles = signal<readonly UserRoleDto[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly image = signal<File | null>(null);

  readonly isNew = computed(() => this.record() === null);
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
  readonly canWrite = computed(() => (this.isNew() ? this.canCreate() : this.canUpdate()));
  readonly profileDirty = computed(() => {
    this.formRevision();
    return Boolean(this.form.dirty || this.image());
  });
  readonly rolesDirty = computed(
    () =>
      this.selected().size !== this.baseline().size ||
      [...this.selected()].some((id) => !this.baseline().has(id)),
  );
  readonly dirty = computed(() => this.profileDirty() || this.rolesDirty());

  constructor(
    private readonly route: ActivatedRoute,
    private readonly destroyRef: DestroyRef,
    private readonly usersService: UsersService,
    private readonly session: AuthSession,
    private readonly fb: FormBuilder,
    public readonly confirmation: LeaveConfirmation,
  ) {
    this.form = this.fb.nonNullable.group(
      {
        firstName: ['', requiredName(75)],
        lastName: ['', requiredName(75)],
        email: ['', [Validators.required, Validators.email]],
        userName: ['', [Validators.required, Validators.minLength(6)]],
        phoneNumber: [''],
        password: ['', [Validators.required, Validators.minLength(9)]],
        confirmPassword: ['', [Validators.required]],
        deleteCurrentImage: [false],
      },
      { validators: matchingPasswords },
    );
    this.destroyRef.onDestroy(() => {
      this.request?.unsubscribe();
      this.cancelWrites.next();
      this.cancelWrites.complete();
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formRevision.update((rev) => rev + 1);
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.load(id));
  }

  load(id: string): void {
    const generation = ++this.generation;
    this.cancelWrites.next();
    this.request?.unsubscribe();
    this.saving.set(false);
    this.ready.set(false);
    this.loading.set(false);
    this.error.set('');
    this.notice.set('');
    this.created.set(false);
    this.record.set(null);
    this.roles.set([]);
    this.selected.set(new Set());
    this.baseline.set(new Set());
    this.image.set(null);

    if (id === 'new') {
      this.hydrateForm();
      this.ready.set(true);
      return;
    }

    this.loading.set(true);
    this.request = this.usersService
      .getUser(id)
      .pipe(
        switchMap((user) =>
          this.usersService.getUserRoles(id).pipe(map((roles) => ({ user, roles }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ user, roles }) => {
          if (generation !== this.generation) return;
          this.record.set(user);
          this.roles.set(roles);
          const selected = new Set(roles.filter((r) => r.enabled).map((r) => r.roleId));
          this.selected.set(selected);
          this.baseline.set(selected);
          this.hydrateForm();
          this.ready.set(true);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          if (generation !== this.generation) return;
          this.error.set(normalizeApiError(err).message);
          this.loading.set(false);
        },
      });
  }

  toggle(id: string, checked: boolean): void {
    if (!this.canUpdate() || this.saving()) return;
    const values = new Set(this.selected());
    if (checked) values.add(id);
    else values.delete(id);
    this.selected.set(values);
  }

  chooseImage(file: File | null): void {
    if (!this.canUpdate() || this.saving()) return;
    this.image.set(file);
    this.formRevision.update((rev) => rev + 1);
  }

  save(): void {
    if (!this.ready() || !this.canWrite() || this.saving()) return;
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const current = this.record();
    const revision = this.formRevision();
    const image = this.image();
    const phoneNumber = value.phoneNumber.trim() || null;

    if (!current) {
      this.write(
        this.usersService
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
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(({ message }) => {
          this.created.set(true);
          this.hydrateForm();
          this.notice.set(message.replace(/\r?\n/gu, ' '));
        });
      return;
    }

    this.write(
      this.usersService
        .updateUser(current.id, {
          version: current.version,
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          email: value.email.trim(),
          phoneNumber,
          image,
          deleteCurrentImage: value.deleteCurrentImage,
        })
        .pipe(switchMap(() => this.usersService.getUser(current.id))),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.record.set(saved);
        if (this.image() === image) this.image.set(null);
        if (revision === this.formRevision()) this.hydrateForm();
        else {
          this.notice.set('Đã lưu bản trước. Thay đổi mới trong hồ sơ chưa được lưu.');
        }
      });
  }

  saveRoles(): void {
    const user = this.record();
    if (!user || !this.ready() || !this.canUpdate() || this.saving()) return;
    const snapshot = this.selected();
    this.write(
      this.usersService
        .saveUserRoles(user.id, user.version, [...snapshot])
        .pipe(switchMap(() => this.usersService.getUser(user.id))),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.record.set(saved);
        this.baseline.set(snapshot);
        this.notice.set('Đã lưu vai trò.');
      });
  }

  fieldError(field: keyof UserIo['form']['controls']): string {
    return validationMessage(this.form.controls[field]);
  }

  openAction(action: UserLifecycleAction, event: Event): void {
    if (!this.canUpdate() || this.saving()) return;
    this.actionTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.actionTarget.set(action);
  }

  restoreActionFocus(): void {
    this.actionTrigger?.focus();
    this.actionTrigger = null;
  }

  runAction(): void {
    const action = this.actionTarget();
    this.actionTarget.set(null);
    const user = this.record();
    if (!user || !this.ready() || !this.canUpdate() || this.saving()) return;
    if (action === 'status') {
      this.write(
        this.usersService
          .toggleUserStatus(user.id, user.version, !user.isActive)
          .pipe(switchMap(() => this.usersService.getUser(user.id))),
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((saved) => this.record.set(saved));
    } else if (action === 'password-reset' && user.emailConfirmed && user.email) {
      this.write(this.usersService.requestPasswordReset(user.id))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.notice.set('Đã yêu cầu gửi liên kết đặt lại mật khẩu.'));
    }
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.load(this.route.snapshot.paramMap.get('id') ?? 'new');
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.dirty(), this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private hydrateForm(): void {
    const user = this.record();
    this.form.reset(
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
    this.form.enable({ emitEvent: false });
    if (user) {
      this.form.controls.userName.disable({ emitEvent: false });
      this.form.controls.email.disable({ emitEvent: false });
      this.form.controls.password.disable({ emitEvent: false });
      this.form.controls.confirmPassword.disable({ emitEvent: false });
    }
    if (!this.canWrite()) this.form.disable({ emitEvent: false });
    this.formRevision.update((rev) => rev + 1);
  }

  private write<T>(request: Observable<T>): Observable<T> {
    const generation = this.generation;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    return request.pipe(
      filter(() => generation === this.generation),
      switchMap((saved) =>
        this.session.authorizationChanged().pipe(
          catchError(() => of(undefined)),
          map(() => saved),
        ),
      ),
      takeUntil(this.cancelWrites),
      takeUntilDestroyed(this.destroyRef),
      filter(() => generation === this.generation),
      tap(() => this.notice.set('Đã lưu thay đổi.')),
      catchError((err: unknown) => {
        if (generation !== this.generation) return EMPTY;
        const normalized = normalizeApiError(err);
        applyServerErrors(this.form, normalized.fieldErrors);
        this.formRevision.update((rev) => rev + 1);
        this.error.set(
          normalized.status === 409
            ? 'Dữ liệu đã thay đổi. Nội dung đang nhập được giữ lại; tải lại để đối chiếu trước khi lưu tiếp.'
            : normalized.message,
        );
        return EMPTY;
      }),
      finalize(() => {
        if (generation === this.generation) this.saving.set(false);
      }),
    );
  }
}
