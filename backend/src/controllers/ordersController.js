const { sendCreated } = require('../utils/http');
const logService = require('../services/logService');
const {
  archiveOrder,
  createOrder,
  deleteOrder,
  getTrackingForUser,
  listOrders,
  listOrdersByUser,
  unarchiveOrder,
  updateOrder,
} = require('../services/orderService');

async function store(req, res) {
  sendCreated(res, await createOrder({ ...req.body, usuario_id: req.user.id }));
}

async function index(req, res) {
  const archiveMode = req.query.arquivados === 'true'
    ? 'archived'
    : req.query.todos === 'true' ? 'all' : 'active';
  res.json(await listOrders(archiveMode));
}

async function myOrders(req, res) {
  res.json(await listOrdersByUser(req.user));
}

async function tracking(req, res) {
  try {
    res.json(await getTrackingForUser(req.params.id, req.user));
  } catch (error) {
    if (error.code === 'ORDER_TRACKING_NOT_FOUND') {
      const requestedId = /^\d{1,18}$/.test(String(req.params.id)) ? req.params.id : 'formato-inválido';
      const ip = String(req.ip || req.socket?.remoteAddress || 'desconhecido').slice(0, 80);
      await logService.registrar(
        req.user,
        'Tentativa de rastreamento negada',
        `Pedido solicitado: ${requestedId} · IP: ${ip}`
      );
    }
    throw error;
  }
}

async function update(req, res) {
  const result = await updateOrder(req.params.id, req.body, req.staffUser);
  await logService.registrar(req.staffUser, 'Pedido alterado', `ID ${req.params.id}`);
  res.json(result);
}

async function archive(req, res) {
  const result = await archiveOrder(req.params.id, req.body, req.staffUser);
  await logService.registrar(req.staffUser, 'Pedido arquivado', `ID ${req.params.id}`);
  res.json(result);
}

async function unarchive(req, res) {
  const result = await unarchiveOrder(req.params.id, req.staffUser);
  await logService.registrar(req.staffUser, 'Pedido desarquivado', `ID ${req.params.id}`);
  res.json(result);
}

async function destroy(req, res) {
  const result = await deleteOrder(req.params.id, req.staffUser);
  res.json(result);
}

module.exports = {
  archive,
  destroy,
  index,
  myOrders,
  store,
  tracking,
  unarchive,
  update,
};
