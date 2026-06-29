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
} from "react-native";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { storage } from "./utils/storageAdapter";

// Import Screen Components
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import Health from "./components/Health";
import Growth from "./components/Growth";
import Services from "./components/Services";
import UserProfile from "./components/UserProfile";

// Import Initial Mock Data
import {
    initialProfiles,
    initialImmunizations,
    initialFeedLogs,
    initialSleepLogs,
    initialMilestones,
    initialAppointments,
} from "./mockData";

function MainAppShell() {
    const { language, t } = useLanguage();

    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [parentName, setParentName] = useState("Sarah");
    const [parentGender, setParentGender] = useState("Female");
    const [parentAvatar, setParentAvatar] = useState(
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    );

    // Main navigation view
    const [currentView, setCurrentView] = useState("dashboard");

    // Core records lists
    const [profiles, setProfiles] = useState(initialProfiles);
    const [selectedProfileId, setSelectedProfileId] = useState("1");

    const [immunizations, setImmunizations] = useState(initialImmunizations);
    const [feedLogs, setFeedLogs] = useState(initialFeedLogs);
    const [sleepLogs, setSleepLogs] = useState(initialSleepLogs);
    const [milestones, setMilestones] = useState(initialMilestones);
    const [appointments, setAppointments] = useState(initialAppointments);

    // Modal Control States
    const [showAddProfileModal, setShowAddProfileModal] = useState(false);
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);

    // Form states for profile adding/editing
    const [formName, setFormName] = useState("");
    const [formDob, setFormDob] = useState("2025-12-16");
    const [formGender, setFormGender] = useState("girl");
    const [formWeight, setFormWeight] = useState("3.2");
    const [formHeight, setFormHeight] = useState("49.0");

    const activeProfile =
        profiles.find((p) => p.id === selectedProfileId) || profiles[0];

    useEffect(() => {
        const loadSession = async () => {
            try {
                const savedAuth = await storage.getItem("bb_auth");
                if (savedAuth === "true") {
                    setIsAuthenticated(true);
                    const savedParentName =
                        await storage.getItem("bb_parent_name");
                    const savedParentGender =
                        await storage.getItem("bb_parent_gender");
                    const savedParentAvatar =
                        await storage.getItem("bb_parent_avatar");

                    if (savedParentName) setParentName(savedParentName);
                    if (savedParentGender) setParentGender(savedParentGender);
                    if (savedParentAvatar) setParentAvatar(savedParentAvatar);
                }
            } catch (e) {
                console.log(e);
            }
        };
        loadSession();
    }, []);

    const handleLoginSuccess = async (name, gender) => {
        setIsAuthenticated(true);
        setParentName(name);
        setParentGender(gender);
        try {
            await storage.setItem("bb_auth", "true");
            await storage.setItem("bb_parent_name", name);
            await storage.setItem("bb_parent_gender", gender);
        } catch (e) {
            console.log(e);
        }
    };

    const handleLogOut = async () => {
        setIsAuthenticated(false);
        try {
            await storage.removeItem("bb_auth");
        } catch (e) {
            console.log(e);
        }
    };

    const handleAddProfile = () => {
        if (!formName) {
            Alert.alert("Error", "Please enter baby name");
            return;
        }
        const newProfile = {
            id: `${profiles.length + 1}`,
            name: formName,
            dateOfBirth: formDob,
            gender: formGender,
            birthWeight: parseFloat(formWeight) || 3.0,
            birthHeight: parseFloat(formHeight) || 48.0,
            avatarUrl:
                formGender === "girl"
                    ? "https://images.unsplash.com/photo-1519689680058-324335c77eb2?q=80&w=300&auto=format&fit=crop"
                    : "https://images.unsplash.com/photo-1596870230751-ebdfce98ec42?q=80&w=300&auto=format&fit=crop",
            allergies: [],
            hereditaryConditions: [],
            currentHeight: parseFloat(formHeight) || 48.0,
            currentWeight: parseFloat(formWeight) || 3.0,
        };
        setProfiles([...profiles, newProfile]);
        setSelectedProfileId(newProfile.id);
        setShowAddProfileModal(false);
        setFormName("");
    };

    const handleEditProfile = () => {
        if (!formName) {
            Alert.alert("Error", "Please enter baby name");
            return;
        }
        setProfiles((prev) =>
            prev.map((p) => {
                if (p.id === activeProfile.id) {
                    return {
                        ...p,
                        name: formName,
                        dateOfBirth: formDob,
                        gender: formGender,
                        currentHeight:
                            parseFloat(formHeight) || p.currentHeight,
                        currentWeight:
                            parseFloat(formWeight) || p.currentWeight,
                    };
                }
                return p;
            }),
        );
        setShowEditProfileModal(false);
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
        setShowEditProfileModal(true);
    };

    if (!isAuthenticated) {
        return <Auth onLoginSuccess={handleLoginSuccess} />;
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
                <TouchableOpacity onPress={() => setCurrentView("settings")}>
                    <Image
                        source={{ uri: parentAvatar }}
                        style={styles.parentAvatarMini}
                    />
                </TouchableOpacity>
            </View>

            {/* Main Container View content */}
            <View style={styles.content}>
                {currentView === "dashboard" && (
                    <Dashboard
                        profile={activeProfile}
                        profiles={profiles}
                        onSelectProfile={setSelectedProfileId}
                        onOpenAddModal={() => setShowAddProfileModal(true)}
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
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setCurrentView("dashboard")}
                >
                    <Ionicons
                        name="home"
                        size={20}
                        color={
                            currentView === "dashboard" ? "#FF8A7A" : "#78716C"
                        }
                    />
                    <Text
                        style={[
                            styles.tabLabel,
                            currentView === "dashboard" &&
                                styles.tabLabelActive,
                        ]}
                    >
                        {t("navDashboard")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setCurrentView("health")}
                >
                    <Ionicons
                        name="shield-checkmark"
                        size={20}
                        color={currentView === "health" ? "#FF8A7A" : "#78716C"}
                    />
                    <Text
                        style={[
                            styles.tabLabel,
                            currentView === "health" && styles.tabLabelActive,
                        ]}
                    >
                        {t("navHealth")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setCurrentView("growth")}
                >
                    <Ionicons
                        name="trending-up"
                        size={20}
                        color={currentView === "growth" ? "#FF8A7A" : "#78716C"}
                    />
                    <Text
                        style={[
                            styles.tabLabel,
                            currentView === "growth" && styles.tabLabelActive,
                        ]}
                    >
                        {t("navGrowth")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setCurrentView("services")}
                >
                    <Ionicons
                        name="grid-outline"
                        size={20}
                        color={
                            currentView === "services" ? "#FF8A7A" : "#78716C"
                        }
                    />
                    <Text
                        style={[
                            styles.tabLabel,
                            currentView === "services" && styles.tabLabelActive,
                        ]}
                    >
                        {t("servicesHeader")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setCurrentView("settings")}
                >
                    <Ionicons
                        name="person"
                        size={20}
                        color={
                            currentView === "settings" ? "#FF8A7A" : "#78716C"
                        }
                    />
                    <Text
                        style={[
                            styles.tabLabel,
                            currentView === "settings" && styles.tabLabelActive,
                        ]}
                    >
                        {t("navSettings")}
                    </Text>
                </TouchableOpacity>
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
            <MainAppShell />
        </LanguageProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFDF9",
    },
    header: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#EBEBEB",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarMini: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        borderWidth: 1,
        borderColor: "#FF8A7A",
    },
    welcomeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#FF8A7A",
        textTransform: "uppercase",
    },
    babyName: {
        fontSize: 14,
        fontWeight: "850",
        color: "#456155",
    },
    parentAvatarMini: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#456155",
    },
    content: {
        flex: 1,
    },
    tabBar: {
        height: 56,
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E7E5E4",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: 4,
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
    },
    tabLabel: {
        fontSize: 9,
        fontWeight: "600",
        color: "#78716C",
        marginTop: 2,
    },
    tabLabelActive: {
        color: "#FF8A7A",
        fontWeight: "800",
    },
    modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalScroll: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
    },
    modalCard: {
        backgroundColor: "#FFFDF9",
        borderRadius: 24,
        padding: 20,
        width: "100%",
        maxWidth: 340,
        borderWidth: 1,
        borderColor: "#E7E5E4",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#456155",
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#78716C",
        textTransform: "uppercase",
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 14,
        color: "#1C1917",
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
    },
    modalCancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: "#F5F5F4",
    },
    modalCancelText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#78716C",
    },
    modalSaveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: "#FF8A7A",
    },
    modalSaveText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    genderContainer: {
        flexDirection: "row",
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
    },
    genderButtonActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#374151",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    genderButtonText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#78716C",
    },
    genderButtonTextActive: {
        color: "#456155",
        fontWeight: "700",
    },
});
