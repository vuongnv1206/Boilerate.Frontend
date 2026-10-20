# Frontend

Angular Admin của Boilerate, ưu tiên diện mạo workspace Webflow CMS/Ecommerce. Mốc hiện tại triển khai **nền UI với dữ liệu minh họa**: shell compact, theme System/Light/Dark, bộ control PrimeNG, danh sách và editor. Chưa kết nối Backend hoặc triển khai tính năng Catalog thật.

Repo FE riêng, private: [Boilerate.Frontend](https://github.com/vuongnv1206/Boilerate.Frontend), nhánh `main`. Backend nằm trong sibling `Boilerate/` khi làm việc ở workspace chung; FE có thể clone, build và chạy CI độc lập. [Kiến trúc codebase](docs/architecture.md) quy định ranh giới, state, forms, runtime/HTTP và theme.

## Chạy local

Yêu cầu Node tương thích Angular 22; runtime lựa chọn trong `.node-version` là **24.19.0**. `run.ps1` chọn Node phù hợp trên PATH hoặc runtime bundled của Codex; có thể đặt `BOILERATE_NODE` tới `node.exe` mong muốn. Script chỉ chỉnh PATH của tiến trình hiện tại, không thay Node global.

```powershell
cd D:\MyCode\BoilerateWorkspace\Frontend
.\run.ps1 install
.\run.ps1 start
```

Dev server: [http://127.0.0.1:4200/admin](http://127.0.0.1:4200/admin). Mở gallery qua điều hướng bộ control. Các thao tác dữ liệu chỉ nằm trong phiên demo; reload khôi phục fixture. Theme và panel có thể giữ tùy chọn trên trình duyệt.

## PrimeUI license

License key được giữ trong cấu hình local bị ignore; không đặt key thật trong `.env.example`. Khi chưa có key hợp lệ, PrimeUI có thể hiển thị cảnh báo/watermark của vendor. Việc có một giá trị cấu hình không xác nhận license đã được nghiệm thu. Có thể đặt trong shell trước khi khởi động:

```powershell
$env:PRIMEUI_LICENSE_KEY = '<YOUR_VALID_PRIMEUI_LICENSE_KEY>'
.\run.ps1 start
```

Giá trị trong ví dụ là placeholder. Copy `.env.example` thành `.env.local` nếu cần cấu hình local; chỉ `.env.local` được tự động nạp. Giá trị shell/CI luôn thắng local, kể cả chuỗi rỗng. `API_BASE_URL` mặc định `/api`; chưa có màn gọi BE thật. `npm start`/`npm run build` sinh `public/runtime-config.js` bị ignore; khi deploy có thể thay file public này theo môi trường, không cần rebuild bundle. Config được kiểm tra trước bootstrap. Không đặt mật khẩu hoặc access/refresh tokens trong runtime config. Đặt `PRIMEUI_LICENSE_KEY` rỗng để thử trạng thái không có key; bỏ biến shell sẽ dùng lại giá trị local.

## Kiểm tra

```powershell
.\run.ps1 lint
.\run.ps1 test
.\run.ps1 build
.\run.ps1 format:check
```

`.\run.ps1 check` gộp format, lint/boundaries, unit tests và build. Khi terminal đã chọn Node phù hợp, có thể dùng npm scripts tương ứng. Lệnh install dùng npm 12.2.0 để tránh lỗi resolver đã gặp ở npm 10 trên máy phát triển. Trên máy mới dùng `npx --yes --package=npm@12.2.0 npm ci`, rồi `npm run check`. Khi deploy, host cần fallback các route SPA về `index.html`, cache runtime config phù hợp và chuyển `/api` tới BE; chưa nghiệm thu deployment.

Browser tests dùng bản production build: chạy `npx playwright install chromium`, `npm run build`, rồi `npm run test:e2e` (hoặc `.\run.ps1 test:e2e`). Preview phục vụ loopback port 4300. Sáu projects bao phủ desktop/tablet/mobile viewport × light/dark. CI Windows dùng baseline win32 đã commit. Khi tạo baseline để cùng trạng thái license với CI, build với biến shell `PRIMEUI_LICENSE_KEY` rỗng; không xóa cấu hình local. `npm run test:e2e:update` chỉ dùng khi chủ động đổi thiết kế và review ảnh; CI không tự cập nhật snapshot. Raw reports/traces nằm trong `artifacts/` bị ignore.

## Tài liệu và quy chuẩn

- [PRODUCT.md](PRODUCT.md): mục tiêu, người dùng và phạm vi demo.
- [DESIGN.md](DESIGN.md): bố cục, tokens, theme, control và motion.
- [AGENTS.md](AGENTS.md): folder, naming, Angular conventions và workflow.
- [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md): skill nhỏ dành cho màn quản trị của dự án.
- [Nguồn tham chiếu](design/references/README.md), [third-party notices](THIRD_PARTY_NOTICES.md).
- [Roadmap FE](../Boilerate/docs/frontend/roadmap.md) và [feature plan](../Boilerate/docs/frontend/features/admin-ui-foundation.md): nguồn tiến độ, lịch sử và kiểm chứng.

Stack hiện tại: Angular/CLI 22.2.3, PrimeNG 22.1.2, TypeScript 6, standalone components, strict templates và signals. PrimeNG được tùy biến tập trung theo tokens, tránh diện mạo theme mặc định quyết định thiết kế.

Baseline UI trước mốc codebase đã có local QA; [báo cáo cũ](../Boilerate/docs/frontend/verification/2026-10-19-admin-ui-foundation.md) không thay thế kết quả sau refactor. [History codebase](docs/history/) và báo cáo trong `docs/verification/` ghi kiểm chứng mới, kết quả CI và giới hạn thực tế. Animation bình thường bật; fallback reduced motion giữ nguyên. User approval và deployment là các trạng thái nghiệm thu riêng.

Trước mốc kết nối API, đọc [hợp đồng BE–FE](../Boilerate/docs/shared/contracts/frontend-backend.md). Kết quả demo UI không nghiệm thu tích hợp hoặc quyền nghiệp vụ.
