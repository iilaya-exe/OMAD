# 💸 Student Budget & Expense Tracker

A budget and expense tracker built for college students. It runs **entirely in your browser** — no accounts, no server, no installs, no tracking. Your data is stored locally in your browser's `localStorage` and never leaves your device.

Built with plain **HTML, CSS, and JavaScript** — zero dependencies, zero build step. Just open `index.html`.

## ✨ Features

**Semester-aware**
- First-run setup asks which **semester and academic year** the budget covers before anything else
- The period is shown as a badge in the header and can be changed anytime in Settings
- **Start a new budgeting period** when the term ends: everything (expenses, budgets, goals) is archived and you're taken back to the setup screen
- **History** in Settings keeps every past period — expand one to see its category breakdown, savings goals, and full expense list

**Dashboard**
- Monthly overview with stat tiles: total spent, budget remaining, top category, and average per day
- Spending-by-category bar chart with a consistent color per category
- 6-month spending trend chart
- Hover tooltips on all charts, and a recent-expenses feed

**Expenses**
- Add, edit, and delete expenses (amount, category, date, payment method, note)
- Browse by month with search, category filter, and sorting (date or amount)
- Running total for whatever filter you have applied

**Budgets**
- Set a monthly limit per category
- Progress meters that turn red (with a ⚠ warning and the overage amount) when you go over

**Savings**
- Create savings goals with a target amount and an optional target date
- Deposit and withdraw against each goal, with a full history kept per goal
- Progress meters, and a suggested "save ~X/month" pace to hit dated goals on time

**Data & settings**
- All amounts are in **Philippine pesos (₱)**
- Light / dark theme (follows your OS setting by default)
- Data stays local in your browser (localStorage) — no accounts, no tracking
- Preview the app with sample data anytime by opening `index.html?demo`

## 🚀 Getting started

1. Download or clone this repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari). That's it.
3. Pick your semester and academic year on the welcome screen, then start adding expenses.

You can also open the app with `?demo` on the end of the URL (e.g. `index.html?demo`) to preview it with sample data without saving anything.

> **Tip:** amounts are stored internally as integer centavos, so totals never suffer from floating-point rounding errors.

## 🌐 Host it free with GitHub Pages

Once this repo is on GitHub you can use the app from any device:

1. On GitHub, open the repo → **Settings** → **Pages**.
2. Under *Build and deployment*, set **Source** to `Deploy from a branch`, pick the `main` branch and the `/ (root)` folder, then save.
3. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.

Note: `localStorage` is per-browser-per-device, so your phone and laptop each keep their own data.

## 📁 Project structure

```
├── index.html        # App shell: tabs, forms, modal
├── favicon.svg       # Gold-coin favicon
├── css/
│   └── style.css     # Theme tokens (light/dark) + all styles
├── fonts/
│   └── inter-latin-wght-normal.woff2   # Inter (variable weight), bundled for offline use
├── js/
│   ├── icons.js      # Inline SVG icon set (no emoji, no icon fonts)
│   ├── storage.js    # Data model, localStorage, validation, period archives, sample data
│   ├── charts.js     # Hand-rolled SVG charts (bars, columns, tooltips) — no libraries
│   └── app.js        # State, rendering, and event wiring
└── README.md
```

## 🧠 Design notes

- **Integer centavos** for all money math — floats are never used for storage or addition.
- **Fixed category → color mapping.** Each of the 8 categories owns one slot of a colorblind-validated palette, so a category looks the same in every chart, dot, and meter, regardless of filters.
- **All icons are hand-written inline SVGs** (stroke style, inheriting `currentColor`) — no emoji, no icon fonts, no external icon packs.
- **The Inter typeface is bundled locally** (one 47 KB variable-weight file) rather than loaded from a CDN, so typography is consistent and the app still works with no internet connection.
- **Charts are hand-written SVG** — thin marks, rounded data-ends, hairline gridlines, direct value labels, and hover tooltips — so the repo stays dependency-free and works offline.
- **Defensive loading.** Saved data (including period archives) is validated field-by-field on every load; a corrupted or hand-edited localStorage entry can't break the app.
- **Accessible by default:** ARIA roles on tabs/dialog/charts, over-budget state communicated by text + icon (never color alone), and both light and dark themes use palettes tuned for their own surface.

## 🗺️ Roadmap ideas

- [ ] Recurring expenses (rent, subscriptions) auto-added each month
- [ ] Income tracking
- [ ] CSV export of expenses and archived periods
- [ ] Weekly spending view and streaks
- [ ] PWA manifest so it installs like a native app

Pull requests and ideas welcome!
