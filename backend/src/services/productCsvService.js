const categoryModel = require('../models/categoryModel');
const productModel = require('../models/productModel');
const { transaction } = require('../config/database');
const { createHttpError } = require('../utils/http');
const { normalizeProductPayload } = require('./productService');
const {
  MAX_PRICE,
  MAX_STOCK,
  PRODUCT_GENDERS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
} = require('../validation/productSchemas');

const MAX_CSV_ROWS = 1000;
const MAX_CSV_LENGTH = 2 * 1024 * 1024;
const ALLOWED_HEADERS = new Set([
  'id', 'nome', 'sku', 'slug', 'preco', 'preco_promocional', 'custo',
  'categoria', 'categoria_id', 'time', 'pais', 'competicao', 'temporada',
  'tipo', 'marca', 'genero', 'estoque', 'estoque_minimo', 'status',
  'destaque', 'produto_novo', 'produto_promocional', 'peso', 'keywords',
  'created_at',
]);

function csvError(message, details = []) {
  const error = createHttpError(400, message, 'CSV_PARSE_ERROR');
  error.details = details;
  return error;
}

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function detectDelimiter(text) {
  let inQuotes = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      break;
    } else if (!inQuotes && Object.hasOwn(counts, char)) {
      counts[char] += 1;
    }
  }
  const [delimiter, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (count === 0) throw csvError('O cabeçalho CSV não possui um delimitador reconhecido.');
  return delimiter;
}

function parseCsv(csv) {
  if (typeof csv !== 'string' || !csv.trim()) {
    throw csvError('Envie o conteúdo do arquivo no campo csv.');
  }
  if (csv.length > MAX_CSV_LENGTH) {
    throw csvError('O arquivo CSV excede o limite de 2 MB.');
  }
  if (csv.includes('\0')) throw csvError('O arquivo CSV contém bytes nulos inválidos.');

  let text = csv.replace(/^\uFEFF/, '');
  let line = 1;
  const separatorDirective = text.match(/^sep=([,;\t])\r?\n/i);
  const delimiter = separatorDirective?.[1] || detectDelimiter(text);
  if (separatorDirective) {
    text = text.slice(separatorDirective[0].length);
    line += 1;
  }

  const records = [];
  let cells = [];
  let field = '';
  let state = 'plain';
  let recordLine = line;

  function finishField() {
    cells.push(field);
    field = '';
    state = 'plain';
  }

  function finishRecord() {
    finishField();
    if (cells.some((cell) => cell.trim() !== '')) records.push({ cells, line: recordLine });
    cells = [];
    recordLine = line + 1;
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (state === 'quoted') {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        state = 'afterQuote';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[index + 1] === '\n') index += 1;
        field += '\n';
        line += 1;
      } else {
        field += char;
      }
      continue;
    }

    if (state === 'afterQuote') {
      if (char === delimiter) {
        finishField();
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[index + 1] === '\n') index += 1;
        finishRecord();
        line += 1;
      } else if (!/\s/.test(char)) {
        throw csvError(`Caractere inesperado após aspas na linha ${line}.`, [{ line }]);
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw csvError(`Aspas em posição inválida na linha ${line}.`, [{ line }]);
      }
      state = 'quoted';
    } else if (char === delimiter) {
      finishField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      finishRecord();
      line += 1;
    } else {
      field += char;
    }
  }

  if (state === 'quoted') {
    throw csvError(`Campo entre aspas não foi encerrado, iniciado na linha ${recordLine}.`, [{ line: recordLine }]);
  }
  if (field.length > 0 || cells.length > 0) finishRecord();
  if (records.length < 2) throw csvError('O CSV deve conter cabeçalho e ao menos uma linha de produto.');

  const headers = records[0].cells.map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  const unknownHeaders = headers.filter((header) => header && !ALLOWED_HEADERS.has(header));
  if (headers.some((header) => !header)) throw csvError('O cabeçalho contém uma coluna sem nome.');
  if (duplicateHeaders.length > 0) {
    throw csvError(`O cabeçalho contém colunas duplicadas: ${[...new Set(duplicateHeaders)].join(', ')}.`);
  }
  if (unknownHeaders.length > 0) {
    throw csvError(`Colunas não reconhecidas: ${[...new Set(unknownHeaders)].join(', ')}.`);
  }
  for (const required of ['nome', 'preco']) {
    if (!headers.includes(required)) throw csvError(`A coluna obrigatória "${required}" não foi encontrada.`);
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > MAX_CSV_ROWS) {
    throw csvError(`O CSV aceita no máximo ${MAX_CSV_ROWS} linhas de produto.`);
  }
  return {
    delimiter,
    headers,
    records: dataRecords.map((record) => ({
      line: record.line,
      columnCountValid: record.cells.length === headers.length,
      values: Object.fromEntries(headers.map((header, index) => [header, record.cells[index] ?? ''])),
    })),
  };
}

