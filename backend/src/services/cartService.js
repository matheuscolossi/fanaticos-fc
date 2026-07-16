const { getProduct } = require('./productService');
const couponService = require('./couponService');
const promocaoService = require('./promocaoService');
const { createHttpError } = require('../utils/http');

// Frete por região, a partir do estado do CEP do cliente (loja em Caxias do
// Sul/RS). Sem CEP informado, cai no valor padrão (mesma regra usada antes,
// que é também o que o endpoint /cart do trabalho da faculdade espera).
const FRETE_PADRAO = 25;
const MAX_CART_ITEMS = 50;
const FRETE_POR_UF = {
  RS: 15, SC: 15, PR: 15, // Sul — mais próximo da loja
  SP: 25, RJ: 25, MG: 25, ES: 25, MT: 25, MS: 25, GO: 25, DF: 25, // Sudeste/Centro-Oeste
  BA: 35, SE: 35, AL: 35, PE: 35, PB: 35, RN: 35, CE: 35, PI: 35, MA: 35,
  TO: 35, PA: 35, AP: 35, AM: 35, RR: 35, RO: 35, AC: 35, // Norte/Nordeste
};
const PRAZO_POR_UF = {
  RS: [2, 4], SC: [3, 5], PR: [3, 6],
  SP: [4, 7], RJ: [5, 8], MG: [5, 8], ES: [6, 9],
  MT: [6, 10], MS: [6, 10], GO: [6, 10], DF: [6, 9],
};

function estimateDelivery(uf) {
  const [minBusinessDays, maxBusinessDays] = PRAZO_POR_UF[String(uf || '').toUpperCase()] || [8, 15];
  const date = new Date();
  let remaining = maxBusinessDays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (![0, 6].includes(date.getDay())) remaining -= 1;
  }
  return {
    minBusinessDays,
    maxBusinessDays,
    estimatedDate: date.toISOString().slice(0, 10),
    carrier: process.env.SHIPPING_PROVIDER || 'Envio padrão',
  };
}

function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw createHttpError(500, 'Valor monetário inválido no carrinho.', 'CART_MONEY_INVALID');
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

function centsToMoney(value) {
  return Number(value) / 100;
}

function calculateFreightCents(subtotalCents, uf) {
  if (subtotalCents >= 20000) return 0;
  if (!uf) return FRETE_PADRAO * 100;
  return (FRETE_POR_UF[String(uf).toUpperCase()] ?? FRETE_PADRAO) * 100;
}

