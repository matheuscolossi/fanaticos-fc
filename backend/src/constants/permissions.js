// Lista canônica de permissões granulares para administradores/funcionários.
const PERMISSOES = [
  { key: 'produtos.visualizar',        label: 'Visualizar produtos' },
  { key: 'produtos.cadastrar',          label: 'Cadastrar produtos' },
  { key: 'produtos.editar',             label: 'Editar produtos' },
  { key: 'produtos.excluir',            label: 'Excluir produtos' },
  { key: 'categorias.visualizar',       label: 'Visualizar categorias' },
  { key: 'categorias.criar',            label: 'Criar categorias' },
  { key: 'categorias.editar',           label: 'Editar categorias' },
  { key: 'categorias.excluir',          label: 'Excluir categorias' },
  { key: 'estoque.gerenciar',           label: 'Gerenciar estoque' },
  { key: 'pedidos.visualizar',          label: 'Visualizar pedidos' },
  { key: 'pedidos.alterar',             label: 'Alterar pedidos' },
  { key: 'clientes.gerenciar',          label: 'Gerenciar clientes' },
  { key: 'cupons.visualizar',           label: 'Visualizar cupons' },
  { key: 'cupons.criar',                label: 'Criar cupons' },
  { key: 'cupons.editar',               label: 'Editar cupons' },
  { key: 'cupons.excluir',              label: 'Excluir cupons' },
  { key: 'promocoes.visualizar',        label: 'Visualizar promoções' },
  { key: 'promocoes.criar',             label: 'Criar promoções' },
  { key: 'promocoes.editar',            label: 'Editar promoções' },
  { key: 'promocoes.excluir',           label: 'Excluir promoções' },
  { key: 'avaliacoes.visualizar',       label: 'Visualizar avaliações' },
  { key: 'avaliacoes.moderar',          label: 'Moderar avaliações' },
  { key: 'trocas.visualizar',           label: 'Visualizar trocas e devoluções' },
  { key: 'trocas.gerenciar',            label: 'Gerenciar trocas e devoluções' },
  { key: 'conteudo.visualizar',         label: 'Visualizar banners e conteúdos' },
  { key: 'conteudo.gerenciar',          label: 'Gerenciar banners e conteúdos' },
  { key: 'analytics.visualizar',        label: 'Visualizar analytics de conversão' },
  { key: 'financeiro.visualizar',       label: 'Visualizar financeiro' },
  { key: 'configuracoes.acessar',       label: 'Acessar configurações' },
  { key: 'administradores.gerenciar',   label: 'Gerenciar administradores' },
];

const PERMISSOES_KEYS = PERMISSOES.map(p => p.key);

module.exports = { PERMISSOES, PERMISSOES_KEYS };
