const { getProduct } = require('./productService');
const couponService = require('./couponService');
const promocaoService = require('./promocaoService');
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

  const promocoesAtivas = await promocaoService.getPromocoesAtivas();

  const resolvedItems = [];
  let promocoesDesconto = 0;
  for (const item of items) {
    const qty = Number(item?.qty);
    if (!item?.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw createHttpError(400, 'Cada item precisa de productId e qty inteiro entre 1 e 99.', 'CART_ITEM_INVALID');
    }

    const product = await getProduct(item.productId); // lança 404 se o produto não existir
    if (product.status && product.status !== 'ativo') {
      throw createHttpError(400, `O produto "${product.nome}" não está disponível.`, 'PRODUCT_UNAVAILABLE');
    }
    const price = Number(product.preco_exibicao ?? product.preco_promocional ?? product.preco);

    const { desconto, promocaoAplicada } = promocaoService.calcularDescontoQuantidade(product, qty, price, promocoesAtivas);
    promocoesDesconto += desconto;

    resolvedItems.push({
      productId: product.id,
      categoria_id: product.categoria_id,
      name: product.nome,
      preco: price,
      price,
      qty,
      image: product.imagens[0] || null,
      tamanho: item.tamanho || null,
      personalizacao: item.personalizacao || null,
      promocaoAplicada: promocaoAplicada?.nome || product.promocao_nome || null,
    });
  }

  const subtotalBruto = round2(resolvedItems.reduce((sum, item) => sum + item.price * item.qty, 0));
  promocoesDesconto = round2(Math.min(promocoesDesconto, subtotalBruto));
  const subtotal = round2(subtotalBruto - promocoesDesconto);

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
    items: resolvedItems.map(({ productId, name, price, qty, image, tamanho, personalizacao, promocaoAplicada }) =>
      ({ productId, name, price, qty, image, tamanho, personalizacao, promocaoAplicada })),
    subtotal, freight, discount, total,
    promocoesDesconto,
  };
  if (cupomErro) resposta.cupomErro = cupomErro;
  return resposta;
}

module.exports = {
  buildCartSummary,
};
