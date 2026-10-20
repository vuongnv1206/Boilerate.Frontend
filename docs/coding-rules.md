# Quy tắc code Angular

Chốt ngày 20/10/2026: code dễ tìm, ít tầng, tên đơn giản. Quy tắc này thay cấu trúc `content/pages/components` cũ.

```text
src/app/
  constants/
  enums/
  models/
  services/
  stores/
  forms/
  guards/
  core/
  layout/
  shared/ui/
  features/
    collections/
      collections.routes.ts
      products/
        products.ts
        products.html
        product-io/
          product-io.ts
          product-io.html
      categories/
        categories.ts
        categories.html
        category-io/
          category-io.ts
          category-io.html
      product-types/
        product-types.ts
        product-types.html
        product-type-io/
          product-type-io.ts
          product-type-io.html
```

1. **Đặt file đúng chỗ.** `constants`, `enums`, `models`, `services`, `stores`, `forms`, `guards` nằm ngang cấp `features`. Không tạo lại chúng dưới từng màn/module. Tên file chỉ rõ chức năng: `category.constants.ts`, `category.dto.ts`, `categories.service.ts`, `category-io.store.ts`. Import bằng `@constants/…`, `@models/…`, `@services/…`, `@stores/…` để dùng từ nhiều màn.
2. **Giữ component gọn về cấu trúc.** Danh sách mang tên chức năng; thêm/sửa dùng `-io`. Toolbar, bảng, form và inspector nhỏ viết ngay trong màn. Không tách component chỉ để chia vài dòng HTML. Chỉ tạo component dùng chung khi có chỗ dùng thật; đặt ở `shared/ui`.
3. **Form thuộc màn.** Màn thêm/sửa khai báo `form` và chứa HTML form. Typed form/validation/mapping thuần có thể dùng lại từ `forms`; store nhận form do màn tạo. Không tạo `category-form` hoặc `product-form` component chỉ để bọc form.
4. **Tên dễ hiểu.** File/folder kebab-case; class/type PascalCase; biến/hàm camelCase. Không bắt buộc hậu tố `Component`. Dùng tên như `load`, `save`, `search`, `setPage`, `confirmLeave`. Enum, interface và options dùng chung nằm ngoài component.
5. **Code theo thứ tự.** Imports Angular → RxJS/PrimeNG → core/shared → constants/enums/models/store. Trong class: dịch vụ → dữ liệu/form → constructor → hàm xử lý → hàm riêng. Dùng `readonly` khi không gán lại; khai báo return type của method.
6. **Giữ Angular hiện tại.** Standalone, strict types, signals/computed cho state, RxJS cho async. `imports` chỉ chứa control/directive HTML dùng; không gom mọi PrimeNG module vào một `SharedModule`. Subscription có cleanup bằng `takeUntilDestroyed` hoặc cơ chế tương đương.
7. **Một đường gọi API.** Component → store → service → `core/http/ApiClient`. Service biết endpoint/DTO; base HTTP không giữ state màn hoặc đổi URL dùng chung bằng `setUrl`. Không thêm base CRUD/facade/wrapper chỉ để mọi file giống nhau.
8. **Store có việc và có owner.** Store màn cung cấp ở màn; service theo route. Public signals chỉ đọc. Hủy load cũ, chặn lưu lặp và giữ bản đang nhập khi lỗi/409. Không biến mọi store thành singleton hoặc tạo store chỉ chuyển tiếp service.
9. **Theo đúng BE.** Wire enum giữ đúng giá trị BE. Catalog dùng `items/total/pageNumber/pageSize`, trang từ 1. Không đoán endpoint, giả thao tác đã lưu, tự retry mutation sau lỗi mạng hoặc toast mọi lỗi ở global HTTP.
10. **SCSS và kiểm tra có mục đích.** Theo [SCSS chung](scss-rules.md). Không tự tạo `.scss`/`.spec.ts` cho mỗi component; generator đặt `style: none`, `skipTests: true`. Test HTTP, store, validation/mapping có logic và luồng browser. Hoàn tất khi source đã nối route thật, code cũ được bỏ, checks/build/browser phù hợp đã chạy và có kết quả rõ.

Đã đọc [RoleComponent](https://github.com/vuongnv1206/eco-fe/blob/dev/eco/src/app/system/role/role.component.ts) và RoleDetail: màn nằm trực tiếp trong folder, dùng model/store/constants ở ngoài, form gắn với màn thêm/sửa. Áp dụng cách tổ chức đó cùng strict types, standalone, signals và cleanup của Angular hiện tại. Không sao chép `any`, subscription thiếu cleanup hoặc delay UI cố định từ mẫu.
