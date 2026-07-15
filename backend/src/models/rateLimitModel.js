const database = require('../config/database');

async function consume({ scope, identifierHash, windowMs, limit, nowMs = Date.now() }) {
  const windowKey = Math.floor(nowMs / windowMs);
  const resetAtMs = (windowKey + 1) * windowMs;
  const expiresAt = new Date(resetAtMs + windowMs).toISOString();

  return database.transaction(async (db) => {
    await db.run(
      'DELETE FROM rate_limits WHERE expires_at < ?',
      [new Date(nowMs).toISOString()]
    );
    await db.run(
      `INSERT INTO rate_limits (scope, identifier_hash, window_key, request_count, expires_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(scope, identifier_hash, window_key)
       DO UPDATE SET request_count = rate_limits.request_count + 1, expires_at = excluded.expires_at`,
      [scope, identifierHash, windowKey, expiresAt]
    );
    const row = await db.get(
      `SELECT request_count FROM rate_limits
       WHERE scope = ? AND identifier_hash = ? AND window_key = ?`,
      [scope, identifierHash, windowKey]
    );
    const count = Number(row?.request_count || 0);
    return {
      allowed: count <= limit,
      count,
      limit,
      remaining: Math.max(0, limit - count),
      resetAtMs,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000)),
    };
  });
}

function clearAll() {
  return database.run('DELETE FROM rate_limits');
}

module.exports = { clearAll, consume };
