# 21/10/2026 — Giữ đăng nhập khi reload

Theo [hồ sơ](../features/persistent-session.md): chuyển AuthSession sang browser endpoints với refresh cookie HttpOnly; access token và quyền vẫn ở bộ nhớ. Guard chờ khôi phục rồi mới mở admin và giữ URL sâu.

Giữ cách tổ chức hiện tại: logic phiên ở core/auth, login UI ở component, state login ở LoginStore. Không thêm wrapper, base store hoặc file SCSS/spec component. Web Lock điều phối cookie giữa các tab; BroadcastChannel báo login/logout. Response userId phải khớp phiên trong bộ nhớ trước khi nhận refresh, ngăn thao tác cũ được gửi lại bằng tài khoản mới.

Lỗi mạng/server có thể thử khôi phục lại; logout chưa gọi được server có nút thử lại. Lỗi refresh 401 đưa về login. [Kiểm chứng](../verification/2026-10-21-persistent-session.md) ghi unit, browser và QA BE thật; tài liệu mốc memory-only trước đây giữ làm lịch sử.
