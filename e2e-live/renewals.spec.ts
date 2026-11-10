import type {
  RenewalAdminDto,
  RenewalHistoryDto,
  StartRenewalRequest,
} from '../src/app/api/renewals/models/renewal.dto';
import { test, expect, signInAs, apiAs } from './fixtures';

test('live renewal: processor starts once, verifier records actual result and reveal follows independent permissions', async ({
  page,
  live,
  liveApi,
  baseURL,
}, testInfo) => {
  const scenario = live.scenarios[`renewalReady-${testInfo.project.name}`];
  expect(
    scenario?.renewalId,
    'a distinct paid renewal exists for this browser profile',
  ).toBeTruthy();
  expect(scenario?.targetAccountIdentifier).toBeTruthy();
  const id = scenario.renewalId!;
  const path = `/admin/renewals/${id}`;
  const processor = live.actors['renewalProcessor'];
  const verifier = live.actors['renewalVerifier'];
  expect(processor).toBeTruthy();
  expect(verifier).toBeTruthy();
  const processorApi = await apiAs(baseURL!, processor);
  try {
    const originalResponse = await liveApi.get(`/api/admin/renewals/${id}`);
    expect(originalResponse.status()).toBe(200);
    const original = (await originalResponse.json()) as RenewalAdminDto;
    expect(original.renewal.status).toBe(2);
    const historyResponse = await liveApi.get(`/api/admin/renewals/${id}/history`);
    expect(historyResponse.status()).toBe(200);
    const originalHistory = (await historyResponse.json()) as RenewalHistoryDto[];

    await signInAs(page, processor, path);
    await page.getByRole('button', { name: 'Xem thông tin đầy đủ', exact: true }).click();
    await expect(page.locator('.renewal-revealed-value')).toContainText(
      scenario.targetAccountIdentifier!,
    );
    await page.getByRole('button', { name: 'Nhận xử lý', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true })).toBeEnabled();
    await expect(page.locator('.renewal-history-table tbody tr')).toHaveCount(
      originalHistory.length + 1,
    );
    await expect(page.locator('.renewal-revealed-value')).toHaveCount(0);

    const startResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/admin/renewals/${id}/start`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true }).click();
    const accepted = await startResponse;
    expect(accepted.status()).toBe(200);
    const startRequest = accepted.request().postDataJSON() as StartRenewalRequest;
    await expect(page.locator('.renewal-detail-title-row')).toContainText('Chờ xác minh kết quả');
    await expect(page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nhận xử lý', exact: true })).toHaveCount(0);
    await expect(page.locator('.renewal-verify-form')).toHaveCount(0);
    await expect(page.locator('.renewal-history-table tbody tr')).toHaveCount(
      originalHistory.length + 2,
    );

    const replayResponse = await processorApi.post(`/api/admin/renewals/${id}/start`, {
      data: startRequest,
    });
    expect(replayResponse.status()).toBe(200);
    const pendingResponse = await liveApi.get(`/api/admin/renewals/${id}`);
    expect(pendingResponse.status()).toBe(200);
    const pending = (await pendingResponse.json()) as RenewalAdminDto;
    expect(pending.renewal.status).toBe(4);
    expect(pending.attempts).toHaveLength(original.attempts.length + 1);
    expect(pending.attempts.at(-1)?.operationId).toBe(startRequest.operationId);
    await page.screenshot({ path: testInfo.outputPath('renewal-pending.png') });

    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page.locator('#login-email')).toBeVisible();
    await signInAs(page, verifier, path);
    await expect(
      page.getByRole('button', { name: 'Xem thông tin đầy đủ', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nhận xử lý', exact: true })).toHaveCount(0);
    await expect(page.locator('.renewal-verify-form')).toBeVisible();
    const future = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
    const expiry = `${String(future.getDate()).padStart(2, '0')}/${String(future.getMonth() + 1).padStart(2, '0')}/${future.getFullYear()} 10:30`;
    const evidence = `Bằng chứng tổng hợp ${live.runId} ${testInfo.project.name}`;
    await page.locator('#renewal-expiry').fill(expiry);
    await page.locator('#renewal-expiry').press('Enter');
    await page.locator('#renewal-expiry').press('Tab');
    await page
      .getByLabel('Ghi chú xác minh', { exact: true })
      .fill('Đã kiểm tra kết quả gia hạn trên tài khoản mẫu');
    await page.getByLabel('Bằng chứng (tùy chọn)', { exact: true }).fill(evidence);
    const verifyResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/admin/renewals/${id}/verify`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Lưu kết quả xác minh', exact: true }).click();
    expect((await verifyResponse).status()).toBe(200);
    await expect(page.locator('.renewal-detail-title-row')).toContainText('Đã xác nhận gia hạn');
    await expect(page.locator('.renewal-verify-form')).toHaveCount(0);
    await expect(page.locator('.renewal-history-table tbody tr')).toHaveCount(
      originalHistory.length + 3,
    );
    await page.getByRole('button', { name: 'Xem bằng chứng', exact: true }).last().click();
    await expect(page.locator('.renewal-revealed-value')).toContainText(evidence);
    const savedResponse = await liveApi.get(`/api/admin/renewals/${id}`);
    expect(savedResponse.status()).toBe(200);
    const saved = (await savedResponse.json()) as RenewalAdminDto;
    expect(saved.renewal.status).toBe(5);
    expect(saved.renewal.verifiedExpiresAtUtc).toBeTruthy();
    expect(saved.attempts.at(-1)?.outcome).toBe(2);
    const storage = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    );
    expect(storage).not.toContain(scenario.targetAccountIdentifier!);
    expect(storage).not.toContain(evidence);
    await page.reload();
    await expect(page.locator('.renewal-detail-title-row')).toContainText('Đã xác nhận gia hạn');
    await expect(page.locator('.renewal-revealed-value')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('renewal-completed.png') });
  } finally {
    await processorApi.dispose();
  }
});
