const { getProduct } = require('./productService');
const couponService = require('./couponService');
const { createHttpError } = require('../utils/http');

// Frete por região, a partir do estado do CEP do cliente (loja em Caxias do
// Sul/RS). Sem CEP informado, cai no valor padrão (mesma regra usada antes,
// que é também o que o endpoint /cart do trabalho da faculdade espera).
const FRETE_PADRAO = 25;
const FRETE_POR_UF = {
  RS: 15, SC: 15, PR: 15, // Sul — mais próximo da loja
  SP: 25, RJ: 25, MG: 25, ES: 25, MT: 25, MS: 25, GO: 25, DF: 25, // Sudeste/Centro-Oeste
  BA: 35, SE: 35, AL: 35, PE: 35, PB: 35, RN: 35, CE: 35, PI: 35, MA: 35,
  TO: 35, PA: 35, AP: 35, AM: 35, RR: 35, RO: 35, AC: 35, // Norte/Nordeste
};

function calculateFreight(subtotal, uf) {
  if (subtotal >= 200) return 0;
  if (!uf) return FRETE_PADRAO;
  return FRETE_POR_UF[String(uf).toUpperCase()] ?? FRETE_PADRAO;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function buildCartSummary({ items, cupomCode, usuarioId, uf }) {
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

  let freight = calculateFreight(subtotal, uf);
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
