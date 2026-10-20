# Tổ chức feature Angular thực tế — 2026-10-20

Trạng thái: Source và local verification hoàn thành; chờ CI sau push. Người dùng yêu cầu thực hiện refactor source: màn danh sách mang tên chức năng, màn thêm/sửa hậu tố `-io`; component/store/service có trách nhiệm rõ, có base HTTP. Giữ UI Webflow và normal motion; dữ liệu vẫn mock, chưa auth/API BE thật.

## Quyết định và tiêu chí

- Feature `content`: `pages/content/Content` là danh sách, `pages/content-io/ContentIo` là màn thêm/sửa. URL hiện có giữ để không làm gãy links/bookmarks/QA. Không tạo feature users/roles rỗng.
- `models`, `forms`, `data-access`, `state`, `components`, `pages`, `guards` có code thật tương ứng. Page chỉ ghép view, route và sự kiện; không biết fixtures/implementation mock.
- `ContentService` là DI contract, `MockContentService` sở hữu fixture và CRUD trong bộ nhớ. Các phương thức I/O trả Observable; navigation counts dùng cùng nguồn. Scope service theo admin route, store theo page; tùy chọn danh sách có owner riêng.
- `ContentStore` sở hữu query/selection/pagination/actions. `ContentIoStore` sở hữu form, load/save/autosave/status/dirty decisions; components chỉ nhận input/phát output, xử lý focus tại view.
- Base `ApiClient` dùng HttpClient + runtime API base + interceptor hiện có, typed methods/options; không tự retry/toast/auth hoặc đoán endpoint. Feature data service dùng composition khi nối API sau.
- Sửa lỗi duplicate tên vượt 180 ký tự; dùng giới hạn chung giữa form và mock validation.
- Bổ sung theo steering: rule bắt buộc ở `docs/coding-rules.md` và `AGENTS.md`; enum/constants/model tách khỏi component, imports standalone cụ thể và style class thống nhất. Đối chiếu BE, eco-fe và NanoFE core; chọn base HTTP composition/stateless và DI, giữ state/grid ở feature.

## Bước và kiểm chứng

1. Model/form/data service + HTTP base và unit tests.
2. Màn `content`, store và component toolbar/table thực sự sử dụng.
3. Màn `content-io`, store/form/controller và component form/inspector thực sự sử dụng.
4. Tích hợp route/providers/navigation, xóa implementation cũ, lint boundaries cho pages/components/state/data-access.
5. Format/lint/unit/build, browser regression + content workflow ở hai theme; CI thực tế và commit nhỏ/push. Theo yêu cầu mới, gate hiện tại là web desktop/tablet (20 tests), mobile tối ưu sau và giữ suite riêng (10 tests).

Chấp nhận khi đổi mock bằng DI test-double không sửa page, test load/error/save failure/cancellation và validation hoạt động; search/filter/page/selection, autosave/dirty guard/inspector giữ hành vi; ảnh không bị cập nhật để che hồi quy.

## Tiến độ

Steps 1–4 đã triển khai vào route thực; implementation cũ đã xóa. Step 5 local đạt full format/lint, 46 probes, 145 unit tests, production build và 30 browser tests; 24 ảnh baseline giữ nguyên. CI source `f7820db` browser 29/30 pass do tooltip mobile-dark; không coi lỗi này đã sửa. Người dùng chuyển ưu tiên sang web, hoãn mobile: gate 20 tests desktop/tablet đang chạy lại local/CI. [Verification](../verification/2026-10-20-content-architecture.md) và [history phạm vi](../history/2026-10-20-web-scope.md) ghi kết quả và giới hạn. Người dùng cũng đề xuất nối API thật, SQL Server làm mặc định BE; đã khảo sát contract nhưng đang cần instance/database và lệnh seed để chốt môi trường. Chưa gọi BE hoặc seed DB.
