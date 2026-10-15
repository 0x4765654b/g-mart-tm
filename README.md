# G-Mart Comics Enhancer

A userscript (Tampermonkey, Violentmonkey or Greasemonkey) that reskins [g-mart.com](https://www.g-mart.com/) and
adds subscription / pre-order management **and** catalog-browsing features. Pure
DOM + CSS — G-Mart is a classic CGI store (`store.cgi`) with no JSON API, so
everything is done against the rendered HTML.

> **Unofficial.** This is a personal project and is not affiliated with or
> endorsed by G-Mart Comics. It only changes how pages look and adds client-side
> tools; it never changes your orders unless you press the site's own buttons
> (Save Changes, Record Orders, BUY, …).

**Quick install** (with Tampermonkey set up as below):
[**Install gmart-enhancer.user.js**](https://raw.githubusercontent.com/0x4765654b/g-mart-tm/main/gmart-enhancer.user.js)

## Files

| File | Purpose |
|------|---------|
| `gmart-enhancer.user.js` | The userscript (v6.16). Install this in Tampermonkey. |
| *(history)* | Every released version is a tagged commit (`git log --follow gmart-enhancer.user.js`, `git tag`); there is no separate versions folder. |
| `tests/` | Live-site Playwright checks (logged-in via macOS Keychain service `gmart-enhancer-test`); see `tests/README.md`. |
| `reference/` | *Local only, not committed* — captured page DOMs (subs hub, Your Subscriptions, Pre-Orders, Current Issues, Back Issues title / Popular Titles, All Subscriptions) used to build against offline. They contain account data, so they're git-ignored. |

## Features

**Reskin (site-wide):**
- Readable typography, spacing, centered content column
- Sticky top nav; rounded buttons; calmer links
- Dark mode
- A ⚙ settings panel (top-right) to toggle the theme and dark mode (persists via `GM_setValue`)

**Subscription & Pre-Order management** (`Your Subscriptions` / `Your Pre-Orders`):
- Search box to filter titles
- The site's **native header row** is made sortable (click Qty / Title / Price / Type)
- "Group by type" toggle (subscriptions: monthly / miniseries / …); clicking a
  column header auto-flattens grouping so sorting applies across the whole list
- Per-row **Remove** button (sets qty to `0`, the site's documented removal method; Undo supported)
- Live summary (count + total). Subscriptions show **cover price**; pre-orders sum the site's real "Total Price".
- **Polished list look** (v6.15): the native table is restyled as one clean full-width card — publisher rows become section headers with item counts, frequency shows as a colored pill (blue = monthly, purple = miniseries), prices in monospace, a quiet Remove that brightens on row hover, and a blue primary **Save Changes** button. Same inputs and form underneath.

**Catalog browser** (Current Issues / Back Issues / Graphic Novels / publisher browse / search results — all share the `<li>` grid grouped by publisher):
- **Live filter box** — narrow the on-page list by title as you type
- **Publisher jump-nav** — sticky bar of all publishers (with counts); click to scroll to a section
- **Hide titles I get** — hides catalog items matching your subscriptions (titles are learned automatically the first time you visit "Your Subscriptions"; matched items also get a green `SUBSCRIBED` badge)
- **Deals only** — show only discounted items (save %/SALE)
- **Always-visible price/stock legend** — decodes the color codes from the site's FAQ (green = well stocked/best price, yellow = medium, red = low stock/last copies priced higher, none = standard, ★ = SALE, `*`/`**` = price tier)
- **Compact** density toggle — shrinks covers and tightens rows to fit more per screen
- **Sort within each publisher** — dropdown: default (native order) / Title A→Z / Price ↑ / Price ↓ (publishers stay as sections; items reorder inside each)
- **Release-date jump** — buttons for This week / Last week + a Recent dates link, sourced from the page's native new-release date links
- **Remembered toggles** — your Deals-only, Hide-titles-I-get, Compact, and sort choices persist across page loads (saved via `GM_setValue` under `gm_cat_prefs`) and are restored automatically when a catalog page opens

**Search page** — the Advanced Search form (text box, Section checkboxes, Regular/Deep radios) is restyled to match the theme; field names/values are untouched so search still works. Search results get the full catalog browser treatment.

## How it works (page structure notes)

**Management pages** share the `invoicebasic-*` table structure, with single-cell
publisher section rows interleaved between item rows and a SUBTOTAL row. The
script only touches item rows (`<input name="x####">` subs / `<input name="q####">`
pre-orders) and never alters the real inputs or the form, so **Save Changes**
behaves exactly as the site intends.

Row layouts (0-based cell indices):
- **Subscriptions:** `[0]` qty input · `[1]` title · `[2]` cover price · `[3]` frequency/type
- **Pre-Orders:** `[0]` qty input · `[1]` title · `[2]` unit price · `[3]` (save $) · `[4]` total price

**Catalog pages** use `<ul class="ul-none">` with publisher-group `<li>`
(`span.text-size-large > strong`) each wrapping a nested `<ul>` of comic `<li>`
items. Each comic item has a quick-add cart icon, a color-coded price span
(`.actiontext-price`), a title span starting with ▶ (`span.onclick-cursor` — the
clean title, NOT the long solicitation blurb that is also inside the `<li>`), and
a BACK ISSUES link. The script reads the title from the ▶ span specifically so
series matching for "hide titles I get" works correctly.

"Hide titles I get" matches by a normalized **series key** (title with the ▶,
price code, issue/volume number, and `(Cover …)` stripped), compared against the
subscription series names remembered from the subscriptions page.

## Install

### 1. Install a userscript manager
Install **Tampermonkey** for your browser:
[Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) ·
[Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) ·
[Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/) ·
[Safari](https://apps.apple.com/app/tampermonkey/id1482490089) (paid App Store app) ·
[Opera](https://addons.opera.com/extensions/details/tampermonkey-beta/).
**Violentmonkey** and **Greasemonkey 4** (Firefox) work too: the script uses the
synchronous `GM_*` API where it exists and falls back to Greasemonkey's
Promise-based `GM.getValue` / `GM.setValue` (theme CSS is injected directly).
With Greasemonkey, install by opening the raw link below (Greasemonkey shows its
install dialog) or via its **New user script** editor.

### 2. Chrome / Edge only: allow user scripts
Chromium browsers block extensions from running user scripts until you opt in.
**If you skip this, the script installs but silently does nothing.**
- **Chrome 138+ / current Edge:** open `chrome://extensions` (Edge: `edge://extensions`)
  → Tampermonkey → **Details** → turn on **Allow User Scripts**.
- **Older Chrome / Edge:** turn on **Developer mode** (top-right of the extensions page).

Firefox and Safari need no extra step.

### 3. Install the script
- **Recommended — one click:** open the
  [raw script link](https://raw.githubusercontent.com/0x4765654b/g-mart-tm/main/gmart-enhancer.user.js).
  Tampermonkey shows its install page → **Install**. Installing this way enables
  automatic updates (below).
- **Manual:** Tampermonkey dashboard → **Create a new script** → delete the
  template → paste the contents of `gmart-enhancer.user.js` → save (⌘S / Ctrl+S).
  The script carries its update URL, so manual installs update automatically too
  from v6.15.4 on.

### 4. First run
1. Reload any `https://www.g-mart.com/` page. A blue ⚙ gear appears top-right;
   management and catalog pages get their toolbars.
2. **Dark mode is off by default** — click ⚙ → **Dark mode**. The ⚙ panel also has
   **Clean theme** to turn the whole reskin off. Both settings are remembered.
3. Visit **Your Subscriptions** once so the script learns your titles for the
   catalog **Hide titles I get** filter (and the green SUBSCRIBED badges).

### Updates
Tampermonkey and Violentmonkey check the GitHub copy periodically (default: daily)
and offer the update when `@version` increases; Greasemonkey 4 also updates
automatically from the script's `@downloadURL`. To check now: dashboard → **Utilities** →
**Check for userscript updates**, or open the script's raw link again.
If you installed **before v6.15.4** by pasting, reinstall once from the raw link
(or paste v6.15.4) so Tampermonkey picks up the update URL.

### Disable / uninstall
Tampermonkey dashboard → toggle **G-Mart Comics Enhancer** off to disable, or
use the trash icon to remove it. The site goes straight back to its native look.

Settings (dark mode, catalog toggles, learned subscription titles) are stored by
the userscript manager **per browser** — repeat step 4 in each browser you use.

### Troubleshooting
- **Nothing changes on g-mart.com:** check step 2 (Chrome/Edge), that the script is
  enabled in the dashboard, and that you're on `https://www.g-mart.com/` (the
  `@match`).
- **Two copies running** (odd colors or doubled toolbars): keep only one
  *G-Mart Comics Enhancer* in the dashboard.
- **"G-Mart High Traffic / Please Wait":** that's the site throttling guests — log in.

## Version history
- **v6.16** — **Greasemonkey 4 support** (Firefox). GM4 has only the Promise-based `GM.getValue` / `GM.setValue` and no `GM_addStyle`, so the script previously died on its first settings read. A small `GMC` compatibility layer now wraps storage and styling: with Tampermonkey / Violentmonkey it calls `GM_*` directly (unchanged); with GM4 it preloads the four keys the script uses (`gm_dark`, `gm_reskin`, `gm_owned`, `gm_cat_prefs`) before boot so reads stay synchronous, persists writes via `GM.setValue`, and injects the theme with a `<style>` element; with no manager API it runs on defaults. Header adds `@grant GM.getValue` / `GM.setValue`. Startup errors are now logged as `[G-Mart Enhancer]` in the console. Verified with Tampermonkey-style, Greasemonkey-4-style (async) and no-API shims: theme + dark mode, ⚙ toggles persisting, catalog prefs and learned titles restoring; live (Tampermonkey-style): unchanged behavior, 0 dark-mode contrast failures. Verified by hand in Firefox + Greasemonkey 4 (theme, dark-mode persistence, learned titles / SUBSCRIBED badges).
- **v6.15.4** — Install & update: header gains `@homepageURL`, `@supportURL`, `@updateURL` and `@downloadURL` (raw GitHub copy), so Tampermonkey auto-updates from the repo whenever `@version` increases. README install section rewritten: browser links, the Chrome/Edge **Allow User Scripts** (or Developer mode) requirement, one-click install from the raw link, first-run notes (dark mode off by default, visit Your Subscriptions once), update / disable / troubleshooting, and an "unofficial" disclaimer. No behavior changes.
- **v6.15.3** — **All Subscriptions** page (hub → Subscriptions → Browse All) was untiled: its items are the same per-item bubble layout as the publisher pre-order pages, but the tiler only recognized a "Record Orders" submit and this page has "Record Subscriptions", so the light bubbles stayed light and dark mode left SUBSCRIBE as navy-on-dark. `enhancePreorderCatalog()` now accepts either submit, and uses `span#subtext_*` (the series name, e.g. "Alien (monthly)") as the tile title when present instead of the "(►starts AFTER)" toggle. Verified live: 1,356 tiles in 96 publisher grids, 0 dark-mode contrast failures, light mode clean.
- **v6.15.2** — The sticky catalog toolbar (filter / sort / deals / hide-owned / compact) was pinned at `top:0` above the site's own sticky header, covering it on scroll (since v3). It now pins just **below** the header: new `syncNavOffset()` measures `.navtable-main` into `--gm-nav-h` (re-measured on resize, load and theme toggle; 0 when the clean theme is off), and the toolbar sits under the header in stacking order so the header fly-out menus open over it. Also removed four unused leftovers (`isSection`, `anchorRow()`, `captureOwnedTitles`'s `didList` parameter, a superseded `blurb` lookup in the pre-order tiler). Verified live: toolbar top = header bottom (101px) in light and dark, Customer Service menu overlays the toolbar, catalog filter/deals/hide-owned and subscription list tools unchanged.
- **v6.15.1** — Home featured cards: hardened text wrapping after a report of titles/blurbs clipped at the card's right edge (not reproducible in Chrome at 1000–1400px, either post-load or at Tampermonkey's document-end timing). The site's fixed `min-width:322px` on the cell box is dropped inside the card, and the loose blurb text node is wrapped in `.gm-home-blurb` as its own full-width wrapping line (short punctuation nodes like the " : " after a series label are left alone). Verified live: 0 clipped cards at 1000 / 1100 / 1200 / 1280 / 1400px.
- **v6.15** — **Polished Subscriptions / Pre-Orders list.** The native table (inputs + form untouched, so Save Changes behaves as before) is restyled as a full-width card: no grid lines, uppercase column headers, publisher rows as section headers with an item-count badge, frequency as a pill (monthly / N-issue mini), monospace prices, compact qty boxes, a quiet Remove (full color on row hover; Undo stays visible), a styled subtotal row, and a primary-blue Save Changes. The grey "Subscriptions automatically create Pre-Orders…" note box gets a dark surface in dark mode (skipped by `gmFixContrast`; the hub's Pre-Order Type table uses the same box and was re-verified). Verified live: filter / sort (incl. price) / group-by-type intact, quantities unchanged, 0 dark-mode contrast failures on Subscriptions, Pre-Orders and the hub.
- **v6.14.3** — Header pick-list buttons (▼account / ▼Customer Service / ▼Social) looked mismatched in dark mode: a dark box with only a blue or grey rim, next to the solid blue Search / FAQ pills. Cause: the dark fly-out-menu rule darkened every `[class*="menu-dropdown"]`, but that div is also the wrapper around each button's own ▼label. Now only the fly-out list (`ul`/`li`) is darkened, and the account / Guest pill (`navbutton-info`, the site's light grey) uses the same brand blue in dark mode. Verified live: all five header pills render as matching blue pills; opened menus keep the dark panel with readable links; light mode unchanged.
- **v6.14.2** — Back Issues **Popular Titles** pages (Back Issues → Popular Titles → e.g. Darth Maul) were still unenhanced: they're a *flat* layout — a loose `<span class="text-size-medium">Publisher</span>` next to each `ul.ul-none` of items directly under `<body>` — so the publisher headings stayed at the far left while the lists centered. New `normalizeFlatCatalog()` rebuilds them into the nested publisher-`<li>` shape before the catalog enhancer runs, so they get the toolbar, tiles, legend, jump-nav and the v6.14.1 publisher merge (Dark Horse / Marvel / Dark Horse / Marvel → 2 groups). Verified live (logged in): 71 tiles in 2 groups, no script errors; v6.14.1 on the same page → not enhanced.
- **v6.14.1** — Back Issues title pages (e.g. "Darth Maul"): (1) logged-out title pages weren't enhanced at all — they lack the quick-add icons the catalog detector keyed on; it now also accepts `click_comic_description` (the ► title toggle on every catalog item); (2) repeated publisher headings (Dark Horse / Marvel / Dark Horse…, since the site lists in title order) are folded into one group per publisher, keeping item order; (3) lists that are direct children of `<body>` are now held to the 1100px content column (fixes the left-edge bleed; catalog pages' tile grids now align with the toolbar/header instead of running full-width); (4) the "FAQ: What are ▢▢▢ ?" strip gets a dark surface in dark mode. Verified on a captured title page with guest conditions simulated (installed v6.14 → no enhancement; v6.14.1 → tiled, 3 groups → 2), and live on Current Issues / SALE 60% (0 dark-mode contrast failures, filters intact). Not live-verified logged-out: guest Back Issues pages are behind G-Mart's "High Traffic" throttle.
- **v6.14** — Live-verified fixes from the first full browser test pass: (1) **Pre-Orders price sort** — header cells are now mapped to item columns by `colspan`, so "Total Price" (which sits after the 2-column "Unit Price" header) is sortable; (2) **Subscriptions & Pre-Orders hub dark mode** (v6.13 #3 didn't take) — the hub rules lost to the generic `.gm-fixdark` dark-text rule on specificity and to `gmFixContrast`'s inline navy links; hub rules now carry `.gm-subshub` specificity, `gmFixContrast` skips/undoes inline link colors on the hub, and the menu-bearing teal panel is tagged `gm-hubsurface`; (3) **dark-mode invoice header rows** (Subscriptions / Pre-Orders / Cart `th.invoicebasic-td-section`) were white-on-light-grey — now dark surface + light text. Verified live: 0 low-contrast text on Subscriptions, Pre-Orders, and the hub in dark mode; light mode unchanged. (4) **featured cards** (home + the featured strips atop Graphic Novels / Clearance / SALE 60%) — `gmFixContrast` now skips `td.home-preorder-cell`, so SUBSCRIBE / BACK ISSUES / prices use the home rules instead of navy/#111 on dark chips; yellow sale badges, SOLD OUT chips and the GN promo strip get dark ink; (5) the **black "save NN%" badge** variant gets white text (the v6.13 dark-ink rule had caught it); (6) **ratio/variant tags** (`highlight-text-comic-map-*`, "1:25" / "variant" / "exceed") get dark ink on their cyan highlight; (7) **publisher pre-order pages** (e.g. Marvel) — each item is wrapped in its own div, so only the first became the grid; runs of adjacent wrappers are now gathered into one grid per publisher heading (still inside the Record Orders form), and PRE-ORDER/SUBSCRIBE no longer stretch full-width; (8) minor: header outline heart stays dark on its light bubble, filled-cart label gets dark ink, the logged-out "▼Guest" chip is styled like the account name, and Customer Information's dark red / purple labels are lightened. Verified live in dark mode: 0 low-contrast text on Home, Current Issues, Graphic Novels, Clearance, SALE 60%, Marvel pre-orders, Customer Information, Subscriptions, Pre-Orders and the hub; light mode unchanged. Not live-verified: the filled-cart header label (needs an item in the cart).
- **v6.13** — Dark-mode contrast fixes (4): (1) account name "#NNNNN …" was dark-on-dark in the header — new tagHeaderAndHub() tags it gm-acct-name and CSS forces it light; (2) sale badges (the yellow "save NN%" / discount pills) were getting near-white text from the blanket dark-mode light-text rules (white-on-yellow ~1.1:1) — now forced dark ink site-wide; (3) teal/cyan legacy strips on the Subscriptions & Pre-Orders hub are flagged gm-subshub and recolored to a muted dark surface instead of glaring teal; (4) home tile title wrap — broadened the wrap rule to the title link/span so long featured titles wrap instead of clipping. NOTE: static-validated but NOT yet live-verified (Cloudflare was up at save time; confirm visually after reinstalling v6.13).
- **v6.12** — Pre-Orders catalog tiler (the deferred #3 "white on black"). New `enhancePreorderCatalog()` detects the Pre-Orders catalog (the `Record Orders` form whose items are fl
- **v6.11** — Dark-mode polish batch (4 fixes): (1) **heart/wishlist icon** forced white in dark mode like the cart icon (filled-red heart stays red to signal "on want list"); (4) **header fly-out menu contrast** — Customer Service / Social / account menus were dark-navy-on-dark (~1.4:1); root-caused to `gmFixContrast` tagging the enclosing navbutton and repainting the nested menu links navy. Fixed by excluding menu-containing header buttons from the contrast pass + a readable light-blue menu-link rule (now 8.15:1). (5) **catalog blurb → hover-reveal**: the solicitation footer (`.gm-tile-foot`) is collapsed to 0 height by default and expands on tile hover, with an "ℹ synopsis" cue; kills the always-on wall of text. (6) **Graphic Novels 3-column**: GN now uses a fixed 3-col card grid (home-page feel), degrading to 2→1 col on narrow viewports.
- **v6.10** — Cart / checkout styling (plan P2 "Cart peek"). New `enhanceCart()` detects the cart form (BUY + Clear Cart submits) and cards the line-item rows, emphasizes the TOTAL line, makes BUY a prominent green primary, Clear Cart a cautionary red, and styles the payment/shipping fields — dark-mode-safe, no DOM restructuring, no cart contents touched. (Cart page DOM captured for the first time this session; delivered as checkout-page styling rather than a cross-page hover dropdown.)
- **v6.9** — Back Issues landing enhancement (plan P2). New `enhanceBackIssues()`: styles the title-search input + Search button, turns the "Popular Titles" quick-picks into chips, and transforms the flat 589-link publisher/imprint wall into a responsive 4-column index with imprints (names containing " / ") indented and dimmed under their parents. Adds a **live filter box** over the publisher list (type-ahead; verified 589→1 on "vertigo"). Non-destructive — native `<a>` hrefs untouched, so navigation is preserved.
- **v6.8** — ledger styling (plan "polish the data pages"). The Account Balance transaction ledger renders as a monospace `<pre>` block (date / amount / type columns), so v6.8 cards the `<pre>` itself (`.gm-ledger` — padded, rounded, bordered, dark-mode-safe) without parsing the text, and turns the legacy `<font color="Red">Total of above: YOU OWE …</font>` line into a highlighted total pill (`.gm-ledger-total`, inline red overridden to a theme-appropriate shade). Pure CSS + marker classes.
- **v6.7** — account & form styling layer (plan P1). New `enhanceAccountPages()` tags account/form pages (`gm-account`) and candidate data tables. The **Customer Information** form now has consistent rounded inputs/selects, carded fieldsets with uppercase legends, a prominent blue "Save Changes" CTA, and softened helper buttons — dark-mode-safe and PII-safe (styling only, no values touched). Data-table CSS (zebra rows, right-aligned amounts) ships for pages with real `<table>`s. NOTE: the Account Balance ledger is a monospace list (not an HTML table), so it stays readable via the global theme but isn't carded — flagged for a future dedicated pass.
- **v6.6** — home featured items are now a **centered, 3-up card grid with titles that wrap inside each card**. The native desktop wrapper (`div.mobile-display-none`) is centered (`max-width:1140px; margin:auto`) and turned into a real 3-column CSS grid by flattening its nested tables with `display:contents` (one grid on the wrapper — not the fragile cross-table move that failed in v6.3). Each cell is a cover-left card; the legacy `<nobr>` around title/price is overridden to `white-space:normal` so long titles wrap instead of clipping. Fixes the earlier left-bleed (v6.5) and right-overflow (v6.5.1) by sizing to 3 columns that fit the centered column.
- **v6.5.1** — fixed the home page's featured grid bleeding off the left edge: the native desktop featured wrapper (`div.mobile-display-none`) was full-width and left-anchored while the rest of the page centers in a ~1100px column. Centered it (`max-width:1100px; margin:auto; display:block`) so the featured cards align with the header, nav, and banners.
- **v6.5** — home page featured items now show as cover-left cards via a **CSS-flex-only** per-cell approach: each visible desktop cell (`home-preorder-cell-minwidth_4`) is flexed in place and the cover is pulled to the left with CSS `order` — no DOM is moved, so cells can't affect each other and there is no overlap (the failure mode of the v6.3 grid-rebuild). Covers de-floated and sized; title/discount/SUBSCRIBE/blurb flow beside them. Keeps v6.4's dark-mode readability + section banners.
- **v6.4** — reverted the v6.3 home-page card/grid restructuring (it caused overlapping, unusable cards on the real page — the home layout is a legacy nested table with a hidden mobile duplicate that resisted every grid approach). The home page now gets **readability-only** treatment: no layout/geometry changes at all, just dark-mode recoloring so prices/titles/links are legible, styled section-header banners, and discount-badge emphasis. Catalog + Graphic Novels tiling (v6.1–v6.3) unchanged.
- **v6.3** — tiles extended to Graphic Novels (and other publisher-grouped catalog pages — broadened the group detector to accept a bare `<strong>` label, not just `span.text-size-large`), plus a NEW home/landing page module: featured items card-ified (real cover on the left, title + discount badge + SUBSCRIBE/BACK ISSUES + blurb on the right) in a responsive grid, discount badges emphasized, and the section banners + promo strip restyled to match the theme.
- **v6.2** — tile layout refinements: title moved to the top of each tile, with the cart icon + status color box + price grouped on one row beneath it; cart icon forced white in dark mode (the dark SVG glyph was invisible on dark tiles).
- **v6.1** — tile status accents (colored left border per stock/sale code: magenta SALE, green/yellow/red stock, neutral standard) and darkened the site's pale cyan header strips ("New Releases", FAQ bar) in dark mode.
- **v6** — tiled catalog layout (responsive card grid with solicitation-blurb footers), styled gradient publisher section headers (name + category + count), readable prices in dark mode (catalog excluded from the contrast pass), and a light backing panel behind the G-Mart logo in dark mode.
- **v5.1** — dark-mode contrast fixes: nav links stay white on blue (no more blue-on-blue), dropdown menus darkened, and a JS pass (`gmFixContrast`) that detects the site's pale cyan/legacy strips and forces readable dark text + dark links on them. (Two spots remain at the site's own native contrast — white-on-cyan tabs, red "save" badge — left as-is since they're G-Mart's intentional styling.)
- **v5** — catalog toggles (deals-only, hide-owned, compact, sort) now persist across page loads and restore automatically.
- **v4** — catalog within-publisher sort (title / price), release-date jump (this/last week + recent dates), and a styled Search form.
- **v3** — catalog browser enhancer (live filter, publisher jump-nav, hide-owned, deals-only, price legend, density) across Current Issues / Back Issues / Graphic Novels / publisher browse / search results.
- **v2** — subscription + pre-order management (sortable native header, group-by-type, quick-remove, live totals); pre-orders page support.
- **v1** — reskin + initial subscription list enhancements.
