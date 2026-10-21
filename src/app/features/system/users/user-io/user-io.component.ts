import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { UserRolesStore } from '@stores/user-roles.store';
import { Icon } from '@shared/ui/icon/icon.component';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';

@Component({
  selector: 'app-user-io',
  host: { class: 'collection-screen system-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ContentState, ConfirmDialog],
  providers: [UserRolesStore, LeaveConfirmation],
  templateUrl: './user-io.component.html',
})
export class UserIo implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(UserRolesStore);
  readonly confirmation = inject(LeaveConfirmation);
  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.store.load(id));
  }
  save(): void {
    this.store.save().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.load(this.route.snapshot.paramMap.get('id') ?? '');
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
