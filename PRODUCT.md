# Boilerate Admin

Ứng dụng dành cho chủ shop và nhân viên quản trị. Mục tiêu là một không gian làm việc có thể dùng liên tục: tìm được thông tin nhanh, đọc được nhiều dòng dữ liệu và sửa bản ghi trong cùng ngữ cảnh.

## Mốc hiện tại

Triển khai nền giao diện theo 5 step đã duyệt: tham chiếu và quy chuẩn → workspace → theme/control → list/editor demo → motion và kiểm chứng. [Hồ sơ và tiến độ chính thức](../Boilerate/docs/frontend/features/admin-ui-foundation.md).

Hai màn mẫu và bộ control dùng dữ liệu minh họa để thống nhất trải nghiệm. Chúng không gọi API, không xác nhận quyền và không tạo sản phẩm thật. Thao tác lưu chỉ ảnh hưởng phiên demo hiện tại; tải lại đưa dữ liệu về fixture ban đầu. Theme, độ rộng và trạng thái panel là tùy chọn trình duyệt có thể lưu.

## Nguyên tắc sản phẩm

- Webflow CMS/Ecommerce workspace là tham chiếu chính: điều hướng ổn định, panel theo ngữ cảnh, thao tác gần nội dung.
- Mở một bản ghi thay vùng danh sách, giữ rail và panel để người dùng biết mình đang ở đâu. Inspector chứa metadata/trạng thái liên quan; form chính giữ nội dung chỉnh sửa.
- Tiếng Việt là ngôn ngữ giao diện. Tên source/type dùng tiếng Anh; nội dung UI tránh thuật ngữ triển khai.
- Desktop là môi trường chính; màn nhỏ vẫn tìm, đọc, chỉnh mẫu và mở điều hướng được. Thu gọn hoặc chuyển panel thành overlay trước khi ép form quá hẹp.
- System/Light/Dark là lựa chọn đồng cấp. Theme không đổi dữ liệu hoặc tác vụ đang làm.
- Motion giúp đọc được thay đổi và phản hồi thao tác; không làm chậm nhập liệu.

## Mốc sau

Chỉ lập kế hoạch chi tiết nghiệp vụ, phiên/quyền và API sau khi nền UI được thống nhất. Catalog thật, quản trị nhân viên, vận hành đơn và storefront nằm ngoài mốc UI. Nghiệp vụ chung giữ một nguồn ở [docs/shared](../Boilerate/docs/shared/README.md); hợp đồng request/response ở [docs/backend](../Boilerate/docs/backend/README.md).

## Tiêu chí đánh giá trải nghiệm

Người dùng mở danh sách, tìm/lọc/chọn dòng, mở editor, chỉnh giá trị, nhận phản hồi lưu demo, quay lại và thử bộ control mà không mất phương hướng. Điều hướng và overlay hoạt động bằng bàn phím; chữ tiếng Việt dài, cả hai theme và reduced motion đều có bằng chứng kiểm tra.
