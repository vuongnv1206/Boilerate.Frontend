# Design references

Reviewed 2026-10-19, direction updated 2026-10-27. These notes select patterns for Admin and the storefront; they do not redistribute upstream templates, screenshots, proprietary fonts or scripts. The project spec is [DESIGN.md](../../DESIGN.md).

## Reference priority

1. **GetDesign Claude:** warm paper, charcoal and terracotta color roles; adapt their contrast to product controls.
2. **Project tokens and interaction checks:** adapt the reference to Vietnamese, accessible controls and desktop/tablet layouts.
3. **Impeccable, frontend-design and MotionSites:** product usability, distinctive storefront composition and purposeful motion. Webflow is an earlier workspace reference, retained below as provenance.

| Reference                                                                                                                                | What it supports                                                                       | Limitations                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow)                                           | Top/context bars, left tools, right contextual panels, CMS entry point                 | Does not publish the exact pixel dimensions/tokens used in this project                            |
| [Edit site content as a content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor) | Select a Collection, open an item, edit grouped fields; search/filter/page vocabulary  | Webflow business behavior is not the Boilerate backend contract                                    |
| [Collection items overview](https://help.webflow.com/hc/en-us/articles/33961289539347-Collection-items-overview)                         | CMS list/editor reference selected during implementation research                      | Public documentation is not a measured design-token specification                                  |
| [Manage CMS Collections](https://help.webflow.com/hc/en-us/articles/33961244391059-Manage-CMS-Collections)                               | Collection fields and named field groups as form-organization inspiration              | No schema builder is implemented in the UI foundation                                              |
| [Light and dark themes across Webflow](https://webflow.com/updates/light-and-dark-themes-across-webflow)                                 | System/Light/Dark interface preference across surfaces                                 | Boilerate persists locally, not to a user account; extra dark brightness variants are deferred     |
| [GetDesign Webflow](https://getdesign.md/webflow/design-md)                                                                              | Blue accent, crisp borders, conservative radius                                        | Marketing-site analysis; not a source for admin hero typography, animated CTAs or layout           |
| [MotionSites](https://motionsites.ai/)                                                                                                   | User-requested motion inspiration; Apps filter reviewed during implementation research | One separate documentation fetch timed out; no animation timing was measured or source code copied |

For image comparison, keep the reference source/version and local screenshots at a matching viewport. Do not label an invented mock or a local screenshot as an official reference. No authenticated Webflow account was used during the initial documentation pass.

## Local resources read

The user provided `D:\MyCode\get-design\GetDesign` and `D:\MyCode\get-design\skills`. Targeted exploration also located the Webflow analysis and Impeccable references alongside them:

- `D:\MyCode\get-design\design-systems\claude\DESIGN.md`: selected warm-color reference for the current whole-product direction.
- `D:\MyCode\get-design\design-systems\webflow\DESIGN.md`: earlier marketing visual analysis.
- `D:\MyCode\get-design\.agents\skills\impeccable\reference\product.md`: familiar product UI, density, restrained typography/color and stateful controls.
- `...\reference\interaction-design.md`: focus, labels, feedback and overlay clipping considerations.
- `...\reference\color-and-contrast.md`: semantic palette roles, text/control contrast and separate dark surfaces.
- `...\reference\motion-design.md`: fast state feedback, easing, reduced motion and performance.
- `D:\MyCode\get-design\skills\frontend-design.md`: composition and visual hierarchy for the storefront; admin controls remain suited to operational data.
- `D:\MyCode\get-design\skills\brand-guidelines.md`: reference color roles, adapted to this product and accessible states.
- `D:\MyCode\get-design\skills\theme-factory.md`: reviewed as context; its catalog is not the selected product direction.

Read-only local source snapshot: repository `https://github.com/nuocftraik/get-design.git`, HEAD `f3c8f6c841f795b32eb369649ad9ec172626edab`. Its `skills-lock.json` records Impeccable upstream `pbakaus/impeccable` with computed hash `6894a8e7c14df9b063925cb134c73b2ca8c912c015710ac36f2f250d7c7ab998`; that hash is a lockfile identifier, not asserted to be an upstream Git commit.

The project keeps independently worded, task-specific summaries in [product-ui-notes.md](product-ui-notes.md) and an original small [admin-ui-design skill](../../.agents/skills/admin-ui-design/SKILL.md). Original libraries stay in place; no upstream executables were run.

## Comparison status

- Shell and control dimensions in DESIGN are project baselines, not measurements of a reference product.
- Reference sources were read for structure and behavior. The initial pass did not establish a pixel-level match to every Webflow light/dark overlay.
- Report UI checks in the handoff; keep durable evidence only when needed under the [documentation rules](../../docs/README.md#quy-tắc-duy-trì-docs). Raw screenshots/logs stay in ignored artifacts.

## Local installation — 2026-11-04

The earlier research-only statements above describe the initial review. Full impeccable and frontend-design skill files are now installed under Frontend/.agents/skills/. See [installation inventory](../../docs/skills/README.md) for source revision, file hashes and redistribution limits.
