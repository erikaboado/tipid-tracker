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

## Deploy
Works on any static host (Vercel, Netlify, Cloudflare Pages). Build command `npm run build`, output folder `dist`, and add the two `VITE_SUPABASE_*` environment variables in the host's settings.

## Status
In development.
