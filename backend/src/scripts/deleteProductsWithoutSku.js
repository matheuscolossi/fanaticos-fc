const { all, close, init, run } = require('../config/database');

const APPLY = process.argv.includes('--apply');
const CHUNK_SIZE = 200;

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function idsFromProducts(products) {
  return new Set(products.map((product) => String(product.id)));
}

async function loadRecords(table) {
  return all(`SELECT id, produtos_ids FROM ${table} ORDER BY id`);
}

async function cleanReferences(table, records, productIds) {
  let changed = 0;
  let removedReferences = 0;

  for (const record of records) {
    const original = parseJsonArray(record.produtos_ids);
    const filtered = original.filter((productId) => !productIds.has(String(productId)));
    const removed = original.length - filtered.length;

    if (removed === 0) continue;

    removedReferences += removed;

    if (APPLY) {
      await run(
        `UPDATE ${table} SET produtos_ids = JSON_VALUE(?) WHERE id = ?`,
        [JSON.stringify(filtered), record.id]
      );
      changed++;
    }
  }

  return { changed, removedReferences };
}

async function deleteProducts(products) {
  if (!APPLY) return 0;

  let deleted = 0;

  for (let index = 0; index < products.length; index += CHUNK_SIZE) {
    const chunk = products.slice(index, index + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const result = await run(
      `DELETE FROM produtos WHERE id IN (${placeholders})`,
      chunk.map((product) => product.id)
    );
    deleted += Number(result.changes || 0);
  }

  return deleted;
}

async function main() {
  await init();

  const products = await all(`
    SELECT id, nome, categoria_id, sku
    FROM produtos
    WHERE COALESCE(TRIM(sku), '') = ''
    ORDER BY id
  `);

  const productIds = idsFromProducts(products);
  const [coupons, promotions] = await Promise.all([
    loadRecords('cupons'),
    loadRecords('promocoes'),
  ]);
  const couponResult = await cleanReferences('cupons', coupons, productIds);
  const promotionResult = await cleanReferences('promocoes', promotions, productIds);

  console.log(`Produtos sem SKU encontrados: ${products.length}`);
  console.log(`Referências em cupons: ${couponResult.removedReferences}`);
  console.log(`Referências em promoções: ${promotionResult.removedReferences}`);

  if (products.length > 0) {
    console.log('\nAmostra:');
    products.slice(0, 40).forEach((product) => {
      console.log(`- #${product.id} ${product.nome}`);
    });
  }

  if (!APPLY) {
    console.log('\nSimulação concluída. Nada foi alterado.');
    console.log('Para excluir os produtos e limpar as referências, execute:');
    console.log('npm run delete:sem-sku -- --apply');
    return;
  }

  const deleted = await deleteProducts(products);
  console.log(`\nExclusão concluída. Produtos removidos: ${deleted}.`);
  console.log(`Cupons atualizados: ${couponResult.changed}.`);
  console.log(`Promoções atualizadas: ${promotionResult.changed}.`);
}

main()
  .catch((error) => {
    console.error('Falha ao remover produtos sem SKU:', error.message);
    process.exitCode = 1;
  })
  .finally(() => close().catch(() => {}));
