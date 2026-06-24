const promocaoModel = require('../models/promocaoModel');
const { createHttpError } = require('../utils/http');

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function serializePromocao(p) {
  return {
    ...p,
    produtos_ids: parseJson(p.produtos_ids, []),
    categorias_ids: parseJson(p.categorias_ids, []),
    regras_progressivas: parseJson(p.regras_progressivas, []),
    destaque: Boolean(p.destaque),
    mostrar_contador: Boolean(p.mostrar_contador),
  };
}

const TIPOS = ['percentual', 'fixo', 'preco_fixo', 'compre_x_leve_y', 'progressivo'];
const STATUS_VALIDOS = ['ativo', 'inativo'];

function validatePayload(data) {
  const nome = String(data.nome || '').trim();
  if (!nome) throw createHttpError(400, 'Nome da promoção é obrigatório.', 'VALIDATION_ERROR');
  if (!TIPOS.includes(data.tipo)) {
    throw createHttpError(400, 'Tipo de promoção inválido.', 'VALIDATION_ERROR');
  }
  if (data.status && !STATUS_VALIDOS.includes(data.status)) {
    throw createHttpError(400, 'Status inválido.', 'VALIDATION_ERROR');
  }
  if (data.data_inicio && data.data_fim && new Date(data.data_inicio) > new Date(data.data_fim)) {
    throw createHttpError(400, 'Data inicial não pode ser depois da data final.', 'VALIDATION_ERROR');
  }

  if (data.tipo === 'percentual') {
    const valor = Number(data.valor);
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
      throw createHttpError(400, 'Desconto percentual deve ser maior que 0 e até 100.', 'VALIDATION_ERROR');
    }
  } else if (data.tipo === 'fixo') {
    const valor = Number(data.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw createHttpError(400, 'Valor do desconto fixo deve ser maior que zero.', 'VALIDATION_ERROR');
    }
  } else if (data.tipo === 'preco_fixo') {
    const valor = Number(data.valor);
    if (!Number.isFinite(valor) || valor < 0) {
      throw createHttpError(400, 'Preço promocional deve ser maior ou igual a zero.', 'VALIDATION_ERROR');
    }
  } else if (data.tipo === 'compre_x_leve_y') {
    const compre = Number(data.compre_qtd);
    const leve = Number(data.leve_qtd);
    if (!Number.isInteger(compre) || compre < 1) {
      throw createHttpError(400, 'Quantidade "compre" deve ser um inteiro >= 1.', 'VALIDATION_ERROR');
    }
    if (!Number.isInteger(leve) || leve <= compre) {
      throw createHttpError(400, 'Quantidade "leve" deve ser maior que a quantidade "compre".', 'VALIDATION_ERROR');
    }
  } else if (data.tipo === 'progressivo') {
    const regras = parseJson(data.regras_progressivas, []);
    if (!Array.isArray(regras) || regras.length === 0) {
      throw createHttpError(400, 'Informe ao menos uma faixa de desconto progressivo.', 'VALIDATION_ERROR');
    }
    for (const r of regras) {
      const qtd = Number(r.qtd_minima);
      const pct = Number(r.desconto_pct);
      if (!Number.isInteger(qtd) || qtd < 1) {
        throw createHttpError(400, 'Quantidade mínima de cada faixa progressiva deve ser um inteiro >= 1.', 'VALIDATION_ERROR');
      }
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        throw createHttpError(400, 'Desconto de cada faixa progressiva deve ser maior que 0 e até 100.', 'VALIDATION_ERROR');
      }
    }
  }

  return nome;
}

async function listPromocoes(query) {
  const promocoes = await promocaoModel.list(query);
  return promocoes.map(serializePromocao);
}

async function getPromocao(id) {
  const p = await promocaoModel.findById(id);
  if (!p) throw createHttpError(404, 'Promoção não encontrada.', 'PROMOCAO_NOT_FOUND');
  return serializePromocao(p);
}

async function createPromocao(data) {
  const nome = validatePayload(data);
  const result = await promocaoModel.create({ ...data, nome });
  return { id: result.lastID, message: 'Promoção criada.' };
}

async function updatePromocao(id, data) {
  const current = await promocaoModel.findById(id);
  if (!current) throw createHttpError(404, 'Promoção não encontrada.', 'PROMOCAO_NOT_FOUND');
  const nome = validatePayload(data);
  await promocaoModel.update(id, { ...data, nome });
  return { message: 'Promoção atualizada.' };
}

