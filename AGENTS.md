# Quy tắc Frontend (`Frontend/`)

Đây là repository **Frontend `Angular 22` + `PrimeNG 22`**. Chỉ triển khai giao diện UI/UX (Admin & Storefront), client state (`signals` / stores) và tích hợp HTTP API tại đây — **tuyệt đối không viết server API, database hay tạo tài liệu nghiệp vụ rời trong repo này**.

## Đọc trước khi sửa code

1. Luật gốc của workspace: [../AGENTS.md](../AGENTS.md)
2. Luật kỹ thuật Frontend & SCSS chi tiết: [../agents/frontend.md](../agents/frontend.md) và quy trình tài liệu: [../agents/workflow-and-docs.md](../agents/workflow-and-docs.md)
3. Định hướng sản phẩm & Hệ thiết kế chuẩn (giữ tại root `Frontend/` cho context loader): [PRODUCT.md](PRODUCT.md) và [DESIGN.md](DESIGN.md)
4. Nguồn tài liệu nghiệp vụ & API duy nhất: [../docs/README.md](../docs/README.md)
5. Skills giao diện local: [.agents/skills/admin-ui-design/SKILL.md](.agents/skills/admin-ui-design/SKILL.md), `.agents/skills/impeccable/SKILL.md`, `.agents/skills/frontend-design/SKILL.md`

## Nguyên tắc bắt buộc

- **Cấu trúc & Kiến trúc**: Mỗi phân hệ chỉ có màn danh sách và màn `-io`; dùng `ChangeDetectionStrategy.OnPush` + `signals`; tuân thủ 43 quy tắc ranh giới lớp (`npm run test:architecture`) và hệ semantic tokens chung (kiểm tra cả `Light` và `Dark`).
- **Môi trường Local**: Dev server chạy tại `http://localhost:4200` chuyển tiếp `/api/**` sang Backend SQL Server local tại `http://localhost:5000`; không dùng Docker hay cấu hình deployment tại giai đoạn này.
- **Giữ sạch repo**: Mọi tài liệu cập nhật tại `../docs/`; không tạo lại `Frontend/docs/` hay `Frontend/deployment/`, không để lại script `.mjs`/`.py` dùng một lần trong `artifacts/`. `AGENTS.md` và `CLAUDE.md` phải giống nhau 100%.
