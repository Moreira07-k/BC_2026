# BC Bom Feito — integração Site ↔ Painel

## 1. Banco de dados
No Supabase, abra **SQL Editor > New query**, cole o conteúdo completo de `supabase/schema.sql` e execute.

O script cria/atualiza:
- catálogo de produtos com `image_url`;
- clientes sem restrição indevida por nome repetido;
- pedidos públicos registrados de forma controlada;
- reserva/baixa de estoque e devolução automática quando um pedido é cancelado;
- funções RPC usadas pelo site e pelo painel.

## 2. Variáveis de ambiente
Crie um `.env` local a partir de `.env.example`:

```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave_anon_public
```

No Vercel/serviço de hospedagem, cadastre as mesmas duas variáveis no ambiente de produção e faça um novo deploy.

## 3. Instalação e build
O pacote entregue **não inclui `node_modules`**. Isso é intencional: a pasta anterior estava quebrada/incompleta.

```bash
npm install
npm run build
```

## 4. Fluxo implementado

```text
Site público
  ↓
Carrinho → Cliente → Frete → Pagamento
  ↓
create_public_order()
  ↓
Supabase: customers + orders + estoque
  ↓
Painel Admin: Pedidos + Clientes + Produtos
  ↓
WhatsApp com número do pedido
```

## 5. Frete
- Floriano/PI: **R$ 3,00**
- Barão de Grajaú/MA: **R$ 4,00**
