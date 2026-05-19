const { all, get, run } = require('../config/database');

function create(order) {
  return run(
    `INSERT INTO pedidos (usuario_id, itens, total, nome_cliente, email_cliente, telefone_cliente, endereco, metodo_pagamento, status)
     VALUES (?, JSON_VALUE(?), ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.usuario_id,
      order.itens,
      order.total,
      order.nome_cliente,
      order.email_cliente,
      order.telefone_cliente,
      order.endereco,
      order.metodo_pagamento,
      order.status,
    ]
  );
}

function list() {
  return all('SELECT * FROM pedidos ORDER BY created_at DESC');
}

function listByUser(user) {
  return all('SELECT * FROM pedidos WHERE email_cliente = ? OR usuario_id = ? ORDER BY created_at DESC', [
    user.email,
    user.id,
  ]);
}

function findTrackingById(orderId) {
  return get(
    'SELECT id, status, codigo_rastreio, metodo_pagamento, total, nome_cliente, created_at FROM pedidos WHERE id = ?',
    [orderId]
  );
}

function exists(orderId) {
  return get('SELECT id FROM pedidos WHERE id = ?', [orderId]);
}

function updateTracking(orderId, { status, codigo_rastreio }) {
  return run(
    'UPDATE pedidos SET status = COALESCE(?, status), codigo_rastreio = COALESCE(?, codigo_rastreio) WHERE id = ?',
    [status || null, codigo_rastreio !== undefined ? codigo_rastreio : null, orderId]
  );
}

module.exports = {
  create,
  exists,
  findTrackingById,
  list,
  listByUser,
  updateTracking,
};
