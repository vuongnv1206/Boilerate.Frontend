# Kiến trúc Admin FE

Angular 22.2.3, PrimeNG 22.1.2, standalone và strict TypeScript. [Quy tắc code](coding-rules.md) xác định cấu trúc hiện tại; [SCSS chung](scss-rules.md) giữ style tập trung; [DESIGN.md](../DESIGN.md) giữ hướng Webflow.

`features` giữ component màn hình và route. `constants`, `enums`, `models`, `services`, `stores`, `forms`, `guards` nằm bên cạnh, có tên file theo chức năng và alias import. Mỗi collections chỉ có danh sách và màn `-io`; không còn component nhỏ toolbar/table/form/inspector hoặc tầng `pages` quanh chúng.

| Phần                 | Công việc                                             |
| -------------------- | ----------------------------------------------------- |
| Component            | Route, form, HTML, thao tác và xác nhận rời màn       |
| Store                | Load/lưu, loading/error, hủy request cũ và giữ draft  |
| Service              | Endpoint/DTO, gọi `ApiClient`                         |
| `core/http`          | URL, HttpClient, lỗi; không giữ state nghiệp vụ       |
| `core/auth`          | Phiên trong bộ nhớ, quyền BE, guard và refresh        |
| `layout`             | Rail/panel/topbar, resize/collapse và tùy chọn bố cục |
| `shared/ui`          | Lỗi field, status, loading/empty/error dùng chung     |
| App routes/providers | Ghép public routes và DI                              |

Màn tạo typed form, đưa cho store; form helpers chỉ chứa hàm thuần. Store được cung cấp ở màn để dọn requests khi rời màn. Core/layout/shared không import component nghiệp vụ; service không import store/view. ESLint và `check-boundaries.mjs` kiểm tra ranh giới với alias và relative import.

API thật: `/admin/collections/products`, `/categories`, `/product-types`, mỗi phần có `new` và `:id`. Product có search/pagination, tạo SKU mặc định, sửa nội dung và trạng thái. Category xóa kèm version; product type không có DELETE vì BE chưa cung cấp. SKU/giá/tồn của sản phẩm đã có đang chỉ xem. Gallery dùng để thử control.

Dev `http://localhost:4200`, proxy `/api/**` sang BE `http://localhost:5000`. Runtime config kiểm tra trước bootstrap, mặc định `/api`. Token không lưu localStorage/sessionStorage; reload cần đăng nhập lại. Refresh dùng chung request cho các 401 cùng phiên và không retry request cũ bằng phiên người khác. BE kiểm quyền; UI ẩn/hiện chi tiết theo quyền để mốc sau.

Giữ semantic tokens, preset, System/Light/Dark và animation bình thường. Collections không có SCSS/spec component riêng. Test tập trung config/HTTP, auth, store/form và hành trình browser. `npm run check` chạy format → lint/rules → unit → build; browser web chạy riêng sau build. Mobile chưa nghiệm thu trong mốc này.

[Hồ sơ triển khai](features/live-admin-collections.md), `history` và `verification` ghi kết quả thực tế. Báo cáo demo trước đó là lịch sử, không thay bằng chứng API thật.
