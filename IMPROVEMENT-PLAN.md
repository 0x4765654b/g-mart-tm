# G-Mart Enhancer — Whole-Site Improvement Plan

_Drafted overnight, Tue Oct 13 2026, from a full crawl of the live site (logged in). Current script: **v6.6**._

## TL;DR

The enhancer already covers the big content pages well (catalog tiling, subscriptions/pre-orders management, home featured cards, dark mode). The crawl surfaced a **whole class of pages the script barely touches**: the **account/utility pages** (Customer Information, Account Balance, Items Ready for Shipping, Your Shipments, Contact Us) and the **FAQ**. These are plain legacy tables/forms with no enhancement beyond the global theme. The highest-value next work is a **shared "page chrome + forms + data-tables" styling layer** that lifts every page at once, plus finishing the two parked catalog features.

---

## Site map (what exists, and current enhancement state)

| # | Page | Structure | Enhanced today? | Opportunity |
|---|------|-----------|-----------------|-------------|
| 1 | **Home / Landing** | `td.home-preorder-cell` featured grid + section banners | ✅ v6.6 cards, banners, dark readability | Minor polish only |
| 2 | **Subscriptions & Pre-Orders** | `x####`/`q####` input tables | ✅ v2 management (sort, group, remove, summary) | Solid |
| 3 | **Current Issues** (catalog) | `ul.ul-none` publisher groups | ✅ v6 tiles + accents + filters | Solid |
| 4 | **Graphic Novels** | publisher groups (bare `<strong>`) | ✅ v6.3 broadened detector | Solid |
| 5 | **Clearance / Back In Stock / SALE 60% Ratio Variants** | publisher-group catalog (+ small featured strip) | ✅ **already tiled** by catalog module | Verify hybrid featured strip renders |
| 6 | **Search** | form (text + section checkboxes + depth radios) | ✅ v4 styled form | Solid |
| 7 | **Back Issues (landing)** | title search + publisher browse list | ⚠️ captured, **not yet enhanced** | **PARKED #1** |
| 8 | **Cart** | not yet captured | ❌ | **PARKED #2 — capture first** |
| 9 | **Customer Information** | big settings **form**: 16 text + email + tel + 4 radio + 11 checkbox, 7 sections, 2 submits | ❌ global theme only | **NEW — biggest gap** |
| 10 | **Account Balance** | financial **data table** (charges/credits, "YOU OWE") | ❌ global theme only | **NEW — data-table styling** |
| 11 | **Items Ready for Shipping** | form + tables | ❌ global theme only | **NEW — data-table styling** |
| 12 | **Your Shipments** | data tables (4) | ❌ global theme only | **NEW — data-table styling** |
| 13 | **Contact Us** | static info tables | ❌ global theme only | **NEW — light content styling** |
| 14 | **FAQ** (`faq.html`) | static Q&A, 3 tables, 12 imgs — **separate page, logged out ("Guest Login")** | ❌ not themed at all | **NEW — but note: different page + no session** |

Legacy class vocabulary seen on account pages (useful for targeting): `grid-table-checkbox-options-cell-*`, `flex-group`, `div-bubblesblock-space-compact`, `navbutton-blue-brand`, `navbutton-tabunselected`, `menu-dropdown`.

---

## Proposed work, in priority order

### P1 — Shared "account & forms" styling layer (biggest visual win, lowest risk)
A new module `enhanceAccountPages()` + CSS that applies to pages 9–13. All are plain tables/forms, so pure CSS (no DOM restructuring) is safe and high-impact:
- **Form fields** (Customer Information): consistent input/select/radio/checkbox styling matching the already-styled Search form (`.gm-search-styled` is the template). Group the 7 sections into carded fieldsets with clear headers. Dark-mode field backgrounds + readable labels.
- **Data tables** (Account Balance, Your Shipments, Items Ready for Shipping): zebra rows, aligned numeric columns, a styled total/"YOU OWE" row, dark-mode-safe borders. Reuse one `.gm-data-table` class.
- **Submit buttons**: reuse the existing blue brand button style for consistency.
- Risk: low — these are static tables/forms; CSS-only, no overlap hazard like the home page had.

### P2 — Finish the two parked catalog features
- **Back Issues lookup** (page 7): structure already captured. Style the title search + wildcard, make the publisher/imprint browse list a clean two-column index, carry over dark mode.
- **Cart peek** (page 8): **first task is to capture the cart page** (add something to cart, open cart, record DOM). Then build a "cart peek" affordance to surface cart contents from any page.

### P3 — Hybrid sale pages
Clearance & SALE-60% pages are catalog + a small 24-cell featured strip at top. Confirm the featured strip inherits the home card treatment (or scope the home module to run there too). Likely a 1-line selector tweak.

### P4 — Home polish (minor)
- Missing-cover items (Star Wars/Marvel, Batman: Bad Seeds): reserve the cover column or show a placeholder so the title aligns with cover-having cards.
- Optional: tune the 3-column breakpoint for narrower windows (drop to 2, then 1).

### P5 — FAQ (optional, separate)
`faq.html` is a standalone static page and, notably, **loads logged-out** (shows "Guest Login"). The userscript's `@match` covers `g-mart.com/*` so it will run, but there's no catalog/account structure — just 3 content tables. A light "readable article" treatment (max-width, spacing, dark mode) is all that's warranted. Low priority.

---

## Cross-cutting polish (applies site-wide)
- **Native cyan strips**: v6.1 darkens the known `bgcolor` cyan values in dark mode; the account pages use different legacy strips — fold any newly-seen `bgcolor`s into the same `gmFixContrast` pass.
- **The two intentionally-left site-native contrast spots** (white-on-cyan tabs 3.08:1, red "save" on yellow) remain G-Mart's own branding — still recommend leaving unless you want to override.
- **Account/Customer-Service dropdown menus** (`menu-dropdown`): verify dark-mode contrast on every page (v5.1 fixed these on catalog pages; confirm they hold on account pages).

---

## Suggested sequencing for tomorrow
1. **P1 account/forms layer** — one module, big uplift across 5 pages, low risk. _(Recommend starting here.)_
2. **P2 Back Issues** — ready to build.
3. **P2 Cart** — capture, then build peek.
4. **P3 hybrid sale strip** — quick tweak.
5. **P4/P5** — polish passes.

Open question for you: for **Customer Information** (the settings form), do you want it visually restyled only, or also reflowed (e.g. two-column fieldsets)? Reflow is a bit more work and slightly higher risk — I'd default to **restyle-only** unless you say otherwise.

---
_All page structures from this crawl are captured in the session; I can start on P1 as soon as you're back. Nothing here is committed — it's a plan, not code changes._
