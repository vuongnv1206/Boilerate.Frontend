# Design references

Reviewed 2026-10-19. These notes select patterns for Boilerate Admin; they do not redistribute upstream templates, screenshots, fonts or scripts. The project spec is [DESIGN.md](../../DESIGN.md).

## Reference priority

1. **Webflow CMS/Ecommerce workspace:** navigation hierarchy, compact chrome, list-to-editor flow, form groups and contextual panels.
2. **Project tokens and interaction checks:** adapt the reference to Vietnamese, accessible controls and small screens.
3. **GetDesign / Impeccable / MotionSites:** supplementary language for color, craft, usability and restrained motion.

| Reference                                                                                                                                | What it supports                                                                       | Limitations                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow)                                           | Top/context bars, left tools, right contextual panels, CMS entry point                 | Does not publish the exact pixel dimensions/tokens used in this project                            |
| [Edit site content as a content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor) | Select a Collection, open an item, edit grouped fields; search/filter/page vocabulary  | Webflow business behavior is not the Boilerate backend contract                                    |
| [Collection items overview](https://help.webflow.com/hc/en-us/articles/33961289539347-Collection-items-overview)                         | CMS list/editor reference selected during implementation research                      | Public documentation is not a measured design-token specification                                  |
| [Manage CMS Collections](https://help.webflow.com/hc/en-us/articles/33961244391059-Manage-CMS-Collections)                               | Collection fields and named field groups as form-organization inspiration              | No schema builder is implemented in the UI foundation                                              |
| [Light and dark themes across Webflow](https://webflow.com/updates/light-and-dark-themes-across-webflow)                                 | System/Light/Dark interface preference across surfaces                                 | Boilerate persists locally, not to a user account; extra dark brightness variants are deferred     |
| [GetDesign Webflow](https://getdesign.md/webflow/design-md)                                                                              | Blue accent, crisp borders, conservative radius                                        | Marketing-site analysis; not a source for admin hero typography, animated CTAs or layout           |
| [MotionSites](https://motionsites.ai/)                                                                                                   | User-requested motion inspiration; Apps filter reviewed during implementation research | One separate documentation fetch timed out; no animation timing was measured or source code copied |

For image comparison, use Webflow's own illustrations from these pages at the documented source/version and local screenshots at a matching viewport where available. Do not label an invented mock or a local screenshot as an official Webflow reference. No authenticated Webflow account was used during the initial documentation pass.

## Local resources read

The user provided `D:\MyCode\get-design\GetDesign` and `D:\MyCode\get-design\skills`. Targeted exploration also located the Webflow analysis and Impeccable references alongside them:

- `D:\MyCode\get-design\design-systems\webflow\DESIGN.md`: marketing visual analysis.
- `D:\MyCode\get-design\.agents\skills\impeccable\reference\product.md`: familiar product UI, density, restrained typography/color and stateful controls.
- `...\reference\interaction-design.md`: focus, labels, feedback and overlay clipping considerations.
- `...\reference\color-and-contrast.md`: semantic palette roles, text/control contrast and separate dark surfaces.
- `...\reference\motion-design.md`: fast state feedback, easing, reduced motion and performance.
- `D:\MyCode\get-design\skills\frontend-design.md`: reviewed as context; its marketing-oriented “bold” choices and font exclusions do not override the approved compact Webflow workspace.
- `D:\MyCode\get-design\skills\theme-factory.md`: reviewed as context; its theme-selection workflow does not apply because the user already selected the visual direction.

Read-only local source snapshot: repository `https://github.com/nuocftraik/get-design.git`, HEAD `f3c8f6c841f795b32eb369649ad9ec172626edab`. Its `skills-lock.json` records Impeccable upstream `pbakaus/impeccable` with computed hash `6894a8e7c14df9b063925cb134c73b2ca8c912c015710ac36f2f250d7c7ab998`; that hash is a lockfile identifier, not asserted to be an upstream Git commit.

The project keeps independently worded, task-specific summaries in [product-ui-notes.md](product-ui-notes.md) and an original small [admin-ui-design skill](../../.agents/skills/admin-ui-design/SKILL.md). Original libraries stay in place; no upstream executables were run.

## Comparison status

- Shell and control dimensions in DESIGN are project baselines, not measured Webflow dimensions.
- Reference sources were read for structure and behavior. The initial pass did not establish a pixel-level match to every Webflow light/dark overlay.
- Report UI checks in the handoff; keep durable evidence only when needed under the [documentation rules](../../docs/README.md#quy-tắc-duy-trì-docs). Raw screenshots/logs stay in ignored artifacts.
