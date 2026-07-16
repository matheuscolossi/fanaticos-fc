# Fanáticos FC

E-commerce de camisas de futebol, desenvolvido como Trabalho Individual da disciplina **Programação Web** (URI — Turma 2026/1, Prof. Douglas Tagliari). O projeto implementa front-end, APIs REST de back-end, persistência em banco relacional e documentação OpenAPI/Swagger, cobrindo o fluxo completo Home → Busca → Detalhes → Carrinho.

O backend segue um padrão em camadas (rotas → controllers → services → models), separado do frontend estático.

## Sumário

- [Tecnologias](#tecnologias)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Páginas do Front-end](#páginas-do-front-end)
- [Instalação e Execução Local](#instalação-e-execução-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Documentação da API (Swagger/OpenAPI)](#documentação-da-api-swaggeropenapi)
- [Rotas no formato do trabalho (Postman)](#rotas-no-formato-do-trabalho-postman)
- [Rotas internas do site (`/api/*`)](#rotas-internas-do-site-api)
- [Fluxo de Arquitetura](#fluxo-de-arquitetura)
- [Keep-alive no Render (free tier)](#keep-alive-no-render-free-tier)
- [Guia de Contribuição](#guia-de-contribuição)
- [Provisionamento seguro](#provisionamento-seguro)

## Tecnologias

| Camada | Stack |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| Backend | Node.js, Express |
| Banco de dados | PostgreSQL via `DATABASE_URL`; SQLite local como fallback |
| Storage de imagens | Cloudinary, com fallback para URLs/Base64 em desenvolvimento |
| Autenticação | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`), HTTP Basic Auth nas rotas exigidas pelo trabalho |
| Documentação | OpenAPI 3.0 servida via `swagger-ui-express` em `/docs` |
| Deploy | Backend no Render, frontend no Vercel |

## Estrutura de Arquivos

```txt
fanaticos-fc/
├── README.md                          # Documentação principal do projeto
├── .gitignore                         # Regras globais de versionamento
├── backend/
│   ├── package.json                   # Dependências e scripts da API
│   ├── package-lock.json              # Lockfile do npm
│   ├── .env.example                   # Modelo das variáveis de ambiente
│   ├── server.js                      # Bootstrap do Express, montagem das rotas e do /docs
│   ├── data/                          # Banco SQLite local gerado em runtime
│   ├── uploads/                       # Uploads temporários fora do src
│   └── src/
│       ├── config/
│       │   └── database.js            # Conexão e schema SQLite/PostgreSQL
│       ├── controllers/                # Entrada HTTP: req/res
│       │   ├── authController.js
│       │   ├── cartController.js
│       │   ├── categoriesController.js
│       │   ├── couponsController.js
│       │   ├── dashboardController.js
│       │   ├── ordersController.js
│       │   ├── productsController.js
│       │   └── usersController.js
│       ├── docs/
│       │   └── openapi.js             # Spec OpenAPI 3.0 servida em /docs
│       ├── middleware/
│       │   └── auth.js                # JWT (auth/admin) e HTTP Basic Auth
│       ├── models/                    # Acesso ao banco e SQL
│       │   ├── categoryModel.js
│       │   ├── couponModel.js
│       │   ├── orderModel.js
│       │   ├── productModel.js
│       │   └── userModel.js
│       ├── routes/                    # Definição das rotas da API
│       │   ├── authRoutes.js
│       │   ├── categoryRoutes.js
│       │   ├── couponRoutes.js
│       │   ├── dashboardRoutes.js
│       │   ├── orderRoutes.js
│       │   ├── productRoutes.js
│       │   ├── specRoutes.js          # Rotas "limpas" exigidas pelo PDF (/health, /products, ...)
│       │   └── userRoutes.js
│       ├── services/                  # Regras de negócio e integrações
│       │   ├── authService.js
│       │   ├── cartService.js         # Cálculo de subtotal/frete/desconto/total
│       │   ├── categoryService.js
│       │   ├── couponService.js
│       │   ├── emailService.js        # Envio do código de verificação por e-mail
│       │   ├── imageService.js        # Cloudinary/storage de imagens
│       │   ├── orderService.js
│       │   ├── productService.js
│       │   └── userService.js
│       ├── scripts/
│       │   └── migrateImages.js       # Script utilitário de migração de imagens p/ Cloudinary
│       └── utils/
│           └── http.js                # Helpers HTTP e tratamento de erro
└── frontend/
    ├── index.html                     # Home (/)
    ├── vercel.json                    # Rewrites de rotas (/busca, /carrinho, /p/:nome/:id)
    ├── pages/
    │   ├── admin.html                 # Painel administrativo (/admin)
    │   ├── brasileirao.html
    │   ├── carrinho.html              # Carrinho (/carrinho)
    │   ├── conta.html                 # Login/cadastro/perfil do cliente
    │   └── produto.html               # PDP (/p/:nome/:id)
    ├── scripts/
    │   ├── admin.js
    │   ├── api.js                     # Wrapper de fetch para a API (API_BASE)
    │   ├── auth.js
    │   ├── carrinho.js
    │   ├── cart.js
    │   ├── conta.js
    │   ├── loja.js
    │   └── produto.js
    ├── styles/
    │   ├── admin.css
    │   ├── global.css
    │   └── loja.css
    └── assets/
        └── images/                   # Imagens estáticas versionadas (logo, favicons)
```

## Páginas do Front-end

| Página | Rota | Descrição |
| --- | --- | --- |
| Home | `/` | Banner, menu de navegação, busca e vitrine com produtos em destaque |
| Busca e Listagem | `/busca?query=blusa` | Busca por nome/atributos, com filtros e paginação |
| Detalhes do Produto (PDP) | `/p/:nome/:id` | Dados completos do produto e ação "Adicionar ao carrinho" |
| Carrinho | `/carrinho` | Itens, quantidade, subtotal, frete simulado, cupom e total |
| Conta | `/pages/conta.html` | Cadastro, login e perfil do cliente |
| Admin (bônus) | `/admin` | CRUD de produtos restrito a usuários com `isAdmin`/perfil `admin` |

O carrinho é mantido no `LocalStorage` do navegador e sincronizado com os dados atualizados do banco via `POST /api/cart` / `POST /cart` a cada visita à página.

## Instalação e Execução Local

Clone o repositório:

```bash
git clone <url-do-repositorio>
cd fanaticos-fc
```

Instale as dependências do backend:

```bash
cd backend
npm install
```

Configure as variáveis de ambiente:

```bash
cp .env.example .env
```

Para desenvolvimento local, você pode deixar `DATABASE_URL` vazio/removido — a API usará SQLite em `backend/data/fanaticos.db`. Para banco compartilhado/produção, configure um PostgreSQL externo (ver seção [Variáveis de Ambiente](#variáveis-de-ambiente)).

Rode a API:

```bash
npm start
```

A API ficará disponível em:

```txt
http://localhost:3001
```

- Rotas internas do site: `http://localhost:3001/api/...`
- Rotas públicas compatíveis com o trabalho: `http://localhost:3001/health`, `GET /product/:id`, `/search` e `/cart`. As mutações acadêmicas ficam desabilitadas por padrão.
- Documentação Swagger: `http://localhost:3001/docs`

Abra o frontend diretamente no navegador ou use um servidor estático:

```bash
cd ../frontend
python3 -m http.server 5500
```

Depois acesse:

```txt
http://localhost:5500
```

> Por padrão o frontend aponta para a API em produção (`https://fanaticos-fc.onrender.com/api`). Para testar contra a API local, defina `window.FANATICOS_API_BASE = 'http://localhost:3001/api'` antes de carregar `scripts/api.js` (ex.: em um `<script>` no `index.html`).

## Variáveis de Ambiente

Definidas em `backend/.env` (modelo em `backend/.env.example`):

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão PostgreSQL. Se omitida, usa SQLite local. |
| `DB_SSL` | `true` para exigir SSL na conexão PostgreSQL (ex.: Neon, Render). |
| `JWT_SECRET` | Chave usada para assinar/validar os tokens JWT. Obrigatória. |
| `CORS_ORIGIN` | Lista de origens permitidas, separadas por vírgula. |
| `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` | Credenciais obrigatórias para provisionar o primeiro administrador quando o banco está vazio. Não possuem fallback. |
| `ENABLE_ACADEMIC_API` | Feature flag das mutações acadêmicas. O padrão seguro é `false`; nesse estado as rotas não são registradas. |
| `ACADEMIC_API_HOST` / `COMMERCIAL_API_HOST` | Hosts obrigatoriamente distintos quando a API acadêmica é habilitada em produção. Requisições de mutação no host comercial recebem `404`. |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | Credenciais exclusivas exigidas somente quando `ENABLE_ACADEMIC_API=true`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credenciais do Cloudinary para upload/armazenamento de imagens de produto. |
| `RESEND_API_KEY` / `RESEND_FROM` | Credenciais do serviço de e-mail (verificação de cadastro). |
| `EMAIL_CODE_TTL_MINUTES` / `EMAIL_CODE_MAX_ATTEMPTS` | Validade do código e máximo de tentativas antes da invalidação. |
| `EMAIL_RESEND_COOLDOWN_SECONDS` / `EMAIL_RESEND_WINDOW_MINUTES` / `EMAIL_RESEND_MAX_PER_WINDOW` | Cooldown e limite persistente de reenvios por conta. |
| `RATE_LIMIT_SECRET` | Chave opcional usada para transformar IPs e contas em HMAC antes de persistir os contadores. Se omitida, usa `JWT_SECRET`. |
| `RATE_LIMIT_*_IP` / `RATE_LIMIT_*_ACCOUNT` | Limites por janela para toda a API, leituras públicas, cadastro, login, verificação, reenvio, rastreio, carrinho, checkout e mutações acadêmicas. |

O backend limita JSON comum a 100 KB. Somente cadastro/edição de produtos e categorias possuem limites maiores para imagens em base64; importação CSV e webhooks Stripe também usam limites próprios. O carrinho aceita no máximo 50 linhas diferentes, com até 99 unidades por linha e sempre respeitando o estoque.

## Documentação da API (Swagger/OpenAPI)

A especificação OpenAPI 3.0 está em [`backend/src/docs/openapi.js`](backend/src/docs/openapi.js). No domínio comercial, o Swagger remove `POST /products` e `DELETE /product/:id`, publicando somente as operações sem mutação acadêmica:

- Produção: **https://fanaticos-fc.onrender.com/docs**
- Local: **http://localhost:3001/docs**

## Rotas no formato do trabalho (Postman)

As consultas REST compatíveis com o trabalho permanecem na raiz do servidor. `POST /products` e `DELETE /product/:id` só existem quando `ENABLE_ACADEMIC_API=true` e devem ser expostas por um serviço/host acadêmico separado. Elas nunca devem apontar para o domínio comercial. Implementação em [`backend/src/routes/specRoutes.js`](backend/src/routes/specRoutes.js).

**Base URL (produção/Render):** `https://fanaticos-fc.onrender.com`
**Base URL (local):** `http://localhost:3001`

> O serviço gratuito do Render hiberna após ~15 min sem uso — a primeira requisição pode levar 30–50s (cold start). Veja [Keep-alive no Render](#keep-alive-no-render-free-tier).

### `GET /health`

Validação de funcionamento do serviço. Não exige autenticação nem banco pronto.

```bash
curl https://fanaticos-fc.onrender.com/health
```

```json
{ "status": "ok", "db": true, "timestamp": "2026-06-22T21:58:44.154Z" }
```

### `POST /products` — autenticado com Basic Auth

Cadastra um produto, incluindo atributos (cor, tamanho, peso, descrição).

No Postman: aba **Authorization** → tipo `Basic Auth` → informe os valores secretos configurados em `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`.

```bash
curl -X POST "$ACADEMIC_API_ORIGIN/products" \
  -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASS" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Camisa Flamengo Home 25/26",
    "preco": 299.9,
    "cores": ["Vermelho", "Preto"],
    "tamanhos": ["P", "M", "G"],
    "peso": 0.3,
    "descricao": "Camisa oficial titular.",
    "categoria_id": 1
  }'
```

```json
// 201 Created
{ "message": "Produto criado.", "id": 246 }
```

```json
// 401 sem Basic Auth válido
{ "error": "Basic auth credentials are required.", "code": "AUTH_BASIC_REQUIRED" }
```

### `DELETE /product/:id` — autenticado com Basic Auth

Remove um produto específico pelo ID.

```bash
curl -X DELETE "$ACADEMIC_API_ORIGIN/product/246" \
  -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASS"
```

```json
// 200
{ "message": "Produto excluído." }
```

```json
// 404
{ "error": "Produto não encontrado.", "code": "PRODUCT_NOT_FOUND" }
```

### `GET /product/:id`

Detalhe completo do produto.

```bash
curl https://fanaticos-fc.onrender.com/product/244
```

```json
{
  "id": 244,
  "nome": "Venezia Third 25-26 Torcedor",
  "preco": "179.99",
  "descricao": "Camisa oficial torcedor.",
  "cores": ["Verde", "Preto"],
  "tamanhos": ["P", "M", "G"],
  "peso": "0.300",
  "categoria_id": 2
}
```

### `GET /search?query=&cat=&page=&limit=`

Lista produtos com base na pesquisa e filtros, paginados.

- `query` — termo pesquisado no nome/atributos do produto
- `cat` — categoria, por `id` ou por nome (case-insensitive)
- `page` — número da página (inteiro ≥ 1, padrão `1`)
- `limit` — itens por página (inteiro ≥ 1, padrão `24`)

```bash
curl "https://fanaticos-fc.onrender.com/search?query=camisa&cat=Brasileir%C3%A3o&page=1&limit=12"
```

```json
{
  "produtos": [
    { "id": 244, "nome": "Venezia Third 25-26 Torcedor", "preco": "179.99" }
  ],
  "total": 231,
  "page": 1,
  "totalPages": 116
}
```

```json
// 400 — page/limit inválidos
{ "error": "page deve ser um número inteiro >= 1.", "code": "INVALID_PAGE" }
```

### `POST /cart`

Recebe os itens do carrinho e retorna o resumo calculado (sem necessidade de autenticação).

```bash
curl -X POST https://fanaticos-fc.onrender.com/cart \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": 244, "qty": 1 },
      { "productId": 243, "qty": 1 }
    ],
    "cupomCode": "URI10"
  }'
```

```json
{
  "items": [
    { "productId": 244, "name": "Venezia Third 25-26 Torcedor", "price": 179.99, "qty": 1, "image": "https://.../foto.webp" },
    { "productId": 243, "name": "...", "price": 179.99, "qty": 1, "image": "https://.../foto2.webp" }
  ],
  "subtotal": 359.98,
  "freight": 0,
  "discount": 36,
  "total": 323.98
}
```

Regra de frete simulado: `freight = subtotal >= 200 ? 0 : 25`. Cupom de exemplo: `URI10` → 10% de desconto sobre o subtotal.

## Rotas internas do site (`/api/*`)

Além das rotas acima (exigidas pelo trabalho), o site usa um conjunto mais completo de rotas sob `/api`, com autenticação JWT (Bearer token) para fluxos de cliente/admin:

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health check usado pelo Render e pelo keep-alive |
| POST | `/api/auth/register` | — | Cadastro de cliente (nome, e-mail, senha, CPF, telefone) |
| POST | `/api/auth/login` | — | Login, retorna JWT |
| POST | `/api/auth/verificar-email` | — | Confirma código de verificação enviado por e-mail |
| POST | `/api/auth/reenviar-codigo` | — | Reenvia código de verificação |
| GET/PUT | `/api/auth/perfil` | JWT | Consulta/atualiza o perfil do cliente logado |
| GET | `/api/produtos` | — | Lista produtos paginada (vitrine) |
| GET | `/api/produtos/:id` | — | Detalhe do produto |
| POST/PUT/DELETE | `/api/produtos[/:id]` | JWT admin | CRUD de produtos |
| POST `/duplicar`, PATCH `/status`, `/destaque`, POST `/bulk-price`, GET `/export`, POST `/import` | `/api/produtos/...` | JWT admin | Operações administrativas extras |
| GET/POST/PUT/PATCH/DELETE | `/api/categorias[/:id]` | leitura pública, escrita admin | CRUD de categorias |
| GET/POST/PUT/PATCH/DELETE | `/api/cupons[/:id]` | JWT admin | CRUD de cupons de desconto |
| POST | `/api/pedidos` | JWT | Cria pedido a partir do carrinho |
| GET | `/api/pedidos` | JWT admin | Lista todos os pedidos |
| GET | `/api/pedidos/meus` | JWT | Lista pedidos do cliente logado |
| GET | `/api/pedidos/:id/rastreio` | — | Rastreio público do pedido |
| PUT/DELETE | `/api/pedidos/:id` | JWT admin | Atualiza/remove pedido |
| GET/DELETE | `/api/admin/usuarios[/:id]` | JWT admin | Lista/remove usuários |
| GET | `/api/admin/dashboard` | JWT admin | Métricas do painel administrativo |
| POST | `/api/cart` | — | Mesma lógica de `/cart`, usada internamente pelo site |

Usuários administrativos são definidos pela flag `perfil = 'admin'` no registro do usuário (equivalente ao `isAdmin=true` citado no PDF).

### Permissões administrativas granulares

Categorias, cupons e promoções usam permissões independentes para cada ação: `*.visualizar` protege as consultas administrativas, `*.criar` protege cadastros e duplicações, `*.editar` protege alterações e ativação/inativação, e `*.excluir` protege remoções. O catálogo público `GET /api/categorias` permanece acessível apenas com categorias ativas e campos próprios da vitrine; a listagem administrativa completa usa `GET /api/categorias/admin` e exige `categorias.visualizar`.

Ao atualizar uma instalação existente, as novas permissões são adicionadas somente à conta proprietária configurada e às contas que já possuem `administradores.gerenciar`. Funcionários com permissões restritas, inclusive quem possuía apenas `cupons.criar`, não recebem acesso adicional automaticamente.

### Validação e canonicalização no backend

Os contratos de produtos e usuários são validados por schemas centralizados antes de chegar aos models. Produtos rejeitam valores não finitos, preços negativos ou acima do limite, mais de duas casas decimais, estoque fracionário/negativo, enumerações desconhecidas e textos acima do tamanho permitido. E-mail é armazenado em minúsculas e sem espaços externos; CPF, telefone e CEP são armazenados somente com dígitos, depois da validação de formato (incluindo os dígitos verificadores do CPF).

O banco mantém uma segunda barreira contra gravações que contornem os services: PostgreSQL usa `CHECK constraints` e SQLite usa triggers de validação equivalentes. A migração canonicaliza formatos legados válidos antes de ativar essa proteção.

### Importação CSV de produtos

`POST /api/produtos/import` usa um único contrato JSON: `{ "csv": "conteúdo do arquivo", "preview": true|false }`. O frontend sempre envia primeiro `preview: true`; nenhuma linha é gravada nessa etapa. A confirmação repete o mesmo conteúdo com `preview: false` e a importação ocorre em uma transação única, somente quando todas as linhas são válidas.

O arquivo aceita vírgula, ponto-e-vírgula ou tabulação, campos entre aspas, BOM UTF-8 e a diretiva opcional `sep=;`. As colunas obrigatórias são `nome` e `preco`. As demais colunas aceitas são `id`, `sku`, `slug`, `preco_promocional`, `custo`, `categoria`, `categoria_id`, `time`, `pais`, `competicao`, `temporada`, `tipo`, `marca`, `genero`, `estoque`, `estoque_minimo`, `status`, `destaque`, `produto_novo`, `produto_promocional`, `peso`, `keywords` e `created_at`. `id` e `created_at` são informativos e não são importados.

O limite é de 2 MB e 1.000 linhas. O relatório informa número da linha, dados reconhecidos e erros de coluna, incluindo categoria inexistente, SKU repetido, quantidade de colunas incorreta, número/booleano inválido e valores fora do intervalo.

## Fluxo de Arquitetura

```txt
Browser
  -> frontend/scripts/api.js
  -> backend/server.js
  -> routes
  -> controllers
  -> services
  -> models
  -> database/storage
```

As imagens de produto são tratadas como assets dinâmicos: em produção vão para o Cloudinary e o banco salva apenas as URLs públicas. A pasta `backend/uploads` existe apenas como ponto transitório para futuras estratégias locais de upload.

## Keep-alive no Render (free tier)

O plano gratuito do Render hiberna o serviço após ~15 minutos sem requisições, causando um cold start de 30–50 segundos na primeira visita. Para evitar isso, configure um monitor externo que pinga a rota de saúde da API a cada 10 minutos.

```txt
GET https://fanaticos-fc.onrender.com/health
→ { "status": "ok", "db": true, "timestamp": "..." }
```

### Configurar com UptimeRobot (gratuito)

1. Acesse [uptimerobot.com](https://uptimerobot.com) e crie uma conta gratuita.
2. Clique em **Add New Monitor**.
3. Preencha:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Fanáticos FC API
   - **URL:** `https://fanaticos-fc.onrender.com/health`
   - **Monitoring Interval:** 10 minutes
4. Clique em **Create Monitor**.

A partir daí o UptimeRobot pinga a API a cada 10 minutos, mantendo o servidor ativo 24h.

### Alternativa: cron-job.org (gratuito)

1. Acesse [cron-job.org](https://cron-job.org) e crie uma conta.
2. Clique em **Create cronjob**.
3. Preencha:
   - **URL:** `https://fanaticos-fc.onrender.com/health`
   - **Schedule:** Every 10 minutes
4. Salve.

### Alternativa paga

Faça upgrade para o plano **Starter** do Render (US$ 7/mês) e o serviço nunca hiberna.

## Guia de Contribuição

1. Crie uma branch a partir da principal:

```bash
git checkout -b feat/minha-melhoria
```

2. Faça mudanças pequenas e coesas.

3. Antes de abrir um pull request, valide a sintaxe e rode a API:

```bash
cd backend
node --check server.js
npm start
```

4. Use mensagens de commit objetivas:

```bash
git commit -m "feat: reorganiza backend em MVC"
```

5. No pull request, descreva:

- O que mudou.
- Como testar.
- Se houve impacto em banco, `.env` ou frontend.

## Provisionamento seguro

A API não possui credenciais padrão. Antes da primeira inicialização, configure `JWT_SECRET`, `DEFAULT_ADMIN_EMAIL` e `DEFAULT_ADMIN_PASSWORD` no gerenciador de segredos do ambiente. `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` são exigidos apenas no serviço acadêmico com a feature habilitada. A inicialização falha quando uma credencial necessária está ausente ou fraca.

Quando o banco está vazio, `DEFAULT_ADMIN_EMAIL` e `DEFAULT_ADMIN_PASSWORD` provisionam o primeiro administrador. Em bancos existentes, altere a senha administrativa pela área de conta; a variável de bootstrap não substitui automaticamente a senha armazenada.

Para rotacionar credenciais já utilizadas:

1. Troque a senha administrativa pela área de conta.
2. Gere um usuário e uma senha independentes para o Basic Auth e atualize os segredos da hospedagem.
3. Gere um novo `JWT_SECRET`; isso encerra todas as sessões existentes.
4. Reinicie o backend e remova imediatamente versões antigas dos segredos no provedor.
