# Tipid Tracker

Lahat ng promo, nandito na.

Tipid Tracker is a website for shoppers in the Philippines that collects current deals and promos (online shopping, groceries, flights, bank card promos) into one place. Browse by category and sort by promo start and end dates.

## Features
- **Deals page**: category filters, search, "Active now / Upcoming" filter, sort by ending soonest, starting soonest, newest or biggest discount.
- **Sale calendar**: 11.11, 12.12, payday (kinsenas / katapusan) and holiday sales with countdowns, plus deals ending this week.
- **Submit a deal**: visitors can share promos; submissions go into a review queue and never appear directly on the site.
- **Admin review** (`#/admin`): signed-in admins edit, approve or reject submissions. Approving publishes the deal.
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
- Supabase (Postgres) with row-level security: visitors can read deals and add pending submissions; only the backend can write deals. Admins approve submissions through the `approve_submission()` database function, so no secret key is ever in the browser.
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

## Admin access
Admins sign in at `/#/admin` with a Supabase Auth email and password. An account is an admin only if its user id is in the `public.admins` table, which the browser cannot read or change.

To make the first admin:
1. Apply the migrations in `supabase/migrations/` (Supabase CLI `supabase db push`, or paste each file into the SQL editor in order).
2. In Supabase → Authentication → Users, click **Add user → Create new user**, enter the email and a strong password, and tick **Auto Confirm User**.
3. In Supabase → SQL Editor, run:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
4. Open `/#/admin` and sign in.

Add more admins the same way. To remove one: `delete from public.admins where user_id = (select id from auth.users where email = '...');`

Only admins can do anything on the admin page, but you can also turn off public sign-ups (Authentication → Sign In / Providers → **Allow new users to sign up**) so no one else can create an account.

## Deploy
Works on any static host (Vercel, Netlify, Cloudflare Pages). Build command `npm run build`, output folder `dist`, and add the two `VITE_SUPABASE_*` environment variables in the host's settings.

## Status
In development.
