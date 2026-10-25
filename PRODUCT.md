# Boilerate Admin

Ứng dụng dành cho chủ shop và nhân viên quản trị. Mục tiêu là một không gian làm việc có thể dùng liên tục: tìm được thông tin nhanh, đọc được nhiều dòng dữ liệu và sửa bản ghi trong cùng ngữ cảnh.

## Mốc hiện tại

Đối chiếu ngày **25/10/2026**, FE và BE working tree còn các thay đổi chưa commit. Admin đã đồng bộ theo DESIGN.md và toàn bộ live SQL Server/API suite đã đạt trên database test cô lập. Database local đang chạy chưa sẵn sàng vì thiếu schema storefront; PostgreSQL runtime, SMTP thật và deployment chưa xác nhận. Xem [bằng chứng và giới hạn](docs/verification/2026-10-25-admin-design.md).

| Phần                                                        | Đã có trong source                                                                                                         | Giới hạn kiểm chứng                                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace và phiên                                          | Webflow workspace, System/Light/Dark, panel, Gallery; đăng nhập, restore URL/phiên bằng cookie HttpOnly                    | Có [bằng chứng phiên](docs/verification/2026-10-21-persistent-session.md); deployment riêng chưa nghiệm thu                                  |
| [Collections](docs/features/live-admin-collections.md)      | Products/options/variants/ảnh/giá/tồn, Categories với chip sản phẩm, Product types với schema/trường và sản phẩm liên quan | Đã qua live SQL Server/API trên DB test cô lập; DB local và deployment theo [báo cáo hiện tại](docs/verification/2026-10-25-admin-design.md) |
| [Đơn hàng](docs/features/admin-orders.md)                   | List/filter/detail, xác nhận tiền, hủy/thử xử lý lại; giao hàng/COD, hoàn tiền/nhận hàng trả và timeline                   | Đã qua live SQL Server/API trên DB test cô lập; staging và vận hành thật chưa nghiệm thu                                                     |
| [Gia hạn](docs/features/admin-renewals.md)                  | List/detail, claim/release/start, chờ xác minh và reveal theo quyền                                                        | Detail, history và danh sách đã đồng bộ sau command, có unit/browser và live SQL Server coverage; staging chưa nghiệm thu                    |
| Mã giảm giá                                                 | Chưa có contract hoặc API mã giảm giá trong BE                                                                             | Chờ BE cung cấp contract; chưa có giao diện trong đợt này                                                                                    |
| [Quản trị hệ thống](docs/features/system-administration.md) | Người dùng, vai trò, nhóm chức năng/hành động và cấp quyền từ BE                                                           | Đã hồi quy quyền/phiên qua live SQL Server/API; chưa chứng nhận deployment                                                                   |
| [Giao diện khách mua](docs/features/storefront.md)          | Catalog Published, chi tiết, server cart, OTP checkout, My Orders, shipment/digital views và Admin payment settings        | Đã qua fixture/live SQL Server cho khách mua và Admin settings; PostgreSQL runtime, SMTP thật và deployment chưa xác nhận                    |

Yêu cầu tích hợp và cách chạy ở [README](README.md). Hành vi/giới hạn thuộc feature tương ứng; bằng chứng chỉ áp dụng cho source và phạm vi ghi trong báo cáo. Các mốc đã triển khai ở [lịch sử tính năng](docs/history/README.md).

Kết quả kiểm tra hiện tại và phạm vi áp dụng nằm tại [báo cáo đồng bộ Admin](docs/verification/2026-10-25-admin-design.md). Các báo cáo ngày 24/10 vẫn là bằng chứng lịch sử của storefront; không dùng chúng thay cho kết quả checkout hiện tại.

## Nguyên tắc sản phẩm

