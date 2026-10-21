# Kiểm chứng Collections API — 20/10/2026

Kết quả đã lưu cho FE `8ac71e00a8a62196d4b71addec6b148489982859`. Đây là bằng chứng của mốc tích hợp, không xác nhận khả năng chạy với checkout BE hiện tại; xem [yêu cầu API](../features/live-admin-collections.md).

Môi trường: Windows, Node 24.19.0, Angular 22.2.3, PrimeNG 22.1.2, Chromium theo Playwright 1.64.1. QA API thật dùng BE .NET 10.0.402 và SQL Server database `BoilerateDevelopment`; báo cáo gốc ghi mốc BE seed `59a838d`, trước mốc đồng bộ BE `9e5b410`; xem báo cáo nền tích hợp cho source mới.

| Phạm vi                  | Kết quả đã ghi nhận                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`          | Format, lint, 34 kiểm tra quy tắc, 141 unit tests / 22 files và production build đạt                                                               |
| Browser dùng API fixture | 24/24 đạt trên desktop 1440×900 và tablet 1024×768, light/dark; login, search/page/selection, create/edit/status, dirty guard, lỗi 409 và overlays |
| QA với SQL Server thật   | Login, sửa sản phẩm và reload giữ dữ liệu; sửa/khôi phục tên category/type; không có page errors                                                   |
| CI FE                    | [Run 39461384076](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39461384076) đạt check/build và 24 browser tests                  |

Browser fixture không chứng minh dữ liệu SQL Server. Raw QA local được ghi tại `artifacts/live-api/result.json` và ảnh cùng folder, bị ignore; report/trace CI gắn với run trên.

Tái chạy kiểm tra tự động theo [README](../../README.md#kiểm-tra). QA dữ liệu thật cần BE khớp DTO/endpoint và tài khoản riêng; không dùng credentials trong fixture.

Giới hạn: chưa nghiệm thu mobile, UI theo từng vai trò, deployment hoặc license. SKU/giá/tồn của sản phẩm đã có chỉ xem. Cơ chế phiên của mốc này đã được thay bởi [giữ phiên khi reload](../features/persistent-session.md).
