# Gia hạn thủ công trong workspace quản trị

Ngày bắt đầu: 2026-10-21  
Cập nhật gần nhất: 2026-10-21  
Trạng thái: Đã triển khai; unit và production build đã kiểm tra  
Contract BE: [Manual Renewals](../../../Boilerate/docs/backend/features/manual-renewals.md)  
Bằng chứng nghiệm thu hiện tại: [Admin Orders và các module liên quan](../verification/2026-10-21-admin-orders.md)

## Phạm vi

Route `/admin/renewals` có danh sách lọc trạng thái, phân trang qua query URL và chi tiết `/admin/renewals/:id`. Detail hiển thị snapshot, lần xử lý và history. Hành động gồm claim/release, bắt đầu xử lý và xác minh kết quả. Nhân viên thực hiện công việc với nhà cung cấp ngoài hệ thống; FE không tự gọi dịch vụ gia hạn.

## Quyền và dữ liệu nhạy cảm

- `Renewal.View` bảo vệ route, danh sách và detail; `Order.View` bảo vệ liên kết về đơn.
- `Renewal.Process` kiểm claim, release và start. `Renewal.Verify` kiểm xác minh kết quả và xem bằng chứng; `Renewal.Reveal` cho phép mở định danh tài khoản theo yêu cầu.
- Target và evidence chỉ tải khi người vận hành bấm xem. Rời/mở lại detail sẽ xóa dữ liệu vừa reveal khỏi state màn hình.
- Quyết định quyền cuối cùng thuộc BE. Target/evidence được mã hóa và audit theo contract BE; FE không lưu các nội dung này vào storage.

## Retry và xác minh

- Claim/start/verify gửi version hiện tại cùng operation ID. Khi mất response, nút gửi lại dùng nguyên request snapshot; FE không tự tạo thao tác mới hay optimistic update.
- `409 Conflict` tải lại trạng thái để đối chiếu. PendingVerification không được claim lại sau hết lease vì hành động bên ngoài có thể đã xảy ra.
- Verify yêu cầu ghi chú; nếu đánh dấu đã áp dụng thì cần nhập hạn mới trong tương lai. Kết quả chưa áp dụng lưu là một lần thử riêng và request trở về Ready theo BE.
- Dirty guard và beforeunload giữ ghi chú/bằng chứng chưa lưu trước khi rời màn.

## Source

| Trách nhiệm                | Source                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Contract DTO và trạng thái | `src/app/models/renewal.dto.ts`                                                                         |
| API client                 | `src/app/services/renewals.service.ts`                                                                  |
| List/detail/state/replay   | `src/app/features/renewals/`, `src/app/stores/renewals.store.ts`                                        |
| Navigation, route và style | `src/app/constants/navigation.constants.ts`, `src/app/app.routes.ts`, `src/styles/admin/_renewals.scss` |

Service chỉ gọi `ApiClient`; store giữ tải dữ liệu, trạng thái command và lỗi; component sở hữu draft người dùng.
