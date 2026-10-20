# Kiểm tra giữ phiên — 21/10/2026

Môi trường Windows, Node 24.19.0, Angular 22.2.3, PrimeNG 22.1.2, Chromium theo Playwright 1.64.1. BE .NET 10.0.402 và SQL Server `BoilerateDevelopment`.

`npm run check` đạt: format, lint, 34 kiểm tra ranh giới/quy tắc màn, 148 unit tests / 22 files và production build (initial 550,69 kB). Unit bổ sung restore chờ quyền, gộp request, cookie bị thu hồi, lỗi tạm thời có thể thử lại, logout, 401→refresh→503 và tài khoản cookie thay đổi trước thông báo tab.

`npm run test:e2e`: **44/44 đạt**, không cập nhật ảnh, 2,5 phút. Desktop 1440×900/tablet 1024×768, light/dark. Browser suite giữ ảnh UI trước đó, bổ sung reload URL sâu, cookie HttpOnly, không lưu token trong JS storage, logout, phiên bị thu hồi và hai tab. Fixture chỉ ở e2e; API app luôn dùng BE.

QA localhost:4200 với BE5000 và SQL Server thật đã đạt: login một lần, reload editor giữ URL/tên sản phẩm; tab thứ hai tự khôi phục; hai tab reload đồng thời; logout đưa cả hai về login, xóa cookie, mở lại URL admin không khôi phục. Cookie HttpOnly/Strict/path đúng, không đọc được bằng document.cookie; không có page errors. Kết quả local không chứa token ở `artifacts/live-session/result.json` và ảnh cùng folder, bị ignore. Lượt QA đầu gặp dev server cũ giữ cache lỗi sau chuyển file; đã dừng dev server, chạy `ng cache clean`, khởi động lại và chạy thành công trên source hiện tại.

BE cookie contract và SQL Server tests xem [báo cáo BE](../../../Boilerate/docs/backend/verification/2026-10-21-browser-session.md). CI mới sẽ ghi sau push; không dùng CI cũ hoặc fixtures để chứng minh SQL Server.

Giới hạn: browser session dùng cùng origin `/api` với HTTPS ở Production; không nghiệm thu cross-site cookies/deployment. Web Locks và BroadcastChannel dùng trên trình duyệt desktop hiện đại; mobile vẫn hoãn. Lịch hết hạn/thu hồi do BE quyết định, không giữ đăng nhập sau khi cookie hết hạn hoặc phiên bị thu hồi.
