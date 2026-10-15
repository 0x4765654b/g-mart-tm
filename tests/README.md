# Live-site tests

Playwright scripts that load the real g-mart.com in a visible Chrome window,
inject `../gmart-enhancer.user.js` (with stubbed `GM_*` APIs), and check it.

- `run.js [pages…]` — light + dark sweep: JS errors, overflow, dark-mode contrast
  audit, catalog/list interactions, screenshots to `shots/`.
  `LOGIN=1 node run.js yoursubs yourpre subshub custinfo …` for account pages.
- `cartwant.js` / `want.js` — add one item to the cart / want list, test, then remove it.
- `verify.js` — confirm the cart and want list are empty.

Login: macOS Keychain entry `gmart-enhancer-test` (account = G-Mart number):
`security add-generic-password -s gmart-enhancer-test -a <number> -w`.
Falls back to waiting for a manual login. `.profile/` holds the browser profile.

Setup: `npm i playwright-core` here (or point `PLAYWRIGHT_CORE` at an existing
install); uses system Chrome (`CHROME_PATH` to override).

Notes: headless Chrome is blocked by Cloudflare (use headed). The session token
lives in URLs, so account pages are reached via in-session links. `shots/`,
`results-*.json`, logs and `.profile/` hold account data and are git-ignored.
