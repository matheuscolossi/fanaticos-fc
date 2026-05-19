# Fanáticos FC

E-commerce para venda de camisas de futebol, com vitrine pública, carrinho, autenticação de clientes, painel administrativo, gestão de produtos, pedidos e usuários.

O projeto foi reorganizado para separar claramente frontend e backend. No backend, a estrutura segue um padrão MVC com services, deixando rotas, controladores, regras de negócio e acesso a dados em camadas distintas.

## Tecnologias

| Camada | Stack |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express |
| Banco de dados | PostgreSQL via `DATABASE_URL`; SQLite local como fallback |
| Storage de imagens | Cloudinary, com fallback para URLs/Base64 em desenvolvimento |
| Autenticação | JWT, bcryptjs |

## Estrutura de Arquivos

```txt
fanaticos-fc/
├── README.md                         # Documentação principal do projeto
├── .gitignore                        # Regras globais de versionamento
├── backend/
│   ├── package.json                  # Dependências e scripts da API
│   ├── package-lock.json             # Lockfile do npm
│   ├── .env.example                  # Modelo das variáveis de ambiente
│   ├── server.js                     # Bootstrap do Express
│   ├── data/                         # Banco SQLite local gerado em runtime
│   ├── uploads/                      # Uploads temporários fora do src
│   └── src/
│       ├── config/
│       │   └── database.js           # Conexão e schema SQLite/PostgreSQL
│       ├── controllers/              # Entrada HTTP: req/res
│       │   ├── authController.js
│       │   ├── categoriesController.js
│       │   ├── ordersController.js
│       │   ├── productsController.js
│       │   └── usersController.js
│       ├── middleware/
│       │   └── auth.js               # Autenticação e autorização
│       ├── models/                   # Acesso ao banco e SQL
│       │   ├── categoryModel.js
│       │   ├── orderModel.js
│       │   ├── productModel.js
│       │   └── userModel.js
│       ├── routes/                   # Definição das rotas da API
│       │   ├── authRoutes.js
│       │   ├── categoryRoutes.js
│       │   ├── orderRoutes.js
│       │   ├── productRoutes.js
│       │   └── userRoutes.js
│       ├── services/                 # Regras de negócio e integrações
│       │   ├── authService.js
│       │   ├── imageService.js       # Cloudinary/storage de imagens
│       │   ├── orderService.js
│       │   └── productService.js
│       ├── scripts/
│       │   └── importProducts.js     # Importador de camisas
│       ├── utils/
│       │   └── http.js               # Helpers HTTP e tratamento de erro
├── frontend/
│   ├── index.html                    # Página inicial
│   ├── pages/                        # Páginas estáticas da loja/admin
│   ├── styles/                       # Estilos globais e por contexto
│   ├── scripts/                      # JavaScript do frontend
│   └── assets/
│       └── images/                   # Imagens estáticas versionadas
```

## Instalação

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

Para desenvolvimento local, você pode deixar `DATABASE_URL` vazio/removido e a API usará SQLite em `backend/data/fanaticos.db`.

Para dados compartilhados entre máquinas ou produção, configure um PostgreSQL externo:

```env
DATABASE_URL=postgres://usuario:senha@host:5432/database
DB_SSL=true
JWT_SECRET=troque_essa_chave_em_producao
```

Para imagens em storage/CDN, configure Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Rode a API:

```bash
npm start
```

A API ficará disponível em:

```txt
http://localhost:3001/api
```

Abra o frontend diretamente no navegador ou use um servidor estático:

```bash
cd ../frontend
python3 -m http.server 5500
```

Depois acesse:

```txt
http://localhost:5500
```

## Importar Camisas

O importador de produtos fica em `backend/src/scripts/importProducts.js`.

Edite o array `CONFIG.searches` dentro do arquivo para escolher os termos de busca, quantidade de páginas e categoria destino:

```js
searches: [
  { search: 'FORTALEZA', pages: 1, mapTo: 'Brasileirão' },
]
```

Depois rode:

```bash
cd backend
npm run import:produtos
```

Para testar sem salvar no banco:

```bash
npm run import:produtos:dry
```

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

As imagens de produto devem ser tratadas como assets dinâmicos. Em produção, elas devem ir para Cloudinary ou outro storage externo, e o banco deve salvar apenas as URLs públicas. A pasta `backend/uploads` existe apenas como ponto transitório para futuras estratégias locais de upload.

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

## Credenciais Locais

Quando o banco é inicializado sem usuários administradores, a API cria um admin padrão:

```txt
E-mail: admin@fanaticosfc.com
Senha: admin123
```

Em produção, altere `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` e `JWT_SECRET`.
