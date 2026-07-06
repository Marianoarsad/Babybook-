import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionContainerCard } from "../common/Cards";
import { useTheme } from "../../context/ThemeContext";
import { space, radius } from "../../theme";
import { api } from "../../utils/api";

// Read-only account summary. "Edit Profile" (a separate menu destination)
// is where the guardian actually changes these fields.
export default function ViewProfile({ parentName, parentAvatar, parentGender, onEdit }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const { user } = await api.me();
                if (user) {
                    if (user.email) setEmail(user.email);
                    if (user.phoneNumber) setPhone(user.phoneNumber);
                }
            } catch (e) {
                console.log("view profile:", e.message);
            }
        })();
    }, []);

    const rows = [
        { label: "Full Name", value: parentName },
        { label: "Email Address", value: email || "—" },
        { label: "Phone Number", value: phone || "—" },
        { label: "Gender", value: parentGender || "—" },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerBox}>
                <Image source={{ uri: parentAvatar }} style={styles.avatarMain} />
                <Text style={styles.parentNameText}>{parentName}</Text>
                <Text style={styles.parentRoleText}>Primary Guardian</Text>
            </View>

            <SectionContainerCard title="Account Details" subtitle="Your BabyBook+ guardian profile">
                {rows.map((r) => (
                    <View key={r.label} style={styles.row}>
                        <Text style={styles.rowLabel}>{r.label}</Text>
                        <Text style={styles.rowValue}>{r.value}</Text>
                    </View>
                ))}
            </SectionContainerCard>

            <TouchableOpacity onPress={onEdit} style={styles.editBtn} accessibilityRole="button">
                <Ionicons name="create-outline" size={17} color={colors.onAccent} style={{ marginRight: 8 }} />
                <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        headerBox: { alignItems: "center", marginVertical: space.lg },
        avatarMain: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.primary },
        parentNameText: { fontSize: 18, fontWeight: "800", color: colors.primary, marginTop: 10 },
        parentRoleText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.hairline,
        },
        rowLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
        rowValue: { fontSize: 13, fontWeight: "600", color: colors.text },
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
        editBtnText: { color: colors.onAccent, fontWeight: "800", fontSize: 14 },
    });
