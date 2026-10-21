# Kiểm chứng nền Collections và tích hợp — 21/10/2026

Source: FE baseline `4cda109a19e8880b125471fffabf64382f9b9748` cùng working tree của đợt chuẩn hóa này (chưa commit); BE main đã fast-forward tới `9e5b41066e04cae836de0b7af323f77e408c654b`. BE chỉ chỉnh tài liệu điều hướng/quy trình; Catalog và API public không đổi. [Rulebook](../coding-rules.md), [Collections](../features/live-admin-collections.md) và [browser session](../features/persistent-session.md) sở hữu cách triển khai/hành vi hiện tại.

Windows, Node 24.19.0, Angular 22.2.3, PrimeNG 22.1.2, .NET SDK 10.0.401, Chromium theo Playwright 1.64.1. Dependencies FE cài theo lockfile/npm 12.2.0; BE restore locked. Không đổi package lock hoặc runtime đã pin.

| Phạm vi                   | Kết quả                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE `run.ps1 check`        | Format, lint, 43 architecture probes, 167 unit tests / 26 files và production build đạt                                                                   |
| Browser API fixture       | 64/64 đạt: desktop 1440×900 và tablet 1024×768, light/dark; không cập nhật baseline ảnh                                                                   |
| API thật + SQL Server     | Bốn cấu hình desktop/tablet × light/dark đạt: login, lists, tạo/lưu/publish/reload product (giá 0), tạo/sửa/xóa category có version, tạo/sửa product type |
| BE regression có chọn lọc | BrowserSession, DevelopmentSeeding và nhóm Catalog trên SQL Server: 26 đạt, 1 recovery runtime bị skip; không tuyên bố toàn bộ suite BE đã chạy           |
| CI                        | Giữ FE chạy độc lập bằng fixture; chưa tạo/push commit hoặc chạy CI cho working tree này                                                                  |

Unit bảo vệ query parsing/restoration, permission route/menu/handler/store, readonly cả ba editor, validator/error summary, snapshot field/choice mapping, duplicate save, stale response, revision khi sửa tiếp và confirmation destroy. Browser fixture còn kiểm dirty guard, 403/409 giữ draft, query editor/Back và browser Back, query sai/page vượt tổng, delete, overlays/focus, reload/cookie và hai tab.

## Database development thật

Theo lựa chọn của người dùng, đã tạo **BoilerateDevelopment trên SQLEXPRESS local**; áp đủ tám migrations InitialFoundation → RefundsReturns, bootstrap admin và chạy `--seed-dev` qua use cases sẵn có. Seed gốc gồm 14 products, 2 product types và 6 categories. Các record tiền tố QA được tạo thêm trong khi kiểm chứng; đây là dữ liệu development thật, không phải fixture của FE.

`BoilerateDb` cũ dùng bộ migrations tháng 4 không có đường upgrade trực tiếp sang baseline mới. Database đó được giữ nguyên; kiểm tra sau đợt chạy vẫn có 7 migration cũ. Không sửa quyền, seed hay migrate lên database cũ.

API chạy tại `http://localhost:5000`, FE dev proxy `/api` từ `http://localhost:4200`. Connection/JWT key giữ trong .NET User Secrets; credential thật của admin được lưu Windows DPAPI ngoài Git. Hướng dẫn local và script khởi động ở `Boilerate/artifacts/development/README.md`, `start.ps1`; FE không đưa credential vào source hoặc public runtime config.

## Tái kiểm tra

- FE: `run.ps1 install`, `run.ps1 check`; build với `PRIMEUI_LICENSE_KEY` rỗng, `API_BASE_URL=/api`, rồi `run.ps1 test:e2e`.
- Fixture nằm trong `e2e/helpers`, không gọi database thật. Playwright tự mở production preview port 4300; dev vẫn ở 4200.
- API thật: khởi động BE Development với cấu hình database riêng đã migrate/bootstrap/seed. Login rồi đi Products → new/edit/status/reload; Categories → new/edit/delete; ProductTypes → new/edit. Dùng browser desktop/tablet và cả hai theme. Raw local runner, screenshots và kết quả nằm ở `artifacts/codebase-foundation/` của FE; logs migration/bootstrap/seed của BE ở ignored artifacts.
- BE đã chạy `dotnet test tests/Boilerate.Tests --no-build --no-restore --filter '(FullyQualifiedName~BrowserSessionTests|FullyQualifiedName~DevelopmentSeedingTests|FullyQualifiedName~Catalog)&DisplayName!~postgresql'`. Provider fixtures tạo và dọn database riêng có prefix `boilerate_test_`; không trỏ test suite vào database đang dùng.

Giới hạn: PostgreSQL chưa cấu hình cho đợt này; recovery runtime, mobile, deployment/HTTPS, external adapters và review thiết kế của người dùng chưa nghiệm thu. QA build để license rỗng có watermark vendor; không xác nhận license. Bằng chứng fixture, SQL Server thật và deployment là các phạm vi riêng.
