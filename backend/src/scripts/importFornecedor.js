const fs = require("fs");
const { init, run, get } = require("../config/database");
const { classifyProduct } = require("../utils/categoryClassifier");

function categoriaDoProduto(p) {
  return classifyProduct({ name: p.name, categories: p.categories });
}

async function importar() {
  await init();

  const produtos = JSON.parse(fs.readFileSync("produtos.json", "utf-8"));

  const timesExistentes = [
    "Athletico Paranaense",
    "Bahia",
    "Botafogo",
    "Grêmio",
    "Internacional",
    "Vitória",
    "Volta Redonda",

    "Alemanha",
    "Argentina",
    "Austrália",
    "Áustria",
    "Bélgica",
    "Brasil",
    "Kit",
    "Noruega",
    "Venezuela",

    "Athletic Bilbao",
    "Atlético de Madrid",
    "Barcelona",
    "Villarreal",

    "AFC Richmond",
    "Arsenal",
    "Aston Villa",
    "West Ham",

    "Atalanta",
    "Bologna",
    "Venezia",

    "Bayer Leverkusen",
    "Bayern de Munique",
    "Borussia Dortmund",
    "Wolfsburg",

    "Braga",
    "Boca Juniors",
    "Ajax",
    "América",
    "Atlanta United",

    "Al Hilal",
    "Al Nassr",
    "Atlético Nacional",
    "Besiktas",
    "Zenit",

    "Alaves",
    "Borussia Monchengladbach",
    "New York Red Bull",
    "Watford",
    "Wolves",
    "Zaragoza"
  ];

  console.log(`Verificando ${produtos.length} produtos...`);

  let criados = 0;
  let pulados = 0;

  for (const p of produtos) {
    const nomesCategorias = p.categories?.map(c => c.name) || [];

    if (timesExistentes.some(time => nomesCategorias.includes(time))) {
      console.log(`Pulando time já criado: ${p.name}`);
      pulados++;
      continue;
    }

    const nome = p.name;
    const slug = p.slug;
    const sku = p.sku || `fornecedor-${p.id}`;

    const precoOriginal = Number(p.prices?.price || 0) / 100;
    const preco = +(precoOriginal * 2).toFixed(2);

    const imagem = p.images?.[0]?.src || null;
    const categoriaNome = categoriaDoProduto(p);

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
      console.log(`Já existe, pulando: ${nome}`);
      pulados++;
      continue;
    }

    await run(
      `INSERT INTO produtos
       (nome, slug, sku, preco, descricao, imagens, categoria_id, status, estoque)
       VALUES (?, ?, ?, ?, NULL, JSON_VALUE(?), ?, 'ativo', 999)`,
      [
        nome,
        slug,
        sku,
        preco,
        JSON.stringify([imagem]),
        categoria.id,
      ]
    );

    console.log(`Criado: ${nome} | Categoria: ${categoriaNome} | R$ ${preco}`);
    criados++;
  }

  console.log(`Importação finalizada. Criados: ${criados}. Pulados: ${pulados}.`);
  process.exit(0);
}

importar().catch((err) => {
  console.error(err);
  process.exit(1);
});