function addError(row, field, code, message) {
  row.errors.push({ field, code, message });
}

function textValue(row, field, { max = 255, required = false } = {}) {
  const value = String(row.values[field] || '').trim();
  if (required && !value) addError(row, field, 'REQUIRED', `${field} é obrigatório.`);
  if (value.length > max) addError(row, field, 'TOO_LONG', `${field} aceita no máximo ${max} caracteres.`);
  return value || null;
}

function numberValue(row, field, { integer = false, max = MAX_PRICE, min = 0, required = false } = {}) {
  const raw = String(row.values[field] || '').trim();
  if (!raw) {
    if (required) addError(row, field, 'REQUIRED', `${field} é obrigatório.`);
    return null;
  }
  const normalized = raw.replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    addError(row, field, 'INVALID_NUMBER', `${field} deve ser um número válido.`);
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    addError(
      row,
      field,
      'NUMBER_OUT_OF_RANGE',
      `${field} deve ser ${integer ? 'um inteiro' : 'um número'} entre ${min} e ${max}.`
    );
    return null;
  }
  return value;
}

function booleanValue(row, field) {
  const raw = String(row.values[field] || '').trim().toLowerCase();
  if (!raw) return false;
  if (['1', 'true', 'sim', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'não', 'nao', 'no'].includes(raw)) return false;
  addError(row, field, 'INVALID_BOOLEAN', `${field} deve ser 1/0, true/false ou sim/não.`);
  return false;
}

