const fs = require("fs");

async function main() {
  let pagina = 1;
  let produtos = [];

  while (true) {
    const res = await fetch(
      `https://pedidoatacado.com/wp-json/wc/store/v1/products?page=${pagina}&per_page=100`
    );

    const dados = await res.json();

    if (!dados.length) break;

    produtos.push(...dados);
    console.log(`Página ${pagina}: ${dados.length} produtos`);

    pagina++;
  }

  fs.writeFileSync("produtos.json", JSON.stringify(produtos, null, 2));
  console.log(`${produtos.length} produtos baixados.`);
}

main();