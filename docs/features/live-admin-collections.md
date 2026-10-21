# Quản lý Collections

FE đã có sáu màn danh sách và thêm/sửa, gọi API qua service. [Báo cáo tích hợp hiện tại](../verification/2026-10-21-codebase-foundation.md) lưu bằng chứng của mốc source đã kiểm tra; khả năng chạy với BE phụ thuộc đúng phiên bản hợp đồng dưới đây.

## Phạm vi hiện tại

| Màn dưới `/admin/collections` | Khả năng                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `products`                    | Tìm kiếm, phân trang, chọn dòng, xem/tạo/sửa sản phẩm và đổi trạng thái; SKU/giá/tồn của sản phẩm đã có chỉ xem |
| `categories`                  | Danh sách, tạo/sửa và xóa kèm version                                                                           |
| `product-types`               | Danh sách, xem/tạo/sửa loại sản phẩm và schema thuộc tính; chưa có thao tác xóa                                 |

Mỗi phần có route `new` và `:id` cho màn thêm/sửa. Lưu chỉ báo thành công sau phản hồi server; lỗi/409 giữ nội dung đang nhập. Dirty guard xác nhận trước khi rời màn. Gallery là khu thử control riêng, không cung cấp dữ liệu cho Collections.

## Hợp đồng API mà FE sử dụng

- [ProductsService](../../src/app/services/products.service.ts): `POST products/search`, `POST products`, `GET/PUT products/{id}` và `POST products/{id}/status`. Lookup lấy từ `GET categories`, `GET product-types` và `GET product-types/{id}`.
- [CategoriesService](../../src/app/services/categories.service.ts): `GET/POST categories`, `PUT/DELETE categories/{id}`; DELETE gửi version trong query.
- [ProductTypesService](../../src/app/services/product-types.service.ts): `GET/POST product-types`, `GET/PUT product-types/{id}`.
- Catalog pagination dùng `items/total/pageNumber/pageSize`, trang bắt đầu từ 1. Product/type version và các giá trị enum/field phải theo DTO của service; không dùng DTO demo hoặc pagination Identity để thay thế.
- Đăng nhập và refresh theo [hợp đồng browser session](persistent-session.md). Interceptor chỉ gắn bearer trong API base, retry tối đa một lần sau refresh nếu vẫn cùng user; không tự retry mutation sau lỗi mạng hoặc 409.

BE sibling đã fast-forward tới `9e5b410`, có Catalog và browser session tương ứng. Contract đã được đối chiếu controller, DTO, validators và permission manifest; API public giữ nguyên.

## Source và giới hạn

[Routes](../../src/app/features/collections/collections.routes.ts) trỏ trực tiếp tới danh sách và màn `-io`. Cấu trúc component/store/service theo [coding rules](../coding-rules.md), style theo [SCSS chung](../scss-rules.md); không duy trì một bộ quy tắc riêng cho feature.

BE quyết định authorization cuối cùng. FE đã có route/menu/action/store permission checks, editor chỉ xem khi thiếu quyền sửa và trang từ chối truy cập. Chỉnh giá/tồn/SKU của sản phẩm đã có, tối ưu mobile và deployment chưa thuộc mốc này.

## Quyền và trạng thái danh sách

Product dùng View/Create/Update/Publish; Category dùng View/Create/Update/Delete; ProductType dùng View/Create/Update, đều có tiền tố `Permissions.` theo BE. Route new kiểm Create, list và :id kiểm View; menu lọc View. Nút ghi và store kiểm đúng quyền từng action. Editor thiếu Update khóa controls; không cấp quyền fallback khi permission rỗng/lỗi. `/admin` chọn nhóm đầu được View hoặc `/admin/forbidden`; vẫn đăng xuất được. Product lookup chịu cả quyền Category/ProductType ở BE, bị từ chối sẽ báo lỗi load.

Products giữ `q`, `status`, `page`, `pageSize` trong URL; Categories và ProductTypes giữ `q`, `page`. Query sai về mặc định; page vượt tổng được sửa về trang cuối một lần. Đổi filter về trang 1. Mở editor/Back giữ query; browser Back/Forward phục hồi từ URL. Đổi nhóm bắt đầu state riêng; selection chỉ tồn tại trong màn.

Save trả Observable chỉ phát DTO khi thành công. Tránh submit lặp, dùng version và request generation/revision; giữ chỉnh sửa mới khi response cũ về. Validation có lỗi field và summary cho lỗi chưa map; thuộc tính động map theo snapshot request và ID. Lỗi mạng/403/409 giữ draft, không tự retry mutation. Ba editor dùng chung confirmation UI/controller, hủy pending khi destroy và chặn rời lúc đang lưu.
