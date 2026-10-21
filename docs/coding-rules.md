# Quy chuẩn codebase và hướng dẫn triển khai FE

Đây là rulebook chính cho cách viết, review và mở rộng FE Boilerate. Áp dụng cho source hiện tại và màn mới. [Kiến trúc](architecture.md) chỉ là bản đồ triển khai; [DESIGN](../DESIGN.md) và [SCSS](scss-rules.md) sở hữu tokens và diện mạo. Không tạo bộ coding rules riêng cho từng feature hoặc công cụ.

Giữ Angular 22, PrimeNG, standalone, strict TypeScript/templates và hướng Webflow. Các bài học từ Môi Trường được áp dụng ở mức nguyên tắc: kiểm chứng contract trước khi viết, mỗi dữ liệu có owner rõ, nghiệp vụ độc lập, shared có phạm vi và kiểm tra xuyên suốt luồng được gọi. Không mang các lớp repository/base CRUD hay kiểu `any` của Angular cũ sang đây.

## 1. Cấu trúc cố định và nơi đặt code

Dùng **folder chung theo loại**. Không đặt lại `models/services/stores/forms` bên trong từng feature; không tạo lớp hoặc thư mục rỗng để đủ sơ đồ.

```text
src/app/
  core/          # Runtime config, HTTP, auth/session, theme
  layout/        # Shell và bố cục ứng dụng
  shared/
    ui/          # Trình bày tái sử dụng, không biết nghiệp vụ
    forms/       # Helpers form không biết nghiệp vụ
  constants/
  enums/
  models/
  services/
  stores/
  forms/
  guards/
  utils/
  features/
    collections/
      collections.routes.ts
      products/
        products.component.ts
        products.component.html
        product-io/
          product-io.component.ts
          product-io.component.html
      categories/             # categories + category-io
      product-types/          # product-types + product-type-io
src/tests/components/         # Test component cần thiết, tách khỏi thư mục component
```

Một component màn hình cần một file nguồn `.component.ts` và một template `.component.html` khi template đủ lớn để tách file. Không tạo `.spec.ts` hay `.scss` kèm mỗi component. Generator đã đặt `type: component`, `addTypeToClassName: false`, `style: none`, `skipTests: true`, nên file mới luôn có `.component.ts` nhưng class vẫn giữ tên chức năng. Kiểm thử component có hành vi đáng bảo vệ đặt tại `src/tests/components`; test store/form/service/helper nằm cạnh logic tương ứng. Shared nhỏ có thể dùng template inline; khi đó vẫn giữ hậu tố `.component.ts`, không tạo file bổ sung chỉ để đủ mẫu.

| Code cần thêm                   | Nơi đặt và tên ví dụ                                                             |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Route + màn danh sách           | `features/collections/categories/categories.component.ts`, `.component.html`     |
| Màn thêm/sửa                    | `categories/category-io/category-io.component.ts`, `.component.html`             |
| DTO request/response            | `models/category.dto.ts`                                                         |
| State/dữ liệu riêng FE          | `models/list-query.model.ts`                                                     |
| Endpoint                        | `services/categories.service.ts`                                                 |
| State màn và request            | `stores/categories.store.ts`, `category-io.store.ts`                             |
| Typed form, validators, mapping | `forms/category.form.ts` hoặc `forms/product-form.model.ts` khi kiểu form đủ lớn |
| Options/limits/field aliases    | `constants/category.constants.ts`                                                |
| Wire enum                       | `enums/product.enum.ts`                                                          |
| Route permission/dirty guard    | `guards/permission.guard.ts`, `unsaved-changes.guard.ts`                         |
| Thuật toán thuần                | `utils/list-query.util.ts`, `text.util.ts`                                       |
| Thông báo form chung            | `shared/forms/validation-message.ts`                                             |
| Hiển thị lỗi chung              | `shared/ui/form-error-summary/`                                                  |

Infrastructure nằm trong boundary chuyên môn của nó: `core/http/api-url.ts` là HTTP helper, `shared/forms/apply-server-errors.ts` là form helper, `shared/ui/focus-when-visible.ts` là DOM helper. Không chuyển các file này vào `utils` chỉ vì nhiều nơi gọi.

