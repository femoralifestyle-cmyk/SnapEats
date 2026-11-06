-- SnapEats advanced operations migration. Run after 0001 and 0002.
create extension if not exists pgcrypto;

create table if not exists public.restaurant_branches (
 id uuid primary key default gen_random_uuid(), name text not null, address text, phone text,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.delivery_partners (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete set null,
 full_name text not null, phone text not null, vehicle_number text, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.orders add column if not exists branch_id uuid references public.restaurant_branches(id);
alter table public.orders add column if not exists delivery_partner_id uuid references public.delivery_partners(id);
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_lat double precision;
alter table public.orders add column if not exists delivery_lng double precision;

create table if not exists public.payment_transactions (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 provider text not null default 'razorpay', provider_order_id text unique, provider_payment_id text unique,
 amount_paise bigint not null check(amount_paise>0), currency text not null default 'INR',
 status text not null default 'created' check(status in ('created','authorized','captured','failed','refunded')),
 created_at timestamptz not null default now()
);
create table if not exists public.delivery_locations (
 id bigint generated always as identity primary key, order_id uuid not null references public.orders(id) on delete cascade,
 partner_id uuid references public.delivery_partners(id) on delete set null, latitude double precision not null,
 longitude double precision not null, accuracy_m numeric, recorded_at timestamptz not null default now()
);
create index if not exists delivery_locations_order_time_idx on public.delivery_locations(order_id,recorded_at desc);
create table if not exists public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 discount_type text not null check(discount_type in ('percent','fixed')),
 discount_value numeric(10,2) not null check(discount_value>0), min_order numeric(10,2) not null default 0,
 max_discount numeric(10,2), usage_limit integer, used_count integer not null default 0,
 starts_at timestamptz, expires_at timestamptz, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.coupon_redemptions (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id),
 customer_id uuid references auth.users(id) on delete set null, order_id uuid references public.orders(id) on delete set null,
 discount_amount numeric(10,2) not null default 0, created_at timestamptz not null default now(), unique(coupon_id,order_id)
);
create table if not exists public.product_reviews (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade, order_id uuid references public.orders(id) on delete set null,
 rating integer not null check(rating between 1 and 5), review text, is_published boolean not null default false,
 created_at timestamptz not null default now(), unique(product_id,customer_id,order_id)
);
create table if not exists public.inventory_items (
 id uuid primary key default gen_random_uuid(), branch_id uuid references public.restaurant_branches(id) on delete cascade,
 product_id uuid references public.products(id) on delete cascade, item_name text not null,
 quantity numeric(12,3) not null default 0 check(quantity>=0), unit text not null default 'pcs',
 low_stock_threshold numeric(12,3) not null default 5, updated_at timestamptz not null default now()
);
create table if not exists public.inventory_movements (
 id uuid primary key default gen_random_uuid(), inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
 movement_type text not null check(movement_type in ('in','out','adjustment')),
 quantity numeric(12,3) not null check(quantity>0), note text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.referral_codes (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null unique references auth.users(id) on delete cascade,
 code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,10)), created_at timestamptz not null default now()
);
create table if not exists public.referral_uses (
 id uuid primary key default gen_random_uuid(), referrer_id uuid not null references auth.users(id),
 referred_id uuid not null unique references auth.users(id), order_id uuid references public.orders(id),
 reward_status text not null default 'pending', created_at timestamptz not null default now(), check(referrer_id<>referred_id)
);
create table if not exists public.site_settings (
 key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
insert into public.site_settings(key,value) values('brand', '{"name":"SnapEats","logo_url":null}'::jsonb) on conflict(key) do nothing;

-- Public read only for active branches, published reviews and brand identity.
alter table public.restaurant_branches enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.delivery_locations enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.product_reviews enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_uses enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists branch_public_read on public.restaurant_branches;
create policy branch_public_read on public.restaurant_branches for select to anon,authenticated using(is_active=true);
drop policy if exists branch_admin_all on public.restaurant_branches;
create policy branch_admin_all on public.restaurant_branches for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists delivery_partner_self_read on public.delivery_partners;
create policy delivery_partner_self_read on public.delivery_partners for select to authenticated using(user_id=auth.uid() or public.is_active_staff());
drop policy if exists delivery_partner_admin_all on public.delivery_partners;
create policy delivery_partner_admin_all on public.delivery_partners for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists payment_owner_read on public.payment_transactions;
create policy payment_owner_read on public.payment_transactions for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_active_staff())));
drop policy if exists delivery_location_read on public.delivery_locations;
create policy delivery_location_read on public.delivery_locations for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_active_staff())));
drop policy if exists delivery_location_partner_insert on public.delivery_locations;
create policy delivery_location_partner_insert on public.delivery_locations for insert to authenticated with check(exists(select 1 from public.delivery_partners d where d.id=partner_id and d.user_id=auth.uid() and d.is_active));
drop policy if exists coupon_public_read on public.coupons;
create policy coupon_public_read on public.coupons for select to anon,authenticated using(is_active=true and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now()));
drop policy if exists coupon_admin_all on public.coupons;
create policy coupon_admin_all on public.coupons for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists review_public_read on public.product_reviews;
create policy review_public_read on public.product_reviews for select to anon,authenticated using(is_published=true);
drop policy if exists review_customer_insert on public.product_reviews;
create policy review_customer_insert on public.product_reviews for insert to authenticated with check(customer_id=auth.uid());
drop policy if exists review_admin_update on public.product_reviews;
create policy review_admin_update on public.product_reviews for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists inventory_staff_read on public.inventory_items;
create policy inventory_staff_read on public.inventory_items for select to authenticated using(public.is_active_staff());
drop policy if exists inventory_admin_write on public.inventory_items;
create policy inventory_admin_write on public.inventory_items for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists inventory_movements_staff_read on public.inventory_movements;
create policy inventory_movements_staff_read on public.inventory_movements for select to authenticated using(public.is_active_staff());
drop policy if exists inventory_movements_admin_write on public.inventory_movements;
create policy inventory_movements_admin_write on public.inventory_movements for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists referral_code_self_read on public.referral_codes;
create policy referral_code_self_read on public.referral_codes for select to authenticated using(customer_id=auth.uid());
drop policy if exists referral_uses_self_read on public.referral_uses;
create policy referral_uses_self_read on public.referral_uses for select to authenticated using(referrer_id=auth.uid() or referred_id=auth.uid());
drop policy if exists site_brand_public_read on public.site_settings;
create policy site_brand_public_read on public.site_settings for select to anon,authenticated using(key='brand');
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

