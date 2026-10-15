const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const fs = require('fs');
fs.mkdirSync(__dirname + '/shots', { recursive: true });
const { execFileSync } = require('child_process');
function keychain() {
  try {
    const meta = execFileSync('security', ['find-generic-password', '-s', 'gmart-enhancer-test'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const acct = (meta.match(/"acct"<blob>="([^"]*)"/) || [])[1];
    const pw = execFileSync('security', ['find-generic-password', '-s', 'gmart-enhancer-test', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return acct && pw ? { acct, pw } : null;
  } catch { return null; }
}

const SCRIPT = fs.readFileSync(__dirname + '/../gmart-enhancer.user.js', 'utf8');
const B = 'https://www.g-mart.com/scripts/comicnet.cgi?a1=store.cgi&function=6&store=1001&a2=0%3A&a3=';
let PAGES = {
  home: 'https://www.g-mart.com/',
  current: 'https://www.g-mart.com/scripts/comicnet.cgi?a1=store.cgi&a2=9%3A7%3A1%3A22%3A25&a3=9%3A7%3A1%3A22%3A25&function=6&store=1001',
  newweek: 'https://www.g-mart.com/scripts/comicnet.cgi?a1=store.cgi&a2=10%3A8%3A1%3A23%3A812&a3=10%3A8%3A1%3A23%3A813&d=2461328&function=6&store=1001',
  marvel: B + '10%3A8%3A1%3A23%3A110&key_group=1',
  gn: B + '9%3A7%3A1%3A22%3A55',
  backissues: B + '9%3A7%3A1%3A22%3A30',
  search: B + '11%3A9%3A1%3A24%3A1000',
  clearance: B + '9%3A7%3A1%3A22%3A45',
  backinstock: B + '9%3A7%3A1%3A22%3A46',
  sale60: B + '9%3A7%3A1%3A22%3A50',
  subshub: B + '9%3A7%3A1%3A22%3A20',
  faq: 'https://www.g-mart.com/faq.html',
};
const only = process.argv.slice(2);
function shim(store) {
  return `(() => { const __s = ${JSON.stringify(store)}; window.__gmStore = __s;
    window.GM_getValue = (k, d) => (k in __s ? __s[k] : d);
    window.GM_setValue = (k, v) => { __s[k] = v; };
    window.GM_addStyle = (css) => { const st = document.createElement('style'); st.textContent = css; (document.head||document.documentElement).appendChild(st); return st; };
  })();`;
}
const AUDIT = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const L = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  const bad = []; let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName) && [...el.childNodes].some(t => t.nodeType === 3 && t.textContent.trim().length > 1)) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue; n++;
      const a = L(fg), b = L(bg); const cr = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if (cr < 3) bad.push({ cr: +cr.toFixed(2), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,3).join('.') : ''), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), fg: cs.color, y: Math.round(r.top + scrollY) });
    }
  }
  const groups = {}; bad.forEach(x => { const k = x.tag + '|' + x.fg; (groups[k] = groups[k] || { ...x, count: 0 }).count++; });
  return { checked: n, low: bad.length, worst: Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 10) };
};
const STATE = () => ({
  title: document.title.slice(0, 70),
  loggedIn: !/\bGuest\b/.test(document.body.innerText.slice(0, 800)),
  htmlClasses: document.documentElement.className,
  overflowX: document.documentElement.scrollWidth - innerWidth,
  pageH: document.documentElement.scrollHeight,
  gear: !!document.getElementById('gm-gear'),
  catToolbar: !!document.querySelector('.gm-cat-toolbar'),
  pubGroups: document.querySelectorAll('.gm-pub-group').length,
  tiles: document.querySelectorAll('[class*="gm-tile"]').length,
  jumpNav: document.querySelectorAll('.gm-jump a, [class*="gm-pubnav"] a, [class*="gm-jump"] a').length,
  releaseBar: !!document.querySelector('[class*="gm-release"]'),
  legend: !!document.querySelector('[class*="gm-legend"]'),
  homeCells: document.querySelectorAll('.gm-home-cell').length,
  homeGridCols: (() => { const w = document.querySelector('div.mobile-display-none'); return w ? getComputedStyle(w).gridTemplateColumns : null; })(),
  biFilter: !!document.querySelector('.gm-bi-filter'), biLinks: document.querySelectorAll('.gm-bi-pub').length,
  searchStyled: !!document.querySelector('.gm-search-styled'),
  acctName: !!document.querySelector('.gm-acct-name'),
  fixdark: document.querySelectorAll('.gm-fixdark').length,
  brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).length,
});
(async () => {
  const LOGIN = !!process.env.LOGIN;
  let b, ctx, p;
  if (LOGIN) {
    ctx = await chromium.launchPersistentContext(__dirname + '/.profile', { headless: false, executablePath: (process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), args: ['--disable-blink-features=AutomationControlled'], viewport: { width: 1400, height: 900 } });
    b = ctx; p = ctx.pages()[0] || await ctx.newPage();
    await p.goto('https://www.g-mart.com/scripts/comicnet.cgi?a1=comicnet.cgi&a2=0%3A&a3=17%3A7%3A1%3A22%3A106%3A1%3A21%3A5&function=6&store=1001', { timeout: 60000 });
    await p.waitForFunction(() => !document.title.includes('Just a moment'), null, { timeout: 90000 }).catch(() => {});
    const kc = keychain();
    if (kc) { await p.waitForSelector('input[name="number"]', { timeout: 90000 }).catch(() => {}); await p.fill('input[name="number"]', kc.acct).catch(() => {}); await p.fill('input[name="password"]', kc.pw).catch(() => {}); await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.click('input[name="go"]').catch(() => {})]); await p.waitForTimeout(2500); }
    console.error(kc ? 'KEYCHAIN LOGIN ATTEMPTED' : 'WAITING FOR MANUAL LOGIN');
    const end = Date.now() + 10 * 60 * 1000; let ok = false;
    while (Date.now() < end && !ok) { await p.waitForTimeout(3000); try { const t = await p.evaluate(() => document.body.innerText.slice(0, 1500)); ok = /#\d{3,}/.test(t) && !/\bGuest\b/.test(t); } catch {} }
    if (!ok) { console.error('LOGIN TIMEOUT'); await ctx.close(); return; }
    console.error('LOGGED IN');
    await p.waitForTimeout(2000);
    // discover account pages from the hub + header menus
    await p.goto(PAGES.subshub, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    const found = await p.evaluate(() => { const want = { yoursubs: /^Your Subscriptions/i, yourpre: /^Your Pre-?Orders/i, custinfo: /Customer Information/i, balance: /Account Balance/i, ready: /Items Ready/i, shipments: /Your Shipments/i, contact: /Contact Us/i, wants: /Want List/i }; const o = {}; for (const a of document.querySelectorAll('a')) { const t = (a.textContent || '').trim(); for (const [k, re] of Object.entries(want)) if (!o[k] && re.test(t) && /^http/.test(a.href)) o[k] = a.href; } const cart = [...document.querySelectorAll('a')].find(a => a.querySelector('img[src*="cart"], svg') && /comicnet/.test(a.href) && !/quick/.test(a.href)); if (cart) o.cart = cart.href; return o; });
    const icons = await p.evaluate(() => [...document.querySelectorAll('a, [onclick]')].map(a => { const r = a.getBoundingClientRect(); return { href: a.href || '', onclick: (a.getAttribute('onclick') || '').slice(0, 120), title: a.title || '', html: a.innerHTML.slice(0, 120), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; }).filter(o => o.y < 80 && o.x > 250 && o.x < 650 && o.w > 0));
    console.error('ICONS', JSON.stringify(icons, null, 1));
    const hrefs = icons.filter(o => /^http/.test(o.href)).sort((a, b) => a.x - b.x);
    if (hrefs[0]) found.cart = hrefs[0].href;
    if (hrefs[1]) found.wants = hrefs[1].href;
    console.error('FOUND', JSON.stringify(found));
    Object.assign(PAGES, found);
    for (const k of ['yoursubs', 'yourpre']) if (PAGES[k]) { const v = PAGES[k]; const rest = { ...PAGES }; delete rest[k]; for (const kk of Object.keys(PAGES)) delete PAGES[kk]; Object.assign(PAGES, { [k]: v }, rest); }
    if (PAGES.yoursubs && PAGES.yourpre) { const { yoursubs, yourpre, ...rest } = PAGES; for (const kk of Object.keys(PAGES)) delete PAGES[kk]; Object.assign(PAGES, { yoursubs, yourpre }, rest); }
  } else {
    b = await chromium.launch({ headless: false, executablePath: (process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), args: ['--disable-blink-features=AutomationControlled'] });
    ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
    p = await ctx.newPage();
  }
  let errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const out = {}; let persist = {};
  for (const [name, url] of Object.entries(PAGES)) {
    if (only.length && !only.includes(name)) continue;
    out[name] = {};
    for (const dark of [false, true]) {
      const mode = dark ? 'dark' : 'light';
      errs = [];
      try {
        await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await p.waitForFunction(() => !document.title.includes('Just a moment'), null, { timeout: 40000 });
        await p.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
        await p.addScriptTag({ content: shim({ ...persist, gm_dark: dark, gm_reskin: true }) });
        await p.addScriptTag({ content: 'try {' + SCRIPT + '\n} catch (e) { window.__gmErr = e.stack || String(e); }' });
        await p.waitForTimeout(1500);
        const r = await p.evaluate(STATE);
        r.injectErr = await p.evaluate(() => window.__gmErr || null);
        if (dark) r.contrast = await p.evaluate(AUDIT);
        // interactive checks (light pass only)
        if (!dark && r.catToolbar) {
          r.interact = await p.evaluate(async () => {
            const cnt = () => (document.getElementById('gm-cat-count') || {}).textContent;
            const vis = () => [...document.querySelectorAll('.gm-pub-group li')].filter(li => li.offsetParent && !li.querySelector('li')).length;
            const o = { initial: cnt(), visible0: vis() };
            const s = document.getElementById('gm-cat-search'); s.value = 'batman'; s.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 400)); o.filterBatman = cnt(); o.visBatman = vis();
            s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
            document.getElementById('gm-cat-deals').click(); await new Promise(r => setTimeout(r, 400)); o.deals = cnt(); o.visDeals = vis();
            document.getElementById('gm-cat-deals').click(); await new Promise(r => setTimeout(r, 300));
            const sel = document.getElementById('gm-cat-sort'); sel.value = 'price-asc'; sel.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 400));
            const firstGroup = document.querySelector('.gm-pub-group');
            o.firstGroupPrices = firstGroup ? [...firstGroup.querySelectorAll('.actiontext-price')].slice(0, 6).map(e => e.textContent.trim().slice(0, 12)) : null;
            sel.value = 'default'; sel.dispatchEvent(new Event('change', { bubbles: true }));
            o.subscribedBadges = document.querySelectorAll('[class*="gm-owned"], [class*="gm-subscribed"]').length;
            const ho = document.getElementById('gm-cat-hideowned'); ho.click(); await new Promise(r => setTimeout(r, 400)); o.hideOwned = cnt(); ho.click();
            return o;
          });
        }
        if (!dark && (await p.$('#gm-sub-search'))) {
          r.listInteract = await p.evaluate(async () => {
            const w = () => new Promise(r => setTimeout(r, 400));
            const sum = () => document.getElementById('gm-sub-summary').textContent;
            const rows = () => [...document.querySelectorAll('input[type=text]')].filter(i => /^[xq]\d+$/.test(i.name)).map(i => i.closest('tr')).filter(tr => tr.offsetParent);
            const titles = () => rows().slice(0, 5).map(tr => (tr.children[1]?.innerText || '').trim().slice(0, 30));
            const o = { summary0: sum(), rows0: rows().length, sortable: document.querySelectorAll('.gm-sortable').length, removeBtns: document.querySelectorAll('[class*="gm-remove"], [class*="gm-rm"]').length };
            const s = document.getElementById('gm-sub-search'); s.value = 'batman'; s.dispatchEvent(new Event('input', { bubbles: true })); await w(); o.summaryBatman = sum(); o.rowsBatman = rows().length;
            s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); await w();
            const th = document.querySelector('.gm-sortable[data-k="title"]'); if (th) { th.click(); await w(); o.titleSortAsc = titles(); th.click(); await w(); o.titleSortDesc = titles(); }
            const tp = document.querySelector('.gm-sortable[data-k="price"]'); if (tp) { tp.click(); await w(); o.priceSort = rows().slice(0, 6).map(tr => (tr.children[location.href.includes('N0220120') ? 4 : 2]?.innerText || '').trim()); tp.click(); await w(); o.priceSortDesc = rows().slice(0, 3).map(tr => (tr.children[location.href.includes('N0220120') ? 4 : 2]?.innerText || '').trim()); }
            o.sortKeys = [...document.querySelectorAll('.gm-sortable')].map(t => t.dataset.k + ':' + t.textContent.trim().slice(0, 20));
            const g = document.getElementById('gm-sub-group'); if (g) { g.click(); await w(); o.groupHeaders = document.querySelectorAll('tr.gm-group-header').length; g.click(); await w(); o.groupHeadersOff = document.querySelectorAll('tr.gm-group-header').length; }
            o.inputsUnchanged = [...document.querySelectorAll('input[type=text]')].filter(i => /^[xq]\d+$/.test(i.name)).every(i => i.value === i.defaultValue);
            return o;
          });
        }
        if (!dark && r.biFilter) {
          r.interact = await p.evaluate(async () => { const f = document.querySelector('.gm-bi-filter'); f.value = 'vertigo'; f.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); const n = [...document.querySelectorAll('.gm-bi-pub')].filter(a => a.style.display !== 'none').length; f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); return { vertigo: n }; });
        }
        if (!dark) {
          r.gearToggle = await p.evaluate(async () => { const g = document.getElementById('gm-gear'); if (!g) return null; g.click(); const shown = getComputedStyle(document.getElementById('gm-panel')).display; const d = document.getElementById('gm-opt-dark'); d.click(); const on = document.documentElement.classList.contains('gm-dark'); d.click(); const off = !document.documentElement.classList.contains('gm-dark'); g.click(); return { panel: shown, darkOn: on, darkOff: off }; });
        }
        try { const st = await p.evaluate(() => window.__gmStore || {}); delete st.gm_dark; delete st.gm_reskin; Object.assign(persist, st); r.storeKeys = Object.keys(persist); } catch {}
        r.errors = errs.slice(0, 5);
        await p.evaluate(() => scrollTo(0, 0));
        await p.screenshot({ path: `${__dirname}/shots/${name}-${mode}.png` });
        if (r.pageH > 1300) { await p.evaluate(() => scrollTo(0, 900)); await p.waitForTimeout(300); await p.screenshot({ path: `${__dirname}/shots/${name}-${mode}-2.png` }); }
        out[name][mode] = r;
      } catch (e) { out[name][mode] = { fatal: e.message.slice(0, 200), errors: errs }; }
      console.error('done', name, mode);
    }
  }
  fs.writeFileSync(__dirname + '/results' + (only.length ? '-' + only.join('_') : '') + '.json', JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
