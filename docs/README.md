# ⚽ Fanáticos FC — Sistema de E-commerce

E-commerce completo para venda de camisas de futebol, desenvolvido com Node.js + SQLite (backend) e HTML/CSS/JS puro (frontend).

---

## 📁 Estrutura do Projeto

```
fanaticos-fc/
├── backend/
│   ├── server.js        # API REST (Express)
│   ├── database.js      # Configuração SQLite + seed
│   └── package.json
└── frontend/
    ├── index.html       # Página principal (loja)
    ├── pages/
    │   └── admin.html   # Painel administrativo
    ├── css/
    │   ├── main.css     # Estilos globais
    │   ├── loja.css     # Estilos da loja
    │   └── admin.css    # Estilos do painel admin
    └── js/
        ├── api.js       # Comunicação com backend
        ├── cart.js      # Carrinho de compras
        ├── auth.js      # Autenticação JWT
        ├── loja.js      # Lógica da vitrine
        └── admin.js     # Lógica do painel admin
```

---

## 🚀 Como Rodar

### 1. Instalar dependências do backend

```bash
cd backend
npm install
```

### 2. Iniciar o servidor

```bash
npm start
# ou para desenvolvimento (auto-reload):
npm run dev
```

O backend sobe em: **http://localhost:3001**

### 3. Abrir o frontend

Abra o arquivo `frontend/index.html` diretamente no navegador, ou use um servidor local:

```bash
# Com Python:
cd frontend && python3 -m http.server 5500

# Com VS Code: instale a extensão "Live Server" e clique em "Go Live"
```

---

## 🔐 Credenciais Padrão

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin  | admin@fanaticosfc.com | admin123 |

> Para acessar o painel admin: faça login com as credenciais acima e vá para `frontend/pages/admin.html`

---

## ✅ Funcionalidades Implementadas

### Requisitos Funcionais
- **RF-01** — CRUD completo de produtos (nome, preço, categoria, descrição, até 4 imagens em Base64)
- **RF-02** — Painel Administrativo com tabela de estoque, paginação e busca
- **RF-03** — Busca inteligente ignorando acentuação e maiúsculas/minúsculas
- **RF-04** — Filtros por categoria e faixa de preço combinados
- **RF-05** — Carrinho lateral (Side Cart) dinâmico com subtotal em tempo real
- **RF-06** — Checkout integrado ao WhatsApp com mensagem automática
- **RF-07** — Cadastro e autenticação com senha criptografada (bcrypt) e JWT

### Requisitos Não-Funcionais
- **RFN-01** — Interface responsiva (desktop, tablet, mobile)
- **RFN-02** — Paginação no painel admin (15 por página) para catálogos volumosos
- **RFN-03** — Senhas criptografadas com bcrypt, rotas críticas protegidas por JWT

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express |
| Banco de Dados | SQLite (better-sqlite3) |
| Autenticação | JWT + bcryptjs |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Fontes | Bebas Neue, Oswald, Inter (Google Fonts) |

---

## 📡 Endpoints da API

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/auth/register` | Criar conta | — |
| POST | `/api/auth/login` | Login | — |
| GET | `/api/categorias` | Listar categorias | — |
| GET | `/api/produtos` | Listar produtos (com filtros) | — |
| GET | `/api/produtos/:id` | Detalhe do produto | — |
| POST | `/api/produtos` | Criar produto | Admin |
| PUT | `/api/produtos/:id` | Editar produto | Admin |
| DELETE | `/api/produtos/:id` | Excluir produto | Admin |
| POST | `/api/pedidos` | Registrar pedido | — |
| GET | `/api/pedidos` | Listar pedidos | Admin |
| GET | `/api/admin/usuarios` | Listar usuários | Admin |

---

## 📝 Observações

- O banco de dados SQLite é criado automaticamente em `backend/fanaticos.db` na primeira execução
- 10 produtos de exemplo são inseridos automaticamente no primeiro uso
- O número do WhatsApp no checkout está em `frontend/js/cart.js` — altere `5500000000000` pelo número real da loja
