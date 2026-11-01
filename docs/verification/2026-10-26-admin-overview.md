# Kiểm chứng Tổng quan vận hành Admin

Phạm vi triển khai ngày 26/10 và nghiệm thu local tiếp tục ngày 27/10/2026 (Asia/Saigon). FE base `1d46242`, BE base `4ff259b` cộng working tree của tính năng Tổng quan; chưa tạo commit mới. [Hành vi FE](../features/admin-overview.md), [hợp đồng BE](../../../Boilerate/docs/backend/features/admin-overview.md) và [quyết định chung](../../../Boilerate/docs/shared/features/admin-overview.md) là nguồn quy tắc hiện hành.

## Kết quả

| Kiểm tra                                  | Kết quả và phạm vi                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| FE check                                  | Định dạng, lint, 43 kiểm tra kiến trúc, 287 unit test và production build đạt ngày 26/10                                     |
| Build giao diện cuối                      | Đạt; initial 702.96 kB, còn cảnh báo budget 650 kB; không tăng budget                                                        |
| BE regression Release                     | 235/235 non-provider, không skip                                                                                             |
| SQL Server overview integration           | 4/4, không skip; DB `boilerate_test_*` cô lập                                                                                |
| Browser fixture desktop/tablet Light/Dark | Đang hoàn tất lượt hồi quy cuối                                                                                              |
| Live browser/API SQL Server               | Đang hoàn tất lượt hồi quy cuối trên build cố định                                                                           |
| Review ảnh                                | Đã xem đủ Work/Finance/Stock ở 1440×900 và 1024×768, Light/Dark; 12 baseline mới chỉ được chép sau review                    |
| Development rollout                       | Backup checksum hợp lệ; index migration đã áp dụng; chỉ Admin được thêm `FinancialSummary.View`; 55 dòng quyền cũ giữ nguyên |

BE tests bảo vệ biên ngày Việt Nam, COD, nhận tiền lùi ngày, hoàn tiền khác kỳ, thu ròng âm, ngày không phát sinh và VND vượt giới hạn số nguyên JavaScript. Work dùng cùng predicate với queue danh sách; gồm đơn đã hủy nhận tiền muộn và gia hạn PendingVerification sau đóng đơn. Stock bao gồm thiếu balance, lượng giữ, publication, SKU inactive/retired, Unique Reserved và Shared vô hiệu. GET không ghi phiên bản hoặc dữ liệu nghiệp vụ. Operator scope có kiểm tra invalid filter, idempotency và giữ grant khác.

FE tests kiểm query URL, giới hạn ngày/ngưỡng/trang, số tiền chính xác, hủy read cũ, lỗi từng phần và xóa cache khi thu hồi riêng một quyền trong nhóm. Browser kiểm queue qua detail/Back/chip, tài khoản chỉ xem tài chính, 403, reload, bảng dữ liệu biểu đồ và popup DatePicker/Select gắn vào body. Popup kế thừa theme, Escape và focus return đã kiểm tra. Ngày business date được định dạng tường minh để tránh lùi ngày theo timezone trình duyệt.

Build cuối dùng `main-W5JGQ7MR.js` SHA256 `1E19C8C5070332DD301B680D6B6AEFDB02A2F38EDA620C91AA1E1C2DCBAE7C44` và `styles-EW2ERCBL.css` SHA256 `0F37C08DAB2BF4BA6B1DFCC469ADC4284009523631C931DE7527D46CD2D7712F`. Không rebuild trong các lượt nghiệm thu cuối.

## Rollout local

Database hiện có là SQL Server instance `localhost`, database `BoilerateDevelopment`, theo cấu hình Development đang dùng. Không chuyển sang LocalDB, không seed/reset hoặc thay kết nối.

Backup copy-only/compressed/checksum: `D:\MyCode\BoilerateWorkspace\work\backups\BoilerateDevelopment-pre-AdminOverview-20261026-184938.bak`; `RESTORE VERIFYONLY WITH CHECKSUM` đạt. SHA256 `2ED4C86C0FC3C63AB2807905C9A160C7337EC4D9CE379A372D60382AE0CBE89A`.

Đã áp `20261025154133_AdminOverviewIndexes` và xác minh hai index `IX_PaymentReceipts_ReceivedAtUtc_Id`, `IX_Refunds_RefundedAtUtc_Id`. Không thêm bảng hoặc cột nghiệp vụ. Lệnh operator đã chạy:

```powershell
dotnet run --project src/Host --configuration Release --no-build --launch-profile http -- --register-capabilities --grant-admin-capabilities --function FinancialSummary
```

Permissions tăng từ 55 lên 56 dòng: duy nhất `Admin` + `FinancialSummary` + `View`. So sánh snapshot trước/sau xác nhận 55 dòng còn lại giống hệt. Không đăng ký/cấp StorefrontSettings hoặc cấp tài chính cho role khác. Backend startup không migrate hoặc tự cấp quyền.

URL vận hành: `http://localhost:4200/admin/overview`; API `http://localhost:5000`; readiness `/health/ready`. Đã kiểm tra local dashboard nhận được cả ba phần, khôi phục phiên đang có và ngày biểu đồ khớp input/URL. Kết quả probe sau restart được xác nhận trong bàn giao.

## Chạy lại và artifacts

```powershell
# Frontend
.\run.ps1 check
.\run.ps1 test:e2e

# Backend, dùng Release để không khóa DLL của host Development Debug
dotnet test Boilerate.sln --configuration Release --no-restore --filter 'Category!=ProviderIntegration'
# SQL Server test instance; fixture luôn tạo database boilerate_test_* riêng
$env:BOILERATE_TEST_MSSQL = 'Server=localhost;Database=master;Integrated Security=true;TrustServerCertificate=true'
.\scripts\verify-admin.ps1 -FrontendRoot 'D:\MyCode\BoilerateWorkspace\Frontend' -SkipBuild
```

SQL integration cần connection test hợp lệ; fixture tự tạo/xóa database `boilerate_test_*`, không dùng tên database nghiệp vụ làm target. Raw BE logs/TRX nằm trong `Boilerate/artifacts/overview-tests/`; browser captures/logs và live manifests nằm trong `Frontend/artifacts/`, bị ignore. Không đưa mật khẩu fixture, connection string hoặc tokens vào báo cáo.

Lượt live sơ bộ ngày 26/10 đạt 91/92 nhưng một ca đăng nhập gặp trang trống trong lúc frontend được rebuild; lượt tiếp sau bị ngắt bởi restart môi trường. Hai lượt này không được dùng làm kết quả cuối; lượt cuối chạy trên build cố định ở trên.

## Giới hạn

PostgreSQL có migration/model và ca test nhưng thiếu `BOILERATE_TEST_POSTGRES`; chưa chạy connection test hoặc runtime, chưa ghi nhận đạt. Mobile, SMTP thật và staging/deployment tiếp tục ngoài nghiệm thu local này. Không coi kết quả fixtures hoặc SQL Server local là nghiệm thu vận hành staging. Nhãn trục SVG thu nhỏ trên tablet; bảng số liệu theo ngày cung cấp nội dung đầy đủ cho bàn phím và công cụ hỗ trợ.
