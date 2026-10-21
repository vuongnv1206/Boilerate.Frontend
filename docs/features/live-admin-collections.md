# Quản lý Collections

FE đã có sáu màn danh sách và thêm/sửa, gọi API qua service. [Báo cáo tích hợp hiện tại](../verification/2026-10-21-codebase-foundation.md) lưu bằng chứng của mốc source đã kiểm tra; khả năng chạy với BE phụ thuộc đúng phiên bản hợp đồng dưới đây.

## Phạm vi hiện tại

### Catalog workspace — đã triển khai local

Danh sách compact có toolbar, filter/sort server, thumbnail/type/version/thời điểm cập nhật và bulk status; editor giữ rail sản phẩm ở desktop, panel overlay có focus trap trên tablet. Một lần lưu editor ghi content/options/SKU/giá/default/gallery qua `PUT /api/products/{id}/editor`; upload/preview ảnh dùng quyền và URL blob có xác thực. Categories hiển thị số sản phẩm và mở danh sách đã lọc; nhân bản tạo Draft với identity mới. Giữ Product/SKU ID và nghiệp vụ hiện có; Published save có hiệu lực ngay. CSV làm sau catalog. Theo dõi phối hợp tại [hồ sơ dùng chung](../../../Boilerate/docs/shared/features/catalog-workspace.md). Mock/E2E local đã kiểm; nghiệm thu deployment ghi riêng ở BE.

### Vận hành SKU và tồn

Mục tiêu là để chủ shop tạo sản phẩm nhiều lựa chọn, đặt giá từng SKU và nhập hàng bán được qua web. Giữ desktop/tablet, cả hai theme và SQL Server làm phạm vi kiểm chứng hiện tại.

Đã có source tạo options/SKU, editor SKU/giá/mặc định và nhãn lựa chọn, tồn vật lý theo sản phẩm cùng điều chỉnh/ledger, tồn số Unique/Shared theo quyền riêng. Unit/form/service/store và browser desktop/tablet × Light/Dark đã qua; xem [báo cáo nghiệm thu hiện tại](../verification/2026-10-21-admin-orders.md).

Tiêu chí: không đổi identity SKU/tổ hợp đã tạo; dùng Product.version cho Catalog/tồn số và Inventory.version cho điều chỉnh vật lý; giữ draft sau lỗi, retry điều chỉnh giữ nguyên snapshot+operation ID; chặn các editor ghi đồng thời; không tiết lộ nội dung số khi chưa yêu cầu Reveal. Tồn vật lý dùng filter productId/variantId được bổ sung ở BE, không quét toàn kho. Giá null được phép ở bản nháp, Price.Update kiểm độc lập Product.Create/Update.

