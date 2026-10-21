# Verification — Admin Orders workspace — 2026-10-21

## Phạm vi

Kiểm chứng source và build cho module `/admin/orders` và `/admin/orders/:id`. Báo cáo này không thay cho authenticated browser, API deployment, database provider hoặc production acceptance.

## Kết quả

| Lệnh                                                          | Môi trường                  | Kết quả                                  |
| ------------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| `npm run format:check`                                        | Windows, repo FE            | Pass; toàn bộ file dùng Prettier.        |
| `npm run lint`                                                | Windows, repo FE            | Pass; ESLint và architecture checks.     |
| `npm run test:architecture`                                   | Windows, repo FE            | Pass; 43 import/screen/style checks.     |
| `node node_modules/@angular/cli/bin/ng.js build`              | Bundled Node 24.19.0        | Pass; Orders list/detail được lazy-load. |
| `node node_modules/@angular/cli/bin/ng.js test --watch=false` | Bundled Node 24.19.0/Vitest | Pass; 27 test files, 171 tests.          |

## Bằng chứng source

- Query list nằm trong URL, dùng server-side filter và giữ query khi vào/back từ detail.
- Detail không có Edit/inline edit; snapshot và timeline là read-only.
- Permission dùng capability BE; section Shipping/After-sales được gọi độc lập và lỗi section được cô lập.
- 409 giữ màn hình, báo stale version và reload DTO; không tự retry command.
- Action cancel/retry bị khóa theo payment status và `PhysicalDispatchStarted`; stale detail/mutation response không thể ghi đè order đang mở.
- Timeline và các section lazy-load giữ trạng thái lỗi riêng, có thao tác retry thay vì biến lỗi thành empty state.
- Không gọi endpoint và không render nội dung digital delivery trong detail lát đầu.

## Chưa kiểm chứng

- Chưa đăng nhập actor development trong browser để chạy E2E.
- Chưa chạy cùng backend/seed thực tế để kiểm list filters, command response, history và version conflict qua HTTP.
- Chưa có bằng chứng browser cho Light/Dark/System, responsive, focus/accessibility và back-forward thật.
- Node hệ thống của máy không đáp ứng yêu cầu Angular; kết quả build/test dùng bundled Node 24.19.0.
