import React, { useState, useEffect, useMemo, useRef } from "react";
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
    Platform,
    AppState,
} from "react-native";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, space, shadow } from "./theme";

// Guarded expo-font so the app still runs if it isn't available.
let ExpoFont = null;
try {
    // eslint-disable-next-line global-require
    ExpoFont = require("expo-font");
} catch (e) {
    ExpoFont = null;
}
import ThemeProvider, { useTheme } from "./context/ThemeContext";
import { storage } from "./utils/storageAdapter";

// Web only: one consistent muted-gray placeholder across every input, so raw
// TextInputs match the themed `colors.placeholder` used by shared components.
if (Platform.OS === "web" && typeof document !== "undefined") {
    const STYLE_ID = "bb-placeholder-style";
    if (!document.getElementById(STYLE_ID)) {
        const el = document.createElement("style");
        el.id = STYLE_ID;
        el.textContent =
            "input::placeholder,textarea::placeholder{color:#9AA0B4;opacity:1;}";
        document.head.appendChild(el);
    }
}

// Import Screen Components
import Auth from "./components/Auth";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import Health from "./components/Health";
import Growth from "./components/Growth";
import Services from "./components/Services";
import NutritionTracker from "./components/NutritionTracker";
import ShareRecords from "./components/ShareRecords";
import ProfessionalView from "./components/ProfessionalView";
import EmptyChild from "./components/EmptyChild";
import ToastProvider, { useToast } from "./components/ui/Toast";
import SideMenu from "./components/SideMenu";
import CalendarView from "./components/CalendarView";
import AppLoadingScreen from "./components/AppLoadingScreen";
import { DateField, TimeField } from "./components/ui/DateField";
import ViewProfile from "./components/settings/ViewProfile";
import EditProfile from "./components/settings/EditProfile";
import GeneralSettings from "./components/settings/GeneralSettings";
import ThemePreferences from "./components/settings/ThemePreferences";
import LanguagePreferences from "./components/settings/LanguagePreferences";
import HelpSupport from "./components/settings/HelpSupport";
import AboutApp from "./components/settings/AboutApp";
import ChangePassword from "./components/settings/ChangePassword";
import PrivacySettings from "./components/settings/PrivacySettings";
import { api, getToken, setToken, clearToken } from "./utils/api";
import { scheduleReminder, morningOf } from "./utils/notifications";
import { childToProfile, profileFormToChild } from "./utils/adapters";
import { pickImage, pickerAvailable } from "./utils/imagePicker";

