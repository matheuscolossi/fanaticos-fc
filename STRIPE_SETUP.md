# Stripe — Fanáticos Mantos

## O que foi implementado

O projeto já possuía uma integração parcial. Ela foi reorganizada para usar o Stripe Checkout com confirmação pelo webhook:

- O frontend envia somente IDs, quantidades e variações.
- O backend consulta os produtos e recalcula preços, promoções, cupom e frete.
- O Checkout coleta endereço de entrega no Brasil e telefone.
- O pedido só é criado depois de um webhook Stripe validado.
- Eventos são idempotentes e não criam pedidos duplicados.
- Os itens são copiados para `pedido_itens` com nome e preço do momento da compra.
- O pedido mantém os identificadores da sessão, Payment Intent, cliente e evento Stripe.
- O retorno de sucesso consulta o status real no backend antes de limpar o carrinho.
- O checkout oferece somente Stripe, com cartão e PIX dentro da página hospedada pelo Stripe.
- O fluxo manual antigo de PIX e WhatsApp foi removido.

## Arquivos principais

Criados:

- `backend/src/models/paymentModel.js`
- `backend/test/stripe.test.js`
- `frontend/pages/pagamento-sucesso.html`
- `frontend/pages/pagamento-cancelado.html`
- `frontend/scripts/pagamento.js`
- `STRIPE_SETUP.md`

Modificados:

- `backend/server.js`
- `backend/src/config/database.js`
- `backend/src/controllers/stripeController.js`
- `backend/src/models/orderModel.js`
- `backend/src/routes/paymentRoutes.js`
- `backend/src/services/cartService.js`
- `backend/src/services/orderService.js`
- `backend/src/services/stripeService.js`
- `backend/.env.example`
- `frontend/scripts/cart.js`
- `frontend/scripts/conta.js`
- `frontend/scripts/admin.js`
- `frontend/vercel.json`

## Variáveis de ambiente

No backend, configure:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://www.fanaticosmantos.com.br
```

Durante o desenvolvimento local, use as chaves de teste:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5500
CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
```

O `.env` está protegido pelo `.gitignore`. Nunca coloque `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` em arquivos do frontend, CSV, HTML ou JavaScript público.

## Rotas

Rotas principais:

```text
POST /api/payments/create-checkout-session
POST /api/payments/webhook
GET  /api/payments/session/:sessionId
```

Também existem aliases compatíveis com o padrão já usado pelo site:

```text
POST /api/pagamentos/stripe/create-session
POST /api/pagamentos/stripe/webhook
GET  /api/pagamentos/stripe/session/:sessionId
```

O webhook precisa receber o corpo bruto. O `server.js` foi ajustado para processar essa rota antes do `express.json()` global.

## Banco de dados

Na inicialização, o projeto cria ou migra:

- `checkout_drafts`: snapshot seguro do checkout antes de abrir o Stripe.
- `stripe_webhook_events`: IDs dos eventos já processados.
- `pedido_itens`: itens históricos do pedido.
- Novas colunas Stripe em `pedidos`.

As estruturas funcionam com PostgreSQL e SQLite. O registro do pedido e de seus itens ocorre dentro de uma transação.

## AÇÃO NECESSÁRIA FORA DO CÓDIGO — Stripe em modo de teste

