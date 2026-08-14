import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { storage } from "../../utils/storageAdapter";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { SkeletonBlock } from "../ui/Skeleton";
import KeyboardAvoider from "../ui/KeyboardAvoider";
import { useTheme } from "../../context/ThemeContext";
import { space, radius, type } from "../../theme";

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

    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("Quezon City, NCR");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
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
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSaveInfo = async () => {
        if (!parentName.trim()) {
            toast.error("Name cannot be empty.");
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
            toast.success("Profile settings updated successfully!");
        } catch (e) {
            toast.error(e.message || "Could not update profile");
        }
    };

    return (
        <KeyboardAvoider>
        <ScrollView style={styles.container}>
            {/* Prominent ringed avatar hero — the photo picker moved up here
                (out of its old "Select Guardian Avatar" card slot) so the
                thing being edited is the first thing seen. */}
            <View style={styles.headerBox}>
                <View style={styles.avatarRing}>
                    <Image source={{ uri: parentAvatar }} style={styles.avatarMain} />
                </View>
                <Text style={styles.parentNameText}>{parentName}</Text>
                <Text style={styles.parentRoleText}>Primary Guardian ({parentGender})</Text>
                <View style={styles.avatarPickerRow}>
                    {PREDEFINED_AVATARS.map((av, idx) => (
                        <TouchableOpacity key={idx} onPress={() => onUpdateParentAvatar(av)}>
                            <Image
                                source={{ uri: av }}
                                style={[styles.avatarOption, parentAvatar === av && styles.avatarOptionSelected]}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <SectionContainerCard title="Guardian Information" subtitle="Keep your contact details up to date">
                {loading ? (
                    <>
                        {[0, 1, 2, 3].map((i) => (
                            <View key={i} style={styles.formGroup}>
                                <SkeletonBlock width={i % 2 ? "38%" : "46%"} height={12} radius={6} />
                                <SkeletonBlock width="100%" height={44} radius={radius.md} style={{ marginTop: space.xs }} />
                            </View>
                        ))}
                    </>
                ) : (
                    <>
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
                    </>
                )}
            </SectionContainerCard>
        </ScrollView>
        </KeyboardAvoider>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: space.lg },
        headerBox: { alignItems: "center", marginVertical: space.lg },
        avatarRing: {
            width: 104,
            height: 104,
            borderRadius: 52,
            borderWidth: 3,
            borderColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        avatarMain: { width: 96, height: 96, borderRadius: 48 },
        parentNameText: { ...type.heading, color: colors.primary, marginTop: space.sm },
        parentRoleText: { ...type.caption, color: colors.textMuted, marginTop: 2 },
        avatarPickerRow: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
        avatarOption: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "transparent" },
        avatarOptionSelected: { borderColor: colors.accentStrong },
        formGroup: { marginBottom: space.md },
        label: { ...type.subheading, color: colors.textMuted, marginBottom: space.xs },
        input: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: "continuous",
            paddingHorizontal: space.md,
            height: 44,
            ...type.body,
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
        saveBtnText: { ...type.label, color: colors.onAccent },
    });
