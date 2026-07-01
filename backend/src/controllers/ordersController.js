const { sendCreated } = require('../utils/http');
const logService = require('../services/logService');
const {
  createOrder,
  deleteOrder,
  getTrackingById,
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
  res.json(await getTrackingById(req.params.id));
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
