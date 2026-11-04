# Boilerate

Ứng dụng dành cho chủ shop, nhân viên quản trị và khách mua. Workspace cần tìm được thông tin nhanh, đọc được nhiều dòng dữ liệu và sửa bản ghi trong cùng ngữ cảnh; cửa hàng cần giúp khách chọn sản phẩm và hoàn tất đơn hàng rõ ràng.

## Mốc hiện tại

Ngày 04/11/2026: [nâng cấp trải nghiệm local](docs/features/local-usability-upgrade.md) đã triển khai, gồm Admin desktop/tablet và storefront mobile. [Báo cáo kiểm chứng](docs/verification/2026-11-04-local-usability.md) ghi rõ từng lượt chạy lại và giới hạn; chưa deploy.

Đối chiếu 01/11/2026: mã giảm giá đã tích hợp Admin/giỏ/checkout; hồi quy local trên build cuối đã hoàn tất. Phạm vi, source/build và giới hạn tại [kiểm chứng mã giảm giá](docs/features/admin-discounts.md#kiểm-chứng-ngày-01112026). Chưa commit/release hoặc triển khai staging.

Đối chiếu ngày **27/10/2026**, [Tổng quan vận hành](docs/features/admin-overview.md) đã có source, FE/BE checks và SQL Server integration; đang hoàn tất hồi quy browser/live trên build cố định. Database `BoilerateDevelopment` đã backup/verify và áp index migration `AdminOverviewIndexes`; chỉ thêm `FinancialSummary.View` cho Admin, giữ 55 grant cũ. Admin dùng DESIGN.md. Function `StorefrontSettings` vẫn chưa đăng ký trong ACL local. PostgreSQL runtime, SMTP thật và staging chưa xác nhận. Xem [bằng chứng và giới hạn](docs/verification/2026-10-26-admin-overview.md).

| Phần                                                        | Đã có trong source                                                                                                         | Giới hạn kiểm chứng                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace và phiên                                          | Workspace, System/Light/Dark, panel, Gallery; đăng nhập, restore URL/phiên bằng cookie HttpOnly                            | Có [bằng chứng phiên](docs/verification/2026-10-21-persistent-session.md); deployment riêng chưa nghiệm thu                                   |
| [Tổng quan vận hành](docs/features/admin-overview.md)       | Việc hiện tại/5 bản ghi cũ nhất, thu tiền theo ngày Việt Nam và cảnh báo tồn; quyền tài chính riêng, deep link queue       | Đã kiểm FE/BE và SQL Server cô lập; browser/live cuối theo [báo cáo](docs/verification/2026-10-26-admin-overview.md); staging chưa nghiệm thu |
| [Collections](docs/features/live-admin-collections.md)      | Products/options/variants/ảnh/giá/tồn, Categories với chip sản phẩm, Product types với schema/trường và sản phẩm liên quan | Đã qua live SQL Server/API trên DB test cô lập; DB local đã có schema storefront; staging chưa nghiệm thu                                     |
| [Đơn hàng](docs/features/admin-orders.md)                   | List/filter/detail, xác nhận tiền, hủy/thử xử lý lại; giao hàng/COD, hoàn tiền/nhận hàng trả và timeline                   | Đã qua live SQL Server/API trên DB test cô lập; staging và vận hành thật chưa nghiệm thu                                                      |
| [Gia hạn](docs/features/admin-renewals.md)                  | List/detail, claim/release/start, chờ xác minh và reveal theo quyền                                                        | Detail, history và danh sách đã đồng bộ sau command, có unit/browser và live SQL Server coverage; staging chưa nghiệm thu                     |
| [Mã giảm giá](docs/features/admin-discounts.md)             | Quản lý mã, áp dụng trong giỏ/checkout và snapshot số tiền giảm trên đơn                                                   | Đã qua live SQL Server test cô lập; migration và grant chưa áp vào database cửa hàng, staging chưa nghiệm thu                                 |
| [Quản trị hệ thống](docs/features/system-administration.md) | Người dùng, vai trò, nhóm chức năng/hành động và cấp quyền từ BE                                                           | Đã hồi quy quyền/phiên qua live SQL Server/API; chưa chứng nhận deployment                                                                    |
| [Giao diện khách mua](docs/features/storefront.md)          | Catalog Published, chi tiết, server cart, OTP checkout, My Orders, shipment/digital views và Admin payment settings        | Đã qua fixture/live SQL Server cho khách mua và Admin settings; DB local đã sẵn sàng; PostgreSQL runtime, SMTP thật và staging chưa xác nhận  |

Yêu cầu tích hợp và cách chạy ở [README](README.md). Hành vi/giới hạn thuộc feature tương ứng; bằng chứng chỉ áp dụng cho source và phạm vi ghi trong báo cáo. Các mốc đã triển khai ở [lịch sử tính năng](docs/history/README.md).

Kết quả kiểm tra hiện tại và phạm vi áp dụng nằm tại [báo cáo Tổng quan](docs/verification/2026-10-26-admin-overview.md); [đồng bộ Admin ngày 25/10](docs/verification/2026-10-25-admin-design.md) là mốc trước. Các báo cáo cũ không thay cho kết quả trên source hiện tại.

## Nguyên tắc sản phẩm

- Palette giấy ấm, charcoal và terracotta lấy cảm hứng từ Claude; Admin ưu tiên độ rõ và mật độ dữ liệu, storefront ưu tiên sản phẩm, hình ảnh và hành trình mua. Quy tắc cụ thể nằm ở DESIGN.md.
- Orders và Renewals dùng cùng toolbar, bảng, badge trạng thái và rail ngữ cảnh; action vẫn theo quy trình nghiệp vụ riêng của từng API.
- Mở một bản ghi giữ danh sách sản phẩm ở cạnh editor để chuyển bản ghi mà không mất bộ lọc. Metadata nằm cuối editor; form chính giữ nội dung, ảnh, options và variants cùng một bản nhập.
- Tiếng Việt là ngôn ngữ giao diện. Tên source/type dùng tiếng Anh; nội dung UI tránh thuật ngữ triển khai.
- Desktop là môi trường chính; màn nhỏ vẫn tìm, đọc, chỉnh mẫu và mở điều hướng được. Thu gọn hoặc chuyển panel thành overlay trước khi ép form quá hẹp.
- System/Light/Dark là lựa chọn đồng cấp. Theme không đổi dữ liệu hoặc tác vụ đang làm.
- Motion giúp đọc được thay đổi và phản hồi thao tác; không làm chậm nhập liệu.

## Mốc sau

Đợt 04/11: [hoàn thiện local và mobile storefront](docs/features/local-usability-upgrade.md) đã kiểm chứng local theo báo cáo riêng; các kết quả cũ không thay thế bằng chứng đợt này.

Thứ tự sau mốc Tổng quan ngày 27/10/2026. Ưu tiên chốt artifact đã kiểm chứng và đưa vào môi trường vận hành. Phần BE và vận hành theo [roadmap BE](../Boilerate/docs/backend/roadmap.md).

| Ưu tiên                | Công việc                                                                                                                        | Điều kiện hoàn tất                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P0 — chốt phiên bản    | Review/commit working tree Tổng quan FE và BE, giữ cặp artifact đã kiểm chứng                                                    | Bằng chứng tại báo cáo Tổng quan; chưa push hoặc triển khai staging                                      |
| Đã đạt — rollout local | Backup/verify, áp `20261025154133_AdminOverviewIndexes`; chỉ thêm `FinancialSummary.View` cho Admin                              | Readiness 200, 55 grant cũ giữ nguyên; StorefrontSettings vẫn ngoài rollout này                          |
| P1 — staging MSSQL     | HTTPS cùng origin, proxy/cookie/phiên, SPA deep link, media và Data Protection keys bền vững; OTP qua SMTP thật                  | Hành trình mua/quản trị và restore phiên/upload chạy trên artifact deploy xác định, còn đúng sau restart |
| P1 — pilot và recovery | Nhân viên vận hành hàng vật lý/COD, hàng số, gia hạn, hoàn tiền/nhận hàng trả; diễn tập restore DB + media + keys vào đích riêng | Đo được RPO/RTO, đọc được nội dung mã hóa/media, không ghi nghiệp vụ hai lần và có cặp artifact rollback |

RenewalsStore hiện đã cập nhật detail, history state và trang danh sách theo query sau command; không còn coi lỗi đồng bộ state cũ là backlog triển khai. Category metadata và membership vẫn là hai mutation: giữ draft và nêu rõ phần đã lưu nếu bước sau thất bại. Không tự replay mutation mất response bằng operation mới.

Recovery cần đối soát tiền, hàng và gia hạn đã thực hiện ngoài recovery point, đồng thời kiểm lại phiên/quyền trước mở traffic. Runner operations hiện yêu cầu cả MSSQL/PostgreSQL cho Recovery/Container; nghiệm thu MSSQL cần chọn đúng ca hoặc bổ sung lựa chọn provider, ghi rõ giới hạn kết quả. PostgreSQL parity là mốc riêng khi có nhu cầu triển khai hoặc cam kết hỗ trợ provider đó.

Admin mobile, CSV, payment gateway/carrier tự động, page builder và các mở rộng ngoài MVP tiếp tục để sau. Giữ cảnh báo bundle trong báo cáo; tối ưu sau khi chốt artifact, không nâng budget chỉ để che cảnh báo.

## Tiêu chí đánh giá trải nghiệm

Người dùng đăng nhập, mở danh sách, tìm/lọc/chọn dòng, mở editor, chỉnh giá trị và nhận phản hồi từ API sau khi lưu. Điều hướng và overlay hoạt động bằng bàn phím; kiểm tra chữ tiếng Việt dài, cả hai theme và animation bình thường. Storefront bổ sung mobile 390×844 và 360×800; kiểm reduced motion bằng browser. Admin mobile tiếp tục hoãn.
