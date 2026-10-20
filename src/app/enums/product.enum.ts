/** Numeric values are the Catalog API contract, not UI status strings. */
export enum ProductStatus {
  Draft = 1,
  Published = 2,
  Archived = 3,
}

export enum ProductFulfillmentKind {
  Physical = 1,
  DigitalUnique = 2,
  DigitalShared = 3,
  ManualExtension = 4,
}
