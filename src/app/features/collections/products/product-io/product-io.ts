import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ContentState } from '@shared/ui/content-state/content-state';
import { FieldMessage } from '@shared/ui/field-message/field-message';
import { Icon } from '@shared/ui/icon/icon';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import {
  PRODUCT_FULFILLMENT_OPTIONS,
  PRODUCT_LIMITS,
  PRODUCT_STATUS_LABELS,
} from '@constants/product.constants';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductStatus } from '@enums/product.enum';
import { createProductForm } from '@forms/product.form';
import { ProductIoStore } from '@stores/product-io.store';

@Component({
  selector: 'app-product-io',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    Dialog,
    ContentState,
    Icon,
    CurrencyPipe,
    ReactiveFormsModule,
    InputText,
    MultiSelect,
    Select,
    Textarea,
    FieldMessage,
    StatusBadge,
  ],
  providers: [ProductIoStore],
  templateUrl: './product-io.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductIo {
  readonly store = inject(ProductIoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = createProductForm();
  readonly limits = PRODUCT_LIMITS;
  readonly fieldType = ProductFieldType;
  readonly fulfillmentOptions = PRODUCT_FULFILLMENT_OPTIONS;
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly categoryOptions = computed(() => this.store.categories().slice());
  readonly typeOptions = computed(() => this.store.productTypes().slice());

  readonly leaveOpen = signal(false);
  readonly status = ProductStatus;
  private pendingLeave?: Promise<boolean>;
  private resolveLeave?: (allowed: boolean) => void;

  constructor() {
    this.store.setForm(this.form);
    const destroyRef = inject(DestroyRef);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((id) => this.store.load(id));
    destroyRef.onDestroy(() => this.resolveLeave?.(false));
  }

  save(): void {
    this.store.save((id) => {
      void this.router.navigate(['/admin/collections/products', id], { replaceUrl: true });
    });
  }

  retry(): void {
    this.store.load(this.route.snapshot.paramMap.get('id'));
  }

  async reload(): Promise<void> {
    if (await this.confirmLeave()) this.retry();
  }

  confirmLeave(): boolean | Promise<boolean> {
    if (!this.store.hasUnsavedChanges()) return true;
    if (this.store.busy()) return false;
    if (this.pendingLeave) return this.pendingLeave;
    this.leaveOpen.set(true);
    this.pendingLeave = new Promise<boolean>((resolve) => {
      this.resolveLeave = resolve;
    });
    return this.pendingLeave;
  }

  leave(allowed: boolean): void {
    this.leaveOpen.set(false);
    this.resolveLeave?.(allowed);
    this.resolveLeave = undefined;
    this.pendingLeave = undefined;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) event.preventDefault();
  }

  error(control: AbstractControl | undefined): string {
    if (!control || !control.touched || !control.errors) return '';
    const server: unknown = control.errors['server'];
    if (Array.isArray(server) && typeof server[0] === 'string') return server[0];
    if (control.hasError('required')) return 'Vui lòng nhập giá trị cho trường này.';
    if (control.hasError('maxlength')) return 'Nội dung vượt quá độ dài cho phép.';
    if (control.hasError('vndPrice'))
      return 'Giá VND phải là số nguyên không âm trong phạm vi an toàn.';
    if (control.hasError('fieldNumber')) return 'Nhập số hợp lệ, tối đa 4 chữ số thập phân.';
    return 'Giá trị không đúng định dạng.';
  }
}
