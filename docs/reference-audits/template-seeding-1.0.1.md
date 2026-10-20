# Tham khảo seeding template 1.0.1 — 2026-10-20

Đã tải trực tiếp package [Boilerate.CleanArchitecture.Template 1.0.1](https://www.nuget.org/packages/Boilerate.CleanArchitecture.Template/1.0.1) từ NuGet flat-container để đọc source; không chạy `dotnet new install` hoặc thay template đang cài. Nuspec ghi repository commit `28badb22f6037243a4cb1ece447bdef0500b66c8`. Bản package/source giải nén nằm trong `artifacts/template-reference` bị ignore, không nhập vào repo.

## Quan sát từ package

- `ApplicationDbSeeder`: tạo Actions/Functions bằng reflection, ghép các cặp Action–Function, seed roles, gán permissions và tài khoản admin mặc định.
- `ICustomSeeder` + `CustomSeederRunner`: extension point chạy các seeder được đăng ký qua DI.
- `ApplicationDbInitializer`: áp dụng pending migrations rồi gọi seed nếu kết nối được DB. Host gọi initialization trong lúc startup.
- Không tìm thấy implementation `ICustomSeeder` cung cấp dữ liệu sản phẩm/danh mục/ProductType trong package này. Có hạ tầng seed, nhưng không đủ để kết luận đã có dataset Catalog phù hợp model hiện tại.

## Đối chiếu BE hiện tại và đề xuất

BE hiện tại có `FoundationBootstrap`: bootstrap admin trên Identity rỗng, đăng ký capability theo manifest và cấp quyền qua operator commands. HTTP startup không tự migrate/seed; `InitializeCommerce` chỉ tạo kho MAIN. Đây là thay đổi kiến trúc có chủ đích, không nên phục hồi toàn bộ cơ chế cũ.

Đề xuất cho mốc tích hợp là lệnh `seed-dev` riêng, chạy có chủ đích sau migration/bootstrap, với seeder theo feature, DI và thứ tự rõ ràng. Dữ liệu mẫu phải khớp ProductType/Category/Product/Variant hiện tại, có định danh ổn định và chạy lại không tạo trùng; không ghi đè dữ liệu đã chỉnh. Giữ credential ở cấu hình local, không khôi phục tài khoản/mật khẩu dùng chung từ package. SQL Server là provider local mặc định được người dùng chọn, FE chỉ truy cập qua API.

Thứ tự FE: phiên đăng nhập/quyền → loại sản phẩm/danh mục → products search/detail/edit có version. DTO thật tách khỏi `ContentItem` demo; `ProductStatus` wire là enum số, Catalog pagination là `items/total/pageNumber/pageSize`, còn Identity có PaginationResponse khác. Giá/stock/variants/categoryIds cần mapping theo API, không đổi tên fields fixture rồi gửi trực tiếp.

Trạng thái: mới khảo sát. SQL Server service `MSSQLSERVER` đang chạy; profile BE HTTP là localhost:5000 nhưng chưa chạy tại thời điểm kiểm tra. Chưa chọn database integration, chưa tạo/seed DB, chưa gọi API quản trị. Các thao tác đó không được ghi là đã hoàn tất từ việc đọc package.
