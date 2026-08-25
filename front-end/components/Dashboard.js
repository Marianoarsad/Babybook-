import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Animated,View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Pressable,
    ScrollView,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { EmptyStateCard, SectionContainerCard, MemoryVisualCard } from "./common/Cards";
import MemoryDetail from "./MemoryDetail";
import GrowthChart from "./GrowthChart";
import { DashboardSkeleton } from "./ui/Skeleton";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow, type, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../utils/api";
import { memoryToApp, toMilliliters, feedRowSummary } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import { useRefreshControl } from "./ui/useRefreshControl";
import { cacheSummary, getSummary } from "../utils/offlineSummary";
import { seen, markSeen } from "../utils/firstRun";
import { todayLocal, durationText } from "../utils/dates";

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
    const y = `${years} year${years === 1 ? "" : "s"}`;
    return rem ? `${y} ${rem} month${rem === 1 ? "" : "s"}` : y;
}

// "12 Mar 2025" from a YYYY-MM-DD date. Same call MemoryDetail.js uses — kept
// local rather than shared, since consolidating the three near-identical
// formatters in this app is its own cleanup.
function shortDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

// The child's most recent growth measurement, plus the date it was taken, for
// the Health ID card's measurement strip.
//
// This deliberately reports and does not interpret. It used to also compute a
// "growing faster/slower than before" verdict from the last three weights; that
// was removed because PRODUCT.md Principle 5 forbids the app from reading as a
// clinical judgment, and because GrowthChart — directly below this card —
// already plots the same measurements against the WHO reference bands, which is
// a real comparison rather than a guess derived from home scales.
function latestGrowth(rows) {
    const sorted = (rows || [])
        .filter((r) => r.date_recorded)
        .slice()
        .sort((a, b) => String(a.date_recorded).localeCompare(String(b.date_recorded)));
    if (sorted.length === 0) return null;

    const latest = sorted[sorted.length - 1];
    return {
        weight: latest.weight != null ? Number(latest.weight) : null,
        height: latest.height != null ? Number(latest.height) : null,
        date: latest.date_recorded,
    };
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
// How long a cached offline summary counts as current. A judgement call, not
// a rule from anywhere — it only decides whether the Offline Summary card sits
// near the top of the Home tab or further down it.
const OFFLINE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

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
    parentName,
    onOpenEditModal,
    onChangeView,
}) {
    const { t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    // The measurement strip is ALWAYS three cells across. It never wraps and
    // never drops to a second line: weight, height and head read as one row of
    // comparable numbers, and re-flowing them to 2 + 1 makes the odd one out
    // look like a different kind of fact.
    //
    // It used to ask fitsColumns() whether three fitted, and the answer on a
    // phone was always no — fitsColumns compares against TEXT_COL_MIN (150pt),
    // which is a minimum for a column of PROSE. Three of those needs 450pt,
    // and a phone card is about 300pt wide, so the three-across layout was
    // unreachable on the very devices this app is built for. "9.4 kg" is not a
    // paragraph; 150pt was the wrong yardstick.
    //
    // Instead the row is measured and the VALUE type shrinks to fit, down to
    // the 13px floor set in theme.js ("no text anywhere goes smaller"). In
    // practice a 360pt screen gives each cell ~100pt and nothing shrinks at
    // all; this only engages on a very narrow screen or a raised OS font scale.
    // Where the Offline Summary card sits.
    //
    // The card is a "set this up before you need it" nudge, so it holds a
    // prominent slot until it has done its job, then drops down the page
    // rather than occupying prime space forever.
    //
    // "Has it done its job?" is HAS THE PARENT OPENED IT, not "is a copy
    // cached". Caching is automatic — loadActivityBundle writes a fresh copy on
    // every single Dashboard load — so a cache-age test is true within a second
    // of launch and would make the prominent slot both useless and flickery
    // (it would appear, then jump down mid-read). Opening it is the only signal
    // that means the parent actually knows the feature is there.
    //
    // The age check is kept as a second condition for the real case it covers:
    // a device that has been offline long enough for the saved copy to be out
    // of date, where re-showing the prompt is genuinely useful.
    const [offlineSeen, setOfflineSeen] = useState(true); // assume seen until told otherwise: no flash
    const [offlineStale, setOfflineStale] = useState(false);
    useEffect(() => {
        let active = true;
        seen("offlineSummary").then((v) => active && setOfflineSeen(v));
        getSummary(profile.id)
            .then((s) => {
                if (!active) return;
                if (!s || !s.cachedAt) return;
                const age = Date.now() - new Date(s.cachedAt).getTime();
                setOfflineStale(!(age >= 0 && age < OFFLINE_FRESH_MS));
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [profile.id]);
    const offlinePrompt = !offlineSeen || offlineStale;

    const [statRowWidth, setStatRowWidth] = useState(0);
    // Width the widest realistic value ("100.5 cm", 8 characters) needs at the
    // full 16px. Below this the type scales down proportionally.
    const STAT_VALUE_FULL_W = 76;
    const statCellW = statRowWidth ? statRowWidth / 3 : 0;
    const statValueSize = statCellW
        ? Math.max(13, Math.min(16, Math.round((16 * statCellW) / STAT_VALUE_FULL_W)))
        : 16;
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
    const [detailsExpanded, setDetailsExpanded] = useState(false);
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
        // Deliberately does NOT move the card: caching is automatic and says
        // nothing about whether the parent has seen the feature. It only
        // clears the "your saved copy is out of date" condition.
        cacheSummary(profile, { vaccinations: vax, checkups, medicalHistory: medHistory })
            .then(() => isActive() && setOfflineStale(false))
            .catch(() => {});

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
                    items.push({
                        key: `nut-${n.id}`,
                        title: "Feeding Logged",
                        subtitle: feedRowSummary(n),
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

                // Today's feeding summary — reuses the nutrition rows already
                // loaded for Recent Activity, no extra request.
                const todayEntries = (nutrition || []).filter(
                    (n) => String(n.entry_date).slice(0, 10) === todayStr,
                );
                if (todayEntries.length) {
                    const milkToday = todayEntries.filter((n) => (n.entry_type || "milk") === "milk");
                    // A breastfeed has no volume, so millilitres alone can't
                    // describe the day — a breastfed baby totalled 0 mL and
                    // the card fell through to claiming solid food was logged.
                    const totalMl = milkToday
                        .filter((n) => n.feed_method !== "breast")
                        .reduce((sum, n) => sum + toMilliliters(Number(n.quantity) || 0, n.unit), 0);
                    const breastMinutes = milkToday
                        .filter((n) => n.feed_method === "breast")
                        .reduce((sum, n) => sum + (Number(n.duration_minutes) || 0), 0);
                    const lastTime = todayEntries
                        .map((n) => n.entry_time)
                        .filter(Boolean)
                        .sort()
                        .pop();
                    setTodayFeeding({
                        count: todayEntries.length,
                        totalMl: Math.round(totalMl),
                        breastMinutes: Math.round(breastMinutes),
                        solidCount: todayEntries.length - milkToday.length,
                        lastTime,
                    });
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
    // top of the latest measurement (growth) the Health ID card shows.
    const [growth, setGrowth] = useState(null);
    const [growthRows, setGrowthRows] = useState([]);
    const loadGrowth = useCallback(async (isActive) => {
        const rows = await api.listRecords(profile.id, "growth");
        if (!isActive()) return;
        setGrowth(latestGrowth(rows));
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
    // Rendered in one of two places, never both — see offlineStale above.
    // Prominent while there is nothing saved (or it has gone stale), because a
    // parent has to prepare it BEFORE they need it; quiet once it is done.
    const renderOfflineCard = () => (
                <Pressable
                    style={({ pressed, hovered, focused }) => [
                        styles.offlineCard,
                        { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
                        focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                    ]}
                    onPress={() => {
                        markSeen("offlineSummary");
                        setOfflineSeen(true);
                        nav("offlineSummary");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="View offline consultation summary"
                >
                    <View style={styles.offlineIcon}>
                        <Ionicons name="cloud-offline-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.offlineLabel}>Offline Summary</Text>
                        <Text style={styles.offlineSub}>
                            {offlinePrompt
                                ? "Works without signal — worth opening once while you have it"
                                : "Saved on this device — opens without signal"}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </Pressable>
    );

    const retryAll = () => {
        retryActivity();
        retryGrowth();
        retryMemories();
    };
    const refreshControl = useRefreshControl(dashboardLoading, retryAll);

    // The add form used to open here too, but the floating log button's
    // keepsake shortcut targets the Gallery (ActionSheet.js: view "growth",
    // tab "memory"), so nothing has routed "memory" to the Dashboard for a
    // while. Adding now happens in one place, which is also the only place
    // that holds the milestone list the form's suggestion chips need.

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

    // Health ID card — identity line, then the standing facts. "Girl"/"Boy"
    // rather than "Female"/"Male": this card is the parent's, and it matches
    // the vocabulary the app already uses for its own palettes. The clinical
    // wording stays in ProfessionalView and the offline summary.
    const sexWord = profile.gender === "boy" ? "Boy" : "Girl";

    // Empty means "nobody has entered this", which is NOT the same as "this
    // child has none" — a doctor reading a blank allergy line has to be able
    // to tell those apart. "None recorded" is the phrasing OfflineSummaryView
    // and ProfessionalView already use for exactly this reason.
    const NONE_RECORDED = "None recorded";
    const listValue = (arr) => (Array.isArray(arr) && arr.length ? arr.join(", ") : "");
    const vitalFacts = [
        { key: "allergies", icon: "alert-circle-outline", label: "Allergies", value: listValue(profile.allergies), flag: true },
        { key: "blood", icon: "water-outline", label: "Blood type", value: profile.bloodType || "" },
        { key: "hereditary", icon: "pulse-outline", label: "Hereditary", value: listValue(profile.hereditaryConditions), flag: true },
    ];
    // Rows with nothing in them are dropped rather than padded with
    // "None recorded" — unlike the vitals above, an unlisted pediatrician is
    // not a fact a clinician needs stated, it's just an empty field.
    const careFacts = [
        { key: "ped", icon: "medkit-outline", label: "Pediatrician", value: profile.pediatricianName || "" },
        { key: "center", icon: "business-outline", label: "Health center", value: profile.preferredHealthCenter || "" },
        { key: "emergency", icon: "call-outline", label: "Emergency", value: profile.emergencyContact || "" },
        { key: "born", icon: "location-outline", label: "Born at", value: profile.hospital || profile.placeOfBirth || "" },
    ].filter((f) => f.value);

    // Birth weight/length are deliberately not used as a fallback here. They're
    // a different fact from "how big is the baby now", and pairing them with
    // the growth record's "Measured …" date would misreport them.
    const measurements = growth
        ? [
              { key: "w", label: "Weight", value: growth.weight, unit: "kg" },
              { key: "h", label: "Height", value: growth.height, unit: "cm" },
              { key: "c", label: "Head", value: headCirc != null ? Number(headCirc) : null, unit: "cm" },
          ]
        : [];

    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };
    const vaxPct = vaxProgress && vaxProgress.total > 0 ? Math.round((vaxProgress.completed / vaxProgress.total) * 100) : 0;
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
            // medkit/bed/thermometer, which are distinguishable at 18px.
            icon: "bed",
            tint: colors.recHospitalization,
            tone: colors.danger,
            title: `Hospitalized: ${m.title || "Hospitalization"}`,
            // Hospitalizations live under Health's Checkups tab, not
            // Conditions (Health.js maps "hospitalization" -> "appointments").
            // This card used to send them to "illnesses", where they aren't
            // listed at all.
            sub: m.date_recorded ? `Since ${shortDate(m.date_recorded)} · not yet resolved` : "Not yet resolved",
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
            icon: "medkit",
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
    const soonestShare = activeShares.length
        ? activeShares.slice().sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))[0]
        : null;

    return (
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            {...scrollProps}
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

            {/* Offline Summary, prominent slot — only while there is nothing
                saved yet or the copy has gone stale. Once it is current the
                card moves down the page, below Feeding. */}
            {offlinePrompt ? renderOfflineCard() : null}

            {/* Needs attention. Shows the three most urgent things rather than
                one, because a seeded or long-neglected account can hold a
                dozen and "one item + a number" can't be triaged.

                Each row carries two independent signals: the icon tile says
                WHAT the record is (the shared colors.rec* type tints, same as
                every list row in the app), and the subtitle colour says HOW
                urgent it is — coral for overdue and for a current hospital
                stay, amber for an illness still being got over. The card no
                longer paints everything in one flat red, which made a lingering
                cold shout exactly as loudly as a hospitalization. */}
            {hasNeedsAttention ? (
                <View style={styles.attentionCard}>
                    <View style={styles.attentionHeader}>
                        <Ionicons name="warning" size={17} color={colors.danger} />
                        <Text style={styles.attentionTitle}>Needs attention</Text>
                        <View style={styles.attentionCount}>
                            <Text style={styles.attentionCountText}>{attentionItems.length}</Text>
                        </View>
                    </View>
                    {attentionItems.slice(0, 3).map((item) => (
                        <Pressable
                            key={item.key}
                            style={({ pressed, hovered, focused }) => [
                                styles.attentionRow,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.danger, "59")}` } : null,
                            ]}
                            onPress={() => nav("health", item.tab)}
                            accessibilityRole="button"
                            accessibilityLabel={`${item.title}. ${item.sub}.`}
                        >
                            <View style={[styles.attentionIcon, { backgroundColor: item.tint.bg }]}>
                                <Ionicons name={item.icon} size={18} color={item.tint.on} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.attentionText} numberOfLines={2}>
                                    {item.title}
                                </Text>
                                <Text style={[styles.attentionSub, { color: item.tone }]}>{item.sub}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </Pressable>
                    ))}
                    {attentionItems.length > 3 ? (
                        <Pressable
                            style={({ pressed, hovered, focused }) => [
                                styles.attentionMore,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.danger, "59")}` } : null,
                            ]}
                            onPress={() => nav("health", attentionTab)}
                            accessibilityRole="button"
                            accessibilityLabel={`See all ${attentionItems.length} items needing attention`}
                        >
                            <Text style={styles.attentionMoreText}>
                                See all {attentionItems.length}
                            </Text>
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

            {/* Child Health ID — who this child is and the standing facts a
                parent or a doctor asks for first. This is the app's only
                always-on surface for them: there is no child-profile screen
                (settings/ViewProfile.js is the *parent's* account), and the
                only other place they appear is OfflineSummaryView, behind its
                own nav destination. So the order here matches what the
                clinician sees there — identity, allergies/blood/hereditary,
                then care contacts.

                Nothing safety-critical is collapsed. Allergies and blood type
                used to sit behind the expander, which is backwards for the
                clinic scene this product is built around. Only the care
                contacts — real, but not glance-level — are behind the
                disclosure now.

                Growth numbers here are the latest measurement and its date,
                nothing more. The faster/slower verdict that used to live in
                this card is gone: PRODUCT.md Principle 5 forbids the app from
                reading as clinical judgment, and GrowthChart directly below
                already plots these against the WHO bands. */}
            <View style={styles.idCard}>
                {/* Identity. The header (App.js) shows the name as text with no
                    avatar, and the switcher's 32px pills are for switching, not
                    identification — so the photo isn't a repeat, it was just
                    missing. brokenAvatars is shared with the switcher above:
                    uploads sit on an ephemeral filesystem, so a truthy-but-dead
                    URL has to fall back rather than render a blank circle. */}
                <View style={styles.idHeader}>
                    {profile.avatarUrl && !brokenAvatars.has(profile.id) ? (
                        <Image
                            source={{ uri: profile.avatarUrl }}
                            style={styles.idAvatar}
                            onError={() => setBrokenAvatars((prev) => new Set(prev).add(profile.id))}
                        />
                    ) : (
                        <View style={[styles.idAvatar, styles.idAvatarFallback]}>
                            <Ionicons name="person" size={26} color={colors.primary} />
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        {/* Two lines, not one: a full Filipino name is often
                            longer than the column left after the avatar and
                            the edit button, and "Hanna Bas…" is the one thing
                            an identity card must never render. */}
                        <Text style={styles.idName} numberOfLines={2}>
                            {profile.name}
                        </Text>
                        {profile.nickname ? (
                            <Text style={styles.idNickname} numberOfLines={1}>
                                “{profile.nickname}”
                            </Text>
                        ) : null}
                        <Text style={styles.idSub}>
                            {sexWord}
                            {ageText(profile.dateOfBirth) ? ` · ${ageText(profile.dateOfBirth)}` : ""}
                        </Text>
                        {profile.dateOfBirth ? (
                            <Text style={styles.idSub}>Born {shortDate(profile.dateOfBirth)}</Text>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        onPress={onOpenEditModal}
                        style={styles.idEdit}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${profile.name}'s profile`}
                    >
                        <Ionicons name="pencil" size={17} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Standing health facts — always visible, never collapsed.
                    A recorded allergy or hereditary condition tints amber, not
                    coral: DESIGN.md reserves coral for overdue/error/destructive
                    and defines amber as "needs attention, caution", which is the
                    honest read for a flag whose severity this app never records.
                    Each row opens the edit form, so an unfilled row doubles as
                    the prompt to fill it. */}
                <View style={styles.idDivider} />
                {vitalFacts.map((f) => {
                    const filled = !!f.value;
                    const flagged = filled && f.flag;
                    return (
                        <Pressable
                            key={f.key}
                            onPress={onOpenEditModal}
                            style={({ pressed, hovered, focused }) => [
                                styles.factRow,
                                flagged && styles.factRowFlagged,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${f.label}: ${f.value || NONE_RECORDED}. Tap to edit.`}
                        >
                            <Ionicons
                                name={f.icon}
                                size={17}
                                color={flagged ? colors.warning : colors.textMuted}
                                style={{ marginTop: 2 }}
                            />
                            <View style={styles.factBody}>
                                <Text style={styles.factLabel}>{f.label}</Text>
                                <Text
                                    style={[
                                        styles.factValue,
                                        !filled && styles.factValueEmpty,
                                        flagged && styles.factValueFlagged,
                                    ]}
                                >
                                    {f.value || NONE_RECORDED}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}

                {/* Latest measurements. Value over label so the number is what
                    the eye lands on, with the date underneath — "7.8 kg" means
                    nothing without knowing when it was taken. */}
                <View style={styles.idDivider} />
                {measurements.length ? (
                    <View>
                        <View
                            style={styles.statRow}
                            onLayout={(e) => setStatRowWidth(e.nativeEvent.layout.width)}
                        >
                            {measurements.map((m) => (
                                <View
                                    key={m.key}
                                    style={styles.statCell}
                                    accessible
                                    accessibilityLabel={
                                        m.value != null
                                            ? `${m.label}: ${m.value} ${m.unit}`
                                            : `${m.label}: not recorded`
                                    }
                                >
                                    <Text
                                        style={[styles.statValue, { fontSize: statValueSize }]}
                                        numberOfLines={1}
                                        ellipsizeMode="clip"
                                    >
                                        {m.value != null ? `${m.value} ${m.unit}` : "—"}
                                    </Text>
                                    {/* One line. The label was allowed two,
                                        which pushed "Head" onto a second row
                                        and misaligned the three cells. */}
                                    <Text style={styles.statLabel} numberOfLines={1}>
                                        {m.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        {growth.date ? (
                            <Text style={styles.statCaption}>Measured {shortDate(growth.date)}</Text>
                        ) : null}
                    </View>
                ) : (
                    <Pressable
                        onPress={() => nav("growth", "metrics")}
                        style={({ pressed, hovered, focused }) => [
                            styles.factRow,
                            { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
                            focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="No measurements yet. Tap to record one."
                    >
                        <Ionicons
                            name="scale-outline"
                            size={17}
                            color={colors.textMuted}
                            style={{ marginTop: 2 }}
                        />
                        <View style={styles.factBody}>
                            <Text style={styles.factLabel}>Measurements</Text>
                            <Text style={[styles.factValue, styles.factValueLink]}>
                                Record the first one
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.primary}
                            style={{ marginTop: 2 }}
                        />
                    </Pressable>
                )}

                {/* Care contacts — the one thing worth hiding. Skipped entirely
                    when the parent hasn't filled in any of them, rather than
                    offering a disclosure that opens onto nothing. */}
                {careFacts.length ? (
                    <>
                        <View style={styles.idDivider} />
                        <Pressable
                            onPress={() => setDetailsExpanded((v) => !v)}
                            style={({ pressed, hovered, focused }) => [
                                styles.moreRow,
                                { opacity: hovered ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
                                focused ? { boxShadow: `0 0 0 3px ${withAlpha(colors.primary, "59")}` } : null,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${detailsExpanded ? "Hide" : "Show"} care contacts`}
                            accessibilityState={{ expanded: detailsExpanded }}
                        >
                            <Text style={styles.moreText}>
                                {detailsExpanded ? "Hide details" : "More details"}
                            </Text>
                            <Ionicons
                                name={detailsExpanded ? "chevron-up" : "chevron-down"}
                                size={18}
                                color={colors.primary}
                            />
                        </Pressable>
                        {detailsExpanded
                            ? careFacts.map((f) => (
                                  <View
                                      key={f.key}
                                      style={styles.factRow}
                                      accessible
                                      accessibilityLabel={`${f.label}: ${f.value}`}
                                  >
                                      <Ionicons
                                          name={f.icon}
                                          size={17}
                                          color={colors.textMuted}
                                          style={{ marginTop: 2 }}
                                      />
                                      <View style={styles.factBody}>
                                          <Text style={styles.factLabel}>{f.label}</Text>
                                          <Text style={styles.factValue}>{f.value}</Text>
                                      </View>
                                  </View>
                              ))
                            : null}
                    </>
                ) : null}
            </View>

            {/* Growth chart — reuses the same growth history the Health ID
                card's measurement strip reads from. Sex and date of birth are
                what let it draw the WHO reference bands; without them it still
                plots the child's own line. This card owns growth *over time*;
                the strip above only states the latest numbers. */}
            <GrowthChart
                rows={growthRows}
                sex={profile?.sex || profile?.gender}
                dateOfBirth={profile?.dateOfBirth}
                loading={growthLoading}
                name={profile?.nickname || profile?.firstName}
                // The parent's card: plain wording, one reference band. The
                // professional's copy of this same component deliberately does
                // not pass this.
                plain
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
                        <Text style={styles.progressTitle} numberOfLines={1}>
                            Vaccination Progress
                        </Text>
                        <Text style={styles.progressCount} numberOfLines={1}>
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
                            {[
                                todayFeeding.totalMl > 0 ? `${todayFeeding.totalMl} mL` : null,
                                todayFeeding.breastMinutes > 0
                                    ? `${durationText(todayFeeding.breastMinutes)} at the breast`
                                    : null,
                                todayFeeding.solidCount > 0
                                    ? `${todayFeeding.solidCount} solid${todayFeeding.solidCount === 1 ? "" : "s"}`
                                    : null,
                                todayFeeding.lastTime ? `last at ${todayFeeding.lastTime.slice(0, 5)}` : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
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

            {/* Offline Summary, quiet slot — a current copy is already saved,
                so this is a way back to it rather than a prompt. */}
            {offlinePrompt ? null : renderOfflineCard()}

            {/* Square photo gallery. Adding lives in the floating log button's
                menu, alongside Log Milk, Log Food, etc., instead of a second
                add button here.

                Titled "Milestone Memories" until now, which is the label that
                made the two features look like one: it borrowed the milestone
                name for records that are not milestones and never reach a
                healthcare professional. "Photos & Milestones" is what the
                Gallery's own filter chips already say. */}
            <SectionContainerCard
                title="Photos & Milestones"
                action={
                    <TouchableOpacity
                        onPress={() => nav("growth", "gallery")}
                        style={styles.seeAll}
                        accessibilityRole="button"
                        accessibilityLabel="See all photos and milestones"
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

        </Animated.ScrollView>
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

    // Kept after the baby switcher moved into the header: the Child Health ID
    // card below still renders the avatar and needs both of these.
    avatarMini: { width: 32, height: 32, borderRadius: 16, borderCurve: "continuous" },
    avatarFallback: { backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" },

    // Child Health ID card. Matches the house section-card shell from
    // common/Cards.js (radius.xl, 18px padding, hairline + shadow.card) so it
    // sits in the same visual family as every other section on this screen.
    idCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: space.lg + 2,
        marginBottom: space.lg,
        ...shadow.card,
    },
    idHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
    idAvatar: { width: 56, height: 56, borderRadius: 28, borderCurve: "continuous" },
    idAvatarFallback: { backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" },
    idName: { ...type.heading, color: colors.text },
    idNickname: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    idSub: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
    idEdit: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.softGreen,
    },
    idDivider: { height: 1, backgroundColor: colors.hairline, marginVertical: space.md },

    // Fact rows — fixed-width label so every value starts on the same x, which
    // is what makes the block scannable rather than a paragraph of pairs.
    // Label above value, not beside it. A fixed label column left roughly
    // 130px for the value at phone width, which truncated real entries
    // ("Mild egg sensitivit…"). Allergy and hereditary text is arbitrary
    // length and is exactly the content that must not be cut off.
    factRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    factRowFlagged: { backgroundColor: colors.warningBg },
    factBody: { flex: 1 },
    factLabel: { ...type.caption, color: colors.textMuted },
    factValue: { ...type.body, color: colors.text },
    factValueEmpty: { color: colors.textMuted },
    // Weight, not just hue — the amber fill and amber icon are two signals, the
    // heavier value is the third, so a flagged row still reads as flagged
    // without color (DESIGN.md: never let a state depend on hue alone).
    factValueFlagged: { ...type.bodyStrong },
    factValueLink: { color: colors.primary },

    // Measurement strip — value above label, so the number reads first.
    // Wraps to two-up rather than squeezing three cells below a readable width;
    // "34.5 cm" with a "Head" label under it needs more than ~97pt once the OS
    // font scale is raised.
    // space-between, so the gaps BETWEEN the three readings are equal and the
    // outer two sit flush with the card's edges.
    //
    // The cells used to be flex: 1 — equal THIRDS, which is not the same thing.
    // "9.4 kg" is narrower than "76.5 cm", so equal thirds left visibly unequal
    // gaps between the text (50pt then 35pt at 360pt wide) and a ragged margin
    // on the right. Sizing each cell to its own content and distributing the
    // slack fixes both.
    statRow: { flexDirection: "row", justifyContent: "space-between" },
    // No wrapping variant, deliberately: weight, height and head are three
    // comparable numbers and read as one row. Re-flowing them to 2 + 1 makes
    // the odd one out look like a different kind of fact. If the row is too
    // narrow the VALUE TYPE shrinks instead (statValueSize, above), down to the
    // 13px floor theme.js sets. Do not reintroduce a stacked fallback.
    // No flexGrow: a cell must size to its own content for space-between to
    // have any slack to distribute. flexShrink stays on so a very narrow row
    // still degrades gracefully instead of overflowing the card.
    statCell: { flexShrink: 1, minWidth: 0, alignItems: "flex-start" },
    // STANDING RULE, kept after the code that prompted it was deleted:
    // never write `flex: 0` in this codebase. react-native-web passes it
    // straight through to CSS, where it means `0 1 0%` — and a 0% basis
    // overrides `width`, so the element computes to zero size and vanishes.
    // Use explicit flexGrow / flexShrink / flexBasis instead.
    statValue: { ...type.bodyStrong, color: colors.text },
    statLabel: { ...type.caption, color: colors.textMuted, marginTop: 1 },
    statCaption: { ...type.caption, color: colors.textMuted, marginTop: space.sm },

    // Care-contacts disclosure
    moreRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.sm,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    moreText: { ...type.label, color: colors.primary },

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

    // Needs Attention. A white surface with a coral border and coral header,
    // rather than a wholly coral-tinted card — the alarm is carried by the
    // frame, which leaves each row free to state its own urgency in its own
    // colour. A flat red ground made every row look equally dire and left
    // nowhere for amber to read.
    attentionCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.danger,
        padding: space.lg + 2,
        marginBottom: space.lg,
        ...shadow.card,
    },
    attentionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginBottom: space.xs,
    },
    attentionTitle: { ...type.heading, color: colors.danger, flex: 1 },
    // The total, stated instead of inferred from "1 + 8 more".
    attentionCount: {
        minWidth: 24,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
    },
    attentionCountText: { ...type.label, color: colors.onPrimary },
    attentionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        minHeight: MIN_TOUCH,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    attentionIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    attentionText: { ...type.bodyStrong, color: colors.text },
    attentionSub: { ...type.caption, marginTop: 1 },
    attentionMore: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: MIN_TOUCH,
        marginTop: space.xs,
        paddingTop: space.sm,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
    },
    attentionMoreText: { ...type.label, color: colors.danger },

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
    // primaryDark, not primary. theme.js defines primaryDark as "the accessible
    // text colour for a primarySoft chip", and this card's ground is primary at
    // 6% alpha — the same pale wash. On `primary` this measured 4.14:1 even on
    // the old flat page, under AA; the tinted page took it to 3.95. 5.64:1 now.
    offlineLabel: { ...type.bodyStrong, color: colors.primaryDark },
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
    // Wraps rather than clipping: title plus count already used ~267pt of the
    // 292pt available at 360pt, leaving no headroom for a raised font scale.
    progressHeader: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: space.sm,
        marginBottom: space.sm,
    },
    progressTitle: { ...type.label, color: colors.text, flex: 1, minWidth: 0 },
    progressCount: { ...type.caption, color: colors.textMuted, flexShrink: 0 },
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
});
