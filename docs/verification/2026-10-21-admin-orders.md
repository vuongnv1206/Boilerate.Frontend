# Verification — Admin Orders and connected admin features — 2026-10-21

## Scope

Current FE checkout for shipping, after-sales, SKU/price/inventory, manual renewals, and user administration. Browser tests use deterministic HTTP fixtures and validate UI behavior/request snapshots. They do not replace authenticated acceptance against external carrier/payment systems or a production deployment.

## Results

| Command                                                                                                 | Environment                                                   | Result                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `run.ps1 check`                                                                                         | Windows, supported bundled Node 24.19.0                       | Pass: Prettier, ESLint, 43 architecture checks, 35 test files/218 tests, production Angular build. |
| Focused shipping/after-sales/renewal unit tests                                                         | Vitest                                                        | Pass: 3 files/17 tests.                                                                            |
| `run.ps1 test:e2e -- e2e/orders.spec.ts e2e/product-commerce.spec.ts e2e/system-administration.spec.ts` | Playwright Chromium, desktop/tablet × Light/Dark, fixture API | Pass: 96 tests (shipping 24, SKU/price/inventory 28, user/role administration 44).                 |

## Verified behavior

- Order list/detail, partial dispatch and delivery, response-loss retry, permission gating, and conflict draft retention.
- SKU combinations/prices, inventory adjustment replay, canonical reload, and Unique/Shared digital inventory reveal controls.
- User profile/role workflows, permission matrix, permission gating, conflict handling, and draft retention.
- Refund and return payload validation, COD closure gating, permission checks, conflict reload, and immutable retry request through focused component tests.
- Renewal claim, start retry, verification payload, permission checks, expiry validation, and target/evidence reveal state through focused component tests.

## Limits

- Playwright uses fixture APIs. Do not interpret its pass result as live API or database acceptance. See the BE feature reports for SQL Server contract/service acceptance.
- Renewal and after-sales currently have unit coverage but are not included in the browser E2E suites.
- FE development server runs at `http://127.0.0.1:4200`; authenticated API runs at `http://127.0.0.1:5000`. Docker/deployment acceptance was deferred by the user.