- Webflow CMS/Ecommerce workspace là tham chiếu chính: điều hướng ổn định, panel theo ngữ cảnh, thao tác gần nội dung.
- Orders và Renewals dùng cùng toolbar, bảng, badge trạng thái và rail ngữ cảnh; action vẫn theo quy trình nghiệp vụ riêng của từng API.
- Mở một bản ghi giữ danh sách sản phẩm ở cạnh editor để chuyển bản ghi mà không mất bộ lọc. Metadata nằm cuối editor; form chính giữ nội dung, ảnh, options và variants cùng một bản nhập.
- Tiếng Việt là ngôn ngữ giao diện. Tên source/type dùng tiếng Anh; nội dung UI tránh thuật ngữ triển khai.
- Desktop là môi trường chính; màn nhỏ vẫn tìm, đọc, chỉnh mẫu và mở điều hướng được. Thu gọn hoặc chuyển panel thành overlay trước khi ép form quá hẹp.
- System/Light/Dark là lựa chọn đồng cấp. Theme không đổi dữ liệu hoặc tác vụ đang làm.
- Motion giúp đọc được thay đổi và phản hồi thao tác; không làm chậm nhập liệu.

## Mốc sau

Thứ tự đề xuất sau kiểm chứng ngày 25/10/2026. Ưu tiên đưa bản đã có vào môi trường vận hành; không triển khai lại các luồng Catalog/Orders/kho/Renewals đã qua live suite. Phần BE và vận hành theo [roadmap BE](../Boilerate/docs/backend/roadmap.md).

| Ưu tiên                | Công việc                                                                                                                        | Điều kiện hoàn tất                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| P0 — chốt phiên bản    | Rà diff của hai repo, đóng mốc source FE–BE và gắn checks/bundle/migration với cặp revision                                      | Có thể tái dựng đúng bản đã kiểm; không commit secrets hoặc raw artifacts                                        |
| P0 — DB local sẵn sàng | Backup DB đích rồi áp dụng migration Pending `20261024082919_GuestStorefront`; đối chiếu capabilities/grants có chủ đích         | Health ready đạt, Catalog/settings/storefront hoạt động trên DB local thực; Host không tự migrate/seed/cấp quyền |
| P1 — staging MSSQL     | HTTPS cùng origin, proxy/cookie/phiên, SPA deep link, media và Data Protection keys bền vững; OTP qua SMTP thật                  | Hành trình mua/quản trị và restore phiên/upload chạy trên artifact deploy xác định, còn đúng sau restart         |
| P1 — pilot và recovery | Nhân viên vận hành hàng vật lý/COD, hàng số, gia hạn, hoàn tiền/nhận hàng trả; diễn tập restore DB + media + keys vào đích riêng | Đo được RPO/RTO, đọc được nội dung mã hóa/media, không ghi nghiệp vụ hai lần và có cặp artifact rollback         |

RenewalsStore hiện đã cập nhật detail, history state và trang danh sách theo query sau command; không còn coi lỗi đồng bộ state cũ là backlog triển khai. Category metadata và membership vẫn là hai mutation: giữ draft và nêu rõ phần đã lưu nếu bước sau thất bại. Không tự replay mutation mất response bằng operation mới.

Recovery cần đối soát tiền, hàng và gia hạn đã thực hiện ngoài recovery point, đồng thời kiểm lại phiên/quyền trước mở traffic. Runner operations hiện yêu cầu cả MSSQL/PostgreSQL cho Recovery/Container; nghiệm thu MSSQL cần chọn đúng ca hoặc bổ sung lựa chọn provider, ghi rõ giới hạn kết quả. PostgreSQL parity là mốc riêng khi có nhu cầu triển khai hoặc cam kết hỗ trợ provider đó.

Mobile, CSV, payment gateway/carrier tự động, page builder và các mở rộng ngoài MVP tiếp tục để sau. Giữ cảnh báo bundle trong báo cáo; tối ưu sau khi chốt artifact, không nâng budget chỉ để che cảnh báo.

## Tiêu chí đánh giá trải nghiệm

Người dùng đăng nhập, mở danh sách, tìm/lọc/chọn dòng, mở editor, chỉnh giá trị và nhận phản hồi từ API sau khi lưu. Điều hướng và overlay hoạt động bằng bàn phím; kiểm tra chữ tiếng Việt dài, cả hai theme và animation bình thường. Mobile và kiểm tra reduced motion trên hệ điều hành được hoãn theo yêu cầu hiện tại.
