const {
  booleanValue,
  enumValue,
  jsonValue,
  numberValue,
  requirePlainObject,
  stringValue,
  validationError,
} = require('./commonSchemas');

const MAX_PRICE = 99999999.99;
const MAX_STOCK = 1000000;
const PRODUCT_STATUSES = ['ativo', 'inativo'];
const PRODUCT_TYPES = ['torcedor', 'jogador', 'retro', 'infantil'];
const PRODUCT_GENDERS = ['masculino', 'feminino', 'infantil', 'unissex'];
const BULK_PRICE_TYPES = ['fixo', 'desconto_pct', 'acrescimo_pct'];

function optionalText(data, field, label, max) {
  return stringValue(data[field], field, { label, required: false, nullable: true, max });
}

function normalizeStringArray(value, field, { maxItems, itemMax }) {
  const parsed = jsonValue(value, field, []);
  if (!Array.isArray(parsed) || parsed.length > maxItems) {
    throw validationError(field, `${field} deve conter no máximo ${maxItems} itens.`);
  }
  const normalized = parsed.map((item) => stringValue(item, field, {
    label: `Item de ${field}`, min: 1, max: itemMax,
  }));
  if (new Set(normalized).size !== normalized.length) {
    throw validationError(field, `${field} não pode conter itens repetidos.`);
  }
  return normalized;
}

function normalizeVariants(value, sizes) {
  if (value === undefined || value === null) return null;
  const parsed = jsonValue(value, 'variantes', []);
  if (!Array.isArray(parsed) || parsed.length > 30) {
    throw validationError('variantes', 'Variações devem ser enviadas como uma lista de até 30 itens.', 'VARIANTS_INVALID');
  }
  const variants = parsed.map((variant) => {
    requirePlainObject(variant, 'Variação');
    return {
      tamanho: stringValue(variant.tamanho, 'variantes.tamanho', {
        label: 'Tamanho da variação', min: 1, max: 20,
      }),
      estoque: numberValue(variant.estoque, 'variantes.estoque', {
        label: 'Estoque da variação', min: 0, max: MAX_STOCK, integer: true,
      }),
    };
  });
  const uniqueSizes = new Set(variants.map((variant) => variant.tamanho));
  if (
    uniqueSizes.size !== variants.length ||
    variants.length !== sizes.length ||
    sizes.some((size) => !uniqueSizes.has(size))
  ) {
    throw validationError(
      'variantes',
      'Informe um estoque inteiro e não negativo para cada tamanho cadastrado.',
      'VARIANT_STOCK_INVALID'
    );
  }
  return variants;
}

function normalizeColorVariants(value, sizes, colors) {
  if (value === undefined || value === null) return null;
  const parsed = jsonValue(value, 'variantes_cores', []);
  if (!Array.isArray(parsed) || parsed.length > 600) {
    throw validationError('variantes_cores', 'A grade de tamanho e cor deve conter no máximo 600 itens.', 'COLOR_VARIANTS_INVALID');
  }
  if (sizes.length === 0 || colors.length === 0) {
    if (parsed.length === 0) return [];
    throw validationError('variantes_cores', 'Cadastre tamanhos e cores antes da grade de estoque.', 'COLOR_VARIANTS_INVALID');
  }
  const variants = parsed.map((variant) => {
    requirePlainObject(variant, 'Variação de cor');
    return {
      tamanho: stringValue(variant.tamanho, 'variantes_cores.tamanho', { label: 'Tamanho', min: 1, max: 20 }),
      cor: stringValue(variant.cor, 'variantes_cores.cor', { label: 'Cor', min: 1, max: 50 }),
      estoque: numberValue(variant.estoque, 'variantes_cores.estoque', {
        label: 'Estoque da combinação', min: 0, max: MAX_STOCK, integer: true,
      }),
    };
  });
  const expected = new Set(sizes.flatMap((size) => colors.map((color) => `${size}\u0000${color}`)));
  const actual = new Set(variants.map((variant) => `${variant.tamanho}\u0000${variant.cor}`));
  if (actual.size !== variants.length || actual.size !== expected.size || [...expected].some((key) => !actual.has(key))) {
    throw validationError(
      'variantes_cores',
      'Informe o estoque de cada combinação entre tamanho e cor cadastrados.',
      'COLOR_VARIANT_STOCK_INVALID'
    );
  }
  return variants;
}

