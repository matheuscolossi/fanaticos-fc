const couponModel = require('../models/couponModel');
const { createHttpError } = require('../utils/http');

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

function moneyToCents(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}

function serializeCoupon(c) {
  return {
    ...c,
    produtos_ids: parseJson(c.produtos_ids, []),
    categorias_ids: parseJson(c.categorias_ids, []),
    clientes_ids: parseJson(c.clientes_ids, []),
    frete_gratis: Boolean(c.frete_gratis),
  };
}

const TIPOS_DESCONTO = ['percentual', 'fixo'];
const STATUS_VALIDOS = ['ativo', 'inativo'];

function validatePayload(data) {
  const codigo = String(data.codigo || '').trim().toUpperCase();
  if (!codigo) throw createHttpError(400, 'Código do cupom é obrigatório.', 'VALIDATION_ERROR');
  if (!TIPOS_DESCONTO.includes(data.tipo_desconto)) {
    throw createHttpError(400, 'Tipo de desconto deve ser "percentual" ou "fixo".', 'VALIDATION_ERROR');
  }
  const valor = Number(data.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw createHttpError(400, 'Valor do desconto deve ser maior que zero.', 'VALIDATION_ERROR');
  }
  if (data.tipo_desconto === 'percentual' && valor > 100) {
    throw createHttpError(400, 'Desconto percentual não pode ser maior que 100%.', 'VALIDATION_ERROR');
  }
  if (data.status && !STATUS_VALIDOS.includes(data.status)) {
    throw createHttpError(400, 'Status inválido.', 'VALIDATION_ERROR');
  }
  if (data.data_inicio && data.data_fim && new Date(data.data_inicio) > new Date(data.data_fim)) {
    throw createHttpError(400, 'Data inicial não pode ser depois da data final.', 'VALIDATION_ERROR');
  }
  return codigo;
}

async function listCoupons(query) {
  const cupons = await couponModel.list(query);
  return Promise.all(cupons.map(async (c) => ({
    ...serializeCoupon(c),
    uso_total: await couponModel.countUsoTotal(c.codigo),
  })));
}

async function getCoupon(id) {
  const c = await couponModel.findById(id);
  if (!c) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');
  return { ...serializeCoupon(c), uso_total: await couponModel.countUsoTotal(c.codigo) };
}

async function createCoupon(data) {
  const codigo = validatePayload(data);
  if (await couponModel.findByCodigo(codigo)) {
    throw createHttpError(409, 'Já existe um cupom com esse código.', 'COUPON_CODE_EXISTS');
  }
  const result = await couponModel.create({ ...data, codigo });
  return { id: result.lastID, message: 'Cupom criado.' };
}

async function updateCoupon(id, data) {
  const current = await couponModel.findById(id);
  if (!current) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');

  const codigo = validatePayload(data);
  const existing = await couponModel.findByCodigo(codigo);
  if (existing && String(existing.id) !== String(id)) {
    throw createHttpError(409, 'Já existe um cupom com esse código.', 'COUPON_CODE_EXISTS');
  }

  await couponModel.update(id, { ...data, codigo });
  return { message: 'Cupom atualizado.' };
}

async function duplicateCoupon(id) {
  const current = await couponModel.findById(id);
  if (!current) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');
  const result = await couponModel.duplicate(id);
  return { id: result.lastID, message: 'Cupom duplicado.' };
}

async function setCouponStatus(id, status) {
  const current = await couponModel.findById(id);
  if (!current) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');
  if (!STATUS_VALIDOS.includes(status)) throw createHttpError(400, 'Status inválido.', 'VALIDATION_ERROR');
  await couponModel.setStatus(id, status);
  return { message: 'Status atualizado.' };
}

async function deleteCoupon(id) {
  const current = await couponModel.findById(id);
  if (!current) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');
  await couponModel.remove(id);
  return { message: 'Cupom excluído.' };
}

async function getCouponUsage(id) {
  const current = await couponModel.findById(id);
  if (!current) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');
  const pedidos = await couponModel.listPedidosByCupom(current.codigo);
  return { uso_total: pedidos.length, pedidos };
}

