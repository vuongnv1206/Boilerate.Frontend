import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/http/api-error';
import { StorefrontSettings, UpdateStorefrontSettings } from '@models/storefront-settings.dto';
import { StorefrontSettingsService } from '@services/storefront-settings.service';
import { StorefrontSettingsStore } from '@stores/storefront-settings.store';

describe('StorefrontSettingsStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('saves settings with the current version and preserves the draft after a conflict', () => {
    const initial: StorefrontSettings = {
      bankName: 'Ngân hàng thử nghiệm',
      accountNumber: '1234567890',
      accountHolder: 'CỬA HÀNG THỬ NGHIỆM',
      branch: null,
      instructions: null,
      bankTransferEnabled: false,
      version: 'v1',
    };
    let failUpdate = false;
    const service = {
      get: vi.fn(() => of(initial)),
      update: vi.fn((request: UpdateStorefrontSettings) => {
        if (failUpdate)
          return throwError(
            () =>
              new ApiError({
                status: 409,
                kind: 'conflict',
                message:
                  'Dữ liệu đã thay đổi hoặc thao tác xung đột. Vui lòng tải lại để kiểm tra.',
                fieldErrors: {},
              }),
          );
        return of({ ...request, version: 'v2' });
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        StorefrontSettingsStore,
        { provide: StorefrontSettingsService, useValue: service },
      ],
    });

    const store = TestBed.inject(StorefrontSettingsStore);
    store.load();
    store.set('bankTransferEnabled', true);
    store.set('instructions', 'Ghi mã đơn hàng trong nội dung chuyển khoản.');
    store.save();

    expect(service.update).toHaveBeenLastCalledWith({
      ...initial,
      bankTransferEnabled: true,
      instructions: 'Ghi mã đơn hàng trong nội dung chuyển khoản.',
    });
    expect(store.settings()?.version).toBe('v2');
    expect(store.notice()).toBe('Đã lưu thông tin thanh toán.');

    store.set('accountNumber', '9876543210');
    failUpdate = true;
    store.save();
    expect(store.draft()?.accountNumber).toBe('9876543210');
    expect(store.settings()?.accountNumber).toBe('1234567890');
    expect(store.error()).toContain('xung đột');
  });
});
