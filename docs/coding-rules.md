# Quy tắc code Angular

Áp dụng bắt buộc cho code mới và phần đang refactor. Quy tắc này và `AGENTS.md` là tiêu chuẩn review; không coi việc tạo folder hoặc cập nhật tài liệu là đã triển khai kiến trúc.

1. **Chốt cấu trúc trước khi viết màn.** Xác định route, model, enum/constants, form, data service, owner của state và các component trình bày. Chỉ tạo tầng có code thật; hoàn thành một luồng chạy được và kiểm thử được trước khi mở rộng.
2. **Đặt tên theo chức năng.** Danh sách: `features/<feature>/pages/<feature>/<feature>.ts`, class PascalCase; thêm/sửa/chi tiết: `<feature>-io`. Ví dụ `content` / `content-io`, `Content` / `ContentIo`. Component con dùng tên chức năng như `content-toolbar`, `content-table`, `content-form`, `content-inspector`. Không dùng tên `list`, `detail`, `manager` chung chung.
3. **Page chỉ điều phối view và route.** Không chứa fixtures, endpoint, HTTP, lọc/phân trang nghiệp vụ, thao tác lưu hoặc cấu hình danh mục. Component trình bày dùng typed input/output; không inject store/service ứng dụng. Hành vi focus, overlay, tab mở/đóng được giữ tại view.
4. **Phân lớp như BE.** Model/enum là hợp đồng; store điều phối use case và trạng thái; data service là boundary; implementation mock/HTTP là adapter; route/provider là composition. Luồng chính: `Page → Store → ContentService → implementation`. Không đưa domain vào `shared` hoặc tạo base CRUD/component tổng quát.
5. **Không khai báo enum, interface, options hoặc cấu hình nghiệp vụ trong component.** Tập giá trị ổn định có tên dùng string enum trong `enums/*.enum.ts`; interface/type trong `models/`; nhãn, dropdown options, tabs, columns, giới hạn và thời lượng có ý nghĩa trong `constants/*.constants.ts`. Dùng `readonly`, `as const`/`satisfies` phù hợp. Số học đơn giản và trạng thái mở/đóng của view không phải enum. Không tạo enum giả cho nội dung tự do.
6. **Import có phạm vi và thứ tự.** Giữ standalone và lazy routes của Angular hiện tại. Nhóm imports: Angular/CDK → RxJS/PrimeNG → shared/core → feature. `@Component.imports` chỉ chứa dependency template dùng thật; ưu tiên standalone control/directive khi thư viện hỗ trợ. Tách component theo trách nhiệm khi template/imports lớn; không gom mọi PrimeNG module vào một `SharedModule` hoặc mảng global để che phụ thuộc. File imports riêng chỉ dùng khi một nhóm thực sự dùng lại.
7. **Store có owner và vòng đời.** Store màn hình cung cấp ở page; dữ liệu/session chung ở route. State bên ngoài chỉ đọc; thay đổi qua method rõ nghĩa. Async phải có loading/error, hủy load cũ, chặn submit lặp, giữ dirty form nếu save lỗi hoặc có edit mới. Không dùng root singleton cho mọi store và không tạo store chỉ chuyển tiếp từng method service.
8. **HTTP qua một nền chung.** Feature service dùng composition với `core/http/ApiClient`, runtime config và functional interceptor. DTO, UI model và form value tách theo hợp đồng thật; chưa có BE thì không đoán endpoint. Không tự retry mutation, toast mọi lỗi hoặc gắn auth giả. Query/pagination theo hợp đồng BE, không hard-code base URL trong feature.
9. **Form và theme có nguồn chung.** Typed form factory + validators ở `forms/`; giới hạn chung ở constants; thông báo lỗi dùng shared presentation. PrimeNG tùy biến qua preset/tokens và SCSS đúng phạm vi. Giữ Webflow workspace, System/Light/Dark, normal animation và overlay/focus hiện có.
10. **Definition of done là source và bằng chứng.** Route phải dùng component/store/service đã tách; xóa implementation cũ. Format, lint boundaries, unit tests theo hành vi và production build đạt; thay đổi cấu trúc UI chạy browser regression theo phạm vi mốc đã chốt. Hiện ưu tiên web desktop/tablet ở hai theme; mobile tối ưu và nghiệm thu sau theo yêu cầu ngày 20/10. Commit nhỏ theo hành vi, cập nhật history cùng code; chỉ ghi CI đạt sau khi có run thực tế.

