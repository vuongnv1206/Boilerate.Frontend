# Verification — Live Acceptance Suite — 2026-10-24

## Scope

Live browser acceptance suite executing against an isolated, freshly migrated SQL Server database and loopback Kestrel backend.
Validates end-to-end user journeys for Catalog Editor, Physical and Digital Inventory, Category Product Membership, Product Types, Orders, Shipping, Renewals, Permissions, and User Administration across 4 screen and theme configurations: `desktop-light`, `tablet-light`, `desktop-dark`, and `tablet-dark`.

## Results

| Command                                                                                                         | Environment                                                                   | Result                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `run.ps1 check`                                                                                                 | Windows, Node 24.19.0                                                         | Pass: Prettier, ESLint, 43 architecture checks, 41 test files / 262 Vitest tests, production Angular build `dist/boilerate-admin`. |
| `powershell -ExecutionPolicy Bypass -File Boilerate\scripts\verify-admin.ps1 -FrontendRoot Frontend -SkipBuild` | Playwright Chromium, 4 viewport/colorScheme projects, isolated MSSQL database | Pass: **68 / 68 live acceptance tests (100% green)** in 3.9m.                                                                      |

### Per-Project Live Acceptance Breakdown

- `desktop-light` (1440x900, light theme): 17/17 passed
- `tablet-light` (1024x768, light theme): 17/17 passed
- `desktop-dark` (1440x900, dark theme): 17/17 passed
- `tablet-dark` (1024x768, dark theme): 17/17 passed

## Verified Behaviors

1. **Catalog Editor & Variant Matrix:**
   - Multi-option Cartesian product generation (Color, Size), option renaming, duplicate and blank SKU allowance, compare-at pricing, and inventory tracking toggling.
   - Variant table ordering stability when setting default variants (`OrderByDescending(v => v.IsDefault)`).
   - Media uploads and assignment to specific variants.
2. **Physical & Digital Inventory:**
   - On-hand stock adjustment, immutable ledger entries, and idempotent operation replay preserving reserved quantities.
   - Unique and Shared digital fulfillment items, customer ownership isolation, and explicit admin secret reveal gating.
3. **Category Membership:**
   - Category metadata and product membership batch assignment, reload persistence, and removal.
   - Optimistic concurrency conflict preservation and explicit draft reconciliation.
4. **Orders & Fulfillment:**
   - Prepaid and COD orders, partial shipments, refund ledgers, and return restock workflows.
   - Order detail store synchronization upon payment confirmation.
5. **Renewals Lifecycle:**
   - Processor claim, start, and verification flow.
   - Target and evidence encryption, unescaped UTF-8 Vietnamese character handling (`JavaScriptEncoder.UnsafeRelaxedJsonEscaping`), and independent permission reveal gating.
6. **System Administration & Permissions:**
   - User creation, editing, role assignment, and account deactivation.
   - Protection of final admin account against lockout or deactivation.
   - Function–Action permission grants and independent revocation.
   - HttpOnly cookie session restoration, deep link preservation, and logout invalidation.
