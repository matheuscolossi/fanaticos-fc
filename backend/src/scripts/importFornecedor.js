const fs = require("fs");
const { init, run, get } = require("../config/database");

async function importar() {
  await init();

  const produtos = JSON.parse(fs.readFileSync("produtos.json", "utf-8"));

  // TESTE: importa só 1 produto
  const produtosTeste = produtos.slice(0, 1);

  console.log(`Importando ${produtosTeste.length} produto de teste...`);

  for (const p of produtosTeste) {
    const nome = p.name;
    const slug = p.slug;
    const sku = p.sku || `fornecedor-${p.id}`;
    const descricao = p.description || "";
    const preco = Number(p.prices?.price || 0) / 100;
    const imagem = p.images?.[0]?.src || null;
    const categoriaNome = p.categories?.[0]?.name || "Fornecedor";

    let categoria = await get(
      "SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)",
      [categoriaNome]
    );

    if (!categoria) {
      await run(
        "INSERT INTO categorias (nome) VALUES (?)",
        [categoriaNome]
      );

      categoria = await get(
        "SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)",
        [categoriaNome]
      );
    }

    const existente = await get(
      "SELECT id FROM produtos WHERE sku = ?",
      [sku]
    );

    if (existente) {
      await run(
        `UPDATE produtos
         SET nome = ?, slug = ?, preco = ?, descricao = ?, imagens = JSON_VALUE(?),
             categoria_id = ?, status = 'ativo', estoque = 999
         WHERE sku = ?`,
        [
          nome,
          slug,
          preco,
          descricao,
          JSON.stringify([imagem]),
          categoria.id,
          sku,
        ]
      );

      console.log(`Atualizado: ${nome}`);
    } else {
      await run(
        `INSERT INTO produtos
         (nome, slug, sku, preco, descricao, imagens, categoria_id, status, estoque)
         VALUES (?, ?, ?, ?, ?, JSON_VALUE(?), ?, 'ativo', 999)`,
        [
          nome,
          slug,
          sku,
          preco,
          descricao,
          JSON.stringify([imagem]),
          categoria.id,
        ]
      );

      console.log(`Criado: ${nome}`);
    }
  }

  console.log("Teste finalizado.");
  process.exit(0);
}

importar().catch((err) => {
  console.error(err);
  process.exit(1);
});