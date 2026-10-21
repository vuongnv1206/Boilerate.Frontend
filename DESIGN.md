# Boilerate Admin — Webflow workspace reference

Áp dụng cho nền UI quản trị và các màn Collections. [PRODUCT.md](PRODUCT.md) giữ phạm vi, [tài liệu tính năng](docs/README.md) giữ hành vi và [nguồn tham chiếu](design/references/README.md) giữ provenance; tài liệu này là chuẩn thị giác.

## 1. Định hướng và độ tin cậy của tham chiếu

Tham chiếu chính là Webflow **CMS/Ecommerce workspace**, với chrome compact và dữ liệu là trọng tâm. Tài liệu Webflow hiện hành xác nhận top navigation/context bar, công cụ bên trái và panel bên phải; luồng CMS mở Collection rồi mở item để chỉnh. Chúng là cơ sở bố cục và tương tác, không cung cấp một bộ design tokens có thể sao chép trực tiếp. [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow), [content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor).

Webflow đã có lựa chọn System/Light/Dark cho giao diện; dự án áp dụng ba lựa chọn này. Không thêm các biến thể độ sáng Darker/Brighter trong mốc đầu. [Webflow theme update](https://webflow.com/updates/light-and-dark-themes-across-webflow).

Các kích thước dưới đây là **baseline triển khai do dự án chọn**, dựa trên cấu trúc và tỷ lệ quan sát; chưa phải số đo pixel từ ảnh Webflow. Giữ cơ chế điều chỉnh tập trung bằng tokens. Ảnh bản dựng sẽ là baseline hồi quy của dự án; không gọi đó là ảnh tham chiếu chính chủ hoặc bằng chứng pixel-perfect.

GetDesign Webflow trong thư viện local phân tích website marketing. Chỉ dùng màu nhấn, tính sắc nét và radius để tham khảo; typography hero, hover dịch 6px và bóng nhiều lớp không đưa vào admin. Impeccable `product` bổ sung hướng dẫn về mật độ và tính quen thuộc; phần motion bổ sung thời lượng, easing và reduced motion. [Provenance](THIRD_PARTY_NOTICES.md).

## 2. Workspace và tỷ lệ

| Vùng               | Baseline                                                              | Hành vi                                                                     |
| ------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Icon rail          | 44px                                                                  | Full-height; logo dự án, action icon có tooltip; trạng thái active rõ       |
| Topbar             | 44px                                                                  | Mỏng, tên workspace và ngữ cảnh; action ngắn gọn phía phải                  |
| Panel ngữ cảnh     | 240px, min 200px, max 320px                                           | Điều hướng theo nhóm; kéo mép phải để resize; thu gọn và nhớ kích thước     |
| Toolbar vùng chính | Khoảng 48px, tăng khi cần wrap                                        | Tiêu đề, search/filter và action của màn hiện tại                           |
| Rail sản phẩm      | 218px desktop; 240px overlay tablet                                      | Giữ danh sách và bộ lọc cạnh editor; tablet mở bằng panel có focus trap     |
| Control            | 30px chuẩn desktop                                                    | Form, toolbar và bảng dùng cùng nhịp; textarea/đa dòng tự mở rộng           |
| Bảng               | Header 34px; dòng 62px cho fixture hai dòng (68px từ viewport 1500px) | Thumbnail 36px; tên chính 13px, metadata 11px; viền ngang mảnh; số căn phải |

Shell chiếm viewport, tránh scroll cả document trên desktop. Panel và phần nội dung cuộn trong vùng sở hữu; header/toolbar giữ ổn định. List dùng hết vùng chính, không bọc trong card lớn. Catalog editor giữ rail sản phẩm bên trái; metadata nằm ở cuối form và không lặp thành inspector.

Mốc responsive triển khai: tối đa 1150px, rail sản phẩm chuyển thành panel overlay; tối đa 760px, toolbar và form co lại. Rail/action vẫn truy cập được; bảng được cuộn ngang trong container có tên truy cập. Không ẩn dữ liệu quan trọng chỉ để làm ảnh gọn. Control và hit target ở màn nhỏ tăng tới ít nhất 40px. Các breakpoint và hit target này đã có CSS/unit coverage, chưa được nghiệm thu browser mobile.

Resize có pointer capture/cleanup; giới hạn min/max và bảo vệ khi storage không khả dụng. Separator có accessible name, `role="separator"`, giá trị hiện tại và hỗ trợ ArrowLeft/ArrowRight; có nút thu gọn/mở thay cho kéo. Preference không chứa nội dung form.

## 3. Typography, spacing và hình dáng

- Một họ sans dễ đọc tiếng Việt. Ưu tiên Inter tự host nếu có font được cấp phép; fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Không dùng font Webflow độc quyền nếu chưa có quyền.
- Body/control và tên chính trong list 13px, line-height 1.45–1.5; label/caption 12px; section title 14px/600; page title 20–23px/600 theo màn/viewport. Tối thiểu 11px dành cho chrome/metadata phụ; input, tên bản ghi chính và lỗi quan trọng giữ cỡ đọc rõ.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32px. Toolbar có thể dùng khoảng 6px giữa icon và chữ. Form label cách input 6px, trường cách nhau 16px.
- Radius chính 4px; nhóm panel 0; badge 3–4px; dialog tối đa 8px. Icon cùng hệ outline, 16px phổ biến, stroke nhất quán. Không dùng nhiều emoji thay icon.
- Viền 1px ngăn vùng; bóng chỉ để tách overlay nổi. Tránh gradient, glass, card bóng đậm và góc pill trên control vận hành.

## 4. Theme và tokens

Ba lớp: **primitive → semantic → component**. Primitive định nghĩa thang neutral, blue và semantic status; semantic đặt tên theo vai trò; component map vào PrimeNG preset và UI riêng. Light/Dark thay semantic values, không đổi cấu trúc màn.

| Vai trò                    | Light baseline              | Dark baseline |
| -------------------------- | --------------------------- | ------------- |
| Canvas                     | `#f7f7f8`                   | `#1b1b1d`     |
| Surface/panel              | `#ffffff`                   | `#242426`     |
| Surface nhô/hover          | `#efeff1`                   | `#2e2e31`     |
| Text chính                 | `#242427`                   | `#eeeeef`     |
| Text phụ                   | `#5e5e65`                   | `#b4b4bd`     |
| Text muted                 | `#73737b`                   | `#96969f`     |
| Border phân vùng           | `#dedee3`                   | `#39393e`     |
| Border input cần nhận biết | `#92929b`                   | `#73737d`     |
| Accent/selection           | Webflow-like blue `#146ef5` | `#77a8ff`     |
| Chữ trên accent            | `#ffffff`                   | `#081a36`     |

Bảng đồng bộ tokens triển khai, có thể tinh chỉnh qua kiểm tra. Màu nhấn dùng cho primary action, active selection và focus. Status có cả chữ/icon, không chỉ chấm màu. Primary button dùng `on-accent` theo theme: text trắng trong Light, text xanh rất đậm trong Dark để giữ tương phản.

Theme state là `system | light | dark`, mặc định `system`. Đọc preference và media query trước paint, đặt root theme/color-scheme; ứng dụng dùng cùng nguồn state, theo dõi system khi ở chế độ system, và nhận thay đổi giữa tab. Storage hỏng/không cho phép phải fallback an toàn. Dialog/menu/select/datepicker/tooltip/toast appended vào body vẫn theo root theme.

Target: chữ thường 4.5:1, chữ lớn 3:1; focus/icon/border cần thiết nhận biết control 3:1 với nền kề. Viền phân vùng trang trí có thể nhẹ hơn. [WCAG text](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## 5. Bộ control và trạng thái

PrimeNG cung cấp hành vi; preset của dự án quyết định diện mạo. Dùng chung token cho button, input/textarea, number, select/multiselect, checkbox, switch, date picker, table/pagination, tabs, dialog/drawer, tooltip, toast/message và upload khi có trong gallery.

| Trạng thái           | Quy tắc                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| Default/hover/active | Viền và nền thay nhẹ; geometry ổn định; primary action giữ màu nhấn                     |
| Focus                | Ring 2px rõ, không bị vùng overflow cắt; keyboard không phụ thuộc hover                 |
| Disabled             | Vẫn đọc được; không nhận thao tác; không chỉ giả lập bằng CSS                           |
| Readonly             | Giá trị vẫn chọn/copy được khi control hỗ trợ; khác disabled                            |
| Invalid              | Viền semantic danger + thông báo ngay dưới trường; `aria-invalid` và `aria-describedby` |
| Loading              | Cấm submit lặp, giữ nhãn ngữ cảnh; skeleton cho vùng dữ liệu nếu cần                    |
| Selected             | Nền tint và indicator rõ; checkbox/bảng có tên truy cập                                 |

Mỗi trường có visible label. Placeholder chỉ gợi ý. Overlay có tên, Escape, focus trap/return theo hành vi PrimeNG; dropdown không bị bảng/panel clip. Tabs có key navigation và selected state. Error/toast không lấy focus đột ngột; trạng thái lưu dùng vùng thông báo phù hợp.

Control gallery phải cho thử trạng thái thay vì chỉ vẽ ảnh. Giữ gallery như công cụ review nội bộ, tách khỏi Catalog demo qua route riêng.

## 6. Danh sách, editor và ngôn ngữ UI

Danh sách: breadcrumb/tiêu đề, search tiếng Việt, filter trạng thái, chọn dòng, count và pagination. Cột tên có link mở editor; checkbox không vô tình mở dòng. Không có kết quả thì giữ query/filter và cho cách xóa bộ lọc.

Editor: quay lại danh sách, tên bản ghi, save status và action ở toolbar; form nhóm trường rõ; ảnh, options và bảng variants dùng chung bản nhập, metadata ở cuối. Collections lưu qua API thật; chỉ báo thành công sau phản hồi server. Validation chặn lưu thiếu trường; dirty state không bị mất âm thầm khi chuyển màn. Giữ trạng thái tìm/lọc/phân trang khi quay lại nếu màn hiện tại hỗ trợ. Gallery tiếp tục là nơi thử control.

Copy dùng tiếng Việt tự nhiên, ngắn gọn; tên nút là động từ gắn đối tượng. Nội dung dài wrap ở form, ellipsis ở cột có cách đọc đầy đủ. Ngày/số tiền theo locale Việt Nam; fixture phải có dấu và tên dài.

## 7. Motion

| Token  | Thời lượng | Dùng cho                               |
| ------ | ---------- | -------------------------------------- |
| Fast   | 120ms      | Hover, press, màu/viền, trạng thái nhỏ |
| Normal | 180ms      | Theme, tab, popover, phản hồi lưu      |
| Panel  | 240ms      | Drawer, panel mở/đóng                  |

Easing chuẩn `cubic-bezier(0.2, 0, 0, 1)` cho enter; exit ngắn hơn hoặc bằng enter. Ưu tiên opacity/transform. Không animate width khi người dùng đang kéo separator, tránh lag giữa pointer và panel. Không stagger hàng dữ liệu hay chạy animation trang lúc người dùng cần nhập.

Animation bình thường **bật mặc định**; không thêm switch giảm chuyển động hoặc yêu cầu người dùng đổi OS để nghiệm thu. CSS `prefers-reduced-motion: reduce` vẫn là fallback accessibility, rút ngắn chuyển động khi hệ điều hành yêu cầu; focus, loading label và save feedback vẫn hiểu được. OS-emulated reduced-motion QA đang hoãn. MotionSites là nguồn cảm hứng chuyển động, không quyết định stack Angular hoặc thêm thư viện nặng. Chưa có benchmark motion đo từ nguồn đó.

## 8. Review trước khi mở rộng màn

- Soát list, editor và ít nhất một overlay ở Light/Dark cùng viewport desktop 1440×900 và tablet 1024×768. Mobile hoãn theo yêu cầu hiện tại.
- Kiểm tra panel resize/collapse/reload, theme reload/system change, search/filter/page/selection, dirty/save và validation.
- Dùng bàn phím mở/đóng overlay và quay lại focus; kiểm tra tiếng Việt dài và normal motion đang bật. Giữ fallback reduced motion trong CSS; không yêu cầu OS-QA ở mốc này theo lựa chọn người dùng.
- Chụp ảnh bản dựng sau khi tương tác ổn định; soát tỷ lệ, alignment, contrast và các vùng scroll. Ảnh Webflow công khai có thể khác phiên bản/viewport: ghi rõ nguồn và giới hạn so sánh.
- Báo cáo kết quả thực sự chạy và khoảng trống trong bàn giao; chỉ giữ bằng chứng lâu dài khi cần theo [quy tắc docs](docs/README.md#quy-tắc-duy-trì-docs). Nghiệm thu thiết kế với người dùng và nghiệm thu deployment là trạng thái riêng.
