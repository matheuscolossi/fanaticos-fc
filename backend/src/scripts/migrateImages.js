const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { init, all, run } = require('../config/database');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BACKUP_FILE = path.join(
  require('os').homedir(),
  'Downloads',
  'steep-shadow-30734597_production_neondb_2026-06-11_11-18-53.json'
);

const DELAY_MS = 1000; // 1s entre uploads para evitar rate limit

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function uploadBase64(base64, nome) {
  try {
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'fanaticos-fc/produtos',
      resource_type: 'image',
    });
    return result.secure_url;
  } catch (e) {
    console.error(`  ERRO "${nome}": ${e.message}`);
    return null;
  }
}

async function migrate() {
  // 1. Carrega backup
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error('Backup não encontrado:', BACKUP_FILE);
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  console.log(`Backup: ${backup.length} produtos carregados\n`);

  // 2. Conecta ao banco
  console.log('Conectando ao banco...');
  await init();

  let ok = 0, sem_img = 0, erro = 0;

  for (let i = 0; i < backup.length; i++) {
    const p = backup[i];
    let imagens;
    try {
      imagens = typeof p.imagens === 'string' ? JSON.parse(p.imagens) : (p.imagens || []);
    } catch { imagens = []; }

    process.stdout.write(`[${i + 1}/${backup.length}] ${p.nome}... `);

    if (!imagens.length) {
      console.log('sem imagem');
      sem_img++;
      await run('UPDATE produtos SET imagens = JSON_VALUE(?) WHERE id = ?', ['[]', p.id]);
      continue;
    }

    const novas = [];
    for (const img of imagens) {
      if (img && img.startsWith('data:image/')) {
        const url = await uploadBase64(img, p.nome);
        if (url) {
          novas.push(url);
          await sleep(DELAY_MS);
        } else {
          erro++;
          // Mantém base64 se upload falhou
          novas.push(img);
        }
      } else if (img && img.startsWith('http')) {
        novas.push(img);
      }
    }

    await run(
      'UPDATE produtos SET imagens = JSON_VALUE(?) WHERE id = ?',
      [JSON.stringify(novas), p.id]
    );

    const urls = novas.filter(u => u.startsWith('http://') || u.startsWith('https://'));
    console.log(`✓ (${urls.length} URL, ${novas.length - urls.length} base64)`);
    ok++;
  }

  console.log('\n--- Concluído ---');
  console.log(`Processados : ${ok}`);
  console.log(`Sem imagem  : ${sem_img}`);
  console.log(`Erros upload: ${erro}`);
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
