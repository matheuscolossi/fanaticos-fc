const database = require('../config/database');
const inventoryModel = require('./inventoryModel');
const { createHttpError } = require('../utils/http');

function createCheckoutDraft(draft, db = database) {
  return db.run(
    `INSERT INTO checkout_drafts (
       id, usuario_id, itens, subtotal, frete, desconto, total, currency,
       nome_cliente, email_cliente, telefone_cliente, endereco, uf, cupom_codigo, status,
       stock_status, stock_expires_at, prazo_entrega_min, prazo_entrega_max, previsao_entrega, transportadora
     ) VALUES (?, ?, JSON_VALUE(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      draft.stock_status || 'none',
      draft.stock_expires_at || null,
      draft.prazo_entrega_min ?? null,
      draft.prazo_entrega_max ?? null,
      draft.previsao_entrega || null,
      draft.transportadora || null,
    ]
  );
}

async function releaseDraftStock(checkoutId, status, db) {
  if (!db) {
    return database.transaction((tx) => releaseDraftStock(checkoutId, status, tx));
  }

  const draft = await db.get(
    'SELECT id, itens, stock_status FROM checkout_drafts WHERE id = ?',
    [checkoutId]
  );
  if (!draft) return null;
  if (draft.stock_status === 'released' || draft.stock_status === 'committed') return draft;

  if (draft.stock_status === 'reserved') {
    const claim = await db.run(
      `UPDATE checkout_drafts SET stock_status = 'releasing'
       WHERE id = ? AND stock_status = 'reserved'`,
      [checkoutId]
    );
    if (Number(claim.changes) !== 1) return findDraftById(checkoutId, db);
    await inventoryModel.release(draft.itens, db);
  }

  await db.run(
    `UPDATE checkout_drafts
     SET stock_status = 'released', status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND stock_status IN ('none', 'releasing')`,
    [status, checkoutId]
  );
  return findDraftById(checkoutId, db);
}

async function releaseExpiredReservations(db, now = new Date()) {
  if (!db) {
    return database.transaction((tx) => releaseExpiredReservations(tx, now));
  }

  const expired = await db.all(
    `SELECT id FROM checkout_drafts
     WHERE stock_status = 'reserved' AND stock_expires_at IS NOT NULL AND stock_expires_at <= ?`,
    [now.toISOString()]
  );
  for (const draft of expired) {
    await releaseDraftStock(draft.id, 'expired', db);
  }
  return expired.length;
}

function createReservedCheckoutDraft(draft, expiresAt) {
  return database.transaction(async (db) => {
    await releaseExpiredReservations(db);
    await inventoryModel.reserve(draft.itens, db);
    return createCheckoutDraft({
      ...draft,
      stock_status: 'reserved',
      stock_expires_at: expiresAt,
    }, db);
  });
}

async function commitDraftStock(checkoutId, db) {
  const draft = await db.get(
    'SELECT id, itens, stock_status FROM checkout_drafts WHERE id = ?',
    [checkoutId]
  );
  if (!draft) throw createHttpError(404, 'Checkout interno não encontrado.', 'CHECKOUT_DRAFT_NOT_FOUND');
  if (draft.stock_status === 'committed') return draft;
  if (!['reserved', 'none', 'released'].includes(draft.stock_status)) {
    throw createHttpError(409, 'Movimentação de estoque já está em andamento.', 'STOCK_TRANSITION_IN_PROGRESS');
  }

  const sourceStatus = draft.stock_status;
  const claim = await db.run(
    `UPDATE checkout_drafts SET stock_status = 'committing'
     WHERE id = ? AND stock_status = ?`,
    [checkoutId, sourceStatus]
  );
  if (Number(claim.changes) !== 1) {
    throw createHttpError(409, 'Movimentação de estoque concorrente.', 'STOCK_TRANSITION_IN_PROGRESS');
  }

  await inventoryModel.commit(draft.itens, db, { reserved: sourceStatus === 'reserved' });
  await db.run(
    `UPDATE checkout_drafts SET stock_status = 'committed', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND stock_status = 'committing'`,
    [checkoutId]
  );
  return { ...draft, stock_status: 'committed' };
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
  commitDraftStock,
  createCheckoutDraft,
  createReservedCheckoutDraft,
  createWebhookEvent,
  findDraftById,
  findDraftBySession,
  findDraftBySessionForUser,
  findWebhookEvent,
  releaseDraftStock,
  releaseExpiredReservations,
  updateDraftStatus,
};
