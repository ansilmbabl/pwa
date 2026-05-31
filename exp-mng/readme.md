# Ledger Core

Offline-first personal expense tracker (PWA).

**Live:** [https://ansilmbabl.github.io/pwa/exp-mng/](https://ansilmbabl.github.io/pwa/exp-mng/)  
**Source:** [github.com/ansilmbabl/pwa](https://github.com/ansilmbabl/pwa)

## Quick start

Tap **?** in the top bar for a guided tour of the app.

## Local dev

```bash
cd exp-mng
python3 -m http.server 8080
# or: npx serve .
```

Open `http://localhost:8080` (a local server is required for service workers and ES modules).

## Install on phone

- **Chrome / Android:** Install button in the header, or Add to Home screen
- **iOS Safari:** Share → Add to Home Screen

Data is stored locally in IndexedDB. Export backups from **Settings ⚙ → Data & backup**.

**Updating:** Use **Settings → Data & backup → Update now** — it backs up your data, installs the latest version, and reloads. IndexedDB data normally survives updates; the backup is a safety net. If the UI stops responding after clearing cache, hard-refresh once (`Cmd+Shift+R` / `Ctrl+Shift+R`) or unregister the service worker in DevTools → Application.

---

## All features

### Core tracking
- Add, edit, and delete income & expense transactions
- **Date and time** on every entry (defaults to now)
- **Category picker** — searchable popup with grouped **subcategories** (e.g. Food → Groceries)
- Categories with icons, colors, parent/subcategory, and tax-deductible flag
- Merchant, **payment method** (Cash, UPI, Card, Bank), notes, and tags
- **Split lines** on a single transaction
- Link transactions to **events/trips** and **wallets**
- **Quick amounts** (100 / 500 / 1k) and **repeat last** (prefills the form; you save manually)
- **Duplicate detection** when saving similar entries
- **Receipt photo** attach (stored locally on device)
- **Share** individual transactions to other apps (Web Share API or clipboard)

### Navigation & UX
- Bottom nav: **Home · History · + · Reports · More**
- Center **+** button opens the add-transaction popup
- **Settings ⚙** in the top-right header
- **App tour (?)** — step-by-step guide; auto-shows on first visit
- **More** menu: Calendar, Wallets, Budget, Bills, Goals, Events, Mileage, Tax calc
- **Section tabs** inside long screens (Reports, Budget, Bills, Goals, Events, Wallets, Tax calc). **Settings** uses a main list + drill-in sub-screens (like system Settings apps).
- Add-transaction popup tabs: **Essentials · Details** (amount, date, category, payment on Essentials)
- Obsidian dark theme with **light mode** toggle
- Sticky filters on History; scroll-to-top on screen change

### Home dashboard
- **Period tabs:** Week · Month · Year · All — hero stats and recent activity follow the selected period
- Total balance (all time on hero when period is All)
- Income, spending, net, and left-to-spend for the active period
- Budget progress bar
- **Wallet balances** summary
- Recent activity list

### History
- Full transaction list with time-based grouping (Today, Yesterday, This Week…)
- Search by notes, merchant, amount
- Filter by type; **multi-category filter** via category picker (selecting a parent includes subcategories)
- Sort by date or amount
- Edit, share, and delete actions

### Calendar (More)
- Monthly **spending heatmap** (darker = more spent)
- Tap a day for that day’s transactions
- **Open day report** jumps to Reports with that date selected

### Wallets
- Multiple wallets (Cash, Bank, Card, custom)
- Computed balance per wallet from transactions
- **Transfers** between wallets
- Assign wallet when adding a transaction

### Budget
- Monthly budget target with spent / remaining
- Per-category limits, rollover, and favorites
- Over-budget alerts (toast + optional notifications)

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
- Optional **multi-category filter** (picker; parent includes subcategories)
- **Overview:** income, expenses, net, share & filtered export (CSV, JSON, PDF)
- **Charts:** category pie chart, top categories, spending trend, month vs last month
- **Insights:** top merchants, spending heatmap, cash flow forecast, yearly summary
- **Advice:** spending tips based on your patterns and budgets
- **Tax:** deductible categories + mileage total; link to salary tax calculator
- **Share report** sheet — preview, format options, share/copy text, **share or save as PNG image**
- **Branded exports** — logo/watermark on PDF, header on CSV, generator block on JSON

### India salary tax calculator (FY 2025-26)
- **Old vs new regime** side-by-side comparison with recommendation
- Inputs: gross salary, basic, age category (general / senior / super senior)
- Old regime: 80C, 80D, HRA, home loan interest (24b), NPS 80CCD(1B), professional tax
- Employer NPS (80CCD(2)) for both regimes
- **HRA exemption** calculator (three-method rule)
- **Reference tab:** slabs, surcharge, cess, deductions list
- Section 87A rebate, 4% cess, surcharge for high incomes
- **Tax rules last updated** date shown at bottom (update when laws change)
- Runs fully offline — no data sent anywhere

### Settings & data
- **Main list + drill-in:** tap a row (Appearance, Notifications, PIN lock, Smart rules, Data & backup, Categories & tags, About) — **← Back** returns to the list.
- **About:** app version, storage info, link to GitHub source
- **One-click app update** — Data & backup → Update now (auto-backup, activate latest version, reload)
- Update banner when a new version is detected
- **Theme:** dark / light (Appearance)
- **Currency:** INR, USD, EUR, GBP, JPY (Appearance)
- **Notifications:** daily expense reminder, monthly/category budget alerts, bill due reminders, backup reminders (30+ days)
- **PIN lock** (4–6 digits, auto-lock after idle)
- **Auto-categorization rules** (merchant pattern → category)
- **Backup folder** (File System Access API) — auto-saves `ledger-core-backup.json`
- Export: JSON, CSV, PDF/print, encrypted backup
- Import: JSON, CSV, encrypted, restore from backup folder
- Manage categories (with parent/subcategory and tax flag) and tags
- Clear all data

### PWA & offline
- Service worker offline cache (network-first for app shell, cache fallback)
- Installable as standalone app
- Safe-area support for notched phones
- Works fully offline after first load

### Technical
- Vanilla HTML / CSS / JavaScript (ES modules)
- IndexedDB v4 (`transactions`, `categories`, `tags`, `wallets`, `recurring`, `goals`, `funds`, `events`, `splits`, `auto_rules`, `mileage`, `settings`)
- No build step; deploy as static files to GitHub Pages
- Key modules: `app.js`, `transactions.js`, `reports.js`, `category-picker.js`, `calendar.js`, `notifications.js`, `share.js`, `share-image.js`, `export-brand.js`, `tax-india.js`, `settings-nav.js`, `sw.js`
