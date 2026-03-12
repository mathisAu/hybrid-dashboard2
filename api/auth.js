// api/auth.js — HybridTrader auth API (Vercel + Redis)
// Uses @upstash/redis. In Vercel: add REDIS_URL and REDIS_TOKEN env vars.
//
// Actions (all POST /api/auth with JSON body):
//   register        { email, name, password }
//   login           { email, password }
//   listUsers       { adminKey }           ← admin only
//   approveUser     { id, adminKey }       ← admin only
//   denyUser        { id, adminKey }       ← admin only
//   deleteUser      { id, adminKey }       ← admin only
//   updateProfile   { email, name, avatar }
//   changePassword  { email, oldPassword, newPassword }

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

const ADMIN_KEY  = process.env.ADMIN_PASSWORD || "admin123"; // match frontend
const USERS_KEY  = "ht:users";   // Redis hash: userId → JSON string

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(res, status, body) {
  res.status(status).json(body);
}

function err(res, msg, status = 400) {
  json(res, status, { error: msg });
}

async function getAllUsers() {
  // hgetall returns { id: jsonString, ... } or null
  const raw = await redis.hgetall(USERS_KEY);
  if (!raw) return [];
  return Object.values(raw).map(v => (typeof v === "string" ? JSON.parse(v) : v));
}

async function saveUser(user) {
  await redis.hset(USERS_KEY, { [user.id]: JSON.stringify(user) });
}

async function getUserByEmail(email) {
  const users = await getAllUsers();
  return users.find(u => u.email === email) || null;
}

// Strip password before sending to client
function safeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return err(res, "Method not allowed", 405);

  const { action, ...body } = req.body || {};

  try {
    // ── REGISTER ──────────────────────────────────────────────────────────────
    if (action === "register") {
      const { email, name, password } = body;
      if (!email || !name || !password) return err(res, "Vul alle velden in.");
      if (password.length < 6) return err(res, "Wachtwoord moet minimaal 6 tekens zijn.");
      const existing = await getUserByEmail(email.toLowerCase());
      if (existing) return err(res, "Dit e-mailadres is al in gebruik.");
      const user = {
        id:           Date.now().toString(),
        email:        email.toLowerCase(),
        name:         name.trim(),
        password,                         // plaintext — fine for this use case
        approved:     false,
        avatar:       null,
        registeredAt: new Date().toISOString(),
      };
      await saveUser(user);
      return json(res, 200, { ok: true });
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return err(res, "Vul alle velden in.");
      const user = await getUserByEmail(email.toLowerCase());
      if (!user) return err(res, "Geen account gevonden met dit e-mailadres.");
      if (user.password !== password) return err(res, "Wachtwoord onjuist.");
      const session = {
        email:    user.email,
        name:     user.name,
        role:     "user",
        approved: user.approved,
        avatar:   user.avatar || null,
      };
      return json(res, 200, { session });
    }

    // ── LIST USERS (admin only) ───────────────────────────────────────────────
    if (action === "listUsers") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      return json(res, 200, { users: users.map(safeUser) });
    }

    // ── APPROVE USER (admin only) ─────────────────────────────────────────────
    if (action === "approveUser") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      const user  = users.find(u => u.id === body.id);
      if (!user) return err(res, "Gebruiker niet gevonden.");
      await saveUser({ ...user, approved: true });
      return json(res, 200, { ok: true });
    }

    // ── DENY USER (admin only) ────────────────────────────────────────────────
    if (action === "denyUser") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      const user  = users.find(u => u.id === body.id);
      if (!user) return err(res, "Gebruiker niet gevonden.");
      await saveUser({ ...user, approved: false });
      return json(res, 200, { ok: true });
    }

    // ── DELETE USER (admin only) ──────────────────────────────────────────────
    if (action === "deleteUser") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      await redis.hdel(USERS_KEY, body.id);
      return json(res, 200, { ok: true });
    }

    // ── UPDATE PROFILE ────────────────────────────────────────────────────────
    if (action === "updateProfile") {
      const { email, name, avatar } = body;
      const user = await getUserByEmail(email?.toLowerCase());
      if (!user) return err(res, "Gebruiker niet gevonden.");
      await saveUser({ ...user, name: name?.trim() || user.name, avatar: avatar || user.avatar });
      return json(res, 200, { ok: true });
    }

    // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
    if (action === "changePassword") {
      const { email, oldPassword, newPassword } = body;
      if (!newPassword || newPassword.length < 6) return err(res, "Nieuw wachtwoord te kort.");
      const user = await getUserByEmail(email?.toLowerCase());
      if (!user) return err(res, "Gebruiker niet gevonden.");
      if (user.password !== oldPassword) return err(res, "Huidig wachtwoord onjuist.");
      await saveUser({ ...user, password: newPassword });
      return json(res, 200, { ok: true });
    }

    return err(res, "Onbekende actie.");

  } catch (e) {
    console.error("[auth]", e);
    return err(res, "Serverfout. Probeer opnieuw.", 500);
  }
}