-- Only server-side service-role functions may write payment state or referral rewards.
revoke all on public.payment_transactions from anon,authenticated;
revoke all on public.coupon_redemptions from anon,authenticated;

-- Storage bucket for administrator-managed brand assets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('snapeats-assets','snapeats-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do nothing;
drop policy if exists snapeats_logo_public_read on storage.objects;
create policy snapeats_logo_public_read on storage.objects for select to anon,authenticated using(bucket_id='snapeats-assets');
drop policy if exists snapeats_logo_admin_upload on storage.objects;
create policy snapeats_logo_admin_upload on storage.objects for insert to authenticated with check(bucket_id='snapeats-assets' and public.is_super_admin());
drop policy if exists snapeats_logo_admin_update on storage.objects;
create policy snapeats_logo_admin_update on storage.objects for update to authenticated using(bucket_id='snapeats-assets' and public.is_super_admin()) with check(bucket_id='snapeats-assets' and public.is_super_admin());
drop policy if exists snapeats_logo_admin_delete on storage.objects;
create policy snapeats_logo_admin_delete on storage.objects for delete to authenticated using(bucket_id='snapeats-assets' and public.is_super_admin());

-- Realtime delivery position updates.
do $$ begin alter publication supabase_realtime add table public.delivery_locations; exception when duplicate_object then null; end $$;
