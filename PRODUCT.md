# BIX
<!-- impeccable:product-schema 1 -->
## Platform
web
## Users
Daky and individual traders recording daily broker account performance on desktop and mobile.
## Product Purpose
A manual trading journal: broker accounts, total/free balances, broker-reported bonus progress, cash-flow-adjusted performance and goals. Forecasts are removed.
## Capabilities and Constraints
React/TypeScript PWA with existing Supabase authentication and cloud persistence. Preserve version-1 browser data and backups. No brokerage credentials, execution or invented statistics. Copy cumulative net turnover from the broker. Estimate bonus profit from cash-flow-adjusted P&L using the initial bonus capital ratio, clearly label estimated profit and estimated free balance, and allow optional cumulative broker overrides (including zero). Estimates are not broker-confirmed figures. Bonus release requires broker confirmation. Goals have freely selected start and end dates. Installable on supported browsers, with honest fallback instructions.
## Brand Commitments
BIX identity retained. User selected a dark cyan dashboard inspired by supplied trading dashboards, with an equivalent light theme. Keep useful data hierarchy, chart and journal, not simulated AI coaching or market feeds.
## Operating Context
Manual dated snapshots and transactions; saves require cloud connectivity. The PWA caches its shell, not offline account writes. Periodic private JSON backups. This implementation is local only: no commit, push, migration execution or deployment authorized in this task.
