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

-- ════════════════════════════════════════════════════════════════════════
-- FASE FINAL — configurações, galeria, pagamento, histórico e segurança
-- Pode rodar este bloco quantas vezes quiser: tudo é idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) SEGURANÇA: quem pode ser administrador ─────────────────────────────
-- Antes, qualquer usuário autenticado no Supabase tinha acesso total ao
-- Admin. Agora só quem estiver nesta tabela.
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text
);
alter table admin_users enable row level security;
drop policy if exists "admin le sua propria linha" on admin_users;
create policy "admin le sua propria linha" on admin_users
  for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- IMPORTANTE — depois de rodar este script, cadastre os administradores
-- (você e a proprietária), ou ninguém vai conseguir ler/gravar nada no
-- Admin (o login continua funcionando, mas todas as telas ficarão vazias).
-- Troque o e-mail pelo já usado no login do Admin e rode para cada um:
--
--   insert into admin_users (user_id, email)
--   select id, email from auth.users where email = 'seuemail@exemplo.com'
--   on conflict (user_id) do nothing;

-- Substitui as políticas antigas (baseadas em "qualquer autenticado") pelas
-- novas, baseadas em admin_users.
drop policy if exists "admin acesso total produtos" on products;
create policy "admin acesso total produtos" on products
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin acesso total avaliacoes" on reviews;
create policy "admin acesso total avaliacoes" on reviews
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin acesso total clientes" on customers;
create policy "admin acesso total clientes" on customers
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin acesso total pedidos" on orders;
create policy "admin acesso total pedidos" on orders
  for all using (is_admin()) with check (is_admin());

-- ─── 2) CONFIGURAÇÕES (Admin → Supabase → Site público) ────────────────────
create table if not exists site_settings (
  id             integer primary key default 1,
  nome           text,
  whatsapp       text,
  instagram      text,
  email          text,
  horario        text,
  pix_key        text,
  frete_floriano numeric not null default 0,
  frete_barao    numeric not null default 0,
  slogans        text[] not null default '{}',
  constraint site_settings_singleton check (id = 1)
);

insert into site_settings (id, nome, whatsapp, instagram, email, horario, pix_key, frete_floriano, frete_barao, slogans)
values (
  1, 'BC Bom Feito Confeitaria', '(89) 99411-2439', 'bcconfeitaria_doces',
  'emillesilva879@gmail.com', 'Qua – Dom · 14h às 20h', 'ludmyla.emille1412@gmail.com',
  3.00, 4.00,
  array['Feito com carinho, servido em cada colher.','Transformando momentos em doces lembranças.','O sabor que abraça o coração.']
)
on conflict (id) do nothing;

alter table site_settings enable row level security;
drop policy if exists "public le configuracoes" on site_settings;
create policy "public le configuracoes" on site_settings
  for select using (true);
drop policy if exists "admin edita configuracoes" on site_settings;
create policy "admin edita configuracoes" on site_settings
  for all using (is_admin()) with check (is_admin());

-- ─── 3) GALERIA (Admin → Supabase Storage → Site público) ──────────────────
create table if not exists gallery_items (
  id         bigint primary key,
  name       text not null,
  category   text not null default 'produto',
  url        text not null,
  created_at timestamptz not null default now()
);
alter table gallery_items enable row level security;
drop policy if exists "public le galeria" on gallery_items;
create policy "public le galeria" on gallery_items
  for select using (true);
drop policy if exists "admin acesso total galeria" on gallery_items;
create policy "admin acesso total galeria" on gallery_items
  for all using (is_admin()) with check (is_admin());

-- Buckets de Storage para upload real de imagens (produtos e galeria).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

drop policy if exists "public le imagens de produtos" on storage.objects;
create policy "public le imagens de produtos" on storage.objects
  for select using (bucket_id = 'product-images');
drop policy if exists "admin escreve imagens de produtos" on storage.objects;
create policy "admin escreve imagens de produtos" on storage.objects
  for all using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());

drop policy if exists "public le imagens da galeria" on storage.objects;
create policy "public le imagens da galeria" on storage.objects
  for select using (bucket_id = 'gallery');
drop policy if exists "admin escreve imagens da galeria" on storage.objects;
create policy "admin escreve imagens da galeria" on storage.objects
  for all using (bucket_id = 'gallery' and is_admin())
  with check (bucket_id = 'gallery' and is_admin());

-- ─── 4) PAGAMENTO: pedido recebido ≠ pagamento recebido ────────────────────
alter table orders add column if not exists payment_status text not null default 'pendente';

-- ─── 5) HISTÓRICO DE STATUS DO PEDIDO ───────────────────────────────────────
-- Registrado automaticamente por trigger — funciona não importa por onde o
-- status seja alterado, sem depender de nenhum código específico do Admin.
create table if not exists order_status_log (
  id             bigserial primary key,
  order_id       text not null references orders(id) on delete cascade,
  status         text not null,
  payment_status text,
  changed_at     timestamptz not null default now()
);
alter table order_status_log enable row level security;
drop policy if exists "admin acesso total historico pedidos" on order_status_log;
create policy "admin acesso total historico pedidos" on order_status_log
  for all using (is_admin()) with check (is_admin());

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into order_status_log (order_id, status, payment_status)
    values (new.id, new.status, new.payment_status);
  elsif (tg_op = 'UPDATE') and
        (new.status is distinct from old.status or new.payment_status is distinct from old.payment_status) then
    insert into order_status_log (order_id, status, payment_status)
    values (new.id, new.status, new.payment_status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_order_status_change on orders;
create trigger trg_log_order_status_change
  after insert or update on orders
  for each row execute function public.log_order_status_change();

-- Reforça no próprio banco que só administrador reserva/libera estoque.
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
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores';
  end if;

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
