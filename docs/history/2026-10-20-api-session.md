# 20/10/2026 — Phiên gọi API

Thêm `core/auth`: login request/token có kiểu, phiên chỉ giữ trong bộ nhớ, tải quyền từ BE, guard và interceptor. Token chỉ đi tới API base. Các lỗi 401 cùng phiên dùng một request refresh; request từ phiên cũ không được gửi lại bằng tài khoản mới. Hủy đăng nhập khi tải quyền dở sẽ dọn phiên.

`app.config.ts` đặt error interceptor ngoài auth interceptor để auth xử lý HTTP401 trước khi chuẩn hóa lỗi. Không tự retry lỗi mạng/409 hoặc ghi token vào storage.

7 kiểm thử tập trung đã đạt: login/quyền, refresh đồng thời, phạm vi token, response đến muộn sau logout, refresh lỗi/403, request thuộc tài khoản cũ và hủy login dở. Phần route/login UI và các màn Catalog được nối trong commit tiếp theo cùng cấu trúc đơn giản người dùng yêu cầu. Mốc này chưa nghiệm thu phiên production hoặc deployment.
