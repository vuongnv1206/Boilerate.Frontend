# Đồng bộ Admin — kiểm chứng local ngày 25/10/2026

## Nguồn và phạm vi

Frontend HEAD `45f31a6`, Backend HEAD `ca5d57c`, cả hai working tree còn thay đổi chưa commit. Các SHA này là nền, không đại diện toàn bộ source đã kiểm. Run manifest lưu fingerprint bundle thực tế trong ignored artifacts. Chưa tạo commit hoặc nghiệm thu deployment.

Admin dùng chung PrimeNG preset, semantic tokens và các mẫu màn trong [DESIGN.md](../../DESIGN.md). Categories, System và cài đặt thanh toán đã bỏ hệ control riêng; Orders/Renewals, Catalog editor và các vùng cuộn được đồng bộ. API, DTO và database contract không đổi trong đợt UI.

## Kết quả

| Kiểm tra              | Kết quả                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `run.ps1 check`       | Format, ESLint, 43 architecture checks, 270/270 unit tests và production build đạt                               |
| Production build cuối | Đạt; initial 692.01 kB, vượt warning budget 650 kB 42.01 kB; không vượt error budget                             |
| Review ảnh            | Đã xem desktop 1440×900 và tablet 1024×768, cả Light/Dark; 32 baseline mới và 16 baseline cập nhật sau review    |
| Mocked Playwright     | Full run 300/308 đạt; 8 lỗi thuộc 2 ca System đã sửa. Nhóm ảnh hưởng System và ảnh phân quyền chạy lại đạt 48/48 |
| Live SQL Server/API   | 80/80 đạt, không skipped/flaky; OTP dùng mail sink, không phải SMTP thật                                         |

Live run: `artifacts/live-acceptance/9172eb03-9285-4804-920d-42e7b094d0fe`, chạy qua `verify-admin.ps1 -SkipBuild` trên database `boilerate_test_*` do runner tạo/migrate/seed và dọn riêng. Lượt khởi tạo trước đã timeout và cleanup; chỉ run hoàn tất trên được tính là bằng chứng đạt.

Full fixture run nằm tại `artifacts/admin-ui-e2e-final.log`: hai ca lỗi là selector heading chưa tính số đếm và native input chưa nhận trạng thái chọn một phần sau khi chuyển sang PrimeNG. Đã sửa selector và chuyển native `indeterminate`/`aria-checked` qua public PT, giữ assertion trạng thái và payload quyền. Retest `system-administration.spec.ts` cùng ảnh role permissions đạt 48/48, log `artifacts/admin-ui-system-retest.log`; các ca còn lại dùng kết quả full run. Không coi đây là một lượt full 308/308 trên bundle cuối.

Live kiểm Catalog, membership/concurrency, ProductType, kho vật lý/số, Orders/shipping/COD/refund/return, Renewals, hệ thống quyền/phiên và guest storefront/settings. Bundle của run live là 691.91 kB; sau đó chỉnh wrap nút thêm thuộc tính, caption ContentState lên 12px và khôi phục native/ARIA mixed state của checkbox. Bản cuối được check/build và fixture/retest riêng; không coi run live là chứng nhận chính xác các chỉnh sửa FE sau đó. Backend/API và payload nghiệp vụ không đổi giữa các lượt này.

Ảnh hồi quy gồm product list/editor, Categories, ProductType editor, Order/Renewal detail, role permissions, payment settings và các trạng thái lỗi/chỉ xem, Gallery dialog/drawer. Settings còn kiểm request lưu chậm, khóa control khi lưu, giữ draft sau lỗi và retry có chủ đích.

## Môi trường đang chạy và giới hạn

- FE: `http://localhost:4200/admin`; BE Development: `http://localhost:5000`. Phiên hiện có đã restore và đọc Catalog/System qua API thật.
- BE `/health/live` trả 200; `/health/ready` trả 503. Database local hiện có thiếu schema storefront (`IsGuestOrder`, `NormalizedEmail`, `GuestEmailChallenges`). Không migrate, seed, reset hoặc đổi grants trên database này.
- Đối chiếu chỉ đọc bằng EF migrations list xác nhận `20261024082919_GuestStorefront` là migration duy nhất còn Pending. Foundation `--preflight` đạt nhưng chỉ xác nhận dữ liệu nền, không thay thế health readiness cho schema commerce.
- DB local và database test cô lập là hai môi trường khác nhau. Live test đạt không giải quyết tình trạng readiness của DB local.
- PostgreSQL runtime, SMTP thật, staging/production, tối ưu mobile và OS reduced-motion QA chưa được chứng nhận trong đợt này.

Raw logs/ảnh nằm trong `artifacts/admin-ui-*`, `artifacts/playwright-*` và live run ở trên, không đưa vào Git. Chạy lại fixture bằng `run.ps1 check` rồi `run.ps1 test:e2e`; live dùng runner trong `Boilerate/scripts/verify-admin.ps1` với database test cô lập.
