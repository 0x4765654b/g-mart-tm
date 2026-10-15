// ==UserScript==
// @name         G-Mart Comics Enhancer
// @namespace    https://www.g-mart.com/
// @version      6.3.0
// @description  Reskin G-Mart Comics + sortable/filterable subscription & pre-order management + a catalog browser enhancer (live filter, publisher jump-nav, hide-owned, deals-only, price legend, density, within-publisher sort, release-date jump, remembered toggles) for Current Issues / Back Issues / Graphic Novels / publisher browse / search results, plus a styled Search form. Pure DOM/CSS — no API needed.
// @author       Ox
// @match        https://www.g-mart.com/*
// @run-at       document-end
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/*
 * G-MART COMICS ENHANCER  (v2)
 * ----------------------------
 * G-Mart is a classic CGI-rendered store (store.cgi). No clean JSON API, but
 * the HTML is static table markup with consistent class names, so we enhance
 * it entirely in the DOM.
 *
 * PAGES HANDLED (both share the invoicebasic-* table structure):
 *   • "Your Subscriptions"  — rows carry <input name="x####">  (4 columns:
 *        Quantity | Subscription | Cover Price | Frequency)
 *   • "Your Pre-Orders"     — rows carry <input name="q####">  (5 columns:
 *        Quantity | Title | Unit Price | (save $) | Total Price)
 *   Both interleave single-cell PUBLISHER SECTION rows between item rows,
 *   and end with a SUBTOTAL row. We touch ONLY the item rows.
 *
 * FEATURES:
 *   1. RESKIN  — readable theme site-wide (typography, spacing, dark mode,
 *                sticky nav, rounded buttons). Toggle via the ⚙ panel.
 *   2. LISTS   — on both management pages:
 *        • search box (filter by title)
 *        • the NATIVE header row is made sortable (no duplicate header added)
 *        • "Group by type" toggle (subscriptions: monthly / miniseries / …;
 *          when ON, native publisher section rows are hidden; when OFF they
 *          are restored and original order is reinstated)
 *        • quick-remove button per row (sets qty 0 — the site's own documented
 *          way to drop an item; "Save Changes" still commits it)
 *        • live summary (visible count + cover-price total for subscriptions,
 *          native Total Price sum for pre-orders — the site's real numbers)
 *
 * We never alter the real <input> fields or the form, so "Save Changes"
 * behaves exactly as the site intends.
 *
 * NOTE on discounts: the Subscriptions page shows COVER PRICE only (the site
 * does not expose the discounted figure there), so the subscription summary is
 * labeled "cover price". The Pre-Orders page DOES carry real discounted unit/
 * total prices + savings, so there we sum the site's actual Total Price column.
 */

