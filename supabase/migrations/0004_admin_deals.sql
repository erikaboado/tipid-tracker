-- Admins add, edit and delete deals by hand from the admin page.
-- Like approve_submission(), these functions run as the table owner so they can write public.deals,
-- which has no write policies for browser roles. Each one checks is_admin() first.

-- Hand-entered deals get their own source.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.deals'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%source%'
  loop
    execute format('alter table public.deals drop constraint %I', c);
  end loop;
end;
$$;
alter table public.deals add constraint deals_source_check
  check (source in ('shopee','lazada','involve_asia','airline','bank','reddit','user','sample','manual'));

-- Create a deal (p_id null) or update one. Returns the deal id.
-- Product photos come only from affiliate feeds, so there is no image parameter: new deals show the
-- category placeholder and edits keep whatever image a deal already has.
create function public.admin_save_deal(
  p_id uuid,
  p_title text,
  p_merchant text,
  p_category_slug text,
  p_url text,
  p_sale_event_id uuid default null,
  p_price numeric default null,
  p_original_price numeric default null,
  p_promo_code text default null,
  p_promo_start date default null,
  p_promo_end date default null,
  p_valid_start date default null,
  p_valid_end date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  deal_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change deals' using errcode = '42501';
  end if;

  if char_length(coalesce(btrim(p_title), '')) not between 5 and 200 then
    raise exception 'Title must be 5 to 200 characters' using errcode = '22023';
  end if;
  if coalesce(btrim(p_merchant), '') = '' then
    raise exception 'Store / brand is required' using errcode = '22023';
  end if;
  if p_category_slug is null then
    raise exception 'Category is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_url), '') !~* '^https?://' or char_length(btrim(p_url)) > 2000 then
    raise exception 'Link must start with http:// or https://' using errcode = '22023';
  end if;
  if char_length(p_promo_code) > 50 then
    raise exception 'Promo code is too long' using errcode = '22023';
  end if;
  if p_promo_end < p_promo_start then
    raise exception 'The promo end date is before its start date' using errcode = '22023';
  end if;
  if p_valid_end < p_valid_start then
    raise exception 'The valid / travel end date is before its start date' using errcode = '22023';
  end if;
  if p_price < 0 or p_original_price < 0 then
    raise exception 'Prices cannot be negative' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.deals (
      title, merchant, category_slug, url, sale_event_id, price, original_price, promo_code,
      promo_start, promo_end, valid_start, valid_end, source, source_ref
    ) values (
      btrim(p_title), btrim(p_merchant), p_category_slug, btrim(p_url), p_sale_event_id, p_price, p_original_price,
      nullif(btrim(p_promo_code), ''), p_promo_start, p_promo_end, p_valid_start, p_valid_end,
      'manual', gen_random_uuid()::text
    )
    returning id into deal_id;
  else
    update public.deals set
      title = btrim(p_title),
      merchant = btrim(p_merchant),
      category_slug = p_category_slug,
      url = btrim(p_url),
      sale_event_id = p_sale_event_id,
      price = p_price,
      original_price = p_original_price,
      promo_code = nullif(btrim(p_promo_code), ''),
      promo_start = p_promo_start,
      promo_end = p_promo_end,
      valid_start = p_valid_start,
      valid_end = p_valid_end,
      updated_at = now()
    where id = p_id
    returning id into deal_id;
    if deal_id is null then
      raise exception 'Deal not found' using errcode = 'P0002';
    end if;
  end if;

  return deal_id;
end;
$$;
revoke execute on function public.admin_save_deal(uuid, text, text, text, text, uuid, numeric, numeric, text, date, date, date, date) from public, anon;
grant execute on function public.admin_save_deal(uuid, text, text, text, text, uuid, numeric, numeric, text, date, date, date, date) to authenticated;

create function public.admin_delete_deal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete deals' using errcode = '42501';
  end if;
  delete from public.deals where id = p_id;
  if not found then
    raise exception 'Deal not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_delete_deal(uuid) from public, anon;
grant execute on function public.admin_delete_deal(uuid) to authenticated;

-- Remove every sample deal in one go. Returns how many were deleted.
create function public.admin_clear_sample_deals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete deals' using errcode = '42501';
  end if;
  delete from public.deals where is_sample;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.admin_clear_sample_deals() from public, anon;
grant execute on function public.admin_clear_sample_deals() to authenticated;
