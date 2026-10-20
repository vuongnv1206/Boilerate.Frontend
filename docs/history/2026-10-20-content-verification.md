# Browser regression sau refactor — 2026-10-20

Thêm workflow browser tạo/sửa/autosave bản nháp, giữ identity, filters và navigation counts qua route; reload khôi phục mock. Sửa selector mới để không nhầm sản phẩm/loại sản phẩm; chờ dialog/drawer đóng trước kiểm tra focus/thao tác tiếp theo. Không đổi golden snapshots.

Source local đã đạt `npm run check`: **46 probes, 145 unit tests**, production build. Browser cuối **30/30 đạt** ở 6 projects, không retry local. [Báo cáo chi tiết](../verification/2026-10-20-content-architecture.md) ghi vòng fail trước, cách sửa, phạm vi và giới hạn. CI đang chờ commit/push bước này; kết quả sẽ cập nhật từ run thực tế.
