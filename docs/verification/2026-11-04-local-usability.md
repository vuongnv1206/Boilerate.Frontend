# Hoàn thiện local — 04/11/2026

Đã triển khai và kiểm chứng local trong phạm vi Admin desktop/tablet và storefront gồm mobile. Chưa nghiệm thu deployment.

## Source và artifact

- FE HEAD: `083c78d43bf3e2ddcd737ed72ec17ef913ae922d` cộng working tree nâng cấp và docs/skills đã có.
- BE HEAD: `d5d684d9f6b06aed7eff9be49b17a20955434d40` cộng docs/template/skills và fixture test. Không thay API, schema hoặc migration.
- Artifact production build: 20:34 ngày 04/11, initial 663,54 kB. Budget warning vẫn 650 kB, vượt 13,54 kB; không tăng budget.
- SHA-256 main JS: `D540BA6BFD1F64A0538B09CC3B2C5ADB789BAF9077514E4CCE4CF1AAE78BE8BA`. Các lượt browser và live dưới đây dùng cùng artifact FE; không rebuild giữa các vòng.
- Raw diff/hash source ở `artifacts/local-usability/source-manifest.json` và `changes.patch` của từng repo. Manifest không thay cho commit; source còn uncommitted.

## Kết quả thực tế

| Kiểm tra                      | Kết quả                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| FE format/lint và kiến trúc   | Đạt, 43 architecture checks                                                                               |
| FE unit cuối                  | 303/303, 52 test files                                                                                    |
| Production build              | Đạt, còn warning bundle nêu trên                                                                          |
| BE Release non-provider       | 237/237, không skip; TRX trong artifacts/local-usability                                                  |
| Desktop/tablet full browser   | Lượt đầu 378/380; 2 snapshot chi tiết đơn ở tablet lệch do toolbar wrap                                   |
| So sánh visual sau review     | 26/26, không update snapshot; gồm 2 ca tablet đã xem ảnh và cập nhật baseline, cùng các trạng thái mobile |
| Storefront mobile             | 64/64 trên 390×844 và 360×800, Light/Dark                                                                 |
| Checkout mất response         | 8/8 trên desktop/tablet và hai chiều rộng mobile × Light/Dark; retry giữ OperationId và toàn bộ payload   |
| Live SQL Server full đầu      | 101/104; một timeout giao số, hai ca hết mã Unique trong fixture cũ                                       |
| Live storefront/discount cuối | 24/24 trên desktop/tablet/mobile × Light/Dark sau sửa fixture/locator                                     |

Không gộp các lượt live thành một kết quả full 104/104. Các ca thất bại thuộc nhóm storefront được chạy lại đủ nhóm trên fixture mới; không chạy lại toàn bộ nhóm Admin không bị thay đổi sau sửa dữ liệu fixture.

## Các sai lệch đã xử lý

- Xem ảnh tablet Light/Dark trước khi cập nhật đúng hai baseline `admin-order-detail.png`; không tăng dung sai screenshot. Vòng so sánh 26 ca sau đó không bật cập nhật baseline.
- Fixture ban đầu nạp 4 mã Unique cho 4 cấu hình cũ. Bổ sung hai cấu hình mobile cần ít nhất 6 mã: fixture test nay nạp 8 (6 lượt mua và 2 dự phòng); không đổi tồn hoặc quy tắc của database cửa hàng.
- Lượt live trung gian đạt 20/24, bốn ca gặp locator trùng giữa featured product và product card. Helper test đã giới hạn vào `.product-card`; vòng live cuối đạt 24/24.
- Ca mất response mới ban đầu thiếu mock GET đọc lại đơn. Đã sửa fixture và chạy lại đủ 8 cấu hình; không thay cơ chế checkout để làm test qua.

## Phạm vi và giới hạn

Browser dùng Chromium. Mobile là viewport/touch emulation, không phải nghiệm thu Safari hoặc thiết bị thật. Đã xem ảnh catalog, chi tiết hết hàng, checkout Light/Dark và tablet Admin. Kiểm cả reduced motion bằng browser; việc mở bàn phím phần mềm trên thiết bị thật chưa được đo riêng.

Live dùng SQL Server tạo riêng và mail sink. Run đầu `5f717eff-da54-4980-bf23-6bfdfc1cb299`; run cuối `7e0859d7-4295-4738-b6ab-0baccd144a04`. Runner kết thúc và dọn runtime/DB test thành công. Không migrate/cấp quyền trên database cửa hàng. PostgreSQL runtime, SMTP thật và staging chưa nghiệm thu. Không commit, push hoặc deploy.

## Chạy lại

- `run.ps1 check`
- `run.ps1 test:e2e` — desktop/tablet
- `run.ps1 test:e2e:shop-mobile` — storefront mobile, hai chiều rộng và hai theme
- `run.ps1 test:e2e:live -- --skip-build` — chỉ sau khi build đúng source, runner tạo DB test riêng

Raw logs cuối: `artifacts/local-usability-check.log`, `local-usability-unit-final.log`, `local-usability-browser.log`, `local-usability-visual-final.log`, `local-usability-mobile.log`, `local-usability-replay-final.log`, `local-usability-live-confirmed.log`. Xem [hồ sơ nâng cấp](../features/local-usability-upgrade.md).
