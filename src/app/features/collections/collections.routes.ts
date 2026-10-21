import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';
import { CATALOG_PERMISSIONS } from '@constants/permission.constants';
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
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.product.view },
        pathMatch: 'full',
        loadComponent: () => import('./products/products.component').then((m) => m.Products),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.product.create },
        loadComponent: () =>
          import('./products/product-io/product-io.component').then((m) => m.ProductIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.product.view },
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
        data: { permission: CATALOG_PERMISSIONS.category.view },
        pathMatch: 'full',
        loadComponent: () => import('./categories/categories.component').then((m) => m.Categories),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.category.create },
        loadComponent: () =>
          import('./categories/category-io/category-io.component').then((m) => m.CategoryIo),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.category.view },
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
        data: { permission: CATALOG_PERMISSIONS.productType.view },
        pathMatch: 'full',
        loadComponent: () =>
          import('./product-types/product-types.component').then((m) => m.ProductTypes),
      },
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.productType.create },
        loadComponent: () =>
          import('./product-types/product-type-io/product-type-io.component').then(
            (m) => m.ProductTypeIo,
          ),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: CATALOG_PERMISSIONS.productType.view },
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
