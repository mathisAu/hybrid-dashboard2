// api/auth.js — HybridTrader auth API (Vercel + Redis + bcrypt + Resend email)
// Dependencies: @upstash/redis, bcryptjs
// Env vars: REDIS_URL, REDIS_TOKEN (or KV_REST_API_TOKEN), ADMIN_PASSWORD,
//           ADMIN_EMAIL, RESEND_API_KEY, SITE_URL

import { Redis } from "@upstash/redis";
import bcrypt    from "bcryptjs";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN,
});

const ADMIN_KEY    = process.env.ADMIN_PASSWORD     || "admin123";
const ADMIN_EMAIL  = (process.env.ADMIN_EMAIL  || "admin@hybrid.com").toLowerCase();
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "change-this-in-vercel";

// ── HMAC-SHA256 token signing (Web Crypto — available in Vercel Edge + Node) ─
async function signAdminToken(payload) {
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey(
    "raw", enc.encode(ADMIN_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Buffer.from(sig).toString("hex");
}

async function makeAdminToken() {
  const ts      = Date.now();
  const payload = `admin:${ts}`;
  const sig     = await signAdminToken(payload);
  return `${payload}:${sig}`;
}

async function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [prefix, ts, sig] = parts;
  if (prefix !== "admin") return false;
  // Token geldig voor max 12 uur
  if (Date.now() - parseInt(ts) > 12 * 60 * 60 * 1000) return false;
  const payload  = `admin:${ts}`;
  const expected = await signAdminToken(payload);
  return expected === sig;
}
const SITE_URL    = process.env.SITE_URL        || "https://hybrid-dashboard2.vercel.app";
const USERS_KEY   = "ht:users";
const SALT_ROUNDS = 10;

// ── Email helper (Resend) ─────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[email] RESEND_API_KEY not set — skipping email"); return; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: "HybridTrader <noreply@hybriddashboard.com>",
        to,
        subject,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) console.error("[email] Resend error:", data);
  } catch (e) {
    console.error("[email] Failed to send:", e);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
function emailBase(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>HybridTrader</title>
</head>
<body style="margin:0;padding:0;background:#060608;font-family:'Helvetica Neue',Arial,sans-serif;" bgcolor="#060608">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#060608" style="background:#060608;min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px;" bgcolor="#060608">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="padding-bottom:28px;text-align:center;">
          <table cellpadding="0" cellspacing="0" align="center"><tr>
          <td bgcolor="#111420" style="background:linear-gradient(160deg,#111420,#0d1016);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:16px 28px;">
            <span style="font-size:22px;font-weight:800;color:#f1f2f4;letter-spacing:-0.02em;">Hybrid<span style="color:#089981;">Trader</span></span>
            <div style="font-size:8px;color:#6b7280;letter-spacing:0.18em;font-family:'Courier New',monospace;margin-top:4px;">INSTITUTIONAL TRADING DASHBOARD</div>
          </td></tr></table>
        </td>
      </tr>

      <!-- Card -->
      <tr>
        <td bgcolor="#111420" style="background:linear-gradient(160deg,#111420,#0c0d12);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:36px 40px;">
          ${content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding-top:24px;text-align:center;" bgcolor="#060608">
          <p style="font-size:10px;color:#4b5563;letter-spacing:0.08em;margin:0;font-family:'Courier New',monospace;">
            HYBRIDTRADER · INSTITUTIONAL FLOW EDITION<br/>
            <span style="color:#374151;">This email was sent automatically. Do not reply.</span>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function emailWelcome(name) {
  return emailBase(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:12px;">⏳</div>
      <h1 style="font-size:22px;font-weight:800;color:#f1f2f4;margin:0 0 8px;letter-spacing:-0.01em;">Account Created</h1>
      <p style="font-size:14px;color:#9ca3af;margin:0;">Your registration was received successfully.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td bgcolor="#0d1a17" style="background:rgba(8,153,129,0.08);border:1px solid rgba(8,153,129,0.20);border-radius:10px;padding:20px 24px;">
        <p style="font-size:14px;color:#e2e4e9;margin:0 0 6px;">Hi <strong style="color:#089981;">${name}</strong>,</p>
        <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.7;">
          Your HybridTrader account has been created and is <strong style="color:#f59e0b;">pending approval</strong>.
          The administrator will review your request shortly.
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="font-size:10px;color:#6b7280;letter-spacing:0.1em;font-family:'Courier New',monospace;">STATUS</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.30);color:#f59e0b;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.06em;">PENDING APPROVAL</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <span style="font-size:10px;color:#6b7280;letter-spacing:0.1em;font-family:'Courier New',monospace;">ACCOUNT</span>
        </td>
        <td align="right" style="padding:12px 0;">
          <span style="font-size:12px;color:#9ca3af;font-family:'Courier New',monospace;">${name}</span>
        </td>
      </tr>
    </table>

    <p style="font-size:12px;color:#6b7280;text-align:center;margin:0;line-height:1.6;">
      Once approved, you'll receive a confirmation email and can log in at<br/>
      <a href="${SITE_URL}" style="color:#089981;text-decoration:none;">${SITE_URL}</a>
    </p>
  `);
}

function emailApproved(name) {
  return emailBase(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:12px;">✅</div>
      <h1 style="font-size:22px;font-weight:800;color:#f1f2f4;margin:0 0 8px;letter-spacing:-0.01em;">Access Granted</h1>
      <p style="font-size:14px;color:#9ca3af;margin:0;">Your account has been approved.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td bgcolor="#0d1a13" style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.20);border-radius:10px;padding:20px 24px;">
        <p style="font-size:14px;color:#e2e4e9;margin:0 0 6px;">Hi <strong style="color:#22c55e;">${name}</strong>,</p>
        <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.7;">
          Great news — your HybridTrader account has been <strong style="color:#22c55e;">approved</strong>.
          You now have full access to the dashboard.
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="font-size:10px;color:#6b7280;letter-spacing:0.1em;font-family:'Courier New',monospace;">STATUS</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.30);color:#22c55e;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.06em;">APPROVED</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <span style="font-size:10px;color:#6b7280;letter-spacing:0.1em;font-family:'Courier New',monospace;">ACCESS</span>
        </td>
        <td align="right" style="padding:12px 0;">
          <span style="font-size:11px;color:#22c55e;font-family:'Courier New',monospace;">FULL DASHBOARD</span>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${SITE_URL}" style="display:inline-block;background:#089981;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.08em;padding:14px 36px;border-radius:100px;text-decoration:none;">
            OPEN DASHBOARD →
          </a>
        </td>
      </tr>
    </table>
  `);
}

function emailDenied(name) {
  return emailBase(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:12px;">🚫</div>
      <h1 style="font-size:22px;font-weight:800;color:#f1f2f4;margin:0 0 8px;letter-spacing:-0.01em;">Access Declined</h1>
      <p style="font-size:14px;color:#9ca3af;margin:0;">Your account request was not approved.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td bgcolor="#1a0d0d" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.20);border-radius:10px;padding:20px 24px;">
        <p style="font-size:14px;color:#e2e4e9;margin:0 0 6px;">Hi <strong style="color:#f87171;">${name}</strong>,</p>
        <p style="font-size:13px;color:#9ca3af;margin:0;line-height:1.7;">
          Unfortunately, your HybridTrader account request has been <strong style="color:#f87171;">declined</strong> by the administrator.
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px 0;">
          <span style="font-size:10px;color:#6b7280;letter-spacing:0.1em;font-family:'Courier New',monospace;">STATUS</span>
        </td>
        <td align="right" style="padding:12px 0;">
          <span style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.30);color:#f87171;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.06em;">ACCESS REVOKED</span>
        </td>
      </tr>
    </table>

    <p style="font-size:12px;color:#6b7280;text-align:center;margin:0;line-height:1.7;">
      If you believe this is a mistake, please contact the administrator directly.
    </p>
  `);
}

// ── Redis helpers ─────────────────────────────────────────────────────────────
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
        id: Date.now().toString(),
        email: email.toLowerCase(),
        name: name.trim(),
        passwordHash,
        approved: false,
        avatar: null,
        registeredAt: new Date().toISOString(),
      });
      // Send welcome email (non-blocking)
      sendEmail({
        to: email.toLowerCase(),
        subject: "HybridTrader — Account Created, Pending Approval",
        html: emailWelcome(name.trim()),
      });
      return json(res, 200, { ok: true });
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return err(res, "Vul alle velden in.");
      if (email.toLowerCase() === ADMIN_EMAIL) {
        if (password !== ADMIN_KEY) return err(res, "Wachtwoord onjuist.");
        const adminToken = await makeAdminToken();
        return json(res, 200, {
          session: { email: ADMIN_EMAIL, name: "Admin", role: "admin", approved: true, avatar: null, adminToken }
        });
      }
      const user = await getUserByEmail(email.toLowerCase());
      if (!user) return err(res, "Geen account gevonden met dit e-mailadres.");
      let passwordOk = false;
      if (user.passwordHash) {
        passwordOk = await bcrypt.compare(password, user.passwordHash);
      } else if (user.password) {
        passwordOk = user.password === password;
        if (passwordOk) {
          const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
          await saveUser({ ...user, passwordHash, password: undefined });
        }
      }
      if (!passwordOk) return err(res, "Wachtwoord onjuist.");
      return json(res, 200, {
        session: { id: user.id, email: user.email, name: user.name, role: "user", approved: user.approved, avatar: user.avatar || null }
      });
    }

    // ── LIST USERS ────────────────────────────────────────────────────────────
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
      // Send approval email
      sendEmail({
        to: user.email,
        subject: "HybridTrader — Access Granted ✅",
        html: emailApproved(user.name),
      });
      return json(res, 200, { ok: true });
    }

    // ── DENY USER ─────────────────────────────────────────────────────────────
    if (action === "denyUser") {
      if (body.adminKey !== ADMIN_KEY) return err(res, "Unauthorized", 403);
      const users = await getAllUsers();
      const user  = users.find(u => u.id === body.id);
      if (!user) return err(res, "Gebruiker niet gevonden.");
      await saveUser({ ...user, approved: false });
      // Send denial email
      sendEmail({
        to: user.email,
        subject: "HybridTrader — Access Declined",
        html: emailDenied(user.name),
      });
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

export { verifyAdminToken };
