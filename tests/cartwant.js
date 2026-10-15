// One-shot: add one item to cart + want list, test enhancer on both pages, then remove both.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const fs = require('fs'), { execFileSync } = require('child_process');
fs.mkdirSync(__dirname + '/shots', { recursive: true });
const SCRIPT = fs.readFileSync(__dirname + '/../gmart-enhancer.user.js', 'utf8');
const SVC = 'gmart-enhancer-test';
const LOGIN_URL = 'https://www.g-mart.com/scripts/comicnet.cgi?a1=comicnet.cgi&a2=0%3A&a3=17%3A7%3A1%3A22%3A106%3A1%3A21%3A5&function=6&store=1001';
const log = (...a) => console.log(...a);
function keychain() {
  try {
    const meta = execFileSync('security', ['find-generic-password', '-s', SVC], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const acct = (meta.match(/"acct"<blob>="([^"]*)"/) || [])[1];
    const pw = execFileSync('security', ['find-generic-password', '-s', SVC, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return acct && pw ? { acct, pw } : null;
  } catch { return null; }
}
const AUDIT = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const L = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE'].includes(el.tagName) || ![...el.childNodes].some(t => t.nodeType === 3 && t.textContent.trim().length > 1)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (r.width < 2 || cs.visibility === 'hidden') continue;
    const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
    const a = L(fg), b = L(bg), cr = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (cr < 3) bad.push(cr.toFixed(2) + ' ' + el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + el.textContent.trim().slice(0, 30) + '"');
  }
  return bad.slice(0, 12);
};
(async () => {
  const ctx = await chromium.launchPersistentContext(__dirname + '/.profile', { headless: false, executablePath: (process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), args: ['--disable-blink-features=AutomationControlled'], viewport: { width: 1400, height: 900 } });
  const p = ctx.pages()[0] || await ctx.newPage();
  p.setDefaultNavigationTimeout(120000);
  const _goto = p.goto.bind(p); p.goto = (u, o) => _goto(u, { waitUntil: 'domcontentloaded', timeout: 120000, ...(o || {}) });
  const net = []; p.on('request', r => { if (/comicnet|store\.cgi/.test(r.url()) && r.resourceType() !== 'document') net.push(r.method() + ' ' + r.url().slice(0, 160)); });
  const isIn = async () => { try { const t = await p.evaluate(() => document.body.innerText.slice(0, 1500)); return /#\d{3,}/.test(t) && !/\bGuest\b/.test(t); } catch { return false; } };
  const settle = async () => { await p.waitForLoadState('domcontentloaded').catch(() => {}); await p.waitForFunction(() => !document.title.includes('Just a moment'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500); };
  // --- login ---
  await p.goto(LOGIN_URL, { timeout: 60000 }); await settle();
  const kc = keychain();
  if (kc) { await p.waitForSelector('input[name="number"]', { timeout: 90000 }).catch(() => {}); await p.fill('input[name="number"]', kc.acct); await p.fill('input[name="password"]', kc.pw); await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.click('input[name="go"]')]); await settle(); log('keychain login:', (await isIn()) ? 'OK' : 'FAILED'); }
  else log('no keychain entry; waiting for manual login');
  const end = Date.now() + 10 * 60 * 1000; while (!(await isIn()) && Date.now() < end) await p.waitForTimeout(3000);
  if (!(await isIn())) { log('LOGIN TIMEOUT'); await ctx.close(); return; }
  log('LOGGED IN');
  // in-session nav links (session lives in the URL token)
  const links = await p.evaluate(() => { const o = {}; for (const a of document.querySelectorAll('a')) { const t = (a.textContent || '').trim(); if (/^Graphic Novels$/.test(t) && !o.gn) o.gn = a.href; if (/^Subscriptions & Pre-Orders$/.test(t) && !o.hub) o.hub = a.href; if (/^Back In Stock$/i.test(t) && !o.bis) o.bis = a.href; if (/^Home$/.test(t) && !o.home) o.home = a.href; } return o; });
  if (!links.bis && links.home) { await p.goto(links.home); await settle(); const b = await p.evaluate(() => { const a = [...document.querySelectorAll('a')].find(a => /^Back In Stock$/i.test((a.textContent || '').trim())); return a ? a.href : null; }); if (b) links.bis = b; }
  await p.goto(links.hub); await settle();
  Object.assign(links, await p.evaluate(() => { const o = {}; for (const a of document.querySelectorAll('a')) { const h = a.href || ''; if (/N0220800%25/.test(h) && !o.cart) o.cart = h; if (/N0220880%25/.test(h) && !o.wants) o.wants = h; if (/^Back In Stock$/i.test((a.textContent || '').trim()) && !o.bis) o.bis = h; } return o; }));
  log('links', Object.keys(links).join(','));
  if (!links.cart || !links.wants) { log('ABORT: cart/wants links not found'); await ctx.close(); return; }
  const cartState = async () => { await p.goto(links.cart); await settle(); return p.evaluate(() => ({ empty: /Shopping Cart is EMPTY/i.test(document.body.innerText), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 0) })); };
  const wantState = async () => { await p.goto(links.wants); await settle(); return p.evaluate(() => ({ items: [...document.querySelectorAll('img[id*="heart_full"]')].filter(i => i.offsetParent).length, hasRows: document.querySelectorAll('li img[id*="heart"], tr img[id*="heart"]').length })); };
  const c0 = await cartState(); const w0 = await wantState();
  log('BEFORE cart', JSON.stringify(c0), 'wants', JSON.stringify(w0));
  if (!c0.empty) { log('ABORT: cart was not empty before test — not touching it'); await ctx.close(); return; }
  // --- pick + add cart item (cheapest in-stock on a catalog page) ---
  const catalogUrl = links.bis || links.gn;
  await p.goto(catalogUrl); await settle();
  const cand = await p.evaluate(() => {
    const items = [...document.querySelectorAll('ul.ul-none li li, ul.ul-none ul > li')].filter(li => !li.querySelector('li'));
    const rows = items.map(li => {
      const imgs = [...li.querySelectorAll('img[id], [id*="cart"]')].map(e => ({ id: e.id, cls: e.className, vis: !!e.offsetParent, alt: e.getAttribute('alt') || '', onclick: (e.getAttribute('onclick') || '').slice(0, 100) }));
      const price = parseFloat(((li.querySelector('.actiontext-price') || {}).textContent || '').replace(/[^0-9.]/g, '')) || 999;
      const title = ((li.querySelector('span.onclick-cursor') || {}).textContent || '').trim().slice(0, 60);
      const soldOut = /SOLD OUT|out of stock/i.test(li.innerText);
      return { title, price, soldOut, imgs };
    });
    return { n: rows.length, sample: rows.slice(0, 2), rows };
  });
  log('catalog items', cand.n, 'sample', JSON.stringify(cand.sample, null, 1).slice(0, 1500));
  const cartable = cand.rows.filter(r => !r.soldOut && r.imgs.some(i => i.vis && /cart/i.test(i.id + i.alt) && !/remove/i.test(i.alt))).sort((a, b) => a.price - b.price);
  if (!cartable.length) { log('ABORT: no cart icon found'); await ctx.close(); return; }
  const pick = cartable[0]; const addIcon = pick.imgs.find(i => i.vis && /cart/i.test(i.id + i.alt) && !/remove/i.test(i.alt));
  log('CART PICK', pick.title, pick.price, 'icon', JSON.stringify(addIcon));
  net.length = 0;
  await p.click(`[id="${addIcon.id}"]`, { timeout: 5000 }).catch(() => p.evaluate(id => document.getElementById(id).click(), addIcon.id));
  await p.waitForTimeout(2500);
  const afterAdd = await p.evaluate(id => { const e = document.getElementById(id); const li = e && e.closest('li'); return li ? [...li.querySelectorAll('img[id]')].map(i => i.id + (i.offsetParent ? ' [vis]' : '') + ' alt=' + i.alt) : null; }, addIcon.id);
  log('after cart click net', JSON.stringify(net), 'icons', JSON.stringify(afterAdd));
  // --- want-list: an out-of-stock item on GN with an empty heart ---
  await p.goto(links.gn); await settle();
  const heart = await p.evaluate(() => {
    const hs = [...document.querySelectorAll('img[id*="heart_empty_"]')].filter(i => i.offsetParent);
    const so = hs.find(h => /SOLD OUT/i.test((h.closest('li') || h.parentElement).innerText)) || null;
    const h = so || null; if (!h) return { found: hs.length };
    const li = h.closest('li'); return { id: h.id, title: ((li.querySelector('span.onclick-cursor') || {}).textContent || li.innerText).trim().slice(0, 60), soldOut: !!so };
  });
  log('HEART PICK', JSON.stringify(heart));
  if (heart.id) { net.length = 0; await p.evaluate(id => document.getElementById(id).click(), heart.id); await p.waitForTimeout(2500); log('after heart click net', JSON.stringify(net), 'full visible:', await p.evaluate(id => { const f = document.getElementById(id.replace('empty', 'full')); return !!(f && f.offsetParent); }, heart.id)); }
  // --- test enhancer on cart + wants ---
  const results = {};
  for (const [name, url] of [['cart', links.cart], ['wants', links.wants]]) {
    for (const dark of [false, true]) {
      await p.goto(url); await settle();
      const raw = await p.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, ' ').slice(300, 900), forms: [...document.forms].map(f => [...f.elements].map(e => e.type + ':' + e.name + (e.value && e.type === 'submit' ? '=' + e.value : '')).join(' ')) }));
      await p.addScriptTag({ content: `(() => { const s = { gm_dark: ${dark}, gm_reskin: true }; window.GM_getValue = (k, d) => (k in s ? s[k] : d); window.GM_setValue = (k, v) => { s[k] = v; }; window.GM_addStyle = c => { const e = document.createElement('style'); e.textContent = c; document.head.appendChild(e); return e; }; })();` });
      await p.addScriptTag({ content: 'try {' + SCRIPT + '\n} catch (e) { window.__gmErr = String(e); }' });
      await p.waitForTimeout(1200);
      const st = await p.evaluate(() => ({ err: window.__gmErr || null, html: document.documentElement.className, cartRows: document.querySelectorAll('.gm-cart-row').length, cartForm: !!document.querySelector('.gm-cart-form'), classes: [...new Set([...document.querySelectorAll('[class*="gm-"]')].flatMap(e => [...e.classList].filter(c => c.startsWith('gm-'))))].join(' ') }));
      if (dark) st.lowContrast = await p.evaluate(AUDIT);
      if (!dark) st.raw = raw;
      await p.screenshot({ path: `${__dirname}/shots/${name}-filled-${dark ? 'dark' : 'light'}.png`, fullPage: true });
      results[name + (dark ? '-dark' : '-light')] = st;
    }
  }
  log('RESULTS', JSON.stringify(results, null, 1));
  // --- remove: toggle the same icons back off ---
  if (heart.id) {
    await p.goto(links.gn); await settle();
    await p.evaluate(id => { const f = document.getElementById(id.replace('empty', 'full')); if (f) f.click(); }, heart.id); await p.waitForTimeout(2500);
  }
  await p.goto(catalogUrl); await settle();
  const rm = await p.evaluate(id => { const e = document.getElementById(id); const li = e && e.closest('li'); if (!li) return 'item not found'; const r = [...li.querySelectorAll('img[id], [id*="cart"]')].find(i => i.offsetParent && /cart/i.test(i.id + i.alt) && i.id !== id); if (r) { r.click(); return 'clicked ' + r.id + ' alt=' + r.alt; } return 'no toggle icon; visible: ' + [...li.querySelectorAll('img[id]')].filter(i => i.offsetParent).map(i => i.id).join(','); }, addIcon.id);
  log('cart remove via catalog:', rm); await p.waitForTimeout(2500);
  let c1 = await cartState();
  if (!c1.empty) {
    // fallback: per-row qty -> 0 + a non-BUY, non-Clear update button; else Clear Cart (cart held only our test item)
    const fb = await p.evaluate(() => { const subs = [...document.querySelectorAll('input[type=submit],button')].map(b => b.value || b.textContent); return { subs, qty: [...document.querySelectorAll('input[type=text]')].map(i => i.name + '=' + i.value) }; });
    log('cart still has item; controls', JSON.stringify(fb));
    const upd = await p.$('input[type=submit][value*="Update" i], input[type=submit][value*="Recalc" i]');
    const qty = await p.$$('form input[type=text]');
    if (upd && qty.length === 1) { await qty[0].fill('0'); await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), upd.click()]); log('used qty=0 + update'); }
    else { const clr = await p.$('input[type=submit][value*="Clear" i]'); if (clr) { await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), clr.click()]); log('used Clear Cart (cart held only the test item)'); } }
    c1 = await cartState();
  }
  const w1 = await wantState();
  log('AFTER cart empty:', c1.empty, 'wants', JSON.stringify(w1), 'baseline wants', JSON.stringify(w0));
  await ctx.close();
})().catch(e => { console.log('FATAL', e.stack); process.exit(1); });
