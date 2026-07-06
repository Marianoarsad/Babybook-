import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { storage } from "../../utils/storageAdapter";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { useTheme } from "../../context/ThemeContext";
import { space, radius } from "../../theme";

const PREDEFINED_AVATARS = [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=200&auto=format&fit=crop",
];

// Guardian account fields (name, contact, avatar). Language/theme moved to
// their own menu destinations; logout lives in the side menu.
export default function EditProfile({
    parentName,
    onUpdateParentName,
    parentAvatar,
    onUpdateParentAvatar,
    parentGender,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const toast = useToast();
    const Alert = {
        alert: (title, message) => {
            const m = message || title || "";
            if (title === "Error" || /invalid|fail|denied|unable/i.test(String(title))) toast.error(m);
            else toast.success(m);
        },
    };

    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("Quezon City, NCR");

    useEffect(() => {
        (async () => {
            try {
                const savedCity = await storage.getItem("bb_parent_city");
                if (savedCity) setCity(savedCity);
                const { user } = await api.me();
                if (user) {
                    if (user.email) setEmail(user.email);
                    if (user.phoneNumber) setPhone(user.phoneNumber);
                }
            } catch (e) {
                console.log("load profile:", e.message);
            }
        })();
    }, []);

    const handleSaveInfo = async () => {
        if (!parentName.trim()) {
            Alert.alert("Error", "Name cannot be empty.");
            return;
        }
        try {
            await storage.setItem("bb_parent_city", city);
            await api.updateMe({
                fullName: parentName,
                phoneNumber: phone,
                gender: parentGender,
                avatarUrl: parentAvatar,
            });
            Alert.alert("Success", "Profile settings updated successfully!");
        } catch (e) {
            Alert.alert("Error", e.message || "Could not update profile");
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerBox}>
                <Image source={{ uri: parentAvatar }} style={styles.avatarMain} />
                <Text style={styles.parentNameText}>{parentName}</Text>
                <Text style={styles.parentRoleText}>Primary Guardian ({parentGender})</Text>
            </View>

            <SectionContainerCard title="Select Guardian Avatar" subtitle="Choose your personal display icon">
                <View style={styles.avatarRow}>
                    {PREDEFINED_AVATARS.map((av, idx) => (
                        <TouchableOpacity key={idx} onPress={() => onUpdateParentAvatar(av)}>
                            <Image
                                source={{ uri: av }}
                                style={[styles.avatarOption, parentAvatar === av && styles.avatarOptionSelected]}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </SectionContainerCard>

            <SectionContainerCard title="Guardian Information" subtitle="Keep your contact details up to date">
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput style={styles.input} value={parentName} onChangeText={onUpdateParentName} />
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
                    <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Home City / Region</Text>
                    <TextInput style={styles.input} value={city} onChangeText={setCity} />
                </View>
                <TouchableOpacity
                    onPress={handleSaveInfo}
                    style={styles.saveBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Save Changes"
                >
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
            </SectionContainerCard>
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
        avatarRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
        avatarOption: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "transparent" },
        avatarOptionSelected: { borderColor: colors.accentStrong },
        formGroup: { marginBottom: space.md },
        label: {
            fontSize: 10,
            fontWeight: "700",
            color: colors.textMuted,
            textTransform: "uppercase",
            marginBottom: 4,
        },
        input: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 44,
            fontSize: 13,
            color: colors.text,
        },
        saveBtn: {
            backgroundColor: colors.accentStrong,
            borderRadius: radius.md,
            borderCurve: "continuous",
            height: 44,
            justifyContent: "center",
            alignItems: "center",
            marginTop: space.sm,
        },
        saveBtnText: { color: colors.onAccent, fontWeight: "700", fontSize: 13 },
    });
