const database = require('../config/database');

function listFavorites(userId) {
  return database.all(
    `SELECT p.id, p.nome, p.slug, p.preco, p.preco_promocional, p.imagens,
            p.estoque, p.estoque_reservado, p.tamanhos, p.cores,
            c.nome AS categoria_nome, f.created_at AS favoritado_em
     FROM favoritos f
     JOIN produtos p ON p.id = f.produto_id AND p.status = 'ativo'
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE f.usuario_id = ?
     ORDER BY f.created_at DESC`,
    [userId]
  );
}

function addFavorite(userId, productId) {
  return database.run(
    `INSERT INTO favoritos (usuario_id, produto_id) VALUES (?, ?)
     ON CONFLICT(usuario_id, produto_id) DO NOTHING`,
    [userId, productId]
  );
}

function removeFavorite(userId, productId) {
  return database.run('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [userId, productId]);
}

function getCart(userId) {
  return database.get('SELECT itens, updated_at FROM carrinhos_usuario WHERE usuario_id = ?', [userId]);
}

function saveCart(userId, items) {
  return database.run(
    `INSERT INTO carrinhos_usuario (usuario_id, itens, updated_at)
     VALUES (?, JSON_VALUE(?), CURRENT_TIMESTAMP)
     ON CONFLICT(usuario_id) DO UPDATE SET
       itens = excluded.itens, updated_at = CURRENT_TIMESTAMP,
       lembrete_enviado_em = NULL, convertido_em = NULL`,
    [userId, JSON.stringify(items)]
  );
}

function markCartConverted(userId, db = database) {
  return db.run(
    `UPDATE carrinhos_usuario SET itens = JSON_VALUE(?), convertido_em = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE usuario_id = ?`,
    ['[]', userId]
  );
}

function listAbandonedCarts(hours = 2) {
  const modifier = `-${Number(hours)} hours`;
  if (database.isUsingPostgres()) {
    return database.all(
      `SELECT c.id, c.usuario_id, c.itens, c.updated_at, u.nome, u.email
       FROM carrinhos_usuario c JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.lembrete_enviado_em IS NULL AND c.convertido_em IS NULL
         AND jsonb_array_length(c.itens) > 0
         AND EXISTS (SELECT 1 FROM analytics_consents ac WHERE ac.usuario_id = c.usuario_id AND ac.marketing = TRUE)
         AND c.updated_at <= now() - (? * interval '1 hour')
       LIMIT 100`,
      [Number(hours)]
    );
  }
  return database.all(
    `SELECT c.id, c.usuario_id, c.itens, c.updated_at, u.nome, u.email
     FROM carrinhos_usuario c JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.lembrete_enviado_em IS NULL AND c.convertido_em IS NULL
       AND json_array_length(c.itens) > 0
       AND EXISTS (SELECT 1 FROM analytics_consents ac WHERE ac.usuario_id = c.usuario_id AND ac.marketing = 1)
       AND c.updated_at <= datetime('now', ?)
     LIMIT 100`,
    [modifier]
  );
}

function markAbandonmentSent(cartId) {
  return database.run('UPDATE carrinhos_usuario SET lembrete_enviado_em = CURRENT_TIMESTAMP WHERE id = ?', [cartId]);
}

function recordRecentlyViewed(userId, productId) {
  return database.run(
    `INSERT INTO vistos_recentemente (usuario_id, produto_id, viewed_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(usuario_id, produto_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
    [userId, productId]
  );
}

function listRecentlyViewed(userId) {
  return database.all(
    `SELECT p.id, p.nome, p.slug, p.preco, p.preco_promocional, p.imagens,
            p.estoque, p.estoque_reservado, p.tamanhos, p.cores,
            c.nome AS categoria_nome, v.viewed_at
     FROM vistos_recentemente v
     JOIN produtos p ON p.id = v.produto_id AND p.status = 'ativo'
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE v.usuario_id = ? ORDER BY v.viewed_at DESC LIMIT 12`,
    [userId]
  );
}

function listRelatedProducts(productId, categoryId, team) {
  return database.all(
    `SELECT p.id, p.nome, p.slug, p.preco, p.preco_promocional, p.imagens,
            p.estoque, p.estoque_reservado, p.tamanhos, p.cores,
            c.nome AS categoria_nome
     FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.status = 'ativo' AND p.id <> ?
       AND (p.categoria_id = ? OR (? IS NOT NULL AND p.time = ?))
     ORDER BY CASE WHEN ? IS NOT NULL AND p.time = ? THEN 0 ELSE 1 END,
              p.destaque DESC, p.created_at DESC
     LIMIT 8`,
    [productId, categoryId || -1, team || null, team || null, team || null, team || null]
  );
}

function createRestockAlert(data) {
  return database.run(
    `INSERT INTO alertas_reposicao (usuario_id, produto_id, email, tamanho, cor, status)
     VALUES (?, ?, ?, ?, ?, 'ativo')
     ON CONFLICT(email, produto_id, tamanho, cor) DO UPDATE SET
       usuario_id = excluded.usuario_id, status = 'ativo', enviado_em = NULL`,
    [data.userId, data.productId, data.email, data.size || '', data.color || '']
  );
}

function listReadyRestockAlerts() {
  return database.all(
    `SELECT a.id, a.email, a.tamanho, a.cor, p.id AS produto_id, p.nome AS produto_nome, p.slug,
            COALESCE(cv.estoque - cv.estoque_reservado, v.estoque - v.estoque_reservado, p.estoque - COALESCE(p.estoque_reservado, 0)) AS disponivel
     FROM alertas_reposicao a
     JOIN produtos p ON p.id = a.produto_id AND p.status = 'ativo'
     LEFT JOIN produto_variantes v ON v.produto_id = p.id AND v.tamanho = a.tamanho
     LEFT JOIN produto_variantes_cores cv ON cv.produto_id = p.id AND cv.tamanho = a.tamanho AND cv.cor = a.cor
     WHERE a.status = 'ativo'
       AND COALESCE(cv.estoque - cv.estoque_reservado, v.estoque - v.estoque_reservado, p.estoque - COALESCE(p.estoque_reservado, 0)) > 0
     ORDER BY a.created_at ASC LIMIT 100`
  );
}

function markRestockAlertSent(id) {
  return database.run(
    "UPDATE alertas_reposicao SET status = 'enviado', enviado_em = CURRENT_TIMESTAMP WHERE id = ? AND status = 'ativo'",
    [id]
  );
}

function listRestockAlerts(userId) {
  return database.all(
    `SELECT a.id, a.produto_id, a.tamanho, a.cor, a.status, a.created_at, p.nome AS produto_nome
     FROM alertas_reposicao a JOIN produtos p ON p.id = a.produto_id
     WHERE a.usuario_id = ? ORDER BY a.created_at DESC`,
    [userId]
  );
}

function cancelRestockAlert(alertId, userId) {
  return database.run(
    "UPDATE alertas_reposicao SET status = 'cancelado' WHERE id = ? AND usuario_id = ?",
    [alertId, userId]
  );
}

function findOwnedOrder(orderId, userId) {
  return database.get(
    `SELECT id, usuario_id, status, payment_status, created_at, updated_at
     FROM pedidos WHERE id = ? AND usuario_id = ?`,
    [orderId, userId]
  );
}

function listOrderProductIds(orderId) {
  return database.all('SELECT produto_id FROM pedido_itens WHERE pedido_id = ?', [orderId]);
}

function createReturnRequest(data) {
  return database.run(
    `INSERT INTO solicitacoes_troca (pedido_id, usuario_id, tipo, motivo, itens)
     VALUES (?, ?, ?, ?, JSON_VALUE(?))`,
    [data.orderId, data.userId, data.type, data.reason, JSON.stringify(data.items)]
  );
}

function listReturnRequests(userId) {
  return database.all(
    `SELECT id, pedido_id, tipo, motivo, itens, status, resposta_admin, created_at, updated_at
     FROM solicitacoes_troca WHERE usuario_id = ? ORDER BY created_at DESC`,
    [userId]
  );
}

function listReturnRequestsAdmin(status) {
  const where = status ? 'WHERE s.status = ?' : '';
  return database.all(
    `SELECT s.*, u.nome AS cliente_nome, u.email AS cliente_email
     FROM solicitacoes_troca s JOIN usuarios u ON u.id = s.usuario_id
     ${where} ORDER BY s.created_at DESC LIMIT 500`,
    status ? [status] : []
  );
}

function updateReturnRequest(id, data, moderatorId) {
  return database.run(
    `UPDATE solicitacoes_troca SET status = ?, resposta_admin = ?, analisado_por = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [data.status, data.response, moderatorId, id]
  );
}

function saveConsent(data) {
  return database.run(
    `INSERT INTO analytics_consents (usuario_id, session_id, analytics, marketing, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(session_id) DO UPDATE SET usuario_id = COALESCE(excluded.usuario_id, analytics_consents.usuario_id),
       analytics = excluded.analytics, marketing = excluded.marketing, updated_at = CURRENT_TIMESTAMP`,
    [data.userId, data.sessionId, Boolean(data.analytics), Boolean(data.marketing)]
  );
}

function findConsent(sessionId) {
  return database.get('SELECT analytics, marketing FROM analytics_consents WHERE session_id = ?', [sessionId]);
}

function createAnalyticsEvent(data) {
  return database.run(
    `INSERT INTO analytics_eventos (usuario_id, session_id, evento, dados)
     VALUES (?, ?, ?, JSON_VALUE(?))`,
    [data.userId, data.sessionId, data.event, JSON.stringify(data.data)]
  );
}

function analyticsSummary(days) {
  if (database.isUsingPostgres()) {
    return database.all(
      `SELECT evento, COUNT(*) AS total FROM analytics_eventos
       WHERE created_at >= now() - (? * interval '1 day') GROUP BY evento ORDER BY total DESC`,
      [days]
    );
  }
  return database.all(
    `SELECT evento, COUNT(*) AS total FROM analytics_eventos
     WHERE created_at >= datetime('now', ?) GROUP BY evento ORDER BY total DESC`,
    [`-${days} days`]
  );
}

function listPublicBanners(position) {
  return database.all(
    `SELECT id, titulo, subtitulo, imagem_url, link_url, posicao
     FROM banners WHERE status = 'ativo' AND posicao = ?
       AND (inicio_em IS NULL OR inicio_em <= CURRENT_TIMESTAMP)
       AND (fim_em IS NULL OR fim_em >= CURRENT_TIMESTAMP)
     ORDER BY ordem ASC, id DESC`,
    [position]
  );
}

function listBannersAdmin() {
  return database.all('SELECT * FROM banners ORDER BY posicao, ordem, id DESC');
}

function createBanner(data) {
  return database.run(
    `INSERT INTO banners (titulo, subtitulo, imagem_url, link_url, posicao, status, ordem, inicio_em, fim_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.title, data.subtitle, data.imageUrl, data.linkUrl, data.position, data.status, data.order, data.startsAt, data.endsAt]
  );
}

function updateBanner(id, data) {
  return database.run(
    `UPDATE banners SET titulo = ?, subtitulo = ?, imagem_url = ?, link_url = ?, posicao = ?,
       status = ?, ordem = ?, inicio_em = ?, fim_em = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [data.title, data.subtitle, data.imageUrl, data.linkUrl, data.position, data.status, data.order, data.startsAt, data.endsAt, id]
  );
}

function deleteBanner(id) {
  return database.run('DELETE FROM banners WHERE id = ?', [id]);
}

function listPublicContent() {
  return database.all("SELECT chave, titulo, conteudo, updated_at FROM conteudos_institucionais WHERE status = 'ativo'");
}

function listContentAdmin() {
  return database.all('SELECT * FROM conteudos_institucionais ORDER BY chave');
}

function saveContent(data) {
  return database.run(
    `INSERT INTO conteudos_institucionais (chave, titulo, conteudo, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET titulo = excluded.titulo, conteudo = excluded.conteudo,
       status = excluded.status, updated_at = CURRENT_TIMESTAMP`,
    [data.key, data.title, data.content, data.status]
  );
}

module.exports = {
  addFavorite, analyticsSummary, cancelRestockAlert, createAnalyticsEvent, createBanner,
  createRestockAlert, createReturnRequest, deleteBanner, findConsent, findOwnedOrder,
  getCart, listAbandonedCarts, listBannersAdmin, listContentAdmin, listFavorites, listOrderProductIds,
  listPublicBanners, listPublicContent, listRecentlyViewed, listRelatedProducts,
  listReadyRestockAlerts, listRestockAlerts, listReturnRequests, listReturnRequestsAdmin, markAbandonmentSent,
  markRestockAlertSent,
  markCartConverted, recordRecentlyViewed, removeFavorite, saveCart, saveConsent,
  saveContent, updateBanner, updateReturnRequest,
};
