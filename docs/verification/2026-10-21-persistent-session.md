# Kiểm tra giữ phiên — 21/10/2026

Môi trường Windows, Node 24.19.0, Angular 22.2.3, PrimeNG 22.1.2, Chromium theo Playwright 1.64.1. BE .NET 10.0.402 và SQL Server `BoilerateDevelopment`.

`npm run check` đạt: format, lint, 34 kiểm tra ranh giới/quy tắc màn, 148 unit tests / 22 files và production build (initial 550,69 kB). Unit bổ sung restore chờ quyền, gộp request, cookie bị thu hồi, lỗi tạm thời có thể thử lại, logout, 401→refresh→503 và tài khoản cookie thay đổi trước thông báo tab.

`npm run test:e2e`: **44/44 đạt**, không cập nhật ảnh, 2,5 phút. Desktop 1440×900/tablet 1024×768, light/dark. Browser suite giữ ảnh UI trước đó, bổ sung reload URL sâu, cookie HttpOnly, không lưu token trong JS storage, logout, phiên bị thu hồi và hai tab. Fixture chỉ ở e2e; API app luôn dùng BE.

QA localhost:4200 với BE5000 và SQL Server thật đã đạt: login một lần, reload editor giữ URL/tên sản phẩm; tab thứ hai tự khôi phục; hai tab reload đồng thời; logout đưa cả hai về login, xóa cookie, mở lại URL admin không khôi phục. Cookie HttpOnly/Strict/path đúng, không đọc được bằng document.cookie; không có page errors. Kết quả local không chứa token ở `artifacts/live-session/result.json` và ảnh cùng folder, bị ignore. Lượt QA đầu gặp dev server cũ giữ cache lỗi sau chuyển file; đã dừng dev server, chạy `ng cache clean`, khởi động lại và chạy thành công trên source hiện tại.

BE cookie contract và SQL Server tests xem [báo cáo BE](../../../Boilerate/docs/backend/verification/2026-10-21-browser-session.md). Không dùng fixtures để chứng minh SQL Server.

## Source và CI

Đã push FE `5b4cc31cd6dc915a62210744b8de491d952bc029` và BE `274d2b2e8bf5be94eaab941f57b8185861669b2e` lên main của hai repo. [CI FE 39466256951](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39466256951) hoàn tất thành công: 148 unit tests / 22 files, format/lint/34 quy tắc, production build, **44 browser tests đạt trong 2,7 phút**, không flaky hoặc cập nhật ảnh.

[CI BE 39466158790](https://github.com/vuongnv1206/Boilerate/actions/runs/39466158790) có Windows boundaries thành công; Linux là gate riêng, trạng thái cuối ghi ở báo cáo BE/run trực tiếp. Không gộp kết quả Windows/local thành kết luận toàn workflow BE. Commit báo cáo sau source dùng `[skip ci]`, không thay code hoặc baseline đã kiểm tra.

Giới hạn: browser session dùng cùng origin `/api` với HTTPS ở Production; không nghiệm thu cross-site cookies/deployment. Web Locks và BroadcastChannel dùng trên trình duyệt desktop hiện đại; mobile vẫn hoãn. Lịch hết hạn/thu hồi do BE quyết định, không giữ đăng nhập sau khi cookie hết hạn hoặc phiên bị thu hồi.
