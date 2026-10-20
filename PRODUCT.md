# Boilerate Admin

Ứng dụng dành cho chủ shop và nhân viên quản trị. Mục tiêu là một không gian làm việc có thể dùng liên tục: tìm được thông tin nhanh, đọc được nhiều dòng dữ liệu và sửa bản ghi trong cùng ngữ cảnh.

## Mốc hiện tại

Triển khai nền giao diện theo 5 step đã duyệt: tham chiếu và quy chuẩn → workspace → theme/control → list/editor demo → motion và kiểm chứng. [Hồ sơ và tiến độ chính thức](../Boilerate/docs/frontend/features/admin-ui-foundation.md).

Mốc mới đã được người dùng duyệt ngày 20/10: collections gọi API thật trên SQL Server local, có đăng nhập và lưu dữ liệu sau khi nhận phản hồi server. Mỗi phần có màn danh sách và màn thêm/sửa `-io`. Gallery vẫn dùng dữ liệu minh họa để thử control. Theme và panel là tùy chọn trình duyệt. Theo yêu cầu ngày 21/10, phiên được khôi phục khi reload bằng cookie HttpOnly; access token giữ trong bộ nhớ.

## Nguyên tắc sản phẩm

- Webflow CMS/Ecommerce workspace là tham chiếu chính: điều hướng ổn định, panel theo ngữ cảnh, thao tác gần nội dung.
- Mở một bản ghi thay vùng danh sách, giữ rail và panel để người dùng biết mình đang ở đâu. Inspector chứa metadata/trạng thái liên quan; form chính giữ nội dung chỉnh sửa.
- Tiếng Việt là ngôn ngữ giao diện. Tên source/type dùng tiếng Anh; nội dung UI tránh thuật ngữ triển khai.
- Desktop là môi trường chính; màn nhỏ vẫn tìm, đọc, chỉnh mẫu và mở điều hướng được. Thu gọn hoặc chuyển panel thành overlay trước khi ép form quá hẹp.
- System/Light/Dark là lựa chọn đồng cấp. Theme không đổi dữ liệu hoặc tác vụ đang làm.
- Motion giúp đọc được thay đổi và phản hồi thao tác; không làm chậm nhập liệu.

## Mốc sau

Sau mốc collections local: UI chi tiết theo quyền, quản trị nhân viên, vận hành đơn, storefront và deployment. Mobile tối ưu sau; hiện ưu tiên desktop/tablet. Nghiệp vụ chung giữ một nguồn ở [docs/shared](../Boilerate/docs/shared/README.md), API ở [docs/backend](../Boilerate/docs/backend/README.md).

## Tiêu chí đánh giá trải nghiệm

Người dùng đăng nhập, mở danh sách, tìm/lọc/chọn dòng, mở editor, chỉnh giá trị và nhận phản hồi từ API sau khi lưu. Điều hướng và overlay hoạt động bằng bàn phím; kiểm tra chữ tiếng Việt dài, cả hai theme và animation bình thường. Mobile và kiểm tra reduced motion trên hệ điều hành được hoãn theo yêu cầu hiện tại.
