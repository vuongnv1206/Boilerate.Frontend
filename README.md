# Boilerate Frontend (`Angular 22`)

Giao diện quản trị (`/admin`, lấy cảm hứng từ Webflow CMS/Ecommerce) và cửa hàng khách mua (`/shop`, phong cách Editorial ấm) của Boilerate, xây dựng trên `Angular 22.2.3`, `PrimeNG 22.1.2`, `TypeScript 6`, standalone components và signals.

- Repo Frontend riêng: [Boilerate.Frontend](https://github.com/vuongnv1206/Boilerate.Frontend) (`main`). Backend nằm tại thư mục kế bên [../Boilerate](../Boilerate/README.md).
- Quy tắc code & SCSS: [../agents/frontend.md](../agents/frontend.md).
- Kiến trúc hệ thống & bản đồ source: [../docs/overview/architecture.md](../docs/overview/architecture.md).

## Chạy ở môi trường Local

Yêu cầu Node tương thích Angular 22 (`.node-version` chỉ định **24.19.0**). Script `run.ps1` tự động tìm runtime Node phù hợp trên máy cho tiến trình hiện tại mà không đổi cấu hình Node toàn cục:

```powershell
cd D:\MyCode\BoilerateWorkspace\Frontend
.\run.ps1 install
.\run.ps1 start
```

- Cửa hàng khách mua: `http://localhost:4200/shop/products`
- Khu vực quản trị: `http://localhost:4200/admin` (yêu cầu Backend SQL Server local đang chạy tại `http://localhost:5000`; `proxy.conf.json` tự động chuyển tiếp `/api/**` sang Backend).
- [Giữ phiên đăng nhập](../docs/auth-system/README.md) sử dụng cookie `HttpOnly` (`SameSite=Strict`) kết hợp access token và bộ quyền `Function.Action` lưu trên RAM.

## Cấu hình PrimeUI License (Tùy chọn)

Khóa bản quyền PrimeUI được giữ ngoài Git (trong `.env.local` bị ignore hoặc biến môi trường shell). Khi chưa đặt khóa hợp lệ, ứng dụng vẫn hoạt động bình thường kèm cảnh báo mặc định của nhà cung cấp:

```powershell
$env:PRIMEUI_LICENSE_KEY = '<YOUR_VALID_PRIMEUI_LICENSE_KEY>'
.\run.ps1 start
```

Lệnh `start` / `build` tự động sinh `public/runtime-config.js` (bị ignore) với `API_BASE_URL` mặc định `/api`. Không bao giờ đặt mật khẩu hay token xác thực vào runtime config.

## Kiểm tra Chất lượng & Browser E2E Local

```powershell
# Chạy trọn bộ kiểm tra nhanh: Prettier + ESLint + 43 Architecture Checks + Vitest Unit + Production Build
.\run.ps1 check

# Chạy các bước riêng lẻ khi cần:
.\run.ps1 format:check
.\run.ps1 lint
.\run.ps1 test
.\run.ps1 build

# Kiểm thử giao diện Playwright Chromium (cài lần đầu bằng: npx playwright install chromium)
.\run.ps1 test:e2e              # Desktop & Tablet × Light / Dark
.\run.ps1 test:e2e:shop-mobile  # Storefront Mobile (390×844 & 360×800) × Light / Dark
```

Để chạy nghiệm thu toàn luồng kết nối Kestrel và SQL Server test cô lập (`boilerate_test_<guid>`):

```powershell
pwsh ..\Boilerate\scripts\verify-admin.ps1 -FrontendRoot 'D:\MyCode\BoilerateWorkspace\Frontend'
```

Báo cáo và trace của từng lượt chạy lưu trong `artifacts/` (được Git ignore).

## Tài liệu & Quy chuẩn liên quan

- [../docs/README.md](../docs/README.md): Nguồn tài liệu chính thức duy nhất của toàn dự án (`catalog`, `storefront-checkout`, `orders-fulfillment`, `auth-system`, `contracts`).
- [PRODUCT.md](PRODUCT.md) & [DESIGN.md](DESIGN.md): Nguyên tắc trải nghiệm sản phẩm, bảng màu, semantic tokens, typography và motion.
- [AGENTS.md](AGENTS.md) & [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md): Hướng dẫn cho AI/lập trình viên khi sửa giao diện.
- [../docs/history/changelog.md](../docs/history/changelog.md) & [../docs/history/verification-summary.md](../docs/history/verification-summary.md): Lịch sử các mốc tính năng và kết quả kiểm chứng local.
