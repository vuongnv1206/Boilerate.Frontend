import type { Page } from '@playwright/test';

export async function fillDefaultVariant(
  page: Page,
  values: { sku?: string; price?: number | string },
): Promise<void> {
  const editor = page.locator('.wf-single-variant');
  if (values.sku !== undefined) await editor.locator('input[id^="variant-sku-"]').fill(values.sku);
  if (values.price !== undefined)
    await editor.locator('input[id^="variant-price-"]').fill(String(values.price));
}

export async function addOption(
  page: Page,
  name: string,
  values: readonly string[],
): Promise<void> {
  await page.getByRole('button', { name: 'Thêm nhóm lựa chọn', exact: true }).click();
  await page.locator('#option-name').fill(name);
  await setOptionValues(page, values);
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
}

export async function addOptionValues(
  page: Page,
  optionName: string,
  values: readonly string[],
): Promise<void> {
  await page.locator('.wf-option-summary').filter({ hasText: optionName }).click();
  await setOptionValues(page, values);
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
}

async function setOptionValues(page: Page, values: readonly string[]): Promise<void> {
  const input = page.locator('#option-values');
  for (const value of values) {
    await input.fill(value);
    await input.press('Enter');
  }
}

export async function editVariant(
  page: Page,
  matchingText: string,
  values: { sku?: string; price?: number | string; compareAtPrice?: number | string },
  occurrence = 0,
): Promise<void> {
  await page.locator('.wf-variant-row').filter({ hasText: matchingText }).nth(occurrence).click();
  const detail = page.locator('.wf-detail-row');
  if (values.sku !== undefined) await detail.locator('input[id^="variant-sku-"]').fill(values.sku);
  if (values.price !== undefined)
    await detail.locator('input[id^="variant-price-"]').fill(String(values.price));
  if (values.compareAtPrice !== undefined)
    await detail.locator('input[id^="variant-compare-"]').fill(String(values.compareAtPrice));
  await detail.getByRole('button', { name: 'Đóng', exact: true }).click();
}
