require('./testEnv');

process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const database = require('../src/config/database');
const productsController = require('../src/controllers/productsController');
const { importProductsCsv, parseCsv } = require('../src/services/productCsvService');

const testSkus = [
  'csv-preview-valid',
  'csv-invalid-a',
  'csv-invalid-b',
  'csv-import-a',
  'csv-import-b',
];
let category;

before(async () => {
  await database.init();
  await database.run(
    `DELETE FROM produtos WHERE sku IN (${testSkus.map(() => '?').join(',')})`,
    testSkus
  );
  category = await database.get('SELECT id, nome FROM categorias ORDER BY id LIMIT 1');
});

after(async () => {
  await database.run(
    `DELETE FROM produtos WHERE sku IN (${testSkus.map(() => '?').join(',')})`,
    testSkus
  );
  await database.close();
});

test('parser aceita BOM, sep, ponto-e-vírgula, decimal brasileiro e campo entre aspas', async () => {
  const csv = `\uFEFFsep=;\nnome;sku;preco;categoria;estoque;destaque\n"Camisa; Especial";csv-preview-valid;19,90;${category.nome};2;sim`;
  const parsed = parseCsv(csv);
  assert.equal(parsed.delimiter, ';');
  assert.equal(parsed.records[0].line, 3);
  assert.equal(parsed.records[0].values.nome, 'Camisa; Especial');

  const report = await importProductsCsv({ csv, preview: true });
  assert.equal(report.canImport, true);
  assert.deepEqual(report.summary, { totalRows: 1, validRows: 1, invalidRows: 0, imported: 0 });
  assert.equal(report.rows[0].product.preco, 19.9);
  assert.equal(report.rows[0].product.categoria, category.nome);
  const saved = await database.get('SELECT id FROM produtos WHERE sku = ?', ['csv-preview-valid']);
  assert.equal(saved, undefined);
});

test('prévia relata erros por linha e bloqueia arquivo inteiro', async () => {
  const csv = [
    'nome,sku,preco,categoria,estoque,status',
    `Produto inválido,csv-invalid-a,abc,Não Existe,-1,rascunho`,
    `Produto duplicado,csv-invalid-a,10,${category.nome},1,ativo`,
  ].join('\n');
  const report = await importProductsCsv({ csv, preview: true });

  assert.equal(report.canImport, false);
  assert.equal(report.summary.totalRows, 2);
  assert.equal(report.summary.invalidRows, 2);
  assert.ok(report.rows[0].errors.some((error) => error.code === 'INVALID_NUMBER'));
  assert.ok(report.rows[0].errors.some((error) => error.code === 'CATEGORY_NOT_FOUND'));
  assert.ok(report.rows[0].errors.some((error) => error.code === 'NUMBER_OUT_OF_RANGE'));
  assert.ok(report.rows[0].errors.some((error) => error.code === 'INVALID_STATUS'));
  assert.ok(report.rows.every((row) => row.errors.some((error) => error.code === 'DUPLICATE_SKU_IN_FILE')));

  const commitReport = await importProductsCsv({ csv, preview: false });
  assert.equal(commitReport.mode, 'import');
  assert.equal(commitReport.summary.imported, 0);
  const saved = await database.get(
    `SELECT COUNT(*) AS total FROM produtos WHERE sku IN (?, ?)`,
    ['csv-invalid-a', 'csv-invalid-b']
  );
  assert.equal(Number(saved.total), 0);
});

test('confirmação válida importa todas as linhas em uma transação', async () => {
  const csv = [
    'nome,sku,preco,categoria,estoque,destaque,produto_novo,status',
    `Camisa CSV A,csv-import-a,99.90,${category.nome},3,1,sim,ativo`,
    `Camisa CSV B,csv-import-b,120,${category.nome},4,0,não,inativo`,
  ].join('\n');
  const preview = await importProductsCsv({ csv, preview: true });
  assert.equal(preview.canImport, true);

  const result = await importProductsCsv({ csv, preview: false });
  assert.equal(result.mode, 'import');
  assert.equal(result.summary.imported, 2);
  assert.equal(result.products.length, 2);
  const saved = await database.all(
    `SELECT sku, preco, estoque, destaque, produto_novo, status
     FROM produtos WHERE sku IN (?, ?) ORDER BY sku`,
    ['csv-import-a', 'csv-import-b']
  );
  assert.deepEqual(saved, [
    { sku: 'csv-import-a', preco: 99.9, estoque: 3, destaque: 1, produto_novo: 1, status: 'ativo' },
    { sku: 'csv-import-b', preco: 120, estoque: 4, destaque: 0, produto_novo: 0, status: 'inativo' },
  ]);
});

test('controller exige o contrato único com csv e preview explícitos', async () => {
  await assert.rejects(
    () => productsController.importCsv({ body: { produtos: [] } }, {}),
    (error) => error.code === 'CSV_IMPORT_CONTRACT_INVALID'
  );
});

test('parser rejeita aspas não encerradas indicando a linha', () => {
  assert.throws(
    () => parseCsv('nome,preco\n"Produto sem fechamento,10'),
    (error) => error.code === 'CSV_PARSE_ERROR' && /linha 2/.test(error.message)
  );
});
