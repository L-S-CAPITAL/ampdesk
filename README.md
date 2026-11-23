# AmpDesk — Account Manager Command Centre

A working prototype of the operating tool an Account Manager would run an electrical service business on: live job margins, quote follow-up aging, crew utilisation and non-billable downtime, WHS compliance checks and client account growth — on one board.

**Live demo:** https://l-s-capital.github.io/ampdesk/
**Single-file build:** [`docs/index.html`](docs/index.html) — the self-contained file GitHub Pages serves. `npm run build` also writes it locally to `dist/ampdesk.html` for offline sharing (git-ignored).

Built by Tobias Hall as part of an Account Manager (electrical services) application. It demonstrates how I would run the role's six accountability areas day-to-day — not as claims on a resume, but as a working system.

---

## Why this exists

The position description centres on the things that actually decide whether a service business makes money: quoting discipline, job margins caught *during* delivery rather than at post-job review, technicians kept productively allocated, WHS compliance enforced before crews roll out, and existing accounts grown deliberately.

AmpDesk models exactly that workflow. Every number on the board is computed from the dataset by tested logic — nothing is hard-coded decoration.

## What's on the board

| Module | What it does |
| --- | --- |
| **Command Board** | Prioritised action queue (critical → warning → info), six KPI tiles against targets (realised margin, open-margin projection, billable utilisation, non-billable downtime, quote conversion, overdue follow-ups), margin watchlist, value × age follow-up queue. Alerts are clickable and jump to the record. |
| **Jobs & Margins** | Every job with budget vs actual hours, cost to date, sell, projected final margin (estimate-to-complete aware) and flags: hours over budget, WHS docs incomplete, close-out overdue, notes not audited, approved-but-unscheduled. |
| **Quote Pipeline** | Fresh / follow-up due / stale buckets, follow-up queue weighted by value × age, conversion stats, closed-quote history. |
| **Team & Utilisation** | Per-technician billable / downtime / idle split, cost vs charge-out rates, job-note audit coverage, active job assignments. |
| **Client Accounts** | Health, revenue YTD, open jobs and quotes, growth pipeline with values, contact-cadence tracking with overdue flags. |

## How it maps to the position description

- *"Actively reduce avoidable non-billable downtime"* → downtime KPI tile, per-tech utilisation bars, critical alert when an apprentice sits idle (with the reason and the job causing it).
- *"Monitor job margins … throughout delivery rather than relying solely on post-job review"* → estimate-to-complete projection flags margin erosion mid-job (J-2006: 22.9% projected vs 32% target at 111% of budget hours).
- *"Follow up open quotes"* → 5-day chase window, aging buckets, priority queue ranked by value × age ($73,100 sitting past due in the demo).
- *"Champion and enforce WHS compliance"* → scheduled/in-progress jobs without SWMS or JSA are critical alerts before crews roll out.
- *"Ensure jobs are completed and closed out promptly"* → close-out clock on completed-but-uninvoiced work, plus job-note audit coverage per technician.
- *"Take accountability for Financial and Productivity KPIs"* → the six tiles, each with an explicit target and tolerance band.

## Stack & architecture

- **Zero dependencies** — vanilla ES6 + CSS. The whole app builds to one self-contained HTML file (no CDN, no runtime, works offline).
- **`src/logic.js`** — pure business logic (costing, margin projection, utilisation, quote aging, KPI aggregation, alert generation). No DOM. Runs in the browser and in Node.
- **`src/data.js`** — illustrative demo dataset (6 clients, 5 crew, 14 jobs, 10 quotes). All dates are generated relative to the day the app is opened, so the workspace always looks current.
- **`src/app.js` / `index.html` / `src/styles.css`** — rendering layer.
- **`test/logic.test.cjs`** — 17 automated tests (node:test) covering costing, margin bands, flags, utilisation, quote buckets, alert coverage and dataset integrity.
- **`build.mjs`** — inlines CSS + JS into one self-contained HTML file: `dist/ampdesk.html` (local shareable build) and `docs/index.html`, which is committed and served by GitHub Pages.

## Run it

```bash
npm test    # run the logic test suite (Node 18+)
npm run build
```

Then open `dist/ampdesk.html` — or just use the live demo link above.

## A note on the data

All clients, jobs, technicians and figures are **fictional and illustrative**, built to exercise the KPI logic realistically (a healthy portfolio, one eroding job, one at-risk account, one idle apprentice). Rates and margin targets are typical for Australian electrical service work but do not represent any real company.

---

*Contact: Tobias Hall · tobiasduncanhall@gmail.com · 0406 556 499 · [github.com/L-S-CAPITAL](https://github.com/L-S-CAPITAL)*
