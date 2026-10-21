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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { createRoleForm } from '@forms/system.form';
import { RoleIoStore } from '@stores/role-io.store';
import { Icon } from '@shared/ui/icon/icon.component';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';

@Component({
  selector: 'app-role-io',
  host: { class: 'collection-screen system-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    InputText,
    Textarea,
    Icon,
    ContentState,
    ConfirmDialog,
  ],
  providers: [RoleIoStore, LeaveConfirmation],
  templateUrl: './role-io.component.html',
})
export class RoleIo implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(RoleIoStore);
  readonly form = createRoleForm();
  readonly confirmation = inject(LeaveConfirmation);
  readonly section = signal<'info' | 'permissions'>('info');
  ngOnInit(): void {
    if (this.route.snapshot.fragment === 'permissions') this.section.set('permissions');
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.store.load(id));
  }
  saveInfo(): void {
    const isNew = !this.store.record();
    this.store
      .saveInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        if (isNew && !this.form.dirty)
          void this.router.navigate(['/admin/system/roles', role.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
            fragment: 'permissions',
          });
      });
  }
  savePermissions(): void {
    this.store.savePermissions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.load(this.route.snapshot.paramMap.get('id') ?? 'new');
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.form.dirty || this.store.permissionsDirty(),
      this.store.saving(),
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.store.permissionsDirty() || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
