# Frontend

Angular Admin của Boilerate, theo diện mạo workspace Webflow CMS/Ecommerce. Collections đã gọi API thật: sản phẩm, danh mục và loại sản phẩm; có đăng nhập, form thêm/sửa và xử lý lỗi. Giữ System/Light/Dark và animation bình thường. Gallery dùng để thử control PrimeNG.

Repo FE riêng, private: [Boilerate.Frontend](https://github.com/vuongnv1206/Boilerate.Frontend), nhánh `main`. Backend nằm trong sibling `Boilerate/` khi làm việc ở workspace chung; FE có thể clone, build và chạy CI độc lập. [Kiến trúc codebase](docs/architecture.md) quy định ranh giới, state, forms, runtime/HTTP và theme.

Source theo [quy tắc code](docs/coding-rules.md): mỗi phần chỉ có màn danh sách và màn `-io`. Constants/enums/models/services/stores nằm ngang cấp `features`, import qua alias. Form, toolbar, bảng và inspector nhỏ nằm ngay trong màn. [SCSS chung](docs/scss-rules.md) giữ bố cục nhất quán; không tự tạo SCSS/spec cho mỗi component.

Ưu tiên **web desktop/tablet**, mobile tối ưu sau. [Kết quả collections](docs/verification/2026-10-20-live-collections.md) và [giữ phiên khi reload](docs/verification/2026-10-21-persistent-session.md) ghi source và phạm vi đã chạy. Dev server giữ ở [http://localhost:4200](http://localhost:4200); cổng 4300 chỉ dùng tạm cho QA production.

## Chạy local

Yêu cầu Node tương thích Angular 22; runtime lựa chọn trong `.node-version` là **24.19.0**. `run.ps1` chọn Node phù hợp trên PATH hoặc runtime bundled của Codex; có thể đặt `BOILERATE_NODE` tới `node.exe` mong muốn. Script chỉ chỉnh PATH của tiến trình hiện tại, không thay Node global.

```powershell
cd D:\MyCode\BoilerateWorkspace\Frontend
.\run.ps1 install
.\run.ps1 start
```

Dev server: [http://localhost:4200/admin](http://localhost:4200/admin). Chạy BE tại `http://localhost:5000`; `proxy.conf.json` chuyển `/api/**` sang BE. Đăng nhập bằng tài khoản quản trị đã bootstrap và cấp quyền trong BE. Reload giữ phiên và URL hiện tại: guard khôi phục qua cookie HttpOnly rồi tải quyền. Access token chỉ ở bộ nhớ, không đưa token vào localStorage/sessionStorage. Đăng xuất thu hồi phiên và báo các tab khác. Nội dung đã lưu nằm trong database; theme/panel giữ tùy chọn trình duyệt.

[Browser session](docs/features/persistent-session.md) dùng cùng origin `/api`; Production cần HTTPS và proxy FE/API cùng origin. Cookie SameSite Strict có hạn theo BE. Nếu phiên hết hạn hoặc bị thu hồi, ứng dụng yêu cầu đăng nhập lại; nếu lỗi mạng tạm thời, có thể bấm thử lại để tiếp tục phiên. Không cần thêm key hoặc biến runtime cho phần giữ phiên.

Trong workspace local này, SQL Server dùng database riêng `BoilerateDevelopment`. Cấu hình và tài khoản local ở `../Boilerate/artifacts/local-admin.secrets.json` bị ignore; không đưa file đó vào Git. [Hướng dẫn seed JSON](../Boilerate/docs/backend/history/2026-10-20-development-seeding.md) ghi cách thêm dữ liệu và chạy lại mà không ghi đè dữ liệu đã sửa.

## PrimeUI license

License key được giữ trong cấu hình local bị ignore; không đặt key thật trong `.env.example`. Khi chưa có key hợp lệ, PrimeUI có thể hiển thị cảnh báo/watermark của vendor. Việc có một giá trị cấu hình không xác nhận license đã được nghiệm thu. Có thể đặt trong shell trước khi khởi động:

```powershell
$env:PRIMEUI_LICENSE_KEY = '<YOUR_VALID_PRIMEUI_LICENSE_KEY>'
.\run.ps1 start
```

Giá trị trong ví dụ là placeholder. Copy `.env.example` thành `.env.local` nếu cần; shell/CI thắng local, kể cả chuỗi rỗng. `API_BASE_URL` mặc định `/api`. `npm start`/`npm run build` sinh `public/runtime-config.js` bị ignore; có thể thay file theo môi trường mà không rebuild. Không đặt mật khẩu hoặc token trong runtime config. Đặt `PRIMEUI_LICENSE_KEY` rỗng để thử trạng thái không có key; bỏ biến shell để dùng lại local.

## Kiểm tra

```powershell
.\run.ps1 lint
.\run.ps1 test
.\run.ps1 build
.\run.ps1 format:check
```

`.\run.ps1 check` gộp format, lint/boundaries, unit tests và build. Khi terminal đã chọn Node phù hợp, có thể dùng npm scripts tương ứng. Lệnh install dùng npm 12.2.0 để tránh lỗi resolver đã gặp ở npm 10 trên máy phát triển. Trên máy mới dùng `npx --yes --package=npm@12.2.0 npm ci`, rồi `npm run check`. Khi deploy, host cần fallback các route SPA về `index.html`, cache runtime config phù hợp và chuyển `/api` tới BE; chưa nghiệm thu deployment.

Browser tests dùng production build. Cài Chromium bằng `npx playwright install chromium`, build với `PRIMEUI_LICENSE_KEY` rỗng và `API_BASE_URL=/api`, rồi chạy `npm run test:e2e`: desktop/tablet × light/dark. API fixture chỉ nằm trong `e2e/helpers`, không đưa mock vào route ứng dụng. `test:e2e:mobile`/`test:e2e:all` giữ để kiểm tra sau. Preview dùng port 4300 và tự đóng khi xong. Chỉ cập nhật ảnh khi đã xem lại thay đổi; CI không tự sửa baseline. Raw report/trace nằm trong `artifacts/` bị ignore.

## Tài liệu và quy chuẩn

- [PRODUCT.md](PRODUCT.md): mục tiêu và phạm vi.
- [DESIGN.md](DESIGN.md): bố cục, tokens, theme, control và motion.
- [AGENTS.md](AGENTS.md): folder, naming, Angular conventions và workflow.
- [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md): skill nhỏ dành cho màn quản trị của dự án.
- [Nguồn tham chiếu](design/references/README.md), [third-party notices](THIRD_PARTY_NOTICES.md).
- [Roadmap FE](../Boilerate/docs/frontend/roadmap.md) và [feature plan](../Boilerate/docs/frontend/features/admin-ui-foundation.md): nguồn tiến độ, lịch sử và kiểm chứng.

Stack hiện tại: Angular/CLI 22.2.3, PrimeNG 22.1.2, TypeScript 6, standalone components, strict templates và signals. PrimeNG được tùy biến tập trung theo tokens, tránh diện mạo theme mặc định quyết định thiết kế.

Baseline UI trước mốc codebase đã có local QA; [báo cáo cũ](../Boilerate/docs/frontend/verification/2026-10-19-admin-ui-foundation.md) không thay thế kết quả sau refactor. [History codebase](docs/history/) và báo cáo trong `docs/verification/` ghi kiểm chứng mới, kết quả CI và giới hạn thực tế. Animation bình thường bật; fallback reduced motion giữ nguyên. User approval và deployment là các trạng thái nghiệm thu riêng.

Đọc [hợp đồng BE–FE](../Boilerate/docs/shared/contracts/frontend-backend.md) khi mở rộng API. Kết quả local không thay nghiệm thu deployment hoặc mọi vai trò/quyền.
