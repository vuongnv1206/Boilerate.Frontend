# 2026-10-20 — Feature boundaries and workspace navigation

## Implemented

- `core/navigation/workspace-navigation.ts` defines a presentation-only DI contract: a signal of collection links, each with a key, label, icon, path and count.
- `AdminShell` consumes `WORKSPACE_NAVIGATION`; it no longer imports the demo store, collection model or feature test components. Existing shell markup, layout preferences, keyboard resize and mobile focus behavior remain in place.
- The content feature owns the navigation adapter. Its computed collection counts update when the in-memory demo store changes. The application composition layer binds the adapter through the feature's public `index.ts` entry.
- Content list/editor routes and the editor's dirty-state guard are owned by the content feature's lazy route entry. The gallery has a separate lazy route entry. Existing `/admin/collections/:collection`, `/admin/items/:id` and `/admin/controls` URLs are preserved.
- ESLint Boundaries classifies core, layout, shared UI, shared forms, individual features, application composition and bootstrap. TypeScript resolver settings cover both relative imports and the documented `@app`, `@core`, `@layout`, `@shared` and `@features` aliases.
- Boundary rules reject cross-feature imports, feature dependencies from layout/core, application imports of private feature files, and HTTP dependencies in shared UI. Only composition may import a feature's `index.ts` or root `*.routes.ts` entry. Unknown local dependencies and unresolved aliases fail lint.
- `scripts/check-boundaries.mjs` uses ESLint against virtual source snippets without creating probe files. It exercises forbidden relative/alias imports, dynamic imports, re-exports, unknown aliases and allowed dependency paths.

## Checked locally

- `node node_modules/eslint/bin/eslint.js src` passed after the architecture changes.
- `node scripts/check-boundaries.mjs` passed all 17 positive and negative import probes.
- Angular tests targeting `admin-shell.spec.ts` and `content-navigation.spec.ts` passed: 2 files, 6 tests. These include shell navigation supplied entirely by a fake DI model, reactive count updates, independent demo adapter count updates, mobile Escape/focus and guard cancellation while the navigation overlay is open.
- Prettier formatted the changed architecture sources and enforcement script.

The commands used the bundled Node 24.19.0 runtime. Full application checks, browser regression and CI are reported by the milestone's final verification; the checks above do not imply that browser or deployment acceptance has happened.

## Dependency note

The boundary plugin is kept on 5.4.0 after auditing 7.2.0. Its transitive Handlebars version is overridden to the patched 4.7.10 by the application tooling. The remaining Braces/Micromatch advisory affects a development-only lint dependency, used with patterns maintained in this repository; no patched Braces release was available during this audit. Do not replace it with the obsolete plugin version suggested by an automatic major downgrade. Review the final `npm audit` result together with the root tooling changes.
