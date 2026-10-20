# 20/10/2026 — Collections dùng API, source đơn giản

Thực hiện theo [hồ sơ](../features/live-admin-collections.md) và các điều chỉnh trực tiếp của người dùng.

- Thay content demo bằng 6 màn: Products/ProductIo, Categories/CategoryIo, ProductTypes/ProductTypeIo. Route tương ứng folder; không còn switch collection để chọn nghiệp vụ.
- Đưa constants/enums/models/services/stores/forms/guards lên `src/app`, ngang cấp features, có alias import. Gộp toolbar/table/form/inspector/fields nhỏ vào màn; form do màn tạo.
- Bỏ 13 SCSS riêng collections, dùng bố cục/form chung trong `styles/admin`. Generator không tự tạo SCSS/spec. Giữ test HTTP/store/form có logic; không thêm spec để kiểm component tạo được.
- Service gọi đúng Catalog endpoints. Product dùng version của product và type, giữ media/field cũ, không giả API delete hoặc sửa giá/tồn khi chưa có UI tương ứng. Category dùng version để xóa. Product type sửa schema theo hợp đồng BE.
- Thêm đăng nhập qua tokens/get, lấy quyền BE, guard và refresh một lần khi 401. Token trong bộ nhớ; không gửi token ra ngoài API base hoặc retry request của phiên cũ bằng tài khoản mới.
- Dev giữ port4200, proxy sang BE5000. Khung workspace giữ hướng Webflow và animation bình thường; gallery tiếp tục thử control.
- Sửa retry danh sách về đúng trang và điều hướng sau khi tiếp tục nhập trong lúc tạo sản phẩm. Bảng loại sản phẩm chỉ hiển thị dữ liệu API có cung cấp, không đếm `fields` của response danh sách.

Kiểm chứng và giới hạn tại [báo cáo](../verification/2026-10-20-live-collections.md). Snapshot mới phản ánh API UI được duyệt về hướng bố cục; không gọi là pixel-perfect Webflow. Quy tắc mới được ghi vào AGENTS, coding rules và SCSS rules để các thay đổi sau giữ cùng cách tổ chức.
