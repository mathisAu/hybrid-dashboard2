import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX    = 5;
const CACHE_TTL         = 30 * 60;

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown"
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://hybridtrader.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  // ── Sessie-check ──────────────────────────────────────────────────────────
  const sessionUserId = req.body?._sessionUserId;
  if (!sessionUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const userRaw = await redis.hget("ht:users", sessionUserId);
    const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
    if (!user || !user.approved) {
      return res.status(403).json({ error: "Access denied" });
    }
  } catch (_) {
    return res.status(401).json({ error: "Session check failed" });
  }

  // ── Rate limiting per IP ──────────────────────────────────────────────────
  const ip = getIp(req);
  const rateLimitKey = `rl:${ip}`;
  try {
    const requests = await redis.incr(rateLimitKey);
    if (requests === 1) await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);
    if (requests > RATE_LIMIT_MAX) {
      return res.status(429).json({ error: "Too many requests. Try again in a minute." });
    }
  } catch (_) {}

  // ── Cache check ───────────────────────────────────────────────────────────
  const body = req.body;
  const cacheKey = body?._cacheKey;
  if (cacheKey) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json({ ...cached, _fromCache: true, _cachedAt: cached._cachedAt });
      }
    } catch (_) {}
  }

  // ── Anthropic API call ────────────────────────────────────────────────────
  try {
    const { _cacheKey: _ck, _sessionUserId: _su, ...anthropicBody } = body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    if (cacheKey) {
      try {
        await redis.set(cacheKey, { ...data, _cachedAt: new Date().toISOString() }, { ex: CACHE_TTL });
      } catch (_) {}
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