| Màn dưới `/admin/collections` | Khả năng                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products`                    | Tìm kiếm, phân trang, xem/tạo/sửa sản phẩm; tạo options/SKU, sửa giá/trạng thái/mặc định SKU, nhãn/thứ tự lựa chọn; điều chỉnh tồn vật lý và nhập nội dung số |
| `categories`                  | Danh sách, tạo/sửa và xóa kèm version                                                                                                                         |
| `product-types`               | Danh sách, xem/tạo/sửa loại sản phẩm và schema thuộc tính; chưa có thao tác xóa                                                                               |

Mỗi phần có route `new` và `:id` cho màn thêm/sửa. Lưu chỉ báo thành công sau phản hồi server; lỗi/409 giữ nội dung đang nhập. Dirty guard xác nhận trước khi rời màn. Gallery là khu thử control riêng, không cung cấp dữ liệu cho Collections.

## Hợp đồng API mà FE sử dụng

- [ProductsService](../../src/app/services/products.service.ts): projection search/filter/sort, product content/status, lookup Catalog và editor transaction `PUT products/{id}/editor`; legacy variant/option/default endpoints vẫn giữ; `GET inventory?productId=...`, adjustment/ledger; digital inventory theo variant cùng import/shared-content/availability/reveal. Media upload/preview dùng [MediaService](../../src/app/services/media.service.ts). Wire contract lấy từ source BE và [Commerce API](../../../Boilerate/docs/backend/commerce-api.md).
- [CategoriesService](../../src/app/services/categories.service.ts): `GET/POST categories`, `PUT/DELETE categories/{id}`; DELETE gửi version trong query.
- [ProductTypesService](../../src/app/services/product-types.service.ts): `GET/POST product-types`, `GET/PUT product-types/{id}`.
- Catalog pagination dùng `items/total/pageNumber/pageSize`, trang bắt đầu từ 1. Product/type version và các giá trị enum/field phải theo DTO của service; không dùng DTO demo hoặc pagination Identity để thay thế.
- Đăng nhập và refresh theo [hợp đồng browser session](persistent-session.md). Interceptor chỉ gắn bearer trong API base, retry tối đa một lần sau refresh nếu vẫn cùng user; không tự retry mutation sau lỗi mạng hoặc 409.

BE sibling đã fast-forward tới `9e5b410`, có Catalog và browser session tương ứng. Contract đã được đối chiếu controller, DTO, validators và permission manifest; API public giữ nguyên.

## Source và giới hạn

[Routes](../../src/app/features/collections/collections.routes.ts) trỏ trực tiếp tới danh sách và màn `-io`. Cấu trúc component/store/service theo [coding rules](../coding-rules.md), style theo [SCSS chung](../scss-rules.md); không duy trì một bộ quy tắc riêng cho feature.

BE quyết định authorization cuối cùng. FE có route/menu/action/store permission checks, editor chỉ xem khi thiếu quyền sửa và trang từ chối truy cập. Tối ưu mobile và deployment được theo dõi riêng.

## SKU, lựa chọn và tồn

Khi tạo sản phẩm, nhập SKU đơn hoặc thêm tối đa ba trục lựa chọn rồi tạo tổ hợp; tối đa 200 tổ hợp theo cấu hình Catalog mặc định. Mỗi tổ hợp có SKU, giá và giá so sánh riêng. Tạo lại giữ draft của tổ hợp không đổi; có thể bỏ các tổ hợp chưa bán. SKU đầu tiên là mặc định. Mã SKU/tổ hợp và các trục lựa chọn giữ nguyên sau tạo; chỉ thêm giá trị vào trục đã có. Product.Update cho phép chỉnh hoạt động/ảnh, chọn mặc định, sửa nhãn/thứ tự và thêm SKU cho tổ hợp còn thiếu. Price.Update kiểm độc lập: người không có quyền giá tạo SKU giá null; bản nháp được để trống giá. SKU active của sản phẩm Published phải có giá; phải chọn default khác trước khi ngừng default hiện tại.

Product editor có một trình sửa SKU/tồn độc lập. Khi nội dung sản phẩm dirty, cần lưu/tải lại trước khi mở trình sửa. Khi trình sửa mở, content/status bị khóa và dirty guard bao gồm draft của cả hai vùng. Mutation dùng version mới từ server; lỗi 409 giữ draft và yêu cầu tải bản canonical để đối chiếu. Lựa chọn thay đổi trong phiên nhập phải được tạo lại tổ hợp trước khi tạo sản phẩm.

Tồn vật lý hiển thị on-hand, số giữ cho đơn và khả dụng theo SKU. Inventory.View cho phép đọc số dư/ledger; Inventory.Adjust cho phép điều chỉnh delta khác không kèm lý do. Tồn mới không được nhỏ hơn số đã giữ. Mỗi yêu cầu chụp Inventory.version + operationId + delta + reason. Lỗi mạng/server chưa xác định kết quả khóa payload và rời màn cho đến khi gửi lại đúng snapshot; retry thành công không tăng/giảm lần thứ hai. Sau lỗi từ chối rõ ràng, draft được giữ để tải số dư mới rồi sửa.

Tồn số dùng DigitalInventory.View/Import/Update/Reveal, không dùng adjustment vật lý. Unique nhập từng nội dung có mã riêng; Shared thay nội dung dùng chung và trạng thái cung cấp. List chỉ metadata; Reveal mới nạp nội dung, không lưu vào browser storage, và xóa vùng hiển thị khi đóng/rời trình sửa. Reserved/Delivered không thể đổi availability. Gia hạn thủ công không có số dư kho.

## Quyền và trạng thái danh sách

Product dùng View/Create/Update/Publish; Category dùng View/Create/Update/Delete; ProductType dùng View/Create/Update, đều có tiền tố `Permissions.` theo BE. Route new kiểm Create, list và :id kiểm View; menu lọc View. Nút ghi và store kiểm đúng quyền từng action. Editor thiếu Update khóa controls; không cấp quyền fallback khi permission rỗng/lỗi. `/admin` chọn nhóm đầu được View hoặc `/admin/forbidden`; vẫn đăng xuất được. Product lookup chịu cả quyền Category/ProductType ở BE, bị từ chối sẽ báo lỗi load.

Products giữ `q`, `status`, `page`, `pageSize` trong URL; Categories và ProductTypes giữ `q`, `page`. Query sai về mặc định; page vượt tổng được sửa về trang cuối một lần. Đổi filter về trang 1. Mở editor/Back giữ query; browser Back/Forward phục hồi từ URL. Đổi nhóm bắt đầu state riêng; selection chỉ tồn tại trong màn.

Save trả Observable chỉ phát DTO khi thành công. Tránh submit lặp, dùng version và request generation/revision; giữ chỉnh sửa mới khi response cũ về. Validation có lỗi field và summary cho lỗi chưa map; thuộc tính động map theo snapshot request và ID. Lỗi mạng/403/409 giữ draft, không tự retry mutation. Ba editor dùng chung confirmation UI/controller, hủy pending khi destroy và chặn rời lúc đang lưu.
