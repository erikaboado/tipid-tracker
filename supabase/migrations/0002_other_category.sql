-- Fallback category for feed deals (e.g. Involve Asia "Marketplace" offers) that don't fit the others.
insert into public.categories (slug, name, icon, sort_order)
values ('other', 'Other Deals', '🏷️', 99)
on conflict (slug) do nothing;
