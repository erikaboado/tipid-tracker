-- Admin review of community submissions.
-- Admins are Supabase Auth users listed in public.admins. They can read and edit submissions,
-- reject them, and approve them through approve_submission(), which is the only path from a
-- submission into public.deals. No service-role key is ever needed in the browser.

-- Who is an admin. Rows are added by hand in the SQL editor (see README "Admin access").
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies: the browser cannot read or change this table. Use is_admin() instead.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Let submitters (and admins while reviewing) give both date ranges plus the usual deal extras.
alter table public.submissions
  add column promo_start date,
  add column valid_start date,
  add column valid_end date,
  add column original_price numeric(12,2),
  add column promo_code text check (char_length(promo_code) <= 50),
  add column image_url text check (image_url ~* '^https?://' and char_length(image_url) <= 2000),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column deal_id uuid references public.deals(id) on delete set null,
  add constraint submissions_promo_range check (promo_end >= promo_start),
  add constraint submissions_valid_range check (valid_end >= valid_start);
create index submissions_status_idx on public.submissions (status, created_at);

-- Public inserts can't pre-fill review fields.
drop policy "anyone can submit pending deals" on public.submissions;
create policy "anyone can submit pending deals" on public.submissions for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and reviewed_by is null and deal_id is null);

create policy "admins read submissions" on public.submissions for select to authenticated
  using ((select public.is_admin()));
-- Admins can fix up fields and reject. Approving must go through approve_submission() so a deal gets created.
create policy "admins update submissions" on public.submissions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and status in ('pending', 'rejected') and deal_id is null);

-- Stamp who reviewed a submission and when, whenever its status changes.
create function public.stamp_submission_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := case when new.status = 'pending' then null else now() end;
    new.reviewed_by := case when new.status = 'pending' then null else auth.uid() end;
  end if;
  return new;
end;
$$;
create trigger submissions_stamp_review
  before update on public.submissions
  for each row execute function public.stamp_submission_review();

-- Approve a pending submission: save the reviewed fields on the submission, create the deal,
-- and mark the submission approved, all in one transaction. Runs as the table owner so it can
-- write public.deals, which has no write policies for browser roles.
create function public.approve_submission(
  p_id uuid,
  p_title text,
  p_merchant text,
  p_category_slug text,
  p_url text,
  p_price numeric default null,
  p_original_price numeric default null,
  p_promo_code text default null,
  p_promo_start date default null,
  p_promo_end date default null,
  p_valid_start date default null,
  p_valid_end date default null,
  p_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.submissions;
  new_deal_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve submissions' using errcode = '42501';
  end if;

  select * into s from public.submissions where id = p_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if s.status <> 'pending' then
    raise exception 'Submission is already %', s.status using errcode = '22023';
  end if;

  if coalesce(btrim(p_merchant), '') = '' then
    raise exception 'Store / brand is required' using errcode = '22023';
  end if;
  if p_category_slug is null then
    raise exception 'Category is required' using errcode = '22023';
  end if;

  -- Keep the submission in sync with what was published (its checks validate the values).
  update public.submissions set
    title = btrim(p_title),
    merchant = btrim(p_merchant),
    category_slug = p_category_slug,
    url = btrim(p_url),
    price = p_price,
    original_price = p_original_price,
    promo_code = nullif(btrim(p_promo_code), ''),
    promo_start = p_promo_start,
    promo_end = p_promo_end,
    valid_start = p_valid_start,
    valid_end = p_valid_end,
    image_url = nullif(btrim(p_image_url), '')
  where id = p_id
  returning * into s;

  insert into public.deals (
    title, merchant, category_slug, url, price, original_price, promo_code,
    promo_start, promo_end, valid_start, valid_end, image_url, source, source_ref, credit
  ) values (
    s.title, s.merchant, s.category_slug, s.url, s.price, s.original_price, s.promo_code,
    s.promo_start, s.promo_end, s.valid_start, s.valid_end, s.image_url, 'user', s.id::text,
    'Shared by the community'
  )
  returning id into new_deal_id;

  update public.submissions set status = 'approved', deal_id = new_deal_id where id = p_id;
  return new_deal_id;
end;
$$;
revoke execute on function public.approve_submission(uuid, text, text, text, text, numeric, numeric, text, date, date, date, date, text) from public, anon;
grant execute on function public.approve_submission(uuid, text, text, text, text, numeric, numeric, text, date, date, date, date, text) to authenticated;
