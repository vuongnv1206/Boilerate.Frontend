# Boilerate — Hệ thiết kế sản phẩm

Đây là nguồn chuẩn thị giác cho Admin, đăng nhập, các trạng thái lỗi và cửa hàng khách mua. [PRODUCT.md](PRODUCT.md) giữ mục tiêu sản phẩm; [docs tính năng](docs/README.md) giữ hợp đồng và hành vi nghiệp vụ. Điều chỉnh token và mẫu chung ở đây trước khi tạo biến thể cho một màn riêng.

## 1. Định hướng

Bảng màu giấy ấm, charcoal và terracotta được chọn từ [Claude trong GetDesign](D:/MyCode/get-design/design-systems/claude/DESIGN.md). Đây là cảm hứng về màu và sắc thái, không phải nhận diện thương hiệu của Boilerate hay tài sản được sao chép. Đọc các ghi chú [tham chiếu](design/references/README.md) và [nguồn bên thứ ba](THIRD_PARTY_NOTICES.md) khi dùng tài nguyên.

Chủ shop và nhân viên thường làm việc liên tục với bảng, form và trạng thái đơn; giao diện vận hành phải dễ quét và ổn định. Khách mua cần nhận biết sản phẩm, giá và bước thanh toán; storefront có nhiều khoảng thở hơn, nhưng dùng cùng ngôn ngữ màu, focus và trạng thái. Giữ nội dung tiếng Việt ngắn, rõ, ưu tiên động từ gắn với hành động.

Impeccable product hỗ trợ rà soát phân cấp, tương tác và accessibility. frontend-design hướng dẫn composition cho cửa hàng; brand-guidelines là nguồn tham khảo vai trò màu. Typography, khoảng cách và trạng thái được lựa chọn theo ngữ cảnh của sản phẩm.

## 2. Màu và theme

Ba lớp **primitive → semantic → component** dùng chung cho layout và PrimeNG. Thư mục src/styles/tokens sở hữu giá trị; WorkspacePreset ánh xạ semantic tokens sang control. Hệ thống không tạo palette riêng theo màn.

| Vai trò                | Light   | Dark    |
| ---------------------- | ------- | ------- |
| Canvas                 | #f5f4ed | #141413 |
| Surface                | #faf9f5 | #22221f |
| Surface nâng/hover     | #efede5 | #30302e |
| Text chính             | #141413 | #f0eee6 |
| Text phụ               | #5e5d59 | #b0aea5 |
| Viền phân vùng         | #e2dfd4 | #484740 |
| Viền input             | #8e8b80 | #858279 |
| Nhấn thương hiệu       | #c96442 | #d97757 |
| Action/link            | #a94c30 | #d97757 |
| Chữ trên nền nhấn nhạt | #923e28 | #f0b69e |
| Chữ trên action        | #faf9f5 | #141413 |

Terracotta trên diện tích lớn cần dùng có chủ đích. Với chữ thường và nút Light, dùng màu action đậm hơn; #c96442 với chữ sáng không đạt tương phản chữ thường 4.5:1. Dùng `--accent-ink` cho chữ trên `--accent-soft`, và `--on-accent` trên nền `--accent` ở cả hai theme. Trạng thái thành công, cảnh báo và lỗi có token riêng và kèm chữ hoặc icon.

System/Light/Dark là lựa chọn đồng cấp; System theo OS và cập nhật khi OS đổi. Preference lưu cục bộ, xử lý storage không khả dụng và không gây đổi dữ liệu. Các overlay gắn body kế thừa theme từ root. Đo tương phản chữ thường tối thiểu 4.5:1, chữ lớn 3:1 và biên/focus cần nhận biết tối thiểu 3:1 với nền kề.

## 3. Typography, nhịp và hình dáng

Inter Variable tự host dùng cho body, label, control, bảng và số liệu. Noto Serif Variable tự host, có Latin/Latin-ext/Vietnamese và license OFL, dùng cho tiêu đề lớn storefront. Không dùng font hoặc logo độc quyền của nguồn tham chiếu. Font có fallback phù hợp và font-display: swap; không tải toàn bộ subset vào mỗi trang.

| Vai trò                  | Quy chuẩn                                                                   |
| ------------------------ | --------------------------------------------------------------------------- |
| Admin: tiêu đề trang     | 20–24px, 600, line-height 1.25–1.35                                         |
| Admin: section/record    | 14–16px, 600, line-height 1.4                                               |
| Admin: body/control      | 14px, line-height 1.45–1.5                                                  |
| Admin: label/helper      | 13px / 12px; helper và lỗi không bị thu nhỏ riêng theo màn                  |
| Storefront: tiêu đề lớn  | Noto Serif, 34–56px; hero catalog 44–70px, line-height 1.1–1.2              |
| Storefront: body/control | Inter 16px cho body/input, nút 15px, label/bảng 14px, helper tối thiểu 13px |

