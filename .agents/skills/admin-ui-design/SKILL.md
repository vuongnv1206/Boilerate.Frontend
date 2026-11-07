---
name: admin-ui-design
description: Build or refine Boilerate Admin Angular and PrimeNG screens, controls, themes and motion using the approved warm product design system. Use for this project's admin UI, not generic marketing pages or backend changes.
---

# Boilerate Admin UI

Read [PRODUCT.md](../../../PRODUCT.md) and [DESIGN.md](../../../DESIGN.md) from the Frontend root before changing the workspace. Follow the consolidated [Frontend & SCSS rulebook](../../../../agents/frontend.md) for component structure, naming, forms, stores, utilities and boundaries; [AGENTS.md](../../../AGENTS.md) and [workflow-and-docs.md](../../../../agents/workflow-and-docs.md) define the workspace workflow. Screen components use a `.component.ts` source plus a `.component.html` template when external; necessary component tests live separately in `src/tests/components`. Reference provenance and skill limits are documented in [design-and-skills.md](../../../../docs/references/design-and-skills.md).

- Use grouped, permission-aware workspace navigation and a clear local toolbar. Collections editors replace list content, keep record navigation beside the form and put metadata at the end. Orders/Renewals may use a supporting inspector; do not add one to every editor. Apply the Admin patterns in DESIGN.md to system administration and payment settings as well.
- Reuse semantic tokens and the PrimeNG preset. Verify Light/Dark/System and root-appended overlays together; a feature must not create a private palette.
- Keep states operational: labeled fields, visible focus, validation/help links, disabled versus readonly, loading and selection. Use actual controls rather than static imitations in the gallery.
- Keep Vietnamese readable at the shared density: 36px controls (32px for named compact variants), 14px body/control text, 13px labels and 12px help/errors. Rail primary/secondary text is 13px/12px. Reuse table geometry tokens; no per-screen control shrinking. Test long values, panel widths, small viewports and keyboard navigation. Panel collapse and resize need accessible alternatives.
- Use the project's short motion tokens for state feedback; honor reduced motion. Do not add animated marketing entrances or third-party animation dependencies just to match inspiration.
- Collections, Orders, Renewals, Discounts and System screens use real Backend APIs; use server responses for save feedback, while Gallery remains a control preview. Keep layout and tokens consistent while simplifying screens under the current coding rules.
- Review a list, editor and overlay in both themes at the same desktop viewport and one tablet viewport; Admin mobile optimization is deferred while Storefront mobile (`390×844` and `360×800`) is required. Report actual build/browser results in the handoff, update owning module docs in [../../../../docs/](../../../../docs/README.md) when behavior changes, and distinguish implemented, locally checked and deployment accepted.
