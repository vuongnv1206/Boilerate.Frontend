# Đồng bộ Admin — kiểm chứng local ngày 25/10/2026

## Nguồn và phạm vi

Lần audit đầu bắt đầu từ Frontend `45f31a6` và Backend `ca5d57c`, khi cả hai working tree còn thay đổi chưa commit. Đây là SHA nền, không đại diện source cuối đã kiểm; trạng thái sau khi đóng mốc và xử lý DB local được ghi ở cuối báo cáo. Run manifest lưu fingerprint bundle trong ignored artifacts.

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

## Đóng mốc và kiểm chứng sau rollout local — 25/10/2026

FE được chốt ở `430863b` và BE ở `4ff259b`, thành hai commit riêng; cả hai worktree sạch, chưa push. Đây là cặp source của lượt kiểm tra dưới đây. FE report chỉ thêm phần ghi nhận sau khi source đã kiểm; không đổi code ứng dụng.

| Kiểm tra trên cặp commit                                                          | Kết quả                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Frontend/./run.ps1 check`                                                        | Format, ESLint, 43 architecture checks, 270/270 unit tests và production build đạt               |
| `dotnet test Boilerate.sln --no-restore --filter "Category!=ProviderIntegration"` | 233/233 đạt; build có các analyzer warning hiện hữu                                              |
| Fixture E2E đầy đủ                                                                | 307/308 đạt trong một lượt; một ca dispatch tablet-light submit disabled vì tracking field trống |
| Rerun ca dispatch đã lỗi                                                          | 4/4 đạt trên desktop/tablet × Light/Dark; không đổi code sau lượt full suite                     |
| Live SQL Server/API                                                               | 80/80 đạt; 0 skipped, unexpected hoặc flaky; mail sink kiểm thử, không phải SMTP thật            |
| FE và BE local                                                                    | `/admin`, `/health/live` và `/health/ready` đều trả 200                                          |

Live run cuối: `artifacts/live-acceptance/cf11bf74-d733-4878-b424-e47ab2e274cf`; test DB `boilerate_test_ac506c94b3924429b884554d6ed03660` được runner tạo, migrate và dọn. 80 test chạy trên bundle FE sau commit `430863b`; backend source là commit `4ff259b`. `results.json` ghi 80 expected, 0 skipped, 0 unexpected, 0 flaky; `run.json` lưu hash bundle. Sau cleanup không còn listener live hoặc database test với run id này.

Trên DB Development `BoilerateDevelopment`, đã tạo backup copy-only/checksum trước migration tại `work/backups/BoilerateDevelopment-pre-GuestStorefront-20261025-210016.bak`. `RESTORE VERIFYONLY WITH CHECKSUM` đạt; SHA-256 `A26C0E8F1769392B21049CC187DBBD99B73F5393AFC87D3EA200FB3C8B08E002`. Sau đó chỉ áp migration Pending `20261024082919_GuestStorefront`; lịch sử có đủ 11 migration. Số order là 0 trước/sau, các bảng settings/challenges được tạo, không seed hoặc sửa grants. Readiness hiện 200.

DB local chưa đăng ký function `StorefrontSettings`; truy vấn chỉ đọc không thấy function/action/grant cho capability này, và `/admin/storefront-settings` trả AccessDenied cho phiên hiện tại. Không chạy operator bootstrap/registration hoặc cấp quyền. `/admin/collections/products` tải dữ liệu API thật. Cấu hình Development trỏ tới SQL Server cục bộ `localhost` (default instance), không phải `(localdb)\MSSQLLocalDB`; instance LocalDB được thử khởi động rồi dừng, không được dùng cho DB ứng dụng.

Chưa có `appsettings.Staging`, biến môi trường staging/SMTP, hay connection cô lập PostgreSQL. Vì vậy HTTPS, SMTP thật, media/Data Protection persistence, pilot nhân viên và recovery DB+media+keys chưa được nghiệm thu. Runner Recovery hiện cần biến `BOILERATE_TEST_POSTGRES`; không dùng DB Development thay cho staging hoặc môi trường restore.
