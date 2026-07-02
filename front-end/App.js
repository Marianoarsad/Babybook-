import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Modal,
    TextInput,
    Image,
    Alert,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, shadow } from "./theme";
import { storage } from "./utils/storageAdapter";

// Import Screen Components
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import Health from "./components/Health";
import Growth from "./components/Growth";
import Services from "./components/Services";
import UserProfile from "./components/UserProfile";
import ShareRecords from "./components/ShareRecords";
import ProfessionalView from "./components/ProfessionalView";
import EmptyChild from "./components/EmptyChild";
import ToastProvider from "./components/ui/Toast";
import { api, getToken, setToken, clearToken } from "./utils/api";
import { childToProfile, profileFormToChild } from "./utils/adapters";
import { pickImage, pickerAvailable } from "./utils/imagePicker";

function MainAppShell() {
    const { language, t } = useLanguage();

    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    // Healthcare Professional mode (separate actor, no parent account)
    const [professionalMode, setProfessionalMode] = useState(false);
    const [parentName, setParentName] = useState("Sarah");
    const [parentGender, setParentGender] = useState("Female");
    const [parentAvatar, setParentAvatar] = useState(
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    );

    // Main navigation view
    const [currentView, setCurrentView] = useState("dashboard");

    // Core records lists — children now load from the backend.
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [bootstrapping, setBootstrapping] = useState(true);

    // These props are retained for prop compatibility but screens now
    // self-load their records from the backend.
    const [immunizations, setImmunizations] = useState([]);
    const [feedLogs, setFeedLogs] = useState([]);
    const [sleepLogs, setSleepLogs] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [appointments, setAppointments] = useState([]);

    // Modal Control States
    const [showAddProfileModal, setShowAddProfileModal] = useState(false);
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);

    // Form states for profile adding/editing
    const [formName, setFormName] = useState("");
    const [formDob, setFormDob] = useState("2025-12-16");
    const [formGender, setFormGender] = useState("girl");
    const [formWeight, setFormWeight] = useState("3.2");
    const [formHeight, setFormHeight] = useState("49.0");
    const [formBloodType, setFormBloodType] = useState("");
    const [formHospital, setFormHospital] = useState("");
    const [formPediatrician, setFormPediatrician] = useState("");
    const [formObgyne, setFormObgyne] = useState("");
    const [formEmergency, setFormEmergency] = useState("");
    // Profile picture: a picked device photo (uploaded on save) or a pasted URL.
    const [formAvatarUri, setFormAvatarUri] = useState("");
    const [formAvatarUrl, setFormAvatarUrl] = useState("");

    const activeProfile =
        profiles.find((p) => p.id === selectedProfileId) || profiles[0];

    // Apply a logged-in user's profile fields to local state.
    const applyUser = (user) => {
        if (!user) return;
        setParentName(user.fullName || user.full_name || "Parent");
        if (user.gender) setParentGender(user.gender);
        if (user.avatarUrl) setParentAvatar(user.avatarUrl);
    };

    // Load this user's children from the backend into the app's profile shape.
    const loadChildren = async () => {
        try {
            const rows = await api.listChildren();
            const mapped = rows.map(childToProfile);
            setProfiles(mapped);
            setSelectedProfileId(mapped.length ? mapped[0].id : null);
        } catch (e) {
            console.log("loadChildren:", e.message);
        }
    };

    // On launch, restore a saved session via the stored JWT.
    useEffect(() => {
        (async () => {
            try {
                const token = await getToken();
                if (token) {
                    const { user } = await api.me();
                    setIsAuthenticated(true);
                    applyUser(user);
                    await loadChildren();
                }
            } catch (e) {
                await clearToken(); // token invalid/expired
            } finally {
                setBootstrapping(false);
            }
        })();
    }, []);

    const handleLoginSuccess = async (user, token) => {
        try {
            await setToken(token);
        } catch (e) {
            console.log(e);
        }
        setIsAuthenticated(true);
        applyUser(user);
        await loadChildren();
    };

    const handleLogOut = async () => {
        setIsAuthenticated(false);
        setProfiles([]);
        setSelectedProfileId(null);
        setCurrentView("dashboard");
        try {
            await clearToken();
        } catch (e) {
            console.log(e);
        }
    };

    // Create the first child (from the EmptyChild screen).
    const handleCreateFirstChild = async (form) => {
        const created = await api.createChild(profileFormToChild(form, { includeBirth: true }));
        const prof = childToProfile(created);
        setProfiles((prev) => [...prev, prof]);
        setSelectedProfileId(prof.id);
    };

    const handleAddProfile = async () => {
        if (!formName) {
            Alert.alert("Error", "Please enter baby name");
            return;
        }
        try {
            const created = await api.createChild(
                profileFormToChild(
                    {
                        name: formName,
                        dateOfBirth: formDob,
                        gender: formGender,
                        weight: formWeight,
                        height: formHeight,
                        bloodType: formBloodType,
                        hospital: formHospital,
                        pediatrician: formPediatrician,
                        obgyne: formObgyne,
                        emergencyContact: formEmergency,
                        avatarUrl: formAvatarUrl,
                    },
                    { includeBirth: true },
                ),
            );
            let prof = childToProfile(created);
            if (formAvatarUri) {
                try {
                    const withAvatar = await api.uploadChildAvatar(created.id, formAvatarUri);
                    prof = childToProfile(withAvatar);
                } catch (e) {
                    console.log("avatar upload:", e.message);
                }
            }
            setProfiles((prev) => [...prev, prof]);
            setSelectedProfileId(prof.id);
            setShowAddProfileModal(false);
            setFormName("");
            setFormBloodType("");
            setFormHospital("");
            setFormPediatrician("");
            setFormObgyne("");
            setFormEmergency("");
            setFormAvatarUri("");
            setFormAvatarUrl("");
        } catch (e) {
            Alert.alert("Error", e.message || "Could not add child");
        }
    };

    const handleEditProfile = async () => {
        if (!formName) {
            Alert.alert("Error", "Please enter baby name");
            return;
        }
        try {
            const updated = await api.updateChild(
                activeProfile.id,
                profileFormToChild(
                    {
                        name: formName,
                        dateOfBirth: formDob,
                        gender: formGender,
                        bloodType: formBloodType,
                        hospital: formHospital,
                        pediatrician: formPediatrician,
                        obgyne: formObgyne,
                        emergencyContact: formEmergency,
                        avatarUrl: formAvatarUrl,
                    },
                    { includeBirth: false },
                ),
            );
            let prof = childToProfile(updated);
            if (formAvatarUri) {
                try {
                    const withAvatar = await api.uploadChildAvatar(activeProfile.id, formAvatarUri);
                    prof = childToProfile(withAvatar);
                } catch (e) {
                    console.log("avatar upload:", e.message);
                }
            }
            setProfiles((prev) => prev.map((p) => (p.id === prof.id ? prof : p)));
            setShowEditProfileModal(false);
            setFormAvatarUri("");
            setFormAvatarUrl("");
        } catch (e) {
            Alert.alert("Error", e.message || "Could not update child");
        }
    };

    const openEditModal = () => {
        setFormName(activeProfile.name);
        setFormDob(activeProfile.dateOfBirth);
        setFormGender(activeProfile.gender);
        setFormHeight(
            String(activeProfile.currentHeight || activeProfile.birthHeight),
        );
        setFormWeight(
            String(activeProfile.currentWeight || activeProfile.birthWeight),
        );
        setFormBloodType(activeProfile.bloodType || "");
        setFormHospital(activeProfile.hospital || "");
        setFormPediatrician(activeProfile.pediatricianName || "");
        setFormObgyne(activeProfile.obgynName || "");
        setFormEmergency(activeProfile.emergencyContact || "");
        setFormAvatarUri("");
        setFormAvatarUrl("");
        setShowEditProfileModal(true);
    };

    // Open the add-baby modal with a clean avatar picker.
    const openAddModal = () => {
        setFormAvatarUri("");
        setFormAvatarUrl("");
        setShowAddProfileModal(true);
    };

    // Reusable avatar picker used in both the add and edit baby modals.
    // `currentUrl` is the baby's existing photo (edit) shown until a new one is chosen.
    const renderAvatarPicker = (currentUrl) => {
        const preview = formAvatarUri || formAvatarUrl || currentUrl || "";
        return (
            <View style={styles.avatarPickerWrap}>
                <TouchableOpacity
                    activeOpacity={pickerAvailable() ? 0.85 : 1}
                    onPress={async () => {
                        if (!pickerAvailable()) return;
                        const uri = await pickImage();
                        if (uri) {
                            setFormAvatarUri(uri);
                            setFormAvatarUrl("");
                        }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Choose baby photo"
                >
                    {preview ? (
                        <Image source={{ uri: preview }} style={styles.avatarPreview} />
                    ) : (
                        <View style={[styles.avatarPreview, styles.avatarPreviewEmpty]}>
                            <Ionicons name="person" size={38} color={colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={15} color={colors.onAccent} />
                    </View>
                </TouchableOpacity>
                {pickerAvailable() ? (
                    <Text style={styles.avatarHint}>
                        {formAvatarUri ? "Photo selected — tap to change" : "Tap to choose a photo"}
                    </Text>
                ) : null}
                <TextInput
                    style={[styles.modalInput, styles.avatarUrlInput]}
                    placeholder="…or paste an image URL"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={formAvatarUrl}
                    onChangeText={(v) => {
                        setFormAvatarUrl(v);
                        if (v) setFormAvatarUri("");
                    }}
                />
            </View>
        );
    };

    if (professionalMode) {
        return <ProfessionalView onExit={() => setProfessionalMode(false)} />;
    }

    if (bootstrapping) {
        return (
            <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color="#FF8A7A" />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <Auth
                onLoginSuccess={handleLoginSuccess}
                onProfessional={() => setProfessionalMode(true)}
            />
        );
    }

    // Authenticated but no children yet -> first-child setup.
    if (profiles.length === 0) {
        return (
            <EmptyChild
                parentName={parentName}
                onCreate={handleCreateFirstChild}
                onLogOut={handleLogOut}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFDF9" />

            {/* Dynamic Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Image
                        source={{ uri: activeProfile.avatarUrl }}
                        style={styles.avatarMini}
                    />
                    <View>
                        <Text style={styles.welcomeText}>BabyBook+</Text>
                        <Text style={styles.babyName}>
                            {activeProfile.name}'s File
                        </Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={() => setCurrentView("share")}
                        style={styles.headerQrBtn}
                    >
                        <Ionicons name="qr-code" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCurrentView("settings")}>
                        <Image
                            source={{ uri: parentAvatar }}
                            style={styles.parentAvatarMini}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Container View content */}
            <View style={styles.content}>
                {currentView === "dashboard" && (
                    <Dashboard
                        profile={activeProfile}
                        profiles={profiles}
                        onSelectProfile={setSelectedProfileId}
                        onOpenAddModal={openAddModal}
                        onOpenEditModal={openEditModal}
                        onUpdateProfile={(updated) =>
                            setProfiles((prev) =>
                                prev.map((p) =>
                                    p.id === updated.id ? updated : p,
                                ),
                            )
                        }
                        feedLogs={feedLogs}
                        setFeedLogs={setFeedLogs}
                        sleepLogs={sleepLogs}
                        setSleepLogs={setSleepLogs}
                        milestones={milestones}
                        setMilestones={setMilestones}
                        onChangeView={setCurrentView}
                    />
                )}
                {currentView === "health" && (
                    <Health
                        profile={activeProfile}
                        onUpdateProfile={(updated) =>
                            setProfiles((prev) =>
                                prev.map((p) =>
                                    p.id === updated.id ? updated : p,
                                ),
                            )
                        }
                        immunizations={immunizations}
                        setImmunizations={setImmunizations}
                        feedLogs={feedLogs}
                        setFeedLogs={setFeedLogs}
                    />
                )}
                {currentView === "growth" && (
                    <Growth
                        profile={activeProfile}
                        onUpdateProfile={(updated) =>
                            setProfiles((prev) =>
                                prev.map((p) =>
                                    p.id === updated.id ? updated : p,
                                ),
                            )
                        }
                        milestones={milestones}
                        setMilestones={setMilestones}
                        appointments={appointments}
                        setAppointments={setAppointments}
                    />
                )}
                {currentView === "services" && <Services />}
                {currentView === "share" && (
                    <ShareRecords
                        profile={activeProfile}
                        immunizations={immunizations}
                        milestones={milestones}
                        appointments={appointments}
                        feedLogs={feedLogs}
                        onClose={() => setCurrentView("dashboard")}
                    />
                )}
                {currentView === "settings" && (
                    <UserProfile
                        parentName={parentName}
                        onUpdateParentName={setParentName}
                        parentAvatar={parentAvatar}
                        onUpdateParentAvatar={setParentAvatar}
                        onLogOut={handleLogOut}
                        parentGender={parentGender}
                        onUpdateParentGender={setParentGender}
                    />
                )}
            </View>

            {/* Modern bottom navigation tabs */}
            <View style={styles.tabBar}>
                {[
                    { key: "dashboard", icon: "home", label: t("navDashboard") },
                    { key: "health", icon: "shield-checkmark", label: t("navHealth") },
                    { key: "growth", icon: "trending-up", label: t("navGrowth") },
                    { key: "services", icon: "grid", label: "Services" },
                    { key: "settings", icon: "person", label: t("navSettings") },
                ].map((tab) => {
                    const active = currentView === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => setCurrentView(tab.key)}
                            accessibilityRole="button"
                            accessibilityLabel={tab.label}
                            accessibilityState={{ selected: active }}
                        >
                            <View style={[styles.tabPill, active && styles.tabPillActive]}>
                                <Ionicons
                                    name={active ? tab.icon : tab.icon + "-outline"}
                                    size={21}
                                    color={active ? colors.accentStrong : colors.textMuted}
                                />
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[styles.tabLabel, active && styles.tabLabelActive]}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Modal: ADD BABY PROFILE */}
            <Modal
                visible={showAddProfileModal}
                transparent
                animationType="slide"
            >
                <View style={styles.modalBg}>
                    <ScrollView contentContainerStyle={styles.modalScroll}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>
                                {t("profileAddTitle")}
                            </Text>

                            {renderAvatarPicker()}

                            <Text style={styles.modalLabel}>
                                {t("profileNameLabel")}
                            </Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Baby Full Name"
                                value={formName}
                                onChangeText={setFormName}
                            />

                            <Text style={styles.modalLabel}>
                                {t("profileDobLabel")} (YYYY-MM-DD)
                            </Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formDob}
                                onChangeText={setFormDob}
                            />

                            <Text style={styles.modalLabel}>
                                {t("profileGenderLabel")}
                            </Text>
                            <View style={styles.genderContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formGender === "girl" &&
                                            styles.genderButtonActive,
                                    ]}
                                    onPress={() => setFormGender("girl")}
                                >
                                    <Text
                                        style={[
                                            styles.genderButtonText,
                                            formGender === "girl" &&
                                                styles.genderButtonTextActive,
                                        ]}
                                    >
                                        {t("female")}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formGender === "boy" &&
                                            styles.genderButtonActive,
                                    ]}
                                    onPress={() => setFormGender("boy")}
                                >
                                    <Text
                                        style={[
                                            styles.genderButtonText,
                                            formGender === "boy" &&
                                                styles.genderButtonTextActive,
                                        ]}
                                    >
                                        {t("male")}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>
                                        Birth Weight (kg)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        style={styles.modalInput}
                                        value={formWeight}
                                        onChangeText={setFormWeight}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>
                                        Birth Height (cm)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        style={styles.modalInput}
                                        value={formHeight}
                                        onChangeText={setFormHeight}
                                    />
                                </View>
                            </View>

                            <Text style={styles.modalLabel}>Blood Type</Text>
                            <TextInput
                                style={styles.modalInput}
                                autoCapitalize="characters"
                                placeholder="e.g. O+"
                                value={formBloodType}
                                onChangeText={setFormBloodType}
                            />
                            <Text style={styles.modalLabel}>Birth Hospital</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formHospital}
                                onChangeText={setFormHospital}
                            />
                            <Text style={styles.modalLabel}>Pediatrician</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formPediatrician}
                                onChangeText={setFormPediatrician}
                            />
                            <Text style={styles.modalLabel}>OB-GYNE</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formObgyne}
                                onChangeText={setFormObgyne}
                            />
                            <Text style={styles.modalLabel}>Emergency Contact</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formEmergency}
                                onChangeText={setFormEmergency}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    onPress={() =>
                                        setShowAddProfileModal(false)
                                    }
                                    style={styles.modalCancelBtn}
                                >
                                    <Text style={styles.modalCancelText}>
                                        {t("cancel")}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleAddProfile}
                                    style={styles.modalSaveBtn}
                                >
                                    <Text style={styles.modalSaveText}>
                                        {t("save")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Modal: EDIT BABY PROFILE */}
            <Modal
                visible={showEditProfileModal}
                transparent
                animationType="slide"
            >
                <View style={styles.modalBg}>
                    <ScrollView contentContainerStyle={styles.modalScroll}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>
                                {t("profileEditTitle")}
                            </Text>

                            {renderAvatarPicker(activeProfile.avatarUrl)}

                            <Text style={styles.modalLabel}>
                                {t("profileNameLabel")}
                            </Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formName}
                                onChangeText={setFormName}
                            />

                            <Text style={styles.modalLabel}>
                                {t("profileDobLabel")} (YYYY-MM-DD)
                            </Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formDob}
                                onChangeText={setFormDob}
                            />

                            <Text style={styles.modalLabel}>
                                {t("profileGenderLabel")}
                            </Text>
                            <View style={styles.genderContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formGender === "girl" &&
                                            styles.genderButtonActive,
                                    ]}
                                    onPress={() => setFormGender("girl")}
                                >
                                    <Text
                                        style={[
                                            styles.genderButtonText,
                                            formGender === "girl" &&
                                                styles.genderButtonTextActive,
                                        ]}
                                    >
                                        {t("female")}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formGender === "boy" &&
                                            styles.genderButtonActive,
                                    ]}
                                    onPress={() => setFormGender("boy")}
                                >
                                    <Text
                                        style={[
                                            styles.genderButtonText,
                                            formGender === "boy" &&
                                                styles.genderButtonTextActive,
                                        ]}
                                    >
                                        {t("male")}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>
                                        Current Weight (kg)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        style={styles.modalInput}
                                        value={formWeight}
                                        onChangeText={setFormWeight}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>
                                        Current Height (cm)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        style={styles.modalInput}
                                        value={formHeight}
                                        onChangeText={setFormHeight}
                                    />
                                </View>
                            </View>

                            <Text style={styles.modalLabel}>Blood Type</Text>
                            <TextInput
                                style={styles.modalInput}
                                autoCapitalize="characters"
                                placeholder="e.g. O+"
                                value={formBloodType}
                                onChangeText={setFormBloodType}
                            />
                            <Text style={styles.modalLabel}>Birth Hospital</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formHospital}
                                onChangeText={setFormHospital}
                            />
                            <Text style={styles.modalLabel}>Pediatrician</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formPediatrician}
                                onChangeText={setFormPediatrician}
                            />
                            <Text style={styles.modalLabel}>OB-GYNE</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formObgyne}
                                onChangeText={setFormObgyne}
                            />
                            <Text style={styles.modalLabel}>Emergency Contact</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formEmergency}
                                onChangeText={setFormEmergency}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    onPress={() =>
                                        setShowEditProfileModal(false)
                                    }
                                    style={styles.modalCancelBtn}
                                >
                                    <Text style={styles.modalCancelText}>
                                        {t("cancel")}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleEditProfile}
                                    style={styles.modalSaveBtn}
                                >
                                    <Text style={styles.modalSaveText}>
                                        {t("save")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <ToastProvider>
                <MainAppShell />
            </ToastProvider>
        </LanguageProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFDF9",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: colors.background,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerQrBtn: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.softGreen,
        alignItems: "center",
        justifyContent: "center",
        marginRight: space.md,
    },
    avatarMini: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: space.md,
        borderWidth: 2,
        borderColor: colors.accent,
    },
    welcomeText: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.accentStrong,
        letterSpacing: 0.2,
    },
    babyName: {
        fontSize: 16,
        fontWeight: "800",
        color: colors.primary,
        letterSpacing: -0.2,
    },
    parentAvatarMini: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    content: {
        flex: 1,
    },
    tabBar: {
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-around",
        paddingTop: space.sm,
        paddingBottom: space.md,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 3,
    },
    tabPill: {
        width: 56,
        height: 32,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    tabPillActive: {
        backgroundColor: colors.softCoral,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: colors.textMuted,
    },
    tabLabelActive: {
        color: colors.accentStrong,
        fontWeight: "800",
    },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(28,25,23,0.55)",
        justifyContent: "center",
        alignItems: "center",
        padding: space.xl,
    },
    modalScroll: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
    },
    avatarPickerWrap: {
        alignItems: "center",
        marginBottom: space.lg,
    },
    avatarPreview: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: colors.surface,
        backgroundColor: colors.surfaceAlt,
        ...shadow.card,
    },
    avatarPreviewEmpty: {
        alignItems: "center",
        justifyContent: "center",
        borderColor: colors.border,
        borderStyle: "dashed",
    },
    avatarBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.accentStrong,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.background,
    },
    avatarHint: {
        marginTop: space.sm,
        fontSize: 12,
        fontWeight: "600",
        color: colors.textMuted,
    },
    avatarUrlInput: {
        marginTop: space.md,
        width: "100%",
        marginBottom: 0,
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
        letterSpacing: -0.2,
        marginBottom: space.lg,
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.textSecondary,
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        paddingHorizontal: space.lg,
        height: 52,
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
        marginBottom: space.lg,
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
