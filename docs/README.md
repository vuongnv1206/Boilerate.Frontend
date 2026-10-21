# Tài liệu dự án

Đọc [README](../README.md) để chạy ứng dụng, [PRODUCT](../PRODUCT.md) để hiểu phạm vi và [DESIGN](../DESIGN.md) để làm giao diện.

| Cần tìm                                 | Tài liệu                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cấu trúc, trách nhiệm và luồng dữ liệu  | [Kiến trúc](architecture.md)                                                                                              |
| Folder, naming, component/store/service | [Quy chuẩn codebase và triển khai FE](coding-rules.md)                                                                    |
| Tokens và style dùng chung              | [Quy tắc SCSS](scss-rules.md)                                                                                             |
| Danh sách và thêm/sửa Catalog qua API   | [Collections](features/live-admin-collections.md)                                                                         |
| Đăng nhập, khôi phục phiên và đăng xuất | [Giữ phiên](features/persistent-session.md)                                                                               |
| Các tính năng đã triển khai theo mốc    | [Lịch sử tính năng](history/README.md)                                                                                    |
| Bằng chứng tích hợp theo phiên bản      | [Nền tích hợp hiện tại](verification/2026-10-21-codebase-foundation.md); các báo cáo mốc cũ được dẫn từ feature tương ứng |
| Nguồn thiết kế và giấy phép             | [Tham chiếu](../design/references/README.md), [third-party notices](../THIRD_PARTY_NOTICES.md)                            |

## Quy tắc duy trì docs

- **Tài liệu hiện tại** mô tả cách hệ thống đang hoạt động, hợp đồng cần dùng và giới hạn còn tồn tại. Sửa tại nguồn đang sở hữu nội dung; bỏ kế hoạch cũ đã bị thay thế. Chỉ thêm tài liệu tính năng khi có luồng hoặc hợp đồng cần tra cứu lâu dài.
- **Lịch sử** chỉ ghi mốc hoàn thành tính năng hoặc thay đổi hành vi đáng kể với người dùng. Mỗi mốc vài dòng: đã có khả năng gì, phạm vi chính và link chi tiết nếu có. Gộp các bước của cùng tính năng vào một mốc trong `history/README.md`.
- Không ghi riêng mỗi lần refactor, di chuyển file, sửa style nhỏ, nhập source, sửa test/CI, chạy kiểm tra hoặc dọn docs. Chi tiết code và commit tra trong Git; không thêm bản ghi lịch sử cho chính việc dọn tài liệu.
- **Kiểm chứng** thường báo ngay trong phần bàn giao. Chỉ giữ báo cáo lâu dài cho mốc cần bằng chứng tích hợp/nghiệm thu: source, môi trường cần thiết, kết quả cuối, cách chạy lại và giới hạn. Không giữ nhật ký từng vòng fail/retry, log dài hoặc tạo báo cáo cho mọi lần chạy. Raw logs/ảnh ở `artifacts/` bị ignore.
- Một thông tin có một nơi sở hữu: quy chuẩn ở tài liệu quy chuẩn, hành vi ở feature, bằng chứng ở báo cáo. README và lịch sử chỉ tóm tắt hoặc dẫn link. Không sao chép bảng commit, số test hay kết quả CI khắp các file.
- Phân biệt code đã có, kiểm chứng của một phiên bản và nghiệm thu triển khai. Báo cáo cũ không xác nhận checkout hiện tại; không ghi tích hợp BE thành công nếu source BE chưa có hợp đồng tương ứng.
