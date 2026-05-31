# Ledger Core

Offline-first personal expense tracker (PWA).

**Live:** [https://ansilmbabl.github.io/pwa/exp-mng/](https://ansilmbabl.github.io/pwa/exp-mng/)

## Features

- Dashboard with total balance, monthly net, budget progress
- Add/edit/delete transactions with merchant, payment method, tags, splits
- Full history with search, filter, sort, older months
- Budget: monthly target, per-category limits, rollover, favorites
- Bills: recurring rules, subscriptions, due calendar, reminders
- Goals: savings targets, sinking funds
- Events/trips and split-bill groups
- Reports: pie chart, trends, yearly summary, month comparison
- Export JSON/CSV/PDF; encrypted backup; import
- Mobile: FAB, safe-area, numeric keyboard, installable PWA

## Local dev

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` (must use a local server for service workers).

## Install on phone

Chrome → Install button or Add to Home screen. iOS Safari → Share → Add to Home Screen.

Data is stored locally in IndexedDB. Export backups from **More → Settings**.