## 2. Naming, imports và phụ thuộc

File/folder dùng kebab-case, type/class PascalCase, field/method camelCase. Danh sách mang tên chức năng ở số nhiều (`Products`); thêm/sửa dùng `ProductIo`. **Mọi file định nghĩa Angular component phải có hậu tố `.component.ts`; template ngoài phải có hậu tố `.component.html`** (`products.component.ts` + `products.component.html`, `product-io.component.ts` + `product-io.component.html`, `content-state.component.ts` + `content-state.component.html`); không để component ở file `.ts` chung tên mà thiếu hậu tố. Tên class giữ theo chức năng (`Products`, `ProductIo`, `ContentState`) để import dễ đọc. Các lớp có vai trò dùng hậu tố rõ: `ProductsService`, `ProductIoStore`; file `.service`, `.store`, `.form`, `.dto`, `.model`, `.constants`, `.enum`, `.util`, `.guard`. Tránh `CommonService`, `DataHelper`, `BaseCrud`, `Manager` không nói rõ công việc.

Dùng aliases `@core`, `@layout`, `@shared`, `@constants`, `@enums`, `@models`, `@services`, `@stores`, `@forms`, `@guards`, `@utils`, `@features`, `@app`. Relative import phù hợp cho file cùng boundary/thư mục; không đi vòng qua relative import để né rule. Imports theo nhóm Angular → RxJS/PrimeNG → core/shared → nghiệp vụ. Dùng `readonly` cho dependency/state không thay tham chiếu; public methods có return type.

Luồng nghiệp vụ là **component → store → service → ApiClient → BE**. App composition kết nối routes, DI và navigation. Routes được phép cung cấp service theo route; screen chỉ gọi store. Không gọi service/HttpClient/ApiClient trực tiếp trong screen.

| Boundary                 | Được biết                                    | Không được biết                                                |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------- |
| `core`                   | Infrastructure và data contracts             | Store, feature, layout                                         |
| `layout`                 | Core, shared UI, navigation contract         | Screen/service/store nghiệp vụ                                 |
| `shared/ui`              | Angular, PrimeNG, shared UI khác             | Core auth, DTO Catalog, store/service và HTTP                  |
| `shared/forms`           | Angular forms, cấu trúc lỗi do caller truyền | API, model HTTP của core, nghiệp vụ                            |
| `features`               | Store, form, data, shared UI, route          | API service/HTTP và private screen của feature khác            |
| `stores`                 | Service, forms, core session, data           | Router, DOM, component                                         |
| `services`               | ApiClient, DTO và core                       | View/store, toast, navigation                                  |
| `forms`                  | Angular forms, DTO/data, pure utils          | Store, HTTP, router                                            |
| `models/enums/constants` | Data contracts phù hợp                       | View/store/runtime                                             |
| `utils`                  | Data và hàm thuần                            | DI, Angular, HTTP, router, storage, DOM, state có thể thay đổi |

ESLint kiểm tra imports cả alias lẫn relative; `scripts/check-boundaries.mjs` đưa các vi phạm mẫu vào lint để chắc rule thực sự chặn. Không khóa cứng số component; màn mới hợp lệ phải qua cùng rule. Kiểm tra tự động không chứng minh hết semantics: review vẫn cần xem owner, side effects và luồng gọi.

## 3. Component, lifecycle và cách tách

Component standalone, `ChangeDetectionStrategy.OnPush` (cũng là mặc định Angular 22; source khai báo rõ để nhất quán), selector màn `app-…`. File nguồn luôn có `.component.ts`; template ngoài dùng `.component.html` cùng thư mục. Shared component dùng `ui-…`, typed `input()`/`output()`; caller quyết định quyền và truyền dữ liệu. Không tạo `SharedModule` chứa mọi PrimeNG control. Dùng API control PrimeNG trực tiếp, không bọc lại chỉ để đổi tên input/output.

Thứ tự thành viên: **injection/fields/form/computed → constructor → lifecycle → public handlers → private helpers**. Field được tạo trước listener sử dụng nó. Constructor chỉ thiết lập effect/cleanup phụ thuộc injection context; `ngOnInit` đăng ký route và gọi initial load tại một nơi. Khi route đổi `:id`, hủy read cũ và load lại; không vừa gọi constructor vừa `ngOnInit` vừa effect cho cùng lần load.

