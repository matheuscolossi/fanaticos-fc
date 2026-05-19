const { all } = require('../config/database');

function list() {
  return all('SELECT * FROM categorias ORDER BY nome');
}

module.exports = { list };
