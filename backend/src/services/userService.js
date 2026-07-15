const userModel = require('../models/userModel');
const { createHttpError } = require('../utils/http');

async function listUsers() {
  return userModel.listClientsView();
}

async function deleteClient(targetId) {
  const id = Number(targetId);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== String(targetId)) {
    throw createHttpError(404, 'Cliente não encontrado.', 'CLIENT_NOT_FOUND');
  }

  const deleted = await userModel.removeClientWithRelations(id);
  if (!deleted) {
    // Administradores e IDs inexistentes são indistinguíveis nesta rota.
    throw createHttpError(404, 'Cliente não encontrado.', 'CLIENT_NOT_FOUND');
  }
  return { message: 'Cliente excluído.' };
}

module.exports = { deleteClient, listUsers };