function MainAppShell({ onThemeGenderChange, themeOverride, onThemeOverrideChange }) {
    const { language, t } = useLanguage();
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    // Preload the icon fonts (@expo/vector-icons) so buttons/icons never render
    // blank. The app shows AppLoadingScreen until these are ready.
    const [fontsReady, setFontsReady] = useState(false);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (ExpoFont && ExpoFont.loadAsync) {
                    await ExpoFont.loadAsync({ ...Ionicons.font, ...MaterialCommunityIcons.font });
                }
            } catch (e) {
                console.log("font preload:", e.message);
            } finally {
                if (active) setFontsReady(true);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    // Pre-login landing page; its CTAs pick which Auth scene opens.
    const [showLanding, setShowLanding] = useState(true);
    const [authScene, setAuthScene] = useState("login");
    // Healthcare Professional mode (separate actor, no parent account)
    const [professionalMode, setProfessionalMode] = useState(false);
    const [parentName, setParentName] = useState("Sarah");
    const [parentGender, setParentGender] = useState("Female");
    const [parentAvatar, setParentAvatar] = useState(
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    );

    // Main navigation view
    const [currentView, setCurrentView] = useState("dashboard");
    // Optional deep-link sub-tab for Health/Growth (set by Dashboard quick actions).
    // navKey bumps on every request so repeated taps re-apply the tab.
    const [navTab, setNavTab] = useState(null);
    const [navKey, setNavKey] = useState(0);
    const changeView = (view, tab = null) => {
        setCurrentView(view);
        if (tab) {
            setNavTab(tab);
            setNavKey((k) => k + 1);
        }
    };

    // Core records lists — children now load from the backend.
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [bootstrapping, setBootstrapping] = useState(true);

    // These props are retained for prop compatibility but screens now
    // self-load their records from the backend.
    const [immunizations, setImmunizations] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [appointments, setAppointments] = useState([]);

    // Modal Control States
    const [showAddProfileModal, setShowAddProfileModal] = useState(false);
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    // Slide-in side menu (opened from the header avatar).
    const [menuOpen, setMenuOpen] = useState(false);
    // Annual data-retention re-consent (Data Privacy Act of 2012).
    const [consentDue, setConsentDue] = useState(false);
    const [withdrawConfirm, setWithdrawConfirm] = useState(false);

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
    const [formNickname, setFormNickname] = useState("");
    const [formPlaceOfBirth, setFormPlaceOfBirth] = useState("");
    const [formTimeOfBirth, setFormTimeOfBirth] = useState("");
    const [formHealthCenter, setFormHealthCenter] = useState("");
    // Profile picture: a picked device photo (uploaded on save) or a pasted URL.
    const [formAvatarUri, setFormAvatarUri] = useState("");

    const activeProfile =
        profiles.find((p) => p.id === selectedProfileId) || profiles[0];

    // Unseen QR-access-log notifications: poll while the app is open (no
    // server push exists yet — see CLAUDE.md 4.5, deferred). Toast + badge
    // only, cleared when the parent opens Share Records (ShareRecords.js
    // calls markAccessLogSeen on load).
    const toast = useToast();
    const [unseenCount, setUnseenCount] = useState(0);
    const toastedIdsRef = useRef(new Set());
    const seenFirstCheckRef = useRef(false);
    const checkUnseenAccess = async () => {
        if (!activeProfile) return;
        try {
            const { count, rows } = await api.unseenAccessLog(activeProfile.id);
            setUnseenCount(count);
            const freshRows = (rows || []).filter((r) => !toastedIdsRef.current.has(r.id));
            if (seenFirstCheckRef.current && freshRows.length > 0) {
                const latest = freshRows[0];
                const when = new Date(latest.access_date).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                });
                toast.info(`Your records were viewed by ${latest.professional_name} at ${when}`);
            }
            (rows || []).forEach((r) => toastedIdsRef.current.add(r.id));
            seenFirstCheckRef.current = true;
        } catch (e) {
            console.log("unseen access check:", e.message);
        }
    };
    useEffect(() => {
        checkUnseenAccess();
        const interval = setInterval(checkUnseenAccess, 90000);
        const sub = AppState.addEventListener
            ? AppState.addEventListener("change", (state) => {
                  if (state === "active") checkUnseenAccess();
              })
            : null;
        return () => {
            clearInterval(interval);
            if (sub && sub.remove) sub.remove();
        };
    }, [activeProfile ? activeProfile.id : null]);

    // Drive the app theme from the selected child's gender (girl/boy).
    useEffect(() => {
        if (onThemeGenderChange) onThemeGenderChange(activeProfile ? activeProfile.gender : undefined);
    }, [activeProfile ? activeProfile.gender : undefined]);

    // Apply a logged-in user's profile fields to local state.
    const applyUser = (user) => {
        if (!user) return;
        setParentName(user.fullName || user.full_name || "Parent");
        if (user.gender) setParentGender(user.gender);
        if (user.avatarUrl) setParentAvatar(user.avatarUrl);
        setConsentDue(!!user.consentReviewDue);
    };

    // Annual re-consent: keep the data for another year.
    const handleKeepData = async () => {
        try {
            await api.renewConsent();
        } catch (e) {
            console.log("renew consent:", e.message);
        }
        setConsentDue(false);
        setWithdrawConfirm(false);
    };
    // Withdraw consent: permanently delete the account and all data, then log out.
    const handleWithdrawData = async () => {
        try {
            await api.deleteAccount();
        } catch (e) {
            console.log("delete account:", e.message);
        }
        setConsentDue(false);
        setWithdrawConfirm(false);
        handleLogOut();
    };

    // Arms local notifications for vaccination doses due within the next 6
    // months only. A full EPI schedule is ~13 doses per child; scheduling
    // every dose for every child up front risks silently exceeding iOS's
    // ~64-pending-local-notification cap. Re-run on every app launch (via
    // loadChildren) and after creating a child so the window keeps sliding
    // forward — a stopgap until server-side push exists (see CLAUDE.md 4.5).
    const scheduleUpcomingVaccineReminders = async (childId) => {
        try {
            const rows = await api.listRecords(childId, "reminders");
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() + 6);
            const cutoffStr = cutoff.toISOString().split("T")[0];
            const upcoming = rows.filter(
                (r) =>
                    r.reminder_type === "Vaccination" &&
                    r.status === "Pending" &&
                    r.reminder_date &&
                    r.reminder_date <= cutoffStr,
            );
            for (const r of upcoming) {
                const when = morningOf(r.reminder_date);
                if (when) scheduleReminder("Vaccination reminder", `${r.title} due`, when);
            }
        } catch (e) {
            console.log("scheduleUpcomingVaccineReminders:", e.message);
        }
    };

    // Load this user's children from the backend into the app's profile shape.
    const loadChildren = async () => {
        try {
            const rows = await api.listChildren();
            const mapped = rows.map(childToProfile);
            setProfiles(mapped);
            setSelectedProfileId(mapped.length ? mapped[0].id : null);
            mapped.forEach((p) => scheduleUpcomingVaccineReminders(p.id));
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
        setShowLanding(true); // back to the landing page, not straight to login
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
        scheduleUpcomingVaccineReminders(prof.id);
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
                        nickname: formNickname,
                        dateOfBirth: formDob,
                        timeOfBirth: formTimeOfBirth,
                        placeOfBirth: formPlaceOfBirth,
                        gender: formGender,
                        weight: formWeight,
                        height: formHeight,
                        bloodType: formBloodType,
                        hospital: formHospital,
                        pediatrician: formPediatrician,
                        obgyne: formObgyne,
                        emergencyContact: formEmergency,
                        preferredHealthCenter: formHealthCenter,
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
            scheduleUpcomingVaccineReminders(prof.id);
            setShowAddProfileModal(false);
            setFormName("");
            setFormNickname("");
            setFormPlaceOfBirth("");
            setFormTimeOfBirth("");
            setFormBloodType("");
            setFormHospital("");
            setFormPediatrician("");
            setFormObgyne("");
            setFormEmergency("");
            setFormHealthCenter("");
            setFormAvatarUri("");
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
                        nickname: formNickname,
                        dateOfBirth: formDob,
                        timeOfBirth: formTimeOfBirth,
                        placeOfBirth: formPlaceOfBirth,
                        gender: formGender,
                        bloodType: formBloodType,
                        hospital: formHospital,
                        pediatrician: formPediatrician,
                        obgyne: formObgyne,
                        emergencyContact: formEmergency,
                        preferredHealthCenter: formHealthCenter,
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
        setFormNickname(activeProfile.nickname || "");
        setFormPlaceOfBirth(activeProfile.placeOfBirth || "");
        setFormTimeOfBirth(activeProfile.timeOfBirth || "");
        setFormHealthCenter(activeProfile.preferredHealthCenter || "");
        setFormAvatarUri("");
        setShowEditProfileModal(true);
    };

    // Open the add-baby modal with a clean avatar picker + fields.
    const openAddModal = () => {
        setFormNickname("");
        setFormPlaceOfBirth("");
        setFormTimeOfBirth("");
        setFormHealthCenter("");
        setFormAvatarUri("");
        setShowAddProfileModal(true);
    };

    // Reusable avatar picker used in both the add and edit baby modals.
    // `currentUrl` is the baby's existing photo (edit) shown until a new one is chosen.
    const renderAvatarPicker = (currentUrl) => {
        const preview = formAvatarUri || currentUrl || "";
        return (
            <View style={styles.avatarPickerWrap}>
                <TouchableOpacity
                    activeOpacity={pickerAvailable() ? 0.85 : 1}
                    onPress={async () => {
                        if (!pickerAvailable()) return;
                        const uri = await pickImage();
                        if (uri) setFormAvatarUri(uri);
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
            </View>
        );
    };

    // Show the branded loading screen until icon fonts are ready and the saved
    // session has been restored — so no screen ever renders with blank icons.
    if (!fontsReady || bootstrapping) {
        return <AppLoadingScreen />;
    }

    if (professionalMode) {
        return <ProfessionalView onExit={() => setProfessionalMode(false)} />;
    }

    if (!isAuthenticated) {
        // Landing page first; its CTAs decide which Auth scene opens.
        if (showLanding) {
            return (
                <Landing
                    onGetStarted={() => {
                        setAuthScene("register");
                        setShowLanding(false);
                    }}
                    onLogin={() => {
                        setAuthScene("login");
                        setShowLanding(false);
                    }}
                    onProfessional={() => setProfessionalMode(true)}
                />
            );
        }
        return (
            <Auth
                onLoginSuccess={handleLoginSuccess}
                onProfessional={() => setProfessionalMode(true)}
                onBack={() => setShowLanding(true)}
                initialScene={authScene}
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
                        onPress={() => {
                            setUnseenCount(0);
                            setCurrentView("share");
                        }}
                        style={styles.headerQrBtn}
                    >
                        <Ionicons name="qr-code" size={20} color={colors.primary} />
                        {unseenCount > 0 && (
                            <View style={styles.headerBadge}>
                                <Text style={styles.headerBadgeText}>
                                    {unseenCount > 9 ? "9+" : unseenCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setMenuOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Open menu"
                    >
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
                        parentName={parentName}
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
                        onChangeView={changeView}
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
                        initialTab={navTab}
                        navKey={navKey}
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
                        initialTab={navTab}
                        navKey={navKey}
                    />
                )}
                {currentView === "nutrition" && (
                    <NutritionTracker
                        childId={activeProfile.id}
                        initialAction={navTab}
                        navKey={navKey}
                    />
                )}
                {currentView === "services" && <Services />}
                {currentView === "calendar" && <CalendarView profile={activeProfile} />}
                {currentView === "share" && (
                    <ShareRecords
                        profile={activeProfile}
                        immunizations={immunizations}
                        milestones={milestones}
                        appointments={appointments}
                        onClose={() => setCurrentView("dashboard")}
                    />
                )}
                {currentView === "viewProfile" && (
                    <ViewProfile
                        parentName={parentName}
                        parentAvatar={parentAvatar}
                        parentGender={parentGender}
                        onEdit={() => setCurrentView("editProfile")}
                    />
                )}
                {currentView === "editProfile" && (
                    <EditProfile
                        parentName={parentName}
                        onUpdateParentName={setParentName}
                        parentAvatar={parentAvatar}
                        onUpdateParentAvatar={setParentAvatar}
                        parentGender={parentGender}
                    />
                )}
                {currentView === "generalSettings" && <GeneralSettings />}
                {currentView === "themePreferences" && (
                    <ThemePreferences
                        themeOverride={themeOverride}
                        onThemeOverrideChange={onThemeOverrideChange}
                        childGender={activeProfile ? activeProfile.gender : undefined}
                    />
                )}
                {currentView === "languagePreferences" && <LanguagePreferences />}
                {currentView === "helpSupport" && <HelpSupport />}
                {currentView === "aboutApp" && <AboutApp />}
                {currentView === "changePassword" && <ChangePassword />}
                {currentView === "privacySettings" && (
                    <PrivacySettings profile={activeProfile} onAccountDeleted={handleLogOut} />
                )}
            </View>

            {/* Modern bottom navigation tabs */}
            <View style={styles.tabBar}>
                {[
                    { key: "dashboard", icon: "home", label: t("navDashboard") },
                    { key: "health", icon: "shield-checkmark", label: t("navHealth") },
                    { key: "growth", icon: "trending-up", label: t("navGrowth") },
                    { key: "nutrition", icon: "restaurant", label: "Nutrition" },
                    { key: "calendar", icon: "calendar", label: "Calendar" },
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
                                placeholderTextColor={colors.placeholder}
                                value={formName}
                                onChangeText={setFormName}
                            />

                            <Text style={styles.modalLabel}>Nickname</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="e.g. Baby E"
                                placeholderTextColor={colors.placeholder}
                                value={formNickname}
                                onChangeText={setFormNickname}
                            />

                            <DateField
                                label={t("profileDobLabel")}
                                value={formDob}
                                onChange={setFormDob}
                                maximumDate={new Date().toISOString().slice(0, 10)}
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
                                placeholderTextColor={colors.placeholder}
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

                            <Text style={styles.modalLabel}>Place of Birth</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formPlaceOfBirth}
                                onChangeText={setFormPlaceOfBirth}
                            />
                            <TimeField
                                label="Time of Birth"
                                value={formTimeOfBirth}
                                onChange={setFormTimeOfBirth}
                            />
                            <Text style={styles.modalLabel}>Preferred Health Center</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formHealthCenter}
                                onChangeText={setFormHealthCenter}
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

                            <Text style={styles.modalLabel}>Nickname</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="e.g. Baby E"
                                placeholderTextColor={colors.placeholder}
                                value={formNickname}
                                onChangeText={setFormNickname}
                            />

                            <DateField
                                label={t("profileDobLabel")}
                                value={formDob}
                                onChange={setFormDob}
                                maximumDate={new Date().toISOString().slice(0, 10)}
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
                                placeholderTextColor={colors.placeholder}
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

                            <Text style={styles.modalLabel}>Place of Birth</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formPlaceOfBirth}
                                onChangeText={setFormPlaceOfBirth}
                            />
                            <TimeField
                                label="Time of Birth"
                                value={formTimeOfBirth}
                                onChange={setFormTimeOfBirth}
                            />
                            <Text style={styles.modalLabel}>Preferred Health Center</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={formHealthCenter}
                                onChangeText={setFormHealthCenter}
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

            {/* Annual data-retention re-consent (Data Privacy Act of 2012, RA 10173) */}
            <Modal visible={consentDue} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        {!withdrawConfirm ? (
                            <>
                                <Text style={styles.modalTitle}>Annual Data Review</Text>
                                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: space.lg }}>
                                    It's been about a year since your last review. In line with the Data
                                    Privacy Act of 2012 (RA 10173), do you still want BabyBook+ to keep
                                    retaining your and your child's data?
                                </Text>
                                <TouchableOpacity onPress={handleKeepData} style={styles.modalSaveBtn}>
                                    <Text style={styles.modalSaveText}>Yes, keep my data for another year</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setWithdrawConfirm(true)}
                                    style={{ marginTop: space.md, alignItems: "center", paddingVertical: 12 }}
                                >
                                    <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>
                                        No — withdraw & delete my data
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>Delete everything?</Text>
                                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: space.lg }}>
                                    This permanently deletes your account and all of your child's records.
                                    This cannot be undone.
                                </Text>
                                <TouchableOpacity onPress={handleWithdrawData} style={[styles.modalSaveBtn, { backgroundColor: colors.danger }]}>
                                    <Text style={styles.modalSaveText}>Permanently delete everything</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setWithdrawConfirm(false)}
                                    style={{ marginTop: space.md, alignItems: "center", paddingVertical: 12 }}
                                >
                                    <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 13 }}>Go back</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <SideMenu
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                parentName={parentName}
                parentAvatar={parentAvatar}
                onNavigate={(key) => {
                    setCurrentView(key);
                    setMenuOpen(false);
                }}
                onLogout={() => {
                    setMenuOpen(false);
                    handleLogOut();
                }}
            />
        </SafeAreaView>
    );
}

export default function App() {
    // Active child's gender drives the theme; a manual override from Settings
    // ("auto" | "girl" | "boy") can force it. Default is "auto".
    const [themeGender, setThemeGender] = useState(undefined);
    const [themeOverride, setThemeOverride] = useState("auto");

    useEffect(() => {
        (async () => {
            try {
                const saved = await storage.getItem("bb_theme_override");
                if (saved) setThemeOverride(saved);
            } catch (e) {
                /* ignore */
            }
        })();
    }, []);

    const changeThemeOverride = async (v) => {
        setThemeOverride(v);
        try {
            await storage.setItem("bb_theme_override", v);
        } catch (e) {
            /* ignore */
        }
    };

    return (
        <LanguageProvider>
            <ThemeProvider gender={themeGender} override={themeOverride}>
                <ToastProvider>
                    <MainAppShell
                        onThemeGenderChange={setThemeGender}
                        themeOverride={themeOverride}
                        onThemeOverrideChange={changeThemeOverride}
                    />
                </ToastProvider>
            </ThemeProvider>
        </LanguageProvider>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
    headerBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.surface,
    },
    headerBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
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
