---
name: admin-ui-design
description: Build or refine Boilerate Admin Angular and PrimeNG workspace screens, controls, themes and motion according to the approved Webflow CMS/Ecommerce direction. Use for this project's admin UI, not generic marketing pages or backend changes.
---

# Boilerate Admin UI

Read [PRODUCT.md](../../../PRODUCT.md) and [DESIGN.md](../../../DESIGN.md) from the Frontend root before changing the workspace. Follow the single [codebase rulebook](../../../docs/coding-rules.md) for component structure, naming, forms, stores, utilities and boundaries; [AGENTS.md](../../../AGENTS.md) links the workflow. Screen components use a `.component.ts` source plus a `.component.html` template when external; necessary component tests live separately in `src/tests/components`. Reference provenance and limits are in [design/references/README.md](../../../design/references/README.md).

- Preserve the compact icon rail → context panel → working area hierarchy, thin topbar and local toolbar. The editor replaces list content and adds a right inspector. Webflow marketing pages do not determine admin composition.
- Reuse semantic tokens and the PrimeNG preset. Verify Light/Dark/System and root-appended overlays together; a feature must not create a private palette.
- Keep states operational: labeled fields, visible focus, validation/help links, disabled versus readonly, loading and selection. Use actual controls rather than static imitations in the gallery.
- Keep Vietnamese readable at compact density. Test long values, panel widths, small viewports and keyboard navigation. Panel collapse and resize need accessible alternatives.
- Use the project's short motion tokens for state feedback; honor reduced motion. Do not add animated marketing entrances or third-party animation dependencies just to match inspiration.
- Collections now use real APIs under the approved integration work. Use server responses for save feedback. Gallery remains a control preview. Keep layout and tokens consistent while simplifying screens under the current coding rules.
- Review a list, editor and overlay in both themes at the same desktop viewport and one tablet viewport; mobile optimization is deferred. Report actual build/browser results in the handoff. Keep durable verification only when the feature milestone needs integration or acceptance evidence, following the [documentation rules](../../../docs/README.md#quy-tắc-duy-trì-docs). Distinguish implemented, locally checked and user/deployment accepted. Small visual changes do not require a new plan, report or history entry.

When a new reference differs from the spec, identify whether it changes structure, state behavior or visual tokens. Adjust the shared source of truth for an authorized change; retain a reason only when it explains a lasting design decision. Do not claim measured Webflow dimensions or pixel-perfect fidelity without measured source evidence.
