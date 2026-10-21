/** Exact capability names exposed by the backend manifest. */
export const CATALOG_PERMISSIONS = {
  product: {
    view: 'Permissions.Product.View',
    create: 'Permissions.Product.Create',
    update: 'Permissions.Product.Update',
    publish: 'Permissions.Product.Publish',
  },
  category: {
    view: 'Permissions.Category.View',
    create: 'Permissions.Category.Create',
    update: 'Permissions.Category.Update',
    delete: 'Permissions.Category.Delete',
  },
  productType: {
    view: 'Permissions.ProductType.View',
    create: 'Permissions.ProductType.Create',
    update: 'Permissions.ProductType.Update',
  },
} as const;
