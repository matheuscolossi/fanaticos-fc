const couponService = require('../services/couponService');
const { sendCreated } = require('../utils/http');

async function index(req, res) {
  res.json(await couponService.listCoupons(req.query));
}

async function show(req, res) {
  res.json(await couponService.getCoupon(req.params.id));
}

async function store(req, res) {
  sendCreated(res, await couponService.createCoupon(req.body));
}

async function update(req, res) {
  res.json(await couponService.updateCoupon(req.params.id, req.body));
}

async function duplicate(req, res) {
  sendCreated(res, await couponService.duplicateCoupon(req.params.id));
}

async function patchStatus(req, res) {
  res.json(await couponService.setCouponStatus(req.params.id, req.body.status));
}

async function destroy(req, res) {
  res.json(await couponService.deleteCoupon(req.params.id));
}

async function usage(req, res) {
  res.json(await couponService.getCouponUsage(req.params.id));
}

module.exports = { destroy, duplicate, index, patchStatus, show, store, update, usage };
