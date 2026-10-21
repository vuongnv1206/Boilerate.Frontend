# Kiểm chứng giữ phiên — 21/10/2026

Kết quả đã lưu cho FE `5b4cc31cd6dc915a62210744b8de491d952bc029` và BE `274d2b2e8bf5be94eaab941f57b8185861669b2e`. Đây là bằng chứng của mốc source cũ; BE sibling hiện đã pull `9e5b410`, có browser session. Kết quả source mới nằm ở báo cáo nền tích hợp. [Hợp đồng và hành vi hiện tại](../features/persistent-session.md).

Môi trường: Windows, Node 24.19.0, Angular 22.2.3, PrimeNG 22.1.2, Chromium theo Playwright 1.64.1; BE .NET 10.0.402 và SQL Server `BoilerateDevelopment`.

| Phạm vi                  | Kết quả đã ghi nhận                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`          | Format, lint, 34 kiểm tra quy tắc, 148 unit tests / 22 files và production build đạt                                                                                   |
| Browser dùng API fixture | 44/44 đạt trên desktop 1440×900 và tablet 1024×768, light/dark; reload URL sâu, cookie, logout, thu hồi phiên, lỗi tạm thời và hai tab; không cập nhật ảnh             |
| QA với SQL Server thật   | Reload editor giữ URL/dữ liệu, tab thứ hai khôi phục, hai tab reload đồng thời, logout cả hai tab và không khôi phục lại; cookie HttpOnly/Strict, không có page errors |
| CI FE                    | [Run 39466256951](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39466256951) đạt check/build và 44 browser tests                                      |

Raw QA local được ghi tại `artifacts/live-session/result.json` và ảnh cùng folder, bị ignore. Fixture chỉ chứng minh hành vi FE. Báo cáo gốc chỉ xác nhận Windows boundaries của CI BE; không có kết luận toàn workflow BE.

Tái chạy kiểm tra tự động theo [README](../../README.md#kiểm-tra). QA API thật cần BE có đủ endpoint/cookie contract, database và tài khoản riêng.

Giới hạn: chưa nghiệm thu mobile, cross-site cookie hoặc deployment. Production cần HTTPS và FE/API cùng origin; không khôi phục phiên khi cookie hết hạn hoặc BE đã thu hồi.
