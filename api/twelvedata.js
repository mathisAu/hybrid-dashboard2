import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const PRICE_CACHE_TTL = 30;

function getIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://hybridtrader.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "TwelveData key not configured" });

  // Rate limiting
  const ip = getIp(req);
  try {
    const requests = await redis.incr(`rl:td:${ip}`);
    if (requests === 1) await redis.expire(`rl:td:${ip}`, 60);
    if (requests > 20) return res.status(429).json({ error: "Too many requests" });
  } catch (_) {}

  const { symbol, endpoint } = req.query;
  if (!symbol) return res.status(400).json({ error: "Symbol required" });

  const ep = endpoint || "quote";
  const cacheKey = `price:td:${ep}:${symbol}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.status(200).json(cached);
  } catch (_) {}

  try {
    const url = `https://api.twelvedata.com/${ep}?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await response.json();

    try { await redis.set(cacheKey, data, { ex: PRICE_CACHE_TTL }); } catch (_) {}

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
