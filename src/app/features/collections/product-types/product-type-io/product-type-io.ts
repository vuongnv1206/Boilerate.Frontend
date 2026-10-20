import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ContentState } from '@shared/ui/content-state/content-state';
import { FieldMessage } from '@shared/ui/field-message/field-message';
import { Icon } from '@shared/ui/icon/icon';
import { PRODUCT_FIELD_TYPE_OPTIONS, PRODUCT_TYPE_LIMITS } from '@constants/product-type.constants';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { createProductTypeForm } from '@forms/product-type.form';
import { ProductTypeIoStore } from '@stores/product-type-io.store';

@Component({
  selector: 'app-product-type-io',
  host: { class: 'collection-screen' },
  imports: [RouterLink, Dialog, ContentState, Icon, ReactiveFormsModule, FieldMessage, InputText],
  providers: [ProductTypeIoStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-type-io.html',
})
export class ProductTypeIo {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProductTypeIoStore);
  readonly form = createProductTypeForm();
  readonly limits = PRODUCT_TYPE_LIMITS;
  readonly fieldTypes = PRODUCT_FIELD_TYPE_OPTIONS;
  readonly fieldType = ProductFieldType;

  readonly leaveOpen = signal(false);
  private leaveResolver?: (leave: boolean) => void;

  constructor() {
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.store.load(id));
    this.destroyRef.onDestroy(() => this.leaveResolver?.(false));
  }
  async save(): Promise<void> {
    const wasNew = !this.route.snapshot.paramMap.has('id');
    const saved = await this.store.save();
    if (saved && wasNew && !this.form.dirty)
      void this.router.navigate(['/admin/collections/product-types', saved.id], {
        replaceUrl: true,
      });
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.retry();
  }
  confirmLeave(): boolean | Promise<boolean> {
    if (this.store.saving()) return false;
    if (!this.form.dirty) return true;
    this.leaveOpen.set(true);
    return new Promise<boolean>((resolve) => {
      this.leaveResolver = resolve;
    });
  }
  resolveLeave(leave: boolean): void {
    this.leaveOpen.set(false);
    this.leaveResolver?.(leave);
    this.leaveResolver = undefined;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  invalid(field: 'code' | 'name'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }
  serverError(field: 'code' | 'name'): string {
    const errors: unknown = this.form.controls[field].errors?.['server'];
    return Array.isArray(errors) ? errors.join(' ') : '';
  }

  typeLabel(type: ProductFieldType): string {
    return this.fieldTypes.find((option) => option.value === type)?.label ?? 'Không xác định';
  }
}