async function prepareRows(csv) {
  const parsed = parseCsv(csv);
  const categories = await categoryModel.list();
  const categoriesById = new Map(categories.map((category) => [String(category.id), category]));
  const categoriesByName = new Map(categories.map((category) => [String(category.nome).trim().toLowerCase(), category]));
  const rows = parsed.records.map((record) => ({ ...record, errors: [] }));

  for (const row of rows) {
    if (!row.columnCountValid) {
      addError(row, '_row', 'COLUMN_COUNT_MISMATCH', `A linha deve possuir ${parsed.headers.length} colunas.`);
    }
    const nome = textValue(row, 'nome', { max: 200, required: true });
    const sku = textValue(row, 'sku', { max: 100 });
    const preco = numberValue(row, 'preco', { min: 0.01, required: true });
    const precoPromocional = numberValue(row, 'preco_promocional');
    const custo = numberValue(row, 'custo');
    const estoque = numberValue(row, 'estoque', { integer: true, max: MAX_STOCK }) ?? 0;
    const estoqueMinimo = numberValue(row, 'estoque_minimo', { integer: true, max: MAX_STOCK }) ?? 0;
    const peso = numberValue(row, 'peso', { max: 10000 });
    if (preco != null && precoPromocional != null && precoPromocional > preco) {
      addError(row, 'preco_promocional', 'PROMOTIONAL_PRICE_INVALID', 'preco_promocional não pode ser maior que preco.');
    }

    const categoryIdRaw = String(row.values.categoria_id || '').trim();
    const categoryNameRaw = String(row.values.categoria || '').trim();
    const categoryById = categoryIdRaw ? categoriesById.get(categoryIdRaw) : null;
    const categoryByName = categoryNameRaw ? categoriesByName.get(categoryNameRaw.toLowerCase()) : null;
    if (categoryIdRaw && !categoryById) {
      addError(row, 'categoria_id', 'CATEGORY_NOT_FOUND', `Categoria de ID ${categoryIdRaw} não encontrada.`);
    }
    if (categoryNameRaw && !categoryByName) {
      addError(row, 'categoria', 'CATEGORY_NOT_FOUND', `Categoria "${categoryNameRaw}" não encontrada.`);
    }
    if (categoryById && categoryByName && String(categoryById.id) !== String(categoryByName.id)) {
      addError(row, 'categoria', 'CATEGORY_MISMATCH', 'categoria e categoria_id indicam categorias diferentes.');
    }
    const category = categoryById || categoryByName || null;

    const status = textValue(row, 'status', { max: 20 }) || 'ativo';
    if (!PRODUCT_STATUSES.includes(status.toLowerCase())) {
      addError(row, 'status', 'INVALID_STATUS', 'status deve ser ativo ou inativo.');
    }
    const tipo = textValue(row, 'tipo', { max: 50 }) || 'torcedor';
    if (!PRODUCT_TYPES.includes(tipo.toLowerCase())) {
      addError(row, 'tipo', 'INVALID_TYPE', `tipo deve ser: ${PRODUCT_TYPES.join(', ')}.`);
    }
    const genero = textValue(row, 'genero', { max: 50 }) || 'masculino';
    if (!PRODUCT_GENDERS.includes(genero.toLowerCase())) {
      addError(row, 'genero', 'INVALID_GENDER', `genero deve ser: ${PRODUCT_GENDERS.join(', ')}.`);
    }

    row.product = {
      nome,
      sku,
      slug: textValue(row, 'slug', { max: 200 }),
      preco,
      preco_promocional: precoPromocional,
      custo,
      categoria_id: category?.id || null,
      time: textValue(row, 'time', { max: 150 }),
      pais: textValue(row, 'pais', { max: 100 }),
      competicao: textValue(row, 'competicao', { max: 150 }),
      temporada: textValue(row, 'temporada', { max: 50 }),
      tipo: tipo.toLowerCase(),
      marca: textValue(row, 'marca', { max: 100 }),
      genero: genero.toLowerCase(),
      estoque,
      estoque_minimo: estoqueMinimo,
      status: status.toLowerCase(),
      destaque: booleanValue(row, 'destaque'),
      produto_novo: booleanValue(row, 'produto_novo'),
      produto_promocional: booleanValue(row, 'produto_promocional'),
      peso,
      keywords: textValue(row, 'keywords', { max: 1000 }),
      imagens: [],
      tamanhos: [],
      cores: [],
    };
    row.categoryName = category?.nome || null;
  }

  const skuGroups = new Map();
  for (const [index, row] of rows.entries()) {
    if (!row.product.sku) continue;
    const key = row.product.sku.toLowerCase();
    const indexes = skuGroups.get(key) || [];
    indexes.push(index);
    skuGroups.set(key, indexes);
  }
  for (const indexes of skuGroups.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      addError(rows[index], 'sku', 'DUPLICATE_SKU_IN_FILE', 'SKU repetido dentro do arquivo CSV.');
    }
  }

  const existingSkus = await productModel.findBySkus([...skuGroups.keys()]);
  const existingSet = new Set(existingSkus.map((product) => String(product.sku).toLowerCase()));
  for (const row of rows) {
    if (row.product.sku && existingSet.has(row.product.sku.toLowerCase())) {
      addError(row, 'sku', 'SKU_ALREADY_EXISTS', 'Já existe um produto cadastrado com este SKU.');
    }
    if (row.errors.length === 0) {
      try {
        row.normalized = await normalizeProductPayload(row.product);
      } catch (error) {
        addError(row, '_row', error.code || 'VALIDATION_ERROR', error.message);
      }
    }
  }
  return { delimiter: parsed.delimiter, headers: parsed.headers, rows };
}

function buildReport(prepared, { imported = 0, mode }) {
  const invalidRows = prepared.rows.filter((row) => row.errors.length > 0).length;
  return {
    mode,
    canImport: invalidRows === 0,
    delimiter: prepared.delimiter === '\t' ? 'tab' : prepared.delimiter,
    headers: prepared.headers,
    summary: {
      totalRows: prepared.rows.length,
      validRows: prepared.rows.length - invalidRows,
      invalidRows,
      imported,
    },
    rows: prepared.rows.map((row) => ({
      line: row.line,
      valid: row.errors.length === 0,
      product: {
        nome: row.product.nome,
        sku: row.product.sku,
        preco: row.product.preco,
        categoria: row.categoryName,
        estoque: row.product.estoque,
        status: row.product.status,
      },
      errors: row.errors,
    })),
  };
}

async function importProductsCsv({ csv, preview }) {
  const prepared = await prepareRows(csv);
  const previewReport = buildReport(prepared, { imported: 0, mode: 'preview' });
  if (preview) return previewReport;
  if (!previewReport.canImport) return buildReport(prepared, { imported: 0, mode: 'import' });

  const inserted = await transaction(async (db) => {
    const products = [];
    for (const row of prepared.rows) {
      const result = await productModel.create(row.normalized, db);
      if (row.normalized.variantes !== null) {
        await productModel.syncVariants(result.lastID, row.normalized.variantes, db);
      }
      products.push({ id: result.lastID, line: row.line });
    }
    return products;
  });
  return {
    ...buildReport(prepared, { imported: inserted.length, mode: 'import' }),
    products: inserted,
  };
}

module.exports = { MAX_CSV_ROWS, importProductsCsv, parseCsv };
