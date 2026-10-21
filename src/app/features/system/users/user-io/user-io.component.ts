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
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { distinctUntilChanged, map } from 'rxjs';
import { createUserForm } from '@forms/system.form';
import { UserRolesStore } from '@stores/user-roles.store';
import { Icon } from '@shared/ui/icon/icon.component';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { validationMessage } from '@shared/forms/validation-message';

@Component({
  selector: 'app-user-io',
  host: { class: 'collection-screen system-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Dialog, InputText, Icon, ContentState, ConfirmDialog],
  providers: [UserRolesStore, LeaveConfirmation],
  templateUrl: './user-io.component.html',
})
export class UserIo implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private actionTrigger: HTMLElement | null = null;
  readonly store = inject(UserRolesStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly form = createUserForm();
  readonly section = signal<'profile' | 'roles'>('profile');
  readonly actionTarget = signal<'status' | 'password-reset' | null>(null);
  ngOnInit(): void {
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.store.load(id));
  }
  save(): void {
    this.store.saveProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  saveRoles(): void {
    this.store.saveRoles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  chooseImage(file: File | null): void {
    this.store.setImage(file);
  }
  fieldError(field: keyof ReturnType<typeof createUserForm>['controls']): string {
    return validationMessage(this.form.controls[field]);
  }
  openAction(action: 'status' | 'password-reset', event: Event): void {
    if (!this.store.canUpdate() || this.store.saving()) return;
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
    if (action === 'status') {
      this.store.toggleStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    } else if (action === 'password-reset') {
      this.store.requestPasswordReset().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.load(this.route.snapshot.paramMap.get('id') ?? 'new');
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.store.dirty(), this.store.saving());
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty() || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
