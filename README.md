# AP Circle BO Transactions Dashboard

Static React + TypeScript dashboard for monitoring Branch Post Office transactions in Andhra Pradesh Circle.

## What It Shows

- Circle-level KPIs for active BOs, nil BOs, BOs with 1-10 transactions, and BOs above 10.
- Product split for Speed Post, Parcels, and Other bookings.
- Region ranking by percentage of BOs above 10 transactions.
- Division-level monitoring with HO, SO, BO, and Others views.
- Searchable Region, Division, and Office table with expandable Speed Post mail-type and revenue detail.

## Data Rules

- Transactions = `article-count`.
- Revenue Earned = `total_amount - tax`.
- BO target bands are calculated over the full report period:
  - `Nil`
  - `1-10`
  - `>10`
- Speed Post includes all products containing `Speed Post`, including `Speed Post Parcel Domestic`.
- Parcels include product names containing `parcel` after excluding Speed Post products.
- Public dashboard JSON excludes emails, phone numbers, addresses, and unrelated hierarchy metadata.

## Local Setup

1. Install Node.js LTS from [nodejs.org](https://nodejs.org/).
2. Open this folder in VS Code.
3. Install dependencies:

```bash
npm install
```

4. Rebuild the dashboard data from the source files:

```bash
npm run data:build
```

By default, the data builder searches:

- `data/raw/`
- your `Downloads` folder

You can also pass explicit paths:

```bash
python scripts/build_data.py --bookings "C:\path\Booking_Productwise_Report (3).csv" --hierarchy "C:\path\Hierarchy data latest 30.03.2026.xlsx"
```

5. Validate the generated data:

```bash
npm run data:validate
```

6. Start the local dashboard:

```bash
npm run dev
```

## Production Build

```bash
npm run build
```

The static site is written to `dist/`.

## GitHub Pages Deployment

This repository includes `.github/workflows/deploy.yml`.

Recommended flow:

1. Commit the project, including `public/data/dashboard-data.json`.
2. Push to GitHub.
3. In GitHub repository settings, enable Pages from GitHub Actions.
4. Push to the `main` branch.

The workflow installs dependencies, runs the data validator, builds the Vite app, and publishes `dist/`.

## Refreshing Data

When a new booking report or hierarchy workbook is available:

1. Place the raw files in `data/raw/` or keep them in Downloads.
2. Run `npm run data:build`.
3. Run `npm run data:validate`.
4. Review and commit the updated `public/data/dashboard-data.json`.

Raw `.csv` and `.xlsx` files are intentionally ignored by git.
