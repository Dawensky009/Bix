# BIX — Trading Journal

Manual broker-account journal built with React, TypeScript, Vite and Supabase authentication/database. English interface. No broker credentials, broker API or trading execution.

## Run

Requires Node.js 24 (or 22.12+) and npm. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for your Supabase project; never use a service-role key in the frontend.

```sh
npm ci
npm run dev
npm run build
npm run preview -- --port 4174
```

**Deployment prerequisite:** review and apply `supabase/migrations/20261104_bonus.sql` to the existing schema before using the new persistence fields. This change has NOT applied that migration or changed a live database. Existing tables and per-user RLS policies are prerequisites. The migration adds nullable columns (no destructive backfill) and an invoker-rights atomic backup-restore RPC. Its execution and RLS behavior must be verified against your actual schema before deployment.

## Account and bonus

- Enter your own deposit and optional bonus percentage. Initial total is deposit plus bonus principal; required turnover comes from the broker.
- For an already-active account, expand “Already trading on this account?” and enter current broker balance, its **snapshot date**, initial cumulative net turnover and bonus profit. This is an **end-of-day** starting snapshot, not invented historical trading P&L. New entries and transactions must be strictly after that date, including transactions marked after closing. Imported history on or before the cutoff remains in raw storage/backups but is excluded from balances, bonus status/readings, journal, chart, statistics and goal calculations. The first later entry reconciles only post-cutoff cash flows.
- Legacy backups and cloud snapshots with no date retain their original all-history behavior (including the risk of double-counting activity already represented by a current balance). No date is guessed or backfilled. An unchanged legacy balance can still be saved without a date; new or changed balance snapshots require one. Add the correct date in Manage broker to adopt cutoff semantics. Review the resulting history when changing a cutoff.
- **Total balance** includes bonus funds. **Free balance** excludes the nonnegative sum of active bonus principal and bonus profit, floored at zero and never above the nonnegative total. It is labeled **Estimated free balance** whenever the active bonus profit is estimated. Neither figure guarantees withdrawal eligibility.
- Copy **cumulative net turnover**, never daily turnover. Each dated reading replaces the prior reading; readings are not summed.
- **Bonus profit is estimated automatically** when the journal override is blank: initial snapshot bonus profit (zero if absent), plus subsequent cash-flow-adjusted P&L × initial bonus principal / (own deposit + initial bonus principal). Deposits, withdrawals and exact bonus deductions are not gains; they do not change this fixed initial allocation ratio. This is an estimate, not the broker’s actual allocation formula.
- **Broker bonus profit (optional override)** accepts a cumulative broker reading, including zero or a negative value. It resets the reference for subsequent automatic entries. Clearing it returns that entry to automatic calculation. Historical edits/deletions recompute estimates chronologically; a later manual reading remains authoritative. Only display results are rounded to cents, not each daily allocation.
- Estimated losses are floored at minus the initial bonus principal. The underlying deficit is retained so later recovery does not invent gains; manual broker readings are never clamped. Positive cumulative estimates are not capped by current equity (withdrawals may reduce equity), while free balance remains bounded. These are bookkeeping bounds, not broker loss-allocation rules. Check actual balances and eligibility with the broker.
- No automatic increment is made on a closing entry that confirms release/cancellation, or after a confirmation before closing. A confirmation after closing retains that day’s estimate but stops later increments. Without intraday trade timestamps, BIX does not guess an allocation for the confirmation interval.
- Reaching the turnover goal does not release a bonus. Record explicit broker release or cancellation in a journal entry or transaction. Historical figures are retained.
- Forecast has been removed.

## Transactions and reconciliation

Record actual deposit/withdrawal amounts, the exact bonus deduction (zero if none), and the balance after the transaction. Choose whether it happened before or after that date’s journal closing. Set **Chronological order**: lower numbers happened earlier within the same broker/date/phase. It is editable, so a backfilled earlier transaction must have a lower number than a later transaction even if saved last. New saves reject duplicate orders within that scope. Balance, bonus status and the newest-first journal use this chronology. Legacy imports retain missing/duplicate orders: missing means 0 and ties use the transaction ID deterministically; assign unique orders when correcting ambiguous history.

New journal entries derive opening and cash flow from prior dated records. `P&L = closing − opening − cash flow`, including bonus deductions as negative external adjustments rather than trading losses. A before-close transaction is included once in that snapshot; an after-close transaction updates the current balance and the next journal interval. Editing/deleting a historical transaction or entry recalculates these derived values. Later reported closing/post-transaction balances remain authoritative; they are not silently rewritten. Review those snapshots after correcting history. Legacy journal entries retain their manually entered opening/cash-flow values; reconcile those manually, including deductions.

Turnover corrections may decrease a cumulative reading: BIX uses the latest dated value as reported. The balance chart shows recorded closing snapshots and includes external cash flows, not a pure performance curve. New account snapshots do not create journal gains. Goals use inclusive freely chosen date ranges and cash-flow-adjusted journal P&L.

## Persistence and backups

Authentication and financial records are stored in Supabase. Saving requires a connection; only the app shell is cached by the PWA. Unsaved forms are not persisted. Failures retain form input and show an error; successful writes are read back. Use one editing tab at a time: there is no cross-tab optimistic concurrency guarantee.

Version-1 JSON backups remain accepted. A missing entry `bonusProfit` (SQL `bonus_profit = null`) means automatic; numeric values including zero mean broker overrides. Derived estimates are never saved as overrides or exported. No additional SQL migration is needed for estimation. Old records without bonus/transaction fields remain readable; entries without a bonus-profit reading now use the labeled estimate when a bonus is configured. Import validates before making an atomic replacement request; export first, keep backups private. Existing `bix.state.v1` browser bytes are not changed by the cloud application; export them from the previous app or recover that JSON manually for import. `src/storage.ts` retains the legacy reader. Changing currency labels does not convert amounts, and BIX does not combine different currencies into a fictitious portfolio total.

## Theme and installation

Dark cyan and equivalent light themes share all functions. Theme preference is separate at `bix.theme`. Install app uses the native prompt when available, otherwise browser-specific guidance. Mobile browser layout is tested; physical iOS/Android installation is not verified.

## Verification

```sh
npm test
npm run build
npm run test:e2e
npm run format:check
npm audit
```

Playwright builds with an explicitly fake Supabase URL/key, intercepts its requests in isolated browser contexts, and never writes real user data. Local tests use Edge; CI uses installed Playwright Chromium. Stop any unrelated server on port 4174. These tests verify UI, mappings and simulated failures, **not live SQL, policies or cloud availability**. Screenshot fixtures are clearly labeled and captured under `.impeccable/review/` in desktop/mobile and both themes by `e2e/mobile-content.spec.ts`.

No commit, push or deployment is implied by local verification.
