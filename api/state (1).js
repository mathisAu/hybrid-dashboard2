import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const STATE_KEY = "dashboard:shared:state";
const STATE_TTL = 12 * 60 * 60; // 12 uur

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET — laad gedeelde staat
  if (req.method === "GET") {
    try {
      const state = await redis.get(STATE_KEY);
      if (!state) return res.status(404).json({ error: "Geen opgeslagen staat" });
      return res.status(200).json(state);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — sla gedeelde staat op
  if (req.method === "POST") {
    try {
      const body = req.body;
      if (!body) return res.status(400).json({ error: "Geen data" });
      await redis.set(STATE_KEY, { ...body, _savedAt: new Date().toISOString() }, { ex: STATE_TTL });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
