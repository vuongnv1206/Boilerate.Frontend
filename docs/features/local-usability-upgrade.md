# Nâng cấp trải nghiệm local

Trạng thái: đã triển khai và kiểm chứng local ngày 04/11/2026; không thay thế nghiệm thu staging/production. Phạm vi: Admin desktop/tablet, storefront mobile 390×844 và 360×800, giữ thiết kế hiện hành.

## Đã hoàn thiện

1. Đồng bộ docs/roadmap và baseline revision/diff; giữ phần chuẩn hóa chưa commit, cập nhật luật mobile và các cặp AGENTS/CLAUDE.
2. Catalog query nằm trong URL, debounce 300 ms và hủy read cũ; chi tiết tách loading/error. SKU không phù hợp bị xóa; giá 0 và số lượng theo contract BE. Thêm giỏ chỉ báo thành công sau API.
3. Giỏ giữ quote khi lưu lỗi và khóa mutation cạnh tranh; kết quả chưa chắc chắn cần reload. My Orders có phân trang 20 đơn và giữ ngữ cảnh URL; order/delivery/shipment/settings có lỗi và retry riêng. Hủy đơn theo theme, trạng thái đơn tách khỏi thanh toán/giao hàng.
4. Admin dùng lại queue deep links, rail có keyboard/focus và editor giữ draft; thêm wrap toolbar/action groups/nhãn dài ở tablet. Storefront dùng một cột cho chi tiết/checkout, giỏ theo từng món, touch targets và hero gọn hơn.
5. Đã chạy FE checks, unit 303/303, BE non-provider 237/237, browser desktop/tablet và mobile, vòng live SQL Server trên artifact cố định. Kết quả từng lượt và giới hạn tại [báo cáo nghiệm thu local](../verification/2026-11-04-local-usability.md); không gộp các lần chạy thành một lượt full green.

## Tiêu chí và giới hạn

Không thành công giả, không giữ SKU cũ, không tự replay checkout mất response bằng operation mới. Giới hạn 1–999/SKU và 50 SKU/giỏ; server sở hữu giá/tồn/quyền. Query catalog dùng search/categoryId/page; đơn dùng page, mặc định 20 đơn. Không lưu OTP/token/nội dung số vào Web Storage.

Không endpoint/schema/migration mới. Không triển khai gateway/QR/carrier/CSV/page builder/loyalty/nhiều shop. Admin mobile, Safari/thiết bị thật, PostgreSQL runtime, SMTP thật và staging ngoài nghiệm thu này. Còn warning initial bundle 663,54 kB so với 650 kB, giữ nguyên budget. Không commit/push hoặc thay database cửa hàng.

Điều phối BE–FE và baseline: [hồ sơ chung](../../../Boilerate/docs/shared/features/local-usability-upgrade.md). Chạy mobile: `run.ps1 test:e2e:shop-mobile`.
