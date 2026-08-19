import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { useScroll } from "../../context/ScrollContext";
import { space, radius, type, shadow } from "../../theme";
import { api } from "../../utils/api";
import { SkeletonBlock } from "../ui/Skeleton";

// Read-only account summary. "Edit Profile" (a separate menu destination)
// is where the guardian actually changes these fields.
//
// The header card below deliberately echoes Dashboard.js's own "Baby
// Summary Card" (surface + radius.xl + hairline border + shadow.card, an
// avatar/name block on top, an icon-led fact grid underneath) so the
// parent's own profile reads as a sibling of the child's, not a
// differently-designed screen.
export default function ViewProfile({ parentName, parentAvatar, parentGender, onEdit }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    const { scrollProps } = useScroll();
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { user } = await api.me();
                if (user) {
                    if (user.email) setEmail(user.email);
                    if (user.phoneNumber) setPhone(user.phoneNumber);
                }
            } catch (e) {
                console.log("view profile:", e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const facts = [
        { icon: "mail-outline", text: email || "No email on file" },
        { icon: "call-outline", text: phone || "No phone on file" },
        { icon: "male-female-outline", text: parentGender || "Not set" },
    ];

    return (
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
        >
            <View style={styles.profileCard}>
                <View style={styles.headerRow}>
                    <Image source={{ uri: parentAvatar }} style={styles.avatarMain} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.parentNameText}>{parentName}</Text>
                        <Text style={styles.parentRoleText}>Primary Guardian</Text>
                    </View>
                </View>
                <View style={styles.metaGrid}>
                    {loading
                        ? [0, 1, 2].map((i) => (
                              <SkeletonBlock
                                  key={i}
                                  width={i % 2 ? "52%" : "64%"}
                                  height={12}
                                  radius={6}
                                  style={{ marginBottom: space.sm }}
                              />
                          ))
                        : facts.map((f, idx) => (
                              <View key={idx} style={styles.metaItem}>
                                  <Ionicons name={f.icon} size={14} color={colors.primary} />
                                  <Text style={styles.metaText} numberOfLines={1}>{f.text}</Text>
                              </View>
                          ))}
                </View>
            </View>

            <TouchableOpacity onPress={onEdit} style={styles.editBtn} accessibilityRole="button">
                <Ionicons name="create-outline" size={17} color={colors.onAccent} style={{ marginRight: 8 }} />
                <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
        </Animated.ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content so the bottom clearance scrolls with it.
        content: { padding: space.lg },
        profileCard: {
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: space.lg,
            marginTop: space.lg,
            marginBottom: space.lg,
            ...shadow.card,
        },
        headerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
        avatarMain: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.primary },
        parentNameText: { ...type.heading, color: colors.primary },
        parentRoleText: { ...type.caption, color: colors.textMuted, marginTop: 2 },
        metaGrid: { marginTop: space.lg },
        metaItem: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
        metaText: { ...type.caption, color: colors.textSecondary },
        editBtn: {
            flexDirection: "row",
            height: 48,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: colors.accentStrong,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: space.xxl,
        },
        editBtnText: { ...type.label, color: colors.onAccent },
    });
