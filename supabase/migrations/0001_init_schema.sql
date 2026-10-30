-- Tipid Tracker schema. Applied to Supabase project "tipid-tracker".
create table public.categories (
  slug text primary key,
  name text not null,
  icon text,
  sort_order int not null default 0
);

create table public.sale_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  description text,
  check (ends_on >= starts_on)
);

-- promo_start/promo_end = when you can buy; valid_start/valid_end = when you can use it (e.g. travel period)
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  merchant text not null,
  category_slug text not null references public.categories(slug),
  sale_event_id uuid references public.sale_events(id) on delete set null,
  price numeric(12,2),
  original_price numeric(12,2),
  discount_pct numeric(5,2) generated always as (
    case when original_price > 0 and price is not null
      then round((1 - price / original_price) * 100, 2) end
  ) stored,
  promo_code text,
  promo_start date,
  promo_end date,
  valid_start date,
  valid_end date,
  url text not null,
  image_url text,
  source text not null check (source in ('shopee','lazada','involve_asia','airline','bank','reddit','user','sample')),
  source_ref text,
  credit text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_ref)
);
create index deals_category_idx on public.deals (category_slug);
create index deals_promo_end_idx on public.deals (promo_end);
create index deals_promo_start_idx on public.deals (promo_start);
create index deals_sale_event_idx on public.deals (sale_event_id);

-- Community submissions wait here for review; they never appear on the site directly.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 200),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  category_slug text references public.categories(slug),
  merchant text check (char_length(merchant) <= 100),
  price numeric(12,2),
  promo_end date,
  notes text check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.sale_events enable row level security;
alter table public.deals enable row level security;
alter table public.submissions enable row level security;

-- Visitors can read the catalog; only the backend (service role) can write it.
create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "public read sale events" on public.sale_events for select to anon, authenticated using (true);
create policy "public read deals" on public.deals for select to anon, authenticated using (true);
-- Visitors can submit deals for review but cannot read submissions back.
create policy "anyone can submit pending deals" on public.submissions for insert to anon, authenticated
  with check (status = 'pending');
