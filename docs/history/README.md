# Lịch sử codebase FE

Các bản ghi dưới đây thuộc repo FE độc lập. Lịch sử UI trước khi tách Git vẫn được dẫn từ tài liệu workspace BE; việc nhập baseline không tái tạo commit phát triển cũ.

- [Nhập source theo nhóm](2026-10-20-import.md).
- [Ranh giới kiến trúc và navigation DI](2026-10-20-boundaries.md).
- [Runtime, HTTP và forms](2026-10-20-http.md).
- [Theme và shared presentation](2026-10-20-theme.md).
- [Kiểm tra tự động và CI](2026-10-20-quality.md).
- [Ổn định nền scroll trong ảnh overlay CI](2026-10-20-ci-snapshot-scroll.md).
- [Content data và HTTP transport](2026-10-20-content-data.md).
- [Feature content và quy chuẩn source](2026-10-20-content-architecture.md).
- [Browser regression sau refactor](2026-10-20-content-verification.md).
- [Kiểm chứng feature content](../verification/2026-10-20-content-architecture.md).
- [Báo cáo kiểm chứng tích hợp](../verification/2026-10-20-codebase.md).

Baseline trước refactor feature đã có CI đạt trên source `dd7fd71`: [run 39417291346](https://github.com/vuongnv1206/Boilerate.Frontend/actions/runs/39417291346), gồm 93 unit tests và 24 browser tests. Kết quả đó không thay thế việc kiểm tra source mới; các bản ghi content ở trên ghi phạm vi và kiểm chứng mới.

## Các commit đã có

| Commit    | Nhóm thay đổi                                     |
| --------- | ------------------------------------------------- |
| `aec2069` | Bootstrap/tooling                                 |
| `735a390` | Theme/shared primitives baseline                  |
| `c97a719` | Workspace/content demo baseline                   |
| `111e7fe` | Gallery baseline                                  |
| `9b0b3df` | Ranh giới feature/layout                          |
| `6cbf259` | Runtime/HTTP/forms                                |
| `1af8c45` | Theme tokens/shared presentation                  |
| `6ebf64b` | Browser regression và CI                          |
| `21663ef` | Tài liệu kiến trúc và quy chuẩn checkout          |
| `dd7fd71` | Chuẩn hóa nền scroll của ảnh overlay; CI cuối đạt |
