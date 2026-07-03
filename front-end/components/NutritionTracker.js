import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, shadow } from "../theme";
import { api } from "../utils/api";
import { nutritionToApp, nutritionFormToRecord, toMilliliters } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import { SectionContainerCard, ListEntryCard, EmptyStateCard } from "./common/Cards";

const MILK_TYPES = ["Formula", "Breastmilk", "Mixed"];
const UNITS = ["oz", "mL", "L"];
const RANGES = [
    { key: "7d", label: "7 Days", days: 7 },
    { key: "30d", label: "30 Days", days: 30 },
    { key: "6mo", label: "6 Months", days: 183 },
    { key: "all", label: "All Time", days: null },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const todayStr = () => new Date().toISOString().split("T")[0];
const pad2 = (n) => String(n).padStart(2, "0");
const nowTime = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const emptyForm = () => ({
    entryType: "milk",
    milkType: "Breastmilk",
    formulaBrand: "",
    quantity: "",
    unit: "mL",
    foodIntroduced: "",
    reaction: "",
    date: todayStr(),
    time: nowTime(),
    notes: "",
});

// --- analytics helpers (dependency-free) ---
function periodStart(d, gran) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (gran === "day") return x;
    if (gran === "week") {
        x.setDate(x.getDate() - x.getDay()); // week starting Sunday
        return x;
    }
    return new Date(d.getFullYear(), d.getMonth(), 1); // month
}
function bucketLabel(d, gran) {
    const s = periodStart(d, gran);
    if (gran === "month") return MONTHS[s.getMonth()];
    return `${s.getMonth() + 1}/${s.getDate()}`;
}
function buildBuckets(milk, rangeObj) {
    if (!milk.length) return [];
    const now = new Date();
    const startBound = rangeObj.days ? new Date(now.getTime() - rangeObj.days * 86400000) : null;
    const inRange = milk.filter((e) => !startBound || new Date(e.date) >= startBound);
    if (!inRange.length) return [];
    const dates = inRange.map((e) => new Date(e.date));
    const minD = new Date(Math.min.apply(null, dates));
    const spanDays = rangeObj.days || Math.max(1, Math.round((now - minD) / 86400000));
    const gran = spanDays <= 14 ? "day" : spanDays <= 120 ? "week" : "month";
    const map = {};
    for (const e of inRange) {
        const d = new Date(e.date);
        const start = periodStart(d, gran);
        const key = start.getTime();
        if (!map[key]) map[key] = { ml: 0, sort: key, label: bucketLabel(d, gran) };
        map[key].ml += toMilliliters(e.quantity, e.unit);
    }
    return Object.keys(map)
        .map((k) => map[k])
        .sort((a, b) => a.sort - b.sort);
}
function dayDiffInclusive(a, b) {
    return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}
// Consecutive same-milk-type runs. Editing an entry's type re-groups the runs,
// so a previous period ends and a new one begins exactly as specified.
function milkDurations(milk) {
    if (!milk.length) return { periods: [], current: null };
    const sorted = milk.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const runs = [];
    for (const e of sorted) {
        const last = runs[runs.length - 1];
        const type = e.milkType || "Unspecified";
        if (last && last.type === type) last.end = e.date;
        else runs.push({ type, start: e.date, end: e.date });
    }
    const periods = runs.map((r) => ({ type: r.type, start: r.start, end: r.end, days: dayDiffInclusive(r.start, r.end) }));
    const lastRun = runs[runs.length - 1];
    const current = lastRun ? { type: lastRun.type, start: lastRun.start, days: dayDiffInclusive(lastRun.start, todayStr()) } : null;
    return { periods, current };
}

