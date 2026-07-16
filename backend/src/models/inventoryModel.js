const { createHttpError } = require('../utils/http');

function parseItems(items) {
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function aggregateItems(items) {
  const totals = new Map();
  for (const item of parseItems(items)) {
    const productId = Number(item.productId ?? item.id);
    const quantity = Number(item.qty ?? item.quantidade);
    const tamanho = String(item.tamanho || '').trim() || null;
    const cor = String(item.cor || '').trim() || null;
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw createHttpError(400, 'Item inválido para movimentação de estoque.', 'STOCK_ITEM_INVALID');
    }
    const key = `${productId}:${tamanho || ''}:${cor || ''}`;
    const current = totals.get(key) || { productId, tamanho, cor, quantity: 0 };
    current.quantity += quantity;
    totals.set(key, current);
  }
  if (totals.size === 0) {
    throw createHttpError(400, 'Nenhum item válido para movimentação de estoque.', 'STOCK_ITEMS_REQUIRED');
  }
  return [...totals.values()].sort(
    (a, b) => a.productId - b.productId
      || String(a.tamanho).localeCompare(String(b.tamanho))
      || String(a.cor).localeCompare(String(b.cor))
  );
}

async function getVariantContext(item, db) {
  const colorCount = await db.get(
    'SELECT COUNT(*) AS total FROM produto_variantes_cores WHERE produto_id = ?',
    [item.productId]
  );
  if (Number(colorCount?.total || 0) > 0) {
    if (!item.tamanho || !item.cor) {
      throw createHttpError(400, 'Selecione tamanho e cor do produto.', 'PRODUCT_COLOR_VARIANT_REQUIRED');
    }
    const colorVariant = await db.get(
      `SELECT tamanho, cor, estoque, estoque_reservado FROM produto_variantes_cores
       WHERE produto_id = ? AND tamanho = ? AND cor = ?`,
      [item.productId, item.tamanho, item.cor]
    );
    if (!colorVariant) throw createHttpError(400, 'Combinação de tamanho e cor inválida.', 'PRODUCT_COLOR_VARIANT_INVALID');
    return { usesColorVariants: true, usesVariants: true, colorVariant, variant: colorVariant };
  }
  const count = await db.get(
    'SELECT COUNT(*) AS total FROM produto_variantes WHERE produto_id = ?',
    [item.productId]
  );
  if (Number(count?.total || 0) === 0) return { usesColorVariants: false, usesVariants: false, variant: null };
  if (!item.tamanho) {
    throw createHttpError(400, 'Selecione uma variação do produto.', 'PRODUCT_VARIANT_REQUIRED');
  }
  const variant = await db.get(
    `SELECT tamanho, estoque, estoque_reservado FROM produto_variantes
     WHERE produto_id = ? AND tamanho = ?`,
    [item.productId, item.tamanho]
  );
  if (!variant) {
    throw createHttpError(400, 'Variação não cadastrada para o produto.', 'PRODUCT_VARIANT_INVALID');
  }
  return { usesColorVariants: false, usesVariants: true, variant };
}

function insufficientColorVariantStockError(item, variant) {
  const available = variant ? Math.max(0, Number(variant.estoque) - Number(variant.estoque_reservado || 0)) : 0;
  return createHttpError(409, `Estoque insuficiente para ${item.tamanho} / ${item.cor}. Disponível: ${available}.`, 'INSUFFICIENT_COLOR_VARIANT_STOCK');
}

function insufficientVariantStockError(item, variant) {
  const available = variant
    ? Math.max(0, Number(variant.estoque) - Number(variant.estoque_reservado || 0))
    : 0;
  return createHttpError(
    409,
    `Estoque insuficiente para o tamanho ${item.tamanho}. Disponível: ${available}.`,
    'INSUFFICIENT_VARIANT_STOCK'
  );
}

async function getStock(productId, db) {
  return db.get(
    `SELECT id, nome, estoque, COALESCE(estoque_reservado, 0) AS estoque_reservado
     FROM produtos WHERE id = ?`,
    [productId]
  );
}

function insufficientStockError(product) {
  const available = product
    ? Math.max(0, Number(product.estoque) - Number(product.estoque_reservado))
    : 0;
  return createHttpError(
    409,
    product ? `Estoque insuficiente para "${product.nome}". Disponível: ${available}.` : 'Produto indisponível.',
    'INSUFFICIENT_STOCK'
  );
}

