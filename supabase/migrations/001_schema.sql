-- Ejecutar primero en el SQL Editor de un proyecto Supabase nuevo.
begin;
create table public.business (
 id boolean primary key default true check (id),
 name text not null check (length(trim(name)) between 1 and 120),
 legal_name text not null default '' check (length(legal_name)<=120),
 nit text not null default '' check (length(nit)<=120),
 address text not null default '' check (length(address)<=250),
 branch_address text not null default '' check (length(branch_address)<=250),
 city text not null default 'La Paz' check (length(trim(city)) between 1 and 120),
 phone text not null default '' check (length(phone)<=120),
 email text not null default '' check (length(email)<=120),
 version integer not null default 1 check (version>0)
);
insert into public.business(name) values ('Licorería La Cava');
create table public.products (
 id text primary key default ('PR-' || gen_random_uuid()::text),
 name text not null check (length(trim(name)) between 1 and 120),
 category text not null check (category in ('Cervezas','Vinos','Singanis','Whiskies','Vodkas','Rones','Sin alcohol')),
 size text not null check (length(trim(size)) between 1 and 80),
 price numeric(14,2) not null check (price>=0 and price<>'NaN'::numeric),
 cost numeric(14,2) not null check (cost>=0 and cost<>'NaN'::numeric),
 stock integer not null default 0 check (stock>=0),
 min integer not null default 0 check (min>=0),
 color text not null default '#9c784d' check (color ~ '^#[0-9a-fA-F]{6}$'),
 version integer not null default 1 check (version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.sales (
 id text primary key default ('V-' || gen_random_uuid()::text),
 date timestamptz not null default now(),
 method text not null check (method in ('QR','Efectivo','Tarjeta')),
 total numeric(16,2) not null check (total>=0 and total<>'NaN'::numeric)
);
create table public.sale_items (
 sale_id text not null references public.sales(id),
 product_id text not null references public.products(id),
 name text not null,
 quantity integer not null check (quantity>0),
 price numeric(14,2) not null check (price>=0 and price<>'NaN'::numeric),
 cost numeric(14,2) not null check (cost>=0 and cost<>'NaN'::numeric),
 primary key (sale_id,product_id)
);
create table public.purchases (
 id text primary key default ('C-' || gen_random_uuid()::text),
 date timestamptz not null,
 supplier text not null check (length(trim(supplier)) between 1 and 120),
 reference text not null default '' check (length(reference)<=80),
 notes text not null default '' check (length(notes)<=500),
 total numeric(16,2) not null check (total>=0 and total<>'NaN'::numeric),
 created_at timestamptz not null default now()
);
create table public.purchase_items (
 purchase_id text not null references public.purchases(id),
 product_id text not null references public.products(id),
 name text not null,
 quantity integer not null check (quantity>0),
 cost numeric(14,2) not null check (cost>=0 and cost<>'NaN'::numeric),
 primary key (purchase_id,product_id)
);
-- Historial de movimientos: recepciones, ventas y ajustes manuales del inventario.
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 product_id text not null references public.products(id),
 quantity integer not null check (quantity<>0),
 reason text not null check (reason in ('opening','adjustment','sale','purchase')),
 sale_id text references public.sales(id),
 purchase_id text references public.purchases(id),
 created_at timestamptz not null default now()
);
-- Conserva la identidad y el contenido de cada comando para reintentos seguros.
create table public.command_receipts (
 id uuid primary key,
 action text not null,
 payload jsonb not null,
 result_id text,
 created_at timestamptz not null default now()
);
create index sales_date_idx on public.sales(date desc);
create index purchases_date_idx on public.purchases(date desc);
create index sale_items_product_idx on public.sale_items(product_id);
create index purchase_items_product_idx on public.purchase_items(product_id);
create index stock_movements_product_date_idx on public.stock_movements(product_id,created_at desc);

-- Sin políticas públicas: ningún cliente anon/authenticated puede acceder directamente.
-- El Worker usa service_role; al añadir Auth se revisarán las políticas y la API.
alter table public.business enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.command_receipts enable row level security;
revoke all on public.business,public.products,public.sales,public.sale_items,public.purchases,public.purchase_items,public.stock_movements,public.command_receipts from anon,authenticated;
grant select,insert,update on public.business,public.products,public.sales,public.sale_items,public.purchases,public.purchase_items,public.stock_movements,public.command_receipts to service_role;
commit;
