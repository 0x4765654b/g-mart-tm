# G-Mart Enhancer — Whole-Site Improvement Plan

_Originally drafted Tue Oct 13 2026 from a full crawl of the live site (v6.6).
Updated Thu Oct 15 2026 for **v6.16.1** after the first live browser test pass
(logged in and logged out, light + dark, Chrome; spot-checked in Firefox +
Greasemonkey)._

## TL;DR

The original plan (P1–P3) is **done**: the account/forms layer, Back Issues,
cart styling and the hybrid sale pages all shipped in v6.7–v6.10 and were then
fixed up against the live site in v6.14–v6.15. Dark mode now has **0
low-contrast text** on every page that was audited. What's left is small polish
(a few unverified edge cases, light-mode auditing, minor page oddities) and
optional features (cart peek, Customer Information reflow).

---

## Site map — current state

| # | Page | Structure | State (v6.16) | Remaining |
|---|------|-----------|---------------|-----------|
| 1 | **Home / Landing** | `td.home-preorder-cell` featured grid + section banners | ✅ 3-up cards, wrapping hardened (v6.15.1), dark-mode badges/buttons fixed (v6.14) | Missing-cover placeholder (P4) |
| 2 | **Your Subscriptions / Your Pre-Orders** | `x####` / `q####` input tables | ✅ Polished list (v6.15): section headers + counts, frequency pills, quiet Remove, primary Save; price sort fixed (v6.14) | — |
| 3 | **Subscriptions & Pre-Orders hub** | teal info panels + Pre-Order Type table | ✅ Dark mode fixed (v6.14) | — |
| 4 | **All Subscriptions** (hub → Browse All) | per-item bubbles + Record Subscriptions | ✅ Tiled 3-col per publisher (v6.15.3) | — |
| 5 | **Publisher pre-order pages** (e.g. Marvel) | per-item bubbles + Record Orders | ✅ Grid per publisher heading (v6.14); raw item codes hidden (v6.16.1) | — |
| 6 | **Current Issues / new-release weeks** | `ul.ul-none` publisher groups | ✅ Tiles, filters, hide-owned, ratio tags readable | — |
| 7 | **Graphic Novels** | publisher groups (bare `<strong>`) | ✅ 3-col cards, featured strip fixed | — |
| 8 | **Clearance / Back In Stock / SALE 60%** | catalog + featured strip | ✅ Tiled; strip uses home card rules | — |
| 9 | **Back Issues landing** | title search + 589-link publisher index | ✅ v6.9 index + live filter | — |
| 10 | **Back Issues title pages** | nested or *flat* publisher lists | ✅ Detected logged-out (v6.14.1); flat Popular Titles layout rebuilt (v6.14.2); repeated publishers merged | — |
| 11 | **Search** | form | ✅ Styled (v4) | — |
| 12 | **Cart** | invoice table + payment/shipping form | ✅ Styled (v6.10), dark header rows fixed (v6.14); filled-cart badge verified (v6.16.1) | Cart peek (P7) |
| 13 | **Want List** | catalog list | ✅ Catalog treatment with a slim toolbar for short lists (v6.16.1) | — |
| 14 | **Customer Information** | big settings form | ✅ Restyled (v6.7); label colors fixed (v6.14) | Optional reflow (P7) |
| 15 | **Account Balance** | `<pre>` ledger | ✅ Carded ledger + total pill (v6.8) | — |
| 16 | **Items Ready for Shipping** | form + tables | ✅ Account styling + centered section/publisher headings (v6.16.1) | — |
| 17 | **Your Shipments / Contact Us** | data / info tables | ✅ Readable in dark mode | — |
| 18 | **FAQ** (`faq.html`) | static Q&A page (logged out) | ✅ Global theme, readable in dark mode | Optional "article" treatment (P5) |
| — | **Header** (all pages) | sticky nav, ▼ menus, cart/want bubbles | ✅ Matching blue pills (v6.14.3), menus readable, toolbar pins below header (v6.15.2) | — |

Legacy class vocabulary (useful for targeting): `invoicebasic-*`,
`div-bubble-veryfaint-compact` / `div-bubbles-space-compact-clear` (per-item
bubbles), `div-bubble-info`, `div-bubble-faq-compact`, `home-preorder-cell*`,
`highlight-text-comic-map-*` (ratio tags), `navbutton-info` /
`navbutton-blue-brand`, `menu-dropdown` (wraps both the ▼ label and its fly-out),
`navcart-*`, `grid-table-checkbox-options-cell-*`.

---

## Done (from the original plan)

- **P1 account & forms layer** — v6.7 (Customer Information, data tables), v6.8 (ledger).
- **P2 Back Issues** — v6.9; title pages v6.14.1–v6.14.2.
- **P2 Cart** — captured and styled in v6.10 (delivered as checkout styling; the
  cross-page "peek" is still open, see P7).
- **P3 hybrid sale pages** — featured strips render with the home card rules;
  dark-mode readability fixed in v6.14.
- **Cross-cutting dark mode** — the "two intentionally-left" contrast spots were
  fixed after all (yellow/black sale badges, ratio tags); header menus verified
  on every page.

---

## Remaining work, in priority order

### P4 — Home polish (minor)
- Missing-cover items: reserve the cover column or show a placeholder so titles
  line up with cards that have covers.

### P5 — FAQ article treatment (optional)
`faq.html` is a standalone page (loads logged out). It's readable; a max-width /
spacing "article" pass would just make it nicer.

### P6 — Small loose ends ✅ done in v6.16.1
Items Ready for Shipping styling, hidden pre-order item codes, slim toolbar on
short lists (≤ 12 items — note this also applies to small catalog pages such as
Back In Stock), filled-cart badge verified.

### P7 — Optional features
- **Cart peek**: a small hover/drop-down showing cart contents from any page.
- **Customer Information reflow**: two-column fieldsets (restyle-only today).

### P8 — Testing
- **Light-mode contrast audit**: `tests/run.js` only scores dark mode; add the
  same audit for light mode.
- **Manager-compatibility test**: the Tampermonkey / Greasemonkey-4 / no-API shim
  test used for v6.16 lives outside the repo — fold it into `tests/`.
- **Browser coverage**: automated checks run in Chrome only; Firefox and Safari
  are verified by hand.

---
_Live page structures are captured locally in `reference/` (git-ignored — they
contain account data). `tests/run.js` re-checks any page in light and dark mode._
