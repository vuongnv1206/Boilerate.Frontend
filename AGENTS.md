# Frontend development rules

This file applies to the independent Frontend repository. Product intent is in [PRODUCT.md](PRODUCT.md); visual decisions and tokens are in [DESIGN.md](DESIGN.md). Read those before changing a screen. Codebase boundaries and workflow are in [docs/architecture.md](docs/architecture.md). Cross-project progress and contracts remain linked from [the sibling project](../Boilerate/docs/frontend/README.md) when working in the shared workspace; it is not required for FE build/CI.

The mandatory implementation/review standard is [Angular coding rules](docs/coding-rules.md). Read it before adding or refactoring a feature. List pages use the feature name; create/edit/detail pages use `-io`. Enum/type declarations, reusable options and business configuration belong in the feature's `enums`, `models` and `constants`, never inside a component. Component imports are explicit template dependencies; do not introduce a global catch-all UI module.

## Architecture and naming

- Keep standalone Angular components, strict TypeScript and strict templates. Use signals/computed for local derived state and RxJS where asynchronous streams need cancellation or composition. Keep effects for actual side effects.
- Organize by responsibility: `core/` for application-wide theme/layout state, `layout/admin-shell/` for workspace chrome, `shared/ui/` for reusable presentation, and `features/` for screens and their local state. Do not create empty layers in advance.
- Use kebab-case files/folders and PascalCase exported types. A component uses a shared basename for `.ts`, `.html`, `.scss`, and `.spec.ts`, for example `product-io`. Avoid a mandatory `Component` suffix. Use `app-` selectors; use `ui-` only for reusable shared controls.
- Scope state to the smallest owning screen. Do not place demo content, feature rules or API calls in shared UI. Do not import a feature's private internals from another feature.
- Shell consumes the navigation DI contract; only app composition connects it to a feature public entry. Run architecture probes with lint. Shared form helpers accept structural field-error input rather than importing core HTTP models.
- Use Angular router lazy boundaries for screens. Keep accessible native links for navigation and buttons for actions. Prefer typed inputs/outputs and Angular control flow.
- Match the installed Angular and PrimeNG public APIs. Do not patch dependencies or style generated internal markup with scattered selectors. A shared preset and the global theme layer own PrimeNG overrides.

## UI implementation

- Webflow CMS/Ecommerce workspace is the priority reference. Preserve the compact rail, context panel, thin topbar, local toolbar and editor with inspector. A marketing landing page is not the reference for admin composition.
- Use semantic theme and motion tokens; avoid per-screen hard-coded colors. Overlay controls must inherit the root theme even when appended to `body`.
- Every input has a visible label and associated error/help text. Every icon-only action has an accessible name. Keep visible keyboard focus and coherent tab order.
- Handle long Vietnamese text, keyboard-only interaction, empty results and small viewports. Honor reduced motion. Do not add decorative page-load choreography.
- Demo state is explicitly labeled. A save message must not imply backend persistence. Only theme/layout preferences are persisted in this UI milestone; do not add authentication or real business writes.

## Verification and documentation

- Update the owning feature plan and dated history after meaningful steps. Keep implemented, checked locally and accepted by the user/deployment separate.
- Run `npm run check` and browser tests appropriate to the change. Verify both themes and overlays. Record local results in `docs/verification/`, dated changes in `docs/history/`, and link them from shared workspace progress rather than copying contracts or results. Commit coherent code plus its history. CI configuration is not proof of a successful run.
- Store raw screenshots/logs in ignored artifacts and document how to reproduce them. Do not describe reference dimensions as measured unless a source screenshot was actually measured.
- Use [the project design skill](.agents/skills/admin-ui-design/SKILL.md) when building or refining this workspace. Third-party reference provenance is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
