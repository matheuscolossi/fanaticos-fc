/**n
 * 🛒 Importador ATKFUT → Fanáticos FC (v4)
 *
 * Usa a BUSCA do site: /?s=TERMO&post_type=product
 * Você adiciona uma busca por vez com o nº de páginas.
 *
 * =============================================
 * INSTALAÇÃO (dentro da pasta backend):
 *   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 *
 * USO:
 *   node importar-produtos.js              (importa tudo)
 *   node importar-produtos.js --dry-run    (só mostra, não salva)
 * =============================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
let puppeteer, StealthPlugin;

const CONFIG = {
  dbPath: path.join(__dirname, '../../fanaticos.db'),
  baseUrl: 'https://pedidoatacado.com',

  // ══════════════════════════════════════════════════════════════
  // 📋 ADICIONE SUAS BUSCAS AQUI — UMA POR UMA
  //
  // search:  o que você pesquisa no site (ex: "FLAMENGO")
  // pages:   quantas páginas tem o resultado
  // mapTo:   categoria no Fanáticos FC
  //
  // 💡 Como descobrir o nº de páginas:
  //    1. Vá em pedidoatacado.com
  //    2. Pesquise o termo (ex: "FLAMENGO")
  //    3. Role até o final e veja os botões de página (1 2 3...)
  //    4. O último número = pages
  //
  // URL gerada: /?s=FLAMENGO&post_type=product
  // Página 2:   /page/2/?s=FLAMENGO&post_type=product
  // ══════════════════════════════════════════════════════════════

  searches: [
    // Vá adicionando aqui, uma por uma:
    { search: 'https://pedidoatacado.com/?s=FORTALEZA&post_type=product', pages: 1, mapTo: 'Brasileirão' },
  
  
  ],

  defaultPrice: 149.90,
  estoquePadrao: 50,
  dryRun: process.argv.includes('--dry-run'),
  delayBetweenPages: 3000,
  delayBetweenSearches: 5000,
  delayBetweenProducts: 2000,
  waitForCloudflare: 15000,
  headless: false,
};

// ─── BANCO DE DADOS ──────────────────────────
let db;
function openDb() {
  return new Promise((res, rej) => {
    db = new sqlite3.Database(CONFIG.dbPath, (e) => {
      if (e) rej(e); else { console.log('✅ Banco conectado:', CONFIG.dbPath); res(); }
    });
  });
}
function dbRun(sql, p = []) { return new Promise((res, rej) => { db.run(sql, p, function(e) { if(e) rej(e); else res({lastID:this.lastID,changes:this.changes}); }); }); }
function dbGet(sql, p = []) { return new Promise((res, rej) => { db.get(sql, p, (e,r) => { if(e) rej(e); else res(r); }); }); }
function dbAll(sql, p = []) { return new Promise((res, rej) => { db.all(sql, p, (e,r) => { if(e) rej(e); else res(r); }); }); }

async function getCategoryId(name) {
  let r = await dbGet('SELECT id FROM categorias WHERE nome = ?', [name]);
  if (r) return r.id;
  const res = await dbRun('INSERT INTO categorias (nome) VALUES (?)', [name]);
  console.log(`  📁 Categoria criada: "${name}" (id: ${res.lastID})`);
  return res.lastID;
}

async function productExists(nome) {
  return !!(await dbGet('SELECT id FROM produtos WHERE nome = ?', [nome]));
}

async function insertProduct(product, mapTo) {
  const catId = await getCategoryId(mapTo);
  const imgs = JSON.stringify(product.images || []);
  const desc = product.description || 'Qualidade Tailandesa 1:1 — tecido premium, detalhes perfeitos.';
  const r = await dbRun(
    'INSERT INTO produtos (nome,preco,categoria_id,descricao,imagens,estoque,destaque) VALUES (?,?,?,?,?,?,?)',
    [product.name, product.price || CONFIG.defaultPrice, catId, desc, imgs, CONFIG.estoquePadrao, 0]
  );
  return r.lastID;
}

// ─── UTILIDADES ──────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parsePrice(t) {
  if (!t) return CONFIG.defaultPrice;
  const n = parseFloat(t.replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(n) ? CONFIG.defaultPrice : n;
}

// ─── NAVEGADOR ───────────────────────────────
async function launchBrowser() {
  puppeteer = require('puppeteer-extra');
  StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  console.log('🌐 Iniciando navegador...');
  return await puppeteer.launch({
    headless: CONFIG.headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });
}

async function waitCF(page) {
  try {
    await page.waitForFunction(
      () => !document.body?.textContent?.includes('Verifying your browser'),
      { timeout: CONFIG.waitForCloudflare }
    );
    await sleep(2000);
  } catch { console.log('  ⚠️  Timeout Cloudflare...'); }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let t = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 400); t += 400;
        if (t >= document.body.scrollHeight) {
          window.scrollTo(0, document.body.scrollHeight);
          clearInterval(timer);
          setTimeout(resolve, 500);
        }
      }, 150);
    });
  });
}

// ─── COLETOR ─────────────────────────────────
// Monta URLs de busca:
//   Página 1: /?s=FLAMENGO&post_type=product
//   Página 2: /page/2/?s=FLAMENGO&post_type=product

async function collectFromSearch(page, item) {
  const allUrls = new Set();
  const term = encodeURIComponent(item.search);

  for (let p = 1; p <= item.pages; p++) {
    // Monta URL correta
    const pageUrl = p === 1
      ? `${CONFIG.baseUrl}/?s=${term}&post_type=product`
      : `${CONFIG.baseUrl}/page/${p}/?s=${term}&post_type=product`;

    console.log(`  📄 Página ${p}/${item.pages}: ${pageUrl}`);

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await waitCF(page);
      await autoScroll(page);
      await sleep(1000);

      // Coleta links de produto
      const urls = await page.evaluate(() => {
        const s = new Set();
        document.querySelectorAll('a[href*="/produto/"], a[href*="/product/"]').forEach(el => {
          const h = el.getAttribute('href');
          if (h) s.add(h);
        });
        return [...s];
      });

      urls.forEach(u => allUrls.add(u));
      console.log(`     ✅ ${urls.length} produtos (acumulado: ${allUrls.size})`);

      if (p < item.pages) await sleep(CONFIG.delayBetweenPages);
    } catch (err) {
      console.log(`     ❌ Erro página ${p}: ${err.message}`);
    }
  }

  return [...allUrls];
}

// ─── EXTRATOR ────────────────────────────────
async function extractProduct(page, url) {
  const fullUrl = url.startsWith('http') ? url : CONFIG.baseUrl + url;
  await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await waitCF(page);
  await sleep(1500);

  const product = await page.evaluate(() => {
    const gt = (s) => document.querySelector(s)?.textContent?.trim() || '';
    const name = gt('.product_title') || gt('h1.entry-title') || gt('h1');

    const pe = document.querySelector(
      '.price ins .woocommerce-Price-amount, .price > .woocommerce-Price-amount, .price .amount'
    );
    const price = pe ? pe.textContent.trim() : '';

    const desc = gt('.woocommerce-product-details__short-description') ||
      gt('#tab-description') || '';

    const images = [];
    for (const sel of [
      '.woocommerce-product-gallery__image img',
      '.woocommerce-product-gallery__image a',
      '.product-images img',
      '.wp-post-image',
    ]) {
      document.querySelectorAll(sel).forEach(el => {
        const src = el.getAttribute('data-large_image') ||
          el.getAttribute('data-src') ||
          el.getAttribute('href') ||
          el.getAttribute('src');
        if (src && !src.includes('placeholder') && !src.includes('data:image') && !images.includes(src)) {
          images.push(src);
        }
      });
      if (images.length > 0) break;
    }

    return { name, price, description: desc, images };
  });

  product.url = fullUrl;
  product.price = parsePrice(product.price);
  return product;
}

// ─── MAIN ────────────────────────────────────
async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  🛒  Importador ATKFUT → Fanáticos FC  v4     ║');
  console.log('║  🔍  Modo: Busca do site                      ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  if (CONFIG.dryRun) console.log('⚠️  MODO DRY-RUN: nada será salvo\n');

  await openDb();
  const cats = await dbAll('SELECT id, nome FROM categorias');
  console.log(`📁 Categorias: ${cats.map(c => c.nome).join(', ')}\n`);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    // Cloudflare
    console.log('🔐 Resolvendo Cloudflare...');
    await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitCF(page);

    // Coletar URLs de todas as buscas
    const productMap = []; // { url, mapTo }

    for (let i = 0; i < CONFIG.searches.length; i++) {
      const item = CONFIG.searches[i];
      console.log(`\n═══ [${i+1}/${CONFIG.searches.length}] Buscando: "${item.search}" (${item.pages} pág) → ${item.mapTo} ═══`);

      const urls = await collectFromSearch(page, item);
      urls.forEach(u => productMap.push({ url: u, mapTo: item.mapTo }));
      console.log(`  📦 ${urls.length} produtos coletados`);

      if (i < CONFIG.searches.length - 1) await sleep(CONFIG.delayBetweenSearches);
    }

    // Dedup por URL
    const seen = new Set();
    const unique = productMap.filter(p => {
      if (seen.has(p.url)) return false;
      seen.add(p.url); return true;
    });

    console.log(`\n📋 Total único: ${unique.length} produtos\n`);
    if (unique.length === 0) { console.log('❌ Nenhum produto.'); await browser.close(); return; }

    // Extrair e salvar
    let ok = 0, skip = 0, err = 0;
    for (let i = 0; i < unique.length; i++) {
      const { url, mapTo } = unique[i];
      console.log(`\n📦 [${i+1}/${unique.length}] Extraindo...`);
      try {
        const prod = await extractProduct(page, url);
        if (!prod.name) { console.log('  ⚠️ Sem nome'); skip++; continue; }
        if (await productExists(prod.name)) { console.log(`  ⏭️ "${prod.name}" já existe`); skip++; continue; }

        if (CONFIG.dryRun) {
          console.log(`  🔍 "${prod.name}" — R$${prod.price} — ${prod.images.length} imgs → ${mapTo}`);
        } else {
          const id = await insertProduct(prod, mapTo);
          console.log(`  ✅ "${prod.name}" (id:${id}) — R$${prod.price} — ${prod.images.length} imgs → ${mapTo}`);
        }
        ok++;
      } catch (e) { console.log(`  ❌ ${e.message}`); err++; }
      await sleep(CONFIG.delayBetweenProducts);
    }

    // Resumo
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log(`║  ✅ Pronto! ${ok} importados | ${skip} pulados | ${err} erros`);
    if (CONFIG.dryRun) console.log('║  ⚠️  Dry-run — nada salvo');
    console.log('╚═══════════════════════════════════════════════╝');

    if (!CONFIG.dryRun) {
      const t = await dbGet('SELECT COUNT(*) as c FROM produtos');
      console.log(`\n📊 Total no banco: ${t.c}`);
    }
  } finally {
    await browser.close();
    db.close();
    console.log('🌐 Fechado.');
  }
}

main().catch(console.error);