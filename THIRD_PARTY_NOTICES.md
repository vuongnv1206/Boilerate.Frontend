# Third-party references

This file records design-research provenance for the UI foundation, reviewed 2026-10-19. Runtime package licenses are supplied by their installed packages and lockfile; this list does not replace those licenses.

Inter Variable is self-hosted through `@fontsource-variable/inter`. Storefront headings use Noto Serif Variable through `@fontsource-variable/noto-serif`, distributed under SIL Open Font License 1.1; the installed package includes its license and metadata.

## PrimeUI runtime license

The user will supply a valid license later. The application currently runs with no license key and retains the vendor's normal warning/watermark behavior. An optional `PRIMEUI_LICENSE_KEY` environment variable is written to ignored runtime configuration and supplied through PrimeNG's supported `license` option. This is configuration support, not a license grant or verification of eligibility. No key is included in project documentation; license acceptance and watermark-free review remain pending.

## Webflow

Webflow interface documentation and public illustrations were consulted for workspace structure, CMS list/editor interaction and theme choices. Webflow is a trademark of its owner. Boilerate does not use the Webflow logo, proprietary font or claim affiliation. No Webflow application source or template was copied.

Sources: [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow), [content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor), [Collection items overview](https://help.webflow.com/hc/en-us/articles/33961289539347-Collection-items-overview), [CMS Collections](https://help.webflow.com/hc/en-us/articles/33961244391059-Manage-CMS-Collections), [theme update](https://webflow.com/updates/light-and-dark-themes-across-webflow).

## GetDesign, Impeccable and MotionSites

The warm paper, charcoal and terracotta palette direction was informed by the Claude design system study in [nuocftraik/get-design](https://github.com/nuocftraik/get-design) ([getdesign.md](https://getdesign.md/)). Product hierarchy, contrast and motion guidance consulted [pbakaus/impeccable](https://github.com/pbakaus/impeccable), and [motionsites.ai](https://motionsites.ai/) served as motion inspiration without copying code or assets.

Full `impeccable` and `frontend-design` skill bundles are installed locally under `Boilerate.Frontend/.agents/skills/`, alongside the project-specific [admin-ui-design](.agents/skills/admin-ui-design/SKILL.md). Consolidated provenance, upstream commit hashes, SHA-256 checksums and redistribution boundaries are maintained in [../docs/references/design-and-skills.md](../docs/references/design-and-skills.md) and [../docs/references/skill-sources.json](../docs/references/skill-sources.json).
