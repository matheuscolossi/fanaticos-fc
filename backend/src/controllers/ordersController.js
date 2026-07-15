const { sendCreated } = require('../utils/http');
const logService = require('../services/logService');
const {
  createOrder,
  deleteOrder,
  getTrackingForUser,
  listOrders,
  listOrdersByUser,
  updateOrder,
} = require('../services/orderService');

async function store(req, res) {
  sendCreated(res, await createOrder({ ...req.body, usuario_id: req.user.id }));
}

async function index(req, res) {
  res.json(await listOrders());
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
  const result = await updateOrder(req.params.id, req.body);
  await logService.registrar(req.staffUser, 'Pedido alterado', `ID ${req.params.id}`);
  res.json(result);
}

async function destroy(req, res) {
  const result = await deleteOrder(req.params.id);
  await logService.registrar(req.staffUser, 'Pedido excluído', `ID ${req.params.id}`);
  res.json(result);
}

module.exports = {
  destroy,
  index,
  myOrders,
  store,
  tracking,
  update,
};
