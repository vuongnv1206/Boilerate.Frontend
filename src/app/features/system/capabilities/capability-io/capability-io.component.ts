import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { InputText } from 'primeng/inputtext';
import { createCapabilityForm } from '@forms/system.form';
import { CapabilityIoStore } from '@stores/capability-io.store';
import { Icon } from '@shared/ui/icon/icon.component';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';

@Component({
  selector: 'app-capability-io',
  host: { class: 'collection-screen system-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, InputText, Icon, ContentState, ConfirmDialog],
  providers: [CapabilityIoStore, LeaveConfirmation],
  templateUrl: './capability-io.component.html',
})
export class CapabilityIo implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CapabilityIoStore);
  readonly form = createCapabilityForm();
  readonly confirmation = inject(LeaveConfirmation);
  ngOnInit(): void {
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) =>
        this.store.load(this.route.snapshot.data['kind'] as 'functions' | 'actions', id),
      );
  }
  saveInfo(): void {
    const isNew = !this.store.record();
    this.store
      .saveInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (isNew && !this.form.dirty)
          void this.router.navigate(['/admin/system', this.store.kind(), saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
      });
  }
  saveActions(): void {
    this.store.saveActions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave())
      this.store.load(this.store.kind(), this.route.snapshot.paramMap.get('id') ?? 'new');
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.form.dirty || this.store.actionsDirty(),
      this.store.saving(),
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.store.actionsDirty() || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
