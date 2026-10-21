# Frontend

Angular Admin của Boilerate, theo diện mạo workspace Webflow CMS/Ecommerce. FE có màn sản phẩm, danh mục và loại sản phẩm qua API, đăng nhập/khôi phục phiên, form thêm/sửa và xử lý lỗi. Có System/Light/Dark; Gallery dùng để thử control PrimeNG.

Repo FE riêng, private: [Boilerate.Frontend](https://github.com/vuongnv1206/Boilerate.Frontend), nhánh `main`. Backend nằm trong sibling `Boilerate/` khi làm việc ở workspace chung; FE có thể clone, build và chạy CI độc lập. [Rulebook chính](docs/coding-rules.md) quy định cách triển khai; [kiến trúc](docs/architecture.md) mô tả bản đồ source hiện tại.

Source theo [quy tắc code](docs/coding-rules.md): mỗi phần chỉ có màn danh sách và màn `-io`; component dùng cặp `.component.ts` và `.component.html` khi template ngoài (template inline được phép cho component nhỏ). Constants/enums/models/services/stores nằm ngang cấp `features`, import qua alias. Form, toolbar, bảng và inspector nhỏ nằm ngay trong màn. [SCSS chung](docs/scss-rules.md) giữ bố cục nhất quán; không tự tạo SCSS/spec cho mỗi component.

Ưu tiên **web desktop/tablet**, mobile tối ưu sau. Dev server giữ ở [http://localhost:4200](http://localhost:4200); cổng 4300 chỉ dùng tạm cho QA production.

**BE đã đồng bộ:** sibling `Boilerate` ở `9e5b410` có browser session, ProductType và Catalog DTO mà FE sử dụng. [Collections](docs/features/live-admin-collections.md) ghi quyền/query/API; [giữ phiên](docs/features/persistent-session.md) ghi contract cookie. Kết quả kiểm thử fixture và API thật được tách riêng trong báo cáo tích hợp.

## Chạy local

Yêu cầu Node tương thích Angular 22; runtime lựa chọn trong `.node-version` là **24.19.0**. `run.ps1` chọn Node phù hợp trên PATH hoặc runtime bundled của Codex; có thể đặt `BOILERATE_NODE` tới `node.exe` mong muốn. Script chỉ chỉnh PATH của tiến trình hiện tại, không thay Node global.

```powershell
cd D:\MyCode\BoilerateWorkspace\Boilerate.Frontend
.\run.ps1 install
.\run.ps1 start
```

Dev server: [http://localhost:4200/admin](http://localhost:4200/admin). Với BE tương thích, chạy API tại `http://localhost:5000`; `proxy.conf.json` chuyển `/api/**` sang BE. Đăng nhập bằng tài khoản quản trị được cấp quyền trong BE. Reload khôi phục phiên và URL qua cookie HttpOnly; access token chỉ ở bộ nhớ. Theme/panel giữ tùy chọn trình duyệt.

[Browser session](docs/features/persistent-session.md) dùng cùng origin `/api`; Production cần HTTPS và proxy FE/API cùng origin. Cookie SameSite Strict có hạn theo BE. Nếu phiên hết hạn hoặc bị thu hồi, ứng dụng yêu cầu đăng nhập lại; nếu lỗi mạng tạm thời, có thể bấm thử lại để tiếp tục phiên. Không cần thêm key hoặc biến runtime cho phần giữ phiên.

FE không kèm tài khoản, connection database hoặc lệnh seed. Cấu hình riêng và credentials giữ ngoài Git; dùng hướng dẫn của đúng phiên bản BE.

[Quản trị hệ thống](docs/features/system-administration.md) có Vai trò và phân quyền, Người dùng, Chức năng và Hành động tại `/admin/system`. Màn quyền theo nhóm lấy danh mục từ API; FE dùng chung `AuthSession.can`, không duy trì constant từng permission. Cần BE có migration `GroupedAuthorization` và `personal/authorization`; triển khai BE trước FE. Runtime đợt này chỉ kiểm chứng SQL Server theo lựa chọn của người dùng.

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

- [Mục lục và quy tắc docs](docs/README.md): kiến trúc, quy chuẩn, tính năng và bằng chứng tích hợp.
- [PRODUCT.md](PRODUCT.md): phạm vi hiện tại và hướng tiếp theo.
- [DESIGN.md](DESIGN.md): bố cục, tokens, theme, control và motion.
- [AGENTS.md](AGENTS.md) và [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md): hướng dẫn phát triển.
- [Lịch sử tính năng](docs/history/README.md): các mốc đã triển khai; chi tiết code tra trong Git.
- [Backend README](../Boilerate/README.md): hướng dẫn của source BE trong workspace.

Stack hiện tại: Angular/CLI 22.2.3, PrimeNG 22.1.2, TypeScript 6, standalone components, strict templates và signals. PrimeNG được tùy biến tập trung theo tokens, tránh diện mạo theme mặc định quyết định thiết kế.

Animation bình thường bật, có fallback reduced motion. Báo cáo tích hợp ghi rõ source đã kiểm chứng; user approval và deployment là các trạng thái nghiệm thu riêng.
