const { sendCreated } = require('../utils/http');
const {
  createOrder,
  getTrackingById,
  listOrders,
  listOrdersByUser,
  updateOrder,
} = require('../services/orderService');

async function store(req, res) {
  sendCreated(res, await createOrder(req.body));
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

module.exports = {
  index,
  myOrders,
  store,
  tracking,
  update,
};
