# Third-party references

This file records design-research provenance for the admin UI foundation, reviewed 2026-10-19. Runtime package licenses are supplied by their installed packages and lockfile; this list does not replace those licenses.

## PrimeUI runtime license

The user will supply a valid license later. The application currently runs with no license key and retains the vendor's normal warning/watermark behavior. An optional `PRIMEUI_LICENSE_KEY` environment variable is written to ignored runtime configuration and supplied through PrimeNG's supported `license` option. This is configuration support, not a license grant or verification of eligibility. No key is included in project documentation; license acceptance and watermark-free review remain pending.

## Webflow

Webflow interface documentation and public illustrations were consulted for workspace structure, CMS list/editor interaction and theme choices. Webflow is a trademark of its owner. Boilerate does not use the Webflow logo, proprietary font or claim affiliation. No Webflow application source or template was copied.

Sources: [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow), [content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor), [Collection items overview](https://help.webflow.com/hc/en-us/articles/33961289539347-Collection-items-overview), [CMS Collections](https://help.webflow.com/hc/en-us/articles/33961244391059-Manage-CMS-Collections), [theme update](https://webflow.com/updates/light-and-dark-themes-across-webflow).

## GetDesign and user-provided local references

The local repository `D:\MyCode\get-design` at Git commit `f3c8f6c841f795b32eb369649ad9ec172626edab` identifies its remote as [nuocftraik/get-design](https://github.com/nuocftraik/get-design). The Webflow analysis at `design-systems/webflow/DESIGN.md` and selected files under `skills/` were read. [getdesign.md](https://getdesign.md/) is the user-requested public collection. The local source did not include a discovered root license in the targeted file inventory; no license permission is inferred from that absence.

This project contains independently written notes and links, not a copied analysis, library, template or script. Originals remain unchanged at the user-provided location.

## Impeccable

Selected product, interaction, contrast and motion references were read from `D:\MyCode\get-design\.agents\skills\impeccable\reference\`. The local `skills-lock.json` identifies [pbakaus/impeccable](https://github.com/pbakaus/impeccable) as its upstream with computed hash `6894a8e7c14df9b063925cb134c73b2ca8c912c015710ac36f2f250d7c7ab998`. This is provenance from that lockfile, not a verified upstream revision or a license assertion.

No original Impeccable script, skill or substantial reference text is distributed in the Frontend project. [Selected notes](design/references/product-ui-notes.md) and [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md) were authored for the approved Angular/PrimeNG workspace.

## MotionSites

[motionsites.ai](https://motionsites.ai/), including its Apps filter, is retained as the user's motion inspiration. This pass copied no code or assets and made no claim that project timing values were measured from MotionSites. Its requested URL timed out in one separate documentation web-fetch attempt; that limitation is recorded in [references](design/references/README.md).
