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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { radius, space, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { api } from "../utils/api";
import { memoryToApp } from "../utils/adapters";
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

function monthsOld(dob) {
    if (!dob) return 0;
    const b = new Date(`${String(dob).slice(0, 10)}T00:00:00`);
    if (isNaN(b.getTime())) return 0;
    const now = new Date();
    let m = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) m -= 1;
    return Math.max(0, m);
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

// Age-appropriate parenting tips (picked by the child's age).
const TIPS = [
    { max: 6, text: "Give plenty of tummy time while awake — it strengthens neck and shoulder muscles for rolling and sitting." },
    { max: 12, text: "Offer soft finger foods to encourage self-feeding. It builds fine motor skills and independence." },
    { max: 24, text: 'At this age, toddlers love to "help." Let them put toys in a bin or hand you items to build confidence and coordination.' },
    { max: 1000, text: "Read together every day. Naming pictures and repeating simple words grows vocabulary and focus." },
];
function tipFor(dob) {
    const m = monthsOld(dob);
    return (TIPS.find((t) => m < t.max) || TIPS[TIPS.length - 1]).text;
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

    // Recent Activity — a combined, most-recent-first feed of records.
    const [activity, setActivity] = useState([]);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [vax, checkups, nutrition, milestones] = await Promise.all([
                    api.listRecords(profile.id, "vaccinations").catch(() => []),
                    api.listRecords(profile.id, "checkups").catch(() => []),
                    api.listRecords(profile.id, "nutrition").catch(() => []),
                    api.listRecords(profile.id, "milestones").catch(() => []),
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
                setActivity(past.slice(0, 5));
            } catch (e) {
                console.log("load activity:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    // Photo memories load from and persist to the backend.
    const [memories, setMemories] = useState([]);
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

    const weight = profile.currentWeight || profile.birthWeight;
    const height = profile.currentHeight || profile.birthHeight;
    const sexLabel = profile.gender === "boy" ? "Male" : "Female";
    const age = ageText(profile.dateOfBirth);

    const nav = (view, tab) => onChangeView && onChangeView(view, tab);
    // Quick Actions mirror the Stitch design and deep-link to the matching module.
    const quickActions = [
        { key: "milk", label: "Log Milk", lib: "mci", icon: "baby-bottle-outline", color: colors.primary, onPress: () => nav("growth", "nutrition") },
        { key: "food", label: "Log Food", lib: "ion", icon: "restaurant-outline", color: colors.success, onPress: () => nav("growth", "nutrition") },
        { key: "medical", label: "Medical", lib: "ion", icon: "medkit-outline", color: colors.danger, onPress: () => nav("health", "immunizations") },
        { key: "milestone", label: "Milestone", lib: "ion", icon: "trophy-outline", color: colors.info, onPress: () => nav("growth", "milestones") },
    ];

    // Baby summary meta as a 2-column grid (order matches Stitch).
    const babyMeta = [
        { icon: profile.gender === "boy" ? "male" : "female", text: sexLabel },
        { icon: "time-outline", text: age || "—" },
        { icon: "scale-outline", text: `${weight} kg` },
        { icon: "resize-outline", text: `${height} cm` },
    ];

    const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, info: colors.info };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: space.xxl }}>
            {/* Greeting hero */}
            <View style={styles.hero}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                    Hello, {parentName || profile.name}
                </Text>
                {age ? (
                    <Text style={styles.heroSubtitle}>Your little one is {age} old today 🎉</Text>
                ) : null}
            </View>

            {/* Baby switcher */}
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
                        >
                            <Image source={{ uri: p.avatarUrl }} style={styles.avatarMini} />
                            <Text style={[styles.profileName, profile.id === p.id && styles.profileNameActive]}>
                                {p.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={onOpenAddModal} style={styles.addProfileButton}>
                        <Ionicons name="add" size={18} color={colors.primary} />
                        <Text style={styles.addProfileText}>Add</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Baby Summary Card — 2-column meta grid */}
            <View style={styles.summaryCard}>
                <Image source={{ uri: profile.avatarUrl }} style={styles.summaryAvatar} />
                <View style={{ flex: 1 }}>
                    <View style={styles.summaryTopRow}>
                        <Text style={styles.summaryName} numberOfLines={1}>
                            {profile.name}
                        </Text>
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
                            <View key={idx} style={styles.metaItem}>
                                <Ionicons name={m.icon} size={14} color={colors.primary} />
                                <Text style={styles.metaText}>{m.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionHeading}>Quick Actions</Text>
            <View style={styles.quickGrid}>
                {quickActions.map((qa) => (
                    <TouchableOpacity
                        key={qa.key}
                        style={styles.quickTile}
                        onPress={qa.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={qa.label}
                    >
                        {qa.lib === "mci" ? (
                            <MaterialCommunityIcons name={qa.icon} size={28} color={qa.color} />
                        ) : (
                            <Ionicons name={qa.icon} size={26} color={qa.color} />
                        )}
                        <Text style={styles.quickTileLabel}>{qa.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Milestone Memories — square photo gallery */}
            <View style={styles.gallerySection}>
                <View style={styles.galleryHeader}>
                    <Text style={styles.sectionHeadingFlush}>Milestone Memories</Text>
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
                {memories.length ? (
                    <View style={styles.galleryGrid}>
                        {memories.slice(0, 6).map((m, idx) => (
                            <View key={m.id || idx} style={styles.galleryCard}>
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
                            </View>
                        ))}
                    </View>
                ) : (
                    <EmptyStateCard message="No memories yet. Tap Add to save your baby's precious moments." icon="image-outline" />
                )}
            </View>

            {/* Recent Activity */}
            <Text style={styles.sectionHeading}>Recent Activity</Text>
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

            {/* Parenting Tip */}
            <View style={styles.tipCard}>
                <Ionicons name="bulb" size={96} color={colors.primary} style={styles.tipCornerIcon} />
                <Text style={styles.tipTitle}>Parenting Tip</Text>
                <Text style={styles.tipText}>{tipFor(profile.dateOfBirth)}</Text>
            </View>

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

    // Greeting hero
    hero: { marginBottom: space.lg },
    heroTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
    heroSubtitle: { fontSize: 14, fontWeight: "500", color: colors.textSecondary, marginTop: 2 },

    // Baby switcher
    profileBar: { marginBottom: space.md },
    profilesScroll: { alignItems: "center", paddingRight: space.xs },
    profileTab: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        paddingHorizontal: space.md,
        paddingVertical: 7,
        marginRight: space.sm,
        ...shadow.card,
    },
    profileTabActive: { borderColor: colors.accent, backgroundColor: colors.softCoral },
    avatarMini: { width: 26, height: 26, borderRadius: 13, marginRight: 7 },
    profileName: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    profileNameActive: { color: colors.accentStrong, fontWeight: "800" },
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
    },
    addProfileText: { fontSize: 13, fontWeight: "700", color: colors.primary, marginLeft: 3 },

    // Baby Summary Card
    summaryCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: space.md,
        marginBottom: space.lg,
        ...shadow.card,
    },
    summaryAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginRight: space.md,
        borderWidth: 2,
        borderColor: colors.softCoral,
    },
    summaryTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    summaryName: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
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

    // Section heading
    sectionHeading: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: space.md },
    sectionHeadingFlush: { fontSize: 16, fontWeight: "800", color: colors.text },

    // Quick Actions grid (2x2 vertical icon tiles)
    quickGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: space.lg,
    },
    quickTile: {
        width: "48%",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: space.lg,
        marginBottom: space.md,
        ...shadow.card,
    },
    quickTileLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },

    // Milestone Memories gallery
    gallerySection: { marginBottom: space.lg },
    galleryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.md,
    },
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

    // Parenting Tip
    tipCard: {
        backgroundColor: colors.softGreen,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: space.lg,
        marginBottom: space.lg,
        overflow: "hidden",
    },
    tipCornerIcon: { position: "absolute", right: -10, bottom: -18, opacity: 0.1 },
    tipTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 4 },
    tipText: { fontSize: 13, fontWeight: "500", color: colors.textSecondary, lineHeight: 19 },

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
