// Focused owner-API seed: never reset accounts or use a database/encryption key.
require("dotenv").config();
const { manilaToday, shiftDay } = require("./seedMilkTypeDemo");

const EMAIL = "demo.parent@babybookplus.app";
const ORIGINS = { local: "http://localhost:4000", production: "https://babybook-xi2w.onrender.com" };
const PROFILES = ["Elias Rivera", "Sofia Rivera"];
const PREFIX = "[gallery-category-demo:v1:";
const SAMPLES = [
    ["social", "A joyful game of peekaboo", "Smiles with family"],
    ["language", "Babbling back and forth", "Story time together"],
    ["cognitive", "Finding the hidden toy", "Exploring stacking cups"],
    ["motor", "Reaching during playtime", "Playtime on the mat"],
];
const resource = kind => kind === "memory" ? "memories" : "milestones";
const noteField = kind => kind === "memory" ? "notes" : "description";

function markedRows(rows, kind) {
    const owned = new Map();
    for (const row of rows) {
        const notes = row[noteField(kind)];
        if (typeof notes !== "string" || !notes.startsWith(PREFIX)) continue;
        const match = /^\[gallery-category-demo:v1:(memory|milestone):(social|language|cognitive|motor)\] /.exec(notes);
        if (!match || match[1] !== kind || owned.has(match[2])) throw new Error("Unexpected or duplicate Gallery sample markers; stopped");
        owned.set(match[2], row);
    }
    return owned;
}

function buildGallerySamples(name, anchor) {
    return SAMPLES.flatMap(([category, milestone, memory], index) => ["milestone", "memory"].map((kind, offset) => ({
        kind,
        fields: {
            [kind === "memory" ? "caption" : "title"]: `Demo: ${kind === "memory" ? memory : milestone}`,
            [noteField(kind)]: `${PREFIX}${kind}:${category}] Fictional Gallery preview, not a recorded developmental observation.`,
            date_recorded: shiftDay(anchor, index * 2 + offset + 1),
            development_category: category,
            photo_url: `https://picsum.photos/seed/babybook-gallery-${name.split(" ")[0].toLowerCase()}-${kind}-${category}/600/600`,
            ...(kind === "milestone" ? { is_completed: true, age_achieved: null } : {}),
        },
    })));
}

async function seedGalleryDemo({ target = "local", password, today = manilaToday(), fetchImpl = fetch, onProgress = () => {} } = {}) {
    if (!Object.hasOwn(ORIGINS, target)) throw new Error("Choose local or production");
    if (!password) throw new Error("GALLERY_DEMO_PASSWORD is required; account credentials will not be changed");
    shiftDay(today, 0);
    let token;
    const request = async (method, pathname, body, operationKey) => {
        const response = await fetchImpl(ORIGINS[target] + pathname, {
            method, redirect: "error", signal: AbortSignal.timeout(90000),
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(operationKey ? { "X-Operation-Key": operationKey } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) throw new Error(`${method} ${pathname}: HTTP ${response.status}; retry safely with the same seed`);
        return response.json();
    };
    const login = await request("POST", "/api/auth/login", { email: EMAIL, password });
    if (login.user?.email !== EMAIL || !login.token) throw new Error("Unexpected demo login identity; stopped");
    token = login.token;
    const identity = await request("GET", "/api/auth/me");
    if (identity.user?.email !== EMAIL) throw new Error("Unexpected authenticated account; stopped");
    const children = await request("GET", "/api/children");
    if (!Array.isArray(children)) throw new Error("Could not confirm demo profiles; stopped");
    const plans = [];
    // Resolve and inspect both babies before writing the first sample.
    for (const name of PROFILES) {
        const matches = children.filter(child => [child.first_name, child.last_name].filter(Boolean).join(" ") === name);
        if (matches.length !== 1) throw new Error(`Expected exactly one ${name}; stopped`);
        const child = matches[0], rows = {}, owned = {};
        let anchor = today;
        for (const kind of ["memory", "milestone"]) {
            rows[kind] = await request("GET", `/api/children/${child.id}/${resource(kind)}`);
            if (!Array.isArray(rows[kind])) throw new Error("Could not read Gallery records; stopped");
            owned[kind] = markedRows(rows[kind], kind);
            const ids = new Set([...owned[kind].values()].map(row => String(row.id)));
            for (const row of rows[kind]) {
                if (ids.has(String(row.id)) || !row.date_recorded) continue;
                const date = String(row.date_recorded).slice(0, 10);
                shiftDay(date, 0);
                if (date > anchor) anchor = date;
            }
        }
        plans.push({ name, child, owned, samples: buildGallerySamples(name, anchor) });
    }
    const results = [];
    for (const { name, child, owned, samples } of plans) {
        const count = { name, childId: child.id, inserted: 0, updated: 0, unchanged: 0 };
        results.push(count);
        for (const { kind, fields } of samples) {
            const existing = owned[kind].get(fields.development_category);
            const endpoint = `/api/children/${child.id}/${resource(kind)}`;
            if (existing && existing.photo_url !== fields.photo_url) throw new Error("A marked sample's photo changed; stopped without replacing it");
            if (existing && Object.entries(fields).every(([key, value]) => existing[key] === value)) { count.unchanged++; continue; }
            const { photo_url, ...metadata } = fields;
            const saved = existing ? await request("PUT", `${endpoint}/${existing.id}`, metadata)
                : await request("POST", endpoint, fields, `gallery_v1_${child.id}_${kind}_${fields.development_category}`);
            if (!saved?.id || !Object.entries(fields).every(([key, value]) => saved[key] === value)) throw new Error("Saved Gallery sample did not match; verify the category backend release before retrying");
            count[existing ? "updated" : "inserted"]++;
            onProgress({ target, ...count });
        }
        for (const kind of ["memory", "milestone"]) {
            const rows = markedRows(await request("GET", `/api/children/${child.id}/${resource(kind)}`), kind);
            if (rows.size !== 4) throw new Error("Gallery sample count did not verify");
            for (const { fields } of samples.filter(sample => sample.kind === kind)) {
                if (!Object.entries(fields).every(([key, value]) => rows.get(fields.development_category)?.[key] === value)) throw new Error("Gallery sample verification failed");
            }
        }
    }
    return { target, profiles: results };
}

module.exports = { EMAIL, ORIGINS, PROFILES, PREFIX, SAMPLES, buildGallerySamples, seedGalleryDemo };
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== "--production")) { console.error("Use no arguments for local, or --production"); process.exitCode = 1; }
    else seedGalleryDemo({ target: args.includes("--production") ? "production" : "local", password: process.env.GALLERY_DEMO_PASSWORD,
        onProgress: result => console.log("[seed:gallery-demo:progress]", JSON.stringify(result)) })
        .then(result => console.log("[seed:gallery-demo]", JSON.stringify(result)))
        .catch(error => { console.error("[seed:gallery-demo]", error.message); process.exitCode = 1; });
}
