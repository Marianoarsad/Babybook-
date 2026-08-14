import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Pressable,
    ScrollView,
    TextInput,
    Modal,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { EmptyStateCard, SectionContainerCard, MemoryVisualCard } from "./common/Cards";
import MemoryDetail from "./MemoryDetail";
import GrowthChart from "./GrowthChart";
import { DashboardSkeleton } from "./ui/Skeleton";
import Button from "./ui/Button";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { api } from "../utils/api";
import { memoryToApp, toMilliliters } from "../utils/adapters";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";
import { useRefreshControl } from "./ui/useRefreshControl";
import { cacheSummary } from "../utils/offlineSummary";
import { seen, markSeen } from "../utils/firstRun";

// Age in a friendly form ("15 months", "2y 3m") from a YYYY-MM-DD DOB.
export function ageText(dob) {
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

// "in N min" / "in N h" for a share code's expiration_date — mirrors
// ShareRecords.js's own expiryText helper (share codes are short-lived: 15
// min, 1 hour, or 24 hours, never longer, so minutes/hours cover every case).
function shareExpiryText(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "expired";
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `in ${mins} min`;
    return `in ${Math.round(mins / 60)} h`;
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

// Local, minimal — theme colors are 6-digit hex today. Guards against a
// future non-hex token by passing it through unmodified instead of
// concatenating garbage onto it. (The same color+"1A" pattern exists in
// AllActivity.js / CalendarView.js / Button.js — out of scope here.)
const withAlpha = (hex, alphaHex) =>
    typeof hex === "string" && hex.startsWith("#") ? hex + alphaHex : hex;

// Runs `loader(isActive)` whenever `deps` change, tracking loading/error
// uniformly and exposing retry(). `loader` receives isActive() so it can bail
// out on stale results exactly like a manual `if (!active) return;` guard
// would — this only centralizes that bookkeeping across Dashboard's three
// fetches, it doesn't change what each one fetches.
function useDashboardFetch(loader, deps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nonce, setNonce] = useState(0);
    const activeRef = useRef(true);
    useEffect(() => {
        activeRef.current = true;
        setLoading(true);
        setError(null);
        loader(() => activeRef.current)
            .catch((e) => {
                if (activeRef.current) {
                    setError(e?.message || "Couldn't load. Check your connection and try again.");
                }
            })
            .finally(() => {
                if (activeRef.current) setLoading(false);
            });
        return () => {
            activeRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, nonce]);
    return { loading, error, retry: useCallback(() => setNonce((n) => n + 1), []) };
}

export default function Dashboard({
    profile,
    profiles,
    parentName,
    onSelectProfile,
    onOpenAddModal,
    onOpenEditModal,
    onChangeView,
    initialAction,
    navKey,
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
    const [nextVax, setNextVax] = useState(null);
    const [overdueVax, setOverdueVax] = useState([]);
    const [ongoingConcern, setOngoingConcern] = useState([]);
    const [todayFeeding, setTodayFeeding] = useState(null);
    const [activeShares, setActiveShares] = useState([]);
    const [summaryExpanded, setSummaryExpanded] = useState(false);
    // Tracks profile IDs whose avatar URL is present but failed to actually
    // load — e.g. an upload that's since been wiped (see PRODUCT.md's known
    // gap: uploads sit on an ephemeral filesystem). A truthy-but-dead URL
    // otherwise slips past the `avatarUrl ? Image : fallback` check below and
    // renders as a blank circle instead of the fallback it was meant to show.
    const [brokenAvatars, setBrokenAvatars] = useState(() => new Set());
    const loadActivityBundle = useCallback(async (isActive) => {
        const failed = [];
        const safe = (p, label) =>
            p.catch((e) => {
                failed.push(label);
                return [];
            });
        const [vax, checkups, nutrition, milestones, medHistory, events, shares] = await Promise.all([
            safe(api.listRecords(profile.id, "vaccinations"), "vaccinations"),
            safe(api.listRecords(profile.id, "checkups"), "checkups"),
            safe(api.listRecords(profile.id, "nutrition"), "nutrition"),
            safe(api.listRecords(profile.id, "milestones"), "milestones"),
            safe(api.listRecords(profile.id, "medical-history"), "medical-history"),
            // Custom calendar events — only exist once the calendar_events
            // migration has run (CLAUDE.md, "Pending user action"). `safe()`
            // keeps the rest of the dashboard working either way, while still
            // letting a genuine outage surface below instead of being hidden.
            safe(api.listRecords(profile.id, "calendar-events"), "calendar-events"),
            safe(api.listShares(profile.id), "shares"),
        ]);
        if (!isActive()) return;

        // Cache a flattened offline-consultation summary from the data this
        // load already fetched — no extra request. Best-effort: a parent
        // opening the app with a live connection should always leave with a
        // fresh copy on the device, ready for the next time they don't have one.
        cacheSummary(profile, { vaccinations: vax, checkups, medicalHistory: medHistory }).catch(() => {});

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

                // Soonest dose still to be given. Same filter the upcoming-appointment
                // box uses for vaccinations (above) — overdue doses are deliberately
                // excluded, they're the Needs Attention strip's job.
                setNextVax(
                    (vax || [])
                        .filter((v) => v.status !== "completed" && v.due_date && v.due_date >= todayStr)
                        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null,
                );

                // Needs Attention: vaccinations past their due date and still
                // not given, plus illnesses and hospitalizations not yet
                // marked resolved (a current hospital stay is at least as
                // urgent as an illness, so it belongs in the same strip).
                setOverdueVax(
                    (vax || [])
                        .filter((v) => v.status !== "completed" && v.due_date && v.due_date < todayStr)
                        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
                );
                setOngoingConcern(
                    (medHistory || []).filter(
                        (m) => (m.category === "Illness" || m.category === "Hospitalization") && !m.resolved,
                    ),
                );

                // Active share codes — reuses the same shares list Share
                // Records shows, just narrowed to ones still open right now.
                const nowIso = new Date().toISOString();
                setActiveShares(
                    (shares || []).filter((s) => s.status === "active" && s.expiration_date > nowIso),
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
        if (failed.length) {
            // Some sources didn't load — the dashboard still shows whatever
            // did, but this keeps "failed to load" from reading identically
            // to "this child genuinely has no history yet".
            throw new Error("Some records may not be up to date. Retry to refresh.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id]);
    const {
        loading: activityLoading,
        error: activityError,
        retry: retryActivity,
    } = useDashboardFetch(loadActivityBundle, [profile.id]);

    // Growth history — separate fetch, since nothing else on this screen
    // needs the measurement history. Kept raw (growthRows) for the chart, on
    // top of the computed faster/slower verdict (trend) the summary card uses.
    const [trend, setTrend] = useState(null);
    const [growthRows, setGrowthRows] = useState([]);
    const loadGrowth = useCallback(async (isActive) => {
        const rows = await api.listRecords(profile.id, "growth");
        if (!isActive()) return;
        setTrend(growthTrend(rows));
        setGrowthRows(rows || []);
    }, [profile.id]);
    const {
        loading: growthLoading,
        error: growthError,
        retry: retryGrowth,
    } = useDashboardFetch(loadGrowth, [profile.id]);

    // Photo memories load from and persist to the backend.
    const [memories, setMemories] = useState([]);
    const [detailMemory, setDetailMemory] = useState(null);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [memCaption, setMemCaption] = useState("");
    const [memNotes, setMemNotes] = useState("");
    const [memPhotoUri, setMemPhotoUri] = useState("");
    const [savingMemory, setSavingMemory] = useState(false);
    const loadMemories = useCallback(async (isActive) => {
        const rows = await api.listRecords(profile.id, "memories");
        if (!isActive()) return;
        setMemories(rows.map(memoryToApp));
    }, [profile.id]);
    const {
        loading: memoriesLoading,
        error: memoriesError,
        retry: retryMemories,
    } = useDashboardFetch(loadMemories, [profile.id]);

    const dashboardLoading = activityLoading || growthLoading || memoriesLoading;
    const dashboardError = activityError || growthError || memoriesError;
    const retryAll = () => {
        retryActivity();
        retryGrowth();
        retryMemories();
    };
    const refreshControl = useRefreshControl(dashboardLoading, retryAll);

    // Arriving here from the floating log button's "Add Memory" choice opens
    // the form automatically, the same pattern NutritionTracker.js uses for
    // its own "Log Milk"/"Log Food" shortcuts.
    useEffect(() => {
        if (initialAction === "memory") setShowMemoryModal(true);
    }, [navKey]);

    const handleAddMemory = async () => {
        if (!memCaption.trim()) {
            toast.error("Please enter a caption");
            return;
        }
        const caption = memCaption;
        const notes = memNotes;
        const photoUri = memPhotoUri;
        const date_recorded = new Date().toISOString().split("T")[0];
        setSavingMemory(true);
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
            // Only clear the form and close on success — on failure the user's
            // typed caption/notes/photo stay in place instead of vanishing.
            setShowMemoryModal(false);
            setMemCaption("");
            setMemNotes("");
            setMemPhotoUri("");
        } catch (e) {
            toast.error(e.message || "Could not save memory");
        } finally {
            setSavingMemory(false);
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

    // Setup checklist — completion is derived from state this screen already
    // loads, no extra fetches and no per-item flags that could drift out of
    // sync. "immunizations" is the plain tab-switch key (not "vaccine", which
    // also opens the add-vaccine form — see CLAUDE.md Section 7); the
    // checklist wants the tab, not a form.
    const setupItems = [
        { key: "child", label: "Add your child's profile", done: true },
        { key: "growth", label: "Record a growth measurement", done: growthRows.length > 0, onPress: () => nav("growth", "metrics") },
        { key: "vaccine", label: "Mark a vaccine as given", done: !!vaxProgress && vaxProgress.completed > 0, onPress: () => nav("health", "immunizations") },
        { key: "share", label: "Share records with a doctor", done: activeShares.length > 0, onPress: () => nav("share") },
    ];
    const setupDoneCount = setupItems.filter((i) => i.done).length;
    const setupComplete = setupDoneCount === setupItems.length;
    // null = still checking storage (see effect below), true = hidden
    // (dismissed or already completed once), false = show it.
    const [setupDismissed, setSetupDismissed] = useState(null);
    useEffect(() => {
        seen("setup").then(setSetupDismissed);
    }, []);
    // Once every item is done, mark it seen for good — otherwise a share
    // expiring later (activeShares empties out) would drop setupComplete
    // back to false and resurrect a checklist the parent already finished.
    useEffect(() => {
        if (setupComplete && setupDismissed === false) {
            markSeen("setup");
            setSetupDismissed(true);
        }
    }, [setupComplete, setupDismissed]);
    const dismissSetup = () => {
        setSetupDismissed(true);
        markSeen("setup");
    };
    const showSetupCard = setupDismissed === false && !setupComplete;

    // Gender is icon-only now — the word next to it used to repeat exactly
    // what the icon already showed (evaluation doc, Section 2). The
    // accessibility label keeps the information available to screen readers.
    const sexLabel = profile.gender === "boy" ? "Male" : "Female";
    const fmt = (n, delta) =>
        delta != null ? `${n} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)})` : `${n}`;
    const babyMeta = [
        { icon: profile.gender === "boy" ? "male" : "female", text: null, a11y: sexLabel },
        { icon: "time-outline", text: ageText(profile.dateOfBirth) || "—", a11y: null },
        {
            icon: "scale-outline",
            text: weight != null ? `${fmt(weight, trend ? trend.weightDelta : null)} kg` : "No weight recorded",
            a11y: null,
        },
        {
            icon: "resize-outline",
            text: height != null ? `${fmt(height, trend ? trend.heightDelta : null)} cm` : "No height recorded",
            a11y: null,
        },
    ];
    if (headCirc != null) {
        babyMeta.push({ icon: "ellipse-outline", text: `${Number(headCirc)} cm head`, a11y: null });
    }

    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };
    const vaxPct = vaxProgress && vaxProgress.total > 0 ? Math.round((vaxProgress.completed / vaxProgress.total) * 100) : 0;
    const hasAllergies = Array.isArray(profile.allergies) && profile.allergies.length > 0;
    // Capped at 1 — only the most urgent item shows, to keep this strip as
    // small as possible; a demo/seeded account can rack up a dozen overdue
    // doses, and a wall of rows here would recreate the crowding this
    // redesign was meant to fix.
    const attentionItems = [
        ...overdueVax.map((v) => ({
            key: `ovax-${v.id}`,
            text: `${v.vaccine_name || "Vaccination"} was due ${v.due_date}`,
            tab: "immunizations",
        })),
        ...ongoingConcern.map((m) => ({
            key: `concern-${m.id}`,
            text:
                m.category === "Hospitalization"
                    ? `Hospitalized: ${m.title || "Hospitalization"}`
                    : `Ongoing: ${m.title || "Illness"}`,
            tab: "illnesses",
        })),
    ];
    const hasNeedsAttention = attentionItems.length > 0;
    const soonestShare = activeShares.length
        ? activeShares.slice().sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))[0]
        : null;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: space.xxl }}
            refreshControl={refreshControl}
        >
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
                            <Pressable
                                key={p.id}
                                onPress={() => onSelectProfile(p.id)}
                                style={({ pressed, hovered, focused }) => [
                                    styles.profileTab,
                                    profile.id === p.id && styles.profileTabActive,
                                    { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                                    focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.accent, "59")}` } : null,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Switch to ${p.name}`}
                            >
                                {p.avatarUrl && !brokenAvatars.has(p.id) ? (
                                    <Image
                                        source={{ uri: p.avatarUrl }}
                                        style={styles.avatarMini}
                                        onError={() => setBrokenAvatars((prev) => new Set(prev).add(p.id))}
                                    />
                                ) : (
                                    <View style={[styles.avatarMini, styles.avatarFallback]}>
                                        <Ionicons name="person" size={16} color={colors.primary} />
                                    </View>
                                )}
                            </Pressable>
                        ))}
                        <TouchableOpacity
                            onPress={onOpenAddModal}
                            style={styles.addProfileIconButton}
                            accessibilityRole="button"
                            accessibilityLabel="Add another child"
                        >
                            <Ionicons name="add" size={20} color={colors.primary} />
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

            {dashboardError ? (
                <TouchableOpacity
                    style={styles.errorBanner}
                    onPress={retryAll}
                    accessibilityRole="button"
                    accessibilityLabel={`${dashboardError} Tap to retry.`}
                >
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.errorBannerText}>{dashboardError}</Text>
                    <Text style={styles.errorBannerRetry}>Retry</Text>
                </TouchableOpacity>
            ) : null}

            {dashboardLoading ? (
                <DashboardSkeleton />
            ) : (
                <>
            {/* Needs Attention — only renders when something actually needs it,
                so a normal day still looks calm. Medications are deliberately
                left out: the medication record has no start/end date or
                resolved flag, so "currently taking this" can't be worked out
                reliably from the data as it stands. */}
            {/* Zero-data rule for this screen's sections:
                 - Always-present habitual-log cards (Feeding) show an inline
                   zero-state CTA inside the same persistent card.
                 - List/gallery sections (Milestone Memories, Recent Activity)
                   show EmptyStateCard, DESIGN.md's dedicated empty-state
                   surface.
                 - Occasional call-out cards (Upcoming, Vaccination Progress,
                   Needs Attention, Active Share) render nothing when there's
                   nothing to say — that's intentional, not a bug: a permanent
                   "no upcoming appointment" card would manufacture urgency on
                   an ordinary day. */}
            {/* Setup checklist — one-time, first-run guidance for a brand-new
                account. Dismissible, and removes itself for good once every
                item is done (see the effect above) or the parent taps close. */}
            {showSetupCard ? (
                <View style={styles.setupCard}>
                    <View style={styles.setupHeader}>
                        <Text style={styles.setupTitle}>
                            Get started — {setupDoneCount} of {setupItems.length}
                        </Text>
                        <TouchableOpacity
                            onPress={dismissSetup}
                            accessibilityRole="button"
                            accessibilityLabel="Dismiss setup checklist"
                            hitSlop={8}
                            style={styles.setupCloseBtn}
                        >
                            <Ionicons name="close" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                    {setupItems.map((item) => (
                        <TouchableOpacity
                            key={item.key}
                            disabled={item.done || !item.onPress}
                            onPress={item.onPress}
                            style={styles.setupRow}
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                            accessibilityState={{ disabled: item.done || !item.onPress }}
                        >
                            <Ionicons
                                name={item.done ? "checkmark-circle" : "ellipse-outline"}
                                size={18}
                                color={item.done ? colors.success : colors.textMuted}
                            />
                            <Text style={[styles.setupRowText, item.done && styles.setupRowTextDone]}>
                                {item.label}
                            </Text>
                            {!item.done ? (
                                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                            ) : null}
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}

            {/* Offline Summary — always visible, not conditional on a failed
                fetch. A parent needs to prepare this at home while there's
                still signal, not discover it only after the connection has
                already failed them at the clinic. */}
            <Pressable
                style={({ pressed, hovered, focused }) => [
                    styles.offlineCard,
                    { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                    focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                ]}
                onPress={() => nav("offlineSummary")}
                accessibilityRole="button"
                accessibilityLabel="View offline consultation summary"
            >
                <View style={styles.offlineIcon}>
                    <Ionicons name="cloud-offline-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.offlineLabel}>Offline Summary</Text>
                    <Text style={styles.offlineSub}>Works without signal — worth opening once while you have it</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>

            {hasNeedsAttention ? (
                <View style={styles.attentionCard}>
                    <View style={styles.attentionHeader}>
                        <Ionicons name="warning" size={16} color={colors.danger} />
                        <Text style={styles.attentionTitle}>Needs Attention</Text>
                    </View>
                    {attentionItems.slice(0, 1).map((item) => (
                        <Pressable
                            key={item.key}
                            style={({ pressed, hovered, focused }) => [
                                styles.attentionRow,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.danger, "59")}` } : null,
                            ]}
                            onPress={() => nav("health", item.tab)}
                            accessibilityRole="button"
                            accessibilityLabel={item.text}
                        >
                            <Text style={styles.attentionText}>{item.text}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </Pressable>
                    ))}
                    {attentionItems.length > 1 ? (
                        <Pressable
                            style={({ pressed, hovered, focused }) => [
                                styles.attentionRow,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.danger, "59")}` } : null,
                            ]}
                            onPress={() => nav("health")}
                            accessibilityRole="button"
                            accessibilityLabel={`${attentionItems.length - 1} more items need attention`}
                        >
                            <Text style={styles.attentionMoreText}>+{attentionItems.length - 1} more</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            {/* Active share-code notice — easy to generate a code in Share
                Records and forget it's still open, so this surfaces it here
                too. Its own card (not merged into Needs Attention above) so
                it still shows on an ordinary day with nothing overdue. Only
                renders when at least one code is active. */}
            {soonestShare ? (
                <Pressable
                    style={({ pressed, hovered, focused }) => [
                        styles.shareCard,
                        { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                        focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.info, "59")}` } : null,
                    ]}
                    onPress={() => nav("share")}
                    accessibilityRole="button"
                    accessibilityLabel={`${activeShares.length} share code${activeShares.length === 1 ? "" : "s"} active`}
                >
                    <View style={styles.shareIcon}>
                        <Ionicons name="qr-code-outline" size={18} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.shareLabel}>
                            {activeShares.length} share code{activeShares.length === 1 ? "" : "s"} active
                        </Text>
                        <Text style={styles.shareSub}>
                            {activeShares.length === 1 ? "Expires" : "Next expires"}{" "}
                            {shareExpiryText(soonestShare.expiration_date)}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.info} />
                </Pressable>
            ) : null}

            {/* Baby Summary Card — 2-column meta grid. The photo and name
                already show in the header and (with more than one child)
                the switcher above, so this card doesn't repeat them.
                Collapsed by default to just gender/age/weight/height; tap
                anywhere on the card to reveal head circumference, the
                growth-pace line, and the allergy/blood-type chips. */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryTopRow}>
                    <Pressable
                        onPress={() => setSummaryExpanded((v) => !v)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${summaryExpanded ? "Collapse" : "Expand"} ${profile.name}'s summary`}
                        accessibilityState={{ expanded: summaryExpanded }}
                    >
                        <Ionicons
                            name={summaryExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={colors.textMuted}
                        />
                    </Pressable>
                    <TouchableOpacity
                        onPress={onOpenEditModal}
                        style={styles.summaryEdit}
                        accessibilityRole="button"
                        accessibilityLabel="Edit child profile"
                    >
                        <Ionicons name="pencil" size={15} color={colors.primary} />
                    </TouchableOpacity>
                </View>
                {/* A separate touchable from the chevron above — not nested
                    inside it — so no button ever contains another button
                    (React Native Web renders TouchableOpacity as <button>,
                    and a nested <button> is invalid HTML and threw a
                    hydration error). Tapping the chevron OR this body both
                    toggle the same summaryExpanded state. */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSummaryExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={`${summaryExpanded ? "Collapse" : "Expand"} ${profile.name}'s summary details`}
                    accessibilityState={{ expanded: summaryExpanded }}
                >
                    <View style={styles.metaGrid}>
                        {(summaryExpanded ? babyMeta : babyMeta.slice(0, 4)).map((m, idx) => (
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
                    {summaryExpanded && trend && trend.pace ? (
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
                    {summaryExpanded && (hasAllergies || profile.bloodType) ? (
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
                </TouchableOpacity>
            </View>

            {/* Growth chart — reuses the same growth history already fetched
                for the faster/slower verdict above. Sex and date of birth are
                what let it draw the WHO reference bands; without them it still
                plots the child's own line. */}
            <GrowthChart
                rows={growthRows}
                sex={profile?.sex || profile?.gender}
                dateOfBirth={profile?.dateOfBirth}
                loading={growthLoading}
            />

            {/* Upcoming appointment — the only way to Calendar from this screen. */}
            {upcoming ? (
                <Pressable
                    style={({ pressed, hovered, focused }) => [
                        styles.upcomingCard,
                        { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                        focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                    ]}
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
                </Pressable>
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
                    {nextVax && upcoming?.key !== `vax-${nextVax.id}` ? (
                        <Pressable
                            style={({ pressed, hovered, focused }) => [
                                styles.nextVaxRow,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                            ]}
                            onPress={() => nav("health", "immunizations")}
                            accessibilityRole="button"
                            accessibilityLabel={`Next vaccine: ${nextVax.vaccine_name || "Vaccination"}, due ${nextVax.due_date}`}
                        >
                            <Ionicons name="medkit-outline" size={15} color={colors.recVaccine.on} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.nextVaxLabel}>
                                    Next vaccine: {nextVax.vaccine_name || "Vaccination"}
                                </Text>
                                <Text style={styles.nextVaxSub}>
                                    {nextVax.due_date}
                                    {nextVax.visit_name ? ` · ${nextVax.visit_name}` : ""}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            {/* Today's feeding summary — reuses nutrition rows already loaded
                for Recent Activity. */}
            <Pressable
                style={({ pressed, hovered, focused }) => [
                    styles.feedingCard,
                    { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                    focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                ]}
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
            </Pressable>

            {/* Photo Memories — square photo gallery. Adding a memory now
                lives in the floating log button's menu, alongside Log Milk,
                Log Food, etc., instead of a second add button here. */}
            <SectionContainerCard
                title="Milestone Memories"
                action={
                    <TouchableOpacity
                        onPress={() => nav("growth", "gallery")}
                        accessibilityRole="button"
                        accessibilityLabel="See all photo memories"
                    >
                        <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                }
            >
                {memories.length ? (
                    <View style={styles.galleryGrid}>
                        {memories.slice(0, 4).map((m, idx) => (
                            <MemoryVisualCard
                                key={m.id || idx}
                                title={m.title}
                                description={m.description}
                                date={m.date}
                                photoUrl={m.photoUrl}
                                onClick={() => setDetailMemory(m)}
                                style={styles.galleryTile}
                            />
                        ))}
                    </View>
                ) : (
                    <EmptyStateCard message="No memories yet. Tap Add to save your baby's precious moments." icon="image-outline" />
                )}
            </SectionContainerCard>

            {/* Recent Activity — moved to the bottom of the screen; the sections
                above answer "does anything need attention or action" first. */}
            <SectionContainerCard
                title="Recent Activity"
                action={
                    <TouchableOpacity
                        onPress={() => nav("allActivity")}
                        accessibilityRole="button"
                        accessibilityLabel="See all activity"
                    >
                        <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                }
            >
                {activity.length ? (
                    activity.map((a, idx) => {
                        const tone = toneColor[a.tone] || colors.primary;
                        return (
                            <View
                                key={a.key}
                                style={[styles.activityRow, idx < activity.length - 1 && styles.activityRowBorder]}
                            >
                                <View style={styles.activityLeft}>
                                    <View style={[styles.activityIcon, { backgroundColor: withAlpha(tone, "1A") }]}>
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
                    })
                ) : (
                    <EmptyStateCard message="No recent activity yet." icon="time-outline" />
                )}
            </SectionContainerCard>
                </>
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
                            <Button
                                title={t("cancel")}
                                variant="secondary"
                                fullWidth={false}
                                disabled={savingMemory}
                                onPress={() => setShowMemoryModal(false)}
                            />
                            <Button
                                title={t("save")}
                                variant="accent"
                                fullWidth={false}
                                loading={savingMemory}
                                onPress={handleAddMemory}
                            />
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
        padding: space.xs,
        marginRight: space.sm,
        ...shadow.card,
    },
    profileTabActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },
    avatarMini: { width: 32, height: 32, borderRadius: 16, borderCurve: "continuous" },
    avatarFallback: { backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" },
    addProfileButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.softGreen,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        minHeight: 44,
    },
    // Icon-only version, used in the multi-child switcher row where photos
    // already fill that role and a text label would just repeat "add".
    addProfileIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.softGreen,
        borderWidth: 1,
        borderColor: colors.border,
    },
    addProfileText: { ...type.label, color: colors.primaryDark, marginLeft: 3 },

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
    summaryTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    summaryEdit: {
        width: 30,
        height: 30,
        borderRadius: radius.pill,
        borderCurve: "continuous",
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
    metaItem: { width: "48%", flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
    metaText: { ...type.caption, color: colors.textSecondary },
    trendRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 4 },
    trendText: { ...type.caption, color: colors.textSecondary },
    healthRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 8 },
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
    healthChipText: { ...type.caption, color: colors.textSecondary },
    healthChipTextWarning: { ...type.caption, color: colors.danger, flexShrink: 1 },

    // Error banner — shown when a fetch genuinely failed, so a network outage
    // never looks identical to "this child has no records yet".
    errorBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: colors.dangerBg,
        borderWidth: 1,
        borderColor: colors.danger,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        padding: space.md,
        marginBottom: space.lg,
    },
    errorBannerText: { ...type.caption, color: colors.text, flex: 1 },
    errorBannerRetry: { ...type.caption, color: colors.danger },

    // Needs Attention
    attentionCard: {
        backgroundColor: colors.dangerBg,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.danger,
        padding: space.md,
        marginBottom: space.lg,
        ...shadow.card,
    },
    attentionHeader: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
    attentionTitle: { ...type.label, color: colors.danger },
    attentionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space.sm,
    },
    attentionText: { ...type.caption, color: colors.text, flex: 1 },
    attentionMoreText: { ...type.label, color: colors.danger, flex: 1 },

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
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.softGreen,
        alignItems: "center",
        justifyContent: "center",
    },
    feedingLabel: { ...type.bodyStrong, color: colors.text },
    feedingSub: { ...type.caption, color: colors.textSecondary, marginTop: space.xs },

    // Active share-code notice — teal/info tint so it's clearly noticeable
    // next to the plain white cards around it, without reading as a medical
    // alert the way the red Needs Attention card above it does.
    shareCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: withAlpha(colors.info, "14"),
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.info,
        padding: space.md,
        marginBottom: space.lg,
        gap: space.md,
        ...shadow.card,
    },
    shareIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: withAlpha(colors.info, "22"),
        alignItems: "center",
        justifyContent: "center",
    },
    shareLabel: { ...type.bodyStrong, color: colors.info },
    shareSub: { ...type.caption, color: colors.info },

    // Offline Summary entry point — primary-tinted so it reads as a normal
    // navigation card, not an alert (it's always shown, unlike the two above).
    offlineCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: withAlpha(colors.primary, "10"),
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.primary,
        padding: space.md,
        marginBottom: space.lg,
        gap: space.md,
        ...shadow.card,
    },
    offlineIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: withAlpha(colors.primary, "18"),
        alignItems: "center",
        justifyContent: "center",
    },
    offlineLabel: { ...type.bodyStrong, color: colors.primary },
    offlineSub: { ...type.caption, color: colors.textMuted },

    // Setup checklist
    setupCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.md,
        marginBottom: space.lg,
        ...shadow.card,
    },
    setupHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.sm,
    },
    setupTitle: { ...type.bodyStrong, color: colors.text },
    setupCloseBtn: {
        width: MIN_TOUCH * 0.6,
        height: MIN_TOUCH * 0.6,
        alignItems: "center",
        justifyContent: "center",
    },
    setupRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.sm,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
    },
    setupRowText: { ...type.body, color: colors.text, flex: 1 },
    setupRowTextDone: { color: colors.textMuted, textDecorationLine: "line-through" },

    // Section heading
    seeAllText: { ...type.label, color: colors.accentStrong },

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
    progressHeader: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
    progressTitle: { ...type.label, color: colors.text, flex: 1 },
    progressCount: { ...type.caption, color: colors.textMuted },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
        overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 4, borderCurve: "continuous", backgroundColor: colors.primary },
    nextVaxRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginTop: space.md,
        paddingTop: space.md,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
    },
    nextVaxLabel: { ...type.label, color: colors.text },
    nextVaxSub: { ...type.caption, color: colors.textSecondary, marginTop: 2 },

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
        ...shadow.card,
    },
    upcomingIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    upcomingLabel: { ...type.bodyStrong, color: colors.text },
    upcomingSub: { ...type.caption, color: colors.textSecondary, marginTop: space.xs },

    // Milestone Memories gallery — the tiles themselves are MemoryVisualCard
    // (common/Cards.js), whose photo frame is already a self-scaling square;
    // this just sets the 2-column tile width, no height override needed —
    // the caption below the frame needs its own natural height.
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    galleryTile: { width: "48%", marginBottom: space.md },

    // Recent Activity — rows only; the wrapping card now comes from
    // SectionContainerCard (common/Cards.js).
    // No horizontal padding here — SectionContainerCard now supplies it.
    activityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space.md,
    },
    activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    activityLeft: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    activityTitle: { ...type.bodyStrong, color: colors.text },
    activitySubtitle: { ...type.caption, color: colors.textMuted, marginTop: space.xs },
    activityTime: { ...type.caption, color: colors.textMuted, marginLeft: space.sm },

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
    choosePhotoText: { ...type.label, color: colors.primaryDark },
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
    modalTitle: { ...type.title, color: colors.text, marginBottom: space.lg },
    modalLabel: {
        ...type.subheading,
        color: colors.textMuted,
        marginBottom: space.sm,
    },
    modalInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        height: 48,
        fontSize: type.body.fontSize,
        fontFamily: type.body.fontFamily,
        color: colors.text,
        marginBottom: space.lg,
    },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: space.md },
});
