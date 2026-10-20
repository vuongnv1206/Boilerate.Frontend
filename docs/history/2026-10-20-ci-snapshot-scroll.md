# Ổn định vị trí nền của ảnh overlay — 2026-10-20

Run CI [39416360585](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39416360585), source `21663ef`, đã đạt install, format, boundaries, 93 unit tests và production build. Browser đạt 23/24; ảnh dialog mobile-light lệch 2542 pixels do gallery phía sau cuộn khác khoảng 75px. Artifact actual/expected/diff xác nhận dialog, controls và watermark khớp, khác biệt chỉ ở nền blur. Retry lặp lại cùng chênh lệch.

Test hiện đặt scrollTop của host gallery về 0 sau khi dialog/drawer mở và xác nhận scroll trước khi chụp. Đây là chuẩn bị scene của visual test; không thay code ứng dụng, animation, baseline hoặc ngưỡng so sánh. Sáu gallery projects đã chạy lại local đạt 6/6; kết quả CI mới được ghi tại [báo cáo](../verification/2026-10-20-codebase.md) khi thực sự có run.
