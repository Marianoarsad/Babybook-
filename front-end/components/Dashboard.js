import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Modal,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { EmptyStateCard } from "./common/Cards";
import MemoryDetail from "./MemoryDetail";
import GrowthChart from "./GrowthChart";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { api } from "../utils/api";
import { memoryToApp, toMilliliters } from "../utils/adapters";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";

// Age in a friendly form ("15 months", "2y 3m") from a YYYY-MM-DD DOB.
function ageText(dob) {
    if (!dob) return "";
    const b = new Date(`${String(dob).slice(0, 10)}T00:00:00`);
    if (isNaN(b.getTime())) return "";
    const now = new Date();
    let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) months -= 1;
    if (months < 0) months = 0;
    if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem ? `${years}y ${rem}m` : `${years} year${years === 1 ? "" : "s"}`;
}

// Compact "time ago" for the Recent Activity feed.
function relativeTime(dateStr) {
    if (!dateStr) return "";
    const raw = String(dateStr);
    const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
    if (isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function dayDiff(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Compares the child's growth-measurement history to answer "is the baby
// growing faster or slower than before" (Documents/plans/BabyBook+_Dashboard_
// Redesign_Evaluation.md, Section 5). Weight gets a faster/slower verdict,
// which needs at least 3 measurements to compare two periods of change;
// height only gets a plain amount-changed, to keep this first version simple.
// Deliberate simplification: rate differences smaller than ~1 gram/day are
// treated as "steady" so rounding noise doesn't flip the verdict back and
// forth — a bigger measurement history could replace this with a real curve.
function growthTrend(rows) {
    const sorted = (rows || [])
        .filter((r) => r.date_recorded)
        .slice()
        .sort((a, b) => String(a.date_recorded).localeCompare(String(b.date_recorded)));
    if (sorted.length === 0) return null;

    const latest = sorted[sorted.length - 1];
    const result = {
        weight: latest.weight != null ? Number(latest.weight) : null,
        height: latest.height != null ? Number(latest.height) : null,
        weightDelta: null,
        heightDelta: null,
        pace: null, // "faster" | "slower" | "steady" | null
    };

    if (sorted.length >= 2) {
        const prev = sorted[sorted.length - 2];
        if (latest.weight != null && prev.weight != null) {
            result.weightDelta = Number(latest.weight) - Number(prev.weight);
        }
        if (latest.height != null && prev.height != null) {
            result.heightDelta = Number(latest.height) - Number(prev.height);
        }
        if (sorted.length >= 3 && latest.weight != null && prev.weight != null) {
            const prev2 = sorted[sorted.length - 3];
            const days1 = dayDiff(prev.date_recorded, latest.date_recorded);
            const days2 = dayDiff(prev2.date_recorded, prev.date_recorded);
            if (days1 > 0 && days2 > 0 && prev2.weight != null) {
                const rate1 = (Number(latest.weight) - Number(prev.weight)) / days1;
                const rate2 = (Number(prev.weight) - Number(prev2.weight)) / days2;
                const diff = rate1 - rate2;
                result.pace = Math.abs(diff) < 0.001 ? "steady" : diff > 0 ? "faster" : "slower";
            }
        }
    }
    return result;
}

export default function Dashboard({
    profile,
    profiles,
    parentName,
    onSelectProfile,
    onOpenAddModal,
    onOpenEditModal,
    onChangeView,
}) {
    const { t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();

    // Recent Activity, the upcoming-appointment box, vaccination progress,
    // the Needs Attention strip, and today's feeding summary all come from
    // the same vaccination/checkup/nutrition/milestone/illness/event fetch —
    // one request per record type, no duplicated network calls.
    const [activity, setActivity] = useState([]);
    const [upcoming, setUpcoming] = useState(null);
    const [vaxProgress, setVaxProgress] = useState(null);
    const [overdueVax, setOverdueVax] = useState([]);
    const [ongoingIllness, setOngoingIllness] = useState([]);
    const [todayFeeding, setTodayFeeding] = useState(null);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [vax, checkups, nutrition, milestones, medHistory, events] = await Promise.all([
                    api.listRecords(profile.id, "vaccinations").catch(() => []),
                    api.listRecords(profile.id, "checkups").catch(() => []),
                    api.listRecords(profile.id, "nutrition").catch(() => []),
                    api.listRecords(profile.id, "milestones").catch(() => []),
                    api.listRecords(profile.id, "medical-history").catch(() => []),
                    // Custom calendar events — only exist once the calendar_events
                    // migration has run (CLAUDE.md, "Pending user action"). This
                    // catch keeps the rest of the dashboard working either way.
                    api.listRecords(profile.id, "calendar-events").catch(() => []),
                ]);
                if (!active) return;
                const todayStr = new Date().toISOString().slice(0, 10);
                const items = [];
                (vax || [])
                    .filter((v) => v.status === "completed" && v.date_given)
                    .forEach((v) =>
                        items.push({
                            key: `vax-${v.id}`,
                            title: "Vaccination Logged",
                            subtitle: v.vaccine_name || "Vaccine",
                            date: String(v.date_given).slice(0, 10),
                            icon: "checkmark-circle",
                            tone: "primary",
                        }),
                    );
                (checkups || [])
                    .filter((c) => c.checkup_date)
                    .forEach((c) =>
                        items.push({
                            key: `chk-${c.id}`,
                            title: "Wellness Checkup",
                            subtitle: c.title || c.doctor_name || "Checkup",
                            date: String(c.checkup_date).slice(0, 10),
                            icon: "medkit",
                            tone: "danger",
                        }),
                    );
                (nutrition || []).forEach((n) => {
                    const isMilk = (n.entry_type || "milk") === "milk";
                    const qty = n.quantity != null && n.quantity !== "" ? Number(n.quantity) : null;
                    const subtitle = isMilk
                        ? `${n.milk_type || "Milk"}${qty != null ? ` • ${qty} ${n.unit || "mL"}` : ""}`
                        : `Solid Food${n.food_introduced ? ` • ${n.food_introduced}` : ""}`;
                    items.push({
                        key: `nut-${n.id}`,
                        title: "Feeding Logged",
                        subtitle,
                        date: String(n.entry_date).slice(0, 10),
                        icon: "restaurant",
                        tone: "success",
                    });
                });
                (milestones || [])
                    .filter((m) => m.is_completed && m.date_recorded)
                    .forEach((m) =>
                        items.push({
                            key: `ms-${m.id}`,
                            title: "Milestone Reached",
                            subtitle: m.title || "Milestone",
                            date: String(m.date_recorded).slice(0, 10),
                            icon: "trophy",
                            tone: "info",
                        }),
                    );
                const past = items.filter((i) => i.date && i.date <= todayStr);
                past.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                setActivity(past.slice(0, 4));

                // Upcoming appointment: the soonest not-yet-done vaccination,
                // checkup, or custom calendar event. Reminders are left out on
                // purpose — they're created automatically alongside the
                // vaccination/checkup they belong to, so counting them too
                // would list the same appointment twice.
                const upcomingItems = [];
                (vax || [])
                    .filter((v) => v.status !== "completed" && v.due_date && v.due_date >= todayStr)
                    .forEach((v) =>
                        upcomingItems.push({
                            key: `vax-${v.id}`,
                            title: v.vaccine_name || "Vaccination",
                            subtitle: v.visit_name || "",
                            date: v.due_date,
                        }),
                    );
                (checkups || [])
                    .filter((c) => c.status !== "completed" && c.checkup_date && c.checkup_date >= todayStr)
                    .forEach((c) =>
                        upcomingItems.push({
                            key: `chk-${c.id}`,
                            title: c.title || "Checkup",
                            subtitle: c.doctor_name || "",
                            date: c.checkup_date,
                        }),
                    );
                (events || [])
                    .filter((e) => e.event_date && e.event_date >= todayStr)
                    .forEach((e) =>
                        upcomingItems.push({
                            key: `evt-${e.id}`,
                            title: e.title || "Event",
                            subtitle: e.description || "",
                            date: e.event_date,
                        }),
                    );
                upcomingItems.sort((a, b) => a.date.localeCompare(b.date));
                setUpcoming(upcomingItems[0] || null);

                setVaxProgress({
                    completed: (vax || []).filter((v) => v.status === "completed").length,
                    total: (vax || []).length,
                });

                // Needs Attention: vaccinations past their due date and still
                // not given, plus illnesses not yet marked resolved.
                setOverdueVax(
                    (vax || [])
                        .filter((v) => v.status !== "completed" && v.due_date && v.due_date < todayStr)
                        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
                );
                setOngoingIllness(
                    (medHistory || []).filter((m) => m.category === "Illness" && !m.resolved),
                );

                // Today's feeding summary — reuses the nutrition rows already
                // loaded for Recent Activity, no extra request.
                const todayEntries = (nutrition || []).filter(
                    (n) => String(n.entry_date).slice(0, 10) === todayStr,
                );
                if (todayEntries.length) {
                    const totalMl = todayEntries
                        .filter((n) => (n.entry_type || "milk") === "milk")
                        .reduce((sum, n) => sum + toMilliliters(Number(n.quantity) || 0, n.unit), 0);
                    const lastTime = todayEntries
                        .map((n) => n.entry_time)
                        .filter(Boolean)
                        .sort()
                        .pop();
                    setTodayFeeding({ count: todayEntries.length, totalMl: Math.round(totalMl), lastTime });
                } else {
                    setTodayFeeding(null);
                }
            } catch (e) {
                console.log("load activity:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    // Growth history — separate fetch, since nothing else on this screen
    // needs the measurement history. Kept raw (growthRows) for the chart, on
    // top of the computed faster/slower verdict (trend) the summary card uses.
    const [trend, setTrend] = useState(null);
    const [growthRows, setGrowthRows] = useState([]);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "growth");
                if (!active) return;
                setTrend(growthTrend(rows));
                setGrowthRows(rows || []);
            } catch (e) {
                console.log("load growth trend:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    // Photo memories load from and persist to the backend.
    const [memories, setMemories] = useState([]);
    const [detailMemory, setDetailMemory] = useState(null);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [memCaption, setMemCaption] = useState("");
    const [memNotes, setMemNotes] = useState("");
    const [memPhotoUri, setMemPhotoUri] = useState("");
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "memories");
                if (active) setMemories(rows.map(memoryToApp));
            } catch (e) {
                console.log("load memories:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    const handleAddMemory = async () => {
        if (!memCaption.trim()) {
            toast.error("Please enter a caption");
            return;
        }
        const caption = memCaption;
        const notes = memNotes;
        const photoUri = memPhotoUri;
        const date_recorded = new Date().toISOString().split("T")[0];
        setShowMemoryModal(false);
        setMemCaption("");
        setMemNotes("");
        setMemPhotoUri("");
        try {
            const saved = photoUri
                ? await api.uploadMemory(profile.id, { photoUri, caption, notes, date_recorded })
                : await api.createRecord(profile.id, "memories", {
                      caption,
                      notes: notes || null,
                      photo_url: null,
                      date_recorded,
                  });
            setMemories((prev) => [memoryToApp(saved), ...prev]);
            toast.success("Memory saved");
        } catch (e) {
            toast.error(e.message || "Could not save memory");
        }
    };

    const weight = (trend && trend.weight != null ? trend.weight : null) ?? profile.currentWeight ?? profile.birthWeight;
    const height = (trend && trend.height != null ? trend.height : null) ?? profile.currentHeight ?? profile.birthHeight;
    const headCirc = growthRows.length
        ? growthRows
              .filter((r) => r.head_circumference != null && r.date_recorded)
              .slice()
              .sort((a, b) => String(a.date_recorded).localeCompare(String(b.date_recorded)))
              .pop()?.head_circumference ?? null
        : null;

    const nav = (view, tab) => onChangeView && onChangeView(view, tab);

    // Gender is icon-only now — the word next to it used to repeat exactly
    // what the icon already showed (evaluation doc, Section 2). The
    // accessibility label keeps the information available to screen readers.
    const sexLabel = profile.gender === "boy" ? "Male" : "Female";
    const fmt = (n, delta) =>
        delta != null ? `${n} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)})` : `${n}`;
    const babyMeta = [
        { icon: profile.gender === "boy" ? "male" : "female", text: null, a11y: sexLabel },
        { icon: "time-outline", text: ageText(profile.dateOfBirth) || "—", a11y: null },
        { icon: "scale-outline", text: `${fmt(weight, trend ? trend.weightDelta : null)} kg`, a11y: null },
        { icon: "resize-outline", text: `${fmt(height, trend ? trend.heightDelta : null)} cm`, a11y: null },
    ];
    if (headCirc != null) {
        babyMeta.push({ icon: "ellipse-outline", text: `${Number(headCirc)} cm head`, a11y: null });
    }

    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };
    const vaxPct = vaxProgress && vaxProgress.total > 0 ? Math.round((vaxProgress.completed / vaxProgress.total) * 100) : 0;
    const hasAllergies = Array.isArray(profile.allergies) && profile.allergies.length > 0;
    // Capped at 3, same pattern as Recent Activity and Photo Memories below —
    // a demo/seeded account can rack up a dozen overdue doses, and a wall of
    // rows here would recreate the crowding this redesign was meant to fix.
    const attentionItems = [
        ...overdueVax.map((v) => ({
            key: `ovax-${v.id}`,
            text: `${v.vaccine_name || "Vaccination"} was due ${v.due_date}`,
            tab: "immunizations",
        })),
        ...ongoingIllness.map((m) => ({
            key: `ill-${m.id}`,
            text: `Ongoing: ${m.title || "Illness"}`,
            tab: "illnesses",
        })),
    ];
    const hasNeedsAttention = attentionItems.length > 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: space.xxl }}>
            {/* Baby switcher — only shown with more than one child. With a
                single child there's nothing to switch between, so just the
                Add button shows on its own (evaluation doc, Section 2). */}
            {profiles.length > 1 ? (
                <View style={styles.profileBar}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.profilesScroll}
                    >
                        {profiles.map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                onPress={() => onSelectProfile(p.id)}
                                style={[styles.profileTab, profile.id === p.id && styles.profileTabActive]}
                                accessibilityRole="button"
                                accessibilityLabel={`Switch to ${p.name}`}
                            >
                                <Image source={{ uri: p.avatarUrl }} style={styles.avatarMini} />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={onOpenAddModal} style={styles.addProfileButton}>
                            <Ionicons name="add" size={18} color={colors.primary} />
                            <Text style={styles.addProfileText}>Add</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            ) : (
                <View style={styles.profileBarSingle}>
                    <TouchableOpacity onPress={onOpenAddModal} style={styles.addProfileButton}>
                        <Ionicons name="add" size={18} color={colors.primary} />
                        <Text style={styles.addProfileText}>Add another child</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Needs Attention — only renders when something actually needs it,
                so a normal day still looks calm. Medications are deliberately
                left out: the medication record has no start/end date or
                resolved flag, so "currently taking this" can't be worked out
                reliably from the data as it stands. */}
            {hasNeedsAttention ? (
                <View style={styles.attentionCard}>
                    <View style={styles.attentionHeader}>
                        <Ionicons name="warning" size={16} color={colors.danger} />
                        <Text style={styles.attentionTitle}>Needs Attention</Text>
                    </View>
                    {attentionItems.slice(0, 3).map((item) => (
                        <TouchableOpacity
                            key={item.key}
                            style={styles.attentionRow}
                            onPress={() => nav("health", item.tab)}
                            accessibilityRole="button"
                            accessibilityLabel={item.text}
                        >
                            <Text style={styles.attentionText}>{item.text}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                    {attentionItems.length > 3 ? (
                        <TouchableOpacity
                            style={styles.attentionRow}
                            onPress={() => nav("health")}
                            accessibilityRole="button"
                            accessibilityLabel={`${attentionItems.length - 3} more items need attention`}
                        >
                            <Text style={styles.attentionMoreText}>
                                +{attentionItems.length - 3} more · View Health
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {/* Baby Summary Card — 2-column meta grid. The photo and name
                already show in the header and (with more than one child)
                the switcher above, so this card doesn't repeat them. */}
            <View style={styles.summaryCard} accessible accessibilityLabel={`${profile.name}'s summary`}>
                <View style={styles.summaryTopRow}>
                    <TouchableOpacity
                        onPress={onOpenEditModal}
                        style={styles.summaryEdit}
                        accessibilityRole="button"
                        accessibilityLabel="Edit child profile"
                    >
                        <Ionicons name="pencil" size={15} color={colors.primary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.metaGrid}>
                    {babyMeta.map((m, idx) => (
                        <View
                            key={idx}
                            style={styles.metaItem}
                            accessible={!!m.a11y}
                            accessibilityLabel={m.a11y || undefined}
                        >
                            <Ionicons name={m.icon} size={14} color={colors.primary} />
                            {m.text ? <Text style={styles.metaText}>{m.text}</Text> : null}
                        </View>
                    ))}
                </View>
                {trend && trend.pace ? (
                    <View style={styles.trendRow}>
                        <Ionicons
                            name={
                                trend.pace === "faster"
                                    ? "trending-up"
                                    : trend.pace === "slower"
                                      ? "trending-down"
                                      : "remove-outline"
                            }
                            size={14}
                            color={
                                trend.pace === "faster"
                                    ? colors.success
                                    : trend.pace === "slower"
                                      ? colors.warning
                                      : colors.textMuted
                            }
                        />
                        <Text style={styles.trendText}>
                            {trend.pace === "faster"
                                ? "Growing faster than before"
                                : trend.pace === "slower"
                                  ? "Growing slower than before"
                                  : "Growing at a steady pace"}
                        </Text>
                    </View>
                ) : null}
                {hasAllergies || profile.bloodType ? (
                    <View style={styles.healthRow}>
                        {hasAllergies ? (
                            <View style={[styles.healthChip, styles.healthChipWarning]}>
                                <Ionicons name="alert-circle-outline" size={12} color={colors.danger} />
                                <Text style={styles.healthChipTextWarning} numberOfLines={1}>
                                    {profile.allergies.join(", ")}
                                </Text>
                            </View>
                        ) : null}
                        {profile.bloodType ? (
                            <View style={styles.healthChip}>
                                <Ionicons name="water-outline" size={12} color={colors.textSecondary} />
                                <Text style={styles.healthChipText}>{profile.bloodType}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </View>

            {/* Growth chart — reuses the same growth history already fetched
                for the faster/slower verdict above. */}
            <GrowthChart rows={growthRows} />

            {/* Upcoming appointment — the only way to Calendar from this screen. */}
            {upcoming ? (
                <TouchableOpacity
                    style={styles.upcomingCard}
                    onPress={() => nav("calendar")}
                    accessibilityRole="button"
                    accessibilityLabel={`Next: ${upcoming.title}, ${upcoming.date}`}
                >
                    <View style={styles.upcomingIcon}>
                        <Ionicons name="calendar" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.upcomingLabel}>Next: {upcoming.title}</Text>
                        <Text style={styles.upcomingSub}>
                            {upcoming.date}
                            {upcoming.subtitle ? ` · ${upcoming.subtitle}` : ""}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
            ) : null}

            {/* Vaccination progress */}
            {vaxProgress && vaxProgress.total > 0 ? (
                <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                        <Text style={styles.progressTitle}>Vaccination Progress</Text>
                        <Text style={styles.progressCount}>
                            {vaxProgress.completed} of {vaxProgress.total} doses
                        </Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${vaxPct}%` }]} />
                    </View>
                </View>
            ) : null}

            {/* Today's feeding summary — reuses nutrition rows already loaded
                for Recent Activity. */}
            <TouchableOpacity
                style={styles.feedingCard}
                onPress={() => nav("nutrition")}
                accessibilityRole="button"
                accessibilityLabel={
                    todayFeeding ? `Fed ${todayFeeding.count} times today` : "Log today's first feeding"
                }
            >
                <View style={styles.feedingIcon}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
                </View>
                {todayFeeding ? (
                    <View style={{ flex: 1 }}>
                        <Text style={styles.feedingLabel}>
                            Fed {todayFeeding.count} time{todayFeeding.count === 1 ? "" : "s"} today
                        </Text>
                        <Text style={styles.feedingSub}>
                            {todayFeeding.totalMl > 0 ? `${todayFeeding.totalMl} mL total` : "Solid food logged"}
                            {todayFeeding.lastTime ? ` · last at ${todayFeeding.lastTime.slice(0, 5)}` : ""}
                        </Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <Text style={styles.feedingLabel}>No feedings logged today</Text>
                        <Text style={styles.feedingSub}>Tap to log the first one</Text>
                    </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Photo Memories — square photo gallery */}
            <View style={styles.gallerySection}>
                <View style={styles.galleryHeader}>
                    <Text style={styles.sectionHeadingFlush}>Photo Memories</Text>
                    <View style={styles.galleryHeaderActions}>
                        <TouchableOpacity
                            onPress={() => nav("allMemories")}
                            accessibilityRole="button"
                            accessibilityLabel="See all photo memories"
                        >
                            <Text style={styles.seeAllText}>See all →</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowMemoryModal(true)}
                            style={styles.addPill}
                            accessibilityRole="button"
                            accessibilityLabel="Add photo memory"
                        >
                            <Ionicons name="add" size={16} color={colors.onAccent} />
                            <Text style={styles.addPillText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {memories.length ? (
                    <View style={styles.galleryGrid}>
                        {memories.slice(0, 4).map((m, idx) => (
                            <TouchableOpacity
                                key={m.id || idx}
                                style={styles.galleryCard}
                                activeOpacity={0.85}
                                onPress={() => setDetailMemory(m)}
                                accessibilityRole="button"
                                accessibilityLabel={`View memory: ${m.title}`}
                            >
                                {m.photoUrl ? (
                                    <Image source={{ uri: m.photoUrl }} style={styles.galleryImg} />
                                ) : (
                                    <View style={[styles.galleryImg, styles.galleryPlaceholder]}>
                                        <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                                    </View>
                                )}
                                <View style={styles.galleryScrim} />
                                <View style={styles.galleryOverlay}>
                                    <Text style={styles.galleryTitle} numberOfLines={1}>{m.title}</Text>
                                    {m.date ? <Text style={styles.galleryDate}>{m.date}</Text> : null}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <EmptyStateCard message="No memories yet. Tap Add to save your baby's precious moments." icon="image-outline" />
                )}
            </View>

            {/* Recent Activity — moved to the bottom of the screen; the sections
                above answer "does anything need attention or action" first. */}
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeadingFlush}>Recent Activity</Text>
                <TouchableOpacity
                    onPress={() => nav("allActivity")}
                    accessibilityRole="button"
                    accessibilityLabel="See all activity"
                >
                    <Text style={styles.seeAllText}>See all →</Text>
                </TouchableOpacity>
            </View>
            {activity.length ? (
                <View style={styles.activityCard}>
                    {activity.map((a, idx) => {
                        const tone = toneColor[a.tone] || colors.primary;
                        return (
                            <View
                                key={a.key}
                                style={[styles.activityRow, idx < activity.length - 1 && styles.activityRowBorder]}
                            >
                                <View style={styles.activityLeft}>
                                    <View style={[styles.activityIcon, { backgroundColor: tone + "1A" }]}>
                                        <Ionicons name={a.icon} size={18} color={tone} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.activityTitle}>{a.title}</Text>
                                        <Text style={styles.activitySubtitle} numberOfLines={1}>
                                            {a.subtitle}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.activityTime}>{relativeTime(a.date)}</Text>
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View style={{ marginBottom: space.lg }}>
                    <EmptyStateCard message="No recent activity yet." icon="time-outline" />
                </View>
            )}

            <MemoryDetail
                visible={!!detailMemory}
                memory={detailMemory}
                dob={profile.dateOfBirth}
                typeLabel="Photo Memory"
                onClose={() => setDetailMemory(null)}
            />

            {/* Add Memory Modal */}
            <Modal visible={showMemoryModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Photo Memory</Text>

                        <Text style={styles.modalLabel}>Caption</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="First steps!"
                            placeholderTextColor={colors.placeholder}
                            value={memCaption}
                            onChangeText={setMemCaption}
                        />

                        <Text style={styles.modalLabel}>Notes (optional)</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={memNotes}
                            onChangeText={setMemNotes}
                        />

                        {pickerAvailable() && (
                            <TouchableOpacity
                                style={styles.choosePhotoBtn}
                                onPress={async () => {
                                    const uri = await pickImage();
                                    if (uri) setMemPhotoUri(uri);
                                }}
                            >
                                <Ionicons name="image-outline" size={16} color={colors.primary} />
                                <Text style={styles.choosePhotoText}>
                                    {memPhotoUri ? "Photo selected ✓ (tap to change)" : "Choose Photo from Device"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setShowMemoryModal(false)} style={styles.modalCancelBtn}>
                                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddMemory} style={styles.modalSaveBtn}>
                                <Text style={styles.modalSaveText}>{t("save")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: space.lg,
    },

    // Baby switcher
    profileBar: { marginBottom: space.md },
    profileBarSingle: { marginBottom: space.md, alignItems: "flex-start" },
    profilesScroll: { alignItems: "center", paddingRight: space.xs },
    profileTab: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        padding: 3,
        marginRight: space.sm,
        ...shadow.card,
    },
    profileTabActive: { borderColor: colors.accent, backgroundColor: colors.softCoral },
    avatarMini: { width: 32, height: 32, borderRadius: 16 },
    addProfileButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.softGreen,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        paddingVertical: 7,
        minHeight: 44,
    },
    addProfileText: { fontSize: 13, fontWeight: "700", color: colors.primary, marginLeft: 3 },

    // Baby Summary Card
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: space.md,
        marginBottom: space.lg,
        ...shadow.card,
    },
    summaryTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
    summaryEdit: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.softGreen,
    },
    metaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: space.sm,
    },
    metaItem: { width: "48%", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    metaText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
    trendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    trendText: { fontSize: 11.5, fontWeight: "600", color: colors.textSecondary },
    healthRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    healthChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        paddingHorizontal: space.sm,
        paddingVertical: 4,
        maxWidth: "100%",
    },
    healthChipWarning: { backgroundColor: colors.dangerBg },
    healthChipText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
    healthChipTextWarning: { fontSize: 11, fontWeight: "700", color: colors.danger, flexShrink: 1 },

    // Needs Attention
    attentionCard: {
        backgroundColor: colors.dangerBg,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.danger,
        padding: space.md,
        marginBottom: space.lg,
    },
    attentionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.xs },
    attentionTitle: { fontSize: 13, fontWeight: "800", color: colors.danger },
    attentionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 6,
    },
    attentionText: { fontSize: 12.5, fontWeight: "600", color: colors.text, flex: 1 },
    attentionMoreText: { fontSize: 12.5, fontWeight: "700", color: colors.danger, flex: 1 },

    // Today's feeding summary
    feedingCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: space.md,
        marginBottom: space.lg,
        gap: space.md,
        ...shadow.card,
    },
    feedingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.softGreen,
        alignItems: "center",
        justifyContent: "center",
    },
    feedingLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
    feedingSub: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: 1 },

    // Section heading
    sectionHeadingFlush: { fontSize: 16, fontWeight: "800", color: colors.text },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.md,
    },
    seeAllText: { fontSize: 12.5, fontWeight: "700", color: colors.accentStrong },

    // Vaccination progress
    progressCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: space.md,
        marginBottom: space.md,
        ...shadow.card,
    },
    progressHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.sm },
    progressTitle: { fontSize: 13, fontWeight: "800", color: colors.text, flex: 1 },
    progressCount: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.surfaceAlt,
        overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },

    // Upcoming appointment
    upcomingCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.softGreen,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: space.md,
        marginBottom: space.lg,
        gap: space.md,
    },
    upcomingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    upcomingLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
    upcomingSub: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: 1 },

    // Milestone Memories gallery
    gallerySection: { marginBottom: space.lg },
    galleryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.md,
    },
    galleryHeaderActions: { flexDirection: "row", alignItems: "center", gap: space.md },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    galleryCard: {
        width: "48%",
        aspectRatio: 1,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: colors.surfaceAlt,
        marginBottom: space.md,
        ...shadow.soft,
    },
    galleryImg: { width: "100%", height: "100%", position: "absolute" },
    galleryPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.softGreen },
    galleryScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,25,23,0.30)" },
    galleryOverlay: { ...StyleSheet.absoluteFillObject, padding: space.md, justifyContent: "flex-end" },
    galleryTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    galleryDate: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "600", marginTop: 1 },
    addPill: {
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
    addPillText: { color: colors.onAccent, fontWeight: "800", fontSize: 12 },

    // Recent Activity
    activityCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        marginBottom: space.lg,
        overflow: "hidden",
        ...shadow.card,
    },
    activityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space.md,
        paddingHorizontal: space.md,
    },
    activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    activityLeft: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    activityTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    activitySubtitle: { fontSize: 12, fontWeight: "500", color: colors.textMuted, marginTop: 1 },
    activityTime: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginLeft: space.sm },

    // Add Memory modal
    choosePhotoBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 48,
        borderRadius: radius.md,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.softGreen,
        marginBottom: space.sm,
    },
    choosePhotoText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(28,25,23,0.55)",
        justifyContent: "center",
        alignItems: "center",
        padding: space.xl,
    },
    modalCard: {
        backgroundColor: colors.background,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.xl,
        width: "100%",
        maxWidth: 360,
        borderWidth: 1,
        borderColor: colors.hairline,
        ...shadow.raised,
    },
    modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: space.lg },
    modalLabel: {
        fontSize: 11,
        fontWeight: "800",
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        height: 48,
        fontSize: 15,
        color: colors.text,
        marginBottom: space.lg,
    },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: space.md },
    modalCancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    modalCancelText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    modalSaveBtn: {
        paddingVertical: 12,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.accentStrong,
        ...shadow.accent,
    },
    modalSaveText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
});
