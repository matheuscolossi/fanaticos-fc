const { getProduct } = require('./productService');
const couponService = require('./couponService');
const { createHttpError } = require('../utils/http');

function calculateFreight(subtotal) {
  return subtotal >= 200 ? 0 : 25;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function buildCartSummary({ items, cupomCode, usuarioId }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, 'Informe ao menos um item no carrinho (items: [{productId, qty}]).', 'CART_ITEMS_REQUIRED');
  }

  const resolvedItems = [];
  for (const item of items) {
    const qty = Number(item?.qty);
    if (!item?.productId || !Number.isInteger(qty) || qty < 1) {
      throw createHttpError(400, 'Cada item precisa de productId e qty inteiro >= 1.', 'CART_ITEM_INVALID');
    }

    const product = await getProduct(item.productId); // lança 404 se o produto não existir
    const price = Number(product.preco_promocional ?? product.preco);
    resolvedItems.push({
      productId: product.id,
      categoria_id: product.categoria_id,
      name: product.nome,
      preco: price,
      price,
      qty,
      image: product.imagens[0] || null,
    });
  }

  const subtotal = round2(resolvedItems.reduce((sum, item) => sum + item.price * item.qty, 0));

  let freight = calculateFreight(subtotal);
  let discount = 0;
  let cupomErro = null;

  if (cupomCode) {
    try {
      const resultado = await couponService.validateCoupon(cupomCode, { subtotal, itens: resolvedItems, usuarioId });
      discount = resultado.desconto;
      if (resultado.freteGratis) freight = 0;
    } catch (e) {
      cupomErro = e.message || 'Cupom inválido.';
    }
  }

  const total = round2(subtotal + freight - discount);

  const resposta = {
    items: resolvedItems.map(({ productId, name, price, qty, image }) => ({ productId, name, price, qty, image })),
    subtotal, freight, discount, total,
  };
  if (cupomErro) resposta.cupomErro = cupomErro;
  return resposta;
}

module.exports = {
  buildCartSummary,
};
