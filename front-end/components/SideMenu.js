import React, { useEffect, useRef, useMemo } from "react";
import {
    Modal,
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    ScrollView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { space, radius, shadow, type, MIN_TOUCH } from "../theme";

const DRAWER_WIDTH = Math.min(300, Dimensions.get("window").width * 0.82);

const SECTIONS = [
    {
        label: "Account",
        items: [
            { key: "viewProfile", icon: "person-circle-outline", label: "View Profile" },
            { key: "editProfile", icon: "create-outline", label: "Edit Profile" },
        ],
    },
    {
        label: "Application",
        items: [
            { key: "generalSettings", icon: "settings-outline", label: "Settings" },
            { key: "themePreferences", icon: "color-palette-outline", label: "Theme Preferences" },
            { key: "languagePreferences", icon: "language-outline", label: "Language Preferences" },
        ],
    },
    {
        label: "Support",
        items: [
            { key: "services", icon: "grid-outline", label: "Local Services" },
            { key: "helpSupport", icon: "help-circle-outline", label: "Help & Support" },
            { key: "aboutApp", icon: "information-circle-outline", label: "About BabyBook+" },
        ],
    },
    {
        label: "Security",
        items: [
            { key: "changePassword", icon: "lock-closed-outline", label: "Change Password" },
            { key: "privacySettings", icon: "shield-checkmark-outline", label: "Privacy Settings" },
        ],
    },
];

// Reused by App.js's global header so the "← <screen name>" title on every
// menu destination stays in sync with the label shown here, instead of a
// second hand-typed copy drifting out of step.
export const MENU_TITLES = Object.fromEntries(
    SECTIONS.flatMap((s) => s.items.map((i) => [i.key, i.label])),
);

// Slide-in drawer from the right, opened from the header avatar. Holds every
// account/app/support/security destination plus logout (see CLAUDE.md §9).
export default function SideMenu({ visible, onClose, parentName, parentAvatar, onNavigate, onLogout }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateX, {
                toValue: visible ? 0 : DRAWER_WIDTH,
                duration: 220,
                useNativeDriver: Platform.OS !== "web",
            }),
            Animated.timing(backdropOpacity, {
                toValue: visible ? 1 : 0,
                duration: 220,
                useNativeDriver: Platform.OS !== "web",
            }),
        ]).start();
    }, [visible]);

    const go = (key) => {
        onNavigate(key);
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close menu"
                    />
                </Animated.View>

                <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Image source={{ uri: parentAvatar }} style={styles.avatar} />
                            <Text style={styles.parentName} numberOfLines={1}>
                                {parentName}
                            </Text>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Close menu"
                            >
                                <Ionicons name="close" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {SECTIONS.map((section) => (
                            <View key={section.label} style={styles.section}>
                                <Text style={styles.sectionLabel}>{section.label}</Text>
                                {section.items.map((item) => (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={styles.item}
                                        onPress={() => go(item.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={item.label}
                                    >
                                        <Ionicons name={item.icon} size={19} color={colors.primary} style={styles.itemIcon} />
                                        <Text style={styles.itemLabel}>{item.label}</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}

                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Session</Text>
                            <TouchableOpacity
                                style={styles.item}
                                onPress={onLogout}
                                accessibilityRole="button"
                                accessibilityLabel="Logout"
                            >
                                <Ionicons name="log-out-outline" size={19} color={colors.danger} style={styles.itemIcon} />
                                <Text style={[styles.itemLabel, { color: colors.danger }]}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        root: { flex: 1, flexDirection: "row" },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(28,25,23,0.45)",
        },
        drawer: {
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: DRAWER_WIDTH,
            backgroundColor: colors.background,
            paddingTop: space.xxl,
            paddingHorizontal: space.lg,
            ...shadow.raised,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: space.xl,
        },
        avatar: {
            width: 46,
            height: 46,
            borderRadius: 23,
            borderWidth: 2,
            borderColor: colors.primary,
            marginRight: space.md,
        },
        parentName: {
            flex: 1,
            fontSize: 16,
            fontWeight: "800",
            color: colors.text,
        },
        closeBtn: {
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceAlt,
        },
        section: { marginBottom: space.lg },
        sectionLabel: {
            ...type.caption,
            fontWeight: "800",
            color: colors.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: space.sm,
        },
        item: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            marginBottom: space.xs,
        },
        itemIcon: { marginRight: space.md },
        itemLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
    });
