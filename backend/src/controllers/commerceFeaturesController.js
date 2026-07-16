const service = require('../services/commerceFeaturesService');
const { sendCreated } = require('../utils/http');

async function favorites(req, res) { res.json(await service.listFavorites(req.user.id)); }
async function addFavorite(req, res) { sendCreated(res, await service.addFavorite(req.user.id, req.params.produtoId)); }
async function removeFavorite(req, res) { res.json(await service.removeFavorite(req.user.id, req.params.produtoId)); }
async function cart(req, res) { res.json(await service.getServerCart(req.user.id)); }
async function saveCart(req, res) { res.json(await service.saveServerCart(req.user.id, req.body)); }
async function recent(req, res) { res.json(await service.listRecentlyViewed(req.user.id)); }
async function recordRecent(req, res) { res.json(await service.recordRecentlyViewed(req.user.id, req.params.produtoId)); }
async function related(req, res) { res.json(await service.listRelatedProducts(req.params.produtoId)); }
async function alerts(req, res) { res.json(await service.listRestockAlerts(req.user.id)); }
async function createAlert(req, res) { sendCreated(res, await service.createRestockAlert(req.user, req.params.produtoId, req.body)); }
async function cancelAlert(req, res) { res.json(await service.cancelRestockAlert(req.user.id, req.params.id)); }
async function returns(req, res) { res.json(await service.listReturnRequests(req.user.id)); }
async function createReturn(req, res) { sendCreated(res, await service.createReturnRequest(req.user.id, req.body)); }
async function adminReturns(req, res) { res.json(await service.listReturnRequestsAdmin(req.query.status)); }
async function updateReturn(req, res) { res.json(await service.updateReturnRequest(req.params.id, req.body, req.staffUser.id)); }
async function consent(req, res) { res.json(await service.saveConsent(req.user, req.body)); }
async function analyticsEvent(req, res) { res.json(await service.recordAnalyticsEvent(req.user, req.body)); }
async function analyticsSummary(req, res) { res.json(await service.analyticsSummary(req.query.dias || 30)); }
async function publicBanners(req, res) { res.json(await service.listPublicBanners(req.query.posicao || 'home_hero')); }
async function adminBanners(req, res) { res.json(await service.listBannersAdmin()); }
async function createBanner(req, res) { sendCreated(res, await service.createBanner(req.body)); }
async function updateBanner(req, res) { res.json(await service.updateBanner(req.params.id, req.body)); }
async function deleteBanner(req, res) { res.json(await service.deleteBanner(req.params.id)); }
async function publicContent(req, res) { res.json(await service.listPublicContent()); }
async function adminContent(req, res) { res.json(await service.listContentAdmin()); }
async function saveContent(req, res) { res.json(await service.saveContent(req.body)); }

module.exports = {
  addFavorite, adminBanners, adminContent, adminReturns, alerts, analyticsEvent,
  analyticsSummary, cancelAlert, cart, consent, createAlert, createBanner, createReturn,
  deleteBanner, favorites, publicBanners, publicContent, recent, recordRecent, related,
  removeFavorite, returns, saveCart, saveContent, updateBanner, updateReturn,
};
