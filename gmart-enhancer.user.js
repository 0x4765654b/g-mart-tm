// ==UserScript==
// @name         G-Mart Comics Enhancer
// @namespace    https://www.g-mart.com/
// @version      2.0.0
// @description  Reskin G-Mart Comics with a cleaner, readable theme + sortable/filterable subscription & pre-order management (group by type, quick-remove, live totals). Pure DOM/CSS — no API needed.
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
  html.gm-dark a { color:#6ea8ff !important; }
  html.gm-dark .actiontext, html.gm-dark .actiontext-small, html.gm-dark .actiontext-price,
  html.gm-dark .actiontext-discount { background:#262a31 !important; color:#6ea8ff !important; border-color:#3a3f47 !important; }
  html.gm-dark .actiontext:hover { background:#2f343d !important; }
  html.gm-dark input[type=text] { background:#262a31; color:#e3e5e8; border:1px solid #3a3f47; }
  html.gm-dark img { filter: brightness(.92); }

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

  // ----- boot -----------------------------------------------------------
  function boot() { buildGear(); enhanceList(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
