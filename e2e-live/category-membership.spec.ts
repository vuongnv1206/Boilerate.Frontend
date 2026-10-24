import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test, expect, signIn } from './fixtures';

interface Category {
  id: string;
  version: string;
  name: string;
  description: string | null;
}

interface Product {
  id: string;
  version: string;
  categoryIds: string[];
}

async function category(api: APIRequestContext, suffix: string): Promise<Category> {
  const response = await api.post('/api/categories', {
    data: {
      name: `Live category ${suffix}`,
      slug: `live-category-${suffix}`,
      description: null,
      parentId: null,
      sortOrder: 0,
      isActive: true,
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Category;
}

async function product(api: APIRequestContext, id: string): Promise<Product> {
  const response = await api.get(`/api/products/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Product;
}

async function membership(
  api: APIRequestContext,
  categoryId: string,
  current: Product,
  included: boolean,
) {
  const response = await api.put(`/api/categories/${categoryId}/products`, {
    data: { categoryId, changes: [{ productId: current.id, version: current.version, included }] },
  });
  expect(response.status()).toBe(200);
}

async function removeCategory(api: APIRequestContext, id: string, productId: string) {
  const current = await product(api, productId);
  if (current.categoryIds.includes(id)) await membership(api, id, current, false);
  const response = await api.get('/api/categories');
  expect(response.status()).toBe(200);
  const currentCategory = ((await response.json()) as Category[]).find((item) => item.id === id);
  if (currentCategory) {
    const removed = await api.delete(`/api/categories/${id}`, {
      params: { version: currentCategory.version },
    });
    expect(removed.status()).toBe(200);
  }
}

test('live category: metadata and product membership save, reload and removal persist through the real API', async ({
  page,
  live,
  liveApi,
}) => {
  const item = live.products.find((entry) => entry.slug === 'tui-everyday-tote')!;
  const original = await product(liveApi, item.id);
  const created = await category(liveApi, randomUUID());
  try {
    await signIn(page, live, `/admin/collections/categories/${created.id}`);
    await expect(page.locator('#category-name')).toHaveValue(created.name);
    const chips = page.getByLabel('Sản phẩm đã chọn', { exact: true });
    await expect(chips).toContainText('Chưa có sản phẩm được chọn');
    await page
      .getByRole('searchbox', { name: 'Tìm sản phẩm để thêm vào danh mục' })
      .fill(item.name);
    await page.getByRole('option', { name: `${item.name} ${item.slug}`, exact: true }).click();
    await page.locator('#category-name').fill(`${created.name} saved`);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/categories/${created.id}/products`) &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
    expect((await product(liveApi, item.id)).categoryIds.sort()).toEqual(
      [...original.categoryIds, created.id].sort(),
    );

    await page.reload();
    await expect(page.locator('#category-name')).toHaveValue(`${created.name} saved`);
    await expect(chips).toContainText(item.name);
    await page
      .getByRole('button', { name: `Bỏ sản phẩm ${item.name} khỏi danh mục`, exact: true })
      .click();
    const removed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/categories/${created.id}/products`) &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    expect((await removed).status()).toBe(200);
    await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
    await page.reload();
    await expect(chips).toContainText('Chưa có sản phẩm được chọn');
    expect((await product(liveApi, item.id)).categoryIds.sort()).toEqual(
      original.categoryIds.sort(),
    );
  } finally {
    await removeCategory(liveApi, created.id, item.id);
  }
});

test('live category: a concurrent product change preserves the draft until explicit reconciliation and retry', async ({
  page,
  live,
  liveApi,
}) => {
  const item = live.products.find((entry) => entry.slug === 'tui-everyday-tote')!;
  const original = await product(liveApi, item.id);
  const edited = await category(liveApi, randomUUID());
  const concurrent = await category(liveApi, randomUUID());
  try {
    await signIn(page, live, `/admin/collections/categories/${edited.id}`);
    await expect(page.getByLabel('Sản phẩm đã chọn', { exact: true })).toContainText(
      'Chưa có sản phẩm được chọn',
    );
    await page
      .getByRole('searchbox', { name: 'Tìm sản phẩm để thêm vào danh mục' })
      .fill(item.name);
    await page.getByRole('option', { name: `${item.name} ${item.slug}`, exact: true }).click();
    await page.locator('#category-description').fill('Metadata saved before membership conflict');
    await membership(liveApi, concurrent.id, await product(liveApi, item.id), true);

    const conflict = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/categories/${edited.id}/products`) &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    expect((await conflict).status()).toBe(409);
    await expect(page.getByLabel('Sản phẩm đã chọn', { exact: true })).toContainText(item.name);
    await expect(page.locator('#category-description')).toHaveValue(
      'Metadata saved before membership conflict',
    );
    await expect(page.locator('.editor-save-status')).not.toContainText('Đã lưu');
    const categories = await liveApi.get('/api/categories');
    expect(
      ((await categories.json()) as Category[]).find((entry) => entry.id === edited.id)
        ?.description,
    ).toBe('Metadata saved before membership conflict');
    expect((await product(liveApi, item.id)).categoryIds.sort()).toEqual(
      [...original.categoryIds, concurrent.id].sort(),
    );

    await page.getByRole('button', { name: 'Đối chiếu liên kết', exact: true }).click();
    await expect(page.locator('.category-product-error')).toContainText('Đã đối chiếu liên kết.');
    await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeEnabled();
    const retried = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/categories/${edited.id}/products`) &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    expect((await retried).status()).toBe(200);
    await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
    await page.reload();
    await expect(page.getByLabel('Sản phẩm đã chọn', { exact: true })).toContainText(item.name);
    expect((await product(liveApi, item.id)).categoryIds.sort()).toEqual(
      [...original.categoryIds, concurrent.id, edited.id].sort(),
    );
  } finally {
    await removeCategory(liveApi, edited.id, item.id);
    await removeCategory(liveApi, concurrent.id, item.id);
  }
});
