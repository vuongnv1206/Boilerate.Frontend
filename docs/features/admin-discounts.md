# Mã giảm giá trong Admin

- Cập nhật: 2026-10-30
- Trạng thái: Đã kiểm thử SQL Server cô lập; chưa triển khai staging hoặc database cửa hàng.
- Quy tắc và phối hợp BE/FE: [Hồ sơ mã giảm giá](../../../Boilerate/docs/shared/features/discount-codes.md). Hợp đồng API và transaction thuộc backend.

## Quản lý mã

`/admin/discounts` hiển thị mã, mức giảm, điều kiện tối thiểu, lượt đã sử dụng và trạng thái bật/tắt. Tìm kiếm, bộ lọc và trang nằm trong URL và được giữ khi vào editor hoặc quay lại danh sách. Quyền `Discount.View` cho xem; `Discount.Create` mở màn tạo và `Discount.Update` cho sửa mã đã có. Không suy các quyền này từ quyền đơn hàng hoặc thanh toán.

Editor nhập mã chữ ASCII, số, dấu chấm, gạch ngang hoặc gạch dưới; mã được chuẩn hóa thành chữ hoa. Chọn giảm theo phần trăm nguyên 1–99 hoặc số tiền VND nguyên, giá trị hàng tối thiểu, thời điểm bắt đầu/kết thúc tùy chọn theo giờ Việt Nam và giới hạn tổng lượt tùy chọn. Thiết lập có thể bật/tắt; số lượt đã sử dụng chỉ xem. Giá trị cấu hình về sau không thay đổi snapshot đơn đã tạo.

Form kiểm tra giá trị bắt buộc, số nguyên và thứ tự thời gian. Khi tải/lưu lỗi hoặc gặp conflict, bản nhập được giữ; tải lại và rời màn hình hỏi trước khi bỏ thay đổi. Người chỉ có quyền xem thấy thông tin ở trạng thái không thể sửa. Trong khi lưu, form và điều khiển bị khóa để phản hồi server không ghi đè thao tác nhập mới. Thành công chỉ được thông báo sau phản hồi API.

## Kiểm chứng cần hoàn tất

Kiểm thử create/update, quyền xem/sửa, tìm/lọc/pagination, reload/Back, tiếng Việt, định dạng giờ Việt Nam, validation, mạng lỗi, conflict và dirty guard. Kiểm tra bàn phím, dropdown gắn `body`, vùng cuộn và Light/Dark ở desktop/tablet. Live acceptance dùng database SQL Server tạo riêng; không tự đăng ký quyền hay chạy migration trên database cửa hàng.

Ngày 2026-11-01: kiểm thử frontend 294/294, browser toàn bộ 360/360, browser tập trung 20/20 và live SQL Server 96/96 đã chạy thành công. Các bộ browser toàn bộ và live dùng bản build trước các chỉnh sửa trình bày cuối ở ô mã và nhãn checkbox; tám kiểm thử trên bản build mới xác nhận riêng các màn đó. Chưa xác nhận PostgreSQL runtime hay triển khai staging. Build vẫn cảnh báo initial bundle 662,81 kB so với budget 650 kB.

## Kiểm chứng ngày 01/11/2026

Source: FE base `1d46242`, BE base `4ff259b` cộng working tree chưa commit. Kết quả chỉ áp dụng cho checkout local này.

- FE format/lint và 43 kiểm tra kiến trúc đạt; unit chạy lại đạt 294/294. Lượt đầu có một timeout focus panel (293/294), không gộp hai lượt thành một kết quả.
- BE Release non-provider regression đạt 237/237; SQL Server DiscountIntegrationTests đạt 1/1, không bỏ qua. Ca integration bảo vệ quota nguyên tử, expiry và receipt đến muộn.
- Sửa input binding ariaLabel của Select loại giảm; browser Admin chạy tuần tự đạt 8/8 ở desktop/tablet Light/Dark, gồm tạo mã theo giờ Việt Nam, query, conflict giữ draft, dirty guard và quyền chỉ xem. Lượt chạy song song trước đó đạt 7/8 do timeout đăng nhập fixture.
- Live discount checkout đạt 4/4 trên Kestrel/SQL Server cô lập: OTP, quote, snapshot, tổng đơn và quota. Run `b8239ab4-58d6-4f4c-9bc2-2d28fcd34678` kết thúc thành công và runner cleanup hoàn tất.
- Production build đạt; initial 662,81 kB, vượt budget 650 kB là 12,81 kB. Không tăng budget.
- Full live SQL Server đạt 96/96 trên desktop/tablet Light/Dark (run bf478b56-cd46-4894-8c80-a261dee9e8dd); full mock đạt 360/360 trên cùng build sau khi review/cập nhật baseline checkout. Lượt full mock trước bị ngắt, không dùng làm kết quả tổng hợp. PostgreSQL, SMTP thật và staging chưa nghiệm thu; không migrate/cấp quyền trên database cửa hàng.

Chạy lại: `run.ps1 test:e2e -- e2e/discount-admin.spec.ts --workers=1`; live dùng `run.ps1 test:e2e:live -- --skip-build discount.spec.ts` sau khi build đúng source, với SQL Server test riêng. Raw logs nằm trong artifacts bị ignore.

Build main SHA256: `15636904C768F6D1365966795363DE5714EA3B31482BD913CD111B77D7448B37`. Baseline checkout đã được xem và cập nhật trên đủ bốn cấu hình cho ô mã giảm giá mới.
