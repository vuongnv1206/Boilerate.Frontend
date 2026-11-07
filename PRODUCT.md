# Boilerate — Định hướng Sản phẩm

Ứng dụng thương mại một cửa hàng dành cho **chủ shop, nhân viên vận hành** (`/admin`) và **khách mua hàng** (`/shop`). Khu vực quản trị ưu tiên tra cứu nhanh, mật độ dữ liệu rõ ràng và chỉnh sửa bản ghi ngay trong cùng ngữ cảnh; cửa hàng công khai ưu tiên tôn vinh sản phẩm, hình ảnh và hành trình đặt mua mạch lạc.

> Tiến độ chi tiết, tài liệu từng phân hệ và kết quả kiểm chứng hiện hành được quản lý tập trung tại [../docs/README.md](../docs/README.md), [../docs/overview/roadmap.md](../docs/overview/roadmap.md) và [../docs/history/verification-summary.md](../docs/history/verification-summary.md).

## Nguyên tắc Trải nghiệm Sản phẩm

- **Ngôn ngữ thị giác thống nhất**: Bảng màu giấy ấm, charcoal và điểm nhấn terracotta lấy cảm hứng từ Claude; Admin ưu tiên độ rõ và khả năng quét bảng biểu, Storefront có khoảng thở Editorial rộng rãi. Chi tiết quy chuẩn nằm tại [DESIGN.md](DESIGN.md).
- **Giữ ngữ cảnh làm việc**: Mở chi tiết sản phẩm, loại sản phẩm hoặc đơn hàng luôn giữ rail danh sách cạnh vùng làm việc và bảo toàn bộ lọc/trang trên URL để chuyển bản ghi hoặc bấm **Quay lại** không mất vị trí. Nội dung chính, bộ ảnh, tùy chọn và biến thể nằm chung một biểu mẫu; metadata đặt cuối trang.
- **Đồng bộ công cụ vận hành**: Đơn hàng và Gia hạn dùng chung cấu trúc thanh công cụ, bảng dữ liệu, nhãn trạng thái và khu vực thông tin phụ trợ, đồng thời tôn trọng chặt chẽ quy trình quyền hạn (`Function.Action`), `Version` và `OperationId` của từng API.
- **Ngôn ngữ tự nhiên**: Giao diện hiển thị tiếng Việt ngắn gọn, rõ hành động, tránh lộ thuật ngữ kỹ thuật nội bộ; mã nguồn và kiểu dữ liệu dùng tiếng Anh.
- **Đa thiết bị & Chủ đề màu**: Admin tối ưu cho Desktop và Tablet; Storefront hỗ trợ trọn vẹn cả Desktop, Tablet và Mobile (`390×844`, `360×800`). Ba chế độ `System` / `Light` / `Dark` hoạt động đồng cấp mà không làm mất trạng thái đang nhập. Chuyển động ngắn gọn giúp nhận biết phản hồi trạng thái và tôn trọng `prefers-reduced-motion`.

## Tiêu chí Đánh giá Trải nghiệm

Người dùng đăng nhập (khôi phục phiên qua HttpOnly cookie), tìm/lọc danh sách, mở trình soạn thảo, lưu thay đổi và nhận phản hồi chính xác từ API (kể cả khi gặp `403`, `409` hoặc rớt mạng). Mọi điều hướng, bảng chọn và hộp thoại hoạt động đầy đủ bằng bàn phím, hiển thị tốt chuỗi tiếng Việt dài trên cả hai theme `Light` / `Dark`.
