# Kiểm chứng thiết kế Claude — 29/10/2026

## Phạm vi và nguồn

- Frontend tại `1d46242` và Backend tại `4ff259b`; cả hai working tree đã có thay đổi chưa commit trước đợt thiết kế. Kết quả dưới đây áp dụng cho working tree local, không phải một bản release hay nghiệm thu staging.
- [DESIGN.md](../../DESIGN.md) quy định palette, token, preset, bố cục vận hành và storefront, trạng thái và khả năng truy cập. Font Inter và Noto Serif được phục vụ cùng ứng dụng.
- Kiểm tra ảnh đại diện ở 1440×900 và 1024×768, Light/Dark: Overview, list/editor, danh mục, loại sản phẩm, đơn hàng, gia hạn, ma trận quyền, cài đặt, login, forbidden, overlay và storefront. Baseline được cập nhật sau khi xem ảnh; chế độ System được kiểm tra riêng bằng browser preference và reload.

## Kết quả local

- Frontend `run.ps1 check`: format, lint, 43 kiểm tra kiến trúc, 288/288 unit test và production build đã đạt trên mã cuối.
- Backend regression không gồm provider integration: 235/235 đạt. PostgreSQL chưa được kiểm chứng thực tế vì chưa cấu hình `BOILERATE_TEST_POSTGRES`.
- Browser E2E mock trên production build cuối và baseline đã duyệt: 339/340 đạt. Ca còn lại nhập nhầm ô khi animation dialog giao hàng giành focus; sau khi test chờ dialog ổn định và kiểm tra cả hai giá trị, ca đó chạy lại đạt 4/4 cấu hình. Đây là hai lượt riêng, không phải một lượt đầy đủ 340/340. Bảng chi tiết đơn được kiểm tra thêm khả năng cuộn bằng bàn phím.
- SQL Server live acceptance dùng database thử nghiệm tạo riêng và build trước sửa cuối về cuộn bảng: lượt đầy đủ đạt 87/92; năm lỗi là selector cũ của picker danh mục. Sau khi sửa selector, lượt riêng cho hai ca danh mục đạt 8/8 trên bốn cấu hình. Đây là hai lượt riêng, không phải một lượt đầy đủ 92/92. Các database thử nghiệm của các lượt này đã được xác nhận dọn.
- Runtime local: `/admin` và `/shop` qua `http://localhost:4200` trả HTTP 200; proxy `/api/catalog/categories` trả 200, `http://localhost:5000/health/ready` báo Ready.
- Production build: initial 661,96 kB, CSS 116,42 kB; cảnh báo vượt budget 650 kB là 11,96 kB. Noto Serif WOFF2: Latin 36.756 byte, Latin-ext 186.552 byte, Vietnamese 14.704 byte. Budget không được tăng.

## Giới hạn

Không thay API, DTO, grant hay migration cho đợt thiết kế. Không migrate, seed hoặc reset database ứng dụng hiện có. Mobile và staging chưa được nghiệm thu; đăng nhập với tài khoản local thực chưa được xác nhận bằng thông tin đăng nhập. Không suy kết quả SQL Server thành kết quả PostgreSQL.
