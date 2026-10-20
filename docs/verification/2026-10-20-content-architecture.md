# Kiểm chứng refactor feature content — 2026-10-20

Phạm vi: source Angular hiện có được tổ chức lại thành feature thực, giữ UI Webflow và mock session. [Kế hoạch](../features/content-feature-architecture.md), [coding rules](../coding-rules.md), [history source](../history/2026-10-20-content-architecture.md). Không nghiệm thu API/auth/authorization/deployment.

## Môi trường và source

- Windows, Node 24.19.0 bundled, Angular/CLI/CDK 22.2.3, PrimeNG 22.1.2, Vitest 4.1.12, Playwright 1.64.1 với Chromium đã pin.
- Production source: `9a6808c` sau commit data/HTTP `3ef55c3`. Browser tests và báo cáo này được commit cùng bước verification kế tiếp.
- License env rỗng và API base `/api`, như CI; không đọc/in/commit key local và không can thiệp hành vi vendor watermark. Normal motion bật; screenshot comparison tự ổn định animation riêng trong lúc chụp.

## Kết quả local

| Gate               | Kết quả thực chạy                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`    | Đạt: format, ESLint, 46 architecture/AST probes, 145 tests / 20 files và production build                                           |
| Production build   | Initial 545.26 kB raw / 130.02 kB estimated transfer; content và content-io lazy chunks riêng                                       |
| `npm run test:e2e` | **30/30 đạt**, không retry local, 1.6 phút                                                                                          |
| Golden snapshots   | 24 ảnh list/editor/dialog/drawer ở 6 projects khớp trong ngưỡng đã cấu hình; không chỉnh baseline                                   |
| Feature dependency | Shell không biết feature/mock; page→store→service, presentation không inject store/service; kiểm tra relative/alias/private entries |
| Vòng đời async     | Hủy load cũ, giữ dirty edits khi save lỗi hoặc có edit mới, serialize writes, canonical status/timestamp và cleanup                 |
| HTTP base          | Params/headers/context, error interceptor/cancellation và hai request concurrent không lẫn URL/options/config                       |

Sáu projects: desktop 1440×900, tablet 1024×768 và mobile viewport 390×844 × light/dark. Suite giữ 24 ca UI cũ và thêm 6 ca tạo bản nháp → tự sinh slug/autosave → mở lại đúng ID → sửa tiếp → quay về giữ filters/counts → reload reset fixture. Có kiểm tra resize/collapse, theme persistence, dirty guard, inspector focus/inert/Escape và gallery select/date picker/dialog/drawer/tooltip/toast.

## Lỗi phát hiện và sửa trong vòng kiểm chứng

Vòng browser đầu có 23 pass / 7 fail. Sáu fail do selector mới `.filter({hasText: 'Sản phẩm'})` khớp cả “Sản phẩm” và “Loại sản phẩm”; thay bằng collection link có href chính xác. Một fail tooltip mobile do thao tác focus diễn ra trước khi drawer đóng xong; test chờ overlay ẩn rồi mới kiểm tra focus và thao tác tiếp. Không giảm assertion, thêm sleep hay cập nhật ảnh để vượt kiểm tra.

Sau sửa, chạy lại 12 ca content/gallery: 12/12 đạt. Sau build cuối, toàn suite 30/30 đạt. Raw report nằm tại `artifacts/playwright-report`, kết quả tại `artifacts/playwright-results` và không commit. Có thể tái chạy bằng lệnh dưới đây.

```powershell
$env:PRIMEUI_LICENSE_KEY = ''
$env:API_BASE_URL = '/api'
.\run.ps1 check
.\run.ps1 test:e2e
```

CI: chờ push và run thực tế của commit verification; chưa dùng CI baseline cũ làm bằng chứng cho source mới. Nghiệm thu thiết kế của người dùng, thiết bị mobile thật/Safari, license hợp lệ và deployment vẫn là các trạng thái riêng.
