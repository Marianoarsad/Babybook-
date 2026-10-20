import MemoriesMilestonesCard from "./ui/MemoriesMilestonesCard";
import RecordIcon from "./ui/RecordIcon";
import SolidFoodIcon from "./ui/SolidFoodIcon";
import MilkIcon from "./ui/MilkIcon";
import FeedingTodayCard from "./ui/FeedingTodayCard";
import BabyProfileCard from "./ui/BabyProfileCard";
import NeedsAttentionCard from "./ui/NeedsAttentionCard";
import VaccinationProgressCard from "./ui/VaccinationProgressCard";
import VaccineIcon from "./ui/VaccineIcon";
import { recordItemStyle } from "../theme";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    ScrollView,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { EmptyStateCard, SectionContainerCard } from "./common/Cards";
import MemoryDetail from "./MemoryDetail";
import GrowthChart from "./GrowthChart";
import Gradient from "./ui/Gradient";
import { DashboardSkeleton } from "./ui/Skeleton";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useTheme } from "../context/ThemeContext";
import { api } from "../utils/api";
import { useRecords, useRecordCache, useScreenRefresh } from "../utils/useRecords";
import { memoryToApp, nutritionToApp, feedRowSummary } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import PullToRefreshScrollView from "./ui/PullToRefreshScrollView";
import { seen, markSeen } from "../utils/firstRun";
import { todayLocal, nowLocalTime, shortDate, shortTime, durationText, recentDateRange } from "../utils/dates";
import { todayNutritionStats, todayFeedingMix } from "../utils/feedingStats";
import { ageText, latestProfileMeasurements } from "../utils/babyProfile";

// Age in a friendly form ("15 months", "2y 3m") from a YYYY-MM-DD DOB.
export { ageText } from "../utils/babyProfile";

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

