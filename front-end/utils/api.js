// Central API client for the BabyBook+ backend.
import { Platform } from "react-native";
import { storage } from "./storageAdapter";

// ---------------------------------------------------------------------------
// IMPORTANT: where is the backend?
//  - Local dev (Web / iOS simulator / Android emulator on the same machine):
//    localhost works, and is the default below.
//  - Local dev on a REAL PHONE (Expo Go): "localhost" means the phone itself,
//    NOT your computer. Set EXPO_PUBLIC_API_BASE_URL in front-end/.env to
//    your computer's LAN IP, e.g. "http://192.168.1.20:4000".
//    Find it with `ipconfig` (Windows) / `ifconfig` (Mac).
//  - Production builds (EAS): EXPO_PUBLIC_API_BASE_URL is baked in at build
//    time from eas.json's per-profile "env", so point it at your deployed
//    Render/Railway URL there instead of editing this file.
// Any EXPO_PUBLIC_-prefixed variable is inlined into the JS bundle by Expo
// at build time — see https://docs.expo.dev/guides/environment-variables/
// ---------------------------------------------------------------------------
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";

const TOKEN_KEY = "bb_token";
let cachedToken = null;

export async function getToken() {
    if (cachedToken) return cachedToken;
    cachedToken = await storage.getItem(TOKEN_KEY);
    return cachedToken;
}
export async function setToken(token) {
    cachedToken = token || null;
    if (token) await storage.setItem(TOKEN_KEY, token);
    else await storage.removeItem(TOKEN_KEY);
}
export async function clearToken() {
    await setToken(null);
}

export class ApiError extends Error {
    constructor(status, message, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

async function request(method, path, body, opts = {}) {
    const { auth = true, isForm = false } = opts;
    const headers = {};
    let payload;

    if (isForm) {
        payload = body; // FormData — let fetch set the multipart boundary
    } else if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
    }

    if (auth) {
        const token = await getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
    } catch (e) {
        throw new ApiError(0, "Network error — is the backend running and reachable?");
    }

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        data = text;
    }

    if (!res.ok) {
        const message = (data && data.error) || `Request failed (${res.status})`;
        throw new ApiError(res.status, message, data);
    }
    return data;
}

// Maps a Blob's reported MIME type to a file extension the backend's
// upload whitelist recognizes (see back-end/src/middleware/upload.js).
const MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
};

// Attach a picked photo (device URI) to a FormData under `field`.
// On native, RN's fetch/FormData polyfill understands the {uri, name, type}
// shape and streams the file straight from disk, and the uri is a real
// file:// path we can pull a filename/extension from.
//
// On web (Expo web / react-native-web), two things differ:
//  1. FormData is the browser's real implementation, which requires an
//     actual Blob/File — passing the {uri, name, type} object silently
//     produces an empty/invalid part, so the server sees no file at all.
//  2. expo-image-picker's web `uri` is a `blob:` URL (or `data:` URI on
//     older SDKs), not a filename — it has no ".jpg"/".png" to parse out.
//     Deriving the extension from that string previously produced names
//     like "3fa85f64-5717-..." with no extension, which the backend's
//     extension whitelist then rejected as "Unsupported image type".
// So on web we fetch() the blob and derive the extension from its actual
// MIME type (blob.type) instead of the URI.
async function appendPhoto(form, field, photoUri, fallbackName) {
    if (Platform.OS === "web") {
        const res = await fetch(photoUri);
        const blob = await res.blob();
        const ext = MIME_TO_EXT[blob.type] || (fallbackName.split(".").pop() || "jpg").toLowerCase();
        form.append(field, blob, `photo.${ext}`);
    } else {
        const name = (photoUri || "").split("/").pop().split("?")[0] || fallbackName;
        const ext = (name.split(".").pop() || "jpg").toLowerCase();
        const type = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
        form.append(field, { uri: photoUri, name, type });
    }
}