async function setPromocaoStatus(id, status) {
  const current = await promocaoModel.findById(id);
  if (!current) throw createHttpError(404, 'Promoção não encontrada.', 'PROMOCAO_NOT_FOUND');
  if (!STATUS_VALIDOS.includes(status)) throw createHttpError(400, 'Status inválido.', 'VALIDATION_ERROR');
  await promocaoModel.setStatus(id, status);
  return { message: 'Status atualizado.' };
}

async function deletePromocao(id) {
  const current = await promocaoModel.findById(id);
  if (!current) throw createHttpError(404, 'Promoção não encontrada.', 'PROMOCAO_NOT_FOUND');
  await promocaoModel.remove(id);
  return { message: 'Promoção excluída.' };
}

// ── Aplicação das promoções (usada por productService e cartService) ──────

async function getPromocoesAtivas() {
  const ativas = await promocaoModel.listAtivas();
  return ativas.map(serializePromocao);
}

function promocaoAplicavel(promo, produto) {
  const produtosIds = promo.produtos_ids.map(String);
  const categoriasIds = promo.categorias_ids.map(String);
  if (produtosIds.length === 0 && categoriasIds.length === 0) return true; // sem escopo = loja toda
  return produtosIds.includes(String(produto.id)) || categoriasIds.includes(String(produto.categoria_id));
}

// Melhor preço unitário entre: preço promocional manual e promoções percentual/fixo/preco_fixo vigentes.
function calcularPrecoComPromocao(produto, promocoesAtivas) {
  const precoBase = Number(produto.preco);
  let melhor = { precoFinal: precoBase, promocaoAplicada: null };

  if (produto.preco_promocional != null && Number(produto.preco_promocional) < melhor.precoFinal) {
    melhor = { precoFinal: Number(produto.preco_promocional), promocaoAplicada: null };
  }

  for (const promo of promocoesAtivas) {
    if (!['percentual', 'fixo', 'preco_fixo'].includes(promo.tipo)) continue;
    if (!promocaoAplicavel(promo, produto)) continue;

    let candidato;
    if (promo.tipo === 'percentual') candidato = precoBase * (1 - Number(promo.valor) / 100);
    else if (promo.tipo === 'fixo') candidato = precoBase - Number(promo.valor);
    else candidato = Number(promo.valor);

    candidato = Math.max(0, round2(candidato));
    if (candidato < melhor.precoFinal) {
      melhor = { precoFinal: candidato, promocaoAplicada: promo };
    }
  }

  return melhor;
}

// Desconto adicional por quantidade (compre X leve Y / progressivo) para uma linha do carrinho.
function calcularDescontoQuantidade(produto, qty, unitPrice, promocoesAtivas) {
  let melhor = { desconto: 0, promocaoAplicada: null };

  for (const promo of promocoesAtivas) {
    if (!promocaoAplicavel(promo, produto)) continue;

    if (promo.tipo === 'compre_x_leve_y' && promo.compre_qtd && promo.leve_qtd) {
      const grupos = Math.floor(qty / promo.leve_qtd);
      const unidadesGratis = grupos * (promo.leve_qtd - promo.compre_qtd);
      const desconto = round2(unidadesGratis * unitPrice);
      if (desconto > melhor.desconto) melhor = { desconto, promocaoAplicada: promo };
    }

    if (promo.tipo === 'progressivo' && Array.isArray(promo.regras_progressivas)) {
      const regraAplicavel = [...promo.regras_progressivas]
        .filter(r => qty >= Number(r.qtd_minima))
        .sort((a, b) => Number(b.qtd_minima) - Number(a.qtd_minima))[0];
      if (regraAplicavel) {
        const desconto = round2(qty * unitPrice * (Number(regraAplicavel.desconto_pct) / 100));
        if (desconto > melhor.desconto) melhor = { desconto, promocaoAplicada: promo };
      }
    }
  }

  return melhor;
}

module.exports = {
  calcularDescontoQuantidade,
  calcularPrecoComPromocao,
  createPromocao,
  deletePromocao,
  getPromocao,
  getPromocoesAtivas,
  listPromocoes,
  promocaoAplicavel,
  setPromocaoStatus,
  updatePromocao,
};
