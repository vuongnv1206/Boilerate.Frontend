import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';
import { unsavedChangesGuard } from '@shared/guards/unsaved-changes.guard';

export const CATALOG_ROUTES: Routes = [
  {
    path: 'products',
    loadComponent: () =>
      import('./products/products-workspace.component').then((m) => m.ProductsWorkspace),
    children: [
      {
        path: '',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Product', actionCode: 'View' } },
        pathMatch: 'full',
        loadComponent: () =>
          import('./products/products-list/products.component').then((m) => m.Products),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Product', actionCode: 'Create' } },
        loadComponent: () =>
          import('./products/product-detail/product-io.component').then((m) => m.ProductIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Product', actionCode: 'View' } },
        loadComponent: () =>
          import('./products/product-detail/product-io.component').then((m) => m.ProductIo),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/categories-workspace.component').then((m) => m.CategoriesWorkspace),
    children: [
      {
        path: '',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Category', actionCode: 'View' } },
        pathMatch: 'full',
        loadComponent: () =>
          import('./categories/categories-list/categories.component').then((m) => m.Categories),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Category', actionCode: 'Create' } },
        loadComponent: () =>
          import('./categories/category-detail/category-io.component').then((m) => m.CategoryIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Category', actionCode: 'View' } },
        loadComponent: () =>
          import('./categories/category-detail/category-io.component').then((m) => m.CategoryIo),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  {
    path: 'product-types',
    loadComponent: () =>
      import('./product-types/product-types-workspace.component').then(
        (m) => m.ProductTypesWorkspace,
      ),
    children: [
      {
        path: '',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'ProductType', actionCode: 'View' } },
        pathMatch: 'full',
        loadComponent: () =>
          import('./product-types/product-types-list/product-types.component').then(
            (m) => m.ProductTypes,
          ),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'ProductType', actionCode: 'Create' } },
        loadComponent: () =>
          import('./product-types/product-type-detail/product-type-io.component').then(
            (m) => m.ProductTypeIo,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'ProductType', actionCode: 'View' } },
        loadComponent: () =>
          import('./product-types/product-type-detail/product-type-io.component').then(
            (m) => m.ProductTypeIo,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'products' },
];
