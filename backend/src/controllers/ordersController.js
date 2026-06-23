const { sendCreated } = require('../utils/http');
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
  res.json(await updateOrder(req.params.id, req.body));
}

async function destroy(req, res) {
  res.json(await deleteOrder(req.params.id));
}

module.exports = {
  destroy,
  index,
  myOrders,
  store,
  tracking,
  update,
};