// "3 days overdue" / "5 months overdue" from a due date. The card used to
// print the raw due date ("was due 2025-09-27") and leave the parent to work
// out how late that is — which is the only part of it that drives a decision.
function overdueText(dueDate) {
    const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00`);
    if (isNaN(due.getTime())) return "";
    const days = Math.floor((Date.now() - due.getTime()) / 86400000);
    if (days < 0) return "";
    if (days === 0) return "Due today";
    if (days === 1) return "1 day overdue";
    if (days < 14) return `${days} days overdue`;
    if (days < 60) {
        const w = Math.round(days / 7);
        return `${w} week${w === 1 ? "" : "s"} overdue`;
    }
    if (days < 365) {
        const mo = Math.round(days / 30.4375);
        return `${mo} month${mo === 1 ? "" : "s"} overdue`;
    }
    const y = Math.floor(days / 365.25);
    return `${y} year${y === 1 ? "" : "s"} overdue`;
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

// Local, minimal — theme colors are 6-digit hex today. Guards against a
// future non-hex token by passing it through unmodified instead of
// concatenating garbage onto it. (The same color+"1A" pattern exists in
// AllActivity.js / CalendarView.js / Button.js — out of scope here.)
const withAlpha = (hex, alphaHex) =>
    typeof hex === "string" && hex.startsWith("#") ? hex + alphaHex : hex;


export default function Dashboard({
    profile,
    parentName,
    onOpenEditModal,
    onChangeView,
    initialScrollOffset,
    onScrollRestored,
}) {
    const { t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const toast = useToast();

    // Recent Activity, vaccination progress,
    // the Needs Attention strip, and today's feeding summary all come from
    // the same vaccination/checkup/nutrition/milestone/illness/event fetch —
    // one request per record type, no duplicated network calls.
    const [activity, setActivity] = useState([]);
    const [vaxProgress, setVaxProgress] = useState(null);
    const [nextVax, setNextVax] = useState(null);
    const [overdueVax, setOverdueVax] = useState([]);
    const [ongoingConcern, setOngoingConcern] = useState([]);
    const [activeShares, setActiveShares] = useState([]);
    const [attentionCollapsed, setAttentionCollapsed] = useState(false);
    const [nutritionClock, setNutritionClock] = useState(nowLocalTime);
    const homeScrollRef = useRef(null);
    const restoredScroll = useRef(false);
    const homeLayout = useRef({ viewport: 0, content: 0 });
    const vax = useRecords(profile.id, "vaccinations");
    const vaccinationCache = useRecordCache(profile.id, "vaccinations");
    const checkups = useRecords(profile.id, "checkups");
    const nutrition = useRecords(profile.id, "nutrition");
    const nutritionEntries = useMemo(() => nutrition.map(nutritionToApp), [nutrition]);
    const today = todayLocal();
    const nutritionToday = useMemo(
        () => todayNutritionStats(nutritionEntries, today, nutritionClock),
        [nutritionEntries, today, nutritionClock],
    );
    const feedingMix = useMemo(() => todayFeedingMix(nutritionEntries, today), [nutritionEntries, today]);
    const todayNutritionRows = useMemo(
        () => nutrition
            .filter((entry) => String(entry.entry_date || "").slice(0, 10) === today)
            .slice()
            .sort((a, b) => `${b.entry_date}${b.entry_time || ""}`.localeCompare(`${a.entry_date}${a.entry_time || ""}`)),
        [nutrition, today],
    );
    const latestNutrition = todayNutritionRows.slice(0, 2);
    const todayReactions = todayNutritionRows.filter(
        (entry) => entry.entry_type === "solid" && ["mild", "severe"].includes(entry.reaction_severity),
    );
    const milestones = useRecords(profile.id, "milestones");
    const medHistory = useRecords(profile.id, "medical-history");
    const [shares, setBundleShares] = useState([]);
    useEffect(() => {
        const clock = setInterval(() => setNutritionClock(nowLocalTime()), 60000);
        return () => clearInterval(clock);
    }, []);
    useEffect(() => {
        setAttentionCollapsed(false);
    }, [profile.id]);
    useEffect(() => {
        const todayStr = todayLocal();
                const items = [];
                (vax || [])
                    .filter((v) => v.status === "completed" && v.date_given)
                    .forEach((v) =>
                        items.push({
                            key: `vax-${v.id}`,
                            title: "Vaccination Logged",
                            subtitle: v.vaccine_name || "Vaccine",
                            date: String(v.date_given).slice(0, 10),
                            vaccine: true,
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
                    items.push({
                        key: `nut-${n.id}`,
                        title: "Feeding Logged",
                        subtitle: feedRowSummary(n),
                        date: String(n.entry_date).slice(0, 10),
                        icon: "restaurant",
                        solidFood: n.entry_type === "solid",
                        milkFeed: (n.entry_type || "milk") === "milk",
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
                            milestone: true,
                            tone: "info",
                        }),
                    );
                const past = items.filter((i) => i.date && i.date <= todayStr);
                past.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                setActivity(past.slice(0, 4));

                setVaxProgress({
                    completed: (vax || []).filter((v) => v.status === "completed").length,
                    total: (vax || []).length,
                });

                // Soonest dose still to be given; overdue doses belong in Needs Attention.
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
                const ongoing = (medHistory || []).filter(
                    (m) => (m.category === "Illness" || m.category === "Hospitalization") && !m.resolved,
                );
                setOngoingConcern(ongoing);

                // Active share codes — reuses the same shares list Share
                // Records shows, just narrowed to ones still open right now.
                const nowIso = new Date().toISOString();
                setActiveShares(
                    (shares || []).filter((s) => s.status === "active" && s.expiration_date > nowIso),
                );

    }, [vax, checkups, nutrition, milestones, medHistory, shares]);
    const loadActivityBundle = useCallback(async (isActive) => {
        const failed = [];
        const safe = (p, label) =>
            p.catch((e) => {
                failed.push(label);
                return [];
            });
        const [vax, checkups, nutrition, milestones, medHistory, shares] = await Promise.all([
            safe(api.listRecords(profile.id, "vaccinations", { loading: "nonblocking" }), "vaccinations"),
            safe(api.listRecords(profile.id, "checkups", { loading: "nonblocking" }), "checkups"),
            safe(api.listRecords(profile.id, "nutrition", { loading: "nonblocking" }), "nutrition"),
            safe(api.listRecords(profile.id, "milestones", { loading: "nonblocking" }), "milestones"),
            safe(api.listRecords(profile.id, "medical-history", { loading: "nonblocking" }), "medical-history"),
            safe(api.listShares(profile.id, { loading: "nonblocking" }), "shares"),
        ]);
        if (!isActive()) return;

        if (!failed.includes("shares")) setBundleShares(shares);
        if (failed.length) {
            // Some sources didn't load — the dashboard still shows whatever
            // did, but this keeps "failed to load" from reading identically
            // to "this child genuinely has no history yet".
            throw new Error("Some records may not be up to date. Retry to refresh.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id]);

    // Growth history — separate fetch, since nothing else on this screen
    // needs the measurement history. Kept raw (growthRows) for the chart, on
    // top of the latest measurement (growth) the Health ID card shows.
    const growthRows = useRecords(profile.id, "growth");
    const measurements = useMemo(() => latestProfileMeasurements(growthRows), [growthRows]);
    const growthCache = useRecordCache(profile.id, "growth");
    const loadGrowth = useCallback(async (isActive) => {
        const rows = await api.listRecords(profile.id, "growth", { loading: "nonblocking" });
        if (!isActive()) return;
    }, [profile.id]);

    // Photo memories load from and persist to the backend.
    const memoryRows = useRecords(profile.id, "memories");
    const memories = useMemo(() => memoryRows.map(memoryToApp), [memoryRows]);
    const [detailMemory, setDetailMemory] = useState(null);
    useEffect(() => setDetailMemory(null), [profile.id]);
    const loadMemories = useCallback(async (isActive) => {
        const rows = await api.listRecords(profile.id, "memories", { loading: "nonblocking" });
        if (!isActive()) return;
    }, [profile.id]);

    const loadDashboard = useCallback(async (isCurrent) => {
        const results = await Promise.allSettled([
            loadActivityBundle(isCurrent), loadGrowth(isCurrent), loadMemories(isCurrent),
        ]);
        return results.filter((result) => result.status === "rejected").map((result) =>
            result.reason?.message || "Some records could not be refreshed. Please retry.");
    }, [loadActivityBundle, loadGrowth, loadMemories]);
    const { refreshing: dashboardLoading, failures: dashboardFailures, refresh: retryAll } =
        useScreenRefresh(profile.id, loadDashboard);
    const dashboardError = dashboardFailures[0] || "";
    const restoreHomeScroll = () => {
        const { viewport, content } = homeLayout.current;
        // Nested cards finish measuring after the skeleton leaves; an early scroll would be clamped.
        if (!dashboardLoading && !restoredScroll.current && initialScrollOffset != null && homeScrollRef.current
            && viewport > 0 && content >= initialScrollOffset + viewport - 1) {
            restoredScroll.current = true;
            homeScrollRef.current.scrollTo({ y: initialScrollOffset, animated: false });
            onScrollRestored?.();
        }
    };

    // The add form used to open here too, but the floating log button's
    // keepsake shortcut targets the Gallery (ActionSheet.js: view "growth",
    // tab "memory"), so nothing has routed "memory" to the Dashboard for a
    // while. Adding now happens in one place, which is also the only place
    // that holds the milestone list the form's suggestion chips need.

    const dashboardGrowthRange = useMemo(
        () => recentDateRange(30, profile.dateOfBirth),
        [profile.dateOfBirth]
    );

    const nav = (view, tab, payload) => onChangeView && onChangeView(view, tab, payload);

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

    // Health ID card — identity line, then the standing facts. "Girl"/"Boy"
    // rather than "Female"/"Male": this card is the parent's, and it matches
    // the vocabulary the app already uses for its own palettes. The clinical
    // wording stays in ProfessionalView.
    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };
    // Ordered by how urgent the thing actually is, not by which array it came
    // from. This list used to be overdueVax.concat(ongoingConcern) rendered
    // slice(0, 1) — so while a child had ANY overdue vaccine, a current
    // hospital stay could never be the visible row. The one slot went to
    // whatever sorted first, which was always the oldest overdue dose.
    //
    // Rank: a child in hospital right now, then an unresolved illness, then
    // overdue doses (most overdue first — overdueVax already arrives sorted
    // by due_date ascending).
    const hospitalizations = ongoingConcern.filter((m) => m.category === "Hospitalization");
    const illnesses = ongoingConcern
        .filter((m) => m.category !== "Hospitalization")
        .slice()
        .sort((a, b) => String(a.date_recorded || "").localeCompare(String(b.date_recorded || "")));
    const attentionItems = [
        ...hospitalizations.map((m) => ({
            key: `hosp-${m.id}`,
            // Verified against @expo/vector-icons' Ionicons glyphmap, per
            // CLAUDE.md Section 3. Note Ionicons "medical" is an asterisk-like
            // mark that reads as a footnote marker, not a vaccine — hence
            // bed/thermometer for concerns; vaccines use shared syringe artwork.
            recordType: "hospitalization",
            tint: colors.recHospitalization,
            tone: colors.danger,
            title: `Hospitalized: ${m.title || "Hospitalization"}`,
            // Hospitalizations live under Health's Checkups tab, not
            // Conditions (Health.js maps "hospitalization" -> "appointments").
            // This card used to send them to "illnesses", where they aren't
            // listed at all.
            sub: "Not yet resolved",
            dateText: m.date_recorded ? `Since ${shortDate(m.date_recorded)}` : "",
            tab: "appointments",
        })),
        ...illnesses.map((m) => ({
            key: `ill-${m.id}`,
            icon: "thermometer",
            tint: colors.recIllness,
            // Amber, not coral: DESIGN.md reserves coral for overdue, error,
            // and destructive. An illness someone is still getting over is
            // "needs attention, caution", which is amber's job.
            tone: colors.warning,
            title: m.title || "Illness",
            sub: m.date_recorded ? `Ongoing since ${shortDate(m.date_recorded)}` : "Ongoing",
            tab: "illnesses",
        })),
        ...overdueVax.map((v) => ({
            key: `ovax-${v.id}`,
            tint: colors.recVaccine,
            tone: colors.danger,
            title: v.vaccine_name || "Vaccination",
            sub: overdueText(v.due_date) || `Was due ${shortDate(v.due_date)}`,
            tab: "immunizations",
        })),
    ];
    const hasNeedsAttention = attentionItems.length > 0;
    // "See all" lands on whichever tab holds the most of these, rather than
    // Health's default — the old "+N more" dropped you on an arbitrary tab.
    const attentionTab = useMemo(() => {
        const counts = {};
        for (const i of attentionItems) counts[i.tab] = (counts[i.tab] || 0) + 1;
        return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "immunizations";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attentionItems.length, attentionItems[0]?.tab]);
    const lastMilkWhen = nutritionToday.lastFeedDate
        ? `${nutritionToday.lastFeedDate === today ? "" : `${shortDate(nutritionToday.lastFeedDate)}, `}${shortTime(nutritionToday.lastFeedTime)}`
        : "";
    const lastMilkGap = nutritionToday.sinceLastFeed != null
        ? durationText(nutritionToday.sinceLastFeed) || "Just now"
        : "";
    const lastMilkText = lastMilkWhen
        ? `Last milk: ${lastMilkWhen}${lastMilkGap ? ` · ${lastMilkGap === "Just now" ? lastMilkGap : `${lastMilkGap} ago`}` : ""}`
        : "Last milk: Not logged";
    const soonestShare = activeShares.length
        ? activeShares.slice().sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))[0]
        : null;

    return (
        <PullToRefreshScrollView scrollRef={homeScrollRef}
            onLayout={event => { homeLayout.current.viewport = event.nativeEvent.layout.height; restoreHomeScroll(); }}
            onContentSizeChange={(_width, height) => { homeLayout.current.content = height; restoreHomeScroll(); }} scope={profile.id} refreshing={dashboardLoading} onRefresh={retryAll}
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
        >
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
                so a normal day still looks calm. Medications stay out, but the
                reason has changed: migration 006 gave them a start, a course
                length and a finished flag, so "currently taking this" IS now
                answerable (the Medicine tab and the professional portal both
                answer it). They are excluded because a child taking medicine as
                prescribed is not a problem — flagging every course would make an
                ordinary week look alarming, which is exactly what this card
                exists not to do. */}
            {/* Zero-data rule for this screen's sections:
                 - Always-present habitual-log cards (Feeding) show an inline
                   zero-state CTA inside the same persistent card.
                 - List/gallery sections (Milestone Memories, Recent Activity)
                   show EmptyStateCard, DESIGN.md's dedicated empty-state
                   surface.
                 - Occasional call-out cards (Needs Attention, Active Share)
                   render nothing when there's nothing to say. */}
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
                            hitSlop={10}
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


            {/* Preserve the existing mixed-alert priorities and Health destinations. */}
            {hasNeedsAttention ? <NeedsAttentionCard items={attentionItems} collapsed={attentionCollapsed}
                onToggle={() => setAttentionCollapsed(value => !value)}
                onOpenItem={item => nav("health", item.tab)} onSeeAll={() => nav("health", attentionTab)} /> : null}

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
                    onPress={() => nav("share", null, { section: "activeRecentShares" })}
                    accessibilityRole="button"
                    accessibilityLabel={`${activeShares.length} share code${activeShares.length === 1 ? "" : "s"} active`}
                >
                    <Gradient colors={colors.activeShareSurface.surface} style={styles.shareSurface}
                        pointerEvents="none" accessible={false}>
                        <Gradient colors={colors.activeShareSurface.topShade} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.shareShadeTop} />
                        <Gradient colors={colors.activeShareSurface.leftShade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shareShadeLeft} />
                        <Gradient colors={colors.activeShareSurface.highlight} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={styles.shareLightBottom} />
                        <Gradient colors={colors.activeShareSurface.highlight} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={styles.shareLightRight} />
                    </Gradient>
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

            {/* Vaccination progress */}
            <VaccinationProgressCard completed={vaxProgress?.completed} total={vaxProgress?.total}
                nextVaccine={nextVax} loading={!vaccinationCache.hasFetched && dashboardLoading}
                error={!vaccinationCache.hasFetched && !dashboardLoading}
                onOpen={dose => nav("health", "immunizations", {
                    intent: "focus", sourceType: "vaccination", recordId: String(dose.id), childId: String(profile.id),
                })} />

            <BabyProfileCard profile={profile} age={ageText(profile.dateOfBirth)} measurements={measurements}
                loading={!growthCache.hasFetched && dashboardLoading} unavailable={!growthCache.hasFetched && !dashboardLoading}
                onViewProfile={() => nav("babyProfile", null, { childId: profile.id })}
                onChangePhoto={() => onOpenEditModal({ photo: true })} />

            {/* Growth chart — reuses the same history the Health ID strip reads
                from, but limits its plot to the latest 30 calendar days. The strip
                above remains the latest all-time snapshot. */}
            <GrowthChart
                rows={growthRows}
                dateOfBirth={profile?.dateOfBirth}
                loading={dashboardLoading}
                title={t("growthLast30DaysTitle")}
                appearance="growthTracking"
                dateWindow={dashboardGrowthRange}
                emptyMessage={t("growthNoMeasurementsLast30Days")}
                onViewDetail={() => nav("growth")}
                plain
            />

            <FeedingTodayCard date={today} stats={nutritionToday} mix={feedingMix}
                lastMilkText={lastMilkText} latestEntries={latestNutrition} reactions={todayReactions}
                onViewAll={() => nav("nutrition")} />

            <MemoriesMilestonesCard records={memories.slice(0, 4)}
                onOpenMemory={memory => setDetailMemory({ ...memory, childId: profile.id })} onViewAll={() => nav("growth", "gallery")} />

            {/* Recent Activity — moved to the bottom of the screen; the sections
                above answer "does anything need attention or action" first. */}
            <SectionContainerCard
                title="Recent Activity"
                action={
                    <TouchableOpacity
                        onPress={() => nav("allActivity")}
                        style={styles.seeAll}
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
                                style={styles.activityRow}
                            >
                                <View style={styles.activityLeft}>
                                    <View style={[styles.activityIcon, { backgroundColor: a.milestone || a.solidFood || a.milkFeed || a.vaccine ? "transparent" : withAlpha(tone, "1A") }]}>
                                        {a.milestone ? <RecordIcon category="milestone" size={36} /> : a.vaccine ? <VaccineIcon size={36} /> : a.solidFood ? <SolidFoodIcon size={36} /> : a.milkFeed ? <MilkIcon size={36} /> : <Ionicons name={a.icon} size={18} color={tone} />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.activityTitle}>{a.title}</Text>
                                        <Text style={styles.activitySubtitle} numberOfLines={1}>
                                            {a.subtitle}
                                        </Text>
                                        <Text style={styles.activityTime}>{relativeTime(a.date)}</Text>
                                    </View>
                                </View>
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
                profile={profile}
                onClose={() => setDetailMemory(null)}
            />

        </PullToRefreshScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "transparent", // lets App.js's page gradient show through
    },
    // Padding lives on the content, not the ScrollView box — see Health.js.
    // The old contentContainerStyle only carried space.xxl (32) of bottom
    // padding, well short of the tab bar and floating button above it.
    content: {
        padding: space.lg,
    },

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

    // Keep the border's layout space; only the clipped background looks recessed.
    shareCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.activeShareSurface.surface[0],
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "transparent",
        padding: space.md,
        marginBottom: space.lg,
        gap: space.md,
    },
    shareSurface: { ...StyleSheet.absoluteFillObject, borderRadius: radius.lg, overflow: "hidden" },
    shareShadeTop: { position: "absolute", top: 0, left: 0, right: 0, height: 12 },
    shareShadeLeft: { position: "absolute", top: 0, left: 0, bottom: 0, width: 12 },
    shareLightBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 10 },
    shareLightRight: { position: "absolute", top: 0, right: 0, bottom: 0, width: 10 },
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
    setupTitle: { ...type.bodyStrong, color: colors.text, textTransform: "capitalize" },
    // 26.4pt of visible button. The hitSlop at the call site is what brings the
    // real target to 44 — it was 8 (giving 42.4), a rounding error short.
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
        minHeight: MIN_TOUCH,
        paddingVertical: space.sm,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
    },
    setupRowText: { ...type.body, color: colors.text, flex: 1 },
    setupRowTextDone: { color: colors.textMuted, textDecorationLine: "line-through" },

    // Section heading
    // A bare text line is 18pt tall. The link needs a real box, not just
    // its own glyph height, to be a 44pt target.
    seeAll: { minHeight: MIN_TOUCH, justifyContent: "center", paddingLeft: space.sm },
    seeAllText: { ...type.label, color: colors.accentStrong },

    // Recent Activity — rows only; the wrapping card now comes from
    // SectionContainerCard (common/Cards.js).
    // No horizontal padding here — SectionContainerCard now supplies it.
    activityRow: { ...recordItemStyle(colors),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space.md, borderRadius: 24, borderWidth: 0, marginBottom: 12, overflow: "visible", paddingHorizontal: 12, borderBottomWidth: 0},
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
    activityTime: { ...type.caption, color: colors.textMuted, marginTop: space.xs },
});
