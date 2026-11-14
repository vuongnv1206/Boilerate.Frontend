import { Component } from '@angular/core';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { ProductTypesWorkspace } from '../product-types-workspace.component';

/** The table view of the workspace. The list, its search and its paging live in the workspace. */
@Component({
  selector: 'app-product-types',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './product-types.component.html',
})
export class ProductTypes {
  constructor(readonly store: ProductTypesWorkspace) {}
}
