// ==UserScript==
// @name         G-Mart Comics Enhancer
// @namespace    https://www.g-mart.com/
// @version      1.0.0
// @description  Reskin G-Mart Comics with a cleaner, readable theme + a sortable/filterable, grouped view of your subscription list. Pure DOM/CSS — no API needed.
// @author       Ox
// @match        https://www.g-mart.com/*
// @run-at       document-end
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/*
 * G-MART COMICS ENHANCER
 * ----------------------
 * G-Mart is a classic CGI-rendered store (store.cgi). There is no clean JSON
 * API, but the HTML is static table markup with consistent class names, so we
 * enhance it entirely in the DOM.
 *
 * TWO LAYERS:
 *   1. RESKIN  — a readable theme injected site-wide (typography, spacing,
 *                dark mode, nicer buttons, sticky top nav). Toggleable.
 *   2. SUBS    — on the "Your Subscriptions" management page, we detect the
 *                subscription table (rows with <input name="x####">) and add:
 *                  • a search box (filter by title)
 *                  • sortable columns (title / price / type)
 *                  • a summary bar (count + total $)
 *                  • zebra striping + hover highlight
 *                  • optional grouping by subscription type
 *                All without touching the real <input> fields, so "Save
 *                Changes" still works exactly as before.
 *
 * SETTINGS persist via GM_setValue. A small ⚙ panel (top-right) toggles:
 *   - Dark mode on/off
 *   - Reskin on/off
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

  // ----- 1. RESKIN THEME ------------------------------------------------
  // Scoped under <html class="gm-enh"> / <html class="gm-dark"> so toggles
  // are instant without re-injecting styles.
  const THEME_CSS = `
  html.gm-enh body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    line-height: 1.5 !important;
    color: #1a1a1a;
    background-color: #f4f5f7 !important;
    -webkit-font-smoothing: antialiased;
  }
  /* Give the main content a centered, carded column */
  html.gm-enh body > table,
  html.gm-enh body > div,
  html.gm-enh body > form {
    max-width: 1100px;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  /* Sticky top nav so the account / cart bar stays reachable */
  html.gm-enh .navtable-main {
    position: sticky; top: 0; z-index: 50;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
  }
  /* Rounded, modern buttons for the site's action text pills */
  html.gm-enh .actiontext,
  html.gm-enh .actiontext-small,
  html.gm-enh .actiontext-price,
  html.gm-enh .actiontext-discount {
    border-radius: 6px !important;
    transition: background-color .12s ease, transform .05s ease;
  }
  html.gm-enh .actiontext:hover,
  html.gm-enh .actiontext-small:hover { background:#eef4ff !important; }
  /* Links a touch calmer than default pure blue */
  html.gm-enh a { text-decoration: none; }
  html.gm-enh a:hover { text-decoration: underline; }
  /* Readability on the dense release/subscription tables */
  html.gm-enh td { line-height: 1.45; }

  /* ---- DARK MODE ---- */
  html.gm-dark body {
    background-color: #16181d !important;
    color: #e3e5e8;
  }
  html.gm-dark .navtable-main { background:#1e2127; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
  html.gm-dark td, html.gm-dark th { color:#e3e5e8; }
  html.gm-dark a { color:#6ea8ff !important; }
  html.gm-dark .actiontext,
  html.gm-dark .actiontext-small,
  html.gm-dark .actiontext-price,
  html.gm-dark .actiontext-discount {
    background:#262a31 !important; color:#6ea8ff !important; border-color:#3a3f47 !important;
  }
  html.gm-dark .actiontext:hover { background:#2f343d !important; }
  html.gm-dark input[type=text] { background:#262a31; color:#e3e5e8; border:1px solid #3a3f47; }
  /* keep comic cover images from being inverted; just dim slightly */
  html.gm-dark img { filter: brightness(.92); }

  /* ---- SUBSCRIPTION ENHANCER UI ---- */
  .gm-subs-toolbar {
    display:flex; flex-wrap:wrap; gap:8px; align-items:center;
    margin:10px 0; padding:10px 12px;
    background:#fff; border:1px solid #dcdfe4; border-radius:10px;
    font-size:14px;
  }
  html.gm-dark .gm-subs-toolbar { background:#1e2127; border-color:#3a3f47; }
  .gm-subs-toolbar input[type=search] {
    flex:1 1 220px; min-width:160px;
    padding:7px 10px; border:1px solid #cbd0d6; border-radius:7px; font-size:14px;
  }
  html.gm-dark .gm-subs-toolbar input[type=search]{ background:#262a31; color:#e3e5e8; border-color:#3a3f47; }
  .gm-subs-toolbar .gm-chip {
    padding:5px 10px; border:1px solid #cbd0d6; border-radius:999px;
    background:#f4f5f7; cursor:pointer; user-select:none; font-size:13px;
  }
  .gm-subs-toolbar .gm-chip.active { background:#005fb2; color:#fff; border-color:#005fb2; }
  html.gm-dark .gm-subs-toolbar .gm-chip { background:#262a31; color:#cfd3d8; border-color:#3a3f47; }
  html.gm-dark .gm-subs-toolbar .gm-chip.active { background:#2d6fd6; color:#fff; }
  .gm-subs-summary { font-weight:600; margin-left:auto; white-space:nowrap; }

  /* Make the subscription table pleasant */
  table.gm-subs-enhanced { width:100%; border-collapse:collapse; }
  table.gm-subs-enhanced th {
    text-align:left; cursor:pointer; user-select:none;
    padding:8px 10px; border-bottom:2px solid #d0d4da; position:sticky; top:96px;
    background:#eef0f3; font-size:13px; letter-spacing:.02em;
  }
  html.gm-dark table.gm-subs-enhanced th { background:#262a31; border-color:#3a3f47; }
  table.gm-subs-enhanced th .gm-arrow { opacity:.5; font-size:11px; margin-left:4px; }
  table.gm-subs-enhanced tbody tr:nth-child(even) { background:rgba(0,0,0,.03); }
  html.gm-dark table.gm-subs-enhanced tbody tr:nth-child(even) { background:rgba(255,255,255,.04); }
  table.gm-subs-enhanced tbody tr:hover { background:#eaf2ff; }
  html.gm-dark table.gm-subs-enhanced tbody tr:hover { background:#243247; }
  table.gm-subs-enhanced td { padding:7px 10px; border-bottom:1px solid #e6e8eb; }
  html.gm-dark table.gm-subs-enhanced td { border-color:#2b2f36; }
  .gm-group-header td {
    background:#005fb2 !important; color:#fff; font-weight:700;
    padding:6px 10px; font-size:13px; letter-spacing:.03em;
  }
  html.gm-dark .gm-group-header td { background:#2d6fd6 !important; }
  tr.gm-hidden { display:none; }

  /* settings gear */
  #gm-gear {
    position:fixed; top:10px; right:10px; z-index:9999;
    width:38px; height:38px; border-radius:50%;
    background:#005fb2; color:#fff; border:none; cursor:pointer;
    font-size:18px; box-shadow:0 2px 8px rgba(0,0,0,.3);
  }
  #gm-panel {
    position:fixed; top:54px; right:10px; z-index:9999;
    background:#fff; border:1px solid #dcdfe4; border-radius:12px;
    padding:12px 14px; width:220px; display:none;
    box-shadow:0 8px 24px rgba(0,0,0,.18); font-size:14px;
  }
  html.gm-dark #gm-panel { background:#1e2127; color:#e3e5e8; border-color:#3a3f47; }
  #gm-panel label { display:flex; align-items:center; gap:8px; margin:8px 0; cursor:pointer; }
  #gm-panel h4 { margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:.05em; opacity:.7; }
  `;

  GM_addStyle(THEME_CSS);

  function applyThemeFlags() {
    const h = document.documentElement;
    h.classList.toggle('gm-enh', !!S.reskin);
    h.classList.toggle('gm-dark', !!(S.reskin && S.darkMode));
  }
  applyThemeFlags();

  // ----- settings panel -------------------------------------------------
  function buildGear() {
    const gear = document.createElement('button');
    gear.id = 'gm-gear';
    gear.textContent = '⚙';
    gear.title = 'G-Mart Enhancer settings';
    document.body.appendChild(gear);

    const panel = document.createElement('div');
    panel.id = 'gm-panel';
    panel.innerHTML = `
      <h4>G-Mart Enhancer</h4>
      <label><input type="checkbox" id="gm-opt-reskin"> Clean theme</label>
      <label><input type="checkbox" id="gm-opt-dark"> Dark mode</label>
    `;
    document.body.appendChild(panel);

    gear.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });

    const reskinBox = panel.querySelector('#gm-opt-reskin');
    const darkBox = panel.querySelector('#gm-opt-dark');
    reskinBox.checked = S.reskin;
    darkBox.checked = S.darkMode;

    reskinBox.addEventListener('change', e => { S.reskin = e.target.checked; applyThemeFlags(); });
    darkBox.addEventListener('change', e => { S.darkMode = e.target.checked; applyThemeFlags(); });
  }

  // ----- 2. SUBSCRIPTION ENHANCER --------------------------------------
  // Detect the subscription management table: a <table> containing <input>
  // elements whose name matches /^x\d+$/ (the per-title quantity fields).
  function findSubsTable() {
    const qtyInputs = [...document.querySelectorAll('input[name^="x"]')]
      .filter(i => /^x\d+$/.test(i.name) && i.type === 'text');
    if (qtyInputs.length < 3) return null;           // not the subs page
    const table = qtyInputs[0].closest('table');
    return table ? { table, qtyInputs } : null;
  }

  function parseRow(tr) {
    const tds = [...tr.children].filter(c => c.tagName === 'TD');
    // Expected layout: [qty input][title][price][type]
    const input = tr.querySelector('input[name^="x"]');
    if (!input || !/^x\d+$/.test(input.name) || tds.length < 2) return null;
    const title = (tds[1]?.innerText || '').trim();
    const priceText = (tds[2]?.innerText || '').trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    const type = (tds[3]?.innerText || '').trim() || '—';
    return { tr, input, title, price, priceText, type };
  }

  function enhanceSubs() {
    const found = findSubsTable();
    if (!found) return false;
    const { table } = found;
    if (table.dataset.gmEnhanced) return true;
    table.dataset.gmEnhanced = '1';
    table.classList.add('gm-subs-enhanced');

    // collect ONLY the subscription rows (rows carrying an x#### qty input).
    // The table's tbody also holds non-subscription rows (totals, the
    // Save/Cancel button row, section separators) — we must NOT reorder those.
    const bodyRows = [...table.querySelectorAll('tr')]
      .map(parseRow).filter(Boolean);
    if (!bodyRows.length) return false;

    // The subscription rows live inside a <tbody>, and are NOT direct children
    // of <table>. Use the row's actual parent (tbody) as the insertion anchor,
    // and keep the first sub row as the positional anchor so our header + the
    // reordered block stay exactly where the subscription list already is.
    const subParent = bodyRows[0].tr.parentElement; // the <tbody>
    const firstSubRow = bodyRows[0].tr;

    // ---- header row (sortable) ----
    const headTr = document.createElement('tr');
    headTr.className = 'gm-subs-head';
    headTr.innerHTML = `
      <th data-k="qty">Qty</th>
      <th data-k="title">Title<span class="gm-arrow"></span></th>
      <th data-k="price">Price<span class="gm-arrow"></span></th>
      <th data-k="type">Type<span class="gm-arrow"></span></th>`;
    subParent.insertBefore(headTr, firstSubRow);

    // ---- toolbar (search + group + summary) injected above the table ----
    const toolbar = document.createElement('div');
    toolbar.className = 'gm-subs-toolbar';
    toolbar.innerHTML = `
      <input type="search" placeholder="Filter titles…" id="gm-sub-search">
      <span class="gm-chip" id="gm-sub-group">Group by type</span>
      <span class="gm-subs-summary" id="gm-sub-summary"></span>`;
    table.parentNode.insertBefore(toolbar, table);

    const search = toolbar.querySelector('#gm-sub-search');
    const groupChip = toolbar.querySelector('#gm-sub-group');
    const summary = toolbar.querySelector('#gm-sub-summary');

    let sortKey = null, sortDir = 1, grouped = false;

    function updateSummary(visible) {
      const n = visible.length;
      const total = visible.reduce((s, r) => s + r.price, 0);
      summary.textContent = `${n} shown · $${total.toFixed(2)}/mo`;
    }

    function clearGroupHeaders() {
      table.querySelectorAll('tr.gm-group-header').forEach(e => e.remove());
    }

    function render() {
      const q = search.value.trim().toLowerCase();
      let rows = bodyRows.slice();

      // filter
      rows.forEach(r => r.tr.classList.toggle('gm-hidden',
        q && !r.title.toLowerCase().includes(q)));
      const visible = rows.filter(r => !r.tr.classList.contains('gm-hidden'));

      // sort
      if (sortKey) {
        visible.sort((a, b) => {
          let va, vb;
          if (sortKey === 'price') { va = a.price; vb = b.price; }
          else if (sortKey === 'type') { va = a.type.toLowerCase(); vb = b.type.toLowerCase(); }
          else if (sortKey === 'qty') { va = +a.input.value || 0; vb = +b.input.value || 0; }
          else { va = a.title.toLowerCase(); vb = b.title.toLowerCase(); }
          return va < vb ? -1 * sortDir : va > vb ? 1 * sortDir : 0;
        });
      }

      // Re-insert the subscription block in order, right after our header row,
      // WITHOUT moving any other rows in the tbody (totals, Save button, etc.).
      // We keep the real <input> elements intact so "Save Changes" still works.
      clearGroupHeaders();
      let prev = headTr;
      if (grouped) {
        const groups = {};
        visible.forEach(r => { (groups[r.type] = groups[r.type] || []).push(r); });
        Object.keys(groups).sort().forEach(type => {
          const gh = document.createElement('tr');
          gh.className = 'gm-group-header';
          gh.innerHTML = `<td colspan="4">${type} (${groups[type].length})</td>`;
          subParent.insertBefore(gh, prev.nextSibling); prev = gh;
          groups[type].forEach(r => { subParent.insertBefore(r.tr, prev.nextSibling); prev = r.tr; });
        });
      } else {
        visible.forEach(r => { subParent.insertBefore(r.tr, prev.nextSibling); prev = r.tr; });
      }

      // sort arrows
      headTr.querySelectorAll('th').forEach(th => {
        const a = th.querySelector('.gm-arrow');
        if (a) a.textContent = th.dataset.k === sortKey ? (sortDir > 0 ? '▲' : '▼') : '';
      });

      updateSummary(visible);
    }

    headTr.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
        render();
      });
    });
    search.addEventListener('input', render);
    groupChip.addEventListener('click', () => {
      grouped = !grouped;
      groupChip.classList.toggle('active', grouped);
      render();
    });

    render();
    return true;
  }

  // ----- boot -----------------------------------------------------------
  function boot() {
    buildGear();
    enhanceSubs();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
