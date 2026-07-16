const { sendCreated } = require('../utils/http');
const logService = require('../services/logService');
const {
  createReview,
  listProductReviews,
  listReviewsAdmin,
  moderateReview,
  updateReview,
} = require('../services/reviewService');

async function productReviews(req, res) {
  res.json(await listProductReviews(req.params.produtoId, req.user));
}

async function store(req, res) {
  sendCreated(res, await createReview(req.params.produtoId, req.body, req.user));
}

async function update(req, res) {
  res.json(await updateReview(req.params.id, req.body, req.user));
}

async function adminIndex(req, res) {
  res.json(await listReviewsAdmin(req.query.status));
}

async function moderate(req, res) {
  const result = await moderateReview(req.params.id, req.body, req.staffUser);
  await logService.registrar(
    req.staffUser,
    req.body.status === 'aprovada' ? 'Avaliação aprovada' : 'Avaliação rejeitada',
    `Avaliação ID ${req.params.id}`
  );
  res.json(result);
}

module.exports = { adminIndex, moderate, productReviews, store, update };
