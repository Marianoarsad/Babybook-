import React, { useState, useEffect, useMemo } from "react";
import {
    Animated,View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from "react-native";
import { api } from "../utils/api";
import { milestoneToApp, memoryToApp } from "../utils/adapters";
import { useToast } from "./ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { radius, space, type, shadow, MIN_TOUCH } from "../theme";
import { useScreenPadBottom, useScreenPadTop } from "../utils/responsive";
import { useScroll } from "../context/ScrollContext";
import {
    SectionContainerCard,
    ListEntryCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { MemoriesSkeleton, AppointmentsSkeleton, SkeletonBlock } from "./ui/Skeleton";
import { useRefreshControl } from "./ui/useRefreshControl";
import ShowMore from "./ui/ShowMore";
import MemoryDetail from "./MemoryDetail";
import PercentileChart from "./PercentileChart";
import {
    WHO_MAX_DAY,
    ageInDays,
    describeZ,
    formatPercentile,
    normalizeSex,
    percentileFromZ,
    unitFor,
    zScore,
} from "../utils/whoGrowth";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import TipStrip from "./ui/TipStrip";
import { todayLocal, shortDate, monthLabel, monthsBetween, spanText, ageLabel } from "../utils/dates";
import AddMemoryModal from "./ui/AddMemoryModal";
import GrowthModal from "./ui/GrowthModal";
import OptionSheet from "./ui/OptionSheet";
import {
    CHECKPOINTS,
    DOMAINS,
    bandLabel,
    checkpointFor,
    findRecorded,
    itemsForCheckpoint,
} from "../utils/milestoneChecklist";

// Display names for growth_records.measured_at (migration 007). Reading only:
// the app never treats one place as more or less trustworthy than another.
const PLACE_LABELS = {
    home: "At home",
    health_center: "Health centre",
    clinic: "Clinic",
    hospital: "Hospital",
};

const METRIC_TABS = [
    { key: "weight", label: "Weight", field: "weight" },
    { key: "height", label: "Height", field: "height" },
    { key: "head", label: "Head", field: "head_circumference" },
];

// ageLabel now lives in utils/dates.js -- the Dashboard's Growth Chart needs
// the same string, and a second copy is how formatters drift apart.



export default function Growth({
    profile,
    onUpdateProfile,
    milestones,
    setMilestones,
    initialTab,
    navKey,
}) {
    const { language, t } = useLanguage();
    const toast = useToast();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();
    const { scrollProps } = useScroll();
    // Leftmost tab, same rule as Health.js. Note this does NOT open the Log
    // Growth form: that is fired by the deep-link effect below only when
    // initialTab === "metrics" arrives from the FAB, never from the default.
    const [growthTab, setGrowthTab] = useState("metrics");

    // The checklist band this child's own age falls in. Everything about the
    // Milestones tab keys off this: the tab used to open on the youngest band
    // regardless of the child, so a parent of a three-year-old was shown
    // two-month milestones every single time.
    const ageMonths = useMemo(
        () => monthsBetween(profile.dateOfBirth, todayLocal()),
        [profile.dateOfBirth],
    );
    const ownBand = useMemo(() => checkpointFor(ageMonths), [ageMonths]);
    const [selectedBand, setSelectedBand] = useState(ownBand);
    const [bandSheetOpen, setBandSheetOpen] = useState(false);

    // Rows for the age menu. "Your baby" is suppressed when the birth date was
    // never recorded: monthsBetween returns null there and checkpointFor falls
    // back to the first band, so labelling it would tell a parent their child
    // is two months old on the strength of a missing field.
    const bandOptions = useMemo(
        () =>
            CHECKPOINTS.map((c) => ({
                key: c,
                label: bandLabel(c),
                note: ageMonths != null && c === ownBand ? "Your baby" : null,
            })),
        [ageMonths, ownBand],
    );

    // Follow the child when the selected child changes — without this, a
    // switch from a newborn to a five-year-old keeps the newborn's band.
    useEffect(() => {
        setSelectedBand(ownBand);
    }, [ownBand]);

    const bandItems = useMemo(() => itemsForCheckpoint(selectedBand), [selectedBand]);
    // Apply a deep-link tab request from the floating log button, and — for
    // "Log Growth"/"Schedule Checkup" — open the matching form directly
    // instead of just switching tabs, the same way NutritionTracker.js
    // already does for "Log Milk"/"Log Food".
    // Same rule Health.js follows: a plain tab name only switches tabs, an
    // alias switches and opens a form. "metrics" is the one legacy exception,
    // kept because the FAB's Log Growth shortcut has always used it.
    useEffect(() => {
        const tabFor = {
            milestones: "milestones",
            metrics: "metrics",
            gallery: "gallery",
            memory: "gallery",
        };
        if (initialTab && tabFor[initialTab]) {
            setGrowthTab(tabFor[initialTab]);
            if (initialTab === "metrics") setShowMetricsModal(true);
            if (initialTab === "memory") setShowAddMemory(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navKey]);

    // Milestones load from / persist to the backend. Nutrition moved to its
    // own top-level screen (App.js) — see NutritionTracker.js. Checkups moved
    // to the Health screen — see Health.js.
    const [mstones, setMstones] = useState([]);
    // How many of this band's items the parent has recorded. Declared here
    // rather than beside `bandItems` because it needs `mstones`, which is
    // initialised below the band state.
    const bandRecordedCount = useMemo(
        () => bandItems.filter((i) => findRecorded(mstones, i.title)?.isCompleted).length,
        [bandItems, mstones],
    );
    const [memories, setMemories] = useState([]);
    const [memoriesVisible, setMemoriesVisible] = useState(10);
    // Gallery filter: "all" | "memory" | "milestone".
    const [galleryFilter, setGalleryFilter] = useState("all");
    const [showAddMemory, setShowAddMemory] = useState(false);
    const [growthLoading, setGrowthLoading] = useState(true);
    const [detailMemory, setDetailMemory] = useState(null);
    // Raw growth_records rows. The Metrics tab used to show only the two values
    // cached on the profile, so there was no history and nothing to plot.
    const [growthRows, setGrowthRows] = useState([]);
    const [metricsVisible, setMetricsVisible] = useState(10);
    const [metricKey, setMetricKey] = useState("weight");
    const [reloadTick, setReloadTick] = useState(0);
    useEffect(() => {
        let active = true;
        setGrowthLoading(true);
        (async () => {
            try {
                const [mRows, gRows, memRows] = await Promise.all([
                    api.listRecords(profile.id, "milestones"),
                    api.listRecords(profile.id, "growth").catch(() => []),
                    // The Gallery tab's photo memories. This screen never
                    // fetched them, which is why that tab was showing
                    // completed milestones under a "Memories" heading while
                    // the Dashboard's "See all photo memories" pointed here.
                    api.listRecords(profile.id, "memories").catch(() => []),
                ]);
                if (!active) return;
                setMstones(mRows.map(milestoneToApp));
                setGrowthRows(Array.isArray(gRows) ? gRows : []);
                setMemories((Array.isArray(memRows) ? memRows : []).map(memoryToApp));
            } catch (e) {
                console.log("load growth records:", e.message);
            } finally {
                if (active) setGrowthLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id, reloadTick]);

    const refreshControl = useRefreshControl(growthLoading, () => setReloadTick((n) => n + 1));

    // WHO publishes separate curves per sex and none for an unrecorded sex.
    // adapters.js quietly defaults an unknown sex to girl for theming; that
    // default must not decide which growth curve a child is measured against,
    // so this reads the recorded value and yields null when it is absent.
    const sexKey = useMemo(() => normalizeSex(profile.sex || profile.gender), [profile.sex, profile.gender]);

    const activeMetric = METRIC_TABS.find((m) => m.key === metricKey) || METRIC_TABS[0];

    const measurements = useMemo(() => {
        return (growthRows || [])
            .map((r) => {
                const date = r.date_recorded ? String(r.date_recorded).slice(0, 10) : null;
                if (!date) return null;
                return {
                    id: r.id,
                    date,
                    day: ageInDays(profile.dateOfBirth, date),
                    weight: r.weight != null && r.weight !== "" ? Number(r.weight) : null,
                    height: r.height != null && r.height !== "" ? Number(r.height) : null,
                    head_circumference:
                        r.head_circumference != null && r.head_circumference !== ""
                            ? Number(r.head_circumference)
                            : null,
                    measured_at: r.measured_at || null,
                    notes: r.notes || null,
                    raw: r,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [growthRows, profile.dateOfBirth]);

    // The profile's cached currentHeight/currentWeight are only written when
    // someone saves through this screen's form, so for a seeded or imported
    // child they fall back to birth values — which read as a contradiction next
    // to a chart plotting the real latest measurement. Prefer the record.
    // Head joins Height and Weight: the form collects it, the chart has a tab
    // for it, and it was the one measurement you could not see without
    // switching charts.
    //
    // Birth weight and birth length are deliberately NOT a fallback here. They
    // answer a different question from "how big is the baby now", and showing
    // one under a "latest measurement" heading misreports it — the same call
    // already recorded for the Dashboard's Health ID card. With nothing
    // recorded the strip shows a dash and the prompt below it says so.
    const latestVitals = useMemo(() => {
        const pick = (field) => {
            const row = measurements.find((m) => m[field] != null);
            return row ? { value: row[field], date: row.date } : null;
        };
        return {
            height: pick("height"),
            weight: pick("weight"),
            head: pick("head_circumference"),
        };
    }, [measurements]);

    // "Last measured 4 months ago" — a plain statement of the gap. It does not
    // say how often a child should be measured; the app has no standing to.
    const lastMeasured = useMemo(() => {
        const newest = measurements[0];
        if (!newest) return null;
        const span = spanText(newest.date, todayLocal());
        return {
            date: newest.date,
            text: span === "Same day" ? "Last measured today" : `Last measured ${span} ago`,
            // A visit that recorded one value but not the other leaves a hole
            // in the other chart. Worth naming, once, without nagging.
            missing:
                newest.weight == null && newest.height != null
                    ? "weight"
                    : newest.height == null && newest.weight != null
                      ? "height"
                      : null,
        };
    }, [measurements]);

    // Where the most recent measurement of the selected metric falls.
    const reading = useMemo(() => {
        if (!sexKey || !profile.dateOfBirth) return null;
        const usable = measurements
            .filter((m) => m.day != null && m.day <= WHO_MAX_DAY && m[activeMetric.field] > 0)
            .sort((a, b) => a.day - b.day);
        const latest = usable[usable.length - 1];
        if (!latest) return null;
        const value = latest[activeMetric.field];
        const z = zScore(metricKey, sexKey, latest.day, value);
        if (z == null) return null;

        // The position at the previous measurement, so the two can be read
        // together.
        //
        // REGISTER, deliberately: this states both published reference
        // positions and their dates and stops. No arrow, no delta, no
        // "up"/"down"/"rising"/"dropping", no colour, no icon, no alert.
        // Movement between centiles is a clinical signal and reading it is the
        // health worker's job, not this app's — PRODUCT.md Principle 5, the
        // same reason the Dashboard's growth-pace verdict was deleted. Do not
        // "improve" this into a trend indicator.
        const prevRow = usable[usable.length - 2] || null;
        let previous = null;
        if (prevRow) {
            const pz = zScore(metricKey, sexKey, prevRow.day, prevRow[activeMetric.field]);
            if (pz != null) {
                previous = { percentile: percentileFromZ(pz), date: prevRow.date };
            }
        }
        return { latest, value, z, percentile: percentileFromZ(z), previous, ...describeZ(z) };
    }, [measurements, activeMetric.field, metricKey, sexKey, profile.dateOfBirth]);

    // Where each past measurement sat, at the age it was taken. Restates a
    // published reference position per row — the same thing the chart draws,
    // in words, for the rows the chart cannot label.
    const percentileFor = (m, field, indicator) => {
        if (!sexKey || m.day == null || m.day > WHO_MAX_DAY) return null;
        const v = m[field];
        if (v == null || !(v > 0)) return null;
        const z = zScore(indicator, sexKey, m.day, v);
        return z == null ? null : formatPercentile(percentileFromZ(z));
    };

    // Achieved milestones the parent actually authored — one carrying a photo
    // or a note. A bare checklist tick is a record, not a keepsake: the
    // Development Checklist now offers ~146 items, and including every tick
    // here would bury a family's photographs under rows of plain text they
    // never wrote. Ticks still show on the checklist itself, with their date.
    const completedMilestones = useMemo(
        () => mstones.filter((m) => m.isCompleted && (m.photoUrl || m.description)),
        [mstones],
    );

    // One chronological history of everything worth keeping: photo memories
    // and achieved milestones together, newest first.
    //
    // Milestones belong here because the Development Checklist only shows six
    // reference items (utils/milestoneChecklist.js) and draws a tick when a
    // record matches one by title. A milestone like "First Steps" is not among
    // those six, so this timeline is the only place it appears — which is also
    // why the add form had to be able to create one.
    const galleryItems = useMemo(() => {
        const items = [
            ...memories.map((m) => ({ ...m, kind: "memory" })),
            ...completedMilestones.map((m) => ({ ...m, kind: "milestone" })),
        ];
        return items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    }, [memories, completedMilestones]);

    const filteredGallery = useMemo(
        () =>
            galleryFilter === "all"
                ? galleryItems
                : galleryItems.filter((i) => i.kind === galleryFilter),
        [galleryItems, galleryFilter],
    );

    // Group the visible slice into month buckets. Grouping after the cap, not
    // before, so "Show more" reveals the next ten items rather than the next
    // whole month.
    const galleryMonths = useMemo(() => {
        const buckets = [];
        for (const item of filteredGallery.slice(0, memoriesVisible)) {
            const label = monthLabel(item.date) || "Undated";
            const last = buckets[buckets.length - 1];
            if (last && last.label === label) last.items.push(item);
            else buckets.push({ label, items: [item] });
        }
        return buckets;
    }, [filteredGallery, memoriesVisible]);

    const GALLERY_FILTERS = [
        { key: "all", label: "All", noun: "items" },
        { key: "memory", label: "Photos", noun: "photos" },
        { key: "milestone", label: "Milestones", noun: "milestones" },
    ];

    const todayStr = () => todayLocal();
    const handleToggleMilestone = async (title) => {
        // Matched through normalizeTitle, never `===`. Titles now come from
        // the parent's own typing as well as this checklist, so a stray
        // capital or double space must not create a second record for a
        // milestone that already exists.
        const existing = findRecorded(mstones, title);
        if (existing) {
            const now = !existing.isCompleted;
            setMstones((prev) =>
                prev.map((m) => (m.id === existing.id ? { ...m, isCompleted: now, date: todayStr() } : m)),
            );
            try {
                await api.updateRecord(profile.id, "milestones", existing.id, {
                    is_completed: now,
                    date_recorded: todayStr(),
                });
            } catch (e) {
                setMstones((prev) => prev.map((m) => (m.id === existing.id ? existing : m)));
                toast.error(e.message || "Could not update milestone");
            }
        } else {
            try {
                const saved = await api.createRecord(profile.id, "milestones", {
                    title,
                    is_completed: true,
                    date_recorded: todayStr(),
                });
                setMstones((prev) => [milestoneToApp(saved), ...prev]);
            } catch (e) {
                toast.error(e.message || "Could not add milestone");
            }
        }
    };

    // Metric adding state
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    // Which row the form is editing (null = adding a new one), and which row
    // has armed its delete confirm. Delete is two-step in place rather than a
    // native alert: CLAUDE.md records that RN `Alert` is unreliable on the web
    // build, and settings/PrivacySettings.js is the pattern that works there.
    const [editingGrowth, setEditingGrowth] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // The form owns validation, the save, and the toast now — see
    // ui/GrowthModal.js. All this has to do is refresh the list so the chart,
    // the percentile read-out and the history include what just changed.
    const handleGrowthSaved = (saved) => {
        setReloadTick((n) => n + 1);
        // Keeps the profile's cached "current" values in step with the newest
        // measurement, as the old inline handler did. These duplicate the
        // latest growth row onto the child record and other screens read them;
        // untangling that is its own piece of work.
        if (!editingGrowth && (saved?.height != null || saved?.weight != null)) {
            onUpdateProfile({
                ...profile,
                currentHeight: saved.height != null ? Number(saved.height) : profile.currentHeight,
                currentWeight: saved.weight != null ? Number(saved.weight) : profile.currentWeight,
            });
        }
    };

    const handleDeleteGrowth = async (id) => {
        try {
            await api.deleteRecord(profile.id, "growth", id);
            setConfirmDeleteId(null);
            setReloadTick((n) => n + 1);
            toast.success("Measurement removed");
        } catch (e) {
            toast.error(e.message || "Could not remove the measurement");
        }
    };

    return (
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            refreshControl={refreshControl}
            {...scrollProps}
            keyboardShouldPersistTaps="handled"
        >
            <TipStrip tipKey="tip_growth">
                Measurements plot against WHO growth curves, so you can see where your child sits versus the
                standard for their age.
            </TipStrip>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "metrics" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("metrics")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            { textAlign: "center" },
                            growthTab === "metrics" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Growth
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "milestones" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("milestones")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            { textAlign: "center" },
                            growthTab === "milestones" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Milestones
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        growthTab === "gallery" && styles.tabButtonActive,
                    ]}
                    onPress={() => setGrowthTab("gallery")}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabButtonText,
                            { textAlign: "center" },
                            growthTab === "gallery" &&
                                styles.tabButtonTextActive,
                        ]}
                    >
                        Gallery
                    </Text>
                </TouchableOpacity>
            </View>

            {/* GROWTH TAB: MILESTONES */}
            {growthTab === "milestones" && (
                <View>
                    <SectionContainerCard
                        title="Development Checklist"
                        subtitle={t("growthMilestonesSub")}
                    >
                        {/* One control instead of twelve scrolling pills. It
                            always shows the age being viewed, so a parent can
                            read it without opening anything, and it starts on
                            their own child's band. */}
                        <TouchableOpacity
                            style={styles.bandTrigger}
                            onPress={() => setBandSheetOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel={`Age ${bandLabel(selectedBand)}. Choose a different age`}
                        >
                            <Text style={styles.bandTriggerText}>{bandLabel(selectedBand)}</Text>
                            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        {/* A count, never a score. "Recorded" because it counts
                            entries the parent made, not development. No bar and
                            no percentage — those read as a grade. */}
                        <Text style={styles.bandCount}>
                            {`${bandRecordedCount} of ${bandItems.length} recorded`}
                        </Text>

                        {DOMAINS.map((domain) => {
                            const items = bandItems.filter((i) => i.domain === domain.key);
                            if (!items.length) return null;
                            const tint = colors[domain.tint] || { bg: colors.surfaceAlt, on: colors.primary };
                            return (
                                <View key={domain.key} style={styles.domainGroup}>
                                    <View style={styles.domainHeader}>
                                        <View style={[styles.domainIcon, { backgroundColor: tint.bg }]}>
                                            <Ionicons name={domain.icon} size={14} color={tint.on} />
                                        </View>
                                        <Text style={styles.domainLabel}>{domain.label}</Text>
                                    </View>

                                    {items.map((item) => {
                                        const rec = findRecorded(mstones, item.title);
                                        const isDone = !!rec && rec.isCompleted;
                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={styles.checklistRow}
                                                onPress={() => handleToggleMilestone(item.title)}
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: isDone }}
                                                accessibilityLabel={item.title}
                                            >
                                                {/* The parent's own photo is the
                                                    only image on this row that
                                                    means anything. The stock
                                                    Unsplash pictures of other
                                                    people's babies are gone —
                                                    they carried no information
                                                    and 146 of them would be a
                                                    lot of network for nothing. */}
                                                {isDone && rec.photoUrl ? (
                                                    <Image
                                                        source={{ uri: rec.photoUrl }}
                                                        style={styles.checklistImg}
                                                    />
                                                ) : null}

                                                <View style={{ flex: 1, marginRight: 8 }}>
                                                    <Text style={styles.checklistTitle}>
                                                        {item.title}
                                                    </Text>
                                                    {isDone && rec.date ? (
                                                        <Text style={styles.checklistDone}>
                                                            {`Recorded ${shortDate(rec.date)}`}
                                                            {rec.ageAchieved ? ` · ${rec.ageAchieved}` : ""}
                                                        </Text>
                                                    ) : null}
                                                </View>

                                                {/* Unticked is neutral, never
                                                    coral or amber — DESIGN.md
                                                    reserves those for overdue,
                                                    error and caution, and a
                                                    milestone not yet reached is
                                                    none of the three. */}
                                                <View
                                                    style={[
                                                        styles.checkBtn,
                                                        isDone && styles.checkBtnActive,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={isDone ? "checkmark" : "square-outline"}
                                                        size={18}
                                                        color={isDone ? colors.onPrimary : colors.primary}
                                                    />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })}

                        {/* Principle 5 surface. Same register as the growth
                            percentile note further down this screen: state the
                            reference, hand the reading to a health worker. */}
                        <View style={styles.promptBox}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={16}
                                color={colors.info}
                                style={{ marginTop: 1 }}
                            />
                            <Text style={styles.promptText}>
                                Children develop at their own pace, and reaching something later than
                                this list says is common. Nothing here is a test or a score — if
                                anything about your child's development worries you, your health
                                worker is the person to ask.
                            </Text>
                        </View>

                        <Text style={styles.sourceNote}>
                            Based on the CDC&apos;s &ldquo;Learn the Signs. Act Early.&rdquo;
                            developmental milestones (2022 revision), which describe what most
                            children can do by each age. This is a shortened list — see cdc.gov for
                            the full one, and note that health centres and day care centres in the
                            Philippines use their own ECCD Checklist. The list ends at 5 years
                            because published milestone checklists do.
                        </Text>
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: GALLERY — one photo timeline, memories and
                achieved milestones together, newest first, grouped by month.
                Two-up: the same MemoryVisualCard was rendered full width here
                while the Dashboard showed it at 48%, so this tab fitted about
                one and a half items per screen. */}
            {growthTab === "gallery" && (
                <View>
                    <SectionContainerCard
                        title="Gallery"
                        subtitle="Photos and milestones, newest first"
                        action={
                            <TouchableOpacity
                                onPress={() => setShowAddMemory(true)}
                                style={styles.addBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Add a photo or milestone"
                            >
                                <Ionicons name="add" size={16} color={colors.onPrimary} />
                            </TouchableOpacity>
                        }
                    >
                        {!growthLoading && galleryItems.length > 0 && (
                            <View style={styles.galleryFilters}>
                                {GALLERY_FILTERS.map((f) => {
                                    const on = galleryFilter === f.key;
                                    const n =
                                        f.key === "all"
                                            ? galleryItems.length
                                            : galleryItems.filter((i) => i.kind === f.key).length;
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            onPress={() => {
                                                setGalleryFilter(f.key);
                                                setMemoriesVisible(10);
                                            }}
                                            style={[styles.galleryChip, on && styles.galleryChipOn]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={`${f.label}, ${n} item${n === 1 ? "" : "s"}`}
                                        >
                                            <Text
                                                style={[
                                                    styles.galleryChipText,
                                                    on && styles.galleryChipTextOn,
                                                ]}
                                            >
                                                {f.label} {n}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {growthLoading && <MemoriesSkeleton count={2} />}

                        {!growthLoading && galleryItems.length === 0 && (
                            <EmptyStateCard
                                message="Nothing here yet. Tap + to save a photo or record a milestone."
                                icon="image-outline"
                            />
                        )}
                        {!growthLoading && galleryItems.length > 0 && filteredGallery.length === 0 && (
                            <EmptyStateCard
                                message="No entries of this kind yet."
                                icon="filter-outline"
                            />
                        )}

                        {!growthLoading &&
                            galleryMonths.map((bucket) => (
                                <View key={bucket.label}>
                                    <Text style={styles.galleryMonth}>{bucket.label}</Text>
                                    <View style={styles.galleryGrid}>
                                        {bucket.items.map((item, idx) => (
                                            <MemoryVisualCard
                                                key={`${item.kind}-${item.id || idx}`}
                                                style={styles.galleryTile}
                                                title={item.title}
                                                description={item.description}
                                                // The month header already
                                                // states the year, so the tile
                                                // drops it. The kind is spelled
                                                // out here too — the trophy
                                                // badge alone would leave the
                                                // distinction resting on one
                                                // small glyph.
                                                date={[
                                                    shortDate(item.date).replace(/\s\d{4}$/, ""),
                                                    item.kind === "milestone" ? "Milestone" : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                                photoUrl={item.photoUrl}
                                                badge={item.kind === "milestone" ? "trophy" : null}
                                                placeholderIcon={
                                                    item.kind === "milestone"
                                                        ? "trophy-outline"
                                                        : "image-outline"
                                                }
                                                onClick={() => setDetailMemory(item)}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ))}

                        {!growthLoading && (
                            <ShowMore
                                total={filteredGallery.length}
                                visible={memoriesVisible}
                                onPress={() => setMemoriesVisible((c) => c + 10)}
                                noun={
                                    (GALLERY_FILTERS.find((f) => f.key === galleryFilter) || {})
                                        .noun || "items"
                                }
                            />
                        )}
                    </SectionContainerCard>
                </View>
            )}

            {/* GROWTH TAB: PHYSICAL METRICS */}
            {growthTab === "metrics" && (
                <View>
                    <SectionContainerCard
                        title="Physical Metrics Logs"
                        subtitle="Record parameters to track baby's physical development indices"
                        action={
                            <TouchableOpacity
                                onPress={() => {
                                    setEditingGrowth(null);
                                    setShowMetricsModal(true);
                                }}
                                style={styles.addApptBtn}
                            >
                                <Ionicons
                                    name="add"
                                    size={16}
                                    color="#FFFFFF"
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={styles.addApptBtnText}>
                                    {t("growthAddMetrics")}
                                </Text>
                            </TouchableOpacity>
                        }
                    >
                        {growthLoading ? (
                            <>
                                <SkeletonBlock width="100%" height={64} radius={radius.md} style={{ marginBottom: 16 }} />
                                <SkeletonBlock width="100%" height={200} radius={radius.lg} />
                            </>
                        ) : (
                            <>
                        {/* Three across, always. The columns use flexShrink /
                            minWidth longhand rather than any `flex` shorthand:
                            `flex: 0` collapses a box on react-native-web
                            (Dashboard.js) and `min-width: auto` stops one
                            shrinking (NutritionTracker.js). Both traps live in
                            exactly this shape. */}
                        <View style={styles.metricsHeaderBox}>
                            {[
                                { key: "weight", label: "Weight", unit: "kg" },
                                { key: "height", label: "Height", unit: "cm" },
                                { key: "head", label: "Head", unit: "cm" },
                            ].map((col, i) => (
                                <React.Fragment key={col.key}>
                                    {i > 0 ? <View style={styles.metricsHeaderDivider} /> : null}
                                    <View style={styles.metricsHeaderCol}>
                                        <Text style={styles.metricsHeaderLabel} numberOfLines={1}>
                                            {col.label}
                                        </Text>
                                        <Text style={styles.metricsHeaderValue} numberOfLines={1}>
                                            {latestVitals[col.key]
                                                ? `${latestVitals[col.key].value} ${col.unit}`
                                                : "—"}
                                        </Text>
                                    </View>
                                </React.Fragment>
                            ))}
                        </View>

                        {lastMeasured ? (
                            <Text style={styles.lastMeasured}>
                                {lastMeasured.text} · {shortDate(lastMeasured.date)}
                                {lastMeasured.missing
                                    ? ` · no ${lastMeasured.missing} recorded that day`
                                    : ""}
                            </Text>
                        ) : null}

                        <View style={styles.metricSwitch}>
                            {METRIC_TABS.map((m) => {
                                const on = metricKey === m.key;
                                return (
                                    <TouchableOpacity
                                        key={m.key}
                                        onPress={() => setMetricKey(m.key)}
                                        style={[styles.metricChip, on && styles.metricChipOn]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on }}
                                        accessibilityLabel={`Show ${m.label} chart`}
                                    >
                                        <Text style={[styles.metricChipText, on && styles.metricChipTextOn]}>
                                            {m.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <PercentileChart
                            indicator={metricKey}
                            sex={sexKey}
                            dateOfBirth={profile.dateOfBirth}
                            rows={growthRows}
                        />

                        {reading ? (
                            <View style={styles.readingBox}>
                                <View style={styles.readingTop}>
                                    <Text style={styles.readingValue}>
                                        {reading.value} {unitFor(metricKey)}
                                    </Text>
                                    <Text style={styles.readingPct}>
                                        {formatPercentile(reading.percentile)} percentile
                                    </Text>
                                </View>
                                <Text style={styles.readingText}>
                                    {reading.text} — measured at {ageLabel(reading.latest.day)}.
                                </Text>
                                {/* Both positions, both dates, nothing else.
                                    See the note on `previous` above before
                                    adding an arrow or a difference here. */}
                                {reading.previous ? (
                                    <Text style={styles.readingPrev}>
                                        Previously {formatPercentile(reading.previous.percentile)} on{" "}
                                        {shortDate(reading.previous.date)}.
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}

                        {reading && reading.flag ? (
                            <View style={styles.promptBox}>
                                <Ionicons
                                    name="chatbubble-ellipses-outline"
                                    size={16}
                                    color={colors.info}
                                    style={{ marginTop: 1 }}
                                />
                                <Text style={styles.promptText}>
                                    Worth mentioning at the next check-up. Children grow at different rates
                                    and a single measurement outside the range is common — your health
                                    worker can tell you whether it means anything.
                                </Text>
                            </View>
                        ) : null}

                        <Text style={styles.sourceNote}>
                            {sexKey
                                ? `Shaded bands are the WHO Child Growth Standards for ${sexKey}, birth to 5 years. This compares your child with a reference population — it is not a medical assessment.`
                                : "Reference bands come from the WHO Child Growth Standards, birth to 5 years. They compare a child with a reference population and are not a medical assessment."}
                        </Text>
                            </>
                        )}
                    </SectionContainerCard>

                    <SectionContainerCard
                        title="Measurement History"
                        subtitle={
                            measurements.length
                                ? `${measurements.length} recorded, newest first`
                                : "Every measurement you record appears here"
                        }
                    >
                        {growthLoading ? (
                            <AppointmentsSkeleton count={3} />
                        ) : measurements.length === 0 ? (
                            <EmptyStateCard
                                message="No measurements recorded yet. Add one to start the chart."
                                icon="analytics-outline"
                            />
                        ) : (
                            <>
                                {measurements.slice(0, metricsVisible).map((m) => {
                                    const parts = [];
                                    if (m.weight != null) parts.push(`${m.weight} kg`);
                                    if (m.height != null) parts.push(`${m.height} cm`);
                                    if (m.head_circumference != null)
                                        parts.push(`head ${m.head_circumference} cm`);
                                    // Where this row sat against WHO at the age it was
                                    // taken, for the metric currently on screen.
                                    const pct = percentileFor(m, activeMetric.field, metricKey);
                                    const place = PLACE_LABELS[m.measured_at] || null;
                                    const armed = confirmDeleteId === m.id;
                                    return (
                                        <ListEntryCard
                                            key={m.id ?? m.date}
                                            title={parts.join("  ·  ") || "No values recorded"}
                                            subtitle={[
                                                shortDate(m.date),
                                                m.day != null ? ageLabel(m.day) : null,
                                                place,
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                            label={pct ? `${pct} ${activeMetric.label.toLowerCase()}` : null}
                                            notes={m.notes || null}
                                            icon={
                                                <MaterialCommunityIcons
                                                    name="scale"
                                                    size={18}
                                                    color={colors.recGrowth.on}
                                                />
                                            }
                                            iconBg={colors.recGrowth.bg}
                                            actions={
                                                <View style={styles.rowActions}>
                                                    {armed ? (
                                                        <>
                                                            {/* Two-step, in place. A growth row
                                                                feeds the chart and the
                                                                healthcare professional's
                                                                percentile, so it must not
                                                                vanish on a single tap. */}
                                                            <TouchableOpacity
                                                                onPress={() => handleDeleteGrowth(m.id)}
                                                                style={styles.confirmDeleteBtn}
                                                                accessibilityRole="button"
                                                                accessibilityLabel="Confirm delete measurement"
                                                            >
                                                                <Text style={styles.confirmDeleteText}>
                                                                    Delete?
                                                                </Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => setConfirmDeleteId(null)}
                                                                style={styles.rowIconBtn}
                                                                accessibilityRole="button"
                                                                accessibilityLabel="Keep measurement"
                                                            >
                                                                <Ionicons
                                                                    name="close"
                                                                    size={18}
                                                                    color={colors.textMuted}
                                                                />
                                                            </TouchableOpacity>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    setConfirmDeleteId(null);
                                                                    setEditingGrowth(m.raw);
                                                                    setShowMetricsModal(true);
                                                                }}
                                                                style={styles.rowIconBtn}
                                                                accessibilityRole="button"
                                                                accessibilityLabel="Edit measurement"
                                                            >
                                                                <Ionicons
                                                                    name="create-outline"
                                                                    size={18}
                                                                    color={colors.primary}
                                                                />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => setConfirmDeleteId(m.id)}
                                                                style={styles.rowIconBtn}
                                                                accessibilityRole="button"
                                                                accessibilityLabel="Delete measurement"
                                                            >
                                                                <Ionicons
                                                                    name="trash-outline"
                                                                    size={18}
                                                                    color={colors.danger}
                                                                />
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                </View>
                                            }
                                        />
                                    );
                                })}
                                <ShowMore
                                    total={measurements.length}
                                    visible={metricsVisible}
                                    onPress={() => setMetricsVisible((c) => c + 10)}
                                    noun="measurements"
                                />
                            </>
                        )}
                    </SectionContainerCard>
                </View>
            )}

            {/* One form for adding a measurement and for correcting one.
                It owns its own validation, save and toast now: the old
                inline version announced success from outside its try/catch
                and lost the measurement on a failed request. */}
            <GrowthModal
                visible={showMetricsModal}
                profile={profile}
                record={editingGrowth}
                onClose={() => {
                    setShowMetricsModal(false);
                    setEditingGrowth(null);
                }}
                onSaved={handleGrowthSaved}
            />

            <MemoryDetail
                visible={!!detailMemory}
                memory={detailMemory}
                dob={profile.dateOfBirth}
                // The Gallery now opens both kinds, so the label follows the
                // entry instead of always claiming "Milestone".
                typeLabel={detailMemory?.kind === "memory" ? "Photo Memory" : "Milestone"}
                onClose={() => setDetailMemory(null)}
            />

            {/* The age menu. Every band stays freely selectable; the child's
                own is marked rather than forced. */}
            <OptionSheet
                visible={bandSheetOpen}
                title="Choose an age"
                options={bandOptions}
                selectedKey={selectedBand}
                onSelect={(key) => {
                    setSelectedBand(key);
                    setBandSheetOpen(false);
                }}
                onClose={() => setBandSheetOpen(false)}
            />

            {/* One form for both kinds. `milestones` feeds its suggestion
                chips, which offer only checklist items this child has not
                recorded yet — so tapping one cannot create a duplicate. */}
            <AddMemoryModal
                visible={showAddMemory}
                profile={profile}
                milestones={mstones}
                onClose={() => setShowAddMemory(false)}
                onSaved={(record, kind) =>
                    kind === "milestone"
                        ? setMstones((prev) => [record, ...prev])
                        : setMemories((prev) => [record, ...prev])
                }
            />
        </Animated.ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "transparent", // lets App.js's page gradient show through
    },
    // See the note on Health.js's `content`: padding on the ScrollView's own
    // box does not scroll, so the bottom clearance has to live on the content.
    content: {
        padding: space.lg,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.xs,
        marginBottom: space.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabButton: {
        flex: 1,
        minWidth: 0,
        paddingVertical: space.sm + 2,
        // Zero, so the longest label gets the button's full share of the row —
        // the same fix Health.js's tab bar already carries.
        paddingHorizontal: 0,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    tabButtonActive: {
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    // Both states are the SAME SIZE, differing only in weight and colour —
    // DESIGN.md's Weight Ladder Rule. This spread `type.label` (14px) AFTER
    // `type.caption` (13px), so selecting a tab GREW its own text inside a
    // flex:1 box with nothing to absorb the extra width. It is the identical
    // defect already fixed in Health.js, which had survived here unnoticed
    // because Growth has three tabs rather than four and clipped later.
    tabButtonText: {
        ...type.caption,
        color: colors.textMuted,
    },
    tabButtonTextActive: {
        color: colors.primaryDark,
        fontWeight: "700",
    },
    // Opens the age menu. Shows the band being viewed so the age is readable
    // without opening anything — the twelve-pill scroller it replaced pushed
    // most bands, sometimes the selected one, off-screen.
    bandTrigger: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: MIN_TOUCH,
        paddingHorizontal: space.md,
        marginBottom: space.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    bandTriggerText: {
        ...type.bodyStrong,
        color: colors.text,
    },
    // "4 of 12 recorded". A count, never a percentage or a bar — this screen
    // must not read as a score (PRODUCT.md Principle 5).
    bandCount: {
        ...type.caption,
        color: colors.textMuted,
        marginBottom: space.md,
    },
    domainGroup: { marginBottom: space.lg },
    domainHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginBottom: space.sm,
    },
    domainIcon: {
        width: 24,
        height: 24,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    domainLabel: {
        ...type.label,
        color: colors.textSecondary,
    },
    checklistRow: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: MIN_TOUCH,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
        paddingBottom: 12,
    },
    checklistImg: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderCurve: "continuous",
        marginRight: 10,
    },
    checklistTitle: {
        ...type.body,
        color: colors.text,
    },
    // "Recorded 12 Mar 2025 · 5 months" — the parent's own record behind the
    // tick, in the app's success tone rather than a neutral grey.
    checklistDone: {
        ...type.caption,
        color: colors.success,
        marginTop: 4,
    },
    checkBtn: {
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    checkBtnActive: {
        backgroundColor: colors.primary,
    },
    addApptBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accentStrong,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    addApptBtnText: {
        ...type.label,
        color: "#FFFFFF",
    },
    lastMeasured: {
        ...type.caption,
        color: colors.textMuted,
        marginTop: -8,
        marginBottom: 16,
    },
    rowActions: { flexDirection: "row", alignItems: "center", gap: space.xs },
    rowIconBtn: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: "center",
        justifyContent: "center",
    },
    confirmDeleteBtn: {
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.dangerBg,
        borderWidth: 1,
        borderColor: colors.danger,
    },
    confirmDeleteText: { ...type.caption, fontWeight: "800", color: colors.danger },
    readingPrev: { ...type.caption, color: colors.textMuted, marginTop: space.xs },
    metricsHeaderBox: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: 16,
        alignItems: "center",
        marginBottom: 16,
    },
    metricsHeaderCol: {
        // Longhand, and minWidth: 0 explicitly. Three columns in a row is
        // the exact shape both react-native-web flex traps live in --
        // `flex: 0` collapsing a box (Dashboard.js) and `min-width: auto`
        // refusing to shrink one (NutritionTracker.js).
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignItems: "center",
    },
    metricsHeaderLabel: {
        ...type.subheading,
        color: colors.textMuted,
    },
    metricsHeaderValue: {
        ...type.heading,
        color: colors.primary,
        marginTop: 4,
    },
    metricsHeaderDivider: {
        width: 1,
        height: "100%",
        backgroundColor: colors.border,
    },
    metricSwitch: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
    },
    metricChip: {
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    metricChipOn: {
        backgroundColor: colors.softGreen,
        borderColor: colors.primary,
    },
    metricChipText: { ...type.label, color: colors.textMuted },
    metricChipTextOn: { color: colors.primaryDark },

    // Gallery tab
    addBtn: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    galleryFilters: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
    galleryChip: {
        flex: 1,
        minHeight: MIN_TOUCH,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.sm,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    galleryChipOn: { backgroundColor: colors.softGreen, borderColor: colors.primary },
    galleryChipText: { ...type.caption, color: colors.textMuted },
    galleryChipTextOn: { color: colors.primaryDark, fontWeight: "700" },
    galleryMonth: { ...type.subheading, color: colors.textMuted, marginTop: space.sm, marginBottom: space.sm },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    galleryTile: { width: "48%" },
    readingBox: {
        marginTop: 14,
        padding: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.hairline,
    },
    readingTop: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 4,
    },
    readingValue: { ...type.title, color: colors.text },
    readingPct: { ...type.bodyStrong, color: colors.primary },
    readingText: { ...type.bodyStrong, color: colors.textSecondary },
    promptBox: {
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
        padding: 14,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.infoBg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    promptText: { flex: 1, ...type.caption, color: colors.textSecondary },
    sourceNote: {
        marginTop: 12,
        ...type.caption,
        color: colors.textMuted,
    },
});