export default function NutritionTracker({ childId }) {
    const toast = useToast();
    const [entries, setEntries] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [range, setRange] = useState("7d");

    const load = async () => {
        try {
            const rows = await api.listRecords(childId, "nutrition");
            setEntries(rows.map(nutritionToApp));
        } catch (e) {
            console.log("load nutrition:", e.message);
        }
    };
    useEffect(() => {
        load();
    }, [childId]);

    const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowModal(true);
    };
    const openEdit = (e) => {
        setEditingId(e.id);
        setForm({
            entryType: e.entryType || "milk",
            milkType: e.milkType || "Breastmilk",
            formulaBrand: e.formulaBrand || "",
            quantity: e.quantity != null ? String(e.quantity) : "",
            unit: e.unit || "mL",
            foodIntroduced: e.foodIntroduced || "",
            reaction: e.reaction || "",
            date: e.date || todayStr(),
            time: e.time || "",
            notes: e.notes || "",
        });
        setShowModal(true);
    };

    const validate = () => {
        if (form.entryType === "milk") {
            if (!form.milkType) return toast.error("Select a milk type"), false;
            if (!form.quantity || Number(form.quantity) <= 0) return toast.error("Enter a quantity greater than 0"), false;
            if (!UNITS.includes(form.unit)) return toast.error("Select a valid unit"), false;
        } else if (!form.foodIntroduced.trim()) {
            return toast.error("Enter the food introduced"), false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;
        const body = nutritionFormToRecord(form);
        try {
            if (editingId) {
                const saved = await api.updateRecord(childId, "nutrition", editingId, body);
                setEntries((prev) => prev.map((e) => (e.id === editingId ? nutritionToApp(saved) : e)));
                toast.success("Entry updated");
            } else {
                const saved = await api.createRecord(childId, "nutrition", body);
                setEntries((prev) => [nutritionToApp(saved), ...prev]);
                toast.success("Entry saved");
            }
            setShowModal(false);
        } catch (e) {
            toast.error(e.message || "Could not save entry");
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteRecord(childId, "nutrition", id);
            setEntries((prev) => prev.filter((e) => e.id !== id));
            toast.success("Entry removed");
        } catch (e) {
            toast.error(e.message || "Could not delete entry");
        }
    };

    const milk = useMemo(() => entries.filter((e) => e.entryType === "milk" && e.date), [entries]);
    const rangeObj = RANGES.find((r) => r.key === range) || RANGES[0];
    const buckets = useMemo(() => buildBuckets(milk, rangeObj), [milk, range]);
    const durations = useMemo(() => milkDurations(milk), [milk]);
    const maxMl = Math.max(1, ...buckets.map((b) => b.ml));
    const showFormula = form.milkType === "Formula" || form.milkType === "Mixed";

    // Sort entries newest-first for the list.
    const listed = useMemo(
        () => entries.slice().sort((a, b) => ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || ""))),
        [entries],
    );

    return (
        <View>
            {/* Analytics */}
            <SectionContainerCard title="Milk Intake Analytics" subtitle="Consumption over time">
                <View style={styles.rangeRow}>
                    {RANGES.map((r) => (
                        <TouchableOpacity
                            key={r.key}
                            onPress={() => setRange(r.key)}
                            style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
                        >
                            <Text style={[styles.rangeChipText, range === r.key && styles.rangeChipTextActive]}>
                                {r.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {buckets.length === 0 ? (
                    <EmptyStateCard message="No milk entries in this period yet." icon="bar-chart-outline" />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
                        {buckets.map((b, i) => (
                            <View key={i} style={styles.barCol}>
                                <Text style={styles.barValue}>{Math.round(b.ml)}</Text>
                                <View style={[styles.bar, { height: Math.max(6, (b.ml / maxMl) * 120) }]} />
                                <Text style={styles.barLabel} numberOfLines={1}>{b.label}</Text>
                            </View>
                        ))}
                    </ScrollView>
                )}
                <Text style={styles.chartUnit}>Totals shown in mL{"  ·  "}tap a range above</Text>

                {durations.current ? (
                    <View style={styles.durationBox}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={styles.durationText}>
                            Currently on <Text style={styles.durationStrong}>{durations.current.type}</Text> for{" "}
                            {durations.current.days} day{durations.current.days === 1 ? "" : "s"}
                        </Text>
                    </View>
                ) : null}
                {durations.periods.length > 1
                    ? durations.periods.map((p, i) => (
                          <Text key={i} style={styles.periodLine}>
                              • {p.type}: {p.start} → {p.end} ({p.days} day{p.days === 1 ? "" : "s"})
                          </Text>
                      ))
                    : null}
            </SectionContainerCard>

            {/* Entries */}
            <SectionContainerCard
                title="Nutrition Records"
                subtitle="Milk consumption and solid-food introductions"
                action={
                    <TouchableOpacity onPress={openAdd} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Add nutrition entry">
                        <Ionicons name="add" size={16} color={colors.onAccent} />
                        <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                }
            >
                {listed.length === 0 && <EmptyStateCard message="No nutrition entries yet. Tap Add to log milk or solids." />}
                {listed.map((e) => (
                    <ListEntryCard
                        key={e.id}
                        title={
                            e.entryType === "milk"
                                ? `${e.milkType || "Milk"} — ${e.quantity != null ? e.quantity : "?"} ${e.unit || ""}`
                                : e.foodIntroduced || "Solid food"
                        }
                        subtitle={
                            e.entryType === "milk"
                                ? `${e.date}${e.time ? " · " + e.time : ""}${e.formulaBrand ? " · " + e.formulaBrand : ""}`
                                : `Solid food · ${e.date}`
                        }
                        notes={e.entryType === "solid" && e.reaction ? "Reaction: " + e.reaction : e.notes || undefined}
                        icon={
                            <Ionicons
                                name={e.entryType === "milk" ? "water-outline" : "restaurant-outline"}
                                size={18}
                                color={colors.primary}
                            />
                        }
                        iconBg={e.entryType === "milk" ? colors.tintBlue : colors.tintAmber}
                        actions={
                            <View style={{ flexDirection: "row", gap: space.sm }}>
                                <TouchableOpacity onPress={() => openEdit(e)} accessibilityRole="button" accessibilityLabel="Edit entry">
                                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(e.id)} accessibilityRole="button" accessibilityLabel="Delete entry">
                                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                                </TouchableOpacity>
                            </View>
                        }
                    />
                ))}
            </SectionContainerCard>

            {/* Add / Edit Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <ScrollView contentContainerStyle={styles.modalScroll}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>{editingId ? "Edit Nutrition Entry" : "Add Nutrition Entry"}</Text>

                            {/* Entry type */}
                            <View style={styles.segment}>
                                {[
                                    { k: "milk", label: "Milk" },
                                    { k: "solid", label: "Solid Food" },
                                ].map((o) => (
                                    <TouchableOpacity
                                        key={o.k}
                                        style={[styles.segBtn, form.entryType === o.k && styles.segBtnActive]}
                                        onPress={() => setF("entryType", o.k)}
                                    >
                                        <Text style={[styles.segText, form.entryType === o.k && styles.segTextActive]}>{o.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {form.entryType === "milk" ? (
                                <View>
                                    <Text style={styles.label}>Milk Type</Text>
                                    <View style={styles.segment}>
                                        {MILK_TYPES.map((mt) => (
                                            <TouchableOpacity
                                                key={mt}
                                                style={[styles.segBtn, form.milkType === mt && styles.segBtnActive]}
                                                onPress={() => setF("milkType", mt)}
                                            >
                                                <Text style={[styles.segText, form.milkType === mt && styles.segTextActive]}>{mt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {showFormula ? (
                                        <View>
                                            <Text style={styles.label}>Formula Brand</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. Enfamil A+"
                                                placeholderTextColor={colors.textMuted}
                                                value={form.formulaBrand}
                                                onChangeText={(v) => setF("formulaBrand", v)}
                                            />
                                        </View>
                                    ) : null}

                                    <Text style={styles.label}>Quantity</Text>
                                    <View style={{ flexDirection: "row", gap: space.sm }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            keyboardType="numeric"
                                            placeholder="e.g. 120"
                                            placeholderTextColor={colors.textMuted}
                                            value={form.quantity}
                                            onChangeText={(v) => setF("quantity", v)}
                                        />
                                        <View style={[styles.segment, { flex: 1.2, marginBottom: space.md }]}>
                                            {UNITS.map((u) => (
                                                <TouchableOpacity
                                                    key={u}
                                                    style={[styles.segBtn, form.unit === u && styles.segBtnActive]}
                                                    onPress={() => setF("unit", u)}
                                                >
                                                    <Text style={[styles.segText, form.unit === u && styles.segTextActive]}>{u}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.label}>Food Introduced</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Mashed banana"
                                        placeholderTextColor={colors.textMuted}
                                        value={form.foodIntroduced}
                                        onChangeText={(v) => setF("foodIntroduced", v)}
                                    />
                                    <Text style={styles.label}>Reaction (optional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. None, mild rash"
                                        placeholderTextColor={colors.textMuted}
                                        value={form.reaction}
                                        onChangeText={(v) => setF("reaction", v)}
                                    />
                                </View>
                            )}

                            <View style={{ flexDirection: "row", gap: space.sm }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Date</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor={colors.textMuted}
                                        value={form.date}
                                        onChangeText={(v) => setF("date", v)}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Time</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="HH:MM"
                                        placeholderTextColor={colors.textMuted}
                                        value={form.time}
                                        onChangeText={(v) => setF("time", v)}
                                    />
                                </View>
                            </View>

                            <Text style={styles.label}>Notes (optional)</Text>
                            <TextInput
                                style={styles.input}
                                value={form.notes}
                                onChangeText={(v) => setF("notes", v)}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.cancelBtn}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                                    <Text style={styles.saveText}>{editingId ? "Update" : "Save"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    rangeRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
    rangeChip: {
        paddingHorizontal: space.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    rangeChipActive: { backgroundColor: colors.softGreen, borderColor: colors.primary },
    rangeChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    rangeChipTextActive: { color: colors.primary },
    chart: { flexDirection: "row", alignItems: "flex-end", gap: space.md, paddingVertical: space.sm, minHeight: 160 },
    barCol: { alignItems: "center", width: 34 },
    bar: {
        width: 22,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        backgroundColor: colors.primary,
        marginTop: 2,
    },
    barValue: { fontSize: 9, color: colors.textMuted, marginBottom: 2 },
    barLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
    chartUnit: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    durationBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.softGreen,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        paddingVertical: 10,
        marginTop: space.md,
    },
    durationText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
    durationStrong: { fontWeight: "800", color: colors.primary },
    periodLine: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.accentStrong,
        paddingHorizontal: space.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        ...shadow.accent,
    },
    addBtnText: { color: colors.onAccent, fontWeight: "800", fontSize: 12 },
    modalBg: { flex: 1, backgroundColor: "rgba(28,25,23,0.55)", justifyContent: "center", padding: space.lg },
    modalScroll: { flexGrow: 1, justifyContent: "center" },
    modalCard: {
        backgroundColor: colors.background,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.xl,
        borderWidth: 1,
        borderColor: colors.hairline,
        ...shadow.raised,
    },
    modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: space.lg },
    label: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: 6 },
    input: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        paddingHorizontal: space.lg,
        height: 48,
        fontSize: 15,
        color: colors.text,
        marginBottom: space.md,
    },
    segment: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: 4,
        marginBottom: space.md,
    },
    segBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: "center" },
    segBtnActive: { backgroundColor: colors.surface, ...shadow.card },
    segText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    segTextActive: { color: colors.primary },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: space.md, marginTop: space.sm },
    cancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    cancelText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    saveBtn: {
        paddingVertical: 12,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.accentStrong,
        ...shadow.accent,
    },
    saveText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
});
