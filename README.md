# BIX — Trading Journal

A local-first trading journal PWA built with React, TypeScript and Vite. No broker credentials, broker API, account creation or cloud database. Interface language: English.

## Run locally

Requires **Node.js 24** (or Node 22.12+) and npm.

```sh
npm ci
npm run dev
```

For the offline-capable production build:

```sh
npm run build
npm run preview -- --port 4174
```

Open http://127.0.0.1:4174. Offline caching is enabled in production, not the dev server. Open once online and let the service worker finish installing before going offline. Install with Chrome/Edge's address-bar install action, or Safari's Share → Add to Home Screen. Remote installation requires HTTPS. Updates take effect after closing all BIX tabs and reopening. An installed app has not been tested on physical iOS/Android hardware.

## Themes and installation

The header offers a remembered dark/light theme toggle and **Install app**. Supported Chromium browsers show their native installer after a click; other browsers receive instructions, including Safari on iOS. The app never claims installation completed until the browser reports it (or it is running standalone). Dark cyan is the default. Theme preference is stored separately as `bix.theme`; switching themes does not change journal data.

## Features

- Add, select, rename and delete broker account labels (USD, EUR, HTG). Deletion explicitly confirms removal of that broker's entries and goals. Changing a currency label **does not convert** existing amounts.
- Record one day per broker: date, opening/closing balance, net deposits/withdrawals and notes. Edit/delete records with duplicate and input validation.
- Account dashboard, balance history, winning-day percentage and daily returns. Empty first-run state: no seeded or fabricated trading results.
- Goals have freely selected start and end dates, both inclusive (for example October 19 through November 19). Weekly/monthly labels provide suggested periods, not restrictions. Month-end suggestions clamp to the last valid day. Existing version-1 goals without an end retain their original calendar-month/seven-day deadlines. Progress is net trading P&L, not deposits. Editing the same broker/period/start replaces that target.
- History-based geometric-mean projection and a separate hypothetical constant-return scenario. Active goals show the remaining profit needed and deadline.
- Versioned JSON export/import with explicit replacement confirmation, schema validation, a 5 MB import limit and raw-data export for recovery.
- Local persistence, offline reload and offline data entry. Unsaved forms are not persisted.

## Financial conventions

`P&L = closing − opening − net cash flow`, where positive cash flow is a deposit and negative is a withdrawal. P&L is rounded to cents. `Return = P&L / opening × 100`; a zero opening balance has no percentage return. Balances are nonnegative, and each monetary input is limited to an absolute value of 1e12. This is a personal tracker using JavaScript numbers, not an accounting ledger.

Balance chart points are equally spaced **recorded sessions**, not equally spaced calendar dates. The chart includes external cash flows; net P&L excludes them. The latest dated closing balance is the current account balance. Backdated edits do not rewrite later opening balances; reconcile them manually. Entries may intentionally have gaps between opening and previous closing balances.

Forecasts require at least two usable recorded returns, skip zero-opening days and growth factors below zero, and include total-loss sessions. They compound the geometric mean from the most recent closing balance, with no future deposits or withdrawals. Future sessions are not calendar dates. Extreme overflowing projections are rejected. Hypothetical returns range from −100% to +100% per session. **Neither model is a prediction, guarantee or financial recommendation.**

## Privacy and backups

Data lives in `localStorage` under `bix.state.v1` in the current browser and origin. No analytics, external fonts or runtime data APIs. Data is **not encrypted** and does not sync between devices, browser profiles, ports or origins. Clearing site data, private browsing expiry or browser storage eviction can erase it: export backups regularly. Keep exports private.

Invalid stored data is not silently replaced. Export the raw backup and import a repaired, valid version to recover. Storage errors are surfaced. A stale tab refuses to save if it detects that another tab changed the stored data; reload it first. The localStorage check/write is not a transactional multi-tab database; use one editing tab at a time.

## Project layout

- `src/domain.ts`: types, validation, P&L, broker/entry/goal operations and forecasting.
- `src/storage.ts`: versioned loading and persistence; preserves invalid originals.
- `src/App.tsx`: selected broker, navigation, save orchestration.
- `src/Journal.tsx`, `Goals.tsx`, `Forecast.tsx`, `Backup.tsx`: feature UI.
- `vite.config.ts`: web manifest, generated service worker and app-shell precache.
- `src/*.test.ts`: unit tests; `e2e/*.spec.ts`: real-browser workflows.

## Verification

```sh
npm test
npm run build
npm run test:e2e
npm run format:check
npm audit
```

Local Playwright tests use installed Microsoft Edge and one worker to avoid resource contention. CI uses Playwright Chromium (`npx playwright install --with-deps chromium`). E2E runs against the production preview on port 4174: stop any unrelated server on that port before testing. Tests use isolated browser contexts and explicit test fixtures, not your personal browser data.

`BIX_SCREENSHOTS=<absolute directory> node scripts/capture-ui.mjs` captures desktop/mobile views with a clearly labelled disposable test account, while the production preview is running. `node scripts/generate-icons.mjs` regenerates PWA icons from `public/icon.svg` using Edge.

## Hosting

The output is the static `dist/` directory; relative asset URLs support root or subdirectory hosting. Serve via HTTPS, avoid long immutable caching on `index.html`, `sw.js` and the manifest. No production hosting is configured or deployed by this repository. Pushing code is not deploying the app.
