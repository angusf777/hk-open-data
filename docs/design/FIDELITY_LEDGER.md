# Civic Signal fidelity ledger

Verified on 2026-08-31 against the three pinned concepts in
[`docs/design/concepts`](concepts/) using the in-app browser and committed catalogue data.

| Check | Concept evidence | Browser-render evidence | Result |
| --- | --- | --- | --- |
| First-viewport hierarchy | Notice, quiet header, headline, search, categories, filters/results, toolkit preview | [`catalogue-home.png`](../images/catalogue-home.png) at 1536 × 1024 | Matched; the toolkit remains visible at the bottom edge. |
| Palette and container model | Warm paper, white controls, dark ink, restrained red, thin ledger rules, warning band | Homepage and [`resource-detail.png`](../images/resource-detail.png) at 1536 × 1024 | Matched without gradients, glow, government marks or a card grid. |
| Typography and controls | Compact editorial sans, large balanced heading, deliberate labels and buttons | All three rendered screenshots | Matched using local system fonts; interactive targets remain at least 44px. |
| Resource anatomy | Provider, type, protocol, authentication, terms evidence, date and detail action | Homepage rows and resource detail metadata ledger | Matched with validated record values replacing mockup examples. |
| Detail evidence boundary | One calm warning panel, project notes separate from provider links, explicit external action | `resource-detail.png` | Matched; project evidence is never presented as permission or legal clearance. |
| Mobile reflow | Single column, collapsed filters, ledger definitions, two initial resources and toolkit | [`catalogue-mobile.png`](../images/catalogue-mobile.png) at a 390px viewport | Matched with zero horizontal overflow. |
| Icons | Fine, consistent outline icons for categories, search, filters, external actions and toolkit | Homepage and detail screenshots | Matched with the same 1.75px line family and `currentColor`. |
| Interaction | Live search, filter disclosure, locale switch, internal detail state and progressive results | Component tests and browser flow | Working; catalogue use caused no non-local network request. |

## Material fixes made during review

- Opened the native filter disclosure on desktop while leaving it collapsed on mobile.
- Replaced the first 521-row render with two initial rows plus a working progressive-disclosure
  control so the toolkit remains discoverable.
- Darkened the evidence-state label to pass WCAG AA contrast.
- Added the concept's category icon treatment.
- Removed the redundant mobile browse button and compacted generated counts for the narrow layout.
- Localized authentication, access, evidence, verification and language values in Traditional
  Chinese mode.

## Intentional data-driven differences

- Resource names, dates, states and counts always come from the validated catalogue; mockup values
  are not copied.
- Results use deterministic source-ID order rather than the mockup's unsupported relevance sort.
- Columns and CSV-export controls shown by the generated concept are omitted because they are not
  part of the approved product contract.
- The accessible 44px filter targets make the desktop filter rail taller than the visual mockup;
  the hierarchy and toolkit preview are preserved without shrinking controls.

## Above-the-fold copy diff

The implementation contains only the copy locked in [`CIVIC_SIGNAL.md`](CIVIC_SIGNAL.md), generated
catalogue counts and factual category/filter labels. No eyebrow, badge, fake metric, government
affiliation, safety claim or commercial-rights conclusion was added.

No material visual mismatch remains after these fixes.
