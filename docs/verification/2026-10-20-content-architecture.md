# Kiểm chứng refactor feature content — 2026-10-20

Phạm vi: source Angular hiện có được tổ chức lại thành feature thực, giữ UI Webflow và mock session. [Kế hoạch](../features/content-feature-architecture.md), [coding rules](../coding-rules.md), [history source](../history/2026-10-20-content-architecture.md). Không nghiệm thu API/auth/authorization/deployment.

## Môi trường và source

- Windows, Node 24.19.0 bundled, Angular/CLI/CDK 22.2.3, PrimeNG 22.1.2, Vitest 4.1.12, Playwright 1.64.1 với Chromium đã pin.
- Production source: `9a6808c` sau commit data/HTTP `3ef55c3`. Browser tests và báo cáo này được commit cùng bước verification kế tiếp.
- License env rỗng và API base `/api`, như CI; không đọc/in/commit key local và không can thiệp hành vi vendor watermark. Normal motion bật; screenshot comparison tự ổn định animation riêng trong lúc chụp.

## Kết quả local

| Gate                          | Kết quả thực chạy                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`               | Đạt: format, ESLint, 46 architecture/AST probes, 145 tests / 20 files và production build                                           |
| Production build              | Initial 545.26 kB raw / 130.02 kB estimated transfer; content và content-io lazy chunks riêng                                       |
| Browser trước khi đổi phạm vi | **30/30 đạt local**, không retry, 1.6 phút; kết quả CI sau đó có lỗi mobile, xem dưới                                               |
| Golden snapshots              | 24 ảnh list/editor/dialog/drawer ở 6 projects khớp trong ngưỡng đã cấu hình; không chỉnh baseline                                   |
| Feature dependency            | Shell không biết feature/mock; page→store→service, presentation không inject store/service; kiểm tra relative/alias/private entries |
| Vòng đời async                | Hủy load cũ, giữ dirty edits khi save lỗi hoặc có edit mới, serialize writes, canonical status/timestamp và cleanup                 |
| HTTP base                     | Params/headers/context, error interceptor/cancellation và hai request concurrent không lẫn URL/options/config                       |

Sáu projects: desktop 1440×900, tablet 1024×768 và mobile viewport 390×844 × light/dark. Suite giữ 24 ca UI cũ và thêm 6 ca tạo bản nháp → tự sinh slug/autosave → mở lại đúng ID → sửa tiếp → quay về giữ filters/counts → reload reset fixture. Có kiểm tra resize/collapse, theme persistence, dirty guard, inspector focus/inert/Escape và gallery select/date picker/dialog/drawer/tooltip/toast.

## Lỗi phát hiện và sửa trong vòng kiểm chứng

Vòng browser đầu có 23 pass / 7 fail. Sáu fail do selector mới `.filter({hasText: 'Sản phẩm'})` khớp cả “Sản phẩm” và “Loại sản phẩm”; thay bằng collection link có href chính xác. Một fail tooltip mobile được khảo sát như focus/scroll race; bổ sung chờ overlay ẩn trước kiểm tra focus và thao tác tiếp. Không giảm assertion, thêm sleep hay cập nhật ảnh để vượt kiểm tra. Việc chờ overlay chưa giải quyết hoàn toàn lỗi tooltip trên CI, như kết quả tiếp theo.

Sau sửa, chạy lại 12 ca content/gallery: 12/12 đạt. Sau build cuối, toàn suite 30/30 đạt. Raw report nằm tại `artifacts/playwright-report`, kết quả tại `artifacts/playwright-results` và không commit. Có thể tái chạy bằng lệnh dưới đây.

Đã chụp riêng 24 PNG sau refactor tại `artifacts/comparison/content-architecture`, có geometry JSON của bản dựng. Đã xem các ảnh đại diện list/editor/dialog ở cả hai theme, gồm viewport desktop và mobile: không thấy lệch bố cục/scroll hoặc mất style do tách component. Đây là ảnh bản dựng để QA, không phải screenshot Webflow đo trực tiếp. Bộ ảnh được chụp với cùng trạng thái license rỗng như regression; cấu hình preview local sau QA đã được sinh lại từ nguồn local bình thường.

```powershell
$env:PRIMEUI_LICENSE_KEY = ''
$env:API_BASE_URL = '/api'
.\run.ps1 check
.\run.ps1 test:e2e
```

## CI và phạm vi web hiện tại

CI source `f7820db` [run 39424389364](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39424389364) đạt format/lint, 46 probes, 145 tests và production build. Browser **29/30 pass**; ca gallery mobile-dark không tìm thấy tooltip sau focus, lặp lại ở retry. Trace xác nhận drawer đã đóng và trigger tooltip giữ focus. Thư viện tooltip ẩn overlay khi ancestor scroll; reproduction với DOM events xác nhận tooltip có thể mất khi trigger vẫn focus. Chưa sửa production tooltip và chưa nghiệm thu mobile.

Theo yêu cầu tiếp theo của người dùng: tạm hoãn UI mobile, tập trung web. Gate `test:e2e` và CI chuyển sang desktop/tablet × light/dark, 20 tests và 16 golden snapshots. Giữ nguyên 10 mobile tests cùng baseline qua `test:e2e:mobile`; `test:e2e:all` chạy đủ 30. Chưa tính lỗi mobile là đã sửa hoặc nghiệm thu. [History phạm vi](../history/2026-10-20-web-scope.md).

Gate web mới đã đạt **20/20 local**, không retry, 1.1 phút; 16 golden snapshots giữ nguyên. Format và diff check đạt sau đổi scripts/phạm vi; không đổi production source kể từ `f7820db`.

**CI web đạt trên source `9f6e371`**: [run 39441412958](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39441412958), mọi step success gồm install locked dependencies, format/lint, **46 probes, 145 tests / 20 files**, production build, Chromium và **20/20 browser tests (1.1 phút)**. Đã đọc job logs để xác nhận số lượng; không có flaky trong summary. Các commit bàn giao sau đó chỉ sửa tài liệu và skip CI, không thay source đã kiểm.

Nghiệm thu thiết kế của người dùng, mobile thật/Safari, license hợp lệ và deployment vẫn là các trạng thái riêng. Dev server được giữ tại `http://localhost:4200`, preview 4300 chỉ dành cho QA production và tự đóng sau test. Khảo sát [seed package 1.0.1](../reference-audits/template-seeding-1.0.1.md) không đồng nghĩa đã seed DB hoặc nối API thật.
