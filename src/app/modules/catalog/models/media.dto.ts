export interface MediaAssetDto {
  readonly id: string;
  readonly originalFileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export const MAX_PRODUCT_MEDIA = 30;
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_ACCEPT = '.png,.jpg,.jpeg,image/png,image/jpeg';
