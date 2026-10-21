# Bản đồ triển khai Admin FE

Angular 22.2.3, PrimeNG 22.1.2 và strict TypeScript/templates. Cách viết và mở rộng source nằm trong [rulebook chính](coding-rules.md); diện mạo ở [DESIGN](../DESIGN.md) và [SCSS](scss-rules.md). Tài liệu này chỉ ghi các thành phần đang triển khai.

| Vị trí                     | Thành phần hiện tại                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app.routes/providers`     | Lazy routes, composition navigation đã lọc quyền, hạ tầng root                                             |
| `core/config`              | Kiểm runtime config công khai trước bootstrap                                                              |
| `core/http`                | ApiClient, API URL, error normalization, pagination contracts                                              |
| `core/auth`                | Browser session, token/quyền trong bộ nhớ, refresh/logout coordination, auth guard/interceptor             |
| `core/theme`               | System/Light/Dark, preset và root theme                                                                    |
| `layout/admin-shell`       | Rail, context panel, topbar, resize/collapse, theme và logout                                              |
| `features/collections`     | Sáu màn: products/category/product types list và `-io`                                                     |
| `features/auth`            | Login, form do component sở hữu                                                                            |
| `features/access-denied`   | `/admin/forbidden`                                                                                         |
| `features/control-gallery` | Preview controls/overlays PrimeNG                                                                          |
| `services`                 | Products/Categories/ProductTypes endpoint adapters trả Observable                                          |
| `stores`                   | Screen-scoped list/editor/login requests và state                                                          |
| `forms`                    | Typed forms, validators, hydration và DTO mapping                                                          |
| `models`                   | Wire `.dto`, query/navigation `.model`                                                                     |
| `constants/enums`          | Catalog limits/options, permission/navigation, wire enums                                                  |
| `guards`                   | Permission, admin home và unsaved changes                                                                  |
| `utils`                    | Query parser/serializer và slug algorithm thuần                                                            |
| `shared/forms`             | Field error mapping và validation messages                                                                 |
| `shared/ui`                | Icon, field message, content state, status badge, error summary, confirm dialog/controller và focus helper |
| `src/tests/components`     | Kiểm thử component/confirmation tập trung                                                                  |

Routes `/admin/collections/products`, `/categories`, `/product-types` có list, `new`, `:id`. `/admin` chờ session, chọn danh sách đầu tiên được View; không có quyền đến forbidden. Navigation là DI contract từ core, app composition nối permission constants với shell. Query danh sách nằm trong URL và được mang theo editor; selection chỉ sống ở list store.

Editor tạo form, giao cho store đúng một lần trước load. Store giữ bản canonical/version và revision; service gọi ApiClient. Save Observable chỉ phát DTO thành công. Shared LeaveConfirmation được cung cấp theo editor, dùng chung UI và hủy quyết định còn chờ khi destroy. Các ranh giới được ESLint và architecture probes kiểm.

Dev `http://localhost:4200`, proxy `/api/**` sang BE `http://localhost:5000`. `window.__BOILERATE_UI__` mặc định API base `/api`; chỉ nhận `apiBaseUrl`, `primeUiLicense`, không secrets. Shell/CI thắng `.env.local`, kể cả license rỗng. `runtime-config.js` được sinh và ignored. API resources là path tương đối, params truyền qua options.

Error interceptor chuẩn hóa response trong API base thành ApiError (status/kind, safe message, traceId, field errors); không giữ raw response/headers/stack. Auth interceptor xử lý 401 và coordinated refresh; [browser session](features/persistent-session.md) sở hữu contract. `applyServerErrors` nhận cấu trúc lỗi từ caller, không phụ thuộc core HTTP.

[Collections](features/live-admin-collections.md) ghi quyền/query/API hiện tại. BE sibling đã pull tới `9e5b410` có Catalog và browser session tương ứng. [Mục lục docs](README.md) phân biệt contract, feature history và evidence; mobile/deployment chưa thuộc mốc web hiện tại.
