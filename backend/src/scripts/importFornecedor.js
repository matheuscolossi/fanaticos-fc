const fs = require("fs");
const { init, run, get } = require("../config/database");

function limparDescricao(html = "") {
  return html
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&amp;/g, "&")
    .trim();
}

async function importar() {
  await init();

  const produtos = JSON.parse(fs.readFileSync("produtos.json", "utf-8"));
  const produtosTeste = produtos.slice(0, 1);

  console.log(`Importando ${produtosTeste.length} produto de teste...`);

  for (const p of produtosTeste) {
    const nome = p.name;
    const slug = p.slug;
    const sku = p.sku || `fornecedor-${p.id}`;
    const descricao = limparDescricao(p.short_description || p.description || "");
    const preco = Number(p.prices?.price || 0) / 100;
    const imagem = p.images?.[0]?.src || null;

    // categoria fixa para não criar Bahia, Flamengo etc.
    const categoriaNome = "Brasileirão";

    let categoria = await get(
      "SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)",
      [categoriaNome]
    );

    if (!categoria) {
      await run("INSERT INTO categorias (nome) VALUES (?)", [categoriaNome]);

      categoria = await get(
        "SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?)",
        [categoriaNome]
      );
    }

    const existente = await get("SELECT id FROM produtos WHERE sku = ?", [sku]);

    if (existente) {
      await run(
        `UPDATE produtos
         SET nome = ?, slug = ?, preco = ?, descricao = ?, imagens = JSON_VALUE(?),
             categoria_id = ?, status = 'ativo', estoque = 999
         WHERE sku = ?`,
        [nome, slug, preco, descricao, JSON.stringify([imagem]), categoria.id, sku]
      );

      console.log(`Atualizado: ${nome}`);
    } else {
      await run(
        `INSERT INTO produtos
         (nome, slug, sku, preco, descricao, imagens, categoria_id, status, estoque)
         VALUES (?, ?, ?, ?, ?, JSON_VALUE(?), ?, 'ativo', 999)`,
        [nome, slug, sku, preco, descricao, JSON.stringify([imagem]), categoria.id]
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