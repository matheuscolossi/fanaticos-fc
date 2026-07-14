// Classificação centralizada do catálogo. O fornecedor costuma deixar
// categoria_id vazio ou genérico, então o nome do produto é a segunda fonte
// de verdade para evitar que itens internacionais caiam em Brasileirão.

const CATEGORY_NAMES = {
  brasileirao: 'Brasileirão',
  internacionais: 'Times Internacionais',
  selecoes: 'Seleções',
  retro: 'Retrô',
  feminina: 'Feminina',
  nba: 'NBA',
  outros: 'Outros',
};

const BRAZILIAN_TEAMS = [
  'flamengo', 'palmeiras', 'corinthians', 'sao paulo', 'gremio', 'internacional',
  'botafogo', 'atletico mineiro', 'vasco', 'fluminense', 'cruzeiro', 'santos',
  'athletico paranaense', 'athletico pr', 'bahia', 'fortaleza', 'vitoria', 'sport',
  'ceara', 'red bull bragantino', 'bragantino', 'chapecoense', 'america mineiro',
  'atletico goianiense', 'goias', 'avai', 'nautico', 'remo', 'csa', 'santa cruz',
  'volta redonda', 'paysandu', 'figueirense', 'criciuma', 'cuiaba', 'juventude',
  'juventus da mooca',
];

const INTERNATIONAL_TEAMS = [
  'real madrid', 'barcelona', 'psg', 'bayern de munique', 'bayern munich',
  'borussia dortmund', 'bayer leverkusen', 'rb leipzig', 'leipzig', 'wolfsburg',
  'hamburgo', 'union berlin', 'eintracht frankfurt', 'manchester city', 'manchester united', 'liverpool',
  'arsenal', 'chelsea', 'tottenham', 'newcastle', 'aston villa', 'west ham',
  'brighton', 'everton', 'fulham', 'juventus', 'inter de milao', 'inter milan',
  'milan', 'napoli', 'roma', 'lazio', 'atalanta', 'fiorentina', 'parma', 'bologna',
  'atletico de madrid', 'real sociedad', 'villarreal', 'athletic bilbao', 'girona',
  'sevilla', 'real betis', 'valencia', 'lille', 'lyon', 'marseille', 'olympique de marseille', 'monaco',
  'fiorentina', 'ajax', 'psv', 'benfica', 'porto', 'sporting', 'braga',
  'afc richmond', 'alaves', 'borussia monchengladbach', 'new york red bull',
  'new york red bulls', 'venezia', 'watford', 'wolves', 'wolfes', 'zaragoza',
  'celtic',
  'inter miami', 'la galaxy', 'lafc', 'atlanta united', 'al hilal', 'al nassr',
  'america do mexico', 'america mexico', 'universidad catolica', 'universidad de chile',
  'boca juniors', 'river plate', 'racing', 'independiente', 'san lorenzo',
  'atletico nacional', 'colo colo', 'cerro porteno', 'penarol', 'nacional',
  'galatasaray', 'fenerbahce', 'besiktas', 'zenit', 'olympiacos',
];

const NBA_TEAMS = [
  'lakers', 'los angeles lakers', 'miami heat', 'golden state warriors',
  'boston celtics', 'chicago bulls', 'brooklyn nets', 'dallas mavericks',
  'minnesota timberwolves', 'new orleans pelicans', 'new york knicks',
  'toronto raptors', 'cleveland cavaliers', 'atlanta hawks', 'all star',
];

const SELECTIONS = [
  'alemanha', 'argentina', 'australia', 'austria', 'belgica', 'brasil', 'canada',
  'catar', 'chile', 'colombia', 'croacia', 'curaçao', 'dinamarca', 'equador', 'escocia',
  'espanha', 'estados unidos', 'franca', 'gana', 'holanda', 'inglaterra', 'italia',
  'japao', 'marrocos', 'mexico', 'nigeria', 'noruega', 'pais de gales', 'panama', 'paraguai',
  'peru', 'polonia', 'portugal', 'republica tcheca', 'russia', 'senegal', 'suecia',
  'suica', 'turquia', 'ucrania', 'uruguai', 'venezuela', 'africa do sul', 'grecia',
  'costa rica', 'irlanda', 'jamaica', 'eslovaquia', 'eslovenia', 'finlandia', 'coreia',
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasPhrase(value, phrase) {
  const text = ` ${normalize(value)} `;
  return text.includes(` ${normalize(phrase)} `);
}

function hasAnyPhrase(value, phrases) {
  return phrases.some(phrase => hasPhrase(value, phrase));
}

function supplierCategoryNames(product) {
  return (product.categories || [])
    .map(category => typeof category === 'string' ? category : category?.name)
    .filter(Boolean)
    .map(normalize);
}

function hasSupplierCategory(product, ...names) {
  const categories = supplierCategoryNames(product);
  return names.some(name => categories.includes(normalize(name)));
}

function classifyProduct(product = {}) {
  const name = product.nome || product.name || '';

  // Ordem de prioridade: atributos específicos vencem o campeonato/clube.
  if (hasAnyPhrase(name, ['feminina', 'feminino', 'cropped']) || hasSupplierCategory(product, 'Feminina')) {
    return CATEGORY_NAMES.feminina;
  }
  if (hasAnyPhrase(name, ['retro', 'retrô']) || hasSupplierCategory(product, 'Retrô')) {
    return CATEGORY_NAMES.retro;
  }
  if (hasAnyPhrase(name, NBA_TEAMS) || hasSupplierCategory(product, 'NBA')) {
    return CATEGORY_NAMES.nba;
  }
  if (hasAnyPhrase(name, INTERNATIONAL_TEAMS)) {
    return CATEGORY_NAMES.internacionais;
  }
  if (hasAnyPhrase(name, SELECTIONS) || hasPhrase(name, 'selecao') || hasPhrase(name, 'selecoes') || hasSupplierCategory(product, 'Seleções')) {
    return CATEGORY_NAMES.selecoes;
  }
  if (hasAnyPhrase(name, BRAZILIAN_TEAMS) || hasSupplierCategory(product, 'Brasileirão Série A', 'Brasileirão Série B', 'Libertadores', 'Brasileirão')) {
    return CATEGORY_NAMES.brasileirao;
  }
  if (hasSupplierCategory(product, 'Times Internacionais')) {
    return CATEGORY_NAMES.internacionais;
  }

  return CATEGORY_NAMES.outros;
}

module.exports = {
  CATEGORY_NAMES,
  classifyProduct,
  normalize,
};
