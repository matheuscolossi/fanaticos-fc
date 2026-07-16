const reviewModel = require('../models/reviewModel');
const { transaction } = require('../config/database');
const { createHttpError } = require('../utils/http');
const { REVIEW_STATUSES, validateModeration, validateReview } = require('../validation/reviewSchemas');
const { numberValue } = require('../validation/commonSchemas');

function positiveId(value, field, label) {
  return numberValue(value, field, {
    label,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
  });
}

function serializeReview(review) {
  return {
    id: review.id,
    autor_nome: review.autor_nome,
    nota: Number(review.nota),
    titulo: review.titulo || null,
    comentario: review.comentario,
    compra_verificada: Boolean(review.compra_verificada),
    created_at: review.created_at,
  };
}

function reviewSummary(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews) distribution[Number(review.nota)] += 1;
  const average = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.nota), 0) / reviews.length
    : 0;
  return {
    total: reviews.length,
    media: Math.round(average * 10) / 10,
    distribuicao: distribution,
  };
}

async function listProductReviews(productId, user = null) {
  productId = positiveId(productId, 'produtoId', 'Produto');
  const reviews = await reviewModel.listApproved(productId);
  let ownReview = null;
  let eligiblePurchase = null;
  if (user?.id) {
    [ownReview, eligiblePurchase] = await Promise.all([
      reviewModel.findByUserAndProduct(user.id, productId),
      reviewModel.findEligiblePurchase(user.id, productId),
    ]);
  }
  return {
    resumo: reviewSummary(reviews),
    avaliacoes: reviews.map(serializeReview),
    autenticado: Boolean(user?.id),
    pode_avaliar: Boolean(user?.id && eligiblePurchase),
    minha_avaliacao: ownReview ? {
      id: ownReview.id,
      nota: Number(ownReview.nota),
      titulo: ownReview.titulo || null,
      comentario: ownReview.comentario,
      status: ownReview.status,
      motivo_moderacao: ownReview.motivo_moderacao || null,
      updated_at: ownReview.updated_at,
    } : null,
  };
}

async function createReview(productId, data, user) {
  productId = positiveId(productId, 'produtoId', 'Produto');
  const normalized = validateReview(data);
  try {
    return await transaction(async (db) => {
      const purchase = await reviewModel.findEligiblePurchase(user.id, productId, db);
      if (!purchase) {
        throw createHttpError(
          403,
          'Somente compradores com pagamento confirmado podem avaliar este produto.',
          'VERIFIED_PURCHASE_REQUIRED'
        );
      }
      const existing = await reviewModel.findByUserAndProduct(user.id, productId, db);
      if (existing) {
        throw createHttpError(409, 'Você já avaliou este produto. Edite sua avaliação existente.', 'REVIEW_ALREADY_EXISTS');
      }
      const result = await reviewModel.create({
        ...normalized,
        produto_id: productId,
        usuario_id: user.id,
        pedido_id: purchase.pedido_id,
        pedido_item_id: purchase.pedido_item_id,
        autor_nome: user.nome,
      }, db);
      return { id: result.lastID, status: 'pendente', message: 'Avaliação enviada para moderação.' };
    });
  } catch (error) {
    const duplicateReview = error?.code === '23505'
      || /UNIQUE constraint failed: avaliacoes\.usuario_id, avaliacoes\.produto_id/i.test(error?.message || '');
    if (duplicateReview) {
      throw createHttpError(409, 'Você já avaliou este produto. Edite sua avaliação existente.', 'REVIEW_ALREADY_EXISTS');
    }
    throw error;
  }
}

async function updateReview(reviewId, data, user) {
  reviewId = positiveId(reviewId, 'id', 'Avaliação');
  const normalized = validateReview(data);
  return transaction(async (db) => {
    const existing = await reviewModel.findOwnedById(reviewId, user.id, db);
    if (!existing) throw createHttpError(404, 'Avaliação não encontrada.', 'REVIEW_NOT_FOUND');
    const purchase = await reviewModel.findEligiblePurchase(user.id, existing.produto_id, db);
    if (!purchase) {
      throw createHttpError(403, 'A compra vinculada não está elegível.', 'VERIFIED_PURCHASE_REQUIRED');
    }
    await reviewModel.updateOwned(reviewId, user.id, purchase, {
      ...normalized,
      autor_nome: user.nome,
    }, db);
    return { status: 'pendente', message: 'Avaliação atualizada e reenviada para moderação.' };
  });
}

async function listReviewsAdmin(status) {
  if (status && !REVIEW_STATUSES.includes(status)) {
    throw createHttpError(400, 'Status de avaliação inválido.', 'VALIDATION_ERROR');
  }
  return reviewModel.listAdmin(status || null);
}

async function moderateReview(reviewId, data, moderator) {
  reviewId = positiveId(reviewId, 'id', 'Avaliação');
  const moderation = validateModeration(data);
  return transaction(async (db) => {
    const review = await reviewModel.findById(reviewId, db);
    if (!review) throw createHttpError(404, 'Avaliação não encontrada.', 'REVIEW_NOT_FOUND');
    await reviewModel.moderate(reviewId, {
      ...moderation,
      moderatorId: moderator.id,
    }, db);
    return { message: moderation.status === 'aprovada' ? 'Avaliação aprovada.' : 'Avaliação rejeitada.' };
  });
}

module.exports = {
  createReview,
  listProductReviews,
  listReviewsAdmin,
  moderateReview,
  updateReview,
};
