const PRODUCT_IMAGE_RULES: readonly { readonly pattern: RegExp; readonly image: string }[] = [
  { pattern: /\b(lamp|den|lighting|arc)\b/, image: '/images/lamp.svg' },
  { pattern: /\b(bag|tote|tui)\b/, image: '/images/bag.svg' },
  { pattern: /\b(notebook|so-tay|book)\b/, image: '/images/notebook.svg' },
  { pattern: /\b(shoe|runner|giay|sneaker)\b/, image: '/images/shoe.svg' },
  { pattern: /\b(vase|gom|binh)\b/, image: '/images/vase.svg' },
  { pattern: /\b(chair|ghe|lounge)\b/, image: '/images/chair.svg' },
  { pattern: /\b(headphone|tai-nghe)\b/, image: '/images/headphones.svg' },
  { pattern: /\b(camera|may-anh)\b/, image: '/images/camera.svg' },
];

export function getStorefrontProductFallbackImage(slug: string, name: string): string | null {
  const searchable = normalizeProductText(`${slug} ${name}`);
  return PRODUCT_IMAGE_RULES.find(({ pattern }) => pattern.test(searchable))?.image ?? null;
}

function normalizeProductText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9-]+/g, ' ');
}
