-- ════════════════════════════════════════════════════════════════════════
-- BC Bom Feito Confeitaria — schema do painel admin
-- Rode este script inteiro no Supabase: Dashboard > SQL Editor > New query
-- ════════════════════════════════════════════════════════════════════════

-- ─── TABELAS ───────────────────────────────────────────────────────────────
create table if not exists products (
  id           bigint primary key,
  name         text not null,
  tagline      text,
  description  text,
  price        numeric not null default 0,
  category     text,
  stock        integer not null default 0,
  active       boolean not null default true,
  bestseller   boolean not null default false,
  is_new       boolean not null default false,
  layers       text[] not null default '{}'
);

create table if not exists customers (
  id          bigint primary key,
  name        text not null unique,
  phone       text,
  email       text,
  city        text,
  orders      integer not null default 0,
  spent       numeric not null default 0,
  last_order  text,
  since       text
);

create table if not exists orders (
  id            text primary key,
  customer_id   bigint references customers(id) on delete set null,
  customer      text not null,
  phone         text,
  products      jsonb not null default '[]',
  address       text,
  city          text,
  delivery_type text not null default 'retirada',
  payment       text,
  frete         numeric not null default 0,
  subtotal      numeric not null default 0,
  total         numeric not null default 0,
  status        text not null default 'novo',
  date          text,
  time          text,
  notes         text,
  stock_reserved boolean not null default false
);

create table if not exists reviews (
  id        bigint primary key,
  name      text not null,
  rating    integer not null,
  comment   text,
  date      text,
  approved  boolean not null default false,
  pinned    boolean not null default false,
  response  text
);

-- ─── SEED: catálogo real de produtos ───────────────────────────────────────
insert into products (id, name, tagline, description, price, category, stock, active, bestseller, is_new, layers) values
  (1, 'Bombis',              'Bombom de Bis',     'Bombom de Bis banhado a ganache e brigadeiro branco.',                12, 'chocolate', 20, true, true,  false, array['Bis crocante','Ganache','Brigadeiro Branco']),
  (2, 'Bomuva',              'Bombom de Uva',     '4 camadas: uva, brigadeiro branco e 2 de ganache.',                   12, 'frutas',    15, true, false, false, array['Uva verde','Brigadeiro Branco','Ganache','Ganache']),
  (3, 'Oreo',                'Sabor Oreo',        '3 camadas: Oreo triturado, brigadeiro branco e ganache.',             12, 'especial',  18, true, true,  false, array['Oreo triturado','Brigadeiro Branco','Ganache']),
  (4, 'Mousse de Maracujá',  'Recorde de Vendas', '2 camadas de mousse de maracujá e 1 de brigadeirão.',                 12, 'mousse',    12, true, true,  false, array['Mousse de Maracujá','Mousse de Maracujá','Brigadeirão']),
  (5, 'Bombom Morango',      'O Queridinho',      '4 camadas: 2 de brigadeiro branco, brigadeiro tradicional e ganache.',12, 'frutas',    10, true, false, true,  array['Brigadeiro Branco','Brigadeiro Branco','Brigadeiro Tradicional','Ganache Meio Amargo']),
  (6, 'Morango Cravejado',   'Novidade no Pote',  'Morango cravejado no pote com 3 camadas irresistíveis.',              12, 'frutas',    15, true, false, true,  array['Brigadeiro de Ninho','Morango','Creme Branco com Caramelo'])
on conflict (id) do nothing;

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table products  enable row level security;
alter table customers enable row level security;
alter table orders    enable row level security;
alter table reviews   enable row level security;

-- Site público: só enxerga produtos ativos e avaliações já aprovadas.
create policy "public le produtos ativos" on products
  for select using (active = true);

create policy "public le avaliacoes aprovadas" on reviews
  for select using (approved = true);

-- Painel admin (usuário autenticado via Supabase Auth): acesso total.
create policy "admin acesso total produtos" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin acesso total avaliacoes" on reviews
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Qualquer visitante pode ENVIAR uma avaliação (fica pendente até o admin
-- aprovar) — mas nunca pode inserir já aprovada ou fixada, nem editar/apagar
-- avaliações existentes (isso continua exclusivo do admin, pela política acima).
create policy "publico envia avaliacao pendente" on reviews
  for insert with check (approved = false and pinned = false);

-- Clientes e pedidos são dados sensíveis: só o admin autenticado acessa,
-- nunca o site público.
create policy "admin acesso total clientes" on customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin acesso total pedidos" on orders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─── MELHORIAS DE INTEGRAÇÃO SITE → ADMIN ──────────────────────────────────
-- Imagem opcional administrável. O site mantém imagens locais como fallback
-- para os produtos atuais, sem mudar a identidade visual.
alter table products add column if not exists image_url text;
alter table orders add column if not exists stock_reserved boolean not null default false;

-- Nome não deve ser identificador único: duas pessoas podem ter o mesmo nome.
alter table customers drop constraint if exists customers_name_key;

