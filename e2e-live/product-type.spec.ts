import { randomUUID } from 'node:crypto';
import { test, expect, signIn } from './fixtures';

interface ProductType {
  id: string;
  code: string;
  name: string;
  version: string;
  fields: { id: string; code: string; choices: { id: string; code: string }[] }[];
}

test('live product type: UI duplicate creates independent schema and leaves products with their original type', async ({
  page,
  live,
  liveApi,
}) => {
  const key = randomUUID().replaceAll('-', '');
  const sourceResponse = await liveApi.post('/api/product-types', {
    data: {
      code: `LIVE_${key}`,
      name: `Live schema ${key}`,
      fields: [
        {
          code: 'COLOR',
          dataType: 5,
          label: 'Màu',
          helpText: null,
          isRequired: false,
          isFilterable: true,
          choices: [
            { code: 'RED', label: 'Đỏ' },
            { code: 'BLUE', label: 'Xanh' },
          ],
        },
      ],
    },
  });
  expect(sourceResponse.status()).toBe(200);
  const source = (await sourceResponse.json()) as ProductType;
  const productResponse = await liveApi.post('/api/products', {
    data: {
      productTypeId: source.id,
      productTypeVersion: source.version,
      fulfillmentKind: 1,
      content: {
        name: `Live schema product ${key}`,
        slug: `live-schema-${key}`,
        description: null,
        categoryIds: [],
        fields: [],
        media: [],
      },
      options: [],
      variants: [{ sku: `LIVE_${key}`, price: 100000, compareAtPrice: null, options: {} }],
    },
  });
  expect(productResponse.status()).toBe(200);
  const product = (await productResponse.json()) as { id: string };
  await signIn(page, live, `/admin/collections/product-types/${source.id}?q=Live`);
  await expect(page.locator('.product-type-linked-list a')).toHaveCount(1);
  const copied = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/product-types') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sao chép loại sản phẩm', exact: true }).click();
  const copyResponse = await copied;
  expect(copyResponse.status()).toBe(200);
  const copy = (await copyResponse.json()) as ProductType;
  expect(copy.id).not.toBe(source.id);
  expect(copy.code).not.toBe(source.code);
  expect(copy.fields).toHaveLength(1);
  expect(copy.fields[0]!.id).not.toBe(source.fields[0]!.id);
  expect(copy.fields[0]!.code).not.toBe(source.fields[0]!.code);
  expect(copy.fields[0]!.choices).toHaveLength(2);
  for (const choice of copy.fields[0]!.choices) {
    expect(
      source.fields[0]!.choices.some(
        (original) => original.id === choice.id || original.code === choice.code,
      ),
    ).toBe(false);
  }
  await expect(page.getByText('Chưa có sản phẩm thuộc loại này.')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('Live');
  const unchanged = await liveApi.get(`/api/products/${product.id}`);
  expect(unchanged.status()).toBe(200);
  expect((await unchanged.json()).productTypeId).toBe(source.id);
  const linked = await liveApi.post('/api/products/search', {
    data: { pageNumber: 1, pageSize: 10, productTypeId: copy.id },
  });
  expect(linked.status()).toBe(200);
  expect((await linked.json()).total).toBe(0);
  await page.reload();
  await expect(page.locator('#product-type-name')).toHaveValue(copy.name);
});
