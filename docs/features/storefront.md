# Storefront khách mua

- Ngày bắt đầu: 2026-10-24
- Cập nhật gần nhất: 2026-10-30
- Trạng thái: Giao diện palette ấm đang được nâng cấp; kiểm chứng hiện tại ghi theo báo cáo đợt redesign, PostgreSQL runtime còn mở
- Khu vực phụ trách: FE
- Mốc roadmap: [Mốc sau — hành trình khách mua](../../PRODUCT.md#mốc-sau)
- Hồ sơ liên quan: [BE API guest storefront](../../../Boilerate/docs/backend/features/guest-storefront.md), [điều phối chung](../../../Boilerate/docs/shared/features/guest-storefront-checkout.md)

## Mục tiêu

Khách không cần tài khoản có thể xem catalog Published, thêm giỏ, xác minh email OTP trước checkout, mua sản phẩm phù hợp với COD/chuyển khoản và xem lại đơn/digital delivery qua email đã xác minh.

## Luồng và contract

- `/shop/products`, `/shop/products/:slug`, `/shop/cart`, `/shop/checkout`, `/shop/orders`, `/shop/orders/:id` dùng các service riêng gọi public catalog/guest API BE. Admin vẫn dùng Identity riêng.
- Cart server-side giữ qua reload bằng cookie ẩn danh HttpOnly. Không lưu mã OTP, guest access token hay digital delivery trong localStorage/sessionStorage.
- Checkout gửi OTP trước khi đặt; email nhập ở form phải trùng email đã verify. Khi hết cookie email session, My Orders yêu cầu OTP mới.
- Cart lấy giá/tổng/khả dụng từ BE. Khi server trả conflict do giá, tồn hoặc version, giữ giỏ và yêu cầu khách xem lại trước khi tạo request checkout mới. Retry mất response dùng cùng OperationId và payload.
- Giỏ và checkout cho phép khách áp dụng hoặc bỏ một mã, xem số tiền giảm do server tính và snapshot trên đơn. Mã không hợp lệ giữ giỏ; nếu kết quả ghi mã không chắc chắn, phải tải lại giỏ trước khi checkout. Quy tắc quota, các trường hợp hủy/hết hạn và thanh toán muộn theo [hồ sơ điều phối](../../../Boilerate/docs/shared/features/discount-codes.md). Luồng khách đã qua live SQL Server test cô lập; PostgreSQL và staging chưa được xác nhận.
- UI yêu cầu địa chỉ nhận hàng khi giỏ có ít nhất một sản phẩm vật lý, kể cả giỏ có thêm hàng số; giỏ chỉ có hàng số không bắt buộc địa chỉ. UI chặn COD khi CartDto có hàng số; BE vẫn là nguồn kiểm tra cuối. Hiển thị chuyển khoản khi settings bật và hợp lệ; nội dung xác nhận nêu rõ nhân viên shop kiểm tra thủ công.
- My Orders có list/detail, shipment, nút hủy chỉ ở state BE cho phép và delivery chỉ sau Paid. Mọi quyền owner được BE kiểm tra; FE không dùng order ID làm chứng thực.

## Cài đặt cửa hàng trong Admin

Màn `/admin/storefront-settings` là screen riêng, không nằm sau `CentralAdminGuard`; route yêu cầu `StorefrontSettings.View`, thao tác lưu yêu cầu thêm `StorefrontSettings.Update`. Form chỉnh ngân hàng, số tài khoản, chủ tài khoản, chi nhánh/hướng dẫn và bật/tắt. Lưu dùng version concurrency, giữ draft sau lỗi; không có QR.

Màn này dùng bố cục và control Admin theo [DESIGN.md](../../DESIGN.md), tách khỏi stylesheet storefront khách mua. Khi đang lưu, trường nhập và nút bật/tắt được khóa để phản hồi server không ghi đè nội dung vừa sửa thêm. Người chỉ có quyền xem nhận các trường disabled và không có thao tác lưu.

## Thiết kế và kiểm chứng

Storefront dùng cùng palette giấy ấm/terracotta với Admin, với bố cục riêng ưu tiên hình ảnh và hành trình mua. Tiêu đề lớn dùng Noto Serif Variable; thông tin giao dịch và control dùng Inter Variable. Ảnh API được ưu tiên, sau đó là SVG theo ngữ nghĩa và trạng thái ảnh chung. Stylesheet được chia theo chrome, catalog/product, checkout và orders, nạp theo StorefrontShell. Quy chuẩn hiện tại nằm trong [DESIGN.md](../../DESIGN.md#storefront-editorial).

Viewport nghiệm thu là desktop 1440×900 và tablet 1024×768, cả Light/Dark/System; mobile optimization hoãn. E2E kiểm keyboard/focus và tiếng Việt dài, API image, ảnh thiếu/hỏng, tìm kiếm/danh mục, variant hết hàng, giỏ rỗng, OTP sai, COD hàng số, stale total và thiếu cấu hình. Snapshot storefront gồm catalog, chi tiết hết hàng, giỏ rỗng, checkout xác minh và trạng thái My Orders. Live SQL Server/mail sink kiểm OTP, HttpOnly cookie, COD/My Orders, Admin settings và giao nội dung số sau xác nhận thanh toán. [Báo cáo 24/10](../verification/2026-10-24-guest-storefront.md) là bằng chứng của source cũ, không thay cho lượt kiểm chứng redesign mới.

### 2026-10-24 — Nền hiện có, guest flow và settings

- Hoàn thiện catalog/list/detail, server-side cart, OTP checkout, My Orders, shipment/digital views và admin settings chuyển khoản. Guest và authenticated store đều giữ contract riêng; không lưu token hoặc digital delivery trong Web Storage.
- Khi total/version bị 409, cart được giữ và khách phải xác nhận tổng mới; retry sau lỗi mạng gửi lại cùng operation và payload. Chuyển khoản báo nhân viên đối soát thủ công; COD bị tắt khi cart có hàng không Physical.
- Kiểm chứng: FE check đạt, gồm 269/269 unit tests và production build; mocked E2E 16/16; live E2E/API 12/12 trên SQL Server cô lập, desktop/tablet × Light/Dark, OTP qua mail sink. SQL Server guest integration đạt 5/5 và BE non-provider regression đạt 233/233.
- Migration `20261024082919_GuestStorefront` cho SQL Server đã chạy trên DB mới; migration `20261024082938_GuestStorefront` cho PostgreSQL đã scaffold nhưng runtime chưa kiểm do thiếu test connection. SMTP thật và staging/deployment là gate sau.

### 2026-10-24 — Redesign storefront Editorial

- Làm mới giao diện khách mua từ catalog tới chi tiết đơn: hero, tìm kiếm/danh mục, lưới và gallery sản phẩm, giỏ/checkout/OTP, đơn hàng, shipment và giao hàng số. Thêm fallback SVG khi catalog thiếu ảnh hoặc media API lỗi; giữ nguyên logic/API checkout và thông tin thanh toán.
- Kiểm chứng trực quan theo Light/Dark ở desktop 1440×900 và tablet 1024×768, cùng storefront E2E và live SQL Server acceptance; đây là kết quả của mốc 24/10.
