# Quản trị hệ thống và phân quyền

Ngày bắt đầu: 2026-10-21. Trạng thái: Đã triển khai; chờ nghiệm thu triển khai.

Hợp đồng sở hữu tại [BE](../../../Boilerate/docs/backend/features/grouped-authorization.md), [phối hợp](../../../Boilerate/docs/shared/features/grouped-authorization.md).

## Hành vi

AuthSession.can(functionCode, actionCode) kiểm quyền không phân biệt hoa/thường; nguồn quyền/central admin từ personal/authorization. Không fallback quyền, không lưu token/quyền vào JS storage. Menu, route, nút và store dùng cùng checker. BE luôn thực thi authorization.

Quản trị hệ thống có Vai trò, Người dùng, Chức năng, Hành động; nhóm quản lý trong dialog của Chức năng. Vai trò có Thông tin chung và Phân quyền truy cập; dữ liệu nhóm/chức năng/action từ API. Chọn nhanh chỉ áp dụng các chức năng đang hiển thị, hỗ trợ indeterminate; tìm kiếm không làm mất lựa chọn. Bộ đếm dùng cặp hợp lệ. Inactive đã gán hiện rõ, cho giữ/gỡ, không cấp mới. Không tự thêm View.

Thông tin và cấu hình quyền/action lưu riêng theo transaction BE; tạo trước khi gán. Lấy version trước lựa chọn và đọc lại sau ghi. Lỗi 400/403/409 giữ draft; không replay mutation. Dùng dirty guard và beforeunload. Người dùng chỉ xem tài khoản và gán vai trò, không tạo/sửa hồ sơ/trạng thái.

## Kiểm chứng

Chạy format/lint/architecture/unit/build, Playwright desktop/tablet light/dark; kiểm list/editor/dialog, keyboard, quyền route/menu/store, bulk/filter/count, draft/conflict và hồi quy Catalog/Orders. Kiểm riêng vòng tạo role → grant → assign → login/revoke trên API/database cô lập. Đã kiểm chứng trên SQL Server cô lập; chưa nghiệm thu deployment. Theo lựa chọn mới nhất của người dùng, PostgreSQL chỉ giữ migration/source, chưa kiểm chứng runtime. Xem [bằng chứng tích hợp](../verification/2026-10-21-grouped-authorization.md).
