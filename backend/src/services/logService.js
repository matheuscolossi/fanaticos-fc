const logModel = require('../models/logModel');

// Registra uma ação no histórico de auditoria. Nunca lança erro — uma falha
// ao gravar o log não deve quebrar a ação que está sendo registrada.
async function registrar(usuario, acao, detalhes) {
  try {
    await logModel.create({
      usuario_id: usuario?.id,
      usuario_nome: usuario?.nome,
      acao,
      detalhes,
    });
  } catch (e) {
    console.error('[log:registrar:error]', e.message);
  }
}

async function listLogs(query) {
  return logModel.list(query);
}

module.exports = { listLogs, registrar };
