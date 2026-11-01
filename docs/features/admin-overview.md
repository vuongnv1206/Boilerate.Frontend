# Tổng quan vận hành Admin

- Ngày bắt đầu: 2026-10-25
- Trạng thái: Đã triển khai; đang hoàn tất nghiệm thu local
- Hợp đồng: [Backend overview](../../../Boilerate/docs/backend/features/admin-overview.md)
- Điều phối: [Kế hoạch chung](../../../Boilerate/docs/shared/features/admin-overview.md)

## Hành vi

/admin/overview là trang đầu cho tài khoản có ít nhất một quyền Order.View, Renewal.View, Inventory.View, DigitalInventory.View hoặc FinancialSummary.View. Login/deep link giữ nguyên; tài khoản chỉ System/Catalog tiếp tục tới chức năng được phép.

Toolbar cập nhật, nhóm việc hiện tại và preview 5 bản ghi, finance 3 chỉ số/biểu đồ SVG/bảng dữ liệu, rồi stock table. Work/finance/stock có loading/empty/error/retry độc lập. Không render section bị cấm; khi 403 phải xóa dữ liệu cũ phần đó.

Ngày báo cáo theo Asia/Ho_Chi_Minh, mặc định 7 ngày tới hôm nay; Today/7/30/custom tối đa 90 ngày. Finance dates, threshold và stock page/pageSize nằm trong URL; thay ngưỡng reset page=1. Ngày không lọc work/stock. Ngưỡng 0–999 mặc định 5. Stock page sizes 10/20/50.

Orders/Renewals nhận queue URL và hiện chip tên nhóm có thể xóa; các filter còn lại AND và Back giữ query. Product link trong stock chỉ hiện khi có Product.View. Khi một quyền trong nhóm bị thu hồi, hủy request và xóa cache của cả phần trước khi đọc lại phần còn được phép.

Số tiền API là chuỗi số nguyên VND; nhãn dùng BigInt để giữ chính xác cả khi vượt giới hạn an toàn của JavaScript Number. Biểu đồ chỉ chuyển tỷ lệ tọa độ sang số; bảng và nhãn luôn giữ giá trị gốc. Không phát sinh vẫn hiển thị đủ các ngày và thông báo tương ứng.

## Thiết kế

Theo DESIGN.md và admin-ui-design skill: Inter cho dữ liệu và điều khiển, dùng kích thước control và semantic Light/Dark/System chung, layout phẳng, không private palette. Không thêm chart dependency; SVG có bảng dữ liệu tương đương và keyboard labels. Screen TS+HTML; models/services/stores/utils/constants ở cấp app, SCSS trong styles/admin có scope.

## Kiểm chứng

Store/query tests bảo vệ date bounds, cancel stale reads, partial errors và permission revoke. Browser mocks/live SQL kiểm dữ liệu/quyền/deep links/queue/paging; đã review desktop1440×900, tablet1024×768 Light/Dark trước baseline. Kết quả thực chạy và giới hạn tại [báo cáo nghiệm thu](../verification/2026-10-26-admin-overview.md).
