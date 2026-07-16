const model = require('../models/commerceFeaturesModel');
const { getProduct } = require('./productService');
const { buildCartSummary, MAX_CART_ITEMS } = require('./cartService');
const { createHttpError } = require('../utils/http');
const emailService = require('./emailService');
const { enumValue, numberValue, requirePlainObject, stringValue } = require('../validation/commonSchemas');

function idValue(value, field = 'id') {
  return numberValue(value, field, { label: 'Identificador', min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
}

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

function productDto(product) {
  return {
    id: product.id,
    nome: product.nome,
    slug: product.slug || null,
    preco: Number(product.preco),
    preco_promocional: product.preco_promocional == null ? null : Number(product.preco_promocional),
    imagens: parseJson(product.imagens, []).slice(0, 1),
    estoque: Math.max(0, Number(product.estoque || 0) - Number(product.estoque_reservado || 0)),
    tamanhos: parseJson(product.tamanhos, []),
    cores: parseJson(product.cores, []),
    categoria_nome: product.categoria_nome || null,
  };
}

async function listFavorites(userId) {
  return (await model.listFavorites(userId)).map(productDto);
}

async function addFavorite(userId, productId) {
  productId = idValue(productId, 'produtoId');
  await getProduct(productId);
  await model.addFavorite(userId, productId);
  return { message: 'Produto adicionado aos favoritos.' };
}

async function removeFavorite(userId, productId) {
  productId = idValue(productId, 'produtoId');
  await model.removeFavorite(userId, productId);
  return { message: 'Produto removido dos favoritos.' };
}

function normalizeCartItems(items) {
  if (!Array.isArray(items) || items.length > MAX_CART_ITEMS) {
    throw createHttpError(400, `O carrinho deve conter até ${MAX_CART_ITEMS} itens.`, 'CART_ITEMS_INVALID');
  }
  return items.map((item, index) => {
    requirePlainObject(item, `Item ${index + 1}`);
    const normalized = {
      productId: idValue(item.productId ?? item.id, `items.${index}.productId`),
      qty: numberValue(item.qty, `items.${index}.qty`, {
        label: 'Quantidade', min: 1, max: 99, integer: true,
      }),
      tamanho: stringValue(item.tamanho, `items.${index}.tamanho`, {
        label: 'Tamanho', required: false, nullable: true, max: 20,
      }),
      cor: stringValue(item.cor, `items.${index}.cor`, {
        label: 'Cor', required: false, nullable: true, max: 50,
      }),
    };
    if (item.personalizacao) {
      requirePlainObject(item.personalizacao, 'Personalização');
      normalized.personalizacao = {
        nome: stringValue(item.personalizacao.nome, `items.${index}.personalizacao.nome`, {
          label: 'Nome personalizado', required: false, nullable: true, max: 18,
        }),
        numero: stringValue(String(item.personalizacao.numero ?? ''), `items.${index}.personalizacao.numero`, {
          label: 'Número personalizado', required: false, nullable: true, max: 2,
        }),
      };
    }
    return normalized;
  });
}

async function getServerCart(userId) {
  const cart = await model.getCart(userId);
  const items = parseJson(cart?.itens, []);
  if (!items.length) return { items: [], updated_at: cart?.updated_at || null };
  try {
    const summary = await buildCartSummary({ items, usuarioId: userId });
    return { items: summary.items, summary, updated_at: cart?.updated_at || null };
  } catch {
    return { items: [], updated_at: cart?.updated_at || null, requires_review: true };
  }
}

async function saveServerCart(userId, data) {
  requirePlainObject(data, 'Carrinho');
  const items = normalizeCartItems(data.items);
  let summary = null;
  if (items.length) summary = await buildCartSummary({ items, usuarioId: userId, uf: data.uf });
  await model.saveCart(userId, items);
  return { message: 'Carrinho sincronizado.', items, summary };
}

async function recordRecentlyViewed(userId, productId) {
  productId = idValue(productId, 'produtoId');
  await getProduct(productId);
  await model.recordRecentlyViewed(userId, productId);
  return { message: 'Visualização registrada.' };
}

async function listRecentlyViewed(userId) {
  return (await model.listRecentlyViewed(userId)).map(productDto);
}

async function listRelatedProducts(productId) {
  productId = idValue(productId, 'produtoId');
  const product = await getProduct(productId);
  return (await model.listRelatedProducts(productId, product.categoria_id, product.time)).map(productDto);
}

async function createRestockAlert(user, productId, data) {
  productId = idValue(productId, 'produtoId');
  requirePlainObject(data || {}, 'Alerta');
  const product = await getProduct(productId);
  const size = stringValue(data.tamanho, 'tamanho', {
    label: 'Tamanho', required: false, nullable: true, max: 20,
  });
  const color = stringValue(data.cor, 'cor', {
    label: 'Cor', required: false, nullable: true, max: 50,
  });
  if (size && !product.tamanhos.map(String).includes(size)) {
    throw createHttpError(400, 'Tamanho não pertence ao produto.', 'PRODUCT_VARIANT_INVALID');
  }
  if (color && !product.cores.map(String).includes(color)) {
    throw createHttpError(400, 'Cor não pertence ao produto.', 'PRODUCT_VARIANT_INVALID');
  }
  await model.createRestockAlert({ userId: user.id, productId, email: user.email, size, color });
  return { message: 'Avisaremos por e-mail quando o produto voltar ao estoque.' };
}

async function cancelRestockAlert(userId, alertId) {
  alertId = idValue(alertId);
  await model.cancelRestockAlert(alertId, userId);
  return { message: 'Alerta cancelado.' };
}

async function createReturnRequest(userId, data) {
  requirePlainObject(data, 'Solicitação');
  const orderId = idValue(data.pedidoId, 'pedidoId');
  const type = enumValue(data.tipo, 'tipo', ['troca', 'devolucao'], { label: 'Tipo' });
  const reason = stringValue(data.motivo, 'motivo', { label: 'Motivo', min: 20, max: 2000 });
  if (!Array.isArray(data.itens) || data.itens.length < 1 || data.itens.length > 50) {
    throw createHttpError(400, 'Selecione entre 1 e 50 itens.', 'RETURN_ITEMS_INVALID');
  }
  const items = [...new Set(data.itens.map((id) => idValue(id, 'itens')))];
  const order = await model.findOwnedOrder(orderId, userId);
  if (!order) throw createHttpError(404, 'Pedido não encontrado.', 'ORDER_NOT_FOUND');
  if (!['enviado', 'entregue'].includes(order.status) || !['paid', 'partially_refunded'].includes(order.payment_status)) {
    throw createHttpError(409, 'Este pedido ainda não está elegível para troca ou devolução.', 'RETURN_NOT_ELIGIBLE');
  }
  const orderedProductIds = new Set((await model.listOrderProductIds(orderId)).map((row) => Number(row.produto_id)));
  if (items.some((productId) => !orderedProductIds.has(productId))) {
    throw createHttpError(400, 'Um ou mais itens não pertencem ao pedido.', 'RETURN_ITEMS_INVALID');
  }
  const referenceDate = Date.parse(order.updated_at || order.created_at);
  if (!Number.isFinite(referenceDate) || Date.now() - referenceDate > 30 * 24 * 60 * 60 * 1000) {
    throw createHttpError(409, 'O prazo de 30 dias para solicitar troca ou devolução expirou.', 'RETURN_WINDOW_EXPIRED');
  }
  const result = await model.createReturnRequest({ orderId, userId, type, reason, items });
  return { id: result.lastID, status: 'solicitada', message: 'Solicitação registrada para análise.' };
}

async function listReturnRequests(userId) {
  return (await model.listReturnRequests(userId)).map((request) => ({
    ...request,
    itens: parseJson(request.itens, []),
  }));
}

async function listReturnRequestsAdmin(status) {
  if (status && !['solicitada', 'em_analise', 'aprovada', 'rejeitada', 'concluida'].includes(status)) {
    throw createHttpError(400, 'Status inválido.', 'VALIDATION_ERROR');
  }
  return (await model.listReturnRequestsAdmin(status)).map((request) => ({
    ...request,
    itens: parseJson(request.itens, []),
  }));
}

async function updateReturnRequest(id, data, moderatorId) {
  id = idValue(id);
  requirePlainObject(data, 'Análise');
  const status = enumValue(data.status, 'status', ['em_analise', 'aprovada', 'rejeitada', 'concluida'], { label: 'Status' });
  const response = stringValue(data.resposta, 'resposta', {
    label: 'Resposta', required: status !== 'em_analise', nullable: status === 'em_analise', min: 5, max: 2000,
  });
  const result = await model.updateReturnRequest(id, { status, response }, moderatorId);
  if (!result.changes) throw createHttpError(404, 'Solicitação não encontrada.', 'RETURN_NOT_FOUND');
  return { message: 'Solicitação atualizada.' };
}

function validateSessionId(value) {
  return stringValue(value, 'sessionId', { label: 'Sessão', min: 16, max: 100 });
}

async function saveConsent(user, data) {
  requirePlainObject(data, 'Consentimento');
  const sessionId = validateSessionId(data.sessionId);
  await model.saveConsent({
    userId: user?.id || null,
    sessionId,
    analytics: data.analytics === true,
    marketing: data.marketing === true,
  });
  return { message: 'Preferências de privacidade salvas.' };
}

async function recordAnalyticsEvent(user, data) {
  requirePlainObject(data, 'Evento');
  const sessionId = validateSessionId(data.sessionId);
  const event = enumValue(data.evento, 'evento', [
    'page_view', 'view_product', 'add_to_cart', 'begin_checkout', 'purchase',
    'search', 'add_favorite', 'request_restock',
  ], { label: 'Evento' });
  const consent = await model.findConsent(sessionId);
  if (!consent || !Boolean(consent.analytics)) return { recorded: false };
  const eventData = data.dados && typeof data.dados === 'object' && !Array.isArray(data.dados) ? data.dados : {};
  const safeData = {};
  for (const [key, value] of Object.entries(eventData).slice(0, 20)) {
    if (/email|nome|cpf|telefone|endereco|token|senha/i.test(key)) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) safeData[String(key).slice(0, 50)] = String(value).slice(0, 200);
  }
  await model.createAnalyticsEvent({ userId: user?.id || null, sessionId, event, data: safeData });
  return { recorded: true };
}

async function analyticsSummary(days = 30) {
  days = numberValue(days, 'dias', { label: 'Período', min: 1, max: 365, integer: true });
  const rows = await model.analyticsSummary(days);
  const totals = Object.fromEntries(rows.map((row) => [row.evento, Number(row.total)]));
  const views = totals.view_product || 0;
  const carts = totals.add_to_cart || 0;
  const checkouts = totals.begin_checkout || 0;
  const purchases = totals.purchase || 0;
  return {
    dias: days,
    eventos: totals,
    conversao: {
      produto_para_carrinho: views ? carts / views : 0,
      carrinho_para_checkout: carts ? checkouts / carts : 0,
      checkout_para_compra: checkouts ? purchases / checkouts : 0,
    },
  };
}

function validateUrl(value, field, { relative = true } = {}) {
  const normalized = stringValue(value, field, { label: field, required: false, nullable: true, max: 2000 });
  if (!normalized) return null;
  if (relative && normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
  let url;
  try { url = new URL(normalized); } catch { throw createHttpError(400, `${field} inválida.`, 'VALIDATION_ERROR'); }
  if (url.protocol !== 'https:') throw createHttpError(400, `${field} deve usar HTTPS.`, 'VALIDATION_ERROR');
  return url.href;
}

function validateBanner(data) {
  requirePlainObject(data, 'Banner');
  const startsAt = data.inicio_em ? new Date(data.inicio_em) : null;
  const endsAt = data.fim_em ? new Date(data.fim_em) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) throw createHttpError(400, 'Data inicial inválida.', 'VALIDATION_ERROR');
  if (endsAt && Number.isNaN(endsAt.getTime())) throw createHttpError(400, 'Data final inválida.', 'VALIDATION_ERROR');
  if (startsAt && endsAt && endsAt <= startsAt) throw createHttpError(400, 'Data final deve ser posterior à inicial.', 'VALIDATION_ERROR');
  return {
    title: stringValue(data.titulo, 'titulo', { label: 'Título', min: 2, max: 120 }),
    subtitle: stringValue(data.subtitulo, 'subtitulo', { label: 'Subtítulo', required: false, nullable: true, max: 300 }),
    imageUrl: validateUrl(data.imagem_url, 'imagem_url', { relative: false }),
    linkUrl: validateUrl(data.link_url, 'link_url'),
    position: enumValue(data.posicao, 'posicao', ['home_hero', 'home_secundario'], { label: 'Posição', fallback: 'home_hero' }),
    status: enumValue(data.status, 'status', ['ativo', 'inativo'], { label: 'Status', fallback: 'ativo' }),
    order: numberValue(data.ordem ?? 0, 'ordem', { label: 'Ordem', min: 0, max: 1000, integer: true }),
    startsAt: startsAt?.toISOString() || null,
    endsAt: endsAt?.toISOString() || null,
  };
}

async function createBanner(data) {
  const result = await model.createBanner(validateBanner(data));
  return { id: result.lastID, message: 'Banner criado.' };
}

async function updateBanner(id, data) {
  id = idValue(id);
  const result = await model.updateBanner(id, validateBanner(data));
  if (!result.changes) throw createHttpError(404, 'Banner não encontrado.', 'BANNER_NOT_FOUND');
  return { message: 'Banner atualizado.' };
}

async function deleteBanner(id) {
  id = idValue(id);
  const result = await model.deleteBanner(id);
  if (!result.changes) throw createHttpError(404, 'Banner não encontrado.', 'BANNER_NOT_FOUND');
  return { message: 'Banner excluído.' };
}

async function saveContent(data) {
  requirePlainObject(data, 'Conteúdo');
  const normalized = {
    key: stringValue(data.chave, 'chave', { label: 'Chave', min: 2, max: 80 }).toLowerCase(),
    title: stringValue(data.titulo, 'titulo', { label: 'Título', min: 2, max: 160 }),
    content: stringValue(data.conteudo, 'conteudo', { label: 'Conteúdo', min: 2, max: 20000 }),
    status: enumValue(data.status, 'status', ['ativo', 'inativo'], { label: 'Status', fallback: 'ativo' }),
  };
  if (!/^[a-z0-9_-]+$/.test(normalized.key)) throw createHttpError(400, 'Chave inválida.', 'VALIDATION_ERROR');
  await model.saveContent(normalized);
  return { message: 'Conteúdo salvo.' };
}

async function processAbandonedCarts() {
  if (!process.env.RESEND_API_KEY || !process.env.FRONTEND_URL) return { processed: 0 };
  const carts = await model.listAbandonedCarts(2);
  let processed = 0;
  for (const cart of carts) {
    try {
      const cartUrl = `${String(process.env.FRONTEND_URL).replace(/\/$/, '')}/carrinho`;
      await emailService.enviarCarrinhoAbandonado(cart.email, { nome: cart.nome, cartUrl });
      await model.markAbandonmentSent(cart.id);
      processed += 1;
    } catch (error) {
      console.error('[cart:abandonment-email:error]', error.message);
    }
  }
  return { processed };
}

async function processRestockAlerts() {
  if (!process.env.RESEND_API_KEY || !process.env.FRONTEND_URL) return { processed: 0 };
  const baseUrl = String(process.env.FRONTEND_URL).replace(/\/$/, '');
  const alerts = await model.listReadyRestockAlerts();
  let processed = 0;
  for (const alert of alerts) {
    try {
      const slug = encodeURIComponent(alert.slug || 'produto');
      await emailService.enviarAlertaReposicao(alert.email, {
        produtoNome: alert.produto_nome,
        tamanho: alert.tamanho,
        cor: alert.cor,
        productUrl: `${baseUrl}/p/${slug}/${alert.produto_id}`,
      });
      await model.markRestockAlertSent(alert.id);
      processed += 1;
    } catch (error) {
      console.error('[restock-email:error]', error.message);
    }
  }
  return { processed };
}

module.exports = {
  addFavorite, analyticsSummary, cancelRestockAlert, createBanner, createRestockAlert,
  createReturnRequest, deleteBanner, getServerCart, listFavorites, listRecentlyViewed,
  listRelatedProducts, listReturnRequests, listReturnRequestsAdmin, recordAnalyticsEvent,
  processAbandonedCarts, processRestockAlerts, recordRecentlyViewed, removeFavorite, saveConsent, saveContent, saveServerCart,
  updateBanner, updateReturnRequest,
  listRestockAlerts: model.listRestockAlerts,
  listPublicBanners: model.listPublicBanners,
  listBannersAdmin: model.listBannersAdmin,
  listPublicContent: model.listPublicContent,
  listContentAdmin: model.listContentAdmin,
};
