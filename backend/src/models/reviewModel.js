const database = require('../config/database');

function findEligiblePurchase(userId, productId, db = database) {
  return db.get(
    `SELECT p.id AS pedido_id, pi.id AS pedido_item_id
     FROM pedidos p
     JOIN pedido_itens pi ON pi.pedido_id = p.id
     WHERE p.usuario_id = ? AND pi.produto_id = ?
       AND p.payment_status IN ('paid', 'partially_refunded')
       AND p.status <> 'cancelado'
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 1`,
    [userId, productId]
  );
}

function findByUserAndProduct(userId, productId, db = database) {
  return db.get(
    `SELECT id, produto_id, nota, titulo, comentario, status, motivo_moderacao,
            compra_verificada, created_at, updated_at
     FROM avaliacoes WHERE usuario_id = ? AND produto_id = ?`,
    [userId, productId]
  );
}

function findOwnedById(reviewId, userId, db = database) {
  return db.get('SELECT * FROM avaliacoes WHERE id = ? AND usuario_id = ?', [reviewId, userId]);
}

function findById(reviewId, db = database) {
  return db.get('SELECT * FROM avaliacoes WHERE id = ?', [reviewId]);
}

function create(data, db = database) {
  return db.run(
    `INSERT INTO avaliacoes (
       produto_id, usuario_id, pedido_id, pedido_item_id, autor_nome,
       nota, titulo, comentario, compra_verificada, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
    [
      data.produto_id,
      data.usuario_id,
      data.pedido_id,
      data.pedido_item_id,
      data.autor_nome,
      data.nota,
      data.titulo,
      data.comentario,
      1,
    ]
  );
}

function updateOwned(reviewId, userId, purchase, data, db = database) {
  return db.run(
    `UPDATE avaliacoes SET
       pedido_id = ?, pedido_item_id = ?, autor_nome = ?, nota = ?, titulo = ?, comentario = ?,
       compra_verificada = ?, status = 'pendente', motivo_moderacao = NULL,
       moderado_por = NULL, moderado_em = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND usuario_id = ?`,
    [
      purchase.pedido_id,
      purchase.pedido_item_id,
      data.autor_nome,
      data.nota,
      data.titulo,
      data.comentario,
      1,
      reviewId,
      userId,
    ]
  );
}

function listApproved(productId) {
  return database.all(
    `SELECT a.id, a.autor_nome, a.nota, a.titulo, a.comentario,
            a.compra_verificada, a.created_at
     FROM avaliacoes a
     JOIN pedidos ped ON ped.id = a.pedido_id
     JOIN pedido_itens pi ON pi.id = a.pedido_item_id
       AND pi.pedido_id = ped.id
       AND pi.produto_id = a.produto_id
     WHERE a.produto_id = ? AND a.status = 'aprovada' AND a.compra_verificada = ?
     ORDER BY a.created_at DESC, a.id DESC`,
    [productId, 1]
  );
}

function listAdmin(status = null) {
  const where = status ? 'WHERE a.status = ?' : '';
  return database.all(
    `SELECT a.id, a.produto_id, a.usuario_id, a.pedido_id, a.autor_nome,
            a.nota, a.titulo, a.comentario, a.compra_verificada, a.status,
            a.motivo_moderacao, a.moderado_por, a.moderado_em,
            a.created_at, a.updated_at, p.nome AS produto_nome
     FROM avaliacoes a
     JOIN produtos p ON p.id = a.produto_id
     ${where}
     ORDER BY CASE WHEN a.status = 'pendente' THEN 0 ELSE 1 END,
              a.created_at DESC, a.id DESC
     LIMIT 500`,
    status ? [status] : []
  );
}

function moderate(reviewId, { status, motivo, moderatorId }, db = database) {
  return db.run(
    `UPDATE avaliacoes SET status = ?, motivo_moderacao = ?, moderado_por = ?,
       moderado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, motivo || null, moderatorId || null, reviewId]
  );
}

module.exports = {
  create,
  findById,
  findByUserAndProduct,
  findEligiblePurchase,
  findOwnedById,
  listAdmin,
  listApproved,
  moderate,
  updateOwned,
};
