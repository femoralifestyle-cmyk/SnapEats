-- SnapEats customer accounts, order tracking and loyalty migration.
-- Run once in Supabase SQL Editor after the original 0001_momosip.sql.

-- Customers are a first-class profile role.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('super_admin','staff','customer'));
alter table public.profiles add column if not exists phone text;

-- Link customer orders to the authenticated account and support delivery.
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add constraint orders_order_type_check
  check (order_type in ('takeaway','dine_in','on_site_delivery'));
create index if not exists orders_customer_id_idx on public.orders(customer_id, created_at desc);

-- A private, customer-owned loyalty balance. Each completed customer order of ₹350 or more earns 1 point AND 1 stamp.
create table if not exists public.customer_rewards (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  stamps integer not null default 0 check (stamps >= 0),
  free_momos integer not null default 0 check (free_momos >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_reward_credits (
  order_id uuid primary key references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  points_awarded integer not null default 0,
  stamp_awarded boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  redemption_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
  reward_name text not null default 'Free Momos portion',
  status text not null default 'reserved' check (status in ('reserved','redeemed','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.customer_rewards enable row level security;
alter table public.order_reward_credits enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "Customers view own rewards" on public.customer_rewards;
create policy "Customers view own rewards" on public.customer_rewards
  for select to authenticated using (customer_id=auth.uid() or public.is_super_admin());
drop policy if exists "Staff view rewards" on public.customer_rewards;
create policy "Staff view rewards" on public.customer_rewards
  for select to authenticated using (public.is_active_staff());

drop policy if exists "Customers view own reward credits" on public.order_reward_credits;
create policy "Customers view own reward credits" on public.order_reward_credits
  for select to authenticated using (customer_id=auth.uid() or public.is_active_staff());

drop policy if exists "Customers view own redemptions" on public.reward_redemptions;
create policy "Customers view own redemptions" on public.reward_redemptions
  for select to authenticated using (customer_id=auth.uid() or public.is_active_staff());
-- No direct client writes to reward balances, credits, or redemption rows.

-- Customers can only read their own orders. Staff retain their existing access.
drop policy if exists "Customers view own orders" on public.orders;
create policy "Customers view own orders" on public.orders
  for select to authenticated using (customer_id=auth.uid() or public.is_active_staff());
drop policy if exists "Customers view own order items" on public.order_items;
create policy "Customers view own order items" on public.order_items
  for select to authenticated using (
    exists(select 1 from public.orders o where o.id=order_id and
      (o.customer_id=auth.uid() or public.is_active_staff()))
  );

-- Customer profile creation is triggered by Supabase Auth. Never trust a role
-- supplied in user metadata: all public signups become customers.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,email,full_name,phone,role)
  values(new.id,new.email,
    left(coalesce(new.raw_user_meta_data->>'full_name',''),80),
    left(coalesce(new.raw_user_meta_data->>'phone',''),20),
    'customer')
  on conflict(id) do update set email=excluded.email;
  insert into public.customer_rewards(customer_id) values(new.id)
  on conflict(customer_id) do nothing;
  return new;
end;
$$;

-- Award once only, when an order first reaches completed.
create or replace function public.award_order_rewards()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_points integer;
begin
  if new.status='completed' and old.status is distinct from 'completed'
     and new.customer_id is not null
     and not exists(select 1 from public.order_reward_credits where order_id=new.id) then
    -- 1 point and 1 stamp together for each completed order of ₹350 or more.
    v_points := case when coalesce(new.total,0) >= 350 then 1 else 0 end;
    insert into public.customer_rewards(customer_id,points,stamps,free_momos)
      values(new.customer_id,v_points,v_points,0)
      on conflict(customer_id) do update set
        points=public.customer_rewards.points+excluded.points,
        stamps=public.customer_rewards.stamps+excluded.stamps,
        free_momos=public.customer_rewards.free_momos+
          floor((public.customer_rewards.stamps+excluded.stamps)/10)-
          floor(public.customer_rewards.stamps/10),
        updated_at=now();
    insert into public.order_reward_credits(order_id,customer_id,points_awarded,stamp_awarded)
      values(new.id,new.customer_id,v_points,(v_points=1))
      on conflict(order_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists order_completed_rewards on public.orders;
create trigger order_completed_rewards after update of status on public.orders
for each row execute function public.award_order_rewards();

-- A redemption reserves one earned free portion and returns a code for staff.
create or replace function public.redeem_free_momos()
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_code text;
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles where id=auth.uid() and role='customer' and is_active=true
  ) then raise exception 'Customer sign-in required.'; end if;
  update public.customer_rewards set free_momos=free_momos-1,updated_at=now()
    where customer_id=auth.uid() and free_momos>0;
  if not found then raise exception 'No free Momos reward is available.'; end if;
  insert into public.reward_redemptions(customer_id)
    values(auth.uid()) returning redemption_code into v_code;
  return jsonb_build_object('code',v_code,'reward','Free Momos portion');
end;
$$;
revoke all on function public.redeem_free_momos() from public;
grant execute on function public.redeem_free_momos() to authenticated;

-- Replace the order RPC with an authenticated customer/staff version.
create or replace function public.place_order(order_data jsonb)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_name text;
  v_phone text;
  v_type text;
  v_notes text;
  v_customer_id uuid;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Please sign in to place an order.'; end if;
  select role into v_role from public.profiles where id=auth.uid() and is_active=true;
  if v_role is null or v_role not in ('customer','staff','super_admin') then raise exception 'This account is not active.'; end if;
  v_customer_id := case when v_role='customer' then auth.uid() else null end;
  v_name := nullif(trim(order_data->>'customer_name'),'');
  if v_name is null then
    select full_name into v_name from public.profiles where id=auth.uid();
  end if;
  if v_name is null then raise exception 'Customer name is required.'; end if;
  v_phone := nullif(trim(order_data->>'customer_phone'),'');
  if v_phone is null then
    select phone into v_phone from public.profiles where id=auth.uid();
  end if;
  v_type := coalesce(order_data->>'order_type','takeaway');
  if v_type not in ('takeaway','dine_in','on_site_delivery') then raise exception 'Invalid order type.'; end if;
  v_notes := left(coalesce(order_data->>'notes',''),500);
  if jsonb_typeof(order_data->'items') <> 'array' or jsonb_array_length(order_data->'items')=0 then
    raise exception 'Add at least one item.';
  end if;
  insert into public.orders(customer_name,customer_phone,customer_id,order_type,notes,created_by)
    values(v_name,v_phone,v_customer_id,v_type,v_notes,auth.uid())
    returning id,order_number into v_order_id,v_order_number;
  for v_item in select * from jsonb_array_elements(order_data->'items') loop
    select * into v_product from public.products
      where id=(v_item->>'product_id')::uuid and is_available=true;
    if not found then raise exception 'One of the selected products is unavailable.'; end if;
    v_qty := greatest(1,least(99,(v_item->>'quantity')::int));
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
      values(v_order_id,v_product.id,v_product.name,v_product.price,v_qty,v_product.price*v_qty);
    v_subtotal := v_subtotal + v_product.price*v_qty;
  end loop;
  if v_type='on_site_delivery' and v_subtotal < 150 then
    raise exception 'On-Site Delivery requires a minimum order value of ₹150.';
  end if;
  update public.orders set subtotal=v_subtotal,total=v_subtotal where id=v_order_id;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'total',v_subtotal);
end;
$$;
revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;

-- Staff can mark a reserved free-portion claim as handed over.
create or replace function public.mark_reward_redeemed(redemption_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_active_staff() then raise exception 'Staff access required.'; end if;
  update public.reward_redemptions set status='redeemed'
    where id=redemption_id and status='reserved';
  if not found then raise exception 'Reward claim was not found or is already processed.'; end if;
end;
$$;
revoke all on function public.mark_reward_redeemed(uuid) from public;
grant execute on function public.mark_reward_redeemed(uuid) to authenticated;

-- Enable realtime updates for customer order status if not already enabled.
do $$ begin
  alter publication supabase_realtime add table public.customer_rewards;
exception when duplicate_object then null;
end $$;