function normalizeDimensions(value) {
  const parsed = jsonValue(value, 'dimensoes', {});
  requirePlainObject(parsed, 'Dimensões');
  const dimensions = {};
  for (const field of ['comprimento', 'largura', 'altura']) {
    dimensions[field] = numberValue(parsed[field], `dimensoes.${field}`, {
      label: field, required: false, nullable: true, min: 0, max: 10000, decimals: 2,
    });
  }
  return dimensions;
}

function normalizeSizeGuide(value) {
  const parsed = jsonValue(value, 'guia_tamanhos', []);
  if (!Array.isArray(parsed) || parsed.length > 30) {
    throw validationError('guia_tamanhos', 'O guia de tamanhos deve conter até 30 linhas.');
  }
  return parsed.map((row) => {
    requirePlainObject(row, 'Medida');
    return {
      tamanho: stringValue(row.tamanho, 'guia_tamanhos.tamanho', { label: 'Tamanho', min: 1, max: 20 }),
      largura: numberValue(row.largura, 'guia_tamanhos.largura', { label: 'Largura', min: 1, max: 500, decimals: 1 }),
      comprimento: numberValue(row.comprimento, 'guia_tamanhos.comprimento', { label: 'Comprimento', min: 1, max: 500, decimals: 1 }),
    };
  });
}

