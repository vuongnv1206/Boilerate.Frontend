# Admin API và feature theo route — 2026-10-20

Trạng thái: đã triển khai và kiểm tra local; CI được ghi riêng tại [báo cáo](../verification/2026-10-20-live-collections.md). [Điều phối](../../../Boilerate/docs/shared/features/local-admin-integration.md). Người dùng yêu cầu code thật, ICustomSeeder thực chạy và tổ chức source tìm được theo route.

Route `admin/collections` dùng `features/collections/collections.routes.ts`. Theo yêu cầu mới của người dùng: `categories/categories.ts` là component danh sách; `categories/category-io/category-io.ts` là màn thêm/sửa. Bên trong folder component chỉ có file của nó và component con riêng. Products và product-types làm tương tự. Không dùng tầng `pages` hoặc `components` bao quanh mỗi màn.

Quyết định mới nhất của người dùng: `constants`, `enums`, `models`, `services`, `stores`, `forms`, `guards` nằm trong `src/app`, ngang cấp `features`. Tên file chỉ rõ chức năng, ví dụ `category.constants.ts`, `categories.service.ts`, `category-io.store.ts`; có alias import tương ứng. Các màn dùng chung được mà không đi vào thư mục riêng của nhau. Các component dùng chung toàn ứng dụng vẫn ở `shared/ui`.

Quyết định cuối: collections chỉ giữ đúng 6 component màn hình, không có component con toolbar/table/form/inspector/fields. Màn `-io` khai báo form và chứa HTML form; store nhận form đó. Các hàm tạo typed form, validation/mapping thuần giữ ngoài màn. Phần dùng chung toàn ứng dụng tiếp tục ở `shared/ui`.

Không tạo `.scss`/`.spec.ts` mặc định cho mỗi component. Bố cục list/editor/form/inspector dùng SCSS chung trong `src/styles/admin`; control dùng preset/tokens PrimeNG. Chỉ giữ test cho HTTP, store, form có luật riêng và hành trình browser. Style riêng chỉ thêm khi có nhu cầu riêng rõ ràng.

Thứ tự: seed/BE local → phiên đăng nhập + API config/proxy → từng feature typed DTO/service/store/form → thay route/navigation cũ và bỏ code demo không dùng → web unit/build/browser + live SQL Server roundtrip. Root giữ routes/providers/boundaries/global styles để tránh sửa chồng. Mobile hoãn; localhost:4200 giữ nguyên.

Phiên local đã được nâng ở [mốc giữ phiên ngày 21/10](persistent-session.md): refresh cookie HttpOnly, access token trong bộ nhớ, reload khôi phục và tải quyền lại. Không nhúng password vào FE hoặc runtime public config. Interceptor chỉ gắn bearer vào API base, refresh có serialize, retry tối đa một lần nếu refresh thành công và vẫn cùng userId; không retry mutation sau lỗi mạng/409. Catalog dùng items/total/pageNumber/pageSize khác Identity pagination.

Điều kiện hoàn tất: đăng nhập bằng BE thật, list/detail/edit phản ánh dữ liệu SQL Server, seed chạy lại ổn định, route/folder tương ứng, các kiểm tra web đạt. UI giữ Webflow/tokens/normal motion. Phần nào chưa đủ API không giả là đã lưu thành công.
