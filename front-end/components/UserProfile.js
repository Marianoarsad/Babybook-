import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { SectionContainerCard } from "./common/Cards";
import { Ionicons } from "@expo/vector-icons";
import { storage } from "../utils/storageAdapter";

const PREDEFINED_AVATARS = [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=200&auto=format&fit=crop",
];

export default function UserProfile({
    parentName,
    onUpdateParentName,
    parentAvatar,
    onUpdateParentAvatar,
    onLogOut,
    parentGender,
    onUpdateParentGender,
}) {
    const { language, setLanguage, t } = useLanguage();

    const [email, setEmail] = useState("sarah.mitchell@example.com");
    const [phone, setPhone] = useState("+63 917 123 4567");
    const [city, setCity] = useState("Quezon City, NCR");
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        const loadProfileData = async () => {
            try {
                const savedEmail =
                    await storage.getItem("bb_parent_email");
                const savedPhone =
                    await storage.getItem("bb_parent_phone");
                const savedCity = await storage.getItem("bb_parent_city");
                const savedPremium =
                    await storage.getItem("bb_parent_premium");

                if (savedEmail) setEmail(savedEmail);
                if (savedPhone) setPhone(savedPhone);
                if (savedCity) setCity(savedCity);
                if (savedPremium) setIsPremium(savedPremium === "true");
            } catch (e) {
                console.log(e);
            }
        };
        loadProfileData();
    }, []);

    const handleSaveInfo = async () => {
        if (!parentName.trim()) {
            Alert.alert("Error", "Name cannot be empty.");
            return;
        }
        try {
            await storage.setItem("bb_parent_email", email);
            await storage.setItem("bb_parent_phone", phone);
            await storage.setItem("bb_parent_city", city);
            Alert.alert("Success", "Profile settings updated successfully!");
        } catch (e) {
            console.log(e);
        }
    };

    const handleTogglePremium = async () => {
        const nextState = !isPremium;
        setIsPremium(nextState);
        try {
            await storage.setItem("bb_parent_premium", String(nextState));
            Alert.alert(
                nextState ? "Premium Activated" : "Plan Adjusted",
                nextState
                    ? "Full clinical metrics and export tools unlocked."
                    : "Switched to free plan.",
            );
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Branding Profile Header */}
            <View style={styles.headerBox}>
                <Image
                    source={{ uri: parentAvatar }}
                    style={styles.avatarMain}
                />
                <Text style={styles.parentNameText}>{parentName}</Text>
                <Text style={styles.parentRoleText}>
                    Primary Guardian ({parentGender})
                </Text>
            </View>

            {/* Preset Avatars Selection */}
            <SectionContainerCard
                title="Select Guardian Avatar"
                subtitle="Choose your personal display icon"
            >
                <View style={styles.avatarRow}>
                    {PREDEFINED_AVATARS.map((av, idx) => (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => onUpdateParentAvatar(av)}
                        >
                            <Image
                                source={{ uri: av }}
                                style={[
                                    styles.avatarOption,
                                    parentAvatar === av &&
                                        styles.avatarOptionSelected,
                                ]}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </SectionContainerCard>

            {/* Personal Info Settings Form */}
            <SectionContainerCard
                title="Guardian Information"
                subtitle={t("settingsPersonalInfoSub")}
            >
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={parentName}
                        onChangeText={onUpdateParentName}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Home City / Region</Text>
                    <TextInput
                        style={styles.input}
                        value={city}
                        onChangeText={setCity}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleSaveInfo}
                    style={styles.saveBtn}
                >
                    <Text style={styles.saveBtnText}>
                        {t("settingsSaveBtn")}
                    </Text>
                </TouchableOpacity>
            </SectionContainerCard>

            {/* Language Preferences */}
            <SectionContainerCard
                title={t("settingsLanguageLabel")}
                subtitle={t("settingsLanguageHelp")}
            >
                <View style={styles.langRow}>
                    <TouchableOpacity
                        style={[
                            styles.langBtn,
                            language === "en" && styles.langBtnActive,
                        ]}
                        onPress={() => setLanguage("en")}
                    >
                        <Text
                            style={[
                                styles.langBtnText,
                                language === "en" && styles.langBtnTextActive,
                            ]}
                        >
                            English
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.langBtn,
                            language === "fil" && styles.langBtnActive,
                        ]}
                        onPress={() => setLanguage("fil")}
                    >
                        <Text
                            style={[
                                styles.langBtnText,
                                language === "fil" && styles.langBtnTextActive,
                            ]}
                        >
                            Filipino
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.langBtn,
                            language === "tag" && styles.langBtnActive,
                        ]}
                        onPress={() => setLanguage("tag")}
                    >
                        <Text
                            style={[
                                styles.langBtnText,
                                language === "tag" && styles.langBtnTextActive,
                            ]}
                        >
                            Taglish
                        </Text>
                    </TouchableOpacity>
                </View>
            </SectionContainerCard>

            {/* Premium Upgrade */}
            <SectionContainerCard
                title={t("settingsPlansTitle")}
                subtitle={t("settingsPlansSub")}
            >
                <TouchableOpacity
                    onPress={handleTogglePremium}
                    style={[
                        styles.premiumBtn,
                        isPremium && styles.premiumBtnActive,
                    ]}
                >
                    <Ionicons
                        name="sparkles"
                        size={16}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                    />
                    <Text style={styles.premiumText}>
                        {isPremium
                            ? "CURRENT PLAN: PREMIUM"
                            : t("settingsUpgradeBtn")}
                    </Text>
                </TouchableOpacity>
            </SectionContainerCard>

            {/* Log out option */}
            <TouchableOpacity onPress={onLogOut} style={styles.logoutBtn}>
                <Ionicons
                    name="log-out"
                    size={18}
                    color="#EF4444"
                    style={{ marginRight: 6 }}
                />
                <Text style={styles.logoutText}>{t("navLogout")}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFDF9",
        padding: 16,
    },
    headerBox: {
        alignItems: "center",
        marginVertical: 16,
    },
    avatarMain: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: "#456155",
    },
    parentNameText: {
        fontSize: 18,
        fontWeight: "800",
        color: "#456155",
        marginTop: 10,
    },
    parentRoleText: {
        fontSize: 12,
        color: "#78716C",
        marginTop: 2,
    },
    avatarRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 6,
    },
    avatarOption: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: "transparent",
    },
    avatarOptionSelected: {
        borderColor: "#FF8A7A",
    },
    formGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 10,
        fontWeight: "700",
        color: "#A8A29E",
        textTransform: "uppercase",
        marginBottom: 4,
    },
    input: {
        backgroundColor: "#F5F5F4",
        borderWidth: 1,
        borderColor: "#E7E5E4",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        fontSize: 13,
        color: "#1C1917",
    },
    saveBtn: {
        backgroundColor: "#FF8A7A",
        borderRadius: 12,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
    },
    saveBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 13,
    },
    langRow: {
        flexDirection: "row",
        gap: 8,
    },
    langBtn: {
        flex: 1,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E7E5E4",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    langBtnActive: {
        borderColor: "#456155",
        backgroundColor: "#E6F4EA",
    },
    langBtnText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#78716C",
    },
    langBtnTextActive: {
        color: "#456155",
        fontWeight: "750",
    },
    premiumBtn: {
        flexDirection: "row",
        height: 44,
        borderRadius: 12,
        backgroundColor: "#FF8A7A",
        justifyContent: "center",
        alignItems: "center",
    },
    premiumBtnActive: {
        backgroundColor: "#10B981",
    },
    premiumText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 12,
    },
    logoutBtn: {
        flexDirection: "row",
        height: 48,
        borderWidth: 1,
        borderColor: "#FCA5A5",
        backgroundColor: "#FEF2F2",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 32,
        marginTop: 16,
    },
    logoutText: {
        color: "#EF4444",
        fontWeight: "750",
        fontSize: 13,
    },
});
