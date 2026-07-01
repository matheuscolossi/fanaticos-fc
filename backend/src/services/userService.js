const userModel = require('../models/userModel');
const { createHttpError } = require('../utils/http');

async function listUsers() {
  return userModel.listAdminsView();
}

async function deleteUser(targetId, requesterId) {
  if (String(targetId) === String(requesterId)) {
    throw createHttpError(400, 'Você não pode excluir a própria conta.', 'CANNOT_DELETE_SELF');
  }

  const target = await userModel.findById(targetId);
  if (!target) throw createHttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');

  if (target.perfil === 'admin') {
    const { c } = await userModel.countAdmins();
    if (Number(c) <= 1) {
      throw createHttpError(409, 'Não é possível excluir o único administrador do sistema.', 'LAST_ADMIN');
    }
  }

  await userModel.unlinkPedidos(targetId);
  await userModel.unlinkLogs(targetId);
  await userModel.remove(targetId);
  return { message: 'Usuário excluído.' };
}

module.exports = { deleteUser, listUsers };
