# Tech badge artwork

The existing badge colors, outlined label glyphs and working logos were captured from the ShieldCN SVG URLs recorded in `catalog.json`. The generated badges retain those exact background fills, with 10px corners and a consistent 36px height. Generation needs no network access.

Replacement logo artwork:

- Contabo: the cloud symbol from [Contabo's own SVG](https://cdn.contabo.com/contabo-logo-2.svg); blue and orange fills retained.
- Dokploy: [official repository logo](https://github.com/Dokploy/dokploy/blob/canary/apps/dokploy/public/logo.svg), shown in white for contrast on its existing black badge.
- Azure: [Microsoft Fluent UI AzureLogoIcon](https://github.com/microsoft/fluentui/blob/master/packages/react-icons-mdl2-branded/src/components/AzureLogoIcon.tsx).
- Windows: [Microsoft Fluent UI WindowsLogoIcon](https://github.com/microsoft/fluentui/blob/master/packages/react-icons-mdl2-branded/src/components/WindowsLogoIcon.tsx).

Microsoft Fluent UI is [MIT licensed](https://github.com/microsoft/fluentui/blob/master/LICENSE). Brand marks remain the property of their respective owners and identify the technologies used.

Regenerate with `pnpm generate:tech`. REST API is intentionally excluded.