function validateProduct(data) {
  requirePlainObject(data, 'Produto');
  const nome = stringValue(data.nome, 'nome', { label: 'Nome', min: 1, max: 200 });
  const preco = numberValue(data.preco, 'preco', {
    label: 'Preço', min: 0.01, max: MAX_PRICE, decimals: 2,
  });
  const precoPromocional = numberValue(data.preco_promocional, 'preco_promocional', {
    label: 'Preço promocional', required: false, nullable: true, min: 0.01, max: MAX_PRICE, decimals: 2,
  });
  if (precoPromocional !== null && precoPromocional > preco) {
    throw validationError('preco_promocional', 'Preço promocional não pode ser maior que o preço normal.');
  }

  const tamanhos = normalizeStringArray(data.tamanhos, 'tamanhos', { maxItems: 30, itemMax: 20 });
  const cores = normalizeStringArray(data.cores, 'cores', { maxItems: 20, itemMax: 50 });
  const variantesCores = normalizeColorVariants(data.variantes_cores, tamanhos, cores);
  let variantes = normalizeVariants(data.variantes, tamanhos);
  if (variantesCores?.length) {
    variantes = tamanhos.map((tamanho) => ({
      tamanho,
      estoque: variantesCores
        .filter((variant) => variant.tamanho === tamanho)
        .reduce((sum, variant) => sum + variant.estoque, 0),
    }));
  }
  const estoqueInformado = numberValue(data.estoque ?? 0, 'estoque', {
    label: 'Estoque', min: 0, max: MAX_STOCK, integer: true,
  });
  const estoqueVariantes = variantes?.length
    ? variantes.reduce((total, variant) => total + variant.estoque, 0)
    : null;
  if (estoqueVariantes !== null && estoqueVariantes > MAX_STOCK) {
    throw validationError('variantes', `O estoque total não pode ultrapassar ${MAX_STOCK}.`, 'VARIANT_STOCK_INVALID');
  }

  let categoriaId = null;
  if (data.categoria_id !== null && data.categoria_id !== undefined && data.categoria_id !== '') {
    categoriaId = numberValue(data.categoria_id, 'categoria_id', {
      label: 'Categoria', min: 1, max: Number.MAX_SAFE_INTEGER, integer: true,
    });
  }

  const imagens = jsonValue(data.imagens, 'imagens', []);
  if (!Array.isArray(imagens) || imagens.length > 4 || imagens.some((image) => typeof image !== 'string')) {
    throw validationError('imagens', 'Imagens deve conter no máximo quatro URLs ou arquivos válidos.');
  }

  return {
    nome,
    slug: optionalText(data, 'slug', 'Slug', 200),
    sku: optionalText(data, 'sku', 'SKU', 100),
    preco,
    preco_promocional: precoPromocional,
    custo: numberValue(data.custo, 'custo', {
      label: 'Custo', required: false, nullable: true, min: 0, max: MAX_PRICE, decimals: 2,
    }),
    categoria_id: categoriaId,
    descricao: optionalText(data, 'descricao', 'Descrição', 10000) || '',
    descricao_curta: optionalText(data, 'descricao_curta', 'Descrição curta', 160) || '',
    imagens,
    estoque: estoqueVariantes ?? estoqueInformado,
    estoque_minimo: numberValue(data.estoque_minimo ?? 0, 'estoque_minimo', {
      label: 'Estoque mínimo', min: 0, max: MAX_STOCK, integer: true,
    }),
    destaque: booleanValue(data.destaque, 'destaque'),
    time: optionalText(data, 'time', 'Time', 150),
    pais: optionalText(data, 'pais', 'País', 100),
    competicao: optionalText(data, 'competicao', 'Competição', 150),
    temporada: optionalText(data, 'temporada', 'Temporada', 50),
    tipo: enumValue(data.tipo, 'tipo', PRODUCT_TYPES, { label: 'Tipo', fallback: 'torcedor' }),
    marca: optionalText(data, 'marca', 'Marca', 100),
    genero: enumValue(data.genero, 'genero', PRODUCT_GENDERS, { label: 'Gênero', fallback: 'masculino' }),
    tamanhos,
    variantes,
    cores,
    variantes_cores: variantesCores,
    guia_tamanhos: normalizeSizeGuide(data.guia_tamanhos),
    status: enumValue(data.status, 'status', PRODUCT_STATUSES, { label: 'Status', fallback: 'ativo' }),
    produto_novo: booleanValue(data.produto_novo, 'produto_novo'),
    produto_promocional: booleanValue(data.produto_promocional, 'produto_promocional'),
    peso: numberValue(data.peso, 'peso', {
      label: 'Peso', required: false, nullable: true, min: 0, max: 10000, decimals: 3,
    }),
    dimensoes: normalizeDimensions(data.dimensoes),
    info_lavagem: optionalText(data, 'info_lavagem', 'Informações de lavagem', 2000),
    keywords: optionalText(data, 'keywords', 'Palavras-chave', 1000),
    meta_titulo: optionalText(data, 'meta_titulo', 'Meta título', 70),
    meta_descricao: optionalText(data, 'meta_descricao', 'Meta descrição', 160),
  };
}

function validateProductStatus(status) {
  return enumValue(status, 'status', PRODUCT_STATUSES, { label: 'Status' });
}

function validateBulkPrice(ids, data) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000) {
    throw validationError('ids', 'Selecione entre 1 e 1.000 produtos.');
  }
  const normalizedIds = [...new Set(ids.map((id) => numberValue(id, 'ids', {
    label: 'ID do produto', min: 1, max: Number.MAX_SAFE_INTEGER, integer: true,
  })))];
  requirePlainObject(data, 'Alteração de preço');
  const tipo = enumValue(data.tipo, 'tipo', BULK_PRICE_TYPES, { label: 'Tipo de alteração' });
  const valor = numberValue(data.valor, 'valor', {
    label: 'Valor', min: tipo === 'fixo' ? 0.01 : 0, max: tipo === 'fixo' ? MAX_PRICE : 1000,
    decimals: 2,
  });
  if (tipo === 'desconto_pct' && valor > 99.99) {
    throw validationError('valor', 'O desconto percentual deve ser menor que 100%.');
  }
  return { ids: normalizedIds, tipo, valor };
}

module.exports = {
  MAX_PRICE,
  MAX_STOCK,
  PRODUCT_GENDERS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  validateBulkPrice,
  validateProduct,
  validateProductStatus,
};
