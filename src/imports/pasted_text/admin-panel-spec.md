Atue como um Desenvolvedor Full Stack Sênior especializado em React, TypeScript, Vite, TailwindCSS e Firebase.

IMPORTANTE:

O site principal da BC Bom Feito Confeitaria já está desenvolvido e funcional.

NÃO recrie o projeto.
NÃO altere o layout do site principal.
NÃO modifique componentes existentes sem necessidade.
NÃO altere a identidade visual.

Seu objetivo é desenvolver apenas o Painel Administrativo e integrar as funcionalidades ao sistema existente.

Antes de iniciar, analise toda a estrutura do projeto para reaproveitar componentes, contextos, serviços e configurações já existentes.

====================================================
PAINEL ADMINISTRATIVO
====================================================

Criar uma área administrativa completa, moderna, responsiva e protegida.

A rota deve ser:

/admin

Somente usuários administradores autenticados poderão acessar.

Caso um cliente tente acessar, redirecione para a página inicial.

====================================================
LAYOUT
====================================================

Criar um painel profissional inspirado em dashboards modernos.

Possuir:

• Sidebar fixa recolhível
• Header superior
• Área principal dinâmica
• Breadcrumb
• Cards de estatísticas
• Tabelas
• Modais
• Toast Notifications
• Loading Skeleton
• Responsividade completa

====================================================
DASHBOARD
====================================================

Exibir:

• Total de produtos
• Total de clientes
• Total de pedidos
• Pedidos pendentes
• Produtos mais vendidos
• Últimos pedidos
• Faturamento (simulado)

Adicionar gráficos utilizando Chart.js ou Recharts.

====================================================
GERENCIAMENTO DE PRODUTOS
====================================================

CRUD completo.

Permitir:

Adicionar produto

Editar produto

Excluir produto

Duplicar produto

Ativar/Desativar produto

Cadastrar:

• Nome
• Descrição
• Ingredientes
• Categoria
• Preço
• Estoque
• Produto em destaque
• Disponível ou indisponível

====================================================
UPLOAD
====================================================

Integrar com Firebase Storage.

Permitir upload de:

• Foto principal
• Fotos adicionais
• Vídeos

Mostrar preview antes do envio.

Permitir excluir arquivos.

====================================================
GERENCIAMENTO DE PEDIDOS
====================================================

Listar todos os pedidos.

Filtros:

• Pendentes
• Em preparo
• Saiu para entrega
• Finalizados
• Cancelados

Visualizar:

Cliente

Produtos

Endereço

Forma de pagamento

Frete

Data

Horário

Atualizar status em tempo real no Firestore.

====================================================
CLIENTES
====================================================

Listar usuários cadastrados.

Pesquisar.

Editar informações.

Bloquear usuário.

Excluir usuário.

Visualizar histórico de pedidos.

====================================================
AVALIAÇÕES
====================================================

Visualizar todas as avaliações.

Excluir comentários.

Responder avaliações (opcional).

====================================================
CONFIGURAÇÕES DO SITE
====================================================

Criar uma página para editar informações exibidas no site sem alterar código.

Salvar tudo no Firestore.

Permitir editar:

• Nome da confeitaria
• WhatsApp
• Instagram
• Horário de funcionamento
• Logo
• Banner principal
• Slogans
• Informações de contato
• Mensagens exibidas no site

As alterações devem refletir automaticamente no site principal.

====================================================
GALERIA
====================================================

Permitir upload de:

• Fotos
• Vídeos

Editar.

Excluir.

Organizar por categorias.

Salvar no Firebase Storage.

====================================================
AUTENTICAÇÃO
====================================================

Utilizar Firebase Authentication.

Criar sistema de permissões.

Roles:

ADMIN

CLIENTE

Somente ADMIN pode acessar o painel.

====================================================
BANCO DE DADOS
====================================================

Utilizar a configuração Firebase já existente.

Não alterar configurações.

Utilizar:

Firestore

Storage

Authentication

Analytics

====================================================
SEGURANÇA
====================================================

Criar proteção de rotas.

Validar permissões.

Ocultar páginas administrativas para usuários comuns.

====================================================
RESPONSIVIDADE
====================================================

Desktop

Notebook

Tablet

Celular

====================================================
QUALIDADE
====================================================

Utilizar:

React

TypeScript

TailwindCSS

Componentes reutilizáveis

Hooks personalizados

Context API

Código limpo

Boas práticas

====================================================
VALIDAÇÃO
====================================================

Ao finalizar:

• Verificar erros de compilação.
• Corrigir imports.
• Remover código duplicado.
• Otimizar componentes.
• Garantir que todas as funcionalidades existentes do site continuem funcionando.
• Não modificar o front-end já implementado, exceto quando necessário para integrar o painel administrativo.

Ao final, fornecer um resumo das alterações realizadas e garantir que o projeto esteja pronto para deploy no Firebase Hosting.