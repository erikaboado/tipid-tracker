-- Categories and the 2026–27 sale calendar (real dates). Sample deals are marked is_sample = true.
insert into public.categories (slug, name, icon, sort_order) values
('groceries','Groceries','🛒',1),('fashion','Fashion','👕',2),('gadgets','Gadgets','📱',3),
('home','Home & Living','🏠',4),('travel','Flights & Travel','✈️',5),('food','Food Delivery','🍔',6),
('beauty','Beauty & Health','💄',7),('bank','Bank & E-wallet Promos','💳',8);

insert into public.sale_events (name, starts_on, ends_on, description) values
('Payday Sale (Kinsenas)','2026-11-15','2026-11-16','Mid-month payday promos'),
('11.11 Sale','2026-11-11','2026-11-11','Double-date mega sale'),
('Payday Sale (Katapusan)','2026-11-30','2026-12-01','End-of-month payday promos'),
('12.12 Sale','2026-12-12','2026-12-12','Double-date mega sale'),
('Payday Sale (Kinsenas)','2026-12-15','2026-12-16','Mid-month payday promos'),
('Christmas Sale','2026-12-18','2026-12-25','Holiday promos'),
('1.1 New Year Sale','2027-01-01','2027-01-01','Double-date mega sale');

-- To remove sample deals once real feeds are connected:
--   delete from public.deals where is_sample;
