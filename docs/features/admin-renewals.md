# Gia hạn thủ công trong workspace quản trị

- **Ngày bắt đầu:** 2026-10-21
- **Cập nhật gần nhất:** 2026-10-24
- **Trạng thái:** Đã triển khai workspace và đồng bộ state sau command; đang nghiệm thu fixture/browser với API thật trong [đợt admin](../../../Boilerate/docs/shared/features/admin-acceptance.md)
- **Contract BE:** [Manual Renewals](../../../Boilerate/docs/backend/features/manual-renewals.md)
- **Bằng chứng trước đây:** [Admin Orders và các module liên quan](../verification/2026-10-21-admin-orders.md)

## Phạm vi

Route `/admin/renewals` có danh sách lọc trạng thái, phân trang qua query URL và chi tiết `/admin/renewals/:id`. Thanh công cụ, bảng, trạng thái, phân trang và thanh tiêu đề chi tiết theo mẫu Products. Khi mở chi tiết, rail giữ bộ lọc/trang hiện tại để chuyển giữa các yêu cầu; Back và tải lại giữ query. BE chỉ có lọc theo trạng thái/trang, vì vậy không hiển thị ô tìm kiếm không được API hỗ trợ. Detail hiển thị snapshot, các lần gia hạn và lịch sử. Hành động gồm nhận xử lý/nhận lại khi hết thời hạn, trả yêu cầu về hàng chờ, bắt đầu một lần gia hạn và xác minh kết quả. Nhân viên thực hiện công việc với nhà cung cấp ngoài hệ thống; FE không tự gọi dịch vụ gia hạn.

Nhãn trạng thái mô tả quy trình: chờ khách nhập tài khoản đích → chờ nhân viên nhận xử lý → đang xử lý → chờ xác minh kết quả → đã xác nhận gia hạn. Trạng thái chờ xác minh không được nhận lại hoặc bắt đầu lần xử lý mới; nhân viên có quyền Verify ghi kết quả và hạn mới nếu gia hạn thành công.

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

Command thành công nhận detail canonical, xóa target/evidence đã mở và hoàn tất pending command trước khi đọc lại dữ liệu phụ. Store tải lại danh sách theo query hiện tại và ghi history mới vào state. Lỗi đọc list/history hiển thị riêng và có thể tải lại; không biến mutation đã thành công thành thất bại hoặc mở lại đường replay. Nếu trạng thái rời filter, danh sách/tổng số được lấy lại và trang vượt tổng được sửa, detail đang mở vẫn giữ nguyên.

Detail, history và reveal được gắn với record/generation. Response của yêu cầu cũ không ghi lên yêu cầu vừa mở; rời detail xóa nội dung nhạy cảm. Overlay tablet trả focus về nút mở khi đóng bằng Escape hoặc backdrop.

## Source

| Trách nhiệm                | Source                                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract DTO và trạng thái | `src/app/models/renewal.dto.ts`                                                                                                                                                                                                   |
| API client                 | `src/app/services/renewals.service.ts`                                                                                                                                                                                            |
| List/detail/state/replay   | `src/app/features/renewals/`, `src/app/stores/renewals.store.ts`                                                                                                                                                                  |
| Navigation, route và style | `src/app/constants/navigation.constants.ts`, `src/app/features/renewals/renewals.routes.ts`, `src/app/features/renewals/renewals-workspace.component.ts`, `src/styles/admin/_renewals.scss`, `src/styles/admin/_collections.scss` |

Service chỉ gọi `ApiClient`; store giữ tải dữ liệu, trạng thái command và lỗi; component sở hữu draft người dùng. Target/evidence chỉ lấy theo yêu cầu và theo quyền; không lưu bền vững.

## Kiểm chứng

Store/component regression bao phủ đồng bộ list/history, lỗi đọc thứ cấp, response cũ, giữ draft và request replay. Fixture browser có lifecycle, conflict, quyền và rail; live suite dùng processor/verifier và yêu cầu gia hạn riêng cho từng profile. Kết quả cuối và giới hạn thuộc báo cáo nghiệm thu của đợt admin; chưa nghiệm thu staging/deployment.
