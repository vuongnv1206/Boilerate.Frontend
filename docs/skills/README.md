# Skills cài local

Ngày cài: 2026-11-04. Đây là bản chép vật lý từ checkout người dùng cung cấp, không phải symlink hoặc chỉ dẫn tới ổ D bên ngoài workspace.

- [admin-ui-design](../../.agents/skills/admin-ui-design/SKILL.md): hướng dẫn riêng dự án, có trước lần chuẩn hóa này.
- [impeccable](../../.agents/skills/impeccable/SKILL.md): nguyên gói 52 file, gồm scripts, reference và metadata.
- [frontend-design](../../.agents/skills/frontend-design/SKILL.md): skill dạng một file, giữ nguyên body; source chuyển vào metadata.source để tương thích validator Codex.

Nguồn và SHA-256 từng file nằm trong [sources.json](sources.json). Chưa chạy các helper bên thứ ba. Cài local không cấp quyền chạy script hay đổi thiết kế đã duyệt. PRODUCT.md, DESIGN.md và coding-rules.md vẫn quyết định sản phẩm. Hai file PRODUCT/DESIGN giữ ở root FE để tương thích context loader upstream.

Không cài brand-guidelines (branding Anthropic) hay theme-factory (chọn theme artifact) vì chúng không sở hữu hệ thiết kế hiện tại. Không sao chép plugin hệ thống của Codex: các plugin đó có runtime/công cụ riêng.

Checkout nguồn không có root LICENSE được tìm thấy; không khẳng định quyền tái phân phối. Đây là bản cài trong workspace của người dùng, chưa publish. Giữ frontmatter/source và mọi notice upstream; kiểm tra giấy phép nguồn trước khi phân phối ra ngoài.

Khi cập nhật: chọn revision nguồn, so sánh diff, thay gói local và tái tạo manifest hash; không tải bản mới tự động trong một nhiệm vụ UI. Codex dùng .agents/skills; Claude đọc CLAUDE.md để tìm cùng gói local. Không có bản sao .claude/skills tự đồng bộ.

Bản cài chuẩn hóa newline LF để hash ổn định sau Git checkout; bỏ trailing whitespace trong ba reference của Impeccable. `sourceSha256` giữ hash bytes nguồn, `sha256` là hash bản cài. Không đổi hành vi scripts.
