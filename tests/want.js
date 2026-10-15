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
  const links = await p.evaluate(() => { const o = {}; for (const a of document.querySelectorAll('a')) { const t = (a.textContent || '').trim(); if (/^Graphic Novels$/.test(t) && !o.gn) o.gn = a.href; if (/^Subscriptions & Pre-Orders$/.test(t) && !o.hub) o.hub = a.href; if (/^Back In Stock$/i.test(t) && !o.bis) o.bis = a.href; if (/^Current Issues$/.test(t) && !o.cur) o.cur = a.href; if (/^Home$/.test(t) && !o.home) o.home = a.href; } return o; });
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
  // --- find a visible empty heart on a few catalog pages ---
  if (!links.cur) { await p.goto(links.hub); await settle(); }
  const pages = [];
  for (const k of ['cur', 'bis', 'gn']) if (links[k]) pages.push([k, links[k]]);
  if (links.home) { await p.goto(links.home); await settle(); const more = await p.evaluate(() => { const o = []; for (const a of document.querySelectorAll('a')) { const t = (a.textContent || '').trim(); if (/^(Current Issues|Clearance|key issues|SALE 60% OFF Ratio Variant Covers!)$/i.test(t)) o.push([t, a.href]); } return o; }); for (const m of more) if (!pages.some(x => x[1] === m[1])) pages.push(m); }
  let heart = null, heartPage = null;
  for (const [k, url] of pages) {
    await p.goto(url); await settle();
    const r = await p.evaluate(() => {
      const all = [...document.querySelectorAll('img[id*="heart_empty_"]')];
      const vis = all.filter(i => i.offsetParent);
      const h = vis[0]; if (!h) return { all: all.length, vis: 0, sample: all[0] ? all[0].outerHTML.slice(0, 300) : null };
      const li = h.closest('li') || h.parentElement;
      return { all: all.length, vis: vis.length, id: h.id, title: (((li.querySelector && li.querySelector('span.onclick-cursor')) || li).textContent || '').trim().slice(0, 60), onclick: (h.getAttribute('onclick') || '').slice(0, 90) };
    });
    log('hearts on', k, JSON.stringify(r));
    if (r.id) { heart = r; heartPage = url; break; }
  }
  if (!heart) { log('ABORT: no visible empty heart anywhere'); await ctx.close(); return; }
  net.length = 0; await p.evaluate(id => document.getElementById(id).click(), heart.id); await p.waitForTimeout(2500);
  log('HEART PICK', heart.title, 'net', JSON.stringify(net), 'full visible:', await p.evaluate(id => { const f = document.getElementById(id.replace('empty', 'full')); return !!(f && f.offsetParent); }, heart.id));
  // --- test enhancer on cart + wants ---
  const results = {};
  for (const [name, url] of [['wants', links.wants]]) {
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
  // --- remove: toggle the heart back off ---
  await p.goto(heartPage); await settle();
  log('heart remove:', await p.evaluate(id => { const f = document.getElementById(id.replace('empty', 'full')); if (f && f.offsetParent) { f.click(); return 'clicked ' + f.id; } return 'full heart not visible'; }, heart.id));
  await p.waitForTimeout(2500);
  const w1 = await wantState();
  log('AFTER wants', JSON.stringify(w1), 'baseline wants', JSON.stringify(w0));
  await ctx.close();
})().catch(e => { console.log('FATAL', e.stack); process.exit(1); });
