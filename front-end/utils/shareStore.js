// shareStore.js
// Data layer for the parent-controlled QR consultation-access feature.
// Persists "shares" (a parent-authorized, time-limited, view-only snapshot of
// selected child records) and an access log of every professional view.
//
// On a single device this resolves shares locally via persistent storage.
// When the Express + PostgreSQL backend is added, only createShare /
// resolveByCode / logAccess need to point at the API instead of storage.

import { storage } from "./storageAdapter";

const SHARES_KEY = "bb_shares";
const LOG_KEY = "bb_access_log";

// Charset excludes ambiguous characters (0/O, 1/I, etc.)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const RECORD_LABELS = {
  profile: "Child Profile & Birth Info",
  vaccinations: "Vaccination History",
  allergies: "Allergies & Hereditary Conditions",
  growth: "Growth Measurements",
  milestones: "Developmental Milestones",
  checkups: "Checkups & Appointments",
  nutrition: "Nutrition & Feeding",
};

function genCode() {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (i === 3) s += "-";
  }
  return s; // e.g. "AB7K-2P9Q"
}

// The string actually encoded into the QR image.
export function qrPayloadForCode(code) {
  return "BABYBOOK+CONSULT:" + code;
}
// U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash, U+2013 en
// dash, U+2014 em dash, U+2015 horizontal bar, U+2212 minus sign, U+FE58
// small em dash, U+FE63 small hyphen-minus, U+FF0D fullwidth hyphen-minus.
// Some keyboards/browsers substitute these for a plain "-" via
// autocorrect/smart-punctuation, which would otherwise make a correctly
// copied code fail the strict [A-Z0-9-] charset below.
const DASH_VARIANTS = /[‐‑‒–—―−﹘﹣－]/g;

// Zero-width and bidi-control characters that can silently ride along in
// copy-pasted text (e.g. copying styled UI text, some mobile keyboards, or
// clipboard managers) without being visible or matching ordinary whitespace
// (\s does not cover them). Built from numeric code points rather than the
// literal characters so nothing invisible/unverifiable is embedded here.
const INVISIBLE_CODEPOINTS = [
  0x200b, 0x200c, 0x200d, // zero-width space / non-joiner / joiner
  0x200e, 0x200f, // left-to-right / right-to-left marks
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // bidi embedding/override marks
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064, // word joiner / invisible operators
  0xfeff, // byte-order mark / zero-width no-break space
];
const INVISIBLE_CHARS = new RegExp(
  "[" + INVISIBLE_CODEPOINTS.map((c) => "\\u" + c.toString(16).padStart(4, "0")).join("") + "]",
  "g"
);

function normalizeCode(text) {
  return String(text)
    .replace(INVISIBLE_CHARS, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(DASH_VARIANTS, "-")
    .toUpperCase();
}

export function codeFromQrPayload(text) {
  if (!text) return null;
  const t = normalizeCode(text);
  const m = t.match(/BABYBOOK\+CONSULT:([A-Z0-9-]+)/i);
  if (m) return m[1].toUpperCase();
  // also accept a bare code typed by the professional
  if (/^[A-Z0-9-]{6,12}$/i.test(t)) return t.toUpperCase();
  return null;
}

async function readJson(key, fallback) {
  try {
    const raw = await storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function writeJson(key, val) {
  try {
    await storage.setItem(key, JSON.stringify(val));
  } catch (e) {
    /* non-fatal */
  }
}

export async function loadShares() {
  return await readJson(SHARES_KEY, []);
}

function isExpired(share) {
  return new Date(share.expiresAt).getTime() <= Date.now();
}

// Mark any active-but-past-expiry shares as expired; persist if changed.
async function sweep(shares) {
  let changed = false;
  for (const s of shares) {
    if (s.status === "active" && isExpired(s)) {
      s.status = "expired";
      changed = true;
    }
  }
  if (changed) await writeJson(SHARES_KEY, shares);
  return shares;
}

export async function createShare({ childId, childName, recordKeys, payload, ttlMinutes }) {
  const shares = await loadShares();
  const now = Date.now();
  const share = {
    id: "shr_" + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    code: genCode(),
    childId,
    childName,
    recordKeys,
    payload, // snapshot of the selected records (view-only)
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (ttlMinutes || 60) * 60000).toISOString(),
    status: "active",
  };
  shares.unshift(share);
  await writeJson(SHARES_KEY, shares);
  return share;
}

export async function listSharesForChild(childId) {
  const shares = await sweep(await loadShares());
  return shares.filter((s) => s.childId === childId);
}

export async function revokeShare(id) {
  const shares = await loadShares();
  const s = shares.find((x) => x.id === id);
  if (s && s.status === "active") {
    s.status = "revoked";
    await writeJson(SHARES_KEY, shares);
  }
  return s;
}

// Resolve a code to a share, applying expiry. Returns { status, share }.
// status: "ok" | "expired" | "revoked" | "notfound"
export async function resolveByCode(code) {
  if (!code) return { status: "notfound", share: null };
  const shares = await sweep(await loadShares());
  const target = code.toUpperCase();
  const share = shares.find((s) => s.code.toUpperCase() === target);
  if (!share) return { status: "notfound", share: null };
  if (share.status === "revoked") return { status: "revoked", share };
  if (share.status === "expired" || isExpired(share)) return { status: "expired", share };
  return { status: "ok", share };
}

export async function logAccess({ code, shareId, childName, professionalName, action }) {
  const log = await readJson(LOG_KEY, []);
  log.unshift({
    id: "log_" + Date.now().toString(36),
    code,
    shareId,
    childName: childName || "",
    professionalName: professionalName || "Unknown",
    action: action || "Viewed records",
    accessDate: new Date().toISOString(),
  });
  await writeJson(LOG_KEY, log);
  return log;
}

export async function loadLog() {
  return await readJson(LOG_KEY, []);
}

export async function logForChild(childName) {
  const log = await loadLog();
  return log.filter((l) => l.childName === childName);
}
