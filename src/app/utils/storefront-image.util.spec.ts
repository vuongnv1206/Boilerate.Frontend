import { describe, expect, it } from 'vitest';
import { getStorefrontProductFallbackImage } from './storefront-image.util';

describe('getStorefrontProductFallbackImage', () => {
  it('selects the existing storefront artwork from a product slug or Vietnamese name', () => {
    expect(getStorefrontProductFallbackImage('den-ban-studio', 'Đèn bàn Studio')).toBe(
      '/images/lamp.svg',
    );
    expect(getStorefrontProductFallbackImage('daily-runner', 'Giày chạy bộ')).toBe(
      '/images/shoe.svg',
    );
    expect(getStorefrontProductFallbackImage('unknown-item', 'Sản phẩm mới')).toBeNull();
  });
});
