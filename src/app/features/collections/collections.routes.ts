import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@guards/unsaved-changes.guard';
import { CategoriesService } from '@services/categories.service';
import { ProductTypesService } from '@services/product-types.service';
import { ProductsService } from '@services/products.service';

/** Routes follow screen folders. Services are shared by route; each screen owns its store. */
export const COLLECTIONS_ROUTES: Routes = [
  {
    path: 'products',
    providers: [ProductsService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./products/products').then((m) => m.Products),
      },
      {
        path: 'new',
        loadComponent: () => import('./products/product-io/product-io').then((m) => m.ProductIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        loadComponent: () => import('./products/product-io/product-io').then((m) => m.ProductIo),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  {
    path: 'categories',
    providers: [CategoriesService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./categories/categories').then((m) => m.Categories),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./categories/category-io/category-io').then((m) => m.CategoryIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./categories/category-io/category-io').then((m) => m.CategoryIo),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  {
    path: 'product-types',
    providers: [ProductTypesService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./product-types/product-types').then((m) => m.ProductTypes),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./product-types/product-type-io/product-type-io').then((m) => m.ProductTypeIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./product-types/product-type-io/product-type-io').then((m) => m.ProductTypeIo),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'products' },
];