-- O site público registra pedidos por uma única função controlada. Assim,
-- clientes e pedidos continuam protegidos por RLS e o navegador não precisa
-- receber permissão de leitura desses dados sensíveis.
create or replace function public.create_public_order(
  p_order_id text,
  p_customer_name text,
  p_phone text,
  p_email text,
  p_city text,
  p_products jsonb,
  p_address text,
  p_delivery_type text,
  p_payment text,
  p_frete numeric,
  p_subtotal numeric,
  p_total numeric,
  p_date text,
  p_time text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id bigint;
  v_now date := current_date;
  v_item jsonb;
  v_product_id bigint;
  v_qty integer;
begin
  if coalesce(length(trim(p_customer_name)), 0) < 2 then
    raise exception 'Nome do cliente é obrigatório';
  end if;
  if coalesce(length(regexp_replace(p_phone, '[^0-9]', '', 'g')), 0) < 10 then
    raise exception 'Telefone inválido';
  end if;
  if p_delivery_type not in ('entrega','retirada') then
    raise exception 'Forma de entrega inválida';
  end if;
  if p_payment not in ('PIX','Cartão','Dinheiro') then
    raise exception 'Forma de pagamento inválida';
  end if;
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'O pedido precisa ter produtos';
  end if;
  if coalesce(p_subtotal,0) < 0 or coalesce(p_frete,0) < 0 or coalesce(p_total,0) < 0 then
    raise exception 'Valores do pedido inválidos';
  end if;

  -- Serializa pedidos simultâneos do mesmo telefone para evitar clientes duplicados.
  perform pg_advisory_xact_lock(hashtext(regexp_replace(p_phone, '[^0-9]', '', 'g')));

  -- Reaproveita o cliente pelo telefone normalizado; nome pode se repetir.
  select id into v_customer_id
  from customers
  where regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
  order by id desc
  limit 1;

  if v_customer_id is null then
    v_customer_id := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
    insert into customers (id, name, phone, email, city, orders, spent, last_order, since)
    values (v_customer_id, trim(p_customer_name), trim(p_phone), nullif(trim(coalesce(p_email,'')),''), trim(coalesce(p_city,'')), 0, 0, '—', p_date);
  else
    update customers
      set name = trim(p_customer_name),
          phone = trim(p_phone),
          email = coalesce(nullif(trim(coalesce(p_email,'')),''), email),
          city = coalesce(nullif(trim(coalesce(p_city,'')),''), city)
    where id = v_customer_id;
  end if;

  -- Verifica estoque e existência dos produtos ativos antes de criar o pedido.
  for v_item in select * from jsonb_array_elements(p_products) loop
    v_product_id := nullif(v_item->>'productId','')::bigint;
    v_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1));
    if v_product_id is null then raise exception 'Produto inválido'; end if;
    if not exists (select 1 from products where id = v_product_id and active = true and stock >= v_qty) then
      raise exception 'Produto sem estoque ou indisponível';
    end if;
  end loop;

  insert into orders (id, customer_id, customer, phone, products, address, city, delivery_type, payment, frete, subtotal, total, status, date, time, notes, stock_reserved)
  values (trim(p_order_id), v_customer_id, trim(p_customer_name), trim(p_phone), p_products,
          trim(coalesce(p_address,'')), trim(coalesce(p_city,'')), p_delivery_type, p_payment,
          coalesce(p_frete,0), coalesce(p_subtotal,0), coalesce(p_total,0), 'novo', p_date, p_time,
          trim(coalesce(p_notes,'')), true);

  -- Reserva/baixa o estoque no momento em que o pedido é registrado.
  for v_item in select * from jsonb_array_elements(p_products) loop
    v_product_id := (v_item->>'productId')::bigint;
    v_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1));
    update products set stock = stock - v_qty where id = v_product_id;
  end loop;

  update customers
    set orders = orders + 1,
        spent = spent + coalesce(p_total,0),
        last_order = p_date
  where id = v_customer_id;

  return jsonb_build_object('order_id', trim(p_order_id), 'customer_id', v_customer_id);
exception
  when unique_violation then
    raise exception 'Não foi possível registrar o pedido. Tente novamente.';
end;
$$;

revoke all on function public.create_public_order(text,text,text,text,text,jsonb,text,text,text,numeric,numeric,numeric,text,text,text) from public;
grant execute on function public.create_public_order(text,text,text,text,text,jsonb,text,text,text,numeric,numeric,numeric,text,text,text) to anon, authenticated;


create or replace function public.set_order_stock_reservation(p_order_id text, p_reserved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item jsonb;
  v_product_id bigint;
  v_qty integer;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.stock_reserved = p_reserved then return; end if;

  if p_reserved then
    for v_item in select * from jsonb_array_elements(v_order.products) loop
      v_product_id := nullif(v_item->>'productId','')::bigint;
      v_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1));
      if v_product_id is null or not exists (select 1 from products where id=v_product_id and active=true and stock>=v_qty) then
        raise exception 'Estoque insuficiente para reativar o pedido';
      end if;
    end loop;
    for v_item in select * from jsonb_array_elements(v_order.products) loop
      v_product_id := (v_item->>'productId')::bigint;
      v_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1));
      update products set stock=stock-v_qty where id=v_product_id;
    end loop;
  else
    for v_item in select * from jsonb_array_elements(v_order.products) loop
      v_product_id := nullif(v_item->>'productId','')::bigint;
      v_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1));
      if v_product_id is not null then update products set stock=stock+v_qty where id=v_product_id; end if;
    end loop;
  end if;
  update orders set stock_reserved=p_reserved where id=p_order_id;
end;
$$;

revoke all on function public.set_order_stock_reservation(text,boolean) from public;
grant execute on function public.set_order_stock_reservation(text,boolean) to authenticated;
