# Kiến trúc Admin FE

Áp dụng cho Angular 22.2.3 / PrimeNG 22.1.2. Thiết kế sản phẩm ở [PRODUCT](../PRODUCT.md), thị giác ở [DESIGN](../DESIGN.md). Repo này build và kiểm tra độc lập với Backend. Hiện các màn dùng dữ liệu minh họa trong bộ nhớ; chưa tích hợp API, auth hoặc phân quyền.

## Ranh giới và naming

| Khu vực           | Sở hữu                                             | Không phụ thuộc            |
| ----------------- | -------------------------------------------------- | -------------------------- |
| `core`            | Config, HTTP/error, theme, hợp đồng navigation     | Layout hoặc feature        |
| `layout`          | Rail/panel/topbar và tùy chọn workspace            | Feature/data demo          |
| `shared/ui`       | Presentation nhận input/phát output                | Core, feature, HTTP        |
| `shared/forms`    | Validation/error mapping có kiểu                   | Core hoặc feature          |
| `features/<name>` | Routes, màn, state và model của một feature        | Internals của feature khác |
| App composition   | Lắp routes và providers qua public feature entries | Private feature internals  |

`app.providers.ts` nối `WORKSPACE_NAVIGATION` với adapter công khai của content demo. Shell chỉ biết collection link và signal count, không biết fixture hoặc cách tải dữ liệu. Public entry chỉ export các điểm ghép cần thiết. Guard và màn được tải trong lazy feature routes. URL hiện có được giữ.

File/folder kebab-case, exported class/type PascalCase, biến/hàm camelCase. Component dùng cùng basename cho `.ts`, `.html`, `.scss`, `.spec.ts`, ví dụ `product-editor` / `ProductEditor`; không bắt buộc `Component`. API/store/DTO dùng tên có ý nghĩa như `products.api.ts`. Alias `@core`, `@layout`, `@shared`, `@features` được kiểm bằng cùng resolver với relative imports.

Thêm thư mục `data-access`, `state`, `models`, `pages`, `components` theo nhu cầu hiện có. Không tạo tầng rỗng hoặc export toàn bộ feature bằng barrel. `ContentItem` chỉ phục vụ demo, không đại diện DTO Catalog thật.

## State, forms và HTTP

- Signals/computed cho UI và state đồng bộ; RxJS cho async có hủy yêu cầu/composition. Effects chỉ thực hiện side effects. State đặt tại owner nhỏ nhất; store/facade không phải lớp bắt buộc.
- Typed Reactive Forms giữ giá trị và validation của form. Helper server errors nhận structural field-error map, ánh xạ PascalCase/nested paths qua mapping rõ ràng, giữ lỗi validator và trả lỗi chưa map cho summary.
- `RuntimeConfig` được đọc và kiểm tra trước bootstrap, cung cấp qua DI. Chỉ gồm public API base và optional PrimeUI license. Sai cấu hình hiện thông báo khởi động cố định, không in raw config/key.
- Một nguồn `public/runtime-config.js`, được sinh từ biến shell/CI hoặc `.env.local`; shell có ưu tiên cao hơn, kể cả giá trị rỗng. Mặc định API base `/api`. File sinh và local env bị ignore.
- HttpClient dùng functional error interceptor chỉ với API origin/path đã cấu hình; có HttpContext escape cho request cần xử lý riêng. `ApiError` chứa status/kind, thông báo UI an toàn, field errors và optional code/traceId.
- Không tự retry mutation, toast toàn cục, refresh token hoặc gọi BE. Wire pagination giữ `data/currentPage/totalPages/totalCount/pageSize/hasPreviousPage/hasNextPage`, trang bắt đầu từ 1; feature chuyển chỉ số của table.

Slice API sau sẽ lấy DTO từ OpenAPI đã kiểm tra theo commit BE. Chính sách phiên/token, live access bootstrap và CORS được chốt ở slice đó; không suy diễn từ fixture hoặc thêm SDK tổng quát trong mốc nền.

## Theme và presentation

Semantic CSS variables ở `styles/tokens` là nguồn giá trị chung. Preset ánh xạ vào CSS vars và supported component tokens; `styles/primeng` chỉ giữ những ngoại lệ compact/overlay cần thiết. Base và native control styles có owner riêng. Component SCSS sở hữu bố cục cục bộ, không dùng `::ng-deep` hoặc bảng màu riêng.

`FieldMessage`, `StatusBadge`, `ContentState` phục vụ các chỗ dùng thật trong list/editor/gallery. Feature ánh xạ business status sang tone trình bày. PrimeNG dialog/control tiếp tục được dùng trực tiếp; không thêm universal table, CRUD repository hoặc wrapper cho mọi control.

Root theme trước lần vẽ đầu, overlays appended to body, normal motion 120/180/240ms và fallback reduced motion được giữ. Việc tắt animation để ổn định một screenshot không thay đổi animation mặc định của ứng dụng.

## Kiểm chứng và workflow

`npm run check`: format → lint + 17 architecture probes → unit tests → production build. Vitest giới hạn 2 workers để tránh khởi tạo đồng thời quá nhiều fork. Browser suite chạy riêng bằng `npm run test:e2e` sau build.

Playwright được lock cùng browser, dùng 6 projects (desktop 1440×900, tablet 1024×768, mobile viewport 390×844 × light/dark), locale vi-VN, múi giờ Việt Nam, normal motion. Baseline ảnh theo platform; CI Windows dùng cùng win32 baseline. Không tự cập nhật snapshot trong CI. Khi đổi UI chủ đích, review diff và cập nhật baseline cùng commit thay đổi. Viewport mobile không thay thế nghiệm thu thiết bị thật/Safari.

CI chỉ checkout repo FE, không cần BE hoặc license secret. Bản build dùng cho visual regression có `PRIMEUI_LICENSE_KEY` rỗng để cùng trạng thái license với CI; giữ nguyên hành vi cảnh báo/watermark của vendor. Không dùng ảnh QA để né kiểm tra license.

Mỗi thay đổi có history và bằng chứng thực chạy; implemented/local verified/CI/user accepted/deployed là các trạng thái riêng. Hợp đồng nghiệp vụ/API vẫn thuộc repo BE; từ workspace có thể đọc `../Boilerate/docs/shared/contracts/frontend-backend.md`. Không nhân bản hợp đồng đó trong FE.

## Quyết định tooling

ESLint Boundaries 5.4 cùng TypeScript resolver thực thi ranh giới theo đường dẫn đã resolve, gồm import/dynamic import/re-export. Handlebars được override 4.7.10 để tránh advisory critical ở bản plugin ghim cũ. Audit dev tooling còn được ghi rõ trong báo cáo kiểm chứng; không tự chạy `audit fix --force` để đổi kiến trúc hoặc phá lockfile. Không đưa những dependency lint này vào bundle ứng dụng.
