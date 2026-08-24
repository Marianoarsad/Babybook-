import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated } from "react-native";
import { SectionContainerCard } from "../common/Cards";
import { api } from "../../utils/api";
import { useToast } from "../ui/Toast";
import { SkeletonBlock } from "../ui/Skeleton";
import KeyboardAvoider from "../ui/KeyboardAvoider";
import Avatar from "../ui/Avatar";
import { useTheme } from "../../context/ThemeContext";
import { useScreenPadBottom, useScreenPadTop } from "../../utils/responsive";
import { useScroll } from "../../context/ScrollContext";
import { RELATIONSHIPS, relationshipLabel } from "../../utils/relationship";
import { space, radius, type, MIN_TOUCH } from "../../theme";

// Guardian account fields (name, contact, relationship, city, avatar).
// Language/theme moved to their own menu destinations; logout lives in the side
// menu.
//
// Two things this screen used to get wrong, both fixed here:
//
// 1. The Email box was editable, and saving it did nothing. handleSaveInfo sent
//    fullName/phoneNumber/gender/avatarUrl and PUT /me did not accept an email
//    at all, so the parent edited the field, was told "Profile settings updated
//    successfully!", and the old address came back on the next load. Email is
//    now its own block with its own control, because it is the login identity
//    and its save can fail on the server's terms (wrong password, address
//    already taken) in a way none of the other fields can.
//
// 2. "Home City / Region" wrote to localStorage under bb_parent_city and was
//    read back only by this file — it never reached the server, never synced to
//    a second device, and pre-filled "Quezon City, NCR" for every parent alive.
//    It is a real column now, and it starts blank.
//
// The four PREDEFINED_AVATARS (Unsplash photographs of strangers, one of them
// the default) are gone; ui/Avatar.js shows the parent's own initials instead.
export default function EditProfile({
    parentName,
    onUpdateParentName,
    parentAvatar,
    parentRelationship,
    onUpdateParentRelationship,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const padBottom = useScreenPadBottom();
    const padTop = useScreenPadTop();

    const { scrollProps } = useScroll();
    const toast = useToast();

    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Sign-in email, kept apart from the fields above on purpose (see header).
    const [newEmail, setNewEmail] = useState("");
    const [emailPassword, setEmailPassword] = useState("");
    const [emailError, setEmailError] = useState("");
    const [emailSaving, setEmailSaving] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { user } = await api.me();
                if (user) {
                    setEmail(user.email || "");
                    setPhone(user.phoneNumber || "");
                    setCity(user.city || "");
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
        setSaving(true);
        try {
            // Every value this call sends is a value the server stores. The old
            // version also passed a city that went nowhere and an email the
            // endpoint ignored, then reported success for both.
            const { user } = await api.updateMe({
                fullName: parentName,
                phoneNumber: phone,
                relationship: parentRelationship || "",
                city,
            });
            // Read the saved row back instead of trusting local state, so a
            // field the server rejected or normalised shows what was actually
            // stored.
            if (user) {
                setPhone(user.phoneNumber || "");
                setCity(user.city || "");
                if (onUpdateParentRelationship) onUpdateParentRelationship(user.relationship || "");
            }
            toast.success("Profile updated");
        } catch (e) {
            toast.error(e.message || "Could not update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleChangeEmail = async () => {
        const next = newEmail.trim();
        if (!next) return setEmailError("Enter the new email address");
        if (next.toLowerCase() === email.toLowerCase()) return setEmailError("That is already your email address");
        if (!emailPassword) return setEmailError("Enter your current password to confirm");
        setEmailError("");
        setEmailSaving(true);
        try {
            const { user } = await api.changeEmail({ newEmail: next, currentPassword: emailPassword });
            setEmail(user.email || next);
            setNewEmail("");
            setEmailPassword("");
            toast.success("Sign-in email updated");
        } catch (e) {
            setEmailError(e.message || "Could not change the email address");
        } finally {
            setEmailSaving(false);
        }
    };

    return (
        <KeyboardAvoider>
        <Animated.ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: padTop, paddingBottom: padBottom }]}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
        >
            <View style={styles.headerBox}>
                <Avatar uri={parentAvatar} name={parentName} size={104} borderWidth={3} />
                <Text style={styles.parentNameText}>{parentName}</Text>
                <Text style={styles.parentRoleText}>
                    {relationshipLabel(parentRelationship)
                        ? `Primary Guardian · ${relationshipLabel(parentRelationship)}`
                        : "Primary Guardian"}
                </Text>
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
                            <TextInput
                                style={styles.input}
                                value={parentName}
                                onChangeText={onUpdateParentName}
                                accessibilityLabel="Full Name"
                                autoComplete="name"
                                textContentType="name"
                            />
                        </View>

                        {/* The same five chips the Create an Account form uses,
                            from the same list, so the two screens cannot offer
                            different answers to one question. */}
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>I am the child's…</Text>
                            <View style={styles.chipWrap}>
                                {RELATIONSHIPS.map((opt) => {
                                    const on = parentRelationship === opt.key;
                                    return (
                                        <TouchableOpacity
                                            key={opt.key}
                                            onPress={() =>
                                                onUpdateParentRelationship && onUpdateParentRelationship(opt.key)
                                            }
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={opt.label}
                                            style={[styles.chip, on && styles.chipOn]}
                                        >
                                            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                                accessibilityLabel="Phone Number"
                                placeholder="09XX XXX XXXX"
                                placeholderTextColor={colors.placeholder}
                                autoComplete="tel"
                                textContentType="telephoneNumber"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>City / Municipality</Text>
                            <TextInput
                                style={styles.input}
                                value={city}
                                onChangeText={setCity}
                                accessibilityLabel="City / Municipality"
                                placeholder="Where you live"
                                placeholderTextColor={colors.placeholder}
                                autoComplete="postal-address-locality"
                                textContentType="addressCity"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleSaveInfo}
                            disabled={saving}
                            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: saving }}
                            accessibilityLabel="Save Changes"
                        >
                            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </SectionContainerCard>

            <SectionContainerCard
                title="Sign-in Email"
                subtitle="The address you log in with, and where a password reset is sent"
            >
                {loading ? (
                    <SkeletonBlock width="70%" height={14} radius={6} />
                ) : (
                    <>
                        <View style={styles.currentRow}>
                            <Text style={styles.currentLabel}>Current</Text>
                            <Text style={styles.currentValue} numberOfLines={1}>
                                {email || "Not recorded"}
                            </Text>
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>New Email Address</Text>
                            <TextInput
                                style={[styles.input, emailError && styles.inputError]}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={newEmail}
                                onChangeText={(t) => {
                                    setNewEmail(t);
                                    if (emailError) setEmailError("");
                                }}
                                placeholder="Enter the new address"
                                accessibilityLabel="New Email Address"
                                placeholderTextColor={colors.placeholder}
                                autoComplete="email"
                                textContentType="username"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Current Password</Text>
                            <TextInput
                                style={[styles.input, emailError && styles.inputError]}
                                secureTextEntry
                                value={emailPassword}
                                onChangeText={(t) => {
                                    setEmailPassword(t);
                                    if (emailError) setEmailError("");
                                }}
                                placeholder="Confirm it's you"
                                accessibilityLabel="Current Password"
                                placeholderTextColor={colors.placeholder}
                                autoComplete="current-password"
                                textContentType="password"
                            />
                        </View>
                        {emailError ? (
                            <Text selectable style={styles.errorText}>
                                {emailError}
                            </Text>
                        ) : null}
                        <TouchableOpacity
                            onPress={handleChangeEmail}
                            disabled={emailSaving}
                            style={[styles.secondaryBtn, emailSaving && { opacity: 0.6 }]}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: emailSaving }}
                            accessibilityLabel="Change sign-in email"
                        >
                            <Text style={styles.secondaryBtnText}>
                                {emailSaving ? "Changing…" : "Change Email"}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </SectionContainerCard>
        </Animated.ScrollView>
        </KeyboardAvoider>
    );
}

const makeStyles = (colors) =>
    StyleSheet.create({
        // transparent, not colors.background: App.js paints the page gradient.

        container: { flex: 1, backgroundColor: "transparent" },
        // Padding on the content so the bottom clearance scrolls with it.
        content: { padding: space.lg },
        headerBox: { alignItems: "center", marginVertical: space.lg },
        parentNameText: { ...type.heading, color: colors.primary, marginTop: space.sm },
        parentRoleText: { ...type.caption, color: colors.textMuted, marginTop: 2 },
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
        inputError: { borderColor: colors.danger },
        errorText: { ...type.caption, color: colors.danger, marginBottom: space.sm },
        chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
        chip: {
            minHeight: MIN_TOUCH,
            justifyContent: "center",
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
        },
        chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        chipText: { ...type.caption, color: colors.textSecondary },
        chipTextOn: { fontWeight: "700", color: colors.primary },
        currentRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
        currentLabel: { ...type.subheading, color: colors.textMuted },
        currentValue: { ...type.body, color: colors.text, flex: 1 },
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
        secondaryBtn: {
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: radius.md,
            borderCurve: "continuous",
            height: 44,
            justifyContent: "center",
            alignItems: "center",
            marginTop: space.sm,
        },
        secondaryBtnText: { ...type.label, color: colors.primary },
    });
