const crypto = require('crypto');
const rateLimitModel = require('../models/rateLimitModel');
const { createHttpError } = require('../utils/http');

const MINUTE_MS = 60 * 1000;

function configuredLimit(name, fallback, min = 1, max = 10000) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function requestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').trim().toLowerCase().slice(0, 128);
}

function requestEmail(req) {
  return String(req.body?.email || '').trim().toLowerCase().slice(0, 254) || null;
}

function requestUserId(req) {
  return req.user?.id == null ? null : String(req.user.id);
}

function hashIdentifier(secret, scope, dimension, identifier) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${scope}:${dimension}:${identifier}`)
    .digest('hex');
}

function setRateHeaders(res, result) {
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(result.retryAfterSeconds));
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAtMs / 1000)));
}

function createRateLimiter({ secret, scope, policies }) {
  if (!secret) throw new Error('Rate limiter secret is required.');
  if (!scope || !Array.isArray(policies) || policies.length === 0) {
    throw new Error('Rate limiter scope and policies are required.');
  }

  return function rateLimitMiddleware(req, res, next) {
    Promise.resolve().then(async () => {
      for (const policy of policies) {
        const identifier = policy.key(req);
        if (!identifier) continue;
        const result = await rateLimitModel.consume({
          scope: `${scope}:${policy.dimension}`,
          identifierHash: hashIdentifier(secret, scope, policy.dimension, identifier),
          windowMs: policy.windowMs,
          limit: policy.limit,
        });
        setRateHeaders(res, result);
        if (!result.allowed) {
          res.setHeader('Retry-After', String(result.retryAfterSeconds));
          throw createHttpError(
            429,
            'Muitas tentativas. Aguarde antes de tentar novamente.',
            'RATE_LIMIT_EXCEEDED'
          );
        }
      }
      next();
    }).catch(next);
  };
}

function ipPolicy(limit, windowMs) {
  return { dimension: 'ip', limit, windowMs, key: requestIp };
}

function emailPolicy(limit, windowMs) {
  return { dimension: 'account', limit, windowMs, key: requestEmail };
}

function userPolicy(limit, windowMs) {
  return { dimension: 'account', limit, windowMs, key: requestUserId };
}

function buildSecurityRateLimiters(secret) {
  return {
    api: createRateLimiter({
      secret,
      scope: 'api-global',
      policies: [ipPolicy(configuredLimit('RATE_LIMIT_API_IP', 600), 5 * MINUTE_MS)],
    }),
    publicRead: createRateLimiter({
      secret,
      scope: 'public-read',
      policies: [ipPolicy(configuredLimit('RATE_LIMIT_PUBLIC_READ_IP', 180), 5 * MINUTE_MS)],
    }),
    register: createRateLimiter({
      secret,
      scope: 'auth-register',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_REGISTER_IP', 10), 60 * MINUTE_MS),
        emailPolicy(configuredLimit('RATE_LIMIT_REGISTER_ACCOUNT', 3), 60 * MINUTE_MS),
      ],
    }),
    login: createRateLimiter({
      secret,
      scope: 'auth-login',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_LOGIN_IP', 30), 15 * MINUTE_MS),
        emailPolicy(configuredLimit('RATE_LIMIT_LOGIN_ACCOUNT', 10), 15 * MINUTE_MS),
      ],
    }),
    verifyEmail: createRateLimiter({
      secret,
      scope: 'auth-verify-email',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_VERIFY_IP', 30), 15 * MINUTE_MS),
        emailPolicy(configuredLimit('RATE_LIMIT_VERIFY_ACCOUNT', 10), 15 * MINUTE_MS),
      ],
    }),
    resendCode: createRateLimiter({
      secret,
      scope: 'auth-resend-code',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_RESEND_IP', 15), 60 * MINUTE_MS),
        emailPolicy(configuredLimit('RATE_LIMIT_RESEND_ACCOUNT', 6), 60 * MINUTE_MS),
      ],
    }),
    tracking: createRateLimiter({
      secret,
      scope: 'order-tracking',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_TRACKING_IP', 60), 15 * MINUTE_MS),
        userPolicy(configuredLimit('RATE_LIMIT_TRACKING_ACCOUNT', 30), 15 * MINUTE_MS),
      ],
    }),
    cart: createRateLimiter({
      secret,
      scope: 'cart-summary',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_CART_IP', 120), 5 * MINUTE_MS),
        userPolicy(configuredLimit('RATE_LIMIT_CART_ACCOUNT', 60), 5 * MINUTE_MS),
      ],
    }),
    checkout: createRateLimiter({
      secret,
      scope: 'checkout-create',
      policies: [
        ipPolicy(configuredLimit('RATE_LIMIT_CHECKOUT_IP', 20), 15 * MINUTE_MS),
        userPolicy(configuredLimit('RATE_LIMIT_CHECKOUT_ACCOUNT', 10), 15 * MINUTE_MS),
      ],
    }),
    academicMutation: createRateLimiter({
      secret,
      scope: 'academic-product-mutation',
      policies: [ipPolicy(configuredLimit('RATE_LIMIT_ACADEMIC_IP', 30), 15 * MINUTE_MS)],
    }),
  };
}

module.exports = {
  buildSecurityRateLimiters,
  createRateLimiter,
  hashIdentifier,
  requestEmail,
  requestIp,
  requestUserId,
};
