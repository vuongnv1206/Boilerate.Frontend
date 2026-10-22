# Admin Orders — workspace quản trị đơn hàng

- **Ngày bắt đầu:** 2026-10-21
- **Cập nhật:** 2026-10-22
- **Trạng thái:** Nghiệp vụ đơn hàng đã nghiệm thu FE local; workspace rail vừa được mở rộng, chưa nghiệm thu lại hoặc nghiệm thu deployment
- **Khu vực:** FE
- **Hồ sơ BE:** [Admin Orders](../../../Boilerate/docs/backend/features/admin-orders.md)
- **Bằng chứng nghiệm thu:** [báo cáo kiểm chứng](../verification/2026-10-21-admin-orders.md)

## Phạm vi đã triển khai

Module nằm tại `/admin/orders` và `/admin/orders/:id`, dùng cùng workspace admin:

- Navigation chỉ hiện khi có `Order.View`.
- List gọi server-side query với `q`, `status`, `paymentStatus`, `fulfillmentStatus`, `createdFrom`, `createdTo`, `page`, `pageSize`; đổi filter reset page 1 và giữ query trong URL.
- Cột list gồm mã đơn, người nhận, tổng tiền, payment method/status, fulfillment status, order status, ngày tạo và hết hạn.
- Detail giữ rail/context, có header/status/action bar, inspector và snapshot OrderItem read-only.
- Command gồm cancel, confirm payment, retry fulfillment, dispatch vật lý từng phần và xác nhận shipment đã giao. Không có `/new`, Edit, inline edit hoặc bulk action.
- Timeline gọi history endpoint read-only; không hiển thị raw audit JSON hoặc digital delivery content.
- Shipping đọc shipment và các dòng đã xuất; quyền `Shipping.View`, `Shipping.Dispatch`, `Shipping.Deliver` được kiểm riêng. Dispatch dùng số còn lại, shipment version và operation ID ổn định. Giao shipment không tự xác nhận COD.
- After-sales đọc ledger refund/return độc lập và ghi khoản hoàn thực tế hoặc hàng nhận thực tế. Đây là command append-only; FE không chuyển tiền và không sửa snapshot Order/OrderItem.

## List rail cạnh chi tiết

Khi mở một đơn, workspace giữ trang, filter và từ khóa hiện tại ở rail để chuyển sang đơn khác mà không rời ngữ cảnh. Rail hiển thị mã, người nhận, trạng thái, tổng tiền và ngày tạo; tìm kiếm/phân trang cập nhật query trên URL. Sau command thành công, nếu đơn còn trong trang đang xem, summary ở rail nhận trạng thái mới từ response của detail.

Trên tablet, rail chuyển thành panel overlay có focus trap và nút mở rõ ràng. Snapshot Order/OrderItem trong detail vẫn chỉ đọc; không có tạo/sửa/xóa đơn hoặc bulk action.

## Invariant FE

> Order/OrderItem snapshot sau checkout không có đường chỉnh sửa; chỉ lifecycle command hợp lệ được phép thay đổi state.

- Không render nút Edit hoặc form chỉnh Order.
- Mutation control kiểm capability và state hiện tại; state không hợp lệ thì disabled kèm lý do, thiếu permission thì không render.
- Request luôn dùng version hiện tại hoặc contract command tương ứng.
- `409 Conflict` giữ draft, tải lại dữ liệu canonical để đối chiếu và không tự gửi lại command. Khi response không xác định, retry giữ nguyên operation ID và payload.

## Shipping

Backend có contract `POST /api/admin/orders/{id}/shipments` và `POST /api/admin/orders/{id}/shipments/{shipmentId}/deliver`; xem [hồ sơ shipping BE](../../../Boilerate/docs/backend/features/physical-shipping.md).

- Danh sách shipment hiển thị hãng/mã vận chuyển, trạng thái, thời điểm và các dòng hàng đã xuất.
- Dispatch chỉ chọn số lượng vật lý còn lại; backend quyết định cuối về tồn, trạng thái đơn và quyền.
- Retry sau mất response dùng operation ID và payload cũ; idempotency BE ngăn xuất hoặc giao lần hai.
- `409` tải lại dữ liệu hiện tại và giữ draft dialog để người vận hành đối chiếu trước thao tác tiếp theo.
- Xác nhận shipment đã giao không tự ghi nhận khoản COD.

## After-sales

Theo [contract hậu mãi BE](../../../Boilerate/docs/backend/features/refunds-returns.md), detail hiển thị ledger và có form `POST refunds`/`POST returns`:

- Hoàn tiền cần `AfterSales.View` và `Refund.Confirm`; nhập số VND nguyên đồng không vượt số đã thu còn lại, nguồn, mã chứng từ, thời điểm và lý do.
- Nhận hàng trả cần `AfterSales.View`, `Return.Receive`, `Shipping.View`; chỉ nhận phần đã xuất chưa nhận lại. `Inventory.Adjust` được kiểm riêng nếu nhập lại kho.
- Đóng phần COD chưa thu chỉ được chọn ở lần nhận cuối khi đã nhận đủ toàn bộ hàng đã xuất.
- Giữ snapshot request/operation ID sau lỗi không xác định; lỗi conflict giữ draft để đối chiếu dữ liệu mới. Lưu thành công xóa draft tương ứng.
- Refund/return là ghi nhận việc đã làm ngoài hệ thống, không tự chuyển tiền, tạo shipment, sửa OrderItem hay hoàn tác một dịch vụ gia hạn.

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

## Kiểm chứng và phần còn lại

Kết quả source, unit, browser desktop/tablet × Light/Dark và giới hạn môi trường được tổng hợp trong [báo cáo kiểm chứng](../verification/2026-10-21-admin-orders.md). Chưa nghiệm thu deployment hoặc các dịch vụ vận chuyển/ngân hàng bên ngoài. Xem thêm [Gia hạn thủ công](admin-renewals.md) cho mutation Renewal.