export const api = {
    // --- auth ---
    register: (b) => request("POST", "/api/auth/register", b, { auth: false }),
    login: (b) => request("POST", "/api/auth/login", b, { auth: false }),
    me: () => request("GET", "/api/auth/me"),
    updateMe: (b) => request("PUT", "/api/auth/me", b),
    renewConsent: () => request("POST", "/api/auth/consent/renew"),
    changePassword: (b) => request("POST", "/api/auth/change-password", b),
    deleteAccount: () => request("DELETE", "/api/auth/me"),
    forgotPassword: (b) => request("POST", "/api/auth/forgot-password", b, { auth: false }),
    resetPassword: (b) => request("POST", "/api/auth/reset-password", b, { auth: false }),

    // --- children ---
    listChildren: () => request("GET", "/api/children"),
    createChild: (b) => request("POST", "/api/children", b),
    generateEpiSchedule: (childId, mode) =>
        request("POST", `/api/children/${childId}/vaccinations/generate-schedule`, mode ? { mode } : {}),
    updateChild: (id, b) => request("PUT", `/api/children/${id}`, b),
    deleteChild: (id) => request("DELETE", `/api/children/${id}`),

    // Set the baby's profile picture from a device photo (multipart upload).
    // Returns the updated child row (with the served avatar_url).
    uploadChildAvatar: async (childId, photoUri) => {
        const form = new FormData();
        await appendPhoto(form, "photo", photoUri, "avatar.jpg");
        return request("POST", `/api/children/${childId}/avatar`, form, { isForm: true });
    },

    // --- record attachments (mandatory supporting photo per health record) ---
    listAttachments: (childId) => request("GET", `/api/children/${childId}/attachments`),
    uploadAttachment: async (childId, { recordType, recordId, photoUri, fileUrl }) => {
        const form = new FormData();
        form.append("record_type", recordType);
        form.append("record_id", String(recordId));
        if (photoUri) await appendPhoto(form, "photo", photoUri, "doc.jpg");
        else if (fileUrl) form.append("file_url", fileUrl);
        return request("POST", `/api/children/${childId}/attachments`, form, { isForm: true });
    },
    deleteAttachment: (childId, id) => request("DELETE", `/api/children/${childId}/attachments/${id}`),

    // --- generic child records (vaccinations, growth, milestones, etc.) ---
    listRecords: (childId, resource) => request("GET", `/api/children/${childId}/${resource}`),
    createRecord: (childId, resource, b) => request("POST", `/api/children/${childId}/${resource}`, b),
    updateRecord: (childId, resource, id, b) => request("PUT", `/api/children/${childId}/${resource}/${id}`, b),
    deleteRecord: (childId, resource, id) => request("DELETE", `/api/children/${childId}/${resource}/${id}`),

    // --- memories with a device photo (multipart upload) ---
    uploadMemory: async (childId, { photoUri, caption, notes, date_recorded }) => {
        const form = new FormData();
        if (photoUri) {
            await appendPhoto(form, "photo", photoUri, "photo.jpg");
        }
        if (caption) form.append("caption", caption);
        if (notes) form.append("notes", notes);
        if (date_recorded) form.append("date_recorded", date_recorded);
        return request("POST", `/api/children/${childId}/memories`, form, { isForm: true });
    },

    // --- QR consultation shares (parent) ---
    createShare: (childId, b) => request("POST", `/api/children/${childId}/shares`, b),
    listShares: (childId) => request("GET", `/api/children/${childId}/shares`),
    revokeShare: (childId, id) => request("POST", `/api/children/${childId}/shares/${id}/revoke`),
    accessLog: (childId) => request("GET", `/api/children/${childId}/access-log`),
    unseenAccessLog: (childId) => request("GET", `/api/children/${childId}/access-log/unseen`),
    markAccessLogSeen: (childId) => request("POST", `/api/children/${childId}/access-log/mark-seen`),

    // --- QR consultation (healthcare professional, public) ---
    resolveConsult: (b) => request("POST", "/api/consult/resolve", b, { auth: false }),
};
