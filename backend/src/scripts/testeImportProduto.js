const fs = require("fs");

const produtos = JSON.parse(fs.readFileSync("produtos.json", "utf-8"));

const p = produtos[0];

const produtoFormatado = {
  fornecedor_id: p.id,
  nome: p.name,
  slug: p.slug,
  sku: p.sku,
  descricao: p.description,
  preco: Number(p.prices.price) / 100,
  imagem: p.images?.[0]?.src || null,
  categoria: p.categories?.[0]?.name || null,
  link_fornecedor: p.permalink,
};

console.log(produtoFormatado);