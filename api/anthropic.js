import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

// ── Admin token verificatie (zelfde logica als auth.js) ──────────────────────
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "change-this-in-vercel";

async function signAdminToken(payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(ADMIN_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Buffer.from(sig).toString("hex");
}

async function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [prefix, ts, sig] = parts;
  if (prefix !== "admin") return false;
  if (Date.now() - parseInt(ts) > 12 * 60 * 60 * 1000) return false;
  const expected = await signAdminToken(`admin:${ts}`);
  return expected === sig;
}
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
  const allowedOrigins = [
    "https://hybridtrader.vercel.app",
    "https://hybrid-dashboard2.vercel.app",
    "https://hybriddashboard.com",
    "https://www.hybriddashboard.com",
  ];
  const origin = req.headers.origin || "";
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  // ── Sessie-check ──────────────────────────────────────────────────────────
  const sessionUserId  = req.body?._sessionUserId;
  const sessionToken   = req.body?._adminToken;
  const sessionEmail   = req.body?._sessionEmail;
  const ADMIN_EMAIL_SV = (process.env.ADMIN_EMAIL || "").toLowerCase();
  let authorized = false;

  if (sessionToken) {
    // Beste pad: gesigneerd HMAC token (nieuwe sessies na deploy)
    authorized = await verifyAdminToken(sessionToken);
    if (!authorized) return res.status(401).json({ error: "Ongeldig admin token" });
  } else if (sessionUserId) {
    // Gewone user: Redis check
    try {
      const userRaw = await redis.hget("ht:users", sessionUserId);
      const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
      if (user && user.approved) authorized = true;
    } catch (_) {}
    if (!authorized) return res.status(403).json({ error: "Geen toegang" });
  } else if (sessionEmail && ADMIN_EMAIL_SV && sessionEmail.toLowerCase() === ADMIN_EMAIL_SV) {
    // Fallback: admin herkend via email (oude sessies zonder adminToken)
    // Veilig omdat ADMIN_EMAIL alleen server-side bekend is
    authorized = true;
  } else {
    return res.status(401).json({ error: "Niet ingelogd" });
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
    const { _cacheKey: _ck, _sessionUserId: _su, _sessionRole: _sr, _sessionApproved: _sa, _adminToken: _at, _sessionEmail: _se, ...anthropicBody } = body;
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
