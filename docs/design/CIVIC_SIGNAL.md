# Civic Signal design system

Civic Signal is the visual contract for the public catalogue. It is deliberately independent of
Hong Kong Government and provider identities: no flags, official marks, agency logos or provider
logos are part of the system.

## Pinned concepts

- [`concepts/catalogue-desktop.png`](concepts/catalogue-desktop.png), 1536 × 1024
- [`concepts/resource-detail-desktop.png`](concepts/resource-detail-desktop.png), 1536 × 1024
- [`concepts/catalogue-mobile.png`](concepts/catalogue-mobile.png), 864 × 1821 representing a 390px
  responsive layout

Generated dates, filter counts and example descriptions in the concepts are layout examples only.
The application must render values from the validated catalogue and must not turn mockup content
into publication claims.

## Visual tokens

| Role | Value | Use |
| --- | --- | --- |
| Paper | `#f8f7f3` | page and quiet band background |
| Surface | `#ffffff` | controls and focused reading surfaces |
| Ink | `#18212f` | primary text and rules |
| Muted | `#66625b` | supporting metadata |
| Signal red | `#c81e3a` | active state, primary action and route-line motif |
| Border | `#d8d5ce` | ledger rules and control boundaries |
| Warning | `#fff7df` | terms-review notice only |

Use an editorial sans-serif stack with strong, compact headings and deliberately sized control
text. The system uses thin rules, low corner radii, almost no shadow and open bands or ledger rows
instead of nested cards. Red route lines and small circular nodes are the only decorative motif.

## Component families

- A quiet independent-project notice before the application header.
- A restrained brand/header row with catalogue, toolkit, about and locale controls.
- A search-led hero followed by category links; no eyebrow, badge or invented proof element.
- A desktop filter rail that becomes one disclosure control below 760px.
- Resource ledger rows with consistent labels for provider, type, protocol, authentication, terms
  review and checked date.
- One warning-surface terms-review panel on a detail page.
- An open toolkit band and a rule-separated legal footer.
- Line icons use a consistent 1.75px stroke, rounded caps, `currentColor`, 18–22px optical size and no
  decorative container except the toolkit terminal mark.

Every interactive target is at least 44px. Keyboard focus uses a two-pixel ink outline with a white
offset. Hover and selected states add signal red without relying on colour alone. Motion is limited
to short disclosure and link transitions and is disabled under `prefers-reduced-motion`.

## Copy lock

The first viewport may show only these project-authored strings plus values generated from catalogue
data:

- `HK OPEN DATA`
- `Catalogue`, `Toolkit`, `About`, `繁中` or `English`
- `Independent community project. Check each source's current terms before use.`
- `Hong Kong public data, mapped and runnable.`
- The generated official, external and MCP counts
- `Search names, providers, topics…`
- `Browse resources`
- Factual category names and filter labels

Traditional Chinese mode uses equivalent translations from `i18n.ts`; it must not leave
project-authored interface prose in English.

## Responsive contract

Desktop keeps an approximately 280px filter rail beside an open results ledger. Below 760px, the
header navigation and filters become disclosures, resource fields stack in two-column definition
rows, and actions remain visible without horizontal scrolling. Search remains the primary control.
The notice must precede catalogue results in every viewport and locale.

## Content and safety boundaries

The site contains local, generated catalogue metadata only. It never fetches provider URLs. External
links are explicit user actions and visually identified. Terms-review states are not legal conclusions,
security endorsements, uptime guarantees or permission for commercial use, caching or
redistribution.
