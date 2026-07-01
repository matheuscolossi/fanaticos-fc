const fs = require("fs");
const { init, run, get } = require("../config/database");

async function importar() {
  await init();

  const produtos = JSON.parse(fs.readFileSync("produtos.json", "utf-8"));

  const timesExistentes = [
    // Brasileirão

  "Athletico Paranaense",

  "Bahia",

  "Botafogo",

  "Grêmio",

  "Internacional",

  "Vitória",

  "Volta Redonda",



  // Seleções

  "Alemanha",

  "Argentina",

  "Austrália",

  "Áustria",

  "Bélgica",

  "Brasil",

  "Kit",

  "Noruega",

  "Venezuela",



  // Liga Espanhola

  "Athletic Bilbao",

  "Atlético de Madrid",

  "Barcelona",

  "Villarreal",



  // Liga Inglesa

  "AFC Richmond",

  "Arsenal",

  "Aston Villa",

  "West Ham",



  // Liga Italiana

  "Atalanta",

  "Bologna",

  "Venezia",



  // Liga Alemã

  "Bayer Leverkusen",

  "Bayern de Munique",

  "Borussia Dortmund",

  "Wolfsburg",



  // Liga Portuguesa

  "Braga",



  // Liga Argentina

  "Boca Juniors",



  // Liga Holandesa

  "Ajax",



  // Liga Mexicana

  "América",



  // MLS

  "Atlanta United",



  // Outras Ligas

  "Al Hilal",

  "Al Nassr",

  "Atlético Nacional",

  "Besiktas",

  "Zenit",



  // Outros

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
    const timeFornecedor = p.categories?.[0]?.name || "";

    if (timesExistentes.includes(timeFornecedor)) {
      console.log(`Pulando time já criado: ${timeFornecedor} - ${p.name}`);
      pulados++;
      continue;
    }

    const nome = p.name;
    const slug = p.slug;
    const sku = p.sku || `fornecedor-${p.id}`;

    const precoOriginal = Number(p.prices?.price || 0) / 100;
    const preco = +(precoOriginal * 2).toFixed(2);

    const imagem = p.images?.[0]?.src || null;
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

    console.log(`Criado: ${nome} | R$ ${preco}`);
    criados++;
  }

  console.log(`Importação finalizada. Criados: ${criados}. Pulados: ${pulados}.`);
  process.exit(0);
}

importar().catch((err) => {
  console.error(err);
  process.exit(1);
});