Chữ số tiền và bảng dùng tabular numerals; chữ Việt dài wrap hoặc có cách đọc đầy đủ. Kích thước nhãn biểu đồ phải còn dễ đọc ở tablet, không chỉ dựa vào SVG co tỷ lệ; bảng dữ liệu cung cấp giá trị tương đương.

Spacing dùng 4/8/12/16/20/24/32/48px. Control Admin cao 36px, biến thể compact có tên 32px; form mua hàng dùng mục tiêu tương tác ít nhất 44px. Radius control chung 8px, overlay tối đa 12px; ảnh và khối nội dung storefront có thể 12–16px. Bảng dùng header tối thiểu 36px, hàng cơ sở 62px và tự tăng với nội dung dài; breakpoint rộng có thể dùng 68px qua token chung. Viền 1px và thay đổi surface tạo phân cấp; shadow chỉ dành cho overlay hoặc nội dung nổi thực sự.

## 4. Bố cục sản phẩm

### Admin

Workspace có rail/sidebar điều hướng, panel theo ngữ cảnh, topbar và vùng nội dung. Các nhóm Vận hành, Danh mục và Hệ thống dựa trên quyền; logo và điểm vào workspace dẫn tới chức năng hợp lệ đầu tiên. Toolbar chứa tiêu đề, tìm/lọc và thao tác của màn; mỗi vùng cuộn có chủ sở hữu rõ, không che action chính.

| Mẫu               | Màn                                                           | Thành phần chính                                                                   |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tổng quan         | Overview                                                      | Nhóm việc, chỉ số và biểu đồ tiền, bảng tồn; trạng thái và quyền độc lập theo phần |
| Danh sách         | Products, Categories, Product types, Orders, Renewals, System | Toolbar, tìm/lọc, bảng, selection và pagination                                    |
| Editor            | Collections, System                                           | Rail bản ghi khi cần, toolbar và form nhóm rõ; metadata Catalog ở cuối form        |
| Chi tiết vận hành | Orders, Renewals                                              | Thông tin, lịch sử và action theo quyền; inspector chỉ khi hữu ích                 |
| Settings          | Cài đặt thanh toán                                            | Form theo nhóm, trạng thái lưu và lỗi độc lập                                      |
| Công cụ           | UI Kit                                                        | Control thật cùng preset sản phẩm, đủ trạng thái và overlay                        |

Resize/collapse panel có giá trị và accessible name; thao tác kéo có lựa chọn bàn phím và cleanup. Rail bản ghi có thể chuyển thành drawer ở tablet. Footer và help mô tả đúng ngữ cảnh; màn chỉ đọc không hứa hẹn thao tác lưu. Giữ query tìm/lọc/trang, dirty guard và draft theo hợp đồng từng feature.

### Storefront editorial

Header/footer cửa hàng dùng cùng palette nhưng không mang chrome Admin. Catalog ưu tiên tìm và chọn sản phẩm, ảnh thật và giá rõ; product detail ghép gallery, lựa chọn, tồn và action mua. Cart, checkout, OTP, My Orders và order detail thể hiện bước hiện tại, chi phí, kết quả và cách tiếp tục. Ảnh API là nguồn chính, fallback có ý nghĩa; nội dung không tự bịa khuyến mãi, đánh giá hoặc tồn.

### Đăng nhập và lỗi

Login và forbidden dùng chung typography, focus, label và feedback; khôi phục phiên/deep link giữ hành vi hiện tại. Forbidden cung cấp đường tới chức năng được phép. Loading, restore lỗi và retry phải có thông báo phù hợp, không hiển thị dữ liệu chưa được quyền xem.

Desktop 1440×900 và tablet 1024×768 là viewport nghiệm thu; storefront bổ sung mobile 390×844 và 360×800, Admin mobile chưa thuộc đợt tối ưu. Mốc tablet của các rail và inspector cần giữ nội dung và action truy cập được. Bảng rộng cuộn trong vùng có tên truy cập, không dùng document overflow để che cột.

## 5. Components và trạng thái

Admin dùng control PrimeNG trực tiếp; preset và token quyết định diện mạo của button, input, textarea, select/multiselect, checkbox, switch, datepicker, table, pagination, tabs, tag, dialog/drawer, tooltip, toast/message và upload. UI Kit cho thử từng biến thể thật, không chỉ ảnh mô phỏng. Storefront dùng các control HTML có ngữ nghĩa và style dùng chung trong phạm vi cửa hàng, cùng token cho màu, trạng thái và focus.

