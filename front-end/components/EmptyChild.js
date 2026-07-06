import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { space, radius, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";
import Field from "./ui/Field";
import Button from "./ui/Button";
import DateField from "./ui/DateField";
import { useToast } from "./ui/Toast";

// Shown when an authenticated parent has no children yet.
// Progressive disclosure: required fields first, optional details behind a toggle.
export default function EmptyChild({ parentName, onCreate, onLogOut }) {
    const toast = useToast();
    const { colors } = useTheme();
    const [name, setName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("girl");
    const [weight, setWeight] = useState("");
    const [height, setHeight] = useState("");
    const [bloodType, setBloodType] = useState("");
    const [hospital, setHospital] = useState("");
    const [pediatrician, setPediatrician] = useState("");
    const [obgyne, setObgyne] = useState("");
    const [emergencyContact, setEmergencyContact] = useState("");
    const [showMore, setShowMore] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState("");

    const submit = async () => {
        if (!name.trim()) {
            setNameError("Please enter your baby's name");
            return;
        }
        setNameError("");
        setSaving(true);
        try {
            await onCreate({
                name,
                dateOfBirth: dob,
                gender,
                weight,
                height,
                bloodType,
                hospital,
                pediatrician,
                obgyne,
                emergencyContact,
            });
        } catch (e) {
            toast.error(e.message || "Could not add child");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl }}
            style={{ backgroundColor: colors.background }}
        >
            <View
                style={[
                    {
                        backgroundColor: colors.surface,
                        borderRadius: radius.xl,
                        borderCurve: "continuous",
                        padding: space.xl,
                        borderWidth: 1,
                        borderColor: colors.border,
                        maxWidth: 460,
                        width: "100%",
                        alignSelf: "center",
                        gap: space.sm,
                    },
                    shadow.card,
                ]}
            >
                <View
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: radius.lg,
                        borderCurve: "continuous",
                        backgroundColor: colors.softGreen,
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        marginBottom: space.sm,
                    }}
                >
                    <Ionicons name="happy-outline" size={30} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary, textAlign: "center" }}>
                    Welcome{parentName ? `, ${parentName}` : ""}!
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: space.lg }}>
                    Let's add your first child to start their BabyBook+.
                </Text>

                <Field
                    label="Baby's Full Name"
                    placeholder="e.g. Maya Chen"
                    value={name}
                    onChangeText={(t) => {
                        setName(t);
                        if (nameError) setNameError("");
                    }}
                    error={nameError}
                />

                <DateField label="Date of Birth" value={dob} onChange={setDob} />

                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: space.xs }}>
                    Sex
                </Text>
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        borderCurve: "continuous",
                        padding: space.xs,
                        marginBottom: space.md,
                    }}
                >
                    {[
                        { key: "girl", label: "Girl" },
                        { key: "boy", label: "Boy" },
                    ].map((opt) => {
                        const on = gender === opt.key;
                        return (
                            <TouchableOpacity
                                key={opt.key}
                                onPress={() => setGender(opt.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                style={{
                                    flex: 1,
                                    minHeight: 40,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: radius.sm,
                                    backgroundColor: on ? colors.surface : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: on ? "800" : "600", color: on ? colors.primary : colors.textMuted }}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ flexDirection: "row", gap: space.md }}>
                    <View style={{ flex: 1 }}>
                        <Field label="Birth Weight (kg)" placeholder="3.2" keyboardType="numeric" value={weight} onChangeText={setWeight} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Field label="Birth Height (cm)" placeholder="49.0" keyboardType="numeric" value={height} onChangeText={setHeight} />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => setShowMore((s) => !s)}
                    accessibilityRole="button"
                    style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingVertical: space.sm }}
                >
                    <Ionicons name={showMore ? "chevron-down" : "chevron-forward"} size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                        Add health details (optional)
                    </Text>
                </TouchableOpacity>

                {showMore ? (
                    <View>
                        <Field label="Blood Type" placeholder="e.g. O+" autoCapitalize="characters" value={bloodType} onChangeText={setBloodType} />
                        <Field label="Birth Hospital" value={hospital} onChangeText={setHospital} />
                        <Field label="Pediatrician" value={pediatrician} onChangeText={setPediatrician} />
                        <Field label="OB-GYNE" value={obgyne} onChangeText={setObgyne} />
                        <Field label="Emergency Contact" placeholder="Name & number" value={emergencyContact} onChangeText={setEmergencyContact} />
                    </View>
                ) : null}

                <Button title="Create Profile" onPress={submit} loading={saving} />
                <Button title="Log out" variant="ghost" icon="log-out-outline" onPress={onLogOut} style={{ marginTop: space.sm }} />
            </View>
        </ScrollView>
    );
}
