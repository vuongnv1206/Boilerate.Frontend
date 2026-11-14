import { Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { CategoryDto } from '@api/catalog/models/category.dto';
import { CategoriesWorkspace } from '../categories-workspace.component';

/** The table view of the workspace. The list, its search and its paging live in the workspace. */
@Component({
  selector: 'app-categories',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './categories.component.html',
})
export class Categories {
  // Business variables
  readonly deleteTarget = signal<CategoryDto | null>(null);

  constructor(
    private readonly destroyRef: DestroyRef,
    readonly store: CategoriesWorkspace,
  ) {}

  delete(): void {
    const target = this.deleteTarget();
    if (target) {
      this.store
        .delete(target)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((deleted) => {
          if (deleted) this.deleteTarget.set(null);
        });
    }
  }
}
