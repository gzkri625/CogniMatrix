-- Esnaf Çarşı schema.
-- Security model:
--   * shops/products: anyone can read; only the shop's owner (auth.uid()) can write.
--   * orders: nobody inserts directly. Customers go through place_order(), which
--     prices every line from the products table, so a tampered browser cannot
--     change what is charged. Owners read their shop's orders and may change
--     only the status column. Payment columns are written only by the server
--     (service role) after iyzico confirms.
--   * A customer reads their own order via get_order(uuid); the random uuid is
--     the access key.

create table public.shops (
  slug text primary key
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60 and slug not in ('dukkan-ac', 'giris', 'api')),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  category text not null default 'Diğer',
  tagline text not null default '' check (length(tagline) <= 160),
  emoji text not null default '🏪' check (length(emoji) <= 8),
  color text not null default '#334155' check (color ~ '^#[0-9a-fA-F]{6}$'),
  owner_name text not null default '',
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  address text not null default '',
  district text not null default '',
  city text not null default 'İstanbul',
  hours text not null default '',
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  free_delivery_over numeric(10, 2) not null default 0 check (free_delivery_over >= 0),
  min_order numeric(10, 2) not null default 0 check (min_order >= 0),
  created_at timestamptz not null default now()
);
create index shops_owner_idx on public.shops (owner_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_slug text not null references public.shops (slug) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  description text not null default '' check (length(description) <= 300),
  price numeric(10, 2) not null check (price > 0),
  unit text not null check (unit in ('adet', 'kg', 'demet', 'paket', 'litre')),
  category text not null default '' check (length(category) <= 50),
  emoji text not null default '📦' check (length(emoji) <= 8),
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_shop_idx on public.products (shop_slug, created_at);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  shop_slug text not null references public.shops (slug) on delete cascade,
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  email text,
  address text not null default '',
  note text not null default '',
  fulfillment text not null check (fulfillment in ('teslimat', 'gel-al')),
  payment text not null check (payment in ('kapıda nakit', 'kapıda kart', 'havale', 'online kart')),
  lines jsonb not null,
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null,
  total numeric(10, 2) not null,
  status text not null default 'yeni'
    check (status in ('yeni', 'hazırlanıyor', 'yolda', 'teslim edildi', 'iptal')),
  online_state text check (online_state in ('bekliyor', 'ödendi', 'başarısız')),
  payment_id text,
  paid_amount numeric(10, 2),
  card text,
  payment_error text
);
create index orders_shop_idx on public.orders (shop_slug, created_at desc);

-- ---------------------------------------------------------------- RLS
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

create policy "shops are public" on public.shops for select using (true);
create policy "owner creates shop" on public.shops for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "owner updates shop" on public.shops for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes shop" on public.shops for delete to authenticated
  using (owner_id = (select auth.uid()));

-- slug and owner are fixed after creation
revoke update on public.shops from anon, authenticated;
grant update (name, category, tagline, emoji, color, owner_name, phone, address, district, city, hours,
              delivery_fee, free_delivery_over, min_order) on public.shops to authenticated;

create policy "products are public" on public.products for select using (true);
create policy "owner manages products" on public.products for all to authenticated
  using (exists (select 1 from public.shops s where s.slug = shop_slug and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.slug = shop_slug and s.owner_id = (select auth.uid())));

create policy "owner reads orders" on public.orders for select to authenticated
  using (exists (select 1 from public.shops s where s.slug = shop_slug and s.owner_id = (select auth.uid())));
create policy "owner updates order status" on public.orders for update to authenticated
  using (exists (select 1 from public.shops s where s.slug = shop_slug and s.owner_id = (select auth.uid())));

revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;

