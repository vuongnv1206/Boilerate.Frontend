import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { createDiscountForm } from '@forms/discount.form';
import { validationMessage } from '@shared/forms/validation-message';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FormErrorSummary } from '@shared/ui/form-error-summary/form-error-summary.component';
import { FormField } from '@shared/ui/form-field/form-field.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { DiscountIoStore } from '@stores/discount-io.store';
import { DISCOUNT_KIND_OPTIONS } from '@constants/discount.constants';

@Component({
  selector: 'app-discount-io',
  host: { class: 'collection-screen' },
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    Checkbox,
    InputText,
    Select,
    ConfirmDialog,
    ContentState,
    FormErrorSummary,
    FormField,
    Icon,
  ],
  providers: [DiscountIoStore, LeaveConfirmation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discount-io.component.html',
})
export class DiscountIo implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(DiscountIoStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly form = createDiscountForm();
  readonly kinds = [...DISCOUNT_KIND_OPTIONS];

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
    const wasNew = !this.route.snapshot.paramMap.has('id');
    this.store
      .save()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((record) => {
        if (wasNew && !this.form.dirty)
          void this.router.navigate(['/admin/discounts', record.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
      });
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.retry();
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty, this.store.saving());
  }
  error(control: AbstractControl): string | null {
    if (!control.invalid || !(control.dirty || control.touched)) return null;
    const server: unknown = control.errors?.['server'];
    if (Array.isArray(server)) return server.join(' ');
    if (control.errors?.['integer']) return 'Nhập số nguyên hợp lệ.';
    return validationMessage(control) || 'Kiểm tra lại giá trị này.';
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
