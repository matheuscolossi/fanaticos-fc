const { all, get } = require('../config/database');

function getDateRange(periodo) {
  const now = new Date();
  let start = new Date(now);

  switch (periodo) {
    case 'hoje':
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'mes':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'ano':
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      break;
    case '30d':
    default:
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  // Format without 'T' and 'Z' — compatible with PostgreSQL and SQLite
  const fmt = d => d.toISOString().replace('T', ' ').slice(0, 19);

  return { start: fmt(start), end: fmt(end) };
}

async function dashboard(req, res, next) {
  try {
    const periodo = req.query.periodo || '30d';
    const { start, end } = getDateRange(periodo);

    // All orders in the period — compute all derived stats in JS
    const periodOrders = await all(
      `SELECT id, itens, total, status, nome_cliente, created_at
       FROM pedidos WHERE created_at >= ? AND created_at <= ?
       ORDER BY created_at`,
      [start, end]
    );

    let receita = 0;
    let pedidosCount = 0;
    let ticketSum = 0;
    const por_status = {};
    const dayMap = new Map();
    const prodMap = new Map();

    const STATUS_EXCLUIDOS_RECEITA = ['cancelado', 'pendente', 'aguardando_pagamento'];

    for (const order of periodOrders) {
      const status = order.status || 'pendente';
      por_status[status] = (por_status[status] || 0) + 1;

      const total = Number(order.total) || 0;
      const contaReceita = !STATUS_EXCLUIDOS_RECEITA.includes(status);

      if (contaReceita) {
        receita += total;
        pedidosCount++;
        ticketSum += total;
      }

      // Group by day (first 10 chars of created_at = 'YYYY-MM-DD')
      const day = String(order.created_at).substring(0, 10);
      const dayEntry = dayMap.get(day) || { dia: day, receita: 0, pedidos: 0 };
      dayEntry.pedidos++;
      if (contaReceita) dayEntry.receita += total;
      dayMap.set(day, dayEntry);

      // Top products from itens JSON
      if (contaReceita) {
        try {
          const itens = typeof order.itens === 'string'
            ? JSON.parse(order.itens)
            : (order.itens || []);
          for (const item of itens) {
            const nome = item.nome || item.name || 'Desconhecido';
            const existing = prodMap.get(nome) || { nome, vendido: 0, receita: 0 };
            existing.vendido += Number(item.qty) || 1;
            existing.receita += (Number(item.preco ?? item.price) || 0) * (Number(item.qty) || 1);
            prodMap.set(nome, existing);
          }
        } catch { /* malformed itens — skip */ }
      }
    }

    const grafico = [...dayMap.values()].sort((a, b) => a.dia.localeCompare(b.dia));
    grafico.forEach(g => { g.receita = Math.round(g.receita * 100) / 100; });

    const top_produtos = [...prodMap.values()]
      .sort((a, b) => b.vendido - a.vendido)
      .slice(0, 5)
      .map(p => ({ ...p, receita: Math.round(p.receita * 100) / 100 }));

    const ticket_medio = pedidosCount > 0 ? ticketSum / pedidosCount : 0;

    // Product stock stats (all-time)
    const prodStats = await get(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN estoque = 0 THEN 1 END) as sem_estoque,
        COUNT(CASE WHEN estoque > 0 AND estoque <= 5 THEN 1 END) as estoque_baixo
       FROM produtos`
    );

    // Customer count
    const clienteRow = await get(
      `SELECT COUNT(*) as total FROM usuarios WHERE perfil = 'cliente'`
    );

    // 5 most recent orders (not period-filtered — always show latest)
    const pedidos_recentes = await all(
      `SELECT id, nome_cliente, total, status, created_at
       FROM pedidos ORDER BY created_at DESC LIMIT 5`
    );

    res.json({
      periodo: { inicio: start, fim: end, chave: periodo },
      receita: Math.round(receita * 100) / 100,
      total_pedidos: pedidosCount,
      ticket_medio: Math.round(ticket_medio * 100) / 100,
      por_status,
      grafico,
      top_produtos,
      total_produtos: Number(prodStats?.total || 0),
      sem_estoque: Number(prodStats?.sem_estoque || 0),
      estoque_baixo: Number(prodStats?.estoque_baixo || 0),
      total_clientes: Number(clienteRow?.total || 0),
      pedidos_recentes,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
