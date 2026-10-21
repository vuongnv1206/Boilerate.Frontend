# Admin Orders — workspace quản trị đơn hàng

Ngày bắt đầu: 2026-10-21  
Cập nhật gần nhất: 2026-10-21  
Trạng thái: Chờ nghiệm thu runtime  
Khu vực phụ trách: FE  
Hồ sơ BE: [Admin Orders](../../../Boilerate/docs/backend/features/admin-orders.md)  
Bằng chứng FE: [verification report](../verification/2026-10-21-admin-orders.md)

## Phạm vi đã triển khai

Module nằm tại `/admin/orders` và `/admin/orders/:id`, dùng cùng workspace admin:

- Navigation chỉ hiện khi có `Permissions.Order.View`.
- List gọi server-side query với `q`, `status`, `paymentStatus`, `fulfillmentStatus`, `createdFrom`, `createdTo`, `page`, `pageSize`; đổi filter reset page 1 và giữ query trong URL.
- Cột list gồm mã đơn, người nhận, tổng tiền, payment method/status, fulfillment status, order status, ngày tạo và hết hạn.
- Detail giữ rail/context, có header/status/action bar, inspector và snapshot OrderItem read-only.
- Command đã nối: cancel, confirm payment, retry fulfillment. Không có `/new`, Edit, inline edit hoặc bulk action.
- Timeline gọi history endpoint read-only; không hiển thị raw audit JSON hoặc digital delivery content.
- Shipping/After-sales/Renewal chỉ là section read-only/collapsed; Shipping và After-sales gọi API riêng khi có capability, lỗi/403 của section không làm hỏng toàn detail.

## Invariant FE

> Order/OrderItem snapshot sau checkout không có đường chỉnh sửa; chỉ lifecycle command hợp lệ được phép thay đổi state.

- Không render nút Edit hoặc form chỉnh Order.
- Mutation control kiểm capability và state hiện tại; state không hợp lệ thì disabled kèm lý do, thiếu permission thì không render.
- Request luôn dùng version hiện tại hoặc contract command tương ứng.
- `409 Conflict` giữ màn hiện tại, báo dữ liệu đã thay đổi và reload DTO một lần; không tự gửi lại command và không optimistic update.

## Kiến trúc source

| Trách nhiệm                              | Source                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| DTO/enum/permission/label                | `src/app/models/order.dto.ts`, `src/app/constants/order.constants.ts` |
| API client                               | `src/app/services/orders.service.ts`                                  |
| List query/pagination                    | `src/app/utils/order-query.util.ts`, `src/app/stores/orders.store.ts` |
| Detail/command/conflict/related sections | `src/app/stores/order-detail.store.ts`                                |
| Routes/screens                           | `src/app/features/orders/`, `src/app/app.routes.ts`                   |
| Workspace styling                        | `src/styles/admin/_orders.scss`                                       |

Services chỉ gọi `ApiClient`; stores sở hữu request/loading/error state; component không tự gọi API.

## Trạng thái kiểm chứng

- Prettier check: pass.
- ESLint và architecture checks: pass, 43 boundary/screen/style checks.
- Angular build bằng bundled Node 24.19.0: pass, tạo lazy chunks cho Orders list/detail.
- Unit tests: 26 files, 167/167 pass.
- Chưa chạy authenticated browser E2E với backend đang seed, chưa xác nhận Light/Dark/System bằng browser thật, và chưa đánh dấu deployment/production acceptance.

## Công việc tiếp theo

- Nối môi trường BE có dữ liệu seed và chạy E2E list/detail/back-forward/filter/command/409/permission.
- Bổ sung test FE cho query parser, 409 giữ dialog draft và section-level 403 nếu contract testing yêu cầu.
- Xác nhận Light/Dark/System, responsive workspace và empty/error/loading/retry trên browser.
- Các action Shipping/After-sales/Renewal mutation vẫn là lát sau, không thêm vào detail lát đầu.
