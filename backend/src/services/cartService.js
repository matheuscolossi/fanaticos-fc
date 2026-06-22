const { getProduct } = require('./productService');
const { createHttpError } = require('../utils/http');

// Cupons simples exigidos pelo PDF (ex.: URI10 -> 10% de desconto)
const COUPONS = {
  URI10: 0.10,
};

function calculateFreight(subtotal) {
  return subtotal >= 200 ? 0 : 25;
}

function calculateDiscount(subtotal, cupomCode) {
  if (!cupomCode) return 0;
  const percent = COUPONS[String(cupomCode).trim().toUpperCase()];
  return percent ? round2(subtotal * percent) : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function buildCartSummary({ items, cupomCode }) {
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
      name: product.nome,
      price,
      qty,
      image: product.imagens[0] || null,
    });
  }

  const subtotal = round2(resolvedItems.reduce((sum, item) => sum + item.price * item.qty, 0));
  const freight = calculateFreight(subtotal);
  const discount = calculateDiscount(subtotal, cupomCode);
  const total = round2(subtotal + freight - discount);

  return { items: resolvedItems, subtotal, freight, discount, total };
}

module.exports = {
  buildCartSummary,
};
