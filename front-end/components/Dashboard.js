import React, { useState, useEffect } from "react";
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
    MetricWidgetCard,
    ListEntryCard,
    MemoryVisualCard,
    EmptyStateCard,
} from "./common/Cards";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, space, shadow, type } from "../theme";
import { storage } from "../utils/storageAdapter";
import { api } from "../utils/api";
import { feedToApp, memoryToApp, milestoneToApp } from "../utils/adapters";
import { pickImage, pickerAvailable } from "../utils/imagePicker";
import { useToast } from "./ui/Toast";

export default function Dashboard({
    profile,
    profiles,
    onSelectProfile,
    onOpenAddModal,
    onOpenEditModal,
    onUpdateProfile,
    feedLogs,
    setFeedLogs,
    sleepLogs,
    setSleepLogs,
    milestones,
    setMilestones,
    onChangeView,
}) {
    const { language, t } = useLanguage();
    const toast = useToast();
    // Route legacy Alert.alert(title, message) calls to non-blocking toasts.
    const Alert = {
        alert: (title, message) => {
            const m = message || title || "";
            if (title === "Error" || /invalid|fail|denied|unable/i.test(String(title))) toast.error(m);
            else toast.success(m);
        },
    };

    // Temperature State
    const [bodyTemp, setBodyTemp] = useState("36.5");
    const [tempInput, setTempInput] = useState("36.5");
    const [showTempModal, setShowTempModal] = useState(false);

    // Quick Logging state
    const [showFeedModal, setShowFeedModal] = useState(false);
    const [feedType, setFeedType] = useState("milk");
    const [feedAmount, setFeedAmount] = useState("150");
    const [feedNotes, setFeedNotes] = useState("");

    // Sleep Logging State
    const [isSleeping, setIsSleeping] = useState(false);
    const [sleepStartTime, setSleepStartTime] = useState(null);

    // Feeds, sleep and milestones now load from the backend.
    const [feeds, setFeeds] = useState([]);
    const [sleeps, setSleeps] = useState([]);
    const [mstones, setMstones] = useState([]);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [feedRows, sleepRows, mRows] = await Promise.all([
                    api.listRecords(profile.id, "feeds"),
                    api.listRecords(profile.id, "sleeps"),
                    api.listRecords(profile.id, "milestones"),
                ]);
                if (!active) return;
                setFeeds(feedRows.map(feedToApp));
                setSleeps(sleepRows.map((s) => ({ id: String(s.id), totalMinutes: s.total_minutes })));
                setMstones(mRows.map(milestoneToApp));
            } catch (e) {
                console.log("load dashboard records:", e.message);
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
            Alert.alert("Error", "Please enter a caption");
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
        } catch (e) {
            Alert.alert("Error", e.message || "Could not save memory");
        }
    };

    useEffect(() => {
        const loadTemp = async () => {
            try {
                const saved = await storage.getItem(
                    `bb_temp_${profile.id}`,
                );
                if (saved) {
                    setBodyTemp(saved);
                    setTempInput(saved);
                } else {
                    setBodyTemp("36.5");
                    setTempInput("36.5");
                }
            } catch (e) {
                console.log(e);
            }
        };
        loadTemp();
    }, [profile.id]);

    const handleSaveTemp = async () => {
        const val = parseFloat(tempInput);
        if (isNaN(val) || val < 34 || val > 43) {
            Alert.alert(
                "Invalid Entry",
                "Please write a normal pediatric temperature between 34°C and 43°C",
            );
            return;
        }
        try {
            setBodyTemp(tempInput);
            await storage.setItem(`bb_temp_${profile.id}`, tempInput);
            setShowTempModal(false);
        } catch (e) {
            console.log(e);
        }
        // Persist the reading to the backend.
        try {
            await api.createRecord(profile.id, "temperatures", {
                celsius: val,
                taken_at: new Date().toISOString(),
            });
        } catch (e) {
            console.log("save temperature:", e.message);
        }
    };

    const handleAddFeed = async () => {
        if (!feedAmount) {
            Alert.alert("Error", "Please enter feed amount");
            return;
        }
        const amt = parseInt(feedAmount);
        setShowFeedModal(false);
        const notes = feedNotes;
        setFeedNotes("");
        try {
            const saved = await api.createRecord(profile.id, "feeds", {
                feed_type: feedType,
                amount_ml: feedType === "milk" ? amt : null,
                grams: feedType === "solids" ? amt : null,
                fed_at: new Date().toISOString(),
                notes: notes || null,
            });
            setFeeds((prev) => [feedToApp(saved), ...prev]);
        } catch (e) {
            Alert.alert("Error", e.message || "Could not save feed");
        }
    };

    const toggleSleep = async () => {
        if (!isSleeping) {
            setIsSleeping(true);
            setSleepStartTime(new Date());
        } else {
            const endTime = new Date();
            const start = sleepStartTime;
            const diffMins = Math.round((endTime - start) / 60000) || 1;
            setIsSleeping(false);
            setSleepStartTime(null);
            try {
                const saved = await api.createRecord(profile.id, "sleeps", {
                    start_at: start.toISOString(),
                    end_at: endTime.toISOString(),
                    total_minutes: diffMins,
                });
                setSleeps((prev) => [
                    { id: String(saved.id), totalMinutes: saved.total_minutes },
                    ...prev,
                ]);
            } catch (e) {
                console.log("save sleep:", e.message);
            }
            Alert.alert(
                "Sleep Saved",
                `Recorded ${diffMins} minutes of comfortable baby sleep.`,
            );
        }
    };

    const activeTemp = parseFloat(bodyTemp);
    const tempStatus =
        activeTemp > 37.8
            ? t("dashTempStatusHot")
            : activeTemp < 35.8
              ? t("dashTempStatusCold")
              : t("dashTempStatusNormal");

    const tempColor =
        activeTemp > 37.8
            ? "#EF4444"
            : activeTemp < 35.8
              ? "#3B82F6"
              : "#10B981";

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
                            <Image
                                source={{ uri: p.avatarUrl }}
                                style={styles.avatarMini}
                            />
                            <Text
                                style={[
                                    styles.profileName,
                                    profile.id === p.id &&
                                        styles.profileNameActive,
                                ]}
                            >
                                {p.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        onPress={onOpenAddModal}
                        style={styles.addProfileButton}
                    >
                        <Ionicons name="add" size={18} color={colors.primary} />
                        <Text style={styles.addProfileText}>Add</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Active Profile Header Info Card */}
            <View style={styles.babyCard}>
                <View style={styles.babyAvatarRing}>
                    <Image
                        source={{ uri: profile.avatarUrl }}
                        style={styles.babyAvatar}
                    />
                </View>
                <View style={styles.babyInfo}>
                    <Text style={styles.babyNameTitle} numberOfLines={1}>
                        {profile.name}
                    </Text>
                    <Text style={styles.babyDob}>
                        DOB: {profile.dateOfBirth}
                    </Text>
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
            </View>

            {/* Metric Widget Section */}
            <View style={styles.widgetsGrid}>
                <MetricWidgetCard
                    title={t("dashFeedingTitle")}
                    value={
                        feeds[0]
                            ? feeds[0].feedType === "milk"
                                ? `${feeds[0].amountMl} ml`
                                : `${feeds[0].grams} g`
                            : "No record"
                    }
                    subtitle={
                        feeds[0]
                            ? `Last: ${feeds[0].notes || feeds[0].feedType}`
                            : "Ready to record"
                    }
                    icon={
                        <MaterialCommunityIcons
                            name="baby-bottle-outline"
                            size={24}
                            color={colors.primary}
                        />
                    }
                    iconBg={colors.tintGreen}
                    action={
                        <TouchableOpacity
                            onPress={() => setShowFeedModal(true)}
                            style={styles.widgetActionBtn}
                        >
                            <Ionicons
                                name="add-circle"
                                size={24}
                                color={colors.accentStrong}
                            />
                        </TouchableOpacity>
                    }
                />

                <MetricWidgetCard
                    title={t("dashSleepTitle")}
                    value={
                        isSleeping
                            ? "Sleeping..."
                            : sleeps[0]
                              ? `${sleeps[0].totalMinutes} mins`
                              : "No record"
                    }
                    subtitle={
                        isSleeping ? "Active timer running" : "Ready to record"
                    }
                    icon={
                        <Ionicons
                            name="moon-outline"
                            size={24}
                            color={colors.primary}
                        />
                    }
                    iconBg={colors.tintViolet}
                    action={
                        <TouchableOpacity
                            onPress={toggleSleep}
                            style={[
                                styles.widgetActionBtn,
                                isSleeping && styles.widgetActionActive,
                            ]}
                        >
                            <Ionicons
                                name={isSleeping ? "square" : "play-circle"}
                                size={20}
                                color={isSleeping ? colors.danger : colors.accentStrong}
                            />
                        </TouchableOpacity>
                    }
                />
            </View>

            <View style={[styles.widgetsGrid, { marginTop: 0 }]}>
                <MetricWidgetCard
                    title={t("dashTempTitle")}
                    value={`${bodyTemp}°C`}
                    subtitle={tempStatus}
                    icon={
                        <Ionicons
                            name="thermometer-outline"
                            size={24}
                            color={colors.primary}
                        />
                    }
                    iconBg={colors.tintAmber}
                    action={
                        <TouchableOpacity
                            onPress={() => setShowTempModal(true)}
                            style={styles.widgetActionBtn}
                        >
                            <Ionicons
                                name="create-outline"
                                size={22}
                                color={colors.accentStrong}
                            />
                        </TouchableOpacity>
                    }
                />
            </View>

            {/* Interactive Logs List */}
            <SectionContainerCard
                title={
                    language === "en"
                        ? "Recent Feeding Logs"
                        : "Kamakailang Talaan ng Pagpapakain"
                }
                subtitle={t("dashFeedingSub")}
            >
                {feeds.slice(0, 3).map((log, index) => (
                    <ListEntryCard
                        key={log.id || index}
                        title={
                            log.feedType === "milk"
                                ? `Milk Feed: ${log.amountMl}ml`
                                : `Solid Feed: ${log.grams}g`
                        }
                        subtitle={new Date(log.timestamp).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                        )}
                        notes={log.notes}
                        icon={
                            <Ionicons
                                name={
                                    log.feedType === "milk"
                                        ? "water-outline"
                                        : "restaurant-outline"
                                }
                                size={18}
                                color={colors.primary}
                            />
                        }
                        iconBg={colors.tintGreen}
                    />
                ))}
                {feeds.length === 0 && (
                    <EmptyStateCard message="No feeding logs recorded today" />
                )}
            </SectionContainerCard>

            {/* Milestones memory grids */}
            <SectionContainerCard
                title={t("dashMemoriesTitle")}
                subtitle={t("dashMemoriesSub")}
            >
                <View style={styles.memoriesGrid}>
                    {mstones
                        .filter((m) => m.isCompleted)
                        .slice(0, 2)
                        .map((m, idx) => (
                            <MemoryVisualCard
                                key={m.id || idx}
                                title={m.title}
                                description={m.description}
                                date={m.date}
                                photoUrl={m.photoUrl}
                            />
                        ))}
                    {mstones.filter((m) => m.isCompleted).length === 0 && (
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
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: colors.accentStrong,
                            paddingHorizontal: space.md,
                            paddingVertical: 7,
                            borderRadius: radius.pill,
                            borderCurve: "continuous",
                            ...shadow.accent,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Add photo memory"
                    >
                        <Ionicons name="add" size={16} color={colors.onAccent} />
                        <Text style={{ color: colors.onAccent, fontWeight: "800", fontSize: 12 }}>
                            Add
                        </Text>
                    </TouchableOpacity>
                }
            >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
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

            {/* Temperature Modal */}
            <Modal visible={showTempModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {t("dashTempTitle")}
                        </Text>
                        <Text style={styles.modalLabel}>
                            Biometric Fever Assessment (Celsius)
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            value={tempInput}
                            onChangeText={setTempInput}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowTempModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveTemp}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("save")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Feeding Modal */}
            <Modal visible={showFeedModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {t("dashFeedingTitle")}
                        </Text>

                        <View style={styles.genderContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.genderButton,
                                    feedType === "milk" &&
                                        styles.genderButtonActive,
                                ]}
                                onPress={() => {
                                    setFeedType("milk");
                                    setFeedAmount("150");
                                }}
                            >
                                <Text
                                    style={[
                                        styles.genderButtonText,
                                        feedType === "milk" &&
                                            styles.genderButtonTextActive,
                                    ]}
                                >
                                    Milk (Bottle / Breast)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.genderButton,
                                    feedType === "solids" &&
                                        styles.genderButtonActive,
                                ]}
                                onPress={() => {
                                    setFeedType("solids");
                                    setFeedAmount("80");
                                }}
                            >
                                <Text
                                    style={[
                                        styles.genderButtonText,
                                        feedType === "solids" &&
                                            styles.genderButtonTextActive,
                                    ]}
                                >
                                    Solids / Puree
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalLabel, { marginTop: 12 }]}>
                            {feedType === "milk"
                                ? "Volume (ml)"
                                : "Weight (grams)"}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            style={styles.modalInput}
                            value={feedAmount}
                            onChangeText={setFeedAmount}
                        />

                        <Text style={[styles.modalLabel, { marginTop: 12 }]}>
                            Custom notes (e.g. Cerelac, Formula, etc.)
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Optional remarks"
                            value={feedNotes}
                            onChangeText={setFeedNotes}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setShowFeedModal(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddFeed}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("addRecord")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                                style={{
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
                                }}
                                onPress={async () => {
                                    const uri = await pickImage();
                                    if (uri) setMemPhotoUri(uri);
                                }}
                            >
                                <Ionicons name="image-outline" size={16} color={colors.primary} />
                                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                                    {memPhotoUri ? "Photo selected ✓ (tap to change)" : "Choose Photo from Device"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <Text style={styles.modalLabel}>
                            Photo URL (optional)
                        </Text>
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
                                <Text style={styles.modalCancelText}>
                                    {t("cancel")}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddMemory}
                                style={styles.modalSaveBtn}
                            >
                                <Text style={styles.modalSaveText}>
                                    {t("save")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: space.lg,
    },
    profileBar: {
        marginBottom: space.lg,
    },
    profilesScroll: {
        alignItems: "center",
        paddingRight: space.xs,
    },
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
    profileTabActive: {
        borderColor: colors.accent,
        backgroundColor: colors.softCoral,
    },
    avatarMini: {
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: 7,
    },
    profileName: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    profileNameActive: {
        color: colors.accentStrong,
        fontWeight: "800",
    },
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
    addProfileText: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.primary,
        marginLeft: 3,
    },
    babyCard: {
        backgroundColor: colors.primary,
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
    babyAvatar: {
        width: 58,
        height: 58,
        borderRadius: 29,
    },
    babyInfo: {
        flex: 1,
    },
    babyNameTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: colors.onPrimary,
        letterSpacing: 0.1,
    },
    babyDob: {
        fontSize: 12,
        color: colors.textOnDarkMuted,
        marginTop: 3,
        fontWeight: "500",
    },
    babyStatsRow: {
        flexDirection: "row",
        gap: space.sm,
        marginTop: space.sm,
    },
    babyStatChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "rgba(255,255,255,0.16)",
        paddingHorizontal: space.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
    },
    babyStatText: {
        fontSize: 12,
        color: colors.onPrimary,
        fontWeight: "700",
    },
    editButton: {
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.16)",
        borderRadius: radius.md,
        borderCurve: "continuous",
    },
    widgetsGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: space.md,
    },
    widgetActionBtn: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    widgetActionActive: {
        transform: [{ scale: 1.1 }],
    },
    memoriesGrid: {
        marginTop: space.xs,
    },
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
    modalTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: colors.text,
        marginBottom: space.lg,
    },
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
    modalButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: space.md,
    },
    modalCancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceAlt,
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.textSecondary,
    },
    modalSaveBtn: {
        paddingVertical: 12,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderCurve: "continuous",
        backgroundColor: colors.accentStrong,
        ...shadow.accent,
    },
    modalSaveText: {
        fontSize: 14,
        fontWeight: "800",
        color: colors.onAccent,
    },
    genderContainer: {
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: "continuous",
        padding: 4,
        marginBottom: space.md,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        alignItems: "center",
    },
    genderButtonActive: {
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    genderButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textMuted,
    },
    genderButtonTextActive: {
        color: colors.primary,
        fontWeight: "800",
    },
});
