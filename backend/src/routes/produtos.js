const express = require('express');
const router = express.Router();
const { run, get, all } = require('../config/database');

module.exports = (adminMiddleware) => {
  // GET /api/produtos
  router.get('/', async (req, res) => {
    try {
      const { busca, categoria, precoMin, precoMax, destaque } = req.query;
      let sql = `
        SELECT p.*, c.nome as categoria_nome
        FROM produtos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (busca) {
        sql += ` AND LOWER(p.nome) LIKE LOWER(?)`;
        params.push(`%${busca}%`);
      }
      if (categoria) { sql += ` AND p.categoria_id = ?`; params.push(categoria); }
      if (precoMin)  { sql += ` AND p.preco >= ?`;       params.push(precoMin); }
      if (precoMax)  { sql += ` AND p.preco <= ?`;       params.push(precoMax); }
      if (destaque)  { sql += ` AND p.destaque = 1`; }

      const orderMap = {
        'az':         'p.nome ASC',
        'za':         'p.nome DESC',
        'preco_asc':  'p.preco ASC',
        'preco_desc': 'p.preco DESC',
        'recente':    'p.created_at DESC',
      };
      const order = orderMap[req.query.ordem] || 'p.created_at DESC';
      sql += ` ORDER BY ${order}`;

      const produtos = await all(sql, params);
      res.json(produtos.map(p => ({ ...p, imagens: JSON.parse(p.imagens || '[]') })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/produtos/:id
  router.get('/:id', async (req, res) => {
    try {
      const p = await get(
        'SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?',
        [req.params.id]
      );
      if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
      res.json({ ...p, imagens: JSON.parse(p.imagens || '[]') });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/produtos
  router.post('/', adminMiddleware, async (req, res) => {
    try {
      const { nome, preco, categoria_id, descricao, imagens, estoque, destaque } = req.body;
      if (!nome || !preco) return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
      const result = await run(
        'INSERT INTO produtos (nome, preco, categoria_id, descricao, imagens, estoque, destaque) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nome, preco, categoria_id || null, descricao || '', JSON.stringify(imagens || []), estoque || 0, destaque ? 1 : 0]
      );
      res.status(201).json({ message: 'Produto criado', id: result.lastID });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // PUT /api/produtos/:id
  router.put('/:id', adminMiddleware, async (req, res) => {
    try {
      const { nome, preco, categoria_id, descricao, imagens, estoque, destaque } = req.body;
      const existing = await get('SELECT id FROM produtos WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
      await run(
        'UPDATE produtos SET nome=?, preco=?, categoria_id=?, descricao=?, imagens=?, estoque=?, destaque=? WHERE id=?',
        [nome, preco, categoria_id || null, descricao || '', JSON.stringify(imagens || []), estoque || 0, destaque ? 1 : 0, req.params.id]
      );
      res.json({ message: 'Produto atualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/produtos/:id
  router.delete('/:id', adminMiddleware, async (req, res) => {
    try {
      const existing = await get('SELECT id FROM produtos WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
      await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
      res.json({ message: 'Produto excluído' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