```typescript
readonly store = inject(CategoryIoStore);
readonly form = createCategoryForm();
private readonly destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.store.setForm(this.form);
  this.route.paramMap.pipe(
    map(params => params.get('id') ?? 'new'),
    distinctUntilChanged(),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe(id => this.store.load(id));
}
```

Toolbar, bảng, form và inspector nhỏ nằm trong màn. Tách component con khi có vòng đời/tương tác độc lập đáng kể hoặc có chỗ tái sử dụng thật. Component con riêng nghiệp vụ ở cùng feature; chỉ đưa lên shared khi không cần biết Catalog/auth/store. Không tách để giảm vài chục dòng HTML hoặc chuẩn bị cho nhu cầu giả định. Không dùng base component để chia lifecycle.

Dùng native link cho navigation, button cho action; mỗi control có label, help/error liên kết bằng ID. Icon-only cần accessible name. Overlay theo theme root, kiểm tra focus khi mở/đóng, Escape và keyboard. `effect` dùng cho side effect cần thiết; derived state dùng `computed`, tránh effect copy qua lại hai state cùng nghĩa.

## 4. Ownership, store và concurrency

Component sở hữu instance form và điều hướng. Store màn cung cấp tại component; service tại route khi cần dùng chung trong route đó. Session/theme là infrastructure singleton; dữ liệu màn không mặc định singleton. Mỗi state chỉ có một nguồn: query ở URL, selection ở list store, draft trong form, bản canonical/version trong editor store.

Store trả readonly signals; mutable signals là private. Store sở hữu requests, loading/error, draft baseline, revision và cancellation. `load()` là command; `save()` trả **cold Observable của DTO đã lưu**, chỉ phát khi thành công. Component subscribe để điều hướng sau kết quả; không callback router truyền vào store, không Promise bọc Observable. `EMPTY` cho invalid/busy/no permission hoặc lỗi đã hiển thị, nên không giả một DTO khi thất bại.

Luồng save bắt buộc:

1. Trong `defer`, kiểm quyền, trạng thái đang lưu/load, validators; lấy `getRawValue()` và map payload cụ thể.
2. Chụp ID, version, generation, revision và snapshot request, sau đó bật busy. Subscription thứ hai khi busy không gửi thêm request.
3. Service gọi đúng mutation một lần. Không tự retry lỗi mạng, 403, validation hoặc 409.
4. Chỉ nhận response còn thuộc generation/bản ghi đang mở. Lưu version mới; nếu revision không đổi thì hydrate và mark pristine. Nếu người dùng đã sửa tiếp, giữ form dirty và báo bản trước đã lưu, thay đổi mới chưa lưu.
5. Lỗi giữ draft/baseline; hiển thị field errors + summary, 409 yêu cầu xử lý bản mới. `finalize` kết thúc busy chỉ cho generation hiện tại.
6. Hủy subscriptions/read khi load khác hoặc destroy. Hủy HTTP client không khẳng định BE đã rollback mutation.

Không reset form khi request lỗi. Không tự reload sau 409/403 làm mất nội dung. Khi reload thủ công có dirty, phải xác nhận. Không cho rời route lúc mutation đang chạy. Ba editor dùng `LeaveConfirmation` screen-scoped + `ui-confirm-dialog`: một pending decision, request lặp nhận cùng Promise, destroy resolve false. `beforeunload` bảo vệ tab/reload trong giới hạn trình duyệt.

## 5. Forms, DTO và lỗi server

Typed form factory, validators và payload mapping ở `forms`; form type nhỏ có thể suy ra bằng `ReturnType<typeof createCategoryForm>`. `.dto` là wire contract; `.model` chỉ dành cho state/view data khác wire thật sự. Không nhân bản DTO thành model giống hệt chỉ để đổi tên. Form controls không đặt trong DTO. Nếu cần mapping view, đặt ở owning form/service, không ở generic utility.

