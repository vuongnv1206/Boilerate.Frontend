import { test, expect, signIn, apiAs } from './fixtures';

test('live digital: Unique/Shared delivery belongs to its customer and admin secrets require explicit reveal', async ({
  page,
  live,
  liveApi,
  baseURL,
}) => {
  const customerA = await apiAs(baseURL!, live.actors['customerA']!);
  const customerB = await apiAs(baseURL!, live.actors['customerB']!);
  try {
    for (const key of ['digitalUniquePaid', 'digitalSharedPaid']) {
      const scenario = live.scenarios[key]!;
      const owner = scenario.customerKey === 'customerA' ? customerA : customerB;
      const other = scenario.customerKey === 'customerA' ? customerB : customerA;
      const delivered = await owner.get(`/api/orders/${scenario.orderId}/digital-deliveries`);
      expect(delivered.status()).toBe(200);
      const contents = ((await delivered.json()) as { content: string }[]).map(
        (item) => item.content,
      );
      expect(contents.sort()).toEqual([...scenario.expectedDigitalContents!].sort());
      expect((await other.get(`/api/orders/${scenario.orderId}/digital-deliveries`)).status()).toBe(
        404,
      );
      expect((await other.get(`/api/orders/${scenario.orderId}`)).status()).toBe(404);
      const metadata = await liveApi.get(`/api/digital-inventory/variants/${scenario.variantId}`);
      expect(metadata.status()).toBe(200);
      const body = await metadata.text();
      for (const secret of contents) expect(body).not.toContain(secret);
    }
    const unique = live.scenarios['digitalUniquePaid']!;
    await signIn(page, live, `/admin/collections/products/${unique.productId}`);
    await page.getByRole('button', { name: 'Quản lý nội dung số', exact: true }).click();
    await expect(page.locator('.product-digital-row')).toHaveCount(2);
    await expect(page.locator('.product-secret')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ngừng cung cấp', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cho phép cung cấp', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Xem nội dung', exact: true }).first().click();
    await expect(page.locator('.product-secret')).toBeVisible();
    expect(unique.expectedDigitalContents).toContain(
      await page.locator('.product-secret').innerText(),
    );
    const storage = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    );
    for (const secret of unique.expectedDigitalContents!) expect(storage).not.toContain(secret);
    await page.reload();
    await expect(page.locator('.product-secret')).toHaveCount(0);
  } finally {
    await customerA.dispose();
    await customerB.dispose();
  }
});
