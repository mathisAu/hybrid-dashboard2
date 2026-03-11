import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const PRICE_CACHE_TTL = 30; // 30 seconden voor live prijzen

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://hybridtrader.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Finnhub key not configured" });

  // Rate limiting
  const ip = getIp(req);
  try {
    const requests = await redis.incr(`rl:fh:${ip}`);
    if (requests === 1) await redis.expire(`rl:fh:${ip}`, 60);
    if (requests > 60) return res.status(429).json({ error: "Too many requests" });
  } catch (_) {}

  const { symbol, type, category } = req.query;

  // News endpoint
  if (type === "news") {
    const newsCacheKey = `news:fh:${category||"general"}`;
    try {
      const cached = await redis.get(newsCacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (_) {}
    try {
      const r = await fetch(`https://finnhub.io/api/v1/news?category=${category||"general"}&minId=0&token=${apiKey}`, {signal:AbortSignal.timeout(5000)});
      const d = await r.json();
      try { await redis.set(newsCacheKey, d, { ex: 120 }); } catch (_) {}
      return res.status(200).json(d);
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (!symbol) return res.status(400).json({ error: "Symbol required" });

  // Cache check
  const cacheKey = `price:fh:${symbol}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.status(200).json(cached);
  } catch (_) {}

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();

    try { await redis.set(cacheKey, data, { ex: PRICE_CACHE_TTL }); } catch (_) {}

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
