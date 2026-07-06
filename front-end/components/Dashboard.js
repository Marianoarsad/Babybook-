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
import {
    SectionContainerCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";
import Gradient from "./ui/Gradient";
import { api } from "../utils/api";
import { memoryToApp, milestoneToApp } from "../utils/adapters";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";

export default function Dashboard({
    profile,
    profiles,
    onSelectProfile,
    onOpenAddModal,
    onOpenEditModal,
    onChangeView,
}) {
    const { t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();

    // Nearest upcoming vaccination/checkup, for the "Upcoming Appointments" widget.
    const [upcoming, setUpcoming] = useState(null);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [vaccinations, checkups] = await Promise.all([
                    api.listRecords(profile.id, "vaccinations").catch(() => []),
                    api.listRecords(profile.id, "checkups").catch(() => []),
                ]);
                if (!active) return;
                const todayStr = new Date().toISOString().slice(0, 10);
                const candidates = [
                    ...(vaccinations || [])
                        .filter((v) => v.status !== "completed" && v.due_date && String(v.due_date).slice(0, 10) >= todayStr)
                        .map((v) => ({
                            title: v.vaccine_name,
                            subtitle: v.visit_name || "Vaccination",
                            date: String(v.due_date).slice(0, 10),
                            icon: "medkit-outline",
                        })),
                    ...(checkups || [])
                        .filter((c) => c.status !== "completed" && c.checkup_date && String(c.checkup_date).slice(0, 10) >= todayStr)
                        .map((c) => ({
                            title: c.title || "Checkup",
                            subtitle: c.doctor_name || "Checkup",
                            date: String(c.checkup_date).slice(0, 10),
                            icon: "calendar-outline",
                        })),
                ].sort((a, b) => a.date.localeCompare(b.date));
                setUpcoming(candidates[0] || null);
            } catch (e) {
                console.log("load upcoming:", e.message);
            }
        })();
        return () => {
            active = false;
        };
    }, [profile.id]);

    // Completed milestones (shown as memory cards) load from the backend.
    const [mstones, setMstones] = useState([]);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = await api.listRecords(profile.id, "milestones");
                if (active) setMstones(rows.map(milestoneToApp));
            } catch (e) {
                console.log("load milestones:", e.message);
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
    const [memPhoto, setMemPhoto] = useState("");
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
        const photo = memPhoto;
        const photoUri = memPhotoUri;
        const date_recorded = new Date().toISOString().split("T")[0];
        setShowMemoryModal(false);
        setMemCaption("");
        setMemNotes("");
        setMemPhoto("");
        setMemPhotoUri("");
        try {
            const saved = photoUri
                ? await api.uploadMemory(profile.id, { photoUri, caption, notes, date_recorded })
                : await api.createRecord(profile.id, "memories", {
                      caption,
                      notes: notes || null,
                      photo_url: photo || null,
                      date_recorded,
                  });
            setMemories((prev) => [memoryToApp(saved), ...prev]);
            toast.success("Memory saved");
        } catch (e) {
            toast.error(e.message || "Could not save memory");
        }
    };

    const completedMilestones = mstones.filter((m) => m.isCompleted);

    return (
        <ScrollView style={styles.container}>
            {/* Baby Switcher Bar */}
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
                            style={[
                                styles.profileTab,
                                profile.id === p.id && styles.profileTabActive,
                            ]}
                        >
                            <Image source={{ uri: p.avatarUrl }} style={styles.avatarMini} />
                            <Text
                                style={[
                                    styles.profileName,
                                    profile.id === p.id && styles.profileNameActive,
                                ]}
                            >
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

            {/* Active Profile Header Info Card */}
            <Gradient colors={colors.gradient} style={styles.babyCard}>
                <View style={styles.babyAvatarRing}>
                    <Image source={{ uri: profile.avatarUrl }} style={styles.babyAvatar} />
                </View>
                <View style={styles.babyInfo}>
                    <Text style={styles.babyNameTitle} numberOfLines={1}>
                        {profile.name}
                    </Text>
                    {profile.nickname ? (
                        <Text style={styles.babyNickname} numberOfLines={1}>
                            “{profile.nickname}”
                        </Text>
                    ) : null}
                    <Text style={styles.babyDob}>DOB: {profile.dateOfBirth}</Text>
                    <View style={styles.babyStatsRow}>
                        <View style={styles.babyStatChip}>
                            <Ionicons name="resize-outline" size={12} color={colors.onPrimary} />
                            <Text style={styles.babyStatText}>
                                {profile.currentHeight || profile.birthHeight} cm
                            </Text>
                        </View>
                        <View style={styles.babyStatChip}>
                            <Ionicons name="scale-outline" size={12} color={colors.onPrimary} />
                            <Text style={styles.babyStatText}>
                                {profile.currentWeight || profile.birthWeight} kg
                            </Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={onOpenEditModal}
                    style={styles.editButton}
                    accessibilityRole="button"
                    accessibilityLabel="Edit child profile"
                >
                    <Ionicons name="pencil" size={16} color={colors.onPrimary} />
                </TouchableOpacity>
            </Gradient>

            {/* Quick links to the record modules */}
            <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickCard} onPress={() => onChangeView && onChangeView("health")}>
                    <View style={[styles.quickIcon, { backgroundColor: colors.tintGreen }]}>
                        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.quickLabel}>Health</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickCard} onPress={() => onChangeView && onChangeView("growth")}>
                    <View style={[styles.quickIcon, { backgroundColor: colors.tintAmber }]}>
                        <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.quickLabel}>Growth &amp; Nutrition</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickCard} onPress={() => onChangeView && onChangeView("share")}>
                    <View style={[styles.quickIcon, { backgroundColor: colors.tintCoral }]}>
                        <Ionicons name="qr-code" size={20} color={colors.accentStrong} />
                    </View>
                    <Text style={styles.quickLabel}>Share via QR</Text>
                </TouchableOpacity>
            </View>

            {/* Upcoming Appointments widget */}
            <SectionContainerCard
                title="Upcoming Appointments"
                subtitle={upcoming ? "Next on the calendar" : "Nothing scheduled right now"}
                action={
                    <TouchableOpacity
                        onPress={() => onChangeView && onChangeView("calendar")}
                        style={styles.viewCalendarBtn}
                        accessibilityRole="button"
                        accessibilityLabel="View Calendar"
                    >
                        <Text style={styles.viewCalendarText}>View Calendar</Text>
                    </TouchableOpacity>
                }
            >
                {upcoming ? (
                    <View style={styles.upcomingRow}>
                        <View style={[styles.upcomingIcon, { backgroundColor: colors.tintBlue }]}>
                            <Ionicons name={upcoming.icon} size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.upcomingTitle}>{upcoming.title}</Text>
                            <Text style={styles.upcomingSubtitle}>
                                {upcoming.subtitle} · {upcoming.date}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <EmptyStateCard message="No upcoming vaccinations or checkups." icon="calendar-outline" />
                )}
            </SectionContainerCard>

            {/* Milestone memory grids */}
            <SectionContainerCard title={t("dashMemoriesTitle")} subtitle={t("dashMemoriesSub")}>
                <View style={styles.memoriesGrid}>
                    {completedMilestones.slice(0, 2).map((m, idx) => (
                        <MemoryVisualCard
                            key={m.id || idx}
                            title={m.title}
                            description={m.description}
                            date={m.date}
                            photoUrl={m.photoUrl}
                        />
                    ))}
                    {completedMilestones.length === 0 && (
                        <EmptyStateCard message={t("dashEmptyMemories")} />
                    )}
                </View>
            </SectionContainerCard>

            {/* Photo Memories (saved to the backend) */}
            <SectionContainerCard
                title="Photo Memories"
                subtitle="Captured moments saved to your baby's book"
                action={
                    <TouchableOpacity
                        onPress={() => setShowMemoryModal(true)}
                        style={styles.addPill}
                        accessibilityRole="button"
                        accessibilityLabel="Add photo memory"
                    >
                        <Ionicons name="add" size={16} color={colors.onAccent} />
                        <Text style={styles.addPillText}>Add</Text>
                    </TouchableOpacity>
                }
            >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
                    {memories.slice(0, 4).map((m, idx) => (
                        <MemoryVisualCard
                            key={m.id || idx}
                            title={m.title}
                            description={m.description}
                            date={m.date}
                            photoUrl={m.photoUrl}
                        />
                    ))}
                    {memories.length === 0 && (
                        <EmptyStateCard message="No photo memories yet. Tap Add to save one." />
                    )}
                </View>
            </SectionContainerCard>

            {/* Add Memory Modal */}
            <Modal visible={showMemoryModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Photo Memory</Text>

                        <Text style={styles.modalLabel}>Caption</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="First steps!"
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

                        <Text style={styles.modalLabel}>Photo URL (optional)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="https://..."
                            autoCapitalize="none"
                            value={memPhoto}
                            onChangeText={setMemPhoto}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowMemoryModal(false)}
                                style={styles.modalCancelBtn}
                            >
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
    profileBar: { marginBottom: space.lg },
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
    babyCard: {
        borderRadius: radius.xl,
        borderCurve: "continuous",
        padding: space.lg + 2,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: space.lg,
        ...shadow.green,
    },
    babyAvatarRing: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: space.md,
    },
    babyAvatar: { width: 58, height: 58, borderRadius: 29 },
    babyInfo: { flex: 1 },
    babyNameTitle: { fontSize: 20, fontWeight: "800", color: colors.onPrimary, letterSpacing: 0.1 },
    babyNickname: { fontSize: 13, fontWeight: "600", color: colors.textOnDarkMuted, marginTop: 1, fontStyle: "italic" },
    babyDob: { fontSize: 12, color: colors.textOnDarkMuted, marginTop: 3, fontWeight: "500" },
    babyStatsRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
    babyStatChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "rgba(255,255,255,0.16)",
        paddingHorizontal: space.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
    },
    babyStatText: { fontSize: 12, color: colors.onPrimary, fontWeight: "700" },
    editButton: {
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.16)",
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    quickRow: { flexDirection: "row", gap: space.md, marginBottom: space.lg },
    quickCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.hairline,
        paddingVertical: space.md,
        alignItems: "center",
        gap: 6,
        ...shadow.card,
    },
    quickIcon: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
    },
    quickLabel: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, textAlign: "center" },
    viewCalendarBtn: {
        paddingVertical: 6,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.softGreen,
    },
    viewCalendarText: { fontSize: 12, fontWeight: "800", color: colors.accentStrong },
    upcomingRow: { flexDirection: "row", alignItems: "center" },
    upcomingIcon: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        marginRight: space.md,
    },
    upcomingTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    upcomingSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 3, fontWeight: "600" },
    memoriesGrid: { marginTop: space.xs },
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