1. Entre em [dashboard.stripe.com](https://dashboard.stripe.com/).
2. Ative o **modo de teste** pelo seletor no topo do painel.
3. Abra **Developers / Desenvolvedores → API keys**.
4. Copie a **Publishable key** e coloque em `STRIPE_PUBLISHABLE_KEY`.
5. Copie a **Secret key** e coloque somente no `.env` do backend em `STRIPE_SECRET_KEY`.
6. Em **Settings → Payment methods**, habilite **Pix** para a conta de teste. O checkout deste projeto envia explicitamente `card` e `pix`.

Referência oficial: [criar uma Checkout Session](https://docs.stripe.com/api/checkout/sessions/create).

## Webhook local

Instale e autentique o [Stripe CLI](https://docs.stripe.com/stripe-cli):

```powershell
stripe login
```

Com o backend rodando na porta 3001, encaminhe os eventos:

```powershell
stripe listen --forward-to localhost:3001/api/payments/webhook
```

O CLI exibirá um segredo `whsec_...`. Coloque esse valor em `STRIPE_WEBHOOK_SECRET` do `.env` local e reinicie o backend.

O encaminhamento local deve ficar aberto enquanto você testa. O Stripe exige o corpo bruto para validar a assinatura; por isso não use um proxy que transforme o JSON.

## Webhook em produção

1. No Stripe Dashboard, mantenha o modo de teste ativo.
2. Abra **Developers → Webhooks → Add endpoint**.
3. Informe:

```text
https://fanaticos-fc.onrender.com/api/payments/webhook
```

4. Selecione estes eventos:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
payment_intent.payment_failed
charge.refunded
```

5. Salve o endpoint.
6. Abra o endpoint criado, clique em **Reveal signing secret** e copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET` nas variáveis de ambiente do Render.
7. Confirme que `FRONTEND_URL` no Render está como:

```text
https://www.fanaticosmantos.com.br
```

Referências oficiais: [webhooks](https://docs.stripe.com/webhooks) e [processamento de pedidos após Checkout](https://docs.stripe.com/checkout/fulfillment).

## Testes manuais

No checkout, escolha **Cartão**. Use cartões de teste oficiais:

Pagamento aprovado:

```text
4242 4242 4242 4242
```

Pagamento recusado:

```text
4000 0000 0000 0002
```

Use qualquer validade futura e CVC de teste. Nunca use cartão real no modo de teste. Consulte a lista atual em [Stripe testing](https://docs.stripe.com/testing).

Resultados esperados:

1. Pagamento aprovado: o Checkout redireciona para a página de sucesso; o pedido só aparece após o webhook.
2. Pagamento recusado: nenhum pedido pago é criado e o carrinho permanece.
3. Cancelamento: a página de cancelamento aparece e o carrinho permanece.
4. Produto inexistente: a API responde `PRODUCT_NOT_FOUND`.
5. Preço alterado no navegador: o total continua sendo o preço do banco.
6. Quantidade `0`, negativa, decimal ou acima de 99: a API responde `CART_ITEM_INVALID`.
7. Usuário sem JWT: a API responde `AUTH_TOKEN_REQUIRED` ou `AUTH_REQUIRED`.
8. Webhook com assinatura inválida: responde HTTP 400 com `STRIPE_WEBHOOK_SIGNATURE_INVALID`.
9. Reenvio do mesmo evento: o segundo envio é aceito sem criar outro pedido.
10. Falha ao registrar o pedido: a transação sofre rollback e o evento poderá ser reenviado pelo Stripe.

Testes automatizados locais:

```powershell
cd backend
npm run test:stripe
```

O teste usa SQLite local e chaves fictícias; não cria uma cobrança real.

## Testar um webhook pelo CLI

Com `stripe listen` ativo, em outro terminal:

```powershell
stripe trigger checkout.session.completed
```

Esse comando testa a entrega/assinatura do evento. Para validar um pedido completo, use o checkout do site com cartão de teste, pois a sessão precisa conter o `checkout_id` salvo pelo backend.

## Produção

Depois de validar tudo em teste:

1. Ative o modo de produção no Dashboard.
2. Copie as chaves de produção `pk_live_...` e `sk_live_...` para os ambientes corretos.
3. Crie um novo endpoint de webhook de produção e copie o novo `whsec_...`.
4. Atualize as variáveis no Render e faça um novo deploy.
5. Nunca reutilize o `whsec_...` de teste no ambiente de produção.

O código não confirma pagamento pela página de sucesso. A confirmação vem somente do webhook validado pelo segredo do ambiente correspondente.