- **Navigation và toolbar:** nhóm chức năng theo quyền; logo dẫn về điểm vào Admin phù hợp. Tiêu đề và thao tác của bản ghi nằm gần nội dung đang xử lý; tìm kiếm, lọc và pagination giữ ngữ cảnh URL. Chỉ hiện thao tác người dùng có quyền thực hiện.
- **Bảng và ma trận quyền:** dùng chiều cao hàng chung, cho phép nội dung dài xuống dòng và cuộn trong vùng có tên truy cập khi cần. Căn số liệu nhất quán, giữ header rõ và hiển thị trạng thái bằng chữ. Ma trận quyền giữ nhóm chức năng và nhãn hành động dễ quét; thao tác trên nhóm đang lọc phải giữ các quyền bị ẩn.
- **Form:** nhóm các trường theo việc cần làm, đặt metadata Catalog cuối form. Label hiển thị độc lập với placeholder; liên kết mô tả và lỗi với trường tương ứng. Giữ bản nhập khi validation, mạng hoặc xung đột thất bại; thông báo lưu chỉ xuất hiện sau phản hồi thành công.
- **Dialog, drawer và popover:** dùng overlay của thư viện với tên truy cập và Escape. Dialog/drawer dạng modal giữ focus bên trong và trả focus khi đóng; popover và dropdown mở ngoài vùng cuộn, không bị cắt và kế thừa theme root.
- **Thông báo và biểu đồ:** thông báo theo đúng vùng dữ liệu, có hành động thử lại khi phù hợp và không chỉ dựa vào màu. Biểu đồ phải đọc được nhãn ở tablet, có bảng dữ liệu tương đương và truy cập bằng bàn phím.

| Trạng thái                       | Hành vi và phản hồi                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Default, hover, active, selected | Giữ geometry; nhấn thể hiện trọng tâm hoặc lựa chọn, không chỉ dựa vào màu                   |
| Focus                            | Ring tối thiểu 2px rõ, không bị clip; thao tác đầy đủ bằng bàn phím                          |
| Disabled / readonly              | Disabled không thao tác; readonly vẫn có thể đọc và copy nếu control hỗ trợ                  |
| Loading / saving                 | Thông báo theo vùng, giữ ngữ cảnh, chặn gửi lặp                                              |
| Empty / filter-empty             | Giải thích trạng thái và cung cấp hành động phù hợp hoặc xóa lọc                             |
| Error / retry / forbidden        | Thông điệp an toàn, có retry theo vùng khi thích hợp; phần không được quyền ẩn               |
| Invalid / conflict               | Label và lỗi liên kết bằng aria-invalid/aria-describedby; giữ draft và chỉ ra cách xử lý 409 |
| Dirty / saved                    | Cảnh báo rời màn khi có thay đổi chưa lưu; chỉ báo đã lưu sau phản hồi server                |

Thông báo lưu/lỗi không chiếm focus bất ngờ. Quyền thao tác được kiểm ở cả UI và BE; dữ liệu tài chính, hàng số và gia hạn tuân theo hợp đồng hiện hành.

## 6. Motion và style ownership

Tokens motion hiện tại 120/180/240ms cho phản hồi nhỏ, thay trạng thái và panel; ưu tiên opacity/transform. Kéo resize bám pointer, không tween; prefers-reduced-motion rút ngắn chuyển động mà vẫn giữ phản hồi trạng thái. Không thêm animation mở trang làm chậm thao tác Admin.

- Tokens và geometry: src/styles/tokens; preset PrimeNG: src/app/core/theme/workspace-preset.ts.
- Danh sách, toolbar, khung bản ghi và form: src/styles/admin/_collections.scss, _forms.scss; style màn chỉ mô tả composition đặc thù.
- Storefront: src/styles/storefront, chia theo chrome, catalog/product, checkout và orders; nạp khi vào StorefrontShell. Selector phạm vi `.storefront-app`; overlay gắn body dùng class riêng và token/preset root.
- Không dùng ::ng-deep, selector trần toàn cục hoặc override !important để thắng preset. Các ngoại lệ [hidden] và reduced motion có thể dùng khi cần giữ hành vi accessibility.

## 7. Kiểm chứng

Review UI Kit, Tổng quan, list/editor Catalog, Orders/Renewals, System, settings, login/forbidden và hành trình mua ở 1440×900 và 1024×768, Light/Dark/System. Kiểm tra dialog/dropdown gắn body, panel resize/collapse, scroll, keyboard/focus, nội dung Việt dài và đủ trạng thái. Chạy FE check, browser E2E và live acceptance trên SQL Server test cô lập; soát permission, deep link/Back, save/dirty guard, 409 và lỗi mạng.

Review ảnh thực tế trước khi cập nhật baseline. Đo bundle/CSS/font và giữ nguyên budget; ghi rõ kết quả thực chạy, source, môi trường và các phạm vi chưa nghiệm thu trong báo cáo theo [quy tắc docs](docs/README.md#quy-tắc-duy-trì-docs).
