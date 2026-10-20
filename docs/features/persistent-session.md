# Giữ phiên đăng nhập — 21/10/2026

Mục tiêu: reload ở màn quản trị vẫn giữ đăng nhập và URL hiện tại. Giữ cấu trúc component/store/service đã thống nhất; không thêm màn hoặc tầng trung gian.

Trạng thái: đã triển khai, kiểm tra local và API thật; [báo cáo](../verification/2026-10-21-persistent-session.md) ghi kết quả cùng trạng thái CI sau push.

1. BE bổ sung browser session trong TokensController, dùng cơ chế refresh rotation và thu hồi family hiện có. Refresh token ở cookie HttpOnly, host-only, SameSite Strict, có hạn dùng; Secure ngoài Development HTTP. Browser response chỉ trả access token và metadata. Các API token JSON hiện có tiếp tục phục vụ client cũ.
2. FE giữ access token trong bộ nhớ. Guard chờ khôi phục phiên qua cookie rồi tải quyền trước khi mở admin. Login, refresh và logout dùng cùng origin `/api`, header chống CSRF và Web Lock để hai tab không dùng lại một refresh token.
3. Logout thu hồi phiên từ cookie ngay cả khi access token hết hạn, xóa cookie và báo các tab khác dọn phiên. Refresh bị từ chối chuyển về login; lỗi mạng/server không xóa cookie phía BE. Không lưu token, mật khẩu hoặc quyền trong localStorage/sessionStorage.
4. Kiểm tra unit HTTP/session/guard; browser reload URL sâu, refresh, logout, phiên bị thu hồi và hai tab; kiểm tra endpoint/cookie trên SQL Server thật. Chạy check, browser suite, commit/push và ghi nhận CI thực tế.

Hoàn tất khi reload không hiện lại form đăng nhập lúc phiên còn hợp lệ, logout không bị khôi phục khi reload, kiểm tra đạt và source đã push. Mobile/deployment vẫn ngoài mốc này.

Tham khảo: [OWASP session](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP API CSRF headers](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi), [ASP.NET Core SameSite](https://learn.microsoft.com/en-us/aspnet/core/security/samesite?view=aspnetcore-10.0).
