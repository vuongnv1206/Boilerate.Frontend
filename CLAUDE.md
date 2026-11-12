# Quy tắc Frontend (`Boilerate.Frontend/`)

Đây là repository **Frontend `Angular 22` + `PrimeNG 22`**. Chỉ triển khai giao diện (Admin và Storefront), client state (`signals` + base classes/services) và tích hợp HTTP/SignalR tại đây. **Không viết server API, database và không đặt tài liệu nghiệp vụ trong repo này.**

## Đọc trước khi sửa code

1. Luật gốc của workspace: [../AGENTS.md](../AGENTS.md)
2. Luật kỹ thuật Frontend: [../agents/frontend.md](../agents/frontend.md); quy trình và nơi ghi tài liệu: [../agents/workflow-and-docs.md](../agents/workflow-and-docs.md)
3. Định hướng sản phẩm và hệ thiết kế (giữ ở gốc repo vì skill thiết kế đọc tại đây): [PRODUCT.md](PRODUCT.md) và [DESIGN.md](DESIGN.md)
4. Tài liệu nghiệp vụ và API: [../docs/README.md](../docs/README.md)
5. Skills giao diện: [.agents/skills/admin-ui-design/SKILL.md](.agents/skills/admin-ui-design/SKILL.md), `.agents/skills/impeccable/SKILL.md`, `.agents/skills/frontend-design/SKILL.md`

## Nguyên tắc bắt buộc

- **Cấu trúc**: 14 domain khớp 1-1 với Backend, tách tầng Presentation (`src/app/modules/<domain>/`, chỉ component và routes) với tầng Data (`src/app/api/<domain>/`, DTO và service). Không dùng barrel `index.ts` trong `modules/` và `api/`. Component con, dialog, panel nằm trong thư mục component cha. Base chỉ gồm `BaseComponent` và `BaseRouteListComponent` ở `src/app/core/base/`; service inject `ApiService` và editor (`-io`) tự viết `loadDetail()` / `saveChange()` tường minh, không kế thừa base CRUD hay base editor. **Không dùng store (`*.store.ts`)**. Dùng `SHARED_IMPORTS` và `constructor(...)` tường minh. Repo không có `*.spec.ts`; cho phép `any`.
- **Ranh giới và giao diện**: tuân thủ ranh giới lớp (`npm run test:architecture`) và hệ semantic tokens chung; kiểm cả Light và Dark.
- **Môi trường local**: dev server `http://localhost:4200` chuyển `/api/**` và `/hubs/**` sang Backend tại `http://localhost:5000`. Không dùng Docker hay cấu hình deployment ở giai đoạn này.
- **Giữ sạch repo**: tài liệu cập nhật tại `../docs/`; không tạo lại `Boilerate.Frontend/docs/` hay `deployment/`; không để script `.mjs`/`.py` dùng một lần trong `artifacts/`. Commit không gắn `Co-Authored-By` của công cụ AI. `AGENTS.md` và `CLAUDE.md` phải giống nhau 100%.
