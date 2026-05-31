# Ledger Core

Offline-first personal expense tracker (PWA).

**Live:** [https://ansilmbabl.github.io/pwa/exp-mng/](https://ansilmbabl.github.io/pwa/exp-mng/)

## Quick start

Tap **?** in the top bar for a guided tour of the app.

## Local dev

```bash
cd exp-mng
python3 -m http.server 8080
```

Open `http://localhost:8080` (a local server is required for service workers).

## Install on phone

- **Chrome / Android:** Install button in the header, or Add to Home screen
- **iOS Safari:** Share → Add to Home Screen

Data is stored locally in IndexedDB. Export backups from **Settings ⚙ → Data**.

---

## All features

### Core tracking
- Add, edit, and delete income & expense transactions
- **Date and time** on every entry (defaults to now)
- Categories with icons, colors, **subcategories**, and tax-deductible flag
- Merchant, payment method (Cash, UPI, Card, Bank), notes, and tags
- **Split lines** on a single transaction
- Link transactions to **events/trips**
- **Quick amounts** (100 / 500 / 1k) and **repeat last** entry
- **Duplicate detection** when saving similar entries
- **Receipt photo** attach (stored locally on device)
- **Share** individual transactions to other apps (Web Share API or clipboard)

### Navigation & UX
- Bottom nav: **Home · History · + · Reports · More**
- Center **+** button opens the add-transaction popup
- **Settings ⚙** in the top-right header
- **App tour (?)** — step-by-step guide; auto-shows on first visit
- **Section tabs** inside long screens (Reports, Settings, Budget, Bills, Goals, Events, Wallets)
- Add-transaction popup tabs: **Essentials · Details**
- Obsidian dark theme with **light mode** toggle
- Sticky filters on History; scroll-to-top on screen change

### Home dashboard
- Total balance (all time)
- Monthly income, spending, net, and left-to-spend
- Budget progress bar
- **Wallet balances** summary
- Recent activity list

### History
- Full transaction list with time-based grouping (Today, Yesterday, This Week…)
- Search by notes, merchant, amount
- Filter by type and category; sort by date or amount
- Edit, share, and delete actions

### Wallets
- Multiple wallets (Cash, Bank, Card, custom)
- Computed balance per wallet from transactions
- **Transfers** between wallets
- Assign wallet when adding a transaction

### Budget
- Monthly budget target with spent / remaining
- Per-category limits, rollover, and favorites
- Over-budget alerts

### Bills & recurring
- Recurring expense rules (weekly, monthly, yearly)
- **Subscription** tracking with monthly/yearly totals
- 30-day **upcoming bills** calendar
- Bill reminder notifications (when enabled)

### Goals & funds
- **Savings goals** with target and deadline
- **Sinking funds** for planned expenses

### Events & trips
- Event budgets with date ranges
- **Split-bill groups** with members

### Mileage
- Log trips with miles and purpose
- Configurable rate per mile
- Feeds into tax report

### Reports
- Period filter: month picker or custom date range
- **Overview:** income, expenses, net, share & filtered export (CSV, JSON, PDF)
- **Charts:** category pie chart, top categories, spending trend, month vs last month
- **Insights:** top merchants, spending heatmap, cash flow forecast, yearly summary
- **Tax:** deductible categories + mileage total

### Settings & data
- **Theme:** dark / light
- **Currency:** INR, USD, EUR, GBP, JPY
- **PIN lock** (4–6 digits, auto-lock after idle)
- **Auto-categorization rules** (merchant pattern → category)
- **Backup folder** (File System Access API) — auto-saves `ledger-core-backup.json`
- Export: JSON, CSV, PDF/print, encrypted backup
- Import: JSON, CSV, encrypted, restore from backup folder
- Manage categories (with parent/subcategory and tax flag) and tags
- Clear all data

### PWA & offline
- Service worker offline cache
- Installable as standalone app
- Safe-area support for notched phones
- Works fully offline after first load

### Technical
- Vanilla HTML / CSS / JavaScript (ES modules)
- IndexedDB v4 (`transactions`, `categories`, `tags`, `wallets`, `recurring`, `goals`, `funds`, `events`, `splits`, `auto_rules`, `mileage`, `settings`)
- No build step; deploy as static files to GitHub Pages
