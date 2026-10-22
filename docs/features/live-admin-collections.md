# Quản lý Collections

FE đã có sáu màn danh sách và thêm/sửa, gọi API qua service. [Báo cáo tích hợp hiện tại](../verification/2026-10-21-codebase-foundation.md) lưu bằng chứng của mốc source đã kiểm tra; khả năng chạy với BE phụ thuộc đúng phiên bản hợp đồng dưới đây.

## Phạm vi hiện tại

### Catalog workspace — đã triển khai local

Danh sách compact có toolbar, filter/sort server, thumbnail/type/version/thời điểm cập nhật và bulk status; editor giữ rail sản phẩm ở desktop, panel overlay có focus trap trên tablet. Một lần lưu editor ghi content/options/SKU/giá/default/gallery qua `PUT /api/products/{id}/editor`; upload/preview ảnh dùng quyền và URL blob có xác thực. Categories hiển thị số sản phẩm và mở danh sách đã lọc; nhân bản tạo Draft với identity mới. Giữ Product/SKU ID và nghiệp vụ hiện có; Published save có hiệu lực ngay. CSV làm sau catalog. Theo dõi phối hợp tại [hồ sơ dùng chung](../../../Boilerate/docs/shared/features/catalog-workspace.md). Mock/E2E local đã kiểm; nghiệm thu deployment ghi riêng ở BE.

### Vận hành SKU và tồn

Mục tiêu là để chủ shop tạo sản phẩm nhiều lựa chọn, đặt giá từng SKU và nhập hàng bán được qua web. Giữ desktop/tablet, cả hai theme và SQL Server làm phạm vi kiểm chứng hiện tại.

Đã có source tạo options/SKU, editor SKU/giá/mặc định và nhãn lựa chọn, tồn vật lý theo sản phẩm cùng điều chỉnh/ledger, tồn số Unique/Shared theo quyền riêng. Unit/form/service/store và browser desktop/tablet × Light/Dark đã qua; xem [báo cáo nghiệm thu hiện tại](../verification/2026-10-21-admin-orders.md).

Tiêu chí: giữ ID biến thể/tổ hợp không đổi, SKU chỉ là nội dung tùy chọn; dùng Product.version cho Catalog/tồn số và Inventory.version cho điều chỉnh vật lý; giữ draft sau lỗi, retry điều chỉnh giữ nguyên snapshot+operation ID; chặn các editor ghi đồng thời; không tiết lộ nội dung số khi chưa yêu cầu Reveal. Tồn vật lý dùng filter productId/variantId được bổ sung ở BE, không quét toàn kho. Giá null được phép ở bản nháp, Price.Update kiểm độc lập Product.Create/Update.

