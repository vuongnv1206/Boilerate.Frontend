# Kiểm tra collections API — 20/10/2026

Môi trường: Windows, Node24.19.0, Angular22.2.3, PrimeNG22.1.2, Chromium theo Playwright1.64.1. BE .NET10.0.402, SQL Server instance `.` và database riêng `BoilerateDevelopment`.

## Đã kiểm tra

- TypeScript/Angular strict templates và production build đạt sau khi gộp component.
- `npm run check` đạt: format, lint, 34 kiểm tra import cùng quy tắc folder/style, 141 unit tests / 22 files và production build. Initial bundle 548,88 kB; tập trung HTTP, auth, store, form và phần nền đang dùng.
- 24 browser tests desktop 1440×900/tablet 1024×768, light/dark đạt ở lượt cuối sau các sửa lỗi. Đã kiểm tra style thực tế của heading form ở cả dev và production; tạo lại 4 ảnh editor bằng `--update-snapshots=all` để phản ánh căn trái mới, sau đó chạy lại toàn bộ web suite không cập nhật ảnh: 24/24 đạt.
- API fixtures của browser suite chỉ ở e2e/helpers; app source dùng API thật. Browser kiểm login, search, pagination/selection, create/publish/reopen, dirty guard, save409 giữ nội dung, category/type create/edit, panel/theme và select/date/dialog/drawer/tooltip/toast.
- QA trực tiếp tại localhost4200 → proxy → BE5000: login thật; danh sách 14 sản phẩm, 6 danh mục, 2 loại; sửa sản phẩm và reload thấy dữ liệu giữ trong SQL Server; sửa category/type và đưa lại tên cũ. Không có browser page errors. Bằng chứng local bị ignore tại `artifacts/live-api/result.json` và ảnh cùng folder.
- Seed JSON chạy CLI giữ 14 sản phẩm có sẵn; provider tests kiểm dữ liệu đã chỉnh không bị ghi đè. Chi tiết BE tại [báo cáo seed](../../../Boilerate/docs/backend/verification/2026-10-20-development-seeding.md).
- Rà soát cuối sửa retry danh sách về đúng trang và điều hướng sau khi nhập tiếp trong lúc tạo sản phẩm. Có unit test cho hai tình huống này. Bỏ số đếm thuộc tính ở bảng loại sản phẩm vì API danh sách chưa cung cấp số lượng thực tế.

## Giới hạn

Mobile tối ưu sau. Token chỉ giữ trong tab, reload phải đăng nhập lại. BE kiểm quyền; chưa nghiệm thu UI cho từng vai trò. SKU/giá/tồn của sản phẩm đã có đang chỉ xem. Chưa nghiệm thu deployment. PrimeUI vẫn có thể hiện cảnh báo license của vendor; không coi đó là lỗi đã được xử lý hoặc giấu nó.

## Chạy lại

Chọn Node theo `.node-version`, cài theo lockfile với npm 12.2.0, đặt `PRIMEUI_LICENSE_KEY` rỗng và `API_BASE_URL=/api`, rồi chạy `npm run check`, `npx playwright install chromium`, `npm run test:e2e`. Browser suite dùng API fixture, không cần BE hoặc SQL Server trên CI. QA lưu dữ liệu thật cần BE5000 và tài khoản local như README; không đưa credentials vào fixture.

## CI đã đạt

Source `8ac71e00a8a62196d4b71addec6b148489982859` đã push lên `main`. [Run 39461384076](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39461384076) hoàn tất thành công: cài dependency từ lockfile, format/lint, 34 kiểm tra import và quy tắc màn/style, 141 unit tests / 22 files, production build và 24 browser tests (2,8 phút, không retry hoặc bỏ qua). Report/trace được lưu làm artifact của run.

CI dùng Windows, Node 24.19.0, API fixture và license rỗng; không dùng SQL Server hay credentials local. Bằng chứng lưu SQL Server là lượt QA local đã ghi ở trên. Commit tài liệu sau source này dùng `[skip ci]`; không thay source hoặc baseline đã kiểm tra. CI cũ trong các báo cáo content demo giữ làm lịch sử.