Payload phải map có chủ đích: trim text theo contract, `getRawValue()` khi cần disabled values, giữ `0`, `false`, `null` đúng nghĩa. Không dùng `value || default` cho số/boolean. Date-only giữ chuỗi ngày `YYYY-MM-DD`, không chuyển qua UTC `Date` nếu API chỉ nhận ngày. Product content edit giữ media, SKU identity và fields đã bất hoạt theo contract; không vô tình gửi một partial object làm mất dữ liệu.

Validators client hỗ trợ nhập đúng; BE vẫn quyết định dữ liệu hợp lệ. Dùng thông báo `validationMessage` cho required/maxlength/pattern/number/server; help nghiệp vụ có thể cụ thể hơn tại màn. Khi submit invalid phải mark touched, không gửi HTTP. `applyServerErrors` giữ client validators, map alias vào control và trả lỗi chưa map cho `ui-form-error-summary`. Không bỏ lỗi lạ chỉ vì không có control tương ứng.

Với thuộc tính động, form controls dùng ID field. BE trả `Content.Fields[0].NumberValue` thì phải map qua **snapshot mảng đã gửi**, không lấy index schema hiện tại. `productFieldAliases(content.fields)` tại thời điểm save lưu quan hệ index → ID; lỗi field không còn tồn tại đi vào summary. Không gắn lỗi chỉ số sang một control khác sau khi schema/order đổi. ProductType cũng map các nhóm update/add fields/choices theo snapshot của request. Xóa server errors khi user sửa, không xóa bằng việc enable cả form trong `finalize`.

## 6. Query danh sách và navigation

| Danh sách                | Query hỗ trợ                      | Mặc định                |
| ------------------------ | --------------------------------- | ----------------------- |
| Products                 | `q`, `status`, `page`, `pageSize` | rỗng, mọi status, 1, 10 |
| Categories/Product types | `q`, `page`                       | rỗng, 1                 |

`readListQuery`/`readProductListQuery` parse thuần; `listQueryParams` bỏ giá trị mặc định. Chỉ nhận integer dương an toàn, Product status 1/2/3, pageSize 10/20/50. Query lạ, array hoặc sai chuẩn đưa về mặc định và replace URL canonical. Search debounce rồi cập nhật URL; đổi filter/pageSize quay trang 1. Khi tổng trang ít hơn page yêu cầu, sửa một lần về trang cuối và load lại. Danh sách rỗng ở trang 1.

Link list → editor mang query. Link breadcrumb/Back và new → ID giữ query cùng nhóm. Browser Back/Forward phục hồi từ URL. Navigation đổi nhóm không mang query nhóm cũ; selection không đưa vào URL hay lưu cross-screen. Không đồng bộ query qua localStorage hoặc một singleton list store.

## 7. Authentication và authorization

Auth/session ở core: access token/quyền trong bộ nhớ, refresh bằng HttpOnly cookie; không lưu credentials/token trong JS storage hay public runtime config. Admin chờ restore trước guard quyền. Không cấp quyền fallback khi quyền rỗng/lỗi; response quyền sai dạng cũng thất bại an toàn.

| Nghiệp vụ   | Quyền BE                                         |
| ----------- | ------------------------------------------------ |
| Product     | `Permissions.Product.View/Create/Update/Publish` |
| Category    | `Permissions.Category.View/Create/Update/Delete` |
| ProductType | `Permissions.ProductType.View/Create/Update`     |

Các chuỗi trên là các permission riêng (dấu `/` chỉ viết tắt trong bảng). Source dùng `AuthSession.can(functionCode, actionCode)`; không chép danh mục tổ hợp quyền thành constant FE. Route/navigation khai báo `{ functionCode, actionCode }`, bộ kiểm chung đối chiếu không phân biệt hoa/thường với quyền BE trả. Guard list/editor view kiểm View; route new kiểm Create. Menu chỉ hiện nhóm có View. `/admin` chọn mục đầu tiên được phép trong Collections rồi Quản trị hệ thống; không có mục thì `/admin/forbidden`, vẫn có logout.

