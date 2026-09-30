# BC Bom Feito Confeitaria

Site institucional e catálogo online da BC Bom Feito Confeitaria, com recursos para pedidos, cadastro de clientes e gerenciamento interno.

## Sobre

O projeto foi desenvolvido para centralizar a operação da confeitaria em uma única aplicação.

O site público apresenta os produtos, recebe os dados necessários para o pedido e encaminha a finalização para o WhatsApp. O painel administrativo permite acompanhar produtos, estoque, pedidos, clientes, avaliações e conteúdo da loja.

Os dados são armazenados no Supabase, que funciona como fonte principal da aplicação.

## Principais recursos

### Site

- Catálogo de produtos
- Busca e filtros
- Carrinho
- Cadastro de informações do cliente
- Entrega e retirada
- Formas de pagamento
- Controle de disponibilidade e estoque
- Promoções
- Avaliações
- Galeria de produtos
- Atendimento pelo WhatsApp
- Layout responsivo

### Painel administrativo

- Dashboard
- Cadastro e edição de produtos
- Controle de preços
- Promoções
- Estoque
- Pedidos
- Clientes
- Avaliações
- Galeria
- Configurações da loja
- Controle de acesso administrativo
- Histórico de alterações de pedidos

## Tecnologias

- React
- TypeScript
- Vite
- Tailwind CSS
- Motion
- Lucide React
- Supabase
- PostgreSQL
- Supabase Storage
- Vercel
- GitHub

## Estrutura

```text
BC_2026/
├── src/
│   ├── app/
│   │   ├── components/
│   │   ├── Admin.tsx
│   │   ├── App.tsx
│   │   ├── siteData.ts
│   │   └── whatsapp.ts
│   ├── imports/
│   └── lib/
├── supabase/
│   └── schema.sql
├── public/
├── .github/
├── .env.example
├── SUPABASE_SETUP.md
└── README.md
```

## Dados e integração

A aplicação utiliza o Supabase para manter os dados do catálogo e da operação.

Entre as principais tabelas estão:

- `products`
- `customers`
- `orders`
- `reviews`
- `gallery_items`
- `site_settings`
- `admin_users`
- `order_status_log`

As operações públicas relacionadas a clientes, pedidos e estoque utilizam funções do banco com regras específicas de acesso.

O painel administrativo trabalha sobre os mesmos dados utilizados pelo site público. Assim, alterações de produtos, preços, estoque e promoções não precisam ser duplicadas no código do frontend.

## Desenvolvimento

Clone o repositório:

```bash
git clone https://github.com/Moreira07-k/BC_2026.git
cd BC_2026
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env.local` baseado no `.env.example` e configure as variáveis do Supabase.

Execute o projeto:

```bash
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
```

## Variáveis de ambiente

Nunca envie credenciais privadas para o GitHub.

Exemplo:

```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave_publica
```

## Deploy

O projeto está integrado ao Vercel. Alterações enviadas para a branch `main` podem iniciar automaticamente um novo deploy.

Fluxo utilizado:

```text
Desenvolvimento
      ↓
Git
      ↓
GitHub
      ↓
Vercel
      ↓
Aplicação publicada
      ↓
Supabase
```

## Commits

As mensagens de commit seguem uma convenção simples:

- `feat:` nova funcionalidade
- `fix:` correção
- `refactor:` refatoração
- `style:` interface ou estilos
- `docs:` documentação
- `chore:` manutenção

Exemplo:

```text
feat: adiciona controle de promoções
fix: corrige cadastro de clientes
refactor: organiza componentes do catálogo
```

## Manutenção

Antes de enviar alterações importantes:

```bash
npm run build
git status
git add .
git commit -m "descreva a alteração"
git push origin main
```

## Autoria

Projeto desenvolvido e mantido por **Kauã Moreira de Souza Silva**.

GitHub: https://github.com/Moreira07-k

Contato:

- WhatsApp: +55 89 99411-2913
- Instagram: @moreira_C7
- E-mail: moreirakaua787@gmail.com

---

BC Bom Feito Confeitaria
