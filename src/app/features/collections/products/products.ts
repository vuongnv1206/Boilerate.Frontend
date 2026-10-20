import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ContentState } from '@shared/ui/content-state/content-state';
import { Icon } from '@shared/ui/icon/icon';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import {
  PRODUCT_PAGE_SIZES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_OPTIONS,
} from '@constants/product.constants';
import { ProductStatus } from '@enums/product.enum';
import { ProductsStore } from '@stores/products.store';

@Component({
  selector: 'app-products',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ContentState,
    Icon,
    CurrencyPipe,
    FormsModule,
    InputText,
    Select,
    StatusBadge,
  ],
  providers: [ProductsStore],
  templateUrl: './products.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products {
  readonly store = inject(ProductsStore);
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly statusOptions = PRODUCT_STATUS_OPTIONS;
  readonly status = ProductStatus;
  readonly pageSizes = PRODUCT_PAGE_SIZES;

  constructor() {
    this.store.load();
  }

  changePageSize(event: Event): void {
    if (event.target instanceof HTMLSelectElement)
      this.store.setPageSize(Number(event.target.value));
  }
}