`personal/authorization` trả `permissions` và `isCentralAdmin` từ database; quyền quản trị hệ thống yêu cầu đồng thời CentralAdmin và Function–Action. Không suy membership từ token hoặc permission string. Làm mới ngữ cảnh sau refresh token, thay đổi ACL và lỗi 403; không replay mutation 403 hay bỏ draft. Nhóm/chức năng/action/nhãn trên [màn quản trị](features/system-administration.md) lấy từ API, không giả bộ CRUD cố định, không tự thêm View khi chọn quyền khác.

Người có View thiếu Update vẫn được mở `:id` để đọc: disabled controls thật và nút ghi bị khóa. Tạo mới kiểm Create, sửa kiểm Update, đổi status kiểm Publish, xóa category kiểm Delete. UI và handler/store đều kiểm; không chỉ ẩn nút. Lookup Products còn chịu quyền riêng Category/ProductType ở BE: nếu bị từ chối, báo lỗi load rõ ràng, không giả lookup rỗng hoặc cấp thêm quyền. BE luôn là nơi thực thi authorization cuối cùng.

## 8. Utilities, pipe, service và style

Chỉ tạo utility khi thuật toán thuần có tên nêu mục đích và có lợi khi tách: `slugify`, parsing/serialization query. Input → output xác định, không DI, HTTP, router, browser storage, DOM hoặc mutable state. Không gom mọi helper vào `utils/index.ts`. Thêm test các edge case của thuật toán, không test lại từng dòng triển khai.

Tạo pipe khi phép biến đổi chỉ phục vụ template và pure, được dùng thực tế nhiều nơi; không gọi API hoặc giấu quyền/nghiệp vụ trong pipe. Chuyển đổi payload/field/date thuộc contract ở form/service tương ứng. Tạo service cho endpoint hoặc hạ tầng có DI thực sự; không tạo service chỉ để bọc một hàm thuần.

SCSS chung và semantic tokens sở hữu diện mạo, layout classes dùng lại tại màn. Màn mới dùng `.component.ts/.component.html`; bố cục đặc thù nếu cần thêm vào partial SCSS có phạm vi theo [SCSS rules](scss-rules.md), không sinh stylesheet riêng mặc định. Không rải màu, override internals vendor hoặc `::ng-deep` theo màn. Control dùng API PrimeNG trực tiếp; theme overlays kiểm ở root/body.

## 9. Ví dụ triển khai trọn luồng: Category

Đây là đường đi của màn đang chạy, cũng là mẫu để thêm nghiệp vụ mới. Các snippet tập trung phần giao tiếp; bản đầy đủ được liên kết ở từng bước, không phải một implementation thứ hai cần bảo trì.

**Bước 1 — kiểm contract và quyền.** Đọc CategoriesController, request validator và permission manifest của BE; đối chiếu [API Catalog](../../Boilerate/docs/backend/commerce-api.md). GET categories trả cả list, POST/PUT trả CategoryDto, DELETE nhận version trong query và trả boolean. Màn `:id` đọc item từ list; không tự tạo GET category detail mà BE không có. Xác định View/Create/Update/Delete, parent cycle, slug unique và optimistic version trước khi viết UI.

**Bước 2 — DTO.** [category.dto.ts](../src/app/models/category.dto.ts) mô tả response và SaveCategoryRequest. ID/version nullable ở request tạo mới, có giá trị ở update. Không dùng model demo thay wire DTO.

**Bước 3 — service.** [categories.service.ts](../src/app/services/categories.service.ts) giữ endpoints, không giữ list/draft/toast:

```typescript
getAll(): Observable<readonly CategoryDto[]> {
  return this.api.get<readonly CategoryDto[]>('categories');
}
update(id: string, request: SaveCategoryRequest): Observable<CategoryDto> {
  return this.api.put<CategoryDto>(`categories/${encodeURIComponent(id)}`, request);
}
```

**Bước 4 — form.** [category.form.ts](../src/app/forms/category.form.ts) có factory typed controls, limits, `categoryFormValue` và `categoryRequest`. Request map tường minh phần text/null và lấy raw disabled values. Giữ `sortOrder: 0`, `isActive: false`. Không serialize `FormGroup` hoặc spread nguyên response vào payload.

