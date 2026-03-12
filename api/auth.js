// api/auth.js — HybridTrader auth API (Vercel + Redis + bcrypt)
// Dependencies: @upstash/redis, bcryptjs
// npm install @upstash/redis bcryptjs

import { Redis }  from "@upstash/redis";
import bcrypt     from "bcryptjs";

const redis = new Redis({
  url:   process.env.REDIS_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ADMIN_KEY   = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@hybrid.com").toLowerCase();
const USERS_KEY   = "ht:users";
const SALT_ROUNDS = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(res, status, body) { res.status(status).json(body); }
function err(res, msg, status = 400) { json(res, status, { error: msg }); }

async function getAllUsers() {
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

// Never send password hash to client
function safeUser(u) {
  const { passwordHash, password, ...rest } = u;
  return rest;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
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
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await saveUser({
        id:           Date.now().toString(),
        email:        email.toLowerCase(),
        name:         name.trim(),
        passwordHash,
        approved:     false,
        avatar:       null,
        registeredAt: new Date().toISOString(),
      });
      return json(res, 200, { ok: true });
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return err(res, "Vul alle velden in.");

      // Admin — password lives only in Vercel env, never in Redis
      if (email.toLowerCase() === ADMIN_EMAIL) {
        if (password !== ADMIN_KEY) return err(res, "Wachtwoord onjuist.");
        return json(res, 200, {
          session: { email: ADMIN_EMAIL, name: "Admin", role: "admin", approved: true, avatar: null }
        });
      }

      const user = await getUserByEmail(email.toLowerCase());
      if (!user) return err(res, "Geen account gevonden met dit e-mailadres.");

      // Verify — supports hashed (new) and legacy plaintext (auto-upgrades)
      let passwordOk = false;
      if (user.passwordHash) {
        passwordOk = await bcrypt.compare(password, user.passwordHash);
      } else if (user.password) {
        passwordOk = user.password === password;
        if (passwordOk) {
          // Upgrade plaintext to hash on first login
          const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
          await saveUser({ ...user, passwordHash, password: undefined });
        }
      }

      if (!passwordOk) return err(res, "Wachtwoord onjuist.");
      return json(res, 200, {
        session: { email: user.email, name: user.name, role: "user", approved: user.approved, avatar: user.avatar || null }
      });
    }

    // ── LIST USERS (admin only) ───────────────────────────────────────────────
    if (action === "listUsers") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      return json(res, 200, { users: users.map(safeUser) });
    }

    // ── APPROVE USER ──────────────────────────────────────────────────────────
    if (action === "approveUser") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      const user  = users.find(u => u.id === body.id);
      if (!user) return err(res, "Gebruiker niet gevonden.");
      await saveUser({ ...user, approved: true });
      return json(res, 200, { ok: true });
    }

    // ── DENY USER ─────────────────────────────────────────────────────────────
    if (action === "denyUser") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      const user  = users.find(u => u.id === body.id);
      if (!user) return err(res, "Gebruiker niet gevonden.");
      await saveUser({ ...user, approved: false });
      return json(res, 200, { ok: true });
    }

    // ── DELETE USER ───────────────────────────────────────────────────────────
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
      await saveUser({ ...user, name: name?.trim() || user.name, avatar: avatar ?? user.avatar });
      return json(res, 200, { ok: true });
    }

    // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
    if (action === "changePassword") {
      const { email, oldPassword, newPassword } = body;
      if (!newPassword || newPassword.length < 6) return err(res, "Nieuw wachtwoord te kort.");
      const user = await getUserByEmail(email?.toLowerCase());
      if (!user) return err(res, "Gebruiker niet gevonden.");
      let oldOk = false;
      if (user.passwordHash) {
        oldOk = await bcrypt.compare(oldPassword, user.passwordHash);
      } else if (user.password) {
        oldOk = user.password === oldPassword;
      }
      if (!oldOk) return err(res, "Huidig wachtwoord onjuist.");
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await saveUser({ ...user, passwordHash, password: undefined });
      return json(res, 200, { ok: true });
    }

    return err(res, "Onbekende actie.");

  } catch (e) {
    console.error("[auth]", e);
    return err(res, "Serverfout. Probeer opnieuw.", 500);
  }
}
