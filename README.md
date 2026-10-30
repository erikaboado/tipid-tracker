# Tipid Tracker

Lahat ng promo, nandito na.

Tipid Tracker is a website for shoppers in the Philippines that collects current deals and promos (online shopping, groceries, flights, bank card promos) into one place. Browse by category and sort by promo start and end dates.

## Features
- **Deals page**: category filters, search, "Active now / Upcoming" filter, sort by ending soonest, starting soonest, newest or biggest discount.
- **Sale calendar**: 11.11, 12.12, payday (kinsenas / katapusan) and holiday sales with countdowns, plus deals ending this week.
- **Submit a deal**: visitors can share promos; submissions go into a review queue and never appear directly on the site.
- Two date ranges per deal: **promo period** (when you can buy) and **valid / travel period** (when you can use it).

## Data sources
- Retailer affiliate feeds (Shopee, Lazada, Involve Asia) — planned
- Official airline and bank promo pages — planned
- Public deal posts from r/DealsPH, r/ShopeePH and r/phmoneysaving (read-only, pending Reddit API approval). Shown as title + credited author + link back to the original Reddit thread. No post bodies or comments are copied.

The database currently holds **sample deals** (`is_sample = true`) for testing. Remove them once real feeds are connected:
```sql
delete from public.deals where is_sample;
```

## Tech
- React + TypeScript + Vite
- Supabase (Postgres) with row-level security: visitors can read deals and add pending submissions; only the backend can write deals.
- Schema: `supabase/migrations/`, starter data: `supabase/seed.sql`

## Run it locally
1. Install [Node.js](https://nodejs.org) 20 or newer.
2. Copy `.env.example` to `.env` and fill in your Supabase project URL and **publishable** key (Supabase → Project Settings → API).
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:5173

Never commit `.env` or any secret / service-role key. `.env` is already in `.gitignore`.

## Deploy to Vercel (free Hobby plan)
The repo is ready for Vercel: `vercel.json` sets the build command (`npm run build`), the output folder (`dist`) and a rewrite so any page path serves the app instead of a 404 on refresh.

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New… → Project**, find `erikaboado/tipid-tracker` and click **Import**. (If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the repo.)
3. Leave Framework Preset as **Vite**; the build settings come from `vercel.json`.
4. Open **Environment Variables** and add both, for Production, Preview and Development:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your project URL, e.g. `https://your-project-ref.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your **publishable** key (`sb_publishable_…`) |

   Both are in Supabase → Project Settings → API. Use the publishable key only. Never paste the secret / service-role key into Vercel or any `VITE_` variable, because every `VITE_` value is bundled into the public JavaScript.
5. Click **Deploy**. You'll get a `*.vercel.app` URL in about a minute.

After that, every push to `main` redeploys production and every pull request gets its own preview URL. If you change an environment variable later, redeploy (Deployments → ⋯ → Redeploy) because the values are baked in at build time. If the site shows "Supabase is not configured", the variables are missing or misspelled.

The app also works on other static hosts (Netlify, Cloudflare Pages) with the same build command, output folder and variables.

## Checks
GitHub Actions (`.github/workflows/ci.yml`) runs `npm run typecheck` and `npm run build` on every pull request and push to `main`. Run the same locally with `npm run typecheck && npm run build`.

## Status
In development.