| Màn dưới `/admin/collections` | Khả năng                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products`                    | Tìm kiếm, phân trang, xem/tạo/sửa sản phẩm; tạo options/SKU, sửa giá/trạng thái/mặc định SKU, nhãn/thứ tự lựa chọn; điều chỉnh tồn vật lý và nhập nội dung số |
| `categories`                  | Danh sách phân cấp, tìm kiếm, cùng ngữ cảnh rail/editor, tạo/sửa/xóa kèm version; xem sản phẩm được liên kết qua bộ lọc danh mục                              |
| `product-types`               | Danh sách, xem/tạo/sửa loại sản phẩm và schema thuộc tính; chưa có thao tác xóa                                                                               |

Mỗi phần có route `new` và `:id` cho màn thêm/sửa. Lưu chỉ báo thành công sau phản hồi server; lỗi/409 giữ nội dung đang nhập. Dirty guard xác nhận trước khi rời màn. Gallery là khu thử control riêng, không cung cấp dữ liệu cho Collections.

### Danh mục trong workspace

Editor theo ảnh Webflow có Basic info (Name, Slug, preview path, Description), Product search với các chip thêm/bỏ, Item details (Parent category, thứ tự, trạng thái, ID), Activity và thao tác cuối trang. Parent là trường riêng của shop. Sitemap indexing/Published/Queued to publish không có trong API hiện tại nên không hiện.

Danh sách/rail giữ phân cấp, tìm kiếm và số sản phẩm. Product membership được tìm bằng `ProductsService.search`; editor hydrate toàn bộ sản phẩm đã liên kết để giữ chip qua trang kết quả. Lưu danh mục trước, sau đó gửi delta tới `PUT /api/categories/{id}/products`; mỗi delta mang Product.Version, giữ nguyên các Category khác, giới hạn1.000 delta/lần và rollback cả batch nếu có conflict. Category dùng `Category.Update/Create`; search yêu cầu `Product.View`, gán/bỏ cần `Product.Update`. Nếu category-save thành công nhưng batch liên kết thất bại, trường danh mục đã lưu, chip chưa lưu vẫn ở form và lỗi yêu cầu đối chiếu.

Archive/tắt đặt `IsActive=false`; xóa dùng Category.Delete và BE từ chối nếu còn product/child; duplicate sinh slug mới và sao chép các link đang tải. Activity hiển thị thời điểm tạo/cập nhật từ audit fields. Product permission không thay Category permission.

Source workspace/editor đã có và production build đạt với Node24.19.0; BE Host build riêng thành công. Chưa chạy API HTTP/browser E2E hoặc nghiệm thu runtime của endpoint mới. Build solution ban đầu vướng DLL bị tiến trình Boilerate.Host đang chạy khóa; tiến trình không bị dừng, Host build được xác nhận vào thư mục temp riêng.

## Hợp đồng API mà FE sử dụng

- [ProductsService](../../src/app/services/products.service.ts): projection search/filter/sort, product content/status, lookup Catalog và editor transaction `PUT products/{id}/editor`; legacy variant/option/default endpoints vẫn giữ; `GET inventory?productId=...`, adjustment/ledger; digital inventory theo variant cùng import/shared-content/availability/reveal. Media upload/preview dùng [MediaService](../../src/app/services/media.service.ts). Wire contract lấy từ source BE và [Commerce API](../../../Boilerate/docs/backend/commerce-api.md).
- [CategoriesService](../../src/app/services/categories.service.ts): `GET/POST categories`, `PUT/DELETE categories/{id}` và `PUT categories/{id}/products` với versioned product-membership delta; DELETE gửi category version trong query.
- [ProductTypesService](../../src/app/services/product-types.service.ts): `GET/POST product-types`, `GET/PUT product-types/{id}`.
- Catalog pagination dùng `items/total/pageNumber/pageSize`, trang bắt đầu từ 1. Product/type version và các giá trị enum/field phải theo DTO của service; không dùng DTO demo hoặc pagination Identity để thay thế.
- Đăng nhập và refresh theo [hợp đồng browser session](persistent-session.md). Interceptor chỉ gắn bearer trong API base, retry tối đa một lần sau refresh nếu vẫn cùng user; không tự retry mutation sau lỗi mạng hoặc 409.

Contract Catalog và browser session đã được đối chiếu với controller, DTO, validators và permission manifest. PUT editor hỗ trợ `addedOptions` tùy chọn; client cũ tiếp tục dùng được.

## Source và giới hạn

[Routes](../../src/app/features/collections/collections.routes.ts) trỏ trực tiếp tới danh sách và màn `-io`. Cấu trúc component/store/service theo [coding rules](../coding-rules.md), style theo [SCSS chung](../scss-rules.md); không duy trì một bộ quy tắc riêng cho feature.

BE quyết định authorization cuối cùng. FE có route/menu/action/store permission checks, editor chỉ xem khi thiếu quyền sửa và trang từ chối truy cập. Tối ưu mobile và deployment được theo dõi riêng.

## SKU, lựa chọn và tồn

### Editor theo Webflow (2026-10-22)

Giữ nguyên icon rail, nav CMS và rail sản phẩm/search/phân trang. Editor dùng control24px, option32px, header34px, row53px; semantic tokens riêng cho surface/field/border/accent cả hai theme, scope trong catalog-product-editor. Chi tiết style tại DESIGN.md.

Option thu gọn tên/giá trị; mở tên bên trái, chip bên phải, Hủy/Xong/trash. Enter/Tab thêm, double-click/menu đổi tên, menu/Backspace xóa. Xong tự tạo tổ hợp; không có nút generate hoặc ô mã kỹ thuật. Ba nhóm/50 biến thể, giữ dữ liệu cũ trên50. Mã type/field/choice/option/value tự sinh, không có control nhập mã.

Bảng đúng thứ tự Ảnh → các option → Số lượng → SKU → Giá → Giá so sánh, click dòng mở inline. Hoàn tác trả về snapshot lúc mở, Đóng giữ trong bản nhập chung; chỉ Lưu ghi cấu hình vào DB. Có ảnh chính/bổ sung, giá/compare, SKU tùy chọn và có thể trùng, tracking/quantity và kích thước vật lý. Default dùng ID và dấu sao. Legacy gallery chưa gán được đưa về variant mặc định khi mở; save chỉ giữ ảnh các variant còn tham chiếu, tránh ảnh đã xóa xuất hiện lại.

POST/PUT gửi configuration đầy đủ bằng UUID; ID tạm mới ổn định, response map thành ID thật. Tổ hợp không đổi giữ controls/ID/nội dung; mới kế thừa default với quantity0. Xóa giá trị đã lưu bỏ tổ hợp liên quan; xóa trục tái tạo từ default, bỏ hết trục trở về đơn. Duplicate giữ SKU/ảnh/giá nhưng ID mới và tồn0. Footer chứa archive/delete/duplicate; Product.Delete là soft lifecycle, không xóa lịch sử đơn/kho.

Quantity đích và tracking được lưu chung với Product/Type/Inventory version và operation ID. Không dưới số reserved; ∞ khi tắt tracking. Price.Update/Inventory.Adjust vẫn độc lập. Kho số/reveal tiếp tục endpoint riêng và không lưu nội dung bí mật ở browser storage.

Đã nghiệm thu UI local trên database thật: tạo SKU trống, hai nhóm2×2, SKU trùng, giá/compare, ảnh chính/phụ, Hoàn tác/Đóng, default, tồn12/∞; lưu/reload từng nhóm. Đổi nhãn giữ nội dung. Bản sao thử đã xóa giá trị/trục/toàn bộ trục, trở về sản phẩm đơn, lưu trữ và xóa. Build/lint và hồi quy tập trung được chạy cho phiên bản này; không dùng thống kê 200/242 test của bản trước thay cho nghiệm thu UI. PostgreSQL chưa chạy migration/integration mới.

Tồn số dùng DigitalInventory.View/Import/Update/Reveal, không dùng adjustment vật lý. Unique nhập từng nội dung có mã riêng; Shared thay nội dung dùng chung và trạng thái cung cấp. List chỉ metadata; Reveal mới nạp nội dung, không lưu vào browser storage, và xóa vùng hiển thị khi đóng/rời trình sửa. Reserved/Delivered không thể đổi availability. Gia hạn thủ công không có số dư kho.

## Quyền và trạng thái danh sách

Product dùng View/Create/Update/Publish/Delete; Category dùng View/Create/Update/Delete; ProductType dùng View/Create/Update, đều có tiền tố `Permissions.` theo BE. Route new kiểm Create, list và :id kiểm View; menu lọc View. Nút ghi và store kiểm đúng quyền từng action. Editor thiếu Update khóa controls; không cấp quyền fallback khi permission rỗng/lỗi. `/admin` chọn nhóm đầu được View hoặc `/admin/forbidden`; vẫn đăng xuất được. Product lookup chịu cả quyền Category/ProductType ở BE, bị từ chối sẽ báo lỗi load.

Products giữ `q`, `status`, `page`, `pageSize` trong URL; Categories và ProductTypes giữ `q`, `page`. Query sai về mặc định; page vượt tổng được sửa về trang cuối một lần. Đổi filter về trang 1. Mở editor/Back giữ query; browser Back/Forward phục hồi từ URL. Đổi nhóm bắt đầu state riêng; selection chỉ tồn tại trong màn.

Save trả Observable chỉ phát DTO khi thành công. Tránh submit lặp, dùng version và request generation/revision; giữ chỉnh sửa mới khi response cũ về. Validation có lỗi field và summary cho lỗi chưa map; thuộc tính động map theo snapshot request và ID. Lỗi mạng/403/409 giữ draft, không tự retry mutation. Ba editor dùng chung confirmation UI/controller, hủy pending khi destroy và chặn rời lúc đang lưu.
