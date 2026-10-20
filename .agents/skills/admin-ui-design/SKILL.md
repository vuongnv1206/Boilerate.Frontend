---
name: admin-ui-design
description: Build or refine Boilerate Admin Angular and PrimeNG workspace screens, controls, themes and motion according to the approved Webflow CMS/Ecommerce direction. Use for this project's admin UI, not generic marketing pages or backend changes.
---

# Boilerate Admin UI

Read [PRODUCT.md](../../../PRODUCT.md) and [DESIGN.md](../../../DESIGN.md) from the Frontend root before changing the workspace. Follow [AGENTS.md](../../../AGENTS.md) for source boundaries. Reference provenance and limits are in [design/references/README.md](../../../design/references/README.md).

- Preserve the compact icon rail → context panel → working area hierarchy, thin topbar and local toolbar. The editor replaces list content and adds a right inspector. Webflow marketing pages do not determine admin composition.
- Reuse semantic tokens and the PrimeNG preset. Verify Light/Dark/System and root-appended overlays together; a feature must not create a private palette.
- Keep states operational: labeled fields, visible focus, validation/help links, disabled versus readonly, loading and selection. Use actual controls rather than static imitations in the gallery.
- Keep Vietnamese readable at compact density. Test long values, panel widths, small viewports and keyboard navigation. Panel collapse and resize need accessible alternatives.
- Use the project's short motion tokens for state feedback; honor reduced motion. Do not add animated marketing entrances or third-party animation dependencies just to match inspiration.
- Treat current list/editor fixtures as demo data. Preserve clear demo labels and local save semantics. Business permissions, API and authentication belong to later approved work.
- Review a list, editor and overlay in both themes at the same desktop viewport and one small viewport. Record actual build/browser results in the owning FE feature plan and verification report. Distinguish implemented, locally checked and user/deployment accepted.

When a new reference differs from the spec, identify whether it changes structure, state behavior or visual tokens. Adjust the shared source of truth for an authorized change and record the reason. Do not claim measured Webflow dimensions or pixel-perfect fidelity without measured source evidence.
