import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { ContentState } from '@shared/ui/content-state/content-state';
import { Icon } from '@shared/ui/icon/icon';
import { CategoryDto } from '@models/category.dto';
import { CategoriesStore } from '@stores/categories.store';

@Component({
  selector: 'app-categories',
  host: { class: 'collection-screen' },
  imports: [RouterLink, Dialog, ContentState, Icon],
  providers: [CategoriesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories.html',
})
export class Categories {
  readonly store = inject(CategoriesStore);
  readonly deleteTarget = signal<CategoryDto | null>(null);

  constructor() {
    this.store.load();
  }
  delete(): void {
    const target = this.deleteTarget();
    if (target) this.store.delete(target, () => this.deleteTarget.set(null));
  }
}
