# Guest storefront và redesign storefront — bằng chứng kiểm chứng

Ngày: 2026-10-24 (Asia/Saigon)
Phạm vi source: working tree FE và BE cùng workspace, chưa commit
Trạng thái: SQL Server pass; PostgreSQL runtime, SMTP thật và deployment chưa kiểm

## Kết quả

| Lớp              | Lệnh/phạm vi                                                                                                                         | Kết quả                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| FE quality       | `npm run check`                                                                                                                      | Prettier, ESLint, 43 architecture checks, 270/270 unit tests và production build đạt                                        |
| FE browser mocks | `playwright test e2e/storefront.spec.ts --project=desktop-light --project=desktop-dark --project=tablet-light --project=tablet-dark` | 32/32 qua desktop/tablet × Light/Dark; catalog/detail/cart/checkout/OTP/My Orders và visual snapshots đều đạt               |
| BE integration   | `dotnet test tests/Boilerate.Tests/Boilerate.Tests.csproj --no-restore --filter FullyQualifiedName~GuestStorefrontIntegrationTests`  | 5/5 trên SQL Server test DB; gồm cookie/OTP, owner, giá/tồn, idempotency, COD, cạnh tranh món cuối và giao hàng số sau Paid |
| BE regression    | `dotnet test Boilerate.sln --no-restore --filter "Category!=ProviderIntegration"`                                                    | 233/233 qua                                                                                                                 |
| Live browser/API | `npm run test:e2e:live -- --skip-build e2e-live/storefront.spec.ts`                                                                  | 12/12 trên DB SQL Server `boilerate_test_*`, desktop/tablet × Light/Dark                                                    |

FE production build phát cảnh báo ngân sách initial bundle: 695.20 kB, vượt giới hạn 650 kB 45.20 kB. Build vẫn thành công; thay đổi tăng so với lần ghi trước là khoảng 17.84 kB, chủ yếu để tự host font display Instrument Sans cho storefront.

## Live acceptance

Runner tạo DB test mới có tiền tố `boilerate_test_`, áp migrations và dọn DB khi kết thúc. Bản chạy đủ 12/12 test cho redesign storefront có report tại [Playwright HTML](../../artifacts/live-acceptance/1b31f892-7bcc-4cf6-9281-d8ecfae2d053/report/index.html), [kết quả JSON](../../artifacts/live-acceptance/1b31f892-7bcc-4cf6-9281-d8ecfae2d053/results.json) và [manifest chạy](../../artifacts/live-acceptance/1b31f892-7bcc-4cf6-9281-d8ecfae2d053/run.json). Artifact là file cục bộ trong `Frontend/artifacts` và bị ignore bởi Git.

Mỗi viewport/theme chạy ba ca live:

- Khách không đăng nhập thêm sản phẩm Published, nhận OTP từ BE outbox qua mail sink in-memory, xác minh email, đặt COD và xem My Orders bằng cookie HttpOnly.
- Đơn có hàng số dùng chuyển khoản; nội dung không xuất hiện trước thanh toán. Nhân viên xác nhận tiền thủ công qua API Admin, sau đó khách đọc được nội dung số.
- Nhân viên đăng nhập Admin cập nhật thông tin nhận tiền; test xác nhận dữ liệu công khai đã đổi rồi khôi phục bộ cấu hình seed cho project kế tiếp.

SQL Server DB mới đã áp migration `20261024082919_GuestStorefront`. Migration PostgreSQL `20261024082938_GuestStorefront` và snapshot đã được tạo, nhưng runtime PostgreSQL chưa chạy vì môi trường không có `BOILERATE_TEST_POSTGRES` test connection. OTP được nhận qua in-memory mail sink; SMTP thật, HTTPS production và staging/deployment không thuộc lượt nghiệm thu này.
