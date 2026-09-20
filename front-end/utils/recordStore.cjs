// Session-only confirmed records and optimistic overlays. No offline write queue.
const EMPTY = Object.freeze([]);
const buckets = new Map();
const operations = new Map();
const listeners = new Set();
let epoch = 0, sequence = 0, operationSnapshot = EMPTY;
const keyOf = (child, resource) => `${child}:${resource}`;
const sameId = (a, b) => String(a) === String(b);
function bucket(child, resource) {
    const key = keyOf(child, resource);
    if (!buckets.has(key)) buckets.set(key, { child: String(child), resource, confirmed: EMPTY, rows: EMPTY, revision: 0,
        readSequence: 0, hasFetched: false, fetchedAt: null, snapshot: { rows: EMPTY, hasFetched: false, fetchedAt: null } });
    return buckets.get(key);
}
function publish(target) {
    if (target) {
        let rows = target.confirmed;
        for (const op of operations.values()) {
            if (op.child !== target.child || op.resource !== target.resource || !["saving", "uncertain"].includes(op.status)) continue;
            if (op.type === "delete") rows = rows.filter((row) => !sameId(row.id, op.id));
            else if (op.type === "update") rows = rows.map((row) => sameId(row.id, op.id) ? { ...row, ...op.body, _pending: true } : row);
            else rows = [{ ...op.body, id: `tmp-${op.key}`, _pending: true }, ...rows];
        }
        const dateField = { growth: "date_recorded", nutrition: "entry_date", milestones: "date_recorded",
            memories: "date_recorded", "medication-doses": "given_date", shares: "generate_date", "access-log": "access_date" }[target.resource];
        target.rows = dateField ? [...rows].sort((a, b) => String(b[dateField] || "").localeCompare(String(a[dateField] || ""))
            || String(b.entry_time || b.given_time || "").localeCompare(String(a.entry_time || a.given_time || ""))
            || (Number(b.id) - Number(a.id) || 0)) : rows;
        target.snapshot = { rows: target.rows, hasFetched: target.hasFetched, fetchedAt: target.fetchedAt };
    }
    operationSnapshot = [...operations.values()];
    listeners.forEach((listener) => listener());
}
function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function reset() { epoch++; buckets.clear(); operations.clear(); publish(); }
function version(child, resource) { return { epoch, revision: bucket(child, resource).revision }; }
function startFetch(child, resource) {
    return { ...version(child, resource), readSequence: ++bucket(child, resource).readSequence };
}
function acceptFetch(child, resource, rows, stamp) {
    if (stamp.epoch !== epoch) return EMPTY;
    const target = bucket(child, resource);
    if (stamp.revision === target.revision && (stamp.readSequence === undefined || stamp.readSequence === target.readSequence)) {
        target.confirmed = Array.isArray(rows) ? rows : EMPTY;
        target.hasFetched = true;
        target.fetchedAt = Date.now();
        for (const row of target.confirmed) {
            const op = operations.get(row._operation_key);
            if (op && op.child === target.child && op.resource === target.resource && op.type === "create") operations.delete(op.key);
        }
        target.revision++;
        publish(target);
    }
    return target.rows;
}
function confirm(child, resource, row, id, deleting = false, session = epoch) {
    if (session !== epoch) return;
    const target = bucket(child, resource);
    target.confirmed = deleting ? target.confirmed.filter((item) => !sameId(item.id, id))
        : [row, ...target.confirmed.filter((item) => !sameId(item.id, row.id))];
    target.revision++;
    publish(target);
}
function isLocked(child, resource, entity) {
    return operationSnapshot.some((op) => op.child === String(child) && op.resource === resource && op.entity === String(entity)
        && ["saving", "uncertain"].includes(op.status));
}
function begin({ child, resource, type, id, body, entity, label }) {
    entity = String(entity ?? id);
    if (isLocked(child, resource, entity)) throw new Error("This change is still awaiting confirmation.");
    for (const op of operations.values()) {
        if (op.child === String(child) && op.resource === resource && op.entity === entity && op.status === "failed") operations.delete(op.key);
    }
    const op = { key: operationKey(), child: String(child), resource, type, id, body: { ...body }, entity, label,
        epoch, status: "saving", message: "" };
    operations.set(op.key, op); publish(bucket(child, resource));
    return op;
}
function update(op, values) {
    if (op.epoch !== epoch || !operations.has(op.key)) return;
    operations.set(op.key, { ...operations.get(op.key), ...values }); publish(bucket(op.child, op.resource));
}
function finish(op, row) {
    if (op.epoch !== epoch || !operations.has(op.key)) return;
    operations.delete(op.key);
    confirm(op.child, op.resource, row, op.id, op.type === "delete", op.epoch);
}
function dismiss(op) {
    if (op.epoch !== epoch || operations.get(op.key)?.status !== "failed") return;
    operations.delete(op.key); publish(bucket(op.child, op.resource));
}
function removeMedicationDoses(child, medicationId) {
    const target = bucket(child, "medication-doses");
    target.confirmed = target.confirmed.filter((row) => !sameId(row.medication_id, medicationId));
    target.revision++; publish(target);
}
function operationKey() {
    // Identity, not a security token. Server ownership scopes every receipt.
    return `bb_${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
module.exports = { subscribe, reset, version, startFetch, acceptFetch, confirm, begin, update, finish, dismiss, isLocked, operationKey, removeMedicationDoses,
    getEpoch: () => epoch, getOperations: () => operationSnapshot,
    getRows: (child, resource) => bucket(child, resource).rows,
    getSnapshot: (child, resource) => bucket(child, resource).snapshot,
    getConfirmed: (child, resource) => bucket(child, resource).confirmed,
};
