# Frontend

Angular Admin của Boilerate, ưu tiên diện mạo workspace Webflow CMS/Ecommerce. Mốc hiện tại triển khai **nền UI với dữ liệu minh họa**: shell compact, theme System/Light/Dark, bộ control PrimeNG, danh sách và editor. Chưa kết nối Backend hoặc triển khai tính năng Catalog thật.

Backend nằm trong sibling `Boilerate/`; hai dự án có thể build độc lập. Frontend hiện nằm ngoài Git repository Backend; muốn lưu phiên bản FE cần đưa sibling này vào cơ chế version control của workspace hoặc repo riêng theo lựa chọn của người dùng.

## Chạy local

Yêu cầu Node tương thích Angular 22; runtime lựa chọn trong `.node-version` là **24.19.0**. `run.ps1` chọn Node phù hợp trên PATH hoặc runtime bundled của Codex; có thể đặt `BOILERATE_NODE` tới `node.exe` mong muốn. Script chỉ chỉnh PATH của tiến trình hiện tại, không thay Node global.

```powershell
cd D:\MyCode\BoilerateWorkspace\Frontend
.\run.ps1 install
.\run.ps1 start
```

Dev server: [http://127.0.0.1:4200/admin](http://127.0.0.1:4200/admin). Mở gallery qua điều hướng bộ control. Các thao tác dữ liệu chỉ nằm trong phiên demo; reload khôi phục fixture. Theme và panel có thể giữ tùy chọn trên trình duyệt.

## PrimeUI license

Người dùng chọn bổ sung license key sau. Ứng dụng hiện chạy không có key; PrimeUI có thể hiển thị cảnh báo console và watermark đỏ. Chưa nghiệm thu phần license hoặc giao diện sạch watermark. Khi có key hợp lệ của PrimeUI, đặt trong PowerShell trước khi khởi động lại:

```powershell
$env:PRIMEUI_LICENSE_KEY = '<YOUR_VALID_PRIMEUI_LICENSE_KEY>'
.\run.ps1 start
```

Giá trị trong ví dụ là placeholder, không phải key. `.env.example` chỉ liệt kê biến cần cấu hình; các file `.env` **không được tự động nạp**. `npm start`/`npm run build` và `run.ps1 start/build/check` tạo `public/runtime-config.js` từ biến môi trường rồi cung cấp cho PrimeNG. File runtime này bị Git ignore; không đưa key vào source hoặc tài liệu. Muốn bỏ key trong shell hiện tại dùng `Remove-Item Env:PRIMEUI_LICENSE_KEY -ErrorAction SilentlyContinue`, rồi chạy lại ứng dụng/build.

## Kiểm tra

```powershell
.\run.ps1 lint
.\run.ps1 test
.\run.ps1 build
.\run.ps1 format:check
```

`.\run.ps1 check` gộp lint, test và build. Khi terminal đã chọn Node phù hợp, có thể dùng các npm scripts tương ứng (`npm ci`, `npm start`, `npm run check`). Lệnh install dùng npm 12.2.0 để tránh lỗi resolver đã gặp ở npm 10 trên máy phát triển. Kết quả thực sự đã chạy được ghi trong [hồ sơ UI](../Boilerate/docs/frontend/features/admin-ui-foundation.md), không suy ra từ sự tồn tại của scripts. Khi deploy SPA dưới `/admin`, host cần fallback route giao diện về `index.html`; mốc này chưa cấu hình hoặc nghiệm thu deployment.

## Tài liệu và quy chuẩn

- [PRODUCT.md](PRODUCT.md): mục tiêu, người dùng và phạm vi demo.
- [DESIGN.md](DESIGN.md): bố cục, tokens, theme, control và motion.
- [AGENTS.md](AGENTS.md): folder, naming, Angular conventions và workflow.
- [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md): skill nhỏ dành cho màn quản trị của dự án.
- [Nguồn tham chiếu](design/references/README.md), [third-party notices](THIRD_PARTY_NOTICES.md).
- [Roadmap FE](../Boilerate/docs/frontend/roadmap.md) và [feature plan](../Boilerate/docs/frontend/features/admin-ui-foundation.md): nguồn tiến độ, lịch sử và kiểm chứng.

Stack hiện tại: Angular/CLI 22.2.3, PrimeNG 22.1.2, TypeScript 6, standalone components, strict templates và signals. PrimeNG được tùy biến tập trung theo tokens, tránh diện mạo theme mặc định quyết định thiết kế.

Đã hoàn tất local QA ngày **20/10/2026**: lint/format pass, full suite **23/23 tests/5 files**, production build pass lúc **00:07:38** (các lệnh riêng sau sửa cuối). Chrome desktop **1440×900** và mobile viewport **390×844** đã kiểm list/editor, theme, overlay, focus/guard và control; có **38 ảnh JPEG**. Animation bình thường bật theo lựa chọn người dùng; fallback reduced-motion CSS giữ nguyên, không yêu cầu OS-QA ở mốc này. [Báo cáo kiểm chứng](../Boilerate/docs/frontend/verification/2026-10-19-admin-ui-foundation.md) ghi phạm vi và ảnh; người dùng duyệt thiết kế, key license và deployment còn chờ.

Trước mốc kết nối API, đọc [hợp đồng BE–FE](../Boilerate/docs/shared/contracts/frontend-backend.md). Kết quả demo UI không nghiệm thu tích hợp hoặc quyền nghiệp vụ.
