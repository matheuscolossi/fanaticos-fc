const API_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const DOCS_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
].join('; ');

const HSTS = 'max-age=31536000; includeSubDomains';

function buildHttpSecurityHeaders({ production = process.env.NODE_ENV === 'production' } = {}) {
  return function httpSecurityHeaders(req, res, next) {
    res.set({
      'Content-Security-Policy': req.path.startsWith('/docs') ? DOCS_CSP : API_CSP,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'X-XSS-Protection': '0',
    });
    if (production || req.secure) res.set('Strict-Transport-Security', HSTS);
    next();
  };
}

module.exports = { API_CSP, DOCS_CSP, HSTS, buildHttpSecurityHeaders };
