import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentState } from '@shared/ui/content-state/content-state';
import { Icon } from '@shared/ui/icon/icon';
import { ProductTypesStore } from '@stores/product-types.store';

@Component({
  selector: 'app-product-types',
  host: { class: 'collection-screen' },
  imports: [RouterLink, ContentState, Icon],
  providers: [ProductTypesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-types.html',
})
export class ProductTypes {
  readonly store = inject(ProductTypesStore);

  constructor() {
    this.store.load();
  }
}