async function reserve(items, db) {
  for (const item of aggregateItems(items)) {
    const context = await getVariantContext(item, db);
    if (context.usesColorVariants) {
      const colorResult = await db.run(
        `UPDATE produto_variantes_cores SET estoque_reservado = estoque_reservado + ?
         WHERE produto_id = ? AND tamanho = ? AND cor = ? AND estoque - estoque_reservado >= ?`,
        [item.quantity, item.productId, item.tamanho, item.cor, item.quantity]
      );
      if (Number(colorResult.changes) !== 1) throw insufficientColorVariantStockError(item, context.colorVariant);
      await db.run('UPDATE produto_variantes SET estoque_reservado = estoque_reservado + ? WHERE produto_id = ? AND tamanho = ?', [item.quantity, item.productId, item.tamanho]);
      await db.run('UPDATE produtos SET estoque_reservado = estoque_reservado + ? WHERE id = ?', [item.quantity, item.productId]);
      continue;
    }
    if (context.usesVariants) {
      const variantResult = await db.run(
        `UPDATE produto_variantes
         SET estoque_reservado = estoque_reservado + ?
         WHERE produto_id = ? AND tamanho = ? AND estoque - estoque_reservado >= ?`,
        [item.quantity, item.productId, item.tamanho, item.quantity]
      );
      if (Number(variantResult.changes) !== 1) {
        throw insufficientVariantStockError(item, context.variant);
      }
      await db.run(
        'UPDATE produtos SET estoque_reservado = estoque_reservado + ? WHERE id = ?',
        [item.quantity, item.productId]
      );
      continue;
    }
    const result = await db.run(
      `UPDATE produtos
       SET estoque_reservado = COALESCE(estoque_reservado, 0) + ?
       WHERE id = ?
         AND (status = 'ativo' OR status IS NULL)
         AND estoque - COALESCE(estoque_reservado, 0) >= ?`,
      [item.quantity, item.productId, item.quantity]
    );
    if (Number(result.changes) !== 1) {
      throw insufficientStockError(await getStock(item.productId, db));
    }
  }
}

async function commit(items, db, { reserved }) {
  for (const item of aggregateItems(items)) {
    const context = await getVariantContext(item, db);
    if (context.usesColorVariants) {
      const colorResult = reserved
        ? await db.run(
          `UPDATE produto_variantes_cores SET estoque = estoque - ?, estoque_reservado = estoque_reservado - ?
           WHERE produto_id = ? AND tamanho = ? AND cor = ? AND estoque >= ? AND estoque_reservado >= ?`,
          [item.quantity, item.quantity, item.productId, item.tamanho, item.cor, item.quantity, item.quantity]
        )
        : await db.run(
          `UPDATE produto_variantes_cores SET estoque = estoque - ?
           WHERE produto_id = ? AND tamanho = ? AND cor = ? AND estoque - estoque_reservado >= ?`,
          [item.quantity, item.productId, item.tamanho, item.cor, item.quantity]
        );
      if (Number(colorResult.changes) !== 1) throw insufficientColorVariantStockError(item, context.colorVariant);
      await db.run(
        reserved
          ? 'UPDATE produto_variantes SET estoque = estoque - ?, estoque_reservado = estoque_reservado - ? WHERE produto_id = ? AND tamanho = ?'
          : 'UPDATE produto_variantes SET estoque = estoque - ? WHERE produto_id = ? AND tamanho = ?',
        reserved ? [item.quantity, item.quantity, item.productId, item.tamanho] : [item.quantity, item.productId, item.tamanho]
      );
      await db.run(
        reserved
          ? 'UPDATE produtos SET estoque = estoque - ?, estoque_reservado = estoque_reservado - ? WHERE id = ?'
          : 'UPDATE produtos SET estoque = estoque - ? WHERE id = ?',
        reserved ? [item.quantity, item.quantity, item.productId] : [item.quantity, item.productId]
      );
      continue;
    }
    if (context.usesVariants) {
      const variantResult = reserved
        ? await db.run(
          `UPDATE produto_variantes
           SET estoque = estoque - ?, estoque_reservado = estoque_reservado - ?
           WHERE produto_id = ? AND tamanho = ? AND estoque >= ? AND estoque_reservado >= ?`,
          [item.quantity, item.quantity, item.productId, item.tamanho, item.quantity, item.quantity]
        )
        : await db.run(
          `UPDATE produto_variantes SET estoque = estoque - ?
           WHERE produto_id = ? AND tamanho = ? AND estoque - estoque_reservado >= ?`,
          [item.quantity, item.productId, item.tamanho, item.quantity]
        );
      if (Number(variantResult.changes) !== 1) {
        throw insufficientVariantStockError(item, context.variant);
      }
      await db.run(
        reserved
          ? 'UPDATE produtos SET estoque = estoque - ?, estoque_reservado = estoque_reservado - ? WHERE id = ?'
          : 'UPDATE produtos SET estoque = estoque - ? WHERE id = ?',
        reserved
          ? [item.quantity, item.quantity, item.productId]
          : [item.quantity, item.productId]
      );
      continue;
    }
    const result = reserved
      ? await db.run(
        `UPDATE produtos
         SET estoque = estoque - ?, estoque_reservado = estoque_reservado - ?
         WHERE id = ? AND estoque >= ? AND estoque_reservado >= ?`,
        [item.quantity, item.quantity, item.productId, item.quantity, item.quantity]
      )
      : await db.run(
        `UPDATE produtos
         SET estoque = estoque - ?
         WHERE id = ? AND estoque - COALESCE(estoque_reservado, 0) >= ?`,
        [item.quantity, item.productId, item.quantity]
      );
    if (Number(result.changes) !== 1) {
      throw insufficientStockError(await getStock(item.productId, db));
    }
  }
}

