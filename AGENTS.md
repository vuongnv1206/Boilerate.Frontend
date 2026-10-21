# Frontend development rules

This file applies to the independent Frontend repository. Product intent is in [PRODUCT.md](PRODUCT.md); visual decisions and tokens are in [DESIGN.md](DESIGN.md). Read those before changing a screen. The authoritative implementation rulebook is [docs/coding-rules.md](docs/coding-rules.md); [architecture](docs/architecture.md) only maps current source. The [documentation index](docs/README.md) defines where to keep current contracts, feature history and verification. The sibling backend has its own [README](../Boilerate/README.md); check its actual source before assuming API compatibility.

The mandatory implementation/review standard is [Angular coding rules](docs/coding-rules.md). Current user decision: constants/enums/models/services/stores/forms/guards/utils sit directly in `src/app`, beside `features`, with clear filenames and import aliases. Lists use the feature name; create/edit screens use `-io`. Small toolbars/tables/forms/inspectors stay in the screen. Do not recreate layers or small components under each screen. Follow [shared SCSS rules](docs/scss-rules.md); do not generate component SCSS/spec files by default.

Current user priority (2026-10-20): web first. Required browser verification and CI cover desktop/tablet in both themes. Mobile UI optimization and its known gallery tooltip focus/scroll issue are deferred; retain mobile tests/baselines for explicit follow-up using `test:e2e:mobile` or `test:e2e:all`. The development URL stays `http://localhost:4200`; port 4300 is a temporary production preview for browser tests.

## Architecture and naming

- Keep standalone Angular components, strict TypeScript and strict templates. Use signals/computed for local derived state and RxJS where asynchronous streams need cancellation or composition. Keep effects for actual side effects.
- Organize by responsibility: `core/` for app infrastructure, `layout/admin-shell/` for workspace chrome, `shared/ui/` for reused presentation, `features/` for screen components/routes, and app-level constants/enums/models/services/stores/forms/guards/utils. Do not add empty layers.
- Use kebab-case files/folders and PascalCase exported types. Every Angular component source file ends with `.component.ts`, paired with a `.component.html` template when external, for example `product-io.component.ts` and `product-io.component.html`. Keep a screen component to TS + HTML. Put necessary component behavior tests in `src/tests/components`, never generate a companion spec or stylesheet. The exported class may keep the domain name (`ProductIo`) while the file carries the required suffix. Use `app-` selectors; use `ui-` only for reused shared controls.
- Scope state to the smallest owning screen. Do not place demo content, feature rules or API calls in shared UI. Do not import a feature's private internals from another feature.
- Shell consumes the navigation DI contract; only app composition connects it to a feature public entry. Run architecture probes with lint. Shared form helpers accept structural field-error input rather than importing core HTTP models.
- Use Angular router lazy boundaries for screens. Keep accessible native links for navigation and buttons for actions. Prefer typed inputs/outputs and Angular control flow.
- Match the installed Angular and PrimeNG public APIs. Do not patch dependencies or style generated internal markup with scattered selectors. A shared preset and the global theme layer own PrimeNG overrides.

## UI implementation

- Webflow CMS/Ecommerce workspace is the priority reference. Preserve the compact rail, context panel, thin topbar, local toolbar and editor with inspector. A marketing landing page is not the reference for admin composition.
- Use semantic theme and motion tokens; avoid per-screen hard-coded colors. Overlay controls must inherit the root theme even when appended to `body`.
- Every input has a visible label and associated error/help text. Every icon-only action has an accessible name. Keep visible keyboard focus and coherent tab order.
- Handle long Vietnamese text, keyboard-only interaction, empty results and small viewports. Honor reduced motion. Do not add decorative page-load choreography.
- Collections use real Catalog APIs. Browser authentication restores through an HttpOnly refresh cookie; access tokens and permissions stay in memory. Await restore in the admin guard; never persist tokens in JS storage. Gallery is still a control preview. Respect actual API contracts and errors; never imply a write succeeded before its response. Keep credentials out of frontend source and public runtime config.

## Verification and documentation

- Keep current behavior and contracts in the owning feature document when they need lasting documentation. Update existing rules in place; do not create a plan or report for every task.
- Add a short entry to [feature history](docs/history/README.md) only for a completed feature or a substantial change in user-visible behavior. Describe the delivered capability and link its owning document. Do not log refactors, file moves, source imports, formatting, CI/test fixes, individual check runs or documentation cleanup. Git records implementation details. Group related work into one feature milestone; do not create a dated file per step or commit.
- Run `npm run check` and browser tests appropriate to application changes; verify both themes and overlays when affected. For documentation-only changes, check formatting, local links and the diff. Report routine verification in the handoff. Keep a concise report in `docs/verification/` only when a feature milestone needs durable integration or acceptance evidence, with its source revision, final result and remaining limits. Do not duplicate results across history, README and feature docs. Keep implemented, checked locally and accepted by the user/deployment separate; CI configuration is not proof of a successful run.
- Store raw screenshots/logs in ignored artifacts and document how to reproduce them. Do not describe reference dimensions as measured unless a source screenshot was actually measured.
- Use [the project design skill](.agents/skills/admin-ui-design/SKILL.md) when building or refining this workspace. Third-party reference provenance is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