// ── Validação/aplicação do cupom ──────────────────────────────────────────
// Usada tanto no preview do carrinho (POST /cart) quanto na criação do pedido real.
// itens: [{ productId, categoria_id, preco, qty }]
async function validateCoupon(codigo, { subtotal, itens, usuarioId }) {
  const cupom = await couponModel.findByCodigo(codigo);
  if (!cupom) throw createHttpError(404, 'Cupom não encontrado.', 'COUPON_NOT_FOUND');
  if (cupom.status !== 'ativo') throw createHttpError(400, 'Este cupom está desativado.', 'COUPON_INACTIVE');

  const agora = new Date();
  if (cupom.data_inicio && agora < new Date(cupom.data_inicio)) {
    throw createHttpError(400, 'Este cupom ainda não está válido.', 'COUPON_NOT_STARTED');
  }
  if (cupom.data_fim && agora > new Date(cupom.data_fim)) {
    throw createHttpError(400, 'Este cupom está expirado.', 'COUPON_EXPIRED');
  }

  if (cupom.valor_minimo_compra && moneyToCents(subtotal) < moneyToCents(cupom.valor_minimo_compra)) {
    throw createHttpError(
      400,
      `Compra mínima de R$ ${Number(cupom.valor_minimo_compra).toFixed(2)} para usar este cupom.`,
      'COUPON_MIN_PURCHASE'
    );
  }

  const produtosIds   = parseJson(cupom.produtos_ids, []).map(String);
  const categoriasIds = parseJson(cupom.categorias_ids, []).map(String);
  const clientesIds   = parseJson(cupom.clientes_ids, []).map(String);

  let elegiveis = itens;
  if (produtosIds.length || categoriasIds.length) {
    elegiveis = itens.filter((i) =>
      produtosIds.includes(String(i.productId)) || categoriasIds.includes(String(i.categoria_id))
    );
    if (elegiveis.length === 0) {
      throw createHttpError(400, 'Este cupom não é válido para os produtos do carrinho.', 'COUPON_NOT_APPLICABLE');
    }
  }

  if (clientesIds.length && !clientesIds.includes(String(usuarioId))) {
    throw createHttpError(403, 'Este cupom não está disponível para este cliente.', 'COUPON_CUSTOMER_NOT_ALLOWED');
  }

  if (cupom.limite_uso_total) {
    const usos = await couponModel.countUsoTotal(codigo);
    if (usos >= cupom.limite_uso_total) {
      throw createHttpError(400, 'Este cupom atingiu o limite de utilizações.', 'COUPON_LIMIT_REACHED');
    }
  }

  if (cupom.limite_uso_por_usuario && usuarioId) {
    const usosUsuario = await couponModel.countUsoPorUsuario(codigo, usuarioId);
    if (usosUsuario >= cupom.limite_uso_por_usuario) {
      throw createHttpError(400, 'Você já utilizou este cupom o número máximo de vezes permitido.', 'COUPON_USER_LIMIT_REACHED');
    }
  }

  const subtotalElegivelCents = elegiveis.reduce((sum, item) => {
    const subtotalItem = Number(item.subtotalAposPromocao);
    const value = Number.isFinite(subtotalItem) ? subtotalItem : Number(item.preco) * Number(item.qty);
    return sum + moneyToCents(value);
  }, 0);
  let descontoCents = cupom.tipo_desconto === 'fixo'
    ? moneyToCents(cupom.valor)
    : Math.round(subtotalElegivelCents * (Number(cupom.valor) / 100));

  if (cupom.desconto_maximo) descontoCents = Math.min(descontoCents, moneyToCents(cupom.desconto_maximo));
  descontoCents = Math.min(descontoCents, subtotalElegivelCents, moneyToCents(subtotal));
  const desconto = descontoCents / 100;

  return { cupom, desconto, freteGratis: Boolean(cupom.frete_gratis) };
}

module.exports = {
  createCoupon,
  deleteCoupon,
  duplicateCoupon,
  getCoupon,
  getCouponUsage,
  listCoupons,
  setCouponStatus,
  updateCoupon,
  validateCoupon,
};
