import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';
import { unsavedChangesGuard } from '@guards/unsaved-changes.guard';
import { CategoriesService } from '@services/categories.service';
import { ProductTypesService } from '@services/product-types.service';
import { ProductsService } from '@services/products.service';

/** Routes follow screen folders. Services are shared by route; each screen owns its store. */
export const COLLECTIONS_ROUTES: Routes = [
  {
    path: 'products',
    providers: [ProductsService],
    loadComponent: () =>
      import('./products/products-workspace.component').then((m) => m.ProductsWorkspace),
    children: [
      {
        path: '',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Product', actionCode: 'View' } },
        pathMatch: 'full',
        loadComponent: () => import('./products/products.component').then((m) => m.Products),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Product', actionCode: 'Create' } },
        loadComponent: () =>
          import('./products/product-io/product-io.component').then((m) => m.ProductIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Product', actionCode: 'View' } },
        loadComponent: () =>
          import('./products/product-io/product-io.component').then((m) => m.ProductIo),
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
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Category', actionCode: 'View' } },
        pathMatch: 'full',
        loadComponent: () => import('./categories/categories.component').then((m) => m.Categories),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Category', actionCode: 'Create' } },
        loadComponent: () =>
          import('./categories/category-io/category-io.component').then((m) => m.CategoryIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Category', actionCode: 'View' } },
        loadComponent: () =>
          import('./categories/category-io/category-io.component').then((m) => m.CategoryIo),
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
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'ProductType', actionCode: 'View' } },
        pathMatch: 'full',
        loadComponent: () =>
          import('./product-types/product-types.component').then((m) => m.ProductTypes),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'ProductType', actionCode: 'Create' } },
        loadComponent: () =>
          import('./product-types/product-type-io/product-type-io.component').then(
            (m) => m.ProductTypeIo,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'ProductType', actionCode: 'View' } },
        loadComponent: () =>
          import('./product-types/product-type-io/product-type-io.component').then(
            (m) => m.ProductTypeIo,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'products' },
];
