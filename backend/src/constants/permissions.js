// Lista canônica de permissões granulares para administradores/funcionários.
const PERMISSOES = [
  { key: 'produtos.visualizar',        label: 'Visualizar produtos' },
  { key: 'produtos.cadastrar',          label: 'Cadastrar produtos' },
  { key: 'produtos.editar',             label: 'Editar produtos' },
  { key: 'produtos.excluir',            label: 'Excluir produtos' },
  { key: 'estoque.gerenciar',           label: 'Gerenciar estoque' },
  { key: 'pedidos.visualizar',          label: 'Visualizar pedidos' },
  { key: 'pedidos.alterar',             label: 'Alterar pedidos' },
  { key: 'clientes.gerenciar',          label: 'Gerenciar clientes' },
  { key: 'cupons.criar',                label: 'Criar cupons' },
  { key: 'financeiro.visualizar',       label: 'Visualizar financeiro' },
  { key: 'configuracoes.acessar',       label: 'Acessar configurações' },
  { key: 'administradores.gerenciar',   label: 'Gerenciar administradores' },
];

const PERMISSOES_KEYS = PERMISSOES.map(p => p.key);

module.exports = { PERMISSOES, PERMISSOES_KEYS };
