# Kiểm chứng quản trị phân quyền theo nhóm — 2026-10-21

Source: working tree FE trên `8279975`, BE trên `ddb52fb`, gồm thay đổi grouped authorization chưa commit. Các thay đổi Orders trước đó được giữ. Đây là bằng chứng local cho installation SQL Server đang chạy trên máy phát triển.

## Kết quả

- FE: `run.ps1 check` PASS: Prettier, ESLint, 43 architecture probes, 178 unit tests và production build. `run.ps1 test:e2e` PASS 92/92: desktop/tablet × light/dark, gồm 28 ca hệ thống mới và 64 ca hồi quy.
- BE: 19 ca Permission/Foundation/FreshBaseline/GroupedAuthorization trên SQL Server đã qua, gồm fresh/upgrade bảo toàn grant, group CRUD/FK/version/replay, inactive assignment và luồng HTTP cấp/gán/thu hồi quyền. Migration PostgreSQL và SQL review đã tạo, không chạy PostgreSQL theo lựa chọn của người dùng.
- Browser fixture: 92/92 đã qua; route `/admin` chọn đúng mục được phép (kể cả chỉ có quyền hệ thống), màn vai trò, lọc/bulk/indeterminate, giữ draft/conflict, role creation/user assignment, group dialog/keyboard, chặn non-CentralAdmin và cấu hình Function/Action; desktop/tablet × light/dark.
- Browser với API/database SQL Server thật: tạo database `boilerate_test_*` bằng FoundationDatabase, seed hai tài khoản ngẫu nhiên; chạy FE production qua proxy tạm cùng origin. Tạo QA Reviewer từ UI → cấp Category.View → gán tài khoản → đăng nhập tài khoản đó → mở Categories, không có menu hệ thống → thu hồi grant bằng UI quản trị → reload tài khoản về forbidden. Không có page error. Host và database tạm đã dừng/xóa; file phiên chứa mật khẩu ngẫu nhiên đã được xóa.
- Database ứng dụng SQL Server: đã áp dụng migration `20261021042258_GroupedAuthorization` vào `NGUYENVANVUONG\\SQLEXPRESS/BoilerateDevelopment`; `--preflight` PASS với 4 nhóm, 20 chức năng, 19 action, 54 grant và 0 cặp grant không hợp lệ. Không chạy PostgreSQL theo lựa chọn của người dùng.
- Runtime sau migration: BE đang chạy `http://localhost:5000` với `/health/live=200`, `/health/ready=200`; FE Angular đang chạy `http://localhost:4200`. `GET /api/personal/authorization` trả 401 khi chưa đăng nhập (endpoint đã được map); `/admin/system/roles` trả shell FE 200 để đăng nhập kiểm tra.

## Tái hiện và giới hạn

FE: `run.ps1 check`, `run.ps1 test:e2e`. BE: `dotnet test tests/Boilerate.Tests/Boilerate.Tests.csproj --filter "FullyQualifiedName~GroupedAuthorizationTests&DisplayName~mssql|FullyQualifiedName~FoundationIntegrationTests&DisplayName~mssql|FullyQualifiedName~FreshBaselineMigrationTests&DisplayName~mssql|FullyQualifiedName~PermissionTests"`. Test fixture chỉ tạo/xóa database có prefix được bảo vệ, không dùng database ứng dụng.

Raw logs/ảnh local trong `artifacts/` (ignore). Ảnh UI fixture được xem ở light/dark; live SQL Server có ảnh role light và trạng thái bị thu hồi dark. Không xác nhận license vendor hoặc production deployment từ những kết quả này. Mobile không nằm trong gate hiện tại. Script migration vẫn được giữ để review/redeploy tại môi trường khác; database ứng dụng hiện đã ở migration mới.

Kiểm cuối: hai repo `git diff --check` qua; SQL Server EF model không có pending changes so với migration mới. Các link local trong hồ sơ mới đã được kiểm tra. Không stage/commit; database ứng dụng đã được thay đổi theo yêu cầu vận hành của người dùng.
