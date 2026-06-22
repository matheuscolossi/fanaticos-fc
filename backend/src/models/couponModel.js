const { all, get, run } = require('../config/database');

function list(query = {}) {
  const filters = [];
  const params = [];

  if (query.status) {
    filters.push('status = ?');
    params.push(query.status);
  }
  if (query.busca) {
    filters.push("(LOWER(codigo) LIKE LOWER(?) OR LOWER(COALESCE(descricao,'')) LIKE LOWER(?))");
    const term = `%${query.busca}%`;
    params.push(term, term);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return all(`SELECT * FROM cupons ${where} ORDER BY created_at DESC`, params);
}

function findById(id) {
  return get('SELECT * FROM cupons WHERE id = ?', [id]);
}

function findByCodigo(codigo) {
  return get('SELECT * FROM cupons WHERE LOWER(codigo) = LOWER(?)', [codigo]);
}

function create(c) {
  return run(
    `INSERT INTO cupons (
      codigo, descricao, tipo_desconto, valor, valor_minimo_compra, desconto_maximo,
      data_inicio, data_fim, limite_uso_total, limite_uso_por_usuario,
      produtos_ids, categorias_ids, clientes_ids, frete_gratis, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      JSON_VALUE(?), JSON_VALUE(?), JSON_VALUE(?), ?, ?
    )`,
    [
      c.codigo, c.descricao, c.tipo_desconto, c.valor, c.valor_minimo_compra, c.desconto_maximo,
      c.data_inicio, c.data_fim, c.limite_uso_total, c.limite_uso_por_usuario,
      JSON.stringify(c.produtos_ids || []), JSON.stringify(c.categorias_ids || []), JSON.stringify(c.clientes_ids || []),
      c.frete_gratis ? 1 : 0, c.status || 'ativo',
    ]
  );
}

function update(id, c) {
  return run(
    `UPDATE cupons SET
      codigo = ?, descricao = ?, tipo_desconto = ?, valor = ?, valor_minimo_compra = ?, desconto_maximo = ?,
      data_inicio = ?, data_fim = ?, limite_uso_total = ?, limite_uso_por_usuario = ?,
      produtos_ids = JSON_VALUE(?), categorias_ids = JSON_VALUE(?), clientes_ids = JSON_VALUE(?),
      frete_gratis = ?, status = ?
     WHERE id = ?`,
    [
      c.codigo, c.descricao, c.tipo_desconto, c.valor, c.valor_minimo_compra, c.desconto_maximo,
      c.data_inicio, c.data_fim, c.limite_uso_total, c.limite_uso_por_usuario,
      JSON.stringify(c.produtos_ids || []), JSON.stringify(c.categorias_ids || []), JSON.stringify(c.clientes_ids || []),
      c.frete_gratis ? 1 : 0, c.status || 'ativo',
      id,
    ]
  );
}

function setStatus(id, status) {
  return run('UPDATE cupons SET status = ? WHERE id = ?', [status, id]);
}

function remove(id) {
  return run('DELETE FROM cupons WHERE id = ?', [id]);
}

async function duplicate(id) {
  const original = await findById(id);
  if (!original) return null;

  let novoCodigo = `${original.codigo}-COPIA`;
  let tentativa = 1;
  while (await findByCodigo(novoCodigo)) {
    tentativa += 1;
    novoCodigo = `${original.codigo}-COPIA${tentativa}`;
  }

  return create({
    codigo: novoCodigo,
    descricao: original.descricao,
    tipo_desconto: original.tipo_desconto,
    valor: original.valor,
    valor_minimo_compra: original.valor_minimo_compra,
    desconto_maximo: original.desconto_maximo,
    data_inicio: original.data_inicio,
    data_fim: original.data_fim,
    limite_uso_total: original.limite_uso_total,
    limite_uso_por_usuario: original.limite_uso_por_usuario,
    produtos_ids: original.produtos_ids,
    categorias_ids: original.categorias_ids,
    clientes_ids: original.clientes_ids,
    frete_gratis: original.frete_gratis,
    status: 'inativo',
  });
}

async function countUsoTotal(codigo) {
  const row = await get('SELECT COUNT(*) as c FROM pedidos WHERE LOWER(cupom_codigo) = LOWER(?)', [codigo]);
  return Number(row?.c || 0);
}

async function countUsoPorUsuario(codigo, usuarioId) {
  const row = await get(
    'SELECT COUNT(*) as c FROM pedidos WHERE LOWER(cupom_codigo) = LOWER(?) AND usuario_id = ?',
    [codigo, usuarioId]
  );
  return Number(row?.c || 0);
}

function listPedidosByCupom(codigo) {
  return all(
    `SELECT id, total, cupom_desconto, status, nome_cliente, email_cliente, created_at
     FROM pedidos WHERE LOWER(cupom_codigo) = LOWER(?) ORDER BY created_at DESC`,
    [codigo]
  );
}

module.exports = {
  countUsoPorUsuario,
  countUsoTotal,
  create,
  duplicate,
  findByCodigo,
  findById,
  list,
  listPedidosByCupom,
  remove,
  setStatus,
  update,
};
