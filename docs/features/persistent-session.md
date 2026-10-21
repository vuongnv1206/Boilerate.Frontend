# Giữ phiên đăng nhập

FE đã triển khai khôi phục đăng nhập và URL quản trị khi tải lại trang. [Báo cáo của mốc source](../verification/2026-10-21-persistent-session.md) ghi riêng kiểm tra tự động và QA API thật; BE sibling đã đồng bộ `9e5b410`, có các endpoint browser session tương ứng.

## Hành vi

- Access token và quyền ở bộ nhớ. Guard chờ refresh cookie và tải lại quyền trước khi mở admin; không lưu token, mật khẩu hoặc quyền trong localStorage/sessionStorage.
- Quyền hiện tại tải qua `GET personal/authorization` gồm `permissions` và `isCentralAdmin`; `GET personal/permissions` được BE giữ cho client cũ. Ngữ cảnh được tải lại sau token refresh, thay đổi ACL và 403; 403 không phát lại thao tác ghi.
- Các request refresh trong một tab dùng chung một lần gọi. Web Lock điều phối login/refresh/logout giữa các tab khi trình duyệt hỗ trợ; BroadcastChannel thông báo thay đổi phiên. Response phải đúng userId trước khi cho phép gửi lại request của phiên cũ.
- Refresh 401 yêu cầu đăng nhập lại. Lỗi mạng/server có thể thử khôi phục lại; logout chưa gọi được server có nút thử lại.
- Logout yêu cầu BE thu hồi phiên, xóa cookie và thông báo các tab khác dọn phiên; phiên đã thu hồi không được khôi phục sau reload.

## Hợp đồng BE mà FE yêu cầu

Các đường dẫn dưới đây tương đối với API base, mặc định `/api`; source gọi tại [AuthSession](../../src/app/core/auth/auth-session.ts).

| Request                       | Dữ liệu / kết quả                                                            |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `POST tokens/session`         | Body `{ email, password }`; trả access token và metadata, đặt refresh cookie |
| `POST tokens/session/refresh` | Body `null`; nhận cookie, xoay refresh token và trả access token mới         |
| `DELETE tokens/session`       | Thu hồi phiên từ cookie và xóa cookie, kể cả khi access token hết hạn        |

FE gửi `withCredentials: true` và `X-Requested-With: XMLHttpRequest`. Response token gồm `userId`, `token`, `sessionId`, `accessTokenExpiresAt`. Refresh token do BE tương thích quản lý trong cookie HttpOnly, host-only, SameSite Strict, có hạn dùng và Secure ngoài Development HTTP. Production dùng HTTPS và proxy FE/API cùng origin.

API JSON `tokens/get` và `tokens/refresh` của [TokensController trong sibling BE](../../../Boilerate/src/Host/Controllers/Identity/TokensController.cs) không thay thế hợp đồng trên. Các browser endpoints ở cùng controller đã có trên BE vừa pull; refresh token chỉ do cookie HttpOnly quản lý.

## Giới hạn

Web Locks/BroadcastChannel phục vụ đồng bộ trên trình duyệt hỗ trợ. Thời hạn cookie và thu hồi do BE quyết định. Mobile, cross-site cookie và deployment chưa được nghiệm thu.