## Style của class và thiết kế base

- Khai báo fields trước constructor/lifecycle, rồi event handlers/public API, cuối cùng private helpers. Trong fields nhóm dependencies → input/output/view queries → enum/constants aliases → state/computed. Không xen khai báo cấu hình giữa các method. Dùng tên hành động cụ thể (`save`, `archiveSelected`, `resolveLeave`); helper chỉ phục vụ nội bộ là `private`. Dùng `readonly` với reference không gán lại và khai báo return type của method.
- Constructor chỉ nối DI/subscriptions, side effects khởi tạo có cleanup. Dùng `inject` và `takeUntilDestroyed` nhất quán với Angular hiện tại; không buộc mọi component phải khai báo `Subject` và `ngOnDestroy` chỉ để hủy subscription.
- Base HTTP là transport không giữ state của tính năng: mỗi request nhận resource/options/body riêng, không có `setUrl` hay model/grid/search state thay đổi dùng chung giữa requests. `HttpParams` giữ việc encode query; functional interceptor chuẩn hóa lỗi; DTO mapping thuộc feature service. Dữ liệu bảng và pagination UI không được đưa vào base HTTP.
- Service được resolve qua DI với scope rõ ràng. Facade chỉ có khi điều phối nhiều nguồn, không làm factory tự `new` từng service. Mock và HTTP triển khai cùng contract khi có hợp đồng API; không đưa base CRUD/inheritance vào mọi màn chỉ để đồng dạng.
- Imports phản ánh dependency thực. Gallery chủ đích trưng bày nhiều control nên có nhiều imports; màn nghiệp vụ chia toolbar/table/form/inspector để giảm trách nhiệm. Không đánh giá kiến trúc chỉ bằng số dòng imports.

Đã đối chiếu NanoFE local tại `D:/VNPT/MoiTruong/frontend/VNPT-iNRES.NanoFE/app/projects/libs/core/src/lib`: `base.service.ts`, `base-repository.service.ts`, `services/danhmuc/donvido.service.ts`, `danhmuc-facade.service.ts`, model input/output, enums và màn `chu-co-so-io`. Điểm áp dụng là phân vai base/service/model/constants, input/output có kiểu và tên hành động. Quyết định riêng của dự án này là composition, request độc lập, DI và feature state tách khỏi transport. Không nhập source NanoFE vào repository.

## Cấu trúc feature áp dụng

```text
features/content/
  content.routes.ts
  content.providers.ts
  index.ts
  enums/
  constants/
  models/
  forms/
  data-access/
  state/
  services/
  navigation/
  guards/
  pages/content/
  pages/content-io/
  components/content-toolbar/
  components/content-table/
  components/content-form/
  components/content-inspector/
```

`index.ts` chỉ export điểm ghép ứng dụng, không export toàn bộ nội bộ. Lint kiểm tra cả relative import và alias: core/layout/shared không phụ thuộc feature; page không vào data-access; component không vào state/service; state không biết mock/fixture; feature không đọc nội bộ feature khác. Những tiêu chí cần judgment như quy mô component và lựa chọn enum được review cùng diff, không tuyên bố lint tự kiểm tra được tất cả.

Tham khảo: [eco-fe](https://github.com/vuongnv1206/eco-fe), đã đọc bản local có remote trùng repo: role page/store/service, models/constants và composition của SystemModule; BE hiện tại: `Application/Identity/Roles/IRoleService`, `Domain/Catalog` enums, `Host/Controllers/Catalog/ProductsController` và Infrastructure adapters. Áp dụng phân vai và quy trình; giữ quyết định standalone của dự án FE hiện tại.
