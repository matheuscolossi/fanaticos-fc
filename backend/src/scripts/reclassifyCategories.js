const { all, close, get, init, run } = require('../config/database');
const { CATEGORY_NAMES, classifyProduct } = require('../utils/categoryClassifier');

const APPLY = process.argv.includes('--apply');
const CHUNK_SIZE = 500;

async function findCategoryId(name) {
  const category = await get('SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)', [name]);
  return category?.id ?? null;
}

async function ensureOtherCategory() {
  let id = await findCategoryId(CATEGORY_NAMES.outros);
  if (id) return id;

  const result = await run(
    'INSERT INTO categorias (nome, ordem, status) VALUES (?, ?, ?)',
    [CATEGORY_NAMES.outros, 99, 'ativo']
  );
  return result.lastID || findCategoryId(CATEGORY_NAMES.outros);
}

function printSummary(products, changes, categoryIds) {
  const desired = new Map();
  for (const product of products) {
    const name = classifyProduct(product);
    desired.set(name, (desired.get(name) || 0) + 1);
  }

  console.log('\nResumo da classificação proposta:');
  for (const [name, count] of desired) {
    console.log(`- ${name}: ${count} produto(s)${categoryIds[name] ? ` (categoria ${categoryIds[name]})` : ''}`);
  }
  console.log(`- Alterações de categoria: ${changes.length}`);

  if (changes.length > 0) {
    console.log('\nAmostra das alterações:');
    changes.slice(0, 40).forEach(change => {
      console.log(`- #${change.id} ${change.nome}: ${change.atual} -> ${change.nova}`);
    });
  }
}

async function main() {
  await init();

  const products = await all('SELECT id, nome, categoria_id FROM produtos ORDER BY id');
  const categoryIds = {};
  for (const name of Object.values(CATEGORY_NAMES)) {
    categoryIds[name] = await findCategoryId(name);
  }

  const changes = [];
  for (const product of products) {
    const targetName = classifyProduct(product);
    const targetId = categoryIds[targetName];
    if (targetId && String(product.categoria_id) !== String(targetId)) {
      changes.push({
        id: product.id,
        nome: product.nome,
        atual: product.categoria_id || 'sem categoria',
        nova: `${targetName} (#${targetId})`,
        targetId,
      });
    } else if (!targetId && targetName === CATEGORY_NAMES.outros) {
      changes.push({
        id: product.id,
        nome: product.nome,
        atual: product.categoria_id || 'sem categoria',
        nova: 'Outros (nova categoria)',
        targetId: null,
      });
    }
  }

  printSummary(products, changes, categoryIds);

  if (!APPLY) {
    console.log('\nModo simulação: nada foi alterado. Use --apply para aplicar.');
    return;
  }

  if (!categoryIds[CATEGORY_NAMES.outros]) {
    categoryIds[CATEGORY_NAMES.outros] = await ensureOtherCategory();
  }

  const grouped = new Map();
  for (const change of changes) {
    const targetId = change.targetId || categoryIds[CATEGORY_NAMES.outros];
    if (!grouped.has(targetId)) grouped.set(targetId, []);
    grouped.get(targetId).push(change.id);
  }

  let updated = 0;
  for (const [targetId, ids] of grouped) {
    for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
      const chunk = ids.slice(offset, offset + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const result = await run(
        `UPDATE produtos SET categoria_id = ? WHERE id IN (${placeholders})`,
        [targetId, ...chunk]
      );
      updated += Number(result.changes || 0);
    }
  }

  console.log(`\nCategorias corrigidas: ${updated} produto(s).`);
}

main()
  .catch(error => {
    console.error('[reclassify:categories:error]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close().catch(() => {});
  });
