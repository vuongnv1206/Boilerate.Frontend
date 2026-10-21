# Boilerate Admin

Ứng dụng dành cho chủ shop và nhân viên quản trị. Mục tiêu là một không gian làm việc có thể dùng liên tục: tìm được thông tin nhanh, đọc được nhiều dòng dữ liệu và sửa bản ghi trong cùng ngữ cảnh.

## Mốc hiện tại

FE có nền workspace, lựa chọn System/Light/Dark, panel co giãn và Gallery thử control. [Collections](docs/features/live-admin-collections.md) có danh sách và màn thêm/sửa sản phẩm, danh mục, loại sản phẩm qua API. [Giữ phiên](docs/features/persistent-session.md) khôi phục đăng nhập/URL khi reload bằng cookie HttpOnly; access token ở bộ nhớ.

Yêu cầu tích hợp được dẫn từ [README](README.md); phạm vi kiểm chứng theo từng phiên bản nằm ở tài liệu feature. Các mốc đã triển khai ở [lịch sử tính năng](docs/history/README.md).

## Nguyên tắc sản phẩm

- Webflow CMS/Ecommerce workspace là tham chiếu chính: điều hướng ổn định, panel theo ngữ cảnh, thao tác gần nội dung.
- Mở một bản ghi thay vùng danh sách, giữ rail và panel để người dùng biết mình đang ở đâu. Inspector chứa metadata/trạng thái liên quan; form chính giữ nội dung chỉnh sửa.
- Tiếng Việt là ngôn ngữ giao diện. Tên source/type dùng tiếng Anh; nội dung UI tránh thuật ngữ triển khai.
- Desktop là môi trường chính; màn nhỏ vẫn tìm, đọc, chỉnh mẫu và mở điều hướng được. Thu gọn hoặc chuyển panel thành overlay trước khi ép form quá hẹp.
- System/Light/Dark là lựa chọn đồng cấp. Theme không đổi dữ liệu hoặc tác vụ đang làm.
- Motion giúp đọc được thay đổi và phản hồi thao tác; không làm chậm nhập liệu.

## Mốc sau

Ưu tiên desktop/tablet. UI Collections đã khóa thao tác theo quyền BE và giữ query khi quay lại danh sách. Các phần chưa nghiệm thu gồm quản trị nhân viên, vận hành đơn, storefront và deployment; đây là hướng tiếp theo, chưa phải kế hoạch triển khai đã chốt. Mobile tối ưu sau, gồm lỗi tooltip Gallery mất hiển thị khi focus/scroll đã được ghi nhận ở mốc kiểm tra cũ.

## Tiêu chí đánh giá trải nghiệm

Người dùng đăng nhập, mở danh sách, tìm/lọc/chọn dòng, mở editor, chỉnh giá trị và nhận phản hồi từ API sau khi lưu. Điều hướng và overlay hoạt động bằng bàn phím; kiểm tra chữ tiếng Việt dài, cả hai theme và animation bình thường. Mobile và kiểm tra reduced motion trên hệ điều hành được hoãn theo yêu cầu hiện tại.
