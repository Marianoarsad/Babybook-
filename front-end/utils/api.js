// Central API client for the BabyBook+ backend.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { storage } from "./storageAdapter";
import { trackApiActivity } from "./apiActivity.cjs";
import recordStore from "./recordStore.cjs";
export { getApiActivitySnapshot, subscribeApiActivity } from "./apiActivity.cjs";

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
    const sessionEpoch = recordStore.getEpoch();
    if (Platform.OS === "web") {
        const token = await storage.getItem(TOKEN_KEY);
        if (sessionEpoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
        cachedToken = token;
        return cachedToken;
    }
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (sessionEpoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
    cachedToken = token;
    // One-time migration from the old AsyncStorage location.
    if (!cachedToken) {
        const legacy = await AsyncStorage.getItem(TOKEN_KEY);
        if (sessionEpoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
        if (legacy) {
            await SecureStore.setItemAsync(TOKEN_KEY, legacy);
            await AsyncStorage.removeItem(TOKEN_KEY);
            if (sessionEpoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
            cachedToken = legacy;
        }
    }
    return cachedToken;
}
export async function setToken(token) {
    if ((token || null) !== cachedToken) recordStore.reset();
    cachedToken = token || null;
    if (Platform.OS === "web") {
        if (token) await storage.setItem(TOKEN_KEY, token);
        else await storage.removeItem(TOKEN_KEY);
        return;
    }
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
}
export async function clearToken() {
    recordStore.reset();
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
    if (opts.auth !== false) opts = { ...opts, sessionEpoch: opts.sessionEpoch ?? recordStore.getEpoch() };
    return trackApiActivity(async () => {
    const { auth = true, isForm = false } = opts;
    const headers = {};
    if (opts.operationKey) headers["X-Operation-Key"] = opts.operationKey;
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
    if (opts.sessionEpoch !== undefined && opts.sessionEpoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");

    let res;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
    } catch (e) {
        throw new ApiError(0, "Network error — is the backend running and reachable?");
    }

    let text;
    try { text = await res.text(); }
    catch (e) { throw new ApiError(0, "Response was interrupted. Check whether the change was saved."); }
    if (opts.sessionEpoch !== undefined && opts.sessionEpoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
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
    }, opts.background || opts.loading === "nonblocking");
}

const resourcePath = (child, resource) => `/api/children/${child}/${resource}`;
export const ACCOUNT_SCOPE = "__account__";
export const ACCOUNT_RESOURCE = "account";
function seedAccount(user, sessionEpoch = recordStore.getEpoch()) {
    if (!user || sessionEpoch !== recordStore.getEpoch()) return;
    recordStore.acceptFetch(ACCOUNT_SCOPE, ACCOUNT_RESOURCE, [user], recordStore.version(ACCOUNT_SCOPE, ACCOUNT_RESOURCE));
}
async function readList(child, resource, path, opts = {}) {
    const stamp = recordStore.startFetch(child, resource);
    const rows = await request("GET", path, undefined, { ...opts, sessionEpoch: stamp.epoch });
    if (!Array.isArray(rows)) throw new ApiError(0, "Could not load records. Please retry.");
    const displayed = recordStore.acceptFetch(child, resource, rows, stamp);
    return opts.confirmedOnly ? rows : displayed;
}
async function writeAccount(method, path, body) {
    const epoch = recordStore.getEpoch();
    const result = await request(method, path, body, { sessionEpoch: epoch });
    if (!result?.user) throw new ApiError(0, "Could not confirm account details. Please retry.");
    seedAccount(result.user, epoch);
    return result;
}
const uncertain = (error) => !error.status || error.status >= 500;
async function writeRecord(child, resource, id, body, opts = {}, deleting = false) {
    const sessionEpoch = opts.sessionEpoch ?? recordStore.getEpoch();
    if (!opts.optimistic && id != null && recordStore.isLocked(child, resource, id)) throw new ApiError(409, "This record has a pending change.");
    const saved = await request(deleting ? "DELETE" : id == null ? "POST" : "PUT",
        resourcePath(child, resource) + (id == null ? "" : `/${id}`), body, { ...opts, sessionEpoch });
    if (!deleting && !saved?.id) throw new ApiError(0, "Could not confirm the saved record. Check before retrying.");
    if (!opts.optimistic) recordStore.confirm(child, resource, saved, id, deleting, sessionEpoch);
    if (deleting && resource === "medical-history" && sessionEpoch === recordStore.getEpoch()) recordStore.removeMedicationDoses(child, id);
    return saved;
}
const OPTIMISTIC = { milestones: ["create", "update"], "calendar-plan-statuses": ["create", "update"],
    "medication-doses": ["create", "delete"], growth: ["delete"], nutrition: ["delete"], "calendar-events": ["delete"] };
async function runOperation(op) {
    if (op.epoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
    if (!recordStore.getOperations().some((item) => item.key === op.key)) throw new Error("This change is no longer pending.");
    recordStore.update(op, { status: "saving", message: "" });
    try {
        const saved = await writeRecord(op.child, op.resource, op.type === "create" ? null : op.id,
            op.type === "delete" ? undefined : op.body,
            { loading: "nonblocking", optimistic: true, operationKey: op.type === "create" ? op.key : undefined, sessionEpoch: op.epoch }, op.type === "delete");
        recordStore.finish(op, saved);
        return saved;
    } catch (error) {
        if (op.epoch === recordStore.getEpoch() && op.type === "create") {
            const confirmed = recordStore.getConfirmed(op.child, op.resource).find((row) => row._operation_key === op.key);
            if (confirmed) { recordStore.finish(op, confirmed); return confirmed; }
        }
        if (op.type === "delete" && error.status === 404 && error.message === "Record not found") {
            recordStore.finish(op); return;
        }
        recordStore.update(op, { status: uncertain(error) ? "uncertain" : "failed", message: error.message });
        throw error;
    }
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
    socialAuth: (b) => request("POST", "/api/auth/social", b, { auth: false }),
    socialRegister: (b) => request("POST", "/api/auth/social/register", b, { auth: false }),
    socialLink: (b) => request("POST", "/api/auth/social/link", b, { auth: false }),
    seedAccount,
    me: async (opts = {}) => {
        const stamp = recordStore.startFetch(ACCOUNT_SCOPE, ACCOUNT_RESOURCE);
        const result = await request("GET", "/api/auth/me", undefined, { ...opts, sessionEpoch: stamp.epoch });
        if (!result?.user) throw new ApiError(0, "Could not load account details. Please retry.");
        if (stamp.epoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
        const users = recordStore.acceptFetch(ACCOUNT_SCOPE, ACCOUNT_RESOURCE, [result.user], stamp);
        return { ...result, user: users[0] || result.user };
    },
    updateMe: (b) => writeAccount("PUT", "/api/auth/me", b),
    renewConsent: () => request("POST", "/api/auth/consent/renew"),
    changePassword: (b) => request("POST", "/api/auth/change-password", b),
    // Separate from updateMe: email is the login identity, so the server
    // requires the current password. See auth.routes.js POST /change-email.
    changeEmail: (b) => writeAccount("POST", "/api/auth/change-email", b),
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
    uploadChildAvatar: (childId, photoUri) => trackApiActivity(async () => {
        const form = new FormData();
        await appendPhoto(form, "photo", photoUri, "avatar.jpg");
        return request("POST", `/api/children/${childId}/avatar`, form, { isForm: true });
    }),

    // --- record attachments (mandatory supporting photo per health record) ---
    listAttachments: (childId, opts = {}) => request("GET", `/api/children/${childId}/attachments`, undefined, opts),
    uploadAttachment: (childId, { recordType, recordId, photoUri, fileUrl }) => trackApiActivity(async () => {
        const form = new FormData();
        form.append("record_type", recordType);
        form.append("record_id", String(recordId));
        if (photoUri) await appendPhoto(form, "photo", photoUri, "doc.jpg");
        else if (fileUrl) form.append("file_url", fileUrl);
        return request("POST", `/api/children/${childId}/attachments`, form, { isForm: true });
    }),
    deleteAttachment: (childId, id) => request("DELETE", `/api/children/${childId}/attachments/${id}`),

    // The vaccine names + dose counts the DOH schedule contains, so the Add
    // Vaccination form can offer a list instead of an empty box. Served from
    // the same data the due dates and reminders come from, so the picker and
    // the schedule cannot drift apart.
    vaccineCatalogue: (opts = {}) => request("GET", `/api/children/vaccine-catalogue`, undefined, opts),

    // --- generic child records (vaccinations, growth, milestones, etc.) ---
    listRecords: (childId, resource, opts = {}) => readList(childId, resource, resourcePath(childId, resource), opts),
    cachedRecords: (childId, resource) => recordStore.getRows(childId, resource),
    createRecord: (childId, resource, b, opts = {}) => writeRecord(childId, resource, null, b, opts),
    updateRecord: (childId, resource, id, b, opts = {}) => writeRecord(childId, resource, id, b, opts),
    deleteRecord: (childId, resource, id, opts = {}) => writeRecord(childId, resource, id, undefined, opts, true),
    saveRecord: async (child, resource, id, body, attempt) => {
        let state = attempt.current;
        if (!state) state = attempt.current = { key: recordStore.operationKey(), body, id, epoch: recordStore.getEpoch() };
        if (state.epoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
        // An interrupted create is replayed with its ORIGINAL key/body before accepting edits.
        if (state.uncertain && state.id == null) {
            const previous = await writeRecord(child, resource, null, state.body, { operationKey: state.key, sessionEpoch: state.epoch });
            state.id = previous.id;
        }
        if (!state.uncertain && JSON.stringify(state.body) !== JSON.stringify(body)) state.key = recordStore.operationKey();
        state.body = body;
        try {
            const saved = await writeRecord(child, resource, state.id, body,
                { operationKey: state.id == null ? state.key : undefined, sessionEpoch: state.epoch });
            state.id = saved.id; state.uncertain = false;
            return saved;
        } catch (error) { state.uncertain = uncertain(error); throw error; }
    },
    optimisticRecord: (child, resource, type, id, body, options = {}) => {
        if (!OPTIMISTIC[resource]?.includes(type)) throw new Error("This action requires server confirmation.");
        const op = recordStore.begin({ child, resource, type, id, body, entity: options.entity, label: options.label });
        return runOperation(op);
    },
    retryMutation: (op) => {
        const current = recordStore.getOperations().find((item) => item.key === op.key);
        if (!current || current.status === "saving") throw new Error("This change is already being processed.");
        return runOperation(current);
    },
    checkMutation: async (op) => {
        if (op.epoch !== recordStore.getEpoch()) throw new ApiError(401, "Session changed");
        if (op.type === "create") {
            let saved;
            try { saved = await request("GET", `${resourcePath(op.child, op.resource)}/operations/${op.key}`,
                undefined, { loading: "nonblocking", sessionEpoch: op.epoch }); }
            catch (error) {
                if (error.status === 404 && error.message === "Operation not found") {
                    if (op.resource === "calendar-plan-statuses") {
                        const rows = await api.listRecords(op.child, op.resource, { loading: "nonblocking", confirmedOnly: true });
                        const existing = rows.find((row) => row.source_type === op.body.source_type
                            && String(row.source_id) === String(op.body.source_id)
                            && String(row.occurrence_date).slice(0, 10) === op.body.occurrence_date);
                        if (existing) {
                            if (existing.completed === op.body.completed) { recordStore.finish(op, existing); return true; }
                            recordStore.update(op, { type: "update", id: existing.id, body: { completed: op.body.completed },
                                status: "failed", message: "This plan changed elsewhere. Retry to apply your checkbox change." });
                        }
                    }
                    return false;
                }
                if (error.status === 410) {
                    recordStore.update(op, { status: "failed", message: "The saved record was deleted. This submission cannot be recreated." });
                }
                throw error;
            }
            recordStore.finish(op, saved);
            return true;
        }
        let saved;
        try { saved = await request("GET", `${resourcePath(op.child, op.resource)}/${op.id}`,
            undefined, { loading: "nonblocking", sessionEpoch: op.epoch }); }
        catch (error) {
            if (op.type === "delete" && error.status === 404 && error.message === "Record not found") {
                recordStore.finish(op); return true;
            }
            throw error;
        }
        if (op.type === "update" && Object.entries(op.body).every(([key, value]) =>
            value == null ? saved[key] == null : String(saved[key]) === String(value))) {
            recordStore.finish(op, saved); return true;
        }
        return false;
    },

    // --- memories with a device photo (multipart upload) ---
    uploadMemory: (childId, { photoUri, caption, notes, date_recorded }) => trackApiActivity(async () => {
        const form = new FormData();
        if (photoUri) {
            await appendPhoto(form, "photo", photoUri, "photo.jpg");
        }
        if (caption) form.append("caption", caption);
        if (notes) form.append("notes", notes);
        if (date_recorded) form.append("date_recorded", date_recorded);
        return request("POST", `/api/children/${childId}/memories`, form, { isForm: true });
    }),

    // --- a milestone with a device photo (multipart upload) ---
    //
    // Goes to the SAME generic /milestones endpoint createRecord uses — the
    // resource router accepts either JSON or multipart (photoColumn in
    // back-end/src/utils/resource.js). Only the encoding differs, so there is
    // one create path and one set of validation rules.
    //
    // Blank fields are omitted rather than sent empty: over multipart every
    // value is a string, and an empty `date_recorded` would reach Postgres as
    // "" and fail to parse as a date.
    createMilestoneWithPhoto: (childId, fields, photoUri) => trackApiActivity(async () => {
        const form = new FormData();
        if (photoUri) await appendPhoto(form, "photo", photoUri, "milestone.jpg");
        for (const [k, v] of Object.entries(fields)) {
            if (v !== undefined && v !== null && v !== "") form.append(k, String(v));
        }
        return request("POST", `/api/children/${childId}/milestones`, form, { isForm: true });
    }),

    // --- QR consultation shares (parent) ---
    createShare: async (childId, b) => {
        const epoch = recordStore.getEpoch();
        const share = await request("POST", `/api/children/${childId}/shares`, b, { sessionEpoch: epoch });
        if (!share?.id) throw new ApiError(0, "Could not confirm the share. Check before retrying.");
        recordStore.confirm(childId, "shares", share, share.id, false, epoch);
        return share;
    },
    listShares: (childId, opts = {}) => readList(childId, "shares", `/api/children/${childId}/shares`, opts),
    revokeShare: async (childId, id) => {
        const epoch = recordStore.getEpoch();
        const share = await request("POST", `/api/children/${childId}/shares/${id}/revoke`, undefined, { sessionEpoch: epoch });
        if (!share?.id) throw new ApiError(0, "Could not confirm revocation. Check before retrying.");
        recordStore.confirm(childId, "shares", share, id, false, epoch);
        return share;
    },
    accessLog: (childId, opts = {}) => readList(childId, "access-log", `/api/children/${childId}/access-log`, opts),
    unseenAccessLog: (childId, opts = {}) => request("GET", `/api/children/${childId}/access-log/unseen`, undefined, { background: opts.background }),
    markAccessLogSeen: (childId, opts = {}) => request("POST", `/api/children/${childId}/access-log/mark-seen`, undefined, { background: opts.background }),

    // --- QR consultation (healthcare professional, public) ---
    resolveConsult: (b) => request("POST", "/api/consult/resolve", b, { auth: false }),
};