-- ---------------------------------------------------------------- place_order
create or replace function public.place_order(
  p_shop text,
  p_customer jsonb, -- {name, phone, email?, address?, note?, fulfillment, payment}
  p_items jsonb     -- [{product_id, qty}]
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
  v_item jsonb;
  v_product public.products;
  v_qty numeric;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_fee numeric;
  v_fulfillment text := p_customer ->> 'fulfillment';
  v_payment text := p_customer ->> 'payment';
  v_name text := btrim(coalesce(p_customer ->> 'name', ''));
  v_phone text := btrim(coalesce(p_customer ->> 'phone', ''));
  v_email text := nullif(btrim(coalesce(p_customer ->> 'email', '')), '');
  v_address text := btrim(coalesce(p_customer ->> 'address', ''));
  v_code text;
  v_order public.orders;
begin
  select * into v_shop from public.shops where slug = p_shop;
  if not found then raise exception 'Dükkan bulunamadı' using errcode = 'P0001'; end if;

  if v_name = '' or length(v_name) > 100 then raise exception 'Ad soyad gerekli' using errcode = 'P0001'; end if;
  if regexp_replace(v_phone, '\D', '', 'g') !~ '^[0-9]{10,15}$' then raise exception 'Geçerli bir telefon gerekli' using errcode = 'P0001'; end if;
  if v_fulfillment not in ('teslimat', 'gel-al') then raise exception 'Geçersiz teslimat türü' using errcode = 'P0001'; end if;
  if v_payment not in ('kapıda nakit', 'kapıda kart', 'havale', 'online kart') then raise exception 'Geçersiz ödeme türü' using errcode = 'P0001'; end if;
  if v_fulfillment = 'teslimat' and (v_address = '' or length(v_address) > 500) then raise exception 'Adres gerekli' using errcode = 'P0001'; end if;
  if v_payment = 'online kart' and (v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception 'Geçerli bir e-posta gerekli' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Sepet boş' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and shop_slug = p_shop;
    if not found then raise exception 'Ürün bulunamadı' using errcode = 'P0001'; end if;
    if not v_product.in_stock then raise exception '% tükendi', v_product.name using errcode = 'P0001'; end if;
    v_qty := (v_item ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1000
       or (v_product.unit in ('kg', 'litre') and v_qty % 0.5 <> 0)
       or (v_product.unit not in ('kg', 'litre') and v_qty % 1 <> 0) then
      raise exception 'Geçersiz miktar: %', v_product.name using errcode = 'P0001';
    end if;
    v_lines := v_lines || jsonb_build_object(
      'productId', v_product.id, 'name', v_product.name, 'unit', v_product.unit,
      'price', v_product.price, 'qty', v_qty);
    v_subtotal := v_subtotal + round(v_product.price * v_qty, 2);
  end loop;

  if v_subtotal < v_shop.min_order then
    raise exception 'Minimum sipariş tutarı % TL', v_shop.min_order using errcode = 'P0001';
  end if;

  v_fee := case
    when v_fulfillment = 'gel-al' then 0
    when v_shop.free_delivery_over > 0 and v_subtotal >= v_shop.free_delivery_over then 0
    else v_shop.delivery_fee end;

  loop
    -- 6 chars from an alphabet without look-alikes (0/O, 1/I)
    select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, shop_slug, customer_name, customer_phone, email, address, note,
                             fulfillment, payment, lines, subtotal, delivery_fee, total, online_state)
  values (v_code, p_shop, v_name, v_phone, v_email,
          case when v_fulfillment = 'teslimat' then v_address else '' end,
          left(btrim(coalesce(p_customer ->> 'note', '')), 300),
          v_fulfillment, v_payment, v_lines, v_subtotal, v_fee, v_subtotal + v_fee,
          case when v_payment = 'online kart' then 'bekliyor' end)
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.get_order(p_id uuid) returns public.orders
language sql stable security definer set search_path = '' as $$
  select * from public.orders where id = p_id;
$$;

-- Customer gives up on online payment and pays at the door instead.
create or replace function public.switch_to_cash(p_id uuid) returns public.orders
language sql security definer set search_path = '' as $$
  update public.orders
     set payment = 'kapıda nakit', online_state = null, payment_error = null
   where id = p_id and payment = 'online kart' and online_state in ('bekliyor', 'başarısız')
  returning *;
$$;

revoke execute on function public.place_order(text, jsonb, jsonb) from public;
revoke execute on function public.get_order(uuid) from public;
revoke execute on function public.switch_to_cash(uuid) from public;
grant execute on function public.place_order(text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;
grant execute on function public.switch_to_cash(uuid) to anon, authenticated;

-- live order feed in the shop panel
alter publication supabase_realtime add table public.orders;