(function () {
  'use strict';

  // ----- settings -------------------------------------------------------
  const S = {
    get darkMode() { return GM_getValue('gm_dark', false); },
    set darkMode(v) { GM_setValue('gm_dark', v); },
    get reskin() { return GM_getValue('gm_reskin', true); },
    set reskin(v) { GM_setValue('gm_reskin', v); },
  };

  // ----- 1. THEME + UI CSS ---------------------------------------------
  const THEME_CSS = `
  html.gm-enh body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    line-height: 1.5 !important; color: #1a1a1a;
    background-color: #f4f5f7 !important; -webkit-font-smoothing: antialiased;
  }
  html.gm-enh body > table, html.gm-enh body > div, html.gm-enh body > form,
  html.gm-enh body > p { max-width: 1100px; margin-left: auto !important; margin-right: auto !important; }
  html.gm-enh .navtable-main { position: sticky; top: 0; z-index: 50; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.08); }
  html.gm-enh .actiontext, html.gm-enh .actiontext-small, html.gm-enh .actiontext-price,
  html.gm-enh .actiontext-discount { border-radius:6px !important; transition: background-color .12s ease; }
  html.gm-enh .actiontext:hover, html.gm-enh .actiontext-small:hover { background:#eef4ff !important; }
  html.gm-enh a { text-decoration:none; }
  html.gm-enh a:hover { text-decoration:underline; }
  html.gm-enh td { line-height:1.45; }

  /* DARK MODE */
  html.gm-dark body { background-color:#16181d !important; color:#e3e5e8; }
  html.gm-dark .navtable-main { background:#1e2127; box-shadow:0 2px 8px rgba(0,0,0,.5); }
  html.gm-dark td, html.gm-dark th { color:#e3e5e8; }
  /* Recolor ordinary links to readable light-blue — but NOT the site's own
     nav buttons/tabs, whose links are white text on a solid blue pill. Those
     keep white (recoloring them to light-blue produced unreadable blue-on-blue). */
  html.gm-dark a:not(.link-white):not(.navbutton-blue-brand a):not(.navbutton-red-logo a):not(.navbutton-tabunselected a):not(.navtab-rounded a):not(.navribbon-td a):not(.navribbon-td-black a):not(.navbutton-info a):not(.navcart-text):not(.navsub-text a):not(.navlink):not(.gm-rel-btn) { color:#6ea8ff !important; }
  /* site nav strip links painted on blue (navlink / navribbon) stay white */
  html.gm-dark a.navlink, html.gm-dark .navribbon-td a, html.gm-dark .navribbon-td-black a { color:#fff !important; }
  /* keep the site's blue/red nav pills with white text in dark mode */
  html.gm-dark .navbutton-blue-brand > a, html.gm-dark .navbutton-red-logo > a,
  html.gm-dark .navbutton-tabunselected > a, html.gm-dark .navtab-rounded > a,
  html.gm-dark .navribbon-td > a, html.gm-dark .navribbon-td-black > a,
  html.gm-dark .navbutton-info > a, html.gm-dark .navcart-text,
  html.gm-dark .navsub-text a, html.gm-dark .link-white { color:#fff !important; }
  html.gm-dark .actiontext, html.gm-dark .actiontext-small, html.gm-dark .actiontext-price,
  html.gm-dark .actiontext-discount { background:#262a31 !important; color:#6ea8ff !important; border-color:#3a3f47 !important; }
  html.gm-dark .actiontext:hover { background:#2f343d !important; }
  html.gm-dark input[type=text] { background:#262a31; color:#e3e5e8; border:1px solid #3a3f47; }
  html.gm-dark img { filter: brightness(.92); }

  /* dark-mode dropdown menus (Account / Customer Service / Social): the site
     paints these menu items white via the <li>, so light link text was
     unreadable. Darken the menu surface and force readable light links. */
  html.gm-dark .menu-dropdown ul,
  html.gm-dark .menu-dropdown li { background:#262a31 !important; color:#e3e5e8 !important; }
  html.gm-dark .menu-dropdown li a { color:#9ec5ff !important; }
  html.gm-dark .menu-dropdown li a:hover { color:#cfe0ff !important; }
  html.gm-dark .menu-dropdown li:hover { background:#30353d !important; }

  /* Dark-mode contrast is finished with a JS pass (gmFixContrast) that finds
     elements whose OWN background stays light and forces dark text on just
     those — far more reliable than guessing the site's legacy bgcolor markup.
     The release-date pill keeps white text (its own rule below). */
  html.gm-dark .gm-release-bar .gm-rel-btn,
  html.gm-dark .gm-release-bar .gm-rel-btn * { color:#fff !important; }
  /* a light surface tagged by the JS pass: force dark text on it AND on every
     descendant (except our own injected UI, which manages its own colors). */
  html.gm-dark .gm-fixdark,
  html.gm-dark .gm-fixdark *:not(.gm-chip):not(.gm-rel-btn):not(.gm-cat-count) { color:#111 !important; }
  /* High specificity so this beats the long :not() link rule above (whose many
     :not() pseudo-classes inflate its specificity). */
  html.gm-dark .gm-fixdark a,
  html.gm-dark .gm-fixdark a:link,
  html.gm-dark .gm-fixdark a:visited,
  html.gm-dark .gm-fixdark a:not(.x):not(.y):not(.z) { color:#0a3d8f !important; }

  /* TOOLBAR */
  .gm-subs-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:10px 0; padding:10px 12px;
    background:#fff; border:1px solid #dcdfe4; border-radius:10px; font-size:14px; }
  html.gm-dark .gm-subs-toolbar { background:#1e2127; border-color:#3a3f47; }
  .gm-subs-toolbar input[type=search] { flex:1 1 220px; min-width:160px; padding:7px 10px; border:1px solid #cbd0d6; border-radius:7px; font-size:14px; }
  html.gm-dark .gm-subs-toolbar input[type=search] { background:#262a31; color:#e3e5e8; border-color:#3a3f47; }
  .gm-subs-toolbar .gm-chip { padding:5px 10px; border:1px solid #cbd0d6; border-radius:999px; background:#f4f5f7; cursor:pointer; user-select:none; font-size:13px; }
  .gm-subs-toolbar .gm-chip.active { background:#005fb2; color:#fff; border-color:#005fb2; }
  html.gm-dark .gm-subs-toolbar .gm-chip { background:#262a31; color:#cfd3d8; border-color:#3a3f47; }
  html.gm-dark .gm-subs-toolbar .gm-chip.active { background:#2d6fd6; color:#fff; }
  .gm-subs-summary { font-weight:600; margin-left:auto; white-space:nowrap; }

  /* make the NATIVE header sortable-looking */
  tr.invoicebasic-tr-section th.gm-sortable { cursor:pointer; user-select:none; }
  tr.invoicebasic-tr-section th.gm-sortable .gm-arrow { opacity:.7; font-size:11px; margin-left:4px; }

  html.gm-enh table.gm-subs-enhanced tbody tr.gm-item:nth-of-type(even) { background:rgba(0,0,0,.03); }
  html.gm-dark table.gm-subs-enhanced tbody tr.gm-item:nth-of-type(even) { background:rgba(255,255,255,.04); }
  table.gm-subs-enhanced tbody tr.gm-item:hover { background:#eaf2ff; }
  html.gm-dark table.gm-subs-enhanced tbody tr.gm-item:hover { background:#243247; }

  .gm-group-header td { background:#005fb2 !important; color:#fff; font-weight:700; padding:6px 10px; font-size:13px; letter-spacing:.03em; }
  html.gm-dark .gm-group-header td { background:#2d6fd6 !important; }
  tr.gm-hidden { display:none !important; }

  /* quick-remove button */
  .gm-remove-btn { border:1px solid #d99; background:#fff5f5; color:#b00; border-radius:5px; cursor:pointer;
    font-size:12px; line-height:1; padding:3px 7px; margin-left:4px; }
  .gm-remove-btn:hover { background:#ffe9e9; }
  .gm-remove-btn.gm-undo { border-color:#9b9; background:#f3fff3; color:#070; }
  tr.gm-removed td { opacity:.5; text-decoration:line-through; }
  tr.gm-removed .gm-remove-btn { text-decoration:none; }

  /* settings gear */
  #gm-gear { position:fixed; top:10px; right:10px; z-index:9999; width:38px; height:38px; border-radius:50%;
    background:#005fb2; color:#fff; border:none; cursor:pointer; font-size:18px; box-shadow:0 2px 8px rgba(0,0,0,.3); }
  #gm-panel { position:fixed; top:54px; right:10px; z-index:9999; background:#fff; border:1px solid #dcdfe4; border-radius:12px;
    padding:12px 14px; width:220px; display:none; box-shadow:0 8px 24px rgba(0,0,0,.18); font-size:14px; }
  html.gm-dark #gm-panel { background:#1e2127; color:#e3e5e8; border-color:#3a3f47; }
  #gm-panel label { display:flex; align-items:center; gap:8px; margin:8px 0; cursor:pointer; }
  #gm-panel h4 { margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:.05em; opacity:.7; }

  /* ===== CATALOG ENHANCER (Current Issues / Back Issues / GNs / browse / search) ===== */
  .gm-cat-toolbar { position:sticky; top:0; z-index:60; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
    margin:0 0 10px; padding:10px 12px; background:#fff; border:1px solid #dcdfe4; border-radius:10px; font-size:14px; }
  html.gm-dark .gm-cat-toolbar { background:#1e2127; border-color:#3a3f47; }
  .gm-cat-toolbar input[type=search] { flex:1 1 240px; min-width:160px; padding:7px 10px; border:1px solid #cbd0d6; border-radius:7px; font-size:14px; }
  html.gm-dark .gm-cat-toolbar input[type=search] { background:#262a31; color:#e3e5e8; border-color:#3a3f47; }
  .gm-cat-toolbar .gm-chip { padding:5px 10px; border:1px solid #cbd0d6; border-radius:999px; background:#f4f5f7; cursor:pointer; user-select:none; font-size:13px; white-space:nowrap; }
  .gm-cat-toolbar .gm-chip.active { background:#005fb2; color:#fff; border-color:#005fb2; }
  html.gm-dark .gm-cat-toolbar .gm-chip { background:#262a31; color:#cfd3d8; border-color:#3a3f47; }
  html.gm-dark .gm-cat-toolbar .gm-chip.active { background:#2d6fd6; color:#fff; }
  .gm-cat-count { font-weight:600; margin-left:auto; white-space:nowrap; }

  /* price/stock legend */
  .gm-legend { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:0 0 10px; padding:8px 12px;
    background:#fbfbfd; border:1px solid #e3e5e8; border-radius:10px; font-size:12px; }
  html.gm-dark .gm-legend { background:#191c21; border-color:#2b2f36; color:#cfd3d8; }
  .gm-legend .gm-leg-item { display:inline-flex; align-items:center; gap:5px; }
  .gm-legend .gm-dot { width:12px; height:12px; border-radius:3px; display:inline-block; border:1px solid rgba(0,0,0,.25); }

  /* publisher jump-nav */
  .gm-pubnav { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; padding:8px 12px; background:#fff; border:1px solid #dcdfe4; border-radius:10px; max-height:92px; overflow:auto; }
  html.gm-dark .gm-pubnav { background:#1e2127; border-color:#3a3f47; }
  .gm-pubnav a { font-size:12px; padding:3px 8px; border-radius:6px; background:#eef0f3; color:#111 !important; text-decoration:none !important; white-space:nowrap; }
  .gm-pubnav a:hover { background:#dce3ec; }
  html.gm-dark .gm-pubnav a { background:#262a31; color:#cfd3d8 !important; }

  /* hidden rows (filter / hide-owned / deals-only) */
  li.gm-cat-hidden, .gm-pub-group.gm-cat-hidden { display:none !important; }

  /* density: compact mode shrinks catalog images + tightens spacing */
  html.gm-cat-compact ul.ul-none li img[src*="comic"],
  html.gm-cat-compact ul.ul-none li img[alt*="cover"i] { max-height:28px !important; width:auto !important; }
  html.gm-cat-compact ul.ul-none > li > ul > li { line-height:1.15; padding:1px 0; }
  html.gm-cat-compact ul.ul-none > li > ul > li br { display:none; }

  /* owned badge */
  .gm-owned-badge { display:inline-block; font-size:10px; font-weight:700; color:#fff; background:#2b8a3e;
    border-radius:4px; padding:1px 5px; margin-left:5px; vertical-align:middle; }

  /* ===== v6: TILED CATALOG LAYOUT ===== */
  /* publisher group becomes a block with a styled header + a tile grid */
  ul.gm-tiled > li.gm-pub-group { display:block; margin:0 0 22px; }
  /* styled publisher section header */
  ul.gm-tiled > li.gm-pub-group > .gm-pub-head {
    display:flex; align-items:center; gap:10px; margin:0 0 10px; padding:8px 14px;
    background:linear-gradient(90deg,#005fb2,#2d6fd6); color:#fff; border-radius:9px;
    font-size:15px; font-weight:700; letter-spacing:.02em; box-shadow:0 1px 4px rgba(0,0,0,.15);
  }
  html.gm-dark ul.gm-tiled > li.gm-pub-group > .gm-pub-head { background:linear-gradient(90deg,#1b4e86,#2d6fd6); }
  .gm-pub-head .gm-pub-count { margin-left:auto; font-size:12px; font-weight:600; opacity:.9;
    background:rgba(255,255,255,.22); padding:2px 9px; border-radius:999px; }
  .gm-pub-head .gm-pub-cat { font-size:11px; font-weight:500; opacity:.8; margin-left:4px; }
  /* the tile grid (the publisher's nested <ul>) */
  ul.gm-tiled .gm-tile-grid { list-style:none; margin:0; padding:0; display:grid;
    grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; align-items:start; }
  /* each comic tile */
  ul.gm-tiled li.gm-tile {
    display:flex; flex-direction:column; background:#fff; border:1px solid #dcdfe4;
    border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06);
    transition:box-shadow .12s ease, transform .05s ease;
  }
  ul.gm-tiled li.gm-tile:hover { box-shadow:0 4px 14px rgba(0,0,0,.14); transform:translateY(-1px); }
  html.gm-dark ul.gm-tiled li.gm-tile { background:#1e2127; border-color:#333842; box-shadow:0 1px 3px rgba(0,0,0,.4); }
  html.gm-dark ul.gm-tiled li.gm-tile:hover { box-shadow:0 6px 18px rgba(0,0,0,.55); }
  /* tile body: price row + title */
  .gm-tile-body { padding:10px 12px; display:flex; flex-direction:column; gap:7px; flex:1; }
  .gm-tile-price { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-family:'SF Mono',Consolas,monospace; }
  .gm-tile-title { font-size:13.5px; line-height:1.35; font-weight:600; color:#15181d; }
  html.gm-dark .gm-tile-title { color:#eef0f3; }
  .gm-tile-actions { display:flex; gap:8px; margin-top:2px; }
  /* ---- v6.2: title on top, [cart][status/price] on the row below it ---- */
  .gm-tile-body > .gm-tile-title { order:-1; }           /* lift title to top */
  .gm-tile-actionrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    font-family:'SF Mono',Consolas,monospace; }
  .gm-tile-actionrow .div-bubblesblock-space-compact { display:flex; align-items:center; gap:6px; margin:0; }
  .gm-tile-actionrow img[id*="comic_cart"] { cursor:pointer; flex:0 0 auto; }
  /* cart icon: the SVG is a dark glyph — make it white in dark mode (the
     blanket dark-mode img brightness(.92) rule only dimmed it) */
  html.gm-dark .gm-tile img[src*="Cart3"] { filter:brightness(0) invert(1) !important; }
  html:not(.gm-dark) .gm-tile img[src*="Cart3"] { filter:none; }
  /* ===== v6.3: HOME / LANDING PAGE cards ===== */
  /* enhanceHome() builds one real div.gm-home-grid per section and moves the
     featured .gm-home-card boxes into it, so we can use a plain CSS grid. */
  html.gm-home-enh .gm-home-grid { display:grid;
    grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; width:100%;
    margin:4px 0 8px; align-items:start; }
  html.gm-home-enh .gm-home-card { display:flex; gap:10px; align-items:flex-start;
    padding:10px 12px; border:1px solid #d4d8df; border-left-width:4px;
    border-left-color:#c3c8d0; border-radius:10px; background:#fff; }
  html.gm-dark .gm-home-card { background:#20242b; border-color:#363b43; border-left-color:#4a505a; }
  /* text column holds title, price/actions, blurb stacked */
  html.gm-home-enh .gm-home-text { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:5px; }
  html.gm-home-enh td.home-preorder-cell.gm-st-sale .gm-home-card { border-left-color:#d6409f; }
  /* cover: fixed-width left column, no float */
  html.gm-home-enh .gm-home-cover { flex:0 0 72px; float:none !important; margin:0 !important;
    display:block; align-self:flex-start; }
  html.gm-home-enh .gm-home-cover img { width:72px; height:auto; border-radius:4px; display:block;
    float:none !important; filter:none !important; }
  /* text column: title, price/actions, blurb stacked */
  html.gm-home-enh .gm-home-text > strong,
  html.gm-home-enh .gm-home-text > .text-size-medium:first-of-type { font-size:13.5px; line-height:1.3; }
  html.gm-dark .gm-home-text > strong { color:#eef0f3; }
  html.gm-home-enh .gm-home-blurb { font-size:11px; line-height:1.35; color:#55606e;
    max-height:52px; overflow:auto; }
  html.gm-dark .gm-home-blurb { color:#aab2bd; }
  /* discount / save badges pop */
  html.gm-home-enh .gm-home-badge { font-weight:700; }
  html.gm-home-enh .gm-home-badge .text-size-small,
  html.gm-home-enh strong.div-bubbleblock-sale-verycompact { color:#d6409f !important; }
  /* section banners */
  html.gm-home-enh .gm-home-section { background:linear-gradient(90deg,#1d4ed8,#2563eb); color:#fff;
    font-weight:700; font-size:14px; padding:8px 14px; border-radius:8px; margin:14px 0 10px; }
  html.gm-home-enh .gm-home-section a { color:#dbeafe !important; font-weight:500; }
  html.gm-dark .gm-home-section { background:linear-gradient(90deg,#152a63,#1b3a82); }
  /* tile footer: the solicitation blurb / big notes */
  .gm-tile-foot { border-top:1px dashed #d9dde3; padding:8px 12px; font-size:11.5px; line-height:1.4;
    color:#55606e; background:#f8f9fb; max-height:84px; overflow:auto; }
  html.gm-dark .gm-tile-foot { border-top-color:#333842; color:#aeb6c2; background:#191c21; }
  .gm-tile-foot:empty { display:none; }
  .gm-tile-note { color:#9a5b00; font-weight:600; display:block; margin-bottom:3px; }
  html.gm-dark .gm-tile-note { color:#ffcf8a; }
  /* keep the site's price-code colors readable in tiles (dark mode): the price
     tt stays light, sale red stays its red, title light */
  html.gm-dark .gm-tile .actiontext-price tt, html.gm-dark .gm-tile .actiontext-price a { color:#8fd0ff !important; }

  /* ===== v6.1: TILE STATUS ACCENT (left border by stock/sale code) ===== */
  /* high specificity (html + ul.gm-tiled + li + status class) so these beat
     the base tile border-color rule in both light and dark mode */
  html ul.gm-tiled li.gm-tile { border-left-width:4px; }
  html ul.gm-tiled li.gm-tile.gm-st-sale   { border-left-color:#d6409f !important; }  /* SALE  — magenta  */
  html ul.gm-tiled li.gm-tile.gm-st-green  { border-left-color:#2b8a3e !important; }  /* green — well stocked */
  html ul.gm-tiled li.gm-tile.gm-st-yellow { border-left-color:#e0a008 !important; }  /* yellow— medium   */
  html ul.gm-tiled li.gm-tile.gm-st-red    { border-left-color:#e03131 !important; }  /* red   — low stock */
  html ul.gm-tiled li.gm-tile.gm-st-none   { border-left-color:#c3c8d0 !important; }  /* none  — standard */
  html.gm-dark ul.gm-tiled li.gm-tile.gm-st-none { border-left-color:#3a3f47 !important; }

  /* ===== v6.1: DARKEN the site's pale cyan header strips in dark mode ===== */
  /* The "New Releases This Week" strip and the FAQ bar use legacy cyan
     bgcolor (#ccffff / #e0ffff / #7df9ff). In dark mode, repaint those to a
     dark surface with light text so they blend with the theme. Scoped to the
     known cyan values via attribute selectors + the fixdark tag override. */
  html.gm-dark [bgcolor="#CCFFFF" i], html.gm-dark [bgcolor="#E0FFFF" i],
  html.gm-dark [bgcolor="#7DF9FF" i], html.gm-dark [bgcolor="#CCFFCC" i] {
    background-color:#1e2127 !important;
  }
  html.gm-dark [bgcolor="#CCFFFF" i] *, html.gm-dark [bgcolor="#E0FFFF" i] *,
  html.gm-dark [bgcolor="#7DF9FF" i] *, html.gm-dark [bgcolor="#CCFFCC" i] * {
    color:#e3e5e8 !important;
  }
  html.gm-dark [bgcolor="#CCFFFF" i] a, html.gm-dark [bgcolor="#E0FFFF" i] a,
  html.gm-dark [bgcolor="#7DF9FF" i] a, html.gm-dark [bgcolor="#CCFFCC" i] a {
    color:#8fd0ff !important;
  }

  /* ===== v6: LOGO backing panel in dark mode ===== */
  html.gm-dark img.navlogo-image {
    background:#f4f5f7; border-radius:8px; padding:4px; filter:none !important;
    box-shadow:0 0 0 1px rgba(255,255,255,.12);
  }

  /* catalog sort dropdown */
  .gm-cat-toolbar select { padding:6px 8px; border:1px solid #cbd0d6; border-radius:7px; font-size:13px; background:#fff; cursor:pointer; }
  html.gm-dark .gm-cat-toolbar select { background:#262a31; color:#e3e5e8; border-color:#3a3f47; }

  /* release-date jump bar */
  .gm-release-bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 10px; padding:8px 12px;
    background:#fff; border:1px solid #dcdfe4; border-radius:10px; font-size:13px; }
  html.gm-dark .gm-release-bar { background:#1e2127; border-color:#3a3f47; color:#e3e5e8; }
  .gm-release-bar .gm-rel-btn { padding:4px 10px; border-radius:7px; background:#005fb2; color:#fff !important;
    text-decoration:none !important; font-size:13px; white-space:nowrap; }
  .gm-release-bar .gm-rel-btn:hover { background:#004a8c; }
  html.gm-dark .gm-release-bar .gm-rel-btn { background:#2d6fd6; }

  /* ===== SEARCH FORM styling ===== */
  .gm-search-styled { max-width:640px; }
  .gm-search-styled input[type=text] { width:100%; box-sizing:border-box; padding:10px 12px; font-size:15px;
    border:1px solid #cbd0d6; border-radius:9px; margin-bottom:10px; }
  html.gm-dark .gm-search-styled input[type=text] { background:#262a31; color:#e3e5e8; border-color:#3a3f47; }
  .gm-search-fieldset { border:1px solid #e3e5e8; border-radius:10px; padding:10px 12px; margin:8px 0; }
  html.gm-dark .gm-search-fieldset { border-color:#2b2f36; }
  .gm-search-fieldset legend { font-size:12px; text-transform:uppercase; letter-spacing:.05em; opacity:.7; padding:0 6px; }
  .gm-search-styled label { display:inline-flex; align-items:center; gap:5px; margin:3px 12px 3px 0; font-size:14px; cursor:pointer; }
  .gm-search-styled input[type=submit] { padding:9px 18px; border:none; border-radius:8px; background:#005fb2; color:#fff;
    font-size:14px; cursor:pointer; margin-right:8px; }
  .gm-search-styled input[type=submit]:hover { background:#004a8c; }
  `;

  GM_addStyle(THEME_CSS);

  function applyThemeFlags() {
    const h = document.documentElement;
    h.classList.toggle('gm-enh', !!S.reskin);
    h.classList.toggle('gm-dark', !!(S.reskin && S.darkMode));
    // keep the dark-mode contrast pass in sync with the toggle
    if (S.reskin && S.darkMode) {
      if (typeof gmFixContrast === 'function') gmFixContrast();
    } else {
      document.querySelectorAll('.gm-fixdark').forEach(e => {
        e.classList.remove('gm-fixdark');
        e.querySelectorAll('a[data-gm-prev-color]').forEach(a => {
          a.style.color = a.dataset.gmPrevColor || '';
          delete a.dataset.gmPrevColor;
        });
      });
    }
  }
  applyThemeFlags();

  // ----- settings panel -------------------------------------------------
  function buildGear() {
    if (document.getElementById('gm-gear')) return;
    const gear = document.createElement('button');
    gear.id = 'gm-gear'; gear.textContent = '⚙'; gear.title = 'G-Mart Enhancer settings';
    document.body.appendChild(gear);

    const panel = document.createElement('div');
    panel.id = 'gm-panel';
    panel.innerHTML = `
      <h4>G-Mart Enhancer</h4>
      <label><input type="checkbox" id="gm-opt-reskin"> Clean theme</label>
      <label><input type="checkbox" id="gm-opt-dark"> Dark mode</label>`;
    document.body.appendChild(panel);

    gear.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });
    const reskinBox = panel.querySelector('#gm-opt-reskin');
    const darkBox = panel.querySelector('#gm-opt-dark');
    reskinBox.checked = S.reskin; darkBox.checked = S.darkMode;
    reskinBox.addEventListener('change', e => { S.reskin = e.target.checked; applyThemeFlags(); });
    darkBox.addEventListener('change', e => { S.darkMode = e.target.checked; applyThemeFlags(); });
  }

  // ----- 2. LIST ENHANCER (subscriptions + pre-orders) ------------------
  // Detect which management page we're on by the input-name prefix.
  function detectList() {
    const xi = [...document.querySelectorAll('input[type=text][name^="x"]')].filter(i => /^x\d+$/.test(i.name));
    // priceIdx / typeIdx are 0-BASED cell indices within an item row.
    // Subs row:  [0]=qty input  [1]=title  [2]=cover price  [3]=frequency/type
    if (xi.length >= 3) return { kind: 'subs', inputs: xi, priceIdx: 2, typeIdx: 3, ncols: 4 };
    const qi = [...document.querySelectorAll('input[type=text][name^="q"]')].filter(i => /^q\d+$/.test(i.name));
    // Pre row:   [0]=qty input [1]=title [2]=unit price [3]=(save $) [4]=total price
    if (qi.length >= 3) return { kind: 'pre', inputs: qi, priceIdx: 4, typeIdx: null, ncols: 5 };
    return null;
  }

  function enhanceList() {
    const info = detectList();
    if (!info) return false;
    const table = info.inputs[0].closest('table');
    if (!table || table.dataset.gmEnhanced) return true;
    table.dataset.gmEnhanced = '1';
    table.classList.add('gm-subs-enhanced');

    const tbody = info.inputs[0].closest('tr').parentElement;
    const allTrs = [...tbody.children];

    // classify rows
    const itemRows = [];
    const sectionRows = [];
    allTrs.forEach((tr, idx) => {
      const input = tr.querySelector('input[name^="x"],input[name^="q"]');
      const isItem = input && /^[xq]\d+$/.test(input.name);
      const isSection = tr.classList.contains('invoicebasic-tr-section') ||
        [...tr.children].some(td => td.classList.contains('invoicebasic-td-section')) ||
        [...tr.children].some(td => td.classList.contains('invoicebasic-td-total'));
      tr.dataset.gmOrig = idx; // remember native order
      if (isItem) {
        tr.classList.add('gm-item');
        const tds = [...tr.children].filter(c => c.tagName === 'TD');
        const title = (tds[1]?.innerText || '').trim();
        const priceText = (tds[info.priceIdx]?.innerText || '').trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        const type = (info.typeIdx != null) ? ((tds[info.typeIdx]?.innerText || '').trim() || '—') : '';
        itemRows.push({ tr, input, title, price, type });
      } else if (!tr.querySelector('th') && [...tr.children].length === 1) {
        // single-cell publisher section row
        tr.classList.add('gm-section');
        sectionRows.push(tr);
      }
    });
    if (!itemRows.length) return false;

    // ---- make the NATIVE header row sortable (no duplicate header) ----
    const headRow = tbody.querySelector('tr.invoicebasic-tr-section');
    const headCells = headRow ? [...headRow.children] : [];
    // map: 0-based header-cell index -> sort key
    const colKey = { 0: 'qty', 1: 'title' };
    colKey[info.priceIdx] = 'price';
    if (info.typeIdx != null) colKey[info.typeIdx] = 'type';
    headCells.forEach((th, i) => {
      if (colKey[i]) {
        th.classList.add('gm-sortable');
        th.dataset.k = colKey[i];
        if (!th.querySelector('.gm-arrow')) {
          const s = document.createElement('span'); s.className = 'gm-arrow'; th.appendChild(s);
        }
      }
    });

    // ---- toolbar ----
    const toolbar = document.createElement('div');
    toolbar.className = 'gm-subs-toolbar';
    const groupBtn = (info.typeIdx != null)
      ? '<span class="gm-chip" id="gm-sub-group">Group by type</span>' : '';
    toolbar.innerHTML = `
      <input type="search" placeholder="Filter titles…" id="gm-sub-search">
      ${groupBtn}
      <span class="gm-subs-summary" id="gm-sub-summary"></span>`;
    const form = table.closest('form') || table;
    form.parentNode.insertBefore(toolbar, form);

    const search = toolbar.querySelector('#gm-sub-search');
    const groupChip = toolbar.querySelector('#gm-sub-group');
    const summary = toolbar.querySelector('#gm-sub-summary');

    let sortKey = null, sortDir = 1, grouped = false;

    function liveQty(r) { return r.input.value.trim() === '' ? 0 : (parseInt(r.input.value, 10) || 0); }

    function updateSummary() {
      const visible = itemRows.filter(r => !r.tr.classList.contains('gm-hidden'));
      const kept = visible.filter(r => !r.tr.classList.contains('gm-removed'));
      const total = kept.reduce((s, r) => s + r.price * (liveQty(r) || 1), 0);
      const label = info.kind === 'pre' ? 'total' : 'cover price';
      summary.textContent = `${kept.length} shown · $${total.toFixed(2)} ${label}`;
    }

    function clearGroupHeaders() { tbody.querySelectorAll('tr.gm-group-header').forEach(e => e.remove()); }

    function restoreNativeOrder() {
      clearGroupHeaders();
      // show section rows again
      sectionRows.forEach(tr => tr.classList.remove('gm-hidden'));
      // re-sort every tracked row back to native order
      const ordered = [...tbody.children].sort((a, b) =>
        (+a.dataset.gmOrig || 0) - (+b.dataset.gmOrig || 0));
      ordered.forEach(tr => tbody.appendChild(tr));
    }

    function anchorRow() {
      // first row AFTER the native header, to insert reordered items before
      return headRow ? headRow.nextSibling : tbody.firstChild;
    }

    function render() {
      const q = search.value.trim().toLowerCase();
      itemRows.forEach(r => r.tr.classList.toggle('gm-hidden', q && !r.title.toLowerCase().includes(q)));
      const visible = itemRows.filter(r => !r.tr.classList.contains('gm-hidden'));

      if (sortKey) {
        visible.sort((a, b) => {
          let va, vb;
          if (sortKey === 'price') { va = a.price; vb = b.price; }
          else if (sortKey === 'type') { va = a.type.toLowerCase(); vb = b.type.toLowerCase(); }
          else if (sortKey === 'qty') { va = liveQty(a); vb = liveQty(b); }
          else { va = a.title.toLowerCase(); vb = b.title.toLowerCase(); }
          return va < vb ? -1 * sortDir : va > vb ? 1 * sortDir : 0;
        });
      }

      clearGroupHeaders();

      if (grouped && info.typeIdx != null) {
        // hide native publisher section rows while grouping by type
        sectionRows.forEach(tr => tr.classList.add('gm-hidden'));
        const groups = {};
        visible.forEach(r => { const k = r.type || '—'; (groups[k] = groups[k] || []).push(r); });
        let prev = headRow || null;
        const insert = (node) => {
          if (prev) tbody.insertBefore(node, prev.nextSibling); else tbody.insertBefore(node, tbody.firstChild);
          prev = node;
        };
        Object.keys(groups).sort().forEach(type => {
          const gh = document.createElement('tr');
          gh.className = 'gm-group-header';
          gh.innerHTML = `<td colspan="${info.ncols}">${type} (${groups[type].length})</td>`;
          insert(gh);
          groups[type].forEach(r => insert(r.tr));
        });
      } else {
        // flat / sorted view: keep section rows visible only when NOT sorting
        if (sortKey) {
          sectionRows.forEach(tr => tr.classList.add('gm-hidden'));
          let prev = headRow || null;
          visible.forEach(r => {
            if (prev) tbody.insertBefore(r.tr, prev.nextSibling); else tbody.insertBefore(r.tr, tbody.firstChild);
            prev = r.tr;
          });
        } else {
          restoreNativeOrder();
          // re-apply current filter after restore
          itemRows.forEach(r => r.tr.classList.toggle('gm-hidden', q && !r.title.toLowerCase().includes(q)));
        }
      }

      headCells.forEach(th => {
        const a = th.querySelector('.gm-arrow');
        if (a) a.textContent = th.dataset.k === sortKey ? (sortDir > 0 ? '▲' : '▼') : '';
      });
      updateSummary();
    }

    // sort handlers on native header
    headCells.forEach(th => {
      if (!th.dataset.k) return;
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
        // sorting a column flattens the list — turn grouping off so the sort
        // applies across all items (otherwise sort fights the grouping and
        // appears to do nothing).
        if (grouped) {
          grouped = false;
          if (groupChip) groupChip.classList.remove('active');
        }
        render();
      });
    });
    search.addEventListener('input', render);
    if (groupChip) groupChip.addEventListener('click', () => {
      grouped = !grouped;
      groupChip.classList.toggle('active', grouped);
      if (!grouped && !sortKey) restoreNativeOrder();
      render();
    });

    // ---- quick-remove buttons (set qty 0; the site's documented removal) ----
    itemRows.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'gm-remove-btn';
      btn.type = 'button';
      btn.textContent = 'Remove';
      btn.title = 'Set quantity to 0 (removes on Save Changes)';
      let prevVal = r.input.value;
      btn.addEventListener('click', () => {
        if (!r.tr.classList.contains('gm-removed')) {
          prevVal = r.input.value || '1';
          r.input.value = '0';
          r.tr.classList.add('gm-removed');
          btn.textContent = 'Undo'; btn.classList.add('gm-undo');
        } else {
          r.input.value = prevVal || '1';
          r.tr.classList.remove('gm-removed');
          btn.textContent = 'Remove'; btn.classList.remove('gm-undo');
        }
        updateSummary();
      });
      // place the button in the qty cell, after the input
      r.input.parentElement.appendChild(btn);
    });

    render();
    return true;
  }

  // ----- series-name helpers -------------------------------------------
  // Reduce a catalog/subscription title to a comparable "series" key:
  // drop the leading ▶, price codes, issue number, "(Cover ...)", vol, etc.
  function seriesKey(raw) {
    let s = (raw || '').replace(/^[\s▶►*]+/, '');
    s = s.replace(/\*+\$?\s*[\d.]+(\s*save\s*\d+%)?/gi, ''); // strip leading price code
    s = s.split('▶').pop();                                 // after marker if still present
    s = s.replace(/\(.*?\)/g, '');                           // drop (Cover A - ...), (SC), (series 6)
    s = s.replace(/\b(?:#?\d+|no\.?\s*\d+|vol\.?\s*\d+)\b.*$/i, ''); // drop issue/vol number and trailing
    s = s.replace(/[:#].*$/, '');                            // drop subtitle after : or #
    return s.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // When on the subscriptions page, remember the user's series names so the
  // catalog "hide owned" filter can use them on other pages. Persisted via GM.
  function captureOwnedTitles(didList) {
    const info = detectList();
    if (!info || info.kind !== 'subs') return;
    const names = info.inputs.map(inp => {
      const tds = [...inp.closest('tr').children].filter(c => c.tagName === 'TD');
      return seriesKey(tds[1]?.innerText || '');
    }).filter(Boolean);
    if (names.length) GM_setValue('gm_owned', JSON.stringify([...new Set(names)]));
  }

  function getOwnedSet() {
    try { return new Set(JSON.parse(GM_getValue('gm_owned', '[]'))); }
    catch (e) { return new Set(); }
  }

  // ----- CATALOG ENHANCER ----------------------------------------------
  function enhanceCatalog() {
    // Catalog pages have a <ul class="ul-none"> whose children include
    // publisher-group <li>s, each wrapping a nested <ul> of comic <li> items
    // with quick-add cart handlers. The publisher label is a <strong> that is
    // EITHER wrapped in span.text-size-large (Current Issues / browse / search)
    // OR a bare direct-child <strong> (Graphic Novels). Match both.
    const PUB_STRONG = ':scope > span.text-size-large > strong, :scope > strong';
    const uls = [...document.querySelectorAll('ul.ul-none')];
    const topUl = uls.find(ul => [...ul.children].some(li =>
        li.tagName === 'LI' && li.querySelector(PUB_STRONG) && li.querySelector(':scope > ul'))
      && /quick_add|quick_remove/.test(ul.innerHTML));
    if (!topUl || topUl.dataset.gmCat) return false;
    topUl.dataset.gmCat = '1';

    // collect publisher groups + their items
    const groups = [];
    [...topUl.children].forEach(li => {
      const strong = li.querySelector(PUB_STRONG);
      if (!strong) return;
      const nestedUl = li.querySelector(':scope > ul');
      if (!nestedUl) return;
      li.classList.add('gm-pub-group');
      const pub = strong.innerText.trim();
      const safeId = 'gm-pub-' + pub.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      li.id = safeId;
      const items = [...nestedUl.children].filter(x => x.tagName === 'LI').map(it => {
        // The TITLE lives in a dedicated span starting with ▶ (class
        // "onclick-cursor"), containing ONLY the title — NOT the price code
        // and NOT the long solicitation blurb that is also inside the <li>.
        // Using it.innerText would pull in the entire description paragraph
        // and break series matching, so we target the title span directly.
        let titleSpan = it.querySelector('span.onclick-cursor');
        if (!titleSpan) titleSpan = [...it.querySelectorAll('span')]
          .find(s => s.textContent.trim().startsWith('▶') && s.children.length <= 1);
        const titlePart = (titleSpan ? titleSpan.textContent : it.innerText)
          .replace(/^[\s▶►]+/, '').replace(/\s+/g, ' ').trim();
        // deals: the price code / sale badge live elsewhere in the <li>
        const priceEl = it.querySelector('.actiontext-price');
        const priceTxt = (priceEl ? priceEl.textContent : '');
        const onSale = !!it.querySelector('img[src*="button_sale"], img[alt="SALE"]');
        const hasDeal = /save\s*\d+%/i.test(it.innerText) || onSale;
        it.classList.add('gm-cat-item');
        const price = parseFloat((priceTxt.match(/\$\s*([\d.]+)/) || [])[1]) || 0;
        return { li: it, title: titlePart.trim(), series: seriesKey(titlePart), hasDeal, price };
      });
      groups.push({ wrapper: li, pub, safeId, items, nestedUl });
    });
    if (!groups.length) return false;

    const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

    // remember each item's native position so "default" sort can restore it
    groups.forEach(g => g.items.forEach((it, i) => { it.nativeIdx = i; }));

    // ---- release-date jump sources (from the native date links) ----
    // The page has links like "October 14, 2026" (this week, &d=...) /
    // "October 7, 2026" (last week) / "Recent New Release Dates".
    const dateLinks = [...document.querySelectorAll('a')].filter(a =>
      /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(a.textContent.trim()) && /[?&]d=\d+/.test(a.href));
    const recentLink = [...document.querySelectorAll('a')].find(a => /Recent New Release Dates/i.test(a.textContent));

    // ---- legend (decoded from the site's FAQ: stock/price color codes) ----
    const legend = document.createElement('div');
    legend.className = 'gm-legend';
    legend.innerHTML =
      '<strong>Price/stock:</strong>' +
      '<span class="gm-leg-item"><span class="gm-dot" style="background:#2b8a3e"></span>green = well stocked, best price</span>' +
      '<span class="gm-leg-item"><span class="gm-dot" style="background:#f2c200"></span>yellow = medium stock</span>' +
      '<span class="gm-leg-item"><span class="gm-dot" style="background:#e03131"></span>red = low stock (last copies priced higher)</span>' +
      '<span class="gm-leg-item"><span class="gm-dot" style="background:#fff"></span>none = standard</span>' +
      '<span class="gm-leg-item">★ SALE = discounted</span>' +
      '<span class="gm-leg-item">* / ** = price tier (more * = higher)</span>';

    // ---- publisher jump-nav ----
    const pubnav = document.createElement('div');
    pubnav.className = 'gm-pubnav';
    groups.forEach(g => {
      const a = document.createElement('a');
      a.href = '#' + g.safeId;
      a.textContent = `${g.pub} (${g.items.length})`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(g.safeId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      pubnav.appendChild(a);
    });

    // ---- toolbar ----
    const toolbar = document.createElement('div');
    toolbar.className = 'gm-cat-toolbar';
    toolbar.innerHTML =
      '<input type="search" id="gm-cat-search" placeholder="Filter titles on this page…">' +
      '<select id="gm-cat-sort" title="Sort within each publisher">' +
        '<option value="default">Sort: default</option>' +
        '<option value="title">Title A→Z</option>' +
        '<option value="price-asc">Price ↑</option>' +
        '<option value="price-desc">Price ↓</option>' +
      '</select>' +
      '<span class="gm-chip" id="gm-cat-deals">Deals only</span>' +
      '<span class="gm-chip" id="gm-cat-hideowned">Hide titles I get</span>' +
      '<span class="gm-chip" id="gm-cat-density">Compact</span>' +
      '<span class="gm-cat-count" id="gm-cat-count"></span>';

    // release-date jump row (only if the native date links exist)
    let releaseBar = null;
    if (dateLinks.length || recentLink) {
      releaseBar = document.createElement('div');
      releaseBar.className = 'gm-release-bar';
      let html = '<strong>New releases:</strong>';
      if (dateLinks[0]) html += `<a class="gm-rel-btn" href="${dateLinks[0].href}">This week (${dateLinks[0].textContent.trim()})</a>`;
      if (dateLinks[1]) html += `<a class="gm-rel-btn" href="${dateLinks[1].href}">Last week (${dateLinks[1].textContent.trim()})</a>`;
      if (recentLink) html += `<a class="gm-rel-btn gm-rel-recent" href="${recentLink.href}">Recent dates ▾</a>`;
      releaseBar.innerHTML = html;
    }

    // insert toolbar + legend + pubnav above the catalog
    topUl.parentNode.insertBefore(toolbar, topUl);
    if (releaseBar) topUl.parentNode.insertBefore(releaseBar, topUl);
    topUl.parentNode.insertBefore(legend, topUl);
    topUl.parentNode.insertBefore(pubnav, topUl);

    const search = toolbar.querySelector('#gm-cat-search');
    const dealsChip = toolbar.querySelector('#gm-cat-deals');
    const ownedChip = toolbar.querySelector('#gm-cat-hideowned');
    const densityChip = toolbar.querySelector('#gm-cat-density');
    const countEl = toolbar.querySelector('#gm-cat-count');
    const sortSel = toolbar.querySelector('#gm-cat-sort');

    const owned = getOwnedSet();
    // badge owned items up front
    if (owned.size) {
      groups.forEach(g => g.items.forEach(it => {
        if (owned.has(it.series)) {
          const b = document.createElement('span'); b.className = 'gm-owned-badge'; b.textContent = 'SUBSCRIBED';
          it.li.querySelector('span')?.appendChild(b);
          it.owned = true;
        }
      }));
    }
    // if we have no owned list yet, disable that chip with a hint
    if (!owned.size) { ownedChip.style.opacity = '.5'; ownedChip.title = 'Visit "Your Subscriptions" once so the script can learn your titles'; }

    // ---- restore remembered catalog toggles (persisted via GM) ----
    // Stored under one JSON key so one read/write covers all of them.
    let catPrefs = {};
    try { catPrefs = JSON.parse(GM_getValue('gm_cat_prefs', '{}')) || {}; } catch (e) { catPrefs = {}; }
    function saveCatPrefs() {
      GM_setValue('gm_cat_prefs', JSON.stringify({
        deals: dealsOnly, hideOwned: hideOwned,
        compact: document.documentElement.classList.contains('gm-cat-compact'),
        sort: sortSel.value
      }));
    }

    let dealsOnly = !!catPrefs.deals;
    // only restore hideOwned if we actually have an owned list to act on
    let hideOwned = !!catPrefs.hideOwned && owned.size > 0;

    // reflect restored state in the controls up front
    dealsChip.classList.toggle('active', dealsOnly);
    ownedChip.classList.toggle('active', hideOwned);
    if (catPrefs.sort && [...sortSel.options].some(o => o.value === catPrefs.sort)) {
      sortSel.value = catPrefs.sort;
    }
    if (catPrefs.compact) {
      document.documentElement.classList.add('gm-cat-compact');
      densityChip.classList.add('active');
    }

    function apply() {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      const sortMode = sortSel.value;
      groups.forEach(g => {
        let groupShown = 0;
        g.items.forEach(it => {
          let hide = false;
          if (q && !it.title.toLowerCase().includes(q)) hide = true;
          if (dealsOnly && !it.hasDeal) hide = true;
          if (hideOwned && it.owned) hide = true;
          it.li.classList.toggle('gm-cat-hidden', hide);
          if (!hide) { groupShown++; shown++; }
        });
        // ---- within-publisher sort: reorder this group's item <li>s ----
        const ordered = g.items.slice().sort((a, b) => {
          if (sortMode === 'title') return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0;
          if (sortMode === 'price-asc') return a.price - b.price;
          if (sortMode === 'price-desc') return b.price - a.price;
          return a.nativeIdx - b.nativeIdx; // default
        });
        ordered.forEach(it => g.nestedUl.appendChild(it.li));
        // hide the whole publisher group (and its jump-nav entry) if empty
        g.wrapper.classList.toggle('gm-cat-hidden', groupShown === 0);
      });
      countEl.textContent = `${shown} of ${totalItems} shown`;
    }

    search.addEventListener('input', apply);
    sortSel.addEventListener('change', () => { apply(); saveCatPrefs(); });
    dealsChip.addEventListener('click', () => { dealsOnly = !dealsOnly; dealsChip.classList.toggle('active', dealsOnly); apply(); saveCatPrefs(); });
    ownedChip.addEventListener('click', () => { if (!owned.size) return; hideOwned = !hideOwned; ownedChip.classList.toggle('active', hideOwned); apply(); saveCatPrefs(); });
    densityChip.addEventListener('click', () => {
      const on = document.documentElement.classList.toggle('gm-cat-compact');
      densityChip.classList.toggle('active', on);
      saveCatPrefs();
    });

    // ---- v6: convert the list into a tiled layout ----
    // Non-destructive: we add classes and wrap the per-item blurb/note into a
    // footer, but never move the price/title/cart nodes (so cart onclick stays
    // intact). The <ul>/<li> structure is reused — just restyled via classes.
    tileifyCatalog(topUl, groups);

    apply();
    return true;
  }

  // Transform the catalog DOM into tiles. Idempotent per element.
  function tileifyCatalog(topUl, groups) {
    topUl.classList.add('gm-tiled');
    groups.forEach(g => {
      // 1. build a styled publisher header (once) from the existing label
      if (!g.wrapper.querySelector(':scope > .gm-pub-head')) {
        // label is either span.text-size-large (Current Issues) or a bare
        // direct-child <strong> (Graphic Novels)
        const label = g.wrapper.querySelector(':scope > span.text-size-large')
          || g.wrapper.querySelector(':scope > strong');
        // the site puts a trailing text node like " (Comic Books)" right after
        // the label — capture it as a sublabel, then remove it so it doesn't
        // float between the header and the grid.
        let category = '';
        if (label) {
          let n = label.nextSibling;
          while (n && n.nodeType === 3 && !n.textContent.trim()) n = n.nextSibling;
          if (n && n.nodeType === 3 && /\(.*\)/.test(n.textContent)) {
            category = n.textContent.replace(/\s+/g, ' ').trim();
            n.textContent = '';
          }
        }
        const head = document.createElement('div');
        head.className = 'gm-pub-head';
        head.innerHTML = `<span class="gm-pub-name">${g.pub}</span>` +
          (category ? `<span class="gm-pub-cat">${category}</span>` : '') +
          `<span class="gm-pub-count">${g.items.length}</span>`;
        // hide the original inline label text node + span, insert header on top
        if (label) label.style.display = 'none';
        g.wrapper.insertBefore(head, g.wrapper.firstChild);
      }
      // 2. the nested <ul> becomes the tile grid
      if (g.nestedUl) g.nestedUl.classList.add('gm-tile-grid');
      // 3. each item becomes a tile; move its blurb/note into a footer
      g.items.forEach(it => {
        const li = it.li;
        if (li.dataset.gmTiled) return;
        li.dataset.gmTiled = '1';
        li.classList.add('gm-tile');
        // status accent from the site's stock/price code gif
        let status = 'none';
        if (li.querySelector('img[src*="button_sale"]')) status = 'sale';
        else if (li.querySelector('img[src*="button_green"]')) status = 'green';
        else if (li.querySelector('img[src*="button_yellow"]')) status = 'yellow';
        else if (li.querySelector('img[src*="button_red"]')) status = 'red';
        li.classList.add('gm-st-' + status);
        // the item's single inner span holds everything → it's the tile body
        const inner = li.querySelector(':scope > span') || li;
        inner.classList.add('gm-tile-body');
        // ---- v6.2: reorder — title on top, then a [cart][status/price] row ----
        // Tag the title (▶ span) so CSS can lift it to the top of the tile.
        const titleEl = inner.querySelector('span.onclick-cursor');
        if (titleEl) titleEl.classList.add('gm-tile-title');
        // Build an action row holding the cart icon(s) + the price block, so
        // the status dot/price sit right beside the cart. We MOVE the existing
        // nodes (keeps the cart onclick handlers intact).
        if (!inner.querySelector(':scope > .gm-tile-actionrow')) {
          const row = document.createElement('div');
          row.className = 'gm-tile-actionrow';
          const carts = [...inner.querySelectorAll(':scope > img[id*="comic_cart"]')];
          const priceBlock = inner.querySelector(':scope > .div-bubblesblock-space-compact');
          const saleBadge = inner.querySelector(':scope > .div-bubbleblock-sale-verycompact');
          // place the row right after the title in DOM order
          if (titleEl && titleEl.nextSibling) inner.insertBefore(row, titleEl.nextSibling);
          else inner.appendChild(row);
          carts.forEach(c => row.appendChild(c));        // cart icon(s) first
          if (priceBlock) row.appendChild(priceBlock);   // then status dot + price
          if (saleBadge) row.appendChild(saleBadge);     // then the save % badge
        }
        // footer = the hidden solicitation blurb (.display-none) + any cyan note
        const foot = document.createElement('div');
        foot.className = 'gm-tile-foot';
        // a highlighted "big note" row (cyan) if present
        const note = li.querySelector('[class*="background-highlight-"]');
        if (note) {
          const n = document.createElement('div');
          n.className = 'gm-tile-note';
          n.textContent = note.textContent.replace(/\s+/g, ' ').trim();
          foot.appendChild(n);
          note.style.display = 'none';
        }
        // the solicitation description, normally display:none
        const blurb = li.querySelector('span.display-none, .display-none');
        if (blurb && blurb.textContent.trim()) {
          const b = document.createElement('div');
          b.textContent = blurb.textContent.replace(/\s+/g, ' ').trim();
          foot.appendChild(b);
        }
        if (foot.childNodes.length) li.appendChild(foot);
      });
    });
  }

  // ----- SEARCH FORM styler --------------------------------------------
  // The Search page has a text input (name="text"), section checkboxes
  // (name="section"), and depth radios (name="depth"). We only add classes
  // and wrap the checkbox/radio groups in labelled fieldsets — the form's
  // action, field names, and values are left untouched so search still works.
  function styleSearchForm() {
    const textInput = document.querySelector('input[type=text][name="text"]');
    const sections = [...document.querySelectorAll('input[type=checkbox][name="section"]')];
    const depths = [...document.querySelectorAll('input[type=radio][name="depth"]')];
    if (!textInput || (!sections.length && !depths.length)) return false;
    const form = textInput.closest('form');
    if (!form || form.dataset.gmSearch) return false;
    form.dataset.gmSearch = '1';
    form.classList.add('gm-search-styled');
    // wrap each control in its own label so the text next to it is clickable;
    // we don't know the exact label text nodes, so just add the class — the
    // native text sits adjacent and the CSS spacing improves it.
    return true;
  }

  // ----- dark-mode contrast pass --------------------------------------
  // The site paints assorted strips with legacy light backgrounds (pale cyan,
  // yellow, lime) via bgcolor="" and inline styles that carry NO class, so CSS
  // can't reliably target them. Instead, measure each element's OWN background:
  // if it's light while dark mode is on, tag it `.gm-fixdark` so the CSS above
  // restores dark text on just that element. We only tag elements that set their
  // own background (not inherited), so we never darken text sitting on the dark
  // page body or on our own dark components.
  function gmFixContrast() {
    if (!(S.reskin && S.darkMode)) return;
    const lum = (r, g, b) => {
      const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    // scope to the main content; skip our own injected UI AND the catalog grid
    // (catalog items/tiles have their own dark styling — tagging them fixdark
    // because they contain a small cyan note-row would wrongly darken the whole
    // tile incl. the price). The catalog's own cyan note gets handled by the
    // tile-footer styling instead.
    const skip = el => el.closest('.gm-cat-toolbar,.gm-release-bar,.gm-legend,.gm-pubnav,#gm-panel,#gm-gear,.gm-subs-toolbar,table.gm-subs-enhanced,ul.ul-none,.gm-pub-group,.gm-cat-item,.gm-tile');
    document.querySelectorAll('td,th,tr,table,div,span,li,p,font').forEach(el => {
      if (skip(el)) return;
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/\d+(\.\d+)?/g);
      if (!m || m.length < 3) return;
      const a = m.length >= 4 ? parseFloat(m[3]) : 1;
      if (a < 0.5) return;                       // transparent — not its own bg
      const [r, g, b] = m.map(Number);
      if (lum(r, g, b) > 0.6) {
        el.classList.add('gm-fixdark');                        // light surface
        // Inline-style any links inside — inline wins over the high-specificity
        // global dark-mode link rule (which otherwise keeps them light-blue on
        // this pale strip). Record the original so we can undo on toggle-off.
        el.querySelectorAll('a').forEach(a => {
          if (a.dataset.gmPrevColor === undefined) a.dataset.gmPrevColor = a.style.color || '';
          a.style.setProperty('color', '#0a3d8f', 'important');
        });
      }
    });
  }

  // ===== v6.3: HOME / LANDING PAGE enhancer ============================
  // The home page is a <td>-table of featured items (td.home-preorder-cell),
  // grouped under div.home-section banners ("New Comic Releases", "Pre-Orders
  // for ...", "Featured Back Issue Comics"). Unlike the catalog it HAS real
  // cover images (image.cgi, 75x115, class home-preorder-image-*). We card-ify
  // each cell (cover left, text right), lay the cells out in a responsive grid,
  // emphasize discount badges, and restyle the section + promo banners.
  // Non-destructive: we only add classes + a flex text-wrapper; we never move
  // the price/SUBSCRIBE/BACK-ISSUES anchors, so their hrefs stay intact.
  function enhanceHome() {
    const cells = [...document.querySelectorAll('td.home-preorder-cell')];
    if (!cells.length) return false;
    const root = document.querySelector('.gm-home') ? null : document.body;
    document.documentElement.classList.add('gm-home-enh');

    cells.forEach(td => {
      const box = td.querySelector(':scope > [class*="home-preorder-cell-minwidth"]') || td;
      if (box.dataset.gmHome) return;
      box.dataset.gmHome = '1';
      box.classList.add('gm-home-card');
      // the cover image (if any) — move it to be the FIRST child so flex can
      // place it on the left; keep its anchor wrapper intact.
      const coverImg = box.querySelector('img[class*="home-preorder-image"]');
      const coverAnchor = coverImg ? coverImg.closest('a') : null;
      if (coverAnchor) {
        coverAnchor.classList.add('gm-home-cover');
        box.insertBefore(coverAnchor, box.firstChild);
      }
      // wrap EVERYTHING that isn't the cover into a single text column, so the
      // card is a clean 2-col flex (cover | text) with no multi-row spanning
      // (the previous grid-row span approach ballooned card height).
      const textCol = document.createElement('div');
      textCol.className = 'gm-home-text';
      [...box.childNodes].forEach(n => {
        if (n === coverAnchor) return;
        textCol.appendChild(n);
      });
      box.appendChild(textCol);
      // wrap the trailing solicitation blurb (a bare text node) so it becomes
      // a real grid item in the text column instead of an anonymous box.
      [...box.childNodes].forEach(n => {
        if (n.nodeType === 3 && n.textContent.trim().length > 2) {
          const w = document.createElement('div');
          w.className = 'gm-home-blurb';
          w.textContent = n.textContent.replace(/\s+/g, ' ').trim();
          box.replaceChild(w, n);
        }
      });
      // discount / sale badges pop
      box.querySelectorAll('.div-bubbleblock-sale-verycompact, [class*="homebutton-sale"], .actiontext-discount').forEach(b => b.classList.add('gm-home-badge'));
      // status accent from the SALE gif (home uses button_sale.gif inline)
      if (box.querySelector('img[src*="button_sale"]') || /save\s*\d+%|%\s*off/i.test(box.textContent)) {
        td.classList.add('gm-st-sale');
      }
    });

    // section banners + promo strip
    document.querySelectorAll('div.home-section').forEach(s => s.classList.add('gm-home-section'));
    // Build a REAL grid per section and MOVE the featured cells into it. The
    // native layout is dozens of tiny <table.home-preorder-table> (1-2 cells
    // each) inside a wrapper — too fragile for display:contents. Instead we
    // create one div.gm-home-grid in each wrapper and relocate every cell's
    // card box into it as a direct grid child (hrefs are preserved — moving a
    // node keeps its handlers/attributes). Then we hide the emptied tables.
    const wrappers = new Set();
    document.querySelectorAll('table.home-preorder-table').forEach(t => {
      if (t.parentElement) wrappers.add(t.parentElement);
    });
    wrappers.forEach(wrap => {
      if (wrap.querySelector(':scope > .gm-home-grid')) return; // idempotent
      const grid = document.createElement('div');
      grid.className = 'gm-home-grid';
      // collect this wrapper's cells in document order
      const cells = [...wrap.querySelectorAll(':scope > table.home-preorder-table td.home-preorder-cell')];
      if (!cells.length) return;
      // insert the grid where the first table is, then move cards in
      const firstTable = wrap.querySelector(':scope > table.home-preorder-table');
      wrap.insertBefore(grid, firstTable);
      cells.forEach(td => {
        const card = td.querySelector(':scope > .gm-home-card') || td;
        grid.appendChild(card);          // relocate the card box itself
      });
      // hide the now-empty native tables
      wrap.querySelectorAll(':scope > table.home-preorder-table').forEach(t => { t.style.display = 'none'; });
    });
    return true;
  }

  // ----- boot -----------------------------------------------------------
  function boot() { buildGear(); const didList = enhanceList(); captureOwnedTitles(didList); enhanceCatalog(); enhanceHome(); styleSearchForm(); gmFixContrast(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
