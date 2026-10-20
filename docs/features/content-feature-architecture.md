# Tổ chức feature Angular thực tế — 2026-10-20

Trạng thái: Đang triển khai. Người dùng yêu cầu thực hiện refactor source: màn danh sách mang tên chức năng, màn thêm/sửa hậu tố `-io`; component/store/service có trách nhiệm rõ, có base HTTP. Giữ UI Webflow và normal motion; dữ liệu vẫn mock, chưa auth/API BE thật.

## Quyết định và tiêu chí

- Feature `content`: `pages/content/Content` là danh sách, `pages/content-io/ContentIo` là màn thêm/sửa. URL hiện có giữ để không làm gãy links/bookmarks/QA. Không tạo feature users/roles rỗng.
- `models`, `forms`, `data-access`, `state`, `components`, `pages`, `guards` có code thật tương ứng. Page chỉ ghép view, route và sự kiện; không biết fixtures/implementation mock.
- `ContentService` là DI contract, `MockContentService` sở hữu fixture và CRUD trong bộ nhớ. Các phương thức I/O trả Observable; navigation counts dùng cùng nguồn. Scope service theo admin route, store theo page; tùy chọn danh sách có owner riêng.
- `ContentStore` sở hữu query/selection/pagination/actions. `ContentIoStore` sở hữu form, load/save/autosave/status/dirty decisions; components chỉ nhận input/phát output, xử lý focus tại view.
- Base `ApiClient` dùng HttpClient + runtime API base + interceptor hiện có, typed methods/options; không tự retry/toast/auth hoặc đoán endpoint. Feature data service dùng composition khi nối API sau.
- Sửa lỗi duplicate tên vượt 180 ký tự; dùng giới hạn chung giữa form và mock validation.

## Bước và kiểm chứng

1. Model/form/data service + HTTP base và unit tests.
2. Màn `content`, store và component toolbar/table thực sự sử dụng.
3. Màn `content-io`, store/form/controller và component form/inspector thực sự sử dụng.
4. Tích hợp route/providers/navigation, xóa implementation cũ, lint boundaries cho pages/components/state/data-access.
5. Format/lint/unit/build, 24 browser tests/goldens hai theme ba viewport; CI thực tế và commit nhỏ/push. Chưa dùng test cũ làm kết quả sau refactor.

Chấp nhận khi đổi mock bằng DI test-double không sửa page, test load/error/save failure/cancellation và validation hoạt động; search/filter/page/selection, autosave/dirty guard/inspector giữ hành vi; ảnh không bị cập nhật để che hồi quy.

## Tiến độ

Đã đọc source/quy chuẩn, xác nhận refactor chưa thực hiện ở lượt review trước. Các luồng source được phân công theo file ownership để tránh sửa chồng nhau. Kết quả thực chạy sẽ ghi trong history/verification sau khi tích hợp.