async function release(items, db) {
  for (const item of aggregateItems(items)) {
    const context = await getVariantContext(item, db);
    if (context.usesColorVariants) {
      const colorResult = await db.run(
        `UPDATE produto_variantes_cores SET estoque_reservado = estoque_reservado - ?
         WHERE produto_id = ? AND tamanho = ? AND cor = ? AND estoque_reservado >= ?`,
        [item.quantity, item.productId, item.tamanho, item.cor, item.quantity]
      );
      if (Number(colorResult.changes) !== 1) throw createHttpError(500, 'Inconsistência ao liberar reserva de cor.', 'COLOR_VARIANT_RELEASE_INCONSISTENT');
      await db.run('UPDATE produto_variantes SET estoque_reservado = estoque_reservado - ? WHERE produto_id = ? AND tamanho = ?', [item.quantity, item.productId, item.tamanho]);
      await db.run('UPDATE produtos SET estoque_reservado = estoque_reservado - ? WHERE id = ?', [item.quantity, item.productId]);
      continue;
    }
    if (context.usesVariants) {
      const variantResult = await db.run(
        `UPDATE produto_variantes SET estoque_reservado = estoque_reservado - ?
         WHERE produto_id = ? AND tamanho = ? AND estoque_reservado >= ?`,
        [item.quantity, item.productId, item.tamanho, item.quantity]
      );
      if (Number(variantResult.changes) !== 1) {
        throw createHttpError(500, 'Inconsistência ao liberar reserva da variação.', 'VARIANT_RELEASE_INCONSISTENT');
      }
      await db.run(
        'UPDATE produtos SET estoque_reservado = estoque_reservado - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
      continue;
    }
    const result = await db.run(
      `UPDATE produtos
       SET estoque_reservado = estoque_reservado - ?
       WHERE id = ? AND estoque_reservado >= ?`,
      [item.quantity, item.productId, item.quantity]
    );
    if (Number(result.changes) !== 1) {
      throw createHttpError(500, 'Inconsistência ao liberar reserva de estoque.', 'STOCK_RELEASE_INCONSISTENT');
    }
  }
}

async function restore(items, db) {
  for (const item of aggregateItems(items)) {
    const context = await getVariantContext(item, db);
    if (context.usesColorVariants) {
      await db.run('UPDATE produto_variantes_cores SET estoque = estoque + ? WHERE produto_id = ? AND tamanho = ? AND cor = ?', [item.quantity, item.productId, item.tamanho, item.cor]);
      await db.run('UPDATE produto_variantes SET estoque = estoque + ? WHERE produto_id = ? AND tamanho = ?', [item.quantity, item.productId, item.tamanho]);
      await db.run('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [item.quantity, item.productId]);
      continue;
    }
    if (context.usesVariants) {
      await db.run(
        'UPDATE produto_variantes SET estoque = estoque + ? WHERE produto_id = ? AND tamanho = ?',
        [item.quantity, item.productId, item.tamanho]
      );
      await db.run(
        'UPDATE produtos SET estoque = estoque + ? WHERE id = ?',
        [item.quantity, item.productId]
      );
      continue;
    }
    const result = await db.run(
      'UPDATE produtos SET estoque = estoque + ? WHERE id = ?',
      [item.quantity, item.productId]
    );
    if (Number(result.changes) !== 1) {
      throw createHttpError(500, 'Não foi possível devolver um item ao estoque.', 'STOCK_RESTORE_FAILED');
    }
  }
}

module.exports = {
  aggregateItems,
  commit,
  release,
  reserve,
  restore,
};
