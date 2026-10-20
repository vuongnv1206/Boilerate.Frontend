# Feature content và quy chuẩn source — 2026-10-20

Thực hiện [kế hoạch refactor](../features/content-feature-architecture.md) vào code đang được router sử dụng:

- Thay `content-workspace` bằng feature `content`; danh sách `Content`, thêm/sửa `ContentIo`, lazy routes giữ URL cũ. Xóa `CollectionList`, `ItemEditor`, `DemoContentStore` và guard/routes cũ.
- Tách toolbar/table/form/inspector, typed form factory, model, enum và constants. Mỗi component sở hữu template/SCSS của mình; không dùng global encapsulation hoặc `::ng-deep`. PrimeNG dùng standalone controls/directives cụ thể.
- Store trang danh sách và editor riêng, signals public chỉ đọc; chọn implementation data service và view preferences tại route admin. Navigation adapter dùng contract data chung, shell không biết mock/feature state. CSV có helper riêng.
- Load có cancellation/error/retry, mutation có busy/error, editor serialize writes và giữ edits mới khi save đang chạy. Dirty guard chờ save thành công; metadata lấy từ canonical response.
- Gallery về `pages/control-gallery` với model, enum, constants riêng. Shared content-state model và shell options/layout constants tách khỏi component.
- [Coding rules](../coding-rules.md) bắt buộc qua AGENTS: naming, vị trí model/enum/config, style class và base HTTP. Có tham chiếu BE, eco-fe, NanoFE core và quyết định riêng về typed/stateless HTTP composition, DI và feature state. Không nhập source NanoFE.
- ESLint kiểm tra sublayers qua relative/alias imports, chặn direct HTTP ở page/state, chặn mock/fixtures ở state và state/service trong presentation. AST rules cho vị trí declarations/options và member ordering. 46 probes chứng minh các trường hợp cho phép/từ chối.

Kiểm chứng source cuối local: `npm run check` đạt gồm format, lint, **46 probes**, **145 tests / 20 files** và production build. Initial bundle **545.26 kB** raw / **130.02 kB** estimated transfer; content và content-io nằm ở lazy chunks riêng. Test transport concurrency có hai request endpoint/options khác nhau, flush ngược thứ tự và kiểm tra không đổi config/options của caller.

Browser regression đang được chạy trên production build với license env rỗng như CI. Vòng đầu phát hiện selector test mới khớp hai nhãn và focus race sau drawer; các sửa test và kết quả cuối được ghi ở bước browser verification kế tiếp. Không thay golden để hợp thức hóa khác biệt.
