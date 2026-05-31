# Ledger Core (Version 1)

A sleek, performance-focused, offline-first personal expense tracking application. Built entirely with vanilla web standards (HTML5, CSS3, JavaScript ES6) and structured as a Progressive Web App (PWA) to ensure low-latency performance and cross-platform native execution out of local client storage.

---

## 🛠 Features & Scope Architecture

### 1. Minimalist Financial Dashboard

* **Real-time Metrics:** Displays remaining balance, total monthly income, and total monthly expenses using local transactional context.
* **Transaction Intake Module:** Rapid single-entry record system with precision parameter binding.
* **Data Fields:** Amount (₹), Transaction Type (Income vs Expense), Calendar Date, Category, and Notes/Remarks.
* **Locked Category Set:** `Food`, `Transport`, `Shopping`, `Bills`, `Health`, `Entertainment`, and `Other`.



### 2. Transaction Log Timeline History

* **Timeframe Filtering Engine:** Chronological record arrangement that groups entries into logical buckets on the fly:
* *Today*, *Yesterday*, *This Week*, and *This Month*.


* **Data Management:** In-line micro-actions allowing instant record purge from the database structure with safety verification confirmations.

### 3. Analytics & Export Engine

* **Category-wise Distribution Wheel:** Custom programmatic HTML5 Canvas visualization illustrating percentage breakdowns of monthly expenditures.
* **Direct-String Compilers:** Native data compilation handlers that assemble and export local datasets without external server round-trips:
* **JSON:** Structured array configuration dump.
* **CSV:** Clean RFC-compliant spreadsheet data tables with quotation escaping handling for comment fields.



---

## 💾 System Database Schema

The persistence layer runs completely client-side via the asynchronous browser **IndexedDB** engine.

* **Database Namespace:** `LedgerCoreDB`
* **Database Version:** `1`
* **ObjectStore Mapping:** `transactions` (Primary Key: `id`, `autoIncrement: true`)

### Record Object Structural Matrix

```json
{
  "id": 1,
  "amount": 2450.50,
  "type": "expense",
  "date": "2026-05-31",
  "category": "Bills",
  "notes": "Internet broadband renewal invoice"
}

```

---

## 📂 Project Directory Structure

Ensure your local development workspace directory structure is configured as follows:

```text
├── index.html        # App structural layout & logic bindings
├── styles.css        # Glassmorphic palette definitions & layouts
├── db.js             # Asynchronous IndexedDB interaction layer
├── sw.js             # Offline resource caching worker
└── manifest.json     # PWA shell deployment configuration

```

---

## 🚀 Local Launch & Environment Verification

Because Service Workers require a secure origin environment to execute, the application must be served over a local loopback server (`localhost`).

### Option A: Python Quick Serve (Recommended)

Open your development terminal within the root of the project directory and execute:

```bash
python -m http.server 8080

```

Navigate your browser window target directly to `http://localhost:8080`.

### Option B: Node.js `http-server`

If you prefer Node-based environments, install and launch via:

```bash
npm install -g http-server
http-server -p 8080

```

### 📱 Installing as a Mobile/Desktop App

1. Load the application via a local server URL in Chrome or Safari.
2. Once the Service Worker activates successfully, click the custom **"Install"** button in the app header (or use your browser's native *Add to Home Screen* options).
3. The utility will detach into an independent standalone application shell running entirely offline.