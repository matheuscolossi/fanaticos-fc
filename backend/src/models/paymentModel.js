const database = require('../config/database');

function createCheckoutDraft(draft, db = database) {
  return db.run(
    `INSERT INTO checkout_drafts (
       id, usuario_id, itens, subtotal, frete, desconto, total, currency,
       nome_cliente, email_cliente, telefone_cliente, endereco, uf, cupom_codigo, status
     ) VALUES (?, ?, JSON_VALUE(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.usuario_id,
      JSON.stringify(draft.itens),
      draft.subtotal,
      draft.frete,
      draft.desconto,
      draft.total,
      draft.currency || 'BRL',
      draft.nome_cliente || null,
      draft.email_cliente || null,
      draft.telefone_cliente || null,
      draft.endereco || null,
      draft.uf || null,
      draft.cupom_codigo || null,
      draft.status || 'created',
    ]
  );
}

function attachStripeSession(draftId, sessionId, db = database) {
  return db.run(
    `UPDATE checkout_drafts
     SET stripe_session_id = ?, status = 'session_created', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [sessionId, draftId]
  );
}

function findDraftById(id, db = database) {
  return db.get('SELECT * FROM checkout_drafts WHERE id = ?', [id]);
}

function findDraftBySession(sessionId, db = database) {
  return db.get('SELECT * FROM checkout_drafts WHERE stripe_session_id = ?', [sessionId]);
}

function findDraftBySessionForUser(sessionId, userId, db = database) {
  return db.get(
    'SELECT id, stripe_session_id, status, total, currency, created_at, updated_at FROM checkout_drafts WHERE stripe_session_id = ? AND usuario_id = ?',
    [sessionId, userId]
  );
}

function updateDraftStatus(id, status, db = database) {
  return db.run(
    'UPDATE checkout_drafts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
}

function findWebhookEvent(id, db = database) {
  return db.get('SELECT id, type, created_at FROM stripe_webhook_events WHERE id = ?', [id]);
}

function createWebhookEvent(id, type, db = database) {
  return db.run(
    'INSERT INTO stripe_webhook_events (id, type) VALUES (?, ?)',
    [id, type]
  );
}

module.exports = {
  attachStripeSession,
  createCheckoutDraft,
  createWebhookEvent,
  findDraftById,
  findDraftBySession,
  findDraftBySessionForUser,
  findWebhookEvent,
  updateDraftStatus,
};
