# Lịch sử tính năng

Chỉ ghi các khả năng đã triển khai theo mốc. Chi tiết sửa code tra trong Git; cách ghi tài liệu theo [quy tắc docs](../README.md#quy-tắc-duy-trì-docs).

## 21/10/2026 — Vận hành shipping và hậu mãi trong Admin Orders

Chi tiết đơn hiển thị shipment, ledger hoàn tiền và hàng nhận trả về. Nhân viên có quyền có thể giao từng phần, xác nhận shipment, ghi khoản hoàn đã chuyển và nhận lại hàng theo số đã xuất. Các thao tác dùng version/idempotency; COD cần xác nhận thu riêng. Xem [Admin Orders](../features/admin-orders.md).

## 21/10/2026 — Quản lý SKU, giá và tồn qua web

Chủ shop có thể tạo lựa chọn và SKU, quản lý giá/default, điều chỉnh tồn vật lý và quản lý tồn số Unique/Shared theo quyền. Xem [Collections](../features/live-admin-collections.md).

## 21/10/2026 — Catalog workspace theo trải nghiệm Webflow

Danh sách sản phẩm compact giữ filter/sort trong URL, editor giữ rail sản phẩm và lưu content/options/SKU/giá/default/gallery trong một transaction. Categories có số sản phẩm, ảnh có preview xác thực, bulk status và nhân bản Draft dùng ID mới. CSV được để sau catalog. Xem [Collections](../features/live-admin-collections.md) và [hồ sơ phối hợp BE–FE](../../../Boilerate/docs/shared/features/catalog-workspace.md).

## 21/10/2026 — Xử lý gia hạn thủ công

Nhân viên có thể claim, bắt đầu xử lý có ghi nhận, xác minh kết quả/hạn mới và xem nội dung tài khoản hoặc bằng chứng theo quyền, có audit. Xem [Admin Renewals](../features/admin-renewals.md).

## 21/10/2026 — Quản trị phân quyền theo nhóm

Có màn vai trò với danh mục nhóm/chức năng/action từ API, chọn nhanh theo kết quả lọc, quản lý danh mục và gán vai trò cho tài khoản hiện có. Menu/route/thao tác dùng chung checker Function–Action và trạng thái CentralAdmin từ BE. Xem [Quản trị hệ thống](../features/system-administration.md) và bằng chứng tích hợp được dẫn tại đó; runtime đợt này chỉ SQL Server.

## 21/10/2026 — Quyền Catalog và khôi phục trạng thái danh sách

Menu/route/thao tác theo quyền BE, editor chỉ xem khi thiếu quyền sửa và trang từ chối truy cập khi không có nhóm được xem. Query danh sách giữ qua editor/Back; save, lỗi validation/403/409 và xác nhận rời màn giữ draft đúng vòng đời. Xem [Collections](../features/live-admin-collections.md).

## 21/10/2026 — Giữ đăng nhập khi tải lại trang

FE khôi phục phiên và URL quản trị qua refresh cookie HttpOnly, có thử lại khi lỗi tạm thời và đồng bộ đăng xuất giữa các tab. Access token và quyền giữ trong bộ nhớ. Cần BE hỗ trợ browser session; xem [hành vi và hợp đồng](../features/persistent-session.md).

## 20/10/2026 — Quản lý Collections qua API

Thay danh sách/editor demo bằng màn sản phẩm, danh mục và loại sản phẩm: tải dữ liệu, thêm/sửa, phản hồi lưu từ server, giữ nội dung khi lỗi và xác nhận trước khi bỏ thay đổi. Hỗ trợ tìm kiếm/phân trang sản phẩm, đổi trạng thái và xóa danh mục có version. Xem [phạm vi Collections](../features/live-admin-collections.md).

## 20/10/2026 — Nền giao diện quản trị

Có workspace gồm rail, panel điều hướng co giãn và editor với inspector; lựa chọn System/Light/Dark được nhớ giữa các lần mở. Gallery cho thử control, trạng thái và overlay bằng bàn phím. Xem [quy chuẩn giao diện](../../DESIGN.md); bộ Collections demo ở mốc này đã được thay bằng API ở mốc trên.
