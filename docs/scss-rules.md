# Quy tắc SCSS

1. Dùng PrimeNG trực tiếp. Màu, border, radius, focus và trạng thái control lấy từ preset/design tokens trong `core/theme` và `styles/tokens`; không vẽ lại control ở từng màn.
2. List, toolbar, bảng và editor dùng `styles/admin/_collections.scss`. Form, khoảng cách giữa trường và phần thuộc tính dùng `_forms.scss`.
3. Màn collections đặt host class `collection-screen`; dùng chung `collection-page`, `collection-toolbar`, `content-table`, `editor-page`, `editor-body`, `editor-form`, `field`, `field-row`.
4. Style chung có phạm vi rõ. Không thêm selector trần như `input`, `table`, `.field` ra toàn ứng dụng. Overlay gắn `body` dùng class riêng hoặc PrimeNG tokens.
5. Không dùng `::ng-deep`, palette riêng từng màn hoặc `!important` để chồng override. Global PrimeNG adapter chỉ giữ ngoại lệ token chưa đáp ứng được.
6. Không tạo `.scss` mặc định cho component mới. Component có `.component.ts` và template `.component.html` (hoặc inline template); style của màn nghiệp vụ dùng quy tắc chung. Styles shell/gallery và UI primitives đặt tập trung tại `styles/admin` và `styles/ui`, tham chiếu qua `styleUrl` để giữ encapsulation. Không copy style đó theo mỗi màn mới.
7. Kiểm tra list/editor/overlay sáng tối sau khi đổi style chung. Animation ứng dụng vẫn bật. Mobile đang hoãn.
