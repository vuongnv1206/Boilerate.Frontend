# Content data và HTTP base — 2026-10-20

Triển khai source đầu tiên của [refactor feature](../features/content-feature-architecture.md): model/giới hạn chung, typed form factory, `ContentService` Observable contract, fixture riêng và `MockContentService` không phụ thuộc UI. Implementation được chọn qua DI; writes chỉ chạy khi subscribe, không persist ra trình duyệt. Snapshot trả về không cho phép caller sửa nguồn dữ liệu bên trong.

`ApiClient` dùng composition với HttpClient, runtime API base và interceptor đã có; cung cấp typed JSON GET/POST/PUT/PATCH/DELETE, params/headers/context và cancellation. Service feature sẽ sở hữu endpoint khi nối BE; chưa thêm endpoint giả hoặc auth/retry/toast.

Sửa duplicate tên 180 ký tự tạo tên 190 ký tự không sửa được: chừa độ dài hậu tố bản sao trong giới hạn chung của form và service. Validator cũng từ chối NaN/Infinity và tồn kho không nguyên.

Kiểm chứng local: 35 tests ở `api-client.spec.ts`, `mock-content.service.spec.ts`, `content-form.spec.ts` đạt. Kiểm tra request options, lỗi interceptor, cancellation, cold writes, immutable snapshots, counts và validation. Luồng UI/state/routes đang tích hợp ở commit kế tiếp; kết quả browser/CI được ghi sau khi chạy trên source cuối.