**Bước 5 — store.** [category-io.store.ts](../src/app/stores/category-io.store.ts) nhận form qua `setForm` một lần, hủy load cũ, lấy permission từ AuthSession, giữ canonical record/version và revision. `save(): Observable<CategoryDto>` dùng defer, busy lock, catch lỗi vào field/summary và finalize. [categories.store.ts](../src/app/stores/categories.store.ts) giữ filtering/page/delete, không điều hướng. Thêm store khi có state/request lifecycle như ví dụ; một derived value nhỏ không cần store mới.

**Bước 6 — component/template.** [category-io.component.ts](../src/app/features/collections/categories/category-io/category-io.component.ts) tạo form trước `setForm`, đăng ký route ở ngOnInit, dùng shared confirmation và chỉ điều hướng sau DTO thành công. [template](../src/app/features/collections/categories/category-io/category-io.component.html) dùng controls thật, help/error và disabled theo canWrite. Không tạo category-form/toolbar/inspector component riêng.

```typescript
save(): void {
  const wasNew = !this.route.snapshot.paramMap.has('id');
  this.store.save().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(saved => {
    if (wasNew && !this.form.dirty) {
      void this.router.navigate(['/admin/collections/categories', saved.id], {
        replaceUrl: true, queryParamsHandling: 'preserve',
      });
    }
  });
}
```

**Bước 7 — route/navigation.** [collections.routes.ts](../src/app/features/collections/collections.routes.ts) lazy-loads list, new và :id. Service theo route, store theo screen; guard data dùng constant. Editor có CanDeactivate. Navigation tại `constants/navigation.constants.ts` được composition lọc quyền; layout chỉ đọc navigation contract.

```typescript
{
  path: 'new', canActivate: [permissionGuard],
  data: { permission: CATALOG_PERMISSIONS.category.create },
  canDeactivate: [unsavedChangesGuard],
  loadComponent: () => import('./categories/category-io/category-io.component').then(m => m.CategoryIo),
}
```

**Bước 8 — tests và hoàn tất.** [category store tests](../src/app/stores/category-io.store.spec.ts) kiểm save, version, lỗi, stale response, draft và readonly. [query tests](../src/app/utils/list-query.util.spec.ts) và [permission tests](../src/app/guards/permission.guard.spec.ts) bảo vệ hành vi nền. Browser `e2e/` kiểm mở list → create/edit → Back, dirty guard, quyền, lỗi và cả theme. Kiểm tra toàn caller/link/lookup, không dừng ở HTML của màn chính.

Với feature mới, thay contract/DTO/service/form/store/màn/route/quyền tương ứng, giữ nguyên cách chia trách nhiệm. Chỉ thêm lớp/child/utility khi bước thực tế cần nó. Không thêm variants/media/orders UI theo suy đoán từ khả năng BE.

## 10. Kiểm tra và duy trì tài liệu

`run.ps1 install` dùng lockfile và npm đã pin; `.node-version` chọn runtime. `run.ps1 check` chạy format → lint/probes → unit → production build. Browser production riêng: `run.ps1 test:e2e` cho desktop/tablet × light/dark. FE fixture không cần BE/DB. Kiểm API thật trên DB test tách biệt báo riêng; build/mock/CI config không phải bằng chứng deployment.

Test tập trung hành vi: query restoration/canonical/clamp, permission route/handler/readonly, validator/summary/field ID, duplicate saves, stale response, chỉnh tiếp khi đang lưu, confirmation destroy. Không sinh test chỉ assert component tạo được hoặc sao chép triển khai. Khi sửa UI, kiểm overlays/focus và hành trình ảnh hưởng; không viết spec cạnh mỗi component.

README dẫn vào đây; architecture chỉ cập nhật bản đồ source; feature docs ghi contract/hành vi hiện tại. History chỉ ghi **mốc tính năng hoặc thay đổi hành vi đáng kể**, không ghi từng lần refactor, move file, format, chạy test hoặc sửa docs. Git giữ lịch sử code. Chỉ có một báo cáo tích hợp cần thiết cho mốc kiểm chứng, raw logs/screenshots ở ignored artifacts. Phân biệt đã triển khai, đã kiểm local và đã nghiệm thu thật.
