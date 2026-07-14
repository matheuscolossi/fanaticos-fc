const fs = require('fs');
const { all, init, run } = require('../config/database');
const { classifyProduct } = require('../utils/categoryClassifier');

function categoriaDoProduto(produto) {
  return classifyProduct({
    name: produto.name,
    categories: produto.categories,
  });
}

async function importar() {
  await init();

  const produtos = JSON.parse(fs.readFileSync('produtos.json', 'utf-8'));

  // O fornecedor reutiliza o mesmo SKU em produtos diferentes, por exemplo
  // em camisas de temporadas distintas. O slug identifica cada registro do
  // catalogo; usar somente o SKU descartava produtos validos.
  const produtosCadastrados = await all('SELECT slug, sku FROM produtos');
  const slugsExistentes = new Set(
    produtosCadastrados
      .map((produto) => String(produto.slug || '').trim())
      .filter(Boolean)
  );
  const skusExistentes = new Set(
    produtosCadastrados
      .map((produto) => String(produto.sku || '').trim())
      .filter(Boolean)
  );

  const categoriasCadastradas = await all('SELECT id, nome FROM categorias');
  const categoriasPorNome = new Map(
    categoriasCadastradas.map((categoria) => [categoria.nome.toLowerCase(), categoria])
  );

  console.log(`Verificando ${produtos.length} produtos...`);

  let criados = 0;
  let pulados = 0;
  let skusReutilizados = 0;

  for (const produto of produtos) {
    const nome = produto.name;
    const slug = String(produto.slug || '').trim();
    const sku = String(produto.sku || '').trim();

    if (!sku) {
      console.log(`Pulando sem SKU: ${nome}`);
      pulados++;
      continue;
    }

    // Slugs sao unicos no arquivo do fornecedor. Para registros sem slug,
    // usamos o SKU como fallback para manter a importacao idempotente.
    const jaExiste = slug
      ? slugsExistentes.has(slug)
      : skusExistentes.has(sku);

    if (jaExiste) {
      console.log(`Ja existe, pulando: ${nome}`);
      pulados++;
      continue;
    }

    if (skusExistentes.has(sku)) {
      skusReutilizados++;
    }

    const precoOriginal = Number(produto.prices?.price || 0) / 100;
    const preco = +(precoOriginal * 2).toFixed(2);
    const imagem = produto.images?.[0]?.src || null;
    const categoriaNome = categoriaDoProduto(produto);

    let categoria = categoriasPorNome.get(categoriaNome.toLowerCase());
    if (!categoria) {
      const resultado = await run('INSERT INTO categorias (nome) VALUES (?)', [categoriaNome]);
      categoria = { id: resultado.lastID, nome: categoriaNome };
      categoriasPorNome.set(categoriaNome.toLowerCase(), categoria);
    }

    await run(
      `INSERT INTO produtos
       (nome, slug, sku, preco, descricao, imagens, categoria_id, status, estoque)
       VALUES (?, ?, ?, ?, NULL, JSON_VALUE(?), ?, 'ativo', 999)`,
      [nome, slug || null, sku, preco, JSON.stringify([imagem]), categoria.id]
    );

    if (slug) slugsExistentes.add(slug);
    skusExistentes.add(sku);
    console.log(`Criado: ${nome} | Categoria: ${categoriaNome} | R$ ${preco}`);
    criados++;
  }

  console.log(
    `Importacao finalizada. Criados: ${criados}. Pulados: ${pulados}. ` +
    `SKUs reutilizados: ${skusReutilizados}.`
  );
  process.exit(0);
}

importar().catch((err) => {
  console.error('Falha na importacao:', err);
  process.exit(1);
});
