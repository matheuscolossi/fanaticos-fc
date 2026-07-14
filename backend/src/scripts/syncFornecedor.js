const fs = require('fs');
const path = require('path');

const API_URL = 'https://pedidoatacado.com/wp-json/wc/store/v1/products';
const PER_PAGE = 100;

async function fetchPage(params) {
  const url = new URL(API_URL);
  url.searchParams.set('page', String(params.page));
  url.searchParams.set('per_page', String(PER_PAGE));
  if (params.search) url.searchParams.set('search', params.search);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fornecedor respondeu ${response.status} para ${url.search}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Resposta invalida do fornecedor para ${url.search}`);
  }
  return data;
}

async function fetchAll(params = {}) {
  const produtos = [];
  let page = 1;

  while (true) {
    const dados = await fetchPage({ ...params, page });
    if (!dados.length) break;

    produtos.push(...dados);
    if (params.search) {
      console.log(`Busca "${params.search}" pagina ${page}: ${dados.length} produtos`);
    } else {
      console.log(`Pagina ${page}: ${dados.length} produtos`);
    }

    page++;
  }

  return produtos;
}

function getSupplementalSearchTerms() {
  const indexPath = path.resolve(__dirname, '../../../frontend/index.html');

  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    const terms = [...html.matchAll(/openTime\('([^']+)'\)/g)].map((match) => match[1].trim());
    return [...new Set(terms)].filter(Boolean);
  } catch (error) {
    console.warn(`Nao foi possivel ler o menu da loja: ${error.message}`);
    return ['Brasil'];
  }
}

async function main() {
  const produtosPorId = new Map();

  // A listagem geral do fornecedor nao inclui todos os produtos que aparecem
  // na busca do site. Primeiro carregamos a listagem normal.
  for (const produto of await fetchAll()) {
    produtosPorId.set(String(produto.id), produto);
  }

  // Depois complementamos com as buscas usadas no menu da loja. Isso evita
  // que selecoes, clubes e lancamentos recentes desaparecam do nosso catalogo
  // apenas porque ficaram fora da listagem geral da API.
  const termos = getSupplementalSearchTerms();
  console.log(`Complementando o catalogo com ${termos.length} buscas do menu...`);

  for (let index = 0; index < termos.length; index += 8) {
    const lote = termos.slice(index, index + 8);
    const resultados = await Promise.all(lote.map(async (search) => {
      try {
        return await fetchAll({ search });
      } catch (error) {
        console.warn(`Falha na busca "${search}": ${error.message}`);
        return [];
      }
    }));

    for (const produtos of resultados) {
      for (const produto of produtos) {
        produtosPorId.set(String(produto.id), produto);
      }
    }
  }

  const produtos = [...produtosPorId.values()];
  fs.writeFileSync('produtos.json', JSON.stringify(produtos, null, 2));
  console.log(`Sincronizacao concluida: ${produtos.length} produtos unicos.`);
}

main().catch((error) => {
  console.error('Falha ao sincronizar fornecedor:', error);
  process.exit(1);
});