async function buildCartSummary({ items, cupomCode, usuarioId, uf }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, 'Informe ao menos um item no carrinho (items: [{productId, qty}]).', 'CART_ITEMS_REQUIRED');
  }
  if (items.length > MAX_CART_ITEMS) {
    throw createHttpError(
      400,
      `O carrinho aceita no máximo ${MAX_CART_ITEMS} itens diferentes.`,
      'CART_ITEMS_LIMIT_EXCEEDED'
    );
  }

  const promocoesAtivas = await promocaoService.getPromocoesAtivas();

  const resolvedItems = [];
  let promocoesDescontoCents = 0;
  for (const item of items) {
    const qty = Number(item?.qty);
    if (!item?.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw createHttpError(400, 'Cada item precisa de productId e qty inteiro entre 1 e 99.', 'CART_ITEM_INVALID');
    }

    const product = await getProduct(item.productId); // lança 404 se o produto não existir
    if (product.status && product.status !== 'ativo') {
      throw createHttpError(400, `O produto "${product.nome}" não está disponível.`, 'PRODUCT_UNAVAILABLE');
    }
    const sizes = Array.isArray(product.tamanhos) ? product.tamanhos.map(String) : [];
    const selectedSize = String(item.tamanho || '').trim() || null;
    const colors = Array.isArray(product.cores) ? product.cores.map(String) : [];
    const selectedColor = String(item.cor || '').trim() || null;
    if (sizes.length > 0 && !selectedSize) {
      throw createHttpError(400, `Selecione um tamanho para "${product.nome}".`, 'PRODUCT_VARIANT_REQUIRED');
    }
    if (selectedSize && !sizes.includes(selectedSize)) {
      throw createHttpError(400, `Tamanho inválido para "${product.nome}".`, 'PRODUCT_VARIANT_INVALID');
    }
    if (colors.length > 0 && !selectedColor) {
      throw createHttpError(400, `Selecione uma cor para "${product.nome}".`, 'PRODUCT_COLOR_REQUIRED');
    }
    if (selectedColor && !colors.includes(selectedColor)) {
      throw createHttpError(400, `Cor inválida para "${product.nome}".`, 'PRODUCT_COLOR_INVALID');
    }
    const variants = Array.isArray(product.variantes) ? product.variantes : [];
    const colorVariants = Array.isArray(product.variantes_cores) ? product.variantes_cores : [];
    const selectedColorVariant = selectedSize && selectedColor
      ? colorVariants.find((variant) => String(variant.tamanho) === selectedSize && String(variant.cor) === selectedColor)
      : null;
    if (colorVariants.length > 0 && !selectedColorVariant) {
      throw createHttpError(400, `Combinação de tamanho e cor indisponível para "${product.nome}".`, 'PRODUCT_COLOR_VARIANT_INVALID');
    }
    const selectedVariant = selectedSize
      ? variants.find((variant) => String(variant.tamanho) === selectedSize)
      : null;
    if (variants.length > 0 && !selectedVariant) {
      throw createHttpError(400, `Variação indisponível para "${product.nome}".`, 'PRODUCT_VARIANT_INVALID');
    }
    const availableStock = Number(selectedColorVariant?.estoque ?? selectedVariant?.estoque ?? product.estoque);
    if (!Number.isSafeInteger(availableStock) || qty > availableStock) {
      throw createHttpError(
        409,
        selectedSize
          ? `Estoque insuficiente para "${product.nome}" no tamanho ${selectedSize}. Disponível: ${Math.max(0, availableStock || 0)}.`
          : `Estoque insuficiente para "${product.nome}". Disponível: ${Math.max(0, availableStock || 0)}.`,
        selectedSize ? 'INSUFFICIENT_VARIANT_STOCK' : 'INSUFFICIENT_STOCK'
      );
    }
    const priceCents = moneyToCents(product.preco_exibicao ?? product.preco_promocional ?? product.preco);
    if (priceCents < 0) {
      throw createHttpError(500, 'Produto com preço inválido.', 'PRODUCT_PRICE_INVALID');
    }
    const price = centsToMoney(priceCents);

    const { desconto, promocaoAplicada } = promocaoService.calcularDescontoQuantidade(product, qty, price, promocoesAtivas);
    const lineGrossCents = priceCents * qty;
    const linePromotionDiscountCents = Math.min(moneyToCents(desconto), lineGrossCents);
    const lineSubtotalCents = lineGrossCents - linePromotionDiscountCents;
    promocoesDescontoCents += linePromotionDiscountCents;

    resolvedItems.push({
      productId: product.id,
      categoria_id: product.categoria_id,
      name: product.nome,
      preco: price,
      price,
      qty,
      image: product.imagens[0] || null,
      tamanho: selectedSize,
      cor: selectedColor,
      personalizacao: item.personalizacao || null,
      promocaoAplicada: promocaoAplicada?.nome || product.promocao_nome || null,
      subtotalAposPromocao: centsToMoney(lineSubtotalCents),
    });
  }

  const subtotalBrutoCents = resolvedItems.reduce((sum, item) => sum + moneyToCents(item.price) * item.qty, 0);
  promocoesDescontoCents = Math.min(promocoesDescontoCents, subtotalBrutoCents);
  const subtotalCents = subtotalBrutoCents - promocoesDescontoCents;

  let freightCents = calculateFreightCents(subtotalCents, uf);
  let discountCents = 0;
  let cupomErro = null;

  if (cupomCode) {
    try {
      const resultado = await couponService.validateCoupon(cupomCode, {
        subtotal: centsToMoney(subtotalCents),
        itens: resolvedItems,
        usuarioId,
      });
      discountCents = Math.min(moneyToCents(resultado.desconto), subtotalCents);
      if (resultado.freteGratis) freightCents = 0;
    } catch (e) {
      cupomErro = e.message || 'Cupom inválido.';
    }
  }

  const totalCents = subtotalCents + freightCents - discountCents;

  const resposta = {
    items: resolvedItems.map(({ productId, name, price, qty, image, tamanho, cor, personalizacao, promocaoAplicada }) =>
      ({ productId, name, price, qty, image, tamanho, cor, personalizacao, promocaoAplicada })),
    subtotal: centsToMoney(subtotalCents),
    freight: centsToMoney(freightCents),
    discount: centsToMoney(discountCents),
    total: centsToMoney(totalCents),
    promocoesDesconto: centsToMoney(promocoesDescontoCents),
    deliveryEstimate: estimateDelivery(uf),
  };
  if (cupomErro) resposta.cupomErro = cupomErro;
  return resposta;
}

module.exports = {
  MAX_CART_ITEMS,
  buildCartSummary,
  centsToMoney,
  estimateDelivery,
  moneyToCents,
};
