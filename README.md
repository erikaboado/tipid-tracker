# Tipid Tracker

Lahat ng promo, nandito na.

Tipid Tracker is a website for shoppers in the Philippines that collects current deals and promos (online shopping, groceries, flights, bank card promos) into one place. Browse by category and sort by promo start and end dates.

## Features
- **Deals page**: category filters, search, "Active now / Upcoming" filter, sort by ending soonest, starting soonest, newest or biggest discount.
- **Sale calendar**: 11.11, 12.12, payday (kinsenas / katapusan) and holiday sales with countdowns, plus deals ending this week.
- **Submit a deal**: visitors can share promos; submissions go into a review queue and never appear directly on the site.
- Two date ranges per deal: **promo period** (when you can buy) and **valid / travel period** (when you can use it).

## Data sources
- **Involve Asia** affiliate offers, promotions and coupons — collector built (`supabase/functions/involve-asia-collector`), see [setup](#involve-asia-collector)
- Retailer affiliate feeds (Shopee, Lazada) — planned
- Official airline and bank promo pages — planned
- Public deal posts from r/DealsPH, r/ShopeePH and r/phmoneysaving (read-only, pending Reddit API approval). Shown as title + credited author + link back to the original Reddit thread. No post bodies or comments are copied.

The database currently holds **sample deals** (`is_sample = true`) for testing. Remove them once real feeds are connected:
```sql
delete from public.deals where is_sample;
```

## Involve Asia collector
A Supabase Edge Function that runs every 6 hours, pulls Philippine offers and their promotions/coupons from the [Involve Asia publisher API](https://api.involve.asia/docs/), and upserts them into `public.deals` (`source = 'involve_asia'`, `source_ref = 'campaign:<id>'`, so reruns update instead of duplicating).

**What it maps**
| Deal column | From Involve Asia |
|---|---|
| `title` | campaign title (or description) |
| `merchant` | offer name, e.g. "Lazada PH (CPS)" → "Lazada PH" |
| `category_slug` | campaign/offer category name, matched to our categories; unknown → `other` |
| `promo_code` | `voucher_code` |
| `promo_start` / `promo_end` | campaign start / end date |
| `valid_start` / `valid_end` | separate validity/travel dates, only when the feed has them |
| `url` | campaign tracking link, else the offer's tracking link |
| `image_url` | campaign banner, else the merchant logo; nothing else |

Skipped: expired promos, evergreen banners with no code and no end date, and anything without an affiliate link.

Involve Asia doesn't publish its response field names, so the mapper tries a few likely names per value (`FIELDS` in `mapper.ts`). Do a dry run first (step 5) and adjust if the real names differ.

**Setup**
1. Get API access: Involve Asia dashboard → Profile → Tools → API → **Request API Key** (approval takes up to 48 working hours). Copy the API Key and API Secret.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), then `supabase login` and `supabase link --project-ref YOUR-PROJECT-REF`.
3. Apply the new migration (adds the `other` category): `supabase db push`, or paste `supabase/migrations/0002_other_category.sql` into the SQL editor.
4. Set secrets and deploy:
   ```bash
   cp supabase/functions/.env.example supabase/functions/.env   # fill in real values; this file is gitignored
   supabase secrets set --env-file supabase/functions/.env
   supabase functions deploy involve-asia-collector --no-verify-jwt
   ```
   `--no-verify-jwt` is intentional: the function instead checks the `x-cron-secret` header against `COLLECTOR_CRON_SECRET`.
5. Dry run (fetches and maps, writes nothing, shows the feed's field names and 5 sample rows):
   ```bash
   curl -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/involve-asia-collector?dry_run=1" \
     -H "x-cron-secret: YOUR-COLLECTOR_CRON_SECRET"
   ```
   Drop `?dry_run=1` to do a real run.
6. Schedule it: follow `supabase/cron/involve_asia_collector.sql` in the SQL editor (enables pg_cron + pg_net, stores the URL and secret in Vault, schedules every 6 hours).

**Tests** (no API key needed; they use sample responses in `fixtures/`): install [Deno](https://deno.com) and run `npm run test:functions`.

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

Never commit `.env`, `supabase/functions/.env` or any secret / service-role / API key. Both are already in `.gitignore`.

## Deploy
Works on any static host (Vercel, Netlify, Cloudflare Pages). Build command `npm run build`, output folder `dist`, and add the two `VITE_SUPABASE_*` environment variables in the host's settings.

## Status
In development.
