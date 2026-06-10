const { sendCreated } = require('../utils/http');
const {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  listProductsPaginated,
  updateProduct,
} = require('../services/productService');

async function index(req, res) {
  if (req.query.admin === 'true') {
    return res.json(await listProducts(req.query));
  }
  res.json(await listProductsPaginated(req.query));
}

async function show(req, res) {
  res.json(await getProduct(req.params.id));
}

async function store(req, res) {
  sendCreated(res, await createProduct(req.body));
}

async function update(req, res) {
  res.json(await updateProduct(req.params.id, req.body));
}

async function destroy(req, res) {
  res.json(await deleteProduct(req.params.id));
}

module.exports = {
  destroy,
  index,
  show,
  store,
  update,
};
