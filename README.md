# 🍰 BC Bom Feito Confeitaria

> Plataforma web para catálogo, pedidos e gestão de uma confeitaria artesanal.

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

## ✨ Sobre o projeto

O **BC Bom Feito Confeitaria** reúne, em uma única aplicação, a experiência de compra do cliente e a gestão interna da loja.

O projeto foi estruturado para manter o site público, o painel administrativo e o banco de dados sincronizados:

```text
Cliente
  ↓
Site público
  ↓
Supabase
  ├── Produtos
  ├── Clientes
  ├── Pedidos
  ├── Estoque
  ├── Avaliações
  ├── Galeria
  └── Configurações
  ↓
Painel administrativo
```

A ideia central é simples: **o Supabase é a fonte de verdade**. Alterações feitas no painel podem ser refletidas no site sem precisar editar manualmente os dados do frontend.

## 🛍️ Funcionalidades

### Site público
- 📱 Layout responsivo
- 🍫 Catálogo de produtos
- 🔎 Busca e filtros
- 🛒 Carrinho de compras
- 👤 Identificação do cliente
- 📍 Entrega e retirada
- 💳 PIX, cartão e dinheiro
- 📦 Controle de estoque
- 💬 Finalização pelo WhatsApp
- ⭐ Avaliações com aprovação administrativa
- 🖼️ Galeria de fotos
- 🏷️ Promoções e preço anterior
- ⚙️ Configurações carregadas do Supabase

### Painel administrativo
- 📊 Dashboard
- 🍰 Cadastro e edição de produtos
- 💰 Preços e promoções
- 📦 Estoque
- 🖼️ Imagens dos produtos
- 🛍️ Pedidos
- 👥 Clientes
- ⭐ Avaliações
- 🖼️ Galeria
- ⚙️ Configurações da loja
- 🔐 Controle de administradores
- 🧾 Histórico de alterações de pedidos

### Backend e segurança
- PostgreSQL via Supabase
- Row Level Security (RLS)
- Funções RPC para operações públicas controladas
- Registro de clientes vinculado a pedidos
- Reserva e devolução de estoque
- Storage para imagens
- Histórico de status dos pedidos
- Separação entre dados públicos e dados administrativos

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Interface | React + TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS |
| Animações | Motion |
| Ícones | Lucide React |
| Backend | Supabase |
| Banco | PostgreSQL |
| Storage | Supabase Storage |
| Deploy | Vercel |
| Controle de versão | Git + GitHub |

## 📁 Organização principal

```text
BC_2026/
├── src/
│   ├── app/
│   │   ├── components/
│   │   ├── Admin.tsx
│   │   ├── App.tsx
│   │   ├── ProductCard.tsx
│   │   ├── siteData.ts
│   │   └── whatsapp.ts
│   ├── imports/
│   └── lib/
├── supabase/
│   └── schema.sql
├── public/
├── .github/
├── .env.example
├── .gitignore
├── SUPABASE_SETUP.md
├── package.json
└── README.md
```

## 🚀 Desenvolvimento local

Clone o projeto:

```bash
git clone https://github.com/Moreira07-k/BC_2026.git
cd BC_2026
```

Instale as dependências:

```bash
npm install
```

Configure as variáveis de ambiente a partir de `.env.example`:

```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave_anon_public
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

Teste o build de produção:

```bash
npm run build
```

## 🗄️ Supabase

O arquivo `supabase/schema.sql` concentra a estrutura e as regras do banco.

Entre os recursos estão:

- `products`
- `customers`
- `orders`
- `reviews`
- `gallery_items`
- `site_settings`
- `admin_users`
- `order_status_log`

Também existem funções controladas para operações do site, incluindo criação de pedidos e gerenciamento de estoque.

> ⚠️ Nunca publique chaves privadas, tokens ou arquivos `.env` no Git.

## 🔄 Fluxo de pedidos

```text
Produto
  ↓
Carrinho
  ↓
Dados do cliente
  ↓
Entrega / retirada
  ↓
Pagamento
  ↓
create_public_order()
  ↓
Cliente + Pedido + Estoque
  ↓
Painel administrativo
  ↓
WhatsApp
```

## 🏷️ Promoções

O catálogo suporta preço promocional sem perder o preço anterior.

Exemplo:

```text
Preço anterior: R$ 14,00
Preço atual:    R$ 10,00
Status:         Promoção
```

A informação fica armazenada no banco e pode ser administrada pelo painel.

## 🌐 Deploy

O projeto utiliza **Vercel** para publicação e integração com o GitHub.

O fluxo recomendado é:

```text
GitHub
  ↓
Vercel
  ↓
Aplicação publicada
  ↓
Supabase
```

Cada alteração enviada para a branch principal pode iniciar um novo deploy automático.

## 🧪 Antes de publicar uma alteração

```bash
npm install
npm run build
git status
git add .
git commit -m "descreva a alteração"
git push origin main
```

## 📌 Convenção de commits

Prefira mensagens objetivas:

- `feat: adiciona nova funcionalidade`
- `fix: corrige erro no pedido`
- `refactor: reorganiza componente`
- `style: ajusta interface`
- `docs: atualiza documentação`
- `chore: manutenção do projeto`

## 🎯 Objetivos técnicos

- Manter o site rápido e responsivo
- Centralizar os dados no Supabase
- Evitar duplicação de informações entre frontend e banco
- Proteger dados administrativos com RLS
- Facilitar manutenção e evolução do projeto
- Manter uma identidade visual própria para a BC Bom Feito Confeitaria

---

### 💜 Projeto

**BC Bom Feito Confeitaria** — catálogo, pedidos e gestão em uma única plataforma.

Desenvolvimento e manutenção realizados através de GitHub + Vercel + Supabase.
